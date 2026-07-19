import { levelForPM25 } from './rating.js';

const LEAD_TIME_FADE_HOURS = 36; // beyond this, uncertainty is structural regardless of run comparison
const DIVERGE_ABS_DIFF = 15; // µg/m³

// Agreement inputs, in order of strength:
//   1. multi-model: CAMS vs HRRR at the same valid hour (real "models split")
//   2. run-to-run: did this CAMS run move vs. the previous run's same hours
//   3. lead-time fade: forecasts past +36h are structurally less certain
// hrrrSeries is a Map(timeUTC -> µg/m³) from lib/hrrr.js, or null when the
// HRRR feed is unavailable / the location is outside CONUS.
export function computeAgreement({ timesUTC, pm25, fetchedAtMs, previousRun, hrrrSeries }) {
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

    if (hrrrSeries) {
      const hrrrVal = hrrrSeries.get(t);
      const camsVal = pm25[idx];
      if (hrrrVal != null && camsVal != null) {
        const diff = Math.abs(hrrrVal - camsVal);
        const hrrrLevel = levelForPM25(hrrrVal)?.index;
        const camsLevel = levelForPM25(camsVal)?.index;
        if (diff > DIVERGE_ABS_DIFF || hrrrLevel !== camsLevel) status = 'diverge';
      }
    }

    return { timeUTC: t, status };
  });
}

// With a second model in play the multi-model labels are earned; without one
// (v1 behavior) the honest run-to-run labels stay.
export function summarizeAgreement(agreement, { multiModel = false } = {}) {
  const hasDiverge = agreement.some((a) => a.status === 'diverge');
  if (multiModel) {
    return hasDiverge
      ? { label: 'Models split — tap for detail', diverged: true }
      : { label: 'Models agree', diverged: false };
  }
  return hasDiverge
    ? { label: 'Forecast shifting between runs — tap for detail', diverged: true }
    : { label: 'Forecast holding steady', diverged: false };
}
