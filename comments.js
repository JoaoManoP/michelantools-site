// Comentários das páginas: lista pública, envio por quem tem conta, exclusão do próprio comentário.
import { sb, session, configured, explain, esc } from './account.js';
const box = document.getElementById('comments');
if (box) boot();

async function boot() {
  const page = box.dataset.page;
  const R = document.body.dataset.page === 'index' ? '' : '../';
  if (!configured) { box.innerHTML = '<p class="muted">Comentários abrem junto com o cadastro.</p>'; return; }
  const s = await sb();
  const ses = await session();
  const when = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  async function load() {
    const { data, error } = await s.from('comments').select('*').eq('page', page).order('created_at', { ascending: false }).limit(100);
    if (error) { box.innerHTML = '<div class="note err">' + esc(explain(error)) + '</div>'; return; }
    const list = data || [];
    box.innerHTML = `
      <div class="c-head"><h2>Comentários</h2><span class="muted">${list.length} ${list.length === 1 ? 'comentário' : 'comentários'}</span></div>
      ${ses ? `<form class="c-form" id="cf"><textarea name="body" rows="3" maxlength="2000" required placeholder="Conte o que achou, peça um recurso ou tire uma dúvida."></textarea><div class="row"><button class="btn primary" type="submit">Publicar</button><span class="fine">Publicado com o nome da sua conta. Sem links de propaganda.</span></div></form>`
          : `<div class="c-login"><p>Entre para comentar.</p><a class="btn secondary" href="${R}conta/#entrar">Entrar ou criar conta</a></div>`}
      <div class="c-list">${list.map((c) => `
        <article class="c-item${c.status === 'oculto' ? ' hidden-c' : ''}" data-id="${c.id}">
          <header><span class="avatar">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</span><b>${esc(c.name || 'Pessoa')}</b><span class="muted">${when(c.created_at)}</span>${c.status === 'oculto' ? '<span class="chip-st">oculto</span>' : ''}${ses && ses.user.id === c.user_id ? '<button class="linkish" data-del>Excluir</button>' : ''}</header>
          <p>${esc(c.body)}</p>
        </article>`).join('') || '<p class="muted">Seja a primeira pessoa a comentar.</p>'}</div>`;
    const f = box.querySelector('#cf');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = f.body.value.trim();
      if (body.length < 2) return;
      f.querySelector('button').disabled = true;
      const { error: er } = await s.from('comments').insert({ page, user_id: ses.user.id, body });
      if (er) { f.insertAdjacentHTML('beforebegin', '<div class="note err">' + esc(explain(er)) + '</div>'); f.querySelector('button').disabled = false; return; }
      s.rpc('log_event', { k: 'comentario', d: page, u: navigator.userAgent.slice(0, 120) }).catch(() => {});
      load();
    });
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('.c-item').dataset.id;
      if (!confirm('Excluir seu comentário?')) return;
      await s.from('comments').delete().eq('id', id);
      load();
    }));
  }
  load();
}
