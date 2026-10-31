// Tela da partida solo: escolha do plano, mão, pontuação animada, loja, pacotes e fim de partida.
import * as R from '../core/run.js';
import { sortHand, SUITS } from '../core/cards.js';
import { HANDS } from '../core/hands.js';
import { ARCANO, BOSS, constDesc, CONSTELACOES, arcanoDesc } from '../core/arcanos.js';
import { seedCode } from '../core/rng.js';
import { app, route, go, onLeave, modal, closeModal, confirmBox, isModal } from './ui.js';
import { cardHTML, arcanoHTML, laminaHTML, constHTML, esc, mascot } from './art.js';
import { sfx, shake, flash, countTo, setNum, pop, floatText, wait, toast } from './fx.js';
import { M, save, takePowers, recordRun, discover } from './meta.js';

let run = null;
let sel = [];
let sortBy = 'rank';
let busy = false;
const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const fmtM = (n) => (Math.round(n * 100) / 100).toLocaleString('pt-BR');
export const powerName = (p) => ({ arcano: 'Arcano grátis', lamina: 'Lâmina grátis', dinheiro: '+$5', mao: '+1 mão', descarte: '+1 descarte' }[p] || p);

function persist() { if (run) { M.saved = R.serialize(run); save(); } }

route('solo', () => {
  document.addEventListener('keydown', onKey);
  onLeave(() => document.removeEventListener('keydown', onKey));
  app.innerHTML = '<div class="title"></div>';
  if (M.saved) {
    const s = modal(`<h2>Partida em andamento</h2><p class="muted">Você tem uma partida salva. Quer continuar de onde parou?</p><div class="acts" style="justify-content:flex-start;margin-top:12px"><button class="btn red" data-go>Continuar <kbd>Enter</kbd></button><button class="btn ghost" data-n>Começar outra</button><button class="btn ghost" data-m>Menu</button></div>`, { closable: false });
    s.querySelector('[data-go]').onclick = () => { try { run = R.deserialize(M.saved); closeModal(); resume(); } catch { M.saved = null; save(); closeModal(); newGame(); } };
    s.querySelector('[data-n]').onclick = () => { M.saved = null; save(); closeModal(); newGame(); };
    s.querySelector('[data-m]').onclick = () => go('menu');
    return;
  }
  newGame();
});

function newGame() {
  run = null;
  app.innerHTML = '<div class="title"></div>';
  const inv = M.inventory.slice();
  const s = modal(`<h2>Nova tiragem</h2>
    <p class="muted">Vença 8 antes. Cada ante tem três planos: o Aberto, o Fechado e o Chefe, que muda as regras. Monte mãos de pôquer com até 5 cartas: Fichas × Mult precisam passar da meta antes de acabarem as mãos.</p>
    <label class="lbl" for="seed">Semente (vazio = sortear)</label>
    <div style="margin:6px 0 12px"><input id="seed" class="mono" maxlength="12" style="padding:10px;border:3px solid var(--ink);background:var(--paper);color:var(--ink);font-weight:700;letter-spacing:.12em;text-transform:uppercase" placeholder="${seedCode()}"></div>
    ${inv.length ? `<p><b>Power-ups da Roda que entram nesta partida:</b> ${inv.map(powerName).join(', ')}.</p>` : ''}
    <div class="acts" style="justify-content:flex-start"><button class="btn red" data-go>Embaralhar <kbd>Enter</kbd></button><button class="btn ghost" data-m>Menu</button></div>`, { closable: false });
  const inp = s.querySelector('#seed');
  const start = () => {
    const seed = (inp.value.trim() || inp.placeholder).toUpperCase();
    run = R.newRun(seed, { powerups: takePowers() });
    discover(run.arcanos.map((a) => a.id));
    closeModal();
    sfx.shutter();
    flash('#fff', 260);
    persist();
    resume();
  };
  s.querySelector('[data-go]').onclick = start;
  inp.onkeydown = (e) => { if (e.key === 'Enter') { e.stopPropagation(); start(); } };
  s.querySelector('[data-m]').onclick = () => go('menu');
}

