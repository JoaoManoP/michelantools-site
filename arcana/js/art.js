// Arte vetorial do Arcana: naipes, cartas, Arcanos (estilo tarô), Lâminas, rolos do duelo e o mascote.
import { SUITS, rankLabel, ENH } from '../core/cards.js';
import { ARCANO, arcanoDesc, RARITY, LAMINAS, CONSTELACOES, constDesc } from '../core/arcanos.js';
import { HANDS } from '../core/hands.js';
import { ITEMS } from '../core/duel.js';

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAR = 'M12 1.8l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.1l7.1-.7z';
export function suitSVG(suit, cls = '') {
  const col = SUITS[suit] ? SUITS[suit].color : '#0B0D12';
  const body = {
    estrela: `<path d="${STAR}" fill="${col}"/>`,
    lente: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="${col}" stroke-width="3"/><circle cx="12" cy="12" r="4.6" fill="${col}"/><circle cx="9.2" cy="9" r="1.6" fill="#EFEBE3"/>`,
    filme: `<rect x="3" y="2.5" width="18" height="19" rx="2" fill="${col}"/><g fill="#EFEBE3"><rect x="5" y="5" width="2.6" height="2.6"/><rect x="5" y="10.7" width="2.6" height="2.6"/><rect x="5" y="16.4" width="2.6" height="2.6"/><rect x="16.4" y="5" width="2.6" height="2.6"/><rect x="16.4" y="10.7" width="2.6" height="2.6"/><rect x="16.4" y="16.4" width="2.6" height="2.6"/><rect x="9.4" y="6" width="5.2" height="12" rx="1"/></g>`,
    flash: `<path d="M13.6 1.5 4.5 13.6h6.1l-1.9 8.9 9.8-12.6h-6.3z" fill="${col}"/>`
  }[suit] || '';
  return `<svg class="suit ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// carta de baralho
export function cardHTML(c, opts = {}) {
  if (!c) return '';
  const cls = ['pc', 's-' + c.suit, c.enh ? 'e-' + c.enh : '', opts.sel ? 'sel' : '', opts.debuff ? 'debuff' : '', opts.cls || ''].filter(Boolean).join(' ');
  const title = c.enh ? ` title="${esc(ENH[c.enh].name)}: ${esc(ENH[c.enh].desc)}"` : '';
  if (c.enh === 'pedra') {
    return `<div class="${cls}" data-id="${esc(c.id)}"${title}><div class="pc-face stone"><span class="stone-t">PEDRA</span><span class="stone-v">+50</span></div></div>`;
  }
  const r = rankLabel(c.rank);
  const face = c.rank >= 11 && c.rank <= 13;
  const center = face
    ? `<div class="pc-face-art"><span class="face-l">${r}</span>${suitSVG(c.suit, 'face-s')}<svg class="face-crown" viewBox="0 0 40 14"><path d="M2 12 6 2l7 6 7-7 7 7 7-6 4 10z" fill="currentColor"/></svg></div>`
    : `${suitSVG(c.suit, 'big')}`;
  return `<div class="${cls}" data-id="${esc(c.id)}"${title}><div class="pc-face">
    <span class="cr tl"><b>${r}</b>${suitSVG(c.suit, 'mini')}</span>
    ${center}
    <span class="cr br"><b>${r}</b>${suitSVG(c.suit, 'mini')}</span>
    ${c.enh ? `<span class="enh-tag">${esc(ENH[c.enh].name)}</span>` : ''}
  </div></div>`;
}
export const backHTML = (cls = '') => `<div class="pc back ${cls}"><div class="pc-back">${mascot('back-m')}</div></div>`;

// emblemas dos 22 Arcanos (traço papel sobre tinta, toques de vermelho e azul)
const P = '#EFEBE3', R = '#FF3B3B', B = '#3B82FF', G = '#2EE57A';
const st = (w = 3) => `fill="none" stroke="${P}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const EMB = {
  louco: `<path d="M10 78 L44 64 L56 70 L90 40" ${st()}/><circle cx="62" cy="34" r="10" fill="${R}"/><path d="${STAR}" transform="translate(70 12) scale(.8)" fill="${B}"/>`,
  mago: `<path d="M20 50c10-16 20-16 30 0s20 16 30 0-20-16-30 0-20 16-30 0z" ${st()}/><path d="M50 18v14M50 68v14" ${st()}/><circle cx="50" cy="50" r="6" fill="${R}"/>`,
  sacerdotisa: `<rect x="18" y="20" width="10" height="62" fill="${P}"/><rect x="72" y="20" width="10" height="62" fill="${B}"/><path d="M56 34a14 14 0 1 0 0 24 11 11 0 1 1 0-24z" fill="${P}"/>`,
  imperatriz: Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${50 + Math.cos(a) * 28}" cy="${50 + Math.sin(a) * 28}" r="4" fill="${i % 3 ? P : R}"/>`; }).join('') + `<path d="${STAR}" transform="translate(36 36) scale(1.15)" fill="${B}"/>`,
  imperador: `<rect x="28" y="34" width="44" height="44" ${st()}/><path d="M28 34c-14-4-14-20 0-20M72 34c14-4 14-20 0-20" ${st()}/><rect x="42" y="48" width="16" height="16" fill="${R}"/>`,
  hierofante: `<path d="M50 14v72M34 30h32M30 44h40M26 58h48" ${st(4)}/><circle cx="50" cy="14" r="5" fill="${R}"/>`,
  amantes: `<circle cx="38" cy="50" r="20" fill="none" stroke="${B}" stroke-width="4"/><circle cx="62" cy="50" r="20" fill="none" stroke="${R}" stroke-width="4"/><path d="M50 62c-8-6-12-10-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 5-4 9-12 15z" fill="${P}"/>`,
  carro: `<rect x="24" y="30" width="52" height="30" ${st()}/><circle cx="34" cy="70" r="10" ${st()}/><circle cx="66" cy="70" r="10" ${st()}/><path d="M24 30 50 14 76 30" ${st()}/><circle cx="50" cy="44" r="6" fill="${R}"/>`,
  forca: `<circle cx="50" cy="56" r="16" fill="${R}"/>${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<path d="M${50 + Math.cos(a) * 20} ${56 + Math.sin(a) * 20}L${50 + Math.cos(a) * 28} ${56 + Math.sin(a) * 28}" ${st()}/>`; }).join('')}<path d="M30 22c7-10 13-10 20 0s13 10 20 0" ${st()}/>`,
  eremita: `<path d="M50 14v12" ${st()}/><path d="M36 26h28l6 14-6 34H36l-6-34z" ${st()}/><path d="${STAR}" transform="translate(38 38) scale(1)" fill="${B}"/>`,
  roda: `<circle cx="50" cy="50" r="32" ${st()}/><circle cx="50" cy="50" r="8" fill="${R}"/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="M${50 + Math.cos(a) * 8} ${50 + Math.sin(a) * 8}L${50 + Math.cos(a) * 32} ${50 + Math.sin(a) * 32}" ${st(2)}/>`; }).join('')}`,
  justica: `<path d="M50 16v66M22 30h56M30 30 20 54h20zM70 30 60 54h20z" ${st()}/><path d="M20 54a10 6 0 0 0 20 0M60 54a10 6 0 0 0 20 0" fill="${R}"/><path d="M38 82h24" ${st(4)}/>`,
  enforcado: `<path d="M20 16h60M50 16v20" ${st()}/><path d="M50 36 32 80h36z" fill="none" stroke="${B}" stroke-width="4"/><circle cx="50" cy="60" r="7" fill="${R}"/>`,
  morte: `<path d="M30 84 66 16" ${st(4)}/><path d="M66 16c16 4 22 18 20 30-8-12-18-18-30-18" fill="${P}"/><circle cx="34" cy="40" r="9" fill="${R}"/>`,
  temperanca: `<path d="M22 24h20l-4 22H26zM58 54h20l-4 22H62z" ${st()}/><path d="M38 46c10 0 14 8 22 8" fill="none" stroke="${B}" stroke-width="4"/><path d="M38 50c10 0 14 8 22 8" fill="none" stroke="${R}" stroke-width="2"/>`,
  diabo: `<circle cx="50" cy="52" r="30" ${st()}/><path d="${STAR}" transform="translate(50 52) rotate(180) scale(2.1) translate(-12 -12)" fill="${R}"/>`,
  torre: `<path d="M34 86V34h32v52M30 34h40l-4-12H34z" ${st()}/><path d="M64 10 48 34h10l-8 18" fill="none" stroke="${G}" stroke-width="4"/><rect x="44" y="60" width="12" height="18" fill="${R}"/>`,
  estrela: `<path d="M50 10l6 30 30 10-30 10-6 30-6-30-30-10 30-10z" fill="${P}"/><path d="${STAR}" transform="translate(12 64) scale(.6)" fill="${B}"/><path d="${STAR}" transform="translate(72 64) scale(.6)" fill="${R}"/>`,
  lua: `<path d="M62 20a30 30 0 1 0 0 56 24 24 0 1 1 0-56z" fill="${P}"/><circle cx="30" cy="84" r="3" fill="${B}"/><circle cx="44" cy="88" r="3" fill="${B}"/><circle cx="58" cy="84" r="3" fill="${B}"/>`,
  sol: `<circle cx="50" cy="50" r="18" fill="${R}"/>${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const l = i % 2 ? 30 : 38; return `<path d="M${50 + Math.cos(a) * 24} ${50 + Math.sin(a) * 24}L${50 + Math.cos(a) * l} ${50 + Math.sin(a) * l}" ${st()}/>`; }).join('')}`,
  julgamento: `<path d="M18 62 70 30v22L18 70z" ${st()}/><path d="M74 26l12-8M76 40h14M74 54l12 8" fill="none" stroke="${B}" stroke-width="3"/><circle cx="24" cy="66" r="6" fill="${R}"/>`,
  mundo: `<ellipse cx="50" cy="50" rx="22" ry="34" fill="none" stroke="${G}" stroke-width="4"/><circle cx="16" cy="16" r="6" fill="${R}"/><circle cx="84" cy="16" r="6" fill="${B}"/><circle cx="16" cy="84" r="6" fill="${B}"/><circle cx="84" cy="84" r="6" fill="${R}"/><path d="${STAR}" transform="translate(38 38)" fill="${P}"/>`
};
export function emblem(id) {
  return `<svg class="emb" viewBox="0 0 100 100" aria-hidden="true">${EMB[id] || ''}</svg>`;
}
export function arcanoHTML(inst, run, opts = {}) {
  const d = ARCANO[inst.id];
  const desc = run ? arcanoDesc(inst, run) : d.desc;
  return `<div class="tc r-${d.rarity} ${opts.cls || ''}" data-uid="${esc(inst.uid || '')}" data-arc="${esc(d.id)}" tabindex="0">
    <span class="tc-num">${d.num}</span>${emblem(d.id)}<span class="tc-name">${esc(d.name)}</span>
    <span class="tc-tip"><b>${esc(d.name)}</b> · ${esc(RARITY[d.rarity].name)}<br>${esc(desc)}</span>${opts.price != null ? `<span class="price">$${opts.price}</span>` : ''}</div>`;
}
export function laminaHTML(l, name, text, opts = {}) {
  return `<div class="lam ${opts.cls || ''}" data-i="${opts.i ?? ''}" tabindex="0"><span class="lam-k">LÂMINA</span><svg class="lam-ic" viewBox="0 0 40 40"><rect x="6" y="4" width="28" height="32" rx="3" fill="none" stroke="#EFEBE3" stroke-width="2.5"/><circle cx="20" cy="20" r="8" fill="${l.suit ? SUITS[l.suit].color : '#FF3B3B'}"/></svg><span class="lam-n">${esc(name)}</span><span class="tc-tip"><b>${esc(name)}</b><br>${esc(text)}</span>${opts.price != null ? `<span class="price">$${opts.price}</span>` : ''}</div>`;
}
export function constHTML(hand, opts = {}) {
  return `<div class="lam const" tabindex="0"><span class="lam-k">CONSTELAÇÃO</span><svg class="lam-ic" viewBox="0 0 40 40"><g fill="#EFEBE3"><circle cx="8" cy="10" r="2"/><circle cx="20" cy="6" r="2.4"/><circle cx="31" cy="14" r="2"/><circle cx="24" cy="26" r="2.6"/><circle cx="12" cy="31" r="2"/></g><path d="M8 10 20 6 31 14 24 26 12 31" fill="none" stroke="#3B82FF" stroke-width="1.2"/></svg><span class="lam-n">${esc(CONSTELACOES[hand])}</span><span class="tc-tip"><b>${esc(CONSTELACOES[hand])}</b><br>${esc(constDesc(hand))}</span>${opts.price != null ? `<span class="price">$${opts.price}</span>` : ''}</div>`;
}
export function itemHTML(id, i, opts = {}) {
  const it = ITEMS[id];
  const ic = {
    visor: `<circle cx="20" cy="20" r="9" fill="none" stroke="#EFEBE3" stroke-width="3"/><circle cx="20" cy="20" r="3.5" fill="#3B82FF"/>`,
    congelar: `<path d="M20 5v30M7 12l26 16M7 28l26-16" stroke="#9fd4ff" stroke-width="3" stroke-linecap="round"/>`,
    duplo: `<path d="M17 4 8 22h7l-3 14 12-18h-7z" fill="#FFD23F"/><path d="M29 8 22 22h5l-2 10 9-13h-5z" fill="#FF3B3B"/>`,
    rebobinar: `<path d="M8 20a12 12 0 1 0 4-9" fill="none" stroke="#2EE57A" stroke-width="3.5" stroke-linecap="round"/><path d="M6 6v8h8" fill="none" stroke="#2EE57A" stroke-width="3.5"/>`,
    negativo: `<circle cx="20" cy="20" r="13" fill="#0B0D12" stroke="#EFEBE3" stroke-width="2.5"/><path d="M20 7a13 13 0 0 1 0 26z" fill="#EFEBE3"/>`,
    ejetar: `<path d="M20 6 34 22H6z" fill="#EFEBE3"/><rect x="6" y="27" width="28" height="6" fill="#FF3B3B"/>`
  }[id];
  return `<button class="item ${opts.cls || ''}" data-i="${i}" ${opts.disabled ? 'disabled' : ''} aria-label="${esc(it.name)}: ${esc(it.desc)}"><svg viewBox="0 0 40 40">${ic}</svg><span>${esc(it.name)}</span><span class="tc-tip"><b>${esc(it.name)}</b><br>${esc(it.desc)}</span>${opts.key ? `<kbd>${opts.key}</kbd>` : ''}</button>`;
}
export const rollHTML = (roll, cls = '') => `<span class="roll ${roll || 'oculto'} ${cls}" title="${roll === 'flash' ? 'Flash' : roll === 'vazio' ? 'Vazio' : 'Rolo'}"><svg viewBox="0 0 30 40"><rect x="3" y="3" width="24" height="34" rx="4"/><rect x="9" y="9" width="12" height="22" rx="2" class="core"/></svg></span>`;
export const handName = (t) => HANDS[t].name;
export const laminaDef = (id) => LAMINAS[id];

