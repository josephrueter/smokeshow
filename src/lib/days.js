import { levelForPM25 } from './rating.js';

// Coarser 4-bucket scale for the tiny day-part segments: Clear / Middle /
// Elevated / Smokeshow, colored white -> the accent orange.
export const DAYPART_BUCKETS = [
  { name: 'Clear', max: 12, color: '#f1ece3' },
  { name: 'Middle', max: 35, color: '#f0c98c' },
  { name: 'Elevated', max: 150, color: '#ec9f5e' },
  { name: 'Smokeshow', max: Infinity, color: '#e8823a' },
];

const DAYPARTS = [
  { key: 'morning', label: 'Morning', from: 6, to: 12 },
  { key: 'afternoon', label: 'Afternoon', from: 12, to: 18 },
  { key: 'evening', label: 'Evening', from: 18, to: 24 },
];

export function bucketForPM25(pm25) {
  if (pm25 == null || pm25 === -Infinity) return null;
  return DAYPART_BUCKETS.find((b) => pm25 < b.max) ?? DAYPART_BUCKETS[DAYPART_BUCKETS.length - 1];
}

// Collapses the hourly series into per-day worst levels — the "clears
// Thursday at a glance" data. Shared by the 5-day strip, the share card,
// and the OG image so all three always tell the same story.
export function buildDaySummaries({ timesUTC, pm25, nowIndex, timezone }) {
  const dayMax = new Map();
  const dayLabel = new Map();
  const dayPartMax = new Map(); // key -> [morningMax, afternoonMax, eveningMax]
  const order = [];
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  });
  for (let i = nowIndex; i < timesUTC.length; i++) {
    const d = new Date(timesUTC[i] + 'Z');
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d);
    if (!dayMax.has(key)) {
      order.push(key);
      dayLabel.set(
        key,
        new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(d),
      );
      dayPartMax.set(key, [-Infinity, -Infinity, -Infinity]);
    }
    const val = pm25[i] ?? -Infinity;
    dayMax.set(key, Math.max(dayMax.get(key) ?? -Infinity, val));
    const hour = Number(hourFmt.format(d)) % 24;
    const parts = dayPartMax.get(key);
    DAYPARTS.forEach((p, pi) => {
      if (hour >= p.from && hour < p.to) parts[pi] = Math.max(parts[pi], val);
    });
  }
  return order.slice(0, 5).map((key) => ({
    key,
    weekday: dayLabel.get(key),
    level: levelForPM25(dayMax.get(key)),
    dayParts: DAYPARTS.map((p, pi) => ({
      key: p.key,
      label: p.label,
      bucket: bucketForPM25(dayPartMax.get(key)[pi]),
    })),
  }));
}
