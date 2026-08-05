/* ==========================================================================
   RESONARE — R3D
   A small, dependency-free 3D renderer built on canvas 2D.

   Why not three.js: the site previously pulled Lenis off a public CDN, and a
   blocked or slow CDN stalled the whole page. Everything here is ~10KB of
   first-party code — projection, depth sorting and an additive glow pass —
   which is all these scenes need and costs one request we already make.

   Each scene is mounted declaratively:  <canvas data-r3d="resonance"></canvas>

   Budgeting rules applied throughout:
     - device pixel ratio capped at 2 (retina phones gain nothing above it)
     - point counts scale down on small viewports
     - the loop is parked entirely when the canvas scrolls out of view or the
       tab is hidden, so an idle background scene costs zero frames
     - prefers-reduced-motion renders a single static frame and stops
   ========================================================================== */
(function (global) {
  'use strict';

  var PALETTE = {
    rust:  [222, 90, 60],
    gold:  [244, 199, 126],
    indigo:[108, 107, 232],
    cream: [246, 242, 233],
    navy:  [10, 9, 82]
  };

  var reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* One radial-gradient sprite, drawn once and blitted per particle. Building a
     gradient per particle per frame is what makes naive canvas glow crawl. */
  var SPRITE_R = 32;
  var spriteCache = {};
  function sprite(color) {
    var key = color.join(',');
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas');
    c.width = c.height = SPRITE_R * 2;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.25, rgba(color, 0.55));
    grad.addColorStop(0.55, rgba(color, 0.13));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE_R * 2, SPRITE_R * 2);
    spriteCache[key] = c;
    return c;
  }

  /* ---- Stage: sizing, projection, pointer, lifecycle --------------------- */
  function Stage(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.opts = opts || {};
    this.w = 0; this.h = 0; this.dpr = 1;
    this.t = 0;
    this.running = false;
    this.visible = true;

    /* pointer, in -1..1 normalised space, eased toward the raw value */
    this.px = 0; this.py = 0;
    this.tx = 0; this.ty = 0;
    this.hasPointer = false;

    this.fov = this.opts.fov || 620;
    this.dist = this.opts.dist || 900;

    /* Scenes are authored against a 620px reference box and then scaled to the
       canvas, so the same geometry frames correctly in a 280px sidebar and a
       1600px hero instead of flying off the edges. 'contain' keeps a centred
       object fully in frame; 'cover' lets a field bleed past the edges. */
    this.fitMode = this.opts.fitMode || 'contain';
    this.fit = 1;

    /* A framed scene is the subject and stays sharp; a backdrop is texture and
       gets a much smaller pixel budget on phones. */
    this.isAmbient = !canvas.closest('.r3d-frame');

    this._bind();
    this.resize();
  }

  Stage.prototype._bind = function () {
    var self = this;

    this._onResize = function () { self.resize(); };
    global.addEventListener('resize', this._onResize, { passive: true });

    var host = this.opts.pointerHost || this.canvas.parentElement || this.canvas;
    this._host = host;

    this._onMove = function (e) {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      self.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.6, 1.6);
      self.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.6, 1.6);
      self.hasPointer = true;
    };
    this._onLeave = function () { self.tx = 0; self.ty = 0; self.hasPointer = false; };

    host.addEventListener('pointermove', this._onMove, { passive: true });
    host.addEventListener('pointerleave', this._onLeave, { passive: true });

    /* Touch: track the finger while it is down, then release back to centre.
       Never preventDefault — that would eat the page scroll on mobile. */
    host.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches[0]) return;
      self._onMove(e.touches[0]);
    }, { passive: true });
    host.addEventListener('touchend', this._onLeave, { passive: true });

    this._io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        self.visible = en.isIntersecting;
        self.visible ? self.start() : self.stop();
      });
    }, { threshold: this.isAmbient ? 0.25 : 0.01, rootMargin: '-5% 0px -5% 0px' });
    this._io.observe(this.canvas);

    this._onVis = function () {
      if (document.hidden) self.stop();
      else if (self.visible) self.start();
    };
    document.addEventListener('visibilitychange', this._onVis);
  };

  Stage.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    /* These scenes are entirely soft gradients — there is no hard edge for
       extra device pixels to sharpen, so rendering a 390px canvas at DPR 3
       costs 4x the fill for nothing visible.

       Two tiers, because the two uses are not equal. A *framed* scene is the
       thing the visitor is looking at and can drag, so it keeps resolution.
       An *ambient* backdrop sits at ~50% opacity behind a mask and behind
       type; on a phone it was measured costing 13fps of a 16fps page, which
       is not a trade worth making for texture nobody can seem. */
    var cap;
    if (w >= 760) cap = 2;
    else cap = this.isAmbient ? 1 : 1.5;
    var dpr = Math.min(global.devicePixelRatio || 1, cap);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var ref = this.fitMode === 'cover' ? Math.max(w, h) : Math.min(w, h);
    this.fit = this.fitMode === 'none' ? 1 : clamp(ref / 620, 0.34, 2.4);
    if (this.scene && this.scene.resize) this.scene.resize(this);
    if (!this.running) this.renderOnce();
  };

  /* Rotate around Y then X, translate away from camera, divide by depth. */
  Stage.prototype.project = function (x, y, z, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = x * cy - z * sy;
    var z1 = x * sy + z * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y1 = y * cp - z1 * sp;
    var z2 = y * sp + z1 * cp;
    var depth = z2 + this.dist;
    if (depth < 1) depth = 1;
    var persp = this.fov / depth;
    var k = persp * this.fit;
    // `s` is the pure perspective term; glow() applies `fit` separately so
    // sizes never get scaled twice.
    return { x: this.w / 2 + x1 * k, y: this.h / 2 + y1 * k, s: persp, z: depth };
  };

  Stage.prototype.glow = function (x, y, radius, color, alpha) {
    var r = radius * this.fit;
    if (alpha <= 0.002 || r <= 0.05) return;
    var img = sprite(color);
    this.ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    this.ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  };

  Stage.prototype.start = function () {
    if (this.running || !this.scene || reduceMotion) return;
    this.running = true;
    var self = this;
    var last = performance.now();

    /* Ambient motion does not need 60fps. Capping the phone budget at 30
       halves the per-second fill cost, and at this drift speed the difference
       is invisible — whereas the dropped frames at 60 were not. */
    var minFrame = this.w >= 760 ? 0 : (this.isAmbient ? 40 : 32);

    (function loop(now) {
      if (!self.running) return;
      if (minFrame && now - last < minFrame) {
        self._raf = requestAnimationFrame(loop);
        return;
      }
      var dt = Math.min((now - last) / 16.667, 3);
      last = now;
      self.t += dt;
      self.px += (self.tx - self.px) * 0.06 * dt;
      self.py += (self.ty - self.py) * 0.06 * dt;
      self.ctx.clearRect(0, 0, self.w, self.h);
      self.scene.draw(self, dt);
      self._raf = requestAnimationFrame(loop);
    })(last);
  };

  Stage.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  Stage.prototype.renderOnce = function () {
    if (!this.scene) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.scene.draw(this, 0);
  };

  Stage.prototype.destroy = function () {
    this.stop();
    global.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._io) this._io.disconnect();
  };

  /* ---- Scenes ------------------------------------------------------------ */
  var SCENES = {};

  /* 1. RESONANCE — the brand made literal.
     A plane of nodes displaced by radial sine waves; the pointer drops an extra
     ripple in. Mesh lines are drawn along one axis only: a full grid doubles
     the stroke count for almost no visual gain at this density. */
  SCENES.resonance = function (stage) {
    var N = stage.w < 560 ? 12 : stage.w < 900 ? 20 : 25;
    var SPAN = 1150;
    var step = SPAN / (N - 1);
    var pts = [];
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var x = -SPAN / 2 + i * step;
        var z = -SPAN / 2 + j * step;
        pts.push({ x: x, z: z, r: Math.sqrt(x * x + z * z), i: i, j: j });
      }
    }
    return {
      fitMode: 'cover',                 // the wave field should bleed off both edges
      resize: function (s) {
        var n = s.w < 560 ? 12 : s.w < 900 ? 20 : 25;
        if (n !== N) { N = n; this._rebuild(s); }
      },
      _rebuild: function (s) {
        step = SPAN / (N - 1); pts.length = 0;
        for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
          var x = -SPAN / 2 + i * step, z = -SPAN / 2 + j * step;
          pts.push({ x: x, z: z, r: Math.sqrt(x * x + z * z), i: i, j: j });
        }
      },
      draw: function (s) {
        var ctx = s.ctx;
        var time = s.t * 0.026;
        var yaw = 0.42 + s.px * 0.30;
        var pitch = 0.92 + s.py * 0.16;

        // pointer ripple origin, projected onto the plane
        var ox = s.px * 520, oz = s.py * 520;

        var proj = new Array(pts.length);
        for (var k = 0; k < pts.length; k++) {
          var p = pts[k];
          var h = Math.sin(p.r * 0.0125 - time * 2.1) * 62;
          h += Math.sin((p.x + p.z) * 0.0068 + time * 1.35) * 26;
          if (s.hasPointer) {
            var dx = p.x - ox, dz = p.z - oz;
            var d = Math.sqrt(dx * dx + dz * dz);
            h += Math.cos(clamp(d * 0.011, 0, Math.PI)) * 78 * Math.exp(-d * 0.0034);
          }
          var q = s.project(p.x, h, p.z, yaw, pitch);
          q.h = h; q.i = p.i; q.j = p.j;
          proj[k] = q;
        }

        // mesh lines along j (one direction only)
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1;
        var drawMesh = !(s.isAmbient && s.w < 560);
        for (var i2 = 0; drawMesh && i2 < N; i2++) {
          ctx.beginPath();
          for (var j2 = 0; j2 < N; j2++) {
            var q2 = proj[i2 * N + j2];
            j2 ? ctx.lineTo(q2.x, q2.y) : ctx.moveTo(q2.x, q2.y);
          }
          ctx.strokeStyle = rgba(PALETTE.indigo, 0.10 + 0.05 * Math.sin(i2 * 0.5 + time));
          ctx.stroke();
        }

        /* Only the top of each crest lights, and gently. This is ambience
           behind a headline, not the subject: at full strength the field
           read brighter than the type sitting on it. */
        ctx.globalCompositeOperation = 'lighter';
        for (var m = 0; m < proj.length; m++) {
          var g = proj[m];
          var lift = clamp((g.h + 70) / 150, 0, 1);
          if (lift < 0.42) continue;
          var col = mix(PALETTE.indigo, lift > 0.8 ? PALETTE.gold : PALETTE.rust, clamp((lift - 0.42) / 0.5, 0, 1));
          s.glow(g.x, g.y, 1.4 + lift * 8 * g.s * 1.5, col, 0.04 + lift * 0.20);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* 2. CORE — an icosahedron of signal, for the About page.
     Real icosahedron geometry (golden-ratio vertices), edges derived by
     distance so no hand-written index table can drift out of sync. */
  SCENES.core = function () {
    var phi = (1 + Math.sqrt(5)) / 2;
    var R = 250;
    var raw = [];
    [-1, 1].forEach(function (a) {
      [-phi, phi].forEach(function (b) {
        raw.push([0, a, b], [a, b, 0], [b, 0, a]);
      });
    });
    var norm = Math.sqrt(1 + phi * phi);
    var verts = raw.map(function (v) { return { x: v[0] / norm * R, y: v[1] / norm * R, z: v[2] / norm * R }; });

    // edge = the 5 nearest neighbours of each vertex (icosahedron edge length)
    var edges = [];
    var minD = Infinity;
    for (var a = 0; a < verts.length; a++) for (var b = a + 1; b < verts.length; b++) {
      var d = Math.hypot(verts[a].x - verts[b].x, verts[a].y - verts[b].y, verts[a].z - verts[b].z);
      if (d < minD) minD = d;
    }
    for (var a2 = 0; a2 < verts.length; a2++) for (var b2 = a2 + 1; b2 < verts.length; b2++) {
      var d2 = Math.hypot(verts[a2].x - verts[b2].x, verts[a2].y - verts[b2].y, verts[a2].z - verts[b2].z);
      if (d2 < minD * 1.08) edges.push([a2, b2]);
    }

    // two orbiting rings on different axes
    var rings = [
      { r: 355, tilt: 0.0, speed: 0.011, col: PALETTE.rust },
      { r: 415, tilt: 1.15, speed: -0.008, col: PALETTE.gold }
    ];
    var RING_SEG = 84;   // halved on small canvases in draw()

    return {
      fitMode: 'contain',
      draw: function (s) {
        var ctx = s.ctx;
        var yaw = s.t * 0.0055 + s.px * 0.6;
        var pitch = -0.22 + s.py * 0.42;

        // halo
        ctx.globalCompositeOperation = 'lighter';
        s.glow(s.w / 2, s.h / 2, Math.min(s.w, s.h) * 0.42, PALETTE.indigo, 0.16);

        // rings, drawn as depth-shaded segments
        rings.forEach(function (ring) {
          var segs = s.w < 700 ? RING_SEG >> 1 : RING_SEG;
          for (var i = 0; i < segs; i++) {
            var t0 = (i / segs) * Math.PI * 2 + s.t * ring.speed;
            var x = Math.cos(t0) * ring.r;
            var z = Math.sin(t0) * ring.r;
            var y = Math.sin(t0) * ring.r * Math.sin(ring.tilt) * 0.55;
            var q = s.project(x, y * 0.6, z, yaw, pitch + ring.tilt * 0.28);
            var depth = clamp(1 - (q.z - s.dist + 420) / 840, 0.05, 1);
            s.glow(q.x, q.y, 1.6 + depth * 4.2, ring.col, 0.10 + depth * 0.40);
          }
        });

        // icosahedron edges
        ctx.globalCompositeOperation = 'source-over';
        var P = verts.map(function (v) { return s.project(v.x, v.y, v.z, yaw, pitch); });
        edges.forEach(function (e) {
          var p1 = P[e[0]], p2 = P[e[1]];
          var depth = clamp(1 - ((p1.z + p2.z) / 2 - s.dist + 260) / 520, 0.05, 1);
          ctx.strokeStyle = rgba(mix(PALETTE.indigo, PALETTE.cream, depth * 0.5), 0.12 + depth * 0.38);
          ctx.lineWidth = 0.6 + depth * 1.5;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        });

        // vertex nodes
        ctx.globalCompositeOperation = 'lighter';
        P.forEach(function (p, i) {
          var depth = clamp(1 - (p.z - s.dist + 260) / 520, 0.05, 1);
          var pulse = 0.6 + 0.4 * Math.sin(s.t * 0.05 + i * 0.9);
          s.glow(p.x, p.y, (3 + depth * 9) * pulse, i % 3 === 0 ? PALETTE.gold : PALETTE.rust, 0.18 + depth * 0.5);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* 3. LATTICE — a rotating node grid for Services, with a pulse front that
     sweeps through on the X axis and lights whatever it passes. */
  SCENES.lattice = function (stage) {
    var n = (stage && stage.w < 700) ? 3 : 4;
    var GAP = 190;
    var nodes = [];
    function build(n) {
      nodes.length = 0;
      var off = (n - 1) / 2;
      for (var x = 0; x < n; x++) for (var y = 0; y < n; y++) for (var z = 0; z < n; z++) {
        nodes.push({ x: (x - off) * GAP, y: (y - off) * GAP, z: (z - off) * GAP, gx: x, gy: y, gz: z });
      }
    }
    build(n);
    return {
      fitMode: 'contain',
      resize: function (s) {
        var nn = s.w < 700 ? 3 : 4;
        if (nn !== n) { n = nn; build(n); }
      },
      draw: function (s) {
        var ctx = s.ctx;
        var yaw = s.t * 0.0042 + s.px * 0.5;
        var pitch = 0.32 + s.py * 0.34;
        var P = nodes.map(function (nd) {
          var q = s.project(nd.x, nd.y, nd.z, yaw, pitch);
          q.n = nd; return q;
        });

        // pulse front sweeping along the lattice's own X axis
        var front = ((s.t * 0.012) % (n + 2)) - 1;

        ctx.globalCompositeOperation = 'source-over';
        for (var i = 0; i < nodes.length; i++) {
          for (var j = i + 1; j < nodes.length; j++) {
            var a = nodes[i], b = nodes[j];
            var md = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) + Math.abs(a.gz - b.gz);
            if (md !== 1) continue;                    // orthogonal neighbours only
            var pa = P[i], pb = P[j];
            var depth = clamp(1 - ((pa.z + pb.z) / 2 - s.dist + 380) / 760, 0.04, 1);
            ctx.strokeStyle = rgba(PALETTE.indigo, 0.05 + depth * 0.20);
            ctx.lineWidth = 0.5 + depth;
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          }
        }

        ctx.globalCompositeOperation = 'lighter';
        P.forEach(function (p) {
          var depth = clamp(1 - (p.z - s.dist + 380) / 760, 0.04, 1);
          var hot = clamp(1 - Math.abs(p.n.gx - front) * 1.25, 0, 1);
          var col = hot > 0.05 ? mix(PALETTE.rust, PALETTE.gold, hot) : PALETTE.indigo;
          s.glow(p.x, p.y, (2.4 + depth * 7) * (1 + hot * 1.5), col, 0.12 + depth * 0.3 + hot * 0.42);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* 4. CAROUSEL — a ring of panels for the Work page. Painter's algorithm:
     sort back-to-front and fill, so near panels correctly occlude far ones. */
  SCENES.carousel = function () {
    var COUNT = 7;
    var RAD = 430;
    var PW = 250, PH = 158;
    return {
      fitMode: 'contain',
      draw: function (s) {
        var ctx = s.ctx;
        var spin = s.t * 0.0042 + s.px * 0.9;
        var pitch = 0.10 + s.py * 0.22;

        var panels = [];
        for (var i = 0; i < COUNT; i++) {
          var ang = (i / COUNT) * Math.PI * 2 + spin;
          var cx = Math.cos(ang) * RAD;
          var cz = Math.sin(ang) * RAD;
          var bob = Math.sin(s.t * 0.02 + i) * 16;
          // panel corners in world space, each facing outward from the ring
          var nx = -Math.sin(ang), nz = Math.cos(ang);
          var corners = [
            [cx - nx * PW / 2, bob - PH / 2, cz - nz * PW / 2],
            [cx + nx * PW / 2, bob - PH / 2, cz + nz * PW / 2],
            [cx + nx * PW / 2, bob + PH / 2, cz + nz * PW / 2],
            [cx - nx * PW / 2, bob + PH / 2, cz - nz * PW / 2]
          ].map(function (c) { return s.project(c[0], c[1], c[2], 0, pitch); });
          panels.push({ c: corners, z: corners.reduce(function (a, p) { return a + p.z; }, 0) / 4, i: i });
        }
        panels.sort(function (a, b) { return b.z - a.z; });

        panels.forEach(function (p) {
          var depth = clamp(1 - (p.z - s.dist + RAD) / (RAD * 2), 0.02, 1);
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.moveTo(p.c[0].x, p.c[0].y);
          for (var k = 1; k < 4; k++) ctx.lineTo(p.c[k].x, p.c[k].y);
          ctx.closePath();
          var col = p.i % 3 === 0 ? PALETTE.rust : p.i % 3 === 1 ? PALETTE.indigo : PALETTE.gold;
          ctx.fillStyle = rgba(mix(PALETTE.navy, col, 0.14 + depth * 0.30), 0.30 + depth * 0.42);
          ctx.fill();
          ctx.strokeStyle = rgba(mix(col, PALETTE.cream, depth * 0.45), 0.20 + depth * 0.55);
          ctx.lineWidth = 0.7 + depth * 1.6;
          ctx.stroke();

          // a bright edge along the top, so the panels read as lit surfaces
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(p.c[0].x, p.c[0].y); ctx.lineTo(p.c[1].x, p.c[1].y);
          ctx.strokeStyle = rgba(col, 0.15 + depth * 0.6);
          ctx.lineWidth = 1 + depth * 2;
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* 5. ORBIT — a Fibonacci sphere for the Contact page. `energy` is driven by
     how complete the quote brief is, so the artwork responds to the form. */
  SCENES.orbit = function (stage) {
    var COUNT = (stage && stage.w < 600) ? 120 : 300;
    var R = 260;
    var pts = [];
    function build(count) {
      pts.length = 0;
      var ga = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < count; i++) {
        var y = 1 - (i / (count - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = ga * i;
        pts.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, seed: Math.random() });
      }
    }
    build(COUNT);
    return {
      fitMode: 'contain',
      resize: function (s) {
        var c = s.w < 600 ? 120 : 300;
        if (c !== COUNT) { COUNT = c; build(COUNT); }
      },
      draw: function (s) {
        var ctx = s.ctx;
        var energy = clamp(global.__resonareQuoteEnergy || 0, 0, 1);
        var yaw = s.t * 0.006 + s.px * 0.7;
        var pitch = s.py * 0.5;
        var breathe = 1 + Math.sin(s.t * 0.017) * 0.045 + energy * 0.10;

        ctx.globalCompositeOperation = 'lighter';
        s.glow(s.w / 2, s.h / 2, Math.min(s.w, s.h) * (0.30 + energy * 0.10),
               mix(PALETTE.indigo, PALETTE.rust, energy), 0.10 + energy * 0.16);

        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var rr = R * breathe * (1 + Math.sin(s.t * 0.03 + p.seed * 9) * 0.03);
          var q = s.project(p.x * rr, p.y * rr, p.z * rr, yaw, pitch);
          var depth = clamp(1 - (q.z - s.dist + R) / (R * 2), 0.02, 1);
          var col = mix(PALETTE.indigo, p.seed > 0.72 ? PALETTE.gold : PALETTE.rust,
                        clamp(depth * 0.65 + energy * 0.5, 0, 1));
          s.glow(q.x, q.y, 2.6 + depth * (7 + energy * 4), col, 0.18 + depth * (0.5 + energy * 0.3));
        }

        // equator ring tightens as the brief fills in
        var RING = s.w < 600 ? 48 : 96;
        for (var k = 0; k < RING; k++) {
          var a = (k / RING) * Math.PI * 2 + s.t * 0.010;
          var q2 = s.project(Math.cos(a) * R * 1.32, 0, Math.sin(a) * R * 1.32, yaw, pitch);
          var d2 = clamp(1 - (q2.z - s.dist + R) / (R * 2), 0.02, 1);
          s.glow(q2.x, q2.y, 1 + d2 * 3, PALETTE.gold, (0.05 + d2 * 0.28) * (0.35 + energy * 0.65));
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* ---- Mounting ---------------------------------------------------------- */
  var mounted = [];

  function mount(canvas) {
    var name = canvas.getAttribute('data-r3d');
    var factory = SCENES[name];
    if (!factory) return null;
    var opts = {};
    if (canvas.dataset.r3dDist) opts.dist = parseFloat(canvas.dataset.r3dDist);
    if (canvas.dataset.r3dFov) opts.fov = parseFloat(canvas.dataset.r3dFov);
    if (canvas.dataset.r3dFit) opts.fitMode = canvas.dataset.r3dFit;
    var host = canvas.closest('[data-r3d-host]');
    if (host) opts.pointerHost = host;

    var stage = new Stage(canvas, opts);
    stage.scene = factory(stage);
    // a scene may declare how it wants to be framed; an explicit data attribute wins
    if (stage.scene.fitMode && !canvas.dataset.r3dFit) {
      stage.fitMode = stage.scene.fitMode;
      stage.w = 0;            // force resize() to recompute `fit`
      stage.resize();
    }
    canvas.setAttribute('aria-hidden', 'true');

    /* Reduced motion still gets the artwork — just held on one frame. */
    if (reduceMotion) stage.renderOnce();
    else if (stage.visible) stage.start();

    mounted.push(stage);
    return stage;
  }

  function init(root) {
    (root || document).querySelectorAll('canvas[data-r3d]').forEach(function (c) {
      if (!c.__r3d) { c.__r3d = mount(c); }
    });
  }

  global.R3D = { init: init, mount: mount, scenes: SCENES, palette: PALETTE, mounted: mounted };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})(window);
