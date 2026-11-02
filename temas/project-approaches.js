(function () {
  'use strict';
  const { color: C } = VIZ;

  const ENF = [
    { id: 'data', nombre: 'Data-Driven', color: C.s1, pos: 0.1, eje: 'exploración pura',
      inicio: 'Hay un registro de eventos disponible y se quiere ver qué contiene.',
      riesgo: 'Resultados interesantes pero sin dueño ni decisión asociada; se pierde tiempo en datos irrelevantes.',
      producto: 'Mapa del proceso, variantes y hallazgos exploratorios para generar hipótesis.',
      conviene: 'Se conoce poco el proceso o se evalúa si vale la pena un proyecto.' },
    { id: 'question', nombre: 'Question-Driven', color: C.s2, pos: 0.5, eje: 'hipótesis a contrastar',
      inicio: 'Una o varias preguntas concretas del negocio («¿por qué se retrasan los pedidos urgentes?»).',
      riesgo: 'La pregunta puede no poder responderse con los datos que existen, o estar mal formulada.',
      producto: 'Respuestas fundadas a cada pregunta, con las medidas y los filtros que las sustentan.',
      conviene: 'Hay sospechas o dudas específicas y alguien que las formuló.' },
    { id: 'goal', nombre: 'Goal-Driven', color: C.s6, pos: 0.9, eje: 'verificación de metas',
      inicio: 'Una meta medible (KPI con valor objetivo y plazo) que la organización quiere alcanzar.',
      riesgo: 'Se pierde la visión del proceso completo por mirar solo el indicador; metas mal fijadas distorsionan.',
      producto: 'Brechas respecto de la meta, causas atribuibles y un plan de mejoras con impacto esperado.',
      conviene: 'Hay compromiso gerencial con un objetivo y se conoce el indicador que lo mide.' },
  ];

  // Regla de decisión explícita: la meta manda, luego las preguntas, luego los datos.
  function recomendar(meta, preguntas, datos) {
    if (meta) return { id: 'goal', camino: ['¿Hay una meta medible? sí'], porque: 'Hay una meta con KPI: el proyecto se organiza por la brecha respecto de ella.' };
    if (preguntas) return { id: 'question', camino: ['¿Hay una meta medible? no', '¿Hay preguntas concretas? sí'], porque: 'No hay meta, pero sí preguntas específicas: se analiza lo necesario para contestarlas.' };
    if (datos) return { id: 'data', camino: ['¿Hay una meta medible? no', '¿Hay preguntas concretas? no', '¿Hay registro disponible? sí'], porque: 'Sin meta ni preguntas, pero con datos: se explora para generar hipótesis.' };
    return { id: null, camino: ['¿Hay una meta medible? no', '¿Hay preguntas concretas? no', '¿Hay registro disponible? no'], porque: 'No hay punto de partida: primero hay que planificar y justificar el proyecto (etapa 0 de L*) y conseguir datos.' };
  }

  /* ---------- Fig. 1: comparar y elegir ---------- */

  function montarComparar(cuerpo) {
    let meta = false, preguntas = true, datos = true, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas([
      { clave: 'meta', texto: 'Hay una meta medible (KPI con valor objetivo)', activo: meta },
      { clave: 'preguntas', texto: 'Hay preguntas concretas', activo: preguntas },
      { clave: 'datos', texto: 'Hay un registro de eventos disponible', activo: datos },
    ], (e) => { meta = e.meta; preguntas = e.preguntas; datos = e.datos; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.22, altoMin: 110, altoMax: 150 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ENF.map((e) => ({ color: e.color, texto: e.nombre, forma: 'punto' })).concat([{ color: C.s2, texto: 'anillo: enfoque recomendado', forma: 'linea' }]));
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque o desmarque las condiciones de su situación: la regla (meta, luego preguntas, luego datos) elige un enfoque. Pase el cursor sobre un punto del eje para ver su descripción.');

    let rec = null, ejeX = null;
    function dibujar() {
      rec = recomendar(meta, preguntas, datos);
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const x0 = 30, x1 = W - 30, y = H * 0.5;
      ejeX = (p) => x0 + p * (x1 - x0);
      ctx.strokeStyle = C.eje; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('exploración', x0 - 20, H - 16);
      ctx.textAlign = 'right'; ctx.fillText('verificación', x1 + 20, H - 16);
      ENF.forEach((e, i) => {
        const x = ejeX(e.pos);
        if (e.id === rec.id) { ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 15, 0, 2 * Math.PI); ctx.stroke(); }
        VIZ.marcador(ctx, x, y, e.color, i === hover ? 11 : 9);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(e.nombre.split('-')[0], x, y - 20);
      });
      const filas = [['Punto de partida', 'inicio'], ['Riesgo principal', 'riesgo'], ['Producto esperado', 'producto'], ['Cuándo conviene', 'conviene']];
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th'), ...ENF.map((e) => VIZ.el('th', { style: { color: e.color } }, e.nombre)))),
        VIZ.el('tbody', null, ...filas.map(([t, k]) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, t),
          ...ENF.map((e) => VIZ.el('td', { style: e.id === rec.id ? { background: VIZ.alfa(e.color, 0.12) } : null }, e[k])))))));
      registro.textContent = (rec.id ? `Recomendado: ${ENF.find((e) => e.id === rec.id).nombre}. ` : 'Sin enfoque posible. ') + rec.porque;
      lectura.set([
        ['recorrido de la regla', rec.camino.join(' › ')],
        ['enfoque', rec.id ? ENF.find((e) => e.id === rec.id).nombre : '—'],
        ['condiciones cumplidas', `${[meta, preguntas, datos].filter(Boolean).length} de 3`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!ejeX) return;
      const { x, y } = lienzo.posicion(ev);
      const i = ENF.findIndex((e) => Math.abs(x - ejeX(e.pos)) < 18 && Math.abs(y - lienzo.alto * 0.5) < 22);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const e = ENF[i];
      tip.mostrar(x, y, `<b>${e.nombre}</b><br>${e.eje}<br>${e.inicio}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: clasificar casos ---------- */

  const CASOS = [
    { t: 'Una empresa exportó tres años de su ERP y quiere ver qué hay en esos datos, sin hipótesis previas.', r: 'data', p: 'Hay datos y ninguna pregunta ni meta: se explora.' },
    { t: 'Un hospital quiere saber por qué el 20 % de los pacientes espera más de 4 h antes de la primera evaluación.', r: 'question', p: 'Es una pregunta específica con un fenómeno observado que explicar.' },
    { t: 'Una aseguradora debe bajar el tiempo de liquidación de siniestros de 18 a 10 días este año.', r: 'goal', p: 'Hay un KPI con valor actual, objetivo y plazo.' },
    { t: 'Un auditor comprueba si todo pedido de más de 10 000 pasó por la aprobación gerencial.', r: 'question', p: 'Es una pregunta puntual que se responde verificando una regla.' },
    { t: 'Una universidad dispone de los clics de su plataforma y quiere descubrir qué trayectorias siguen los estudiantes.', r: 'data', p: 'Parte de los datos disponibles para descubrir patrones desconocidos.' },
    { t: 'La dirección fija como meta que el 95 % de las entregas llegue a tiempo y pide qué cambiar para lograrlo.', r: 'goal', p: 'La meta (95 %) organiza todo el análisis.' },
    { t: 'Un equipo de TI se pregunta si los tickets reasignados más de dos veces tardan más en cerrarse.', r: 'question', p: 'Es una hipótesis contrastable con una medida concreta.' },
    { t: 'Un nuevo programa cargó los registros del centro de llamadas y el analista prueba qué mapa de proceso resulta.', r: 'data', p: 'Se empieza por los datos, sin una pregunta definida.' },
  ];

  function montarClasificar(cuerpo) {
    let resp = CASOS.map(() => null), sel = 0, corregido = false;
    const ctl = VIZ.controles(cuerpo);
    ENF.forEach((e) => ctl.boton(e.nombre, () => { resp[sel] = e.id; if (sel < CASOS.length - 1 && !corregido) sel++; dibujar(); }));
    ctl.boton('Corregir', () => { corregido = true; dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => { resp = CASOS.map(() => null); sel = 0; corregido = false; dibujar(); });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'clasificación correcta' }, { color: C.s8, texto: 'clasificación incorrecta' },
      ...ENF.map((e) => ({ color: e.color, texto: e.nombre, forma: 'punto' })),
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un caso para elegirlo y luego en uno de los tres enfoques; el cursor avanza al siguiente. «Corregir» muestra los aciertos y el motivo. Fíjese en la primera frase de cada caso: ¿datos, pregunta o meta?');
    function dibujar() {
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
        VIZ.el('thead', null, VIZ.el('tr', null, ...['#', 'Caso', 'Su respuesta', corregido ? 'Resultado' : ''].map((t) => VIZ.el('th', null, t)))),
        VIZ.el('tbody', null, ...CASOS.map((c, i) => {
          const e = ENF.find((x) => x.id === resp[i]);
          const ok = resp[i] === c.r;
          return VIZ.el('tr', { class: 'clicable' + (i === sel ? ' activa' : ''), onclick: () => { sel = i; dibujar(); } },
            VIZ.el('td', null, i + 1), VIZ.el('td', null, c.t),
            VIZ.el('td', { style: e ? { color: e.color, fontWeight: '600' } : null }, e ? e.nombre : '—'),
            VIZ.el('td', { style: corregido && resp[i] ? { color: ok ? C.s6 : C.s8 } : null },
              corregido ? (resp[i] ? (ok ? '✓ ' : `✗ era ${ENF.find((x) => x.id === c.r).nombre}. `) : 'sin responder. ') + c.p : ''));
        }))));
      const hechos = resp.filter(Boolean).length, aciertos = resp.filter((r, i) => r === CASOS[i].r).length;
      registro.textContent = corregido ? `Aciertos: ${aciertos} de ${hechos} clasificados.` : `Caso ${sel + 1} seleccionado: elija el enfoque que corresponde a su punto de partida.`;
      lectura.set([['casos clasificados', `${hechos} de ${CASOS.length}`], ['aciertos', corregido ? String(aciertos) : '—'], ['pendientes', String(CASOS.length - hechos)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('project-approaches', {
    intro: String.raw`
      <p>Un proyecto de minería de procesos puede empezar de tres maneras: desde los <strong>datos</strong> que ya existen (<em>data-driven</em>), desde una
      <strong>pregunta</strong> que alguien quiere responder (<em>question-driven</em>) o desde una <strong>meta</strong> que la organización quiere alcanzar
      (<em>goal-driven</em>). El punto de partida determina qué se extrae, qué se mide y cuándo se da por terminado el trabajo.</p>
      <p>Dicho de otro modo: el primer enfoque <em>explora</em>, el segundo <em>contrasta hipótesis</em> y el tercero <em>verifica el avance hacia una meta</em>.
      Cada uno tiene riesgos distintos, y los proyectos reales suelen combinarlos en el tiempo.</p>`,
    visualizaciones: [
      {
        titulo: 'Los tres enfoques y cuándo elegir cada uno',
        descripcion: 'Cambie las condiciones de su situación y vea qué enfoque propone la regla de decisión y cómo se comparan sus riesgos y productos.',
        montar: montarComparar,
      },
      {
        titulo: 'Clasifique casos según su punto de partida',
        descripcion: 'Ocho situaciones reales: asigne a cada una un enfoque y compare con la corrección razonada.',
        montar: montarClasificar,
      },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>Data-Driven</th><th>Question-Driven</th><th>Goal-Driven</th></tr>
        <tr><td>Punto de partida</td><td>los datos</td><td>las preguntas</td><td>las metas / KPIs</td></tr>
        <tr><td>Actividad dominante</td><td>exploración</td><td>contraste de hipótesis</td><td>verificación y cierre de brechas</td></tr>
        <tr><td>Primer entregable</td><td>mapa y variantes</td><td>respuesta a cada pregunta</td><td>brecha frente a la meta</td></tr>
        <tr><td>Riesgo</td><td>hallazgos sin dueño</td><td>pregunta sin datos</td><td>mirar solo el indicador</td></tr>
      </table>
      <h2>Regla de decisión</h2>
      <pre><code>si hay una meta medible:           devolver Goal-Driven
si hay preguntas concretas:        devolver Question-Driven
si hay un registro disponible:     devolver Data-Driven
devolver «planificar primero (etapa 0 de L*)»</code></pre>
      <p>El orden refleja cuánto restringe cada punto de partida el trabajo: una meta fija el indicador y el plazo; una pregunta fija qué medir; solo los datos dejan todo abierto.</p>
      <h2>Exploración y verificación</h2>
      <p>Un enfoque <em>data-driven</em> genera hipótesis; uno <em>question-driven</em> las pone a prueba; uno <em>goal-driven</em> comprueba si un cambio acerca el proceso al valor objetivo de un KPI
      (ver <a href="tema.html?id=kpi-definition">definición de KPIs</a>). Es habitual comenzar explorando para formular preguntas, y luego fijar metas para cuantificar la mejora
      (<a href="tema.html?id=improvement-impact">oportunidades de mejora e impacto</a>).</p>
      <div class="recuadro"><p><strong>Advertencia.</strong> Explorar sin criterio de término es un riesgo: sin al menos una pregunta provisional, cualquier diferencia entre variantes parece un hallazgo.</p></div>
      <p>Estos enfoques se encajan en el ciclo de proyecto del <a href="tema.html?id=l-star-lifecycle">modelo L*</a>, cuya etapa 0 justifica el proyecto y fija estas preguntas o metas.</p>`,
  });
})();
