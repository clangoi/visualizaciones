(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: rangos de versiones semánticas ---------- */

  const VERSIONES = ['1.0.0', '1.1.0', '1.2.0', '1.2.3', '1.2.9', '1.3.0', '1.4.2', '2.0.0', '2.1.0', '3.0.0'];
  const num = (v) => v.split('.').map(Number);
  const cmp = (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  const cumple = (v, op, base) => {
    const [M, m] = num(base), [vM, vm] = num(v);
    if (cmp(v, base) < 0) return op === '*' ? true : false;
    if (op === '=') return v === base;
    if (op === '^') return M > 0 ? vM === M : vM === 0 && vm === m;
    if (op === '~') return vM === M && vm === m;
    if (op === '>=') return true;
    return true;
  };

  function montarSemver(cuerpo) {
    const est = { op: '^', base: '1.2.0', lock: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Operador en package.json', valor: est.op, opciones: [['^', '^ (compatible: misma versión mayor)'], ['~', '~ (solo parches)'], ['=', 'exacta'], ['>=', '>= (cualquiera posterior)']], alCambiar: (v) => { est.op = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Versión base', valor: est.base, opciones: VERSIONES.map((v) => [v, v]), alCambiar: (v) => { est.base = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'package-lock.json fija 1.2.3', valor: false, alCambiar: (v) => { est.lock = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 150 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'versión que cumple el rango' }, { color: C.inactivo, texto: 'fuera del rango' }, { color: C.s6, texto: 'versión que se instala' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las versiones publicadas del paquete están ordenadas de izquierda a derecha. <code>npm install</code> elige la más alta que cumpla el rango, salvo que el archivo lock ya fije una.');
    let pos = [];
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const ok = VERSIONES.map((v) => cumple(v, est.op, est.base));
      const sel = est.lock && ok[VERSIONES.indexOf('1.2.3')] ? '1.2.3' : [...VERSIONES].reverse().find((v, i) => ok[VERSIONES.length - 1 - i]) || null;
      const w = (Wd - 16) / VERSIONES.length;
      pos = VERSIONES.map((v, i) => ({ v, x: 8 + i * w, w: w - 4, ok: ok[i] }));
      pos.forEach((p) => {
        const esSel = p.v === sel;
        W.caja(ctx, p.x, 40, p.w, 40, p.v, { borde: esSel ? C.s6 : p.ok ? C.s1 : C.inactivo, relleno: esSel ? VIZ.alfa(C.s6, 0.3) : p.ok ? VIZ.alfa(C.s1, 0.15) : C.superficie, tam: Wd < 500 ? 8 : 10, peso: esSel ? 700 : 400, grosor: esSel ? 3 : 1.5, tinta: p.ok ? C.tinta : C.apagado });
      });
      W.texto(ctx, `"paquete": "${est.op === '=' ? '' : est.op}${est.base}"`, 8, 16, { tam: 12, peso: 600, alinear: 'left' });
      registro.textContent = sel ? `El rango acepta ${ok.filter(Boolean).length} versión(es) y se instala ${sel}${est.lock ? ' (la fijó el archivo lock)' : ' (la más alta que cumple)'}.` : 'Ninguna versión publicada cumple el rango.';
      lectura.set([['rango', `${est.op === '=' ? '' : est.op}${est.base}`], ['versiones aceptadas', String(ok.filter(Boolean).length)], ['instalada', sel || '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const p = pos.find((q) => x >= q.x && x <= q.x + q.w && y >= 40 && y <= 80); if (!p) return tip.ocultar(); const [M, m, pa] = num(p.v); tip.mostrar(x, y, `<b>${p.v}</b><br>mayor ${M} · menor ${m} · parche ${pa}<br>${p.ok ? 'cumple el rango' : 'fuera del rango'}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: árbol de dependencias ---------- */

  const PAQUETES = {
    express: { deps: ['cuerpo@1', 'rutas@2'], t: 'express' }, koa: { deps: ['rutas@3', 'cuerpo@1'], t: 'koa' }, sequelize: { deps: ['rutas@2', 'pool@1'], t: 'sequelize' },
    jest: { deps: ['pool@1', 'cuerpo@2'], t: 'jest' },
  };
  function montarArbol(cuerpo) {
    const sel = new Set(['express', 'sequelize']);
    let nodos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(Object.keys(PAQUETES).map((k) => ({ clave: k, texto: k, activo: sel.has(k) })), (e) => { sel.clear(); Object.entries(e).forEach(([k, v]) => { if (v) sel.add(k); }); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 280 : 240) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'dependencia directa' }, { color: C.s3, texto: 'dependencia transitiva' }, { color: C.s2, texto: 'misma biblioteca en versiones incompatibles (se instala dos veces)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paquete trae sus propias dependencias. Elija paquetes que pidan versiones mayores distintas de la misma biblioteca y vea cómo npm debe instalarla varias veces.');
    function dibujar() {
      lienzo.limpiar();
      const raiz = { texto: 'mi-app', id: 'raiz', hijos: [...sel].map((k) => ({ texto: k, id: k, directa: true, hijos: PAQUETES[k].deps.map((d) => ({ texto: d, id: `${k}>${d}`, lib: d.split('@')[0], ver: d.split('@')[1], hijos: [] })) })) };
      const porLib = {};
      raiz.hijos.forEach((h) => h.hijos.forEach((d) => { (porLib[d.lib] = porLib[d.lib] || new Set()).add(d.ver); }));
      const dup = Object.entries(porLib).filter(([, v]) => v.size > 1).map(([k]) => k);
      nodos = W.arbol(lienzo.ctx, raiz, lienzo.ancho, lienzo.alto, (n) => n.id === 'raiz' ? {} : n.directa ? { relleno: VIZ.alfa(C.s1, 0.2), borde: C.s1 } : dup.includes(n.lib) ? { relleno: VIZ.alfa(C.s2, 0.25), borde: C.s2 } : { relleno: VIZ.alfa(C.s3, 0.2), borde: C.s3 }, { tam: lienzo.ancho < 600 ? 9 : 11 });
      const unicos = new Set(raiz.hijos.flatMap((h) => h.hijos.map((d) => d.texto)));
      const instalados = sel.size + unicos.size;
      registro.textContent = dup.length ? `«${dup.join('», «')}» se pide en versiones mayores incompatibles: npm instala una copia de cada una (duplicadas en node_modules).` : sel.size ? 'Las dependencias compartidas se instalan una sola vez («aplanado» de node_modules).' : 'Elija al menos un paquete.';
      lectura.set([['dependencias directas', String(sel.size)], ['paquetes instalados', String(instalados)], ['bibliotecas duplicadas', String(dup.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const n = nodos.find((q) => x >= q.x - q.w / 2 && x <= q.x + q.w / 2 && y >= q.y && y <= q.y + q.h); if (!n) return tip.ocultar(); tip.mostrar(x, y, `<b>${n.texto}</b><br>${n.directa ? 'en tu package.json' : n.lib ? `dependencia de ${n.id.split('>')[0]}` : 'tu proyecto'}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('npm-modules', {
    intro: String.raw`
      <p>Un proyecto de Node.js rara vez está solo: usa decenas de bibliotecas que a su vez usan otras. <strong>npm</strong> (y alternativas como <strong>Yarn</strong>) las descarga e instala,
      y el archivo <code>package.json</code> declara cuáles se necesitan y en qué versiones.</p>
      <p>Para que el código pueda dividirse en archivos, Node ofrece dos sistemas de <strong>módulos</strong>: CommonJS (<code>require</code>) y ES Modules (<code>import</code>).</p>`,
    visualizaciones: [
      { titulo: 'Versionado semántico y rangos', descripcion: 'Cambie el operador (<code>^</code>, <code>~</code>, exacto) y la versión base: vea qué versiones acepta el rango y cuál instala npm.', montar: montarSemver },
      { titulo: 'Árbol de dependencias', descripcion: 'Combine paquetes y observe cuántos se instalan en total y cuándo una biblioteca queda duplicada por versiones incompatibles.', montar: montarArbol },
    ],
    teoria: String.raw`
      <h2>package.json</h2>
      <pre><code>{
  "name": "mi-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "node servidor.js", "test": "jest" },
  "dependencies":    { "koa": "^2.15.0" },
  "devDependencies": { "jest": "~29.7.0" }
}</code></pre>
      <p><code>dependencies</code> se necesitan para ejecutar; <code>devDependencies</code>, solo para desarrollar (pruebas, herramientas). <code>package-lock.json</code> registra la versión exacta de todo el árbol para que todas las instalaciones sean idénticas.</p>
      <h2>Versionado semántico</h2>
      <p>Una versión <code>MAYOR.MENOR.PARCHE</code> comunica el tipo de cambio: un <em>parche</em> corrige errores, un cambio <em>menor</em> añade funciones compatibles y uno <em>mayor</em> puede romper el código existente. Los rangos usan esa convención:</p>
      <table>
        <tr><th>Rango</th><th>Acepta</th></tr>
        <tr><td><code>^1.2.0</code></td><td>\(\ge 1.2.0\) y \(&lt; 2.0.0\)</td></tr>
        <tr><td><code>~1.2.0</code></td><td>\(\ge 1.2.0\) y \(&lt; 1.3.0\)</td></tr>
        <tr><td><code>1.2.0</code></td><td>solo esa</td></tr>
      </table>
      <h2>CommonJS y módulos ES</h2>
      <table>
        <tr><th></th><th>CommonJS</th><th>ES Modules</th></tr>
        <tr><td>Sintaxis</td><td><code>const x = require("x")</code> · <code>module.exports</code></td><td><code>import x from "x"</code> · <code>export</code></td></tr>
        <tr><td>Carga</td><td>síncrona, en tiempo de ejecución</td><td>análisis estático, asíncrona</td></tr>
        <tr><td>Optimización</td><td>difícil eliminar código muerto</td><td>permite <em>tree shaking</em></td></tr>
      </table>
      <h2>Dependencias transitivas</h2>
      <p>Si el proyecto declara \(d\) dependencias y cada una arrastra otras, el número de paquetes instalados puede ser mucho mayor que \(d\). Una vulnerabilidad en un paquete profundo afecta a todo el proyecto, por eso se auditan (<code>npm audit</code>).</p>
      <div class="recuadro">Más sobre la sintaxis de módulos en <a href="tema.html?id=modern-js-syntax">sintaxis moderna de JavaScript</a>. Los scripts de <code>package.json</code> también se usan para ejecutar las <a href="tema.html?id=test-pyramid">pruebas</a>.</div>`,
  });
})();
