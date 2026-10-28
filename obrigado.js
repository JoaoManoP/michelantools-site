// Depois do pagamento: espera o webhook emitir a chave e leva para a conta.
import { sb, session, configured } from './account.js';
(async () => {
  if (!configured || !(await session())) return;
  const s = await sb();
  for (let i = 0; i < 20; i++) {
    const { data } = await s.rpc('my_license');
    if (data && data.key) { document.querySelector('#ty h1').textContent = 'Chave emitida. Bom trabalho!'; setTimeout(() => (location.href = '../conta/'), 1200); return; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  document.querySelector('#ty .lead').textContent = 'O pagamento foi recebido, mas a chave ainda não apareceu. Abra sua conta em alguns minutos; se não aparecer, fale com o suporte.';
})();
