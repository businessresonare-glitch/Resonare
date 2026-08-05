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
    window.addEventListener('load', () => {
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      if (status) status.textContent = 'Ready';
      document.body.classList.add('loaded');
      setTimeout(() => { pre.classList.add('hidden'); pre.style.display = 'none'; }, 150);
    });
    return;
  }

  let progress = 0;
  let loaded = false;
  window.addEventListener('load', () => { loaded = true; });

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

/* ============ MOBILE DRAWER ============ */
const drawer = document.getElementById('mobileDrawer');
const menuOpen = document.getElementById('menuOpen');
const menuClose = document.getElementById('menuClose');
if (menuOpen && drawer) menuOpen.addEventListener('click', () => drawer.classList.add('open'));
if (menuClose && drawer) menuClose.addEventListener('click', () => drawer.classList.remove('open'));
if (drawer) drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => drawer.classList.remove('open')));

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
   POINTER LAYER — cursor, magnetic buttons, card tilt.

   Why the old cursor felt broken:
     1. CSS put `transition: transform .12s` on the dot while JS rewrote that
        same transform on every mousemove, so the transition restarted each
        frame and the dot permanently trailed the pointer.
     2. The native cursor was never hidden, so you saw the OS arrow *and* a
        lagging dot.
     3. Tone detection only looked for a dark ancestor, so the white cards
        floating inside the dark hero turned the dot white-on-white.
   Everything below is written per animation frame with no transform
   transitions anywhere.
   ========================================================================== */
const darkZoneSelector = '.hero, .page-hero, .signal-section, .impact, .reviews, .final-cta, .work, .site-footer, .mobile-drawer, .site-header.scrolled';

(function initCursor(){
  const root = document.getElementById('cursor');
  if (!root || reduceMotion || !finePointer) return;

  const dot  = root.querySelector('.cursor-dot');
  const ring = root.querySelector('.cursor-ring');
  if (!dot || !ring) return;

  document.body.classList.add('cursor-custom');

  const INTERACTIVE = 'a, button, .btn, [role="button"], label, .service-card, .work-card, .plan-card, .tech-cell, .trust-chip, .impact-card, .review-card, .section-dots button, .sticky-socials a';
  const FIELDS = 'input, textarea, select';

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let ringX = pointerX, ringY = pointerY;
  let ringScale = 1, dotScale = 1;
  let hovering = false, pressed = false, onLight = false;
  let lastTarget = null;

  /* Walk up from the hovered element until a surface with a real background
     colour is found, and judge tone from its luminance. Falls back to the
     section list when the surface is a gradient or image. */
  function surfaceIsLight(el){
    let node = el;
    while (node && node !== document.documentElement){
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m){
        const parts = m[1].split(',').map(Number);
        const alpha = parts.length > 3 ? parts[3] : 1;
        if (alpha > 0.5){
          const lum = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
          return lum > 0.55;
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function readTone(el){
    const measured = surfaceIsLight(el);
    if (measured !== null) return measured;
    return !el.closest(darkZoneSelector);
  }

  function updateTarget(el){
    if (el === lastTarget) return;
    lastTarget = el;

    if (el.closest(FIELDS)){
      root.classList.add('is-hidden');
      return;
    }
    root.classList.remove('is-hidden');

    hovering = !!el.closest(INTERACTIVE);
    root.classList.toggle('is-active', hovering);

    onLight = readTone(el);
    root.classList.toggle('on-light', onLight);
  }

  function frame(){
    ringX += (pointerX - ringX) * 0.19;
    ringY += (pointerY - ringY) * 0.19;

    const ringTarget = pressed ? 0.82 : hovering ? 1.85 : 1;
    const dotTarget  = pressed ? 0.5  : hovering ? 0.32 : 1;
    ringScale += (ringTarget - ringScale) * 0.18;
    dotScale  += (dotTarget  - dotScale)  * 0.22;

    ring.style.transform = 'translate3d(' + ringX.toFixed(2) + 'px,' + ringY.toFixed(2) + 'px,0) scale(' + ringScale.toFixed(3) + ')';
    dot.style.transform  = 'translate3d(' + pointerX + 'px,' + pointerY + 'px,0) scale(' + dotScale.toFixed(3) + ')';

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('mousemove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (!root.classList.contains('is-visible')) root.classList.add('is-visible');
    if (e.target instanceof Element) updateTarget(e.target);
  }, { passive:true });

  window.addEventListener('mousedown', (e) => {
    pressed = true;
    if (e.target instanceof Element && e.target.closest(FIELDS)) return;
    const ping = document.createElement('span');
    ping.className = 'cursor-ping' + (onLight ? ' on-light' : '');
    ping.style.left = e.clientX + 'px';
    ping.style.top  = e.clientY + 'px';
    document.body.appendChild(ping);
    setTimeout(() => ping.remove(), 640);
  });
  window.addEventListener('mouseup', () => { pressed = false; });

  document.addEventListener('mouseleave', () => root.classList.remove('is-visible'));
  document.addEventListener('mouseenter', () => root.classList.add('is-visible'));
  window.addEventListener('blur', () => { pressed = false; root.classList.remove('is-visible'); });

  /* the pointer can land on a different element without moving — after a
     scroll, or after the preloader clears — so re-read the tone then */
  window.addEventListener('scroll', () => {
    const el = document.elementFromPoint(pointerX, pointerY);
    if (el) { lastTarget = null; updateTarget(el); }
  }, { passive:true });
})();

/* ============ SECTION DOT NAV (only present on pages with data-target sections) ============ */
const dotButtons = document.querySelectorAll('.section-dots button');
const dotNav = document.getElementById('sectionDots');
if (dotButtons.length) {
  const trackedSections = Array.from(dotButtons).map(btn => document.querySelector(btn.dataset.target)).filter(Boolean);
  dotButtons.forEach(btn => { btn.addEventListener('click', () => smoothScrollTo(btn.dataset.target)); });
  const darkSectionEls = Array.from(document.querySelectorAll('[data-dot-dark]'));
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = trackedSections.indexOf(entry.target);
        if (idx > -1) { dotButtons.forEach(b => b.classList.remove('active')); dotButtons[idx].classList.add('active'); }
        if (dotNav) dotNav.setAttribute('data-dark', darkSectionEls.includes(entry.target) ? 'true' : 'false');
      }
    });
  }, { threshold: 0.5 });
  trackedSections.forEach(sec => sectionObserver.observe(sec));
}

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
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = format(target, decimals, suffix, prefix);
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
      /* <em> carries a clipped gradient fill — split it and the fill breaks,
         so it animates as one unit instead of per character */
      if (node.tagName === 'EM'){ node.classList.add('sr-char'); return; }
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

