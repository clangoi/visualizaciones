(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  const PRODUCTOS = [
    { n: 'lápiz', p: 8, c: 'útiles' }, { n: 'cuaderno', p: 25, c: 'útiles' }, { n: 'mochila', p: 60, c: 'bolsos' }, { n: 'regla', p: 12, c: 'útiles' },
    { n: 'estuche', p: 30, c: 'bolsos' }, { n: 'tijeras', p: 18, c: 'útiles' }, { n: 'bolso', p: 85, c: 'bolsos' }, { n: 'goma', p: 5, c: 'útiles' },
  ];

  /* ---------- Fig. 1: filter → map → reduce ---------- */

  function montarCadena(cuerpo) {
    const est = { umbral: 15, iva: true, red: 'suma' };
    let k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'filter: precio ≥', min: 0, max: 90, valor: est.umbral, formato: (v) => `$${v}`, alCambiar: (v) => { est.umbral = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'map: sumar IVA (19 %)', valor: true, alCambiar: (v) => { est.iva = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'reduce', valor: est.red, opciones: [['suma', 'total (suma)'], ['max', 'máximo'], ['cuenta', 'cantidad']], alCambiar: (v) => { est.red = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    cuerpo.appendChild(el('pre', { class: 'codigo-bdd' }, 'productos\n  .filter(p => p.precio >= umbral)\n  .map(p => p.precio * 1.19)\n  .reduce((acc, x) => acc + x, 0)'));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 232 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'pasa el filtro' }, { color: C.inactivo, texto: 'descartado' }, { color: C.s2, texto: 'valor transformado' }, { color: C.s6, texto: 'acumulador' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada método devuelve un arreglo nuevo (o un valor) sin modificar el original. Avance con «Un paso» para ver cómo <code>reduce</code> acumula.');

    const pasa = () => PRODUCTOS.filter((p) => p.p >= est.umbral);
    const mapeado = () => pasa().map((p) => (est.iva ? Math.round(p.p * 1.19 * 100) / 100 : p.p));
    const acumulados = () => { let a = est.red === 'max' ? -Infinity : 0; return mapeado().map((x) => (a = est.red === 'suma' ? a + x : est.red === 'max' ? Math.max(a, x) : a + 1)); };
    function iniciar() { k = 0; return (function* () { const n = mapeado().length; for (k = 1; k <= n; k++) yield; })(); }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const w = (Wd - 70) / PRODUCTOS.length, izq = 62;
      const filas = [['original', 18], ['filter', 78], ['map', 138]];
      filas.forEach(([t, y]) => W.texto(ctx, t, 4, y + 18, { tam: 11, alinear: 'left', peso: 600 }));
      const ok = PRODUCTOS.map((p) => p.p >= est.umbral), m = mapeado();
      let j = 0;
      PRODUCTOS.forEach((p, i) => {
        const x = izq + i * w;
        W.caja(ctx, x + 1, 18, w - 3, 36, `${p.n.slice(0, 6)}\n$${p.p}`, { borde: ok[i] ? C.s1 : C.inactivo, relleno: ok[i] ? VIZ.alfa(C.s1, 0.15) : C.superficie, tam: 10, peso: 500 });
        if (ok[i]) {
          W.caja(ctx, x + 1, 78, w - 3, 36, `$${p.p}`, { borde: C.s1, relleno: VIZ.alfa(C.s1, 0.15), tam: 11 });
          const usado = j < k;
          W.caja(ctx, x + 1, 138, w - 3, 36, `$${VIZ.fmt(m[j], 5)}`, { borde: usado ? C.s6 : C.s2, relleno: usado ? VIZ.alfa(C.s6, 0.2) : VIZ.alfa(C.s2, 0.15), tam: 10, peso: usado ? 700 : 500 });
          j++;
        }
      });
      const ac = acumulados(), valor = k > 0 ? ac[k - 1] : (est.red === 'max' ? -Infinity : 0);
      const txt = est.red === 'cuenta' ? String(k > 0 ? ac[k - 1] : 0) : Number.isFinite(valor) ? `$${VIZ.fmt(valor, 6)}` : '—';
      W.caja(ctx, izq, 188, Math.min(260, Wd - izq - 8), 34, `acumulador = ${txt}`, { borde: C.s6, relleno: VIZ.alfa(C.s6, 0.15), tam: 12, peso: 700 });
      W.texto(ctx, 'reduce', 4, 205, { tam: 11, alinear: 'left', peso: 600 });
      registro.textContent = !m.length ? 'Ningún producto pasa el filtro: reduce devuelve su valor inicial.' : k === 0 ? `${m.length} elemento(s) pasan el filtro. Pulse «Un paso» para acumular.` : `reduce procesa el elemento ${k} de ${m.length} ($${VIZ.fmt(m[k - 1], 5)}): acumulador = ${txt}.`;
      lectura.set([['original', `${PRODUCTOS.length} elementos`], ['después de filter', `${m.length} elementos`], ['resultado final', est.red === 'cuenta' ? String(m.length) : m.length ? `$${VIZ.fmt(ac[ac.length - 1], 6)}` : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), w = (lienzo.ancho - 70) / PRODUCTOS.length, i = Math.floor((x - 62) / w);
      if (i < 0 || i >= PRODUCTOS.length) return tip.ocultar();
      tip.mostrar(x, y, `<b>${PRODUCTOS[i].n}</b><br>$${PRODUCTOS[i].p} · ${PRODUCTOS[i].c}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: elegir el método adecuado ---------- */

  const PRED = {
    'par': { f: (x) => x % 2 === 0, t: 'x => x % 2 === 0' }, 'mayor5': { f: (x) => x > 5, t: 'x => x > 5' }, 'menor10': { f: (x) => x < 10, t: 'x => x < 10' }, 'neg': { f: (x) => x < 0, t: 'x => x < 0' },
  };
  function montarMetodos(cuerpo) {
    let pred = 'mayor5', semilla = 1, datos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Predicado', valor: pred, opciones: Object.entries(PRED).map(([k, p]) => [k, p.t]), alCambiar: (v) => { pred = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; dibujar(); });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'El mismo arreglo y el mismo predicado producen resultados de forma distinta según el método: observe cuándo se obtiene un arreglo, un elemento, un booleano o un valor acumulado.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const rnd = VIZ.semilla(semilla * 5);
      datos = Array.from({ length: 7 }, () => Math.floor(rnd() * 20) - 3);
      const f = PRED[pred].f;
      const filas = [
        ['arr.map(x => x * 2)', 'transforma cada elemento', `[${datos.map((x) => x * 2).join(', ')}]`],
        [`arr.filter(${PRED[pred].t})`, 'se queda con los que cumplen', `[${datos.filter(f).join(', ')}]`],
        [`arr.find(${PRED[pred].t})`, 'primer elemento que cumple', String(datos.find(f))],
        [`arr.some(${PRED[pred].t})`, '¿alguno cumple?', String(datos.some(f))],
        [`arr.every(${PRED[pred].t})`, '¿todos cumplen?', String(datos.every(f))],
        ['arr.reduce((a, x) => a + x, 0)', 'combina todo en un valor', String(datos.reduce((a, x) => a + x, 0))],
        ['[...arr].sort((a, b) => a - b)', 'ordena (copia primero: sort muta)', `[${[...datos].sort((a, b) => a - b).join(', ')}]`],
      ];
      tabla.replaceChildren(el('tr', null, el('th', null, 'Expresión'), el('th', null, 'Qué hace'), el('th', null, 'Resultado')), ...filas.map(([a, b, c]) => el('tr', null, el('td', null, a), el('td', null, b), el('td', null, c))));
      registro.textContent = `arr = [${datos.join(', ')}]. ${datos.filter(f).length} de ${datos.length} elementos cumplen el predicado.`;
    }
    dibujar();
  }

  VIZ.registrarTema('array-methods', {
    intro: String.raw`
      <p>En vez de escribir un bucle con contadores e índices, JavaScript permite describir <strong>qué</strong> se quiere con métodos como <code>map</code>, <code>filter</code> y <code>reduce</code>.
      Cada uno recibe una función y la aplica a todos los elementos de un arreglo.</p>
      <p>Encadenados forman una <em>tubería</em> de datos: filtrar lo relevante, transformarlo y resumirlo. Como no mutan el arreglo original, el código es más fácil de razonar, y es el estilo que usa React para manipular listas.</p>`,
    visualizaciones: [
      { titulo: 'Tubería filter → map → reduce', descripcion: 'Cambie el umbral del filtro, el IVA y la operación de <code>reduce</code>; avance paso a paso para ver cómo se acumula el resultado.', montar: montarCadena },
      { titulo: 'Qué método usar', descripcion: 'Pruebe distintos predicados y compare lo que devuelven <code>map</code>, <code>filter</code>, <code>find</code>, <code>some</code>, <code>every</code>, <code>reduce</code> y <code>sort</code>.', montar: montarMetodos },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Para un arreglo \(a = [a_0, \dots, a_{n-1}]\) y una función \(f\):</p>
      \[ \texttt{map}(f)(a) = [f(a_0), \dots, f(a_{n-1})], \qquad \texttt{filter}(p)(a) = [a_i : p(a_i)], \]
      \[ \texttt{reduce}(g, s_0)(a) = g(\dots g(g(s_0, a_0), a_1)\dots, a_{n-1}). \]
      <pre><code>reduce(g, acc, a):
    para cada x en a:
        acc ← g(acc, x)
    devolver acc</code></pre>
      <h2>Costo y propiedades</h2>
      <ul>
        <li>Cada método recorre el arreglo una vez: \(O(n)\); una cadena de \(k\) métodos cuesta \(O(kn)\) y crea arreglos intermedios.</li>
        <li><code>map</code> conserva el largo; <code>filter</code> lo reduce; <code>reduce</code> lo colapsa a un solo valor, que puede ser un número, un objeto o incluso otro arreglo.</li>
        <li><code>find</code>, <code>some</code> y <code>every</code> se detienen al decidir (cortocircuito).</li>
        <li><code>sort</code> <em>sí</em> modifica el arreglo; copie antes con <code>[...arr]</code> o <code>toSorted()</code>.</li>
        <li>\(\texttt{map}(f) \circ \texttt{map}(g) = \texttt{map}(f \circ g)\): dos <code>map</code> seguidos pueden fusionarse en uno.</li>
      </ul>
      <div class="recuadro">Las funciones que reciben otras funciones se llaman de <em>orden superior</em>, y dependen de las <a href="tema.html?id=scope-closures">clausuras</a> para recordar las variables externas que usan.</div>`,
  });
})();
