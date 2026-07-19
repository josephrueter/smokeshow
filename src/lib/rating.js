// Experience scale, thresholds in PM2.5 µg/m³ (EPA breakpoints), visibility
// anchors calibrated against the published "5-3-1" wildfire-smoke visibility
// index used by Oregon/Utah/Nevada health agencies.
export const LEVELS = [
  {
    index: 0,
    key: 'all-clear',
    name: 'All clear',
    max: 12,
    visibility: '10+ miles',
    notice: 'No smell. Sky looks normal. You can see 10+ miles.',
  },
  {
    index: 1,
    key: 'something',
    name: 'In the air',
    max: 35,
    visibility: '5–10 miles',
    notice:
      'Faint campfire smell outdoors. Distant treelines look soft. Roughly 5–10 miles of visibility.',
  },
  {
    index: 2,
    key: 'smells',
    name: 'Smells like fire',
    max: 55,
    visibility: '3–5 miles',
    notice:
      'You smell it the moment you step outside. Sun looks orange at the edges. Roughly 3–5 miles of visibility. Scratchy throat after a long stretch outdoors.',
  },
  {
    index: 3,
    key: 'tastes',
    name: 'Tastes like fire',
    max: 150,
    visibility: '1.5–3 miles',
    notice:
      'Smell reaches you indoors near windows. Eyes sting. Roughly 1.5–3 miles of visibility. A full day breathing this is on the order of smoking a few cigarettes.',
  },
  {
    index: 4,
    key: 'smokeshow',
    name: 'Smokeshow',
    max: Infinity,
    visibility: 'under 1.5 miles',
    notice:
      'Visibility under ~1.5 miles. Everything smells like a doused campfire. Fine ash possible. Everyone inside, windows closed, run filtration if you have it.',
  },
];

export const ARRIVAL_THRESHOLD = 35; // "Smells like fire" — the forecast-text anchor point
export const OLFACTORY_FATIGUE_LEVEL_INDEX = 3; // show the nose-fatigue caveat at "Tastes like fire" and above

export function levelForPM25(pm25) {
  if (pm25 == null || Number.isNaN(pm25)) return null;
  return LEVELS.find((l) => pm25 < l.max) ?? LEVELS[LEVELS.length - 1];
}

// Berkeley Earth rule of thumb: ~22 µg/m³ sustained over 24h ≈ one cigarette.
// Only meaningful — and only surfaced in the UI — at "Tastes like fire" and above.
export function cigaretteEquivalent(pm25Over24h) {
  return pm25Over24h / 22;
}

export function smokeColorForPM25(pm25) {
  // Translucent gray -> brown -> near-black ramp, opacity rising with concentration.
  // Not an AQI rainbow: this is meant to look like smoke, not a legend.
  const stops = [
    { pm25: 0, rgb: [235, 235, 232], alpha: 0 },
    { pm25: 12, rgb: [210, 208, 200], alpha: 0.12 },
    { pm25: 35, rgb: [176, 160, 140], alpha: 0.28 },
    { pm25: 55, rgb: [120, 96, 76], alpha: 0.45 },
    { pm25: 150, rgb: [60, 46, 40], alpha: 0.65 },
    { pm25: 300, rgb: [18, 15, 14], alpha: 0.85 },
  ];
  const v = Math.max(0, pm25 ?? 0);
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].pm25 && v <= stops[i + 1].pm25) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  if (v >= stops[stops.length - 1].pm25) {
    lo = stops[stops.length - 2];
    hi = stops[stops.length - 1];
  }
  const span = hi.pm25 - lo.pm25 || 1;
  const t = Math.min(1, Math.max(0, (v - lo.pm25) / span));
  const rgb = lo.rgb.map((c, i) => Math.round(c + (hi.rgb[i] - c) * t));
  const alpha = lo.alpha + (hi.alpha - lo.alpha) * t;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}
