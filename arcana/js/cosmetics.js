import { M } from './meta.js';
export function applyCosmetics() {
  const b = document.body;
  b.className = b.className.split(' ').filter((c) => !/^(back|felt)-/.test(c)).join(' ');
  b.classList.add('back-' + (M.cosmetics.back || 'classico'), 'felt-' + (M.cosmetics.felt || 'tinta'));
}
