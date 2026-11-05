(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  // Grafo con comunidades: n nodos en 4 grupos, enlaces dentro de cada grupo con probabilidad pin y entre grupos pout.
  function grafo(n, pin, pout, semilla) {
    const r = VIZ.semilla(semilla * 31 + 1), g = Array.from({ length: n }, (_, i) => i % 4), E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < (g[i] === g[j] ? pin : pout)) E.push([i, j]);
    return { n, g, E };
  }
  const GCOL = [C.s1, C.s2, C.s3, C.s7];
  function cruces(P, E) {
    let c = 0;
    const o = (a, b, d) => Math.sign((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]));
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const [a, b] = E[i], [d, e] = E[j];
      if (a === d || a === e || b === d || b === e) continue;
      if (o(P[a], P[b], P[d]) !== o(P[a], P[b], P[e]) && o(P[d], P[e], P[a]) !== o(P[d], P[e], P[b])) c++;
    }
    return c;
  }

  /* ---------- Fig. 1: la misma red, dos representaciones ---------- */

  function montarComparar(cuerpo) {
    const e = { n: 16, dens: 0.25, sel: -1, semilla: 1 };
    let G = grafo(e.n, 0.6, 0.05, 1);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Nodos', min: 8, max: 40, valor: e.n, alCambiar: (v) => { e.n = v; regen(); } });
    ctl.rango({ etiqueta: 'Densidad de enlaces', min: 0.05, max: 1, paso: 0.05, valor: e.dens, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { e.dens = v; regen(); } });
    ctl.boton('Nueva red', () => { e.semilla++; regen(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? 560 : 340) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, GCOL.map((c, i) => ({ color: c, texto: `grupo ${i + 1}` })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo o en una fila de la matriz para resaltar a sus vecinos. Suba la densidad: el diagrama de nodos y enlaces se vuelve una maraña mientras la matriz sigue legible.');
    function regen() { G = grafo(e.n, Math.min(1, e.dens * 2.4), e.dens * 0.25, e.semilla); e.sel = -1; dibujar(); }
    let hitN = [], hitM = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancho = W < 620, w1 = ancho ? W : W / 2, h1 = ancho ? H / 2 : H;
      const R = Math.min(w1, h1) / 2 - 22, cx = w1 / 2, cy = h1 / 2;
      const orden = [...Array(G.n).keys()].sort((a, b) => G.g[a] - G.g[b] || a - b);
      const P = orden.map((_, k) => [cx + R * Math.cos((k / G.n) * 6.283 - 1.57), cy + R * Math.sin((k / G.n) * 6.283 - 1.57)]);
      const pos = new Map(orden.map((id, k) => [id, k]));
      const vec = new Set(e.sel >= 0 ? G.E.filter(([a, b]) => a === e.sel || b === e.sel).flatMap(([a, b]) => [a, b]) : []);
      G.E.forEach(([a, b]) => { const act = e.sel < 0 || a === e.sel || b === e.sel; ctx.strokeStyle = act ? VIZ.alfa(C.tinta2, e.sel < 0 ? 0.35 : 0.9) : C.rejilla; ctx.lineWidth = act && e.sel >= 0 ? 2 : 1; ctx.beginPath(); ctx.moveTo(P[pos.get(a)][0], P[pos.get(a)][1]); ctx.lineTo(P[pos.get(b)][0], P[pos.get(b)][1]); ctx.stroke(); });
      hitN = [];
      orden.forEach((id, k) => { ctx.fillStyle = id === e.sel ? C.tinta : vec.has(id) || e.sel < 0 ? GCOL[G.g[id]] : C.tenue; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P[k][0], P[k][1], 6, 0, 6.3); ctx.fill(); ctx.stroke(); hitN.push({ x: P[k][0] - 8, y: P[k][1] - 8, w: 16, h: 16, i: id }); });
      V.rotulo(ctx, 'Nodos y enlaces', 10, 12, { peso: 600, tam: 11, color: C.tinta });
      // matriz de adyacencia
      const ox = ancho ? 0 : w1, oy = ancho ? h1 : 0, lado = Math.min(w1, h1) - 48, c = lado / G.n, mx = ox + (w1 - lado) / 2, my = oy + 30;
      V.rotulo(ctx, 'Matriz de adyacencia', ox + 10, oy + 12, { peso: 600, tam: 11, color: C.tinta });
      ctx.strokeStyle = C.rejilla; ctx.strokeRect(mx + 0.5, my + 0.5, lado, lado);
      const ady = new Set(G.E.flatMap(([a, b]) => [a * 100 + b, b * 100 + a]));
      hitM = [];
      orden.forEach((fi, y) => {
        orden.forEach((cj, x) => { if (ady.has(fi * 100 + cj)) { ctx.fillStyle = G.g[fi] === G.g[cj] ? GCOL[G.g[fi]] : C.tinta2; ctx.globalAlpha = e.sel >= 0 && fi !== e.sel && cj !== e.sel ? 0.25 : 1; ctx.fillRect(mx + x * c, my + y * c, Math.max(1, c - 0.5), Math.max(1, c - 0.5)); ctx.globalAlpha = 1; } });
        hitM.push({ x: mx - 6, y: my + y * c, w: lado + 6, h: c, i: fi });
      });
      const dens = (2 * G.E.length) / (G.n * (G.n - 1));
      lectura.set([['enlaces', String(G.E.length)], ['densidad real', `${VIZ.fmt(dens * 100, 3)} %`], ['cruces de enlaces en el círculo', VIZ.entero(cruces(P.map((p, k) => P[k]).reduce((a, p, k) => { a[orden[k]] = p; return a; }, []), G.E))], ['celdas de la matriz', VIZ.entero(G.n * G.n)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hitN, x, y) || V.bajo(hitM, x, y); e.sel = h && e.sel !== h.i ? h.i : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hitN, x, y) || V.bajo(hitM, x, y); lienzo.canvas.style.cursor = h ? 'pointer' : 'default'; if (!h) return tip.ocultar(); tip.mostrar(x, y, `nodo <b>${h.i}</b> · grupo ${G.g[h.i] + 1}<br>grado ${G.E.filter(([a, b]) => a === h.i || b === h.i).length}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el orden de la matriz revela comunidades ---------- */

  function montarOrden(cuerpo) {
    let modo = 'azar', semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Orden de filas y columnas', valor: modo, opciones: [['azar', 'al azar'], ['grado', 'por grado'], ['grupo', 'por comunidad']], alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.boton('Nueva red', () => { semilla++; G = grafo(32, 0.7, 0.04, semilla); dibujar(); });
    let G = grafo(32, 0.7, 0.04, semilla);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 320, altoMax: 440 });
    VIZ.leyenda(cuerpo, GCOL.map((c, i) => ({ color: c, texto: `comunidad ${i + 1} (enlace dentro del grupo)` })).concat([{ color: C.tinta2, texto: 'enlace entre grupos' }]));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'La red es la misma: cuatro comunidades mezcladas. Con el orden al azar la matriz parece ruido; ordenando por comunidad aparecen cuatro bloques.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const grado = (i) => G.E.filter(([a, b]) => a === i || b === i).length;
      const ids = [...Array(G.n).keys()];
      if (modo === 'azar') { const r = VIZ.semilla(semilla * 5); ids.sort(() => r() - 0.5); } else if (modo === 'grado') ids.sort((a, b) => grado(b) - grado(a)); else ids.sort((a, b) => G.g[a] - G.g[b] || a - b);
      const lado = Math.min(W, H) - 16, c = lado / G.n, ox = (W - lado) / 2, oy = 8;
      ctx.strokeStyle = C.rejilla; ctx.strokeRect(ox + 0.5, oy + 0.5, lado, lado);
      const ady = new Set(G.E.flatMap(([a, b]) => [a * 100 + b, b * 100 + a]));
      ids.forEach((fi, y) => ids.forEach((cj, x) => { if (ady.has(fi * 100 + cj)) { ctx.fillStyle = G.g[fi] === G.g[cj] ? GCOL[G.g[fi]] : C.tinta2; ctx.fillRect(ox + x * c, oy + y * c, c - 0.5, c - 0.5); } }));
      // bloques: suma de enlaces dentro de la diagonal de ancho 8
      let cerca = 0; G.E.forEach(([a, b]) => { if (Math.abs(ids.indexOf(a) - ids.indexOf(b)) <= 8) cerca++; });
      registro.textContent = `Enlaces entre nodos que quedan a 8 posiciones o menos: ${cerca} de ${G.E.length} (${Math.round((100 * cerca) / G.E.length)} %). ${modo === 'grupo' ? 'Los bloques sobre la diagonal son las comunidades.' : modo === 'grado' ? 'Ordenar por grado agrupa los nodos centrales, pero no las comunidades.' : 'Sin orden: la estructura queda oculta.'}`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('node-link-vs-matrix', {
    intro: String.raw`
      <p>Una red puede dibujarse de dos maneras muy distintas. En el diagrama de <strong>nodos y enlaces</strong>, cada nodo es un punto y cada relación una línea que los une. En la <strong>matriz de adyacencia</strong>, filas y columnas son los nodos y una celda pintada indica que hay un enlace.</p>
      <p>El diagrama de nodos y enlaces es intuitivo para redes pequeñas y poco densas; la matriz resiste la densidad y el tamaño, a costa de ser menos obvia.</p>`,
    visualizaciones: [
      { titulo: 'La misma red, dos codificaciones', descripcion: 'Aumente nodos y densidad y observe cuándo el diagrama se vuelve ilegible; haga clic en un nodo o en una fila.', montar: montarComparar },
      { titulo: 'El orden de la matriz', descripcion: 'Cambie el orden de filas y columnas de una misma red con cuatro comunidades.', montar: montarOrden },
    ],
    teoria: String.raw`
      <h2>Matriz de adyacencia</h2>
      <p>Para una red \(G = (V, E)\) con \(n\) nodos, la matriz de adyacencia \(A \in \{0,1\}^{n \times n}\) tiene \(A_{ij} = 1\) si \((i, j) \in E\). Si la red no es dirigida, \(A\) es simétrica. La densidad es
      \[ \rho = \frac{2|E|}{n(n-1)}. \]</p>
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>Nodos y enlaces</th><th>Matriz</th></tr>
        <tr><td>tareas fáciles</td><td>caminos, vecindad, topología, forma general</td><td>buscar enlaces, grado, comunidades (con buen orden)</td></tr>
        <tr><td>escala</td><td>cientos de nodos y poca densidad</td><td>miles de nodos y mucha densidad</td></tr>
        <tr><td>oclusión</td><td>cruces y solapes entre enlaces</td><td>ninguna: cada par tiene su celda</td></tr>
        <tr><td>costo de espacio</td><td>\(O(n + |E|)\) marcas</td><td>\(O(n^2)\) celdas</td></tr>
        <tr><td>aprendizaje</td><td>intuitivo</td><td>requiere explicación</td></tr>
      </table>
      <h2>El orden importa</h2>
      <p>La matriz depende de la permutación de filas y columnas: con \(n!\) órdenes posibles, la mayoría esconden la estructura. Ordenar por comunidad (o por seriación) hace aparecer bloques densos sobre la diagonal; ver también <a href="tema.html?id=heatmap-matrix">mapas de calor y matrices</a>.</p>
      <p>Si el diagrama de nodos y enlaces se elige, la posición de los nodos es una decisión: <a href="tema.html?id=graph-layouts">layouts de grafos</a>. Las redes como tipo de dato se ven en <a href="tema.html?id=dataset-types">tipos de conjuntos de datos</a>.</p>`,
  });
})();
