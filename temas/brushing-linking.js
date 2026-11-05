(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: dos vistas enlazadas ---------- */

  function montarEnlazadas(cuerpo) {
    const rnd = VIZ.semilla(7);
    const D = Array.from({ length: 70 }, (_, i) => { const a = rnd() * 100, b = Math.max(2, Math.min(98, 0.6 * a + 20 + 18 * VIZ.normal(rnd))), c = Math.max(2, Math.min(98, 84 - 0.55 * a + 11 * VIZ.normal(rnd))); return { i, a, b, c, g: i % 3 }; });
    let sel = new Set(), caja = null, panel = null, modo = 'reemplazar';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Al seleccionar de nuevo', valor: modo, opciones: [['reemplazar', 'reemplazar la selección'], ['agregar', 'agregar a la anterior']], alCambiar: (v) => { modo = v; } });
    ctl.boton('Quitar selección', () => { sel = new Set(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? 560 : 300) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'seleccionados (en ambas vistas)' }, { color: C.inactivo, texto: 'no seleccionados' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre un rectángulo sobre cualquiera de los dos gráficos de dispersión: los mismos ítems se destacan en el otro (linking). Con «agregar» puede acumular varias regiones.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancho = W < 620, w = ancho ? W : W / 2, h = ancho ? H / 2 : H;
      const pa = [{ ox: 0, oy: 0, w, h, x: 'a', y: 'b' }, { ox: ancho ? 0 : w, oy: ancho ? h : 0, w, h, x: 'a', y: 'c' }];
      panel = pa;
      pa.forEach((p, k) => {
        const sx = V.lin(0, 100, p.ox + 38, p.ox + p.w - 12), sy = V.lin(0, 100, p.oy + p.h - 34, p.oy + 22);
        p.sx = sx; p.sy = sy;
        ctx.strokeStyle = C.eje; ctx.strokeRect(p.ox + 38.5, p.oy + 22.5, p.w - 50, p.h - 56);
        V.rotulo(ctx, `${p.y} según ${p.x}`, p.ox + 40, p.oy + 11, { tam: 11, peso: 600, color: C.tinta });
        [0, 50, 100].forEach((t) => { V.rotulo(ctx, String(t), p.ox + 33, sy(t), { alinear: 'right', tam: 10, color: C.apagado }); V.rotulo(ctx, String(t), sx(t), p.oy + p.h - 20, { alinear: 'center', tam: 10, color: C.apagado }); });
        const hay = sel.size > 0;
        D.forEach((d) => { if (!sel.has(d.i)) VIZ.marcador(ctx, sx(d[p.x]), sy(d[p.y]), hay ? VIZ.alfa(C.inactivo, 0.6) : C.s1, 3.5); });
        D.forEach((d) => { if (sel.has(d.i)) VIZ.marcador(ctx, sx(d[p.x]), sy(d[p.y]), C.s2, 4.5); });
        if (caja && caja.k === k) { ctx.fillStyle = VIZ.alfa(C.s2, 0.12); ctx.strokeStyle = C.s2; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.fillRect(caja.x0, caja.y0, caja.x1 - caja.x0, caja.y1 - caja.y0); ctx.strokeRect(caja.x0, caja.y0, caja.x1 - caja.x0, caja.y1 - caja.y0); ctx.setLineDash([]); }
      });
      const s = D.filter((d) => sel.has(d.i)), m = (k) => (s.length ? s.reduce((t, d) => t + d[k], 0) / s.length : 0);
      lectura.set([['seleccionados', `${s.length} de ${D.length}`], ['media de a', s.length ? VIZ.fmt(m('a'), 3) : '—'], ['media de b · c', s.length ? `${VIZ.fmt(m('b'), 3)} · ${VIZ.fmt(m('c'), 3)}` : '—']]);
    }
    const panelDe = (x, y) => panel.findIndex((p) => x >= p.ox && x <= p.ox + p.w && y >= p.oy && y <= p.oy + p.h);
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev), k = panelDe(x, y); if (k < 0) return; caja = { k, x0: x, y0: y, x1: x, y1: y }; lienzo.canvas.setPointerCapture(ev.pointerId); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (caja) { caja.x1 = x; caja.y1 = y; const p = panel[caja.k], x0 = Math.min(caja.x0, caja.x1), x1 = Math.max(caja.x0, caja.x1), y0 = Math.min(caja.y0, caja.y1), y1 = Math.max(caja.y0, caja.y1); const nuevo = D.filter((d) => p.sx(d[p.x]) >= x0 && p.sx(d[p.x]) <= x1 && p.sy(d[p.y]) >= y0 && p.sy(d[p.y]) <= y1).map((d) => d.i); sel = modo === 'agregar' ? new Set([...(caja.base || sel), ...nuevo]) : new Set(nuevo); if (!caja.base) caja.base = modo === 'agregar' ? new Set(sel) : null; dibujar(); return; }
      const k = panelDe(x, y); if (k < 0) return tip.ocultar();
      const p = panel[k], c = V.cercano(D.map((d) => ({ px: p.sx(d[p.x]), py: p.sy(d[p.y]), d })), x, y, 9);
      if (!c) return tip.ocultar(); tip.mostrar(x, y, `ítem <b>${c.d.i}</b><br>a ${VIZ.fmt(c.d.a, 3)} · b ${VIZ.fmt(c.d.b, 3)} · c ${VIZ.fmt(c.d.c, 3)}`);
    });
    const fin = () => { caja = null; dibujar(); };
    lienzo.canvas.addEventListener('pointerup', fin); lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); if (caja) fin(); });
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: seleccionar un intervalo de tiempo ---------- */

  function montarTiempo(cuerpo) {
    const rnd = VIZ.semilla(19);
    const EV = Array.from({ length: 90 }, (_, i) => { const dia = Math.floor(rnd() * 120), foco = dia > 40 && dia < 70; return { i, dia, x: foco ? 70 + 12 * VIZ.normal(rnd) : 25 + 18 * VIZ.normal(rnd), y: foco ? 35 + 10 * VIZ.normal(rnd) : 60 + 22 * VIZ.normal(rnd) }; });
    let a = 45, b = 70, arrastre = null, zonas = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Todo el período', () => { a = 0; b = 119; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? 430 : 330) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'eventos dentro del intervalo' }, { color: C.inactivo, texto: 'fuera del intervalo' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre la serie de arriba para elegir un intervalo (o arrastre sus bordes). El mapa de abajo muestra dónde ocurrieron esos eventos: así se descubre que el aumento de mediados de período se concentra en una zona.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const hs = 110, sx = V.lin(0, 119, 40, W - 14), cuenta = Array.from({ length: 24 }, () => 0);
      EV.forEach((e) => { cuenta[Math.min(23, Math.floor(e.dia / 5))]++; });
      const sy = V.lin(0, Math.max(...cuenta) * 1.1, hs - 22, 14);
      V.rotulo(ctx, 'eventos por 5 días', 40, 8, { tam: 10, color: C.apagado });
      ctx.fillStyle = VIZ.alfa(C.s2, 0.12); ctx.fillRect(sx(a), 12, sx(b) - sx(a), hs - 34);
      cuenta.forEach((c, i) => { const x0 = sx(i * 5), x1 = sx(i * 5 + 4.5), dentro = i * 5 + 5 > a && i * 5 <= b; ctx.fillStyle = dentro ? C.s2 : C.inactivo; ctx.fillRect(x0, sy(c), x1 - x0, hs - 22 - sy(c)); });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(40, hs - 21.5); ctx.lineTo(W - 14, hs - 21.5); ctx.stroke();
      [0, 30, 60, 90, 119].forEach((t) => V.rotulo(ctx, `día ${t}`, sx(t), hs - 8, { alinear: 'center', tam: 10, color: C.apagado }));
      ctx.fillStyle = C.s2; ctx.fillRect(sx(a) - 2, 12, 4, hs - 34); ctx.fillRect(sx(b) - 2, 12, 4, hs - 34);
      zonas = { a: sx(a), b: sx(b), sx };
      const my = hs + 12, mh = H - my - 10, mx = V.lin(0, 100, 40, W - 14), mY = V.lin(0, 100, my + mh, my);
      ctx.strokeStyle = C.eje; ctx.strokeRect(40.5, my + 0.5, W - 54, mh);
      V.rotulo(ctx, 'ubicación de los eventos', 40, my - 4, { tam: 10, color: C.apagado });
      EV.forEach((e) => { if (e.dia < a || e.dia > b) VIZ.marcador(ctx, mx(Math.max(1, Math.min(99, e.x))), mY(Math.max(1, Math.min(99, e.y))), VIZ.alfa(C.inactivo, 0.6), 3); });
      EV.forEach((e) => { if (e.dia >= a && e.dia <= b) VIZ.marcador(ctx, mx(Math.max(1, Math.min(99, e.x))), mY(Math.max(1, Math.min(99, e.y))), C.s2, 4.5); });
      const s = EV.filter((e) => e.dia >= a && e.dia <= b);
      lectura.set([['intervalo', `día ${Math.round(a)} – ${Math.round(b)}`], ['eventos', `${s.length} de ${EV.length}`], ['centro de los eventos', s.length ? `(${VIZ.fmt(s.reduce((t, e) => t + e.x, 0) / s.length, 3)}; ${VIZ.fmt(s.reduce((t, e) => t + e.y, 0) / s.length, 3)})` : '—']]);
    }
    lienzo.canvas.style.cursor = 'ew-resize';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev); if (y > 110) return; const d = zonas.sx.inv(x); arrastre = Math.abs(x - zonas.a) < 8 ? 'a' : Math.abs(x - zonas.b) < 8 ? 'b' : (a = b = d, 'b'); lienzo.canvas.setPointerCapture(ev.pointerId); dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { if (!arrastre) return; const { x } = lienzo.posicion(ev), d = Math.max(0, Math.min(119, zonas.sx.inv(x))); if (arrastre === 'a') a = Math.min(d, b); else b = Math.max(d, a); dibujar(); });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = null; }); lienzo.canvas.addEventListener('pointerleave', () => { arrastre = null; tip.ocultar(); });
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('brushing-linking', {
    intro: String.raw`
      <p><strong>Brushing</strong> (pincelar) es seleccionar un grupo de ítems arrastrando sobre una vista. <strong>Linking</strong> (enlazar) es que esa selección se refleje en otras vistas del mismo conjunto de datos. Juntos permiten preguntar «¿cómo son, en las otras variables, los ítems que veo aquí?» sin escribir una consulta.</p>
      <p>Es la técnica base de las <em>vistas múltiples coordinadas</em>: cada vista muestra un aspecto distinto, y la selección las conecta.</p>`,
    visualizaciones: [
      { titulo: 'Dos dispersiones enlazadas', descripcion: 'Seleccione un rectángulo en una vista y observe dónde caen esos ítems en la otra; pruebe a agregar regiones.', montar: montarEnlazadas },
      { titulo: 'Brushing sobre el tiempo', descripcion: 'Elija un intervalo en la serie de eventos y vea en qué zona del mapa ocurrieron.', montar: montarTiempo },
    ],
    teoria: String.raw`
      <h2>Mecanismo</h2>
      <p>Hay un <em>estado compartido</em>: el conjunto \(S\) de ítems seleccionados. Cada vista dibuja los ítems de \(S\) con un resaltado y el resto atenuado. Pincelar en la vista \(k\) con una región \(R_k\) calcula
      \[ S = \{\, i : (x_i^{(k)}, y_i^{(k)}) \in R_k \,\}, \]
      y todas las vistas se redibujan con el nuevo \(S\). Como el identificador del ítem es el mismo en todas, el enlace es una consulta por identificador.</p>
      <h2>Variantes</h2>
      <table>
        <tr><th>Variante</th><th>Qué selecciona</th></tr>
        <tr><td>rectángulo / lazo</td><td>región 2D de una dispersión</td></tr>
        <tr><td>intervalo 1D</td><td>rango sobre un eje (por ejemplo, el tiempo)</td></tr>
        <tr><td>clic en categoría</td><td>una barra, una región del mapa</td></tr>
        <tr><td>combinada (y/o)</td><td>selecciones en varias vistas que se intersecan o se unen</td></tr>
      </table>
      <h2>Principios de diseño</h2>
      <ul>
        <li>El resaltado debe ser consistente: el mismo color en todas las vistas (aquí, naranjo).</li>
        <li>Lo no seleccionado se atenúa, no se borra: se conserva el contexto.</li>
        <li>La selección debe poder deshacerse y refinarse (agregar, quitar).</li>
        <li>Si la selección afecta lo que se muestra (filtro) en lugar de lo que se resalta, hay que rotularlo (ver <a href="tema.html?id=dashboard-filters-controls">filtros en dashboards</a>).</li>
      </ul>
      <p>Complementos: <a href="tema.html?id=zoom-pan">zoom y desplazamiento</a>, <a href="tema.html?id=details-on-demand">detalles bajo demanda</a>.</p>`,
  });
})();
