// Baralho do Arcana: 52 cartas em quatro naipes do estúdio.
export const SUITS = {
  estrela: { name: 'Estrelas', short: 'Estrela', color: '#3B82FF' },
  lente: { name: 'Lentes', short: 'Lente', color: '#FF3B3B' },
  filme: { name: 'Filmes', short: 'Filme', color: '#0B0D12' },
  flash: { name: 'Flashes', short: 'Flash', color: '#16A34A' }
};
export const SUIT_IDS = Object.keys(SUITS);
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const LABEL = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
const LONG = { 11: 'Valete', 12: 'Dama', 13: 'Rei', 14: 'Ás' };
export const rankLabel = (r) => LABEL[r] || String(r);
export const rankName = (r) => LONG[r] || String(r);
export const chipValue = (r) => (r === 14 ? 11 : r >= 11 ? 10 : r);
export const isFace = (c) => c.enh !== 'pedra' && c.rank >= 11 && c.rank <= 13;

// melhorias aplicadas pelas Lâminas
export const ENH = {
  brilho: { name: 'Brilho', desc: '+4 Mult quando pontua' },
  foco: { name: 'Foco', desc: '+30 Fichas quando pontua' },
  vidro: { name: 'Vidro', desc: '×2 Mult quando pontua; 1 em 4 de quebrar' },
  prata: { name: 'Prata', desc: '$3 se estiver na mão no fim da rodada' },
  pedra: { name: 'Pedra', desc: '+50 Fichas; sem valor nem naipe; sempre pontua' }
};

let uid = 0;
export function card(rank, suit, enh = null) {
  return { id: 'c' + (++uid).toString(36) + rank + suit[0], rank, suit, enh };
}
export function newDeck() {
  uid = 0;
  const d = [];
  for (const s of SUIT_IDS) for (const r of RANKS) d.push({ id: `${s}-${r}`, rank: r, suit: s, enh: null });
  return d;
}
export const cardName = (c) => (c.enh === 'pedra' ? 'Carta de Pedra' : `${rankName(c.rank)} de ${SUITS[c.suit].name}`);
export function sortHand(cards, by = 'rank') {
  return [...cards].sort((a, b) => (by === 'suit' ? SUIT_IDS.indexOf(a.suit) - SUIT_IDS.indexOf(b.suit) || b.rank - a.rank : b.rank - a.rank || SUIT_IDS.indexOf(a.suit) - SUIT_IDS.indexOf(b.suit)));
}
