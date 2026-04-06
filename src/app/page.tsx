"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Activity, Droplets, Leaf, Navigation, X, Wind, AlertCircle, 
  Heart, Zap, BarChart3, ShieldAlert, Radio
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from "recharts";
import { predictAllergySeverity, PredictionResult } from "@/utils/prediction";
import io from "socket.io-client";
import SensorCard from "@/components/SensorCard";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const LOCATIONS = [
  // Asia
  { lat: 12.9716, lng: 77.5946, name: "Bangalore, India", size: 0.8 },
  { lat: 28.6139, lng: 77.2090, name: "New Delhi, India", size: 0.8 },
  { lat: 35.6762, lng: 139.6503, name: "Tokyo, Japan", size: 0.8 },
  { lat: 25.2048, lng: 55.2708, name: "Dubai, UAE", size: 0.8 },
  // Europe
  { lat: 51.5074, lng: -0.1278, name: "London, UK", size: 0.8 },
  { lat: 48.8566, lng: 2.3522, name: "Paris, France", size: 0.8 },
  // Americas
  { lat: 40.7128, lng: -74.0060, name: "New York, USA", size: 0.8 },
  { lat: 34.0522, lng: -118.2437, name: "Los Angeles, USA", size: 0.8 },
  { lat: -22.9068, lng: -43.1729, name: "Rio de Janeiro, Brazil", size: 0.8 },
  // Africa & Oceania
  { lat: -33.9249, lng: 18.4241, name: "Cape Town, South Africa", size: 0.8 },
  { lat: -33.8688, lng: 151.2093, name: "Sydney, Australia", size: 0.8 },
];

interface AllergyData {
  riskScore: number;
  primaryAllergen: string;
  aqi: number;
  aqiDetails: { pm10: number; pm25: number; ozone: number; no2: number };
  details: { name: string; value: number }[];
  hourlyForecast: { time: string[]; us_aqi: number[] };
}

