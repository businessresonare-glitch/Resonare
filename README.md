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

## The palette is monochrome — deliberately

Black, shades of black, grey and white. Depth comes from **stacked surfaces and
gradients**, never from hue. There is exactly one colour on the entire site:
`--brand-red` (`#D8261F`), used in one place — the dot in the logo mark.

That constraint is enforceable, so please enforce it. To check nothing has
crept back in:

```sh
# any six-digit hex whose channels are not all equal, other than the brand red
grep -ohE '#[0-9A-Fa-f]{6}' assets/*.css assets/*.js *.html \
  | tr 'a-f' 'A-F' | sort -u \
  | awk '{r=substr($0,2,2);g=substr($0,4,2);b=substr($0,6,2); if(r!=g||g!=b) print}'
# should print D8261F and nothing else
```

The token *names* are historical (`--navy-deep`, `--rust`, `--cream`) and kept
on purpose — renaming them would touch ~200 call sites for no visual gain.
**Read them by role, not by name:**

| Token | Role now |
|---|---|
| `--cream` | page background — black |
| `--cream-dim` | raised chip surface |
| `--ink` | deepest band background |
| `--ink-soft` | muted body text |
| `--navy-deep/mid/card/soft` | surface ramp, darkest → lightest |
| `--rust` | primary accent — now white |
| `--rust-light` | secondary accent — light grey |
| `--text` / `--text-dim` | body text on the black page |

Two traps this conversion already hit, both worth remembering:

- **A white accent cannot carry white text.** `--rust` is white now, so every
  `background:var(--rust)` needs `color:#000`. The selected-choice tick and the
  primary button were both invisible until that was fixed.
- **Muted text needs `.68` alpha, not `.62`.** On pure black, white at 62%
  measures 4.4:1 — just under AA. `.68` clears it. `--ink-soft` is set there.

The 3D scenes carry their own palette in `assets/r3d.js`; it is a luminance
ladder using the same historical names, so scene bodies did not need rewriting.

## Heroes

All five pages have their own full-viewport hero. The four interior ones share
`.cine-hero` and differ in copy, 3D scene and stats:

| Page | Scene | Headline treatment |
|---|---|---|
| `about` | `orbit` | word-by-word blur-in |
| `services` | `core` | word-by-word blur-in |
| `work` | `resonance` | word-by-word blur-in |
| `contact` | `lattice` | **typewriter** (`data-typewriter`) |

Shared chrome, added on top of the base component:

- **The nav is a floating glass pill** — a restyle of `.site-header`, not a
  second navigation. One set of links, one tab order, no duplicate landmark.
- **A trust bar** sits at the foot of every hero: a glass chip plus five client
  names in italic serif. It becomes a snap-scrolling row under 820px.
- **A third CTA** (`.cine-play`) — bare text with a filled play triangle. It is
  a `<button>` because it moves the page rather than navigating, so it is wired
  through `[data-scroll-to]` in `main.js` to reach the smooth-scroll helper.

**The heroes are height-budgeted.** Adding the trust bar pushed the tallest two
past the fold (1044px of content in a 900px viewport). There is a
`min-width:881px and max-height:940px` block that tightens the rhythm so all
four land at exactly one viewport on a short laptop. If you add anything to a
hero, re-check that — the budget is real and it is tight.

`data-typewriter` types its string out with a blinking caret. It exposes the
full text via `aria-label` up front (a screen reader should not sit through the
animation), prints instantly under `prefers-reduced-motion`, and waits for the
preloader to hand over the same way the blur-in headline does.

## The WhatsApp composer

`contact.html` opens with a composer that sits **above** the stepped brief and
skips the relay entirely: pick services, type a sentence, and the whole thing
leaves as a prefilled `wa.me` message on **+977 9767278212**.

It is deliberately the first thing on the page. The relay route has a failure
mode — a mail service that goes down takes the lead with it — and this one has
none: the visitor reads the composed message inside WhatsApp before they press
send, which is the only delivery confirmation on this site that has ever been
literally true.

```
.wa-composer[data-wa-composer][data-wa-number="9779767278212"]
  .wa-pill[aria-pressed]        multi-select, six services
  [data-wa-status]              idle hint ⇄ "Ready to inquire about: …" + Let's go
  [data-wa-detail]              free text — what they actually want
  [data-wa-business/-name]      optional, appended to the message
  [data-wa-send]                disabled until a pill or some text exists
```

Behaviour worth keeping if you edit it:

- **The number lives in one place** — `data-wa-number` on the composer. The JS
  falls back to the same digits, and `quote.js` reads `data-quote-whatsapp`
  from the form. Change all three together or the routes disagree.
- **The status banner animates from a measured height,** then releases back to
  `auto`. `height: auto` is not animatable, so the measured value is what makes
  it slide instead of jump; releasing it afterwards is what stops a long
  service list from being clipped on a narrow screen.
- **The draft is kept in `localStorage`** (`resonare.wa.draft`), same as the
  stepped form, so a visitor who navigates away does not retype anything.

The stepped form also carries a **Send on WhatsApp instead** button in its
footer. That one is live on *every* step and deliberately skips validation —
whatever has been filled in so far is enough to start a conversation, and a
conversation is the actual goal.

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

**The work grid is scroll-linked, not a one-shot reveal.** Each screenshot on
`work.html` carries `.cine-shot`, and `main.js` writes a single `--cine` value
(0 → 1) onto it from how far it has travelled through the viewport; the CSS
builds the scale, blur, brightness and light-wipe from that one number. Only
on-screen shots are measured, and the writes are batched into one rAF per
scroll frame — setting a custom property on six elements straight from a
scroll handler is the classic way to make a smooth page janky. Shots that
leave upward park at 1 so scrolling back down does not replay the entrance.

**Never give an IntersectionObserver a percentage `threshold` for a tall
element.** This one shipped a real bug. `threshold: 0.15` asks for 15% of the
element to be on screen — which anything taller than `viewportHeight / 0.15`
can *never* satisfy. On a 568px iPhone SE the single-column service grid is
3860px tall (limit: 3787px), so it never fired and the entire section stayed at
`opacity: 0`. The section-dot tracker had the same trap at `threshold: 0.5`.

Both now express the intent in a height-independent way:

```js
// "once its leading edge comes up past 88% of the viewport"
{ threshold: 0, rootMargin: '0px 0px -12% 0px' }
// "whichever section crosses the middle of the screen"
{ threshold: 0, rootMargin: '-45% 0px -45% 0px' }
```

If you add an observer, ask what happens when the target is taller than the
screen. On a phone, most sections are.

**The hero entrance is a CSS animation keyed off `body.loaded`,** not JS. Badge
→ subheading → CTAs → stats → trust bar, each blurring up on its own delay,
with the stat cards and partner names staggering within their rows. The
headline is deliberately excluded — it has its own word-by-word blur or the
typewriter, and animating the container too would fight it. `will-change` is
released via `body.hero-settled` about 2.6s in, because six simultaneous blur
filters is the heaviest frame the page paints and there is no reason to keep
those layers promoted afterwards. There is a `@media (scripting: none)` block
that shows everything if JS never runs.

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
