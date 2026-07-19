import { levelForPM25, ARRIVAL_THRESHOLD } from './rating.js';

function localParts(timeUTCStr, tz) {
  const d = new Date(timeUTCStr + 'Z');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(d);
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(d),
  );
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  return { weekday, hour, dateKey };
}

function dayPart(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function phrase(weekday, hour) {
  return `${weekday} ${dayPart(hour)}`;
}

// Rule-based only — no LLM. Honesty rule: trust timing/geography over exact
// numbers (models tend to underestimate surface PM2.5 in extreme events), so
// this only ever talks in rating-language and day-parts, never precise digits.
export function buildForecastText({ timesUTC, pm25, nowIndex, timezone }) {
  if (!timesUTC?.length) return '';
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const primaryEnd = Math.min(nowIndex + 48, timesUTC.length - 1);
  const currentPM25 = pm25[nowIndex];
  const sentences = [];

  const currentlyAbove = currentPM25 >= ARRIVAL_THRESHOLD;
  let crossIdx = -1;
  for (let i = nowIndex + 1; i <= primaryEnd; i++) {
    if ((pm25[i] >= ARRIVAL_THRESHOLD) !== currentlyAbove) {
      crossIdx = i;
      break;
    }
  }
  if (crossIdx !== -1) {
    const { weekday, hour } = localParts(timesUTC[crossIdx], tz);
    sentences.push(
      currentlyAbove
        ? `Back to Smells-like-fire by ${phrase(weekday, hour)}.`
        : `Arrives at Smells-like-fire around ${phrase(weekday, hour)}.`,
    );
  } else {
    sentences.push(
      currentlyAbove
        ? 'Stays at Smells-like-fire or worse through the two-day forecast.'
        : 'Stays below Smells-like-fire through the two-day forecast.',
    );
  }

  let peakIdx = nowIndex;
  for (let i = nowIndex; i <= primaryEnd; i++) {
    if ((pm25[i] ?? -Infinity) > (pm25[peakIdx] ?? -Infinity)) peakIdx = i;
  }
  const peakLevel = levelForPM25(pm25[peakIdx]);
  if (peakIdx !== nowIndex && peakLevel && peakLevel.index >= 1) {
    const { weekday, hour } = localParts(timesUTC[peakIdx], tz);
    sentences.push(`Peaks ${phrase(weekday, hour)} at ${peakLevel.name}.`);
  }

  const dayMax = new Map();
  const dayLabel = new Map();
  for (let i = nowIndex; i < timesUTC.length; i++) {
    const { dateKey, weekday } = localParts(timesUTC[i], tz);
    const val = pm25[i] ?? -Infinity;
    dayMax.set(dateKey, Math.max(dayMax.get(dateKey) ?? -Infinity, val));
    if (!dayLabel.has(dateKey)) dayLabel.set(dateKey, weekday);
  }
  let cleanestKey = null;
  for (const [key, max] of dayMax) {
    if (cleanestKey === null || max < dayMax.get(cleanestKey)) cleanestKey = key;
  }
  if (cleanestKey) sentences.push(`Cleanest stretch: ${dayLabel.get(cleanestKey)}.`);

  return sentences.join(' ');
}
