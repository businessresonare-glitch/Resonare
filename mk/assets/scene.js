/* ==========================================================================
   MK — SCENE
   A scroll-driven WebGL film: the MK mark resolves out of the dark, the camera
   moves past it onto a site, and an MK building assembles itself storey by
   storey as the visitor scrolls — frame, slabs, envelope, services, steel
   canopy — finishing lit at dusk.

   Built on three.js, vendored locally (assets/vendor). No CDN, no runtime
   third-party request: the parent RESONARE site adopted that rule after a CDN
   stall left the page sitting on its preloader, and it holds here.

   Quality decisions, because this page is the portfolio:
     - ACES filmic tone mapping + sRGB output, so the gold and orange keep
       their saturation into the highlights instead of clipping to white
     - PMREM-prefiltered room environment: chrome and gold are metals, and a
       metal with nothing to reflect renders as a flat grey blob
     - real shadow maps from the key light, PCF-soft
     - selective bloom via luminance threshold, tuned to catch lit windows and
       the mark's specular without smearing the whole frame
     - the whole lighting rig lerps from midday to dusk across the scroll, so
       the finished building is warm and the site work is neutral

   Everything degrades rather than fails: no WebGL, reduced motion, a lost
   context or a hidden tab each have an explicit path.
   ========================================================================== */

import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const canvas = document.getElementById('scene');
if (canvas) boot(canvas);

