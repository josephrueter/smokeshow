import { snapCoord } from './grid.js';

// Measured "Now" from nearby AirNow sensors via /api/sensors (key lives in a
// Vercel env var — never on the client). Returns null whenever unavailable:
// no key yet, no sensors nearby, dev server, network trouble. Null means the
// app behaves exactly as model-only.
export async function fetchSensorsNear(lat, lon) {
  if (import.meta.env?.DEV) {
    // No edge functions under the Vite dev server. ?mockSensors=<µg/m³>
    // exercises the full anchor pipeline in dev/tests.
    const mock = new URLSearchParams(window.location.search).get('mockSensors');
    if (mock != null && Number.isFinite(Number(mock))) {
      return { measured: Number(mock), aqi: null, count: 3, area: 'Dev mock', observedAt: null };
    }
    return null;
  }
  try {
    // Snap to the same cache lattice as the forecast fetches.
    const res = await fetch(`/api/sensors?lat=${snapCoord(lat)}&lon=${snapCoord(lon)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.measured != null ? data : null;
  } catch {
    return null;
  }
}

const DECAY_HOURS = 12;

// Sensor-anchored series: shift the model by the measured-vs-model gap at
// "now", decaying the correction to zero over the next 12 hours. Past hours
// stay untouched (they're labeled "model estimate" and the map stays pure
// model too — a single-point offset doesn't generalize spatially).
export function applySensorAnchor(pm25, nowIndex, measured) {
  if (measured == null || pm25[nowIndex] == null) return pm25;
  const offset = measured - pm25[nowIndex];
  return pm25.map((v, i) => {
    if (v == null || i < nowIndex) return v;
    const age = i - nowIndex;
    if (age >= DECAY_HOURS) return v;
    const corrected = v + offset * (1 - age / DECAY_HOURS);
    return Math.max(0, Math.round(corrected * 10) / 10);
  });
}
