(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: buscar según lo que se conoce ---------- */

  const BUSQ = {
    lookup: { n: 'Lookup', obj: true, loc: true, tx: 'Sabe qué busca y dónde: lea el valor de «Temuco» (la región sombreada indica dónde está).' },
    locate: { n: 'Locate', obj: true, loc: false, tx: 'Sabe qué busca pero no dónde: encuentre «Temuco» entre todos los puntos.' },
    browse: { n: 'Browse', obj: false, loc: true, tx: 'No sabe qué busca, pero sí dónde mirar: examine la región sombreada y describa lo que hay.' },
    explore: { n: 'Explore', obj: false, loc: false, tx: 'No sabe qué busca ni dónde: recorra el gráfico para descubrir algo interesante (por ejemplo, valores atípicos).' },
  };

  function montarBusqueda(cuerpo) {
    let t = 'lookup';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tarea de búsqueda', valor: t, opciones: Object.entries(BUSQ).map(([k, v]) => [k, v.n]), alCambiar: (v) => { t = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'punto (ciudad)' }, { color: C.s2, texto: 'objetivo conocido' }, { color: C.s4, texto: 'región conocida', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo, { grande: false });
    VIZ.nota(cuerpo, 'Los cuatro casos salen de dos preguntas: ¿conoce el objetivo?, ¿conoce su ubicación? Pase el cursor sobre los puntos para leer su nombre; observe cómo cambia el esfuerzo según lo conocido.');
    const rnd = VIZ.semilla(21);
    const PTS = V.CIUDADES.map((n, i) => ({ n, x: 8 + rnd() * 84, y: 8 + rnd() * 84, v: Math.round(20 + rnd() * 80), i }));
    PTS.push({ n: 'Temuco', x: 60, y: 30, v: 72, i: 12 });
    let pts = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 100 }, { etiquetaX: 'población', etiquetaY: 'ingreso' });
      plano.ejes();
      const b = BUSQ[t];
      if (b.loc) { ctx.fillStyle = VIZ.alfa(C.s4, 0.2); ctx.strokeStyle = C.s4; ctx.lineWidth = 2; ctx.fillRect(plano.sx(48), plano.sy(45), plano.sx(72) - plano.sx(48), plano.sy(15) - plano.sy(45)); ctx.strokeRect(plano.sx(48), plano.sy(45), plano.sx(72) - plano.sx(48), plano.sy(15) - plano.sy(45)); }
      pts = PTS.map((p) => ({ px: plano.sx(p.x), py: plano.sy(p.y), p }));
      pts.forEach(({ px, py, p }) => { const obj = p.n === 'Temuco' && b.obj; VIZ.marcador(ctx, px, py, obj ? C.s2 : C.s1, obj ? 6.5 : 4.5); if (obj && b.loc) V.rotulo(ctx, `Temuco: ${p.v}`, px + 10, py - 10, { tam: 11, peso: 700, color: C.tinta }); });
      registro.textContent = `${b.n}: ${b.tx}`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const q = V.cercano(pts, x, y, 10); if (!q) return tip.ocultar(); tip.mostrar(x, y, `<b>${q.p.n}</b><br>valor ${q.p.v}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: identificar, comparar, resumir ---------- */

  function montarConsulta(cuerpo) {
    let alc = 'identificar', sel = [];
    const rnd = VIZ.semilla(14);
    const D = V.CIUDADES.slice(0, 8).map((n) => ({ nombre: n.slice(0, 7), valor: Math.round(20 + rnd() * 80) }));
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Consulta', valor: alc, opciones: [['identificar', 'Identificar: un ítem'], ['comparar', 'Comparar: dos o más'], ['resumir', 'Resumir: todo el conjunto']], alCambiar: (v) => { alc = v; sel = []; dibujar(); } });
    ctl.boton('Limpiar selección', () => { sel = []; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'seleccionado' }, { color: C.s1, texto: 'sin seleccionar' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en las barras. Con «identificar» basta una; «comparar» pide al menos dos; «resumir» ignora la selección y habla del conjunto completo.');
    let rects = [];
    function dibujar() {
      lienzo.limpiar();
      const g = V.barras(lienzo, D, { max: 110, color: (i) => (alc === 'resumir' ? C.s2 : sel.includes(i) ? C.s2 : C.s1) });
      rects = g.rects;
      const v = D.map((d) => d.valor), media = v.reduce((a, b) => a + b, 0) / v.length;
      if (alc === 'identificar') registro.textContent = sel.length ? `${D[sel[0]].nombre}: valor ${D[sel[0]].valor}, posición ${[...v].sort((a, b) => b - a).indexOf(D[sel[0]].valor) + 1}.º de ${v.length}.` : 'Elija una barra para identificar su valor y su lugar en el orden.';
      else if (alc === 'comparar') registro.textContent = sel.length >= 2 ? `Comparación: ${sel.map((i) => `${D[i].nombre} (${D[i].valor})`).join(' · ')}. Diferencia entre mayor y menor: ${Math.max(...sel.map((i) => D[i].valor)) - Math.min(...sel.map((i) => D[i].valor))}.` : 'Elija al menos dos barras.';
      else registro.textContent = `Resumen: media ${VIZ.fmt(media, 4)}, mínimo ${Math.min(...v)}, máximo ${Math.max(...v)}, rango ${Math.max(...v) - Math.min(...v)}.`;
      if (alc === 'resumir') { const y = g.escala(media); lienzo.ctx.strokeStyle = C.tinta; lienzo.ctx.setLineDash([4, 4]); lienzo.ctx.beginPath(); lienzo.ctx.moveTo(34, y); lienzo.ctx.lineTo(lienzo.ancho - 14, y); lienzo.ctx.stroke(); lienzo.ctx.setLineDash([]); V.rotulo(lienzo.ctx, 'media', lienzo.ancho - 50, y - 8, { tam: 10, color: C.tinta }); }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(rects, x, y); if (!h || alc === 'resumir') return; if (alc === 'identificar') sel = [h.i]; else sel = sel.includes(h.i) ? sel.filter((q) => q !== h.i) : [...sel, h.i]; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(rects, x, y); if (!h) return tip.ocultar(); tip.mostrar(x, y, `${D[h.i].nombre}: <b>${D[h.i].valor}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('analysis-tasks', {
    intro: String.raw`
      <p>Una visualización existe para que alguien haga algo con ella. Describir esa actividad con palabras del dominio («detectar un brote») no ayuda a diseñar; hay que traducirla a <strong>tareas abstractas</strong>: buscar, comparar, resumir, ordenar, filtrar.</p>
      <p>Las tareas se describen con dos partes: una <strong>acción</strong> (el verbo) y un <strong>objetivo</strong> (sobre qué datos actúa). Con esa descripción común, se pueden reutilizar diseños entre áreas muy distintas.</p>`,
    visualizaciones: [
      { titulo: 'Buscar: cuatro casos', descripcion: 'Alterne entre lookup, locate, browse y explore, y note qué parte de la información se da por conocida.', montar: montarBusqueda },
      { titulo: 'Consultar: identificar, comparar, resumir', descripcion: 'Seleccione barras según el alcance de la consulta y lea el resultado correspondiente.', montar: montarConsulta },
    ],
    teoria: String.raw`
      <h2>Acciones</h2>
      <table>
        <tr><th>Grupo</th><th>Acciones</th><th>Pregunta</th></tr>
        <tr><td>analizar</td><td>consumir (descubrir, presentar, disfrutar), producir (anotar, registrar, derivar)</td><td>¿para qué se usa?</td></tr>
        <tr><td>buscar</td><td>lookup, locate, browse, explore</td><td>¿qué se conoce de antemano?</td></tr>
        <tr><td>consultar</td><td>identificar, comparar, resumir</td><td>¿cuántos ítems intervienen?</td></tr>
      </table>
      <h2>Búsqueda</h2>
      <p>Las cuatro formas salen de cruzar dos preguntas:</p>
      <table>
        <tr><th></th><th>ubicación conocida</th><th>ubicación desconocida</th></tr>
        <tr><th>objetivo conocido</th><td>lookup</td><td>locate</td></tr>
        <tr><th>objetivo desconocido</th><td>browse</td><td>explore</td></tr>
      </table>
      <h2>Consulta</h2>
      <p>El alcance de una consulta es un ítem (identificar), un subconjunto pequeño (comparar) o el conjunto completo (resumir). Resumir produce estadísticos como \(\bar{x} = \frac{1}{n}\sum_i x_i\) o el rango \(\max_i x_i - \min_i x_i\); comparar se apoya en la diferencia o razón entre pocos valores.</p>
      <h2>Objetivos</h2>
      <p>El objetivo de una tarea puede ser <em>todos los datos</em> (tendencias, atípicos, características), <em>atributos</em> (un valor, la distribución, las dependencias entre atributos) o <em>topología</em> y <em>forma</em> (caminos en redes, formas en espacios).</p>
      <p>Las tareas se materializan con la <a href="tema.html?id=filter-sort-search">interacción de filtrar, ordenar y buscar</a> y se enmarcan en el segundo nivel del <a href="tema.html?id=munzner-nested-model">modelo anidado</a>.</p>`,
  });
})();
