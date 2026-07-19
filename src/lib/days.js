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
  const dayMin = new Map();
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
    if (pm25[i] != null) dayMin.set(key, Math.min(dayMin.get(key) ?? Infinity, pm25[i]));
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
    min: dayMin.get(key) ?? null,
    max: dayMax.get(key) === -Infinity ? null : dayMax.get(key),
    dayParts: DAYPARTS.map((p, pi) => ({
      key: p.key,
      label: p.label,
      bucket: bucketForPM25(dayPartMax.get(key)[pi]),
    })),
  }));
}

// The three calendar days before today, from the reanalysis window
// (past_days=3 in the fetch). Past air is a model estimate, not monitor
// readings — the UI labels it that way.
export function buildPastDaySummaries({ timesUTC, pm25, nowIndex, timezone, count = 3 }) {
  const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const wdFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone });
  const todayKey = keyFmt.format(new Date(timesUTC[nowIndex] + 'Z'));
  const map = new Map();
  const order = [];
  for (let i = 0; i < nowIndex; i++) {
    const d = new Date(timesUTC[i] + 'Z');
    const key = keyFmt.format(d);
    if (key === todayKey) break;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, { key, weekday: wdFmt.format(d), min: Infinity, max: -Infinity });
    }
    const v = pm25[i];
    if (v == null) continue;
    const entry = map.get(key);
    entry.min = Math.min(entry.min, v);
    entry.max = Math.max(entry.max, v);
  }
  return order
    .slice(-count)
    .map((k) => map.get(k))
    .filter((e) => e.max !== -Infinity)
    .map((e) => ({ ...e, level: levelForPM25(e.max), isPast: true }));
}
