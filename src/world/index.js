/* ==========================================================================
   RESONARE — WORLD
   One continuous camera flight, scrubbed by the page scroll.

   The whole homepage is a single connected 3D space laid out along -Z. The
   camera never cuts: it hangs off a black hole, falls through it on an echo,
   crosses a reef of local businesses, enters a site as it assembles itself,
   flies a corridor of real work, rises into the light, and lands on the mark.

   Six chapters, one curve. Scroll position 0 → 1 maps to curve t 0 → 1, and
   everything else (fog colour, light colour, exposure, per-chapter object
   state) is a function of that same t. That is the whole architecture.

   Built with three.js and bundled to assets/world.js — see src/world/README.md.
   ========================================================================== */
import {
  AdditiveBlending, AmbientLight, BoxGeometry, BufferAttribute,
  BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DirectionalLight,
  DoubleSide, DynamicDrawUsage, EdgesGeometry, Fog, Group, HemisphereLight,
  InstancedMesh, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera,
  PlaneGeometry, PointLight, Points, PointsMaterial, RingGeometry,
  RepeatWrapping, SRGBColorSpace, Scene, Sphere, TextureLoader,
  Vector2, Vector3, WebGLRenderer, ACESFilmicToneMapping, PMREMGenerator
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createBlackHole } from './blackhole.js';
import { createWarp } from './warp.js';
import { createStars } from './stars.js';
import { createReef } from './ocean.js';
import { createEcho } from './echo.js';

/* ---------------------------------------------------------------- palette */
/* Rust and navy are the brand, and they anchor the flight — the mark at the
   end is rust, the night at the start is navy. Everything travelling through
   that space is drawn from a full spectrum. A world lit by one hue reads as a
   colour cast rather than a place. */
const C = {
  void:    0x05041F,
  navy:    0x0A0952,
  navyLit: 0x241FA8,
  rust:    0xB52F24,
  ember:   0xFF6B35,
  gold:    0xFFB627,
  cream:   0xF6F2E9,
  ink:     0x0B0A1E,

  rose:    0xFF3B6B,
  magenta: 0xFF4FD8,
  violet:  0xA95CFF,
  indigo:  0x6C63FF,
  azure:   0x2E8BFF,
  cyan:    0x27D8FF,
  mint:    0x2EE6A8,
  lime:    0xB6FF3B
};

/* The wheel, in the order the flight walks it. Every chapter draws its
   accents from here by index, so nothing in the world is ever grey. */
const SPECTRUM = [
  C.rose, C.ember, C.gold, C.lime, C.mint, C.cyan, C.azure, C.indigo,
  C.violet, C.magenta
];
const hue = i => SPECTRUM[((i % SPECTRUM.length) + SPECTRUM.length) % SPECTRUM.length];

/* Atmosphere keyframes. The journey runs indigo night → electric blue →
   violet → magenta dusk → gold dawn → daylight, and the key/fill lights swing
   across the wheel with it. Fog and background share one colour so the horizon
   never shows a seam. */
const SKY = [
  { t: 0.00, sky: 0x06052A, key: 0x6C63FF, amb: 0x2A1C8E, exposure: 0.98 },
  { t: 0.14, sky: 0x03182E, key: 0x8FE8FF, amb: 0x0A3A5E, exposure: 1.02 },
  { t: 0.24, sky: 0x064A66, key: 0xBFF2FF, amb: 0x0E5A7C, exposure: 1.08 },
  { t: 0.36, sky: 0x0A7290, key: 0xDFFAFF, amb: 0x1478A0, exposure: 1.10 },
  { t: 0.48, sky: 0x1A2E80, key: 0xFFFFFF, amb: 0x3A34A8, exposure: 1.06 },
  { t: 0.62, sky: 0x2A0F82, key: 0xFFFFFF, amb: 0x5535C4, exposure: 1.04 },
  { t: 0.72, sky: 0x4A1478, key: 0xFFE0F4, amb: 0x7A2FB0, exposure: 1.02 },
  { t: 0.80, sky: 0x9E2A80, key: 0xFFB07A, amb: 0xB84A8A, exposure: 1.02 },
  { t: 0.87, sky: 0xE8834A, key: 0xFFE9C4, amb: 0xE0A070, exposure: 1.02 },
  { t: 0.93, sky: 0xF6F2E9, key: 0xFFFFFF, amb: 0xE8DFCC, exposure: 1.00 },
  { t: 1.00, sky: 0xF6F2E9, key: 0xFFFFFF, amb: 0xE8DFCC, exposure: 1.00 }
];

/* Where each chapter lives on the curve. Objects read their own local
   0 → 1 progress out of this so a chapter can animate independently. */
/* The window, in raw curve position, over which the camera falls through the
   black hole. The curve reaches it at 3/21. */
const FALL_T0 = 0.086;
const FALL_T1 = 0.143;

const CH = {
  field:    [0.00, 0.15],
  city:     [0.13, 0.40],
  assembly: [0.33, 0.57],
  gallery:  [0.54, 0.76],
  rise:     [0.64, 0.84],
  arrival:  [0.84, 0.97]
};

