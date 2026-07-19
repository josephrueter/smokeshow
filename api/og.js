import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const LEVEL_ACCENTS = {
  'all-clear': '#7fae8a',
  something: '#c9b46a',
  smells: '#d68a4a',
  tastes: '#b85c3a',
  smokeshow: '#a04a34',
};

const LEVEL_NAMES = [
  'All clear',
  'In the air',
  'Smells like fire',
  'Tastes like fire',
  'Smokeshow',
];

// Plain element objects instead of JSX — satori accepts {type, props} trees,
// and a .js file keeps Vercel's zero-config function detection happy.
function h(type, style, ...children) {
  return { type, props: { style, children: children.length === 1 ? children[0] : children } };
}

// Pure presentation: every string arrives via query params from /s, so this
// function does no data fetching and caches hard.
export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const rating = searchParams.get('rating') || 'SMOKESHOW';
  const key = searchParams.get('key') || 'smells';
  const place = searchParams.get('place') || '';
  const line = searchParams.get('line') || '';
  const strip = (searchParams.get('strip') || '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [day, idx] = entry.split(':');
      return { day, name: LEVEL_NAMES[Number(idx)] || '' };
    });

  const accent = LEVEL_ACCENTS[key] || '#e8823a';

  const root = h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#16130f',
      color: '#f1ece3',
      padding: '48px 60px',
      borderLeft: `14px solid ${accent}`,
      fontFamily: 'sans-serif',
    },
    place ? h('div', { fontSize: 30, color: '#b8ada0' }, place) : null,
    h(
      'div',
      { fontSize: rating.length > 14 ? 88 : 120, fontWeight: 800, lineHeight: 1.05 },
      rating,
    ),
    line ? h('div', { fontSize: 46, fontWeight: 700, color: accent, marginTop: 18 }, line) : null,
    h(
      'div',
      { display: 'flex', gap: 14, marginTop: 'auto', marginBottom: 26 },
      ...strip.map((d) =>
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            background: '#201b16',
            border: '2px solid #3a322a',
            borderRadius: 12,
            padding: '14px 18px',
            width: 200,
          },
          h('div', { fontSize: 24, color: '#b8ada0' }, d.day),
          h('div', { fontSize: 22, fontWeight: 700 }, d.name),
        ),
      ),
    ),
    h(
      'div',
      { display: 'flex', alignItems: 'baseline', gap: 20 },
      h('div', { fontSize: 34, fontWeight: 800, letterSpacing: 2 }, 'SMOKESHOW'),
      h('div', { fontSize: 24, color: '#b8ada0' }, 'smokeshow-beta.vercel.app'),
    ),
  );

  return new ImageResponse(root, {
    width: 1200,
    height: 630,
    headers: {
      'cache-control': 'public, s-maxage=600, stale-while-revalidate=1800',
    },
  });
}
