(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const M = VIZ.ml;

  // Plano con la misma escala en ambos ejes (necesaria para ver ángulos y distancias reales).
  function planoIsometrico(lienzo, semi = 1.2) {
    const m = { izq: 40, der: 18, sup: 14, inf: 30 };
    const w = lienzo.ancho - m.izq - m.der, h = lienzo.alto - m.sup - m.inf;
    const sx = (semi * w) / h;
    return VIZ.plano(lienzo, { xmin: -sx, xmax: sx, ymin: -semi, ymax: semi }, { margen: m });
  }

  /* ---------- Fig. 1: análisis de componentes principales ---------- */

  function montarPCA(cuerpo) {
    let angulo = 30, razon = 0.3, semilla = 1, proyectar = false, pts = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Orientación de la nube', min: 0, max: 180, valor: angulo, formato: (v) => `${v}°`, alCambiar: (v) => { angulo = v; datos(); } });
    ctl.rango({ etiqueta: 'Dispersión transversal σ₂ / σ₁', min: 0.05, max: 1, paso: 0.05, valor: razon, formato: (v) => v.toFixed(2), alCambiar: (v) => { razon = v; datos(); } });
    ctl.casilla({ etiqueta: 'Proyectar sobre la primera componente', valor: proyectar, alCambiar: (v) => { proyectar = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 420 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'datos', forma: 'punto' },
      { color: C.s2, texto: '1.ª componente (2√λ₁)', forma: 'linea' },
      { color: C.s3, texto: '2.ª componente (2√λ₂)', forma: 'linea' },
      { color: C.apagado, texto: 'error de reconstrucción', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los ejes tienen la misma escala. Al proyectar, cada punto se reemplaza por su sombra sobre la primera componente: de dos números se pasa a uno.');

    let est = null;
    function datos() {
      const rnd = VIZ.semilla(semilla * 7), a = (angulo * Math.PI) / 180, s1 = 0.42, s2 = s1 * razon;
      pts = Array.from({ length: 120 }, () => {
        const u = VIZ.normal(rnd) * s1, v = VIZ.normal(rnd) * s2;
        return { x: 0.1 + u * Math.cos(a) - v * Math.sin(a), y: -0.05 + u * Math.sin(a) + v * Math.cos(a), c: 0 };
      });
      // Media, covarianza y sus valores y vectores propios (2 × 2, forma cerrada).
      const n = pts.length, mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
      let sxx = 0, syy = 0, sxy = 0;
      for (const p of pts) { sxx += (p.x - mx) ** 2 / n; syy += (p.y - my) ** 2 / n; sxy += ((p.x - mx) * (p.y - my)) / n; }
      const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
      const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
      let v1 = Math.abs(sxy) > 1e-12 ? [l1 - syy, sxy] : sxx >= syy ? [1, 0] : [0, 1];
      const nv = Math.hypot(...v1);
      v1 = [v1[0] / nv, v1[1] / nv];
      est = { mx, my, l1, l2, v1, v2: [-v1[1], v1[0]], cov: [sxx, sxy, syy] };
      dibujar();
    }
    function dibujar() {
      if (!est) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const p = planoIsometrico(lienzo);
      p.ejes();
      const { mx, my, l1, l2, v1, v2 } = est;
      const proy = (q) => { const t = (q.x - mx) * v1[0] + (q.y - my) * v1[1]; return { x: mx + t * v1[0], y: my + t * v1[1] }; };
      ctx.save();
      p.recortar();
      if (proyectar) {
        VIZ.trazar(ctx, p, [[mx - 3 * v1[0], my - 3 * v1[1]], [mx + 3 * v1[0], my + 3 * v1[1]]], C.eje, 1);
        ctx.strokeStyle = C.apagado;
        ctx.lineWidth = 1;
        for (const q of pts) { const r = proy(q); ctx.beginPath(); ctx.moveTo(p.sx(q.x), p.sy(q.y)); ctx.lineTo(p.sx(r.x), p.sy(r.y)); ctx.stroke(); }
      }
      for (const q of pts) VIZ.marcador(ctx, p.sx(q.x), p.sy(q.y), proyectar ? VIZ.alfa(C.s1, 0.35) : C.s1, 3.5);
      if (proyectar) for (const q of pts) { const r = proy(q); VIZ.marcador(ctx, p.sx(r.x), p.sy(r.y), C.s2, 2.5); }
      const flecha = (v, l, color) => {
        const L = 2 * Math.sqrt(l), x1 = p.sx(mx + L * v[0]), y1 = p.sy(my + L * v[1]), x0 = p.sx(mx), y0 = p.sy(my);
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        const a = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4)); ctx.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); ctx.fill();
      };
      flecha(v1, l1, C.s2);
      flecha(v2, l2, C.s3);
      ctx.restore();
      const ang = ((Math.atan2(v1[1], v1[0]) * 180) / Math.PI + 360) % 180;
      registro.textContent = `Matriz de covarianza Σ = [[${VIZ.fmt(est.cov[0], 3)}, ${VIZ.fmt(est.cov[1], 3)}], [${VIZ.fmt(est.cov[1], 3)}, ${VIZ.fmt(est.cov[2], 3)}]]. ` +
        `Sus vectores propios son las componentes principales; sus valores propios, la varianza en cada dirección.`;
      lectura.set([
        ['varianza en la 1.ª', VIZ.fmt(l1, 3)],
        ['varianza en la 2.ª', VIZ.fmt(l2, 3)],
        ['varianza explicada por la 1.ª', `${VIZ.fmt((100 * l1) / (l1 + l2), 3)} %`],
        ['error medio al proyectar', VIZ.fmt(l2, 3)],
        ['ángulo estimado', `${Math.round(ang)}°`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    datos();
  }

  /* ---------- Fig. 2: agrupamiento jerárquico aglomerativo ---------- */

  const ENLACES = [['single', 'Simple (mínima distancia)'], ['complete', 'Completo (máxima distancia)'], ['average', 'Promedio'], ['ward', 'Ward (mínimo aumento de varianza)']];

  function aglomerar(pts, enlace) {
    const n = pts.length;
    let grupos = pts.map((p, i) => ({ id: i, miembros: [i], cx: p.x, cy: p.y }));
    const d2 = (i, j) => (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
    const dist = (A, B) => {
      if (enlace === 'ward') return Math.sqrt(((2 * A.miembros.length * B.miembros.length) / (A.miembros.length + B.miembros.length)) * ((A.cx - B.cx) ** 2 + (A.cy - B.cy) ** 2));
      let r = enlace === 'single' ? Infinity : enlace === 'complete' ? 0 : 0;
      for (const i of A.miembros) for (const j of B.miembros) {
        const d = Math.sqrt(d2(i, j));
        r = enlace === 'single' ? Math.min(r, d) : enlace === 'complete' ? Math.max(r, d) : r + d;
      }
      return enlace === 'average' ? r / (A.miembros.length * B.miembros.length) : r;
    };
    const fusiones = [];
    let sig = n;
    while (grupos.length > 1) {
      let mejor = null;
      for (let a = 0; a < grupos.length; a++) for (let b = a + 1; b < grupos.length; b++) {
        const d = dist(grupos[a], grupos[b]);
        if (!mejor || d < mejor.d) mejor = { a, b, d };
      }
      const A = grupos[mejor.a], B = grupos[mejor.b], na = A.miembros.length, nb = B.miembros.length;
      const nuevo = { id: sig++, miembros: [...A.miembros, ...B.miembros], cx: (A.cx * na + B.cx * nb) / (na + nb), cy: (A.cy * na + B.cy * nb) / (na + nb), hijos: [A, B], h: mejor.d };
      fusiones.push(nuevo);
      grupos = grupos.filter((g, i) => i !== mejor.a && i !== mejor.b).concat(nuevo);
    }
    return { raiz: grupos[0], fusiones };
  }

  function montarJerarquico(cuerpo) {
    let enlace = 'average', k = 3, semilla = 2, pts = [], arbol = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Enlace (distancia entre grupos)', opciones: ENLACES, valor: enlace, alCambiar: (v) => { enlace = v; calcular(); } });
    ctl.rango({ etiqueta: 'Grupos (corte del dendrograma)', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, 'Datos sin etiquetas, coloreados por grupo');
    const l1 = VIZ.lienzo(a, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    VIZ.subtitulo(b, 'Dendrograma');
    const l2 = VIZ.lienzo(b, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'cada color y forma es un grupo', forma: 'punto' },
      { color: C.eje, texto: 'fusión por encima del corte', forma: 'linea' },
      { color: C.apagado, texto: 'altura del corte', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada unión horizontal del dendrograma es una fusión, a la altura de la distancia entre los grupos que une. Cortar a cierta altura deja k grupos. Pase el cursor sobre el dendrograma para ver la altura.');

    function datos() {
      const rnd = VIZ.semilla(semilla * 19);
      const centros = Array.from({ length: 4 }, () => [rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8]);
      pts = Array.from({ length: 30 }, (_, i) => { const c = centros[i % 4]; return { x: c[0] + VIZ.normal(rnd) * 0.14, y: c[1] + VIZ.normal(rnd) * 0.14, c: 0 }; });
      calcular();
    }
    function calcular() { arbol = aglomerar(pts, enlace); dibujar(); }
    let geo = null;
    function dibujar() {
      if (!arbol) return;
      const n = pts.length, kk = Math.min(k, n);
      // Grupos tras n − k fusiones: las raíces de los subárboles cuya fusión superior no se hizo.
      const hechas = new Set(arbol.fusiones.slice(0, n - kk));
      const raices = [];
      (function buscar(g) { if (g.hijos && !hechas.has(g)) g.hijos.forEach(buscar); else raices.push(g); })(arbol.raiz);
      // Orden de las hojas del dendrograma
      const orden = [];
      (function rec(g) { if (g.hijos) g.hijos.forEach(rec); else orden.push(g.id); })(arbol.raiz);
      raices.sort((A, B) => orden.indexOf(A.miembros[0]) - orden.indexOf(B.miembros[0]));
      const grupoDe = new Array(n);
      raices.forEach((g, gi) => g.miembros.forEach((i) => { grupoDe[i] = gi; }));
      const color = (gi) => VIZ.series[gi % 8];

      let ctx = l1.ctx;
      l1.limpiar();
      const p1 = planoIsometrico(l1);
      p1.ejes();
      pts.forEach((q, i) => VIZ.marcador(ctx, p1.sx(q.x), p1.sy(q.y), color(grupoDe[i]), 4.5, grupoDe[i]));

      ctx = l2.ctx;
      l2.limpiar();
      const hmax = arbol.raiz.h;
      const p2 = VIZ.plano(l2, { xmin: -0.5, xmax: n - 0.5, ymin: 0, ymax: hmax * 1.05 }, { etiquetaY: 'distancia de fusión', ticksX: [], margen: { izq: 46 } });
      p2.ejes();
      const pos = new Map();
      orden.forEach((id, j) => pos.set(id, { x: j, h: 0 }));
      const corte = kk > 1 ? (arbol.fusiones[n - kk].h + (n - kk - 1 >= 0 ? arbol.fusiones[n - kk - 1].h : 0)) / 2 : hmax * 1.02;
      const grupoDeNodo = new Map();
      raices.forEach((g, gi) => (function marcar(x) { grupoDeNodo.set(x, gi); if (x.hijos) x.hijos.forEach(marcar); })(g));
      for (const f of arbol.fusiones) {
        const [A, B] = f.hijos, pa = pos.get(A.id), pb = pos.get(B.id);
        const x = (pa.x + pb.x) / 2;
        pos.set(f.id, { x, h: f.h });
        const gi = grupoDeNodo.get(f);
        ctx.strokeStyle = gi != null && f.h <= corte ? color(gi) : C.eje;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p2.sx(pa.x), p2.sy(pa.h)); ctx.lineTo(p2.sx(pa.x), p2.sy(f.h)); ctx.lineTo(p2.sx(pb.x), p2.sy(f.h)); ctx.lineTo(p2.sx(pb.x), p2.sy(pb.h));
        ctx.stroke();
      }
      orden.forEach((id, j) => VIZ.marcador(ctx, p2.sx(j), p2.sy(0), color(grupoDe[id]), 3, grupoDe[id]));
      if (kk > 1) VIZ.trazar(ctx, p2, [[-0.5, corte], [n - 0.5, corte]], C.apagado, 1.5, [3, 4]);
      geo = { p2 };
      const tam = raices.map((g) => g.miembros.length).sort((x, y) => y - x);
      registro.textContent = {
        single: 'Enlace simple: une los grupos cuyos puntos más cercanos están más cerca. Tiende a formar cadenas largas.',
        complete: 'Enlace completo: usa la distancia entre los puntos más lejanos. Forma grupos compactos de diámetro parecido.',
        average: 'Enlace promedio: la distancia media entre todos los pares de puntos de los dos grupos. Un punto intermedio entre simple y completo.',
        ward: 'Ward: une el par que menos aumenta la suma de cuadrados dentro de los grupos, el mismo criterio que k-means.',
      }[enlace];
      lectura.set([
        ['grupos', String(kk)],
        ['altura del corte', kk > 1 ? VIZ.fmt(corte, 3) : '—'],
        ['tamaños', tam.join(', ')],
        ['fusiones', String(n - 1)],
      ]);
    }
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!geo || !geo.p2.dentro(x, y)) return tip.ocultar();
      const h = geo.p2.iy(y), grupos = 1 + arbol.fusiones.filter((f) => f.h > h).length;
      tip.mostrar(x, y, `cortar a altura <b>${VIZ.fmt(h, 3)}</b><br>deja <b>${grupos}</b> grupos`);
    });
    l2.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  VIZ.registrarTema('unsupervised-learning', {
    intro: String.raw`
      <p>En el <strong>aprendizaje no supervisado</strong> solo hay atributos \(X\), sin vector objetivo: nadie dice cuál es la
      respuesta correcta. El objetivo es descubrir <em>estructura</em> en los datos: grupos de ejemplos parecidos
      (<strong>agrupamiento</strong>), direcciones en que los datos varían más (<strong>reducción de dimensión</strong>), o la
      forma de su distribución (<strong>estimación de densidad</strong>).</p>
      <p>Como no hay etiquetas, no hay un error de validación evidente: evaluar un resultado no supervisado exige criterios
      propios (varianza explicada, compacidad de los grupos) o el juicio de un experto. A menudo sirve como paso previo de un
      problema supervisado: comprimir atributos, crear nuevos o detectar anomalías.</p>`,
    visualizaciones: [
      {
        titulo: 'Componentes principales',
        descripcion: 'PCA encuentra la dirección de máxima varianza. Haga la nube muy alargada y proyecte: casi no se pierde información. Hágala redonda (σ₂/σ₁ = 1): ninguna dirección es mejor que otra.',
        montar: montarPCA,
      },
      {
        titulo: 'Agrupamiento jerárquico',
        descripcion: 'Partiendo de un grupo por punto, se une repetidamente el par más cercano. El dendrograma guarda toda la historia y permite elegir el número de grupos después. Compare el enlace simple con Ward.',
        montar: montarJerarquico,
      },
    ],
    teoria: String.raw`
      <h2>Tareas no supervisadas</h2>
      <table>
        <thead><tr><th>Tarea</th><th>Pregunta</th><th>Métodos</th></tr></thead>
        <tbody>
          <tr><td>Agrupamiento</td><td>¿qué ejemplos se parecen?</td><td><a href="tema.html?id=kmeans">k-means</a>, jerárquico, DBSCAN, mezclas gaussianas</td></tr>
          <tr><td>Reducción de dimensión</td><td>¿cuántos números bastan para describir cada ejemplo?</td><td>PCA, t-SNE, UMAP, autocodificadores</td></tr>
          <tr><td>Densidad y anomalías</td><td>¿qué tan probable es este ejemplo?</td><td>histogramas, kernels, mezclas</td></tr>
        </tbody>
      </table>

      <h2>Análisis de componentes principales</h2>
      <p>Con los datos centrados (\(\bar x = 0\)), la varianza a lo largo de una dirección unitaria \(v\) es
      \(v^\top \Sigma v\), donde \(\Sigma = \frac{1}{n} X^\top X\) es la matriz de covarianza. Maximizarla con \(\lVert v \rVert = 1\)
      (multiplicadores de Lagrange) da</p>
      \[ \Sigma v = \lambda v, \]
      <p>así que las <strong>componentes principales</strong> son los vectores propios de \(\Sigma\) ordenados por valor propio
      \(\lambda_1 \ge \lambda_2 \ge \dots\), y \(\lambda_j\) es la varianza en la dirección \(j\). Proyectar sobre las primeras
      \(k\) componentes es la mejor aproximación lineal de rango \(k\): el error cuadrático medio de reconstrucción es
      \(\sum_{j &gt; k} \lambda_j\), lo mínimo posible. La <em>varianza explicada</em> \(\sum_{j \le k} \lambda_j / \sum_j \lambda_j\)
      ayuda a elegir \(k\). En la práctica se calcula con la descomposición en valores singulares de \(X\).</p>
      <p>PCA es una transformación (<code>fit</code> aprende \(\bar x\) y los vectores propios; <code>transform</code> proyecta),
      sensible a la escala de los atributos y limitada a estructura lineal.</p>

      <h2>Agrupamiento jerárquico aglomerativo</h2>
      <pre><code>cada punto es un grupo
mientras haya más de un grupo:
    unir los dos grupos A, B con menor d(A, B)
    registrar la fusión a altura d(A, B)</code></pre>
      <table>
        <thead><tr><th>Enlace</th><th>\(d(A, B)\)</th></tr></thead>
        <tbody>
          <tr><td>Simple</td><td>\(\min_{a \in A, b \in B} \lVert a - b \rVert\)</td></tr>
          <tr><td>Completo</td><td>\(\max_{a \in A, b \in B} \lVert a - b \rVert\)</td></tr>
          <tr><td>Promedio</td><td>\(\frac{1}{|A||B|} \sum_{a, b} \lVert a - b \rVert\)</td></tr>
          <tr><td>Ward</td><td>\(\sqrt{\frac{2|A||B|}{|A| + |B|}} \, \lVert \mu_A - \mu_B \rVert\)</td></tr>
        </tbody>
      </table>
      <p>El enlace simple equivale a construir un <a href="tema.html?id=kruskal">árbol de expansión mínima</a> con Kruskal y
      cortar sus aristas más largas. Con implementaciones ingenuas el costo es \(O(n^3)\); con colas de prioridad,
      \(O(n^2 \log n)\). A diferencia de k-means, no hay que fijar \(k\) de antemano ni depende de una inicialización aleatoria, pero
      una fusión no se deshace nunca.</p>`,
  });
})();