function resume() {
  sel = [];
  if (run.phase === 'blind') return blindSelect();
  if (run.phase === 'round') return render(true);
  if (run.phase === 'shop') return shop();
  if (run.phase === 'cashout') { render(); return cash(); }
  return over();
}

// ---------- escolha do plano ----------
function blindName(i = run.blind) { return i === 2 ? BOSS[run.bosses[run.ante - 1]].name : R.BLINDS[i].name; }
function blindSelect() {
  render();
  const cards = R.BLINDS.map((b, i) => {
    const boss = i === 2 ? BOSS[run.bosses[run.ante - 1]] : null;
    return `<div class="blind-c ${i === run.blind ? 'cur' : i < run.blind ? 'done' : ''}">
      <span class="lbl">${i === 2 ? 'Chefe' : 'Plano ' + (i + 1)}</span><b>${esc(boss ? boss.name : b.name)}</b>
      <span class="lbl">Meta</span><span class="t">${fmt(R.blindTarget(run, run.ante, i))}</span>
      <span class="lbl">Prêmio $${b.reward}</span>${boss ? `<span class="boss-t">${esc(boss.desc)}</span>` : ''}</div>`;
  }).join('');
  const s = modal(`<span class="lbl">Ante ${run.ante} de ${R.MAX_ANTE} · semente ${esc(run.seed)}</span><h2>Escolha o plano</h2><div class="blinds">${cards}</div>
    <div class="acts" style="justify-content:flex-start"><button class="btn red" data-go>Jogar ${esc(blindName())} <kbd>Enter</kbd></button><button class="btn ghost" data-m>Salvar e sair</button></div>`, { closable: false });
  s.querySelector('[data-go]').onclick = () => { sfx.shutter(); closeModal(); R.startRound(run); persist(); render(true); };
  s.querySelector('[data-m]').onclick = () => { persist(); go('menu'); };
}

