(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  // Los minutos del simulador se leen como minutos desde el lunes a las 08:00.
  function fecha(min) {
    const t = Math.round(min) + 480, d = Math.floor(t / 1440), r = t % 1440;
    return `${DIAS[d % 7]} ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  }
  const colorCaso = (i) => VIZ.series[i % VIZ.series.length];

  // Tabla HTML: filas = [{ c: [celdas], activa, alClick }]; una celda es texto, nodo o { texto, clase }.
  function tabla(cabecera, filas) {
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const t = VIZ.el('table', { class: 'tabla-datos sin-corte' });
    t.appendChild(VIZ.el('thead', null, VIZ.el('tr', null, cabecera.map((h) => VIZ.el('th', h.clase ? { class: h.clase } : null, h.texto || h)))));
    const tb = VIZ.el('tbody');
    for (const f of filas) {
      const tr = VIZ.el('tr', { class: [f.activa ? 'activa' : '', f.alClick ? 'clicable' : ''].join(' ').trim() || null },
        f.c.map((c) => (c && c.nodeType ? VIZ.el('td', null, c) : VIZ.el('td', c && c.clase ? { class: c.clase } : null, c && c.texto !== undefined ? c.texto : c))));
      if (f.alClick) tr.addEventListener('click', f.alClick);
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    caja.appendChild(t);
    return caja;
  }

  // Registro de ejemplo con eventos planos: cada evento lleva su caso, su número y sus atributos.
  function crearLog(n, semilla, llegada = 90, espera = 25) {
    const log = P.simular(P.procesos.pedidos.arbol, n, semilla, { llegada, espera });
    const eventos = [];
    log.forEach((c, k) => c.eventos.forEach((e, j) => eventos.push({ caso: c.id, k, pos: j, act: e.act, ts: e.fin, ini: e.ini, recurso: e.recurso, costo: e.costo })));
    return { log, eventos };
  }

  /* ---------- Fig. 1: tabla de eventos y vistas ---------- */

  function montarTabla(cuerpo) {
    let n = 5, semilla = 3, vista = 'desorden', sel = -1, datos;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 2, max: 8, valor: n, alCambiar: (v) => { n = v; sel = -1; nuevo(); } });
    ctl.selector({
      etiqueta: 'Vista de la tabla', valor: vista,
      opciones: [['desorden', 'Como llegan (sin ordenar)'], ['tiempo', 'Ordenada por marca de tiempo'], ['caso', 'Agrupada por caso y ordenada']],
      alCambiar: (v) => { vista = v; dibujar(); },
    });
    ctl.boton('Nuevos datos', () => { semilla++; sel = -1; nuevo(); }, { primario: true });
    const leyenda = VIZ.leyenda(cuerpo, []);
    const zona = VIZ.el('div');
    cuerpo.appendChild(zona);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila para resaltar todos los eventos de su caso. En la vista «Como llegan» los eventos de distintos casos se mezclan, como en un sistema real; agrupar y ordenar es lo que revela cada traza.');

    function nuevo() {
      datos = crearLog(n, semilla);
      const rnd = VIZ.semilla(semilla * 7 + n);
      // Orden de llegada al almacén de datos: mezclado entre sistemas.
      datos.llegada = datos.eventos.map((e) => [e, rnd()]).sort((a, b) => a[1] - b[1]).map((p) => p[0]);
      datos.llegada.forEach((e, i) => { e.id = 'E' + String(i + 1).padStart(3, '0'); });
      leyenda.set(datos.log.map((c, i) => ({ color: colorCaso(i), texto: 'caso ' + c.id, forma: 'cuadro' })));
      dibujar();
    }
    function dibujar() {
      let filas = datos.llegada.slice();
      if (vista === 'tiempo') filas.sort((a, b) => a.ts - b.ts);
      if (vista === 'caso') filas.sort((a, b) => a.k - b.k || a.ts - b.ts);
      zona.replaceChildren(tabla(
        ['Event ID', 'Case ID', 'Actividad', 'Marca de tiempo', 'Recurso'].map((t, i) => ({ texto: t, clase: i === 2 || i === 4 ? 'izq' : null })),
        filas.map((e) => ({
          activa: e.k === sel,
          alClick: () => { sel = sel === e.k ? -1 : e.k; dibujar(); },
          c: [e.id, VIZ.ficha(e.caso, { color: colorCaso(e.k) }), { texto: e.act, clase: 'izq' }, fecha(e.ts), { texto: e.recurso, clase: 'izq' }],
        }))));
      const ord = datos.llegada.every((e, i, a) => !i || a[i - 1].ts <= e.ts);
      registro.textContent = vista === 'desorden'
        ? 'Los eventos llegan mezclados: el orden de la tabla no es el orden de ejecución, ni los casos están juntos.'
        : vista === 'tiempo' ? 'Ordenar por marca de tiempo recupera la secuencia global, pero los casos siguen intercalados.'
          : 'Agrupar por Case ID y ordenar por tiempo dentro de cada caso: cada bloque de filas es una traza.';
      lectura.set([
        ['eventos', String(datos.eventos.length)],
        ['casos', String(datos.log.length)],
        ['actividades distintas', String(P.actividades(datos.log).length)],
        ['recursos distintos', String(new Set(datos.eventos.map((e) => e.recurso)).size)],
        ['llegaron en orden de tiempo', ord ? 'sí' : 'no'],
      ]);
    }
    nuevo();
  }

  /* ---------- Fig. 2: cómo nacen las trazas ---------- */

  function montarTrazas(cuerpo) {
    let n = 4, semilla = 5, datos, cola, trazas, ultimo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 2, max: 6, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const leyenda = VIZ.leyenda(cuerpo, []);
    VIZ.subtitulo(cuerpo, 'Evento que se lee ahora');
    const zonaCola = VIZ.el('div');
    cuerpo.appendChild(zonaCola);
    VIZ.subtitulo(cuerpo, 'Trazas construidas hasta ahora');
    const zonaTrazas = VIZ.el('div');
    cuerpo.appendChild(zonaTrazas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma el siguiente evento en orden de tiempo, mira su Case ID y agrega su actividad al final de la traza de ese caso. Pruebe con más casos: los eventos de casos distintos se intercalan, pero cada traza conserva su orden.');

    function iniciar() {
      datos = crearLog(n, semilla);
      cola = datos.eventos.slice().sort((a, b) => a.ts - b.ts);
      trazas = datos.log.map((c) => ({ id: c.id, k: datos.log.indexOf(c), acts: [] }));
      leyenda.set(datos.log.map((c, i) => ({ color: colorCaso(i), texto: 'caso ' + c.id, forma: 'cuadro' })));
      ultimo = null;
      return (function* () {
        for (const e of cola) {
          trazas[e.k].acts.push(e.act);
          ultimo = e;
          yield;
        }
      })();
    }
    function dibujar() {
      const hechos = trazas.reduce((s, t) => s + t.acts.length, 0);
      zonaCola.replaceChildren(ultimo
        ? tabla(['Case ID', 'Actividad', 'Marca de tiempo'].map((t, i) => ({ texto: t, clase: i === 1 ? 'izq' : null })),
          [{ c: [VIZ.ficha(ultimo.caso, { color: colorCaso(ultimo.k) }), { texto: ultimo.act, clase: 'izq' }, fecha(ultimo.ts)] }])
        : VIZ.el('div', { class: 'fichas' }, VIZ.el('span', { class: 'fichas-vacio' }, 'Pulse «Un paso» o «Reproducir».')));
      zonaTrazas.replaceChildren(...trazas.map((t) => VIZ.el('div', { class: 'fichas' },
        VIZ.ficha(t.id, { color: colorCaso(t.k) }),
        ...t.acts.map((a, i) => VIZ.ficha(a, { fondo: i === t.acts.length - 1 && ultimo && ultimo.caso === t.id ? C.neutro : null })),
        t.acts.length ? null : VIZ.el('span', { class: 'fichas-vacio' }, 'sin eventos'))));
      registro.textContent = ultimo
        ? `Evento ${hechos} de ${cola.length}: «${ultimo.act}» del caso ${ultimo.caso} (${fecha(ultimo.ts)}) se agrega al final de su traza, que ahora tiene ${trazas[ultimo.k].acts.length} actividad(es).`
        : 'Aún no se ha leído ningún evento.';
      lectura.set([
        ['eventos leídos', `${hechos} de ${cola.length}`],
        ['trazas completas', String(trazas.filter((t, i) => t.acts.length === datos.log[i].eventos.length).length)],
        ['traza más larga', String(Math.max(...trazas.map((t) => t.acts.length)))],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 3: línea de tiempo y atributos ---------- */

  function montarLinea(cuerpo) {
    let n = 8, semilla = 11, color = 'act', datos, hover = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 3, max: 12, valor: n, alCambiar: (v) => { n = v; nuevo(); } });
    ctl.selector({
      etiqueta: 'Color según atributo del evento', valor: color,
      opciones: [['act', 'Actividad'], ['recurso', 'Recurso']], alCambiar: (v) => { color = v; leyendaDe(); dibujar(); },
    });
    ctl.boton('Nuevos datos', () => { semilla++; nuevo(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 58 + n * 30 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un caso y cada barra un evento (de su inicio a su fin). Pase el cursor por una barra para ver los atributos del evento y del caso; cambie el atributo que da color.');

    let claves = [];
    function leyendaDe() {
      claves = [...new Set(datos.eventos.map((e) => e[color]))].sort();
      leyenda.set(claves.map((k, i) => ({ color: VIZ.series[i % VIZ.series.length], texto: k, forma: 'cuadro' })));
    }
    function nuevo() { datos = crearLog(n, semilla, 14, 12); leyendaDe(); lienzo.ajustar(true); }
    function dibujar() {
      if (!datos) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 44, der = 10, sup = 8, fila = 30;
      const t0 = Math.min(...datos.eventos.map((e) => e.ini)), t1 = Math.max(...datos.eventos.map((e) => e.ts));
      const sx = (t) => izq + (t - t0) / (t1 - t0) * (W - izq - der);
      geo = [];
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      datos.log.forEach((c, i) => {
        const y = sup + i * fila + fila / 2;
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(izq, y); ctx.lineTo(W - der, y); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(c.id, 2, y);
      });
      for (const e of datos.eventos) {
        const y = sup + e.k * fila + fila / 2, x0 = sx(e.ini), x1 = Math.max(sx(e.ts), x0 + 2);
        ctx.fillStyle = VIZ.series[claves.indexOf(e[color]) % VIZ.series.length];
        if (hover === e) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; }
        ctx.beginPath(); ctx.roundRect(x0, y - 8, x1 - x0, 16, 3); ctx.fill();
        if (hover === e) ctx.stroke();
        geo.push({ e, x0, x1, y });
      }
      const ejeY = sup + n * fila + 10;
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
      const nt = Math.max(1, Math.floor((W - izq) / 95));
      for (let k = 0; k <= nt; k++) { const t = t0 + (t1 - t0) * k / nt; ctx.fillText(fecha(t), Math.min(Math.max(sx(t), izq + 22), W - 30), ejeY + 6); }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const dur = datos.log.map((c) => P.duracionCaso(c));
      registro.textContent = hover
        ? `Evento «${hover.act}» del caso ${hover.caso}: de ${fecha(hover.ini)} a ${fecha(hover.ts)} por ${hover.recurso}.`
        : 'Cada evento hereda los atributos de su caso (Case ID) y suma los suyos (actividad, recurso, tiempo, costo).';
      lectura.set([
        ['eventos', String(datos.eventos.length)],
        ['casos', String(n)],
        ['duración media del caso', P.dur(P.media(dur))],
        ['costo medio del caso', VIZ.fmt(P.media(datos.log.map((c) => c.eventos.reduce((s, e) => s + e.costo, 0))), 4)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo && geo.find((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && Math.abs(y - b.y) <= 9);
      const nuevoH = g ? g.e : null;
      if (nuevoH !== hover) { hover = nuevoH; dibujar(); }
      if (!g) return tip.ocultar();
      const e = g.e, c = datos.log[e.k];
      tip.mostrar(x, y, `<b>${e.act}</b><br>caso ${e.caso} · recurso ${e.recurso}<br>inicio ${fecha(e.ini)} · fin ${fecha(e.ts)}<br>costo del evento ${VIZ.fmt(e.costo, 3)}<br>eventos del caso ${c.eventos.length} · duración ${P.dur(P.duracionCaso(c))}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    nuevo();
  }

  VIZ.registrarTema('event-logs', {
    intro: String.raw`
      <p>Un <strong>registro de eventos</strong> es una tabla en la que cada fila es algo que ocurrió: <em>en el caso</em> 17, <em>la actividad</em>
      «Verificar stock» se hizo <em>a tal hora</em> y la hizo <em>una persona</em>. Con solo esas tres columnas (caso, actividad y marca de tiempo) ya se puede reconstruir
      el orden en que sucedió cada caso; el resto de las columnas son atributos que enriquecen el análisis.</p>
      <p>Los datos llegan mezclados porque los sistemas atienden muchos casos a la vez. El primer trabajo de la minería de procesos es
      <strong>agrupar por caso y ordenar por tiempo</strong>: cada grupo resultante es una <a href="tema.html?id=traces-and-variants">traza</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'La tabla de eventos',
        descripcion: 'Cambie entre las tres vistas de la misma tabla y compare: sin ordenar, ordenada por tiempo y agrupada por caso. Haga clic en una fila para ver todos los eventos de su caso.',
        montar: montarTabla,
      },
      {
        titulo: 'Cómo nacen las trazas',
        descripcion: 'Avance paso a paso: el evento leído se agrega a la traza de su caso. Observe cómo los casos crecen de forma intercalada pero cada uno conserva su orden.',
        montar: montarTrazas,
      },
      {
        titulo: 'Línea de tiempo con atributos',
        descripcion: 'Cada barra es un evento. Pase el cursor para ver sus atributos y los de su caso, y cambie el color entre actividad y recurso para ver qué se reparte mejor.',
        montar: montarLinea,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(\mathcal{C}\) el universo de identificadores de caso, \(A\) el de actividades y \(T\) el de marcas de tiempo. Un <strong>evento</strong> es una tupla
      \(e = (c, a, t, r, \ldots)\) con \(c \in \mathcal{C}\), \(a \in A\), \(t \in T\), y atributos opcionales como el recurso \(r\), el costo o el área.
      Un <strong>registro de eventos</strong> es un conjunto de eventos \(E\) con identidad propia (<em>Event ID</em>).</p>
      <table>
        <tr><th>Elemento</th><th>Papel</th><th>¿Obligatorio?</th></tr>
        <tr><td>Case ID</td><td>agrupa los eventos de una misma ejecución del proceso</td><td>sí</td></tr>
        <tr><td>Actividad</td><td>qué se hizo</td><td>sí</td></tr>
        <tr><td>Marca de tiempo</td><td>cuándo; define el orden dentro del caso</td><td>sí (o un orden explícito)</td></tr>
        <tr><td>Recurso</td><td>quién o qué sistema lo hizo</td><td>no; habilita la perspectiva organizacional</td></tr>
        <tr><td>Atributos de evento</td><td>costo, resultado, importe, canal…</td><td>no</td></tr>
        <tr><td>Atributos de caso</td><td>cliente, monto del pedido, prioridad: valen para todo el caso</td><td>no</td></tr>
      </table>

      <h2>Del registro a las trazas</h2>
      <pre><code>para cada evento e en E ordenado por t(e):
    traza[caso(e)] ← traza[caso(e)] · actividad(e)
devolver { traza[c] : c ∈ casos }</code></pre>
      <p>Si \(\sigma_c = \langle a_1, \ldots, a_k \rangle\) es la traza del caso \(c\), el registro como multiconjunto de trazas es
      \(L = [\sigma_c : c \in \mathcal{C}]\). Los eventos con la misma marca de tiempo dentro de un caso son ambiguos: hace falta un criterio de desempate (número de evento, orden de llegada) o un registro con más granularidad.</p>
      <div class="recuadro">La ordenación es una proyección: se pierde la información de otros casos (cuántos había en paralelo) y, si no se guardan los tiempos, las duraciones. Por eso los modelos de flujo de control parten de \(L\), pero los análisis de desempeño vuelven a los eventos.</div>

      <h2>Formatos y conexiones</h2>
      <p>El estándar IEEE XES guarda los registros jerárquicamente (registro → trazas → eventos con atributos) y CSV es la forma habitual de intercambio. Cuántos eventos hay por actividad, qué caso es cada uno y si hay
      eventos de <a href="tema.html?id=activity-lifecycle">inicio y fin</a> son preguntas que se contestan antes de modelar. Los registros reales rara vez están limpios: vea
      <a href="tema.html?id=event-log-quality">extracción y calidad</a>. El paso siguiente es agrupar los casos en <a href="tema.html?id=traces-and-variants">variantes</a>, y de allí
      al <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>.</p>`,
  });
})();
