/* ==========================================================================
   MK — WORLD
   A scroll-scrubbed camera flight through one continuous 3D world, drawn on
   canvas 2D with no libraries.

   The idea: the visitor never cuts between scenes. Scroll drives a camera
   along a single spline that starts high above a village road, drops into an
   open trench, flies through a box culvert, rises into a plant room past the
   switchboard, tracks along a machine control cabinet, and pulls back out over
   the finished site at dusk. Six stations, one unbroken move.

   Why not three.js / WebGL: the parent RESONARE site made a rule after a CDN
   stall — no external requests, vendor everything. The whole world here is
   flat-shaded convex quads, which canvas 2D draws perfectly well with a
   painter's algorithm. It is ~20KB of first-party code instead of ~600KB of
   library, and it degrades on a phone by dropping geometry rather than by
   failing to boot.

   Pipeline, once per frame:
     1. scroll -> eased progress -> camera eye/target off the spline
     2. window the prebuilt world to the props near the camera (binary search
        over props sorted by z, so distance culling is O(log n) not O(n))
     3. project, backface-cull, frustum-cull
     4. depth sort far-to-near, then paint with distance fog

   Geometry is built ONCE into world space and only re-projected per frame.
   Only the live bits — current pulses, water, dust, the beacon — are
   recomputed.
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;
  var canvas = doc.getElementById('world');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: false });

  var reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- math -- */
  function V(x, y, z) { return { x: x, y: y, z: z }; }
  function sub(a, b) { return V(a.x - b.x, a.y - b.y, a.z - b.z); }
  function add(a, b) { return V(a.x + b.x, a.y + b.y, a.z + b.z); }
  function mul(a, s) { return V(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  function norm(a) {
    var l = Math.sqrt(dot(a, a)) || 1;
    return V(a.x / l, a.y / l, a.z / l);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) { return V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t)); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  /* Catmull-Rom through the waypoints, so the camera arrives at every station
     exactly but never corners. Endpoints are duplicated to hold the tangent. */
  function spline(pts, t) {
    var n = pts.length - 1;
    var f = clamp(t, 0, 1) * n;
    var i = Math.min(Math.floor(f), n - 1);
    var u = f - i;
    var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
    var u2 = u * u, u3 = u2 * u;
    function c(a, b, cc, d) {
      return 0.5 * ((2 * b) + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u2 + (-a + 3 * b - 3 * cc + d) * u3);
    }
    return V(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z));
  }

  /* --------------------------------------------------------------- colour -- */
  var FOG = [10, 14, 32];          /* matches the CSS backdrop, so geometry dissolves */
  var LIGHT = norm(V(-0.34, 0.82, -0.46));

  function shade(rgb, n, amt) {
    var d = 0.42 + 0.58 * Math.max(0, dot(n, LIGHT));
    if (amt != null) d = lerp(1, d, amt);
    return [rgb[0] * d, rgb[1] * d, rgb[2] * d];
  }
  function fog(rgb, z) {
    var t = clamp((z - 55) / 230, 0, 1);
    t *= t;
    return 'rgb(' + ((rgb[0] + (FOG[0] - rgb[0]) * t) | 0) + ',' +
                    ((rgb[1] + (FOG[1] - rgb[1]) * t) | 0) + ',' +
                    ((rgb[2] + (FOG[2] - rgb[2]) * t) | 0) + ')';
  }
  function fogAlpha(z) { return 1 - clamp((z - 60) / 240, 0, 1); }

  var C = {
    asphalt:  [38, 44, 66],
    line:     [214, 214, 198],
    earth:    [86, 58, 40],
    earthDark:[54, 36, 26],
    subsoil:  [120, 84, 52],
    aggregate:[150, 142, 104],
    concrete: [154, 160, 176],
    concreteD:[104, 110, 128],
    steel:    [128, 146, 182],
    steelD:   [72, 84, 112],
    panel:    [186, 190, 198],
    panelD:   [120, 126, 140],
    cabinet:  [96, 108, 138],
    amber:    [245, 166, 35],
    amberHi:  [251, 198, 106],
    rust:     [200, 62, 24],
    live:     [63, 217, 138],
    water:    [40, 92, 120],
    glass:    [120, 170, 210],
    foliage:  [30, 62, 48],
    machine:  [58, 132, 92]
  };

  /* --------------------------------------------------------------- camera -- */
  var cam = {
    eye: V(0, 0, 0), target: V(0, 0, 1),
    r: V(1, 0, 0), u: V(0, 1, 0), f: V(0, 0, 1),
    focal: 900, cx: 0, cy: 0, roll: 0
  };

  function aim(eye, target, roll) {
    cam.eye = eye; cam.target = target; cam.roll = roll || 0;
    var f = norm(sub(target, eye));
    var upRef = V(Math.sin(cam.roll), Math.cos(cam.roll), 0);
    var r = norm(cross(f, upRef));
    /* looking straight down degenerates the cross product; nudge the reference */
    if (!isFinite(r.x) || (Math.abs(f.y) > 0.995)) r = norm(cross(f, V(0, 0, 1)));
    cam.f = f; cam.r = r; cam.u = cross(r, f);
  }

  var NEAR = 0.42;
  function project(p) {
    var d = sub(p, cam.eye);
    var z = dot(d, cam.f);
    if (z < NEAR) return null;
    var inv = cam.focal / z;
    return {
      x: cam.cx + dot(d, cam.r) * inv,
      y: cam.cy - dot(d, cam.u) * inv,
      z: z
    };
  }

  /* View space, kept separate from projection so polygons can be clipped
     before the divide. */
  function toView(p) {
    var d = sub(p, cam.eye);
    return { x: dot(d, cam.r), y: dot(d, cam.u), z: dot(d, cam.f) };
  }
  function projView(v) {
    var inv = cam.focal / v.z;
    return { x: cam.cx + v.x * inv, y: cam.cy - v.y * inv, z: v.z };
  }

  /* Sutherland-Hodgman against the near plane.

     This is not a refinement — without it the world has holes. Dropping any
     polygon with a vertex behind the camera throws away the whole polygon, and
     the biggest polygons are exactly the ones the camera travels inside: the
     road surface, the room floors, and every wall of the culvert bore. The
     tunnel rendered as a bare ring of ribs with no walls at all, because all
     fourteen wall quads span the camera. Clipping keeps the visible part and
     emits a 3-to-5 sided polygon instead. */
  function clipNear(vs, out) {
    out.length = 0;
    var n = vs.length, i, a, b, ain, bin, t;
    for (i = 0; i < n; i++) {
      a = vs[i]; b = vs[(i + 1) % n];
      ain = a.z >= NEAR; bin = b.z >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        t = (NEAR - a.z) / (b.z - a.z);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
      }
    }
    return out.length;
  }

  /* ----------------------------------------------------------------- world -- */
  /* Every prop is world-space geometry built once. kind:
       q  quad   {p:[4 pts], c:rgb, cull:bool, glow:num, flat:num}
       l  line   {a,b, c:rgb, w:px, glow}
       s  sprite {p, r:worldRadius, c:rgb}
       t  text   {p, s:string, size, c:rgb}                                   */
  var PROPS = [];

  function q(p, c, o) {
    o = o || {};
    var n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    PROPS.push({
      k: 'q', p: p, c: c, n: n,
      cull: o.cull !== false, glow: o.glow || 0, flat: o.flat,
      zc: (p[0].z + p[1].z + p[2].z + p[3].z) / 4
    });
  }
  function ln(a, b, c, w, glow) {
    PROPS.push({ k: 'l', a: a, b: b, c: c, w: w || 1, glow: glow || 0, zc: (a.z + b.z) / 2 });
  }
  function sp(p, r, c, glow) {
    PROPS.push({ k: 's', p: p, r: r, c: c, glow: glow || 0, zc: p.z });
  }
  function tx(p, s, size, c) {
    PROPS.push({ k: 't', p: p, s: s, size: size, c: c, zc: p.z });
  }

  /* An axis-aligned box. `faces` selects which sides to emit — leaving out the
     ones a camera can never reach is the cheapest optimisation there is. */
  function box(cx, cy, cz, w, h, d, c, o) {
    o = o || {};
    var x0 = cx - w / 2, x1 = cx + w / 2;
    var y0 = cy - h / 2, y1 = cy + h / 2;
    var z0 = cz - d / 2, z1 = cz + d / 2;
    var P = [
      V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0),
      V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)
    ];
    var skip = o.skip || '';
    if (skip.indexOf('n') < 0) q([P[4], P[5], P[6], P[7]], c, o); /* +z far  */
    if (skip.indexOf('s') < 0) q([P[1], P[0], P[3], P[2]], c, o); /* -z near */
    if (skip.indexOf('e') < 0) q([P[5], P[1], P[2], P[6]], c, o); /* +x      */
    if (skip.indexOf('w') < 0) q([P[0], P[4], P[7], P[3]], c, o); /* -x      */
    if (skip.indexOf('u') < 0) q([P[3], P[7], P[6], P[2]], c, o); /* +y top  */
    if (skip.indexOf('d') < 0) q([P[0], P[1], P[5], P[4]], c, o); /* -y base */
  }

  /* A run of pipe along z, drawn as an n-gon tube. `open` skips the caps so the
     camera can fly down the bore. */
  function tube(cx, cy, z0, z1, radius, seg, c, o) {
    o = o || {};
    var i, k, a0, a1, p0, p1, p2, p3, inward = o.inward ? -1 : 1;
    var fl = o.flat != null ? o.flat : 0.9;
    /* Split along the run as well as around it. A single quad for a 90m wall
       gets one colour and one sort depth, so the bore would neither fog with
       distance nor interleave correctly with the ribs inside it. */
    var span = z1 - z0;
    var rings = Math.max(1, Math.round(span / (o.step || 5)));
    for (k = 0; k < rings; k++) {
      var za = z0 + (span * k) / rings;
      var zb = z0 + (span * (k + 1)) / rings;
      for (i = 0; i < seg; i++) {
        a0 = (i / seg) * Math.PI * 2;
        a1 = ((i + 1) / seg) * Math.PI * 2;
        p0 = V(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, za);
        p1 = V(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, za);
        p2 = V(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, zb);
        p3 = V(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, zb);
        /* wall shading varies round the bore so a tunnel reads as round */
        var lit = 0.62 + 0.38 * Math.cos(a0 - Math.PI / 2);
        var cc = [c[0] * lit, c[1] * lit, c[2] * lit];
        if (inward > 0) q([p0, p1, p2, p3], cc, { cull: false, flat: fl });
        else q([p3, p2, p1, p0], cc, { cull: false, flat: fl });
      }
    }
  }

  /* A flat slab in the xz plane, split along z for the same reason as tube(). */
  function slab(x0, x1, y, z0, z1, c, o) {
    o = o || {};
    var step = o.step || 14;
    var n = Math.max(1, Math.round((z1 - z0) / step)), k;
    for (k = 0; k < n; k++) {
      var za = z0 + ((z1 - z0) * k) / n;
      var zb = z0 + ((z1 - z0) * (k + 1)) / n;
      q([V(x0, y, za), V(x1, y, za), V(x1, y, zb), V(x0, y, zb)], c,
        { cull: false, flat: o.flat != null ? o.flat : 0.5, glow: o.glow });
    }
  }

  /* ================================================================ STATIONS */
  /* The world runs along +z. Each station owns a z band; the camera spline
     below threads through them in the same order, so the flight is continuous.

       z   0 ..  90   approach — the village road
       z  90 .. 190   earthworks — trench, culverts, excavator
       z 190 .. 280   the culvert bore (camera goes underground)
       z 280 .. 380   plant room — switchboard and busbars
       z 380 .. 470   controls — PLC and drive cabinet
       z 470 .. 580   handover — the finished site at dusk                    */

  function buildGround() {
    /* The road surface, and a ground plane either side of it, from the start of
       the world to the point the trench opens. */
    var i;
    slab(-7, 7, 0, -30, 200, C.asphalt, { flat: 0.5 });
    /* verges */
    slab(-46, -7, -0.06, -30, 200, [24, 50, 40], { flat: 0.35 });
    slab(7, 46, -0.06, -30, 200, [24, 50, 40], { flat: 0.35 });

    /* centre line, dashed */
    for (i = -28; i < 96; i += 8) {
      q([V(-0.3, 0.02, i), V(0.3, 0.02, i), V(0.3, 0.02, i + 4), V(-0.3, 0.02, i + 4)], C.line, { cull: false, flat: 0 });
    }
    /* roadside poles and a catenary of cable — the electrical half of the trade */
    for (i = 0; i < 7; i++) {
      var z = -10 + i * 26, x = 9.5;
      ln(V(x, 0, z), V(x, 11, z), C.steelD, 2.4);
      ln(V(x - 2.4, 10.2, z), V(x + 0.6, 10.2, z), C.steelD, 1.6);
      if (i > 0) {
        /* the sag is faked with a mid point — two segments read as a curve */
        var pz = z - 26;
        ln(V(x, 10.2, pz), V(x, 9.1, z - 13), C.steelD, 1);
        ln(V(x, 9.1, z - 13), V(x, 10.2, z), C.steelD, 1);
      }
      sp(V(x - 2.2, 10.0, z), 0.5, C.amberHi, 1);   /* street lamp */
    }
    /* treeline — cheap billboards, two crossed quads each. Kept small and set
       well back: at hero framing these sit near the camera, and anything
       bigger stops reading as distant planting and becomes green slabs
       covering the headline. */
    for (i = 0; i < 42; i++) {
      var tz = -24 + i * 5.6 + (i % 3) * 1.7;
      var tx0 = (i % 2 ? -1 : 1) * (19 + (i * 7 % 26));
      var th = 5 + (i * 13 % 6);
      var tw = 1.7 + (i * 5 % 3) * 0.5;
      var cc = i % 3 ? [22, 46, 36] : [17, 38, 31];
      q([V(tx0 - tw, 0, tz), V(tx0 + tw, 0, tz), V(tx0 + tw, th, tz), V(tx0 - tw, th, tz)], cc, { cull: false, flat: 0.2 });
      q([V(tx0, 0, tz - tw), V(tx0, 0, tz + tw), V(tx0, th, tz + tw), V(tx0, th, tz - tw)], cc, { cull: false, flat: 0.2 });
    }
  }

  function buildEarthworks() {
    /* An open trench cut down the left of the carriageway, z 96..190, exactly
       the photograph: spoil to both sides, culvert boxes waiting, water in the
       invert. The trench is a box with no top and inward-facing walls. */
    var z0 = 96, z1 = 190, xL = -5.2, xR = -0.6, depth = -4.2;

    /* cut faces */
    q([V(xL, 0, z0), V(xL, depth, z0), V(xL, depth, z1), V(xL, 0, z1)], C.earth, { cull: false, flat: 0.75 });
    q([V(xR, depth, z0), V(xR, 0, z0), V(xR, 0, z1), V(xR, depth, z1)], C.subsoil, { cull: false, flat: 0.75 });
    q([V(xL, depth, z0), V(xR, depth, z0), V(xR, depth, z1), V(xL, depth, z1)], C.earthDark, { cull: false, flat: 0.6 });
    /* standing water in the bottom, catching the sky */
    q([V(xL + .15, depth + 0.28, z0), V(xR - .15, depth + 0.28, z0), V(xR - .15, depth + 0.28, z1), V(xL + .15, depth + 0.28, z1)],
      C.water, { cull: false, flat: 0.1, glow: 0.35 });
    /* the sawn asphalt edge */
    q([V(xL - 0.5, 0.06, z0), V(xL, 0.06, z0), V(xL, 0.06, z1), V(xL - 0.5, 0.06, z1)], [26, 28, 34], { cull: false, flat: 0.2 });

    /* spoil heaps — low pyramids of excavated earth alternating with aggregate */
    var i;
    for (i = 0; i < 16; i++) {
      var z = z0 + 3 + i * 5.9;
      var side = i % 2 ? -8.2 : 1.6;
      var h = 1.5 + (i * 7 % 5) * 0.28;
      var w = 2.6 + (i * 3 % 4) * 0.4;
      var cc = i % 3 === 0 ? C.aggregate : (i % 2 ? C.earth : C.subsoil);
      /* four-sided cone */
      var apex = V(side, h, z);
      q([V(side - w, 0, z - w), V(side + w, 0, z - w), apex, apex], cc, { cull: false, flat: 0.7 });
      q([V(side + w, 0, z - w), V(side + w, 0, z + w), apex, apex], cc, { cull: false, flat: 0.7 });
      q([V(side + w, 0, z + w), V(side - w, 0, z + w), apex, apex], cc, { cull: false, flat: 0.7 });
      q([V(side - w, 0, z + w), V(side - w, 0, z - w), apex, apex], cc, { cull: false, flat: 0.7 });
    }

    /* precast box culverts stacked on the verge, GSG-stamped like the photo */
    for (i = 0; i < 6; i++) {
      var bx = 5.6 + (i % 3) * 2.6;
      var by = 1.1 + Math.floor(i / 3) * 2.2;
      var bz = 104 + Math.floor(i / 3) * 0.4 + (i % 3) * 0.2;
      box(bx, by, bz, 2.3, 2.1, 2.3, C.concrete, { skip: 'd' });
      /* the bore */
      q([V(bx - 0.78, by - 0.7, bz - 1.16), V(bx + 0.78, by - 0.7, bz - 1.16),
         V(bx + 0.78, by + 0.7, bz - 1.16), V(bx - 0.78, by + 0.7, bz - 1.16)], [30, 34, 44], { cull: false, flat: 0 });
      tx(V(bx - 0.55, by + 0.45, bz - 1.18), 'MK', 0.42, [200, 70, 40]);
    }

    /* the backhoe: a CASE-yellow loader sitting across the trench at z 150 */
    var mx = 2.4, mz = 150;
    box(mx, 1.75, mz, 3.0, 1.9, 4.6, [196, 128, 34]);          /* body      */
    box(mx, 3.3, mz + 0.6, 2.4, 1.6, 2.2, [40, 46, 62]);        /* cab glass */
    box(mx, 0.72, mz - 1.7, 3.3, 1.44, 1.44, [30, 32, 40]);     /* wheels    */
    box(mx, 0.9, mz + 1.9, 3.5, 1.8, 1.8, [30, 32, 40]);
    /* loader arms and bucket, reaching forward over the cut */
    ln(V(mx - 1.4, 2.3, mz - 1.2), V(mx - 1.4, 1.5, mz - 4.6), [212, 118, 30], 5);
    ln(V(mx + 1.4, 2.3, mz - 1.2), V(mx + 1.4, 1.5, mz - 4.6), [212, 118, 30], 5);
    box(mx, 1.1, mz - 5.2, 3.4, 1.3, 1.5, [176, 96, 26]);       /* bucket    */
    /* backhoe boom folded over the back */
    ln(V(mx, 3.6, mz + 1.6), V(mx - 0.4, 4.6, mz + 4.4), [212, 118, 30], 4.5);
    ln(V(mx - 0.4, 4.6, mz + 4.4), V(mx - 0.6, 1.2, mz + 5.6), [212, 118, 30], 3.5);
    sp(V(mx, 4.5, mz + 0.2), 0.34, C.amberHi, 1);               /* beacon    */

    /* laid culvert run in the bottom of the trench, leading the eye onward */
    for (i = 0; i < 8; i++) {
      var lz = 158 + i * 4.1;
      box(-2.9, depth + 1.2, lz, 3.6, 2.2, 3.9, C.concreteD, { skip: 'ns' });
    }
  }

  function buildBore() {
    /* z 190..280 — the camera drops into the culvert and flies the bore. The
       tunnel is inward-facing so the walls surround the camera, with ring ribs
       every few metres to give the flight a sense of speed. */
    var i;
    /* The bore is lit from inside, not by the sun, so its walls are given a
       high base value and most of the directional shading is dialled out
       (flat 0.35). Left on the default the normals all point away from the
       light and a tunnel the camera is standing inside renders near-black. */
    tube(-2.9, -3.0, 188, 282, 2.6, 14, [96, 102, 118], { inward: true, flat: 0.62, step: 4 });
    for (i = 0; i < 24; i++) {
      var z = 190 + i * 3.9;
      /* rib */
      tube(-2.9, -3.0, z, z + 0.34, 2.42, 14, [62, 68, 84], { inward: true, flat: 0.7 });
      sp(V(-2.9 + 2.0, -3.0 + 1.6, z), 0.34, C.amberHi, 1);
    }
    /* water running the invert, and the light at the end */
    q([V(-5.3, -5.1, 190), V(-0.5, -5.1, 190), V(-0.5, -5.1, 282), V(-5.3, -5.1, 282)],
      C.water, { cull: false, flat: 0.1, glow: 0.3 });

    /* the bore opens into a service chamber — a shaft rising to the plant room */
    box(-2.9, -3.0, 286, 9, 9, 9, [66, 72, 88], { skip: 's' });
    for (i = 0; i < 9; i++) {                     /* ladder up the shaft */
      ln(V(-1.0, -7.2 + i * 1.15, 288.6), V(-4.8, -7.2 + i * 1.15, 288.6), C.steelD, 2);
    }
  }

  function buildPlantRoom() {
    /* z 288..380 — the camera rises out of the shaft into a lit plant room:
       the 415V switchboard from the photographs, DB boards, busbar trunking. */
    var i, z;
    var fy = 0;                                    /* floor level of the room */

    /* room shell — floor, ceiling, two walls. Interior faces only. */
    slab(-16, 10, fy, 288, 386, [64, 70, 88], { flat: 0.35 });
    slab(-16, 10, fy + 13, 288, 386, [34, 38, 52], { flat: 0.4 });
    q([V(-16, fy, 288), V(-16, fy, 386), V(-16, fy + 13, 386), V(-16, fy + 13, 288)], [58, 62, 78], { cull: false, flat: 0.55 });
    q([V(10, fy, 386), V(10, fy, 288), V(10, fy + 13, 288), V(10, fy + 13, 386)], [42, 46, 60], { cull: false, flat: 0.55 });

    /* ceiling strip lights */
    for (i = 0; i < 8; i++) {
      z = 296 + i * 11;
      q([V(-6.5, fy + 12.7, z), V(-1.5, fy + 12.7, z), V(-1.5, fy + 12.7, z + 2.4), V(-6.5, fy + 12.7, z + 2.4)],
        [255, 246, 226], { cull: false, flat: 0, glow: 0.9 });
    }

    /* THE SWITCHBOARD — a run of cubicles down the left wall, z 300..340.
       Each cubicle gets the ammeter/voltmeter pair, indicator lamps and the
       rotary isolators from the site photograph. */
    for (i = 0; i < 5; i++) {
      z = 302 + i * 7.2;
      var px = -13.4;
      box(px, fy + 4.2, z, 3.4, 8.4, 6.6, C.panel);
      /* door face detail, on the +x side facing the camera */
      var fx = px + 1.72;
      /* meters */
      q([V(fx, fy + 6.6, z - 2.2), V(fx, fy + 6.6, z - 0.6), V(fx, fy + 8.0, z - 0.6), V(fx, fy + 8.0, z - 2.2)],
        [232, 234, 238], { cull: false, flat: 0.2 });
      q([V(fx, fy + 6.6, z + 0.6), V(fx, fy + 6.6, z + 2.2), V(fx, fy + 8.0, z + 2.2), V(fx, fy + 8.0, z + 0.6)],
        [232, 234, 238], { cull: false, flat: 0.2 });
      /* indicator lamps — red / amber / blue, the classic three-phase set */
      sp(V(fx + 0.05, fy + 5.7, z - 1.4), 0.17, [226, 58, 46], 1);
      sp(V(fx + 0.05, fy + 5.7, z), 0.17, [245, 166, 35], 1);
      sp(V(fx + 0.05, fy + 5.7, z + 1.4), 0.17, [70, 140, 240], 1);
      /* rotary isolator */
      q([V(fx, fy + 4.4, z - 2.3), V(fx, fy + 4.4, z - 1.5), V(fx, fy + 5.2, z - 1.5), V(fx, fy + 5.2, z - 2.3)],
        [236, 196, 40], { cull: false, flat: 0.2 });
      /* louvres */
      var k;
      for (k = 0; k < 5; k++) {
        q([V(fx, fy + 1.1 + k * 0.42, z - 1.4), V(fx, fy + 1.1 + k * 0.42, z + 1.4),
           V(fx, fy + 1.32 + k * 0.42, z + 1.4), V(fx, fy + 1.32 + k * 0.42, z - 1.4)],
          [138, 144, 158], { cull: false, flat: 0.3 });
      }
      tx(V(fx + 0.06, fy + 0.55, z - 1.2), '415V', 0.4, [226, 78, 60]);
    }

    /* busbar trunking running the length of the room at high level, with the
       current pulse animated over it later */
    box(-11.6, fy + 10.6, 336, 1.1, 1.1, 84, [148, 156, 176], { skip: 'ns' });
    /* droppers into each cubicle */
    for (i = 0; i < 5; i++) {
      z = 302 + i * 7.2;
      ln(V(-11.6, fy + 10.1, z), V(-11.6, fy + 8.5, z), C.steelD, 3);
    }

    /* DB boards on the right wall — the consumer units from the photo */
    for (i = 0; i < 3; i++) {
      z = 312 + i * 16;
      box(8.4, fy + 5.4, z, 0.9, 4.6, 3.0, [138, 143, 156]);
      /* rows of MCBs */
      var r, m;
      for (r = 0; r < 4; r++) {
        for (m = 0; m < 9; m++) {
          q([V(7.93, fy + 3.7 + r * 1.02, z - 1.24 + m * 0.28), V(7.93, fy + 3.7 + r * 1.02, z - 1.06 + m * 0.28),
             V(7.93, fy + 4.5 + r * 1.02, z - 1.06 + m * 0.28), V(7.93, fy + 4.5 + r * 1.02, z - 1.24 + m * 0.28)],
            m % 4 === 3 ? [220, 92, 60] : [238, 240, 244], { cull: false, flat: 0.25 });
        }
      }
      /* conduit dropping out of the board into the floor */
      ln(V(8.0, fy + 3.0, z), V(8.0, fy + 0.1, z), [214, 216, 222], 3);
    }

    /* cable tray + conduit bundle crossing the ceiling */
    for (i = 0; i < 5; i++) {
      ln(V(-15.6, fy + 11.4 - i * 0.22, 292), V(9.6, fy + 11.4 - i * 0.22, 292 + i * 1.4), [188, 100, 40], 2);
    }
  }

  function buildControls() {
    /* z 386..470 — the machine hall with the PLC / VFD cabinet from the fourth
       photograph: green drives in rows, a PLC rail, a red-amber-green tower. */
    var i, z, k;
    slab(-16, 14, 0, 386, 474, [48, 54, 70], { flat: 0.35 });
    slab(-16, 14, 13, 386, 474, [34, 38, 52], { flat: 0.4 });
    /* high bay lighting — the hall is the payoff shot for the controls copy,
       so it gets its own light rather than relying on the sun vector */
    for (i = 0; i < 7; i++) {
      z = 392 + i * 12;
      q([V(-6, 12.6, z), V(-1, 12.6, z), V(-1, 12.6, z + 2.2), V(-6, 12.6, z + 2.2)],
        [255, 244, 220], { cull: false, flat: 0, glow: 0.9 });
      sp(V(-3.5, 12.4, z + 1.1), 0.7, [255, 236, 200], 0.8);
    }
    /* corrugated roof ribs */
    for (i = 0; i < 22; i++) {
      z = 388 + i * 4;
      ln(V(-16, 12.8, z), V(14, 12.8, z), [44, 48, 62], 2);
    }
    q([V(-16, 0, 386), V(-16, 0, 474), V(-16, 13, 474), V(-16, 13, 386)], [40, 44, 58], { cull: false, flat: 0.55 });

    /* the control cabinet, doors open toward the camera */
    var cz = 410, cxp = -9.5;
    box(cxp, 4.6, cz, 4.2, 9.2, 8.4, [150, 155, 166]);
    /* No swung-open door here. Modelled realistically it hinges straight into
       the camera's path and becomes a pale slab across two thirds of the frame
       exactly where the drives should be — the cabinet reads better as an open
       face, which is what the backplane detail below is drawn onto. */

    var fx = cxp + 2.12;   /* the backplane the camera looks at */
    /* PLC rail across the top */
    box(fx + 0.3, 7.9, cz - 1.2, 0.5, 1.1, 3.2, [58, 62, 76]);
    for (k = 0; k < 6; k++) sp(V(fx + 0.6, 8.2, cz - 2.5 + k * 0.5), 0.1, C.live, 1);
    /* terminal rows */
    for (k = 0; k < 26; k++) {
      q([V(fx, 6.0, cz - 3.4 + k * 0.26), V(fx, 6.0, cz - 3.28 + k * 0.26),
         V(fx, 6.8, cz - 3.28 + k * 0.26), V(fx, 6.8, cz - 3.4 + k * 0.26)],
        [226, 228, 234], { cull: false, flat: 0.25 });
    }
    /* the green VFD drives, two rows, exactly as they sit in the photo */
    for (k = 0; k < 6; k++) {
      box(fx + 0.42, 4.5, cz - 3.0 + k * 1.15, 0.85, 1.9, 0.92, C.machine);
      sp(V(fx + 0.9, 5.1, cz - 3.0 + k * 1.15), 0.09, [180, 255, 210], 1);
    }
    for (k = 0; k < 4; k++) {
      box(fx + 0.42, 2.3, cz - 2.4 + k * 1.15, 0.85, 1.9, 0.92, C.machine);
      sp(V(fx + 0.9, 2.9, cz - 2.4 + k * 1.15), 0.09, [180, 255, 210], 1);
    }
    /* contactors */
    for (k = 0; k < 8; k++) box(fx + 0.35, 0.9, cz - 3.2 + k * 0.8, 0.7, 1.0, 0.62, [50, 54, 68]);

    /* stack light on top */
    box(cxp + 1.2, 9.9, cz - 3.2, 0.5, 1.9, 0.5, [40, 44, 56]);
    sp(V(cxp + 1.2, 10.6, cz - 3.2), 0.2, [226, 58, 46], 1);
    sp(V(cxp + 1.2, 10.1, cz - 3.2), 0.2, [245, 166, 35], 1);
    sp(V(cxp + 1.2, 9.6, cz - 3.2), 0.2, C.live, 1);

    /* the machine the cabinet drives, on the right */
    box(8.5, 3.2, 421, 7.0, 6.4, 15, [104, 110, 126]);
    q([V(5.0, 4.6, 413.4), V(5.0, 4.6, 419.4), V(5.0, 7.4, 419.4), V(5.0, 7.4, 413.4)],
      C.glass, { cull: false, flat: 0.2, glow: 0.25 });   /* inspection window */
    /* conduit from cabinet to machine, along the floor */
    ln(V(cxp + 2.2, 0.25, cz + 3), V(5.0, 0.25, 419), [214, 216, 222], 3.5);

    /* pipework overhead — the plumbing half, running the hall */
    tube(-2.0, 11.2, 388, 472, 0.62, 10, [150, 158, 178]);
    tube(0.4, 11.2, 388, 472, 0.42, 10, [120, 128, 150]);
    for (i = 0; i < 11; i++) {
      z = 392 + i * 7.4;
      ln(V(-2.0, 12.9, z), V(-2.0, 11.9, z), C.steelD, 2.4);   /* hangers */
      ln(V(0.4, 12.9, z), V(0.4, 11.9, z), C.steelD, 2);
    }
  }

  function buildHandover() {
    /* z 476..580 — back outside at dusk. The finished facility, lit, with the
       new road and drainage running past it: the job signed off. */
    var i, k;
    slab(-60, 60, 0, 470, 600, [26, 44, 38], { flat: 0.35 });
    /* the completed carriageway, kerbed */
    slab(-7, 7, 0.04, 470, 600, C.asphalt, { flat: 0.5 });
    for (i = 0; i < 16; i++) {
      q([V(-0.3, 0.06, 474 + i * 8), V(0.3, 0.06, 474 + i * 8), V(0.3, 0.06, 478 + i * 8), V(-0.3, 0.06, 478 + i * 8)],
        C.line, { cull: false, flat: 0 });
    }
    /* kerb + the new gully covers over the culvert run */
    /* kerbing, deliberately dark: at full brightness a 130m unbroken top face
       reads as a pale ribbon slicing across the dusk shot rather than as kerb */
    box(-7.4, 0.16, 535, 0.8, 0.32, 130, [78, 84, 98], { skip: 'ns' });
    box(7.4, 0.16, 535, 0.8, 0.32, 130, [78, 84, 98], { skip: 'ns' });
    for (i = 0; i < 9; i++) box(-7.4, 0.34, 480 + i * 13, 0.9, 0.1, 1.6, [58, 62, 76], { skip: 'd' });

    /* the building — a lit industrial shed, windows warm */
    box(-22, 7, 512, 22, 14, 30, [40, 46, 62]);
    for (i = 0; i < 5; i++) {
      for (k = 0; k < 2; k++) {
        q([V(-11.0, 4.2 + k * 4.4, 500 + i * 5.4), V(-11.0, 4.2 + k * 4.4, 503.4 + i * 5.4),
           V(-11.0, 6.6 + k * 4.4, 503.4 + i * 5.4), V(-11.0, 6.6 + k * 4.4, 500 + i * 5.4)],
          [255, 214, 140], { cull: false, flat: 0, glow: 0.55 });
      }
    }
    /* roof plant + a beacon */
    box(-22, 14.8, 506, 5, 1.6, 5, [58, 62, 78]);
    sp(V(-22, 16.2, 506), 0.4, C.amberHi, 1);

    /* pole lighting down the new road */
    for (i = 0; i < 6; i++) {
      var z = 480 + i * 18;
      ln(V(9.5, 0, z), V(9.5, 12, z), C.steelD, 2.4);
      ln(V(9.5, 11.4, z), V(6.8, 11.8, z), C.steelD, 1.8);
      sp(V(6.6, 11.7, z), 0.62, [255, 226, 170], 1);
      /* pooled light on the road */
      q([V(2.5, 0.08, z - 5), V(9.5, 0.08, z - 5), V(9.5, 0.08, z + 5), V(2.5, 0.08, z + 5)],
        [52, 44, 28], { cull: false, flat: 0, glow: 0.1 });
    }
    /* distant treeline closing the world off */
    for (i = 0; i < 30; i++) {
      var tz = 560 + (i % 5) * 8;
      var tx0 = -56 + i * 3.9;
      var th = 9 + (i * 11 % 8);
      q([V(tx0 - 4, 0, tz), V(tx0 + 4, 0, tz), V(tx0 + 4, th, tz), V(tx0 - 4, th, tz)], [20, 34, 34], { cull: false, flat: 0.15 });
    }
  }

  /* --------------------------------------------------------- live elements -- */
  /* Recomputed each frame and appended after the static window: the current
     pulse on the busbar, water in the bore, dust in the sun, sparks at the
     cabinet. These are the only allocations in the frame loop, so they are
     drawn straight rather than pushed through PROPS. */
  var live = [];
  function buildLive(t) {
    live.length = 0;
    var i, p;

    /* current pulses travelling the busbar in the plant room */
    for (i = 0; i < 6; i++) {
      var pz = 296 + ((t * 34 + i * 15) % 84);
      live.push({ k: 's', p: V(-11.6, 10.6, pz), r: 0.42, c: C.amberHi, glow: 1 });
    }
    /* and down the overhead pipe run in the machine hall */
    for (i = 0; i < 5; i++) {
      var qz = 390 + ((t * 26 + i * 17) % 82);
      live.push({ k: 's', p: V(-2.0, 11.2, qz), r: 0.3, c: [120, 200, 255], glow: 1 });
    }
    /* dust motes drifting over the earthworks */
    for (i = 0; i < 26; i++) {
      var dz = 96 + ((i * 37 + t * 3) % 94);
      var dy = 0.6 + ((i * 13) % 40) / 10 + Math.sin(t * 0.7 + i) * 0.35;
      var dx = -8 + ((i * 23) % 15);
      live.push({ k: 's', p: V(dx, dy, dz), r: 0.075, c: [210, 190, 150], glow: 0.5 });
    }
    /* water glints running the bore */
    for (i = 0; i < 16; i++) {
      var wz = 190 + ((i * 23 + t * 22) % 92);
      live.push({ k: 's', p: V(-2.9 + Math.sin(i * 2.1) * 1.6, -4.9, wz), r: 0.13, c: [150, 220, 255], glow: 1 });
    }
    /* the backhoe beacon, flashing */
    var bf = (Math.sin(t * 5.2) + 1) / 2;
    live.push({ k: 's', p: V(2.4, 4.5, 150.2), r: 0.34 + bf * 0.5, c: C.amberHi, glow: bf });
    /* the stack light cycling */
    live.push({ k: 's', p: V(-8.3, 9.6, 406.8), r: 0.24 + Math.sin(t * 2) * 0.08, c: C.live, glow: 1 });
  }

  /* ------------------------------------------------------------ the flight -- */
  /* Eye and target waypoints. The pair is interpolated separately so the camera
     can look ahead into the next station while still finishing this one — that
     is what stops the joins from reading as cuts. */
  var EYE = [
    V(2.5, 26, -34),     /* 0  high over the road, approaching            */
    V(2.0, 12, 34),      /* 1  descending toward the works                */
    V(4.2, 5.2, 96),     /* 2  over the shoulder of the trench            */
    V(-1.2, 1.6, 132),   /* 3  down at ground level beside the cut        */
    V(-2.6, -1.4, 176),  /* 4  dropping into the trench                   */
    V(-2.9, -3.0, 206),  /* 5  inside the bore                            */
    V(-2.9, -3.0, 262),  /* 6  still in the bore, near the chamber        */
    V(-2.9, 1.5, 291),   /* 7  rising up the shaft                        */
    V(-3.6, 6.4, 300),   /* 8  into the plant room, level with the boards */
    V(-4.2, 5.6, 330),   /* 9  tracking the switchboard                   */
    V(-3.4, 5.0, 372),   /* 10 through the doorway to the machine hall    */
    V(-2.2, 4.9, 400),   /* 11 alongside the control cabinet              */
    V(-2.0, 5.4, 436),   /* 12 pulling away down the hall                 */
    V(1.0, 9.0, 474),    /* 13 out of the building                        */
    V(6.0, 18, 508),     /* 14 climbing over the finished road            */
    V(10, 34, 552)       /* 15 wide, dusk, job done                       */
  ];
  var LOOK = [
    V(1.0, 6, 40),
    V(0.5, 2, 96),
    V(-2.4, -1.0, 140),
    V(-2.8, -2.2, 176),
    V(-2.9, -3.0, 212),
    V(-2.9, -3.0, 250),
    V(-2.9, -2.4, 288),
    V(-6.0, 5.4, 300),
    V(-11.6, 5.6, 314),
    V(-12.0, 5.0, 346),
    V(-8.0, 4.6, 400),
    V(-7.6, 4.4, 412),
    /* held near the cabinet rather than snapping down the hall: waypoint 12's
       target is what the camera is easing toward while the controls copy is
       still on screen, and a far target here swings the cabinet out of frame
       before the reader has finished the section */
    V(-4.0, 4.8, 446),
    V(-8.0, 7.0, 500),
    V(-14, 8, 512),
    V(-6, 6, 540)
  ];

  /* -------------------------------------------------------------- pacing --
     Scroll position and spline position are NOT the same curve. The waypoints
     are spaced by distance through the world, but the copy is spaced by
     section height, so feeding raw scroll into the spline puts the reader on
     the tunnel while the text beside them talks about switchboards.

     This remaps one to the other, so a station's geometry is in frame exactly
     while its section is the one being read.

     Each station names the section it belongs to and the spline t that frames
     its geometry. Where that section actually sits in the scroll is MEASURED
     from the DOM rather than written down here: section heights differ between
     desktop and mobile (min-height:100svh vs auto), and copy edits move them
     again, so any hardcoded table is wrong for at least one viewport. It is
     rebuilt on load and on resize.                                           */
  var STATIONS = [
    { id: 'hero',     t: 0.00 },   /* high over the road, approaching   */
    { id: 'civil',    t: 0.17 },   /* over the shoulder of the trench   */
    { id: 'water',    t: 0.37 },   /* inside the culvert bore           */
    { id: 'power',    t: 0.565 },  /* alongside the 415V switchboard    */
    { id: 'controls', t: 0.735 },  /* at the PLC / VFD cabinet          */
    { id: 'proof',    t: 0.885 },  /* back outside, site finished       */
    { id: 'quote',    t: 0.970 }   /* wide, dusk                        */
  ];
  var PACE = [[0, 0], [1, 1]];

  function buildPace() {
    var max = doc.documentElement.scrollHeight - global.innerHeight;
    var next = [], i, el, r, centre, frac;
    for (i = 0; i < STATIONS.length; i++) {
      el = doc.getElementById(STATIONS[i].id);
      if (!el) continue;
      r = el.getBoundingClientRect();
      centre = r.top + global.scrollY + r.height / 2 - global.innerHeight / 2;
      frac = max > 0 ? clamp(centre / max, 0, 1) : 0;
      /* keep it strictly increasing — pace() walks it in order, and a section
         that measures out of sequence would make the camera jump backwards */
      if (next.length && frac <= next[next.length - 1][0]) continue;
      next.push([frac, STATIONS[i].t]);
    }
    if (!next.length) { PACE = [[0, 0], [1, 1]]; return; }
    if (next[0][0] > 0) next.unshift([0, 0]);
    if (next[next.length - 1][0] < 1) next.push([1, 1]);
    PACE = next;
  }

  function pace(s) {
    var i;
    for (i = 0; i < PACE.length - 1; i++) {
      if (s <= PACE[i + 1][0]) {
        var a = PACE[i], b = PACE[i + 1];
        var span = b[0] - a[0];
        var u = span > 0 ? (s - a[0]) / span : 0;
        return a[1] + (b[1] - a[1]) * smooth(u);
      }
    }
    return PACE[PACE.length - 1][1];
  }

  /* ----------------------------------------------------------- projection -- */
  var W = 0, H = 0, DPR = 1;
  var order = [];          /* reusable draw list, refilled each frame         */

  function resize() {
    var vw = global.innerWidth, vh = global.innerHeight;
    DPR = Math.min(global.devicePixelRatio || 1, vw > 1400 ? 1.6 : 2);
    W = vw; H = vh;
    canvas.width = Math.round(vw * DPR);
    canvas.height = Math.round(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cam.cx = vw / 2;
    cam.cy = vh / 2;
    /* a 62deg vertical field, but never so wide on a phone that the world
       shrinks to nothing — portrait gets a longer lens */
    var fovY = vw < 760 ? 0.86 : 1.08;
    cam.focal = (vh / 2) / Math.tan(fovY / 2);
    buildPace();
  }

  /* PROPS sorted by z once, so the per-frame window is a binary search */
  var sorted = null;
  function indexProps() {
    sorted = PROPS.slice().sort(function (a, b) { return a.zc - b.zc; });
  }
  function lowerBound(zv) {
    var lo = 0, hi = sorted.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (sorted[mid].zc < zv) lo = mid + 1; else hi = mid; }
    return lo;
  }

  var BEHIND = 34, AHEAD = 250;

  /* Walks list[from..to) rather than a sliced copy — slicing the visible window
     every frame was allocating a few hundred-element array 60 times a second
     and handing the GC a steady drip of garbage for no reason. */
  var viewBuf = [], clipBuf = [];   /* scratch, reused every quad */

  function collect(list, from, to, out) {
    var i, n, p, a, b, s, sc, item;
    for (i = from; i < to; i++) {
      item = list[i];
      if (item.k === 'q') {
        /* backface cull before projecting: cheaper, and it halves box cost */
        if (item.cull && dot(item.n, sub(item.p[0], cam.eye)) > 0) continue;

        viewBuf.length = 0;
        for (n = 0; n < 4; n++) viewBuf.push(toView(item.p[n]));
        if (!clipNear(viewBuf, clipBuf)) continue;

        var pts = [], depth = 0;
        var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for (n = 0; n < clipBuf.length; n++) {
          p = projView(clipBuf[n]);
          pts.push(p); depth += p.z;
          if (p.x < minx) minx = p.x;
          if (p.x > maxx) maxx = p.x;
          if (p.y < miny) miny = p.y;
          if (p.y > maxy) maxy = p.y;
        }
        depth /= pts.length;
        if (maxx < -60 || minx > W + 60 || maxy < -60 || miny > H + 60) continue;
        out.push({ k: 'q', pts: pts, d: depth, c: item.c, n: item.n, glow: item.glow, flat: item.flat });
      } else if (item.k === 'l') {
        var va = toView(item.a), vb = toView(item.b), tt;
        if (va.z < NEAR && vb.z < NEAR) continue;
        if (va.z < NEAR) {
          tt = (NEAR - va.z) / (vb.z - va.z);
          va = { x: va.x + (vb.x - va.x) * tt, y: va.y + (vb.y - va.y) * tt, z: NEAR };
        } else if (vb.z < NEAR) {
          tt = (NEAR - vb.z) / (va.z - vb.z);
          vb = { x: vb.x + (va.x - vb.x) * tt, y: vb.y + (va.y - vb.y) * tt, z: NEAR };
        }
        a = projView(va); b = projView(vb);
        if ((a.x < -60 && b.x < -60) || (a.x > W + 60 && b.x > W + 60)) continue;
        if ((a.y < -60 && b.y < -60) || (a.y > H + 60 && b.y > H + 60)) continue;
        out.push({ k: 'l', a: a, b: b, d: (a.z + b.z) / 2, c: item.c, w: item.w, glow: item.glow });
      } else if (item.k === 's') {
        s = project(item.p);
        if (!s) continue;
        sc = (cam.focal / s.z) * item.r;
        if (sc < 0.25) continue;
        /* Screen size is capped. A lamp the camera passes within a metre of has
           an unbounded projected radius, and an uncapped additive gradient at
           that size stops reading as a light — it becomes a coloured blob over
           half the viewport. */
        if (sc > 20) sc = 20;
        if (s.x < -80 || s.x > W + 80 || s.y < -80 || s.y > H + 80) continue;
        out.push({ k: 's', s: s, d: s.z, r: sc, c: item.c, glow: item.glow });
      } else if (item.k === 't') {
        s = project(item.p);
        if (!s) continue;
        sc = (cam.focal / s.z) * item.size;
        if (sc < 5 || sc > 44) continue;
        if (s.x < -100 || s.x > W + 100 || s.y < -60 || s.y > H + 60) continue;
        out.push({ k: 't', s: s, d: s.z, size: sc, c: item.c, str: item.str || item.s });
      }
    }
  }

  function byDepth(x, y) { return y.d - x.d; }

  function paint() {
    var i, o, a;
    ctx.fillStyle = '#070A18';
    ctx.fillRect(0, 0, W, H);

    /* sky wash — a warm horizon that survives the fog, so the world always has
       somewhere to recede to */
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#131A36');
    g.addColorStop(0.52, '#0D1226');
    g.addColorStop(1, '#070A18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    order.sort(byDepth);

    for (i = 0; i < order.length; i++) {
      o = order[i];
      a = fogAlpha(o.d);
      if (a <= 0.012) continue;

      if (o.k === 'q') {
        var col = o.flat != null ? shade(o.c, o.n, o.flat) : shade(o.c, o.n);
        ctx.globalAlpha = a;
        ctx.fillStyle = fog(col, o.d);
        ctx.beginPath();
        ctx.moveTo(o.pts[0].x, o.pts[0].y);
        for (var vi = 1; vi < o.pts.length; vi++) ctx.lineTo(o.pts[vi].x, o.pts[vi].y);
        ctx.closePath();
        ctx.fill();
        if (o.glow) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * o.glow * 0.5;
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (o.k === 'l') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = fog(o.c, o.d);
        /* capped for the same reason as sprites — a pole the camera skims
           otherwise renders as a grey bar across the whole frame */
        ctx.lineWidth = Math.max(0.6, Math.min(o.w * (cam.focal / o.d) * 0.045, 13));
        ctx.beginPath();
        ctx.moveTo(o.a.x, o.a.y);
        ctx.lineTo(o.b.x, o.b.y);
        ctx.stroke();
      } else if (o.k === 's') {
        var r = Math.max(0.6, o.r);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * (0.42 + 0.58 * (o.glow || 0));
        var rg = ctx.createRadialGradient(o.s.x, o.s.y, 0, o.s.x, o.s.y, r * 3.4);
        rg.addColorStop(0, 'rgba(' + (o.c[0] | 0) + ',' + (o.c[1] | 0) + ',' + (o.c[2] | 0) + ',1)');
        rg.addColorStop(0.28, 'rgba(' + (o.c[0] | 0) + ',' + (o.c[1] | 0) + ',' + (o.c[2] | 0) + ',0.5)');
        rg.addColorStop(1, 'rgba(' + (o.c[0] | 0) + ',' + (o.c[1] | 0) + ',' + (o.c[2] | 0) + ',0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(o.s.x, o.s.y, r * 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (o.k === 't') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = fog(o.c, o.d);
        ctx.font = '700 ' + o.size.toFixed(1) + 'px "Archivo Narrow", "Archivo", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.str, o.s.x, o.s.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- driving -- */
  var scrollT = 0, easedT = 0, clock = 0, running = false, raf = 0;

  function readScroll() {
    var max = doc.documentElement.scrollHeight - global.innerHeight;
    scrollT = max > 0 ? clamp(global.scrollY / max, 0, 1) : 0;
  }

  function frame(ts) {
    raf = 0;
    if (!running) return;

    clock = ts / 1000;
    /* ease the scroll so a flicked wheel becomes a glide, not a jump */
    easedT += (scrollT - easedT) * (reduceMotion ? 1 : 0.085);

    var t = pace(clamp(easedT, 0, 1));
    var eye = spline(EYE, t);
    var look = spline(LOOK, t);

    if (!reduceMotion) {
      /* a slow handheld drift, scaled down inside the tight sections so the
         camera never clips a wall */
      var tight = (t > 0.28 && t < 0.52) ? 0.25 : 1;
      eye = add(eye, V(Math.sin(clock * 0.31) * 0.34 * tight,
                       Math.sin(clock * 0.44 + 1.3) * 0.22 * tight, 0));
    }
    aim(eye, look, Math.sin(t * Math.PI * 2) * 0.012);

    order.length = 0;
    collect(sorted, lowerBound(cam.eye.z - BEHIND), lowerBound(cam.eye.z + AHEAD), order);

    if (!reduceMotion) { buildLive(clock); collect(live, 0, live.length, order); }

    paint();
    if (running) raf = global.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    if (!raf) raf = global.requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
  }

  /* ------------------------------------------------------------------ boot -- */
  buildGround();
  buildEarthworks();
  buildBore();
  buildPlantRoom();
  buildControls();
  buildHandover();
  indexProps();

  resize();
  readScroll();
  easedT = scrollT;

  global.addEventListener('resize', function () { resize(); }, { passive: true });
  /* Web fonts and lazy images resize the sections after first paint, which
     moves every station. Re-measure once the page has finished settling. */
  global.addEventListener('load', function () { resize(); readScroll(); });
  global.addEventListener('scroll', readScroll, { passive: true });
  doc.addEventListener('visibilitychange', function () {
    doc.hidden ? stop() : start();
  });

  if (reduceMotion) {
    /* one static frame, then nothing — no loop at all */
    easedT = scrollT;
    running = true;
    frame(0);
    running = false;
    global.addEventListener('scroll', function () {
      readScroll(); easedT = scrollT;
      running = true; frame(0); running = false;
    }, { passive: true });
  } else {
    start();
  }

  /* expose a little of it, for the progress rail and for debugging */
  global.MKWorld = {
    progress: function () { return easedT; },
    props: function () { return PROPS.length; },
    stop: stop, start: start
  };

})(window);
