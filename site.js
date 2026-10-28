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

// ---------- fundo do topo: curvas de movimento com keyframes e uma agulha de reprodução ----------
// Desenha o que o programa faz (caminhos animados, losangos de keyframe, timecode) atrás do título.
(() => {
  const heroes = document.querySelectorAll('.hero, .p-hero');
  if (!heroes.length) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const col = (n) => css.getPropertyValue(n).trim();
  const tracks = ['--video', '--imagem', '--audio', '--tres'].map(col);
  const dot = col('--dot');
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const bez = (p, t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
  };
  const tc = (s) => {
    const sec = Math.floor(s);
    return ['00', String(Math.floor(sec / 60) % 60).padStart(2, '0'), String(sec % 60).padStart(2, '0'), String(Math.floor((s % 1) * 30)).padStart(2, '0')].join(':');
  };
  heroes.forEach((hero) => {
    const cv = document.createElement('canvas');
    cv.className = 'hero-fx';
    cv.setAttribute('aria-hidden', 'true');
    hero.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0;
    let H = 0;
    let paths = [];
    const build = () => {
      const r = hero.getBoundingClientRect();
      const dpr = 1;
      W = r.width;
      H = Math.min(r.height, 640);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // quatro caminhos, um por trilha, concentrados à direita para não disputar com o texto
      paths = tracks.map((c, i) => {
        const y0 = H * (0.18 + i * 0.2);
        const x0 = W * (0.32 + i * 0.03);
        return { c, period: 5.5 + i * 1.3, phase: i * 0.37, p: [[x0, y0], [W * (0.55 + i * 0.02), y0 - H * (0.35 - i * 0.12)], [W * 0.78, y0 + H * (0.3 - i * 0.1)], [W * 1.02, y0 - H * 0.08 + i * H * 0.05]] };
      });
    };
    const frame = (now) => {
      const s = now / 1000;
      ctx.clearRect(0, 0, W, H);
      // régua de quadros no rodapé
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col('--line');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = W * 0.5, k = 0; x < W; x += 12, k++) {
        const h = k % 10 === 0 ? 10 : k % 5 === 0 ? 6 : 3;
        ctx.moveTo(x + 0.5, H - 1);
        ctx.lineTo(x + 0.5, H - 1 - h);
      }
      ctx.stroke();
      for (const p of paths) {
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(...p.p[0]);
        ctx.bezierCurveTo(...p.p[1], ...p.p[2], ...p.p[3]);
        ctx.stroke();
        // alças de tangente, como no editor de curvas
        ctx.globalAlpha = 0.22;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(...p.p[0]);
        ctx.lineTo(...p.p[1]);
        ctx.moveTo(...p.p[3]);
        ctx.lineTo(...p.p[2]);
        ctx.stroke();
        ctx.setLineDash([]);
        // keyframes fixos
        ctx.globalAlpha = 0.75;
        for (const t of [0, 0.36, 0.7]) {
          const [x, y] = bez(p.p, t);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.strokeRect(-4, -4, 8, 8);
          ctx.restore();
        }
        // ponto que percorre o caminho com aceleração suave
        const [x, y] = bez(p.p, ease((s / p.period + p.phase) % 1));
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      // agulha de reprodução com timecode
      const px = W * 0.56 + ((s * 40) % (W * 0.44));
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = dot;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, 0);
      ctx.lineTo(px + 0.5, H);
      ctx.stroke();
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.moveTo(px - 5, H - 14);
      ctx.lineTo(px + 6, H - 14);
      ctx.lineTo(px + 0.5, H - 6);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.font = '500 11px ' + col('--mono');
      ctx.fillText(tc(s), px + 8, H - 18);
      ctx.globalAlpha = 1;
    };
    let raf = 0;
    let visible = true;
    let lastDraw = 0;
    const loop = (now) => {
      if (now - lastDraw > 32) {
        lastDraw = now;
        frame(now);
      }
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (still) return frame(2600);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    build();
    start();
    new ResizeObserver(() => {
      build();
      if (still || !raf) frame(still ? 2600 : performance.now());
    }).observe(hero);
    new IntersectionObserver((l) => {
      visible = l[0].isIntersecting;
      if (visible) start();
    }).observe(hero);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && visible) start();
    });
  });
})();

