import { measuredMedian } from '../src/lib/measured.js';

export const config = { runtime: 'edge' };

// Measured PM2.5 near a point: one median pooled from AirNow regulatory
// monitors (within 50mi) and EPA-corrected PurpleAir consumer sensors
// (~30mi box). Returns {measured:null} when no keys or nothing reports,
// so the client falls back to model-only exactly as before.
export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const lat = Number.parseFloat(searchParams.get('lat'));
  const lon = Number.parseFloat(searchParams.get('lon'));

  const empty = (reason) =>
    new Response(JSON.stringify({ measured: null, reason }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=300',
        'access-control-allow-origin': '*',
      },
    });

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return empty('bad-coords');

  try {
    const median = await measuredMedian(lat, lon, {
      airnowKey: process.env.AIRNOW_API_KEY,
      purpleairKey: process.env.PURPLEAIR_API_KEY,
    });
    if (!median) return empty('no-sensors-nearby');

    return new Response(
      JSON.stringify({
        measured: median.ug,
        aqi: median.aqi,
        count: median.count,
        sources: median.sources,
        area: median.area,
        observedAt: median.observedAt,
      }),
      {
        headers: {
          'content-type': 'application/json',
          // Observations update hourly-ish; 10 min freshness keeps us close
          // without burning the keyed APIs (PurpleAir bills per call).
          'cache-control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch {
    return empty('error');
  }
}
