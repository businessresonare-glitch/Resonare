# MUHIBAH KUKUH SDN BHD

The site for Muhibah Kukuh (1435825-T) — CIDB G5 contractor in Pagoh, Muar,
Johor, trading in Kuala Lumpur as MK Electrician & Plumber.

A scroll-driven WebGL film: the MK mark resolves out of the dark, the camera
moves past it onto a site, and an MK building assembles itself storey by storey
as the visitor scrolls — frame, slabs, envelope, services, steel canopy —
finishing lit at dusk.

Static HTML/CSS/JS. The only build step is bundling the scene; everything else
is served as-is, and nothing is fetched from a third party at runtime.

```
mk/
  index.html
  build-single.js   portable one-file build (see below)
  assets/
    mk.css          design system — navy + amber, taken from the MK badge
    scene.js        the WebGL film (source)
    scene.bundle.js the same, bundled with three.js — this is what ships
    vendor/         three.js + the postprocessing addons it imports
    site.js         nav, reveals, counters, the reel, the quote handoff
    fonts.css    Archivo + Archivo Narrow, self-hosted
    mark.svg     the mark alone — header, footer, favicon
    logo.svg     full lockup with the arced wordmark — social, print
    fonts/       2 variable woff2 (~54KB total)
    photos/      job photographs, extracted from the company profile
    video/       mk-reel.mp4
```

This folder is self-contained: it vendors its own fonts rather than borrowing
the parent RESONARE site's, so it can be lifted out and deployed on its own.

---

## The logo

`mark.svg` and `logo.svg` are a **vector rebuild** of the client's 3D render,
not the render itself — the original PNG was supplied as a chat image and never
reached the repo. They match the composition (gloss orange sphere, gold ribbon
sash, chrome crescent, arced MUHIBAH KUKUH) and the palette, but the shading is
flat gradients rather than raytraced.

**If you have the original PNG, use it.** Drop it in as `assets/mark.png`,
then change the five `assets/mark.svg` references in `index.html`. Keep the
`<link rel="icon">` pointing at an SVG or a small PNG.

Two files, because they are for different sizes:

| File | Use | Why |
|---|---|---|
| `mark.svg` | header (46px), footer, reel, favicon | The arc text is illegible below ~160px, so the mark drops it |
| `logo.svg` | `og:image`, print, anywhere shown large | Full lockup, wordmark included |

`logo.svg` embeds a copy of `mark.svg`'s geometry inside a transform. **If you
edit `mark.svg`, re-copy those paths into `logo.svg`** or the two will drift.

Its wordmark is live text in Archivo Narrow, not outlines — small and editable,
but inside an `<img>` tag the page's webfonts do not apply and it falls back to
a system condensed sans. Convert the text to outlines before sending it to a
printer.

---

## Type

Archivo for prose, Archivo Narrow for annotation — one superfamily at two
widths, both variable, both latin-subset, ~54KB for the whole range.

The previous system set every micro-label in monospace, uppercase, at
.13–.20em tracking. That combination is the house style of generated marketing
pages, and it appeared nine times on this one page: eyebrows, card tags, stat
labels, step numbers, captions, form labels, footer headings, the wordmark line
and the reel caption. Changing the typeface alone would not have fixed it — the
treatment was as much of a tell as the face. So the tracking came down to
.005–.055em, and the things that are not really labels (gallery captions, form
fields) went back to sentence case, which is what real forms and real captions
do.

Width now does the work that tracking was doing: Narrow for annotation against
regular for prose is how technical drawings separate the two.

---

## The photographs

The eight gallery images were extracted from `MUHIBAH_Company_Profile_.pdf` —
they are the company's own site photography, not stock. The PDF embeds them as
DCTDecode streams, which are literally JPEG files, so they came out losslessly
by scanning the PDF for image objects rather than by re-rendering pages.

They are small (the profile stored them at 200-700px), so they are set to
`object-fit: cover` in tiles that never need more resolution than that. If
higher-resolution originals exist, drop them in over the same filenames.

