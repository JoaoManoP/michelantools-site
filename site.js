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
  // fundo que acompanha a rolagem (retícula e perfuração andam mais devagar que a página)
  if (!still) { let raf = 0; const sy = () => { raf = 0; document.documentElement.style.setProperty('--sy', String(Math.round(window.scrollY))); }; window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(sy); }, { passive: true }); sy(); }
  const sections = [...document.querySelectorAll('main > section:not(.hero):not(.phero):not(.news-strip)')];
  if (!still && 'IntersectionObserver' in window) {
    sections.forEach((s) => s.classList.add('reveal'));
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });
    sections.forEach((s) => io.observe(s));
  }
  // vídeos e exemplos: sempre tocam sozinhos, mudos e em loop (pedido do dono); fora da tela pausam só para poupar a máquina
  const vids = [...document.querySelectorAll('video[data-autoplay]')];
  if (vids.length && 'IntersectionObserver' in window) {
    const vo = new IntersectionObserver((list) => { for (const x of list) { if (x.isIntersecting) x.target.play().catch(() => {}); else x.target.pause(); } }, { threshold: 0.35 });
    vids.forEach((v) => vo.observe(v));
  }
  document.querySelectorAll('.faq .wrap').forEach((box) => box.addEventListener('toggle', (e) => { if (e.target.open) box.querySelectorAll('details[open]').forEach((d) => { if (d !== e.target) d.open = false; }); }, true));
})();
// (segredo) a câmera guarda um baralho: 5 cliques rápidos numa lente do mascote, ou digitar "arcana", abre o jogo
(() => {
  const base = (() => { const s = document.querySelector('script[src$="site.js"]'); return s ? new URL('.', s.src).href : location.origin + '/'; })();
  const open = () => {
    const f = document.createElement('div');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;opacity:1;transition:opacity .5s;pointer-events:none';
    document.body.append(f);
    try { const a = new (window.AudioContext || window.webkitAudioContext)(); const b = a.createBuffer(1, a.sampleRate * 0.12, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const n = a.createBufferSource(); n.buffer = b; n.connect(a.destination); n.start(); } catch {}
    requestAnimationFrame(() => { f.style.opacity = '0.85'; });
    setTimeout(() => { location.href = base + 'arcana/'; }, 420);
  };
  let hits = [];
  document.addEventListener('click', (e) => {
    const svg = e.target.closest && e.target.closest('svg.hero-mark, .page-mascot svg, svg.scene-mark');
    if (!svg) return;
    const t = e.target;
    const lens = t.tagName === 'circle' && /#(3B82FF|FF3B3B|EFEBE3)/i.test(t.getAttribute('fill') || '');
    if (!lens) return;
    const now = Date.now();
    hits = hits.filter((x) => now - x < 2200);
    hits.push(now);
    if (hits.length >= 5) { hits = []; open(); }
  });
  document.querySelectorAll('svg.hero-mark, .page-mascot').forEach((el) => { el.style.pointerEvents = 'auto'; });
  let typed = '';
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'arcana') open();
  });
})();
