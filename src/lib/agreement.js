import { levelForPM25 } from './rating.js';

const LEAD_TIME_FADE_HOURS = 36; // beyond this, uncertainty is structural regardless of run comparison
const DIVERGE_ABS_DIFF = 15; // µg/m³

// v1 "model agreement": no second model yet (HRRR/BlueSky are the v2 upgrade),
// so confidence here comes from two honest, cheap signals —
//   1. lead-time fade: forecasts further out are just less certain
//   2. run-to-run drift: did this run's prediction for a given valid hour move
//      a lot from what the previous run predicted for that same hour?
export function computeAgreement({ timesUTC, pm25, fetchedAtMs, previousRun }) {
  return timesUTC.map((t, idx) => {
    const validMs = new Date(t + 'Z').getTime();
    const leadHours = (validMs - fetchedAtMs) / 3_600_000;
    let status = 'agree';

    if (leadHours > LEAD_TIME_FADE_HOURS) status = 'fade';

    if (previousRun) {
      const prevIdx = previousRun.timesUTC.indexOf(t);
      if (prevIdx !== -1) {
        const prevVal = previousRun.pm25[prevIdx];
        const newVal = pm25[idx];
        if (prevVal != null && newVal != null) {
          const diff = Math.abs(prevVal - newVal);
          const prevLevel = levelForPM25(prevVal)?.index;
          const newLevel = levelForPM25(newVal)?.index;
          if (diff > DIVERGE_ABS_DIFF || prevLevel !== newLevel) status = 'diverge';
        }
      }
    }

    return { timeUTC: t, status };
  });
}

export function summarizeAgreement(agreement) {
  const hasDiverge = agreement.some((a) => a.status === 'diverge');
  return hasDiverge
    ? { label: 'Models split — tap for detail', diverged: true }
    : { label: 'Models agree', diverged: false };
}