/* ------------------------------------------------------------- the flight */
const PATH = [
  [  0.0,  1.8,   18], [  0.0,  1.5,  -16], [  0.8,  0.9,  -44],
  [  0.0,  0.0,  -62], [ -1.8,  3.4,  -80], [ -7.0, 15.0, -106],
  [  6.0, 11.0, -142], [  3.4,  5.0, -178], [  0.0,  2.8, -210],
  [  0.0,  2.3, -248], [  0.0,  1.7, -292], [  0.0,  1.3, -324],
  [  0.0,  1.1, -354], [  1.4,  1.5, -398], [ -1.4,  1.7, -442],
  [  0.0,  3.2, -476], [  0.0, 10.5, -508], [  0.0, 18.5, -542],
  [  0.0, 21.0, -578], [  0.0, 14.5, -610], [  0.0,  6.5, -638],
  [  0.0,  4.2, -654]
];
const LOOK = [
  [  0.0,  1.0,  -58], [  0.0,  0.6,  -76], [  0.0,  0.0,  -94],
  [  0.0,  0.4, -112], [ -2.5,  2.0, -140], [  2.5,  1.4, -178],
  [  0.0,  1.2, -214], [  0.0,  1.2, -252], [  0.0,  1.2, -292],
  [  0.0,  1.2, -324], [  0.0,  1.0, -352], [  0.0,  1.0, -392],
  [  1.2,  1.2, -434], [ -1.2,  1.4, -472], [  0.0,  4.5, -502],
  [  0.0, 14.0, -536], [  0.0, 21.0, -562], [  0.0, 17.0, -598],
  [  0.0,  9.0, -628], [  0.0,  4.5, -660], [  0.0,  4.0, -690],
  [  0.0,  4.0, -700]
];

/* ----------------------------------------------------------------- helpers */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
/* local 0→1 progress for a chapter, eased at both ends */
const span = (t, [a, b]) => smooth(clamp((t - a) / (b - a), 0, 1));

function curve(points) {
  return new CatmullRomCurve3(points.map(p => new Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.4);
}

/* Sample the atmosphere table. Writes into the supplied Color to stay
   allocation-free inside the frame loop. */
function sampleSky(t, outSky, outKey, outAmb) {
  let i = 0;
  while (i < SKY.length - 2 && t > SKY[i + 1].t) i++;
  const a = SKY[i], b = SKY[i + 1];
  const k = smooth(clamp((t - a.t) / (b.t - a.t), 0, 1));
  outSky.setHex(a.sky).lerp(_c1.setHex(b.sky), k);
  outKey.setHex(a.key).lerp(_c1.setHex(b.key), k);
  outAmb.setHex(a.amb).lerp(_c1.setHex(b.amb), k);
  return lerp(a.exposure, b.exposure, k);
}
const _c1 = new Color();

/* A soft radial sprite, drawn once. Every glow in the world is this texture
   on an additive plane — cheaper and steadier than a bloom pass, and it
   survives on phones that would drop frames under postprocessing. */
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const s = 128, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0.00, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,.62)');
  grd.addColorStop(0.45, 'rgba(255,255,255,.16)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  _glowTex = new CanvasTexture(cv);
  _glowTex.colorSpace = SRGBColorSpace;
  return _glowTex;
}

/* ==========================================================================
   FACADE TEXTURE

   A tower is a stretched cube. Lit flat it reads as a coloured brick, and 760
   coloured bricks read as a bar chart, not a city. What sells it as a building
   is windows: a grid of small emissive cells, most of them off, a few on, at a
   density the eye reads as floors.

   Drawn once into one canvas and shared by every tower — the instances vary by
   colour and scale, and the stretching that causes is what gives the skyline
   its variety of floor heights for free.
   ========================================================================== */
let _facadeTex = null;
function facadeTexture() {
  if (_facadeTex) return _facadeTex;
  const w = 256, h = 512, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#05041a';
  g.fillRect(0, 0, w, h);

  const cols = 10, rows = 34;
  const cw = w / cols, ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = Math.random();
      /* Windows come in runs — a whole floor lit, then three dark. Random
         per-cell noise reads as static; runs read as occupancy. */
      const floorLit = (y * 7919 % 11) < 4;
      const lit = floorLit ? on < 0.72 : on < 0.14;
      const v = lit ? 0.55 + Math.random() * 0.45 : 0.02 + Math.random() * 0.05;
      g.fillStyle = `rgba(255,255,255,${v.toFixed(3)})`;
      g.fillRect(x * cw + cw * 0.18, y * ch + ch * 0.22, cw * 0.64, ch * 0.5);
    }
  }
  _facadeTex = new CanvasTexture(cv);
  _facadeTex.colorSpace = SRGBColorSpace;
  _facadeTex.wrapS = _facadeTex.wrapT = RepeatWrapping;
  return _facadeTex;
}

function glowPlane(size, color, opacity) {
  const m = new Mesh(
    new PlaneGeometry(size, size),
    new MeshBasicMaterial({
      map: glowTexture(), color, transparent: true, opacity,
      blending: AdditiveBlending, depthWrite: false, fog: false
    })
  );
  m.renderOrder = 3;
  return m;
}

