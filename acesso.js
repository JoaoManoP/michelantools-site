// Acesso temporário ao Milens PRO.
// O link tem a forma  acesso/#<id>.<token>  — o trecho depois do # nunca vai para servidor nenhum (nem para o GitHub).
// <id>.<token> é um link assinado do Supabase para releases/links/<id>.json, um manifesto criado pelo dono com
// scripts/link-pro.mjs. O manifesto traz links assinados das partes do instalador, o SHA-256 e uma chave PRO que
// vence junto com o link. Revogar = apagar o manifesto. Sem o código, esta página não faz nada.
import { cfg, esc } from './account.js';

const box = document.getElementById('ac');
const lead = box.querySelector('.lead');
const fail = (msg) => { lead.textContent = msg; };

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const signed = (path, token) => `${cfg.supabaseUrl}/storage/v1/object/sign/releases/${path}?token=${encodeURIComponent(token)}`;

(async () => {
  const m = /^#([a-f0-9]{16})\.([A-Za-z0-9_\-.]+)$/.exec(location.hash);
  if (!m || !cfg.supabaseUrl) return fail('Este endereço precisa do link completo que você recebeu. Peça um novo para quem enviou.');
  const [, id, token] = m;
  let man;
  try {
    const r = await fetch(signed(`links/${id}.json`, token), { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error();
    man = await r.json();
  } catch {
    return fail('Este link expirou ou foi desativado. Peça um novo para quem enviou.');
  }
  if (!man || man.v !== 1 || Date.now() > man.expires) return fail('Este link expirou. Peça um novo para quem enviou.');
  const until = new Date(man.expires).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const mb = (man.size / 1048576).toFixed(0);
  box.innerHTML = `<span class="eyebrow">Acesso temporário</span><h1>Milens PRO ${esc(man.version || '')}</h1>
    <p class="lead">${man.label ? esc(man.label) + ' · ' : ''}Link válido até <b>${esc(until)}</b>. Não compartilhe: quem tiver este endereço consegue baixar.</p>
    <div class="row"><button class="btn primary lg" id="go">Baixar o instalador (${mb} MB)</button></div>
    <p class="fine" id="st" aria-live="polite"></p>
    <div id="key" hidden></div>`;
  const st = document.getElementById('st');
  document.getElementById('go').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const chunks = [];
      let got = 0;
      for (let i = 0; i < man.parts.length; i++) {
        const res = await fetch(signed(man.parts[i].path, man.parts[i].token), { referrerPolicy: 'no-referrer' });
        if (!res.ok) throw new Error('O link expirou no meio do download. Peça um novo.');
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          st.textContent = 'Baixando… ' + Math.min(99, Math.round((got / man.size) * 100)) + '%';
        }
      }
      st.textContent = 'Conferindo o arquivo…';
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      if ((await sha256(await blob.arrayBuffer())) !== man.sha) throw new Error('O arquivo baixado não confere com o original. Nada foi salvo; tente de novo.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = man.name;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
      st.textContent = 'Pronto. O instalador foi conferido (SHA-256) e salvo nos seus downloads.';
      if (man.key) {
        const k = document.getElementById('key');
        k.hidden = false;
        k.innerHTML = `<div class="lic"><b>Sua chave PRO (vale até ${esc(until)})</b><code id="kv">${esc(man.key)}</code>
          <div class="row"><button class="btn secondary" id="cp">Copiar a chave</button></div>
          <p class="fine">Instale, abra o Milens, vá em <b>Preferências → Tenho uma chave</b>, cole e clique em <b>Ativar</b>. Depois da data acima, o programa volta ao modo Lite.</p></div>`;
        document.getElementById('cp').addEventListener('click', () => navigator.clipboard.writeText(man.key).then(() => (document.getElementById('cp').textContent = 'Copiada')));
      }
    } catch (err) {
      st.textContent = err.message || 'Falha no download. Tente de novo.';
    } finally {
      btn.disabled = false;
    }
  });
})();
