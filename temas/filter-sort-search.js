(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const NOMBRES = ['Aconcagua', 'Maipo', 'Mapocho', 'Biobío', 'Loa', 'Elqui', 'Limarí', 'Choapa', 'Cachapoal', 'Tinguiririca', 'Mataquito', 'Maule', 'Itata', 'Imperial', 'Toltén', 'Valdivia', 'Bueno', 'Puelo', 'Palena', 'Aysén'];

  /* ---------- Fig. 1: filtrar, ordenar y buscar ---------- */

  function montarControles(cuerpo) {
    const rnd = VIZ.semilla(41);
    const D = NOMBRES.map((nombre, i) => ({ nombre, valor: Math.round(5 + rnd() * 95), zona: i < 7 ? 'Norte' : i < 14 ? 'Centro' : 'Sur' }));
    const e = { orden: 'valor', min: 0, q: '', zona: 'todas' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ordenar por', valor: e.orden, opciones: [['nombre', 'nombre (A–Z)'], ['valor', 'valor (mayor primero)'], ['original', 'orden original']], alCambiar: (v) => { e.orden = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Valor mínimo (filtro)', min: 0, max: 90, valor: 0, alCambiar: (v) => { e.min = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Zona', valor: e.zona, opciones: [['todas', 'todas'], ['Norte', 'Norte'], ['Centro', 'Centro'], ['Sur', 'Sur']], alCambiar: (v) => { e.zona = v; dibujar(); } });
    ctl.texto({ etiqueta: 'Buscar por nombre', valor: '', alCambiar: (v) => { e.q = v.trim().toLowerCase(); dibujar(); }, alEnter: (v) => { e.q = v.trim().toLowerCase(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'coincide con la búsqueda' }, { color: C.s1, texto: 'cumple el filtro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Combine las tres operaciones: filtrar quita ítems, ordenar cambia su posición, buscar localiza uno por nombre. Escriba, por ejemplo, «ma» y pulse Enter.');
    let rects = [], vis = [];
    function dibujar() {
      lienzo.limpiar();
      vis = D.filter((d) => d.valor >= e.min && (e.zona === 'todas' || d.zona === e.zona));
      if (e.orden === 'nombre') vis = [...vis].sort((a, b) => a.nombre.localeCompare(b.nombre)); else if (e.orden === 'valor') vis = [...vis].sort((a, b) => b.valor - a.valor);
      const hay = (d) => e.q && d.nombre.toLowerCase().includes(e.q);
      const g = V.barras(lienzo, vis.map((d) => ({ nombre: d.nombre, valor: d.valor })), { horizontal: true, max: 105, color: (i, d) => (hay(d) ? C.s2 : C.s1), margen: { izq: 86, inf: 10, sup: 8 } });
      rects = g.rects;
      const coin = vis.filter(hay);
      registro.textContent = `${vis.length} de ${D.length} ítems cumplen el filtro` + (e.q ? `; ${coin.length} coinciden con «${e.q}»${coin.length ? `: ${coin.map((d) => d.nombre).join(', ')}` : ''}.` : '.');
      lectura.set([['visibles', `${vis.length} / ${D.length}`], ['promedio visible', vis.length ? VIZ.fmt(vis.reduce((t, d) => t + d.valor, 0) / vis.length, 3) : '—'], ['orden', { nombre: 'alfabético', valor: 'por valor', original: 'original' }[e.orden]]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(rects, x, y); if (!h) return tip.ocultar(); const d = vis[h.i]; tip.mostrar(x, y, `<b>${d.nombre}</b> (${d.zona})<br>valor <b>${d.valor}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: cambio de escala del eje ---------- */

  function montarEscala(cuerpo) {
    const e = { esc: 'lineal', base: 'cero' };
    const D = [['A', 12], ['B', 48], ['C', 190], ['D', 760], ['E', 3100]].map(([nombre, valor]) => ({ nombre, valor }));
    const D2 = [['2021', 52.1], ['2022', 52.9], ['2023', 53.4], ['2024', 54.2]];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conjunto', valor: 'orden', opciones: [['orden', 'valores en varios órdenes de magnitud'], ['cercanos', 'valores muy cercanos entre sí']], alCambiar: (v) => { e.conj = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Escala del eje', valor: e.esc, opciones: [['lineal', 'lineal'], ['log', 'logarítmica']], alCambiar: (v) => { e.esc = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Origen del eje', valor: e.base, opciones: [['cero', 'comienza en cero'], ['trunco', 'truncado (mínimo de los datos)']], alCambiar: (v) => { e.base = v; dibujar(); } });
    e.conj = 'orden';
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'serie única; el cambio relevante es el eje';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con el primer conjunto, la escala lineal aplasta los valores pequeños y la logarítmica los separa. Con el segundo, truncar el eje exagera una diferencia pequeña: observe el «factor de mentira».');
    let rects = [], datos = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      datos = e.conj === 'orden' ? D : D2.map(([nombre, valor]) => ({ nombre, valor }));
      const mn = Math.min(...datos.map((d) => d.valor)), mx = Math.max(...datos.map((d) => d.valor));
      const log = e.esc === 'log' && e.conj === 'orden', trunc = e.base === 'trunco' && !log;
      const W = lienzo.ancho, H = lienzo.alto, x0 = 52, y0 = H - 30, y1 = 14;
      const t = (v) => (log ? Math.log10(v) : v), lo = log ? 0 : trunc ? mn * 0.97 : 0, hi = t(mx) * 1.06;
      const sy = V.lin(lo, hi, y0, y1);
      const ticks = log ? [1, 10, 100, 1000, 10000].filter((q) => t(q) <= hi) : VIZ.ticks(lo, hi, 4);
      ticks.forEach((q) => { const y = sy(t(q)); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(W - 12, y + 0.5); ctx.stroke(); V.rotulo(ctx, VIZ.fmt(q, 4), x0 - 6, y, { alinear: 'right', tam: 10, color: C.apagado }); });
      const paso = (W - x0 - 12) / datos.length; rects = [];
      datos.forEach((d, i) => { const y = sy(t(d.valor)), x = x0 + i * paso + 6; ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x, y, paso - 12, y0 - y, [4, 4, 0, 0]); ctx.fill(); V.rotulo(ctx, d.nombre, x + (paso - 12) / 2, y0 + 14, { alinear: 'center', tam: 10, color: C.tinta2 }); rects.push({ x, y, w: paso - 12, h: y0 - y, i }); });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, y0 + 0.5); ctx.lineTo(W - 12, y0 + 0.5); ctx.stroke();
      if (trunc) V.rotulo(ctx, '⚠ eje truncado', x0 + 6, y1 + 4, { tam: 11, color: C.s8, peso: 700 });
      const a = datos[0].valor, b = datos[datos.length - 1].valor, hA = y0 - sy(t(a)), hB = y0 - sy(t(b));
      const mentira = hB / hA / (b / a);
      registro.textContent = log ? 'Escala logarítmica: cada marca del eje es 10 veces la anterior; las barras ya no son proporcionales al valor.' : trunc ? `Eje truncado: el último valor es ${VIZ.fmt(b / a, 3)}× el primero, pero la barra se dibuja ${VIZ.fmt(hB / hA, 3)}× más alta.` : 'Eje desde cero: la altura es proporcional al valor.';
      lectura.set([['razón real (último ÷ primero)', `${VIZ.fmt(b / a, 3)}×`], ['razón dibujada de alturas', `${VIZ.fmt(hB / hA, 3)}×`], ['factor de mentira', VIZ.fmt(mentira, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(rects, x, y); if (!h) return tip.ocultar(); tip.mostrar(x, y, `${datos[h.i].nombre}: <b>${datos[h.i].valor}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('filter-sort-search', {
    intro: String.raw`
      <p>Cuando hay más ítems de los que caben o interesan, la persona necesita <strong>reducir y reordenar</strong>. <em>Filtrar</em> quita lo que no importa, <em>ordenar</em> lleva lo relevante al principio y <em>buscar</em> encuentra un ítem por nombre. Son las interacciones más simples y las que más se usan.</p>
      <p>Una cuarta familia cambia <em>cómo</em> se dibuja: el tipo de escala del eje y su origen. Parece un detalle técnico, pero cambia el mensaje del gráfico.</p>`,
    visualizaciones: [
      { titulo: 'Filtrar, ordenar y buscar', descripcion: 'Combine un filtro por valor y zona, tres órdenes y una búsqueda por texto sobre veinte ríos.', montar: montarControles },
      { titulo: 'Escala y origen del eje', descripcion: 'Cambie entre escala lineal y logarítmica, y entre eje desde cero o truncado, y compare las razones reales con las dibujadas.', montar: montarEscala },
    ],
    teoria: String.raw`
      <h2>Filtrar</h2>
      <p>Un filtro es un predicado sobre los ítems. Para un rango \([a, b]\) sobre un atributo \(x\), los visibles son \(\{ i : a \le x_i \le b \}\). Debe verse qué filtros están activos y cuántos ítems quedan: ocultar sin avisar produce conclusiones sobre una población que no es la completa.</p>
      <h2>Ordenar</h2>
      <p>El orden es una codificación: en barras, ordenar por valor convierte la comparación en lectura de un extremo; ordenar alfabéticamente favorece la búsqueda. Ordenar \(n\) ítems cuesta \(O(n \log n)\), despreciable frente al dibujo, pero conviene <em>animar</em> el reordenamiento para que se vea cada ítem moverse (ver <a href="tema.html?id=d3-transitions-interpolation">constancia del objeto</a>).</p>
      <h2>Buscar</h2>
      <p>La búsqueda por texto sirve cuando se conoce el nombre (tarea <em>lookup</em> o <em>locate</em>; ver <a href="tema.html?id=analysis-tasks">tareas</a>). Debe resaltar las coincidencias sin quitar el contexto.</p>
      <h2>Escalas del eje</h2>
      <p>En una escala logarítmica la posición es \(\log_{10} v\): iguales diferencias son iguales <em>razones</em>. Sirve para datos que cruzan órdenes de magnitud, pero las longitudes de barra dejan de ser proporcionales al valor, así que no es apta para barras; use puntos o líneas.</p>
      <p>En un eje truncado, la razón de alturas es \(\dfrac{b - m}{a - m}\) en vez de \(\dfrac{b}{a}\), donde \(m\) es el origen elegido. El <em>factor de mentira</em> de Tufte es
      \[ \text{LF} = \frac{\text{tamaño del efecto en el gráfico}}{\text{tamaño del efecto en los datos}}, \]
      y debería valer 1. Las barras deben empezar en cero; las líneas pueden no hacerlo si se avisa.</p>`,
  });
})();
