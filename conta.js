import { sb, session, myProfile, configured, explain, esc, cfg } from './account.js';
const root = document.getElementById('app');
let tab = location.hash === '#entrar' ? 'login' : 'signup';

function msg(kind, text) {
  return '<div class="note ' + kind + '">' + esc(text) + '</div>';
}

function renderClosed() {
  root.innerHTML = '<h2>Cadastro abre em breve</h2><p class="muted">O sistema de contas está sendo preparado. Volte em alguns dias: a primeira rodada de teste começa assim que ele estiver no ar.</p>';
}

function renderForms(note = '') {
  root.innerHTML = `
    <div class="seg-tabs" role="tablist">
      <button role="tab" aria-selected="${tab === 'signup'}" data-t="signup">Pedir acesso</button>
      <button role="tab" aria-selected="${tab === 'login'}" data-t="login">Entrar</button>
    </div>
    ${note}
    ${tab === 'signup' ? `
    <form id="f" class="form" novalidate>
      <label>Nome<input name="name" autocomplete="name" required maxlength="120"></label>
      <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
      <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required><small>Pelo menos 8 caracteres.</small></label>
      <label>Seu computador<select name="os"><option value="windows">Windows 10 ou 11</option><option value="mac">Mac</option><option value="linux">Linux</option></select><small>Por enquanto o teste é só para Windows; Mac e Linux entram na lista de espera.</small></label>
      <label>Como você pretende usar?<textarea name="use_case" rows="3" maxlength="600" placeholder="Ex.: edito vídeos curtos para o meu canal e quero testar a câmera e os efeitos."></textarea></label>
      <button class="btn primary" type="submit">Pedir acesso</button>
      <p class="fine">Usamos seu e-mail só para o acesso e avisos do teste. Nada de propaganda.</p>
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
        const { data, error } = await s.auth.signUp({ email: d.email.trim(), password: d.password, options: { data: { name: d.name.trim(), use_case: d.use_case.trim(), os: d.os }, emailRedirectTo: location.origin + location.pathname } });
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

const STATUS = {
  pendente: ['Em análise', 'Recebemos seu pedido. Você vai ver a mudança aqui assim que ele for avaliado.', 'hourglass'],
  aprovado: ['Aprovado', 'Seu acesso está liberado. Baixe a versão do seu plano abaixo.', 'badge-check'],
  recusado: ['Não foi desta vez', 'As vagas desta rodada foram preenchidas. Seu pedido continua guardado para as próximas.', 'circle-slash']
};

async function renderArea(p) {
  const [label, text] = STATUS[p.status] || STATUS.pendente;
  root.innerHTML = `
    <div class="area-head"><div><span class="muted">Minha área</span><h2>Olá, ${esc(p.name || p.email)}</h2></div><button class="btn small" id="out">Sair</button></div>
    <div class="status-card s-${p.status}"><b>${label}</b><p>${text}</p></div>
    <dl class="kv">
      <div><dt>Plano</dt><dd>${p.plan === 'completo' ? 'Completo' : 'Lite (teste)'}</dd></div>
      <div><dt>E-mail</dt><dd>${esc(p.email)}</dd></div>
      <div><dt>Pedido em</dt><dd>${new Date(p.created_at).toLocaleDateString('pt-BR')}</dd></div>
    </dl>
    ${p.status === 'aprovado' ? `<button class="btn primary" id="dl">Baixar a versão Lite</button><p class="fine">O link é pessoal e expira em 5 minutos. Se o Windows avisar "Editor desconhecido", clique em "Mais informações" e em "Executar assim mesmo".</p>` : ''}`;
  root.querySelector('#out').addEventListener('click', async () => { (await sb()).auth.signOut(); tab = 'login'; renderForms(); });
  const dl = root.querySelector('#dl');
  if (dl) dl.addEventListener('click', async () => {
    dl.disabled = true;
    try {
      const s = await sb();
      const { data, error } = await s.storage.from('releases').createSignedUrl(cfg.liteFile, 300, { download: true });
      if (error) throw error;
      const { error: logErr } = await s.rpc('log_download', { f: cfg.liteFile });
      if (logErr) throw logErr;
      location.href = data.signedUrl;
    } catch (err) {
      dl.insertAdjacentHTML('afterend', msg('err', /not found|Object not found/i.test(String(err.message)) ? 'A versão Lite ainda está sendo preparada. Tente mais tarde.' : explain(err)));
    } finally {
      dl.disabled = false;
    }
  });
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
