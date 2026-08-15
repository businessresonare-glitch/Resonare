/* ==========================================================================
   RESONARE — THE BLACK HOLE

   The first thing on the page. The camera hangs off a supermassive black hole
   for the length of the opening headline and then falls straight through it
   into the rest of the flight.

   Nothing here is a mesh someone modelled. It is four pieces of geometry and
   one shader:

     horizon    a black sphere. The shape you see is the absence of the disk
                behind it, which is why it needs no material at all.
     photon     the thin, blindingly bright ring hugging the horizon, where
                light orbits before it falls in.
     disk       a ring lying almost edge-on, shaded by the fragment program
                below.
     halo ×2    the same disk again, face-on, masked to its top and bottom
                halves. This is the Interstellar arc — light from the far side
                of the disk bent up over the hole and down under it. Faking it
                with two more copies of the disk is cheap and reads correctly
                from the only angle this camera ever sees it from.

   The shader is where the detail lives:

     - differential rotation. The inner edge orbits far faster than the outer,
       so the noise is advected by an angular velocity that falls off with
       radius. A disk that spins as one rigid piece reads as a painted texture.
     - three octaves of value noise for filaments, plus a second, slower set
       for the large density waves rolling through it.
     - a temperature ramp: white-hot at the inner edge through gold and amber
       to a dark crimson rim.
     - Doppler beaming. The side rotating toward you is blueshifted and
       relativistically brightened, the receding side dimmed. It is the single
       biggest cue that the thing is spinning and not just glowing, and it is
       one cosine.

   Additive, depthWrite off, drawn after everything else in the chapter.
   ========================================================================== */
import {
  AdditiveBlending, Color, DoubleSide, Group, Mesh, MeshBasicMaterial,
  RingGeometry, ShaderMaterial, SphereGeometry
} from 'three';

const VERT = /* glsl */`
  varying vec3 vPos;
  void main(){
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uInnerR;
  uniform float uOuterR;
  uniform float uOpacity;
  uniform float uHalf;       /* 0 = whole ring, +1 = keep top, -1 = keep bottom */
  uniform float uArc;        /* 1 = taper to a crescent away from the equator */
  uniform float uDoppler;    /* 0 = none, 1 = full beaming */
  uniform vec3  uHot;
  uniform vec3  uMid;
  uniform vec3  uCool;
  varying vec3 vPos;

  float hash(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ v += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main(){
    float r = length(vPos.xy);
    float ang = atan(vPos.y, vPos.x);

    /* masked halves make the two lensed arcs */
    if (uHalf > 0.5 && vPos.y < 0.0) discard;
    if (uHalf < -0.5 && vPos.y > 0.0) discard;

    float rn = clamp((r - uInnerR) / (uOuterR - uInnerR), 0.0, 1.0);

    /* Keplerian-ish: inner material laps the outer many times over */
    float spin = uTime * 1.35 / pow(rn + 0.16, 1.5);

    /* filaments, sheared around the disk */
    vec2 q = vec2(ang * 2.6 + spin, rn * 7.0);
    float fil = fbm(q * vec2(1.0, 2.2));
    fil = mix(fil, fbm(q * 3.1 + 11.0), 0.45);

    /* slow density waves rolling outward underneath the filaments */
    float wave = fbm(vec2(ang * 1.3 - spin * 0.35, rn * 2.4 - uTime * 0.09));

    float dens = pow(clamp(fil * 0.72 + wave * 0.5, 0.0, 1.0), 2.3);

    /* hot inside, cold rim, with a hard bright lip at the inner edge */
    vec3 col = mix(uHot, uMid, smoothstep(0.0, 0.34, rn));
    col = mix(col, uCool, smoothstep(0.32, 1.0, rn));
    /* the bright inner lip. Kept tight and modest — wide and hot, bloom
       smears it straight across the shadow and the hole stops being a hole. */
    float lip = exp(-rn * 24.0) * 0.85;

    /* relativistic beaming — the approaching side is far brighter */
    float dop = 0.5 + 0.5 * cos(ang - 1.5707963);
    float beam = mix(1.0, mix(0.22, 2.5, dop), uDoppler);

    /* fall off at both edges so the geometry's rim never shows */
    float edge = smoothstep(0.0, 0.06, rn) * (1.0 - smoothstep(0.80, 1.0, rn));

    /* the lensed copies taper away from the equator into crescents */
    float arc = mix(1.0, pow(abs(vPos.y) / max(r, 0.001), 1.15), uArc);

    float b = (dens * 1.05 + lip) * beam * edge * arc;
    gl_FragColor = vec4(col * b, clamp(b, 0.0, 1.0) * uOpacity);
    if (gl_FragColor.a < 0.004) discard;
  }
`;

