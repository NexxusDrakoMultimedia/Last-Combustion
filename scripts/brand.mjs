// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Renders the PNG brand assets (Exo 2 for the small text) from the SVG logo files (see tools/brand/build_logo.py):
// favicons and app icons for the web build (public/) and the social cards, avatar and banner
// (assets/brand/). Needs a built `node_modules` and Chromium (PLAYWRIGHT_CHROMIUM_PATH).
// Usage: node scripts/brand.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const brand = resolve(root, 'assets/brand');
const pub = resolve(root, 'public');
mkdirSync(brand, { recursive: true });
mkdirSync(pub, { recursive: true });

// The header (XML declaration and a one-line comment) is dropped line by line.
const svg = (name) =>
  readFileSync(resolve(brand, name), 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('<?xml') && !line.startsWith('<!--'))
    .join('\n');
// The fonts are embedded in the page, so the render looks the same wherever it runs.
const font = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(resolve(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')}`;
const TAGLINE =
  'Racing team simulation game based in a post-petrol world, where the last petrolheads ply their craft.';

const css = `
@font-face { font-family: 'X'; font-weight: 500; src: url(${font('exo-2', 'exo-2-latin-500-normal.woff2')}); }
@font-face { font-family: 'X'; font-weight: 700; src: url(${font('exo-2', 'exo-2-latin-700-normal.woff2')}); }
* { box-sizing: border-box; margin: 0; }
body { background: #0d1116; color: #e6ebf0; font-family: 'X', sans-serif; }
.bg { position: relative; overflow: hidden; background:
  radial-gradient(900px 500px at 15% 110%, rgba(163,32,58,0.38), transparent 70%),
  linear-gradient(135deg, #131a22, #0d1116 60%); }
.rule { position: absolute; left: 0; right: 0; height: 6px; background: #a3203a; }
.tag { font-weight: 500; color: #8d9aa8; line-height: 1.35; }
.url { font-family: 'X', sans-serif; font-weight: 700; letter-spacing: 0.12em; color: #e5798e; }
svg { display: block; }
`;

const page = (w, h, body) =>
  `<!doctype html><meta charset="utf-8"><style>${css}</style><body><div class="bg" style="width:${w}px;height:${h}px">${body}</div></body>`;

const wordmark = (w) =>
  svg('logo-wordmark.svg').replace('<svg ', `<svg style="width:${w}px;height:auto" `);
const mark = (w) =>
  svg('logo-mark.svg').replace('<svg ', `<svg style="width:${w}px;height:${w}px" `);

const card = (w, h) =>
  page(
    w,
    h,
    `<div class="rule" style="top:0"></div><div class="rule" style="bottom:0"></div>
     <div style="position:absolute;inset:0;padding:${h * 0.13}px ${w * 0.07}px;display:flex;flex-direction:column;justify-content:center;gap:${h * 0.07}px">
       ${wordmark(w * 0.74)}
       <p class="tag" style="font-size:${h * 0.052}px;max-width:${w * 0.84}px">${TAGLINE}</p>
       <p class="url" style="font-size:${h * 0.05}px">LC.NEXXUSDRAKO.AU</p>
     </div>`,
  );

const jobs = [
  // The web build.
  {
    file: resolve(pub, 'favicon-32.png'),
    w: 32,
    h: 32,
    html: `<!doctype html><style>*{margin:0}</style>${svg('favicon.svg').replace('<svg ', '<svg style="width:32px;height:32px" ')}`,
  },
  {
    file: resolve(pub, 'apple-touch-icon.png'),
    w: 180,
    h: 180,
    html: `<!doctype html><style>*{margin:0}</style>${svg('favicon.svg').replace('<svg ', '<svg style="width:180px;height:180px" ')}`,
  },
  {
    file: resolve(pub, 'icon-192.png'),
    w: 192,
    h: 192,
    html: `<!doctype html><style>*{margin:0}</style>${svg('favicon.svg').replace('<svg ', '<svg style="width:192px;height:192px" ')}`,
  },
  {
    file: resolve(pub, 'icon-512.png'),
    w: 512,
    h: 512,
    html: `<!doctype html><style>*{margin:0}</style>${svg('favicon.svg').replace('<svg ', '<svg style="width:512px;height:512px" ')}`,
  },
  { file: resolve(pub, 'og-card.png'), w: 1200, h: 630, html: card(1200, 630) },
  // Social and profile art.
  { file: resolve(brand, 'github-social-1280x640.png'), w: 1280, h: 640, html: card(1280, 640) },
  {
    file: resolve(brand, 'avatar-512.png'),
    w: 512,
    h: 512,
    html: page(
      512,
      512,
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${mark(360)}</div>`,
    ),
  },
  {
    file: resolve(brand, 'banner-1500x500.png'),
    w: 1500,
    h: 500,
    html: page(
      1500,
      500,
      `<div class="rule" style="bottom:0"></div><div style="position:absolute;inset:0;padding:0 90px;display:flex;flex-direction:column;justify-content:center;gap:26px">${wordmark(900)}<p class="tag" style="font-size:28px;max-width:1000px">${TAGLINE}</p></div>`,
    ),
  },
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
for (const { file, w, h, html } of jobs) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: false });
  await p.close();
  console.log(file.replace(root + '/', ''));
}
await browser.close();
