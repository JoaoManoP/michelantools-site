// Milens — site: menu no celular, revelação única das seções, botão de voltar ao topo do FAQ.
(() => {
  const mb = document.querySelector('.menu');
  const nav = document.getElementById('hnav');
  if (mb && nav) {
    mb.addEventListener('click', () => { const open = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', (e) => { if (nav.classList.contains('open') && !nav.contains(e.target) && !mb.contains(e.target)) { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  }
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('main > section:not(.hero):not(.strip)')];
  if (!still && 'IntersectionObserver' in window) {
    sections.forEach((s) => s.classList.add('reveal'));
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    sections.forEach((s) => io.observe(s));
  }
  // só um item do FAQ aberto por vez
  document.querySelectorAll('.faq .wrap').forEach((box) => box.addEventListener('toggle', (e) => { if (e.target.open) box.querySelectorAll('details[open]').forEach((d) => { if (d !== e.target) d.open = false; }); }, true));
})();
