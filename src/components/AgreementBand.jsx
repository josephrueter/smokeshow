import { useState } from 'react';
import { summarizeAgreement } from '../lib/agreement.js';

function AgreementCurves({ timesUTC, windowStart, windowEnd, currentPM25, previousRun }) {
  const width = 320;
  const height = 80;
  const idxs = [];
  for (let i = windowStart; i <= windowEnd; i++) idxs.push(i);

  function prevValueFor(i) {
    const t = timesUTC[i];
    const prevIdx = previousRun.timesUTC.indexOf(t);
    return prevIdx !== -1 ? previousRun.pm25[prevIdx] : null;
  }

  const allValues = [
    ...idxs.map((i) => currentPM25[i] ?? 0),
    ...idxs.map((i) => prevValueFor(i) ?? 0),
    50,
  ];
  const maxVal = Math.max(...allValues);

  function toPoints(getVal) {
    return idxs
      .map((i, k) => {
        const x = (k / Math.max(1, idxs.length - 1)) * width;
        const v = getVal(i);
        const y = v == null ? null : height - (Math.min(v, maxVal) / maxVal) * height;
        return y == null ? null : `${x},${y}`;
      })
      .filter(Boolean)
      .join(' ');
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="agreement-band__chart"
      preserveAspectRatio="none"
      role="img"
      aria-label="Current forecast run compared to the previous run"
    >
      <polyline
        points={toPoints(prevValueFor)}
        className="agreement-band__line agreement-band__line--previous"
        fill="none"
      />
      <polyline
        points={toPoints((i) => currentPM25[i])}
        className="agreement-band__line agreement-band__line--current"
        fill="none"
      />
    </svg>
  );
}

export default function AgreementBand({
  agreement,
  windowStart,
  windowEnd,
  timesUTC,
  currentPM25,
  previousRun,
}) {
  const [expanded, setExpanded] = useState(false);
  const windowAgreement = agreement.slice(windowStart, windowEnd + 1);
  const { label, diverged } = summarizeAgreement(windowAgreement);
  const segWidth = 100 / Math.max(1, windowAgreement.length);

  return (
    <div className="agreement-band">
      <div className="agreement-band__track">
        {windowAgreement.map((a, k) => (
          <div
            key={k}
            className={`agreement-band__seg agreement-band__seg--${a.status}`}
            style={{ width: `${segWidth}%` }}
          />
        ))}
      </div>
      <button type="button" className="agreement-band__summary" onClick={() => setExpanded((v) => !v)}>
        {label}
      </button>
      {expanded && (
        <div className="agreement-band__detail">
          {previousRun ? (
            <AgreementCurves
              timesUTC={timesUTC}
              windowStart={windowStart}
              windowEnd={windowEnd}
              currentPM25={currentPM25}
              previousRun={previousRun}
            />
          ) : (
            <p>Need a second forecast run to compare — check back in a few hours.</p>
          )}
          <p className="agreement-band__caveat">
            When these lines separate, treat timing as uncertain by ±6–12 hours.
          </p>
        </div>
      )}
      <p className="agreement-band__standing-caveat">
        All smoke models depend on satellites seeing the fires. Clouds or thick smoke can hide
        fires, and hidden fires aren't in any forecast.
      </p>
    </div>
  );
}
