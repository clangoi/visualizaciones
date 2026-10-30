#!/usr/bin/env node
/* Verificación del sitio. Uso:
     npm run verificar              → revisa todo
     npm run verificar -- bst avl   → solo esos temas (las reglas estáticas se revisan siempre)

   1. Reglas estáticas (sin navegador): catálogo ↔ archivos, colores fuera de la paleta,
      estilos en línea, plantillas de texto, sincronía entre estilos.css y VIZ.color, y a lo más
      12 temas por sección.
   2. En el navegador (playwright-core): cada tema carga sin errores, tiene tantas figuras como
      dice el catálogo, sus fórmulas se renderizan, todos los botones funcionan y no hay
      desplazamiento horizontal con 390 px de ancho.
   Sale con código 1 si hay fallas; los avisos no detienen nada. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const fallas = [];
const avisos = [];
const falla = (m) => fallas.push(m);
const aviso = (m) => avisos.push(m);

/* ---------- 1. Reglas estáticas ---------- */

const ventana = {};
vm.runInNewContext(leer('js/catalogo.js'), { window: ventana });
vm.runInNewContext(leer('js/comun.js'), { window: ventana });
const CATALOGO = ventana.CATALOGO;
const VIZ = ventana.VIZ;

// Catálogo ↔ archivos
const archivos = fs.readdirSync(path.join(RAIZ, 'temas')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const ids = new Set();
for (const t of CATALOGO.temas) {
  if (ids.has(t.id)) falla(`catálogo: id repetido «${t.id}»`);
  ids.add(t.id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) falla(`catálogo: el id «${t.id}» debe ir en minúsculas con guiones`);
  if (!archivos.includes(t.id)) falla(`catálogo: falta temas/${t.id}.js`);
  if (!t.resumen || t.resumen.length > 140) aviso(`catálogo: el resumen de «${t.id}» debería tener entre 1 y 140 caracteres (tiene ${t.resumen ? t.resumen.length : 0})`);
  if (!/^<svg class="tarjeta-glifo" viewBox="0 0 44 44"/.test(t.glifo)) falla(`catálogo: «${t.id}» debe usar g('…') para su glifo`);
  if (/#[0-9a-f]{3,6}/i.test(t.glifo)) falla(`catálogo: el glifo de «${t.id}» no puede tener colores (use currentColor)`);
}
for (const f of archivos) if (!ids.has(f)) falla(`temas/${f}.js no está en el catálogo`);
const materiasValidas = new Set(CATALOGO.materias.map((m) => m.id));
for (const s of CATALOGO.secciones) for (const e of s.etiquetas || []) if (!materiasValidas.has(e)) falla(`catálogo: la sección «${s.nombre}» usa el área desconocida «${e}»`);
for (const t of CATALOGO.temas) {
  if (!t.etiquetas.length) falla(`catálogo: «${t.id}» no tiene ningún área (agregue etiquetas a su sección o al tema)`);
  for (const e of t.etiquetas) if (!materiasValidas.has(e)) falla(`catálogo: «${t.id}» usa el área desconocida «${e}»`);
}
for (const s of CATALOGO.secciones) if (s.temas.length > 12) falla(`catálogo: la sección «${s.nombre}» tiene ${s.temas.length} temas; el máximo es 12, reestructúrela en secciones más específicas`);

// Reglas por archivo de tema y módulo
const revisar = [...archivos.map((f) => `temas/${f}.js`), 'js/arboles.js', 'js/grafos.js', 'js/busqueda.js', 'js/ml.js', 'js/imagen.js', 'js/patrones.js', 'js/bdd.js', 'js/distribuidos.js', 'js/mineria.js', 'js/profundo.js', 'js/discretas.js', 'js/ordenar.js', 'js/portada.js', 'js/tema.js'];
const ESTILOS_PERMITIDOS = new Set(['color', 'background', 'borderColor', 'fontWeight', 'margin', 'width', 'height', 'border', 'fontSize', 'marginRight']);
for (const p of revisar) {
  const lineas = leer(p).split('\n');
  lineas.forEach((l, i) => {
    const donde = `${p}:${i + 1}`;
    // Colores: solo desde VIZ.color, salvo constantes en MAYÚSCULAS declaradas a propósito.
    if (/#[0-9a-fA-F]{3,8}\b/.test(l) && !/^\s*const [A-Z_]+ = '#[0-9a-fA-F]+';/.test(l) && !/^\s*(\/\/|\*)/.test(l) && !/href="#|'#' \+|`#\$\{|\(#/.test(l)) {
      falla(`${donde}: color escrito a mano; use VIZ.color (C.…) → ${l.trim().slice(0, 90)}`);
    }
    if (/rgba?\(\s*\d/.test(l)) falla(`${donde}: rgba() escrito a mano; use VIZ.alfa(C.…, a)`);
    // Estilos en línea: solo valores que dependen de los datos.
    for (const m of l.matchAll(/style:\s*\{([^}]*)\}/g)) {
      const claves = [...m[1].matchAll(/(?:^|,)\s*([a-zA-Z]+)\s*:/g)].map((x) => x[1]);
      const otras = claves.filter((k) => !ESTILOS_PERMITIDOS.has(k));
      if (otras.length) aviso(`${donde}: estilo en línea con ${otras.join(', ')}; considere una clase en css/estilos.css`);
    }
  });
  if (p.startsWith('temas/')) {
    const s = lineas.join('\n');
    const id = p.slice(6, -3);
    if (!s.includes(`VIZ.registrarTema('${id}'`)) falla(`${p}: debe llamar a VIZ.registrarTema('${id}', …)`);
    for (const campo of ['intro', 'teoria']) if (!new RegExp(`${campo}: String\\.raw\``).test(s)) falla(`${p}: «${campo}» debe escribirse con String.raw\`…\``);
    for (const m of s.matchAll(/String\.raw`([\s\S]*?)`/g)) {
      if (/\$(?!\{)/.test(m[1])) falla(`${p}: use \\( … \\) y \\[ … \\] para las fórmulas, no $…$`);
    }
  }
}

// estilos.css ↔ VIZ.color
const css = leer('css/estilos.css');
const variable = (n) => { const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`)); return m && m[1].toLowerCase(); };
const pares = [['tinta', 'tinta'], ['tinta-2', 'tinta2'], ['tinta-3', 'apagado'], ['linea', 'rejilla'], ['fondo-2', 'fondo2'],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => [`serie-${k}`, `s${k}`])];
for (const [v, k] of pares) if (variable(v) !== VIZ.color[k].toLowerCase()) falla(`paleta: --${v} (${variable(v)}) no coincide con VIZ.color.${k} (${VIZ.color[k]})`);

/* ---------- 2. Pruebas en el navegador ---------- */

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain' };
function servir() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
      fs.createReadStream(ruta).pipe(res);
    }).listen(0, () => ok(srv));
  });
}

async function navegador(soloIds) {
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch {
    aviso('playwright-core no está instalado: se omiten las pruebas en el navegador (npm install && npx playwright install chromium)');
    return;
  }
  const srv = await servir();
  const base = `http://localhost:${srv.address().port}`;
  const nav = await chromium.launch();
  const pagina = await nav.newPage({ viewport: { width: 1300, height: 900 } });
  let actual = 'index';
  pagina.on('pageerror', (e) => falla(`[${actual}] error de JavaScript: ${e.message}`));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) falla(`[${actual}] consola: ${m.text()}`); });

  await pagina.goto(`${base}/index.html`);
  const tarjetas = await pagina.$$eval('.tarjeta', (t) => t.length);
  if (tarjetas !== CATALOGO.temas.length) falla(`portada: ${tarjetas} tarjetas, se esperaban ${CATALOGO.temas.length}`);

  const temas = soloIds.length ? CATALOGO.temas.filter((t) => soloIds.includes(t.id)) : CATALOGO.temas;
  for (const t of temas) {
    actual = t.id;
    process.stdout.write(`  ${t.id}… `);
    await pagina.setViewportSize({ width: 1300, height: 900 });
    await pagina.goto(`${base}/tema.html?id=${t.id}`);
    await pagina.waitForTimeout(700);
    const figuras = await pagina.$$eval('figure.viz', (f) => f.length);
    if (figuras !== t.visualizaciones) falla(`[${t.id}] tiene ${figuras} figuras y el catálogo dice ${t.visualizaciones}`);
    const katex = await pagina.evaluate(() => (typeof window.katex === 'undefined' ? -1 : document.querySelectorAll('.katex-error').length));
    if (katex > 0) falla(`[${t.id}] ${katex} fórmulas con error de KaTeX`);
    if (katex < 0) aviso(`[${t.id}] KaTeX no cargó (¿sin conexión?): no se revisaron las fórmulas`);
    const sinLeyenda = await pagina.$$eval('figure.viz', (fs) => fs.filter((f) => f.querySelector('canvas') && !f.querySelector('.leyenda') && !f.querySelector('[data-sin-leyenda]')).length);
    if (sinLeyenda) aviso(`[${t.id}] ${sinLeyenda} figura(s) con lienzo y sin leyenda (agregue VIZ.leyenda o marque cuerpo.dataset.sinLeyenda con el motivo)`);
    // Pulsa cada botón (salvo los que inician animaciones continuas) y luego «Hasta el final».
    const n = await pagina.$$eval('figure.viz button', (b) => b.length);
    for (let i = 0; i < n; i++) {
      const b = (await pagina.$$('figure.viz button'))[i];
      if (!b) break;
      const txt = (await b.textContent()).trim();
      if (/^(Reproducir|Pausar|Animar|Ejecutar)$/.test(txt)) continue;
      try { await b.click({ timeout: 2000 }); } catch (e) { falla(`[${t.id}] no se pudo pulsar «${txt}»: ${e.message.split('\n')[0]}`); }
    }
    for (const b of await pagina.$$('figure.viz button')) if ((await b.textContent()).trim() === 'Hasta el final') await b.click();
    await pagina.waitForTimeout(200);
    // Móvil
    await pagina.setViewportSize({ width: 390, height: 800 });
    await pagina.waitForTimeout(250);
    const exceso = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (exceso > 0) falla(`[${t.id}] desborda ${exceso}px en horizontal con 390 px de ancho`);
    console.log('ok');
  }
  await nav.close();
  srv.close();
}

(async () => {
  console.log('Reglas estáticas: revisadas.');
  console.log('Navegador:');
  await navegador(process.argv.slice(2));
  if (avisos.length) console.log(`\nAvisos (${avisos.length}):\n  ${avisos.join('\n  ')}`);
  if (fallas.length) {
    console.log(`\nFallas (${fallas.length}):\n  ${fallas.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nTodo en orden.');
})();