function boot(canvas) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- brand ------------------------------------------------------------ */
  const C = {
    navy:      0x0B1024,
    navyDeep:  0x070A18,
    orange:    0xF26A21,
    orangeHot: 0xFF8636,
    gold:      0xF5A623,
    goldHi:    0xFBC66A,
    chrome:    0xD8DEE8,
    concrete:  0x8E939E,
    concreteD: 0x5E6470,
    steel:     0x76839A,
    glassLit:  0xFFD9A0,
    dusk:      0x1A1330
  };

  /* ---- renderer --------------------------------------------------------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', alpha: false
    });
  } catch (e) {
    document.body.classList.add('no-webgl');
    return;
  }
  if (!renderer.capabilities.isWebGL2 && !renderer.getContext()) {
    document.body.classList.add('no-webgl');
    return;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.navy);
  scene.fog = new THREE.Fog(C.navy, 26, 96);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  /* A prefiltered room probe is what makes the metals read as metal. It is
     rendered once into a cubemap and then thrown away. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  /* ---- lighting rig ------------------------------------------------------
     Two states, lerped by scroll: neutral working daylight while the building
     goes up, warm dusk once it is finished and the windows come on.          */
  const key = new THREE.DirectionalLight(0xFFF0DA, 1.7);
  key.position.set(14, 22, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 90;
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x5C7BFF, 0.5);
  fill.position.set(-16, 9, -10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xFFFFFF, 0.45);
  rim.position.set(-6, 7, -18);
  scene.add(rim);

  const ambient = new THREE.HemisphereLight(0x9FB4FF, 0x241608, 0.3);
  scene.add(ambient);

  /* brand accent lights — these are what put orange and gold into the
     shadows instead of leaving them dead navy */
  const accentA = new THREE.PointLight(C.orange, 26, 38, 2);
  accentA.position.set(-7, 5, 7);
  scene.add(accentA);
  const accentB = new THREE.PointLight(C.gold, 18, 34, 2);
  accentB.position.set(9, 3.5, -5);
  scene.add(accentB);

  /* ---- materials --------------------------------------------------------- */
  const M = {
    ball: new THREE.MeshPhysicalMaterial({
      color: C.orange, roughness: 0.18, metalness: 0.05,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1
    }),
    gold: new THREE.MeshStandardMaterial({
      color: C.gold, roughness: 0.22, metalness: 1, envMapIntensity: 1.35
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: C.chrome, roughness: 0.06, metalness: 1, envMapIntensity: 1.5
    }),
    concrete: new THREE.MeshStandardMaterial({ color: C.concrete, roughness: 0.9, metalness: 0 }),
    concreteD: new THREE.MeshStandardMaterial({ color: C.concreteD, roughness: 0.95, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.4, metalness: 0.9, envMapIntensity: 1.1 }),
    orangeSteel: new THREE.MeshStandardMaterial({ color: C.orangeHot, roughness: 0.45, metalness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x2A3550, roughness: 0.08, metalness: 0, transmission: 0.6,
      thickness: 0.4, transparent: true, opacity: 0.85, envMapIntensity: 1.4
    }),
    lit: new THREE.MeshStandardMaterial({
      color: C.glassLit, emissive: C.glassLit, emissiveIntensity: 0, roughness: 0.5
    }),
    ground: new THREE.MeshStandardMaterial({ color: 0x141A2E, roughness: 1, metalness: 0 })
  };
  const litMaterials = [M.lit];

  /* ---- ground ------------------------------------------------------------ */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(120, 60, 0x2A3455, 0x1C2440);
  scene.add(grid);

  /* ====================================================================== */
  /*  THE MARK — the logo built as real geometry                             */
  /* ====================================================================== */
  const mark = new THREE.Group();
  mark.position.set(0, 6.4, 34);
  mark.scale.setScalar(0.74);
  scene.add(mark);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.55, 96, 96), M.ball);
  ball.castShadow = true;
  mark.add(ball);

  /* the sash: a torus squashed on one axis reads as a flat ribbon wrapping
     the ball, which a plain torus does not */
  const sash = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.34, 40, 160), M.gold);
  sash.scale.set(1, 1, 0.42);
  sash.rotation.set(Math.PI / 2 - 0.32, 0.14, 0.28);
  sash.castShadow = true;
  mark.add(sash);

  /* the crescent, extruded from a two-arc profile so it keeps a sharp tip at
     one end and a hooked, thicker tail at the other */
  const cres = new THREE.Shape();
  cres.moveTo(-1.75, 0.06);
  cres.bezierCurveTo(-0.9, 0.92, 0.9, 0.96, 1.72, 0.28);
  cres.bezierCurveTo(2.12, -0.06, 2.05, -0.62, 1.62, -0.72);
  cres.bezierCurveTo(1.3, -0.8, 1.06, -0.6, 1.14, -0.34);
  cres.bezierCurveTo(1.24, -0.02, 0.72, 0.2, 0.06, 0.18);
  cres.bezierCurveTo(-0.72, 0.16, -1.3, 0.1, -1.75, 0.06);
  const crescent = new THREE.Mesh(
    new THREE.ExtrudeGeometry(cres, { depth: 0.34, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 6, curveSegments: 48 }),
    M.chrome
  );
  crescent.position.set(-0.1, 0.52, 0.35);
  crescent.rotation.set(-0.22, 0.1, -0.08);
  crescent.castShadow = true;
  mark.add(crescent);

  /* ====================================================================== */
  /*  THE BUILDING — assembles as the visitor scrolls                        */
  /* ====================================================================== */
  const site = new THREE.Group();
  scene.add(site);

  /* Each part records the build progress at which it lands. Nothing is added
     or removed at runtime — parts are only moved and scaled, so there is no
     allocation, no shader recompile and no hitch mid-scroll. */
  const parts = [];
  function addPart(mesh, at, rise = 1.4) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.at = at;
    mesh.userData.rise = rise;
    mesh.userData.baseY = mesh.position.y;
    site.add(mesh);
    parts.push(mesh);
    return mesh;
  }

  const BAYS_X = 4, BAYS_Z = 3, BAY = 3.4, FLOORS = 4, FH = 3.25;
  const W = BAYS_X * BAY, D = BAYS_Z * BAY;

  /* pad footing */
  addPart(new THREE.Mesh(new THREE.BoxGeometry(W + 3, 0.5, D + 3), M.concreteD)
    .translateY(0.25), 0.02, 2);

  for (let f = 0; f < FLOORS; f++) {
    const t0 = 0.05 + f * 0.095;

    /* columns */
    for (let i = 0; i <= BAYS_X; i++) {
      for (let j = 0; j <= BAYS_Z; j++) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.46, FH, 0.46), M.concrete);
        col.position.set(-W / 2 + i * BAY, 0.5 + f * FH + FH / 2, -D / 2 + j * BAY);
        addPart(col, t0 + (i + j) * 0.004, 1.1);
      }
    }
    /* slab over */
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.34, D + 1.2), M.concrete);
    slab.position.set(0, 0.5 + (f + 1) * FH, 0);
    addPart(slab, t0 + 0.055, 1.8);

    /* edge beam, reads as the floor line from a distance */
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 1.3, 0.14, D + 1.3), M.concreteD);
    beam.position.set(0, 0.5 + (f + 1) * FH - 0.24, 0);
    addPart(beam, t0 + 0.06, 1.8);
  }

  /* envelope: infill panels and windows on the two visible faces */
  const winGeo = new THREE.BoxGeometry(BAY * 0.62, FH * 0.5, 0.12);
  const panelGeo = new THREE.BoxGeometry(BAY * 0.98, FH * 0.94, 0.22);
  const windows = [];
  for (let f = 0; f < FLOORS; f++) {
    const y = 0.5 + f * FH + FH / 2;
    const t0 = 0.56 + f * 0.045;
    for (let i = 0; i < BAYS_X; i++) {
      const x = -W / 2 + BAY / 2 + i * BAY;
      const panel = new THREE.Mesh(panelGeo, M.concrete);
      panel.position.set(x, y, D / 2 + 0.1);
      addPart(panel, t0 + i * 0.006, 0.7);

      const win = new THREE.Mesh(winGeo, M.lit);
      win.position.set(x, y + 0.15, D / 2 + 0.24);
      win.userData.flicker = Math.random() * 6.28;
      addPart(win, t0 + i * 0.006 + 0.01, 0.7);
      windows.push(win);
    }
    for (let j = 0; j < BAYS_Z; j++) {
      const z = -D / 2 + BAY / 2 + j * BAY;
      const panel = new THREE.Mesh(panelGeo, M.concrete);
      panel.rotation.y = Math.PI / 2;
      panel.position.set(W / 2 + 0.1, y, z);
      addPart(panel, t0 + 0.02 + j * 0.006, 0.7);

      const win = new THREE.Mesh(winGeo, M.lit);
      win.rotation.y = Math.PI / 2;
      win.position.set(W / 2 + 0.24, y + 0.15, z);
      addPart(win, t0 + 0.02 + j * 0.006 + 0.01, 0.7);
      windows.push(win);
    }
  }

  /* services: the M&E half of the trade, run up the rear face */
  const riserMat = M.steel;
  for (let k = 0; k < 3; k++) {
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, FLOORS * FH + 0.6, 20), riserMat);
    riser.position.set(-W / 2 - 0.42, 0.5 + (FLOORS * FH) / 2, -D / 2 + 1.2 + k * 1.5);
    addPart(riser, 0.74 + k * 0.012, 1.2);
  }
  const pulses = [];
  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshStandardMaterial({ color: C.goldHi, emissive: C.goldHi, emissiveIntensity: 3, roughness: 0.4 })
    );
    p.position.set(-W / 2 - 0.42, 1, -D / 2 + 1.2 + k * 1.5);
    p.userData.k = k;
    site.add(p);
    pulses.push(p);
    litMaterials.push(p.material);
  }

  /* steel canopy over the entrance — their fabrication work */
  const canopy = new THREE.Group();
  for (let i = 0; i <= 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.09, 10, 40, Math.PI), M.orangeSteel);
    rib.position.set(-W / 2 + 1.4 + i * 1.15, 0.5, D / 2 + 3.1);
    rib.rotation.set(0, Math.PI / 2, 0);
    canopy.add(rib);
  }
  const purlin = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.1, 0.1), M.steel);
  purlin.position.set(-W / 2 + 4.85, 3.55, D / 2 + 3.1);
  canopy.add(purlin);
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(3.02, 3.02, 7.2, 40, 1, true, 0, Math.PI), M.glass);
  sheet.rotation.set(0, 0, Math.PI / 2);
  sheet.position.set(-W / 2 + 4.85, 0.5, D / 2 + 3.1);
  canopy.add(sheet);
  canopy.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  canopy.position.y = 0;
  canopy.userData.at = 0.82;
  canopy.userData.rise = 1.6;
  canopy.userData.baseY = 0;
  site.add(canopy);
  parts.push(canopy);

  /* tower crane, struck once the building tops out */
  const crane = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 20, 0.5), M.orangeSteel);
  mast.position.set(0, 10, 0);
  crane.add(mast);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(18, 0.34, 0.34), M.orangeSteel);
  jib.position.set(4.5, 19.4, 0);
  crane.add(jib);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1), M.steel);
  counter.position.set(-4.2, 19.4, 0);
  crane.add(counter);
  crane.position.set(-W / 2 - 7, 0, -D / 2 - 4);
  crane.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(crane);

  /* ---- camera path -------------------------------------------------------
     Eye and target are interpolated separately so the camera can already be
     looking at the next thing while it finishes leaving the last one. */
  const EYE = [
    new THREE.Vector3(0.2, 6.7, 43.5),  /* on the mark                     */
    new THREE.Vector3(-2.4, 5.2, 30),   /* drifting past it                */
    new THREE.Vector3(-16, 4.0, 22),    /* arriving on site, low           */
    new THREE.Vector3(-19, 8.5, 4),     /* frame going up, three-quarter   */
    new THREE.Vector3(-13, 14, -13),    /* over the slabs                  */
    new THREE.Vector3(9, 11, -17),      /* round the back, services        */
    new THREE.Vector3(20, 7.5, 6),      /* the envelope closes             */
    new THREE.Vector3(11, 5.2, 20),     /* the canopy, near ground         */
    new THREE.Vector3(2, 12, 33)        /* pulled back, dusk, lit          */
  ];
  const LOOK = [
    new THREE.Vector3(0, 6.4, 34),
    new THREE.Vector3(0, 6.2, 33),
    new THREE.Vector3(-1, 4.5, 0),
    new THREE.Vector3(0, 6, 0),
    new THREE.Vector3(0, 7, 0),
    new THREE.Vector3(-2, 7, 0),
    new THREE.Vector3(0, 7.5, 0),
    new THREE.Vector3(-2, 3.4, 6),
    new THREE.Vector3(0, 7, 0)
  ];
  const eyeCurve = new THREE.CatmullRomCurve3(EYE, false, 'catmullrom', 0.35);
  const lookCurve = new THREE.CatmullRomCurve3(LOOK, false, 'catmullrom', 0.35);

  /* ---- composer ---------------------------------------------------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---- sizing ------------------------------------------------------------ */
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w > 1500 ? 1.75 : 2));
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    /* a longer lens in portrait, or the building falls out of frame */
    camera.fov = w < 760 ? 54 : 42;
    camera.updateProjectionMatrix();
    buildPace();
  }

  /* ---- scroll pacing ------------------------------------------------------
     Same approach as the rest of the site: the mapping from scroll position to
     film position is measured from the DOM, never hardcoded, because section
     heights differ between viewports and change whenever the copy is edited. */
  const STATIONS = [
    { id: 'hero',     t: 0.00 },
    { id: 'about',    t: 0.13 },
    { id: 'build',    t: 0.34 },
    { id: 'services', t: 0.56 },
    { id: 'steel',    t: 0.76 },
    { id: 'proof',    t: 0.90 },
    { id: 'contact',  t: 1.00 }
  ];
  let PACE = [[0, 0], [1, 1]];
  function buildPace() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const next = [];
    for (const s of STATIONS) {
      const el = document.getElementById(s.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const centre = r.top + scrollY + r.height / 2 - innerHeight / 2;
      const frac = max > 0 ? Math.min(Math.max(centre / max, 0), 1) : 0;
      if (next.length && frac <= next[next.length - 1][0]) continue;
      next.push([frac, s.t]);
    }
    if (!next.length) { PACE = [[0, 0], [1, 1]]; return; }
    if (next[0][0] > 0) next.unshift([0, 0]);
    if (next[next.length - 1][0] < 1) next.push([1, 1]);
    PACE = next;
  }
  const smooth = t => t * t * (3 - 2 * t);
  function pace(s) {
    for (let i = 0; i < PACE.length - 1; i++) {
      if (s <= PACE[i + 1][0]) {
        const [a0, a1] = PACE[i], [b0, b1] = PACE[i + 1];
        const span = b0 - a0;
        return a1 + (b1 - a1) * smooth(span > 0 ? (s - a0) / span : 0);
      }
    }
    return PACE[PACE.length - 1][1];
  }

  let target = 0, eased = 0;
  function readScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
  }

  /* ---- per-frame state ---------------------------------------------------- */
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3();
  const dayKey = new THREE.Color(0xFFF0DA), duskKey = new THREE.Color(0xFF9A4A);
  const dayFog = new THREE.Color(C.navy), duskFog = new THREE.Color(C.dusk);
  const dayAmbSky = new THREE.Color(0x9FB4FF), duskAmbSky = new THREE.Color(0x4A3A72);
  const _c = new THREE.Color();

  function applyState(t, time) {
    /* camera */
    eyeCurve.getPoint(Math.min(t, 0.999), _eye);
    lookCurve.getPoint(Math.min(t, 0.999), _look);
    if (!reduceMotion) {
      _eye.x += Math.sin(time * 0.31) * 0.22;
      _eye.y += Math.sin(time * 0.44 + 1.3) * 0.16;
    }
    camera.position.copy(_eye);
    camera.lookAt(_look);

    /* the mark: alive only while it is on screen, then parked */
    const markOn = t < 0.24;
    mark.visible = markOn;
    if (markOn) {
      mark.rotation.y = time * 0.34;
      mark.rotation.x = Math.sin(time * 0.4) * 0.09;
      mark.position.y = 6.4 + Math.sin(time * 0.6) * 0.16;
    }

    /* build progress drives every part */
    const b = Math.min(Math.max((t - 0.12) / 0.62, 0), 1);
    for (const p of parts) {
      const at = p.userData.at;
      const k = Math.min(Math.max((b - at) / 0.07, 0), 1);
      const e = k * k * (3 - 2 * k);
      p.visible = k > 0.001;
      if (!p.visible) continue;
      p.position.y = p.userData.baseY + (1 - e) * p.userData.rise;
      const s = 0.94 + 0.06 * e;
      p.scale.set(s, s, s);
      /* fade in via material opacity would force transparency on every
         material in the scene; scale + rise reads better and costs nothing */
    }

    /* crane is struck once the frame is complete */
    const craneOut = Math.min(Math.max((b - 0.72) / 0.14, 0), 1);
    crane.visible = craneOut < 0.999;
    crane.position.y = -craneOut * 26;

    /* dusk: lights, fog and windows all cross-fade together */
    const dusk = Math.min(Math.max((t - 0.62) / 0.3, 0), 1);
    key.color.copy(_c.copy(dayKey).lerp(duskKey, dusk));
    key.intensity = 1.7 - dusk * 0.95;
    fill.intensity = 0.5 - dusk * 0.22;
    ambient.color.copy(_c.copy(dayAmbSky).lerp(duskAmbSky, dusk));
    ambient.intensity = 0.3 - dusk * 0.12;
    scene.fog.color.copy(_c.copy(dayFog).lerp(duskFog, dusk));
    scene.background.copy(scene.fog.color);
    accentA.intensity = 14 + dusk * 44;
    accentB.intensity = 10 + dusk * 34;
    M.lit.emissiveIntensity = dusk * 2.4;

    /* services pulses, only while the services beat is on screen */
    const svc = t > 0.5 && t < 0.9;
    for (const p of pulses) {
      p.visible = svc && b > 0.74;
      if (!p.visible) continue;
      const span = FLOORS * FH;
      p.position.y = 0.8 + ((time * 3 + p.userData.k * 2.2) % span);
      p.material.emissiveIntensity = 2.5 + Math.sin(time * 4 + p.userData.k) * 1.2;
    }

    /* accent lights drift so the metals never sit still */
    if (!reduceMotion) {
      accentA.position.x = -7 + Math.sin(time * 0.5) * 2.5;
      accentB.position.z = -5 + Math.cos(time * 0.42) * 2.5;
    }
  }

  /* ---- loop --------------------------------------------------------------- */
  let running = false, raf = 0, clock = new THREE.Clock();
  function frame() {
    raf = 0;
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.1);   /* clamped: a backgrounded tab
                                                     returns a huge first delta */
    const time = clock.getElapsedTime();

    /* Frame-rate independent smoothing.
       `eased += (target - eased) * k` is the usual one-liner, and it is wrong:
       the amount of catching-up per frame is fixed, so the camera converges in
       0.3s at 60fps and takes ten seconds at 5fps. On a weak GPU the whole film
       then trails the scroll by half a section. Exponential decay against real
       elapsed time converges in the same wall-clock time at any frame rate. */
    eased += (target - eased) * (reduceMotion ? 1 : 1 - Math.exp(-6.5 * dt));

    applyState(pace(Math.min(Math.max(eased, 0), 1)), time);
    composer.render();
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; clock.getDelta(); if (!raf) raf = requestAnimationFrame(frame); } }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  /* ---- lifecycle ---------------------------------------------------------- */
  addEventListener('resize', resize, { passive: true });
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('load', () => { resize(); readScroll(); });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  /* A lost context is otherwise a permanently black hero. */
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); }, false);
  canvas.addEventListener('webglcontextrestored', () => { resize(); start(); }, false);

  resize();
  readScroll();
  eased = target;
  document.body.classList.add('scene-ready');

  if (reduceMotion) {
    applyState(pace(eased), 0);
    composer.render();
    addEventListener('scroll', () => {
      readScroll(); eased = target;
      applyState(pace(eased), 0);
      composer.render();
    }, { passive: true });
  } else {
    start();
  }

  window.MKScene = {
    parts: () => parts.length, progress: () => eased, start, stop,
    debug: () => ({
      scroll: +target.toFixed(3), eased: +eased.toFixed(3), t: +pace(eased).toFixed(3),
      eye: camera.position.toArray().map(n => +n.toFixed(1)),
      markVisible: mark.visible, pace: PACE.map(p => [+p[0].toFixed(3), p[1]])
    })
  };
}
