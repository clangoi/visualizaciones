(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  // Colección pequeña ya tokenizada: frecuencia de cada término por documento y largo del documento.
  const DOCS = [
    { id: 'd1', titulo: 'Manual de SQL', tf: { sql: 12, indice: 2, consulta: 6 }, largo: 220 },
    { id: 'd2', titulo: 'Índices B+ en detalle', tf: { indice: 9, arbol: 7, consulta: 1 }, largo: 140 },
    { id: 'd3', titulo: 'Optimización de consultas SQL', tf: { sql: 4, consulta: 8, indice: 3, plan: 5 }, largo: 160 },
    { id: 'd4', titulo: 'Privacidad diferencial', tf: { privacidad: 10, ruido: 6 }, largo: 120 },
    { id: 'd5', titulo: 'Glosario de bases de datos', tf: { sql: 1, indice: 1, consulta: 1, privacidad: 1 }, largo: 40 },
    { id: 'd6', titulo: 'Enciclopedia de computación', tf: { sql: 6, indice: 5, consulta: 6, privacidad: 3 }, largo: 900 },
    { id: 'd7', titulo: 'Índice invertido', tf: { indice: 11, consulta: 4, texto: 8 }, largo: 180 },
    { id: 'd8', titulo: 'SQL avanzado', tf: { sql: 25, consulta: 3 }, largo: 260 },
  ];
  const TERMINOS = ['sql', 'indice', 'consulta', 'privacidad', 'arbol', 'texto', 'plan', 'ruido'];
  const NDOC = DOCS.length;
  const df = (t) => DOCS.filter((d) => d.tf[t]).length;
  const largoMedio = DOCS.reduce((s, d) => s + d.largo, 0) / NDOC;

  function puntaje(d, t, o) {
    const f = d.tf[t] || 0;
    if (!f) return 0;
    if (o.modelo === 'tfidf') return (1 + Math.log(f)) * Math.log(NDOC / df(t));
    const idf = Math.log(1 + (NDOC - df(t) + 0.5) / (df(t) + 0.5));
    return idf * (f * (o.k1 + 1)) / (f + o.k1 * (1 - o.b + (o.b * d.largo) / largoMedio));
  }

  /* ---------- Fig. 1: TF-IDF y BM25 ---------- */

  function montarRanking(cuerpo) {
    const o = { modelo: 'bm25', k1: 1.2, b: 0.75 };
    let consulta = { sql: true, indice: true }, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', valor: o.modelo, opciones: [['bm25', 'BM25'], ['tfidf', 'TF-IDF (log)']], alCambiar: (v) => { o.modelo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'k₁ (saturación)', min: 0, max: 3, paso: 0.1, valor: o.k1, formato: (v) => v.toFixed(1), alCambiar: (v) => { o.k1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'b (normalización por largo)', min: 0, max: 1, paso: 0.05, valor: o.b, formato: (v) => v.toFixed(2), alCambiar: (v) => { o.b = v; dibujar(); } });
    ctl.casillas(TERMINOS.slice(0, 5).map((t, i) => ({ clave: t, texto: t, color: VIZ.series[i], activo: !!consulta[t] })), (e) => { consulta = e; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 300 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'los colores de los términos están en las casillas de la consulta';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra suma la contribución de cada término. Pruebe b = 0 y vea subir a la enciclopedia larga (d6); baje k₁ y vea cómo deja de importar repetir «sql».');
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const q = TERMINOS.slice(0, 5).filter((t) => consulta[t]);
      const filas = DOCS.map((d) => ({ d, partes: q.map((t) => puntaje(d, t, o)) })).map((f) => ({ ...f, total: f.partes.reduce((s, v) => s + v, 0) })).sort((a, b) => b.total - a.total);
      const max = Math.max(1e-9, ...filas.map((f) => f.total));
      const izq = W < 560 ? 150 : 250, fh = (H - 20) / NDOC;
      geo = [];
      filas.forEach((f, i) => {
        const y = 10 + i * fh;
        B.texto(ctx, `${i + 1}. ${f.d.id} ${W < 560 ? '' : f.d.titulo}`.slice(0, W < 560 ? 18 : 40), 8, y + fh / 2, { px: 11, color: C.tinta });
        let x = izq;
        f.partes.forEach((v, j) => {
          const w = (v / max) * (W - izq - 60);
          ctx.fillStyle = VIZ.series[TERMINOS.indexOf(q[j])];
          ctx.fillRect(x, y + fh * 0.2, Math.max(0, w - 1), fh * 0.6);
          x += w;
        });
        B.texto(ctx, VIZ.fmt(f.total, 3), x + 6, y + fh / 2, { px: 11 });
        geo.push({ y, h: fh, f, q });
      });
      const prim = filas[0];
      lectura.set([
        ['primero', `${prim.d.id} (${VIZ.fmt(prim.total, 3)})`],
        ['largo medio', `${Math.round(largoMedio)} palabras`],
        ...q.slice(0, 3).map((t) => [`df(${t})`, `${df(t)} de ${NDOC}`]),
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => y >= q.y && y < q.y + q.h);
      hover = g; if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.f.d.id}</b> ${g.f.d.titulo}<br>largo ${g.f.d.largo}` + g.q.map((t, j) => VIZ.filaTooltip(VIZ.series[TERMINOS.indexOf(t)], `${t}: tf ${g.f.d.tf[t] || 0}`, VIZ.fmt(g.f.partes[j], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); });
    dibujar();
  }

  /* ---------- Fig. 2: precisión y exhaustividad ---------- */

  function montarPR(cuerpo) {
    let rel = [1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0], totalRel = 7, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Ranking perfecto', () => { rel = rel.map((_, i) => (i < 6 ? 1 : 0)); dibujar(); });
    ctl.boton('Ejemplo', () => { rel = [1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]; dibujar(); }, { primario: true });
    ctl.rango({ etiqueta: 'Relevantes en la colección', min: 1, max: 15, valor: totalRel, alCambiar: (v) => { totalRel = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 400 });
    lienzo.canvas.style.cursor = 'pointer';
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'resultado relevante' },
      { color: C.inactivo, texto: 'no relevante' },
      { color: C.s1, texto: 'precisión–exhaustividad', forma: 'linea' },
      { color: C.s2, texto: 'precisión interpolada', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una posición del ranking (arriba) para marcarla como relevante o no.');
    let geo = null, plano = null;
    function curva() {
      const R = Math.max(totalRel, rel.reduce((s, v) => s + v, 0));
      let ac = 0;
      return rel.map((v, i) => { ac += v; return { k: i + 1, p: ac / (i + 1), r: ac / R, v }; });
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const n = rel.length, cw = Math.min(40, (W - 20) / n);
      geo = { cw };
      B.texto(ctx, 'ranking (posición 1 a la izquierda)', 10, 8, { px: 10, color: C.apagado });
      rel.forEach((v, i) => {
        ctx.fillStyle = v ? C.s6 : C.inactivo;
        ctx.fillRect(10 + i * cw + 1, 20, cw - 2, 22);
        B.texto(ctx, String(i + 1), 10 + i * cw + cw / 2, 31, { alinear: 'center', color: C.sobre, px: 10, peso: 500 });
      });
      const pts = curva();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 1.05 }, { etiquetaX: 'exhaustividad (recall)', margen: { sup: 76 } });
      plano.ejes();
      B.texto(ctx, 'precisión', 4, 60, { color: C.tinta2, px: 11 });
      VIZ.trazar(ctx, plano, pts.map((q) => [q.r, q.p]), C.s1, 2);
      // Precisión interpolada: máximo de la precisión a la derecha.
      const interp = pts.map((q, i) => [q.r, Math.max(...pts.slice(i).map((z) => z.p))]);
      VIZ.trazar(ctx, plano, interp, C.s2, 2, [4, 3]);
      pts.forEach((q) => VIZ.marcador(ctx, plano.sx(q.r), plano.sy(q.p), q.v ? C.s6 : C.inactivo, hover === q.k - 1 ? 6 : 4));
      const R = Math.max(totalRel, rel.reduce((s, v) => s + v, 0));
      const ap = pts.filter((q) => q.v).reduce((s, q) => s + q.p, 0) / R;
      const dcg = rel.reduce((s, v, i) => s + v / Math.log2(i + 2), 0);
      const idcg = Array.from({ length: Math.min(R, n) }, (_, i) => 1 / Math.log2(i + 2)).reduce((s, v) => s + v, 0);
      lectura.set([
        ['P@5', VIZ.fmt(pts[4].p, 3)],
        ['P@10', VIZ.fmt(pts[9].p, 3)],
        ['R@10', VIZ.fmt(pts[9].r, 3)],
        ['precisión media (AP)', VIZ.fmt(ap, 3)],
        ['nDCG@15', VIZ.fmt(dcg / idcg, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (y < 18 || y > 44) return;
      const i = Math.floor((x - 10) / geo.cw);
      if (i < 0 || i >= rel.length) return;
      rel[i] = 1 - rel[i];
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = y >= 18 && y <= 44 ? Math.floor((x - 10) / geo.cw) : -1;
      if (i < 0 || i >= rel.length) { hover = null; tip.ocultar(); return dibujar(); }
      hover = i; dibujar();
      const q = curva()[i];
      tip.mostrar(x, y, `posición <b>${i + 1}</b>: ${q.v ? 'relevante' : 'no relevante'}<br>P@${i + 1} = ${VIZ.fmt(q.p, 3)}<br>R@${i + 1} = ${VIZ.fmt(q.r, 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: búsqueda vectorial ---------- */

  function montarVectores(cuerpo) {
    let k = 4, metrica = 'coseno', q = [0.55, 0.75], semilla = 3, puntos = [];
    const TEMAS = [['SQL', [0.9, 0.35]], ['privacidad', [0.25, 0.9]], ['índices', [0.8, 0.8]]];
    function generar() {
      const rnd = VIZ.semilla(semilla);
      puntos = [];
      TEMAS.forEach(([t, c], g) => {
        for (let i = 0; i < 9; i++) {
          const esc = 0.4 + rnd() * 0.8;
          puntos.push({ g, t, v: [(c[0] + VIZ.normal(rnd) * 0.08) * esc, (c[1] + VIZ.normal(rnd) * 0.08) * esc] });
        }
      });
    }
    generar();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'k vecinos', min: 1, max: 10, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Similitud', valor: metrica, opciones: [['coseno', 'coseno (ángulo)'], ['euclidea', 'distancia euclídea']], alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 420 });
    lienzo.canvas.style.cursor = 'crosshair';
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...TEMAS.map(([t], i) => ({ color: VIZ.series[i], texto: `documentos sobre ${t}`, forma: 'punto' })),
      { color: C.tinta, texto: 'vector de la consulta', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para mover la consulta. Con coseno solo importa la dirección del vector: un documento corto y uno largo del mismo tema quedan igual de cerca.');
    let plano = null;
    const cos = (a, b) => (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
    function vecinos() {
      const s = puntos.map((p, i) => ({ i, s: metrica === 'coseno' ? cos(p.v, q) : -Math.hypot(p.v[0] - q[0], p.v[1] - q[1]) }));
      return s.sort((a, b) => b.s - a.s).slice(0, k);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1.3, ymin: 0, ymax: 1.3 }, { etiquetaX: 'dimensión 1 del embedding', etiquetaY: 'dimensión 2' });
      plano.ejes();
      const vec = vecinos(), elegidos = new Set(vec.map((v) => v.i));
      if (metrica === 'coseno') {
        // Cono que contiene a los k vecinos.
        const angs = vec.map((v) => Math.atan2(puntos[v.i].v[1], puntos[v.i].v[0]));
        const a0 = Math.min(...angs), a1 = Math.max(...angs);
        ctx.fillStyle = VIZ.alfa(C.tinta, 0.06);
        ctx.beginPath(); ctx.moveTo(plano.sx(0), plano.sy(0));
        ctx.lineTo(plano.sx(1.8 * Math.cos(a0)), plano.sy(1.8 * Math.sin(a0))); ctx.lineTo(plano.sx(1.8 * Math.cos(a1)), plano.sy(1.8 * Math.sin(a1)));
        ctx.closePath(); ctx.save(); plano.recortar(); ctx.fill(); ctx.restore();
        ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plano.sx(0), plano.sy(0)); const L = 1.25 / Math.max(...q); ctx.lineTo(plano.sx(q[0] * L), plano.sy(q[1] * L)); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const r = -vec[vec.length - 1].s;
        ctx.fillStyle = VIZ.alfa(C.tinta, 0.06);
        ctx.beginPath(); ctx.ellipse(plano.sx(q[0]), plano.sy(q[1]), plano.sx(r) - plano.sx(0), plano.sy(0) - plano.sy(r), 0, 0, Math.PI * 2); ctx.fill();
      }
      puntos.forEach((p, i) => {
        VIZ.marcador(ctx, plano.sx(p.v[0]), plano.sy(p.v[1]), VIZ.series[p.g], elegidos.has(i) ? 6 : 4, p.g);
        if (elegidos.has(i)) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(plano.sx(p.v[0]), plano.sy(p.v[1]), 9, 0, Math.PI * 2); ctx.stroke(); }
      });
      VIZ.marcador(ctx, plano.sx(q[0]), plano.sy(q[1]), C.tinta, 6, 5);
      const porTema = TEMAS.map((_, g) => vec.filter((v) => puntos[v.i].g === g).length);
      lectura.set([
        ...TEMAS.map(([t], g) => [`vecinos de ${t}`, String(porTema[g])]),
        ['comparaciones (búsqueda exacta)', String(puntos.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      q = [Math.max(0.02, plano.ix(x)), Math.max(0.02, plano.iy(y))];
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano) return;
      const p = puntos.find((z) => Math.hypot(plano.sx(z.v[0]) - x, plano.sy(z.v[1]) - y) < 7);
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `documento sobre <b>${p.t}</b><br>coseno con la consulta ${VIZ.fmt(cos(p.v, q), 3)}<br>distancia ${VIZ.fmt(Math.hypot(p.v[0] - q[0], p.v[1] - q[1]), 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('retrieval', {
    intro: String.raw`
      <p>Un <a href="tema.html?id=full-text-search">índice invertido</a> dice qué documentos contienen los términos; la
      <strong>recuperación de información</strong> decide en qué <em>orden</em> mostrarlos. Nadie lee el resultado 500: un buen sistema
      pone los documentos relevantes arriba.</p>
      <p>Los modelos clásicos puntúan con estadísticas de los términos: un término cuenta más si aparece mucho en el documento (TF) y poco
      en la colección (IDF). Los modelos modernos representan consultas y documentos como <strong>vectores</strong> (embeddings) y buscan
      los más parecidos. En ambos casos, hay que medir la calidad del ranking con métricas como precisión y exhaustividad.</p>`,
    visualizaciones: [
      {
        titulo: 'TF-IDF y BM25',
        descripcion: 'Puntaje de ocho documentos para la consulta elegida. BM25 satura la frecuencia del término (k₁) y penaliza los documentos largos (b).',
        montar: montarRanking,
      },
      {
        titulo: 'Precisión y exhaustividad',
        descripcion: 'Marque qué resultados del ranking son relevantes y vea la curva de precisión–exhaustividad, la precisión media y el nDCG.',
        montar: montarPR,
      },
      {
        titulo: 'Búsqueda vectorial',
        descripcion: 'Documentos como vectores de embedding en dos dimensiones. Mueva la consulta y compare los k vecinos por coseno y por distancia euclídea.',
        montar: montarVectores,
      },
    ],
    teoria: String.raw`
      <h2>TF-IDF</h2>
      <p>Con \(N\) documentos, \(\text{df}(t)\) de ellos con el término \(t\) y \(f_{t,d}\) apariciones de \(t\) en \(d\):</p>
      \[ \text{tfidf}(t, d) = \big(1 + \log f_{t,d}\big) \cdot \log \frac{N}{\text{df}(t)}, \qquad
         \text{score}(q, d) = \sum_{t \in q} \text{tfidf}(t, d). \]
      <p>El IDF hace que «sql», presente en casi todo, pese menos que «privacidad». El logaritmo del TF modela que la décima aparición
      aporta menos que la primera.</p>

      <h2>BM25</h2>
      \[ \text{BM25}(q, d) = \sum_{t \in q} \text{idf}(t) \cdot \frac{f_{t,d}\,(k_1 + 1)}{f_{t,d} + k_1\left(1 - b + b\,\dfrac{|d|}{\overline{|d|}}\right)}. \]
      <p>El TF <strong>satura</strong>: cuando \(f_{t,d} \to \infty\) la fracción tiende a \(k_1 + 1\). El parámetro \(b \in [0, 1]\)
      normaliza por el largo: un documento el doble de largo que el promedio necesita el doble de apariciones para el mismo puntaje. Los
      valores habituales son \(k_1 \in [1{,}2;\, 2]\) y \(b = 0{,}75\); es el ranking por defecto de Lucene y Elasticsearch.</p>

      <h2>Evaluación</h2>
      <p>Con un conjunto de documentos relevantes \(\mathcal R\) y los \(k\) primeros resultados \(S_k\):</p>
      \[ P@k = \frac{|S_k \cap \mathcal R|}{k}, \qquad R@k = \frac{|S_k \cap \mathcal R|}{|\mathcal R|}, \qquad
         \text{AP} = \frac{1}{|\mathcal R|} \sum_{k:\, d_k \in \mathcal R} P@k. \]
      <p>La media de AP sobre muchas consultas es el MAP. El <strong>nDCG</strong> descuenta cada acierto por \(1/\log_2(k+1)\) y admite
      relevancias graduadas.</p>

      <h2>Búsqueda vectorial</h2>
      <p>Un modelo de lenguaje convierte cada texto en un vector \(\mathbf v \in \mathbb R^{d}\) (con \(d\) de cientos a miles) de modo que
      textos de significado parecido quedan cerca. La similitud habitual es el coseno,</p>
      \[ \cos(\mathbf q, \mathbf v) = \frac{\mathbf q \cdot \mathbf v}{\|\mathbf q\|\,\|\mathbf v\|}, \]
      <p>que ignora la norma. Encuentra sinónimos que BM25 no ve («auto» y «vehículo»), pero falla con nombres propios o códigos exactos;
      por eso se combinan (<em>búsqueda híbrida</em>). Comparar con todos los vectores cuesta \(O(Nd)\); los índices aproximados (HNSW,
      IVF) responden en tiempo sublineal a cambio de perder algunos vecinos. Es la etapa de recuperación de los sistemas RAG, y la
      extensión <code>pgvector</code> la agrega a PostgreSQL.</p>`,
  });
})();
