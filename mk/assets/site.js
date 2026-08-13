/* ==========================================================================
   MK — site behaviour
   Nav, scroll rail, reveals, counters, the reel, the photo slots and the
   quote handoff. No dependencies, no external requests.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  /* ---- year ------------------------------------------------------------- */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- header + scroll rail --------------------------------------------- */
  var header = $('#header');
  var rail = $('#rail');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (header) header.classList.toggle('scrolled', y > 24);
      if (rail) {
        var max = doc.documentElement.scrollHeight - window.innerHeight;
        rail.style.width = (max > 0 ? (y / max) * 100 : 0).toFixed(2) + '%';
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- mobile nav -------------------------------------------------------- */
  var toggle = $('#navtoggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = doc.body.classList.toggle('navopen');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('#nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        doc.body.classList.remove('navopen');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- smooth in-page jumps ---------------------------------------------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var el = doc.getElementById(id.slice(1));
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });

  /* ---- reveals ----------------------------------------------------------- */
  var revealables = $$('.rv');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- counters ---------------------------------------------------------- */
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    if (isNaN(target)) return;
    if (reduceMotion) { el.textContent = prefix + target + suffix; return; }
    var dur = 1500, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCount(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCount);
  }

  /* ---- card pointer glow -------------------------------------------------- */
  if (!reduceMotion && matchMedia('(hover:hover)').matches) {
    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      }, { passive: true });
    });
  }

  /* ---- photo slots --------------------------------------------------------
     The gallery ships with the filenames already wired but the files absent —
     same convention as the parent site's hero videos. A missing photo must
     look like a labelled slot, never a broken-image icon, so the page is
     presentable before anyone has uploaded anything.                          */
  $$('.shot img').forEach(function (img) {
    function markEmpty() { img.closest('.shot').classList.add('empty'); }
    if (img.complete && img.naturalWidth === 0) markEmpty();
    img.addEventListener('error', markEmpty);
  });

  /* ---- the reel -----------------------------------------------------------
     preload="none" until the visitor asks for it: the file is 5.4MB and this
     is proof, not decoration. It must never compete with the headline.        */
  var reel = $('#reel'), reelVideo = $('#reelVideo'), reelPlay = $('#reelPlay');
  if (reel && reelVideo && reelPlay) {
    reelPlay.addEventListener('click', function () {
      reel.classList.add('playing');
      reelVideo.controls = true;
      reelVideo.play().catch(function () {
        /* autoplay policies vary; controls are already on, so the visitor can
           still start it themselves */
        reel.classList.remove('playing');
      });
    });
    reelVideo.addEventListener('pause', function () {
      if (reelVideo.currentTime === 0) reel.classList.remove('playing');
    });
  }

  /* ---- quote form ---------------------------------------------------------
     Handed off to WhatsApp with the whole brief pre-filled. That route needs
     no account, no API key and no DNS, so it works the moment the page is
     live — and the visitor can see their message before it sends, which an
     email relay can never offer. The brief is kept in localStorage as it is
     typed so a reload does not lose it.                                       */
  var form = $('#quoteForm');
  if (form) {
    var status = $('#formstatus');
    var KEY = 'mk-quote-draft';

    /* restore a draft */
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      Object.keys(saved).forEach(function (k) {
        var f = form.elements[k];
        if (f && typeof saved[k] === 'string') f.value = saved[k];
      });
    } catch (e) { /* private mode, or corrupt draft — start clean */ }

    form.addEventListener('input', function () {
      try {
        var data = {};
        ['name', 'phone', 'job', 'location', 'message'].forEach(function (k) {
          if (form.elements[k]) data[k] = form.elements[k].value;
        });
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { /* storage full or blocked — the form still works */ }
    });

    function ref() {
      var d = new Date();
      var stamp = String(d.getFullYear()).slice(2) +
                  String(d.getMonth() + 1).padStart(2, '0') +
                  String(d.getDate()).padStart(2, '0');
      return 'MK-' + stamp + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();

      if (!name || !phone) {
        status.className = 'formstatus warn';
        status.textContent = 'Please add your name and a phone number so we can call you back.';
        (name ? form.elements.phone : form.elements.name).focus();
        return;
      }

      var r = ref();
      var lines = [
        'New job enquiry — ' + r,
        '',
        'Name: ' + name,
        'Phone: ' + phone,
        'Job: ' + form.elements.job.value,
        'Location: ' + (form.elements.location.value.trim() || '—'),
        '',
        form.elements.message.value.trim() || '(no extra details)'
      ];

      var wa = form.getAttribute('data-quote-whatsapp') || '60164397900';
      var url = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(lines.join('\n'));
      var win = window.open(url, '_blank', 'noopener');

      if (win) {
        status.className = 'formstatus ok';
        status.innerHTML = 'Opening WhatsApp with your details — just press send. ' +
          'Your reference is <strong>' + r + '</strong>.';
        try { localStorage.removeItem(KEY); } catch (e2) {}
      } else {
        /* a blocked popup would otherwise look like a silent failure */
        status.className = 'formstatus warn';
        status.innerHTML = 'Your browser blocked the WhatsApp window. ' +
          '<a href="' + url + '" rel="noopener">Tap here to send your details</a>, ' +
          'or call <a href="tel:+60164397900">+60 16-439 7900</a>.';
      }
    });
  }

})();
