// Tela da Roleta da Câmera: contra a IA ou online (sala com código ou fila rápida).
import { newDuel, apply, aiMove, duelHash, ITEMS, ITEM_IDS, flashOdds, ROUNDS } from '../core/duel.js';
import { seedCode } from '../core/rng.js';
import { app, route, go, onLeave, modal, closeModal, confirmBox, isModal } from './ui.js';
import { mascot, itemHTML, rollHTML, esc } from './art.js';
import { sfx, shake, flash, wait, toast } from './fx.js';
import { M, save, recordDuel, connect, loggedUser, displayName } from './meta.js';
import { joinRoom, quickMatch, newRoomCode, cleanCode } from './net.js';

let st = null;
let me = 0;
let mode = 'ia';
let room = null;
let animating = false;
let queue = [];
let recorded = false;
let names = ['Você', 'Rival'];
let startedOnline = false;
let wantAgain = [false, false];
let onlineIds = [];

route('duelo', () => {
  cleanupNet();
  document.addEventListener('keydown', onKey);
  onLeave(() => { document.removeEventListener('keydown', onKey); cleanupNet(); });
  lobby();
});

function cleanupNet() {
  if (quickMatch.cancel) { try { quickMatch.cancel(); } catch {} quickMatch.cancel = null; }
  if (room) { room.leave(); room = null; }
  st = null;
  startedOnline = false;
}

function lobby() {
  const u = loggedUser();
  app.innerHTML = `<div class="page"><div class="page-head"><div><span class="lbl">Duelo</span><h1 class="h-d">Roleta da Câmera</h1></div><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
    <div class="panel" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div style="width:110px">${mascot('', 'tenso')}</div><div style="flex:1;min-width:240px">
      <p>A câmera é carregada com rolos de <b style="color:var(--red)">flash</b> e rolos <b>vazios</b>, em ordem secreta. Só a quantidade é anunciada. Na sua vez, dispare no rival ou em você: disparar em você com um rolo vazio mantém a vez. Cada flash queima um quadro de filme. Quem vence 2 rodadas leva o duelo.</p>
      <p class="muted">Itens: ${ITEM_IDS.map((i) => ITEMS[i].name).join(', ')}.</p></div></div>
    <div class="menu-grid">
      <button class="menu-card" data-ia style="--c:var(--blue)"><span class="num">OFFLINE</span><b>Contra a câmera rival</b><small>A IA joga limpo: só sabe o que você saberia.${M.duelBonus ? ` Você leva ${M.duelBonus} item(ns) extra(s) da Roda.` : ''}</small></button>
      <button class="menu-card" data-q style="--c:var(--red)"><span class="num">ONLINE</span><b>Fila rápida</b><small>Encontra outra pessoa esperando agora.</small></button>
      <button class="menu-card" data-new style="--c:var(--green)"><span class="num">ONLINE</span><b>Criar sala</b><small>Gere um código e mande para quem você quer desafiar.</small></button>
      <button class="menu-card" data-join style="--c:var(--gold)"><span class="num">ONLINE</span><b>Entrar com código</b><small>Digite o código de 5 letras da sala.</small></button>
    </div>
    ${u ? '' : '<p class="muted">O duelo online pede a conta Milens (a mesma do site). Entre pelo menu Conta.</p>'}</div>`;
  app.querySelector('[data-back]').onclick = () => go('menu');
  app.querySelector('[data-ia]').onclick = () => startIA();
  const needLogin = async () => { if (loggedUser() || (await connect())) return true; toast('Entre na sua conta Milens para jogar online (menu Conta).', 'err'); return false; };
  app.querySelector('[data-q]').onclick = async () => { if (await needLogin()) quick(); };
  app.querySelector('[data-new]').onclick = async () => { if (await needLogin()) online(newRoomCode()); };
  app.querySelector('[data-join]').onclick = async () => {
    if (!(await needLogin())) return;
    const s = modal(`<h2>Entrar na sala</h2><input id="code" class="mono" maxlength="5" autocomplete="off" style="padding:12px;font-size:26px;letter-spacing:.3em;text-transform:uppercase;width:200px;border:3px solid var(--ink);background:var(--paper);color:var(--ink)"><div class="acts" style="justify-content:flex-start;margin-top:12px"><button class="btn red" data-go>Entrar</button></div>`);
    const i = s.querySelector('#code');
    const goIn = () => { const c = cleanCode(i.value); if (c.length < 5) return toast('O código tem 5 letras.', 'err'); closeModal(); online(c); };
    s.querySelector('[data-go]').onclick = goIn;
    i.onkeydown = (e) => { if (e.key === 'Enter') goIn(); };
  };
}

