// Instaladores no bucket privado "releases", em dois canais: lite/ (grátis, qualquer conta) e completo/ (PRO, só
// quem tem o plano). O plano grátis do Supabase aceita arquivos de até 50 MB, então cada instalador fica em partes
// de 20 MB (…Setup.exe.part1, .part2…) mais um arquivo com o SHA-256 do instalador inteiro. O painel divide e
// envia; a página da conta registra o download (cotas), baixa as partes por links temporários, junta, confere o
// SHA-256 e só então salva. Se o resultado não bater, nada é salvo.
export const CHANNELS = {
  lite: { dir: 'lite', name: 'MichelanTools-Lite-Setup.exe', label: 'Lite' },
  completo: { dir: 'completo', name: 'MichelanTools-Setup.exe', label: 'PRO' }
};
const PART = 20 * 1024 * 1024;
const partNo = (n) => Number((/\.part(\d+)$/.exec(n) || [])[1] || 0);
const ch = (c) => CHANNELS[c] || CHANNELS.lite;

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function releaseStatus(s, channel = 'lite') {
  const { dir, name } = ch(channel);
  const { data, error } = await s.storage.from('releases').list(dir, { limit: 100 });
  if (error) throw error;
  const parts = (data || []).filter((f) => f.name.startsWith(name + '.part')).sort((a, b) => partNo(a.name) - partNo(b.name));
  const size = parts.reduce((t, f) => t + ((f.metadata && f.metadata.size) || 0), 0);
  const when = parts.length ? parts.map((f) => f.updated_at || f.created_at).sort().pop() : null;
  return { parts, size, when, hasSha: (data || []).some((f) => f.name === name + '.sha256') };
}

export async function uploadRelease(s, file, onProgress = () => {}, channel = 'lite') {
  const { dir, name } = ch(channel);
  if (!/\.exe$/i.test(file.name)) throw new Error('Escolha o instalador .exe.');
  onProgress('Calculando a impressão digital (SHA-256)…');
  const hash = await sha256(await file.arrayBuffer());
  const old = await releaseStatus(s, channel);
  const total = Math.ceil(file.size / PART);
  for (let i = 0; i < total; i++) {
    onProgress(`Enviando parte ${i + 1} de ${total}…`);
    const { error } = await s.storage.from('releases').upload(`${dir}/${name}.part${i + 1}`, file.slice(i * PART, (i + 1) * PART), { upsert: true, contentType: 'application/octet-stream' });
    if (error) throw error;
  }
  const extra = old.parts.filter((f) => partNo(f.name) > total).map((f) => `${dir}/${f.name}`);
  if (extra.length) await s.storage.from('releases').remove(extra);
  const { error } = await s.storage.from('releases').upload(`${dir}/${name}.sha256`, new Blob([hash + '  ' + name + '\n'], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' });
  if (error) throw error;
  onProgress(`Pronto: ${total} partes, SHA-256 ${hash.slice(0, 16)}…`);
  return { parts: total, hash };
}

export async function downloadRelease(s, onProgress = () => {}, channel = 'lite') {
  const { dir, name } = ch(channel);
  // primeiro o registro: confere o plano e as cotas e é o que libera o bucket pelos próximos minutos
  const { error: logErr } = await s.rpc('log_download', { f: `${dir}/${name}` });
  if (logErr) throw new Error(/limite diário de downloads/.test(logErr.message) ? 'Você já baixou 3 vezes hoje. Tente amanhã.' : /limite diário do servidor/.test(logErr.message) ? 'O limite de downloads de hoje acabou. Tente amanhã.' : /arquivo inválido/.test(logErr.message) ? 'O PRO só está disponível para quem tem o plano.' : logErr.message);
  const st = await releaseStatus(s, channel);
  if (!st.parts.length || !st.hasSha) throw new Error('Este instalador ainda está sendo preparado. Tente mais tarde.');
  const paths = [...st.parts.map((f) => `${dir}/${f.name}`), `${dir}/${name}.sha256`];
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
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 60000);
  return expected;
}

// nomes antigos (painel e testes)
export const liteStatus = (s) => releaseStatus(s, 'lite');
export const uploadLite = (s, f, p) => uploadRelease(s, f, p, 'lite');
export const downloadLite = (s, p) => downloadRelease(s, p, 'lite');