// ---------- tela da rodada ----------
function sideHTML() {
  const r = run.round;
  const boss = run.blind === 2 ? BOSS[run.bosses[run.ante - 1]] : null;
  const pv = r && sel.length ? R.preview(run, sel) : null;
  const target = r ? r.target : R.blindTarget(run);
  const score = r ? r.score : 0;
  return `
    <div class="panel blind-p" style="--bc:${boss ? 'var(--red)' : run.blind === 1 ? 'var(--blue)' : 'var(--paper)'}">
      <span class="lbl">Ante ${run.ante}/${R.MAX_ANTE} · ${esc(R.BLINDS[run.blind].name)}</span>
      <div class="h-d">${esc(blindName())}</div>
      ${boss ? `<div class="boss-t">${esc(boss.desc)}</div>` : ''}
      <span class="lbl">Meta</span><div class="goal">${fmt(target)}</div>
    </div>
    <div class="panel"><span class="lbl">Pontos da rodada</span><div class="round-score" id="rscore" data-v="${score}">${fmt(score)}</div><div class="bar"><i id="rbar" style="width:${Math.min(100, (score / target) * 100)}%"></i></div></div>
    <div class="panel hand-type"><div class="ht-name" id="htn">${pv ? esc(HANDS[pv.type].name) : '&nbsp;'}</div><div class="ht-lvl" id="htl">${pv ? 'nível ' + pv.level : 'selecione cartas'}</div>
      <div class="cm"><div class="box chips" id="chips" data-v="${pv ? pv.chips : 0}">${pv ? pv.chips : 0}</div><span class="x">×</span><div class="box mult" id="mult" data-v="${pv ? pv.mult : 0}">${pv ? pv.mult : 0}</div></div></div>
    <div class="stats">
      <div class="stat h"><span class="lbl">Mãos</span><b>${r ? r.hands : '-'}</b></div>
      <div class="stat d"><span class="lbl">Descartes</span><b>${r ? r.discards : '-'}</b></div>
      <div class="stat m"><span class="lbl">Dinheiro</span><b>$${run.money}</b></div>
      <div class="stat"><span class="lbl">Ante</span><b>${run.ante}</b></div>
    </div>
    <div class="acts" style="justify-content:flex-start"><button class="btn small ghost" data-info>Mãos</button><button class="btn small ghost" data-quit>Sair <kbd>Esc</kbd></button></div>`;
}
function render(dealAnim = false) {
  if (!app.querySelector('.solo')) app.innerHTML = `<div class="solo"><aside class="side"></aside><section class="main"></section></div>`;
  const r = run.round;
  const side = app.querySelector('.side');
  side.innerHTML = sideHTML();
  side.querySelector('[data-quit]').onclick = quit;
  side.querySelector('[data-info]').onclick = handsInfo;
  const main = app.querySelector('.main');
  const hand = r ? sortHand(r.hand.map((id) => R.cardById(run, id)).filter(Boolean), sortBy) : [];
  main.innerHTML = `
    <div class="tops">
      <div class="arc-row" id="arcs"><span class="slot-l">ARCANOS ${run.arcanos.length}/${run.maxArcanos}</span>${run.arcanos.map((a) => arcanoHTML(a, run)).join('')}</div>
      <div class="lam-row" id="lams"><span class="slot-l">LÂMINAS ${run.laminas.length}/${run.maxLaminas}</span>${run.laminas.map((l, i) => laminaHTML(l, R.laminaName(l), R.laminaText(l), { i })).join('')}</div>
    </div>
    <div class="table" id="table"></div>
    <div class="hand" id="hand">${hand.map((c) => cardHTML(c, { sel: sel.includes(c.id), cls: dealAnim ? 'deal' : '' })).join('')}</div>
    <div class="acts">
      <button class="btn red" id="play" ${r && sel.length ? '' : 'disabled'}>Jogar mão <kbd>Enter</kbd></button>
      <button class="btn blue" id="disc" ${r && sel.length && r.discards > 0 ? '' : 'disabled'}>Descartar <kbd>D</kbd></button>
      <button class="btn small ghost" id="sort">Ordenar por ${sortBy === 'rank' ? 'naipe' : 'valor'} <kbd>S</kbd></button>
      <span class="deck-n">Baralho ${r ? r.draw.length : run.deck.length}/${run.deck.length}</span>
    </div>`;
  if (dealAnim) main.querySelectorAll('#hand .pc').forEach((el, i) => { el.style.animationDelay = i * 45 + 'ms'; setTimeout(sfx.deal, i * 45); });
  main.querySelectorAll('#hand .pc').forEach((el) => (el.onclick = () => toggle(el.dataset.id)));
  main.querySelector('#play').onclick = play;
  main.querySelector('#disc').onclick = doDiscard;
  main.querySelector('#sort').onclick = () => { sortBy = sortBy === 'rank' ? 'suit' : 'rank'; sfx.click(); render(); };
  main.querySelectorAll('#arcs .tc').forEach((el) => (el.onclick = () => arcanoMenu(el.dataset.uid)));
  main.querySelectorAll('#lams .lam').forEach((el) => (el.onclick = () => laminaMenu(Number(el.dataset.i))));
}
function toggle(id) {
  if (busy || !run || !run.round) return;
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1);
  else if (sel.length < 5) sel.push(id);
  else return sfx.error();
  sfx.select(sel.length);
  const el = app.querySelector(`#hand .pc[data-id="${CSS.escape(id)}"]`);
  if (el) el.classList.toggle('sel', sel.includes(id));
  refreshPreview();
}
function refreshPreview() {
  const n = app.querySelector('#htn');
  if (!n) return;
  const pv = sel.length ? R.preview(run, sel) : null;
  n.innerHTML = pv ? esc(HANDS[pv.type].name) : '&nbsp;';
  app.querySelector('#htl').textContent = pv ? 'nível ' + pv.level : 'selecione cartas';
  setNum(app.querySelector('#chips'), pv ? pv.chips : 0);
  setNum(app.querySelector('#mult'), pv ? pv.mult : 0, fmtM);
  app.querySelector('#play').disabled = !sel.length;
  app.querySelector('#disc').disabled = !(sel.length && run.round.discards > 0);
}

