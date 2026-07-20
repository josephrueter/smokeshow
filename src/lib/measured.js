// Server-side measured-air pooling, used by the edge functions (api/sensors,
// api/s). Combines AirNow regulatory monitors with PurpleAir consumer sensors
// into one median. Pure fetch logic — no window, no Vite.
import { aqiToUgm3, ugm3ToAqi } from './aqi.js';

async function airnowUgm3(lat, lon, key) {
  if (!key) return { values: [], area: null, observedAt: null };
  try {
    const res = await fetch(
      `https://www.airnowapi.org/aq/observation/latLong/current/` +
        `?format=application/json&latitude=${lat}&longitude=${lon}&distance=50&API_KEY=${key}`,
    );
    if (!res.ok) return { values: [], area: null, observedAt: null };
    const rows = (await res.json()).filter((r) => r.ParameterName === 'PM2.5' && r.AQI >= 0);
    return {
      values: rows.map((r) => aqiToUgm3(r.AQI)),
      area: rows[0]?.ReportingArea ?? null,
      observedAt: rows[0]
        ? `${rows[0].DateObserved?.trim()}T${String(rows[0].HourObserved).padStart(2, '0')}:00`
        : null,
    };
  } catch {
    return { values: [], area: null, observedAt: null };
  }
}

// EPA correction for PurpleAir (Barkjohn et al.): raw cf_1 readings run high,
// especially in humid air and heavy smoke.
function epaCorrect(paCf1, rh) {
  const h = Number.isFinite(rh) ? rh : 50;
  if (paCf1 < 343) return Math.max(0, 0.524 * paCf1 - 0.0862 * h + 5.75);
  return Math.max(0, 0.46 * paCf1 + 3.93e-4 * paCf1 * paCf1 + 2.97);
}

async function purpleairUgm3(lat, lon, key) {
  if (!key) return [];
  try {
    const url =
      `https://api.purpleair.com/v1/sensors` +
      `?fields=pm2.5_cf_1,humidity&location_type=0&max_age=3600` +
      `&nwlng=${lon - 0.5}&nwlat=${lat + 0.4}&selng=${lon + 0.5}&selat=${lat - 0.4}`;
    const res = await fetch(url, { headers: { 'X-API-Key': key } });
    if (!res.ok) return [];
    const data = await res.json();
    const iPm = data.fields.indexOf('pm2.5_cf_1');
    const iRh = data.fields.indexOf('humidity');
    return data.data
      .map((row) => ({ pm: row[iPm], rh: row[iRh] }))
      .filter((s) => Number.isFinite(s.pm))
      .slice(0, 200)
      .map((s) => epaCorrect(s.pm, s.rh));
  } catch {
    return [];
  }
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Two honest answers, kept separate: "official" is the government-monitor
// picture (what Apple/weather.com-family apps show — the nearest station
// can sit 40+ miles away), "local" is the median of EPA-corrected PurpleAir
// units within ~30 miles. During fast-moving smoke they legitimately
// disagree; blending them yields a number neither source said.
export async function measuredSources(lat, lon, { airnowKey, purpleairKey }) {
  const [airnow, purpleair] = await Promise.all([
    airnowUgm3(lat, lon, airnowKey),
    purpleairUgm3(lat, lon, purpleairKey),
  ]);

  const officialUg = median(airnow.values);
  const localUg = median(purpleair);
  const round = (v) => Math.round(v * 10) / 10;

  return {
    official:
      officialUg != null
        ? {
            ug: round(officialUg),
            aqi: ugm3ToAqi(officialUg),
            count: airnow.values.length,
            area: airnow.area,
            observedAt: airnow.observedAt,
          }
        : null,
    local:
      localUg != null
        ? { ug: round(localUg), aqi: ugm3ToAqi(localUg), count: purpleair.length }
        : null,
  };
}
