const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ PRELOADER ============ */
(function () {
  const pre = document.getElementById('preloader');
  if (!pre) { document.body.classList.add('loaded'); return; }
  const fill = document.getElementById('preloaderBarFill');
  const pct = document.getElementById('preloaderPct');
  const status = document.getElementById('preloaderStatus');
  const messages = ['Tuning the signal', 'Loading assets', 'Calibrating layout', 'Almost there'];
  let msgIndex = 0;
  if (status) status.textContent = messages[0];
  const msgTimer = reduceMotion ? null : setInterval(() => {
    msgIndex = (msgIndex + 1) % messages.length;
    if (status) status.textContent = messages[msgIndex];
  }, 650);

  if (reduceMotion) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      if (status) status.textContent = 'Ready';
      document.body.classList.add('loaded');
      setTimeout(() => { pre.classList.add('hidden'); pre.style.display = 'none'; }, 150);
    };
    window.addEventListener('load', finish);
    setTimeout(finish, 2000);          // same failsafe as the animated path
    return;
  }

  let progress = 0;
  let loaded = false;
  window.addEventListener('load', () => { loaded = true; });

  /* Failsafe. The bar's ceiling is 92% until `load` fires, and `load` waits on
     every subresource — so one slow or blocked third-party request left the
     preloader parked at 92% forever with the whole site sealed behind it. A
     visitor must never be locked out by an asset that is not theirs.

     Two seconds, not the old three and a half: the homepage's `load` now
     waits on a 512KB world bundle, and a splash that outlives the thing it
     is covering is just a delay with a logo on it. */
  const FAILSAFE_MS = 2000;
  setTimeout(() => { loaded = true; }, FAILSAFE_MS);

  function tick() {
    const ceiling = loaded ? 100 : 92;
    progress += (ceiling - progress) * (loaded ? 0.16 : 0.045) + (loaded ? 0 : 0.12);
    if (progress > 100) progress = 100;
    const shown = Math.min(100, Math.round(progress));
    if (fill) fill.style.width = shown + '%';
    if (pct) pct.textContent = shown + '%';

    if (loaded && progress >= 99.4) {
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      if (msgTimer) clearInterval(msgTimer);
      if (status) status.textContent = 'Ready';
      document.body.classList.add('loaded');
      setTimeout(() => {
        pre.classList.add('hidden');
        setTimeout(() => { pre.style.display = 'none'; }, 1000);
      }, 260);
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============ SMOOTH SCROLL (Lenis, desktop only) ============ */
let lenis = null;
const finePointer =
  window.matchMedia('(pointer:fine)').matches &&
  window.matchMedia('(hover:hover)').matches;
if (window.Lenis && !reduceMotion && finePointer) {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    lerp: 0.11,
  });
  function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
}

function smoothScrollTo(target, offset){
  const el = typeof target === 'string' ? document.querySelector(target) : null;
  if (target === 0 || target === '0') { if (lenis) lenis.scrollTo(0); else window.scrollTo({top:0, behavior:'smooth'}); return; }
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: offset || 0 });
  else el.scrollIntoView({ behavior:'smooth' });
}
document.querySelectorAll('a[href^="#"]').forEach(a => {
  const href = a.getAttribute('href');
  if (href.length > 1) {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(href);
      if (target) { e.preventDefault(); smoothScrollTo(href, -10); }
    });
  }
});

/* ============ SCROLL PROGRESS + HEADER STATE ============ */
const scrollProgress = document.getElementById('scrollProgress');
const siteHeader = document.getElementById('siteHeader');
const toTopBtn = document.getElementById('toTop');
function onScroll(){
  const doc = document.documentElement;
  const scrollTop = doc.scrollTop || document.body.scrollTop;
  const height = doc.scrollHeight - doc.clientHeight;
  const pct = height > 0 ? (scrollTop / height) * 100 : 0;
  if (scrollProgress) scrollProgress.style.width = pct + '%';
  if (siteHeader) siteHeader.classList.toggle('scrolled', scrollTop > 40);
  if (toTopBtn) toTopBtn.classList.toggle('visible', scrollTop > 500);
}
if (lenis) { lenis.on('scroll', onScroll); } else { window.addEventListener('scroll', onScroll, { passive:true }); }
onScroll();
if (toTopBtn) toTopBtn.addEventListener('click', () => smoothScrollTo(0, 0));

