(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => (v < 0 ? '−$' : '$') + VIZ.entero(Math.abs(v));

  /* ---------- Fig. 1: qué tareas automatizar ---------- */

  const TAREAS = [
    { n: 'Conciliar facturas', tipo: 'reglas', vol: 1200, min: 6, err: 4, ce: 25, cob: 90 },
    { n: 'Alta de clientes', tipo: 'flujo de trabajo', vol: 400, min: 10, err: 6, ce: 40, cob: 85 },
    { n: 'Aprobar compras', tipo: 'flujo de trabajo', vol: 600, min: 8, err: 3, ce: 60, cob: 95 },
    { n: 'Copiar datos entre sistemas', tipo: 'RPA', vol: 1500, min: 4, err: 5, ce: 15, cob: 95 },
    { n: 'Armar reportes semanales', tipo: 'reglas', vol: 160, min: 25, err: 2, ce: 30, cob: 90 },
    { n: 'Responder consultas frecuentes', tipo: 'reglas', vol: 900, min: 5, err: 3, ce: 20, cob: 60 },
    { n: 'Calcular la nómina', tipo: 'flujo de trabajo', vol: 250, min: 12, err: 2, ce: 120, cob: 85 },
    { n: 'Revisar contratos', tipo: 'requiere juicio', vol: 80, min: 45, err: 8, ce: 300, cob: 20 },
  ];

  function montarTareas(cuerpo) {
    let costoH = 18, errAuto = 0.5, auto = new Set([0, 3]), hover = -1, filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Costo de una hora de trabajo', min: 8, max: 40, valor: costoH, formato: (v) => '$' + v, alCambiar: (v) => { costoH = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Error tras automatizar', min: 0, max: 3, paso: 0.5, valor: errAuto, formato: (v) => v + ' %', alCambiar: (v) => { errAuto = v; dibujar(); } });
    ctl.boton('Automatizar todo', () => { TAREAS.forEach((_, i) => auto.add(i)); dibujar(); }, { primario: true });
    ctl.boton('Solo cobertura alta (85 % o más)', () => { auto = new Set(TAREAS.map((t, i) => (t.cob >= 85 ? i : -1)).filter((i) => i >= 0)); dibujar(); });
    ctl.boton('Quitar todo', () => { auto.clear(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => TAREAS.length * 44 + 10 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'horas que siguen siendo manuales al mes' }, { color: C.s6, texto: 'horas liberadas por la automatización' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una tarea para automatizarla o devolverla a manual. Compare el ahorro de las tareas de mucho volumen con el de las que requieren juicio, donde sólo una parte puede automatizarse. Pase el cursor sobre una barra para ver el detalle.');

    const calc = (t) => {
      const horas = (t.vol * t.min) / 60, libres = (horas * t.cob) / 100;
      const evit = t.vol * (t.cob / 100) * (t.err - errAuto) / 100;
      return { horas, libres, evit, ahorro: libres * costoH + evit * t.ce, errM: (t.vol * t.err) / 100 };
    };
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const xmax = Math.max(...TAREAS.map((t) => calc(t).horas)) * 1.0, ancho = W - 16 - 78;
      filas = TAREAS.map((t, i) => ({ t, i, y: 4 + i * 44, ...calc(t) }));
      filas.forEach((f) => {
        const on = auto.has(f.i), w = (f.horas / xmax) * ancho, wl = on ? w * (f.t.cob / 100) : 0;
        ctx.fillStyle = f.i === hover ? C.neutro : 'transparent'; ctx.fillRect(0, f.y - 2, W, 42);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${on ? '●' : '○'} ${f.t.n}`, 8, f.y);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500);
        ctx.fillText(`${f.t.tipo} · ${VIZ.entero(f.t.vol)} al mes · cobertura ${f.t.cob} %`, 8, f.y + 14);
        ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(8, f.y + 27, Math.max(2, w - wl), 10, [0, 0, 0, 0]); ctx.fill();
        ctx.fillStyle = C.s6; if (wl > 0) { ctx.beginPath(); ctx.roundRect(8 + w - wl, f.y + 27, wl, 10, [0, 4, 4, 0]); ctx.fill(); }
        ctx.fillStyle = on ? C.s6 : C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle'; ctx.fillText(on ? `−${VIZ.fmt(f.libres, 3)} h` : `${VIZ.fmt(f.horas, 3)} h`, 8 + w + 6, f.y + 32);
      });
      const sel = filas.filter((f) => auto.has(f.i));
      const h = sel.reduce((s, f) => s + f.libres, 0), e = sel.reduce((s, f) => s + f.evit, 0), a = sel.reduce((s, f) => s + f.ahorro, 0);
      const horasTot = filas.reduce((s, f) => s + f.horas, 0);
      registro.textContent = sel.length
        ? `Se automatizan ${sel.length} de ${TAREAS.length} tareas: ${VIZ.fmt(h, 4)} h liberadas al mes (${VIZ.fmt((h / horasTot) * 100, 3)} % del trabajo manual) y ${VIZ.fmt(e, 3)} errores evitados.`
        : 'Todo se hace a mano. Haga clic en una tarea para automatizarla.';
      lectura.set([
        ['tareas automatizadas', `${sel.length} / ${TAREAS.length}`], ['horas liberadas al mes', VIZ.fmt(h, 4)],
        ['equivale a personas (160 h/mes)', VIZ.fmt(h / 160, 3)], ['errores evitados al mes', VIZ.fmt(e, 3)],
        ['ahorro mensual', dinero(a)], ['ahorro anual', dinero(a * 12)],
      ]);
    }
    const fila = (y) => filas.find((f) => y >= f.y - 2 && y < f.y + 40);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), f = fila(y);
      const i = f ? f.i : -1;
      if (i !== hover) { hover = i; dibujar(); }
      if (!f) return tip.ocultar();
      tip.mostrar(x, y, `<b>${f.t.n}</b>` + `<div>${VIZ.fmt(f.horas, 4)} h manuales al mes</div><div>${VIZ.fmt(f.errM, 3)} errores al mes (${f.t.err} %), cada uno cuesta ${dinero(f.t.ce)}</div>`
        + VIZ.filaTooltip(C.s6, 'si se automatiza', `−${VIZ.fmt(f.libres, 3)} h, ${VIZ.fmt(f.evit, 3)} errores menos, ${dinero(f.ahorro)}/mes`));
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const f = fila(lienzo.posicion(ev).y);
      if (!f) return;
      auto.has(f.i) ? auto.delete(f.i) : auto.add(f.i);
      dibujar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: punto de equilibrio de automatizar ---------- */

  function montarEquilibrio(cuerpo) {
    const P = { vol: 1200, min: 6, cob: 90, h: 18, err: 4, ce: 25, inv: 30000, mant: 400, crec: 1, ea: 0.5 };
    const M = 36;
    let hoverA = -1, hoverB = -1, plA = null, plB = null;
    const ctl = VIZ.controles(cuerpo);
    const rVol = ctl.rango({ etiqueta: 'Ejecuciones al mes', min: 100, max: 4000, paso: 100, valor: P.vol, formato: (v) => VIZ.entero(v), alCambiar: (v) => { P.vol = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Minutos por ejecución manual', min: 1, max: 30, valor: P.min, alCambiar: (v) => { P.min = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parte automatizable', min: 10, max: 100, paso: 5, valor: P.cob, formato: (v) => v + ' %', alCambiar: (v) => { P.cob = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de una hora', min: 8, max: 40, valor: P.h, formato: (v) => '$' + v, alCambiar: (v) => { P.h = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Errores en el trabajo manual', min: 0, max: 10, paso: 0.5, valor: P.err, formato: (v) => v + ' %', alCambiar: (v) => { P.err = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Inversión inicial (desarrollo)', min: 5000, max: 80000, paso: 5000, valor: P.inv, formato: (v) => '$' + VIZ.entero(v), alCambiar: (v) => { P.inv = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Licencia y mantención al mes', min: 0, max: 2000, paso: 100, valor: P.mant, formato: (v) => '$' + v, alCambiar: (v) => { P.mant = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Crecimiento mensual del volumen', min: 0, max: 5, paso: 0.5, valor: P.crec, formato: (v) => v + ' %', alCambiar: (v) => { P.crec = v; dibujar(); } });
    const la = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tipA = VIZ.tooltip(la);
    VIZ.subtitulo(cuerpo, 'Meses para recuperar la inversión según el volumen');
    const lb = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 180, altoMax: 250 });
    const tipB = VIZ.tooltip(lb);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'costo acumulado haciéndolo a mano', forma: 'linea' }, { color: C.s1, texto: 'costo acumulado automatizando (incluye la inversión)', forma: 'linea' },
      { color: C.s3, texto: 'meses para recuperar la inversión', forma: 'linea' }, { color: C.tinta, texto: 'volumen elegido', forma: 'circulo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El punto en que la línea azul cruza a la naranja es el equilibrio. Encarezca el desarrollo o baje el volumen y se aleja; en el gráfico de abajo haga clic para probar otro volumen y vea que bajo cierto umbral la automatización nunca se paga. Pase el cursor sobre las curvas para ver los valores.');

    const porEjec = () => {
      const manual = (P.min / 60) * P.h + (P.err / 100) * P.ce;
      const auto = (1 - P.cob / 100) * manual + (P.cob / 100) * (P.ea / 100) * P.ce;
      return { manual, auto, ahorro: manual - auto };
    };
    // Costos acumulados por mes para un volumen dado.
    function curvas(vol) {
      const { manual, auto } = porEjec(), g = 1 + P.crec / 100;
      const cm = [0], ca = [P.inv];
      for (let t = 1; t <= M; t++) { const v = vol * Math.pow(g, t - 1); cm.push(cm[t - 1] + v * manual); ca.push(ca[t - 1] + v * auto + P.mant); }
      return { cm, ca };
    }
    const mesesEq = (vol, tope = 120) => {
      const { manual, auto } = porEjec(), g = 1 + P.crec / 100;
      let cm = 0, ca = P.inv;
      for (let t = 1; t <= tope; t++) { const v = vol * Math.pow(g, t - 1); cm += v * manual; ca += v * auto + P.mant; if (ca <= cm) return t; }
      return null;
    };
    function dibujar() {
      const { cm, ca } = curvas(P.vol), eq = mesesEq(P.vol), { ahorro } = porEjec();
      {
        const { ctx } = la;
        la.limpiar();
        plA = VIZ.plano(la, { xmin: 0, xmax: M, ymin: 0, ymax: Math.max(cm[M], ca[M]) * 1.05 }, { etiquetaX: 'mes', etiquetaY: 'costo acumulado (dólares)', formatoY: (v) => VIZ.fmt(v, 3) });
        plA.ejes();
        VIZ.trazar(ctx, plA, cm.map((v, t) => [t, v]), C.s2, 2.5);
        VIZ.trazar(ctx, plA, ca.map((v, t) => [t, v]), C.s1, 2.5);
        if (eq && eq <= M) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plA.sx(eq), plA.y1); ctx.lineTo(plA.sx(eq), plA.y0); ctx.stroke(); ctx.setLineDash([]);
          VIZ.marcador(ctx, plA.sx(eq), plA.sy(ca[eq]), C.tinta, 5);
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = eq > M * 0.6 ? 'right' : 'left'; ctx.textBaseline = 'top'; ctx.fillText('equilibrio: mes ' + eq, plA.sx(eq) + (eq > M * 0.6 ? -6 : 6), plA.y1 + 2);
        }
        if (hoverA >= 0) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plA.sx(hoverA), plA.y1); ctx.lineTo(plA.sx(hoverA), plA.y0); ctx.stroke(); VIZ.marcador(ctx, plA.sx(hoverA), plA.sy(cm[hoverA]), C.s2, 4); VIZ.marcador(ctx, plA.sx(hoverA), plA.sy(ca[hoverA]), C.s1, 4); }
      }
      {
        const { ctx } = lb;
        lb.limpiar();
        const vmax = 4000, tope = 48;
        plB = VIZ.plano(lb, { xmin: 100, xmax: vmax, ymin: 0, ymax: tope }, { etiquetaX: 'ejecuciones al mes', etiquetaY: 'meses (hasta 48)', formatoX: (v) => VIZ.entero(v) });
        plB.ejes();
        const pts = []; for (let v = 100; v <= vmax; v += 50) { const m = mesesEq(v, 240); pts.push([v, m == null || m > tope ? NaN : m]); }
        VIZ.trazar(ctx, plB, pts, C.s3, 2.5);
        VIZ.trazar(ctx, plB, [[100, 12], [vmax, 12]], C.apagado, 1.5, [3, 4]);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('12 meses', plB.x1 - 4, plB.sy(12) - 3);
        const ve = mesesEq(P.vol, 240);
        VIZ.marcador(ctx, plB.sx(P.vol), plB.sy(ve == null || ve > tope ? tope : ve), C.tinta, 5);
        if (hoverB > 0) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plB.sx(hoverB), plB.y1); ctx.lineTo(plB.sx(hoverB), plB.y0); ctx.stroke(); }
      }
      const vMin = ahorro > 0 ? (P.inv / 12 + P.mant) / ahorro : Infinity;
      const net36 = cm[M] - ca[M];
      registro.textContent = `Ahorro por ejecución = ${dinero(porEjec().manual)} − ${dinero(porEjec().auto)} = $${VIZ.fmt(ahorro, 3)}; con ${VIZ.entero(P.vol)} ejecuciones al mes ahorra ${dinero(P.vol * ahorro)} y paga ${dinero(P.mant)} de mantención. ${eq ? 'La inversión se recupera en el mes ' + eq + '.' : 'En 10 años no se recupera.'}`;
      lectura.set([
        ['costo por ejecución manual', '$' + VIZ.fmt(porEjec().manual, 3)], ['costo por ejecución automatizada', '$' + VIZ.fmt(porEjec().auto, 3)],
        ['recuperación', eq ? eq + ' meses' : 'no se recupera'], ['ahorro neto a 36 meses', dinero(net36)],
        ['volumen mínimo para recuperar en 12 meses', Number.isFinite(vMin) ? VIZ.entero(vMin) + ' al mes' : '—'], ['horas liberadas al mes', VIZ.fmt((P.vol * P.min * P.cob) / 6000, 4)],
      ]);
    }
    la.alDibujar = dibujar; lb.alDibujar = dibujar;
    la.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = la.posicion(ev);
      if (!plA || !plA.dentro(x, y)) { if (hoverA >= 0) { hoverA = -1; dibujar(); } return tipA.ocultar(); }
      const t = Math.max(0, Math.min(M, Math.round(plA.ix(x))));
      if (t !== hoverA) { hoverA = t; dibujar(); }
      const { cm, ca } = curvas(P.vol);
      tipA.mostrar(x, y, `mes <b>${t}</b>` + VIZ.filaTooltip(C.s2, 'a mano', dinero(cm[t])) + VIZ.filaTooltip(C.s1, 'automatizado', dinero(ca[t])) + `<div>ventaja <b>${dinero(cm[t] - ca[t])}</b></div>`);
    });
    la.canvas.addEventListener('pointerleave', () => { hoverA = -1; tipA.ocultar(); dibujar(); });
    lb.canvas.style.cursor = 'pointer';
    lb.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lb.posicion(ev);
      if (!plB || !plB.dentro(x, y)) { if (hoverB > 0) { hoverB = -1; dibujar(); } return tipB.ocultar(); }
      const v = Math.round(plB.ix(x) / 50) * 50;
      if (v !== hoverB) { hoverB = v; dibujar(); }
      const m = mesesEq(v, 240);
      tipB.mostrar(x, y, `<b>${VIZ.entero(v)}</b> ejecuciones al mes` + VIZ.filaTooltip(C.s3, 'recuperación', m == null ? 'nunca' : m + ' meses'));
    });
    lb.canvas.addEventListener('click', (ev) => {
      const { x, y } = lb.posicion(ev);
      if (plB && plB.dentro(x, y)) { P.vol = Math.max(100, Math.min(4000, Math.round(plB.ix(x) / 100) * 100)); rVol.valor = P.vol; dibujar(); }
    });
    lb.canvas.addEventListener('pointerleave', () => { hoverB = -1; tipB.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('enterprise-platforms', {
    intro: String.raw`
      <p>Una <strong>plataforma empresarial</strong> es el conjunto de sistemas y servicios comunes sobre los que corren los procesos de una organización: datos compartidos, flujos de trabajo, reglas de negocio e
      interfaces con otras aplicaciones. Su valor no está sólo en registrar lo que ocurre, sino en <strong>automatizar las operaciones repetitivas</strong> que antes hacían personas.</p>
      <p>Hay tres niveles de automatización: <em>reglas</em> (el sistema decide según condiciones), <em>flujos de trabajo</em> (el sistema asigna, notifica y controla tareas) y <em>RPA</em> (robots de software que
      imitan a una persona operando pantallas de sistemas que no se pueden modificar). Automatizar libera horas y evita errores, pero cuesta desarrollo y mantención: hay que calcular cuándo se paga.</p>`,
    visualizaciones: [
      {
        titulo: 'Qué tareas automatizar',
        descripcion: 'Haga clic en las tareas para automatizarlas y observe las horas liberadas (verde), los errores evitados y el ahorro mensual. Compare las tareas de mucho volumen y alta cobertura con «Revisar contratos», que requiere juicio y casi no se puede automatizar.',
        montar: montarTareas,
      },
      {
        titulo: 'Punto de equilibrio de automatizar',
        descripcion: 'Suba la inversión o baje el volumen y vea cómo se aleja el cruce de las curvas. En el gráfico de abajo, haga clic para probar otro volumen: encuentre el volumen mínimo para recuperar la inversión en un año.',
        montar: montarEquilibrio,
      },
    ],
    teoria: String.raw`
      <h2>Plataformas y automatización</h2>
      <p>Una plataforma empresarial (ERP, CRM, sistema de gestión de procesos) concentra datos y reglas, y expone <strong>flujos de trabajo</strong> y <strong>API</strong> para que los procesos se ejecuten sin intervención manual.
      Las tareas con mejor perfil de automatización son <em>repetitivas, de alto volumen, basadas en reglas claras y con datos estructurados</em>; las que exigen interpretación, negociación o excepciones frecuentes
      siguen necesitando a una persona, por eso la «parte automatizable» nunca es del 100 %.</p>
      <table>
        <tr><th>Mecanismo</th><th>Cómo funciona</th><th>Ejemplo</th></tr>
        <tr><td>Reglas de negocio</td><td>condiciones que se evalúan en el sistema</td><td>aprobar automáticamente compras bajo un monto</td></tr>
        <tr><td>Flujo de trabajo</td><td>enruta, asigna y vigila tareas entre personas</td><td>alta de cliente con revisiones</td></tr>
        <tr><td>RPA</td><td>un robot opera pantallas como una persona</td><td>copiar datos entre sistemas sin interfaz</td></tr>
      </table>
      <h2>Qué se gana</h2>
      <p>Para una tarea de \(V\) ejecuciones al mes, \(t\) minutos cada una, una fracción \(c\) automatizable, tasa de error manual \(e\) y automatizada \(e_a\), con costo de hora \(h\) y costo de cada error \(k\):</p>
      \[ \text{horas liberadas} = \frac{V\,t\,c}{60}, \qquad \text{errores evitados} = V\,c\,(e - e_a), \qquad \text{ahorro} = \text{horas liberadas}\cdot h + \text{errores evitados}\cdot k. \]
      <p><strong>Ejemplo.</strong> Conciliar facturas: \(V = 1200\), \(t = 6\), \(c = 0{,}9\), \(e = 4\,\%\), \(e_a = 0{,}5\,\%\), \(h = 18\), \(k = 25\). Se liberan \(1200 \cdot 6 \cdot 0{,}9/60 = 108\) horas al mes (cerca de 0,7 personas),
      se evitan \(1200 \cdot 0{,}9 \cdot 0{,}035 \approx 38\) errores, y el ahorro es \(108 \cdot 18 + 38 \cdot 25 = 1944 + 945 \approx 2889\) dólares al mes.</p>
      <h2>Punto de equilibrio</h2>
      <p>Si el ahorro por ejecución es \(s\), la inversión inicial \(I\) y la mantención mensual \(m\), el ahorro neto mensual es \(V s - m\) y el tiempo de recuperación sin crecimiento del volumen es</p>
      \[ T = \frac{I}{V\,s - m}, \qquad V_{\min}(T) = \frac{I/T + m}{s}. \]
      <p>Con \(s \approx 2{,}41\) dólares por ejecución, \(I = 30000\) y \(m = 400\): \(T = 30000/(1200 \cdot 2{,}41 - 400) \approx 12{,}1\) meses, y para recuperar en 12 meses se necesitan al menos
      \(V_{\min} = (2500 + 400)/2{,}41 \approx 1205\) ejecuciones al mes. Bajo ese volumen la automatización tarda más; si \(V s \leq m\), no se recupera nunca.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> El ahorro de horas sólo es real si las horas liberadas se reasignan a trabajo de mayor valor o se reducen costos; si no, queda como capacidad ociosa.
      Y automatizar un proceso defectuoso lo vuelve defectuoso más rápido: conviene simplificarlo antes (<a href="tema.html?id=continuous-improvement">mejora continua</a>).</p></div>
      <h2>Conexiones</h2>
      <p>La automatización por reglas y flujos es una forma de <a href="tema.html?id=intelligent-automation">automatización inteligente</a> cuando se le suma aprendizaje automático. Su
      justificación es una <a href="tema.html?id=it-investment-decisions">decisión de inversión en TI</a>, y su efecto se mide en la <a href="tema.html?id=cross-department-flow">reducción de esperas y reingresos entre departamentos</a>.
      Para estimar cuellos de botella antes de automatizar, véase la <a href="tema.html?id=process-simulation">simulación de procesos</a>; la plataforma se apoya en un <a href="tema.html?id=erp-modules">ERP</a>
      y se conecta con sistemas anteriores mediante <a href="tema.html?id=legacy-integration">integración de aplicaciones</a>.</p>`,
  });
})();
