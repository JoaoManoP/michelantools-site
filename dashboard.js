// Painel do dono: visão geral, contas, chaves, pagamentos, acessos, chamados, instaladores e relatórios em CSV.
// Só entra quem está na tabela admins; tudo passa pelas regras do banco (RLS), o painel não tem segredo nenhum.
import { sb, session, isAdmin, configured, explain, esc } from './account.js';
import { releaseStatus, uploadRelease, CHANNELS } from './release.js';
const app = document.getElementById('app');
const state = { tab: location.hash.replace('#', '') || 'visao', q: '', ov: null, rows: [], notes: {}, licenses: [], payments: [], events: [], tickets: [], audit: [], logs: [], comments: [] };
const TOPIC = { instalacao: 'Instalação', uso: 'Uso do programa', exportacao: 'Exportação', sugestao: 'Sugestão', outro: 'Outro' };
const brl = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const day = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');
const TABS = [['visao', 'Visão geral'], ['contas', 'Contas'], ['chaves', 'Chaves'], ['pagamentos', 'Pagamentos'], ['acessos', 'Acessos'], ['chamados', 'Chamados'], ['instaladores', 'Instaladores'], ['comentarios', 'Comentários'], ['auditoria', 'Auditoria']];

function gate(html) { app.innerHTML = '<div class="acct-card" style="max-width:520px;margin:64px auto">' + html + '</div>'; }
function login() {
  gate('<h2>Painel restrito</h2><p class="muted">Entre com a conta de administrador.</p><form id="f" class="form"><label>E-mail<input name="email" type="email" required autocomplete="email"></label><label>Senha<input name="password" type="password" required autocomplete="current-password"></label><button class="btn primary" type="submit">Entrar</button></form>');
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
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [ov, rows, notes, lic, pay, ev, tk, au, lg, cm] = await Promise.all([
    s.rpc('admin_overview'),
    s.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000),
    s.from('admin_notes').select('user_id, notes'),
    s.from('licenses').select('*').order('issued_at', { ascending: false }).limit(500),
    s.from('payments').select('*').order('created_at', { ascending: false }).limit(500),
    s.from('events').select('*').order('at', { ascending: false }).limit(500),
    s.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(300),
    s.from('audit_log').select('*').order('at', { ascending: false }).limit(300),
    s.from('download_log').select('*').gte('at', since30).order('at', { ascending: false }).limit(1000),
    s.from('comments').select('*').order('created_at', { ascending: false }).limit(300)
  ]);
  if (rows.error) throw rows.error;
  state.ov = ov.data || {};
  state.rows = rows.data || [];
  state.notes = Object.fromEntries((notes.data || []).map((n) => [n.user_id, n.notes]));
  state.licenses = lic.data || [];
  state.payments = pay.data || [];
  state.events = ev.data || [];
  state.tickets = tk.data || [];
  state.audit = au.data || [];
  state.logs = lg.data || [];
  state.comments = cm.data || [];
}

const who = (id) => state.rows.find((x) => x.id === id) || {};
const emailOf = (id) => who(id).email || '—';

