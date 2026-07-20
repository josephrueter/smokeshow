// Experience scale, thresholds in PM2.5 µg/m³ (EPA breakpoints), visibility
// anchors calibrated against the published "5-3-1" wildfire-smoke visibility
// index used by Oregon/Utah/Nevada health agencies.
// Experience language rules: describe what MOST people notice, never what the
// reader WILL feel. Noses vary wildly, and fine particles can irritate with
// no campfire smell at all (dust, exhaust, aged smoke). Visibility is the one
// objective anchor everyone can check, so each level leads them to the window.
export const LEVELS = [
  {
    index: 0,
    key: 'all-clear',
    name: 'All clear',
    max: 12,
    visibility: '10+ miles',
    notice: 'No smoke to notice. Sky looks normal. You can see 10+ miles.',
  },
  {
    index: 1,
    key: 'something',
    name: 'In the air',
    max: 35,
    visibility: '5–10 miles',
    notice:
      'A faint campfire whiff for sensitive noses. Most people just see distant treelines go soft, roughly 5 to 10 miles of visibility.',
  },
  {
    index: 2,
    key: 'smells',
    name: 'Smells like fire',
    max: 55,
    visibility: '3–5 miles',
    notice:
      'Most people smell smoke outdoors, though not everyone. The sun can look orange at the edges, and visibility drops to roughly 3 to 5 miles. Long stretches outside may leave a scratchy throat.',
  },
  {
    index: 3,
    key: 'tastes',
    name: 'Tastes like fire',
    max: 150,
    visibility: '1.5–3 miles',
    notice:
      'Smoke often reaches indoors near windows. Eyes can sting. Visibility runs roughly 1.5 to 3 miles. A full day breathing this is on the order of smoking a few cigarettes.',
  },
  {
    index: 4,
    key: 'smokeshow',
    name: 'Smokeshow',
    max: Infinity,
    visibility: 'under 1.5 miles',
    notice:
      'Visibility under about 1.5 miles. Everything smells like a doused campfire, and fine ash is possible. Everyone inside, windows closed, run filtration if you have it.',
  },
];

// Shown at the lower smoke levels, where a reader's nose is most likely to
// disagree with the number. Turns a potential mismatch into a check they can
// run themselves instead of an argument.
export const NOSE_CAVEAT =
  'Noses differ, and fine particles can irritate without any smell. The honest test is visibility: how far can you see?';

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

// Translucent gray -> brown -> near-black ramp, opacity rising with concentration.
// Not an AQI rainbow: this is meant to look like smoke, not a legend.
const SMOKE_STOPS = [
  { pm25: 0, rgb: [235, 235, 232], alpha: 0 },
  { pm25: 12, rgb: [210, 208, 200], alpha: 0.12 },
  { pm25: 35, rgb: [176, 160, 140], alpha: 0.28 },
  { pm25: 55, rgb: [120, 96, 76], alpha: 0.45 },
  { pm25: 150, rgb: [60, 46, 40], alpha: 0.65 },
  { pm25: 300, rgb: [18, 15, 14], alpha: 0.85 },
];

// Numeric variant for per-pixel field rendering: [r, g, b, alpha 0-255].
export function smokeRGBA(pm25) {
  const v = Math.max(0, pm25 ?? 0);
  let lo = SMOKE_STOPS[0];
  let hi = SMOKE_STOPS[SMOKE_STOPS.length - 1];
  for (let i = 0; i < SMOKE_STOPS.length - 1; i++) {
    if (v >= SMOKE_STOPS[i].pm25 && v <= SMOKE_STOPS[i + 1].pm25) {
      lo = SMOKE_STOPS[i];
      hi = SMOKE_STOPS[i + 1];
      break;
    }
  }
  if (v >= SMOKE_STOPS[SMOKE_STOPS.length - 1].pm25) {
    lo = SMOKE_STOPS[SMOKE_STOPS.length - 2];
    hi = SMOKE_STOPS[SMOKE_STOPS.length - 1];
  }
  const span = hi.pm25 - lo.pm25 || 1;
  const t = Math.min(1, Math.max(0, (v - lo.pm25) / span));
  return [
    Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t),
    Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t),
    Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t),
    Math.round((lo.alpha + (hi.alpha - lo.alpha) * t) * 255),
  ];
}

export function smokeColorForPM25(pm25) {
  const [r, g, b, a] = smokeRGBA(pm25);
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}
