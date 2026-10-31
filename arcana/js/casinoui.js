// Cassino (fichas virtuais): Roda da Sorte, Vinte e Um da Câmera e loja de visuais.
import { WHEEL, spinLocal, newShoe, bjDeal, bjHit, bjStand, bjDouble, bjValue, COSMETICS } from '../core/casino.js';
import { seedCode } from '../core/rng.js';
import { app, route, go, onLeave, isModal } from './ui.js';
import { mascot, cardHTML, backHTML, esc } from './art.js';
import { sfx, shake, flash, toast, wait } from './fx.js';
import { M, save, addChips, spend, addPower, spinWheel, freeSpinReady, loggedUser } from './meta.js';
import { applyCosmetics } from './cosmetics.js';
import { powerName } from './solo.js';

let tab = 'roda';
let rot = 0;
let spinning = false;
let shoe = null;
let bj = null;
let bet = 25;

route('cassino', (t) => {
  if (t) tab = t;
  const onKey = (e) => { if (isModal()) return; if (e.key === 'Escape') go('menu'); if (e.key === ' ' && tab === 'roda') { e.preventDefault(); doSpin(); } };
  document.addEventListener('keydown', onKey);
  onLeave(() => document.removeEventListener('keydown', onKey));
  render();
});

function head() {
  return `<div class="c-head"><div><span class="lbl">Cassino do estúdio · só fichas virtuais</span><h1 class="h-d">Cassino</h1></div>
    <div class="top-bar"><span class="chip-pill"><i></i><b id="chips">${M.chips.toLocaleString('pt-BR')}</b> fichas</span><span class="chip-pill">Giros: <b>${M.spins}</b>${freeSpinReady() ? ' + 1 grátis hoje' : ''}</span><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div></div>
    <div class="tabs" role="tablist">${[['roda', 'Roda da Sorte'], ['bj', 'Vinte e Um'], ['visuais', 'Visuais']].map(([id, l]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>`;
}
const legal = '<p class="legal">Fichas virtuais, só para diversão. Não existe compra de fichas nem troca por dinheiro, prêmios ou qualquer valor. Jogos de azar com dinheiro são proibidos no Brasil, e aqui nada envolve dinheiro de verdade.</p>';
function render() {
  const body = tab === 'roda' ? wheelHTML() : tab === 'bj' ? bjHTML() : cosHTML();
  app.innerHTML = `<div class="casino">${head()}${body}${legal}</div>`;
  app.querySelector('[data-back]').onclick = () => go('menu');
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; sfx.click(); render(); }));
  if (tab === 'roda') wireWheel();
  else if (tab === 'bj') wireBJ();
  else wireCos();
}
const setChips = () => { const el = app.querySelector('#chips'); if (el) el.textContent = M.chips.toLocaleString('pt-BR'); };