// ---------- contra a IA ----------
function startIA() {
  mode = 'ia';
  me = 0;
  recorded = false;
  const bonus = [];
  for (let k = 0; k < (M.duelBonus || 0); k++) bonus.push(ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)]);
  M.duelBonus = 0;
  save();
  const u = loggedUser();
  names = [u ? 'Você' : 'Você', 'Câmera Rival'];
  st = newDuel(seedCode(10), { names, bonusItems: [bonus, []] });
  sfx.load();
  render();
  say(`Rodada 1 · ${st.remain.flash} flash, ${st.remain.vazio} vazio(s)`);
  next();
}

// ---------- online ----------
async function quick() {
  app.innerHTML = `<div class="title"><div class="title-in"><div style="width:150px">${mascot('', 'normal')}</div><h2 class="h-d">Procurando rival…</h2><p class="muted" id="qn">Na fila.</p><button class="btn ghost" data-x>Cancelar</button></div></div>`;
  app.querySelector('[data-x]').onclick = () => { cleanupNet(); lobby(); };
  try {
    const u = loggedUser();
    const code = await quickMatch({ id: u.id }, (n) => { const el = app.querySelector('#qn'); if (el) el.textContent = n > 1 ? `${n} pessoas na fila. Formando par…` : 'Só você na fila por enquanto. Chame alguém!'; });
    online(code, true);
  } catch (e) { if (e.message !== 'cancelado') { toast(e.message, 'err'); lobby(); } }
}
async function online(code, fromQueue = false) {
  mode = 'online';
  recorded = false;
  startedOnline = false;
  wantAgain = [false, false];
  const u = loggedUser();
  const myName = (await displayName(u)).split(' ')[0];
  app.innerHTML = `<div class="title"><div class="title-in"><div style="width:150px">${mascot('', 'normal')}</div><span class="lbl">${fromQueue ? 'Par encontrado' : 'Sala'}</span><h1 class="logo-t" style="font-size:72px">${esc(code)}</h1><p class="muted" id="ws">${fromQueue ? 'Conectando ao rival…' : 'Mande este código para o rival. Esperando…'}</p><button class="btn ghost" data-x>Sair da sala</button></div></div>`;
  app.querySelector('[data-x]').onclick = () => { cleanupNet(); lobby(); };
  let hello = 0;
  try {
    room = await joinRoom(code, { id: u.id, name: myName }, {
      presence: (list) => {
        if (startedOnline) return;
        const ws = app.querySelector('#ws');
        if (list.length < 2) { if (ws) ws.textContent = 'Esperando o rival entrar com o código ' + code + '…'; return; }
        const ids = list.map((x) => x.id).sort();
        if (!ids.includes(u.id)) return;
        if (list.length > 2 && ids.indexOf(u.id) > 1) { toast('A sala já está cheia.', 'err'); cleanupNet(); return lobby(); }
        onlineIds = ids.slice(0, 2);
        const nm = onlineIds.map((id) => (list.find((x) => x.id === id) || {}).name || 'Jogador');
        if (onlineIds[0] === u.id) {
          const seed = seedCode(10);
          room.send({ t: 'start', seed, ids: onlineIds, names: nm });
          beginOnline(seed, nm, u.id);
        } else {
          clearInterval(hello);
          hello = setInterval(() => { if (!startedOnline && room) room.send({ t: 'hello' }); else clearInterval(hello); }, 1500);
        }
      },
      leave: () => {
        if (st && startedOnline && !st.over && !recorded) {
          recorded = true;
          recordDuel(true, true);
          st.over = true;
          st.winner = me;
          toast('O rival saiu. Vitória por W.O.', 'ok');
          render();
          endModal();
        }
      },
      msg: (m) => onMsg(m, u.id)
    });
  } catch (e) { toast(e.message, 'err'); lobby(); }
}
let lastSeed = null;
function onMsg(m, myId) {
  if (m.t === 'start') { if (!startedOnline || m.seed !== lastSeed) { onlineIds = m.ids; beginOnline(m.seed, m.names, myId); } return; }
  if (m.t === 'hello' && startedOnline && onlineIds[0] === myId && lastSeed && st && st.seq === 0) { room.send({ t: 'start', seed: lastSeed, ids: onlineIds, names }); return; }
  if (m.t === 'move') { queue.push(m); pump(); return; }
  if (m.t === 'sync?' && onlineIds[0] === myId && st) { room.send({ t: 'state', st }); return; }
  if (m.t === 'state' && onlineIds[0] !== myId) { st = m.st; render(); next(); return; }
  if (m.t === 'again') {
    wantAgain[1 - me] = true;
    toast('O rival quer revanche.', 'ok');
    maybeAgain(myId);
  }
}
function beginOnline(seed, nm, myId) {
  startedOnline = true;
  lastSeed = seed;
  me = onlineIds.indexOf(myId);
  names = nm;
  recorded = false;
  wantAgain = [false, false];
  queue = [];
  st = newDuel(seed, { names: nm });
  closeModal();
  sfx.load();
  render();
  say(`Rodada 1 · ${st.remain.flash} flash, ${st.remain.vazio} vazio(s)`);
}
function maybeAgain(myId) {
  if (wantAgain[0] && wantAgain[1] && onlineIds[0] === myId) {
    const seed = seedCode(10);
    room.send({ t: 'start', seed, ids: onlineIds, names });
    beginOnline(seed, names, myId);
  }
}
async function pump() {
  if (animating || !queue.length || !st) return;
  const m = queue.shift();
  if (m.seq !== st.seq) { room && room.send({ t: 'sync?' }); return; }
  const p = st.turn;
  if (p === me) return;
  await doMove(p, m.move, false);
  if (duelHash(st) !== m.hash) { room && room.send({ t: 'sync?' }); }
  pump();
}

