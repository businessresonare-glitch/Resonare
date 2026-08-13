#!/usr/bin/env node
/* ==========================================================================
   Build a portable, single-file copy of the MK site.

   Everything the page needs — fonts, stylesheet, both scripts, the logo and
   (optionally) the reel — is inlined as text or data: URIs, so the result
   opens straight off disk with no server and no network. Useful for sending
   the client a preview, or for viewing the site without a static host.

     node mk/build-single.js                 # everything, reel included
     node mk/build-single.js --no-video      # ~500KB, reel keeps its placeholder
     node mk/build-single.js --body-only     # fragment, no <html>/<head> wrapper

   The output is generated, not source: edit index.html and the assets, then
   rebuild.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const MK = __dirname;
const ROOT = path.resolve(MK, '..');
const args = process.argv.slice(2);
const noVideo = args.includes('--no-video');
const bodyOnly = args.includes('--body-only');
const outArg = args.find(a => a.startsWith('--out='));

const read = p => fs.readFileSync(p, 'utf8');
const b64 = p => fs.readFileSync(p).toString('base64');

/* ---- fonts -------------------------------------------------------------
   Both faces are variable and latin-subset, so the entire weight range of
   the type system costs two files and ~54KB. MK vendors its own fonts rather
   than borrowing the parent site's, so this folder is self-contained.       */
const FACES = [
  { family: 'Archivo',        weight: '400 800', file: 'archivo-latin.woff2' },
  { family: 'Archivo Narrow', weight: '400 700', file: 'archivo-narrow-latin.woff2' }
];

const fontCss = FACES.map(f => `@font-face{
  font-family:'${f.family}';
  font-style:normal;
  font-weight:${f.weight};
  font-display:swap;
  src:url(data:font/woff2;base64,${b64(path.join(MK, 'assets/fonts', f.file))}) format('woff2');
}`).join('\n');

/* ---- assets ------------------------------------------------------------ */
const logoUri = 'data:image/svg+xml;base64,' + b64(path.join(MK, 'assets/logo.svg'));
const markUri = 'data:image/svg+xml;base64,' + b64(path.join(MK, 'assets/mark.svg'));
const css     = read(path.join(MK, 'assets/mk.css'));
const sceneJs = read(path.join(MK, 'assets/scene.bundle.js'));
const siteJs  = read(path.join(MK, 'assets/site.js'));

const videoPath = path.join(MK, 'assets/video/mk-reel.mp4');
const hasVideo = !noVideo && fs.existsSync(videoPath);
const videoUri = hasVideo ? 'data:video/mp4;base64,' + b64(videoPath) : '';

/* ---- assemble ----------------------------------------------------------
   Every substitution below goes through a replacement FUNCTION, never a
   replacement string.

   String.prototype.replace assigns meaning to `$` in the replacement — `$&`,
   `$1`, and `$$` for a literal dollar. site.js defines `$` and `$$` as its
   querySelector helpers, so inlining it as a replacement string silently
   rewrote every `$$` to `$`: the second helper overwrote the first, `$('#id')`
   started returning an array, and `header.classList` / `toggle.addEventListener`
   blew up in a file that looked perfectly correct on disk. A function
   replacement is passed through verbatim. */
const put = s => () => s;

let html = read(path.join(MK, 'index.html'));

/* the preload hint points at a file that no longer exists once fonts are
   inlined, and a failed preload logs a console warning */
html = html.replace(/^\s*<link rel="preload"[^>]*>\s*$/m, '');

html = html.replace(
  '<link rel="stylesheet" href="assets/fonts.css">\n<link rel="stylesheet" href="assets/mk.css">',
  put(`<style>\n${fontCss}\n</style>\n<style>\n${css}\n</style>`)
);

html = html.replace(/(href|content)="assets\/logo\.svg"/g, (_m, attr) => `${attr}="${logoUri}"`);
html = html.replace(/(href|content)="assets\/mark\.svg"/g, (_m, attr) => `${attr}="${markUri}"`);
html = html.replace(/src="assets\/mark\.svg"/g, put(`src="${markUri}"`));

