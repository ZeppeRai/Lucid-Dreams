import './styles.css';
import { sb, garantirLogin } from './supabase.js';
import { rollDice, tally, verdict } from './dice.js';
import { animarRolagem } from './dice-ui.js';

const $ = id => document.getElementById(id);
const CHAVE = 'ld.sala';
const estado = { sala: null, eu: null, jogadores: new Map(), canal: null, vistas: new Set() };

function mostrar(tela) {
  $('tela-inicio').hidden = tela !== 'inicio';
  $('tela-mesa').hidden = tela !== 'mesa';
}
const erro = msg => { $('erro').textContent = msg ?? ''; };

// ───────── Entrada ─────────
async function criarMesa() {
  const { data, error } = await sb.rpc('create_room', { p_name: nome(), p_color: $('cor').value });
  if (error) return erro(error.message);
  await entrar(data.id);
}

async function entrarPorCodigo() {
  const { data, error } = await sb.rpc('join_room', {
    p_code: $('codigo').value, p_name: nome(), p_color: $('cor').value,
  });
  if (error) return erro(error.message);
  await entrar(data.room_id);
}

function nome() {
  const n = $('nome').value.trim();
  if (!n) throw new Error('Digite seu nome.');
  return n;
}

async function entrar(roomId) {
  const { data: sala, error } = await sb.from('rooms').select().eq('id', roomId).single();
  if (error) { localStorage.removeItem(CHAVE); return mostrar('inicio'); }
  const { data: { session } } = await sb.auth.getSession();
  estado.sala = sala;
  localStorage.setItem(CHAVE, sala.id);
  await carregarJogadores();
  estado.eu = [...estado.jogadores.values()].find(p => p.user_id === session.user.id);
  $('mesa-codigo').textContent = sala.code;
  $('mesa-eu').textContent = estado.eu.name + (estado.eu.role === 'gm' ? ' · Mestre' : '');
  $('r-secreta-box').hidden = estado.eu.role !== 'gm';
  mostrar('mesa');
  assinar();
}

async function sair() {
  if (estado.canal) await sb.removeChannel(estado.canal);
  localStorage.removeItem(CHAVE);
  Object.assign(estado, { sala: null, eu: null, canal: null });
  estado.vistas.clear();
  $('historico').replaceChildren();
  mostrar('inicio');
}

// ───────── Estado e tempo real ─────────
async function carregarJogadores() {
  const { data } = await sb.from('players').select().eq('room_id', estado.sala.id);
  estado.jogadores = new Map(data.map(p => [p.id, p]));
  const ul = $('jogadores');
  ul.replaceChildren(...data.map(p => {
    const li = document.createElement('li');
    li.style.setProperty('--c', p.color);
    li.textContent = p.name;
    return li;
  }));
}

async function carregarHistorico() {
  const { data } = await sb.from('rolls').select().eq('room_id', estado.sala.id)
    .order('created_at', { ascending: false }).limit(20);
  $('historico').replaceChildren();
  estado.vistas = new Set(data.map(r => r.id));
  data.reverse().forEach(adicionarHistorico); // estado antigo: sem animação
}

function assinar() {
  const f = 'room_id=eq.' + estado.sala.id;
  estado.canal = sb.channel('mesa-' + estado.sala.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rolls', filter: f },
      ({ new: r }) => mostrarRolagem(r))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: f },
      carregarJogadores)
    .subscribe(status => { if (status === 'SUBSCRIBED') carregarJogadores().then(carregarHistorico); });
}

// ───────── Rolagem ─────────
async function rolar(e) {
  e.preventDefault();
  const qtd = Math.min(30, Math.max(1, +$('r-qtd').value || 1));
  const pr = Math.max(0, +$('r-pr').value || 0);
  const dice = rollDice(qtd);
  const { successes, stumbles } = tally(dice, pr);
  const { error } = await sb.from('rolls').insert({
    room_id: estado.sala.id, player_id: estado.eu.id, label: $('r-label').value.trim() || null,
    dice, auto: pr, successes, stumbles,
    difficulty: +$('r-dif').value || null,
    secret: estado.eu.role === 'gm' && $('r-secreta').checked,
  });
  if (error) erro(error.message);
}

// Todos (inclusive quem rolou) animam o mesmo resultado vindo do banco.
function mostrarRolagem(r) {
  if (estado.vistas.has(r.id)) return;
  estado.vistas.add(r.id);
  animarRolagem($('caixa-dados'), r.dice);
  const v = verdict(r.successes, r.difficulty);
  const quem = estado.jogadores.get(r.player_id)?.name ?? '?';
  const texto = `${quem}: ${r.successes} sucesso(s)` + (r.stumbles ? `, ${r.stumbles} tropeço(s)` : '') + (v ? ` — ${v}` : '');
  setTimeout(() => { $('resumo').textContent = texto; }, 600 + r.dice.length * 150);
  adicionarHistorico(r);
}

function adicionarHistorico(r) {
  const li = document.createElement('li');
  const quem = estado.jogadores.get(r.player_id)?.name ?? '?';
  li.textContent = `${quem}${r.label ? ' · ' + r.label : ''}${r.secret ? ' (secreta)' : ''}: [${r.dice.join(' ')}]` +
    `${r.auto ? ' +' + r.auto + ' PR' : ''} → ${r.successes} sucesso(s)${r.stumbles ? ', ' + r.stumbles + ' tropeço(s)' : ''}`;
  const lista = $('historico');
  lista.prepend(li);
  while (lista.children.length > 20) lista.lastChild.remove();
}

// ───────── Início ─────────
const seguro = fn => async (...a) => { erro(); try { await fn(...a); } catch (e) { erro(e.message); } };
$('btn-criar').onclick = seguro(criarMesa);
$('btn-entrar').onclick = seguro(entrarPorCodigo);
$('btn-sair').onclick = seguro(sair);
$('form-rolar').onsubmit = seguro(rolar);

(async () => {
  try {
    await garantirLogin();
    const salva = localStorage.getItem(CHAVE);
    if (salva) await entrar(salva); else mostrar('inicio');
  } catch (e) { mostrar('inicio'); erro('Falha ao conectar: ' + e.message); }
})();