// ---------- a página como timeline: agulha no alto da janela acompanha a rolagem ----------
(() => {
  // a página inicial já tem a timeline da câmera
  if (document.querySelector('[data-cam]')) return;
  const bar = document.createElement('div');
  bar.className = 'scrub';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<i></i><b></b>';
  document.body.append(bar);
  const fill = bar.querySelector('i');
  const label = bar.querySelector('b');
  let pending = false;
  const upd = () => {
    pending = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const k = max > 0 ? Math.min(1, scrollY / max) : 0;
    fill.style.transform = 'scaleX(' + k + ')';
    const fr = Math.round(k * 30 * 60);
    label.textContent = '00:00:' + String(Math.floor(fr / 30)).padStart(2, '0') + ':' + String(fr % 30).padStart(2, '0');
    label.style.left = 'calc(' + k * 100 + '% - ' + k * 84 + 'px)';
    bar.classList.toggle('on', scrollY > 40);
  };
  addEventListener('scroll', () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(upd);
    }
  }, { passive: true });
  upd();
})();

// ---------- ritmo de edição no site inteiro: cortes, títulos, ícones e cartões ----------
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = (els, cls, opts = {}) => {
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add(cls));
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) {
        e.target.classList.add(cls);
        io.unobserve(e.target);
      }
    }, { threshold: opts.threshold || 0.25 });
    els.forEach((e) => io.observe(e));
  };

  // régua de corte no topo de cada faixa escura
  const bands = [...document.querySelectorAll('section.dark, .feature.dark')];
  for (const b of bands) {
    const cut = document.createElement('div');
    cut.className = 'cut';
    cut.setAttribute('aria-hidden', 'true');
    cut.innerHTML = '<i></i>';
    b.prepend(cut);
  }
  seen(bands.filter((b) => b.tagName === 'SECTION'), 'in', { threshold: 0.15 });

  // claquete na chamada final
  document.querySelectorAll('.cta').forEach((c) => {
    const clap = document.createElement('span');
    clap.className = 'clap';
    clap.setAttribute('aria-hidden', 'true');
    c.prepend(clap);
  });

  // títulos palavra por palavra (só os que são texto puro)
  const heads = [...document.querySelectorAll('main h2')].filter((h) => !h.closest('.cam') && !h.children.length && h.textContent.trim());
  for (const h of heads) {
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    words.forEach((w, i) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      const inner = document.createElement('span');
      inner.textContent = w;
      inner.style.setProperty('--i', i);
      outer.append(inner);
      h.append(outer, i < words.length - 1 ? ' ' : '');
    });
    h.classList.add('kin');
  }
  seen(heads, 'in', { threshold: 0.4 });

  // ícones que se desenham
  const icons = [...document.querySelectorAll('.label .ic, .flow .ic, .ex-tabs .ic, .sup-card .ic, .g-install .ic')];
  for (const svg of icons) {
    for (const el of svg.children) el.setAttribute('pathLength', '1');
    svg.classList.add('ic-draw');
  }
  seen(icons, 'drawn', { threshold: 0.6 });

  // inclinação com o mouse (só com mouse de verdade e com movimento liberado)
  if (still || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  for (const el of document.querySelectorAll('.shot, .plan, .flow li, .sup-card')) {
    if (el.closest('.cam')) continue;
    el.classList.add('tilt');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const k = r.width > 500 ? 3 : 6; // capturas grandes inclinam menos
      el.style.setProperty('--ry', ((x - 0.5) * k).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * k).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      el.classList.add('moving');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('moving');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  }
})();