async function play() {
  if (busy || !sel.length || !run.round) return;
  const err = R.canPlay(run, sel);
  if (err) { sfx.error(); return toast(err, 'err'); }
  busy = true;
  const ids = sel.slice();
  sel = [];
  const table = app.querySelector('#table');
  const playedCards = ids.map((id) => R.cardById(run, id));
  ids.forEach((id) => { const el = app.querySelector(`#hand .pc[data-id="${CSS.escape(id)}"]`); if (el) el.remove(); });
  const boss = R.currentBoss(run);
  table.innerHTML = playedCards.map((c) => cardHTML(c, { cls: 'flip', debuff: !!(boss && boss.debuff && boss.debuff(c)) })).join('');
  sfx.flip();
  const target = run.round.target;
  const res = R.playHand(run, ids);
  const chipsEl = app.querySelector('#chips');
  const multEl = app.querySelector('#mult');
  app.querySelector('#htn').textContent = HANDS[res.type].name;
  app.querySelector('#htl').textContent = 'nível ' + res.level;
  await wait(260);
  let n = 0;
  for (const st of res.steps) {
    if (st.k === 'base') { setNum(chipsEl, st.chips); setNum(multEl, st.mult, fmtM); pop(chipsEl); pop(multEl); sfx.select(3); await wait(260); continue; }
    const cardEl = st.card ? table.querySelector(`.pc[data-id="${CSS.escape(st.card)}"]`) : null;
    const arcEl = st.arc ? app.querySelector(`#arcs .tc[data-uid="${CSS.escape(st.arc)}"]`) : null;
    if (st.k === 'debuff') { if (cardEl) floatText(cardEl, 'Anulada', '#555a66'); sfx.error(); await wait(220); continue; }
    if (cardEl && st.k === 'card') { cardEl.classList.remove('scoring'); void cardEl.offsetWidth; cardEl.classList.add('scoring'); }
    if (arcEl) { arcEl.classList.remove('fire'); void arcEl.offsetWidth; arcEl.classList.add('fire'); }
    const anchor = arcEl || cardEl || multEl;
    if (st.chips) { setNum(chipsEl, st.chipsNow); pop(chipsEl); floatText(anchor, '+' + st.chips, '#3B82FF'); sfx.chip(n++); }
    if (st.mult) { setNum(multEl, st.multNow, fmtM); pop(multEl); floatText(anchor, '+' + st.mult + ' Mult', '#FF3B3B'); sfx.mult(n++); }
    if (st.xmult) { setNum(multEl, st.multNow, fmtM); pop(multEl); floatText(anchor, '×' + fmtM(st.xmult) + ' Mult', '#FF3B3B'); sfx.xmult(); shake(0.6); }
    if (st.text && !st.chips && !st.mult && !st.xmult) { floatText(anchor, st.text, '#0B0D12'); setNum(multEl, st.multNow, fmtM); }
    await wait(st.k === 'card' ? 190 : 240);
  }
  const result = document.createElement('div');
  result.className = 'result';
  result.dataset.v = '0';
  table.append(result);
  sfx.total();
  await countTo(result, res.total, 520);
  shake(Math.min(2.2, 0.4 + Math.log10(Math.max(10, res.total)) / 3));
  if (res.total >= target * 0.5) flash('rgba(255,210,63,.35)', 300);
  const rs = app.querySelector('#rscore');
  const newScore = Number(rs.dataset.v || 0) + res.total;
  app.querySelector('#rbar').style.width = Math.min(100, (newScore / target) * 100) + '%';
  await countTo(rs, newScore, 420);
  if (res.broken.length) { toast(`${res.broken.length} carta(s) de Vidro quebrou(aram).`); sfx.xmult(); }
  await wait(260);
  table.querySelectorAll('.pc').forEach((el) => el.classList.add('gone'));
  await wait(300);
  busy = false;
  persist();
  if (res.status === 'win') { sfx.win(); flash('#fff', 200); return cash(); }
  if (res.status === 'lose') { sfx.lose(); return over(); }
  render(true);
}
async function doDiscard() {
  if (busy || !sel.length || !run.round) return;
  if (run.round.discards <= 0) { sfx.error(); return toast('Sem descartes nesta rodada.', 'err'); }
  busy = true;
  sel.forEach((id) => { const el = app.querySelector(`#hand .pc[data-id="${CSS.escape(id)}"]`); if (el) el.classList.add('gone'); });
  sfx.deal();
  await wait(260);
  try { R.discard(run, sel); sel = []; persist(); } catch (e) { sfx.error(); toast(e.message, 'err'); }
  busy = false;
  render(true);
}

