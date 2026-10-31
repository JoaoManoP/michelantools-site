// Milens Arcana — entrada: menu, coleção, placar, regras, ajustes e conta.
import { app, route, go, current, modal, closeModal, isModal } from './ui.js';
import { mascot, arcanoHTML, esc } from './art.js';
import { sfx, setPrefs, prefs, toast, flash } from './fx.js';
import { M, save, connect, loggedUser, login, logout, leaderboard, displayName, freeSpinReady } from './meta.js';
import { applyCosmetics } from './cosmetics.js';
import { ARCANOS } from '../core/arcanos.js';
import { HANDS, HAND_ORDER } from '../core/hands.js';
import { ITEMS, ITEM_IDS } from '../core/duel.js';
import './solo.js';
import './duelui.js';
import './casinoui.js';

let myName = '';
route('menu', () => {
  const u = loggedUser();
  app.innerHTML = `<div class="title"><div class="title-in">
    <div id="cam">${mascot('', 'normal')}</div>
    <span class="tag-line">o baralho escondido da câmera</span>
    <h1 class="logo-t">Milens<span>Arcana</span></h1>
    <div class="top-bar"><span class="chip-pill"><i></i><b>${M.chips.toLocaleString('pt-BR')}</b> fichas</span><span class="chip-pill">Recorde ${M.best_score.toLocaleString('pt-BR')}</span><span class="chip-pill">Duelos ${M.duel_wins}V ${M.duel_losses}D</span>${freeSpinReady() ? '<span class="chip-pill" style="border-color:var(--gold)">Giro grátis hoje</span>' : ''}</div>
    <div class="menu-grid">
      <button class="menu-card" data-go="solo" style="--c:var(--red)"><span class="num">I</span><b>Tiragem</b><small>${M.saved ? 'Continuar a partida salva.' : 'Solo: mãos de pôquer, 22 Arcanos e 8 antes.'}</small></button>
      <button class="menu-card" data-go="duelo" style="--c:var(--blue)"><span class="num">II</span><b>Roleta da Câmera</b><small>Duelo de flash e vazio. Contra a IA ou online.</small></button>
      <button class="menu-card" data-go="cassino" style="--c:var(--green)"><span class="num">III</span><b>Cassino</b><small>Roda da Sorte, Vinte e Um e visuais. Só fichas virtuais.</small></button>
      <button class="menu-card" data-go="colecao" style="--c:var(--gold)"><span class="num">IV</span><b>Coleção</b><small>${M.discovered.length} de 22 Arcanos revelados.</small></button>
    </div>
    <div class="links"><button data-go="placar">Placar</button><button data-go="regras">Regras</button><button data-go="ajustes">Ajustes</button><button data-go="conta">${u ? 'Conta: ' + esc(myName || 'conectada') : 'Entrar com a conta Milens'}</button></div>
  </div></div>`;
  app.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { sfx.click(); go(b.dataset.go); }));
  const cam = app.querySelector('#cam .mascot');
  cam.onclick = () => { sfx.shutter(); flash('#fff', 200); cam.classList.remove('m-normal'); };
});

route('colecao', () => {
  const found = new Set(M.discovered);
  app.innerHTML = `<div class="page"><div class="page-head"><div><span class="lbl">${found.size} de 22</span><h1 class="h-d">Coleção de Arcanos</h1></div><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
    <p class="muted">Arcanos aparecem na loja, nos Pacotes Maiores e na Câmara Escura. Cada um que passa pela sua mão fica revelado aqui.</p>
    <div class="coll">${ARCANOS.map((a) => found.has(a.id) ? arcanoHTML({ id: a.id, uid: '' }) : `<div class="tc locked" tabindex="0"><span class="tc-num">${a.num}</span><span class="tc-name" style="align-self:center">?</span><span class="tc-name">Oculto</span><span class="tc-tip">Ainda não revelado.</span></div>`).join('')}</div>
    <h2 class="h-d" style="font-size:30px">Mãos</h2>
    <table class="lb"><tr><th>Mão</th><th>Fichas × Mult (nível 1)</th><th>Por nível</th></tr>${HAND_ORDER.map((k) => `<tr><td>${esc(HANDS[k].name)}</td><td>${HANDS[k].chips} × ${HANDS[k].mult}</td><td>+${HANDS[k].lc} / +${HANDS[k].lm}</td></tr>`).join('')}</table></div>`;
  app.querySelector('[data-back]').onclick = () => go('menu');
});

