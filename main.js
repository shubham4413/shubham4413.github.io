// Portfolio behaviour: reveals, the hero strip, project reels, looping clips and the checkpoint chart.
// Every part leaves the page readable when it does not run.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection && navigator.connection.saveData;
const autoplayOK = () => !reduce.matches && !saveData;

// Reveal once when an element enters the viewport; stagger siblings that enter together.
(() => {
  document.querySelectorAll('.chapter > h2, .stages li, .failures li, .spec dd, .page-reel > li, .page-next > *').forEach((el) => el.setAttribute('data-reveal', ''));
  const targets = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((entry, i) => {
      entry.target.style.setProperty('--i', i);
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  targets.forEach((el) => io.observe(el));
  addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); });
  }, 2500));
})();

// Mouse drag for sideways rows. Touch, trackpads and keys already scroll them natively.
function draggable(track) {
  let startX = 0, startLeft = 0, moved = false, down = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    if (moved) {
      // let snapping take over again from where the drag ended
      const left = track.scrollLeft;
      track.classList.remove('is-dragging');
      track.scrollLeft = left;
    }
  });
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
}

function centreOn(track, item) {
  const left = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;
  track.scrollLeft = Math.max(0, left);
}

// Hero strip: the frame nearest the centre is lit, captioned and, when it has a clip, playing.
(() => {
  const strip = document.querySelector('[data-strip]');
  if (!strip) return;
  const track = strip.querySelector('[data-strip-track]');
  const caption = strip.querySelector('[data-strip-caption]');
  const frames = [...track.children];
  frames.forEach((f, i) => f.style.setProperty('--i', i));
  let current = null, queued = false, heroVisible = true;

  const clipFor = (frame) => {
    if (!frame.dataset.clip || !autoplayOK()) return null;
    let v = frame.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto' });
      v.setAttribute('aria-hidden', 'true');
      v.poster = frame.querySelector('img').src;
      v.src = frame.dataset.clip;
      frame.querySelector('a').appendChild(v);
    }
    return v;
  };

  const update = () => {
    queued = false;
    const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
    let best = frames[0], bestD = Infinity;
    for (const f of frames) {
      const r = f.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best !== current) {
      if (current) { current.classList.remove('is-centre'); const v = current.querySelector('video'); if (v) v.pause(); }
      current = best;
      current.classList.add('is-centre');
      caption.textContent = current.dataset.caption;
    }
    const v = clipFor(current);
    if (v) heroVisible ? v.play().catch(() => {}) : v.pause();
    const x = Math.max(0, current.getBoundingClientRect().left - strip.getBoundingClientRect().left - parseFloat(getComputedStyle(caption).paddingLeft));
    caption.style.transform = `translateX(${Math.max(0, Math.min(x, strip.clientWidth - caption.offsetWidth)).toFixed(0)}px)`;
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  track.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; queue(); }).observe(strip);
  draggable(track);
  centreOn(track, frames[1]);
  update();
  addEventListener('load', () => { centreOn(track, frames[1]); update(); });
})();

// Project reels: start with the clip in the middle, its neighbours cut by the edges.
(() => {
  document.querySelectorAll('[data-reel]').forEach((reel) => {
    draggable(reel);
    const clip = reel.querySelector('.reel__clip');
    if (!clip) return;
    const place = () => centreOn(reel, clip);
    place();
    addEventListener('load', place);
  });
})();

// Looping clips play only while on screen; with reduced motion or Save-Data they get controls instead.
(() => {
  const clips = document.querySelectorAll('video[data-loop]');
  if (!autoplayOK() || !('IntersectionObserver' in window)) { clips.forEach((v) => { v.controls = true; }); return; }
  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) { target.preload = 'auto'; target.play().catch((err) => { if (err.name === 'NotAllowedError') target.controls = true; }); }
      else target.pause();
    }
  }, { threshold: 0.45 });
  clips.forEach((v) => io.observe(v));
  document.addEventListener('visibilitychange', () => { if (document.hidden) clips.forEach((v) => v.pause()); });
})();

// Checkpoint comparison: one checkpoint at a time, read from the table so the numbers live in one place.
(() => {
  const fig = document.querySelector('[data-ckpt]');
  if (!fig) return;
  const rows = [...fig.querySelectorAll('[data-ckpt-row]')].map((tr) => [...tr.querySelectorAll('td')].map((td) => parseInt(td.textContent, 10)));
  const buttons = [...fig.querySelectorAll('[data-ckpt-key]')];
  const bars = [...fig.querySelectorAll('[data-bar]')];
  const vals = [...fig.querySelectorAll('[data-val]')];
  const note = fig.querySelector('[data-ckpt-note]');
  const notes = [
    'Best checkpoint: three of four rollouts finish the stack.',
    'Just over half of rollouts reach a grasp; 40% finish the stack.',
    'Picks the nut in 90% of rollouts and finishes no stacks.',
  ];
  const show = (k) => {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
    rows[k].forEach((v, i) => { bars[i].style.setProperty('--v', v / 100); vals[i].textContent = v + '%'; });
    note.textContent = notes[k];
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => show(i)));
  show(0);
})();
