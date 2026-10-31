#!/usr/bin/env node
/**
 * Run after `npx expo export -p web`: writes the build's file list and a
 * content hash into dist/sw.js, so the service worker caches the whole app
 * for offline use and replaces the cache whenever a new build is deployed.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, '..', 'dist');
const SKIP = new Set(['sw.js', '_headers', '_redirects', 'metadata.json', 'index.html']);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const files = listFiles(DIST)
  .map((file) => path.relative(DIST, file).split(path.sep).join('/'))
  .filter((file) => !SKIP.has(file))
  .sort();

const hash = crypto.createHash('sha256');
for (const file of [...files, 'index.html']) {
  hash.update(file).update(fs.readFileSync(path.join(DIST, file)));
}
const buildHash = hash.digest('hex').slice(0, 12);

const swPath = path.join(DIST, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
if (!sw.includes('__BUILD_HASH__') || !sw.includes('/* __PRECACHE__ */')) {
  throw new Error('dist/sw.js has no placeholders; was it already processed?');
}
// Paths as browsers request them: "[id]-abc.js" stays unencoded, or the cache lookup would miss.
const urls = files.map((file) => `, ${JSON.stringify('/' + file)}`).join('');
fs.writeFileSync(swPath, sw.replace('__BUILD_HASH__', buildHash).replace(' /* __PRECACHE__ */', urls));
console.log(`sw.js: build ${buildHash}, ${files.length + 1} files to precache`);
