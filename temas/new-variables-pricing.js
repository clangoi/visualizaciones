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
  /* ---------- Simplex dual sobre un tableau (propio de este archivo) ---------- */

  // Tableau [N | rhs] con la fila z al final (fila z = −d ≥ 0). Devuelve la historia de estados:
  // cada elemento es una foto del tableau ANTES de pivotear (con la fila r y la columna e elegidas).
  function simplexDual(T0, base0, m, cols) {
    const T = T0.map((f) => f.slice()), base = base0.slice(), hist = [];
    const foto = (extra) => hist.push({ T: T.map((f) => f.slice()), base: base.slice(), ...extra });
    for (let it = 0; it < 40; it++) {
      let r = -1, mn = -1e-9;
      for (let i = 0; i < m; i++) if (T[i][cols] < mn) { mn = T[i][cols]; r = i; }
      if (r < 0) { foto({ r: -1, e: -1, estado: 'optimo' }); return hist; }
      let e = -1, mejor = Infinity;
      const razones = Array(cols).fill(null);
      for (let j = 0; j < cols; j++) if (T[r][j] < -EPS) { razones[j] = T[m][j] / -T[r][j]; if (razones[j] < mejor - 1e-12) { mejor = razones[j]; e = j; } }
      if (e < 0) { foto({ r, e: -1, razones, estado: 'infactible' }); return hist; }
      foto({ r, e, razones, estado: 'pivote' });
      const p = T[r][e];
      T[r] = T[r].map((v) => v / p);
      for (let i = 0; i <= m; i++) if (i !== r) { const f = T[i][e]; if (f !== 0) T[i] = T[i].map((v, j) => v - f * T[r][j]); }
      base[r] = e;
    }
    return hist;
  }
  // Tabla HTML del tableau h; resalta la fila y la columna del pivote y los rhs negativos.
  function tablaDual(h, nombres, m, cols) {
    const cero = (v) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v);
    const piv = h.estado === 'pivote';
    const fila = (r) => VIZ.el('tr', { class: piv && h.r === r ? 'activa' : null },
      VIZ.el('td', { class: 'izq' }, sub(nombres[h.base[r]])),
      ...Array.from({ length: cols + 1 }, (_, j) => {
        const v = h.T[r][j];
        const est = piv && h.r === r && h.e === j ? { background: VIZ.alfa(C.s7, 0.3) }
          : piv && h.e === j ? { background: VIZ.alfa(C.s7, 0.1) } : j === cols && v < -1e-9 ? { color: C.s8 } : null;
        return VIZ.el('td', { style: est }, cero(v));
      }));
    return VIZ.el('table', { class: 'tabla-datos sin-corte' },
      VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'base'), ...nombres.map((t) => VIZ.el('th', null, sub(t))), VIZ.el('th', null, 'rhs')),
      ...Array.from({ length: m }, (_, r) => fila(r)),
      VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'z'), ...Array.from({ length: cols + 1 }, (_, j) => VIZ.el('td', null, cero(h.T[m][j])))));
  }
  // Plano con la misma escala en ambos ejes que contiene todos los puntos dados.
  function planoAuto(l, puntos) {
    const xl = Math.min(0, ...puntos.map((p) => p[0])) - 1, xh = Math.max(...puntos.map((p) => p[0])) + 1.5;
    const yl = Math.min(0, ...puntos.map((p) => p[1])) - 1, yh = Math.max(...puntos.map((p) => p[1])) + 1.5;
    const m = { izq: 40, der: 12, sup: 20, inf: 36 }, pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw / (xh - xl), ph / (yh - yl));
    return VIZ.plano(l, { xmin: xl, xmax: xl + pw / s, ymin: yl, ymax: yl + ph / s }, { margen: m, etiquetaX: 'x₁', etiquetaY: 'x₂' });
  }
  const COL = [C.s1, C.s2, C.s3];
  const M0 = motor(C0, A0, B0), BO = optima(M0), Z0 = BO.z, Y = BO.y;
  const lpNuevo = (c3, a) => VIZ.opt.lp([C0[0], C0[1], c3], A0.map((f, i) => [...f, a[i]]), ['<=', '<=', '<='], B0);

  /* ---------- Fig. 1: costo reducido de una nueva actividad ---------- */

  function montarColumna(cuerpo) {
    let c3 = 3, a = [1, 1, 2], pl = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    const sC = ctl.rango({ etiqueta: 'Utilidad unitaria c₃', min: 0, max: 10, paso: 0.05, valor: c3, formato: (v) => v.toFixed(2), alCambiar: (v) => { c3 = v; actualizar(); } });
    const sA = a.map((_, i) => ctl.rango({ etiqueta: `Consumo de R${i + 1} por unidad`, min: 0, max: 5, paso: 0.05, valor: a[i], formato: (v) => v.toFixed(2), alCambiar: (v) => { a[i] = v; actualizar(); } }));
    ctl.boton('Poner c₃ en el punto de equilibrio', () => { c3 = Math.min(10, a.reduce((s, v, i) => s + v * Y[i], 0)); sC.valor = c3; actualizar(); }, { primario: true });
    ctl.boton('Restablecer', () => { c3 = 3; a = [1, 1, 2]; sC.valor = c3; sA.forEach((s, i) => { s.valor = a[i]; }); actualizar(); });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: COL[0], texto: 'valor implícito de R1 consumido (y₁·a₁)' },
      { color: COL[1], texto: 'valor implícito de R2 (y₂·a₂)' },
      { color: COL[2], texto: 'valor implícito de R3 (y₃·a₃)' },
      { color: C.s6, texto: 'utilidad c₃ mayor que ese costo: conviene' },
      { color: C.s8, texto: 'utilidad c₃ menor: no conviene' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.subtitulo(cuerpo, 'Valor óptimo del plan según la utilidad c₃ (con este mismo consumo)');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 200, altoMax: 300 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s7, texto: 'z* del plan con la nueva actividad', forma: 'linea' },
      { color: C.apagado, texto: 'z* original, sin la actividad', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ajuste la utilidad y el consumo de la actividad: si su utilidad supera lo que valen los recursos que usa, el costo reducido es positivo y conviene incluirla. En la curva, el codo está exactamente en c₃ = yᵀa₃.');

    let costo = 0, d3 = 0, nuevo = null, curva = [];
    function actualizar() {
      costo = a.reduce((s, v, i) => s + v * Y[i], 0);
      d3 = c3 - costo;
      nuevo = lpNuevo(c3, a);
      const xs = Array.from({ length: 101 }, (_, k) => { const v = (k / 100) * 10, r = lpNuevo(v, a); return [v, r.estado === 'optimo' ? r.z : NaN, r.estado === 'optimo' ? r.x[2] : 0]; });
      curva = xs;
      const filas = a.map((v, i) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, `R${i + 1}`), VIZ.el('td', null, VIZ.fmt(Y[i])), VIZ.el('td', null, VIZ.fmt(v)), VIZ.el('td', null, VIZ.fmt(Y[i] * v))));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'recurso'), VIZ.el('th', null, 'precio sombra yᵢ'), VIZ.el('th', null, 'consumo aᵢ₃'), VIZ.el('th', null, 'yᵢ · aᵢ₃')), ...filas,
        VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'costo yᵀa₃'), VIZ.el('td'), VIZ.el('td'), VIZ.el('td', null, VIZ.fmt(costo))),
        VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'd₃ = c₃ − yᵀa₃'), VIZ.el('td'), VIZ.el('td'), VIZ.el('td', { style: { color: d3 > 1e-9 ? C.s6 : d3 < -1e-9 ? C.s8 : null } }, VIZ.fmt(d3)))));
      const entra = d3 > 1e-7;
      registro.textContent = entra
        ? `Cada unidad de la actividad usa recursos que valen ${VIZ.fmt(costo)} y rinde ${VIZ.fmt(c3)}: d₃ = ${VIZ.fmt(d3)} > 0, de modo que x₃ entra a la base y z* sube de ${VIZ.fmt(Z0)} a ${nuevo.estado === 'optimo' ? VIZ.fmt(nuevo.z) : '∞'}.`
        : Math.abs(d3) <= 1e-7 ? `Rinde exactamente lo que valen los recursos que usa: d₃ = 0. Es indiferente incluirla; el valor óptimo no cambia (z* = ${VIZ.fmt(Z0)}).`
          : `Cada unidad usa recursos que valen ${VIZ.fmt(costo)} pero rinde solo ${VIZ.fmt(c3)}: d₃ = ${VIZ.fmt(d3)} < 0. El plan actual sigue siendo óptimo y x₃ = 0.`;
      lectura.set([
        ['precios sombra', `(${Y.map((v) => VIZ.fmt(v)).join(', ')})`],
        ['costo yᵀa₃', VIZ.fmt(costo)],
        ['costo reducido d₃', VIZ.fmt(d3)],
        ['decisión', entra ? 'incluir' : Math.abs(d3) <= 1e-7 ? 'indiferente' : 'no incluir'],
        ['z* con la actividad', nuevo.estado === 'optimo' ? VIZ.fmt(nuevo.z) : 'no acotado'],
        ['x₃*', nuevo.estado === 'optimo' ? VIZ.fmt(nuevo.x[2]) : '∞'],
      ]);
      dibujar(); dibujar2();
    }

    const filaY = [{ y0: 22, h: 44 }, { y0: 100, h: 44 }];
    function dibujar() {
      if (!nuevo) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xmax = Math.max(6, c3 * 1.15, costo * 1.15, 1);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: 1 }, { margen: { izq: 12, der: 14, sup: 4, inf: 28 }, ticksY: [] });
      pl.ejes();
      texto(ctx, 'valor de los recursos que consume una unidad', pl.sx(0), filaY[0].y0 - 7, C.tinta2, 'left', 'middle', 11);
      texto(ctx, 'utilidad de una unidad', pl.sx(0), filaY[1].y0 - 7, C.tinta2, 'left', 'middle', 11);
      let acum = 0;
      a.forEach((v, i) => {
        const w = Y[i] * v;
        if (w < 1e-9) return;
        const x0 = pl.sx(acum), x1 = pl.sx(acum + w);
        ctx.fillStyle = COL[i]; ctx.fillRect(x0, filaY[0].y0, Math.max(1, x1 - x0 - 1.5), filaY[0].h);
        if (x1 - x0 > 30) texto(ctx, `R${i + 1}`, (x0 + x1) / 2 - 0.75, filaY[0].y0 + filaY[0].h / 2, C.sobre, 'center', 'middle', 12);
        acum += w;
      });
      ctx.fillStyle = d3 > 1e-7 ? C.s6 : d3 < -1e-7 ? C.s8 : C.inactivo;
      ctx.fillRect(pl.sx(0), filaY[1].y0, Math.max(1, pl.sx(c3) - pl.sx(0)), filaY[1].h);
      texto(ctx, `c₃ = ${VIZ.fmt(c3)}`, pl.sx(c3) - 6, filaY[1].y0 + filaY[1].h / 2, C.sobre, 'right', 'middle', 12);
      ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(pl.sx(costo), filaY[0].y0 - 2); ctx.lineTo(pl.sx(costo), filaY[1].y0 + filaY[1].h + 6); ctx.stroke(); ctx.restore();
      texto(ctx, `costo yᵀa₃ = ${VIZ.fmt(costo)}`, pl.sx(costo) + 6, filaY[0].y0 + filaY[0].h + 12, C.tinta, costo > xmax * 0.7 ? 'right' : 'left', 'middle', 11);
      if (Math.abs(d3) > 1e-7) texto(ctx, `d₃ = ${VIZ.fmt(d3)}`, (pl.sx(c3) + pl.sx(costo)) / 2, filaY[1].y0 + filaY[1].h + 14, d3 > 0 ? C.s6 : C.s8, 'center', 'middle', 12);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      const v = pl.ix(x);
      if (y >= filaY[0].y0 && y <= filaY[0].y0 + filaY[0].h) {
        let acum = 0;
        for (let i = 0; i < 3; i++) {
          const w = Y[i] * a[i];
          if (v >= acum && v <= acum + w) return tip.mostrar(x, y, VIZ.filaTooltip(COL[i], `R${i + 1}`) + `<br>y${sub(i + 1)} = <b>${VIZ.fmt(Y[i])}</b><br>a${sub(i + 1)}₃ = <b>${VIZ.fmt(a[i])}</b><br>aporta <b>${VIZ.fmt(w)}</b>`);
          acum += w;
        }
      } else if (y >= filaY[1].y0 && y <= filaY[1].y0 + filaY[1].h && v >= 0 && v <= c3) return tip.mostrar(x, y, `utilidad c₃ = <b>${VIZ.fmt(c3)}</b><br>costo = <b>${VIZ.fmt(costo)}</b><br>d₃ = <b>${VIZ.fmt(d3)}</b>`);
      tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());

    let pl2 = null;
    function dibujar2() {
      if (!curva.length) return;
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const fin = curva.filter((p) => Number.isFinite(p[1]));
      const zmax = Math.max(Z0, ...fin.map((p) => p[1])) * 1.1;
      pl2 = VIZ.plano(lienzo2, { xmin: 0, xmax: 10, ymin: 0, ymax: zmax }, { etiquetaX: 'c₃', etiquetaY: 'z*' });
      pl2.ejes();
      VIZ.trazar(ctx, pl2, [[0, Z0], [10, Z0]], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, pl2, curva.map((p) => [p[0], p[1]]), C.s7, 2.5);
      if (costo <= 10) { ctx.save(); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl2.sx(costo), pl2.y0); ctx.lineTo(pl2.sx(costo), pl2.y1); ctx.stroke(); ctx.restore(); texto(ctx, `c₃ = yᵀa₃ = ${VIZ.fmt(costo)}`, pl2.sx(costo) + 5, pl2.y1 + 8, C.tinta2, costo > 6 ? 'right' : 'left'); }
      if (nuevo.estado === 'optimo') VIZ.marcador(ctx, pl2.sx(c3), pl2.sy(nuevo.z), C.s7, 5.5);
      if (hover != null) { const p = curva[hover]; if (Number.isFinite(p[1])) VIZ.marcador(ctx, pl2.sx(p[0]), pl2.sy(p[1]), C.tinta, 3.5); }
    }
    lienzo2.alDibujar = () => dibujar2();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (!pl2 || !pl2.dentro(x, y)) { hover = null; tip2.ocultar(); return dibujar2(); }
      hover = Math.min(100, Math.max(0, Math.round(pl2.ix(x) * 10)));
      dibujar2();
      const p = curva[hover];
      tip2.mostrar(x, y, `c₃ = <b>${VIZ.fmt(p[0])}</b><br>z* = <b>${Number.isFinite(p[1]) ? VIZ.fmt(p[1]) : 'no acotado'}</b><br>x₃* = <b>${VIZ.fmt(p[2])}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => { hover = null; tip2.ocultar(); dibujar2(); });
    actualizar();
  }

  /* ---------- Fig. 2: una restricción nueva y reoptimización ---------- */

  function montarRestriccion(cuerpo) {
    let cf = [1, 1], g = 8, hist = [], vistos = 1, pl = null, hover = null, primal = 0, viola = false;
    const ctl = VIZ.controles(cuerpo);
    const s1 = ctl.rango({ etiqueta: 'Coeficiente de x₁', min: 0, max: 4, paso: 0.1, valor: cf[0], formato: (v) => v.toFixed(1), alCambiar: (v) => { cf[0] = v; rep.reiniciar(); } });
    const s2 = ctl.rango({ etiqueta: 'Coeficiente de x₂', min: 0, max: 4, paso: 0.1, valor: cf[1], formato: (v) => v.toFixed(1), alCambiar: (v) => { cf[1] = v; rep.reiniciar(); } });
    const s3 = ctl.rango({ etiqueta: 'Lado derecho', min: 0, max: 40, paso: 0.5, valor: g, formato: (v) => v.toFixed(1), alCambiar: (v) => { g = v; rep.reiniciar(); } });
    void s1; void s2;
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), borde: C.s1, texto: 'región factible con la restricción nueva' },
      { color: C.s2, texto: 'restricción nueva (corte)', forma: 'linea' },
      { color: C.tinta2, texto: 'restricciones originales', forma: 'linea' },
      { color: C.superficie, borde: C.s8, texto: 'solución básica infactible', forma: 'punto' },
      { color: C.s6, texto: 'solución factible: nuevo óptimo', forma: 'punto' },
      { color: C.s7, texto: 'pivote del Simplex dual (tableau)' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el plano para que la nueva restricción pase por ese punto, o use los deslizadores. Si el óptimo actual (6, 4) la viola, la nueva holgura sale de la base con valor negativo y el Simplex dual repara la solución.');
    const nombres = [...M0.nombres, 's4'];

    function iniciar() {
      const T = BO.N.map((f, r) => [...f, 0, BO.xB[r]]);
      let nueva = [cf[0], cf[1], 0, 0, 0, 1, g];
      BO.idx.forEach((j, r) => { if (j < 2) { const q = cf[j]; nueva = nueva.map((v, k) => v - q * T[r][k]); } });
      T.push(nueva);
      T.push([...BO.d.map((v) => -v), 0, BO.z]);
      hist = simplexDual(T, [...BO.idx, 5], 4, 6);
      const x0 = solucion(M0, BO);
      viola = cf[0] * x0[0] + cf[1] * x0[1] > g + 1e-9;
      primal = pivotesDesdeCero();
      vistos = 1;
      return (function* () { for (let k = 1; k < hist.length; k++) { vistos = k + 1; yield; } })();
    }
    // Pivotes que haría el Simplex primal desde cero con las cuatro restricciones.
    function pivotesDesdeCero() {
      let n = 0;
      for (const s of VIZ.opt.simplex(C0, [...A0, cf], [...B0, g])) if (s.estado === 'iterando') n++;
      return n;
    }
    const punto = (h) => { const x = [0, 0]; h.base.forEach((j, r) => { if (j < 2) x[j] = h.T[r][6]; }); return x; };
    const infact = (h) => h.base.some((_, r) => h.T[r][6] < -1e-9);
    const base = (h) => etiquetaBase({ nombres }, { idx: h.base });

    function dibujar() {
      if (!hist.length) return;
      const { ctx } = lienzo, h = hist[vistos - 1];
      lienzo.limpiar();
      const Ae = [...A0, cf], be = [...B0, g];
      const poli = poligono(Ae, be).length ? poligono(Ae, be) : [[0, 0]], pts = hist.map(punto);
      pl = planoAuto(lienzo, [...poli, ...pts, ...poligono(A0, B0)]);
      pl.ejes();
      ctx.save(); pl.recortar();
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.y0); ctx.lineTo(pl.sx(0), pl.y1); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke();
      ctx.restore();
      rellenar(ctx, pl, poli, VIZ.alfa(C.s1, 0.14));
      A0.forEach((r, k) => recta(ctx, pl, r, B0[k], C.tinta2, 1.5));
      if (cf[0] + cf[1] > 1e-9) recta(ctx, pl, cf, g, C.s2, 3);
      for (let k = 1; k < vistos; k++) flecha(ctx, pl.sx(pts[k - 1][0]), pl.sy(pts[k - 1][1]), pl.sx(pts[k][0]), pl.sy(pts[k][1]), C.s7, 2);
      pts.slice(0, vistos).forEach((p, k) => {
        const malo = infact(hist[k]);
        VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), malo ? C.superficie : C.s6, 6);
        if (malo) { ctx.save(); ctx.strokeStyle = C.s8; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(pl.sx(p[0]), pl.sy(p[1]), 6.5, 0, 7); ctx.stroke(); ctx.restore(); }
        texto(ctx, String(k), pl.sx(p[0]) + 9, pl.sy(p[1]) - 9, C.tinta, 'left', 'bottom', 12);
      });
      if (hover != null && hover < vistos) VIZ.marcador(ctx, pl.sx(pts[hover][0]), pl.sy(pts[hover][1]), C.tinta, 3);
      caja.replaceChildren(tablaDual(h, nombres, 4, 6));
      const nb = base(h), z = h.T[4][6];
      if (h.estado === 'pivote') {
        registro.textContent = `Paso ${vistos - 1}: ${sub(nombres[h.base[h.r]])} = ${VIZ.fmt(h.T[h.r][6])} es negativa, así que la solución viola una restricción; sale de la base. La razón mínima |costo reducido / coeficiente| = ${VIZ.fmt(h.razones[h.e])} la tiene ${sub(nombres[h.e])}, que entra.`;
      } else if (h.estado === 'optimo') {
        registro.textContent = vistos === 1
          ? `El óptimo actual (6, 4) cumple la restricción nueva (da ${VIZ.fmt(cf[0] * 6 + cf[1] * 4)} ≤ ${VIZ.fmt(g)}): la base no cambia y no se hace ningún pivote.`
          : `Ya no hay variables negativas: nuevo óptimo (${VIZ.fmt(pts[vistos - 1][0])}, ${VIZ.fmt(pts[vistos - 1][1])}) con z* = ${VIZ.fmt(z)}, base ${nb}. La restricción nueva costó ${VIZ.fmt(Z0 - z)} de utilidad.`;
      } else registro.textContent = 'La fila infactible no tiene coeficientes negativos: con la restricción nueva el problema es infactible.';
      lectura.set([
        ['¿el óptimo actual la viola?', viola ? 'sí' : 'no'],
        ['base actual', nb],
        ['valor z actual', VIZ.fmt(z)],
        ['z* original', VIZ.fmt(Z0)],
        ['pivotes del dual', String(hist.filter((q) => q.estado === 'pivote').length)],
        ['pivotes desde cero (primal)', String(primal)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const canvas = lienzo.canvas;
    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      g = Math.min(40, Math.max(0, Math.round((cf[0] * pl.ix(x) + cf[1] * pl.iy(y)) * 2) / 2)); s3.valor = g;
      rep.reiniciar();
    });
    canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      const pts = hist.slice(0, vistos).map(punto);
      const k = pts.findIndex((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 12);
      hover = k >= 0 ? k : null;
      dibujar();
      if (k < 0) return tip.ocultar();
      const h = hist[k];
      tip.mostrar(x, y, `paso <b>${k}</b>: base <b>${base(h)}</b><br>(x₁, x₂) = (<b>${VIZ.fmt(pts[k][0])}</b>, <b>${VIZ.fmt(pts[k][1])}</b>)<br>z = <b>${VIZ.fmt(h.T[4][6])}</b><br>${infact(h) ? 'infactible' : 'factible'}`);
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('new-variables-pricing', {
    intro: String.raw`
      <p>Una vez resuelto un plan, aparecen ideas nuevas: un producto que no se consideró, un proceso alternativo, una restricción que faltaba.
      Volver a resolver todo sería un desperdicio, porque el plan óptimo ya contiene la información que hace falta: los <strong>precios sombra</strong>, es decir, cuánto valen en el
      margen los recursos. Una actividad nueva conviene solo si lo que rinde supera el valor de los recursos que consumiría, valorados a esos precios.</p>
      <p>Esa comparación es el <em>costo reducido</em> de la nueva columna, \(d_j = c_j - y^\top a_j\). Si es positivo la actividad entra a la base y mejora el plan; si no, el plan actual sigue siendo óptimo.
      Agregar una restricción es el problema espejo: si el óptimo actual la cumple no pasa nada, y si la viola, el Simplex dual repara la solución con pocos pivotes.</p>`,
    visualizaciones: [
      {
        titulo: 'Costo reducido de una nueva actividad',
        descripcion: 'Cambie la utilidad y el consumo de la actividad: la barra superior suma lo que valen los recursos que usa (precio sombra por consumo) y la inferior su utilidad. Pulse «Poner c₃ en el punto de equilibrio»: ahí d₃ = 0 y, en la curva de abajo, justo en ese codo el valor óptimo empieza a subir.',
        montar: montarColumna,
      },
      {
        titulo: 'Agregar una restricción y reoptimizar',
        descripcion: 'Con los valores iniciales la nueva restricción corta el óptimo (6, 4). Pulse Un paso para ver cómo el Simplex dual saca la holgura negativa y llega al nuevo óptimo; después suba el lado derecho hasta 10 o más y compruebe que el plan ya no cambia.',
        montar: montarRestriccion,
      },
    ],
    teoria: String.raw`
      <h2>Una columna nueva: valoración (pricing out)</h2>
      <p>Sea \(B\) una base óptima del problema \(\max\, c^\top x,\ Ax\le b,\ x\ge 0\), con precios sombra \(y^\top = c_B^\top B^{-1}\). Se propone una actividad nueva con utilidad \(c_{n+1}\) y columna de consumos \(a_{n+1}\).
      La base \(B\) sigue siendo factible (\(B^{-1}b\) no cambió); lo único que se debe comprobar es la condición de optimalidad de la columna nueva:</p>
      \[ d_{n+1} = c_{n+1} - y^\top a_{n+1} \le 0 \quad\Longrightarrow\quad \text{el plan actual sigue siendo óptimo.} \]
      <p>Si \(d_{n+1}>0\) la actividad es rentable: \(y^\top a_{n+1}\) es su <em>costo de oportunidad</em> (lo que se deja de ganar al sacar esos recursos de los usos actuales) y \(c_{n+1}\) lo supera.
      Entonces \(x_{n+1}\) entra a la base: se calcula la columna \(\alpha = B^{-1}a_{n+1}\), se aplica la razón mínima \(\min_{\alpha_r>0} x_{B,r}/\alpha_r\) y se continúa con el
      <a href="tema.html?id=simplex-tableau">Simplex</a> desde la base actual, que ya es casi óptima.</p>
      <div class="recuadro"><strong>Ejemplo resuelto.</strong> Para \(\max\; 3x_1+2x_2\) con \(2x_1+x_2\le16\), \(x_1+2x_2\le14\), \(x_1\le 7\), los precios son \(y=(\tfrac43,\tfrac13,0)\) y \(z^*=26\).
      Una actividad con \(a=(1,1,2)\) usa recursos que valen \(\tfrac43+\tfrac13+0 = \tfrac53\approx 1.67\) por unidad. Con \(c_3=3\), \(d_3 = 3-\tfrac53 = \tfrac43 > 0\): conviene. Con \(c_3 = 1.5\), \(d_3 <0\): no conviene aunque su utilidad sea positiva.
      Nótese que \(R_3\) no pesa en el costo, porque su precio sombra es 0: el cupo de \(x_1\) no es escaso.</div>
      <h2>Análisis marginal y valor óptimo</h2>
      <p>El valor óptimo como función de la utilidad \(c_{n+1}\) es constante (\(=z^*\)) hasta el punto de equilibrio \(c_{n+1}^{\,0} = y^\top a_{n+1}\) y, a partir de él, crece con pendiente \(x_{n+1}^*>0\) (el nivel al que se produce) y luego
      con más tramos al cambiar la base. Es una función convexa y lineal por tramos en \(c_{n+1}\), igual que en <a href="tema.html?id=objective-coefficient-ranges">los rangos de utilidades</a>.
      El precio sombra es entonces un <em>precio de referencia</em>: ningún producto nuevo que rinda menos que \(y^\top a\) entra al plan.</p>
      <h2>Una restricción nueva</h2>
      <p>Agregar \(\alpha^\top x \le \gamma\) añade una fila y una holgura \(s\). Se escribe la fila en términos de las variables no básicas (restando las filas de las básicas que aparecen en \(\alpha\)) y se hace básica a \(s\):</p>
      <ul>
        <li>Si el óptimo \(x^*\) cumple \(\alpha^\top x^*\le\gamma\), la holgura nueva es no negativa: el plan sigue siendo óptimo y factible, sin ningún pivote.</li>
        <li>Si lo viola, \(s = \gamma - \alpha^\top x^* <0\): la base queda <em>dual factible pero primal infactible</em>, que es el punto de partida del <strong>Simplex dual</strong> (ver <a href="tema.html?id=basis-stability">estabilidad de bases</a>). La fila de \(s\) sale, y la razón mínima \(|d_j|/|\alpha_{sj}|\) elige la columna que entra.</li>
      </ul>
      <p>Es lo que hacen los <a href="tema.html?id=cutting-planes">planos cortantes</a>: agregan una desigualdad válida que corta la solución fraccionaria y reoptimizan con el dual. Como el nuevo óptimo es un problema más restringido, \(z^*\) nunca aumenta.</p>
      <h2>Conexiones</h2>
      <ul>
        <li>Los precios sombra y su significado económico: <a href="tema.html?id=shadow-prices">precios sombra</a> y <a href="tema.html?id=weak-duality">dualidad débil</a>. Que ninguna columna tenga \(d_j>0\) equivale a que \(y\) sea factible en el dual.</li>
        <li>Generar columnas sin enumerarlas es la idea de la <em>generación de columnas</em> en problemas grandes: se resuelve un subproblema que busca la columna con mayor costo reducido.</li>
        <li>Los intervalos de recursos en que los precios son válidos: <a href="tema.html?id=rhs-ranges">intervalos de disponibilidad</a>.</li>
      </ul>`,
  });
})();
