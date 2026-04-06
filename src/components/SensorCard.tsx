'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SensorCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  color: string;
  trend?: string;
}

const SensorCard: React.FC<SensorCardProps> = ({ title, value, unit, icon: Icon, color, trend }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-${color}-500/20`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
        {trend && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
            {trend}
          </span>
        )}
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-white/50 mb-1">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-white tracking-tight">
            {value}
          </span>
          {unit && <span className="text-white/40 text-lg">{unit}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default SensorCard;
