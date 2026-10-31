// Avaliação de mãos (1 a 5 cartas). Cartas de Pedra não têm valor nem naipe, mas sempre pontuam.
export const HANDS = {
  alta: { name: 'Carta Alta', chips: 5, mult: 1, lc: 10, lm: 1 },
  par: { name: 'Par', chips: 10, mult: 2, lc: 15, lm: 1 },
  doispares: { name: 'Dois Pares', chips: 20, mult: 2, lc: 20, lm: 1 },
  trinca: { name: 'Trinca', chips: 30, mult: 3, lc: 20, lm: 2 },
  sequencia: { name: 'Sequência', chips: 30, mult: 4, lc: 30, lm: 3 },
  naipe: { name: 'Naipe', chips: 35, mult: 4, lc: 15, lm: 2 },
  casa: { name: 'Casa Cheia', chips: 40, mult: 4, lc: 25, lm: 2 },
  quadra: { name: 'Quadra', chips: 60, mult: 7, lc: 30, lm: 3 },
  seqnaipe: { name: 'Sequência de Naipe', chips: 100, mult: 8, lc: 40, lm: 4 },
  quina: { name: 'Quina', chips: 120, mult: 12, lc: 35, lm: 3 }
};
export const HAND_ORDER = ['quina', 'seqnaipe', 'quadra', 'casa', 'naipe', 'sequencia', 'trinca', 'doispares', 'par', 'alta'];
// mãos que "contêm" outra (para Arcanos do tipo "se a mão contém um Par")
export const CONTAINS = {
  par: ['par', 'doispares', 'trinca', 'casa', 'quadra', 'quina'],
  doispares: ['doispares', 'casa'],
  trinca: ['trinca', 'casa', 'quadra', 'quina'],
  sequencia: ['sequencia', 'seqnaipe'],
  naipe: ['naipe', 'seqnaipe']
};
export const handLevelStats = (type, level = 1) => {
  const h = HANDS[type];
  return { chips: h.chips + h.lc * (level - 1), mult: h.mult + h.lm * (level - 1) };
};

function findStraight(cards, min) {
  // valores distintos, Ás também vale 1
  const byRank = new Map();
  for (const c of cards) {
    if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  }
  if (byRank.has(14) && !byRank.has(1)) byRank.set(1, byRank.get(14));
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  let best = [];
  let run = [];
  for (let i = 0; i < ranks.length; i++) {
    if (run.length && ranks[i] === ranks[i - 1] + 1) run.push(ranks[i]);
    else run = [ranks[i]];
    if (run.length >= min && run.length >= best.length) best = [...run];
  }
  if (best.length < min) return null;
  return best.map((r) => byRank.get(r));
}

export function evaluate(cards, opts = {}) {
  const flushMin = opts.flushMin || 5;
  const straightMin = opts.straightMin || 5;
  const stones = cards.filter((c) => c.enh === 'pedra');
  const normal = cards.filter((c) => c.enh !== 'pedra');
  const groups = new Map();
  for (const c of normal) groups.set(c.rank, [...(groups.get(c.rank) || []), c]);
  const sets = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  const suitGroups = new Map();
  for (const c of normal) suitGroups.set(c.suit, [...(suitGroups.get(c.suit) || []), c]);
  const flushSet = [...suitGroups.values()].find((g) => g.length >= flushMin) || null;
  const straight = normal.length >= straightMin ? findStraight(normal, straightMin) : null;
  const sfSet = flushSet && flushSet.length >= straightMin ? findStraight(flushSet, straightMin) : null;
  let type = 'alta';
  let scoring = [];
  const top = sets[0] || [];
  if (top.length >= 5) { type = 'quina'; scoring = top.slice(0, 5); }
  else if (sfSet) { type = 'seqnaipe'; scoring = normal.filter((c) => sfSet.includes(c) || flushSet.includes(c)); }
  else if (top.length === 4) { type = 'quadra'; scoring = top; }
  else if (top.length === 3 && sets[1] && sets[1].length >= 2) { type = 'casa'; scoring = [...top, ...sets[1].slice(0, 2)]; }
  else if (flushSet) { type = 'naipe'; scoring = flushSet; }
  else if (straight) { type = 'sequencia'; scoring = straight; }
  else if (top.length === 3) { type = 'trinca'; scoring = top; }
  else if (top.length === 2 && sets[1] && sets[1].length === 2) { type = 'doispares'; scoring = [...top, ...sets[1]]; }
  else if (top.length === 2) { type = 'par'; scoring = top; }
  else if (normal.length) { type = 'alta'; scoring = [normal.reduce((a, b) => (b.rank > a.rank ? b : a))]; }
  // mantém a ordem em que as cartas foram jogadas e soma as de Pedra
  const set = new Set([...scoring, ...stones]);
  return { type, scoring: cards.filter((c) => set.has(c)) };
}
