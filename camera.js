// Sequência de câmera da página inicial: as telas do programa ficam em camadas com profundidade (CSS 3D)
// e uma câmera virtual, com os mesmos parâmetros da camada de câmera do editor, anda entre elas
// conforme a rolagem. Cada plano é um keyframe; entre eles a câmera acelera e freia como no editor.
(() => {
  const root = document.querySelector('[data-cam]');
  if (!root) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = root.querySelector('.cam-stage');
  const view = root.querySelector('.cam-view');
  const world = root.querySelector('.cam-world');
  const caps = [...root.querySelectorAll('.cap')];
  const hud = Object.fromEntries([...root.querySelectorAll('[data-hud]')].map((e) => [e.dataset.hud, e]));
  const SW = 1600; // palco lógico 1600×900, escalado para o monitor
  const SH = 900;
  const PW = 1366; // telas capturadas em 1366×766
  const PH = 766;

  // planos de câmera: alvo (tx, ty, tz), enquadramento s (escala do alvo na tela), lente em graus,
  // órbita (inclinação Y), inclinação X, rolagem, desfoque (profundidade de campo) e tremido
  const SHOTS = [
    { name: 'Abertura', tx: 0, ty: -120, tz: -1300, s: 0.4, fov: 52, orbit: -16, tilt: 10, roll: -3, focus: 0, shake: 0 },
    { name: 'Interface', tx: 0, ty: 0, tz: 0, s: 0.84, fov: 44, orbit: 12, tilt: -6, roll: 0, focus: 0.55, shake: 0 },
    { name: 'Monitor', tx: 44, ty: -133, tz: 0, s: 1.6, fov: 34, orbit: -5, tilt: 3, roll: -1.5, focus: 0.8, shake: 0 },
    { name: 'Timeline', tx: 39, ty: 209, tz: 0, s: 1.12, fov: 46, orbit: 8, tilt: 22, roll: 2, focus: 0.7, shake: 0 },
    { name: 'Composição', tx: 1750, ty: -260, tz: -760, s: 0.92, fov: 26, orbit: 30, tilt: -3, roll: 0, focus: 0.9, shake: 0 },
    { name: 'Cor', tx: -1780, ty: 220, tz: -860, s: 0.92, fov: 40, orbit: -30, tilt: 2, roll: -2, focus: 0.8, shake: 0 },
    { name: 'Áudio', tx: 900, ty: 1160, tz: -1650, s: 0.92, fov: 40, orbit: 12, tilt: -8, roll: 1, focus: 0.8, shake: 0 },
    { name: 'Entrega', tx: -1050, ty: -1180, tz: -1550, s: 0.92, fov: 40, orbit: -14, tilt: 8, roll: 0, focus: 0.8, shake: 0 },
    { name: 'Plugins', tx: 2350, ty: 1050, tz: -2700, s: 0.92, fov: 38, orbit: 24, tilt: 0, roll: 0, focus: 0.85, shake: 1 },
    { name: 'Final', tx: 0, ty: 0, tz: -1500, s: 0.34, fov: 56, orbit: 14, tilt: -8, roll: 2, focus: 0, shake: 0 }
  ];
  const KEYS = ['tx', 'ty', 'tz', 's', 'fov', 'orbit', 'tilt', 'roll', 'focus', 'shake'];
  const N = SHOTS.length;

  // monta os planos e as etiquetas nas suas posições no espaço
  const planes = [...world.querySelectorAll('.plane')].map((el) => {
    const d = (k) => Number(el.dataset[k] || 0);
    const p = { el, x: d('x'), y: d('y'), z: d('z') };
    el.style.width = PW + 'px';
    el.style.height = PH + 'px';
    el.style.transform = `translate3d(${p.x - PW / 2}px, ${p.y - PH / 2}px, ${p.z}px) rotateY(${d('ry')}deg) rotateX(${d('rx')}deg)`;
    return p;
  });
  const pins = [...world.querySelectorAll('.pin')].map((el) => {
    const d = (k) => Number(el.dataset[k] || 0);
    el.style.transform = `translate3d(${d('x')}px, ${d('y')}px, 0)`;
    el.style.setProperty('--h', d('z') + 'px');
    return el;
  });

  // timeline: um clipe por plano, losango de keyframe no ponto de repouso de cada um
  const clips = root.querySelector('[data-tl-clips]');
  SHOTS.forEach((s, i) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'tl-clip';
    c.style.left = (i / N) * 100 + '%';
    c.style.width = 100 / N + '%';
    c.innerHTML = '<span>' + s.name + '</span><i aria-hidden="true"></i>';
    c.setAttribute('aria-label', 'Ir para o plano ' + s.name);
    c.addEventListener('click', () => goShot(i));
    clips.append(c);
  });
  const clipEls = [...clips.children];
  const play = root.querySelector('[data-tl-play]');
  const playTc = play.querySelector('b');

  // rolagem → posição na sequência (0 … N-1)
  const progress = () => {
    const r = root.getBoundingClientRect();
    const total = root.offsetHeight - innerHeight;
    return Math.max(0, Math.min(1, -r.top / Math.max(1, total)));
  };
  const goShot = (i) => {
    const total = root.offsetHeight - innerHeight;
    const top = root.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (i / (N - 1)) * total + 2, behavior: still ? 'auto' : 'smooth' });
  };
  root.querySelector('[data-cam-next]')?.addEventListener('click', (e) => {
    e.preventDefault();
    goShot(1);
  });

  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // cada trecho tem repouso nas pontas: a câmera para no plano e depois parte para o próximo
  const target = (p) => {
    const f = p * (N - 1);
    const i = Math.min(N - 2, Math.floor(f));
    let t = f - i;
    t = still ? (t < 0.5 ? 0 : 1) : easeIO(Math.max(0, Math.min(1, (t - 0.18) / 0.64)));
    const a = SHOTS[i];
    const b = SHOTS[i + 1];
    const o = {};
    for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
    o.pos = f;
    return o;
  };

  let cur = null;
  let last = 0;
  let raf = 0;
  let scale = 1;
  const fit = () => {
    const m = stage.getBoundingClientRect();
    scale = m.width / SW;
    view.style.transform = `scale(${scale})`;
  };

  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',').replace(/^-0,0$/, '0,0');
  const tc = (pos) => {
    const fr = Math.round(pos * 90); // 3 s por plano a 30 qps
    const s = Math.floor(fr / 30);
    return '00:00:' + String(s).padStart(2, '0') + ':' + String(fr % 30).padStart(2, '0');
  };

  const render = (now) => {
    const goal = target(progress());
    if (!cur || still) cur = { ...goal };
    else {
      // amortecedor: a câmera persegue o alvo com inércia (como o "suavizar" do editor)
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      const k = 1 - Math.exp(-dt * 7.5);
      for (const key of KEYS) cur[key] += (goal[key] - cur[key]) * k;
      cur.pos += (goal.pos - cur.pos) * k;
    }
    // velocidade da câmera → desfoque de movimento
    const vel = Math.abs(goal.pos - cur.pos);
    last = now;

    const P = (SW / 2) / Math.tan((cur.fov * Math.PI) / 360);
    const d = P * (1 / cur.s - 1); // distância que mantém o alvo no enquadramento pedido
    const sh = cur.shake && !still ? cur.shake : 0;
    const t = now / 1000;
    const jx = sh * (Math.sin(t * 2.1) * 7 + Math.sin(t * 5.3) * 3);
    const jy = sh * (Math.cos(t * 1.7) * 6 + Math.sin(t * 4.1) * 3);
    const jr = sh * Math.sin(t * 1.3) * 0.6;
    view.style.perspective = P + 'px';
    world.style.transform = `translate3d(${jx}px, ${jy}px, ${-d}px) rotateZ(${cur.roll + jr}deg) rotateX(${cur.tilt}deg) rotateY(${cur.orbit}deg) translate3d(${-cur.tx}px, ${-cur.ty}px, ${-cur.tz}px)`;
    stage.style.filter = still || vel < 0.02 ? 'none' : `blur(${Math.min(3.5, vel * 9).toFixed(2)}px)`;

    // profundidade de campo: o que está longe do alvo desfoca e escurece
    for (const p of planes) {
      const dist = Math.hypot(p.x - cur.tx, p.y - cur.ty, p.z - cur.tz);
      const k = Math.max(0, Math.min(1, (dist - 300) / 1400)) * cur.focus;
      p.el.style.filter = k > 0.02 ? `blur(${(k * 7).toFixed(1)}px) brightness(${(1 - k * 0.45).toFixed(2)})` : 'none';
    }
    const pinsOn = Math.max(0, 1 - Math.abs(cur.pos - 1) * 1.6);
    for (const el of pins) el.style.opacity = pinsOn.toFixed(2);

    // legendas, painel de câmera e timeline
    const active = Math.round(goal.pos);
    caps.forEach((c, i) => {
      const on = Math.abs(goal.pos - i) < 0.32;
      c.classList.toggle('on', on);
      c.setAttribute('aria-hidden', String(!on));
    });
    hud.shot.textContent = SHOTS[active].name;
    hud.tc.textContent = tc(cur.pos);
    hud.zoom.textContent = Math.round(cur.s * 100) + '%';
    hud.tilt.textContent = fmt(cur.tilt) + '°';
    hud.orbit.textContent = fmt(cur.orbit) + '°';
    hud.roll.textContent = fmt(cur.roll) + '°';
    hud.fov.textContent = Math.round(cur.fov) + '°';
    hud.focus.textContent = Math.round(cur.focus * 100) + '%';
    hud.shake.textContent = fmt(cur.shake);
    const x = ((cur.pos + 0.5) / N) * 100;
    play.style.left = x + '%';
    playTc.textContent = tc(cur.pos);
    // o timecode da agulha não sai da trilha nas pontas
    playTc.style.transform = x < 7 ? 'translateX(-2px)' : x > 93 ? 'translateX(calc(-100% + 2px))' : '';
    clipEls.forEach((c, i) => c.classList.toggle('on', i === active));

    const settled = Math.abs(goal.pos - cur.pos) < 0.0005 && !sh;
    raf = !settled && visible ? requestAnimationFrame(render) : 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  let visible = true;
  new IntersectionObserver((l) => {
    visible = l[0].isIntersecting;
    if (visible) kick();
  }).observe(root);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => {
    fit();
    kick();
  });
  new ResizeObserver(() => {
    fit();
    kick();
  }).observe(stage);
  fit();
  kick();
  root.classList.add('ready');
})();
