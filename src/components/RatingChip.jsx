import { OLFACTORY_FATIGUE_LEVEL_INDEX } from '../lib/rating.js';

export default function RatingChip({ level, pm25, isNow, timeLabel, headline, sensor }) {
  if (!level) return null;
  return (
    <div className={`rating-chip rating-chip--${level.key}`}>
      <div className="rating-chip__name">{level.name}</div>
      {headline && <div className="rating-chip__clear">{headline}</div>}
      <div className="rating-chip__notice">{level.notice}</div>
      <div className="rating-chip__meta">
        <span>
          {Math.round(pm25)} µg/m³ PM2.5
          {sensor ? ` · measured by ${sensor.count} sensor${sensor.count === 1 ? '' : 's'} nearby` : ''}
        </span>
        <span>{isNow ? 'Now' : timeLabel}</span>
      </div>
      {level.index >= OLFACTORY_FATIGUE_LEVEL_INDEX && (
        <div className="rating-chip__caveat">
          Your nose stops noticing smoke after a while. The smoke doesn't stop.
        </div>
      )}
    </div>
  );
}
