/* Reconocimiento de patrones: álgebra lineal pequeña, estadística de clases, un conjunto de
   características de objetos segmentados, el criterio de Fisher, elipses de covarianza,
   mapas de calor de matrices y un perceptrón multicapa con retropropagación. */
(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Álgebra lineal ---------- */

  const ceros = (f, c) => Array.from({ length: f }, () => new Array(c).fill(0));
  const identidad = (n) => ceros(n, n).map((f, i) => { f[i] = 1; return f; });
  const trasp = (A) => A[0].map((_, j) => A.map((f) => f[j]));
  const mul = (A, B) => A.map((f) => B[0].map((_, j) => f.reduce((s, v, k) => s + v * B[k][j], 0)));
  const mulVec = (A, v) => A.map((f) => f.reduce((s, a, k) => s + a * v[k], 0));
  const punto = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

  // Inversa por Gauss-Jordan con pivoteo parcial; regulariza la diagonal si es casi singular.
  function inv(A) {
    const n = A.length, M = A.map((f, i) => [...f, ...identidad(n)[i]]);
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      [M[k], M[p]] = [M[p], M[k]];
      const piv = Math.abs(M[k][k]) < 1e-12 ? 1e-12 : M[k][k];
      for (let j = 0; j < 2 * n; j++) M[k][j] /= piv;
      for (let i = 0; i < n; i++) {
        if (i === k) continue;
        const f = M[i][k];
        if (f) for (let j = 0; j < 2 * n; j++) M[i][j] -= f * M[k][j];
      }
    }
    return M.map((f) => f.slice(n));
  }
  function det(A) {
    const n = A.length, M = A.map((f) => [...f]);
    let d = 1;
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) < 1e-300) return 0;
      if (p !== k) { [M[k], M[p]] = [M[p], M[k]]; d = -d; }
      d *= M[k][k];
      for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j < n; j++) M[i][j] -= f * M[k][j]; }
    }
    return d;
  }
  // Valores y vectores propios de una matriz simétrica (Jacobi). Devuelve { valores, vectores } en orden decreciente;
  // vectores[k] es el k-ésimo vector propio.
  function eigSim(A) {
    const n = A.length, a = A.map((f) => [...f]), V = identidad(n);
    for (let barrido = 0; barrido < 60; barrido++) {
      let fuera = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) fuera += a[p][q] ** 2;
      if (fuera < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const orden = [...Array(n).keys()].sort((i, j) => a[j][j] - a[i][i]);
    return { valores: orden.map((i) => a[i][i]), vectores: orden.map((i) => V.map((f) => f[i])) };
  }

  /* ---------- Estadística ---------- */

  const media = (X) => X[0].map((_, j) => X.reduce((s, f) => s + f[j], 0) / X.length);
  function cov(X, mu = media(X), sesgada = false) {
    const d = mu.length, S = ceros(d, d);
    for (const f of X) for (let i = 0; i < d; i++) for (let j = i; j < d; j++) S[i][j] += (f[i] - mu[i]) * (f[j] - mu[j]);
    const n = Math.max(1, X.length - (sesgada ? 0 : 1));
    for (let i = 0; i < d; i++) for (let j = i; j < d; j++) { S[i][j] /= n; S[j][i] = S[i][j]; }
    return S;
  }
  function correlacion(X) {
    const S = cov(X), d = S.length;
    return S.map((f, i) => f.map((v, j) => {
      const q = Math.sqrt(S[i][i] * S[j][j]);
      return q < 1e-12 ? (i === j ? 1 : 0) : v / q;
    }));
  }
  // Separa X por clase.
  function porClase(X, y) {
    const K = Math.max(...y) + 1, grupos = Array.from({ length: K }, () => []);
    X.forEach((f, i) => grupos[y[i]].push(f));
    return grupos;
  }
  // Matrices de dispersión intra-clase (Sw) y entre clases (Sb), con pesos p_k = n_k / n.
  function dispersion(X, y) {
    const grupos = porClase(X, y), mu = media(X), d = mu.length, n = X.length;
    const Sw = ceros(d, d), Sb = ceros(d, d), medias = [];
    for (const g of grupos) {
      if (!g.length) { medias.push(null); continue; }
      const m = media(g), p = g.length / n;
      medias.push(m);
      const S = cov(g, m, true);
      for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
        Sw[i][j] += p * S[i][j];
        Sb[i][j] += p * (m[i] - mu[i]) * (m[j] - mu[j]);
      }
    }
    return { Sw, Sb, medias, mu };
  }
  // Criterio de Fisher J = tr(Sw⁻¹ Sb) sobre las columnas `sub` (todas si se omite).
  function fisher(X, y, sub) {
    const Xs = sub ? X.map((f) => sub.map((j) => f[j])) : X;
    if (!Xs[0].length) return 0;
    const { Sw, Sb } = dispersion(Xs, y);
    const d = Sw.length, eps = 1e-9 * (1 + Sw.reduce((s, f, i) => s + f[i], 0) / d);
    for (let i = 0; i < d; i++) Sw[i][i] += eps;
    const M = mul(inv(Sw), Sb);
    return M.reduce((s, f, i) => s + f[i], 0);
  }
  // Densidad normal bivariada.
  function gauss2(mu, S) {
    const Si = inv(S), k = 1 / (2 * Math.PI * Math.sqrt(Math.max(1e-300, det(S))));
    return (x, y) => {
      const a = x - mu[0], b = y - mu[1];
      return k * Math.exp(-0.5 * (a * (Si[0][0] * a + Si[0][1] * b) + b * (Si[1][0] * a + Si[1][1] * b)));
    };
  }
  // Distancia de Mahalanobis al cuadrado con la inversa ya calculada.
  const mahal2 = (x, mu, Si) => { const d = x.map((v, i) => v - mu[i]); return punto(d, mulVec(Si, d)); };

  // Combinaciones de {0..d−1} de tamaño m, en orden lexicográfico.
  function* combinaciones(d, m) {
    const c = Array.from({ length: m }, (_, i) => i);
    if (m > d) return;
    while (true) {
      yield c.slice();
      let i = m - 1;
      while (i >= 0 && c[i] === d - m + i) i--;
      if (i < 0) return;
      c[i]++;
      for (let j = i + 1; j < m; j++) c[j] = c[j - 1] + 1;
    }
  }
  const binomial = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

  /* ---------- Conjunto de características de objetos segmentados ----------
     Tres clases de objetos y diez características con papeles distintos: informativas, redundantes
     (perímetro ≈ área), una pareja que solo sirve en conjunto (LBP₁ − LBP₂), ruido y una constante. */
  const NOMBRES = ['área', 'perímetro', 'redondez', 'excentric.', 'intensidad', 'contraste', 'LBP₁', 'LBP₂', 'ruido', 'constante'];
  const CLASES_OBJ = ['tornillo', 'tuerca', 'arandela'];
  function caracteristicas(semilla = 1, porClaseN = 40) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
    const X = [], y = [];
    for (let c = 0; c < 3; c++) for (let i = 0; i < porClaseN; i++) {
      const area = [0, 1.2, 2][c] + N() * 0.9;
      const inten = [1.2, 0, 0.6][c] + N() * 0.8;
      const u = N() * 1.5;
      X.push([
        area,
        0.95 * area + N() * 0.25,
        [0, 0, 1.5][c] + N() * 0.7,
        [0, 0.4, 0.2][c] + N(),
        inten,
        0.6 * inten + N() * 0.8,
        u + [0, 0.9, 0][c] + N() * 0.3,
        u + N() * 0.3,
        N(),
        1,
      ]);
      y.push(c);
    }
    return { X, y, nombres: NOMBRES, clases: CLASES_OBJ };
  }

  /* ---------- Dibujo ---------- */

  // Elipse de covarianza a k desviaciones estándar en un plano de VIZ.plano.
  function elipse(ctx, p, mu, S, k = 2, { color = C.tinta, ancho = 1.5, guiones = null, relleno = null } = {}) {
    const { valores, vectores } = eigSim(S);
    const a = k * Math.sqrt(Math.max(0, valores[0])), b = k * Math.sqrt(Math.max(0, valores[1]));
    const [v1, v2] = vectores;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * 2 * Math.PI, c = Math.cos(t) * a, s = Math.sin(t) * b;
      const x = p.sx(mu[0] + c * v1[0] + s * v2[0]), y = p.sy(mu[1] + c * v1[1] + s * v2[1]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    ctx.strokeStyle = color;
    ctx.lineWidth = ancho;
    if (guiones) ctx.setLineDash(guiones);
    ctx.stroke();
    ctx.restore();
  }

  // Mapa de calor de una matriz. op: { t(i, j) → [0, 1], texto(i, j), filas, columnas (rótulos), resaltar(i, j) → color }
  function matriz(ctx, x, y, celda, M, op = {}) {
    const nf = M.length, nc = M[0].length;
    ctx.save();
    ctx.font = VIZ.fuente(Math.min(12, Math.max(9, celda * 0.32)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < nf; i++) for (let j = 0; j < nc; j++) {
      const t = op.t ? op.t(i, j) : M[i][j];
      const X = x + j * celda, Y = y + i * celda;
      ctx.fillStyle = Number.isFinite(t) ? VIZ.css(VIZ.enRampa(t, [C.superficie, ...VIZ.rampa])) : C.neutro;
      ctx.fillRect(X, Y, celda - 1, celda - 1);
      const r = op.resaltar && op.resaltar(i, j);
      if (r) { ctx.strokeStyle = r; ctx.lineWidth = 2.5; ctx.strokeRect(X + 1.25, Y + 1.25, celda - 3.5, celda - 3.5); }
      if (op.texto && celda >= 22) {
        ctx.fillStyle = t > 0.55 ? C.sobre : C.tinta;
        ctx.fillText(op.texto(i, j), X + celda / 2, Y + celda / 2);
      }
    }
    ctx.fillStyle = C.tinta2;
    ctx.font = VIZ.fuente(10);
    if (op.filas) { ctx.textAlign = 'right'; op.filas.forEach((t, i) => ctx.fillText(t, x - 6, y + i * celda + celda / 2)); }
    if (op.columnas) {
      op.columnas.forEach((t, j) => {
        ctx.save();
        ctx.translate(x + j * celda + celda / 2, y - 6);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'left';
        ctx.fillText(t, 0, 0);
        ctx.restore();
      });
    }
    ctx.restore();
  }

  /* ---------- Perceptrón multicapa ----------
     capas: [d₀, d₁, …, d_L]; act: 'relu' | 'tanh' | 'sigmoide' en las capas ocultas; la salida es sigmoide (binaria). */
  const ACT = {
    relu: [(z) => (z > 0 ? z : 0), (z, a) => (z > 0 ? 1 : 0)],
    tanh: [Math.tanh, (z, a) => 1 - a * a],
    sigmoide: [(z) => 1 / (1 + Math.exp(-z)), (z, a) => a * (1 - a)],
  };
  function red(capas, act = 'tanh', semilla = 1) {
    const rnd = VIZ.semilla(semilla);
    const W = [], b = [];
    for (let l = 0; l + 1 < capas.length; l++) {
      const escala = act === 'relu' ? Math.sqrt(2 / capas[l]) : Math.sqrt(1 / capas[l]);
      W.push(Array.from({ length: capas[l + 1] }, () => Array.from({ length: capas[l] }, () => VIZ.normal(rnd) * escala)));
      b.push(new Array(capas[l + 1]).fill(0));
    }
    const m = (A) => A.map((f) => (Array.isArray(f) ? f.map(() => 0) : 0));
    return { capas, act, W, b, adam: { t: 0, mW: W.map(m), vW: W.map(m), mb: b.map(m), vb: b.map(m) } };
  }
  function adelante(net, x) {
    const a = [x], z = [];
    const L = net.W.length;
    for (let l = 0; l < L; l++) {
      const zl = net.W[l].map((f, i) => f.reduce((s, w, k) => s + w * a[l][k], net.b[l][i]));
      z.push(zl);
      a.push(zl.map(l === L - 1 ? ACT.sigmoide[0] : ACT[net.act][0]));
    }
    return { a, z };
  }
  // Gradientes de la entropía cruzada binaria para una muestra. Devuelve { gW, gb, delta (por capa) }.
  function retro(net, cache, y) {
    const L = net.W.length, gW = [], gb = [], delta = new Array(L);
    delta[L - 1] = cache.a[L].map((v) => v - y);
    for (let l = L - 1; l >= 0; l--) {
      gW[l] = delta[l].map((d) => cache.a[l].map((v) => d * v));
      gb[l] = delta[l].slice();
      if (l > 0) {
        const dprev = cache.a[l].map((_, k) => net.W[l].reduce((s, f, i) => s + f[k] * delta[l][i], 0));
        delta[l - 1] = dprev.map((v, k) => v * ACT[net.act][1](cache.z[l - 1][k], cache.a[l][k]));
      }
    }
    return { gW, gb, delta };
  }
  // Una época de descenso por gradiente completo con Adam. Devuelve la pérdida media antes del paso.
  function entrenar(net, X, Y, { lr = 0.03, l2 = 0 } = {}) {
    const L = net.W.length;
    const GW = net.W.map((Wl) => Wl.map((f) => f.map(() => 0))), Gb = net.b.map((bl) => bl.map(() => 0));
    let perdida = 0;
    X.forEach((x, n) => {
      const c = adelante(net, x), p = Math.min(1 - 1e-9, Math.max(1e-9, c.a[L][0]));
      perdida += -(Y[n] * Math.log(p) + (1 - Y[n]) * Math.log(1 - p));
      const g = retro(net, c, Y[n]);
      for (let l = 0; l < L; l++) {
        for (let i = 0; i < GW[l].length; i++) { Gb[l][i] += g.gb[l][i]; for (let k = 0; k < GW[l][i].length; k++) GW[l][i][k] += g.gW[l][i][k]; }
      }
    });
    const n = X.length, A = net.adam, b1 = 0.9, b2 = 0.999;
    A.t++;
    const corr = Math.sqrt(1 - b2 ** A.t) / (1 - b1 ** A.t);
    for (let l = 0; l < L; l++) for (let i = 0; i < net.W[l].length; i++) {
      for (let k = 0; k < net.W[l][i].length; k++) {
        const g = GW[l][i][k] / n + l2 * net.W[l][i][k];
        A.mW[l][i][k] = b1 * A.mW[l][i][k] + (1 - b1) * g;
        A.vW[l][i][k] = b2 * A.vW[l][i][k] + (1 - b2) * g * g;
        net.W[l][i][k] -= (lr * corr * A.mW[l][i][k]) / (Math.sqrt(A.vW[l][i][k]) + 1e-8);
      }
      const g = Gb[l][i] / n;
      A.mb[l][i] = b1 * A.mb[l][i] + (1 - b1) * g;
      A.vb[l][i] = b2 * A.vb[l][i] + (1 - b2) * g * g;
      net.b[l][i] -= (lr * corr * A.mb[l][i]) / (Math.sqrt(A.vb[l][i]) + 1e-8);
    }
    return perdida / n;
  }
  function perdidaMedia(net, X, Y) {
    const L = net.W.length;
    return X.reduce((s, x, n) => {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, adelante(net, x).a[L][0]));
      return s - (Y[n] * Math.log(p) + (1 - Y[n]) * Math.log(1 - p));
    }, 0) / X.length;
  }

  VIZ.pat = {
    ceros, identidad, trasp, mul, mulVec, punto, inv, det, eigSim,
    media, cov, correlacion, porClase, dispersion, fisher, gauss2, mahal2, combinaciones, binomial,
    NOMBRES, caracteristicas, elipse, matriz,
    red, adelante, retro, entrenar, perdidaMedia,
  };
})();
