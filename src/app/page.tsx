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
  { lat: 12.9716, lng: 77.5946, name: "Bangalore, India", size: 0.8 },
  { lat: 12.9165, lng: 79.1325, name: "Vellore, India", size: 0.8 },
  { lat: 28.6139, lng: 77.2090, name: "New Delhi, India", size: 0.8 },
  { lat: 19.0760, lng: 72.8777, name: "Mumbai, India", size: 0.8 },
  { lat: 13.0827, lng: 80.2707, name: "Chennai, India", size: 0.8 },
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
    return () => window.removeEventListener("resize", handleResize);
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
    const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3001";
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
      <div className="absolute inset-0 z-0 opacity-60 grayscale-[0.5] brightness-[0.7]">
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          pointsData={LOCATIONS}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => "#3b82f6"}
          pointAltitude={0.05}
          pointRadius={0.7}
          onPointClick={(pt: any) => fetchDataForCoordinates(pt.lat, pt.lng, pt.name)}
          atmosphereColor="#1e3a8a"
          atmosphereAltitude={0.2}
        />
      </div>

      {/* TOP MISSION CONTROL BAR */}
      <div className="absolute top-0 left-0 w-full z-20 px-8 py-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center border-b border-white/5 backdrop-blur-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">AARP TACTICAL HUD <span className="text-blue-500">v3.0</span></h1>
          </div>
          <p className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase">Airborne Allergy & Respiratory Predictor</p>
        </div>

        <div className="flex gap-6 items-center">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-white/30 uppercase">Uplink Status</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> SECURE
            </span>
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-white/30 uppercase">Hardware Node</span>
            <span className="text-sm font-bold text-blue-400">UNO_RADAR_01</span>
          </div>
        </div>
      </div>

      {/* LEFT SIDEBAR: BIOMETRIC MONITOR */}
      <div className="absolute top-24 left-8 z-30 w-80 space-y-6">
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-rose-500" />
            <h2 className="text-xs font-mono font-bold tracking-widest text-white/60 uppercase">Biometric Stream</h2>
          </div>
          
          <AnimatePresence mode="wait">
            {sensorData ? (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* HEART RATE PULSE */}
                <div className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <motion.div 
                      animate={{ scale: [1, 1.3, 1] }} 
                      transition={{ repeat: Infinity, duration: 60/sensorData.bpm, ease: "easeInOut" }} 
                    >
                      <Heart className="w-10 h-10 text-rose-500 fill-rose-500/20 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
                    </motion.div>
                  </div>
                  <p className="text-[10px] font-mono text-white/40 uppercase mb-1">Heart Rate</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-rose-400">{sensorData.bpm}</span>
                    <span className="text-white/60 font-bold text-lg">BPM</span>
                  </div>
                  {/* SCANLINE PULSE WAVEFORM */}
                  <div className="mt-4 h-24 w-full bg-black/20 rounded-xl overflow-hidden border border-white/5">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bpmHistory}>
                        <defs>
                          <linearGradient id="rosePulse" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="bpm" stroke="#f43f5e" strokeWidth={2} fill="url(#rosePulse)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* HUMIDITY SENSOR */}
                <div className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-mono text-white/40 uppercase mb-1">Humidity</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">{sensorData.hum.toFixed(1)}</span>
                      <span className="text-blue-400 font-bold">%</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-500/10"><Droplets className="w-6 h-6 text-blue-400" /></div>
                </div>
              </motion.div>
            ) : (
              <div className="p-8 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                <p className="text-xs font-mono text-white/30 animate-pulse">Waiting for hardware telemetry...</p>
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* GPS FOOTPRINT */}
        <section className="p-4 rounded-2xl bg-blue-900/10 border border-blue-500/20 backdrop-blur-md">
           <div className="flex justify-between items-center text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-2">
              <span className="flex items-center gap-2"><MapPin className="w-3 h-3" /> GPS Tracking</span>
              <span>{sensorData?.sats || 0} SATS</span>
           </div>
           <div className="text-xs font-mono text-white/60 space-y-1">
             <div>LAT: {sensorData?.lat.toFixed(5) || "0.00000"}</div>
             <div>LNG: {sensorData?.lng.toFixed(5) || "0.00000"}</div>
           </div>
        </section>
      </div>

      {/* RIGHT SIDEBAR: AI RADAR PREDICTION */}
      <div className="absolute top-24 right-8 z-30 w-96 space-y-6 h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pb-10">
        {prediction && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-mono font-bold tracking-widest text-white/60 uppercase">Advanced Synergy Radar</h2>
            </div>
            
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-8 rounded-[2rem] border ${prediction.riskLevel === 'Extreme' ? 'border-red-500/50 bg-red-950/20' : 'border-emerald-500/50 bg-emerald-950/20'} backdrop-blur-2xl relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12"><ShieldAlert className="w-20 h-20" /></div>
              <p className="text-[10px] font-mono text-white/40 uppercase mb-4 tracking-[0.2em]">FUSED SEVERITY INDEX</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-8xl font-black text-white">{prediction.severityIndex}</span>
                <span className="text-2xl font-bold opacity-30 italic">radar_score</span>
              </div>
              
              <div className="space-y-4">
                <div className={`text-xl font-black tracking-tighter uppercase italic ${prediction.riskLevel === 'Extreme' ? 'text-red-400' : 'text-emerald-400'}`}>
                   {prediction.riskLevel} IRREVERSIBILITY RISK
                </div>
                <p className="text-sm text-white/50 leading-relaxed font-medium">{prediction.recommendation}</p>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-white/40">
                  <span>DOMINANT TRIGGER</span>
                  <span className="text-white px-3 py-1 bg-white/10 rounded-full">{prediction.primaryTrigger}</span>
                </div>
              </div>
            </motion.div>

            {/* ENVIRONMENTAL DETAIL LIST */}
            {data && (
              <motion.div transition={{ delay: 0.2 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl">
                 <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Atmospheric Breakdown</h3>
                 </div>
                 <div className="space-y-4">
                    {data.details.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center group">
                        <span className="text-sm text-white/40 group-hover:text-emerald-400 transition-colors flex items-center gap-3">
                           <Leaf className="w-4 h-4" /> {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500/50" style={{ width: `${Math.min(item.value, 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-white/80">{item.value.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}
          </section>
        )}

        {/* LOCATION CONTEXT */}
        <section className={`p-6 rounded-3xl bg-black/60 border border-white/5 backdrop-blur-md transition-opacity duration-500 ${data ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex justify-between items-start">
             <div>
               <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-1">Target Geolocation</p>
               <h3 className="text-2xl font-bold italic">{locationName}</h3>
             </div>
             <button onClick={() => setData(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>
          {data && (
             <div className="mt-6 flex gap-4">
               <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] text-white/30 uppercase mb-1">AQI (US)</p>
                  <p className="text-2xl font-black text-emerald-400">{data.aqi}</p>
               </div>
               <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] text-white/30 uppercase mb-1">PM 2.5</p>
                  <p className="text-2xl font-black text-orange-400">{data.aqiDetails.pm25}</p>
               </div>
             </div>
          )}
        </section>
      </div>

      {/* BOTTOM RADAR CONTROLS */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-black/60 backdrop-blur-2xl border border-white/10 px-8 py-3 rounded-full">
         <button onClick={useMyLocation} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase italic transition-all active:scale-95">
           <Navigation className="w-3 h-3" /> Target My Location
         </button>
         <div className="h-4 w-[1px] bg-white/20" />
         <div className="flex items-center gap-4 text-[10px] font-mono text-white/40 tracking-widest">
           <span>SCAN_MODE: PASSIVE</span>
           <span>FREQ: 115200Hz</span>
         </div>
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
