// O mundo 3D: uma ilhota low-poly com árvores, lago, computador, mesinha de desenho e mural.
// A capivara vive aqui, sempre se mexendo, e o clima muda com as estações.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { renderizarDesenho } from './desenho.js';

const rand = (a, b) => a + Math.random() * (b - a);
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const novoMat = (cor) => new THREE.MeshLambertMaterial({ color: cor, flatShading: true });
const cache = new Map();
const mat = (cor) => { if (!cache.has(cor)) cache.set(cor, novoMat(cor)); return cache.get(cor); };
function malha(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m?.isMaterial ? m : mat(m));
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}
const cor = (h) => new THREE.Color(h);

// lugares importantes do mundo (x, z)
const LAGO = { x: -6.5, z: 5, r: 2.8 };
const LUGAR = {
  computador: { x: 5, z: -1.55, olhar: { x: 5, z: -3 } },
  mesinha: { x: -4, z: -2.35, olhar: { x: -4, z: -3.5 } },
  mural: { x: 0, z: -4.4, olhar: { x: 0, z: -7 } },
  cama: { x: 6.5, z: 4 },
  lago: { x: LAGO.x, z: LAGO.z },
  margem: { x: LAGO.x + 3.4, z: LAGO.z - 0.6 },
  abrigo: { x: -7.6, z: -4.4, olhar: { x: -6, z: -2 } },
};

