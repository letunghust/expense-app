#!/usr/bin/env node
/**
 * Renders the app icon (logo concept A: wallet + đồng coin) into every PNG the
 * app config needs, using headless Chrome as the SVG rasteriser.
 *
 * Usage: node assets/logo/render.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const images = path.resolve(here, '..', 'images');

const BG = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3BA0F5"/><stop offset="1" stop-color="#1565C0"/>
  </linearGradient>`;

// Artwork drawn around its own centre (532, 506); `scale` shrinks it into the
// adaptive icon safe zone where launchers may crop the edges.
const art = (scale) => `
  <g transform="translate(512 512) scale(${scale}) translate(-532 -506)">
    <circle cx="600" cy="340" r="150" fill="#FFC93C" stroke="#F5A623" stroke-width="18"/>
    <text x="600" y="405" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="190" fill="#B7791F">₫</text>
    <rect x="222" y="420" width="580" height="400" rx="72" fill="#FFFFFF"/>
    <rect x="222" y="420" width="580" height="80" rx="40" fill="#E3F2FD"/>
    <rect x="560" y="560" width="282" height="150" rx="44" fill="#BBDEFB"/>
    <circle cx="640" cy="635" r="24" fill="#1565C0"/>
  </g>`;

// Single-colour version for Android 13 themed icons: only the alpha channel matters.
const monoArt = (scale) => `
  <mask id="m">
    <rect width="1024" height="1024" fill="black"/>
    <g transform="translate(512 512) scale(${scale}) translate(-532 -506)">
      <circle cx="600" cy="340" r="159" fill="white"/>
      <text x="600" y="405" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="190" fill="black">₫</text>
      <rect x="222" y="420" width="580" height="400" rx="72" fill="white"/>
      <rect x="222" y="490" width="580" height="12" fill="black"/>
      <rect x="560" y="560" width="282" height="150" rx="44" fill="black"/>
      <rect x="575" y="575" width="252" height="120" rx="32" fill="white"/>
      <circle cx="640" cy="635" r="24" fill="black"/>
    </g>
  </mask>
  <rect width="1024" height="1024" fill="#FFFFFF" mask="url(#m)"/>`;

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%"><defs>${defs}</defs>${body}</svg>`;

const outputs = [
  // Full-bleed icon: iOS, web and launchers without adaptive icon support.
  { file: 'icon.png', size: 1024, svg: svg(`<rect width="1024" height="1024" fill="url(#bg)"/>${art(0.86)}`, BG) },
  { file: 'android-icon-background.png', size: 1024, svg: svg('<rect width="1024" height="1024" fill="url(#bg)"/>', BG) },
  { file: 'android-icon-foreground.png', size: 1024, svg: svg(art(0.76)) },
  { file: 'android-icon-monochrome.png', size: 1024, svg: svg(monoArt(0.76)) },
  { file: 'splash-icon.png', size: 512, svg: svg(art(0.95)) },
  { file: 'favicon.png', size: 192, svg: svg(`<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${art(0.86)}`, BG) },
];

const work = mkdtempSync(path.join(tmpdir(), 'icons-'));
try {
  for (const { file, size, svg: markup } of outputs) {
    const html = path.join(work, 'icon.html');
    writeFileSync(
      html,
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent}</style>${markup}`
    );
    execFileSync('google-chrome', [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--user-data-dir=${path.join(work, 'profile')}`,
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${path.join(images, file)}`,
      `file://${html}`,
    ], { stdio: 'ignore' });
    console.log(`${file} (${size}x${size})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
