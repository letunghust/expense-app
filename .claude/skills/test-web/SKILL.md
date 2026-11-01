---
name: test-web
description: Test and deploy the Chi Tiêu web/iPhone (PWA) version — build, end-to-end check in Chrome with an iPhone viewport (scan, save, offline), OCR check in WebKit, deploy to Cloudflare. Use before telling the user a web change is live, or when the web/iPhone app misbehaves.
---

# Test and deploy the web (iPhone) version

Live at https://chi-tieu.levantung-work.workers.dev — Cloudflare Workers Static Assets
(`wrangler.jsonc`, account levantung.work@gmail.com, wrangler already logged in on this machine).
Cloudflare now routes new *Pages* projects through Workers; `wrangler pages ...` fails, use `wrangler deploy`.

## Build and run locally

```bash
npx expo export -p web && node scripts/finish-web-export.js   # fills sw.js precache list + build hash
node scripts/serve-web.js 8080                                 # same COOP/COEP headers as production
```

## Test

Set up Playwright once per scratch dir (not a project dependency):
`npm init -y && npm i playwright@1.56.1 && npx playwright install webkit`, then copy `scripts/*.mjs` there.

1. **End to end (Chrome, iPhone 13 viewport)**:
   `node pwa-test.mjs URL chromium OUTDIR ~/Pictures/anh-chuyen-khoan/<image>.jpg`
   Must print crossOriginIsolated true, service worker in control, a filled scan
   (amount | date | note), `saved`, and every `offline ... ok` line. Screenshots go to OUTDIR.
2. **Safari engine**: `node ocr-webkit.mjs URL IMAGE` must print `isolated: true` and the receipt
   text. Playwright's Linux WebKit has **no `navigator.storage`**, so the full app can't run there:
   `pwa-test.mjs ... webkit` stops at the "Không mở được dữ liệu" screen. That is the test
   browser's limit, not a bug (real Safari has OPFS from iOS 17). The final check is the user
   opening the link on an iPhone.
3. **Languages**: `node language-tour.mjs URL OUTDIR` switches through every language in
   Settings → Language and screenshots home, transactions, budgets, settings and the add form
   (`lang-<code>-<screen>.png`). Look at them: no Vietnamese left in other languages, nothing cut off.
   `pwa-test.mjs` runs with an English browser on purpose: the app must still start in Vietnamese.
4. Tesseract warnings `Parameter not found: ...` in the logs are harmless.

5. **On-screen keyboard** (desktop Chrome has none): use Chrome inside the Android emulator
   (see the test-android skill). `adb reverse tcp:8080 tcp:8080` so `http://localhost:8080` is a
   secure context there, open it with
   `adb shell am start -a android.intent.action.VIEW -d http://localhost:8080/transaction/new com.android.chrome`,
   tap the note field near the bottom, screenshot. To inspect the page:
   `adb forward tcp:9222 localabstract:chrome_devtools_remote`, then `chromium.connectOverCDP('http://localhost:9222')`.
   Mobile Chrome, like iPhone Safari, shrinks only the visual viewport and pans it.

## Deploy

`scripts/deploy-web.sh` (export, precache list, `wrangler deploy`). Then run step 1 against the live URL.

## Things that broke before

- COEP must be `require-corp`: Safari doesn't support `credentialless`. Cross-origin files
  (Tesseract on cdn.jsdelivr.net) work because jsDelivr sends CORS and CORP headers.
- Screens load on demand (`asyncRoutes`), so the service worker precaches the whole build or
  unvisited screens fail offline. Precache URLs must stay unencoded (`[id]-….js`).
- Import icons as `@expo/vector-icons/Ionicons`, never `{ Ionicons } from '@expo/vector-icons'`:
  the barrel import adds 19 icon fonts (~4 MB) to the build.
- The keyboard: browsers pan the visual viewport to the focused field, which moved the app off
  screen. `#root` is `position: fixed` and follows `visualViewport` (script in public/index.html);
  `src/lib/keyboard.web.ts` then scrolls the field into view. Don't resize `html` instead: the
  visual viewport stays panned and the screen goes blank.
- On iPhone, data in a Safari tab and in the home-screen app are separate; users must use the
  home-screen icon.
