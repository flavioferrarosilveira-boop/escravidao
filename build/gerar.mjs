/*
 * gerar.mjs — monta o mapa interativo (index.html) a partir de dados/*.json.
 * Sem dependências: `node build/gerar.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const RAIZ = new URL('..', import.meta.url).pathname;
const ler = (p) => JSON.parse(readFileSync(RAIZ + p, 'utf8'));
const lerTexto = (p) => readFileSync(RAIZ + p, 'utf8');

const { regioes } = ler('dados/regioes_embarque.json');
const { destinos } = ler('dados/destinos.json');
const { bandeiras } = ler('dados/bandeiras.json');
const { periodos, marcos, ciclos } = ler('dados/periodos.json');
const sementes = ler('dados/matriz_sementes.json');
const escravidao = ler('dados/escravidao.json');
const armadores = ler('dados/portos_armadores.json');
const cotejo = ler('dados/cotejo.json');
const geo = ler('dados/geo_atlantico.json');

// ---------------------------------------------------------------------------
// 1. Matriz de rotas por IPF (Iterative Proportional Fitting / RAS)
//    Linhas = embarcados por região africana (TSTD)
//    Colunas = desembarcados por destino (TSTD), reescalados para base de embarque
// ---------------------------------------------------------------------------

// Expande os macro-destinos ('brasil', 'hispano_america') nos portos reais.
const LINHAS = regioes.map((r) => r.id);
const COLS = [];
const SEMENTE = LINHAS.map(() => []);
for (let c = 0; c < sementes.colunas.length; c++) {
  const macro = sementes.colunas[c];
  const sub = (sementes.subdivisoes || {})[macro];
  if (!sub) {
    COLS.push(macro);
    LINHAS.forEach((id, i) => SEMENTE[i].push(sementes.linhas[id][c]));
  } else {
    for (let k = 0; k < sub.destinos.length; k++) {
      COLS.push(sub.destinos[k]);
      LINHAS.forEach((id, i) => SEMENTE[i].push(sementes.linhas[id][c] * sub.linhas[id][k]));
    }
  }
}

const totalEmbarcados = regioes.reduce((s, r) => s + r.embarcados, 0);
const totalDesembarcados = destinos.reduce((s, d) => s + d.desembarcados, 0);
const taxaSobrevivencia = totalDesembarcados / totalEmbarcados;

const alvoLinha = regioes.map((r) => r.embarcados);
const alvoColuna = COLS.map((c) => {
  const d = destinos.find((x) => x.id === c);
  if (!d) throw new Error(`destino desconhecido na matriz semente: ${c}`);
  return d.desembarcados / taxaSobrevivencia;
});

let M = SEMENTE.map((linha, i) => linha.map((p) => Math.max(p, 1e-7) * alvoLinha[i]));

for (let iter = 0; iter < 400; iter++) {
  for (let i = 0; i < M.length; i++) {
    const s = M[i].reduce((a, b) => a + b, 0);
    if (s > 0) { const f = alvoLinha[i] / s; for (let j = 0; j < M[i].length; j++) M[i][j] *= f; }
  }
  for (let j = 0; j < COLS.length; j++) {
    let s = 0; for (let i = 0; i < M.length; i++) s += M[i][j];
    if (s > 0) { const f = alvoColuna[j] / s; for (let i = 0; i < M.length; i++) M[i][j] *= f; }
  }
}
// Fecha nas linhas (embarcados são a marginal mais firme do TSTD).
for (let i = 0; i < M.length; i++) {
  const s = M[i].reduce((a, b) => a + b, 0);
  const f = alvoLinha[i] / s;
  for (let j = 0; j < M[i].length; j++) M[i][j] = Math.round((M[i][j] * f) / 100) * 100;
}

const erroColuna = COLS.map((c, j) => {
  let s = 0; for (let i = 0; i < M.length; i++) s += M[i][j];
  return { destino: c, ajustado: Math.round(s * taxaSobrevivencia), tstd: destinos.find((d) => d.id === c).desembarcados };
});

// ---------------------------------------------------------------------------
// 2. Rotas desenháveis
// ---------------------------------------------------------------------------

const LIMIAR = 15000;  // pessoas — abaixo disso a rota não é traçada (mas continua nas contas)
const PISO = 1500;     // abaixo disso a célula é ruído do ajuste e sai de vez
const rotas = [];
for (let i = 0; i < LINHAS.length; i++) {
  for (let j = 0; j < COLS.length; j++) {
    const emb = M[i][j];
    if (emb < PISO) continue;
    const reg = regioes[i];
    const des = destinos.find((d) => d.id === COLS[j]);
    rotas.push({
      origem: reg.id,
      destino: des.id,
      embarcados: emb,
      desembarcados: Math.round(emb * taxaSobrevivencia),
      potencia: des.potencia,
      de: [reg.porto.lon, reg.porto.lat],
      para: [des.porto.lon, des.porto.lat],
      nomeDe: reg.porto.nome,
      nomePara: des.porto.nome,
      tracada: emb >= LIMIAR,
    });
  }
}
rotas.sort((a, b) => b.embarcados - a.embarcados);

// CSV auditável
const csv = [
  'regiao_embarque,regiao_embarque_nome,destino,destino_nome,embarcados,desembarcados_est,mortos_travessia_est,pct_do_total',
  ...rotas.map((r) => {
    const reg = regioes.find((x) => x.id === r.origem);
    const des = destinos.find((x) => x.id === r.destino);
    return [r.origem, `"${reg.nome}"`, r.destino, `"${des.nome}"`, r.embarcados, r.desembarcados,
      r.embarcados - r.desembarcados, ((r.embarcados / totalEmbarcados) * 100).toFixed(2)].join(',');
  }),
].join('\n');
writeFileSync(RAIZ + 'dados/matriz_rotas.csv', csv + '\n');

// ---------------------------------------------------------------------------
// 3. Pernas do comércio triangular
// ---------------------------------------------------------------------------

const CIRCUITOS = ler('dados/circuitos.json').circuitos;

// ---------------------------------------------------------------------------
// 4. Montagem do HTML
// ---------------------------------------------------------------------------

const CORES_REGIAO = {
  senegambia: '#a8322f', serra_leoa: '#d2691e', barlavento: '#b8912b', costa_ouro: '#6b8f2a',
  benim: '#1f7a5a', biafra: '#2e6f9e', centro_ocidental: '#4b3f9e', sudeste: '#8a3f8c',
};

const dados = {
  meta: {
    totalEmbarcados, totalDesembarcados,
    mortosTravessia: totalEmbarcados - totalDesembarcados,
    taxaSobrevivencia, limiarRota: LIMIAR, erroColuna,
    geradoPor: 'build/gerar.mjs',
  },
  geo, regioes, destinos, bandeiras, periodos, marcos, rotas, circuitos: CIRCUITOS,
  populacoes: escravidao.populacoes, demografia: escravidao.demografia,
  trabalho: escravidao.trabalho, resistencia: escravidao.resistencia,
  abolicoes: escravidao.abolicoes, depois: escravidao.depois,
  armadores: armadores.portos, armadoresNota: armadores._nota, ciclos: ciclos.lista,
  cotejo: cotejo.linhas, cotejoNota: cotejo._nota,
  coresRegiao: CORES_REGIAO,
};

const modelo = lerTexto('build/modelo.html');
const html = modelo
  .replace('/*__CSS__*/', () => lerTexto('build/estilo.css'))
  .replace('/*__DADOS__*/', () => `window.DADOS = ${JSON.stringify(dados)};`)
  .replace('/*__JS__*/', () => lerTexto('build/app.js'));

writeFileSync(RAIZ + 'index.html', html);

console.log(`células: ${rotas.length} · traçadas no mapa: ${rotas.filter((r) => r.tracada).length}` +
  ` (limiar ${LIMIAR.toLocaleString('pt-BR')})`);
console.log('conferência das colunas (desembarcados ajustados vs. TSTD):');
for (const e of erroColuna) {
  const dif = e.ajustado - e.tstd;
  console.log(`  ${e.destino.padEnd(18)} ${String(e.ajustado).padStart(9)}  TSTD ${String(e.tstd).padStart(9)}  Δ ${dif > 0 ? '+' : ''}${dif}`);
}
console.log(`index.html: ${(html.length / 1024).toFixed(0)} kB`);
