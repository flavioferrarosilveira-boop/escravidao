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
  dimensao: 'regiao',
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

// Grupos de destino — o "país" para quem filtra (Brasil, Cuba e Terra Firme
// somam-se em Hispano-América, os quatro portos brasileiros somam-se em Brasil).
const CORES_DESTINO = {
  brasil: '#1f6f4a', caribe_britanico: '#8c2f2f', caribe_frances: '#2f4f8c',
  hispano_america: '#b8860b', caribe_holandes: '#c05a1f', america_norte: '#6b4fa0',
  caribe_danes: '#4a7f9e', europa_africa: '#6b573c',
};
const GRUPOS = [];
for (const d of D.destinos) {
  let g = GRUPOS.find((x) => x.id === d.grupo);
  if (!g) { g = { id: d.grupo, nome: d.grupo_nome, desembarcados: 0, itens: [] }; GRUPOS.push(g); }
  g.desembarcados += d.desembarcados;
  g.itens.push(d);
}
GRUPOS.sort((a, b) => b.desembarcados - a.desembarcados);
const grupoDe = (idDestino) => DES[idDestino].grupo;
const corDestino = (grupo) => CORES_DESTINO[grupo] || '#6b573c';
const GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g]));

const chaveRota = (r) => (estado.dimensao === 'regiao' ? r.origem
  : estado.dimensao === 'destino' ? grupoDe(r.destino) : r.potencia);
