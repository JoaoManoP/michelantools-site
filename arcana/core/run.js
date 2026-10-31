// Partida solo: antes, rodadas (Plano Aberto, Plano Fechado e Chefe), pontuação Fichas × Mult, loja e pacotes.
// Tudo é puro e serializável (JSON); o aleatório vem de run.rng, então a mesma semente dá a mesma partida.
import { RNG } from './rng.js';
import { newDeck, chipValue, SUIT_IDS, SUITS } from './cards.js';
import { evaluate, handLevelStats, HANDS, HAND_ORDER } from './hands.js';
import { ARCANOS, ARCANO, RARITY, makeArcano, LAMINAS, LAMINA_IDS, CONSTELACOES, BOSSES, FINAL_BOSS, BOSS } from './arcanos.js';

export const ANTE_BASE = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
export const MAX_ANTE = 8;
export const BLINDS = [
  { id: 'aberto', name: 'Plano Aberto', x: 1, reward: 3 },
  { id: 'fechado', name: 'Plano Fechado', x: 1.5, reward: 4 },
  { id: 'chefe', name: 'Chefe', x: 2, reward: 5 }
];

export function newRun(seed, opts = {}) {
  const rng = new RNG('run:' + seed);
  // um chefe diferente por ante (o último é sempre O Obturador)
  const pool = rng.shuffle(BOSSES.map((b) => b.id));
  const bosses = [];
  for (let i = 0; i < MAX_ANTE - 1; i++) bosses.push(pool[i % pool.length]);
  bosses.push(FINAL_BOSS.id);
  const run = {
    v: 1, seed: String(seed), rng, ante: 1, blind: 0, money: 4, deck: newDeck(), arcanos: [], laminas: [], levels: {}, played: {},
    maxArcanos: 5, maxLaminas: 2, baseHands: 4, baseDiscards: 3, handSize: 8, bosses, phase: 'blind', round: null, shop: null, pack: null,
    uid: 0, best: 0, won: false, lost: false, log: []
  };
  for (const p of opts.powerups || []) applyPowerup(run, p);
  return run;
}
export const serialize = (run) => JSON.stringify(run);
export function deserialize(json) {
  const run = JSON.parse(json);
  run.rng = RNG.from(run.rng);
  return run;
}

export function applyPowerup(run, p) {
  if (p === 'arcano') { const id = randomArcanoId(run, ['comum', 'incomum']); if (id && run.arcanos.length < run.maxArcanos) run.arcanos.push(makeArcano(id, ++run.uid)); }
  else if (p === 'lamina') { if (run.laminas.length < run.maxLaminas) run.laminas.push(newLamina(run)); }
  else if (p === 'dinheiro') run.money += 5;
  else if (p === 'mao') run.baseHands += 1;
  else if (p === 'descarte') run.baseDiscards += 1;
}

export const cardById = (run, id) => run.deck.find((c) => c.id === id);
export const currentBoss = (run) => (run.blind === 2 ? BOSS[run.bosses[run.ante - 1]] : null);
export function blindTarget(run, ante = run.ante, blind = run.blind) {
  const boss = blind === 2 ? BOSS[run.bosses[ante - 1]] : null;
  return Math.round(ANTE_BASE[ante - 1] * BLINDS[blind].x * ((boss && boss.targetX) || 1));
}
function passives(run) {
  const p = { hands: 0, discards: 0, flushMin: 5, straightMin: 5 };
  for (const a of run.arcanos) {
    const ps = ARCANO[a.id].passive;
    if (!ps) continue;
    if (ps.hands) p.hands += ps.hands;
    if (ps.discards) p.discards += ps.discards;
    if (ps.flushMin) p.flushMin = Math.min(p.flushMin, ps.flushMin);
    if (ps.straightMin) p.straightMin = Math.min(p.straightMin, ps.straightMin);
  }
  return p;
}

export function startRound(run) {
  const boss = currentBoss(run);
  const p = passives(run);
  const ids = run.rng.shuffle(run.deck.map((c) => c.id));
  run.round = {
    target: blindTarget(run), score: 0,
    hands: Math.max(1, run.baseHands + p.hands + ((boss && boss.hands) || 0)),
    discards: Math.max(0, run.baseDiscards + p.discards + ((boss && boss.discards) || 0)),
    draw: ids, hand: [], types: [], last: null
  };
  run.phase = 'round';
  drawUp(run);
  return run.round;
}
function drawUp(run) {
  const r = run.round;
  while (r.hand.length < run.handSize && r.draw.length) r.hand.push(r.draw.shift());
}

