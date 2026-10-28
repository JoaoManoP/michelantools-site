// Contas do acesso antecipado (Supabase Auth + tabela profiles). Usado por conta.html e dashboard.html.
// cópia local do supabase-js 2.45.4 (gerada com esbuild); nada de código de terceiros carregado de CDN
const LIB = './vendor/supabase.js';

export const cfg = window.MT_CONFIG || {};
export const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

// uma única instância, mesmo quando cabeçalho e página pedem ao mesmo tempo
let clientP = null;
export function sb() {
  if (!configured) return Promise.resolve(null);
  if (!clientP) clientP = import(LIB).then(({ createClient }) => createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } }));
  return clientP;
}

export async function session() {
  const s = await sb();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session;
}

export async function myProfile() {
  const s = await sb();
  const ses = await session();
  if (!s || !ses) return null;
  const { data, error } = await s.from('profiles').select('*').eq('id', ses.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function isAdmin() {
  const s = await sb();
  if (!s) return false;
  const { data, error } = await s.rpc('is_admin');
  return !error && data === true;
}

// mensagens do Supabase em português, com o que fazer
export function explain(err) {
  const m = String((err && (err.message || err.error_description)) || err || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos. Confira e tente de novo.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar: procure a mensagem que enviamos (veja também o spam).';
  if (/User already registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return m || 'Algo não deu certo. Tente de novo.';
}

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
