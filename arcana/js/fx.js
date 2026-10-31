// Efeitos: som sintetizado (WebAudio, nada de arquivo), tremor de tela, clarão, números que sobem, texto flutuante.
let ac = null;
let master = null;
export const prefs = { sound: true, speed: 1, crt: true };
export function setPrefs(p) { Object.assign(prefs, p); document.documentElement.classList.toggle('no-crt', !prefs.crt); }
function ctx() {
  if (!prefs.sound) return null;
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    } catch { return null; }
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
function tone(freq, dur = 0.08, type = 'square', vol = 0.3, when = 0, slide = 0) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur = 0.2, vol = 0.5, when = 0, hp = 800) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + when;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(t);
}
export const sfx = {
  click: () => tone(660, 0.04, 'square', 0.12),
  hover: () => tone(1200, 0.02, 'sine', 0.04),
  select: (n = 0) => tone(420 + n * 40, 0.05, 'triangle', 0.18),
  flip: () => { noise(0.05, 0.25, 0, 2500); tone(900, 0.03, 'triangle', 0.08); },
  deal: () => noise(0.04, 0.2, 0, 3000),
  chip: (n = 0) => tone(500 * Math.pow(1.06, Math.min(n, 30)), 0.06, 'square', 0.14),
  mult: (n = 0) => { tone(300 * Math.pow(1.08, Math.min(n, 20)), 0.09, 'sawtooth', 0.16); tone(600 * Math.pow(1.08, Math.min(n, 20)), 0.09, 'square', 0.06); },
  xmult: () => { tone(220, 0.25, 'sawtooth', 0.22, 0, 3); noise(0.15, 0.2, 0, 1500); },
  total: () => { tone(523, 0.1, 'square', 0.2); tone(659, 0.1, 'square', 0.2, 0.08); tone(784, 0.18, 'square', 0.2, 0.16); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.2, i * 0.1)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, i * 0.14)),
  coin: () => { tone(988, 0.06, 'square', 0.15); tone(1319, 0.12, 'square', 0.15, 0.06); },
  error: () => tone(140, 0.15, 'square', 0.2),
  shutter: () => { noise(0.03, 0.5, 0, 3000); noise(0.05, 0.4, 0.06, 2000); },
  flash: () => { noise(0.5, 0.8, 0, 200); tone(80, 0.5, 'sine', 0.6, 0, 0.3); tone(1800, 0.3, 'sine', 0.15, 0, 0.2); },
  blank: () => { tone(1500, 0.02, 'square', 0.2); noise(0.03, 0.25, 0.03, 4000); },
  spin: () => tone(1400, 0.015, 'square', 0.08),
  load: () => { for (let i = 0; i < 4; i++) { noise(0.03, 0.25, i * 0.09, 2500); tone(300, 0.03, 'square', 0.08, i * 0.09); } },
  heal: () => [523, 784].forEach((f, i) => tone(f, 0.12, 'sine', 0.2, i * 0.08)),
  freeze: () => tone(2000, 0.4, 'sine', 0.12, 0, 0.4)
};

export const wait = (ms) => new Promise((r) => setTimeout(r, ms / (prefs.speed || 1)));
export function shake(power = 1, el = document.getElementById('stage')) {
  if (!el) return;
  el.style.setProperty('--sh', String(power));
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}
export function flash(color = '#fff', ms = 380) {
  const f = document.createElement('div');
  f.className = 'flash-fx';
  f.style.background = color;
  f.style.animationDuration = ms + 'ms';
  document.body.append(f);
  setTimeout(() => f.remove(), ms + 50);
}
export function countTo(el, to, ms = 500, fmt = (n) => Math.round(n).toLocaleString('pt-BR')) {
  return new Promise((res) => {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = String(to);
    const t0 = performance.now();
    const dur = ms / (prefs.speed || 1);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
}
export function setNum(el, v, fmt = (n) => Math.round(n).toLocaleString('pt-BR')) {
  el.dataset.v = String(v);
  el.textContent = fmt(v);
}
export function pop(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}
export function floatText(target, text, color = '#FF3B3B') {
  if (!target) return;
  const r = target.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float-t';
  f.textContent = text;
  f.style.left = r.left + r.width / 2 + 'px';
  f.style.top = r.top + 'px';
  f.style.background = color;
  document.body.append(f);
  setTimeout(() => f.remove(), 900 / (prefs.speed || 1));
}
export function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2400);
  setTimeout(() => t.remove(), 2900);
}