/* ============ MOBILE DRAWER ============
   Previously the drawer only toggled a class: the page behind it stayed
   scrollable, so flicking the "overlay" scrolled the document underneath and
   closing it dumped you somewhere else entirely. It also could not be closed
   with Escape and never returned focus. All three are handled here, and the
   scroll position is restored on close rather than reset to the top. */
const drawer = document.getElementById('mobileDrawer');
const menuOpen = document.getElementById('menuOpen');
const menuClose = document.getElementById('menuClose');

if (drawer) {
  let scrollY = 0;

  const focusables = () => Array.from(
    drawer.querySelectorAll('a[href], button:not([disabled])')
  ).filter(el => el.offsetParent !== null);

  const openDrawer = () => {
    scrollY = window.scrollY;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (menuOpen) menuOpen.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
    document.body.style.top = `-${scrollY}px`;
    if (lenis) lenis.stop();
    const first = focusables()[0];
    if (first) setTimeout(() => first.focus(), 80);
  };

  const closeDrawer = ({ restoreFocus = true } = {}) => {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (menuOpen) menuOpen.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    if (lenis) lenis.start();
    if (restoreFocus && menuOpen) menuOpen.focus();
  };

  if (menuOpen) {
    menuOpen.setAttribute('aria-expanded', 'false');
    menuOpen.setAttribute('aria-controls', 'mobileDrawer');
    menuOpen.addEventListener('click', openDrawer);
  }
  if (menuClose) menuClose.addEventListener('click', () => closeDrawer());

  /* A nav link both closes the drawer and navigates, so focus must not be
     yanked back to the burger mid-navigation. */
  drawer.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => closeDrawer({ restoreFocus: false }))
  );

  document.addEventListener('keydown', (e) => {
    if (!drawer.classList.contains('open')) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* Rotating to landscape past the breakpoint leaves an open drawer stranded
     over a desktop layout with the burger gone. */
  window.matchMedia('(min-width:881px)').addEventListener('change', (e) => {
    if (e.matches) closeDrawer({ restoreFocus: false });
  });
}

/* ============ REVEAL ON SCROLL ============ */
const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

/* ============ SERVICE / CARD CURSOR GLOW (local, mouse-follow spotlight) ============ */
document.querySelectorAll('.service-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

/* ==========================================================================
   THE WORLD — chapter reveals and the chapter rail

   The flight itself lives in assets/world.js. This half only cares about the
   type: which chapter is on screen, and which rail label should be lit.

   There is deliberately no custom cursor and no glowing dot column any more.
   Both were decoration that fought the content — the cursor duplicated the
   pointer at a permanent lag, and the dots pulsed a red halo over whatever
   they sat on. A hairline rail with real labels does the same job and stays
   quiet.
   ========================================================================== */
(function initChapters(){
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  if (!chapters.length) return;

  /* --- copy reveals: once, on entry, never rewound --- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealer.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  chapters.forEach(c => revealer.observe(c));
  /* the first chapter is above the fold — it must not wait for a scroll */
  chapters[0].classList.add('is-in');

  /* --- the rail --- */
  const rail = document.getElementById('worldRail');
  if (!rail) return;

  const links = chapters.map((chapter, i) => {
    const a = document.createElement('a');
    a.href = '#' + chapter.id;
    a.innerHTML = '<em></em><i></i>';
    a.querySelector('em').textContent = chapter.dataset.rail || ('0' + (i + 1));
    a.addEventListener('click', (e) => { e.preventDefault(); smoothScrollTo('#' + chapter.id, -1); });
    rail.appendChild(a);
    return a;
  });

  /* Each chapter is taller than the viewport and holds a sticky panel, so a
     chapter has three phases: sliding in, pinned, sliding out. `local` is 0
     the moment it pins and 1 the moment it unpins, and goes negative or past
     one during the two slides.

       local = -top / (height - viewport)
       span  = viewport / (height - viewport)

     Two consecutive panels are always exactly `1 + span` apart in local, so
     the outgoing window is the incoming one shifted by that amount and the
     two dissolve through each other rather than stacking. Deriving both from
     the geometry means the chapter height can change in CSS without
     retuning anything here. */
  const ramp = (x, a, b) => { const t = (x - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t; };
  const ease = t => t * t * (3 - 2 * t);

  let queued = false;
  function sync(){
    queued = false;
    const vh = window.innerHeight;
    const mid = vh * 0.5;
    let active = 0;

    chapters.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) active = i;

      if (reduceMotion) return;
      const travel = r.height - vh;
      if (travel <= 0) return;
      const span = vh / travel;
      const local = -r.top / travel;
      /* Symmetric by construction: the outgoing window is the incoming one
         shifted by exactly 1 + span, so the two cross at the midpoint. Kept
         short — with both panels centred, a long dissolve puts two headlines
         in the middle of the frame at once. */
      const vis = ease(ramp(local, -span * 0.70, -span * 0.30)) *
                  (1 - ease(ramp(local, 1 + span * 0.30, 1 + span * 0.70)));
      c.style.setProperty('--vis', vis.toFixed(3));
    });

    links.forEach((a, i) => a.classList.toggle('is-active', i === active));

    const world = document.getElementById('world');
    if (world){
      const r = world.getBoundingClientRect();
      rail.classList.toggle('is-live', r.top < window.innerHeight * 0.4 && r.bottom > window.innerHeight * 0.6);
    }
  }
  function request(){ if (!queued){ queued = true; requestAnimationFrame(sync); } }

  if (lenis) lenis.on('scroll', request);
  else window.addEventListener('scroll', request, { passive:true });
  window.addEventListener('resize', request, { passive:true });
  sync();
})();

