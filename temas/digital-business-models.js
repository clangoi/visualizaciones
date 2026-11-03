(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => (v < 0 ? '−' : '') + '$' + VIZ.fmt(Math.abs(v), 4);
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: economía unitaria ---------- */

  function montarUnitaria(cuerpo) {
    const MESES = 36;
    const P = { arpu: 30, m: 0.7, ch: 0.05, cac: 150 };
    let pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ingreso mensual por cliente (ARPU)', min: 5, max: 100, paso: 5, valor: P.arpu, formato: dinero, alCambiar: (v) => { P.arpu = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Margen bruto', min: 0.3, max: 0.95, paso: 0.05, valor: P.m, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { P.m = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Cancelación mensual (churn)', min: 0.01, max: 0.15, paso: 0.005, valor: P.ch, formato: pct, alCambiar: (v) => { P.ch = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de adquirir un cliente (CAC)', min: 10, max: 500, paso: 10, valor: P.cac, formato: dinero, alCambiar: (v) => { P.cac = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.48, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'margen acumulado esperado por cliente adquirido', forma: 'linea' },
      { color: C.s8, texto: 'CAC (lo que costó conseguirlo)', forma: 'linea' },
      { color: C.s6, texto: 'LTV: valor de por vida', forma: 'linea' },
      { color: C.tinta, texto: 'mes de recuperación', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La curva sube menos cada mes porque los clientes se van. Suba el churn o el CAC y observe cómo se alarga la recuperación; si el CAC supera el LTV, el crecimiento destruye valor. Pase el cursor para leer cada mes.');

    const acum = (t) => (P.arpu * P.m * (1 - (1 - P.ch) ** t)) / P.ch;
    const ltv = () => (P.arpu * P.m) / P.ch;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const L = ltv(), ymax = Math.max(L, P.cac, acum(MESES)) * 1.12;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: 0, ymax }, { etiquetaX: 'mes desde la compra', etiquetaY: 'por cliente', formatoY: dinero });
      pl.ejes();
      const linea = (v, c) => { ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(v)); ctx.lineTo(pl.x1, pl.sy(v)); ctx.stroke(); ctx.restore(); };
      linea(P.cac, C.s8); linea(L, C.s6);
      VIZ.trazar(ctx, pl, Array.from({ length: MESES + 1 }, (_, t) => [t, acum(t)]), C.s1, 3);
      const rec = P.cac < L ? Math.log(1 - (P.cac * P.ch) / (P.arpu * P.m)) / Math.log(1 - P.ch) : null;
      if (rec !== null && rec <= MESES) VIZ.marcador(ctx, pl.sx(rec), pl.sy(P.cac), C.tinta, 6);
      if (hover >= 0) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); VIZ.marcador(ctx, pl.sx(hover), pl.sy(acum(hover)), C.s1, 4.5); }
      const r = L / P.cac;
      registro.textContent = `LTV = ARPU × margen / churn = ${dinero(P.arpu)} × ${Math.round(P.m * 100)} % / ${pct(P.ch)} = ${dinero(L)}. Cada cliente vive en promedio ${VIZ.fmt(1 / P.ch, 3)} meses. LTV / CAC = ${VIZ.fmt(r, 3)}.`;
      lectura.set([
        ['LTV', dinero(L)],
        ['LTV / CAC (sano ≥ 3)', VIZ.fmt(r, 3)],
        ['recuperación del CAC', rec === null ? 'nunca' : rec > MESES ? `más de ${MESES} meses` : `${VIZ.fmt(rec, 3)} meses`],
        ['vida media', `${VIZ.fmt(1 / P.ch, 3)} meses`],
        ['retención a 12 meses', pct((1 - P.ch) ** 12)],
        ['margen mensual por cliente', dinero(P.arpu * P.m)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(MESES, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `mes <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'margen acumulado', dinero(acum(hover))) + VIZ.filaTooltip(C.s8, 'CAC', dinero(P.cac)) + `clientes que siguen <b>${pct((1 - P.ch) ** hover)}</b><br>saldo <b>${dinero(acum(hover) - P.cac)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: tres modelos de ingreso ---------- */

  const MODELOS = [
    { id: 'sub', n: 'Suscripción', c: C.s1 },
    { id: 'free', n: 'Freemium', c: C.s2 },
    { id: 'com', n: 'Comisión', c: C.s3 },
  ];
  const METRICAS = { ing: 'Ingreso mensual', mar: 'Margen acumulado (después de CAC y costos)', usr: 'Usuarios activos' };

  function montarModelos(cuerpo) {
    const MESES = 36;
    const P = { N: 100, p: 30, ch: 0.05, cac: 60, k: 4, q: 0.03, g: 400, tau: 0.08 };
    const CS = 3, CHF = 0.1; // costo de servir por usuario; abandono del plan gratuito
    let semilla = 1, metrica = 'ing', res = null, pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Mostrar', opciones: Object.entries(METRICAS), valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    const cfg = (clave, etiqueta, min, max, paso, formato) => ctl.rango({ etiqueta, min, max, paso, valor: P[clave], formato, alCambiar: (v) => { P[clave] = v; calcular(); } });
    cfg('N', 'Usuarios nuevos al mes (suscripción)', 20, 300, 10, (v) => String(v));
    cfg('ch', 'Cancelación mensual', 0.01, 0.15, 0.005, pct);
    cfg('q', 'Conversión freemium a pago (por mes)', 0.005, 0.08, 0.005, pct);
    cfg('tau', 'Comisión sobre lo transado', 0.02, 0.2, 0.01, (v) => `${Math.round(v * 100)} %`);
    ctl.boton('Otro escenario', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.48, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, MODELOS.map((m) => ({ color: m.c, texto: m.n, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Supuestos: precio $30 al mes, costo de servir $3 por usuario pagado ($1,2 si es gratuito), CAC de $60 (el plan gratuito atrae ×4 usuarios a 30 % del CAC) y gasto de $400 al mes por usuario en la comisión. El número de altas varía al azar un ±20 %. Cambie de métrica: el ingreso, el margen acumulado y los usuarios cuentan historias distintas.');

    function calcular() {
      const rnd = VIZ.semilla(semilla * 313 + 9), { N, p, ch, cac, k, q, g, tau } = P;
      let S = 0, F = 0, Pg = 0, U = 0, ms = 0, mf = 0, mc = 0;
      res = [{ ing: [0, 0, 0], mar: [0, 0, 0], usr: [0, 0, 0] }];
      for (let t = 1; t <= MESES; t++) {
        const ruido = 0.8 + 0.4 * rnd();
        const nS = N * ruido, nF = N * k * ruido, nU = N * ruido;
        S = S * (1 - ch) + nS;
        const conv = q * F;
        F = F * (1 - CHF - q) + nF; Pg = Pg * (1 - ch) + conv;
        U = U * (1 - ch) + nU;
        const ing = [S * p, Pg * p, U * g * tau];
        ms += ing[0] - S * CS - nS * cac; mf += ing[1] - Pg * CS - F * CS * 0.4 - nF * cac * 0.3; mc += ing[2] - U * CS - nU * cac;
        res.push({ ing, mar: [ms, mf, mc], usr: [S, Pg + F, U] });
      }
      dibujar();
    }
    const fm = (v) => (metrica === 'usr' ? VIZ.entero(v) : dinero(v));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = res.flatMap((r) => r[metrica]);
      const lo = Math.min(0, ...todos), hi = Math.max(1, ...todos);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: lo * 1.08, ymax: hi * 1.08 }, { etiquetaX: 'mes', etiquetaY: METRICAS[metrica].split(' (')[0].toLowerCase(), formatoY: fm });
      pl.ejes();
      MODELOS.forEach((m, i) => VIZ.trazar(ctx, pl, res.map((r, t) => [t, r[metrica][i]]), m.c, 2.5));
      if (hover >= 0) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); MODELOS.forEach((m, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(res[hover][metrica][i]), m.c, 4)); }
      const u = res[MESES];
      const mejor = u.mar.indexOf(Math.max(...u.mar));
      registro.textContent = `A los ${MESES} meses el margen acumulado es ${u.mar.map((v, i) => `${MODELOS[i].n} ${dinero(v)}`).join(', ')}. ${MODELOS[mejor].n} lidera.`;
      lectura.set([
        ['ingreso mensual (suscripción)', dinero(u.ing[0])],
        ['ingreso mensual (freemium)', dinero(u.ing[1])],
        ['ingreso mensual (comisión)', dinero(u.ing[2])],
        ['usuarios (sus. / free / com.)', u.usr.map((v) => VIZ.entero(v)).join(' / ')],
        ['de los usuarios freemium, de pago', pct(u.usr[1] ? (u.ing[1] / P.p) / u.usr[1] : 0)],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(MESES, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `mes <b>${hover}</b>` + MODELOS.map((m, i) => VIZ.filaTooltip(m.c, m.n, fm(res[hover][metrica][i]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('digital-business-models', {
    intro: String.raw`
      <p>Un <strong>modelo de negocio digital</strong> describe cómo una organización crea, entrega y captura valor usando datos y plataformas. Lo que cambia respecto de vender un producto es la relación con el cliente: en vez de una venta única hay una experiencia continua, medida en cada uso, que se puede mejorar y cobrar de otras formas, como una cuota mensual, un plan gratuito que se convierte en pago o una comisión sobre lo que ocurre en la plataforma.</p>
      <p>Para comparar modelos hay que mirar su <strong>economía unitaria</strong>: cuánto cuesta conseguir un cliente (CAC), cuánto deja en toda su vida (LTV) y en cuánto tiempo se recupera lo gastado. Las figuras muestran ambas cosas: una cuenta por cliente y una simulación de ingresos de tres modelos a lo largo de tres años.</p>`,
    visualizaciones: [
      {
        titulo: 'Economía unitaria: CAC, LTV y recuperación',
        descripcion: 'Mueva el churn y el CAC y mire cuándo la curva azul cruza la línea roja. Busque el punto en que LTV / CAC cae bajo 3, donde el crecimiento deja de ser rentable.',
        montar: montarUnitaria,
      },
      {
        titulo: 'Suscripción, freemium y comisión',
        descripcion: 'Compare los tres modelos en ingreso, margen acumulado y usuarios. Pruebe subir la conversión freemium o bajar la comisión y vea cuál modelo es más sensible a cada parámetro.',
        montar: montarModelos,
      },
    ],
    teoria: String.raw`
      <h2>Economía unitaria</h2>
      <p>Si un cliente paga \(\text{ARPU}\) al mes, con margen bruto \(m\) y probabilidad mensual de cancelar \(c\), su permanencia esperada es \(1/c\) meses y el valor de por vida es</p>
      \[ \text{LTV} = \frac{\text{ARPU}\cdot m}{c} . \]
      <p>El margen acumulado esperado tras \(t\) meses es \(\text{ARPU}\cdot m\,\dfrac{1-(1-c)^t}{c}\); el CAC se recupera cuando esa cantidad lo iguala:</p>
      \[ t_{\text{rec}} = \frac{\ln\!\big(1 - \text{CAC}\cdot c/(\text{ARPU}\cdot m)\big)}{\ln(1-c)} , \]
      <p>posible solo si \(\text{LTV} &gt; \text{CAC}\). Como regla práctica, \(\text{LTV}/\text{CAC} \ge 3\) y recuperación bajo 12 meses.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> ARPU 30, margen 70 %, churn 5 %, CAC 150: LTV = \(30\cdot 0{,}7/0{,}05 = 420\); LTV/CAC = 2,8 (algo débil). Recuperación: \(\ln(1 - 150\cdot 0{,}05/21)/\ln(0{,}95) = \ln(0{,}643)/\ln(0{,}95) \approx 8{,}6\) meses. Si el churn sube a 10 %, LTV = 210 y LTV/CAC = 1,4: se recupera en \(\ln(1-0{,}714)/\ln 0{,}9 \approx 11{,}9\) meses y casi no se gana nada.</p></div>
      <h2>Tres modelos de ingreso</h2>
      <table>
        <tr><th>Modelo</th><th>Cómo gana</th><th>Fortaleza</th><th>Riesgo</th></tr>
        <tr><td>Suscripción</td><td>cuota periódica</td><td>ingreso previsible</td><td>churn: hay que renovar el valor cada mes</td></tr>
        <tr><td>Freemium</td><td>plan gratis y una fracción paga</td><td>adquisición barata y viral</td><td>costo de servir a quienes nunca pagan</td></tr>
        <tr><td>Comisión</td><td>porcentaje de cada transacción</td><td>crece con la actividad de la plataforma</td><td>depende de la masa crítica (ver <a href="tema.html?id=platforms-network-effects">plataformas</a>)</td></tr>
      </table>
      <p>En la simulación, con altas \(a\), cancelación \(c\), conversión \(q\) y abandono gratuito \(c_f\), los usuarios siguen \(S_{t+1} = (1-c)S_t + a\) en suscripción, \(F_{t+1} = (1-c_f-q)F_t + k a\) y \(P_{t+1} = (1-c)P_t + qF_t\) en freemium. En el estado estable \(S^{*} = a/c\) y \(P^{*} = qF^{*}/c\). La experiencia del cliente es lo que mueve \(c\) y \(q\): por eso se conecta con los <a href="tema.html?id=five-digital-domains">cinco dominios</a> (clientes y valor), con los <a href="tema.html?id=kpi-fundamentals">indicadores de gestión</a> y con <a href="tema.html?id=digitization-vs-transformation">la transformación del negocio</a>.</p>`,
  });
})();