// ---------- jogar ----------
async function doMove(p, move, mine = true) {
  if (!st || st.over || animating) return;
  animating = true;
  const seqBefore = st.seq;
  let ev;
  try { ev = apply(st, p, move); } catch (e) { animating = false; return toast(e.message, 'err'); }
  if (mode === 'online' && mine && room) room.send({ t: 'move', seq: seqBefore, move, hash: duelHash(st) });
  await animate(ev);
  animating = false;
  render();
  if (st.over) return endModal();
  next();
  pump();
}
function next() {
  if (!st || st.over) return;
  if (mode === 'ia' && st.turn === 1) setTimeout(async () => { if (!st || st.over || st.turn !== 1 || animating) return; await doMove(1, aiMove(st, 1), false); }, 950);
}
async function animate(evs) {
  for (const e of evs) {
    if (e.e === 'item') {
      const who = e.by === me ? 'Você usou' : names[e.by] + ' usou';
      sfx.click();
      say(`${who} ${ITEMS[e.item].name}`);
      if (e.item === 'visor' && e.by === me) { await wait(200); say(`O próximo rolo é ${e.secret === 'flash' ? 'FLASH' : 'VAZIO'}`); }
      if (e.item === 'rebobinar') sfx.heal();
      if (e.item === 'congelar') sfx.freeze();
      if (e.item === 'ejetar') { await wait(300); say(`Ejetado: ${e.roll === 'flash' ? 'era flash' : 'era vazio'}`); sfx.blank(); }
      await wait(700);
    } else if (e.e === 'shot') {
      const cam = app.querySelector('.cam-wrap');
      const atMe = e.target === me;
      if (cam) { cam.classList.remove('aim-up', 'aim-down', 'fired'); cam.classList.add(atMe ? 'aim-down' : 'aim-up'); }
      const self = e.by === e.target;
      say(`${e.by === me ? 'Você mira' : names[e.by] + ' mira'} ${self ? (e.by === me ? 'em você mesmo' : 'em si mesmo') : e.target === me ? 'em você' : 'no rival'}…`);
      sfx.select(4);
      await wait(900);
      if (e.roll === 'flash') {
        flash('#fff', 520);
        sfx.flash();
        shake(e.dmg > 1 ? 2.6 : 1.8);
        if (cam) cam.classList.add('fired');
        const seat = app.querySelector(atMe ? '.seat.me' : '.seat.op');
        if (seat) seat.querySelectorAll('.frame:not(.lost)').forEach((f, i, arr) => { if (i >= arr.length - e.dmg) f.classList.add('hit', 'lost'); });
        say(`FLASH! −${e.dmg} quadro${e.dmg > 1 ? 's' : ''}`);
      } else {
        sfx.blank();
        say(self ? 'Vazio. Mantém a vez.' : 'Vazio.');
      }
      await wait(900);
      if (cam) cam.classList.remove('aim-up', 'aim-down', 'fired');
    } else if (e.e === 'frozen') { say(`${e.who === me ? 'Você estava congelado' : names[e.who] + ' estava congelado'}: perde a vez`); sfx.freeze(); await wait(800); }
    else if (e.e === 'load') { sfx.load(); render(); say(`Câmera recarregada: ${e.flash} flash, ${e.vazio} vazio(s)`); await wait(1000); }
    else if (e.e === 'roundEnd') { say(e.winner === me ? 'Você venceu a rodada!' : `${names[e.winner]} venceu a rodada`); e.winner === me ? sfx.win() : sfx.lose(); await wait(1300); }
    else if (e.e === 'round') { render(); say(`Rodada ${e.round}: ${ROUNDS[e.round - 1].lives} quadros cada`); await wait(900); }
  }
}
function say(t) { const el = app.querySelector('.duel-msg'); if (el) el.textContent = t; }

