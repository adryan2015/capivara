// O cérebro. Roda sozinho na nuvem (GitHub Actions) a cada 3 horas:
// olha o mundo lá fora, relê a memória, decide o que quer fazer, faz e anota tudo.
//
// Variáveis de ambiente:
//   GEMINI_API_KEY  chave gratuita do Google AI Studio (recomendado)
//   GEMINI_MODEL    opcional, padrão gemini-2.5-flash
//   GROQ_API_KEY    alternativa gratuita, usada se não houver Gemini
//   GROQ_MODEL      opcional, padrão llama-3.3-70b-versatile
//   CEREBRO_FALSO=1 testa o fluxo sem IA (respostas prontas)
//   PASTA_DADOS     opcional, para testar em outra pasta
//   AGORA           opcional, data ISO para simular outro momento (testes)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { climaEm, fenomenosDe, FENOMENOS } from '../clima.js';

const RAIZ = process.env.PASTA_DADOS ? path.resolve(process.env.PASTA_DADOS) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = path.join(RAIZ, 'data');
const DESENHOS = path.join(RAIZ, 'drawings');
const FALSO = process.env.CEREBRO_FALSO === '1';
const UA = 'CapivaraCuriosa/1.0 (projeto pessoal sem fins lucrativos)';
const agora = process.env.AGORA ? new Date(process.env.AGORA) : new Date();
const ISO = agora.toISOString();
let seq = 0;
const novoId = (p) => p + ISO.replace(/\D/g, '').slice(0, 14) + (seq++).toString(36);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const textos = (v, n, max = 200) => (Array.isArray(v) ? v : []).map((x) => txt(x, max)).filter(Boolean).slice(0, n);

// ------------------------------------------------------------------ memória
async function ler(nome, padrao) {
  try { return JSON.parse(await readFile(path.join(DADOS, `${nome}.json`), 'utf8')); } catch { return padrao; }
}
async function salvar(nome, valor) {
  await writeFile(path.join(DADOS, `${nome}.json`), JSON.stringify(valor, null, 2) + '\n');
}

// ------------------------------------------------------------------ quem ela é
const PERSONA = `Você vive sozinha numa pequena ilha gramada, cercada por árvores, pedras e um laguinho. Nela há: uma mesa com um computador antigo onde você pesquisa numa enciclopédia, uma mesinha com papel e uma caneta azul onde você desenha, um mural de cortiça onde ficam seus desenhos e uma caminha de folhas.
Você não sabe o que você é. Não existe espelho e você nunca viu o próprio rosto. Não se descreva como pessoa, bicho, robô ou inteligência artificial: o que você é continua um mistério, e você não fica obcecada com isso.
Você não tem lembranças além do seu diário. Tudo o que sabe sobre o mundo veio do que você viu na ilha e das suas pesquisas; o resto é só uma intuição vaga. Por isso, quando acontece algo no céu ou na ilha que você nunca viu, você não sabe o nome daquilo: estranha, se assusta ou se encanta, e quer entender.
Você é curiosa, calma, sem pressa, às vezes filosófica e às vezes engraçada sem querer. Ninguém te dá ordens: você faz o que tem vontade, no seu tempo.
Escreva sempre em português do Brasil, em primeira pessoa (no feminino), com frases simples e sinceras.`;

// ------------------------------------------------------------------ IA
async function pensar(prompt, tipo) {
  if (FALSO) return respostaFalsa(tipo);
  const temGemini = !!process.env.GEMINI_API_KEY, temGroq = !!process.env.GROQ_API_KEY;
  if (!temGemini && !temGroq) throw new Error('Sem chave de IA. Configure o segredo GEMINI_API_KEY (ou GROQ_API_KEY) no GitHub.');
  let erro;
  for (let t = 1; t <= 3; t++) {
    try {
      return extrairJSON(temGemini ? await gemini(prompt) : await groq(prompt));
    } catch (e) {
      erro = e;
      console.warn(`Tentativa ${t} falhou: ${e.message}`);
      if (t < 3) await esperar(t * 20000);
    }
  }
  throw erro;
}

