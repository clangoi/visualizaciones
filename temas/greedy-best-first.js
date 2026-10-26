(function () {
  'use strict';
  const { color: C } = VIZ;
  const B = VIZ.busqueda, P = B.puzzle;

  /* ---------- Fig. 1: voraz frente a A* en un grafo ---------- */

  function montarGrafo(cuerpo) {
    B.figuraGrafo(cuerpo, {
      estrategias: [['voraz', 'Voraz (f = h)'], ['astar', 'A* (f = g + h)']],
      estrategia: 'voraz',
      semilla: 9,
    });
  }

  /* ---------- Fig. 2: calidad de las soluciones en el 8-puzzle ---------- */

  function montarPuzzle(cuerpo) {
    let semilla = 1, peso = 2, heur = 'manhattan', datos = [], hover = null;
    const N = 60;

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Heurística', opciones: [['manhattan', 'Manhattan'], ['fuera', 'Fichas fuera de lugar']], valor: heur, alCambiar: (v) => { heur = v; calcular(); } });
    ctl.rango({ etiqueta: 'Peso w de A* ponderado', min: 1, max: 5, paso: 0.25, valor: peso, formato: (v) => v.toFixed(2), alSoltar: (v) => { peso = v; calcular(); } });
    ctl.boton('Nuevas instancias', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una instancia al azar: su posición horizontal es la longitud óptima y la vertical, la de la solución encontrada. Los puntos sobre la diagonal son óptimos. Pase el cursor sobre un punto para ver sus datos.');

    function calcular() {
      const rnd = VIZ.semilla(semilla * 17);
      const h = P.HEURISTICAS[heur].f;
      datos = [];
      for (let k = 0; k < N; k++) {
        const s = P.aDistancia(rnd, 6 + Math.floor(rnd() * 25));
        const opt = P.hEstrella(s);
        const v = P.aEstrella(s, h, { voraz: true });
        const w = P.aEstrella(s, h, { peso });
        const a = P.aEstrella(s, h);
        datos.push({ opt, voraz: v, pond: w, astar: a });
      }
      leyenda.set([
        { color: C.s1, texto: 'voraz (f = h)', forma: 'punto' },
        { color: C.s2, texto: `A* ponderado (w = ${peso.toFixed(2)})`, forma: 'punto' },
        { color: C.apagado, texto: 'óptimo y cota w · C*', forma: 'linea' },
      ]);
      dibujar();
    }

    let plano = null;
    const media = (f) => datos.reduce((a, d) => a + f(d), 0) / datos.length;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(40, ...datos.map((d) => d.voraz.costo)) + 4;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 32, ymin: 0, ymax }, { etiquetaX: 'longitud óptima C*', etiquetaY: 'longitud encontrada' });
      plano.ejes();
      ctx.save();
      plano.recortar();
      VIZ.trazar(ctx, plano, [[0, 0], [32, 32]], C.apagado, 1.5, [3, 4]);
      if (peso > 1) VIZ.trazar(ctx, plano, [[0, 0], [32, 32 * peso]], C.apagado, 1, [3, 4]);
      ctx.restore();
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11);
      ctx.textAlign = 'right';
      ctx.fillText('óptimo', plano.sx(32) - 2, plano.sy(32) - 6);
      if (peso > 1 && 32 * peso <= ymax) ctx.fillText(`w · C*`, plano.sx(32) - 2, plano.sy(32 * peso) - 6);
      for (const d of datos) {
        VIZ.marcador(ctx, plano.sx(d.opt), plano.sy(d.pond.costo), C.s2, d === hover ? 6 : 4, 1);
        VIZ.marcador(ctx, plano.sx(d.opt), plano.sy(d.voraz.costo), C.s1, d === hover ? 6 : 4, 0);
      }
      const exceso = (k) => `${VIZ.fmt(100 * (media((d) => d[k].costo) / media((d) => d.opt) - 1), 3)} %`;
      lectura.set([
        ['voraz: expandidos', VIZ.entero(media((d) => d.voraz.expandidos))],
        ['voraz: sobrecosto', exceso('voraz')],
        [`w = ${peso.toFixed(2)}: expandidos`, VIZ.entero(media((d) => d.pond.expandidos))],
        [`w = ${peso.toFixed(2)}: sobrecosto`, exceso('pond')],
        ['A*: expandidos', VIZ.entero(media((d) => d.astar.expandidos))],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = null, dm = 12;
      for (const d of datos) for (const k of ['voraz', 'pond']) {
        const dd = Math.hypot(plano.sx(d.opt) - x, plano.sy(d[k].costo) - y);
        if (dd < dm) { dm = dd; mejor = d; }
      }
      if (mejor !== hover) { hover = mejor; dibujar(); }
      if (!mejor) return tip.ocultar();
      tip.mostrar(x, y, `óptimo <b>${mejor.opt}</b> movimientos` +
        VIZ.filaTooltip(C.s1, 'voraz', `${mejor.voraz.costo} · ${VIZ.entero(mejor.voraz.expandidos)} exp.`) +
        VIZ.filaTooltip(C.s2, `w = ${peso.toFixed(2)}`, `${mejor.pond.costo} · ${VIZ.entero(mejor.pond.expandidos)} exp.`) +
        `A*: <b>${VIZ.entero(mejor.astar.expandidos)}</b> expandidos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('greedy-best-first', {
    intro: String.raw`
      <p>La <strong>búsqueda voraz primero el mejor</strong> (<em>greedy best-first search</em>) expande siempre el estado que la
      heurística considera más cercano a la meta, ignorando por completo cuánto costó llegar a él: ordena la frontera por
      \(f(s) = h(s)\).</p>
      <p>Cuando la heurística es buena, va casi en línea recta hacia la meta y expande muy pocos nodos. Pero como no mira el
      costo acumulado, puede seguir un camino que «parece» prometedor y resulta caro, y no tiene garantía de optimalidad. Es la
      elección natural cuando importa encontrar <em>alguna</em> solución rápido.</p>`,
    visualizaciones: [
      {
        titulo: 'Voraz frente a A*',
        descripcion: 'Ejecute la búsqueda voraz y luego A* sobre el mismo grafo. Pruebe varios grafos («Nuevo grafo») hasta encontrar uno en que la voraz expanda menos pero devuelva un camino más caro.',
        montar: montarGrafo,
      },
      {
        titulo: 'Rapidez contra calidad en el 8-puzzle',
        descripcion: 'La búsqueda voraz expande muy pocos nodos, pero sus soluciones pueden ser varias veces más largas que la óptima. A* ponderado se mueve entre ambos extremos: cambie \\(w\\) y observe los puntos naranjos.',
        montar: montarPuzzle,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <p>Es el algoritmo genérico de <a href="tema.html?id=heuristic-search">búsqueda primero el mejor</a> con prioridad \(h\):</p>
      <pre><code>VORAZ(s₀):
    ABIERTA ← {s₀} con prioridad h(s₀);  CERRADA ← ∅
    mientras ABIERTA ≠ ∅:
        u ← extraer de ABIERTA el estado con menor h
        si u es meta: devolver el camino hasta u
        CERRADA ← CERRADA ∪ {u}
        para cada sucesor v de u que no esté en ABIERTA ni en CERRADA:
            padre(v) ← u;  insertar v en ABIERTA con prioridad h(v)
    devolver «sin solución»</code></pre>
      <p>Una variante aún más agresiva termina en cuanto <em>genera</em> una meta, sin esperar a extraerla.</p>

      <h2>Propiedades</h2>
      <ul>
        <li><strong>No es óptima:</strong> aun con una heurística admisible, puede devolver un camino mucho más caro.</li>
        <li><strong>Completitud:</strong> en un espacio finito con detección de duplicados (lista CERRADA) termina siempre. Sin
        ella, o en espacios infinitos, puede quedar atrapada siguiendo una rama sin fin en la que \(h\) decrece.</li>
        <li><strong>Costo:</strong> en el peor caso, \(O(b^m)\) con \(m\) la profundidad máxima; en la práctica, con una buena
        heurística, suele ser casi lineal en la longitud de la solución.</li>
      </ul>

      <h2>Mínimos locales y mesetas</h2>
      <p>La búsqueda voraz sufre cuando la heurística engaña: un <em>mínimo local</em> es una región donde \(h\) es baja pero
      que no conduce a la meta (un callejón sin salida), y una <em>meseta</em> es una región donde \(h\) es constante y no guía.
      En ambos casos la búsqueda debe expandir toda la región antes de salir de ella. A diferencia de la búsqueda local, la
      voraz sí escapa, porque guarda la frontera completa.</p>

      <h2>De la búsqueda voraz a A*</h2>
      <p>A* ponderado ordena por \(f_w(s) = g(s) + w\,h(s)\). Dividiendo por \(w\), es lo mismo que ordenar por
      \(\tfrac{1}{w} g(s) + h(s)\):</p>
      <table>
        <thead><tr><th>\(w\)</th><th>Algoritmo</th><th>Garantía</th></tr></thead>
        <tbody>
          <tr><td>\(0\)</td><td>costo uniforme (Dijkstra)</td><td>óptimo</td></tr>
          <tr><td>\(1\)</td><td><a href="tema.html?id=a-star">A*</a></td><td>óptimo si \(h\) es admisible</td></tr>
          <tr><td>\(1 &lt; w &lt; \infty\)</td><td>A* ponderado</td><td>costo \(\le w \cdot C^*\)</td></tr>
          <tr><td>\(\infty\)</td><td>voraz</td><td>ninguna</td></tr>
        </tbody>
      </table>
      <div class="recuadro"><strong>Cota de A* ponderado.</strong> Sea \(n\) un nodo de un camino óptimo en ABIERTA. Cuando A*
      ponderado extrae una meta \(t\), \(g(t) = f_w(t) \le f_w(n) = g^*(n) + w\,h(n) \le w\,(g^*(n) + h^*(n)) = w\,C^*\).</div>
      <p>Los algoritmos <em>anytime</em> aprovechan esta escala: encuentran pronto una solución con \(w\) grande y la mejoran
      reduciendo \(w\) mientras haya tiempo.</p>`,
  });
})();
