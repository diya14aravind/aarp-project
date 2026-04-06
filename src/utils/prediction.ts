/**
 * AARP V2 - Airborne Allergy Radar Prediction ML Utility
 * 
 * This heuristic-based model integrates real-time sensor data with 
 * current environmental conditions to predict allergy severity.
 */

export interface PredictionFeatures {
  humidity: number;
  temperature: number;
  bpm: number;
  aqi?: number;
  pm25?: number;
}

export interface PredictionResult {
  severityIndex: number; // 0-100
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
  primaryTrigger: string;
  recommendation: string;
}

export const predictAllergySeverity = (features: PredictionFeatures): PredictionResult => {
  const { humidity, temperature, bpm, aqi = 50, pm25 = 15 } = features;
  
  let score = 0;
  
  // 1. FUSED HUMIDITY ANOMALY (Local hardware vs Regional API)
  // If local humidity is high, it's the primary risk regardless of AQI.
  if (humidity > 55) {
    score += (humidity - 55) * 1.2; // Aggressive local weighting
  }
  
  // 2. AQI/PM2.5 (Regional Context)
  score += (aqi / 250) * 30;
  score += (pm25 / 80) * 15;

  // 3. PHYSIOLOGICAL FEEDBACK (BPM spike detection)
  if (bpm > 100) {
    score += (bpm - 100) * 0.7; // Pulse irritation alert
  }

  // 4. THERMAL STRESS
  if (temperature > 32) score += (temperature - 32) * 2;

  const severityIndex = Math.min(Math.round(score), 100);

  let riskLevel: 'Low' | 'Moderate' | 'High' | 'Extreme' = 'Low';
  if (severityIndex > 80) riskLevel = 'Extreme';
  else if (severityIndex > 55) riskLevel = 'High';
  else if (severityIndex > 30) riskLevel = 'Moderate';

  let recommendation = "Local environment stable.";
  let primaryTrigger = "None";

  if (severityIndex > 30) {
    recommendation = "Localized allergens detected. Close windows.";
    primaryTrigger = "Local Humidity Spike";
  }
  if (severityIndex > 55) {
    recommendation = "High risk. Local and regional filters recommended.";
    primaryTrigger = "Pollen + Humidity";
  }
  if (severityIndex > 80) {
    recommendation = "CRITICAL: Bio-hazard level irritation detected locally.";
    primaryTrigger = "Combined Bio-Thermal Stress";
  }

  return {
    severityIndex,
    riskLevel,
    primaryTrigger,
    recommendation
  };
};
