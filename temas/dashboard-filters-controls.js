(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;
  const FILAS = V.ventas(1);
  const COLR = [C.s1, C.s2, C.s3, C.s7];

  /* ---------- Fig. 1: un tablero con filtros ---------- */

  function montarTablero(cuerpo) {
    const e = { reg: { Norte: true, Centro: true, Sur: true, Austral: true }, cat: 'todas', d: 0, h: 11, sel: null };
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(V.REGIONES.map((r, i) => ({ clave: r, texto: r, color: COLR[i], activo: true })), (st) => { Object.assign(e.reg, st); dibujar(); });
    ctl.selector({ etiqueta: 'Categoría', valor: e.cat, opciones: [['todas', 'Todas'], ...V.CATEGORIAS.map((c) => [c, c])], alCambiar: (v) => { e.cat = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Desde', min: 0, max: 11, valor: 0, formato: (v) => V.MESES[v], alCambiar: (v) => { e.d = Math.min(v, e.h); dibujar(); } });
    ctl.rango({ etiqueta: 'Hasta', min: 0, max: 11, valor: 11, formato: (v) => V.MESES[v], alCambiar: (v) => { e.h = Math.max(v, e.d); dibujar(); } });
    ctl.boton('Quitar filtro por clic', () => { e.sel = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? 520 : 330) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, V.REGIONES.map((r, i) => ({ color: COLR[i], texto: r })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Todas las tarjetas y gráficos leen la misma selección. Haga clic en una barra de región para filtrar por ella (filtro cruzado); vuelva a hacer clic para quitarlo.');
    let barras = [], lineas = [];
    function filtradas() { return FILAS.filter((f) => e.reg[f.region] && (e.cat === 'todas' || f.cat === e.cat) && f.mes >= e.d && f.mes <= e.h); }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const fs = filtradas().filter((f) => !e.sel || f.region === e.sel);
      const vt = fs.reduce((a, f) => a + f.ventas, 0), pt = fs.reduce((a, f) => a + f.pedidos, 0), mg = fs.reduce((a, f) => a + f.ventas - f.costo, 0);
      const tarj = [['Ventas', VIZ.fmt(vt, 4) + ' M$'], ['Pedidos', VIZ.entero(pt)], ['Ticket', pt ? VIZ.fmt(vt / pt * 1000, 3) + ' k$' : '—'], ['Margen', vt ? VIZ.fmt((mg / vt) * 100, 3) + ' %' : '—']];
      const tw = (W - 24) / 4;
      tarj.forEach(([k, v], i) => { const x = 8 + i * (tw + 2.6); ctx.fillStyle = C.fondo2; ctx.fillRect(x, 6, tw - 2, 50); V.rotulo(ctx, k, x + 8, 20, { tam: 10, color: C.apagado }); V.rotulo(ctx, v, x + 8, 40, { tam: W < 480 ? 12 : 15, peso: 700, color: C.tinta }); });
      const ancho = W < 620, hb = ancho ? 200 : H - 70;
      // barras por región (usa las filas filtradas salvo el filtro cruzado para que sirva de selector)
      const porReg = V.REGIONES.map((r) => ({ nombre: r, valor: filtradas().filter((f) => f.region === r).reduce((a, f) => a + f.ventas, 0) }));
      ctx.save(); ctx.translate(0, 64);
      const sub = { ctx, ancho: ancho ? W : W * 0.38, alto: ancho ? 200 : hb };
      const g = V.barras(sub, porReg, { color: (i, d) => (e.sel && e.sel !== d.nombre ? VIZ.alfa(COLR[i], 0.25) : COLR[i]), margen: { izq: 34, inf: 28 } });
      barras = g.rects.map((r) => ({ ...r, y: r.y + 64 }));
      ctx.restore();
      // líneas por mes
      const ox = ancho ? 0 : W * 0.38, oy = ancho ? 270 : 64, ww = ancho ? W : W - ox, hh = ancho ? 240 : hb;
      const ser = V.REGIONES.map((r) => V.MESES.map((_, m) => filtradas().filter((f) => f.region === r && f.mes === m).reduce((a, f) => a + f.ventas, 0)));
      const maxy = Math.max(1, ...ser.flat());
      const sx = V.lin(0, 11, ox + 40, ox + ww - 14), sy = V.lin(0, maxy * 1.1, oy + hh - 26, oy + 12);
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(ox + 40, oy + hh - 25.5); ctx.lineTo(ox + ww - 14, oy + hh - 25.5); ctx.stroke();
      V.MESES.forEach((m, i) => { if (i % 2 === 0) V.rotulo(ctx, m, sx(i), oy + hh - 12, { alinear: 'center', tam: 10, color: C.apagado }); });
      for (const t of VIZ.ticks(0, maxy * 1.1, 3)) { V.rotulo(ctx, String(t), ox + 34, sy(t), { alinear: 'right', tam: 10, color: C.apagado }); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(ox + 40, sy(t) + 0.5); ctx.lineTo(ox + ww - 14, sy(t) + 0.5); ctx.stroke(); }
      lineas = [];
      V.REGIONES.forEach((r, k) => {
        if (!e.reg[r]) return;
        ctx.strokeStyle = e.sel && e.sel !== r ? VIZ.alfa(COLR[k], 0.25) : COLR[k]; ctx.lineWidth = 2; ctx.beginPath();
        let abierto = false;
        ser[k].forEach((v, m) => { if (m < e.d || m > e.h || (e.cat !== 'todas' && false)) return; const x = sx(m), y = sy(v); abierto ? ctx.lineTo(x, y) : ctx.moveTo(x, y); abierto = true; lineas.push({ px: x, py: y, k, m, v }); });
        ctx.stroke();
      });
      registro.textContent = `Selección: ${Object.entries(e.reg).filter(([, a]) => a).map(([r]) => r).join(', ') || 'ninguna región'} · ${e.cat === 'todas' ? 'todas las categorías' : e.cat} · ${V.MESES[e.d]}–${V.MESES[e.h]}${e.sel ? ` · filtro cruzado: ${e.sel}` : ''}. ${fs.length} de ${FILAS.length} filas.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      lienzo.canvas.style.cursor = V.bajo(barras, x, y) ? 'pointer' : 'default';
      const b = V.bajo(barras, x, y);
      if (b) return tip.mostrar(x, y, `<b>${V.REGIONES[b.i]}</b><br>clic para filtrar`);
      const p = V.cercano(lineas, x, y, 12);
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `${V.REGIONES[p.k]} · ${V.MESES[p.m]}<br>ventas <b>${VIZ.fmt(p.v, 3)}</b> M$`);
    });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const b = V.bajo(barras, x, y); if (!b) return; const r = V.REGIONES[b.i]; e.sel = e.sel === r ? null : r; dibujar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: comparar con un período anterior ---------- */

  function montarComparacion(cuerpo) {
    const e = { ini: 6, largo: 6, ref: 'previo' };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Mes de inicio', min: 0, max: 11, valor: e.ini, formato: (v) => V.MESES[v], alCambiar: (v) => { e.ini = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Duración (meses)', min: 1, max: 6, valor: e.largo, alCambiar: (v) => { e.largo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Comparar con', valor: e.ref, opciones: [['previo', 'período anterior'], ['anual', 'mismo período del año anterior']], alCambiar: (v) => { e.ref = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'período elegido', forma: 'linea' }, { color: C.apagado, texto: 'período de comparación', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El año anterior se simula con los mismos meses del año actual menos una tendencia. Con «período anterior», el tablero compara con los meses inmediatamente previos (si caben).');
    const total = V.MESES.map((_, m) => FILAS.filter((f) => f.mes === m).reduce((a, f) => a + f.ventas, 0));
    const anterior = total.map((v, m) => v * (0.9 - 0.004 * m));
    let pts = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const act = Array.from({ length: e.largo }, (_, i) => ({ m: (e.ini + i) % 12, v: total[(e.ini + i) % 12] }));
      const ref = Array.from({ length: e.largo }, (_, i) => (e.ref === 'anual' ? { m: (e.ini + i) % 12, v: anterior[(e.ini + i) % 12] } : { m: (e.ini - e.largo + i + 12) % 12, v: total[(e.ini - e.largo + i + 12) % 12] }));
      const maxy = Math.max(...act.map((d) => d.v), ...ref.map((d) => d.v)) * 1.1;
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(1, e.largo - 1), ymin: 0, ymax: maxy }, { etiquetaY: 'ventas (M$)', formatoX: (x) => `día ${Math.round(x) + 1}`, ticksX: Array.from({ length: e.largo }, (_, i) => i), etiquetaX: 'posición dentro del período' });
      plano.ejes();
      VIZ.trazar(ctx, plano, ref.map((d, i) => [i, d.v]), C.apagado, 2, [5, 4]);
      VIZ.trazar(ctx, plano, act.map((d, i) => [i, d.v]), C.s1, 2.5);
      pts = [];
      act.forEach((d, i) => { VIZ.marcador(ctx, plano.sx(i), plano.sy(d.v), C.s1, 4); pts.push({ px: plano.sx(i), py: plano.sy(d.v), i, d, r: ref[i] }); });
      const ta = act.reduce((s, d) => s + d.v, 0), tr = ref.reduce((s, d) => s + d.v, 0);
      lectura.set([['total del período', VIZ.fmt(ta, 4) + ' M$'], ['comparación', VIZ.fmt(tr, 4) + ' M$'], ['variación', `${ta >= tr ? '+' : '−'}${VIZ.fmt(Math.abs((ta / tr - 1) * 100), 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = V.cercano(pts, x, y, 16);
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `${V.MESES[p.d.m]}: <b>${VIZ.fmt(p.d.v, 4)}</b><br>comparación (${V.MESES[p.r.m]}): <b>${VIZ.fmt(p.r.v, 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dashboard-filters-controls', {
    intro: String.raw`
      <p>Un <strong>dashboard</strong> deja de ser una lámina cuando tiene <em>controles</em>: casillas, listas y rangos de fechas que <strong>filtran</strong> toda la información a la vez. Segmentar (por región, por categoría, por período) es la forma más rápida de pasar del resumen al detalle.</p>
      <p>El otro uso típico es <strong>comparar</strong>: el mismo indicador frente a un período anterior, para saber si un valor es bueno o malo.</p>`,
    parametros: [
      ['Casillas de región (Fig. 1)', String.raw`Incluyen o excluyen cada región (Norte, Centro, Sur y Austral) de todas las tarjetas y gráficos. Cada una conserva su color.`],
      ['Categoría (Fig. 1)', String.raw`Restringe todas las cifras a una categoría de producto, o a todas.`],
      ['Desde y Hasta (Fig. 1)', String.raw`Los meses inicial y final del rango que se considera. Acortarlo recorta las líneas y recalcula las tarjetas.`],
      ['Quitar filtro por clic (Fig. 1)', String.raw`Anula la región seleccionada con un clic en una barra, pero conserva los demás filtros.`],
      ['Mes de inicio y Duración (meses) (Fig. 2)', String.raw`Fijan el período que se analiza: dónde empieza y cuántos meses abarca. Al cambiarlo cambian el total y la comparación.`],
      ['Comparar con (Fig. 2)', String.raw`El período de referencia: los meses inmediatamente anteriores o los mismos meses del año previo. Define contra qué se mide la variación.`],
    ],
    visualizaciones: [
      { titulo: 'Un tablero con filtros y filtro cruzado', descripcion: 'Filtre por región, categoría y rango de meses; haga clic en una barra para filtrar el resto de las tarjetas y gráficos.',
        ayuda: String.raw`<p>Arriba cuatro tarjetas (Ventas, Pedidos, Ticket y Margen) calculadas con el filtro actual. Abajo, a la izquierda, las barras de ventas por región (azul, naranja, aguamarina y violeta) y, a la derecha, las líneas de ventas por mes de cada región. Al pasar el cursor se leen los valores; el registro lista la selección activa.</p>
          <ul>
          <li><strong>Casillas de región</strong> y <strong>Categoría</strong>: quitan filas y cambian las tarjetas, las barras y las líneas a la vez.</li>
          <li><strong>Desde</strong> y <strong>Hasta</strong>: recortan el eje de meses de las líneas y los totales.</li>
          <li>Clic en una barra: las demás regiones se atenúan y las tarjetas muestran solo esa; <strong>Quitar filtro por clic</strong> lo deshace.</li>
          </ul>`, montar: montarTablero },
      { titulo: 'Comparación con un período anterior', descripcion: 'Elija un período y compárelo con el anterior o con el mismo del año previo; lea la variación porcentual.',
        ayuda: String.raw`<p>La línea azul con puntos es el período elegido y la gris discontinua es el período de comparación, con ventas en M&#36; en el eje vertical y la posición dentro del período en el horizontal. La lectura da el total del período, el de la comparación y la variación porcentual.</p>
          <ul>
          <li><strong>Mes de inicio</strong> y <strong>Duración</strong>: cambian los puntos de la línea azul y el total.</li>
          <li><strong>Comparar con</strong> «mismo período del año anterior»: la línea gris pasa a ser la de los mismos meses del año previo, lo que modifica la variación.</li>
          </ul>`, montar: montarComparacion },
    ],
    teoria: String.raw`
      <h2>Filtros</h2>
      <p>Un filtro es un predicado \(\phi\) sobre las filas; todo componente calcula su agregación sobre las filas que lo cumplen:
      \[ \text{valor} = \operatorname{agg}\{\, m(f) : f \in F,\ \phi_1(f) \wedge \phi_2(f) \wedge \dots \,\}. \]
      Varios filtros se combinan con <em>y</em>; dentro de un mismo control (varias regiones) se combinan con <em>o</em>.</p>
      <h2>Alcance de un control</h2>
      <p>En Looker Studio un control puede aplicarse a una página, a todo el informe o a un grupo de componentes, y un <em>filtro cruzado</em> convierte un gráfico en control de los demás. Si el alcance no es evidente, la persona cree ver datos de una población que no corresponde: rotule siempre qué filtros están activos.</p>
      <h2>Comparaciones</h2>
      <p>Un valor aislado rara vez comunica. La variación relativa respecto de una referencia es
      \[ \Delta\% = \frac{x_{\text{actual}} - x_{\text{ref}}}{x_{\text{ref}}} \times 100. \]
      Contra el período anterior se mide el cambio reciente, pero se mezcla con la estacionalidad; contra el mismo período del año anterior se cancela la estacionalidad.</p>
      <h2>Conexiones</h2>
      <p>El mismo mecanismo, escrito a mano, es el <a href="tema.html?id=brushing-linking">brushing y linking</a> de la interacción; para organizar los componentes en la página, ver <a href="tema.html?id=dashboard-layout-design">diseño de dashboards</a>.</p>`,
  });
})();
