/* ==========================================================================
   RESONARE — WORLD
   One continuous camera flight, scrubbed by the page scroll.

   The whole homepage is a single connected 3D space laid out along -Z. The
   camera never cuts: it flies out of the dark, through the resonance rings,
   over a city of local businesses, into a site as it assembles itself,
   down a corridor of real work, up into the light, and lands on the mark.

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
  SRGBColorSpace, Scene, Sphere, TextureLoader, TorusGeometry, Vector3,
  WebGLRenderer, ACESFilmicToneMapping
} from 'three';

/* ---------------------------------------------------------------- palette */
const C = {
  void:    0x04031A,
  navy:    0x0A0952,
  navyLit: 0x1A1878,
  rust:    0xB52F24,
  ember:   0xDE5A3C,
  gold:    0xF4C77E,
  cream:   0xF6F2E9,
  ink:     0x0B0A1E
};

/* Atmosphere keyframes. The journey runs night → ember → dawn → daylight;
   fog and background share one colour so the horizon never shows a seam. */
const SKY = [
  { t: 0.00, sky: 0x04031A, key: 0xDE5A3C, amb: 0x1A1878, exposure: 1.05 },
  { t: 0.13, sky: 0x08073C, key: 0xE8815E, amb: 0x1E1C86, exposure: 1.08 },
  { t: 0.26, sky: 0x0A0952, key: 0xFFD9B0, amb: 0x2A2794, exposure: 1.14 },
  { t: 0.40, sky: 0x0C0A58, key: 0xFFE6C6, amb: 0x2A2794, exposure: 1.16 },
  { t: 0.54, sky: 0x140F52, key: 0xFFFFFF, amb: 0x33307E, exposure: 1.14 },
  { t: 0.70, sky: 0x24144A, key: 0xFFFFFF, amb: 0x4A3878, exposure: 1.12 },
  { t: 0.80, sky: 0x6B2C4C, key: 0xFFB07A, amb: 0x8A4358, exposure: 1.14 },
  { t: 0.87, sky: 0xD79A66, key: 0xFFE9C4, amb: 0xCE9A80, exposure: 1.16 },
  { t: 0.93, sky: 0xF6F2E9, key: 0xFFFFFF, amb: 0xE8DFCC, exposure: 1.16 },
  { t: 1.00, sky: 0xF6F2E9, key: 0xFFFFFF, amb: 0xE8DFCC, exposure: 1.16 }
];

/* Where each chapter lives on the curve. Objects read their own local
   0 → 1 progress out of this so a chapter can animate independently. */
