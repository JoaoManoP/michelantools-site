// Assinatura: chama a Edge Function "checkout" com o token da conta e manda para o Stripe.
import { sb, session, configured, explain, esc, cfg } from './account.js';
const note = document.getElementById('pay-note');
const mode = document.getElementById('pay-mode');
const fn = (cfg.supabaseUrl || '') + '/functions/v1/checkout';
if (cfg.paymentsTest && cfg.paymentsEnabled) mode.hidden = false;
if (!cfg.paymentsEnabled) for (const b of document.querySelectorAll('[data-plan]')) { b.classList.remove('primary'); b.classList.add('secondary'); b.textContent = 'Em breve'; }
if (new URLSearchParams(location.search).get('cancelado')) note.innerHTML = '<div class="note">Pagamento cancelado. Nada foi cobrado.</div>';
for (const b of document.querySelectorAll('[data-plan]')) b.addEventListener('click', async () => {
  if (!configured || !cfg.paymentsEnabled) return (note.innerHTML = '<div class="note">A assinatura abre em breve. Crie sua conta para ser avisado; o Lite já está liberado.</div>');
  const s = await sb();
  const ses = await session();
  if (!ses) return (location.href = '../conta/#entrar');
  b.disabled = true;
  try {
    const r = await fetch(fn, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ses.access_token, apikey: cfg.supabaseAnonKey }, body: JSON.stringify({ period: b.dataset.plan }) });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || 'Não foi possível abrir o pagamento.');
    await s.rpc('log_event', { k: 'checkout', d: b.dataset.plan, u: navigator.userAgent.slice(0, 120) }).catch(() => {});
    location.href = j.url;
  } catch (e) {
    note.innerHTML = '<div class="note err">' + esc(explain(e)) + '</div>';
    b.disabled = false;
  }
});
