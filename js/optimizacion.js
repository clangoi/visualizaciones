/* Optimización (VIZ.opt): programación lineal en 2-D (semiplanos, polígono factible, vértices),
   Simplex en tableau paso a paso con duales, LP general por Big-M, ramificación y acotamiento,
   mochila, flujos en redes, derivadas numéricas, valores propios, Newton y un resolvedor
   de problemas restringidos por Lagrangiano aumentado con multiplicadores. */
(function () {
  'use strict';
  const O = {};
  VIZ.opt = O;
  const EPS = 1e-9;

  /* ---------- Geometría de LP en 2-D ---------- */

  // Restricción a·x ≤ b como { a: [a1, a2], b }. Recorta un polígono convexo con un semiplano.
  function recortar(poli, { a, b }) {
    const out = [];
    const d = (p) => a[0] * p[0] + a[1] * p[1] - b;
    for (let i = 0; i < poli.length; i++) {
      const p = poli[i], q = poli[(i + 1) % poli.length], dp = d(p), dq = d(q);
      if (dp <= EPS) out.push(p);
      if ((dp < -EPS && dq > EPS) || (dp > EPS && dq < -EPS)) {
        const t = dp / (dp - dq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }
  // Región factible { x : A x ≤ b } dentro de una caja grande; devuelve los vértices en orden.
  O.poligono = function (restr, caja = { xmin: -1e3, xmax: 1e3, ymin: -1e3, ymax: 1e3 }) {
    let poli = [[caja.xmin, caja.ymin], [caja.xmax, caja.ymin], [caja.xmax, caja.ymax], [caja.xmin, caja.ymax]];
    for (const r of restr) { poli = recortar(poli, r); if (!poli.length) break; }
    return poli;
  };
  // Vértice óptimo de max c·x sobre un polígono (null si está vacío).
  O.optimo2d = function (poli, c) {
    let mejor = null, z = -Infinity;
    for (const p of poli) { const v = c[0] * p[0] + c[1] * p[1]; if (v > z + EPS) { z = v; mejor = p; } }
    return mejor ? { x: mejor, z } : null;
  };

  /* ---------- Simplex en tableau, paso a paso ---------- */

  // max cᵀx  s.a.  A x ≤ b, x ≥ 0, con b ≥ 0. Generador de estados: cada yield es una iteración.
  // Estado: { T (filas: restricciones + fila z), base, entra, sale, razones, estado, x, z, duales }.
  // regla: 'dantzig' (mayor costo reducido) o 'bland' (menor índice, evita ciclaje).
  O.simplex = function (c, A, b, { regla = 'dantzig', maxIter = 50 } = {}) {
    const m = A.length, n = c.length;
    const T = A.map((f, i) => [...f, ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)), b[i]]);
    T.push([...c.map((v) => -v), ...Array(m).fill(0), 0]);
    const base = Array.from({ length: m }, (_, i) => n + i);
    const nombres = [...c.map((_, i) => 'x' + (i + 1)), ...A.map((_, i) => 's' + (i + 1))];
    const copia = () => T.map((f) => f.slice());
    const solucion = () => {
      const x = Array(n + m).fill(0);
      base.forEach((v, i) => { x[v] = T[i][n + m]; });
      return x;
    };
    const duales = () => Array.from({ length: m }, (_, i) => T[m][n + i]);
    function* gen() {
      for (let it = 0; it <= maxIter; it++) {
        let entra = -1;
        if (regla === 'bland') { for (let j = 0; j < n + m; j++) if (T[m][j] < -EPS) { entra = j; break; } }
        else { let mn = -EPS; for (let j = 0; j < n + m; j++) if (T[m][j] < mn) { mn = T[m][j]; entra = j; } }
        const base0 = { T: copia(), base: base.slice(), nombres, it, x: solucion().slice(0, n), z: T[m][n + m], duales: duales() };
        if (entra < 0) { yield { ...base0, estado: 'optimo', entra: -1, sale: -1, razones: [] }; return; }
        const razones = T.slice(0, m).map((f) => (f[entra] > EPS ? f[n + m] / f[entra] : Infinity));
        let sale = -1, mr = Infinity;
        razones.forEach((r, i) => { if (r < mr - EPS || (Math.abs(r - mr) <= EPS && sale >= 0 && base[i] < base[sale])) { mr = r; sale = i; } });
        if (sale < 0) { yield { ...base0, estado: 'noacotado', entra, sale: -1, razones }; return; }
        yield { ...base0, estado: 'iterando', entra, sale, razones };
        const p = T[sale][entra];
        T[sale] = T[sale].map((v) => v / p);
        for (let i = 0; i <= m; i++) {
          if (i === sale) continue;
          const f = T[i][entra];
          if (Math.abs(f) > 0) T[i] = T[i].map((v, j) => v - f * T[sale][j]);
        }
        base[sale] = entra;
      }
      yield { T: copia(), base: base.slice(), nombres, it: maxIter, x: solucion().slice(0, n), z: T[m][n + m], duales: duales(), estado: 'ciclaje', entra: -1, sale: -1, razones: [] };
    }
    return gen();
  };

  /* ---------- LP general por Big-M (≤, ≥, =), para ramificación y acotamiento ---------- */

  // max/min cᵀx  s.a.  A x (sentidos[i]) b, l ≤ x ≤ u (por defecto x ≥ 0). Devuelve { estado, x, z }.
  O.lp = function (c, A, sentidos, b, { max = true, cotas } = {}) {
    const n = c.length;
    const filas = A.map((f) => f.slice()), sen = sentidos.slice(), rhs = b.slice();
    if (cotas) cotas.forEach(([lo, hi], j) => {
      if (hi !== undefined && hi !== Infinity) { const f = Array(n).fill(0); f[j] = 1; filas.push(f); sen.push('<='); rhs.push(hi); }
      if (lo !== undefined && lo > 0) { const f = Array(n).fill(0); f[j] = 1; filas.push(f); sen.push('>='); rhs.push(lo); }
    });
    const m = filas.length, M = 1e6;
    filas.forEach((f, i) => { if (rhs[i] < 0) { filas[i] = f.map((v) => -v); rhs[i] = -rhs[i]; sen[i] = sen[i] === '<=' ? '>=' : sen[i] === '>=' ? '<=' : '='; } });
    const cols = n + m + m;
    const T = filas.map((f, i) => {
      const r = Array(cols + 1).fill(0);
      f.forEach((v, j) => { r[j] = v; });
      if (sen[i] === '<=') r[n + i] = 1; else if (sen[i] === '>=') r[n + i] = -1;
      if (sen[i] !== '<=') r[n + m + i] = 1;
      r[cols] = rhs[i];
      return r;
    });
    const costo = Array(cols).fill(0);
    c.forEach((v, j) => { costo[j] = max ? v : -v; });
    const base = filas.map((_, i) => (sen[i] === '<=' ? n + i : n + m + i));
    filas.forEach((_, i) => { if (sen[i] !== '<=') costo[n + m + i] = -M; });
    const z = Array(cols + 1).fill(0);
    costo.forEach((v, j) => { z[j] = -v; });
    T.push(z);
    base.forEach((v, i) => { if (Math.abs(z[v]) > 0) { const f = z[v]; for (let j = 0; j <= cols; j++) T[m][j] -= f * T[i][j]; } });
    for (let it = 0; it < 500; it++) {
      let e = -1;
      for (let j = 0; j < cols; j++) if (T[m][j] < -1e-7) { e = j; break; }
      if (e < 0) break;
      let s = -1, mr = Infinity;
      for (let i = 0; i < m; i++) if (T[i][e] > EPS) { const r = T[i][cols] / T[i][e]; if (r < mr - EPS) { mr = r; s = i; } }
      if (s < 0) {
        // Con una artificial aún positiva el rayo no prueba que el original sea no acotado: es infactible.
        const artificial = base.some((v, i) => v >= n + m && T[i][cols] > 1e-6);
        return { estado: artificial ? 'infactible' : 'noacotado' };
      }
      const p = T[s][e];
      T[s] = T[s].map((v) => v / p);
      for (let i = 0; i <= m; i++) if (i !== s && T[i][e] !== 0) { const f = T[i][e]; T[i] = T[i].map((v, j) => v - f * T[s][j]); }
      base[s] = e;
    }
    const x = Array(n).fill(0);
    let infact = false;
    base.forEach((v, i) => { if (v < n) x[v] = T[i][cols]; else if (v >= n + m && T[i][cols] > 1e-6) infact = true; });
    if (infact) return { estado: 'infactible' };
    const zv = c.reduce((s, v, j) => s + v * x[j], 0);
    return { estado: 'optimo', x, z: zv };
  };

  /* ---------- Ramificación y acotamiento (maximizar, variables enteras) ---------- */

  // Árbol de B&B con selección de nodo 'profundidad' o 'mejor' y ramificación 'fraccion' o 'primera'.
  // Devuelve un generador de pasos: { nodos, actual, incumbente, ... }.
  O.ramificar = function (c, A, sentidos, b, { seleccion = 'mejor', ramificacion = 'fraccion', maxNodos = 200, enteras } = {}) {
    const n = c.length;
    const ent = enteras || Array(n).fill(true);
    const nodos = [];
    let inc = null, pila = [];
    const crear = (padre, cotas, rama) => {
      const r = O.lp(c, A, sentidos, b, { cotas });
      const nodo = { id: nodos.length, padre, cotas, rama, estado: r.estado, x: r.x, z: r.z, hijos: [], poda: null };
      nodos.push(nodo);
      return nodo;
    };
    function* gen() {
      const raiz = crear(-1, Array.from({ length: n }, () => [0, Infinity]), '');
      pila.push(raiz);
      yield { nodos, actual: raiz, incumbente: inc, cota: raiz.z, accion: 'raiz' };
      while (pila.length && nodos.length < maxNodos) {
        const abiertos = pila.filter((nd) => nd.estado === 'optimo');
        let nodo;
        if (seleccion === 'mejor') { nodo = pila.reduce((a, bq) => ((bq.z ?? -Infinity) > (a.z ?? -Infinity) ? bq : a)); }
        else nodo = pila[pila.length - 1];
        pila = pila.filter((q) => q !== nodo);
        void abiertos;
        if (nodo.estado !== 'optimo') { nodo.poda = 'infactibilidad'; yield { nodos, actual: nodo, incumbente: inc, accion: 'poda-infactible' }; continue; }
        if (inc && nodo.z <= inc.z + 1e-7) { nodo.poda = 'cota'; yield { nodos, actual: nodo, incumbente: inc, accion: 'poda-cota' }; continue; }
        const frac = nodo.x.map((v, j) => (ent[j] ? Math.abs(v - Math.round(v)) : 0));
        let j = -1;
        if (ramificacion === 'primera') j = frac.findIndex((f) => f > 1e-6);
        else { let mx = 1e-6; frac.forEach((f, k) => { if (f > mx) { mx = f; j = k; } }); }
        if (j < 0) { nodo.poda = 'entera'; if (!inc || nodo.z > inc.z) inc = { x: nodo.x.map((v) => Math.round(v * 1e6) / 1e6), z: nodo.z, nodo: nodo.id }; yield { nodos, actual: nodo, incumbente: inc, accion: 'incumbente' }; continue; }
        const v = nodo.x[j];
        const abajo = nodo.cotas.map((q) => q.slice()), arriba = nodo.cotas.map((q) => q.slice());
        abajo[j][1] = Math.floor(v); arriba[j][0] = Math.ceil(v);
        const h1 = crear(nodo.id, abajo, `x${j + 1} ≤ ${Math.floor(v)}`), h2 = crear(nodo.id, arriba, `x${j + 1} ≥ ${Math.ceil(v)}`);
        nodo.hijos = [h1.id, h2.id]; nodo.ramaVar = j;
        pila.push(h1, h2);
        yield { nodos, actual: nodo, incumbente: inc, accion: 'ramifica', variable: j };
      }
      yield { nodos, actual: null, incumbente: inc, accion: 'fin' };
    }
    return gen();
  };

  /* ---------- Mochila ---------- */

  // Programación dinámica 0/1: tabla V[i][w] y objetos elegidos.
  O.mochila = function (valores, pesos, cap) {
    const n = valores.length;
    const V = Array.from({ length: n + 1 }, () => Array(cap + 1).fill(0));
    for (let i = 1; i <= n; i++) for (let w = 0; w <= cap; w++) {
      V[i][w] = V[i - 1][w];
      if (pesos[i - 1] <= w) V[i][w] = Math.max(V[i][w], V[i - 1][w - pesos[i - 1]] + valores[i - 1]);
    }
    const elegidos = [];
    for (let i = n, w = cap; i > 0; i--) if (V[i][w] !== V[i - 1][w]) { elegidos.push(i - 1); w -= pesos[i - 1]; }
    return { V, valor: V[n][cap], elegidos: elegidos.reverse() };
  };
  // Cota de la relajación lineal (mochila fraccionaria) con objetos ordenados por valor/peso.
  O.mochilaFraccionaria = function (valores, pesos, cap) {
    const idx = valores.map((_, i) => i).sort((a, b) => valores[b] / pesos[b] - valores[a] / pesos[a]);
    let rest = cap, z = 0;
    const x = Array(valores.length).fill(0);
    for (const i of idx) { const t = Math.min(1, rest / pesos[i]); x[i] = t; z += t * valores[i]; rest -= t * pesos[i]; if (rest <= 0) break; }
    return { x, z, orden: idx };
  };

  /* ---------- Flujos en redes ---------- */

  // Arcos: [{ de, a, cap, costo }]. Flujo máximo (Edmonds–Karp); devuelve flujo por arco y el corte mínimo.
  O.flujoMaximo = function (nNodos, arcos, s, t) {
    const res = [];
    const ady = Array.from({ length: nNodos }, () => []);
    arcos.forEach((e, i) => {
      ady[e.de].push(res.length); res.push({ a: e.a, cap: e.cap, arco: i, dir: 1 });
      ady[e.a].push(res.length); res.push({ a: e.de, cap: 0, arco: i, dir: -1 });
    });
    let total = 0;
    const caminos = [];
    for (;;) {
      const prev = Array(nNodos).fill(-1), vis = Array(nNodos).fill(false);
      vis[s] = true;
      const cola = [s];
      while (cola.length && !vis[t]) {
        const u = cola.shift();
        for (const id of ady[u]) if (res[id].cap > EPS && !vis[res[id].a]) { vis[res[id].a] = true; prev[res[id].a] = id; cola.push(res[id].a); }
      }
      if (!vis[t]) {
        return { valor: total, flujo: arcos.map((e, i) => { const r = res.find((q) => q.arco === i && q.dir === 1); return e.cap - r.cap; }), corte: vis.map((v, i) => (v ? i : -1)).filter((i) => i >= 0), caminos };
      }
      let f = Infinity;
      const ruta = [];
      for (let v = t; v !== s; v = res[prev[v] ^ 1].a) { f = Math.min(f, res[prev[v]].cap); ruta.push(v); }
      for (let v = t; v !== s; v = res[prev[v] ^ 1].a) { res[prev[v]].cap -= f; res[prev[v] ^ 1].cap += f; }
      ruta.push(s);
      caminos.push({ ruta: ruta.reverse(), f });
      total += f;
    }
  };
  // Flujo de costo mínimo de `valor` unidades de s a t (caminos mínimos sucesivos con Bellman–Ford).
  O.flujoCostoMinimo = function (nNodos, arcos, s, t, valor) {
    const res = [];
    arcos.forEach((e, i) => {
      res.push({ de: e.de, a: e.a, cap: e.cap, costo: e.costo, arco: i, dir: 1 });
      res.push({ de: e.a, a: e.de, cap: 0, costo: -e.costo, arco: i, dir: -1 });
    });
    let enviado = 0, costoTotal = 0;
    const pasos = [];
    while (enviado < valor) {
      const d = Array(nNodos).fill(Infinity), prev = Array(nNodos).fill(-1);
      d[s] = 0;
      for (let k = 0; k < nNodos; k++) {
        let cambio = false;
        res.forEach((r, id) => { if (r.cap > EPS && d[r.de] + r.costo < d[r.a] - EPS) { d[r.a] = d[r.de] + r.costo; prev[r.a] = id; cambio = true; } });
        if (!cambio) break;
      }
      if (d[t] === Infinity) break;
      let f = valor - enviado;
      for (let v = t; v !== s; v = res[prev[v]].de) f = Math.min(f, res[prev[v]].cap);
      const ruta = [t];
      for (let v = t; v !== s; v = res[prev[v]].de) { res[prev[v]].cap -= f; res[prev[v] ^ 1].cap += f; ruta.push(res[prev[v]].de); }
      enviado += f; costoTotal += f * d[t];
      pasos.push({ ruta: ruta.reverse(), f, costoUnitario: d[t] });
    }
    return { enviado, costo: costoTotal, pasos, flujo: arcos.map((e, i) => res[2 * i + 1].cap) };
  };

  /* ---------- Cálculo numérico para optimización no lineal ---------- */

  O.grad = function (f, x, h = 1e-5) {
    return x.map((_, i) => { const a = x.slice(), b = x.slice(); a[i] += h; b[i] -= h; return (f(a) - f(b)) / (2 * h); });
  };
  O.hess = function (f, x, h = 1e-4) {
    const n = x.length, H = Array.from({ length: n }, () => Array(n).fill(0));
    const f0 = f(x);
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
      const p = (di, dj) => { const y = x.slice(); y[i] += di; y[j] += dj; return f(y); };
      H[i][j] = H[j][i] = i === j ? (p(h, 0) - 2 * f0 + p(-h, 0)) / (h * h) : (p(h, h) - p(h, -h) - p(-h, h) + p(-h, -h)) / (4 * h * h);
    }
    return H;
  };
  // Valores propios de una matriz simétrica (Jacobi); devuelve [{ valor, vector }] de menor a mayor.
  O.propios = function (S) {
    const n = S.length;
    const A = S.map((f) => f.slice());
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let it = 0; it < 60; it++) {
      let p = 0, q = 1, mx = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(A[i][j]) > mx) { mx = Math.abs(A[i][j]); p = i; q = j; }
      if (mx < 1e-12) break;
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), co = Math.cos(th), si = Math.sin(th);
      for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = co * a - si * b; A[k][q] = si * a + co * b; }
      for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = co * a - si * b; A[q][k] = si * a + co * b; }
      for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = co * a - si * b; V[k][q] = si * a + co * b; }
    }
    return A.map((f, i) => ({ valor: f[i], vector: V.map((r) => r[i]) })).sort((a, b) => a.valor - b.valor);
  };
  // Resuelve H d = −g (n pequeño) por eliminación gaussiana; null si es singular.
  O.resolver = function (M, v) {
    const n = v.length, A = M.map((f, i) => [...f, v[i]]);
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      if (Math.abs(A[p][i]) < 1e-12) return null;
      [A[i], A[p]] = [A[p], A[i]];
      for (let r = 0; r < n; r++) if (r !== i) { const k = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= k * A[i][c]; }
    }
    return A.map((f, i) => f[n] / f[i]);
  };
  // Un paso de Newton puro: x − H⁻¹ ∇f.
  O.newton = function (f, x) {
    const g = O.grad(f, x), H = O.hess(f, x), d = O.resolver(H, g.map((v) => -v));
    return d ? x.map((v, i) => v + d[i]) : null;
  };
  // Clasifica un punto estacionario por los valores propios de la Hessiana.
  O.clasificar = function (H) {
    const ev = O.propios(H).map((q) => q.valor);
    if (ev.every((v) => v > 1e-6)) return 'mínimo local';
    if (ev.every((v) => v < -1e-6)) return 'máximo local';
    if (ev.some((v) => v > 1e-6) && ev.some((v) => v < -1e-6)) return 'punto de silla';
    return 'indeterminado';
  };

  /* ---------- Problemas restringidos: Lagrangiano aumentado ---------- */

  // Nelder–Mead sin restricciones (para el subproblema); devuelve el mínimo aproximado.
  O.nelderMead = function (f, x0, { paso = 0.5, iter = 400 } = {}) {
    const n = x0.length;
    let S = [x0.slice(), ...x0.map((_, i) => { const p = x0.slice(); p[i] += paso; return p; })].map((p) => ({ p, v: f(p) }));
    for (let k = 0; k < iter; k++) {
      S.sort((a, b) => a.v - b.v);
      const c = Array(n).fill(0);
      S.slice(0, n).forEach((s) => s.p.forEach((v, i) => { c[i] += v / n; }));
      const w = S[n], mk = (t) => c.map((v, i) => v + t * (w.p[i] - v));
      const r = mk(-1), fr = f(r);
      if (fr < S[0].v) { const e = mk(-2), fe = f(e); S[n] = fe < fr ? { p: e, v: fe } : { p: r, v: fr }; }
      else if (fr < S[n - 1].v) S[n] = { p: r, v: fr };
      else {
        const q = mk(fr < w.v ? -0.5 : 0.5), fq = f(q);
        if (fq < Math.min(fr, w.v)) S[n] = { p: q, v: fq };
        else S = S.map((s, i) => (i === 0 ? s : { p: s.p.map((v, j) => S[0].p[j] + 0.5 * (v - S[0].p[j])), v: f(s.p.map((v, j) => S[0].p[j] + 0.5 * (v - S[0].p[j]))) }));
      }
    }
    S.sort((a, b) => a.v - b.v);
    return S[0].p;
  };
  // min f(x)  s.a.  h_i(x) = 0,  g_j(x) ≤ 0. Devuelve { x, lambda (igualdades), mu (desigualdades), iteraciones }.
  O.restringido = function (f, hs, gs, x0, { rho = 10, externas = 12 } = {}) {
    let x = x0.slice(), lam = hs.map(() => 0), mu = gs.map(() => 0);
    const trayectoria = [x.slice()];
    for (let k = 0; k < externas; k++) {
      const L = (y) => f(y) + hs.reduce((s, h, i) => s + lam[i] * h(y) + 0.5 * rho * h(y) ** 2, 0)
        + gs.reduce((s, g, j) => s + (Math.max(0, mu[j] + rho * g(y)) ** 2 - mu[j] ** 2) / (2 * rho), 0);
      x = O.nelderMead(L, x, { paso: 0.3 / (1 + k * 0.3), iter: 500 });
      hs.forEach((h, i) => { lam[i] += rho * h(x); });
      gs.forEach((g, j) => { mu[j] = Math.max(0, mu[j] + rho * g(x)); });
      trayectoria.push(x.slice());
    }
    return { x, lambda: lam, mu, trayectoria };
  };
})();