export default function Home() {
  const globeRef = useRef<any>(null);
  const [data, setData] = useState<AllergyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [sensorData, setSensorData] = useState<{
    bpm: number; hum: number; temp: number; lat: number; lng: number; sats: number;
  } | null>(null);
  const [bpmHistory, setBpmHistory] = useState<{ time: string; bpm: number }[]>([]);
  const [humidityHistory, setHumidityHistory] = useState<{ time: string; hum: number }[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  
  // Emergency Protocol State
  const [emergency, setEmergency] = useState<{ active: boolean, reason: string, timeLeft: number, dispatched: boolean } | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);

    // Auto-rotate the globe slowly
    const timer = setTimeout(() => {
      if (globeRef.current) {
        const controls = globeRef.current.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.6; // Slow and majestic rotation
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);


  // Emergency Countdown Timer logic
  useEffect(() => {
    let interval: any;
    if (emergency?.active && !emergency.dispatched) {
      interval = setInterval(() => {
        setEmergency(prev => prev ? { ...prev, timeLeft: Math.max(0, prev.timeLeft - 1) } : null);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emergency?.active, emergency?.dispatched]);

  useEffect(() => {
    // FIX: Using dynamic mapping for Vercel vs Local
    const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3002";
    const socket = io(bridgeUrl);
    socketRef.current = socket;

    socket.on("sensor-data", (newData: any) => {
      setSensorData(newData);
      const risk = predictAllergySeverity({
        humidity: newData.hum,
        temperature: newData.temp,
        bpm: newData.bpm,
        aqi: data?.aqi || 50,
        pm25: data?.aqiDetails?.pm25 || 15
      });
      setPrediction(risk);
      const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setBpmHistory(prev => [...prev.slice(-30), { time: timeStamp, bpm: newData.bpm }]);
      setHumidityHistory(prev => [...prev.slice(-30), { time: timeStamp, hum: newData.hum }]);
    });

    socket.on("emergency-start", (alert: any) => {
       setEmergency({ active: true, reason: alert.reason, timeLeft: 120, dispatched: false });
    });

    socket.on("emergency-cancelled", () => {
       setEmergency(null);
    });

    socket.on("emergency-dispatch", () => {
       setEmergency(prev => prev ? { ...prev, dispatched: true } : null);
    });

    return () => { socket.disconnect(); };
  }, [data, loading]);

  const handleAcknowledge = () => {
     if (socketRef.current) socketRef.current.emit("acknowledge");
  };

  const fetchDataForCoordinates = async (lat: number, lon: number, name?: string) => {
    setLoading(true);
    if (globeRef.current) globeRef.current.pointOfView({ lat, lng: lon, altitude: 2 }, 1500);
    try {
      if (!name) {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const geoData = await geoRes.json();
        setLocationName(geoData.address?.suburb || geoData.address?.city || "Detected Node");
      } else {
        setLocationName(name);
      }
      const response = await fetch(`/api/allergy?lat=${lat}&lon=${lon}`);
      const result = await response.json();
      setData(result);
    } catch (err: any) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const useMyLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => fetchDataForCoordinates(position.coords.latitude, position.coords.longitude),
        () => setError("Location access denied.")
      );
    } else {
      setError("Geolocation not supported.");
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020617] text-white font-sans selection:bg-blue-500/30">
      {/* Background Globe Radar */}
      <div className="absolute inset-0 z-0">
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          pointsData={LOCATIONS}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => "#f43f5e"} // High contrast rose-red points to pop against the blue earth
          pointAltitude={0.08}
          pointRadius={0.8}
          onPointClick={(pt: any) => fetchDataForCoordinates(pt.lat, pt.lng, pt.name)}
          atmosphereColor="#38bdf8" // Bright cyan glow
          atmosphereAltitude={0.25}
        />
      </div>

      {/* TOP MISSION CONTROL BAR */}
      <div className="absolute top-0 left-0 w-full z-20 px-6 py-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col drop-shadow-md">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 uppercase">AARP</h1>
          </div>
          <p className="text-xs font-mono text-slate-400 tracking-widest uppercase mt-1">Airborne Allergy Radar</p>
        </div>

        <div className="flex gap-4 items-center bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> UPLINK SECURE
          </div>
        </div>
      </div>

      {/* LEFT SIDEBAR: BIOMETRIC MONITOR */}
      <div className="absolute top-24 left-6 z-30 w-72 space-y-4">
        <AnimatePresence mode="wait">
          {sensorData && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              {/* HEART RATE PULSE */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Heart Rate</p>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 60/sensorData.bpm, ease: "easeInOut" }} 
                  >
                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                  </motion.div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{sensorData.bpm}</span>
                  <span className="text-slate-500 text-xs font-bold">BPM</span>
                </div>
                {/* SMALL PULSE WAVEFORM */}
                <div className="mt-2 h-12 w-full bg-black/10 rounded-lg overflow-hidden border border-white/5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bpmHistory}>
                      <defs>
                        <linearGradient id="rosePulse" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="bpm" stroke="#f43f5e" strokeWidth={1} fill="url(#rosePulse)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* HUMIDITY SENSOR */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase mb-1">Local Humidity</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{sensorData.hum.toFixed(1)}</span>
                    <span className="text-blue-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <Droplets className="w-6 h-6 text-blue-400 opacity-80" />
              </div>

              {/* GPS FOOTPRINT */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors">
                 <div className="flex justify-between items-center text-[10px] font-mono text-emerald-400 uppercase mb-1">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Hardware GPS</span>
                 </div>
                 <div className="text-xs font-mono text-slate-400 space-y-1">
                   <div>{sensorData?.lat.toFixed(5)}, {sensorData?.lng.toFixed(5)}</div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT SIDEBAR: AI RADAR PREDICTION */}
      <div className="absolute top-24 right-6 z-30 w-[400px] space-y-4 h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pb-10">
        {/* LOCATION CONTEXT */}
        <AnimatePresence>
          {data && (
            <motion.section 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative"
            >
              <div className="flex justify-between items-start mb-4">
                 <div>
                   <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-1">Location Reading</p>
                   <h3 className="text-xl font-bold text-white">{locationName}</h3>
                 </div>
                 <button onClick={() => setData(null)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                   <X className="w-4 h-4 text-white" />
                 </button>
              </div>
              <div className="flex gap-3">
                 <div className="flex-1 p-3 rounded-xl bg-black/20 border border-white/5">
                    <p className="text-[10px] text-slate-400 uppercase mb-1">AQI (US)</p>
                    <p className="text-2xl font-black text-emerald-400">{data.aqi}</p>
                 </div>
                 <div className="flex-1 p-3 rounded-xl bg-black/20 border border-white/5">
                    <p className="text-[10px] text-slate-400 uppercase mb-1">PM 2.5</p>
                    <p className="text-2xl font-black text-amber-400">{data.aqiDetails.pm25}</p>
                 </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {prediction && (
          <section className="space-y-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-6 rounded-2xl border ${prediction.riskLevel === 'Extreme' ? 'border-red-500/40 bg-red-500/10' : 'border-blue-500/40 bg-blue-500/10'} backdrop-blur-xl relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert className="w-16 h-16" /></div>
              <p className="text-[10px] font-mono text-slate-400 uppercase mb-2">Severity Index</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-bold text-white">{prediction.severityIndex}</span>
                <span className="text-xl font-medium text-slate-500">/ 100</span>
              </div>
              
              <div className="space-y-2">
                <div className={`text-sm font-bold uppercase ${prediction.riskLevel === 'Extreme' ? 'text-red-400' : 'text-blue-400'}`}>
                   {prediction.riskLevel} RISK
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{prediction.recommendation}</p>
              </div>
            </motion.div>

            {/* ENVIRONMENTAL DETAIL LIST */}
            {data && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                 <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Pollen Breakdown</h3>
                 </div>
                 <div className="space-y-3">
                    {data.details.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center group">
                        <span className="text-xs text-slate-300 group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                           <Leaf className="w-3 h-3" /> {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">{item.value.toFixed(1)} µg</span>
                        </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}
          </section>
        )}
      </div>

      {/* BOTTOM LOCATION PROMPT */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
        <button 
          onClick={useMyLocation} 
          className="flex items-center gap-2 bg-blue-600/80 hover:bg-blue-500 backdrop-blur-xl border border-white/20 text-white px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all shadow-lg"
        >
          <Navigation className="w-4 h-4" /> 
          <span>USE MY LOCATION</span>
        </button>
      </div>
      {/* LOADING SCANNER */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="w-24 h-24 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6" />
            <span className="text-xs font-mono tracking-[0.5em] text-blue-400 animate-pulse uppercase">Syncing Atmospheric Uplink</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL SCREEN EMERGENCY PROTOCOL OVERLAY */}
      <AnimatePresence>
        {emergency && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 z-[200] bg-red-950/80 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            <motion.div 
               animate={{ opacity: [0.5, 1, 0.5] }} 
               transition={{ repeat: Infinity, duration: 1 }}
               className="absolute inset-0 border-[16px] border-red-600 pointer-events-none" 
            />
            
            <ShieldAlert className="w-32 h-32 text-red-500 mb-8 animate-pulse" />
            
            <h1 className="text-6xl font-black text-white tracking-tighter uppercase text-center drop-shadow-lg">
              CRITICAL EMERGENCY
            </h1>
            <p className="text-2xl text-red-300 font-mono mt-4 tracing-widest">
              {'///'} {emergency.reason} {'///'}
            </p>

            <div className="mt-12 p-8 bg-black/50 border border-red-500/50 rounded-3xl flex flex-col items-center">
               {!emergency.dispatched ? (
                 <>
                  <p className="text-sm font-mono text-white/50 uppercase mb-2">Automated Dispatch In</p>
                  <p className="text-8xl font-black text-white mb-2">{emergency.timeLeft}s</p>
                  <p className="text-xs text-red-400 font-mono text-center max-w-sm">
                     If alarm is not acknowledged, Emergency Medical Services will be dispatched to coordinate GPS: {sensorData?.lat.toFixed(4)}, {sensorData?.lng.toFixed(4)}.
                  </p>
                 </>
               ) : (
                 <>
                  <p className="text-sm font-mono text-white/50 uppercase mb-2">Notice</p>
                  <p className="text-6xl font-black text-red-500 mb-2">DISPATCHED</p>
                  <p className="text-xs text-red-400 font-mono text-center max-w-sm">
                     Local authorities and hospital have been notified. Please remain calm.
                  </p>
                 </>
               )}
            </div>

            <button 
              onClick={handleAcknowledge}
              className="mt-12 px-12 py-6 bg-white hover:bg-slate-200 text-red-900 font-black text-xl rounded-full tracking-wider transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.4)]"
            >
               ACKNOWLEDGE & CANCEL ALARM
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
