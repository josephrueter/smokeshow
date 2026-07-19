export const config = { runtime: 'edge' };

const UPSTREAM = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ALLOWED_PARAMS = new Set([
  'latitude',
  'longitude',
  'hourly',
  'past_days',
  'forecast_days',
  'timezone',
]);

// Cache proxy for Open-Meteo: the free tier (~10k locations/day) would fail
// exactly during a viral smoke event, so identical grid requests must hit
// Vercel's CDN cache instead of the upstream. Client-side coordinate
// snapping (see grid.js) makes nearby users produce identical URLs; this
// function adds the cache headers Open-Meteo doesn't send. Smoke runs update
// hourly — 30min freshness with an hour of stale-while-revalidate keeps one
// upstream fetch per area per half hour regardless of traffic.
export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const upstream = new URL(UPSTREAM);
  for (const [key, value] of searchParams) {
    if (ALLOWED_PARAMS.has(key)) upstream.searchParams.set(key, value);
  }

  const res = await fetch(upstream);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': res.ok
        ? 'public, s-maxage=1800, stale-while-revalidate=3600'
        : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
