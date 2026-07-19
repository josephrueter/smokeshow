// Client-side share card: the designed version of the screenshot people would
// take anyway. 1200x630 (OG dimensions) so the same layout language matches
// the link previews.
const W = 1200;
const H = 630;

const LEVEL_ACCENTS = {
  'all-clear': '#7fae8a',
  something: '#c9b46a',
  smells: '#d68a4a',
  tastes: '#b85c3a',
  smokeshow: '#a04a34',
};

function fitText(ctx, text, maxWidth, startPx, family, weight = 700) {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 4;
  } while (px > 24);
  return px;
}

export function renderShareCard({ level, placeName, timeLabel, headline, days, diverged, url }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const family = "-apple-system, 'Segoe UI', Roboto, sans-serif";
  const accent = LEVEL_ACCENTS[level.key] || '#e8823a';

  ctx.fillStyle = '#16130f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, H);

  ctx.fillStyle = '#b8ada0';
  ctx.font = `600 30px ${family}`;
  ctx.fillText(`${placeName || 'Your air'} · ${timeLabel}`, 60, 78);

  ctx.fillStyle = '#f1ece3';
  const namePx = fitText(ctx, level.name, W - 120, 130, family, 800);
  ctx.font = `800 ${namePx}px ${family}`;
  ctx.fillText(level.name, 60, 105 + namePx);

  ctx.fillStyle = accent;
  const headPx = fitText(ctx, headline, W - 120, 54, family, 700);
  ctx.font = `700 ${headPx}px ${family}`;
  ctx.fillText(headline, 60, 330);

  const stripY = 390;
  const boxW = (W - 120 - 4 * 16) / 5;
  days.slice(0, 5).forEach((day, i) => {
    const x = 60 + i * (boxW + 16);
    ctx.fillStyle = '#201b16';
    ctx.strokeStyle = '#3a322a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, stripY, boxW, 130, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#b8ada0';
    ctx.font = `600 26px ${family}`;
    ctx.fillText(day.weekday, x + 18, stripY + 40);

    ctx.fillStyle = LEVEL_ACCENTS[day.level.key] || '#f1ece3';
    const words = day.level.name.split(' ');
    let line = '';
    let lineY = stripY + 78;
    ctx.font = `700 24px ${family}`;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > boxW - 36 && line) {
        ctx.fillText(line, x + 18, lineY);
        line = word;
        lineY += 30;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x + 18, lineY);
  });

  ctx.fillStyle = '#b8ada0';
  ctx.font = `600 26px ${family}`;
  if (diverged) ctx.fillText('models split on timing', 60, 570);

  ctx.fillStyle = '#f1ece3';
  ctx.font = `800 34px ${family}`;
  ctx.fillText('SMOKESHOW', 60, H - 24);
  ctx.fillStyle = '#b8ada0';
  ctx.font = `500 26px ${family}`;
  ctx.fillText(url.replace(/^https?:\/\//, ''), 280, H - 26);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
