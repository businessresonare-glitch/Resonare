# RESONARE

Marketing site for RESONARE — a digital studio in Malaysia building websites,
SEO and lead systems for local and trade businesses.

Static HTML/CSS/JS. Open `index.html`, or serve the folder with any static host.
There is no runtime dependency and no framework; the only file that is *built*
is `assets/world.js`, and it is committed.

```
index.html      the scroll world + the landed sections
about.html  services.html  work.html  contact.html

assets/
  style.css     design system + components (shared by every page)
  world.css     the homepage scroll world's layout (homepage only)
  main.js       preloader, nav, chapter reveals, chapter rail, counters
  world.js      BUILT — the 3D flight (see src/world/README.md)
  hero.js       interior-page headline blur-in, optional hero video slot
  quote.js      the stepped quote card on contact.html and its delivery
  fonts.css     self-hosted @font-face rules
  fonts/        6 woff2 files (~217KB total)
  work/         project screenshots — also textured onto the 3D corridor

src/world/      source for assets/world.js
```

## Contact details, in one place

Changing the phone number or address means changing all of these:

| where | what |
|---|---|
| every page `<head>` | the `ProfessionalService` JSON-LD block (`telephone`, `address`, `sameAs`) |
| every page footer | the `tel:` and `wa.me` links |
| every page | the sticky WhatsApp dock's `wa.me` link |
| `index.html` | the contact band and the arrival chapter's `tel:` button |
| `contact.html` | the contact channels list, and `data-quote-whatsapp` on the form |
| `assets/quote.js` | `CONFIG.whatsapp`, the fallback if the form attribute is missing |

Current: **+60 10-425 9239** / `business.resonare@gmail.com` / Malaysia.

---

## The homepage is one continuous 3D flight

Scrolling the homepage flies a camera, without a cut, out of the dark, through
the resonance rings, over a city of local businesses, into a website as it
assembles itself, down a corridor of real client work, up into the light, and
onto the mark.

`src/world/README.md` explains how it works and what is load-bearing. The short
version: page scroll maps to one point on one curve, and every other property in
the scene is a function of that number.

### Rebuilding it

```
npm install
npm run build:world
```

Only needed if `src/world/` changes. `three` and `esbuild` are dev dependencies;
three.js is bundled into the output, so the browser makes one request and there
is no CDN in the loop.

### It is allowed to not run

The flight is atmosphere. Every word, figure and link is in the DOM, so when
`boot.js` finds no WebGL — or `save-data`, or a device under 2GB — it sets
`body.no-world`, drops the canvas, and a CSS gradient carries the same
night-to-daylight arc behind fully readable chapters. Under
`prefers-reduced-motion` the scene renders one still frame per scroll event with
no animation loop at all. Below 820px the sticky cross-dissolve is switched off
and the chapters go back to ordinary flow, because the copy does not fit in one
viewport on a phone.

---

## ⚠️ One-time setup: turn on quote emails

**Until you do this, briefs will not arrive by email.** The form still works —
it falls back to WhatsApp and tells the visitor the truth — but the inbox route
stays off.

The form posts to [FormSubmit](https://formsubmit.co), which needs no account
and no API key. To activate it:

1. Open `contact.html` on the live site.
2. Fill in the three steps and press **Send my brief**.
3. FormSubmit emails **business.resonare@gmail.com** a one-time confirmation
   link. Open that email and click the link.

Every brief from then on lands in that inbox. Do this once, from the real
domain, before sending traffic to the page.

### Checking it worked

Submit the form again. You should see **"Brief received"** in green. If you see
the amber **"One tap to finish"** card instead, the relay did not accept the
brief — confirm step 3 above, and check the browser console for
`[quote] relay failed:`.

### Using a different relay

Everything is configurable without touching the JS. On the `<form id="quoteForm">`
element in `contact.html`:

| Attribute | Purpose | Current |
|---|---|---|
| `data-quote-endpoint` | Where the brief is POSTed as JSON | FormSubmit (set in `quote.js`) |
| `data-quote-email` | Address used by the mailto fallback | `business.resonare@gmail.com` |
| `data-quote-whatsapp` | Number used by the WhatsApp handoff | `60104259239` |

The endpoint must return JSON containing `success: true` (or `ok: true`).
Anything else is treated as a failure.

## How the quote system behaves

Three steps, validated one at a time, then delivered:

1. **Email relay.** Posted as JSON. The response is *inspected* — an HTTP 200
   is not on its own treated as delivery.
2. **WhatsApp.** Always offered, with the entire brief pre-filled into the
   message. This route needs no configuration and works immediately.
3. **Mailto.** Offered when the relay fails, also pre-filled.

Every submission gets a reference like `RSN-260805-W3GL`, shown to the visitor
and included in the email, so a brief can be matched to a conversation.

The brief is also kept in `localStorage` as it is typed, so a visitor who
reloads or navigates away does not lose their work.

### Why the response is checked

The previous version did this:

```js
fetch('/', …).then(() => showSuccess())
```

On Netlify that worked. On anything else — GitHub Pages, Vercel, a plain host —
`/` returns the homepage with HTTP 200, the promise resolves, the visitor is
told "Message sent", and the brief is discarded. Silent lead loss is the worst
possible failure for this site, so `quote.js` requires the relay to explicitly
confirm, and says plainly when it could not.

---

## Notes for future edits

**No external requests.** Fonts are self-hosted, three.js is bundled, and there
is no CDN script anywhere. The site once loaded Lenis from cdnjs as a
render-blocking tag; when that host was slow the page sat on the preloader.
Please keep it that way — if you add a library, vendor it into `assets/`.

**The preloader has a 2s failsafe** (`main.js`). It releases the page even if
`window.load` never fires. Do not remove it: the bar's ceiling is 92% until
`load`, so without the failsafe one stalled asset seals the whole site.

**One typographic voice.** Every heading is Manrope at 800 with hard negative
tracking; Instrument Serif is reserved for the italic `<em>` inside a headline
and nothing else. The site previously set interior headings in the serif and the
homepage in the grotesk, which read as two studios sharing a logo.

**There is no custom cursor, no resonance-ping mark and no glowing dot column.**
All three were removed on purpose. The cursor duplicated the pointer at a
permanent lag; the ping animated SVG geometry on twelve marks at once, on and
off screen; the dot rail pulsed a red halo over whatever it sat on. The chapter
rail on the homepage does the dots' job with hairlines and real labels.

**The WhatsApp button uses the actual WhatsApp glyph** on flat brand green with
one shadow. It previously wore a generic speech-bubble outline inside a pulsing
green halo stacked on a heavy black drop shadow.

**Icons** are generated, not hand-drawn — `favicon.svg` is the source of truth
for the mark. Sizes are deliberately different designs: 16px drops the
resonance dot because at that size it merges into the R. The maskable icon
keeps all artwork inside Android's 40% safe radius; if you regenerate it, keep
the mark under ~33% of the edge or the dot gets clipped on Android launchers.

**Icon and manifest paths are relative** so the site works when served from a
subfolder. Absolute `/favicon.ico` was the reason the tab icon went missing on
non-root deploys.