export function createBlackHole(opts) {
  const o = opts || {};
  const horizonR = o.horizon || 7;
  const innerR = horizonR * 1.62;
  const outerR = o.outer || 34;
  const segments = o.segments || 220;

  const group = new Group();

  /* The horizon is not shaded, it is subtracted. Pure black, drawn first,
     with depthWrite on so the disk behind it is actually occluded. */
  const horizon = new Mesh(
    new SphereGeometry(horizonR, 96, 64),
    new MeshBasicMaterial({ color: 0x000000, fog: false })
  );
  horizon.renderOrder = 1;
  group.add(horizon);

  /* the photon sphere, seen edge-on as a ring of light around the shadow */
  const photon = new Mesh(
    new RingGeometry(horizonR * 1.005, horizonR * 1.055, 320),
    new MeshBasicMaterial({
      color: 0xFFFFFF, transparent: true, opacity: 1,
      blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
      fog: false, toneMapped: false
    })
  );
  photon.renderOrder = 4;
  group.add(photon);

  const uniforms = {
    uTime:    { value: 0 },
    uInnerR:  { value: innerR },
    uOuterR:  { value: outerR },
    uOpacity: { value: 1 },
    uHalf:    { value: 0 },
    uArc:     { value: 0 },
    uDoppler: { value: 1 },
    uHot:     { value: new Color(0xFFF6E4) },
    uMid:     { value: new Color(o.mid || 0xFFA23C) },
    uCool:    { value: new Color(o.cool || 0xB52F24) }
  };

  function diskMesh(half, doppler, arc) {
    const m = new Mesh(
      new RingGeometry(innerR, outerR, segments, 26),
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: Object.assign({}, uniforms, {
          uHalf: { value: half },
          uArc: { value: arc },
          uDoppler: { value: doppler }
        }),
        transparent: true, depthWrite: false, side: DoubleSide,
        blending: AdditiveBlending, fog: false, toneMapped: false
      })
    );
    return m;
  }

  /* the disk itself, tilted about nine degrees off edge-on */
  const disk = diskMesh(0, 1, 0);
  disk.rotation.x = -Math.PI / 2 + 0.16;
  disk.renderOrder = 2;
  group.add(disk);

  /* and its lensed image, arcing over the top and under the bottom */
  const haloTop = diskMesh(1, 0.55, 1);
  haloTop.scale.set(1, 0.46, 1);
  haloTop.position.y = horizonR * 0.16;
  haloTop.renderOrder = 3;
  group.add(haloTop);

  const haloBottom = diskMesh(-1, 0.55, 1);
  haloBottom.scale.set(1, 0.46, 1);
  haloBottom.position.y = -horizonR * 0.16;
  haloBottom.renderOrder = 3;
  group.add(haloBottom);

  const shaded = [disk, haloTop, haloBottom];

  return {
    group,
    horizonRadius: horizonR,
    /* `fall` runs 0 → 1 as the camera drops in.

       The obvious way to animate this — scale the whole thing up as the
       camera nears — is what produced the bug in the shipped build: the
       camera path passes through the centre, so at fall ~0.5 the horizon was
       a seven-metre black sphere four metres from the lens. It filled two
       thirds of the screen as a hard-edged black shape cut off by the frame,
       and it did it while the opening headline was still at full opacity.

       So the horizon does the opposite. It COLLAPSES: shrinking to nothing
       between fall 0.15 and 0.55, which reads as diving into the singularity
       and is never a black wall. The disk, meanwhile, scales up and whips
       past the lens, which is the part that should feel fast. */
    update(dt, clock, fall, camera) {
      const fade = 1 - fall;
      for (const m of shaded) {
        m.material.uniforms.uTime.value = clock;
        /* the disk holds its brightness far longer than the horizon holds
           its size — it is the thing you are falling through */
        m.material.uniforms.uOpacity.value = Math.pow(fade, 0.6);
      }

      const collapse = Math.max(0, 1 - Math.max(0, (fall - 0.15) / 0.4));
      horizon.scale.setScalar(collapse);
      horizon.visible = collapse > 0.01;
      photon.scale.setScalar(collapse);
      photon.material.opacity = collapse;
      photon.lookAt(camera.position);

      /* the halo arcs are a screen-space effect — they have to keep facing
         the camera or they resolve into two flat rings the moment it drifts */
      haloTop.quaternion.copy(camera.quaternion);
      haloBottom.quaternion.copy(camera.quaternion);

      disk.scale.setScalar(1 + fall * 2.4);
      haloTop.scale.set(1 + fall * 2.4, 0.46 * (1 + fall * 2.4), 1);
      haloBottom.scale.set(1 + fall * 2.4, 0.46 * (1 + fall * 2.4), 1);
      group.visible = fall < 0.995;
    }
  };
}
