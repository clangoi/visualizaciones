(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Motor de bases (propio de este archivo) ----------
     max cᵀx  s.a.  A x ≤ b, x ≥ 0. Se enumeran todas las bases del sistema con holguras:
     para cada una se calcula B⁻¹, B⁻¹[A I], x_B = B⁻¹b, costos reducidos d = c − c_B B⁻¹[A I] y precios y = c_B B⁻¹. */
  const EPS = 1e-9;
  const sub = (s) => String(s).replace(/[0-9]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  function motor(c, A, b) {
    const m = A.length, n = c.length, cols = n + m;
    const K = Array.from({ length: cols }, (_, j) => (j < n ? A.map((f) => f[j]) : A.map((_, i) => (i === j - n ? 1 : 0))));
    const nombres = [...c.map((_, i) => 'x' + (i + 1)), ...A.map((_, i) => 's' + (i + 1))];
    const cext = [...c, ...Array(m).fill(0)];
    const bases = [];
    const comb = (ini, ac) => {
      if (ac.length === m) { evaluar(ac.slice()); return; }
      for (let j = ini; j < cols; j++) { ac.push(j); comb(j + 1, ac); ac.pop(); }
    };
    function evaluar(idx) {
      const B = Array.from({ length: m }, (_, i) => idx.map((j) => K[j][i]));
      const inv = Array.from({ length: m }, () => Array(m).fill(0));
      for (let k = 0; k < m; k++) {
        const e = Array(m).fill(0); e[k] = 1;
        const s = VIZ.opt.resolver(B, e);
        if (!s) return;
        s.forEach((v, i) => { inv[i][k] = v; });
      }
      const N = inv.map((f) => K.map((col) => f.reduce((s, v, i) => s + v * col[i], 0)));
      const xB = inv.map((f) => f.reduce((s, v, i) => s + v * b[i], 0));
      const cB = idx.map((j) => cext[j]);
      const d = cext.map((cj, j) => cj - cB.reduce((s, v, r) => s + v * N[r][j], 0));
      const y = Array.from({ length: m }, (_, i) => -d[n + i] || 0);
      bases.push({ idx, inv, N, xB, d, y, z: cB.reduce((s, v, r) => s + v * xB[r], 0) });
    }
    comb(0, []);
    return { m, n, cols, K, nombres, cext, bases };
  }
  const primalOk = (B, tol = 1e-9) => B.xB.every((v) => v >= -tol);
  const dualOk = (B, tol = 1e-9) => B.d.every((v) => v <= tol);
  const optima = (M) => M.bases.find((q) => primalOk(q) && dualOk(q)) || null;
  const claveBase = (B) => B.idx.slice().sort((a, b) => a - b).join();
  const etiquetaBase = (M, B) => '{' + B.idx.slice().sort((a, b) => a - b).map((j) => sub(M.nombres[j])).join(', ') + '}';
  function solucion(M, B) {
    const x = Array(M.cols).fill(0);
    B.idx.forEach((j, r) => { x[j] = B.xB[r]; });
    return x;
  }
  // Cuánto puede cambiar c_j (Δ) sin que la base B deje de ser óptima: [Δmín, Δmáx].
  function rangoCosto(M, B, j) {
    const r = B.idx.indexOf(j);
    if (r < 0) return [-Infinity, -B.d[j]];
    let lo = -Infinity, hi = Infinity;
    for (let k = 0; k < M.cols; k++) {
      if (B.idx.includes(k)) continue;
      const a = B.N[r][k];
      if (a > EPS) lo = Math.max(lo, B.d[k] / a);
      else if (a < -EPS) hi = Math.min(hi, B.d[k] / a);
    }
    return [lo, hi];
  }
  // Cuánto puede cambiar b_i (Δ) sin que B⁻¹b deje de ser ≥ 0: [Δmín, Δmáx].
  function rangoB(B, i) {
    let lo = -Infinity, hi = Infinity;
    B.inv.forEach((f, r) => {
      const beta = f[i];
      if (beta > EPS) lo = Math.max(lo, -B.xB[r] / beta);
      else if (beta < -EPS) hi = Math.min(hi, -B.xB[r] / beta);
    });
    return [lo, hi];
  }
  const intervalo = (a, b) => `[${VIZ.fmt(a)}, ${VIZ.fmt(b)}]`;

  /* ---------- Geometría 2-D ---------- */

  const poligono = (A, b) => {
    const p = VIZ.opt.poligono(A.map((a, i) => ({ a, b: b[i] })), { xmin: 0, xmax: 1e3, ymin: 0, ymax: 1e3 });
    return p.filter((q, i) => p.findIndex((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1e-7) === i);
  };
  // Plano con la misma escala en ambos ejes (para que las normales se vean perpendiculares).
  function planoIgual(l, ymax, extra = {}) {
    const m = { izq: 40, der: 12, sup: 20, inf: 36 };
    const xmax = (ymax * (l.ancho - m.izq - m.der)) / (l.alto - m.sup - m.inf);
    return VIZ.plano(l, { xmin: 0, xmax, ymin: 0, ymax }, { margen: m, etiquetaX: 'x₁', etiquetaY: 'x₂', ...extra });
  }
  const altoIgual = (ymax, xmaxMin) => (w) => Math.round(Math.min(520, Math.max(300, 56 + ((w - 52) * ymax) / xmaxMin)));
  // Recta a·x = b recortada al plano.
  function recta(ctx, pl, a, b, color, ancho = 1.5, guiones) {
    const { xmin, xmax, ymin, ymax } = pl.d;
    let p, q;
    if (Math.abs(a[1]) > EPS) { p = [xmin, (b - a[0] * xmin) / a[1]]; q = [xmax, (b - a[0] * xmax) / a[1]]; }
    else { p = [b / a[0], ymin]; q = [b / a[0], ymax]; }
    ctx.save();
    pl.recortar();
    ctx.strokeStyle = color; ctx.lineWidth = ancho;
    if (guiones) ctx.setLineDash(guiones);
    ctx.beginPath(); ctx.moveTo(pl.sx(p[0]), pl.sy(p[1])); ctx.lineTo(pl.sx(q[0]), pl.sy(q[1])); ctx.stroke();
    ctx.restore();
  }
  function flecha(ctx, x0, y0, x1, y1, color, ancho = 2) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 2) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, h = Math.min(9, L * 0.5);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * h * 0.6, y1 - uy * h * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * h - uy * h * 0.45, y1 - uy * h + ux * h * 0.45);
    ctx.lineTo(x1 - ux * h + uy * h * 0.45, y1 - uy * h - ux * h * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function rellenar(ctx, pl, poli, color) {
    if (poli.length < 3) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y))));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function texto(ctx, s, x, y, color, alin = 'left', base = 'middle', px = 11) {
    ctx.save();
    ctx.font = VIZ.fuente(px); ctx.fillStyle = color; ctx.textAlign = alin; ctx.textBaseline = base;
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  // Problema común: max 3x₁ + 2x₂ con tres recursos.
  const C0 = [3, 2];
  const A0 = [[2, 1], [1, 2], [1, 0]];
  const B0 = [16, 14, 7];
  const RECURSOS = ['Horas de máquina', 'Horas de ensamble', 'Cupo de x₁'];
  const COL = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s6, C.s7, C.s8];
  const M0 = motor(C0, A0, B0), BO = optima(M0), X0 = solucion(M0, BO), KEY0 = claveBase(BO);
  const SEN = ['<=', '<=', '<='];

  // Ruido normal estándar (recortado a ±3) para c, A y b de cada escenario; σ lo escala después.
  function generar(semilla, N) {
    const rnd = VIZ.semilla(semilla);
    const g = () => Math.max(-3, Math.min(3, VIZ.normal(rnd)));
    return Array.from({ length: N }, () => ({ c: C0.map(g), A: A0.map((f) => f.map(g)), b: B0.map(g) }));
  }
  function aplicar(e, sigma, flags) {
    const f = (z, activo) => (activo ? Math.max(0.2, 1 + sigma * z) : 1);
    return { c: C0.map((v, j) => v * f(e.c[j], flags.c)), A: A0.map((r, i) => r.map((v, j) => v * f(e.A[i][j], flags.A))), b: B0.map((v, i) => v * f(e.b[i], flags.b)) };
  }
  function resolverEsc(d) {
    const r = VIZ.opt.lp(d.c, d.A, SEN, d.b);
    const B = optima(motor(d.c, d.A, d.b));
    return { x: r.x, z: r.z, key: B ? claveBase(B) : '?', datos: d };
  }
  const media = (v) => v.reduce((s, q) => s + q, 0) / (v.length || 1);
  const desv = (v) => { const m = media(v); return Math.sqrt(media(v.map((q) => (q - m) ** 2))); };
  const cuantil = (v, p) => { if (!v.length) return NaN; const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const pct = (v) => `${(100 * v).toFixed(v < 0.1 ? 1 : 0)} %`;

  /* ---------- Fig. 1: nube de soluciones óptimas bajo perturbaciones ---------- */

  function montarNube(cuerpo) {
    let sigma = 0.1, N = 200, semilla = 1, vistos = 0, res = [], base = [], pl = null, hover = null;
    const idxColor = new Map([[KEY0, 0]]);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Perturbación σ (relativa)', min: 0, max: 0.3, paso: 0.01, valor: sigma, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sigma = v; calcular(); } });
    ctl.rango({ etiqueta: 'Escenarios N', min: 50, max: 500, paso: 10, valor: N, alCambiar: (v) => { N = v; base = generar(semilla, N); calcular(); } });
    const flags = ctl.casillas([{ clave: 'c', texto: 'costos c' }, { clave: 'A', texto: 'consumos A' }, { clave: 'b', texto: 'recursos b' }], () => calcular());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { semilla++; base = generar(semilla, N); calcular(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoIgual(10, 12) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es la solución óptima de una versión perturbada del problema (color y forma según su base). Suba σ y observe cómo la nube se ensancha y aparecen nuevas bases; con Reproducir se agregan escenarios de a diez.');

    function iniciar() {
      vistos = 0;
      return (function* () { while (vistos < N) { vistos = Math.min(N, vistos + 10); yield; } })();
    }
    function calcular() {
      res = base.map((e) => resolverEsc(aplicar(e, sigma, flags)));
      res.forEach((r) => { if (!idxColor.has(r.key)) idxColor.set(r.key, idxColor.size); });
      vistos = N;
      dibujar();
    }
    const col = (k) => COL[(idxColor.get(k) ?? 7) % 8];
    function dibujar() {
      const { ctx } = lienzo, vs = res.slice(0, vistos);
      lienzo.limpiar();
      pl = planoIgual(lienzo, 10);
      pl.ejes();
      const poli = poligono(A0, B0);
      ctx.save(); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); poli.forEach(([x, y], i) => (i ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y)))); ctx.closePath(); ctx.stroke(); ctx.restore();
      vs.forEach((r) => { if (r.x) VIZ.marcador(ctx, pl.sx(r.x[0]), pl.sy(r.x[1]), col(r.key), 3.6, idxColor.get(r.key) ?? 0); });
      VIZ.marcador(ctx, pl.sx(X0[0]), pl.sy(X0[1]), C.tinta, 6);
      texto(ctx, `nominal (${VIZ.fmt(X0[0])}, ${VIZ.fmt(X0[1])})`, pl.sx(X0[0]) - 10, pl.sy(X0[1]) - 12, C.tinta, 'right', 'bottom', 12);
      if (hover != null && hover < vistos && res[hover].x) VIZ.marcador(ctx, pl.sx(res[hover].x[0]), pl.sy(res[hover].x[1]), C.tinta, 5.5);
      const claves = [...idxColor.keys()].filter((k) => vs.some((r) => r.key === k));
      const frec = (k) => vs.filter((r) => r.key === k).length / (vs.length || 1);
      leyenda.set([
        ...claves.sort((a, b) => frec(b) - frec(a)).map((k) => ({ color: col(k), texto: `base {${k.split(',').map((j) => sub(M0.nombres[+j])).join(', ')}}${k === KEY0 ? ' (nominal)' : ''} · ${pct(frec(k))}` })),
        { color: C.tinta, texto: 'solución nominal', forma: 'punto' },
        { color: C.tinta2, texto: 'región factible nominal', forma: 'linea' },
      ]);
      const zs = vs.filter((r) => Number.isFinite(r.z)).map((r) => r.z);
      const igual = vs.filter((r) => r.key === KEY0).length / (vs.length || 1);
      registro.textContent = vs.length
        ? `Con σ = ${Math.round(sigma * 100)} % en ${['costos', 'consumos', 'recursos'].filter((_, i) => flags[['c', 'A', 'b'][i]]).join(', ') || 'ningún dato'}, ${pct(igual)} de los ${vs.length} escenarios conserva la base nominal; aparecen ${claves.length} bases distintas y z* varía entre ${VIZ.fmt(Math.min(...zs))} y ${VIZ.fmt(Math.max(...zs))}.`
        : 'Pulse Un paso para agregar los primeros diez escenarios.';
      lectura.set([
        ['escenarios', `${vs.length} de ${N}`],
        ['con la base nominal', pct(igual)],
        ['bases distintas', String(claves.length)],
        ['z* nominal', VIZ.fmt(BO.z)],
        ['z* media ± desv.', zs.length ? `${VIZ.fmt(media(zs))} ± ${VIZ.fmt(desv(zs))}` : '—'],
        ['z* peor / mejor', zs.length ? `${VIZ.fmt(Math.min(...zs))} / ${VIZ.fmt(Math.max(...zs))}` : '—'],
      ]);
    }
    lienzo.alDibujar = () => res.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      let mejor = null, md = 12;
      res.slice(0, vistos).forEach((r, k) => { if (!r.x) return; const d = Math.hypot(pl.sx(r.x[0]) - x, pl.sy(r.x[1]) - y); if (d < md) { md = d; mejor = k; } });
      hover = mejor;
      dibujar();
      if (mejor == null) return tip.ocultar();
      const r = res[mejor];
      tip.mostrar(x, y, `escenario <b>${mejor + 1}</b><br>x* = (<b>${VIZ.fmt(r.x[0])}</b>, <b>${VIZ.fmt(r.x[1])}</b>)<br>z* = <b>${VIZ.fmt(r.z)}</b><br>base <b>{${r.key.split(',').map((j) => sub(M0.nombres[+j])).join(', ')}}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    base = generar(semilla, N);
    calcular();
  }

  /* ---------- Fig. 2: decisión fija con colchón frente a reoptimizar ---------- */

  function montarColchon(cuerpo) {
    let sigma = 0.1, rho = 0.1, N = 300, semilla = 1, base = [], hover = null, pl = null, d = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Perturbación σ', min: 0.01, max: 0.3, paso: 0.01, valor: sigma, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sigma = v; calcular(); } });
    ctl.rango({ etiqueta: 'Colchón ρ en los recursos', min: 0, max: 0.4, paso: 0.01, valor: rho, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { rho = v; calcular(); } });
    ctl.rango({ etiqueta: 'Escenarios N', min: 100, max: 500, paso: 10, valor: N, alCambiar: (v) => { N = v; base = generar(semilla, N); calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; base = generar(semilla, N); calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'reoptimizar con los datos reales (z*)' },
      { color: C.s2, texto: 'mantener la decisión con colchón (utilidad realizada)' },
      { color: C.s8, texto: 'la decisión fija resulta infactible' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con ρ = 0 se decide el plan nominal y se paga el resultado de la perturbación; al subir ρ se planifica con recursos reducidos en ρ %. Observe el cruce entre infactibilidad y utilidad media. Pase el cursor por una columna para ver los conteos.');

    function calcular() {
      // La solución con colchón: óptimo nominal con recursos (1−ρ)·b, que se mantiene fija en todos los escenarios.
      const bc = B0.map((v) => v * (1 - rho)), Bc = optima(motor(C0, A0, bc));
      const xc = Bc ? solucion(motor(C0, A0, bc), Bc).slice(0, 2) : [0, 0];
      const reopt = [], fija = [];
      let infact = 0;
      base.forEach((e) => {
        const dd = aplicar(e, sigma, { c: true, A: true, b: true });
        const r = VIZ.opt.lp(dd.c, dd.A, SEN, dd.b);
        if (r.estado === 'optimo') reopt.push(r.z);
        const ok = dd.A.every((f, i) => f[0] * xc[0] + f[1] * xc[1] <= dd.b[i] + 1e-9);
        if (ok) fija.push(dd.c[0] * xc[0] + dd.c[1] * xc[1]); else infact++;
      });
      const todos = [...reopt, ...fija];
      const lo = Math.floor(Math.min(...todos, BO.z) * 0.9), hi = Math.ceil(Math.max(...todos, BO.z) * 1.02), nb = 14, w = (hi - lo) / nb;
      const bin = (v) => Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / w)));
      const h1 = Array(nb).fill(0), h2 = Array(nb).fill(0);
      reopt.forEach((v) => { h1[bin(v)]++; }); fija.forEach((v) => { h2[bin(v)]++; });
      d = { xc, reopt, fija, infact, lo, hi, nb, w, h1, h2, zc: C0[0] * xc[0] + C0[1] * xc[1] };
      dibujar();
      const f = (v, p) => cuantil(v, p);
      registro.textContent = `Planificar con colchón ρ = ${Math.round(rho * 100)} % lleva a producir (${VIZ.fmt(xc[0])}, ${VIZ.fmt(xc[1])}), con utilidad nominal ${VIZ.fmt(d.zc)} (${VIZ.fmt(BO.z - d.zc)} menos que el plan sin colchón). `
        + `Con σ = ${Math.round(sigma * 100)} % esa decisión resulta infactible en ${pct(infact / N)} de los escenarios; reoptimizar siempre es factible y rinde ${VIZ.fmt(media(reopt))} en promedio.`;
      lectura.set([
        ['decisión con colchón', `(${VIZ.fmt(xc[0])}, ${VIZ.fmt(xc[1])})`],
        ['infactible (decisión fija)', pct(infact / N)],
        ['reoptimizar: media', VIZ.fmt(media(reopt))],
        ['reoptimizar: peor 5 %', VIZ.fmt(f(reopt, 0.05))],
        ['decisión fija: media (factibles)', fija.length ? VIZ.fmt(media(fija)) : '—'],
        ['decisión fija: peor 5 % (factibles)', fija.length ? VIZ.fmt(f(fija, 0.05)) : '—'],
      ]);
    }

    function dibujar() {
      if (!d) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(0.05, ...d.h1.map((v) => v / N), ...d.h2.map((v) => v / N), d.infact / N) * 1.12;
      const ticks = VIZ.ticks(d.lo, d.hi, Math.max(3, Math.floor(lienzo.ancho / 90)));
      pl = VIZ.plano(lienzo, { xmin: d.lo - 2.2 * d.w, xmax: d.hi, ymin: 0, ymax }, { etiquetaY: 'fracción de escenarios', etiquetaX: 'utilidad', ticksX: ticks, formatoY: (v) => `${Math.round(v * 100)} %`, margen: { izq: 54 } });
      pl.ejes();
      const barra = (x0, x1, v, color) => {
        const a = pl.sx(x0) + 1, b = pl.sx(x1) - 1, y = pl.sy(v / N);
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(a, y, Math.max(1, b - a), pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
      };
      for (let k = 0; k < d.nb; k++) {
        const a = d.lo + k * d.w, m = a + d.w / 2;
        if (d.h1[k]) barra(a, m, d.h1[k], C.s1);
        if (d.h2[k]) barra(m, a + d.w, d.h2[k], C.s2);
      }
      const x0 = d.lo - 1.8 * d.w;
      if (d.infact) barra(x0, x0 + d.w * 1.2, d.infact, C.s8);
      texto(ctx, 'infactible', pl.sx(x0 + d.w * 0.6), pl.y0 + 8, C.tinta2, 'center', 'top');
      const marca = (v, color, et, arriba) => {
        if (!Number.isFinite(v)) return;
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(pl.sx(v), pl.y0); ctx.lineTo(pl.sx(v), pl.y1 + (arriba ? 0 : 14)); ctx.stroke(); ctx.restore();
        texto(ctx, et, pl.sx(v) + 4, pl.y1 + (arriba ? 6 : 20), color === C.s1 ? C.s1 : C.s2, 'left', 'middle');
      };
      marca(media(d.reopt), C.s1, `media ${VIZ.fmt(media(d.reopt))}`, true);
      if (d.fija.length) marca(media(d.fija), C.s2, `media ${VIZ.fmt(media(d.fija))}`, false);
      if (hover != null) {
        ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
        const a = hover >= 0 ? pl.sx(d.lo + hover * d.w) : pl.sx(x0), b = hover >= 0 ? pl.sx(d.lo + (hover + 1) * d.w) : pl.sx(x0 + d.w * 1.2);
        ctx.strokeRect(a, pl.y1, b - a, pl.y0 - pl.y1); ctx.restore();
      }
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !d || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const v = pl.ix(x);
      if (v < d.lo) hover = -1; else hover = Math.min(d.nb - 1, Math.floor((v - d.lo) / d.w));
      dibujar();
      if (hover === -1) return tip.mostrar(x, y, VIZ.filaTooltip(C.s8, 'decisión fija infactible', `${d.infact} de ${N}`));
      const a = d.lo + hover * d.w;
      tip.mostrar(x, y, `utilidad <b>${VIZ.fmt(a)}</b> a <b>${VIZ.fmt(a + d.w)}</b>` + VIZ.filaTooltip(C.s1, 'reoptimizar', `${d.h1[hover]} esc.`) + VIZ.filaTooltip(C.s2, 'decisión fija', `${d.h2[hover]} esc.`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    base = generar(semilla, N);
    calcular();
  }

  VIZ.registrarTema('robustness-perturbations', {
    intro: String.raw`
      <p>Los datos de un modelo (utilidades, consumos, disponibilidades) son estimaciones, y el plan óptimo se calcula como si fueran exactos. Pero una solución que es óptima
      para los datos nominales puede ser muy frágil: un pequeño error en un recurso puede volverla infactible, y un pequeño cambio de costos puede llevar a otro vértice.
      Esto no se resuelve con intervalos uno por uno, porque en la práctica <strong>todo cambia a la vez</strong>.</p>
      <p>Una forma sencilla de medir esa fragilidad es simular: perturbar todos los datos al azar, resolver cada versión y mirar qué tan dispersa es la solución, cuántas veces cambia la base y qué ocurre con el valor óptimo.
      Al comparar el <em>promedio</em> con el <em>peor caso</em> se ve el precio de protegerse: una decisión conservadora rinde menos en promedio, pero falla menos.</p>`,
    visualizaciones: [
      {
        titulo: 'Nube de soluciones bajo perturbaciones',
        descripcion: 'Cada punto es el óptimo de una versión perturbada del problema, coloreado según su base. Suba σ y vea cómo la nube se reparte entre vértices; apague las casillas para perturbar solo costos, solo consumos o solo recursos, y compare cuál desestabiliza más la solución.',
        montar: montarNube,
      },
      {
        titulo: 'Promedio frente a peor caso',
        descripcion: 'Compare reoptimizar con los datos reales frente a mantener una decisión planificada con un colchón ρ en los recursos. Con ρ = 0 la decisión nominal falla con frecuencia; al subir ρ cae la infactibilidad, pero también la utilidad media. Mueva σ para ver cómo cambia el equilibrio.',
        montar: montarColchon,
      },
    ],
    teoria: String.raw`
      <h2>Qué significa robustez</h2>
      <p>Un problema lineal con datos inciertos \(\max\, c^\top x,\ Ax\le b,\ x\ge0\) se estudia con una familia de datos \((c,A,b)\) en un conjunto de escenarios \(\Omega\). Hay dos formas de cometer errores:</p>
      <ul>
        <li><strong>Pérdida de optimalidad</strong>: el plan \(x^*\) calculado con datos nominales ya no es el mejor para los datos reales \(\omega\); la pérdida es \(z^*(\omega) - c(\omega)^\top x^*\) siempre que \(x^*\) siga siendo factible.</li>
        <li><strong>Pérdida de factibilidad</strong>: \(x^*\) viola alguna restricción de \(\omega\). Es el caso grave, porque en la práctica significa no poder ejecutar el plan.</li>
      </ul>
      <p>Una solución básica óptima está en la intersección de restricciones <em>activas</em>; cualquier perturbación pequeña de una de ellas en el sentido desfavorable la hace infactible. Eso explica por qué el plan nominal falla tan seguido en la figura 2 con \(\rho=0\).</p>
      <h2>Simulación Monte Carlo</h2>
      <pre><code>para k ← 1 hasta N:
    ω_k ← nominal ⊙ (1 + σ·ξ_k)          (ξ_k normal estándar, truncada)
    resolver el LP con los datos ω_k      → x*_k, z*_k, base_k
estimar:  P(base_k = base nominal),  media y desviación de z*_k,
          cuantil 5 % (peor caso razonable),  mínimo (peor caso observado)</code></pre>
      <p>Con \(N\) escenarios, el error de una frecuencia estimada \(\hat p\) es del orden de \(\sqrt{\hat p(1-\hat p)/N}\): con \(N=300\) basta para ver diferencias de unos puntos porcentuales; para colas (peor 1 %) hacen falta muchos más escenarios.
      Como el generador usa semilla, los resultados son reproducibles.</p>
      <h2>Colchón: el costo de la protección</h2>
      <p>La forma más simple de proteger un plan es planificar con recursos reducidos, \(b' = (1-\rho)b\). Como el problema es homogéneo en \(b\), la solución es \(x_\rho=(1-\rho)x^*\) y su utilidad nominal es \((1-\rho)z^*\).</p>
      <div class="recuadro"><strong>Ejemplo resuelto.</strong> Con \(\max\;3x_1+2x_2\) y recursos \(b=(16,14,7)\), el plan nominal es \((6,4)\) con \(z^*=26\) y dos restricciones activas. Si solo \(b\) se perturba, \(b_i' = b_i(1+\sigma\xi_i)\), la decisión con colchón \(\rho\) es factible cuando \(\xi_1,\xi_2\ge -\rho/\sigma\), con probabilidad
      \[ P(\text{factible}) \approx \Phi(\rho/\sigma)^2 . \]
      Con \(\rho=0\) es \(0.5^2=25\,\%\): el plan nominal falla en ≈ 75 % de los casos. Con \(\rho=\sigma\), \(\Phi(1)^2\approx 71\,\%\); con \(\rho=2\sigma\), \(\Phi(2)^2 \approx 95\,\%\). Cada punto de colchón cuesta \(0.26\) de utilidad nominal (1 % de 26).
      La simulación de la figura 2 incluye además el ruido en \(A\) y en \(c\), y por eso sus cifras son algo peores.</div>
      <h2>Promedio frente a peor caso</h2>
      <p>Hay tres criterios para elegir \(x\) cuando los datos son inciertos: optimizar el valor <em>esperado</em> (plan nominal o estocástico), exigir factibilidad para todo \(\omega\) y optimizar el peor valor (<em>optimización robusta</em>, \(\max_x \min_{\omega} c(\omega)^\top x\)),
      o limitar la probabilidad de violación (<em>restricciones de azar</em>). El colchón \(\rho\) es una versión muy simple del segundo; en la literatura hay conjuntos de incertidumbre más finos (cajas, elipsoides, presupuesto de incertidumbre) que protegen menos a mayor costo de modelación.</p>
      <p>Reoptimizar con datos reales siempre es factible y es el mejor posible, pero solo sirve si se puede esperar a conocer los datos; la <em>decisión fija</em> es la que hay que comprometer de antemano.</p>
      <h2>Relación con los demás análisis</h2>
      <ul>
        <li>Los intervalos de <a href="tema.html?id=objective-coefficient-ranges">costos</a> y de <a href="tema.html?id=rhs-ranges">recursos</a> dicen cuánto puede cambiar <em>un</em> dato; la simulación muestra el efecto conjunto.</li>
        <li>El mapa de <a href="tema.html?id=basis-stability">estabilidad de bases</a> dibuja las regiones donde la base no cambia: la probabilidad de conservarla es la masa de la nube dentro de la región.</li>
        <li>Si \(\sigma\) es grande, el valor \(z^*\) es una función lineal por tramos y su media no coincide con \(z^*\) nominal (desigualdad de Jensen): \(\mathbb{E}[z^*(c)] \ge z^*(\mathbb{E}[c])\) en maximización cuando \(c\) varía, por convexidad.</li>
        <li>Con degeneración, pequeñas perturbaciones separan bases que describen el mismo vértice (ver <a href="tema.html?id=degeneracy-cycling">degeneración</a>).</li>
      </ul>`,
  });
})();
