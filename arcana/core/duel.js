// Roleta da Câmera: duelo por turnos. A câmera é carregada com rolos de FLASH (tiram quadros de vida) e rolos
// VAZIOS, em ordem secreta; só a quantidade de cada um é anunciada. Na sua vez você dispara no adversário ou em si
// mesmo; disparar em si mesmo com um rolo vazio mantém a vez. Itens mudam o jogo. Melhor de 3 rodadas.
// O estado é JSON puro com o aleatório dentro: os dois jogadores aplicam os mesmos lances e conferem o hash.
import { RNG, stateHash } from './rng.js';

export const ITEMS = {
  visor: { name: 'Visor', desc: 'Mostra, só para você, se o próximo rolo é flash ou vazio.' },
  congelar: { name: 'Congelar', desc: 'O adversário perde a próxima vez.' },
  duplo: { name: 'Flash Duplo', desc: 'Se o próximo disparo for flash, tira 2 quadros.' },
  rebobinar: { name: 'Rebobinar', desc: 'Recupera 1 quadro de filme.' },
  negativo: { name: 'Negativo', desc: 'Inverte o próximo rolo: flash vira vazio e vazio vira flash.' },
  ejetar: { name: 'Ejetar', desc: 'Joga fora o próximo rolo e mostra o que era.' }
};
export const ITEM_IDS = Object.keys(ITEMS);
export const ROUNDS = [
  { lives: 3, items: 1 },
  { lives: 4, items: 2 },
  { lives: 5, items: 3 }
];
const MAX_ITEMS = 6;

export function newDuel(seed, opts = {}) {
  const st = {
    v: 1, seed: String(seed), rng: new RNG('duel:' + seed).toJSON(), names: opts.names || ['Você', 'Rival'],
    round: 0, wins: [0, 0], lives: [0, 0], maxLives: 0, items: [[], []], chamber: [], remain: { flash: 0, vazio: 0 },
    turn: 0, double: false, inverted: false, frozen: [false, false], peek: [null, null], seq: 0, over: false, winner: null, log: []
  };
  const bonus = opts.bonusItems || [[], []];
  startRound(st, 0, []);
  for (let p = 0; p < 2; p++) for (const it of bonus[p] || []) if (st.items[p].length < MAX_ITEMS && ITEMS[it]) st.items[p].push(it);
  return st;
}
function rngOf(st) { return RNG.from(st.rng); }
function saveRng(st, r) { st.rng = r.toJSON(); }
function startRound(st, r, ev) {
  st.round = r;
  const cfg = ROUNDS[r];
  st.lives = [cfg.lives, cfg.lives];
  st.maxLives = cfg.lives;
  st.items = [[], []];
  st.double = false;
  st.inverted = false;
  st.frozen = [false, false];
  st.turn = r % 2;
  ev.push({ e: 'round', round: r + 1 });
  load(st, ev);
}
function load(st, ev) {
  const r = rngOf(st);
  const total = 2 + r.int(5);
  const flash = 1 + r.int(total - 1);
  const ch = [];
  for (let i = 0; i < total; i++) ch.push(i < flash ? 'flash' : 'vazio');
  r.shuffle(ch);
  st.chamber = ch;
  st.remain = { flash, vazio: total - flash };
  st.peek = [null, null];
  const n = ROUNDS[st.round].items;
  for (let p = 0; p < 2; p++) for (let k = 0; k < n; k++) if (st.items[p].length < MAX_ITEMS) st.items[p].push(ITEM_IDS[r.int(ITEM_IDS.length)]);
  saveRng(st, r);
  ev.push({ e: 'load', flash, vazio: total - flash });
}
const effective = (st, roll) => (st.inverted ? (roll === 'flash' ? 'vazio' : 'flash') : roll);
function reveal(st, roll) {
  // o que saiu da câmera sai da contagem pública pelo que ERA carregado
  st.remain[roll] -= 1;
}

export function legalMoves(st, p) {
  if (st.over || st.turn !== p) return [];
  const m = [{ k: 'shoot', target: 'other' }, { k: 'shoot', target: 'self' }];
  st.items[p].forEach((it, i) => m.push({ k: 'item', i, item: it }));
  return m;
}

