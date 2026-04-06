"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Activity, Droplets, Leaf, Navigation, X, Wind, AlertCircle
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// react-globe.gl requires CSR only
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const LOCATIONS = [
  { lat: 12.9716, lng: 77.5946, name: "Bangalore, India", size: 0.8 },
  { lat: 12.9165, lng: 79.1325, name: "Vellore, India", size: 0.8 },
  { lat: 28.6139, lng: 77.2090, name: "New Delhi, India", size: 0.8 },
  { lat: 19.0760, lng: 72.8777, name: "Mumbai, India", size: 0.8 },
  { lat: 13.0827, lng: 80.2707, name: "Chennai, India", size: 0.8 },
  { lat: 35.6762, lng: 139.6503, name: "Tokyo, Japan", size: 0.8 },
  { lat: 40.7128, lng: -74.0060, name: "New York, USA", size: 0.8 },
  { lat: 51.5074, lng: -0.1278, name: "London, UK", size: 0.8 },
  { lat: -33.8688, lng: 151.2093, name: "Sydney, Australia", size: 0.8 },
  { lat: -23.5505, lng: -46.6333, name: "São Paulo, Brazil", size: 0.8 },
  { lat: 1.3521, lng: 103.8198, name: "Singapore", size: 0.8 },
];

interface AllergyData {
  riskScore: number;
  primaryAllergen: string;
  aqi: number;
  aqiDetails: {
    pm10: number;
    pm25: number;
    ozone: number;
    no2: number;
  };
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

