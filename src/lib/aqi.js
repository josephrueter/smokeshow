// PM2.5 <-> US AQI conversions (EPA 2024 breakpoints), shared by the client
// and the edge functions. AQI is the number every other app leads with, so
// SMOKESHOW leads with it too and teaches the measurement underneath.
const BREAKPOINTS = [
  // [aqiLo, aqiHi, ugLo, ugHi]
  [0, 50, 0.0, 9.0],
  [51, 100, 9.1, 35.4],
  [101, 150, 35.5, 55.4],
  [151, 200, 55.5, 125.4],
  [201, 300, 125.5, 225.4],
  [301, 500, 225.5, 325.4],
];

const CATEGORIES = [
  { max: 50, name: 'Good', color: '#00e400' },
  { max: 100, name: 'Moderate', color: '#ffff00' },
  { max: 150, name: 'Unhealthy for Sensitive Groups', color: '#ff7e00' },
  { max: 200, name: 'Unhealthy', color: '#ff0000' },
  { max: 300, name: 'Very Unhealthy', color: '#8f3f97' },
  { max: Infinity, name: 'Hazardous', color: '#7e0023' },
];

export function ugm3ToAqi(ug) {
  if (ug == null || Number.isNaN(ug)) return null;
  const v = Math.max(0, ug);
  for (const [aqiLo, aqiHi, ugLo, ugHi] of BREAKPOINTS) {
    if (v <= ugHi) {
      return Math.round(aqiLo + ((v - ugLo) / (ugHi - ugLo || 1)) * (aqiHi - aqiLo));
    }
  }
  return 500;
}

export function aqiToUgm3(aqi) {
  for (const [aqiLo, aqiHi, ugLo, ugHi] of BREAKPOINTS) {
    if (aqi <= aqiHi) {
      return ugLo + ((aqi - aqiLo) / (aqiHi - aqiLo || 1)) * (ugHi - ugLo);
    }
  }
  return 325.4;
}

export function aqiCategory(aqi) {
  if (aqi == null) return null;
  return CATEGORIES.find((c) => aqi <= c.max) ?? CATEGORIES[CATEGORIES.length - 1];
}

// Median PM2.5 AQI across AirNow observation rows (shared by /api/sensors
// and /s so the page and its link previews agree).
export function medianPM25Aqi(rows) {
  const pm25 = rows.filter((r) => r.ParameterName === 'PM2.5' && r.AQI >= 0);
  if (!pm25.length) return null;
  const aqis = pm25.map((r) => r.AQI).sort((a, b) => a - b);
  return { aqi: aqis[Math.floor(aqis.length / 2)], count: pm25.length, rows: pm25 };
}
