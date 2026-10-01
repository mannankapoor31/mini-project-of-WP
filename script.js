/* ==========================================================================
   MERIDIAN 01 — script.js
   INITIALIZATION · OPTIONAL ASSETS · LOADER · REVEALS · NAVIGATION
   SCROLL DIRECTOR (watch movement) · EXPLODED VIEW · HOTSPOTS
   COUNTERS · CURSOR · SOUND SYSTEM · SOUND TOGGLE
   ========================================================================== */
(function () {
'use strict';

/* ============================ INITIALIZATION ============================ */

var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var isTouch      = window.matchMedia('(hover: none)').matches;
var isMobile     = function () { return window.innerWidth <= 860; };

var body      = document.body;
var stageInner= document.getElementById('stageInner');
var clamp     = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var lerp      = function (a, b, t) { return a + (b - a) * t; };
/* Smoothstep keeps every transition eased rather than linear — this is what
   makes the whole page feel like one continuous, unhurried camera move. */
var smooth    = function (t) { return t * t * (3 - 2 * t); };

/* ========================= OPTIONAL ASSETS ==============================
   Every <img data-optional> is a drop-in slot. If the file is not present
   beside index.html the image removes itself and the CSS-built version is
   used instead — so the site never shows a broken image.
   ====================================================================== */
(function optionalImages() {
  var imgs = document.querySelectorAll('img[data-optional]');
  Array.prototype.forEach.call(imgs, function (img) {
    var ok = function () {
      if (img.classList.contains('watch__photo')) body.classList.add('has-photo');
      else if (img.parentElement) img.parentElement.classList.add('has-img');
    };
    var fail = function () { if (img.parentElement) img.parentElement.removeChild(img); };

    if (img.complete) { (img.naturalWidth > 0 ? ok : fail)(); }
    else { img.addEventListener('load', ok); img.addEventListener('error', fail); }
  });
})();

/* ============================== LOADER ==================================
   Short and honest: it tracks the real page load, with a small floor so the
   reveal does not flash. No fake multi-second wait.
   ====================================================================== */
(function loader() {
  var el   = document.getElementById('loader');
  var fill = document.getElementById('loaderFill');
  var pct  = document.getElementById('loaderPct');
  var p = 0, done = false, start = Date.now();

  var tick = setInterval(function () {
    p = Math.min(p + Math.random() * 9 + 3, done ? 100 : 92);
    fill.style.width = p + '%';
    pct.textContent = (p < 10 ? '0' : '') + Math.round(p);
    if (p >= 100) { clearInterval(tick); finish(); }
  }, 90);

  function finish() {
    el.classList.add('is-done');
    body.classList.remove('is-loading');
    window.dispatchEvent(new Event('scroll'));
    setTimeout(function () { if (el.parentElement) el.parentElement.removeChild(el); }, 1200);
  }
  var readyOnce = false;
  function ready() {
    if (readyOnce) return;
    readyOnce = true;
    done = true;
    var wait = Math.max(0, 600 - (Date.now() - start));
    setTimeout(function () { p = 99; }, wait);
  }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
  /* The load event waits on every subresource, including the font host. Never
     hold the page behind a third party — reveal regardless after 2.5s. */
  setTimeout(ready, 2500);
})();

/* ============================== REVEALS =================================
   IntersectionObserver, not scroll maths — cheap and precise.
   ====================================================================== */
(function reveals() {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    Array.prototype.forEach.call(items, function (n) { n.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      /* Stagger siblings so lines of type arrive one after another. */
      var sibs = Array.prototype.slice.call(e.target.parentElement.querySelectorAll(':scope > .reveal'));
      var i = Math.max(0, sibs.indexOf(e.target));
      e.target.style.setProperty('--rd', (i * 110) + 'ms');
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
  Array.prototype.forEach.call(items, function (n) { io.observe(n); });
})();

/* ============================ NAVIGATION ================================ */
(function navigation() {
  var nav    = document.getElementById('nav');
  var links  = document.getElementById('navLinks');
  var burger = document.getElementById('navBurger');

  window.addEventListener('scroll', function () {
    nav.classList.toggle('is-stuck', window.scrollY > 40);
  }, { passive: true });

  /* Mobile menu */
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    body.classList.toggle('menu-open', open);
  });

  /* Smooth section navigation (native, so scrolling is never hijacked) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (links.classList.contains('is-open')) burger.click();
  });

  /* Active section highlight */
  var navLinks = document.querySelectorAll('.nav__links a');
  var map = {};
  Array.prototype.forEach.call(navLinks, function (a) { map[a.getAttribute('data-nav')] = a; });
  var watched = ['watch', 'design', 'materials', 'movement', 'exploded', 'specs'];
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (a && e.isIntersecting) {
          Array.prototype.forEach.call(navLinks, function (n) { n.classList.remove('is-active'); });
          a.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    watched.forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
})();

/* ========================= SCROLL DIRECTOR ==============================
   The single source of truth for the watch. Each section declares the state
   the watch should be in when that section is centred; the director
   interpolates continuously between them, so the watch is always in motion
   and never "jumps" between sections.

   To retune the choreography, edit STATES below:
     scale · x/y (fraction of viewport) · rx/rz (degrees) · op · blur
     gap     — pixel separation between the seven layers (exploded view)
     topOp   — opacity of crystal/bezel/dial/hands (dissolve to the movement)
     strapOp — strap opacity
     partsOp — CSS watch opacity when a real photo is supplied
     lx/ly   — position of the key light
     snd     — sound intensity, 0…1
   ====================================================================== */
var STATES = {
  hero:      { scale: 0.96, x: 0,     y: 0,   rx: 0,  rz: 0,   op: 1,    blur: 0, gap: 2,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 50, ly: 44, snd: 0.55 },
  intro:     { scale: 1.06, x: 0,     y: -2,  rx: 10, rz: -4,  op: 0.88, blur: 0, gap: 3,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 42, ly: 38, snd: 0.50 },
  design:    { scale: 1.02, x: 0.19,  y: 0,   rx: 4,  rz: 3,   op: 1,    blur: 0, gap: 2,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 66, ly: 46, snd: 0.62 },
  materials: { scale: 0.62, x: 0,     y: 0,   rx: 0,  rz: 0,   op: 0.09, blur: 5, gap: 2,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 50, ly: 50, snd: 0.45 },
  craft:     { scale: 1.12, x: 0.20,  y: 0,   rx: 15, rz: 9,   op: 0.55, blur: 1, gap: 4,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 62, ly: 40, snd: 0.60 },
  movement:  { scale: 1.06, x: 0.17,  y: 0,   rx: 3,  rz: 0,   op: 0.92,    blur: 0, gap: 3,  topOp: 0.05,strapOp: 0, partsOp: 1, lx: 50, ly: 44, snd: 0.85 },
  exploded:  { scale: 0.74, x: 0,     y: 0,   rx: 62, rz: -14, op: 1,    blur: 0, gap: 140, topOp: 1,  strapOp: 0, partsOp: 1, lx: 50, ly: 34, snd: 1.00 },
  specs:     { scale: 0.58, x: 0.26,  y: 0,   rx: 0,  rz: 0,   op: 0.22, blur: 2, gap: 2,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 70, ly: 50, snd: 0.55 },
  quote:     { scale: 1.85, x: 0,     y: 0,   rx: 0,  rz: 0,   op: 0.10, blur: 6, gap: 2,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 50, ly: 50, snd: 0.38 },
  final:     { scale: 1.00, x: 0,     y: 0,   rx: 0,  rz: 0,   op: 1,    blur: 0, gap: 2,  topOp: 1,   strapOp: 1, partsOp: 0, lx: 50, ly: 46, snd: 0.30 }
};
var KEYS = ['scale','x','y','rx','rz','op','blur','gap','topOp','strapOp','partsOp','lx','ly','snd'];

var watchEl = document.getElementById('watch');
var lightEl = document.querySelector('.stage__light');
var sections = Array.prototype.slice.call(document.querySelectorAll('[data-stage]'));
var beats = [];      /* {centre, state, name} sorted down the page */
var current = {}, target = {}, currentAct = '';

function measure() {
  beats = sections.map(function (s) {
    var name = s.getAttribute('data-stage');
    var r = s.getBoundingClientRect();
    return {
      name: name,
      centre: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2,
      state: STATES[name] || STATES.hero
    };
  }).sort(function (a, b) { return a.centre - b.centre; });
}

function sample() {
  var y = window.scrollY;
  var i = 0;
  while (i < beats.length - 1 && y > beats[i + 1].centre) i++;

  var a = beats[i], b = beats[Math.min(i + 1, beats.length - 1)];
  var span = b.centre - a.centre;
  var t = span > 0 ? smooth(clamp((y - a.centre) / span, 0, 1)) : 0;

  KEYS.forEach(function (k) { target[k] = lerp(a.state[k], b.state[k], t); });

  /* The act name drives CSS-only behaviour (hotspots, exploded labels). */
  var act = t < 0.5 ? a.name : b.name;
  if (act !== currentAct) {
    if (currentAct) body.classList.remove('act-' + currentAct);
    body.classList.add('act-' + act);
    currentAct = act;
  }
}

function apply() {
  var mobile = isMobile();
  var s = current;
  stageInner.style.setProperty('--scale', s.scale.toFixed(4));
  stageInner.style.setProperty('--sx', (mobile ? 0 : s.x * window.innerWidth).toFixed(1) + 'px');
  stageInner.style.setProperty('--sy', (s.y * window.innerHeight / 100).toFixed(1) + 'px');
  stageInner.style.setProperty('--op', (s.op > 0.995 ? 1 : s.op).toFixed(3));
  stageInner.style.filter = s.blur < 0.06 ? 'none' : 'blur(' + s.blur.toFixed(2) + 'px)';

  watchEl.style.setProperty('--rx', s.rx.toFixed(2) + 'deg');
  watchEl.style.setProperty('--rz', s.rz.toFixed(2) + 'deg');

  stageInner.style.setProperty('--gap', (mobile ? s.gap * 0.78 : s.gap).toFixed(2) + 'px');
  stageInner.style.setProperty('--topOp', s.topOp.toFixed(3));
  stageInner.style.setProperty('--strapOp', s.strapOp.toFixed(3));
  body.style.setProperty('--partsOp', s.partsOp.toFixed(3));

  lightEl.style.setProperty('--lx', s.lx.toFixed(1) + '%');
  lightEl.style.setProperty('--ly', s.ly.toFixed(1) + '%');
}

/* One rAF loop for all continuous motion. Nothing animates off the scroll
   event itself, so scrolling stays smooth even on slower machines. */
function frame() {
  sample();
  /* Extra easing on top of the scroll position: the watch always trails the
     scroll slightly, which reads as weight. */
  var k = reduceMotion ? 1 : 0.09;
  KEYS.forEach(function (key) { current[key] = lerp(current[key], target[key], k); });
  apply();
  Sound.setIntensity(current.snd);
  requestAnimationFrame(frame);
}

/* Boot the director */
measure();
sample();
KEYS.forEach(function (k) { current[k] = target[k]; });
apply();
requestAnimationFrame(frame);

var resizeTimer;
window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(measure, 150);
});
window.addEventListener('load', measure);

/* =========================== EXPLODED VIEW ==============================
   The seven layers are the same DOM nodes used in the hero — the watch is
   never swapped out, it simply comes apart. Labels and leader lines are
   generated from the data-label / data-copy attributes in index.html.
   ====================================================================== */
(function explodedView() {
  var host = document.getElementById('exlabels');
  var list = document.getElementById('explodedList');
  /* Feed each layer's stacking depth to CSS so the exploded transform can
     use it: translateZ(depth × gap). */
  Array.prototype.forEach.call(document.querySelectorAll('.part[data-z]'), function (el) {
    el.style.setProperty('--z', el.dataset.z);
  });

  var parts = Array.prototype.slice.call(document.querySelectorAll('.part[data-label]'));

  /* Top of the stack (crystal, z=6) down to the caseback (z=0). */
  parts.sort(function (a, b) { return +b.dataset.z - +a.dataset.z; });

  parts.forEach(function (part, i) {
    var z = +part.dataset.z;
    var label = document.createElement('div');
    label.className = 'exlabel';
    label.style.setProperty('--z', z);
    label.style.setProperty('--ox', '54%');
    label.style.setProperty('--d', (i * 90) + 'ms');
    label.innerHTML = '<i></i><b></b><span></span>';
    label.querySelector('b').textContent = part.dataset.label;
    label.querySelector('span').textContent = part.dataset.copy;
    host.appendChild(label);

    var li = document.createElement('li');
    li.innerHTML = '<b></b><span></span>';
    li.querySelector('b').textContent = part.dataset.label;
    li.querySelector('span').textContent = part.dataset.copy;
    list.appendChild(li);
  });
})();

/* ============================= HOTSPOTS ================================= */
(function hotspots() {
  var readout = document.getElementById('hotReadout');
  var spots = document.querySelectorAll('.hot');
  var active = null;

  function show(btn) {
    if (active) active.setAttribute('aria-expanded', 'false');
    active = btn;
    btn.setAttribute('aria-expanded', 'true');
    readout.innerHTML = '<b></b><p></p>';
    readout.querySelector('b').textContent = btn.dataset.title;
    readout.querySelector('p').textContent = btn.dataset.text;
    readout.classList.add('is-on');
  }

  Array.prototype.forEach.call(spots, function (btn) {
    btn.addEventListener('click', function () { show(btn); });
    btn.addEventListener('focus', function () { show(btn); });
    if (!isTouch) btn.addEventListener('mouseenter', function () { show(btn); });
  });
})();

/* ============================== COUNTERS ================================ */
(function counters() {
  var nums = document.querySelectorAll('.count');
  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(nums, function (n) { n.textContent = n.dataset.to; });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      run(e.target); io.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  Array.prototype.forEach.call(nums, function (n) { io.observe(n); });

  function run(el) {
    var to = parseFloat(el.dataset.to);
    var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    var comma = el.dataset.format === 'comma';
    var dur = reduceMotion ? 0 : 1700, t0 = performance.now();

    function fmt(v) {
      var s = String(Math.round(v));
      if (comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return pre + s + suf;
    }
    (function step(now) {
      var p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
})();

/* =============================== CURSOR ================================= */
(function cursor() {
  if (isTouch || reduceMotion) return;
  var el = document.getElementById('cursor');
  var dot = el.querySelector('.cursor__dot');
  var ring = el.querySelector('.cursor__ring');
  var label = el.querySelector('.cursor__label');
  var x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;

  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    body.classList.add('has-cursor');
    var hit = e.target && e.target.closest ? e.target.closest('a, button, .mat, .hot') : null;
    body.classList.toggle('cursor-hover', !!hit);
    if (hit) label.textContent = hit.classList.contains('hot') ? 'DETAIL'
      : hit.classList.contains('mat') ? 'MATERIAL' : 'VIEW';
  }, { passive: true });

  document.addEventListener('mouseleave', function () { body.classList.remove('has-cursor'); });

  (function loop() {
    rx = lerp(rx, x, 0.18); ry = lerp(ry, y, 0.18);
    dot.style.transform   = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
    ring.style.transform  = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
    label.style.transform = 'translate(' + rx + 'px,' + (ry + 44) + 'px) translate(-50%,-50%)';
    requestAnimationFrame(loop);
  })();
})();

/* ============================ SOUND SYSTEM ==============================
   Two paths, chosen automatically:

   1. If a real recording named watch-tick.mp3 sits beside index.html it is
      decoded and looped gaplessly through the Web Audio API (an
      AudioBufferSourceNode loop is sample-accurate, so there is no seam),
      with a tiny random playback-rate drift so it never sounds like the
      same two seconds repeating.
      // Replace watch-tick.mp3 with the provided mechanical watch sound.

   2. If no file is present, the movement is synthesised: a 4 Hz escapement
      beat (28,800 vph) built from filtered noise bursts, with alternating
      beat strength, per-tick jitter, a faint mechanical room tone and an
      occasional rotor whir. It never repeats, because nothing is looping.

   Volume is deliberately tiny — you are standing next to a wristwatch,
   not a wall clock.
   ====================================================================== */
var Sound = (function () {
  var BASE_VOLUME = 0.08;   // <- master loudness. Raise/lower here.
  var BEAT = 1 / 8;         // 28,800 vph = 8 beats per second

  var ctx = null, master = null, ambience = null, ambGain = null;
  var noiseBuf = null, sampleBuf = null, sampleSrc = null;
  var enabled = false, ready = false, intensity = 0.5;
  var nextBeat = 0, beatIndex = 0, nextWhir = 0, timer = null;

  function makeNoise(seconds, brown) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else d[i] = w;
    }
    return buf;
  }

  /* One escapement beat: a short filtered noise burst with a hard attack. */
  function beat(time, strength) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    var band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2300 + Math.random() * 900;
    band.Q.value = 6;

    var click = ctx.createBiquadFilter();
    click.type = 'bandpass';
    click.frequency.value = 5000 + Math.random() * 1400;
    click.Q.value = 11;

    var g = ctx.createGain();
    var amp = 0.5 * strength;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(amp, time + 0.0007);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.017 + Math.random() * 0.008);

    src.connect(band); band.connect(click); click.connect(g); g.connect(master);
    src.start(time, Math.random() * 0.2, 0.06);
    src.stop(time + 0.07);
  }

  /* Rare, very faint rotor swing — the sound of an automatic being worn. */
  function whir(time) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(420, time);
    f.frequency.exponentialRampToValueAtTime(1500, time + 0.34);
    f.frequency.exponentialRampToValueAtTime(360, time + 0.85);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.05, time + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.9);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(time); src.stop(time + 1.0);
  }

  /* Look-ahead scheduler: audio events are queued ahead of time so timing
     never depends on the main thread. */
  function schedule() {
    if (!ctx || sampleBuf) return;
    var horizon = ctx.currentTime + 0.2;
    while (nextBeat < horizon) {
      var jitter = (Math.random() - 0.5) * 0.0022;
      beat(nextBeat + jitter, beatIndex % 2 ? 0.74 : 1);
      beatIndex++;
      nextBeat += BEAT;
    }
    if (ctx.currentTime > nextWhir) {
      whir(ctx.currentTime + 0.1);
      nextWhir = ctx.currentTime + 16 + Math.random() * 26;
    }
  }

  function build() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    noiseBuf = makeNoise(0.5, false);

    /* Faint mechanical room tone under everything. */
    ambience = ctx.createBufferSource();
    ambience.buffer = makeNoise(3, true);
    ambience.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 340;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.1;
    ambience.connect(lp); lp.connect(ambGain); ambGain.connect(master);
    ambience.start();

    nextBeat = ctx.currentTime + 0.08;
    nextWhir = ctx.currentTime + 8;
    timer = setInterval(schedule, 25);
    ready = true;

    loadSample();
  }

  /* Use a real recording if one was provided. */
  function loadSample() {
    if (!window.fetch) return;
    fetch('watch-tick.mp3')
      .then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(function (b) { return ctx.decodeAudioData(b); })
      .then(function (buf) {
        sampleBuf = buf;
        clearInterval(timer);                 // stop the synthesised beat
        sampleSrc = ctx.createBufferSource();
        sampleSrc.buffer = buf;
        sampleSrc.loop = true;                // gapless, sample-accurate
        sampleSrc.playbackRate.value = 1;
        sampleSrc.connect(master);
        sampleSrc.start();
        /* Tiny continuous drift so a short recording never reveals its loop. */
        setInterval(function () {
          if (!sampleSrc) return;
          sampleSrc.playbackRate.setTargetAtTime(
            0.99 + Math.random() * 0.02, ctx.currentTime, 3);
        }, 5000);
      })
      .catch(function () { /* no file (or opened via file://) — keep the synth */ });
  }

  function volume() {
    if (!master) return;
    var v = enabled ? BASE_VOLUME * (0.45 + intensity * 0.55) : 0;
    /* setTargetAtTime gives a soft fade instead of a click. */
    master.gain.setTargetAtTime(v, ctx.currentTime, enabled ? 0.7 : 0.35);
    if (ambGain) ambGain.gain.setTargetAtTime(0.06 + intensity * 0.16, ctx.currentTime, 1.2);
  }

  return {
    enable: function () {
      build();
      if (!ready) return false;
      enabled = true;
      if (ctx.state === 'suspended') ctx.resume();
      volume();
      return true;
    },
    disable: function () {
      enabled = false;
      volume();
      /* Free the CPU shortly after the fade-out completes. */
      if (ctx) setTimeout(function () { if (!enabled && ctx.state === 'running') ctx.suspend(); }, 1200);
    },
    isEnabled: function () { return enabled; },
    setIntensity: function (v) {
      if (typeof v !== 'number' || isNaN(v)) return;
      if (Math.abs(v - intensity) < 0.02) return;
      intensity = clamp(v, 0, 1);
      if (enabled) volume();
    }
  };
})();