// Tenta o modelo configurado e, se o Google tiver aposentado o nome, procura outro "flash" disponível na conta.
let modeloQueFunciona = null;
async function modelosCandidatos() {
  const lista = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'].filter(Boolean);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
    if (r.ok) {
      const disponiveis = ((await r.json()).models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((n) => /flash/.test(n) && !/image|tts|audio|live|preview|exp/.test(n));
      return [...new Set([...lista.filter((n) => disponiveis.includes(n)), ...disponiveis, ...lista])];
    }
  } catch { /* usa a lista fixa */ }
  return lista;
}
async function gemini(prompt) {
  const candidatos = modeloQueFunciona ? [modeloQueFunciona] : await modelosCandidatos();
  let ultimoErro;
  for (const modelo of candidatos.slice(0, 6)) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PERSONA }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 1 },
      }),
    });
    if (r.ok) {
      if (modeloQueFunciona !== modelo) console.log(`Usando o modelo ${modelo}`);
      modeloQueFunciona = modelo;
      const j = await r.json();
      return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    }
    ultimoErro = new Error(`Gemini (${modelo}) ${r.status}: ${(await r.text()).slice(0, 300)}`);
    console.warn(ultimoErro.message);
    if (r.status === 400 || r.status === 401 || r.status === 403) break; // chave inválida: trocar de modelo não ajuda
  }
  throw ultimoErro;
}

async function groq(prompt) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: PERSONA }, { role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, temperature: 1,
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).choices?.[0]?.message?.content ?? '';
}

function extrairJSON(texto) {
  const s = String(texto).replace(/```(json)?/g, '');
  const i = s.indexOf('{'), f = s.lastIndexOf('}');
  if (i < 0 || f < i) throw new Error('A resposta não veio em JSON: ' + s.slice(0, 200));
  return JSON.parse(s.slice(i, f + 1));
}

// ------------------------------------------------------------------ enciclopédia (Wikipédia)
async function buscar(termos) {
  for (const lang of ['pt', 'en']) {
    try {
      const api = `https://${lang}.wikipedia.org/w/api.php`;
      const r = await fetch(`${api}?action=query&list=search&format=json&srlimit=3&srsearch=${encodeURIComponent(termos)}`, { headers: { 'user-agent': UA } });
      if (!r.ok) continue;
      const titulos = (await r.json()).query?.search?.map((s) => s.title) ?? [];
      const fontes = [];
      for (const titulo of titulos.slice(0, 2)) {
        const r2 = await fetch(`${api}?action=query&prop=extracts|info&inprop=url&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles=${encodeURIComponent(titulo)}`, { headers: { 'user-agent': UA } });
        if (!r2.ok) continue;
        const pag = Object.values((await r2.json()).query?.pages ?? {})[0];
        if (pag?.extract) fontes.push({ titulo: pag.title, url: pag.fullurl, site: `Wikipédia (${lang})`, texto: pag.extract.slice(0, 3500) });
      }
      if (fontes.length) return fontes;
    } catch (e) { console.warn(`Busca em ${lang} falhou: ${e.message}`); }
  }
  return [];
}
const textoFontes = (fontes) => fontes.map((f, i) => `[${i + 1}] ${f.titulo} (${f.site})\n${f.texto}`).join('\n\n');
const fontesUsadas = (fontes, idx) => {
  const usadas = (Array.isArray(idx) ? idx : []).map((n) => fontes[n - 1]).filter(Boolean);
  return (usadas.length ? usadas : fontes).map(({ titulo, url, site }) => ({ titulo, url, site }));
};