export function criarMundo(host, ctx) {
  const R = mulberry(7);
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  camera.position.set(10, 9.5, 15);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  const controles = new OrbitControls(camera, renderer.domElement);
  Object.assign(controles, { enableDamping: true, enablePan: false, minDistance: 7, maxDistance: 34, maxPolarAngle: Math.PI * 0.46 });
  controles.target.set(0, 1, 0);

  // ------------------------------------------------------------ luz e céu
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f4e, 1.1);
  cena.add(hemi);
  const luz = new THREE.DirectionalLight(0xfff3dd, 1.6);
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  Object.assign(luz.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
  luz.shadow.camera.updateProjectionMatrix();
  luz.shadow.bias = -0.0006;
  cena.add(luz, luz.target);
  cena.fog = new THREE.Fog(0xa9d8ec, 60, 160);

  const astroSol = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshBasicMaterial({ color: 0xffe08a, fog: false }));
  const astroLua = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), new THREE.MeshBasicMaterial({ color: 0xeef1f7, fog: false }));
  cena.add(astroSol, astroLua);
  const estrelasGeo = new THREE.BufferGeometry();
  const ep = [];
  for (let i = 0; i < 300; i++) {
    const th = R() * Math.PI * 2, ph = R() * Math.PI * 0.42;
    ep.push(80 * Math.sin(ph) * Math.cos(th), 80 * Math.cos(ph) + 5, 80 * Math.sin(ph) * Math.sin(th));
  }
  estrelasGeo.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
  const estrelas = new THREE.Points(estrelasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  cena.add(estrelas);

  // ------------------------------------------------------------ ilha
  const matChao = novoMat(0x8cc06a);
  cena.add(malha(new THREE.CylinderGeometry(15, 15, 0.6, 30), matChao, 0, -0.3, 0));
  const base = malha(new THREE.CylinderGeometry(15, 8.5, 5.5, 30), 0x8a6a4a, 0, -3.35, 0);
  base.castShadow = false;
  cena.add(base);
  const matTufo = novoMat(0x6fa84f);
  const tufos = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, d = 2 + R() * 12;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - LAGO.x, z - LAGO.z) < LAGO.r + 0.3) continue;
    const t = malha(new THREE.ConeGeometry(0.12 + R() * 0.08, 0.35 + R() * 0.35, 4), matTufo, x, 0.15, z);
    t.castShadow = false;
    tufos.add(t);
  }
  cena.add(tufos);

  // lago
  const matLago = new THREE.MeshLambertMaterial({ color: 0x5fa8c8, flatShading: true, transparent: true, opacity: 0.9 });
  cena.add(malha(new THREE.CylinderGeometry(LAGO.r, LAGO.r, 0.08, 16), matLago, LAGO.x, 0.02, LAGO.z));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + R() * 0.2;
    const p = malha(new THREE.DodecahedronGeometry(0.18 + R() * 0.15, 0), 0x9b978c, LAGO.x + Math.cos(a) * (LAGO.r + 0.15), 0.05, LAGO.z + Math.sin(a) * (LAGO.r + 0.15));
    p.scale.y = 0.6; cena.add(p);
  }

  // pedras
  for (const [x, z, s] of [[9, 2, 1], [-2, 8, 0.7], [11, -4, 0.8], [-12, 5, 1.1], [2, -9.5, 0.6], [-6, 11, 0.9], [7.5, 9, 0.6]]) {
    const p = malha(new THREE.DodecahedronGeometry(0.8 * s, 0), 0x9d9a91, x, 0.3 * s, z);
    p.rotation.set(R(), R(), R()); p.scale.y = 0.7; cena.add(p);
  }

  // árvores
  const matCopa = [novoMat(0x5fae4f), novoMat(0x4f9a45), novoMat(0x6dbb5a)];
  const matPinheiro = novoMat(0x3f7d4a);
  const matTronco = mat(0x7a5236);
  const arvores = [];
  function arvore(x, z, s, tipo) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = R() * 6;
    g.add(malha(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6), matTronco, 0, 1.1, 0));
    const copa = new THREE.Group(), galhos = new THREE.Group();
    if (tipo === 'pinheiro') {
      for (let i = 0; i < 3; i++) copa.add(malha(new THREE.ConeGeometry(1.6 - i * 0.42, 1.7, 7), matPinheiro, 0, 2.1 + i * 0.95, 0));
    } else {
      const m = () => matCopa[Math.floor(R() * 3)];
      copa.add(malha(new THREE.IcosahedronGeometry(1.5, 0), m(), 0, 3.1, 0));
      copa.add(malha(new THREE.IcosahedronGeometry(1.0, 0), m(), 0.9, 2.6, 0.3));
      copa.add(malha(new THREE.IcosahedronGeometry(0.95, 0), m(), -0.8, 2.75, -0.25));
      for (let i = 0; i < 4; i++) {
        const gl = malha(new THREE.CylinderGeometry(0.05, 0.09, 1.4, 4), matTronco, 0, 2.6, 0);
        gl.rotation.set(Math.cos(i * 1.7) * 0.8, i * 1.6, Math.sin(i * 1.7) * 0.8);
        gl.position.set(Math.cos(i * 1.6) * 0.35, 2.7, Math.sin(i * 1.6) * 0.35);
        galhos.add(gl);
      }
      galhos.visible = false;
    }
    g.add(copa, galhos);
    cena.add(g);
    arvores.push({ g, copa, galhos, tipo, fase: R() * 6 });
  }
  for (const [x, z, s, t] of [[-9, -6, 1.25, 'redonda'], [-11.5, 1, 1, 'pinheiro'], [-9, 9.5, 1.1, 'redonda'], [9, -7.5, 1.3, 'pinheiro'],
    [11.5, -1, 1, 'redonda'], [11, 7, 0.9, 'pinheiro'], [3, 12, 1, 'redonda'], [-3.5, -11.5, 1.1, 'redonda'], [5, -11.5, 0.9, 'pinheiro'],
    [-12.5, -4.5, 0.8, 'redonda'], [12.5, 4, 0.8, 'redonda'], [-1, 12.5, 0.85, 'pinheiro']]) arvore(x, z, s, t);

  // flores
  const flores = new THREE.Group();
  const coresFlor = [0xf27ba0, 0xffd166, 0xffffff, 0xb388eb, 0xff9f6b];
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, d = 1.5 + R() * 12;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - LAGO.x, z - LAGO.z) < LAGO.r + 0.4) continue;
    const f = new THREE.Group();
    f.position.set(x, 0, z);
    f.add(malha(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 4), 0x4f8a3a, 0, 0.22, 0));
    f.add(malha(new THREE.IcosahedronGeometry(0.11, 0), coresFlor[Math.floor(R() * coresFlor.length)], 0, 0.47, 0));
    f.userData.base = 0.7 + R() * 0.6;
    flores.add(f);
  }
  cena.add(flores);

  // folhas no chão (outono)
  const folhasChao = new THREE.Group();
  const coresFolha = [0xd98a3a, 0xc8642e, 0xe0b04a, 0x9c5a2c];
  for (let i = 0; i < 80; i++) {
    const a = R() * Math.PI * 2, d = 2 + R() * 12.5;
    const f = malha(new THREE.BoxGeometry(0.28, 0.02, 0.18), coresFolha[i % 4], Math.cos(a) * d, 0.02, Math.sin(a) * d);
    f.rotation.y = R() * 6; f.castShadow = false;
    folhasChao.add(f);
  }
  cena.add(folhasChao);

  // ------------------------------------------------------------ móveis
  const madeira = 0x9b7653;
  function pernas(g, w, d, h, c) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(malha(new THREE.BoxGeometry(0.1, h, 0.1), c, sx * w, h / 2, sz * d));
  }
  // mesa do computador
  const mesa = new THREE.Group();
  mesa.position.set(5, 0, -3);
  mesa.add(malha(new THREE.BoxGeometry(2.3, 0.12, 1.15), madeira, 0, 1.0, 0));
  pernas(mesa, 1.05, 0.48, 0.96, madeira);
  mesa.add(malha(new THREE.BoxGeometry(1.0, 0.82, 0.82), 0xe8dfc8, 0, 1.48, -0.08));
  mesa.add(malha(new THREE.BoxGeometry(0.7, 0.6, 0.3), 0xd8cfb8, 0, 1.45, -0.6));
  mesa.add(malha(new THREE.BoxGeometry(0.75, 0.05, 0.26), 0xd8cfb8, 0, 1.09, 0.36));
  mesa.add(malha(new THREE.BoxGeometry(0.4, 0.14, 0.3), 0x7d9bb0, -0.85, 1.13, 0.1));
  mesa.add(malha(new THREE.BoxGeometry(0.36, 0.1, 0.28), 0xc98f6b, -0.83, 1.25, 0.12));
  const telaCanvas = Object.assign(document.createElement('canvas'), { width: 256, height: 192 });
  const telaTex = new THREE.CanvasTexture(telaCanvas);
  telaTex.colorSpace = THREE.SRGBColorSpace;
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.55), new THREE.MeshBasicMaterial({ map: telaTex }));
  tela.position.set(0, 1.52, 0.335);
  mesa.add(tela);
  cena.add(mesa);

  // mesinha de desenho
  const mesinha = new THREE.Group();
  mesinha.position.set(-4, 0, -3.5);
  mesinha.add(malha(new THREE.BoxGeometry(1.7, 0.1, 1.05), 0xb08860, 0, 0.78, 0));
  pernas(mesinha, 0.75, 0.42, 0.74, 0xb08860);
  const papelCanvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const papelTex = new THREE.CanvasTexture(papelCanvas);
  papelTex.colorSpace = THREE.SRGBColorSpace;
  const papel = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), new THREE.MeshLambertMaterial({ map: papelTex }));
  papel.rotation.x = -Math.PI / 2; papel.rotation.z = 0.08; papel.position.set(-0.1, 0.836, 0.05);
  papel.receiveShadow = true;
  mesinha.add(papel);
  const caneta = malha(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), 0x2b4c9b, 0.55, 0.86, 0.1);
  caneta.rotation.z = Math.PI / 2; caneta.rotation.y = 0.5;
  mesinha.add(caneta);
  cena.add(mesinha);

  // mural de cortiça
  const mural = new THREE.Group();
  mural.position.set(0, 0, -7);
  for (const sx of [-2.25, 2.25]) mural.add(malha(new THREE.BoxGeometry(0.16, 3.4, 0.16), 0x7a5236, sx, 1.7, 0));
  mural.add(malha(new THREE.BoxGeometry(4.6, 2.5, 0.14), 0xc49a6c, 0, 2.35, 0.04));
  mural.add(malha(new THREE.BoxGeometry(4.8, 0.14, 0.2), 0x7a5236, 0, 3.66, 0.04));
  const quadros = [];
  const vagas = [[-1.45, 2.95], [0, 2.98], [1.45, 2.93], [-0.72, 1.82], [0.72, 1.8]];
  for (const [x, y] of vagas) {
    const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshLambertMaterial({ map: tx }));
    q.position.set(x, y, 0.125); q.rotation.z = (R() - 0.5) * 0.12; q.visible = false;
    const pin = malha(new THREE.SphereGeometry(0.05, 6, 4), 0xc96b5a, x, y + 0.42, 0.15);
    pin.visible = false;
    mural.add(q, pin);
    quadros.push({ cv, tx, q, pin });
  }
  cena.add(mural);

  // caminha de folhas
  cena.add(malha(new THREE.CylinderGeometry(1.15, 1.25, 0.22, 9), 0x9cb86a, LUGAR.cama.x, 0.11, LUGAR.cama.z));
  cena.add(malha(new THREE.CylinderGeometry(0.95, 1.05, 0.12, 9), 0xb8cf86, LUGAR.cama.x, 0.25, LUGAR.cama.z));

  // ------------------------------------------------------------ nuvens e partículas
  const matNuvem = novoMat(0xffffff);
  const nuvens = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const n = malha(new THREE.IcosahedronGeometry(1.2 + R(), 0), matNuvem, k * 1.4 - 1.4, R() * 0.5, R() * 0.6);
      n.castShadow = false; g.add(n);
    }
    g.position.set(-28 + R() * 56, 10 + R() * 4, -16 + R() * 26);
    g.scale.setScalar(0.8 + R() * 0.7);
    cena.add(g); nuvens.push(g);
  }

  const NCH = 900;
  const chuvaPos = new Float32Array(NCH * 6);
  const chuvaY = new Float32Array(NCH);
  for (let i = 0; i < NCH; i++) {
    const x = rand(-15, 15), z = rand(-15, 15);
    chuvaY[i] = rand(0, 18);
    chuvaPos.set([x, chuvaY[i], z, x, chuvaY[i] + 0.45, z], i * 6);
  }
  const chuvaGeo = new THREE.BufferGeometry();
  chuvaGeo.setAttribute('position', new THREE.BufferAttribute(chuvaPos, 3));
  const chuva = new THREE.LineSegments(chuvaGeo, new THREE.LineBasicMaterial({ color: 0xb8d4e6, transparent: true, opacity: 0.6 }));
  chuva.visible = false; cena.add(chuva);

  const NNEVE = 1000;
  const nevePos = new Float32Array(NNEVE * 3);
  for (let i = 0; i < NNEVE; i++) nevePos.set([rand(-15, 15), rand(0, 16), rand(-15, 15)], i * 3);
  const neveGeo = new THREE.BufferGeometry();
  neveGeo.setAttribute('position', new THREE.BufferAttribute(nevePos, 3));
  const floco = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
  const fc = floco.getContext('2d'); fc.fillStyle = '#fff'; fc.beginPath(); fc.arc(16, 16, 14, 0, Math.PI * 2); fc.fill();
  const neve = new THREE.Points(neveGeo, new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(floco), transparent: true, alphaTest: 0.4, color: 0xffffff }));
  neve.visible = false; cena.add(neve);

  const folhasCaindo = [];
  for (let i = 0; i < 40; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshLambertMaterial({ color: coresFolha[i % 4], side: THREE.DoubleSide }));
    f.position.set(rand(-13, 13), rand(0, 6), rand(-13, 13)); f.visible = false;
    f.userData = { vr: rand(1, 3), fase: rand(0, 6) };
    cena.add(f); folhasCaindo.push(f);
  }

  // ------------------------------------------------------------ a capivara
  const capi = criarCapivara();
  cena.add(capi.g);
  const est = { x: 1.5, z: 2, rumo: 0.6, fase: 0, t: 0, proxPisca: 3, pisca: 0, molhada: 0 };

  // ------------------------------------------------------------ clima
  let clima = null;
  const alvo = { cobertura: 0, vento: 0.2, chuva: 0, neve: false, folhas: false, trovoada: false, congelado: false };
  let cobertura = -1, flash = 0, proxRaio = 5, hemiBase = 1.1;
  const chaoBase = { primavera: 0x8cc06a, verao: 0xa7bf5e, outono: 0xb1a45c, inverno: 0x9aa88a };
  const copaCor = { primavera: [0x6dbb5a, 0x8fd06a, 0xf2a7c3], verao: [0x4f9a45, 0x5fae4f, 0x467f3c], outono: [0xd98a3a, 0xc8642e, 0xe0b04a], inverno: [0x8a9a7a, 0x8a9a7a, 0x8a9a7a] };
  const nubl = { sol: 0, calor: 0, vento: 0.15, nublado: 0.55, garoa: 0.55, chuva: 0.75, trovoada: 0.9, neve: 0.7, neblina: 0.6, geada: 0.1 };

  function corDoCeu(h) {
    const k = [[0, 0x141b33], [5, 0x1f2747], [6.2, 0xf0a982], [7.6, 0xa9d8ec], [17, 0xa9d8ec], [18.3, 0xf2a77e], [19.4, 0x2c3558], [24, 0x141b33]];
    for (let i = 0; i < k.length - 1; i++) {
      if (h >= k[i][0] && h <= k[i + 1][0]) return cor(k[i][1]).lerp(cor(k[i + 1][1]), (h - k[i][0]) / (k[i + 1][0] - k[i][0]));
    }
    return cor(0x141b33);
  }
  const claridade = (h) => h < 5 || h > 19.6 ? 0 : h < 7 ? (h - 5) / 2 : h > 17.6 ? (19.6 - h) / 2 : 1;

  function definirClima(c) {
    clima = c;
    const e = c.estacao;
    matChao.color.set(chaoBase[e]);
    matTufo.color.set(chaoBase[e]).multiplyScalar(0.85);
    copaCor[e].forEach((h, i) => matCopa[i].color.set(h));
    for (const a of arvores) {
      if (a.tipo === 'pinheiro') continue;
      const pelada = e === 'inverno' && a.fase > 2; // a maioria fica sem folhas
      a.copa.visible = !pelada; a.galhos.visible = pelada;
    }
    matPinheiro.color.set(e === 'inverno' ? 0x5d8a6a : 0x3f7d4a);
    const primeira = cobertura < 0;
    flores.children.forEach((f, i) => {
      f.userData.alvo = e === 'primavera' ? 1 : e === 'verao' && i % 3 === 0 ? 0.8 : 0;
      if (primeira) f.scale.setScalar(Math.max(0.001, f.userData.alvo * f.userData.base));
    });
    folhasChao.visible = e === 'outono' || (e === 'inverno' && c.tempo !== 'neve');
    alvo.cobertura = e === 'inverno' ? (c.tempo === 'neve' ? 1 : c.tempo === 'geada' ? 0.75 : 0.45) : c.tempo === 'geada' ? 0.5 : 0;
    alvo.chuva = c.tempo === 'chuva' || c.tempo === 'trovoada' ? 1 : c.tempo === 'garoa' ? 0.35 : 0;
    alvo.neve = c.tempo === 'neve';
    alvo.folhas = e === 'outono';
    alvo.vento = c.tempo === 'vento' ? 1 : c.tempo === 'trovoada' ? 0.8 : c.tempo === 'chuva' ? 0.4 : 0.15;
    alvo.trovoada = c.tempo === 'trovoada';
    alvo.congelado = e === 'inverno';
    matLago.color.set(alvo.congelado ? 0xcfe6f0 : 0x5fa8c8);
    matLago.opacity = alvo.congelado ? 1 : 0.9;
    if (cobertura < 0) cobertura = alvo.cobertura;
    atualizarCeu();
  }

  function atualizarCeu() {
    if (!clima) return;
    const h = clima.hora, n = nubl[clima.tempo] ?? 0;
    const cl = claridade(h);
    const ceu = corDoCeu(h).lerp(cor(cl > 0.3 ? 0xaab4bc : 0x2a2f3a), n * 0.85);
    if (clima.tempo === 'neblina') ceu.lerp(cor(cl > 0.3 ? 0xdfe3e5 : 0x3b4048), 0.7);
    cena.background = ceu;
    cena.fog.color.copy(ceu);
    cena.fog.near = clima.tempo === 'neblina' ? 4 : 60;
    cena.fog.far = clima.tempo === 'neblina' ? 26 : 160;
    hemiBase = 0.35 + cl * 0.85 - n * 0.2;
    hemi.intensity = hemiBase;
    hemi.color.set(cl > 0.2 ? 0xffffff : 0x8090c0);
    const ang = ((h - 6) / 12) * Math.PI;
    const diaPos = new THREE.Vector3(Math.cos(ang) * 30, Math.max(4, Math.sin(ang) * 30), -18);
    luz.position.copy(cl > 0.05 ? diaPos : new THREE.Vector3(-12, 22, -10));
    luz.intensity = cl > 0.05 ? (0.4 + cl * 1.3) * (1 - n * 0.6) : 0.35;
    luz.color.set(cl > 0.05 ? (cl < 0.7 ? 0xffc59a : 0xfff3dd) : 0x9fb0e0);
    astroSol.visible = cl > 0.05 && n < 0.5;
    astroSol.position.copy(diaPos).multiplyScalar(2.2);
    astroLua.visible = clima.noite && n < 0.7;
    astroLua.position.set(-30, 45, -60);
    estrelas.material.opacity = clima.noite ? Math.max(0, 1 - n * 1.3) : 0;
    const qtdNuvens = Math.round(2 + n * 7);
    nuvens.forEach((g, i) => { g.visible = i < qtdNuvens; });
    matNuvem.color.set(n > 0.7 ? 0x8b939c : n > 0.4 ? 0xd5dadf : 0xffffff).multiplyScalar(0.4 + cl * 0.6);
  }

  // ------------------------------------------------------------ texturas: tela, papel, mural
  let ultimaTela = 0;
  function desenharTela(ligada, tema, t) {
    if (t - ultimaTela < 0.25) return;
    ultimaTela = t;
    const g = telaCanvas.getContext('2d');
    g.fillStyle = ligada ? '#1f3b33' : '#1a1f1d'; g.fillRect(0, 0, 256, 192);
    if (ligada) {
      g.fillStyle = '#9ff0c8'; g.font = 'bold 16px monospace';
      g.fillText((tema || 'pesquisando').slice(0, 22), 12, 26);
      g.fillStyle = '#6fbf98';
      const off = Math.floor(t * 3);
      for (let i = 0; i < 9; i++) {
        const w = 40 + (((i + off) * 73) % 170);
        g.fillRect(12, 44 + i * 15, w, 6);
      }
      if (Math.floor(t * 2) % 2) g.fillRect(12 + ((off * 37) % 180), 180, 10, 4);
    }
    telaTex.needsUpdate = true;
  }
  let papelAtual = { id: null, p: -1 };
  function desenharPapel(d, progresso) {
    const id = d?.id ?? null;
    if (papelAtual.id === id && Math.abs(papelAtual.p - progresso) < 0.015) return;
    if (d && !d.tracos) return; // ainda carregando
    papelAtual = { id, p: progresso };
    renderizarDesenho(papelCanvas, d, progresso);
    papelTex.needsUpdate = true;
  }
  function definirMural(lista) {
    quadros.forEach((q, i) => {
      const d = lista[i];
      q.q.visible = q.pin.visible = !!d;
      if (d) { renderizarDesenho(q.cv, d, 1); q.tx.needsUpdate = true; }
    });
  }

  // ------------------------------------------------------------ comportamento
  let fila = [], atual = null, relogio = 0, proxFala = 8;
  const chovendo = () => ['chuva', 'trovoada', 'garoa'].includes(clima?.tempo);
  const vaiPara = (l, extra = {}) => ({ tipo: 'andar', x: l.x, z: l.z, ...extra });
  const pontoLivre = () => {
    for (;;) {
      const a = Math.random() * Math.PI * 2, d = 1 + Math.random() * 9.5;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const longeDoLago = Math.hypot(x - LAGO.x, z - LAGO.z) > LAGO.r + 0.8;
      if ((z > -2 || Math.abs(x) > 7) && longeDoLago) return { x, z };
    }
  };
  const pontoLivreLongeDoLago = () => {
    for (;;) { const p = pontoLivre(); if (Math.hypot(p.x - LAGO.x, p.z - LAGO.z) > LAGO.r + 4) return p; }
  };

  let ultimoBanho = -999;
  function planejar() {
    // antes da primeira acordada ela ainda não "existe": fica dormindo na caminha
    if (!ctx.acordou()) return [vaiPara(LUGAR.cama), { tipo: 'dormir', dur: 30, antesDeNascer: true }];
    const oc = ctx.atividade();
    if (oc && Math.random() < 0.85) {
      if (oc.acao === 'desenhar') return [vaiPara(LUGAR.mesinha), { tipo: 'desenhar', dur: rand(40, 80), olhar: LUGAR.mesinha.olhar }];
      if (oc.acao === 'descansar') return [vaiPara(LUGAR.cama), { tipo: 'dormir', dur: rand(40, 90) }];
      return [vaiPara(LUGAR.computador), { tipo: 'pesquisar', dur: rand(40, 80), olhar: LUGAR.computador.olhar }];
    }
    const noite = clima?.noite, inverno = clima?.estacao === 'inverno', caindo = chovendo() || clima?.tempo === 'neve';
    const novidade = ctx.novidade();
    const opcoes = [
      [noite ? 5 : 26, () => [vaiPara(pontoLivre()), { tipo: 'parado', dur: rand(2, 6) }]],
      [14, () => [{ tipo: 'parado', dur: rand(3, 8) }]],
      [novidade ? 40 : caindo ? 14 : 4, () => [vaiPara(pontoLivre()), { tipo: 'olharCeu', dur: rand(6, 14) }]],
      [clima?.estacao === 'primavera' ? 12 : 5, () => { const f = flores.children[Math.floor(Math.random() * flores.children.length)].position; return [vaiPara({ x: f.x + 1.1, z: f.z + 0.2 }), { tipo: 'farejar', dur: rand(2.5, 5), olhar: { x: f.x, z: f.z } }]; }],
      [ctx.temDesenhos() ? 7 : 2, () => [vaiPara(LUGAR.mural), { tipo: 'olharMural', dur: rand(5, 10), olhar: LUGAR.mural.olhar }]],
      [6, () => [{ tipo: 'cocar', dur: rand(1.5, 3) }]],
      [5, () => [{ tipo: 'espreguicar', dur: 2.6 }]],
      // visitas rápidas: só relê o que já existe de verdade
      [ctx.temPesquisas() ? 5 : 0, () => [vaiPara(LUGAR.computador), { tipo: 'pesquisar', rapido: true, dur: rand(6, 15), olhar: LUGAR.computador.olhar }]],
      [ctx.temDesenhos() ? 4 : 0, () => [vaiPara(LUGAR.mesinha), { tipo: 'desenhar', rapido: true, dur: rand(5, 12), olhar: LUGAR.mesinha.olhar }]],
      // banho: no máximo um a cada ~4 minutos, e depois ela vai fazer outra coisa
      [!inverno && !noite && relogio - ultimoBanho > 240 ? (clima?.tempo === 'calor' ? 30 : 8) : 0, () => {
        ultimoBanho = relogio;
        const saida = { x: LAGO.x + 3.6 + rand(0, 2), z: LAGO.z + rand(-2, 2) };
        return [vaiPara(LUGAR.lago), { tipo: 'banho', dur: rand(15, 40) }, vaiPara(saida), { tipo: 'sacudir', dur: 1.6 }, vaiPara(pontoLivreLongeDoLago()), { tipo: 'parado', dur: rand(3, 6) }];
      }],
      [inverno ? 4 : 0, () => [vaiPara(LUGAR.margem), { tipo: 'olharMural', lago: true, dur: rand(3, 6), olhar: LUGAR.lago }]],
      [caindo ? 18 : 0, () => [vaiPara(LUGAR.abrigo), { tipo: 'parado', dur: rand(15, 35), olhar: LUGAR.abrigo.olhar }]],
      [noite ? 45 : 4, () => [vaiPara(LUGAR.cama), { tipo: 'dormir', dur: rand(30, 90) }, { tipo: 'espreguicar', dur: 2.6 }]],
    ];
    let r = Math.random() * opcoes.reduce((s, [p]) => s + p, 0);
    for (const [p, f] of opcoes) if ((r -= p) <= 0) return f();
    return [{ tipo: 'parado', dur: 3 }];
  }

  const NOMES = {
    parado: 'parado, pensando', olharCeu: 'olhando para o céu', farejar: 'farejando o chão', olharMural: 'olhando os desenhos',
    cocar: 'se coçando', espreguicar: 'se espreguiçando', dormir: 'cochilando', banho: 'tomando banho no lago', sacudir: 'se sacudindo',
  };
  function aoComecar(a) {
    const oc = ctx.atividade();
    let s = NOMES[a.tipo];
    if (a.tipo === 'pesquisar') s = !a.rapido && oc && oc.acao !== 'desenhar' && oc.acao !== 'descansar' ? `pesquisando: ${oc.tema}` : 'relendo as pesquisas antigas';
    if (a.tipo === 'desenhar') s = !a.rapido && oc?.acao === 'desenhar' ? `desenhando: ${oc.tema}` : 'olhando os desenhos antigos';
    if (a.tipo === 'andar') {
      const prox = fila[0]?.tipo;
      s = { pesquisar: 'indo até o computador', desenhar: 'indo até a mesinha', dormir: 'indo para a caminha', banho: 'indo para o lago', olharMural: 'indo ver o mural' }[prox] ?? 'passeando';
    }
    if (a.tipo === 'parado' && Math.hypot(est.x - LUGAR.abrigo.x, est.z - LUGAR.abrigo.z) < 1) s = 'se abrigando debaixo da árvore';
    if (a.lago) { ctx.status('olhando o lago congelado'); if (Math.random() < 0.6) ctx.falar(ctx.frase('lagoCongelado')); return; }
    if (a.antesDeNascer || (!ctx.acordou() && a.tipo === 'andar')) s = 'dormindo · ainda não acordou pela primeira vez';
    ctx.status(s);
    if (['pesquisar', 'desenhar', 'olharCeu', 'olharMural', 'banho', 'farejar'].includes(a.tipo) && Math.random() < 0.55) ctx.falar(ctx.frase(a.tipo));
    if (a.tipo === 'dormir' && Math.random() < 0.5) ctx.falar('z z z');
  }

  function angulo(dx, dz) { return Math.atan2(-dz, dx); }
  function virarPara(alvoAng, dt, vel = 4) {
    let d = alvoAng - est.rumo;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    est.rumo += Math.sign(d) * Math.min(Math.abs(d), vel * dt);
    return Math.abs(d);
  }

  function passo(dt) {
    if (!atual || atual.feito) {
      if (!fila.length) fila = planejar();
      atual = { ...fila.shift(), t: 0 };
      aoComecar(atual);
    }
    atual.t += dt;
    if (atual.tipo === 'andar') {
      const dx = atual.x - est.x, dz = atual.z - est.z, dist = Math.hypot(dx, dz);
      if (dist < 0.1) { atual.feito = true; return; }
      const dif = virarPara(angulo(dx, dz), dt);
      if (dif < 0.8) {
        const naAgua = noLago() ? 0.6 : 1;
        const v = Math.min(dist, 1.45 * naAgua * dt * (1 - dif / 1.2));
        est.x += (dx / dist) * v; est.z += (dz / dist) * v;
        est.fase += dt * 9 * naAgua;
      }
      if (atual.t > 40) atual.feito = true; // nunca fica presa
    } else {
      if (atual.olhar) virarPara(angulo(atual.olhar.x - est.x, atual.olhar.z - est.z), dt, 3);
      if (atual.t >= atual.dur) atual.feito = true;
    }
  }
  const noLago = () => !alvo.congelado && Math.hypot(est.x - LAGO.x, est.z - LAGO.z) < LAGO.r - 0.4;

  function pose(dt) {
    const a = atual?.tipo ?? 'parado', t = relogio, p = capi.partes;
    let y = 0, corpoRot = 0, cabZ = 0, cabY = 0, sx = 1, sy = 1 + Math.sin(t * 2.2) * 0.015, olho = 1;
    const pernas = [0, 0, 0, 0], dobra = [1, 1, 1, 1];
    if (a === 'andar') {
      const s = Math.sin(est.fase);
      pernas[0] = s * 0.5; pernas[3] = s * 0.5; pernas[1] = -s * 0.5; pernas[2] = -s * 0.5;
      y = Math.abs(Math.cos(est.fase)) * 0.05; cabZ = Math.sin(est.fase * 2) * 0.03;
    } else if (a === 'pesquisar' || a === 'desenhar') {
      cabZ = -0.22 + Math.sin(t * 1.3) * 0.06; cabY = Math.sin(t * 0.7) * 0.15;
      if (a === 'desenhar') pernas[0] = -0.5 + Math.sin(t * 6) * 0.15;
    } else if (a === 'olharMural') {
      cabZ = 0.22 + Math.sin(t * 0.8) * 0.05; cabY = Math.sin(t * 0.5) * 0.25;
    } else if (a === 'olharCeu') {
      cabZ = 0.55 + Math.sin(t * 0.9) * 0.08; cabY = Math.sin(t * 0.4) * 0.4;
    } else if (a === 'farejar') {
      cabZ = -0.45 + Math.sin(t * 14) * 0.04;
    } else if (a === 'cocar') {
      pernas[2] = -0.9 + Math.sin(t * 22) * 0.35; corpoRot = 0.12; cabZ = 0.1;
    } else if (a === 'espreguicar') {
      const k = Math.sin(Math.min(1, atual.t / atual.dur) * Math.PI);
      sx = 1 + k * 0.12; pernas[0] = pernas[1] = -0.6 * k; cabZ = 0.3 * k; y = -0.1 * k;
    } else if (a === 'dormir') {
      y = -0.4; sy = 0.92 + Math.sin(t * 1.1) * 0.03; cabZ = -0.25; olho = 0.12; dobra.fill(0.25);
    } else if (a === 'sacudir') {
      corpoRot = Math.sin(t * 34) * 0.3 * (1 - atual.t / atual.dur);
    } else if (a === 'banho') {
      cabZ = 0.08 + Math.sin(t * 0.8) * 0.05; olho = 0.5;
    }
    if (noLago()) { y -= 0.62; est.molhada = 1; } else est.molhada = Math.max(0, est.molhada - dt * 0.05);
    if (a === 'banho' || noLago()) y += Math.sin(t * 1.4) * 0.03;

    est.proxPisca -= dt;
    if (est.proxPisca <= 0) { est.pisca = 0.14; est.proxPisca = rand(2.5, 6); }
    if (est.pisca > 0) { est.pisca -= dt; olho = Math.min(olho, 0.1); }

    // chão na neve fica um pouco mais alto
    capi.g.position.set(est.x, y + cobertura * 0.04, est.z);
    capi.g.rotation.y = est.rumo;
    p.corpo.rotation.x = corpoRot;
    p.corpo.scale.set(sx, sy, 1);
    p.cabeca.rotation.set(0, cabY, cabZ);
    p.pernas.forEach((pe, i) => { pe.rotation.z = pernas[i]; pe.scale.y = dobra[i]; });
    p.olhos.forEach((o) => { o.scale.y = olho; });
  }

  function clima3D(dt, t) {
    if (!clima) return;
    cobertura += (alvo.cobertura - cobertura) * Math.min(1, dt * 0.05);
    const base = cor(chaoBase[clima.estacao]);
    matChao.color.copy(base).lerp(cor(0xf4f7fa), cobertura);
    matTufo.color.copy(base).multiplyScalar(0.85).lerp(cor(0xe9eef2), cobertura);
    tufos.visible = cobertura < 0.85;
    // chuva
    chuva.visible = alvo.chuva > 0;
    if (chuva.visible) {
      const n = Math.floor(NCH * alvo.chuva), vx = alvo.vento * 0.25;
      for (let i = 0; i < NCH; i++) {
        let yy = chuvaY[i] - dt * (alvo.chuva < 0.5 ? 7 : 17);
        if (yy < 0) yy += 18;
        chuvaY[i] = yy;
        const vis = i < n ? 1 : -100;
        chuvaPos[i * 6 + 1] = yy * vis; chuvaPos[i * 6 + 4] = (yy + (alvo.chuva < 0.5 ? 0.2 : 0.45)) * vis;
        chuvaPos[i * 6 + 3] = chuvaPos[i * 6] + vx;
      }
      chuvaGeo.attributes.position.needsUpdate = true;
    }
    neve.visible = alvo.neve;
    if (neve.visible) {
      for (let i = 0; i < NNEVE; i++) {
        let yy = nevePos[i * 3 + 1] - dt * (0.9 + (i % 5) * 0.12);
        if (yy < 0) yy += 16;
        nevePos[i * 3 + 1] = yy;
        nevePos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.25;
      }
      neveGeo.attributes.position.needsUpdate = true;
    }
    for (const f of folhasCaindo) {
      f.visible = alvo.folhas;
      if (!f.visible) continue;
      f.position.y -= dt * 0.7;
      f.position.x += (Math.sin(t + f.userData.fase) * 0.4 + alvo.vento * 0.8) * dt;
      f.rotation.x += dt * f.userData.vr; f.rotation.y += dt * f.userData.vr * 0.7;
      if (f.position.y < 0.05) f.position.set(rand(-13, 13), rand(3.5, 6), rand(-13, 13));
    }
    for (const a of arvores) {
      const s = Math.sin(t * (1 + alvo.vento) + a.fase) * 0.012 * (0.5 + alvo.vento * 3);
      a.g.rotation.z = s; a.g.rotation.x = s * 0.6;
    }
    for (const f of flores.children) {
      const al = (f.userData.alvo ?? 0) * f.userData.base;
      const s = f.scale.x + (al - f.scale.x) * Math.min(1, dt * 0.5);
      f.scale.setScalar(Math.max(0.001, s)); f.visible = s > 0.02;
      f.rotation.z = Math.sin(t * 2 + f.position.x) * 0.1 * (0.3 + alvo.vento);
    }
    for (const g of nuvens) {
      g.position.x += dt * (0.25 + alvo.vento * 1.2);
      if (g.position.x > 30) g.position.x = -30;
    }
    if (alvo.trovoada) {
      proxRaio -= dt;
      if (proxRaio <= 0) { flash = 1; proxRaio = rand(7, 18); if (Math.random() < 0.4) setTimeout(() => ctx.falar(ctx.frase('trovao')), 600); }
    }
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 4);
      hemi.intensity = hemiBase + flash * 2.5;
    }
  }

  // ------------------------------------------------------------ toque nos objetos
  const ray = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
  let inicioToque = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { inicioToque = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!inicioToque || Math.hypot(e.clientX - inicioToque[0], e.clientY - inicioToque[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ponteiro, camera);
    const alvos = [[mesa, 'pesquisas'], [mesinha, 'desenhos'], [mural, 'desenhos'], [capi.g, 'capivara']];
    for (const hit of ray.intersectObjects(alvos.map(([o]) => o), true)) {
      let o = hit.object;
      while (o && !alvos.some(([x]) => x === o)) o = o.parent;
      const achado = alvos.find(([x]) => x === o);
      if (achado) { achado[1] === 'capivara' ? ctx.falar(ctx.frase('parado')) : ctx.abrir(achado[1]); return; }
    }
  });

  // ------------------------------------------------------------ laço
  function ajustar() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 55 : 42;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(host);
  ajustar();

  const cabecaMundo = new THREE.Vector3();
  let ultimo = performance.now();
  function quadro(agora) {
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora; relogio += dt;
    passo(dt); pose(dt); clima3D(dt, relogio);
    const oc = ctx.atividade();
    const telaLigada = atual?.tipo === 'pesquisar';
    desenharTela(telaLigada, oc && oc.acao !== 'desenhar' ? oc.tema : '', relogio);
    const noPapel = ctx.desenhoNaMesa();
    desenharPapel(noPapel?.desenho, noPapel?.progresso ?? 1);
    controles.update();
    renderer.render(cena, camera);
    capi.partes.cabeca.getWorldPosition(cabecaMundo);
    cabecaMundo.y += 0.9;
    const v = cabecaMundo.project(camera);
    ctx.posicaoBalao((v.x + 1) / 2, (1 - v.y) / 2, v.z < 1);
    proxFala -= dt;
    if (proxFala <= 0) { if (atual?.tipo !== 'dormir' && Math.random() < 0.5) ctx.falar(ctx.frase(atual?.tipo ?? 'parado')); proxFala = rand(16, 36); }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
  setInterval(atualizarCeu, 60000);

  return { definirClima, definirMural };
}

