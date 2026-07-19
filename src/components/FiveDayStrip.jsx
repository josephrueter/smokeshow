import { useState } from 'react';
import { buildDaySummaries, buildPastDaySummaries } from '../lib/days.js';
import { levelForPM25 } from '../lib/rating.js';

// Cigarette equivalence only surfaces at "Tastes like fire" and above (brief rule).
const CIG_THRESHOLD = 55;

function DayBox({ day, selected, onSelect }) {
  return (
    <button
      type="button"
      className={
        `five-day-strip__day five-day-strip__day--${day.level?.key}` +
        (day.isPast ? ' five-day-strip__day--past' : '') +
        (selected ? ' five-day-strip__day--selected' : '')
      }
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="five-day-strip__weekday">{day.weekday}</div>
      <div className="five-day-strip__level">{day.level?.name}</div>
      {day.max != null && (
        <div className="five-day-strip__range">
          {Math.round(day.min ?? day.max)}–{Math.round(day.max)} µg/m³
        </div>
      )}
      {day.isPast ? (
        <div className="five-day-strip__tag">model estimate</div>
      ) : (
        day.dayParts && (
          <div
            className="five-day-strip__parts"
            title={day.dayParts
              .filter((p) => p.bucket)
              .map((p) => `${p.label}: ${p.bucket.name}`)
              .join(' · ')}
          >
            {day.dayParts.map((p) => (
              <span
                key={p.key}
                className="five-day-strip__part"
                style={{ background: p.bucket ? p.bucket.color : 'transparent' }}
              />
            ))}
          </div>
        )
      )}
    </button>
  );
}

function DayDetail({ day }) {
  const peakLevel = levelForPM25(day.max);
  if (!peakLevel) return null;
  return (
    <div className="day-detail">
      <p className="day-detail__headline">
        {day.weekday}
        {day.isPast ? ' (past, model estimate)' : ''}: {Math.round(day.min ?? day.max)}–
        {Math.round(day.max)} µg/m³ PM2.5 — peak{day.isPast ? 'ed' : 's'} at{' '}
        <strong>{peakLevel.name}</strong>.
      </p>
      <p className="day-detail__notice">{peakLevel.notice}</p>
      {day.max >= CIG_THRESHOLD && peakLevel.key === 'smokeshow' && (
        <p className="day-detail__notice">
          A full day breathing the peak level is on the order of smoking a few cigarettes.
        </p>
      )}
      <p className="day-detail__what">
        Why these numbers matter: PM2.5 is smoke and soot smaller than 2.5 microns — small enough
        to slip past your nose and throat and settle deep in your lungs. The number is micrograms
        of it per cubic meter of air. Under 12 is clean air. Around 35, most people start to smell
        smoke. Above 150, everyone belongs inside.
      </p>
    </div>
  );
}

export default function FiveDayStrip({ timesUTC, pm25, nowIndex, timezone }) {
  const [showPast, setShowPast] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);

  const days = buildDaySummaries({ timesUTC, pm25, nowIndex, timezone });
  const pastDays = buildPastDaySummaries({ timesUTC, pm25, nowIndex, timezone });
  const selectedDay =
    [...pastDays, ...days].find((d) => d.key === selectedKey) ?? null;

  function toggleSelect(key) {
    setSelectedKey((cur) => (cur === key ? null : key));
  }

  return (
    <div className="five-day-strip-wrap">
      <div className="five-day-strip">
        {pastDays.length > 0 && (
          <button
            type="button"
            className="five-day-strip__toggle"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            aria-label={showPast ? 'Hide the last three days' : 'Show the last three days'}
          >
            <span className="five-day-strip__toggle-arrow">{showPast ? '›' : '‹'}</span>
            <span className="five-day-strip__toggle-label">past</span>
          </button>
        )}
        <div className={'five-day-strip__past' + (showPast ? ' five-day-strip__past--open' : '')}>
          {pastDays.map((day) => (
            <DayBox
              key={day.key}
              day={day}
              selected={selectedKey === day.key}
              onSelect={() => toggleSelect(day.key)}
            />
          ))}
        </div>
        <div className="five-day-strip__days">
          {days.map((day) => (
            <DayBox
              key={day.key}
              day={day}
              selected={selectedKey === day.key}
              onSelect={() => toggleSelect(day.key)}
            />
          ))}
        </div>
      </div>
      {selectedDay && <DayDetail day={selectedDay} />}
    </div>
  );
}