/* ============ MAGNETIC BUTTONS ============
   Offsets go into --btn-x / --btn-y instead of an inline transform, so the
   CSS hover lift (--btn-lift) survives the magnet instead of being erased. */
if (!reduceMotion && finePointer) {
  document.querySelectorAll('.btn').forEach(btn => {
    let queued = null, tx = 0, ty = 0;
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * 0.22;
      ty = (e.clientY - r.top - r.height / 2) * 0.28;
      if (queued) return;
      queued = requestAnimationFrame(() => {
        btn.style.setProperty('--btn-x', tx.toFixed(2) + 'px');
        btn.style.setProperty('--btn-y', ty.toFixed(2) + 'px');
        queued = null;
      });
    }, { passive:true });
    btn.addEventListener('mouseleave', () => {
      if (queued) { cancelAnimationFrame(queued); queued = null; }
      btn.classList.add('is-releasing');
      btn.style.setProperty('--btn-x', '0px');
      btn.style.setProperty('--btn-y', '0px');
      setTimeout(() => btn.classList.remove('is-releasing'), 520);
    });
  });
}

/* ============ 3D TILT (work / service cards) ============
   `.is-tilting` drops the card's .4s transform transition while the pointer is
   inside, so the tilt tracks the pointer; removing it on exit hands the card
   back to the slow eased return. */
function attachTilt(selector, intensity, lift){
  if (reduceMotion || !finePointer) return;
  document.querySelectorAll(selector).forEach(card => {
    let queued = null, rx = 0, ry = 0;
    card.addEventListener('mouseenter', () => card.classList.add('is-tilting'));
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      rx = ((e.clientY - r.top) / r.height - 0.5) * -intensity;
      ry = ((e.clientX - r.left) / r.width - 0.5) * intensity;
      if (queued) return;
      queued = requestAnimationFrame(() => {
        card.style.transform = 'perspective(1200px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(' + lift + 'px)';
        queued = null;
      });
    }, { passive:true });
    card.addEventListener('mouseleave', () => {
      if (queued) { cancelAnimationFrame(queued); queued = null; }
      card.classList.remove('is-tilting');
      card.style.transform = '';
    });
  });
}
attachTilt('.work-card', 3.5, -8);
attachTilt('.service-card', 2.6, -8);

/* ============ HERO PARALLAX DEPTH ============ */
(function(){
  const hero = document.querySelector('.hero');
  const grid = document.querySelector('.hero-grid');
  const breath = document.querySelector('.hero-breath');
  if (!hero || reduceMotion) return;
  function updateParallax(){
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const shift = r.top * -0.12;
    if (grid) grid.style.transform = `translateY(${shift}px)`;
    if (breath) breath.style.transform = `translateY(${shift * 0.6}px)`;
  }
  if (lenis) { lenis.on('scroll', updateParallax); } else { window.addEventListener('scroll', updateParallax, { passive:true }); }
  updateParallax();
})();

