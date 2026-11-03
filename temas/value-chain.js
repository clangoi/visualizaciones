(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v, d = 3) => `${VIZ.fmt(v * 100, d)} %`;
  const mm = (v) => `$${VIZ.fmt(v, 4)} M`;

  // Distribuidora ficticia: ingreso anual y costo por actividad, en millones de pesos por año.
  const INGRESO = 1000;
  const ACT = [
    { n: 'Logística de entrada', et: ['Log.', 'entrada'], p: true, costo: 90, pot: 0.8 },
    { n: 'Operaciones', et: ['Opera-', 'ciones'], p: true, costo: 260, pot: 1 },
    { n: 'Logística de salida', et: ['Log.', 'salida'], p: true, costo: 110, pot: 0.9 },
    { n: 'Marketing y ventas', et: ['Ventas', 'y mkt'], p: true, costo: 120, pot: 0.6 },
    { n: 'Servicio', et: ['Servi-', 'cio'], p: true, costo: 60, pot: 0.7 },
    { n: 'Infraestructura de la empresa', et: ['Infra-', 'estruct.'], p: false, costo: 50, pot: 0.5 },
    { n: 'Gestión de recursos humanos', et: ['RR.HH.', ''], p: false, costo: 45, pot: 0.6 },
    { n: 'Desarrollo tecnológico', et: ['Tecno-', 'logía'], p: false, costo: 40, pot: 0.4 },
    { n: 'Aprovisionamiento', et: ['Apro-', 'visión'], p: false, costo: 35, pot: 0.9 },
  ];
  const COSTO_BASE = ACT.reduce((q, a) => q + a.costo, 0), MARGEN_BASE = INGRESO - COSTO_BASE;

  /* ---------- Fig. 1: dónde digitalizar ---------- */

  function montarDonde(cuerpo) {
    let efi = 0.3, si = 15, on = ACT.map((_, i) => i === 1), geo = [], hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Reducción de costo máxima del SI', min: 0.1, max: 0.5, paso: 0.05, valor: efi, formato: (v) => pct(v, 2), alCambiar: (v) => { efi = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo anual de cada SI', min: 2, max: 30, valor: si, formato: (v) => mm(v), alCambiar: (v) => { si = v; dibujar(); } });
    ctl.boton('Digitalizar la mejor', () => { const k = neto().reduce((m, v, i, a) => (v > a[m] ? i : m), 0); on = ACT.map((_, i) => i === k); dibujar(); }, { primario: true });
    ctl.boton('Todas las rentables', () => { const n = neto(); on = n.map((v) => v > 0); dibujar(); });
    ctl.boton('Limpiar', () => { on = ACT.map(() => false); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 290, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'actividad primaria' }, { color: C.s3, texto: 'actividad de apoyo' }, { color: C.s2, texto: 'costo anual del SI' },
      { color: C.s6, texto: 'margen' }, { color: C.apagado, texto: 'costo o margen antes del SI', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una actividad para instalar un sistema de información allí. Cada actividad tiene un potencial distinto de ahorro: el costo evitado es costo × reducción × potencial. Compare el ahorro con el costo del SI y vea qué pasa con el margen (última barra).');

    const ahorro = (i) => ACT[i].costo * efi * ACT[i].pot;
    const neto = () => ACT.map((_, i) => ahorro(i) - si);
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 8, inf = 44, sup = 18, n = ACT.length + 1, gw = (W - 2 * izq) / n, bw = Math.max(14, gw - 6), base = H - inf, ymax = 280;
      const sy = (v) => base - (v / ymax) * (base - sup);
      geo = [];
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - izq, base + 0.5); ctx.stroke();
      let costoNuevo = 0, sis = 0;
      ACT.forEach((a, i) => {
        const x = izq + i * gw + (gw - bw) / 2, activo = on[i], nuevo = a.costo - (activo ? ahorro(i) : 0), col = a.p ? C.s1 : C.s3;
        costoNuevo += nuevo + (activo ? si : 0); sis += activo ? si : 0;
        ctx.fillStyle = hover === i ? VIZ.alfa(col, 0.75) : col;
        ctx.beginPath(); ctx.roundRect(x, sy(nuevo), bw, base - sy(nuevo), activo ? 0 : [4, 4, 0, 0]); ctx.fill();
        if (activo) {
          ctx.fillStyle = C.s2; ctx.beginPath(); ctx.roundRect(x, sy(nuevo + si), bw, sy(nuevo) - sy(nuevo + si), [4, 4, 0, 0]); ctx.fill();
          ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, sy(a.costo), bw - 1, base - sy(a.costo)); ctx.restore();
        }
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        a.et.forEach((t, k) => ctx.fillText(t, x + bw / 2, base + 6 + k * 12));
        ctx.font = VIZ.fuente(10, activo ? 700 : 400); ctx.fillStyle = C.tinta; ctx.textBaseline = 'bottom';
        ctx.fillText(String(Math.round(activo ? nuevo + si : a.costo)), x + bw / 2, sy(activo ? nuevo + si : a.costo) - 2);
        geo.push({ x0: x, x1: x + bw, i });
      });
      const costoTot = costoNuevo, margenNuevo = INGRESO - costoTot, x = izq + ACT.length * gw + (gw - bw) / 2;
      ctx.fillStyle = C.s6; ctx.beginPath(); ctx.roundRect(x, sy(margenNuevo), bw, base - sy(margenNuevo), [4, 4, 0, 0]); ctx.fill();
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, sy(MARGEN_BASE), bw - 1, base - sy(MARGEN_BASE)); ctx.restore();
      ctx.font = VIZ.fuente(10, 700); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(String(Math.round(margenNuevo)), x + bw / 2, sy(Math.max(margenNuevo, MARGEN_BASE)) - 2);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'top'; ctx.fillText('Margen', x + bw / 2, base + 6);
      geo.push({ x0: x, x1: x + bw, i: -1 });
      const lista = ACT.filter((_, i) => on[i]).map((a) => a.n);
      const mejor = neto().reduce((m, v, i, a) => (v > a[m] ? i : m), 0);
      registro.textContent = lista.length
        ? `Con SI en ${lista.join(', ')}: costos ${mm(COSTO_BASE)} → ${mm(costoTot)} (incluye ${mm(sis)} de SI) y margen ${pct(MARGEN_BASE / INGRESO, 3)} → ${pct(margenNuevo / INGRESO, 3)}.`
        : `Sin SI: costos ${mm(COSTO_BASE)}, margen ${mm(MARGEN_BASE)} (${pct(MARGEN_BASE / INGRESO, 3)} del ingreso de ${mm(INGRESO)}). Haga clic en una actividad.`;
      lectura.set([
        ['margen antes', `${mm(MARGEN_BASE)} (${pct(MARGEN_BASE / INGRESO)})`],
        ['margen después', `${mm(margenNuevo)} (${pct(margenNuevo / INGRESO)})`],
        ['mejora', `${VIZ.fmt((margenNuevo - MARGEN_BASE) / INGRESO * 100, 3)} puntos`],
        ['SI instalados', String(lista.length)],
        ['mejor lugar', `${ACT[mejor].n} (${neto()[mejor] > 0 ? '+' : ''}${VIZ.fmt(neto()[mejor], 3)} M)`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const buscar = (x) => geo.find((q) => x >= q.x0 - 3 && x <= q.x1 + 3);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const q = buscar(lienzo.posicion(ev).x); if (q && q.i >= 0) { on[q.i] = !on[q.i]; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = buscar(x), h = q ? q.i : -1;
      if (h !== hover) { hover = h; dibujar(); }
      if (!q) return tip.ocultar();
      if (q.i < 0) return tip.mostrar(x, y, `<b>Margen</b><br>antes ${mm(MARGEN_BASE)}<br>ahora ${mm(INGRESO - ACT.reduce((s, a, i) => s + a.costo - (on[i] ? ahorro(i) : 0) + (on[i] ? si : 0), 0))}`);
      const a = ACT[q.i], minimo = si / (a.costo * a.pot);
      tip.mostrar(x, y, `<b>${a.n}</b> (${a.p ? 'primaria' : 'apoyo'})<br>costo ${mm(a.costo)} · potencial ${pct(a.pot, 2)}<br>ahorro posible ${mm(ahorro(q.i))}<br>costo del SI ${mm(si)}` + VIZ.filaTooltip(ahorro(q.i) > si ? C.s6 : C.s8, `neto ${ahorro(q.i) - si >= 0 ? '+' : ''}${VIZ.fmt(ahorro(q.i) - si, 3)} M`, null) + `<div>reducción mínima para pagarse: ${pct(minimo, 3)}</div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: cascada del margen ---------- */

  // Cada estrategia reduce una fracción del costo de varias actividades (con éxito de 100 %) y puede subir el ingreso.
  const ESTR = {
    oper: { nombre: 'Automatizar operaciones y logística (ERP, almacenes)', red: { 0: 0.15, 1: 0.25, 2: 0.15, 5: 0.08 }, ing: 0, si: 28 },
    cli: { nombre: 'Conocer al cliente (CRM y comercio electrónico)', red: { 3: 0.12, 4: 0.2 }, ing: 0.04, si: 22 },
    prov: { nombre: 'Integrar proveedores y distribución (SCM)', red: { 0: 0.2, 2: 0.12, 8: 0.25 }, ing: 0, si: 18 },
    todo: { nombre: 'Plataforma digital integral (las tres, con solapamiento)', red: { 0: 0.15, 1: 0.25, 2: 0.15, 3: 0.12, 4: 0.2, 5: 0.08, 8: 0.25 }, ing: 0.04, si: 60, f: 0.85 },
  };

  function montarCascada(cuerpo) {
    let clave = 'oper', exito = 0.6, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia de TI', opciones: Object.entries(ESTR).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Éxito de la implementación', min: 0.2, max: 1.2, paso: 0.05, valor: exito, formato: (v) => pct(v, 3), alCambiar: (v) => { exito = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (ACT.length + 3) * 26 + 34 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'ingreso' }, { color: C.s1, texto: 'costo primario' }, { color: C.s3, texto: 'costo de apoyo' },
      { color: C.s2, texto: 'costo del SI' }, { color: C.s6, texto: 'margen' }, { color: C.apagado, texto: 'posición antes del SI', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Es una cascada: del ingreso se restan los costos de cada actividad hasta llegar al margen. Los contornos punteados muestran dónde estaba cada barra antes. Baje el éxito de la implementación hasta que el margen vuelva a ser el original: ese es el punto de equilibrio de la estrategia.');

    function calcular() {
      const e = ESTR[clave], f = e.f || 1;
      const nuevo = ACT.map((a, i) => a.costo * (1 - (e.red[i] || 0) * f * exito));
      const ingreso = INGRESO * (1 + e.ing * exito);
      const aporte = INGRESO * e.ing + ACT.reduce((q, a, i) => q + a.costo * (e.red[i] || 0) * f, 0);
      return { nuevo, ingreso, margen: ingreso - nuevo.reduce((q, v) => q + v, 0) - e.si, si: e.si, minimo: e.si / aporte };
    }
    function dibujar() {
      const r = calcular(), { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = W < 520 ? 118 : 190, der = 14, fh = 26, x0 = izq, xs = (v) => x0 + (v / (INGRESO * 1.06)) * (W - x0 - der);
      const filas = [['Ingreso', null]].concat(ACT.map((a) => [a.n, a])).concat([['Costo del SI', 'si'], ['Margen', 'm']]);
      geo = [];
      let cursor = r.ingreso, cursor0 = INGRESO;
      filas.forEach(([nombre, a], k) => {
        const y = 6 + k * fh;
        let ini, fin, col, ini0 = null, fin0 = null;
        if (k === 0) { ini = 0; fin = r.ingreso; col = C.tinta; ini0 = 0; fin0 = INGRESO; }
        else if (a === 'm') { ini = 0; fin = r.margen; col = C.s6; ini0 = 0; fin0 = MARGEN_BASE; }
        else if (a === 'si') { ini = cursor - r.si; fin = cursor; col = C.s2; cursor = ini; ini0 = cursor0; fin0 = cursor0; }
        else { const i = k - 1; ini = cursor - r.nuevo[i]; fin = cursor; col = a.p ? C.s1 : C.s3; cursor = ini; ini0 = cursor0 - a.costo; fin0 = cursor0; cursor0 = ini0; }
        ctx.font = VIZ.fuente(W < 520 ? 10 : 11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        let txt = nombre; while (ctx.measureText(txt).width > izq - 10 && txt.length > 4) txt = txt.slice(0, -2);
        ctx.fillText(txt === nombre ? nombre : txt + '…', izq - 8, y + fh / 2 - 2);
        if (ini0 !== null && !(a === 'si')) { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.strokeRect(xs(ini0) + 0.5, y + 2.5, xs(fin0) - xs(ini0) - 1, fh - 9); ctx.restore(); }
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(xs(ini), y + 3, Math.max(2, xs(fin) - xs(ini)), fh - 10, 3); ctx.fill();
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(fin - ini, 4), Math.max(xs(fin), xs(fin0 || 0)) + 5, y + fh / 2 - 2);
        geo.push({ y0: y, y1: y + fh, nombre, valor: fin - ini, antes: a === 'si' ? 0 : fin0 - ini0 });
      });
      registro.textContent = `${ESTR[clave].nombre}: margen ${mm(MARGEN_BASE)} (${pct(MARGEN_BASE / INGRESO)}) → ${mm(r.margen)} (${pct(r.margen / r.ingreso)}) con éxito de ${pct(exito, 3)}. Necesita al menos ${pct(r.minimo, 3)} de éxito para recuperar su propio costo de ${mm(r.si)}.`;
      lectura.set([['ingreso', mm(r.ingreso)], ['costos sin SI', mm(r.nuevo.reduce((q, v) => q + v, 0))], ['costo del SI', mm(r.si)], ['margen nuevo', mm(r.margen)], ['cambio de margen', `${r.margen >= MARGEN_BASE ? '+' : ''}${VIZ.fmt((r.margen / r.ingreso - MARGEN_BASE / INGRESO) * 100, 3)} puntos`], ['éxito mínimo', pct(r.minimo, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = geo.find((t) => y >= t.y0 && y < t.y1);
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, `<b>${q.nombre}</b><br>ahora ${mm(q.valor)}` + (q.nombre !== 'Costo del SI' ? `<br>antes ${mm(q.antes)}` : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('value-chain', {
    intro: String.raw`
      <p>La <strong>cadena de valor</strong> de Michael Porter descompone una empresa en las actividades que agregan valor a lo que vende. Las <em>primarias</em> llevan el producto del proveedor al cliente (logística de entrada, operaciones, logística de salida, marketing y ventas, servicio); las de <em>apoyo</em> las hacen posibles (infraestructura, recursos humanos, desarrollo tecnológico, aprovisionamiento). Lo que queda del ingreso después de pagar todas las actividades es el <em>margen</em>.</p>
      <p>Para un sistema de información la pregunta útil es dónde conviene instalarlo: no donde la tecnología es más vistosa, sino donde el costo evitado o el ingreso adicional supera el costo del propio sistema.</p>`,
    visualizaciones: [
      {
        titulo: 'Dónde instalar un sistema de información',
        descripcion: 'Haga clic en las actividades de una distribuidora ficticia y vea cómo cambian sus costos y el margen. Pruebe «Digitalizar la mejor», suba el costo del SI hasta que servicio o infraestructura dejen de convenir y compare con operaciones.',
        montar: montarDonde,
      },
      {
        titulo: 'Cascada del margen según la estrategia de TI',
        descripcion: 'Elija una estrategia (automatizar, conocer al cliente, integrar proveedores o una plataforma completa) y baje el éxito de la implementación hasta encontrar el punto en que el margen vuelve a ser el de partida.',
        montar: montarCascada,
      },
    ],
    teoria: String.raw`
      <h2>Actividades primarias y de apoyo</h2>
      <p>Porter define el <strong>margen</strong> como la diferencia entre el valor total que el cliente paga y el costo colectivo de realizar las actividades de valor:</p>
      \[ M = I - \sum_{i=1}^{9} c_i, \qquad m = \frac{M}{I}. \]
      <p>Primarias: logística de entrada (recibir y almacenar insumos), operaciones (transformarlos), logística de salida (distribuir), marketing y ventas, y servicio posterior a la venta. De apoyo: infraestructura de la empresa (finanzas, legal, planificación), gestión de recursos humanos, desarrollo tecnológico y aprovisionamiento (compras). La cadena de una empresa se conecta con las de sus proveedores y clientes en el <em>sistema de valor</em>.</p>
      <h2>Valor de un sistema de información en una actividad</h2>
      <p>Un SI en la actividad \(i\) con eficacia \(e\) y potencial \(\pi_i\) (qué parte del costo es automatizable o evitable) cambia el margen en</p>
      \[ \Delta M_i = c_i\, e\, \pi_i - s, \qquad e^{*}_i = \frac{s}{c_i\,\pi_i}, \]
      <p>donde \(s\) es el costo anual del sistema y \(e^{*}_i\) la reducción mínima para que se pague. Para estrategias que también suben el ingreso en una fracción \(g\), el éxito mínimo es \(\varepsilon^{*} = s / (g I + \sum_i c_i \rho_i)\) con \(\rho_i\) la reducción de la actividad \(i\) al 100 % de éxito.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Ingreso \(I = 1000\) y costos que suman 810: el margen es \(190\), es decir 19 %. Un sistema de planificación en operaciones (\(c = 260\), \(\pi = 1\)) con \(e = 30\,\%\) ahorra \(78\) y cuesta \(15\): el margen sube de \(190\) a \(253\), es decir, de 19 % a 25,3 % del ingreso. En servicio (\(c = 60\), \(\pi = 0{,}7\)) el ahorro es \(12{,}6\), menor que los \(15\) del sistema: el margen empeora en \(2{,}4\).</p></div>
      <h2>Dónde la TI suele agregar más valor</h2>
      <ul>
        <li>En actividades de alto costo y repetitivas (operaciones, logística), por automatización y trazabilidad.</li>
        <li>En los eslabones donde la información cruza fronteras: entre proveedores y almacén, o entre venta y servicio (véanse <a href="tema.html?id=erp-modules">ERP</a>, <a href="tema.html?id=crm">CRM</a> y <a href="tema.html?id=scm">gestión de la cadena de suministro</a>).</li>
        <li>En el desarrollo tecnológico y el aprovisionamiento cuando abre nuevos productos o reduce el costo de transacción.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>La cadena de valor es el insumo de las <a href="tema.html?id=competitive-strategies">estrategias competitivas</a> (reducir costos o diferenciar actividades) y se complementa con las <a href="tema.html?id=five-forces">cinco fuerzas</a>, que miran la industria. La decisión de invertir se formaliza con VPN y TIR en <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>.</p>`,
  });
})();
