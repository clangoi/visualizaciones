(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const CAJA = [-1.1, 1.1, -1.1, 1.1];
  const puntos = (n, semilla) => {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, () => ({ x: rnd() * 2 - 1, y: rnd() * 2 - 1 }));
  };
  // Árbol k-d con un punto por nodo (la mediana), alternando el eje. Si `pasos` se entrega, anota el orden de creación.
  function construir(pts, idx = pts.map((_, i) => i), prof = 0, caja = CAJA, orden = []) {
    if (!idx.length) return null;
    const eje = prof % 2, k = eje ? 'y' : 'x';
    const s = idx.slice().sort((a, b) => pts[a][k] - pts[b][k]), m = s.length >> 1;
    const nodo = { p: s[m], eje, prof, caja, corte: pts[s[m]][k], id: orden.length };
    orden.push(nodo);
    const [x0, x1, y0, y1] = caja;
    nodo.izq = construir(pts, s.slice(0, m), prof + 1, eje ? [x0, x1, y0, nodo.corte] : [x0, nodo.corte, y0, y1], orden);
    nodo.der = construir(pts, s.slice(m + 1), prof + 1, eje ? [x0, x1, nodo.corte, y1] : [nodo.corte, x1, y0, y1], orden);
    return nodo;
  }
  function lineaCorte(ctx, plano, nd, color, ancho) {
    const [x0, x1, y0, y1] = nd.caja;
    VIZ.trazar(ctx, plano, nd.eje ? [[x0, nd.corte], [x1, nd.corte]] : [[nd.corte, y0], [nd.corte, y1]], color, ancho);
  }
  const plano = (lienzo) => ML.plano(lienzo, { dominio: { xmin: -1.1 * Math.max(1, lienzo.ancho / lienzo.alto * 0.95), xmax: 1.1 * Math.max(1, lienzo.ancho / lienzo.alto * 0.95), ymin: -1.1, ymax: 1.1 } });

  /* ---------- Fig. 1: construcción ---------- */

  function montarConstruccion(cuerpo) {
    let n = 31, semilla = 1, pts = [], orden = [], hechos = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Puntos n', min: 3, max: 120, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'corte del paso actual (mediana)', forma: 'linea' },
      { color: C.tinta, texto: 'cortes anteriores', forma: 'linea' },
      { color: C.neutro, texto: 'región que se divide' },
      { color: C.s7, texto: 'punto mediana guardado en el nodo', forma: 'punto' },
      { color: C.inactivo, texto: 'punto aún sin nodo', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso crea un nodo: ordena los puntos de su región por x (profundidad par) o por y (impar), guarda la mediana y parte la región en dos. Pase el cursor sobre un punto para ver su profundidad.');
    function iniciar() {
      pts = puntos(n, semilla);
      orden = []; construir(pts, undefined, 0, CAJA, orden);
      hechos = 0;
      return (function* () { while (hechos < orden.length) { hechos++; yield; } })();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = plano(lienzo);
      pl.ejes();
      const actual = hechos ? orden[hechos - 1] : null;
      ctx.save(); pl.recortar();
      if (actual) {
        const [x0, x1, y0, y1] = actual.caja;
        ctx.fillStyle = C.neutro; ctx.fillRect(pl.sx(x0), pl.sy(y1), pl.sx(x1) - pl.sx(x0), pl.sy(y0) - pl.sy(y1));
      }
      orden.slice(0, hechos).forEach((nd, i) => lineaCorte(ctx, pl, nd, i === hechos - 1 ? C.s2 : C.tinta, i === hechos - 1 ? 2.5 : 1.2));
      ctx.restore();
      const enNodo = new Set(orden.slice(0, hechos).map((nd) => nd.p));
      M.dispersion(ctx, pl, pts, { color: (p, i) => (enNodo.has(i) ? C.s7 : C.inactivo), r: (p, i) => (actual && actual.p === i ? 6 : 4) });
      const prof = orden.length ? Math.max(...orden.map((nd) => nd.prof)) + 1 : 0;
      registro.textContent = actual ? `Nodo ${hechos}: profundidad ${actual.prof}, se corta por ${actual.eje ? 'y' : 'x'} = ${VIZ.fmt(actual.corte, 3)}.` : 'Al inicio todo el plano es una sola región.';
      lectura.set([
        ['nodos creados', `${hechos} / ${orden.length}`],
        ['altura del árbol', String(prof)],
        ['⌈log₂(n + 1)⌉', String(Math.ceil(Math.log2(n + 1)))],
      ]);
    }
    lienzo.alDibujar = () => orden.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return tip.ocultar();
      const nd = orden.find((o) => o.p === m);
      tip.mostrar(x, y, `(${VIZ.fmt(pts[m].x, 2)}, ${VIZ.fmt(pts[m].y, 2)})<br>profundidad <b>${nd.prof}</b>, corta por <b>${nd.eje ? 'y' : 'x'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: búsqueda del vecino más cercano ---------- */

  function montarBusqueda(cuerpo) {
    let n = 60, semilla = 2, pts = [], raiz = null, q = { x: 0.3, y: -0.2 }, est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Puntos n', min: 5, max: 400, paso: 5, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nodo visitado (distancia calculada)', forma: 'punto' },
      { color: C.s2, texto: 'nodo actual', forma: 'punto' },
      { color: C.s6, texto: 'mejor hasta ahora y su círculo', forma: 'punto' },
      { color: C.s8, texto: 'región podada sin mirar', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para poner la consulta (estrella). Se baja primero por el lado de la consulta; al volver, el otro lado solo se visita si el círculo del mejor actual cruza la línea de corte.');
    function iniciar() {
      pts = puntos(n, semilla);
      raiz = construir(pts);
      est = { visitados: new Set(), podados: [], mejor: -1, dmejor: Infinity, actual: null, msg: '' };
      const d = (i) => Math.hypot(pts[i].x - q.x, pts[i].y - q.y);
      function* buscar(nd) {
        if (!nd) return;
        est.actual = nd; est.visitados.add(nd.p);
        const dd = d(nd.p);
        if (dd < est.dmejor) { est.dmejor = dd; est.mejor = nd.p; est.msg = `Distancia ${VIZ.fmt(dd, 3)}: nuevo mejor.`; }
        else est.msg = `Distancia ${VIZ.fmt(dd, 3)} ≥ ${VIZ.fmt(est.dmejor, 3)}: no mejora.`;
        yield;
        const diff = (nd.eje ? q.y : q.x) - nd.corte;
        const [cerca, lejos] = diff < 0 ? [nd.izq, nd.der] : [nd.der, nd.izq];
        yield* buscar(cerca);
        if (lejos) {
          if (Math.abs(diff) < est.dmejor) {
            est.actual = nd; est.msg = `|${nd.eje ? 'y' : 'x'} − corte| = ${VIZ.fmt(Math.abs(diff), 3)} < ${VIZ.fmt(est.dmejor, 3)}: hay que mirar el otro lado.`;
            yield;
            yield* buscar(lejos);
          } else {
            est.podados.push(lejos.caja); est.actual = nd;
            est.msg = `|${nd.eje ? 'y' : 'x'} − corte| = ${VIZ.fmt(Math.abs(diff), 3)} ≥ ${VIZ.fmt(est.dmejor, 3)}: se poda el otro lado.`;
            yield;
          }
        }
      }
      return (function* () { yield* buscar(raiz); est.actual = null; est.msg = `Terminado: vecino más cercano a distancia ${VIZ.fmt(est.dmejor, 3)}.`; yield; })();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = plano(lienzo);
      pl.ejes();
      ctx.save(); pl.recortar();
      for (const [x0, x1, y0, y1] of est.podados) { ctx.fillStyle = VIZ.alfa(C.s8, 0.12); ctx.fillRect(pl.sx(x0), pl.sy(y1), pl.sx(x1) - pl.sx(x0), pl.sy(y0) - pl.sy(y1)); }
      const recorrer = (nd) => { if (!nd) return; lineaCorte(ctx, pl, nd, est.actual === nd ? C.s2 : C.eje, est.actual === nd ? 2.5 : 1); recorrer(nd.izq); recorrer(nd.der); };
      recorrer(raiz);
      if (est.mejor >= 0) { ctx.strokeStyle = C.s6; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.sx(q.x), pl.sy(q.y), est.dmejor * (pl.sx(1) - pl.sx(0)), 0, 2 * Math.PI); ctx.stroke(); }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: (p, i) => (i === est.mejor ? C.s6 : est.actual && est.actual.p === i ? C.s2 : est.visitados.has(i) ? C.s1 : C.inactivo), r: (p, i) => (i === est.mejor ? 6 : 4) });
      ctx.save(); ctx.fillStyle = C.tinta; ctx.beginPath(); VIZ.forma(ctx, pl.sx(q.x), pl.sy(q.y), 7, 6); ctx.fill(); ctx.restore();
      registro.textContent = est.msg || 'Pulse Un paso para empezar en la raíz.';
      lectura.set([
        ['distancias calculadas', String(est.visitados.size)],
        ['fuerza bruta', String(n)],
        ['regiones podadas', String(est.podados.length)],
        ['log₂ n', VIZ.fmt(Math.log2(n), 3)],
      ]);
    }
    lienzo.alDibujar = () => est && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      q = { x: pl.ix(x), y: pl.iy(y) };
      rep.reiniciar();
    });
    rep.reiniciar();
  }

  VIZ.registrarTema('kd-tree', {
    intro: String.raw`
      <p>Buscar el vecino más cercano comparando con todos los puntos cuesta \(O(n)\) por consulta. Un <strong>árbol k-d</strong>
      parte el espacio recursivamente con cortes paralelos a los ejes, de modo que la mayoría de las regiones se pueden
      <strong>descartar sin mirar sus puntos</strong>.</p>
      <p>Es la estructura que usan por defecto muchas bibliotecas para <a href="tema.html?id=knn">k-NN</a>,
      <a href="tema.html?id=dbscan">DBSCAN</a> o <a href="tema.html?id=local-outlier-factor">LOF</a> en dimensiones bajas.</p>`,
    visualizaciones: [
      {
        titulo: 'Construcción por medianas',
        descripcion: 'Cada nodo corta su región por la mediana en x o en y, alternando. Observe que el árbol queda balanceado: altura ⌈log₂(n + 1)⌉.',
        montar: montarConstruccion,
      },
      {
        titulo: 'Búsqueda del vecino más cercano',
        descripcion: 'La búsqueda en profundidad con poda. Pruebe consultas en el centro y en una esquina, y suba n: las distancias calculadas crecen mucho más lento que n.',
        montar: montarBusqueda,
      },
    ],
    teoria: String.raw`
      <h2>Construcción</h2>
      <pre><code>construir(P, prof):
    si P = ∅: devolver nulo
    eje ← prof mod d
    m ← mediana de P según el eje
    nodo ← (punto m, corte = m[eje])
    nodo.izq ← construir({p ∈ P : p[eje] &lt; corte}, prof + 1)
    nodo.der ← construir({p ∈ P : p[eje] &gt; corte}, prof + 1)
    devolver nodo</code></pre>
      <p>Con la mediana, el árbol tiene altura \(\lceil \log_2(n+1)\rceil\). Ordenando en cada nivel cuesta \(O(n \log^2 n)\); con
      selección lineal de la mediana, \(O(n \log n)\). Una variante elige el eje de mayor dispersión en vez de alternar.</p>
      <h2>Búsqueda con poda</h2>
      <pre><code>buscar(nodo, q):
    si nodo = nulo: volver
    actualizar mejor con d(q, nodo.punto)
    δ ← q[eje] − nodo.corte
    cerca, lejos ← (izq, der) si δ &lt; 0, si no (der, izq)
    buscar(cerca, q)
    si |δ| &lt; d_mejor: buscar(lejos, q)      ← si no, poda</code></pre>
      <p>La poda es correcta porque todo punto \(p\) del otro lado cumple \(d(q, p) \ge |q_{\text{eje}} - \text{corte}| = |\delta|\):
      si \(|\delta|\) ya supera al mejor, nada de ese lado puede ganar.</p>
      <h2>Costo</h2>
      <table>
        <tr><th>Operación</th><th>Promedio (d fijo, datos regulares)</th><th>Peor caso</th></tr>
        <tr><td>Construir</td><td>\(O(n \log n)\)</td><td>\(O(n \log n)\)</td></tr>
        <tr><td>Vecino más cercano</td><td>\(O(\log n)\)</td><td>\(O(d\, n^{1 - 1/d})\)</td></tr>
        <tr><td>k vecinos</td><td>\(O(k + \log n)\)</td><td>\(O(n)\)</td></tr>
      </table>
      <div class="recuadro"><p>La ventaja desaparece cuando \(d\) crece: hace falta \(n \gg 2^d\) para que la poda funcione. Con
      \(d \gtrsim 20\), un árbol k-d visita casi todos los nodos (ver la <a href="tema.html?id=curse-of-dimensionality">maldición de la
      dimensionalidad</a> y la comparación con <a href="tema.html?id=ball-tree">ball trees</a>).</p></div>`,
  });
})();