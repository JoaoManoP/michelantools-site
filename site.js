// Menu no celular, entrada das seções e a timeline da página inicial, que acompanha o vídeo.
(() => {
  const top = document.querySelector('.top');
  const btn = document.querySelector('.menu-btn');
  if (btn && top) btn.addEventListener('click', () => {
    const open = top.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((list) => {
    for (const e of list) if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' }) : null;
  document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

  // vídeos de demonstração só tocam quando estão na tela (economiza bateria e dados)
  const vio = 'IntersectionObserver' in window ? new IntersectionObserver((list) => {
    for (const e of list) {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }
  }, { threshold: 0.25 }) : null;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('video[data-auto]').forEach((v) => {
    if (still) {
      v.removeAttribute('autoplay');
      v.controls = true;
      return;
    }
    if (vio) vio.observe(v);
  });

  // timeline do início: clipes posicionados pelo tempo do vídeo e agulha sincronizada
  const tl = document.querySelector('.tl');
  const video = document.querySelector('#reel');
  if (!tl || !video) return;
  const dur = Number(tl.dataset.dur);
  const lanes = tl.querySelector('.tl-tracks');
  const head = tl.querySelector('.playhead');
  const tc = document.querySelectorAll('[data-tc]');
  const clips = [...tl.querySelectorAll('.clip')];
  for (const c of clips) {
    c.style.left = (Number(c.dataset.in) / dur) * 100 + '%';
    c.style.width = ((Number(c.dataset.out) - Number(c.dataset.in)) / dur) * 100 + '%';
  }
  const ruler = tl.querySelector('.tl-ruler');
  const step = innerWidth < 640 ? 10 : 5;
  for (let s = 0; s <= dur; s += step) {
    const m = document.createElement('span');
    m.style.left = (s / dur) * 100 + '%';
    m.textContent = '00:' + String(s).padStart(2, '0');
    ruler.append(m);
  }
  const fmt = (t) => {
    const f = Math.floor((t % 1) * 30);
    const s = Math.floor(t);
    return '00:00:' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0');
  };
  const tick = () => {
    const t = video.currentTime || 0;
    const lane = lanes.querySelector('.lane');
    const x0 = lane.offsetLeft;
    head.style.left = x0 + (t / dur) * lane.clientWidth + 'px';
    for (const c of clips) c.classList.toggle('live', t >= Number(c.dataset.in) && t < Number(c.dataset.out));
    tc.forEach((el) => (el.textContent = fmt(t)));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // clicar na régua leva o vídeo àquele ponto
  ruler.addEventListener('click', (e) => {
    const r = ruler.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
  });
})();

// ---------- tour guiado: o holofote percorre as regiões da interface ----------
(() => {
  const tour = document.querySelector('[data-tour]');
  if (!tour) return;
  const spot = tour.querySelector('.spot');
  const items = [...tour.querySelectorAll('.tour-list li')];
  const bar = tour.querySelector('.tour-progress i');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = 5200;
  let i = 0;
  let timer = 0;
  let paused = false;
  const go = (n) => {
    i = (n + items.length) % items.length;
    items.forEach((li, k) => li.classList.toggle('on', k === i));
    const d = items[i].dataset;
    Object.assign(spot.style, { left: d.x + '%', top: d.y + '%', width: d.w + '%', height: d.h + '%' });
    if (bar && !still) {
      bar.style.transition = 'none';
      bar.style.width = '0';
      void bar.offsetWidth;
      bar.style.transition = 'width ' + DUR + 'ms linear';
      bar.style.width = paused ? '0' : '100%';
    }
    clearTimeout(timer);
    if (!still && !paused) timer = setTimeout(() => go(i + 1), DUR);
  };
  items.forEach((li, k) => li.querySelector('button').addEventListener('click', () => { paused = true; go(k); }));
  tour.addEventListener('pointerenter', () => { paused = true; clearTimeout(timer); if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; } });
  tour.addEventListener('pointerleave', () => { paused = false; go(i); });
  go(0);
})();

// ---------- explorador de recursos: abas que avançam sozinhas até a primeira interação ----------
(() => {
  const ex = document.querySelector('[data-explorer]');
  if (!ex) return;
  const tabs = [...ex.querySelectorAll('.ex-tabs button')];
  const panels = [...ex.querySelectorAll('.ex-panel')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  let auto = !still;
  let timer = 0;
  const show = (n) => {
    i = (n + tabs.length) % tabs.length;
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
    panels.forEach((p, k) => {
      p.classList.toggle('on', k === i);
      const v = p.querySelector('video');
      if (v) { if (k === i && !still) v.play().catch(() => {}); else v.pause(); }
    });
    clearTimeout(timer);
    if (auto) timer = setTimeout(() => show(i + 1), 7000);
  };
  tabs.forEach((t, k) => t.addEventListener('click', () => { auto = false; show(k); }));
  const io = new IntersectionObserver((list) => { for (const e of list) if (e.isIntersecting) { show(i); io.disconnect(); } }, { threshold: 0.3 });
  io.observe(ex);
})();
