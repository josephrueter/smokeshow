import { OLFACTORY_FATIGUE_LEVEL_INDEX, NOSE_CAVEAT } from '../lib/rating.js';
import { ugm3ToAqi, aqiCategory } from '../lib/aqi.js';

export default function RatingChip({ level, pm25, isNow, timeLabel, headline, sensor }) {
  if (!level) return null;
  const aqi = ugm3ToAqi(pm25);
  const category = aqiCategory(aqi);
  return (
    <div className={`rating-chip rating-chip--${level.key}`}>
      <div className="rating-chip__aqi-row">
        <span className="rating-chip__aqi">{aqi}</span>
        <span className="rating-chip__aqi-meta">
          <span className="rating-chip__aqi-label">
            <span className="rating-chip__aqi-dot" style={{ background: category?.color }} />
            AQI · {category?.name}
          </span>
          <span className="rating-chip__aqi-sub">
            {Math.round(pm25)} µg/m³ PM2.5
            {sensor ? ` · measured by ${sensor.count} sensor${sensor.count === 1 ? '' : 's'} nearby` : ''}
          </span>
        </span>
        <span className="rating-chip__time">{isNow ? 'Now' : timeLabel}</span>
      </div>
      <div className="rating-chip__name">{level.name}</div>
      {headline && <div className="rating-chip__clear">{headline}</div>}
      <div className="rating-chip__notice">{level.notice}</div>
      {level.index >= OLFACTORY_FATIGUE_LEVEL_INDEX ? (
        <div className="rating-chip__caveat">
          Your nose stops noticing smoke after a while. The smoke doesn't stop.
        </div>
      ) : (
        level.index >= 1 && <div className="rating-chip__caveat">{NOSE_CAVEAT}</div>
      )}
    </div>
  );
}
