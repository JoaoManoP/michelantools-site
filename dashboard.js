import { sb, session, isAdmin, configured, explain, esc } from './account.js';
const app = document.getElementById('app');
const state = { rows: [], logs: [], filter: 'pendente', q: '' };

function gate(html) { app.innerHTML = '<div class="acct-card" style="max-width:520px;margin:64px auto">' + html + '</div>'; }

async function login() {
  gate(`<h2>Painel restrito</h2><p class="muted">Entre com a conta de administrador.</p>
    <form id="f" class="form"><label>E-mail<input name="email" type="email" required autocomplete="email"></label>
    <label>Senha<input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn primary">Entrar</button></form>`);
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { error } = await (await sb()).auth.signInWithPassword({ email: d.email, password: d.password });
    if (error) return e.target.insertAdjacentHTML('beforebegin', '<div class="note err">' + esc(explain(error)) + '</div>');
    boot();
  });
}

async function load() {
  const s = await sb();
  const [{ data: rows, error }, { data: logs }, { data: notes }] = await Promise.all([
    s.from('profiles').select('*').order('created_at', { ascending: false }),
    s.from('download_log').select('*').gte('at', new Date(Date.now() - 30 * 864e5).toISOString()).order('at', { ascending: false }).limit(500),
    s.from('admin_notes').select('user_id, notes')
  ]);
  if (error) throw error;
  state.notes = Object.fromEntries((notes || []).map((n) => [n.user_id, n.notes]));
  state.rows = rows || [];
  state.logs = logs || [];
}

function spark(logs) {
  // downloads por dia nos últimos 14 dias
  const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); return d.toISOString().slice(0, 10); });
  const n = days.map((d) => logs.filter((l) => l.at.slice(0, 10) === d).length);
  const max = Math.max(1, ...n);
  return '<div class="spark" role="img" aria-label="Downloads por dia, últimos 14 dias">' + n.map((v, i) => '<i style="height:' + Math.max(4, (v / max) * 100) + '%" title="' + days[i].split('-').reverse().slice(0, 2).join('/') + ': ' + v + '"></i>').join('') + '</div>';
}

function render() {
  const r = state.rows;
  const count = (st) => r.filter((x) => x.status === st).length;
  const week = state.logs.filter((l) => Date.now() - new Date(l.at) < 7 * 864e5).length;
  const q = state.q.toLowerCase();
  const list = r.filter((x) => (state.filter === 'todos' || x.status === state.filter) && (!q || (x.name + ' ' + x.email + ' ' + x.use_case).toLowerCase().includes(q)));
  const dlBy = (id) => state.logs.filter((l) => l.user_id === id).length;
  app.innerHTML = `
    <div class="dash-head"><div><span class="label">Acesso antecipado</span><h1>Painel</h1></div><button class="btn small" id="reload">Atualizar</button></div>
    <div class="stats">
      <div><span>Pedidos</span><b>${r.length}</b></div>
      <div class="warn"><span>Aguardando</span><b>${count('pendente')}</b></div>
      <div class="ok"><span>Aprovados</span><b>${count('aprovado')}</b></div>
      <div><span>Downloads em 7 dias</span><b>${week}</b>${spark(state.logs)}</div>
    </div>
    <div class="dash-tools">
      <div class="seg-tabs">${['pendente', 'aprovado', 'recusado', 'todos'].map((f) => `<button data-f="${f}" aria-selected="${state.filter === f}">${{ pendente: 'Aguardando', aprovado: 'Aprovados', recusado: 'Recusados', todos: 'Todos' }[f]}</button>`).join('')}</div>
      <input type="search" id="q" placeholder="Buscar por nome, e-mail ou uso" value="${esc(state.q)}">
    </div>
    <div class="rows">
      ${list.length ? list.map((x) => `
      <article class="row-card" data-id="${x.id}">
        <div class="who"><b>${esc(x.name || '(sem nome)')}</b><span>${esc(x.email)}</span><span class="muted">${new Date(x.created_at).toLocaleString('pt-BR')} · ${esc(x.os)}${dlBy(x.id) ? ' · ' + dlBy(x.id) + ' download(s)' : ''}</span></div>
        <p class="use">${x.use_case ? esc(x.use_case) : '<span class="muted">Não contou como vai usar.</span>'}</p>
        <div class="acts">
          <span class="chip s-${x.status}">${{ pendente: 'Aguardando', aprovado: 'Aprovado', recusado: 'Recusado' }[x.status]}</span>
          <select data-k="plan" aria-label="Plano"><option value="lite" ${x.plan === 'lite' ? 'selected' : ''}>Lite</option><option value="completo" ${x.plan === 'completo' ? 'selected' : ''}>Completo</option></select>
          ${x.status !== 'aprovado' ? '<button class="btn small primary" data-st="aprovado">Aprovar</button>' : ''}
          ${x.status !== 'recusado' ? '<button class="btn small" data-st="recusado">Recusar</button>' : ''}
          ${x.status !== 'pendente' ? '<button class="btn small" data-st="pendente">Voltar para análise</button>' : ''}
        </div>
        <textarea data-k="notes" rows="1" placeholder="Anotação (só você vê)">${esc((state.notes || {})[x.id] || '')}</textarea>
      </article>`).join('') : '<div class="empty-state">Nada por aqui neste filtro.</div>'}
    </div>`;
  app.querySelector('#reload').onclick = () => boot();
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { state.filter = b.dataset.f; render(); }));
  const qi = app.querySelector('#q');
  qi.oninput = () => { state.q = qi.value; const pos = qi.selectionStart; render(); const n = app.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  app.querySelectorAll('.row-card').forEach((card) => {
    const id = card.dataset.id;
    const save = async (patch) => {
      const { error } = await (await sb()).from('profiles').update(patch).eq('id', id);
      if (error) return alert(explain(error));
      Object.assign(state.rows.find((x) => x.id === id), patch);
      render();
    };
    card.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => save({ status: b.dataset.st })));
    card.querySelector('[data-k=plan]').onchange = (e) => save({ plan: e.target.value });
    card.querySelector('[data-k=notes]').onchange = async (e) => {
      const notes = e.target.value.slice(0, 1000);
      const { error } = await (await sb()).from('admin_notes').upsert({ user_id: id, notes, updated_at: new Date().toISOString() });
      if (error) return alert(explain(error));
      (state.notes = state.notes || {})[id] = notes;
    };
  });
}

async function boot() {
  if (!configured) return gate('<h2>Painel ainda não configurado</h2><p class="muted">Preencha <code>config.js</code> com o endereço e a chave pública do projeto Supabase e rode <code>supabase/schema.sql</code>.</p>');
  try {
    if (!(await session())) return login();
    if (!(await isAdmin())) {
      document.getElementById('out').hidden = false;
      return gate('<h2>Área restrita</h2><p class="muted">Esta conta não tem permissão de administrador.</p>');
    }
    document.getElementById('out').hidden = false;
    await load();
    render();
  } catch (err) {
    gate('<div class="note err">' + esc(explain(err)) + '</div>');
  }
}
document.getElementById('out').onclick = async () => { await (await sb()).auth.signOut(); location.reload(); };
boot();