// ------------------------------------------------------------ a capivara (feita de formas simples)
function criarCapivara() {
  const pelo = mat(0xa8714a), escuro = mat(0x7d5237), focinhoM = mat(0x8e5d3d), preto = mat(0x1d1612);
  const g = new THREE.Group();
  const corpo = new THREE.Group();
  g.add(corpo);
  const tronco = malha(new THREE.IcosahedronGeometry(0.7, 1), pelo, 0, 0.95, 0);
  tronco.scale.set(1.5, 0.95, 0.92);
  corpo.add(tronco);
  const traseiro = malha(new THREE.IcosahedronGeometry(0.55, 1), pelo, -0.55, 0.98, 0);
  corpo.add(traseiro);
  const cabeca = new THREE.Group();
  cabeca.position.set(0.82, 1.22, 0);
  corpo.add(cabeca);
  cabeca.add(malha(new THREE.BoxGeometry(0.78, 0.6, 0.6), pelo, 0.28, 0, 0));
  cabeca.add(malha(new THREE.BoxGeometry(0.42, 0.5, 0.54), focinhoM, 0.78, -0.04, 0));
  cabeca.add(malha(new THREE.BoxGeometry(0.06, 0.12, 0.3), preto, 1.0, 0.09, 0));
  for (const s of [1, -1]) cabeca.add(malha(new THREE.BoxGeometry(0.13, 0.16, 0.13), escuro, 0.06, 0.36, s * 0.2));
  const olhos = [1, -1].map((s) => malha(new THREE.SphereGeometry(0.065, 6, 4), preto, 0.5, 0.12, s * 0.305));
  cabeca.add(...olhos);
  const pernas = [];
  for (const [x, z] of [[0.55, 0.32], [0.55, -0.32], [-0.6, 0.32], [-0.6, -0.32]]) {
    const pe = new THREE.Group();
    pe.position.set(x, 0.62, z);
    pe.add(malha(new THREE.CylinderGeometry(0.13, 0.1, 0.62, 6), escuro, 0, -0.31, 0));
    corpo.add(pe); pernas.push(pe);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, partes: { corpo, cabeca, pernas, olhos } };
}
