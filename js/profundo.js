/* Aprendizaje profundo: perceptrón multicapa con retropropagación, optimizadores, convolución sobre imágenes
   pequeñas, dibujo de redes y mapas de calor, y un mundo de rejilla para aprendizaje por refuerzo.
   Compartido por los temas de las secciones «dl-…». */
(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Activaciones ---------- */

  const sig = (z) => 1 / (1 + Math.exp(-z));
  const ACT = {
    sigmoide: { nombre: 'Sigmoid', f: sig, d: (z) => { const s = sig(z); return s * (1 - s); } },
    tanh: { nombre: 'Tanh', f: Math.tanh, d: (z) => 1 - Math.tanh(z) ** 2 },
    relu: { nombre: 'ReLU', f: (z) => (z > 0 ? z : 0), d: (z) => (z > 0 ? 1 : 0) },
    lrelu: { nombre: 'Leaky ReLU', f: (z) => (z > 0 ? z : 0.1 * z), d: (z) => (z > 0 ? 1 : 0.1) },
    lineal: { nombre: 'Lineal', f: (z) => z, d: () => 1 },
  };

  const softmax = (v) => { const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
  const aleatorio = (rnd) => VIZ.normal(rnd);

  /* ---------- Perceptrón multicapa ---------- */

  /* tamanos: [entradas, ocultas…, salidas]. op: { act, salida: 'sigmoide'|'lineal'|'softmax', init: 'xavier'|'he'|'cero'|número, semilla } */
  function red(tamanos, op = {}) {
    const rnd = VIZ.semilla(op.semilla ?? 1), L = tamanos.length - 1;
    const W = [], b = [];
    for (let l = 0; l < L; l++) {
      const n = tamanos[l], m = tamanos[l + 1];
      const esc = op.init === 'he' ? Math.sqrt(2 / n) : op.init === 'cero' ? 0 : typeof op.init === 'number' ? op.init : Math.sqrt(1 / n);
      W.push(Array.from({ length: m }, () => Array.from({ length: n }, () => aleatorio(rnd) * esc)));
      b.push(new Array(m).fill(0));
    }
    return { tamanos, W, b, L, act: op.act || 'tanh', salida: op.salida || 'sigmoide' };
  }

  /* Propagación hacia adelante. mascaras[l] (opcional): arreglo 0/1 (ya escalado) para la capa oculta l (1…L−1). */
  function adelante(r, x, mascaras) {
    const a = [x], z = [null], A = ACT[r.act];
    for (let l = 0; l < r.L; l++) {
      const zl = r.W[l].map((fila, j) => fila.reduce((s, w, i) => s + w * a[l][i], r.b[l][j]));
      z.push(zl);
      let al;
      if (l === r.L - 1) al = r.salida === 'sigmoide' ? zl.map(sig) : r.salida === 'softmax' ? softmax(zl) : zl.slice();
      else {
        al = zl.map(A.f);
        if (mascaras && mascaras[l + 1]) al = al.map((v, j) => v * mascaras[l + 1][j]);
      }
      a.push(al);
    }
    return { a, z, y: a[r.L] };
  }
  const predecir = (r, x) => adelante(r, x).y;
  const crearRed = red;

  const aplanar = (r) => { const v = []; for (let l = 0; l < r.L; l++) { for (const f of r.W[l]) v.push(...f); v.push(...r.b[l]); } return v; };
  const fijar = (r, v) => {
    let k = 0;
    for (let l = 0; l < r.L; l++) { for (const f of r.W[l]) for (let i = 0; i < f.length; i++) f[i] = v[k++]; for (let j = 0; j < r.b[l].length; j++) r.b[l][j] = v[k++]; }
  };
  const nParametros = (tamanos) => tamanos.slice(1).reduce((s, m, l) => s + m * tamanos[l] + m, 0);

  /* Gradiente promedio sobre el lote (retropropagación). lote: [{x, y}] con y arreglo.
     reg: { l1, l2, pDropout, rnd }. Devuelve { g (plano), perdida, deltas (por capa, del último ejemplo) }. */
  function gradiente(r, lote, reg = {}) {
    const A = ACT[r.act];
    const gW = r.W.map((M) => M.map((f) => f.map(() => 0))), gb = r.b.map((v) => v.map(() => 0));
    let perdida = 0, deltas = null;
    for (const { x, y } of lote) {
      let mascaras = null;
      if (reg.pDropout > 0) mascaras = r.tamanos.map((n, l) => (l === 0 || l === r.L ? null : Array.from({ length: n }, () => (reg.rnd() < reg.pDropout ? 0 : 1 / (1 - reg.pDropout)))));
      const { a, z } = adelante(r, x, mascaras);
      const sal = a[r.L];
      if (r.salida === 'sigmoide') perdida += -sal.reduce((s, p, k) => s + y[k] * Math.log(p + 1e-12) + (1 - y[k]) * Math.log(1 - p + 1e-12), 0);
      else if (r.salida === 'softmax') perdida += -sal.reduce((s, p, k) => s + y[k] * Math.log(p + 1e-12), 0);
      else perdida += 0.5 * sal.reduce((s, p, k) => s + (p - y[k]) ** 2, 0);
      let d = sal.map((p, k) => p - y[k]);
      const ds = new Array(r.L);
      for (let l = r.L - 1; l >= 0; l--) {
        ds[l] = d;
        for (let j = 0; j < d.length; j++) { gb[l][j] += d[j]; for (let i = 0; i < a[l].length; i++) gW[l][j][i] += d[j] * a[l][i]; }
        if (l > 0) {
          const nd = a[l].map((_, i) => r.W[l].reduce((s, f, j) => s + f[i] * d[j], 0) * A.d(z[l][i]) * (mascaras && mascaras[l] ? (mascaras[l][i] ? 1 : 0) : 1));
          d = nd;
        }
      }
      deltas = ds;
    }
    const n = lote.length, g = [];
    for (let l = 0; l < r.L; l++) {
      for (let j = 0; j < gW[l].length; j++) {
        for (let i = 0; i < gW[l][j].length; i++) {
          const w = r.W[l][j][i];
          g.push(gW[l][j][i] / n + (reg.l2 ? reg.l2 * w : 0) + (reg.l1 ? reg.l1 * Math.sign(w) : 0));
        }
      }
      for (let j = 0; j < gb[l].length; j++) g.push(gb[l][j] / n);
    }
    return { g, perdida: perdida / n, deltas };
  }

  /* ---------- Optimizadores sobre vectores planos ---------- */

  const OPTIMIZADORES = [['sgd', 'SGD'], ['momentum', 'Momentum'], ['adagrad', 'AdaGrad'], ['rmsprop', 'RMSProp'], ['adam', 'Adam']];
  function optimizador(tipo, { lr = 0.1, mom = 0.9, b1 = 0.9, b2 = 0.999, rho = 0.9, eps = 1e-8 } = {}) {
    let m = null, v = null, t = 0;
    return {
      paso(theta, g) {
        if (!m) { m = new Array(theta.length).fill(0); v = new Array(theta.length).fill(0); }
        t++;
        return theta.map((th, i) => {
          if (tipo === 'momentum') { m[i] = mom * m[i] - lr * g[i]; return th + m[i]; }
          if (tipo === 'adagrad') { v[i] += g[i] * g[i]; return th - (lr * g[i]) / (Math.sqrt(v[i]) + eps); }
          if (tipo === 'rmsprop') { v[i] = rho * v[i] + (1 - rho) * g[i] * g[i]; return th - (lr * g[i]) / (Math.sqrt(v[i]) + eps); }
          if (tipo === 'adam') {
            m[i] = b1 * m[i] + (1 - b1) * g[i]; v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i];
            return th - (lr * (m[i] / (1 - b1 ** t))) / (Math.sqrt(v[i] / (1 - b2 ** t)) + eps);
          }
          return th - lr * g[i];
        });
      },
    };
  }

  // Un paso completo: gradiente del lote, regularización y actualización de los parámetros de la red.
  function entrenarPaso(r, lote, opt, reg) {
    const { g, perdida } = gradiente(r, lote, reg);
    fijar(r, opt.paso(aplanar(r), g));
    return perdida;
  }
  const pares = (pts, K = 2) => pts.map((q) => ({ x: [q.x, q.y], y: K === 2 ? [q.c] : Array.from({ length: K }, (_, k) => (k === q.c ? 1 : 0)) }));

  function mezclar(a, rnd) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  /* ---------- Imágenes pequeñas y convolución ---------- */

  const rej = (n, f) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(i, j)));
  const IMAGENES = {
    cruz: rej(12, (i, j) => (Math.abs(i - 5.5) < 1 || Math.abs(j - 5.5) < 1 ? 1 : 0)),
    cuadro: rej(12, (i, j) => (i >= 2 && i <= 9 && j >= 2 && j <= 9 && (i === 2 || i === 9 || j === 2 || j === 9) ? 1 : 0)),
    diagonal: rej(12, (i, j) => (Math.abs(i - j) <= 1 ? 1 : 0)),
    anillo: rej(12, (i, j) => { const d = Math.hypot(i - 5.5, j - 5.5); return d > 3 && d < 4.8 ? 1 : 0; }),
    letraT: rej(12, (i, j) => ((i <= 2 && j >= 1 && j <= 10) || (i > 2 && j >= 5 && j <= 6) ? 1 : 0)),
    letraL: rej(12, (i, j) => ((j <= 2 && i >= 1 && i <= 10) || (i >= 9 && j >= 1 && j <= 10) ? 1 : 0)),
  };
  const NOMBRES_IMAGEN = [['cruz', 'cruz'], ['cuadro', 'cuadrado'], ['diagonal', 'diagonal'], ['anillo', 'anillo'], ['letraT', 'letra T'], ['letraL', 'letra L']];
  const KERNELS = {
    vertical: { nombre: 'borde vertical', k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] },
    horizontal: { nombre: 'borde horizontal', k: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] },
    diagonal: { nombre: 'diagonal ↘', k: [[2, 1, 0], [1, 0, -1], [0, -1, -2]] },
    desenfoque: { nombre: 'desenfoque', k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map((f) => f.map((v) => v / 9)) },
    nitidez: { nombre: 'nitidez', k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
    identidad: { nombre: 'identidad', k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
  };

  // Correlación cruzada (lo que las CNN llaman convolución) con paso y relleno de ceros.
  function convolucion(img, k, paso = 1, relleno = 0) {
    const n = img.length, m = img[0].length, kh = k.length, kw = k[0].length;
    const H = Math.floor((n + 2 * relleno - kh) / paso) + 1, Wd = Math.floor((m + 2 * relleno - kw) / paso) + 1;
    const sal = [];
    for (let i = 0; i < H; i++) {
      const fila = [];
      for (let j = 0; j < Wd; j++) {
        let s = 0;
        for (let a = 0; a < kh; a++) for (let c = 0; c < kw; c++) {
          const y = i * paso + a - relleno, x = j * paso + c - relleno;
          if (y >= 0 && y < n && x >= 0 && x < m) s += img[y][x] * k[a][c];
        }
        fila.push(s);
      }
      sal.push(fila);
    }
    return sal;
  }
  function pool(mat, tam = 2, paso = tam, tipo = 'max') {
    const n = mat.length, m = mat[0].length, H = Math.floor((n - tam) / paso) + 1, Wd = Math.floor((m - tam) / paso) + 1;
    return Array.from({ length: Math.max(0, H) }, (_, i) => Array.from({ length: Math.max(0, Wd) }, (_, j) => {
      const v = [];
      for (let a = 0; a < tam; a++) for (let c = 0; c < tam; c++) v.push(mat[i * paso + a][j * paso + c]);
      return tipo === 'max' ? Math.max(...v) : v.reduce((s, x) => s + x, 0) / v.length;
    }));
  }
  const relu = (mat) => mat.map((f) => f.map((v) => Math.max(0, v)));
  const tamSalida = (n, k, paso, relleno) => Math.floor((n + 2 * relleno - k) / paso) + 1;

  /* ---------- CNN pequeña entrenable: 12×12 → conv3×3 (c1) → ReLU → pool 2×2 → conv3×3 (c2) → ReLU → densa (6) ---------- */

  const NCLASES = 6;
  function conv3(x, cin, H, W, w, b, cout) {
    const h = H - 2, ww = W - 2, y = new Float64Array(cout * h * ww);
    for (let co = 0; co < cout; co++) for (let i = 0; i < h; i++) for (let j = 0; j < ww; j++) {
      let s = b[co];
      for (let ci = 0; ci < cin; ci++) for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) s += w[((co * cin + ci) * 3 + a) * 3 + c] * x[(ci * H + i + a) * W + j + c];
      y[(co * h + i) * ww + j] = s;
    }
    return y;
  }
  function conv3Atras(x, cin, H, W, w, cout, dy, conDx = true) {
    const h = H - 2, ww = W - 2, dw = new Float64Array(w.length), db = new Float64Array(cout), dx = conDx ? new Float64Array(x.length) : null;
    for (let co = 0; co < cout; co++) for (let i = 0; i < h; i++) for (let j = 0; j < ww; j++) {
      const d = dy[(co * h + i) * ww + j];
      if (d === 0) continue;
      db[co] += d;
      for (let ci = 0; ci < cin; ci++) for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
        const iw = ((co * cin + ci) * 3 + a) * 3 + c, ix = (ci * H + i + a) * W + j + c;
        dw[iw] += d * x[ix];
        if (dx) dx[ix] += d * w[iw];
      }
    }
    return { dw, db, dx };
  }
  function cnnPequena(semilla = 1, { c1 = 3, c2 = 4 } = {}) {
    const rnd = VIZ.semilla(semilla * 7 + 1), N = () => VIZ.normal(rnd);
    const P = {
      w1: Float64Array.from({ length: c1 * 9 }, () => N() * Math.sqrt(2 / 9)), b1: new Float64Array(c1),
      w2: Float64Array.from({ length: c2 * c1 * 9 }, () => N() * Math.sqrt(2 / (c1 * 9))), b2: new Float64Array(c2),
      wd: Float64Array.from({ length: NCLASES * c2 * 9 }, () => N() * Math.sqrt(1 / (c2 * 9))), bd: new Float64Array(NCLASES),
    };
    const V = {}; for (const k in P) V[k] = new Float64Array(P[k].length);
    const nf = c2 * 9;
    function adelante(img) {
      const x = Float64Array.from(img.flat());
      const z1 = conv3(x, 1, 12, 12, P.w1, P.b1, c1), a1 = z1.map((v) => Math.max(0, v));
      const p1 = new Float64Array(c1 * 25), ix = new Int32Array(c1 * 25);
      for (let c = 0; c < c1; c++) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        let m = -Infinity, mi = 0;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const k = (c * 10 + 2 * i + a) * 10 + 2 * j + b; if (a1[k] > m) { m = a1[k]; mi = k; } }
        p1[(c * 5 + i) * 5 + j] = m; ix[(c * 5 + i) * 5 + j] = mi;
      }
      const z2 = conv3(p1, c1, 5, 5, P.w2, P.b2, c2), a2 = z2.map((v) => Math.max(0, v));
      const logits = Array.from({ length: NCLASES }, (_, k) => { let s = P.bd[k]; for (let i = 0; i < nf; i++) s += P.wd[k * nf + i] * a2[i]; return s; });
      return { x, z1, a1, p1, ix, z2, a2, logits, p: softmax(logits) };
    }
    // Un paso con un lote de { img, c }; devuelve la pérdida promedio.
    function paso(lote, lr = 0.03, mom = 0.9, fijos = []) {
      const G = {}; for (const k in P) G[k] = new Float64Array(P[k].length);
      let perd = 0;
      for (const { img, c } of lote) {
        const f = adelante(img);
        perd -= Math.log(f.p[c] + 1e-12);
        const dl = f.p.map((p, k) => p - (k === c ? 1 : 0));
        const da2 = new Float64Array(nf);
        for (let k = 0; k < NCLASES; k++) { G.bd[k] += dl[k]; for (let i = 0; i < nf; i++) { G.wd[k * nf + i] += dl[k] * f.a2[i]; da2[i] += dl[k] * P.wd[k * nf + i]; } }
        const dz2 = da2.map((v, i) => (f.z2[i] > 0 ? v : 0));
        const r2 = conv3Atras(f.p1, c1, 5, 5, P.w2, c2, dz2);
        r2.dw.forEach((v, i) => { G.w2[i] += v; }); r2.db.forEach((v, i) => { G.b2[i] += v; });
        const da1 = new Float64Array(c1 * 100);
        r2.dx.forEach((v, i) => { da1[f.ix[i]] += v; });
        const dz1 = da1.map((v, i) => (f.z1[i] > 0 ? v : 0));
        const r1 = conv3Atras(f.x, 1, 12, 12, P.w1, c1, dz1, false);
        r1.dw.forEach((v, i) => { G.w1[i] += v; }); r1.db.forEach((v, i) => { G.b1[i] += v; });
      }
      for (const k in P) { if (fijos.includes(k)) continue; for (let i = 0; i < P[k].length; i++) { V[k][i] = mom * V[k][i] - (lr * G[k][i]) / lote.length; P[k][i] += V[k][i]; } }
      return perd / lote.length;
    }
    // Copia los pesos indicados desde otra red (o todos); reinicia la velocidad de esas claves.
    function copiar(otra, claves = Object.keys(P)) { for (const k of claves) { P[k].set(otra.P[k]); V[k].fill(0); } }
    function aCero(claves) { for (const k of claves) { P[k].fill(0); V[k].fill(0); } }
    // Pérdida y exactitud sobre ejemplos nuevos de las clases dadas (la decisión es entre las 6 salidas).
    function evaluar(clases, n, semilla, ruido = 0.15, op = {}) {
      const r = VIZ.semilla(semilla); let ok = 0, L = 0, t = 0;
      for (const c of clases) for (let q = 0; q < n; q++) { const f = adelante(muestraImagen(c, r, ruido, op)); if (f.p.indexOf(Math.max(...f.p)) === c) ok++; L -= Math.log(f.p[c] + 1e-12); t++; }
      return { acc: ok / t, perdida: L / t };
    }
    function norma(claves, ref) { let s = 0; for (const k of claves) for (let i = 0; i < P[k].length; i++) s += (P[k][i] - ref[k][i]) ** 2; return Math.sqrt(s); }
    const copia = () => { const o = {}; for (const k in P) o[k] = P[k].slice(); return o; };
    return { P, c1, c2, adelante, paso, copiar, aCero, evaluar, norma, copia, nParametros: Object.values(P).reduce((s, a) => s + a.length, 0) };
  }
  // Ejemplos de las seis imágenes con desplazamiento y ruido.
  function muestraImagen(clase, rnd, ruido = 0.15, op = {}) {
    const base = IMAGENES[NOMBRES_IMAGEN[clase][0]], d = op.desp ?? 1, dx = Math.floor(rnd() * (2 * d + 1)) - d, dy = Math.floor(rnd() * (2 * d + 1)) - d;
    return base.map((f, i) => f.map((_, j) => { const y = i - dy, x = j - dx, v = y >= 0 && y < 12 && x >= 0 && x < 12 ? base[y][x] : 0; return (op.inv ? 1 - v : v) + ruido * VIZ.normal(rnd); }));
  }

  /* ---------- Redes recurrentes (RNN, LSTM, GRU) con retropropagación a través del tiempo ----------
     Entrada escalar por paso; la salida es una sigmoide sobre el último estado oculto (clasificación de la secuencia). */

  const GATES = { rnn: 1, lstm: 4, gru: 3 };
  function recurrente(tipo, H, semilla = 1, { escala = 1, sesgoMemoria = 1 } = {}) {
    const G = GATES[tipo], rnd = VIZ.semilla(semilla * 17 + 5), N = () => VIZ.normal(rnd);
    const P = { Wx: Float64Array.from({ length: G * H }, () => N() * 0.5), Wh: Float64Array.from({ length: G * H * H }, () => (N() / Math.sqrt(H)) * escala), b: new Float64Array(G * H), wo: Float64Array.from({ length: H }, () => N() * 0.5), bo: new Float64Array(1) };
    if (tipo === 'lstm') for (let j = 0; j < H; j++) P.b[H + j] = sesgoMemoria; // sesgo de la puerta de olvido
    if (tipo === 'gru') for (let j = 0; j < H; j++) P.b[j] = sesgoMemoria; // sesgo de la puerta de actualización (z grande = conservar)
    const sg = (z) => 1 / (1 + Math.exp(-z));
    function adelante(x) {
      let h = new Float64Array(H), c = new Float64Array(H); const cache = [];
      for (let t = 0; t < x.length; t++) {
        const hp = h, cp = c, a = new Float64Array(G * H);
        for (let k = 0; k < G * H; k++) { let s = P.b[k] + P.Wx[k] * x[t]; if (!(tipo === 'gru' && k >= 2 * H)) for (let i = 0; i < H; i++) s += P.Wh[k * H + i] * hp[i]; a[k] = s; }
        h = new Float64Array(H); c = new Float64Array(H); const e = { x: x[t], hp, cp, a };
        if (tipo === 'rnn') { for (let j = 0; j < H; j++) h[j] = Math.tanh(a[j]); }
        else if (tipo === 'lstm') {
          e.i = new Float64Array(H); e.f = new Float64Array(H); e.o = new Float64Array(H); e.g = new Float64Array(H); e.tc = new Float64Array(H);
          for (let j = 0; j < H; j++) { e.i[j] = sg(a[j]); e.f[j] = sg(a[H + j]); e.o[j] = sg(a[2 * H + j]); e.g[j] = Math.tanh(a[3 * H + j]); c[j] = e.f[j] * cp[j] + e.i[j] * e.g[j]; e.tc[j] = Math.tanh(c[j]); h[j] = e.o[j] * e.tc[j]; }
        } else {
          e.z = new Float64Array(H); e.r = new Float64Array(H); e.n = new Float64Array(H); e.q = new Float64Array(H);
          for (let j = 0; j < H; j++) { e.z[j] = sg(a[j]); e.r[j] = sg(a[H + j]); let q = 0; for (let i = 0; i < H; i++) q += P.Wh[(2 * H + j) * H + i] * hp[i]; e.q[j] = q; e.n[j] = Math.tanh(P.Wx[2 * H + j] * x[t] + e.r[j] * q + P.b[2 * H + j]); h[j] = (1 - e.z[j]) * e.n[j] + e.z[j] * hp[j]; }
        }
        e.h = h; e.c = c; cache.push(e);
      }
      let zo = P.bo[0]; for (let j = 0; j < H; j++) zo += P.wo[j] * h[j];
      return { cache, p: sg(zo), h };
    }
    // Gradiente de la pérdida (entropía cruzada) respecto de los parámetros; normas de ∂L/∂h_t por paso.
    function gradiente(lote, recorte = 0) {
      const g = {}; for (const k in P) g[k] = new Float64Array(P[k].length);
      let perd = 0, normas = null;
      for (const { x, y } of lote) {
        const f = adelante(x), T = x.length; perd -= y * Math.log(f.p + 1e-12) + (1 - y) * Math.log(1 - f.p + 1e-12);
        const dz = f.p - y; g.bo[0] += dz;
        let dh = new Float64Array(H), dc = new Float64Array(H); for (let j = 0; j < H; j++) { g.wo[j] += dz * f.h[j]; dh[j] = dz * P.wo[j]; }
        const nr = new Array(T);
        for (let t = T - 1; t >= 0; t--) {
          nr[t] = Math.hypot(...dh);
          const e = f.cache[t], da = new Float64Array(G * H), dhp = new Float64Array(H), dcp = new Float64Array(H);
          if (tipo === 'rnn') { for (let j = 0; j < H; j++) da[j] = dh[j] * (1 - e.h[j] ** 2); }
          else if (tipo === 'lstm') {
            for (let j = 0; j < H; j++) {
              const d_o = dh[j] * e.tc[j], dct = dc[j] + dh[j] * e.o[j] * (1 - e.tc[j] ** 2);
              da[j] = dct * e.g[j] * e.i[j] * (1 - e.i[j]); da[H + j] = dct * e.cp[j] * e.f[j] * (1 - e.f[j]); da[2 * H + j] = d_o * e.o[j] * (1 - e.o[j]); da[3 * H + j] = dct * e.i[j] * (1 - e.g[j] ** 2); dcp[j] = dct * e.f[j];
            }
          } else {
            for (let j = 0; j < H; j++) {
              const dn = dh[j] * (1 - e.z[j]), dzz = dh[j] * (e.hp[j] - e.n[j]), dan = dn * (1 - e.n[j] ** 2);
              da[j] = dzz * e.z[j] * (1 - e.z[j]); da[H + j] = dan * e.q[j] * e.r[j] * (1 - e.r[j]); da[2 * H + j] = dan; dhp[j] += dh[j] * e.z[j]; e.dq = e.dq || new Float64Array(H); e.dq[j] = dan * e.r[j];
            }
          }
          for (let k = 0; k < G * H; k++) {
            g.Wx[k] += da[k] * e.x; g.b[k] += da[k];
            if (tipo === 'gru' && k >= 2 * H) { const dq = e.dq[k - 2 * H]; for (let i = 0; i < H; i++) { g.Wh[k * H + i] += dq * e.hp[i]; dhp[i] += P.Wh[k * H + i] * dq; } }
            else for (let i = 0; i < H; i++) { g.Wh[k * H + i] += da[k] * e.hp[i]; dhp[i] += P.Wh[k * H + i] * da[k]; }
          }
          dh = dhp; dc = dcp;
        }
        normas = nr;
      }
      let norma = 0; for (const k in g) { for (let i = 0; i < g[k].length; i++) { g[k][i] /= lote.length; norma += g[k][i] ** 2; } }
      norma = Math.sqrt(norma);
      if (recorte > 0 && norma > recorte) for (const k in g) for (let i = 0; i < g[k].length; i++) g[k][i] *= recorte / norma;
      return { g, perdida: perd / lote.length, norma, normas };
    }
    const claves = Object.keys(P), aplanarR = () => claves.flatMap((k) => Array.from(P[k]));
    const fijarR = (v) => { let o = 0; for (const k of claves) for (let i = 0; i < P[k].length; i++) P[k][i] = v[o++]; };
    const planoG = (g) => claves.flatMap((k) => Array.from(g[k]));
    function paso(lote, opt, recorte = 0) { const r = gradiente(lote, recorte); fijarR(opt.paso(aplanarR(), planoG(r.g))); return r; }
    return { P, tipo, H, adelante, gradiente, paso, nParametros: claves.reduce((s, k) => s + P[k].length, 0) };
  }
  // Tarea «recordar el primer símbolo»: x₀ = ±1 es la señal; el resto es ruido; la etiqueta es el signo de x₀.
  function secuenciaMemoria(L, rnd, ruido = 0.5) {
    const b = rnd() < 0.5 ? 1 : 0, x = [b ? 1 : -1]; for (let t = 0; t < L; t++) x.push(ruido * VIZ.normal(rnd));
    return { x, y: b };
  }

  /* ---------- Embeddings de palabras: co-ocurrencia → PPMI → vectores propios (un corpus sintético pequeño) ---------- */

  const GRUPOS_PAL = [
    ['animales', ['perro', 'gato', 'caballo', 'vaca', 'pájaro', 'pez']],
    ['comidas', ['pan', 'queso', 'manzana', 'arroz', 'sopa', 'pizza']],
    ['ciudades', ['santiago', 'lima', 'madrid', 'roma', 'tokio', 'quito']],
  ];
  function corpusPequeno(semilla = 1, n = 700) {
    const r = VIZ.semilla(semilla * 3 + 11), el = (a) => a[Math.floor(r() * a.length)];
    const [A, Co, Ci] = GRUPOS_PAL.map((g) => g[1]);
    return Array.from({ length: n }, () => {
      const t = Math.floor(r() * 8);
      if (t >= 5) { const g = t - 5; return g === 0 ? ['el', 'animal', 'es', el(A)] : g === 1 ? ['la', 'comida', 'es', el(Co)] : ['la', 'ciudad', 'es', el(Ci)]; }
      if (t === 0) return ['el', el(A), el(['vive', 'corre', 'duerme']), 'en', el(Ci)];
      if (t === 1) return ['el', el(A), 'come', el(Co)];
      if (t === 2) return ['viajamos', 'a', el(Ci), 'para', 'comer', el(Co)];
      if (t === 3) return ['la', 'capital', 'es', el(Ci)];
      return ['en', 'la', 'mesa', 'hay', el(Co), 'y', el(Co)];
    });
  }
  function embeddings(semilla = 1, dim = 6) {
    const frases = corpusPequeno(semilla), vocab = Array.from(new Set(frases.flat())), idx = new Map(vocab.map((w, i) => [w, i])), V = vocab.length;
    const cnt = Array.from({ length: V }, () => new Float64Array(V));
    for (const f of frases) for (let i = 0; i < f.length; i++) for (let j = Math.max(0, i - 2); j <= Math.min(f.length - 1, i + 2); j++) if (i !== j) cnt[idx.get(f[i])][idx.get(f[j])] += 1;
    const tot = cnt.reduce((s, f) => s + f.reduce((a, b) => a + b, 0), 0), fila = cnt.map((f) => f.reduce((a, b) => a + b, 0));
    const M = cnt.map((f, i) => Array.from(f, (c, j) => (c > 0 ? Math.max(0, Math.log((c * tot) / (fila[i] * fila[j]))) : 0)));
    // Vectores propios dominantes de la matriz simétrica M por iteración de potencias con deflación.
    const vecs = [], vals = [], rr = VIZ.semilla(5);
    let A = M.map((f) => f.slice());
    for (let k = 0; k < dim; k++) {
      let v = Array.from({ length: V }, () => rr() - 0.5), lam = 0;
      for (let it = 0; it < 300; it++) { const w = A.map((f) => f.reduce((s, a, j) => s + a * v[j], 0)), n = Math.hypot(...w) || 1; lam = n; v = w.map((x) => x / n); }
      const w = A.map((f) => f.reduce((s, a, j) => s + a * v[j], 0)), signo = w.reduce((s, x, i) => s + x * v[i], 0) >= 0 ? 1 : -1;
      vecs.push(v); vals.push(lam * signo);
      A = A.map((f, i) => f.map((a, j) => a - signo * lam * v[i] * v[j]));
    }
    const E = vocab.map((_, i) => vecs.map((v, k) => v[i] * Math.sqrt(Math.abs(vals[k]))));
    const grupo = (w) => GRUPOS_PAL.findIndex((g) => g[1].includes(w));
    const palabras = vocab.filter((w) => grupo(w) >= 0);
    const vec = (w) => E[idx.get(w)];
    const coseno = (a, b) => { const x = vec(a), y = vec(b), d = x.reduce((s, v, i) => s + v * y[i], 0); return d / ((Math.hypot(...x) * Math.hypot(...y)) || 1); };
    const asoc = (a, b) => M[idx.get(a)][idx.get(b)];
    return { palabras, grupo, grupos: GRUPOS_PAL, vec, coseno, asoc, vocab, frases, dim };
  }

  /* ---------- Atención de juguete (pesos aleatorios fijos, para estudiar la mecánica) ---------- */

  function transformerJuguete(semilla = 1, d = 8) {
    const r = VIZ.semilla(semilla * 19 + 3), N = () => VIZ.normal(r) / Math.sqrt(d), M = () => Array.from({ length: d }, () => Array.from({ length: d }, N));
    const WQ = M(), WK = M(), WV = M(), WO = M(), cache = new Map();
    const mv = (W, x) => W.map((f) => f.reduce((s, w, i) => s + w * x[i], 0));
    const emb = (w) => {
      if (!cache.has(w)) { let h = 7; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const rr = VIZ.semilla(h + semilla); cache.set(w, Array.from({ length: d }, () => VIZ.normal(rr))); }
      return cache.get(w);
    };
    // X: vectores de entrada (uno por token). op: { causal, escala (true = dividir por √d), relleno: [bool] (posiciones a ignorar) }.
    function atender(X, op = {}) {
      const n = X.length, Q = X.map((x) => mv(WQ, x)), K = X.map((x) => mv(WK, x)), V = X.map((x) => mv(WV, x)), esc = op.escala === false ? 1 : 1 / Math.sqrt(d);
      const S = Q.map((q) => K.map((k) => q.reduce((s, v, i) => s + v * k[i], 0) * esc));
      const A = S.map((f, i) => softmax(f.map((v, j) => ((op.causal && j > i) || (op.relleno && op.relleno[j]) ? -Infinity : v))));
      const O = A.map((a) => V[0].map((_, k) => a.reduce((s, p, j) => s + p * V[j][k], 0)));
      return { Q, K, V, S, A, O, n };
    }
    return { d, emb, atender, mv, WQ, WK, WV, WO };
  }

  /* ---------- Dibujo ---------- */

  /* Mapa de calor de una matriz en el rectángulo (x, y, w, h). op: { min, max, divergente, valores (texto en cada celda),
     resaltar: [i, j, alto, ancho] } */
  function mapa(ctx, mat, x, y, w, h, op = {}) {
    const n = mat.length, m = mat[0].length, cw = w / m, ch = h / n;
    let mx = op.max ?? Math.max(...mat.flat()), mn = op.min ?? Math.min(...mat.flat());
    if (op.divergente) { const a = Math.max(Math.abs(mx), Math.abs(mn), 1e-9); mx = a; mn = -a; }
    ctx.save();
    ctx.font = VIZ.fuente(Math.min(11, Math.max(8, cw * 0.38)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const v = mat[i][j], t = mx === mn ? 0 : (v - mn) / (mx - mn);
      if (op.divergente) ctx.fillStyle = v >= 0 ? VIZ.alfa(C.s1, Math.min(1, 0.08 + 0.92 * (v / mx))) : VIZ.alfa(C.s2, Math.min(1, 0.08 + 0.92 * (-v / mx)));
      else ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.max(0, Math.min(1, t)), op.gris ? VIZ.rampaGris : undefined));
      ctx.fillRect(x + j * cw, y + i * ch, cw, ch);
      ctx.strokeStyle = C.rejilla;
      ctx.strokeRect(x + j * cw + 0.5, y + i * ch + 0.5, cw - 1, ch - 1);
      if (op.valores && cw >= 22) { ctx.fillStyle = Math.abs(t - (op.divergente ? 0.5 : 0)) > 0.35 ? C.sobre : C.tinta2; ctx.fillText(op.valores(v), x + (j + 0.5) * cw, y + (i + 0.5) * ch); }
    }
    if (op.resaltar) {
      const [ri, rj, rh, rw] = op.resaltar;
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5;
      ctx.strokeRect(x + rj * cw, y + ri * ch, rw * cw, rh * ch);
    }
    ctx.restore();
    return { cw, ch };
  }

  /* Diagrama de una red por capas. tamanos: unidades por capa. op: { red (colorea aristas por peso), valores (a por capa),
     apagadas: [[capa, unidad]], resaltarCapa, tope (máximo de nodos dibujados por capa) } */
  function diagramaRed(ctx, x, y, w, h, tamanos, op = {}) {
    const tope = op.tope || 8, L = tamanos.length;
    const pos = tamanos.map((n, l) => {
      const k = Math.min(n, tope);
      return Array.from({ length: k }, (_, j) => [x + (L === 1 ? w / 2 : (l * w) / (L - 1)), y + ((j + 0.5) * h) / k]);
    });
    ctx.save();
    for (let l = 0; l < L - 1; l++) {
      for (let j = 0; j < pos[l + 1].length; j++) for (let i = 0; i < pos[l].length; i++) {
        const wt = op.red ? op.red.W[l][j][i] : null;
        const off = op.apagadas && (op.apagadas.some(([c, u]) => c === l && u === i) || op.apagadas.some(([c, u]) => c === l + 1 && u === j));
        ctx.strokeStyle = off ? VIZ.alfa(C.tenue, 0.4) : wt == null ? C.tenue : VIZ.alfa(wt >= 0 ? C.s1 : C.s2, Math.min(0.9, 0.12 + Math.abs(wt) * 0.5));
        ctx.lineWidth = wt == null ? 1 : Math.min(3, 0.5 + Math.abs(wt) * 1.2);
        ctx.beginPath(); ctx.moveTo(...pos[l][i]); ctx.lineTo(...pos[l + 1][j]); ctx.stroke();
      }
    }
    pos.forEach((capa, l) => capa.forEach(([px, py], j) => {
      const off = op.apagadas && op.apagadas.some(([c, u]) => c === l && u === j);
      const v = op.valores && op.valores[l] ? op.valores[l][j] : null;
      ctx.beginPath(); ctx.arc(px, py, op.r || 9, 0, Math.PI * 2);
      ctx.fillStyle = off ? C.neutro : v == null ? C.superficie : VIZ.alfa(C.s1, Math.min(1, 0.12 + Math.abs(v) * 0.7));
      ctx.fill();
      ctx.lineWidth = op.resaltarCapa === l ? 3 : 1.5;
      ctx.strokeStyle = off ? C.inactivo : op.resaltarCapa === l ? C.s2 : C.tinta;
      ctx.stroke();
      if (off) { ctx.beginPath(); ctx.moveTo(px - 5, py - 5); ctx.lineTo(px + 5, py + 5); ctx.moveTo(px + 5, py - 5); ctx.lineTo(px - 5, py + 5); ctx.strokeStyle = C.s8; ctx.stroke(); }
    }));
    ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    tamanos.forEach((n, l) => ctx.fillText(n > tope ? `${n} (${tope} mostradas)` : String(n), pos[l][0][0], y + h + 4));
    ctx.restore();
    return pos;
  }

  // Pierde la dependencia de ml.js: puntos de datos y regiones se pintan con VIZ.ml.

  /* ---------- Escenas con objetos y cajas delimitadoras (coordenadas en [0, 1]²) ---------- */

  const CLASES_OBJ = [['caja', C.s1], ['balón', C.s2], ['cono', C.s3]];
  function interseccion(a, b) { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }
  function iou(a, b) { const i = interseccion(a, b); return i / (a.w * a.h + b.w * b.h - i || 1); }
  function escena(semilla, n = 3) {
    const r = VIZ.semilla(semilla * 41 + 3), objs = [];
    for (let t = 0; t < 400 && objs.length < n; t++) {
      const w = 0.14 + r() * 0.16, o = { clase: Math.floor(r() * 3), w, h: w * (0.8 + r() * 0.5), x: 0.04 + r() * (0.92 - w), y: 0.04 };
      o.y = 0.04 + r() * (0.92 - o.h);
      if (objs.every((q) => interseccion(q, { x: o.x - 0.03, y: o.y - 0.03, w: o.w + 0.06, h: o.h + 0.06 }) === 0)) objs.push(o);
    }
    return objs;
  }
  // Dibuja las formas en el cuadro (x, y, w, h) del lienzo; op.ocultar: conjunto de índices a omitir.
  function dibujarEscena(ctx, X, Y, W, H, objs, op = {}) {
    ctx.save();
    ctx.fillStyle = C.neutro; ctx.fillRect(X, Y, W, H);
    ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1);
    objs.forEach((o, i) => {
      if (op.ocultar && op.ocultar.has(i)) return;
      const x = X + o.x * W, y = Y + o.y * H, w = o.w * W, h = o.h * H, col = CLASES_OBJ[o.clase][1];
      ctx.fillStyle = VIZ.alfa(col, 0.85); ctx.beginPath();
      if (o.clase === 0) ctx.rect(x, y, w, h); else if (o.clase === 1) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
      ctx.fill();
    });
    ctx.restore();
  }
  function caja(ctx, X, Y, W, H, b, color, { ancho = 2, guiones = null, relleno = 0, etiqueta = null } = {}) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = ancho; if (guiones) ctx.setLineDash(guiones);
    if (relleno) { ctx.fillStyle = VIZ.alfa(color, relleno); ctx.fillRect(X + b.x * W, Y + b.y * H, b.w * W, b.h * H); }
    ctx.strokeRect(X + b.x * W, Y + b.y * H, b.w * W, b.h * H);
    if (etiqueta) {
      ctx.setLineDash([]); ctx.font = VIZ.fuente(10, 600); const tw = ctx.measureText(etiqueta).width + 8, ty = Math.max(Y, Y + b.y * H - 14);
      ctx.fillStyle = color; ctx.fillRect(X + b.x * W, ty, tw, 14); ctx.fillStyle = C.sobre; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(etiqueta, X + b.x * W + 4, ty + 7);
    }
    ctx.restore();
  }

  /* ---------- Mundo de rejilla (aprendizaje por refuerzo) ---------- */

  // '#' muro, 'S' inicio, 'G' meta (+1), 'X' trampa (−1), '.' libre.
  const MAPAS = {
    simple: ['S...', '.#.X', '....', '...G'],
    pasillo: ['S..#....', '.#.#.##.', '.#...#..', '.####.#.', '......#G'],
    trampas: ['S.....', '.XXXX.', '......', '.XXXX.', '.....G'],
  };
  const ACCIONES = [[-1, 0, '↑'], [0, 1, '→'], [1, 0, '↓'], [0, -1, '←']];
  function mundo(nombre, op = {}) {
    const mapa = MAPAS[nombre].map((f) => f.split('')), H = mapa.length, W = mapa[0].length;
    let ini = [0, 0];
    mapa.forEach((f, i) => f.forEach((c, j) => { if (c === 'S') ini = [i, j]; }));
    const paso = op.costo ?? -0.04;
    return {
      mapa, H, W, ini, n: H * W,
      id: (i, j) => i * W + j,
      terminal: (i, j) => mapa[i][j] === 'G' || mapa[i][j] === 'X',
      libre: (i, j) => i >= 0 && j >= 0 && i < H && j < W && mapa[i][j] !== '#',
      // Transición con ruido: con probabilidad pr resbala a un lado.
      transiciones(i, j, a, pr = 0) {
        const res = [];
        const mover = (b, p) => { const [di, dj] = ACCIONES[b]; const ni = i + di, nj = j + dj; const [ti, tj] = this.libre(ni, nj) ? [ni, nj] : [i, j]; res.push({ p, i: ti, j: tj, r: mapa[ti][tj] === 'G' ? 1 : mapa[ti][tj] === 'X' ? -1 : paso }); };
        mover(a, 1 - pr);
        if (pr > 0) { mover((a + 1) % 4, pr / 2); mover((a + 3) % 4, pr / 2); }
        return res;
      },
    };
  }

  /* ---------- Clasificadores simples sobre puntos { x, y, c } (devuelven P(clase 1)) ---------- */

  function knn(pts, k, escala = [1, 1]) {
    return (x, y) => {
      const d = pts.map((q) => [((q.x - x) * escala[0]) ** 2 + ((q.y - y) * escala[1]) ** 2, q.c]).sort((a, b) => a[0] - b[0]).slice(0, k);
      return d.reduce((s, q) => s + q[1], 0) / Math.max(1, d.length);
    };
  }
  function logistica(pts, iter = 300, lr = 0.8) {
    let w0 = 0, w1 = 0, b = 0;
    for (let t = 0; t < iter; t++) {
      let g0 = 0, g1 = 0, gb = 0;
      for (const q of pts) { const e = sig(w0 * q.x + w1 * q.y + b) - q.c; g0 += e * q.x; g1 += e * q.y; gb += e; }
      w0 -= (lr * g0) / pts.length; w1 -= (lr * g1) / pts.length; b -= (lr * gb) / pts.length;
    }
    return (x, y) => sig(w0 * x + w1 * y + b);
  }
  const acierto = (pts, f) => (pts.length ? pts.filter((q) => (f(q.x, q.y) > 0.5 ? 1 : 0) === q.c).length / pts.length : NaN);

  /* ---------- Superficies de pérdida de dos parámetros ---------- */

  const SUP = {
    valle: { nombre: 'Valle estrecho', f: (x, y) => 0.5 * (x * x + 20 * y * y), g: (x, y) => [x, 20 * y], dom: { xmin: -3.2, xmax: 3.2, ymin: -1.6, ymax: 1.6 }, ini: [-2.8, 1.2], opt: [0, 0], niveles: [0.1, 0.4, 1, 2, 3.5, 5.5, 8, 11] },
    rosenbrock: { nombre: 'Banana (Rosenbrock)', f: (x, y) => (1 - x) ** 2 + 5 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 20 * x * (y - x * x), 10 * (y - x * x)], dom: { xmin: -2, xmax: 2, ymin: -1, ymax: 3 }, ini: [-1.5, 2.2], opt: [1, 1], niveles: [0.05, 0.3, 1, 2.5, 5, 10, 20, 40] },
    silla: { nombre: 'Punto de silla', f: (x, y) => 0.5 * x * x + 0.25 * y ** 4 - 0.5 * y * y, g: (x, y) => [x, y ** 3 - y], dom: { xmin: -3, xmax: 3, ymin: -2, ymax: 2 }, ini: [-2.5, 0.03], opt: [0, 1], niveles: [-0.2, 0, 0.3, 0.8, 1.5, 2.5, 4, 6] },
  };

  /* Fondo costoso (curvas de nivel) que se pinta una vez en un lienzo auxiliar y se copia en cada cuadro.
     uso: const fondo = cache(lienzo); … fondo(clave, (c) => ML.contorno(c, p, …)); */
  function cache(lienzo) {
    let off = null, clave = '';
    return (k, pintar) => {
      const w = lienzo.canvas.width, h = lienzo.canvas.height, kk = `${k}|${w}x${h}`;
      if (kk !== clave) {
        off = document.createElement('canvas'); off.width = w; off.height = h;
        const c = off.getContext('2d');
        c.setTransform(w / lienzo.ancho, 0, 0, h / lienzo.alto, 0, 0);
        pintar(c); clave = kk;
      }
      lienzo.ctx.save(); lienzo.ctx.setTransform(1, 0, 0, 1, 0, 0); lienzo.ctx.drawImage(off, 0, 0); lienzo.ctx.restore();
    };
  }

  /* ---------- Figura reutilizable: una red aprende un conjunto 2-D ----------
     o.controles: lista de controles que se muestran (datos, ruido, n, ocultas, capas, act, init, opt, lr, l2, l1, dropout, lote);
     o.inicial: valores iniciales; o.lectura(st) → pares extra para la lectura; o.nota: texto de la nota. Devuelve { st, e, rep }. */
  function entrenador(cuerpo, o = {}) {
    const e = Object.assign({ datos: 'lunas', ruido: 0.2, n: 120, ocultas: 8, capas: 1, act: 'tanh', opt: 'adam', lr: 0.05, l2: 0, l1: 0, dropout: 0, lote: 16, init: 'xavier', semilla: 1 }, o.inicial);
    const quiere = o.controles || ['datos', 'ocultas', 'act', 'lr'];
    const ML = VIZ.ml, st = { red: null, opt: null, hist: [], tr: [], va: [], ep: 0 };
    const ctl = VIZ.controles(cuerpo);
    const rein = () => rep.reiniciar();
    const tiene = (k) => quiere.includes(k);
    if (tiene('datos')) ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([k]) => k !== 'tres'), valor: e.datos, alCambiar: (v) => { e.datos = v; rein(); } });
    if (tiene('ruido')) ctl.rango({ etiqueta: 'Ruido', min: 0, max: 1, paso: 0.05, valor: e.ruido, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { e.ruido = v; rein(); } });
    if (tiene('n')) ctl.rango({ etiqueta: 'Datos disponibles', min: 20, max: 300, paso: 10, valor: e.n, alCambiar: (v) => { e.n = v; rein(); } });
    if (tiene('capas')) ctl.rango({ etiqueta: 'Capas ocultas', min: 1, max: 6, valor: e.capas, alCambiar: (v) => { e.capas = v; rein(); } });
    if (tiene('ocultas')) ctl.rango({ etiqueta: 'Neuronas por capa', min: 1, max: 24, valor: e.ocultas, alCambiar: (v) => { e.ocultas = v; rein(); } });
    if (tiene('act')) ctl.selector({ etiqueta: 'Activación', opciones: ['tanh', 'relu', 'sigmoide', 'lineal'].map((k) => [k, ACT[k].nombre]), valor: e.act, alCambiar: (v) => { e.act = v; rein(); } });
    if (tiene('init')) ctl.selector({ etiqueta: 'Inicialización', opciones: [['cero', 'ceros'], ['0.01', 'pequeña (σ = 0.01)'], ['xavier', 'Xavier'], ['he', 'He'], ['3', 'grande (σ = 3)']], valor: String(e.init), alCambiar: (v) => { e.init = ['cero', 'xavier', 'he'].includes(v) ? v : parseFloat(v); rein(); } });
    if (tiene('opt')) ctl.selector({ etiqueta: 'Optimizador', opciones: OPTIMIZADORES, valor: e.opt, alCambiar: (v) => { e.opt = v; rein(); } });
    if (tiene('lr')) ctl.rango({ etiqueta: 'Tasa de aprendizaje', min: -3, max: 0.5, paso: 0.25, valor: Math.log10(e.lr), formato: (v) => VIZ.fmt(10 ** v, 3), alCambiar: (v) => { e.lr = 10 ** v; rein(); } });
    if (tiene('lote')) ctl.selector({ etiqueta: 'Tamaño del lote', opciones: [['1', '1 (SGD puro)'], ['8', '8'], ['16', '16'], ['0', 'todo el conjunto']], valor: String(e.lote), alCambiar: (v) => { e.lote = parseInt(v, 10); rein(); } });
    if (tiene('l2')) ctl.rango({ etiqueta: 'Regularización L2 (λ)', min: 0, max: 0.2, paso: 0.005, valor: e.l2, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { e.l2 = v; rein(); } });
    if (tiene('l1')) ctl.rango({ etiqueta: 'Regularización L1 (λ)', min: 0, max: 0.05, paso: 0.001, valor: e.l1, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { e.l1 = v; rein(); } });
    if (tiene('dropout')) ctl.rango({ etiqueta: 'Dropout (p de apagar)', min: 0, max: 0.8, paso: 0.05, valor: e.dropout, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { e.dropout = v; rein(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    ctl.boton('Nuevos datos', () => { e.semilla++; rein(); });

    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const lr = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 360 });
    const lc = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 360 });
    const tipR = VIZ.tooltip(lr), tipC = VIZ.tooltip(lc);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2, ['clase 0', 'clase 1']), { color: C.inactivo, texto: 'hueco: dato de validación', forma: 'punto' },
      { color: C.s1, texto: 'pérdida de entrenamiento', forma: 'linea' }, { color: C.s2, texto: 'pérdida de validación', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo), lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, o.nota || 'Pulse Reproducir: cada paso es una época. A la izquierda, la región que la red asigna a cada clase; a la derecha, su pérdida en datos vistos y no vistos.');

    function perdida(pts) {
      return pts.length ? pts.reduce((s, q) => { const p = adelante(st.red, [q.x, q.y]).y[0]; return s - (q.c * Math.log(p + 1e-12) + (1 - q.c) * Math.log(1 - p + 1e-12)); }, 0) / pts.length : NaN;
    }
    const exacta = (pts) => (pts.length ? pts.filter((q) => (adelante(st.red, [q.x, q.y]).y[0] > 0.5 ? 1 : 0) === q.c).length / pts.length : NaN);
    function medir() { st.hist.push({ ep: st.ep, lt: perdida(st.tr), lv: perdida(st.va), at: exacta(st.tr), av: exacta(st.va) }); }
    function iniciar() {
      const todos = ML.datos(e.datos, e.n, e.ruido, e.semilla * 13 + 5);
      const part = ML.partir(todos, 0.6, e.semilla);
      st.tr = part.entrenamiento; st.va = part.validacion; st.ep = 0; st.hist = [];
      const tam = [2, ...Array.from({ length: e.capas ?? 1 }, () => e.ocultas), 1];
      st.red = red(tam, { act: e.act, salida: 'sigmoide', init: e.init, semilla: e.semilla * 7 + 3 });
      st.opt = optimizador(e.opt, { lr: e.lr });
      const rnd = VIZ.semilla(e.semilla * 101 + 9), rd = VIZ.semilla(e.semilla * 53 + 1);
      medir();
      if (o.alIniciar) o.alIniciar(st, e);
      return (function* () {
        for (;;) {
          const datos = mezclar(pares(st.tr), rnd), B = e.lote > 0 ? e.lote : datos.length;
          for (let i = 0; i < datos.length; i += B) entrenarPaso(st.red, datos.slice(i, i + B), st.opt, { l1: e.l1, l2: e.l2, pDropout: e.dropout, rnd: rd });
          st.ep++;
          medir();
          if (o.alEpoca) o.alEpoca(st, e);
          yield;
          if (st.ep >= 600) return;
        }
      })();
    }
    let pl = null, pc = null;
    function dibujar() {
      if (!st.red) return;
      const h = st.hist[st.hist.length - 1];
      {
        const { ctx } = lr;
        lr.limpiar();
        pl = ML.plano(lr);
        pl.ejes();
        ctx.save(); pl.recortar();
        ML.regiones(ctx, pl, (x, y) => adelante(st.red, [x, y]).y[0], { paso: 7 });
        ML.contorno(ctx, pl, (x, y) => adelante(st.red, [x, y]).y[0], 0.5, { color: C.tinta, ancho: 2 });
        ctx.restore();
        ML.puntos(ctx, pl, st.tr);
        ML.puntos(ctx, pl, st.va, { hueco: () => true });
      }
      {
        const { ctx } = lc;
        lc.limpiar();
        const top = Math.max(0.8, ...st.hist.map((q) => Math.max(q.lt, q.lv || 0))) * 1.05;
        pc = VIZ.plano(lc, { xmin: 0, xmax: Math.max(20, st.ep), ymin: 0, ymax: Math.min(top, 3) }, { etiquetaX: 'época', etiquetaY: 'pérdida (entropía cruzada)' });
        pc.ejes();
        ctx.save(); pc.recortar();
        VIZ.trazar(ctx, pc, st.hist.map((q) => [q.ep, q.lt]), C.s1, 2);
        VIZ.trazar(ctx, pc, st.hist.map((q) => [q.ep, q.lv]), C.s2, 2);
        ctx.restore();
      }
      registro.textContent = st.ep === 0 ? 'Red recién inicializada: todavía no ha visto ninguna época.' : `Época ${st.ep}: pérdida ${VIZ.fmt(h.lt, 3)} en entrenamiento y ${VIZ.fmt(h.lv, 3)} en validación.`;
      lectura.set([['época', String(st.ep)], ['exactitud entrenamiento', `${VIZ.fmt(100 * h.at, 3)} %`], ['exactitud validación', `${VIZ.fmt(100 * h.av, 3)} %`],
        ['parámetros', VIZ.entero(aplanar(st.red).length)], ...(o.lectura ? o.lectura(st, e) : [])]);
    }
    lr.alDibujar = dibujar; lc.alDibujar = dibujar;
    lr.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lr.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !st.red) return tipR.ocultar();
      const p = adelante(st.red, [pl.ix(x), pl.iy(y)]).y[0];
      tipR.mostrar(x, y, `(${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})<br>P(clase 1) = <b>${VIZ.fmt(p, 3)}</b>`);
    });
    lc.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lc.posicion(ev);
      if (!pc || !pc.dentro(x, y) || !st.hist.length) return tipC.ocultar();
      const q = st.hist[Math.max(0, Math.min(st.hist.length - 1, Math.round(pc.ix(x))))];
      tipC.mostrar(x, y, `época <b>${q.ep}</b>` + VIZ.filaTooltip(C.s1, 'entrenamiento', VIZ.fmt(q.lt, 3)) + VIZ.filaTooltip(C.s2, 'validación', VIZ.fmt(q.lv, 3)));
    });
    lr.canvas.addEventListener('pointerleave', () => tipR.ocultar());
    lc.canvas.addEventListener('pointerleave', () => tipC.ocultar());
    rep.reiniciar();
    return { st, e, rep };
  }

  /* ---------- Programación dinámica sobre el mundo de rejilla ---------- */

  const celdaId = (m, i, j) => i * m.W + j;
  function qDe(m, V, i, j, a, gamma, pr) {
    let s = 0;
    for (const t of m.transiciones(i, j, a, pr)) s += t.p * (t.r + (m.terminal(t.i, t.j) ? 0 : gamma * V[celdaId(m, t.i, t.j)]));
    return s;
  }
  const estados = (m) => { const l = []; for (let i = 0; i < m.H; i++) for (let j = 0; j < m.W; j++) if (m.mapa[i][j] !== '#' && !m.terminal(i, j)) l.push([i, j]); return l; };
  // Un barrido de la ecuación de Bellman. pol[k] = probabilidades de las 4 acciones (evaluación) o null (optimalidad).
  function barrido(m, V, gamma, pr, pol) {
    const N = new Float64Array(m.n);
    for (const [i, j] of estados(m)) {
      const q = [0, 1, 2, 3].map((a) => qDe(m, V, i, j, a, gamma, pr));
      N[celdaId(m, i, j)] = pol ? q.reduce((s, v, a) => s + pol[celdaId(m, i, j)][a] * v, 0) : Math.max(...q);
    }
    return N;
  }
  const politicaVoraz = (m, V, gamma, pr) => { const P = new Array(m.n).fill(null); for (const [i, j] of estados(m)) { const q = [0, 1, 2, 3].map((a) => qDe(m, V, i, j, a, gamma, pr)), mx = Math.max(...q), mejores = q.map((v, a) => (v > mx - 1e-9 ? a : -1)).filter((a) => a >= 0); P[celdaId(m, i, j)] = [0, 1, 2, 3].map((a) => (mejores.includes(a) ? 1 / mejores.length : 0)); } return P; };
  function valoresOptimos(m, gamma, pr, tol = 1e-8) {
    let V = new Float64Array(m.n), it = 0;
    for (; it < 2000; it++) { const N = barrido(m, V, gamma, pr, null); let d = 0; for (let k = 0; k < m.n; k++) d = Math.max(d, Math.abs(N[k] - V[k])); V = N; if (d < tol) break; }
    return { V, pol: politicaVoraz(m, V, gamma, pr), iter: it + 1 };
  }
  const politicaUniforme = (m) => Array.from({ length: m.n }, () => [0.25, 0.25, 0.25, 0.25]);
  // Flecha y celdas del mundo (compartido por los temas de refuerzo). op: { V, pol, q, resaltar }.
  function dibujarMundo(ctx, m, x0, y0, c, op = {}) {
    ctx.save();
    const mx = op.V ? Math.max(0.05, ...op.V.map(Math.abs)) : 1;
    for (let i = 0; i < m.H; i++) for (let j = 0; j < m.W; j++) {
      const ch = m.mapa[i][j], x = x0 + j * c, y = y0 + i * c, v = op.V ? op.V[celdaId(m, i, j)] : null;
      if (ch === '#') ctx.fillStyle = C.tinta; else if (ch === 'G') ctx.fillStyle = VIZ.alfa(C.s6, 0.45); else if (ch === 'X') ctx.fillStyle = VIZ.alfa(C.s8, 0.45); else if (v != null) ctx.fillStyle = v >= 0 ? VIZ.alfa(C.s1, Math.min(0.85, 0.06 + 0.8 * (v / mx))) : VIZ.alfa(C.s2, Math.min(0.85, 0.06 + 0.8 * (-v / mx))); else ctx.fillStyle = C.superficie;
      ctx.fillRect(x + 1, y + 1, c - 2, c - 2);
      ctx.font = VIZ.fuente(Math.min(12, c * 0.3)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (ch === 'G' || ch === 'X' || ch === 'S') { ctx.fillStyle = ch === 'S' ? C.tinta2 : C.tinta; ctx.fillText(ch === 'S' ? 'inicio' : ch === 'G' ? '+1' : '−1', x + c / 2, y + (ch === 'S' ? c * 0.2 : c / 2)); }
      if (v != null && ch !== '#' && ch !== 'G' && ch !== 'X' && c >= 36 && !op.sinNumeros) { ctx.fillStyle = C.tinta; ctx.fillText(VIZ.fmt(v, 2).replace('-', '−'), x + c / 2, y + c * 0.78); }
      if (op.pol && op.pol[celdaId(m, i, j)] && ch !== '#') { const p = op.pol[celdaId(m, i, j)]; p.forEach((q, a) => { if (q < 0.05) return; const [di, dj] = ACCIONES[a], L = c * (0.12 + 0.22 * q); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5 + 1.5 * q; ctx.beginPath(); const cx = x + c / 2, cy = y + c / 2 - (op.V ? 0 : 0); ctx.moveTo(cx, cy); ctx.lineTo(cx + dj * L, cy + di * L); ctx.stroke(); ctx.fillStyle = C.tinta; ctx.beginPath(); const ex = cx + dj * L, ey = cy + di * L; ctx.moveTo(ex + dj * 4, ey + di * 4); ctx.lineTo(ex - di * 3 - dj * 2, ey + dj * 3 - di * 2); ctx.lineTo(ex + di * 3 - dj * 2, ey - dj * 3 - di * 2); ctx.fill(); }); }
    }
    if (op.agente) { const [ai, aj] = op.agente; ctx.beginPath(); ctx.arc(x0 + (aj + 0.5) * c, y0 + (ai + 0.5) * c, c * 0.22, 0, 7); ctx.fillStyle = C.tinta; ctx.fill(); ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.stroke(); }
    if (op.ruta) { ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.beginPath(); op.ruta.forEach(([i, j], k) => { const px = x0 + (j + 0.5) * c, py = y0 + (i + 0.5) * c; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); }
    ctx.restore();
  }
  // Episodio con una política de probabilidades por celda (o función (i, j) → acción). Devuelve ruta, retorno descontado y recompensas.
  function episodio(m, pol, gamma, pr, rnd, tope = 200) {
    let [i, j] = m.ini; const ruta = [[i, j]], rec = []; let G = 0, f = 1;
    for (let t = 0; t < tope && !m.terminal(i, j); t++) {
      const p = typeof pol === 'function' ? pol(i, j) : pol[celdaId(m, i, j)]; let a;
      if (typeof p === 'number') a = p; else { let u = rnd(); a = 0; while (a < 3 && u > p[a]) { u -= p[a]; a++; } }
      const tr = m.transiciones(i, j, a, pr); let u = rnd(), k = 0; while (k < tr.length - 1 && u > tr[k].p) { u -= tr[k].p; k++; }
      const s = tr[k]; G += f * s.r; f *= gamma; rec.push(s.r); i = s.i; j = s.j; ruta.push([i, j]);
    }
    return { ruta, G, rec, pasos: rec.length, terminal: m.terminal(i, j) };
  }

  /* ---------- Deep Q-Network sobre el mundo de rejilla (aproximación de Q con una red) ----------
     op: { replay, objetivo (red objetivo), priorizado, gamma, pr, lr, lote, memoria, sincronizar, epsInicial, epsFinal, episodiosEps } */
  function agenteDQN(m, op = {}) {
    const o = Object.assign({ replay: true, objetivo: true, priorizado: false, gamma: 0.95, pr: 0, lr: 0.005, lote: 16, memoria: 1500, sincronizar: 100, epsInicial: 1, epsFinal: 0.05, episodiosEps: 120, semilla: 1 }, op);
    const rnd = VIZ.semilla(o.semilla * 29 + 7), feats = (i, j) => [i / Math.max(1, m.H - 1) * 2 - 1, j / Math.max(1, m.W - 1) * 2 - 1];
    const red = crearRed([2, 24, 24, 4], { act: 'tanh', salida: 'lineal', semilla: o.semilla * 5 + 3, init: 'xavier' }), obj = crearRed([2, 24, 24, 4], { act: 'tanh', salida: 'lineal', semilla: 1 });
    fijar(obj, aplanar(red));
    const opt = optimizador('adam', { lr: o.lr }), mem = []; let pasos = 0, ep = 0, perdidas = [];
    const q = (r, i, j) => adelante(r, feats(i, j)).y;
    function entrenarLote() {
      if (!mem.length) return;
      let idx;
      const B = o.replay ? Math.min(o.lote, mem.length) : 1;
      if (!o.replay) idx = [mem.length - 1];
      else if (o.priorizado) { const p = mem.map((t) => (t.prio + 0.02) ** 0.6), z = p.reduce((s, v) => s + v, 0); idx = Array.from({ length: B }, () => { let u = rnd() * z, k = 0; while (k < p.length - 1 && u > p[k]) { u -= p[k]; k++; } return k; }); }
      else idx = Array.from({ length: B }, () => Math.floor(rnd() * mem.length));
      const P = o.priorizado ? mem.map((t) => (t.prio + 0.02) ** 0.6) : null, zP = P ? P.reduce((s, v) => s + v, 0) : 1;
      const lote = [], pesos = idx.map((k) => (P ? ((mem.length * P[k]) / zP) ** -0.4 : 1)), pm = Math.max(...pesos);
      let L = 0;
      idx.forEach((k, n) => {
        const t = mem[k], salida = q(red, t.s[0], t.s[1]), sig = t.fin ? 0 : Math.max(...q(o.objetivo ? obj : red, t.s2[0], t.s2[1])), tgt = t.r + o.gamma * sig, td = tgt - salida[t.a];
        t.prio = Math.abs(td); L += td * td; const y = salida.slice(); y[t.a] = salida[t.a] + (pesos[n] / pm) * td; lote.push({ x: feats(t.s[0], t.s[1]), y });
      });
      entrenarPaso(red, lote, opt); perdidas.push(L / idx.length);
    }
    function correr(tope = 40) {
      const eps = Math.max(o.epsFinal, o.epsInicial - ((o.epsInicial - o.epsFinal) * ep) / o.episodiosEps);
      let [i, j] = m.ini, G = 0, f = 1, t = 0; const ruta = [[i, j]]; perdidas = [];
      for (; t < tope && !m.terminal(i, j); t++) {
        const a = rnd() < eps ? Math.floor(rnd() * 4) : (() => { const v = q(red, i, j); return v.indexOf(Math.max(...v)); })();
        const tr = m.transiciones(i, j, a, o.pr); let u = rnd(), k = 0; while (k < tr.length - 1 && u > tr[k].p) { u -= tr[k].p; k++; }
        const s = tr[k], fin = m.terminal(s.i, s.j);
        mem.push({ s: [i, j], a, r: s.r, s2: [s.i, s.j], fin, prio: 1 }); if (mem.length > o.memoria) mem.shift();
        entrenarLote(); pasos++; if (o.objetivo && pasos % o.sincronizar === 0) fijar(obj, aplanar(red));
        G += f * s.r; f *= o.gamma; i = s.i; j = s.j; ruta.push([i, j]);
      }
      ep++;
      return { G, pasos: t, ruta, eps, perdida: perdidas.length ? perdidas.reduce((a, b) => a + b, 0) / perdidas.length : NaN, exito: m.mapa[i][j] === 'G' };
    }
    const politicaGreedy = () => { const P = new Array(m.n).fill(null); for (const [i, j] of estados(m)) { const v = q(red, i, j), a = v.indexOf(Math.max(...v)); P[celdaId(m, i, j)] = [0, 1, 2, 3].map((x) => (x === a ? 1 : 0)); } return P; };
    const Vred = () => { const V = new Float64Array(m.n); for (const [i, j] of estados(m)) V[celdaId(m, i, j)] = Math.max(...q(red, i, j)); return V; };
    return { red, q: (i, j) => q(red, i, j), correr, politicaGreedy, Vred, get episodios() { return ep; }, get pasos() { return pasos; }, get memoria() { return mem.length; }, datosMemoria: () => mem, prioridades: () => mem.map((t) => (t.prio + 0.02) ** 0.6), nParametros: nParametros([2, 24, 24, 4]) };
  }

  /* ---------- Gradiente de política (REINFORCE con línea base) sobre el mundo de rejilla ---------- */
  function agenteREINFORCE(m, op = {}) {
    const o = Object.assign({ gamma: 0.95, pr: 0, lr: 0.01, semilla: 1, base: true }, op), rnd = VIZ.semilla(o.semilla * 31 + 9);
    const feats = (i, j) => [i / Math.max(1, m.H - 1) * 2 - 1, j / Math.max(1, m.W - 1) * 2 - 1];
    const r = crearRed([2, 16, 4], { act: 'tanh', salida: 'softmax', semilla: o.semilla * 3 + 1 }), opt = optimizador('adam', { lr: o.lr });
    let linea = 0, ep = 0;
    const pi = (i, j) => adelante(r, feats(i, j)).y;
    function correr(tope = 40) {
      let [i, j] = m.ini; const trayecto = [];
      for (let t = 0; t < tope && !m.terminal(i, j); t++) {
        const p = pi(i, j); let u = rnd(), a = 0; while (a < 3 && u > p[a]) { u -= p[a]; a++; }
        const tr = m.transiciones(i, j, a, o.pr); let v = rnd(), k = 0; while (k < tr.length - 1 && v > tr[k].p) { v -= tr[k].p; k++; }
        trayecto.push({ s: [i, j], a, r: tr[k].r, p }); i = tr[k].i; j = tr[k].j;
      }
      const Gs = new Array(trayecto.length); let G = 0; for (let t = trayecto.length - 1; t >= 0; t--) { G = trayecto[t].r + o.gamma * G; Gs[t] = G; }
      const lote = trayecto.map((e, t) => { const A = Gs[t] - (o.base ? linea : 0), y = e.p.map((q, a) => q - A * (q - (a === e.a ? 1 : 0))); return { x: feats(e.s[0], e.s[1]), y }; });
      if (lote.length) entrenarPaso(r, lote, opt);
      const G0 = Gs.length ? Gs[0] : 0; linea = ep === 0 ? G0 : 0.95 * linea + 0.05 * G0; ep++;
      return { G: G0, pasos: trayecto.length, exito: m.mapa[i][j] === 'G', ruta: [m.ini, ...trayecto.map((e) => e.s)] };
    }
    const politica = () => { const P = new Array(m.n).fill(null); for (const [i, j] of estados(m)) P[celdaId(m, i, j)] = pi(i, j); return P; };
    return { correr, politica, pi, get episodios() { return ep; }, nParametros: nParametros([2, 16, 4]) };
  }

  VIZ.dl = {
    ACT, softmax, red, adelante, predecir, aplanar, fijar, nParametros, gradiente, OPTIMIZADORES, optimizador, entrenarPaso, pares, mezclar,
    IMAGENES, NOMBRES_IMAGEN, KERNELS, convolucion, pool, relu, tamSalida, mapa, diagramaRed, MAPAS, ACCIONES, mundo, entrenador, knn, logistica, acierto, SUP, cache, cnnPequena, muestraImagen, CLASES_OBJ, iou, escena, dibujarEscena, caja, recurrente, secuenciaMemoria, embeddings, transformerJuguete, celdaId, qDe, estados, barrido, politicaVoraz, valoresOptimos, politicaUniforme, dibujarMundo, episodio, agenteDQN, agenteREINFORCE,
  };
})();