// ---------- Arcanos e Lâminas ----------
const back = () => (run.phase === 'shop' ? shop() : render());
function arcanoMenu(uid) {
  const a = run.arcanos.find((x) => x.uid === uid);
  if (!a) return;
  const d = ARCANO[a.id];
  const s = modal(`<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap"><div style="--cw:130px">${arcanoHTML(a, run)}</div><div style="flex:1;min-width:200px"><span class="lbl">Arcano ${d.num}</span><h2>${esc(d.name)}</h2><p>${esc(arcanoDesc(a, run))}</p><p class="muted">Os Arcanos agem da esquerda para a direita: a ordem muda o resultado.</p>
    <div class="acts" style="justify-content:flex-start"><button class="btn small" data-l>← Mover</button><button class="btn small" data-r>Mover →</button><button class="btn small red" data-s>Vender por $${Math.max(1, Math.floor(d.cost / 2))}</button><button class="btn small ghost" data-x>Fechar</button></div></div></div>`, { onClose: back });
  s.querySelector('[data-l]').onclick = () => { R.moveArcano(run, uid, -1); persist(); closeModal(); back(); };
  s.querySelector('[data-r]').onclick = () => { R.moveArcano(run, uid, 1); persist(); closeModal(); back(); };
  s.querySelector('[data-s]').onclick = () => { const v = R.sellArcano(run, uid); sfx.coin(); toast(`Vendido por $${v}.`, 'ok'); persist(); closeModal(); back(); };
  s.querySelector('[data-x]').onclick = () => { closeModal(); back(); };
}
function laminaMenu(i) {
  const l = run.laminas[i];
  if (!l) return;
  const needs = !['fortuna', 'camara'].includes(l.id);
  const inRound = run.phase === 'round' && !!run.round;
  const s = modal(`<span class="lbl">Lâmina</span><h2>${esc(R.laminaName(l))}</h2><p>${esc(R.laminaText(l))}</p>
    ${needs ? `<p class="muted">${inRound ? `Cartas selecionadas agora: <b>${sel.length}</b>. Feche, selecione na mão e use.` : 'Use durante uma rodada, com cartas da mão selecionadas.'}</p>` : ''}
    <div class="acts" style="justify-content:flex-start"><button class="btn red" data-u ${needs && !inRound ? 'disabled' : ''}>Usar</button><button class="btn small" data-v>Vender por $1</button><button class="btn ghost" data-x>Fechar</button></div>`, { onClose: back });
  s.querySelector('[data-u]').onclick = () => {
    try {
      R.useLamina(run, i, needs ? sel.slice() : []);
      discover(run.arcanos.map((a) => a.id));
      sfx.shutter();
      flash('rgba(59,130,246,.35)', 260);
      toast('Lâmina usada.', 'ok');
      if (l.id === 'corte') sel = [];
      persist();
      closeModal();
      back();
    } catch (e) { sfx.error(); toast(e.message, 'err'); }
  };
  s.querySelector('[data-v]').onclick = () => { run.laminas.splice(i, 1); run.money += 1; sfx.coin(); persist(); closeModal(); back(); };
  s.querySelector('[data-x]').onclick = () => { closeModal(); back(); };
}

