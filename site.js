// Milens — site: menu, íris de lente entre páginas, revelação, cilindro que gira com a rolagem, inclinação das capturas.
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // menu no celular
  const mb = document.querySelector('.menu-btn');
  const doors = document.getElementById('doors');
  if (mb && doors) mb.addEventListener('click', () => { const open = doors.classList.toggle('open'); mb.setAttribute('aria-expanded', String(open)); });

  // ---------- íris: fecha ao sair, abre ao chegar ----------
  const iris = document.createElement('div');
  iris.className = 'iris';
  iris.setAttribute('aria-hidden', 'true');
  document.body.prepend(iris);
  if (!still && sessionStorage.getItem('mt-iris') === '1') {
    sessionStorage.removeItem('mt-iris');
    iris.classList.add('in');
    iris.addEventListener('animationend', () => iris.classList.remove('in'), { once: true });
  }
  document.addEventListener('click', (e) => {
    if (still) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html?$/.test(url.pathname) || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    iris.style.setProperty('--x', e.clientX + 'px');
    iris.style.setProperty('--y', e.clientY + 'px');
    iris.classList.add('out');
    sessionStorage.setItem('mt-iris', '1');
    setTimeout(() => (location.href = url.href), 420);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) iris.classList.remove('out'); });

  // ---------- revelação ----------
  const seen = (els, cls, threshold = 0.2) => {
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add(cls));
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add(cls); io.unobserve(x.target); } }, { threshold });
    els.forEach((el) => io.observe(el));
  };
  seen([...document.querySelectorAll('.reveal')], 'in');

  // ---------- cilindro lateral: gira para a câmara da seção visível ----------
  const rail = document.querySelector('.cyl-rail');
  if (rail) {
    const rot = rail.querySelector('.rot');
    const chs = [...rail.querySelectorAll('.ch')];
    const label = rail.querySelector('b');
    const chambers = [...document.querySelectorAll('.chamber')];
    const ANG = { r: 0, g: -120, b: -240 };
    const io = new IntersectionObserver((list) => {
      for (const x of list) if (x.isIntersecting) {
        const c = x.target.dataset.ch;
        rot.style.transform = 'rotate(' + ANG[c] + 'deg)';
        chs.forEach((el) => el.classList.toggle('on', el.dataset.ch === c));
        label.textContent = x.target.dataset.name || c;
      }
    }, { rootMargin: '-40% 0px -40% 0px' });
    chambers.forEach((el) => io.observe(el));
  }

  // lente do herói: o cilindro gira devagar e acompanha a rolagem
  const lens = document.querySelector('.lens .cyl');
  if (lens && !still) {
    let last = -1;
    addEventListener('scroll', () => {
      const k = Math.min(1, scrollY / 800);
      const deg = Math.round(k * 120);
      if (deg !== last) { last = deg; lens.style.transform = 'rotate(' + deg + 'deg)'; }
    }, { passive: true });
  }

  // ---------- inclinação das capturas e dos planos (só com mouse) ----------
  if (still || !fine) return;
  for (const el of document.querySelectorAll('.shot, .plan')) {
    if (el.closest('.cam')) continue;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const k = r.width > 500 ? 3 : 6;
      el.style.setProperty('--ry', ((x - 0.5) * k).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * k).toFixed(2) + 'deg');
      el.classList.add('moving');
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('moving'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }
})();
