// Cassino do Arcana: só fichas virtuais (sem dinheiro de verdade, sem compra de fichas).
// Roda da Sorte com power-ups e a mesa de Vinte e Um da Câmera.
import { RNG } from './rng.js';
import { SUIT_IDS, RANKS } from './cards.js';

// mesma ordem e pesos da função arcana_spin no banco (supabase/arcana.sql)
export const WHEEL = [
  { id: 'fichas50', label: '+50 fichas', kind: 'chips', v: 50, w: 16, color: '#EFEBE3' },
  { id: 'arcano', label: 'Arcano grátis', kind: 'power', v: 'arcano', w: 9, color: '#FF3B3B' },
  { id: 'fichas100', label: '+100 fichas', kind: 'chips', v: 100, w: 14, color: '#3B82FF' },
  { id: 'item', label: 'Item de duelo', kind: 'duel', v: 1, w: 10, color: '#16A34A' },
  { id: 'dinheiro', label: '+$5 na partida', kind: 'power', v: 'dinheiro', w: 10, color: '#EFEBE3' },
  { id: 'velado', label: 'Filme velado', kind: 'none', v: 0, w: 10, color: '#0B0D12' },
  { id: 'fichas250', label: '+250 fichas', kind: 'chips', v: 250, w: 7, color: '#FF3B3B' },
  { id: 'lamina', label: 'Lâmina grátis', kind: 'power', v: 'lamina', w: 9, color: '#3B82FF' },
  { id: 'mao', label: '+1 mão na partida', kind: 'power', v: 'mao', w: 5, color: '#16A34A' },
  { id: 'giro', label: 'Giro extra', kind: 'spin', v: 1, w: 6, color: '#EFEBE3' },
  { id: 'fichas500', label: '+500 fichas', kind: 'chips', v: 500, w: 2, color: '#FFD23F' },
  { id: 'dobro', label: 'Dobro no Vinte e Um', kind: 'bj2', v: 1, w: 2, color: '#FF3B3B' }
];
export const spinLocal = (rand = Math.random) => {
  const total = WHEEL.reduce((a, s) => a + s.w, 0);
  let r = rand() * total;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r < 0) return i; }
  return WHEEL.length - 1;
};

// ---------- Vinte e Um da Câmera ----------
export function newShoe(seed) {
  const r = new RNG('shoe:' + seed);
  const cards = [];
  for (let d = 0; d < 2; d++) for (const s of SUIT_IDS) for (const k of RANKS) cards.push({ id: `${s}-${k}-${d}`, rank: k, suit: s, enh: null });
  return r.shuffle(cards);
}
export function bjValue(cards) {
  let v = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 14) { aces++; v += 11; } else v += c.rank >= 11 ? 10 : c.rank;
  }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}
export const isBlackjack = (cards) => cards.length === 2 && bjValue(cards) === 21;
export function bjDeal(shoe, bet) {
  const t = { shoe, bet, player: [shoe.pop(), shoe.pop()], dealer: [shoe.pop(), shoe.pop()], done: false, result: null, payout: 0, doubled: false };
  if (isBlackjack(t.player) || isBlackjack(t.dealer)) bjSettle(t);
  return t;
}
export function bjHit(t) {
  if (t.done) return t;
  t.player.push(t.shoe.pop());
  if (bjValue(t.player) > 21) bjSettle(t);
  return t;
}
export function bjDouble(t) {
  if (t.done || t.player.length !== 2) return t;
  t.doubled = true;
  t.bet *= 2;
  t.player.push(t.shoe.pop());
  return bjStand(t);
}
export function bjStand(t) {
  if (t.done) return t;
  if (bjValue(t.player) <= 21) while (bjValue(t.dealer) < 17) t.dealer.push(t.shoe.pop());
  return bjSettle(t);
}
// payout = quanto volta para o jogador (aposta incluída); 0 = perdeu
function bjSettle(t) {
  const p = bjValue(t.player);
  const d = bjValue(t.dealer);
  const pbj = isBlackjack(t.player);
  const dbj = isBlackjack(t.dealer);
  if (pbj && dbj) { t.result = 'empate'; t.payout = t.bet; }
  else if (pbj) { t.result = 'vinteeum'; t.payout = Math.floor(t.bet * 2.5); }
  else if (dbj) { t.result = 'perdeu'; t.payout = 0; }
  else if (p > 21) { t.result = 'estourou'; t.payout = 0; }
  else if (d > 21 || p > d) { t.result = 'ganhou'; t.payout = t.bet * 2; }
  else if (p === d) { t.result = 'empate'; t.payout = t.bet; }
  else { t.result = 'perdeu'; t.payout = 0; }
  t.done = true;
  return t;
}

// ---------- loja de visuais (fichas) ----------
export const COSMETICS = {
  back: [
    { id: 'classico', name: 'Clássico', cost: 0 },
    { id: 'reticula', name: 'Retícula', cost: 300 },
    { id: 'neon', name: 'Neon', cost: 500 },
    { id: 'taro', name: 'Tarô', cost: 700 },
    { id: 'dourado', name: 'Dourado', cost: 1500 }
  ],
  felt: [
    { id: 'tinta', name: 'Tinta', cost: 0 },
    { id: 'vermelho', name: 'Vermelho', cost: 250 },
    { id: 'azul', name: 'Azul', cost: 250 },
    { id: 'papel', name: 'Papel', cost: 400 },
    { id: 'verde', name: 'Mesa verde', cost: 400 }
  ]
};
