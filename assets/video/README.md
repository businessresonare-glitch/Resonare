# Hero background videos

Four ambient loops, one per interior hero. **These ship and are switched on** —
`assets/hero.js` has `VIDEO_ENABLED = true`.

| File | Used by | Size |
|---|---|---|
| `hero-about.webm` + `.jpg` | about.html | ~367 KB |
| `hero-services.webm` + `.jpg` | services.html | ~354 KB |
| `hero-work.webm` + `.jpg` | work.html | ~515 KB |
| `hero-contact.webm` + `.jpg` | contact.html | ~401 KB |

The `.jpg` is the poster frame. It is frame 0, which is also the frame the loop
returns to, so the poster and the first painted video frame agree.

## Where they came from

Generated, not filmed — rendered from a canvas animation and encoded here.
Each is 1280×720, 20fps, 8s, VP8, no audio track at all. They are greyscale by
construction, which is the point: the site is monochrome, and dropping colour
footage behind the headline would break that in the loudest possible place.

Every motion is a function of a normalised `t` in `[0,1)` built only from
`sin`/`cos` of `2πt` or integer multiples, so **frame N and frame 0 are
identical by construction**. The loop seam is exact rather than approximately
matched, which matters because `hero.js` crossfades across it.

The generator is not checked in — it needed a browser and an ffmpeg build. To
change the look, regenerate with any tool and keep the constraints below.

## Swapping in your own footage

The heroes read a **comma-separated candidate list**, best format first:

```html
data-hero-video="assets/video/hero-about.mp4,assets/video/hero-about.webm"
```

Each becomes a `<source>`, so the browser takes the first it can decode and
skips the rest. **Only list files that exist** — a listed-but-missing source
404s on every page load.

Adding MP4 is worth doing. WebM does not play on iOS Safari before 17.4, and
those visitors currently get the 3D backdrop instead (which is fine, but the
video is nicer). H.264/MP4 plays everywhere:

```sh
ffmpeg -i source.mov -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
       -crf 26 -vf "scale=1920:-2" -movflags +faststart hero-about.mp4
ffmpeg -i hero-about.mp4 -vframes 1 -q:v 4 hero-about.jpg
```

Then add the `.mp4` token to `data-hero-video` on that page. No JS change.

## Constraints worth keeping

- **No audio track at all** (not just muted) — saves bytes, avoids autoplay
  refusals.
- **Make the last frame resemble the first.** The loop is a 500ms crossfade;
  a matching in/out point makes the seam invisible.
- **Stay dark and low-contrast.** White type sits on top of these. There is a
  scrim in `.cine-hero::after`, but it cannot rescue bright footage.
- **Target well under 4MB.** This is decoration and must not delay anything.

## How it fails, on purpose

The video is a **slot, not a dependency**, and every failure path leaves the
hero looking finished:

- **Missing, unplayable, or blocked** → the element is torn down and the 3D
  scene keeps running. `.has-video` is what stands the scene down, and it is
  only set once the video is actually decoding. Verified by aborting the
  request: video removed, canvas back to full opacity, headline visible, no
  console errors.
- **Data saver or 2G** → never requested at all.
- **Off screen or tab hidden** → paused.
- **Slow** → an 8s timeout tears it down rather than holding the hero hostage.

**It is also off the critical path.** Mounting during `DOMContentLoaded` put
the video in the `window.load` race and pushed the preloader's release out by
~190ms on throttled 4G — for a backdrop nobody is waiting on. It now mounts
after `body.loaded`, during idle time, and crossfades in on top. Measured on a
throttled Pixel 7: `window.load` 2208ms with video vs 2244ms with it blocked,
i.e. no cost. Keep it that way.
