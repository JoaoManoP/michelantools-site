// Progresso do jogador: fica no navegador e, com a conta Milens, sincroniza na tabela arcana_profiles.
import { sb, session, configured } from '../../account.js';

const KEY = 'milens-arcana-v1';
const DEF = {
  chips: 200, best_score: 0, best_ante: 0, runs: 0, run_wins: 0, duel_wins: 0, duel_losses: 0, spins: 0,
  last_free_spin: null, inventory: [], cosmetics: { owned: ['classico', 'tinta'], back: 'classico', felt: 'tinta' }, discovered: [],
  settings: { sound: true, speed: 1, crt: true }, bj2: 0, duelBonus: 0, saved: null
};
export const M = load();
let user = null;
let pushT = 0;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return { ...structuredClone(DEF), ...(v || {}), cosmetics: { ...DEF.cosmetics, ...((v && v.cosmetics) || {}) }, settings: { ...DEF.settings, ...((v && v.settings) || {}) } };
  } catch { return structuredClone(DEF); }
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(M)); } catch {}
  if (user) { clearTimeout(pushT); pushT = setTimeout(push, 1200); }
  document.dispatchEvent(new CustomEvent('arcana:meta'));
}
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
export const freeSpinReady = () => M.last_free_spin !== today();

export function addChips(n) { M.chips = Math.max(0, Math.round(M.chips + n)); save(); }
export function spend(n) { if (M.chips < n) return false; M.chips -= n; save(); return true; }
export function discover(ids) { let ch = false; for (const id of ids) if (!M.discovered.includes(id)) { M.discovered.push(id); ch = true; } if (ch) save(); }
export function addPower(p) { M.inventory.push(p); save(); }
export function takePowers() { const p = M.inventory.splice(0); save(); return p; }
export function recordRun(run) {
  M.runs += 1;
  if (run.won) M.run_wins += 1;
  M.best_score = Math.max(M.best_score, run.best || 0);
  M.best_ante = Math.max(M.best_ante, run.ante);
  const reward = run.ante * 15 + (run.won ? 300 : 0);
  M.chips += reward;
  if (run.ante >= 3 || run.won) M.spins += 1;
  if (run.won && !M.cosmetics.owned.includes('dourado')) M.cosmetics.owned.push('dourado');
  M.saved = null;
  save();
  return reward;
}
export function recordDuel(win, online = false) {
  if (win) { M.duel_wins += 1; M.chips += online ? 80 : 40; M.spins += 1; } else M.duel_losses += 1;
  save();
}

// ---------- conta ----------
export async function currentUser() {
  if (!configured) return null;
  try { const s = await session(); return s ? s.user : null; } catch { return null; }
}
export async function displayName(u) {
  try { const s = await sb(); const { data } = await s.from('profiles').select('name').eq('id', u.id).maybeSingle(); return (data && data.name) || u.email.split('@')[0]; } catch { return u.email.split('@')[0]; }
}
const SYNC = ['chips', 'best_score', 'best_ante', 'runs', 'run_wins', 'duel_wins', 'duel_losses', 'spins', 'inventory', 'cosmetics', 'discovered'];
export async function connect() {
  user = await currentUser();
  if (!user) return null;
  try {
    const s = await sb();
    const { data } = await s.from('arcana_profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      // o servidor manda; recordes e coleção ficam com o maior dos dois
      M.chips = data.chips;
      M.spins = data.spins;
      M.inventory = data.inventory || [];
      M.cosmetics = { ...DEF.cosmetics, ...(data.cosmetics || {}) };
      M.best_score = Math.max(M.best_score, Number(data.best_score));
      M.best_ante = Math.max(M.best_ante, data.best_ante);
      for (const k of ['runs', 'run_wins', 'duel_wins', 'duel_losses']) M[k] = Math.max(M[k], data[k]);
      M.discovered = [...new Set([...(M.discovered || []), ...(data.discovered || [])])];
      M.last_free_spin = data.last_free_spin;
      try { localStorage.setItem(KEY, JSON.stringify(M)); } catch {}
      push();
    } else {
      await s.from('arcana_profiles').insert(Object.fromEntries([['id', user.id], ...SYNC.map((k) => [k, M[k]])]));
    }
  } catch {}
  document.dispatchEvent(new CustomEvent('arcana:meta'));
  return user;
}
async function push() {
  if (!user) return;
  try {
    const s = await sb();
    await s.from('arcana_profiles').update({ ...Object.fromEntries(SYNC.map((k) => [k, M[k]])), updated_at: new Date().toISOString() }).eq('id', user.id);
  } catch {}
}
export const loggedUser = () => user;
export async function login(email, password) {
  const s = await sb();
  const { error } = await s.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return connect();
}
export async function logout() { const s = await sb(); await s.auth.signOut(); user = null; }

// Roda: com conta, o servidor sorteia e controla o giro grátis; sem conta, vale o navegador.
export async function spinWheel(localPick) {
  if (user) {
    const s = await sb();
    const { data, error } = await s.rpc('arcana_spin');
    if (error) throw new Error(error.message);
    if (data.free) M.last_free_spin = today();
    M.spins = data.spins;
    save();
    return data.idx;
  }
  if (freeSpinReady()) M.last_free_spin = today();
  else if (M.spins > 0) M.spins -= 1;
  else throw new Error('Sem giros: volte amanhã ou ganhe giros jogando.');
  save();
  return localPick();
}
export async function leaderboard(kind) {
  const s = await sb();
  if (!s) return [];
  const { data, error } = await s.rpc('arcana_leaderboard', { kind });
  if (error) throw error;
  return data || [];
}
