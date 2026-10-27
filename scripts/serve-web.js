#!/usr/bin/env node
/**
 * Serves the static web export (`npx expo export -p web` -> dist/) on localhost.
 *
 * expo-sqlite on web needs SharedArrayBuffer, which browsers only enable when
 * the page itself is sent with COOP/COEP headers. `expo start --web` does not
 * add them to the HTML page, so the web preview goes through this server.
 *
 * Usage: node scripts/serve-web.js [port]
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('dist/index.html not found. Run `npx expo export -p web` first.');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    // Client-side routes (e.g. /transactions) fall back to the single-page app shell.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`Web preview: http://localhost:${PORT}`));
