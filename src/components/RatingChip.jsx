import { OLFACTORY_FATIGUE_LEVEL_INDEX, NOSE_CAVEAT } from '../lib/rating.js';
import { ugm3ToAqi, aqiCategory } from '../lib/aqi.js';

const DISAGREE_AQI_GAP = 25;

export default function RatingChip({
  level,
  pm25,
  isNow,
  timeLabel,
  headline,
  sensor,
  sources,
  aqiSource,
  onSourceChange,
}) {
  if (!level) return null;
  const aqi = ugm3ToAqi(pm25);
  const category = aqiCategory(aqi);
  const both = !!(sources?.official && sources?.local);
  const disagree = both && Math.abs(sources.official.aqi - sources.local.aqi) >= DISAGREE_AQI_GAP;

  return (
    <div className={`rating-chip rating-chip--${level.key}`}>
      {both && (
        <div className="rating-chip__sources" role="group" aria-label="Reading source">
          <button
            type="button"
            className={
              'rating-chip__source' + (aqiSource !== 'local' ? ' rating-chip__source--on' : '')
            }
            onClick={() => onSourceChange('official')}
          >
            Official · {sources.official.aqi}
          </button>
          <button
            type="button"
            className={
              'rating-chip__source' + (aqiSource === 'local' ? ' rating-chip__source--on' : '')
            }
            onClick={() => onSourceChange('local')}
          >
            Local · {sources.local.aqi}
          </button>
        </div>
      )}
      <div className="rating-chip__aqi-row">
        <span className="rating-chip__aqi">{aqi}</span>
        <span className="rating-chip__aqi-meta">
          <span className="rating-chip__aqi-label">
            <span className="rating-chip__aqi-dot" style={{ background: category?.color }} />
            AQI · {category?.name}
          </span>
          <span className="rating-chip__aqi-sub">
            {Math.round(pm25)} µg/m³ PM2.5
            {sensor
              ? aqiSource === 'local' && sources?.local
                ? ` · ${sensor.count} local sensor${sensor.count === 1 ? '' : 's'} nearby`
                : ` · official monitor reading`
              : ''}
          </span>
        </span>
        <span className="rating-chip__time">{isNow ? 'Now' : timeLabel}</span>
      </div>
      <div className="rating-chip__name">{level.name}</div>
      {headline && <div className="rating-chip__clear">{headline}</div>}
      <div className="rating-chip__notice">{level.notice}</div>
      {disagree && isNow && (
        <div className="rating-chip__why-two">
          Why two numbers? Official is the nearest government monitor, which can sit 40 or more
          miles away. Local is the median of {sources.local.count} PurpleAir sensor
          {sources.local.count === 1 ? '' : 's'} within about 30 miles. Fast-moving smoke makes
          them disagree, and the reading closer to you is usually the better bet.
        </div>
      )}
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