const corRota = (r) => (estado.dimensao === 'regiao' ? corRegiao(r.origem)
  : estado.dimensao === 'destino' ? corDestino(grupoDe(r.destino)) : corBandeira(r.potencia));

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
// Dois sistemas de vento e corrente comandavam o tráfico (Gomes, vol. I, p. 208):
// o giro horário ao norte do Equador, dos europeus, e o anti-horário ao sul,
// dos brasileiros e portugueses — que dispensava a Europa.
const VENTOS = [
  { nome: 'Alísios de NE  ·  giro horário, dos europeus', pts: [[-19, 24], [-38, 19], [-58, 13]] },
  { nome: 'Alísios de SE  ·  giro anti-horário, dos brasileiros', pts: [[4, -19], [-16, -10], [-33, -3]] },
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
el('rect', { x: 0, y: 0, width: LARG, height: ALT, fill: '#8d7147', filter: 'url(#papel)', opacity: '.14', class: 'textura' }, gMar);

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
  if (porto.embarcados) {
    const alvo = el('circle', { cx: x, cy: y, r: tamanho + 9, fill: 'transparent',
      style: 'cursor:pointer' }, g);
    const conteudo = `<h4>${porto.nome}</h4>
      <dl><dt>Cativos embarcados</dt><dd>${num(porto.embarcados)}</dd></dl>
      <div class="nota">${porto.nota || ''}</div>`;
    alvo.addEventListener('pointermove', (e) => mostrarDica(e, conteudo));
    alvo.addEventListener('pointerleave', () => esconderDica());
  }
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
  for (const r of D.rotas) {
    if (!r.tracada) continue;
    const a = arco(r.de, r.para);
    const cor = corRota(r);
    const ativo = sel.size === 0 || sel.has(chaveRota(r));
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
    if (!r.tracada) continue;
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
  for (const [id, rot] of [['regiao', 'Região africana'], ['destino', 'País de destino'],
                           ['bandeira', 'Bandeira do navio']]) {
    fc.appendChild(ficha(rot, estado.dimensao === id, null,
      () => { estado.dimensao = id; estado.selecao.clear(); render(); }));
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
  } else if (estado.dimensao === 'regiao') {
    rf.textContent = 'Regiões de embarque';
    ff.appendChild(ficha('Todas', estado.selecao.size === 0, null, () => { estado.selecao.clear(); render(); }, true));
    for (const r of D.regioes) {
      ff.appendChild(ficha(r.nome, estado.selecao.has(r.id), corRegiao(r.id), () => alternar(r.id), true));
    }
  } else if (estado.dimensao === 'destino') {
    rf.textContent = 'País de destino';
    ff.appendChild(ficha('Todos', estado.selecao.size === 0, null, () => { estado.selecao.clear(); render(); }, true));
    for (const g of GRUPOS) {
      ff.appendChild(ficha(g.nome, estado.selecao.has(g.id), corDestino(g.id), () => alternar(g.id), true));
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
    const fonte = estado.dimensao === 'regiao' ? D.regioes.map((r) => [r.nome, corRegiao(r.id)])
      : estado.dimensao === 'destino' ? GRUPOS.map((g) => [g.nome, corDestino(g.id)])
      : D.bandeiras.map((b) => [b.nome, b.cor]);
    for (const [nome, cor] of fonte) {
      item(`<span style="width:13px;height:13px;border-radius:2px;background:${cor};display:inline-block"></span> ${nome}`);
    }
  }
}

// ------------------------------------------------------------------- render
// ------------------------------------------------- resumo da seleção
// Responde à pergunta direta: escolhi o Brasil — quantas pessoas, vindas de onde?
const barra = (v, max, cor) =>
  `<div class="barra"><i style="width:${((v / max) * 100).toFixed(1)}%;background:${cor}"></i></div>`;

function montarResumo() {
  const caixa = html('resumo');
  const sel = estado.selecao;
  if (estado.modo !== 'rotas' || sel.size === 0) { caixa.hidden = true; caixa.innerHTML = ''; return; }
  caixa.hidden = false;

  const rotas = D.rotas.filter((r) => sel.has(chaveRota(r)));
  const nomes = [...sel].map((id) => estado.dimensao === 'regiao' ? REG[id].nome
    : estado.dimensao === 'destino' ? GRUPO[id].nome : BAN[id].nome);

  let cifra, unidade, corTema, tituloLista, itens;

  if (estado.dimensao === 'destino') {
    cifra = [...sel].reduce((t, id) => t + GRUPO[id].desembarcados, 0);
    unidade = 'pessoas desembarcadas';
    corTema = corDestino([...sel][0]);
    tituloLista = 'De onde vieram';
    const porOrigem = new Map();
    for (const r of rotas) porOrigem.set(r.origem, (porOrigem.get(r.origem) || 0) + r.desembarcados);
    itens = [...porOrigem].map(([id, v]) => ({ nome: REG[id].nome, cor: corRegiao(id), valor: v }));
  } else if (estado.dimensao === 'regiao') {
    cifra = [...sel].reduce((t, id) => t + REG[id].embarcados, 0);
    unidade = 'pessoas embarcadas';
    corTema = corRegiao([...sel][0]);
    tituloLista = 'Para onde foram';
    const porDestino = new Map();
    for (const r of rotas) {
      const g = grupoDe(r.destino);
      porDestino.set(g, (porDestino.get(g) || 0) + r.embarcados);
    }
    itens = [...porDestino].map(([id, v]) => ({ nome: GRUPO[id].nome, cor: corDestino(id), valor: v }));
  } else {
    cifra = [...sel].reduce((t, id) => t + BAN[id].embarcados, 0);
    unidade = 'pessoas embarcadas por essa bandeira';
    corTema = corBandeira([...sel][0]);
    tituloLista = 'Colônias sob essa bandeira';
    const porDestino = new Map();
    for (const r of rotas) {
      const g = grupoDe(r.destino);
      porDestino.set(g, (porDestino.get(g) || 0) + r.desembarcados);
    }
    itens = [...porDestino].map(([id, v]) => ({ nome: GRUPO[id].nome, cor: corDestino(id), valor: v }));
  }

  itens.sort((a, b) => b.valor - a.valor);
  const maxItem = itens.length ? itens[0].valor : 1;
  const somaItens = itens.reduce((t, i) => t + i.valor, 0) || 1;

  const mortos = num(rotas.reduce((t, r) => t + (r.embarcados - r.desembarcados), 0));
  const rodape = estado.dimensao === 'destino'
    ? `${num(rotas.reduce((t, r) => t + r.embarcados, 0))} embarcados na África · ${mortos} mortos na travessia`
    : estado.dimensao === 'regiao'
      ? `${num(rotas.reduce((t, r) => t + r.desembarcados, 0))} chegaram vivos · ${mortos} mortos na travessia`
      : `${pct(cifra, D.meta.totalEmbarcados)} de todo o tráfico atlântico`;

  caixa.innerHTML = `
    <div>
      <h4>${nomes.join(' + ')}</h4>
      <div class="cifra" style="color:${corTema}">${num(cifra)}</div>
      <div class="miudo">${unidade}</div>
      <div class="miudo" style="margin-top:8px">${rodape}</div>
    </div>
    <div>
      <div class="miudo" style="margin-bottom:8px"><b>${tituloLista}</b></div>
      <ol>${itens.map((i) => `<li>
        <span><span style="color:${i.cor}">■</span> ${i.nome}</span>
        <b>${num(i.valor)}</b>
        ${barra(i.valor, maxItem, i.cor)}
      </li>`).join('')}</ol>
      <div class="miudo" style="margin-top:9px">
        Repartição pela matriz reconstruída (ver apêndice); soma ${num(somaItens)}.
      </div>
    </div>`;
}

let prontoParaMedir = false;
function render() {
  if (prontoParaMedir) descongestionar();
  aplicarCamadas();
  if (estado.modo === 'rotas') desenharRotas();
  else if (estado.modo === 'circuitos') desenharCircuitos();
  else desenharSeculo();
  montarControles();
  montarLegenda();
  montarResumo();
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
    nota.innerHTML = `Traçadas ${D.rotas.filter((r) => r.tracada).length} rotas com mais de ${num(D.meta.limiarRota)} pessoas embarcadas — os fluxos menores entram nas contas, mas não no traço.
      Quase todo porto africano mandou gente para quase todo porto americano, mas isso não cabe
      numa carta legível.`;
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
// rotas
{
  const max = D.rotas[0].embarcados;
  tabela('tabela-rotas',
    [{ rotulo: 'Região de embarque' }, { rotulo: 'Destino' }, { rotulo: 'Embarcados', num: true },
     { rotulo: 'Desembarcados', num: true }, { rotulo: 'Mortos', num: true }, { rotulo: '% do total', num: true }, { rotulo: '' }],
    D.rotas.filter((r) => r.tracada).map((r) => [
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
      <div class="miudo" style="margin-top:6px"><b>Portos:</b> ${[r.porto, ...(r.portos_secundarios || [])].map((p) => p.nome).join(' · ')}</div>
      ${r.vocabulario ? `<div class="miudo" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(141,113,71,.3)">${r.vocabulario}</div>` : ''}`;
    c.appendChild(d);
  }
}
// cronologia
{
  const ul = html('cronologia');
  for (const m of D.marcos) {
    const li = document.createElement('li');
    const cite = m.fonte ? ` <span class="cite">${m.fonte}, p. ${m.pagina}</span>` : '';
    li.innerHTML = `<b>${m.ano}</b>${m.texto}${cite}`;
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
    <h3>O cotejo com o livro</h3>
    <p>${D.cotejoNota} Verde = mudou por causa do livro; vermelho = onde não segui o livro.</p>
    <div class="rolagem"><table class="cotejo"><thead><tr>
      <th>O quê</th><th>A carta antes</th><th>O que o livro traz</th><th class="num">vol.</th><th class="num">p.</th><th>Como ficou</th>
    </tr></thead><tbody>${D.cotejo.map((c) => `<tr class="est-${c.estado}">
      <td><b>${c.item}</b>${c.obs ? `<div class="miudo" style="font-size:13.5px">${c.obs}</div>` : ''}</td>
      <td class="num">${c.antes}</td><td class="num">${c.livro}</td>
      <td class="num">${c.volume || 'I'}</td>
      <td class="num">${c.pagina}</td><td class="num"><b>${c.agora}</b></td>
    </tr>`).join('')}</tbody></table></div>

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
    <h3>O que a segunda leitura acrescentou</h3>
    <p>Numa primeira etapa foram lidos onze capítulos do volume I. Depois, os
    <b>dezenove restantes</b> — 1 a 8, 10 a 13, 21, 22, 24 a 26, 29 e 30 —, que deram origem à aba
    <b>As Origens</b>, à <b>Carta V</b>, à <b>Figura III</b> e a quinze quadros novos espalhados
    pelas outras abas. Os autores abaixo entram na carta por essa leitura. Todos são citados por
    Gomes no corpo do texto e constam das notas e da bibliografia do volume I;
    <b>nenhum foi consultado diretamente</b> — o que a carta atribui a eles, atribui através dele.</p>
    <div class="rolagem"><table><thead><tr><th>Autor</th><th>Obra</th><th>Onde entra nesta carta</th></tr></thead>
    <tbody>${D.origens.bibliografia.itens.map((b) => `<tr><td><b>${b.autor}</b></td>
      <td><i>${b.obra}</i></td><td>${b.uso}</td></tr>`).join('')}</tbody></table></div>

    <h3>O que a terceira leitura acrescentou — o volume II</h3>
    <p>Depois vieram os <b>trinta e um capítulos do volume II</b> — <i>Da corrida do ouro em Minas
    Gerais até a chegada da corte de dom João ao Brasil</i>, páginas 31 a 373 —, lidos por inteiro.
    Deles nasceu a aba <b>O Ouro</b>, com a <b>Carta VI</b> (as três estradas, as monções, a rota
    amazônica e a cerca do Distrito Diamantino), a <b>Figura IV</b> (o preço de uma pessoa em ouro,
    em 1703), a <b>Figura V</b> (a alforria brasileira contra a norte-americana) e oito quadros;
    quatro quadros novos na aba <b>As Origens</b>, sobre a Costa da Mina, Agaja e o Daomé, as
    embaixadas africanas ao Brasil e João de Oliveira; e, na aba <b>O Navio</b>, a
    <b>Figura VI</b> — as medidas do <i>Brookes</i> em escala —, o caso do <i>Zong</i>, o naufrágio
    do <i>São José Paquete d’África</i> e a campanha abolicionista. Nove linhas novas entraram no
    cotejo, entre elas <b>três em que não segui o livro</b>: o erro de unidade da pólvora inglesa
    (toneladas onde a conta do próprio autor dá quilos), o anacronismo de Bougainville no Rio de
    1697 e o preço de um cativo em oitenta cauris, incompatível com a tabela de preços da mesma
    página.</p>

    <h3>Fontes externas ao livro</h3>
    <p>Duas coisas que a carta mostra estão fora do volume I de Gomes, que termina em 1695:
    o censo de 1872 (Carta III) e o tráfico por dentro do Brasil (Carta IV). Procurei nas 457
    páginas do volume I os termos <i>tráfico interno</i>, <i>interprovincial</i>, <i>revenda</i>,
    <i>cabotagem</i>, <i>sampauleiro</i>, <i>Caminho Novo</i> e <i>Minas Gerais</i>: nenhuma
    ocorrência. O <b>volume II resolveu parte disso</b>: dele vêm agora as três estradas das Minas,
    as monções, a rota amazônica e a proporção que faltava — “quase a metade” dos que chegavam ao
    Rio seguia imediatamente para as regiões mineradoras. O período do café, esse sim, continua
    fora dos dois volumes lidos: é matéria do volume III. O que a Carta IV traz sobre ele vem,
    portanto, da bibliografia acadêmica brasileira, com cada número preso ao autor que o calculou:</p>
    <ul>${D.interno.fontes.map((f) => `<li>${f.autor !== '—' ? `${f.autor}. ` : ''}` +
      `<i>${f.obra}</i>. ${f.onde}.${f.url ? ` <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>` : ''}</li>`).join('')}</ul>
    <p style="font-size:14.5px">Os três conjuntos de números do tráfico interno — as remessas do
    porto do Rio (1809-1833), as transferências entre províncias (1850-1881) e a série fiscal
    cearense — vêm de métodos diferentes sobre recortes que se sobrepõem, e <b>não se somam</b>.
    A Carta IV declara isso na própria página.</p>

    <h3>Bibliografia</h3>
    <ul>
      <li>GOMES, Laurentino. <i>Escravidão — Volume I: Do primeiro leilão de cativos em Portugal
        até a morte de Zumbi dos Palmares</i>. Revisão e anotações de Alberto da Costa e Silva.
        Rio de Janeiro: Globo Livros, 2019.</li>
      <li>GOMES, Laurentino. <i>Escravidão — Volume II: Da corrida do ouro em Minas Gerais até a
        chegada da corte de dom João ao Brasil</i>. Rio de Janeiro: Globo Livros. Lido por inteiro;
        é a fonte de toda a aba <b>O Ouro</b>, dos quadros da Costa da Mina e da Figura VI.</li>
      <li>ELTIS, David; RICHARDSON, David. <i>Atlas of the Transatlantic Slave Trade</i>. Yale University Press, 2010.</li>
      <li><i>Trans-Atlantic Slave Trade Database</i> — SlaveVoyages.org (Emory University / Rice University).</li>
      <li>ALENCASTRO, Luiz Felipe de. <i>O Trato dos Viventes: formação do Brasil no Atlântico Sul</i>. Companhia das Letras, 2000.</li>
      <li>KLEIN, Herbert S. <i>The Atlantic Slave Trade</i>. 2ª ed. Cambridge University Press, 2010.</li>
      <li>FLORENTINO, Manolo. <i>Em Costas Negras</i>. Companhia das Letras, 1997.</li>
      <li>THORNTON, John. <i>Africa and Africans in the Making of the Atlantic World, 1400-1800</i>. Cambridge, 1998.</li>
      <li>BOXER, C. R. <i>Salvador de Sá and the Struggle for Brazil and Angola, 1602-1686</i>. Londres: Athlone Press, 1952.</li>
      <li>ANTONIL, André João. <i>Cultura e opulência no Brasil por suas drogas e minas</i> [1711]. Brasília: Senado Federal, 2011.</li>
      <li>ZURARA, Gomes Eanes de. <i>Crónica do descobrimento e da conquista da Guiné</i> [1453]. Lisboa: Europa-América, 1989.</li>
      <li>REDIKER, Marcus. <i>The Slave Ship: a Human History</i>. Nova York: Viking, 2007.</li>
      <li>BRASIL. Diretoria Geral de Estatística. <i>Recenseamento Geral do Império do Brasil de 1872</i>.
        Rio de Janeiro, 1873-1876. Original na Biblioteca do IBGE; digitalização com correção de erros
        aritméticos pelo Cedeplar/UFMG.</li>
    </ul>
    <p style="font-size:14.5px">As quatro últimas entram por indicação da bibliografia do volume I
    de Gomes (p. 440-451), que reúne as fontes usadas por ele.</p>
    <p style="margin-top:22px;font-style:italic">Cada linha desta carta é uma contagem de pessoas
    sequestradas, e cada número redondo esconde nomes que não foram registrados.</p>`;
}

render();

// =====================================================================
//  ABA "A ESCRAVIDÃO"
// =====================================================================

// --- link do PDF: relativo no site, absoluto em qualquer outro hospedeiro
{
  const a = html('link-pdf');
  if (a && !/github\.io$/.test(location.hostname)) {
    a.href = 'https://flavioferrarosilveira-boop.github.io/escravidao/carta-do-trafico-atlantico.pdf';
  }
}

// --- carta II: populações escravizadas
let popMontada = false;
function montarMapaPopulacoes() {
  if (popMontada) return;
  popMontada = true;
  const svgP = html('mapa-pop');
  // Mesmo plano projetado da carta I, recortado nas Américas.
  const [x0] = proj(-100, 0), [x1] = proj(-25, 0);
  const [, y0] = proj(0, 46), [, y1] = proj(0, -34);
  svgP.setAttribute('viewBox', `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}`);
  svgP.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const gp = (pai) => el('g', null, pai);
  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'var(--mar)' }, svgP);
  const gTerraP = el('g', { class: 'terra' }, svgP);
  for (const anel of D.geo.litoral) el('path', { d: caminho(anel) }, gTerraP);
  const gDomP = el('g', null, svgP);
  for (const [potencia, aneis] of Object.entries(D.geo.dominios)) {
    const g = el('g', { class: 'dominio', fill: corBandeira(potencia), opacity: .3 }, gDomP);
    for (const anel of aneis) el('path', { d: caminho(anel) }, g);
  }
  const gBolhas = gp(svgP), gRotulosP = gp(svgP);

  const maxPop = Math.max(...D.populacoes.filter((x) => !x.apenas_tabela).map((x) => x.pessoas));
  const raio = (v) => Math.max(5, Math.sqrt(v / maxPop) * 62);
  const dicaP = html('dica-pop'), palcoP = html('palco-pop');
  palcoP.addEventListener('pointerleave', () => dicaP.classList.remove('visivel'));

  const rotulos = [];
  for (const pop of D.populacoes.filter((x) => !x.apenas_tabela).sort((a, b) => b.pessoas - a.pessoas)) {
    const [x, y] = proj(pop.lon, pop.lat);
    const r = raio(pop.pessoas);
    const cor = corBandeira(pop.potencia);
    const c = el('circle', { cx: x, cy: y, r, fill: cor, 'fill-opacity': .55, class: 'bolha' }, gBolhas);
    const conteudo = `<h4>${pop.lugar} — ${pop.ano}</h4>
      <dl><dt>Pessoas escravizadas</dt><dd>${num(pop.pessoas)}</dd></dl>
      <div class="nota">Contagem de ${pop.tipo}. ${pop.nota}</div>`;
    c.addEventListener('pointermove', (e) => {
      dicaP.innerHTML = conteudo;
      dicaP.classList.add('visivel');
      const cx = palcoP.getBoundingClientRect();
      let px = e.clientX - cx.left + 16, py = e.clientY - cx.top + 16;
      if (px + dicaP.offsetWidth > cx.width - 8) px = e.clientX - cx.left - dicaP.offsetWidth - 16;
      if (py + dicaP.offsetHeight > cx.height - 8) py = Math.max(8, e.clientY - cx.top - dicaP.offsetHeight - 16);
      dicaP.style.left = px + 'px'; dicaP.style.top = py + 'px';
    });
    c.addEventListener('pointerleave', () => dicaP.classList.remove('visivel'));

    const t = el('text', { class: 'rotulo porto', 'font-size': 15, 'data-ax': x, 'data-ay': y, 'data-r': r }, gRotulosP);
    const l1 = el('tspan', { x, dy: 0 }, t); l1.textContent = pop.lugar;
    const l2 = el('tspan', { x, dy: 17, 'font-size': 13.5, fill: 'var(--tinta-2)' }, t);
    l2.textContent = `${num(pop.pessoas)} · ${pop.ano}`;
    rotulos.push({ t, l1, l2, x, y, r, cor });
  }

  // Descongestionamento: quatro posições, senão vira chamada com linha-guia.
  const ocupados = [];
  const colide = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const medir = (t) => { const b = t.getBBox(); return { x: b.x - 5, y: b.y - 3, w: b.width + 10, h: b.height + 6 }; };
  let escadaY = y0 + 250;
  for (const it of rotulos) {
    const opcoes = [
      [it.x + it.r + 8, it.y - 4, 'start'], [it.x - it.r - 8, it.y - 4, 'end'],
      [it.x, it.y - it.r - 20, 'middle'], [it.x, it.y + it.r + 18, 'middle'],
    ];
    let posto = false;
    for (const [px, py, anc] of opcoes) {
      it.t.setAttribute('text-anchor', anc);
      it.t.setAttribute('y', py);
      it.l1.setAttribute('x', px); it.l2.setAttribute('x', px);
      const cx = medir(it.t);
      if (!ocupados.some((o) => colide(cx, o))) { ocupados.push(cx); posto = true; break; }
    }
    if (!posto) {           // chamada à direita, empilhada, com linha-guia
      const px = x1 - 150, py = escadaY;
      escadaY += 44;
      it.t.setAttribute('text-anchor', 'start');
      it.t.setAttribute('y', py);
      it.l1.setAttribute('x', px); it.l2.setAttribute('x', px);
      ocupados.push(medir(it.t));
      el('line', { x1: it.x + it.r, y1: it.y, x2: px - 6, y2: py - 4, stroke: it.cor,
        'stroke-width': .9, 'stroke-dasharray': '3 4', opacity: .7 }, gRotulosP);
    }
  }

  // Legenda de escala das bolhas
  {
    const g = el('g', null, svgP);
    const bx = x0 + 70, by = y1 - 46;
    const rMaior = raio(4000000);
    for (const v of [4000000, 1000000, 100000]) {
      const r = raio(v);
      el('circle', { cx: bx, cy: by - r, r, fill: 'none', stroke: '#5d4a30', 'stroke-width': .9, opacity: .7 }, g);
      const rotulo = v === 1e6 ? '1 milhão' : v > 1e6 ? v / 1e6 + ' milhões' : num(v);
      texto(rotulo, { x: bx + rMaior + 12, y: by - 2 * r + 5, class: 'rotulo', 'font-size': 12 }, g);
      el('line', { x1: bx, y1: by - 2 * r, x2: bx + rMaior + 8, y2: by - 2 * r,
        stroke: '#5d4a30', 'stroke-width': .5, opacity: .45 }, g);
    }
    texto('pessoas escravizadas', { x: bx - rMaior, y: by + 22, class: 'rotulo',
      'font-size': 12.5, 'font-style': 'italic' }, g);
  }
}

// --- quadros da aba
{
  const maxP = Math.max(...D.populacoes.map((x) => x.pessoas));
  tabela('tabela-populacoes',
    [{ rotulo: 'Lugar' }, { rotulo: 'Ano', num: true }, { rotulo: 'Fonte da contagem' },
     { rotulo: 'Pessoas escravizadas', num: true }, { rotulo: '' }],
    [...D.populacoes].sort((a, b) => b.pessoas - a.pessoas).map((x) => [
      `<span style="color:${corBandeira(x.potencia)}">■</span> ${x.lugar}`, x.ano, x.tipo,
      num(x.pessoas), barra(x.pessoas, maxP, corBandeira(x.potencia)),
    ]));

  const cartao = (destino, itens) => {
    const c = html(destino);
    c.innerHTML = itens.join('');
  };
  cartao('cartoes-demografia', D.demografia.map((d) => `<div class="cartao">
    <h3>${d.rotulo}</h3><div class="grande">${d.valor}</div>
    <div class="miudo" style="margin-top:8px">${d.detalhe}</div></div>`));
  cartao('cartoes-trabalho', D.trabalho.map((t) => `<div class="cartao">
    <h3>${t.titulo}</h3><div class="miudo" style="font-style:italic">${t.lugar}</div>
    <div class="miudo" style="margin-top:10px">${t.texto}</div></div>`));
  cartao('cartoes-resistencia', D.resistencia.map((r) => `<div class="cartao">
    <div class="miudo" style="font-family:var(--fonte-mapa);letter-spacing:.14em;text-transform:uppercase">${r.ano}</div>
    <h3 style="margin-top:4px">${r.titulo}</h3>
    <div class="miudo" style="font-style:italic">${r.lugar}</div>
    <div class="miudo" style="margin-top:10px">${r.texto}</div></div>`));
  cartao('cartoes-depois', D.depois.map((d) => `<div class="cartao">
    <h3>${d.titulo}</h3><div class="miudo" style="margin-top:10px">${d.texto}</div></div>`));

  html('cronologia-abolicao').innerHTML = D.abolicoes
    .map((a) => `<li><b>${a.ano}</b><b style="font-family:var(--fonte-texto);font-size:inherit">${a.lugar}</b> — ${a.texto}</li>`)
    .join('');
}


// --- Quadro IV: os portos que armavam as viagens (Gomes, vol. I, p. 217)
{
  const max = Math.max(...D.armadores.map((x) => x.pessoas));
  tabela('tabela-armadores',
    [{ rotulo: 'Porto' }, { rotulo: 'Onde' }, { rotulo: 'Cativos transportados', num: true }, { rotulo: '' }, { rotulo: '' }],
    D.armadores.map((a) => [
      `<span style="color:${corBandeira(a.potencia)}">■</span> <b>${a.nome}</b>`,
      a.pais, num(a.pessoas), barra(a.pessoas, max, corBandeira(a.potencia)),
      `<span class="miudo" style="font-size:14px">${a.nota}</span>`,
    ]));
  const legenda = document.createElement('p');
  legenda.className = 'miudo';
  legenda.style.marginTop = '10px';
  legenda.innerHTML = D.armadoresNota +
    ' <span class="cite">Gomes I, p. 203, 205 e 217</span>';
  html('secao-armadores').appendChild(legenda);
}

// --- Quadro V: os quatro ciclos do tráfico brasileiro (Gomes, vol. I, p. 202)
{
  const c = html('cartoes-ciclos');
  c.innerHTML = D.ciclos.map((ci) => {
    const cores = ci.regioes.map((r) => corRegiao(r));
    return `<div class="cartao ciclo" data-regioes="${ci.regioes.join(',')}">
      <div class="quando">${ci.quando}</div>
      <h3 style="margin-top:4px">${ci.nome}</h3>
      <div style="display:flex;gap:5px;margin:10px 0">
        ${cores.map((k) => `<span style="height:6px;flex:1;background:${k};border-radius:1px"></span>`).join('')}
      </div>
      <div class="miudo">${ci.texto}</div>
      <div class="miudo" style="margin-top:8px">
        ${ci.regioes.map((r) => REG[r].nome).join(' · ')}
      </div>
    </div>`;
  }).join('');
  // Passar o cursor num ciclo acende as regiões dele na carta principal.
  for (const cartao of c.querySelectorAll('.ciclo')) {
    const regioes = cartao.dataset.regioes.split(',');
    cartao.addEventListener('pointerenter', () => {
      if (estado.modo !== 'rotas' || estado.dimensao !== 'regiao') return;
      for (const g of gRotas.children) g.classList.add('apagado');
      [...gRotas.children].forEach((g, i) => {
        const r = D.rotas.filter((x) => x.tracada)[i];
        if (r && regioes.includes(r.origem)) g.classList.remove('apagado');
      });
    });
    cartao.addEventListener('pointerleave', () => { if (estado.modo === 'rotas') desenharRotas(); });
  }
}


// =====================================================================
//  ABA "O NEGÓCIO"  —  como o tráfico funcionava por dentro
//  Fonte: GOMES, Laurentino. Escravidão, vol. I, caps. 14 a 16.
// =====================================================================
{
  const N = D.negocio;
  const cite = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;
  const encher = (id, itens) => { html(id).innerHTML = itens.join(''); };

  html('epigrafe').innerHTML =
    `<p>“${N.epigrafe.texto}”</p><footer>${N.epigrafe.autor} ${cite(N.epigrafe.pagina)}</footer>`;

  encher('cartoes-moeda', N.moeda.map((m) => `<div class="cartao">
    <h3>${m.titulo}</h3><div class="grande">${m.cifra}</div>
    <div class="miudo" style="margin-top:8px">${m.texto} ${cite(m.pagina)}</div></div>`));

  tabela('tabela-troca', [{ rotulo: 'Onde' }, { rotulo: 'O que ia no porão de ida' }, { rotulo: '' }],
    N.troca.map((t) => [`<b>${t.regiao}</b>`, t.itens, cite(t.pagina)]));

  encher('cartoes-interior', N.interior.map((i) => `<div class="cartao">
    <h3>${i.termo}</h3>
    <div class="miudo" style="margin-top:10px">${i.texto} ${cite(i.pagina)}</div></div>`));

  encher('cartoes-lucros', N.lucros.map((l) => `<div class="cartao">
    <div class="quando" style="font-family:var(--fonte-mapa);letter-spacing:.14em;
      text-transform:uppercase;font-size:12.5px;color:var(--tinta-3)">${l.quando}</div>
    <h3 style="margin-top:4px">${l.onde}</h3>
    <div class="grande">${l.taxa}</div>
    <div class="miudo" style="margin-top:8px">${l.texto} ${cite(l.pagina)}</div></div>`));

  encher('cartoes-viagens', N.viagens.map((v) => `<div class="cartao">
    <h3>${v.navio} <span class="miudo" style="font-family:var(--fonte-texto)">· ${v.ano}</span></h3>
    <div class="grande" style="color:${v.bom ? 'var(--realce)' : 'var(--sangue)'};font-size:24px">${v.resultado}</div>
    <div class="miudo" style="margin-top:8px">${v.texto} ${cite(v.pagina)}</div></div>`));

  encher('cartoes-mortalidade', N.mortalidade.map((m) => `<div class="cartao">
    <h3>${m.rotulo}</h3><div class="grande" style="color:var(--sangue)">${m.valor}</div>
    <div class="miudo" style="margin-top:8px">${m.detalhe} ${cite(m.pagina)}</div></div>`));

  encher('cartoes-luanda', N.luanda.map((l) => `<div class="cartao">
    <h3>${l.rotulo}</h3><div class="grande">${l.valor}</div>
    <div class="miudo" style="margin-top:8px">${l.detalhe} ${cite(l.pagina)}</div></div>`));

  html('cronologia-companhias').innerHTML = N.companhias.map((c) => `<li>
    <b>${c.ano}</b><b style="font-family:var(--fonte-texto);font-size:inherit">${c.nome}</b>
    <span class="miudo">· ${c.pais}</span>
    ${c.texto ? `<div class="miudo" style="margin-top:5px">${c.texto}</div>` : ''}
    <div style="margin-top:4px">${cite(c.pagina)}</div></li>`).join('');
}

// --- Quadro VII: a África antes do tráfico, e a origem dos topônimos
{
  const A = D.africa;
  const cite = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;
  html('epigrafe-africa').innerHTML =
    `<p>“${A.epigrafe.texto}”</p><footer>${A.epigrafe.autor} ${cite(A.epigrafe.pagina)}</footer>`;
  html('cartoes-africa').innerHTML = A.cartas.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="grande" style="font-size:23px">${c.cifra}</div>
    <div class="miudo" style="margin-top:8px">${c.texto} ${cite(c.pagina)}</div></div>`).join('');
  html('nota-toponimos').textContent = A.toponimos._nota;
  tabela('tabela-toponimos', [{ rotulo: 'Nome' }, { rotulo: 'De onde veio' }],
    A.toponimos.lista.map((t) => [`<b>${t.nome}</b>`, t.texto]));
}

// --- Quadro XX: a guerra luso-holandesa pelo fornecimento de cativos
{
  const G = D.africa.guerra;
  const cite = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;
  html('epigrafe-guerra').innerHTML =
    `<p>“${G.epigrafe.texto}”</p><footer>${G.epigrafe.autor} ${cite(G.epigrafe.pagina)}</footer>`;
  html('nota-guerra').textContent = G._nota;
  html('cronologia-guerra').innerHTML = G.marcos.map((m) => `<li>
    <b>${m.ano}</b><b style="font-family:var(--fonte-texto);font-size:inherit">${m.titulo}</b>
    <div class="miudo" style="margin-top:5px">${m.texto} ${cite(m.pagina)}</div></li>`).join('');
}

// --- A chegada e os instrumentos de castigo
{
  const cite = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;
  html('cartoes-chegada').innerHTML = D.chegada.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3>
    <div class="miudo" style="margin-top:10px">${c.texto} ${cite(c.pagina)}</div></div>`).join('');
  html('nota-castigos').innerHTML = D.castigos._fonte;
  html('cartoes-castigos').innerHTML = D.castigos.categorias.map((c) => `<div class="cartao">
    <h3>${c.nome}</h3>
    <div class="miudo" style="margin-top:10px">${c.itens}</div></div>`).join('');
}


// --- Carta III: o Brasil escravista
let brMontado = false;
function montarMapaBrasil() {
  if (brMontado) return;
  brMontado = true;
  const B = D.brasil;
  const svgB = html('mapa-br');
  const [x0] = proj(-76, 0), [x1] = proj(-24, 0);
  const [, y0] = proj(0, 8), [, y1] = proj(0, -35);
  svgB.setAttribute('viewBox', `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}`);
  svgB.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'var(--mar)' }, svgB);
  const gT = el('g', { class: 'terra' }, svgB);
  for (const anel of D.geo.litoral) el('path', { d: caminho(anel) }, gT);
  const gD = el('g', { class: 'dominio', fill: corBandeira('portugal'), opacity: .34 }, svgB);
  for (const anel of D.geo.dominios.portugal) el('path', { d: caminho(anel) }, gD);
  const gB = el('g', null, svgB), gL = el('g', null, svgB);

  // O que veio de cada região africana para cada porto brasileiro.
  const origens = {};
  for (const r of D.rotas) {
    if (!r.destino.startsWith('brasil')) continue;
    (origens[r.destino] = origens[r.destino] || []).push(r);
  }

  const dicaB = html('dica-br'), palcoB = html('palco-br');
  palcoB.addEventListener('pointerleave', () => dicaB.classList.remove('visivel'));
  const mostrarB = (e, conteudo) => {
    dicaB.innerHTML = conteudo;
    dicaB.classList.add('visivel');
    const cx = palcoB.getBoundingClientRect();
    let px = e.clientX - cx.left + 16, py = e.clientY - cx.top + 16;
    if (px + dicaB.offsetWidth > cx.width - 8) px = e.clientX - cx.left - dicaB.offsetWidth - 16;
    if (py + dicaB.offsetHeight > cx.height - 8) py = Math.max(8, e.clientY - cx.top - dicaB.offsetHeight - 16);
    dicaB.style.left = px + 'px'; dicaB.style.top = py + 'px';
  };

  let vista = 'desembarques';
  let rotulosBr = [];

  // Mesma lógica das outras cartas: quatro posições candidatas, senão some.
  function descongestionarBr() {
    const ocupados = [];
    const colide = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const medir = (t) => { const b = t.getBBox(); return { x: b.x - 4, y: b.y - 2, w: b.width + 8, h: b.height + 4 }; };
    for (const it of [...rotulosBr].sort((a, b) => b.peso - a.peso)) {
      const opcoes = [
        [it.x + it.r + 7, it.y - 1, 'start'], [it.x - it.r - 7, it.y - 1, 'end'],
        [it.x, it.y - it.r - 16, 'middle'], [it.x, it.y + it.r + 15, 'middle'],
        [it.x + it.r + 7, it.y - it.r - 12, 'start'], [it.x - it.r - 7, it.y + it.r + 12, 'end'],
      ];
      it.t.style.display = '';
      let posto = false;
      for (const [px, py, anc] of opcoes) {
        it.t.setAttribute('text-anchor', anc);
        it.l1.setAttribute('x', px); it.l1.setAttribute('y', py);
        it.l2.setAttribute('x', px); it.l2.setAttribute('y', py + 15);
        const r = medir(it.t);
        if (!ocupados.some((o) => colide(r, o))) { ocupados.push(r); posto = true; break; }
      }
      if (!posto) it.t.style.display = 'none';
    }
  }

  const desenhar = () => {
    while (gB.firstChild) gB.removeChild(gB.firstChild);
    while (gL.firstChild) gL.removeChild(gL.firstChild);
    rotulosBr = [];
    if (vista === 'desembarques') desenharDesembarques(); else desenharCenso();
    descongestionarBr();
    legendaB();
  };

  function legendaB() {
    const escalas = vista === 'desembarques' ? [2000000, 500000] : [300000, 50000];
    const g = el('g', null, gL);
    const bx = x1 - 96, by = y1 - 30;
    const rMax = raio(escalas[0]);
    for (const v of escalas) {
      const r = raio(v);
      el('circle', { cx: bx, cy: by - r, r, fill: 'none', stroke: '#5d4a30', 'stroke-width': .9, opacity: .7 }, g);
      el('line', { x1: bx, y1: by - 2 * r, x2: bx + rMax + 6, y2: by - 2 * r,
        stroke: '#5d4a30', 'stroke-width': .5, opacity: .45 }, g);
      texto(num(v), { x: bx + rMax + 10, y: by - 2 * r + 4, class: 'rotulo', 'font-size': 12 }, g);
    }
    texto(vista === 'desembarques' ? 'desembarcados · 1501-1856' : 'escravizados · censo de 1872',
      { x: x1 - 10, y: by + 22, 'text-anchor': 'end', class: 'rotulo',
        'font-size': 12.5, 'font-style': 'italic' }, g);
  }

  let maxB = Math.max(...B.desembarques.map((d) => d.pessoas));
  const raio = (v) => Math.max(5, Math.sqrt(v / maxB) * 36);

  function desenharCenso() {
    maxB = B.censo1872.provincias[0].escravos;
    for (const p of B.censo1872.provincias) {
      const [x, y] = proj(p.lon, p.lat);
      const r = raio(p.escravos);
      const c = el('circle', { cx: x, cy: y, r, fill: '#8c2f2f', 'fill-opacity': .42, class: 'bolha' }, gB);
      const conteudo = `<h4>${p.nome} — 1872</h4>
        <dl><dt>Pessoas escravizadas</dt><dd>${num(p.escravos)}</dd>
        <dt>Do total do Império</dt><dd>${((p.escravos / B.censo1872.total) * 100).toFixed(1).replace('.', ',')}%</dd></dl>`;
      c.addEventListener('pointermove', (e) => mostrarB(e, conteudo));
      c.addEventListener('pointerleave', () => dicaB.classList.remove('visivel'));
      if (p.escravos >= 20000) {
        const t = el('text', { class: 'rotulo porto', 'font-size': 13, 'text-anchor': 'start' }, gL);
        const l1 = el('tspan', {}, t);
        l1.textContent = p.nome.replace(' (província)', '').replace(' (Corte)', '');
        const l2 = el('tspan', { 'font-size': 12, fill: 'var(--tinta-2)' }, t);
        l2.textContent = num(p.escravos);
        rotulosBr.push({ t, l1, l2, x, y, r, peso: p.escravos });
      }
    }
  }

  function desenharDesembarques() {
    maxB = Math.max(...B.desembarques.map((d) => d.pessoas));
    for (const d of B.desembarques) {
    const [x, y] = proj(d.lon, d.lat);
    const r = raio(d.pessoas);
    const c = el('circle', { cx: x, cy: y, r, fill: corBandeira('portugal'),
      'fill-opacity': .42, class: 'bolha' }, gB);
    const lista = (origens[d.id] || []).sort((a, b) => b.desembarcados - a.desembarcados);
    const soma = lista.reduce((t, x2) => t + x2.desembarcados, 0) || 1;
    const conteudo = `<h4>${d.nome}</h4><div>${d.detalhe}</div>
      <dl><dt>Desembarcados</dt><dd>${num(d.pessoas)}</dd></dl>
      <div class="nota" style="margin-top:8px"><b>De onde vieram</b><br>${
        lista.map((o) => `<span style="color:${corRegiao(o.origem)}">■</span> ${REG[o.origem].nome} — ` +
          `${num(o.desembarcados)} (${((o.desembarcados / soma) * 100).toFixed(0)}%)`).join('<br>')}</div>
      <div class="nota">${d.nota}</div>`;
    c.addEventListener('pointermove', (e) => mostrarB(e, conteudo));
    c.addEventListener('pointerleave', () => dicaB.classList.remove('visivel'));

    const t = el('text', { class: 'rotulo porto', 'font-size': 14.5, 'text-anchor': 'start' }, gL);
    const l1 = el('tspan', {}, t); l1.textContent = d.rotulo || d.nome;
    const l2 = el('tspan', { 'font-size': 13, fill: 'var(--tinta-2)' }, t);
    l2.textContent = num(d.pessoas);
    rotulosBr.push({ t, l1, l2, x, y, r, peso: d.pessoas });
    }
  }

  // Fichas de troca de vista
  {
    const fb = html('fichas-br');
    const opcoes = [['desembarques', 'Desembarques · 1501-1856'], ['censo1872', 'População escravizada · censo de 1872']];
    const pintar = () => {
      fb.innerHTML = '';
      for (const [id, rot] of opcoes) {
        fb.appendChild(ficha(rot, vista === id, null, () => { vista = id; pintar(); desenhar(); }));
      }
    };
    pintar();
  }
  desenhar();

  html('lacuna-brasil').innerHTML = `<b>O que esta carta não mostra.</b> ${B._lacuna}`;
  const cite = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;
  html('nota-censo').innerHTML = B.censo1872._fonte + ' ' + B.censo1872._nota;
  {
    const maxC = B.censo1872.provincias[0].escravos;
    tabela('tabela-censo',
      [{ rotulo: 'Província' }, { rotulo: 'Pessoas escravizadas', num: true }, { rotulo: '% do Império', num: true }, { rotulo: '' }],
      B.censo1872.provincias.map((p) => [
        p.nome, num(p.escravos),
        ((p.escravos / B.censo1872.total) * 100).toFixed(2).replace('.', ',') + '%',
        barra(p.escravos, maxC, '#8c2f2f'),
      ]).concat([[`<b>Total do Império</b>`, `<b>${num(B.censo1872.total)}</b>`,
        `<b>${B.censo1872.pct_populacao}</b>`, '']]));
  }
  html('cartoes-contraste').innerHTML = B.censo1872.contraste.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto}</div></div>`).join('');
  html('cartoes-cidades').innerHTML = B.cidades.map((c) => `<div class="cartao">
    <div class="quando" style="font-family:var(--fonte-mapa);letter-spacing:.14em;
      text-transform:uppercase;font-size:12.5px;color:var(--tinta-3)">${c.quando}</div>
    <h3 style="margin-top:4px">${c.nome}</h3>
    <div class="grande" style="font-size:22px">${c.cifra}</div>
    <div class="miudo" style="margin-top:8px">${c.texto} ${cite(c.pagina)}</div></div>`).join('');
  html('cartoes-colonia').innerHTML = B.colonia.map((c) => `<div class="cartao">
    <h3>${c.rotulo}</h3><div class="grande" style="font-size:23px">${c.valor}</div>
    <div class="miudo" style="margin-top:8px">${c.detalhe} ${cite(c.pagina)}</div></div>`).join('');
}




// =====================================================================
//  ABA "AS ORIGENS"
// =====================================================================
const O = D.origens;
const citeO = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;

// --- Carta V: as outras rotas e a frente de captura
let origMontado = false;
function montarMapaOrigens() {
  if (origMontado) return;
  origMontado = true;
  const C = O.carta;

  // A África inteira num quadro próprio: 18 px por grau.
  const KO = 18;
  const projO = (lon, lat) => [(lon - LON_MIN) * KO, (mercY(lat) - Y0) * KO];
  const caminhoO = (anel) => {
    let d = '';
    for (let i = 0; i < anel.length; i++) {
      const [x, y] = projO(anel[i][0], anel[i][1]);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  };

  const svg = html('mapa-origens');
  const [bx0] = projO(-27, 0), [bx1] = projO(56, 0);
  const [, by0] = projO(0, 41), [, by1] = projO(0, -36);
  svg.setAttribute('viewBox', `${bx0.toFixed(0)} ${by0.toFixed(0)} ${(bx1 - bx0).toFixed(0)} ${(by1 - by0).toFixed(0)}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, fill: 'var(--mar)' }, svg);
  const gT = el('g', { class: 'terra' }, svg);
  for (const anel of D.geo.litoral) el('path', { d: caminhoO(anel) }, gT);
  const gF = el('g', null, svg);   // frente de captura
  const gR = el('g', null, svg);   // rotas
  const gP = el('g', null, svg);   // pontos
  const gLL = el('g', null, svg);  // fios de chamada
  const gL = el('g', null, svg);   // rótulos
  const gE = el('g', null, svg);   // legenda

  const LUG = {}; for (const l of C.lugares) LUG[l.id] = l;
  const SIS = {}; for (const s of C.sistemas) SIS[s.id] = s;

  const dica = html('dica-origens'), palco = html('palco-origens');
  palco.addEventListener('pointerleave', () => dica.classList.remove('visivel'));
  const mostrar = (e, conteudo) => {
    dica.innerHTML = conteudo;
    dica.classList.add('visivel');
    const cx = palco.getBoundingClientRect();
    let px = e.clientX - cx.left + 16, py = e.clientY - cx.top + 16;
    if (px + dica.offsetWidth > cx.width - 8) px = e.clientX - cx.left - dica.offsetWidth - 16;
    if (py + dica.offsetHeight > cx.height - 8) py = Math.max(8, e.clientY - cx.top - dica.offsetHeight - 16);
    dica.style.left = px + 'px'; dica.style.top = py + 'px';
  };

  const camadas = { rotas: true, frente: true };
  let rotulos = [];

  // A frente de captura: linhas paralelas à costa, deslocadas para o interior
  // pelas distâncias que o livro dá. São esquemáticas, e a carta diz isso.
  function desenharFrente() {
    const GRAU = 111;  // km por grau, aproximação corrente
    for (const f of C.frente.faixas) {
      const dg = f.km / GRAU;
      for (const [costa, sinal] of [[C.frente.costa_atlantica, 1], [C.frente.costa_indica, -1]]) {
        const pts = costa.map(([lo, la]) => projO(lo + sinal * dg, la));
        let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
          d += `Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
        }
        d += `L${pts[pts.length - 1][0].toFixed(1)},${pts[pts.length - 1][1].toFixed(1)}`;
        const p = el('path', { d, fill: 'none', stroke: f.cor, 'stroke-width': 3,
          'stroke-dasharray': '2 7', 'stroke-linecap': 'round', opacity: .85 }, gF);
        const conteudo = `<h4>A frente de captura</h4>
          <dl><dt>Quando</dt><dd>${f.quando}</dd><dt>Distância do litoral</dt><dd>${num(f.km)} km</dd></dl>
          <div class="nota">${f.rotulo}. Linha esquemática: o livro dá a distância, não o traçado.</div>`;
        p.addEventListener('pointermove', (e) => mostrar(e, conteudo));
        p.addEventListener('pointerleave', () => dica.classList.remove('visivel'));
        el('path', { d, class: 'rota-toque' }, gF)
          .addEventListener('pointermove', (e) => mostrar(e, conteudo));
        if (sinal === 1) {
          const i = C.frente.faixas.indexOf(f);
          const [tx, ty] = projO(C.frente.costa_atlantica[0][0] + dg, C.frente.costa_atlantica[0][1] + 1.4);
          texto(f.rotulo, { x: tx, y: ty - i * 22, class: 'rotulo', 'font-size': 13,
            'text-anchor': 'middle', fill: f.cor, 'font-style': 'italic' }, gF);
        }
      }
    }
  }

  function desenharRotas() {
    for (const r of C.rotas) {
      const a = LUG[r.de], b = LUG[r.para]; if (!a || !b) continue;
      const s = SIS[r.sistema] || SIS.saara;
      const [x1, y1] = projO(a.lon, a.lat), [x2, y2] = projO(b.lon, b.lat);
      const dx = x2 - x1, dy = y2 - y1, comp = Math.hypot(dx, dy) || 1;
      let nx = -dy / comp, ny = dx / comp;
      if (ny > 0) { nx = -nx; ny = -ny; }          // arqueia sempre para o norte
      const mag = Math.min(90, comp * 0.14);
      const cx = (x1 + x2) / 2 + nx * mag, cy = (y1 + y2) / 2 + ny * mag;
      const d = `M${x1.toFixed(1)},${y1.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      const w = 1.4 + r.peso * 1.3;
      el('path', { d, fill: 'none', stroke: 'var(--papel)', 'stroke-width': w + 2.6,
        'stroke-linecap': 'round', opacity: .45 }, gR);
      const p = el('path', { d, class: 'rota-int', stroke: s.cor, 'stroke-width': w,
        'stroke-dasharray': s.dash, opacity: .92 }, gR);
      // seta
      const t9 = 0.94, u = 1 - t9;
      const px2 = u * u * x1 + 2 * u * t9 * cx + t9 * t9 * x2;
      const py2 = u * u * y1 + 2 * u * t9 * cy + t9 * t9 * y2;
      const ang = Math.atan2(y2 - py2, x2 - px2);
      const sz = 4.5 + w * 0.8;
      el('path', { fill: s.cor, opacity: .95, d:
        `M${x2.toFixed(1)},${y2.toFixed(1)}` +
        `L${(x2 - sz * Math.cos(ang - 0.42)).toFixed(1)},${(y2 - sz * Math.sin(ang - 0.42)).toFixed(1)}` +
        `L${(x2 - sz * Math.cos(ang + 0.42)).toFixed(1)},${(y2 - sz * Math.sin(ang + 0.42)).toFixed(1)}Z` }, gR);
      const conteudo = `<h4>${a.nome} → ${b.nome}</h4>
        <dl><dt>Rota</dt><dd>${r.nome}</dd><dt>Sistema</dt><dd>${s.nome}</dd></dl>
        ${r.nota ? `<div class="nota">${r.nota}</div>` : ''}`;
      for (const alvo of [p, el('path', { d, class: 'rota-toque' }, gR)]) {
        alvo.addEventListener('pointermove', (e) => mostrar(e, conteudo));
        alvo.addEventListener('pointerleave', () => dica.classList.remove('visivel'));
      }
    }
  }

  const FORMA = {
    feitoria: (x, y, g) => { el('circle', { cx: x, cy: y, r: 4.2, fill: 'var(--papel)', class: 'porto' }, g);
      el('circle', { cx: x, cy: y, r: 1.8, fill: 'var(--tinta)' }, g); },
    mercado: (x, y, g) => el('path', { d: `M${x},${y - 5}L${x + 5},${y}L${x},${y + 5}L${x - 5},${y}Z`,
      fill: '#9c6b2f', 'fill-opacity': .85, stroke: 'var(--papel)', 'stroke-width': 1 }, g),
    interior: (x, y, g) => el('rect', { x: x - 3.8, y: y - 3.8, width: 7.6, height: 7.6,
      fill: '#7a5a2e', 'fill-opacity': .85, stroke: 'var(--papel)', 'stroke-width': 1 }, g),
    reino: (x, y, g) => el('path', { d: `M${x},${y - 6}L${x + 5.2},${y + 3}L${x - 5.2},${y + 3}Z`,
      fill: '#8c2f2f', 'fill-opacity': .85, stroke: 'var(--papel)', 'stroke-width': 1 }, g),
    ilha: (x, y, g) => { el('circle', { cx: x, cy: y, r: 4.6, fill: '#3f4d7a', 'fill-opacity': .75,
      stroke: 'var(--papel)', 'stroke-width': 1 }, g); },
    europa: (x, y, g) => { el('circle', { cx: x, cy: y, r: 4.6, fill: '#3f4d7a', 'fill-opacity': .9,
      stroke: 'var(--papel)', 'stroke-width': 1.2 }, g); },
    saida: (x, y, g) => el('path', { d: `M${x - 7},${y}L${x + 7},${y}M${x + 1},${y - 5}L${x + 7},${y}L${x + 1},${y + 5}`,
      fill: 'none', stroke: '#2f5d66', 'stroke-width': 2 }, g),
  };

  function desenharPontos() {
    for (const l of C.lugares) {
      const [x, y] = projO(l.lon, l.lat);
      (FORMA[l.tipo] || FORMA.interior)(x, y, gP);
      const t = texto(l.rotulo || l.nome, { class: 'rotulo porto', 'font-size': 13.5 }, gL);
      const peso = C.rotas.filter((r) => r.de === l.id || r.para === l.id).reduce((s2, r) => s2 + r.peso, 0);
      rotulos.push({ t, x, y, peso: peso + (l.tipo === 'saida' ? 9 : 0) });
    }
  }

  function legenda() {
    while (gE.firstChild) gE.removeChild(gE.firstChild);
    const lx = bx0 + 20, ly = by1 - 276, lw = 344, lh = 258;
    el('rect', { x: lx, y: ly, width: lw, height: lh, fill: 'var(--papel)',
      'fill-opacity': .86, stroke: 'var(--terra-borda)', 'stroke-width': .8 }, gE);
    let yy = ly + 26;
    for (const s of C.sistemas) {
      el('line', { x1: lx + 14, y1: yy, x2: lx + 66, y2: yy, stroke: s.cor,
        'stroke-width': 3.4, 'stroke-dasharray': s.dash, 'stroke-linecap': 'round' }, gE);
      texto(s.nome, { x: lx + 74, y: yy + 5, class: 'rotulo', 'font-size': 13, stroke: 'none' }, gE);
      yy += 23;
    }
    yy += 8;
    for (const f of C.frente.faixas) {
      el('line', { x1: lx + 14, y1: yy, x2: lx + 66, y2: yy, stroke: f.cor,
        'stroke-width': 3, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, gE);
      texto(`a frente em ${f.quando}`, { x: lx + 74, y: yy + 5, class: 'rotulo',
        'font-size': 13, stroke: 'none' }, gE);
      yy += 23;
    }
    return { x: lx - 4, y: ly - 4, w: lw + 8, h: lh + 8 };
  }

  function descongestionar2(obst) {
    const ocupados = (obst || []).slice();
    const colide = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const medir = (t) => { const b = t.getBBox(); return { x: b.x - 3, y: b.y - 2, w: b.width + 6, h: b.height + 4 }; };
    while (gLL.firstChild) gLL.removeChild(gLL.firstChild);
    for (const it of [...rotulos].sort((a, b) => b.peso - a.peso)) {
      const op = [
        [it.x + 9, it.y + 4, 'start'], [it.x - 9, it.y + 4, 'end'],
        [it.x, it.y - 10, 'middle'], [it.x, it.y + 18, 'middle'],
        [it.x + 9, it.y - 9, 'start'], [it.x - 9, it.y + 17, 'end'],
        [it.x + 9, it.y + 17, 'start'], [it.x - 9, it.y - 9, 'end'],
        [it.x + 9, it.y + 30, 'start'], [it.x - 9, it.y + 30, 'end'],
        [it.x + 9, it.y - 22, 'start'], [it.x - 9, it.y - 22, 'end'],
      ];
      it.t.style.display = '';
      let posto = false;
      for (let k = 0; k < op.length; k++) {
        const [px, py, anc] = op[k];
        it.t.setAttribute('x', px); it.t.setAttribute('y', py);
        it.t.setAttribute('text-anchor', anc);
        const r = medir(it.t);
        if (ocupados.some((o) => colide(r, o))) continue;
        ocupados.push(r); posto = true;
        if (k >= 2) el('line', { x1: it.x, y1: it.y, x2: px, y2: py - 4,
          stroke: 'var(--tinta-3)', 'stroke-width': .7, opacity: .6 }, gLL);
        break;
      }
      if (!posto) it.t.style.display = 'none';
    }
  }

  desenharFrente(); desenharRotas(); desenharPontos();
  {
    // O ponto em que as duas ondas quase se encontram é a frase do livro posta no mapa.
    const [ex, ey] = projO(27.5, -13.0);
    texto('as duas ondas se encontram aqui', { x: ex, y: ey, class: 'rotulo',
      'font-size': 13, 'text-anchor': 'middle', 'font-style': 'italic', fill: '#7a1f1f' }, gF);
    texto('— «a meio caminho entre Luanda e a Ilha de Moçambique» —', { x: ex, y: ey + 19,
      class: 'rotulo', 'font-size': 12, 'text-anchor': 'middle', 'font-style': 'italic',
      fill: 'var(--tinta-3)' }, gF);
  }
  descongestionar2([legenda()]);

  {
    const fi = html('fichas-origens');
    const opcoes = [['rotas', 'As rotas'], ['frente', 'A frente de captura']];
    const pintar = () => {
      fi.innerHTML = '';
      for (const [id, rot] of opcoes) {
        fi.appendChild(ficha(rot, camadas[id], null, () => {
          camadas[id] = !camadas[id];
          gR.style.display = camadas.rotas ? '' : 'none';
          gF.style.display = camadas.frente ? '' : 'none';
          pintar();
        }));
      }
    };
    pintar();
  }
}

// --- Figura III: a cadeia da mortalidade
function desenharMortalidade() {
  const M = O.mortalidade;
  const fig = html('fig-mortalidade');
  const W = 940, H = 78 + M.etapas.length * 62 + 56;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': 'Cascata da mortalidade em cinco etapas' }, fig);
  const X0 = 300, LARGB = 560;
  let vivosMin = 100, vivosMax = 100;
  texto('de cada 100 pessoas capturadas no interior da África', { x: X0, y: 26,
    class: 'diag-rot', 'font-size': 15, 'font-style': 'italic', fill: 'var(--tinta-2)' }, svg);
  el('rect', { x: X0, y: 38, width: LARGB, height: 20, fill: 'var(--tinta)', opacity: .82 }, svg);
  texto('100', { x: X0 + LARGB + 10, y: 53, class: 'diag-rot', 'font-size': 15,
    'font-weight': 'bold' }, svg);
  let y = 78;
  for (const e of M.etapas) {
    const perdaMin = vivosMin * e.min / 100, perdaMax = vivosMax * e.max / 100;
    const novoMin = vivosMin - perdaMin, novoMax = vivosMax - perdaMax;
    const g = el('g', null, svg);
    texto(e.rotulo, { x: X0 - 14, y: y + 22, class: 'diag-rot', 'font-size': 14.5,
      'text-anchor': 'end' }, g);
    texto(e.min === e.max ? `− ${e.min}%` : `− ${e.min} a ${e.max}%`,
      { x: X0 - 14, y: y + 40, class: 'diag-rot', 'font-size': 13, 'text-anchor': 'end',
        fill: 'var(--sangue)' }, g);
    // barra: sobreviventes (mínimo garantido), faixa incerta, mortos
    const wMax = LARGB * novoMax / 100, wMin = LARGB * novoMin / 100;
    el('rect', { x: X0, y: y + 8, width: wMax, height: 26, fill: 'var(--tinta)', opacity: .82 }, g);
    el('rect', { x: X0 + wMax, y: y + 8, width: wMin - wMax, height: 26,
      fill: 'var(--tinta)', opacity: .34 }, g);
    el('rect', { x: X0 + wMin, y: y + 8, width: LARGB - wMin, height: 26,
      fill: 'var(--sangue)', opacity: .16 }, g);
    el('rect', { x: X0, y: y + 8, width: LARGB, height: 26, fill: 'none',
      stroke: 'var(--terra-borda)', 'stroke-width': .7 }, g);
    texto(`${Math.round(novoMax)} a ${Math.round(novoMin)}`,
      { x: X0 + LARGB + 10, y: y + 27, class: 'diag-rot', 'font-size': 14.5 }, g);
    const tt = el('title', null, g); tt.textContent = e.nota;
    vivosMin = novoMin; vivosMax = novoMax;
    y += 62;
  }
  el('line', { x1: X0, y1: y + 2, x2: X0 + LARGB, y2: y + 2, stroke: 'var(--terra-borda)',
    'stroke-width': 1 }, svg);
  texto(`sobrevivem ${Math.round(vivosMax)} a ${Math.round(vivosMin)} de cada 100`,
    { x: X0, y: y + 28, class: 'diag-rot', 'font-size': 17, 'font-weight': 'bold' }, svg);
  texto('o livro arredonda para quarenta', { x: X0 + LARGB + 10, y: y + 28,
    class: 'diag-rot', 'font-size': 13, 'text-anchor': 'end', 'font-style': 'italic',
    fill: 'var(--tinta-3)' }, svg);
  const cap = document.createElement('figcaption');
  cap.innerHTML = 'Cada etapa incide sobre quem sobrou da anterior. A faixa clara é a incerteza '
    + 'entre o piso e o teto que Joseph Miller dá para cada etapa. ' + citeO(M.pagina);
  fig.appendChild(cap);
}

// --- Figura: a substituição do cativo indígena pelo africano
function desenharSubstituicao() {
  const S = O.indigena.substituicao;
  const fig = html('fig-substituicao');
  const W = 900, H = 60 + S.length * 74 + 30;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': 'Composição da escravaria do engenho Sergipe do Conde' }, fig);
  const X0 = 110, LARGB = 640;
  texto('africanos', { x: X0, y: 26, class: 'diag-rot', 'font-size': 14,
    fill: 'var(--tinta)' }, svg);
  texto('indígenas', { x: X0 + LARGB, y: 26, class: 'diag-rot', 'font-size': 14,
    'text-anchor': 'end', fill: '#7a5a2e' }, svg);
  let y = 46;
  for (const linha of S) {
    const g = el('g', null, svg);
    texto(String(linha.ano), { x: X0 - 16, y: y + 32, class: 'diag-rot', 'font-size': 19,
      'text-anchor': 'end', 'font-family': 'var(--fonte-mapa)' }, g);
    const wa = LARGB * linha.africanos / 100;
    el('rect', { x: X0, y: y + 10, width: wa, height: 34, fill: 'var(--tinta)', opacity: .82 }, g);
    el('rect', { x: X0 + wa, y: y + 10, width: LARGB - wa, height: 34, fill: '#7a5a2e', opacity: .5 }, g);
    if (linha.africanos >= 12) texto(`${linha.africanos}%`, { x: X0 + 10, y: y + 33,
      class: 'diag-rot', 'font-size': 15, fill: 'var(--papel)' }, g);
    else texto(`${linha.africanos}%`, { x: X0 + wa + 8, y: y + 33, class: 'diag-rot',
      'font-size': 15, fill: 'var(--tinta)' }, g);
    if (linha.indios >= 12) texto(`${linha.indios}%`, { x: X0 + LARGB - 12, y: y + 33,
      class: 'diag-rot', 'font-size': 15, 'text-anchor': 'end', fill: 'var(--papel)' }, g);
    y += 74;
  }
  const cap = document.createElement('figcaption');
  cap.innerHTML = 'Engenho Sergipe do Conde, Recôncavo Baiano, da Companhia de Jesus. '
    + 'Em 64 anos a escravaria trocou inteiramente de origem. ' + citeO(101);
  fig.appendChild(cap);
}

// --- a prosa da aba
{
  const C = O.carta, M = O.mortalidade;
  html('epigrafe-origens').innerHTML =
    `<p>“${O.epigrafe.texto}”</p><footer>${O.epigrafe.autor} ${citeO(O.epigrafe.pagina)}</footer>`;
  html('abertura-origens').innerHTML = O.abertura;

  html('titulo-origens').textContent = C.titulo;
  html('intro-origens').innerHTML = C.intro;
  html('nota-origens').innerHTML = `<b>Como ler as linhas de frente.</b> ${C.nota}`;
  html('numeros-origens').innerHTML = C.numeros.map((n) => `<div class="numero">
    <b>${n.valor}</b><span>${n.rubrica} ${citeO(n.pagina)}</span></div>`).join('');

  html('titulo-mortalidade').textContent = M.titulo;
  html('intro-mortalidade').innerHTML = M.intro;
  html('verificacao-mortalidade').innerHTML = `<b>Conferência.</b> ${M.verificacao}`;
  html('totais-mortalidade').innerHTML = M.totais.map((t) => `<div class="numero">
    <b class="morte">${t.valor}</b><span>${t.rubrica}</span></div>`).join('');
  html('catorze-mortalidade').innerHTML = M.catorze;
  html('casos-mortalidade').innerHTML = M.casos.map((c) => `<div class="cartao">
    <div class="miudo" style="font-family:var(--fonte-mapa);letter-spacing:.14em;
      text-transform:uppercase;font-size:12.5px;color:var(--tinta-3)">${c.rota} · ${c.ano}</div>
    <h3 style="margin-top:4px;font-style:italic">${c.navio}</h3>
    <div class="miudo" style="margin-top:8px">${c.texto}</div></div>`).join('');
  html('tubaroes-mortalidade').innerHTML = M.tubaroes + ' ' + citeO('38-39');

  const A = O.antes;
  html('titulo-antes').textContent = A.titulo;
  html('intro-antes').innerHTML = A.intro;
  html('cartoes-antes').innerHTML = A.itens.map((i) => `<div class="cartao">
    <h3>${i.titulo}</h3><div class="miudo" style="margin-top:10px">${i.texto} ${citeO(i.pagina)}</div></div>`).join('');

  const F = O.definicao;
  html('titulo-definicao').textContent = F.titulo;
  html('listas-definicao').innerHTML = `<div class="cartao"><h3>${F.lovejoy_titulo}</h3>
      <ol style="margin:12px 0 0;padding-left:20px;font-size:15px;color:var(--tinta-2)">${
      F.lovejoy.map((x) => `<li style="margin-bottom:7px">${x}</li>`).join('')}</ol></div>
    <div class="cartao"><h3>${F.patterson_titulo}</h3>
      <ol style="margin:12px 0 0;padding-left:20px;font-size:15px;color:var(--tinta-2)">${
      F.patterson.map((x) => `<li style="margin-bottom:7px">${x}</li>`).join('')}</ol></div>`;
  html('morte-social').innerHTML = F.morte_social + ' ' + citeO(53);
  html('nomes-definicao').innerHTML = F.nomes + ' ' + citeO('53-54');
  html('estrangeiro-definicao').innerHTML = F.estrangeiro + ' ' + citeO(54);

  const R = O.racismo;
  html('titulo-racismo').textContent = R.titulo;
  html('intro-racismo').innerHTML = R.intro;
  html('cam-racismo').innerHTML = R.cam + ' ' + citeO('60-61');
  html('titulo-iluministas').textContent = R.iluministas_titulo;
  html('cartoes-iluministas').innerHTML = R.iluministas.map((i) => `<div class="cartao">
    <h3>${i.autor} <span style="font-family:var(--fonte-mapa);color:var(--tinta-3);
      font-size:16px">${i.ano}</span></h3>
    <div class="miudo" style="margin-top:10px;font-style:italic">“${i.texto}”</div></div>`).join('');
  html('fecho-racismo').innerHTML = R.fecho;

  const L = O.leilao;
  html('titulo-leilao').textContent = L.titulo;
  html('texto-leilao').innerHTML = L.texto;
  html('cronista-leilao').innerHTML = L.cronista;
  html('citacao-leilao').innerHTML = `<p>“${L.citacao}”</p><footer>${L.citacao_autor} ${citeO('41-42')}</footer>`;
  html('consolo-leilao').innerHTML = L.consolo;
  html('quem-leilao').innerHTML = L.quem;
  html('antes-leilao').innerHTML = L.antes + ' ' + citeO('45-46');
  html('virada-leilao').innerHTML = L.virada + ' ' + citeO('46-47');
  tabela('tabela-leilao', [{ rotulo: 'O quê' }, { rotulo: 'Quanto', num: true },
    { rotulo: 'Quando' }, { rotulo: '' }],
    L.portugal.map((x) => [x.rubrica, `<b>${x.valor}</b>`, x.periodo, citeO(x.pagina)]));
  html('saunders-leilao').innerHTML = `<p>“${L.saunders}”</p><footer>${L.saunders_autor} ${citeO('44-45')}</footer>`;
  html('braga-leilao').innerHTML = L.braga + ' ' + citeO(45);

  const P = O.patrono;
  html('titulo-patrono').textContent = P.titulo;
  html('intro-patrono').innerHTML = P.intro + ' ' + citeO(70);
  html('definicao-patrono').innerHTML = `<p>“${P.definicao}”</p><footer>${P.definicao_autor} ${citeO(70)}</footer>`;
  html('cartoes-patrono').innerHTML = P.itens.map((i) => `<div class="cartao">
    <h3>${i.titulo}</h3><div class="miudo" style="margin-top:10px">${i.texto} ${citeO(i.pagina)}</div></div>`).join('');

  const R2 = O.mar;
  html('titulo-mar').textContent = R2.titulo;
  html('intro-mar').innerHTML = R2.intro;
  html('bojador-mar').innerHTML = R2.bojador + ' ' + citeO('71-72');
  html('volta-mar').innerHTML = R2.volta_grande + ' ' + citeO(79);
  html('titulo-calendario').textContent = R2.calendario_titulo;
  html('calendario-mar').innerHTML = R2.calendario + ' ' + citeO(79);
  html('titulo-consequencias').textContent = R2.consequencias_titulo;
  html('cartoes-mar').innerHTML = R2.consequencias.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto}</div></div>`).join('');
  html('thornton-mar').innerHTML = `<p>“${R2.thornton}”</p><footer>${R2.thornton_autor} ${citeO(81)}</footer>`;
  html('financiadores-mar').innerHTML = R2.financiadores + ' ' + citeO(83);
  html('primeira-carga-mar').innerHTML = R2.primeira_carga + ' ' + citeO(84);
  html('sangria-mar').innerHTML = `<b>A escravidão como resposta a um vazio.</b> ${R2.sangria} ${citeO(87)}`;

  const I = O.ilhas;
  html('titulo-ilhas').textContent = I.titulo;
  html('intro-ilhas').innerHTML = I.intro;
  html('cartoes-ilhas').innerHTML = [I.cabo_verde, I.sao_tome].map((c) => `<div class="cartao">
    <div class="miudo" style="font-family:var(--fonte-mapa);letter-spacing:.2em;
      text-transform:uppercase;font-size:12.5px;color:var(--tinta-3)">desde ${c.quando}</div>
    <h3 style="margin-top:4px">${c.nome}</h3>
    <div class="miudo" style="margin-top:10px">${c.texto} ${citeO(c.pagina)}</div></div>`).join('');
  html('procedimentos-ilhas').innerHTML = I.procedimentos + ' ' + citeO(144);
  html('bocais-ilhas').innerHTML = I.boçais + ' ' + citeO(139);
  html('jardim-ilhas').innerHTML = I.jardim + ' ' + citeO(142);
  html('mandioca-ilhas').innerHTML = I.mandioca + ' ' + citeO('142-143');
  html('amador-ilhas').innerHTML = `<b>Amador, rei de São Tomé.</b> ${I.amador} ${citeO('143-144')}`;
  html('assientos-ilhas').innerHTML = I.assientos + ' ' + citeO('145-146');
  html('preco-ilhas').innerHTML = I.preco + ' ' + citeO(146);
  html('elvas-ilhas').innerHTML = I.elvas + ' ' + citeO('146-147');
  html('titulo-lancados').textContent = I.lancados_titulo;
  html('lancados-ilhas').innerHTML = I.lancados + ' ' + citeO('147-149');
  html('citacao-lancados').innerHTML = `<p>“${I.lancados_citacao}”</p><footer>${I.lancados_autor} ${citeO(148)}</footer>`;
  html('cartoes-lancados').innerHTML = I.lancados_itens.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto}</div></div>`).join('');

  const G = O.congo;
  html('titulo-congo').textContent = G.titulo;
  html('intro-congo').innerHTML = G.intro;
  html('boxer-congo').innerHTML = `<p>“${G.boxer}”</p><footer>${G.boxer_autor} ${citeO(153)}</footer>`;
  html('cidade-congo').innerHTML = G.cidade + ' ' + citeO(153);
  html('linha-congo').innerHTML = G.linha.map((m) => `<li><b>${m.ano}</b>
    <div class="miudo" style="margin-top:5px">${m.texto}</div></li>`).join('');
  html('cartas-congo').innerHTML = G.cartas + ' ' + citeO('157-158');
  html('costa-congo').innerHTML = `<p>“${G.costa_silva}”</p><footer>${G.costa_silva_autor} ${citeO(160)}</footer>`;
  html('irmao-congo').innerHTML = G.irmao + ' ' + citeO(161);
  html('coroa-congo').innerHTML = G.coroa + ' ' + citeO(162);

  const N = O.indigena;
  html('titulo-indigena').textContent = N.titulo;
  html('intro-indigena').innerHTML = N.intro;
  tabela('tabela-catastrofe', [{ rotulo: 'O quê' }, { rotulo: 'Quanto', num: true }, { rotulo: '' }],
    N.catastrofe.map((x) => [x.rubrica, `<b>${x.valor}</b>`, x.detalhe]));
  html('alencastro-indigena').innerHTML = `<p>“${N.alencastro}”</p><footer>${N.alencastro_autor} ${citeO(93)}</footer>`;
  html('epidemias-indigena').innerHTML = N.epidemias + ' ' + citeO(94);
  html('bandeiras-indigena').innerHTML = N.bandeiras + ' ' + citeO('99-100');
  html('guarani-indigena').innerHTML = N.guarani + ' ' + citeO(100);
  html('titulo-substituicao').textContent = N.substituicao_titulo;
  html('nota-substituicao').innerHTML = N.substituicao_nota;
  html('titulo-razoes').textContent = N.razoes_titulo;
  html('cartoes-razoes').innerHTML = N.razoes.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto}</div></div>`).join('');
  html('titulo-lei').textContent = N.lei_titulo;
  html('lei-indigena').innerHTML = N.lei + ' ' + citeO('102-103');
  html('cartoes-excecoes').innerHTML = N.excecoes.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto}</div></div>`).join('');
  html('vieira-indigena').innerHTML = `<b>E quem defendeu os índios propôs os africanos.</b> ${N.vieira} ${citeO('104-105')}`;

  const J = O.igreja;
  html('titulo-igreja').textContent = J.titulo;
  html('epigrafe-igreja').innerHTML = `<p>“${J.epigrafe}”</p><footer>${J.epigrafe_autor} ${citeO(285)}</footer>`;
  html('intro-igreja').innerHTML = J.intro;
  html('cartoes-bulas').innerHTML = J.bulas.map((b) => `<div class="cartao">
    <div class="miudo" style="font-family:var(--fonte-mapa);letter-spacing:.16em;
      text-transform:uppercase;font-size:12.5px;color:var(--tinta-3)">${b.data} · ${b.papa}</div>
    <h3 style="margin-top:4px;font-style:italic">${b.nome}</h3>
    <div class="miudo" style="margin-top:10px">${b.texto}</div></div>`).join('');
  html('indulgencia-igreja').innerHTML = J.indulgencia + ' ' + citeO(284);
  html('titulo-proprietarios').textContent = J.proprietarios_titulo;
  html('cartoes-proprietarios').innerHTML = J.proprietarios.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto} ${citeO(c.pagina)}</div></div>`).join('');
  html('loyola-igreja').innerHTML = J.loyola + ' ' + citeO('284-285');
  html('moeda-igreja').innerHTML = J.moeda + ' ' + citeO(285);
  html('concurso-igreja').innerHTML = `<b>O prêmio do concurso de poesia.</b> ${J.concurso} ${citeO('285-286')}`;
  html('vieira-igreja').innerHTML = J.vieira + ' ' + citeO('276-277');
  html('benci-igreja').innerHTML = J.benci + ' ' + citeO('280-281');
  html('malta-igreja').innerHTML = J.malta + ' ' + citeO('281-282');
  html('titulo-sangue').textContent = J.sangue_titulo;
  html('sangue-igreja').innerHTML = J.sangue + ' ' + citeO('286-287');
  html('claver-igreja').innerHTML = J.claver + ' ' + citeO('275-276');
  html('irmandades-igreja').innerHTML = J.irmandades + ' ' + citeO('287-288');

  const K = O.cicatriz;
  html('titulo-cicatriz').textContent = K.titulo;
  html('intro-cicatriz').innerHTML = K.intro;
  html('cartoes-cicatriz').innerHTML = K.passos.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3><div class="miudo" style="margin-top:10px">${c.texto}</div></div>`).join('');
  html('titulo-armas').textContent = K.armas_titulo;
  tabela('tabela-armas', [{ rotulo: 'O quê' }, { rotulo: 'Quanto', num: true }, { rotulo: 'De quem' }],
    K.armas.map((x) => [x.rubrica, `<b>${x.valor}</b>`, x.fonte]));
  html('rediker-cicatriz').innerHTML = `<p>“${K.rediker}”</p><footer>${K.rediker_autor} ${citeO(130)}</footer>`;
  html('geografia-cicatriz').innerHTML = K.geografia + ' ' + citeO('130-131');
  html('aliada-cicatriz').innerHTML = K.aliada + ' ' + citeO(131);
  html('titulo-numeros-cicatriz').textContent = K.numeros_titulo;
  tabela('tabela-cicatriz', [{ rotulo: 'O quê' }, { rotulo: 'Quanto', num: true },
    { rotulo: 'De quem' }, { rotulo: '' }],
    K.numeros.map((x) => [x.rubrica, `<b>${x.valor}</b>`, x.fonte, x.detalhe]));
  html('mbokolo-cicatriz').innerHTML = `<p>“${K.mbokolo}”</p><footer>${K.mbokolo_autor} ${citeO(132)}</footer>`;
  html('peonagem-cicatriz').innerHTML = K.peonagem + ' ' + citeO('127-128');
  html('desterro-cicatriz').innerHTML = `<p>“${K.desterro}”</p><footer>${K.desterro_autor} ${citeO(128)}</footer>`;
  html('terra-cicatriz').innerHTML = K.terra + ' ' + citeO('125-126');
  html('titulo-reconciliacao').textContent = K.reconciliacao_titulo;
  html('reconciliacao-cicatriz').innerHTML = K.reconciliacao + ' ' + citeO('134-136');
  html('araujo-cicatriz').innerHTML = `<p>“${K.araujo}”</p><footer>${K.araujo_autor} ${citeO('136-137')}</footer>`;

  desenharMortalidade();
  desenharSubstituicao();
}

