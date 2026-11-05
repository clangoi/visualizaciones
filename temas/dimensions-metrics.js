(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;
  const FILAS = V.ventas(1);

  const DIMS = { region: ['Región', (f) => f.region], cat: ['Categoría', (f) => f.cat], mes: ['Mes', (f) => V.MESES[f.mes]] };
  const METS = {
    ventas: ['Ventas (M$)', (f) => f.ventas], unidades: ['Unidades', (f) => f.unidades], pedidos: ['Pedidos', (f) => f.pedidos],
    margen: ['Margen (ventas − costo)', (f) => f.ventas - f.costo],
  };

  /* ---------- Fig. 1: dimensión × métrica × agregación ---------- */

  function montarCubo(cuerpo) {
    const e = { dim: 'region', met: 'ventas', agg: 'suma' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Dimensión (cómo se corta)', valor: e.dim, opciones: Object.entries(DIMS).map(([k, v]) => [k, v[0]]), alCambiar: (v) => { e.dim = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Métrica (qué se mide)', valor: e.met, opciones: Object.entries(METS).map(([k, v]) => [k, v[0]]), alCambiar: (v) => { e.met = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Agregación', valor: e.agg, opciones: [['suma', 'Suma'], ['promedio', 'Promedio'], ['max', 'Máximo'], ['conteo', 'Conteo de filas']], alCambiar: (v) => { e.agg = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'serie única; el eje y las barras nombran la métrica';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La tabla tiene 144 filas (12 meses × 4 regiones × 3 categorías). Cada combinación de dimensión, métrica y agregación es un gráfico distinto; pruebe «conteo» para ver que no depende de la métrica.');
    let rects = [], datos = [];
    function dibujar() {
      lienzo.limpiar();
      datos = V.agrupar(FILAS, DIMS[e.dim][1], METS[e.met][1], e.agg);
      const g = V.barras(lienzo, datos.map((d) => ({ nombre: d.clave, valor: d.valor })), { color: () => C.s1 });
      rects = g.rects;
      const tot = datos.reduce((s, d) => s + d.valor, 0);
      lectura.set([['filas agregadas', String(FILAS.length)], ['grupos', String(datos.length)], ['filas por grupo', datos.map((d) => d.n)[0] + ''], [e.agg === 'suma' ? 'total' : 'valor máximo del gráfico', VIZ.fmt(e.agg === 'suma' ? tot : Math.max(...datos.map((d) => d.valor)), 4)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = V.bajo(rects, x, y);
      if (!h) return tip.ocultar();
      tip.mostrar(x, y, `${DIMS[e.dim][0]}: <b>${datos[h.i].clave}</b><br>${e.agg} de ${METS[e.met][0]}: <b>${VIZ.fmt(datos[h.i].valor, 4)}</b><br>${datos[h.i].n} filas`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: razón de sumas frente a promedio de razones ---------- */

  function montarRazones(cuerpo) {
    let modo = 'correcto';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cálculo del ticket promedio por región', valor: modo, opciones: [['correcto', 'Σ ventas ÷ Σ pedidos (campo calculado)'], ['promedio', 'promedio de los tickets de cada fila']], alCambiar: (v) => { modo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cálculo elegido' }, { color: C.s2, texto: 'cálculo correcto (referencia)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una métrica derivada como razón no debe promediarse fila a fila: las filas con pocos pedidos pesarían igual que las grandes. La línea naranja marca el cálculo correcto.');
    let rects = [], datos = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ok = V.agrupar(FILAS, (f) => f.region, () => 0, 'suma').map((d) => {
        const filas = FILAS.filter((f) => f.region === d.clave);
        const s = filas.reduce((a, f) => a + f.ventas, 0), p = filas.reduce((a, f) => a + f.pedidos, 0);
        return { clave: d.clave, ok: s / p, mal: filas.reduce((a, f) => a + f.ventas / f.pedidos, 0) / filas.length };
      });
      datos = ok;
      const g = V.barras(lienzo, ok.map((d) => ({ nombre: d.clave, valor: modo === 'correcto' ? d.ok : d.mal })), { max: Math.max(...ok.map((d) => Math.max(d.ok, d.mal))) * 1.15, formato: (v) => VIZ.fmt(v, 2) });
      rects = g.rects;
      ok.forEach((d, i) => { const r = g.rects[i], y = g.escala(d.ok); ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r.x - 2, y); ctx.lineTo(r.x + r.w + 2, y); ctx.stroke(); });
      const err = ok.map((d) => (Math.abs(d.mal - d.ok) / d.ok) * 100);
      lectura.set([['error relativo máximo del promedio de razones', `${VIZ.fmt(Math.max(...err), 3)} %`], ['región más afectada', ok[err.indexOf(Math.max(...err))].clave]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = V.bajo(rects, x, y);
      if (!h) return tip.ocultar();
      const d = datos[h.i];
      tip.mostrar(x, y, `<b>${d.clave}</b><br>Σ ventas ÷ Σ pedidos: <b>${VIZ.fmt(d.ok, 4)}</b><br>promedio de razones: <b>${VIZ.fmt(d.mal, 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dimensions-metrics', {
    intro: String.raw`
      <p>Una herramienta de dashboards como <strong>Looker Studio</strong> (antes Google Data Studio) no dibuja filas: <em>agrupa y resume</em>. Para eso separa cada columna de la fuente de datos en dos roles:
      las <strong>dimensiones</strong>, que dicen cómo cortar (región, mes, categoría), y las <strong>métricas</strong>, que son números que se agregan (ventas, pedidos).</p>
      <p>Un gráfico es una elección de dimensión, métrica y agregación. Entender ese trío evita los errores más comunes de los reportes.</p>`,
    visualizaciones: [
      { titulo: 'Dimensión, métrica y agregación', descripcion: 'Elija cómo cortar la tabla de ventas, qué medir y cómo agregar. Observe que «conteo» ignora la métrica.', montar: montarCubo },
      { titulo: 'Un campo calculado que engaña', descripcion: 'Compare el ticket promedio calculado como razón de sumas y como promedio de razones fila a fila.', montar: montarRazones },
    ],
    teoria: String.raw`
      <h2>Fuente de datos y campos</h2>
      <p>Una fuente de datos (hoja de cálculo, base de datos, archivo CSV) aporta campos con un tipo (texto, número, fecha). El informe los clasifica como <em>dimensiones</em> (categóricos o de fecha, que definen grupos) o <em>métricas</em> (cuantitativos, que se agregan). Los mismos datos se ven distinto según ese rol: el <em>mes</em> puede ser dimensión; el <em>número de pedidos</em>, métrica.</p>
      <h2>Agregación</h2>
      <p>Para una dimensión \(D\) con valores \(g\) y una métrica \(m\), el gráfico calcula
      \[ \text{valor}(g) = \operatorname{agg}\bigl(\{\, m(f) : f \in \text{filas},\ D(f) = g \,\}\bigr), \]
      con \(\operatorname{agg} \in \{\Sigma, \text{promedio}, \max, \text{conteo}\}\). Cada grupo es una barra, un punto o una porción.</p>
      <h2>Campos calculados</h2>
      <p>Una métrica derivada se define a partir de otras, por ejemplo el ticket promedio \(T = \dfrac{\sum \text{ventas}}{\sum \text{pedidos}}\). Es incorrecto promediar los \(T_i\) de cada fila:
      \[ \frac{\sum_i v_i}{\sum_i p_i} \;\neq\; \frac{1}{n}\sum_i \frac{v_i}{p_i}, \]
      salvo que todos los \(p_i\) sean iguales. La razón de sumas es un <em>promedio ponderado</em> por pedidos.</p>
      <div class="recuadro"><strong>Regla.</strong> Agregue primero los componentes y divida después.</div>
      <h2>Siguiente paso</h2>
      <p>Con las métricas definidas se agregan filtros y controles: <a href="tema.html?id=dashboard-filters-controls">filtros y comparaciones</a>. El tipo de cada campo se decide en <a href="tema.html?id=data-types-attributes">tipos de datos</a>.</p>`,
  });
})();
