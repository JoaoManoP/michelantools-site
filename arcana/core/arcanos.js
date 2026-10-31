// Os 22 Arcanos (efeitos permanentes da partida), as Lâminas (usáveis), as Constelações (sobem o nível de uma mão)
// e os Chefes. Regras próprias do Milens Arcana.
import { isFace } from './cards.js';
import { CONTAINS, HANDS } from './hands.js';

const A = (num, id, name, rarity, cost, desc, hooks = {}) => ({ num, id, name, rarity, cost, desc, ...hooks });
const suitBonus = (suit) => (x) => (x.card.suit === suit && x.card.enh !== 'pedra' ? { mult: 3 } : null);

export const ARCANOS = [
  A('0', 'louco', 'O Louco', 'comum', 4, '+4 Mult.', { onHand: () => ({ mult: 4 }) }),
  A('I', 'mago', 'O Mago', 'comum', 5, 'Cartas de Lentes pontuadas dão +3 Mult.', { onCard: suitBonus('lente') }),
  A('II', 'sacerdotisa', 'A Sacerdotisa', 'comum', 5, 'Cartas de Estrelas pontuadas dão +3 Mult.', { onCard: suitBonus('estrela') }),
  A('III', 'imperatriz', 'A Imperatriz', 'comum', 5, 'Cartas de Flashes pontuadas dão +3 Mult.', { onCard: suitBonus('flash') }),
  A('IV', 'imperador', 'O Imperador', 'comum', 5, 'Cartas de Filmes pontuadas dão +3 Mult.', { onCard: suitBonus('filme') }),
  A('V', 'hierofante', 'O Hierofante', 'comum', 6, '+12 Mult se a mão contém um Par.', { onHand: (x) => (CONTAINS.par.includes(x.type) ? { mult: 12 } : null) }),
  A('VI', 'amantes', 'Os Amantes', 'comum', 6, '+80 Fichas se a mão contém Dois Pares.', { onHand: (x) => (CONTAINS.doispares.includes(x.type) ? { chips: 80 } : null) }),
  A('VII', 'carro', 'O Carro', 'incomum', 7, 'A primeira carta pontuada conta duas vezes.', { retrigger: (x, i) => (i === 0 ? 1 : 0) }),
  A('VIII', 'forca', 'A Força', 'comum', 6, 'Figuras (V, D, R) pontuadas dão +30 Fichas.', { onCard: (x) => (isFace(x.card) ? { chips: 30 } : null) }),
  A('IX', 'eremita', 'O Eremita', 'incomum', 6, '×2 Mult se você jogar 3 cartas ou menos.', { onHand: (x) => (x.played.length <= 3 ? { xmult: 2 } : null) }),
  A('X', 'roda', 'A Roda da Fortuna', 'incomum', 6, '1 chance em 4 de ×3 Mult.', { onHand: (x) => (x.rng.chance(0.25) ? { xmult: 3 } : { text: 'Nada desta vez' }) }),
  A('XI', 'justica', 'A Justiça', 'incomum', 7, '+3 Mult para cada Arcano que você tem.', { onHand: (x) => ({ mult: 3 * x.run.arcanos.length }) }),
  A('XII', 'enforcado', 'O Enforcado', 'comum', 5, '+25 Fichas para cada descarte que sobrou.', { onHand: (x) => (x.round.discards > 0 ? { chips: 25 * x.round.discards } : null) }),
  A('XIII', 'morte', 'A Morte', 'raro', 7, 'Ganha ×0,25 Mult cada vez que uma carta é destruída.', { init: () => ({ x: 1 }), show: (d) => `atual ×${fmt(d.x)}`, onHand: (x, self) => (self.data.x > 1 ? { xmult: self.data.x } : null), onDestroy: (self, n) => { self.data.x += 0.25 * n; } }),
  A('XIV', 'temperanca', 'A Temperança', 'comum', 6, '+1 Mult para cada $4 que você tem.', { onHand: (x) => { const m = Math.floor(Math.max(0, x.run.money) / 4); return m ? { mult: m } : null; } }),
  A('XV', 'diabo', 'O Diabo', 'raro', 8, '×3 Mult. Você tem 1 mão a menos por rodada.', { passive: { hands: -1 }, onHand: () => ({ xmult: 3 }) }),
  A('XVI', 'torre', 'A Torre', 'incomum', 7, 'Cartas de Pedra pontuadas dão ×1,5 Mult.', { onCard: (x) => (x.card.enh === 'pedra' ? { xmult: 1.5 } : null) }),
  A('XVII', 'estrela', 'A Estrela', 'incomum', 7, 'Naipes e Sequências podem ser feitos com 4 cartas.', { passive: { flushMin: 4, straightMin: 4 } }),
  A('XVIII', 'lua', 'A Lua', 'comum', 6, 'Ases pontuados dão +20 Fichas e +4 Mult.', { onCard: (x) => (x.card.rank === 14 && x.card.enh !== 'pedra' ? { chips: 20, mult: 4 } : null) }),
  A('XIX', 'sol', 'O Sol', 'raro', 7, 'Ganha +3 Mult cada vez que você joga uma Sequência.', { init: () => ({ m: 0 }), show: (d) => `atual +${d.m}`, beforeScore: (x, self) => { if (CONTAINS.sequencia.includes(x.type)) self.data.m += 3; }, onHand: (x, self) => (self.data.m ? { mult: self.data.m } : null) }),
  A('XX', 'julgamento', 'O Julgamento', 'raro', 8, 'Ganha ×0,5 Mult a cada Chefe derrotado.', { init: () => ({ x: 1 }), show: (d) => `atual ×${fmt(d.x)}`, onBoss: (self) => { self.data.x += 0.5; }, onHand: (x, self) => (self.data.x > 1 ? { xmult: self.data.x } : null) }),
  A('XXI', 'mundo', 'O Mundo', 'lendario', 10, '×0,25 Mult para cada tipo de mão diferente jogado na partida.', { show: (d, run) => `atual ×${fmt(1 + 0.25 * Object.keys((run && run.played) || {}).length)}`, onHand: (x) => { const n = Object.keys(x.run.played).length; return n ? { xmult: 1 + 0.25 * n } : null; } })
];
export const ARCANO = Object.fromEntries(ARCANOS.map((a) => [a.id, a]));
export const RARITY = { comum: { name: 'Comum', w: 70 }, incomum: { name: 'Incomum', w: 25 }, raro: { name: 'Raro', w: 5 }, lendario: { name: 'Lendário', w: 1 } };
function fmt(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
export function arcanoDesc(inst, run) {
  const d = ARCANO[inst.id];
  return d.desc + (d.show ? ` (${d.show(inst.data || {}, run)})` : '');
}
export function makeArcano(id, uidN) {
  const d = ARCANO[id];
  return { uid: 'a' + uidN, id, data: d.init ? d.init() : {} };
}

// ---------- Lâminas: técnicas de laboratório que mudam as cartas ----------
export const LAMINAS = {
  revelacao: { name: 'Revelação', desc: 'Até 2 cartas selecionadas ganham Brilho (+4 Mult).', min: 1, max: 2, enh: 'brilho' },
  foco: { name: 'Foco', desc: 'Até 2 cartas selecionadas ganham Foco (+30 Fichas).', min: 1, max: 2, enh: 'foco' },
  vidro: { name: 'Lente de Vidro', desc: '1 carta selecionada vira Vidro (×2 Mult, pode quebrar).', min: 1, max: 1, enh: 'vidro' },
  prata: { name: 'Banho de Prata', desc: 'Até 2 cartas viram Prata ($3 se ficarem na mão no fim da rodada).', min: 1, max: 2, enh: 'prata' },
  daguerreotipo: { name: 'Daguerreótipo', desc: '1 carta selecionada vira Pedra (+50 Fichas, sempre pontua).', min: 1, max: 1, enh: 'pedra' },
  filtro: { name: 'Filtro', desc: 'Até 3 cartas selecionadas passam para o naipe indicado.', min: 1, max: 3 },
  zoom: { name: 'Zoom', desc: '+1 no valor de até 2 cartas selecionadas (o Ás volta para 2).', min: 1, max: 2 },
  dupla: { name: 'Dupla Exposição', desc: 'Põe uma cópia da carta selecionada no baralho.', min: 1, max: 1 },
  corte: { name: 'Corte', desc: 'Destrói até 2 cartas selecionadas do baralho.', min: 1, max: 2 },
  fortuna: { name: 'Fortuna', desc: 'Dobra o seu dinheiro (no máximo +$20).', min: 0, max: 0 },
  camara: { name: 'Câmara Escura', desc: 'Revela um Arcano comum ou incomum (precisa de espaço).', min: 0, max: 0 }
};
export const LAMINA_IDS = Object.keys(LAMINAS);

// ---------- Constelações: +1 nível numa mão ----------
export const CONSTELACOES = { alta: 'Órion', par: 'Gêmeos', doispares: 'Balança', trinca: 'Triângulo', sequencia: 'Cruzeiro do Sul', naipe: 'Plêiades', casa: 'Cassiopeia', quadra: 'Escorpião', seqnaipe: 'Centauro', quina: 'Via Láctea' };
export const constDesc = (hand) => `Sobe ${HANDS[hand].name} um nível (+${HANDS[hand].lc} Fichas, +${HANDS[hand].lm} Mult).`;

// ---------- Chefes ----------
export const BOSSES = [
  { id: 'nevoa', name: 'A Névoa', desc: 'Cartas de Estrelas não pontuam.', debuff: (c) => c.suit === 'estrela' && c.enh !== 'pedra' },
  { id: 'velado', name: 'O Filme Velado', desc: 'Cartas de Lentes não pontuam.', debuff: (c) => c.suit === 'lente' && c.enh !== 'pedra' },
  { id: 'contraluz', name: 'O Contraluz', desc: 'Figuras não pontuam.', debuff: (c) => isFace(c) },
  { id: 'rolo', name: 'O Rolo Curto', desc: 'Nenhum descarte nesta rodada.', discards: -99 },
  { id: 'tripe', name: 'O Tripé', desc: 'Toda mão precisa ter 5 cartas.', must5: true },
  { id: 'longa', name: 'A Exposição Longa', desc: 'A meta desta rodada é 50% maior.', targetX: 1.5 },
  { id: 'silencio', name: 'O Silêncio', desc: 'Você tem 1 mão a menos.', hands: -1 },
  { id: 'cego', name: 'O Flash Cego', desc: 'O Mult final é dividido por 2.', halfMult: true },
  { id: 'repeticao', name: 'A Repetição', desc: 'Repetir um tipo de mão nesta rodada não pontua.', noRepeat: true }
];
export const FINAL_BOSS = { id: 'obturador', name: 'O Obturador', desc: 'Figuras não pontuam e você tem 1 descarte a menos.', debuff: (c) => isFace(c), discards: -1 };
export const BOSS = Object.fromEntries([...BOSSES, FINAL_BOSS].map((b) => [b.id, b]));
