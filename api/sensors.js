export const config = { runtime: 'edge' };

// Nearest measured PM2.5 from AirNow monitors/sensors — the "Now" truth
// anchor. Returns {measured, aqi, count, observedAt} or {measured:null}
// when no key is configured or nothing reports nearby, so the client can
// fall back to model-only exactly as before.
//
// AirNow returns AQI, not concentration; we invert the EPA PM2.5
// breakpoints (2024 revision) to get µg/m³ back.
const BREAKPOINTS = [
  // [aqiLo, aqiHi, ugLo, ugHi]
  [0, 50, 0.0, 9.0],
  [51, 100, 9.1, 35.4],
  [101, 150, 35.5, 55.4],
  [151, 200, 55.5, 125.4],
  [201, 300, 125.5, 225.4],
  [301, 500, 225.5, 325.4],
];

function aqiToUgm3(aqi) {
  for (const [aqiLo, aqiHi, ugLo, ugHi] of BREAKPOINTS) {
    if (aqi <= aqiHi) {
      return ugLo + ((aqi - aqiLo) / (aqiHi - aqiLo || 1)) * (ugHi - ugLo);
    }
  }
  return 325.4;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const lat = Number.parseFloat(searchParams.get('lat'));
  const lon = Number.parseFloat(searchParams.get('lon'));
  const key = process.env.AIRNOW_API_KEY;

  const empty = (reason) =>
    new Response(JSON.stringify({ measured: null, reason }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=300',
        'access-control-allow-origin': '*',
      },
    });

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return empty('bad-coords');
  if (!key) return empty('no-key');

  try {
    const url =
      `https://www.airnowapi.org/aq/observation/latLong/current/` +
      `?format=application/json&latitude=${lat}&longitude=${lon}&distance=50&API_KEY=${key}`;
    const res = await fetch(url);
    if (!res.ok) return empty(`upstream-${res.status}`);
    const rows = await res.json();

    const pm25 = rows.filter((r) => r.ParameterName === 'PM2.5' && r.AQI >= 0);
    if (!pm25.length) return empty('no-pm25-nearby');

    // Median across reporting sites — robust to one weird sensor.
    const aqis = pm25.map((r) => r.AQI).sort((a, b) => a - b);
    const aqi = aqis[Math.floor(aqis.length / 2)];

    return new Response(
      JSON.stringify({
        measured: Math.round(aqiToUgm3(aqi) * 10) / 10,
        aqi,
        count: pm25.length,
        area: pm25[0].ReportingArea,
        observedAt: `${pm25[0].DateObserved?.trim()}T${String(pm25[0].HourObserved).padStart(2, '0')}:00`,
      }),
      {
        headers: {
          'content-type': 'application/json',
          // Observations update hourly; 10 min freshness keeps us close
          // without hammering the keyed API.
          'cache-control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch {
    return empty('error');
  }
}
