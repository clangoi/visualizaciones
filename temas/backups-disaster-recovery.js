(function () {
  'use strict';
  const { color: C } = VIZ;
  const horas = (h) => (h >= 48 ? `${VIZ.fmt(h / 24, 3)} días` : h < 1 ? `${VIZ.fmt(h * 60, 3)} min` : `${VIZ.fmt(h, 3)} h`);
  const gb = (v) => (v >= 1000 ? `${VIZ.fmt(v / 1000, 3)} TB` : `${VIZ.fmt(v, 3)} GB`);
  const mil = (v) => (v >= 1000 ? `${VIZ.fmt(v / 1000, 3)} M USD` : `${VIZ.fmt(v, 3)} mil USD`);
  const recortar = (ctx, texto, ancho) => {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: respaldos completo, diferencial e incremental ---------- */

  const ESTRATEGIAS = {
    completo: { n: 'Completo todos los días' },
    dif: { n: 'Completo semanal + diferencial diario' },
    inc: { n: 'Completo semanal + incremental diario' },
  };
  const TIPOS = { F: { n: 'completo', col: C.s1 }, D: { n: 'diferencial', col: C.s3 }, I: { n: 'incremental', col: C.s4 } };
  const DIAS = 14;

  function montarRespaldos(cuerpo) {
    let est = 'dif', S = 500, delta = 0.05, tasa = 200, diaR = 12, hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', opciones: Object.entries(ESTRATEGIAS).map(([k, e]) => [k, e.n]), valor: est, alCambiar: (v) => { est = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Datos totales', min: 100, max: 2000, paso: 50, valor: S, formato: gb, alCambiar: (v) => { S = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Datos que cambian por día', min: 0.01, max: 0.2, paso: 0.01, valor: delta, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { delta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Velocidad de copia', min: 50, max: 1000, paso: 50, valor: tasa, formato: (v) => `${v} GB/h`, alCambiar: (v) => { tasa = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Restaurar al final del día', min: 1, max: DIAS, valor: diaR, alCambiar: (v) => { diaR = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(TIPOS).map((t) => ({ color: t.col, texto: `respaldo ${t.n}` })).concat([{ color: C.tinta, texto: 'conjuntos necesarios para restaurar (anillo)', forma: 'linea' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos semanas de respaldos. Cambie la estrategia y compare el espacio total con el trabajo de restaurar: haga clic en un día (o use el deslizador) y vea qué conjuntos se necesitan. Los semanales caen en los días 1 y 8.');

    function plan() {
      return Array.from({ length: DIAS }, (_, i) => {
        const d = i + 1, k = (d - 1) % 7;
        if (est === 'completo' || k === 0) return { d, tipo: 'F', tam: S };
        if (est === 'dif') return { d, tipo: 'D', tam: S * (1 - (1 - delta) ** k) };
        return { d, tipo: 'I', tam: S * delta };
      });
    }
    function cadena(p) {
      if (p[diaR - 1].tipo === 'F') return [diaR];
      const f = diaR - ((diaR - 1) % 7);
      return est === 'dif' ? [f, diaR] : Array.from({ length: diaR - f + 1 }, (_, i) => f + i);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const p = plan(), ch = cadena(p);
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: DIAS, ymin: 0, ymax: S * 1.1 }, { etiquetaX: 'día', etiquetaY: 'tamaño del respaldo (GB)', ticksX: [], formatoY: (v) => String(Math.round(v)) });
      geo = pl;
      pl.ejes();
      p.forEach((r, i) => {
        const x = pl.sx(i), w = pl.sx(i + 1) - x - 3, y = pl.sy(r.tam);
        const usado = ch.includes(r.d);
        ctx.globalAlpha = usado || i + 1 === hover ? 1 : 0.45;
        ctx.fillStyle = TIPOS[r.tipo].col; ctx.beginPath(); ctx.roundRect(x + 1.5, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
        ctx.globalAlpha = 1;
        if (usado) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x + 1.5, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.stroke(); }
        ctx.font = VIZ.fuente(10, usado ? 600 : 400); ctx.fillStyle = usado ? C.tinta : C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(r.d), x + 1.5 + w / 2, pl.y0 + 7);
      });
      const total = p.reduce((s, r) => s + r.tam, 0), rest = ch.reduce((s, d) => s + p[d - 1].tam, 0);
      const cop = p.reduce((s, r) => s + r.tam / tasa, 0) / DIAS, tRest = rest / tasa + 0.17 * ch.length;
      registro.textContent = `Para dejar los datos como estaban al final del día ${diaR} se restauran ${ch.length} conjunto(s): ${ch.map((d) => `día ${d} (${TIPOS[p[d - 1].tipo].n})`).join(' → ')}. Total ${gb(rest)}, ${horas(tRest)}.`;
      lectura.set([
        ['espacio de 14 días', gb(total)], ['copia diaria (promedio)', horas(cop)],
        ['conjuntos a restaurar', String(ch.length)], ['datos a restaurar', gb(rest)], ['tiempo de restauración', horas(tRest)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const dia = (x, y) => { if (!geo.dentro(x, y) && !(x >= geo.x0 && x <= geo.x1)) return -1; const d = Math.floor(geo.ix(x)) + 1; return d >= 1 && d <= DIAS ? d : -1; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const d = dia(x, y);
      if (d !== hover) { hover = d; dibujar(); }
      if (d < 0) return tip.ocultar();
      const r = plan()[d - 1];
      tip.mostrar(x, y, `<b>día ${d}</b>: respaldo ${TIPOS[r.tipo].n}<br>tamaño <b>${gb(r.tam)}</b><br>tarda ${horas(r.tam / tasa)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const d = dia(x, y); if (d > 0) { diaR = d; sinc(); dibujar(); } });
    const rangoDia = cuerpo.querySelectorAll('.controles input[type=range]')[3];
    function sinc() { rangoDia.value = diaR; rangoDia.dispatchEvent(new Event('input')); }
    dibujar();
  }

  /* ---------- Fig. 2: RPO, RTO y sitios de recuperación ---------- */

  const SITIOS = {
    ninguno: { n: 'Sin sitio alterno (comprar equipos)', extra: 72, costo: 0 },
    frio: { n: 'Sitio frío (espacio y energía)', extra: 24, costo: 20 },
    tibio: { n: 'Sitio tibio (equipos listos, datos atrasados)', extra: 4, costo: 80 },
    caliente: { n: 'Sitio caliente (réplica en línea)', extra: 0.25, costo: 250 },
  };

  function montarRpoRto(cuerpo) {
    let intervalo = 6, deteccion = 1, restaura = 6, sitio = 'tibio', metaRPO = 8, metaRTO = 12, cH = 10, cD = 15, tf = 30.5, semilla = 5, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Intervalo entre respaldos', min: 1, max: 24, valor: intervalo, formato: horas, alCambiar: (v) => { intervalo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Sitio de recuperación', opciones: Object.entries(SITIOS).map(([k, s]) => [k, s.n]), valor: sitio, alCambiar: (v) => { sitio = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Detectar la falla', min: 0.25, max: 8, paso: 0.25, valor: deteccion, formato: horas, alCambiar: (v) => { deteccion = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Restaurar datos y probar', min: 0.5, max: 48, paso: 0.5, valor: restaura, formato: horas, alCambiar: (v) => { restaura = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Meta de RPO', min: 1, max: 24, valor: metaRPO, formato: horas, alCambiar: (v) => { metaRPO = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Meta de RTO', min: 1, max: 72, valor: metaRTO, formato: horas, alCambiar: (v) => { metaRTO = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de cada hora de caída', min: 1, max: 50, valor: cH, formato: mil, alCambiar: (v) => { cH = v; dibujar(); } });
    ctl.boton('Falla al azar', () => { const r = VIZ.semilla(semilla++); tf = Math.round((8 + 56 * r()) * 4) / 4; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'respaldo', forma: 'linea' }, { color: C.s2, texto: 'datos perdidos (RPO real)' }, { color: C.s8, texto: 'servicio caído (RTO real)' },
      { color: C.tinta, texto: 'momento de la falla', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la línea de tiempo para mover la falla. Los datos perdidos son lo ocurrido desde el último respaldo; la caída dura detección + espera del sitio + restauración. Acorte el intervalo para cumplir el RPO y suba el sitio para cumplir el RTO.');

    const TOT = 72;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: TOT, ymin: 0, ymax: 1 }, { etiquetaX: 'horas', ticksY: [], margen: { izq: 12, sup: 22, inf: 40 } });
      pl.ejes();
      const ultimo = Math.floor(tf / intervalo) * intervalo, perdido = tf - ultimo;
      const rto = deteccion + SITIOS[sitio].extra + restaura;
      const yb = pl.y0 - 50, h = 46;
      ctx.fillStyle = VIZ.alfa(C.s2, 0.35); ctx.fillRect(pl.sx(ultimo), pl.y1 + 6, pl.sx(tf) - pl.sx(ultimo), pl.y0 - pl.y1 - 6);
      ctx.fillStyle = VIZ.alfa(C.s8, 0.22); ctx.fillRect(pl.sx(tf), pl.y1 + 6, Math.min(pl.x1, pl.sx(tf + rto)) - pl.sx(tf), pl.y0 - pl.y1 - 6);
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2;
      for (let t = 0; t <= TOT + 1e-9; t += intervalo) { ctx.beginPath(); ctx.moveTo(pl.sx(t), yb); ctx.lineTo(pl.sx(t), yb + h); ctx.stroke(); }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pl.sx(tf), pl.y1); ctx.lineTo(pl.sx(tf), pl.y0); ctx.stroke();
      ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'bottom'; ctx.fillStyle = C.tinta; ctx.textAlign = 'center';
      ctx.fillText('falla', pl.sx(tf), pl.y1 + 4);
      ctx.fillStyle = C.tinta2; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      if (pl.sx(tf) - pl.sx(ultimo) > 70) ctx.fillText(`pierde ${horas(perdido)}`, (pl.sx(ultimo) + pl.sx(tf)) / 2, pl.y1 + 14);
      if (Math.min(pl.x1, pl.sx(tf + rto)) - pl.sx(tf) > 70) ctx.fillText(`caído ${horas(rto)}`, (pl.sx(tf) + Math.min(pl.x1, pl.sx(tf + rto))) / 2, pl.y1 + 14);
      const costo = rto * cH + perdido * cD, okR = perdido <= metaRPO, okT = rto <= metaRTO;
      registro.textContent = `Último respaldo: hora ${VIZ.fmt(ultimo, 3)}. La falla ocurre en la hora ${VIZ.fmt(tf, 3)}: se pierden ${horas(perdido)} de datos (${okR ? 'cumple' : 'NO cumple'} el RPO de ${horas(metaRPO)}) y el servicio vuelve tras ${horas(deteccion)} + ${horas(SITIOS[sitio].extra)} + ${horas(restaura)} = ${horas(rto)} (${okT ? 'cumple' : 'NO cumple'} el RTO de ${horas(metaRTO)}).`;
      lectura.set([
        ['datos perdidos (RPO real)', horas(perdido)], ['peor caso de pérdida', horas(intervalo)], ['pérdida media esperada', horas(intervalo / 2)],
        ['caída (RTO real)', horas(rto)], ['costo de este incidente', mil(costo)], ['costo anual del sitio', mil(SITIOS[sitio].costo)],
        ['metas', `${okR ? 'RPO sí' : 'RPO no'} · ${okT ? 'RTO sí' : 'RTO no'}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const hacia = (ev) => { const { x, y } = lienzo.posicion(ev); return { x, y, t: Math.max(0.25, Math.min(TOT - 0.25, Math.round(pl.ix(x) * 4) / 4)) }; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, t } = hacia(ev);
      if (!pl.dentro(x, y)) return tip.ocultar();
      const ult = Math.floor(t / intervalo) * intervalo;
      tip.mostrar(x, y, `hora <b>${VIZ.fmt(t, 3)}</b><br>si falla aquí: último respaldo en ${VIZ.fmt(ult, 3)}<br>pérdida <b>${horas(t - ult)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y, t } = hacia(ev); if (pl.dentro(x, y)) { tf = t; dibujar(); } });
    dibujar();
  }

  /* ---------- Fig. 3: regla 3-2-1 ---------- */

  const MEDIOS = [{ n: 'Disco', enLinea: true }, { n: 'Cinta', enLinea: false }, { n: 'Nube', enLinea: true }];
  const LUGARES = ['Oficina', 'Sitio externo'];
  const PRESETS = [
    { n: 'Solo el original', m: [[1, 0], [0, 0], [0, 0]] },
    { n: 'Dos discos en la oficina', m: [[2, 0], [0, 0], [0, 0]] },
    { n: 'Regla 3-2-1', m: [[2, 0], [0, 0], [0, 1]] },
    { n: '3-2-1 con cinta sin conexión', m: [[1, 0], [0, 1], [0, 1]] },
  ];

  function montarRegla321(cuerpo) {
    const m = PRESETS[2].m.map((f) => f.slice());
    let pc = 0.05, pm = 0.03, ps = 0.02, pr = 0.08, hover = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Falla individual de una copia (año)', min: 0.01, max: 0.2, paso: 0.01, valor: pc, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pc = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Falla de un tipo de medio (lote, firmware)', min: 0, max: 0.1, paso: 0.005, valor: pm, formato: (v) => `${VIZ.fmt(v * 100, 3)} %`, alCambiar: (v) => { pm = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Desastre en un lugar', min: 0, max: 0.1, paso: 0.005, valor: ps, formato: (v) => `${VIZ.fmt(v * 100, 3)} %`, alCambiar: (v) => { ps = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ransomware que cifra copias en línea', min: 0, max: 0.3, paso: 0.01, valor: pr, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pr = v; dibujar(); } });
    PRESETS.forEach((pr_) => ctl.boton(pr_.n, () => { pr_.m.forEach((f, i) => f.forEach((v, j) => { m[i][j] = v; })); dibujar(); }));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 56 + MEDIOS.length * 40 + 54 + 34 + (PRESETS.length + 1) * 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'copia (cada cuadro es una copia)' }, { color: C.s6, texto: 'condición de la regla cumplida' }, { color: C.s8, texto: 'condición no cumplida' },
      { color: C.s2, texto: 'su configuración (barra)' }, { color: C.apagado, texto: 'configuraciones de referencia (barras)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda para agregar copias (hasta 3; luego vuelve a 0). La probabilidad de conservar al menos una copia se calcula exactamente sumando todas las combinaciones de fallas. Las barras comparan configuraciones por «nueves» de supervivencia.');

    function supervivencia(mat) {
      // Eventos binarios: fallo del medio (3), fallo del lugar (2), ransomware (1).
      let total = 0;
      for (let mask = 0; mask < 64; mask++) {
        let pr_ = 1;
        const medioMal = MEDIOS.map((_, i) => !!(mask & (1 << i))), lugarMal = LUGARES.map((_, j) => !!(mask & (1 << (3 + j)))), ransom = !!(mask & 32);
        medioMal.forEach((b) => { pr_ *= b ? pm : 1 - pm; });
        lugarMal.forEach((b) => { pr_ *= b ? ps : 1 - ps; });
        pr_ *= ransom ? pr : 1 - pr;
        if (!pr_) continue;
        let vivas = 0;
        mat.forEach((f, i) => f.forEach((n, j) => { if (!medioMal[i] && !lugarMal[j] && !(ransom && MEDIOS[i].enLinea)) vivas += n; }));
        total += pr_ * (1 - pc ** vivas);
      }
      return total;
    }
    const nueves = (s) => -Math.log10(Math.max(1e-9, 1 - s));
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 74, cw = Math.min(150, (W - izq - 8) / 2), top = 26, fil = 40;
      geo = { izq, cw, top, fil };
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      LUGARES.forEach((l, j) => ctx.fillText(l, izq + (j + 0.5) * cw, 12));
      MEDIOS.forEach((md, i) => {
        const y = top + i * fil;
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(md.n + (md.enLinea ? '' : ' (offline)'), 6, y + fil / 2);
        LUGARES.forEach((_, j) => {
          const x = izq + j * cw;
          ctx.beginPath(); ctx.roundRect(x + 3, y + 3, cw - 6, fil - 6, 4);
          ctx.fillStyle = hover && hover.i === i && hover.j === j ? C.neutro : C.superficie; ctx.fill(); ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.stroke();
          for (let k = 0; k < m[i][j]; k++) { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x + 14 + k * 26, y + 10, 20, fil - 20, 3); ctx.fill(); }
        });
      });
      const copias = m.flat().reduce((s, v) => s + v, 0), tipos = m.filter((f) => f[0] + f[1] > 0).length, fuera = m.reduce((s, f) => s + f[1], 0);
      const cond = [[copias >= 3, `${copias} copias (≥ 3)`], [tipos >= 2, `${tipos} medios (≥ 2)`], [fuera >= 1, `${fuera} fuera del sitio (≥ 1)`]];
      const yc = top + MEDIOS.length * fil + 8, ancho = (W - 12) / 3;
      cond.forEach(([ok, t], k) => {
        ctx.beginPath(); ctx.roundRect(6 + k * ancho, yc, ancho - 6, 30, 4); ctx.fillStyle = VIZ.alfa(ok ? C.s6 : C.s8, 0.15); ctx.fill(); ctx.strokeStyle = ok ? C.s6 : C.s8; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(recortar(ctx, `${ok ? '✓' : '✗'} ${t}`, ancho - 12), 6 + k * ancho + (ancho - 6) / 2, yc + 15);
      });
      const filas = PRESETS.map((p) => ({ n: p.n, s: supervivencia(p.m), col: C.apagado })).concat([{ n: 'Su configuración', s: supervivencia(m), col: C.s2 }]);
      const yb = yc + 46, bh = 30, bl = izq + 80, esc = (W - bl - 56) / 6;
      geo.yb = yb; geo.bh = bh; geo.filas = filas; geo.bl = bl;
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('nueves de supervivencia (−log₁₀ de la probabilidad de perderlo todo)', 6, yb - 20);
      filas.forEach((f, k) => {
        const y = yb + k * bh, v = nueves(f.s);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(recortar(ctx, f.n, bl - 10), 6, y + bh / 2 - 1);
        ctx.beginPath(); ctx.roundRect(bl, y + 5, Math.max(2, v * esc), bh - 10, [0, 4, 4, 0]); ctx.fillStyle = f.col; ctx.fill();
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.fillText(`${VIZ.fmt((1 - f.s) * 100, 3)} %`, bl + v * esc + 6, y + bh / 2 - 1);
      });
      const s = filas[filas.length - 1].s;
      registro.textContent = `Con ${copias} copia(s) en ${tipos} medio(s) y ${fuera} fuera del sitio, la probabilidad de perder todas en un año es ${VIZ.fmt((1 - s) * 100, 3)} %${s < 1 ? ` (una vez cada ${VIZ.fmt(1 / (1 - s), 3)} años)` : ''}. ${cond.every(([ok]) => ok) ? 'Cumple la regla 3-2-1.' : 'No cumple la regla 3-2-1.'}`;
      lectura.set([
        ['copias · medios · fuera', `${copias} · ${tipos} · ${fuera}`], ['probabilidad de perderlo todo', `${VIZ.fmt((1 - s) * 100, 3)} %`],
        ['supervivencia', `${VIZ.fmt(s * 100, 5)} %`], ['nueves', VIZ.fmt(nueves(s), 3)], ['regla 3-2-1', cond.every(([ok]) => ok) ? 'cumple' : 'no cumple'],
      ]);
    }
    const celda = (x, y) => {
      const j = Math.floor((x - geo.izq) / geo.cw), i = Math.floor((y - geo.top) / geo.fil);
      return j >= 0 && j < 2 && i >= 0 && i < MEDIOS.length ? { i, j } : null;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celda(x, y);
      hover = c; dibujar();
      if (c) return tip.mostrar(x, y, `<b>${MEDIOS[c.i].n}</b> en ${LUGARES[c.j]}<br>${m[c.i][c.j]} copia(s)<br>${MEDIOS[c.i].enLinea ? 'en línea: el ransomware la alcanza' : 'sin conexión: el ransomware no la alcanza'}`);
      const k = Math.floor((y - geo.yb) / geo.bh);
      if (k >= 0 && k < geo.filas.length && x >= geo.bl) return tip.mostrar(x, y, `<b>${geo.filas[k].n}</b><br>supervivencia ${VIZ.fmt(geo.filas[k].s * 100, 5)} %<br>pérdida ${VIZ.fmt((1 - geo.filas[k].s) * 100, 3)} %`);
      tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const c = celda(x, y); if (c) { m[c.i][c.j] = (m[c.i][c.j] + 1) % 4; dibujar(); } });
    dibujar();
  }

  VIZ.registrarTema('backups-disaster-recovery', {
    intro: String.raw`
      <p>Un <strong>respaldo</strong> es una copia de los datos que permite volver a un estado anterior cuando algo sale mal: un borrado, un ransomware, un incendio. La <strong>recuperación ante desastres</strong> (DR) va más allá de los datos: es el plan para volver a operar los sistemas.
      Dos números la guían: cuántos datos puede perder la organización (<strong>RPO</strong>) y cuánto tiempo puede estar sin servicio (<strong>RTO</strong>).</p>
      <p>Un respaldo que nunca se probó no es una garantía. Y si todas las copias están en el mismo lugar, en el mismo tipo de disco y conectadas a la red, un solo evento las destruye a todas; de ahí la regla 3-2-1.</p>`,
    visualizaciones: [
      {
        titulo: 'Completo, diferencial e incremental',
        descripcion: 'Cambie la estrategia y haga clic en distintos días: el incremental ocupa poco espacio pero exige una cadena larga para restaurar; el diferencial necesita solo dos conjuntos. Pruebe restaurar el día 7 y el día 14.',
        montar: montarRespaldos,
      },
      {
        titulo: 'RPO, RTO y sitio de recuperación',
        descripcion: 'Mueva la falla con clic y cambie el intervalo entre respaldos: la pérdida nunca supera el intervalo. Pruebe «Sitio caliente» para bajar el RTO y observe el costo anual que se paga a cambio.',
        montar: montarRpoRto,
      },
      {
        titulo: 'La regla 3-2-1',
        descripcion: 'Agregue copias con clic y compare con las configuraciones de referencia. Pruebe dos discos en la misma oficina (casi no mejora) y luego una copia en cinta sin conexión frente a un ransomware del 8 %.',
        montar: montarRegla321,
      },
    ],
    teoria: String.raw`
      <h2>Tipos de respaldo</h2>
      <table>
        <tr><th>Tipo</th><th>Qué copia</th><th>Espacio</th><th>Restaurar el día \(k\)</th></tr>
        <tr><td>Completo</td><td>todos los datos</td><td>\(S\) por copia</td><td>1 conjunto</td></tr>
        <tr><td>Diferencial</td><td>cambios desde el último completo</td><td>crece con los días</td><td>completo + último diferencial (2)</td></tr>
        <tr><td>Incremental</td><td>cambios desde el último respaldo</td><td>pequeño y casi constante</td><td>completo + todos los incrementales (hasta 7)</td></tr>
      </table>
      <p>Si cada día cambia una fracción \(\delta\) de los datos \(S\), un incremental pesa \(\approx \delta S\), y un diferencial al día \(k\) después del completo pesa \(S\,[1-(1-\delta)^k]\), porque los cambios se superponen. Restaurar exige copiar el conjunto de la cadena y tiene un costo fijo por montar cada uno:</p>
      \[ t_{\text{rest}} = \frac{\sum_{j \in \text{cadena}} \text{tam}_j}{v} + n_{\text{cadena}}\, t_{\text{montaje}}. \]
      <h2>RPO y RTO</h2>
      <ul>
        <li><strong>RPO</strong> (objetivo de punto de recuperación): máxima pérdida de datos tolerada, medida en tiempo. Con respaldos cada \(I\) horas, la pérdida real va de \(0\) a \(I\) y en promedio es \(I/2\).</li>
        <li><strong>RTO</strong> (objetivo de tiempo de recuperación): máximo tiempo sin servicio. Es la suma de detectar, preparar dónde restaurar y restaurar: \(\mathrm{RTO} = t_{\text{detección}} + t_{\text{sitio}} + t_{\text{restauración}}\).</li>
      </ul>
      <table>
        <tr><th>Sitio alterno</th><th>Qué tiene</th><th>Tiempo extra típico</th><th>Costo relativo</th></tr>
        <tr><td>Frío</td><td>espacio, energía, conectividad</td><td>días</td><td>bajo</td></tr>
        <tr><td>Tibio</td><td>equipos instalados, datos algo atrasados</td><td>horas</td><td>medio</td></tr>
        <tr><td>Caliente</td><td>réplica casi en tiempo real</td><td>minutos</td><td>alto</td></tr>
      </table>
      <p>El costo del incidente combina ambos objetivos: \(c = c_h\,\mathrm{RTO} + c_d\,\Delta_{\text{datos}}\), y la inversión óptima en el sitio es la que minimiza la suma del costo anual del sitio y de la pérdida esperada.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Respaldos cada 6 h y falla a la hora 30,5: el último respaldo fue a la hora 30, así que se pierden solo \(0{,}5\) h. Si hubiera fallado a la hora 35,9 se perderían \(5{,}9\) h, casi el intervalo completo. Con detección de 1 h, sitio tibio (4 h) y restauración de 6 h,
      \(\mathrm{RTO} = 1 + 4 + 6 = 11\) h. Un RTO meta de 12 h se cumple; un RPO meta de 4 h no, porque el intervalo de 6 h permite perder hasta 6 h.</p></div>
      <h2>La regla 3-2-1</h2>
      <p>Mantenga <strong>3</strong> copias de los datos (el original y dos respaldos), en <strong>2</strong> tipos de medio distintos, con <strong>1</strong> copia fuera del sitio. Una variante actual añade una copia sin conexión o inmutable, que un ransomware no pueda cifrar. Si los eventos de pérdida son independientes,
      la probabilidad de perder todo es el producto de las probabilidades de que cada copia falle; pero las copias del mismo medio o del mismo lugar fallan juntas, por lo que se cuenta con probabilidad exacta de las combinaciones de eventos comunes:</p>
      \[ P(\text{sobrevivir}) = \sum_{e} P(e)\,\bigl(1 - p_c^{\,n_e}\bigr), \]
      <p>donde \(e\) es una combinación de eventos comunes (falla de un medio, de un lugar, ransomware), \(n_e\) el número de copias que quedan vivas y \(p_c\) la probabilidad de falla individual de una copia.</p>
      <h2>Probar los respaldos</h2>
      <p>Solo una restauración de prueba demuestra que el respaldo sirve y mide el RTO real. Debe hacerse periódicamente, incluyendo el caso peor (reconstruir en el sitio alterno), y los tiempos medidos reemplazan a las estimaciones.</p>
      <h2>Conexiones</h2>
      <p>Los respaldos refuerzan la disponibilidad de la <a href="tema.html?id=cia-triad">tríada CIA</a>. El orden en que se restauran los servicios depende del análisis de impacto en <a href="tema.html?id=continuity-risk-mitigation">continuidad del negocio</a>,
      y la restauración es parte de la fase final de <a href="tema.html?id=incident-management">gestión de incidentes</a>. El caso de la disponibilidad por componentes se ve en <a href="tema.html?id=scalability-availability">escalabilidad y disponibilidad</a>.</p>`,
  });
})();