  useEffect(() => {
    // Handling window dimensions securely during CSR
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    
    // Enable auto-rotation
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.4;
    }
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchDataForCoordinates = async (lat: number, lon: number, name?: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = false;
      globeRef.current.pointOfView({ lat, lng: lon, altitude: 2 }, 1500);
    }

    try {
      if (!name) {
        // Refined Geolocation lookup prioritizing local districts and suburbs over broad city zones
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const geoData = await geoRes.json();
        const address = geoData.address || {};
        const preciseName = address.suburb || address.city_district || address.neighbourhood || address.city || address.county || "Detected Location";
        setLocationName(preciseName);
      } else {
        setLocationName(name);
      }

      const response = await fetch(`/api/allergy?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error("Failed to fetch allergy data");
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
    }
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

  const chartData = data?.hourlyForecast?.time?.slice(0, 24).map((timeStr, idx) => ({
    time: new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    AQI: data.hourlyForecast.us_aqi[idx],
  })) || [];

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {/* 3D Globe Background */}
      <div className="absolute inset-0 z-0">
        <Globe
          ref={globeRef}
          width={dimensions.width || 800}
          height={dimensions.height || 600}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          pointsData={LOCATIONS}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => "#3b82f6"}
          pointAltitude={0.05}
          pointRadius={0.5}
          pointsMerge={false}
          onPointClick={(pt: any) => fetchDataForCoordinates(pt.lat, pt.lng, pt.name)}
          atmosphereColor="#3b82f6"
          atmosphereAltitude={0.15}
        />
      </div>

      {/* Hero Header */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-3xl font-bold tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 drop-shadow-lg">AARP</h1>
        <p className="text-slate-400 text-xs tracking-widest mt-1 opacity-80 uppercase">Airborne Allergy & AQI Radar</p>
      </div>

      {/* Floating Prompt UI (when no location is active) */}
      {!data && !loading && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-6 rounded-3xl"
        >
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <AlertCircle className="w-5 h-5 text-blue-400 animate-pulse" />
            Select any glowing point on the globe
          </div>
          <p className="text-xs text-slate-500 font-mono">OR</p>
          <button
            onClick={useMyLocation}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white px-5 py-2.5 rounded-full text-sm font-semibold tracking-wide"
          >
            <Navigation className="w-4 h-4" />
            USE MY LOCATION
          </button>
        </motion.div>
      )}

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <span className="tracking-widest text-blue-400 text-sm font-medium uppercase">Establishing Uplink...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holographic Data HUD */}
      <AnimatePresence>
        {data && !loading && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="absolute top-0 right-0 h-full w-full md:w-[480px] bg-black/60 backdrop-blur-2xl border-l border-white/5 z-30 overflow-y-auto"
          >
            <div className="p-8 pb-32">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-xs font-mono tracking-widest text-blue-400 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> UPLINK ESTABLISHED
                  </h2>
                  <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400 leading-tight">
                    {locationName}
                  </h3>
                </div>
                <button 
                  onClick={() => { setData(null); if(globeRef.current) globeRef.current.controls().autoRotate = true; }}
                  className="p-2 bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 rounded-full transition-colors mt-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Master Risk Metric Component */}
              <div className="bg-gradient-to-br from-blue-900/30 to-slate-900/40 border border-blue-500/30 p-8 rounded-3xl relative overflow-hidden mb-10 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl opacity-60 pointer-events-none" />
                <span className="text-xs font-mono text-blue-300 uppercase tracking-widest block mb-6">Threat Level</span>
                <div className="flex items-end gap-3">
                  <span className="text-[5rem] leading-none font-black text-white">{data.riskScore}</span>
                  <span className="text-slate-400 text-lg font-medium pb-2">/ 100</span>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center text-sm">
                  <span className="text-slate-400 uppercase tracking-wider text-xs">Primary Focus</span>
                  <span className="text-rose-400 font-semibold flex items-center gap-2 bg-rose-500/10 px-3 py-1 rounded-full">
                    <AlertCircle className="w-4 h-4" /> {data.primaryAllergen}
                  </span>
                </div>
              </div>

              {/* Advanced Particulate Breakdown */}
              <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Atmospheric Composition</h4>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl hover:bg-white/10 transition-colors">
                  <div className="text-slate-400 text-xs tracking-wider mb-2 flex items-center justify-between">AQI (US) <Wind className="w-4 h-4 text-emerald-400" /></div>
                  <div className="text-3xl font-bold">{data.aqi}</div>
                </div>
                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl hover:bg-white/10 transition-colors">
                  <div className="text-slate-400 text-xs tracking-wider mb-2 flex items-center justify-between">PM 2.5 <Activity className="w-4 h-4 text-orange-400" /></div>
                  <div className="text-3xl font-bold">{data.aqiDetails.pm25}<span className="text-[10px] ml-1 text-slate-500 font-normal">µg/³</span></div>
                </div>
                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl hover:bg-white/10 transition-colors">
                  <div className="text-slate-400 text-xs tracking-wider mb-2 flex items-center justify-between">PM 10 <Wind className="w-4 h-4 text-yellow-400" /></div>
                  <div className="text-3xl font-bold">{data.aqiDetails.pm10}<span className="text-[10px] ml-1 text-slate-500 font-normal">µg/³</span></div>
                </div>
                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl hover:bg-white/10 transition-colors">
                  <div className="text-slate-400 text-xs tracking-wider mb-2 flex items-center justify-between">Ozone <Droplets className="w-4 h-4 text-blue-400" /></div>
                  <div className="text-3xl font-bold">{data.aqiDetails.ozone}<span className="text-[10px] ml-1 text-slate-500 font-normal">µg/³</span></div>
                </div>
              </div>

              {/* High-Resolution Pollutants */}
              <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Pollen Count Detail</h4>
              <div className="space-y-4 mb-10">
                {data.details.map((item) => (
                  <div key={item.name} className="flex justify-between items-center group bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-sm text-slate-300 flex items-center gap-3">
                       <Leaf className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                       {item.name}
                    </span>
                    <span className="text-sm font-medium">{item.value.toFixed(1)} <span className="text-[10px] text-slate-500">µg</span></span>
                  </div>
                ))}
              </div>

              {/* Live Trajectory Chart */}
              <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Trajectory (24H)</h4>
              <div className="h-48 w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAQI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", fontSize: "12px", padding: "10px" }}
                      itemStyle={{ color: "#60a5fa", fontWeight: "bold" }}
                      labelStyle={{ color: "#94a3b8", marginBottom: "5px" }}
                    />
                    <Area type="monotone" dataKey="AQI" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAQI)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
