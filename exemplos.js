// Copiar prompts da página de exemplos
document.addEventListener('click', (e) => {
  const b = e.target.closest('.ex-copy');
  if (!b) return;
  navigator.clipboard.writeText(b.dataset.copy || '').then(() => { const t = b.textContent; b.textContent = 'Copiado'; setTimeout(() => (b.textContent = t), 1400); });
});
