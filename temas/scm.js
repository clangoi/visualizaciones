(function () {
  'use strict';
  const { color: C } = VIZ;
  const SERIE = [C.tinta, C.s1, C.s2, C.s3, C.s4];
  const NOMBRES = ['Demanda del cliente', 'Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
  const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const desv = (a) => { const m = media(a); return Math.sqrt(media(a.map((x) => (x - m) ** 2))); };

  // Líneas con una guía vertical y un tooltip por semana; devuelve { dibujar, plano }.
  function lineasSemanales(cuerpo, opciones) {
    const lienzo = VIZ.lienzo(cuerpo, opciones.lienzo);
    const tip = VIZ.tooltip(lienzo);
    let pl = null, hover = -1;
    function dibujar() {
      const { series, xmax, etiquetaY } = opciones.datos();
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(1, ...series.flatMap((s) => s.y.filter(Number.isFinite))) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax }, { etiquetaX: 'semana', etiquetaY });
      pl.ejes();
      series.forEach((s) => VIZ.trazar(ctx, pl, s.y.map((v, i) => [i, v]), s.color, s.ancho || 2));
      if (hover >= 0) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); ctx.setLineDash([]);
        series.forEach((s) => { if (Number.isFinite(s.y[hover])) VIZ.marcador(ctx, pl.sx(hover), pl.sy(s.y[hover]), s.color, 3.5); });
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const { series } = opciones.datos();
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const n = Math.max(0, Math.min(series[0].y.length - 1, Math.round(pl.ix(x))));
      if (n !== hover) { hover = n; dibujar(); }
      tip.mostrar(x, y, `semana <b>${n}</b>` + series.filter((s) => Number.isFinite(s.y[n])).map((s) => VIZ.filaTooltip(s.color, s.nombre, VIZ.fmt(s.y[n], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    return { dibujar, lienzo };
  }

  /* ---------- Fig. 1: efecto látigo ---------- */

  // Cada etapa pronostica con un promedio móvil de p semanas y pide hasta cubrir (L + 1) semanas de ese pronóstico.
  // Sin información compartida, cada etapa ve los pedidos de la anterior; con ella, todas ven la demanda final y el plazo se suma.
  function latigo(semilla, etapas, L, p, compartir, sigma, semanas) {
    const rnd = VIZ.semilla(semilla * 977 + 11);
    const D = Array.from({ length: semanas }, () => Math.max(0, 20 + sigma * VIZ.normal(rnd)));
    const pedidos = [D];
    for (let k = 1; k <= etapas; k++) {
      const X = compartir ? D : pedidos[k - 1], plazo = compartir ? L * k : L, q = [];
      let Sprev = null;
      for (let t = 0; t < semanas; t++) {
        const ventana = X.slice(Math.max(0, t - p + 1), t + 1), S = (plazo + 1) * media(ventana);
        q.push(Math.max(0, X[t] + (Sprev === null ? 0 : S - Sprev)));
        Sprev = S;
      }
      pedidos.push(q);
    }
    return pedidos;
  }
  const razonVar = (L, p) => 1 + (2 * L) / p + (2 * L * L) / (p * p);

  function montarLatigo(cuerpo) {
    let semilla = 1, etapas = 4, L = 2, p = 6, sigma = 2, compartir = false, P = [], pl2 = null, hover2 = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Etapas de la cadena', min: 1, max: 4, valor: etapas, alCambiar: (v) => { etapas = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Plazo de entrega por etapa (semanas)', min: 1, max: 4, valor: L, alCambiar: (v) => { L = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Ventana del pronóstico (semanas)', min: 2, max: 12, valor: p, alCambiar: (v) => { p = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Variabilidad de la demanda (σ)', min: 0, max: 5, paso: 0.5, valor: sigma, alCambiar: (v) => { sigma = v; recalcular(); } });
    ctl.casilla({ etiqueta: 'Compartir la demanda final con toda la cadena', valor: compartir, alCambiar: (v) => { compartir = v; recalcular(); } });
    ctl.boton('Nueva demanda', () => { semilla++; recalcular(); }, { primario: true });
    const g1 = lineasSemanales(cuerpo, {
      lienzo: { proporcion: 0.5, altoMin: 250, altoMax: 360 },
      datos: () => ({ xmax: 59, etiquetaY: 'unidades pedidas por semana', series: P.map((y, k) => ({ y, color: SERIE[k], nombre: NOMBRES[k], ancho: k ? 2 : 1.5 })).reverse() }),
    });
    VIZ.subtitulo(cuerpo, 'Desviación estándar de los pedidos de cada etapa');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 170, altoMax: 240 });
    const tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, NOMBRES.map((n, k) => ({ color: SERIE[k], texto: n, forma: 'linea' })).concat([{ color: C.apagado, texto: 'cota teórica (promedio móvil)', forma: 'linea' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las líneas muestran lo que pide cada etapa a su proveedor. Alargue el plazo o acorte la ventana del pronóstico y la oscilación se amplifica aguas arriba; active «Compartir la demanda final» y baja. Pase el cursor sobre una semana o una barra para ver los valores.');

    let desvs = [], teoria = [];
    function recalcular() {
      P = latigo(semilla, etapas, L, p, compartir, sigma, 60);
      desvs = P.map(desv);
      teoria = P.map((_, k) => {
        if (k === 0) return desvs[0];
        const v = compartir ? razonVar(L * k, p) : Math.pow(razonVar(L, p), k);
        return desvs[0] * Math.sqrt(v);
      });
      g1.dibujar();
      dibujarBarras();
      const ult = etapas, amp = desvs[0] > 0 ? desvs[ult] / desvs[0] : NaN;
      registro.textContent = compartir
        ? `Todas las etapas ven la misma demanda final: la amplificación crece sólo por el plazo acumulado (${L * ult} semanas en la etapa ${ult}).`
        : `Cada etapa pronostica con los pedidos de la anterior, así que el error se compone: en la etapa ${ult} la variabilidad es ${VIZ.fmt(amp, 3)} veces la de la demanda.`;
      lectura.set([
        ['σ de la demanda final', VIZ.fmt(desvs[0], 3)], [`σ de los pedidos de ${NOMBRES[ult].toLowerCase()}`, VIZ.fmt(desvs[ult], 3)],
        ['amplificación medida', Number.isFinite(amp) ? VIZ.fmt(amp, 3) + '×' : '—'], ['cota teórica mínima', VIZ.fmt(Math.sqrt(compartir ? razonVar(L * ult, p) : Math.pow(razonVar(L, p), ult)), 3) + '×'],
      ]);
    }
    function dibujarBarras() {
      const { ctx } = l2;
      l2.limpiar();
      const n = desvs.length, ymax = Math.max(1, ...desvs, ...teoria) * 1.15;
      pl2 = VIZ.plano(l2, { xmin: -0.5, xmax: 4.5, ymin: 0, ymax }, { ticksX: [], etiquetaY: 'σ' });
      pl2.ejes();
      const w = (pl2.sx(1) - pl2.sx(0)) * 0.6;
      for (let k = 0; k < n; k++) {
        const x = pl2.sx(k), y = pl2.sy(desvs[k]);
        ctx.fillStyle = k === hover2 ? VIZ.alfa(SERIE[k], 0.75) : SERIE[k];
        ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, pl2.y0 - y, [4, 4, 0, 0]); ctx.fill();
        if (k > 0) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(x - w / 2 - 3, pl2.sy(teoria[k])); ctx.lineTo(x + w / 2 + 3, pl2.sy(teoria[k])); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(k ? 'Etapa ' + k : 'Cliente', x, pl2.y0 + 8);
      }
    }
    l2.alDibujar = () => P.length && dibujarBarras();
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      const k = Math.round(pl2 ? pl2.ix(x) : -1);
      if (!pl2 || !pl2.dentro(x, y) || k < 0 || k >= desvs.length) { if (hover2 >= 0) { hover2 = -1; dibujarBarras(); } return tip2.ocultar(); }
      if (k !== hover2) { hover2 = k; dibujarBarras(); }
      tip2.mostrar(x, y, `<b>${NOMBRES[k]}</b>` + `<div>σ medida <b>${VIZ.fmt(desvs[k], 3)}</b></div>` + (k ? `<div>cota teórica <b>${VIZ.fmt(teoria[k], 3)}</b></div><div>amplificación <b>${VIZ.fmt(desvs[k] / desvs[0], 3)}×</b></div>` : ''));
    });
    l2.canvas.addEventListener('pointerleave', () => { hover2 = -1; tip2.ocultar(); dibujarBarras(); });
    recalcular();
  }

  /* ---------- Fig. 2: inventario de seguridad ---------- */

  const cdf = (z) => { // Φ(z), aproximación de Abramowitz y Stegun.
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  };
  const zDe = (nivel) => { let lo = -1, hi = 5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (cdf(m) < nivel) lo = m; else hi = m; } return (lo + hi) / 2; };

  function simularInventario(semilla, mu, sigma, L, S, dias) {
    const rnd = VIZ.semilla(semilla * 313 + 5);
    let inv = S - mu * L;
    const pipe = Array(L).fill(mu), inv_h = [], faltas = [];
    let sin = 0, sumInv = 0, faltante = 0, demandaTot = 0;
    for (let t = 0; t < dias; t++) {
      inv += pipe.shift();
      const d = Math.max(0, mu + sigma * VIZ.normal(rnd));
      demandaTot += d;
      inv -= d;
      const falta = inv < 0;
      if (falta) { sin++; faltante += -inv; inv = 0; }
      faltas.push(falta); inv_h.push(inv); sumInv += inv;
      const q = Math.max(0, S - (inv + pipe.reduce((a, b) => a + b, 0)));
      pipe.push(q);
    }
    return { inv: inv_h, faltas, servicio: 1 - sin / dias, medio: sumInv / dias, llenado: 1 - faltante / demandaTot };
  }

  function montarSeguridad(cuerpo) {
    let semilla = 1, sigma = 20, L = 4, nivel = 95, hoverT = -1, hoverC = -1, plT = null, plC = null, R = null;
    const MU = 100, DIAS_VER = 100, DIAS = 600;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variabilidad diaria de la demanda (σ)', min: 5, max: 50, valor: sigma, alCambiar: (v) => { sigma = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Plazo de reposición (días)', min: 1, max: 10, valor: L, alCambiar: (v) => { L = v; dibujar(); } });
    const rNivel = ctl.rango({ etiqueta: 'Nivel de servicio objetivo', min: 50, max: 99.5, paso: 0.5, valor: nivel, formato: (v) => v + ' %', alCambiar: (v) => { nivel = v; dibujar(); } });
    ctl.boton('Nueva demanda', () => { semilla++; dibujar(); }, { primario: true });
    const lt = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 320 });
    const tipT = VIZ.tooltip(lt);
    VIZ.subtitulo(cuerpo, 'Inventario de seguridad necesario según el nivel de servicio');
    const lc = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 190, altoMax: 260 });
    const tipC = VIZ.tooltip(lc);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'inventario disponible al cierre del día', forma: 'linea' }, { color: C.s8, texto: 'día con faltante', forma: 'circulo' },
      { color: C.s3, texto: 'inventario de seguridad (curva)', forma: 'linea' }, { color: C.tinta, texto: 'valor elegido', forma: 'circulo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La demanda media es de 100 unidades por día y se repone hasta el nivel máximo cada día. Suba σ o el plazo y exija más servicio: el inventario de seguridad crece como la raíz del plazo. Pase el cursor sobre el gráfico de arriba para ver un día y sobre la curva para ver el costo de cada punto de servicio.');

    const seg = (n, s, l) => zDe(n / 100) * s * Math.sqrt(l + 1);
    function dibujar() {
      const z = zDe(nivel / 100), ss = z * sigma * Math.sqrt(L + 1), S = MU * (L + 1) + ss;
      R = simularInventario(semilla, MU, sigma, L, S, DIAS);
      {
        const { ctx } = lt;
        lt.limpiar();
        plT = VIZ.plano(lt, { xmin: 0, xmax: DIAS_VER, ymin: 0, ymax: Math.max(S, ...R.inv.slice(0, DIAS_VER)) * 1.1 }, { etiquetaX: 'día', etiquetaY: 'unidades en bodega' });
        plT.ejes();
        VIZ.trazar(ctx, plT, R.inv.slice(0, DIAS_VER).map((v, i) => [i + 1, v]), C.s1, 2);
        ctx.strokeStyle = C.s3; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(plT.x0, plT.sy(ss)); ctx.lineTo(plT.x1, plT.sy(ss)); ctx.stroke(); ctx.setLineDash([]);
        R.faltas.slice(0, DIAS_VER).forEach((f, i) => { if (f) VIZ.marcador(ctx, plT.sx(i + 1), plT.sy(0), C.s8, 4.5); });
        if (hoverT >= 1) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plT.sx(hoverT), plT.y1); ctx.lineTo(plT.sx(hoverT), plT.y0); ctx.stroke(); VIZ.marcador(ctx, plT.sx(hoverT), plT.sy(R.inv[hoverT - 1]), C.s1, 4); }
      }
      {
        const { ctx } = lc;
        lc.limpiar();
        const top = seg(99.5, sigma, L) * 1.05;
        plC = VIZ.plano(lc, { xmin: 50, xmax: 99.5, ymin: 0, ymax: Math.max(top, 1) }, { etiquetaX: 'nivel de servicio (%)', etiquetaY: 'inventario de seguridad' });
        plC.ejes();
        const pts = []; for (let n = 50; n <= 99.5; n += 0.5) pts.push([n, Math.max(0, seg(n, sigma, L))]);
        VIZ.trazar(ctx, plC, pts, C.s3, 2.5);
        if (hoverC > 0) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plC.sx(hoverC), plC.y1); ctx.lineTo(plC.sx(hoverC), plC.y0); ctx.stroke(); VIZ.marcador(ctx, plC.sx(hoverC), plC.sy(Math.max(0, seg(hoverC, sigma, L))), C.s3, 4); }
        VIZ.marcador(ctx, plC.sx(nivel), plC.sy(Math.max(0, ss)), C.tinta, 5);
      }
      registro.textContent = `Inventario de seguridad = z · σ · √(L + 1) = ${VIZ.fmt(z, 3)} · ${sigma} · √${L + 1} = ${VIZ.fmt(ss, 4)} unidades. Nivel máximo S = ${MU} · ${L + 1} + ${VIZ.fmt(ss, 4)} = ${VIZ.fmt(S, 4)}.`;
      lectura.set([
        ['z', VIZ.fmt(z, 3)], ['inventario de seguridad', VIZ.fmt(ss, 4) + ' u.'],
        ['servicio objetivo', nivel + ' %'], ['servicio observado (600 días)', VIZ.fmt(R.servicio * 100, 3) + ' %'],
        ['inventario medio', VIZ.fmt(R.medio, 4) + ' u.'], ['costo anual de mantenerlo ($10 por u.)', '$' + VIZ.entero(R.medio * 10)],
      ]);
    }
    lt.alDibujar = () => R && dibujar(); lc.alDibujar = () => R && dibujar();
    lt.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lt.posicion(ev);
      if (!plT || !plT.dentro(x, y)) { if (hoverT >= 0) { hoverT = -1; dibujar(); } return tipT.ocultar(); }
      const d = Math.max(1, Math.min(DIAS_VER, Math.round(plT.ix(x))));
      if (d !== hoverT) { hoverT = d; dibujar(); }
      tipT.mostrar(x, y, `día <b>${d}</b>` + VIZ.filaTooltip(C.s1, 'en bodega', VIZ.fmt(R.inv[d - 1], 4)) + (R.faltas[d - 1] ? VIZ.filaTooltip(C.s8, 'faltante', 'sí') : ''));
    });
    lt.canvas.addEventListener('pointerleave', () => { hoverT = -1; tipT.ocultar(); dibujar(); });
    lc.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lc.posicion(ev);
      if (!plC || !plC.dentro(x, y)) { if (hoverC > 0) { hoverC = -1; dibujar(); } return tipC.ocultar(); }
      const n = Math.round(plC.ix(x) * 2) / 2;
      if (n !== hoverC) { hoverC = n; dibujar(); }
      tipC.mostrar(x, y, `servicio <b>${n} %</b>` + VIZ.filaTooltip(C.s3, 'inventario de seguridad', VIZ.fmt(Math.max(0, seg(n, sigma, L)), 4)));
    });
    lc.canvas.addEventListener('click', (ev) => {
      const { x, y } = lc.posicion(ev);
      if (plC && plC.dentro(x, y)) { nivel = Math.max(50, Math.min(99.5, Math.round(plC.ix(x) * 2) / 2)); rNivel.valor = nivel; dibujar(); }
    });
    lc.canvas.style.cursor = 'pointer';
    lc.canvas.addEventListener('pointerleave', () => { hoverC = -1; tipC.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: flujos de materiales y de información ---------- */

  const ETAPAS = ['Fábrica', 'Distrib.', 'Mayorista', 'Minorista'];
  function montarFlujos(cuerpo) {
    let L = 2, compartir = false, salto = 16, sem = 0, E = [], hist = [], mensaje = '', costo = 0;
    const SEMANAS = 40;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Plazo de entrega (semanas)', min: 1, max: 3, valor: L, alCambiar: (v) => { L = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Demanda final tras el salto', min: 10, max: 24, valor: salto, alCambiar: (v) => { salto = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Compartir la demanda final con todas las etapas', valor: compartir, alCambiar: (v) => { compartir = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 200 });
    const tip = VIZ.tooltip(lienzo);
    const g = lineasSemanales(cuerpo, {
      lienzo: { proporcion: 0.4, altoMin: 220, altoMax: 300 },
      datos: () => ({ xmax: SEMANAS, etiquetaY: 'unidades pedidas por semana', series: [{ y: hist.map((h) => h.d), color: C.tinta, nombre: 'Demanda del cliente', ancho: 1.5 }].concat(ETAPAS.map((n, i) => ({ y: hist.map((h) => h.q[i]), color: SERIE[4 - i], nombre: n }))) }),
    });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'inventario' }, { color: C.s8, texto: 'pedidos pendientes de entregar' }, { color: C.s7, texto: 'pedido hacia el proveedor (información)', forma: 'linea' },
      { color: C.tinta, texto: 'demanda del cliente', forma: 'linea' },
    ].concat(ETAPAS.slice().reverse().map((n, i) => ({ color: SERIE[1 + i], texto: 'pedidos de ' + n.toLowerCase().replace('distrib.', 'distribuidor'), forma: 'linea' }))));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los envíos de material viajan de izquierda a derecha y los pedidos de información, de derecha a izquierda. Observe cómo un salto de la demanda en la semana 5 llega sin cambios al minorista pero se vuelve un pico mayor y más tardío en cada etapa hacia la fábrica. Pase el cursor sobre una etapa o sobre las líneas.');

    function iniciar() {
      const rnd = VIZ.semilla(7);
      sem = 0; costo = 0; hist = [];
      E = ETAPAS.map(() => ({ inv: 15, back: 0, f: 10, q: 10, env: 10, pipe: Array(L).fill(10) }));
      mensaje = 'Estado inicial: demanda estable de 10 unidades por semana; cada etapa tiene 15 unidades y pronostica con suavizado exponencial.';
      return (function* () {
        for (sem = 1; sem <= SEMANAS; sem++) {
          const d = (sem < 5 ? 10 : salto) + Math.round((rnd() - 0.5) * 2);
          let entrada = d;
          // Se procesa del minorista (índice 3) hacia la fábrica (índice 0).
          for (let k = 3; k >= 0; k--) {
            const e = E[k];
            e.inv += e.pipe.shift();
            const o = entrada;
            const env = Math.min(e.inv, o + e.back);
            e.inv -= env; e.back = Math.max(0, e.back + o - env);
            e.env = env;
            if (k < 3) E[k + 1].pipe.push(env); // material hacia abajo
            const senal = compartir ? d : o;
            e.f = 0.4 * senal + 0.6 * e.f;
            const posicion = e.inv - e.back + e.pipe.reduce((a, b) => a + b, 0);
            const objetivo = (L + 1) * e.f + 5;
            e.q = Math.max(0, Math.round(e.f + 0.5 * (objetivo - posicion)));
            if (k === 0) e.pipe.push(e.q); // la fábrica produce lo que decide
            entrada = e.q;
          }
          hist.push({ d, q: E.map((e) => e.q) });
          costo += E.reduce((s, e) => s + e.inv + 2 * e.back, 0);
          mensaje = `Semana ${sem}: el cliente pide ${d}. Pedidos hacia arriba: minorista ${E[3].q}, mayorista ${E[2].q}, distribuidor ${E[1].q}, fábrica ${E[0].q}.`;
          yield;
        }
      })();
    }
    // Los envíos del minorista salen al cliente: el material de la etapa k llega a la etapa k + 1 después de L semanas.
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const n = 5, gap = 10, nw = Math.min(88, (W - 8 - gap * (n - 1)) / n), x0 = (W - (nw * n + gap * (n - 1))) / 2, top = 8, nh = 150;
      geo = [];
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (nw + gap), cli = i === 4, e = cli ? null : E[i];
        geo.push({ x, y: top, w: nw, h: nh, i });
        ctx.fillStyle = C.superficie; ctx.strokeStyle = C.inactivo; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x, top, nw, nh, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(cli ? 'Cliente' : ETAPAS[i], x + nw / 2, top + 6, nw - 4);
        if (!e) { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.fillText('demanda', x + nw / 2, top + 50); ctx.font = VIZ.fuente(14, 700); ctx.fillStyle = C.tinta; ctx.fillText(String(hist.length ? hist[hist.length - 1].d : 10), x + nw / 2, top + 66); continue; }
        // Barras de inventario y pendientes.
        const base = top + 92, escala = 0.75, bw = (nw - 20) / 2;
        const hi = Math.min(60, e.inv * escala), hb = Math.min(60, e.back * escala);
        ctx.fillStyle = C.s6; ctx.beginPath(); ctx.roundRect(x + 8, base - hi, bw, hi, [3, 3, 0, 0]); ctx.fill();
        ctx.fillStyle = C.s8; ctx.beginPath(); ctx.roundRect(x + 12 + bw, base - hb, bw, hb, [3, 3, 0, 0]); ctx.fill();
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, base + 0.5); ctx.lineTo(x + nw - 6, base + 0.5); ctx.stroke();
        ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = C.s6; ctx.fillText('inv ' + e.inv, x + 6, base + 6);
        ctx.fillStyle = C.s8; ctx.fillText('atr ' + e.back, x + 6, base + 19);
        ctx.fillStyle = C.s7; ctx.fillText('ped ' + e.q, x + 6, base + 32);
        ctx.fillStyle = C.tinta2; ctx.fillText('env ' + e.env, x + 6, base + 45);
      }
      // Flechas entre cajas: material hacia la derecha, información hacia la izquierda.
      for (let i = 0; i < n - 1; i++) {
        const xa = x0 + i * (nw + gap) + nw, xb = xa + gap, y1 = top + 34, y2 = top + 44;
        ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(xa, y1); ctx.lineTo(xb - 2, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xb, y1); ctx.lineTo(xb - 5, y1 - 3); ctx.lineTo(xb - 5, y1 + 3); ctx.fill();
        ctx.strokeStyle = C.s7; ctx.fillStyle = C.s7; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(xb, y2); ctx.lineTo(xa + 2, y2); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(xa, y2); ctx.lineTo(xa + 5, y2 - 3); ctx.lineTo(xa + 5, y2 + 3); ctx.fill();
      }
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`semana ${sem} de ${SEMANAS} · plazo ${L} sem.`, x0, top + nh + 8);
      ctx.fillText(compartir ? 'todas ven la demanda final' : 'cada etapa ve sólo el pedido de la siguiente', x0, top + nh + 21);
      g.dibujar();
      registro.textContent = mensaje;
      const pico = (k) => (hist.length ? Math.max(...hist.map((h) => h.q[k])) : 10);
      lectura.set([
        ['semana', `${sem} / ${SEMANAS}`], ['pico de pedidos del minorista', String(pico(3))], ['pico de pedidos de la fábrica', String(pico(0))],
        ['inventario total', String(E.reduce((s, e) => s + e.inv, 0))], ['pendientes totales', String(E.reduce((s, e) => s + e.back, 0))],
        ['costo acumulado (1 por inv., 2 por pend.)', VIZ.entero(costo)],
      ]);
    }
    lienzo.alDibujar = () => E.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = geo.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
      if (!c) return tip.ocultar();
      if (c.i === 4) return tip.mostrar(x, y, '<b>Cliente final</b><br>genera la demanda real');
      const e = E[c.i];
      tip.mostrar(x, y, `<b>${ETAPAS[c.i]}</b>` + VIZ.filaTooltip(C.s6, 'inventario', e.inv) + VIZ.filaTooltip(C.s8, 'pendientes', e.back) + VIZ.filaTooltip(C.s7, 'último pedido', e.q) + VIZ.filaTooltip(C.tinta2, 'último envío', e.env) + `<div>pronóstico <b>${VIZ.fmt(e.f, 3)}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('scm', {
    intro: String.raw`
      <p>La <strong>gestión de la cadena de suministro</strong> (<em>SCM</em>) coordina a proveedores, fábricas, centros de distribución y tiendas para que el producto correcto llegue
      en el momento correcto. En una cadena fluyen tres cosas: <strong>materiales</strong> hacia el cliente, <strong>información</strong> (pedidos, pronósticos, inventarios) hacia el proveedor y
      <strong>dinero</strong> en ambos sentidos.</p>
      <p>Su problema clásico es el <strong>efecto látigo</strong>: una variación pequeña en la demanda del cliente se convierte en oscilaciones cada vez mayores en los pedidos aguas arriba, porque cada
      etapa pronostica con lo que ve y protege su inventario. Lo que lo reduce no es más inventario en todas partes, sino mejor información, plazos más cortos y pronósticos estables.</p>`,
    visualizaciones: [
      {
        titulo: 'El efecto látigo',
        descripcion: 'Con cuatro etapas, plazo de 2 semanas y ventana de 6, la desviación de los pedidos se multiplica varias veces. Alargue el plazo, acorte la ventana y vea cómo crece; luego active «Compartir la demanda final» y compare las barras con la cota teórica.',
        montar: montarLatigo,
      },
      {
        titulo: 'Inventario de seguridad y nivel de servicio',
        descripcion: 'Suba el nivel de servicio de 90 a 99,5 %: el inventario de seguridad crece cada vez más rápido. Pruebe también σ y el plazo, haga clic en la curva para fijar el nivel y observe en la simulación los días con faltante (rojo).',
        montar: montarSeguridad,
      },
      {
        titulo: 'Flujos de materiales e información',
        descripcion: 'Avance semana a semana mientras la demanda salta en la semana 5: el minorista pide, el mayorista reacciona, y así hasta la fábrica. Compare con y sin demanda compartida y con plazos de 1 y 3 semanas, mirando inventarios (azul) y pendientes (rojo).',
        montar: montarFlujos,
      },
    ],
    teoria: String.raw`
      <h2>Flujos de la cadena</h2>
      <p>Una cadena típica es: proveedor → fábrica → centro de distribución → tienda → cliente. Los <strong>materiales</strong> avanzan hacia el cliente con un retraso (plazo de entrega \(L\)); la
      <strong>información</strong> viaja en sentido contrario como pedidos. El sistema de gestión (<a href="tema.html?id=erp-modules">ERP</a> más herramientas de planificación) conecta ambos flujos.
      Cuando cada eslabón sólo ve el pedido del siguiente y no la demanda real, decide con información distorsionada.</p>
      <h2>Efecto látigo</h2>
      <p>Si cada etapa pronostica la demanda con un promedio móvil de \(p\) periodos y pide hasta cubrir \(L + 1\) periodos de ese pronóstico, sus pedidos son</p>
      \[ q_t = d_t + (L+1)\,(m_t - m_{t-1}), \qquad m_t = \frac{1}{p}\sum_{i=0}^{p-1} d_{t-i}. \]
      <p>Para una demanda independiente, la varianza de los pedidos respecto de la de la demanda cumple</p>
      \[ \frac{\operatorname{Var}(q)}{\operatorname{Var}(d)} \;\geq\; 1 + \frac{2L}{p} + \frac{2L^2}{p^2}. \]
      <p>Con \(L = 2\) y \(p = 6\) el factor es \(1 + 0{,}667 + 0{,}222 = 1{,}89\) (la desviación se multiplica por \(1{,}37\)) en una sola etapa. Si las etapas encadenan sus pronósticos, los factores se multiplican:
      con cuatro etapas, \(1{,}89^4 \approx 12{,}7\) en varianza, es decir, \(3{,}6\) veces en desviación. Si todos usan la demanda final y el plazo se acumula, la etapa \(k\) tiene el factor
      de \(L k\): en la cuarta, \(1 + 16/6 + 128/36 \approx 7{,}2\), o \(2{,}7\) veces en desviación. La información compartida baja la amplificación sin eliminarla. Son cotas inferiores: en la figura la amplificación medida suele superarlas, porque los pedidos de una etapa ya no son independientes y se redondean a cero cuando el pronóstico baja.</p>
      <h3>Qué lo reduce</h3>
      <ul>
        <li><strong>Compartir información</strong> de punto de venta con toda la cadena.</li>
        <li><strong>Acortar plazos</strong> (\(L\) pequeño) y suavizar los pedidos (\(p\) grande).</li>
        <li>Evitar descuentos por volumen que concentran compras y asignaciones por racionamiento.</li>
      </ul>
      <h2>Inventario de seguridad</h2>
      <p>Para absorber la variabilidad de la demanda durante el plazo de reposición, se mantiene un colchón. Si la demanda diaria es normal con media \(\mu\) y desviación \(\sigma\) y se revisa cada día,
      el inventario de seguridad para un nivel de servicio \(\alpha\) es</p>
      \[ SS = z_{\alpha}\,\sigma\sqrt{L+1}, \qquad z_{\alpha} = \Phi^{-1}(\alpha), \qquad S = \mu\,(L+1) + SS. \]
      <p><strong>Ejemplo resuelto.</strong> Con \(\mu = 100\), \(\sigma = 20\), \(L = 4\) y \(\alpha = 95\,\%\) (\(z = 1{,}645\)): \(SS = 1{,}645 \cdot 20 \cdot \sqrt{5} \approx 73{,}6\) unidades y
      \(S = 500 + 73{,}6 \approx 574\). Para \(99\,\%\) (\(z = 2{,}326\)) el colchón sube a \(104\) unidades: el último punto de servicio cuesta más que los primeros. Si el costo de mantener una unidad es de
      10 dólares al año, ese colchón de 74 unidades cuesta unos 740 dólares anuales.</p>
      <div class="recuadro"><p>El inventario de seguridad crece con \(\sqrt{L+1}\): acortar el plazo de 9 a 4 semanas lo reduce a un 70 %. Reducir plazos y compartir información son, en general, más baratos que acumular existencias.</p></div>
      <h2>Conexiones</h2>
      <p>La política de reposición se optimiza con <a href="tema.html?id=multiperiod-inventory">inventarios multiperiodo</a>. El SCM se apoya en el <a href="tema.html?id=erp-modules">ERP</a> y se mide con
      <a href="tema.html?id=kpi-fundamentals">indicadores de gestión</a>; la integración con proveedores y clientes usa la <a href="tema.html?id=legacy-integration">integración de aplicaciones</a>, y el
      <a href="tema.html?id=cross-department-flow">flujo de información entre departamentos</a> es la versión interna del mismo problema.</p>`,
  });
})();
