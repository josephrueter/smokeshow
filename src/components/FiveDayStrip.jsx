import { buildDaySummaries } from '../lib/days.js';

export default function FiveDayStrip({ timesUTC, pm25, nowIndex, timezone }) {
  const days = buildDaySummaries({ timesUTC, pm25, nowIndex, timezone });
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