/* Rounded-rectangle card texture. Used for the review slabs so the copy in
   the 3D space is the real copy, not lorem geometry. */
function cardTexture(quote, name, role, tone) {
  const w = 512, h = 340, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const ink = '#' + tone.toString(16).padStart(6, '0');

  /* a tinted card, not a white one, with a solid colour spine down its left
     edge — three white rectangles floating in a coloured world looked like
     three holes punched in it */
  const wash = g.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, '#FFFFFF');
  wash.addColorStop(1, ink + '22');
  g.fillStyle = wash;
  g.fillRect(0, 0, w, h);
  g.fillStyle = ink;
  g.fillRect(0, 0, 12, h);

  for (let i = 0; i < 5; i++) star(g, 52 + i * 26, 48, 9);

  g.fillStyle = '#0B0A1E';
  g.font = '500 25px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
  wrap(g, quote, 46, 112, w - 88, 34);

  g.fillStyle = ink;
  g.font = '700 19px ui-sans-serif, system-ui, sans-serif';
  g.fillText(name, 46, h - 66);
  g.fillStyle = '#6A6980';
  g.font = '400 17px ui-sans-serif, system-ui, sans-serif';
  g.fillText(role, 46, h - 38);

  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;

  function star(ctx, cx, cy, r) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }
  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = word; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, yy);
  }
}

/* ==========================================================================
   WORLD
   ========================================================================== */
