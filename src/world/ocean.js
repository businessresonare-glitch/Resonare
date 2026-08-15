/* ==========================================================================
   RESONARE — THE REEF

   Replaces the neon city. The city was the obvious choice for "every local
   business competing for one search", which is exactly why it was dull — it
   is the shot every agency site already has.

   An ocean says the same thing better, and it says it in the brand's own
   language. RESONARE is resonance; underwater, a search IS an echo. A ping
   goes out, and what it finds lights up. The copy over this chapter —
   "below you is every local business competing for that one search, most of
   them never light up" — is literally true of a reef at depth.

   What is down here:

     seabed    displaced sand with scrolling caustics, so the floor moves the
               way a floor under water moves
     reef      instanced rock and coral mounds, most of them dark
     anemones  the ones that DO light up, in spectrum colours — these are the
               businesses that get found
     kelp      swaying in a vertex shader rather than on the CPU, because
               there are four hundred of them
     fish      two hundred, in schools, each on its own orbit
     sharks    three, drifting the long way across the frame
     rays      god rays from a surface you never quite see
     bubbles   rising columns, scrolled in the shader

   The only per-frame CPU work is the fish and the sharks. Everything else
   animates in its own shader or does not animate at all.
   ========================================================================== */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry,
  CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OctahedronGeometry,
  PlaneGeometry, Points, ShaderMaterial, Sphere, SRGBColorSpace, CanvasTexture,
  RepeatWrapping, Vector3
} from 'three';

/* --------------------------------------------------------------- caustics */
/* Overlapping soft blobs on a tiling canvas. Scrolled in two directions at
   different speeds it reads as light through moving water, which is the one
   texture that makes a flat sand plane look submerged. */
function causticTexture() {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    const r = 10 + Math.random() * 34;
    for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grd.addColorStop(0, 'rgba(255,255,255,.5)');
      grd.addColorStop(0.5, 'rgba(255,255,255,.12)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x + dx, y + dy, r, 0, 6.284); g.fill();
    }
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 24);
  return tex;
}

/* Sway, injected into a standard material. Amplitude rises with height above
   the seabed so the holdfast stays put and the tip moves — which is the only
   thing that separates kelp from a green stick. */
