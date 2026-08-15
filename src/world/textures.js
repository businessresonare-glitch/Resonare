/* ==========================================================================
   RESONARE — TEXTURES

   A note on resolution, because it is the first thing anyone asks for.

   16K is not available to a web page, and it is not a matter of effort. One
   16384² RGBA texture is 1.07 GB of video memory before mipmaps and about
   1.4 GB with them. WebGL reports a hard ceiling in MAX_TEXTURE_SIZE, and on
   most phones that ceiling is 4096. A page that allocated even one 16K map
   would fail to create it on the majority of devices and stall the tab on the
   rest — and the reef needs five maps, not one.

   What actually decides how sharp this looks on screen, in order of effect:

     1. multisampling. With a post-processing chain the renderer's own MSAA is
        bypassed, so every edge in the scene was aliased no matter how large
        the textures were. The composer takes a 4× multisampled target now.
     2. anisotropic filtering. The seabed is viewed at a grazing angle, which
        is the exact case trilinear filtering smears into mush. Maxed out, it
        is worth more than quadrupling the texture size.
     3. device pixel ratio.
     4. and only then, texel count.

   So the maps here are 512–1024, they are generated procedurally so they cost
   no download at all, they are tiled rather than stretched (the seabed repeats
   its caustics 6×24, which puts far more texel detail under the camera than a
   single stretched 4K map would), and every one goes through `sharpen()`.

   Generation is on the main thread during the preloader, so it is budgeted:
   about 250ms total. That budget is why the noise uses an integer hash rather
   than the usual fract(sin(dot(…))) — twenty million Math.sin calls put it
   into the seconds.
   ========================================================================== */
import {
  CanvasTexture, LinearMipmapLinearFilter, LinearFilter, RepeatWrapping,
  SRGBColorSpace
} from 'three';

let _maxAniso = 8;

/** Called once from the world with the live renderer. */
export function initTextures(renderer) {
  _maxAniso = renderer.capabilities.getMaxAnisotropy();
}

/** Every texture in the world goes through this. */
export function sharpen(tex, srgb) {
  tex.anisotropy = _maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function canvas(size, h) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = h || size;
  return cv;
}

/* ------------------------------------------------------------------ noise */
/* An integer hash, not the usual fract(sin(dot(...))). These generators call
   it about twenty million times between them, and a Math.sin per call put
   texture generation into the seconds. This is five integer ops. */
function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >> 13), 1274126177);
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, octaves) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { v += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return v;
}

/* ---------------------------------------------------------------- caustics */
/* The old one was ninety soft radial blobs at 256². Blurred over a seabed it
   read as cloud, not as light through water.

   Real caustics are the *creases* between cells of a refracting surface, so
   this is a Worley pattern where the bright value is the narrow band where
   the two nearest feature points are equidistant — F2 minus F1 near zero.
   Two octaves at different cell sizes, wrapped toroidally so it tiles. */
export function causticTexture(size) {
  const S = size || 1024;
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;

  const layer = (cells, weight, out) => {
    const step = S / cells;
    /* one feature point per grid cell — the classic Worley acceleration */
    const px = new Float32Array(cells * cells);
    const py = new Float32Array(cells * cells);
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const i = cy * cells + cx;
        px[i] = (cx + hash2(cx, cy)) * step;
        py[i] = (cy + hash2(cx + 71, cy + 13)) * step;
      }
    }
    for (let y = 0; y < S; y++) {
      const gy = Math.floor(y / step);
      for (let x = 0; x < S; x++) {
        const gx = Math.floor(x / step);
        let f1 = 1e9, f2 = 1e9;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cx = (gx + ox + cells) % cells;
            const cy = (gy + oy + cells) % cells;
            const i = cy * cells + cx;
            /* wrap the offset so the pattern tiles seamlessly */
            let dx = px[i] - x, dy = py[i] - y;
            if (dx > S / 2) dx -= S; else if (dx < -S / 2) dx += S;
            if (dy > S / 2) dy -= S; else if (dy < -S / 2) dy += S;
            /* squared until the two winners are known — nine square roots
               per pixel over four million pixels is most of the cost */
            const dist = dx * dx + dy * dy;
            if (dist < f1) { f2 = f1; f1 = dist; } else if (dist < f2) { f2 = dist; }
          }
        }
        /* the crease: bright only where the two nearest points tie */
        const edge = Math.max(0, 1 - (Math.sqrt(f2) - Math.sqrt(f1)) / (step * 0.95));
        out[y * S + x] += Math.pow(edge, 2.6) * weight;
      }
    }
  };

  const acc = new Float32Array(S * S);
  layer(28, 1.0, acc);
  layer(54, 0.55, acc);

  for (let i = 0; i < S * S; i++) {
    /* a little fine grain so the bands never look vector-clean */
    const x = (i % S) / S * 40, y = ((i / S) | 0) / S * 40;
    const v = Math.min(1, acc[i] * (0.75 + fbm(x, y, 3) * 0.6));
    const c = (v * 255) | 0;
    const o = i * 4;
    d[o] = c; d[o + 1] = c; d[o + 2] = c; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);

  const tex = new CanvasTexture(cv);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return sharpen(tex, true);
}

/* ------------------------------------------------------------ normal maps */
/* Height field → tangent-space normal by central difference. This is what
   gives the sand its ripples and the reef its pitting; without it both are
   perfectly smooth surfaces that only the silhouette distinguishes. */
function normalFromHeight(S, height, strength) {
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = height(x / S, y / S);

  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const o = (y * S + x) * 4;
      d[o]     = ((-dx / len) * 0.5 + 0.5) * 255;
      d[o + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      d[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(cv);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  /* a normal map is data, never colour — sRGB here would bend every normal */
  return sharpen(tex, false);
}

/** Wind ripples: one dominant direction, warped by low-frequency noise. */
export function sandNormal(size) {
  const S = size || 512;
  return normalFromHeight(S, (u, v) => {
    const warp = fbm(u * 3.2, v * 3.2, 3) * 1.4;
    const ripple = Math.sin((v * 34 + warp * 7)) * 0.5 + 0.5;
    return Math.pow(ripple, 1.6) * 0.8 + fbm(u * 12, v * 12, 4) * 0.3;
  }, 26);
}

/** Generic pitted rock / coral surface. */
export function rockNormal(size) {
  const S = size || 512;
  return normalFromHeight(S, (u, v) =>
    fbm(u * 14, v * 14, 5) * 0.7 + fbm(u * 46, v * 46, 3) * 0.3, 30);
}

/* ------------------------------------------------------------------- glow */
/* The shared radial sprite. It is blown up to sixty units across for the god
   rays and the halos, so 128² was visibly soft at the edges. */
export function glowTexture(size) {
  const S = size || 512;
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0.00, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,.78)');
  grd.addColorStop(0.30, 'rgba(255,255,255,.32)');
  grd.addColorStop(0.58, 'rgba(255,255,255,.08)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return sharpen(new CanvasTexture(cv), true);
}