/* ============================ SOUND TOGGLE ==============================
   Autoplay rules are respected, never worked around: no AudioContext is
   even created until the user acts. The choice is remembered for the
   current tab session only.
   ====================================================================== */
(function soundToggle() {
  var btn   = document.getElementById('soundToggle');
  var state = document.getElementById('soundState');
  var wantsSound = false;

  function paint(on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Disable mechanical movement sound'
                                      : 'Enable mechanical movement sound');
    state.textContent = on ? 'ON' : 'OFF';
  }

  function set(on) {
    var ok = on ? Sound.enable() : (Sound.disable(), true);
    wantsSound = on && ok;
    paint(wantsSound);
    try { sessionStorage.setItem('meridian-sound', on && ok ? '1' : '0'); } catch (e) {}
  }

  btn.addEventListener('click', function () { set(!wantsSound); });

  /* If sound was on earlier in this session, restore it at the first
     genuine interaction — which is exactly what browsers ask for. */
  var wanted = false;
  try { wanted = sessionStorage.getItem('meridian-sound') === '1'; } catch (e) {}
  if (wanted && !reduceMotion) {
    var restore = function () {
      set(true);
      ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
        window.removeEventListener(ev, restore);
      });
    };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, restore, { once: false, passive: true });
    });
  }

  /* Never keep ticking in a tab nobody is looking at. The user's choice is
     kept separately from playback, so the sound comes back on return. */
  document.addEventListener('visibilitychange', function () {
    if (!wantsSound) return;
    if (document.hidden) Sound.disable();
    else Sound.enable();
  });

  paint(false);
})();

})();