// Aplica um lance do jogador p. Devolve a lista de eventos (para a animação). Lança erro se o lance for inválido.
export function apply(st, p, move) {
  if (st.over) throw new Error('O duelo acabou.');
  if (st.turn !== p) throw new Error('Não é a sua vez.');
  const ev = [];
  const o = 1 - p;
  st.seq += 1;
  if (move.k === 'item') {
    const it = st.items[p][move.i];
    if (!it) throw new Error('Item inválido.');
    st.items[p].splice(move.i, 1);
    const info = { e: 'item', by: p, item: it };
    if (it === 'visor') { st.peek[p] = effective(st, st.chamber[0]); info.secret = st.peek[p]; }
    else if (it === 'congelar') st.frozen[o] = true;
    else if (it === 'duplo') st.double = true;
    else if (it === 'rebobinar') st.lives[p] = Math.min(st.maxLives, st.lives[p] + 1);
    else if (it === 'negativo') { st.inverted = !st.inverted; st.peek = st.peek.map((x) => (x ? (x === 'flash' ? 'vazio' : 'flash') : x)); }
    else if (it === 'ejetar') {
      const raw = st.chamber.shift();
      info.roll = effective(st, raw);
      st.inverted = false;
      reveal(st, raw);
      st.peek = [null, null];
      if (!st.chamber.length) load(st, ev);
    }
    ev.unshift(info);
    st.log.push(info);
    return ev;
  }
  if (move.k !== 'shoot') throw new Error('Lance inválido.');
  const raw = st.chamber.shift();
  const roll = effective(st, raw);
  st.inverted = false;
  reveal(st, raw);
  const target = move.target === 'self' ? p : o;
  const dmg = roll === 'flash' ? (st.double ? 2 : 1) : 0;
  st.double = false;
  st.peek = [null, null];
  st.lives[target] = Math.max(0, st.lives[target] - dmg);
  const shot = { e: 'shot', by: p, target, roll, dmg };
  ev.push(shot);
  st.log.push(shot);
  if (st.lives[target] <= 0) {
    const w = 1 - target;
    st.wins[w] += 1;
    ev.push({ e: 'roundEnd', winner: w });
    if (st.wins[w] >= 2) { st.over = true; st.winner = w; ev.push({ e: 'over', winner: w }); return ev; }
    startRound(st, st.round + 1, ev);
    return ev;
  }
  // vez: vazio em si mesmo mantém; senão passa, a não ser que o outro esteja congelado
  if (!(target === p && roll === 'vazio')) {
    if (st.frozen[o]) { st.frozen[o] = false; ev.push({ e: 'frozen', who: o }); }
    else st.turn = o;
  }
  if (!st.chamber.length) load(st, ev);
  return ev;
}

export const duelHash = (st) => stateHash({ ...st, log: undefined, names: undefined });
export const clone = (st) => JSON.parse(JSON.stringify(st));
export const flashOdds = (st) => { const t = st.remain.flash + st.remain.vazio; return t ? st.remain.flash / t : 0; };

// IA honesta: só usa o que um jogador saberia (contagem pública e o próprio visor).
export function aiMove(st, p, rand = Math.random) {
  const o = 1 - p;
  const items = st.items[p];
  const has = (id) => items.indexOf(id);
  const known = st.peek[p];
  let odds = flashOdds(st);
  if (st.inverted) odds = 1 - odds;
  if (known) odds = known === 'flash' ? 1 : 0;
  if (has('rebobinar') >= 0 && st.lives[p] < st.maxLives) return { k: 'item', i: has('rebobinar') };
  if (!known && odds > 0.15 && odds < 0.85 && has('visor') >= 0) return { k: 'item', i: has('visor') };
  if (odds === 0 && has('negativo') >= 0) return { k: 'item', i: has('negativo') };
  if (odds >= 0.99) {
    if (has('duplo') >= 0 && !st.double && st.lives[o] >= 2) return { k: 'item', i: has('duplo') };
    if (has('congelar') >= 0 && !st.frozen[o] && st.chamber.length > 1) return { k: 'item', i: has('congelar') };
    return { k: 'shoot', target: 'other' };
  }
  if (odds <= 0.01) return { k: 'shoot', target: 'self' };
  if (odds >= 0.5 && has('ejetar') >= 0 && st.lives[p] === 1 && rand() < 0.5) return { k: 'item', i: has('ejetar') };
  if (has('congelar') >= 0 && !st.frozen[o] && odds >= 0.5) return { k: 'item', i: has('congelar') };
  if (odds > 0.5 || (odds === 0.5 && rand() < 0.6)) return { k: 'shoot', target: 'other' };
  return { k: 'shoot', target: rand() < 0.8 ? 'self' : 'other' };
}
