/* ==========================================================================
   RESONARE — THE WARP

   What replaces the black blob. As the camera falls through the horizon, the
   light around it stretches into streaks and rushes past — the transition
   from the void to the city is a fall, not a cut.

   A shell of thin emissive bars laid along -Z around the flight line. They
   are invisible until the fall starts, then they lengthen and brighten
   together; because the camera is moving through them at the same time, the
   apparent speed is the sum of both, which is why a fairly gentle stretch
   reads as very fast.

   One InstancedMesh, one draw call, no shader.
   ========================================================================== */
import {
  AdditiveBlending, BoxGeometry, Color, InstancedMesh, MeshBasicMaterial,
  Object3D
} from 'three';

export function createWarp(opts) {
  const o = opts || {};
  const count = Math.round((o.count || 190) * (o.quality || 1));
  const z = o.z || -62;
  const spread = o.spread || 130;
  const hue = o.hue || (() => 0xffffff);

  const mesh = new InstancedMesh(
    new BoxGeometry(0.16, 0.16, 1),
    new MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: AdditiveBlending, depthWrite: false, fog: false
    }),
    count
  );
  mesh.frustumCulled = false;

  const dummy = new Object3D();
  const col = new Color();
  const seeds = [];

  for (let i = 0; i < count; i++) {
    /* a hollow shell — nothing on the axis itself, or the streaks stack up
       in the middle of frame into a solid bar */
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.pow(Math.random(), 0.6) * 34;
    seeds.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.8,
      z: z + (Math.random() - 0.5) * spread,
      len: 6 + Math.random() * 26
    });
    col.setHex(Math.random() < 0.55 ? 0xFFFFFF : hue(i));
    mesh.setColorAt(i, col);
  }
  mesh.instanceColor.needsUpdate = true;

  let built = -1;

  return {
    mesh,
    /* `fall` 0 → 1. Rebuilding the matrices costs 260 writes and only runs
       while the transition is actually on screen. */
    update(fall) {
      const on = fall > 0.001 && fall < 0.999;
      mesh.visible = on;
      if (!on) { built = -1; return; }

      mesh.material.opacity = Math.sin(Math.PI * Math.min(1, fall)) * 0.5;

      const q = Math.round(fall * 60);
      if (q === built) return;
      built = q;

      const stretch = 1 + fall * fall * 18;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        dummy.position.set(s.x * (1 - fall * 0.35), s.y * (1 - fall * 0.35), s.z - fall * 40);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, s.len * stretch);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}
