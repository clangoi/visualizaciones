(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;

  /* ---------- Fig. 1: planificación de capacidad ---------- */

  const MESES = 36, CAP0 = 160;

  // Pronóstico lineal con los últimos 6 meses: nivel actual y pendiente por mínimos cuadrados.
  function pronostico(d, t, h) {
    const a = Math.max(0, t - 5), n = t - a + 1;
    if (n < 3) return d[t];
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = a; i <= t; i++) { sx += i; sy += d[i]; sxy += i * d[i]; sxx += i * i; }
    const pend = (n * sxy - sx * sy) / (n * sxx - sx * sx), base = sy / n + pend * (t - (a + t) / 2);
    return base + pend * h;
  }

  function montarCapacidad(cuerpo) {
    let semilla = 1, tend = 3, amp = 10, umbral = 90, tam = 60, plazo = 4, politica = 'reactiva';
    let demanda = [], cap = [], pedidos = [], mes = -1, msg = '', hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Política de ampliación', opciones: [['reactiva', 'Reactiva: pedir cuando se supera el umbral'], ['proactiva', 'Proactiva: pedir según el pronóstico']], valor: politica, alCambiar: (v) => { politica = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Crecimiento de la demanda', min: 0, max: 6, paso: 0.5, valor: tend, formato: (v) => `+${v} / mes`, alCambiar: (v) => { tend = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Estacionalidad', min: 0, max: 25, valor: amp, formato: (v) => `± ${v}`, alCambiar: (v) => { amp = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Umbral de utilización', min: 60, max: 100, paso: 5, valor: umbral, formato: (v) => `${v} %`, alCambiar: (v) => { umbral = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Plazo de entrega', min: 1, max: 8, valor: plazo, formato: (v) => `${v} meses`, alCambiar: (v) => { plazo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tamaño de cada ampliación', min: 20, max: 120, paso: 10, valor: tam, formato: (v) => `+${v}`, alCambiar: (v) => { tam = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nueva demanda', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'demanda', forma: 'linea' },
      { color: C.tinta, texto: 'capacidad instalada', forma: 'linea' },
      { color: C.apagado, texto: 'umbral de pedido', forma: 'linea' },
      { color: C.s4, texto: 'ampliación pedida, aún no entregada' },
      { color: VIZ.alfa(C.s8, 0.3), texto: 'mes con demanda sobre la capacidad' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La demanda sube con tendencia, estacionalidad y ruido (unidades de capacidad, por ejemplo núcleos). Avance mes a mes y vea cuándo se pide y cuándo llega cada ampliación. Pruebe plazos largos con la política reactiva: la capacidad llega tarde. Compare con la proactiva.');

    function iniciar() {
      demanda = S.serie(semilla * 17 + 3, MESES, { base: 100, tend, amp, per: 12, ruido: 3 }).map((v) => Math.max(10, v));
      cap = []; pedidos = []; mes = -1;
      let actual = CAP0;
      msg = `Capacidad inicial ${CAP0}; demanda inicial ${VIZ.fmt(demanda[0], 3)}. Cada ampliación suma ${tam} y tarda ${plazo} meses en llegar.`;
      return (function* () {
        for (let t = 0; t < MESES; t++) {
          const eventos = [];
          pedidos.filter((p) => p.llega === t).forEach((p) => { actual += p.tam; eventos.push(`llega la ampliación pedida en el mes ${p.mes + 1} (capacidad ${actual})`); });
          cap[t] = actual;
          const pend = pedidos.filter((p) => p.llega > t), pendCap = pend.reduce((s, p) => s + p.tam, 0);
          const u = umbral / 100;
          const pedir = politica === 'reactiva' ? !pend.length && demanda[t] / actual > u : pronostico(demanda, t, plazo) / (actual + pendCap) > u;
          if (pedir) { pedidos.push({ mes: t, llega: t + plazo, tam }); eventos.push(`se pide una ampliación de +${tam} (llega en el mes ${t + plazo + 1})`); }
          if (demanda[t] > actual) eventos.push(`la demanda (${VIZ.fmt(demanda[t], 3)}) supera la capacidad: servicio degradado`);
          mes = t;
          msg = `Mes ${t + 1}: demanda ${VIZ.fmt(demanda[t], 3)}, capacidad ${actual} (${VIZ.fmt(100 * demanda[t] / actual, 3)} %)${eventos.length ? '; ' + eventos.join('; ') : ''}.`;
          yield;
        }
        msg = `Fin de ${MESES} meses. ` + msg;
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...demanda, CAP0 + tam * 3) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: 0, ymax }, { etiquetaX: 'mes', etiquetaY: 'unidades de capacidad', ticksX: [0, 6, 12, 18, 24, 30, 36] });
      pl.ejes();
      for (let t = 0; t <= mes; t++) if (demanda[t] > cap[t]) { ctx.fillStyle = VIZ.alfa(C.s8, 0.3); ctx.fillRect(pl.sx(t), pl.y1, pl.sx(t + 1) - pl.sx(t), pl.y0 - pl.y1); }
      VIZ.trazar(ctx, pl, demanda.map((d, t) => [t + 0.5, d]), C.tenue, 2);
      const pasos = [], umb = [];
      for (let t = 0; t <= mes; t++) { pasos.push([t, cap[t]], [t + 1, cap[t]]); umb.push([t, cap[t] * umbral / 100], [t + 1, cap[t] * umbral / 100]); }
      if (pasos.length) { VIZ.trazar(ctx, pl, umb, C.apagado, 1.5, [3, 4]); VIZ.trazar(ctx, pl, pasos, C.tinta, 2.5); }
      VIZ.trazar(ctx, pl, demanda.slice(0, mes + 1).map((d, t) => [t + 0.5, d]), C.s1, 2);
      pedidos.forEach((p) => {
        if (p.mes > mes) return;
        const y = pl.sy(ymax * 0.05) - 0;
        ctx.strokeStyle = C.s4; ctx.lineWidth = 6; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(pl.sx(p.mes + 0.5), y); ctx.lineTo(pl.sx(Math.min(MESES, p.llega)), y); ctx.stroke();
      });
      if (hover >= 0 && hover <= mes) { VIZ.marcador(ctx, pl.sx(hover + 0.5), pl.sy(demanda[hover]), C.s1, 4.5); }
      registro.textContent = msg;
      const n = mes + 1, sat = demanda.slice(0, n).filter((d, t) => d > cap[t]).length;
      const util = n ? demanda.slice(0, n).reduce((s, d, t) => s + Math.min(d, cap[t]) / cap[t], 0) / n : 0;
      const falta = demanda.slice(0, n).reduce((s, d, t) => s + Math.max(0, d - cap[t]), 0);
      lectura.set([
        ['meses transcurridos', `${n} de ${MESES}`],
        ['meses con demanda sobre la capacidad', String(sat)],
        ['utilización media', n ? `${VIZ.fmt(util * 100, 3)} %` : '—'],
        ['ampliaciones pedidas', `${pedidos.length} (+${pedidos.length * tam} unidades)`],
        ['demanda no atendida acumulada', `${VIZ.fmt(falta, 3)} unidades-mes`],
      ]);
    }
    lienzo.alDibujar = () => demanda.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || mes < 0) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const t = Math.floor(pl.ix(x));
      if (t < 0 || t > mes) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      if (t !== hover) { hover = t; dibujar(); }
      tip.mostrar(x, y, `mes <b>${t + 1}</b>` + VIZ.filaTooltip(C.s1, 'demanda', VIZ.fmt(demanda[t], 3)) + VIZ.filaTooltip(C.tinta, 'capacidad', String(cap[t])) + `<div>utilización <b>${VIZ.fmt(100 * demanda[t] / cap[t], 3)} %</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (demanda.length) dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: mantenimiento preventivo y correctivo ---------- */

  const HORAS_CORRECTIVA = 8, HORAS_PREVENTIVA = 2, TMAX = 72;

  function montarMantenimiento(cuerpo) {
    let forma = 2.5, eta = 36, ratio = 8, T = 24, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Desgaste (forma k)', min: 1, max: 4, paso: 0.5, valor: forma, formato: (v) => (v === 1 ? '1 (fallas al azar)' : String(v).replace('.', ',')), alCambiar: (v) => { forma = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Vida característica del equipo', min: 12, max: 60, paso: 6, valor: eta, formato: (v) => `${v} meses`, alCambiar: (v) => { eta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de una falla / costo de un cambio planificado', min: 2, max: 30, valor: ratio, formato: (v) => `${v} : 1`, alCambiar: (v) => { ratio = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Cambiar cada', min: 3, max: TMAX, valor: T, formato: (v) => `${v} meses`, alCambiar: (v) => { T = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo mensual según el intervalo de cambio', forma: 'linea' },
      { color: C.apagado, texto: 'solo correctivo (esperar la falla)', forma: 'linea' },
      { color: C.s6, texto: 'intervalo óptimo' },
      { color: C.s2, texto: 'intervalo elegido' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Se cambia el equipo cada T meses o cuando falle, lo que ocurra antes. Un cambio planificado cuesta 1 y dura ${HORAS_PREVENTIVA} h en una ventana de baja demanda; una falla cuesta el cociente elegido y deja ${HORAS_CORRECTIVA} h sin servicio. Con k = 1 las fallas son al azar y el preventivo no sirve. Pase el cursor sobre la curva.`);

    const R = (t) => Math.exp(-Math.pow(t / eta, forma));
    function integral(a, b, n = 300) { const h = (b - a) / n; let s = R(a) + R(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * R(a + i * h); return s * h / 3; }
    const ciclo = (t) => integral(0, t);
    const tasa = (t) => (1 * R(t) + ratio * (1 - R(t))) / ciclo(t);
    const tasaCorrectivo = () => ratio / integral(0, eta * 20, 2000);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const grid = []; for (let t = 1; t <= TMAX; t += 0.5) grid.push([t, tasa(t)]);
      const corr = tasaCorrectivo(), mejor = grid.reduce((m, p) => (p[1] < m[1] ? p : m), grid[0]);
      const conviene = mejor[1] < corr * 0.995 && mejor[0] < TMAX;
      const ymax = Math.min(Math.max(corr * 1.6, mejor[1] * 1.3), Math.max(...grid.map((p) => p[1])));
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: TMAX, ymin: 0, ymax: Math.max(ymax, corr * 1.3) }, { etiquetaX: 'intervalo de cambio T (meses)', etiquetaY: 'costo por mes (cambio planificado = 1)', formatoY: (v) => VIZ.fmt(v, 2) });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, corr], [TMAX, corr]], C.apagado, 2, [6, 4]);
      ctx.save(); pl.recortar(); VIZ.trazar(ctx, pl, grid, C.s1, 2.5); ctx.restore();
      if (conviene) VIZ.marcador(ctx, pl.sx(mejor[0]), pl.sy(mejor[1]), C.s6, 6);
      VIZ.marcador(ctx, pl.sx(T), pl.sy(Math.min(tasa(T), pl.d.ymax)), C.s2, 5);
      if (hover >= 0) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.min(tasa(hover), pl.d.ymax)), C.s1, 4); }
      const E = ciclo(T), pf = 1 - R(T), fallasAnio = 12 * pf / E, cambiosAnio = 12 * R(T) / E;
      const noPlan = fallasAnio * HORAS_CORRECTIVA, plan = cambiosAnio * HORAS_PREVENTIVA;
      const fallasCorr = 12 / (integral(0, eta * 20, 2000)), noPlanCorr = fallasCorr * HORAS_CORRECTIVA;
      const disp = (h) => 1 - h / 8760;
      registro.textContent = conviene
        ? `El intervalo óptimo es de ${VIZ.fmt(mejor[0], 3)} meses: cuesta ${VIZ.fmt(mejor[1], 3)} por mes, ${VIZ.fmt(100 * (1 - mejor[1] / corr), 3)} % menos que esperar la falla (${VIZ.fmt(corr, 3)}). Con T = ${T} meses el costo es ${VIZ.fmt(tasa(T), 3)}.`
        : `Con estos parámetros no conviene el cambio preventivo: el equipo no se desgasta lo suficiente (o la falla es barata) y lo más económico es repararlo cuando falle, a ${VIZ.fmt(corr, 3)} por mes.`;
      lectura.set([
        ['costo mensual con T elegido', `${VIZ.fmt(tasa(T), 3)} (solo correctivo: ${VIZ.fmt(corr, 3)})`],
        ['intervalo óptimo', conviene ? `${VIZ.fmt(mejor[0], 3)} meses` : 'no cambiar preventivamente'],
        ['equipos que fallan antes de T', `${VIZ.fmt(pf * 100, 3)} %`],
        ['caída no planificada', `${VIZ.fmt(noPlan, 3)} h/año (solo correctivo: ${VIZ.fmt(noPlanCorr, 3)})`],
        ['caída planificada', `${VIZ.fmt(plan, 3)} h/año por equipo`],
        ['disponibilidad del equipo', `${VIZ.fmt(100 * disp(noPlan + plan), 6)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const t = Math.max(1, Math.round(pl.ix(x) * 2) / 2);
      if (t !== hover) { hover = t; dibujar(); }
      tip.mostrar(x, y, `cambio cada <b>${t}</b> meses` + VIZ.filaTooltip(C.s1, 'costo por mes', VIZ.fmt(tasa(t), 3)) + `<div>fallan antes: <b>${VIZ.fmt((1 - R(t)) * 100, 3)} %</b></div><div>ciclo medio: <b>${VIZ.fmt(ciclo(t), 3)}</b> meses</div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('infrastructure-administration', {
    intro: String.raw`
      <p>La <strong>administración de infraestructura</strong> es el trabajo continuo de mantener en marcha los servidores, redes, almacenamiento y plataformas: monitorear, aplicar parches, ampliar la capacidad antes de que falte
      y reemplazar lo que se desgasta. Su resultado visible es la <em>continuidad operacional</em>: que el negocio no se entere de que existe una infraestructura.</p>
      <p>Dos decisiones dominan el trabajo: <em>cuándo ampliar</em> (cuando la demanda alcanza a la capacidad, y con plazos de compra e instalación de por medio) y <em>cuándo intervenir</em> (arreglar al fallar o prevenir con ventanas de mantenimiento planificadas).
      Ambas son problemas de anticipación, y las dos pueden calcularse.</p>`,
    visualizaciones: [
      {
        titulo: 'Planificar la capacidad',
        descripcion: 'Avance mes a mes con una demanda que crece. Compare la política reactiva con la proactiva, alargue el plazo de entrega y suba la estacionalidad: mire cuántos meses la demanda supera la capacidad.',
        montar: montarCapacidad,
      },
      {
        titulo: 'Mantenimiento preventivo o correctivo',
        descripcion: 'Mueva el intervalo de cambio y busque el mínimo de la curva de costo. Ponga k = 1 (fallas al azar) para ver que el preventivo deja de convenir, y suba el costo de una falla para ver que el óptimo se adelanta.',
        montar: montarMantenimiento,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Administrar la infraestructura incluye: <em>monitoreo</em> (medir utilización, latencia y errores), <em>gestión de cambios y parches</em>, <em>planificación de capacidad</em>, <em>mantenimiento</em> y <em>respaldo y recuperación</em>.
      Se apoya en procesos como los de ITIL: incidentes, cambios, capacidad y continuidad del servicio.</p>
      <h2>Planificación de capacidad</h2>
      <p>Sean \(D(t)\) la demanda y \(K(t)\) la capacidad instalada; la utilización es \(\rho(t) = D(t)/K(t)\). Cuando \(\rho \to 1\) los tiempos de respuesta crecen (véase
      <a href="tema.html?id=client-server-architectures">arquitecturas cliente-servidor</a>), por eso se fija un umbral \(u\) (típicamente 70 a 90 %). Si ampliar tarda \(L\) meses, se debe pedir cuando</p>
      \[ \hat D(t + L) \;\ge\; u\,K(t), \]
      <p>siendo \(\hat D\) un pronóstico, por ejemplo una recta ajustada por mínimos cuadrados a los últimos meses. La política <em>reactiva</em> espera a que \(D(t) \ge u\,K(t)\), de modo que la ampliación llega \(L\) meses después de que ya se cruzó el umbral;
      con estacionalidad o plazos largos puede llegar tarde.</p>
      <p><strong>Ejemplo resuelto.</strong> Con \(D(t) = 100 + 4t\), \(K = 160\), \(u = 90\,\%\) y \(L = 4\): la capacidad se agota en \(t = 15\). La política reactiva pide en \(100 + 4t = 144\), es decir \(t = 11\), y recibe en \(t = 15\): sin margen alguno. Con
      un pico estacional de +10, la demanda cruza los 160 ya en \(t = 12{,}5\) (\(100 + 4t + 10 = 160\)), antes de que llegue esa ampliación. La proactiva, que ve \(\hat D(t+4) \ge 144\) en \(t = 7\), recibe en \(t = 11\) y queda cuatro meses por delante.</p>
      <h2>Mantenimiento preventivo y correctivo</h2>
      <p>Sea \(R(t)\) la probabilidad de que un equipo siga operando a la edad \(t\). Con desgaste tipo Weibull, \(R(t) = e^{-(t/\eta)^k}\): si \(k = 1\) las fallas son al azar (sin memoria) y si \(k > 1\) la tasa de falla crece con la edad. Si se cambia el equipo cada \(T\) meses
      (o antes, si falla), con costo \(c_p\) por cambio planificado y \(c_f\) por falla, el costo por unidad de tiempo es (teoría de renovación)</p>
      \[ \Gamma(T) = \frac{c_p\,R(T) + c_f\,\big(1 - R(T)\big)}{\displaystyle\int_0^{T} R(t)\,dt}. \]
      <p>Existe un \(T^{*}\) finito que mejora el costo de esperar la falla, \(c_f / \mathrm{MTTF}\), solo si \(k > 1\) y \(c_f > c_p\); con \(k = 1\), \(\Gamma(T)\) decrece con \(T\) y no conviene prevenir. La caída esperada se compone de
      \(12\,(1-R(T))/E[\text{ciclo}]\) fallas al año de ocho horas y \(12\,R(T)/E[\text{ciclo}]\) cambios de dos horas, en una <em>ventana de mantenimiento</em> elegida para minimizar el efecto sobre el negocio.</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Prevenir no es «cambiar todo seguido»: solo paga cuando el equipo se desgasta (k &gt; 1) y la falla cuesta mucho más que el cambio. Los componentes con fallas al azar (algunos errores de software, por ejemplo) se gestionan con redundancia, no con reemplazos periódicos.</p></div>
      <h2>Continuidad operacional</h2>
      <p>El objetivo es mantener la disponibilidad comprometida con el negocio, descontando tanto las fallas como las ventanas planificadas. Para una disponibilidad de 99,9 % al año caben unas 8,8 horas de caída entre ambas; ahí se ve que
      una ventana de dos horas al mes (24 h al año) ya la excede, y por qué se recurre a <a href="tema.html?id=scalability-availability">redundancia</a> para mantener sin detener el servicio.</p>
      <h2>Conexiones</h2>
      <p>La administración recorre las <a href="tema.html?id=it-infrastructure-layers">capas de la infraestructura</a>; la <a href="tema.html?id=virtualization">virtualización</a> facilita mover cargas durante un mantenimiento; el
      <a href="tema.html?id=cloud-service-models">modelo de servicio en la nube</a> decide cuánto de esta administración se delega; y su efecto en dinero se ve en <a href="tema.html?id=cloud-vs-on-premise-costs">costos de la nube y del entorno local</a>.</p>`,
  });
})();
