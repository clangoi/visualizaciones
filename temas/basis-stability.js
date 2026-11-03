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
  const ESC = { b: { x: [-5, 35], y: [-5, 30], ex: 'b₁', ey: 'b₂' }, c: { x: [-4, 8], y: [-4, 8], ex: 'c₁', ey: 'c₂' } };

  /* ---------- Fig. 1: mapa de bases óptimas en el plano de parámetros ---------- */

  function montarMapa(cuerpo) {
    let modo = 'b', b3 = B0[2], pl = null, cache = null, hover = null, arrastrando = false, M = null, B = null;
    const P = { b: [B0[0], B0[1]], c: [C0[0], C0[1]] };
    const color = new Map(); // base → índice de color (estable mientras dure la figura)
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Plano de parámetros', opciones: [['b', 'Recursos (b₁, b₂)'], ['c', 'Utilidades (c₁, c₂)']], valor: modo,
      alCambiar: (v) => { modo = v; sB3.input.disabled = v !== 'b'; refrescar(); } });
    const sB3 = ctl.rango({ etiqueta: 'Cupo b₃ (fijo en el plano de recursos)', min: 0, max: 14, paso: 0.1, valor: b3, formato: (v) => v.toFixed(1), alCambiar: (v) => { b3 = v; refrescar(); } });
    ctl.boton('Volver al punto original', () => { P.b = [B0[0], B0[1]]; P.c = [C0[0], C0[1]]; b3 = B0[2]; sB3.valor = b3; refrescar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.72, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para colocar el punto de parámetros. La cruz negra muestra cuánto puede variar cada parámetro por separado sin salir de su región; el mapa completo muestra qué ocurre al variar los dos a la vez.');

    const vecs = () => ({ c: modo === 'c' ? P.c : C0, b: modo === 'b' ? [P.b[0], P.b[1], b3] : B0 });
    function refrescar() {
      const { c, b } = vecs();
      M = motor(c, A0, b);
      B = optima(M);
      const e = ESC[modo], p = P[modo];
      if (!B) {
        registro.textContent = `Con (${e.ex}, ${e.ey}) = (${VIZ.fmt(p[0])}, ${VIZ.fmt(p[1])}) algún recurso es negativo y el problema es infactible: ninguna base es óptima aquí (zona gris).`;
        lectura.set([['punto', `(${VIZ.fmt(p[0])}, ${VIZ.fmt(p[1])})`], ['estado', 'infactible']]);
      } else {
        const r = [0, 1].map((k) => (modo === 'b' ? rangoB(B, k) : rangoCosto(M, B, k)));
        const x = solucion(M, B);
        registro.textContent = `Con (${e.ex}, ${e.ey}) = (${VIZ.fmt(p[0])}, ${VIZ.fmt(p[1])}) la base óptima es ${etiquetaBase(M, B)}, con vértice (${VIZ.fmt(x[0])}, ${VIZ.fmt(x[1])}) y z* = ${VIZ.fmt(B.z)}. `
          + `Mientras se mueva solo ${e.ex} la base se mantiene en ${intervalo(p[0] + r[0][0], p[0] + r[0][1])}; solo ${e.ey}, en ${intervalo(p[1] + r[1][0], p[1] + r[1][1])}.`;
        lectura.set([
          ['punto', `(${VIZ.fmt(p[0])}, ${VIZ.fmt(p[1])})`],
          ['base óptima', etiquetaBase(M, B)],
          ['vértice', `(${VIZ.fmt(x[0])}, ${VIZ.fmt(x[1])})`],
          ['valor z*', VIZ.fmt(B.z)],
          [`${e.ex} en`, intervalo(p[0] + r[0][0], p[0] + r[0][1])],
          [`${e.ey} en`, intervalo(p[1] + r[1][0], p[1] + r[1][1])],
        ]);
      }
      dibujar();
    }

    // Clasificador: bases candidatas según el plano (las dual factibles para b, las primal factibles para c).
    function candidatas() {
      const M0 = motor(C0, A0, B0);
      return modo === 'b' ? M0.bases.filter((q) => dualOk(q)) : M0.bases.filter((q) => primalOk(q));
    }
    function evaluar(lista, v1, v2) {
      for (const q of lista) {
        if (modo === 'b') {
          const bb = [v1, v2, b3], xB = q.inv.map((f) => f.reduce((s, v, i) => s + v * bb[i], 0));
          if (xB.every((v) => v >= -1e-9)) return { q, xB, z: q.idx.reduce((s, j, r) => s + (j < 2 ? C0[j] * xB[r] : 0), 0) };
        } else {
          const ce = [v1, v2, 0, 0, 0];
          if (q.N[0].every((_, j) => ce[j] - q.idx.reduce((s, k, r) => s + ce[k] * q.N[r][j], 0) <= 1e-9)) {
            return { q, xB: q.xB, z: q.idx.reduce((s, j, r) => s + (j < 2 ? ce[j] * q.xB[r] : 0), 0) };
          }
        }
      }
      return null;
    }
    function construir() {
      const e = ESC[modo], gw = Math.max(40, Math.round((pl.x1 - pl.x0) / 2)), gh = Math.max(40, Math.round((pl.y0 - pl.y1) / 2));
      const lista = candidatas(), clases = new Map();
      const off = document.createElement('canvas');
      off.width = gw; off.height = gh;
      const octx = off.getContext('2d'), img = octx.createImageData(gw, gh);
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const v1 = e.x[0] + ((i + 0.5) / gw) * (e.x[1] - e.x[0]), v2 = e.y[1] - ((j + 0.5) / gh) * (e.y[1] - e.y[0]);
          const r = evaluar(lista, v1, v2), key = r ? claveBase(r.q) : 'infactible';
          let k = clases.get(key);
          if (!k) { k = { key, q: r && r.q, n: 0, sx: 0, sy: 0 }; clases.set(key, k); }
          k.n++; k.sx += i; k.sy += j;
          let rgb;
          if (!r) rgb = VIZ.rgb(C.neutro);
          else {
            if (!color.has(key)) color.set(key, color.size);
            const c = VIZ.rgb(COL[color.get(key) % 8]);
            rgb = c.map((v) => 255 - (255 - v) * 0.38);
          }
          const o = 4 * (j * gw + i);
          img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      const Mm = motor(C0, A0, B0);
      const orden = [...clases.values()].sort((a, b) => b.n - a.n);
      leyenda.set([
        ...orden.filter((k) => k.q).map((k) => ({ color: VIZ.alfa(COL[color.get(k.key) % 8], 0.38), borde: COL[color.get(k.key) % 8], texto: `base ${etiquetaBase(Mm, k.q)}` })),
        ...(clases.has('infactible') ? [{ color: C.neutro, borde: C.apagado, texto: 'infactible (algún recurso negativo)' }] : []),
        { color: C.tinta, texto: 'punto actual y su cruz de intervalos', forma: 'punto' },
      ]);
      cache = { clave: `${modo}|${b3}|${lienzo.ancho}|${lienzo.alto}`, off, clases: orden, lista, Mm, gw, gh };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const e = ESC[modo];
      pl = VIZ.plano(lienzo, { xmin: e.x[0], xmax: e.x[1], ymin: e.y[0], ymax: e.y[1] }, { etiquetaX: e.ex, etiquetaY: e.ey });
      if (!cache || cache.clave !== `${modo}|${b3}|${lienzo.ancho}|${lienzo.alto}`) construir();
      ctx.drawImage(cache.off, pl.x0, pl.y1, pl.x1 - pl.x0, pl.y0 - pl.y1);
      pl.ejes();
      ctx.save(); pl.recortar();
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.y0); ctx.lineTo(pl.sx(0), pl.y1); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke();
      ctx.restore();
      cache.clases.forEach((k) => {
        if (!k.q || k.n < cache.gw * cache.gh * 0.012) return;
        const px = pl.x0 + (k.sx / k.n / cache.gw) * (pl.x1 - pl.x0), py = pl.y1 + (k.sy / k.n / cache.gh) * (pl.y0 - pl.y1);
        texto(ctx, etiquetaBase(cache.Mm, k.q), px, py, C.tinta, 'center', 'middle', 11);
      });
      if (B) {
        const p = P[modo], r = [0, 1].map((k) => (modo === 'b' ? rangoB(B, k) : rangoCosto(M, B, k)));
        const cl = (v, k) => Math.min(e[k ? 'y' : 'x'][1], Math.max(e[k ? 'y' : 'x'][0], v));
        const hx = [cl(p[0] + r[0][0], 0), cl(p[0] + r[0][1], 0)], vy = [cl(p[1] + r[1][0], 1), cl(p[1] + r[1][1], 1)];
        ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(pl.sx(hx[0]), pl.sy(p[1])); ctx.lineTo(pl.sx(hx[1]), pl.sy(p[1])); ctx.moveTo(pl.sx(p[0]), pl.sy(vy[0])); ctx.lineTo(pl.sx(p[0]), pl.sy(vy[1])); ctx.stroke();
        ctx.lineWidth = 2;
        [[hx[0], p[1], 1], [hx[1], p[1], 1], [p[0], vy[0], 0], [p[0], vy[1], 0]].forEach(([a, b2, h]) => {
          ctx.beginPath();
          if (h) { ctx.moveTo(pl.sx(a), pl.sy(b2) - 5); ctx.lineTo(pl.sx(a), pl.sy(b2) + 5); } else { ctx.moveTo(pl.sx(a) - 5, pl.sy(b2)); ctx.lineTo(pl.sx(a) + 5, pl.sy(b2)); }
          ctx.stroke();
        });
        ctx.restore();
      }
      VIZ.marcador(ctx, pl.sx(P[modo][0]), pl.sy(P[modo][1]), C.tinta, 6);
      if (hover) VIZ.marcador(ctx, pl.sx(hover[0]), pl.sy(hover[1]), C.superficie, 3.5);
    }
    lienzo.alDibujar = () => dibujar();

    const canvas = lienzo.canvas;
    canvas.style.cursor = 'crosshair';
    const dato = (ev) => {
      const { x, y } = lienzo.posicion(ev), e = ESC[modo];
      return { x, y, v: [Math.min(e.x[1], Math.max(e.x[0], pl.ix(x))), Math.min(e.y[1], Math.max(e.y[0], pl.iy(y)))] };
    };
    const fijar = (ev) => { const { v } = dato(ev); P[modo] = [Math.round(v[0] * 20) / 20, Math.round(v[1] * 20) / 20]; refrescar(); };
    canvas.addEventListener('pointerdown', (ev) => { arrastrando = true; canvas.setPointerCapture(ev.pointerId); tip.ocultar(); fijar(ev); });
    canvas.addEventListener('pointerup', () => { arrastrando = false; });
    canvas.addEventListener('pointermove', (ev) => {
      if (arrastrando) return fijar(ev);
      const { x, y, v } = dato(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = v; dibujar();
      const r = evaluar(cache.lista, v[0], v[1]), e = ESC[modo];
      tip.mostrar(x, y, `(${e.ex}, ${e.ey}) = (<b>${VIZ.fmt(v[0])}</b>, <b>${VIZ.fmt(v[1])}</b>)`
        + (r ? `<br>base <b>${etiquetaBase(cache.Mm, r.q)}</b><br>z* = <b>${VIZ.fmt(r.z)}</b>` : '<br><b>infactible</b>'));
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    sB3.input.disabled = modo !== 'b';
    refrescar();
  }

  /* ---------- Fig. 2: reoptimización con el Simplex dual ---------- */

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
  const pivotesDesdeCero = (b) => { let n = 0; for (const s of VIZ.opt.simplex(C0, A0, b)) if (s.estado === 'iterando') n++; return n; };

  function montarDual(cuerpo) {
    let i = 0, hist = [], vistos = 1, M0, Bo, nuevoB = B0.slice(), pl = null, hover = null, primal = 0;
    nuevoB[0] = 26;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Recurso que cambia', opciones: RECURSOS.map((t, k) => [k, `R${k + 1}: ${t}`]), valor: 0,
      alCambiar: (v) => { i = +v; nuevoB = B0.slice(); nuevoB[i] = i === 0 ? 26 : i === 1 ? 6 : 3; sV.max = i === 2 ? 14 : 40; sV.valor = nuevoB[i]; rep.reiniciar(); } });
    const sV = ctl.rango({ etiqueta: 'Nueva disponibilidad', min: 0, max: 40, paso: 0.5, valor: nuevoB[0], formato: (v) => v.toFixed(1), alCambiar: (v) => { nuevoB[i] = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), borde: C.s1, texto: 'región factible nueva' },
      { color: C.apagado, texto: 'restricción en su posición original', forma: 'linea' },
      { color: C.superficie, borde: C.s8, texto: 'solución básica infactible (alguna variable < 0)', forma: 'punto' },
      { color: C.s6, texto: 'solución factible: óptimo', forma: 'punto' },
      { color: C.s7, texto: 'fila y columna del pivote (tableau)' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un recurso y una nueva disponibilidad; la base óptima anterior deja de ser factible. Pulse Un paso: el Simplex dual saca la variable más negativa y recorre soluciones infactibles hasta volver a la región factible.');

    function iniciar() {
      M0 = motor(C0, A0, B0); Bo = optima(M0);
      const m = M0.m, cols = M0.cols;
      const rhs = Bo.inv.map((f) => f.reduce((s, v, k) => s + v * nuevoB[k], 0));
      const z = Bo.idx.reduce((s, j, r) => s + M0.cext[j] * rhs[r], 0);
      const T = Bo.N.map((f, r) => [...f, rhs[r]]);
      T.push([...Bo.d.map((v) => -v), z]);
      hist = simplexDual(T, Bo.idx, m, cols);
      primal = pivotesDesdeCero(nuevoB);
      vistos = 1;
      return (function* () { for (let k = 1; k < hist.length; k++) { vistos = k + 1; yield; } })();
    }
    const punto = (h) => { const x = [0, 0]; h.base.forEach((j, r) => { if (j < 2) x[j] = h.T[r][M0.cols]; }); return x; };
    const infact = (h) => h.base.some((_, r) => h.T[r][M0.cols] < -1e-9);

    function dibujar() {
      if (!hist.length) return;
      const { ctx } = lienzo, h = hist[vistos - 1];
      lienzo.limpiar();
      const poli = poligono(A0, nuevoB), pts = hist.map(punto);
      const todos = [...poli, ...pts, [0, 0]];
      pl = planoAuto(lienzo, todos);
      pl.ejes();
      ctx.save(); pl.recortar();
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.y0); ctx.lineTo(pl.sx(0), pl.y1); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke();
      ctx.restore();
      rellenar(ctx, pl, poli, VIZ.alfa(C.s1, 0.14));
      A0.forEach((a, k) => { if (k === i) recta(ctx, pl, a, B0[k], C.apagado, 1.5, [5, 4]); recta(ctx, pl, a, nuevoB[k], k === i ? C.s1 : C.tinta2, k === i ? 3 : 1.5); });
      for (let k = 1; k < vistos; k++) flecha(ctx, pl.sx(pts[k - 1][0]), pl.sy(pts[k - 1][1]), pl.sx(pts[k][0]), pl.sy(pts[k][1]), C.s7, 2);
      pts.slice(0, vistos).forEach((p, k) => {
        const malo = infact(hist[k]);
        VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), malo ? C.superficie : C.s6, 6);
        if (malo) { ctx.save(); ctx.strokeStyle = C.s8; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(pl.sx(p[0]), pl.sy(p[1]), 6.5, 0, 7); ctx.stroke(); ctx.restore(); }
        texto(ctx, String(k), pl.sx(p[0]) + 9, pl.sy(p[1]) - 9, C.tinta, 'left', 'bottom', 12);
      });
      if (hover != null && hover < vistos) VIZ.marcador(ctx, pl.sx(pts[hover][0]), pl.sy(pts[hover][1]), C.tinta, 3);
      caja.replaceChildren(tablaDual(h, M0.nombres, M0.m, M0.cols));
      const neg = h.base.filter((_, r) => h.T[r][M0.cols] < -1e-9).map((j) => sub(M0.nombres[j]));
      const nb = (k) => etiquetaBase(M0, { idx: hist[k].base });
      if (h.estado === 'pivote') {
        const r = h.r, e = h.e;
        registro.textContent = `Paso ${vistos - 1}: ${sub(M0.nombres[h.base[r]])} = ${VIZ.fmt(h.T[r][M0.cols])} es negativa (infactible); sale de la base. Entre las columnas con coeficiente negativo en su fila, la razón mínima |costo reducido / coeficiente| = ${VIZ.fmt(h.razones[e])} la tiene ${sub(M0.nombres[e])}, que entra.`;
      } else if (h.estado === 'optimo') {
        registro.textContent = vistos === 1 ? `La base ${nb(0)} sigue siendo factible con la nueva disponibilidad: no hace falta ningún pivote.`
          : `Todas las variables básicas son no negativas y los costos reducidos siguen en su signo óptimo: base ${nb(vistos - 1)}, óptimo (${VIZ.fmt(pts[vistos - 1][0])}, ${VIZ.fmt(pts[vistos - 1][1])}) con z* = ${VIZ.fmt(h.T[M0.m][M0.cols])}.`;
      } else registro.textContent = 'La fila elegida no tiene coeficientes negativos: el problema sería infactible.';
      lectura.set([
        ['base inicial', nb(0)],
        ['base actual', nb(vistos - 1)],
        ['variables negativas', neg.length ? neg.join(', ') : 'ninguna'],
        ['valor z actual', VIZ.fmt(h.T[M0.m][M0.cols])],
        ['pivotes del dual', String(Math.max(0, hist.filter((q) => q.estado === 'pivote').length))],
        ['pivotes desde cero (primal)', String(primal)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const canvas = lienzo.canvas;
    canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      const pts = hist.slice(0, vistos).map(punto);
      const k = pts.findIndex((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 12);
      hover = k >= 0 ? k : null;
      dibujar();
      if (k < 0) return tip.ocultar();
      const h = hist[k];
      tip.mostrar(x, y, `paso <b>${k}</b>: base <b>${etiquetaBase(M0, { idx: h.base })}</b><br>(x₁, x₂) = (<b>${VIZ.fmt(pts[k][0])}</b>, <b>${VIZ.fmt(pts[k][1])}</b>)<br>z = <b>${VIZ.fmt(h.T[M0.m][M0.cols])}</b><br>${infact(h) ? 'infactible' : 'factible'}`);
    });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('basis-stability', {
    intro: String.raw`
      <p>Cada base óptima de un problema lineal es válida solo en una zona del espacio de parámetros: mientras los recursos o las utilidades queden en esa zona, el plan conserva
      las mismas variables básicas; al cruzar su frontera, el plan cambia de estructura. Dibujar esas zonas sobre un plano \((b_1,b_2)\) o \((c_1,c_2)\) da un mapa que
      responde de una vez a muchas preguntas de sensibilidad: qué tan lejos está cada parámetro del siguiente cambio, qué bases son vecinas y cuáles se pueden alcanzar.</p>
      <p>Cuando el cambio sí cruza la frontera de los recursos, la base anterior deja de ser factible pero conserva sus costos reducidos con el signo correcto. Esa es la
      situación del <strong>Simplex dual</strong>: en lugar de resolver desde cero, se repara la factibilidad con unos pocos pivotes, y por eso los solucionadores reoptimizan con rapidez.</p>`,
    visualizaciones: [
      {
        titulo: 'Mapa de bases óptimas',
        descripcion: 'Cada color es una base óptima distinta. Arrastre el punto por el plano: cuando cruza una frontera cambian las variables básicas, y la cruz negra muestra el intervalo de cada parámetro por separado (que siempre es una cuerda de la región). Cambie entre recursos y utilidades, y mueva b₃ para ver cómo se deforma el mapa.',
        montar: montarMapa,
      },
      {
        titulo: 'Reoptimizar con el Simplex dual',
        descripcion: 'Cambie la disponibilidad de un recurso hasta que la base óptima deje de ser factible y avance con Un paso: las soluciones infactibles (con anillo rojo) se corrigen una por una hasta llegar a la región factible. Compare los pivotes del dual con los que haría el Simplex primal desde cero.',
        montar: montarDual,
      },
    ],
    teoria: String.raw`
      <h2>Regiones de estabilidad</h2>
      <p>Para una base fija \(B\), la matriz \(B\) no depende de \(b\) ni de \(c\), de modo que:</p>
      <ul>
        <li>la <strong>factibilidad primal</strong> \(B^{-1}b \ge 0\) es un sistema de desigualdades lineales en \(b\): define un <em>cono poliedral</em> \(R_B\) en el espacio de recursos;</li>
        <li>la <strong>factibilidad dual</strong> \(c_B^\top B^{-1}A - c^\top \ge 0\) (costos reducidos \(d\le 0\)) es lineal en \(c\): define otro cono \(S_B\) en el espacio de costos.</li>
      </ul>
      <p>La base \(B\) es óptima exactamente cuando \(b\in R_B\) y \(c\in S_B\). Fijado \(c\), las regiones \(R_B\) de las bases dual factibles cubren el conjunto de recursos para los que el problema es factible, y se tocan solo en sus fronteras; fijado \(b\), las regiones \(S_B\) de las bases primal factibles
      recubren todo el espacio de costos (son los conos normales de los vértices del polígono). Por eso el mapa de la figura 1 no tiene huecos salvo la zona gris, donde algún recurso es negativo y el problema es infactible.</p>
      <div class="recuadro"><strong>Ejemplo.</strong> Con \(c=(3,2)\) y \(b_3 = 7\), la base \(\{x_1,x_2,s_3\}\) exige \(x_1=\tfrac{2b_1-b_2}{3}\ge 0\), \(x_2=\tfrac{2b_2-b_1}{3}\ge0\) y \(s_3 = 7-x_1\ge 0\): es el cono entre las rectas \(b_2=2b_1\) y \(b_1=2b_2\), recortado por \(2b_1-b_2\le 21\). En el plano de utilidades, el vértice \((6,4)\) es óptimo cuando \(c\) está en el cono generado por \((2,1)\) y \((1,2)\), es decir \(\tfrac12\le c_1/c_2\le 2\).</div>
      <h2>Simplex dual</h2>
      <p>Si \(b\) cambia a \(b'\) y \(B^{-1}b'\) tiene componentes negativas, la base sigue siendo dual factible. El método dual mantiene \(d\le 0\) y recorre soluciones básicas infactibles hasta lograr \(x_B\ge 0\):</p>
      <pre><code>mientras exista r con (B⁻¹b)_r &lt; 0:
    fila r ← la más negativa                    (sale x_B[r])
    si todo α_rj ≥ 0:  devolver «infactible»
    columna e ← argmin { |d_j| / |α_rj| : α_rj &lt; 0 }   (entra x_e)
    pivotear en (r, e)
devolver la base actual                        (óptima)</code></pre>
      <p>La razón mínima garantiza que, tras el pivote, todos los costos reducidos conservan su signo. Cada pivote disminuye (en maximización) el valor \(z\) hasta llegar al óptimo del problema nuevo. Es el espejo del <a href="tema.html?id=simplex-tableau">Simplex primal</a>:
      allí se fija primero la fila de salida por razón mínima de factibilidad; aquí se elige primero la fila infactible y la razón mínima decide la columna.</p>
      <h2>Para qué sirve</h2>
      <ul>
        <li><strong>Postoptimización</strong>: cambiar un recurso, agregar una restricción (véase <a href="tema.html?id=new-variables-pricing">nuevas variables y restricciones</a>) o un corte (<a href="tema.html?id=cutting-planes">planos cortantes</a>) deja una base dual factible y se repara con el dual.</li>
        <li><strong>Ramificación y acotamiento</strong>: en cada nodo se agrega una cota a una variable y se reoptimiza desde la base del padre (<a href="tema.html?id=milp-branch-and-bound">ramificación y acotamiento para MILP</a>).</li>
        <li><strong>Análisis de intervalos</strong>: los límites de los intervalos de <a href="tema.html?id=rhs-ranges">recursos</a> y <a href="tema.html?id=objective-coefficient-ranges">costos</a> son los cortes del mapa con los ejes que pasan por el punto actual.</li>
      </ul>
      <h2>Degeneración y fronteras</h2>
      <p>En un punto de frontera el problema suele ser degenerado: más de una base describe el mismo vértice, o varios vértices son óptimos a la vez (óptimos alternativos). Las regiones de las dos bases se tocan allí y el mapa colorea la frontera con la primera base que encuentra. Ver <a href="tema.html?id=degeneracy-cycling">degeneración y ciclaje</a>.</p>`,
  });
})();