// =====================================================================
//  O QUE A LEITURA DOS CAPÍTULOS RESTANTES ACRESCENTOU ÀS OUTRAS ABAS
// =====================================================================
{
  const T = D.leituras;
  const c = citeO;

  const GX = T.guerra_extra;
  html('titulo-guerra-extra').textContent = GX.titulo;
  html('intro-guerra-extra').innerHTML = GX.intro;
  html('cartoes-guerra-extra').innerHTML = GX.itens.map((i) => `<div class="cartao">
    <h3>${i.titulo}</h3><div class="miudo" style="margin-top:10px">${i.texto} ${c(i.pagina)}</div></div>`).join('');
  html('titulo-calote').textContent = GX.calote_titulo;
  html('calote-texto').innerHTML = GX.calote + ' ' + c(GX.calote_pagina);
  html('titulo-acucar').textContent = GX.acucar_titulo;
  tabela('tabela-acucar', [{ rotulo: 'Quando' }, { rotulo: 'O quê' }, { rotulo: 'Quanto', num: true }],
    GX.acucar.map((x) => [`<b>${x.quando}</b>`, x.rubrica, `<b>${x.valor}</b>`]));
  html('nota-acucar').innerHTML = `<b>O que a guerra custou ao açúcar.</b> ${GX.acucar_nota} ${c(GX.acucar_pagina)}`;

  const PE = T.padre_eterno;
  html('titulo-padre-eterno').textContent = PE.titulo;
  html('texto-padre-eterno').innerHTML = PE.texto;
  html('titanic-padre-eterno').innerHTML = PE.titanic;
  html('estaleiros-padre-eterno').innerHTML = PE.estaleiros;
  html('titulo-dono').textContent = PE.dono_titulo;
  html('dono-padre-eterno').innerHTML = PE.dono;
  html('titulo-angola-1648').textContent = PE.angola_titulo;
  html('angola-padre-eterno').innerHTML = PE.angola;
  html('carnificina-padre-eterno').innerHTML = `<b>E o que veio depois da vitória.</b> ${PE.carnificina}`;
  html('guardiao-padre-eterno').innerHTML = PE.guardiao;
  html('fim-padre-eterno').innerHTML = PE.fim + ' ' + c(PE.pagina);

  const CA = T.catarina;
  html('titulo-catarina').textContent = CA.titulo;
  html('texto-catarina').innerHTML = CA.texto;
  html('pai-catarina').innerHTML = `<b>De onde vinha o dinheiro da família.</b> ${CA.pai}`;
  html('rac-catarina').innerHTML = CA.rac;
  html('estatua-catarina').innerHTML = CA.estatua;
  html('cha-catarina').innerHTML = CA.cha + ' ' + c(CA.pagina);

  const IN = T.inferno;
  html('titulo-inferno').textContent = IN.titulo;
  html('intro-inferno').innerHTML = IN.intro;
  html('citacao-inferno').innerHTML = `<p>“${IN.citacao}”</p><footer>${IN.citacao_autor} ${c(IN.pagina)}</footer>`;
  html('detalhes-inferno').innerHTML = IN.detalhes.map((x) => `<li>${x}</li>`).join('');

  const Z = T.zumbi;
  html('titulo-zumbi3').textContent = Z.titulo;
  html('intro-zumbi3').innerHTML = Z.intro;
  html('cartoes-zumbi3').innerHTML = Z.camadas.map((x) => `<div class="cartao">
    <h3>${x.titulo}</h3><div class="miudo" style="margin-top:10px">${x.texto}</div></div>`).join('');
  html('titulo-correcoes').textContent = Z.correcoes_titulo;
  tabela('tabela-zumbi3', [{ rotulo: 'O quê' }, { rotulo: 'O que se repete' }, { rotulo: 'O que se sustenta' }],
    Z.correcoes.map((x) => [`<b>${x.item}</b>`, x.errado, x.certo]));
  html('calendario-zumbi3').innerHTML = Z.calendario + ' ' + c(348);
  html('fecho-zumbi3').innerHTML = `<b>Uma ressalva sobre a ressalva.</b> ${Z.fecho} ${c(Z.pagina)}`;

  const FM = T.fim_1695;
  html('titulo-fim1695').textContent = FM.titulo;
  tabela('tabela-fim1695', [{ rotulo: 'O quê' }, { rotulo: 'Quanto', num: true }, { rotulo: '' }],
    FM.itens.map((x) => [x.rubrica, `<b>${x.valor}</b>`, x.detalhe]));
  html('caranguejos-fim1695').innerHTML =
    `<p>“${FM.caranguejos}”</p><footer>${FM.caranguejos_autor} ${c(360)}</footer>`;
  html('virada-fim1695').innerHTML = FM.virada + ' ' + c(FM.pagina);

  const AN = T.ancoras_interno;
  html('ancoras-interno').innerHTML = `<b>Correção — ${AN.titulo}</b> ${AN.intro}
    <ul style="margin:12px 0 0;padding-left:20px">${AN.itens.map((i) =>
      `<li style="margin-bottom:9px"><b>${i.quando} · ${i.titulo}.</b> ${i.texto} ${c(i.pagina)}</li>`).join('')}</ul>
    <p style="margin:12px 0 0">${AN.moncoes} ${c(AN.moncoes_pagina)}</p>`;
}


