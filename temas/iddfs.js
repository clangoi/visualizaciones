(function () {
  'use strict';
  const { color: C } = VIZ;
  const B = VIZ.busqueda;

  /* ---------- Fig. 1: IDDFS paso a paso sobre un árbol uniforme ---------- */

  // Árbol completo de ramificación b y profundidad D; los nodos se numeran por niveles (orden de BFS).
  function arbolUniforme(b, D) {
    const raiz = { id: 1, d: 0, hijos: [] };
    let nivel = [raiz], id = 1;
    const todos = [raiz];
    for (let d = 1; d <= D; d++) {
      const sig = [];
      for (const p of nivel) for (let k = 0; k < b; k++) { const h = { id: ++id, d, hijos: [] }; p.hijos.push(h); sig.push(h); todos.push(h); }
      nivel = sig;
    }
    return { raiz, todos };
  }

  function montarPasoAPaso(cuerpo) {
    let b = 2, D = 4, arbol = null, meta = null;
    let limite = 0, est = new Map(), veces = new Map(), actual = null, hallado = false;
    let genIter = 0, genTotal = 0, mensaje = '';

    const ctl = VIZ.controles(cuerpo);
    const rb = ctl.rango({ etiqueta: 'Ramificación b', min: 2, max: 3, valor: b, alCambiar: (v) => { b = v; if (b === 3 && D > 3) { D = 3; rd.valor = 3; } construir(); } });
    const rd = ctl.rango({ etiqueta: 'Profundidad del árbol', min: 2, max: 4, valor: D, alCambiar: (v) => { D = v; if (D > 3 && b === 3) { b = 2; rb.valor = 2; } construir(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 70 + D * 64 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'en la pila (camino actual)' },
      { color: C.s1, texto: 'visitado en esta iteración' },
      { color: C.superficie, borde: C.s2, texto: 'nodo actual', forma: 'punto' },
      { color: C.superficie, borde: C.s8, texto: 'meta', forma: 'punto' },
      { color: C.s6, texto: 'meta encontrada' },
      { color: C.superficie, borde: C.tenue, texto: 'más allá del límite' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para elegirlo como meta. El número bajo cada nodo cuenta cuántas veces se ha generado en total, sumando todas las iteraciones.');

    function construir() {
      arbol = arbolUniforme(b, D);
      // Meta por omisión: un nodo del penúltimo nivel, a la derecha del centro.
      const cand = arbol.todos.filter((n) => n.d === D - 1);
      meta = cand[Math.floor(cand.length * 0.6)];
      lienzo.ajustar(true);
      rep.reiniciar();
    }

    function iniciar() {
      est = new Map(); veces = new Map(); actual = null; hallado = false;
      limite = 0; genIter = 0; genTotal = 0;
      mensaje = `Se busca el nodo ${meta.id}. Cada iteración es una DFS que no baja más allá del límite.`;
      function* dls(n, d) {
        veces.set(n, (veces.get(n) || 0) + 1);
        genIter++; genTotal++;
        est.set(n, 1);
        actual = n;
        if (n === meta) {
          hallado = true;
          mensaje = `Se genera ${n.id}: es la meta. Encontrada a profundidad ${d} en la iteración con límite ${limite}.`;
          yield;
          return true;
        }
        mensaje = d === limite && n.hijos.length ? `Se genera ${n.id} a profundidad ${d} = límite: no se expande.` : `Se genera ${n.id} (profundidad ${d}).`;
        yield;
        if (d < limite) for (const h of n.hijos) if (yield* dls(h, d + 1)) return true;
        est.set(n, 2);
        return false;
      }
      return (function* () {
        yield;
        for (limite = 0; limite <= D; limite++) {
          est = new Map(); genIter = 0; actual = null;
          mensaje = `Nueva iteración con límite de profundidad ${limite}: se empieza otra vez desde la raíz.`;
          yield;
          if (yield* dls(arbol.raiz, 0)) return;
        }
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const dy = 64, y0 = 28;
      // Línea del límite actual
      const yl = y0 + limite * dy + dy / 2;
      if (limite < D) {
        ctx.save();
        ctx.strokeStyle = C.apagado;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(8, yl); ctx.lineTo(W - 8, yl); ctx.stroke();
        ctx.fillStyle = C.tinta2;
        ctx.font = VIZ.fuente(11);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`límite = ${limite}`, W - 8, yl - 3);
        ctx.restore();
      }
      geo = B.dibujarArbol(ctx, arbol.raiz, {
        x0: 8, y0, ancho: W - 16, dy,
        estilo: (n) => {
          const e = est.get(n);
          const r = n.d > limite ? { borde: C.tenue, texto: C.inactivo } : {};
          if (n === meta && hallado) Object.assign(r, { relleno: C.s6, borde: C.s6, texto: C.sobre });
          else if (e === 1) r.relleno = C.s4;
          else if (e === 2) Object.assign(r, { relleno: C.s1, borde: C.s1, texto: C.sobre });
          if (n === actual && !hallado) r.anillo = C.s2;
          else if (n === meta && !hallado) r.anillo = C.s8;
          return r;
        },
        arista: (p, h) => (est.get(h) && est.get(p) ? { color: est.get(h) === 1 ? C.s4 : C.s1, ancho: 2.5 } : h.d > limite ? { color: C.tenue } : null),
        etiqueta: (n) => String(n.id),
        debajo: (n) => (veces.get(n) ? `×${veces.get(n)}` : ''),
        colorDebajo: (n) => (veces.get(n) > 1 ? C.s2 : C.tinta2),
      });
      registro.textContent = mensaje;
      lectura.set([
        ['límite actual', String(limite)],
        ['generados en esta iteración', String(genIter)],
        ['generados en total', String(genTotal)],
        ['BFS habría generado', String(meta.id)],
        ['memoria (pila)', `≤ ${D + 1} nodos`],
      ]);
    }
    lienzo.alDibujar = () => arbol && dibujar();

    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const n = B.nodoArbolEn(geo, x, y);
      if (n) { meta = n; rep.reiniciar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const n = B.nodoArbolEn(geo, x, y);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `nodo <b>${n.id}</b> · profundidad <b>${n.d}</b><br>generado <b>${veces.get(n) || 0}</b> veces`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    construir();
  }

  /* ---------- Fig. 2: el costo de repetir ---------- */

  const nBFS = (b, d) => { let s = 0; for (let i = 0; i <= d; i++) s += Math.pow(b, i); return s; };
  const nID = (b, d) => { let s = 0; for (let i = 0; i <= d; i++) s += (d + 1 - i) * Math.pow(b, i); return s; };

  function montarCosto(cuerpo) {
    let b = 3, dmax = 15, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ramificación b', min: 2, max: 10, valor: b, alCambiar: (v) => { b = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Profundidad de la meta d', min: 4, max: 25, valor: dmax, alCambiar: (v) => { dmax = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'BFS: Σ bⁱ', forma: 'linea' },
      { color: C.s2, texto: 'IDDFS: Σ (d + 1 − i) bⁱ', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escala logarítmica: las dos curvas son casi paralelas porque su cociente tiende a una constante. Pase el cursor para ver los valores.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: dmax, ymin: 1, ymax: nID(b, dmax) * 2 }, {
        logY: true, etiquetaX: 'profundidad d', etiquetaY: 'nodos generados',
        formatoY: (v) => (v >= 1e4 ? `10^${Math.round(Math.log10(v))}` : VIZ.entero(v)),
      });
      plano.ejes();
      for (const [f, c] of [[nBFS, C.s1], [nID, C.s2]]) {
        const pts = [];
        for (let d = 0; d <= dmax; d++) pts.push([d, f(b, d)]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(f(b, hover)), c, 4);
      }
      const r = nID(b, dmax) / nBFS(b, dmax);
      lectura.set([
        ['BFS', VIZ.fmt(nBFS(b, dmax))],
        ['IDDFS', VIZ.fmt(nID(b, dmax))],
        ['cociente', VIZ.fmt(r, 3)],
        ['límite b/(b − 1)', VIZ.fmt(b / (b - 1), 3)],
        ['memoria BFS ≈ bᵈ', VIZ.fmt(Math.pow(b, dmax))],
        ['memoria IDDFS ≈ b·d', VIZ.entero(b * dmax)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(dmax, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `d = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'BFS', VIZ.fmt(nBFS(b, hover))) +
        VIZ.filaTooltip(C.s2, 'IDDFS', VIZ.fmt(nID(b, hover))) + `cociente <b>${VIZ.fmt(nID(b, hover) / nBFS(b, hover), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('iddfs', {
    intro: String.raw`
      <p>La búsqueda en anchura encuentra la solución más corta, pero guarda en memoria toda la frontera, que crece
      exponencialmente. La búsqueda en profundidad usa muy poca memoria, pero puede perderse en una rama infinita o devolver una
      solución larguísima.</p>
      <p>La <strong>búsqueda en profundidad con profundización iterativa</strong> (IDDFS) combina lo mejor de ambas: ejecuta una DFS
      que no baja más allá de profundidad 0, luego otra hasta 1, luego hasta 2, y así hasta encontrar la meta. Parece un
      desperdicio repetir todo el trabajo anterior, pero como la mayoría de los nodos de un árbol están en el último nivel, la
      repetición cuesta poco.</p>`,
    visualizaciones: [
      {
        titulo: 'IDDFS paso a paso',
        descripcion: 'Observe que los nodos cercanos a la raíz se generan una vez por iteración (el contador bajo cada nodo), mientras que los del último nivel se generan una sola vez.',
        montar: montarPasoAPaso,
      },
      {
        titulo: 'Cuánto cuesta repetir',
        descripcion: 'Con \\(b = 2\\) IDDFS genera cerca del doble que BFS; con \\(b = 10\\), apenas un 11 % más. A cambio, su memoria crece linealmente con la profundidad.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>IDDFS(s₀):
    para límite ← 0, 1, 2, …:
        r ← DLS(s₀, límite)
        si r ≠ «no encontrado»: devolver r

DLS(u, límite):                     ▹ DFS con límite de profundidad
    si u es meta: devolver u
    si límite = 0: devolver «no encontrado»
    para cada sucesor v de u:
        r ← DLS(v, límite − 1)
        si r ≠ «no encontrado»: devolver r
    devolver «no encontrado»</code></pre>
      <p>En un grafo con ciclos conviene además no volver a un estado del camino actual (o, como mínimo, no deshacer el último
      movimiento), lo que no requiere memoria adicional.</p>

      <h2>Corrección</h2>
      <p>La iteración con límite \(\ell\) visita exactamente los nodos a profundidad \(\le \ell\), en orden de profundidad. Si la
      meta más cercana está a profundidad \(d\), las iteraciones \(0, \dots, d-1\) no la encuentran y la iteración \(d\) sí. Por lo
      tanto IDDFS es <strong>completo</strong> (si \(b\) es finito) y <strong>óptimo</strong> en número de acciones, igual que BFS.</p>

      <h2>Costo</h2>
      <p>En un árbol uniforme, los nodos de profundidad \(i\) se generan en las iteraciones \(i, i+1, \dots, d\), es decir
      \(d + 1 - i\) veces:</p>
      \[ N_{\text{IDDFS}}(b, d) = \sum_{i=0}^{d} (d + 1 - i)\, b^i
         = b^d \sum_{j=0}^{d} (j + 1)\, b^{-j}
         \le b^d \left(\frac{b}{b-1}\right)^2. \]
      <p>Como BFS genera \(\sum_{i \le d} b^i \approx b^d \cdot \frac{b}{b-1}\), el cociente tiende a \(\frac{b}{b-1}\):</p>
      <table>
        <thead><tr><th>\(b\)</th><th>2</th><th>3</th><th>5</th><th>10</th></tr></thead>
        <tbody><tr><td>\(N_{\text{IDDFS}} / N_{\text{BFS}}\)</td><td>2</td><td>1.5</td><td>1.25</td><td>1.11</td></tr></tbody>
      </table>
      <p>Ambos son \(\Theta(b^d)\) en tiempo, pero la memoria de IDDFS es \(O(b\,d)\) (la pila con los hermanos pendientes) o
      incluso \(O(d)\) si los sucesores se generan de a uno, mientras que BFS necesita \(\Theta(b^d)\).</p>
      <div class="recuadro">IDDFS es el método ciego preferido cuando el espacio de búsqueda es grande y no se conoce la
      profundidad de la solución.</div>

      <h2>De IDDFS a IDA*</h2>
      <p>IDDFS mide la profundidad con \(g\), el número de acciones. Si en vez de eso se corta cuando \(f = g + h\) supera un umbral,
      y el umbral se sube al menor \(f\) que lo superó, se obtiene <a href="tema.html?id=ida-star">IDA*</a>: la misma idea, pero
      guiada por una heurística.</p>`,
  });
})();