function seatHTML(p, cls) {
  const lives = Array.from({ length: st.maxLives }, (_, i) => `<span class="frame ${i < st.lives[p] ? '' : 'lost'}"></span>`).join('');
  const wins = `<span class="wins">${[0, 1].map((i) => `<i class="${i < st.wins[p] ? 'on' : ''}"></i>`).join('')}</span>`;
  const mine = p === me;
  const myTurn = mine && st.turn === me && !st.over && !animating;
  const items = st.items[p].map((it, i) => itemHTML(it, i, { cls: mine ? '' : 'ghost', disabled: !myTurn, key: mine && i < 6 ? String(i + 1) : '' })).join('');
  return `<div class="seat ${cls} ${st.turn === p && !st.over ? 'turn' : ''}"><div style="width:58px">${mascot('', p === me ? 'normal' : 'tenso')}</div>
    <div class="who"><b>${esc(names[p] || '')}${mine && mode === 'online' ? ' (você)' : ''}</b><div class="lives">${lives}</div>${wins}${st.frozen[p] ? '<span class="lbl" style="color:#9fd4ff">congelado</span>' : ''}</div>
    <div class="items">${items}</div></div>`;
}
function render() {
  if (!st) return;
  const o = 1 - me;
  const myTurn = st.turn === me && !st.over && !animating;
  const rolls = [...Array(st.remain.flash).fill('flash'), ...Array(st.remain.vazio).fill('vazio')].map((r) => rollHTML(r)).join('');
  const odds = Math.round(flashOdds(st) * 100);
  app.innerHTML = `<div class="duel">
    <div class="c-head"><span class="lbl">${mode === 'online' ? 'Online' : 'Contra a IA'} · rodada ${st.round + 1} de 3</span><button class="btn small ghost" data-back>Sair <kbd>Esc</kbd></button></div>
    ${seatHTML(o, 'op')}
    <div class="arena">
      <div class="cam-wrap">${mascot('', 'tenso')}</div>
      <div class="chamber" aria-label="Rolos na câmera">${rolls}</div>
      <div class="duel-sub">Na câmera: ${st.remain.flash} flash · ${st.remain.vazio} vazio(s) · chance de flash ${odds}%${st.inverted ? ' · Negativo ativo' : ''}${st.double ? ' · Flash Duplo armado' : ''}</div>
      ${st.peek[me] ? `<span class="peek">Seu visor: o próximo é ${st.peek[me] === 'flash' ? 'FLASH' : 'VAZIO'}</span>` : ''}
      <div class="duel-msg">${st.over ? (st.winner === me ? 'Vitória!' : 'Derrota') : myTurn ? 'Sua vez' : 'Vez de ' + esc(names[st.turn])}</div>
      <div class="shoot"><button class="btn red" data-s="other" ${myTurn ? '' : 'disabled'}>Disparar no rival <kbd>A</kbd></button><button class="btn" data-s="self" ${myTurn ? '' : 'disabled'}>Disparar em mim <kbd>S</kbd></button></div>
    </div>
    ${seatHTML(me, 'me')}
  </div>`;
  app.querySelector('[data-back]').onclick = leave;
  app.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => doMove(me, { k: 'shoot', target: b.dataset.s })));
  app.querySelectorAll('.seat.me .item').forEach((b) => (b.onclick = () => doMove(me, { k: 'item', i: Number(b.dataset.i) })));
}
function endModal() {
  const win = st.winner === me;
  if (!recorded) { recorded = true; recordDuel(win, mode === 'online'); }
  win ? sfx.win() : sfx.lose();
  const s = modal(`<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="width:110px">${mascot('', win ? 'feliz' : 'tenso')}</div><div><h2>${win ? 'Você venceu o duelo' : 'Você perdeu o duelo'}</h2><p class="muted">${win ? `+${mode === 'online' ? 80 : 40} fichas e +1 giro na Roda da Sorte.` : 'Revanche?'}</p></div></div>
    <div class="acts" style="justify-content:flex-start;margin-top:12px"><button class="btn red" data-go>Revanche</button><button class="btn ghost" data-l>Duelos</button><button class="btn ghost" data-m>Menu</button></div>`, { closable: false });
  s.querySelector('[data-go]').onclick = () => {
    if (mode === 'ia') { closeModal(); return startIA(); }
    if (!room) { closeModal(); return lobby(); }
    wantAgain[me] = true;
    room.send({ t: 'again' });
    s.querySelector('[data-go]').textContent = 'Esperando o rival…';
    maybeAgain(loggedUser().id);
  };
  s.querySelector('[data-l]').onclick = () => { closeModal(); cleanupNet(); lobby(); };
  s.querySelector('[data-m]').onclick = () => go('menu');
}
async function leave() {
  if (st && !st.over && mode === 'online') { if (!(await confirmBox('Sair agora conta como derrota. Sair?', 'Sair', 'Ficar'))) return; if (!recorded) { recorded = true; recordDuel(false, true); } }
  else if (st && !st.over && !(await confirmBox('Abandonar o duelo?', 'Sair', 'Ficar'))) return;
  cleanupNet();
  lobby();
}
function onKey(e) {
  if (isModal() || !st) { if (e.key === 'Escape' && !isModal() && !st) go('menu'); return; }
  if (e.key === 'Escape') return leave();
  if (st.over || st.turn !== me || animating) return;
  const k = e.key.toLowerCase();
  if (k === 'a') doMove(me, { k: 'shoot', target: 'other' });
  else if (k === 's') doMove(me, { k: 'shoot', target: 'self' });
  else if (/^[1-6]$/.test(k) && st.items[me][Number(k) - 1]) doMove(me, { k: 'item', i: Number(k) - 1 });
}
