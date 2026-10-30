(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const R = M.RED_ALARMA;

  const grafo = () => M.dag(R.nodos.map((n, i) => [n.id, R.pos[i][0], R.pos[i][1]]), R.nodos.flatMap((n, i) => n.padres.map((p) => [p, i])));

  /* ---------- Fig. 1: evidencia y creencias ---------- */

  function montarEvidencia(cuerpo) {
    let ev = {}, verTabla = 2, previo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tabla de probabilidad de', opciones: R.nodos.map((n, i) => [i, `${n.id}: ${n.nombre}`]), valor: verTabla, alCambiar: (v) => { verTabla = +v; dibujar(); } });
    ctl.boton('Juan y María llaman', () => { ev = { 3: 1, 4: 1 }; dibujar(); }, { primario: true });
    ctl.boton('… y hubo un terremoto', () => { ev = { 3: 1, 4: 1, 1: 1 }; dibujar(); });
    ctl.boton('Quitar evidencia', () => { ev = {}; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'evidencia: sí', forma: 'punto' },
      { color: C.s8, texto: 'evidencia: no', forma: 'punto' },
      { color: C.superficie, texto: 'sin observar (bajo el nodo, P(sí | evidencia))', borde: C.tinta },
      { color: C.s2, texto: 'subió respecto del paso anterior', forma: 'linea' },
    ]);
    const tabla = M.tabla(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para fijarlo en sí, luego en no, luego volver a sin observar. Explicar lejos (<em>explaining away</em>): con ambas llamadas el robo sube a 28 %; si además se observa un terremoto, la alarma ya está explicada y el robo baja a 0,3 %.');
    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      const { marg, evidencia } = M.posteriores(R, ev);
      geo = VIZ.grafo.dibujar(lienzo, grafo(), {
        nodo: (i) => (ev[i] === 1 ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : ev[i] === 0 ? { relleno: C.s8, borde: C.s8, texto: C.sobre } : { anillo: previo && marg[i] > previo[i] + 1e-6 ? C.s2 : null }),
        debajo: (i) => `${R.nodos[i].nombre}: ${ev[i] != null ? (ev[i] ? 'sí' : 'no') : M.pct(marg[i], marg[i] < 0.01 ? 2 : 1)}`,
        arista: () => ({ color: C.apagado, ancho: 1.5 }),
      });
      previo = marg;
      const nd = R.nodos[verTabla];
      const filas = Object.entries(nd.cpt).sort((a, b) => b[0].localeCompare(a[0])).map(([k, p]) => [...(k === '' ? [] : k.split(',').map((v) => (v === '1' ? 'sí' : 'no'))), VIZ.fmt(p, 3), VIZ.fmt(1 - p, 3)]);
      tabla.set([...nd.padres.map((p) => R.nodos[p].id), `P(${nd.id} = sí | padres)`, `P(${nd.id} = no | padres)`], filas);
      lectura.set([
        ['P(evidencia)', VIZ.fmt(evidencia, 4)],
        ['P(robo | evidencia)', M.pct(marg[0], 2)],
        ['P(terremoto | evidencia)', M.pct(marg[1], 2)],
        ['P(alarma | evidencia)', M.pct(marg[2], 2)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => {
      const { x, y } = lienzo.posicion(e), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i < 0) return;
      if (ev[i] == null) ev[i] = 1; else if (ev[i] === 1) ev[i] = 0; else delete ev[i];
      ev = { ...ev };
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i < 0) return tip.ocultar();
      const n = R.nodos[i];
      tip.mostrar(x, y, `<b>${n.nombre}</b><br>padres: ${n.padres.length ? n.padres.map((p) => R.nodos[p].nombre).join(', ') : 'ninguno'}<br>parámetros: <b>${2 ** n.padres.length}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: cuántos parámetros ---------- */

  function montarParametros(cuerpo) {
    let k = 3, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Máximo de padres por nodo k', min: 0, max: 6, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'tabla conjunta completa: 2ⁿ − 1', forma: 'linea' },
      { color: C.s1, texto: 'red bayesiana: a lo más n · 2ᵏ', forma: 'linea' },
      { color: C.s6, texto: 'todas independientes: n', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Variables binarias. Escala logarítmica: con 30 variables la tabla conjunta necesita más de mil millones de números; una red con a lo más 3 padres por nodo, 240.');
    let pl = null;
    const S = [[(n) => 2 ** n - 1, C.s8, 'conjunta'], [(n) => n * 2 ** Math.min(k, n - 1), C.s1, 'red bayesiana'], [(n) => n, C.s6, 'independientes']];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 30, ymin: 1, ymax: 2 ** 30 }, { etiquetaX: 'variables n', etiquetaY: 'parámetros', logY: true, formatoY: (v) => (v >= 1e6 ? `10^${Math.round(Math.log10(v))}` : VIZ.entero(v)) });
      pl.ejes();
      for (const [f, c] of S) {
        VIZ.trazar(ctx, pl, Array.from({ length: 30 }, (_, i) => [i + 1, f(i + 1)]), c, 2);
        if (hover) VIZ.marcador(ctx, pl.sx(hover), pl.sy(f(hover)), c, 4);
      }
      lectura.set([
        ['n = 5 (la alarma): conjunta · red', `31 · ${M.suma(R.nodos.map((nd) => 2 ** nd.padres.length))}`],
        ['n = 30: conjunta', VIZ.entero(2 ** 30 - 1)],
        [`n = 30: red con k = ${k}`, VIZ.entero(30 * 2 ** k)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(30, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + S.map(([f, c, t]) => VIZ.filaTooltip(c, t, VIZ.entero(f(hover)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bayesian-networks', {
    intro: String.raw`
      <p>Una <strong>red bayesiana</strong> describe una distribución conjunta de muchas variables con un <strong>grafo dirigido
      acíclico</strong> (DAG) y una <strong>tabla de probabilidad condicional</strong> (CPT) por nodo: la probabilidad de cada valor
      del nodo dado cada combinación de valores de sus padres.</p>
      <p>El ejemplo clásico de Judea Pearl: una alarma que puede dispararse por un robo o por un terremoto, y dos vecinos, Juan y María,
      que a veces llaman cuando la oyen. Con la red se puede razonar en cualquier dirección: de causas a efectos y de efectos a causas.</p>`,
    visualizaciones: [
      {
        titulo: 'Evidencia y creencias',
        descripcion: 'Fije observaciones haciendo clic en los nodos y vea cómo cambian las probabilidades de los demás. Pruebe los dos botones en orden.',
        montar: montarEvidencia,
      },
      {
        titulo: 'Cuántos parámetros',
        descripcion: 'Números necesarios para especificar la distribución conjunta de n variables binarias, completa o factorizada con una red.',
        montar: montarParametros,
      },
    ],
    teoria: String.raw`
      <h2>Factorización</h2>
      <p>Una red bayesiana sobre \(X_1, \dots, X_n\) define</p>
      \[ P(X_1, \dots, X_n) = \prod_{i=1}^n P\bigl(X_i \mid \operatorname{Pa}(X_i)\bigr). \]
      <p>Para la alarma: \(P(B, E, A, J, M) = P(B)\,P(E)\,P(A \mid B, E)\,P(J \mid A)\,P(M \mid A)\): 1 + 1 + 4 + 2 + 2 = 10 números en lugar de 31.</p>
      <h2>Qué afirma el grafo</h2>
      <div class="recuadro"><p><strong>Condición de Markov local.</strong> Cada variable es condicionalmente independiente de sus no descendientes
      dados sus padres. Por ejemplo, \(J \perp\!\!\!\perp B, E, M \mid A\): si se sabe si sonó la alarma, saber si hubo robo no cambia la
      probabilidad de que Juan llame.</p></div>
      <p>Todas las independencias implicadas se leen con el criterio de <a href="tema.html?id=d-separation">d-separación</a>.</p>
      <h2>Razonamiento</h2>
      <table>
        <tr><th>Tipo</th><th>Ejemplo</th><th>Dirección</th></tr>
        <tr><td>Causal (predictivo)</td><td>\(P(J \mid B)\)</td><td>de causas a efectos</td></tr>
        <tr><td>Diagnóstico</td><td>\(P(B \mid J, M)\)</td><td>de efectos a causas</td></tr>
        <tr><td>Intercausal</td><td>\(P(B \mid A, E) &lt; P(B \mid A)\)</td><td>entre causas de un mismo efecto (<em>explaining away</em>)</td></tr>
      </table>
      <p>Las probabilidades se calculan sumando la conjunta sobre las variables no observadas (<a href="tema.html?id=probabilistic-inference">marginalización</a>).
      Esta página lo hace por enumeración, que cuesta \(O(2^n)\); la eliminación de variables aprovecha la estructura.</p>
      <h2>Construcción</h2>
      <p>El grafo se obtiene de conocimiento experto (típicamente causal: flechas de causas a efectos producen redes ralas) o se aprende de
      datos con pruebas de <a href="tema.html?id=conditional-independence">independencia condicional</a> (algoritmo PC) o maximizando un puntaje
      como BIC. Las CPT se estiman con frecuencias, con suavizado de Laplace para evitar ceros.</p>`,
  });
})();