const CH = {
  field:    [0.00, 0.15],
  city:     [0.13, 0.40],
  assembly: [0.36, 0.57],
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
function cardTexture(quote, name, role) {
  const w = 512, h = 340, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, w, h);

  g.fillStyle = '#B52F24';
  for (let i = 0; i < 5; i++) star(g, 40 + i * 26, 48, 9);

  g.fillStyle = '#0B0A1E';
  g.font = '500 25px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
  wrap(g, quote, 40, 112, w - 80, 34);

  g.fillStyle = '#B52F24';
  g.font = '700 19px ui-sans-serif, system-ui, sans-serif';
  g.fillText(name, 40, h - 66);
  g.fillStyle = '#6A6980';
  g.font = '400 17px ui-sans-serif, system-ui, sans-serif';
  g.fillText(role, 40, h - 38);

  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;

  function star(ctx, cx, cy, r) {
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

  /* -------------------------------------------------------------- lighting */
  const hemi = new HemisphereLight(C.cream, C.navy, 1.05);
  scene.add(hemi);
  const amb = new AmbientLight(ambColor, 0.8);
  scene.add(amb);
  const key = new DirectionalLight(keyColor, 2.2);
  key.position.set(12, 26, 10);
  scene.add(key);
  const rim = new DirectionalLight(C.ember, 1.1);
  rim.position.set(-16, 6, -30);
  scene.add(rim);
  /* Travels with the camera so nothing the flight passes goes flat black.
     Warm white rather than ember — an ember lamp turned the whole city into
     one red canyon instead of a blue city with red lights in it. */
  const lamp = new PointLight(0xFFE0C4, 26, 110, 2);
  scene.add(lamp);

  /* ============================================== CHAPTER 1 — THE FIELD */
  const field = new Group();
  scene.add(field);

  const rings = new Group();
  rings.position.set(0, 0, -60);
  field.add(rings);
  for (let i = 0; i < 5; i++) {
    const r = 5 + i * 4.6;
    const ring = new Mesh(
      new TorusGeometry(r, 0.16 + i * 0.03, 8, 96),
      new MeshStandardMaterial({
        color: C.rust, emissive: C.ember,
        emissiveIntensity: 1.5 - i * 0.18, roughness: 0.35, metalness: 0.2
      })
    );
    ring.userData.spin = (i % 2 ? 1 : -1) * (0.12 + i * 0.05);
    ring.userData.tilt = i * 0.06;
    rings.add(ring);
  }
  const ringGlow = glowPlane(46, C.ember, 0.5);
  ringGlow.position.set(0, 0, -61.5);
  field.add(ringGlow);

  /* dust — one field spanning the whole journey, fogged so it reads as depth */
  const dustCount = Math.round(2600 * quality);
  {
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 190;
      pos[i * 3 + 1] = Math.random() * 58 - 16;
      pos[i * 3 + 2] = 30 - Math.random() * 760;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.boundingSphere = new Sphere(new Vector3(0, 0, -350), 620);
    const dust = new Points(geo, new PointsMaterial({
      color: C.cream, size: 0.42, sizeAttenuation: true,
      transparent: true, opacity: 0.55, depthWrite: false, fog: true
    }));
    scene.add(dust);
  }

  /* ============================================== CHAPTER 2 — THE CITY */
  const city = new Group();
  scene.add(city);

  const CITY_Z0 = -84, CITY_Z1 = -238;
  const blockCount = Math.round(760 * quality);
  const litCount = Math.round(blockCount * 0.1);

  /* Two meshes rather than one: `instanceColor` multiplies the diffuse term
     only, so a per-instance emissive glow is impossible inside a single
     InstancedMesh. The businesses that get found need to actually emit. */
  const blockGeo = new BoxGeometry(1, 1, 1);
  const darkBlocks = new InstancedMesh(
    blockGeo,
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.18 }),
    blockCount - litCount
  );
  const litBlocks = new InstancedMesh(
    blockGeo,
    new MeshStandardMaterial({
      color: C.ember, emissive: C.ember, emissiveIntensity: 0.9,
      roughness: 0.4, metalness: 0.2
    }),
    litCount
  );
  darkBlocks.instanceMatrix.setUsage(DynamicDrawUsage);
  const litSpots = [];
  {
    const dummy = new Object3D();
    const col = new Color();
    let d = 0, l = 0;
    for (let i = 0; i < blockCount; i++) {
      let x = (Math.random() - 0.5) * 210;
      if (Math.abs(x) < 8) x += Math.sign(x || 1) * 9;   /* keep the street clear */
      const z = lerp(CITY_Z0, CITY_Z1, Math.random());
      const h = 1.2 + Math.pow(Math.random(), 2.1) * 16;
      const w = 2.2 + Math.random() * 3.4;
      dummy.position.set(x, h / 2, z);
      dummy.rotation.y = Math.random() * 0.4 - 0.2;
      dummy.scale.set(w, h, w * (0.7 + Math.random() * 0.6));
      dummy.updateMatrix();

      if (l < litCount && Math.random() < 0.1) {
        litBlocks.setMatrixAt(l++, dummy.matrix);
        litSpots.push([x, z]);
      } else if (d < blockCount - litCount) {
        darkBlocks.setMatrixAt(d, dummy.matrix);
        col.setHex(C.navyLit).multiplyScalar(0.5 + Math.random() * 0.5);
        darkBlocks.setColorAt(d, col);
        d++;
      }
    }
    darkBlocks.count = d;
    litBlocks.count = l;
  }
  darkBlocks.instanceColor.needsUpdate = true;
  city.add(darkBlocks);
  city.add(litBlocks);

  /* the ground, and a grid over it so speed is legible */
  const ground = new Mesh(
    new PlaneGeometry(600, 260),
    new MeshStandardMaterial({ color: 0x0D0B32, roughness: 0.94, metalness: 0.08 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, (CITY_Z0 + CITY_Z1) / 2);
  city.add(ground);
  city.add(gridLines(560, 250, 46, 22, (CITY_Z0 + CITY_Z1) / 2, C.ember, 0.16));

  /* beams above the lit blocks — the businesses that get found */
  const beams = new Group();
  city.add(beams);
  for (let n = 0; n < Math.min(litSpots.length, 26); n++) {
    const [x, z] = litSpots[n];
    const beam = new Mesh(
      new PlaneGeometry(2.2, 48),
      new MeshBasicMaterial({
        map: glowTexture(), color: C.ember, transparent: true, opacity: 0,
        blending: AdditiveBlending, depthWrite: false, fog: false
      })
    );
    beam.position.set(x, 22, z);
    beam.userData.phase = Math.random() * 6.28;
    beams.add(beam);
  }

  /* ============================================ CHAPTER 3 — THE ASSEMBLY */
  /* A website building itself: panels scattered in the dark converge into a
     layout, then open up as the camera flies through the screen. */
  const assembly = new Group();
  assembly.position.set(0, 0, -322);
  scene.add(assembly);

  const LAYOUT = [
    /* x, y, w, h, accent */
    [  0.0,  7.6, 30.0, 1.5, 0], [-11.5,  4.2,  7.0, 3.6, 1],
    [ -2.0,  4.6, 14.0, 4.6, 0], [  9.5,  4.4,  9.0, 4.2, 0],
    [-11.5, -0.4,  7.0, 5.4, 0], [ -2.0, -1.0, 14.0, 6.2, 1],
    [  9.5, -0.6,  9.0, 5.8, 0], [-11.5, -6.2,  7.0, 4.4, 0],
    [ -2.0, -6.6, 14.0, 3.6, 0], [  9.5, -6.4,  9.0, 4.0, 1],
    [  0.0, -10.4, 30.0, 2.0, 0]
  ];
  const panels = [];
  for (const [x, y, w, h, accent] of LAYOUT) {
    const mat = new MeshStandardMaterial({
      color: accent ? C.ember : C.cream,
      emissive: accent ? C.rust : 0x2A2860,
      emissiveIntensity: accent ? 0.55 : 0.14,
      roughness: 0.5, metalness: 0.05, transparent: true, opacity: 1,
      side: DoubleSide
    });
    const p = new Mesh(new PlaneGeometry(w, h), mat);
    p.userData.home = new Vector3(x, y, 0);
    /* Scattered around the layout, not behind it: an earlier version threw
       the panels 70–160 units down -Z, which put them past the fog wall, so
       the chapter opened on an empty navy screen and the site only appeared
       once it had already finished assembling. */
    p.userData.away = new Vector3(
      x + (Math.random() - 0.5) * 46,
      y + (Math.random() - 0.5) * 34,
      (Math.random() - 0.5) * 44 - 14
    );
    p.userData.spin = (Math.random() - 0.5) * 2.4;
    assembly.add(p);
    panels.push(p);
  }
  const siteFrame = new LineSegments(
    new EdgesGeometry(new BoxGeometry(33, 22, 0.6)),
    new LineBasicMaterial({ color: C.gold, transparent: true, opacity: 0 })
  );
  assembly.add(siteFrame);
  const assemblyGlow = glowPlane(60, C.gold, 0);
  assemblyGlow.position.z = -3;
  assembly.add(assemblyGlow);

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

    const backing = new Mesh(
      new PlaneGeometry(w + 0.7, h + 0.7),
      new MeshStandardMaterial({ color: C.ink, roughness: 0.85, metalness: 0.1, side: DoubleSide })
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
    const halo = glowPlane(w * 1.5, C.gold, 0.13);
    halo.position.set(side * 9.9, backing.position.y, z - 0.5);
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
    const tube = new Mesh(
      new BoxGeometry(0.5, 0.5, 190),
      new MeshBasicMaterial({ color: C.ember, transparent: true, opacity: 0.5, fog: false })
    );
    tube.position.set(0, -3.2, GAL_Z0 - 68);
    gallery.add(tube);
  }

  /* =============================================== CHAPTER 5 — THE RISE */
  const rise = new Group();
  rise.position.set(0, 0, -586);
  scene.add(rise);
  const bars = [];
  for (let i = 0; i < 9; i++) {
    const target = 6 + Math.pow(i / 8, 1.55) * 34;
    const bar = new Mesh(
      new BoxGeometry(3.2, 1, 3.2),
      new MeshStandardMaterial({
        color: i > 5 ? C.gold : C.ember,
        emissive: i > 5 ? C.gold : C.rust,
        emissiveIntensity: 0.35, roughness: 0.32, metalness: 0.35
      })
    );
    bar.position.set(-20 + i * 5, 0, 0);
    bar.userData.target = target;
    rise.add(bar);
    bars.push(bar);
  }
  rise.add(gridLines(150, 70, 14, 7, 0, C.gold, 0.2));

  /* ============================================ CHAPTER 6 — THE ARRIVAL */
  const arrival = new Group();
  arrival.position.set(0, 6.5, -700);
  scene.add(arrival);
  const markRings = [];
  for (let i = 0; i < 4; i++) {
    const ring = new Mesh(
      new RingGeometry(5 + i * 5.6, 5.34 + i * 5.6, 128),
      new MeshBasicMaterial({ color: C.rust, transparent: true, opacity: 0.5 - i * 0.09, side: DoubleSide, fog: false })
    );
    ring.userData.delay = i * 0.16;
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
  const cards = [];
  (options.reviews || []).forEach((r, i) => {
    const tex = cardTexture(r.quote, r.name, r.role);
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
  function gridLines(w, d, cols, rows, z, color, opacity) {
    const pts = [];
    for (let i = 0; i <= cols; i++) {
      const x = -w / 2 + (w / cols) * i;
      pts.push(x, 0, z - d / 2, x, 0, z + d / 2);
    }
    for (let j = 0; j <= rows; j++) {
      const zz = z - d / 2 + (d / rows) * j;
      pts.push(-w / 2, 0, zz, w / 2, 0, zz);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    return new LineSegments(geo, new LineBasicMaterial({ color, transparent: true, opacity }));
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
    const dt = Math.min((now - last) / 1000, 0.05);
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
    key.color.copy(keyColor);
    amb.color.copy(ambColor);
    hemi.color.copy(skyColor).lerp(_c1.setHex(C.cream), 0.55);
    renderer.toneMappingExposure = exposure;
    lamp.intensity = lerp(46, 6, smooth(clamp((t - 0.72) / 0.24, 0, 1)));

    /* ---- ch.1 field ---- */
    const pField = span(t, CH.field);
    rings.children.forEach((r, i) => {
      r.rotation.z += r.userData.spin * dt;
      r.rotation.x = Math.sin(clock * 0.4 + i) * 0.18 + r.userData.tilt;
      r.material.emissiveIntensity = (1.5 - i * 0.18) * (1 - pField * 0.55);
    });
    ringGlow.material.opacity = 0.5 * (1 - pField);
    ringGlow.lookAt(camera.position);

    /* ---- ch.2 city ---- */
    const pCity = span(t, CH.city);
    beams.children.forEach((b, i) => {
      b.material.opacity = 0.42 * pCity * (1 - pCity * 0.4) * (0.6 + 0.4 * Math.sin(clock * 1.6 + b.userData.phase));
      b.lookAt(camera.position.x, b.position.y, camera.position.z);
    });

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
    siteFrame.material.opacity = build * 0.65 * (1 - open);
    siteFrame.rotation.y = Math.sin(clock * 0.3) * 0.04;
    assemblyGlow.material.opacity = build * 0.35 * (1 - open);

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
      b.material.emissiveIntensity = 0.3 + local * 0.5;
    });

    /* ---- ch.6 arrival ---- */
    const pArr = span(t, CH.arrival);
    markRings.forEach((r, i) => {
      const w = smooth(clamp((pArr - r.userData.delay) / 0.42, 0, 1));
      r.scale.setScalar(0.62 + w * 0.38);
      r.material.opacity = w * (0.9 - i * 0.16);
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
    field.visible    = z >  -110;
    city.visible     = z >  -290 && z < -20;
    assembly.visible = t > 0.32 && t < 0.58;
    gallery.visible  = z <  -280 && z > -520;
    rise.visible     = t > 0.68;
    arrival.visible  = t > 0.80;

    renderer.render(scene, camera);
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