// ---------- cabeçalho escuro quando uma faixa escura passa por baixo dele ----------
(() => {
  if (!('IntersectionObserver' in window)) return;
  const under = new Set();
  const io = new IntersectionObserver((list) => {
    for (const e of list) e.isIntersecting ? under.add(e.target) : under.delete(e.target);
    document.body.classList.toggle('cam-dark', under.size > 0);
  }, { rootMargin: '-60px 0px -92% 0px' });
  document.querySelectorAll('[data-cam], section.dark, .feature.dark, footer').forEach((el) => io.observe(el));
})();

// ---------- mais movimento, todo por transformação: fita de palavras, holofote, paralaxe e botões com ímã ----------
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // fita de palavras entre a abertura e o resto, e antes da chamada final
  const WORDS = ['Corte', 'Anime', 'Componha', 'Câmera', 'Keyframes', 'Cor', 'Áudio', 'Entrega'];
  const tape = (alt) => {
    const t = document.createElement('div');
    t.className = 'tape' + (alt ? ' alt' : '');
    t.setAttribute('aria-hidden', 'true');
    const words = [...WORDS, ...WORDS].map((w) => '<span>' + w + '</span>').join('');
    t.innerHTML = '<div class="tape-track">' + words + words + '</div>';
    return t;
  };
  const after = document.querySelector('.cam, .p-hero');
  if (after) after.after(tape(false));
  const cta = document.querySelector('.cta-sec');
  if (cta) cta.before(tape(true));

  if (still) return;

  // uma única passada por quadro para tudo que depende de rolagem ou mouse
  const shots = [...document.querySelectorAll('.shot, .walk-media, .ex-media')].map((el) => ({ el, img: el.querySelector('img, video') })).filter((s) => s.img);
  const darks = [...document.querySelectorAll('section.dark')];
  for (const d of darks) {
    const s = document.createElement('i');
    s.className = 'spot-follow';
    s.setAttribute('aria-hidden', 'true');
    d.prepend(s);
  }
  const mags = fine ? [...document.querySelectorAll('.btn.primary')].filter((b) => !b.closest('.cam')) : [];
  let mouse = null;
  let queued = false;
  const frame = () => {
    queued = false;
    // primeiro todas as leituras de posição, depois todas as escritas: misturar as duas obriga o navegador
    // a recalcular o layout da página a cada elemento (era o que travava a rolagem)
    const vh = innerHeight;
    const shotRects = shots.map((s) => s.el.getBoundingClientRect());
    const darkRects = mouse ? darks.map((d) => d.getBoundingClientRect()) : [];
    const magRects = mouse ? mags.map((b) => b.getBoundingClientRect()) : [];
    shots.forEach((s, i) => {
      const r = shotRects[i];
      if (!r.height || r.bottom < 0 || r.top > vh) return;
      const v = (((r.top + r.height / 2 - vh / 2) / vh) * -18).toFixed(1) + 'px'; // -1 … 1 ao atravessar a tela
      if (s.py !== v) s.img.style.setProperty('--py', (s.py = v));
    });
    if (!mouse) return;
    darks.forEach((d, i) => {
      const r = darkRects[i];
      if (mouse.y >= r.top && mouse.y <= r.bottom) d.firstElementChild.style.transform = `translate3d(${mouse.x - r.left}px, ${mouse.y - r.top}px, 0)`;
    });
    mags.forEach((b, i) => {
      const r = magRects[i];
      const dx = mouse.x - (r.left + r.width / 2);
      const dy = mouse.y - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < Math.max(r.width, 120);
      b.style.setProperty('--mx', near ? (dx * 0.18).toFixed(1) + 'px' : '0px');
      b.style.setProperty('--my', near ? (dy * 0.25).toFixed(1) + 'px' : '0px');
    });
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  };
  addEventListener('scroll', queue, { passive: true });
  if (fine) addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY }; queue(); }, { passive: true });
  queue();
})();
