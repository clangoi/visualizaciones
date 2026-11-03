(function () {
  'use strict';
  const { color: C } = VIZ;
  const SI = VIZ.si;
  const REG_COL = { Norte: C.s1, Centro: C.s2, Sur: C.s3 };
  const mon = (v) => '$' + VIZ.entero(v);
  const pct = (v) => VIZ.fmt(v * 100, 3) + ' %';

  // Zonas sensibles al cursor: cada figura las vuelve a llenar al dibujar.
  function activarTooltip(lienzo, tip, obtener) {
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const z = obtener().find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (z) tip.mostrar(x, y, z.html); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
  }

  /* ---------- Fig. 1: de la fila al conocimiento ---------- */

  function montarPiramide(cuerpo) {
    let semilla = 1, N = 6, gMin = 5, pMin = 8, etapa = 0, filas = [], celdas = [], mensual = {}, zonas = [];

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Periodo analizado', min: 3, max: 12, valor: N, formato: (v) => `últimos ${v} meses`, alCambiar: (v) => { N = v; calcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Regla: crecimiento mínimo', min: -10, max: 25, valor: gMin, formato: (v) => `${v} %`, alCambiar: (v) => { gMin = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Regla: participación mínima', min: 0, max: 20, valor: pMin, formato: (v) => `${v} %`, alCambiar: (v) => { pMin = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5, velMax: 3 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para subir un peldaño de la pirámide: dato, información, contexto, conocimiento. En el último, mueva las dos reglas y vea cuántas combinaciones región × producto las cumplen. Pase el cursor sobre las marcas para ver sus valores.');

    function iniciar() {
      filas = SI.ventas(semilla * 17 + 3, 24, 14);
      etapa = 0;
      calcular();
      return (function* () { etapa = 1; yield; etapa = 2; yield; etapa = 3; yield; })();
    }

    function calcular() {
      const act = filas.filter((r) => r.mes >= 24 - N), prev = filas.filter((r) => r.mes >= 12 - N && r.mes < 12);
      const totA = act.reduce((s, r) => s + r.ingreso, 0);
      celdas = [];
      for (const region of SI.REGIONES) for (const producto of SI.PRODUCTOS) {
        const a = act.filter((r) => r.region === region && r.producto === producto).reduce((s, r) => s + r.ingreso, 0);
        const p = prev.filter((r) => r.region === region && r.producto === producto).reduce((s, r) => s + r.ingreso, 0);
        celdas.push({ region, producto, ingreso: a, previo: p, crec: p ? a / p - 1 : 0, part: a / totA });
      }
      mensual = {};
      for (const region of SI.REGIONES) mensual[region] = Array.from({ length: 24 }, (_, m) => filas.filter((r) => r.mes === m && r.region === region).reduce((s, r) => s + r.ingreso, 0));
    }

    const cumple = (c) => c.crec * 100 >= gMin && c.part * 100 >= pMin;

    function dibujar() {
      if (!filas.length) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      zonas = [];
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const titulo = ['Etapa 1 · Datos', 'Etapa 2 · Información', 'Etapa 3 · Información con contexto', 'Etapa 4 · Conocimiento'][etapa];
      ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
      ctx.fillText(titulo, 8, 16);
      ctx.textAlign = 'center';
      const act = filas.filter((r) => r.mes >= 24 - N), totA = act.reduce((s, r) => s + r.ingreso, 0);
      let cifras = 0;
      if (etapa === 0) {
        const ult = filas.filter((r) => r.mes === 23);
        cifras = ult.length;
        const izq = 8, paso = (W - 16) / ult.length, base = H - 28, tope = Math.max(...ult.map((r) => r.ingreso));
        ult.forEach((r, k) => {
          const h = (r.ingreso / tope) * (base - 50), x = izq + k * paso;
          ctx.fillStyle = C.inactivo; ctx.beginPath(); ctx.roundRect(x + 2, base - h, paso - 4, h, [4, 4, 0, 0]); ctx.fill();
          ctx.save(); ctx.translate(x + paso / 2, base - h - 6); ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'left'; ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(VIZ.entero(r.ingreso), 0, 3); ctx.restore();
          zonas.push({ x: x, y: base - h, w: paso, h: h, html: `registro <b>${k + 1}</b><br>valor <b>${mon(r.ingreso)}</b><br><span>sin región, producto ni periodo de comparación</span>` });
        });
        ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - izq, base + 0.5); ctx.stroke();
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
        ctx.fillText('las 14 ventas registradas en el último mes, una cifra cada una', W / 2, H - 8);
        leyenda.set([{ color: C.inactivo, texto: 'dato: valor de una transacción, sin contexto' }]);
        registro.textContent = `Datos: ${ult.length} registros del último mes. Cada uno es un número aislado; no responde ninguna pregunta (¿${mon(ult[0].ingreso)} es mucho o poco?).`;
      } else if (etapa === 1) {
        const regs = SI.REGIONES.map((r) => ({ r, v: act.filter((x) => x.region === r).reduce((s, x) => s + x.ingreso, 0), cu: act.filter((x) => x.region === r).reduce((s, x) => s + x.costo, 0) }));
        cifras = 3;
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: 3, ymin: 0, ymax: Math.max(...regs.map((q) => q.v)) * 1.15 }, { etiquetaY: `ingreso de los últimos ${N} meses ($)`, ticksX: [], formatoY: (v) => VIZ.entero(v), margen: { izq: 70, sup: 34 } });
        pl.ejes();
        regs.forEach((q, i) => {
          const x = pl.sx(i + 0.12), w = pl.sx(i + 0.88) - x, y = pl.sy(q.v);
          ctx.fillStyle = REG_COL[q.r]; ctx.beginPath(); ctx.roundRect(x, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.fillText(mon(q.v), x + w / 2, y - 8);
          ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.fillText(`${q.r} · ${pct(q.v / totA)}`, x + w / 2, pl.y0 + 16);
          zonas.push({ x, y, w, h: pl.y0 - y, html: `<b>${q.r}</b><br>ingreso <b>${mon(q.v)}</b><br>participación <b>${pct(q.v / totA)}</b><br>margen <b>${pct(1 - q.cu / q.v)}</b>` });
        });
        leyenda.set(SI.REGIONES.map((r) => ({ color: REG_COL[r], texto: r })));
        const mejor = regs.slice().sort((a, b) => b.v - a.v)[0];
        registro.textContent = `Información: al agrupar ${act.length} registros por región y sumar, aparece una respuesta: ${mejor.r} lidera con ${mon(mejor.v)} (${pct(mejor.v / totA)} del total). Todavía no sabemos si eso es bueno.`;
      } else if (etapa === 2) {
        cifras = 3 * 24;
        const maxv = Math.max(...SI.REGIONES.flatMap((r) => mensual[r]));
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: 23, ymin: 0, ymax: maxv * 1.12 }, { etiquetaX: 'mes', etiquetaY: 'ingreso mensual ($)', formatoY: (v) => VIZ.entero(v), formatoX: (v) => String(v + 1), margen: { izq: 70, sup: 34 } });
        ctx.fillStyle = VIZ.alfa(C.s4, 0.18);
        ctx.fillRect(pl.sx(24 - N - 0.5), pl.y1, pl.sx(23.5) - pl.sx(24 - N - 0.5), pl.y0 - pl.y1);
        ctx.fillStyle = C.neutro;
        ctx.fillRect(pl.sx(12 - N - 0.5), pl.y1, pl.sx(11.5) - pl.sx(12 - N - 0.5), pl.y0 - pl.y1);
        pl.ejes();
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center';
        ctx.fillText('mismo periodo, año anterior', (pl.sx(12 - N - 0.5) + pl.sx(11.5)) / 2, pl.y1 - 4);
        ctx.fillText('periodo analizado', (pl.sx(24 - N - 0.5) + pl.sx(23.5)) / 2, pl.y1 - 4);
        SI.REGIONES.forEach((r) => VIZ.trazar(ctx, pl, mensual[r].map((v, m) => [m, v]), REG_COL[r], 2));
        for (let m = 0; m < 24; m++) zonas.push({ x: pl.sx(m - 0.5), y: pl.y1, w: pl.sx(1) - pl.sx(0), h: pl.y0 - pl.y1, html: `mes <b>${m + 1}</b> (${2023 + Math.floor(m / 12)})` + SI.REGIONES.map((r) => VIZ.filaTooltip(REG_COL[r], r, mon(mensual[r][m]))).join('') });
        leyenda.set([...SI.REGIONES.map((r) => ({ color: REG_COL[r], texto: r, forma: 'linea' })), { color: VIZ.alfa(C.s4, 0.5), texto: 'periodo analizado' }, { color: C.neutro, borde: C.eje, texto: 'mismo periodo del año anterior' }]);
        const tot = (r, desde, hasta) => mensual[r].slice(desde, hasta).reduce((s, v) => s + v, 0);
        const cr = SI.REGIONES.map((r) => `${r} ${pct(tot(r, 24 - N, 24) / tot(r, 12 - N, 12) - 1)}`).join(', ');
        registro.textContent = `Contexto: comparar con el mismo periodo del año anterior vuelve comparable la cifra. Crecimiento interanual: ${cr}.`;
      } else {
        cifras = 9;
        const xs = celdas.map((c) => c.part * 100), ys = celdas.map((c) => c.crec * 100);
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(25, Math.ceil(Math.max(...xs) + 2)), ymin: Math.min(-15, Math.floor(Math.min(...ys) - 3)), ymax: Math.max(30, Math.ceil(Math.max(...ys) + 3)) },
          { etiquetaX: 'participación en el ingreso (%)', etiquetaY: 'crecimiento interanual (%)', margen: { sup: 34 } });
        pl.ejes();
        ctx.fillStyle = VIZ.alfa(C.s6, 0.1);
        const qx = pl.sx(pMin), qy = pl.sy(gMin);
        ctx.fillRect(qx, pl.y1, pl.x1 - qx, qy - pl.y1);
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(qx, pl.y1); ctx.lineTo(qx, pl.y0); ctx.moveTo(pl.x0, qy); ctx.lineTo(pl.x1, qy); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.s6; ctx.textAlign = 'right'; ctx.fillText('zona de la regla: reforzar inventario', pl.x1 - 6, pl.y1 + 12);
        celdas.forEach((c) => {
          const x = pl.sx(c.part * 100), y = pl.sy(c.crec * 100), ok = cumple(c);
          if (ok) { ctx.strokeStyle = C.s6; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 11, 0, 2 * Math.PI); ctx.stroke(); }
          VIZ.marcador(ctx, x, y, REG_COL[c.region], 6, SI.PRODUCTOS.indexOf(c.producto));
          zonas.push({ x: x - 12, y: y - 12, w: 24, h: 24, html: `<b>${c.region} · ${c.producto}</b><br>participación <b>${pct(c.part)}</b><br>crecimiento <b>${pct(c.crec)}</b><br>${ok ? 'cumple la regla: reforzar' : 'no cumple la regla'}` });
        });
        leyenda.set([...SI.REGIONES.map((r) => ({ color: REG_COL[r], texto: r })), { color: C.s6, texto: 'cumple la regla', forma: 'linea' }, { color: C.apagado, texto: 'forma = producto (círculo, cuadrado, triángulo: ' + SI.PRODUCTOS.join(', ') + ')', forma: 'linea' }]);
        const k = celdas.filter(cumple).length;
        registro.textContent = `Conocimiento: «si el crecimiento es ≥ ${gMin} % y la participación ≥ ${pMin} %, reforzar el inventario». Con los datos actuales la regla señala ${k} de 9 combinaciones y convierte la información en una acción.`;
      }
      lectura.set([
        ['registros en la base', VIZ.entero(filas.length)],
        ['cifras que ve el lector', String(cifras)],
        ['periodo', `${N} meses`],
        ['regla', `crec ≥ ${gMin} % y part ≥ ${pMin} %`],
        ['combinaciones que la cumplen', `${celdas.filter(cumple).length} de 9`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    activarTooltip(lienzo, tip, () => zonas);
    rep.reiniciar();
  }

  /* ---------- Fig. 2: decidir con y sin contexto ---------- */

  const NIVELES = [
    ['0', 'Dato aislado: comparar con el promedio del periodo'],
    ['1', 'Información: comparar con el mes anterior'],
    ['2', 'Contexto: comparar con el mismo mes del año anterior'],
    ['3', 'Conocimiento: comparar con lo esperado por tendencia y estación'],
  ];

  // Mínimos cuadrados para y ≈ b0 + b1 t + b2 sen + b3 cos (resuelve las ecuaciones normales).
  function ajustar(y) {
    const X = y.map((_, t) => [1, t, Math.sin((2 * Math.PI * t) / 12), Math.cos((2 * Math.PI * t) / 12)]);
    const A = Array.from({ length: 4 }, (_, i) => Array.from({ length: 5 }, (_, j) => j < 4 ? X.reduce((s, r) => s + r[i] * r[j], 0) : X.reduce((s, r, k) => s + r[i] * y[k], 0)));
    for (let i = 0; i < 4; i++) {
      let p = i; for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]];
      for (let r = 0; r < 4; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 5; c++) A[r][c] -= f * A[i][c]; }
    }
    const b = A.map((fila, i) => fila[4] / fila[i]);
    return X.map((r) => r.reduce((s, v, i) => s + v * b[i], 0));
  }

  function montarContexto(cuerpo) {
    const N = 36;
    let semilla = 1, nivel = 3, umbral = 10, ruido = 4, sel = -1, y = [], real = [], ref = [[], [], [], []], pl = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Información disponible', opciones: NIVELES, valor: String(nivel), alCambiar: (v) => { nivel = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Alertar si cae más de', min: 3, max: 25, valor: umbral, formato: (v) => `${v} %`, alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido de las ventas', min: 1, max: 12, valor: ruido, formato: (v) => `±${v}`, alCambiar: (v) => { ruido = v; generar(); dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; sel = -1; generar(); dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.48, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'ventas mensuales', forma: 'linea' },
      { color: C.apagado, texto: 'referencia del nivel elegido', forma: 'linea' },
      { color: C.s6, texto: 'alerta sobre una caída real' },
      { color: C.s8, texto: 'falsa alarma' },
      { color: C.superficie, borde: C.s8, texto: 'caída real sin alerta' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un mes para ver qué concluye quien solo tiene ese dato y qué concluye con cada nivel de información. Las 4 caídas reales (−22 unidades) se inyectaron al azar; cambie el nivel y cuente aciertos, falsas alarmas y omisiones.');

    function generar() {
      const rn = VIZ.semilla(semilla * 13 + 5);
      const base = Array.from({ length: N }, (_, t) => 100 + 1.2 * t + 15 * Math.sin((2 * Math.PI * t) / 12) + ruido * VIZ.normal(rn));
      const rnd = VIZ.semilla(semilla * 101 + 7);
      real = Array(N).fill(false);
      while (real.filter(Boolean).length < 4) { const m = 3 + Math.floor(rnd() * (N - 3)); if (!real[m] && !real[m - 1] && !real[m + 1]) real[m] = true; }
      y = base.map((v, t) => v - (real[t] ? 22 : 0));
      const prom = y.reduce((s, v) => s + v, 0) / N;
      ref = [y.map(() => prom), y.map((_, t) => (t >= 1 ? y[t - 1] : null)), y.map((_, t) => (t >= 12 ? y[t - 12] : null)), ajustar(y)];
    }
    const alerta = (k, t) => ref[k][t] != null && y[t] < ref[k][t] * (1 - umbral / 100);
    function medidas(k) {
      let tp = 0, fp = 0, fn = 0, tn = 0;
      for (let t = 0; t < N; t++) { const a = alerta(k, t); if (a && real[t]) tp++; else if (a) fp++; else if (real[t]) fn++; else tn++; }
      return { tp, fp, fn, tn, exact: (tp + tn) / N };
    }

    function dibujar() {
      if (!y.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: N - 1, ymin: Math.floor(Math.min(...y) / 10 - 0.5) * 10, ymax: Math.ceil(Math.max(...y) / 10 + 0.3) * 10 }, { etiquetaX: 'mes', etiquetaY: 'ventas (miles de $)', formatoX: (v) => String(v + 1) });
      pl.ejes();
      VIZ.trazar(ctx, pl, ref[nivel].map((v, t) => [t, v == null ? NaN : v]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, y.map((v, t) => [t, v]), C.tinta, 2);
      for (let t = 0; t < N; t++) {
        const x = pl.sx(t), yy = pl.sy(y[t]), a = alerta(nivel, t);
        if (a) VIZ.marcador(ctx, x, yy, real[t] ? C.s6 : C.s8, 5.5, 3);
        else if (real[t]) { ctx.strokeStyle = C.s8; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, yy, 6, 0, 2 * Math.PI); ctx.stroke(); }
        else VIZ.marcador(ctx, x, yy, C.tinta, 2.5);
      }
      if (sel >= 0) { ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.sx(sel), pl.sy(y[sel]), 10, 0, 2 * Math.PI); ctx.stroke(); }
      const m = medidas(nivel), m0 = medidas(0), m3 = medidas(3);
      lectura.set([
        ['alertas emitidas', String(m.tp + m.fp)],
        ['falsas alarmas', String(m.fp)],
        ['caídas no detectadas', `${m.fn} de ${m.tp + m.fn}`],
        ['exactitud de este nivel', pct(m.exact)],
        ['exactitud sin contexto', pct(m0.exact)],
        ['exactitud con modelo', pct(m3.exact)],
      ]);
      if (sel < 0) registro.textContent = `Nivel ${nivel}: ${NIVELES[nivel][1].toLowerCase()}. Hay ${m.tp + m.fn} caídas reales en ${N} meses; este nivel acierta ${m.tp}, da ${m.fp} falsas alarmas y se le escapan ${m.fn}.`;
      else {
        const lineas = [0, 1, 2, 3].map((k) => ref[k][sel] == null ? `nivel ${k}: sin referencia` : `nivel ${k}: ${alerta(k, sel) ? 'ALERTA' : 'normal'} (ref. ${VIZ.fmt(ref[k][sel], 4)})`);
        registro.textContent = `Mes ${sel + 1}: ventas ${VIZ.fmt(y[sel], 4)}. Realidad: ${real[sel] ? 'caída inyectada' : 'sin caída'}. ${lineas.join(' · ')}.`;
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: py } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, py)) return tip.ocultar();
      const t = Math.max(0, Math.min(N - 1, Math.round(pl.ix(x))));
      tip.mostrar(x, py, `mes <b>${t + 1}</b><br>ventas <b>${VIZ.fmt(y[t], 4)}</b>` + [0, 1, 2, 3].map((k) => VIZ.filaTooltip(alerta(k, t) ? C.s8 : C.inactivo, `nivel ${k}`, ref[k][t] == null ? 'sin referencia' : (alerta(k, t) ? 'alerta' : 'normal'))).join('') + `<br>${real[t] ? 'caída real' : 'sin caída real'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x } = lienzo.posicion(ev);
      if (!pl) return;
      sel = Math.max(0, Math.min(N - 1, Math.round(pl.ix(x))));
      dibujar();
    });
    generar();
    dibujar();
  }

  VIZ.registrarTema('data-information-knowledge', {
    intro: String.raw`
      <p>Una base de datos de ventas contiene <strong>datos</strong>: cifras y textos sin interpretar, como «1.530, Norte, Software».
      Cuando alguien los organiza (suma por región, compara con el año pasado) obtiene <strong>información</strong>: algo que responde una
      pregunta. Cuando esa información se combina con experiencia y criterio para actuar («si una línea crece y pesa lo suficiente,
      refuerce su inventario»), se tiene <strong>conocimiento</strong>.</p>
      <p>Los sistemas de información existen para recorrer esa pirámide a escala: reciben millones de datos, producen informes y, bien
      diseñados, dejan reglas que las personas pueden usar. Cada peldaño agrega significado pero también supuestos, y por eso conviene ver
      qué se añade en cada uno.</p>`,
    visualizaciones: [
      {
        titulo: 'De la fila al conocimiento',
        descripcion: 'Avance con «Un paso»: primero ve 14 cifras sueltas, luego totales por región, después series con comparación interanual y por fin una regla de decisión. Mueva el periodo y los umbrales de la regla: cambia qué combinaciones región × producto se señalan.',
        montar: montarPiramide,
      },
      {
        titulo: 'Decidir con y sin contexto',
        descripcion: 'Una serie de ventas con 4 caídas reales ocultas. Cambie la información disponible (de un dato aislado a un modelo de tendencia y estación) y observe cómo bajan las falsas alarmas y las omisiones; suba el ruido y vea hasta dónde ayuda el contexto.',
        montar: montarContexto,
      },
    ],
    teoria: String.raw`
      <h2>La pirámide DIKW</h2>
      <p>La jerarquía <em>data → information → knowledge</em> (a veces con <em>wisdom</em> en la cima) describe cuánto significado tiene un
      contenido y cuánto cuesta producirlo:</p>
      <table>
        <tr><th>Nivel</th><th>Qué es</th><th>Ejemplo con ventas</th><th>Quién lo produce</th></tr>
        <tr><td>Dato</td><td>Registro de un hecho, sin interpretar</td><td>«1 530»</td><td>Un sistema transaccional</td></tr>
        <tr><td>Información</td><td>Dato agregado y con contexto, que responde una pregunta</td><td>«Norte vendió 4,2 millones, +6 % que el año pasado»</td><td>Una consulta, un informe, un panel</td></tr>
        <tr><td>Conocimiento</td><td>Regla o patrón que orienta una acción</td><td>«Si crece ≥ 5 % y pesa ≥ 8 %, reforzar stock»</td><td>Personas con experiencia, apoyadas por analítica</td></tr>
      </table>
      <h2>Qué agrega cada paso</h2>
      <p>Agregar es una función \(f\) que comprime \(n\) datos en unos pocos valores: la suma por región reduce cientos de filas a tres cifras,
      pero pierde detalle. El contexto es una <em>referencia</em> \(r\) contra la cual se mide la cifra \(x\): la variación interanual
      \(\Delta = x/r - 1\) solo tiene sentido porque \(r\) es el mismo periodo del año anterior, que descuenta la estacionalidad. El
      conocimiento fija una regla \(R(x, r)\) que se puede ejecutar sin reinterpretar los datos.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Suponga que una región vendió \(x = 1\,380\) en el trimestre y \(r = 1\,200\) en el mismo trimestre del año pasado, y que el total de la empresa es
      \(14\,000\). Entonces:</p>
      \[ \Delta = \frac{1\,380}{1\,200} - 1 = 15\,\%, \qquad \text{participación} = \frac{1\,380}{14\,000} \approx 9{,}9\,\%. \]
      <p>El dato «1 380» no dice nada; la información «+15 % y 9,9 % del total» sí; y la regla «crecimiento ≥ 5 % y participación ≥ 8 %»
      lleva a una acción: reforzar el inventario. Si la regla no se actualiza cuando cambia el mercado, el conocimiento se vuelve
      obsoleto.</p>
      <h2>Decidir con contexto</h2>
      <p>En la segunda figura cada nivel compara la cifra con una referencia distinta. Una alerta es un clasificador:
      \(\text{alerta} \iff x_t &lt; r_t\,(1-u)\), donde \(u\) es el umbral. La calidad se mide con aciertos, falsas alarmas y omisiones, y la
      <em>exactitud</em> es \((VP + VN)/n\). Con un promedio fijo, la tendencia y la estacionalidad producen falsas alarmas; con un modelo
      \(\hat y_t = \beta_0 + \beta_1 t + \beta_2 \sin(2\pi t/12) + \beta_3 \cos(2\pi t/12)\) la referencia sigue el patrón normal y las
      alertas se concentran en las caídas reales. Cuando el ruido es grande, ningún contexto basta: la información tiene límites.</p>
      <div class="recuadro">Más datos no son más información. Un panel con mil cifras sin referencia es solo un dato más grande.</div>
      <h2>Conexiones</h2>
      <p>La calidad de lo que se agrega condiciona el resultado: vea <a href="tema.html?id=information-quality">Information Quality</a>.
      Los sistemas que producen cada nivel se ordenan en <a href="tema.html?id=organizational-levels-is">Organizational Levels and System Types</a>,
      y las consultas que convierten datos en información están en <a href="tema.html?id=olap-queries">OLAP Queries</a>.</p>`,
  });
})();
