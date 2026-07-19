// Drives the app in real headless Chrome (live rAF) to verify:
// 1. smoke canvas renders (non-zero size, non-zero alpha)
// 2. playback produces continuously changing frames (sub-hour blending)
// 3. zoom-out tiers fetch and render
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5173/?lat=41.878&lon=-87.630&name=Chicago%2C%20IL';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });

await page.waitForSelector('.smoke-canvas-layer', { timeout: 30000 });
await page.waitForSelector('.scrubber__play', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

const sampleCanvas = () =>
  page.evaluate(() => {
    const c = document.querySelector('.smoke-canvas-layer');
    if (!c || !c.width) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 3; i < d.length; i += 400) sum += d[i];
    return { size: `${c.width}x${c.height}`, alphaSum: sum };
  });

const paused = await sampleCanvas();

// rAF sanity in THIS browser
const rafCount = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let n = 0;
      const bump = () => {
        n++;
        if (n < 500) requestAnimationFrame(bump);
      };
      requestAnimationFrame(bump);
      setTimeout(() => resolve(n), 600);
    }),
);

// Play and sample rapidly — distinct values within single 600ms steps prove blending
await page.click('.scrubber__play');
const playSamples = [];
for (let k = 0; k < 14; k++) {
  playSamples.push((await sampleCanvas())?.alphaSum);
  await new Promise((r) => setTimeout(r, 150));
}
await page.click('.scrubber__play');
await page.screenshot({ path: (process.env.SCRATCH || "/tmp") + '/anim-frame.png' });

// Tier test: zoom out via Leaflet API (dev handle)
const tierResult = await page.evaluate(async () => {
  const calls = () =>
    performance.getEntriesByType('resource').filter((e) => e.name.includes('air-quality')).length;
  const before = calls();
  window.__smokeshowMap.setZoom(4, { animate: false });
  await new Promise((r) => setTimeout(r, 4000));
  return { callsBefore: before, callsAfter: calls(), zoom: window.__smokeshowMap.getZoom() };
});
await new Promise((r) => setTimeout(r, 1000));
const wideView = await sampleCanvas();
await page.screenshot({ path: (process.env.SCRATCH || "/tmp") + '/wide-view.png' });

console.log(
  JSON.stringify(
    {
      rafIn600ms: rafCount,
      paused,
      playSamples,
      distinctPlayValues: new Set(playSamples).size,
      tierResult,
      wideView,
    },
    null,
    2,
  ),
);
await browser.close();