// =====================================================================
//  Carta IV: o trafico interno, por dentro do Brasil
// =====================================================================
let intMontado = false;
function montarMapaInterno() {
  if (intMontado) return;
  intMontado = true;
  const I = D.interno;

  html('epigrafe-interno').innerHTML =
    `<p>“${I.epigrafe.texto}”</p><footer>${I.epigrafe.credito}</footer>`;
  html('abertura-interno').innerHTML = I.abertura;
  html('lacuna-interno').innerHTML = `<b>Aviso de origem.</b> ${I.lacuna_livro}`;
  html('cautela-interno').innerHTML = `<b>Como ler estes números.</b> ${I.cautela}`;

  // O Atlântico inteiro é desenhado a 10 px por grau; o Brasil sozinho pede quatro
  // vezes mais, senão traço e letra saem grandes demais para a moldura.
  const KI = 30;
  const projI = (lon, lat) => [(lon - LON_MIN) * KI, (mercY(lat) - Y0) * KI];
  const caminhoI = (anel) => {
    let d = '';
    for (let i = 0; i < anel.length; i++) {
      const [x, y] = projI(anel[i][0], anel[i][1]);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  };

  const LUG = {};
  for (const l of I.lugares) LUG[l.id] = l;

  const svgI = html('mapa-interno');
  const [ax0] = projI(-76, 0), [ax1] = projI(-24, 0);
  const [, ay0] = projI(0, 8), [, ay1] = projI(0, -38);
  svgI.setAttribute('viewBox', `${ax0.toFixed(0)} ${ay0.toFixed(0)} ${(ax1 - ax0).toFixed(0)} ${(ay1 - ay0).toFixed(0)}`);
  svgI.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  el('rect', { x: ax0, y: ay0, width: ax1 - ax0, height: ay1 - ay0, fill: 'var(--mar)' }, svgI);
  const gTi = el('g', { class: 'terra' }, svgI);
  for (const anel of D.geo.litoral) el('path', { d: caminhoI(anel) }, gTi);
  const gRi = el('g', null, svgI);      // rotas
  const gPi = el('g', null, svgI);      // pontos
  const gLL = el('g', null, svgI);      // fios de chamada
  const gLi = el('g', null, svgI);      // rotulos
  const gEi = el('g', null, svgI);      // legenda

  const dicaI = html('dica-interno'), palcoI = html('palco-interno');
  palcoI.addEventListener('pointerleave', () => dicaI.classList.remove('visivel'));
  const mostrarI = (e, conteudo) => {
    dicaI.innerHTML = conteudo;
    dicaI.classList.add('visivel');
    const cx = palcoI.getBoundingClientRect();
    let px = e.clientX - cx.left + 16, py = e.clientY - cx.top + 16;
    if (px + dicaI.offsetWidth > cx.width - 8) px = e.clientX - cx.left - dicaI.offsetWidth - 16;
    if (py + dicaI.offsetHeight > cx.height - 8) py = Math.max(8, e.clientY - cx.top - dicaI.offsetHeight - 16);
    dicaI.style.left = px + 'px'; dicaI.style.top = py + 'px';
  };

  const TRACO = {
    mar:   { cor: '#22525c', dash: null,     rot: 'por mar · cabotagem' },
    terra: { cor: '#7a5a2e', dash: '9 6',    rot: 'por terra · comboio' },
    rio:   { cor: '#3f6a72', dash: '2 6',    rot: 'por rio' },
  };
  const ESP = { 1: 2.6, 2: 4.4, 3: 6.4 };
  // Centro aproximado do territorio: as rotas de mar arqueiam para fora dele,
  // as de terra para dentro. E o que faz o desenho parecer o que era.
  

  let era = 'interprovincial';
  let rotulosInt = [];

  // A cabotagem não cortava o continente: descia colada à costa, contornando o
  // bico do Nordeste. Esta é a linha d'água por onde as rotas de mar passam.
  const COSTA = [
    [-47.0, 0.2], [-43.0, -1.0], [-38.0, -1.8], [-36.2, -3.6], [-33.6, -6.2],
    [-33.2, -9.2], [-35.4, -12.2], [-36.6, -15.2], [-38.2, -18.2], [-39.6, -21.0],
    [-41.6, -23.6], [-44.6, -25.1], [-47.6, -26.6], [-49.6, -29.6], [-51.2, -32.6],
    [-54.2, -35.6], [-57.2, -35.8],
  ];
  const maisPerto = (l) => {
    let m = 0, d = Infinity;
    for (let i = 0; i < COSTA.length; i++) {
      const v = (COSTA[i][0] - l.lon) ** 2 + (COSTA[i][1] - l.lat) ** 2;
      if (v < d) { d = v; m = i; }
    }
    return m;
  };
  const suave = (p) => {
    if (p.length < 3) return `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}L${p[1][0].toFixed(1)},${p[1][1].toFixed(1)}`;
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      d += `Q${p[i][0].toFixed(1)},${p[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    return d + `L${p[p.length - 1][0].toFixed(1)},${p[p.length - 1][1].toFixed(1)}`;
  };

  // Cada rota sai do porto, entra na linha d'água e volta ao porto de destino.
  // O afastamento `off` abre as rotas em leque para que não virem um traço só.
  const COSTA_P = COSTA.map(([lo, la]) => projI(lo, la));
  const NORMAL = COSTA_P.map((_, i) => {
    const a = COSTA_P[Math.max(0, i - 1)], b = COSTA_P[Math.min(COSTA_P.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    return [ty / m, -tx / m];   // aponta para o alto-mar
  });
  function derrota(a, b, off) {
    const ia = maisPerto(a), ib = maisPerto(b);
    const passo = ib >= ia ? 1 : -1;
    const pts = [projI(a.lon, a.lat)];
    for (let i = ia; i !== ib + passo; i += passo) {
      pts.push([COSTA_P[i][0] + NORMAL[i][0] * off, COSTA_P[i][1] + NORMAL[i][1] * off]);
    }
    pts.push(projI(b.lon, b.lat));
    return pts;
  }

  function arco(a, b, meio) {
    const [x1, y1] = projI(a.lon, a.lat);
    const [x2, y2] = projI(b.lon, b.lat);
    const dx = x2 - x1, dy = y2 - y1;
    const comp = Math.hypot(dx, dy) || 1;
    let nx = -dy / comp, ny = dx / comp;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    // A costa brasileira corre de nordeste a sul: o alto-mar fica sempre a leste.
    // As rotas de cabotagem arqueiam para fora da terra; as de terra, para dentro.
    if (meio === 'mar' ? nx < 0 : nx > 0) { nx = -nx; ny = -ny; }
    void mx; void my;
    const mag = comp * (meio === 'mar' ? 0.17 : 0.08);
    return { x1, y1, x2, y2, cx: mx + nx * mag, cy: my + ny * mag };
  }
  const ponto = (a, t) => {
    const u = 1 - t;
    return [u * u * a.x1 + 2 * u * t * a.cx + t * t * a.x2,
            u * u * a.y1 + 2 * u * t * a.cy + t * t * a.y2];
  };

  function descongestionarInt(obstaculos) {
    const ocupados = (obstaculos || []).slice();
    const colide = (p, q) => p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
    const medir = (t) => { const b = t.getBBox(); return { x: b.x - 3, y: b.y - 2, w: b.width + 6, h: b.height + 4 }; };
    for (const it of [...rotulosInt].sort((a, b) => b.peso - a.peso)) {
      const opcoes = [
        [it.x + 9, it.y + 4, 'start'], [it.x - 9, it.y + 4, 'end'],
        [it.x, it.y - 10, 'middle'], [it.x, it.y + 17, 'middle'],
        [it.x + 9, it.y - 8, 'start'], [it.x - 9, it.y + 16, 'end'],
        [it.x + 9, it.y + 16, 'start'], [it.x - 9, it.y - 8, 'end'],
        [it.x + 9, it.y + 28, 'start'], [it.x - 9, it.y + 28, 'end'],
        [it.x + 9, it.y - 20, 'start'], [it.x - 9, it.y - 20, 'end'],
        [it.x, it.y + 30, 'middle'], [it.x, it.y - 23, 'middle'],
        [it.x + 9, it.y + 40, 'start'], [it.x - 9, it.y - 32, 'end'],
      ];
      it.t.style.display = '';
      let posto = false;
      for (let k = 0; k < opcoes.length; k++) {
        const [px, py, anc] = opcoes[k];
        it.t.setAttribute('x', px); it.t.setAttribute('y', py);
        it.t.setAttribute('text-anchor', anc);
        const r = medir(it.t);
        if (ocupados.some((o) => colide(r, o))) continue;
        ocupados.push(r); posto = true;
        // Rótulo longe do seu ponto ganha fio de chamada, como nas cartas antigas.
        if (k >= 2) el('line', { x1: it.x, y1: it.y, x2: px, y2: py - 4,
          stroke: 'var(--tinta-3)', 'stroke-width': .7, opacity: .6 }, gLL);
        break;
      }
      if (!posto) it.t.style.display = 'none';
    }
  }

  // Devolve a caixa da legenda, para que os rótulos a evitem.
  function legendaI() {
    while (gEi.firstChild) gEi.removeChild(gEi.firstChild);
    const lx = ax0 + 22, ly = ay1 - 150, lw = 300, lh = 130;
    el('rect', { x: lx, y: ly, width: lw, height: lh, fill: 'var(--papel)',
      'fill-opacity': .82, stroke: 'var(--terra-borda)', 'stroke-width': .8 }, gEi);
    let yy = ly + 26;
    for (const k of ['mar', 'terra', 'rio']) {
      const t = TRACO[k];
      el('line', { x1: lx + 14, y1: yy, x2: lx + 62, y2: yy, stroke: t.cor,
        'stroke-width': 3.4, 'stroke-dasharray': t.dash, 'stroke-linecap': 'round' }, gEi);
      texto(t.rot, { x: lx + 70, y: yy + 5, class: 'rotulo', 'font-size': 13,
        stroke: 'none' }, gEi);
      yy += 24;
    }
    texto('a espessura é qualitativa, não medida', { x: lx + 14, y: yy + 6,
      class: 'rotulo', 'font-size': 11.5, 'font-style': 'italic', stroke: 'none' }, gEi);
    return { x: lx - 4, y: ly - 4, w: lw + 8, h: lh + 8 };
  }

  function desenhar() {
    for (const g of [gRi, gPi, gLL, gLi]) while (g.firstChild) g.removeChild(g.firstChild);
    rotulosInt = [];
    const rotas = I.rotas.filter((r) => r.era === era);
    const usados = new Set();
    for (const r of rotas) { usados.add(r.de); usados.add(r.para); }

    let leque = 0;
    for (const r of rotas.slice().sort((a, b) => a.peso - b.peso)) {
      const a = LUG[r.de], b = LUG[r.para];
      if (!a || !b) continue;
      const t = TRACO[r.meio], w = ESP[r.peso] || 2.2;
      let d, seta;
      if (r.meio === 'mar') {
        const pts = derrota(a, b, 6 + (leque++) * 4.5);
        d = suave(pts);
        seta = [pts[pts.length - 2], pts[pts.length - 1]];
      } else {
        const g = arco(a, b, r.meio);
        d = `M${g.x1.toFixed(1)},${g.y1.toFixed(1)}Q${g.cx.toFixed(1)},${g.cy.toFixed(1)} ${g.x2.toFixed(1)},${g.y2.toFixed(1)}`;
        seta = [ponto(g, 0.88), ponto(g, 0.985)];
      }
      // colchao branco para a rota nao se perder no litoral
      el('path', { d, fill: 'none', stroke: 'var(--papel)', 'stroke-width': w + 3.4,
        'stroke-linecap': 'round', opacity: .5 }, gRi);
      const p = el('path', { d, class: 'rota-int', stroke: t.cor, 'stroke-width': w,
        'stroke-dasharray': t.dash, opacity: .9 }, gRi);
      // seta indicando o sentido da viagem
      const [px1, py1] = seta[0], [px2, py2] = seta[1];
      const ang = Math.atan2(py2 - py1, px2 - px1);
      const s = 7 + w * 0.95;
      el('path', { fill: t.cor, opacity: .95, d:
        `M${px2.toFixed(1)},${py2.toFixed(1)}` +
        `L${(px2 - s * Math.cos(ang - 0.42)).toFixed(1)},${(py2 - s * Math.sin(ang - 0.42)).toFixed(1)}` +
        `L${(px2 - s * Math.cos(ang + 0.42)).toFixed(1)},${(py2 - s * Math.sin(ang + 0.42)).toFixed(1)}Z` }, gRi);
      const conteudo = `<h4>${a.nome} → ${b.nome}</h4>
        <dl><dt>Rota</dt><dd>${r.nome}</dd><dt>Meio</dt><dd>${t.rot.split(' · ')[0]}</dd></dl>
        ${r.nota ? `<div class="nota">${r.nota}</div>` : ''}`;
      const toque = el('path', { d, class: 'rota-toque' }, gRi);
      for (const alvo of [p, toque]) {
        alvo.addEventListener('pointermove', (e) => mostrarI(e, conteudo));
        alvo.addEventListener('pointerleave', () => dicaI.classList.remove('visivel'));
      }
    }

    for (const id of usados) {
      const l = LUG[id]; if (!l) continue;
      const [x, y] = projI(l.lon, l.lat);
      if (l.tipo === 'porto') {
        el('circle', { cx: x, cy: y, r: 4.4, fill: 'var(--papel)', class: 'porto' }, gPi);
        el('circle', { cx: x, cy: y, r: 1.9, fill: 'var(--tinta)' }, gPi);
      } else if (l.tipo === 'praca') {
        el('path', { d: `M${x},${y - 5.2}L${x + 5.2},${y}L${x},${y + 5.2}L${x - 5.2},${y}Z`,
          fill: '#8c2f2f', 'fill-opacity': .8, stroke: 'var(--papel)', 'stroke-width': 1 }, gPi);
      } else {
        el('rect', { x: x - 4, y: y - 4, width: 8, height: 8, fill: '#7a5a2e',
          'fill-opacity': .8, stroke: 'var(--papel)', 'stroke-width': 1 }, gPi);
      }
      const peso = I.rotas.filter((r) => r.era === era && (r.de === id || r.para === id))
        .reduce((s, r) => s + r.peso, 0);
      const tx = texto(l.nome, { class: 'rotulo porto', 'font-size': 15 }, gLi);
      rotulosInt.push({ t: tx, x, y, peso });
    }
    descongestionarInt([legendaI()]);
    pintarResumo();
  }

  function pintarResumo() {
    const e = I.eras.find((x) => x.id === era);
    html('resumo-interno').innerHTML = `<div class="painel-era">
      <p class="quando">${e.periodo}</p>
      <h3>${e.titulo}</h3>
      <p class="corpo">${e.resumo}</p>
      <div class="cifra">${e.volume ? num(e.volume) : '—'}
        <small>${e.volume ? e.unidade_volume + '. ' : ''}${e.nota_volume}</small></div>
    </div>`;
  }

  {
    const fi = html('fichas-interno');
    const pintar = () => {
      fi.innerHTML = '';
      for (const e of I.eras) {
        fi.appendChild(ficha(`${e.nome} · ${e.periodo}`, era === e.id, null,
          () => { era = e.id; pintar(); desenhar(); }));
      }
    };
    pintar();
  }
  desenhar();

  html('cartoes-interno').innerHTML = I.mecanica.map((c) => `<div class="cartao">
    <h3>${c.titulo}</h3>
    <div class="miudo" style="margin-top:10px">${c.texto}</div>
    <div class="miudo" style="margin-top:9px"><span class="cite">${c.fonte}</span></div></div>`).join('');

  tabela('tabela-interno',
    [{ rotulo: 'O que foi contado' }, { rotulo: 'Quanto', num: true },
     { rotulo: 'Período' }, { rotulo: 'De quem é o número' }],
    I.numeros.map((n) => [
      n.rubrica + (n.detalhe ? `<div class="cite" style="white-space:normal">${n.detalhe}</div>` : ''),
      `<b>${n.valor}</b>`, n.periodo, n.fonte]));

  html('fontes-interno').innerHTML = I.fontes.map((f) => `<li>${
    f.autor !== '—' ? `${f.autor}. ` : ''}<i>${f.obra}</i>. ${f.onde}.${
    f.url ? ` <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>` : ''}</li>`).join('');
}


// =====================================================================
//  ABA "O NAVIO"
// =====================================================================
{
  const V = D.navio;
  const cite = (p) => `<span class="cite">Gomes I, p. ${p}</span>`;

  html('epigrafe-navio').innerHTML =
    `<p>“${V.epigrafe.texto}”</p><footer>${V.epigrafe.autor} ${cite(V.epigrafe.pagina)}</footer>`;
  html('nota-cadeia').innerHTML =
    `O navio era “${V.definicao.texto}”, na definição de ${V.definicao.autor} ${cite(V.definicao.pagina)}. ` +
    `Mas ele foi só um trecho do percurso. ${V.cadeia._nota}`;

  // --- Figura I: a cadeia, com as etapas em escala de tempo
  {
    const etapas = V.cadeia.etapas;
    const total = etapas.reduce((t, e) => t + e.meses, 0);
    const W = 990, ESQ = 90, DIR = 130, FAIXA = W - ESQ - DIR;
    const px = (m) => (m / total) * FAIXA;
    const CORES = ['#b8912b', '#c05a1f', '#8c2f2f'];
    let x = ESQ, barras = '', rotulos = '', ticks = '';
    etapas.forEach((e, i) => {
      const w = px(e.meses);
      barras += `<rect x="${x.toFixed(1)}" y="96" width="${w.toFixed(1)}" height="46"
        fill="${CORES[i]}" fill-opacity="0.55" stroke="${CORES[i]}" stroke-width="1"/>`;
      rotulos += `<text class="diag-nome" x="${(x + w / 2).toFixed(1)}" y="84" text-anchor="middle">${e.nome}</text>`;
      rotulos += `<text class="diag-cifra" x="${(x + w / 2).toFixed(1)}" y="128" text-anchor="middle"
        >${e.meses === 1.5 ? '1½' : e.meses} ${e.meses === 1 ? 'mês' : 'meses'}</text>`;
      x += w;
    });
    for (let m = 0; m <= Math.ceil(total); m++) {
      const tx = ESQ + px(m);
      ticks += `<line x1="${tx.toFixed(1)}" y1="142" x2="${tx.toFixed(1)}" y2="${m % 3 === 0 ? 156 : 149}"
        stroke="currentColor" stroke-width="0.8" opacity="0.45"/>`;
      if (m % 3 === 0 && m > 0) ticks += `<text class="diag-fraco" x="${tx.toFixed(1)}" y="172"
        text-anchor="middle">${m} meses</text>`;
    }
    // as cinco transações de compra e venda ao longo do percurso
    let vendas = '';
    for (let i = 0; i < 5; i++) {
      const vx = ESQ + (FAIXA * (i + 0.5)) / 5;
      vendas += `<circle cx="${vx.toFixed(1)}" cy="40" r="7" fill="var(--papel)" stroke="currentColor" stroke-width="1.2"/>`;
      vendas += `<text class="diag-fraco" x="${vx.toFixed(1)}" y="44" text-anchor="middle">${i + 1}</text>`;
      vendas += `<line x1="${vx.toFixed(1)}" y1="48" x2="${vx.toFixed(1)}" y2="60" stroke="currentColor"
        stroke-width="0.8" stroke-dasharray="2 3" opacity="0.5"/>`;
    }
    html('fig-cadeia').innerHTML = `
      <svg viewBox="0 0 ${W} 200" role="img"
        aria-label="Linha do tempo do cativeiro: seis meses de marcha até o litoral, cinco meses no barracão do porto e um mês e meio de travessia do Atlântico, somando quase um ano.">
        <text class="diag-rot" x="10" y="44">até 5 vendas</text>
        ${vendas}
        <text class="diag-nome" x="10" y="124" text-anchor="start">Captura</text>
        <line x1="76" y1="96" x2="76" y2="142" stroke="currentColor" stroke-width="1.4"/>
        ${barras}${ticks}${rotulos}
        <line x1="${(W - DIR + 4)}" y1="96" x2="${(W - DIR + 4)}" y2="142" stroke="currentColor" stroke-width="1.4"/>
        <text class="diag-fraco" x="${W - DIR + 10}" y="116">venda</text>
        <text class="diag-fraco" x="${W - DIR + 10}" y="130">no Brasil</text>
      </svg>
      <figcaption>A travessia do Atlântico ocupa quase toda a imagem que se faz do tráfico e foi a etapa
      mais curta: um mês e meio contra os onze anteriores. Ao pisar na fazenda, a pessoa tinha quase um ano
      de cativeiro e já havia sido comprada e vendida até cinco vezes. ${cite('222-223')}</figcaption>`;
  }

  // --- Figura II: corte esquemático do navio
  html('fig-corte').innerHTML = `
    <svg viewBox="0 0 900 400" role="img"
      aria-label="Corte esquemático de um navio negreiro: convés dividido ao meio por uma barricada, porão dos homens à ré e porão das mulheres à proa, junto aos alojamentos da tripulação.">
      <path d="M 70,140 H 830 L 800,300 Q 450,335 100,300 Z"
        fill="var(--terra)" fill-opacity="0.35" stroke="currentColor" stroke-width="1.6"/>
      <line x1="70" y1="196" x2="830" y2="196" stroke="currentColor" stroke-width="1.2"/>
      <line x1="250" y1="140" x2="250" y2="46" stroke="currentColor" stroke-width="2"/>
      <line x1="620" y1="140" x2="620" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="190" y1="70" x2="310" y2="70" stroke="currentColor" stroke-width="1.2"/>
      <line x1="556" y1="58" x2="684" y2="58" stroke="currentColor" stroke-width="1.2"/>

      <rect x="432" y="104" width="16" height="92" fill="#8c2f2f" fill-opacity="0.5"
        stroke="#8c2f2f" stroke-width="1.4"/>
      <circle cx="440" cy="124" r="2.6" fill="var(--papel)"/>
      <circle cx="440" cy="146" r="2.6" fill="var(--papel)"/>
      <circle cx="440" cy="168" r="2.6" fill="var(--papel)"/>

      <rect x="105" y="206" width="320" height="84" fill="#4b3f9e" fill-opacity="0.22"/>
      <line x1="105" y1="234" x2="425" y2="234" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
      <line x1="108" y1="262" x2="422" y2="262" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
      <rect x="455" y="206" width="300" height="84" fill="#8a3f8c" fill-opacity="0.22"/>
      <line x1="455" y1="234" x2="755" y2="234" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
      <line x1="458" y1="262" x2="752" y2="262" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
      <rect x="700" y="150" width="120" height="44" fill="#b8912b" fill-opacity="0.3"/>

      <text class="diag-nome" x="265" y="253" text-anchor="middle">porão dos homens</text>
      <text class="diag-fraco" x="265" y="273" text-anchor="middle">à ré, o mais distante da tripulação</text>
      <text class="diag-nome" x="605" y="253" text-anchor="middle">porão das mulheres</text>
      <text class="diag-fraco" x="605" y="273" text-anchor="middle">à proa, do lado dos marinheiros</text>
      <text class="diag-rot" x="760" y="177" text-anchor="middle">tripulação</text>

      <text class="diag-rot" x="440" y="96" text-anchor="middle">barricada</text>
      <line x1="440" y1="100" x2="440" y2="104" stroke="currentColor" stroke-width="1"/>
      <line x1="440" y1="300" x2="440" y2="322" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 3"/>
      <text class="diag-fraco" x="440" y="338" text-anchor="middle">tábuas transversais com furos para atirar sobre o convés</text>

      <text class="diag-fraco" x="105" y="190" text-anchor="start">convés</text>
      <line x1="220" y1="292" x2="220" y2="356" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 3"/>
      <text class="diag-fraco" x="234" y="372" text-anchor="start">prateleiras de madeira: impossível ficar de pé</text>
    </svg>
    <figcaption>Esquema, não a planta de um navio real. O que a disposição mostra: a barricada no meio do
    convés era uma trincheira contra os cativos, e o porão das mulheres ficava do lado dos alojamentos da
    tripulação — o que as deixava sem ninguém que pudesse defendê-las. Nos porões, prateleiras de madeira
    baixas demais para ficar de pé: passava-se a travessia deitado, acorrentado aos pares, perna com perna
    e mão com mão. ${cite('228-232')}</figcaption>`;

  html('cartoes-cadeia').innerHTML = V.cadeia.etapas.map((e) => `<div class="cartao">
    <h3>${e.nome}</h3><div class="miudo" style="margin-top:10px">${e.detalhe} ${cite(e.pagina)}</div></div>`).join('');

  html('cartoes-navio').innerHTML = V.cartas.map((n) => `<div class="cartao">
    <h3>${n.titulo}</h3><div class="grande" style="font-size:23px">${n.cifra}</div>
    <div class="miudo" style="margin-top:8px">${n.texto} ${cite(n.pagina)}</div></div>`).join('');

  html('cartoes-tripulacao').innerHTML = V.tripulacao.map((t) => `<div class="cartao">
    <h3>${t.cargo}</h3>
    ${t.pago ? `<div class="grande" style="font-size:20px">${t.pago}</div>` : ''}
    ${t.hoje ? `<div class="miudo">${t.hoje}</div>` : ''}
    <div class="miudo" style="margin-top:8px">${t.texto} ${cite(t.pagina)}</div></div>`).join('');

  html('marinheiros-cativos').innerHTML =
    `<b>Escravizados na tripulação — ${V.marinheiros_cativos.cifra}.</b> ` +
    `${V.marinheiros_cativos.texto} ${cite(V.marinheiros_cativos.pagina)}`;

  tabela('tabela-navios', [{ rotulo: 'Navio' }, { rotulo: 'Quando' }, { rotulo: 'O que se sabe dele' }, { rotulo: '' }],
    V.navios.map((n) => [
      `<b style="${n.grave ? 'color:var(--sangue)' : ''}">${n.nome}</b>`,
      n.ano, n.fato, cite(n.pagina)]));

  html('lei-1684').innerHTML = `<b>${V.lei1684.titulo}.</b> ${V.lei1684.texto} ${cite(V.lei1684.pagina)}`;
}


// ===========================================================================
//  VOLUME II — "O Ouro", a Costa da Mina e a abolição
// ===========================================================================
const cII = (p) => `<span class="cite">Gomes II, p. ${p}</span>`;
const cartaoSimples = (t, corpo, pag) =>
  `<div class="cartao"><h3>${t}</h3><p class="miudo" style="margin-top:8px">${corpo}${pag ? ' ' + cII(pag) : ''}</p></div>`;
const bloco = (id, titulo, corpo, pag) => {
  const n = html(id); if (!n) return;
  n.innerHTML = `<b>${titulo}.</b> ${corpo}${pag ? ' ' + cII(pag) : ''}`;
};
const epig = (id, e) => {
  const n = html(id); if (!n || !e) return;
  n.innerHTML = `<p>“${e.texto}”</p><footer>${e.credito}${e.pagina ? ' — ' + cII(e.pagina) : ''}</footer>`;
};

// --- Carta VI: o Brasil do ouro -------------------------------------------
let ouroMontado = false;
function montarOuro() {
  if (ouroMontado) return;
  ouroMontado = true;
  const O = D.ouro, C = O.carta;

  epig('epigrafe-ouro', O.epigrafe);
  html('abertura-ouro').innerHTML = O.abertura;
  html('titulo-carta-ouro').textContent = C.titulo;
  html('intro-carta-ouro').innerHTML = C.intro;

  // Escala própria: este recorte tem 29 graus de largura; a 10 px/grau do
  // Atlântico inteiro a moldura sairia com 290 px e a letra, gigante.
  const KO = 26;
  const projO = (lon, lat) => [(lon - LON_MIN) * KO, (mercY(lat) - Y0) * KO];
  const caminhoO = (anel) => {
    let d = '';
    for (let i = 0; i < anel.length; i++) {
      const [x, y] = projO(anel[i][0], anel[i][1]);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  };

  const LUG = {};
  for (const l of C.lugares) LUG[l.id] = l;

  const svgO = html('mapa-ouro');
  const [bx0] = projO(-62.5, 0), [bx1] = projO(-32.5, 0);
  const [, by0] = projO(0, 1.5), [, by1] = projO(0, -26.5);
  svgO.setAttribute('viewBox', `${bx0.toFixed(0)} ${by0.toFixed(0)} ${(bx1 - bx0).toFixed(0)} ${(by1 - by0).toFixed(0)}`);
  svgO.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  el('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, fill: 'var(--mar)' }, svgO);
  const gTo = el('g', { class: 'terra' }, svgO);
  for (const anel of D.geo.litoral) el('path', { d: caminhoO(anel) }, gTo);
  const gDist = el('g', null, svgO);   // cerca do Distrito
  const gRo = el('g', null, svgO);     // rotas
  const gPo = el('g', null, svgO);     // pontos
  const gLLo = el('g', null, svgO);    // fios de chamada
  const gLo = el('g', null, svgO);     // rótulos
  const gEo = el('g', null, svgO);     // legenda

  const dicaO = html('dica-ouro'), palcoO = html('palco-ouro');
  palcoO.addEventListener('pointerleave', () => dicaO.classList.remove('visivel'));
  const mostrarO = (e, conteudo) => {
    dicaO.innerHTML = conteudo;
    dicaO.classList.add('visivel');
    const cx = palcoO.getBoundingClientRect();
    let px = e.clientX - cx.left + 16, py = e.clientY - cx.top + 16;
    if (px + dicaO.offsetWidth > cx.width - 8) px = e.clientX - cx.left - dicaO.offsetWidth - 16;
    if (py + dicaO.offsetHeight > cx.height - 8) py = Math.max(8, e.clientY - cx.top - dicaO.offsetHeight - 16);
    dicaO.style.left = px + 'px'; dicaO.style.top = py + 'px';
  };

  const TRACO_O = {
    terra: { cor: '#7a5a2e', dash: '9 6' },
    rio:   { cor: '#3f6a72', dash: '2 6' },
    mar:   { cor: '#22525c', dash: null },
  };
  const ESP_O = { 1: 2.2, 2: 3.6, 3: 5.4 };

  // A cabotagem não corta o continente: desce colada à costa.
  const COSTA_O = [
    [-34.5, -8.6], [-35.4, -9.8], [-36.7, -10.9], [-37.7, -11.9], [-38.2, -12.8],
    [-38.4, -14.4], [-38.7, -16.0], [-39.1, -17.6], [-39.6, -19.2], [-40.4, -21.0],
    [-41.6, -22.5], [-42.7, -23.3],
  ];
  const laneMar = (a, b) => {
    // Escolhe o trecho da linha d'água entre as latitudes dos dois portos.
    const la = a[1], lb = b[1];
    const lo = Math.min(la, lb), hi = Math.max(la, lb);
    let mid = COSTA_O.filter((p) => p[1] < hi && p[1] > lo);
    if (la > lb) mid = mid.slice(); else mid.reverse();
    return [a, ...mid, b];
  };

  // Catmull-Rom convertido em Bézier cúbica: a curva PASSA por todos os
  // pontos. Importa porque cada ponto é um lugar real — Juazeiro, Camapuã,
  // Santarém —, e uma curva que corta o canto mentiria sobre o traçado.
  const suaveO = (pts) => {
    const P = pts.map(([lo, la]) => projO(lo, la));
    if (P.length < 2) return '';
    if (P.length === 2) return `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}L${P[1][0].toFixed(1)},${P[1][1].toFixed(1)}`;
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };

  // Arco simples entre dois pontos, com a barriga voltada para o lado indicado.
  const arcoO = (a, b, curva) => {
    const [x1, y1] = projO(a[0], a[1]), [x2, y2] = projO(b[0], b[1]);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const cx = mx + (-dy / L) * L * curva, cy = my + (dx / L) * L * curva;
    return `M${x1.toFixed(1)},${y1.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };

  // --- cerca do Distrito Diamantino
  const dist = C.distrito;
  {
    const [cx, cy] = projO(dist.centro[0], dist.centro[1]);
    const [rx1] = projO(dist.centro[0] + dist.raio_lon, dist.centro[1]);
    const [, ry1] = projO(dist.centro[0], dist.centro[1] + dist.raio_lat);
    const e2 = el('ellipse', {
      cx, cy, rx: Math.abs(rx1 - cx), ry: Math.abs(ry1 - cy),
      fill: 'rgba(140,59,47,.09)', stroke: '#8c3b2f', 'stroke-width': 1.6,
      'stroke-dasharray': '4 3', class: 'camada-distrito',
    }, gDist);
    e2.style.cursor = 'help';
    e2.addEventListener('pointermove', (ev) => mostrarO(ev,
      `<b>${dist.titulo}</b><div class="miudo" style="margin-top:6px">${dist.nota_medida}</div>`));
  }

  // --- rotas
  const camadas = { terra: true, rio: true, mar: true, distrito: true, quilombos: true };
  const desenharRotasOuro = () => {
    limpar(gRo);
    for (const r of C.rotas) {
      if (!camadas[r.meio]) continue;
      const a = LUG[r.de], b = LUG[r.para];
      if (!a || !b) continue;
      const T = TRACO_O[r.meio];
      let d;
      if (r.meio === 'mar') {
        d = suaveO(laneMar([a.lon, a.lat], [b.lon, b.lat]));
      } else if (r.por && r.por.length) {
        d = suaveO([[a.lon, a.lat], ...r.por.map((id) => [LUG[id].lon, LUG[id].lat]), [b.lon, b.lat]]);
      } else {
        d = arcoO([a.lon, a.lat], [b.lon, b.lat], r.meio === 'rio' ? 0.13 : -0.09);
      }
      const halo = el('path', { d, fill: 'none', stroke: 'var(--papel)', 'stroke-width': ESP_O[r.peso] + 3,
        'stroke-linecap': 'round', opacity: .55 }, gRo);
      const p = el('path', { d, fill: 'none', stroke: T.cor, 'stroke-width': ESP_O[r.peso],
        'stroke-linecap': 'round', opacity: .9 }, gRo);
      if (T.dash) p.setAttribute('stroke-dasharray', T.dash);
      p.style.cursor = 'help';
      const dica = `<b>${r.nome}</b><div class="miudo" style="margin-top:6px">${r.texto}</div>` +
        `<div class="miudo" style="margin-top:8px">${LUG[r.de].nome} → ${LUG[r.para].nome} ${cII(r.pagina)}</div>`;
      for (const n of [halo, p]) n.addEventListener('pointermove', (ev) => mostrarO(ev, dica));
    }
  };

  // --- pontos e rótulos
  const RAIO = { 1: 3.0, 2: 4.4, 3: 6.2 };
  const desenharPontosOuro = () => {
    limpar(gPo); limpar(gLo); limpar(gLLo);
    const caixas = [];
    const visiveis = C.lugares.filter((l) => !l.invisivel && (l.quilombo ? camadas.quilombos : true));
    for (const l of visiveis) {
      const [x, y] = projO(l.lon, l.lat);
      const cor = l.quilombo ? '#4f7a4a' : '#8a2f22';
      const c = el('circle', { cx: x, cy: y, r: RAIO[l.peso], fill: cor,
        stroke: 'var(--papel)', 'stroke-width': 1.3 }, gPo);
      if (l.quilombo) c.setAttribute('stroke-dasharray', '2 1.6');
      c.style.cursor = 'help';
      c.addEventListener('pointermove', (ev) => mostrarO(ev,
        `<b>${l.nome}</b><div class="miudo" style="margin-top:6px">${l.nota}</div>`));
    }
    // Rótulos: tenta oito posições, esconde o que não couber, e puxa um fio
    // quando o rótulo teve de ir longe do ponto.
    const OFF = [[9, 4], [-9, 4], [9, -6], [-9, -6], [0, -11], [0, 15], [16, 12], [-16, 12]];
    for (const l of [...visiveis].sort((a, b) => b.peso - a.peso)) {
      const [x, y] = projO(l.lon, l.lat);
      let posto = false;
      for (let i = 0; i < OFF.length && !posto; i++) {
        const [dx, dy] = OFF[i];
        const t = texto(l.nome, {
          x: x + dx, y: y + dy, class: 'rotulo',
          'text-anchor': dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle',
          'font-size': l.peso >= 3 ? 12 : 10.5,
          'font-weight': l.peso >= 3 ? 600 : 400,
          fill: l.quilombo ? '#3d5f39' : 'var(--tinta)',
        }, gLo);
        let bb;
        try { bb = t.getBBox(); } catch (e) { bb = null; }
        if (!bb) { posto = true; break; }
        const choca = caixas.some((k) => !(bb.x > k.x + k.width + 1.5 || bb.x + bb.width + 1.5 < k.x ||
          bb.y > k.y + k.height + 1.5 || bb.y + bb.height + 1.5 < k.y));
        if (choca) { gLo.removeChild(t); continue; }
        caixas.push(bb); posto = true;
        if (i > 1) el('line', { x1: x, y1: y, x2: x + dx * 0.6, y2: y + dy * 0.6,
          stroke: 'var(--tinta-3, #9a8f80)', 'stroke-width': .7, opacity: .65 }, gLLo);
      }
    }
  };

  // --- legenda
  {
    const lx = bx0 + 14, ly = by1 - 118;
    el('rect', { x: lx, y: ly, width: 232, height: 104, fill: 'var(--papel)',
      stroke: 'var(--terra-borda)', 'stroke-width': 1, opacity: .95, rx: 2 }, gEo);
    texto('Legenda', { x: lx + 12, y: ly + 20, class: 'rotulo', 'font-size': 11.5, 'font-weight': 600 }, gEo);
    C.legenda.forEach((L, i) => {
      const yy = ly + 38 + i * 16;
      const ln = el('line', { x1: lx + 12, y1: yy, x2: lx + 36, y2: yy, stroke: L.cor, 'stroke-width': 2.6 }, gEo);
      if (L.dash) ln.setAttribute('stroke-dasharray', L.dash);
      texto(L.rotulo, { x: lx + 43, y: yy + 4, class: 'rotulo', 'font-size': 10 }, gEo);
    });
  }

  // --- fichas de camada
  const CAM = [['terra', 'Estradas'], ['rio', 'Rios e monções'], ['mar', 'Cabotagem'],
    ['quilombos', 'Quilombos'], ['distrito', 'Distrito Diamantino']];
  const fo = html('fichas-ouro');
  const repintarOuro = () => {
    desenharRotasOuro(); desenharPontosOuro();
    gDist.style.display = camadas.distrito ? '' : 'none';
    [...fo.children].forEach((b, i) => b.setAttribute('aria-pressed', String(camadas[CAM[i][0]])));
  };
  for (const [id, rot] of CAM) {
    fo.appendChild(ficha(rot, true, TRACO_O[id] ? TRACO_O[id].cor : (id === 'quilombos' ? '#4f7a4a' : '#8c3b2f'),
      () => { camadas[id] = !camadas[id]; repintarOuro(); }));
  }
  repintarOuro();

  bloco('distrito-ouro', dist.titulo, dist.texto + ' <br><br><i>' + dist.nota_medida + '</i>', dist.pagina);
  html('numeros-ouro').innerHTML = C.numeros.map((n) => `<div class="cartao">
    <div class="grande">${n.cifra}</div>
    <div class="miudo" style="margin-top:6px">${n.texto} ${cII(n.pagina)}</div></div>`).join('');
  html('fontes-ouro').innerHTML = C.fontes.map((f) => `<li>${f}</li>`).join('');

  montarPrecos(O.precos_1703);
  montarTrabalhoOuro(O.trabalho);
  montarViolencia(O.violencia);
  montarAlforria(O.alforria);
  montarFamilia(O.familia);
  montarMulheres(O.mulheres);
  montarChica(O.chica);
  montarQuilombos(O.quilombos);
  montarMedo(O.medo);
  montarIrmandades(O.irmandades);
  html('bibliografia-ouro').innerHTML = O.bibliografia.map((b) => `<li>${b}</li>`).join('');
}

// --- Figura IV: quanto valia uma pessoa, em ouro ---------------------------
function montarPrecos(P) {
  html('titulo-precos').textContent = P.titulo;
  html('intro-precos').innerHTML = P.intro + ' ' + cII(P.pagina);

  const svg = html('fig-precos');
  const W = 720, H = 40 + P.itens.length * 62 + 20;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const x0 = 250, largMax = W - x0 - 90;
  const max = Math.max(...P.itens.map((i) => i.gramas));

  texto(`escala: ${P.unidade}`, { x: x0, y: 20, class: 'rotulo', 'font-size': 11, fill: 'var(--tinta-2)' }, svg);
  P.itens.forEach((it, i) => {
    const y = 42 + i * 62;
    const w = Math.max(2, (it.gramas / max) * largMax);
    texto(it.rotulo, { x: x0 - 14, y: y + 20, class: 'rotulo', 'text-anchor': 'end',
      'font-size': it.destaque ? 14 : 12.5, 'font-weight': it.destaque ? 600 : 400 }, svg);
    el('rect', { x: x0, y, width: w, height: 28, rx: 1.5,
      fill: it.destaque ? '#8a2f22' : '#a8894f' }, svg);
    texto(it.detalhe, { x: x0 + w + 10, y: y + 20, class: 'rotulo', 'font-size': 12,
      fill: 'var(--tinta-2)' }, svg);
  });

  html('equiv-precos').innerHTML = P.equivalencias.slice(0, 2).map((e) => `<li>${e}</li>`).join('');
  const T = P.travessia;
  bloco('travessia-precos', T.titulo, T.texto + `<br><br><i>${T.cautela}</i>`, T.paginas);
}

// --- O trabalho ------------------------------------------------------------
function montarTrabalhoOuro(T) {
  html('titulo-trabalho-ouro').textContent = T.titulo;
  epig('epigrafe-trabalho-ouro', T.epigrafe);
  html('intro-trabalho-ouro').innerHTML = T.intro + ' ' + cII(T.pagina);
  html('cartoes-trabalho-ouro').innerHTML = T.cartoes.map((c) =>
    cartaoSimples(c.titulo, c.texto, c.pagina)).join('');
  bloco('senzala-ouro', T.senzala.titulo, T.senzala.texto, T.senzala.pagina);
  html('titulo-comida').textContent = T.comida.titulo;
  html('intro-comida').innerHTML = T.comida.texto;
  tabela('tabela-comida', [{ rotulo: 'Quem' }, { rotulo: 'O que disse' }, { rotulo: '' }],
    T.comida.vozes.map((v) => [`<b>${v.quem}</b>`, v.diz, cII(v.pagina)]));
  bloco('brecha-ouro', T.brecha.titulo, T.brecha.texto, T.brecha.pagina);
  bloco('latifundio-ouro', T.latifundio.titulo, T.latifundio.texto, T.latifundio.pagina);
}

// --- A violência -----------------------------------------------------------
function montarViolencia(V) {
  html('titulo-violencia').textContent = V.titulo;
  epig('epigrafe-violencia', V.epigrafe);
  html('intro-violencia').innerHTML = V.intro + ' ' + cII(V.pagina);
  html('titulo-limites').textContent = V.limites.titulo;
  tabela('tabela-limites', [{ rotulo: 'Onde está escrito' }, { rotulo: 'Quantos açoites' }, { rotulo: 'Observação' }, { rotulo: '' }],
    V.limites.linhas.map((l) => [l.onde,
      `<b style="${l.grave ? 'color:var(--sangue)' : ''}">${l.quanto}</b>`, l.nota, cII(l.pagina)]));
  bloco('cicatrizante', V.cicatrizante.titulo, V.cicatrizante.texto, V.cicatrizante.pagina);
  bloco('calabouco', V.calabouco.titulo, V.calabouco.texto, V.calabouco.pagina);
  html('titulo-recuos').textContent = V.recuos.titulo;
  tabela('tabela-recuos', [{ rotulo: 'Quando' }, { rotulo: 'O quê' }, { rotulo: '' }],
    V.recuos.linhas.map((l) => [`<b>${l.quando}</b>`,
      `<span style="${l.grave ? 'color:var(--sangue)' : ''}">${l.o_que}</span>`, cII(l.pagina)]));
  html('fecho-recuos').innerHTML = V.recuos.fecho;
  bloco('caso-joaquim', V.joaquim.titulo, V.joaquim.texto, V.joaquim.pagina);
  bloco('caso-torre', V.torre_do_tombo.titulo,
    V.torre_do_tombo.texto + `<br><br><i>${V.torre_do_tombo.aviso}</i>`, V.torre_do_tombo.pagina);
}

// --- Figura V: a alforria --------------------------------------------------
function montarAlforria(A) {
  html('titulo-alforria').textContent = A.titulo;
  html('intro-alforria').innerHTML = A.intro + ' ' + cII(A.pagina);

  const svg = html('fig-alforria');
  const W = 760, H = 260;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const L = A.comparacao.linhas;
  const max = Math.max(...L.flatMap((l) => [l.importou, l.tinha]));
  const x0 = 190, largMax = W - x0 - 170;
  texto('Quantas pessoas foram trazidas da África — e quantas ainda estavam em cativeiro no fim',
    { x: 14, y: 20, class: 'rotulo', 'font-size': 11.5, fill: 'var(--tinta-2)' }, svg);
  L.forEach((l, i) => {
    const yb = 46 + i * 100;
    texto(l.pais, { x: x0 - 14, y: yb + 34, class: 'rotulo', 'text-anchor': 'end',
      'font-size': 15, 'font-weight': 600 }, svg);
    const pares = [
      { v: l.importou, cor: '#8a2f22', rot: 'trazidas da África', det: num(l.importou) },
      { v: l.tinha, cor: '#4a6070', rot: `em cativeiro em ${l.ano}`, det: num(l.tinha) },
    ];
    pares.forEach((p, k) => {
      const y = yb + k * 34;
      const w = Math.max(2, (p.v / max) * largMax);
      el('rect', { x: x0, y, width: w, height: 24, rx: 1.5, fill: p.cor }, svg);
      texto(`${p.det} · ${p.rot}`, { x: x0 + w + 10, y: y + 17, class: 'rotulo',
        'font-size': 11.5, fill: 'var(--tinta-2)' }, svg);
    });
    texto(`alforria: ${l.alforria_ano}  ·  expectativa de vida: ${l.expectativa}`,
      { x: x0, y: yb + 82, class: 'rotulo', 'font-size': 11, fill: 'var(--tinta-2)' }, svg);
  });

  bloco('fecho-alforria', 'O que essas duas barras dizem',
    A.comparacao.fecho, A.comparacao.pagina);

  html('titulo-serie').textContent = A.serie.titulo;
  html('cartoes-serie').innerHTML = A.serie.pontos.map((p) => `<div class="cartao">
    <h3>${p.ano}</h3><div class="grande">${p.rotulo}</div>
    <div class="miudo" style="margin-top:6px">${p.nota} ${cII(A.serie.pagina)}</div></div>`).join('');

  html('titulo-portas').textContent = A.portas.titulo;
  html('cartoes-portas').innerHTML = A.portas.itens.map((p, i) => `<div class="cartao">
    <h3>${i + 1}. ${p.nome}</h3>
    <p class="miudo" style="margin-top:8px">${p.texto}</p></div>`).join('') +
    `<div class="cartao"><h3>Fonte</h3><p class="miudo" style="margin-top:8px">A lista das oito é do próprio livro. ${cII(A.portas.pagina)}</p></div>`;

  tabela('tabela-preco-alforria', [{ rotulo: 'Caso' }, { rotulo: 'Quanto' }, { rotulo: 'Observação' }, { rotulo: '' }],
    A.preco.linhas.map((l) => [l.caso, `<b>${l.valor}</b>`, l.nota, cII(l.pagina)]));

  bloco('circularidade', A.circularidade.titulo, A.circularidade.texto, A.circularidade.pagina);
  bloco('ingratidao', A.ingratidao.titulo, A.ingratidao.texto, A.ingratidao.pagina);
  bloco('joana', A.joana.titulo, A.joana.texto + `<br><br><i>${A.joana.credito}</i>`, A.joana.pagina);

  html('titulo-minas-alforria').textContent = A.minas.titulo;
  tabela('tabela-minas-alforria', [{ rotulo: 'Quando' }, { rotulo: 'O quê' }, { rotulo: '' }],
    A.minas.linhas.map((l) => [`<b>${l.quando}</b>`, l.o_que, cII(l.pagina)]));

  bloco('quem-alforria', A.quem.titulo, A.quem.texto, A.quem.pagina);
  bloco('leitura-alforria', A.leitura.titulo, A.leitura.texto, A.leitura.pagina);
}

// --- A família escrava -----------------------------------------------------
function montarFamilia(F) {
  html('titulo-familia').textContent = F.titulo;
  html('intro-familia').innerHTML = F.intro + ' ' + cII(F.pagina);
  html('titulo-familia-antes').textContent = F.antes.titulo;
  tabela('tabela-familia-antes', [{ rotulo: 'Quem' }, { rotulo: 'O que disse' }, { rotulo: '' }],
    F.antes.vozes.map((v) => [`<b>${v.quem}</b>`, v.diz, cII(v.pagina)]));
  html('titulo-familia-numeros').textContent = F.numeros.titulo;
  tabela('tabela-familia-numeros', [{ rotulo: 'Onde' }, { rotulo: 'Quanto', num: true }, { rotulo: 'O quê' }, { rotulo: '' }],
    F.numeros.linhas.map((l) => [l.onde, `<b>${l.quanto}</b>`, l.o_que, cII(l.pagina)]));
  bloco('paz-senzala', F.paz.titulo, F.paz.texto, F.paz.pagina);
  bloco('estrategia-familia', F.estrategia.titulo, F.estrategia.texto, F.estrategia.pagina);
  bloco('assumar', F.assumar.titulo, F.assumar.texto, F.assumar.pagina);
  bloco('cla-sjdr', F['clã'].titulo, F['clã'].texto, F['clã'].pagina);
}

// --- As mulheres -----------------------------------------------------------
function montarMulheres(M) {
  html('titulo-mulheres').textContent = M.titulo;
  epig('epigrafe-mulheres', M.epigrafe);
  html('intro-mulheres').innerHTML = M.intro + ' ' + cII(M.pagina);
  bloco('oficios-mulheres', M.oficios.titulo, M.oficios.texto, M.oficios.pagina);
  html('titulo-roupa').textContent = M.roupa.titulo;
  html('intro-roupa').innerHTML = M.roupa.intro;
  tabela('tabela-roupa', [{ rotulo: 'Ano' }, { rotulo: 'O que se decidiu' }, { rotulo: '' }],
    M.roupa.linhas.map((l) => [`<b>${l.ano}</b>`,
      `<span style="${l.grave ? 'color:var(--sangue)' : ''}">${l.o_que}</span>`, cII(l.pagina)]));
  bloco('serro-mulheres', M.serro.titulo, M.serro.texto, M.serro.pagina);
  bloco('falta-mulheres', M.falta.titulo, M.falta.texto, M.falta.pagina);
  html('titulo-rainhas').textContent = M.rainhas.titulo;
  html('cartoes-rainhas').innerHTML = M.rainhas.cartoes.map((c) =>
    cartaoSimples(c.titulo, c.texto, c.pagina)).join('');
  tabela('tabela-citacoes-mulheres', [{ rotulo: 'Quem' }, { rotulo: 'O que escreveu' }, { rotulo: '' }],
    M.citacoes.map((c) => [`<b>${c.quem}</b>`, c.diz, cII(c.pagina)]));
}

// --- Chica da Silva --------------------------------------------------------
function montarChica(C) {
  html('titulo-chica').textContent = C.titulo;
  html('intro-chica').innerHTML = C.intro + ' ' + cII(C.pagina);
  tabela('tabela-chica', [{ rotulo: 'O que se conta' }, { rotulo: 'O que a documentação mostra' }, { rotulo: '' }],
    C.desmontes.map((d) => [d.lenda, d.documento, cII(d.pagina)]));
  html('credito-chica').innerHTML = C.credito;
  html('vida-chica').innerHTML = C.vida.map((v) =>
    `<li><b>${v.quando}</b>${v.o_que} ${cII(v.pagina)}</li>`).join('');
  bloco('simao', C.simao.titulo, C.simao.texto, C.simao.pagina);
  html('titulo-diamantes').textContent = C.distrito.titulo;
  tabela('tabela-diamantes', [{ rotulo: 'O quê' }, { rotulo: 'Quanto', num: true }, { rotulo: 'Observação' }, { rotulo: '' }],
    C.distrito.linhas.map((l) => [l.o_que, `<b>${l.quanto}</b>`, l.nota || '', cII(l.pagina)]));
  bloco('tijuco', C.tijuco.titulo, C.tijuco.texto, C.tijuco.pagina);
}

// --- Os quilombos ----------------------------------------------------------
function montarQuilombos(Q) {
  html('titulo-quilombos').textContent = Q.titulo;
  epig('epigrafe-quilombos', Q.epigrafe);
  html('intro-quilombos').innerHTML = Q.intro + ' ' + cII(Q.pagina);
  bloco('penas-quilombos', Q.penas.titulo, Q.penas.texto, Q.penas.pagina);
  tabela('tabela-penas-comp', [{ rotulo: 'Onde' }, { rotulo: 'A pena pela fuga' }],
    Q.penas.comparacao.map((c) => [`<b>${c.onde}</b>`, c.pena]));
  html('titulo-recusas').textContent = Q.penas.recusas.titulo;
  tabela('tabela-recusas', [{ rotulo: 'Quando' }, { rotulo: 'Quem propôs' }, { rotulo: 'O quê, e por que não passou' }, { rotulo: '' }],
    Q.penas.recusas.itens.map((r) => [`<b>${r.quando}</b>`, r.quem, r.o_que, cII(r.pagina)]));
  bloco('orelhas', Q.orelhas.titulo, Q.orelhas.texto, Q.orelhas.pagina);

  const K = Q.capitao_do_mato;
  html('titulo-capitao').textContent = K.titulo;
  html('intro-capitao').innerHTML = K.intro + ' ' + cII(K.pagina);
  tabela('tabela-capitao', [{ rotulo: 'Caso' }, { rotulo: 'Recompensa em ouro' }, { rotulo: 'Em reais de 2021', num: true }, { rotulo: 'Observação' }],
    K.linhas.map((l) => [l.caso,
      `<b style="${l.grave ? 'color:var(--sangue)' : ''}">${l.ouro}</b>`, l.hoje, l.nota || '']));
  tabela('tabela-premios', [{ rotulo: 'Quando' }, { rotulo: 'Quem' }, { rotulo: 'Quanto' }, { rotulo: '' }],
    K.premios.map((p) => [`<b>${p.quando}</b>`, p.quem, p.quanto, cII(p.pagina)]));
  bloco('cacadores', K.escravos_cacadores.titulo, K.escravos_cacadores.texto, K.escravos_cacadores.pagina);

  html('titulo-mapa-quilombos').textContent = Q.mapa_quilombos.titulo;
  tabela('tabela-mapa-quilombos', [{ rotulo: 'Onde e quando' }, { rotulo: 'O que se sabe' }, { rotulo: '' }],
    Q.mapa_quilombos.linhas.map((l) => [`<b>${l.onde}</b>`, l.quanto, cII(l.pagina)]));

  const T = Q.tratado;
  bloco('tratado-santana', T.titulo, T.texto +
    '<br><br><b>O que pediam:</b><ul style="margin:8px 0 0;padding-left:20px">' +
    T.pediam.map((p) => `<li>${p}</li>`).join('') + '</ul>' +
    `<br><b>O que não pediam.</b> ${T.nao_pediam}<br><br><b>O desfecho.</b> ${T.desfecho}`, T.pagina);
  bloco('anistia', Q.anistia.titulo, Q.anistia.texto, Q.anistia.pagina);
  bloco('economia-quilombos', Q.economia.titulo, Q.economia.texto, Q.economia.pagina);
  bloco('oitizeiro', Q.oitizeiro.titulo, Q.oitizeiro.texto, Q.oitizeiro.pagina);
  bloco('ramos', Q.ramos.titulo, Q.ramos.texto, Q.ramos.pagina);
  bloco('quilombos-hoje', Q.hoje.titulo, Q.hoje.texto, Q.hoje.pagina);
}

// --- O medo ----------------------------------------------------------------
function montarMedo(M) {
  html('titulo-medo').textContent = M.titulo;
  epig('epigrafe-medo', M.epigrafe);
  html('intro-medo').innerHTML = M.intro + ' ' + cII(M.pagina);

  const H = M.haiti;
  html('titulo-haiti').textContent = H.titulo;
  html('numeros-haiti').innerHTML = H.numeros.map((n) => `<div class="cartao">
    <div class="grande">${n.cifra}</div>
    <div class="miudo" style="margin-top:6px">${n.texto}</div></div>`).join('');
  html('texto-haiti').innerHTML = H.texto;
  bloco('raynal', H.livro.titulo, H.livro.texto, H.livro.pagina);
  bloco('toussaint', H.abolicao_que_nao_aboliu.titulo, H.abolicao_que_nao_aboliu.texto, H.abolicao_que_nao_aboliu.pagina);
  bloco('conta-haiti', H.conta.titulo, H.conta.texto, H.conta.pagina);
  bloco('lucro-haiti', M.lucro.titulo, M.lucro.texto, M.lucro.pagina);
  bloco('babel', M.babel.titulo, M.babel.texto, M.babel.pagina);

  const A = M.alfaiates;
  html('titulo-alfaiates').textContent = A.titulo;
  html('texto-alfaiates').innerHTML = A.texto + ' ' + cII(A.pagina);
  html('definicao-revolucao').innerHTML =
    `<p>${A.definicao.diz}</p><footer>${A.definicao.quem}</footer>`;
  html('desfecho-alfaiates').innerHTML = A.desfecho;
  bloco('nota-barata', 'Uma nota final', A.nota_final);

  const I = M.inconfidencia;
  html('titulo-inconfidencia').textContent = I.titulo;
  html('texto-inconfidencia').innerHTML = I.texto + ' ' + cII(I.pagina);
  bloco('impasse', I.impasse.titulo, I.impasse.texto);
  html('titulo-donos').textContent = I.donos.titulo;
  tabela('tabela-donos', [{ rotulo: 'Inconfidente' }, { rotulo: 'Quantos cativos' }, { rotulo: 'O que mais se sabe' }],
    I.donos.linhas.map((l) => [`<b>${l.quem}</b>`, l.quantos, l.nota]));
  html('maxwell').innerHTML = I.donos.maxwell;
  bloco('pena-cor', I.pena.titulo, I.pena.texto, I.pena.pagina);
  bloco('fundadores', I.fundadores.titulo, I.fundadores.texto, I.fundadores.pagina);
}

// --- As irmandades ---------------------------------------------------------
function montarIrmandades(R) {
  html('titulo-irmandades').textContent = R.titulo;
  html('intro-irmandades').innerHTML = R.intro + ' ' + cII(R.pagina);
  html('funcoes-irmandades').innerHTML = R.o_que_faziam.map((f) => `<li>${f}</li>`).join('');
  tabela('tabela-irmandades', [{ rotulo: 'O quê' }, { rotulo: 'Quando / quanto' }, { rotulo: 'Observação' }, { rotulo: '' }],
    R.numeros.map((n) => [`<b>${n.o_que}</b>`, n.quando, n.nota, cII(n.pagina)]));
  html('titulo-controle').textContent = R.controle.titulo;
  tabela('tabela-controle', [{ rotulo: 'Quando' }, { rotulo: 'O quê' }, { rotulo: '' }],
    R.controle.linhas.map((l) => [`<b>${l.quando}</b>`, l.o_que, cII(l.pagina)]));
  bloco('capelas', R.capelas.titulo, R.capelas.texto + `<br><br><i>${R.capelas.credito}</i>`, R.capelas.pagina);
  bloco('reis-negros', R.reis.titulo,
    R.reis.texto + `<br><br><b>A reação.</b> ${R.reis.reacao} ${cII(R.reis.pagina_reacao)}`, R.reis.pagina);
  const S = R.santos;
  html('titulo-santos').textContent = S.titulo;
  html('intro-santos').innerHTML = S.intro + ' ' + cII(S.pagina);
  tabela('tabela-santos', [{ rotulo: 'Santo católico' }, { rotulo: 'Divindade africana' }, { rotulo: 'Quem era' }],
    S.pares.map((p) => [`<b>${p.santo}</b>`, p.orixa, p.nota]));
  bloco('efigenia', S.efigenia.titulo, S.efigenia.texto + `<br><br><i>${S.efigenia.cautela}</i>`, S.efigenia.pagina);
  bloco('mural', S.mural.titulo, S.mural.texto, S.mural.pagina);
  bloco('chico-rei', S.chico_rei.titulo,
    S.chico_rei.texto + `<br><br>${S.chico_rei.eco}`, S.chico_rei.pagina);
}

// --- A Costa da Mina (aba As Origens) --------------------------------------
let costaMontada = false;
function montarCostaMina() {
  if (costaMontada) return;
  costaMontada = true;
  const C = D.costa;
  html('titulo-costa').textContent = C.titulo;
  html('intro-costa').innerHTML = C.intro;
  bloco('geologia-costa', C.geologia.titulo, C.geologia.texto, C.geologia.pagina);

  html('titulo-moeda').textContent = C.moeda.titulo;
  html('intro-moeda').innerHTML = C.moeda.intro + ' ' + cII(C.moeda.pagina);
  tabela('tabela-cauris', [{ rotulo: 'O quê' }, { rotulo: 'Em cauris', num: true }],
    C.moeda.linhas.map((l) => [l.item, `<b>${l.cauris}</b>`]));
  bloco('cesta-costa', C.moeda.cesta.titulo,
    C.moeda.cesta.texto + `<br><br><b>Onde a conta não fecha.</b> ${C.moeda.cesta.divergencia}`, C.moeda.cesta.pagina);

  const A = C.ajuda;
  html('titulo-ajuda').textContent = A.titulo;
  html('texto-ajuda').innerHTML = A.texto + ' ' + cII(A.pagina);
  bloco('como-ajuda', 'Como um reino minúsculo exportava tanto', A.como);
  bloco('fome-ajuda', 'A fome como fornecedora', A.fome);
  bloco('fortes-ajuda', A.fortes.titulo, A.fortes.texto, A.fortes.pagina);
  bloco('polvora-ajuda', 'O monopólio da pólvora', A.polvora);

  const F = C.fumo;
  html('titulo-fumo').textContent = F.titulo;
  html('texto-fumo').innerHTML = F.texto + ' ' + cII(F.pagina);
  epig('instrucao-fumo', F.instrucao);

  const M = C.marcas;
  html('titulo-marcas').textContent = M.titulo;
  html('intro-marcas').innerHTML = M.intro + ' ' + cII(M.pagina);
  tabela('tabela-marcas', [{ rotulo: 'Povo' }, { rotulo: 'A marca' }, { rotulo: 'O que os traficantes diziam' }],
    M.linhas.map((l) => [`<b>${l.povo}</b>`, l.marca, l.reputacao]));

  const G = C.agaja;
  html('titulo-agaja').textContent = G.titulo;
  html('texto-agaja').innerHTML = G.texto + ' ' + cII(G.pagina);
  bloco('forca-agaja', 'Pequeno e melhor armado', G.forca);
  bloco('polvora-agaja', 'O que o rei não sabia fabricar', G.polvora);
  bloco('law-agaja', G.law.titulo, G.law.texto, G.law.pagina);
  bloco('alibi-agaja', G.alibi.titulo, G.alibi.texto, G.alibi.pagina);
  bloco('lambe', G.lambe.titulo, G.lambe.texto, G.lambe.pagina);
  html('escala-agaja').innerHTML = G.escala;

  const P = C.paradoxo;
  html('titulo-paradoxo').textContent = P.titulo;
  html('texto-paradoxo').innerHTML = P.texto + ' ' + cII(P.pagina);
  epig('galveias', P.galveias);
  bloco('cartel', P.cartel.titulo, P.cartel.texto, P.cartel.pagina);

  const E = C.embaixadas;
  html('titulo-embaixadas').textContent = E.titulo;
  html('intro-embaixadas').innerHTML = E.intro + ' ' + cII(E.pagina);
  const S = E.salvador1750;
  html('titulo-salvador1750').textContent = S.titulo;
  html('texto-salvador1750').innerHTML = S.texto;
  bloco('presentes-1750', 'Os presentes', S.presentes);
  bloco('volta-1750', 'A viagem de volta', S.volta);
  html('sweet').innerHTML = `<p>${S.sweet.replace(/^James H\. Sweet: /, '')}</p><footer>James H. Sweet, historiador</footer>`;
  const K = E.cartas;
  html('titulo-cartas').textContent = K.titulo;
  epig('epigrafe-adandozan', K.epigrafe);
  html('texto-cartas').innerHTML = K.texto + ' ' + cII(K.pagina);
  bloco('carta1810', K.carta1810.titulo,
    K.carta1810.texto + `<br><br>${K.carta1810.trono}`, K.carta1810.pagina);

  const J = C.oliveira;
  html('titulo-oliveira').textContent = J.titulo;
  html('texto-oliveira').innerHTML = J.texto + ' ' + cII(J.pagina);
  html('verger-oliveira').innerHTML =
    `<p>${J.verger.replace(/^Pierre Verger: /, '')}</p><footer>Pierre Verger</footer>`;
  bloco('portos-oliveira', 'Os dois portos que ele fundou', J.portos);
  bloco('prisao-oliveira', 'A prisão, e o abaixo-assinado dos negreiros', J.prisao);
  html('titulo-economia-portos').textContent = J.economia.titulo;
  tabela('tabela-portos', [{ rotulo: 'Critério' }, { rotulo: 'Ajudá' }, { rotulo: 'Porto Novo' }],
    J.economia.linhas.map((l) => [l.criterio, l.ajuda, `<b>${l.porto_novo}</b>`]));
  html('credito-portos').innerHTML = J.economia.credito + ' ' + cII(J.economia.pagina);
  bloco('protecao-oio', 'A “cabaça” de Oió', J.economia.protecao);
  bloco('tripulacao-cativa', C.tripulacao.titulo, C.tripulacao.texto, C.tripulacao.pagina);
}

// --- O Brookes, o Zong e a abolição (aba O Navio) ---------------------------
let abolMontada = false;
function montarAbolicao() {
  if (abolMontada) return;
  abolMontada = true;
  const A = D.abolicao, B = A.brookes;

  html('titulo-brookes').textContent = B.titulo;
  html('intro-brookes').innerHTML = B.intro + ' ' + cII(B.pagina);

  // Desenho em escala: 90 px por metro.
  const svg = html('fig-brookes');
  const PX = 90, W = 700, H = 350;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  texto('Cada retângulo é o espaço, em escala, reservado a uma pessoa durante os quarenta dias de travessia.',
    { x: 14, y: 20, class: 'rotulo', 'font-size': 11.5, fill: 'var(--tinta-2)' }, svg);
  let cx = 30;
  B.medidas.forEach((m) => {
    const w = m.compr_m * PX, h = m.larg_m * PX;
    el('rect', { x: cx, y: 56, width: w, height: h, fill: 'rgba(138,47,34,.14)',
      stroke: '#8a2f22', 'stroke-width': 1.6 }, svg);
    texto(m.quem, { x: cx, y: 46, class: 'rotulo', 'font-size': 12.5, 'font-weight': 600 }, svg);
    texto(m.rotulo, { x: cx, y: 56 + h + 18, class: 'rotulo', 'font-size': 11.5, fill: 'var(--tinta-2)' }, svg);
    cx += w + 46;
  });
  // Pé-direito, na MESMA escala dos retângulos — 90 px por metro. Se a cota
  // fosse comprimida para caber, a figura desmentiria o que ela promete medir.
  const py = 172, ph = B.pe_direito.valor_m * PX;
  el('rect', { x: 30, y: py, width: 220, height: ph, fill: 'rgba(74,96,112,.07)',
    stroke: 'none' }, svg);
  el('line', { x1: 30, y1: py, x2: 30, y2: py + ph, stroke: '#4a6070', 'stroke-width': 1.6 }, svg);
  el('line', { x1: 24, y1: py, x2: 250, y2: py, stroke: '#4a6070', 'stroke-width': 1.4 }, svg);
  el('line', { x1: 24, y1: py + ph, x2: 250, y2: py + ph, stroke: '#4a6070', 'stroke-width': 1.4 }, svg);
  // Uma pessoa de 1,70 m, na mesma escala, encostaria no teto.
  const hx = 150, hb = py + ph, esc = ph / 1.70;
  el('circle', { cx: hx, cy: py + 0.14 * esc, r: 0.10 * esc, fill: '#8a2f22', opacity: .55 }, svg);
  el('line', { x1: hx, y1: py + 0.24 * esc, x2: hx, y2: py + 0.95 * esc, stroke: '#8a2f22',
    'stroke-width': 3.2, opacity: .55, 'stroke-linecap': 'round' }, svg);
  el('line', { x1: hx, y1: py + 0.95 * esc, x2: hx - 0.13 * esc, y2: hb, stroke: '#8a2f22',
    'stroke-width': 3.2, opacity: .55, 'stroke-linecap': 'round' }, svg);
  el('line', { x1: hx, y1: py + 0.95 * esc, x2: hx + 0.13 * esc, y2: hb, stroke: '#8a2f22',
    'stroke-width': 3.2, opacity: .55, 'stroke-linecap': 'round' }, svg);
  el('line', { x1: hx - 0.20 * esc, y1: py + 0.62 * esc, x2: hx + 0.20 * esc, y2: py + 0.62 * esc,
    stroke: '#8a2f22', 'stroke-width': 3.0, opacity: .55, 'stroke-linecap': 'round' }, svg);
  texto('uma pessoa de 1,70 m', { x: hx + 0.24 * esc, y: py + 0.55 * esc, class: 'rotulo',
    'font-size': 10.5, fill: 'var(--tinta-2)' }, svg);
  texto(`pé-direito entre as plataformas: ${B.pe_direito.valor_m.toFixed(2).replace('.', ',')} m`,
    { x: 262, y: py + ph / 2 - 4, class: 'rotulo', 'font-size': 12.5, 'font-weight': 600 }, svg);
  texto('— insuficiente para caminhar ou ficar de pé com folga.',
    { x: 262, y: py + ph / 2 + 16, class: 'rotulo', 'font-size': 11.5, fill: 'var(--tinta-2)' }, svg);
  texto('Tudo nesta figura está na mesma escala: 90 pixels por metro.',
    { x: 262, y: py + ph / 2 + 38, class: 'rotulo', 'font-size': 10.5, fill: 'var(--tinta-2)' }, svg);

  html('cartoes-brookes').innerHTML = [
    cartaoSimples('As dez viagens',
      `Em 25 anos o <i>Brookes</i> transportou <b>${num(B.viagens.transportou)}</b> pessoas. Chegaram vivas ${num(B.viagens.chegaram)}. Morreram na travessia <b>${num(B.viagens.morreram)}</b> — ${B.viagens.taxa}.`, B.pagina),
    cartaoSimples('Os quatro compartimentos',
      `O porão era dividido em ${B.compartimentos.join(', ')}. ${B.corrente}`, B.pagina),
    cartaoSimples('O diagrama', `${B.diagrama} ${B.necessidades}`, B.pagina),
  ].join('');

  const Z = A.zong;
  html('titulo-zong').textContent = Z.titulo;
  html('texto-zong').innerHTML = Z.texto + ' ' + cII(Z.pagina);
  bloco('julgamento-zong', 'O que a Justiça decidiu', Z.julgamento);
  bloco('nota-zong', 'A pergunta que ninguém fez', Z.nota);

  const S = A.sao_jose;
  html('titulo-sao-jose').textContent = S.titulo;
  html('texto-sao-jose').innerHTML = S.texto + ' ' + cII(S.pagina);
  bloco('achado-sao-jose', 'O achado de 2015', S.achado);

  const K = A.campanha;
  html('titulo-campanha').textContent = K.titulo;
  html('texto-campanha').innerHTML = K.texto + ' ' + cII(K.pagina);
  bloco('quakers', 'Os quakers', K.quakers);
  bloco('newton', 'O autor de “Amazing Grace”', K.newton);

  const E = A.explicacoes;
  html('titulo-explicacoes').textContent = E.titulo;
  tabela('tabela-explicacoes', [{ rotulo: 'A explicação' }, { rotulo: 'A tese' }, { rotulo: 'Por que não basta' }],
    E.itens.map((i) => [`<b>${i.nome}</b>`, i.tese, i.objecao]));
  html('fecho-explicacoes').innerHTML = E.fecho + ' ' + cII(E.pagina);

  bloco('indenizacao', A.indenizacao.titulo, A.indenizacao.texto, A.indenizacao.pagina);
  bloco('aprendizes', 'Os “aprendizes”', A.indenizacao.aprendizes);
  bloco('frota-britanica', A.frota.titulo, A.frota.texto, A.frota.pagina);
  bloco('bolonha', A.bolonha.titulo, A.bolonha.texto, A.bolonha.pagina);
  html('cronologia-abolicao2').innerHTML = A.cronologia.map((c) =>
    `<li><b>${c.ano}</b>${c.fato} ${cII(c.pagina)}</li>`).join('');
}

// --- troca de abas
{
  const paineis = {
    trafico: html('painel-trafico'),
    origens: html('painel-origens'),
    negocio: html('painel-negocio'),
    navio: html('painel-navio'),
    escravidao: html('painel-escravidao'),
    ouro: html('painel-ouro'),
  };
  const botoes = [...document.querySelectorAll('.aba')];
  const ir = (nome) => {
    for (const b of botoes) b.setAttribute('aria-selected', String(b.dataset.aba === nome));
    for (const [k, el2] of Object.entries(paineis)) el2.hidden = k !== nome;
    if (nome === 'escravidao') { montarMapaPopulacoes(); montarMapaBrasil(); montarMapaInterno(); }
    else if (nome === 'origens') { montarMapaOrigens(); montarCostaMina(); }
    else if (nome === 'navio') { montarAbolicao(); }
    else if (nome === 'ouro') { montarOuro(); }
    else if (prontoParaMedir) { descongestionar(); aplicarCamadas(); }
    if (location.hash !== '#' + nome) history.replaceState(null, '', '#' + nome);
  };
  for (const b of botoes) b.addEventListener('click', () => ir(b.dataset.aba));
  const inicial = location.hash.replace('#', '');
  if (paineis[inicial] && inicial !== 'trafico') ir(inicial);
}


// A medição dos rótulos depende da fonte já carregada.
const ajustar = () => { prontoParaMedir = true; descongestionar(); aplicarCamadas(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);
else window.addEventListener('load', ajustar);
setTimeout(ajustar, 1200);
})();
