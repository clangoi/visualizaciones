(function () {
  'use strict';
  const { color: C } = VIZ;
  const SI = VIZ.si;
  const pct = (v, d = 3) => (Number.isFinite(v) ? `${VIZ.fmt(v * 100, d)} %` : 'no existe');
  const mm = (v) => `$${VIZ.fmt(v, 4)} M`;
  const anios = (v) => (v === null || !Number.isFinite(v) ? 'nunca' : `${VIZ.fmt(v, 3)} años`);

  // Flujos de un proyecto: t = 0 la inversión; luego beneficio creciente menos costo operativo; valor residual al final.
  const flujos = (p, fi = 1, fb = 1) => Array.from({ length: p.N + 1 }, (_, t) => (t === 0 ? -p.I * fi : p.B * fb * (1 + p.g) ** (t - 1) - p.O + (t === p.N ? p.res * p.I : 0)));
  const PROYECTOS = {
    erp: { n: 'ERP financiero', I: 600, B: 180, g: 0.05, O: 40, N: 8, res: 0 },
    nube: { n: 'Migración a la nube', I: 250, B: 90, g: 0.03, O: 20, N: 6, res: 0 },
    bot: { n: 'Asistente virtual de atención', I: 120, B: 60, g: 0.1, O: 25, N: 5, res: 0 },
    seg: { n: 'Ciberseguridad (pérdidas evitadas)', I: 300, B: 70, g: 0, O: 15, N: 7, res: 0.05 },
  };
  const OPC = Object.entries(PROYECTOS).map(([k, v]) => [k, v.n]);
  const descontados = (f, r) => f.map((x, t) => x / (1 + r) ** t);
  const acumular = (f) => f.reduce((a, x, t) => (a.push((a[t - 1] || 0) + x), a), []);

  /* ---------- Fig. 1: flujo de caja y criterios ---------- */

  function montarFlujo(cuerpo) {
    let p = { ...PROYECTOS.erp }, r = 0.1, hover = -1, pl = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const sPre = ctl.selector({ etiqueta: 'Proyecto de partida', opciones: OPC, valor: 'erp', alCambiar: (k) => { p = { ...PROYECTOS[k] }; sync(); } });
    const rs = {
      I: ctl.rango({ etiqueta: 'Inversión inicial', min: 50, max: 1000, paso: 10, valor: p.I, formato: mm, alCambiar: (v) => { p.I = v; dibujar(); } }),
      B: ctl.rango({ etiqueta: 'Beneficio del año 1', min: 10, max: 400, paso: 5, valor: p.B, formato: mm, alCambiar: (v) => { p.B = v; dibujar(); } }),
      g: ctl.rango({ etiqueta: 'Crecimiento anual del beneficio', min: -0.1, max: 0.3, paso: 0.01, valor: p.g, formato: (v) => pct(v, 2), alCambiar: (v) => { p.g = v; dibujar(); } }),
      O: ctl.rango({ etiqueta: 'Costo operativo anual', min: 0, max: 100, paso: 5, valor: p.O, formato: mm, alCambiar: (v) => { p.O = v; dibujar(); } }),
      N: ctl.rango({ etiqueta: 'Vida útil', min: 3, max: 10, valor: p.N, formato: (v) => `${v} años`, alCambiar: (v) => { p.N = v; dibujar(); } }),
    };
    ctl.rango({ etiqueta: 'Tasa de descuento', min: 0, max: 0.3, paso: 0.005, valor: r, formato: (v) => pct(v, 3), alCambiar: (v) => { r = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'flujo anual positivo' }, { color: C.s8, texto: 'flujo anual negativo' },
      { color: C.tinta, texto: 'acumulado sin descontar', forma: 'linea' }, { color: C.s1, texto: 'acumulado descontado', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie los parámetros y observe cuándo la línea azul (acumulado descontado) cruza el cero: ese es el plazo de recuperación descontado. Suba la tasa hasta que el VPN llegue a cero: esa tasa es la TIR. Pase el cursor sobre un año para ver su flujo.');
    const sync = () => { Object.keys(rs).forEach((k) => { rs[k].valor = p[k]; }); dibujar(); };

    function dibujar() {
      const f = flujos(p), fd = descontados(f, r), ac = acumular(f), acd = acumular(fd);
      const vpn = acd[p.N], tir = SI.tir(f), benef = f.slice(1).reduce((q, x) => q + x, 0), rec = SI.recuperacion(f), recd = SI.recuperacion(fd);
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = [...f, ...ac, ...acd], lo = Math.min(0, ...todos), hi = Math.max(1, ...todos);
      pl = VIZ.plano(lienzo, { xmin: -0.6, xmax: p.N + 0.6, ymin: lo * 1.1, ymax: hi * 1.1 }, { etiquetaX: 'año', etiquetaY: 'millones', ticksX: f.map((_, t) => t), formatoX: (v) => String(Math.round(v)), formatoY: (v) => VIZ.entero(v), margen: { izq: 52 } });
      pl.ejes();
      const bw = Math.max(6, (pl.x1 - pl.x0) / (p.N + 1.2) - 8);
      geo = { bw };
      f.forEach((v, t) => {
        ctx.fillStyle = v >= 0 ? C.s6 : C.s8; if (t === hover) ctx.fillStyle = VIZ.alfa(v >= 0 ? C.s6 : C.s8, 0.7);
        const y0 = pl.sy(0), y1 = pl.sy(v);
        ctx.beginPath(); ctx.roundRect(pl.sx(t) - bw / 2, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0)), 3); ctx.fill();
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0) + 0.5); ctx.lineTo(pl.x1, pl.sy(0) + 0.5); ctx.stroke();
      VIZ.trazar(ctx, pl, ac.map((v, t) => [t, v]), C.tinta, 2);
      VIZ.trazar(ctx, pl, acd.map((v, t) => [t, v]), C.s1, 2);
      if (hover >= 0) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(ac[hover]), C.tinta, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(acd[hover]), C.s1, 4); }
      registro.textContent = `VPN = Σ F_t / (1 + ${pct(r, 3)})^t = ${mm(vpn)}: ${vpn > 0 ? 'crea valor, conviene' : vpn < 0 ? 'destruye valor, no conviene' : 'indiferente'}. ${Number.isFinite(tir) ? `Su TIR de ${pct(tir)} ${tir > r ? 'supera' : 'no alcanza'} la tasa exigida de ${pct(r, 3)}.` : 'No tiene TIR (los flujos no cambian de signo).'}`;
      lectura.set([['VPN', mm(vpn)], ['TIR', pct(tir)], ['retorno total', pct(SI.retorno(p.I, benef))], ['índice de rentabilidad', VIZ.fmt((vpn + p.I) / p.I, 3)], ['recuperación simple', anios(rec)], ['recuperación descontada', anios(recd)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      const t = Math.max(0, Math.min(p.N, Math.round(pl.ix(x)))); hover = t; dibujar();
      const f = flujos(p), fd = descontados(f, r), ac = acumular(f), acd = acumular(fd);
      tip.mostrar(x, y, `año <b>${t}</b>` + VIZ.filaTooltip(f[t] >= 0 ? C.s6 : C.s8, 'flujo', mm(f[t])) + `<div>valor presente <b>${mm(fd[t])}</b></div>` + VIZ.filaTooltip(C.tinta, 'acumulado', mm(ac[t])) + VIZ.filaTooltip(C.s1, 'acum. descontado', mm(acd[t])));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: tasa, riesgo y simulación ---------- */

  function montarRiesgo(cuerpo) {
    let k = 'nube', libre = 0.05, prima = 0.05, sobre = 0.15, real = 0.9, sigma = 0.2, semilla = 1, sims = [], hov = null, pl = null, hist = [], plH = null;
    const p = () => PROYECTOS[k];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proyecto', opciones: OPC, valor: k, alCambiar: (v) => { k = v; simular(); } });
    ctl.rango({ etiqueta: 'Tasa libre de riesgo', min: 0, max: 0.12, paso: 0.005, valor: libre, formato: (v) => pct(v, 2), alCambiar: (v) => { libre = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Prima de riesgo del proyecto', min: 0, max: 0.2, paso: 0.005, valor: prima, formato: (v) => pct(v, 2), alCambiar: (v) => { prima = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Sobrecosto esperado de la inversión', min: 0, max: 0.6, paso: 0.05, valor: sobre, formato: (v) => pct(v, 2), alCambiar: (v) => { sobre = v; simular(); } });
    ctl.rango({ etiqueta: 'Beneficios realmente obtenidos', min: 0.4, max: 1.2, paso: 0.05, valor: real, formato: (v) => pct(v, 3), alCambiar: (v) => { real = v; simular(); } });
    ctl.rango({ etiqueta: 'Incertidumbre (desviación)', min: 0, max: 0.4, paso: 0.05, valor: sigma, formato: (v) => pct(v, 2), alCambiar: (v) => { sigma = v; simular(); } });
    ctl.boton('Nuevas simulaciones', () => { semilla++; simular(); }, { primario: true });
    const tasa = () => libre + prima;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Distribución del VPN en 400 simulaciones');
    const lh = VIZ.lienzo(cuerpo, { proporcion: 0.35, altoMin: 200, altoMax: 280 });
    const tipH = VIZ.tooltip(lh);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'VPN con el plan original', forma: 'linea' }, { color: C.s1, texto: 'VPN con sobrecosto y beneficios reales', forma: 'linea' },
      { color: C.tinta, texto: 'tasa de descuento exigida', forma: 'linea' }, { color: C.s6, texto: 'simulaciones con VPN ≥ 0' }, { color: C.s8, texto: 'simulaciones con VPN < 0' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, el perfil del VPN: cruza el eje en la TIR. Subir la prima de riesgo mueve la tasa exigida (línea vertical) a la derecha del cruce y el proyecto deja de convenir. Abajo, el mismo proyecto simulado 400 veces con sobrecosto y beneficios inciertos: no basta que el VPN promedio sea positivo.');

    const vpnDe = (fi, fb, r) => SI.vpn(flujos(p(), fi, fb), r);
    function simular() {
      const rnd = VIZ.semilla(semilla * 523);
      sims = Array.from({ length: 400 }, () => {
        const fi = 1 + Math.max(-0.2, sobre + sigma * 0.5 * VIZ.normal(rnd)), fb = Math.max(0, real + sigma * VIZ.normal(rnd));
        return { fi, fb };
      });
      dibujar();
    }
    function dibujar() {
      const r = tasa(), { ctx } = lienzo;
      lienzo.limpiar();
      const base = (t) => vpnDe(1, 1, t), esc = (t) => vpnDe(1 + sobre, real, t), xs = Array.from({ length: 41 }, (_, i) => i / 100);
      const ys = [...xs.map(base), ...xs.map(esc)], lo = Math.min(0, ...ys), hi = Math.max(1, ...ys);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 0.4, ymin: lo * 1.1, ymax: hi * 1.1 }, { etiquetaX: 'tasa de descuento', etiquetaY: 'VPN (millones)', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => VIZ.entero(v), margen: { izq: 56 } });
      pl.ejes();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0) + 0.5); ctx.lineTo(pl.x1, pl.sy(0) + 0.5); ctx.stroke();
      VIZ.trazar(ctx, pl, xs.map((t) => [t, base(t)]), C.apagado, 2, [5, 4]);
      VIZ.trazar(ctx, pl, xs.map((t) => [t, esc(t)]), C.s1, 2);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(Math.min(0.4, r)), pl.y1); ctx.lineTo(pl.sx(Math.min(0.4, r)), pl.y0); ctx.stroke();
      const t0 = SI.tir(flujos(p())), t1 = SI.tir(flujos(p(), 1 + sobre, real));
      if (Number.isFinite(t0) && t0 <= 0.4) VIZ.marcador(ctx, pl.sx(t0), pl.sy(0), C.apagado, 5);
      if (Number.isFinite(t1) && t1 <= 0.4) VIZ.marcador(ctx, pl.sx(t1), pl.sy(0), C.s1, 5);
      if (hov !== null) { VIZ.marcador(ctx, pl.sx(hov), pl.sy(base(hov)), C.apagado, 4); VIZ.marcador(ctx, pl.sx(hov), pl.sy(esc(hov)), C.s1, 4); }
      // Histograma de VPN simulados a la tasa exigida
      const v = sims.map((s) => vpnDe(s.fi, s.fb, r)), mn = Math.min(...v), mx = Math.max(...v), nb = 16, w = (mx - mn) / nb || 1;
      hist = Array.from({ length: nb }, (_, i) => ({ a: mn + i * w, b: mn + (i + 1) * w, n: 0 }));
      v.forEach((x) => { hist[Math.min(nb - 1, Math.floor((x - mn) / w))].n++; });
      const c = lh.ctx; lh.limpiar();
      plH = VIZ.plano(lh, { xmin: mn, xmax: mx || mn + 1, ymin: 0, ymax: Math.max(...hist.map((b) => b.n)) * 1.1 }, { etiquetaX: 'VPN (millones)', etiquetaY: 'simulaciones', formatoX: (q) => VIZ.entero(q), formatoY: (q) => String(Math.round(q)), margen: { izq: 46 } });
      plH.ejes();
      hist.forEach((b) => { if (!b.n) return; const centro = (b.a + b.b) / 2; c.fillStyle = centro >= 0 ? C.s6 : C.s8; c.beginPath(); c.roundRect(plH.sx(b.a) + 1, plH.sy(b.n), plH.sx(b.b) - plH.sx(b.a) - 2, plH.y0 - plH.sy(b.n), [4, 4, 0, 0]); c.fill(); });
      if (mn < 0 && mx > 0) { c.strokeStyle = C.tinta; c.lineWidth = 2; c.beginPath(); c.moveTo(plH.sx(0), plH.y1); c.lineTo(plH.sx(0), plH.y0); c.stroke(); }
      const pos = v.filter((x) => x >= 0).length / v.length, media = v.reduce((q, x) => q + x, 0) / v.length, orden = [...v].sort((a, b) => a - b);
      registro.textContent = `Tasa exigida = ${pct(libre, 2)} + ${pct(prima, 2)} = ${pct(r, 3)}. VPN del plan: ${mm(base(r))}; con sobrecosto y beneficios reales: ${mm(esc(r))}. En 400 simulaciones el VPN es positivo en ${pct(pos, 3)} de los casos.`;
      lectura.set([['tasa exigida', pct(r, 3)], ['VPN del plan', mm(base(r))], ['TIR del plan', pct(t0)], ['TIR con sobrecosto', pct(t1)], ['VPN medio simulado', mm(media)], ['probabilidad de VPN ≥ 0', pct(pos, 3)], ['peor 5 %', mm(orden[Math.floor(0.05 * orden.length)])]]);
    }
    lienzo.alDibujar = () => sims.length && dibujar(); lh.alDibujar = () => sims.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hov = null; tip.ocultar(); return dibujar(); }
      hov = Math.max(0, Math.min(0.4, Math.round(pl.ix(x) * 100) / 100)); dibujar();
      tip.mostrar(x, y, `tasa <b>${pct(hov, 2)}</b>` + VIZ.filaTooltip(C.apagado, 'plan', mm(vpnDe(1, 1, hov))) + VIZ.filaTooltip(C.s1, 'con riesgo', mm(vpnDe(1 + sobre, real, hov))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hov = null; tip.ocultar(); dibujar(); });
    lh.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lh.posicion(ev), b = plH && hist.find((q) => plH.ix(x) >= q.a && plH.ix(x) < q.b);
      if (!b || !b.n || !plH.dentro(x, y)) return tipH.ocultar();
      tipH.mostrar(x, y, `VPN entre <b>${mm(b.a)}</b> y <b>${mm(b.b)}</b><br>${b.n} simulaciones (${pct(b.n / 400, 2)})`);
    });
    lh.canvas.addEventListener('pointerleave', () => tipH.ocultar());
    simular();
  }

  /* ---------- Fig. 3: cartera con restricción de presupuesto ---------- */

  const NOMBRES = ['ERP de finanzas', 'Portal de clientes', 'Migración a la nube', 'Facturación automática', 'Analítica de ventas', 'App móvil', 'Centro de seguridad', 'Asistente virtual', 'Renovación de red'];

  function montarCartera(cuerpo) {
    let semilla = 1, r = 0.1, presupuesto = 700, proy = [], sel = [], orden = [], geo = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto de inversión', min: 200, max: 1600, paso: 50, valor: presupuesto, formato: mm, alCambiar: (v) => { presupuesto = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tasa de descuento', min: 0.04, max: 0.2, paso: 0.005, valor: r, formato: (v) => pct(v, 3), alCambiar: (v) => { r = v; generar(false); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Aplicar el óptimo', () => { rep.detener(); sel = optimo().sel.slice(); dibujar(); });
    ctl.boton('Nuevos proyectos', () => { semilla++; generar(true); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'proyecto elegido' }, { color: C.inactivo, texto: 'no elegido' }, { color: C.s8, texto: 'VPN negativo' }, { color: C.tinta, texto: 'presupuesto', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es un proyecto: ancho = inversión, altura = índice de rentabilidad (VPN por peso invertido); están ordenados de mayor a menor índice. Haga clic en una barra para elegirla o quitarla, use el reproductor para ver la regla «mejores índices primero» y compare con «Aplicar el óptimo».');

    const vpnDe = (q) => SI.vpn(flujos(q), r);
    function generar(reiniciar) {
      if (reiniciar) {
        const rnd = VIZ.semilla(semilla * 71), nombres = NOMBRES.slice();
        for (let i = nombres.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [nombres[i], nombres[j]] = [nombres[j], nombres[i]]; }
        proy = nombres.map((n) => { const I = 50 + 10 * Math.floor(rnd() * 25); return { n, I, B: I * (0.17 + 0.3 * rnd()), g: 0.05, O: I * 0.04, N: 6, res: 0 }; });
      }
      proy.forEach((q) => { q.vpn = vpnDe(q); q.ir = q.vpn / q.I; });
      orden = proy.map((_, i) => i).sort((a, b) => proy[b].ir - proy[a].ir);
      sel = proy.map(() => false); rep.reiniciar();
    }
    function optimo() {
      let mejor = { vpn: 0, sel: proy.map(() => false), I: 0 };
      for (let m = 0; m < 1 << proy.length; m++) {
        let I = 0, v = 0; const s = proy.map((q, i) => ((m >> i) & 1) === 1);
        proy.forEach((q, i) => { if (s[i]) { I += q.I; v += q.vpn; } });
        if (I <= presupuesto && v > mejor.vpn) mejor = { vpn: v, sel: s, I };
      }
      return mejor;
    }
    function iniciar() {
      sel = proy.map(() => false);
      return (function* () {
        let gasto = 0;
        for (const i of orden) {
          const q = proy[i];
          if (q.vpn <= 0) registro.textContent = `«${q.n}» tiene VPN negativo (${mm(q.vpn)}): se descarta aunque sobre presupuesto.`;
          else if (gasto + q.I > presupuesto) registro.textContent = `«${q.n}» necesita ${mm(q.I)} y solo quedan ${mm(presupuesto - gasto)}: se omite y se sigue con el siguiente.`;
          else { sel[i] = true; gasto += q.I; registro.textContent = `Se elige «${q.n}»: índice ${VIZ.fmt(q.ir, 3)}, VPN ${mm(q.vpn)}. Gasto acumulado ${mm(gasto)}.`; }
          yield;
        }
        registro.textContent = `Regla terminada: gasto ${mm(gasto)} de ${mm(presupuesto)}.`;
      })();
    }
    function dibujar() {
      if (!proy.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const total = proy.reduce((q, x) => q + x.I, 0), irs = proy.map((q) => q.ir), lo = Math.min(0, ...irs), hi = Math.max(0.1, ...irs);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: total, ymin: lo * 1.15, ymax: hi * 1.15 }, { etiquetaX: 'inversión acumulada (millones)', etiquetaY: 'VPN por peso invertido', formatoX: (v) => VIZ.entero(v), formatoY: (v) => VIZ.fmt(v, 2) });
      pl.ejes();
      geo = []; let x = 0;
      orden.forEach((i) => {
        const q = proy[i], x0 = pl.sx(x), x1 = pl.sx(x + q.I), y0 = pl.sy(0), y1 = pl.sy(q.ir);
        ctx.fillStyle = q.vpn < 0 ? C.s8 : sel[i] ? C.s1 : C.inactivo; if (i === hover) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.75);
        ctx.beginPath(); ctx.roundRect(x0 + 1, Math.min(y0, y1), Math.max(2, x1 - x0 - 2), Math.max(1, Math.abs(y1 - y0)), 3); ctx.fill();
        if (sel[i]) { ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.strokeRect(x0 + 1, Math.min(y0, y1), Math.max(2, x1 - x0 - 2), Math.max(1, Math.abs(y1 - y0))); }
        geo.push({ x0, x1, i }); x += q.I;
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0) + 0.5); ctx.lineTo(pl.x1, pl.sy(0) + 0.5); ctx.stroke();
      if (presupuesto < total) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(presupuesto), pl.y1); ctx.lineTo(pl.sx(presupuesto), pl.y0); ctx.stroke(); ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('presupuesto', pl.sx(presupuesto) + 4, pl.y1 + 2); }
      const gasto = proy.reduce((q, y, i) => q + (sel[i] ? y.I : 0), 0), vpn = proy.reduce((q, y, i) => q + (sel[i] ? y.vpn : 0), 0), op = optimo();
      lectura.set([['elegidos', `${sel.filter(Boolean).length} de ${proy.length}`], ['inversión usada', `${mm(gasto)}${gasto > presupuesto ? ' (excede)' : ''}`], ['VPN de la cartera', mm(vpn)], ['VPN óptimo', mm(op.vpn)], ['brecha con el óptimo', mm(op.vpn - vpn)]]);
      lienzo.gasto = gasto;
    }
    const buscar = (x) => geo.find((g) => x >= g.x0 && x <= g.x1);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const g = buscar(lienzo.posicion(ev).x); if (!g) return;
      rep.detener(); sel[g.i] = !sel[g.i]; dibujar();
      const q = proy[g.i]; registro.textContent = `${sel[g.i] ? 'Elegido' : 'Quitado'}: «${q.n}» (inversión ${mm(q.I)}, VPN ${mm(q.vpn)}). Inversión total elegida ${mm(lienzo.gasto)}${lienzo.gasto > presupuesto ? `, que excede el presupuesto de ${mm(presupuesto)}` : ''}.`;
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = buscar(x), h = g ? g.i : -1;
      if (h !== hover) { hover = h; dibujar(); }
      if (!g) return tip.ocultar();
      const q = proy[g.i], f = flujos(q);
      tip.mostrar(x, y, `<b>${q.n}</b><br>inversión ${mm(q.I)} · ${q.N} años<br>VPN ${mm(q.vpn)}<br>índice ${VIZ.fmt(q.ir, 3)}<br>TIR ${pct(SI.tir(f))}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    generar(true);
  }

  VIZ.registrarTema('it-investment-decisions', {
    intro: String.raw`
      <p>Un sistema de información cuesta hoy y rinde durante años: ahorra costos, evita pérdidas o abre ventas. Para decidir si vale la pena hay que traer esos flujos futuros a una misma unidad. El <strong>valor presente neto</strong> (VPN) descuenta cada flujo según la tasa que exige la empresa; la <strong>tasa interna de retorno</strong> (TIR) es la tasa a la que el VPN se anula; y el <strong>plazo de recuperación</strong> dice cuánto tarda en volver lo invertido.</p>
      <p>Ninguno de estos números es verdad absoluta: dependen de beneficios que aún no existen y de una tasa que incluye el riesgo. Por eso se prueban con sensibilidad y simulación, y cuando el dinero no alcanza para todos los proyectos buenos, se arma una cartera.</p>`,
    visualizaciones: [
      {
        titulo: 'Flujo de caja, VPN, TIR y recuperación',
        descripcion: 'Parta de un proyecto y cambie inversión, beneficios, crecimiento, vida útil y tasa. Suba la tasa hasta que el VPN se anule (la TIR) y compare los plazos de recuperación simple y descontado.',
        montar: montarFlujo,
      },
      {
        titulo: 'Riesgo, tasa de descuento y simulación',
        descripcion: 'Aumente la prima de riesgo, el sobrecosto o la incertidumbre y observe cuánto baja la probabilidad de que el VPN sea positivo, aunque el plan original parezca sano. Compare el proyecto de la nube con el asistente virtual.',
        montar: montarRiesgo,
      },
      {
        titulo: 'Cartera con restricción de presupuesto',
        descripcion: 'Ejecute la regla de los mejores índices primero y compárela con el óptimo; luego elija proyectos a mano y baje el presupuesto hasta que la regla simple deje de ser óptima.',
        montar: montarCartera,
      },
    ],
    teoria: String.raw`
      <h2>Valor presente neto</h2>
      <p>Si un proyecto tiene flujos netos \(F_0 < 0\) (inversión) y \(F_1, \dots, F_N\) (beneficios menos costos operativos, más valor residual), y la empresa exige una tasa \(r\):</p>
      \[ \text{VPN}(r) = \sum_{t=0}^{N} \frac{F_t}{(1 + r)^t}. \]
      <p>Regla: aceptar si \(\text{VPN} > 0\). La tasa \(r\) suma la tasa libre de riesgo y una prima por el riesgo del proyecto: \(r = r_f + \pi\). Sube cuando el proyecto es más incierto, y el VPN baja.</p>
      <h2>TIR, retorno y recuperación</h2>
      <p>La <strong>TIR</strong> es la tasa \(\rho\) tal que \(\text{VPN}(\rho) = 0\); se acepta si \(\rho > r\). El <strong>retorno simple</strong> es \(\dfrac{\sum_{t \ge 1} F_t - I}{I}\) y no descuenta el tiempo. El <strong>plazo de recuperación</strong> es el primer \(t\) (con interpolación) en que el flujo acumulado es no negativo; si se descuentan los flujos, se obtiene el plazo descontado, siempre mayor. El <strong>índice de rentabilidad</strong> es \(\text{IR} = (\text{VPN} + I)/I\).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Un asistente virtual cuesta \(120\); deja \(60 - 25 = 35\) el primer año y los beneficios crecen 10 % anual durante 5 años. Con \(r = 10\,\%\): \(F = (-120,\ 35,\ 41{,}0,\ 47{,}6,\ 54{,}9,\ 62{,}8)\), y su VPN es \(-120 + 31{,}8 + 33{,}9 + 35{,}8 + 37{,}5 + 39{,}0 \approx +58{,}0\). La TIR ronda el 27 % y el flujo acumulado sin descontar pasa de cero entre el año 3 y el 4.</p></div>
      <h2>Sensibilidad y riesgo</h2>
      <p>El <em>perfil del VPN</em> es la curva \(\text{VPN}(r)\): decrece con \(r\) y cruza el eje en la TIR. Un sobrecosto \(\alpha\) y beneficios \(\beta\) veces los previstos desplazan toda la curva. Al tratar \(\alpha\) y \(\beta\) como variables aleatorias, la simulación de Monte Carlo entrega la <em>distribución</em> del VPN y la probabilidad \(P(\text{VPN} \ge 0)\), una medida de riesgo mucho más informativa que el valor esperado.</p>
      <h2>Cartera con presupuesto limitado</h2>
      <p>Con presupuesto \(P\) se busca el subconjunto \(S\) que maximiza \(\sum_{i \in S} \text{VPN}_i\) sujeto a \(\sum_{i \in S} I_i \le P\), un problema de mochila. Ordenar por \(\text{VPN}_i / I_i\) y llenar es una buena heurística pero no siempre óptima: un proyecto grande de buen índice puede impedir que entren dos medianos que suman más VPN.</p>
      <h2>Conexiones</h2>
      <p>Las inversiones deben alinearse con la estrategia (<a href="tema.html?id=strategic-alignment">alineamiento estratégico</a>). La comparación entre arrendar y comprar infraestructura usa estas mismas herramientas en <a href="tema.html?id=cloud-vs-on-premise-costs">costos nube frente a servidores propios</a>; la justificación formal de un proyecto está en <a href="tema.html?id=business-case">el caso de negocio</a>; y la selección de proyectos con restricciones es un caso de <a href="tema.html?id=investment-selection">selección de inversiones</a>.</p>`,
  });
})();
