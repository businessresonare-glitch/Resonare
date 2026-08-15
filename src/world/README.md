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
| `index.js` | the scene: geometry, lighting, the camera curve, the frame loop |
| `boot.js`  | finds the canvas, maps page scroll to curve `t`, handles the fallbacks |

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
   z  -60    the resonance rings                CH.field
   z  -84 … -238   the city of local businesses  CH.city
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
- **Unlit materials for anything that should look like neon.** The lit city
  towers are `MeshBasicMaterial` + `instanceColor`: the material ignores the
  lighting and paints the instance colour flat at full strength, which is one
  draw call for ten hues. (Per-instance *emissive* is impossible inside an
  `InstancedMesh` — `instanceColor` only multiplies the diffuse term.)

Watch the street width in the city if you touch anything there. An unlit
material has no shading to sell its form, so a tower that passes within a few
units of the lens reads as a flat coloured wall rather than a building; the
`|x| < 15` corridor exists for that reason.

## Rules that are load-bearing

**Nothing in the canvas may carry meaning.** Every word, number and link on the
homepage is in the DOM. The flight is atmosphere. This is why losing it costs
nothing: no WebGL, `save-data`, or under 2GB of device memory and `boot.js`
sets `body.no-world`, which swaps in a CSS gradient that keeps the same
night-to-daylight arc.

**No postprocessing.** Glow is an additive sprite on a camera-facing plane, not
a bloom pass. It survives on phones that would drop frames under one.

**The loop parks itself.** Out of view or tab hidden, `setActive(false)` stops
the rAF entirely. Under `prefers-reduced-motion` there is no loop at all — the
scene renders one still frame per scroll event and nothing drifts.

**Two InstancedMeshes for the city, not one.** `instanceColor` multiplies the
diffuse term only, so a per-instance emissive glow is impossible in a single
mesh. The lit buildings are their own mesh, and that is the whole point of the
chapter.