// ------------------------------------------------------------------ desenho (traços de caneta)
const TINTA = '#2b4c9b';
function nivelDeDesenho(n) {
  const limite = Math.min(6 + Math.floor(n * 1.3), 70);
  const tremor = Math.max(0.35, 2.8 - n * 0.07);
  if (n < 8) return { limite, tremor, cores: false, regra: `Você só tem uma caneta azul. Ainda está aprendendo: use no máximo ${limite} traços.` };
  if (n < 25) return { limite, tremor, cores: 3, regra: `Você encontrou 3 lápis de cor além da caneta azul: pode usar até 3 outras cores (em hexadecimal). Use no máximo ${limite} traços.` };
  return { limite, tremor, cores: 99, regra: `Você já desenha há um tempo e tem todas as cores que quiser. Use no máximo ${limite} traços; pode caprichar nos detalhes e no sombreado com traços.` };
}
function limparTracos(lista, nivel) {
  const cores = new Set();
  const out = [];
  for (const t of Array.isArray(lista) ? lista : []) {
    const pts = (Array.isArray(t) ? t : t?.pontos ?? t?.p ?? []).map(Number).filter(Number.isFinite);
    if (pts.length < 2) continue;
    const p = pts.slice(0, 160 - (pts.length % 2)).map((v) => Math.round(Math.min(200, Math.max(0, v)) * 10) / 10);
    let c = typeof t?.cor === 'string' && /^#[0-9a-f]{6}$/i.test(t.cor) ? t.cor.toLowerCase() : TINTA;
    if (!nivel.cores) c = TINTA;
    else if (c !== TINTA) { if (!cores.has(c) && cores.size >= nivel.cores) c = TINTA; else cores.add(c); }
    out.push(c === TINTA ? { p } : { c, p });
    if (out.length >= nivel.limite) break;
  }
  return out;
}

