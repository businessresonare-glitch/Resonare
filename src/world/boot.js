/* ==========================================================================
   RESONARE — WORLD BOOT
   Finds the canvas, drives the flight from the page scroll, and degrades
   honestly when 3D is not on the table.

   Three ways this can end up without a canvas, all of them fine:
     - no WebGL context (old browser, blocklisted driver, headless)
     - prefers-reduced-motion (the world still renders, but only as still
       frames written on scroll — no rAF, no drift, no parallax)
     - save-data / very low memory devices
   In the first case `body.no-world` turns on a CSS-only backdrop that keeps
   every chapter readable. The copy never lived in the canvas, so nothing is
   lost but the flight.
   ========================================================================== */
import { createWorld } from './index.js';

function boot() {
  const canvas = document.getElementById('worldCanvas');
  const host = document.getElementById('world');
  if (!canvas || !host) return;

  const saveData = navigator.connection && navigator.connection.saveData;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory < 2;
  if (saveData || lowMem) return fail();

  let world;
  try {
    world = createWorld(canvas, {
      shots: JSON.parse(canvas.dataset.shots || '[]'),
      reviews: JSON.parse(canvas.dataset.reviews || '[]')
    });
  } catch (err) {
    world = null;
  }
  if (!world) return fail();

  document.body.classList.add('has-world');

  /* --- progress -------------------------------------------------------- */
  let top = 0, range = 1;
  function measure() {
    const box = host.getBoundingClientRect();
    top = box.top + scrollY;
    range = Math.max(1, host.offsetHeight - innerHeight);
  }
  function onScroll() {
    const p = (scrollY - top) / range;
    world.setProgress(p);
    /* the canvas is sticky inside #world, so it stops painting the moment
       the section is behind us — no reason to keep a GPU loop alive */
    const near = scrollY > top - innerHeight && scrollY < top + host.offsetHeight;
    world.setActive(near && !world.reduced);
    /* the flight ends in daylight — past this point the overlay type has to
       flip to ink or it disappears into a cream sky */
    host.classList.toggle('is-light', p > 0.865);
  }

  measure();
  onScroll();
  world.setActive(!world.reduced);

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });
  /* fonts and lazy images change layout height after first paint */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { measure(); onScroll(); });
  }
  addEventListener('load', () => { measure(); onScroll(); });

  window.RESONARE_WORLD = world;
}

function fail() {
  document.body.classList.add('no-world');
  const canvas = document.getElementById('worldCanvas');
  if (canvas) canvas.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
