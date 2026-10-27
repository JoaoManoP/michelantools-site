// Instalador da versão Lite no bucket privado "releases".
// O plano grátis do Supabase aceita arquivos de até 50 MB, e o instalador é maior: ele fica em partes de 20 MB
// (lite/MichelanTools-Lite-Setup.exe.part1, .part2…) mais um arquivo com o SHA-256 do instalador inteiro.
// O painel divide e envia; a página da conta baixa as partes por links temporários, junta, confere o SHA-256
// e só então salva o arquivo. Se o resultado não bater (parte trocada ou corrompida), nada é salvo.
const NAME = 'MichelanTools-Lite-Setup.exe';
const DIR = 'lite';
const PART = 20 * 1024 * 1024;
const partNo = (n) => Number((/\.part(\d+)$/.exec(n) || [])[1] || 0);

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function liteStatus(s) {
  const { data, error } = await s.storage.from('releases').list(DIR, { limit: 100 });
  if (error) throw error;
  const parts = (data || []).filter((f) => f.name.startsWith(NAME + '.part')).sort((a, b) => partNo(a.name) - partNo(b.name));
  const size = parts.reduce((t, f) => t + ((f.metadata && f.metadata.size) || 0), 0);
  const when = parts.length ? parts.map((f) => f.updated_at || f.created_at).sort().pop() : null;
  return { parts, size, when, hasSha: (data || []).some((f) => f.name === NAME + '.sha256') };
}

export async function uploadLite(s, file, onProgress = () => {}) {
  if (!/\.exe$/i.test(file.name)) throw new Error('Escolha o instalador .exe da versão Lite.');
  onProgress('Calculando a impressão digital (SHA-256)…');
  const hash = await sha256(await file.arrayBuffer());
  const old = await liteStatus(s);
  const total = Math.ceil(file.size / PART);
  for (let i = 0; i < total; i++) {
    onProgress(`Enviando parte ${i + 1} de ${total}…`);
    const { error } = await s.storage.from('releases').upload(`${DIR}/${NAME}.part${i + 1}`, file.slice(i * PART, (i + 1) * PART), { upsert: true, contentType: 'application/octet-stream' });
    if (error) throw error;
  }
  // partes que sobraram de uma versão maior saem
  const extra = old.parts.filter((f) => partNo(f.name) > total).map((f) => `${DIR}/${f.name}`);
  if (extra.length) await s.storage.from('releases').remove(extra);
  const { error } = await s.storage.from('releases').upload(`${DIR}/${NAME}.sha256`, new Blob([hash + '  ' + NAME + '\n'], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' });
  if (error) throw error;
  onProgress(`Pronto: ${total} partes, SHA-256 ${hash.slice(0, 16)}…`);
  return { parts: total, hash };
}

export async function downloadLite(s, onProgress = () => {}) {
  const st = await liteStatus(s);
  if (!st.parts.length || !st.hasSha) throw new Error('A versão Lite ainda está sendo preparada. Tente mais tarde.');
  const paths = [...st.parts.map((f) => `${DIR}/${f.name}`), `${DIR}/${NAME}.sha256`];
  const { data: urls, error } = await s.storage.from('releases').createSignedUrls(paths, 300);
  if (error) throw error;
  const expected = (await (await fetch(urls[urls.length - 1].signedUrl)).text()).trim().split(/\s+/)[0];
  const chunks = [];
  let got = 0;
  for (let i = 0; i < st.parts.length; i++) {
    const res = await fetch(urls[i].signedUrl);
    if (!res.ok) throw new Error('Falha ao baixar a parte ' + (i + 1) + '. Tente de novo.');
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress(Math.min(99, Math.round((got / st.size) * 100)));
    }
  }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  onProgress('verificando');
  if ((await sha256(await blob.arrayBuffer())) !== expected) throw new Error('O arquivo baixado não confere com o original. Nada foi salvo; tente de novo.');
  const { error: logErr } = await s.rpc('log_download', { f: `${DIR}/${NAME}` });
  if (logErr) throw logErr;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = NAME;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 60000);
  return expected;
}