export function canPlay(run, ids) {
  const boss = currentBoss(run);
  if (!ids.length || ids.length > 5) return 'Escolha de 1 a 5 cartas.';
  if (boss && boss.must5 && ids.length !== 5) return 'O Tripé: a mão precisa ter 5 cartas.';
  return null;
}
export function preview(run, ids) {
  const p = passives(run);
  const cards = ids.map((id) => cardById(run, id));
  const { type } = evaluate(cards, p);
  return { type, ...handLevelStats(type, run.levels[type] || 1), level: run.levels[type] || 1 };
}

// Pontua sem mexer na rodada (a não ser nos contadores dos Arcanos que crescem). Devolve os passos para a animação.
export function scoreHand(run, ids) {
  const p = passives(run);
  const boss = currentBoss(run);
  const played = ids.map((id) => cardById(run, id));
  const held = run.round.hand.filter((id) => !ids.includes(id)).map((id) => cardById(run, id));
  const { type, scoring } = evaluate(played, p);
  const level = run.levels[type] || 1;
  let { chips, mult } = handLevelStats(type, level);
  const steps = [{ k: 'base', type, level, chips, mult }];
  const ctx = { run, round: run.round, type, played, held, scoring, rng: run.rng };
  for (const a of run.arcanos) { const d = ARCANO[a.id]; if (d.beforeScore) d.beforeScore(ctx, a); }
  const broken = [];
  const apply = (eff, src) => {
    if (!eff) return;
    if (eff.chips) chips += eff.chips;
    if (eff.mult) mult += eff.mult;
    if (eff.xmult) mult *= eff.xmult;
    steps.push({ ...src, ...eff, chipsNow: chips, multNow: mult });
  };
  const repeated = boss && boss.noRepeat && run.round.types.includes(type);
  scoring.forEach((c, i) => {
    if (boss && boss.debuff && boss.debuff(c)) { steps.push({ k: 'debuff', card: c.id, chipsNow: chips, multNow: mult }); return; }
    let times = 1;
    for (const a of run.arcanos) { const d = ARCANO[a.id]; if (d.retrigger) times += d.retrigger(ctx, i); }
    for (let t = 0; t < times; t++) {
      apply({ chips: c.enh === 'pedra' ? 50 : chipValue(c.rank), again: t > 0 || undefined }, { k: 'card', card: c.id });
      if (c.enh === 'brilho') apply({ mult: 4 }, { k: 'enh', card: c.id, enh: 'brilho' });
      if (c.enh === 'foco') apply({ chips: 30 }, { k: 'enh', card: c.id, enh: 'foco' });
      if (c.enh === 'vidro') apply({ xmult: 2 }, { k: 'enh', card: c.id, enh: 'vidro' });
      for (const a of run.arcanos) { const d = ARCANO[a.id]; if (d.onCard) apply(d.onCard({ ...ctx, card: c }, a), { k: 'arcano', arc: a.uid, card: c.id }); }
    }
    if (c.enh === 'vidro' && run.rng.chance(0.25)) broken.push(c.id);
  });
  for (const a of run.arcanos) { const d = ARCANO[a.id]; if (d.onHand) apply(d.onHand(ctx, a), { k: 'arcano', arc: a.uid }); }
  if (boss && boss.halfMult) { mult = Math.max(1, mult / 2); steps.push({ k: 'boss', text: 'Mult ÷ 2', chipsNow: chips, multNow: mult }); }
  mult = Math.round(mult * 100) / 100;
  let total = Math.floor(chips * mult);
  if (repeated) { total = 0; steps.push({ k: 'boss', text: 'Mão repetida: 0', chipsNow: chips, multNow: mult }); }
  return { type, level, scoring: scoring.map((c) => c.id), chips, mult, total, steps, broken };
}

