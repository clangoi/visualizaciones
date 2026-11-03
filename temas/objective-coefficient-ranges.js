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
  const COTA_C = 8;

  /* ---------- Fig. 1: rotar la función objetivo ---------- */

  function montarRotacion(cuerpo) {
    const c = [3, 2];
    let M, B, poli, pl = null, arrastrando = false, hover = null;
    const ctl = VIZ.controles(cuerpo);
    const fm = (v) => v.toFixed(2);
    const sC1 = ctl.rango({ etiqueta: 'Utilidad c₁', min: 0, max: COTA_C, paso: 'any', valor: c[0], formato: fm, alCambiar: (v) => { c[0] = v; actualizar(); } });
    const sC2 = ctl.rango({ etiqueta: 'Utilidad c₂', min: 0, max: COTA_C, paso: 'any', valor: c[1], formato: fm, alCambiar: (v) => { c[1] = v; actualizar(); } });
    const poner = (j, v) => { c[j] = Math.min(COTA_C, Math.max(0, v)); (j ? sC2 : sC1).valor = c[j]; };
    function llevar(lado) {
      const [lo, hi] = rangoCosto(M, B, 0);
      const d = lado > 0 ? hi : lo;
      if (!Number.isFinite(d)) { registro.textContent = 'Con esta base c₁ puede cambiar en ese sentido sin límite: no hay frontera que alcanzar.'; return; }
      poner(0, c[0] + d);
      actualizar();
    }
    ctl.boton('c₁ al límite superior', () => llevar(1), { primario: true });
    ctl.boton('c₁ al límite inferior', () => llevar(-1));
    ctl.boton('Restablecer c = (3, 2)', () => { poner(0, 3); poner(1, 2); actualizar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoIgual(9.5, 12) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), borde: C.s1, texto: 'región factible' },
      { color: C.tinta2, texto: 'restricciones', forma: 'linea' },
      { color: C.s2, texto: 'vector c y recta de nivel', forma: 'linea' },
      { color: C.s3, texto: 'normales de las restricciones activas', forma: 'linea' },
      { color: C.s6, texto: 'vértice óptimo', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre el plano para colocar la punta del vector c (también sirven los deslizadores). Con los botones lleve c₁ exactamente a su límite y luego cruce un poco más allá.');

    function actualizar() {
      M = motor(c, A0, B0);
      B = optima(M);
      poli = poligono(A0, B0);
      const [l1, h1] = rangoCosto(M, B, 0), [l2, h2] = rangoCosto(M, B, 1);
      const x = solucion(M, B);
      const empate = B.d.some((v, j) => !B.idx.includes(j) && Math.abs(v) < 1e-7);
      registro.textContent = `Con c = (${VIZ.fmt(c[0])}, ${VIZ.fmt(c[1])}) el óptimo es el vértice (${VIZ.fmt(x[0])}, ${VIZ.fmt(x[1])}) con z* = ${VIZ.fmt(B.z)}. `
        + (empate ? 'Está justo en el límite del intervalo: dos vértices empatan y todo el lado que los une es óptimo.'
          : `La base ${etiquetaBase(M, B)} sigue óptima mientras c₁ ∈ ${intervalo(c[0] + l1, c[0] + h1)} (con c₂ fijo).`);
      lectura.set([
        ['vértice óptimo', `(${VIZ.fmt(x[0])}, ${VIZ.fmt(x[1])})`],
        ['valor z*', VIZ.fmt(B.z)],
        ['base', etiquetaBase(M, B)],
        ['c₁ puede estar en', intervalo(c[0] + l1, c[0] + h1)],
        ['c₂ puede estar en', intervalo(c[1] + l2, c[1] + h2)],
        ['costos reducidos', B.d.map((v, j) => (B.idx.includes(j) ? null : `d(${sub(M.nombres[j])}) = ${VIZ.fmt(v)}`)).filter(Boolean).join(' · ')],
      ]);
      dibujar();
    }

    function dibujar() {
      if (!B) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, 9.5);
      pl.ejes();
      rellenar(ctx, pl, poli, VIZ.alfa(C.s1, 0.14));
      A0.forEach((a, i) => recta(ctx, pl, a, B0[i], C.tinta2, 1.5));
      [[4.3, 7.4], [8.1, 2.95], [7, 9.1]].forEach(([x, y], i) => texto(ctx, 'R' + (i + 1), pl.sx(x) + 6, pl.sy(y), C.tinta2));
      ctx.save();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
      ctx.beginPath(); poli.forEach(([x, y], i) => (i ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y)))); ctx.closePath(); ctx.stroke();
      ctx.restore();
      const x = solucion(M, B), vx = pl.sx(x[0]), vy = pl.sy(x[1]);
      if (c[0] + c[1] > 1e-9) recta(ctx, pl, c, B.z, C.s2, 1.5, [6, 4]);
      // normales de las restricciones activas en el vértice óptimo
      const L = 1.7;
      Array.from({ length: M.cols }, (_, j) => j).filter((j) => !B.idx.includes(j)).forEach((j) => {
        const nrm = j < M.n ? (j === 0 ? [-1, 0] : [0, -1]) : A0[j - M.n];
        const h = Math.hypot(nrm[0], nrm[1]);
        flecha(ctx, vx, vy, vx + ((nrm[0] / h) * L * (pl.sx(1) - pl.sx(0))), vy - ((nrm[1] / h) * L * (pl.sx(1) - pl.sx(0))), C.s3, 2);
      });
      const hc = Math.hypot(c[0], c[1]);
      if (hc > 1e-6) flecha(ctx, vx, vy, vx + (c[0] / hc) * L * (pl.sx(1) - pl.sx(0)), vy - (c[1] / hc) * L * (pl.sx(1) - pl.sx(0)), C.s2, 2.5);
      // vector c desde el origen (arrastrable)
      flecha(ctx, pl.sx(0), pl.sy(0), pl.sx(c[0]), pl.sy(c[1]), C.s2, 3);
      VIZ.marcador(ctx, pl.sx(c[0]), pl.sy(c[1]), C.s2, 6);
      texto(ctx, `c = (${VIZ.fmt(c[0])}, ${VIZ.fmt(c[1])})`, pl.sx(c[0]) + 10, pl.sy(c[1]) - 10, C.s2, 'left', 'bottom', 12);
      poli.forEach(([px, py]) => VIZ.marcador(ctx, pl.sx(px), pl.sy(py), C.tinta, 3.5));
      VIZ.marcador(ctx, vx, vy, C.s6, 7);
      if (hover) VIZ.marcador(ctx, pl.sx(hover[0]), pl.sy(hover[1]), C.tinta, 4);
    }
    lienzo.alDibujar = () => B && dibujar();

    function fijar(ev) {
      const { x, y } = lienzo.posicion(ev);
      poner(0, Math.round(pl.ix(x) * 20) / 20);
      poner(1, Math.round(pl.iy(y) * 20) / 20);
      actualizar();
    }
    const canvas = lienzo.canvas;
    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('pointerdown', (ev) => { arrastrando = true; canvas.setPointerCapture(ev.pointerId); tip.ocultar(); fijar(ev); });
    canvas.addEventListener('pointerup', () => { arrastrando = false; });
    canvas.addEventListener('pointermove', (ev) => {
      if (arrastrando) return fijar(ev);
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const v = poli.find((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 12);
      const p = v || [pl.ix(x), pl.iy(y)];
      hover = v || null;
      dibujar();
      const z = c[0] * p[0] + c[1] * p[1];
      const fact = A0.every((a, i) => a[0] * p[0] + a[1] * p[1] <= B0[i] + 1e-9) && p[0] >= 0 && p[1] >= 0;
      const esOpt = v && Math.abs(z - B.z) < 1e-7;
      tip.mostrar(x, y, `${v ? 'vértice' : 'punto'} (<b>${VIZ.fmt(p[0])}</b>, <b>${VIZ.fmt(p[1])}</b>)<br>c·x = <b>${VIZ.fmt(z)}</b>`
        + `<br>${fact ? (esOpt ? 'factible y óptimo' : 'factible') : 'fuera de la región factible'}`);
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    actualizar();
  }

  /* ---------- Fig. 2: valor óptimo según c₁ ---------- */

  function montarEnvolvente(cuerpo) {
    let c2 = 2, c1 = 3, hover = null, pl = null;
    const COL = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s6, C.s7, C.s8];
    const ctl = VIZ.controles(cuerpo);
    const sC2 = ctl.rango({ etiqueta: 'Utilidad c₂ (fija)', min: 0.2, max: COTA_C, paso: 0.1, valor: c2, formato: (v) => v.toFixed(1), alCambiar: (v) => { c2 = v; rep.reiniciar(); } });
    void sC2;
    const sC1 = ctl.rango({ etiqueta: 'Utilidad c₁', min: 0, max: COTA_C, paso: 0.05, valor: c1, formato: (v) => v.toFixed(2), alCambiar: (v) => { rep.detener(); c1 = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const poli = poligono(A0, B0).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...poli.map((p, k) => ({ color: COL[k], texto: `vértice (${VIZ.fmt(p[0])}, ${VIZ.fmt(p[1])})`, forma: 'linea' })),
      { color: C.tinta, texto: 'z*(c₁): el mejor vértice en cada c₁ (trazo grueso)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o pase el cursor sobre el gráfico para elegir c₁. Cada recta fina es el valor de un vértice; el óptimo es la más alta, y la banda sombreada marca el intervalo donde el vértice actual sigue ganando.');

    const valor = (k, v) => v * poli[k][0] + c2 * poli[k][1];
    const mejor = (v) => { let k = 0; poli.forEach((_, i) => { if (valor(i, v) > valor(k, v) + 1e-9) k = i; }); return k; };
    // Intervalo de c₁ donde el vértice k es el mejor, por intersección de rectas.
    function banda(k) {
      let lo = 0, hi = COTA_C;
      poli.forEach((q, i) => {
        if (i === k) return;
        const pend = poli[k][0] - q[0], off = c2 * (poli[k][1] - q[1]);
        // valor k ≥ valor i  ⇔  pend·c₁ + off ≥ 0
        if (Math.abs(pend) < 1e-12) return;
        const t = -off / pend;
        if (pend > 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
      });
      return [lo, hi];
    }
    let previo = -1, msg = '';
    function iniciar() {
      c1 = 0; previo = -1; msg = '';
      return (function* () {
        for (let v = 0; v <= COTA_C + 1e-9; v += 0.1) {
          c1 = +v.toFixed(2);
          const k = mejor(c1);
          msg = previo >= 0 && k !== previo ? `c₁ = ${VIZ.fmt(c1)}: cambia el óptimo de (${VIZ.fmt(poli[previo][0])}, ${VIZ.fmt(poli[previo][1])}) a (${VIZ.fmt(poli[k][0])}, ${VIZ.fmt(poli[k][1])}); la base cambió.` : msg;
          previo = k;
          sC1.valor = c1;
          yield;
        }
      })();
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const zmax = Math.max(...poli.map((_, k) => valor(k, COTA_C))) * 1.05;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: COTA_C, ymin: 0, ymax: zmax }, { etiquetaX: 'c₁', etiquetaY: 'valor óptimo z*' });
      const k0 = mejor(c1), [lo, hi] = banda(k0);
      ctx.fillStyle = VIZ.alfa(COL[k0], 0.12);
      ctx.fillRect(pl.sx(lo), pl.y1, pl.sx(hi) - pl.sx(lo), pl.y0 - pl.y1);
      pl.ejes();
      ctx.save(); pl.recortar();
      poli.forEach((_, k) => VIZ.trazar(ctx, pl, [[0, valor(k, 0)], [COTA_C, valor(k, COTA_C)]], VIZ.alfa(COL[k], 0.55), 1.5));
      const N = 320;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * COTA_C, b = ((i + 1) / N) * COTA_C, k = mejor((a + b) / 2);
        VIZ.trazar(ctx, pl, [[a, valor(k, a)], [b, valor(k, b)]], COL[k], 4);
      }
      ctx.restore();
      // puntos de quiebre
      let kp = mejor(0.0001);
      for (let i = 1; i <= N; i++) {
        const v = (i / N) * COTA_C, k = mejor(v);
        if (k !== kp) {
          const pend = poli[kp][0] - poli[k][0], off = c2 * (poli[kp][1] - poli[k][1]), t = -off / pend;
          VIZ.marcador(ctx, pl.sx(t), pl.sy(valor(k, t)), C.tinta, 4.5);
          texto(ctx, `c₁ = ${VIZ.fmt(t)}`, pl.sx(t), pl.y0 - 8, C.tinta2, 'center', 'bottom');
          kp = k;
        }
      }
      ctx.save();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pl.sx(c1), pl.y0); ctx.lineTo(pl.sx(c1), pl.y1); ctx.stroke();
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(c1), pl.sy(valor(k0, c1)), COL[k0], 6);
      if (hover != null) VIZ.marcador(ctx, pl.sx(hover), pl.sy(valor(mejor(hover), hover)), C.tinta, 3.5);
      registro.textContent = msg || `Con c₂ = ${VIZ.fmt(c2)} y c₁ = ${VIZ.fmt(c1)}, el vértice óptimo es (${VIZ.fmt(poli[k0][0])}, ${VIZ.fmt(poli[k0][1])}).`;
      lectura.set([
        ['c₁ actual', VIZ.fmt(c1)],
        ['vértice óptimo', `(${VIZ.fmt(poli[k0][0])}, ${VIZ.fmt(poli[k0][1])})`],
        ['z*', VIZ.fmt(valor(k0, c1))],
        ['intervalo de optimalidad', intervalo(lo, hi)],
        ['pendiente dz*/dc₁', `x₁* = ${VIZ.fmt(poli[k0][0])}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const canvas = lienzo.canvas;
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.min(COTA_C, Math.max(0, pl.ix(x)));
      dibujar();
      const k = mejor(hover);
      tip.mostrar(x, y, `c₁ = <b>${VIZ.fmt(hover)}</b>` + poli.map((p, i) => VIZ.filaTooltip(COL[i], `(${VIZ.fmt(p[0])}, ${VIZ.fmt(p[1])})${i === k ? ' óptimo' : ''}`, VIZ.fmt(valor(i, hover)))).join(''));
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      rep.detener();
      c1 = Math.round(pl.ix(x) * 20) / 20; sC1.valor = c1; msg = '';
      dibujar();
    });
    rep.reiniciar();
    c1 = 3; sC1.valor = c1; dibujar();
  }

  VIZ.registrarTema('objective-coefficient-ranges', {
    intro: String.raw`
      <p>En un problema de programación lineal los costos o utilidades son estimaciones: cambian con el mercado, con el proveedor, con
      el día. La pregunta práctica no es solo «¿cuál es el plan óptimo?», sino <strong>«¿hasta cuándo sigue siendo el mismo plan?»</strong>.
      Geométricamente, cambiar un coeficiente de la función objetivo no mueve la región factible: <em>gira</em> las rectas de nivel
      alrededor del polígono, y el óptimo permanece en el mismo vértice mientras la dirección de mejora quede dentro del cono que
      forman las restricciones activas.</p>
      <p>Algebraicamente, esa condición se llama <em>intervalo de optimalidad</em>: el rango de un coeficiente \(c_j\) para el que la base óptima
      sigue siendo óptima. Dentro del intervalo cambian el valor \(z^*\) y los precios, pero no las variables que están en la base ni el
      vértice; al cruzar el límite, el Simplex haría un pivote y el plan cambia.</p>`,
    visualizaciones: [
      {
        titulo: 'Girar la función objetivo',
        descripcion: 'Arrastre la punta del vector c sobre el plano y observe que el vértice óptimo (verde) no se mueve mientras c quede entre las dos normales (verdes agua) de las restricciones activas. Con «c₁ al límite superior» la recta de nivel queda sobre un lado completo, y un poco más allá el óptimo salta al vértice vecino.',
        montar: montarRotacion,
      },
      {
        titulo: 'Valor óptimo y vértice ganador según c₁',
        descripcion: 'Cada recta fina es el valor \\(c_1x_1+c_2x_2\\) de un vértice como función de \\(c_1\\); el óptimo es la envolvente superior. Mueva \\(c_1\\) o pulse Reproducir: los puntos negros son los límites donde cambia la base, y la pendiente de \\(z^*\\) en cada tramo es \\(x_1^*\\).',
        montar: montarEnvolvente,
      },
    ],
    teoria: String.raw`
      <h2>Planteamiento</h2>
      <p>Considere el problema en forma estándar con holguras, \(\max\; c^\top x\) sujeto a \(Ax = b,\; x \ge 0\), y una base óptima \(B\) con variables
      básicas \(x_B = B^{-1}b\ge 0\). Los <strong>costos reducidos</strong> de las variables son</p>
      \[ d_j = c_j - c_B^\top B^{-1} a_j = c_j - y^\top a_j, \qquad y^\top = c_B^\top B^{-1}, \]
      y la base es óptima exactamente cuando \(d_j \le 0\) para todo \(j\) (en un problema de maximización). Cambiar los coeficientes
      no toca \(B^{-1}b\), así que la base sigue siendo <em>factible</em>; lo único que puede fallar es la condición \(d_j \le 0\).</p>
      <h2>Intervalo de una variable no básica</h2>
      <p>Si \(x_j\) es no básica, \(c_j\) aparece solo en su propio costo reducido. Al sumar \(\Delta\) a \(c_j\), el costo reducido pasa a \(d_j + \Delta\), de modo que
      la base sigue óptima si y solo si</p>
      \[ \Delta \le -d_j \quad\Longleftrightarrow\quad c_j \in (-\infty,\; c_j - d_j\,]. \]
      <p>Es decir, mientras la actividad no sea lo bastante rentable como para igualar el valor de los recursos que consume, no entra a la base.</p>
      <h2>Intervalo de una variable básica</h2>
      <p>Si \(x_j\) ocupa la fila \(r\) del tableau, cambiar \(c_j\) altera \(c_B\) y, con ello, <em>todos</em> los costos reducidos de las no básicas:</p>
      \[ d_k(\Delta) = d_k - \Delta\,\alpha_{rk}, \qquad \alpha_{rk} = (B^{-1}a_k)_r . \]
      <p>La base se mantiene óptima si \(d_k(\Delta)\le 0\) para todo \(k\) no básico. Cada \(k\) con \(\alpha_{rk}\neq 0\) impone una cota, y el intervalo es</p>
      \[ \max_{\alpha_{rk}>0} \frac{d_k}{\alpha_{rk}} \;\le\; \Delta \;\le\; \min_{\alpha_{rk}<0} \frac{d_k}{\alpha_{rk}} . \]
      <div class="recuadro"><strong>Ejemplo resuelto.</strong> Con \(\max\; 3x_1+2x_2\) sujeto a \(2x_1+x_2\le 16\), \(x_1+2x_2\le 14\), \(x_1\le 7\), el óptimo es \((6,4)\) con \(z^*=26\) y base
      \(\{x_1,x_2,s_3\}\). Las restricciones activas tienen normales \((2,1)\) y \((1,2)\); la dirección \(c=(c_1,c_2)\) debe estar en el cono que generan, lo que equivale a
      \(\tfrac12 \le c_1/c_2 \le 2\). Con \(c_2=2\): \(c_1\in[1,4]\). La figura 1 lo muestra: en \(c_1=4\) el vector \(c=(4,2)\) es paralelo a la normal \((2,1)\), la recta de nivel coincide con el lado
      \(2x_1+x_2=16\) y aparecen dos óptimos, \((6,4)\) y \((7,2)\), ambos con \(z=32\).</div>
      <h2>Qué ocurre en el límite y fuera de él</h2>
      <ul>
        <li><strong>En el límite</strong> algún \(d_k\) vale cero: hay <em>óptimos alternativos</em> y el valor \(z^*\) es el mismo en un lado completo del polígono.</li>
        <li><strong>Más allá</strong> el costo reducido de \(k\) se vuelve positivo, \(x_k\) entra a la base y el Simplex continúa desde esa base con un pivote (ver
        <a href="tema.html?id=simplex-tableau">el tableau del Simplex</a> y <a href="tema.html?id=pivoting-rules">las reglas de pivoteo</a>).</li>
        <li>El valor óptimo como función de \(c_j\) es <strong>convexo y lineal por tramos</strong>: es el máximo de las rectas \(c_j x_j^{(v)} + \text{resto}\), una por vértice, y su pendiente en cada tramo es el valor \(x_j^*\).</li>
      </ul>
      <h2>Regla del 100 %</h2>
      <p>Los intervalos de arriba valen cuando cambia <em>un</em> coeficiente. Si cambian varios a la vez, una condición suficiente es que la suma de los cambios relativos
      \(\sum_j \Delta_j / \Delta_j^{\max}\) no pase de 1 (donde \(\Delta_j^{\max}\) es la cota del intervalo en el sentido del cambio). Es suficiente, no necesaria; la figura 1 permite explorar cambios simultáneos arrastrando el vector.</p>
      <h2>Conexiones</h2>
      <p>Los costos reducidos son las holguras del problema dual (ver <a href="tema.html?id=complementary-slackness">holgura complementaria</a>). Los rangos de recursos son el tema complementario:
      <a href="tema.html?id=rhs-ranges">intervalos de disponibilidad</a>; el mapa de todas las bases posibles está en <a href="tema.html?id=basis-stability">estabilidad de bases</a>, y el efecto de datos inciertos en
      <a href="tema.html?id=robustness-perturbations">robustez y perturbaciones</a>.</p>`,
  });
})();
