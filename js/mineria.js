/* Minería de datos: conjuntos de juguete (2D y de alta dimensión), estadística y álgebra lineal pequeña,
   agrupamiento (jerárquico, DBSCAN, k-means, mezclas gaussianas), t-SNE y UMAP simplificados,
   regresión logística, inferencia exacta en redes bayesianas y dibujo de dispersiones, elipses e histogramas. */
(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Estadística básica ---------- */

  const suma = (a) => a.reduce((s, v) => s + v, 0);
  const media = (a) => (a.length ? suma(a) / a.length : NaN);
  const varianza = (a) => { const m = media(a); return a.length > 1 ? suma(a.map((v) => (v - m) ** 2)) / (a.length - 1) : 0; };
  const desv = (a) => Math.sqrt(varianza(a));
  function cuantil(a, q) {
    const s = a.slice().sort((x, y) => x - y);
    if (!s.length) return NaN;
    const p = (s.length - 1) * q, i = Math.floor(p), f = p - i;
    return i + 1 < s.length ? s[i] + f * (s[i + 1] - s[i]) : s[i];
  }
  // Función de distribución normal estándar (Abramowitz–Stegun 7.1.26).
  function Phi(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? (1 + e) / 2 : (1 - e) / 2;
  }
  const normalPdf = (x, mu = 0, s = 1) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  function correlacion(a, b) {
    const ma = media(a), mb = media(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return sab / Math.sqrt(saa * sbb || 1e-12);
  }
  function barajar(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- Álgebra lineal pequeña ---------- */

  // Valores y vectores propios de una matriz simétrica (Jacobi). Devuelve { valores, vectores (columnas) } en orden decreciente.
  function eigSim(A) {
    const n = A.length, M = A.map((f) => f.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let barrido = 0; barrido < 60; barrido++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += M[i][j] ** 2;
      if (off < 1e-18) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(M[p][q]) < 1e-15) continue;
        const th = (M[q][q] - M[p][p]) / (2 * M[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const a = M[k][p], b = M[k][q];
          M[k][p] = c * a - s * b; M[k][q] = s * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const a = M[p][k], b = M[q][k];
          M[p][k] = c * a - s * b; M[q][k] = s * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const a = V[k][p], b = V[k][q];
          V[k][p] = c * a - s * b; V[k][q] = s * a + c * b;
        }
      }
    }
    const orden = M.map((f, i) => i).sort((i, j) => M[j][j] - M[i][i]);
    return { valores: orden.map((i) => M[i][i]), vectores: orden.map((i) => V.map((f) => f[i])) };
  }
  // Media por columna y covarianza muestral de X (n × d).
  function covarianza(X) {
    const n = X.length, d = X[0].length, mu = new Array(d).fill(0);
    for (const x of X) for (let j = 0; j < d; j++) mu[j] += x[j] / n;
    const S = Array.from({ length: d }, () => new Array(d).fill(0));
    for (const x of X) for (let i = 0; i < d; i++) for (let j = i; j < d; j++) S[i][j] += ((x[i] - mu[i]) * (x[j] - mu[j])) / Math.max(1, n - 1);
    for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) S[i][j] = S[j][i];
    return { mu, S };
  }
  // PCA: componentes (vectores fila), varianzas y proyección de X en las primeras k.
  function pca(X, k = 2) {
    const { mu, S } = covarianza(X);
    const { valores, vectores } = eigSim(S);
    const comp = vectores.slice(0, k);
    const Y = X.map((x) => comp.map((v) => v.reduce((s, vj, j) => s + vj * (x[j] - mu[j]), 0)));
    return { mu, componentes: vectores, varianzas: valores.map((v) => Math.max(0, v)), Y };
  }
  const det2 = (S) => S[0][0] * S[1][1] - S[0][1] * S[1][0];
  const inv2 = (S) => { const d = det2(S) || 1e-12; return [[S[1][1] / d, -S[0][1] / d], [-S[1][0] / d, S[0][0] / d]]; };
  function gauss2(x, y, mu, S) {
    const P = inv2(S), dx = x - mu[0], dy = y - mu[1];
    const q = dx * (P[0][0] * dx + P[0][1] * dy) + dy * (P[1][0] * dx + P[1][1] * dy);
    return Math.exp(-q / 2) / (2 * Math.PI * Math.sqrt(Math.max(1e-12, det2(S))));
  }
  const mahalanobis2 = (x, y, mu, S) => {
    const P = inv2(S), dx = x - mu[0], dy = y - mu[1];
    return Math.sqrt(Math.max(0, dx * (P[0][0] * dx + P[0][1] * dy) + dy * (P[1][0] * dx + P[1][1] * dy)));
  };

  /* ---------- Conjuntos de datos 2D en [−1, 1]² ---------- */

  const DATOS2D = [
    ['manchas', 'Tres manchas'],
    ['densidades', 'Densidades distintas'],
    ['alargadas', 'Manchas alargadas'],
    ['lunas', 'Dos lunas'],
    ['anillos', 'Anillos concéntricos'],
  ];
  /* Devuelve [{ x, y, g }] (g: grupo verdadero; −1 para ruido de fondo). ruido: fracción de puntos de fondo. */
  function datos2d(tipo, n, semilla, { ruido = 0, dispersion = 1 } = {}) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
    const pts = [], nf = Math.round(n * ruido), nc = n - nf;
    for (let i = 0; i < nc; i++) {
      let p;
      if (tipo === 'manchas') {
        const g = i % 3, c = [[-0.5, 0.45], [0.5, 0.4], [0, -0.5]][g], s = 0.13 * dispersion;
        p = { x: c[0] + N() * s, y: c[1] + N() * s, g };
      } else if (tipo === 'densidades') {
        const r = i / nc, g = r < 0.5 ? 0 : r < 0.8 ? 1 : 2;
        const c = [[-0.45, 0.35], [0.5, 0.45], [0.35, -0.5]][g], s = [0.07, 0.17, 0.28][g] * dispersion;
        p = { x: c[0] + N() * s, y: c[1] + N() * s, g };
      } else if (tipo === 'alargadas') {
        const g = i % 3, t = N() * 0.42, u = N() * 0.06 * dispersion;
        const [cx, cy, a] = [[-0.35, 0.45, 0.35], [0.4, 0.05, -0.9], [-0.3, -0.55, 0.15]][g];
        p = { x: cx + t * Math.cos(a) - u * Math.sin(a), y: cy + t * Math.sin(a) + u * Math.cos(a), g };
      } else if (tipo === 'lunas') {
        const g = i % 2, t = rnd() * Math.PI, s = 0.06 * dispersion;
        p = g ? { x: 0.35 - 0.62 * Math.cos(t) + N() * s, y: 0.1 - 0.55 * Math.sin(t) + N() * s, g }
          : { x: -0.35 + 0.62 * Math.cos(t) + N() * s, y: -0.15 + 0.55 * Math.sin(t) + N() * s, g };
      } else {
        const g = i % 2, t = rnd() * 2 * Math.PI, r = (g ? 0.32 : 0.82) + N() * 0.05 * dispersion;
        p = { x: r * Math.cos(t), y: r * Math.sin(t), g };
      }
      pts.push(p);
    }
    for (let i = 0; i < nf; i++) pts.push({ x: rnd() * 2.1 - 1.05, y: rnd() * 2.1 - 1.05, g: -1 });
    return pts.map((p) => ({ x: Math.max(-1.1, Math.min(1.1, p.x)), y: Math.max(-1.1, Math.min(1.1, p.y)), g: p.g }));
  }

  /* ---------- Conjuntos de alta dimensión (para reducción de dimensionalidad) ---------- */

  const DATOS_ALTOS = [
    ['cumulos', 'Seis cúmulos en 10-D (dos familias)'],
    ['rollo', 'Rollo suizo en 3-D'],
    ['anillos3d', 'Dos anillos enlazados en 3-D'],
  ];
  /* Devuelve { X: n × d, g: grupo (o null), t: posición continua ∈ [0,1] (o null), d }. */
  function datosAltos(tipo, n, semilla) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
    const X = [], g = [], t = [];
    if (tipo === 'cumulos') {
      // Dos familias de tres cúmulos: estructura local (cúmulos) y global (familias).
      const d = 10, centros = [];
      for (let f = 0; f < 2; f++) {
        const base = Array.from({ length: d }, () => N() * 3);
        for (let k = 0; k < 3; k++) centros.push(base.map((v) => v + N() * 1.1));
      }
      for (let i = 0; i < n; i++) { const k = i % 6; X.push(centros[k].map((v) => v + N() * 0.35)); g.push(k); t.push(null); }
      return { X, g, t: null, d };
    }
    if (tipo === 'rollo') {
      for (let i = 0; i < n; i++) {
        const u = rnd(), a = 1.5 * Math.PI * (1 + 2 * u), h = rnd() * 10;
        X.push([a * Math.cos(a) + N() * 0.25, h, a * Math.sin(a) + N() * 0.25]);
        t.push(u); g.push(null);
      }
      return { X, g: null, t, d: 3 };
    }
    for (let i = 0; i < n; i++) {
      const k = i % 2, a = rnd() * 2 * Math.PI, s = 0.06;
      X.push(k ? [Math.cos(a) + N() * s, Math.sin(a) + N() * s, N() * s] : [1 + Math.cos(a) + N() * s, N() * s, Math.sin(a) + N() * s]);
      g.push(k); t.push(a / (2 * Math.PI));
    }
    return { X, g, t: null, d: 3 };
  }

  const dist2 = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += (a[j] - b[j]) ** 2; return s; };
  const matrizDist = (X) => X.map((a) => X.map((b) => Math.sqrt(dist2(a, b))));
  // Escala columnas a media 0 y desviación 1.
  function estandarizar(X) {
    const d = X[0].length, mu = [], sd = [];
    for (let j = 0; j < d; j++) { const c = X.map((x) => x[j]); mu.push(media(c)); sd.push(desv(c) || 1); }
    return X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j]));
  }

  /* ---------- t-SNE exacto (n pequeño) ---------- */

  // Afinidades condicionales p_{j|i} con σᵢ elegido por bisección para que la perplejidad sea `perp`.
  function afinidades(D2, perp) {
    const n = D2.length, P = Array.from({ length: n }, () => new Float64Array(n)), sigmas = new Float64Array(n);
    const H = Math.log(perp);
    for (let i = 0; i < n; i++) {
      let beta = 1, lo = 0, hi = Infinity;
      for (let it = 0; it < 60; it++) {
        let s = 0, sd = 0;
        for (let j = 0; j < n; j++) if (j !== i) { const p = Math.exp(-D2[i][j] * beta); P[i][j] = p; s += p; sd += p * D2[i][j]; }
        s = s || 1e-300;
        const h = Math.log(s) + (beta * sd) / s;
        if (Math.abs(h - H) < 1e-5) break;
        if (h > H) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; }
        else { hi = beta; beta = (beta + lo) / 2; }
      }
      let s = 0;
      for (let j = 0; j < n; j++) s += P[i][j];
      for (let j = 0; j < n; j++) P[i][j] /= s || 1;
      sigmas[i] = Math.sqrt(1 / (2 * beta));
    }
    return { P, sigmas };
  }
  /* Crea un estado de t-SNE; paso() hace una iteración de descenso con momento y exageración temprana. */
  function tsne(X, { perplejidad = 20, semilla = 1, aprendizaje = 100 } = {}) {
    const n = X.length, D2 = X.map((a) => X.map((b) => dist2(a, b)));
    const { P: Pc, sigmas } = afinidades(D2, Math.min(perplejidad, (n - 1) / 3));
    const P = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P[i][j] = Math.max(1e-12, (Pc[i][j] + Pc[j][i]) / (2 * n));
    const rnd = VIZ.semilla(semilla);
    const Y = Array.from({ length: n }, () => [VIZ.normal(rnd) * 1e-2, VIZ.normal(rnd) * 1e-2]);
    const vel = Y.map(() => [0, 0]), gan = Y.map(() => [1, 1]);
    const est = { Y, iter: 0, kl: NaN, sigmas, P };
    est.paso = function () {
      const ex = est.iter < 100 ? 12 : 1, mom = est.iter < 100 ? 0.5 : 0.8;
      const Q = Array.from({ length: n }, () => new Float64Array(n));
      let Z = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const q = 1 / (1 + (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2);
        Q[i][j] = Q[j][i] = q; Z += 2 * q;
      }
      let kl = 0;
      for (let i = 0; i < n; i++) {
        let gx = 0, gy = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const q = Q[i][j], m = (ex * P[i][j] - q / Z) * q;
          gx += 4 * m * (Y[i][0] - Y[j][0]); gy += 4 * m * (Y[i][1] - Y[j][1]);
          if (j > i) kl += 2 * P[i][j] * Math.log(P[i][j] / Math.max(1e-12, q / Z));
        }
        const g = [gx, gy];
        for (let k = 0; k < 2; k++) {
          gan[i][k] = Math.sign(g[k]) !== Math.sign(vel[i][k]) ? gan[i][k] + 0.2 : Math.max(0.01, gan[i][k] * 0.8);
          vel[i][k] = mom * vel[i][k] - aprendizaje * gan[i][k] * g[k];
        }
      }
      let mx = 0, my = 0;
      for (let i = 0; i < n; i++) { Y[i][0] += vel[i][0]; Y[i][1] += vel[i][1]; mx += Y[i][0] / n; my += Y[i][1] / n; }
      for (let i = 0; i < n; i++) { Y[i][0] -= mx; Y[i][1] -= my; }
      est.kl = kl; est.iter++;
    };
    return est;
  }

  /* ---------- UMAP simplificado ---------- */

  // k vecinos de cada punto: [[{ j, d }]] ordenados por distancia.
  function knnGrafo(X, k) {
    return X.map((a, i) => X.map((b, j) => ({ j, d: Math.sqrt(dist2(a, b)) })).filter((v) => v.j !== i).sort((u, v) => u.d - v.d).slice(0, k));
  }
  /* Grafo difuso de UMAP: ρᵢ (distancia al vecino más cercano) y σᵢ tal que Σ exp(−(d − ρᵢ)/σᵢ) = log₂ k; luego unión difusa. */
  function grafoDifuso(X, k) {
    const vec = knnGrafo(X, k), n = X.length, objetivo = Math.log2(k);
    const W = new Map();
    const clave = (i, j) => (i < j ? i * n + j : j * n + i);
    const dir = [];
    vec.forEach((vs, i) => {
      const rho = vs[0].d;
      let lo = 0, hi = Infinity, s = 1;
      for (let it = 0; it < 64; it++) {
        const t = suma(vs.map((v) => Math.exp(-Math.max(0, v.d - rho) / s)));
        if (Math.abs(t - objetivo) < 1e-5) break;
        if (t > objetivo) { hi = s; s = (lo + hi) / 2; } else { lo = s; s = hi === Infinity ? s * 2 : (lo + hi) / 2; }
      }
      for (const v of vs) dir.push([i, v.j, Math.exp(-Math.max(0, v.d - rho) / s)]);
    });
    const m = new Map();
    for (const [i, j, w] of dir) m.set(i * n + j, w);
    for (const [i, j, w] of dir) {
      const r = m.get(j * n + i) || 0, c = clave(i, j);
      if (!W.has(c)) W.set(c, { i: Math.min(i, j), j: Math.max(i, j), w: w + r - w * r });
    }
    return { aristas: [...W.values()], vecinos: vec };
  }
  /* Inicio espectral: vectores propios 2.º y 3.º de D^{−1/2} W D^{−1/2} (iteración ortogonal sobre el grafo disperso). */
  function espectral(aristas, n, rnd) {
    const grado = new Float64Array(n).fill(1e-9);
    for (const e of aristas) { grado[e.i] += e.w; grado[e.j] += e.w; }
    const r = Array.from(grado, (g) => 1 / Math.sqrt(g));
    const mult = (v) => {
      const o = v.map((x) => x / 2); // (I + N)/2 tiene los mismos vectores propios y valores ≥ 0
      for (const e of aristas) { const w = (e.w * r[e.i] * r[e.j]) / 2; o[e.i] += w * v[e.j]; o[e.j] += w * v[e.i]; }
      return o;
    };
    let V = [Array.from(grado, Math.sqrt), Array.from({ length: n }, () => rnd() - 0.5), Array.from({ length: n }, () => rnd() - 0.5)];
    const ortonormalizar = (B) => {
      const R = [];
      for (const b of B) {
        const v = b.slice();
        for (const u of R) { const p = suma(v.map((x, i) => x * u[i])); for (let i = 0; i < n; i++) v[i] -= p * u[i]; }
        const nv = Math.hypot(...v) || 1;
        R.push(v.map((x) => x / nv));
      }
      return R;
    };
    V = ortonormalizar(V);
    for (let it = 0; it < 400; it++) V = ortonormalizar([V[0], mult(V[1]), mult(V[2])]);
    return Array.from({ length: n }, (_, i) => [V[1][i] * r[i], V[2][i] * r[i]]);
  }
  /* Estado de UMAP: inicio espectral y descenso estocástico con atracción en aristas y repulsión por muestreo negativo. */
  function umap(X, { vecinos = 15, distMin = 0.1, semilla = 1, epocas = 200 } = {}) {
    const n = X.length, { aristas, vecinos: vec } = grafoDifuso(X, Math.min(vecinos, n - 1));
    // Ajuste aproximado de a, b de la curva 1/(1 + a d^{2b}) para dist. mínima en [0, 1] y separación 1.
    const b = 0.79 + 0.21 * (1 - distMin), a = 1.93 - 1.45 * Math.sqrt(distMin);
    const rnd = VIZ.semilla(semilla);
    const ini = espectral(aristas, n, rnd), esc = Math.max(...ini.map((y) => Math.max(Math.abs(y[0]), Math.abs(y[1])))) || 1;
    const Y = ini.map((y) => [(10 * y[0]) / esc + VIZ.normal(rnd) * 0.01, (10 * y[1]) / esc + VIZ.normal(rnd) * 0.01]);
    const wmax = Math.max(...aristas.map((e) => e.w));
    const est = { Y, epoca: 0, epocas, aristas, vecinos: vec, a, b };
    const rec = (v) => Math.max(-4, Math.min(4, v));
    est.paso = function () {
      const alfa = 1 - est.epoca / epocas;
      for (const e of aristas) {
        if (rnd() > e.w / wmax) continue;
        const yi = Y[e.i], yj = Y[e.j];
        let dx = yi[0] - yj[0], dy = yi[1] - yj[1], d2 = dx * dx + dy * dy;
        if (d2 > 0) {
          const g = (-2 * a * b * Math.pow(d2, b - 1)) / (1 + a * Math.pow(d2, b));
          yi[0] += alfa * rec(g * dx); yi[1] += alfa * rec(g * dy);
          yj[0] -= alfa * rec(g * dx); yj[1] -= alfa * rec(g * dy);
        }
        for (let s = 0; s < 5; s++) {
          const k = Math.floor(rnd() * n);
          if (k === e.i) continue;
          dx = yi[0] - Y[k][0]; dy = yi[1] - Y[k][1]; d2 = dx * dx + dy * dy;
          const g = (2 * b) / ((0.001 + d2) * (1 + a * Math.pow(d2, b)));
          yi[0] += alfa * rec(g * dx); yi[1] += alfa * rec(g * dy);
        }
      }
      est.epoca++;
    };
    return est;
  }

  // Fracción de los k vecinos en el espacio original que siguen siendo vecinos en la proyección.
  function preservacionVecinos(X, Y, k) {
    const a = knnGrafo(X, k), b = knnGrafo(Y, k);
    let s = 0;
    for (let i = 0; i < X.length; i++) { const B = new Set(b[i].map((v) => v.j)); s += a[i].filter((v) => B.has(v.j)).length / k; }
    return s / X.length;
  }

  /* ---------- Agrupamiento ---------- */

  const xy = (p) => [p.x, p.y];
  /* Aglomerativo con la fórmula de Lance–Williams. enlace: 'simple' | 'completo' | 'promedio' | 'ward'.
     Devuelve las fusiones [{ a, b, h, nuevo, tam }] (ids ≥ n son grupos creados en orden). */
  function aglomerativo(X, enlace = 'simple') {
    const n = X.length, D = matrizDist(X).map((f) => f.map((v) => (enlace === 'ward' ? v * v : v)));
    const activo = new Array(n).fill(true), id = X.map((_, i) => i), tam = new Array(n).fill(1), fusiones = [];
    for (let paso = 0; paso < n - 1; paso++) {
      let bi = -1, bj = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (activo[i]) for (let j = i + 1; j < n; j++) if (activo[j] && D[i][j] < bd) { bd = D[i][j]; bi = i; bj = j; }
      const ni = tam[bi], nj = tam[bj];
      for (let k = 0; k < n; k++) {
        if (!activo[k] || k === bi || k === bj) continue;
        const dik = D[bi][k], djk = D[bj][k], nk = tam[k];
        let v;
        if (enlace === 'simple') v = Math.min(dik, djk);
        else if (enlace === 'completo') v = Math.max(dik, djk);
        else if (enlace === 'promedio') v = (ni * dik + nj * djk) / (ni + nj);
        else v = ((ni + nk) * dik + (nj + nk) * djk - nk * bd) / (ni + nj + nk);
        D[bi][k] = D[k][bi] = v;
      }
      fusiones.push({ a: id[bi], b: id[bj], h: enlace === 'ward' ? Math.sqrt(bd) : bd, nuevo: n + paso, tam: ni + nj });
      activo[bj] = false; tam[bi] = ni + nj; id[bi] = n + paso;
    }
    return fusiones;
  }
  // Etiquetas al cortar el dendrograma con k grupos (o a la altura h si k es null).
  function cortar(fusiones, n, { k = null, h = null } = {}) {
    const padre = Array.from({ length: 2 * n }, (_, i) => i), raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
    const lim = k != null ? n - k : fusiones.filter((f) => f.h <= h).length;
    for (let i = 0; i < lim; i++) { const f = fusiones[i]; padre[raiz(f.a)] = f.nuevo; padre[raiz(f.b)] = f.nuevo; }
    const mapa = new Map();
    return Array.from({ length: n }, (_, i) => { const r = raiz(i); if (!mapa.has(r)) mapa.set(r, mapa.size); return mapa.get(r); });
  }
  /* Orden de las hojas y coordenadas del dendrograma: { orden, nodos: Map(id → { x, h }) }. */
  function dendrograma(fusiones, n) {
    const hijos = new Map(fusiones.map((f) => [f.nuevo, [f.a, f.b]]));
    const orden = [];
    const visitar = (v) => { if (v < n) orden.push(v); else hijos.get(v).forEach(visitar); };
    visitar(n + fusiones.length - 1);
    const nodos = new Map();
    orden.forEach((v, i) => nodos.set(v, { x: i, h: 0 }));
    for (const f of fusiones) nodos.set(f.nuevo, { x: (nodos.get(f.a).x + nodos.get(f.b).x) / 2, h: f.h });
    return { orden, nodos };
  }

  /* DBSCAN. Devuelve { etiqueta: grupo o −1, tipo: 'nucleo' | 'borde' | 'ruido', vecinos } */
  function dbscan(pts, eps, minPts) {
    const n = pts.length;
    const vecinos = pts.map((p) => { const v = []; pts.forEach((q, j) => { if (Math.hypot(p.x - q.x, p.y - q.y) <= eps) v.push(j); }); return v; });
    const nucleo = vecinos.map((v) => v.length >= minPts);
    const etiqueta = new Array(n).fill(-1);
    let g = 0;
    for (let i = 0; i < n; i++) {
      if (!nucleo[i] || etiqueta[i] >= 0) continue;
      const cola = [i]; etiqueta[i] = g;
      for (let h = 0; h < cola.length; h++) {
        const u = cola[h];
        if (!nucleo[u]) continue;
        for (const v of vecinos[u]) if (etiqueta[v] < 0) { etiqueta[v] = g; cola.push(v); }
      }
      g++;
    }
    const tipo = etiqueta.map((e, i) => (nucleo[i] ? 'nucleo' : e >= 0 ? 'borde' : 'ruido'));
    return { etiqueta, tipo, vecinos, grupos: g };
  }

  // k-means (Lloyd) con inicio k-means++.
  function kmedias(pts, k, semilla = 1, iter = 50) {
    const rnd = VIZ.semilla(semilla), c = [pts[Math.floor(rnd() * pts.length)]];
    while (c.length < k) {
      const d = pts.map((p) => Math.min(...c.map((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2)));
      let r = rnd() * suma(d), i = 0;
      while (i < d.length - 1 && (r -= d[i]) > 0) i++;
      c.push(pts[i]);
    }
    let cent = c.map((p) => ({ x: p.x, y: p.y })), et = [];
    for (let it = 0; it < iter; it++) {
      et = pts.map((p) => { let m = 0; cent.forEach((q, j) => { if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < (p.x - cent[m].x) ** 2 + (p.y - cent[m].y) ** 2) m = j; }); return m; });
      cent = cent.map((q, j) => { const g = pts.filter((_, i) => et[i] === j); return g.length ? { x: media(g.map((p) => p.x)), y: media(g.map((p) => p.y)) } : q; });
    }
    return { etiqueta: et, centros: cent };
  }

  /* Mezcla gaussiana 2D con EM. tipo de covarianza: 'completa' | 'diagonal' | 'esferica'.
     Devuelve un estado con paso() (una iteración E + M), comps [{ pi, mu, S }], resp (n × k) y logv. */
  function gmm(pts, k, { semilla = 1, tipo = 'completa' } = {}) {
    const n = pts.length, ini = kmedias(pts, k, semilla, 3).centros;
    const est = { comps: ini.map((c) => ({ pi: 1 / k, mu: [c.x, c.y], S: [[0.08, 0], [0, 0.08]] })), resp: [], logv: NaN, iter: 0 };
    est.e = function () {
      let lv = 0;
      est.resp = pts.map((p) => {
        const r = est.comps.map((c) => c.pi * gauss2(p.x, p.y, c.mu, c.S)), s = suma(r) || 1e-300;
        lv += Math.log(s);
        return r.map((v) => v / s);
      });
      est.logv = lv;
    };
    est.m = function () {
      est.comps = est.comps.map((_, j) => {
        const r = est.resp.map((f) => f[j]), Nk = suma(r) || 1e-9;
        const mu = [suma(pts.map((p, i) => r[i] * p.x)) / Nk, suma(pts.map((p, i) => r[i] * p.y)) / Nk];
        let sxx = 0, syy = 0, sxy = 0;
        pts.forEach((p, i) => { const dx = p.x - mu[0], dy = p.y - mu[1]; sxx += r[i] * dx * dx; syy += r[i] * dy * dy; sxy += r[i] * dx * dy; });
        sxx /= Nk; syy /= Nk; sxy /= Nk;
        let S;
        if (tipo === 'esferica') { const v = (sxx + syy) / 2 + 1e-4; S = [[v, 0], [0, v]]; }
        else if (tipo === 'diagonal') S = [[sxx + 1e-4, 0], [0, syy + 1e-4]];
        else S = [[sxx + 1e-4, sxy], [sxy, syy + 1e-4]];
        return { pi: Nk / n, mu, S };
      });
      est.iter++;
    };
    est.paso = () => { est.e(); est.m(); est.e(); };
    est.parametros = () => k * (tipo === 'completa' ? 6 : tipo === 'diagonal' ? 5 : 4) - 1;
    est.e();
    return est;
  }

  // Coeficiente de silueta medio para etiquetas (se ignoran las −1).
  function silueta(pts, et) {
    const idx = pts.map((_, i) => i).filter((i) => et[i] >= 0), grupos = [...new Set(idx.map((i) => et[i]))];
    if (grupos.length < 2) return NaN;
    const d = (i, j) => Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    let s = 0;
    for (const i of idx) {
      const prom = (g) => { const m = idx.filter((j) => et[j] === g && j !== i); return m.length ? suma(m.map((j) => d(i, j))) / m.length : 0; };
      const a = prom(et[i]), b = Math.min(...grupos.filter((g) => g !== et[i]).map(prom));
      s += idx.filter((j) => et[j] === et[i]).length > 1 ? (b - a) / Math.max(a, b) : 0;
    }
    return s / idx.length;
  }
  // Índice de Rand ajustado entre dos particiones.
  function randAjustado(a, b) {
    const n = a.length, tabla = new Map(), fa = new Map(), fb = new Map();
    for (let i = 0; i < n; i++) {
      const k = a[i] + ',' + b[i];
      tabla.set(k, (tabla.get(k) || 0) + 1); fa.set(a[i], (fa.get(a[i]) || 0) + 1); fb.set(b[i], (fb.get(b[i]) || 0) + 1);
    }
    const c2 = (x) => (x * (x - 1)) / 2;
    const sij = suma([...tabla.values()].map(c2)), sa = suma([...fa.values()].map(c2)), sb = suma([...fb.values()].map(c2));
    const esp = (sa * sb) / c2(n), mx = (sa + sb) / 2;
    return mx === esp ? 1 : (sij - esp) / (mx - esp);
  }

  /* ---------- Regresión logística (Newton–Raphson) ---------- */

  // X: n × d (sin columna de unos), y ∈ {0,1}. Devuelve { w (con sesgo en w[0]), p(x) }.
  function logistica(X, y, { lambda = 1e-4, iter = 25 } = {}) {
    const d = X[0].length + 1, Z = X.map((x) => [1, ...x]);
    let w = new Array(d).fill(0);
    for (let it = 0; it < iter; it++) {
      const g = new Array(d).fill(0), H = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (__, j) => (i === j ? lambda : 0)));
      Z.forEach((z, i) => {
        const p = 1 / (1 + Math.exp(-z.reduce((s, v, j) => s + v * w[j], 0))), r = p * (1 - p);
        for (let a = 0; a < d; a++) { g[a] += (p - y[i]) * z[a]; for (let b = 0; b < d; b++) H[a][b] += r * z[a] * z[b]; }
      });
      for (let a = 0; a < d; a++) g[a] += lambda * w[a];
      const paso = VIZ.ml.resolver(H, g);
      w = w.map((v, j) => v - paso[j]);
      if (Math.hypot(...paso) < 1e-8) break;
    }
    return { w, p: (x) => 1 / (1 + Math.exp(-(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0)))) };
  }

  /* ---------- Redes bayesianas binarias ---------- */

  /* red: { nodos: [{ id, padres: [índices], cpt: { 'claveDePadres': P(nodo = 1) } }] } con claves '' o '1,0,…'.
     Inferencia exacta por enumeración: P(consulta = 1 | evidencia) para cada nodo. evidencia: { índice: 0|1 } */
  function probConjunta(red, x) {
    let p = 1;
    red.nodos.forEach((nd, i) => {
      const q = nd.cpt[nd.padres.map((j) => x[j]).join(',')];
      p *= x[i] ? q : 1 - q;
    });
    return p;
  }
  function posteriores(red, evidencia = {}) {
    const n = red.nodos.length, marg = new Array(n).fill(0);
    let Z = 0;
    for (let m = 0; m < 1 << n; m++) {
      const x = Array.from({ length: n }, (_, i) => (m >> i) & 1);
      if (Object.entries(evidencia).some(([i, v]) => x[i] !== v)) continue;
      const p = probConjunta(red, x);
      Z += p;
      for (let i = 0; i < n; i++) if (x[i]) marg[i] += p;
    }
    return { marg: marg.map((v) => v / (Z || 1)), evidencia: Z };
  }

  /* Red de la alarma (Pearl; valores de Russell y Norvig): Robo y Terremoto → Alarma → Juan llama, María llama. */
  const RED_ALARMA = {
    nodos: [
      { id: 'B', nombre: 'Robo', padres: [], cpt: { '': 0.001 } },
      { id: 'E', nombre: 'Terremoto', padres: [], cpt: { '': 0.002 } },
      { id: 'A', nombre: 'Alarma', padres: [0, 1], cpt: { '1,1': 0.95, '1,0': 0.94, '0,1': 0.29, '0,0': 0.001 } },
      { id: 'J', nombre: 'Juan llama', padres: [2], cpt: { 1: 0.9, 0: 0.05 } },
      { id: 'M', nombre: 'María llama', padres: [2], cpt: { 1: 0.7, 0: 0.01 } },
    ],
    pos: [[0.22, 0.12], [0.78, 0.12], [0.5, 0.48], [0.22, 0.84], [0.78, 0.84]],
  };

  /* ---------- Grafos causales ---------- */

  /* Modelo causal lineal gaussiano sobre un DAG (nodos en orden topológico):
     xᵥ = Σ coef[u→v]·xᵤ + ruido[v]·ε. coef: { 'u,v': β }; hacer: { v: valor } aplica do(xᵥ = valor). */
  function simularSCM(g, coef, n, semilla, { hacer = {}, ruido = null } = {}) {
    const rnd = VIZ.semilla(semilla), k = g.nodos.length;
    const padres = g.nodos.map((_, v) => g.aristas.filter((a) => a.v === v).map((a) => a.u));
    return Array.from({ length: n }, () => {
      const x = new Array(k);
      for (let v = 0; v < k; v++) {
        if (hacer[v] != null) { x[v] = hacer[v]; continue; }
        x[v] = padres[v].reduce((s, u) => s + (coef[`${u},${v}`] ?? 0) * x[u], 0) + (ruido ? ruido[v] : 1) * VIZ.normal(rnd);
      }
      return x;
    });
  }
  // Mínimos cuadrados de la columna y sobre las columnas cols (con intercepto). Devuelve los coeficientes [b0, b1, …].
  function regresion(D, y, cols) {
    const X = D.map((f) => [1, ...cols.map((c) => f[c])]), p = cols.length + 1;
    const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (__, j) => suma(X.map((f) => f[i] * f[j]))));
    const b = Array.from({ length: p }, (_, i) => suma(X.map((f, r) => f[i] * D[r][y])));
    return VIZ.ml.resolver(A, b);
  }
  function correlacionParcial(D, i, j, Z) {
    const res = (c) => { const b = regresion(D, c, Z); return D.map((f) => f[c] - b[0] - Z.reduce((s, z, q) => s + b[q + 1] * f[z], 0)); };
    return correlacion(res(i), res(j));
  }
  const descendientes = (g, v) => { const d = new Set(), pila = [v]; while (pila.length) { const u = pila.pop(); for (const a of g.aristas) if (a.u === u && !d.has(a.v)) { d.add(a.v); pila.push(a.v); } } return d; };
  // Todos los caminos simples entre x e y en el esqueleto no dirigido: listas de nodos.
  function caminos(g, x, y) {
    const res = [], vec = g.nodos.map((_, v) => g.aristas.filter((a) => a.u === v || a.v === v).map((a) => (a.u === v ? a.v : a.u)));
    (function ir(v, cam) { if (v === y) { res.push(cam); return; } for (const w of vec[v]) if (!cam.includes(w)) ir(w, [...cam, w]); })(x, [x]);
    return res;
  }
  const flecha = (g, u, v) => g.aristas.some((a) => a.u === u && a.v === v);
  /* ¿El camino está bloqueado por Z? Devuelve { bloqueado, en, colisionador } con el primer nodo que lo bloquea. */
  function bloqueo(g, cam, Z) {
    const zs = new Set(Z);
    for (let k = 1; k < cam.length - 1; k++) {
      const a = cam[k - 1], m = cam[k], b = cam[k + 1], col = flecha(g, a, m) && flecha(g, b, m);
      if (col) { if (!zs.has(m) && ![...descendientes(g, m)].some((d) => zs.has(d))) return { bloqueado: true, en: m, colisionador: true }; }
      else if (zs.has(m)) return { bloqueado: true, en: m, colisionador: false };
    }
    return { bloqueado: false, en: -1 };
  }
  const dsep = (g, x, y, Z) => caminos(g, x, y).every((c) => bloqueo(g, c, Z).bloqueado);

  /* ---------- Estudios observacionales (resultados potenciales) ---------- */

  /* n unidades con covariables x1 (edad) y x2 (gravedad), probabilidad de tratamiento e(x) que crece con la gravedad
     (conf = fuerza de la confusión) y resultados potenciales y0, y1 con efecto τ(x) = 2 + het·0,8·x2.
     Devuelve [{ x1, x2, e, t, y0, y1, y, tau }]. */
  function estudio(n, semilla, { conf = 1, het = 1 } = {}) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
    return Array.from({ length: n }, () => {
      const x1 = N(), x2 = N();
      const e = 1 / (1 + Math.exp(-conf * (0.6 * x1 + 0.9 * x2 + 0.4 * x2 * x2 - 0.4)));
      const t = rnd() < e ? 1 : 0, y0 = 1 + x1 + 1.5 * x2 + 0.8 * x2 * x2 + N(), tau = 2 + het * 0.8 * x2, y1 = y0 + tau;
      return { x1, x2, e, t, y0, y1, y: t ? y1 : y0, tau };
    });
  }
  const efectosVerdaderos = (D) => ({
    ate: media(D.map((d) => d.tau)), att: media(D.filter((d) => d.t).map((d) => d.tau)), atc: media(D.filter((d) => !d.t).map((d) => d.tau)),
    ingenuo: media(D.filter((d) => d.t).map((d) => d.y)) - media(D.filter((d) => !d.t).map((d) => d.y)),
  });
  /* Empareja cada tratado con sus k controles más cercanos según dist(a, b). caliper: distancia máxima (Infinity = sin límite).
     Devuelve { pares: [{ i, js: [...] }], att, descartados }. */
  function emparejar(D, dist, { k = 1, caliper = Infinity, reemplazo = true } = {}) {
    const T = D.map((d, i) => [d, i]).filter(([d]) => d.t), Cs = D.map((d, i) => [d, i]).filter(([d]) => !d.t), usado = new Set(), pares = [];
    for (const [d, i] of T) {
      const cand = Cs.filter(([, j]) => reemplazo || !usado.has(j)).map(([c, j]) => [dist(d, c), j]).filter(([v]) => v <= caliper).sort((a, b) => a[0] - b[0]).slice(0, k);
      if (!cand.length) continue;
      cand.forEach(([, j]) => usado.add(j));
      pares.push({ i, js: cand.map(([, j]) => j) });
    }
    const att = pares.length ? media(pares.map((p) => D[p.i].y - media(p.js.map((j) => D[j].y)))) : NaN;
    return { pares, att, descartados: T.length - pares.length };
  }
  // Diferencia de medias estandarizada de f(d) entre tratados y controles, con pesos opcionales w(d).
  function smd(D, f, w = () => 1) {
    const g = (t) => { const A = D.filter((d) => d.t === t), ws = A.map(w), W = suma(ws) || 1, m = suma(A.map((d, i) => ws[i] * f(d))) / W; return { m, v: suma(A.map((d, i) => ws[i] * (f(d) - m) ** 2)) / W }; };
    const a = g(1), b = g(0);
    return (a.m - b.m) / Math.sqrt((a.v + b.v) / 2 || 1e-12);
  }

  /* ---------- Transacciones y patrones frecuentes ---------- */

  const PRODUCTOS = ['pan', 'leche', 'huevos', 'café', 'mantequilla', 'cerveza', 'pañales', 'fruta'];
  /* Canastas sintéticas con asociaciones plantadas (pan–mantequilla, café–leche, cerveza–pañales, huevos–pan).
     Devuelve arreglos ordenados de índices de PRODUCTOS. */
  function transacciones(n, semilla) {
    const rnd = VIZ.semilla(semilla), T = [];
    for (let t = 0; t < n; t++) {
      const c = new Set();
      if (rnd() < 0.5) { c.add(0); if (rnd() < 0.6) c.add(4); if (rnd() < 0.35) c.add(2); }
      if (rnd() < 0.4) { c.add(3); if (rnd() < 0.7) c.add(1); }
      if (rnd() < 0.2) { c.add(5); if (rnd() < 0.55) c.add(6); }
      [0.25, 0.12, 0.2, 0.08, 0.06, 0.06, 0.05, 0.3].forEach((p, i) => { if (rnd() < p) c.add(i); });
      if (!c.size) c.add(7);
      T.push([...c].sort((a, b) => a - b));
    }
    return T;
  }
  const contiene = (t, X) => X.every((i) => t.includes(i));
  const soporte = (T, X) => T.filter((t) => contiene(t, X)).length / T.length;
  const claveConj = (X) => X.join(',');
  /* Apriori por niveles. Devuelve [{ k, candidatos: [{ X, podado, sop }], frecuentes: [{ X, sop }] }]. */
  function apriori(T, minSop, nItems) {
    const niveles = [];
    let cand = Array.from({ length: nItems }, (_, i) => ({ X: [i], podado: false }));
    for (let k = 1; cand.length; k++) {
      const fr = new Set();
      for (const c of cand) if (!c.podado) { c.sop = soporte(T, c.X); if (c.sop >= minSop) fr.add(claveConj(c.X)); }
      const frecuentes = cand.filter((c) => fr.has(claveConj(c.X))).map((c) => ({ X: c.X, sop: c.sop }));
      niveles.push({ k, candidatos: cand, frecuentes });
      // Unir pares de frecuentes que comparten los primeros k − 1 elementos; podar si algún subconjunto de tamaño k no es frecuente.
      const sig = [];
      for (let a = 0; a < frecuentes.length; a++) for (let b = a + 1; b < frecuentes.length; b++) {
        const A = frecuentes[a].X, B = frecuentes[b].X;
        if (A.slice(0, -1).join() !== B.slice(0, -1).join()) continue;
        const X = [...A, B[B.length - 1]].sort((x, y) => x - y);
        const podado = X.some((_, i) => !fr.has(claveConj(X.filter((__, j) => j !== i))));
        sig.push({ X, podado });
      }
      cand = sig;
    }
    return niveles;
  }
  // Reglas X → Y con Y de un solo elemento a partir de los conjuntos frecuentes de tamaño ≥ 2.
  function reglas(T, niveles) {
    const R = [];
    for (const nv of niveles) for (const f of nv.frecuentes) {
      if (f.X.length < 2) continue;
      for (const y of f.X) {
        const X = f.X.filter((i) => i !== y), sx = soporte(T, X), sy = soporte(T, [y]);
        R.push({ X, Y: [y], sop: f.sop, conf: f.sop / sx, lift: f.sop / (sx * sy), sx, sy });
      }
    }
    return R;
  }
  const nombreConj = (X, nombres = PRODUCTOS) => `{${X.map((i) => nombres[i]).join(', ')}}`;

  /* ---------- Dibujo ---------- */

  // Dispersión de puntos { x, y } en un plano. o: { color(p, i), forma(p, i), r, anillo(p, i), hueco(p, i) }
  function dispersion(ctx, plano, pts, o = {}) {
    pts.forEach((p, i) => {
      const x = plano.sx(p.x), y = plano.sy(p.y), r = o.r ? (typeof o.r === 'function' ? o.r(p, i) : o.r) : 4;
      const col = o.color ? o.color(p, i) : C.s1, f = o.forma ? o.forma(p, i) : 0;
      const an = o.anillo && o.anillo(p, i);
      if (an) { ctx.save(); ctx.strokeStyle = an; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if (o.hueco && o.hueco(p, i)) {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); VIZ.forma(ctx, x, y, r - 0.5, f); ctx.stroke(); ctx.restore();
      } else VIZ.marcador(ctx, x, y, col, r, f);
    });
  }
  // Color y forma de un grupo (−1 = ruido).
  const colorGrupo = (g) => (g < 0 ? C.inactivo : VIZ.series[g % 8]);
  const formaGrupo = (g) => (g < 0 ? 0 : g % 8);
  const leyendaGrupos = (k, prefijo = 'grupo') => Array.from({ length: Math.min(k, 8) }, (_, g) => ({ color: colorGrupo(g), texto: `${prefijo} ${g + 1}`, forma: g ? 'cuadro' : 'punto' }));

  // Color y forma de cada punto de un conjunto de alta dimensión: por grupo, o por posición continua en la rampa.
  const colorAlto = (D, i) => (D.g ? colorGrupo(D.g[i]) : VIZ.css(VIZ.enRampa(0.08 + 0.92 * D.t[i])));
  const formaAlto = (D, i) => (D.g ? D.g[i] % 8 : 0);
  function leyendaAltos(tipo) {
    if (tipo === 'rollo') return [{ color: VIZ.css(VIZ.enRampa(0.08)), texto: 'centro del rollo', forma: 'punto' }, { color: VIZ.css(VIZ.enRampa(1)), texto: 'borde exterior del rollo', forma: 'punto' }];
    if (tipo === 'anillos3d') return leyendaGrupos(2, 'anillo');
    return Array.from({ length: 6 }, (_, g) => ({ color: colorGrupo(g), texto: `cúmulo ${g + 1} (familia ${g < 3 ? 'A' : 'B'})`, forma: g ? 'cuadro' : 'punto' }));
  }
  /* Plano sin ejes ajustado a una incrustación Y (n × 2), con la misma escala en x e y; dibuja un marco. */
  function planoIncrustacion(lienzo, Y, caja = null) {
    const xs = Y.map((y) => y[0]), ys = Y.map((y) => y[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const b = caja || { x0: 6, y0: 6, x1: lienzo.ancho - 6, y1: lienzo.alto - 6 };
    const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 * 1.08 || 1;
    const esc = Math.min(b.x1 - b.x0, b.y1 - b.y0) / (2 * r), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    const ctx = lienzo.ctx;
    ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.strokeRect(b.x0 + 0.5, b.y0 + 0.5, b.x1 - b.x0 - 1, b.y1 - b.y0 - 1);
    return {
      x0: b.x0, x1: b.x1, y0: b.y1, y1: b.y0,
      sx: (v) => mx + (v - cx) * esc, sy: (v) => my - (v - cy) * esc,
      ix: (px) => cx + (px - mx) / esc, iy: (py) => cy - (py - my) / esc,
      dentro: (px, py) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1,
    };
  }
  // Índice del punto de Y más cercano al píxel (x, y), o −1.
  function cercanoIncrustacion(plano, Y, x, y, radio = 10) {
    let m = -1, dm = radio;
    Y.forEach((p, i) => { const d = Math.hypot(plano.sx(p[0]) - x, plano.sy(p[1]) - y); if (d < dm) { dm = d; m = i; } });
    return m;
  }

  // Elipse de nivel k·σ de una gaussiana 2D (en coordenadas de datos).
  function elipse(ctx, plano, mu, S, k, color, { ancho = 2, guiones = null, relleno = null } = {}) {
    const { valores, vectores } = eigSim(S);
    const ang = Math.atan2(vectores[0][1], vectores[0][0]);
    ctx.save();
    ctx.beginPath();
    for (let t = 0; t <= 64; t++) {
      const a = (t / 64) * 2 * Math.PI, u = k * Math.sqrt(Math.max(0, valores[0])) * Math.cos(a), v = k * Math.sqrt(Math.max(0, valores[1])) * Math.sin(a);
      const x = mu[0] + u * Math.cos(ang) - v * Math.sin(ang), y = mu[1] + u * Math.sin(ang) + v * Math.cos(ang);
      t ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y));
    }
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = ancho;
    if (guiones) ctx.setLineDash(guiones);
    ctx.stroke();
    ctx.restore();
  }

  // Histograma: barras de conteo (o densidad) sobre el plano. Devuelve los conteos.
  function histograma(ctx, plano, valores, { min, max, bins = 20, color = C.s1, densidad = false, alfa = 1, contorno = false } = {}) {
    const ancho = (max - min) / bins, cuenta = new Array(bins).fill(0);
    for (const v of valores) { const b = Math.floor((v - min) / ancho); if (b >= 0 && b < bins) cuenta[b]++; else if (v === max) cuenta[bins - 1]++; }
    const f = densidad ? 1 / (valores.length * ancho || 1) : 1;
    ctx.save();
    cuenta.forEach((c, b) => {
      if (!c) return;
      const x0 = plano.sx(min + b * ancho) + 1, x1 = plano.sx(min + (b + 1) * ancho) - 1, y = plano.sy(c * f);
      ctx.beginPath();
      ctx.roundRect(x0, y, Math.max(1, x1 - x0), plano.y0 - y, [3, 3, 0, 0]);
      if (contorno) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = alfa < 1 ? VIZ.alfa(color, alfa) : color; ctx.fill(); }
    });
    ctx.restore();
    return cuenta.map((c) => c * f);
  }

  // Tabla HTML dentro de una caja desplazable. filas: arreglos de celdas (texto o { texto, clase, estilo }).
  function tabla(padre, { clase = 'tabla-datos sin-corte' } = {}) {
    const caja = VIZ.el('div', { class: 'caja-desplazable' }), t = VIZ.el('table', { class: clase });
    caja.appendChild(t);
    padre.appendChild(caja);
    const celda = (tag, c) => (c && typeof c === 'object' && !c.nodeType
      ? VIZ.el(tag, { class: c.clase || null, style: c.estilo || null, html: c.html || null }, c.html ? null : c.texto)
      : VIZ.el(tag, null, c));
    return {
      caja, tabla: t,
      set(cabecera, filas, { activa = -1, alClic = null } = {}) {
        const thead = VIZ.el('thead', null, VIZ.el('tr', null, cabecera.map((c) => celda('th', c))));
        const tbody = VIZ.el('tbody', null, filas.map((f, i) => {
          const tr = VIZ.el('tr', { class: [i === activa ? 'activa' : '', alClic ? 'clicable' : ''].join(' ').trim() || null }, f.map((c) => celda('td', c)));
          if (alClic) tr.addEventListener('click', () => alClic(i));
          return tr;
        }));
        t.replaceChildren(thead, tbody);
      },
    };
  }

  // Detiene una animación continua cuando la figura sale de la pantalla.
  function alSalir(elemento, detener) {
    new IntersectionObserver((e) => { if (!e[0].isIntersecting) detener(); }).observe(elemento);
  }

  // Grafo dirigido con posiciones fijas para VIZ.grafo.dibujar: nodos [[etiqueta, x, y]], aristas [[u, v]].
  const dag = (nodos, aristas) => ({ nodos: nodos.map(([etiqueta, x, y]) => ({ etiqueta, x, y })), aristas: aristas.map(([u, v]) => ({ u, v, w: 0 })), dirigido: true });

  const pct = (v, dig = 1) => `${(100 * v).toFixed(dig)} %`;

  VIZ.min = {
    suma, media, varianza, desv, cuantil, Phi, normalPdf, correlacion, barajar,
    eigSim, covarianza, pca, det2, inv2, gauss2, mahalanobis2,
    DATOS2D, datos2d, DATOS_ALTOS, datosAltos, dist2, matrizDist, estandarizar,
    afinidades, tsne, knnGrafo, grafoDifuso, umap, preservacionVecinos,
    xy, aglomerativo, cortar, dendrograma, dbscan, kmedias, gmm, silueta, randAjustado,
    logistica, probConjunta, posteriores, RED_ALARMA,
    estudio, efectosVerdaderos, emparejar, smd,
    simularSCM, regresion, correlacionParcial, descendientes, caminos, flecha, bloqueo, dsep,
    PRODUCTOS, transacciones, contiene, soporte, claveConj, apriori, reglas, nombreConj,
    dispersion, colorGrupo, formaGrupo, leyendaGrupos, colorAlto, formaAlto, leyendaAltos, planoIncrustacion, cercanoIncrustacion, elipse, histograma, tabla, alSalir, dag, pct,
  };
})();