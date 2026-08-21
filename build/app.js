(() => {
'use strict';
const D = window.DADOS;
const NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- utilidades
const el = (tag, attrs, pai) => {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (pai) pai.appendChild(n);
  return n;
};
const texto = (t, attrs, pai) => { const n = el('text', attrs, pai); n.textContent = t; return n; };
const num = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, t) => ((v / t) * 100).toFixed(1).replace('.', ',') + '%';
const html = (id) => document.getElementById(id);

// ------------------------------------------------------- projeção de Mercator
// Mercator é a projeção da própria época (Gerardus Mercator, 1569): foi feita
// para navegação — a linha de rumo constante é reta. Serve ao assunto.
const LON_MIN = -104, LON_MAX = 58, LAT_MAX = 60, LAT_MIN = -38, K = 10;
const mercY = (lat) => -(180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const Y0 = mercY(LAT_MAX);
const LARG = (LON_MAX - LON_MIN) * K;
const ALT = (mercY(LAT_MIN) - Y0) * K;
const proj = (lon, lat) => [(lon - LON_MIN) * K, (mercY(lat) - Y0) * K];
const caminho = (anel) => {
  let d = '';
  for (let i = 0; i < anel.length; i++) {
    const [x, y] = proj(anel[i][0], anel[i][1]);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  }
  return d + 'Z';
};

// ------------------------------------------------------------ estado da carta
const estado = {
  modo: 'rotas',
  cor: 'regiao',
  selecao: new Set(),
  bandeiraCircuito: 'gra_bretanha',
  periodo: 'xviii',
  camadas: { dominios: true, polities: true, ventos: true, portos: true, secundarios: false, graticula: true },
};

const REG = Object.fromEntries(D.regioes.map((r) => [r.id, r]));
const DES = Object.fromEntries(D.destinos.map((d) => [d.id, d]));
const BAN = Object.fromEntries(D.bandeiras.map((b) => [b.id, b]));
const corRegiao = (id) => D.coresRegiao[id] || '#6b573c';
const corBandeira = (id) => (BAN[id] ? BAN[id].cor : '#6b573c');
const corRota = (r) => (estado.cor === 'regiao' ? corRegiao(r.origem) : corBandeira(r.potencia));

// ------------------------------------------------- toponímia e ornamentos
const POLITIES = [
  ['Songhai', 0.5, 17.5], ['Império do Mali', -6.5, 13.6], ['Kaabu', -14.4, 12.7],
  ['Futa Jallon', -12.2, 10.6], ['Império Ashanti', -2.0, 7.4], ['Reino do Daomé', 1.9, 8.6],
  ['Império Oyo', 4.4, 9.0], ['Reino do Benim', 6.0, 6.9], ['Confederação Aro', 7.6, 6.1],
  ['Reino de Loango', 12.4, -3.4], ['Reino do Congo', 15.6, -6.6], ['Ndongo e Matamba', 17.6, -9.4],
  ['Império Lunda', 23.5, -9.6], ['Monomotapa', 31.0, -18.0], ['Reino Merina', 47.2, -19.6],
  ['Saara', 4.0, 24.5], ['Nova Espanha', -96.0, 24.5], ['Nova Granada', -74.5, 4.5],
  ['Vice-Reino do Peru', -73.0, -12.0], ['Estado do Brasil', -52.0, -9.0],
  ['Vice-Reino do Rio da Prata', -62.5, -31.5], ['Treze Colônias', -80.5, 36.5],
  ['Nova França', -74.0, 47.5], ['Luisiana', -92.0, 32.0], ['Guianas', -56.5, 3.5],
];
const OCEANOS = [
  ['Mar Oceano Atlântico', -28, -26, 26], ['Oceano Índico', 42.5, -21.5, 16],
];
const VENTOS = [
  { nome: 'Alísios de NE', pts: [[-19, 24], [-38, 19], [-58, 13]] },
  { nome: 'Alísios de SE', pts: [[4, -19], [-16, -10], [-33, -3]] },
  { nome: 'Ventos de oeste · Corrente do Golfo', pts: [[-72, 33], [-46, 42], [-16, 48]] },
  { nome: 'Corrente de Benguela', pts: [[12, -30], [10, -20], [11.5, -12]] },
];
// Colchetes de costa: linha ligeiramente ao largo, marcando a extensão de cada
// região de embarque, com o nome de época correndo por cima (como nas cartas antigas).
const ANCORAS_REGIAO = {
  senegambia: [-21.0, 16.4, 'end'], serra_leoa: [-18.0, 9.6, 'end'], barlavento: [-14.5, 1.2, 'end'],
  costa_ouro: [-4.5, -3.4, 'middle'], benim: [6.5, -6.6, 'middle'], biafra: [14.5, -0.6, 'start'],
  centro_ocidental: [2.0, -13.5, 'middle'], sudeste: [44.0, -28.0, 'middle'],
};
const COLCHETES = {
  senegambia: [[-18.9, 16.8], [-18.4, 14.0], [-17.5, 11.4]],
  serra_leoa: [[-15.9, 10.6], [-14.4, 8.2], [-12.6, 6.5]],
  barlavento: [[-11.8, 5.6], [-9.2, 4.0], [-6.2, 3.4]],
  costa_ouro: [[-4.6, 3.7], [-2.0, 3.6], [0.4, 4.0]],
  benim: [[1.3, 4.5], [3.6, 4.7], [5.6, 3.9]],
  biafra: [[6.6, 3.0], [8.6, 2.2], [9.9, 0.6]],
  centro_ocidental: [[10.4, -4.6], [11.2, -9.0], [11.6, -14.2]],
  sudeste: [[43.2, -12.0], [38.6, -19.4], [36.0, -25.2]],
};

// ------------------------------------------------------------------- desenhar
const svg = html('mapa');
svg.setAttribute('viewBox', `0 0 ${LARG} ${ALT}`);
svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

const defs = el('defs', null, svg);
// textura de papel/água
const filtro = el('filter', { id: 'papel', x: '0', y: '0', width: '100%', height: '100%' }, defs);
el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '4', seed: '7', result: 'ruido' }, filtro);
el('feColorMatrix', { in: 'ruido', type: 'saturate', values: '0', result: 'cinza' }, filtro);
el('feComponentTransfer', null, filtro).appendChild(
  el('feFuncA', { type: 'linear', slope: '0.055' }));
el('feComposite', { operator: 'over', in2: 'SourceGraphic' }, filtro);
const recorte = el('clipPath', { id: 'moldura' }, defs);
el('rect', { x: 0, y: 0, width: LARG, height: ALT }, recorte);

const palcoG = el('g', { 'clip-path': 'url(#moldura)' }, svg);
const gMar = el('g', null, palcoG);
const gGrat = el('g', { class: 'graticula' }, palcoG);
const gTerra = el('g', { class: 'terra' }, palcoG);
const gDom = el('g', null, palcoG);
const gVento = el('g', null, palcoG);
const gColch = el('g', null, palcoG);
const gRotas = el('g', null, palcoG);
const gPortos = el('g', null, palcoG);
const gRotulos = el('g', null, palcoG);
const gRotulosRegiao = el('g', null, palcoG);
const gOrnamento = el('g', null, palcoG);

