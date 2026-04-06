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
  
  // Weights for different factors
  let score = 0;
  
  // 1. Humidity Impact (High humidity favors mold and dust mites)
  if (humidity > 60) score += (humidity - 60) * 0.8;
  
  // 2. AQI/PM2.5 Impact (Direct correlation with respiratory irritation)
  score += (aqi / 200) * 40;
  score += (pm25 / 100) * 20;

  // 3. Temperature Impact (Extreme heat can increase pollen concentration)
  if (temperature > 30) score += (temperature - 30) * 1.5;

  // 4. Physiological Biomarker (BPM increases can indicate early-stage irritation)
  if (bpm > 100) score += (bpm - 100) * 0.5;

  // Normalize score to 0-100
  const severityIndex = Math.min(Math.round(score), 100);

  // Determine Risk Level
  let riskLevel: 'Low' | 'Moderate' | 'High' | 'Extreme' = 'Low';
  if (severityIndex > 75) riskLevel = 'Extreme';
  else if (severityIndex > 50) riskLevel = 'High';
  else if (severityIndex > 25) riskLevel = 'Moderate';

  // Recommendation logic
  let recommendation = "Environment clear. No special precautions needed.";
  let primaryTrigger = "None";

  if (severityIndex > 25) {
    recommendation = "Moderate risk. Consider closing windows if windy.";
    primaryTrigger = "Humidity/Dust Mites";
  }
  if (severityIndex > 50) {
    recommendation = "High risk. Use air purifiers and limit outdoor activity.";
    primaryTrigger = "Pollen/PM2.5";
  }
  if (severityIndex > 75) {
    recommendation = "EXTREME RISK. Wear an N95 mask and stay indoors.";
    primaryTrigger = "Industrial Pollutants";
  }

  return {
    severityIndex,
    riskLevel,
    primaryTrigger,
    recommendation
  };
};