// ---------- roda ----------
function wheelHTML() {
  const can = freeSpinReady() || M.spins > 0;
  return `<div class="wheel-box"><div class="wheel"><canvas width="840" height="840" id="wc"></canvas><div class="pin"></div><div class="hub">${mascot('', 'feliz')}</div></div>
    <div><h2 class="h-d" style="font-size:36px">Roda da Sorte</h2><p>Um giro grátis por dia, mais giros ganhos jogando: +1 por duelo vencido e +1 por tiragem que passa da ante 3.</p>
    <p class="muted">Prêmios: fichas, Arcanos e Lâminas grátis para a próxima tiragem, +$5 ou +1 mão na partida, itens extras para o duelo contra a IA e dobro no Vinte e Um.${loggedUser() ? ' Com a conta conectada, o sorteio e o giro grátis são conferidos no servidor.' : ''}</p>
    ${M.inventory.length ? `<p><b>Guardados para a próxima tiragem:</b> ${M.inventory.map(powerName).join(', ')}.</p>` : ''}
    ${M.duelBonus ? `<p><b>Itens extras para o próximo duelo:</b> ${M.duelBonus}.</p>` : ''}${M.bj2 ? `<p><b>Dobro no Vinte e Um:</b> ${M.bj2}.</p>` : ''}
    <button class="btn red" id="spin" ${can && !spinning ? '' : 'disabled'}>${freeSpinReady() ? 'Girar grátis' : 'Girar (1 giro)'} <kbd>Espaço</kbd></button>
    <p class="duel-msg" id="won" style="margin-top:14px"></p></div></div>`;
}
function drawWheel() {
  const c = app.querySelector('#wc');
  if (!c) return;
  const g = c.getContext('2d');
  const W = c.width;
  const r = W / 2 - 14;
  const seg = (Math.PI * 2) / WHEEL.length;
  g.clearRect(0, 0, W, W);
  g.save();
  g.translate(W / 2, W / 2);
  g.beginPath(); g.arc(0, 0, r + 10, 0, Math.PI * 2); g.fillStyle = '#0B0D12'; g.fill();
  for (let i = 0; i < WHEEL.length; i++) {
    const a0 = -Math.PI / 2 + rot + i * seg;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a0 + seg); g.closePath();
    g.fillStyle = WHEEL[i].color; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#0B0D12'; g.stroke();
    g.save();
    g.rotate(a0 + seg / 2);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    const dark = ['#EFEBE3', '#FFD23F'].includes(WHEEL[i].color);
    g.fillStyle = dark ? '#0B0D12' : '#EFEBE3';
    g.font = '400 30px Anton, Impact, sans-serif';
    g.fillText(WHEEL[i].label.toUpperCase(), r - 22, 0);
    g.restore();
  }
  for (let i = 0; i < WHEEL.length; i++) { const a = -Math.PI / 2 + rot + i * seg; g.beginPath(); g.arc(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 7, 0, Math.PI * 2); g.fillStyle = '#FFD23F'; g.fill(); }
  g.restore();
}
function wireWheel() {
  drawWheel();
  if (document.fonts) document.fonts.ready.then(drawWheel);
  const b = app.querySelector('#spin');
  if (b) b.onclick = doSpin;
}
async function doSpin() {
  if (spinning || tab !== 'roda') return;
  let idx;
  try { idx = await spinWheel(() => spinLocal()); } catch (e) { sfx.error(); return toast(e.message, 'err'); }
  spinning = true;
  const b = app.querySelector('#spin');
  if (b) b.disabled = true;
  const seg = (Math.PI * 2) / WHEEL.length;
  const jitter = (Math.random() - 0.5) * seg * 0.7;
  const base = rot - (rot % (Math.PI * 2));
  const target = base + Math.PI * 2 * 6 - (idx + 0.5) * seg + jitter;
  const from = rot;
  const t0 = performance.now();
  const dur = 4600;
  let lastSeg = Math.floor(from / seg);
  await new Promise((res) => {
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      rot = from + (target - from) * e;
      const sNow = Math.floor(rot / seg);
      if (sNow !== lastSeg) { lastSeg = sNow; sfx.spin(); }
      drawWheel();
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  rot = rot % (Math.PI * 2);
  const w = WHEEL[idx];
  if (w.kind === 'chips') { addChips(w.v); sfx.coin(); }
  else if (w.kind === 'power') { addPower(w.v); sfx.win(); }
  else if (w.kind === 'duel') { M.duelBonus = (M.duelBonus || 0) + 1; save(); sfx.win(); }
  else if (w.kind === 'spin') { M.spins += 1; save(); sfx.win(); }
  else if (w.kind === 'bj2') { M.bj2 = (M.bj2 || 0) + 1; save(); sfx.win(); }
  else sfx.lose();
  if (w.kind !== 'none') { flash('rgba(255,210,63,.4)', 400); shake(0.8); }
  spinning = false;
  render();
  const won = app.querySelector('#won');
  if (won) won.textContent = w.kind === 'none' ? 'Filme velado: nada desta vez.' : 'Você ganhou: ' + w.label;
}

// ---------- Vinte e Um ----------
function bjHTML() {
  const done = !bj || bj.done;
  const dealer = bj ? bj.dealer.map((c, i) => (i === 1 && !bj.done ? backHTML('flip') : cardHTML(c, { cls: 'flip' }))).join('') : '';
  const player = bj ? bj.player.map((c) => cardHTML(c, { cls: 'flip' })).join('') : '';
  const msg = bj && bj.done ? { vinteeum: 'Vinte e um! Paga 3 para 2.', ganhou: 'Você ganhou.', empate: 'Empate: a aposta volta.', perdeu: 'A banca ganhou.', estourou: 'Estourou: passou de 21.' }[bj.result] : '';
  return `<div class="bj">
    <span class="lbl">Banca ${bj ? (bj.done ? bjValue(bj.dealer) : '?') : ''}</span><div class="row">${dealer}</div>
    <div class="duel-msg">${esc(msg)}</div>
    <div class="row">${player}</div><span class="v">${bj ? 'Você: ' + bjValue(bj.player) : 'Faça sua aposta'}</span>
    ${done ? `<div class="bets">${[10, 25, 50, 100].map((v) => `<button data-bet="${v}" class="${bet === v ? 'on' : ''}">${v}</button>`).join('')}</div><button class="btn red" id="deal" ${M.chips < bet ? 'disabled' : ''}>Apostar ${bet} e dar as cartas</button>`
      : `<div class="acts"><button class="btn red" id="hit">Pedir carta</button><button class="btn blue" id="stand">Parar</button><button class="btn" id="dbl" ${bj.player.length === 2 && M.chips >= bj.bet ? '' : 'disabled'}>Dobrar</button></div>`}
    <p class="muted">A banca para no 17. Vinte e um nas duas primeiras cartas paga 3 para 2.${M.bj2 ? ` Seu próximo prêmio vale o dobro (${M.bj2}).` : ''}</p></div>`;
}
function settle() {
  if (!bj.done) return;
  let pay = bj.payout;
  if (pay > bj.bet && M.bj2 > 0) { pay += pay - bj.bet; M.bj2 -= 1; toast('Dobro da Roda aplicado!', 'ok'); }
  if (pay) addChips(pay);
  if (pay > bj.bet) { sfx.coin(); flash('rgba(255,210,63,.3)', 300); } else if (pay === 0) { sfx.lose(); shake(0.6); }
  save();
}
function wireBJ() {
  app.querySelectorAll('[data-bet]').forEach((b) => (b.onclick = () => { bet = Number(b.dataset.bet); sfx.click(); render(); }));
  const d = app.querySelector('#deal');
  if (d) d.onclick = () => {
    if (!spend(bet)) return toast('Fichas insuficientes.', 'err');
    if (!shoe || shoe.length < 15) shoe = newShoe(seedCode(8));
    bj = bjDeal(shoe, bet);
    sfx.deal();
    if (bj.done) settle();
    render();
  };
  const h = app.querySelector('#hit');
  if (h) h.onclick = () => { bjHit(bj); sfx.deal(); if (bj.done) settle(); render(); };
  const s = app.querySelector('#stand');
  if (s) s.onclick = async () => { bjStand(bj); sfx.flip(); settle(); render(); };
  const db = app.querySelector('#dbl');
  if (db) db.onclick = () => { if (!spend(bj.bet)) return toast('Fichas insuficientes.', 'err'); bjDouble(bj); sfx.deal(); settle(); render(); };
}

// ---------- visuais ----------
const FELT_BG = { tinta: '#0B0D12', vermelho: '#5a1418', azul: '#13306b', papel: '#3a3630', verde: '#0f5a33' };
function cosHTML() {
  const owned = M.cosmetics.owned;
  const backs = COSMETICS.back.map((c) => {
    const has = owned.includes(c.id);
    const on = M.cosmetics.back === c.id;
    const lock = c.id === 'dourado' && !has ? 'Vença uma tiragem ou compre' : '';
    return `<div class="cos ${on ? 'on' : ''}"><div class="back-${c.id}" style="--cw:80px">${backHTML()}</div><b>${esc(c.name)}</b>${lock ? `<span class="muted" style="font-size:12px">${lock}</span>` : ''}
      ${has ? `<button class="btn small" data-eq="back:${c.id}" ${on ? 'disabled' : ''}>${on ? 'Em uso' : 'Usar'}</button>` : `<button class="btn small red" data-buy="back:${c.id}:${c.cost}" ${M.chips < c.cost ? 'disabled' : ''}>${c.cost} fichas</button>`}</div>`;
  }).join('');
  const felts = COSMETICS.felt.map((c) => {
    const has = owned.includes(c.id);
    const on = M.cosmetics.felt === c.id;
    return `<div class="cos ${on ? 'on' : ''}"><div class="swatch" style="background:radial-gradient(ellipse at 50% 30%, ${FELT_BG[c.id]}, #050608)"></div><b>${esc(c.name)}</b>
      ${has ? `<button class="btn small" data-eq="felt:${c.id}" ${on ? 'disabled' : ''}>${on ? 'Em uso' : 'Usar'}</button>` : `<button class="btn small red" data-buy="felt:${c.id}:${c.cost}" ${M.chips < c.cost ? 'disabled' : ''}>${c.cost} fichas</button>`}</div>`;
  }).join('');
  return `<h2 class="h-d" style="font-size:30px">Versos de carta</h2><div class="cos-grid">${backs}</div><h2 class="h-d" style="font-size:30px">Mesas</h2><div class="cos-grid">${felts}</div>`;
}
function wireCos() {
  app.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
    const [kind, id, cost] = b.dataset.buy.split(':');
    if (!spend(Number(cost))) return toast('Fichas insuficientes.', 'err');
    M.cosmetics.owned.push(id);
    M.cosmetics[kind] = id;
    save();
    applyCosmetics();
    sfx.coin();
    render();
  }));
  app.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => { const [kind, id] = b.dataset.eq.split(':'); M.cosmetics[kind] = id; save(); applyCosmetics(); sfx.click(); render(); }));
}
void wait; void setChips;
