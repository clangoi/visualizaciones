(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  /* Ball tree en d dimensiones: cada nodo guarda centro, radio y sus índices; se parte por la coordenada de mayor
     dispersión en la mediana hasta tener a lo más `hoja` puntos. */
  function construirBolas(X, idx = X.map((_, i) => i), hoja = 4, prof = 0) {
    const d = X[0].length, c = new Array(d).fill(0);
    for (const i of idx) for (let j = 0; j < d; j++) c[j] += X[i][j] / idx.length;
    const r = Math.sqrt(Math.max(...idx.map((i) => M.dist2(X[i], c))));
    const nodo = { c, r, idx, prof, hijos: null };
    if (idx.length > hoja) {
      let eje = 0, mejor = -1;
      for (let j = 0; j < d; j++) { const v = idx.map((i) => X[i][j]), s = Math.max(...v) - Math.min(...v); if (s > mejor) { mejor = s; eje = j; } }
      const s = idx.slice().sort((a, b) => X[a][eje] - X[b][eje]), m = s.length >> 1;
      nodo.hijos = [construirBolas(X, s.slice(0, m), hoja, prof + 1), construirBolas(X, s.slice(m), hoja, prof + 1)];
    }
    return nodo;
  }
  // Vecino más cercano con poda por desigualdad triangular. Devuelve { i, d, distancias, podados: [nodos] }.
  function buscarBolas(raiz, X, q) {
    const r = { i: -1, d: Infinity, distancias: 0, podados: [], visitados: [] };
    (function visitar(nd) {
      const dc = Math.sqrt(M.dist2(q, nd.c));
      r.distancias++;
      if (dc - nd.r >= r.d) { r.podados.push(nd); return; }
      r.visitados.push(nd);
      if (!nd.hijos) {
        for (const i of nd.idx) { const d = Math.sqrt(M.dist2(q, X[i])); r.distancias++; if (d < r.d) { r.d = d; r.i = i; } }
        return;
      }
      const [a, b] = nd.hijos;
      const orden = M.dist2(q, a.c) <= M.dist2(q, b.c) ? [a, b] : [b, a];
      orden.forEach(visitar);
    })(raiz);
    return r;
  }
  // Árbol k-d en d dimensiones (cubetas de `hoja` puntos), para comparar.
  function construirKD(X, idx = X.map((_, i) => i), hoja = 4, prof = 0) {
    if (idx.length <= hoja) return { idx };
    const d = X[0].length;
    let eje = 0, mejor = -1;
    for (let j = 0; j < d; j++) { const v = idx.map((i) => X[i][j]), s = Math.max(...v) - Math.min(...v); if (s > mejor) { mejor = s; eje = j; } }
    const s = idx.slice().sort((a, b) => X[a][eje] - X[b][eje]), m = s.length >> 1;
    return { eje, corte: X[s[m]][eje], izq: construirKD(X, s.slice(0, m), hoja, prof + 1), der: construirKD(X, s.slice(m), hoja, prof + 1) };
  }
  function buscarKD(raiz, X, q) {
    const r = { d: Infinity, distancias: 0 };
    (function visitar(nd) {
      if (nd.idx) { for (const i of nd.idx) { const d = Math.sqrt(M.dist2(q, X[i])); r.distancias++; if (d < r.d) r.d = d; } return; }
      const delta = q[nd.eje] - nd.corte, [cerca, lejos] = delta < 0 ? [nd.izq, nd.der] : [nd.der, nd.izq];
      visitar(cerca);
      if (Math.abs(delta) < r.d) visitar(lejos);
    })(raiz);
    return r;
  }

  /* ---------- Fig. 1: bolas anidadas ---------- */

  function montarBolas(cuerpo) {
    let tipo = 'manchas', prof = 2, semilla = 1, pts = [], X = [], raiz = null, q = null, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'Profundidad mostrada', min: 0, max: 6, valor: prof, alCambiar: (v) => { prof = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'bolas de la profundidad elegida', forma: 'linea' },
      { color: C.tenue, texto: 'bolas menos profundas', forma: 'linea' },
      { color: C.s8, texto: 'bola podada en la búsqueda', forma: 'linea' },
      { color: C.s6, texto: 'vecino más cercano', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para buscar el vecino más cercano de ese punto: las bolas en rojo se descartaron enteras porque la distancia al centro menos el radio ya supera al mejor encontrado.');
    function generar() { pts = M.datos2d(tipo, 150, semilla); X = pts.map(M.xy); raiz = construirBolas(X); q = null; res = null; dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const asp = Math.max(1, (lienzo.ancho / lienzo.alto) * 0.95);
      pl = ML.plano(lienzo, { dominio: { xmin: -1.15 * asp, xmax: 1.15 * asp, ymin: -1.15, ymax: 1.15 } });
      pl.ejes();
      const esc = pl.sx(1) - pl.sx(0);
      ctx.save(); pl.recortar();
      const circ = (nd, col, ancho, guiones) => { ctx.strokeStyle = col; ctx.lineWidth = ancho; ctx.setLineDash(guiones || []); ctx.beginPath(); ctx.arc(pl.sx(nd.c[0]), pl.sy(nd.c[1]), nd.r * esc, 0, 2 * Math.PI); ctx.stroke(); };
      let enProf = 0;
      (function rec(nd) {
        if (nd.prof < prof) circ(nd, C.tenue, 1);
        else if (nd.prof === prof) { circ(nd, C.s1, 2); ctx.fillStyle = VIZ.alfa(C.s1, 0.06); ctx.fill(); enProf++; }
        if (nd.hijos && nd.prof < prof) nd.hijos.forEach(rec);
      })(raiz);
      if (res) res.podados.forEach((nd) => circ(nd, C.s8, 1.5, [4, 3]));
      if (res) { ctx.strokeStyle = C.s6; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(pl.sx(q[0]), pl.sy(q[1]), res.d * esc, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: (p, i) => (res && i === res.i ? C.s6 : C.tinta2), r: (p, i) => (res && i === res.i ? 6 : 3) });
      if (q) { ctx.save(); ctx.fillStyle = C.tinta; ctx.beginPath(); VIZ.forma(ctx, pl.sx(q[0]), pl.sy(q[1]), 7, 6); ctx.fill(); ctx.restore(); }
      lectura.set([
        ['bolas en esta profundidad', String(enProf)],
        ['distancias calculadas', res ? String(res.distancias) : '— (haga clic)'],
        ['bolas podadas', res ? String(res.podados.length) : '—'],
        ['fuerza bruta', String(pts.length)],
      ]);
    }
    lienzo.alDibujar = () => raiz && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      q = [pl.ix(x), pl.iy(y)]; res = buscarBolas(raiz, X, q);
      dibujar();
    });
    generar();
  }

  /* ---------- Fig. 2: costo según la dimensión ---------- */

  const DIMS = [2, 3, 4, 6, 8, 12, 16, 24, 32];
  function montarDimension(cuerpo) {
    let n = 1000, datos = 'cumulos', filas = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: [['uniformes', 'Uniformes en el cubo'], ['cumulos', 'Cúmulos (dimensión intrínseca baja)']], valor: datos, alCambiar: (v) => { datos = v; calcular(); } });
    ctl.rango({ etiqueta: 'Puntos n', min: 200, max: 3000, paso: 100, valor: n, alCambiar: (v) => { n = v; }, alSoltar: () => calcular() });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['bruta', 'fuerza bruta (n)', C.apagado], ['kd', 'árbol k-d', C.s1], ['bola', 'ball tree', C.s2]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Promedio de distancias calculadas en 40 consultas del vecino más cercano (para el ball tree se cuentan también las distancias a los centros de las bolas). Con datos uniformes ambos árboles se acercan a la fuerza bruta al subir d; con cúmulos ambos siguen podando incluso en d = 32, porque lo que importa es la dimensión intrínseca.');
    function calcular() {
      filas = DIMS.map((d) => {
        const rnd = VIZ.semilla(d * 13 + n), N = () => VIZ.normal(rnd);
        let gen;
        if (datos === 'uniformes') gen = () => Array.from({ length: d }, rnd);
        else { const cs = Array.from({ length: 8 }, () => Array.from({ length: d }, rnd)); gen = () => { const c = cs[Math.floor(rnd() * 8)]; const t = N() * 0.15; return c.map((v, j) => v + (j < 2 ? t * (j ? 1 : -1) : 0) + N() * 0.02); }; }
        const X = Array.from({ length: n }, gen), Q = Array.from({ length: 40 }, gen);
        const kd = construirKD(X), bt = construirBolas(X, undefined, 8);
        return { d, bruta: n, kd: M.media(Q.map((q) => buscarKD(kd, X, q).distancias)), bola: M.media(Q.map((q) => buscarBolas(bt, X, q).distancias)) };
      });
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 2, xmax: 32, ymin: 1, ymax: n * 1.3 }, { etiquetaX: 'dimensión d', etiquetaY: 'distancias calculadas por consulta', logY: true, formatoY: (v) => VIZ.entero(v) });
      plano.ejes();
      for (const [k, , c] of SER) {
        VIZ.trazar(ctx, plano, filas.map((f) => [f.d, f[k]]), c, 2, k === 'bruta' ? [3, 4] : null);
        for (const f of filas) VIZ.marcador(ctx, plano.sx(f.d), plano.sy(f[k]), c, f === hover ? 5 : 3);
      }
      const f2 = filas[0], fu = filas[filas.length - 1];
      lectura.set([
        ['k-d en d = 2 · d = 32', `${VIZ.entero(f2.kd)} · ${VIZ.entero(fu.kd)}`],
        ['ball tree en d = 2 · d = 32', `${VIZ.entero(f2.bola)} · ${VIZ.entero(fu.bola)}`],
        ['fuerza bruta', VIZ.entero(n)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const dx = plano.ix(x);
      hover = filas.reduce((a, b) => (Math.abs(b.d - dx) < Math.abs(a.d - dx) ? b : a));
      dibujar();
      tip.mostrar(x, y, `d = <b>${hover.d}</b>` + SER.map(([k, t, c]) => VIZ.filaTooltip(c, t, VIZ.entero(hover[k]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('ball-tree', {
    intro: String.raw`
      <p>Un <strong>ball tree</strong> organiza los puntos en bolas anidadas: cada nodo es una hiperesfera (centro y radio) que
      contiene a todos sus puntos, y sus dos hijos son bolas más chicas que reparten esos puntos.</p>
      <p>Para buscar vecinos basta la desigualdad triangular: si la consulta está a distancia \(D\) del centro de una bola de
      radio \(r\), ningún punto de esa bola está a menos de \(D - r\). A diferencia del <a href="tema.html?id=kd-tree">árbol k-d</a>,
      las regiones no están alineadas con los ejes y se adaptan a la forma de los datos, lo que lo hace más robusto en dimensiones moderadas.</p>`,
    visualizaciones: [
      {
        titulo: 'Bolas anidadas',
        descripcion: 'Los nodos del árbol por profundidad. Haga clic para buscar el vecino más cercano y ver qué bolas se descartan enteras.',
        montar: montarBolas,
      },
      {
        titulo: 'Costo según la dimensión',
        descripcion: 'Distancias calculadas por consulta (escala logarítmica) para fuerza bruta, árbol k-d y ball tree al crecer la dimensión.',
        montar: montarDimension,
      },
    ],
    teoria: String.raw`
      <h2>Construcción</h2>
      <pre><code>construir(P):
    c ← centroide de P ;  r ← max_{p ∈ P} d(c, p)
    si |P| ≤ hoja: devolver hoja(c, r, P)
    j ← coordenada de mayor dispersión
    partir P por la mediana en j → P₁, P₂
    devolver nodo(c, r, construir(P₁), construir(P₂))</code></pre>
      <p>Otras variantes eligen dos puntos lejanos como semillas y asignan cada punto al más cercano. El costo es \(O(n \log n)\).</p>
      <h2>Cota de poda</h2>
      <p>Para todo \(p\) en la bola \(B(c, r)\), por desigualdad triangular,</p>
      \[ d(q, p) \ge d(q, c) - d(c, p) \ge d(q, c) - r. \]
      <p>Si \(d(q, c) - r \ge d_{\text{mejor}}\), la bola entera se descarta. Solo se necesita que \(d\) sea una
      <a href="tema.html?id=distance-metrics">métrica</a>: el ball tree funciona con cualquier distancia que cumpla la desigualdad
      triangular (Manhattan, Haversine, …), mientras que el árbol k-d requiere coordenadas.</p>
      <h2>k-d frente a ball tree</h2>
      <table>
        <tr><th></th><th>Árbol k-d</th><th>Ball tree</th></tr>
        <tr><td>Regiones</td><td>cajas alineadas a ejes</td><td>bolas que se adaptan a los datos</td></tr>
        <tr><td>Métricas</td><td>\(L_p\)</td><td>cualquier métrica</td></tr>
        <tr><td>Construcción</td><td>más rápida</td><td>más lenta (centroides y radios)</td></tr>
        <tr><td>Dimensión baja (\(d \le 5\))</td><td>muy eficiente</td><td>eficiente</td></tr>
        <tr><td>Dimensión moderada, datos con estructura</td><td>se degrada</td><td>suele degradarse más lento (depende de los datos)</td></tr>
      </table>
      <p>Lo que importa no es el número de columnas sino la <strong>dimensión intrínseca</strong> de los datos. En dimensiones
      realmente altas se usan búsquedas aproximadas: <em>locality-sensitive hashing</em> o grafos navegables (HNSW).</p>`,
  });
})();