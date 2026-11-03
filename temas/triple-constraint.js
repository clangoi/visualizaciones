(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* Modelo del ejemplo: un proyecto de software construye F funciones.
     Esfuerzo requerido  E = F · H · (1 + 0,8 Q)           (persona-meses; Q = nivel de calidad en [0, 1])
     Capacidad del equipo K = n · T · η(n),  η(n) = 1 − κ (n − 1)   (se pierde tiempo coordinando)
     Costo = n · T · TARIFA. */
  const H = 0.5, KAPPA = 0.025, TARIFA = 8;
  const eta = (n) => Math.max(0.05, 1 - KAPPA * (n - 1));
  const requerido = (F, Q) => F * H * (1 + 0.8 * Q);
  const capacidad = (n, T) => n * T * eta(n);
  const PLAN = { F: 60, T: 10, n: 5, Q: 0.5 };

  /* ---------- Fig. 1: el triángulo ---------- */

  function montarTriangulo(cuerpo) {
    const e = { ...PLAN };
    const ctl = VIZ.controles(cuerpo);
    const rF = ctl.rango({ etiqueta: 'Alcance', min: 20, max: 120, valor: e.F, formato: (v) => `${v} funciones`, alCambiar: (v) => { e.F = v; dibujar(); } });
    const rT = ctl.rango({ etiqueta: 'Plazo', min: 3, max: 24, valor: e.T, formato: (v) => `${v} meses`, alCambiar: (v) => { e.T = v; dibujar(); } });
    const rN = ctl.rango({ etiqueta: 'Equipo (define el costo)', min: 1, max: 30, valor: e.n, formato: (v) => `${v} personas`, alCambiar: (v) => { e.n = v; dibujar(); } });
    const rQ = ctl.rango({ etiqueta: 'Calidad (pruebas y revisiones)', min: 0, max: 100, paso: 5, valor: e.Q * 100, formato: (v) => `${v} %`, alCambiar: (v) => { e.Q = v / 100; dibujar(); } });
    let aviso = '';
    const aplicar = () => { rF.valor = e.F; rT.valor = e.T; rN.valor = e.n; rQ.valor = e.Q * 100; dibujar(); };
    ctl.boton('Ceder alcance', () => {
      const F = Math.floor(capacidad(e.n, e.T) / (H * (1 + 0.8 * e.Q)));
      if (F < 20) { aviso = 'Ni con el alcance mínimo (20 funciones) alcanza: hay que ceder otra restricción.'; return dibujar(); }
      e.F = Math.min(e.F, F); aviso = `Para volver a ser factible el alcance baja a ${e.F} funciones.`; aplicar();
    });
    ctl.boton('Ceder plazo', () => {
      const T = Math.ceil(requerido(e.F, e.Q) / (e.n * eta(e.n)));
      if (T > 24) { aviso = 'Con este equipo ni 24 meses alcanzan: hay que ceder otra restricción.'; return dibujar(); }
      e.T = Math.max(e.T, T); aviso = `Para volver a ser factible el plazo sube a ${e.T} meses.`; aplicar();
    });
    ctl.boton('Ceder costo', () => {
      let n = e.n; while (n <= 30 && capacidad(n, e.T) < requerido(e.F, e.Q)) n++;
      if (n > 30) { aviso = 'Ninguna cantidad de personas alcanza en este plazo: más gente no acelera sin límite (ver la ley de Brooks).'; return dibujar(); }
      e.n = Math.max(e.n, n); aviso = `Para volver a ser factible el equipo sube a ${e.n} personas (costo ${e.n * e.T * TARIFA} mil).`; aplicar();
    });
    ctl.boton('Ceder calidad', () => {
      const Q = (capacidad(e.n, e.T) / (e.F * H) - 1) / 0.8;
      if (Q < 0) { aviso = 'Ni con calidad mínima alcanza: hay que ceder otra restricción.'; return dibujar(); }
      e.Q = Math.min(e.Q, Math.floor(Q * 20) / 20); aviso = `Para volver a ser factible la calidad baja a ${Math.round(e.Q * 100)} %.`; aplicar();
    });
    ctl.boton('Plan original', () => { Object.assign(e, PLAN); aviso = ''; aplicar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 360 : 340) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.35), borde: C.s6, texto: 'plan factible' }, { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'plan inviable' },
      { color: C.apagado, texto: 'plan original', forma: 'linea' }, { color: C.s2, texto: 'esfuerzo requerido' }, { color: C.s1, texto: 'capacidad del equipo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada vértice se aleja del centro según su valor; el círculo central crece con la calidad. Suba el alcance hasta que el plan se vuelva inviable y pruebe los botones «Ceder…»: cada uno calcula el cambio mínimo en esa restricción para recuperar la factibilidad.');

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H0 } = lienzo;
      lienzo.limpiar();
      const K = capacidad(e.n, e.T), E = requerido(e.F, e.Q), ok = K >= E - 1e-9, costo = e.n * e.T * TARIFA;
      const zonaTri = H0 - 96, cx = W / 2, cy = zonaTri * 0.56;
      const R0 = Math.min(zonaTri * 0.33, W * 0.26);
      const ang = [-Math.PI / 2, (5 * Math.PI) / 6, Math.PI / 6];
      const rel = [e.F / PLAN.F, e.T / PLAN.T, costo / (PLAN.n * PLAN.T * TARIFA)];
      const punto = (i, r) => [cx + R0 * r * Math.cos(ang[i]), cy + R0 * r * Math.sin(ang[i])];
      const trazar = (rs, relleno, borde, dash, ancho) => {
        ctx.beginPath(); rs.forEach((r, i) => { const [x, y] = punto(i, Math.min(1.9, r)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
        if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
        ctx.save(); if (dash) ctx.setLineDash(dash); ctx.strokeStyle = borde; ctx.lineWidth = ancho; ctx.stroke(); ctx.restore();
      };
      trazar([1, 1, 1], null, C.apagado, [4, 4], 1.5);
      trazar(rel, VIZ.alfa(ok ? C.s6 : C.s8, 0.28), ok ? C.s6 : C.s8, null, 2.5);
      const rq = 6 + 20 * e.Q;
      ctx.beginPath(); ctx.arc(cx, cy, rq, 0, Math.PI * 2); ctx.fillStyle = VIZ.alfa(C.s7, 0.25); ctx.fill(); ctx.strokeStyle = C.s7; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Q', cx, cy);
      const etiquetas = [['Alcance', `${e.F} funciones`], ['Plazo', `${e.T} meses`], ['Costo', `${costo} mil`]];
      geo = { v: [], cx, cy, rq };
      etiquetas.forEach(([n, v], i) => {
        const [x, y] = punto(i, Math.min(1.9, rel[i]));
        VIZ.marcador(ctx, x, y, ok ? C.s6 : C.s8, 5.5);
        const [lx, ly] = punto(i, Math.max(1.0, Math.min(1.9, rel[i])) + 0.0);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600);
        ctx.textAlign = i === 0 ? 'center' : i === 1 ? 'right' : 'left';
        ctx.textBaseline = i === 0 ? 'bottom' : 'top';
        const dx = i === 0 ? 0 : i === 1 ? -10 : 10, dy = i === 0 ? -10 : 8;
        ctx.fillText(n, lx + dx, ly + dy);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10);
        ctx.fillText(v, lx + dx, ly + dy + (i === 0 ? 12 + 0 : 13));
        geo.v.push({ x, y, txt: `<b>${n}</b>: ${v}<br>${VIZ.fmt(rel[i] * 100, 3)} % del plan original` });
      });
      // Barras: esfuerzo requerido y capacidad.
      const x0 = 112, x1 = W - 14, mx = Math.max(E, K) * 1.1 || 1, by = H0 - 74;
      geo.barras = [];
      [['requerido', E, C.s2, `E = F·h·(1 + 0,8·Q) = ${e.F}·${H}·${VIZ.fmt(1 + 0.8 * e.Q, 3)}`], ['capacidad', K, C.s1, `K = n·T·η(n) = ${e.n}·${e.T}·${VIZ.fmt(eta(e.n), 3)}`]].forEach(([n, v, c, f], i) => {
        const y = by + i * 30;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(n, 8, y + 11);
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x0, y, Math.max(2, ((x1 - x0) * v) / mx), 22, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600);
        const wbar = ((x1 - x0) * v) / mx;
        ctx.textAlign = wbar > 80 ? 'right' : 'left';
        ctx.fillStyle = wbar > 80 ? C.sobre : C.tinta;
        ctx.fillText(`${VIZ.fmt(v, 3)} p-m`, wbar > 80 ? x0 + wbar - 6 : x0 + wbar + 6, y + 12);
        geo.barras.push({ y0: y, y1: y + 22, txt: `<b>${n}</b>: ${VIZ.fmt(v, 4)} persona-meses<br>${f}` });
      });
      registro.textContent = (ok ? `El plan es factible: la capacidad (${VIZ.fmt(K, 3)} p-m) cubre el esfuerzo (${VIZ.fmt(E, 3)} p-m).` : `El plan es inviable: faltan ${VIZ.fmt(E - K, 3)} p-m. Hay que ceder alcance, plazo, costo o calidad.`) + (aviso ? ` ${aviso}` : '');
      lectura.set([
        ['esfuerzo requerido', `${VIZ.fmt(E, 3)} p-m`],
        ['capacidad', `${VIZ.fmt(K, 3)} p-m`],
        ['holgura', `${VIZ.fmt(K - E, 3)} p-m`],
        ['costo', `${costo} mil`],
        ['eficiencia del equipo', pct(eta(e.n))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const v = geo && geo.v.find((q) => Math.hypot(q.x - x, q.y - y) < 14);
      const b = geo && geo.barras.find((q) => y >= q.y0 && y <= q.y1 && x > 100);
      const t = v ? v.txt : b ? b.txt : (geo && Math.hypot(geo.cx - x, geo.cy - y) < geo.rq + 4) ? `<b>Calidad</b>: ${Math.round(e.Q * 100)} %<br>multiplica el esfuerzo por ${VIZ.fmt(1 + 0.8 * e.Q, 3)}` : null;
      if (t) tip.mostrar(x, y, t); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: ley de Brooks ---------- */

  function montarBrooks(cuerpo) {
    let Wk = 120, n0 = 8, k = 6, m = 10, r = 2, hoverN = -1, hoverT = -1, plN = null, plT = null, sim = null;
    const D_FORM = 0.5; // persona que cada recién llegado quita a los veteranos mientras se incorpora
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Trabajo total', min: 60, max: 240, paso: 10, valor: Wk, formato: (v) => `${v} persona-meses`, alCambiar: (v) => { Wk = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Equipo inicial', min: 2, max: 20, valor: n0, formato: (v) => `${v} personas`, alCambiar: (v) => { n0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Personas que se agregan', min: 0, max: 20, valor: k, formato: (v) => `${v}`, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Mes en que se agregan', min: 1, max: 20, valor: m, formato: (v) => `mes ${v}`, alCambiar: (v) => { m = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Meses de incorporación', min: 0, max: 5, paso: 0.5, valor: r, formato: (v) => `${v} meses`, alCambiar: (v) => { r = v; dibujar(); } });

    VIZ.subtitulo(cuerpo, 'Duración según el tamaño del equipo (todos desde el inicio)');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 200, altoMax: 280 });
    const tip1 = VIZ.tooltip(l1);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'duración mínima', forma: 'linea' }, { color: C.s1, texto: 'equipo inicial', forma: 'linea' }, { color: C.s2, texto: 'equipo ampliado', forma: 'linea' }]);
    VIZ.subtitulo(cuerpo, 'Refuerzo tardío: avance acumulado');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 220, altoMax: 300 });
    const tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'sin refuerzo', forma: 'linea' }, { color: C.s2, texto: 'con refuerzo', forma: 'linea' }, { color: C.apagado, texto: 'mes en que llegan', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada persona nueva tarda en rendir y le quita tiempo a los veteranos que la capacitan; además, más personas significan más canales de comunicación. Mueva el mes de llegada hacia el final: pasado cierto punto, reforzar atrasa el proyecto. Pase el cursor por las curvas.');

    const duracion = (n) => Wk / (n * eta(n));
    function simular() {
      const dt = 0.05, N = n0 + k, pts = { A: [[0, 0]], B: [[0, 0]] };
      const avanza = (conRef, t) => {
        if (!conRef || t < m) return n0 * eta(n0);
        if (t < m + r) return Math.max(0, n0 - D_FORM * k) * eta(N);
        return N * eta(N);
      };
      const res = { A: null, B: null };
      for (const [id, conRef] of [['A', false], ['B', true]]) {
        let t = 0, w = 0;
        while (w < Wk && t < 120) { const v = avanza(conRef, t); w += v * dt; t += dt; pts[id].push([t, Math.min(w, Wk)]); }
        res[id] = t;
      }
      return { pts, fin: res, N };
    }

    function dibujar() {
      // Duración frente al tamaño del equipo.
      {
        const { ctx } = l1; l1.limpiar();
        const nmax = Math.min(40, Math.floor(1 + 0.95 / KAPPA)), nopt = (1 + 1 / KAPPA) / 2;
        const ymax = Math.min(duracion(2) * 1.05, duracion(1));
        plN = VIZ.plano(l1, { xmin: 1, xmax: nmax, ymin: 0, ymax }, { etiquetaX: 'personas en el equipo', etiquetaY: 'meses', margen: { izq: 46 } });
        plN.ejes();
        const pts = []; for (let n = 2; n <= nmax; n += 0.5) pts.push([n, duracion(n)]);
        VIZ.trazar(ctx, plN, pts, C.tinta, 2.5);
        ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(plN.sx(nopt), plN.y1); ctx.lineTo(plN.sx(nopt), plN.y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`mínimo en n = ${VIZ.fmt(nopt, 3)}`, plN.sx(nopt) + 5, plN.y1 + 4);
        VIZ.marcador(ctx, plN.sx(n0), plN.sy(Math.min(ymax, duracion(n0))), C.s1, 6);
        if (k) VIZ.marcador(ctx, plN.sx(Math.min(nmax, n0 + k)), plN.sy(Math.min(ymax, duracion(Math.min(nmax, n0 + k)))), C.s2, 6);
      }
      // Avance en el tiempo.
      sim = simular();
      {
        const { ctx } = l2; l2.limpiar();
        const tmax = Math.ceil(Math.max(sim.fin.A, sim.fin.B)) + 1;
        plT = VIZ.plano(l2, { xmin: 0, xmax: tmax, ymin: 0, ymax: Wk * 1.05 }, { etiquetaX: 'mes', etiquetaY: 'persona-meses de trabajo hechos', margen: { izq: 46 } });
        plT.ejes();
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(plT.x0, plT.sy(Wk)); ctx.lineTo(plT.x1, plT.sy(Wk)); ctx.stroke(); ctx.setLineDash([]);
        if (k > 0) { ctx.strokeStyle = C.apagado; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(plT.sx(m), plT.y1); ctx.lineTo(plT.sx(m), plT.y0); ctx.stroke(); ctx.setLineDash([]); }
        VIZ.trazar(ctx, plT, sim.pts.A, C.s1, 2.5);
        if (k > 0) VIZ.trazar(ctx, plT, sim.pts.B, C.s2, 2.5);
        VIZ.marcador(ctx, plT.sx(sim.fin.A), plT.sy(Wk), C.s1, 5);
        if (k > 0) VIZ.marcador(ctx, plT.sx(sim.fin.B), plT.sy(Wk), C.s2, 5);
      }
      const A = sim.fin.A, B = k > 0 ? sim.fin.B : sim.fin.A, dif = B - A;
      const costoA = n0 * A * TARIFA, costoB = k > 0 ? (n0 * B + k * Math.max(0, B - m)) * TARIFA : costoA;
      registro.textContent = k === 0
        ? `Sin refuerzo el proyecto termina en el mes ${VIZ.fmt(A, 3)}. Agregue personas para comparar.`
        : `Sin refuerzo: mes ${VIZ.fmt(A, 3)}. Con ${k} personas más desde el mes ${m}: mes ${VIZ.fmt(B, 3)}, ${dif < -0.05 ? `${VIZ.fmt(-dif, 2)} meses antes` : dif > 0.05 ? `${VIZ.fmt(dif, 2)} meses después (ley de Brooks)` : 'sin diferencia'} y con un costo ${costoB > costoA ? 'mayor' : 'menor'}.`;
      lectura.set([
        ['fin sin refuerzo', `mes ${VIZ.fmt(A, 3)}`],
        ['fin con refuerzo', k ? `mes ${VIZ.fmt(B, 3)}` : '—'],
        ['diferencia', k ? `${dif > 0 ? '+' : '−'}${VIZ.fmt(Math.abs(dif), 2)} meses` : '—'],
        ['costo sin / con refuerzo', k ? `${VIZ.fmt(costoA, 4)} / ${VIZ.fmt(costoB, 4)} mil` : `${VIZ.fmt(costoA, 4)} mil`],
        ['equipo óptimo (desde el inicio)', `${VIZ.fmt((1 + 1 / KAPPA) / 2, 3)} personas`],
      ]);
    }
    l1.alDibujar = () => plN && dibujar(); l2.alDibujar = () => plT && dibujar();
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!plN || !plN.dentro(x, y)) return tip1.ocultar();
      const n = Math.max(2, Math.round(plN.ix(x)));
      tip1.mostrar(x, y, `equipo <b>${n}</b> personas<br>eficiencia <b>${pct(eta(n))}</b><br>duración <b>${VIZ.fmt(duracion(n), 3)} meses</b>`);
    });
    l1.canvas.addEventListener('pointerleave', () => tip1.ocultar());
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!plT || !plT.dentro(x, y) || !sim) return tip2.ocultar();
      const t = plT.ix(x), val = (pts) => { const q = pts.find((p) => p[0] >= t) || pts[pts.length - 1]; return q[1]; };
      tip2.mostrar(x, y, `mes <b>${VIZ.fmt(t, 3)}</b>` + VIZ.filaTooltip(C.s1, 'sin refuerzo', `${VIZ.fmt(val(sim.pts.A), 3)} p-m`) + (k ? VIZ.filaTooltip(C.s2, 'con refuerzo', `${VIZ.fmt(val(sim.pts.B), 3)} p-m`) : ''));
    });
    l2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: valor ganado ---------- */

  function montarValorGanado(cuerpo) {
    const BAC = 1000, DUR = 10;
    let rend = 85, sobre = 15, t = 0, semilla = 1, ev = [], ac = [], pl = null;
    const pv = (u) => { const q = Math.max(0, Math.min(1, u / DUR)); return BAC * (3 * q * q - 2 * q * q * q); };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ritmo real frente al planificado', min: 50, max: 130, paso: 5, valor: rend, formato: (v) => `${v} %`, alCambiar: (v) => { rend = v; recalcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Sobrecosto sobre el trabajo hecho', min: -20, max: 60, paso: 5, valor: sobre, formato: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} %`, alCambiar: (v) => { sobre = v; recalcular(); dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; recalcular(); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'valor planificado (PV)', forma: 'linea' }, { color: C.s6, texto: 'valor ganado (EV)', forma: 'linea' },
      { color: C.s8, texto: 'costo real (AC)', forma: 'linea' }, { color: C.apagado, texto: 'proyección de AC (EAC)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El presupuesto es de 1 000 (miles) en 10 meses. Avance mes a mes con «Un paso» y vea cómo se separan el valor ganado y el costo real del plan. Con ritmo bajo y sobrecosto positivo, ambos índices caen bajo 1. Pase el cursor sobre el gráfico para leer los valores de cada mes.');

    function recalcular() {
      const rnd = VIZ.semilla(semilla * 131), r1 = () => (rnd() + rnd() + rnd() - 1.5) * 0.35;
      ev = [0]; ac = [0];
      for (let m = 1; m <= DUR; m++) {
        const inc = pv(m) - pv(m - 1), g = Math.max(0, Math.min(BAC - ev[m - 1], inc * (rend / 100) * (1 + r1())));
        ev.push(ev[m - 1] + g);
        ac.push(ac[m - 1] + g * (1 + sobre / 100) * (1 + r1() * 0.5) + (m <= 2 ? 6 : 0));
      }
    }
    recalcular();
    function iniciar() {
      t = 0;
      return (function* () { while (t < DUR) { t++; yield; } })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const cpi = t > 0 ? ev[t] / ac[t] : 1, eac = t > 0 ? BAC / cpi : BAC;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: DUR + 1, ymin: 0, ymax: Math.max(BAC * 1.1, ac[DUR] * 1.05, eac * 1.05) }, { etiquetaX: 'mes', etiquetaY: 'miles de dólares', ticksX: Array.from({ length: DUR + 2 }, (_, i) => i), formatoX: (v) => String(v), margen: { izq: 52 } });
      pl.ejes();
      ctx.strokeStyle = C.eje; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(BAC)); ctx.lineTo(pl.x1, pl.sy(BAC)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('presupuesto (BAC)', pl.x0 + 4, pl.sy(BAC) - 3);
      const serie = (f, n) => Array.from({ length: n + 1 }, (_, i) => [i, f(i)]);
      VIZ.trazar(ctx, pl, serie(pv, DUR), C.s1, 2.5);
      if (t > 0) {
        VIZ.trazar(ctx, pl, serie((i) => ev[i], t), C.s6, 2.5);
        VIZ.trazar(ctx, pl, serie((i) => ac[i], t), C.s8, 2.5);
        VIZ.trazar(ctx, pl, [[t, ac[t]], [DUR, eac]], C.apagado, 2, [4, 4]);
        VIZ.marcador(ctx, pl.sx(DUR), pl.sy(eac), C.apagado, 5, 1);
        VIZ.marcador(ctx, pl.sx(t), pl.sy(ev[t]), C.s6, 5);
        VIZ.marcador(ctx, pl.sx(t), pl.sy(ac[t]), C.s8, 5);
        VIZ.marcador(ctx, pl.sx(t), pl.sy(pv(t)), C.s1, 5);
      }
      if (t === 0) {
        registro.textContent = 'Mes 0: solo existe el plan (PV). Reproduzca o pulse «Un paso» para registrar el avance real de cada mes.';
        lectura.set([['mes', '0 de 10'], ['PV', '0'], ['EV', '0'], ['AC', '0'], ['SPI / CPI', '—']]);
        return;
      }
      const spi = ev[t] / pv(t), sv = ev[t] - pv(t), cv = ev[t] - ac[t];
      const dice = (v, a, b) => (v < 0.95 ? a : v > 1.05 ? b : 'en línea con el plan');
      registro.textContent = `Mes ${t}: SPI = EV/PV = ${VIZ.fmt(ev[t], 4)}/${VIZ.fmt(pv(t), 4)} = ${VIZ.fmt(spi, 3)} (${dice(spi, 'atrasado', 'adelantado')}); CPI = EV/AC = ${VIZ.fmt(ev[t], 4)}/${VIZ.fmt(ac[t], 4)} = ${VIZ.fmt(cpi, 3)} (${dice(cpi, 'gasta más de lo que avanza', 'gasta menos de lo que avanza')}). Si sigue así costará ${VIZ.fmt(eac, 4)}.`;
      lectura.set([
        ['mes', `${t} de ${DUR}`],
        ['PV / EV / AC', `${VIZ.fmt(pv(t), 4)} / ${VIZ.fmt(ev[t], 4)} / ${VIZ.fmt(ac[t], 4)}`],
        ['SPI / CPI', `${VIZ.fmt(spi, 3)} / ${VIZ.fmt(cpi, 3)}`],
        ['SV / CV', `${VIZ.fmt(sv, 3)} / ${VIZ.fmt(cv, 3)}`],
        ['EAC / VAC', `${VIZ.fmt(eac, 4)} / ${VIZ.fmt(BAC - eac, 3)}`],
        ['plazo proyectado', spi > 0 ? `${VIZ.fmt(DUR / spi, 3)} meses` : '—'],
      ]);
    }
    lienzo.alDibujar = () => pl && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev2) => {
      const { x, y } = lienzo.posicion(ev2);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.max(0, Math.min(DUR, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `mes <b>${i}</b>` + VIZ.filaTooltip(C.s1, 'PV', VIZ.fmt(pv(i), 4)) + (i <= t ? VIZ.filaTooltip(C.s6, 'EV', VIZ.fmt(ev[i], 4)) + VIZ.filaTooltip(C.s8, 'AC', VIZ.fmt(ac[i], 4)) : '<br>aún sin registrar'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('triple-constraint', {
    intro: String.raw`
      <p>Todo proyecto se gobierna con cuatro variables entrelazadas: <strong>alcance</strong> (qué se entrega), <strong>tiempo</strong> (cuándo), <strong>costo</strong> (con cuánto dinero) y
      <strong>calidad</strong> (con qué nivel de exigencia). Es la «triple restricción» más la calidad al centro: no se puede mover una sin que se mueva otra. Pedir más funciones en el mismo plazo y presupuesto solo es posible a costa de la calidad.</p>
      <p>Y hay trampas: comprimir el cronograma agrega costo, y sumar personas a un proyecto atrasado suele atrasarlo más (<em>ley de Brooks</em>). Para saber en qué punto está un proyecto sin discutir impresiones, el
      <strong>valor ganado</strong> compara lo planificado, lo logrado y lo gastado en un solo marco de dos índices: SPI (plazo) y CPI (costo).</p>`,
    visualizaciones: [
      {
        titulo: 'El triángulo y sus compromisos',
        descripcion: 'Suba el alcance hasta que el triángulo se ponga rojo (inviable) y pulse cada botón «Ceder…» para ver cuánto hay que sacrificar en esa restricción. Compare cuánto cuesta cada salida.',
        montar: montarTriangulo,
      },
      {
        titulo: 'Más personas no siempre es menos tiempo',
        descripcion: 'En el gráfico superior, busque el equipo que minimiza la duración. En el inferior, mueva el mes en que llegan los refuerzos hacia el final y observe en qué momento el proyecto termina más tarde que sin ellos.',
        montar: montarBrooks,
      },
      {
        titulo: 'Valor ganado: SPI y CPI',
        descripcion: 'Avance mes a mes y observe cómo se separan el valor ganado (EV), el valor planificado (PV) y el costo real (AC). Baje el ritmo y suba el sobrecosto: vea cómo SPI y CPI quedan bajo 1 y el costo final proyectado (EAC) sube.',
        montar: montarValorGanado,
      },
    ],
    teoria: String.raw`
      <h2>Las cuatro restricciones</h2>
      <p>En el modelo de la primera figura, un proyecto de \(F\) funciones exige un esfuerzo que crece con el nivel de calidad \(Q \in [0,1]\), y el equipo de \(n\) personas durante \(T\) meses aporta una capacidad que pierde eficiencia al coordinarse:</p>
      \[ E = F\,h\,(1 + 0{,}8\,Q), \qquad K = n\,T\,\eta(n), \qquad \eta(n) = 1 - \kappa\,(n-1), \qquad \text{costo} = n\,T\,c. \]
      <p>El plan es factible si \(K \ge E\). Si no lo es, hay exactamente cuatro salidas: reducir \(F\), aumentar \(T\), aumentar \(n\) (más costo) o reducir \(Q\). Cada una tiene un precio: menos funcionalidad para el cliente,
      entrega tardía, presupuesto mayor o más defectos. La decisión es de negocio, no técnica.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con \(h = 0{,}5\), \(\kappa = 0{,}025\), \(F = 60\), \(Q = 0{,}5\): \(E = 60 \cdot 0{,}5 \cdot 1{,}4 = 42\) persona-meses. Un equipo de 5 durante 10 meses tiene
      \(K = 5 \cdot 10 \cdot 0{,}9 = 45\): sobra. Si el alcance sube a 70 funciones, \(E = 49 > 45\): para recuperar la factibilidad se puede aceptar un plazo de \(\lceil 49 / 4{,}5 \rceil = 11\) meses
      o un equipo de 6 personas (\(K = 6 \cdot 10 \cdot 0{,}875 = 52{,}5\)).</p></div>
      <h2>Ley de Brooks</h2>
      <p>Con \(n\) personas hay \(n(n-1)/2\) canales de comunicación. Si cada persona pierde una fracción \(\kappa(n-1)\) de su tiempo en coordinarse, la duración de un trabajo \(W\) es</p>
      \[ T(n) = \frac{W}{n\,[1 - \kappa(n-1)]}, \qquad T'(n) = 0 \;\Longrightarrow\; n^{*} = \frac{1 + 1/\kappa}{2}. \]
      <p>Con \(\kappa = 0{,}025\), \(n^{*} = 20{,}5\): más allá de ese tamaño, cada persona agregada alarga el proyecto. Además, los recién llegados necesitan tiempo para ser productivos y lo consumen de los veteranos que los capacitan; por eso un refuerzo tardío
      puede terminar después que no hacerlo. Es un argumento para <a href="tema.html?id=project-lifecycle">planificar temprano</a> y para dividir el trabajo en partes independientes
      (<a href="tema.html?id=scrum">Scrum</a> usa equipos pequeños por esa razón).</p>
      <h2>Valor ganado básico</h2>
      <p>Con el presupuesto total \(\mathrm{BAC}\), en un instante dado se miden tres valores: \(\mathrm{PV}\) (lo planificado a esta fecha), \(\mathrm{EV}\) (el presupuesto del trabajo realmente terminado) y \(\mathrm{AC}\) (lo gastado).</p>
      \[ \mathrm{SPI} = \frac{\mathrm{EV}}{\mathrm{PV}}, \quad \mathrm{CPI} = \frac{\mathrm{EV}}{\mathrm{AC}}, \quad \mathrm{SV} = \mathrm{EV} - \mathrm{PV}, \quad \mathrm{CV} = \mathrm{EV} - \mathrm{AC}, \quad \mathrm{EAC} = \frac{\mathrm{BAC}}{\mathrm{CPI}}. \]
      <p>Un índice menor que 1 es malo: SPI &lt; 1 indica atraso y CPI &lt; 1, sobrecosto. \(\mathrm{EAC}\) proyecta el costo final si el rendimiento actual continúa.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> \(\mathrm{BAC} = 1000\) a 10 meses con curva en S, \(\mathrm{PV}(t) = \mathrm{BAC}(3u^2 - 2u^3)\), \(u = t/10\). En el mes 5, \(\mathrm{PV} = 500\); si se logró \(\mathrm{EV} = 400\) gastando \(\mathrm{AC} = 450\):
      \(\mathrm{SPI} = 0{,}8\), \(\mathrm{CPI} = 0{,}89\), \(\mathrm{EAC} = 1000/0{,}89 = 1125\) y se proyecta un plazo de \(10/0{,}8 = 12{,}5\) meses.</p></div>
      <h2>Conexiones</h2>
      <p>El cronograma se calcula en <a href="tema.html?id=schedules-resources">cronogramas y recursos</a> (acelerar una actividad crítica cuesta dinero); los riesgos que mueven las cuatro variables, en
      <a href="tema.html?id=project-risks-stakeholders">riesgos e interesados</a>; los cambios de alcance, en <a href="tema.html?id=requirements-management">gestión de requisitos</a>;
      y los índices de valor ganado son indicadores de un <a href="tema.html?id=control-dashboards">tablero de control</a>. La alternativa ágil, que fija plazo y costo y deja variable el alcance, se ve en
      <a href="tema.html?id=waterfall-vs-agile">cascada frente a ágil</a>.</p>`,
  });
})();
