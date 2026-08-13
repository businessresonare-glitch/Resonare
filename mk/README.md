# MK PLUMBING &amp; CONSTRUCTION — *Muhibah Kukuh*

A scroll-flown site for MK: one continuous 3D camera flight that starts high
over a village road, drops into an open trench, flies through a box culvert,
rises into a plant room past the 415V switchboard, tracks along a PLC/VFD
control cabinet, and pulls back out over the finished site at dusk.

Static HTML/CSS/JS, no build step and no external requests. Open `index.html`,
or serve the folder with any static host.

```
mk/
  index.html
  assets/
    mk.css      design system — navy + amber, taken from the MK badge
    world.js    the 3D flight engine and the six world stations
    site.js     nav, reveals, counters, the reel, the quote handoff
    logo.svg    the MK mark, rebuilt as vector
    photos/     job photographs (see below — currently empty)
    video/      mk-reel.mp4
```

Fonts are **not** duplicated here. The page links `../assets/fonts.css` from the
parent RESONARE site, so Manrope and IBM Plex Mono are shared and cost no extra
bytes. If this site is ever deployed on its own, copy `assets/fonts.css` and
`assets/fonts/` across and change that one `<link>`.

---

## ⚠️ Drop the job photos in

The gallery is wired up but the image files are not in the repo yet. Until they
are, each tile shows a labelled slot rather than a broken image — the page is
presentable either way, so this is not urgent, but it is the single biggest
improvement available.

Put these five files in `assets/photos/`:

| File | Shows |
|---|---|
| `01-culvert-road.jpg` | Backhoe laying box culverts along the village road |
| `02-switchboard.jpg` | 415V switchboard — ammeter, voltmeter, indicator lamps |
| `03-db-board.jpg` | DB board with the rows of MCBs |
| `04-control-panel.jpg` | Machine cabinet with the PLC and green VFD drives |
| `05-trench.jpg` | Open service trench beside the house |

Roughly 1600px wide, JPEG, under ~400KB each. They are `loading="lazy"`, so
they never delay the headline. **Nothing breaks if a file is missing** —
`site.js` catches the error and marks the tile as an empty slot.

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

## How the flight works

`world.js` is a small canvas-2D renderer — no three.js, no WebGL. The parent
site's rule after a CDN stall was *vendor everything*, and flat-shaded convex
quads through a painter's algorithm is all these scenes need: about 20KB of
first-party code instead of ~600KB of library, and on a weak device it degrades
by dropping geometry rather than by failing to boot.

Per frame: ease the scroll, place the camera on a Catmull-Rom spline, window
the world to the props near the camera (binary search over props sorted by z),
project, clip, depth-sort, paint with distance fog.

Three details that are load-bearing, so please do not "simplify" them:

**Near-plane clipping** (`clipNear`). Throwing away any polygon with a vertex
behind the camera throws away the whole polygon — and the biggest polygons are
exactly the ones the camera flies *inside*: the road, the room floors, and every
wall of the culvert. Without clipping the tunnel renders as a bare ring of ribs
with no walls at all.

**Screen-size caps** on sprites, lines and text. A lamp the camera passes within
a metre of has an unbounded projected radius; uncapped, an indicator lamp
becomes a coloured blob over half the viewport and a lighting pole becomes a
grey bar across the frame.

**The pacing table is measured, not hardcoded** (`buildPace`). Scroll position
and spline position are different curves — waypoints are spaced by distance
through the world, sections by copy height. The station→scroll mapping is read
from the live DOM on load and on resize, because sections are `100svh` on
desktop and `auto` on mobile, so any fixed table is wrong on one of them. Edit
the copy freely; the camera re-syncs itself.

To retime the flight, change the `t` values in `STATIONS` — each names the
section it belongs to and the spline position that frames its geometry.

**Budget:** ~2,000 props built once. The loop parks entirely when the tab is
hidden, and `prefers-reduced-motion` renders a single static frame per scroll
event with no rAF loop at all.

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