// --- mar e papel
el('rect', { x: 0, y: 0, width: LARG, height: ALT, fill: 'var(--mar)' }, gMar);
el('rect', { x: 0, y: 0, width: LARG, height: ALT, fill: '#8d7147', filter: 'url(#papel)', opacity: '.14' }, gMar);

// --- graticula
for (let lon = -100; lon <= LON_MAX; lon += 10) {
  const [x] = proj(lon, 0);
  el('line', { x1: x, y1: 0, x2: x, y2: ALT }, gGrat);
}
for (let lat = -30; lat <= 50; lat += 10) {
  const [, y] = proj(0, lat);
  el('line', { x1: 0, y1: y, x2: LARG, y2: y }, gGrat);
}
const linhaNotavel = (lat, rotulo, tracejado) => {
  const [, y] = proj(0, lat);
  el('line', { x1: 0, y1: y, x2: LARG, y2: y, stroke: '#8d7147', 'stroke-width': 1.1,
    'stroke-dasharray': tracejado, opacity: .55 }, gGrat);
  texto(rotulo, { x: 212, y: y - 7, class: 'rotulo', 'font-size': 13, 'letter-spacing': '.18em', opacity: .75 }, gRotulos);
};
linhaNotavel(0, 'EQUADOR', null);
linhaNotavel(23.44, 'TRÓPICO DE CÂNCER', '7 6');
linhaNotavel(-23.44, 'TRÓPICO DE CAPRICÓRNIO', '7 6');
{ // meridiano de Tordesilhas (1494) — 370 léguas a oeste de Cabo Verde
  const [x] = proj(-46.62, 0);
  el('line', { x1: x, y1: 0, x2: x, y2: ALT, stroke: '#8c2f2f', 'stroke-width': 1.2,
    'stroke-dasharray': '10 7', opacity: .5 }, gGrat);
  const t = texto('MERIDIANO DE TORDESILHAS · 1494', { x: x + 8, y: 34, class: 'rotulo',
    'font-size': 12.5, 'letter-spacing': '.16em', fill: '#8c2f2f', opacity: .8 }, gRotulos);
  t.setAttribute('transform', `rotate(90 ${x + 8} 34)`);
}

// --- domínios coloniais
for (const [potencia, aneis] of Object.entries(D.geo.dominios)) {
  const g = el('g', { class: 'dominio', fill: corBandeira(potencia), opacity: .38 }, gDom);
  for (const anel of aneis) el('path', { d: caminho(anel) }, g);
}

// --- terra
for (const anel of D.geo.litoral) el('path', { d: caminho(anel) }, gTerra);

