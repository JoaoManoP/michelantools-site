// Página da IA: saldo do mês (my_credits), cota por plano e custos vindos do banco (ai_plan_allowance, ai_costs, ai_packs)
// e compra de pacotes. Enquanto o pagamento real não abre, a compra é uma simulação (simulate_buy_credits) que NÃO soma créditos.
import { sb, session, configured, explain, esc, cfg } from './account.js';
const $ = (id) => document.getElementById(id);
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const NAMES = { mensal: 'PRO mensal', anual: 'PRO anual', vitalicio: 'PRO vitalício' };
const COSTS = { imagem: ['Gerar imagem', ' por imagem'], video: ['Imagem → vídeo', ' a cada 5 s'], fundo: ['Remover fundo', ''], ampliar: ['Ampliar imagem', ''], preencher: ['Preencher área', ''], comando: ['Edição por comando', ' por pedido'] };
const mode = $('ia-mode');
if (!cfg.paymentsEnabled && mode) { mode.hidden = false; mode.innerHTML = 'Compra de créditos em <b>simulação</b>: o fluxo funciona e nada é cobrado, mas nenhum crédito é somado.'; }

async function load() {
  if (!configured) return;
  const s = await sb();
  try {
    const [a, c, k] = await Promise.all([s.from('ai_plan_allowance').select('period, monthly_credits'), s.from('ai_costs').select('kind, credits'), s.from('ai_packs').select('id, credits, price_cents, label').eq('active', true).order('credits')]);
    if (a.data && a.data.length) $('ia-allowance').innerHTML = a.data.filter((r) => NAMES[r.period]).sort((x, y) => x.monthly_credits - y.monthly_credits).map((r) => `<tr><td>${NAMES[r.period]}</td><td>${r.monthly_credits}</td></tr>`).join('') + '<tr><td>Lite</td><td>— (a IA é do PRO)</td></tr>';
    if (c.data && c.data.length) $('ia-costs').innerHTML = c.data.filter((r) => COSTS[r.kind]).map((r) => `<tr><td>${COSTS[r.kind][0]}</td><td>${r.credits}${COSTS[r.kind][1]}</td></tr>`).join('');
    if (k.data && k.data.length) for (const p of k.data) { const b = document.querySelector(`[data-pack="${p.id}"]`); if (b) b.closest('.plan').querySelector('.price b').textContent = brl(p.price_cents); }
  } catch {}
  const ses = await session();
  if (!ses) return;
  try {
    const { data: cr, error } = await s.rpc('my_credits');
    if (error) throw error;
    $('ia-balance').innerHTML = cr && cr.pro
      ? `<div class="note"><b>${cr.left_month} de ${cr.allowance}</b> créditos deste mês · ${cr.extra} extras · renova em ${new Date(cr.reset_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>`
      : '<div class="note">A IA faz parte do PRO. <a href="../planos/">Ver planos</a></div>';
  } catch (e) {
    $('ia-balance').innerHTML = '<p class="muted">Saldo indisponível agora.</p>';
  }
}

for (const b of document.querySelectorAll('[data-pack]')) b.addEventListener('click', async () => {
  const note = $('ia-note');
  if (!configured) return (note.innerHTML = '<div class="note">A compra de créditos abre em breve.</div>');
  const ses = await session();
  if (!ses) return (location.href = '../conta/#entrar');
  b.disabled = true;
  try {
    const { data, error } = await (await sb()).rpc('simulate_buy_credits', { p_pack: b.dataset.pack });
    if (error) throw error;
    note.innerHTML = `<div class="note">Simulação registrada: pacote de ${esc(String(data.credits))} créditos por ${brl(data.amount_cents)}. Nada foi cobrado e nenhum crédito foi somado; a compra real abre junto com o pagamento do PRO.</div>`;
  } catch (e) {
    note.innerHTML = '<div class="note err">' + esc(explain(e)) + '</div>';
  }
  b.disabled = false;
});
load();
