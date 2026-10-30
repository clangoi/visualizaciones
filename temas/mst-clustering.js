(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };
  // Árbol de expansión mínima euclidiano por Kruskal; devuelve también el orden de examen de las aristas.
  function kruskal(pts) {
    const n = pts.length, pares = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pares.push({ i, j, d: Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) });
    pares.sort((a, b) => a.d - b.d);
    const padre = pts.map((_, i) => i), raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
    const pasos = [], arbol = [];
    for (const e of pares) {
      if (arbol.length === n - 1) break;
      const ok = raiz(e.i) !== raiz(e.j);
      if (ok) { padre[raiz(e.i)] = raiz(e.j); arbol.push(e); }
      pasos.push({ e, ok });
    }
    return { arbol, pasos };
  }

  /* ---------- Fig. 1: Kruskal sobre los puntos ---------- */

  function montarKruskal(cuerpo) {
    let n = 40, semilla = 1, pts = [], K = null, t = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Puntos n', min: 5, max: 80, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arista aceptada (une dos componentes)', forma: 'linea' },
      { color: C.s2, texto: 'arista examinada en este paso', forma: 'linea' },
      { color: C.s8, texto: 'rechazada: formaría un ciclo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Kruskal recorre todos los pares de puntos de menor a mayor distancia y acepta una arista si une dos componentes distintas. Cada arista aceptada es exactamente una fusión del enlace simple.');
    function iniciar() {
      pts = M.datos2d('manchas', n, semilla, { dispersion: 1.4 });
      K = kruskal(pts); t = 0;
      return (function* () { while (t < K.pasos.length) { t++; yield; } })();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      const hechos = K.pasos.slice(0, t), actual = t ? K.pasos[t - 1] : null;
      ctx.save(); pl.recortar();
      for (const p of hechos) {
        if (!p.ok && p !== actual) continue;
        VIZ.trazar(ctx, pl, [[pts[p.e.i].x, pts[p.e.i].y], [pts[p.e.j].x, pts[p.e.j].y]], p === actual ? (p.ok ? C.s2 : C.s8) : C.s1, p === actual ? 3 : 2, p === actual && !p.ok ? [4, 3] : null);
      }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: () => C.tinta2, r: 3.5 });
      const aceptadas = hechos.filter((p) => p.ok).length;
      registro.textContent = actual ? `Arista de largo ${VIZ.fmt(actual.e.d, 3)}: ${actual.ok ? 'une dos componentes, se acepta.' : 'sus extremos ya están conectados, se rechaza.'}` : 'Al inicio hay n componentes, una por punto.';
      lectura.set([
        ['aristas aceptadas', `${aceptadas} / ${n - 1}`],
        ['rechazadas', String(hechos.length - aceptadas)],
        ['componentes', String(n - aceptadas)],
        ['peso total del árbol', VIZ.fmt(M.suma(hechos.filter((p) => p.ok).map((p) => p.e.d)), 4)],
      ]);
    }
    lienzo.alDibujar = () => K && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cortar las aristas más largas ---------- */

  function montarCorte(cuerpo) {
    let tipo = 'lunas', k = 2, semilla = 2, pts = [], arbol = [], ruido = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'Grupos k (cortes = k − 1)', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido de fondo', min: 0, max: 0.15, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; generar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Quitar las k − 1 aristas más largas del árbol deja k componentes: son los mismos grupos que el enlace simple con k grupos. Agregue ruido de fondo: unos pocos puntos sueltos bastan para que las aristas largas sean las que los conectan, y los grupos reales quedan unidos (efecto cadena).');
    function generar() { pts = M.datos2d(tipo, 150, semilla, { ruido }); arbol = kruskal(pts).arbol; dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      const orden = arbol.slice().sort((a, b) => b.d - a.d), cortadas = new Set(orden.slice(0, k - 1));
      const padre = pts.map((_, i) => i), raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
      for (const e of arbol) if (!cortadas.has(e)) padre[raiz(e.i)] = raiz(e.j);
      const mapa = new Map(), et = pts.map((_, i) => { const r = raiz(i); if (!mapa.has(r)) mapa.set(r, mapa.size); return mapa.get(r); });
      ctx.save(); pl.recortar();
      for (const e of arbol) {
        const c = cortadas.has(e);
        VIZ.trazar(ctx, pl, [[pts[e.i].x, pts[e.i].y], [pts[e.j].x, pts[e.j].y]], c ? C.s8 : M.colorGrupo(et[e.i]), c ? 2 : 1.5, c ? [4, 3] : null);
      }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: (p, i) => M.colorGrupo(et[i]), forma: (p, i) => et[i], r: 3.2 });
      leyenda.set([...M.leyendaGrupos(k), { color: C.s8, texto: 'arista cortada', forma: 'linea' }]);
      const sl = M.cortar(M.aglomerativo(pts.map(M.xy), 'simple'), pts.length, { k });
      const tam = [...mapa.values()].map((g) => et.filter((x) => x === g).length).sort((a, b) => b - a);
      lectura.set([
        ['ARI frente al enlace simple', VIZ.fmt(M.randAjustado(et, sl), 3)],
        ['ARI frente a los grupos reales', VIZ.fmt(M.randAjustado(et, pts.map((p) => p.g)), 3)],
        ['tamaños de los grupos', tam.join(' · ')],
        ['largo de la arista k-ésima', orden[k - 1] ? VIZ.fmt(orden[k - 1].d, 3) : '—'],
      ]);
    }
    lienzo.alDibujar = () => arbol.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const px = pl.ix(x), py = pl.iy(y);
      let mejor = null, dm = 0.04;
      for (const e of arbol) {
        const a = pts[e.i], b = pts[e.j], vx = b.x - a.x, vy = b.y - a.y, u = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / (vx * vx + vy * vy || 1)));
        const d = Math.hypot(a.x + u * vx - px, a.y + u * vy - py);
        if (d < dm) { dm = d; mejor = e; }
      }
      if (!mejor) return tip.ocultar();
      const rango = arbol.slice().sort((a, b) => b.d - a.d).indexOf(mejor) + 1;
      tip.mostrar(x, y, `arista de largo <b>${VIZ.fmt(mejor.d, 3)}</b><br>es la <b>${rango}.ª</b> más larga`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('mst-clustering', {
    intro: String.raw`
      <p>Unir cada punto con todos los demás forma un grafo completo cuyas aristas pesan lo que mide la distancia. Su
      <strong>árbol de expansión mínima</strong> (MST) conecta todos los puntos con el menor largo total, y resume la estructura
      de vecindad de los datos en solo \(n - 1\) aristas.</p>
      <p>Hay una equivalencia exacta: <strong>cortar las k − 1 aristas más largas del MST da los mismos k grupos que el
      clustering jerárquico de enlace simple</strong>. El MST es además la base de <a href="tema.html?id=hdbscan">HDBSCAN</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Kruskal sobre los puntos',
        descripcion: 'El MST euclidiano construido arista por arista. Observe que las primeras aristas unen puntos dentro de cada mancha y las últimas, las manchas entre sí.',
        montar: montarKruskal,
      },
      {
        titulo: 'Cortar las aristas más largas',
        descripcion: 'Elija k y vea qué aristas se cortan. El ARI frente al enlace simple es siempre 1: son el mismo método.',
        montar: montarCorte,
      },
    ],
    teoria: String.raw`
      <h2>Árbol de expansión mínima</h2>
      <p>Dado un grafo con pesos, un MST es un árbol que toca todos los vértices y minimiza la suma de pesos.
      <a href="tema.html?id=kruskal">Kruskal</a> ordena las aristas y agrega cada una si no forma ciclo (con unión-búsqueda);
      <a href="tema.html?id=prim">Prim</a> crece un solo árbol desde un vértice. Sobre el grafo completo de \(n\) puntos, Prim con una
      matriz cuesta \(O(n^2)\); en el plano, el MST euclidiano es subgrafo de la triangulación de Delaunay y sale en \(O(n \log n)\).</p>
      <h2>Equivalencia con el enlace simple</h2>
      <div class="recuadro"><p>Las fusiones del clustering aglomerativo con enlace simple son, en orden, las aristas que acepta Kruskal, y la
      altura de cada fusión es el peso de la arista. Por lo tanto, los \(k\) grupos del enlace simple son las \(k\) componentes del MST
      sin sus \(k - 1\) aristas más pesadas.</p></div>
      <p><em>Idea de la prueba</em>: en cada momento, la distancia de enlace simple entre dos grupos es la arista más corta que los
      cruza. Kruskal acepta justamente la arista más corta entre componentes distintas, y por la propiedad de corte esa arista está en el MST.</p>
      <h2>Ventajas y problemas</h2>
      <ul>
        <li>Encuentra grupos de cualquier forma (lunas, anillos) siempre que haya un hueco entre ellos.</li>
        <li>Un camino de puntos de ruido entre dos grupos los une: es el <strong>efecto cadena</strong>. Las aristas más largas suelen ser
        las que llegan a puntos aislados, así que cortarlas aísla ruido en vez de separar grupos.</li>
        <li>La solución: reemplazar la distancia por una que «empuje» lejos a los puntos de zonas poco densas, la
        <strong>distancia de alcanzabilidad mutua</strong> de <a href="tema.html?id=hdbscan">HDBSCAN</a>.</li>
      </ul>`,
  });
})();