export function playHand(run, ids) {
  const err = canPlay(run, ids);
  if (err) throw new Error(err);
  const r = run.round;
  const res = scoreHand(run, ids);
  r.score += res.total;
  r.hands -= 1;
  r.types.push(res.type);
  r.last = res;
  run.played[res.type] = (run.played[res.type] || 0) + 1;
  run.best = Math.max(run.best, res.total);
  r.hand = r.hand.filter((id) => !ids.includes(id));
  if (res.broken.length) destroyCards(run, res.broken);
  drawUp(run);
  let status = 'continue';
  if (r.score >= r.target) { status = 'win'; run.phase = 'cashout'; }
  else if (r.hands <= 0) { status = 'lose'; run.phase = 'over'; run.lost = true; }
  return { ...res, status };
}
export function discard(run, ids) {
  const r = run.round;
  if (r.discards <= 0) throw new Error('Sem descartes nesta rodada.');
  if (!ids.length || ids.length > 5) throw new Error('Descarte de 1 a 5 cartas.');
  r.hand = r.hand.filter((id) => !ids.includes(id));
  r.discards -= 1;
  drawUp(run);
}
function destroyCards(run, ids) {
  run.deck = run.deck.filter((c) => !ids.includes(c.id));
  if (run.round) {
    run.round.hand = run.round.hand.filter((id) => !ids.includes(id));
    run.round.draw = run.round.draw.filter((id) => !ids.includes(id));
  }
  for (const a of run.arcanos) { const d = ARCANO[a.id]; if (d.onDestroy) d.onDestroy(a, ids.length); }
}

export function cashOut(run) {
  const r = run.round;
  const lines = [];
  lines.push({ label: BLINDS[run.blind].name + ' vencido', v: BLINDS[run.blind].reward });
  if (r.hands > 0) lines.push({ label: `Mãos que sobraram (${r.hands})`, v: r.hands });
  const silver = r.hand.map((id) => cardById(run, id)).filter((c) => c && c.enh === 'prata').length;
  if (silver) lines.push({ label: `Cartas de Prata na mão (${silver})`, v: silver * 3 });
  const interest = Math.min(5, Math.floor(Math.max(0, run.money) / 5));
  if (interest) lines.push({ label: 'Juros ($1 a cada $5, até $5)', v: interest });
  const total = lines.reduce((a, b) => a + b.v, 0);
  run.money += total;
  if (run.blind === 2) for (const a of run.arcanos) { const d = ARCANO[a.id]; if (d.onBoss) d.onBoss(a); }
  const wasFinal = run.blind === 2 && run.ante === MAX_ANTE;
  run.round = null;
  if (wasFinal) { run.won = true; run.phase = 'over'; return { lines, total, won: true }; }
  run.blind += 1;
  if (run.blind > 2) { run.blind = 0; run.ante += 1; }
  openShop(run);
  return { lines, total, won: false };
}

