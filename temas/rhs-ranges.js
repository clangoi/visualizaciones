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
  const cotaMax = (i) => 2 * B0[i];
  const resolver = (b) => { const M = motor(C0, A0, b); return { M, B: optima(M) }; };

  /* ---------- Fig. 1: mover una restricción ---------- */

  function montarMover(cuerpo) {
    let i = 0, M, B, poli, pl = null, hover = null, arrastrando = false;
    const b = B0.slice();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Recurso que se modifica', opciones: RECURSOS.map((t, k) => [k, `R${k + 1}: ${t}`]), valor: 0,
      alCambiar: (v) => { i = +v; b.splice(0, 3, ...B0); sB.max = cotaMax(i); sB.valor = b[i]; actualizar(); } });
    const sB = ctl.rango({ etiqueta: 'Disponibilidad del recurso', min: 0, max: cotaMax(0), paso: 0.1, valor: b[0], formato: (v) => v.toFixed(1), alCambiar: (v) => { b[i] = v; actualizar(); } });
    const poner = (v) => { b[i] = Math.min(cotaMax(i), Math.max(0, v)); sB.valor = b[i]; };
    const llevar = (lado) => {
      const [lo, hi] = rangoB(B, i), d = lado > 0 ? hi : lo;
      if (!Number.isFinite(d)) { registro.textContent = 'En ese sentido la disponibilidad puede cambiar sin límite con esta base.'; return; }
      poner(b[i] + d); actualizar();
    };
    ctl.boton('Llevar al límite superior', () => llevar(1), { primario: true });
    ctl.boton('Llevar al límite inferior', () => llevar(-1));
    ctl.boton('Restablecer', () => { b.splice(0, 3, ...B0); sB.valor = b[i]; actualizar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoIgual(9.5, 12) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), borde: C.s1, texto: 'región factible' },
      { color: C.s1, texto: 'restricción que se mueve', forma: 'linea' },
      { color: C.apagado, texto: 'su posición original', forma: 'linea' },
      { color: C.tinta2, texto: 'otras restricciones', forma: 'linea' },
      { color: C.s2, texto: 'recta de nivel de la utilidad', forma: 'linea' },
      { color: C.s6, texto: 'vértice óptimo', forma: 'punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el deslizador, o haga clic en el plano para que la restricción elegida pase por ese punto. La tabla muestra qué variable básica se agota primero al aumentar o reducir el recurso: ese es el límite del intervalo.');

    function actualizar() {
      ({ M, B } = resolver(b));
      poli = poligono(A0, b);
      const [lo, hi] = rangoB(B, i), x = solucion(M, B);
      const dentro = true;
      void dentro;
      caja.replaceChildren(tabla(lo, hi));
      registro.textContent = `Con R${i + 1} = ${VIZ.fmt(b[i])} la base ${etiquetaBase(M, B)} es óptima y cada unidad adicional del recurso vale ${VIZ.fmt(B.y[i])}. `
        + `Eso es cierto mientras R${i + 1} ∈ ${intervalo(b[i] + lo, b[i] + hi)}; fuera de ese intervalo alguna variable básica se haría negativa y la base cambia.`;
      lectura.set([
        ['solución', `(${VIZ.fmt(x[0])}, ${VIZ.fmt(x[1])})`],
        ['valor z*', VIZ.fmt(B.z)],
        ['base', etiquetaBase(M, B)],
        ['precio sombra', `y${sub(i + 1)} = ${VIZ.fmt(B.y[i])}`],
        ['intervalo de factibilidad', intervalo(b[i] + lo, b[i] + hi)],
      ]);
      dibujar();
    }
    function tabla(lo, hi) {
      const filas = B.idx.map((j, r) => {
        const beta = B.inv[r][i], lim = beta > EPS ? -B.xB[r] / beta : beta < -EPS ? -B.xB[r] / beta : null;
        const activa = lim !== null && ((beta > 0 && Math.abs(lim - lo) < 1e-7) || (beta < 0 && Math.abs(lim - hi) < 1e-7));
        return VIZ.el('tr', { class: activa ? 'activa' : null },
          VIZ.el('td', { class: 'izq' }, sub(M.nombres[j])), VIZ.el('td', null, VIZ.fmt(B.xB[r])), VIZ.el('td', null, VIZ.fmt(beta)),
          VIZ.el('td', null, lim === null ? 'sin límite' : beta > 0 ? `Δ ≥ ${VIZ.fmt(lim)}` : `Δ ≤ ${VIZ.fmt(lim)}`));
      });
      return VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'variable básica'), VIZ.el('th', null, 'valor B⁻¹b'), VIZ.el('th', null, `coef. de b${sub(i + 1)} (B⁻¹)`), VIZ.el('th', null, 'se mantiene ≥ 0 si')), ...filas);
    }

    function dibujar() {
      if (!B) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, 9.5);
      pl.ejes();
      ctx.save(); pl.recortar();
      rellenar(ctx, pl, poli, VIZ.alfa(C.s1, 0.14));
      ctx.restore();
      A0.forEach((a, k) => { if (k !== i) recta(ctx, pl, a, b[k], C.tinta2, 1.5); });
      recta(ctx, pl, A0[i], B0[i], C.apagado, 1.5, [5, 4]);
      recta(ctx, pl, A0[i], b[i], C.s1, 3);
      ctx.save(); pl.recortar();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
      ctx.beginPath(); poli.forEach(([x, y], k) => (k ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y)))); ctx.closePath(); ctx.stroke();
      ctx.restore();
      recta(ctx, pl, C0, B.z, C.s2, 1.5, [6, 4]);
      const x = solucion(M, B);
      poli.forEach(([px, py]) => { if (pl.dentro(pl.sx(px), pl.sy(py))) VIZ.marcador(ctx, pl.sx(px), pl.sy(py), C.tinta, 3.5); });
      VIZ.marcador(ctx, pl.sx(x[0]), pl.sy(x[1]), C.s6, 7);
      texto(ctx, `(${VIZ.fmt(x[0])}, ${VIZ.fmt(x[1])})`, pl.sx(x[0]) + 10, pl.sy(x[1]) - 10, C.tinta, 'left', 'bottom', 12);
      if (hover) VIZ.marcador(ctx, pl.sx(hover[0]), pl.sy(hover[1]), C.tinta, 4);
    }
    lienzo.alDibujar = () => B && dibujar();

    const canvas = lienzo.canvas;
    canvas.style.cursor = 'crosshair';
    const fijar = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = [pl.ix(x), pl.iy(y)], a = A0[i];
      poner(Math.round((a[0] * p[0] + a[1] * p[1]) * 20) / 20);
      actualizar();
    };
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
      const fact = A0.every((a, k) => a[0] * p[0] + a[1] * p[1] <= b[k] + 1e-9);
      tip.mostrar(x, y, `${v ? 'vértice' : 'punto'} (<b>${VIZ.fmt(p[0])}</b>, <b>${VIZ.fmt(p[1])}</b>)<br>utilidad = <b>${VIZ.fmt(C0[0] * p[0] + C0[1] * p[1])}</b><br>${fact ? 'factible' : 'fuera de la región factible'}`);
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    actualizar();
  }

  /* ---------- Fig. 2: valor óptimo en función del recurso ---------- */

  function montarCurva(cuerpo) {
    let i = 0, bi = B0[0], hover = null, pl = null, curva = null, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Recurso', opciones: RECURSOS.map((t, k) => [k, `R${k + 1}: ${t}`]), valor: 0,
      alCambiar: (v) => { i = +v; sB.max = cotaMax(i); bi = B0[i]; sB.valor = bi; calcular(); rep.reiniciar(); bi = B0[i]; sB.valor = bi; dibujar(); } });
    const sB = ctl.rango({ etiqueta: 'Disponibilidad bᵢ', min: 0, max: cotaMax(0), paso: 0.05, valor: bi, formato: (v) => v.toFixed(2), alCambiar: (v) => { rep.detener(); bi = v; msg = ''; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o pase el cursor sobre la curva. Cada color es una base óptima distinta; la recta punteada es la extensión del tramo actual, que deja de ser válida al salir de su intervalo de factibilidad.');

    const bAt = (v) => { const b = B0.slice(); b[i] = v; const r = resolver(b); return { v, ...r, key: claveBase(r.B) }; };
    function calcular() {
      const N = 280, hiB = cotaMax(i);
      const pts = Array.from({ length: N + 1 }, (_, k) => bAt((k / N) * hiB));
      const quiebres = [];
      for (let k = 1; k <= N; k++) {
        if (pts[k].key === pts[k - 1].key) continue;
        let a = pts[k - 1].v, c = pts[k].v;
        const ka = pts[k - 1].key;
        for (let it = 0; it < 40; it++) { const mid = (a + c) / 2; if (bAt(mid).key === ka) a = mid; else c = mid; }
        quiebres.push({ v: (a + c) / 2, de: pts[k - 1], a: pts[k] });
      }
      const claves = [];
      pts.forEach((p) => { if (!claves.includes(p.key)) claves.push(p.key); });
      curva = { pts, quiebres, claves, hiB };
      leyenda.set(claves.map((k, n) => {
        const p = pts.find((q) => q.key === k);
        return { color: COL[n % 8], texto: `base ${etiquetaBase(p.M, p.B)}`, forma: 'linea' };
      }));
    }
    const colorDe = (key) => COL[curva.claves.indexOf(key) % 8];
    let prevKey = null;
    function iniciar() {
      prevKey = null; msg = '';
      return (function* () {
        for (let v = 0; v <= curva.hiB + 1e-9; v += curva.hiB / 80) {
          bi = v; sB.valor = v;
          const q = bAt(v);
          if (prevKey && q.key !== prevKey) {
            const [antes] = curva.quiebres.filter((qb) => qb.a.key === q.key), nueva = q.B.idx.filter((j) => !antes.de.B.idx.includes(j)).map((j) => sub(q.M.nombres[j])), sale = antes.de.B.idx.filter((j) => !q.B.idx.includes(j)).map((j) => sub(q.M.nombres[j]));
            msg = `R${i + 1} = ${VIZ.fmt(antes.v)}: ${sale.join(', ')} se anula y entra ${nueva.join(', ')}. El precio sombra pasa de ${VIZ.fmt(antes.de.B.y[i])} a ${VIZ.fmt(q.B.y[i])}.`;
          }
          prevKey = q.key;
          yield;
        }
      })();
    }

    function dibujar() {
      if (!curva) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const zmax = Math.max(...curva.pts.map((p) => p.B.z)) * 1.08 || 1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: curva.hiB, ymin: 0, ymax: zmax }, { etiquetaX: `b${sub(i + 1)}`, etiquetaY: 'valor óptimo z*' });
      const q = bAt(bi), [lo, hi] = rangoB(q.B, i);
      ctx.fillStyle = VIZ.alfa(colorDe(q.key), 0.12);
      const x0 = pl.sx(Math.max(0, bi + lo)), x1 = pl.sx(Math.min(curva.hiB, bi + hi));
      ctx.fillRect(x0, pl.y1, x1 - x0, pl.y0 - pl.y1);
      pl.ejes();
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, [[0, q.B.z - q.B.y[i] * bi], [curva.hiB, q.B.z + q.B.y[i] * (curva.hiB - bi)]], C.apagado, 1.5, [4, 4]);
      for (let k = 1; k < curva.pts.length; k++) {
        const a = curva.pts[k - 1], c = curva.pts[k];
        VIZ.trazar(ctx, pl, [[a.v, a.B.z], [c.v, c.B.z]], colorDe(c.key), 4);
      }
      ctx.restore();
      curva.quiebres.forEach((qb) => {
        const z = (qb.de.B.z + qb.a.B.z) / 2;
        const zz = bAt(qb.v).B.z;
        void z;
        VIZ.marcador(ctx, pl.sx(qb.v), pl.sy(zz), C.tinta, 4.5);
        texto(ctx, VIZ.fmt(qb.v), pl.sx(qb.v), pl.y0 - 8, C.tinta2, 'center', 'bottom');
      });
      ctx.save();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pl.sx(bi), pl.y0); ctx.lineTo(pl.sx(bi), pl.y1); ctx.stroke();
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(bi), pl.sy(q.B.z), colorDe(q.key), 6);
      if (hover != null) { const h = bAt(hover); VIZ.marcador(ctx, pl.sx(hover), pl.sy(h.B.z), C.tinta, 3.5); }
      registro.textContent = msg || `Con R${i + 1} = ${VIZ.fmt(bi)}: z* = ${VIZ.fmt(q.B.z)} y una unidad más del recurso vale ${VIZ.fmt(q.B.y[i])} mientras se quede en ${intervalo(Math.max(0, bi + lo), bi + hi)}.`;
      lectura.set([
        [`b${sub(i + 1)}`, VIZ.fmt(bi)],
        ['valor z*', VIZ.fmt(q.B.z)],
        ['precio sombra (pendiente)', VIZ.fmt(q.B.y[i])],
        ['intervalo de factibilidad', intervalo(Math.max(0, bi + lo), bi + hi)],
        ['tramos de la curva', String(curva.quiebres.length + 1)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const canvas = lienzo.canvas;
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.min(curva.hiB, Math.max(0, pl.ix(x)));
      dibujar();
      const h = bAt(hover);
      tip.mostrar(x, y, `b${sub(i + 1)} = <b>${VIZ.fmt(hover)}</b>` + VIZ.filaTooltip(colorDe(h.key), 'z*', VIZ.fmt(h.B.z))
        + VIZ.filaTooltip(colorDe(h.key), 'precio sombra', VIZ.fmt(h.B.y[i])) + `<div>base ${etiquetaBase(h.M, h.B)}</div>`);
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      rep.detener(); bi = Math.round(pl.ix(x) * 20) / 20; sB.valor = bi; msg = ''; dibujar();
    });
    calcular();
    rep.reiniciar();
    bi = B0[0]; sB.valor = bi; msg = ''; dibujar();
  }

  VIZ.registrarTema('rhs-ranges', {
    intro: String.raw`
      <p>Los recursos de un plan (horas de máquina, materia prima, presupuesto) rara vez son exactos: se pueden ampliar comprando horas extra o se pierden por una falla.
      El análisis de sensibilidad del lado derecho responde dos preguntas: <strong>¿cuánto vale una unidad más del recurso?</strong> y <strong>¿hasta cuántas unidades
      ese valor se mantiene?</strong> La primera es el <em>precio sombra</em>; la segunda, el <em>intervalo de factibilidad</em> de la base.</p>
      <p>A diferencia de cambiar un costo, mover un recurso desplaza una restricción: el vértice óptimo se arrastra por el polígono sin cambiar de base hasta que alguna
      variable básica llega a cero. Entonces el plan cambia de estructura y el precio sombra salta a otro valor, de modo que el valor óptimo, como función del recurso, es una
      curva lineal por tramos.</p>`,
    visualizaciones: [
      {
        titulo: 'Mover una restricción',
        descripcion: 'Elija un recurso y desplace su disponibilidad: el vértice óptimo (verde) se arrastra sin cambiar de base hasta el límite que señala la fila resaltada de la tabla. Pruebe «Llevar al límite superior» y luego avance un poco más: aparece otra variable básica.',
        montar: montarMover,
      },
      {
        titulo: 'Valor óptimo según el recurso',
        descripcion: 'La curva \\(z^*(b_i)\\) es lineal por tramos y cóncava; su pendiente en cada tramo es el precio sombra. Pulse Reproducir para recorrerla y vea cómo cambia la base en cada punto negro, o haga clic para ver la extensión punteada del tramo y su intervalo de validez.',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Efecto de cambiar \(b_i\)</h2>
      <p>Sea \(B\) una base óptima de \(\max\, c^\top x\) sujeto a \(Ax = b,\ x\ge 0\). Cambiar \(b\) no modifica los costos reducidos \(d = c - c_B^\top B^{-1}A\), de modo que la base
      sigue satisfaciendo la condición de optimalidad. Lo único que puede fallar es la factibilidad. Si \(b_i\) pasa a \(b_i + \Delta\):</p>
      \[ x_B(\Delta) = B^{-1}(b + \Delta e_i) = x_B + \Delta\, \beta_i \ \ge 0, \qquad \beta_i = B^{-1}e_i . \]
      <p>Aquí \(\beta_i\) es la columna \(i\) de \(B^{-1}\).</p>
      <p>Cada componente \(r\) con \(\beta_{ri}>0\) da una cota inferior \(\Delta \ge -x_{B,r}/\beta_{ri}\); cada una con \(\beta_{ri}<0\) da una cota superior. El <strong>intervalo de factibilidad</strong> es</p>
      \[ \max_{\beta_{ri}>0} \frac{-x_{B,r}}{\beta_{ri}} \;\le\; \Delta \;\le\; \min_{\beta_{ri}<0} \frac{-x_{B,r}}{\beta_{ri}} . \]
      <p>Dentro de él, el valor óptimo cambia con pendiente constante:</p>
      \[ z^*(b + \Delta e_i) = z^* + y_i\,\Delta, \qquad y^\top = c_B^\top B^{-1}. \]
      <h2>Precio sombra y curva lineal por tramos</h2>
      <p>El número \(y_i\) es el <em>precio sombra</em> del recurso \(i\): cuánto aumenta \(z^*\) por unidad adicional (véase <a href="tema.html?id=shadow-prices">precios sombra</a>). Fuera del intervalo, el
      precio cambia. La función \(b_i \mapsto z^*(b_i)\) es el valor del problema dual evaluado en el mejor vértice dual, \(\min_y\, b^\top y\), un mínimo de funciones lineales de \(b_i\): por eso en un problema
      de maximización con restricciones \(\le\) es <strong>cóncava, creciente y lineal por tramos</strong>. Las pendientes (los precios) decrecen: cada unidad adicional vale menos o lo mismo, y cuando el recurso deja de ser escaso vale cero.</p>
      <div class="recuadro"><strong>Ejemplo resuelto.</strong> Con \(\max\; 3x_1+2x_2\), \(2x_1+x_2\le b_1\), \(x_1+2x_2\le 14\), \(x_1\le 7\) y la base \(\{x_1,x_2,s_3\}\):
      \[ x_1=\tfrac{2b_1-14}{3},\qquad x_2=\tfrac{28-b_1}{3},\qquad s_3 = 7-\tfrac{2b_1-14}{3}. \]
      Exigir \(x_1\ge0\), \(x_2\ge 0\), \(s_3\ge 0\) da \(7\le b_1\le 17.5\) (en \(b_1=16\): \(\Delta\in[-9,\,1.5]\)). En ese tramo \(z^* = 26 + \tfrac43(b_1-16)\) y \(y_1=\tfrac43\).
      Para \(b_1<7\) la base cambia: \(x_1=0\), \(x_2=b_1\), \(z^*=2b_1\) con precio 2. Para \(b_1>17.5\), la restricción \(x_1\le 7\) y la de ensamble fijan el vértice \((7,\,3.5)\): \(z^*=28\) y el precio es 0.
      La curva de la figura 2 tiene entonces pendientes \(2,\ \tfrac43,\ 0\).</div>
      <h2>Qué pasa al salir del intervalo</h2>
      <p>Si \(\Delta\) sobrepasa el límite, alguna variable básica \(x_{B,r}\) queda negativa: la base ya no es factible, pero sigue siendo <em>dual factible</em> (\(d\le 0\)). Es la situación exacta para la que sirve el
      <strong>Simplex dual</strong>: se elige esa fila para salir, se elige la columna que entra por la razón mínima \(|d_j/\alpha_{rj}|\) y se pivotea hasta recuperar factibilidad (ver
      <a href="tema.html?id=basis-stability">estabilidad de bases</a>). No se parte de cero: la reoptimización aprovecha el trabajo ya hecho.</p>
      <h2>Observaciones</h2>
      <ul>
        <li>Cuando una restricción está <em>inactiva</em> (holgura básica positiva), su precio sombra es 0 y puede aumentar sin límite; su intervalo solo tiene cota inferior (hasta que la holgura se agote).</li>
        <li>Si la base es degenerada (alguna variable básica vale 0), un intervalo puede tener amplitud cero de un lado y el precio sombra distinto según el sentido del cambio (ver <a href="tema.html?id=degeneracy-cycling">degeneración</a>).</li>
        <li>Los precios son las variables duales (<a href="tema.html?id=strong-duality">dualidad fuerte</a>) y se leen directamente del tableau; los intervalos en costos se estudian en <a href="tema.html?id=objective-coefficient-ranges">rangos de coeficientes de la objetivo</a>.</li>
      </ul>`,
  });
})();
