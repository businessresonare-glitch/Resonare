/* ==========================================================================
   RESONARE — single-file build

   Folds the homepage and every asset it needs into one self-contained
   .html: stylesheets, scripts, the bundled 3D world, the fonts as base64
   woff2, and the five project screenshots as base64 JPEGs.

       node tools/build-single.mjs        ->  dist/resonare.html

   The result opens from a file:// URL with no server, no assets folder and
   no network. That is the point of it — it is a deliverable you can email,
   drop on any host, or open on a laptop with no internet.

   Two deliberate differences from the multi-page site:

   1. Cross-page links become in-page anchors. A standalone file has no
      about.html to navigate to, and every one of those pages' subjects
      already has a chapter or a section on the homepage.

   2. The screenshots are re-encoded smaller (see MAX_SHOT_W). On the
      homepage they are only ever textures on a 13-unit plane in the work
      corridor — never the full-size images work.html shows — so the extra
      pixels are ~340KB of base64 nobody can see.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = p => join(ROOT, p);
const read = p => readFileSync(r(p), 'utf8');
const kb = n => (n / 1024).toFixed(0) + 'KB';

/* Screenshots are textures here, not gallery images. */
const MAX_SHOT_W = 1100;
const SHOT_QUALITY = 78;

/* Latin only. Every word on the page is in that range, and the -ext subsets
   would add 66KB of base64 for codepoints nothing renders. */
const FONTS = [
  ['Manrope',          'normal', '200 800', 'manrope-latin.woff2'],
  ['Instrument Serif', 'normal', '400',     'instrument-serif-400-latin.woff2'],
  ['Instrument Serif', 'italic', '400',     'instrument-serif-400-italic-latin.woff2'],
  ['IBM Plex Mono',    'normal', '400',     'ibm-plex-mono-400-latin.woff2'],
  ['IBM Plex Mono',    'normal', '500',     'ibm-plex-mono-500-latin.woff2']
];

const SHOTS = [
  'assets/work/usa-plumbing.jpg',
  'assets/work/greenfellas.jpg',
  'assets/work/london-plumbers.jpg',
  'assets/work/mk-electrician.jpg',
  'assets/work/electrical-nepal.jpg'
];

/* Where each page's nav entry points once there is only one page. */
const LINK_MAP = {
  'index.html':    '#ch-open',
  'about.html':    '#process',
  'services.html': '#ch-build',
  'work.html':     '#ch-work',
  'contact.html':  '#contact'
};

/* -------------------------------------------------------------- fonts */
function fontFaces() {
  return FONTS.map(([family, style, weight, file]) => {
    const b64 = readFileSync(r('assets/fonts/' + file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};` +
           `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
}

/* ------------------------------------------------------------- images */
function shotDataURIs() {
  const py = `
import base64, io, sys
from PIL import Image
out = []
for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    if im.width > ${MAX_SHOT_W}:
        im = im.resize((${MAX_SHOT_W}, round(im.height * ${MAX_SHOT_W} / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=${SHOT_QUALITY}, optimize=True, progressive=True)
    out.append('data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode())
print('\\n'.join(out))
`;
  return execFileSync('python3', ['-c', py, ...SHOTS.map(r)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }).trim().split('\n');
}

/* --------------------------------------------------------------- build */
const css = await esbuild.transform(read('assets/style.css') + '\n' + read('assets/world.css'), {
  loader: 'css', minify: true
});
const mainJs = await esbuild.transform(read('assets/main.js'), {
  loader: 'js', minify: true, target: 'es2019'
});
const worldJs = read('assets/world.js');          /* already minified by build:world */
const favicon = 'data:image/svg+xml;base64,' + readFileSync(r('favicon.svg')).toString('base64');

let html = read('index.html');

/* Every insertion below goes through a replacer FUNCTION, never a string.
   A string replacement expands `$&`, `` $` ``, `$'` and `$1`, and minified
   three.js contains a literal `$&` — which silently rewrote itself to
   `</body>` in the middle of the WebGL state cache and left the page with a
   syntax error 280KB into a 500KB script. */
const insert = text => () => text;

/* head: drop everything that points at a file next to us */
html = html
  .replace(/\s*<link rel="icon"[^>]*>/g, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '')
  .replace(/\s*<link rel="mask-icon"[^>]*>/g, '')
  .replace(/\s*<link rel="manifest"[^>]*>/g, '')
  .replace(/\s*<link rel="preload"[^>]*>/g, '')
  .replace(/\s*<link rel="stylesheet"[^>]*>/g, '')
  .replace(/\s*<script src="assets\/[^"]*"[^>]*><\/script>/g, '');

html = html.replace('</head>', insert(
  `<link rel="icon" href="${favicon}">\n` +
  `<style>\n${fontFaces()}\n${css.code}\n</style>\n</head>`));

/* the screenshots the 3D corridor hangs on its walls */
const shots = shotDataURIs();
html = html.replace(/data-shots='\[[^\]]*\]'/, insert("data-shots='" + JSON.stringify(shots) + "'"));

/* scripts, in the order the multi-page site loads them */
html = html.replace('</body>', insert(
  `<script>\n${worldJs}\n</script>\n<script>\n${mainJs.code}\n</script>\n</body>`));

/* cross-page links become in-page anchors */
for (const [file, anchor] of Object.entries(LINK_MAP)) {
  html = html.split(`href="${file}"`).join(`href="${anchor}"`);
}

/* the canonical URL still points at the real site; the OG image has to stay
   an absolute URL because a data: URI is useless to a link unfurler */

mkdirSync(r('dist'), { recursive: true });
writeFileSync(r('dist/resonare.html'), html);

const size = statSync(r('dist/resonare.html')).size;
console.log(`dist/resonare.html  ${kb(size)}`);
console.log(`  css ${kb(css.code.length)}  main.js ${kb(mainJs.code.length)}  ` +
            `world.js ${kb(worldJs.length)}  shots ${kb(shots.join('').length)}`);