route('placar', async () => {
  let kind = 'solo';
  const draw = async () => {
    app.innerHTML = `<div class="page"><div class="page-head"><div><span class="lbl">Contas Milens</span><h1 class="h-d">Placar</h1></div><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
      <div class="tabs">${[['solo', 'Maior mão (Tiragem)'], ['duelo', 'Duelos vencidos']].map(([id, l]) => `<button data-k="${id}" aria-selected="${kind === id}">${l}</button>`).join('')}</div><div id="lb"><p class="muted">Carregando…</p></div>
      <p class="muted">Seu recorde local: ${M.best_score.toLocaleString('pt-BR')} · ${M.duel_wins} duelos vencidos. Entre na conta para aparecer no placar.</p></div>`;
    app.querySelector('[data-back]').onclick = () => go('menu');
    app.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { kind = b.dataset.k; draw(); }));
    try {
      const rows = await leaderboard(kind);
      app.querySelector('#lb').innerHTML = rows.length ? `<table class="lb"><tr><th>#</th><th>Nome</th><th>${kind === 'solo' ? 'Maior mão' : 'Vitórias'}</th></tr>${rows.map((r) => `<tr class="${r.eu ? 'me' : ''}"><td>${r.pos}</td><td>${esc(r.nome)}</td><td>${Number(r.valor).toLocaleString('pt-BR')}</td></tr>`).join('')}</table>` : '<p class="muted">Ninguém no placar ainda. Seja o primeiro.</p>';
    } catch { const el = app.querySelector('#lb'); if (el) el.innerHTML = '<p class="muted">Sem conexão com o placar agora.</p>'; }
  };
  draw();
});

route('regras', () => {
  app.innerHTML = `<div class="page rules"><div class="page-head"><h1 class="h-d">Regras</h1><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
    <h3>Tiragem (solo)</h3>
    <p>Você recebe 8 cartas de um baralho de 52, em quatro naipes do estúdio: Estrelas, Lentes, Filmes e Flashes. Em cada plano você tem mãos e descartes limitados. Jogue de 1 a 5 cartas: a combinação define a base de <b style="color:var(--blue)">Fichas</b> e de <b style="color:var(--red)">Mult</b>; cada carta que pontua soma o seu valor em Fichas (figuras 10, Ás 11). Os pontos da mão são Fichas × Mult. Passe da meta antes de acabarem as mãos.</p>
    <ul><li>Cada ante tem o Plano Aberto, o Plano Fechado (meta ×1,5) e o Chefe (meta ×2, com uma regra que atrapalha). São 8 antes; o último Chefe é O Obturador.</li>
    <li>Ao vencer, você ganha dinheiro: o prêmio do plano, $1 por mão que sobrou e juros de $1 a cada $5 guardados (até $5).</li>
    <li>Na loja: <b>Arcanos</b> (até 5, efeitos permanentes, agem da esquerda para a direita), <b>Lâminas</b> (até 2, mudam cartas do baralho: Brilho, Foco, Vidro, Prata, Pedra, Filtro, Zoom, Dupla Exposição, Corte…), <b>Constelações</b> (sobem o nível de uma mão) e pacotes.</li>
    <li>Atalhos: 1 a 9 seleciona, Enter joga, D descarta, S ordena, Esc sai (a partida fica salva).</li></ul>
    <h3>Roleta da Câmera (duelo)</h3>
    <p>A câmera é carregada com rolos de flash e vazios em ordem secreta; só a quantidade é anunciada. Na sua vez, dispare no rival ou em você. Flash tira 1 quadro de filme de quem recebe. Disparar em você com um vazio mantém a vez. Quando a câmera esvazia, ela é recarregada e cada um ganha itens. Melhor de 3 rodadas, com mais quadros e mais itens a cada rodada.</p>
    <ul>${ITEM_IDS.map((i) => `<li><b>${ITEMS[i].name}:</b> ${ITEMS[i].desc}</li>`).join('')}</ul>
    <p>Online, os dois aparelhos rodam as mesmas regras com a mesma semente e conferem cada lance. Atalhos: A dispara no rival, S em você, 1 a 6 usa itens.</p>
    <h3>Cassino</h3>
    <p>As fichas são virtuais e só servem dentro do jogo: para a Roda da Sorte não há compra, e as fichas compram apenas visuais. <b>Não existe compra de fichas nem troca por dinheiro, prêmios ou qualquer valor.</b> Jogos de azar com dinheiro são proibidos no Brasil, e nada aqui envolve dinheiro de verdade.</p>
    <p>Você ganha fichas jogando: tiragens (15 por ante alcançada, 300 por vitória completa) e duelos (40 contra a IA, 80 online). A Roda da Sorte dá um giro grátis por dia e giros extras por vitórias.</p></div>`;
  app.querySelector('[data-back]').onclick = () => go('menu');
});

