# The world

`assets/world.js` is the only built file in this repository. Everything else is
served exactly as it is written.

## Rebuilding

```
npm install                                    # three + esbuild, dev only
npm run build:world                            # -> assets/world.js
```

`assets/world.js` is committed. You only need to run the build if you change
something in `src/world/`. The site never asks a visitor to build anything, and
`package.json` has no runtime dependencies — three.js is bundled into the
output file, not linked.

## What is in here

| file | job |
|---|---|
| `index.js`    | the scene: geometry, lighting, the camera curve, the frame loop |
| `blackhole.js`| the opening: horizon, photon ring, accretion disk shader, lensed arcs |
| `warp.js`     | the fall through the horizon — a shell of stretching light streaks |
| `stars.js`    | the sky: size distribution, diffraction spikes, per-star twinkle |
| `ocean.js`    | the reef: seabed, coral, kelp, fish, sharks, god rays, bubbles |
| `echo.js`     | the resonance motif in 3D — the transition, the sonar, the work |
| `boot.js`     | finds the canvas, maps page scroll to curve `t`, handles the fallbacks |

## The one idea

The homepage is a single connected 3D space laid out along `-Z`, and the camera
flies through it once, without a cut. Scroll position `0 → 1` maps to a point on
one `CatmullRomCurve3`, and *everything else is a function of that number*: fog
colour, light colour, tone-mapping exposure, how far the site panels have
assembled, how tall the bars have grown, how open the arrival rings are.

There is no state machine and no per-chapter animation timeline. Scrub anywhere,
resize, reload mid-page, hit the back button — the scene is always exactly what
that one scroll value says it should be.

Chapters are just named `t` ranges (`CH` in `index.js`) and the copy that sits
over them is named the same way in `index.html`. If you move a chapter's copy,
move its `t` range to match, or the camera will be looking at the wrong thing
while the words are on screen.

## Layout along -Z

```
   z ~ +18   camera start
   z  -62    the black hole, and the warp        CH.field  (fall: FALL_T0→FALL_T1)
   z -106 … -272   the reef of local businesses CH.city
   z -322    the site assembling itself          CH.assembly
   z -346 … -450   the corridor of real work     CH.gallery
   z -586    the enquiries chart                 CH.rise
   z -700    the mark, in daylight               CH.arrival
```

## Colour

Rust and navy are the brand and they anchor the ends of the flight — the night
you start in, the mark you land on. Everything in between is drawn from
`SPECTRUM` in `index.js`, a ten-stop wheel, and the rule is simple: **nothing in
the world is grey.** Take an accent with `hue(i)` rather than picking a hex.

Four things do the heavy lifting:

- **Two opposed rim lights.** A warm rose rim against a cool cyan rim gives
  every surface two differently-coloured edges and a hue gradient across the
  middle. One white rim gives you a silver edge and a flat middle.
- **Two flanking lamps that walk the wheel** as `t` advances (`lampA` / `lampB`,
  `setHSL` off the scroll value), so a surface is lit by three hues at once and
  by different ones a chapter later. Both stand down into the daylight, where
  the sky is doing the lighting.
- **`SKY` swings through the wheel too** — indigo night, electric blue, violet,
  magenta dusk, gold dawn, cream — and fog, background, key and fill all read
  from it.
- **Unlit materials for anything bioluminescent.** The lit coral is
  `MeshBasicMaterial` + `instanceColor`: the material ignores the lighting and
  paints the instance colour flat at full strength, which is one draw call for
  ten hues. (Per-instance *emissive* is impossible inside an `InstancedMesh` —
  `instanceColor` only multiplies the diffuse term.)

The reef keeps a clear corridor at `|x| < 15` for the same reason the city did:
an unlit material has no shading to sell its form, so anything that passes
within a few units of the lens reads as a flat coloured shape rather than an
object.

## Making it look real

Realism here is rendering technique, not imported meshes. Four things carry it:

- **Image-based lighting.** A metal is defined by what it reflects, so a metal
  with nothing to reflect resolves to a flat colour however you set the
  roughness. `PMREMGenerator.fromScene` builds a roughness-mipped environment
  from a handful of large emissive panels in the palette's own hues — one
  render at start-up, no bytes over the wire, and the reflections agree with
  the lighting instead of fighting it. Before this every tower and panel read
  as painted cardboard.
