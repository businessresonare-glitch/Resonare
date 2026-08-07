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
  hero.js       hero video slot, blur-in headline, typewriter
  quote.js      the stepped quote card and its delivery
  fonts.css     self-hosted @font-face rules
  fonts/        Inter + Tinos + IBM Plex Mono, unicode-range subset
  work/         project screenshots
  video/        4 ambient hero loops (WebM) + poster frames
```

---

## SEO: why there is no server-side rendering here

**The site is static HTML, which is what SSR exists to produce.** SSR is a fix
for JavaScript frameworks that would otherwise ship an empty `<div id="root">`
and build the page in the browser. This site has no framework and no build
step — every heading, paragraph and link is already in the `.html` file on
disk. There is nothing for a server to render.

Adding SSR would mean adopting a framework, a build pipeline and a Node
process, and would produce *the same bytes* Googlebot already receives, more
slowly and with more to break. Don't.

Verified with **JavaScript completely disabled** — the worst case for
indexing, and a harder test than Googlebot applies:

| Page | h1 | h2 | h3 | Words | Links |
|---|---|---|---|---|---|
| index | 1 | 7 | 5 | 574 | 31 |
| about | 1 | 7 | 7 | 631 | 27 |
| services | 1 | 6 | 15 | 707 | 28 |
| work | 1 | 4 | 5 | 670 | 27 |
| contact | 1 | 4 | 6 | 653 | 26 |

To re-check after any edit:

```sh
curl -s https://your-domain/services.html | grep -o '<h[1-3][^>]*>' | sort | uniq -c
```

### Heading rules this site follows

- **Exactly one `<h1>` per page**, carrying that page's primary keyword.
- **No skipped levels.** Three real bugs were fixed to get here: `work.html`
  jumped `h1 → h3` because the portfolio grid had no section heading; the
  mid-page CTA bands used `h3` in sections with no `h2`; and every footer
  jumped `h2 → h4` on "Site" / "Get in touch".
- **Footer labels are not headings.** They are `<p class="footer-col-title">`.
  "Site" and "Get in touch" carry no ranking value and were only creating a
  skipped level.
- **A heading describes a content section**, not a decorative band. If you add
  a section, give it an `h2`; if you add cards inside it, they take `h3`.

### Structured data

Each page carries JSON-LD: `ProfessionalService` (NAP, email, WhatsApp,
service area) and `BreadcrumbList` on all five, `Service` + `OfferCatalog` on
services, and `FAQPage` on contact — six real questions, eligible for FAQ rich
results. Validate at
[search.google.com/test/rich-results](https://search.google.com/test/rich-results).

### Still to do, by you

1. **Set the real domain** (see below) — canonicals currently name
   `resonare.digital`.
2. **Submit the sitemap** in Google Search Console once the domain is live.
3. **Create the Google Business Profile.** For local trade-adjacent searches
   this moves the needle more than anything on the page.

---

## Deploying

There is no build step. Drop the folder (or a zip of it) onto
[app.netlify.com/drop](https://app.netlify.com/drop) and it is live. `index.html`
must be at the **top level** of whatever you upload — if the zip contains a
single folder that contains the site, Netlify serves a directory listing
instead of the homepage.

`netlify.toml` sets cache headers: an hour for `/assets/*` (the filenames are
not content-hashed, so a long immutable cache would strand visitors on an old
stylesheet after a redeploy) and a year for `/assets/fonts/*` and
`/assets/video/*`, which only change when their filenames do.

### Set the domain before you send anyone the link

Every page carries absolute URLs — `<link rel="canonical">`, Open Graph and
Twitter tags, JSON-LD, `sitemap.xml`, `robots.txt`. All 36 of them say
`https://resonare.digital`.

That is correct **once resonare.digital points at your host**. It is actively
harmful while the site lives on a `*.netlify.app` preview subdomain: a canonical
tag naming a domain that does not serve the site tells Google to index nothing.

```sh
./set-domain.sh https://your-site.netlify.app   # while on the preview URL
./set-domain.sh https://resonare.digital        # once DNS is pointed
```

It rewrites whatever domain is currently baked in, so it is safe to run
repeatedly and in either direction.

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

## Palette — deep ink, and an accent that echoes

Not black. The ground is a blue-violet ink (`#07070E`) so the page has a
temperature, and surfaces step up from it in measured increments rather than by
stacking alpha:

| Token | Value | Role |
|---|---|---|
| `--ink-900` | `#07070E` | page ground |
| `--ink-850` | `#0B0B14` | deepest band |
| `--ink-800` | `#101019` | section band |
| `--ink-700` | `#16161F` | surface |
| `--ink-600` | `#1E1E2B` | raised card |
| `--ink-500` | `#2A2A3A` | hover / divider |

**RESONARE means to echo, so the accent travels.** Each page declares its own
hue on `<body data-accent="…">` and every downstream component reads the token
— links, CTAs, nav, focus rings, chips, section labels, the data bars, and the
3D scenes, which sample `--accent` at runtime. Moving through the site, the
colour moves with you.

| Page | Accent | |
|---|---|---|
| index | indigo | `#6C7BFF` |
| about | violet | `#9B6BFF` |
| services | cyan | `#22D3EE` |
| work | rose | `#FF5C8A` |
| contact | amber | `#FFB020` |

Adding a page means adding one `data-accent` value — nothing else.

### Two rules that are load-bearing

**Text colour is solid, never alpha.** Muted copy used to be
`rgba(255,255,255,.62)`. Over a moving hero video that reads as dirty grey and
its brightness shifts with the footage. `--text-2` (`#C6C6D8`) and `--text-3`
(`#9292AC`) are solid values that hold their contrast against anything behind
them.

**`--accent-ink` is dark, not white.** Every accent here is a mid-tone: white
on `#6C7BFF` measures 3.0:1, under AA for small text. Near-black clears 5:1 on
all five hues, so anything painting text *on* the accent uses `--accent-ink`.

## Typography — Inter + Times New Roman

Two faces, per the reference pairing.

- **`--font-display`** → `'Times New Roman', 'Tinos', 'Liberation Serif', Times, serif`
- **`--font-ui` / `--font-label`** → `'Inter', system-ui, …`
- **`--font-mono`** → IBM Plex Mono, kept for micro-labels and data

Times New Roman is not redistributable, so the stack asks the OS for it first
and falls back to **Tinos**, which is metric-compatible — identical advance
widths, so line breaks and layout are the same either way. Mac and Windows get
real Times; Linux and most Android get Tinos and look the same.

All faces are self-hosted with `unicode-range`, so an English page downloads
~368KB (latin only) out of 1.2MB on disk. **Do not add a webfont `<link>`** —
the no-external-requests rule in "Notes for future edits" still stands.

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

## Motion

Everything is CSS transitions/keyframes or small rAF loops — no animation
library, in keeping with the no-external-requests rule.

| Animation | Where | Driven by |
|---|---|---|
| Hero entrance stagger | all interior heroes | CSS keyframes off `body.loaded` |
| Word-by-word blur-in | about / services / work headlines | `.bt-word` + IntersectionObserver |
| Typewriter + caret | contact headline | `data-typewriter` in `hero.js` |
| Video loop crossfade | all hero videos | rAF in `hero.js` |
| **Mouse scrub** | contact hero, ≥1024px | `data-hero-scrub` in `hero.js` |
| Cinematic work reveal | work grid | scroll-linked `--cine` in `main.js` |
| Satisfaction bars / star pops | work | IntersectionObserver + CSS |
| **Burger → X** | mobile nav, all pages | pure CSS off `aria-expanded` |
| **Pill tick spring** | contact composer | CSS spring transition |
| **Status banner spring** | contact composer | measured height + `bannerIn` |

Every one has a `prefers-reduced-motion` path.

### Mouse scrub needs HTTP Range — and degrades if it is missing

On screens ≥1024px the contact hero's video is **driven by the cursor** rather
than playing itself: horizontal mouse movement scrubs the timeline. Below that
width there is no cursor, so it just loops. The breakpoint is checked live, not
once, because a window can be resized across it.

Two things make or break it:

- **Dense keyframes.** `hero-contact.webm` is encoded with `-g 4` — a keyframe
  every 0.2s. The other three use one keyframe per loop, which is fine for
  linear playback but means every seek decodes from frame 0. If you re-encode
  the contact clip, keep the dense GOP or scrubbing will crawl.
- **HTTP Range support.** A browser cannot seek in a media file unless the
  server answers range requests. Netlify does. **Python's `http.server` does
  not** — so scrubbing appears completely dead when testing locally with it,
  and the page is not at fault. Use a range-capable server (there is one in the
  scratchpad, or `npx http-server`).

Because a parked video that cannot seek is just a frozen frame, `hero.js`
checks `video.seekable` and, if the host does not serve ranges, drops scrubbing
and plays the clip normally instead. Verified both ways.

Every path that would otherwise call `play()` — `loadeddata`, the loop handler,
the intersection observer, `visibilitychange` — is gated on `scrubbing()`.
Without that, autoplay and the scrub fight over `currentTime` and the picture
judders.

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

**Every `:not()` raises specificity, and that is how the hero video broke the
heroes.** `[data-r3d-host] > *:not(.r3d-stage):not(.r3d-caption)` scores
(0,3,0) and sets `position: relative`. `.hero-video` scores (0,1,0) and sets
`position: absolute`. The rule wins, the video stops being an overlay, takes
its own ~810px of layout, and pushes the entire hero a full screen below the
fold — while still *playing*, so nothing looks broken until you notice the
headline is gone. Any absolutely-positioned layer inside a `[data-r3d-host]`
must be named in that `:not()` chain. Two are: `.r3d-caption`, `.hero-video`.

This is also why `scripts/`-free visual checks are not enough: the device
sweep passed with the heroes entirely below the fold, because it measured
overflow and reveals but not hero geometry. It now asserts that the hero badge
sits within the first screen and that `.hero-video` computes to `absolute`.

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
