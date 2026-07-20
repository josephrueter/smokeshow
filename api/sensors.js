import { aqiToUgm3, medianPM25Aqi } from '../src/lib/aqi.js';

export const config = { runtime: 'edge' };

// Nearest measured PM2.5 from AirNow monitors/sensors — the "Now" truth
// anchor. Returns {measured, aqi, count, observedAt} or {measured:null}
// when no key is configured or nothing reports nearby, so the client can
// fall back to model-only exactly as before.
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

    const median = medianPM25Aqi(rows);
    if (!median) return empty('no-pm25-nearby');
    const first = median.rows[0];

    return new Response(
      JSON.stringify({
        measured: Math.round(aqiToUgm3(median.aqi) * 10) / 10,
        aqi: median.aqi,
        count: median.count,
        area: first.ReportingArea,
        observedAt: `${first.DateObserved?.trim()}T${String(first.HourObserved).padStart(2, '0')}:00`,
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
