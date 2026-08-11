# MK Services — single-file site

`mkwebsitecoded.html` is the whole site: fifteen pages, the stylesheet, the
scripts and every image inlined. Double-click it and it opens in any browser —
no folder, no web server. Navigation is hash-based, so the address bar reads
`…/mkwebsitecoded.html#/MK-Services.html` and the back button works normally.

`img/` holds the same ten photographs as ordinary `.webp` files. The bundle
does not read them — it carries its own copies as data URIs — but a folder
deployment should reference these instead, because the browser can then cache
them across pages.

---

## What changed in this pass

Two jobs: fix what was broken on phones, tablets and small laptops, and give
the service pages a pinned photograph that the copy scrolls over.

### Layout faults that were fixed

Every page was measured in a real browser at 320, 360, 390, 768, 900 and 1280
CSS pixels, before and after. Horizontal scroll is now zero at all six widths
on all fifteen pages; it was present on all fifteen before.

**A stylesheet rule with two media queries spliced into it.** Line ~639 read
`.trust-strip small{…color:var(--i` and then, mid-declaration, two whole
`@media` blocks, and then `nk-mute);font-weight:600}`. A CSS parser consumes an
invalid declaration up to its matching brace, so *both* media queries were
silently discarded. The project grid never collapsed to one column, the trust
strip stayed four-across on a phone, and the hero photo kept its desktop
aspect ratio. Repaired.

**Buttons forced the page wider than the screen.** `.btn` carries
`white-space:nowrap`, and `.btn--lg` adds 36px of side padding at 1.08rem, so
"WhatsApp For A Fast Quote" demanded about 327px. A 360px phone offers 324px
inside the gutter and a 320px phone offers 284px. That single rule was the
largest source of sideways scroll on the site. Buttons now wrap below 760px.

**The header did not fit on a laptop.** The desktop bar needs roughly 1172px
of intrinsic width, but the burger menu only appeared below 860px. Between
861px and about 1240px the nav overflowed and pushed the "Free Quote" and
WhatsApp buttons off-screen, where `overflow:hidden` deleted them — an iPad in
landscape had no call to action at all. The bar now compacts below 1280px and
hands over to the burger below 1120px.

**Dropdowns could not be opened by touch.** Services and Coverage opened on
`:hover` only. On a tablet wide enough to still show the desktop nav there is
no hover, so the first tap simply navigated away and the submenus were
unreachable. On a coarse pointer the first tap now opens the menu and the
second follows the link.

**Three pages set their grid columns in a `style` attribute**, which beats
every media query. The Johor address cards stayed three-across on a phone and
were clipped to unreadable slivers. Those are classes now.

**iOS zoomed the page in on the quote form.** Fields were `.97rem` (~15.5px);
Safari auto-zooms anything under 16px on focus, which left visitors scrolled
sideways in the middle of the form. Set to exactly 16px on small screens.

**The floating layer on a phone** was three overlapping WhatsApp prompts — a
FAB, its nudge bubble and the sticky call bar — stacked in one corner, none of
which allowed for the iPhone home indicator, so the call bar sat under it.
Below 640px the sticky bar is now the only one, and everything reserves
`env(safe-area-inset-bottom)`.

**The Electrical page circuit board** is tilted with a 3D transform, which
still contributes to scrollable overflow. It was only flattened below 560px,
so 561–900px pushed the page about 25px sideways.

**`body{overflow-x:hidden}` became `overflow-x:clip`.** Hidden overflow on one
axis forces the other axis to `auto`, which turns `<body>` into a scroll
container and breaks `position:sticky` inside it. `clip` does the same
clipping without that side effect. The real overflow sources are fixed above —
this is only a net.

### The pinned photo band

One photograph per page, held still while the copy scrolls up and covers it.
It is on twelve pages: the five service pages, the services index, the home
page, About, and the four coverage pages. FAQ, Reviews and Contact are left
plain — those pages are tasks, not persuasion.

It is built on `position:sticky`, deliberately **not** on
`background-attachment:fixed`. Fixed attachment is ignored by iOS Safari (the
image jumps to an arbitrary crop and then stops moving) and forces a full
repaint of the band on every scroll frame on Android. That is the juddering
this effect normally gets blamed for.

