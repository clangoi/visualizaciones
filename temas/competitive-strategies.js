(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: el plano costo–diferenciación ---------- */

  // Zonas del plano: x = costo unitario relativo (menor es mejor), y = diferenciación percibida.
  const ZC = { x0: 40, x1: 56, y0: 0, y1: 40 }, ZD = { x0: 40, x1: 100, y0: 62, y1: 100 };
  const ESTR = {
    costos: { n: 'Liderazgo en costos', col: C.s1, si: 'ERP, planificación de la demanda, automatización de procesos, compras electrónicas: cada peso de eficiencia se vuelve precio bajo o margen.' },
    dif: { n: 'Diferenciación', col: C.s7, si: 'CRM, análisis de datos de clientes, personalización, comercio electrónico y servicio posventa: conocer al cliente permite cobrar una prima.' },
    medio: { n: 'Atascada en el medio', col: C.apagado, si: 'Ningún SI lo arregla por sí solo: primero hay que decidir hacia qué polo moverse.' },
  };
  function clasificar(e) {
    let k = 'medio';
    if (e.y >= ZD.y0) k = 'dif'; else if (e.x <= ZC.x1 && e.y <= ZC.y1) k = 'costos';
    return k;
  }
  const distZona = (e, z) => Math.hypot(Math.max(z.x0 - e.x, 0, e.x - z.x1), Math.max(z.y0 - e.y, 0, e.y - z.y1));

  function montarPlano(cuerpo) {
    let E = [
      { n: 'Hipermercado Ahorro', x: 46, y: 20 }, { n: 'Aerolínea económica', x: 50, y: 12 }, { n: 'Boutique Aurora', x: 86, y: 86 },
      { n: 'Hotel Cumbre', x: 92, y: 78 }, { n: 'Cadena Intermedia', x: 68, y: 50 }, { n: 'Tienda de barrio', x: 78, y: 28 },
      { n: 'Café de especialidad', x: 74, y: 72, foco: true }, { n: 'Fábrica de repuestos', x: 52, y: 52 },
    ];
    let sel = 4, arrastre = false, pl = null;
    const ctl = VIZ.controles(cuerpo);
    const cFoco = ctl.casilla({ etiqueta: 'La empresa elegida atiende un segmento acotado (enfoque)', valor: false, alCambiar: (v) => { E[sel].foco = v; dibujar(); } });
    ctl.boton('Mover al polo más cercano', () => { const e = E[sel]; if (clasificar(e) === 'medio') { const z = distZona(e, ZC) <= distZona(e, ZD) ? ZC : ZD; e.x = Math.max(z.x0, Math.min(z.x1, e.x)) + (z === ZC ? -3 : 0); e.y = Math.max(z.y0, Math.min(z.y1, e.y)) + (z === ZD ? 4 : -3); e.x = Math.max(40, Math.min(100, e.x)); e.y = Math.max(0, Math.min(100, e.y)); dibujar(); } }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'zona de liderazgo en costos' }, { color: VIZ.alfa(C.s7, 0.2), borde: C.s7, texto: 'zona de diferenciación' },
      { color: C.apagado, texto: 'atascada en el medio' }, { color: C.superficie, borde: C.tinta, texto: 'con enfoque (anillo)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre una empresa por el plano o haga clic para elegirla. El color del punto es su estrategia efectiva; pruebe sacar a «Cadena Intermedia» del medio y vea qué sistemas la sostendrían en cada polo. La casilla de enfoque marca a quien atiende solo un nicho.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 40, xmax: 100, ymin: 0, ymax: 100 }, { etiquetaX: 'costo unitario relativo (menor = mejor)', etiquetaY: 'diferenciación percibida', formatoX: (v) => String(Math.round(v)) });
      pl.ejes();
      [[ZC, C.s1, 'costos'], [ZD, C.s7, 'diferenciación']].forEach(([z, col, t]) => {
        ctx.fillStyle = VIZ.alfa(col, 0.12); ctx.fillRect(pl.sx(z.x0), pl.sy(z.y1), pl.sx(z.x1) - pl.sx(z.x0), pl.sy(z.y0) - pl.sy(z.y1));
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, pl.sx(z.x0) + 4, pl.sy(z.y1) + 4);
      });
      ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('atascadas en el medio', pl.sx(78), pl.sy(50));
      E.forEach((e, i) => {
        const k = clasificar(e), col = ESTR[k].col, x = pl.sx(e.x), y = pl.sy(e.y);
        if (e.foco) { ctx.beginPath(); ctx.arc(x, y, 12, 0, 2 * Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.stroke(); }
        VIZ.marcador(ctx, x, y, col, i === sel ? 7 : 5.5);
        if (i === sel) { ctx.beginPath(); ctx.arc(x, y, 12 + (e.foco ? 4 : 0), 0, 2 * Math.PI); ctx.lineWidth = 1.5; ctx.strokeStyle = C.s2; ctx.stroke(); }
        ctx.font = VIZ.fuente(10, i === sel ? 700 : 400); ctx.fillStyle = C.tinta; ctx.textAlign = x > lienzo.ancho * 0.7 ? 'right' : 'left'; ctx.textBaseline = 'middle';
        if (lienzo.ancho > 480 || i === sel) ctx.fillText(e.n, x + (x > lienzo.ancho * 0.7 ? -12 : 12), y - (e.foco ? 10 : 0));
      });
      const e = E[sel], k = clasificar(e), est = ESTR[k];
      cFoco.valor = !!e.foco;
      const nombre = e.foco && k !== 'medio' ? `Enfoque en ${k === 'costos' ? 'costos' : 'diferenciación'}` : e.foco ? 'Atascada en el medio (aun con enfoque)' : est.n;
      const dc = distZona(e, ZC), dd = distZona(e, ZD);
      registro.textContent = `${e.n}: costo ${Math.round(e.x)}, diferenciación ${Math.round(e.y)} → ${nombre}. ${est.si}`;
      lectura.set([['empresa', e.n], ['estrategia', nombre], ['costo relativo', String(Math.round(e.x))], ['diferenciación', String(Math.round(e.y))], ['a la zona de costos', k === 'costos' ? 'dentro' : VIZ.fmt(dc, 3)], ['a la de diferenciación', k === 'dif' ? 'dentro' : VIZ.fmt(dd, 3)]]);
    }
    const buscar = (x, y) => { let m = -1, md = 16 * 16; E.forEach((e, i) => { const q = (pl.sx(e.x) - x) ** 2 + (pl.sy(e.y) - y) ** 2; if (q < md) { md = q; m = i; } }); return m; };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'grab'; lienzo.canvas.style.touchAction = 'none';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev), i = buscar(x, y); if (i >= 0) { sel = i; arrastre = true; lienzo.canvas.setPointerCapture(ev.pointerId); dibujar(); } });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = false; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastre) {
        const e = E[sel]; e.x = Math.max(40, Math.min(100, pl.ix(x))); e.y = Math.max(0, Math.min(100, pl.iy(y)));
        tip.ocultar(); return dibujar();
      }
      const i = buscar(x, y);
      if (i < 0) return tip.ocultar();
      const e = E[i];
      tip.mostrar(x, y, `<b>${e.n}</b><br>costo ${Math.round(e.x)} · diferenciación ${Math.round(e.y)}` + VIZ.filaTooltip(ESTR[clasificar(e)].col, ESTR[clasificar(e)].n, null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: simulación de márgenes ---------- */

  // Parámetros mensuales (miles de pesos): volumen V, precio P, costo variable v y costo fijo F.
  const FIRMAS = [
    { id: 'costos', n: 'Liderazgo en costos', col: C.s1, V: 450, P: 70, v: 45, F: 8000, guerra: 0.15, ev: 0.15, ef: 0.15, ep: 0.02, dv: 0 },
    { id: 'dif', n: 'Diferenciación', col: C.s2, V: 270, P: 140, v: 85, F: 9000, guerra: 0.05, ev: 0.05, ef: 0.05, ep: 0.12, dv: 0.1 },
    { id: 'medio', n: 'Atascada en el medio', col: C.s3, V: 240, P: 100, v: 70, F: 8500, guerra: 0.3, ev: 0.05, ef: 0.05, ep: 0.03, dv: 0 },
  ];
  const COSTO_TI = 600; // miles por mes por cada unidad de inversión en TI (eficiencia o datos)

  function montarMargenes(cuerpo) {
    let semilla = 1, g = 0.3, ef = 0.5, dt = 0.5, meses = 24, serie = [], hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Guerra de precios', min: 0, max: 1, paso: 0.05, valor: g, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { g = v; simular(); } });
    ctl.rango({ etiqueta: 'TI de eficiencia (ERP, automatización)', min: 0, max: 1, paso: 0.05, valor: ef, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ef = v; simular(); } });
    ctl.rango({ etiqueta: 'TI de clientes y datos (CRM, personalización)', min: 0, max: 1, paso: 0.05, valor: dt, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { dt = v; simular(); } });
    ctl.boton('Nueva simulación', () => { semilla++; simular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, FIRMAS.map((f) => ({ color: f.col, texto: f.n, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea es la utilidad acumulada en 24 meses de una empresa con esa estrategia. Suba la guerra de precios: la atascada, sin nada que defender, pierde primero. La TI de eficiencia favorece a quien compite por costo; la de datos, a quien diferencia. Pase el cursor para ver los valores de cada mes.');

    function parametros(f) {
      const P = f.P * (1 - f.guerra * g) * (1 + f.ep * dt), v = f.v * (1 - f.ev * ef), F = f.F * (1 - f.ef * ef) + COSTO_TI * (ef + dt), V = f.V * (1 + f.dv * dt);
      return { P, v, F, V };
    }
    function simular() {
      const rnd = VIZ.semilla(semilla * 131), comun = Array.from({ length: meses }, () => 0.06 * VIZ.normal(rnd));
      serie = FIRMAS.map((f) => {
        const q = parametros(f); let acum = 0, ing = 0;
        const acc = [0];
        for (let t = 0; t < meses; t++) {
          const V = q.V * (1 + comun[t] + 0.04 * VIZ.normal(rnd));
          acum += V * (q.P - q.v) - q.F; ing += V * q.P; acc.push(acum);
        }
        return { f, q, acc, ing, margen: acum / ing };
      });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = serie.flatMap((s) => s.acc), ymin = Math.min(0, ...todos), ymax = Math.max(1, ...todos);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: meses, ymin: ymin * 1.08, ymax: ymax * 1.08 }, { etiquetaX: 'mes', etiquetaY: 'utilidad acumulada (miles)', formatoY: (v) => VIZ.entero(v), margen: { izq: 64 } });
      pl.ejes();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0) + 0.5); ctx.lineTo(pl.x1, pl.sy(0) + 0.5); ctx.stroke();
      serie.forEach((s) => {
        VIZ.trazar(ctx, pl, s.acc.map((v, t) => [t, v]), s.f.col, 2);
        if (hover !== null) VIZ.marcador(ctx, pl.sx(hover), pl.sy(s.acc[hover]), s.f.col, 4);
      });
      if (hover !== null) { ctx.strokeStyle = C.tenue; ctx.beginPath(); ctx.moveTo(pl.sx(hover) + 0.5, pl.y1); ctx.lineTo(pl.sx(hover) + 0.5, pl.y0); ctx.stroke(); }
      const mejor = serie.reduce((m, s) => (s.acc[meses] > m.acc[meses] ? s : m), serie[0]);
      const peor = serie.reduce((m, s) => (s.acc[meses] < m.acc[meses] ? s : m), serie[0]);
      registro.textContent = `Tras ${meses} meses la mejor es «${mejor.f.n}» con ${VIZ.entero(mejor.acc[meses])} mil y la peor «${peor.f.n}» con ${VIZ.entero(peor.acc[meses])} mil. Unidad de utilidad mensual = volumen × (precio − costo variable) − costo fijo − TI.`;
      lectura.set(serie.flatMap((s) => [[`margen · ${s.f.n}`, pct(s.margen)]]).concat([['utilidad del mejor', `${VIZ.entero(mejor.acc[meses])} mil`], ['utilidad del peor', `${VIZ.entero(peor.acc[meses])} mil`]]));
    }
    lienzo.alDibujar = () => serie.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(meses, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `mes <b>${hover}</b>` + serie.map((s) => VIZ.filaTooltip(s.f.col, s.f.n, VIZ.entero(s.acc[hover]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (serie.length) dibujar(); });
    simular();
  }

  VIZ.registrarTema('competitive-strategies', {
    intro: String.raw`
      <p>Según Michael Porter, una empresa obtiene ventaja competitiva de dos maneras genéricas: ofreciendo lo mismo a menor <strong>costo</strong> (liderazgo en costos) o ofreciendo algo <strong>distinto</strong> por lo que el cliente paga más (diferenciación). Ambas pueden aplicarse a todo el mercado o a un segmento acotado, lo que se llama <em>enfoque</em>. La empresa que no logra ninguna queda «atascada en el medio»: sin la eficiencia del primero ni la prima del segundo.</p>
      <p>Los sistemas de información sostienen cada estrategia de manera distinta: los de eficiencia (ERP, automatización, compras electrónicas) abaratan; los de conocimiento del cliente (CRM, datos, personalización) permiten diferenciar y cobrar más. Elegir mal el sistema para la estrategia es una forma de desalinearse.</p>`,
    visualizaciones: [
      {
        titulo: 'Ubique empresas en el plano costo–diferenciación',
        descripcion: 'Arrastre las empresas y observe cómo cambia su estrategia efectiva y los sistemas que la sostienen. Saque a «Cadena Intermedia» del medio hacia cada polo y active el enfoque para ver cómo se redefine la etiqueta.',
        montar: montarPlano,
      },
      {
        titulo: 'Simulación de márgenes por estrategia',
        descripcion: 'Suba la guerra de precios y compare el margen de las tres estrategias en 24 meses; luego active la TI de eficiencia y la de datos por separado para ver a quién favorece cada una.',
        montar: montarMargenes,
      },
    ],
    teoria: String.raw`
      <h2>Estrategias genéricas</h2>
      <table>
        <tr><th>Estrategia</th><th>Fuente de ventaja</th><th>Sistemas que la sostienen</th><th>Riesgo</th></tr>
        <tr><td>Liderazgo en costos</td><td>Menor costo unitario por escala y eficiencia</td><td>ERP, automatización, compras y logística integradas</td><td>Imitación; el rival más barato gana la guerra de precios</td></tr>
        <tr><td>Diferenciación</td><td>Producto o servicio percibido como único</td><td>CRM, analítica, personalización, comercio electrónico</td><td>Que la prima supere lo que el cliente valora</td></tr>
        <tr><td>Enfoque</td><td>Conocer a fondo un nicho (en costos o en diferenciación)</td><td>Datos del segmento, canales digitales especializados</td><td>Que el nicho se vuelva pequeño o lo atienda una gran empresa</td></tr>
      </table>
      <h2>Modelo de margen de la simulación</h2>
      <p>La utilidad mensual de una empresa con volumen \(V\), precio \(P\), costo variable \(v\) y costo fijo \(F\) es</p>
      \[ U = V\,(P - v) - F - c_{TI}, \qquad \text{margen} = \frac{\sum_t U_t}{\sum_t V_t P}. \]
      <p>La escala favorece al líder en costos (\(V\) grande permite repartir \(F\)); la prima favorece al diferenciador (\(P - v\) grande aunque \(V\) sea menor). La empresa atascada tiene un volumen y un precio intermedios, pero sus costos no bajan: en la guerra de precios su \(P\) cae más rápido porque no tiene qué defender. Los parámetros (por ejemplo \(P = 70\) y \(v = 45\) para costos; \(P = 140\) y \(v = 85\) para diferenciación) son supuestos didácticos.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Sin guerra de precios ni TI, el líder en costos gana \(450 \times (70 - 45) - 8000 = 3250\) al mes, el diferenciador \(270 \times (140 - 85) - 9000 = 5850\) y la empresa atascada \(240 \times (100 - 70) - 8500 = -1300\): pierde aunque venda casi tanto como los otros.</p></div>
      <h2>Conexiones</h2>
      <p>La estrategia se apoya en las actividades de la <a href="tema.html?id=value-chain">cadena de valor</a> y en el equilibrio de las <a href="tema.html?id=five-forces">cinco fuerzas</a>. Para que los sistemas realmente la sostengan hace falta <a href="tema.html?id=strategic-alignment">alineamiento estratégico</a>, y su costo y retorno se calculan en <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>. Los sistemas citados se estudian en <a href="tema.html?id=erp-modules">ERP</a> y <a href="tema.html?id=crm">CRM</a>.</p>`,
  });
})();