// ---------- loja ----------
function randomArcanoId(run, rarities = ['comum', 'incomum', 'raro', 'lendario']) {
  const owned = new Set(run.arcanos.map((a) => a.id));
  const pool = ARCANOS.filter((a) => !owned.has(a.id) && rarities.includes(a.rarity));
  if (!pool.length) return null;
  const idx = run.rng.weighted(pool.map((a) => RARITY[a.rarity].w));
  return pool[idx].id;
}
function newLamina(run) {
  const id = LAMINA_IDS[run.rng.int(LAMINA_IDS.length)];
  return id === 'filtro' ? { id, suit: SUIT_IDS[run.rng.int(4)] } : { id };
}
function shopItem(run) {
  const k = run.rng.weighted([60, 25, 15]);
  if (k === 0) { const id = randomArcanoId(run); if (id) return { kind: 'arcano', id, cost: ARCANO[id].cost }; }
  if (k === 2) { const hand = HAND_ORDER[run.rng.int(HAND_ORDER.length)]; return { kind: 'const', hand, cost: 3 }; }
  return { kind: 'lamina', ...newLamina(run), cost: 3 };
}
const PACKS = { arcano: { name: 'Pacote Maior', desc: 'Escolha 1 de 2 Arcanos.', cost: 6 }, lamina: { name: 'Pacote de Laboratório', desc: 'Escolha 1 de 3 Lâminas.', cost: 4 }, estelar: { name: 'Pacote Estelar', desc: 'Escolha 1 de 3 Constelações.', cost: 4 } };
export { PACKS };
export function openShop(run) {
  run.phase = 'shop';
  const packKinds = Object.keys(PACKS);
  run.shop = { items: [shopItem(run), shopItem(run)], packs: [packKinds[run.rng.int(3)], packKinds[run.rng.int(3)]].map((p) => ({ kind: 'pack', pack: p, cost: PACKS[p].cost })), reroll: 5 };
  return run.shop;
}
export function reroll(run) {
  const s = run.shop;
  if (run.money < s.reroll) throw new Error('Dinheiro insuficiente.');
  run.money -= s.reroll;
  s.reroll += 1;
  s.items = [shopItem(run), shopItem(run)];
}
function gain(run, item) {
  if (item.kind === 'arcano') {
    if (run.arcanos.length >= run.maxArcanos) throw new Error('Sem espaço para Arcanos (venda um).');
    run.arcanos.push(makeArcano(item.id, ++run.uid));
  } else if (item.kind === 'lamina') {
    if (run.laminas.length >= run.maxLaminas) throw new Error('Sem espaço para Lâminas.');
    run.laminas.push(item.suit ? { id: item.id, suit: item.suit } : { id: item.id });
  } else if (item.kind === 'const') {
    run.levels[item.hand] = (run.levels[item.hand] || 1) + 1;
  }
}
export function buy(run, where, i) {
  const list = run.shop[where];
  const item = list[i];
  if (!item || item.sold) throw new Error('Item indisponível.');
  if (run.money < item.cost) throw new Error('Dinheiro insuficiente.');
  if (item.kind === 'pack') {
    run.money -= item.cost;
    item.sold = true;
    const n = item.pack === 'arcano' ? 2 : 3;
    const choices = [];
    for (let k = 0; k < n; k++) {
      if (item.pack === 'arcano') { const id = randomArcanoId(run); if (id && !choices.some((c) => c.id === id)) choices.push({ kind: 'arcano', id }); }
      else if (item.pack === 'lamina') choices.push({ kind: 'lamina', ...newLamina(run) });
      else { const hand = HAND_ORDER[run.rng.int(HAND_ORDER.length)]; if (!choices.some((c) => c.hand === hand)) choices.push({ kind: 'const', hand }); }
    }
    run.pack = { pack: item.pack, choices };
    return run.pack;
  }
  gain(run, item);
  run.money -= item.cost;
  item.sold = true;
  return item;
}
export function pickFromPack(run, i) {
  if (!run.pack) throw new Error('Nenhum pacote aberto.');
  if (i >= 0) gain(run, run.pack.choices[i]);
  run.pack = null;
}
export function sellArcano(run, uid) {
  const a = run.arcanos.find((x) => x.uid === uid);
  if (!a) return 0;
  const v = Math.max(1, Math.floor(ARCANO[a.id].cost / 2));
  run.arcanos = run.arcanos.filter((x) => x !== a);
  run.money += v;
  return v;
}
export function moveArcano(run, uid, dir) {
  const i = run.arcanos.findIndex((a) => a.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= run.arcanos.length) return;
  [run.arcanos[i], run.arcanos[j]] = [run.arcanos[j], run.arcanos[i]];
}
export function leaveShop(run) {
  run.shop = null;
  run.pack = null;
  run.phase = 'blind';
}

// ---------- Lâminas ----------
export function useLamina(run, idx, ids = []) {
  const l = run.laminas[idx];
  if (!l) throw new Error('Lâmina inexistente.');
  const def = LAMINAS[l.id];
  if (ids.length < def.min || ids.length > def.max) throw new Error(def.max ? `Selecione de ${def.min} a ${def.max} carta(s).` : 'Esta Lâmina não usa cartas.');
  const cards = ids.map((id) => cardById(run, id));
  if (def.enh) cards.forEach((c) => (c.enh = def.enh));
  else if (l.id === 'filtro') cards.forEach((c) => { c.suit = l.suit; if (c.enh === 'pedra') c.enh = null; });
  else if (l.id === 'zoom') cards.forEach((c) => (c.rank = c.rank >= 14 ? 2 : c.rank + 1));
  else if (l.id === 'dupla') { const c = cards[0]; run.deck.push({ ...c, id: c.id + '~' + ++run.uid }); }
  else if (l.id === 'corte') destroyCards(run, ids);
  else if (l.id === 'fortuna') run.money += Math.min(20, Math.max(0, run.money));
  else if (l.id === 'camara') {
    if (run.arcanos.length >= run.maxArcanos) throw new Error('Sem espaço para Arcanos.');
    const id = randomArcanoId(run, ['comum', 'incomum']);
    if (id) run.arcanos.push(makeArcano(id, ++run.uid));
  }
  run.laminas.splice(idx, 1);
  return true;
}
export const laminaText = (l) => (l.id === 'filtro' ? LAMINAS.filtro.desc.replace('indicado', SUITS[l.suit].name) : LAMINAS[l.id].desc);
export const laminaName = (l) => (l.id === 'filtro' ? `Filtro de ${SUITS[l.suit].name}` : LAMINAS[l.id].name);
export { HANDS, CONSTELACOES };
