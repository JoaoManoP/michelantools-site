import { sb, session, myProfile, configured, explain, esc } from './account.js';
import { downloadRelease } from './release.js';
const root = document.getElementById('app');
let tab = location.hash === '#entrar' ? 'login' : 'signup';

function msg(kind, text) {
  return '<div class="note ' + kind + '">' + esc(text) + '</div>';
}

function renderClosed() {
  root.innerHTML = '<h2>Cadastro abre em breve</h2><p class="muted">O sistema de contas está sendo preparado. Volte em alguns dias.</p>';
}

function renderForms(note = '') {
  root.innerHTML = `
    <div class="seg-tabs" role="tablist">
      <button role="tab" aria-selected="${tab === 'signup'}" data-t="signup">Criar conta</button>
      <button role="tab" aria-selected="${tab === 'login'}" data-t="login">Entrar</button>
    </div>
    ${note}
    ${tab === 'signup' ? `
    <form id="f" class="form" novalidate>
      <label>Nome<input name="name" autocomplete="name" required maxlength="120"></label>
      <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
      <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required><small>Pelo menos 8 caracteres.</small></label>
      <label>Seu computador<select name="os"><option value="windows">Windows 10 ou 11</option><option value="mac">Mac</option><option value="linux">Linux</option></select><small>O programa é para Windows. Quem marca Mac ou Linux recebe aviso quando houver versão.</small></label>
      <label class="check"><input type="checkbox" name="aceite" required> <span>Li e aceito os <a href="../termos/" target="_blank">Termos de uso</a> e a <a href="../privacidade/" target="_blank">Política de Privacidade</a>.</span></label>
      <button class="btn primary" type="submit">Criar conta e baixar o Lite</button>
      <p class="fine">A conta serve para baixar o Lite, guardar sua chave PRO e falar com o suporte. Usamos seu e-mail só para isso. Nada de propaganda.</p>
    </form>` : `
    <form id="f" class="form" novalidate>
      <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
      <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn primary" type="submit">Entrar</button>
      <button class="linkish" type="button" id="forgot">Esqueci a senha</button>
    </form>`}`;
  root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; renderForms(); }));
  const f = root.querySelector('#f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const s = await sb();
      if (tab === 'signup') {
        if (!d.name.trim()) throw new Error('Preencha seu nome.');
        if (!d.aceite) throw new Error('Para criar a conta é preciso aceitar os Termos de uso e a Política de Privacidade.');
        const { data, error } = await s.auth.signUp({ email: d.email.trim(), password: d.password, options: { data: { name: d.name.trim(), os: d.os }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) return renderForms(msg('ok', 'Conta criada. Enviamos um link de confirmação para ' + d.email + '. Depois de confirmar, volte aqui e entre.'));
      } else {
        const { error } = await s.auth.signInWithPassword({ email: d.email.trim(), password: d.password });
        if (error) throw error;
      }
      await render();
    } catch (err) {
      btn.disabled = false;
      const old = root.querySelector('.note');
      if (old) old.remove();
      f.insertAdjacentHTML('beforebegin', msg('err', explain(err)));
    }
  });
  const forgot = root.querySelector('#forgot');
  if (forgot) forgot.addEventListener('click', async () => {
    const email = f.querySelector('[name=email]').value.trim();
    if (!email) return f.insertAdjacentHTML('beforebegin', msg('err', 'Digite seu e-mail no campo acima e clique de novo.'));
    const s = await sb();
    const { error } = await s.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    renderForms(error ? msg('err', explain(error)) : msg('ok', 'Se houver conta com ' + email + ', você vai receber um link para criar uma senha nova.'));
  });
}