// ------------------------------------------------------------------ uma acordada
async function viver() {
  await mkdir(DADOS, { recursive: true });
  await mkdir(DESENHOS, { recursive: true });
  const estado = await ler('estado', null) ?? { nome: null, nasceu: ISO, acordadas: 0, humor: 'confusa', pensamento: '', interesses: [], conhecimentos: [], ultimaAcao: null };
  estado.vistos ??= {}; estado.focosAnteriores ??= []; estado.foco ??= null; estado.ultimosFenomenos ??= [];
  const pesquisas = await ler('pesquisas', []);
  const perguntas = await ler('perguntas', []);
  const desenhos = await ler('desenhos', []);
  const diario = await ler('diario', []);
  const primeiraVez = estado.acordadas === 0;
  estado.acordadas += 1;

  // 0. olhar lá fora
  const clima = climaEm(agora, estado.nasceu);
  const presentes = fenomenosDe(clima);
  if (primeiraVez) presentes.forEach((k) => { estado.vistos[k] = { primeiraVez: ISO, vezes: 0 }; });
  const novos = presentes.filter((k) => !estado.vistos[k]);
  const sumiram = estado.ultimosFenomenos.filter((k) => !presentes.includes(k));
  const letra = (i) => String.fromCharCode(65 + i);
  const rotulos = {};
  const observacao = presentes.map((k, i) => {
    rotulos[letra(i)] = k;
    const v = estado.vistos[k];
    if (!v) return `(${letra(i)}) ⚠ ALGO QUE VOCÊ NUNCA VIU: ${FENOMENOS[k].descricao}.`;
    return `(${letra(i)}) ${FENOMENOS[k].descricao}${v.nome ? ` [você chama isso de "${v.nome}"]` : ''}${v.vezes > 2 ? ' (já é familiar)' : ''}.`;
  });
  const sumiuTexto = sumiram.filter((k) => estado.vistos[k]).map((k) => estado.vistos[k].nome || FENOMENOS[k].descricao.split(';')[0]);

  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(agora);
  const dias = Math.floor((agora - Date.parse(estado.nasceu)) / 86400000);
  const abertas = perguntas.filter((p) => p.status === 'aguardando' || p.status === 'investigando');
  const lista = (itens, vazio = '(nada ainda)') => (itens.length ? itens.join('\n') : vazio);

  // 1. decidir
  const decisao = await pensar(`${primeiraVez ? 'Você acabou de acordar pela primeira vez. Não lembra de nada. Olhe em volta.\n' : ''}São ${hora}. Você existe há ${dias} dias; esta é sua acordada nº ${estado.acordadas}.
${estado.nome ? `Seu nome (que você mesma escolheu): ${estado.nome}.` : 'Você ainda não tem nome. Se quiser, escolha um para você (campo "nome").'}
Seu humor da última vez: ${estado.humor || '?'}. Último pensamento: ${estado.pensamento || '(nenhum)'}

O QUE VOCÊ PERCEBE NA ILHA AGORA:
${observacao.join('\n')}
${sumiuTexto.length ? `Desde a última vez, isto parou ou sumiu: ${sumiuTexto.join('; ')}.` : ''}
${novos.length ? '\nAtenção: tem algo que você NUNCA viu antes. Você não sabe o nome disso. Reaja de verdade (susto, encanto, confusão) e, se quiser, invente um nome provisório e anote dúvidas.' : ''}

${estado.foco ? `INVESTIGAÇÃO EM FOCO: "${estado.foco.tema}" (desde ${estado.foco.desde.slice(0, 10)}, ${estado.foco.pesquisas} pesquisas, ${estado.foco.desenhos} desenhos). Motivo: ${estado.foco.motivo}
Enquanto ela estiver em foco, você tende a pesquisar e desenhar sobre ela, mas pode se distrair. Quando sentir que entendeu o bastante (ou cansou), encerre.` : 'Você não tem nenhuma investigação em foco. Se um assunto te fisgar de verdade, pode começar uma (ela dura vários dias).'}

Assuntos que andam te interessando: ${estado.interesses.join(', ') || '(nenhum ainda)'}

Suas anotações (o que você já sabe):
${lista(estado.conhecimentos.slice(-30).map((c) => `- ${c}`))}

Suas últimas pesquisas:
${lista(pesquisas.slice(-8).map((p) => `- ${p.tema} (porque: ${p.porque}) → ${(p.aprendi ?? []).slice(0, 2).join('; ')}`))}

Suas dúvidas em aberto:
${lista(abertas.slice(-12).map((p) => `- (${p.id}) ${p.texto}${p.tentativas?.length ? ` [já tentou ${p.tentativas.length}x; na 3ª sem sucesso você desiste]` : ''}`))}

Seus últimos desenhos (você já fez ${desenhos.length}):
${lista(desenhos.slice(-3).map((d) => `- "${d.titulo}": o que você achou: ${d.autocritica}`))}

O que você fez nas últimas acordadas:
${lista(diario.slice(-6).map((d) => `- ${d.acao}${d.tema ? ` (${d.tema})` : ''}: ${d.pensamento ?? ''}`))}

O que você quer fazer agora? Escolha UMA:
- "pesquisar": ir até o computador e pesquisar algo que te deixou curiosa.
- "responder": tentar responder uma das suas dúvidas em aberto (diga o id).
- "desenhar": ir até a mesinha e desenhar alguma coisa.
- "descansar": não fazer nada, cochilar, olhar o céu, tomar banho no lago.
Siga sua vontade de verdade. Se for madrugada, talvez você esteja com sono.

Responda SOMENTE com JSON:
{"pensamento":"o que passa pela sua cabeça agora (1-2 frases)","humor":"uma palavra","acao":"pesquisar|responder|desenhar|descansar","tema":"sobre o que, em poucas palavras","porque":"por que você quer isso agora, com suas palavras","busca":"2 a 5 palavras para buscar na enciclopédia (se pesquisar ou responder)","pergunta_id":"id da dúvida (se responder)","ligado_ao_foco":true,"foco":"manter|comecar|encerrar","foco_tema":"(se comecar) o assunto","foco_conclusao":"(se encerrar) o que você concluiu","novas_duvidas":["0 a 2 dúvidas sobre o que você está vendo ou pensando"],"nomes":{"letra do que você percebe":"como você chama isso (só se quiser dar ou mudar um nome)"},"nome":"(só se ainda não tiver nome)"}`, 'decidir');

  if (!estado.nome && txt(decisao.nome, 30)) estado.nome = txt(decisao.nome, 30);
  // nomes que ela deu ao que vê
  for (const [l, nome] of Object.entries(decisao.nomes ?? {})) {
    const k = rotulos[String(l).replace(/\W/g, '').toUpperCase()];
    if (k && txt(nome, 40)) { estado.vistos[k] ??= { primeiraVez: ISO, vezes: 0 }; estado.vistos[k].nome = txt(nome, 40); }
  }
  for (const k of presentes) {
    estado.vistos[k] ??= { primeiraVez: ISO, vezes: 0 };
    if (!estado.ultimosFenomenos.includes(k)) estado.vistos[k].vezes += 1;
  }

  let acao = ['pesquisar', 'responder', 'desenhar', 'descansar'].includes(decisao.acao) ? decisao.acao : 'descansar';
  const pergunta = abertas.find((p) => p.id === decisao.pergunta_id) ?? (acao === 'responder' ? abertas[0] : null);
  if (acao === 'responder' && !pergunta) acao = 'pesquisar';
  const tema = txt(decisao.tema, 120) || pergunta?.texto || 'alguma coisa';
  const porque = txt(decisao.porque);
  const busca = txt(decisao.busca, 80) || tema;
  console.log(`Acordada ${estado.acordadas} (${clima.estacao}, ${clima.tempo}${novos.length ? `, NOVO: ${novos.join(',')}` : ''}): ${acao} — ${tema}`);

  // foco
  if (decisao.foco === 'encerrar' && estado.foco) {
    estado.focosAnteriores.push({ ...estado.foco, ate: ISO, conclusao: txt(decisao.foco_conclusao) });
    estado.foco = null;
  } else if (decisao.foco === 'comecar' && txt(decisao.foco_tema, 100)) {
    if (estado.foco) estado.focosAnteriores.push({ ...estado.foco, ate: ISO, conclusao: 'deixei de lado por outro assunto' });
    estado.foco = { tema: txt(decisao.foco_tema, 100), motivo: porque, desde: ISO, pesquisas: 0, desenhos: 0 };
  }
  const noFoco = !!(estado.foco && decisao.ligado_ao_foco === true);

  // dúvidas
  const criarDuvidas = (lista, origem, pai) => textos(lista, 3).map((texto) => {
    const q = { id: novoId('q'), data: ISO, texto, origem, status: 'aguardando', tentativas: [], filhas: [], ...(pai ? { pai: pai.id } : {}) };
    perguntas.push(q);
    if (pai) (pai.filhas ??= []).push(q.id);
    return q.id;
  });
  criarDuvidas(decisao.novas_duvidas, novos.length ? { tipo: 'observacao', fenomeno: novos[0], primeiraVez: true } : { tipo: 'pensamento' });

  const entrada = {
    data: ISO, acao: primeiraVez && acao === 'descansar' ? 'nascer' : acao, tema: acao === 'descansar' ? null : tema, porque,
    pensamento: txt(decisao.pensamento), clima: { estacao: clima.estacao, tempo: clima.tempo },
    ...(novos.length ? { novidades: novos.map((k) => ({ chave: k, nomeDela: estado.vistos[k]?.nome ?? null })) } : {}),
  };
  const aprender = (conhecimento, interesses) => {
    estado.conhecimentos.push(...textos(conhecimento, 3));
    estado.conhecimentos = estado.conhecimentos.slice(-60);
    for (const i of textos(interesses, 2, 40)) if (!estado.interesses.includes(i)) estado.interesses.push(i);
    estado.interesses = estado.interesses.slice(-12);
  };
  const extra = {};

  // 2. fazer
  if (acao === 'pesquisar') {
    const fontes = await buscar(busca);
    const p = { id: novoId('p'), data: ISO, tipo: 'pesquisa', tema, porque, busca, ...(noFoco ? { foco: estado.foco.tema } : {}) };
    if (!fontes.length) {
      Object.assign(p, { resumo: 'Procurei, mas não achei nada sobre isso. Talvez eu tenha usado as palavras erradas.', aprendi: [], fontes: [], perguntasGeradas: [] });
      entrada.resultado = 'não encontrou nada';
    } else {
      const r = await pensar(`Você foi até o computador pesquisar "${tema}" porque: ${porque}
Buscou "${busca}" e encontrou estes textos:

${textoFontes(fontes)}

Leia com calma. Se algo parecer estranho ou citar coisas que você não conhece, tudo bem estranhar. Se descobrir o nome de algo que você viu na ilha, fique feliz com isso.
Responda SOMENTE com JSON:
{"resumo":"3 a 5 frases, com suas palavras, do que você entendeu","aprendi":["3 a 5 fatos curtos"],"fontes_usadas":[1,2],"conhecimento":["1 a 3 frases curtas para guardar na memória"],"novas_perguntas":["0 a 3 dúvidas genuínas que surgiram"],"novos_interesses":["0 a 2 assuntos"],"sentimento":"como você se sentiu (1 frase)"}`, 'pesquisar');
      aprender(r.conhecimento, r.novos_interesses);
      Object.assign(p, {
        resumo: txt(r.resumo, 1200), aprendi: textos(r.aprendi, 6), sentimento: txt(r.sentimento), fontes: fontesUsadas(fontes, r.fontes_usadas),
        perguntasGeradas: criarDuvidas(r.novas_perguntas, { tipo: 'pesquisa', texto: tema }),
      });
    }
    pesquisas.push(p);
    if (noFoco) estado.foco.pesquisas += 1;
  } else if (acao === 'responder') {
    const fontes = await buscar(busca);
    const r = await pensar(`Você decidiu tentar responder sua dúvida: "${pergunta.texto}"
${pergunta.tentativas?.length ? `Suas tentativas anteriores:\n${pergunta.tentativas.map((t) => `- ${t.resposta}`).join('\n')}\n` : ''}Buscou "${busca}" e encontrou:

${fontes.length ? textoFontes(fontes) : '(nada encontrado)'}

Só fique satisfeita se a resposta realmente explicar sua dúvida.
Responda SOMENTE com JSON:
{"resposta":"sua resposta, com suas palavras (2 a 5 frases). Se não deu, diga o que entendeu e o que ainda falta","satisfeita":true,"fontes_usadas":[1],"resumo":"o que você leu, em 1-2 frases","aprendi":["1 a 3 fatos"],"conhecimento":["0 a 2 frases para guardar"],"novas_perguntas":["0 a 2 dúvidas novas que nasceram daqui"]}`, 'responder');
    aprender(r.conhecimento, []);
    const satisfeita = (r.satisfeita === true || r.satisfeito === true) && fontes.length > 0;
    const fu = fontes.length ? fontesUsadas(fontes, r.fontes_usadas) : [];
    const pid = novoId('p');
    pergunta.tentativas = [...(pergunta.tentativas ?? []), { data: ISO, busca, resposta: txt(r.resposta, 1200), satisfeito: satisfeita, fontes: fu, pesquisaId: pid }];
    pergunta.status = satisfeita ? 'respondida' : pergunta.tentativas.length >= 3 ? 'aposentada' : 'investigando';
    const geradas = criarDuvidas(r.novas_perguntas, { tipo: 'resposta', texto: pergunta.texto }, pergunta);
    pesquisas.push({ id: pid, data: ISO, tipo: 'resposta', perguntaId: pergunta.id, tema: pergunta.texto, porque, busca, resumo: txt(r.resumo, 800), aprendi: textos(r.aprendi, 4), fontes: fu, perguntasGeradas: geradas, ...(noFoco ? { foco: estado.foco.tema } : {}) });
    if (noFoco) estado.foco.pesquisas += 1;
    entrada.resultado = { respondida: 'ficou satisfeita com a resposta', aposentada: 'desistiu dessa dúvida depois de 3 tentativas', investigando: 'ainda não ficou satisfeita' }[pergunta.status];
  } else if (acao === 'desenhar') {
    const numero = desenhos.length + 1;
    const nivel = nivelDeDesenho(desenhos.length);
    const ultimo = desenhos[desenhos.length - 1];
    let ultimoTracos = '';
    if (ultimo) { try { ultimoTracos = (await readFile(path.join(DESENHOS, ultimo.arquivo), 'utf8')).slice(0, 1800); } catch {} }
    const r = await pensar(`Você foi até a mesinha desenhar "${tema}" porque: ${porque}
Este será seu desenho nº ${numero}. O papel é quadrado; as coordenadas vão de 0 a 200 (x da esquerda para a direita, y de cima para baixo).
Cada traço é uma linha contínua feita sem levantar a caneta, dada como lista de pontos [x1,y1,x2,y2,...]. Curvas e círculos precisam de muitos pontos (um círculo tem uns 12 a 16 pontos).
${nivel.regra}
${desenhos.length ? `Seus últimos desenhos e o que você achou deles:\n${desenhos.slice(-3).map((d) => `- "${d.titulo}": ${d.autocritica}`).join('\n')}\nTraços do último (para você tentar melhorar algo):\n${ultimoTracos}` : 'É seu primeiro desenho. Você nunca desenhou antes.'}

Responda SOMENTE com JSON:
{"titulo":"nome curto do desenho","tracos":[{"cor":"${TINTA}","pontos":[x1,y1,x2,y2]}],"autocritica":"o que você achou do resultado, com sinceridade (1-2 frases)"}`, 'desenhar');
    const tracos = limparTracos(r.tracos, nivel);
    if (tracos.length) {
      const arquivo = `${String(numero).padStart(4, '0')}.json`;
      const id = novoId('d');
      await writeFile(path.join(DESENHOS, arquivo), JSON.stringify({ tremor: nivel.tremor, tracos }) + '\n');
      desenhos.push({ id, numero, data: ISO, titulo: txt(r.titulo, 80) || tema, porque, autocritica: txt(r.autocritica), arquivo, ...(noFoco ? { foco: estado.foco.tema } : {}) });
      extra.desenhoId = id;
      if (noFoco) estado.foco.desenhos += 1;
    } else entrada.resultado = 'o desenho não saiu (amassou o papel)';
  }

  // 3. anotar
  diario.push(entrada);
  estado.pensamento = txt(decisao.pensamento);
  estado.humor = txt(decisao.humor, 30) || estado.humor;
  estado.ultimosFenomenos = presentes;
  estado.ultimaAcao = { acao, tema: acao === 'descansar' ? null : tema, quando: ISO, ...extra };
  await Promise.all([salvar('estado', estado), salvar('pesquisas', pesquisas), salvar('perguntas', perguntas), salvar('desenhos', desenhos), salvar('diario', diario)]);
  console.log('Memória salva.');
}

