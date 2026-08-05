# RESONARE

Marketing site for RESONARE — websites, SEO and lead systems for local and
trade businesses. Static HTML/CSS/JS with no build step: open `index.html`, or
serve the folder with any static host.

```
index.html  about.html  services.html  work.html  contact.html
assets/
  style.css     design system + components
  main.js       preloader, nav, reveals, cursor, split headings
  r3d.js        3D renderer and the five scenes
  quote.js      the stepped quote card and its delivery
  fonts.css     self-hosted @font-face rules
  fonts/        6 variable woff2 files (~217KB total)
  work/         project screenshots
```

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

That's it. Every brief from then on lands in that inbox. Do this once, from the
real domain, before sending traffic to the page.

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
| `data-quote-whatsapp` | Number used by the WhatsApp handoff | `9779767278212` |

The endpoint must return JSON containing `success: true` (or `ok: true`).
Anything else is treated as a failure — see below.

---

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
possible failure for this site, so `quote.js` now requires the relay to
explicitly confirm, and says plainly when it could not.

---

## Notes for future edits

**No external requests.** Fonts are self-hosted and there is no CDN script. The
site previously loaded Lenis from cdnjs as a render-blocking tag; when that host
was slow the page sat on the preloader. Please keep it that way — if you add a
library, vendor it into `assets/`.

**The preloader has a 3.5s failsafe** (`main.js`). It hides itself even if
`window.load` never fires. Do not remove it: the ceiling is 92% until `load`,
so without the failsafe one stalled asset seals the whole site.

**3D scenes** are declared with `data-r3d="<scene>"` on a `<canvas class="r3d-stage">`
inside a `[data-r3d-host]` element. Scenes available: `resonance`, `core`,
`lattice`, `carousel`, `orbit`. They stop rendering when scrolled out of view or
when the tab is hidden, and render a single static frame under
`prefers-reduced-motion`. Two per page is the budget.

**Icons** are generated, not hand-drawn — `favicon.svg` is the source of truth
for the mark. Sizes are deliberately different designs: 16px drops the
resonance dot because at that size it merges into the R. The maskable icon
keeps all artwork inside Android's 40% safe radius; if you regenerate it, keep
the mark under ~33% of the edge or the dot gets clipped on Android launchers.

**Icon and manifest paths are relative** so the site works when served from a
subfolder. Absolute `/favicon.ico` was the reason the tab icon went missing on
non-root deploys.
