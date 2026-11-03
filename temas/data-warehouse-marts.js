(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const nombreMes = (m) => `${MESES[m % 12]} ${2023 + Math.floor(m / 12)}`;
  const dinero = (v) => `$${VIZ.entero(v)}`;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: un almacén que acumula historia ---------- */

  function montarCarga(cuerpo) {
    let semilla = 1, mes = 0, ventana = 3, datos = [], cnt = [], ing = [], hover = 0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Meses que conserva el sistema operativo', min: 1, max: 12, valor: ventana, alCambiar: (v) => { ventana = v; dibujar(); } });
    const srcs = ctl.casillas([
      { clave: 'Tienda', texto: 'Sistema de tiendas', color: C.s1 }, { clave: 'Web', texto: 'Comercio electrónico', color: C.s2 },
    ], () => dibujar());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'almacén: filas de tiendas' }, { color: C.s2, texto: 'almacén: filas de la web' },
      { color: C.tinta, texto: 'sistema operativo (ventana móvil)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso carga un mes de ventas al almacén. Apague una fuente para ver un almacén incompleto, y acorte la ventana del sistema operativo: el almacén crece, el operativo no. Pase el cursor sobre un mes para ver los detalles.');

    function iniciar() {
      datos = S.ventas(semilla, 24, 14);
      cnt = Array.from({ length: 24 }, () => ({ Tienda: 0, Web: 0 }));
      ing = Array.from({ length: 24 }, () => ({ Tienda: 0, Web: 0 }));
      for (const f of datos) { cnt[f.mes][f.canal]++; ing[f.mes][f.canal] += f.ingreso; }
      mes = 0;
      return (function* () { for (let k = 1; k <= 24; k++) { mes = k; yield; } })();
    }
    const activas = () => ['Tienda', 'Web'].filter((c) => srcs[c]);
    const filasAlm = (k, c) => (srcs[c] ? cnt.slice(0, k).reduce((s, x) => s + x[c], 0) : 0);
    const filasOp = (k) => activas().reduce((s, c) => s + cnt.slice(Math.max(0, k - ventana), k).reduce((t, x) => t + x[c], 0), 0);
    const ingMes = (m) => activas().reduce((s, c) => s + ing[m][c], 0);

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tope = Math.max(10, ...[...Array(24).keys()].map((k) => cnt.slice(0, k + 1).reduce((s, x) => s + x.Tienda + x.Web, 0))) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: 24.5, ymin: 0, ymax: tope }, { etiquetaX: 'mes cargado', etiquetaY: 'filas de hechos', ticksX: [1, 6, 12, 18, 24], formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      const w = pl.sx(1) - pl.sx(0) - 2;
      for (let k = 1; k <= mes; k++) {
        const t = filasAlm(k, 'Tienda'), wb = filasAlm(k, 'Web'), x = pl.sx(k) - w / 2;
        if (t) { ctx.fillStyle = C.s1; ctx.fillRect(x, pl.sy(t), w, pl.y0 - pl.sy(t)); }
        if (wb) { ctx.fillStyle = C.s2; ctx.beginPath(); ctx.roundRect(x, pl.sy(t + wb), w, pl.sy(t) - pl.sy(t + wb), [4, 4, 0, 0]); ctx.fill(); }
        if (k === hover) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(x, pl.sy(t + wb), w, pl.y0 - pl.sy(t + wb)); }
      }
      if (mes) VIZ.trazar(ctx, pl, Array.from({ length: mes }, (_, i) => [i + 1, filasOp(i + 1)]), C.tinta, 2.5);
      const ya = filasAlm(mes, 'Tienda') + filasAlm(mes, 'Web');
      const interanual = mes > 12 && ingMes(mes - 13) > 0 ? ingMes(mes - 1) / ingMes(mes - 13) - 1 : null;
      registro.textContent = !mes ? 'El almacén está vacío. Cada paso carga un mes completo desde las fuentes activas.'
        : `Se cargó ${nombreMes(mes - 1)}: ${activas().reduce((s, c) => s + cnt[mes - 1][c], 0)} filas nuevas. ` +
          `El almacén conserva todo (${VIZ.entero(ya)} filas); el sistema operativo solo los últimos ${ventana} meses (${VIZ.entero(filasOp(mes))}). ` +
          (mes > 12 ? 'Con más de 12 meses de historia ya se puede comparar contra el mismo mes del año anterior.' : `Faltan ${13 - mes} meses para poder comparar contra el mismo mes del año anterior.`);
      lectura.set([
        ['meses cargados', String(mes)],
        ['filas en el almacén', VIZ.entero(ya)],
        ['filas en el sistema operativo', VIZ.entero(filasOp(mes))],
        ['ingreso acumulado', dinero(Array.from({ length: mes }, (_, m) => ingMes(m)).reduce((s, v) => s + v, 0))],
        ['variación interanual del último mes', interanual === null ? 'sin historia' : pct(interanual).replace('-', '−')],
        ['fuentes activas', activas().join(' + ') || 'ninguna'],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = pl ? Math.round(pl.ix(x)) : 0;
      if (!pl || !pl.dentro(x, y) || k < 1 || k > mes) { if (hover) { hover = 0; dibujar(); } return tip.ocultar(); }
      if (k !== hover) { hover = k; dibujar(); }
      tip.mostrar(x, y, `<b>${nombreMes(k - 1)}</b>` + VIZ.filaTooltip(C.s1, 'tiendas (acum.)', VIZ.entero(filasAlm(k, 'Tienda'))) +
        VIZ.filaTooltip(C.s2, 'web (acum.)', VIZ.entero(filasAlm(k, 'Web'))) + VIZ.filaTooltip(C.tinta, 'operativo', VIZ.entero(filasOp(k))) + `ingreso del mes <b>${dinero(ingMes(k - 1))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = 0; tip.ocultar(); if (datos.length) dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: esquema estrella y data marts ---------- */

  const DIMS = [
    { k: 'tiempo', n: 'Tiempo', atr: 'mes › trimestre › año', campo: { mes: 'tmes', trim: 'ttrim', anio: 'tanio' } },
    { k: 'region', n: 'Región', atr: 'región', campo: 'region' },
    { k: 'producto', n: 'Producto', atr: 'producto', campo: 'producto' },
    { k: 'canal', n: 'Canal', atr: 'canal', campo: 'canal' },
  ];
  const CARD = { mes: 24, trim: 8, anio: 2, region: 3, producto: 3, canal: 2 };
  const PRESETS = {
    comercial: { n: 'Comercial: región × producto × mes', tiempo: 'mes', region: true, producto: true, canal: false, soloWeb: false },
    finanzas: { n: 'Finanzas: producto × trimestre', tiempo: 'trim', region: false, producto: true, canal: false, soloWeb: false },
    web: { n: 'Comercio electrónico: producto × mes (solo web)', tiempo: 'mes', region: false, producto: true, canal: false, soloWeb: true },
    gerencia: { n: 'Gerencia: región × año', tiempo: 'anio', region: true, producto: false, canal: false, soloWeb: false },
  };

  function montarEstrella(cuerpo) {
    const hechos = S.ventas(1, 24, 14).map((r) => ({ ...r, tmes: `${r.anio}-${String(r.mes % 12 + 1).padStart(2, '0')}`, ttrim: `${r.anio}-T${r.trim}`, tanio: String(r.anio) }));
    const sel = { tiempo: 'mes', region: true, producto: true, canal: false, soloWeb: false };
    let cajas = [];
    const ctl = VIZ.controles(cuerpo);
    const sPre = ctl.selector({ etiqueta: 'Data mart', opciones: [['personal', 'Personalizado'], ...Object.entries(PRESETS).map(([k, v]) => [k, v.n])], valor: 'comercial', alCambiar: (v) => { if (v !== 'personal') { Object.assign(sel, PRESETS[v]); sNiv.valor = sel.tiempo; dibujar(); } } });
    const sNiv = ctl.selector({ etiqueta: 'Nivel de tiempo', opciones: [['mes', 'mes'], ['trim', 'trimestre'], ['anio', 'año']], valor: 'mes', alCambiar: (v) => { sel.tiempo = v; sPre.valor = 'personal'; dibujar(); } });
    ctl.boton('Restablecer', () => { Object.assign(sel, PRESETS.comercial); sPre.valor = 'comercial'; sNiv.valor = sel.tiempo; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 262 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'dimensión incluida en el mart' }, { color: C.inactivo, texto: 'dimensión que el mart no usa' }, { color: C.tinta, texto: 'tabla de hechos' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una dimensión del esquema para incluirla o quitarla del data mart (con «Nivel de tiempo» cambia la granularidad del tiempo). La tabla muestra las primeras filas del mart; la suma de ingresos no cambia al agregar, solo el número de filas.');

    const camposActivos = () => DIMS.filter((d) => (d.k === 'tiempo' ? sel.tiempo && sel.incluyeTiempo !== false && sel.tiempo !== 'ninguno' : sel[d.k])).map((d) => (d.k === 'tiempo' ? d.campo[sel.tiempo] : d.campo));
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const pad = 8, gap = 22, w = (W - 2 * pad - gap) / 2, h = 58;
      const ys = [10, 10 + h + 36 + 0, 10 + 2 * (h + 36)];
      const pos = [[pad, ys[0]], [pad + w + gap, ys[0]], [pad, ys[2]], [pad + w + gap, ys[2]]];
      cajas = [];
      const fx = pad, fw = W - 2 * pad, fy = ys[1] - 8;
      const fh = h - 6;
      // conectores
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      pos.forEach(([x, y], i) => {
        const arr = i < 2;
        ctx.beginPath(); ctx.moveTo(x + w / 2, arr ? y + h : y); ctx.lineTo(x + w / 2, arr ? fy : fy + fh); ctx.stroke();
      });
      ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 6); ctx.fill(); ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.fillText('HECHOS DE VENTAS', fx + fw / 2, fy + 16);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText('medidas: unidades · ingreso · costo', fx + fw / 2, fy + 38);
      DIMS.forEach((d, i) => {
        const [x, y] = pos[i];
        const inc = d.k === 'tiempo' ? !!sel.tiempo && sel.tiempo !== 'ninguno' : sel[d.k];
        cajas.push({ x, y, w, h, k: d.k });
        ctx.save();
        ctx.fillStyle = inc ? VIZ.alfa(C.s1, 0.14) : C.superficie; ctx.strokeStyle = inc ? C.s1 : C.inactivo; ctx.lineWidth = inc ? 2.5 : 1.5;
        if (!inc) ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = inc ? C.tinta : C.apagado; ctx.fillText(`DIM ${d.n}`.toUpperCase(), x + w / 2, y + 18);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = inc ? C.tinta2 : C.apagado;
        ctx.fillText(d.k === 'tiempo' && inc ? `nivel: ${{ mes: 'mes', trim: 'trimestre', anio: 'año' }[sel.tiempo]}` : d.atr, x + w / 2, y + 40);
      });
      // tabla del mart
      const campos = camposActivos();
      let filas = hechos.filter((r) => !sel.soloWeb || r.canal === 'Web');
      const ag = S.agrupar(filas, campos, 'ingreso'), un = S.agrupar(filas, campos, 'unidades');
      const nombres = campos.map((c) => ({ tmes: 'mes', ttrim: 'trimestre', tanio: 'año', region: 'región', producto: 'producto', canal: 'canal' }[c]));
      const tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ...nombres.map((n) => VIZ.el('th', { class: 'izq' }, n)), VIZ.el('th', null, 'unidades'), VIZ.el('th', null, 'ingreso')),
        ...ag.slice(0, 8).map((g, i) => VIZ.el('tr', null, ...g.clave.map((c) => VIZ.el('td', { class: 'izq' }, c)), VIZ.el('td', null, VIZ.entero(un[i].valor)), VIZ.el('td', null, dinero(g.valor)))),
        ag.length > 8 ? VIZ.el('tr', null, VIZ.el('td', { class: 'izq', colspan: campos.length + 2 }, `… y ${ag.length - 8} filas más`)) : null);
      caja.replaceChildren(tabla);
      const posibles = DIMS.reduce((p, d) => p * (d.k === 'tiempo' ? (sel.tiempo ? CARD[sel.tiempo] : 1) : sel[d.k] ? CARD[d.k] : 1), 1);
      const total = filas.reduce((s, r) => s + r.ingreso, 0), totalAlm = hechos.reduce((s, r) => s + r.ingreso, 0);
      const grano = campos.length ? nombres.join(' × ') : 'un solo total';
      registro.textContent = `Data mart «${grano}»${sel.soloWeb ? ', solo canal web' : ''}: ${filas.length} filas de hechos se resumen en ${ag.length}. El ingreso total ${sel.soloWeb ? 'del subconjunto' : 'coincide con el del almacén'}: ${dinero(total)}.`;
      lectura.set([
        ['filas de hechos del almacén', String(hechos.length)],
        ['filas del data mart', String(ag.length)],
        ['reducción', `${VIZ.fmt(hechos.length / Math.max(1, ag.length), 3)} ×`],
        ['combinaciones posibles', String(posibles)],
        ['ingreso del mart', dinero(total)],
        ['ingreso del almacén', dinero(totalAlm)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      lienzo.canvas.style.cursor = cajas.some((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) ? 'pointer' : 'default';
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = cajas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!c) return;
      if (c.k === 'tiempo') sel.tiempo = sel.tiempo === 'ninguno' ? 'mes' : 'ninguno'; if (sel.tiempo === 'mes') sNiv.valor = 'mes';
      else sel[c.k] = !sel[c.k];
      sPre.valor = 'personal';
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('data-warehouse-marts', {
    intro: String.raw`
      <p>Un <strong>almacén de datos</strong> (<em>data warehouse</em>) es una base de datos pensada para analizar, no para operar: reúne información de varios sistemas, la integra bajo
      definiciones comunes y la conserva con su historia. Un <strong>data mart</strong> es un subconjunto del almacén orientado a un área (comercial, finanzas, un país), más pequeño y más
      rápido de consultar.</p>
      <p>En la primera figura vea por qué el almacén crece mientras el sistema operativo se mantiene acotado; en la segunda construya data marts sobre un <em>esquema estrella</em> y
      compruebe que agregar reduce filas sin perder ingresos.</p>`,
    visualizaciones: [
      {
        titulo: 'El almacén acumula historia',
        descripcion: 'Cargue mes a mes y compare las filas del almacén con las del sistema operativo. Apague una fuente para ver un almacén incompleto y acorte la ventana operativa para ampliar la brecha.',
        montar: montarCarga,
      },
      {
        titulo: 'Esquema estrella y data marts',
        descripcion: 'Elija un data mart y luego quite o agregue dimensiones con clic: observe cómo cambian las filas del mart mientras el ingreso total se mantiene. Pruebe el mart solo web.',
        montar: montarEstrella,
      },
    ],
    teoria: String.raw`
      <h2>Características de un almacén de datos</h2>
      <p>Según la definición clásica de Inmon, un almacén es una colección de datos con cuatro propiedades:</p>
      <table>
        <tr><th>Propiedad</th><th>Significado</th><th>Ejemplo</th></tr>
        <tr><td>Orientado a temas</td><td>Se organiza por conceptos del negocio, no por aplicación</td><td>«Ventas», «Clientes», no «módulo de caja»</td></tr>
        <tr><td>Integrado</td><td>Mismas claves, unidades y formatos para todas las fuentes</td><td>Región «N», «norte» y «Norte» pasan a ser una sola</td></tr>
        <tr><td>Histórico</td><td>Conserva periodos largos, con su fecha</td><td>24 meses de ventas para comparar año contra año</td></tr>
        <tr><td>No volátil</td><td>Los datos se cargan y consultan; no se modifican a diario</td><td>Una venta cargada no se sobrescribe, se agrega una corrección</td></tr>
      </table>
      <h2>Base operacional frente a almacén</h2>
      <table>
        <tr><th></th><th>Base operacional (OLTP)</th><th>Almacén (OLAP)</th></tr>
        <tr><td>Propósito</td><td>Registrar transacciones</td><td>Analizar y decidir</td></tr>
        <tr><td>Operaciones</td><td>Muchas lecturas y escrituras cortas</td><td>Pocas consultas largas, cargas por lotes</td></tr>
        <tr><td>Historia</td><td>Estado actual (meses recientes)</td><td>Años de historia</td></tr>
        <tr><td>Diseño</td><td>Normalizado (<a href="tema.html?id=formas-normales">formas normales</a>)</td><td>Desnormalizado: estrella</td></tr>
        <tr><td>Usuarios</td><td>Cajeros, operadores</td><td>Analistas, gerentes</td></tr>
      </table>
      <h2>Esquema estrella</h2>
      <p>Una <strong>tabla de hechos</strong> guarda eventos medibles (cada venta) con sus medidas numéricas (unidades, ingreso, costo) y claves foráneas hacia las <strong>dimensiones</strong>, que describen el contexto
      (tiempo, región, producto, canal). El <strong>grano</strong> es lo que representa una fila de hechos: aquí, una línea de venta.</p>
      <pre><code>SELECT d.trimestre, p.nombre, SUM(h.ingreso)
FROM   hechos_ventas h
JOIN   dim_tiempo   d ON h.id_tiempo   = d.id
JOIN   dim_producto p ON h.id_producto = p.id
GROUP BY d.trimestre, p.nombre;</code></pre>
      <p>Los lenguajes de consulta se estudian en <a href="tema.html?id=sql">SQL</a> y el modelo de origen en <a href="tema.html?id=modelo-relacional">el modelo relacional</a>.</p>
      <h2>Data marts y agregación</h2>
      <p>Si el mart agrega por \(k\) dimensiones con cardinalidades \(c_1, \dots, c_k\), tendrá como máximo
      \(\prod_i c_i\) filas, sin importar cuántos hechos haya. Para tiempo por mes (24), región (3) y producto (3) son a lo más \(24\cdot 3\cdot 3 = 216\) filas frente a 336 hechos. Como la suma es asociativa,</p>
      \[ \sum_{\text{filas del mart}} \text{ingreso} = \sum_{\text{hechos}} \text{ingreso}, \]
      <p>de modo que el mart es una vista resumida y consistente del almacén. Se puede construir <em>de arriba abajo</em> (primero el almacén, luego los marts) o <em>de abajo arriba</em> (marts que luego se integran, con el riesgo de definiciones distintas).</p>
      <h2>Conexiones</h2>
      <p>Los datos llegan al almacén mediante <a href="tema.html?id=etl-process">ETL</a>, se consultan con <a href="tema.html?id=olap-queries">operaciones OLAP</a> y alimentan <a href="tema.html?id=dashboards-reports">tableros</a>;
      el conjunto forma la arquitectura de <a href="tema.html?id=bi-dss">inteligencia de negocios</a>.</p>`,
  });
})();