/* ============ SLOW-RISE COUNTERS ============
   The previous odometer rolled its ribbon to translateY(0), which lands on
   the FIRST cell — always "0" — so every figure read 00+ / 0 / 000%. Replaced
   with a genuine count-up that takes 2.6s and decelerates into place, so the
   number climbs visibly while you read the label rather than snapping. */
(function initCounters(){
  const targets = document.querySelectorAll('[data-count]');
  if (!targets.length) return;

  const DURATION = 2800;

  function format(value, decimals, suffix, prefix){
    return (prefix || '') + value.toFixed(decimals) + (suffix || '');
  }

  function run(el){
    const target   = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix   = el.dataset.suffix || '';
    const prefix   = el.dataset.prefix || '';

    if (reduceMotion){ el.textContent = format(target, decimals, suffix, prefix); return; }

    const start = performance.now();
    function tick(now){
      const p = Math.min(1, (now - start) / DURATION);
      /* smoothstep — eases in and out but climbs steadily through the middle,
         so the figure is visibly rising the whole way instead of snapping to
         near-target in the first half second the way an ease-out does */
      const eased = p * p * (3 - 2 * p);
      el.textContent = format(target * eased, decimals, suffix, prefix);
      /* published for the ember flow, which rides the same curve so the
         lights surge exactly while the digits are climbing */
      el.__countProgress = p;
      el.__countRate = 1 - Math.abs(2 * p - 1);   // 0 at the ends, 1 mid-climb
      if (p < 1) requestAnimationFrame(tick);
      else {
        el.textContent = format(target, decimals, suffix, prefix);
        el.__countProgress = 1;
        el.__countRate = 0;
      }
    }
    requestAnimationFrame(tick);
  }

  targets.forEach(el => {
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    el.textContent = (el.dataset.prefix || '') + (0).toFixed(decimals) + (el.dataset.suffix || '');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      run(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.4 });
  targets.forEach(el => observer.observe(el));
})();

/* ============ SPLIT-TEXT HEADING REVEAL ============
   Ported from the reference: every heading is broken into characters that
   swing in from the left through a 400px perspective — 0.8s each, 0.02s
   apart. Words stay whole so line wrapping is unaffected, and inline tags
   such as <em> survive because only text nodes are rewritten. */
(function initSplitHeadings(){
  if (reduceMotion) return;
  const headings = document.querySelectorAll('h1, h2');
  if (!headings.length) return;

  function splitTextNode(node){
    const frag = document.createDocumentFragment();
    const parts = node.textContent.split(/(\s+)/);
    parts.forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
      const word = document.createElement('span');
      word.className = 'sr-word';
      for (const ch of part){
        const span = document.createElement('span');
        span.className = 'sr-char';
        span.textContent = ch;
        word.appendChild(span);
      }
      frag.appendChild(word);
    });
    node.parentNode.replaceChild(frag, node);
  }

  function walk(el){
    Array.from(el.childNodes).forEach(node => {
      if (node.nodeType === 3 && node.textContent.trim()){ splitTextNode(node); return; }
      if (node.nodeType !== 1 || node.classList.contains('sr-word')) return;
      /* <em> carries a gradient clipped to its text, so its characters are not
         split individually — a transformed child breaks the clip. It used to
         animate as ONE inline-block, which made a multi-word emphasis an
         unwrappable run: "real trade businesses" measured 1087px on a 768px
         tablet and was clipped off at the hero edge. Splitting per word keeps
         the fill intact (each word owns its own gradient, see .dark em .sr-word)
         while restoring normal line breaking. */
      if (node.tagName === 'EM'){
        const parts = node.textContent.split(/(\s+)/);
        node.textContent = '';
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)){ node.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'sr-word sr-char';   // wrap unit and animation unit in one
          w.textContent = part;
          node.appendChild(w);
        });
        return;
      }
      walk(node);
    });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });

  headings.forEach(h => {
    if (h.closest('.preloader')) return;
    /* Chapter headings on the homepage are revealed as whole blocks by the
       [data-rise] pass — running a per-character stagger on top of a block
       fade gives you two easings fighting over the same pixels. */
    if (h.closest('.chapter')) return;
    /* Cinematic hero headlines are owned by assets/hero.js, which splits them
       per word for the blur-in. Letting this pass run too nested one splitter
       inside the other and produced 38 "words" for a ten-word headline. */
    if (h.hasAttribute('data-blur-text')) return;
    walk(h);
    const chars = h.querySelectorAll('.sr-char');
    if (!chars.length) return;
    /* 0.02s apart like the reference, but capped so a long headline still
       finishes inside a second instead of crawling */
    chars.forEach((c, i) => { c.style.transitionDelay = Math.min(i * 0.02, 0.9).toFixed(3) + 's'; });
    h.classList.add('sr-split');

    /* the hero headline sits inside the old mask wrapper — hand it over */
    const mask = h.querySelector('.kinetic-mask');
    if (mask) mask.classList.add('is-split-active');

    if (h.closest('.hero, .page-hero')){
      /* above the fold: fire with the page-load sequence, not on scroll */
      const fire = () => setTimeout(() => h.classList.add('is-revealed'), 180);
      if (document.body.classList.contains('loaded')) fire();
      else {
        const watcher = new MutationObserver(() => {
          if (document.body.classList.contains('loaded')){ watcher.disconnect(); fire(); }
        });
        watcher.observe(document.body, { attributes:true, attributeFilter:['class'] });
      }
      return;
    }
    observer.observe(h);
  });
})();

