(function () {
  'use strict';
  const { color: C } = VIZ;
  const SI = VIZ.si;
  const mon = (v) => (v < 0 ? '−' : '') + '$' + VIZ.entero(Math.abs(v));
  const pct = (v) => VIZ.fmt(v, 3) + ' %';

  /* ---------- Fig. 1: productividad, eficacia y retorno ---------- */

  const MESES = 36, CASOS = 700, H0 = 0.8, ACIERTO0 = 0.88, COSTO_HORA = 20, COSTO_ERROR = 15, LICENCIA = 1500, TASA_ANUAL = 0.12;

  function montarProductividad(cuerpo) {
    let aprende = 85, alinea = 70, cap = 120, inv = 60000, serie = [], flujos = [], acum = [], pl1 = null, pl2 = null, res = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Curva de aprendizaje (el tiempo baja a… al duplicar la experiencia)', min: 70, max: 95, paso: 1, valor: aprende, formato: (v) => `${v} %`, alCambiar: (v) => { aprende = v; calcular(); } });
    ctl.rango({ etiqueta: 'Alineación del sistema con el trabajo real', min: 0, max: 100, paso: 5, valor: alinea, formato: (v) => `${v} %`, alCambiar: (v) => { alinea = v; calcular(); } });
    ctl.rango({ etiqueta: 'Horas de capacitación (mes 1)', min: 0, max: 300, paso: 10, valor: cap, formato: (v) => `${v} h`, alCambiar: (v) => { cap = v; calcular(); } });
    ctl.rango({ etiqueta: 'Inversión inicial', min: 20000, max: 120000, paso: 5000, valor: inv, formato: (v) => mon(v), alCambiar: (v) => { inv = v; calcular(); } });

    VIZ.subtitulo(cuerpo, 'Índices respecto del proceso manual (100 = antes del sistema)');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 320 });
    const tip1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Flujo de caja acumulado del proyecto');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 190, altoMax: 260 });
    const tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'eficiencia: casos por hora', forma: 'linea' },
      { color: C.s2, texto: 'eficacia: % de casos bien resueltos', forma: 'linea' },
      { color: C.s3, texto: 'productividad efectiva: casos bien resueltos por hora', forma: 'linea' },
      { color: C.tinta, texto: 'flujo de caja acumulado (sin descontar)', forma: 'linea' },
      { color: C.s6, texto: 'mes de recuperación' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Antes del sistema una persona resuelve un caso en 0,8 h con 88 % de aciertos. Con el sistema el primer mes cuesta más (capacitación y falta de práctica) y luego la curva de aprendizaje reduce el tiempo. Baje la alineación y vea cómo el sistema rápido deja de ser eficaz. Pase el cursor por los meses.');

    function calcular() {
      const b = -Math.log2(aprende / 100), tasaMes = Math.pow(1 + TASA_ANUAL, 1 / 12) - 1;
      const acierto = ACIERTO0 + (alinea / 100 - 0.5) * 0.2;
      serie = []; flujos = [-inv]; acum = [-inv];
      for (let m = 1; m <= MESES; m++) {
        const h = Math.max(0.4, 1.0 * Math.pow(m, -b)), horas = CASOS * h + (m === 1 ? cap : 0);
        const efic = CASOS / horas / (1 / H0), efi = acierto / ACIERTO0;
        serie.push({ m, h, horas, efic: efic * 100, efi: efi * 100, prod: efic * efi * 100 });
        const ahorro = (CASOS * H0 - horas) * COSTO_HORA, errores = CASOS * (1 - ACIERTO0 - (1 - acierto)) * COSTO_ERROR;
        const f = ahorro + errores - LICENCIA;
        flujos.push(f); acum.push(acum[acum.length - 1] + f);
      }
      const mensual = tasaMes, vpn = SI.vpn(flujos, mensual), tir = SI.tir(flujos), rec = SI.recuperacion(flujos);
      res = { vpn, tir, rec, acierto, tirAnual: Number.isFinite(tir) ? Math.pow(1 + tir, 12) - 1 : NaN };
      dibujar();
    }

    function dibujar() {
      if (!serie.length) return;
      // Panel 1: índices.
      let { ctx } = l1;
      l1.limpiar();
      const maxI = Math.max(...serie.flatMap((s) => [s.efic, s.efi, s.prod]), 110), minI = Math.min(...serie.flatMap((s) => [s.efic, s.efi, s.prod]), 90);
      pl1 = VIZ.plano(l1, { xmin: 1, xmax: MESES, ymin: Math.floor(minI / 20) * 20, ymax: Math.ceil(maxI / 20) * 20 }, { etiquetaX: 'meses desde la puesta en marcha', etiquetaY: 'índice (antes = 100)' });
      pl1.ejes();
      VIZ.trazar(ctx, pl1, [[1, 100], [MESES, 100]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl1, serie.map((s) => [s.m, s.efic]), C.s1, 2);
      VIZ.trazar(ctx, pl1, serie.map((s) => [s.m, s.efi]), C.s2, 2);
      VIZ.trazar(ctx, pl1, serie.map((s) => [s.m, s.prod]), C.s3, 3);
      // Panel 2: flujo acumulado.
      ({ ctx } = l2);
      l2.limpiar();
      pl2 = VIZ.plano(l2, { xmin: 0, xmax: MESES, ymin: Math.floor(Math.min(...acum) / 20000) * 20000, ymax: Math.max(10000, Math.ceil(Math.max(...acum) / 20000) * 20000) }, { etiquetaX: 'mes', etiquetaY: 'acumulado ($)', formatoY: (v) => VIZ.entero(v), margen: { izq: 70 } });
      pl2.ejes();
      VIZ.trazar(ctx, pl2, [[0, 0], [MESES, 0]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl2, acum.map((v, m) => [m, v]), C.tinta, 2);
      if (res.rec != null) { VIZ.marcador(ctx, pl2.sx(res.rec + 0), pl2.sy(0), C.s6, 6); ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.s6; ctx.textAlign = 'left'; ctx.fillText(`recuperación: mes ${VIZ.fmt(res.rec + 1, 3)}`, pl2.sx(res.rec) + 10, pl2.sy(0) - 8); }
      const u = serie[MESES - 1];
      const mejor = u.prod > 100;
      registro.textContent = mejor
        ? `Al mes ${MESES} el sistema resuelve ${VIZ.fmt(u.efic - 100, 3)} % más casos por hora y con ${VIZ.fmt((res.acierto - ACIERTO0) * 100, 3)} puntos porcentuales de acierto respecto del manual: la productividad efectiva sube ${VIZ.fmt(u.prod - 100, 3)} %.`
        : `Con esta alineación el sistema no mejora la productividad efectiva (${VIZ.fmt(u.prod - 100, 3)} %): es más rápido pero produce más errores, es decir, eficiente pero no eficaz.`;
      lectura.set([
        ['productividad mes 1 (efectiva)', `${VIZ.fmt(serie[0].prod, 3)} (antes = 100)`],
        ['productividad mes 36 (efectiva)', `${VIZ.fmt(u.prod, 3)}`],
        ['horas por caso: antes → mes 36', `${H0} → ${VIZ.fmt(u.h, 3)}`],
        ['VPN a 36 meses (12 % anual)', mon(res.vpn)],
        ['TIR anual', Number.isFinite(res.tirAnual) ? pct(res.tirAnual * 100) : 'no existe'],
        ['plazo de recuperación', res.rec == null ? 'no se recupera' : `${VIZ.fmt(res.rec + 1, 3)} meses`],
      ]);
    }

    const alDib = () => dibujar();
    l1.alDibujar = alDib; l2.alDibujar = alDib;
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!pl1 || !pl1.dentro(x, y)) return tip1.ocultar();
      const m = Math.max(1, Math.min(MESES, Math.round(pl1.ix(x)))), s = serie[m - 1];
      tip1.mostrar(x, y, `mes <b>${m}</b><br>horas por caso <b>${VIZ.fmt(s.h, 3)}</b>` + VIZ.filaTooltip(C.s1, 'eficiencia', VIZ.fmt(s.efic, 4)) + VIZ.filaTooltip(C.s2, 'eficacia', VIZ.fmt(s.efi, 4)) + VIZ.filaTooltip(C.s3, 'productividad efectiva', VIZ.fmt(s.prod, 4)));
    });
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!pl2 || !pl2.dentro(x, y)) return tip2.ocultar();
      const m = Math.max(0, Math.min(MESES, Math.round(pl2.ix(x))));
      tip2.mostrar(x, y, `mes <b>${m}</b><br>flujo del mes <b>${mon(flujos[m])}</b><br>acumulado <b>${mon(acum[m])}</b>`);
    });
    l1.canvas.addEventListener('pointerleave', () => tip1.ocultar());
    l2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: ventaja competitiva y velocidad de imitación ---------- */

  const MES2 = 48, COMP = 5;

  function montarVentaja(cuerpo) {
    let semilla = 1, d0 = 12, dif = 0.5, comp = 0.5, mejora = 0.5, t = MES2, us = [], propia = [], base = [], adop = [], pl = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ventaja inicial de costo', min: 4, max: 25, valor: d0, formato: (v) => `${v} %`, alCambiar: (v) => { d0 = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Dificultad para copiar el sistema', min: 0, max: 100, paso: 5, valor: dif * 100, formato: (v) => (v < 15 ? 'tecnología comercial' : v > 75 ? 'muy específico' : `${v} %`), alCambiar: (v) => { dif = v / 100; recalcular(); } });
    ctl.rango({ etiqueta: 'Complementos propios (procesos, datos, cultura)', min: 0, max: 100, paso: 5, valor: comp * 100, formato: (v) => `${v} %`, alCambiar: (v) => { comp = v / 100; recalcular(); } });
    ctl.rango({ etiqueta: 'Ritmo de mejora continua propia', min: 0, max: 100, paso: 5, valor: mejora * 100, formato: (v) => `${v} %`, alCambiar: (v) => { mejora = v / 100; recalcular(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2.5, velMax: 5 });
    ctl.boton('Otros competidores', () => { semilla++; recalcular(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.46, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'su ventaja de costo', forma: 'linea' },
      { color: C.apagado, texto: 'ventaja si todos copian en ~2 meses (tecnología de libre acceso)', forma: 'linea' },
      { color: C.s8, texto: 'un competidor adopta un sistema equivalente' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada triángulo rojo es un competidor que logra copiar el sistema. Reproduzca 48 meses: con tecnología comercial la ventaja se evapora; suba la dificultad de copiar, los complementos propios o la mejora continua y vea cuándo se vuelve sostenida. Pase el cursor para leer cada mes.');

    function recalcular() {
      const rnd = VIZ.semilla(semilla * 53 + 1);
      us = Array.from({ length: COMP }, () => rnd());
      const tiempos = (tau) => us.map((u) => -tau * Math.log(1 - u));
      const tauProp = 2 + 22 * dif;
      adop = tiempos(tauProp).sort((a, b) => a - b);
      const adopLibre = tiempos(2);
      const share = (ts, m) => ts.filter((x) => x <= m).length / COMP;
      propia = Array.from({ length: MES2 + 1 }, (_, m) => d0 * (1 + mejora * (1 - Math.exp(-m / 12))) * (1 - (1 - comp) * share(adop, m)));
      base = Array.from({ length: MES2 + 1 }, (_, m) => d0 * (1 - share(adopLibre, m)));
      rep.reiniciar();
      t = MES2; dibujar();
    }
    function iniciar() { t = 0; return (function* () { for (let m = 1; m <= MES2; m++) { t = m; yield; } })(); }
    function dibujar() {
      if (!propia.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MES2, ymin: 0, ymax: Math.ceil(Math.max(...propia, d0) / 5) * 5 + 2 }, { etiquetaX: 'meses desde la puesta en marcha', etiquetaY: 'ventaja de costo frente al promedio de rivales (%)' });
      pl.ejes();
      VIZ.trazar(ctx, pl, base.slice(0, t + 1).map((v, m) => [m, v]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, propia.slice(0, t + 1).map((v, m) => [m, v]), C.s1, 3);
      adop.forEach((x) => { if (x <= t && x <= MES2) VIZ.marcador(ctx, pl.sx(x), pl.y0 - 8, C.s8, 5, 4); });
      if (t > 0 && t < MES2) VIZ.marcador(ctx, pl.sx(t), pl.sy(propia[t]), C.s1, 5);
      const fin = propia[Math.min(t, MES2)];
      const acum = propia.slice(0, t + 1).reduce((s, v) => s + v, 0);
      const perdida = propia.findIndex((v, m) => m > 0 && v < 0.25 * d0);
      const copiaron = adop.filter((x) => x <= t).length;
      lectura.set([
        ['ventaja actual', pct(fin)],
        ['ventaja relativa a la inicial', pct((fin / d0) * 100)],
        ['competidores que ya copiaron', `${copiaron} de ${COMP}`],
        ['ventaja acumulada', `${VIZ.fmt(acum, 4)} puntos·mes`],
        ['mes en que cae bajo ¼ de la inicial', perdida < 0 ? 'no cae' : `mes ${perdida}`],
        ['ventaja sostenida a 48 meses', propia[MES2] >= 0.5 * d0 ? 'sí' : 'no'],
      ]);
      registro.textContent = t === 0 ? `Mes 0: ventaja de costo de ${d0} %. Cada competidor tardará en promedio ${VIZ.fmt(2 + 22 * dif, 3)} meses en copiar el sistema. Pulse Reproducir.`
        : `Mes ${t}: ventaja ${pct(fin)}; ${copiaron} de ${COMP} competidores ya copiaron, pero como carecen de ${Math.round(comp * 100)} % de los complementos, solo capturan ${Math.round((1 - comp) * 100)} % del beneficio.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const m = Math.max(0, Math.min(t, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `mes <b>${m}</b>` + VIZ.filaTooltip(C.s1, 'su ventaja', pct(propia[m])) + VIZ.filaTooltip(C.apagado, 'si todos copian rápido', pct(base[m])) + `<br>competidores que copiaron: <b>${adop.filter((q) => q <= m).length}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recalcular();
  }

  VIZ.registrarTema('value-productivity', {
    intro: String.raw`
      <p>Un sistema de información genera <strong>valor</strong> cuando la organización produce más o mejor con los mismos recursos. La
      <strong>productividad</strong> es salida sobre entrada; la <strong>eficiencia</strong> mide cuánto se hace por recurso y la
      <strong>eficacia</strong>, cuánto de lo hecho sirve al objetivo. Un sistema que acelera un proceso equivocado es eficiente pero no eficaz.</p>
      <p>Ese valor se convierte en <strong>ventaja competitiva</strong> solo si los rivales no pueden copiarlo con facilidad. Una plataforma
      que todos pueden comprar mejora a todos por igual; la ventaja duradera viene de lo que sí es difícil de imitar, como procesos,
      datos propios y cultura de uso.</p>`,
    visualizaciones: [
      {
        titulo: 'Productividad, eficacia y retorno',
        descripcion: 'Un equipo de analistas procesa 700 casos al mes. Suba la capacitación y observe la caída del mes 1 y la recuperación por aprendizaje; baje la alineación del sistema y compare eficiencia con eficacia. Mire cómo cambian el VPN y el plazo de recuperación.',
        montar: montarProductividad,
      },
      {
        titulo: 'Ventaja competitiva y copia',
        descripcion: 'Un sistema reduce su costo unitario, pero cinco rivales intentan copiarlo. Compare tecnología comercial (se copia en meses) con una solución difícil de imitar y con complementos propios; la ventaja sostenida aparece cuando la copia es lenta o incompleta.',
        montar: montarVentaja,
      },
    ],
    teoria: String.raw`
      <h2>Productividad, eficiencia y eficacia</h2>
      <p>La productividad de un recurso es \(P = \dfrac{\text{salida}}{\text{entrada}}\). Para el proceso de resolución de casos:</p>
      \[ \text{eficiencia} = \frac{\text{casos resueltos}}{\text{horas}}, \qquad \text{eficacia} = \frac{\text{casos bien resueltos}}{\text{casos resueltos}}, \qquad P_{\text{efectiva}} = \text{eficiencia} \times \text{eficacia}. \]
      <p>Un sistema que duplica la velocidad pero pasa de 88 % a 78 % de aciertos mejora la eficiencia en 100 % y la eficacia cae
      \(78/88 - 1 \approx -11{,}4\,\%\): la productividad efectiva sube solo \(2 \cdot 0{,}886 - 1 \approx 77\,\%\). Medir una sola de las dos engaña.</p>
      <h2>Curva de aprendizaje</h2>
      <p>La ley de Wright dice que cada vez que se duplica la experiencia acumulada, el tiempo por unidad cae a una fracción \(r\) (la tasa de aprendizaje):</p>
      \[ h(m) = h_1\, m^{-b}, \qquad b = -\log_2 r. \]
      <p>Con \(r = 0{,}85\), \(b \approx 0{,}234\): en el mes 8 el tiempo es \(8^{-0{,}234} = 61\,\%\) del primer mes. En la figura el tiempo tiene un piso de 0,4 h, el límite tecnológico. La capacitación y la
      curva producen la típica <em>curva J</em> de productividad: primero cae y después supera el nivel inicial.</p>
      <h2>Valor financiero</h2>
      <p>Con flujos mensuales \(F_t\) y una tasa mensual \(i\), el valor presente neto y el plazo de recuperación son</p>
      \[ \text{VPN} = \sum_{t=0}^{T} \frac{F_t}{(1+i)^t}, \qquad \text{recuperación} = \min\{\, t : \textstyle\sum_{s \le t} F_s \ge 0 \,\}. \]
      <p>Aquí cada flujo mensual vale \(F_m = (\text{horas ahorradas}) \cdot 20 + (\text{errores evitados}) \cdot 15 - 1\,500\), con una inversión inicial en \(t = 0\). Si la
      alineación es baja, los errores adicionales pueden hacer negativo el flujo aunque se ahorren horas.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con 700 casos al mes y 0,8 h por caso, el trabajo manual usa 560 h. Si en el mes 12 el sistema baja a 0,56 h por caso, usa 392 h y ahorra 168 h, equivalentes a
      \(168 \cdot 20 = 3\,360\) por mes. Con 92 % de aciertos (alineación de 70 %) se evitan \(700 \cdot 0{,}04 = 28\) errores, es decir \(28 \cdot 15 = 420\). Tras licencias de 1 500 el flujo del mes 12 es
      \(3\,360 + 420 - 1\,500 = 2\,280\). Con una inversión de 60 000 y un mes 1 negativo por la capacitación, el flujo acumulado se vuelve positivo cerca del mes 30: el plazo de recuperación importa tanto como la tasa de aprendizaje.</p>
      <h2>Ventaja competitiva sostenida</h2>
      <p>Según la visión basada en recursos, un recurso genera ventaja sostenida si es valioso, raro, difícil de imitar y no sustituible. Un sistema
      comercial cumple solo lo primero. Si cada rival lo copia en un tiempo exponencial de media \(\tau\), la fracción de rivales que lo tiene en \(t\) es
      \(1 - e^{-t/\tau}\), y la ventaja del líder se reduce a</p>
      \[ A(t) = A_0\,\big(1 + g(1 - e^{-t/12})\big)\,\big(1 - (1-c)\,s(t)\big), \]
      <p>donde \(s(t)\) es la fracción de rivales que ya copió, \(c\) la parte del valor que depende de complementos propios y \(g\) el ritmo de mejora
      continua. Cuanto mayor es \(\tau\) o \(c\), más tarda la ventaja en desaparecer.</p>
      <div class="recuadro">La tecnología rara vez es la ventaja; lo es la forma en que la organización la integra a su trabajo.</div>
      <h2>Conexiones</h2>
      <p>El análisis económico de una inversión se completa en <a href="tema.html?id=it-investment-decisions">IT Investment Decisions</a>; los efectos sobre costos y diferenciación,
      en <a href="tema.html?id=competitive-strategies">Cost Leadership and Differentiation</a>; y la medición del impacto, en
      <a href="tema.html?id=project-impact-measurement">Measuring Technology Project Impact</a>.</p>`,
  });
})();
