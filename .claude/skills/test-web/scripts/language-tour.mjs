// Switches the app through every language in Settings → Language and screenshots the main screens.
// usage: node language-tour.mjs URL OUTDIR   — copy next to a node_modules that has playwright.
import { chromium, devices } from 'playwright';

const [url, out = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'vi-VN' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const LANGUAGES = [
  ['en', 'English', 'Overview'],
  ['ko', '한국어', '개요'],
  ['zh', '中文（简体）', '概览'],
  ['ja', '日本語', '概要'],
  ['vi', 'Tiếng Việt', 'Tổng quan'],
];

await page.goto(new URL('/language', url).href);
await page.getByText('Tiếng Việt').first().waitFor({ timeout: 30000 });
for (const [code, name, overview] of LANGUAGES) {
  await page.goto(new URL('/language', url).href);
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/lang-${code}-picker.png` });
  for (const [path, shot] of [['/', 'home'], ['/transactions', 'transactions'], ['/budgets', 'budgets'], ['/settings', 'settings'], ['/transaction/new', 'form']]) {
    await page.goto(new URL(path, url).href);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/lang-${code}-${shot}.png` });
  }
  await page.goto(url);
  const ok = await page.getByText(overview).first().isVisible({ timeout: 10000 }).catch(() => false);
  console.log(code, ok ? 'ok' : 'MISSING ' + overview);
}
console.log('errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
await browser.close();