// --- ventos e correntes
for (const v of VENTOS) {
  const p = v.pts.map((c) => proj(c[0], c[1]));
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  d += `Q${p[1][0].toFixed(1)},${p[1][1].toFixed(1)} ${p[2][0].toFixed(1)},${p[2][1].toFixed(1)}`;
  const id = 'vento-' + v.nome.replace(/\W+/g, '');
  el('path', { d, id, class: 'vento', 'marker-end': 'url(#seta-vento)' }, gVento);
  const t = el('text', { class: 'rotulo vento', dy: -6 }, gVento);
  const tp = el('textPath', { href: '#' + id, startOffset: '38%' }, t);
  tp.textContent = v.nome;
}
const mk = el('marker', { id: 'seta-vento', viewBox: '0 0 10 10', refX: 8, refY: 5,
  markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
el('path', { d: 'M0,1 L9,5 L0,9 z', fill: '#6b573c', opacity: .55 }, mk);

// --- colchetes de costa africana
for (const [id, pts] of Object.entries(COLCHETES)) {
  const reg = REG[id]; if (!reg) continue;
  const p = pts.map((c) => proj(c[0], c[1]));
  const d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}Q${p[1][0].toFixed(1)},${p[1][1].toFixed(1)} ${p[2][0].toFixed(1)},${p[2][1].toFixed(1)}`;
  const pid = 'colch-' + id;
  el('path', { d, id: pid, class: 'colchete', stroke: corRegiao(id), 'data-colchete': id }, gColch);
  const anc = ANCORAS_REGIAO[id];
  const [lx, ly] = proj(anc[0], anc[1]);
  const t = texto(reg.nome_carta || reg.nome_epoca, { x: lx, y: ly, class: 'rotulo regiao', fill: corRegiao(id),
    'text-anchor': anc[2], 'data-rot': 'regiao' }, gRotulosRegiao);
  const mx = 0.25 * p[0][0] + 0.5 * p[1][0] + 0.25 * p[2][0];
  const my = 0.25 * p[0][1] + 0.5 * p[1][1] + 0.25 * p[2][1];
  el('line', { x1: lx + (anc[2] === 'end' ? 6 : anc[2] === 'start' ? -6 : 0), y1: ly - 4,
    x2: mx, y2: my, stroke: corRegiao(id), 'stroke-width': .8, 'stroke-dasharray': '3 4', opacity: .5 }, gColch);
  t.parentNode.appendChild(t);
}

// --- topônimos
for (const [nome, lon, lat] of POLITIES) {
  const [x, y] = proj(lon, lat);
  texto(nome, { x, y, class: 'rotulo polity', 'text-anchor': 'middle', 'data-polity': '1', 'data-rot': 'polity' }, gRotulos);
}
for (const [nome, lon, lat, tam] of OCEANOS) {
  const [x, y] = proj(lon, lat);
  texto(nome, { x, y, class: 'rotulo oceano', 'text-anchor': 'middle', 'font-size': tam, 'data-rot': 'oceano' }, gRotulos);
}

// --- portos
const marcarPorto = (porto, cor, tamanho, classe, peso) => {
  const [x, y] = proj(porto.lon, porto.lat);
  const g = el('g', null, gPortos);
  el('circle', { cx: x, cy: y, r: tamanho, fill: cor, class: 'porto' }, g);
  if (classe === 'porto-principal') {
    el('circle', { cx: x, cy: y, r: tamanho + 3.4, fill: 'none', stroke: cor, 'stroke-width': 1, opacity: .6 }, g);
  }
  texto(porto.nome, { x: x + tamanho + 5, y: y + 4, class: 'rotulo porto',
    'font-size': classe === 'porto-principal' ? 13.5 : 11.5, 'data-rot': classe,
    'data-ax': x, 'data-ay': y, 'data-r': tamanho, 'data-peso': peso || 0 }, g);
  return g;
};
for (const r of D.regioes) {
  marcarPorto(r.porto, corRegiao(r.id), 5, 'porto-principal', r.embarcados);
  for (const p of r.portos_secundarios || []) marcarPorto(p, corRegiao(r.id), 3, 'porto-secundario');
}
for (const d of D.destinos) {
  marcarPorto(d.porto, corBandeira(d.potencia), 5, 'porto-principal', d.desembarcados);
  for (const p of d.portos_secundarios || []) marcarPorto(p, corBandeira(d.potencia), 3, 'porto-secundario');
}
const jaMarcado = [...D.destinos, ...D.regioes]
  .flatMap((d) => [d.porto, ...(d.portos_secundarios || [])]);
for (const b of D.bandeiras) {
  for (const p of b.portos_armadores || []) {
    if (jaMarcado.some((q) => Math.abs(q.lon - p.lon) < 1.6 && Math.abs(q.lat - p.lat) < 1.6)) continue;
    jaMarcado.push(p);
    marcarPorto(p, b.cor, 3.4, 'armador');
  }
}

// ------------------------------------------- descongestionamento dos rótulos
// Cartas de época amontoam nomes; ecrãs não perdoam. Cada rótulo tenta quatro
// posições em volta do seu porto e, se todas colidirem, some.
function descongestionar() {
  const ocupados = [];
  const infla = (r) => ({ x: r.x - 6, y: r.y - 2, w: r.width + 12, h: r.height + 4 });
  const colide = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const cabe = (r) => !ocupados.some((o) => colide(r, o));
  const medir = (t) => { const b = t.getBBox(); return infla({ x: b.x, y: b.y, width: b.width, height: b.height }); };

  for (const t of gRotulosRegiao.querySelectorAll('[data-rot="regiao"]')) ocupados.push(medir(t));
  const posicoes = [
    (ax, ay, r) => ({ x: ax + r + 5, y: ay + 4, ancora: 'start' }),
    (ax, ay, r) => ({ x: ax - r - 5, y: ay + 4, ancora: 'end' }),
    (ax, ay, r) => ({ x: ax, y: ay - r - 7, ancora: 'middle' }),
    (ax, ay, r) => ({ x: ax, y: ay + r + 16, ancora: 'middle' }),
    (ax, ay, r) => ({ x: ax + r + 4, y: ay - r - 6, ancora: 'start' }),
    (ax, ay, r) => ({ x: ax - r - 4, y: ay - r - 6, ancora: 'end' }),
    (ax, ay, r) => ({ x: ax + r + 4, y: ay + r + 14, ancora: 'start' }),
    (ax, ay, r) => ({ x: ax - r - 4, y: ay + r + 14, ancora: 'end' }),
    (ax, ay, r) => ({ x: ax, y: ay - r - 22, ancora: 'middle' }),
    (ax, ay, r) => ({ x: ax, y: ay + r + 31, ancora: 'middle' }),
  ];
  const visivel = (t) => {
    const r = t.dataset.rot;
    if (r === 'porto-secundario' || r === 'armador') return estado.camadas.portos && estado.camadas.secundarios;
    if (r === 'porto-principal') return estado.camadas.portos;
    if (r === 'polity') return estado.camadas.polities;
    return true;
  };
  const porPeso = (a, b) => (+b.dataset.peso || 0) - (+a.dataset.peso || 0);
  const emOrdem = [
    [...gPortos.querySelectorAll('[data-rot="porto-principal"]')].sort(porPeso),
    ...gRotulos.querySelectorAll('[data-rot="polity"]'),
    ...gPortos.querySelectorAll('[data-rot="porto-secundario"]'),
    ...gPortos.querySelectorAll('[data-rot="armador"]'),
  ].flat();
  for (const t of emOrdem) {
    t.style.display = '';
    if (!visivel(t)) { t.dataset.oculto = '1'; continue; }
    if (t.dataset.rot === 'polity') {
      const r = medir(t);
      if (cabe(r)) { ocupados.push(r); delete t.dataset.oculto; }
      else { t.style.display = 'none'; t.dataset.oculto = '1'; }
      continue;
    }
    const ax = +t.dataset.ax, ay = +t.dataset.ay, raio = +t.dataset.r;
    let posto = false;
    for (const pos of posicoes) {
      const p = pos(ax, ay, raio);
      t.setAttribute('x', p.x); t.setAttribute('y', p.y); t.setAttribute('text-anchor', p.ancora);
      const r = medir(t);
      if (cabe(r)) { ocupados.push(r); posto = true; break; }
    }
    if (!posto) t.style.display = 'none';
  }
}

// --- ornamentos: rosa dos ventos, escala, cartucho
function rosaDosVentos(lon, lat, raio) {
  const [cx, cy] = proj(lon, lat);
  const g = el('g', { opacity: .72 }, gOrnamento);
  el('circle', { cx, cy, r: raio, fill: 'none', stroke: '#8d7147', 'stroke-width': 1 }, g);
  el('circle', { cx, cy, r: raio * .62, fill: 'none', stroke: '#8d7147', 'stroke-width': .6 }, g);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const grande = i % 4 === 0, medio = i % 2 === 0;
    const r1 = grande ? raio * 1.16 : medio ? raio * .95 : raio * .78;
    const larg = grande ? raio * .12 : raio * .07;
    const px = cx + Math.sin(a) * r1, py = cy - Math.cos(a) * r1;
    const qx = cx + Math.sin(a + Math.PI / 2) * larg, qy = cy - Math.cos(a + Math.PI / 2) * larg;
    const rx = cx + Math.sin(a - Math.PI / 2) * larg, ry = cy - Math.cos(a - Math.PI / 2) * larg;
    el('path', { d: `M${px},${py} L${qx},${qy} L${rx},${ry} Z`,
      fill: i % 2 === 0 ? '#5d4a30' : 'none', stroke: '#5d4a30', 'stroke-width': .7 }, g);
  }
  texto('N', { x: cx, y: cy - raio * 1.34, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 15 }, g);
  texto('S', { x: cx, y: cy + raio * 1.46, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 15 }, g);
  texto('L', { x: cx + raio * 1.36, y: cy + 5, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 15 }, g);
  texto('O', { x: cx - raio * 1.36, y: cy + 5, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 15 }, g);
}
rosaDosVentos(-96, -20, 28);

function escala(lon, lat) {
  const [x, y] = proj(lon, lat);
  const kmPorPx = 111.32 / K;              // válido no Equador
  const larguraTotal = 2000 / kmPorPx;
  const g = el('g', null, gOrnamento);
  for (let i = 0; i < 4; i++) {
    el('rect', { x: x + (i * larguraTotal) / 4, y, width: larguraTotal / 4, height: 7,
      fill: i % 2 ? '#f2e7cd' : '#5d4a30', stroke: '#5d4a30', 'stroke-width': .7 }, g);
  }
  texto('0', { x, y: y - 6, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 12 }, g);
  texto('2.000 km', { x: x + larguraTotal, y: y - 6, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 12 }, g);
  texto('≈ 360 léguas marítimas · escala verdadeira sobre o Equador',
    { x, y: y + 22, class: 'rotulo', 'font-size': 12, 'font-style': 'italic' }, g);
}
escala(-101, -31);

function cartucho() {
  const [x, y] = proj(20, -30);
  const g = el('g', { opacity: .85 }, gOrnamento);
  el('rect', { x, y, width: 350, height: 96, fill: 'var(--papel)', stroke: '#5d4a30',
    'stroke-width': 1.4, rx: 2, opacity: .82 }, g);
  el('rect', { x: x + 5, y: y + 5, width: 340, height: 86, fill: 'none', stroke: '#5d4a30', 'stroke-width': .6 }, g);
  texto('CARTA DO TRÁFICO ATLÂNTICO', { x: x + 175, y: y + 36, 'text-anchor': 'middle',
    class: 'rotulo', 'font-size': 19, 'letter-spacing': '.1em', fill: '#3a2b1a' }, g);
  texto('das costas de África às Índias de Ocidente', { x: x + 175, y: y + 60, 'text-anchor': 'middle',
    class: 'rotulo', 'font-size': 14, 'font-style': 'italic' }, g);
  texto('MDI — MDCCCLXVI', { x: x + 175, y: y + 81, 'text-anchor': 'middle',
    class: 'rotulo', 'font-size': 12, 'letter-spacing': '.24em' }, g);
}
cartucho();

// ------------------------------------------------------------ traçado de rota
function arco(de, para, curvatura) {
  const [x1, y1] = proj(de[0], de[1]);
  const [x2, y2] = proj(para[0], para[1]);
  const dx = x2 - x1, dy = y2 - y1;
  const comp = Math.hypot(dx, dy) || 1;
  const latMedia = (de[1] + para[1]) / 2;
  // curva para o lado do Equador: era assim que se navegava (alísios e correntes)
  const sinal = latMedia >= 0 ? 1 : -1;
  let nx = -dy / comp, ny = dx / comp;
  if (Math.sign(ny) !== sinal) { nx = -nx; ny = -ny; }
  const mag = Math.min(180, Math.max(26, comp * (curvatura == null ? 0.15 : curvatura)));
  const cxp = (x1 + x2) / 2 + nx * mag, cyp = (y1 + y2) / 2 + ny * mag;
  return { d: `M${x1.toFixed(1)},${y1.toFixed(1)}Q${cxp.toFixed(1)},${cyp.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
    p0: [x1, y1], c: [cxp, cyp], p1: [x2, y2] };
}
const ponto = (a, t) => {
  const u = 1 - t;
  return [u * u * a.p0[0] + 2 * u * t * a.c[0] + t * t * a.p1[0],
          u * u * a.p0[1] + 2 * u * t * a.c[1] + t * t * a.p1[1]];
};
const tangente = (a, t) => {
  const u = 1 - t;
  return [2 * u * (a.c[0] - a.p0[0]) + 2 * t * (a.p1[0] - a.c[0]),
          2 * u * (a.c[1] - a.p0[1]) + 2 * t * (a.p1[1] - a.c[1])];
};
function seta(a, t, tam, cor, pai) {
  const [px, py] = ponto(a, t);
  const [tx, ty] = tangente(a, t);
  const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
  const g = el('g', { transform: `translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${ang.toFixed(1)})` }, pai);
  el('path', { d: `M${-tam},${-tam * 0.62} L${tam * 0.9},0 L${-tam},${tam * 0.62} Z`, fill: cor }, g);
}

const vMax = Math.max(...D.rotas.map((r) => r.embarcados));
const larguraRota = (v) => 1.8 + 25 * Math.pow(v / vMax, 0.62);

// ------------------------------------------------------------------- tooltip
const dica = html('dica'), palco = html('palco');
function mostrarDica(evt, conteudo) {
  dica.innerHTML = conteudo;
  dica.classList.add('visivel');
  const cx = palco.getBoundingClientRect();
  let x = evt.clientX - cx.left + 16, y = evt.clientY - cx.top + 16;
  const larg = dica.offsetWidth, alt = dica.offsetHeight;
  if (x + larg > cx.width - 8) x = evt.clientX - cx.left - larg - 16;
  if (y + alt > cx.height - 8) y = Math.max(8, evt.clientY - cx.top - alt - 16);
  dica.style.left = x + 'px'; dica.style.top = y + 'px';
}
const esconderDica = () => dica.classList.remove('visivel');
palco.addEventListener('pointerleave', esconderDica);

// ----------------------------------------------------------- modos de desenho
function limpar(g) { while (g.firstChild) g.removeChild(g.firstChild); }

function desenharRotas() {
  limpar(gRotas);
  const sel = estado.selecao;
  const chave = (r) => (estado.cor === 'regiao' ? r.origem : r.potencia);
  for (const r of D.rotas) {
    const a = arco(r.de, r.para);
    const cor = corRota(r);
    const ativo = sel.size === 0 || sel.has(chave(r));
    const g = el('g', { class: ativo ? '' : 'apagado' }, gRotas);
    const recaptura = r.destino === 'europa_africa';
    el('path', { d: a.d, class: 'rota', stroke: cor, 'stroke-width': larguraRota(r.embarcados),
      opacity: recaptura ? .45 : .62, 'stroke-dasharray': recaptura ? '9 7' : null }, g);
    if (!recaptura) el('path', { d: a.d, class: 'rota fluxo', stroke: '#fdf6e6',
      'stroke-width': Math.max(1, larguraRota(r.embarcados) * 0.3), opacity: .55 }, g);
    seta(a, 0.93, Math.max(5, larguraRota(r.embarcados) * 0.55), cor, g);
    const toque = el('path', { d: a.d, class: 'rota-toque' }, g);
    const conteudo = `<h4>${REG[r.origem].nome} → ${DES[r.destino].nome}</h4>
      <div>${r.nomeDe} &rarr; ${r.nomePara}</div>
      <dl>
        <dt>Embarcados</dt><dd>${num(r.embarcados)}</dd>
        <dt>Desembarcados</dt><dd>${num(r.desembarcados)}</dd>
        <dt>Mortos na travessia</dt><dd>${num(r.embarcados - r.desembarcados)}</dd>
        <dt>Do total do tráfico</dt><dd>${pct(r.embarcados, D.meta.totalEmbarcados)}</dd>
      </dl>
      <div class="nota">Bandeira predominante: ${BAN[r.potencia] ? BAN[r.potencia].nome : '—'}</div>`;
    toque.addEventListener('pointermove', (e) => mostrarDica(e, conteudo));
    toque.addEventListener('pointerleave', esconderDica);
  }
}

function desenharCircuitos() {
  limpar(gRotas);
  const c = D.circuitos.find((x) => x.bandeira === estado.bandeiraCircuito);
  if (!c) return;
  const cor = corBandeira(c.bandeira);
  const ESTILO = {
    ida: { cor: '#6b573c', tracejado: '11 7', largura: 3.6, rotulo: 'Ida — mercadorias para troca' },
    travessia: { cor, tracejado: null, largura: 11, rotulo: 'Travessia do meio — pessoas' },
    bilateral: { cor: '#6b573c', tracejado: '11 7', largura: 3.6, rotulo: 'Circuito bilateral — mercadorias' },
    retorno: { cor: '#8a6f4a', tracejado: '3 6', largura: 3.6, rotulo: 'Retorno — gêneros coloniais' },
  };
  const pontos = new Map();
  for (const perna of c.pernas) {
    pontos.set(perna.de.join(), perna.deNome);
    pontos.set(perna.para.join(), perna.paraNome);
  }
  let iTravessia = 0;
  for (const perna of c.pernas) {
    const s = ESTILO[perna.tipo];
    const curva = perna.tipo === 'travessia' ? 0.13 + 0.045 * iTravessia++ : 0.09;
    const a = arco(perna.de, perna.para, curva);
    const g = el('g', null, gRotas);
    el('path', { d: a.d, class: 'rota', stroke: s.cor, 'stroke-width': s.largura,
      'stroke-dasharray': s.tracejado, opacity: perna.tipo === 'travessia' ? .72 : .8 }, g);
    if (perna.tipo === 'travessia') {
      el('path', { d: a.d, class: 'rota fluxo', stroke: '#fdf6e6', 'stroke-width': 3, opacity: .6 }, g);
    }
    seta(a, 0.93, perna.tipo === 'travessia' ? 8 : 6, s.cor, g);
    const toque = el('path', { d: a.d, class: 'rota-toque' }, g);
    const conteudo = `<h4>${perna.deNome} → ${perna.paraNome}</h4>
      <div>${s.rotulo}</div><div class="nota">${perna.carga}</div>`;
    toque.addEventListener('pointermove', (e) => mostrarDica(e, conteudo));
    toque.addEventListener('pointerleave', esconderDica);
  }
  for (const [chave, nome] of pontos) {
    const [lon, lat] = chave.split(',').map(Number);
    const [x, y] = proj(lon, lat);
    const g = el('g', null, gRotas);
    el('circle', { cx: x, cy: y, r: 5.5, fill: cor, class: 'porto' }, g);
    el('circle', { cx: x, cy: y, r: 9, fill: 'none', stroke: cor, 'stroke-width': 1, opacity: .6 }, g);
    texto(nome, { x, y: y - 13, class: 'rotulo porto', 'font-size': 14, 'text-anchor': 'middle' }, g);
  }
}

function desenharSeculo() {
  limpar(gRotas);
  const p = D.periodos.find((x) => x.id === estado.periodo);
  {
    const [x, y] = proj(-98, 46);
    const g = el('g', null, gRotas);
    el('rect', { x, y, width: 250, height: 70, fill: 'var(--papel)', stroke: '#5d4a30',
      'stroke-width': 1.2, opacity: .9 }, g);
    texto(p.rotulo, { x: x + 125, y: y + 34, 'text-anchor': 'middle', class: 'rotulo',
      'font-size': 27, 'letter-spacing': '.06em', fill: '#3a2b1a' }, g);
    texto(num(p.embarcados) + ' embarcados', { x: x + 125, y: y + 56, 'text-anchor': 'middle',
      class: 'rotulo', 'font-size': 14, 'font-style': 'italic' }, g);
  }
  const dominante = (r) => p.regioes_dominantes.includes(r.origem) && p.destinos_dominantes.includes(r.destino);
  for (const r of D.rotas) {
    const a = arco(r.de, r.para);
    const cor = corRota(r);
    const dom = dominante(r);
    const g = el('g', { class: dom ? '' : 'sumido' }, gRotas);
    el('path', { d: a.d, class: 'rota', stroke: dom ? cor : '#6b573c',
      'stroke-width': larguraRota(r.embarcados), opacity: dom ? .74 : .9 }, g);
    if (dom) {
      el('path', { d: a.d, class: 'rota fluxo', stroke: '#fdf6e6',
        'stroke-width': Math.max(1, larguraRota(r.embarcados) * 0.3), opacity: .55 }, g);
      seta(a, 0.93, Math.max(5, larguraRota(r.embarcados) * 0.55), cor, g);
      const toque = el('path', { d: a.d, class: 'rota-toque' }, g);
      const conteudo = `<h4>${REG[r.origem].nome} → ${DES[r.destino].nome}</h4>
        <div class="nota">Corredor ativo e dominante em ${p.rotulo}. Os números exibidos são
        do total 1501–1866 — o TSTD não sustenta uma matriz origem×destino por século.</div>
        <dl><dt>Embarcados (total)</dt><dd>${num(r.embarcados)}</dd></dl>`;
      toque.addEventListener('pointermove', (e) => mostrarDica(e, conteudo));
      toque.addEventListener('pointerleave', esconderDica);
    }
  }
}

// ------------------------------------------------------------------ controles
function ficha(rotulo, ativo, cor, aoClicar, pequena) {
  const b = document.createElement('button');
  b.className = 'ficha' + (pequena ? ' pequena' : '');
  b.type = 'button';
  b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
  if (cor) { const s = document.createElement('span'); s.className = 'ponto'; s.style.background = cor; b.appendChild(s); }
  b.appendChild(document.createTextNode(rotulo));
  b.addEventListener('click', aoClicar);
  return b;
}

const MODOS = [
  ['rotas', 'Rotas do tráfico'],
  ['circuitos', 'Comércio triangular'],
  ['seculos', 'Século a século'],
];

function montarControles() {
  const fm = html('fichas-modo'); fm.innerHTML = '';
  for (const [id, rot] of MODOS) {
    fm.appendChild(ficha(rot, estado.modo === id, null, () => { estado.modo = id; estado.selecao.clear(); render(); }));
  }
  const fc = html('fichas-cor'); fc.innerHTML = '';
  for (const [id, rot] of [['regiao', 'Região africana'], ['bandeira', 'Bandeira do navio']]) {
    fc.appendChild(ficha(rot, estado.cor === id, null, () => { estado.cor = id; estado.selecao.clear(); render(); }));
  }

  const ff = html('fichas-filtro'); ff.innerHTML = '';
  const rf = html('rotulo-filtro');
  if (estado.modo === 'circuitos') {
    rf.textContent = 'Bandeira';
    for (const b of D.bandeiras) {
      ff.appendChild(ficha(b.nome, estado.bandeiraCircuito === b.id, b.cor,
        () => { estado.bandeiraCircuito = b.id; render(); }, true));
    }
  } else if (estado.modo === 'seculos') {
    rf.textContent = 'Período';
    for (const p of D.periodos) {
      ff.appendChild(ficha(p.rotulo, estado.periodo === p.id, null, () => { estado.periodo = p.id; render(); }));
    }
  } else if (estado.cor === 'regiao') {
    rf.textContent = 'Regiões de embarque';
    ff.appendChild(ficha('Todas', estado.selecao.size === 0, null, () => { estado.selecao.clear(); render(); }, true));
    for (const r of D.regioes) {
      ff.appendChild(ficha(r.nome, estado.selecao.has(r.id), corRegiao(r.id), () => alternar(r.id), true));
    }
  } else {
    rf.textContent = 'Bandeiras';
    ff.appendChild(ficha('Todas', estado.selecao.size === 0, null, () => { estado.selecao.clear(); render(); }, true));
    for (const b of D.bandeiras) {
      if (!D.rotas.some((r) => r.potencia === b.id)) continue;
      ff.appendChild(ficha(b.nome, estado.selecao.has(b.id), b.cor, () => alternar(b.id), true));
    }
  }

  const fl = html('fichas-camadas'); fl.innerHTML = '';
  const CAMADAS = [['dominios', 'Domínios coloniais'], ['polities', 'Estados africanos'],
    ['ventos', 'Ventos e correntes'], ['portos', 'Portos principais'],
    ['secundarios', 'Portos secundários'], ['graticula', 'Graticulado']];
  for (const [id, rot] of CAMADAS) {
    fl.appendChild(ficha(rot, estado.camadas[id], null,
      () => { estado.camadas[id] = !estado.camadas[id]; render(); }, true));
  }
}
function alternar(id) {
  if (estado.selecao.has(id)) estado.selecao.delete(id); else estado.selecao.add(id);
  render();
}

function aplicarCamadas() {
  gDom.style.display = estado.camadas.dominios ? '' : 'none';
  gVento.style.display = estado.camadas.ventos ? '' : 'none';
  gGrat.style.display = estado.camadas.graticula ? '' : 'none';
  gPortos.style.display = estado.camadas.portos ? '' : 'none';
  for (const g of gPortos.children) {
    const t = g.querySelector('[data-rot]');
    const sec = t && (t.dataset.rot === 'porto-secundario' || t.dataset.rot === 'armador');
    g.style.display = sec && !estado.camadas.secundarios ? 'none' : '';
  }
  gRotulos.dataset.polities = estado.camadas.polities ? '1' : '0';
  for (const t of gRotulos.querySelectorAll('[data-polity]')) {
    t.style.display = estado.camadas.polities && !t.dataset.oculto ? '' : 'none';
  }
  const soRotas = estado.modo === 'rotas' || estado.modo === 'seculos';
  gColch.style.display = soRotas ? '' : 'none';
  gPortos.style.opacity = soRotas ? '1' : '.3';
}

// -------------------------------------------------------------------- legenda
function montarLegenda() {
  const l = html('legenda'); l.innerHTML = '';
  const item = (conteudo) => { const d = document.createElement('div'); d.className = 'item'; d.innerHTML = conteudo; l.appendChild(d); };
  if (estado.modo === 'circuitos') {
    const c = D.circuitos.find((x) => x.bandeira === estado.bandeiraCircuito);
    item(`<svg width="52" height="12"><line x1="1" y1="6" x2="51" y2="6" stroke="${corBandeira(estado.bandeiraCircuito)}" stroke-width="9" stroke-linecap="round" opacity=".72"/></svg> Travessia do meio (pessoas)`);
    item(`<svg width="52" height="12"><line x1="1" y1="6" x2="51" y2="6" stroke="#6b573c" stroke-width="3.4" stroke-dasharray="11 7"/></svg> Ida — mercadorias de troca`);
    item(`<svg width="52" height="12"><line x1="1" y1="6" x2="51" y2="6" stroke="#8a6f4a" stroke-width="3.4" stroke-dasharray="3 6"/></svg> Retorno — gêneros coloniais`);
    item(`<b>Modelo:</b>&nbsp;${c ? c.modelo : ''}`);
  } else {
    const escalas = [3000000, 1000000, 250000, 50000];
    let s = '<svg width="230" height="34" aria-hidden="true">';
    let x = 4;
    for (const v of escalas) {
      const w = larguraRota(v);
      s += `<line x1="${x}" y1="14" x2="${x + 30}" y2="14" stroke="#6b573c" stroke-width="${w}" stroke-linecap="round" opacity=".62"/>`;
      s += `<text x="${x + 15}" y="31" text-anchor="middle" font-size="10" fill="#6b573c">${v >= 1e6 ? v / 1e6 + 'M' : v / 1000 + 'k'}</text>`;
      x += 52;
    }
    s += '</svg>';
    item(s + '&nbsp;Espessura ∝ pessoas embarcadas');
    const fonte = estado.cor === 'regiao' ? D.regioes.map((r) => [r.nome, corRegiao(r.id)])
      : D.bandeiras.map((b) => [b.nome, b.cor]);
    for (const [nome, cor] of fonte) {
      item(`<span style="width:13px;height:13px;border-radius:2px;background:${cor};display:inline-block"></span> ${nome}`);
    }
  }
}

// ------------------------------------------------------------------- render
let prontoParaMedir = false;
function render() {
  if (prontoParaMedir) descongestionar();
  aplicarCamadas();
  if (estado.modo === 'rotas') desenharRotas();
  else if (estado.modo === 'circuitos') desenharCircuitos();
  else desenharSeculo();
  montarControles();
  montarLegenda();
  const nota = html('nota-carta');
  if (estado.modo === 'circuitos') {
    const c = D.circuitos.find((x) => x.bandeira === estado.bandeiraCircuito);
    const b = BAN[estado.bandeiraCircuito];
    nota.innerHTML = `<b>${b.nome}</b> — ${num(b.embarcados)} pessoas embarcadas
      (${pct(b.embarcados, D.meta.totalEmbarcados)} de todo o tráfico), ${b.periodo}. ${b.nota}
      <br><i>Modelo do circuito: ${c.modelo}.</i>`;
  } else if (estado.modo === 'seculos') {
    const p = D.periodos.find((x) => x.id === estado.periodo);
    nota.innerHTML = `<b>${p.rotulo}</b> — ${num(p.embarcados)} pessoas embarcadas
      (${pct(p.embarcados, D.meta.totalEmbarcados)} do total). ${p.sintese}
      <br><i>Em destaque: os corredores dominantes do período. As espessuras continuam sendo as do
      total 1501–1866 — as estimativas do TSTD por século são confiáveis nos totais, não numa matriz
      origem × destino ano a ano.</i>`;
  } else {
    nota.innerHTML = `Traçadas ${D.rotas.length} rotas com mais de ${num(D.meta.limiarRota)} pessoas embarcadas.
      Os fluxos menores existem — quase todo porto africano mandou gente para quase todo porto americano —
      mas não cabem numa carta legível.`;
  }
}

// ------------------------------------------------------- navegação do mapa
let vb = { x: 0, y: 0, w: LARG, h: ALT };
const aplicarVb = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
let arrastando = null;
svg.addEventListener('pointerdown', (e) => {
  arrastando = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
  svg.setPointerCapture(e.pointerId);
  svg.style.cursor = 'grabbing';
});
svg.addEventListener('pointermove', (e) => {
  if (!arrastando) return;
  const r = svg.getBoundingClientRect();
  vb.x = arrastando.vx - ((e.clientX - arrastando.x) * vb.w) / r.width;
  vb.y = arrastando.vy - ((e.clientY - arrastando.y) * vb.h) / r.height;
  aplicarVb();
});
const soltar = () => { arrastando = null; svg.style.cursor = ''; };
svg.addEventListener('pointerup', soltar);
svg.addEventListener('pointercancel', soltar);
svg.addEventListener('dblclick', () => { vb = { x: 0, y: 0, w: LARG, h: ALT }; aplicarVb(); });
svg.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return;   // não sequestra a rolagem da página
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  const px = vb.x + ((e.clientX - r.left) / r.width) * vb.w;
  const py = vb.y + ((e.clientY - r.top) / r.height) * vb.h;
  const f = e.deltaY > 0 ? 1.18 : 1 / 1.18;
  const nw = Math.min(LARG * 1.4, Math.max(LARG * 0.12, vb.w * f));
  const k = nw / vb.w;
  vb = { x: px - (px - vb.x) * k, y: py - (py - vb.y) * k, w: nw, h: vb.h * k };
  aplicarVb();
}, { passive: false });