/* ============ WHATSAPP DOCK ============
   Two numbers, so the button opens a menu rather than picking one. Closes on
   Escape, on an outside click, and after a choice — a popover that survives
   the navigation it just triggered is a popover you have to dismiss twice. */
(function initWhatsApp(){
  const toggle = document.getElementById('waToggle');
  const menu = document.getElementById('waMenu');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== toggle) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden){ setOpen(false); toggle.focus(); }
  });
})();

/* ============ FOOTER YEAR ============ */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ============ CONTACT FORM ============
   The quote form is owned by assets/quote.js, which validates per step and
   verifies the relay's response before claiming a send. The handler that used
   to live here POSTed to "/" and declared success on any resolved fetch — on
   a non-Netlify host that meant every brief was dropped while the visitor was
   told it had been sent. */

/* ============ LINE RAIN (ported from the reference's ambient dark bands) ====
   Thin light lines drifting down behind dark sections so a stats band reads as
   a designed surface instead of an empty rectangle. */
(function initLineRain(){
  document.querySelectorAll('[data-line-rain]').forEach(host => {
    if (reduceMotion) return;
    const count = parseInt(host.dataset.lineRain, 10) || 14;
    const rain = document.createElement('div');
    rain.className = 'line-rain';
    rain.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++){
      const line = document.createElement('i');
      line.style.left = ((i + Math.random() * 0.7) * (100 / count)).toFixed(2) + '%';
      line.style.animationDuration = (5.5 + Math.random() * 5).toFixed(2) + 's';
      line.style.animationDelay = (-Math.random() * 8).toFixed(2) + 's';
      line.style.opacity = (0.25 + Math.random() * 0.6).toFixed(2);
      rain.appendChild(line);
    }
    host.prepend(rain);
  });
})();

/* ============ ROTATING TEXT BADGE ============
   The reference's circular lettering badge: each character is rotated by one
   slice of the circle and the whole ring turns. */
(function initRotatingBadge(){
  document.querySelectorAll('[data-rotate-text]').forEach(badge => {
    const text = badge.dataset.rotateText;
    const ring = document.createElement('span');
    ring.className = 'badge-ring';
    ring.setAttribute('aria-hidden', 'true');
    const step = 360 / text.length;
    Array.from(text).forEach((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.transform = 'rotate(' + (i * step).toFixed(2) + 'deg)';
      ring.appendChild(span);
    });
    badge.prepend(ring);
  });
})();

/* ============ PROCESS ROW DRAW-IN ============
   Each step's rule draws across as the row enters, the way the reference
   reveals its work-process list. */
(function initProcessRows(){
  const rows = document.querySelectorAll('.process-row');
  if (!rows.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.35 });
  rows.forEach(r => observer.observe(r));
})();

/* The stepped quote card lives in assets/quote.js — it owns its own
   validation, progress rail and delivery, and is only loaded on contact.html. */

/* ============ EMBER FLOW ============
   A column of golden lights rising through each stat tile, tied to the figure
   counting up: the emission surges while the digits climb and settles to a
   slow ember drift once the number lands.

   One shared canvas per tile but a single rAF loop for all of them — six
   independent loops on one screen is six times the scheduling for no gain.
   The whole thing parks when the band scrolls away, and never starts under
   prefers-reduced-motion. */
