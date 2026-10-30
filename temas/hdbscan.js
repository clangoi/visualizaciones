(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };

  /* HDBSCAN completo y pequeño: distancias núcleo, MST de alcanzabilidad mutua (Prim), jerarquía de enlace simple,
     árbol condensado con tamaño mínimo de grupo y selección por estabilidad (exceso de masa). */
  function hdbscan(pts, minPts, minTam) {
    const n = pts.length, d = (i, j) => Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    const nucleo = pts.map((_, i) => pts.map((__, j) => d(i, j)).sort((a, b) => a - b)[Math.min(n - 1, minPts - 1)]);
    const mr = (i, j) => Math.max(nucleo[i], nucleo[j], d(i, j));
    // Prim O(n²).
    const en = new Array(n).fill(false), mejor = new Array(n).fill(Infinity), de = new Array(n).fill(-1), mst = [];
    mejor[0] = 0;
    for (let t = 0; t < n; t++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!en[i] && (u < 0 || mejor[i] < mejor[u])) u = i;
      en[u] = true;
      if (de[u] >= 0) mst.push({ i: de[u], j: u, w: mejor[u] });
      for (let v = 0; v < n; v++) if (!en[v]) { const w = mr(u, v); if (w < mejor[v]) { mejor[v] = w; de[v] = u; } }
    }
    // Jerarquía: nodos internos con hijos y distancia.
    const orden = mst.slice().sort((a, b) => a.w - b.w);
    const padre = Array.from({ length: 2 * n }, (_, i) => i), raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
    const nodo = Array.from({ length: n }, (_, i) => ({ hoja: true, i, tam: 1 }));
    orden.forEach((e) => {
      const a = raiz(e.i), b = raiz(e.j), id = nodo.length;
      nodo.push({ hijos: [a, b], d: e.w, tam: nodo[a].tam + nodo[b].tam });
      padre[a] = id; padre[b] = id;
    });
    const hojas = (id) => (nodo[id].hoja ? [nodo[id].i] : nodo[id].hijos.flatMap(hojas));
    // Árbol condensado.
    const grupos = []; // { padre, nacimiento λ, muerte λ, puntos: [[i, λ_salida]], hijos: [], tam }
    function condensar(id, g) {
      const nd = nodo[id];
      if (nd.hoja) { grupos[g].puntos.push([nd.i, grupos[g].muerte ?? Infinity]); return; }
      const lam = nd.d > 0 ? 1 / nd.d : 1e6;
      const [a, b] = nd.hijos, ta = nodo[a].tam, tb = nodo[b].tam;
      if (ta >= minTam && tb >= minTam) {
        grupos[g].muerte = lam;
        for (const h of [a, b]) {
          const k = grupos.length;
          grupos.push({ padre: g, nacimiento: lam, muerte: null, puntos: [], hijos: [], tam: nodo[h].tam });
          grupos[g].hijos.push(k);
          condensar(h, k);
        }
      } else {
        for (const [h, t] of [[a, ta], [b, tb]]) {
          if (t < minTam) for (const i of hojas(h)) grupos[g].puntos.push([i, lam]);
          else condensar(h, g);
        }
      }
    }
    grupos.push({ padre: -1, nacimiento: 0, muerte: null, puntos: [], hijos: [], tam: n });
    condensar(nodo.length - 1, 0);
    grupos.forEach((G) => {
      const fin = G.muerte ?? Math.max(...G.puntos.map(([, l]) => (Number.isFinite(l) ? l : 0)), G.nacimiento);
      if (G.muerte == null) G.muerte = fin;
      G.puntos = G.puntos.map(([i, l]) => [i, Number.isFinite(l) ? l : fin]);
      const salidas = M.suma(G.puntos.map(([, l]) => l - G.nacimiento));
      const hijosQueSalen = G.hijos.length ? (G.muerte - G.nacimiento) * M.suma(G.hijos.map((h) => grupos[h].tam)) : 0;
      G.estabilidad = salidas + hijosQueSalen;
    });
    // Selección de abajo hacia arriba (la raíz no se elige).
    const elegido = new Array(grupos.length).fill(false), valor = new Array(grupos.length).fill(0);
    for (let k = grupos.length - 1; k >= 1; k--) {
      const G = grupos[k], sh = M.suma(G.hijos.map((h) => valor[h]));
      if (!G.hijos.length || G.estabilidad >= sh) { elegido[k] = true; valor[k] = G.estabilidad; const quitar = (h) => { elegido[h] = false; grupos[h].hijos.forEach(quitar); }; G.hijos.forEach(quitar); }
      else valor[k] = sh;
    }
    if (grupos.length === 1) elegido[0] = false;
    const sel = grupos.map((_, k) => k).filter((k) => elegido[k]);
    const et = new Array(n).fill(-1);
    sel.forEach((k, idx) => { const marcar = (h) => { grupos[h].puntos.forEach(([i]) => { et[i] = idx; }); grupos[h].hijos.forEach(marcar); }; marcar(k); });
    return { nucleo, mst, grupos, sel, et };
  }

  /* ---------- Fig. 1: distancia núcleo y alcanzabilidad mutua ---------- */

  function montarAlcanzabilidad(cuerpo) {
    let minPts = 6, semilla = 2, pts = [], R = null, modo = 'mutua';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'MinPts', min: 1, max: 20, valor: minPts, alCambiar: (v) => { minPts = v; calcular(); } });
    ctl.selector({ etiqueta: 'Árbol sobre', opciones: [['mutua', 'alcanzabilidad mutua'], ['euclidiana', 'distancia euclidiana']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arista del MST (grosor ∝ cercanía)', forma: 'linea' },
      { color: C.s8, texto: 'las 5 aristas más pesadas', forma: 'linea' },
      { color: C.s3, texto: 'círculo de radio núcleo(p)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un punto para ver su distancia núcleo. Con alcanzabilidad mutua, un punto aislado queda «lejos» de todos (su núcleo es grande), así que las aristas más pesadas del árbol son las que llegan al ruido, no las que cruzan grupos densos.');
    function generar() { pts = M.datos2d('densidades', 150, semilla, { ruido: 0.06 }); calcular(); }
    function calcular() { R = hdbscan(pts, minPts, 8); dibujar(); }
    let pl = null, hover = -1;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      let arbol = R.mst;
      if (modo === 'euclidiana') {
        const n = pts.length, en = new Array(n).fill(false), mejor = new Array(n).fill(Infinity), de = new Array(n).fill(-1);
        mejor[0] = 0; arbol = [];
        for (let t = 0; t < n; t++) {
          let u = -1;
          for (let i = 0; i < n; i++) if (!en[i] && (u < 0 || mejor[i] < mejor[u])) u = i;
          en[u] = true; if (de[u] >= 0) arbol.push({ i: de[u], j: u, w: mejor[u] });
          for (let v = 0; v < n; v++) if (!en[v]) { const w = Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y); if (w < mejor[v]) { mejor[v] = w; de[v] = u; } }
        }
      }
      const pesadas = new Set(arbol.slice().sort((a, b) => b.w - a.w).slice(0, 5));
      const wmax = Math.max(...arbol.map((e) => e.w));
      ctx.save(); pl.recortar();
      for (const e of arbol) {
        const p = pesadas.has(e);
        VIZ.trazar(ctx, pl, [[pts[e.i].x, pts[e.i].y], [pts[e.j].x, pts[e.j].y]], p ? C.s8 : C.s1, p ? 2.5 : 0.8 + 2.2 * (1 - e.w / wmax), p ? [4, 3] : null);
      }
      if (hover >= 0) { ctx.strokeStyle = C.s3; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.sx(pts[hover].x), pl.sy(pts[hover].y), R.nucleo[hover] * (pl.sx(1) - pl.sx(0)), 0, 2 * Math.PI); ctx.stroke(); }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: () => C.tinta2, r: 3 });
      const aRuido = [...pesadas].filter((e) => pts[e.i].g < 0 || pts[e.j].g < 0).length;
      lectura.set([
        ['peso total del árbol', VIZ.fmt(M.suma(arbol.map((e) => e.w)), 4)],
        ['de las 5 más pesadas, tocan ruido', `${aRuido} de 5`],
        ['núcleo mínimo · máximo', `${VIZ.fmt(Math.min(...R.nucleo), 3)} · ${VIZ.fmt(Math.max(...R.nucleo), 3)}`],
      ]);
    }
    lienzo.alDibujar = () => R && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      if (pl) pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m !== hover) { hover = m; dibujar(); }
      if (m < 0) return tip.ocultar();
      tip.mostrar(x, y, `núcleo<sub>${minPts}</sub>(p) = <b>${VIZ.fmt(R.nucleo[m], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (R) dibujar(); });
    generar();
  }

  /* ---------- Fig. 2: árbol condensado y estabilidad ---------- */

  function montarCondensado(cuerpo) {
    let tipo = 'densidades', minPts = 5, minTam = 10, semilla = 1, pts = [], R = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'MinPts', min: 2, max: 20, valor: minPts, alCambiar: (v) => { minPts = v; calcular(); } });
    ctl.rango({ etiqueta: 'Tamaño mínimo de grupo', min: 3, max: 40, valor: minTam, alCambiar: (v) => { minTam = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.4) : Math.min(420, Math.round(w * 0.45))) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El primer panel es el árbol condensado: cada barra es un grupo: nace arriba (λ = 1/distancia) cuando su padre se divide y se angosta a medida que pierde puntos. Se eligen los grupos de mayor estabilidad (área); los elegidos van en color. Pase el cursor sobre una barra.');
    function generar() { pts = M.datos2d(tipo, 200, semilla, { ruido: 0.05 }); calcular(); }
    function calcular() { R = hdbscan(pts, minPts, minTam); dibujar(); }
    let barras = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.5 : H;
      const G = R.grupos, lmax = Math.max(...G.map((g) => g.muerte)) * 1.02 || 1;
      const sub = { ...lienzo, ancho: wA, alto: hA, ctx };
      const pt = VIZ.plano(sub, { xmin: 0, xmax: pts.length, ymin: -lmax, ymax: 0 }, { etiquetaY: 'λ = 1 / distancia', ticksX: [], formatoY: (v) => VIZ.fmt(-v, 3), margen: { izq: 48 } });
      pt.ejes();
      barras = [];
      const selIdx = new Map(R.sel.map((k, i) => [k, i]));
      (function ubicar(k, x0) {
        const g = G[k], ancho = g.tam;
        // Ancho que decae con los puntos que salen: polígono escalonado.
        const salidas = g.puntos.map(([, l]) => l).sort((a, b) => a - b);
        const col = selIdx.has(k) ? M.colorGrupo(selIdx.get(k)) : C.inactivo;
        const cx = x0 + ancho / 2;
        ctx.fillStyle = selIdx.has(k) ? VIZ.alfa(col, 0.75) : VIZ.alfa(C.inactivo, 0.35);
        ctx.beginPath();
        let w = ancho, l = g.nacimiento;
        const izq = [], der = [];
        izq.push([cx - w / 2, l]); der.push([cx + w / 2, l]);
        for (const s of salidas) { if (s > l) { izq.push([cx - w / 2, s]); der.push([cx + w / 2, s]); l = s; } w -= 1; izq.push([cx - w / 2, l]); der.push([cx + w / 2, l]); }
        const fin = g.muerte;
        izq.push([cx - w / 2, fin]); der.push([cx + w / 2, fin]);
        [...izq, ...der.reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(pt.sx(x), pt.sy(-y)) : ctx.moveTo(pt.sx(x), pt.sy(-y))));
        ctx.closePath(); ctx.fill();
        if (selIdx.has(k)) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
        barras.push({ k, x0: pt.sx(x0), x1: pt.sx(x0 + ancho), y0: pt.sy(-g.nacimiento), y1: pt.sy(-fin) });
        let x = x0 + (ancho - M.suma(g.hijos.map((h) => G[h].tam))) / 2;
        for (const h of g.hijos) { ubicar(h, x); x += G[h].tam; }
      })(0, 0);

      ctx.save();
      const ox = vertical ? 0 : wA, oy = vertical ? hA : 0;
      ctx.translate(ox, oy);
      const pl = planoDatos({ ...lienzo, ancho: vertical ? W : W - wA, alto: vertical ? H - hA : H, ctx });
      pl.ejes();
      M.dispersion(ctx, pl, pts, { color: (p, i) => (R.et[i] < 0 ? C.tinta : M.colorGrupo(R.et[i])), forma: (p, i) => (R.et[i] < 0 ? 5 : R.et[i]), r: 3.2 });
      ctx.restore();
      leyenda.set([...M.leyendaGrupos(Math.max(1, R.sel.length)), { color: C.inactivo, texto: 'grupo no elegido', forma: 'cuadro' }, { color: C.tinta, texto: 'ruido (cruz)', forma: 'cuadro' }]);
      const db = M.dbscan(pts, 0.12, minPts), verdad = pts.map((p) => p.g);
      lectura.set([
        ['grupos elegidos', String(R.sel.length)],
        ['ruido', String(R.et.filter((e) => e < 0).length)],
        ['ARI de HDBSCAN', VIZ.fmt(M.randAjustado(R.et, verdad), 3)],
        ['ARI de DBSCAN (ε = 0,12)', VIZ.fmt(M.randAjustado(db.etiqueta, verdad), 3)],
      ]);
    }
    lienzo.alDibujar = () => R && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const b = barras.filter((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 - 2 && y <= q.y1 + 2).pop();
      if (!b) return tip.ocultar();
      const g = R.grupos[b.k];
      tip.mostrar(x, y, `${R.sel.includes(b.k) ? 'grupo elegido' : 'grupo'} con <b>${g.tam}</b> puntos<br>nace en λ = <b>${VIZ.fmt(g.nacimiento, 3)}</b><br>estabilidad <b>${VIZ.fmt(g.estabilidad, 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('hdbscan', {
    intro: String.raw`
      <p><strong>HDBSCAN</strong> (Campello, Moulavi y Sander, 2013) es <a href="tema.html?id=dbscan">DBSCAN</a> para todos los
      valores de \(\varepsilon\) a la vez. En lugar de fijar un radio, construye la jerarquía completa de grupos por densidad y
      después elige, rama por rama, los grupos que <strong>persisten</strong> en un rango amplio de densidades.</p>
      <p>El resultado: grupos de densidades distintas en un mismo conjunto, ruido marcado como tal, y un solo parámetro
      intuitivo, el tamaño mínimo de grupo.</p>`,
    visualizaciones: [
      {
        titulo: 'Distancia núcleo y alcanzabilidad mutua',
        descripcion: 'El árbol de expansión mínima con la distancia de HDBSCAN frente a la euclidiana. Compare a qué puntos llegan las aristas más pesadas.',
        montar: montarAlcanzabilidad,
      },
      {
        titulo: 'Árbol condensado y estabilidad',
        descripcion: 'La jerarquía resumida y los grupos elegidos por estabilidad, con el resultado en el plano. Compare su ARI con el de DBSCAN en «Densidades distintas».',
        montar: montarCondensado,
      },
    ],
    teoria: String.raw`
      <h2>Distancia de alcanzabilidad mutua</h2>
      <p>Con \(\operatorname{núcleo}_k(p)\) la distancia al \(k\)-ésimo vecino (\(k = \text{MinPts}\), contando a \(p\)):</p>
      \[ d_{\text{mreach}}(a, b) = \max\{\operatorname{núcleo}_k(a),\ \operatorname{núcleo}_k(b),\ d(a, b)\}. \]
      <p>En zonas densas no cambia nada; los puntos de zonas poco densas quedan «empujados» lejos de todos. Un punto es núcleo de
      DBSCAN con radio \(\varepsilon\) exactamente cuando \(\operatorname{núcleo}_k(p) \le \varepsilon\).</p>
      <h2>De la jerarquía al árbol condensado</h2>
      <ol>
        <li>Construir el <a href="tema.html?id=mst-clustering">MST</a> del grafo completo con pesos \(d_{\text{mreach}}\).</li>
        <li>Ordenar sus aristas: la jerarquía de enlace simple que resulta contiene los grupos de DBSCAN* para todo \(\varepsilon\).</li>
        <li>Recorrerla de arriba abajo con \(\lambda = 1/\varepsilon\) creciente. En cada división, si ambos lados tienen al menos
        <em>tamaño mínimo</em> puntos, nacen dos grupos nuevos; si un lado es más chico, esos puntos «se caen» del grupo actual, que sigue.</li>
      </ol>
      <h2>Estabilidad y selección</h2>
      <p>Si el grupo \(C\) nace en \(\lambda_{\text{nac}}(C)\) y cada punto \(p\) lo deja en \(\lambda_p\), su estabilidad es</p>
      \[ S(C) = \sum_{p \in C} \bigl(\lambda_p - \lambda_{\text{nac}}(C)\bigr), \]
      <p>el área de su barra en el árbol condensado. Se recorre el árbol desde las hojas: si \(S(C)\) es mayor que la suma de las
      estabilidades elegidas de sus hijos, se elige \(C\) y se descartan sus descendientes; si no, se conservan los hijos. Así se
      maximiza la estabilidad total con grupos que no se solapan (<em>exceso de masa</em>).</p>
      <h2>Costo y parámetros</h2>
      <p>El paso dominante es el MST: \(O(n^2)\) en general, cerca de \(O(n \log n)\) con árboles de bolas y Borůvka dual-tree.
      <em>min_cluster_size</em> fija qué se considera un grupo; <em>min_samples</em> (MinPts) cuánto se suaviza la densidad: valores
      mayores dan más ruido y grupos más conservadores. Esta página implementa la versión exacta para datos pequeños.</p>`,
  });
})();