// ----------------------------------------------------------------- quadros
html('n-embarcados').textContent = num(D.meta.totalEmbarcados);
html('n-desembarcados').textContent = num(D.meta.totalDesembarcados);
html('n-mortos').textContent = num(D.meta.mortosTravessia);

function tabela(destino, colunas, linhas) {
  const t = html(destino);
  t.innerHTML = '<thead><tr>' + colunas.map((c) => `<th class="${c.num ? 'num' : ''}">${c.rotulo}</th>`).join('') +
    '</tr></thead><tbody>' + linhas.map((l) => '<tr>' + l.map((c, i) =>
      `<td class="${colunas[i].num ? 'num' : ''}">${c}</td>`).join('') + '</tr>').join('') + '</tbody>';
  return t;
}
const barra = (v, max, cor) =>
  `<div class="barra"><i style="width:${((v / max) * 100).toFixed(1)}%;background:${cor}"></i></div>`;

// rotas
{
  const max = D.rotas[0].embarcados;
  tabela('tabela-rotas',
    [{ rotulo: 'Região de embarque' }, { rotulo: 'Destino' }, { rotulo: 'Embarcados', num: true },
     { rotulo: 'Desembarcados', num: true }, { rotulo: 'Mortos', num: true }, { rotulo: '% do total', num: true }, { rotulo: '' }],
    D.rotas.map((r) => [
      `<span style="color:${corRegiao(r.origem)}">■</span> ${REG[r.origem].nome}`,
      DES[r.destino].nome, num(r.embarcados), num(r.desembarcados),
      num(r.embarcados - r.desembarcados), pct(r.embarcados, D.meta.totalEmbarcados),
      barra(r.embarcados, max, corRegiao(r.origem)),
    ]));
}
// origens
{
  const max = Math.max(...D.regioes.map((r) => r.embarcados));
  tabela('tabela-origens',
    [{ rotulo: 'Região' }, { rotulo: 'Embarcados', num: true }, { rotulo: '%', num: true }, { rotulo: '' }],
    [...D.regioes].sort((a, b) => b.embarcados - a.embarcados).map((r) => [
      r.nome, num(r.embarcados), pct(r.embarcados, D.meta.totalEmbarcados), barra(r.embarcados, max, corRegiao(r.id)),
    ]));
}
// destinos — agrupados por conjunto colonial, com subtotal
{
  const grupos = [];
  for (const d of D.destinos) {
    let g = grupos.find((x) => x.id === d.grupo);
    if (!g) { g = { id: d.grupo, nome: d.grupo_nome, total: 0, itens: [] }; grupos.push(g); }
    g.total += d.desembarcados;
    g.itens.push(d);
  }
  grupos.sort((a, b) => b.total - a.total);
  const max = grupos[0].total;
  const linhas = [];
  for (const g of grupos) {
    const cor = corBandeira(g.itens[0].potencia);
    linhas.push([`<b>${g.nome}</b>`, `<b>${num(g.total)}</b>`,
      `<b>${pct(g.total, D.meta.totalDesembarcados)}</b>`, barra(g.total, max, cor)]);
    if (g.itens.length > 1) {
      for (const d of [...g.itens].sort((a, b) => b.desembarcados - a.desembarcados)) {
        linhas.push([`<span style="padding-left:18px;color:var(--tinta-2)">${d.nome.replace(/^[^—]+— /, '')}</span>`,
          num(d.desembarcados), pct(d.desembarcados, D.meta.totalDesembarcados),
          barra(d.desembarcados, max, cor)]);
      }
    }
  }
  tabela('tabela-destinos',
    [{ rotulo: 'Destino' }, { rotulo: 'Desembarcados', num: true }, { rotulo: '%', num: true }, { rotulo: '' }],
    linhas);
}
// períodos
{
  const max = Math.max(...D.periodos.map((p) => p.embarcados));
  tabela('tabela-periodos',
    [{ rotulo: 'Período' }, { rotulo: 'Embarcados', num: true }, { rotulo: '%', num: true }, { rotulo: '' }],
    D.periodos.map((p) => [
      p.rotulo, num(p.embarcados), pct(p.embarcados, D.meta.totalEmbarcados), barra(p.embarcados, max, '#6b573c'),
    ]));
}