(function initEmberFlow(){
  const tiles = Array.from(document.querySelectorAll('.stat-tile'));
  if (!tiles.length || reduceMotion) return;

  /* One gold sprite, blitted per ember. Building a gradient per particle per
     frame is what makes this kind of effect crawl. */
  const SPR = 24;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = SPR * 2;
  {
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(SPR, SPR, 0, SPR, SPR, SPR);
    grad.addColorStop(0,    'rgba(255,236,190,1)');
    grad.addColorStop(0.22, 'rgba(244,199,126,.62)');
    grad.addColorStop(0.55, 'rgba(222,140,60,.16)');
    grad.addColorStop(1,    'rgba(222,90,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SPR * 2, SPR * 2);
  }

  const units = tiles.map(tile => {
    const canvas = document.createElement('canvas');
    canvas.className = 'stat-flow';
    canvas.setAttribute('aria-hidden', 'true');
    tile.prepend(canvas);
    return {
      tile,
      canvas,
      ctx: canvas.getContext('2d'),
      figure: tile.querySelector('[data-count]'),
      embers: [],
      w: 0, h: 0, dpr: 1,
      spawnDebt: 0
    };
  });

  function measure(u){
    const r = u.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, w < 500 ? 1.5 : 2);
    if (w === u.w && h === u.h && dpr === u.dpr) return;
    u.w = w; u.h = h; u.dpr = dpr;
    u.canvas.width = Math.round(w * dpr);
    u.canvas.height = Math.round(h * dpr);
    u.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  units.forEach(measure);
  window.addEventListener('resize', () => units.forEach(measure), { passive:true });

  function spawn(u){
    /* Embers start along the lower edge, biased toward the left where the
       figure sits, so the light appears to lift off the number itself. */
    const bias = Math.random() < 0.62 ? Math.random() * 0.45 : Math.random();
    u.embers.push({
      x: bias * u.w,
      y: u.h + 8,
      vy: 0.42 + Math.random() * 0.85,
      sway: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      r: 3.2 + Math.random() * 8.5,
      life: 0,
      span: 130 + Math.random() * 120,
      hot: Math.random()
    });
  }

  let running = false, raf = 0, last = 0;

  function frame(now){
    if (!running) return;
    const dt = Math.min((now - last) / 16.667, 3);
    last = now;

    for (const u of units){
      const fig = u.figure;
      /* rate: a surge while counting, then a low idle so the tiles stay alive */
      const climbing = fig && fig.__countRate ? fig.__countRate : 0;
      const settled  = fig && fig.__countProgress >= 1 ? 1 : 0;
      const rate = climbing * 1.55 + settled * 0.18;

      u.spawnDebt += rate * dt;
      while (u.spawnDebt >= 1){ spawn(u); u.spawnDebt -= 1; }

      const ctx = u.ctx;
      ctx.clearRect(0, 0, u.w, u.h);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = u.embers.length - 1; i >= 0; i--){
        const e = u.embers[i];
        e.life += dt;
        e.y -= e.vy * dt * 1.9;
        const t = e.life / e.span;
        if (t >= 1 || e.y < -20){ u.embers.splice(i, 1); continue; }

        const x = e.x + Math.sin(e.phase + e.life * 0.045) * e.sway * 9;
        /* fade in over the first fifth, then out — an ember that pops into
           existence at full brightness reads as a glitch */
        const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        const a = Math.max(0, fade) * (0.42 + e.hot * 0.5);
        const rr = e.r * (0.65 + t * 0.7);
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, x - rr, e.y - rr, rr * 2, rr * 2);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    raf = requestAnimationFrame(frame);
  }

  function start(){
    if (running) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop(){
    running = false;
    if (raf) cancelAnimationFrame(raf);
    units.forEach(u => { u.ctx.clearRect(0, 0, u.w, u.h); u.embers.length = 0; });
  }

  const band = tiles[0].closest('.stats-grid') || tiles[0].parentElement;
  new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting){ units.forEach(measure); start(); }
      else stop();
    });
  }, { threshold: 0.08 }).observe(band);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (band.getBoundingClientRect().top < window.innerHeight) start();
  });
})();
