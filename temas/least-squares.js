(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const DOM = { xmin: -1.6, xmax: 1.6, ymin: -1.1, ymax: 1.1 };

  // Mínimos cuadrados con pesos: minimiza Σ wᵢ (aᵢᵀθ − bᵢ)² resolviendo (AᵀWA)θ = AᵀWb.
  function mc(A, b, w) {
    const p = A[0].length, M = P.ceros(p, p), v = new Array(p).fill(0);
    A.forEach((f, i) => {
      const wi = w ? w[i] : 1;
      for (let j = 0; j < p; j++) { v[j] += wi * f[j] * b[i]; for (let k = 0; k < p; k++) M[j][k] += wi * f[j] * f[k]; }
    });
    return VIZ.ml.resolver(M, v);
  }

  function ajustar(pts, modelo, metodo) {
    if (modelo === 'circulo') {
      // x² + y² + D x + E y + F = 0  →  [x y 1]·[D E F]ᵀ = −(x² + y²)  (ajuste algebraico de Kåsa)
      const [D, E, F] = mc(pts.map((p) => [p.x, p.y, 1]), pts.map((p) => -(p.x * p.x + p.y * p.y)));
      const cx = -D / 2, cy = -E / 2, r = Math.sqrt(Math.max(0, cx * cx + cy * cy - F));
      return { tipo: 'circulo', cx, cy, r, texto: `centro (${VIZ.fmt(cx, 3)}, ${VIZ.fmt(cy, 3)}), r = ${VIZ.fmt(r, 3)}`,
        pie: (p) => { const d = Math.hypot(p.x - cx, p.y - cy) || 1; return [cx + ((p.x - cx) * r) / d, cy + ((p.y - cy) * r) / d]; } };
    }
    if (modelo === 'recta' && metodo === 'totales') {
      // Recta por el centroide en la dirección de mayor varianza: minimiza distancias perpendiculares.
      const mu = P.media(pts.map((p) => [p.x, p.y])), v = P.eigSim(P.cov(pts.map((p) => [p.x, p.y]), mu)).vectores[0];
      const b1 = v[1] / v[0], b0 = mu[1] - b1 * mu[0];
      return { tipo: 'funcion', f: (x) => b0 + b1 * x, theta: [b0, b1], texto: `y = ${VIZ.fmt(b0, 3)} + ${VIZ.fmt(b1, 3)}·x`,
        pie: (p) => { const t = (p.x - mu[0]) * v[0] + (p.y - mu[1]) * v[1]; return [mu[0] + t * v[0], mu[1] + t * v[1]]; } };
    }
    const grado = modelo === 'recta' ? 1 : 2;
    const fila = (x) => Array.from({ length: grado + 1 }, (_, k) => x ** k);
    const th = mc(pts.map((p) => fila(p.x)), pts.map((p) => p.y));
    const f = (x) => fila(x).reduce((s, v, k) => s + v * th[k], 0);
    return { tipo: 'funcion', f, theta: th, texto: `y = ${th.map((t, k) => `${VIZ.fmt(t, 3)}${k ? (k === 1 ? '·x' : '·x²') : ''}`).join(' + ')}`, pie: (p) => [p.x, f(p.x)] };
  }

  function generar(modelo, n, ruido, semilla) {
    const rnd = VIZ.semilla(semilla), pts = [];
    for (let i = 0; i < n; i++) {
      if (modelo === 'circulo') {
        const t = -0.4 + rnd() * 3.6, e = VIZ.normal(rnd) * ruido; // un arco de unos 200°
        pts.push({ x: 0.2 + (0.7 + e) * Math.cos(t), y: -0.1 + (0.7 + e) * Math.sin(t) });
      } else {
        const x = -1.4 + 2.8 * rnd(), y = modelo === 'recta' ? -0.1 + 0.45 * x : 0.6 - 0.7 * x * x + 0.2 * x;
        pts.push({ x: x + (modelo === 'recta' ? VIZ.normal(rnd) * ruido * 0.6 : 0), y: y + VIZ.normal(rnd) * ruido });
      }
    }
    return pts;
  }

  /* ---------- Fig. 1: ajustar rectas, parábolas y círculos ---------- */

  function montarAjuste(cuerpo) {
    let modelo = 'recta', metodo = 'ordinarios', n = 30, ruido = 0.15, semilla = 2, pts = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: [['recta', 'Recta y = a + b·x'], ['parabola', 'Parábola y = a + b·x + c·x²'], ['circulo', 'Círculo (ajuste algebraico)']], valor: modelo,
      alCambiar: (v) => { modelo = v; nuevos(); } });
    ctl.selector({ etiqueta: 'Residuo de la recta', opciones: [['ordinarios', 'Vertical (mínimos cuadrados ordinarios)'], ['totales', 'Perpendicular (mínimos cuadrados totales)']], valor: metodo,
      alCambiar: (v) => { metodo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.4, paso: 0.01, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; nuevos(); } });
    ctl.rango({ etiqueta: 'Puntos', min: 3, max: 120, valor: n, alCambiar: (v) => { n = v; nuevos(); } });
    ctl.boton('Nuevos datos', () => { semilla++; nuevos(); });
    ctl.boton('Borrar puntos', () => { pts = []; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'dato', forma: 'punto' },
      { color: C.s2, texto: 'modelo ajustado', forma: 'linea' },
      { color: C.s8, texto: 'residuo', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para agregar puntos. Con la recta casi vertical (agregue puntos en una columna), compare los dos tipos de residuo: el ordinario solo mide errores en y y se tuerce; el total trata x e y por igual.');

    function nuevos() { pts = generar(modelo, n, ruido, semilla); dibujar(); }
    let plano = null, aj = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x', etiquetaY: 'y', margen: { izq: 40 } });
      plano.ejes();
      const minimo = modelo === 'circulo' ? 3 : modelo === 'recta' ? 2 : 3;
      aj = pts.length >= minimo ? ajustar(pts, modelo, metodo) : null;
      if (aj) {
        ctx.save(); plano.recortar();
        for (const p of pts) { const q = aj.pie(p); VIZ.trazar(ctx, plano, [[p.x, p.y], q], VIZ.alfa(C.s8, 0.8), 1.5); }
        if (aj.tipo === 'circulo') {
          ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let i = 0; i <= 120; i++) { const t = (i / 120) * 2 * Math.PI, x = plano.sx(aj.cx + aj.r * Math.cos(t)), y = plano.sy(aj.cy + aj.r * Math.sin(t)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        } else {
          const xs = Array.from({ length: 161 }, (_, i) => DOM.xmin + ((DOM.xmax - DOM.xmin) * i) / 160);
          VIZ.trazar(ctx, plano, xs.map((x) => [x, aj.f(x)]), C.s2, 2.5);
        }
        ctx.restore();
      }
      for (const p of pts) VIZ.marcador(ctx, plano.sx(p.x), plano.sy(p.y), C.s1, 4.5);
      let sse = 0;
      if (aj) for (const p of pts) { const q = aj.pie(p); sse += (p.x - q[0]) ** 2 + (p.y - q[1]) ** 2; }
      lectura.set([
        ['puntos', String(pts.length)],
        ['modelo', aj ? aj.texto : `faltan puntos (mínimo ${minimo})`],
        ['suma de residuos²', aj ? VIZ.fmt(sse, 4) : '—'],
        ['RMS del residuo', aj && pts.length ? VIZ.fmt(Math.sqrt(sse / pts.length), 3) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      pts.push({ x: plano.ix(x), y: plano.iy(y) });
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = VIZ.ml.cercano(plano, pts, x, y);
      if (i < 0 || !aj) return tip.ocultar();
      const p = pts[i], q = aj.pie(p);
      tip.mostrar(x, y, `(${VIZ.fmt(p.x, 3)}, ${VIZ.fmt(p.y, 3)})<br>residuo <b>${VIZ.fmt(Math.hypot(p.x - q[0], p.y - q[1]), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevos();
  }

  /* ---------- Fig. 2: un valor atípico ---------- */

  function montarAtipico(cuerpo) {
    let ox = 1.2, oy = -0.9, perdida = 'huber', semilla = 5;
    const base = generar('recta', 25, 0.06, semilla);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'x del valor atípico', min: -1.5, max: 1.5, paso: 0.05, valor: ox, formato: (v) => v.toFixed(2), alCambiar: (v) => { ox = v; dibujar(); } });
    ctl.rango({ etiqueta: 'y del valor atípico', min: -1, max: 1, paso: 0.05, valor: oy, formato: (v) => v.toFixed(2), alCambiar: (v) => { oy = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ajuste robusto', opciones: [['huber', 'Huber (cuadrática cerca, lineal lejos)'], ['l1', 'Mínimas desviaciones absolutas (L1)'], ['tukey', 'Bicuadrada de Tukey (ignora lo lejano)']], valor: perdida,
      alCambiar: (v) => { perdida = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 420 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'dato (área ∝ peso en el ajuste robusto)', forma: 'punto' },
      { color: C.s8, texto: 'valor atípico', forma: 'punto' },
      { color: C.s2, texto: 'mínimos cuadrados', forma: 'linea' },
      { color: C.s3, texto: 'ajuste robusto (IRLS)', forma: 'linea' },
      { color: C.apagado, texto: 'recta verdadera', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Lleve el valor atípico a un extremo en x (alto apalancamiento): un solo punto gira toda la recta de mínimos cuadrados. Las pérdidas robustas le bajan el peso.');

    function irls(pts) {
      const A = pts.map((p) => [1, p.x]), b = pts.map((p) => p.y);
      let th = mc(A, b), w = pts.map(() => 1);
      for (let it = 0; it < 50; it++) {
        const r = pts.map((p) => p.y - th[0] - th[1] * p.x);
        const mad = [...r].map(Math.abs).sort((a, c) => a - c)[Math.floor(r.length / 2)] / 0.6745 || 1e-3;
        w = r.map((ri) => {
          const u = Math.abs(ri) / mad;
          if (perdida === 'l1') return 1 / Math.max(Math.abs(ri), 1e-4);
          if (perdida === 'tukey') { const c = 4.685; return u < c ? (1 - (u / c) ** 2) ** 2 : 0; }
          const c = 1.345; return u <= c ? 1 : c / u;
        });
        const nuevo = mc(A, b, w);
        if (Math.hypot(nuevo[0] - th[0], nuevo[1] - th[1]) < 1e-9) { th = nuevo; break; }
        th = nuevo;
      }
      const wm = Math.max(...w);
      return { th, w: w.map((v) => v / wm) };
    }
    function dibujar() {
      const pts = [...base, { x: ox, y: oy, atipico: true }];
      const th = mc(pts.map((p) => [1, p.x]), pts.map((p) => p.y)), rob = irls(pts);
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x', etiquetaY: 'y', margen: { izq: 40 } });
      plano.ejes();
      ctx.save(); plano.recortar();
      VIZ.trazar(ctx, plano, [[DOM.xmin, -0.1 + 0.45 * DOM.xmin], [DOM.xmax, -0.1 + 0.45 * DOM.xmax]], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, plano, [[DOM.xmin, th[0] + th[1] * DOM.xmin], [DOM.xmax, th[0] + th[1] * DOM.xmax]], C.s2, 2.5);
      VIZ.trazar(ctx, plano, [[DOM.xmin, rob.th[0] + rob.th[1] * DOM.xmin], [DOM.xmax, rob.th[0] + rob.th[1] * DOM.xmax]], C.s3, 2.5);
      ctx.restore();
      pts.forEach((p, i) => VIZ.marcador(ctx, plano.sx(p.x), plano.sy(p.y), p.atipico ? C.s8 : C.s1, p.atipico ? Math.max(4.5, 2 + 4 * Math.sqrt(rob.w[i])) : 2 + 4 * Math.sqrt(rob.w[i])));
      // Apalancamiento del atípico: h = elemento diagonal de A(AᵀA)⁻¹Aᵀ.
      const A = pts.map((p) => [1, p.x]), Mi = P.inv(P.mul(P.trasp(A), A)), a = A[A.length - 1];
      const h = P.punto(a, P.mulVec(Mi, a));
      lectura.set([
        ['pendiente real', '0.45'],
        ['pendiente mínimos cuadrados', VIZ.fmt(th[1], 3)],
        ['pendiente robusta', VIZ.fmt(rob.th[1], 3)],
        ['peso del atípico', VIZ.fmt(rob.w[rob.w.length - 1], 2)],
        ['apalancamiento del atípico', VIZ.fmt(h, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('least-squares', {
    intro: String.raw`
      <p>Estimar es encontrar los parámetros de un modelo que mejor explican mediciones con ruido: la recta que pasa por unos
      puntos, el círculo que forma el borde de una moneda segmentada, la calibración de una cámara. <strong>Mínimos cuadrados</strong>
      elige los parámetros que minimizan la suma de los cuadrados de los residuos.</p>
      <p>Si el modelo es <em>lineal en los parámetros</em> (aunque no lo sea en \(x\), como una parábola o un círculo escrito en forma
      algebraica), el óptimo tiene una fórmula cerrada: las ecuaciones normales o, en general, la pseudoinversa. Su punto débil son los
      valores atípicos, porque el cuadrado les da un peso enorme.</p>`,
    visualizaciones: [
      {
        titulo: 'Ajuste de rectas, parábolas y círculos',
        descripcion: 'Los segmentos rojos son los residuos que se minimizan. Agregue puntos con un clic y compare el residuo vertical con el perpendicular.',
        montar: montarAjuste,
      },
      {
        titulo: 'Un valor atípico',
        descripcion: 'Veinticinco puntos sobre una recta y uno fuera de lugar. Mínimos cuadrados frente a ajustes robustos por mínimos cuadrados reponderados.',
        montar: montarAtipico,
      },
    ],
    teoria: String.raw`
      <h2>Ecuaciones normales</h2>
      <p>Con \(n\) mediciones y un modelo \(b_i \approx a_i^\top \theta\) (filas \(a_i\) de la matriz \(A \in \mathbb{R}^{n \times p}\)), se busca</p>
      \[ \hat\theta = \arg\min_\theta \lVert A\theta - b \rVert^2. \]
      <p>Igualando el gradiente \(2A^\top(A\theta - b)\) a cero:</p>
      \[ A^\top A\,\hat\theta = A^\top b \quad\Longrightarrow\quad \hat\theta = (A^\top A)^{-1} A^\top b = A^{+} b. \]
      <p>Geométricamente, \(A\hat\theta\) es la proyección ortogonal de \(b\) sobre el espacio generado por las columnas de \(A\): el residuo
      \(b - A\hat\theta\) es perpendicular a todas ellas. Numéricamente es mejor usar QR o la SVD que formar \(A^\top A\), que eleva al
      cuadrado el número de condición.</p>
      <h2>Modelos lineales en los parámetros</h2>
      <table>
        <tr><th>Modelo</th><th>Fila \(a_i\)</th><th>\(b_i\)</th></tr>
        <tr><td>recta \(y = \theta_0 + \theta_1 x\)</td><td>\((1, x_i)\)</td><td>\(y_i\)</td></tr>
        <tr><td>parábola</td><td>\((1, x_i, x_i^2)\)</td><td>\(y_i\)</td></tr>
        <tr><td>círculo \(x^2 + y^2 + Dx + Ey + F = 0\)</td><td>\((x_i, y_i, 1)\)</td><td>\(-(x_i^2 + y_i^2)\)</td></tr>
        <tr><td>cónica, homografía, matriz de cámara</td><td>monomios de las coordenadas</td><td>0, con \(\lVert\theta\rVert = 1\)</td></tr>
      </table>
      <p>En el círculo el residuo minimizado es <em>algebraico</em> (\(x^2 + y^2 + Dx + Ey + F\)), no la distancia al borde. Con ruido
      bajo y un arco largo se parecen; con un arco corto, el ajuste algebraico subestima el radio, y conviene refinar con
      <a href="tema.html?id=nonlinear-estimation">estimación no lineal</a> minimizando la distancia geométrica. Los problemas homogéneos
      \(A\theta = 0\) se resuelven con el vector singular de menor valor singular de \(A\).</p>
      <h2>Mínimos cuadrados totales</h2>
      <p>Los mínimos cuadrados ordinarios suponen que solo \(y\) tiene error. Si ambas coordenadas lo tienen, se minimizan las distancias
      perpendiculares: la recta pasa por el centroide en la dirección del vector propio de mayor valor propio de la covarianza, igual
      que la primera <a href="tema.html?id=pca">componente principal</a>.</p>
      <h2>Robustez</h2>
      <p>Un residuo \(r\) aporta \(r^2\) a la pérdida: un punto a 10 desviaciones pesa como cien puntos a una. Las pérdidas robustas
      \(\rho(r)\) crecen más despacio (Huber: cuadrática hasta \(c\), lineal después; Tukey: constante lejos). Se minimizan con
      <strong>mínimos cuadrados reponderados</strong> (IRLS):</p>
      <pre><code>θ ← mínimos cuadrados ordinarios
repetir:
    rᵢ ← bᵢ − aᵢᵀθ;   s ← mediana(|r|) / 0,6745     (escala robusta)
    wᵢ ← ρ′(rᵢ/s) / (rᵢ/s)                       (peso de cada punto)
    θ ← argmin Σ wᵢ (aᵢᵀθ − bᵢ)²
hasta que θ no cambie</code></pre>
      <p>El <em>apalancamiento</em> \(h_i = a_i^\top (A^\top A)^{-1} a_i\) mide cuánto puede mover un punto al ajuste: los puntos alejados en
      \(x\) tienen \(h_i\) alto. Con muchos atípicos (más de la mitad), ni siquiera IRLS basta y se usa RANSAC: ajustar con
      subconjuntos mínimos al azar y quedarse con el que más puntos explica.</p>`,
  });
})();
