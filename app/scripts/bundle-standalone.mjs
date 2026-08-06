/**
 * Folds the Vite build into one self-contained HTML file.
 *
 * Netlify's drag-and-drop accepts a folder, and dist/ is the better deploy —
 * separate CSS/JS/image files cache independently. This exists for the case
 * where a single portable file is wanted instead: CSS and JS are inlined and
 * every image becomes a data URI, so the page has zero same-origin requests.
 *
 * Google Fonts stays a remote <link>; inlining webfonts would mean base64ing
 * every weight of three families for no benefit.
 *
 * Run after `npm run build`:
 *   node scripts/bundle-standalone.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../dist');
const OUT_DIR = resolve(here, '../standalone');
const OUT = resolve(OUT_DIR, 'index.html');

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const dataUri = (absPath) => {
  const ext = extname(absPath).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  if (ext === '.svg') {
    const svg = readFileSync(absPath, 'utf8').replace(/\s+/g, ' ').trim();
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  return `data:${mime};base64,${readFileSync(absPath).toString('base64')}`;
};

let html = readFileSync(resolve(DIST, 'index.html'), 'utf8');

// Inline the built stylesheet.
html = html.replace(
  /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)"\s*\/?>/,
  (_m, href) => `<style>\n${readFileSync(resolve(DIST, href.slice(1)), 'utf8')}\n</style>`,
);

// Inline the built module script.
let js = '';
html = html.replace(
  /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/,
  (_m, src) => {
    js = readFileSync(resolve(DIST, src.slice(1)), 'utf8');
    return '__INLINE_SCRIPT__';
  },
);

// Swap every image path referenced in the bundle for its data URI.
const assets = new Map();
const collect = (dir, prefix) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) collect(abs, `${prefix}${entry.name}/`);
    else if (MIME[extname(entry.name).toLowerCase()]) assets.set(`${prefix}${entry.name}`, abs);
  }
};
collect(DIST, '/');

// Preloading a font that is about to be inlined would ship its bytes twice.
html = html.replace(/\s*<link[^>]*rel="preload"[^>]*as="font"[^>]*\/?>/g, '');

let swapped = 0;
// Paths appear quoted in JS/HTML ("/work/a.jpg") and bare inside CSS url(...),
// since Vite emits url() unquoted. Both forms have to be rewritten.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [path, abs] of assets) {
  const uri = dataUri(abs);
  if (!uri) continue;
  const pattern = new RegExp(`(["'(])${escapeRe(path)}(["')])`, 'g');
  const before = js + html;
  js = js.replace(pattern, (_m, open, close) => `${open}${uri}${close}`);
  html = html.replace(pattern, (_m, open, close) => `${open}${uri}${close}`);
  if (before !== js + html) swapped += 1;
}

html = html.replace('__INLINE_SCRIPT__', `<script type="module">\n${js}\n</script>`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`standalone/index.html  ${kb(Buffer.byteLength(html))}`);
console.log(`  inlined ${swapped} assets as data URIs`);
console.log(`  remaining external refs: ${[...html.matchAll(/https?:\/\/[^"']+/g)].length}`);
