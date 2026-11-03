(function () {
  'use strict';
  const { color: C } = VIZ;
  const L = VIZ.grafo.LETRAS;
  const num = (v) => VIZ.fmt(v);

  /* ---------- Red dirigida de la primera figura ---------- */

  const POS = [[0.05, 0.5], [0.28, 0.14], [0.28, 0.86], [0.52, 0.5], [0.76, 0.14], [0.76, 0.86], [0.95, 0.5]];
  // [u, v]: A→B, A→C, B→C, B→D, C→D, B→E, D→E, D→F, C→F, E→G, F→G, F→E (un arco de vuelta, para que haya ciclos)
  const PARES = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [3, 5], [2, 5], [4, 6], [5, 6], [5, 4]];
  const nombreVar = (u, v) => `x${L[u]}${L[v]}`;

  function pesos(semilla) {
    const rnd = VIZ.semilla(semilla * 977 + 13);
    return PARES.map(() => 1 + Math.floor(rnd() * 9));
  }
  // Camino más corto como LP: min Σ w x  s.a.  salida − entrada = +1 en s, −1 en t, 0 en el resto;  x ≥ 0.
  function resolverLP(arcos, s, t) {
    const n = POS.length;
    const A = Array.from({ length: n }, (_, i) => arcos.map((a) => (a.u === i ? 1 : 0) - (a.v === i ? 1 : 0)));
    const b = Array.from({ length: n }, (_, i) => (i === s && s !== t ? 1 : i === t && s !== t ? -1 : 0));
    const r = VIZ.opt.lp(arcos.map((a) => a.w), A, Array(n).fill('='), b, { max: false });
    if (r.estado !== 'optimo') return r;
    return { ...r, x: r.x.map((v) => Math.round(v * 1e6) / 1e6) };
  }
  // Bellman–Ford: distancia de s a t (para contrastar con el LP).
  function distancia(arcos, s, t) {
    const d = Array(POS.length).fill(Infinity);
    d[s] = 0;
    for (let k = 0; k < POS.length; k++) arcos.forEach((a) => { if (d[a.u] + a.w < d[a.v]) d[a.v] = d[a.u] + a.w; });
    return d[t];
  }
  const signo = (v) => String(v).replace('-', '−');

  /* ---------- Fig. 1: el LP del camino más corto ---------- */

  function montarLP(cuerpo) {
    let semilla = 1, s = 0, t = 6, proximo = 't', geo = null;
    let W = pesos(semilla);
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Nuevos pesos', () => { semilla++; W = pesos(semilla); dibujar(); }, { primario: true });
    ctl.boton('Origen A, destino G', () => { s = 0; t = 6; proximo = 't'; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'origen (b = +1)' }, { color: C.s7, texto: 'destino (b = −1)' },
      { color: C.s2, texto: 'arco con x = 1', forma: 'linea' }, { color: C.eje, texto: 'arco con x = 0', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para cambiar de origen y de destino, alternando: el primer clic fija el destino y el siguiente el origen. Las etiquetas de los arcos son sus pesos. Cada fila de la lista es una ecuación de conservación con los valores de x que devolvió el Simplex.');

    function dibujar() {
      lienzo.limpiar();
      const arcos = PARES.map(([u, v], e) => ({ u, v, w: W[e] }));
      const r = resolverLP(arcos, s, t);
      const dij = distancia(arcos, s, t);
      const x = r.estado === 'optimo' ? r.x : arcos.map(() => 0);
      const g = { dirigido: true, nodos: POS.map(([px, py], i) => ({ x: px, y: py, etiqueta: L[i] })), aristas: arcos.map((a) => ({ u: a.u, v: a.v, w: a.w })) };
      geo = VIZ.grafo.dibujar(lienzo, g, {
        pesos: true,
        nodo: (i) => (i === s ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : i === t ? { relleno: C.s7, borde: C.s7, texto: C.sobre } : {}),
        arista: (a, e) => (x[e] > 0.5 ? { color: C.s2, ancho: 4 } : { color: C.eje, ancho: 1.5 }),
        colorPeso: (a, e) => (x[e] > 0.5 ? C.s2 : C.tinta2),
      });
      const filas = [VIZ.el('div', null, `min ${arcos.map((a) => `${a.w}${nombreVar(a.u, a.v)}`).join(' + ')}`)];
      POS.forEach((_, i) => {
        const sale = arcos.map((a, e) => (a.u === i ? e : -1)).filter((e) => e >= 0), entra = arcos.map((a, e) => (a.v === i ? e : -1)).filter((e) => e >= 0);
        const term = (e, sg) => `${sg}${nombreVar(arcos[e].u, arcos[e].v)}`;
        const izq = [...sale.map((e) => term(e, '+')), ...entra.map((e) => term(e, '−'))].join(' ').replace(/^\+/, '');
        const b = i === s && s !== t ? 1 : i === t && s !== t ? -1 : 0;
        const val = sale.reduce((q, e) => q + x[e], 0) - entra.reduce((q, e) => q + x[e], 0);
        filas.push(VIZ.el('div', null, `${L[i]}: ${izq} = ${signo(b)}   → ${signo(num(val))} ${Math.abs(val - b) < 1e-6 ? '✓' : '✗'}`));
      });
      lista.replaceChildren(...filas);
      const fracc = x.filter((v) => v > 1e-6 && Math.abs(v - 1) > 1e-6).length;
      if (r.estado !== 'optimo') {
        registro.textContent = `No hay camino de ${L[s]} a ${L[t]}: el LP es infactible.`;
        lectura.set([['origen → destino', `${L[s]} → ${L[t]}`], ['LP', 'infactible'], ['Bellman–Ford', '∞']]);
        return;
      }
      const ruta = [s];
      for (let u = s, k = 0; u !== t && k < 20; k++) { const e = arcos.findIndex((a, q) => a.u === u && x[q] > 0.5); if (e < 0) break; u = arcos[e].v; ruta.push(u); }
      registro.textContent = s === t ? 'Origen y destino coinciden: x = 0.' : `Camino óptimo ${ruta.map((i) => L[i]).join(' → ')} con costo ${num(r.z)}; el LP devolvió solo valores 0 y 1, aunque nunca se le exigió que fueran enteros.`;
      lectura.set([
        ['origen → destino', `${L[s]} → ${L[t]}`], ['valor del LP', num(r.z)], ['Bellman–Ford', num(dij)],
        ['arcos con x = 1', String(x.filter((v) => v > 0.5).length)], ['variables fraccionarias', String(fracc)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i < 0) return;
      if (proximo === 't') { t = i; proximo = 's'; } else { s = i; proximo = 't'; }
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: mezclas de caminos y vértices ---------- */

  function montarMezcla(cuerpo) {
    let lam = 0.5, cA = 2, cB = 4;
    const FIJOS = { sa: 3, bt: 2 }; // costos de A→T y B→T (los de S→A y S→B se eligen)
    const ctl = VIZ.controles(cuerpo);
    const sl = ctl.rango({ etiqueta: 'Fracción por el camino S→A→T', min: 0, max: 1, paso: 0.05, valor: lam, formato: (v) => num(v), alCambiar: (v) => { lam = v; dibujar(); } });
    const sA = ctl.rango({ etiqueta: 'Costo de S→A', min: 1, max: 9, valor: cA, alCambiar: (v) => { cA = v; dibujar(); } });
    const sB = ctl.rango({ etiqueta: 'Costo de S→B', min: 1, max: 9, valor: cB, alCambiar: (v) => { cB = v; dibujar(); } });
    ctl.boton('Empate de caminos', () => { if (cA + FIJOS.sa - FIJOS.bt > 9) { cA = 8; sA.valor = cA; } cB = cA + FIJOS.sa - FIJOS.bt; sB.valor = cB; dibujar(); }, { primario: true });
    VIZ.subtitulo(cuerpo, 'Flujo de una unidad de S a T');
    const red = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 170, altoMax: 240 });
    VIZ.subtitulo(cuerpo, 'Costo según la mezcla de caminos');
    const graf = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 220, altoMax: 330 });
    const tip = VIZ.tooltip(graf);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'flujo x del arco (grosor)', forma: 'linea' }, { color: C.s1, texto: 'costo de la mezcla', forma: 'linea' },
      { color: C.s2, texto: 'mezcla elegida', forma: 'punto' }, { color: C.s6, texto: 'vértice que devuelve el Simplex', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva la fracción o haga clic o arrastre sobre la curva de costo. Cambie los costos para romper o crear un empate: con empate, toda la recta de mezclas es óptima, pero el Simplex solo se detiene en un vértice (0 o 1).');
    const NOD = [[0.07, 0.5, 'S'], [0.45, 0.14, 'A'], [0.45, 0.86, 'B'], [0.93, 0.5, 'T']];
    const ARC = () => [[0, 1, cA], [1, 3, FIJOS.sa], [0, 2, cB], [2, 3, FIJOS.bt]];
    let plano = null;
    const costos = () => ({ p1: cA + FIJOS.sa, p2: cB + FIJOS.bt });
    const costoMezcla = (l) => { const { p1, p2 } = costos(); return l * p1 + (1 - l) * p2; };
    function lpVertice() {
      const arc = ARC();
      const r = VIZ.opt.lp(arc.map((a) => a[2]), [[1, 0, 1, 0], [-1, 1, 0, 0], [0, 0, -1, 1], [0, -1, 0, -1]], ['=', '=', '=', '='], [1, 0, 0, -1], { max: false });
      return r.estado === 'optimo' ? r.x : null;
    }
    function dibujar() {
      const arc = ARC(), x = [lam, lam, 1 - lam, 1 - lam];
      red.limpiar();
      VIZ.grafo.dibujar(red, { dirigido: true, nodos: NOD.map(([px, py, l]) => ({ x: px, y: py, etiqueta: l })), aristas: arc.map(([u, v, w], e) => ({ u, v, w: `c=${w}  x=${num(x[e])}` })) }, {
        pesos: true,
        nodo: (i) => (i === 0 ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : i === 3 ? { relleno: C.s7, borde: C.s7, texto: C.sobre } : {}),
        arista: (a, e) => ({ color: x[e] > 1e-9 ? C.s2 : C.eje, ancho: 1.5 + 4 * x[e] }),
        colorPeso: (a, e) => (x[e] > 1e-9 ? C.s2 : C.tinta2),
      });
      graf.limpiar();
      const { p1, p2 } = costos();
      const lo = Math.min(p1, p2), hi = Math.max(p1, p2), mrg = Math.max(0.8, (hi - lo) * 0.25);
      plano = VIZ.plano(graf, { xmin: 0, xmax: 1, ymin: Math.max(0, lo - mrg), ymax: hi + mrg }, { etiquetaX: 'fracción λ por S→A→T', etiquetaY: 'costo', formatoX: (v) => num(v) });
      plano.ejes();
      VIZ.trazar(graf.ctx, plano, [[0, p2], [1, p1]], C.s1, 2);
      const v = lpVertice();
      if (v) VIZ.marcador(graf.ctx, plano.sx(v[0]), plano.sy(costoMezcla(v[0])), C.s6, 6);
      VIZ.marcador(graf.ctx, plano.sx(lam), plano.sy(costoMezcla(lam)), C.s2, 4.5);
      const empate = p1 === p2, vertice = lam === 0 || lam === 1;
      registro.textContent = empate
        ? `Los dos caminos cuestan ${p1}: todas las mezclas cuestan lo mismo (recta horizontal). Son óptimas, pero solo λ = 0 y λ = 1 son vértices.`
        : `Camino S→A→T cuesta ${p1} y S→B→T cuesta ${p2}: el costo baja linealmente hacia el más barato, así que el mínimo está en el vértice λ = ${p1 < p2 ? 1 : 0}.`;
      lectura.set([
        ['λ elegido', num(lam)], ['costo de la mezcla', num(costoMezcla(lam))],
        ['mejor camino', num(Math.min(p1, p2))], ['vértice del Simplex', v ? `λ = ${num(v[0])}` : '—'],
        ['¿es un vértice?', vertice ? 'sí' : 'no (punto medio de dos caminos)'],
      ]);
    }
    red.alDibujar = dibujar;
    graf.alDibujar = dibujar;
    const fijar = (ev) => {
      if (!plano) return;
      const { x, y } = graf.posicion(ev);
      if (!plano.dentro(x, y)) { tip.ocultar(); return; }
      const l = Math.min(1, Math.max(0, Math.round(plano.ix(x) * 20) / 20));
      if (ev.buttons) { lam = l; sl.valor = l; dibujar(); }
      tip.mostrar(x, y, `λ = <b>${num(l)}</b><br>costo <b>${num(costoMezcla(l))}</b>`);
    };
    graf.canvas.style.cursor = 'crosshair';
    graf.canvas.addEventListener('pointermove', fijar);
    graf.canvas.addEventListener('pointerdown', fijar);
    graf.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('shortest-path-lp', {
    intro: String.raw`
      <p>Encontrar el camino más corto entre dos nodos suele resolverse con Dijkstra o Bellman–Ford, pero también es un <strong>programa lineal</strong>: se envía <em>una unidad de flujo</em> del origen al destino
      y se minimiza el costo total de los arcos usados. La conservación de flujo obliga a que lo que sale del origen llegue al destino pasando por nodos intermedios.</p>
      <p>Lo sorprendente es que no hace falta exigir que las variables valgan 0 o 1: el Simplex siempre devuelve un vértice, y los vértices de este poliedro son enteros, de modo que la solución óptima es un camino de verdad.
      Esa es la mejor puerta de entrada a la idea de <em>unimodularidad</em>.</p>`,
    visualizaciones: [
      {
        titulo: 'El camino más corto como programa lineal',
        descripcion: 'Cambie origen y destino con clics y genere nuevos pesos: el LP siempre devuelve valores 0 o 1 y coincide con Bellman–Ford. Mire la lista de ecuaciones: cada una es la conservación en un nodo.',
        montar: montarLP,
      },
      {
        titulo: 'Empates, mezclas y vértices',
        descripcion: 'Reparta la unidad entre dos caminos con la fracción λ y vea el costo en la curva. Pulse «Empate de caminos»: toda mezcla es óptima, pero solo los extremos λ = 0 y λ = 1 son vértices.',
        montar: montarMezcla,
      },
    ],
    teoria: String.raw`
      <h2>Formulación</h2>
      <p>Sea \(G = (V, E)\) dirigido con pesos \(w_{ij}\) y sean \(s\) el origen y \(t\) el destino. Con una variable \(x_{ij}\) por arco, que indica cuánto flujo pasa por él:</p>
      \[ \min \sum_{(i,j)\in E} w_{ij}\,x_{ij} \quad \text{s.a.} \quad \sum_{j} x_{ij} - \sum_{k} x_{ki} = \begin{cases} +1 & i = s\\ -1 & i = t\\ \;\;0 & \text{otro caso}\end{cases}, \qquad x \ge 0. \]
      <p>Es el <a href="tema.html?id=network-flow-model">problema de flujo</a> con oferta \(+1\) en \(s\) y demanda \(1\) en \(t\), sin capacidades (basta \(x \le 1\), que se cumple sola si los pesos son positivos).</p>
      <h2>Por qué la solución es entera</h2>
      <p>La matriz de restricciones es la matriz de incidencia nodo-arco \(N\), totalmente unimodular, y el lado derecho \(b\) es entero. Por la regla de Cramer, toda solución básica es \(x_B = B^{-1}b\) con \(\det B = \pm 1\), luego entera. Como el LP (con pesos positivos) está acotado, el Simplex termina en un vértice, y un vértice es un camino:</p>
      <ul>
        <li>Con \(x_{ij}\in\{0,1\}\) y conservación, el soporte de \(x\) es un camino de \(s\) a \(t\) más, posiblemente, ciclos desconectados.</li>
        <li>Con pesos positivos, esos ciclos suman costo y no aparecen en el óptimo.</li>
      </ul>
      <div class="recuadro"><p><strong>Con pesos negativos:</strong> si hay un ciclo de costo negativo alcanzable, el LP es no acotado (se envía flujo dando vueltas al ciclo sin límite), igual que Bellman–Ford detecta el ciclo; si no lo hay, el LP sigue teniendo solución entera.</p></div>
      <h2>Empates y vértices</h2>
      <p>Si dos caminos \(P_1, P_2\) tienen el mismo costo, toda combinación convexa \(\lambda\,\chi^{P_1} + (1-\lambda)\,\chi^{P_2}\) es factible y óptima: el conjunto óptimo es una cara (un segmento) del poliedro. Pero un punto interior del segmento no es vértice, así que el Simplex nunca lo devuelve:
      termina en \(\chi^{P_1}\) o en \(\chi^{P_2}\). La segunda figura muestra el costo \(\lambda c_1 + (1-\lambda)c_2\), lineal en \(\lambda\); el mínimo siempre está en un extremo.</p>
      <h2>Dualidad</h2>
      <p>El dual es \(\max\; \pi_t - \pi_s\) con \(\pi_j - \pi_i \le w_{ij}\): los potenciales \(\pi_i\) son distancias desde \(s\), y la condición \(\pi_j \le \pi_i + w_{ij}\) es la desigualdad triangular que cumplen las etiquetas de
      <a href="tema.html?id=bfs-dijkstra">Dijkstra</a> y <a href="tema.html?id=bellman-ford">Bellman–Ford</a>. La holgura complementaria dice que los arcos del camino óptimo cumplen \(\pi_j = \pi_i + w_{ij}\). Ver <a href="tema.html?id=strong-duality">dualidad fuerte</a>.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con dos caminos \(S\!\to\!A\!\to\!T\) de costo \(2+3 = 5\) y \(S\!\to\!B\!\to\!T\) de costo \(3+2 = 5\), la mezcla con \(\lambda = \tfrac12\) envía \(\tfrac12\) por cada arco, cumple la conservación en A, B y T y cuesta 5: es óptima, pero es el punto medio entre dos vértices y por eso el método no la elige.
      Con \(S\!\to\!B\) de costo 4, el camino de B cuesta 6 y el óptimo es \(\lambda = 1\).</p>
      <h2>Conexiones</h2>
      <p>El camino más corto es el caso más simple de <a href="tema.html?id=min-cost-flow">flujo de costo mínimo</a> (una unidad, sin capacidades). Con capacidades y más unidades, los caminos se cruzan y aparece la <a href="tema.html?id=max-flow-min-cut">red residual</a>.</p>`,
  });
})();