function swayMaterial(mat, amount) {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = mat.userData.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            float seed = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21;
          #else
            float seed = 0.0;
          #endif
          float h = max(0.0, transformed.y);
          float amp = h * h * ${amount.toFixed(4)};
          transformed.x += sin(uTime * 0.7 + seed) * amp;
          transformed.z += cos(uTime * 0.53 + seed * 1.7) * amp * 0.7;
        }`);
  };
  return mat;
}

export function createReef(opts) {
  const o = opts || {};
  const z0 = o.z0 || -110;
  const z1 = o.z1 || -262;
  const hue = o.hue || (() => 0xffffff);
  const q = o.quality || 1;
  const width = o.width || 230;

  const group = new Group();
  const len = Math.abs(z1 - z0);
  const zMid = (z0 + z1) / 2;
  const dummy = new Object3D();
  const col = new Color();
  const swayMats = [];

  /* ---------------------------------------------------------- the seabed */
  const caustics = causticTexture();
  const floorGeo = new PlaneGeometry(width * 2.6, len * 1.4, 90, 90);
  {
    /* gentle dunes, so the floor is not a sheet of card */
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(x * 0.05) * 2.2 + Math.cos(y * 0.037) * 2.6 +
                Math.sin(x * 0.13 + y * 0.11) * 0.9);
    }
    floorGeo.computeVertexNormals();
  }
  const floor = new Mesh(floorGeo, new MeshStandardMaterial({
    color: 0x1B3A56, roughness: 0.94, metalness: 0.05,
    emissive: 0x2E7FA8, emissiveMap: caustics, emissiveIntensity: 0.55,
    envMapIntensity: 0.7
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -3.2, zMid);
  group.add(floor);

  /* ------------------------------------------------------- reef and coral */
  const rockCount = Math.round(320 * q);
  const rocks = new InstancedMesh(
    new IcosahedronGeometry(1, 1),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.1, flatShading: true, envMapIntensity: 0.8 }),
    rockCount
  );
  for (let i = 0; i < rockCount; i++) {
    let x = (Math.random() - 0.5) * width * 1.8;
    if (Math.abs(x) < 16) x += Math.sign(x || 1) * 17;
    const z = z0 - Math.random() * len;
    dummy.position.set(x, -3 + Math.random() * 1.5, z);
    dummy.rotation.set(Math.random(), Math.random() * 6.28, Math.random());
    dummy.scale.set(2 + Math.random() * 7, 1.4 + Math.random() * 5, 2 + Math.random() * 7);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    col.setHex(0x244A63).multiplyScalar(0.5 + Math.random() * 0.8);
    rocks.setColorAt(i, col);
  }
  rocks.instanceColor.needsUpdate = true;
  group.add(rocks);

  /* The ones that light up. Same idea the neon towers carried in the city —
     most of the reef is dark, and the difference between dark and lit is the
     entire point of the chapter. */
  const anemoneCount = Math.round(340 * q);
  const anemones = new InstancedMesh(
    new CylinderGeometry(0.16, 0.42, 2.4, 6, 1, true),
    new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, transparent: true, opacity: 0.95 }),
    anemoneCount
  );
  for (let i = 0; i < anemoneCount; i++) {
    let x = (Math.random() - 0.5) * width * 1.5;
    if (Math.abs(x) < 15) x += Math.sign(x || 1) * 16;
    const z = z0 - Math.random() * len;
    const s = 0.5 + Math.random() * 1.5;
    dummy.position.set(x, -2.9 + s, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6.28, (Math.random() - 0.5) * 0.4);
    dummy.scale.set(s, s * (0.8 + Math.random() * 1.4), s);
    dummy.updateMatrix();
    anemones.setMatrixAt(i, dummy.matrix);
    anemones.setColorAt(i, col.setHex(hue(i * 3)));
  }
  anemones.instanceColor.needsUpdate = true;
  group.add(anemones);

  /* ----------------------------------------------------------------- kelp */
  const kelpCount = Math.round(420 * q);
  const kelpMat = swayMaterial(new MeshStandardMaterial({
    color: 0x2E7A55, roughness: 0.78, metalness: 0.08, side: DoubleSide,
    transparent: true, opacity: 0.96, envMapIntensity: 0.9
  }), 1.15);
  swayMats.push(kelpMat);
  /* A blade, not a card: the geometry is moved so its base sits at y=0 (the
     sway is keyed to height above the holdfast, and on a centred plane half
     the blade was below zero and never moved), then tapered toward the tip. */
  const bladeGeo = new PlaneGeometry(1, 1, 1, 14);
  bladeGeo.translate(0, 0.5, 0);
  {
    const bp = bladeGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i);
      bp.setX(i, bp.getX(i) * (1 - y * 0.72));
      /* a slight natural lean so a still frame is not a row of soldiers */
      bp.setZ(i, y * y * 0.5);
    }
    bladeGeo.computeVertexNormals();
  }
  const kelp = new InstancedMesh(bladeGeo, kelpMat, kelpCount);
  for (let i = 0; i < kelpCount; i++) {
    let x = (Math.random() - 0.5) * width * 1.6;
    if (Math.abs(x) < 14) x += Math.sign(x || 1) * 15;
    const z = z0 - Math.random() * len;
    const h = 6 + Math.random() * 22;
    dummy.position.set(x, -3.2, z);
    dummy.rotation.set(0, Math.random() * 6.28, 0);
    dummy.scale.set(0.5 + Math.random() * 0.9, h, 1);
    dummy.updateMatrix();
    kelp.setMatrixAt(i, dummy.matrix);
  }
  group.add(kelp);

  /* ------------------------------------------------------------- god rays */
  const rays = new Group();
  group.add(rays);
  for (let i = 0; i < Math.round(22 * q); i++) {
    const r = new Mesh(
      new PlaneGeometry(4 + Math.random() * 9, 130),
      new MeshBasicMaterial({
        /* the shared radial sprite gives the shaft soft edges and a soft tip;
           a bare plane reads as a lit rectangle standing in the water */
        map: o.glow || null,
        color: 0x9FE6FF, transparent: true, opacity: 0.10 + Math.random() * 0.12,
        blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: true
      })
    );
    r.position.set((Math.random() - 0.5) * width * 1.4, 42, z0 - Math.random() * len);
    r.rotation.set(0, Math.random() * 0.6 - 0.3, (Math.random() - 0.5) * 0.34);
    r.userData.phase = Math.random() * 6.28;
    r.userData.base = r.material.opacity;
    rays.add(r);
  }

  /* ------------------------------------------------------------- bubbles */
  const bubbleCount = Math.round(900 * q);
  let bubbles;
  {
    const pos = new Float32Array(bubbleCount * 3);
    const seed = new Float32Array(bubbleCount);
    for (let i = 0; i < bubbleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * width * 1.5;
      pos[i * 3 + 1] = Math.random() * 60 - 4;
      pos[i * 3 + 2] = z0 - Math.random() * len;
      seed[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    g.boundingSphere = new Sphere(new Vector3(0, 20, zMid), len);
    bubbles = new Points(g, new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime;
        uniform float uScale;
        varying float vA;
        void main(){
          vec3 p = position;
          /* rise, loop, and wobble on the way up */
          float rise = mod(uTime * (1.4 + aSeed * 2.2) + aSeed * 64.0, 64.0);
          p.y += rise;
          p.x += sin(uTime * 1.3 + aSeed * 30.0) * 0.7;
          vA = smoothstep(0.0, 6.0, rise) * (1.0 - smoothstep(46.0, 64.0, rise));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((0.5 + aSeed * 2.2) * uScale / max(-mv.z, 1.0), 1.0, 16.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision mediump float;
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          /* a bubble is a rim, not a dot */
          float rim = smoothstep(0.5, 0.34, r) * smoothstep(0.18, 0.36, r);
          float a = (rim * 0.9 + pow(max(0.0, 1.0 - r * 2.0), 6.0) * 0.5) * vA;
          gl_FragColor = vec4(vec3(0.78, 0.94, 1.0) * a, a);
        }`
    }));
    bubbles.frustumCulled = false;
    group.add(bubbles);
  }

  /* ---------------------------------------------------------------- fish */
  /* Body is a squashed octahedron, which gives a fish silhouette from every
     angle for eight triangles. The tail is a second instanced cone. */
  const fishCount = Math.round(220 * q);
  const fishMat = new MeshStandardMaterial({
    color: 0xffffff, roughness: 0.35, metalness: 0.6, envMapIntensity: 1.4,
    emissive: 0xffffff, emissiveIntensity: 0.18
  });
  const fish = new InstancedMesh(new OctahedronGeometry(0.5, 0), fishMat, fishCount);
  const tails = new InstancedMesh(
    new ConeGeometry(0.34, 0.7, 4),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.5, side: DoubleSide }),
    fishCount
  );
  const school = [];
  for (let i = 0; i < fishCount; i++) {
    /* a dozen schools, each on its own slow orbit around a centre */
    const s = i % 14;
    school.push({
      cx: ((s * 97) % 100 / 100 - 0.5) * width * 1.3,
      cy: 2 + ((s * 53) % 100 / 100) * 22,
      cz: z0 - ((s * 71) % 100 / 100) * len,
      r: 3 + Math.random() * 9,
      speed: 0.25 + Math.random() * 0.5,
      phase: Math.random() * 6.28,
      bob: Math.random() * 6.28,
      size: 0.5 + Math.random() * 1.1
    });
    col.setHex(Math.random() < 0.45 ? hue(i * 7) : 0xC8DCE8);
    fish.setColorAt(i, col);
    tails.setColorAt(i, col);
  }
  fish.instanceColor.needsUpdate = true;
  tails.instanceColor.needsUpdate = true;
  group.add(fish, tails);

  /* -------------------------------------------------------------- sharks */
  const sharks = [];
  for (let i = 0; i < 3; i++) {
    const s = new Group();
    const body = new Mesh(
      new OctahedronGeometry(1, 1),
      new MeshStandardMaterial({ color: 0x24384A, roughness: 0.62, metalness: 0.35, flatShading: true, envMapIntensity: 1.1 })
    );
    body.scale.set(0.95, 1.05, 4.2);
    s.add(body);
    const dorsal = new Mesh(new ConeGeometry(0.62, 2.4, 3), body.material);
    dorsal.position.set(0, 1.35, 0.2);
    dorsal.rotation.x = -0.3;
    s.add(dorsal);
    const tail = new Mesh(new ConeGeometry(1.5, 2.6, 3), body.material);
    tail.position.set(0, 0.3, 4.3);
    tail.rotation.x = Math.PI / 2;
    s.add(tail);
    for (const side of [-1, 1]) {
      const fin = new Mesh(new ConeGeometry(0.42, 2.6, 3), body.material);
      fin.rotation.set(0.2, 0, side * Math.PI / 2.3);
      fin.position.set(side * 1.1, -0.5, -0.4);
      s.add(fin);
    }

    s.scale.setScalar(2.2 + i * 0.7);
    s.userData = {
      r: 40 + i * 22,
      cz: z0 - (0.25 + i * 0.28) * len,
      cy: 12 + i * 7,
      speed: 0.06 + i * 0.014,
      phase: i * 2.1
    };
    group.add(s);
    sharks.push(s);
  }

  return {
    group,
    update(clock, camera) {
      caustics.offset.x = clock * 0.014;
      caustics.offset.y = clock * 0.022;
      for (const m of swayMats) if (m.userData.uTime) m.userData.uTime.value = clock;
      bubbles.material.uniforms.uTime.value = clock;

      for (const r of rays.children) {
        r.material.opacity = r.userData.base * (0.55 + 0.45 * Math.sin(clock * 0.5 + r.userData.phase));
      }

      for (let i = 0; i < fishCount; i++) {
        const f = school[i];
        const a = clock * f.speed + f.phase;
        const x = f.cx + Math.cos(a) * f.r;
        const z = f.cz + Math.sin(a) * f.r;
        const y = f.cy + Math.sin(clock * 0.9 + f.bob) * 1.1;
        /* face along the tangent of the orbit */
        const yaw = -a + Math.PI / 2;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(f.size * 0.7, f.size * 0.55, f.size * 1.7);
        dummy.updateMatrix();
        fish.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x - Math.sin(yaw) * f.size * 1.5, y, z - Math.cos(yaw) * f.size * 1.5);
        /* the tail beats — the only motion that makes a fish read as alive */
        dummy.rotation.set(Math.PI / 2, yaw + Math.sin(clock * 7 + f.phase) * 0.34, 0);
        dummy.scale.setScalar(f.size * 0.85);
        dummy.updateMatrix();
        tails.setMatrixAt(i, dummy.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
      tails.instanceMatrix.needsUpdate = true;

      for (const s of sharks) {
        const d = s.userData;
        const a = clock * d.speed + d.phase;
        s.position.set(Math.cos(a) * d.r, d.cy + Math.sin(a * 1.7) * 2.4, d.cz + Math.sin(a) * d.r * 0.55);
        s.rotation.y = -a + Math.PI / 2;
        s.rotation.z = Math.sin(a * 2) * 0.12;
      }
    }
  };
}