How it holds still: `.pinband-media` is a full-viewport sticky layer, and
`.pinband-flow` is pulled back over it by an equal negative **top** margin. The
copy therefore begins at the top of the section and travels up over the
photograph, and the photograph is released the moment the section ends.

The negative margin belongs to the flow, not to the media, and that is not a
stylistic choice. A sticky element's constraint rectangle is its containing
block shrunk by its own margins, so putting `margin-bottom:-100lvh` on the
sticky layer instead *grows* that rectangle by a full viewport — the
photograph is then allowed to travel a whole screen past the end of its own
band. It painted straight through the following section, and on the pages
where that section has no background of its own (Home, About, Coverage) the
dark heading there landed on top of a photograph and became unreadable.
Keeping the media's margin box at its full height pins it to the band exactly.

The consequence is that a sticky element stays pinned for the section's height
minus its own — so a band only one screen taller than the viewport releases
the image halfway through the copy. The lead is one screen and the panel is
about three quarters of one, which buys a full screen of pinned scrolling
while the copy passes over.

Heights use `lvh` for the image, so no gap appears when a mobile address bar
retracts, and `svh` for the first screen of copy, so its call to action is
never hidden behind that same bar.

The darkening is deliberately split across two layers. The one fixed to the
photograph stays light — just enough to hold the headline — so the picture is
still legible as a picture. The heavy darkening belongs to `.pinband-panel`,
which means it travels with the body copy: the photograph is bright where
nobody is reading and dark exactly where they are.

`prefers-reduced-motion` turns the whole thing into an ordinary photograph
above the copy. Nothing is lost.

#### Changing a picture

Each band's `<img>` carries two custom properties:

```html
<img src="…" style="--focal:50% 54%;--focal-m:56% 50%">
```

`--focal` is the `object-position` used everywhere; `--focal-m` replaces it
below 760px, where a landscape photograph in a portrait frame loses most of
its width and the crop has to be aimed at whatever must survive. Swap the
`src`, adjust the two focal points, and nothing else needs touching.

#### Which photograph is where

| Page | File | Subject |
|---|---|---|
| Home, Areas · Johor | `finished-house.webp` | Completed detached house |
| About | `roof-repair.webp` | Roof flashing and tile repair |
| Services, Areas | `road-drainage.webp` | Culvert laying, road reinstatement |
| Construction | `facade-render.webp` | External rendering and finishing |
| Plumbing | `trench-pipework.webp` | Excavation for underground pipework |
| Electrical | `control-panel.webp` | Industrial control panel |
| Cleaning | `washroom-finish.webp` | Post-handover commercial washroom |
| Aircon | `interior-handover.webp` | Completed interior before handover |
| Areas · KL | `switchboard.webp` | 415V incoming supply switchboard |
| Areas · Penang | `db-board.webp` | Distribution board |

Captions describe only what is visible in the frame. None of them claims a
location, because the source photographs did not come with one — if you know
where each was taken, the caption is the `.pinband-cap` line and is safe to
edit.

### Weight

The photographs are re-encoded to WebP, capped at 1600px on the long edge and
about 110KB each — 875KB for all ten, roughly 1.2MB once base64-encoded into
the bundle. The single file is now 3.1MB, up from 1.7MB. That is the price of
a file that runs from a double-click; a folder deployment that points at
`img/` instead pays 875KB once and then caches it.

`washroom-finish.webp` is the weakest source at 573px wide. Under the scrim it
holds up, but if a higher-resolution original exists it is worth swapping.

---

## Still outstanding

`WEB3FORMS_KEY` in the script is still `YOUR_WEB3FORMS_ACCESS_KEY_HERE`. Until
a real key is pasted in, the quote form composes the enquiry into the
visitor's mail app and offers WhatsApp as a second route — no enquiry is lost,
but nothing arrives in the inbox by itself.

The Johor address carries a visible `Johor address subject to update` flag on
the coverage page. That was already there; it is a content decision, not a
layout one.
