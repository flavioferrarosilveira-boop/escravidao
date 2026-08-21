/*
 * extrair_geo.mjs — extrai a geometria do mundo atlântico a partir do Natural Earth
 * (pacote npm `world-atlas`, 1:50m) e grava dados/geo_atlantico.json em lon/lat.
 *
 * Roda uma única vez, com rede:
 *    npm i world-atlas@2 topojson-client
 *    node build/extrair_geo.mjs
 *
 * O arquivo gerado é versionado, de modo que build/gerar.mjs funcione sem rede
 * e sem dependências.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MODS = process.env.MODS_DIR || '/tmp/claude-0/-home-user-escravidao/4023e5b5-34df-5960-9df3-169d7f3d67d4/scratchpad/node_modules';
const topojson = require(`${MODS}/topojson-client`);

const RAIZ = new URL('..', import.meta.url).pathname;

// Recorte do mundo atlântico (o teatro do tráfico).
const BBOX = { lonMin: -112, lonMax: 62, latMin: -48, latMax: 72 };

// --- utilidades de geometria -------------------------------------------------

const areaAnel = (anel) => {
  let s = 0;
  for (let i = 0, n = anel.length; i < n; i++) {
    const [x1, y1] = anel[i];
    const [x2, y2] = anel[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2); // graus quadrados
};

const dentroBbox = (anel) =>
  anel.some(([x, y]) => x >= BBOX.lonMin && x <= BBOX.lonMax && y >= BBOX.latMin && y <= BBOX.latMax);

// Recorte de polígono contra um retângulo (Sutherland–Hodgman).
function recortar(anel, cx) {
  const bordas = [
    { dentro: (p) => p[0] >= cx.lonMin, corta: (a, b) => interpX(a, b, cx.lonMin) },
    { dentro: (p) => p[0] <= cx.lonMax, corta: (a, b) => interpX(a, b, cx.lonMax) },
    { dentro: (p) => p[1] >= cx.latMin, corta: (a, b) => interpY(a, b, cx.latMin) },
    { dentro: (p) => p[1] <= cx.latMax, corta: (a, b) => interpY(a, b, cx.latMax) },
  ];
  let saida = anel;
  for (const borda of bordas) {
    const entrada = saida;
    saida = [];
    for (let i = 0; i < entrada.length; i++) {
      const atual = entrada[i];
      const anterior = entrada[(i + entrada.length - 1) % entrada.length];
      const aDentro = borda.dentro(atual);
      const pDentro = borda.dentro(anterior);
      if (aDentro) {
        if (!pDentro) saida.push(borda.corta(anterior, atual));
        saida.push(atual);
      } else if (pDentro) {
        saida.push(borda.corta(anterior, atual));
      }
    }
    if (!saida.length) return [];
  }
  return saida;
}
const interpX = (a, b, x) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
const interpY = (a, b, y) => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];

// Simplificação por distância mínima + arredondamento (2 casas ≈ 1,1 km).
function simplificar(anel, tol) {
  const r = (v) => Math.round(v * 100) / 100;
  const saida = [];
  let ultimo = null;
  for (const [x, y] of anel) {
    const p = [r(x), r(y)];
    if (!ultimo || Math.abs(p[0] - ultimo[0]) + Math.abs(p[1] - ultimo[1]) >= tol) {
      saida.push(p);
      ultimo = p;
    }
  }
  if (saida.length && ultimo && (saida[0][0] !== ultimo[0] || saida[0][1] !== ultimo[1])) saida.push(saida[0]);
  return saida.length >= 4 ? saida : null;
}

function aneisDe(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}

function prepararAneis(geom, { areaMin, tol, caixa }) {
  const out = [];
  for (const anel of aneisDe(geom)) {
    let a = anel;
    if (caixa) {
      a = recortar(a, caixa);
      if (!a.length) continue;
    } else if (!dentroBbox(a)) continue;
    if (areaAnel(a) < areaMin) continue;
    const s = simplificar(a, tol);
    if (s) out.push(s);
  }
  return out;
}

// --- extração ----------------------------------------------------------------

const terraTopo = JSON.parse(readFileSync(`${MODS}/world-atlas/land-50m.json`, 'utf8'));
const paisesTopo = JSON.parse(readFileSync(`${MODS}/world-atlas/countries-50m.json`, 'utf8'));

const terra = topojson.feature(terraTopo, terraTopo.objects.land);
const paises = topojson.feature(paisesTopo, paisesTopo.objects.countries).features;
const porNome = new Map(paises.map((f) => [f.properties.name, f]));

const litoral = [];
for (const f of terra.features) litoral.push(...prepararAneis(f.geometry, { areaMin: 0.02, tol: 0.09, caixa: BBOX }));

// Domínios coloniais nas Américas, c. 1750 (aproximação: geometria moderna).
const DOMINIOS = {
  portugal: { paises: ['Brazil'] },
  espanha: {
    paises: ['Mexico', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama',
             'Colombia', 'Venezuela', 'Ecuador', 'Peru', 'Bolivia', 'Chile', 'Argentina', 'Uruguay',
             'Paraguay', 'Cuba', 'Dominican Rep.', 'Puerto Rico', 'Trinidad and Tobago'],
  },
  gra_bretanha: {
    paises: ['Jamaica', 'Barbados', 'Bahamas', 'Antigua and Barb.', 'St. Kitts and Nevis',
             'Dominica', 'St. Vin. and Gren.', 'Grenada', 'Belize', 'Montserrat', 'Anguilla',
             'British Virgin Is.', 'Cayman Is.'],
    recortes: [{ pais: 'United States of America', caixa: { lonMin: -88, lonMax: -66.5, latMin: 25, latMax: 47 } }],
  },
  franca: { paises: ['Haiti', 'St-Martin', 'Saint Lucia'] },
  paises_baixos: { paises: ['Suriname', 'Guyana', 'Curaçao', 'Aruba'] },
  dinamarca: { paises: ['U.S. Virgin Is.'] },
};

const dominios = {};
for (const [potencia, cfg] of Object.entries(DOMINIOS)) {
  const aneis = [];
  for (const nome of cfg.paises || []) {
    const f = porNome.get(nome);
    if (!f) { console.warn('  ! país não encontrado:', nome); continue; }
    aneis.push(...prepararAneis(f.geometry, { areaMin: 0.004, tol: 0.05 }));
  }
  for (const rec of cfg.recortes || []) {
    const f = porNome.get(rec.pais);
    if (!f) { console.warn('  ! país não encontrado:', rec.pais); continue; }
    aneis.push(...prepararAneis(f.geometry, { areaMin: 0.02, tol: 0.08, caixa: rec.caixa }));
  }
  dominios[potencia] = aneis;
}

// África: contorno das regiões de embarque é desenhado como "colchetes" de costa
// no gerador; aqui basta o litoral.

const saida = { bbox: BBOX, litoral, dominios };
mkdirSync(`${RAIZ}dados`, { recursive: true });
writeFileSync(`${RAIZ}dados/geo_atlantico.json`, JSON.stringify(saida));

const kb = (s) => (JSON.stringify(s).length / 1024).toFixed(0);
console.log(`litoral: ${litoral.length} anéis (${kb(litoral)} kB)`);
for (const [k, v] of Object.entries(dominios)) console.log(`  ${k}: ${v.length} anéis (${kb(v)} kB)`);
console.log(`total: ${kb(saida)} kB → dados/geo_atlantico.json`);
