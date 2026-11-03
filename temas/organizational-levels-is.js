(function () {
  'use strict';
  const { color: C } = VIZ;
  const SI = VIZ.si;
  const mon = (v) => '$' + VIZ.entero(v);

  const SIS = {
    TPS: {
      sigla: 'TPS', nombre: 'Procesamiento de transacciones', nivel: 'Operativo', col: C.s1, estructura: 0.92, alcance: 0.1,
      entradas: 'transacciones: ventas, pagos, despachos', proc: 'validar, registrar y actualizar archivos', salidas: 'registros y documentos detallados (boletas, guías)',
      usuarios: 'cajeros, bodegueros, administrativos', decision: 'estructurada: la regla está escrita', horizonte: 'minutos a horas',
    },
    MIS: {
      sigla: 'MIS', nombre: 'Información gerencial', nivel: 'Gerencial', col: C.s2, estructura: 0.72, alcance: 0.42,
      entradas: 'datos resumidos que vienen de los TPS', proc: 'agregar y comparar con lo planificado', salidas: 'informes periódicos y de excepción',
      usuarios: 'jefes de área y gerentes medios', decision: 'estructurada o semiestructurada', horizonte: 'semanas a meses',
    },
    DSS: {
      sigla: 'DSS', nombre: 'Apoyo a decisiones', nivel: 'Gerencial', col: C.s3, estructura: 0.4, alcance: 0.58,
      entradas: 'datos internos y externos más modelos', proc: 'análisis interactivo y simulación de escenarios', salidas: 'proyecciones y alternativas comparadas',
      usuarios: 'analistas y gerentes', decision: 'semiestructurada: hay datos pero también criterio', horizonte: 'meses a trimestres',
    },
    ESS: {
      sigla: 'ESS', nombre: 'Apoyo a ejecutivos', nivel: 'Estratégico', col: C.s4, estructura: 0.1, alcance: 0.92,
      entradas: 'datos internos agregados y externos (mercado, competencia)', proc: 'tableros, tendencias y navegación hacia el detalle', salidas: 'indicadores y alertas de alto nivel',
      usuarios: 'directorio y gerencia general', decision: 'no estructurada: sin regla previa', horizonte: 'años',
    },
  };
  const CLAVES = ['ESS', 'DSS', 'MIS', 'TPS']; // de arriba hacia abajo en la pirámide

  /* ---------- Fig. 1: ubicar cada sistema ---------- */

  const CASOS = [
    ['Registrar la venta en la caja y emitir la boleta', 'TPS'],
    ['Descontar del inventario cada despacho de bodega', 'TPS'],
    ['Calcular las remuneraciones al cierre del mes', 'TPS'],
    ['Informe mensual de ventas por sucursal frente a la meta', 'MIS'],
    ['Lista de productos bajo el stock mínimo (informe de excepción)', 'MIS'],
    ['Comparar gasto real y presupuesto por departamento', 'MIS'],
    ['Simular qué pasa con la utilidad si el precio sube 5 % y la demanda baja 3 %', 'DSS'],
    ['Elegir rutas de reparto que minimicen costo con restricciones de horario', 'DSS'],
    ['Tablero del directorio con participación de mercado y tendencias de la competencia', 'ESS'],
    ['Decidir si la empresa entra a otro país en los próximos cinco años', 'ESS'],
  ];

  function montarPiramide(cuerpo) {
    let caso = 0, sel = null, resp = null, aciertos = 0, intentos = 0, geo = [];
    const ctl = VIZ.controles(cuerpo);
    const selCaso = ctl.selector({ etiqueta: 'Situación', opciones: CASOS.map((c, i) => [i, `${i + 1}. ${c[0]}`]), valor: 0, alCambiar: (v) => { caso = +v; resp = null; sel = null; dibujar(); } });
    ctl.boton('Otra situación', () => { caso = (caso + 1) % CASOS.length; selCaso.valor = caso; resp = null; sel = null; dibujar(); }, { primario: true });
    ctl.boton('Reiniciar puntaje', () => { aciertos = 0; intentos = 0; resp = null; sel = null; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 320 : 340) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...CLAVES.slice().reverse().map((k) => ({ color: SIS[k].col, texto: `${SIS[k].sigla}: ${SIS[k].nombre.toLowerCase()}` })),
      { color: C.s6, texto: 'respuesta correcta', forma: 'linea' },
      { color: C.s8, texto: 'su respuesta, si se equivocó', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Lea la situación del selector y haga clic en el peldaño de la pirámide que la apoyaría. Después del primer clic se evalúa su respuesta; los demás clics solo muestran el perfil de cada sistema en la lectura.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      geo = [];
      const izq = W < 520 ? 74 : 100, der = 8, top = 30, base = H - 14, h = (base - top) / 4;
      const cx = izq + (W - izq - der) / 2, wMax = W - izq - der, wMin = wMax * 0.14;
      const ancho = (y) => wMin + (wMax - wMin) * ((y - top) / (base - top));
      ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
      ctx.fillText(CASOS[caso][0].length > (W < 520 ? 44 : 90) ? CASOS[caso][0].slice(0, W < 520 ? 44 : 90) + '…' : CASOS[caso][0], 8, 16);
      const correcto = CASOS[caso][1];
      CLAVES.forEach((k, i) => {
        const y0 = top + i * h, y1 = y0 + h, w0 = ancho(y0), w1 = ancho(y1);
        ctx.beginPath(); ctx.moveTo(cx - w0 / 2 + 1, y0 + 1); ctx.lineTo(cx + w0 / 2 - 1, y0 + 1); ctx.lineTo(cx + w1 / 2 - 1, y1 - 1); ctx.lineTo(cx - w1 / 2 + 1, y1 - 1); ctx.closePath();
        ctx.fillStyle = VIZ.alfa(SIS[k].col, sel === k ? 0.45 : 0.22); ctx.fill();
        let borde = SIS[k].col, grosor = 1.5;
        if (resp && k === correcto) { borde = C.s6; grosor = 4; }
        else if (resp && k === resp && resp !== correcto) { borde = C.s8; grosor = 4; }
        else if (sel === k) grosor = 3;
        ctx.strokeStyle = borde; ctx.lineWidth = grosor; ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(14, 700);
        ctx.fillText(SIS[k].sigla, cx, y0 + h / 2 - 1);
        ctx.font = VIZ.fuente(W < 520 ? 9 : 11); ctx.fillStyle = C.tinta2;
        if (w0 > 120) ctx.fillText(W < 520 ? SIS[k].nombre.split(' ')[0] : SIS[k].nombre, cx, y0 + h / 2 + 14);
        geo.push({ k, y0, y1, w0, w1, cx });
      });
      // Niveles a la izquierda.
      ctx.font = VIZ.fuente(W < 520 ? 10 : 11, 600); ctx.textAlign = 'left'; ctx.fillStyle = C.tinta2;
      [['Estratégico', 0, 1], ['Gerencial', 1, 3], ['Operativo', 3, 4]].forEach(([n, a, b]) => {
        const ya = top + a * h + 3, yb = top + b * h - 3;
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(izq - 10, ya); ctx.lineTo(izq - 6, ya); ctx.lineTo(izq - 6, yb); ctx.lineTo(izq - 10, yb); ctx.stroke();
        ctx.fillText(n, 6, (ya + yb) / 2 + 4);
      });
      const s = SIS[sel || resp || correcto];
      const ver = sel || resp;
      lectura.set(ver ? [
        ['sistema', `${s.sigla} · ${s.nombre}`], ['nivel', s.nivel], ['entradas', s.entradas], ['procesamiento', s.proc], ['salidas', s.salidas], ['tipo de decisión', s.decision],
      ] : [['puntaje', `${aciertos} de ${intentos}`], ['situaciones', `${CASOS.length}`]]);
      if (!resp) registro.textContent = `Situación ${caso + 1}: «${CASOS[caso][0]}». ¿Qué sistema la apoya? Haga clic en un peldaño. Puntaje: ${aciertos} de ${intentos}.`;
      else registro.textContent = (resp === correcto ? 'Correcto. ' : `No: eligió ${resp}, pero corresponde ${correcto}. `) + `${SIS[correcto].sigla} atiende decisiones ${SIS[correcto].decision.split(':')[0]} con horizonte de ${SIS[correcto].horizonte}. Puntaje: ${aciertos} de ${intentos}.`;
    }
    const capa = (x, y) => geo.find((g) => y >= g.y0 && y <= g.y1 && Math.abs(x - g.cx) <= (g.w0 + (g.w1 - g.w0) * (y - g.y0) / (g.y1 - g.y0)) / 2);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = capa(x, y);
      if (!g) return tip.ocultar();
      const s = SIS[g.k];
      tip.mostrar(x, y, `<b>${s.sigla}</b> · ${s.nombre}<br>usuarios: ${s.usuarios}<br>horizonte: ${s.horizonte}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = capa(x, y);
      if (!g) return;
      sel = g.k;
      if (!resp) { resp = g.k; intentos++; if (g.k === CASOS[caso][1]) aciertos++; }
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: cuántos datos mira cada nivel ---------- */

  function montarVolumen(cuerpo) {
    let semilla = 1, meses = 12, porMes = 14, filas = [], barras = [], sel = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Periodo cubierto', min: 1, max: 24, valor: meses, formato: (v) => `${v} ${v === 1 ? 'mes' : 'meses'}`, alCambiar: (v) => { meses = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ventas por mes', min: 5, max: 60, valor: porMes, formato: (v) => `${v}`, alCambiar: (v) => { porMes = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CLAVES.slice().reverse().map((k) => ({ color: SIS[k].col, texto: `${SIS[k].sigla}: ${SIS[k].nombre.toLowerCase()}` })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La escala vertical es logarítmica: cada marca vale diez veces la anterior. Cambie el periodo y el volumen de ventas: el TPS crece con cada venta, mientras que el tablero ejecutivo apenas se mueve. Haga clic en una barra para ver una cifra de ejemplo.');

    function calcular() {
      filas = SI.ventas(semilla * 11 + 2, 24, porMes).filter((r) => r.mes >= 24 - meses);
      const gMIS = SI.agrupar(filas, ['mes', 'region', 'producto']), gDSS = SI.agrupar(filas, ['anio', 'trim', 'region']);
      const anios = [...new Set(filas.map((r) => r.anio))].length;
      const ing = filas.reduce((s, r) => s + r.ingreso, 0), cos = filas.reduce((s, r) => s + r.costo, 0);
      barras = [
        { k: 'TPS', n: filas.length, unidad: 'registros de venta', ej: `La venta n.º ${filas.length}: ${filas[filas.length - 1].unidades} unidades de ${filas[filas.length - 1].producto} en ${filas[filas.length - 1].region} por ${mon(filas[filas.length - 1].ingreso)}.` },
        { k: 'MIS', n: gMIS.length, unidad: 'celdas del informe mensual (mes × región × producto)', ej: `Una celda: ${gMIS[gMIS.length - 1].clave.slice(1).join(' · ')} en el mes ${gMIS[gMIS.length - 1].clave[0] + 1} vendió ${mon(gMIS[gMIS.length - 1].valor)} (${gMIS[gMIS.length - 1].n} ventas).` },
        { k: 'DSS', n: gDSS.length, unidad: 'filas del modelo (año × trimestre × región)', ej: `Una fila del modelo: ${gDSS[0].clave[0]} T${gDSS[0].clave[1]} en ${gDSS[0].clave[2]} suma ${mon(gDSS[0].valor)}; sobre esa base se simulan escenarios.` },
        { k: 'ESS', n: 4 * anios, unidad: 'indicadores del tablero (4 por año)', ej: `Ingreso ${mon(ing)}, margen ${VIZ.fmt((1 - cos / ing) * 100, 3)} % del periodo.` },
      ];
      dibujar();
    }
    function dibujar() {
      if (!barras.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 1, ymax: Math.pow(10, Math.ceil(Math.log10(barras[0].n * 1.5))) }, { logY: true, etiquetaY: 'datos que el sistema debe manejar para decidir', ticksX: [], formatoY: (v) => VIZ.entero(v), margen: { izq: 62, sup: 30 } });
      pl.ejes();
      barras.forEach((b, i) => {
        const x = pl.sx(i + 0.12), w = pl.sx(i + 0.88) - x, y = pl.sy(b.n);
        ctx.fillStyle = SIS[b.k].col; ctx.beginPath(); ctx.roundRect(x, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
        if (sel === b.k) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.stroke(); }
        ctx.textAlign = 'center'; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13, 600); ctx.fillText(VIZ.entero(b.n), x + w / 2, y - 7);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.fillText(b.k, x + w / 2, pl.y0 + 16);
        b.caja = { x, y, w, h: pl.y0 - y };
      });
      const e = barras.find((b) => b.k === sel);
      registro.textContent = e ? `${e.k}: ${e.ej}` : `El TPS maneja ${VIZ.entero(barras[0].n)} registros; para el nivel estratégico se resumen en ${barras[3].n} indicadores: el nivel superior consume datos ya procesados por el inferior.`;
      lectura.set([
        ['transacciones del periodo', VIZ.entero(barras[0].n)],
        ['celdas del informe gerencial', VIZ.entero(barras[1].n)],
        ['filas del modelo de decisión', VIZ.entero(barras[2].n)],
        ['indicadores ejecutivos', VIZ.entero(barras[3].n)],
        ['compresión TPS → ESS', `${VIZ.fmt(barras[0].n / barras[3].n, 3)} a 1`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const hit = (x, y) => barras.find((b) => b.caja && x >= b.caja.x && x <= b.caja.x + b.caja.w && y >= b.caja.y - 20 && y <= b.caja.y + b.caja.h);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = hit(x, y);
      if (!b) return tip.ocultar();
      tip.mostrar(x, y, `<b>${b.k}</b>: ${VIZ.entero(b.n)}<br>${b.unidad}<br>horizonte: ${SIS[b.k].horizonte}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), b = hit(x, y); sel = b ? b.k : null; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 3: el plano de las decisiones ---------- */

  const DECISIONES = [
    ['Cobrar una venta', 0.97, 0.05], ['Aprobar un reembolso dentro de la política', 0.88, 0.14], ['Reponer cuando el stock baja del mínimo', 0.84, 0.25],
    ['Informe semanal de ventas por tienda', 0.76, 0.38], ['Detectar gastos que superan el presupuesto', 0.68, 0.46], ['Elegir la mezcla de productos a producir', 0.45, 0.5],
    ['Fijar precios según escenarios de demanda', 0.5, 0.6], ['Simular el cierre de una sucursal', 0.36, 0.62], ['Responder a un nuevo competidor', 0.2, 0.78],
    ['Entrar a un nuevo país', 0.1, 0.95], ['Fusionarse con otra empresa', 0.07, 0.86], ['Reorganizar la estructura de la empresa', 0.2, 0.92],
  ];
  const masCercano = (e, a) => CLAVES.map((k) => [k, Math.hypot(e - SIS[k].estructura, a - SIS[k].alcance)]).sort((p, q) => p[1] - q[1]);

  function montarPlano(cuerpo) {
    let e = 0.5, a = 0.5, pl = null, sel = -1;
    const ctl = VIZ.controles(cuerpo);
    const rE = ctl.rango({ etiqueta: 'Estructura de la decisión', min: 0, max: 100, valor: 50, formato: (v) => (v >= 75 ? 'muy estructurada' : v >= 40 ? 'semiestructurada' : 'no estructurada'), alCambiar: (v) => { e = v / 100; sel = -1; dibujar(); } });
    const rA = ctl.rango({ etiqueta: 'Alcance de la decisión', min: 0, max: 100, valor: 50, formato: (v) => (v >= 75 ? 'estratégico' : v >= 30 ? 'gerencial' : 'operativo'), alCambiar: (v) => { a = v / 100; sel = -1; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...CLAVES.slice().reverse().map((k) => ({ color: SIS[k].col, texto: `zona de ${SIS[k].sigla}` })), { color: C.tinta, texto: 'su decisión (arrastrable)' }, { color: C.apagado, texto: 'decisiones de ejemplo (marca = sistema que la apoya)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre en el plano para ubicar una decisión propia, o use los dos deslizadores; la zona de color indica qué tipo de sistema la apoya mejor. Haga clic sobre un círculo de ejemplo para leerlo.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, { etiquetaX: 'decisión estructurada →', etiquetaY: 'alcance: operativo → estratégico', formatoX: (v) => `${Math.round(v * 100)}`, formatoY: (v) => `${Math.round(v * 100)}`, ticksX: [0, 0.25, 0.5, 0.75, 1], ticksY: [0, 0.25, 0.5, 0.75, 1] });
      const celdas = 36;
      for (let i = 0; i < celdas; i++) for (let j = 0; j < celdas; j++) {
        const k = masCercano((i + 0.5) / celdas, (j + 0.5) / celdas)[0][0];
        ctx.fillStyle = VIZ.alfa(SIS[k].col, 0.18);
        const x = pl.sx(i / celdas), y = pl.sy((j + 1) / celdas);
        ctx.fillRect(x, y, pl.sx((i + 1) / celdas) - x + 0.5, pl.sy(j / celdas) - y + 0.5);
      }
      pl.ejes();
      CLAVES.forEach((k) => {
        const x = pl.sx(SIS[k].estructura), y = pl.sy(SIS[k].alcance);
        ctx.font = VIZ.fuente(12, 700); ctx.fillStyle = SIS[k].col; ctx.textAlign = 'center'; ctx.fillText(SIS[k].sigla, x, y + 4);
      });
      DECISIONES.forEach((d, i) => {
        const k = masCercano(d[1], d[2])[0][0];
        VIZ.marcador(ctx, pl.sx(d[1]), pl.sy(d[2]), SIS[k].col, i === sel ? 7 : 5);
        if (i === sel) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.sx(d[1]), pl.sy(d[2]), 10, 0, 2 * Math.PI); ctx.stroke(); }
      });
      VIZ.marcador(ctx, pl.sx(e), pl.sy(a), C.tinta, 7, 3);
      const pt = sel >= 0 ? [DECISIONES[sel][1], DECISIONES[sel][2]] : [e, a], cer = masCercano(pt[0], pt[1]), s = SIS[cer[0][0]];
      lectura.set([
        ['sistema que la apoya', `${s.sigla} · ${s.nombre}`], ['nivel', s.nivel], ['tipo de decisión', s.decision], ['horizonte', s.horizonte], ['segunda opción', `${cer[1][0]} (a ${VIZ.fmt(cer[1][1] - cer[0][1], 2)} más)`],
      ]);
      registro.textContent = sel >= 0 ? `«${DECISIONES[sel][0]}»: estructura ${Math.round(pt[0] * 100)}, alcance ${Math.round(pt[1] * 100)}. La apoya un ${s.sigla}: ${s.entradas} → ${s.salidas}.`
        : `Su decisión (estructura ${Math.round(e * 100)}, alcance ${Math.round(a * 100)}) cae en la zona de ${s.sigla}. A medida que sube el alcance la decisión pierde estructura y el apoyo pasa de registrar a explorar.`;
    }
    lienzo.alDibujar = dibujar;
    let arr = false;
    const poner = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      e = Math.max(0, Math.min(1, pl.ix(x))); a = Math.max(0, Math.min(1, pl.iy(y)));
      rE.valor = Math.round(e * 100); rA.valor = Math.round(a * 100); rE.refrescar(); rA.refrescar();
    };
    const cercano = (x, y) => DECISIONES.findIndex((d) => Math.hypot(pl.sx(d[1]) - x, pl.sy(d[2]) - y) < 10);
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      const i = cercano(x, y);
      if (i >= 0) { sel = i; return dibujar(); }
      sel = -1; arr = true; lienzo.canvas.setPointerCapture(ev.pointerId); poner(ev); dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arr) { poner(ev); dibujar(); }
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = cercano(x, y);
      if (i >= 0) tip.mostrar(x, y, `<b>${DECISIONES[i][0]}</b><br>apoya: ${masCercano(DECISIONES[i][1], DECISIONES[i][2])[0][0]}`);
      else tip.mostrar(x, y, `estructura <b>${Math.round(pl.ix(x) * 100)}</b>, alcance <b>${Math.round(pl.iy(y) * 100)}</b><br>zona de ${masCercano(pl.ix(x), pl.iy(y))[0][0]}`);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arr = false; });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('organizational-levels-is', {
    intro: String.raw`
      <p>Una organización toma decisiones en tres niveles: el <strong>operativo</strong> (qué pasa hoy en caja y bodega), el
      <strong>gerencial</strong> (cómo vamos frente a lo planificado) y el <strong>estratégico</strong> (hacia dónde va la empresa).
      Cada nivel necesita sistemas distintos: de <em>procesamiento de transacciones</em> (TPS), de <em>información gerencial</em> (MIS), de
      <em>apoyo a decisiones</em> (DSS) y de <em>apoyo a ejecutivos</em> (ESS).</p>
      <p>Lo que cambia al subir no es solo la pantalla: los datos se resumen, el horizonte se alarga y las decisiones dejan de tener una regla
      escrita. Las tres figuras muestran esa pirámide desde la clasificación, desde el volumen de datos y desde el tipo de decisión.</p>`,
    visualizaciones: [
      {
        titulo: 'La pirámide de sistemas',
        descripcion: 'Lea cada situación y haga clic en el peldaño que corresponde; la lectura muestra entradas, procesamiento y salidas del sistema que toque. Pruebe equivocarse a propósito para ver la explicación.',
        montar: montarPiramide,
      },
      {
        titulo: 'Cuántos datos mira cada nivel',
        descripcion: 'Con los mismos datos simulados, cuente qué maneja cada sistema. Aumente las ventas por mes: el TPS crece en proporción, el tablero ejecutivo casi no cambia.',
        montar: montarVolumen,
      },
      {
        titulo: 'El plano de las decisiones',
        descripcion: 'Ubique una decisión según su grado de estructura y su alcance, y vea qué sistema la apoya. Arrastre desde «cobrar una venta» hasta «entrar a un nuevo país» y observe cómo cambia la zona.',
        montar: montarPlano,
      },
    ],
    teoria: String.raw`
      <h2>Niveles y tipos de sistemas</h2>
      <table>
        <tr><th>Sistema</th><th>Nivel</th><th>Entradas</th><th>Salidas</th><th>Decisión</th></tr>
        <tr><td>TPS</td><td>Operativo</td><td>transacciones</td><td>registros y documentos</td><td>estructurada</td></tr>
        <tr><td>MIS</td><td>Gerencial</td><td>datos resumidos de los TPS</td><td>informes periódicos y de excepción</td><td>estructurada / semiestructurada</td></tr>
        <tr><td>DSS</td><td>Gerencial</td><td>datos y modelos</td><td>escenarios y proyecciones</td><td>semiestructurada</td></tr>
        <tr><td>ESS</td><td>Estratégico</td><td>datos agregados y externos</td><td>indicadores y tendencias</td><td>no estructurada</td></tr>
      </table>
      <h2>Tipo de decisión</h2>
      <p>Simon distingue decisiones <em>estructuradas</em> (rutinarias, con un procedimiento definido), <em>semiestructuradas</em> (parte del
      procedimiento es conocido, parte exige juicio) y <em>no estructuradas</em> (novedosas, sin regla). Cuanto menos estructurada es la decisión, menos
      sirve un sistema que solo registre y más importan la exploración, el contexto externo y las preguntas abiertas.</p>
      <h2>Agregación hacia arriba</h2>
      <p>Cada nivel consume lo que produjo el inferior. Si hay \(n\) transacciones y las agrupa por \(g\) combinaciones de dimensiones (mes, región, producto),
      el informe gerencial contiene a lo más \(g\) filas, con \(g \le n\) y habitualmente \(g \ll n\). La razón de compresión \(n/g\) crece con el volumen:
      el tablero del directorio, con unas pocas decenas de indicadores, resume millones de registros.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Una cadena con 3 regiones y 3 familias de producto registra 20 ventas diarias por familia y región. En 12 meses el TPS guarda \(12 \cdot 30 \cdot 9 \cdot 20 = 64\,800\) registros.
      El informe mensual por región y producto tiene \(12 \cdot 3 \cdot 3 = 108\) celdas, la tabla trimestral por región \(4 \cdot 3 = 12\) filas y el tablero
      ejecutivo, digamos 4 indicadores. La compresión TPS → ESS es de \(64\,800/4 = 16\,200\) a 1, pero cada paso responde una pregunta distinta:
      qué se vendió, cómo vamos, qué pasaría si cambia el precio y hacia dónde conviene ir.</p>
      <div class="recuadro">Un sistema de nivel superior es tan bueno como los datos que le entregan los de nivel inferior: un TPS con errores contamina todo el tablero.</div>
      <h2>Sistemas operacionales y gerenciales</h2>
      <p>Los sistemas <em>operacionales</em> (TPS, aplicaciones de bodega, caja) ejecutan el negocio día a día; los <em>gerenciales</em> (MIS, DSS, ESS) ayudan a dirigirlo.
      Hoy las plataformas empresariales como <a href="tema.html?id=erp-modules">ERP</a> integran ambos grupos, y el tablero se alimenta de un
      <a href="tema.html?id=data-warehouse-marts">almacén de datos</a>.</p>
      <h2>Conexiones</h2>
      <p>Para la distinción entre dato, información y conocimiento vea <a href="tema.html?id=data-information-knowledge">Data, Information and Knowledge</a>; para la estrategia que los
      sistemas apoyan, <a href="tema.html?id=strategic-alignment">Strategic Alignment of IT</a>; y para los paneles de gestión,
      <a href="tema.html?id=bi-dss">Business Intelligence and Decision Support Systems</a>.</p>`,
  });
})();
