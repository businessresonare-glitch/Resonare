/* ==========================================================================
   RESONARE — THE STREET

   The city chapter is about local trade, and until now it was towers. Towers
   are the skyline; the trade happens at ground level, and the camera drops to
   about three metres for the second half of the chapter — close enough that
   an empty road reads as an empty road.

   So the corridor the camera flies down gets a street: asphalt with lane
   markings and lit kerbs, food stalls with striped awnings and warm counter
   lights, street lamps, and light trails where traffic would be.

   Everything is instanced. There are roughly two hundred pieces of street
   furniture here and they cost eight draw calls, because every part type
   (bases, awnings, poles, lamp heads, signs …) is one InstancedMesh with a
   per-instance colour. Adding a part type costs a draw call; adding a
   hundred more stalls costs nothing.
   ========================================================================== */
import {
  BoxGeometry, CanvasTexture, Color, DoubleSide, Group, InstancedMesh, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  RepeatWrapping, SRGBColorSpace
} from 'three';

/* Diagonal stripes for the awnings — the one texture that says "market stall"
   in a single glance, drawn white so instanceColor can tint each canopy. */
let _stripeTex = null;
function stripeTexture() {
  if (_stripeTex) return _stripeTex;
  const s = 128, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(0,0,0,.62)';
  for (let i = -s; i < s * 2; i += 26) {
    g.save(); g.translate(i, 0); g.rotate(0.32);
    g.fillRect(0, -s, 13, s * 3);
    g.restore();
  }
  _stripeTex = new CanvasTexture(cv);
  _stripeTex.colorSpace = SRGBColorSpace;
  _stripeTex.wrapS = _stripeTex.wrapT = RepeatWrapping;
  return _stripeTex;
}