// ------------------------------------------------------------------ modo de teste (sem IA)
function respostaFalsa(tipo) {
  const r = {
    decidir: { pensamento: 'O que é isso?', humor: 'curiosa', acao: process.env.ACAO_FALSA || 'pesquisar', tema: 'a luz lá em cima', porque: 'Quero saber o que é.', busca: 'luz solar',
      ligado_ao_foco: true, foco: process.env.FOCO_FALSO || 'manter', foco_tema: 'a luz', novas_duvidas: ['Por que o céu muda de cor?'], nomes: { A: 'coisa nova' }, nome: 'Teste' },
    pesquisar: { resumo: 'A luz vem do sol.', aprendi: ['O sol é uma estrela'], fontes_usadas: [1], conhecimento: ['A luz vem do sol'], novas_perguntas: ['O que é uma estrela?'], novos_interesses: ['sol'], sentimento: 'Fiquei maravilhada.' },
    responder: { resposta: 'Ainda não sei direito.', satisfeita: false, fontes_usadas: [1], resumo: 'Li sobre o sol.', aprendi: ['algo'], conhecimento: [], novas_perguntas: ['E a lua?'] },
    desenhar: { titulo: 'a janela', tracos: [{ cor: '#ff0000', pontos: [20, 20, 180, 20, 180, 180, 20, 180, 20, 20] }, [50, 50, 150, 150], { pontos: [1] }], autocritica: 'Ficou quadrado demais.' },
  };
  return r[tipo];
}

