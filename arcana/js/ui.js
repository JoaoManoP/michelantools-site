// Navegação entre telas e janelas sobrepostas.
import { sfx } from './fx.js';

export const app = document.getElementById('app');
const routes = {};
let cleanup = null;
export function route(name, fn) { routes[name] = fn; }
export function onLeave(fn) { cleanup = fn; }
export function go(name, arg) {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  closeModal();
  window.scrollTo(0, 0);
  const h = name === 'menu' ? '' : '#' + name;
  if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  (routes[name] || routes.menu)(arg);
}
export function current() { return (location.hash || '').slice(1) || 'menu'; }

let modalEl = null;
export function modal(html, { paper = false, onClose = null, closable = true } = {}) {
  closeModal();
  modalEl = document.createElement('div');
  modalEl.className = 'overlay';
  modalEl.innerHTML = `<div class="sheet${paper ? ' paper' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  if (closable) modalEl.addEventListener('click', (e) => { if (e.target === modalEl) { closeModal(); onClose && onClose(); } });
  document.body.append(modalEl);
  const f = modalEl.querySelector('button, input, [tabindex]');
  if (f) f.focus();
  return modalEl.querySelector('.sheet');
}
export function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
export const isModal = () => !!modalEl;
export function confirmBox(text, yes = 'Sim', no = 'Voltar') {
  return new Promise((res) => {
    const s = modal(`<h2>${text}</h2><div class="acts" style="justify-content:flex-start;margin-top:14px"><button class="btn red" data-y>${yes}</button><button class="btn ghost" data-n>${no}</button></div>`, { onClose: () => res(false) });
    s.querySelector('[data-y]').onclick = () => { sfx.click(); closeModal(); res(true); };
    s.querySelector('[data-n]').onclick = () => { sfx.click(); closeModal(); res(false); };
  });
}
export const backButton = (label = 'Menu') => `<button class="btn small ghost back-btn" data-back>${label} <kbd>Esc</kbd></button>`;
export function wireBack(root, fn = () => go('menu')) {
  const b = root.querySelector('[data-back]');
  if (b) b.onclick = () => { sfx.click(); fn(); };
}
