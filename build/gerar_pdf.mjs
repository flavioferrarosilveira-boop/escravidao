/*
 * gerar_pdf.mjs — imprime index.html em PDF, com as duas abas abertas.
 *
 *   npm i playwright && npx playwright install chromium
 *   node build/gerar_pdf.mjs
 *
 * Fora do CI, aponte MODS_DIR para um node_modules que já tenha o playwright.
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const RAIZ = new URL('..', import.meta.url).pathname;
const SAIDA = RAIZ + 'carta-do-trafico-atlantico.pdf';

function carregarPlaywright() {
  for (const caminho of [ 'playwright', (process.env.MODS_DIR || '') + '/playwright' ]) {
    if (!caminho.startsWith('/') && caminho !== 'playwright') continue;
    try { return require(caminho); } catch { /* tenta o próximo */ }
  }
  throw new Error('playwright não encontrado — instale-o ou defina MODS_DIR');
}

// O Chromium do ambiente, quando existe, evita baixar outro.
function chromiumLocal() {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  for (const dir of readdirSync(base)) {
    const exe = `${base}/${dir}/chrome-linux/chrome`;
    if (dir.startsWith('chromium-') && existsSync(exe)) return exe;
  }
  return undefined;
}

const { chromium } = carregarPlaywright();
const navegador = await chromium.launch({ executablePath: chromiumLocal() });
const pagina = await navegador.newPage({ viewport: { width: 1500, height: 1050 } });

await pagina.goto('file://' + RAIZ + 'index.html', { waitUntil: 'load' });
await pagina.waitForTimeout(2000);

// Abre a aba da escravidão para que a carta II seja construída, e volta.
await pagina.locator('.aba[data-aba="escravidao"]').click();
await pagina.waitForTimeout(1500);
await pagina.locator('.aba[data-aba="trafico"]').click();
await pagina.waitForTimeout(800);

await pagina.emulateMedia({ media: 'print' });
await pagina.waitForTimeout(600);
await pagina.pdf({
  path: SAIDA,
  format: 'A3',
  landscape: true,
  printBackground: true,
  margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-family:Georgia,serif;font-size:8.5pt;color:#7a6448;' +
    'padding:0 14mm;display:flex;justify-content:space-between">' +
    '<span>Rotas do Tráfico Atlântico · 1501–1866</span>' +
    '<span class="pageNumber"></span></div>',
});

await navegador.close();
console.log('PDF gravado em', SAIDA);
