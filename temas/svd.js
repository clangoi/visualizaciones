(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // SVD de una matriz 2×2 a partir de los vectores propios de AᵀA.
  function svd2(A) {
    const AtA = [[A[0][0] ** 2 + A[1][0] ** 2, A[0][0] * A[0][1] + A[1][0] * A[1][1]], [0, A[0][1] ** 2 + A[1][1] ** 2]];
    AtA[1][0] = AtA[0][1];
    const { valores, vectores } = M.eigSim(AtA);
    const s = valores.map((v) => Math.sqrt(Math.max(0, v)));
    const V = [vectores[0], vectores[1]]; // columnas v₁, v₂
    const U = V.map((v, k) => {
      const u = [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
      const n = Math.hypot(...u);
      return n > 1e-9 ? [u[0] / n, u[1] / n] : k ? [-V[0][1], V[0][0]] : [1, 0];
    });
    if (s[1] < 1e-9) { const u0 = U[0]; U[1] = [-u0[1], u0[0]]; }
    return { U, s, V };
  }
  const mul = (P, Q) => [[P[0][0] * Q[0][0] + P[0][1] * Q[1][0], P[0][0] * Q[0][1] + P[0][1] * Q[1][1]], [P[1][0] * Q[0][0] + P[1][1] * Q[1][0], P[1][0] * Q[0][1] + P[1][1] * Q[1][1]]];
  const lerp = (P, Q, t) => P.map((f, i) => f.map((v, j) => v + (Q[i][j] - v) * t));
  const ap = (P, x) => [P[0][0] * x[0] + P[0][1] * x[1], P[1][0] * x[0] + P[1][1] * x[1]];

  /* ---------- Fig. 1: girar, estirar, girar ---------- */

  function montarGeometria(cuerpo) {
    let A = [[1.2, 0.8], [0.3, 1.0]], etapa = 3;
    const ctl = VIZ.controles(cuerpo);
    [['a₁₁', 0, 0], ['a₁₂', 0, 1], ['a₂₁', 1, 0], ['a₂₂', 1, 1]].forEach(([t, i, j]) =>
      ctl.rango({ etiqueta: t, min: -2, max: 2, paso: 0.05, valor: A[i][j], formato: (v) => v.toFixed(2), alCambiar: (v) => { A[i][j] = v; dibujar(); } }));
    const rE = ctl.rango({ etiqueta: 'Etapa', min: 0, max: 3, paso: 0.02, valor: etapa, formato: (v) => ['x', 'Vᵀx', 'ΣVᵀx', 'UΣVᵀx = Ax'][Math.round(v)], alCambiar: (v) => { etapa = v; dibujar(); } });
    let anim = null;
    ctl.boton('Animar', () => {
      if (anim) return;
      etapa = 0;
      anim = VIZ.bucle((dt) => { etapa = Math.min(3, etapa + dt / 900); rE.valor = etapa; dibujar(); return etapa < 3; }, () => { anim = null; });
      anim.iniciar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'v₁ → σ₁u₁', forma: 'linea' }, { color: C.s2, texto: 'v₂ → σ₂u₂', forma: 'linea' },
      { color: C.s7, texto: 'círculo unitario transformado', forma: 'linea' }, { color: C.tenue, texto: 'círculo original', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva «Etapa» de 0 a 3: primero una rotación (o reflexión) Vᵀ lleva v₁, v₂ a los ejes, luego Σ estira cada eje por σᵢ y por último U gira el resultado. Con a₁₁a₂₂ = a₁₂a₂₁ la matriz es singular: σ₂ = 0 y el círculo se aplasta en un segmento.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const { U, s, V } = svd2(A);
      const Vt = [[V[0][0], V[0][1]], [V[1][0], V[1][1]]], S = [[s[0], 0], [0, s[1]]], Um = [[U[0][0], U[1][0]], [U[0][1], U[1][1]]];
      const I = [[1, 0], [0, 1]], SVt = mul(S, Vt), USVt = mul(Um, SVt);
      const T = etapa <= 1 ? lerp(I, Vt, etapa) : etapa <= 2 ? lerp(Vt, SVt, etapa - 1) : lerp(SVt, USVt, etapa - 2);
      const asp = lienzo.ancho / lienzo.alto, R = Math.max(1.4, s[0] * 1.15);
      const plano = VIZ.plano(lienzo, { xmin: -R * asp, xmax: R * asp, ymin: -R, ymax: R }, { margen: { izq: 36 } });
      plano.ejes();
      const circ = (P, col, ancho) => { const pts = []; for (let k = 0; k <= 80; k++) { const a = (k / 80) * 2 * Math.PI; pts.push(ap(P, [Math.cos(a), Math.sin(a)])); } VIZ.trazar(ctx, plano, pts, col, ancho); };
      circ(I, C.tenue, 1.5);
      circ(T, C.s7, 2);
      // Una cuadrícula ligera transformada para ver el estiramiento.
      ctx.save(); plano.recortar();
      for (let k = -1; k <= 1; k += 0.5) {
        VIZ.trazar(ctx, plano, [ap(T, [k, -1]), ap(T, [k, 1])], VIZ.alfa(C.s7, 0.25), 1);
        VIZ.trazar(ctx, plano, [ap(T, [-1, k]), ap(T, [1, k])], VIZ.alfa(C.s7, 0.25), 1);
      }
      ctx.restore();
      [[V[0], C.s1], [V[1], C.s2]].forEach(([v, col]) => {
        const p = ap(T, v);
        VIZ.trazar(ctx, plano, [[0, 0], p], col, 3);
        VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), col, 4.5);
      });
      lectura.set([
        ['σ₁, σ₂', `${VIZ.fmt(s[0], 3)}, ${VIZ.fmt(s[1], 3)}`],
        ['|det A| = σ₁σ₂', VIZ.fmt(Math.abs(A[0][0] * A[1][1] - A[0][1] * A[1][0]), 3)],
        ['número de condición σ₁/σ₂', s[1] > 1e-9 ? VIZ.fmt(s[0] / s[1], 3) : '∞'],
        ['rango', String(s.filter((v) => v > 1e-9).length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    M.alSalir(cuerpo, () => anim && anim.detener());
    dibujar();
  }

  /* ---------- Fig. 2: aproximación de rango bajo ---------- */

  const N = 40;
  const BLANCO = VIZ.rgb(C.superficie), NEGRO = VIZ.rgb(C.tinta);
  function imagen() {
    const A = [];
    for (let i = 0; i < N; i++) {
      const f = [];
      for (let j = 0; j < N; j++) {
        let v = 0.15 + 0.25 * (j / N);
        if (i > 4 && i < 18 && j > 4 && j < 20) v = 0.9;                 // rectángulo
        if ((i - 26) ** 2 + (j - 28) ** 2 < 64) v = 0.75;               // círculo
        if (Math.abs(i - j + 6) < 2 && i > 20) v = 1;                    // diagonal
        if (i > 30 && j < 12) v = 0.55 + 0.4 * Math.sin(j * 0.9);        // franjas
        f.push(v);
      }
      A.push(f);
    }
    return A;
  }
  function svdCompleta(A) {
    const n = A[0].length, AtA = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => M.suma(A.map((f) => f[i] * f[j]))));
    const { valores, vectores } = M.eigSim(AtA);
    const s = valores.map((v) => Math.sqrt(Math.max(0, v)));
    const U = vectores.map((v, k) => A.map((f) => M.suma(f.map((x, j) => x * v[j])) / (s[k] || 1)));
    return { U, s, V: vectores };
  }

  function montarRangoBajo(cuerpo) {
    const A = imagen(), { U, s, V } = svdCompleta(A), total = M.suma(s.map((v) => v * v));
    let k = 3, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Rango k', min: 1, max: N, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? Math.round(w * 0.5) + 170 : Math.min(300, Math.round(w * 0.3)) + 30) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valores singulares usados (σ₁ … σ_k)' }, { color: C.inactivo, texto: 'descartados' }, { color: C.tinta, texto: 'intensidad del píxel', borde: C.rejilla }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una imagen de 40 × 40 es una matriz de rango hasta 40. Con k pequeño ya se reconocen las formas grandes; los detalles finos (la diagonal, las franjas) piden más términos. Pase el cursor sobre las barras.');
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const Ak = A.map((f, i) => f.map((_, j) => { let v = 0; for (let r = 0; r < k; r++) v += s[r] * U[r][i] * V[r][j]; return v; }));
      const angosto = W < 560, lado = angosto ? (W - 24) / 2 : Math.min(260, W * 0.3), c = lado / N;
      const pintar = (B, x0, y0, titulo) => {
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const g = Math.max(0, Math.min(1, B[i][j]));
          ctx.fillStyle = VIZ.css(BLANCO.map((b, t) => b + (NEGRO[t] - b) * g));
          ctx.fillRect(x0 + j * c, y0 + i * c, c + 0.5, c + 0.5);
        }
        ctx.strokeStyle = C.rejilla; ctx.strokeRect(x0 + 0.5, y0 + 0.5, lado, lado);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(titulo, x0, y0 + lado + 4);
      };
      pintar(A, 4, 4, 'original');
      pintar(Ak, angosto ? 20 + lado : 20 + lado, 4, `rango ${k}`);
      // Espectro.
      const bx = angosto ? 4 : 40 + 2 * lado, by = angosto ? lado + 40 : 4, bw = W - bx - 4, bh = angosto ? 120 : lado;
      const mx = s[0], paso = bw / N;
      geo = { bx, by, bw, bh, paso };
      s.forEach((v, r) => {
        const h = Math.max(1, (Math.sqrt(v / mx)) * (bh - 18));
        ctx.fillStyle = r < k ? C.s1 : C.inactivo;
        if (r === hover) ctx.fillStyle = C.s2;
        ctx.beginPath(); ctx.roundRect(bx + r * paso + 1, by + bh - 14 - h, Math.max(1, paso - 2), h, [2, 2, 0, 0]); ctx.fill();
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(bx, by + bh - 13.5); ctx.lineTo(bx + bw, by + bh - 13.5); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('√σᵢ (escala raíz) para i = 1 … 40', bx, by + bh - 10);
      const energia = M.suma(s.slice(0, k).map((v) => v * v)) / total;
      const err = Math.sqrt(M.suma(A.map((f, i) => M.suma(f.map((v, j) => (v - Ak[i][j]) ** 2)))));
      lectura.set([
        ['energía retenida Σσᵢ² (i ≤ k) / Σσᵢ²', M.pct(energia, 2)],
        ['error ‖A − A_k‖_F', VIZ.fmt(err, 3)],
        ['√(Σ σᵢ² para i > k)', VIZ.fmt(Math.sqrt(Math.max(0, M.suma(s.slice(k).map((v) => v * v)))), 3)],
        ['números guardados', `${VIZ.entero(k * (2 * N + 1))} de ${VIZ.entero(N * N)}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = geo && y > geo.by && y < geo.by + geo.bh ? Math.floor((x - geo.bx) / geo.paso) : -1;
      if (r < 0 || r >= N) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      hover = r; dibujar();
      tip.mostrar(x, y, `σ<sub>${r + 1}</sub> = <b>${VIZ.fmt(s[r], 4)}</b><br>energía acumulada <b>${M.pct(M.suma(s.slice(0, r + 1).map((v) => v * v)) / total, 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('svd', {
    intro: String.raw`
      <p>Toda matriz, sea cuadrada o no, se puede escribir como <strong>rotación · estiramiento · rotación</strong>. Esa es la
      <strong>descomposición en valores singulares</strong> (SVD): \(A = U \Sigma V^\top\). Los valores singulares
      \(\sigma_1 \ge \sigma_2 \ge \dots \ge 0\) dicen cuánto estira \(A\) en cada dirección.</p>
      <p>En minería de datos es la herramienta central para reducir dimensión: quedarse con los primeros \(k\) términos da la
      mejor aproximación de rango \(k\) de los datos, y es exactamente lo que calcula <a href="tema.html?id=pca">PCA</a>
      sobre la matriz centrada.</p>`,
    visualizaciones: [
      {
        titulo: 'Girar, estirar, girar',
        descripcion: 'El círculo unitario bajo una matriz 2 × 2, en las tres etapas de la SVD. Los vectores v₁, v₂ terminan en σ₁u₁ y σ₂u₂: los ejes de la elipse.',
        montar: montarGeometria,
      },
      {
        titulo: 'Aproximación de rango bajo',
        descripcion: 'Reconstruya una imagen con los k primeros términos σᵢuᵢvᵢᵀ y compare la energía retenida con el error.',
        montar: montarRangoBajo,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Para \(A \in \mathbb{R}^{m \times n}\) de rango \(r\) existen matrices ortogonales \(U \in \mathbb{R}^{m \times m}\),
      \(V \in \mathbb{R}^{n \times n}\) y una diagonal \(\Sigma\) con \(\sigma_1 \ge \dots \ge \sigma_r &gt; 0\) tales que</p>
      \[ A = U \Sigma V^\top = \sum_{i=1}^{r} \sigma_i\, u_i v_i^\top. \]
      <p>Los \(v_i\) son vectores propios de \(A^\top A\), los \(u_i\) de \(A A^\top\), y \(\sigma_i^2\) los valores propios comunes.
      Además \(A v_i = \sigma_i u_i\): la SVD dice adónde va cada dirección de entrada y cuánto se estira.</p>
      <h2>Mejor aproximación de rango k</h2>
      <div class="recuadro"><p><strong>Eckart–Young–Mirsky.</strong> Entre todas las matrices de rango a lo sumo \(k\), la truncada
      \(A_k = \sum_{i \le k} \sigma_i u_i v_i^\top\) minimiza el error, y</p>
      \[ \lVert A - A_k\rVert_F = \sqrt{\textstyle\sum_{i &gt; k} \sigma_i^2}, \qquad \lVert A - A_k\rVert_2 = \sigma_{k+1}. \]</div>
      <p>Guardar \(A_k\) cuesta \(k(m + n + 1)\) números en vez de \(mn\).</p>
      <h2>Relación con PCA</h2>
      <p>Si \(X\) (\(n \times d\)) está centrada, su covarianza es \(S = X^\top X/(n-1)\). Con \(X = U\Sigma V^\top\),</p>
      \[ S = V\, \frac{\Sigma^2}{n-1}\, V^\top, \]
      <p>así que las componentes principales son las columnas de \(V\), las varianzas son \(\lambda_i = \sigma_i^2/(n-1)\) y las
      coordenadas proyectadas son \(U\Sigma\). Calcular PCA por SVD de \(X\) es numéricamente más estable que formar \(S\).</p>
      <h2>Usos</h2>
      <ul>
        <li><strong>Análisis semántico latente</strong> (LSA): SVD truncada de la matriz documento-término.</li>
        <li><strong>Sistemas de recomendación</strong>: aproximar la matriz usuarios × productos con pocos factores.</li>
        <li><strong>Pseudoinversa</strong> \(A^+ = V \Sigma^+ U^\top\) para <a href="tema.html?id=least-squares">mínimos cuadrados</a>.</li>
        <li><strong>Número de condición</strong> \(\sigma_1/\sigma_r\): cuánto amplifica \(A^{-1}\) los errores.</li>
      </ul>
      <p>El costo de la SVD completa es \(O(mn \min(m, n))\); para \(k\) pequeño se usan métodos iterativos o aleatorizados.</p>`,
  });
})();