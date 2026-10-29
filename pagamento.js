// Pagamento simulado: mostra o fluxo inteiro (plano → cartão ou Pix → processando → obrigado) sem cobrar nada.
// Registra o pedido pela função simulate_checkout (pagamento de teste, chave SIM- que não ativa o PRO).
import { sb, session, configured, explain, esc } from './account.js';
const root = document.getElementById('pay');
const PLANS = {
  mensal: { name: 'PRO mensal', price: 2990, every: 'por mês', note: 'Renova todo mês. Cancele quando quiser.' },
  anual: { name: 'PRO anual', price: 24900, every: 'por ano', note: 'Equivale a R$ 20,75 por mês.' },
  vitalicio: { name: 'PRO vitalício', price: 49900, every: 'pagamento único', note: 'Atualizações por 1 ano incluídas.' }
};
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const params = new URLSearchParams(location.search);
let period = PLANS[params.get('plano')] ? params.get('plano') : 'anual';
let method = 'cartao';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function qr(seed) {
  // QR de mentira (padrão determinístico), só ilustração
  let x = 0; for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 25, cells = [];
  for (let i = 0; i < n * n; i++) { x = (x * 1103515245 + 12345) >>> 0; const r = Math.floor(i / n), c = i % n; const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); const ring = finder && (r % 6 === 0 || c % 6 === 0 || ((r % (n - 7)) > 1 && (r % (n - 7)) < 5 && (c % (n - 7)) > 1 && (c % (n - 7)) < 5)); if (finder ? ring : (x >> 16) & 1) cells.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`); }
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" class="qr" aria-label="QR Code de demonstração"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><g fill="#0B0D12">${cells.join('')}</g></svg>`;
}

function summary() {
  const p = PLANS[period];
  return `<aside class="pay-sum">
    <span class="pill spec">Simulação</span>
    <h2>${p.name}</h2>
    <p class="price"><b>${brl(p.price)}</b><span>${p.every}</span></p>
    <p class="muted">${p.note}</p>
    <div class="seg-tabs" role="tablist" aria-label="Plano">${Object.entries(PLANS).map(([k, v]) => `<button role="tab" aria-selected="${k === period}" data-p="${k}">${v.name.replace('PRO ', '')}</button>`).join('')}</div>
    <ul class="ticks"><li>Os cinco programas, sem marca d'água</li><li>Chave para 2 computadores</li><li>Reembolso em até 7 dias</li></ul>
  </aside>`;
}

function form() {
  return `<div class="pay-form card">
    <div class="note">Modo de <b>simulação</b>: nenhum valor é cobrado e nenhum dado de cartão sai do seu navegador. A chave gerada é de demonstração e não ativa o PRO.</div>
    <div class="seg-tabs" role="tablist" aria-label="Forma de pagamento"><button role="tab" aria-selected="${method === 'cartao'}" data-m="cartao">Cartão</button><button role="tab" aria-selected="${method === 'pix'}" data-m="pix">Pix</button></div>
    ${method === 'cartao' ? `
    <form id="pf" class="form" novalidate autocomplete="off">
      <label>Número do cartão<input name="n" inputmode="numeric" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" maxlength="19"></label>
      <div class="two-in"><label>Validade<input name="v" placeholder="MM/AA" value="12/30" maxlength="5"></label><label>CVC<input name="c" inputmode="numeric" placeholder="123" value="123" maxlength="4"></label></div>
      <label>Nome no cartão<input name="h" placeholder="Como está no cartão" value="TESTE MILENS"></label>
      <p class="fine">Cartões de teste: <span class="mono">4242 4242 4242 4242</span> aprova; <span class="mono">4000 0000 0000 0002</span> é recusado.</p>
      <button class="btn primary lg" type="submit">Pagar ${brl(PLANS[period].price)} (simulado)</button>
    </form>` : `
    <div class="pix">${qr(period + Date.now().toString().slice(0, 7))}<div><b>Pix copia e cola</b><textarea class="mono" readonly rows="3">00020126580014BR.GOV.BCB.PIX0136simulacao-milens-${period}5204000053039865406${(PLANS[period].price / 100).toFixed(2)}5802BR5906MILENS6009SAO PAULO62070503***6304SIMU</textarea><p class="fine">No modo real, o pagamento cai na hora. Aqui você confirma manualmente.</p><button class="btn primary lg" id="pixok">Já paguei (simular confirmação)</button></div></div>`}
    <div id="pmsg"></div>
  </div>`;
}

function draw() {
  root.innerHTML = `<div class="pay-grid">${summary()}${form()}</div>`;
  root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.p; history.replaceState(null, '', '?plano=' + period); draw(); }));
  root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { method = b.dataset.m; draw(); }));
  const f = root.querySelector('#pf');
  if (f) {
    f.n.addEventListener('input', () => { f.n.value = f.n.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); });
    f.v.addEventListener('input', () => { const d = f.v.value.replace(/\D/g, '').slice(0, 4); f.v.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; });
    f.addEventListener('submit', (e) => { e.preventDefault(); const n = f.n.value.replace(/\s/g, ''); if (n.length < 16) return msg('err', 'Número do cartão incompleto.'); if (!/^\d{2}\/\d{2}$/.test(f.v.value)) return msg('err', 'Validade no formato MM/AA.'); if (n === '4000000000000002') return pay(true); pay(false); });
  }
  const px = root.querySelector('#pixok');
  if (px) px.addEventListener('click', () => pay(false));
}
function msg(kind, text) { root.querySelector('#pmsg').innerHTML = `<div class="note ${kind}">${esc(text)}</div>`; }

async function pay(declined) {
  const box = root.querySelector('.pay-form');
  box.innerHTML = `<div class="processing"><div class="spinner" aria-hidden="true"></div><b>Processando pagamento…</b><p class="muted">Conferindo com o banco (simulado).</p></div>`;
  await wait(1600);
  if (declined) { box.innerHTML = `<div class="note err">Pagamento recusado pelo emissor do cartão (simulação do cartão 4000 0000 0000 0002).</div><button class="btn secondary" id="again">Tentar de novo</button>`; box.querySelector('#again').onclick = draw; return; }
  box.querySelector('b').textContent = 'Aprovado. Emitindo a chave…';
  try {
    const { data, error } = await (await sb()).rpc('simulate_checkout', { p_period: period, p_method: method });
    if (error) throw error;
    await wait(900);
    sessionStorage.setItem('milens-sim', JSON.stringify(data));
    location.href = '../obrigado/?simulacao=1';
  } catch (err) {
    box.innerHTML = `<div class="note err">${esc(explain(err))}</div><button class="btn secondary" id="again">Voltar</button>`;
    box.querySelector('#again').onclick = draw;
  }
}

(async () => {
  if (!configured) { root.innerHTML = '<div class="note">Pagamentos indisponíveis no momento.</div>'; return; }
  if (!(await session())) { root.innerHTML = `<div class="card c-login"><p>Entre na sua conta para simular a compra. A conta é grátis.</p><a class="btn primary" href="../conta/#entrar">Entrar ou criar conta</a></div>`; return; }
  draw();
})();