/* ============ FOOTER YEAR ============ */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ============ CONTACT FORM (Netlify AJAX) ============ */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = 'Sending…';
    btn.disabled = true;
    const formData = new FormData(contactForm);
    fetch('/', { method: 'POST', body: new URLSearchParams(formData).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(() => {
        contactForm.innerHTML = '<div style="text-align:center; padding:30px 0;"><h3 style="margin-bottom:10px;">Message sent</h3><p style="color:var(--ink-soft);">We reply within one business day — usually much sooner.</p></div>';
      })
      .catch(() => {
        btn.innerHTML = original; btn.disabled = false;
        alert('Something went wrong. Please WhatsApp us instead — it\'s faster anyway.');
      });
  });
}

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

/* ============ QUOTE FORM ============
   Card choices are real radio inputs, so keyboard and Netlify both work; the
   progress bar reflects how much of the brief is filled in. */
(function initQuoteForm(){
  const form = document.getElementById('contactForm');
  if (!form) return;

  const cards = form.querySelectorAll('.quote-card input');
  const bar = form.querySelector('#quoteProgress');

  function syncCards(){
    form.querySelectorAll('.quote-card').forEach(card => {
      card.classList.toggle('is-selected', card.querySelector('input').checked);
    });
  }
  cards.forEach(input => input.addEventListener('change', () => { syncCards(); updateProgress(); }));
  syncCards();

  const tracked = Array.from(form.querySelectorAll('[data-track]'));
  function updateProgress(){
    if (!bar) return;
    const done = tracked.filter(el => {
      if (el.type === 'radio') return !!form.querySelector('input[name="' + el.name + '"]:checked');
      return el.value.trim().length > 1;
    }).length;
    const pct = Math.round((done / tracked.length) * 100);
    bar.style.width = pct + '%';
    bar.parentElement.setAttribute('data-complete', pct === 100 ? 'true' : 'false');
  }
  tracked.forEach(el => {
    el.addEventListener('input', updateProgress);
    el.addEventListener('change', updateProgress);
    el.addEventListener('blur', () => {
      if (el.required) el.classList.toggle('is-invalid', !el.checkValidity());
    });
  });
  updateProgress();
})();
