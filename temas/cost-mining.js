(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const PROCESOS = [['reclamos', P.procesos.reclamos.nombre], ['pedidos', P.procesos.pedidos.nombre]];
  // Tarifa de cada rol en $ por hora de trabajo (dato de ejemplo).
  const TARIFA = { ventas: 24, bodega: 18, finanzas: 30, soporte: 22, gerencia: 80 };
  const $ = (v) => (v < 0 ? '−$' : '$') + VIZ.fmt(Math.abs(v), 3);

  // Costo de cada evento = costo fijo (registrado) + tarifa del rol × duración + costo de la espera previa.
  function costear(log, mult, tasaEspera) {
    const acts = new Map();
    const casos = log.map((c) => {
      const items = new Map();
      let fijo = 0, tiempo = 0, espera = 0;
      c.eventos.forEach((e, k) => {
        const f = e.costo, t = (TARIFA[e.rol] || 0) * mult * (e.fin - e.ini) / 60, w = k ? tasaEspera * (e.ini - c.eventos[k - 1].fin) / 60 : 0;
        if (!items.has(e.act)) items.set(e.act, { fijo: 0, tiempo: 0, espera: 0 });
        const it = items.get(e.act); it.fijo += f; it.tiempo += t; it.espera += w;
        if (!acts.has(e.act)) acts.set(e.act, { act: e.act, fijo: 0, tiempo: 0, espera: 0, ejec: 0 });
        const a = acts.get(e.act); a.fijo += f; a.tiempo += t; a.espera += w; a.ejec++;
        fijo += f; tiempo += t; espera += w;
      });
      return { id: c.id, ciclo: P.tiempoCiclo(c), items, fijo, tiempo, espera, total: fijo + tiempo + espera };
    });
    const N = log.length;
    const lista = [...acts.values()].map((a) => ({ ...a, total: a.fijo + a.tiempo + a.espera }));
    lista.forEach((a) => { a.pFijo = a.fijo / N; a.pTiempo = a.tiempo / N; a.pEspera = a.espera / N; a.pTotal = a.total / N; });
    return { casos, acts: lista, N, media: P.media(casos.map((c) => c.total)) };
  }
  function recortar(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 3 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  }

  /* ---------- Fig. 1: costo por actividad ---------- */

  function montarActividades(cuerpo) {
    let proceso = 'pedidos', mult = 1, tasa = 15, semilla = 1, sel = '', co = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS.slice().reverse(), valor: proceso, alCambiar: (v) => { proceso = v; sel = ''; calcular(); } });
    ctl.rango({ etiqueta: 'Tarifa de los roles (× base)', min: 0, max: 3, paso: 0.25, valor: mult, formato: (v) => '×' + v, alCambiar: (v) => { mult = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Costo de la espera ($ por hora)', min: 0, max: 60, paso: 5, valor: tasa, alCambiar: (v) => { tasa = v; recalcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    let log = [];
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 66 + 32 * (co ? co.acts.length : 8) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo fijo por ejecución' },
      { color: C.s2, texto: 'costo por tiempo de trabajo (tarifa × duración)' },
      { color: C.s4, texto: 'costo de la espera previa' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una barra para ver su detalle. Suba la tarifa y el costo cambia hacia «tiempo de trabajo»; suba el costo de la espera y las actividades que se hacen esperar encarecen el proceso sin que cambie el trabajo.');

    function calcular() { log = P.simular(P.procesos[proceso].arbol, 300, semilla, { espera: 12, llegada: 25 }); recalcular(); }
    function recalcular() { co = costear(log, mult, tasa); lienzo.ajustar(true); }
    function dibujar() {
      if (!co) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const filas = co.acts.slice().sort((a, b) => b.pTotal - a.pTotal);
      ctx.font = VIZ.fuente(11);
      const xe = Math.min(150, W * 0.38), xd = W - 14, top = 8, h = 32;
      const mx = Math.max(...filas.map((r) => r.pTotal), 1e-9) * 1.15;
      const sx = (v) => xe + v / mx * (xd - xe);
      for (const v of VIZ.ticks(0, mx, Math.max(2, Math.floor((xd - xe) / 80)))) {
        const x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + filas.length * h); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(VIZ.fmt(v, 3), x, top + filas.length * h + 5);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('$ por caso', xd, top + filas.length * h + 36);
      geo = [];
      filas.forEach((r, i) => {
        const y = top + i * h + 5, alto = h - 12;
        if (r.act === sel) { ctx.fillStyle = C.neutro; ctx.fillRect(0, top + i * h, W, h); }
        let x = xe;
        [[r.pFijo, C.s1], [r.pTiempo, C.s2], [r.pEspera, C.s4]].forEach(([v, c], j, arr) => {
          const w = sx(v) - xe;
          if (w <= 0) return;
          const ultimo = arr.slice(j + 1).every(([u]) => u <= 0);
          ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, Math.max(1, w), alto, ultimo ? [0, 4, 4, 0] : 0); ctx.fill();
          x += w;
        });
        ctx.fillStyle = r.act === sel ? C.tinta : C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, r.act, xe - 12), xe - 8, y + alto / 2 + 1);
        ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(r.pTotal, 3), x + 5, y + alto / 2 + 1);
        geo.push({ r, y0: top + i * h, y1: top + (i + 1) * h });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(xe + 0.5, top); ctx.lineTo(xe + 0.5, top + filas.length * h); ctx.stroke();
      const F = co.acts.reduce((s, a) => s + a.pFijo, 0), T = co.acts.reduce((s, a) => s + a.pTiempo, 0), E = co.acts.reduce((s, a) => s + a.pEspera, 0);
      lectura.set([
        ['costo medio por caso', $(F + T + E)],
        ['fijo', `${$(F)} (${VIZ.fmt(100 * F / (F + T + E), 3)} %)`],
        ['por tiempo', `${$(T)} (${VIZ.fmt(100 * T / (F + T + E), 3)} %)`],
        ['por espera', `${$(E)} (${VIZ.fmt(100 * E / (F + T + E), 3)} %)`],
        ['actividad más cara', `${filas[0].act} (${VIZ.fmt(100 * filas[0].pTotal / (F + T + E), 3)} %)`],
      ]);
      const r = co.acts.find((a) => a.act === sel);
      registro.textContent = r
        ? `${r.act}: ${VIZ.fmt(r.ejec / co.N, 3)} ejecución(es) por caso; fijo ${$(r.pFijo)}, tiempo ${$(r.pTiempo)}, espera ${$(r.pEspera)} = ${$(r.pTotal)} por caso (${$(r.total / r.ejec)} por ejecución).`
        : 'Cada barra es el costo medio por caso de una actividad, sumando sus ejecuciones. Haga clic en una para ver el desglose.';
    }
    const fila = (e) => { const { y } = lienzo.posicion(e); return geo.find((g) => y >= g.y0 && y < g.y1); };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const g = fila(e), { x, y } = lienzo.posicion(e);
      if (!g) return tip.ocultar();
      const r = g.r;
      tip.mostrar(x, y, `<b>${r.act}</b>` + VIZ.filaTooltip(C.s1, 'fijo', $(r.pFijo)) + VIZ.filaTooltip(C.s2, 'tiempo', $(r.pTiempo)) + VIZ.filaTooltip(C.s4, 'espera', $(r.pEspera)) + `<div>total por caso <b>${$(r.pTotal)}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (e) => { const g = fila(e); sel = g && g.r.act !== sel ? g.r.act : ''; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: costo por caso y desviaciones ---------- */

  function montarCasos(cuerpo) {
    let proceso = 'reclamos', n = 300, k = 1.5, semilla = 1, sel = -1;
    let co = null, plano = null, umbral = 0, mu = 0, sd = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; sel = -1; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 100, max: 600, paso: 50, valor: n, alCambiar: (v) => { n = v; sel = -1; calcular(); } });
    ctl.rango({ etiqueta: 'Umbral (σ sobre la media)', min: 0.5, max: 3, paso: 0.25, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; sel = -1; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo dentro de lo esperado', forma: 'punto' },
      { color: C.s8, texto: 'costo sobre el umbral', forma: 'punto' },
      { color: C.apagado, texto: 'media y umbral', forma: 'linea' },
      { color: C.tinta, texto: 'caso seleccionado', forma: 'punto' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un punto para descomponer su desviación por actividad frente al costo medio de esa actividad. Baje el umbral para marcar más casos; en reclamos, los puntos altos son casos con reprocesos (investigar varias veces).');

    function calcular() {
      co = costear(P.simular(P.procesos[proceso].arbol, n, semilla, { espera: 12, llegada: 25 }), 1, 15);
      dibujar();
    }
    function dibujar() {
      if (!co) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tot = co.casos.map((c) => c.total), cic = co.casos.map((c) => c.ciclo);
      mu = P.media(tot); sd = Math.sqrt(P.media(tot.map((v) => (v - mu) ** 2))); umbral = mu + k * sd;
      const xmax = Math.max(...cic) * 1.04, ymax = Math.max(...tot, umbral) * 1.06;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax }, { etiquetaX: 'tiempo de ciclo (min)', etiquetaY: 'costo del caso ($)', formatoX: (v) => VIZ.fmt(v, 3), formatoY: (v) => VIZ.fmt(v, 3) });
      plano.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      for (const v of [mu, umbral]) { ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(v)); ctx.lineTo(plano.x1, plano.sy(v)); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`media ${$(mu)}`, plano.x1 - 4, plano.sy(mu) - 3);
      ctx.fillText(`umbral ${$(umbral)}`, plano.x1 - 4, plano.sy(umbral) - 3);
      co.casos.forEach((c, i) => { if (i !== sel) VIZ.marcador(ctx, plano.sx(c.ciclo), plano.sy(c.total), c.total > umbral ? C.s8 : C.s1, 3.2); });
      if (sel >= 0) { const c = co.casos[sel]; VIZ.marcador(ctx, plano.sx(c.ciclo), plano.sy(c.total), C.tinta, 6); }
      // Correlación entre ciclo y costo.
      const mc = P.media(cic), sc = Math.sqrt(P.media(cic.map((v) => (v - mc) ** 2)));
      const r = P.media(co.casos.map((c) => (c.ciclo - mc) * (c.total - mu))) / (sc * sd || 1);
      const sobre = co.casos.filter((c) => c.total > umbral);
      lectura.set([
        ['costo medio', $(mu)],
        ['desviación estándar', $(sd)],
        ['umbral', $(umbral)],
        ['casos sobre el umbral', `${sobre.length} (${VIZ.fmt(100 * sobre.length / co.casos.length, 3)} %)`],
        ['costo en esos casos', `${VIZ.fmt(100 * sobre.reduce((s, c) => s + c.total, 0) / tot.reduce((s, v) => s + v, 0), 3)} % del total`],
        ['correlación ciclo–costo', VIZ.fmt(r, 2)],
      ]);
      if (sel < 0) {
        lista.replaceChildren(VIZ.el('div', null, 'Haga clic en un punto para ver su desglose.'));
        registro.textContent = `Con un umbral de ${VIZ.fmt(k, 3)} σ (${$(umbral)}) se marcan ${sobre.length} casos. El costo y el tiempo de ciclo se mueven juntos (r = ${VIZ.fmt(r, 2)}) porque el tiempo de trabajo y la espera cuestan, pero no del todo: hay casos caros que no son lentos.`;
        return;
      }
      const c = co.casos[sel];
      const medias = new Map(co.acts.map((a) => [a.act, a.pTotal]));
      const filas = [...new Set([...c.items.keys(), ...medias.keys()])].map((a) => {
        const it = c.items.get(a), costo = it ? it.fijo + it.tiempo + it.espera : 0;
        return { a, costo, esperado: medias.get(a) || 0, d: costo - (medias.get(a) || 0) };
      }).sort((p, q) => q.d - p.d);
      lista.replaceChildren(...filas.filter((f) => Math.abs(f.d) > 0.005).slice(0, 8).map((f) => VIZ.el('div', f.d > 0.005 ? { class: 'activa' } : null,
        `${f.a}   ${$(f.costo)} frente a ${$(f.esperado)} esperado   ${f.d >= 0 ? '+' : '−'}${$(Math.abs(f.d))}`)));
      registro.textContent = `${c.id}: costo ${$(c.total)} (${c.total > umbral ? 'sobre' : 'bajo'} el umbral), ${$(c.total - mu)} respecto de la media, ciclo ${P.dur(c.ciclo)}. La suma de las diferencias por actividad es exactamente esa desviación.`;
    }
    const cerca = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let best = null, bd = 100;
      if (plano) co.casos.forEach((c, i) => { const d = Math.hypot(plano.sx(c.ciclo) - x, plano.sy(c.total) - y); if (d < bd) { bd = d; best = i; } });
      return { x, y, i: bd < 12 ? best : -1 };
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, i } = cerca(ev);
      if (i < 0) return tip.ocultar();
      const c = co.casos[i];
      tip.mostrar(x, y, `<b>${c.id}</b>` + VIZ.filaTooltip(c.total > umbral ? C.s8 : C.s1, 'costo', $(c.total)) + `<div>ciclo <b>${P.dur(c.ciclo)}</b></div><div>fijo ${$(c.fijo)} · tiempo ${$(c.tiempo)} · espera ${$(c.espera)}</div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const { i } = cerca(ev); sel = i === sel ? -1 : i; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 3: Pareto de costos y oportunidades ---------- */

  function montarPareto(cuerpo) {
    let proceso = 'pedidos', umbralP = 80, red = 30, semilla = 1;
    let co = null, filas = [], elegidas = new Set(), actual = '', msg = '', geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS.slice().reverse(), valor: proceso, alCambiar: (v) => { proceso = v; preparar(); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Cubrir el costo hasta (%)', min: 50, max: 95, paso: 5, valor: umbralP, alCambiar: (v) => { umbralP = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Reducción lograda en cada una (%)', min: 10, max: 80, paso: 5, valor: red, alCambiar: (v) => { red = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; preparar(); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 320, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'actividad elegida para optimizar' },
      { color: C.s2, texto: 'candidata del paso actual' },
      { color: C.inactivo, texto: 'sin elegir' },
      { color: C.tinta2, texto: 'costo acumulado (% del total)', forma: 'linea' },
      { color: C.apagado, texto: 'umbral de cobertura', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca el algoritmo voraz: toma actividades por costo decreciente hasta cubrir el umbral. También puede hacer clic en una barra para elegirla o quitarla a mano. El ahorro supone reducir ese porcentaje del costo de cada actividad elegida.');

    function preparar() {
      co = costear(P.simular(P.procesos[proceso].arbol, 300, semilla, { espera: 12, llegada: 25 }), 1, 15);
      filas = co.acts.slice().sort((a, b) => b.pTotal - a.pTotal);
    }
    function iniciar() {
      if (!co) preparar();
      elegidas = new Set(); actual = '';
      msg = `Hay ${filas.length} actividades, ordenadas por costo por caso. Se eligen las más caras hasta cubrir ${umbralP} % del costo total.`;
      return (function* () {
        const total = filas.reduce((s, f) => s + f.pTotal, 0);
        let cub = 0;
        for (const f of filas) {
          if (cub >= umbralP / 100 * total - 1e-9) break;
          actual = f.act;
          msg = `Candidata: ${f.act} (${$(f.pTotal)} por caso). Cubierto hasta ahora ${VIZ.fmt(100 * cub / total, 3)} %; con ella sería ${VIZ.fmt(100 * (cub + f.pTotal) / total, 3)} %.`;
          yield;
          elegidas.add(f.act); cub += f.pTotal; actual = '';
          msg = `${f.act} elegida. Cubierto ${VIZ.fmt(100 * cub / total, 3)} % del costo con ${elegidas.size} de ${filas.length} actividades.`;
          if (cub < umbralP / 100 * total - 1e-9) yield;
        }
        msg = `Listo: ${elegidas.size} de ${filas.length} actividades (${VIZ.fmt(100 * elegidas.size / filas.length, 3)} %) cubren ${VIZ.fmt(100 * cub / total, 3)} % del costo.`;
      })();
    }
    function dibujar() {
      if (!co) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const total = filas.reduce((s, f) => s + f.pTotal, 0);
      const izq = 52, der = 40, sup = 14, inf = Math.min(110, H * 0.3);
      const x0 = izq, x1 = W - der, y0 = H - inf, y1 = sup, ymax = total * 1.02;
      const sy = (v) => y0 - v / ymax * (y0 - y1), paso = (x1 - x0) / filas.length;
      ctx.font = VIZ.fuente(11);
      for (const v of VIZ.ticks(0, ymax, 4)) {
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x0, Math.round(sy(v)) + 0.5); ctx.lineTo(x1, Math.round(sy(v)) + 0.5); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(VIZ.fmt(v, 3), x0 - 6, sy(v));
      }
      ctx.textAlign = 'left';
      for (const p of [0, 0.25, 0.5, 0.75, 1]) ctx.fillText(`${p * 100} %`, x1 + 5, sy(p * total));
      ctx.fillStyle = C.tinta2; ctx.textBaseline = 'top'; ctx.fillText('$ por caso', 4, 0);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath();
      ctx.moveTo(x0, sy(umbralP / 100 * total)); ctx.lineTo(x1, sy(umbralP / 100 * total)); ctx.stroke(); ctx.restore();
      geo = [];
      let acum = 0;
      const cum = [];
      filas.forEach((f, i) => {
        const xa = x0 + i * paso + 2, w = Math.max(2, paso - 4), y = sy(f.pTotal);
        ctx.fillStyle = f.act === actual ? C.s2 : elegidas.has(f.act) ? C.s6 : C.inactivo;
        ctx.beginPath(); ctx.roundRect(xa, y, w, y0 - y, [4, 4, 0, 0]); ctx.fill();
        acum += f.pTotal; cum.push([xa + w / 2, sy(acum)]);
        ctx.save(); ctx.translate(xa + w / 2, y0 + 8); ctx.rotate(Math.PI / 4); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = elegidas.has(f.act) ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(10);
        ctx.fillText(recortar(ctx, f.act, inf - 14), 0, 0); ctx.restore();
        geo.push({ f, x0: x0 + i * paso, x1: x0 + (i + 1) * paso, acum });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, y0 + 0.5); ctx.lineTo(x1, y0 + 0.5); ctx.stroke();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 2; ctx.beginPath();
      cum.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      cum.forEach(([x, y]) => VIZ.marcador(ctx, x, y, C.tinta2, 3));
      const costoSel = filas.filter((f) => elegidas.has(f.act)).reduce((s, f) => s + f.pTotal, 0);
      const ahorro = costoSel * red / 100;
      registro.textContent = msg;
      lectura.set([
        ['elegidas', `${elegidas.size} de ${filas.length}`],
        ['costo que cubren', `${$(costoSel)} (${VIZ.fmt(100 * costoSel / total, 3)} %)`],
        ['ahorro por caso', `${$(ahorro)} (${VIZ.fmt(100 * ahorro / total, 3)} % del total)`],
        ['costo nuevo por caso', $(total - ahorro)],
        ['ahorro por 1 000 casos', $(ahorro * 1000)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return { x, y, g: geo.find((q) => x >= q.x0 && x < q.x1) }; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, g } = bajo(ev);
      if (!g) return tip.ocultar();
      const total = filas.reduce((s, f) => s + f.pTotal, 0);
      tip.mostrar(x, y, `<b>${g.f.act}</b>` + VIZ.filaTooltip(C.s1, 'fijo', $(g.f.pFijo)) + VIZ.filaTooltip(C.s2, 'tiempo', $(g.f.pTiempo)) + VIZ.filaTooltip(C.s4, 'espera', $(g.f.pEspera)) +
        `<div>costo por caso <b>${$(g.f.pTotal)}</b> (${VIZ.fmt(100 * g.f.pTotal / total, 3)} %)</div><div>acumulado <b>${VIZ.fmt(100 * g.acum / total, 3)} %</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { g } = bajo(ev);
      if (!g) return;
      rep.detener();
      if (elegidas.has(g.f.act)) elegidas.delete(g.f.act); else elegidas.add(g.f.act);
      actual = '';
      msg = `${g.f.act} ${elegidas.has(g.f.act) ? 'elegida' : 'quitada'} a mano.`;
      dibujar();
    });
    preparar();
    rep.reiniciar();
  }

  VIZ.registrarTema('cost-mining', {
    intro: String.raw`
      <p>La <strong>minería de procesos orientada a costos</strong> agrega a cada evento un valor monetario y lo suma por actividad, por caso y por variante. El costo de un evento tiene al menos tres partes: un <em>costo fijo</em> por ejecutarlo (materiales, licencias), un <em>costo por tiempo</em> (la tarifa de quien trabaja multiplicada por la duración) y el <em>costo de la espera</em> (capital inmovilizado, clientes insatisfechos).</p>
      <p>Con esa base se responden preguntas de decisión: ¿qué actividades concentran el dinero?, ¿qué casos se salen de lo esperado y por qué?, ¿dónde conviene intervenir primero? Casi siempre unas pocas actividades explican la mayor parte del costo, y la figura de Pareto lo hace visible.</p>`,
    visualizaciones: [
      {
        titulo: 'Costo por actividad',
        descripcion: 'Cada barra suma costo fijo, de tiempo y de espera por caso. Mueva la tarifa y el costo de la espera: la actividad más cara puede cambiar según qué componente pese más.',
        montar: montarActividades,
      },
      {
        titulo: 'Costo por caso y desviaciones',
        descripcion: 'Cada punto es un caso: tiempo de ciclo contra costo. Baje el umbral para marcar más casos caros y haga clic en uno para ver qué actividades lo encarecen frente a la media.',
        montar: montarCasos,
      },
      {
        titulo: 'Pareto de costos y optimización',
        descripcion: 'Reproduzca la selección voraz de las actividades más caras hasta cubrir el umbral, o elíjalas a mano con clic. Cambie la reducción lograda y vea el ahorro por caso y por mil casos.',
        montar: montarPareto,
      },
    ],
    teoria: String.raw`
      <h2>Modelo de costos</h2>
      <p>Para un evento \(e\) de actividad \(a\), ejecutado por un recurso con tarifa \(\rho\) (en dólares por hora) durante \(d_e\) horas, tras una espera \(w_e\) horas, el costo es</p>
      \[ \kappa(e) = \underbrace{\varphi_e}_{\text{fijo}} + \underbrace{\rho\, d_e}_{\text{tiempo}} + \underbrace{\theta\, w_e}_{\text{espera}}, \]
      <p>con \(\theta\) el costo de espera por hora. El costo de un caso es \(K_c=\sum_{e\in c}\kappa(e)\) y el de una actividad por caso, \(\bar K_a = \tfrac1N\sum_c\sum_{e\in c,\,a(e)=a}\kappa(e)\). Los dos agregados suman lo mismo: \(\sum_a \bar K_a = \tfrac1N\sum_c K_c\).</p>
      <h2>Desviaciones de costo</h2>
      <p>Un caso es una desviación si \(K_c>\mu_K+z\,\sigma_K\), con \(\mu_K\) y \(\sigma_K\) la media y la desviación estándar de los costos. Para explicarla, se compara el costo del caso en cada actividad con \(\bar K_a\):</p>
      \[ K_c-\mu_K = \sum_a \bigl(K_{c,a}-\bar K_a\bigr) . \]
      <p>Los términos más positivos señalan dónde se originó el sobrecosto (reprocesos, esperas largas, recursos caros). La correlación entre ciclo y costo es alta cuando domina el costo por tiempo y baja cuando domina el costo fijo.</p>
      <h2>Pareto y priorización</h2>
      <p>Si se ordenan las actividades por \(\bar K_a\) decreciente, el <em>costo acumulado</em> \(F(m)=\sum_{i\le m}\bar K_{(i)}\big/\sum_a\bar K_a\) crece rápido al principio. El algoritmo voraz elige el menor \(m\) con \(F(m)\ge\alpha\):</p>
      <pre><code>ordenar actividades por costo por caso, de mayor a menor
acumulado ← 0 ; elegidas ← ∅
para cada actividad a en ese orden:
    si acumulado ≥ α · total: detener
    elegidas ← elegidas ∪ {a} ; acumulado ← acumulado + K̄_a
ahorro ← r · Σ_{a ∈ elegidas} K̄_a        // r = reducción lograda</code></pre>
      <p>Es óptimo para maximizar el costo cubierto con un número dado de actividades, pero ignora la dificultad de cada mejora: la prioridad real combina costo, factibilidad y riesgo.</p>
      <div class="recuadro">El costo de la espera es una convención del analista: no aparece en el registro. Declare siempre la tarifa y el \(\theta\) usados, y analice la sensibilidad del resultado a ellos.</div>
      <h2>Conexiones</h2>
      <ul>
        <li>Tiempo de servicio y de espera de cada actividad: <a href="tema.html?id=waiting-and-service-time">Waiting and Service Time</a>.</li>
        <li>Variantes caras o lentas: <a href="tema.html?id=variant-performance">Variant Performance Analysis</a>.</li>
        <li>Priorización y medición del impacto de mejoras: <a href="tema.html?id=improvement-impact">Improvement Opportunities and Impact</a> y <a href="tema.html?id=kpi-definition">KPI Definition</a>.</li>
        <li>Dónde se forman las colas que encarecen el proceso: <a href="tema.html?id=bottleneck-analysis">Bottleneck Analysis</a>.</li>
      </ul>`,
  });
})();