// mascote (a câmera da marca). humor: normal, feliz, tenso, flash
export function mascot(cls = '', mood = 'normal') {
  const pupil = (cx) => `<path transform="translate(${cx - 84} 0)" fill="#0B0D12" d="m84 103 7.6 16.2 17.8 2.4-13 12.3 3.3 17.6L84 143l-15.7 8.5 3.3-17.6-13-12.3 17.8-2.4Z"/>`;
  const mouth = mood === 'tenso' ? '<path d="M96 196h64" stroke="#EFEBE3" stroke-width="11" stroke-linecap="round"/>' : mood === 'feliz' ? '<path d="M86 186c24 22 60 22 84 0" fill="#EFEBE3"/>' : '<path d="M90 192c24 15 52 15 76 0" fill="none" stroke="#EFEBE3" stroke-width="11" stroke-linecap="round"/>';
  return `<svg class="mascot ${cls} m-${mood}" viewBox="0 0 256 256" aria-hidden="true"><rect x="92" y="34" width="72" height="34" rx="10" fill="#0B0D12"/><path fill="#0B0D12" d="M44 58h160c19 0 34 15 34 34v100c0 19-15 34-34 34H52c-19 0-34-15-34-34V84c0-14 12-26 26-26Z"/><circle class="lens-l" cx="84" cy="128" r="48" fill="#EFEBE3"/><circle class="lens-r" cx="172" cy="128" r="48" fill="#EFEBE3"/><circle cx="84" cy="128" r="31" fill="#3B82FF"/><circle cx="172" cy="128" r="31" fill="#FF3B3B"/>${pupil(84)}${pupil(172)}<rect x="118" y="120" width="20" height="14" rx="3" fill="#EFEBE3"/>${mouth}<circle class="led" cx="212" cy="82" r="9" fill="#2EE57A"/></svg>`;
}
