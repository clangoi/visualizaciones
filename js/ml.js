/* Aprendizaje automático: conjuntos de datos de juguete en [−1, 1]², dibujo de puntos por clase,
   regiones de decisión, curvas de nivel y utilidades de partición, compartidos por los temas de ML. */
(function () {
  'use strict';
  const { color: C } = VIZ;

  // Colores de clase en el orden fijo de las series; la forma del marcador es la segunda codificación.
  const CLASES = [C.s1, C.s2, C.s3, C.s4, C.s5];
  const DOMINIO = { xmin: -1.15, xmax: 1.15, ymin: -1.15, ymax: 1.15 };

  const DATOS = [
    ['manchas', 'Dos manchas'],
    ['lineal', 'Separable linealmente'],
    ['lunas', 'Dos lunas'],
    ['circulos', 'Círculos concéntricos'],
    ['xor', 'XOR (cuatro cuadrantes)'],
    ['tres', 'Tres clases'],
  ];

  /* Genera n puntos { x, y, c }. ruido ∈ [0, 1] escala la dispersión. */
  function datos(tipo, n, ruido, semilla) {
    const rnd = VIZ.semilla(semilla);
    const N = () => VIZ.normal(rnd);
    const pts = [];
    const dentro = (p) => Math.abs(p.x) <= 1.1 && Math.abs(p.y) <= 1.1;
    for (let i = 0; pts.length < n && i < n * 20; i++) {
      const c = i % (tipo === 'tres' ? 3 : 2);
      let p;
      if (tipo === 'manchas') {
        const s = 0.12 + 0.35 * ruido;
        p = { x: (c ? 0.4 : -0.4) + N() * s, y: (c ? -0.3 : 0.3) + N() * s };
      } else if (tipo === 'lineal') {
        const x = rnd() * 2 - 1, y = rnd() * 2 - 1, m = 0.45 * x - y + 0.1;
        if (Math.abs(m) < 0.12 * (1 - ruido)) continue;
        const k = m + N() * 0.25 * ruido > 0 ? 1 : 0;
        p = { x, y, c: k };
      } else if (tipo === 'lunas') {
        const t = rnd() * Math.PI, s = 0.04 + 0.2 * ruido;
        p = c ? { x: 0.5 - 0.9 * Math.cos(t) * 0.75 + N() * s, y: 0.25 - 0.9 * Math.sin(t) * 0.75 + 0.2 + N() * s }
          : { x: -0.5 + 0.9 * Math.cos(t) * 0.75 + N() * s, y: -0.2 + 0.9 * Math.sin(t) * 0.75 - 0.2 + N() * s };
        p.y -= c ? 0.25 : -0.05;
      } else if (tipo === 'circulos') {
        const t = rnd() * 2 * Math.PI, r = (c ? 0.35 : 0.85) + N() * (0.03 + 0.15 * ruido);
        p = { x: r * Math.cos(t), y: r * Math.sin(t) };
      } else if (tipo === 'xor') {
        const x = rnd() * 2 - 1, y = rnd() * 2 - 1;
        if (Math.abs(x) < 0.08 || Math.abs(y) < 0.08) continue;
        const k = (x > 0) !== (y > 0) ? 1 : 0;
        p = { x: x + N() * 0.15 * ruido, y: y + N() * 0.15 * ruido, c: k };
      } else {
        const a = (c * 2 * Math.PI) / 3 + 0.5, s = 0.13 + 0.3 * ruido;
        p = { x: 0.5 * Math.cos(a) + N() * s, y: 0.5 * Math.sin(a) + N() * s };
      }
      if (p.c == null) p.c = c;
      if (dentro(p)) pts.push(p);
    }
    return pts;
  }

  // Mezcla y separa en entrenamiento y validación.
  function partir(pts, fraccion, semilla) {
    const rnd = VIZ.semilla(semilla);
    const a = pts.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const k = Math.round(a.length * fraccion);
    return { entrenamiento: a.slice(0, k), validacion: a.slice(k) };
  }

  const plano = (lienzo, o = {}) => VIZ.plano(lienzo, o.dominio || DOMINIO, Object.assign({ etiquetaX: 'x₁', etiquetaY: 'x₂', margen: { izq: 40 } }, o));

  /* Regiones de decisión. f(x, y) → arreglo de probabilidades por clase (o un número p = P(clase 1)).
     La intensidad del color crece con la confianza. paso: tamaño de celda en píxeles. */
  function regiones(ctx, p, f, { paso = 6, intensidad = 0.34 } = {}) {
    ctx.save();
    for (let px = p.x0; px < p.x1; px += paso) {
      for (let py = p.y1; py < p.y0; py += paso) {
        let pr = f(p.ix(px + paso / 2), p.iy(py + paso / 2));
        if (typeof pr === 'number') pr = [1 - pr, pr];
        let k = 0;
        for (let j = 1; j < pr.length; j++) if (pr[j] > pr[k]) k = j;
        const K = pr.length, t = Math.max(0, (pr[k] - 1 / K) / (1 - 1 / K));
        ctx.fillStyle = VIZ.alfa(CLASES[k], 0.05 + intensidad * t);
        ctx.fillRect(px, py, Math.min(paso, p.x1 - px), Math.min(paso, p.y0 - py));
      }
    }
    ctx.restore();
  }

  /* Curva de nivel g = nivel por cuadrados marchantes sobre una rejilla de `paso` píxeles. */
  function contorno(ctx, p, g, nivel = 0, { color = C.tinta, ancho = 2, guiones = null, paso = 5 } = {}) {
    const nx = Math.ceil((p.x1 - p.x0) / paso) + 1, ny = Math.ceil((p.y0 - p.y1) / paso) + 1;
    const v = new Float64Array(nx * ny);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) v[i * ny + j] = g(p.ix(p.x0 + i * paso), p.iy(p.y1 + j * paso)) - nivel;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = ancho;
    if (guiones) ctx.setLineDash(guiones);
    ctx.beginPath();
    const X = (i) => p.x0 + i * paso, Y = (j) => p.y1 + j * paso;
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
      const a = v[i * ny + j], b = v[(i + 1) * ny + j], c = v[(i + 1) * ny + j + 1], d = v[i * ny + j + 1];
      const cruces = [];
      const borde = (va, vb, xa, ya, xb, yb) => {
        if ((va > 0) !== (vb > 0)) { const t = va / (va - vb); cruces.push([xa + (xb - xa) * t, ya + (yb - ya) * t]); }
      };
      borde(a, b, X(i), Y(j), X(i + 1), Y(j));
      borde(b, c, X(i + 1), Y(j), X(i + 1), Y(j + 1));
      borde(c, d, X(i + 1), Y(j + 1), X(i), Y(j + 1));
      borde(d, a, X(i), Y(j + 1), X(i), Y(j));
      for (let k = 0; k + 1 < cruces.length; k += 2) { ctx.moveTo(...cruces[k]); ctx.lineTo(...cruces[k + 1]); }
    }
    ctx.stroke();
    ctx.restore();
  }

  /* Puntos por clase. o: { r, anillo(pt) → color, hueco(pt) → bool (contorno sin relleno), opacidad(pt) } */
  function puntos(ctx, p, pts, o = {}) {
    for (const q of pts) {
      const x = p.sx(q.x), y = p.sy(q.y), r = o.r || 4.5;
      const anillo = o.anillo && o.anillo(q);
      if (anillo) {
        ctx.save();
        ctx.strokeStyle = anillo;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (o.hueco && o.hueco(q)) {
        ctx.save();
        ctx.strokeStyle = CLASES[q.c];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        VIZ.forma(ctx, x, y, r - 0.5, q.c);
        ctx.stroke();
        ctx.restore();
      } else VIZ.marcador(ctx, x, y, CLASES[q.c], r, q.c);
    }
  }

  function cercano(p, pts, x, y, radio = 10) {
    let mejor = -1, dm = radio;
    pts.forEach((q, i) => { const d = Math.hypot(p.sx(q.x) - x, p.sy(q.y) - y); if (d < dm) { dm = d; mejor = i; } });
    return mejor;
  }

  // Leyenda de clases con su forma.
  const FORMAS = ['punto', 'cuadro', 'triangulo'];
  const leyendaClases = (K, nombres) => Array.from({ length: K }, (_, k) => ({ color: CLASES[k], texto: nombres ? nombres[k] : `clase ${k}`, forma: k === 0 ? 'punto' : 'cuadro' }));

  const sigmoide = (z) => 1 / (1 + Math.exp(-z));
  const exactitud = (pts, pred) => (pts.length ? pts.filter((q) => pred(q.x, q.y) === q.c).length / pts.length : NaN);

  // Resuelve A x = b por eliminación gaussiana con pivoteo parcial (A se copia).
  function resolver(A, b) {
    const n = b.length, M = A.map((f, i) => [...f, b[i]]);
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      [M[k], M[p]] = [M[p], M[k]];
      const piv = M[k][k] || 1e-12;
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / piv;
        for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / (M[i][i] || 1e-12);
    }
    return x;
  }

  /* ---------- Máquina de vectores de soporte (SMO con selección del par de máxima violación) ----------
     pts: [{x, y, c}]; op: { etiqueta(q) → ±1, kernel: 'lineal'|'poli'|'rbf', C, Cpos (C de la clase +1), gamma, grado } */
  function kernelDe(op) {
    const g = op.gamma ?? 1, d = op.grado ?? 2;
    if (op.kernel === 'rbf') return (a, b) => Math.exp(-g * ((a.x - b.x) ** 2 + (a.y - b.y) ** 2));
    if (op.kernel === 'poli') return (a, b) => Math.pow(a.x * b.x + a.y * b.y + 1, d);
    return (a, b) => a.x * b.x + a.y * b.y;
  }
  function svm(pts, op = {}) {
    const n = pts.length, K = kernelDe(op);
    const y = pts.map((q) => (op.etiqueta ? op.etiqueta(q) : q.c === 1 ? 1 : -1));
    const Cv = y.map((v) => (v > 0 && op.Cpos != null ? op.Cpos : op.C ?? 1));
    const Km = pts.map((a) => pts.map((b) => K(a, b)));
    const al = new Float64Array(n), F = new Float64Array(n); // F_t = Σ α_s y_s K(s, t), sin sesgo
    const eps = 1e-3;
    for (let it = 0; it < 30000; it++) {
      let i = -1, j = -1, gmax = -Infinity, gmin = Infinity;
      for (let t = 0; t < n; t++) {
        const e = -(F[t] - y[t]);
        const bajo = al[t] < Cv[t] - 1e-9, alto = al[t] > 1e-9;
        if ((y[t] > 0 && bajo) || (y[t] < 0 && alto)) { if (e > gmax) { gmax = e; i = t; } }
        if ((y[t] > 0 && alto) || (y[t] < 0 && bajo)) { if (e < gmin) { gmin = e; j = t; } }
      }
      if (i < 0 || j < 0 || gmax - gmin < eps) break;
      const Ei = F[i] - y[i], Ej = F[j] - y[j];
      const eta = Math.max(1e-12, Km[i][i] + Km[j][j] - 2 * Km[i][j]);
      let L, H;
      if (y[i] !== y[j]) { const k = al[j] - al[i]; L = Math.max(0, k); H = Math.min(Cv[j], Cv[i] + k); }
      else { const s = al[i] + al[j]; L = Math.max(0, s - Cv[i]); H = Math.min(Cv[j], s); }
      let aj = al[j] + (y[j] * (Ei - Ej)) / eta;
      aj = Math.min(H, Math.max(L, aj));
      let ai = al[i] + y[i] * y[j] * (al[j] - aj);
      // Ajusta a las cotas para que el redondeo no deje un α «casi» en C.
      const ajustar = (v, c) => (v < 1e-10 ? 0 : v > c - 1e-10 ? c : v);
      aj = ajustar(aj, Cv[j]);
      ai = ajustar(ai, Cv[i]);
      const di = (ai - al[i]) * y[i], dj = (aj - al[j]) * y[j];
      if (Math.abs(di) + Math.abs(dj) < 1e-14) break;
      al[i] = ai; al[j] = aj;
      for (let t = 0; t < n; t++) F[t] += di * Km[i][t] + dj * Km[j][t];
    }
    // Sesgo: promedio sobre vectores de soporte libres (0 < α < C); si no hay, punto medio de las cotas.
    let sb = 0, nb = 0, lo = -Infinity, hi = Infinity;
    for (let t = 0; t < n; t++) {
      const r = y[t] - F[t];
      if (al[t] > 1e-8 && al[t] < Cv[t] - 1e-8) { sb += r; nb++; }
      else if ((y[t] > 0) === (al[t] < 1e-8)) lo = Math.max(lo, r); else hi = Math.min(hi, r);
    }
    const b = nb ? sb / nb : Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : Number.isFinite(lo) ? lo : Number.isFinite(hi) ? hi : 0;
    const sv = [];
    for (let t = 0; t < n; t++) if (al[t] > 1e-8) sv.push(t);
    const f = (px, py) => { const q = { x: px, y: py }; let s = b; for (const t of sv) s += al[t] * y[t] * K(pts[t], q); return s; };
    let w = null;
    if (!op.kernel || op.kernel === 'lineal') {
      w = [0, 0];
      for (const t of sv) { w[0] += al[t] * y[t] * pts[t].x; w[1] += al[t] * y[t] * pts[t].y; }
    }
    return { f, b, w, sv, alfa: al, y, acotados: sv.filter((t) => al[t] >= Cv[t] - 1e-8) };
  }

  VIZ.ml = { CLASES, DOMINIO, DATOS, FORMAS, datos, partir, plano, regiones, contorno, puntos, cercano, leyendaClases, sigmoide, exactitud, resolver, svm };
})();
