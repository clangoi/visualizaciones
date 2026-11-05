(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const NIV = [
    { n: 'Dominio', sub: 'situación del dominio', color: C.s1, decide: 'Quiénes son los usuarios, qué problema tienen y qué hacen hoy.', salida: 'descripción del problema y de la población', preg: '¿Vale la pena resolver este problema?' },
    { n: 'Abstracción', sub: 'datos y tareas', color: C.s3, decide: 'Qué datos hay (tipos, atributos) y qué tareas genéricas se hacen con ellos (buscar, comparar, resumir).', salida: 'tabla de datos y lista de tareas abstractas', preg: '¿Qué datos mostrar y por qué?' },
    { n: 'Idioma visual', sub: 'codificación e interacción', color: C.s7, decide: 'Cómo se dibuja (marcas y canales) y cómo se manipula (filtrar, navegar, seleccionar).', salida: 'diseño de la visualización', preg: '¿Cómo mostrarlo y cómo interactuar?' },
    { n: 'Algoritmo', sub: 'implementación', color: C.s2, decide: 'Cómo se calcula y se dibuja de forma eficiente: estructuras, complejidad, memoria.', salida: 'programa que ejecuta el diseño', preg: '¿Cómo construirlo para que sea rápido?' },
  ];
  const CASOS = {
    epi: ['Epidemiólogas siguen brotes y deben decidir dónde reforzar vacunación.', 'Tabla de casos (fecha, comuna, edad) + red de contactos; tareas: localizar focos, comparar comunas, ver tendencias.', 'Mapa coroplético de incidencia enlazado con una línea de tiempo; filtro por rango de fechas.', 'Agregación por comuna en el servidor y dibujo en canvas para miles de casos.'],
    bici: ['La municipalidad quiere reubicar estaciones de bicicletas compartidas.', 'Flujos origen–destino entre estaciones (red dirigida y ponderada) + datos espaciales; tareas: identificar desbalances.', 'Mapa con símbolos proporcionales y matriz origen–destino; tooltip con detalle.', 'Índice espacial para consultar las estaciones visibles al hacer zoom.'],
    gen: ['Un laboratorio compara la expresión de miles de genes entre tratamientos.', 'Matriz genes × muestras de valores cuantitativos; tareas: encontrar grupos y valores atípicos.', 'Mapa de calor con filas agrupadas y dendrograma; brushing sobre un grupo.', 'Agrupamiento jerárquico \\(O(n^2)\\) con muestreo para vistas previas.'],
  };

  /* ---------- Fig. 1: los cuatro niveles ---------- */

  function montarNiveles(cuerpo) {
    let sel = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Nivel', valor: '0', opciones: NIV.map((n, i) => [String(i), `${i + 1}. ${n.n}`]), alCambiar: (v) => { sel = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 430 : 300) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, NIV.map((n) => ({ color: n.color, texto: n.n })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nivel (o elíjalo arriba). El nivel superior define el problema que debe resolver el inferior; los errores se propagan hacia abajo, y la validación de cada nivel mira hacia arriba.');
    let cajas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancho = W < 560, bw = ancho ? W - 24 : 240, bh = ancho ? 52 : 56, gap = ancho ? 14 : 12;
      cajas = [];
      NIV.forEach((n, i) => {
        const x = 12, y = 10 + i * (bh + gap);
        ctx.fillStyle = VIZ.alfa(n.color, sel === i ? 0.3 : 0.12); ctx.strokeStyle = n.color; ctx.lineWidth = sel === i ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 6); ctx.fill(); ctx.stroke();
        V.rotulo(ctx, `${i + 1}. ${n.n}`, x + 12, y + 20, { peso: 700, tam: 13, color: C.tinta }); V.rotulo(ctx, n.sub, x + 12, y + 40, { tam: 11 });
        cajas.push({ x, y, w: bw, h: bh, i });
        if (i < 3) { const ax = x + bw / 2; ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax - 14, y + bh); ctx.lineTo(ax - 14, y + bh + gap); ctx.moveTo(ax - 18, y + bh + gap - 5); ctx.lineTo(ax - 14, y + bh + gap); ctx.lineTo(ax - 10, y + bh + gap - 5); ctx.stroke(); ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax + 14, y + bh + gap); ctx.lineTo(ax + 14, y + bh); ctx.moveTo(ax + 10, y + bh + 5); ctx.lineTo(ax + 14, y + bh); ctx.lineTo(ax + 18, y + bh + 5); ctx.stroke(); ctx.setLineDash([]); }
      });
      if (!ancho) {
        const x = 12 + bw + 28, w = W - x - 12, n = NIV[sel];
        ctx.fillStyle = C.fondo2; ctx.fillRect(x, 10, w, H - 20);
        ctx.fillStyle = n.color; ctx.fillRect(x, 10, 4, H - 20);
        const lin = (t, y, o) => V.rotulo(ctx, t, x + 16, y, o);
        lin(`${sel + 1}. ${n.n}`, 32, { peso: 700, tam: 14, color: C.tinta });
        const parrafo = (t, y0) => { const pal = t.split(' '); let l = '', y = y0; for (const p of pal) { if ((l + p).length * 6.4 > w - 36) { lin(l, y, { tam: 11, color: C.tinta2 }); l = ''; y += 16; } l += p + ' '; } lin(l, y, { tam: 11, color: C.tinta2 }); return y; };
        lin('SE DECIDE', 66, { peso: 600, tam: 10, color: C.apagado }); let y = parrafo(n.decide, 84);
        lin('PRODUCE', y + 28, { peso: 600, tam: 10, color: C.apagado }); y = parrafo(n.salida, y + 46);
        lin('PREGUNTA', y + 28, { peso: 600, tam: 10, color: C.apagado }); parrafo(n.preg, y + 46);
      }
      registro.textContent = `${sel + 1}. ${NIV[sel].n} (${NIV[sel].sub}): ${NIV[sel].decide} Produce: ${NIV[sel].salida}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const b = V.bajo(cajas, x, y); if (b) { sel = b.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = V.bajo(cajas, x, y); lienzo.canvas.style.cursor = b ? 'pointer' : 'default'; if (!b) return tip.ocultar(); tip.mostrar(x, y, `<b>${NIV[b.i].n}</b><br>${NIV[b.i].preg}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: un caso recorrido nivel por nivel ---------- */

  function montarCaso(cuerpo) {
    let caso = 'epi', etapa = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Caso', valor: caso, opciones: [['epi', 'Vigilancia epidemiológica'], ['bici', 'Bicicletas compartidas'], ['gen', 'Expresión genética']], alCambiar: (v) => { caso = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Niveles completados', min: 1, max: 4, valor: etapa, alCambiar: (v) => { etapa = v; dibujar(); } });
    const cont = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(cont);
    cuerpo.dataset.sinLeyenda = 'tabla textual: cada fila es un nivel';
    VIZ.nota(cuerpo, 'Reduzca los niveles completados: sin los de arriba, los de abajo no tienen qué justificar. Cambie de caso y compare cómo el mismo marco da respuestas distintas.');
    function dibujar() {
      const filas = NIV.map((n, i) => VIZ.el('tr', { class: i < etapa ? '' : 'tachada' }, VIZ.el('th', { class: 'izq' }, `${i + 1}. ${n.n}`), VIZ.el('td', { html: i < etapa ? CASOS[caso][i] : '<i>pendiente: depende del nivel anterior</i>' })));
      cont.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' }, ...filas));
      if (window.renderMathInElement) window.renderMathInElement(cont, { delimiters: [{ left: '\\(', right: '\\)', display: false }] });
    }
    dibujar();
  }

  VIZ.registrarTema('munzner-nested-model', {
    intro: String.raw`
      <p>Diseñar una visualización no es elegir un gráfico: es tomar <strong>cuatro grupos de decisiones encadenadas</strong>. El <em>modelo anidado</em> de Tamara Munzner los ordena de lo más abstracto a lo más concreto: el problema del dominio, la abstracción de datos y tareas, el diseño visual y de interacción, y el algoritmo.</p>
      <p>«Anidado» significa que la salida de cada nivel es la entrada del siguiente. Si el nivel de arriba se equivoca, lo de abajo puede ser impecable y aun así inútil.</p>`,
    visualizaciones: [
      { titulo: 'Los cuatro niveles del modelo', descripcion: 'Recorra los niveles y lea qué se decide en cada uno, qué produce y qué pregunta responde.', montar: montarNiveles },
      { titulo: 'Un caso de principio a fin', descripcion: 'Elija un caso y reduzca los niveles completados para ver cómo cada decisión depende de la anterior.', montar: montarCaso },
    ],
    teoria: String.raw`
      <h2>Niveles</h2>
      <table>
        <tr><th>Nivel</th><th>Decisión</th><th>Entrega</th></tr>
        <tr><td>1. Caracterización del dominio</td><td>quiénes son, qué problema tienen</td><td>situación del dominio</td></tr>
        <tr><td>2. Abstracción de datos y tareas</td><td>qué datos y qué tareas genéricas</td><td>tipos de datos, acciones y objetivos</td></tr>
        <tr><td>3. Codificación e interacción</td><td>marcas, canales, controles</td><td>diseño de la vista</td></tr>
        <tr><td>4. Algoritmo</td><td>cómo calcularla y dibujarla</td><td>implementación</td></tr>
      </table>
      <h2>Por qué anidado</h2>
      <p>Sea \(N_k\) la salida del nivel \(k\). El nivel \(k+1\) solo tiene sentido dado \(N_k\):
      \[ N_1 \to N_2 \to N_3 \to N_4, \qquad \text{válido}(N_{k+1}) \Rightarrow \text{depende de válido}(N_k). \]
      Un error en \(N_k\) invalida todo lo posterior, aunque los niveles inferiores se hayan hecho bien (ver <a href="tema.html?id=validation-threats">amenazas de validez</a>).</p>
      <h2>Separar el problema de la solución</h2>
      <p>El nivel 2 traduce el vocabulario del dominio («gen», «comuna») a un vocabulario común de datos y tareas (tabla, red, comparar, resumir). Esa traducción permite reutilizar diseños entre dominios distintos; ver <a href="tema.html?id=dataset-types">tipos de conjuntos de datos</a> y <a href="tema.html?id=analysis-tasks">tareas de análisis</a>.</p>
      <h2>Diseño frente a implementación</h2>
      <p>Los niveles 3 y 4 son independientes: una misma codificación puede implementarse con algoritmos de distinto costo, y un mismo algoritmo puede servir a codificaciones distintas. Por eso el nivel 3 se evalúa por su efectividad (ver <a href="tema.html?id=perceptual-accuracy">percepción</a>) y el 4 por su eficiencia.</p>`,
  });
})();
