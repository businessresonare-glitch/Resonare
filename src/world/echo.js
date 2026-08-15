/* ==========================================================================
   RESONARE — ECHO

   The brand mark is a resonance: concentric rings travelling outward from a
   point. This is that, in 3D, reusable anywhere in the flight.

   It is used three times and means something slightly different each time:

     - at the black hole, as the transition. The hole collapses and what comes
       out of it is an echo, which washes over the camera and leaves you in
       the ocean. That is the whole reason there is no longer a black sphere
       hanging in front of the next chapter — the hole does not survive the
       cut, its echo does.
     - over the reef, as sonar. A ping goes out, and what it finds lights up.
     - through the work corridor, as the echo of the work itself.

   Rings are billboarded and additive, expanding on a loop with a stagger
   between them. One geometry, one material per ring, no shader.
   ========================================================================== */
import {
  AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry
} from 'three';

export function createEcho(opts) {
  const o = opts || {};
  const count = o.count || 4;
  const maxR = o.radius || 40;
  const thickness = o.thickness || 0.012;   /* as a fraction of the radius */
  const colors = o.colors || [0xFFFFFF];
  const period = o.period || 3.4;           /* seconds for one ring to travel */

  const group = new Group();
  const rings = [];

  for (let i = 0; i < count; i++) {
    const m = new Mesh(
      new RingGeometry(1 - thickness * 2, 1, 128),
      new MeshBasicMaterial({
        color: colors[i % colors.length], transparent: true, opacity: 0,
        side: DoubleSide, blending: AdditiveBlending, depthWrite: false, fog: false
      })
    );
    m.userData.offset = i / count;
    group.add(m);
    rings.push(m);
  }

  return {
    group,
    /* `strength` scales the whole thing 0 → 1 so a chapter can bring its echo
       in and out; `burst` (0 → 1) overrides the loop with a single expanding
       pulse, which is what the black hole transition uses. */
    update(clock, camera, strength, burst) {
      const s = strength === undefined ? 1 : strength;
      group.visible = s > 0.004;
      if (!group.visible) return;

      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        let p;
        if (burst === undefined) {
          p = ((clock / period) + r.userData.offset) % 1;
        } else {
          /* staggered: outer rings launch later, so the burst reads as a wave
             rather than as every ring leaving at once */
          p = Math.min(1, Math.max(0, burst * 1.5 - r.userData.offset * 0.5));
        }
        r.scale.setScalar(0.06 + p * maxR);
        /* bright as it leaves, gone by the time it passes you */
        r.material.opacity = Math.sin(Math.PI * Math.min(1, p)) * 0.85 * s;
        r.quaternion.copy(camera.quaternion);
      }
    }
  };
}
