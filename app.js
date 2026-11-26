// O site: carrega a memória dela, mostra o mundo 3D e as abas.
// O "pensar" acontece na nuvem (brain/cerebro.mjs), algumas vezes por dia.

import { climaEm, fenomenosDe, FENOMENOS, NOME_ESTACAO, EMOJI_ESTACAO, NOME_TEMPO } from './clima.js';
import { renderizarDesenho } from './desenho.js';

const URLP = new URLSearchParams(location.search);
const DEMO = URLP.has('demo');
const $ = (s) => document.querySelector(s);
const OCUPADO_MIN = 25;   // depois de uma acordada, ela passa ~25 min fazendo aquilo
const INTERVALO_MIN = 60; // o "relógio" de .github/workflows/vida.yml chama a próxima acordada ~1 h depois da anterior
const FUSO = 'America/Sao_Paulo';

let dados = { estado: {}, pesquisas: [], perguntas: [], desenhos: [], diario: [], erro: null };
let mundo = null;

// ---------------------------------------------------------------- utilidades
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
  return e;
}
const sorteia = (l) => l[Math.floor(Math.random() * l.length)];
function quando(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 60000;
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${Math.round(diff)} min`;
  if (diff < 1440) return `há ${Math.round(diff / 60)} h`;
  if (diff < 1440 * 45) return `há ${Math.round(diff / 1440)} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}
const dataCurta = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const recentes = (l) => [...(l ?? [])].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
const porId = (lista, id) => lista.find((x) => x.id === id);