export function createWorld(canvas, opts) {
  const options = opts || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 820;
  const quality = small ? 0.6 : 1;

  /* Probe on a throwaway canvas first. WebGLRenderer console.errors twice
     before it throws, and a browser without WebGL is a supported outcome
     here, not a fault worth logging. */
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  } catch (err) {
    return null;
  }

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas, antialias: !small, alpha: false, powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    });
  } catch (err) {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.85));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const skyColor = new Color(C.void);
  const keyColor = new Color(C.ember);
  const ambColor = new Color(C.navyLit);
  scene.background = skyColor;
  scene.fog = new Fog(skyColor, 16, small ? 150 : 190);

  const camera = new PerspectiveCamera(58, 1, 0.1, 900);
  const camPath = curve(PATH);
  const lookPath = curve(LOOK);

  /* ============================================== IMAGE-BASED LIGHTING =====
     The single biggest step from "3D graphics" to "photograph". A metal is
     defined by what it reflects, so a metal with nothing to reflect resolves
     to a flat colour no matter how the roughness is set — which is why every
     tower and every panel read as painted cardboard before this.

     The environment is built here rather than loaded: a handful of large
     emissive planes in the palette's own hues, prefiltered by PMREM into a
     roughness-mipped cube map. It costs one render at start-up, no bytes over
     the wire, and it is the same colours the flight is lit by, so reflections
     agree with the lighting instead of fighting it. */
  {
    const pmrem = new PMREMGenerator(renderer);
    const envScene = new Scene();
    envScene.background = new Color(0x0A0838);
    const panel = (color, x, y, z, w, h, intensity) => {
      const m = new Mesh(
        new PlaneGeometry(w, h),
        new MeshBasicMaterial({ color, side: DoubleSide, toneMapped: false })
      );
      m.material.color.multiplyScalar(intensity);
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    /* a key, two coloured kickers, a warm bounce off the floor and a rim */
    panel(0xFFFFFF, 0, 14, -10, 20, 12, 3.2);
    panel(C.magenta, -16, 2, 6, 22, 26, 2.4);
    panel(C.cyan, 16, 4, 4, 22, 26, 2.2);
    panel(C.gold, 0, -12, -6, 30, 14, 1.4);
    panel(C.violet, 0, 6, 18, 26, 20, 1.6);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 1.15;
    pmrem.dispose();
    envScene.traverse(o => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } });
  }

  /* =========================================================== BLOOM ======
     Every bright thing in this world is emissive — neon towers, the light
     rails, the accretion disk — and emissive geometry without bloom is just a
     bright polygon with a hard edge. Bloom is what makes it read as light
     coming off a surface rather than paint on one.

     Desktop only. It is two extra full-screen passes at half resolution and a
     phone spends that budget better on frame rate; there, the additive glow
     sprites carry the job on their own. */
  let composer = null, bloom = null;
  const wantBloom = !small && !reduced;
  if (wantBloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.34, 0.72, 0.86);
    composer.addPass(bloom);
    /* tone mapping and colour space move to the end of the chain; without
       this the composer hands back a linear buffer and the whole page washes
       out by about a stop and a half */
    composer.addPass(new OutputPass());
  }

  /* -------------------------------------------------------------- lighting */
  const hemi = new HemisphereLight(C.cyan, C.magenta, 1.15);
  scene.add(hemi);
  const amb = new AmbientLight(ambColor, 0.85);
  scene.add(amb);
  const key = new DirectionalLight(keyColor, 2.2);
  key.position.set(12, 26, 10);
  scene.add(key);
  /* Two rims from opposite sides in opposing hues. One white rim gives you a
     silver edge on everything; a warm rim against a cool rim gives every
     surface in the world two different coloured edges and a hue gradient
     across the middle, which is most of what makes the flight read as
     colourful rather than tinted. */
  const rimWarm = new DirectionalLight(C.rose, 1.5);
  rimWarm.position.set(-18, 8, -30);
  scene.add(rimWarm);
  const rimCool = new DirectionalLight(C.cyan, 1.3);
  rimCool.position.set(20, -6, -14);
  scene.add(rimCool);

  /* Travels with the camera so nothing the flight passes goes flat black. */
  const lamp = new PointLight(0xFFE0C4, 22, 110, 2);
  scene.add(lamp);
  /* Two more lamps flanking it, cycling around the wheel as the flight
     advances, so a surface the camera passes is lit from three hues at once
     and never resolves to a single flat colour. */
  const lampA = new PointLight(C.magenta, 22, 120, 2);
  const lampB = new PointLight(C.cyan, 22, 120, 2);
  scene.add(lampA, lampB);

  /* ============================================== CHAPTER 1 — THE FIELD */
  const field = new Group();
  scene.add(field);

  /* The opening is a supermassive black hole — see blackhole.js. The camera
     holds off it for the length of the headline, then falls straight through
     the horizon into the city. */
  const blackHole = createBlackHole({ horizon: 8, outer: 30, mid: 0xFFA23C, cool: C.rust });
  /* Below the copy, not behind it. With the type centred, a horizon sitting
     at the camera's own eye line lands squarely under the lede and the
     buttons; dropped fifteen metres it reads as something the flight is
     passing over, and the disk arcs up behind the headline instead. */
  blackHole.group.position.set(0, -32, -64);
  field.add(blackHole.group);

  /* the streaks the fall turns into — see warp.js */
  const warp = createWarp({ z: -62, quality, hue });
  field.add(warp.mesh);

  /* And the echo it leaves behind. The hole collapses, the echo washes out
     over the camera, and the reef is on the other side of it — which is how
     the black hole stops existing instead of hanging in front of the next
     chapter the way it did before. */
  const transition = createEcho({
    count: 5, radius: 90, thickness: 0.006, colors: [0xFFF3DE, C.gold, C.ember, C.cyan, C.mint]
  });
  transition.group.position.set(0, -18, -62);
  field.add(transition.group);

  /* Debris caught in the hole's gravity, one shard per spectrum stop. */
  const shards = new Group();
  shards.position.set(0, 0, -58);
  field.add(shards);
  for (let i = 0; i < 14; i++) {
    const c = hue(i);
    const s = new Mesh(
      new BoxGeometry(0.45 + Math.random() * 1.0, 0.45 + Math.random() * 1.0, 0.35),
      new MeshStandardMaterial({
        color: c, emissive: c, emissiveIntensity: 0.75,
        roughness: 0.25, metalness: 0.5
      })
    );
    const a = (i / 14) * Math.PI * 2;
    const rad = 17 + Math.random() * 26;
    s.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.7, (Math.random() - 0.5) * 40);
    s.userData.spin = (Math.random() - 0.5) * 1.2;
    s.userData.phase = Math.random() * 6.28;
    s.userData.baseY = s.position.y;
    shards.add(s);
  }

  /* one soft bloom seed behind the hole so the horizon reads against the
     void even before the disk resolves */
  const ringGlow = glowPlane(58, 0xFF9A4C, 0.16);
  ringGlow.position.set(0, 0, -70);
  field.add(ringGlow);

  /* A real sky rather than coloured dust — sizes, diffraction spikes and
     per-star twinkle. See stars.js. */
  const stars = createStars({ count: Math.round(3400 * quality), spectrum: SPECTRUM });
  scene.add(stars.points);

  /* ============================================== CHAPTER 2 — THE REEF */
  /* Was a neon city. See ocean.js for why it is not any more: a search IS an
     echo, and "most of them never light up" is literally true of a reef at
     depth. The chapter's copy did not change a word. */
  const REEF_Z0 = -106, REEF_Z1 = -272;
  const reef = createReef({ z0: REEF_Z0, z1: REEF_Z1, hue, quality, width: 230, glow: glowTexture() });
  const city = reef.group;
  scene.add(city);

  /* sonar: the ping that goes out and finds them */
  const sonar = createEcho({
    count: 3, radius: 62, thickness: 0.008, period: 4.6,
    colors: [C.cyan, C.mint, C.azure]
  });
  sonar.group.position.set(0, 9, (REEF_Z0 + REEF_Z1) / 2 + 30);
  city.add(sonar.group);

  /* ============================================ CHAPTER 3 — THE ASSEMBLY */
  /* A website building itself: panels scattered in the dark converge into a
     layout, then open up as the camera flies through the screen. */
  const assembly = new Group();
  assembly.position.set(0, 0, -322);
  scene.add(assembly);

  /* x, y, w, h, colour. A real page is not eleven grey boxes and one accent —
     it is a palette. Each panel is a different stop on the wheel, with the
     wide header and footer bars kept pale so the composition still reads as
     a page rather than a swatch chart. */
  const LAYOUT = [
    [  0.0,  7.6, 30.0, 1.5, C.cream  ], [-11.5,  4.2,  7.0, 3.6, C.magenta],
    [ -2.0,  4.6, 14.0, 4.6, C.ember  ], [  9.5,  4.4,  9.0, 4.2, C.cyan   ],
    [-11.5, -0.4,  7.0, 5.4, C.gold   ], [ -2.0, -1.0, 14.0, 6.2, C.violet ],
    [  9.5, -0.6,  9.0, 5.8, C.mint   ], [-11.5, -6.2,  7.0, 4.4, C.azure  ],
    [ -2.0, -6.6, 14.0, 3.6, C.rose   ], [  9.5, -6.4,  9.0, 4.0, C.lime   ],
    [  0.0, -10.4, 30.0, 2.0, C.cream ]
  ];
  /* The camera meets this slab from about 90 units out, where the original
     30-unit page occupied a fifth of the frame and the scatter threw half its
     panels past the edges — the chapter opened on an empty screen with a few
     coloured chips in the corner. Scaled up, it is a wall of colour that
     resolves into a page as you approach it. */
  const S = 1.34;
  const panels = [];
  for (const [x0, y0, w0, h0, tone] of LAYOUT) {
    const x = x0 * S, y = y0 * S, w = w0 * S, h = h0 * S;
    const pale = tone === C.cream;
    const mat = new MeshStandardMaterial({
      color: tone,
      emissive: tone,
      emissiveIntensity: pale ? 0.18 : 0.62,
      roughness: 0.2, metalness: 0.6, envMapIntensity: 1.5,
      transparent: true, opacity: 1, side: DoubleSide
    });
    const p = new Mesh(new PlaneGeometry(w, h), mat);
    p.userData.home = new Vector3(x, y, 0);
    /* Scattered around the layout, not behind it: an earlier version threw
       the panels 70–160 units down -Z, which put them past the fog wall, so
       the chapter opened on an empty navy screen and the site only appeared
       once it had already finished assembling. */
    p.userData.away = new Vector3(
      x + (Math.random() - 0.5) * 30,
      y + (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 40 - 10
    );
    p.userData.spin = (Math.random() - 0.5) * 2.4;
    assembly.add(p);
    panels.push(p);
  }
  const siteFrame = new LineSegments(
    new EdgesGeometry(new BoxGeometry(33 * S, 22 * S, 0.8)),
    new LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0, toneMapped: false })
  );
  assembly.add(siteFrame);
  /* Three glows behind the slab in three hues, offset from each other, so the
     halo around the assembled page is a gradient instead of one gold wash. */
  const assemblyGlows = [
    [C.magenta, -18, 6], [C.cyan, 18, 3], [C.gold, 0, -12]
  ].map(([c, gx, gy]) => {
    const g = glowPlane(60, c, 0);
    g.position.set(gx, gy, -4);
    assembly.add(g);
    return g;
  });

  /* ============================================= CHAPTER 4 — THE GALLERY */
  const gallery = new Group();
  scene.add(gallery);

  const SHOTS = options.shots || [];
  const loader = new TextureLoader();
  /* Spread down the whole corridor rather than bunched at the entrance —
     packed tighter, the flight cleared the last screen a third of the way in
     and spent the rest of the chapter looking at empty fog. */
  const GAL_Z0 = -346, GAL_STEP = 26;
  SHOTS.forEach((src, i) => {
    const side = i % 2 ? 1 : -1;
    const z = GAL_Z0 - i * GAL_STEP;
    const w = 13.5, h = w / 1.746;

    /* Each screenshot gets its own coloured frame and its own coloured halo —
       a corridor of black-bezelled screens is a corridor of black rectangles
       between the moments a shot is square-on to the camera. */
    const tone = hue(i * 2 + 1);
    const backing = new Mesh(
      new PlaneGeometry(w + 0.8, h + 0.8),
      new MeshStandardMaterial({
        color: tone, emissive: tone, emissiveIntensity: 0.45,
        roughness: 0.16, metalness: 0.86, envMapIntensity: 1.6, side: DoubleSide
      })
    );
    const shot = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: 0x1A1830, side: DoubleSide })
    );
    shot.position.z = 0.06;
    backing.add(shot);
    backing.position.set(side * 9.6, 1.6 + (i % 3) * 1.1, z);
    backing.rotation.y = -side * 0.42;
    backing.userData.float = Math.random() * 6.28;
    backing.userData.baseY = backing.position.y;
    gallery.add(backing);
    const halo = glowPlane(w * 1.8, tone, 0.34);
    halo.position.set(side * 10.4, backing.position.y, z - 0.6);
    gallery.add(halo);

    loader.load(src, tex => {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      shot.material.map = tex;
      shot.material.color.setHex(0xffffff);
      shot.material.needsUpdate = true;
    }, undefined, () => { /* a missing screenshot leaves a dark slab, not a hole */ });
  });
  /* a tube of light down the corridor centre */
  {
    /* Two light rails down the corridor in opposing hues, floor and ceiling,
       so the space between the screens is lit rather than empty. */
    [[-3.4, C.magenta], [6.8, C.cyan]].forEach(([y, c]) => {
      const rail = new Mesh(
        new BoxGeometry(0.32, 0.32, 190),
        new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, fog: false, toneMapped: false })
      );
      rail.position.set(0, y, GAL_Z0 - 68);
      gallery.add(rail);
    });
  }

  /* =============================================== CHAPTER 5 — THE RISE */
  const rise = new Group();
  rise.position.set(0, 0, -586);
  scene.add(rise);
  /* The chart climbs the wheel as it climbs: violet at the low end through to
     gold at the top. The rising line is the point of the chapter, and a
     spectrum makes the rise legible from any distance. */
  const BAR_HUES = [
    C.violet, C.indigo, C.azure, C.cyan, C.mint, C.lime, C.gold, C.ember, C.rose
  ];
  const bars = [];
  for (let i = 0; i < 9; i++) {
    const target = 6 + Math.pow(i / 8, 1.55) * 34;
    const c = BAR_HUES[i];
    const bar = new Mesh(
      new BoxGeometry(3.2, 1, 3.2),
      new MeshStandardMaterial({
        color: c, emissive: c,
        emissiveIntensity: 0.5, roughness: 0.12, metalness: 0.9, envMapIntensity: 1.7
      })
    );
    bar.position.set(-20 + i * 5, 0, 0);
    bar.userData.target = target;
    bar.userData.tone = c;
    rise.add(bar);
    bars.push(bar);

    /* a matching halo behind each column */
    const halo = glowPlane(16, c, 0.3);
    halo.position.set(bar.position.x, 0, -3);
    bar.userData.halo = halo;
    rise.add(halo);
  }
  rise.add(gridLines(150, 70, 14, 7, 0, null, 0.4));

  /* ============================================ CHAPTER 6 — THE ARRIVAL */
  const arrival = new Group();
  arrival.position.set(0, 6.5, -700);
  scene.add(arrival);
  /* The resonance rings, echoing outward in the same order the opening rings
     ran — so the flight ends on the shape it started with, in the same hues,
     now on daylight instead of night. The centre dot stays brand rust: it is
     the logo, and it is the one thing here that is not up for reinterpretation. */
  const MARK_HUES = [C.rust, C.magenta, C.violet, C.azure, C.mint];
  const markRings = [];
  for (let i = 0; i < 5; i++) {
    const ring = new Mesh(
      new RingGeometry(4.4 + i * 5.0, 5.02 + i * 5.0, 128),
      new MeshBasicMaterial({
        color: MARK_HUES[i], transparent: true, opacity: 0.9 - i * 0.08,
        side: DoubleSide, fog: false
      })
    );
    ring.userData.delay = i * 0.13;
    arrival.add(ring);
    markRings.push(ring);
  }
  /* the dot at the centre of the logo, at the end of the flight */
  const markCore = new Mesh(
    new RingGeometry(0, 1.5, 64),
    new MeshBasicMaterial({ color: C.rust, side: DoubleSide, fog: false })
  );
  arrival.add(markCore);

  /* Fixed slots rather than a ring of them: on a circle one card always ends
     up dead centre, directly behind the call-to-action. */
  const CARD_SLOTS = [[-25, 2, 18], [25, -9, 12], [-21, -12, 26], [23, 11, 20]];
  const CARD_HUES = [C.magenta, C.azure, C.ember, C.mint];
  const cards = [];
  (options.reviews || []).forEach((r, i) => {
    const tex = cardTexture(r.quote, r.name, r.role, CARD_HUES[i % CARD_HUES.length]);
    const card = new Mesh(
      new PlaneGeometry(12.5, 8.3),
      new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: DoubleSide })
    );
    const [sx, sy, sz] = CARD_SLOTS[i % CARD_SLOTS.length];
    card.position.set(sx, sy, sz);
    card.rotation.set(-0.05, sx > 0 ? -0.3 : 0.3, (i % 2 ? 1 : -1) * 0.05);
    card.userData.float = Math.random() * 6.28;
    card.userData.baseY = card.position.y;
    arrival.add(card);
    cards.push(card);
  });

  /* a backdrop so the cream horizon reads as sky, not as empty clear colour */
  const dome = new Mesh(
    new PlaneGeometry(600, 380),
    new MeshBasicMaterial({ color: C.cream, transparent: true, opacity: 0, side: DoubleSide, fog: false })
  );
  dome.position.set(0, 20, -770);
  scene.add(dome);

  /* -------------------------------------------------------------- utility */
  /* `color: null` paints the grid across the spectrum instead of one hue —
     each line takes the next stop on the wheel, vertex-coloured. */
  function gridLines(w, d, cols, rows, z, color, opacity) {
    const pts = [], cols3 = [];
    const c = new Color();
    let n = 0;
    const push = (x1, z1, x2, z2) => {
      pts.push(x1, 0, z1, x2, 0, z2);
      if (color === null) {
        c.setHex(hue(n++));
        cols3.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    };
    for (let i = 0; i <= cols; i++) {
      const x = -w / 2 + (w / cols) * i;
      push(x, z - d / 2, x, z + d / 2);
    }
    for (let j = 0; j <= rows; j++) {
      const zz = z - d / 2 + (d / rows) * j;
      push(-w / 2, zz, w / 2, zz);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    if (color === null) geo.setAttribute('color', new BufferAttribute(new Float32Array(cols3), 3));
    return new LineSegments(geo, new LineBasicMaterial({
      color: color === null ? 0xffffff : color,
      vertexColors: color === null,
      transparent: true, opacity
    }));
  }

  /* ================================================================ loop */
  let target = 0;      /* scroll progress, written from outside */
  let current = 0;     /* damped follower — this is what the camera reads */
  let mouseX = 0, mouseY = 0, mx = 0, my = 0;
  let running = false, visible = true, raf = 0, last = performance.now();
  let clock = 0;

  const camPos = new Vector3();
  const lookPos = new Vector3();
  const aim = new Vector3();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    /* Clamped so a stalled tab does not jump the flight, but not so tightly
       that a slow device starves the damped follower: at 20fps a 0.05 ceiling
       let the camera trail the scrollbar by a visible second. */
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!visible) return;

    /* Critically damped follow. The rate is frame-rate independent so a
       120Hz display and a 30Hz phone settle over the same wall time. */
    const k = 1 - Math.pow(0.0022, dt);
    current += (target - current) * (reduced ? 1 : k);
    if (Math.abs(target - current) < 0.00002) current = target;
    clock += dt;

    mx += (mouseX - mx) * (1 - Math.pow(0.002, dt));
    my += (mouseY - my) * (1 - Math.pow(0.002, dt));

    render(current, dt);
  }

  function render(t, dt) {
    /* ---- camera ---- */
    camPath.getPoint(clamp(t, 0, 1), camPos);
    lookPath.getPoint(clamp(t, 0, 1), lookPos);
    camera.position.copy(camPos);
    camera.position.x += mx * 1.6;
    camera.position.y += my * 0.9;
    aim.copy(lookPos);
    aim.x += mx * 2.2;
    aim.y += my * 2.2;
    camera.lookAt(aim);
    /* a slow roll so long straights never feel like a slideshow */
    camera.rotation.z += Math.sin(t * 9.0) * 0.035 + mx * 0.05;
    lamp.position.copy(camera.position);

    /* ---- atmosphere ---- */
    const exposure = sampleSky(t, skyColor, keyColor, ambColor);
    scene.fog.color.copy(skyColor);
    /* Visibility closes right down under water and opens again as the flight
       surfaces. Fog is doing the job a depth-of-field pass would, for free. */
    const submerged = Math.min(span(t, [0.15, 0.26]), 1 - span(t, [0.40, 0.50]));
    scene.fog.far = lerp(small ? 150 : 190, small ? 88 : 112, submerged);
    key.color.copy(keyColor);
    amb.color.copy(ambColor);
    hemi.color.copy(skyColor).lerp(_c1.setHex(C.cyan), 0.55);
    hemi.groundColor.copy(skyColor).lerp(_c1.setHex(C.magenta), 0.45);
    renderer.toneMappingExposure = exposure;

    /* The two flanking lamps walk the wheel as the flight advances — a
       surface the camera passes is lit by three hues at once, and by
       different ones a chapter later. Both stand down into the daylight,
       where the sky is doing the lighting. */
    const daylight = smooth(clamp((t - 0.80) / 0.16, 0, 1));
    lamp.intensity = lerp(24, 5, daylight);
    const spin = t * 6.2 + clock * 0.12;
    lampA.color.setHSL((spin % 1), 0.85, 0.6);
    lampB.color.setHSL(((spin + 0.42) % 1), 0.85, 0.62);
    lampA.position.set(camera.position.x - 10, camera.position.y + 5, camera.position.z - 6);
    lampB.position.set(camera.position.x + 10, camera.position.y - 3, camera.position.z - 6);
    lampA.intensity = lampB.intensity = lerp(20, 0, daylight);
    /* Stars fade out under water as well as into daylight — a starfield seen
       through forty metres of ocean is the one thing that breaks the shot. */
    stars.update(clock, renderer.getPixelRatio(), Math.max(daylight, submerged));
    rimWarm.intensity = lerp(1.5, 0.5, daylight);
    rimCool.intensity = lerp(1.3, 0.4, daylight);
    if (bloom) {
      const fallFlash = smooth(clamp((t - FALL_T0) / (FALL_T1 - FALL_T0), 0, 1));
      /* strong through the black hole and the neon city, restrained once the
         sky turns — bloom on a cream sky is just fog */
      bloom.strength = lerp(0.36, 0.18, daylight) + fallFlash * 0.34;
      bloom.threshold = lerp(0.86, 0.94, daylight);
    }

    /* ---- ch.1 field ---- */
    const pField = span(t, CH.field);
    /* FALL_T0/FALL_T1 are raw curve positions, not eased chapter progress.
       Driving this off span() put the fall at t≈0.055 — right in the middle
       of the opening headline's full-opacity window, which is why the shipped
       build showed a giant cut-off black sphere behind live copy. The camera
       reaches the hole at t = 3/21 ≈ 0.143, so the fall now runs from just
       after the headline starts dissolving to exactly that arrival. */
    const fall = smooth(clamp((t - FALL_T0) / (FALL_T1 - FALL_T0), 0, 1));
    blackHole.update(dt, clock, fall, camera);
    warp.update(fall);
    transition.update(clock, camera, Math.sin(Math.PI * clamp(fall, 0, 1)), fall);
    shards.children.forEach((s, i) => {
      s.rotation.x += s.userData.spin * dt;
      s.rotation.y += s.userData.spin * dt * 0.7;
      s.position.y = s.userData.baseY + Math.sin(clock * 0.6 + s.userData.phase) * 1.6;
      s.material.emissiveIntensity = 0.22 * (1 - pField * 0.6);
    });
    ringGlow.material.opacity = 0.16 * (1 - pField);
    ringGlow.lookAt(camera.position);

    /* ---- ch.2 city ---- */
    const pCity = span(t, CH.city);
    if (city.visible) reef.update(clock, camera);
    sonar.update(clock, camera, pCity * (1 - pCity * 0.3));

    /* ---- ch.3 assembly ---- */
    const pAsm = span(t, CH.assembly);
    /* converge over the first 60%, then open up and let the camera through —
       fully gone by the time the gallery corridor starts, or a half-faded
       30-unit panel hangs over the first screenshot */
    const build = smooth(clamp(pAsm / 0.6, 0, 1));
    const open = smooth(clamp((pAsm - 0.66) / 0.2, 0, 1));
    for (const p of panels) {
      const home = p.userData.home, away = p.userData.away;
      p.position.set(
        lerp(away.x, home.x, build) * (1 + open * 2.6),
        lerp(away.y, home.y, build) * (1 + open * 2.6),
        lerp(away.z, home.z, build) - open * 26
      );
      p.rotation.z = lerp(p.userData.spin, 0, build);
      p.rotation.y = lerp(p.userData.spin * 0.6, 0, build);
      p.material.opacity = Math.min(build * 1.4, 1) * (1 - open);
    }
    siteFrame.material.opacity = build * 0.8 * (1 - open);
    siteFrame.rotation.y = Math.sin(clock * 0.3) * 0.04;
    assemblyGlows.forEach((g, i) => {
      g.material.opacity = build * 0.42 * (1 - open) * (0.7 + 0.3 * Math.sin(clock * 0.7 + i * 2.1));
    });

    /* ---- ch.4 gallery ---- */
    gallery.children.forEach(o => {
      if (o.userData.baseY === undefined) return;
      o.position.y = o.userData.baseY + Math.sin(clock * 0.55 + o.userData.float) * 0.5;
    });

    /* ---- ch.5 rise ---- */
    const pRise = span(t, CH.rise);
    bars.forEach((b, i) => {
      const local = smooth(clamp((pRise - i * 0.045) / 0.5, 0, 1));
      const h = Math.max(0.001, b.userData.target * local);
      b.scale.y = h;
      b.position.y = h / 2;
      b.material.emissiveIntensity = 0.35 + local * 0.75;
      const halo = b.userData.halo;
      halo.scale.setScalar(0.5 + local * 1.6);
      halo.position.y = h * 0.6;
      halo.material.opacity = 0.34 * local;
      halo.lookAt(camera.position);
    });

    /* ---- ch.6 arrival ---- */
    const pArr = span(t, CH.arrival);
    markRings.forEach((r, i) => {
      const w = smooth(clamp((pArr - r.userData.delay) / 0.42, 0, 1));
      r.scale.setScalar(0.62 + w * 0.38);
      r.material.opacity = w * (0.9 - i * 0.08);
      r.rotation.z += dt * 0.06 * (i % 2 ? 1 : -1);
    });
    markCore.scale.setScalar(0.2 + pArr * 0.8);
    markCore.material.opacity = pArr;
    markCore.material.transparent = true;
    cards.forEach((c, i) => {
      const w = smooth(clamp((pArr - 0.1 - i * 0.07) / 0.4, 0, 1));
      c.material.opacity = w;
      c.position.y = c.userData.baseY + Math.sin(clock * 0.5 + c.userData.float) * 0.8;
    });
    dome.material.opacity = smooth(clamp((t - 0.86) / 0.14, 0, 1));

    /* ---- cull the chapters behind and ahead of us ---- */
    const z = camera.position.z;
    /* Hard cut, not a distance test. The screenshot that started this showed
         the horizon hanging in front of the next chapter, because a z-based
         cull kept the field alive well past the fall. Once the fall is done
         the black hole does not exist. */
    field.visible    = t < FALL_T1 + 0.004;
    city.visible     = z >  -320 && z < -40;
    assembly.visible = t > 0.32 && t < 0.58;
    gallery.visible  = z <  -280 && z > -520;
    rise.visible     = t > 0.68;
    arrival.visible  = t > 0.80;

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------ lifecycle */
  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = w / h < 0.85 ? 72 : 58;   /* portrait needs a wider lens */
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    }
    render(current, 0.016);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  if (!reduced) {
    addEventListener('pointermove', e => {
      mouseX = (e.clientX / innerWidth - 0.5) * 2;
      mouseY = -(e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  resize();

  return {
    setProgress(p) {
      target = clamp(p, 0, 1);
      if (reduced) { current = target; render(current, 0.016); }
    },
    setActive(on) { if (on) start(); else stop(); },
    get progress() { return current; },
    reduced,
    resize,
    dispose() {
      stop();
      renderer.dispose();
    }
  };
}
