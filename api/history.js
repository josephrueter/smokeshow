import { aqiToUgm3, medianPM25Aqi } from '../src/lib/aqi.js';

export const config = { runtime: 'edge' };

// Measured daily PM2.5 AQI for a past date, from AirNow's historical
// observations — what the monitors actually recorded, replacing the model's
// guess about yesterday. Past dates are immutable, so cache hard.
export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const lat = Number.parseFloat(searchParams.get('lat'));
  const lon = Number.parseFloat(searchParams.get('lon'));
  const date = searchParams.get('date'); // YYYY-MM-DD (local date at the location)
  const key = process.env.AIRNOW_API_KEY;

  const empty = (reason) =>
    new Response(JSON.stringify({ aqi: null, reason }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=1800',
        'access-control-allow-origin': '*',
      },
    });

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return empty('bad-coords');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return empty('bad-date');
  if (!key) return empty('no-key');

  try {
    const url =
      `https://www.airnowapi.org/aq/observation/latLong/historical/` +
      `?format=application/json&latitude=${lat}&longitude=${lon}` +
      `&date=${date}T00-0000&distance=50&API_KEY=${key}`;
    const res = await fetch(url);
    if (!res.ok) return empty(`upstream-${res.status}`);
    const median = medianPM25Aqi(await res.json());
    if (!median) return empty('no-pm25');

    return new Response(
      JSON.stringify({
        aqi: median.aqi,
        ug: Math.round(aqiToUgm3(median.aqi) * 10) / 10,
        count: median.count,
        date,
      }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch {
    return empty('error');
  }
}
