import { sb, session, isAdmin, configured, explain, esc } from './account.js';
import { liteStatus, uploadLite } from './release.js';
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
  const [{ data: rows, error }, { data: logs }, { data: notes }, { data: tickets }] = await Promise.all([
    s.from('profiles').select('*').order('created_at', { ascending: false }),
    s.from('download_log').select('*').gte('at', new Date(Date.now() - 30 * 864e5).toISOString()).order('at', { ascending: false }).limit(500),
    s.from('admin_notes').select('user_id, notes'),
    s.from('support_tickets').select('*').neq('status', 'fechado').order('created_at', { ascending: true }).limit(200)
  ]);
  if (error) throw error;
  state.notes = Object.fromEntries((notes || []).map((n) => [n.user_id, n.notes]));
  state.rows = rows || [];
  state.tickets = tickets || [];
  state.logs = logs || [];
}

function spark(logs) {
  // downloads por dia nos últimos 14 dias
  const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); return d.toISOString().slice(0, 10); });
  const n = days.map((d) => logs.filter((l) => l.at.slice(0, 10) === d).length);
  const max = Math.max(1, ...n);
  return '<div class="spark" role="img" aria-label="Downloads por dia, últimos 14 dias">' + n.map((v, i) => '<i style="height:' + Math.max(4, (v / max) * 100) + '%" title="' + days[i].split('-').reverse().slice(0, 2).join('/') + ': ' + v + '"></i>').join('') + '</div>';
}

const TOPIC = { instalacao: 'Instalação', uso: 'Uso do programa', exportacao: 'Exportação', sugestao: 'Sugestão', outro: 'Outro' };
function tickets() {
  const t = state.tickets || [];
  if (!t.length) return '<div class="tickets empty-state">Nenhum chamado aberto.</div>';
  const who = (id) => state.rows.find((x) => x.id === id) || {};
  return '<div class="tickets"><h2>Chamados (' + t.length + ')</h2>' + t.map((k) => `
    <article class="ticket ${k.status}" data-tid="${k.id}">
      <header><b>${esc(TOPIC[k.topic] || k.topic)}</b><span>${esc(who(k.user_id).email || '')}</span><span class="muted">${new Date(k.created_at).toLocaleString('pt-BR')}${k.app_version ? ' · v' + esc(k.app_version) : ''}</span><span class="chip-st${k.status === 'respondido' ? ' on' : ''}">${k.status === 'respondido' ? 'Respondido' : 'Aberto'}</span></header>
      <p>${esc(k.message)}</p>
      <textarea rows="2" maxlength="4000" placeholder="Sua resposta (a pessoa vê na página Suporte)">${esc(k.reply || '')}</textarea>
      <div class="acts"><button class="btn small primary" data-act="reply">Responder</button><button class="btn small" data-act="close">Fechar chamado</button></div>
    </article>`).join('') + '</div>';
}

// instalador Lite no bucket: estado atual e envio de uma versão nova (dividida em partes)
async function releaseBox() {
  const info = app.querySelector('[data-rel-info]');
  const input = app.querySelector('[data-rel-file]');
  if (!info) return;
  const s = await sb();
  const show = async () => {
    try {
      const st = await liteStatus(s);
      info.textContent = st.parts.length ? `${st.parts.length} partes · ${(st.size / 1048576).toFixed(1)} MB · ${new Date(st.when).toLocaleString('pt-BR')}${st.hasSha ? ' · SHA-256 ok' : ' · falta o SHA-256'}` : 'Nenhum instalador enviado ainda.';
    } catch (e) {
      info.textContent = explain(e);
    }
  };
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    input.disabled = true;
    try {
      await uploadLite(s, f, (m) => (info.textContent = m));
      await show();
    } catch (e) {
      info.textContent = 'Erro: ' + explain(e);
    } finally {
      input.disabled = false;
      input.value = '';
    }
  };
  show();
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
    <div class="rel-box" id="rel"><b>Instalador Lite</b><span class="muted" data-rel-info>Verificando…</span><label class="btn small">Enviar novo instalador<input type="file" accept=".exe" data-rel-file hidden></label></div>
    ${tickets()}
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
        <input data-k="key" class="mono" placeholder="Chave premium (gere com scripts/licenca.js e cole aqui)" value="${esc(x.license_key || '')}">
        <textarea data-k="notes" rows="1" placeholder="Anotação (só você vê)">${esc((state.notes || {})[x.id] || '')}</textarea>
      </article>`).join('') : '<div class="empty-state">Nada por aqui neste filtro.</div>'}
    </div>`;
  app.querySelector('#reload').onclick = () => boot();
  releaseBox();
  app.querySelectorAll('.ticket').forEach((card) => {
    const id = Number(card.dataset.tid);
    const upd = async (patch) => {
      const { error } = await (await sb()).from('support_tickets').update(patch).eq('id', id);
      if (error) return alert(explain(error));
      const k = state.tickets.find((x) => x.id === id);
      Object.assign(k, patch);
      if (patch.status === 'fechado') state.tickets = state.tickets.filter((x) => x.id !== id);
      render();
    };
    card.querySelector('[data-act=reply]').onclick = () => {
      const reply = card.querySelector('textarea').value.trim().slice(0, 4000);
      if (!reply) return;
      upd({ reply, status: 'respondido', replied_at: new Date().toISOString() });
    };
    card.querySelector('[data-act=close]').onclick = () => upd({ status: 'fechado' });
  });
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
    card.querySelector('[data-k=key]').onchange = (e) => save({ license_key: e.target.value.trim().slice(0, 4000) });
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
