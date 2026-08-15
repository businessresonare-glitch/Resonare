/* ==========================================================================
   RESONARE — STARFIELD

   Replaces the coloured dust motes. Those were square points at a fixed size
   and they read as confetti — which is fine as texture and wrong as sky.

   A star needs three things the default PointsMaterial cannot give you:

     - a size distribution. Real skies are mostly faint pinpricks with a
       handful of bright ones. A uniform size reads as a pattern.
     - diffraction spikes. The cross through a bright star is the single cue
       that says "point source seen through a lens" rather than "dot".
     - twinkle, at a different phase per star. One global pulse reads as the
       whole sky breathing.

   All three want per-particle attributes, so this is a small ShaderMaterial
   rather than a PointsMaterial. One draw call, no texture.

   Colours are drawn mostly from the real stellar range — cold blue-white
   through white to warm amber — with a minority taken off the site's own
   spectrum, so the sky belongs to the same world as the city under it.
   ========================================================================== */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points,
  ShaderMaterial, Sphere, Vector3
} from 'three';

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uFade;
  varying vec3 vColor;
  varying float vTwinkle;

  void main(){
    vColor = color;
    /* two detuned sines so the twinkle never settles into a visible beat */
    float t = sin(uTime * 1.7 + aPhase) * 0.5 + sin(uTime * 0.9 + aPhase * 2.3) * 0.5;
    vTwinkle = (0.62 + 0.38 * t) * uFade;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    /* clamped: without a ceiling, a bright star that the flight passes close
       to becomes a 1200px disc across the whole frame */
    gl_PointSize = clamp(aSize * uScale / max(-mv.z, 1.0), 0.7, 22.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  varying vec3 vColor;
  varying float vTwinkle;

  void main(){
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p);
    if (r > 0.5) discard;

    /* the core: a tight falloff, not a disc */
    float core = pow(max(0.0, 1.0 - r * 2.0), 3.2);

    /* and the spikes. Two thin crosses at right angles, narrow enough that
       only the brightest stars show them once the core is multiplied in. */
    float sx = pow(max(0.0, 1.0 - abs(p.y) * 26.0), 2.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
    float sy = pow(max(0.0, 1.0 - abs(p.x) * 26.0), 2.0) * max(0.0, 1.0 - abs(p.y) * 2.2);

    float a = core + (sx + sy) * 0.5 * core;
    gl_FragColor = vec4(vColor * a * vTwinkle, a);
  }
`;

/* the real stellar sequence, plus a few of ours */
const STELLAR = [0xCBDCFF, 0xE6EEFF, 0xFFFFFF, 0xFFF4E8, 0xFFE3C0, 0xFFD1A0];

export function createStars(opts) {
  const o = opts || {};
  const count = o.count || 3200;
  const spectrum = o.spectrum || [];

  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const c = new Color();

  for (let i = 0; i < count; i++) {
    /* Held well off the flight line so they read as sky. Scattered close in,
       the parallax turns them into snow blowing past the windscreen. */
    pos[i * 3]     = (Math.random() - 0.5) * 620;
    pos[i * 3 + 1] = Math.random() * 320 - 50;
    pos[i * 3 + 2] = 90 - Math.random() * 1000;

    /* heavily weighted to faint — a fifth power keeps the bright ones rare
       enough that they read as individual stars rather than as noise */
    size[i] = 0.55 + Math.pow(Math.random(), 5) * 6.2;
    phase[i] = Math.random() * 6.283;

    if (spectrum.length && Math.random() < 0.14) c.setHex(spectrum[(Math.random() * spectrum.length) | 0]);
    else c.setHex(STELLAR[(Math.random() * STELLAR.length) | 0]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('aSize', new BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new BufferAttribute(phase, 1));
  geo.boundingSphere = new Sphere(new Vector3(0, 0, -400), 900);

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 420 },
      uFade: { value: 1 }
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false
  });

  const points = new Points(geo, material);
  points.frustumCulled = false;

  return {
    points,
    /* fade the whole sky out as the flight climbs into daylight — stars over
       a cream horizon are the one thing that would give the trick away */
    update(clock, dpr, daylight) {
      material.uniforms.uTime.value = clock;
      material.uniforms.uScale.value = 420 * (dpr || 1);
      material.uniforms.uFade.value = 1 - daylight;
      points.visible = daylight < 0.98;
    }
  };
}
