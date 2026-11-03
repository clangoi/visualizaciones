/* Sistemas de información (VIZ.si): series de tiempo y tablas de hechos simuladas, agregaciones tipo OLAP,
   finanzas de proyectos (VPN, TIR, retorno, plazo de recuperación), matriz de riesgo, disponibilidad,
   colas M/M/c, ruta crítica (CPM), sprints de Scrum y una cadena de suministro con efecto látigo. */
(function () {
  'use strict';
  const S = {};
  VIZ.si = S;

  /* ---------- Datos simulados ---------- */

  // Serie con tendencia, estacionalidad y ruido: base + tend·t + amp·sen(2πt/per) + ruido.
  S.serie = function (semilla, n, { base = 100, tend = 0.5, amp = 10, per = 12, ruido = 4 } = {}) {
    const rnd = VIZ.semilla(semilla), nor = () => VIZ.normal(rnd);
    return Array.from({ length: n }, (_, t) => base + tend * t + amp * Math.sin((2 * Math.PI * t) / per) + ruido * nor());
  };

  S.REGIONES = ['Norte', 'Centro', 'Sur'];
  S.PRODUCTOS = ['Equipos', 'Software', 'Servicios'];
  S.CANALES = ['Tienda', 'Web'];
  // Tabla de hechos de ventas: { mes (0..n−1), anio, trim, region, producto, canal, unidades, ingreso, costo }.
  S.ventas = function (semilla, meses = 24, porMes = 14) {
    const rnd = VIZ.semilla(semilla);
    const f = [];
    for (let m = 0; m < meses; m++) for (let k = 0; k < porMes; k++) {
      const region = S.REGIONES[Math.floor(rnd() * 3)], producto = S.PRODUCTOS[Math.floor(rnd() * 3)], canal = S.CANALES[rnd() < 0.4 + 0.01 * m ? 1 : 0];
      const precio = { Equipos: 900, Software: 300, Servicios: 500 }[producto] * (0.9 + 0.2 * rnd());
      const unidades = 1 + Math.floor(rnd() * 5 * (1 + 0.3 * Math.sin((2 * Math.PI * m) / 12) + 0.02 * m));
      f.push({ mes: m, anio: 2023 + Math.floor(m / 12), trim: 1 + Math.floor((m % 12) / 3), region, producto, canal, unidades, ingreso: unidades * precio, costo: unidades * precio * (0.55 + 0.1 * rnd()) });
    }
    return f;
  };
  // Agrupa filas por las dimensiones (lista de campos) y suma/cuenta la medida: [{ clave: [..], valor }].
  S.agrupar = function (filas, dims, medida = 'ingreso', agg = 'suma') {
    const m = new Map();
    for (const r of filas) {
      const k = dims.map((d) => r[d]);
      const id = k.join('\u0001');
      if (!m.has(id)) m.set(id, { clave: k, valor: 0, n: 0 });
      const g = m.get(id);
      g.valor += agg === 'cuenta' ? 1 : r[medida]; g.n++;
    }
    const out = [...m.values()];
    if (agg === 'media') out.forEach((g) => { g.valor /= g.n; });
    return out.sort((a, b) => (a.clave.join() < b.clave.join() ? -1 : 1));
  };
  // Tabla dinámica: filas × columnas con totales. Devuelve { filas, cols, celda(f, c), totalFila, totalCol, total }.
  S.pivot = function (datos, dimF, dimC, medida = 'ingreso') {
    const filas = [...new Set(datos.map((r) => r[dimF]))].sort(), cols = [...new Set(datos.map((r) => r[dimC]))].sort();
    const v = new Map();
    for (const r of datos) { const k = r[dimF] + '\u0001' + r[dimC]; v.set(k, (v.get(k) || 0) + r[medida]); }
    const celda = (f, c) => v.get(f + '\u0001' + c) || 0;
    const totalFila = (f) => cols.reduce((s, c) => s + celda(f, c), 0), totalCol = (c) => filas.reduce((s, f) => s + celda(f, c), 0);
    return { filas, cols, celda, totalFila, totalCol, total: filas.reduce((s, f) => s + totalFila(f), 0) };
  };

  /* ---------- Finanzas de proyectos ---------- */

  S.vpn = (flujos, tasa) => flujos.reduce((s, f, t) => s + f / (1 + tasa) ** t, 0); // flujos[0] en t = 0
  S.tir = function (flujos) {
    let lo = -0.99, hi = 10;
    if (S.vpn(flujos, lo) * S.vpn(flujos, hi) > 0) return NaN;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (S.vpn(flujos, lo) * S.vpn(flujos, mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  S.retorno = (inversion, beneficioTotal) => (beneficioTotal - inversion) / inversion;
  // Periodo (fraccional) en que el flujo acumulado se vuelve no negativo; null si nunca.
  S.recuperacion = function (flujos) {
    let acc = 0;
    for (let t = 0; t < flujos.length; t++) {
      const prev = acc; acc += flujos[t];
      if (acc >= 0 && t > 0) return t - 1 + (-prev) / flujos[t];
    }
    return null;
  };

  /* ---------- Riesgo y disponibilidad ---------- */

  // Matriz 5×5: probabilidad e impacto en 1..5 → puntaje y nivel.
  S.riesgo = function (prob, impacto) {
    const p = prob * impacto;
    return { puntaje: p, nivel: p >= 15 ? 'crítico' : p >= 8 ? 'alto' : p >= 4 ? 'medio' : 'bajo' };
  };
  S.dispSerie = (...a) => a.reduce((x, y) => x * y, 1); // componentes en serie
  S.dispParalelo = (...a) => 1 - a.reduce((x, y) => x * (1 - y), 1); // redundancia
  S.minutosCaidaAnual = (disp) => (1 - disp) * 365 * 24 * 60;

  // Cola M/M/c (Erlang C): λ llegadas/h, μ servicios/h por servidor, c servidores.
  S.cola = function (lambda, mu, c) {
    const a = lambda / mu, rho = a / c;
    if (lambda <= 0) return { rho: 0, estable: true, Pespera: 0, Lq: 0, Wq: 0, W: 1 / mu };
    if (rho >= 1) return { rho, estable: false, Pespera: 1, Wq: Infinity, Lq: Infinity, W: Infinity };
    let suma = 0, term = 1;
    for (let k = 0; k < c; k++) { if (k > 0) term *= a / k; suma += term; }
    const tc = (term * a / c) / (1 - rho);
    const Pespera = tc / (suma + tc), Lq = Pespera * rho / (1 - rho), Wq = Lq / lambda;
    return { rho, estable: true, Pespera, Lq, Wq, W: Wq + 1 / mu };
  };

  /* ---------- Planificación ---------- */

  // CPM: actividades [{ id, dur, pre: [ids] }] → mapa con es, ef, ls, lf, holgura, critica; y duración total.
  S.cpm = function (acts) {
    const m = new Map(acts.map((a) => [a.id, { ...a, es: 0, ef: 0 }]));
    const orden = [], vis = new Set();
    const dfs = (id) => { if (vis.has(id)) return; vis.add(id); m.get(id).pre.forEach(dfs); orden.push(id); };
    acts.forEach((a) => dfs(a.id));
    orden.forEach((id) => { const a = m.get(id); a.es = Math.max(0, ...a.pre.map((p) => m.get(p).ef)); a.ef = a.es + a.dur; });
    const total = Math.max(...[...m.values()].map((a) => a.ef));
    [...orden].reverse().forEach((id) => {
      const a = m.get(id), suc = [...m.values()].filter((b) => b.pre.includes(id));
      a.lf = suc.length ? Math.min(...suc.map((b) => b.ls)) : total; a.ls = a.lf - a.dur; a.holgura = a.ls - a.es; a.critica = Math.abs(a.holgura) < 1e-9;
    });
    return { acts: m, total, orden };
  };

  // Scrum: backlog de `puntos` con velocidad media v (± ruido) y cambios de alcance por sprint.
  S.sprints = function (semilla, puntos, v, { ruido = 0.2, alcance = 0, max = 30 } = {}) {
    const rnd = VIZ.semilla(semilla), nor = () => VIZ.normal(rnd);
    const h = [{ sprint: 0, restante: puntos, hecho: 0 }];
    let rest = puntos;
    for (let s = 1; s <= max && rest > 0.01; s++) {
      const hecho = Math.max(0, v * (1 + ruido * nor()));
      rest = Math.max(0, rest - hecho + alcance * (0.5 + rnd()));
      h.push({ sprint: s, restante: rest, hecho });
    }
    return h;
  };

  // Cadena de suministro de `etapas` niveles con política (S − Σ): el pedido de cada etapa amplifica la variabilidad.
  S.cadenaSuministro = function (semilla, etapas = 4, semanas = 40, { suavizado = 0.5, ruidoDemanda = 2 } = {}) {
    const rnd = VIZ.semilla(semilla), nor = () => VIZ.normal(rnd);
    const demanda = Array.from({ length: semanas }, () => Math.max(0, 10 + ruidoDemanda * nor()));
    const pedidos = [demanda];
    for (let e = 0; e < etapas; e++) {
      const entrada = pedidos[e], salida = [];
      let prom = entrada[0];
      for (let t = 0; t < semanas; t++) {
        prom = suavizado * entrada[t] + (1 - suavizado) * prom;
        const tendencia = t > 0 ? entrada[t] - prom : 0;
        salida.push(Math.max(0, entrada[t] + 1.5 * (entrada[t] - prom) + tendencia * 0.5));
      }
      pedidos.push(salida);
    }
    const desv = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
    return { pedidos, desv: pedidos.map(desv) };
  };
})();
