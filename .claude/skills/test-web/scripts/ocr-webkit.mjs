// Runs Tesseract (as the web app does) in WebKit under the site's COOP/COEP headers.
// usage: node ocr-webkit.mjs ORIGIN IMAGE   — copy next to a node_modules that has playwright.
import { webkit, devices } from 'playwright';
import { readFileSync } from 'node:fs';
const [origin, image] = process.argv.slice(2);
const b = await webkit.launch();
const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(origin + '/manifest.json'); // any page of the site, so it runs with the site's COOP/COEP
const dataUrl = 'data:image/jpeg;base64,' + readFileSync(image).toString('base64');
const t0 = Date.now();
const result = await p.evaluate(async (dataUrl) => {
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('script load failed'));
    document.head.appendChild(s);
  });
  const worker = await Tesseract.createWorker(['vie', 'eng']);
  const { data } = await worker.recognize(dataUrl);
  return { isolated: crossOriginIsolated, lines: data.lines.map((l) => l.text.trim()) };
}, dataUrl);
console.log('isolated:', result.isolated, 'time:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(result.lines.filter((l) => /\d{2,}|NGUYEN|Chuyển|Le Van/i.test(l)).slice(0, 10).join('\n'));
await b.close();
