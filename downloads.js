// Página pública de downloads: mostra a versão atual (tabela releases) sem precisar de conta.
import { sb, esc } from './account.js';
(async () => {
  try {
    const s = await sb();
    if (!s) return;
    const { data } = await s.rpc('latest_release', { ch: 'estavel' });
    if (!data || !data.version) return;
    document.getElementById('dl-ver').textContent = 'Versão ' + data.version;
    if (data.published_at) document.getElementById('dl-date').textContent = 'Windows · publicada em ' + new Date(data.published_at).toLocaleDateString('pt-BR');
    if (data.notes) document.getElementById('dl-notes').innerHTML = '<b>Nesta versão:</b> ' + esc(data.notes);
  } catch {}
})();
