// Depois do pagamento: no modo real espera o webhook emitir a chave; no modo simulação mostra o recibo de demonstração.
import { sb, session, configured, esc } from './account.js';
(async () => {
  const ty = document.getElementById('ty');
  const simulated = new URLSearchParams(location.search).get('simulacao');
  if (simulated) {
    let d = null;
    try { d = JSON.parse(sessionStorage.getItem('milens-sim') || 'null'); } catch {}
    if (!d) return;
    const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const plan = { mensal: 'PRO mensal', anual: 'PRO anual', vitalicio: 'PRO vitalício' }[d.period] || d.period;
    ty.querySelector('h1').textContent = 'Pagamento aprovado (simulação).';
    ty.querySelector('.lead').textContent = 'Este é exatamente o caminho que a pessoa vai ver quando o pagamento real estiver ligado. Nada foi cobrado.';
    ty.insertAdjacentHTML('beforeend', `<div class="receipt">
      <div class="r-head"><b>Recibo de demonstração</b><span class="mono">#${esc(String(d.id))}</span></div>
      <dl class="kv"><div><dt>Plano</dt><dd>${esc(plan)}</dd></div><div><dt>Forma</dt><dd>${d.method === 'pix' ? 'Pix' : 'Cartão'}</dd></div><div><dt>Valor</dt><dd>${brl(d.amount_cents)}</dd></div><div><dt>Taxa estimada</dt><dd>${brl(d.fee_cents)}</dd></div><div><dt>Você receberia</dt><dd>${brl(d.net_cents)}</dd></div></dl>
      <div class="lic"><b>Chave de demonstração</b><code>${esc(d.chave)}</code><p class="fine">No modo real aqui aparece a chave MT1 assinada, que ativa o PRO. A de demonstração não ativa o programa.</p></div>
    </div>`);
    sessionStorage.removeItem('milens-sim');
    return;
  }
  if (!configured || !(await session())) return;
  const s = await sb();
  for (let i = 0; i < 20; i++) {
    const { data } = await s.rpc('my_license');
    if (data && data.key) { ty.querySelector('h1').textContent = 'Chave emitida. Bom trabalho!'; setTimeout(() => (location.href = '../conta/'), 1200); return; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  ty.querySelector('.lead').textContent = 'O pagamento foi recebido, mas a chave ainda não apareceu. Abra sua conta em alguns minutos; se não aparecer, fale com o suporte.';
})();
