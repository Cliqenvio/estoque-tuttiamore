// Gera o PDF do infoproduto: bordas (capa/ficha/contracapa) + miolo numerado.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const AQUI = __dirname;
const url = f => 'file://' + path.join(AQUI, f);

const RODAPE = `
<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;
     color:#9A9089;padding:0 18mm;display:flex;justify-content:space-between;
     align-items:center;letter-spacing:.04em;">
  <span style="text-transform:uppercase;letter-spacing:.12em;font-size:6.6pt;">Do zero ao app · 10 skills</span>
  <span style="font-weight:700;color:#6E645A;"><span class="pageNumber"></span></span>
</div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // --- bordas: sem margem, sem rodapé ---
  await page.goto(url('bordas.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(AQUI, 'out-bordas.pdf'), format: 'A4',
    printBackground: true, margin: { top:0, bottom:0, left:0, right:0 } });

  // --- miolo: margens + rodapé com número ---
  await page.goto(url('livro.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(AQUI, 'out-miolo.pdf'), format: 'A4',
    printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>', footerTemplate: RODAPE,
    margin: { top:'19mm', bottom:'20mm', left:'18mm', right:'18mm' } });

  await browser.close();
  console.log('render ok');
})();