// bandeiras
{
  const c = html('cartoes-bandeiras');
  for (const b of [...D.bandeiras].sort((x, y) => y.embarcados - x.embarcados)) {
    const d = document.createElement('div');
    d.className = 'cartao';
    d.innerHTML = `<h3><span class="selo" style="background:${b.cor}"></span>${b.nome}</h3>
      <div class="grande">${num(b.embarcados)}</div>
      <div class="miudo">pessoas embarcadas · ${pct(b.embarcados, D.meta.totalEmbarcados)} do tráfico atlântico · ${b.periodo}</div>
      <div class="barra" style="margin:12px 0"><i style="width:${((b.embarcados / D.bandeiras[0].embarcados) * 100).toFixed(1)}%;background:${b.cor}"></i></div>
      <div class="miudo">${b.nota}</div>
      <ul>${b.portos_armadores.map((p) => `<li>${p.nome}</li>`).join('')}</ul>`;
    c.appendChild(d);
  }
}
// regiões / povos
{
  const c = html('cartoes-regioes');
  for (const r of [...D.regioes].sort((x, y) => y.embarcados - x.embarcados)) {
    const d = document.createElement('div');
    d.className = 'cartao';
    d.innerHTML = `<h3><span class="selo" style="background:${corRegiao(r.id)}"></span>${r.nome}</h3>
      <div class="miudo" style="font-style:italic">na cartografia da época: ${r.nome_epoca}</div>
      <div class="grande">${num(r.embarcados)}</div>
      <div class="miudo">pessoas embarcadas · ${pct(r.embarcados, D.meta.totalEmbarcados)} do total</div>
      <div class="barra" style="margin:12px 0"><i style="width:${((r.embarcados / 5694600) * 100).toFixed(1)}%;background:${corRegiao(r.id)}"></i></div>
      <div class="miudo"><b>Povos:</b> ${r.povos.join(', ')}</div>
      <div class="miudo" style="margin-top:6px"><b>Estados:</b> ${r.polities}</div>
      <div class="miudo" style="margin-top:6px"><b>Portos:</b> ${[r.porto, ...(r.portos_secundarios || [])].map((p) => p.nome).join(' · ')}</div>`;
    c.appendChild(d);
  }
}
// cronologia
{
  const ul = html('cronologia');
  for (const m of D.marcos) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${m.ano}</b>${m.texto}`;
    ul.appendChild(li);
  }
}
// notas
{
  const conferencia = D.meta.erroColuna.map((e) =>
    `<tr><td>${DES[e.destino].nome}</td><td class="num">${num(e.ajustado)}</td><td class="num">${num(e.tstd)}</td><td class="num">${e.ajustado - e.tstd >= 0 ? '+' : ''}${num(e.ajustado - e.tstd)}</td></tr>`).join('');
  html('notas').innerHTML = `
    <div class="aviso">
      <b>De onde vêm os números.</b> Os totais por região de embarque, por destino, por bandeira e por
      período são os do <b>Trans-Atlantic Slave Trade Database</b> (SlaveVoyages.org — projeto de
      David Eltis, David Richardson e equipe; ferramenta <i>Estimates</i>, revisão 2018-2021), que
      reconstrói o tráfico a partir de cerca de 36 mil viagens documentadas e estima o não documentado.
      São <b>estimativas</b>, e o próprio banco as revisa.
    </div>
    <h3>Como a matriz de rotas foi montada</h3>
    <p>O TSTD publica com segurança as <i>marginais</i> — quantos saíram de cada região africana e
    quantos chegaram a cada região americana. A tabela cruzada completa (cada origem × cada destino)
    não é um dado direto. Aqui ela é <b>reconstruída</b> assim:</p>
    <ol>
      <li>parte-se de uma matriz-semente com a repartição documentada de cada região africana entre os
      destinos (corredores conhecidos da historiografia — ver <code>dados/matriz_sementes.json</code>);</li>
      <li>aplica-se o <b>ajuste proporcional iterativo</b> (IPF/RAS) até que as somas das linhas
      reproduzam os embarcados por região e as somas das colunas reproduzam os desembarcados por destino;</li>
      <li>o resultado é gravado em <code>dados/matriz_rotas.csv</code>, auditável linha a linha.</li>
    </ol>
    <p>Cada célula, portanto, é <b>ordem de grandeza fundamentada</b>, não um dado de arquivo.
    Os totais das margens, sim, são o dado publicado.</p>
    <h3>Conferência das colunas</h3>
    <div class="rolagem"><table><thead><tr><th>Destino</th><th class="num">Matriz ajustada</th>
      <th class="num">TSTD</th><th class="num">Δ</th></tr></thead><tbody>${conferencia}</tbody></table></div>
    <h3>Mortalidade</h3>
    <p>Aplicou-se a taxa média global de sobrevivência da travessia
    (${(D.meta.taxaSobrevivencia * 100).toFixed(1).replace('.', ',')}%, isto é,
    ${(100 - D.meta.taxaSobrevivencia * 100).toFixed(1).replace('.', ',')}% de mortos a bordo)
    uniformemente a todas as rotas. Na realidade a mortalidade variou muito — de menos de 10% na
    curta travessia Luanda–Rio a mais de 20% em viagens longas, em navios superlotados ou já no
    período clandestino do século XIX, quando os porões eram piores para escapar dos cruzadores.
    Os mortos <b>antes</b> do embarque — na captura, nas marchas até a costa e nos barracões — não
    entram em nenhuma destas contas e foram, segundo várias estimativas, tantos quanto os embarcados.</p>
    <h3>A base cartográfica</h3>
    <p>Litoral e ilhas: Natural Earth 1:50m (domínio público), projeção de <b>Mercator</b> — a projeção
    criada em 1569 justamente para navegar, na qual o rumo constante é uma reta. Os
    <b>domínios coloniais</b> nas Américas são aproximados por geometria moderna e correspondem
    grosso modo à situação de <b>c. 1750</b>: Brasil português; Índias de Castela; Treze Colônias
    britânicas (recorte do litoral leste norte-americano); Saint-Domingue (Haiti) francesa; Suriname
    e Curaçao neerlandeses; St. Croix e St. Thomas dinamarquesas. Martinica, Guadalupe e Guiana
    Francesa são pequenas demais para o traço nesta escala e aparecem apenas como portos.
    A África <b>não</b> aparece repartida entre potências europeias — isso só acontece depois de 1885,
    duas décadas <i>após</i> o fim do tráfico. O que se marca lá são os Estados africanos da época.</p>
    <h3>Leitura das curvas</h3>
    <p>As rotas curvam-se em direção ao Equador porque a navegação à vela dependia dos alísios e das
    correntes equatoriais: um navio de Liverpool não cruzava o Atlântico em linha reta, descia até a
    costa africana, atravessava com o alísio de nordeste e voltava pelo norte com os ventos de oeste
    e a Corrente do Golfo. As curvas do mapa são esquemáticas, mas a lógica é a real.</p>
    <h3>Bibliografia</h3>
    <ul>
      <li>ELTIS, David; RICHARDSON, David. <i>Atlas of the Transatlantic Slave Trade</i>. Yale University Press, 2010.</li>
      <li><i>Trans-Atlantic Slave Trade Database</i> — SlaveVoyages.org (Emory University / Rice University).</li>
      <li>ALENCASTRO, Luiz Felipe de. <i>O Trato dos Viventes: formação do Brasil no Atlântico Sul</i>. Companhia das Letras, 2000.</li>
      <li>KLEIN, Herbert S. <i>The Atlantic Slave Trade</i>. 2ª ed. Cambridge University Press, 2010.</li>
      <li>FLORENTINO, Manolo. <i>Em Costas Negras</i>. Companhia das Letras, 1997.</li>
      <li>THORNTON, John. <i>Africa and Africans in the Making of the Atlantic World, 1400-1800</i>. Cambridge, 1998.</li>
    </ul>
    <p style="margin-top:22px;font-style:italic">Cada linha desta carta é uma contagem de pessoas
    sequestradas, e cada número redondo esconde nomes que não foram registrados.</p>`;
}

render();

// A medição dos rótulos depende da fonte já carregada.
const ajustar = () => { prontoParaMedir = true; descongestionar(); aplicarCamadas(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);
else window.addEventListener('load', ajustar);
setTimeout(ajustar, 1200);
})();
