(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const ARBOL = P.procesos.pedidos.arbol;

  // Descomposición de un caso: servicio (suma de duraciones) y espera (huecos entre eventos).
  function medidas(caso) {
    const ev = caso.eventos;
    let serv = 0, esp = 0;
    ev.forEach((e, k) => { serv += e.fin - e.ini; if (k) esp += e.ini - ev[k - 1].fin; });
    return { ini: ev[0].ini, fin: ev[ev.length - 1].fin, ciclo: ev[ev.length - 1].fin - ev[0].ini, serv, esp };
  }
  const horas = (m) => m / 60;
  const fh = (m) => VIZ.fmt(horas(m), 3);

  // Eje horizontal de tiempo (en horas) con rejilla vertical suave.
  function ejeTiempo(ctx, x0, x1, yTop, yBase, t0, t1) {
    ctx.save();
    ctx.font = VIZ.fuente(11);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of VIZ.ticks(horas(t0), horas(t1), Math.max(2, Math.floor((x1 - x0) / 80)))) {
      const x = Math.round(x0 + (v * 60 - t0) / (t1 - t0) * (x1 - x0)) + 0.5;
      ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBase); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.fillText(VIZ.fmt(v, 3), x, yBase + 5);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = C.tinta2;
    ctx.fillText('tiempo (h)', x1, yBase + 32);
    ctx.restore();
  }

  /* ---------- Fig. 1: línea de tiempo de los casos ---------- */

  function montarCasos(cuerpo) {
    let n = 30, llegada = 25, espera = 12, semilla = 1, sel = -1;
    let log = [], med = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 10, max: 60, valor: n, alCambiar: (v) => { n = v; generar(); } });
    ctl.rango({ etiqueta: 'Llegada media (min)', min: 8, max: 60, valor: llegada, alCambiar: (v) => { llegada = v; generar(); } });
    ctl.rango({ etiqueta: 'Espera media (min)', min: 0, max: 40, valor: espera, alCambiar: (v) => { espera = v; generar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; sel = -1; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 54 + n * 9 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'servicio (actividad en ejecución)' },
      { color: C.s2, texto: 'espera entre actividades' },
      { color: C.tinta, texto: 'caso seleccionado', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre una fila para ver su tiempo de ciclo. Haga clic en un caso para listar sus eventos; cambie la espera media y observe cómo se estiran las barras sin que cambie el trabajo real.');

    function generar() {
      log = P.simular(ARBOL, n, semilla, { espera, llegada });
      med = log.map(medidas);
      if (sel >= n) sel = -1;
      lienzo.ajustar(true);
    }
    function dibujar() {
      if (!med.length) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const x0 = 40, x1 = W - 12, yTop = 8, yBase = H - 46, fila = (yBase - yTop) / n;
      const t0 = Math.min(...med.map((m) => m.ini)), t1 = Math.max(...med.map((m) => m.fin));
      const sx = (t) => x0 + (t - t0) / (t1 - t0) * (x1 - x0);
      ejeTiempo(ctx, x0, x1, yTop, yBase, t0, t1);
      geo = { x0, x1, yTop, fila, t0, t1 };
      log.forEach((c, i) => {
        const y = yTop + i * fila, h = Math.max(3, fila - 3);
        c.eventos.forEach((e, k) => {
          if (k) { ctx.fillStyle = C.s2; ctx.fillRect(sx(c.eventos[k - 1].fin), y + 1, Math.max(0.5, sx(e.ini) - sx(c.eventos[k - 1].fin)), h); }
          ctx.fillStyle = C.s1; ctx.fillRect(sx(e.ini), y + 1, Math.max(1, sx(e.fin) - sx(e.ini)), h);
        });
        if (i === sel) {
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
          ctx.strokeRect(sx(med[i].ini) - 1.5, y - 0.5, sx(med[i].fin) - sx(med[i].ini) + 3, h + 3);
        }
        if (fila >= 8.5 && (i % 2 === 0 || fila >= 12)) {
          ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(c.id.slice(1), x0 - 5, y + h / 2 + 1);
        }
      });
      const ciclos = med.map((m) => m.ciclo);
      const S = P.media(med.map((m) => m.serv)), E = P.media(med.map((m) => m.esp));
      lectura.set([
        ['casos', String(n)],
        ['ciclo medio', P.dur(P.media(ciclos))],
        ['mediana', P.dur(P.mediana(ciclos))],
        ['percentil 90', P.dur(P.cuantil(ciclos, 0.9))],
        ['servicio medio', P.dur(S)],
        ['espera media', `${P.dur(E)} (${VIZ.fmt(100 * E / (S + E), 3)} %)`],
      ]);
      const hint = 'Haga clic en una fila para ver los eventos de un caso.';
      if (sel < 0) { registro.textContent = hint; return; }
      const c = log[sel], m = med[sel];
      registro.textContent = `${c.id}: ciclo ${P.dur(m.ciclo)} = servicio ${P.dur(m.serv)} + espera ${P.dur(m.esp)}. ` +
        c.eventos.map((e, k) => (k ? `espera ${VIZ.fmt(e.ini - c.eventos[k - 1].fin, 2)} › ` : '') + `${e.act} (${VIZ.fmt(e.fin - e.ini, 2)})`).join(' › ');
    }
    const fila = (ev) => {
      if (!geo) return -1;
      const { y } = lienzo.posicion(ev);
      const i = Math.floor((y - geo.yTop) / geo.fila);
      return i >= 0 && i < n ? i : -1;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = fila(ev), { x, y } = lienzo.posicion(ev);
      if (i < 0) return tip.ocultar();
      const m = med[i];
      tip.mostrar(x, y, `<b>${log[i].id}</b><br>inicio ${fh(m.ini)} h · fin ${fh(m.fin)} h` +
        VIZ.filaTooltip(C.tinta, 'tiempo de ciclo', P.dur(m.ciclo)) + VIZ.filaTooltip(C.s1, 'servicio', P.dur(m.serv)) + VIZ.filaTooltip(C.s2, 'espera', P.dur(m.esp)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const i = fila(ev); sel = i === sel ? -1 : i; dibujar(); });
    generar();
  }

  /* ---------- Fig. 2: throughput y trabajo en curso ---------- */

  function montarRendimiento(cuerpo) {
    let n = 120, llegada = 25, ventana = 2, semilla = 1;
    let med = [], evs = [], t0 = 0, t1 = 1, wipPts = [], barras = [], planoW = null, planoT = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 40, max: 200, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Llegada media (min)', min: 10, max: 60, valor: llegada, alCambiar: (v) => { llegada = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ventana de throughput (h)', min: 1, max: 8, valor: ventana, alCambiar: (v) => { ventana = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    VIZ.subtitulo(cuerpo, 'Trabajo en curso (WIP) a lo largo del tiempo');
    const lw = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 190, altoMax: 260 });
    const tw = VIZ.tooltip(lw);
    VIZ.subtitulo(cuerpo, 'Casos terminados por hora, en cada ventana');
    const lt = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 170, altoMax: 240 });
    const tt = VIZ.tooltip(lt);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'WIP: casos iniciados y no terminados', forma: 'linea' },
      { color: C.s2, texto: 'throughput de la ventana' },
      { color: C.apagado, texto: 'promedio global', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Suba la llegada media: los casos llegan menos seguido, el WIP baja y el throughput cae. Compare siempre λ·T con el WIP medio: la ley de Little los iguala sobre toda la ventana de observación.');

    function wipEn(t) { let w = 0; for (const e of evs) { if (e.t > t) break; w += e.d; } return w; }
    function calcular() {
      const log = P.simular(ARBOL, n, semilla, { espera: 12, llegada });
      med = log.map(medidas);
      evs = med.flatMap((m) => [{ t: m.ini, d: 1 }, { t: m.fin, d: -1 }]).sort((a, b) => a.t - b.t || a.d - b.d);
      t0 = evs[0].t; t1 = evs[evs.length - 1].t;
      let w = 0, area = 0, prev = t0;
      wipPts = [[horas(t0), 0]];
      for (const e of evs) {
        area += w * (e.t - prev); prev = e.t;
        wipPts.push([horas(e.t), w]); w += e.d; wipPts.push([horas(e.t), w]);
      }
      const nv = Math.max(1, Math.ceil(horas(t1 - t0) / ventana));
      barras = Array.from({ length: nv }, (_, i) => ({ a: horas(t0) + i * ventana, b: Math.min(horas(t1), horas(t0) + (i + 1) * ventana), n: 0 }));
      med.forEach((m) => { const i = Math.min(nv - 1, Math.floor((horas(m.fin) - horas(t0)) / ventana)); barras[i].n++; });
      const dur = horas(t1 - t0), lambda = n / dur, T = horas(P.media(med.map((m) => m.ciclo))), wipMedio = horas(area) / dur;
      const pico = Math.max(...wipPts.map((p) => p[1]));
      lectura.set([
        ['tasa de llegada λ', `${VIZ.fmt(lambda, 3)} casos/h`],
        ['ciclo medio T', `${VIZ.fmt(T, 3)} h`],
        ['λ·T', VIZ.fmt(lambda * T, 4)],
        ['WIP medio L', VIZ.fmt(wipMedio, 4)],
        ['WIP máximo', String(pico)],
        ['ventana observada', `${VIZ.fmt(dur, 3)} h`],
      ]);
      registro.textContent = `Little: L = λ·T. Aquí L = ${VIZ.fmt(wipMedio, 4)} (integral del WIP / duración) y λ·T = ${VIZ.fmt(lambda * T, 4)}: coinciden porque el área bajo el WIP es exactamente la suma de los tiempos de ciclo.`;
      dibujarW(); dibujarT();
    }
    function dibujarW() {
      if (!wipPts.length) return;
      const { ctx } = lw;
      lw.limpiar();
      const pico = Math.max(...wipPts.map((p) => p[1]));
      planoW = VIZ.plano(lw, { xmin: horas(t0), xmax: horas(t1), ymin: 0, ymax: pico + 1 }, { etiquetaY: 'WIP', formatoY: (v) => String(Math.round(v)) });
      planoW.ejes();
      ctx.save(); planoW.recortar();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.16);
      ctx.beginPath(); ctx.moveTo(planoW.sx(wipPts[0][0]), planoW.sy(0));
      wipPts.forEach(([x, y]) => ctx.lineTo(planoW.sx(x), planoW.sy(y)));
      ctx.lineTo(planoW.sx(wipPts[wipPts.length - 1][0]), planoW.sy(0)); ctx.closePath(); ctx.fill();
      ctx.restore();
      VIZ.trazar(ctx, planoW, wipPts, C.s1, 2);
      const m = wipMedioActual();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath();
      ctx.moveTo(planoW.x0, planoW.sy(m)); ctx.lineTo(planoW.x1, planoW.sy(m)); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`L = ${VIZ.fmt(m, 3)}`, planoW.x1 - 4, planoW.sy(m) - 3);
      if (hover !== null) VIZ.marcador(ctx, planoW.sx(hover), planoW.sy(wipEn(hover * 60)), C.s1, 4.5);
    }
    function wipMedioActual() {
      let w = 0, area = 0, prev = t0;
      for (const e of evs) { area += w * (e.t - prev); prev = e.t; w += e.d; }
      return area / (t1 - t0);
    }
    function dibujarT() {
      if (!barras.length) return;
      const { ctx } = lt;
      lt.limpiar();
      const tasas = barras.map((b) => b.n / (b.b - b.a || 1));
      const ymax = Math.max(1, ...tasas) * 1.15;
      planoT = VIZ.plano(lt, { xmin: horas(t0), xmax: horas(t1), ymin: 0, ymax }, { etiquetaY: 'casos/h', etiquetaX: 'tiempo (h)' });
      planoT.ejes();
      barras.forEach((b, i) => {
        const xa = planoT.sx(b.a) + 1, xb = planoT.sx(b.b) - 1, y = planoT.sy(tasas[i]);
        ctx.fillStyle = C.s2; ctx.beginPath(); ctx.roundRect(xa, y, Math.max(1, xb - xa), planoT.y0 - y, [4, 4, 0, 0]); ctx.fill();
      });
      const lam = n / horas(t1 - t0);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath();
      ctx.moveTo(planoT.x0, planoT.sy(lam)); ctx.lineTo(planoT.x1, planoT.sy(lam)); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`λ = ${VIZ.fmt(lam, 3)}`, planoT.x1 - 4, planoT.sy(lam) - 3);
    }
    lw.alDibujar = dibujarW; lt.alDibujar = dibujarT;
    lw.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lw.posicion(ev);
      if (!planoW || !planoW.dentro(x, y)) { hover = null; tw.ocultar(); return dibujarW(); }
      hover = planoW.ix(x);
      dibujarW();
      tw.mostrar(x, y, `t = <b>${VIZ.fmt(hover, 3)} h</b>` + VIZ.filaTooltip(C.s1, 'casos en curso', wipEn(hover * 60)));
    });
    lw.canvas.addEventListener('pointerleave', () => { hover = null; tw.ocultar(); dibujarW(); });
    lt.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lt.posicion(ev);
      if (!planoT || !planoT.dentro(x, y)) return tt.ocultar();
      const b = barras.find((q) => planoT.ix(x) >= q.a && planoT.ix(x) < q.b + 1e-9);
      if (!b) return tt.ocultar();
      tt.mostrar(x, y, `${VIZ.fmt(b.a, 3)} – ${VIZ.fmt(b.b, 3)} h` + VIZ.filaTooltip(C.s2, 'terminados', `${b.n} (${VIZ.fmt(b.n / (b.b - b.a || 1), 3)}/h)`));
    });
    lt.canvas.addEventListener('pointerleave', () => tt.ocultar());
    calcular();
  }

  /* ---------- Fig. 3: reproducción de marcas de tiempo ---------- */

  function montarReplay(cuerpo) {
    let n = 8, llegada = 30, semilla = 3;
    let med = [], evs = [], k = 0, w = 0, area = 0, prev = 0, tAct = 0, msg = '', total = 0, pts = [], tmax = 1, picoMax = 1, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 4, max: 16, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Llegada media (min)', min: 10, max: 60, valor: llegada, alCambiar: (v) => { llegada = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 230, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'WIP ya reproducido', forma: 'linea' },
      { color: C.s2, texto: 'evento que se procesa ahora', forma: 'punto' },
      { color: C.inactivo, texto: 'eventos pendientes', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma el siguiente evento por orden de marca de tiempo: un inicio suma un caso al WIP y un término lo resta. El área sombreada acumula WIP·Δt; al final iguala la suma de los tiempos de ciclo.');

    function iniciar() {
      const log = P.simular(ARBOL, n, semilla, { espera: 12, llegada });
      med = log.map(medidas);
      evs = med.flatMap((m, i) => [{ t: m.ini, d: 1, id: log[i].id }, { t: m.fin, d: -1, id: log[i].id }]).sort((a, b) => a.t - b.t || a.d - b.d);
      total = med.reduce((s, m) => s + m.ciclo, 0);
      tmax = horas(evs[evs.length - 1].t);
      let ww = 0; picoMax = 1;
      for (const e of evs) { ww += e.d; picoMax = Math.max(picoMax, ww); }
      k = 0; w = 0; area = 0; prev = evs[0].t; tAct = prev; pts = [[horas(prev), 0]];
      msg = `Se ordenan ${evs.length} eventos (${n} inicios y ${n} términos) por marca de tiempo. WIP = 0.`;
      return (function* () {
        for (const e of evs) {
          const dt = e.t - prev, antes = w;
          area += w * dt; prev = e.t; tAct = e.t;
          w += e.d; k++;
          pts.push([horas(e.t), antes], [horas(e.t), w]);
          msg = `t = ${fh(e.t)} h: ${e.d > 0 ? 'inicia' : 'termina'} ${e.id}. Antes: ${antes} caso(s) × ${VIZ.fmt(horas(dt), 3)} h = ${VIZ.fmt(antes * horas(dt), 3)} caso·h. WIP ${antes} → ${w}.`;
          yield;
        }
        msg = `Reproducción completa: ∫WIP dt = ${VIZ.fmt(horas(area), 4)} caso·h = Σ tiempos de ciclo (${VIZ.fmt(horas(total), 4)} caso·h).`;
      })();
    }
    function dibujar() {
      if (!evs.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: horas(evs[0].t), xmax: tmax, ymin: 0, ymax: picoMax + 1 }, { etiquetaY: 'WIP', etiquetaX: 'tiempo (h)', formatoY: (v) => String(Math.round(v)) });
      plano.ejes();
      ctx.save(); plano.recortar();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.2);
      ctx.beginPath(); ctx.moveTo(plano.sx(pts[0][0]), plano.sy(0));
      pts.forEach(([x, y]) => ctx.lineTo(plano.sx(x), plano.sy(y)));
      ctx.lineTo(plano.sx(horas(tAct)), plano.sy(0)); ctx.closePath(); ctx.fill();
      ctx.restore();
      VIZ.trazar(ctx, plano, pts, C.s1, 2);
      evs.forEach((e, i) => {
        const hecho = i < k;
        VIZ.marcador(ctx, plano.sx(horas(e.t)), plano.sy(0), i === k - 1 ? C.s2 : hecho ? C.s1 : C.inactivo, i === k - 1 ? 5 : 3.5, e.d > 0 ? 2 : 4);
      });
      registro.textContent = msg;
      lectura.set([
        ['eventos procesados', `${k} de ${evs.length}`],
        ['WIP actual', String(w)],
        ['∫WIP dt hasta ahora', `${VIZ.fmt(horas(area), 4)} caso·h`],
        ['Σ tiempos de ciclo', `${VIZ.fmt(horas(total), 4)} caso·h`],
        ['λ·T', k === evs.length ? VIZ.fmt(n / horas(evs[evs.length - 1].t - evs[0].t) * horas(total / n), 4) : '—'],
      ]);
    }
    lienzo.alDibujar = () => evs.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const i = evs.findIndex((e) => Math.abs(plano.sx(horas(e.t)) - x) < 8);
      if (i < 0) return tip.ocultar();
      const e = evs[i];
      tip.mostrar(x, y, `<b>${e.id}</b> ${e.d > 0 ? 'inicia' : 'termina'}<br>t = ${fh(e.t)} h` + VIZ.filaTooltip(i < k ? C.s1 : C.inactivo, i < k ? 'ya procesado' : 'pendiente'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('cycle-time-throughput', {
    intro: String.raw`
      <p>El <strong>análisis de desempeño</strong> parte de las marcas de tiempo del registro de eventos. El <em>tiempo de ciclo</em> (<em>cycle time</em>) de un caso es el tiempo que transcurre entre su primer y su último evento; el <em>throughput</em> es cuántos casos se terminan por unidad de tiempo; el <em>WIP</em> (<em>work in progress</em>) es cuántos casos hay abiertos en un instante.</p>
      <p>Las tres magnitudes no son independientes: la <strong>ley de Little</strong> las liga con una igualdad. Las figuras miden primero el ciclo de cada caso, luego muestran WIP y throughput en el tiempo y, por último, reproducen las marcas de tiempo evento por evento para ver de dónde sale esa igualdad.</p>`,
    visualizaciones: [
      {
        titulo: 'Tiempo de ciclo de cada caso',
        descripcion: 'Cada fila es un caso: azul es trabajo en una actividad, naranjo es espera. Suba la espera media y vea crecer el naranjo y el ciclo; luego aumente los casos y observe cómo se solapan.',
        montar: montarCasos,
      },
      {
        titulo: 'Throughput y WIP en el tiempo',
        descripcion: 'Arriba, casos abiertos en cada instante; abajo, casos terminados por hora. Cambie la llegada media y la ventana, y compare \\(\\lambda\\cdot T\\) con el WIP medio en la lectura.',
        montar: montarRendimiento,
      },
      {
        titulo: 'Reproducción de marcas de tiempo',
        descripcion: 'Avance paso a paso: cada evento sube o baja el WIP y suma un rectángulo de área \\(\\text{WIP}\\cdot\\Delta t\\). Al terminar, el área acumulada coincide con la suma de los tiempos de ciclo.',
        montar: montarReplay,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea un caso \(c\) con eventos \(e_1,\dots,e_m\), cada uno con inicio \(s_i\) y fin \(f_i\). Entonces:</p>
      \[ T_c = f_m - s_1, \qquad \text{servicio}_c = \sum_i (f_i - s_i), \qquad \text{espera}_c = \sum_{i\ge 2} (s_i - f_{i-1}), \]
      <p>y, como los intervalos de servicio y espera cubren exactamente \([s_1, f_m]\) cuando las actividades son secuenciales, \(T_c = \text{servicio}_c + \text{espera}_c\). El <em>throughput</em> en una ventana \(W\) es \(\text{terminados}(W)/|W|\) y el <em>WIP</em> en \(t\) es
      \(N(t) = \#\{c : s_1(c) \le t < f_m(c)\}\).</p>
      <h2>Ley de Little</h2>
      <p>Sobre un intervalo de observación \([0, \tau]\) en el que entran \(n\) casos, defina \(\lambda = n/\tau\), \(T = \tfrac1n\sum_c T_c\) y \(L = \tfrac1\tau\int_0^\tau N(t)\,dt\). Si todos los casos empiezan y terminan dentro del intervalo,</p>
      <div class="recuadro">\[ L = \lambda\, T \quad\Longleftrightarrow\quad \int_0^\tau N(t)\,dt = \sum_c T_c . \]</div>
      <p>La igualdad es exacta: \(N(t)=\sum_c \mathbf 1[s_1(c)\le t<f_m(c)]\), y al integrar cada indicador se obtiene \(T_c\). Es la razón por la que reducir el WIP (menos casos simultáneos) a la misma tasa de llegada acorta el ciclo, y por la que un cuello de botella que acumula trabajo alarga \(T\).</p>
      <h2>Algoritmo de reproducción</h2>
      <pre><code>eventos ← ordenar { (s₁(c), +1), (f_m(c), −1) } por tiempo
N ← 0 ; área ← 0 ; t_ant ← t del primer evento
para cada (t, d) en eventos:
    área ← área + N · (t − t_ant)
    N ← N + d ; t_ant ← t
devolver área / (t_último − t_primero)     // WIP medio L</code></pre>
      <p>Cuesta \(O(n\log n)\) por la ordenación. El mismo barrido calcula el throughput por ventanas contando términos.</p>
      <h2>Advertencias</h2>
      <ul>
        <li>Los casos truncados en los bordes del registro (abiertos al inicio o sin terminar) sesgan \(T\) y \(L\); en la práctica se descartan o se recorta la ventana.</li>
        <li>Medias y varianza: dos procesos con el mismo \(T\) medio pueden tener colas muy distintas; vea <a href="tema.html?id=duration-distributions">Duration Distributions</a>.</li>
        <li>El ciclo se descompone en servicio y espera en <a href="tema.html?id=waiting-and-service-time">Waiting and Service Time</a>, y dónde se acumula la espera se estudia en <a href="tema.html?id=bottleneck-analysis">Bottleneck Analysis</a>.</li>
        <li>Las variantes más lentas se comparan en <a href="tema.html?id=variant-performance">Variant Performance Analysis</a>.</li>
      </ul>`,
  });
})();
