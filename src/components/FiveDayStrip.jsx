import { useState } from 'react';
import { buildDaySummaries, buildPastDaySummaries, bucketForPM25 } from '../lib/days.js';
import { levelForPM25 } from '../lib/rating.js';
import { ugm3ToAqi } from '../lib/aqi.js';

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
          {(() => {
            const lo = ugm3ToAqi(day.min ?? day.max);
            const hi = ugm3ToAqi(day.max);
            return lo === hi ? `AQI ${hi}` : `AQI ${lo}–${hi}`;
          })()}
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

function DayHours({ hours }) {
  const [pickedIdx, setPickedIdx] = useState(null);
  const scaleMax = Math.max(35, ...hours.map((h) => h.v ?? 0));
  const picked = pickedIdx != null ? hours.find((h) => h.i === pickedIdx) : null;
  return (
    <div className="day-detail__chart">
      <div className="day-detail__readout">
        {picked
          ? `${picked.label}: AQI ${ugm3ToAqi(picked.v) ?? '—'}${picked.v == null ? '' : ` (${Math.round(picked.v)} µg/m³)`}`
          : 'Tap a bar for the hour’s number'}
      </div>
      <div className="day-detail__bars">
        {hours.map((h) => (
          <button
            type="button"
            key={h.i}
            className={
              'day-detail__bar-slot' +
              (pickedIdx === h.i ? ' day-detail__bar-slot--picked' : '')
            }
            onClick={() => setPickedIdx((cur) => (cur === h.i ? null : h.i))}
            aria-label={`${h.label}: ${h.v == null ? 'no data' : Math.round(h.v) + ' µg/m³'}`}
          >
            <div
              className="day-detail__bar"
              style={{
                height: `${Math.max(3, ((h.v ?? 0) / scaleMax) * 48)}px`,
                background: bucketForPM25(h.v)?.color ?? 'transparent',
              }}
            />
          </button>
        ))}
      </div>
      <div className="day-detail__hour-labels">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
}

function DayDetail({ day, hours }) {
  const peakLevel = levelForPM25(day.max);
  if (!peakLevel) return null;
  const peakHour = hours.reduce(
    (best, h) => (h.v != null && (best == null || h.v > best.v) ? h : best),
    null,
  );
  return (
    <div className="day-detail">
      <p className="day-detail__headline">
        {day.weekday}
        {day.isPast ? ' (past, model estimate)' : ''}: AQI {ugm3ToAqi(day.min ?? day.max)}–
        {ugm3ToAqi(day.max)}, that's {Math.round(day.min ?? day.max)}–{Math.round(day.max)} µg/m³
        of fine particles, peak{day.isPast ? 'ed' : 'ing'} at <strong>{peakLevel.name}</strong>
        {peakHour ? ` around ${peakHour.label}` : ''}.
      </p>
      <DayHours hours={hours} />
      <p className="day-detail__notice">{peakLevel.notice}</p>
      {day.max >= CIG_THRESHOLD && peakLevel.key === 'smokeshow' && (
        <p className="day-detail__notice">
          A full day breathing the peak level is on the order of smoking a few cigarettes.
        </p>
      )}
      <p className="day-detail__what">
        <strong>What these numbers mean:</strong> AQI is the 0 to 500 scale most weather apps
        lead with. It's a translation, not a measurement. The measurement is µg/m³: micrograms of
        fine particles (PM2.5) in each cubic meter of air, dust so small it slips past your nose
        and settles deep in your lungs. The two map to each other: AQI 50 is 9 µg/m³, AQI 100 is
        35 (about where most noses start noticing smoke), AQI 150 is 55, and past AQI 200
        everyone belongs indoors. Two apps can show different numbers for the same air because
        they average different hours and blend different sensors. The air didn't change. The math
        did.
      </p>
    </div>
  );
}

export default function FiveDayStrip({ timesUTC, pm25, nowIndex, timezone }) {
  const [showPast, setShowPast] = useState(false);
  // undefined = untouched (default to today's panel open); null = user closed it
  const [selectedKey, setSelectedKey] = useState(undefined);

  const days = buildDaySummaries({ timesUTC, pm25, nowIndex, timezone });
  const pastDays = buildPastDaySummaries({ timesUTC, pm25, nowIndex, timezone });
  const effectiveKey = selectedKey === undefined ? days[0]?.key : selectedKey;
  const selectedDay =
    [...pastDays, ...days].find((d) => d.key === effectiveKey) ?? null;

  // Hourly series for the selected local day — feeds the bar chart.
  let selectedHours = [];
  if (selectedDay) {
    const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    const labelFmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: true,
      timeZone: timezone,
    });
    for (let i = 0; i < timesUTC.length; i++) {
      const d = new Date(timesUTC[i] + 'Z');
      if (keyFmt.format(d) === selectedDay.key) {
        selectedHours.push({ i, label: labelFmt.format(d), v: pm25[i] });
      }
    }
  }

  function toggleSelect(key) {
    setSelectedKey(effectiveKey === key ? null : key);
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
              selected={effectiveKey === day.key}
              onSelect={() => toggleSelect(day.key)}
            />
          ))}
        </div>
        <div className="five-day-strip__days">
          {days.map((day) => (
            <DayBox
              key={day.key}
              day={day}
              selected={effectiveKey === day.key}
              onSelect={() => toggleSelect(day.key)}
            />
          ))}
        </div>
      </div>
      {selectedDay && <DayDetail key={selectedDay.key} day={selectedDay} hours={selectedHours} />}
    </div>
  );
}