- **Bloom.** Everything bright in this world is emissive, and emissive geometry
  without bloom is a bright polygon with a hard edge. Desktop only: it is two
  extra full-screen passes and a phone spends that budget better on frame rate.
  Note the `OutputPass` at the end of the chain — without it the composer hands
  back a linear buffer and the page washes out by about a stop and a half.
- **Scrolling caustics.** One tiling canvas of soft blobs on the seabed's
  emissive map, offset in two directions at different speeds. It is the single
  texture that makes a flat sand plane read as submerged.
- **Sway in the vertex shader, not on the CPU.** Four hundred kelp blades
  animate for free via `onBeforeCompile`. Two things to know if you touch it:
  the amplitude is keyed to height above the holdfast, so the geometry has to
  be translated to sit at y=0 (on a centred plane, half the blade is below zero
  and never moves), and the amplitude is in LOCAL units before the instance
  scale — the first version used 0.02 and moved each blade by about a
  centimetre.

One rule worth keeping: **`toneMapped: false` is for a handful of accents,
never for a hundred lights.** It sends a colour straight to linear 1.0, above
every bloom threshold. The city's two hundred street lights used it and turned
the whole frame milky.

Bloom is also why the black hole needs restraint. Its inner lip was `exp(-rn *
13) * 2.6`; with bloom on, that smeared straight across the shadow and the hole
stopped being a hole. It is `exp(-rn * 24) * 0.85` now, and the disk starts at
1.62 horizon radii rather than 1.28 so the shadow has room to read.

## Why a reef and not a city

The city was the obvious shot for "every local business competing for one
search", which is exactly why it was dull — every agency site already has a
neon skyline. The ocean says the same thing in the brand's own language:
RESONARE is resonance, and underwater a search *is* an echo. A ping goes out
and what it finds lights up. The chapter's copy did not change a word.

`echo.js` carries that motif in three places — as the black hole's transition,
as sonar over the reef, and through the work corridor. If you add a fourth,
use the same module rather than a new ring.

## The fall

The camera path goes through the centre of the black hole. Two things follow
from that and both are easy to get wrong.

**The fall must be driven off raw `t`, not `span(t, CH.field)`.** Chapter
progress is eased, so a fall keyed to it started around `t≈0.055` — the middle
of the opening headline's full-opacity window. The shipped build showed a
seven-metre black sphere four metres from the lens, cut off by the frame,
behind live copy. `FALL_T0`/`FALL_T1` are raw curve positions chosen so the
fall begins as the headline dissolves and ends exactly where the curve reaches
the hole (`3/21 ≈ 0.143`).

**The horizon collapses, it does not grow.** Scaling it up as the camera nears
is physically the right instinct and visually a black wall. It shrinks to
nothing between fall 0.15 and 0.55 instead, which reads as diving into the
singularity, while the disk scales up and whips past — that is the part that
should feel fast. `warp.js` carries the rest.

## Rules that are load-bearing

**Nothing in the canvas may carry meaning.** Every word, number and link on the
homepage is in the DOM. The flight is atmosphere. This is why losing it costs
nothing: no WebGL, `save-data`, or under 2GB of device memory and `boot.js`
sets `body.no-world`, which swaps in a CSS gradient that keeps the same
night-to-daylight arc.

**Postprocessing is desktop-only.** Bloom is real on a laptop and absent on a
phone, where the additive glow sprites carry the job alone. Anything added to
the chain has to degrade the same way — `wantBloom` is the single switch, and
`composer` is null when it is off.

**The loop parks itself.** Out of view or tab hidden, `setActive(false)` stops
the rAF entirely. Under `prefers-reduced-motion` there is no loop at all — the
scene renders one still frame per scroll event and nothing drifts.

**Two InstancedMeshes for the city, not one.** `instanceColor` multiplies the
diffuse term only, so a per-instance emissive glow is impossible in a single
mesh. The lit buildings are their own mesh, and that is the whole point of the
chapter.
