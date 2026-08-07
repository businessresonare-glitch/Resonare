/* ==========================================================================
   RESONARE — cinematic hero

   Two pieces:

   1. FadingVideo — a background video that loops with a JS-driven crossfade
      rather than the `loop` attribute, so the seam at the loop point is a
      half-second dissolve instead of a hard cut. Fades are rAF-driven and
      resume from the current opacity, so a fade that interrupts another does
      not snap.

   2. BlurText — the headline arrives word by word, each blurring in from
      below.

   The video is a SLOT, not a hard dependency. If the file named in
   data-hero-video is missing, unplayable, or the connection is too slow, the
   hero silently keeps the R3D scene behind it and nothing looks broken. That
   matters because a hero whose backdrop 404s is a black rectangle where the
   headline used to be.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     TURN THE HERO VIDEOS ON HERE.

     Set to true once the MP4s are in assets/video/. Left false, the heroes use
     their 3D backdrop and the browser never requests a video at all — asking
     for files that do not exist would log a 404 on every page load forever.

     ON, because assets/video/ now ships four WebM loops.
     ------------------------------------------------------------------------ */
  var VIDEO_ENABLED = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FADE_MS = 500;
  var FADE_OUT_LEAD = 0.55;      // seconds before the end to begin fading out

  /* ---- 1. Background video ---------------------------------------------- */
  function mountVideo(host) {
    if (!VIDEO_ENABLED) return;
    /* Comma-separated candidates, best first. They become <source> elements,
       so the browser picks the first format it can actually decode and simply
       skips the rest — which is the upgrade path for MP4: encode the files,
       add one token to the attribute, change nothing here. Only list formats
       that exist, or the skipped ones 404 on every load. */
    var raw = (host.getAttribute('data-hero-video') || '').trim();
    /* A data: URI carries its own comma (`data:video/webm;base64,...`), so
       splitting one on commas produces two broken sources and the hero falls
       back to 3D for no reason. Inlined builds hit this; the site does not,
       because file paths have no commas. One source either way. */
    var srcList = raw.slice(0, 5).toLowerCase() === 'data:'
      ? [raw]
      : raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!srcList.length) return;

    /* Data saver and metered connections: leave the 3D scene in place rather
       than pulling several megabytes of decoration. */
    var conn = navigator.connection;
    if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;

    var video = document.createElement('video');
    video.className = 'hero-video';
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    var poster = host.getAttribute('data-hero-poster');
    if (poster) video.poster = poster;
    video.style.opacity = '0';
    srcList.forEach(function (url) {
      var source = document.createElement('source');
      source.src = url;
      var ext = (url.split('.').pop() || '').toLowerCase();
      if (ext === 'mp4') source.type = 'video/mp4';
      else if (ext === 'webm') source.type = 'video/webm';
      video.appendChild(source);
    });

    var raf = null, fadingOut = false, live = false;

    function fadeTo(target, duration) {
      if (raf) cancelAnimationFrame(raf);
      var from = parseFloat(video.style.opacity) || 0;
      if (reduceMotion) { video.style.opacity = String(target); return; }
      var start = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - start) / duration);
        video.style.opacity = String(from + (target - from) * t);
        if (t < 1) raf = requestAnimationFrame(step);
      })(start);
    }

    function goLive() {
      if (live) return;
      live = true;
      host.classList.add('has-video');       // stands the 3D scene down
    }

    video.addEventListener('loadeddata', function () {
      var p = video.play();
      if (p && p.catch) {
        /* Autoplay can still be refused even when muted. If it is, drop the
           video entirely rather than leaving a frozen first frame. */
        p.catch(function () { teardown(); });
      }
      goLive();
      video.style.opacity = '0';
      fadeTo(1, FADE_MS);
    });

    video.addEventListener('timeupdate', function () {
      if (fadingOut || !video.duration) return;
      var left = video.duration - video.currentTime;
      if (left <= FADE_OUT_LEAD && left > 0) { fadingOut = true; fadeTo(0, FADE_MS); }
    });

    video.addEventListener('ended', function () {
      video.style.opacity = '0';
      setTimeout(function () {
        video.currentTime = 0;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        fadingOut = false;
        fadeTo(1, FADE_MS);
      }, 100);
    });

    function teardown() {
      if (raf) cancelAnimationFrame(raf);
      host.classList.remove('has-video');
      if (video.parentNode) video.parentNode.removeChild(video);
    }
    /* With <source> children the media element itself does not fire `error`;
       the last source does, and only after every candidate has been tried. */
    video.addEventListener('error', teardown);
    var last = video.lastElementChild;
    if (last) last.addEventListener('error', function () {
      if (!live) teardown();
    });
    /* A source that never arrives should not hold the hero hostage. */
    setTimeout(function () { if (!live) teardown(); }, 8000);

    /* Stop decoding while the hero is off screen or the tab is hidden — a
       background video nobody can see is pure battery cost. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!video.parentNode) return;
        if (en.isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
        else video.pause();
      });
    }, { threshold: 0.01 });
    io.observe(host);
    document.addEventListener('visibilitychange', function () {
      if (!video.parentNode) return;
      if (document.hidden) video.pause();
      else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    });

    host.insertBefore(video, host.firstChild);
  }

  /* ---- 2. Word-by-word headline ----------------------------------------- */
  function splitWords(el) {
    if (el.dataset.blurReady) return;
    el.dataset.blurReady = '1';

    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) return;
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span');
            w.className = 'bt-word';
            w.textContent = part;
            frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
          return;
        }
        if (child.nodeType !== 1) return;
        if (child.classList.contains('bt-word')) return;
        walk(child);
      });
    }
    walk(el);

    el.querySelectorAll('.bt-word').forEach(function (w, i) {
      w.style.transitionDelay = (i * 0.075).toFixed(3) + 's';
    });
    el.classList.add('bt-split');
  }

  function mountHeadline(el) {
    if (reduceMotion) { el.classList.add('bt-in'); return; }
    splitWords(el);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        el.classList.add('bt-in');
        io.unobserve(el);
      });
    }, { threshold: 0.2 });

    /* Above the fold, fire with the page-load sequence instead of on scroll. */
    if (el.closest('.cine-hero')) {
      var fire = function () { setTimeout(function () { el.classList.add('bt-in'); }, 140); };
      if (document.body.classList.contains('loaded')) fire();
      else {
        var mo = new MutationObserver(function () {
          if (document.body.classList.contains('loaded')) { mo.disconnect(); fire(); }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        setTimeout(fire, 4000);          // same failsafe posture as the preloader
      }
      return;
    }
    io.observe(el);
  }

  /* The video is decoration and must never be on the critical path. Mounted
     during DOMContentLoaded it joined the `window.load` race and pushed the
     preloader's release out by ~190ms on a throttled 4G phone — for a
     backdrop nobody is waiting to see. Mounting it after the preloader has
     already handed over costs the visitor nothing: the hero is complete with
     its 3D scene, and the video crossfades in on top whenever it is ready. */
  function whenSettled(fn) {
    if (document.body.classList.contains('loaded')) { fn(); return; }
    var done = false;
    var run = function () { if (done) return; done = true; fn(); };
    var mo = new MutationObserver(function () {
      if (document.body.classList.contains('loaded')) { mo.disconnect(); run(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(run, 4000);            // same failsafe posture as the preloader
  }

  function init() {
    var hosts = document.querySelectorAll('[data-hero-video]');
    if (hosts.length) whenSettled(function () {
      hosts.forEach(function (host) {
        /* Idle time if the browser offers it, otherwise a short beat after
           the entrance animation has had the main thread to itself. */
        if (window.requestIdleCallback) requestIdleCallback(function () { mountVideo(host); }, { timeout: 1200 });
        else setTimeout(function () { mountVideo(host); }, 300);
      });
    });
    document.querySelectorAll('[data-blur-text]').forEach(mountHeadline);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ==========================================================================
   TYPEWRITER HEADLINE

   Types a string out character by character with a blinking caret, then
   parks. Declared as data-typewriter="the text" on the heading; \n in the
   attribute becomes a real line break (the heading is white-space:pre-wrap).

   Two things this deliberately does NOT do:
   - It does not run on prefers-reduced-motion; the full text is printed at
     once, because a headline that withholds itself is a comprehension problem
     before it is an animation preference.
   - It does not start until the preloader has handed over, for the same
     reason the blur-in headline waits: typing behind a loading screen means
     the visitor arrives after the effect has already finished.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = 42;        // ms per character
  var START_DELAY = 420;

  function mount(el) {
    /* The heading ships with its real text in the HTML and this reads it from
       there, so the page still has a headline when this script never runs —
       blocked, 404'd, or opened without its assets folder. The attribute is
       only an override for when the typed string differs from the static one.
       An empty <h1> that JS was supposed to fill is a blank page waiting to
       happen. */
    var text = el.getAttribute('data-typewriter') || el.textContent || '';
    text = text.replace(/\\n/g, '\n').trim();
    if (!text) return;

    if (reduce) { el.textContent = text; el.classList.add('tw-done'); return; }

    var out = document.createTextNode('');
    var caret = document.createElement('span');
    caret.className = 'tw-caret';
    caret.setAttribute('aria-hidden', 'true');

    /* The full string is exposed to assistive tech up front — a screen reader
       should not have to sit through the animation to hear the headline. */
    el.setAttribute('aria-label', text);
    el.textContent = '';
    el.appendChild(out);
    el.appendChild(caret);

    var i = 0, timer = null;
    function step() {
      out.textContent = text.slice(0, ++i);
      if (i >= text.length) { el.classList.add('tw-done'); return; }
      timer = setTimeout(step, SPEED);
    }

    function fire() { timer = setTimeout(step, START_DELAY); }

    if (document.body.classList.contains('loaded')) fire();
    else {
      var mo = new MutationObserver(function () {
        if (document.body.classList.contains('loaded')) { mo.disconnect(); fire(); }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      setTimeout(function () { if (!timer) fire(); }, 4000);   // preloader failsafe
    }
  }

  function init() { document.querySelectorAll('[data-typewriter]').forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
