/**
 * Downloads the type system's woff2 files and emits src/fonts.css.
 *
 * Self-hosting rather than linking Google's CDN: it removes two extra DNS+TLS
 * handshakes from the critical path, keeps rendering independent of a third
 * party, and avoids sending visitor IPs to Google — the same approach the
 * static site already takes with its own woff2 files.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(here, '../public/fonts');
const OUT_CSS = resolve(here, '../src/fonts.css');

// A modern UA is required or Google serves legacy ttf instead of woff2.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const FAMILIES = [
  { css: 'Instrument+Serif:ital@0;1', slug: 'instrument-serif' },
  { css: 'Public+Sans:wght@400;500;600;700', slug: 'public-sans' },
  { css: 'IBM+Plex+Mono:wght@400;500', slug: 'ibm-plex-mono' },
];

// Only the subsets this site's copy actually needs.
const KEEP_SUBSETS = new Set(['latin', 'latin-ext']);

const get = async (url, asBuffer = false) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
};

mkdirSync(FONT_DIR, { recursive: true });

const blocks = [];
let downloaded = 0;
let bytes = 0;

for (const family of FAMILIES) {
  const css = await get(
    `https://fonts.googleapis.com/css2?family=${family.css}&display=swap`,
  );

  // Google emits one @font-face per subset, each preceded by a /* subset */ comment.
  const chunks = css.split('/*').slice(1);

  for (const chunk of chunks) {
    const subset = chunk.slice(0, chunk.indexOf('*/')).trim();
    if (!KEEP_SUBSETS.has(subset)) continue;

    const url = chunk.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
    if (!url) continue;

    const weight = chunk.match(/font-weight:\s*([^;]+);/)?.[1].trim() ?? '400';
    const style = chunk.match(/font-style:\s*([^;]+);/)?.[1].trim() ?? 'normal';
    const name = chunk.match(/font-family:\s*'([^']+)'/)?.[1] ?? family.slug;
    const range = chunk.match(/unicode-range:\s*([^;]+);/)?.[1].trim();

    // Deterministic name — weight/style/subset fully identify a face, so the
    // filename stays stable across refetches and preload hints cannot go stale.
    const file = `${family.slug}-${weight.replace(/\s+/g, '')}-${style}-${subset}.woff2`;
    const buffer = await get(url, true);
    writeFileSync(resolve(FONT_DIR, file), buffer);
    downloaded += 1;
    bytes += buffer.length;

    blocks.push(
      [
        '@font-face {',
        `  font-family: '${name}';`,
        `  font-style: ${style};`,
        `  font-weight: ${weight};`,
        '  font-display: swap;',
        `  src: url('/fonts/${file}') format('woff2');`,
        range ? `  unicode-range: ${range};` : null,
        '}',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

writeFileSync(
  OUT_CSS,
  [
    '/*',
    ' * GENERATED — do not edit by hand. Run scripts/fetch-fonts.mjs to refresh.',
    ' *',
    ' * Self-hosted woff2 for the display/body/mono type system. font-display:swap',
    ' * on every face, so text paints in the fallback immediately rather than',
    ' * blocking, and unicode-range keeps the browser from fetching subsets the',
    ' * page never uses.',
    ' */',
    '',
    ...blocks,
    '',
  ].join('\n'),
);

console.log(`${downloaded} woff2 files, ${(bytes / 1024).toFixed(0)} KB total`);
console.log(`wrote src/fonts.css (${blocks.length} @font-face blocks)`);