route('ajustes', () => {
  const s = M.settings;
  app.innerHTML = `<div class="page"><div class="page-head"><h1 class="h-d">Ajustes</h1><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
    <div class="panel form" style="max-width:520px">
      <label><input type="checkbox" id="snd" ${s.sound ? 'checked' : ''}> Som</label>
      <label><input type="checkbox" id="crt" ${s.crt ? 'checked' : ''}> Tela de tubo e grão de filme</label>
      <label class="lbl" for="spd">Velocidade das animações</label>
      <select id="spd" style="padding:8px;font:inherit">${[[0.75, 'Calma'], [1, 'Normal'], [1.6, 'Rápida'], [2.5, 'Turbo']].map(([v, l]) => `<option value="${v}" ${Number(s.speed) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn small red" id="reset">Apagar progresso local</button>
    </div></div>`;
  app.querySelector('[data-back]').onclick = () => go('menu');
  const upd = () => { M.settings = { sound: app.querySelector('#snd').checked, crt: app.querySelector('#crt').checked, speed: Number(app.querySelector('#spd').value) }; setPrefs(M.settings); save(); sfx.click(); };
  app.querySelectorAll('input,select').forEach((el) => (el.onchange = upd));
  app.querySelector('#reset').onclick = () => {
    if (!confirm('Apagar o progresso deste aparelho? (Com a conta conectada, o que está no servidor volta quando você entrar.)')) return;
    try { localStorage.removeItem('milens-arcana-v1'); } catch {}
    location.reload();
  };
});

route('conta', () => {
  const u = loggedUser();
  if (u) {
    app.innerHTML = `<div class="page"><div class="page-head"><h1 class="h-d">Conta</h1><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
      <div class="panel"><p>Conectado como <b>${esc(myName)}</b> (${esc(u.email)}). Fichas, recordes, coleção e visuais ficam salvos na sua conta Milens.</p><button class="btn small" id="out">Sair</button></div></div>`;
    app.querySelector('#out').onclick = async () => { await logout(); toast('Você saiu da conta.'); go('menu'); };
  } else {
    app.innerHTML = `<div class="page"><div class="page-head"><h1 class="h-d">Entrar</h1><button class="btn small ghost" data-back>Menu <kbd>Esc</kbd></button></div>
      <form class="panel form" id="f"><p>Use a mesma conta do site do Milens. Com ela, o progresso fica salvo, você joga online e aparece no placar.</p>
      <input name="email" type="email" required placeholder="E-mail" autocomplete="email"><input name="password" type="password" required placeholder="Senha" autocomplete="current-password">
      <button class="btn red" type="submit">Entrar</button><p class="muted">Não tem conta? Crie em <b>joaomanop.github.io/milens-site/conta</b>.</p></form></div>`;
    app.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      try { await login(d.email.trim(), d.password); myName = (await displayName(loggedUser())).split(' ')[0]; applyCosmetics(); toast('Conectado. Progresso sincronizado.', 'ok'); go('menu'); }
      catch (err) { toast(/Invalid login/i.test(err.message) ? 'E-mail ou senha incorretos.' : err.message, 'err'); }
    };
  }
  app.querySelector('[data-back]').onclick = () => go('menu');
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || isModal()) return;
  const c = current();
  if (['colecao', 'placar', 'regras', 'ajustes', 'conta'].includes(c)) go('menu');
});

// início
setPrefs(M.settings);
applyCosmetics();
const first = current();
go(['solo', 'duelo', 'cassino', 'colecao', 'placar', 'regras', 'ajustes', 'conta'].includes(first) ? first : 'menu');
connect().then(async (u) => {
  if (!u) return;
  myName = (await displayName(u)).split(' ')[0];
  applyCosmetics();
  if (current() === 'menu' && !isModal()) go('menu');
}).catch(() => {});
document.addEventListener('arcana:meta', () => {});
void prefs; void closeModal; void modal;