**Nothing breaks if a file is missing** — `site.js` catches the load error and
marks the tile as a labelled slot rather than showing a broken image.

## The reel

`assets/video/mk-reel.mp4` is the supplied site footage, H.264 with faststart,
5.4MB. It is `preload="none"` and only fetched when the visitor presses play,
so its weight never competes with the first paint.

Two things worth doing when a machine with `ffmpeg` is handy:

```bash
# strip the audio track (it is muted anyway) and shed ~10% of the file
ffmpeg -i mk-reel.mp4 -an -c:v copy -movflags +faststart mk-reel-clean.mp4

# a real poster frame, so the panel shows the site instead of the placeholder
ffmpeg -i mk-reel.mp4 -ss 2.5 -vframes 1 -q:v 4 mk-reel.jpg
```

Then add `poster="assets/video/mk-reel.jpg"` to the `<video>` in `index.html`.
This could not be done in the build environment: the only available `ffmpeg`
was Playwright's stripped build, which cannot open H.264, and headless
open-source Chromium has no H.264 decoder either. Ordinary browsers play the
file normally — this is a toolchain gap, not a compatibility problem.

---

## How the film works

`scene.js` is three.js, bundled with esbuild into `scene.bundle.js` (549KB).
three.js and its addons are vendored under `assets/vendor` — the parent site's
rule after a CDN stall was *vendor everything*, and that still holds. Rebuild
after editing:

```bash
npx esbuild mk/assets/scene.js --bundle --format=iife --minify --target=es2020 \
  --alias:three=$PWD/mk/assets/vendor/three.module.min.js \
  --outfile=mk/assets/scene.bundle.js
```

Quality decisions worth keeping:

- **ACES filmic tone mapping**, so gold and orange keep their saturation into
  the highlights instead of clipping to white.
- **A PMREM-prefiltered room probe.** Chrome and gold are metals, and a metal
  with nothing to reflect renders as a flat grey blob. This is the single
  biggest difference between "3D" and "expensive".
- **Real shadow maps** from the key light, PCF-soft, with bias tuned to the
  scene scale.
- **Bloom above a luminance threshold**, so it catches lit windows and the
  mark's specular without smearing the whole frame.
- **The lighting rig lerps from working daylight to dusk** across the scroll —
  the same building reads as a site while it is going up and as a finished
  property once the windows come on.

Two things are load-bearing:

**Time-based scroll smoothing.** `eased += (target - eased) * k` is the usual
one-liner and it is frame-rate dependent: the catch-up per *frame* is fixed, so
the camera converges in 0.3s at 60fps and takes ten seconds at 5fps. On a weak
GPU the film trailed the scroll by half a section — measured, not theorised.
Exponential decay against real elapsed time converges in the same wall-clock
time at any frame rate.

**The pacing table is measured, not hardcoded** (`buildPace`). Scroll position
and film position are different curves. The station→scroll mapping is read from
the live DOM on load and on resize, because section heights differ between
viewports and move whenever the copy is edited. Edit the copy freely; the camera
re-syncs itself. To retime the film, change the `t` values in `STATIONS`.

**Degradation:** no WebGL drops the canvas and lets a CSS gradient carry the
page; `prefers-reduced-motion` renders one frame per scroll event with no rAF
loop; a hidden tab parks the loop; a lost context is caught and restored.

---

## The quote form

Submits by handing off to WhatsApp with the whole brief pre-filled, including a
reference like `MK-260813-K4QP`. That route needs no account, no API key and no
DNS, so it works the moment the page is live, and the visitor sees the message
before it sends.

The draft is kept in `localStorage` as it is typed, so a reload does not lose
it. If the popup is blocked the form says so and offers a direct link rather
than silently appearing to succeed — silent lead loss is the worst failure this
page could have.

To point it elsewhere, change `data-quote-whatsapp` on the `<form>`.

## Contact details

The number `+60 16-439 7900` appears in the header, the hero, the contact rows,
the footer, the floating button and the JSON-LD. Search the whole file for
`60164397900` if it ever changes — `tel:` links use `+60164397900` and
`wa.me/` links use the bare `60164397900`.