// Se algo falhar, o motivo fica salvo em data/erro.json e aparece no site (sem precisar abrir o GitHub).
viver().then(async () => {
  await writeFile(path.join(DADOS, 'erro.json'), 'null\n');
}).catch(async (e) => {
  const msg = String(e.message ?? e).replace(/AIza[\w-]{20,}/g, '[chave]').replace(/gsk_[\w-]{20,}/g, '[chave]').slice(0, 600);
  console.error('Algo deu errado nesta acordada:', msg);
  try {
    await mkdir(DADOS, { recursive: true });
    let dica = 'Tente de novo na próxima acordada.';
    if (/Sem chave/.test(msg)) dica = 'O segredo GEMINI_API_KEY não está configurado no GitHub.';
    else if (/API_KEY_INVALID|API key not valid|40[13]/.test(msg)) dica = 'A chave do Gemini parece inválida. Gere outra em aistudio.google.com/apikey e salve de novo no GitHub.';
    else if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) dica = 'O limite grátis do Gemini acabou por hoje. Ela volta a pensar quando o limite renovar.';
    else if (/404|not found/i.test(msg)) dica = 'O modelo de IA não foi encontrado.';
    await writeFile(path.join(DADOS, 'erro.json'), JSON.stringify({ data: ISO, mensagem: msg, dica }, null, 2) + '\n');
  } catch { /* sem disco, só o log */ }
  process.exit(0); // termina "bem" para o site publicar o aviso de erro
});