if (hasVideo) {
  html = html.replace('src="assets/video/mk-reel.mp4"', put(`src="${videoUri}"`));
} else {
  /* Drop the source rather than leave a broken path, and retire the play
     control with it. site.js keys the whole reel behaviour off #reelPlay, so
     removing the id disables it cleanly — leaving the button in place would
     give the page a control that looks live and does nothing. */
  html = html.replace(/\s*src="assets\/video\/mk-reel\.mp4"/, '');
  html = html.replace(
    '<button class="reel-play" id="reelPlay" aria-label="Play the site reel">',
    put('<div class="reel-play reel-static">')
  );
  html = html.replace(
    /\s*<i><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"\/><\/svg><\/i>\s*<\/button>/,
    put('\n          </div>')
  );
  html = html.replace(
    '<span>On the tools — drainage, boards and panels</span>',
    put('<span>Reel plays in the full single-file build</span>')
  );
}

/* Photo slots. In the hosted site a missing photo 404s and site.js marks the
   tile from the error handler. A portable file has no server to 404 against
   and may be opened from anywhere, so any photo that is not on disk at build
   time gets its src dropped and its tile pre-marked instead — same appearance,
   without failed requests in the console. Photos that DO exist are inlined. */
html = html.replace(
  /<figure class="shot"([^>]*)>\s*<img src="assets\/photos\/([^"]+)"([^>]*)>/g,
  (whole, figAttrs, name, imgAttrs) => {
    const file = path.join(MK, 'assets/photos', name);
    if (fs.existsSync(file)) {
      const ext = path.extname(name).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `<figure class="shot"${figAttrs}>\n            ` +
             `<img src="data:${mime};base64,${b64(file)}"${imgAttrs}>`;
    }
    /* imgAttrs already carries alt and loading; an img with no src is never
       fetched, and .shot.empty hides it in favour of the slot label */
    return `<figure class="shot empty"${figAttrs}>\n            <img${imgAttrs}>`;
  }
);

/* the footer credit is a relative link to the parent site, which does not
   exist alongside a standalone file */
html = html.replace(
  '<span>Built by <a href="../index.html">RESONARE</a></span>',
  '<span>Built by RESONARE</span>'
);

/* Sanity check: nothing in the markup may still point at a file on disk. A
   single missed reference silently degrades the page for whoever opens it,
   with no server log to show it — so fail the build instead.

   This runs BEFORE the scripts are inlined. site.js builds an anchor by string
   concatenation for the popup-blocked fallback, and scanning the inlined
   source matches that as if it were a real unresolved href. */
const leftovers = [...html.matchAll(/(?:src|href)="(?!data:|#|tel:|https?:|mailto:)([^"]+)"/g)]
  .map(m => m[1])
  .filter(u => !u.startsWith('assets/photos/'))    /* slots 404 by design */
  .filter(u => !/^assets\/(scene\.bundle|site)\.js$/.test(u));  /* inlined just below */
if (leftovers.length) {
  console.error('unresolved external references:', leftovers);
  process.exit(1);
}

html = html.replace(
  '<script src="assets/scene.bundle.js" defer></script>\n<script src="assets/site.js" defer></script>',
  put(`<script>\n${sceneJs}\n</script>\n<script>\n${siteJs}\n</script>`)
);

if (bodyOnly) {
  /* strip the document skeleton for hosts that supply their own */
  html = html
    .replace(/^[\s\S]*?<head>/i, '')
    .replace(/<\/head>\s*<body>/i, '')
    .replace(/<\/body>\s*<\/html>\s*$/i, '')
    .replace(/^\s*<meta charset[^>]*>\s*$/m, '')
    .replace(/^\s*<meta name="viewport"[^>]*>\s*$/m, '');
}

const out = outArg
  ? path.resolve(outArg.slice('--out='.length))
  : path.join(MK, bodyOnly ? 'mk-single.body.html' : 'mk-single.html');

fs.writeFileSync(out, html);
console.log(
  `${path.relative(process.cwd(), out)}  ${(Buffer.byteLength(html) / 1048576).toFixed(2)}MB` +
  `  (reel ${hasVideo ? 'embedded' : 'omitted'})`
);