// ---------- prêmio, loja e pacotes ----------
function cash() {
  const r = run.round;
  if (!r) return run.phase === 'shop' ? shop() : over();
  const pre = { score: r.score, target: r.target };
  const res = R.cashOut(run);
  persist();
  if (res.won) return over();
  const s = modal(`<span class="lbl">Rodada vencida · ${fmt(pre.score)} de ${fmt(pre.target)}</span><h2>Revelado!</h2>
    <div class="cash-lines">${res.lines.map((l) => `<div><span>${esc(l.label)}</span><b>+$${l.v}</b></div>`).join('')}<div><span>Total</span><b>+$${res.total}</b></div></div>
    <button class="btn red" data-go>Ir à loja <kbd>Enter</kbd></button>`, { closable: false });
  sfx.coin();
  s.querySelector('[data-go]').onclick = () => { closeModal(); shop(); };
}
function itemCard(it, where, i) {
  const btn = `<button class="btn small" data-buy="${where}:${i}" ${run.money < it.cost ? 'disabled' : ''}>${it.kind === 'pack' ? 'Abrir' : 'Comprar'}</button>`;
  if (it.kind === 'arcano') return `<div class="shop-item ${it.sold ? 'sold' : ''}">${arcanoHTML({ id: it.id, uid: '' }, run, { price: it.cost })}<div class="desc">${esc(ARCANO[it.id].desc)}</div>${btn}</div>`;
  if (it.kind === 'lamina') return `<div class="shop-item ${it.sold ? 'sold' : ''}">${laminaHTML(it, R.laminaName(it), R.laminaText(it), { price: it.cost })}<div class="desc">${esc(R.laminaText(it))}</div>${btn}</div>`;
  if (it.kind === 'const') return `<div class="shop-item ${it.sold ? 'sold' : ''}">${constHTML(it.hand, { price: it.cost })}<div class="desc">${esc(constDesc(it.hand))}</div>${btn}</div>`;
  const P = R.PACKS[it.pack];
  return `<div class="shop-item ${it.sold ? 'sold' : ''}"><div class="pack ${it.pack}">${esc(P.name)}<span class="price">$${it.cost}</span></div><div class="desc">${esc(P.desc)}</div>${btn}</div>`;
}
function shop() {
  if (!run.shop) R.openShop(run);
  render();
  const sh = run.shop;
  const s = modal(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><span class="lbl">Ante ${run.ante} · próximo: ${esc(blindName())}</span><h2>Loja do estúdio</h2></div><div class="chip-pill" style="font-size:18px">$${run.money}</div></div>
    <div class="shop-row">${sh.items.map((it, i) => itemCard(it, 'items', i)).join('')}</div>
    <div class="shop-row">${sh.packs.map((it, i) => itemCard(it, 'packs', i)).join('')}</div>
    <div class="acts" style="justify-content:flex-start"><button class="btn blue" data-rr ${run.money < sh.reroll ? 'disabled' : ''}>Trocar itens ($${sh.reroll})</button><button class="btn red" data-next>Próximo plano <kbd>Enter</kbd></button></div>
    ${run.arcanos.length ? `<span class="lbl">Seus Arcanos (toque para vender ou mudar a ordem)</span><div class="shop-row" id="own">${run.arcanos.map((a) => arcanoHTML(a, run)).join('')}</div>` : ''}`, { closable: false });
  s.querySelectorAll('#own .tc').forEach((el) => (el.onclick = () => arcanoMenu(el.dataset.uid)));
  s.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
    const [where, i] = b.dataset.buy.split(':');
    try {
      const r = R.buy(run, where, Number(i));
      sfx.coin();
      discover(run.arcanos.map((a) => a.id));
      persist();
      if (run.pack) return openPack();
      if (r && r.kind === 'const') toast(`${CONSTELACOES[r.hand]}: ${HANDS[r.hand].name} subiu de nível.`, 'ok');
      shop();
    } catch (e) { sfx.error(); toast(e.message, 'err'); }
  }));
  s.querySelector('[data-rr]').onclick = () => { try { R.reroll(run); sfx.shutter(); persist(); shop(); } catch (e) { toast(e.message, 'err'); } };
  s.querySelector('[data-next]').onclick = () => { R.leaveShop(run); persist(); closeModal(); blindSelect(); };
}
function openPack() {
  const p = run.pack;
  const html = p.choices.map((c, i) => {
    const art = c.kind === 'arcano' ? arcanoHTML({ id: c.id, uid: '' }, run) : c.kind === 'lamina' ? laminaHTML(c, R.laminaName(c), R.laminaText(c)) : constHTML(c.hand);
    const desc = c.kind === 'arcano' ? ARCANO[c.id].desc : c.kind === 'lamina' ? R.laminaText(c) : constDesc(c.hand);
    return `<div class="shop-item" style="animation:deal .4s ${i * 90}ms both">${art}<div class="desc">${esc(desc)}</div><button class="btn small red" data-pick="${i}">Escolher</button></div>`;
  }).join('');
  const s = modal(`<span class="lbl">${esc(R.PACKS[p.pack].name)}</span><h2>Escolha uma</h2><div class="shop-row">${html || '<p class="muted">O pacote veio vazio: você já tem todos.</p>'}</div><button class="btn ghost" data-skip>Pular</button>`, { closable: false });
  sfx.flip();
  s.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
    try { R.pickFromPack(run, Number(b.dataset.pick)); sfx.coin(); discover(run.arcanos.map((a) => a.id)); persist(); shop(); } catch (e) { sfx.error(); toast(e.message, 'err'); }
  }));
  s.querySelector('[data-skip]').onclick = () => { R.pickFromPack(run, -1); persist(); shop(); };
}

function over() {
  const reward = recordRun(run);
  const won = run.won;
  if (won) { sfx.win(); flash('#FFD23F', 500); } else shake(1.5);
  const s = modal(`<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div style="width:120px">${mascot('', won ? 'feliz' : 'tenso')}</div><div style="flex:1;min-width:220px"><span class="lbl">Semente ${esc(run.seed)}</span><h2>${won ? 'Revelação completa!' : 'Filme velado'}</h2>
    <p>${won ? 'Você venceu os 8 antes e o Obturador.' : `Fim na ante ${run.ante}.`} Melhor mão: <b>${fmt(run.best)}</b>.</p>
    <p class="muted">+${reward} fichas para o cassino${run.ante >= 3 || won ? ' e +1 giro na Roda da Sorte' : ''}.${won ? ' O verso Dourado foi liberado nos visuais.' : ''}</p></div></div>
    <div class="acts" style="justify-content:flex-start;margin-top:12px"><button class="btn red" data-go>Nova tiragem <kbd>Enter</kbd></button><button class="btn ghost" data-m>Menu</button></div>`, { closable: false });
  run = null;
  s.querySelector('[data-go]').onclick = () => { closeModal(); newGame(); };
  s.querySelector('[data-m]').onclick = () => go('menu');
}

function handsInfo() {
  const rows = Object.entries(HANDS).reverse().map(([k, h]) => { const l = run.levels[k] || 1; return `<tr><td>${esc(h.name)}</td><td>nv ${l}</td><td>${h.chips + h.lc * (l - 1)} × ${h.mult + h.lm * (l - 1)}</td><td>${run.played[k] || 0}×</td></tr>`; }).join('');
  modal(`<h2>Mãos</h2><table class="lb"><tr><th>Mão</th><th>Nível</th><th>Fichas × Mult</th><th>Jogada</th></tr>${rows}</table><p class="muted">Naipes: ${Object.values(SUITS).map((s) => s.name).join(', ')}. Figuras: V, D, R. O Ás vale 11 fichas e também fecha a sequência A-2-3-4-5.</p>`);
}
async function quit() {
  if (busy) return;
  if (await confirmBox('Sair da partida? Ela fica salva.', 'Sair', 'Continuar jogando')) { persist(); go('menu'); }
}
function onKey(e) {
  if (e.target.closest && e.target.closest('input')) return;
  if (isModal()) {
    if (e.key === 'Enter') { const b = document.querySelector('.overlay [data-go], .overlay [data-next]'); if (b) { e.preventDefault(); b.click(); } }
    return;
  }
  if (!run || run.phase !== 'round') return;
  if (e.key === 'Escape') return quit();
  if (/^[1-9]$/.test(e.key)) { const el = app.querySelectorAll('#hand .pc')[Number(e.key) - 1]; if (el) toggle(el.dataset.id); }
  else if (e.key === 'Enter') { e.preventDefault(); play(); }
  else if (e.key.toLowerCase() === 'd') doDiscard();
  else if (e.key.toLowerCase() === 's') { sortBy = sortBy === 'rank' ? 'suit' : 'rank'; render(); }
}
