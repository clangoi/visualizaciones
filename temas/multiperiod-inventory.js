(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  const T = 8;
  const DEM = {
    est: { n: 'Estacional (pico en el 4)', d: [30, 40, 70, 100, 80, 50, 40, 60] },
    cre: { n: 'Creciente', d: [30, 40, 50, 60, 70, 80, 90, 100] },
    con: { n: 'Constante', d: Array(T).fill(60) },
  };
  const CST = {
    var: { n: 'Variable (más caro cerca del pico)', c: [10, 10, 11, 13, 12, 11, 10, 10] },
    con: { n: 'Constante', c: Array(T).fill(10) },
  };
  const limpio = (v) => (Math.abs(v) < 1e-7 ? 0 : v);
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  // min Σ c_t p_t + h Σ I_t  s.a.  I_t = I_{t−1} + p_t − d_t,  0 ≤ p_t ≤ K,  I_t ≥ 0,  I_0 = 0.
  function resolver(d, c, h, K) {
    const A = [], b = [];
    for (let t = 0; t < T; t++) {
      const f = Array(2 * T).fill(0);
      f[T + t] = 1; if (t > 0) f[T + t - 1] = -1; f[t] = -1;
      A.push(f); b.push(-d[t]);
    }
    const r = O.lp([...c, ...Array(T).fill(h)], A, A.map(() => '='), b, { max: false, cotas: [...Array(T).fill([0, K]), ...Array(T).fill([0, Infinity])] });
    if (r.estado !== 'optimo') return { estado: r.estado };
    const p = r.x.slice(0, T).map(limpio), I = r.x.slice(T).map(limpio);
    const cp = sum(p.map((v, t) => v * c[t])), cm = h * sum(I);
    return { estado: 'optimo', p, I, cp, cm, z: cp + cm };
  }
  const jit = (d, c, K) => (Math.max(...d) <= K + 1e-9 ? sum(d.map((v, t) => v * c[t])) : null);

  // Producción (barras), demanda (marca) e inventario (línea). `antes` dibuja el plan previo como contorno.
  function dibujarPlan(lienzo, plan, d, c, K, o = {}) {
    const { ctx } = lienzo;
    const ymax = Math.max(K, ...d, ...plan.p, ...plan.I, ...(o.antes ? o.antes.p : [0])) * 1.12;
    const pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: T + 0.5, ymin: 0, ymax }, { etiquetaX: 'periodo', etiquetaY: 'unidades', ticksX: Array.from({ length: T }, (_, i) => i + 1), formatoX: (v) => String(v) });
    pl.ejes();
    const bw = Math.min(46, (pl.x1 - pl.x0) / T * 0.6);
    if (o.sel != null) { ctx.fillStyle = C.neutro; ctx.fillRect(pl.sx(o.sel + 0.5), pl.y1, pl.sx(o.sel + 1.5) - pl.sx(o.sel + 0.5), pl.y0 - pl.y1); pl.ejes(); }
    ctx.save();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(K) + 0.5); ctx.lineTo(pl.x1, pl.sy(K) + 0.5); ctx.stroke();
    ctx.restore();
    plan.p.forEach((v, t) => {
      if (v < 1e-9) return;
      ctx.fillStyle = o.hover === t ? VIZ.alfa(C.s1, 0.75) : C.s1;
      ctx.beginPath(); ctx.roundRect(pl.sx(t + 1) - bw / 2, pl.sy(v), bw, pl.y0 - pl.sy(v), [4, 4, 0, 0]); ctx.fill();
    });
    if (o.antes) {
      ctx.save();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
      o.antes.p.forEach((v, t) => { if (v > 1e-9) ctx.strokeRect(pl.sx(t + 1) - bw / 2 - 2.5, pl.sy(v) + 0.5, bw + 5, pl.y0 - pl.sy(v)); });
      ctx.restore();
    }
    VIZ.trazar(ctx, pl, plan.I.map((v, t) => [t + 1, v]), C.s3, 2.5);
    plan.I.forEach((v, t) => VIZ.marcador(ctx, pl.sx(t + 1), pl.sy(v), C.s3, 3.5));
    ctx.save();
    ctx.strokeStyle = C.tinta; ctx.lineWidth = 3;
    d.forEach((v, t) => { ctx.beginPath(); ctx.moveTo(pl.sx(t + 1) - bw / 2 - 4, pl.sy(v)); ctx.lineTo(pl.sx(t + 1) + bw / 2 + 4, pl.sy(v)); ctx.stroke(); });
    ctx.restore();
    return pl;
  }
  const periodoDe = (pl, x, y) => (pl && pl.dentro(x, y) ? Math.max(0, Math.min(T - 1, Math.round(pl.ix(x)) - 1)) : -1);
  const leyendaPlan = (cuerpo, antes) => VIZ.leyenda(cuerpo, [
    { color: C.s1, texto: 'producción del periodo' },
    { color: C.tinta, texto: 'demanda', forma: 'linea' },
    { color: C.s3, texto: 'inventario al final del periodo', forma: 'linea' },
    { color: C.apagado, texto: 'capacidad por periodo', forma: 'linea' },
    ...(antes ? [{ color: C.tinta2, texto: 'producción del plan anterior', forma: 'linea' }] : []),
  ]);
  const tipPlan = (plan, d, c, h, t) => `<b>Periodo ${t + 1}</b><br>demanda <b>${VIZ.fmt(d[t], 4)}</b><br>producción <b>${VIZ.fmt(plan.p[t], 4)}</b> (USD ${c[t]} c/u = ${VIZ.fmt(plan.p[t] * c[t], 4)})<br>`
    + `inventario inicial <b>${VIZ.fmt(t ? plan.I[t - 1] : 0, 4)}</b> → final <b>${VIZ.fmt(plan.I[t], 4)}</b><br>costo de mantener <b>${VIZ.fmt(h * plan.I[t], 4)}</b>`;

  /* ---------- Fig. 1: el plan óptimo ---------- */

  function montarPlan(cuerpo) {
    let dk = 'est', ck = 'var', h = 1, K = 90, plan = null, pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Demanda', opciones: Object.entries(DEM).map(([k, v]) => [k, v.n]), valor: dk, alCambiar: (v) => { dk = v; calcular(); } });
    ctl.selector({ etiqueta: 'Costo de producción', opciones: Object.entries(CST).map(([k, v]) => [k, v.n]), valor: ck, alCambiar: (v) => { ck = v; calcular(); } });
    ctl.rango({ etiqueta: 'Costo de mantener 1 unidad un periodo', min: 0, max: 8, paso: 0.25, valor: h, formato: (v) => `USD ${v}`, alCambiar: (v) => { h = v; calcular(); } });
    ctl.rango({ etiqueta: 'Capacidad por periodo', min: 40, max: 140, paso: 5, valor: K, formato: (v) => `${v} u.`, alCambiar: (v) => { K = v; calcular(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    leyendaPlan(cuerpo);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un periodo para ver su balance \\(I_t = I_{t-1} + p_t - d_t\\). Suba el costo de mantener y el plan deja de adelantar producción; baje la capacidad y vea cuándo ya no existe plan.');

    function calcular() {
      const d = DEM[dk].d, c = CST[ck].c;
      plan = resolver(d, c, h, K);
      dibujar();
    }
    function dibujar() {
      const d = DEM[dk].d, c = CST[ck].c;
      lienzo.limpiar();
      if (plan.estado !== 'optimo') {
        pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, { ticksX: [], ticksY: [] });
        lienzo.ctx.fillStyle = C.s8; lienzo.ctx.font = VIZ.fuente(13, 500); lienzo.ctx.textAlign = 'center';
        lienzo.ctx.fillText('Sin plan posible con esa capacidad', lienzo.ancho / 2, lienzo.alto / 2);
        caja.replaceChildren();
        let acum = 0, k = -1;
        for (let t = 0; t < T; t++) { acum += d[t]; if (acum > K * (t + 1) + 1e-9) { k = t; break; } }
        registro.textContent = `Infactible: hasta el periodo ${k + 1} se demandan ${sum(d.slice(0, k + 1))} unidades y la capacidad acumulada solo da ${K * (k + 1)}. No se puede producir después lo que se pidió antes.`;
        lectura.set([['costo total', '—'], ['producción', '—'], ['mantención', '—'], ['estado', 'infactible']]);
        return;
      }
      pl = dibujarPlan(lienzo, plan, d, c, K, { hover });
      const t = document.createElement('table');
      t.className = 'tabla-datos sin-corte';
      const fila = (n, v) => `<tr><td class="izq">${n}</td>${v.map((x) => `<td>${VIZ.fmt(x, 4)}</td>`).join('')}</tr>`;
      t.innerHTML = `<thead><tr><th class="izq">Periodo</th>${d.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>`
        + fila('Demanda', d) + fila('Costo unitario', c) + fila('Producción', plan.p) + fila('Inventario final', plan.I) + '</tbody>';
      caja.replaceChildren(t);
      const j = jit(d, c, K), imax = Math.max(...plan.I), tmax = plan.I.indexOf(imax);
      const adel = plan.p.map((v, i) => (plan.I[i] > 1e-9 ? i + 1 : null)).filter(Boolean);
      registro.textContent = imax < 1e-9 ? 'El plan produce exactamente lo que se demanda en cada periodo: no conviene guardar nada.'
        : `Se adelanta producción en los periodos ${adel.join(', ')}: el inventario llega a ${VIZ.fmt(imax, 4)} unidades al final del periodo ${tmax + 1} y cubre la demanda de los periodos siguientes.`;
      lectura.set([
        ['costo total', `USD ${VIZ.fmt(plan.z, 5)}`],
        ['producción / mantención', `${VIZ.fmt(plan.cp, 5)} / ${VIZ.fmt(plan.cm, 5)}`],
        ['inventario máximo', `${VIZ.fmt(imax, 4)} u.`],
        ['justo a tiempo (sin inventario)', j == null ? 'no cabe en la capacidad' : `USD ${VIZ.fmt(j, 5)}`],
        ['ahorro por planificar', j == null ? '—' : `USD ${VIZ.fmt(j - plan.z, 4)}`],
      ]);
    }
    lienzo.alDibujar = () => plan && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), t = plan && plan.estado === 'optimo' ? periodoDe(pl, x, y) : -1;
      if (t < 0) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      if (t !== hover) { hover = t; dibujar(); }
      tip.mostrar(x, y, tipPlan(plan, DEM[dk].d, CST[ck].c, h, t));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); if (hover >= 0) { hover = -1; if (plan) dibujar(); } });
    calcular();
  }

  /* ---------- Fig. 2: cuándo conviene anticipar ---------- */

  function montarAnticipar(cuerpo) {
    let dk = 'est', K = 110, h = 1, curva = [], jitC = null, pa = null, pb = null;
    const H_MAX = 8, PASO = 0.25, c = CST.var.c;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Demanda', opciones: Object.entries(DEM).map(([k, v]) => [k, v.n]), valor: dk, alCambiar: (v) => { dk = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Capacidad por periodo', min: 50, max: 140, paso: 5, valor: K, formato: (v) => `${v} u.`, alCambiar: (v) => { K = v; recalcular(); } });
    const rh = ctl.rango({ etiqueta: 'Costo de mantener', min: 0, max: H_MAX, paso: PASO, valor: h, formato: (v) => `USD ${v}`, alCambiar: (v) => { h = v; dibujar(); } });

    VIZ.subtitulo(cuerpo, 'Costo total según el costo de mantener inventario');
    const lienzoA = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 220, altoMax: 340 });
    const tipA = VIZ.tooltip(lienzoA);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'plan óptimo', forma: 'linea' },
      { color: C.s2, texto: 'producir justo lo que se demanda', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.2), texto: 'ahorro por anticipar producción', borde: C.s6 },
      { color: C.tinta, texto: 'costo elegido' },
    ]);
    VIZ.subtitulo(cuerpo, 'Inventario que conviene mantener');
    const lienzoB = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 180, altoMax: 260 });
    const tipB = VIZ.tooltip(lienzoB);
    VIZ.leyenda(cuerpo, [{ color: C.s3, texto: 'unidades-periodo en inventario (suma de I_t)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con costos de producción distintos entre periodos, adelantar producción ahorra dinero mientras guardar sea barato. Haga clic en cualquiera de los dos gráficos para fijar el costo de mantener. Con capacidad menor que el pico, producir justo a tiempo ni siquiera es posible.');

    function recalcular() {
      const d = DEM[dk].d;
      curva = [];
      for (let v = 0; v <= H_MAX + 1e-9; v += PASO) { const r = resolver(d, c, v, K); curva.push({ h: v, z: r.estado === 'optimo' ? r.z : NaN, I: r.estado === 'optimo' ? sum(r.I) : NaN, plan: r }); }
      jitC = jit(d, c, K);
      dibujar();
    }
    const cercano = (x, plano) => { const v = Math.max(0, Math.min(H_MAX, plano.ix(x))); return curva[Math.round(v / PASO)]; };
    function dibujar() {
      const ok = curva.filter((q) => Number.isFinite(q.z));
      lienzoA.limpiar(); lienzoB.limpiar();
      if (!ok.length) {
        for (const l of [lienzoA, lienzoB]) { l.ctx.fillStyle = C.s8; l.ctx.font = VIZ.fuente(13, 500); l.ctx.textAlign = 'center'; l.ctx.fillText('Sin plan posible con esa capacidad', l.ancho / 2, l.alto / 2); }
        pa = pb = null;
        registro.textContent = 'Infactible: la capacidad acumulada no alcanza a cubrir la demanda acumulada. Suba la capacidad por periodo.';
        lectura.set([['costo total', '—'], ['justo a tiempo', '—'], ['ahorro', '—'], ['estado', 'infactible']]);
        return;
      }
      const ctxA = lienzoA.ctx, zmax = Math.max(...ok.map((q) => q.z), jitC || 0), zmin = Math.min(...ok.map((q) => q.z));
      pa = VIZ.plano(lienzoA, { xmin: 0, xmax: H_MAX, ymin: Math.floor((zmin * 0.97) / 100) * 100, ymax: zmax * 1.02 }, { etiquetaX: 'costo de mantener 1 unidad un periodo (USD)', etiquetaY: 'costo total (USD)' });
      pa.ejes();
      if (jitC != null) {
        ctxA.beginPath();
        ok.forEach((q, i) => (i ? ctxA.lineTo(pa.sx(q.h), pa.sy(q.z)) : ctxA.moveTo(pa.sx(q.h), pa.sy(q.z))));
        ctxA.lineTo(pa.sx(H_MAX), pa.sy(jitC)); ctxA.lineTo(pa.sx(0), pa.sy(jitC)); ctxA.closePath();
        ctxA.fillStyle = VIZ.alfa(C.s6, 0.18); ctxA.fill();
        VIZ.trazar(ctxA, pa, [[0, jitC], [H_MAX, jitC]], C.s2, 2.5);
      }
      VIZ.trazar(ctxA, pa, ok.map((q) => [q.h, q.z]), C.s1, 2.5);
      const sel = curva[Math.round(h / PASO)];
      if (Number.isFinite(sel.z)) VIZ.marcador(ctxA, pa.sx(sel.h), pa.sy(sel.z), C.tinta, 5.5);
      // Inventario
      const ctxB = lienzoB.ctx, imax = Math.max(...ok.map((q) => q.I), 1);
      pb = VIZ.plano(lienzoB, { xmin: 0, xmax: H_MAX, ymin: 0, ymax: imax * 1.12 }, { etiquetaX: 'costo de mantener (USD)', etiquetaY: 'unidades-periodo' });
      pb.ejes();
      VIZ.trazar(ctxB, pb, ok.map((q) => [q.h, q.I]), C.s3, 2.5);
      if (Number.isFinite(sel.I)) VIZ.marcador(ctxB, pb.sx(sel.h), pb.sy(sel.I), C.tinta, 5.5);
      // Lectura
      const r = sel.plan;
      if (r.estado !== 'optimo') return;
      const imaxSel = Math.max(...r.I), t = r.I.indexOf(imaxSel);
      registro.textContent = sel.I < 1e-9
        ? `Con costo de mantener USD ${VIZ.fmt(h)} ya no conviene adelantar nada: el plan coincide con producir lo demandado${jitC == null ? ' (salvo lo que la capacidad obliga a anticipar)' : ''}.`
        : `Con costo de mantener USD ${VIZ.fmt(h)} conviene guardar hasta ${VIZ.fmt(imaxSel, 4)} unidades (periodo ${t + 1}): producir antes en un periodo barato compensa lo que cuesta guardar.`;
      lectura.set([
        ['costo del plan óptimo', `USD ${VIZ.fmt(r.z, 5)}`],
        ['justo a tiempo', jitC == null ? 'imposible (la capacidad no cubre el pico)' : `USD ${VIZ.fmt(jitC, 5)}`],
        ['ahorro por anticipar', jitC == null ? '—' : `USD ${VIZ.fmt(jitC - r.z, 4)}`],
        ['inventario acumulado', `${VIZ.fmt(sel.I, 4)} unidades-periodo`],
      ]);
    }
    const mover = (l, p, tip) => {
      l.canvas.style.cursor = 'pointer';
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = l.posicion(ev), pp = p();
        if (!pp || !pp.dentro(x, y)) return tip.ocultar();
        const q = cercano(x, pp);
        tip.mostrar(x, y, `costo de mantener <b>USD ${VIZ.fmt(q.h)}</b><br>${Number.isFinite(q.z) ? `costo óptimo <b>USD ${VIZ.fmt(q.z, 5)}</b><br>inventario <b>${VIZ.fmt(q.I, 4)}</b> unidades-periodo${jitC != null ? `<br>ahorro <b>USD ${VIZ.fmt(jitC - q.z, 4)}</b>` : ''}` : 'sin plan'}`);
      });
      l.canvas.addEventListener('pointerleave', () => tip.ocultar());
      l.canvas.addEventListener('click', (ev) => {
        const { x, y } = l.posicion(ev), pp = p();
        if (!pp || !pp.dentro(x, y)) return;
        h = cercano(x, pp).h; rh.valor = h; dibujar();
      });
    };
    mover(lienzoA, () => pa, tipA);
    mover(lienzoB, () => pb, tipB);
    lienzoA.alDibujar = () => curva.length && dibujar();
    lienzoB.alDibujar = () => curva.length && dibujar();
    recalcular();
  }

  /* ---------- Fig. 3: costo marginal de la demanda ---------- */

  function montarMarginal(cuerpo) {
    let t0 = 2, extra = 10, h = 1, K = 90, base = null, nuevo = null, marg = [], pa = null, pb = null;
    const d0 = DEM.est.d, c = CST.var.c;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Periodo con más demanda', opciones: d0.map((_, i) => [i, `Periodo ${i + 1}`]), valor: t0, alCambiar: (v) => { t0 = +v; calcular(); } });
    ctl.rango({ etiqueta: 'Demanda adicional', min: 1, max: 40, valor: extra, formato: (v) => `+${v} u.`, alCambiar: (v) => { extra = v; calcular(); } });
    ctl.rango({ etiqueta: 'Costo de mantener', min: 0, max: 6, paso: 0.25, valor: h, formato: (v) => `USD ${v}`, alCambiar: (v) => { h = v; calcular(); } });
    ctl.rango({ etiqueta: 'Capacidad por periodo', min: 80, max: 140, paso: 5, valor: K, formato: (v) => `${v} u.`, alCambiar: (v) => { K = v; calcular(); } });

    VIZ.subtitulo(cuerpo, 'Plan antes y después del pedido adicional');
    const lienzoA = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 230, altoMax: 340 });
    const tipA = VIZ.tooltip(lienzoA);
    leyendaPlan(cuerpo, true);
    VIZ.subtitulo(cuerpo, 'Costo marginal de una unidad más de demanda, por periodo');
    const lienzoB = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 180, altoMax: 250 });
    const tipB = VIZ.tooltip(lienzoB);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo de atender 1 unidad más' },
      { color: C.s2, texto: 'periodo elegido' },
      { color: C.tenue, texto: 'no se puede atender (capacidad agotada)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una barra del gráfico inferior (o use el selector) para pedir unidades adicionales en ese periodo. El plan dibujado en contorno es el original: observe de qué periodo sale la producción extra y por qué.');

    function calcular() {
      base = resolver(d0, c, h, K);
      const d1 = d0.map((v, i) => (i === t0 ? v + extra : v));
      nuevo = resolver(d1, c, h, K);
      marg = d0.map((_, i) => { const r = resolver(d0.map((v, k) => (k === i ? v + 1 : v)), c, h, K); return r.estado === 'optimo' && base.estado === 'optimo' ? r.z - base.z : NaN; });
      dibujar();
    }
    function dibujar() {
      lienzoA.limpiar(); lienzoB.limpiar();
      const d1 = d0.map((v, i) => (i === t0 ? v + extra : v));
      // Costo marginal por periodo
      const ctxB = lienzoB.ctx, validos = marg.filter(Number.isFinite), mmax = Math.max(...validos, c[0]);
      pb = VIZ.plano(lienzoB, { xmin: 0.5, xmax: T + 0.5, ymin: 0, ymax: mmax * 1.15 }, { etiquetaX: 'periodo con una unidad más de demanda', etiquetaY: 'USD por unidad', ticksX: d0.map((_, i) => i + 1), formatoX: (v) => String(v) });
      pb.ejes();
      const bw = Math.min(46, (pb.x1 - pb.x0) / T * 0.6);
      marg.forEach((v, i) => {
        const ok = Number.isFinite(v);
        ctxB.fillStyle = !ok ? C.tenue : i === t0 ? C.s2 : C.s1;
        const alto = ok ? pb.y0 - pb.sy(v) : pb.y0 - pb.sy(mmax * 0.35);
        ctxB.beginPath(); ctxB.roundRect(pb.sx(i + 1) - bw / 2, pb.y0 - alto, bw, alto, [4, 4, 0, 0]); ctxB.fill();
        if (ok) { ctxB.fillStyle = C.tinta; ctxB.font = VIZ.fuente(10); ctxB.textAlign = 'center'; ctxB.fillText(VIZ.fmt(v, 4), pb.sx(i + 1), pb.y0 - alto - 4); }
      });
      if (base.estado !== 'optimo' || nuevo.estado !== 'optimo') {
        pa = null;
        lienzoA.ctx.fillStyle = C.s8; lienzoA.ctx.font = VIZ.fuente(13, 500); lienzoA.ctx.textAlign = 'center';
        lienzoA.ctx.fillText(base.estado !== 'optimo' ? 'Sin plan posible con esa capacidad' : 'La demanda adicional no cabe en la capacidad', lienzoA.ancho / 2, lienzoA.alto / 2);
        registro.textContent = base.estado !== 'optimo' ? 'Infactible: suba la capacidad.' : `Infactible: hasta el periodo ${t0 + 1} no se alcanza a producir ${extra} unidades más con la capacidad acumulada. Reduzca el pedido o suba la capacidad.`;
        lectura.set([['costo del pedido adicional', '—'], ['costo por unidad', '—'], ['producción extra', '—'], ['estado', 'infactible']]);
        return;
      }
      pa = dibujarPlan(lienzoA, nuevo, d1, c, K, { antes: base, sel: t0 });
      const dif = nuevo.p.map((v, i) => v - base.p[i]);
      const mas = dif.map((v, i) => (v > 1e-6 ? `${VIZ.fmt(v, 4)} en el periodo ${i + 1}` : null)).filter(Boolean);
      const menos = dif.map((v, i) => (v < -1e-6 ? `${VIZ.fmt(-v, 4)} en el periodo ${i + 1}` : null)).filter(Boolean);
      const unico = dif.findIndex((v) => Math.abs(v - extra) < 1e-6);
      registro.textContent = `Para atender ${extra} unidades más en el periodo ${t0 + 1} se produce ${mas.join(' y ') || 'nada adicional'}${menos.length ? ` y se produce menos: ${menos.join(' y ')}` : ''}. `
        + (unico >= 0 ? `Producir en el periodo ${unico + 1} cuesta ${c[unico]} y guardar ${t0 - unico} periodos añade ${VIZ.fmt(h * (t0 - unico), 4)}: ${VIZ.fmt(c[unico] + h * (t0 - unico), 4)} por unidad.` : 'La producción extra se reparte porque la capacidad de un solo periodo no alcanza.');
      lectura.set([
        ['costo del plan original', `USD ${VIZ.fmt(base.z, 5)}`],
        ['costo con el pedido', `USD ${VIZ.fmt(nuevo.z, 5)}`],
        ['costo por unidad extra', `USD ${VIZ.fmt((nuevo.z - base.z) / extra, 4)}`],
        ['costo marginal (1 unidad)', Number.isFinite(marg[t0]) ? `USD ${VIZ.fmt(marg[t0], 4)}` : '—'],
      ]);
    }
    lienzoA.alDibujar = () => base && dibujar();
    lienzoB.alDibujar = () => base && dibujar();
    lienzoA.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzoA.posicion(ev), t = pa && nuevo.estado === 'optimo' ? periodoDe(pa, x, y) : -1;
      if (t < 0) return tipA.ocultar();
      tipA.mostrar(x, y, tipPlan(nuevo, d0.map((v, i) => (i === t0 ? v + extra : v)), c, h, t) + `<br>plan anterior: produce <b>${VIZ.fmt(base.p[t], 4)}</b>`);
    });
    lienzoA.canvas.addEventListener('pointerleave', () => tipA.ocultar());
    const periodoB = (ev) => { const { x, y } = lienzoB.posicion(ev); return pb && pb.dentro(x, y) ? Math.max(0, Math.min(T - 1, Math.round(pb.ix(x)) - 1)) : -1; };
    lienzoB.canvas.style.cursor = 'pointer';
    lienzoB.canvas.addEventListener('pointermove', (ev) => {
      const t = periodoB(ev), { x, y } = lienzoB.posicion(ev);
      if (t < 0) return tipB.ocultar();
      tipB.mostrar(x, y, `Periodo <b>${t + 1}</b><br>costo marginal ${Number.isFinite(marg[t]) ? `<b>USD ${VIZ.fmt(marg[t], 4)}</b>` : '<b>no se puede atender</b>'}<br>producción de ese periodo: ${VIZ.fmt(base.p ? base.p[t] : 0, 4)} (USD ${c[t]} c/u)`);
    });
    lienzoB.canvas.addEventListener('pointerleave', () => tipB.ocultar());
    lienzoB.canvas.addEventListener('click', (ev) => { const t = periodoB(ev); if (t >= 0) { t0 = t; sel.valor = t; calcular(); } });
    calcular();
  }

  VIZ.registrarTema('multiperiod-inventory', {
    intro: String.raw`
      <p>Cuando la demanda cambia mes a mes y la fábrica no puede producir todo cuando se pide, hay que decidir <em>cuándo</em> producir. Producir
      antes de lo necesario obliga a guardar el producto (costo de mantención) y producir a destiempo sale más caro o simplemente no se
      llega. La <strong>planificación multiperiodo</strong> equilibra ambas cosas con un balance de inventario que enlaza un periodo con el siguiente.</p>
      <p>El resultado es un patrón muy característico: el plan óptimo <em>anticipa</em> producción hacia los periodos con capacidad barata o sobrante para
      cubrir los picos, y lo hace solo hasta donde guardar es más barato que no hacerlo.</p>`,
    visualizaciones: [
      {
        titulo: 'El plan de producción e inventario',
        descripcion: 'Con capacidad 90 y un pico de 100 en el periodo 4, ya no se puede producir justo a tiempo: el plan adelanta producción. Suba el costo de mantener, cambie el patrón de demanda y baje la capacidad hasta que ya no exista plan.',
        montar: montarPlan,
      },
      {
        titulo: 'Cuándo conviene anticipar',
        descripcion: 'Cada punto de la curva es un plan óptimo distinto. Con costos de producción desiguales conviene guardar mientras mantener sea barato; recorra el costo de mantener hasta que el ahorro desaparezca, y baje la capacidad para ver que anticipar a veces es obligatorio.',
        montar: montarAnticipar,
      },
      {
        titulo: 'Costo marginal de la demanda',
        descripcion: 'Pida unidades adicionales en un periodo y compare con el plan en contorno: la producción extra sale de un periodo anterior más barato. Haga clic en las barras inferiores para ver el costo marginal de cada periodo y suba la capacidad o el costo de mantener.',
        montar: montarMarginal,
      },
    ],
    teoria: String.raw`
      <h2>El modelo</h2>
      <p>Para los periodos \(t = 1, \dots, T\), sean \(p_t\) la producción, \(I_t\) el inventario al final del periodo y \(d_t\) la demanda. El
      <strong>balance de inventario</strong> relaciona periodos consecutivos: lo que hay al final es lo que había, más lo que se produce, menos lo que se vende.</p>
      \[ I_t = I_{t-1} + p_t - d_t,\qquad I_0 = 0. \]
      <p>Con costo de producción \(c_t\), costo de mantener \(h\) por unidad y periodo, y capacidad \(K\):</p>
      \[ \min \sum_{t=1}^{T} \big(c_t\, p_t + h\, I_t\big)\quad \text{s.a.}\quad I_{t-1} + p_t - I_t = d_t,\quad 0 \le p_t \le K,\quad I_t \ge 0. \]
      <p>La condición \(I_t \ge 0\) dice que no se puede vender lo que aún no se produjo (no se admiten pedidos pendientes). Cuando se
      permitieran, aparecería una variable \(B_t\) con su propio costo de penalización.</p>
      <h2>Factibilidad</h2>
      <p>Existe un plan si y solo si la capacidad acumulada cubre la demanda acumulada en todo momento:
      \(\displaystyle \sum_{s\le t} d_s \le tK\) para cada \(t\). Es lo que ocurre cuando la figura avisa «sin plan posible». El primer periodo
      en que falla indica dónde faltó anticiparse.</p>
      <h2>Anticipar o no</h2>
      <p>Producir una unidad en el periodo \(s\) para venderla en \(t \ge s\) cuesta \(c_s + h(t-s)\). El plan óptimo elige para cada unidad el
      periodo \(s\) que minimiza esa expresión, sujeto a las capacidades. Por eso:</p>
      <ul>
        <li>si \(c_s\) es igual en todos los periodos y la capacidad alcanza, conviene producir justo a tiempo (\(s = t\));</li>
        <li>si \(c_s &lt; c_t\), conviene adelantar mientras \(h(t-s) &lt; c_t - c_s\);</li>
        <li>si la capacidad es insuficiente en el pico, se adelanta lo mínimo necesario, desde los periodos más cercanos.</li>
      </ul>
      <div class="recuadro"><p><strong>Costo marginal.</strong> La variable dual del balance del periodo \(t\) es el costo de atender una unidad más de
      demanda en ese periodo: \(\lambda_t = \min_{s \le t}\,(c_s + h(t-s))\) mientras la capacidad de \(s\) no esté agotada. Es el
      <a href="tema.html?id=shadow-prices">precio sombra</a> de la demanda; la tercera figura lo mide recalculando el plan con una unidad más.</p></div>
      <h2>Estructura del problema</h2>
      <p>Las restricciones de balance forman una red: cada periodo es un nodo, la producción es un arco que entra y el inventario un arco que
      avanza al siguiente periodo. Es un <a href="tema.html?id=min-cost-flow">flujo de costo mínimo</a> en una red lineal, y por eso la solución óptima
      es entera cuando los datos lo son. Si se agregan costos fijos por producir (preparación de línea), se pierde la linealidad y se llega al
      <a href="tema.html?id=lot-sizing">dimensionamiento de lotes</a>, un problema entero.</p>
      <h2>Conexiones</h2>
      <ul>
        <li>Mismas ideas con varios productos que comparten capacidad: <a href="tema.html?id=production-planning">planificación de producción</a>.</li>
        <li>La red de periodos es un caso de <a href="tema.html?id=network-flow-model">modelo de flujo en redes</a>.</li>
        <li>Variar la demanda o la capacidad es un análisis de <a href="tema.html?id=rhs-ranges">rangos del lado derecho</a>.</li>
      </ul>`,
  });
})();