export function createStreet(opts) {
  const o = opts || {};
  const z0 = o.z0 || -84;
  const z1 = o.z1 || -238;
  const halfWidth = o.halfWidth || 15;      /* matches the clear corridor */
  const hue = o.hue || (() => 0xffffff);
  const stallCount = Math.round((o.stalls || 26) * (o.quality || 1));
  const lampCount = Math.round((o.lamps || 30) * (o.quality || 1));

  const group = new Group();
  const len = Math.abs(z1 - z0);
  const zMid = (z0 + z1) / 2;
  const dummy = new Object3D();
  const col = new Color();

  /* ------------------------------------------------------------- asphalt */
  const road = new Mesh(
    new PlaneGeometry(halfWidth * 2, len),
    new MeshStandardMaterial({
      color: 0x0B0820, roughness: 0.34, metalness: 0.9, envMapIntensity: 1.7
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.04, zMid);
  group.add(road);

  /* raised pavements either side, so the road reads as sunk between kerbs */
  for (const side of [-1, 1]) {
    const kerb = new Mesh(
      new BoxGeometry(7, 0.45, len),
      new MeshStandardMaterial({ color: 0x171040, roughness: 0.5, metalness: 0.5, envMapIntensity: 1.4 })
    );
    kerb.position.set(side * (halfWidth + 3.4), 0.22, zMid);
    group.add(kerb);

    /* the lit kerb edge — one long emissive strip, opposite hues per side */
    const edge = new Mesh(
      new BoxGeometry(0.22, 0.1, len),
      new MeshBasicMaterial({ color: side < 0 ? 0xC93AA8 : 0x1FA6C8 })
    );
    edge.position.set(side * halfWidth, 0.5, zMid);
    group.add(edge);
  }

  /* ------------------------------------------------- centre lane markings */
  {
    const dashes = Math.round(len / 9);
    const m = new InstancedMesh(
      new BoxGeometry(0.42, 0.03, 3.4),
      new MeshBasicMaterial({ color: 0xD8C49E }),
      dashes
    );
    for (let i = 0; i < dashes; i++) {
      dummy.position.set(0, 0.07, z0 - i * 9);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    group.add(m);
  }

  /* --------------------------------------------------------- light trails */
  /* Long thin emissive rails just above the tarmac in each direction. Static
     geometry, but at flight speed a light trail is what traffic looks like
     anyway, and it fills the road without a single moving object. */
  {
    const trails = 6;
    const m = new InstancedMesh(
      new BoxGeometry(0.3, 0.3, 1),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
      trails * 5
    );
    let n = 0;
    for (let i = 0; i < trails; i++) {
      for (let k = 0; k < 5; k++) {
        const lane = -halfWidth + 3 + (i % trails) * ((halfWidth * 2 - 6) / (trails - 1));
        const zz = z0 - Math.random() * len;
        dummy.position.set(lane, 0.55 + Math.random() * 0.5, zz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 8 + Math.random() * 16);
        dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix);
        m.setColorAt(n, col.setHex(lane < 0 ? 0xC4491F : 0xC9BC9A));
        n++;
      }
    }
    m.count = n;
    m.instanceColor.needsUpdate = true;
    group.add(m);
  }

  /* -------------------------------------------------------------- stalls */
  const bases = new InstancedMesh(
    new BoxGeometry(3.4, 2.1, 2.6),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.3, envMapIntensity: 1.2 }),
    stallCount
  );
  const counters = new InstancedMesh(
    new BoxGeometry(3.9, 0.22, 3.1),
    new MeshStandardMaterial({ color: 0xE8DCC2, roughness: 0.4, metalness: 0.4, envMapIntensity: 1.4 }),
    stallCount
  );
  /* two canted planes make the peaked canopy */
  const awnings = new InstancedMesh(
    new PlaneGeometry(4.2, 2.0),
    new MeshStandardMaterial({
      color: 0xffffff, map: stripeTexture(), side: DoubleSide,
      roughness: 0.85, metalness: 0.05, envMapIntensity: 0.8
    }),
    stallCount * 2
  );
  /* the warm bulb over every counter — this is what makes a stall read as
     open for business rather than as a shed */
  const bulbs = new InstancedMesh(
    new BoxGeometry(0.9, 0.16, 2.4),
    new MeshBasicMaterial({ color: 0xE8B87A }),
    stallCount
  );
  const signs = new InstancedMesh(
    new BoxGeometry(2.2, 0.7, 0.12),
    new MeshBasicMaterial({ color: 0xffffff }),
    stallCount
  );

  for (let i = 0; i < stallCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (halfWidth + 2.6 + Math.random() * 2.6);
    const z = z0 - 6 - (i / stallCount) * (len - 12) - Math.random() * 3;
    const yaw = side < 0 ? 0.28 : -0.28;

    dummy.position.set(x, 1.5, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bases.setMatrixAt(i, dummy.matrix);
    bases.setColorAt(i, col.setHex(0x1E1550).multiplyScalar(0.7 + Math.random() * 0.8));

    dummy.position.set(x - side * 0.5, 2.62, z);
    dummy.updateMatrix();
    counters.setMatrixAt(i, dummy.matrix);

    const canopy = hue(i * 3 + 1);
    for (let k = 0; k < 2; k++) {
      dummy.position.set(x + (k ? 1 : -1) * 0.95, 3.9, z);
      dummy.rotation.set(k ? -0.62 : 0.62, yaw, 0);
      dummy.rotation.z = 0;
      dummy.updateMatrix();
      awnings.setMatrixAt(i * 2 + k, dummy.matrix);
      awnings.setColorAt(i * 2 + k, col.setHex(canopy));
    }

    dummy.position.set(x - side * 0.4, 3.35, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x - side * 1.5, 4.8, z);
    dummy.rotation.set(0, yaw + side * 0.2, 0);
    dummy.updateMatrix();
    signs.setMatrixAt(i, dummy.matrix);
    signs.setColorAt(i, col.setHex(hue(i * 5 + 3)));
  }
  [bases, counters, awnings, bulbs, signs].forEach(m => {
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m);
  });

  /* --------------------------------------------------------- street lamps */
  {
    const poles = new InstancedMesh(
      new BoxGeometry(0.16, 7, 0.16),
      new MeshStandardMaterial({ color: 0x0E0A30, roughness: 0.4, metalness: 0.85, envMapIntensity: 1.5 }),
      lampCount
    );
    const heads = new InstancedMesh(
      new BoxGeometry(1.5, 0.22, 0.5),
      new MeshBasicMaterial({ color: 0xD9C7A4 }),
      lampCount
    );
    for (let i = 0; i < lampCount; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (halfWidth + 1.1);
      const z = z0 - 4 - (i / lampCount) * (len - 8);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, 3.5, z);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x - side * 0.7, 6.9, z);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    group.add(poles, heads);
  }

  return group;
}
