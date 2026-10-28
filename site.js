// Milens — site: menu no celular, menu de programas, revelação única das seções, FAQ com um item aberto.
(() => {
  const mb = document.querySelector('.menu');
  const nav = document.getElementById('hnav');
  if (mb && nav) {
    mb.addEventListener('click', () => { const open = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', String(open)); });
  }
  const pm = document.querySelector('.pm');
  const pmb = document.querySelector('.pm-btn');
  if (pm && pmb) {
    const set = (open) => { pm.classList.toggle('open', open); pmb.setAttribute('aria-expanded', String(open)); };
    pmb.addEventListener('click', (e) => { e.stopPropagation(); set(!pm.classList.contains('open')); });
    pm.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); pmb.focus(); } });
    document.addEventListener('click', (e) => { if (!pm.contains(e.target)) set(false); if (nav && nav.classList.contains('open') && !nav.contains(e.target) && mb && !mb.contains(e.target)) { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  }
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('main > section:not(.hero):not(.phero):not(.news-strip)')];
  if (!still && 'IntersectionObserver' in window) {
    sections.forEach((s) => s.classList.add('reveal'));
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });
    sections.forEach((s) => io.observe(s));
  }
  document.querySelectorAll('.faq .wrap').forEach((box) => box.addEventListener('toggle', (e) => { if (e.target.open) box.querySelectorAll('details[open]').forEach((d) => { if (d !== e.target) d.open = false; }); }, true));
})();
