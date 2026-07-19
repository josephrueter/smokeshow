import { levelForPM25 } from '../lib/rating.js';

function buildDays({ timesUTC, pm25, nowIndex, timezone }) {
  const dayMax = new Map();
  const dayLabel = new Map();
  const order = [];
  for (let i = nowIndex; i < timesUTC.length; i++) {
    const d = new Date(timesUTC[i] + 'Z');
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d);
    if (!dayMax.has(key)) {
      order.push(key);
      dayLabel.set(key, new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(d));
    }
    dayMax.set(key, Math.max(dayMax.get(key) ?? -Infinity, pm25[i] ?? -Infinity));
  }
  return order.slice(0, 5).map((key) => ({
    key,
    weekday: dayLabel.get(key),
    level: levelForPM25(dayMax.get(key)),
  }));
}

export default function FiveDayStrip({ timesUTC, pm25, nowIndex, timezone }) {
  const days = buildDays({ timesUTC, pm25, nowIndex, timezone });
  return (
    <div className="five-day-strip">
      {days.map((day) => (
        <div key={day.key} className={`five-day-strip__day five-day-strip__day--${day.level?.key}`}>
          <div className="five-day-strip__weekday">{day.weekday}</div>
          <div className="five-day-strip__level">{day.level?.name}</div>
        </div>
      ))}
    </div>
  );
}
