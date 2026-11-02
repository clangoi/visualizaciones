(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Productos del ciclo L*: los tres primeros vienen de fuera del proyecto.
  const PRODUCTOS = {
    interes: 'interés y preguntas',
    fuentes: 'sistemas fuente',
    enlinea: 'datos en línea',
    plan: 'plan',
    registro: 'registro de eventos',
    flujo: 'modelo de flujo',
    integrado: 'modelo integrado',
    soporte: 'soporte operacional',
  };
  const EXTERNOS = ['interes', 'fuentes', 'enlinea'];

  const ETAPAS = [
    { id: 'e0', corto: '0 Planificar', nombre: 'Etapa 0: planificar y justificar', consume: ['interes'], produce: ['plan'],
      detalle: 'Se justifica el proyecto, se acuerdan las preguntas y se identifican los sistemas que registran el proceso. Sin este paso el análisis no tiene destinatario ni criterio de éxito.' },
    { id: 'e1', corto: '1 Extraer', nombre: 'Etapa 1: extraer datos', consume: ['plan', 'fuentes'], produce: ['registro'],
      detalle: 'Se define el alcance del registro (casos, actividades, atributos) y se extraen eventos, modelos de referencia y conocimiento del dominio. Rara vez sale bien a la primera.' },
    { id: 'e2', corto: '2 Modelar flujo', nombre: 'Etapa 2: modelo de flujo y conexión con el registro', consume: ['registro'], produce: ['flujo'],
      detalle: 'Se descubre o se dibuja el modelo de control-flow y se conecta con el registro mediante reproducción: los eventos se alinean con el modelo y aparecen la conformidad y los problemas de datos.' },
    { id: 'e3', corto: '3 Integrar', nombre: 'Etapa 3: modelo integrado', consume: ['flujo'], produce: ['integrado'],
      detalle: 'Al modelo de flujo se le suman las perspectivas de datos, tiempo y recursos: reglas de decisión, tiempos de espera y servicio, roles. Es la base para diagnosticar y proponer mejoras.' },
    { id: 'e4', corto: '4 Operar', nombre: 'Etapa 4: soporte operacional', consume: ['integrado', 'enlinea'], produce: ['soporte'],
      detalle: 'El modelo integrado se usa con casos en curso: detectar desvíos al instante, predecir el tiempo restante y recomendar la siguiente acción. Exige datos actualizados en línea.' },
  ];

  // Guion de un proyecto: la etapa 2 destapa un problema de datos y obliga a volver a la 1.
  const GUION = [
    [0, 'Se justifica el proyecto: reducir el tiempo de atención de reclamos. Se produce el plan con las preguntas.'],
    [1, 'Primera extracción: se obtiene un registro desde el sistema de reclamos.'],
    [2, 'Al conectar el registro con el modelo, varias actividades aparecen sin marca de tiempo: hay que volver a extraer.'],
    [1, 'Iteración: se vuelve a extraer incluyendo la tabla de auditoría con las marcas de tiempo.'],
    [2, 'El modelo de flujo se conecta ahora con el 98 % de los casos.'],
    [3, 'Se añaden tiempos, recursos y reglas de decisión al modelo de flujo.'],
    [4, 'Con el modelo integrado y los datos en línea se activa la predicción del tiempo restante.'],
  ];

  const lista = (ids) => ids.map((i) => PRODUCTOS[i]).join('; ');

  /* ---------- Fig. 1: recorrer el ciclo ---------- */

  function montarCiclo(cuerpo) {
    let paso = -1, sel = null, visitadas = new Set(), iteraciones = 0, ultima = null;
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 700 ? 380 : 200) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'etapa en curso' },
      { color: VIZ.alfa(C.s6, 0.18), borde: C.s6, texto: 'etapa ya realizada' },
      { color: C.superficie, borde: C.inactivo, texto: 'etapa pendiente' },
      { color: C.s2, texto: 'transición recién hecha', forma: 'linea' },
      { color: C.apagado, texto: 'iteración posible (flecha discontinua)', forma: 'linea' },
    ]);
    const panel = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(panel);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca el proyecto de ejemplo paso a paso. Haga clic en cualquier etapa para ver qué consume y qué produce; la etapa 2 destapa un problema de datos y obliga a iterar.');

    function iniciar() {
      paso = -1; sel = null; visitadas = new Set(); iteraciones = 0; ultima = null;
      registro.dataset.msg = '';
      return (function* () {
        for (let k = 0; k < GUION.length; k++) {
          const [e, msg] = GUION[k];
          const previa = k ? GUION[k - 1][0] : null;
          if (previa !== null && e < previa) iteraciones++;
          ultima = previa === null ? null : [previa, e];
          paso = k; sel = null; visitadas.add(e);
          registro.dataset.msg = `Paso ${k + 1} de ${GUION.length}: ${msg}`;
          yield;
        }
      })();
    }

    let geo = null;
    function posiciones(W) {
      const pos = {};
      ETAPAS.forEach((e, i) => { pos[e.id] = W >= 700 ? { x: i / 4, y: 0.5 } : { x: i % 2 ? 0.78 : 0.22, y: i / 4 }; });
      return pos;
    }
    function dibujar() {
      lienzo.limpiar();
      const actual = paso >= 0 ? GUION[paso][0] : -1;
      const nodos = ETAPAS.map((e, i) => (i === actual
        ? { id: e.id, tipo: 'act', etiqueta: e.corto, relleno: C.s1, borde: C.s1, colorTexto: C.sobre }
        : visitadas.has(i) ? { id: e.id, tipo: 'act', etiqueta: e.corto, relleno: VIZ.alfa(C.s6, 0.18), borde: C.s6 }
          : { id: e.id, tipo: 'act', etiqueta: e.corto, borde: C.inactivo, colorTexto: C.apagado }));
      const nuevo = (a, b) => ultima && ultima[0] === a && ultima[1] === b;
      const aristas = [];
      for (let i = 0; i < 4; i++) aristas.push(nuevo(i, i + 1) ? { de: ETAPAS[i].id, a: ETAPAS[i + 1].id, color: C.s2, ancho: 3 } : { de: ETAPAS[i].id, a: ETAPAS[i + 1].id });
      [[2, 1], [3, 2], [4, 3]].forEach(([a, b]) => aristas.push({ de: ETAPAS[a].id, a: ETAPAS[b].id, guiones: true, curva: 30, color: nuevo(a, b) ? C.s2 : C.apagado, ancho: nuevo(a, b) ? 3 : 1.5 }));
      geo = P.dibujarGrafo(lienzo, nodos, aristas, posiciones(lienzo.ancho), { fuente: 11 });
      const e = ETAPAS[sel !== null ? sel : Math.max(actual, 0)];
      panel.replaceChildren(
        VIZ.el('div', null, VIZ.el('b', null, e.nombre)),
        VIZ.el('div', null, 'Consume: ' + lista(e.consume)),
        VIZ.el('div', null, 'Produce: ' + lista(e.produce)),
        VIZ.el('div', null, e.detalle));
      registro.textContent = registro.dataset.msg || 'Pulse Un paso para comenzar el proyecto en la etapa 0.';
      lectura.set([
        ['paso del proyecto', `${Math.max(0, paso + 1)} de ${GUION.length}`],
        ['etapas distintas visitadas', `${visitadas.size} de 5`],
        ['iteraciones (vueltas atrás)', String(iteraciones)],
        ['esfuerzo repetido', paso < 0 ? '0 %' : `${Math.round(100 * (paso + 1 - visitadas.size) / (paso + 1))} % de los pasos`],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), n = P.nodoEn(geo, x, y);
      if (!n) return;
      sel = ETAPAS.findIndex((e) => e.id === n.id);
      dibujar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: dependencias entre productos ---------- */

  function montarDependencias(cuerpo) {
    // 0 ausente, 1 vigente, 2 obsoleto.
    let est = {}, corridas = 0, desperdicio = 0, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Reiniciar proyecto', () => { reiniciar(); }, { primario: true });
    ctl.boton('Ejecutar la siguiente posible', () => {
      const e = ETAPAS.findIndex((x) => x.consume.every((c) => est[c] === 1) && x.produce.some((p) => est[p] !== 1));
      if (e >= 0) ejecutar(e); else { mensaje = 'No hay una etapa pendiente cuyas entradas estén vigentes.'; dibujar(); }
    });
    cuerpo.dataset.sinLeyenda = 'las fichas verdes, amarillas y rojas se explican en la nota y en cada celda';
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ejecute las etapas en el orden que quiera. Ficha verde: producto vigente; amarilla: obsoleto (se hizo antes de que cambiara una entrada); roja: falta. Pruebe repetir la etapa 1 después de la 3: todo lo posterior queda obsoleto.');

    function reiniciar() {
      est = {};
      Object.keys(PRODUCTOS).forEach((k) => { est[k] = EXTERNOS.includes(k) ? 1 : 0; });
      corridas = 0; desperdicio = 0; mensaje = 'Proyecto nuevo: solo existen los insumos externos.';
      dibujar();
    }
    function ejecutar(i) {
      const e = ETAPAS[i];
      const faltan = e.consume.filter((c) => est[c] !== 1);
      if (faltan.length) { mensaje = `La ${e.nombre.split(':')[0].toLowerCase()} no puede ejecutarse: ${faltan.map((c) => PRODUCTOS[c] + (est[c] === 2 ? ' (obsoleto)' : ' (falta)')).join(', ')}.`; dibujar(); return; }
      const repite = e.produce.every((p) => est[p] === 1);
      corridas++;
      e.produce.forEach((p) => { est[p] = 1; });
      let invalidos = 0;
      for (let j = i + 1; j < ETAPAS.length; j++) ETAPAS[j].produce.forEach((p) => { if (est[p] === 1) { est[p] = 2; invalidos++; } });
      desperdicio += invalidos;
      mensaje = `${e.nombre.split(':')[0]} ${repite ? 'repetida' : 'ejecutada'}: ${lista(e.produce)} vigente.` + (invalidos ? ` ${invalidos} producto(s) posterior(es) quedan obsoletos y deben rehacerse.` : '');
      dibujar();
    }
    const ficha = (c) => (est[c] === 1 ? VIZ.ficha(PRODUCTOS[c], { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) })
      : est[c] === 2 ? VIZ.ficha(PRODUCTOS[c] + ' (obsoleto)', { color: C.s4, fondo: VIZ.alfa(C.s4, 0.18) })
        : VIZ.ficha(PRODUCTOS[c] + ' (falta)', { color: C.s8, tinta: C.s8 }));
    function dibujar() {
      const filas = ETAPAS.map((e, i) => VIZ.el('tr', null,
        VIZ.el('td', { class: 'izq' }, e.nombre.split(':')[0]),
        VIZ.el('td', { class: 'izq' }, VIZ.el('span', { class: 'fichas' }, ...e.consume.map(ficha))),
        VIZ.el('td', { class: 'izq' }, VIZ.el('span', { class: 'fichas' }, ...e.produce.map(ficha))),
        VIZ.el('td', null, VIZ.el('button', { type: 'button', class: 'boton', onclick: () => ejecutar(i) }, e.produce.every((p) => est[p] === 1) ? 'Repetir' : 'Ejecutar'))));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
        VIZ.el('thead', null, VIZ.el('tr', null, ...['Etapa', 'Consume', 'Produce', ''].map((t) => VIZ.el('th', null, t)))),
        VIZ.el('tbody', null, ...filas)));
      registro.textContent = mensaje;
      const vig = ETAPAS.filter((e) => e.produce.every((p) => est[p] === 1)).length;
      lectura.set([
        ['etapas con producto vigente', `${vig} de 5`],
        ['productos obsoletos', String(ETAPAS.filter((e) => e.produce.some((p) => est[p] === 2)).length)],
        ['ejecuciones de etapas', String(corridas)],
        ['trabajo invalidado', String(desperdicio)],
        ['recorrido mínimo', '5 ejecuciones'],
      ]);
    }
    reiniciar();
  }

  VIZ.registrarTema('l-star-lifecycle', {
    intro: String.raw`
      <p>El <strong>ciclo de vida L*</strong> (<em>life-cycle model</em>) propuesto por Wil van der Aalst organiza un proyecto de minería de procesos en etapas:
      se planifica y justifica, se extraen los datos, se construye el modelo de flujo y se conecta con el registro, se integra con otras perspectivas y,
      si hay datos en línea, se usa para dar soporte operacional.</p>
      <p>Lo importante no es el orden lineal sino las <strong>iteraciones</strong>: casi siempre las primeras versiones del registro tienen problemas que
      solo aparecen al conectarlo con un modelo, y cada vuelta atrás vuelve obsoleto lo que se construyó después.</p>`,
    visualizaciones: [
      {
        titulo: 'Un proyecto recorriendo el ciclo L*',
        descripcion: 'Reproduzca un proyecto de ejemplo y observe cuándo se vuelve a la etapa 1. Haga clic en una etapa para ver sus entradas y salidas.',
        montar: montarCiclo,
      },
      {
        titulo: 'Qué produce y qué consume cada etapa',
        descripcion: 'Ejecute etapas en cualquier orden. Si falta una entrada, la etapa no puede hacerse; si repite una temprana, las posteriores quedan obsoletas.',
        montar: montarDependencias,
      },
    ],
    teoria: String.raw`
      <h2>Las etapas</h2>
      <table>
        <tr><th>Etapa</th><th>Qué se hace</th><th>Produce</th></tr>
        <tr><td>0</td><td>Planificar y justificar el proyecto: preguntas, alcance, beneficios esperados</td><td>plan</td></tr>
        <tr><td>1</td><td>Extraer eventos, modelos de referencia y conocimiento del dominio</td><td>registro de eventos</td></tr>
        <tr><td>2</td><td>Crear el modelo de control-flow y conectar el registro con él</td><td>modelo de flujo conectado</td></tr>
        <tr><td>3</td><td>Añadir datos, tiempo y recursos al modelo de flujo</td><td>modelo integrado</td></tr>
        <tr><td>4</td><td>Usar el modelo con casos en curso: detectar, predecir, recomendar</td><td>soporte operacional</td></tr>
      </table>
      <p>En la formulación original las etapas 0 a 4 son cinco; las etapas 1 a 3 se consideran el núcleo de un análisis <em>offline</em> y la etapa 4 solo es posible
      con registros de calidad alta y actualizados.</p>
      <h2>Dependencias e iteración</h2>
      <p>Cada etapa consume los productos de las anteriores. Si \(E_k\) se repite, todo producto de \(E_j\) con \(j &gt; k\) deja de ser vigente. En el peor caso, repetir
      la etapa 1 después de llegar a la 4 obliga a rehacer las etapas 2, 3 y 4. Por eso conviene validar el registro con un modelo sencillo (etapa 2) antes de invertir en la integración.</p>
      <div class="recuadro"><p><strong>Regla práctica.</strong> Hacer pronto una versión mínima de las etapas 1 y 2 (un registro pequeño y un
      <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>) revela los problemas de datos cuando corregirlos aún es barato.</p></div>
      <h2>Conexiones</h2>
      <p>La calidad de la etapa 1 se trata en <a href="tema.html?id=event-log-quality">extracción y calidad de registros</a>; la etapa 2 usa los algoritmos de
      <a href="tema.html?id=process-discovery">descubrimiento</a> y la <a href="tema.html?id=token-based-replay">reproducción de fichas</a>; la etapa 4 corresponde al
      <a href="tema.html?id=operational-support">soporte operacional</a>. Los tres modos de iniciar un proyecto se comparan en
      <a href="tema.html?id=project-approaches">enfoques de proyecto</a>.</p>`,
  });
})();
