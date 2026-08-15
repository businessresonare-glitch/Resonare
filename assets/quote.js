/* ==========================================================================
   RESONARE — quote system

   What was wrong before
   ---------------------
   The old form POSTed to "/" with Netlify's form attributes and then did:

       fetch('/', ...).then(() => showSuccess())

   On Netlify that works. Anywhere else — GitHub Pages, Vercel, a plain host,
   or opening the file locally — "/" returns the homepage with HTTP 200, the
   promise resolves, and the visitor is told "Message sent" while the brief is
   thrown away. Every lead from a non-Netlify deploy was lost silently, which
   is the worst possible failure for a lead-generation site.

   What this does instead
   ----------------------
   1. POSTs the brief to a configurable relay that emails business.resonare@
      gmail.com, and inspects the actual response before claiming anything.
   2. Treats WhatsApp as a first-class delivery route, not a consolation
      prize — one tap opens a chat pre-filled with the whole brief.
   3. On any failure, says so plainly and hands over the WhatsApp and mailto
      routes with the brief already composed. It never reports a success that
      did not happen.

   Setup: the relay is FormSubmit, which needs no account and no API key. The
   very first submission triggers a one-time confirmation email to
   business.resonare@gmail.com — click the link in it once and every later
   brief arrives in that inbox. Until then the form falls back to WhatsApp and
   still tells the visitor the truth. To swap relays later, change ENDPOINT
   below or set data-quote-endpoint on the form.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    email: 'business.resonare@gmail.com',
    whatsapp: '60104259239',                   // +60 10-425 9239
    endpoint: 'https://formsubmit.co/ajax/business.resonare@gmail.com',
    timeout: 15000
  };

  var form = document.getElementById('quoteForm');
  if (!form) return;

  if (form.dataset.quoteEndpoint) CONFIG.endpoint = form.dataset.quoteEndpoint;
  if (form.dataset.quoteWhatsapp) CONFIG.whatsapp = form.dataset.quoteWhatsapp;
  if (form.dataset.quoteEmail) CONFIG.email = form.dataset.quoteEmail;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.quote-step'));
  var track = form.querySelector('.quote-track');
  var viewport = form.querySelector('.quote-viewport');
  var rail = form.querySelectorAll('.quote-rail i');
  var stepLabel = form.querySelector('.quote-step-label');
  var backBtn = form.querySelector('.quote-back');
  var nextBtn = form.querySelector('[data-quote-next]');
  var sendBtn = form.querySelector('[data-quote-send]');
  var sending = form.querySelector('.quote-sending');
  var shell = form.closest('.quote-card-shell') || form;

  var current = 0;
  var DRAFT_KEY = 'resonare.quote.draft';

  /* ---- height ------------------------------------------------------------
     The viewport is height-animated, so it needs a concrete pixel height for
     the current step. Measured after layout, and re-measured on resize and on
     any input that can wrap (a long textarea grows the step). */
  function syncHeight() {
    if (!viewport || !steps[current]) return;
    viewport.style.height = steps[current].offsetHeight + 'px';
  }

  function setStep(index, opts) {
    opts = opts || {};
    index = Math.max(0, Math.min(steps.length - 1, index));
    current = index;

    steps.forEach(function (s, i) {
      var on = i === index;
      s.classList.toggle('is-current', on);
      /* `hidden`/display:none would drop the step out of the flex track and
         break the slide, so off-screen steps stay laid out and are removed
         from interaction instead: CSS visibility takes them out of the focus
         order, `inert` takes them out of the accessibility tree. */
      if ('inert' in HTMLElement.prototype) s.inert = !on;
      else s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });

    if (track) track.style.transform = 'translateX(-' + (index * 100) + '%)';

    for (var r = 0; r < rail.length; r++) {
      rail[r].classList.toggle('is-done', r < index);
      rail[r].classList.toggle('is-active', r === index);
    }

    if (stepLabel) stepLabel.textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
    if (backBtn) backBtn.hidden = index === 0;
    var last = index === steps.length - 1;
    if (nextBtn) nextBtn.hidden = last;
    if (sendBtn) sendBtn.hidden = !last;

    requestAnimationFrame(syncHeight);
    setTimeout(syncHeight, 60);

    /* Move focus to the new step's heading so keyboard and screen-reader users
       land where the sighted user is looking. Skipped on first paint so the
       page does not scroll to the form on load. */
    if (!opts.silent) {
      var legend = steps[index].querySelector('.quote-legend');
      if (legend) {
        legend.setAttribute('tabindex', '-1');
        try { legend.focus({ preventScroll: true }); } catch (e) { legend.focus(); }
      }
    }
    updateEnergy();
  }

  /* ---- validation --------------------------------------------------------
     Native constraint validation, surfaced inline instead of relying on the
     browser bubble (which is unreadable on mobile and vanishes on scroll). */
  function fieldsIn(step) {
    return Array.prototype.slice.call(step.querySelectorAll('input, select, textarea'))
      .filter(function (el) { return el.type !== 'hidden' && !el.disabled; });
  }

  function showError(el, message) {
    var holder = el.closest('.form-group') || el.parentElement;
    if (!holder) return;
    var msg = holder.querySelector('.field-error');
    if (!msg) {
      msg = document.createElement('span');
      msg.className = 'field-error';
      msg.setAttribute('role', 'alert');
      holder.appendChild(msg);
    }
    if (message) {
      msg.textContent = message;
      msg.classList.add('is-shown');
      el.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
    } else {
      msg.classList.remove('is-shown');
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    }
    syncHeight();
  }

  function validateField(el) {
    if (el.checkValidity()) { showError(el, ''); return true; }
    var label = (el.labels && el.labels[0] ? el.labels[0].textContent : el.name) || 'This field';
    var message = el.validity.valueMissing
      ? label.replace(/\s*\*$/, '') + ' is required'
      : el.validity.typeMismatch && el.type === 'email'
        ? 'That email address does not look right'
        : el.validationMessage;
    showError(el, message);
    return false;
  }

  function validateStep(index) {
    var bad = null;
    fieldsIn(steps[index]).forEach(function (el) {
      if (!validateField(el) && !bad) bad = el;
    });
    if (bad) {
      bad.focus();
      shell.classList.remove('is-shake');
      void shell.offsetWidth;                    // restart the animation
      shell.classList.add('is-shake');
      setTimeout(function () { shell.classList.remove('is-shake'); }, 500);
    }
    return !bad;
  }

  /* ---- brief -------------------------------------------------------------- */
  function value(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
      var picked = form.querySelector('[name="' + name + '"]:checked');
      return picked ? picked.value : '';
    }
    return (el.value || '').trim();
  }

  var FIELDS = [
    ['project-type', 'Looking for'],
    ['timeline', 'Timeline'],
    ['trade', 'Trade'],
    ['business', 'Business'],
    ['name', 'Name'],
    ['email', 'Email'],
    ['phone', 'Phone / WhatsApp'],
    ['message', 'Notes']
  ];

  function reference() {
    var d = new Date();
    return 'RSN-' + String(d.getFullYear()).slice(2) +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function briefLines() {
    return FIELDS.map(function (f) {
      var v = value(f[0]);
      return v ? f[1] + ': ' + v : null;
    }).filter(Boolean);
  }

  function whatsappURL(ref) {
    var body = 'New project brief from the RESONARE site' + (ref ? ' (' + ref + ')' : '') +
      '\n\n' + briefLines().join('\n');
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(body);
  }

  function mailtoURL(ref) {
    var subject = 'Website brief — ' + (value('business') || value('name') || 'New enquiry');
    var body = briefLines().join('\n') + (ref ? '\n\nReference: ' + ref : '');
    return 'mailto:' + CONFIG.email +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  /* ---- progress energy, shared with the 3D orbit scene -------------------- */
  function updateEnergy() {
    var tracked = FIELDS.map(function (f) { return f[0]; });
    var done = tracked.filter(function (n) { return value(n).length > 1; }).length;
    window.__resonareQuoteEnergy = done / tracked.length;
  }

  /* ---- draft persistence -------------------------------------------------- */
  function saveDraft() {
    try {
      var data = {};
      FIELDS.forEach(function (f) { data[f[0]] = value(f[0]); });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) { /* private mode — a lost draft is not worth breaking on */ }
  }

  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function (name) {
        if (!data[name]) return;
        var el = form.elements[name];
        if (!el) return;
        if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
          var hit = form.querySelector('[name="' + name + '"][value="' + CSS.escape(data[name]) + '"]');
          if (hit) hit.checked = true;
        } else if (el.tagName) {
          el.value = data[name];
        }
      });
      syncCards();
    } catch (e) { /* ignore malformed drafts */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  /* ---- choice cards ------------------------------------------------------- */
  function syncCards() {
    form.querySelectorAll('.quote-card').forEach(function (card) {
      var input = card.querySelector('input');
      card.classList.toggle('is-selected', !!(input && input.checked));
    });
  }

  /* ---- result states ------------------------------------------------------ */
  function render(state, ref) {
    var wa = whatsappURL(ref);
    var mail = mailtoURL(ref);
    var ok = state === 'sent';

    var html =
      '<div class="quote-result' + (ok ? '' : ' is-warn') + '" role="status" aria-live="polite">' +
        '<div class="qs-mark">' +
          (ok
            ? '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
            : '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>') +
        '</div>' +
        (ok
          ? '<h3>Brief received</h3><p>It has landed in our inbox and we reply within one business day — usually much sooner. Want it seen in the next few minutes? Send it straight to our WhatsApp too.</p>'
          : '<h3>One tap to finish</h3><p>We could not reach our mail relay just now, so nothing has been sent yet. Your brief is ready below — send it on WhatsApp or by email and it reaches us immediately.</p>') +
        '<div class="quote-result-actions">' +
          '<a class="btn btn-whatsapp" href="' + wa + '" target="_blank" rel="noreferrer">' +
            (ok ? 'Also send on WhatsApp' : 'Send on WhatsApp') +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>' +
          '</a>' +
          (ok ? '' : '<a class="btn btn-outline" href="' + mail + '">Send by email</a>') +
        '</div>' +
        (ref ? '<p class="quote-ref">Reference ' + ref + '</p>' : '') +
      '</div>';

    shell.innerHTML = html;
    var mark = shell.querySelector('.qs-mark');
    if (mark) { mark.setAttribute('tabindex', '-1'); try { mark.focus({ preventScroll: true }); } catch (e) {} }
  }

  /* ---- submit ------------------------------------------------------------- */
  function payload(ref) {
    var data = {
      _subject: 'New website brief — ' + (value('business') || value('name') || 'RESONARE'),
      _template: 'table',
      _captcha: 'false',
      reference: ref,
      page: location.href
    };
    FIELDS.forEach(function (f) { data[f[1]] = value(f[0]) || '—'; });
    return data;
  }

  function send(ref) {
    if (!CONFIG.endpoint) return Promise.reject(new Error('no endpoint'));

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, CONFIG.timeout);

    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload(ref)),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      /* The old bug in one line: a 200 is not proof of delivery. Require the
         relay to say so, and treat an unparseable body as a failure. */
      if (!res.ok) throw new Error('relay returned ' + res.status);
      return res.json().catch(function () { throw new Error('relay returned a non-JSON body'); });
    }).then(function (body) {
      var okFlag = body && (body.success === true || body.success === 'true' || body.ok === true);
      if (!okFlag) throw new Error((body && (body.message || body.error)) || 'relay rejected the brief');
      return body;
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateStep(current)) return;

    var ref = reference();
    if (sending) sending.classList.add('is-on');
    if (sendBtn) sendBtn.disabled = true;

    send(ref).then(function () {
      clearDraft();
      render('sent', ref);
    }).catch(function (err) {
      if (window.console && console.warn) console.warn('[quote] relay failed:', err && err.message);
      render('fallback', ref);
    }).then(function () {
      if (sending) sending.classList.remove('is-on');
    });
  });

  /* ---- wiring ------------------------------------------------------------- */
  if (nextBtn) nextBtn.addEventListener('click', function () {
    if (validateStep(current)) setStep(current + 1);
  });
  if (backBtn) backBtn.addEventListener('click', function () { setStep(current - 1); });

  form.addEventListener('change', function (e) {
    if (e.target.closest('.quote-card')) syncCards();
    if (e.target.classList && e.target.classList.contains('is-invalid')) validateField(e.target);
    updateEnergy(); saveDraft();
  });

  form.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('is-invalid')) validateField(e.target);
    updateEnergy(); saveDraft();
    if (e.target.tagName === 'TEXTAREA') syncHeight();
  });

  form.addEventListener('blur', function (e) {
    if (e.target.matches && e.target.matches('input, select, textarea') && e.target.value) validateField(e.target);
  }, true);

  /* Enter advances rather than submitting a half-filled brief. */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (current < steps.length - 1) {
      e.preventDefault();
      if (validateStep(current)) setStep(current + 1);
    }
  });

  window.addEventListener('resize', syncHeight, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeight);

  restoreDraft();
  syncCards();
  updateEnergy();
  setStep(0, { silent: true });
})();