// ---------- CSV ----------
function csv(name, headers, rows) {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const text = '﻿' + [headers.map(q).join(';'), ...rows.map((r) => r.map(q).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = 'milens-' + name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
const EXPORTS = {
  contas: () => csv('contas', ['E-mail', 'Nome', 'Plano', 'SO', 'Criada em', 'Chave'], state.rows.map((x) => [x.email, x.name, x.plan, x.os, when(x.created_at), x.license_key ? x.license_key.slice(0, 16) + '…' : ''])),
  chaves: () => csv('chaves', ['ID', 'E-mail', 'Período', 'Origem', 'Emitida', 'Vence', 'Revogada', 'Motivo'], state.licenses.map((l) => [l.id, l.email, l.period, l.source, when(l.issued_at), when(l.expires_at), when(l.revoked_at), l.revoked_reason])),
  pagamentos: () => csv('pagamentos', ['Data', 'E-mail', 'Tipo', 'Período', 'Status', 'Valor', 'Líquido', 'Moeda', 'Modo', 'Provedor', 'Ref.'], state.payments.map((p) => [when(p.created_at), p.email, p.kind, p.period, p.status, (p.amount_cents / 100).toFixed(2), (p.net_cents / 100).toFixed(2), p.currency, p.live ? 'real' : 'teste', p.provider, p.provider_id])),
  acessos: () => csv('acessos', ['Data', 'E-mail', 'Evento', 'Detalhe', 'Navegador'], state.events.map((e) => [when(e.at), emailOf(e.user_id), e.kind, e.detail, e.ua])),
  downloads: () => csv('downloads', ['Data', 'E-mail', 'Arquivo'], state.logs.map((l) => [when(l.at), emailOf(l.user_id), l.file])),
  comentarios: () => csv('comentarios', ['Data', 'E-mail', 'Página', 'Status', 'Texto'], state.comments.map((c) => [when(c.created_at), emailOf(c.user_id), c.page, c.status, c.body])),
  chamados: () => csv('chamados', ['Aberto em', 'E-mail', 'Assunto', 'Status', 'Mensagem', 'Resposta'], state.tickets.map((t) => [when(t.created_at), emailOf(t.user_id), TOPIC[t.topic] || t.topic, t.status, t.message, t.reply]))
};

// ---------- gráfico de 30 dias (barras) ----------
function chart(rows, key, color) {
  const max = Math.max(1, ...rows.map((r) => Number(r[key]) || 0));
  return '<div class="spark" role="img" aria-label="' + key + ' por dia, 30 dias">' + rows.map((r) => '<i style="height:' + Math.max(3, (Number(r[key]) / max) * 100) + '%;background:' + color + '" title="' + r.dia.split('-').reverse().join('/') + ': ' + (key === 'receita' ? brl(r.receita) : r[key]) + '"></i>').join('') + '</div>';
}

// ---------- abas ----------
function visao() {
  const o = state.ov || {};
  const d = o.por_dia || [];
  const semChave = state.rows.filter((x) => x.plan === 'completo' && !x.license_key);
  return `
    <div class="stats">
      <div><span>Contas</span><b>${o.contas ?? 0}</b><small class="muted">${o.novas_7d ?? 0} novas em 7 dias</small></div>
      <div class="ok"><span>PRO ativos</span><b>${o.pro ?? 0}</b><small class="muted">${o.chaves_ativas ?? 0} chaves válidas · ${o.chaves_revogadas ?? 0} revogadas</small></div>
      <div><span>Receita (30 dias)</span><b>${brl(o.receita_30d)}</b><small class="muted">total ${brl(o.receita_total)} · teste ${brl(o.receita_teste)}</small></div>
      <div class="${(o.chamados_abertos || 0) > 0 ? 'warn' : ''}"><span>Chamados abertos</span><b>${o.chamados_abertos ?? 0}</b><small class="muted">${o.logins_7d ?? 0} logins em 7 dias</small></div>
    </div>
    ${semChave.length ? `<div class="note err">${semChave.length} conta(s) com plano PRO <b>sem chave</b>: ${semChave.map((x) => esc(x.email)).join(', ')}. Emita em Chaves.</div>` : ''}
    <div class="grid2">
      <div class="panel"><h3>Downloads por dia</h3>${chart(d, 'downloads', 'var(--b)')}<p class="muted">${o.downloads_30d ?? 0} em 30 dias · ${o.downloads_7d ?? 0} em 7 dias</p></div>
      <div class="panel"><h3>Cadastros por dia</h3>${chart(d, 'cadastros', 'var(--g)')}</div>
      <div class="panel"><h3>Logins por dia</h3>${chart(d, 'logins', 'var(--ink-3)')}</div>
      <div class="panel"><h3>Receita por dia (real)</h3>${chart(d, 'receita', 'var(--rec)')}</div>
    </div>
    <div class="panel"><h3>Relatórios (CSV, abre no Excel)</h3><div class="acts">${Object.keys(EXPORTS).map((k) => `<button class="btn small" data-csv="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
    <div class="panel"><h3>Atalhos do dono</h3><div class="acts">
      <a class="btn small" href="https://supabase.com/dashboard/project/rihngufbfpllobmmzfgc/editor" target="_blank" rel="noopener">Banco de dados (Supabase)</a>
      <a class="btn small" href="https://supabase.com/dashboard/project/rihngufbfpllobmmzfgc/auth/users" target="_blank" rel="noopener">Usuários (Auth)</a>
      <a class="btn small" href="https://supabase.com/dashboard/project/rihngufbfpllobmmzfgc/storage/buckets/releases" target="_blank" rel="noopener">Arquivos (bucket)</a>
      <a class="btn small" href="https://dashboard.stripe.com/test/payments" target="_blank" rel="noopener">Stripe (teste)</a>
      <a class="btn small" href="https://github.com/JoaoManoP/Milens" target="_blank" rel="noopener">Código (GitHub)</a>
    </div></div>`;
}

function contas() {
  const q = state.q.toLowerCase();
  const list = state.rows.filter((x) => !q || (x.name + ' ' + x.email).toLowerCase().includes(q));
  const dl = (id) => state.logs.filter((l) => l.user_id === id).length;
  return `
    <div class="dash-tools"><input type="search" id="q" placeholder="Buscar por nome ou e-mail" value="${esc(state.q)}"><button class="btn small" data-csv="contas">CSV</button></div>
    <div class="rows">${list.length ? list.map((x) => `
      <article class="row-card" data-id="${x.id}">
        <div class="who"><b>${esc(x.name || '(sem nome)')}</b><span>${esc(x.email)}</span><span class="muted">${when(x.created_at)} · ${esc(x.os)}${dl(x.id) ? ' · ' + dl(x.id) + ' download(s)' : ''}</span>${x.plan === 'completo' ? '<span class="chip-st on">PRO</span>' : '<span class="chip-st">Lite</span>'}</div>
        <div class="acts">
          <select data-k="plan" aria-label="Plano"><option value="lite" ${x.plan === 'lite' ? 'selected' : ''}>Lite</option><option value="completo" ${x.plan === 'completo' ? 'selected' : ''}>PRO</option></select>
          <input data-k="key" class="mono" placeholder="Chave de ativação (ou emita em Chaves)" value="${esc(x.license_key || '')}">
        </div>
        <textarea data-k="notes" rows="1" placeholder="Anotação (só você vê)">${esc(state.notes[x.id] || '')}</textarea>
      </article>`).join('') : '<div class="empty-state">Nenhuma conta encontrada.</div>'}</div>`;
}

function chaves() {
  const now = Date.now();
  const st = (l) => (l.revoked_at ? ['Revogada', ''] : l.expires_at && new Date(l.expires_at) < now ? ['Vencida', ''] : ['Válida', ' on']);
  return `
    <div class="panel"><h3>Emitir chave manualmente</h3>
      <p class="muted">Gere no seu computador com <code>node scripts/licenca.js emitir e-mail [dias]</code> e cole aqui. Quando o pagamento estiver no ar, o webhook do Stripe emite sozinho.</p>
      <form id="issue" class="form issue-form">
        <label>Conta<select name="user">${state.rows.map((x) => `<option value="${x.id}">${esc(x.email)}</option>`).join('')}</select></label>
        <label>Chave MT1<input name="key" class="mono" required placeholder="MT1.…"></label>
        <label>Período<select name="period"><option value="vitalicio">vitalício</option><option value="anual">anual</option><option value="mensal">mensal</option><option value="teste">teste</option></select></label>
        <button class="btn small primary" type="submit">Registrar e ativar</button>
      </form></div>
    <div class="dash-tools"><span class="muted">${state.licenses.length} chave(s)</span><button class="btn small" data-csv="chaves">CSV</button></div>
    <div class="rows">${state.licenses.map((l) => { const [label, on] = st(l); return `
      <article class="row-card" data-lid="${l.id}">
        <div class="who"><b class="mono">${esc(l.id)}</b><span>${esc(l.email)}</span><span class="muted">${l.period} · ${l.source} · emitida ${when(l.issued_at)}${l.expires_at ? ' · vence ' + day(l.expires_at) : ' · sem validade'}</span><span class="chip-st${on}">${label}</span></div>
        ${l.revoked_at ? `<p class="muted">Revogada em ${when(l.revoked_at)}: ${esc(l.revoked_reason)}</p>` : `<div class="acts"><button class="btn small" data-act="copy">Copiar chave</button><button class="btn small" data-act="revoke">Revogar</button></div>`}
      </article>`; }).join('') || '<div class="empty-state">Nenhuma chave emitida ainda.</div>'}</div>`;
}

function pagamentos() {
  const paid = state.payments.filter((p) => p.status === 'pago');
  const live = paid.filter((p) => p.live);
  const sum = (a) => a.reduce((t, p) => t + (p.net_cents || 0), 0);
  const byPeriod = (per) => live.filter((p) => p.period === per).length;
  return `
    <div class="stats">
      <div><span>Receita líquida (real)</span><b>${brl(sum(live))}</b><small class="muted">${live.length} pagamento(s)</small></div>
      <div><span>Em modo de teste</span><b>${brl(sum(paid.filter((p) => !p.live)))}</b><small class="muted">${paid.length - live.length} pagamento(s)</small></div>
      <div><span>Assinaturas</span><b>${byPeriod('mensal') + byPeriod('anual')}</b><small class="muted">${byPeriod('mensal')} mensais · ${byPeriod('anual')} anuais</small></div>
      <div><span>Vitalícios</span><b>${byPeriod('vitalicio')}</b></div>
    </div>
    <div class="dash-tools"><span class="muted">${state.payments.length} registro(s)</span><button class="btn small" data-csv="pagamentos">CSV</button></div>
    <table class="tbl"><thead><tr><th>Data</th><th>E-mail</th><th>Tipo</th><th>Status</th><th>Valor</th><th>Modo</th><th>Ref.</th></tr></thead><tbody>
      ${state.payments.map((p) => `<tr><td>${when(p.created_at)}</td><td>${esc(p.email)}</td><td>${p.kind} · ${p.period}</td><td><span class="chip-st${p.status === 'pago' ? ' on' : ''}">${p.status}</span></td><td>${brl(p.amount_cents)}</td><td>${p.live ? 'real' : 'teste'}</td><td class="mono">${esc(String(p.provider_id || '').slice(0, 22))}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nenhum pagamento ainda. Quando o Stripe estiver ligado, cada compra aparece aqui.</td></tr>'}
    </tbody></table>`;
}

function acessos() {
  const all = [...state.events.map((e) => ({ at: e.at, who: emailOf(e.user_id), kind: e.kind, detail: (e.detail || '') + (e.ua ? ' · ' + e.ua.slice(0, 60) : '') })), ...state.logs.map((l) => ({ at: l.at, who: emailOf(l.user_id), kind: 'download', detail: l.file }))].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 300);
  return `
    <div class="dash-tools"><span class="muted">${state.events.length} evento(s) recentes · ${state.logs.length} download(s) em 30 dias</span><button class="btn small" data-csv="acessos">CSV de eventos</button><button class="btn small" data-csv="downloads">CSV de downloads</button></div>
    <table class="tbl"><thead><tr><th>Quando</th><th>Quem</th><th>Evento</th><th>Detalhe</th></tr></thead><tbody>
      ${all.map((e) => `<tr><td>${when(e.at)}</td><td>${esc(e.who)}</td><td><span class="chip-st">${esc(e.kind)}</span></td><td class="muted">${esc(e.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nada registrado ainda.</td></tr>'}
    </tbody></table>`;
}

function chamados() {
  const open = state.tickets.filter((k) => k.status !== 'fechado');
  return `
    <div class="dash-tools"><span class="muted">${open.length} aberto(s) · ${state.tickets.length} no total</span><button class="btn small" data-csv="chamados">CSV</button></div>
    <div class="tickets">${open.map((k) => `
      <article class="ticket ${k.status}" data-tid="${k.id}">
        <header><b>${esc(TOPIC[k.topic] || k.topic)}</b><span>${esc(emailOf(k.user_id))}</span><span class="muted">${when(k.created_at)}${k.app_version ? ' · v' + esc(k.app_version) : ''}</span><span class="chip-st${k.status === 'respondido' ? ' on' : ''}">${k.status === 'respondido' ? 'Respondido' : 'Aberto'}</span></header>
        <p>${esc(k.message)}</p>
        <textarea rows="2" maxlength="4000" placeholder="Sua resposta (a pessoa vê na página Suporte)">${esc(k.reply || '')}</textarea>
        <div class="acts"><button class="btn small primary" data-act="reply">Responder</button><button class="btn small" data-act="close">Fechar chamado</button></div>
      </article>`).join('') || '<div class="empty-state">Nenhum chamado aberto.</div>'}</div>`;
}

function instaladores() {
  return Object.entries(CHANNELS).map(([c, ch]) => `<div class="rel-box" data-rel="${c}"><b>Instalador ${ch.label || c}</b><span class="muted" data-rel-info>Verificando…</span><label class="btn small">Enviar novo instalador<input type="file" accept=".exe" data-rel-file hidden></label></div>`).join('') + '<p class="fine">Cada instalador vai em partes de 20 MB com SHA-256. O download na conta é conferido antes de salvar. Cotas: 3 por pessoa e 12 no total por dia.</p>';
}

function comentarios() {
  return `
    <div class="dash-tools"><span class="muted">${state.comments.length} comentário(s) · ${state.comments.filter((c) => c.status === 'oculto').length} oculto(s)</span></div>
    <div class="rows">${state.comments.map((c) => `
      <article class="row-card" data-cid="${c.id}">
        <div class="who"><b>${esc(c.name || '(sem nome)')}</b><span>${esc(emailOf(c.user_id))}</span><span class="muted">${when(c.created_at)} · página ${esc(c.page)}</span><span class="chip-st${c.status === 'visivel' ? ' on' : ''}">${c.status}</span></div>
        <p style="white-space:pre-wrap">${esc(c.body)}</p>
        <div class="acts" style="display:flex"><button class="btn small" data-act="toggle">${c.status === 'visivel' ? 'Ocultar' : 'Mostrar'}</button><button class="btn small" data-act="delc">Excluir</button></div>
      </article>`).join('') || '<div class="empty-state">Nenhum comentário ainda.</div>'}</div>`;
}

function auditoria() {
  return `<table class="tbl"><thead><tr><th>Quando</th><th>Ação</th><th>Alvo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>
    ${state.audit.map((a) => `<tr><td>${when(a.at)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td class="mono muted">${esc(a.before ? JSON.stringify(a.before) : '')}</td><td class="mono">${esc(a.after ? JSON.stringify(a.after) : '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhuma ação registrada ainda.</td></tr>'}
  </tbody></table>`;
}

function render() {
  const body = { visao, contas, chaves, pagamentos, acessos, chamados, instaladores, comentarios, auditoria }[state.tab] || visao;
  app.innerHTML = `
    <div class="dash-head"><div><span class="tag rec" id="rec-tag" title="">Painel do dono</span><h1>Milens</h1></div><div class="acts"><button class="btn small" id="reload">Atualizar</button></div></div>
    <nav class="seg-tabs dash-nav">${TABS.map(([id, l]) => `<button data-tab="${id}" aria-selected="${state.tab === id}">${l}</button>`).join('')}</nav>
    <section class="dash-body">${body()}</section>`;
  app.querySelector('#reload').onclick = () => boot();
  // segredo: 3 cliques na etiqueta REC abrem o Milens Arcana (o instalador fica na aba Instaladores, pasta arcana/)
  { let h = []; const tag = app.querySelector('#rec-tag'); if (tag) tag.onclick = () => { const n = Date.now(); h = h.filter((t) => n - t < 1500).concat(n); if (h.length >= 3) location.href = '../arcana/'; }; }
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; location.hash = state.tab; render(); }));
  app.querySelectorAll('[data-csv]').forEach((b) => (b.onclick = () => EXPORTS[b.dataset.csv]()));
  const qi = app.querySelector('#q');
  if (qi) qi.oninput = () => { state.q = qi.value; const pos = qi.selectionStart; render(); const n = app.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  // contas
  app.querySelectorAll('.row-card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    const save = async (patch) => {
      const { error } = await (await sb()).from('profiles').update(patch).eq('id', id);
      if (error) return alert(explain(error));
      Object.assign(state.rows.find((x) => x.id === id), patch);
    };
    card.querySelector('[data-k=plan]').onchange = (e) => save({ plan: e.target.value }).then(render);
    card.querySelector('[data-k=key]').onchange = (e) => save({ license_key: e.target.value.trim().slice(0, 4000) });
    card.querySelector('[data-k=notes]').onchange = async (e) => {
      const notes = e.target.value.slice(0, 1000);
      const { error } = await (await sb()).from('admin_notes').upsert({ user_id: id, notes, updated_at: new Date().toISOString() });
      if (error) return alert(explain(error));
      state.notes[id] = notes;
    };
  });
  // chaves
  const issue = app.querySelector('#issue');
  if (issue) issue.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(issue));
    const key = d.key.trim();
    const m = /^MT1\.([A-Za-z0-9_-]+)\./.exec(key);
    if (!m) return alert('Chave inválida: precisa começar com MT1.');
    let payload = {};
    try { payload = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return alert('Chave corrompida.'); }
    const u = who(d.user);
    const s = await sb();
    const ins = await s.from('licenses').insert({ id: payload.id || key.slice(-12), user_id: d.user, email: u.email, key, source: 'manual', period: d.period, expires_at: payload.exp ? new Date(payload.exp).toISOString() : null });
    if (ins.error) return alert(explain(ins.error));
    const up = await s.from('profiles').update({ plan: 'completo', license_key: key }).eq('id', d.user);
    if (up.error) return alert(explain(up.error));
    boot();
  };
  app.querySelectorAll('.row-card[data-lid]').forEach((card) => {
    const id = card.dataset.lid;
    const l = state.licenses.find((x) => x.id === id);
    const copy = card.querySelector('[data-act=copy]');
    if (copy) copy.onclick = () => navigator.clipboard.writeText(l.key).then(() => (copy.textContent = 'Copiada'));
    const rev = card.querySelector('[data-act=revoke]');
    if (rev) rev.onclick = async () => {
      const reason = prompt('Motivo da revogação (a pessoa perde o PRO):', 'vazamento');
      if (reason === null) return;
      const s = await sb();
      const r = await s.from('licenses').update({ revoked_at: new Date().toISOString(), revoked_reason: reason.slice(0, 200) }).eq('id', id);
      if (r.error) return alert(explain(r.error));
      await s.from('profiles').update({ plan: 'lite', license_key: '' }).eq('id', l.user_id);
      boot();
    };
  });
  // chamados
  app.querySelectorAll('.ticket').forEach((card) => {
    const id = Number(card.dataset.tid);
    const upd = async (patch) => {
      const { error } = await (await sb()).from('support_tickets').update(patch).eq('id', id);
      if (error) return alert(explain(error));
      Object.assign(state.tickets.find((x) => x.id === id), patch);
      render();
    };
    card.querySelector('[data-act=reply]').onclick = () => { const reply = card.querySelector('textarea').value.trim().slice(0, 4000); if (reply) upd({ reply, status: 'respondido', replied_at: new Date().toISOString() }); };
    card.querySelector('[data-act=close]').onclick = () => upd({ status: 'fechado' });
  });
  app.querySelectorAll('.row-card[data-cid]').forEach((card) => {
    const id = Number(card.dataset.cid);
    const c = state.comments.find((x) => x.id === id);
    card.querySelector('[data-act=toggle]').onclick = async () => { const r = await (await sb()).from('comments').update({ status: c.status === 'visivel' ? 'oculto' : 'visivel' }).eq('id', id); if (r.error) return alert(explain(r.error)); c.status = c.status === 'visivel' ? 'oculto' : 'visivel'; render(); };
    card.querySelector('[data-act=delc]').onclick = async () => { if (!confirm('Excluir este comentário?')) return; const r = await (await sb()).from('comments').delete().eq('id', id); if (r.error) return alert(explain(r.error)); state.comments = state.comments.filter((x) => x.id !== id); render(); };
  });
  releaseBox();
}

async function releaseBox() {
  const boxes = app.querySelectorAll('[data-rel]');
  if (!boxes.length) return;
  const s = await sb();
  for (const box of boxes) {
    const c = box.dataset.rel;
    const info = box.querySelector('[data-rel-info]');
    const input = box.querySelector('[data-rel-file]');
    const show = async () => {
      try {
        const st = await releaseStatus(s, c);
        info.textContent = st.parts.length ? `${st.parts.length} partes · ${(st.size / 1048576).toFixed(1)} MB · ${when(st.when)}${st.hasSha ? ' · SHA-256 ok' : ' · falta o SHA-256'}` : 'Nenhum instalador enviado ainda.';
      } catch (e) { info.textContent = explain(e); }
    };
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      input.disabled = true;
      try { await uploadRelease(s, f, (m) => (info.textContent = m), c); await show(); } catch (e) { info.textContent = 'Erro: ' + explain(e); } finally { input.disabled = false; input.value = ''; }
    };
    show();
  }
}

async function boot() {
  if (!configured) return gate('<h2>Painel ainda não configurado</h2><p class="muted">Preencha <code>config.js</code> e rode <code>supabase/schema.sql</code> e <code>supabase/financeiro.sql</code>.</p>');
  try {
    if (!(await session())) return login();
    document.getElementById('out').hidden = false;
    if (!(await isAdmin())) return gate('<h2>Sem acesso</h2><p class="muted">Esta conta não é administradora. Só o dono do projeto abre o painel.</p>');
    await load();
    render();
  } catch (err) {
    gate('<div class="note err">' + esc(explain(err)) + '</div>');
  }
}
document.getElementById('out').onclick = async () => { await (await sb()).auth.signOut(); location.reload(); };
addEventListener('hashchange', () => { const t = location.hash.replace('#', ''); if (TABS.some(([id]) => id === t)) { state.tab = t; render(); } });
boot();
