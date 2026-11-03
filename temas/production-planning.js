(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  const PROD = ['mesas', 'sillas'];
  // Recursos: horas de carpintería, horas de pintura y metros cuadrados de madera por unidad producida.
  const RES = [
    { n: 'Carpintería', u: 'h', a: [3, 2] },
    { n: 'Pintura', u: 'h', a: [1, 2] },
    { n: 'Madera', u: 'm²', a: [2, 1] },
  ];
  const BASE = { cap: [80, 48, 55], m: [50, 40] };
  const COL = [C.s1, C.s2, C.s3];
  const limpio = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
  const bajo = (t) => t[0].toLowerCase() + t.slice(1);

  // Resuelve max m·x s.a. A x ≤ cap, x ≥ 0: polígono, vértice óptimo, uso de cada recurso y precios sombra del Simplex.
  function modelo(cap, m) {
    const restr = RES.map((r, i) => ({ a: r.a, b: cap[i] }));
    const poli = O.poligono([...restr, { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }], { xmin: 0, xmax: 1e3, ymin: 0, ymax: 1e3 })
      .map((p) => p.map(limpio));
    const opt = O.optimo2d(poli, m);
    let fin = null;
    for (const s of O.simplex(m, RES.map((r) => r.a), cap)) fin = s;
    const x = opt.x.map(limpio);
    const uso = RES.map((r) => r.a[0] * x[0] + r.a[1] * x[1]);
    return { restr, poli, x, z: opt.z, duales: fin.duales.map(limpio), uso, activa: uso.map((u, i) => Math.abs(u - cap[i]) <= 1e-6 * (1 + cap[i])) };
  }
  const zEstrella = (cap, m) => modelo(cap, m).z;
  const dominio = (poli) => Math.max(20, Math.ceil((Math.max(...poli.flat()) * 1.12) / 5) * 5);

  // Región factible, rectas de los recursos y vértices.
  function dibujarRegion(lienzo, M, D, etiquetas) {
    const { ctx } = lienzo;
    const pl = VIZ.plano(lienzo, { xmin: 0, xmax: D, ymin: 0, ymax: D }, etiquetas);
    pl.ejes();
    ctx.beginPath();
    M.poli.forEach(([x, y], i) => (i ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y))));
    ctx.closePath();
    ctx.fillStyle = VIZ.alfa(C.s1, 0.14);
    ctx.fill();
    ctx.save();
    pl.recortar();
    ctx.lineWidth = 2;
    RES.forEach((r, i) => {
      ctx.strokeStyle = COL[i];
      ctx.beginPath();
      const b = M.restr[i].b;
      ctx.moveTo(pl.sx(0), pl.sy(b / r.a[1]));
      ctx.lineTo(pl.sx(D), pl.sy((b - r.a[0] * D) / r.a[1]));
      ctx.stroke();
    });
    ctx.restore();
    return pl;
  }
  // Recta m·x = z (igual beneficio).
  function rectaBeneficio(lienzo, pl, m, z, D, color) {
    const { ctx } = lienzo;
    ctx.save();
    pl.recortar();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (m[1] > 1e-9) { ctx.moveTo(pl.sx(0), pl.sy(z / m[1])); ctx.lineTo(pl.sx(D), pl.sy((z - m[0] * D) / m[1])); }
    else if (m[0] > 1e-9) { ctx.moveTo(pl.sx(z / m[0]), pl.sy(0)); ctx.lineTo(pl.sx(z / m[0]), pl.sy(D)); }
    ctx.stroke();
    ctx.restore();
  }
  const leyendaRegion = (cuerpo, extra) => VIZ.leyenda(cuerpo, [
    ...RES.map((r, i) => ({ color: COL[i], texto: `${r.n} (${r.u})`, forma: 'linea' })),
    { color: VIZ.alfa(C.s1, 0.18), texto: 'región factible', borde: C.s1 },
    ...extra,
  ]);
  const textoRecursos = (M, cap) => RES.map((r, i) => `${r.n} ${VIZ.fmt(M.uso[i], 3)} de ${VIZ.fmt(cap[i])} ${r.u}`);

  /* ---------- Fig. 1: solución gráfica ---------- */

  function montarGrafica(cuerpo) {
    const q = { cap: BASE.cap.slice(), m: BASE.m.slice() };
    let M = null, D = 30, Z = 0, cand = null, pl = null, arrastra = false;

    const ctl = VIZ.controles(cuerpo);
    const rgC = RES.map((r, i) => ctl.rango({ etiqueta: `${r.n}`, min: 10, max: 160, valor: q.cap[i], formato: (v) => `${v} ${r.u}`, alCambiar: (v) => { q.cap[i] = v; calcular(); } }));
    const rgM = PROD.map((p, k) => ctl.rango({ etiqueta: `Margen de ${p}`, min: 5, max: 120, valor: q.m[k], formato: (v) => `USD ${v}`, alCambiar: (v) => { q.m[k] = v; calcular(); } }));
    const rZ = ctl.rango({ etiqueta: 'Beneficio Z de la recta', min: 0, max: 8000, paso: 10, valor: 0, formato: (v) => `USD ${VIZ.entero(v)}`, alCambiar: (v) => { Z = v; dibujar(); } });
    ctl.boton('Z = beneficio óptimo', () => { Z = M.z; rZ.valor = Z; dibujar(); }, { primario: true });
    ctl.boton('Restablecer datos', () => {
      q.cap = BASE.cap.slice(); q.m = BASE.m.slice(); cand = null;
      rgC.forEach((r, i) => { r.valor = q.cap[i]; });
      rgM.forEach((r, k) => { r.valor = q.m[k]; });
      calcular(true);
    });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 290, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    leyendaRegion(cuerpo, [
      { color: C.tinta2, texto: 'recta de igual beneficio Z', forma: 'linea' },
      { color: C.s6, texto: 'plan óptimo' },
      { color: C.tinta, texto: 'plan elegido (clic)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para elegir un plan de producción: la recta de igual beneficio pasa por él. Deslice Z o los márgenes y vea la recta empujarse hasta el último vértice de la región.');

    function calcular(ajustarZ) {
      M = modelo(q.cap, q.m);
      D = dominio(M.poli);
      if (ajustarZ || !Z) { Z = M.z; rZ.valor = Z; }
      dibujar();
    }
    const beneficio = (p) => q.m[0] * p[0] + q.m[1] * p[1];
    const factible = (p) => p[0] >= -1e-9 && p[1] >= -1e-9 && RES.every((r, i) => r.a[0] * p[0] + r.a[1] * p[1] <= q.cap[i] + 1e-9);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = dibujarRegion(lienzo, M, D, { etiquetaX: 'mesas producidas', etiquetaY: 'sillas producidas' });
      rectaBeneficio(lienzo, pl, q.m, Z, D, C.tinta2);
      // Flecha en la dirección de mejora (el vector de márgenes).
      const nm = Math.hypot(q.m[0], q.m[1]), ox = pl.sx(M.x[0]), oy = pl.sy(M.x[1]), ux = q.m[0] / nm, uy = -q.m[1] / nm;
      ctx.save();
      ctx.strokeStyle = C.tinta2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy); ctx.lineTo(ox + ux * 34, oy + uy * 34);
      ctx.moveTo(ox + ux * 34, oy + uy * 34); ctx.lineTo(ox + ux * 28 - uy * 4, oy + uy * 28 + ux * 4);
      ctx.moveTo(ox + ux * 34, oy + uy * 34); ctx.lineTo(ox + ux * 28 + uy * 4, oy + uy * 28 - ux * 4);
      ctx.stroke();
      ctx.restore();
      if (cand) VIZ.marcador(ctx, pl.sx(cand[0]), pl.sy(cand[1]), C.tinta, 5);
      VIZ.marcador(ctx, ox, oy, C.s6, 6);
      informar();
    }
    function informar() {
      const act = RES.filter((_, i) => M.activa[i]).map((r) => bajo(r.n));
      const sob = RES.map((r, i) => (M.activa[i] ? null : `${bajo(r.n)} (sobran ${VIZ.fmt(q.cap[i] - M.uso[i], 3)} ${r.u})`)).filter(Boolean);
      registro.textContent = `Óptimo: ${VIZ.fmt(M.x[0], 4)} mesas y ${VIZ.fmt(M.x[1], 4)} sillas, beneficio USD ${VIZ.fmt(M.z)}. `
        + (act.length ? `Se agotan ${act.join(' y ')}` : 'No se agota ningún recurso') + (sob.length ? `; sobra ${sob.join(' y ')}.` : '.');
      const ok = cand && factible(cand);
      lectura.set([
        ['producción óptima', `${VIZ.fmt(M.x[0], 4)} mesas · ${VIZ.fmt(M.x[1], 4)} sillas`],
        ['beneficio máximo', `USD ${VIZ.fmt(M.z)}`],
        ['recursos agotados', `${act.length} de ${RES.length}`],
        ['plan elegido', cand ? `USD ${VIZ.fmt(beneficio(cand))} (${ok ? 'factible' : 'no factible'})` : 'ninguno'],
      ]);
    }
    function elegir(ev) {
      const { x, y } = lienzo.posicion(ev);
      cand = [Math.max(0, Math.round(pl.ix(x) * 2) / 2), Math.max(0, Math.round(pl.iy(y) * 2) / 2)];
      Z = Math.min(8000, beneficio(cand)); rZ.valor = Z;
      dibujar();
    }
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const p = lienzo.posicion(ev);
      if (!pl || !pl.dentro(p.x, p.y)) return;
      if (ev.pointerType !== 'touch') { arrastra = true; lienzo.canvas.setPointerCapture(ev.pointerId); }
      elegir(ev);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastra = false; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (arrastra) elegir(ev);
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const p = [Math.max(0, pl.ix(x)), Math.max(0, pl.iy(y))];
      const filas = RES.map((r, i) => { const u = r.a[0] * p[0] + r.a[1] * p[1]; return VIZ.filaTooltip(COL[i], `${r.n}: ${VIZ.fmt(u, 3)} / ${VIZ.fmt(q.cap[i])} ${r.u}`, u <= q.cap[i] + 1e-9 ? 'ok' : 'excede'); });
      tip.mostrar(x, y, `${VIZ.fmt(p[0], 3)} mesas, ${VIZ.fmt(p[1], 3)} sillas<br>beneficio <b>USD ${VIZ.fmt(beneficio(p))}</b>${filas.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = () => M && dibujar();
    calcular(true);
  }

  /* ---------- Fig. 2: precios sombra ---------- */

  function montarPrecios(cuerpo) {
    let r = 0, b = BASE.cap[0], pl = null, curva = [], info = null, bMax = 1;
    const capCon = (i, v) => BASE.cap.map((c, k) => (k === i ? v : c));
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Recurso que cambia', opciones: RES.map((x, i) => [i, `${x.n} (${x.u})`]), valor: r, alCambiar: (v) => { r = +v; b = BASE.cap[r]; rg.max = Math.round(BASE.cap[r] * 2.2); rg.valor = b; recalcular(); } });
    const rg = ctl.rango({ etiqueta: 'Capacidad del recurso', min: 0, max: Math.round(BASE.cap[0] * 2.2), valor: b, alCambiar: (v) => { b = v; actualizar(); } });
    ctl.boton('Volver al valor inicial', () => { b = BASE.cap[r]; rg.valor = b; actualizar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'beneficio máximo según la capacidad', forma: 'linea' },
      { color: C.s2, texto: 'recta con pendiente = precio sombra', forma: 'linea' },
      { color: VIZ.alfa(C.s3, 0.2), texto: 'tramo donde ese precio no cambia', borde: C.s3 },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Deslice la capacidad: la curva es el beneficio máximo, y su pendiente es el precio sombra. Mientras la capacidad esté en el tramo sombreado, cada unidad extra vale lo mismo; fuera de él, el recurso deja de ser el cuello de botella o aparece otro.');

    const z = (v) => zEstrella(capCon(r, v), BASE.m);
    function recalcular() {
      bMax = Math.round(BASE.cap[r] * 2.2);
      curva = [];
      for (let k = 0; k <= 240; k++) { const v = (bMax * k) / 240; curva.push([v, z(v)]); }
      actualizar();
    }
    function actualizar() {
      const M = modelo(capCon(r, b), BASE.m), y = M.duales[r], z0 = M.z;
      const lineal = (v) => Math.abs(z(v) - z0 - y * (v - b)) <= 1e-7 * (1 + Math.abs(z0));
      const extremo = (hasta) => {
        if (lineal(hasta)) return hasta;
        let a = b, c = hasta;
        for (let k = 0; k < 40; k++) { const mid = (a + c) / 2; if (lineal(mid)) a = mid; else c = mid; }
        return a;
      };
      info = { M, y, z0, lo: extremo(0), hi: extremo(bMax), real: z(b + 1) - z0 };
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const zmax = curva[curva.length - 1][1];
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: bMax, ymin: 0, ymax: zmax * 1.08 }, { etiquetaX: `capacidad de ${bajo(RES[r].n)} (${RES[r].u})`, etiquetaY: 'beneficio máximo (USD)' });
      pl.ejes();
      ctx.fillStyle = VIZ.alfa(C.s3, 0.16);
      ctx.fillRect(pl.sx(info.lo), pl.y1, pl.sx(info.hi) - pl.sx(info.lo), pl.y0 - pl.y1);
      ctx.save();
      pl.recortar();
      VIZ.trazar(ctx, pl, [[0, info.z0 - info.y * b], [bMax, info.z0 + info.y * (bMax - b)]], C.s2, 2, [6, 4]);
      ctx.restore();
      VIZ.trazar(ctx, pl, curva, C.s1, 2.5);
      VIZ.marcador(ctx, pl.sx(b), pl.sy(info.z0), C.s1, 5.5);
      const u = RES[r].u;
      registro.textContent = info.y > 1e-9
        ? `Cada ${u} adicional de ${bajo(RES[r].n)} aumenta el beneficio USD ${VIZ.fmt(info.y)} mientras la capacidad esté entre ${VIZ.fmt(info.lo, 3)} y ${VIZ.fmt(info.hi, 3)} ${u}.`
        : `Con ${VIZ.fmt(b)} ${u} sobra ${bajo(RES[r].n)}: una unidad más no aumenta el beneficio (precio sombra 0) hasta que la capacidad baje a ${VIZ.fmt(info.lo, 3)} ${u}.`;
      lectura.set([
        [`capacidad de ${bajo(RES[r].n)}`, `${VIZ.fmt(b)} ${u}`],
        ['beneficio máximo', `USD ${VIZ.fmt(info.z0)}`],
        ['precio sombra', `USD ${VIZ.fmt(info.y)} por ${u}`],
        ['aumento real por +1 unidad', `USD ${VIZ.fmt(info.real)}`],
        ['tramo de validez', `${VIZ.fmt(info.lo, 3)} a ${VIZ.fmt(info.hi, 3)} ${u}`],
      ]);
    }
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const v = Math.min(bMax, Math.max(0, pl.ix(x))), h = Math.max(0.01, bMax / 400);
      const pend = (z(Math.min(bMax, v + h)) - z(Math.max(0, v - h))) / (Math.min(bMax, v + h) - Math.max(0, v - h));
      tip.mostrar(x, y, `capacidad <b>${VIZ.fmt(v, 3)} ${RES[r].u}</b><br>beneficio <b>USD ${VIZ.fmt(z(v))}</b><br>pendiente local <b>${VIZ.fmt(pend, 3)}</b> USD por ${RES[r].u}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = () => info && dibujar();
    void sel;
    recalcular();
  }

  /* ---------- Fig. 3: efecto de cambiar un margen ---------- */

  function montarMargen(cuerpo) {
    let k = 0, t = BASE.m[0], hover = null, plA = null, plB = null, escalon = [];
    const M0 = modelo(BASE.cap, BASE.m), D = dominio(M0.poli);
    const mm = () => (k === 0 ? [t, BASE.m[1]] : [BASE.m[0], t]);
    const T_MAX = 120;

    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Margen que cambia', opciones: [[0, 'Mesas'], [1, 'Sillas']], valor: k, alCambiar: (v) => { k = +v; t = BASE.m[k]; rg.valor = t; recalcular(); } });
    const rg = ctl.rango({ etiqueta: 'Margen por unidad', min: 0, max: T_MAX, valor: t, formato: (v) => `USD ${v}`, alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Volver al valor inicial', () => { t = BASE.m[k]; rg.valor = t; dibujar(); }, { primario: true });

    VIZ.subtitulo(cuerpo, 'Región factible y dirección del beneficio');
    const lienzoA = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 260, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      ...RES.map((r, i) => ({ color: COL[i], texto: `${r.n} (${r.u})`, forma: 'linea' })),
      { color: VIZ.alfa(C.s1, 0.18), texto: 'región factible', borde: C.s1 },
      { color: C.tinta2, texto: 'recta de igual beneficio y dirección de mejora', forma: 'linea' },
      { color: C.s6, texto: 'vértice óptimo' },
    ]);
    VIZ.subtitulo(cuerpo, 'Producción óptima según el margen');
    const lienzoB = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 220, altoMax: 330 });
    const tip = VIZ.tooltip(lienzoB);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'mesas óptimas', forma: 'linea' },
      { color: C.s2, texto: 'sillas óptimas', forma: 'linea' },
      { color: C.tinta, texto: 'margen actual', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el margen y observe cómo gira la recta de igual beneficio. El plan óptimo no cambia suavemente: salta de vértice en vértice cuando la recta se vuelve paralela a una restricción.');

    function recalcular() {
      escalon = [];
      for (let i = 0; i <= 480; i++) {
        const v = (T_MAX * i) / 480, o = O.optimo2d(M0.poli, k === 0 ? [v, BASE.m[1]] : [BASE.m[0], v]);
        escalon.push([v, limpio(o.x[0]), limpio(o.x[1])]);
      }
      dibujar();
    }
    // Intervalo exacto de t para el que el vértice v sigue siendo óptimo.
    function intervalo(v) {
      let lo = 0, hi = Infinity;
      const o = 1 - k;
      for (const w of M0.poli) {
        const dk = v[k] - w[k], dov = BASE.m[o] * (v[o] - w[o]);
        if (Math.abs(dk) < 1e-9) continue;
        const lim = -dov / dk;
        if (dk > 0) lo = Math.max(lo, lim); else hi = Math.min(hi, lim);
      }
      return [lo, hi];
    }
    function dibujar() {
      if (!escalon.length) return;
      const m = mm(), o = O.optimo2d(M0.poli, m), x = o.x.map(limpio);
      // Región
      lienzoA.limpiar();
      const ctx = lienzoA.ctx;
      plA = dibujarRegion(lienzoA, M0, D, { etiquetaX: 'mesas', etiquetaY: 'sillas' });
      rectaBeneficio(lienzoA, plA, m, o.z, D, C.tinta2);
      const nm = Math.hypot(m[0], m[1]) || 1, ox = plA.sx(x[0]), oy = plA.sy(x[1]);
      if (nm > 1e-9) {
        const ux = m[0] / nm, uy = -m[1] / nm;
        ctx.save();
        ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy); ctx.lineTo(ox + ux * 36, oy + uy * 36);
        ctx.moveTo(ox + ux * 36, oy + uy * 36); ctx.lineTo(ox + ux * 30 - uy * 4, oy + uy * 30 + ux * 4);
        ctx.moveTo(ox + ux * 36, oy + uy * 36); ctx.lineTo(ox + ux * 30 + uy * 4, oy + uy * 30 - ux * 4);
        ctx.stroke();
        ctx.restore();
      }
      for (const p of M0.poli) VIZ.marcador(ctx, plA.sx(p[0]), plA.sy(p[1]), C.inactivo, 3.5);
      VIZ.marcador(ctx, ox, oy, C.s6, 6);
      // Producción según el margen
      lienzoB.limpiar();
      const cb = lienzoB.ctx;
      plB = VIZ.plano(lienzoB, { xmin: 0, xmax: T_MAX, ymin: 0, ymax: D * 0.9 }, { etiquetaX: `margen de ${PROD[k]} (USD)`, etiquetaY: 'unidades óptimas' });
      plB.ejes();
      VIZ.trazar(cb, plB, escalon.map((e) => [e[0], e[1]]), C.s1, 2.5);
      VIZ.trazar(cb, plB, escalon.map((e) => [e[0], e[2]]), C.s2, 2.5);
      cb.save();
      cb.strokeStyle = C.tinta; cb.lineWidth = 1.5;
      cb.beginPath(); cb.moveTo(plB.sx(t) + 0.5, plB.y1); cb.lineTo(plB.sx(t) + 0.5, plB.y0); cb.stroke();
      cb.restore();
      VIZ.marcador(cb, plB.sx(t), plB.sy(x[0]), C.s1, 4.5);
      VIZ.marcador(cb, plB.sx(t), plB.sy(x[1]), C.s2, 4.5, 1);
      const [lo, hi] = intervalo(o.x);
      registro.textContent = `Con margen ${VIZ.fmt(t)} para ${PROD[k]}, el plan óptimo es ${VIZ.fmt(x[0], 4)} mesas y ${VIZ.fmt(x[1], 4)} sillas. `
        + `Ese mismo plan sigue siendo óptimo mientras el margen de ${PROD[k]} esté entre ${VIZ.fmt(lo, 4)} y ${hi === Infinity ? '∞' : VIZ.fmt(hi, 4)}.`;
      lectura.set([
        ['margen actual', `USD ${VIZ.fmt(t)}`],
        ['plan óptimo', `${VIZ.fmt(x[0], 4)} mesas · ${VIZ.fmt(x[1], 4)} sillas`],
        ['beneficio máximo', `USD ${VIZ.fmt(o.z)}`],
        ['el plan no cambia entre', `${VIZ.fmt(lo, 4)} y ${hi === Infinity ? '∞' : VIZ.fmt(hi, 4)}`],
      ]);
    }
    lienzoA.alDibujar = dibujar;
    lienzoB.alDibujar = dibujar;
    lienzoB.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzoB.posicion(ev);
      if (!plB || !plB.dentro(x, y)) return tip.ocultar();
      const v = Math.min(T_MAX, Math.max(0, plB.ix(x))), o = O.optimo2d(M0.poli, k === 0 ? [v, BASE.m[1]] : [BASE.m[0], v]);
      hover = v;
      tip.mostrar(x, y, `margen de ${PROD[k]} <b>USD ${VIZ.fmt(v, 3)}</b>${VIZ.filaTooltip(C.s1, 'mesas', VIZ.fmt(limpio(o.x[0]), 4))}${VIZ.filaTooltip(C.s2, 'sillas', VIZ.fmt(limpio(o.x[1]), 4))}beneficio <b>USD ${VIZ.fmt(o.z)}</b>`);
    });
    lienzoB.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzoB.canvas.style.cursor = 'pointer';
    lienzoB.canvas.addEventListener('click', () => { if (hover != null) { t = Math.round(hover); rg.valor = t; dibujar(); } });
    void sel;
    recalcular();
  }

  VIZ.registrarTema('production-planning', {
    intro: String.raw`
      <p>Una fábrica puede hacer varios productos, cada uno con un margen de beneficio distinto, pero comparten horas de máquina, mano de obra y
      materia prima que no alcanzan para todo. <strong>Planificar la producción</strong> es decidir cuánto hacer de cada cosa para ganar lo
      máximo sin pasarse de ningún recurso.</p>
      <p>Con dos productos el problema se resuelve a ojo: cada recurso limita una región del plano, el plan óptimo está en una esquina y
      cada recurso agotado tiene un <em>precio sombra</em> que dice cuánto valdría tener una unidad más.</p>`,
    visualizaciones: [
      {
        titulo: 'Solución gráfica',
        descripcion: 'La recta punteada une todos los planes con el mismo beneficio Z. Deslice Z hacia arriba hasta que toque la región solo en un vértice, o haga clic para probar un plan propio. Baje la madera hasta que deje de sobrar.',
        montar: montarGrafica,
      },
      {
        titulo: 'Precios sombra de los recursos',
        descripcion: 'Elija un recurso y mueva su capacidad: la curva muestra el beneficio máximo y la recta naranja su pendiente, el precio sombra. Compare el precio con el aumento real por +1 unidad y busque dónde cambia.',
        montar: montarPrecios,
      },
      {
        titulo: 'Efecto de cambiar un margen',
        descripcion: 'Mueva el margen de un producto y vea girar la recta de igual beneficio. Busque los márgenes donde el plan óptimo salta de un vértice a otro, y haga clic sobre la curva para fijar el margen.',
        montar: montarMargen,
      },
    ],
    teoria: String.raw`
      <h2>El modelo</h2>
      <p>Sea \(x_j\) la cantidad producida del producto \(j\) y \(p_j\) su margen unitario. Cada recurso \(i\) tiene una disponibilidad \(b_i\) y
      cada unidad del producto \(j\) consume \(a_{ij}\) de él.</p>
      \[ \max\ p_1x_1 + p_2x_2 \quad \text{s.a.}\quad a_{i1}x_1 + a_{i2}x_2 \le b_i \ \ (i = 1,2,3), \qquad x_1, x_2 \ge 0. \]
      <p>En el ejemplo, \(x_1\) son mesas y \(x_2\) sillas; los recursos son carpintería (\(3x_1 + 2x_2 \le 80\) h), pintura
      (\(x_1 + 2x_2 \le 48\) h) y madera (\(2x_1 + x_2 \le 55\) m²), con márgenes de USD 50 y 40.</p>
      <h2>Solución gráfica</h2>
      <p>Cada desigualdad define un semiplano; la intersección es el <em>polígono factible</em>. Las rectas \(p_1x_1 + p_2x_2 = Z\) son paralelas y
      \(Z\) crece en la dirección \(p = (p_1, p_2)\). El óptimo es el último punto del polígono que toca una recta al desplazarla en esa dirección: un
      vértice (o toda una arista si la recta es paralela a una restricción). Es el teorema fundamental de la programación lineal; ver
      <a href="tema.html?id=optimal-solution-geometry">geometría de las soluciones óptimas</a>.</p>
      <p>Aquí el óptimo es \(x^* = (16, 16)\) con \(Z^* = 1440\): se agotan carpintería (\(3\cdot 16 + 2\cdot 16 = 80\)) y pintura
      (\(16 + 2\cdot 16 = 48\)), y la madera usa 48 de 55 m². La restricción de madera es <strong>inactiva</strong>.</p>
      <h2>Precios sombra</h2>
      <p>El <strong>precio sombra</strong> \(y_i^*\) de un recurso es la derivada del beneficio óptimo respecto de su disponibilidad,
      \(y_i^* = \partial Z^*/\partial b_i\). Se obtiene resolviendo el sistema de las restricciones activas:</p>
      \[ 3y_1 + y_2 = 50,\qquad 2y_1 + 2y_2 = 40 \quad\Longrightarrow\quad y_1 = 15,\ y_2 = 5,\ y_3 = 0. \]
      <p>Una hora más de carpintería vale USD 15; una de pintura, USD 5; un metro cuadrado más de madera, nada. El beneficio
      \(Z^*(b)\) es una función <em>cóncava y lineal por tramos</em> de \(b\): el precio sombra es constante solo mientras la base óptima
      (qué restricciones son activas) no cambia; es lo que muestra el tramo sombreado de la segunda figura. Estos valores son las
      variables del <a href="tema.html?id=dual-construction">problema dual</a>, y su interpretación se desarrolla en
      <a href="tema.html?id=shadow-prices">precios sombra</a>.</p>
      <div class="recuadro"><p><strong>Holgura complementaria.</strong> Si un recurso sobra en el óptimo (\(\sum_j a_{ij}x_j^* &lt; b_i\)),
      su precio sombra es cero; si su precio sombra es positivo, el recurso se agota. Ver
      <a href="tema.html?id=complementary-slackness">holgura complementaria</a>.</p></div>
      <h2>Cambiar un margen</h2>
      <p>Cambiar \(p_k\) gira las rectas de igual beneficio pero no mueve el polígono. El vértice óptimo \(v\) sigue siéndolo mientras
      \(p^\top v \ge p^\top w\) para todo otro vértice \(w\); cada desigualdad es lineal en \(p_k\), de modo que el conjunto de márgenes que
      conservan el plan es un intervalo. Fuera de él, el plan salta a un vértice vecino. Ver
      <a href="tema.html?id=objective-coefficient-ranges">rangos de los coeficientes objetivo</a>.</p>
      <h2>Conexiones</h2>
      <ul>
        <li>Con muchos productos ya no se resuelve a ojo: se usa el <a href="tema.html?id=simplex-tableau">tableau del Simplex</a>.</li>
        <li>Si los productos son indivisibles, el modelo se vuelve entero: <a href="tema.html?id=problem-classes">LP, ILP, MILP y NLP</a>.</li>
        <li>La misma estructura aparece en <a href="tema.html?id=resource-allocation">asignación de recursos</a> y en
        <a href="tema.html?id=diet-problem">el problema de la dieta</a> (minimizando en lugar de maximizar).</li>
      </ul>`,
  });
})();
