# Hero background videos

Drop your files here, then open `assets/hero.js` and set:

```js
var VIDEO_ENABLED = true;
```

That is the whole activation. The filenames below are already wired up.

It ships `false` so the browser never requests videos that do not exist yet —
otherwise every page load would log four 404s until you got round to it.

| File | Used by |
|---|---|
| `hero-about.mp4` + `hero-about.jpg` | about.html |
| `hero-services.mp4` + `hero-services.jpg` | services.html |
| `hero-work.mp4` + `hero-work.jpg` | work.html |
| `hero-contact.mp4` + `hero-contact.jpg` | contact.html |

The `.jpg` is the poster frame shown while the video buffers.

**If a file is absent, nothing breaks.** `assets/hero.js` only stands the 3D
scene down once the video is actually decoding, so a missing, unplayable, or
slow file simply leaves the 3D backdrop running. The hero is never a black box.

## What to encode

- **H.264 / MP4**, yuv420p — the only combination that plays everywhere
- **1920x1080** is plenty; the video is a backdrop behind a scrim
- **6–12 seconds**, and make the last frame resemble the first — the loop is a
  500ms crossfade, so a matching in/out point makes the seam invisible
- **No audio track at all** (not just muted) — it saves bytes and avoids
  autoplay problems
- **Target under 4MB.** This is decoration; it must not delay the headline

```
ffmpeg -i source.mov -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
       -crf 26 -vf "scale=1920:-2" -movflags +faststart hero-about.mp4
ffmpeg -i hero-about.mp4 -vframes 1 -q:v 4 hero-about.jpg
```

Videos are skipped automatically on data-saver and 2G connections, and pause
when the hero scrolls out of view or the tab is hidden.
