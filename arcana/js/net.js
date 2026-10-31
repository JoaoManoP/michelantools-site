// Duelo online pelo Supabase Realtime: presença numa sala (código de 5 letras) ou na fila rápida, e lances por
// broadcast. Os dois lados rodam as mesmas regras com a mesma semente e conferem o hash do estado a cada lance.
import { sb } from '../../account.js';
import { fnv, seedCode } from '../core/rng.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newRoomCode = () => seedCode(5);
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

export async function joinRoom(code, me, on) {
  const s = await sb();
  const ch = s.channel('arcana-sala-' + code, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
  let peers = {};
  ch.on('presence', { event: 'sync' }, () => {
    peers = ch.presenceState();
    const list = Object.entries(peers).map(([id, metas]) => ({ id, name: (metas[0] && metas[0].name) || 'Jogador', at: (metas[0] && metas[0].at) || 0 }));
    on.presence && on.presence(list);
  });
  ch.on('presence', { event: 'leave' }, ({ key }) => { if (key !== me.id) on.leave && on.leave(key); });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => on.msg && on.msg(payload));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('O servidor do jogo não respondeu. Tente de novo.')), 12000);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); await ch.track({ name: me.name, at: Date.now() }); res(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); rej(new Error('Não deu para entrar na sala.')); }
    });
  });
  return {
    send: (payload) => ch.send({ type: 'broadcast', event: 'm', payload }),
    leave: () => { try { ch.untrack(); s.removeChannel(ch); } catch {} }
  };
}

// fila rápida: quem estiver esperando há mais tempo forma par; os dois calculam o mesmo código de sala
export async function quickMatch(me, onWaiting) {
  const s = await sb();
  const ch = s.channel('arcana-fila', { config: { presence: { key: me.id } } });
  const at = Date.now();
  return new Promise((res, rej) => {
    let done = false;
    const finish = (code) => { if (done) return; done = true; try { ch.untrack(); s.removeChannel(ch); } catch {} res(code); };
    ch.on('presence', { event: 'sync' }, () => {
      const list = Object.entries(ch.presenceState()).map(([id, m]) => ({ id, at: (m[0] && m[0].at) || 0 })).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
      onWaiting && onWaiting(list.length);
      const i = list.findIndex((x) => x.id === me.id);
      if (i < 0) return;
      const pairStart = i - (i % 2);
      const pair = list.slice(pairStart, pairStart + 2);
      if (pair.length < 2) return;
      const ids = pair.map((x) => x.id).sort();
      let h = fnv(ids.join('|') + Math.min(pair[0].at, pair[1].at));
      let code = 'Q';
      for (let k = 0; k < 4; k++) { code += ALPHA[h % ALPHA.length]; h = Math.floor(h / ALPHA.length); }
      setTimeout(() => finish(code), 300);
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ at });
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') rej(new Error('Não deu para entrar na fila.'));
    });
    quickMatch.cancel = () => { if (!done) { done = true; try { ch.untrack(); s.removeChannel(ch); } catch {} rej(new Error('cancelado')); } };
  });
}
