import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&hourly=us_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from Open-Meteo API');
    }
    
    const data = await response.json();

    const current = data.current || {};
    const pollenCounts = [
      current.alder_pollen || 0,
      current.birch_pollen || 0,
      current.grass_pollen || 0,
      current.mugwort_pollen || 0,
      current.olive_pollen || 0,
      current.ragweed_pollen || 0
    ];

    const maxPollen = Math.max(...pollenCounts);
    let riskScore = (maxPollen / 100) * 100;
    
    // Slight penalty to overall score if severe Air Quality indexing occurs
    if(current.us_aqi > 50) riskScore += (current.us_aqi * 0.2); 
    if (riskScore > 100) riskScore = 100;

    const allergens = [
      { name: 'Alder', value: current.alder_pollen || 0 },
      { name: 'Birch', value: current.birch_pollen || 0 },
      { name: 'Grass', value: current.grass_pollen || 0 },
      { name: 'Mugwort', value: current.mugwort_pollen || 0 },
      { name: 'Olive', value: current.olive_pollen || 0 },
      { name: 'Ragweed', value: current.ragweed_pollen || 0 },
    ];
    
    const sortedAllergens = allergens.sort((a, b) => b.value - a.value);
    const primaryAllergen = sortedAllergens[0].value > 5 ? sortedAllergens[0].name : "General Particles";

    const structuredData = {
      riskScore: Math.round(riskScore),
      primaryAllergen,
      aqi: current.us_aqi || 0,
      aqiDetails: {
        pm10: current.pm10 || 0,
        pm25: current.pm2_5 || 0,
        ozone: current.ozone || 0,
        no2: current.nitrogen_dioxide || 0,
      },
      details: allergens,
      hourlyForecast: data.hourly || {},
    };

    return NextResponse.json(structuredData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error while fetching allergy data' }, { status: 500 });
  }
}
