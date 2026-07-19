import { levelForPM25 } from './rating.js';

// Collapses the hourly series into per-day worst levels — the "clears
// Thursday at a glance" data. Shared by the 5-day strip, the share card,
// and the OG image so all three always tell the same story.
export function buildDaySummaries({ timesUTC, pm25, nowIndex, timezone }) {
  const dayMax = new Map();
  const dayLabel = new Map();
  const order = [];
  for (let i = nowIndex; i < timesUTC.length; i++) {
    const d = new Date(timesUTC[i] + 'Z');
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d);
    if (!dayMax.has(key)) {
      order.push(key);
      dayLabel.set(
        key,
        new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(d),
      );
    }
    dayMax.set(key, Math.max(dayMax.get(key) ?? -Infinity, pm25[i] ?? -Infinity));
  }
  return order.slice(0, 5).map((key) => ({
    key,
    weekday: dayLabel.get(key),
    level: levelForPM25(dayMax.get(key)),
  }));
}
