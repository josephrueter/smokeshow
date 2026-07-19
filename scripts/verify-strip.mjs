import puppeteer from 'puppeteer-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1100 });
await page.goto('http://localhost:5173/?lat=41.878&lon=-87.630&name=Chicago%2C%20IL', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForSelector('.five-day-strip__toggle', { timeout: 30000 });

const collapsed = await page.evaluate(() => ({
  pastVisibleWidth: document.querySelector('.five-day-strip__past').getBoundingClientRect().width,
  futureBoxes: document.querySelectorAll('.five-day-strip__days .five-day-strip__day').length,
  firstFutureRange: document.querySelector('.five-day-strip__days .five-day-strip__range')?.textContent,
}));

await page.click('.five-day-strip__toggle');
await new Promise((r) => setTimeout(r, 600)); // slide transition

const expanded = await page.evaluate(() => ({
  pastVisibleWidth: Math.round(document.querySelector('.five-day-strip__past').getBoundingClientRect().width),
  pastBoxes: [...document.querySelectorAll('.five-day-strip__past .five-day-strip__day')].map((b) => b.innerText.replace(/\n/g, ' | ')),
}));

await page.click('.five-day-strip__past .five-day-strip__day'); // tap first past day
await new Promise((r) => setTimeout(r, 300));
const detail = await page.evaluate(() => document.querySelector('.day-detail')?.innerText.slice(0, 500));

await page.evaluate(() => document.querySelector('.five-day-strip-wrap').scrollIntoView({ block: 'center' }));
await page.screenshot({ path: process.env.SCRATCH + '/strip-expanded.png' });
console.log(JSON.stringify({ collapsed, expanded, detail }, null, 2));
await browser.close();
