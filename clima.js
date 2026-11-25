// Estações e tempo do mundo dela. Usado pelo site e pelo cérebro, então os dois sempre concordam.
// Cada estação dura 7 dias (um "ano" tem 28 dias). O tempo muda a cada bloco de 3 horas.

export const ESTACOES = ['primavera', 'verao', 'outono', 'inverno'];
export const NOME_ESTACAO = { primavera: 'Primavera', verao: 'Verão', outono: 'Outono', inverno: 'Inverno' };
export const EMOJI_ESTACAO = { primavera: '🌸', verao: '☀️', outono: '🍂', inverno: '❄️' };
export const NOME_TEMPO = {
  sol: 'céu limpo', nublado: 'nublado', chuva: 'chovendo', garoa: 'garoando', trovoada: 'trovoada',
  neve: 'nevando', neblina: 'neblina', vento: 'ventando', geada: 'geada', calor: 'calorão',
};

const TEMPOS = {
  primavera: [['sol', 5], ['nublado', 3], ['chuva', 3], ['garoa', 2], ['vento', 2], ['neblina', 1]],
  verao: [['sol', 7], ['calor', 4], ['nublado', 2], ['trovoada', 3], ['chuva', 2]],
  outono: [['sol', 3], ['nublado', 4], ['vento', 4], ['chuva', 3], ['neblina', 2]],
  inverno: [['nublado', 3], ['neve', 5], ['neblina', 3], ['sol', 2], ['geada', 2]],
};

// Tudo o que ela pode perceber. A "descricao" é o que ela vê, sem dizer o nome da coisa.
export const FENOMENOS = {
  sol: { nome: 'sol', emoji: '☀️', descricao: 'o céu está claro e uma bola de luz quente brilha lá em cima' },
  nublado: { nome: 'nuvens', emoji: '☁️', descricao: 'o céu ficou cinza, cheio de manchas grandes e fofas que escondem a luz' },
  chuva: { nome: 'chuva', emoji: '🌧️', descricao: 'gotas de água caem do céu sem parar; tudo fica molhado e faz um barulhinho constante' },
  garoa: { nome: 'garoa', emoji: '🌦️', descricao: 'gotinhas de água muito finas flutuam e caem devagar; o ar está úmido' },
  trovoada: { nome: 'trovoada', emoji: '⛈️', descricao: 'o céu escureceu muito, de repente tudo clareia com um risco de luz e logo depois vem um estrondo enorme' },
  neve: { nome: 'neve', emoji: '🌨️', descricao: 'coisinhas brancas, macias e geladas caem do céu flutuando; o chão está ficando todo branco' },
  neblina: { nome: 'neblina', emoji: '🌫️', descricao: 'o ar ficou branco e opaco; não dá para ver longe e as árvores parecem sumir' },
  vento: { nome: 'vento', emoji: '🍃', descricao: 'algo invisível empurra a grama e as folhas; as árvores balançam e há um assobio no ar' },
  geada: { nome: 'geada', emoji: '🧊', descricao: 'a grama amanheceu coberta por uma camada branca e crocante, e o ar está gelado' },
  calor: { nome: 'calor', emoji: '🥵', descricao: 'o ar está quente e pesado; a luz lá em cima queima forte e dá vontade de ficar na água' },
  noite: { nome: 'noite', emoji: '🌙', descricao: 'está escuro; o céu ficou preto, cheio de pontinhos de luz, e há uma bola clara e fria lá em cima' },
  flores: { nome: 'flores', emoji: '🌸', descricao: 'apareceram coisinhas coloridas no chão, presas em hastes finas, com um cheiro doce' },
  'folhas-caindo': { nome: 'outono (folhas caindo)', emoji: '🍂', descricao: 'as folhas das árvores ficaram laranja e marrons e estão se soltando e caindo no chão' },
  'arvores-peladas': { nome: 'árvores sem folhas', emoji: '🌳', descricao: 'algumas árvores perderam todas as folhas; só sobraram os galhos' },
  frio: { nome: 'frio', emoji: '🥶', descricao: 'está muito frio; o corpo quer se encolher e a água do lago ficou dura' },
};

const DIA = 86400000;
const BLOCO = 3 * 3600000;

function aleatorio(n) {
  let x = Math.imul((n + 1) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Brasília não tem horário de verão desde 2019: UTC-3.
export const horaBrasilia = (data) => (((data.getTime() / 3600000 - 3) % 24) + 24) % 24;

export function climaEm(data = new Date(), nasceu) {
  const ms = data.getTime();
  const t0 = nasceu ? Date.parse(nasceu) : ms;
  const decorrido = Math.max(0, ms - t0);
  const dias = decorrido / DIA;
  const estacao = ESTACOES[Math.floor(dias / 7) % 4];
  const bloco = Math.floor(decorrido / BLOCO);
  let tempo = 'sol';
  if (dias >= 2) { // os dois primeiros dias são sempre de sol: ela se acostuma com o mundo assim
    const lista = TEMPOS[estacao];
    let r = aleatorio(bloco) * lista.reduce((s, [, p]) => s + p, 0);
    for (const [t, p] of lista) { if ((r -= p) <= 0) { tempo = t; break; } }
  }
  const hora = horaBrasilia(data);
  return {
    estacao, tempo, hora, bloco,
    diaDaEstacao: Math.floor(dias % 7) + 1,
    ano: Math.floor(dias / 28) + 1,
    noite: hora >= 18.5 || hora < 5.5,
  };
}

export function fenomenosDe(c) {
  const f = [c.tempo];
  if (c.noite) f.push('noite');
  if (c.estacao === 'primavera') f.push('flores');
  if (c.estacao === 'outono') f.push('folhas-caindo');
  if (c.estacao === 'inverno') f.push('arvores-peladas', 'frio');
  return [...new Set(f)];
}