// botão de download de um canal (lite ou completo) com progresso e conferência
function wireDownload(btn, channel, fileLabel) {
  if (!btn) return;
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await downloadRelease(await sb(), (p) => (btn.textContent = p === 'verificando' ? 'Conferindo o arquivo…' : 'Baixando… ' + p + '%'), channel);
      (await sb()).rpc('log_event', { k: 'download', d: channel, u: navigator.userAgent.slice(0, 120) }).catch(() => {});
      btn.textContent = label;
      btn.insertAdjacentHTML('afterend', msg('ok', 'Download conferido e salvo. Abra o ' + fileLabel + ' na pasta Downloads.'));
    } catch (err) {
      btn.textContent = label;
      btn.insertAdjacentHTML('afterend', msg('err', /not found|Object not found/i.test(String(err.message)) ? 'Este instalador ainda está sendo preparado. Tente mais tarde.' : explain(err)));
    } finally {
      btn.disabled = false;
    }
  });
}

const AI_LABEL = { imagem: 'Imagem', video: 'Imagem → vídeo', fundo: 'Remover fundo', ampliar: 'Ampliar', preencher: 'Preencher área', comando: 'Comando' };
const AI_STATUS = { fila: 'na fila', processando: 'gerando', pronto: 'pronto', erro: 'erro', estornado: 'estornado (créditos devolvidos)' };
async function renderArea(p) {
  const pro = p.plan === 'completo';
  // a chave válida mais recente vem da tabela de chaves; o perfil é só espelho
  try { const { data: lic } = await (await sb()).rpc('my_license'); if (lic && lic.key) p.license_key = lic.key; } catch {}
  try { const { data: pays } = await (await sb()).from('payments').select('created_at, period, status, amount_cents, live').order('created_at', { ascending: false }).limit(10); p.pays = pays || []; } catch { p.pays = []; }
  // IA: saldo do mês e últimos pedidos (supabase/ia.sql); sem as tabelas, o bloco some
  try { const { data: cr } = await (await sb()).rpc('my_credits'); p.ai = cr || null; } catch { p.ai = null; }
  try { const { data: jobs } = await (await sb()).from('ai_jobs').select('created_at, kind, status, cost, prompt').order('created_at', { ascending: false }).limit(10); p.aiJobs = jobs || []; } catch { p.aiJobs = []; }
  (await sb()).rpc('log_event', { k: 'login', d: 'conta', u: navigator.userAgent.slice(0, 120) }).catch(() => {});
  root.innerHTML = `
    <div class="area-head"><div><span class="muted">Minha conta</span><h2>Olá, ${esc(p.name || p.email)}</h2></div><button class="btn small" id="out">Sair</button></div>
    <dl class="kv">
      <div><dt>Plano</dt><dd>${pro ? 'PRO' : 'Lite (grátis)'}</dd></div>
      <div><dt>E-mail</dt><dd>${esc(p.email)}</dd></div>
      <div><dt>Conta criada em</dt><dd>${new Date(p.created_at).toLocaleDateString('pt-BR')}</dd></div>
    </dl>
    <div class="dl-block"><b>Milens Lite</b><p class="muted">Edição, câmera, animações, cor e áudio. Exporta MP4 até 1080p com marca d'água. Grátis.</p><button class="btn primary" id="dl-lite">Baixar o Lite (Windows)</button></div>
    ${pro
      ? `<div class="dl-block pro"><b>Milens PRO</b><p class="muted">Tudo do Lite, mais Imagem, 3D, plugins, efeitos premium, 4K, HEVC e ProRes, sem marca d'água.</p><button class="btn primary" id="dl-pro">Baixar o PRO (Windows)</button></div>
         ${p.license_key ? `<div class="lic"><b>Sua chave de ativação</b><textarea id="lk" class="mono" readonly rows="3">${esc(p.license_key)}</textarea><button class="btn small" id="cpk">Copiar chave</button><p class="fine">Instale o PRO e, no programa, vá em Preferências (Ctrl+,) → Licença premium → cole a chave → Ativar.</p></div>` : '<div class="note">Sua chave de ativação está sendo gerada. Volte em instantes.</div>'}`
      : `<div class="dl-block pro off"><b>Milens PRO</b><p class="muted">Imagem, 3D, plugins, efeitos premium (LUT, chroma key, brilho), 4K, HEVC e ProRes, sem marca d'água. Liberado por plano, com chave de ativação que aparece aqui.</p><a class="btn primary" href="../planos/">Ver planos e assinar</a></div>`}
    ${p.ai && p.ai.pro ? `<div class="dl-block"><b>Créditos de IA</b><p class="muted"><b>${p.ai.left_month} de ${p.ai.allowance}</b> deste mês · ${p.ai.extra} extras · renova em ${new Date(p.ai.reset_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>${p.aiJobs.length ? p.aiJobs.map((j) => `<p class="muted">${new Date(j.created_at).toLocaleDateString('pt-BR')} · ${esc(AI_LABEL[j.kind] || j.kind)} · ${j.cost} crédito(s) · ${esc(AI_STATUS[j.status] || j.status)}${j.prompt ? ' · “' + esc(j.prompt.slice(0, 60)) + '”' : ''}</p>`).join('') : '<p class="fine">Nenhum pedido ainda. No programa: Ctrl+Alt+I (gerar) ou Ctrl+Shift+Espaço (comando).</p>'}<a class="btn small" href="../ia/">Comprar créditos extras</a></div>` : ''}
    ${p.pays && p.pays.length ? `<div class="dl-block"><b>Seus pagamentos</b>${p.pays.map((y) => `<p class="muted">${new Date(y.created_at).toLocaleDateString('pt-BR')} · ${y.period} · ${y.status}${y.live ? '' : ' (teste)'} · ${(y.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>`).join('')}</div>` : ''}
    <p class="fine">Os downloads são pessoais, usam links que expiram em 5 minutos e são conferidos pela impressão digital (SHA-256) antes de salvar. Se o Windows avisar "Editor desconhecido", clique em "Mais informações" e em "Executar assim mesmo".</p>
    <div class="dl-block"><b>Seus dados</b><p class="muted">Guardamos nome, e-mail, plano, chave e seus chamados e comentários. Nada dos seus projetos. <a href="../privacidade/">Política de Privacidade</a> · <a href="../termos/">Termos</a> · <a href="../licenca/">Licença do PRO</a></p><div class="row"><button class="btn small" id="export-data">Baixar meus dados (JSON)</button><button class="btn small danger" id="del-acc">Pedir exclusão da conta</button></div></div>`;
  root.querySelector('#export-data').addEventListener('click', async () => {
    const s = await sb();
    const [t, c] = await Promise.all([s.from('support_tickets').select('*'), s.from('comments').select('*')]);
    const blob = new Blob([JSON.stringify({ perfil: p, chamados: t.data || [], comentarios: c.data || [], ia_pedidos: p.aiJobs || [] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'milens-meus-dados.json'; document.body.append(a); a.click(); a.remove();
  });
  root.querySelector('#del-acc').addEventListener('click', async () => {
    if (!confirm('Pedir a exclusão da conta? Perfil, chaves, chamados e comentários são apagados em até 7 dias. Uma chave PRO ativa deixa de valer.')) return;
    const { error } = await (await sb()).rpc('open_ticket', { t: 'outro', m: 'Solicito a exclusão da minha conta e dos meus dados (LGPD, art. 18).', v: '' });
    alert(error ? explain(error) : 'Pedido registrado. Você recebe a confirmação por e-mail em até 7 dias.');
  });
  const cpk = root.querySelector('#cpk');
  if (cpk) cpk.addEventListener('click', async () => { try { await navigator.clipboard.writeText(p.license_key); cpk.textContent = 'Copiada'; } catch { root.querySelector('#lk').select(); } });
  root.querySelector('#out').addEventListener('click', async () => { (await sb()).auth.signOut(); tab = 'login'; renderForms(); });
  wireDownload(root.querySelector('#dl-lite'), 'lite', 'Milens-Lite-Setup.exe');
  wireDownload(root.querySelector('#dl-pro'), 'completo', 'Milens-Setup.exe');
}

async function render() {
  if (!configured) return renderClosed();
  try {
    const ses = await session();
    if (!ses) return renderForms();
    const p = await myProfile();
    if (!p) return renderForms(msg('err', 'Sua conta existe, mas o perfil não foi criado. Saia e entre de novo; se continuar, avise o suporte.'));
    return renderArea(p);
  } catch (err) {
    root.innerHTML = msg('err', explain(err));
  }
}
render();