// ---------------------------------------------------------------- dados
async function carregar() {
  if (DEMO) { dados = demo(); return; }
  await Promise.all(Object.keys(dados).map(async (n) => {
    try {
      const r = await fetch(`data/${n}.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) dados[n] = await r.json();
    } catch { /* fica com o padrão */ }
  }));
}

// traços dos desenhos ficam em arquivos separados (para o site continuar leve)
const tracosCache = new Map();
function carregarTracos(d) {
  if (d.tracos) return Promise.resolve(d);
  if (!tracosCache.has(d.id)) {
    tracosCache.set(d.id, fetch(`drawings/${d.arquivo}`).then((r) => r.json()).then((j) => Object.assign(d, j)).catch(() => d));
  }
  return tracosCache.get(d.id);
}

function climaAgora() {
  const c = climaEm(new Date(), dados.estado?.nasceu);
  if (URLP.get('estacao')) c.estacao = URLP.get('estacao');
  if (URLP.get('tempo')) c.tempo = URLP.get('tempo');
  if (URLP.get('hora')) { c.hora = +URLP.get('hora'); c.noite = c.hora >= 18.5 || c.hora < 5.5; }
  return c;
}

// favoritos: escolhidos por você, guardados neste aparelho
const FAV = 'capivara-favoritos';
const favoritos = () => { try { return JSON.parse(localStorage.getItem(FAV)); } catch { return null; } };
const ehFavorito = (d) => (favoritos() ?? []).includes(d.id);
function alternarFavorito(d) {
  let f = favoritos() ?? [];
  if (f.includes(d.id)) f = f.filter((x) => x !== d.id);
  else { f = [...f, d.id]; if (f.length > 5) f = f.slice(-5); }
  localStorage.setItem(FAV, JSON.stringify(f));
}
function doMural() {
  const todos = recentes(dados.desenhos);
  const favs = todos.filter(ehFavorito);
  return [...favs, ...todos.filter((d) => !favs.includes(d))].slice(0, 5);
}
async function atualizarMural() {
  if (!mundo) return;
  const lista = doMural();
  await Promise.all(lista.map(carregarTracos));
  mundo.definirMural(lista);
}

// ---------------------------------------------------------------- o que ela está fazendo agora
function atividade() {
  const u = dados.estado?.ultimaAcao;
  if (!u?.quando) return null;
  const min = (Date.now() - Date.parse(u.quando)) / 60000;
  if (min < 0 || min >= OCUPADO_MIN) return null;
  // pesquisou e depois desenhou: primeira metade no computador, segunda na mesinha
  if (u.desenhoId && u.acao !== 'desenhar') {
    const meio = OCUPADO_MIN / 2;
    if (min >= meio) {
      const d = porId(dados.desenhos, u.desenhoId);
      return { acao: 'desenhar', tema: d?.titulo ?? '', desenhoId: u.desenhoId, quando: u.quando, progresso: (min - meio) / (meio * 0.85) };
    }
    return { ...u, progresso: min / (meio * 0.85) };
  }
  return { ...u, progresso: min / (OCUPADO_MIN * 0.85) };
}
function desenhoNaMesa() {
  const oc = atividade();
  const lista = recentes(dados.desenhos);
  const d = oc?.acao === 'desenhar' ? (porId(lista, oc.desenhoId) ?? lista[0]) : lista[0];
  if (!d) return null;
  carregarTracos(d);
  return { desenho: d, progresso: oc?.acao === 'desenhar' ? Math.min(1, oc.progresso) : 1 };
}
function novidade() {
  const ult = recentes(dados.diario)[0];
  if (!ult?.novidades?.length || Date.now() - Date.parse(ult.data) > 6 * 3600000) return null;
  const agora = fenomenosDe(climaAgora());
  return ult.novidades.find((n) => agora.includes(n.chave)) ?? null;
}

// O que ela fala sai só do que existe de verdade na memória dela (nada inventado),
// e ela evita repetir as últimas frases.
const jaDisse = [];
function frase(tipo) {
  if (!acordou()) return null; // antes da primeira acordada ela só dorme
  const e = dados.estado ?? {}, oc = atividade(), nov = novidade();
  const abertas = dados.perguntas.filter((p) => p.status === 'aguardando' || p.status === 'investigando');
  const pesq = recentes(dados.pesquisas), des = recentes(dados.desenhos);
  const c = climaAgora();
  const nomeDela = (k) => e.vistos?.[k]?.nome;
  const fato = pesq.flatMap((p) => p.aprendi ?? []).slice(0, 12);
  const por = {
    pesquisar: oc && oc.acao !== 'desenhar' && oc.acao !== 'descansar'
      ? [`hmm… ${oc.tema}`, 'deixa eu ler isso de novo…', 'que interessante', e.foco && `isso tem a ver com ${e.foco.tema}?`]
      : [pesq[0] && `lembrei de "${pesq[0].tema}"`, fato.length && sorteia(fato), abertas.length && `ainda não sei: ${sorteia(abertas).texto}`],
    desenhar: oc?.acao === 'desenhar'
      ? [`vou tentar desenhar ${oc.tema}`, des.length > 1 && 'quero fazer melhor que o último', 'com calma…']
      : [des[0] && `"${des[0].titulo}"… ${des[0].autocritica ?? ''}`.trim(), des.length > 1 && `o "${sorteia(des).titulo}" ficou bom?`],
    olharMural: des.length
      ? [`gosto de "${sorteia(des.slice(0, 5)).titulo}"`, des.length > 1 && des[des.length - 1].autocritica && `o primeiro… ${des[des.length - 1].autocritica}`, des.length >= 5 && 'eu fiz tudo isso?']
      : ['esse quadro ainda tá vazio', 'o que será que eu coloco aqui?'],
    olharCeu: [nov && 'o que é isso??', nov && (nomeDela(nov.chave) ? `${nomeDela(nov.chave)}…` : 'nunca vi isso antes…'),
      c.noite ? 'tantos pontinhos de luz…' : 'o céu muda o tempo todo', c.noite ? 'por que fica escuro?' : 'de onde vem essa luz?',
      c.tempo === 'neve' && 'é gelado e macio', c.tempo === 'chuva' && 'tô ficando molhada…', c.tempo === 'nublado' && 'o céu tá cinza hoje',
      c.tempo === 'vento' && 'algo invisível tá me empurrando'],
    farejar: [c.estacao === 'primavera' ? 'que cheiro doce' : 'hmm, cheiro de terra', 'o que será isso?', 'tem bichinhos aqui?', null],
    banho: ['ahhh…', 'a água tá fresquinha', 'consigo boiar!', 'meu corpo fica leve aqui', 'blub blub', c.tempo === 'calor' && 'que alívio desse calor', 'quietinha aqui…', null, null],
    lagoCongelado: ['a água ficou dura…', 'cadê meu banho?', 'tá escorregadio', nomeDela('frio') && `é o ${nomeDela('frio')}`],
    trovao: ['!!!', 'que barulho foi esse??', 'o céu rasgou?'],
    parado: [e.pensamento, abertas.length && sorteia(abertas).texto, e.interesses?.length && `ando pensando em ${sorteia(e.interesses)}`, e.foco && `${e.foco.tema}…`, 'hmm…', null],
  };
  const opcoes = (por[tipo] ?? por.parado).filter((x) => x !== false && x !== undefined && x !== '');
  const novas = opcoes.filter((x) => !jaDisse.includes(x));
  const escolha = sorteia(novas.length ? novas : opcoes) ?? null;
  if (escolha) { jaDisse.push(escolha); if (jaDisse.length > 8) jaDisse.shift(); }
  return escolha;
}
const acordou = () => DEMO || !!dados.estado?.nasceu;

let balaoTimer;
function falar(texto) {
  if (!texto) return;
  const b = $('#balao');
  b.textContent = texto.length > 110 ? texto.slice(0, 107) + '…' : texto;
  b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(balaoTimer);
  balaoTimer = setTimeout(() => (b.hidden = true), 5500);
}
function posicaoBalao(x, y, visivel) {
  const b = $('#balao');
  if (b.hidden) return;
  b.style.left = `${Math.min(92, Math.max(8, x * 100))}%`;
  b.style.top = `${Math.max(14, y * 100)}%`;
  b.style.visibility = visivel ? 'visible' : 'hidden';
}

// ---------------------------------------------------------------- cabeçalho
function atualizarTopo() {
  const e = dados.estado ?? {}, c = climaAgora();
  $('#nome').textContent = e.nome || 'Ainda sem nome';
  document.title = e.nome ? `${e.nome} · a capivara curiosa` : 'A capivara curiosa';
  $('#clima').textContent = `${EMOJI_ESTACAO[c.estacao]} ${NOME_ESTACAO[c.estacao]} · dia ${c.diaDaEstacao} de 7 · ${FENOMENOS[c.tempo].emoji} ${NOME_TEMPO[c.tempo]}`;
  if (e.nasceu) {
    const dias = Math.max(0, Math.floor((Date.now() - Date.parse(e.nasceu)) / 86400000));
    $('#idade').textContent = `${dias} dia${dias === 1 ? '' : 's'} de vida · ${e.acordadas ?? 0} acordadas` + (e.ultimaAcao?.quando ? ` · última ${quando(e.ultimaAcao.quando)}` : '');
  } else $('#idade').textContent = 'ainda não acordou';
  const er = dados.erro;
  const erroRecente = er?.data && (!e.ultimaAcao?.quando || er.data > e.ultimaAcao.quando);
  $('#erro').hidden = !erroRecente;
  if (erroRecente) $('#erro').textContent = `⚠ A acordada de ${dataCurta(er.data)} falhou. ${er.dica ?? ''} (${er.mensagem})`;
}

// ---------------------------------------------------------------- cronômetro da próxima acordada
// Ela acorda ~1 h depois da última acordada.
function proximaAcordada() {
  const ultima = Date.parse(dados.estado?.ultimaAcao?.quando ?? '') || Date.now();
  return new Date(ultima + INTERVALO_MIN * 60000);
}
function atualizarRelogio() {
  const agora = new Date();
  const ultima = Date.parse(dados.estado?.ultimaAcao?.quando ?? '') || 0;
  const prevista = new Date(proximaAcordada());
  // passou da hora e ainda não acordou: o GitHub atrasou (é comum), então pode ser a qualquer momento
  const atrasada = !DEMO && ultima && agora - prevista > 0;
  const s = Math.max(0, Math.floor((prevista - agora) / 1000));
  const hhmmss = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('#relogio').replaceChildren(...(atrasada
    ? ['⏳ pode acordar', el('strong', {}, 'a qualquer momento')]
    : ['⏰ próxima acordada em', el('strong', {}, `~${hhmmss}`)]));
}

// ---------------------------------------------------------------- abas
const ABAS = { ideias: abaIdeias, pesquisas: abaPesquisas, desenhos: abaDesenhos, diario: abaDiario };
let abaAtual = 'ideias', perguntaAberta = null, filtro = 'todas';
function mostrarAba(nome) {
  abaAtual = nome;
  document.querySelectorAll('.abas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === nome)));
  $('#conteudo').replaceChildren(...[ABAS[nome]()].flat(Infinity).filter(Boolean));
}
function irPara(aba, rolar = true) {
  mostrarAba(aba);
  if (rolar) $('.abas').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const listaFontes = (fontes = []) => fontes?.length ? [el('p', { class: 'rotulo' }, 'Fontes'),
  el('ul', { class: 'fontes' }, fontes.map((f) => el('li', {}, el('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.titulo || f.url), f.site ? ` · ${f.site}` : '')))] : null;
const listaSimples = (titulo, itens = []) => itens?.length ? [el('p', { class: 'rotulo' }, titulo), el('ul', {}, itens.map((i) => el('li', {}, i)))] : null;
const ROTULO = { aguardando: 'aguardando', investigando: 'em investigação', respondida: 'respondida', aposentada: 'aposentada' };
const selo = (status) => el('span', { class: `selo ${status}` }, ROTULO[status] ?? status);
function abrirPergunta(id) { perguntaAberta = id; irPara('ideias', false); }

function origemTexto(q) {
  const o = q.origem ?? {};
  if (o.tipo === 'observacao' && o.fenomeno) {
    const f = FENOMENOS[o.fenomeno];
    return `Nasceu quando viu ${f ? `${f.emoji} ${f.nome}` : 'algo'}${o.primeiraVez ? ' pela primeira vez' : ''}`;
  }
  if (o.tipo === 'observacao') return 'Nasceu de algo que ela viu lá fora';
  if (o.tipo === 'pesquisa' || o.tipo === 'resposta') return `Nasceu pesquisando "${o.texto ?? '?'}"`;
  return 'Nasceu de um pensamento';
}

function abaIdeias() {
  if (perguntaAberta) {
    const q = porId(dados.perguntas, perguntaAberta);
    if (q) return el('div', { class: 'ideias' }, fluxoDaPergunta(q));
    perguntaAberta = null;
  }
  const e = dados.estado ?? {};
  const todas = recentes(dados.perguntas);
  const ordem = { investigando: 0, aguardando: 1, respondida: 2, aposentada: 3 };
  const lista = todas.filter((q) => filtro === 'todas' || q.status === filtro).sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9));
  const conta = (s) => todas.filter((q) => q.status === s).length;
  return el('div', { class: 'ideias' },
    el('h2', {}, 'Investigações'),
    e.foco ? el('div', { class: 'cartao' },
      el('h3', {}, e.foco.tema, ' ', el('span', { class: 'selo foco' }, 'em foco')),
      e.foco.motivo && el('p', { class: 'porque' }, `Por quê: ${e.foco.motivo}`),
      el('p', { class: 'meta' }, `Desde ${quando(e.foco.desde)} · ${e.foco.pesquisas ?? 0} pesquisas · ${e.foco.desenhos ?? 0} desenhos`))
      : el('p', { class: 'meta' }, 'Nenhuma investigação em foco agora.'),
    (e.focosAnteriores ?? []).length ? el('details', { class: 'cartao' }, el('summary', { class: 'meta' }, `Investigações concluídas (${e.focosAnteriores.length})`),
      [...e.focosAnteriores].reverse().map((f) => el('div', {}, el('p', {}, el('strong', {}, f.tema), el('span', { class: 'meta' }, ` · ${dataCurta(f.desde)} → ${dataCurta(f.ate)}`)), f.conclusao && el('p', { class: 'porque' }, f.conclusao)))) : null,
    el('h2', {}, 'Perguntas dela'),
    el('div', { class: 'filtros' }, ['todas', 'investigando', 'aguardando', 'respondida', 'aposentada'].map((f) =>
      el('button', { 'aria-pressed': String(filtro === f), onclick: () => { filtro = f; mostrarAba('ideias'); } },
        f === 'todas' ? `todas (${todas.length})` : `${ROTULO[f]} (${conta(f)})`))),
    lista.length ? lista.map((q) => el('div', { class: 'cartao pergunta-item', onclick: () => abrirPergunta(q.id), tabindex: 0, role: 'button' },
      el('p', {}, q.texto),
      el('span', { class: 'meta' }, selo(q.status), ` ${dataCurta(q.data)} · ${(q.tentativas ?? []).length} tentativa${(q.tentativas ?? []).length === 1 ? '' : 's'}`)))
      : el('p', { class: 'meta' }, todas.length ? 'Nada aqui.' : 'Nenhuma dúvida ainda. Elas aparecem conforme ela vive e pesquisa.'));
}

function fluxoDaPergunta(q) {
  const pai = q.pai && porId(dados.perguntas, q.pai);
  const filhas = (q.filhas ?? []).map((id) => porId(dados.perguntas, id)).filter(Boolean);
  const tent = q.tentativas ?? [];
  return [
    el('button', { class: 'voltar', onclick: () => { perguntaAberta = null; mostrarAba('ideias'); } }, '← voltar às perguntas'),
    el('h2', {}, 'Fluxo da pergunta'),
    el('div', { class: 'fluxo' },
      el('div', { class: 'cartao' },
        el('p', { class: 'rotulo' }, 'Pergunta ', selo(q.status)),
        el('h3', {}, q.texto),
        el('p', { class: 'meta' }, `${dataCurta(q.data)} · ${origemTexto(q)}`),
        pai && el('p', { class: 'meta' }, 'Veio da dúvida: ', el('button', { class: 'linkbtn', onclick: () => abrirPergunta(pai.id) }, pai.texto))),
      tent.length ? tent.map((t, i) => [
        el('div', { class: 'seta' }, '↓'),
        el('div', { class: 'cartao' },
          el('p', { class: 'rotulo' }, `Tentativa ${i + 1} · ${dataCurta(t.data)}`),
          t.busca && el('p', { class: 'meta' }, `Pesquisou: "${t.busca}"`),
          el('p', {}, t.resposta),
          el('p', { class: 'meta' }, t.satisfeito ? '✓ ficou satisfeita com a resposta' : '… ainda não ficou satisfeita'),
          listaFontes(t.fontes)),
      ]) : [el('div', { class: 'seta' }, '↓'), el('p', { class: 'meta', style: 'text-align:center' }, 'aguardando investigação')],
      q.status === 'aposentada' && [el('div', { class: 'seta' }, '↓'), el('div', { class: 'cartao' }, el('p', { class: 'rotulo' }, 'Aposentada'), el('p', {}, 'Depois de 3 tentativas sem achar uma resposta que a satisfizesse, ela deixou essa de lado.'))],
      filhas.length > 0 && [el('div', { class: 'seta' }, '↓'), el('div', { class: 'cartao' },
        el('p', { class: 'rotulo' }, 'Novas perguntas que nasceram daqui'),
        el('ul', {}, filhas.map((f) => el('li', {}, el('button', { class: 'linkbtn', onclick: () => abrirPergunta(f.id) }, f.texto), ' ', selo(f.status)))))]),
  ];
}

function abaPesquisas() {
  const l = recentes(dados.pesquisas);
  if (!l.length) return el('p', { class: 'vazio' }, 'Ainda não pesquisou nada. Logo ela vai até o computador.');
  return l.map((p, i) => {
    const geradas = (p.perguntasGeradas ?? []).map((id) => porId(dados.perguntas, id)).filter(Boolean);
    const origem = p.perguntaId && porId(dados.perguntas, p.perguntaId);
    return el('article', { class: 'cartao' }, el('details', { open: i === 0 },
      el('summary', {}, el('h3', {}, p.tema, ' ', p.foco && el('span', { class: 'selo foco' }, 'investigação')),
        el('span', { class: 'meta' }, `${dataCurta(p.data)} · ${quando(p.data)}${p.buscas?.length ? ` · buscou ${p.buscas.map((b) => `"${b}"`).join(' → ')}` : p.busca ? ` · buscou "${p.busca}"` : ''}`)),
      origem && el('p', { class: 'meta' }, 'Tentando responder: ', el('button', { class: 'linkbtn', onclick: () => abrirPergunta(origem.id) }, origem.texto)),
      p.porque && el('p', { class: 'porque' }, `Por quê: ${p.porque}`),
      p.resumo && el('p', {}, p.resumo),
      listaSimples('O que aprendeu', p.aprendi),
      geradas.length > 0 && [el('p', { class: 'rotulo' }, 'Dúvidas que surgiram'), el('ul', {}, geradas.map((q) => el('li', {}, el('button', { class: 'linkbtn', onclick: () => abrirPergunta(q.id) }, q.texto))))],
      p.sentimento && el('p', { class: 'meta' }, `Como se sentiu: ${p.sentimento}`),
      listaFontes(p.fontes)));
  });
}

function telaDesenho(d, tamanho = 300) {
  const cv = el('canvas', { width: tamanho, height: tamanho, 'aria-label': d.titulo });
  renderizarDesenho(cv, null);
  carregarTracos(d).then(() => renderizarDesenho(cv, d));
  return cv;
}
function cartaoObra(d) {
  return el('div', { class: 'obra', onclick: () => abrirDesenho(d) },
    telaDesenho(d), el('p', {}, d.titulo), el('span', { class: 'meta' }, `nº ${d.numero ?? '?'} · ${quando(d.data)}`),
    el('button', {
      class: `estrela-fav ${ehFavorito(d) ? 'ligada' : ''}`, 'aria-label': 'Colocar no mural', title: 'Colocar no mural',
      onclick: (ev) => { ev.stopPropagation(); alternarFavorito(d); atualizarMural(); mostrarAba('desenhos'); },
    }, '★'));
}
function abaDesenhos() {
  const l = recentes(dados.desenhos);
  if (!l.length) return el('p', { class: 'vazio' }, 'A mesinha ainda está vazia.');
  return [
    el('h2', { class: 'secao' }, 'No mural (top 5)'),
    el('p', { class: 'dica' }, 'Toque na ★ para escolher os 5 que ficam no mural. Sem escolha, ficam os mais recentes.'),
    el('div', { class: 'galeria' }, doMural().map(cartaoObra)),
    el('h2', { class: 'secao' }, `Todos (${l.length})`),
    el('div', { class: 'galeria' }, l.map(cartaoObra)),
  ];
}
function abrirDesenho(d) {
  $('#visor-corpo').replaceChildren(
    telaDesenho(d, 600),
    el('h3', {}, d.titulo), el('p', { class: 'meta' }, `Desenho nº ${d.numero ?? '?'} · ${dataCurta(d.data)}`),
    d.porque && el('p', { class: 'porque' }, `Por quê: ${d.porque}`),
    d.autocritica && [el('p', { class: 'rotulo' }, 'O que ela achou'), el('p', {}, d.autocritica)]);
  $('#visor').showModal();
}

function abaDiario() {
  const l = recentes(dados.diario);
  if (!l.length) return el('p', { class: 'vazio' }, 'O diário está em branco.');
  const verbo = { pesquisar: 'Pesquisou', responder: 'Tentou responder', desenhar: 'Desenhou', descansar: 'Descansou', nascer: 'Acordou pela primeira vez' };
  return el('div', { class: 'cartao' }, l.map((d) => el('div', { class: 'diario-item' },
    el('span', { class: 'meta' }, dataCurta(d.data), d.clima && el('br'), d.clima && `${EMOJI_ESTACAO[d.clima.estacao] ?? ''} ${NOME_TEMPO[d.clima.tempo] ?? ''}`),
    el('div', {},
      (d.novidades ?? []).map((n) => el('div', { class: 'destaque' },
        el('strong', {}, `✨ Primeira vez que viu: ${FENOMENOS[n.chave]?.emoji ?? ''} ${FENOMENOS[n.chave]?.nome ?? n.chave}`),
        n.nomeDela && el('span', { class: 'meta' }, ` · ela chamou de "${n.nomeDela}"`))),
      el('p', {}, el('strong', {}, `${verbo[d.acao] ?? d.acao}${d.tema ? `: ${d.tema}` : ''}`)),
      d.pensamento && el('p', { class: 'porque' }, `“${d.pensamento}”`),
      d.porque && el('p', { class: 'meta' }, `Por quê: ${d.porque}`),
      d.resultado && el('p', { class: 'meta' }, d.resultado)))));
}

// ---------------------------------------------------------------- início
async function iniciar() {
  await carregar();
  atualizarTopo();
  atualizarRelogio(); setInterval(atualizarRelogio, 1000);
  document.querySelectorAll('.abas button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.aba === 'ideias') perguntaAberta = null; mostrarAba(b.dataset.aba); }));
  mostrarAba(abaAtual);
  try {
    const { criarMundo } = await import('./mundo.js');
    mundo = criarMundo($('#mundo'), {
      atividade, desenhoNaMesa, novidade, frase, falar, posicaoBalao, acordou,
      temPesquisas: () => dados.pesquisas.length > 0,
      temDesenhos: () => dados.desenhos.length > 0,
      status: (t) => { $('#status').textContent = t; },
      abrir: (aba) => irPara(aba),
    });
    mundo.definirClima(climaAgora());
    atualizarMural();
  } catch (e) {
    console.error(e);
    $('#mundo').append(el('p', { class: 'vazio' }, 'Não consegui carregar o mundo 3D neste aparelho.'));
  }
  setInterval(() => { atualizarTopo(); mundo?.definirClima(climaAgora()); }, 60000);
  setInterval(async () => { await carregar(); atualizarTopo(); atualizarMural(); if (!perguntaAberta) mostrarAba(abaAtual); }, 600000);
}
iniciar();

// ---------------------------------------------------------------- dados de exemplo (?demo)
function demo() {
  const h = (min) => new Date(Date.now() - min * 60000).toISOString();
  const circ = (cx, cy, rx, ry = rx, n = 14, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n; return [Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry)];
  }).flat();
  const gato = (cor) => [
    { c: cor, p: circ(100, 110, 50, 44, 16) },
    { c: cor, p: [62, 82, 66, 40, 88, 68] }, { c: cor, p: [112, 68, 134, 40, 138, 82] },
    { c: cor, p: circ(82, 104, 6, 6, 8) }, { c: cor, p: circ(118, 104, 6, 6, 8) },
    { c: cor, p: [96, 122, 100, 127, 104, 122] }, { c: cor, p: [100, 127, 94, 136, 88, 134] }, { c: cor, p: [100, 127, 106, 136, 112, 134] },
    { c: cor, p: [70, 124, 36, 118] }, { c: cor, p: [70, 130, 38, 136] }, { c: cor, p: [130, 124, 164, 118] }, { c: cor, p: [130, 130, 162, 136] },
  ];
  const chuva = Array.from({ length: 16 }, (_, i) => ({ p: [20 + (i * 47) % 160, 20 + (i * 31) % 120, 16 + (i * 47) % 160, 44 + (i * 31) % 120] }));
  chuva.push({ p: [10, 180, 60, 172, 110, 182, 190, 176] });
  const pincel = [{ p: [100, 190, 100, 110] }, { p: [86, 110, 114, 110, 114, 96, 86, 96, 86, 110] },
    ...[80, 88, 96, 104, 112, 120].map((x) => ({ p: [x - 2, 96, x, 70, x + 3, 40] }))];
  const neve = [{ p: circ(100, 60, 30) }, { p: circ(100, 130, 45) }, { p: [88, 54, 89, 55] }, { p: [112, 54, 113, 55] }, { p: [92, 72, 100, 76, 108, 72] },
    ...Array.from({ length: 12 }, (_, i) => ({ p: [15 + (i * 53) % 170, 10 + (i * 37) % 60, 17 + (i * 53) % 170, 12 + (i * 37) % 60] }))];
  const desenhos = [
    { id: 'd5', numero: 5, data: h(20), titulo: 'as coisas brancas', porque: 'quero lembrar como era', autocritica: 'Não sei desenhar algo que cai devagar.', tracos: neve, tremor: 1.6 },
    { id: 'd4', numero: 4, data: h(900), titulo: 'gato de novo', porque: 'continuo pensando nos animais', autocritica: 'Os bigodes ficaram melhores.', tracos: gato('#2b4c9b'), tremor: 1.4 },
    { id: 'd3', numero: 3, data: h(1500), titulo: 'um gato', porque: 'li sobre animais e gostei desse', autocritica: 'As orelhas ficaram tortas, mas parece um gato.', tracos: gato('#2b4c9b'), tremor: 2.4 },
    { id: 'd2', numero: 2, data: h(2500), titulo: 'chuva', porque: 'aprendi de onde vem a chuva', autocritica: 'Parecem riscos. É isso mesmo?', tracos: chuva, tremor: 2.6 },
    { id: 'd1', numero: 1, data: h(4000), titulo: 'uma escultura', porque: 'pesquisei sobre esculturas', autocritica: 'Ficou parecendo um pincel.', tracos: pincel, tremor: 2.8 },
  ];
  const W = (t) => ({ titulo: t, url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(t)}`, site: 'Wikipédia (pt)' });
  return {
    estado: {
      nome: 'Jabuticaba', nasceu: h(60 * 24 * 22), acordadas: 170, pensamento: 'De onde vêm as coisas brancas que caíram?', humor: 'maravilhada',
      interesses: ['chuva', 'animais', 'esculturas', 'gelo'],
      ultimaAcao: { acao: 'desenhar', tema: 'as coisas brancas', quando: h(20), desenhoId: 'd5' },
      vistos: { sol: { nome: 'a bola quente' }, chuva: { nome: 'chuva' }, neve: { nome: 'algodão gelado' }, noite: { nome: 'noite' } },
      foco: { tema: 'o frio e as coisas brancas', motivo: 'Tudo ficou branco de repente e eu preciso entender.', desde: h(300), pesquisas: 2, desenhos: 1 },
      focosAnteriores: [{ tema: 'animais', desde: h(3000), ate: h(800), conclusao: 'Existem muitos tipos de bichos. Os gatos são meus favoritos.' }],
    },
    pesquisas: [
      { id: 'p2', data: h(300), tema: 'coisas brancas caindo do céu', porque: 'Nunca vi isso. Está tudo branco e gelado.', busca: 'neve', foco: 'o frio e as coisas brancas',
        resumo: 'Isso se chama neve! São cristais de gelo que se formam nas nuvens quando faz muito frio, e caem flutuando.', aprendi: ['Neve é água congelada', 'Cada floco é um cristal', 'Só acontece quando faz muito frio'],
        perguntasGeradas: ['q1'], sentimento: 'Fiquei aliviada de saber o nome.', fontes: [W('Neve')] },
      { id: 'p1', data: h(3100), tema: 'de onde vem a chuva', porque: 'Ouvi um barulhinho em cima de mim.', busca: 'chuva',
        resumo: 'A chuva é água que sobe como vapor, vira nuvem e cai de volta quando as gotas ficam pesadas.', aprendi: ['A água evapora com o calor', 'Nuvens são gotinhas'], perguntasGeradas: ['q3'], fontes: [W('Chuva')] },
    ],
    perguntas: [
      { id: 'q1', data: h(300), texto: 'Por que fica frio de repente?', origem: { tipo: 'pesquisa', texto: 'coisas brancas caindo do céu' }, pai: 'q0', status: 'investigando', filhas: [],
        tentativas: [{ data: h(120), busca: 'frio inverno', resposta: 'Li sobre inverno, mas não entendi por que ele chega. Parece que tem a ver com o sol.', satisfeito: false, fontes: [W('Inverno')] }] },
      { id: 'q0', data: h(310), texto: 'O que são essas coisas brancas que caem do céu?', origem: { tipo: 'observacao', fenomeno: 'neve', primeiraVez: true }, status: 'respondida', filhas: ['q1'],
        tentativas: [{ data: h(300), busca: 'neve', resposta: 'É neve: gelo que cai das nuvens quando faz muito frio.', satisfeito: true, fontes: [W('Neve')] }] },
      { id: 'q3', data: h(3100), texto: 'Para onde vai a água depois que cai?', origem: { tipo: 'pesquisa', texto: 'de onde vem a chuva' }, status: 'aguardando', filhas: [], tentativas: [] },
      { id: 'q4', data: h(5000), texto: 'O que existe depois da borda da ilha?', origem: { tipo: 'pensamento' }, status: 'aposentada', filhas: [],
        tentativas: [1, 2, 3].map((i) => ({ data: h(5000 - i * 200), busca: 'borda do mundo', resposta: 'Não achei nada que explicasse.', satisfeito: false, fontes: [] })) },
    ],
    desenhos,
    diario: [
      { data: h(20), acao: 'desenhar', tema: 'as coisas brancas', pensamento: 'Quero guardar isso.', clima: { estacao: 'inverno', tempo: 'neve' } },
      { data: h(310), acao: 'pesquisar', tema: 'coisas brancas caindo do céu', pensamento: 'O que é ISSO? Está tudo branco!', porque: 'Nunca vi isso.',
        novidades: [{ chave: 'neve', nomeDela: 'algodão gelado' }], clima: { estacao: 'inverno', tempo: 'neve' } },
      { data: h(60 * 24 * 22), acao: 'nascer', pensamento: 'Onde eu estou?', clima: { estacao: 'primavera', tempo: 'sol' } },
    ],
  };
}
