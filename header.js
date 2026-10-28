// Cabeçalho: mostra quem está logado e o atalho do painel para quem é admin.
import { configured, session, myProfile, isAdmin, esc } from './account.js';
(async () => {
  if (!configured) return;
  const login = document.getElementById('hdr-login');
  const get = document.getElementById('hdr-get');
  if (!login) return;
  const R = document.body.dataset.page === 'index' ? '' : '../';
  try {
    const ses = await session();
    if (!ses) return;
    const p = await myProfile().catch(() => null);
    const name = (p && p.name) || ses.user.email || '';
    const initial = name.trim().charAt(0).toUpperCase() || '•';
    login.href = R + 'conta/';
    login.innerHTML = '<span class="avatar">' + esc(initial) + '</span><span>' + esc(name.split(' ')[0]) + '</span>';
    login.title = 'Minha conta';
    if (get) { get.textContent = p && p.plan === 'completo' ? 'PRO ativo' : 'Minha conta'; get.href = R + 'conta/'; }
    if (await isAdmin()) {
      const a = document.createElement('a');
      a.className = 'btn secondary';
      a.href = R + 'painel/';
      a.textContent = 'Painel';
      login.after(a);
    }
  } catch { /* sem sessão: cabeçalho padrão */ }
})();
