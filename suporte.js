// Chamados de suporte: quem tem conta abre pelo formulário e acompanha a resposta aqui.
import { sb, session, configured, explain, esc } from './account.js';
const root = document.getElementById('sup-app');
const TOPIC = { instalacao: 'Instalação', uso: 'Uso do programa', exportacao: 'Exportação', sugestao: 'Sugestão', outro: 'Outro' };
const STATUS = { aberto: 'Aguardando resposta', respondido: 'Respondido', fechado: 'Encerrado' };

async function mine() {
  const { data, error } = await (await sb()).from('support_tickets').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

function list(items) {
  if (!items.length) return '';
  return '<h3 class="sup-h">Seus chamados</h3><div class="sup-list">' + items.map((k) => `
    <article class="sup-item ${k.status}">
      <header><b>${esc(TOPIC[k.topic] || k.topic)}</b><span class="chip-st${k.status === 'respondido' ? ' on' : ''}">${STATUS[k.status] || k.status}</span><span class="muted">${new Date(k.created_at).toLocaleDateString('pt-BR')}</span></header>
      <p>${esc(k.message)}</p>
      ${k.reply ? `<div class="sup-reply"><b>Resposta</b><p>${esc(k.reply)}</p></div>` : ''}
    </article>`).join('') + '</div>';
}

async function render(note = '') {
  if (!configured) {
    root.innerHTML = '<h3>O formulário abre junto com o cadastro</h3><p class="muted">Enquanto isso, as respostas para os problemas mais comuns estão logo acima e no <a href="../guia/">guia</a>.</p>';
    return;
  }
  if (!(await session())) {
    root.innerHTML = '<h3>Entre para abrir um chamado</h3><p class="muted">Os chamados ficam ligados à sua conta, assim a resposta aparece só para você.</p><a class="btn primary" href="../conta/#entrar">Entrar na minha conta</a>';
    return;
  }
  let items = [];
  try {
    items = await mine();
  } catch (e) {
    note = '<div class="note err">' + esc(explain(e)) + '</div>';
  }
  root.innerHTML = `
    ${note}
    <form id="tf" class="form" novalidate>
      <label>Assunto<select name="t">${Object.entries(TOPIC).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label>O que aconteceu?<textarea name="m" rows="5" minlength="10" maxlength="2000" required placeholder="Ex.: ao exportar em 1080p, a barra para em 40% e aparece uma mensagem de erro."></textarea></label>
      <label>Versão do programa (opcional)<input name="v" maxlength="40" placeholder="0.6.0"></label>
      <button class="btn primary" type="submit">Enviar chamado</button>
    </form>
    ${list(items)}`;
  root.querySelector('#tf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if ((d.m || '').trim().length < 10) return e.target.insertAdjacentHTML('beforebegin', '<div class="note err">Conte um pouco mais: pelo menos 10 caracteres.</div>');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await (await sb()).rpc('open_ticket', { t: d.t, m: d.m.trim(), v: (d.v || '').trim() });
    btn.disabled = false;
    if (error) return render('<div class="note err">' + esc(/limite/i.test(error.message) ? 'Você já abriu 5 chamados hoje. Tente amanhã ou complemente um chamado aberto.' : explain(error)) + '</div>');
    render('<div class="note ok">Chamado enviado. A resposta aparece aqui embaixo.</div>');
  });
}

render().catch((e) => {
  root.innerHTML = '<div class="note err">' + esc(explain(e)) + '</div>';
});
