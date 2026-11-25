// Desenha os traços dela como caneta em papel: linha tremida, tinta azul, papel creme.
// Um desenho é { id, tremor, tracos: [{ c: '#2b4c9b', p: [x1,y1,x2,y2,...] }] } em coordenadas 0..200.

export const TINTA = '#2b4c9b';

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function semente(texto) {
  let h = 2166136261;
  for (const ch of String(texto)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return mulberry(h);
}

// quebra segmentos longos em pedacinhos, para a mão "tremer" no caminho
function detalhar(p) {
  const out = [];
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i], y = p[i + 1];
    if (i > 0) {
      const px = p[i - 2], py = p[i - 1];
      const passos = Math.floor(Math.hypot(x - px, y - py) / 10);
      for (let k = 1; k < passos; k++) out.push([px + ((x - px) * k) / passos, py + ((y - py) * k) / passos]);
    }
    out.push([x, y]);
  }
  return out;
}

export function renderizarDesenho(canvas, desenho, progresso = 1) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, s = W / 200;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f4ecd4';
  ctx.fillRect(0, 0, W, W);
  const rp = semente('papel' + (desenho?.id ?? ''));
  ctx.fillStyle = '#8a7a50';
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 60; i++) ctx.fillRect(rp() * W, rp() * W, 1.6 * s, 1.6 * s);
  ctx.globalAlpha = 1;
  if (!desenho?.tracos?.length) return;

  const r = semente(desenho.id ?? 'x');
  const tremor = desenho.tremor ?? 1.2;
  const tracos = desenho.tracos.map((t) => ({ c: t.c, pts: detalhar(t.p ?? []) }));
  const total = tracos.reduce((n, t) => n + t.pts.length, 0);
  let resta = Math.max(0, Math.floor(total * progresso));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let deriva = 0;
  for (const t of tracos) {
    if (resta < 2) break;
    const n = Math.min(t.pts.length, resta);
    resta -= n;
    ctx.strokeStyle = t.c || TINTA;
    ctx.lineWidth = (1.9 + r() * 0.6) * s;
    ctx.globalAlpha = 0.82 + r() * 0.12;
    const pts = [];
    for (let i = 0; i < n; i++) {
      deriva = deriva * 0.7 + (r() - 0.5) * tremor;
      pts.push([(t.pts[i][0] + deriva + (r() - 0.5) * tremor * 0.5) * s, (t.pts[i][1] + deriva * 0.6 + (r() - 0.5) * tremor * 0.5) * s]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.6, pts[0][1] + 0.6);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
