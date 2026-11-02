(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  const LETRAS = 'ABCDEFGHIJKLMNOP';
  // Distancia de un punto a un segmento (para saber si el cursor está sobre una arista).
  function distSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  // Intercambia los ejes de una disposición: el flujo va de arriba hacia abajo (cabe en 390 px).
  const vertical = (pos) => Object.fromEntries(Object.entries(pos).map(([k, p]) => [k, { x: p.y, y: p.x }]));

  /* ---------- Fig. 1: el ciclo BPM y las tres tareas ---------- */

  const FASES = [
    { k: 'dis', t: 'Diseño', ang: -90, d: 'Se modela cómo debería ser el proceso (modelo normativo) a partir de entrevistas y documentos.',
      mp: 'Descubrir: un modelo obtenido de los datos muestra el proceso real y sirve de punto de partida del rediseño.' },
    { k: 'imp', t: 'Implementación', ang: -18, d: 'El modelo se configura en un sistema de información (flujo de trabajo, ERP, CRM).',
      mp: 'Sin tarea directa: aquí se decide qué eventos quedarán registrados, de eso depende la calidad del registro.' },
    { k: 'eje', t: 'Ejecución', ang: 54, d: 'Los casos se ejecutan y los sistemas de información dejan huellas: el registro de eventos.',
      mp: 'Genera la materia prima: sin eventos con caso, actividad y marca de tiempo no hay minería de procesos.' },
    { k: 'mon', t: 'Monitoreo', ang: 126, d: 'Se miden indicadores y se detectan desvíos mientras el proceso corre.',
      mp: 'Verificar: se reproduce el registro sobre el modelo para medir conformidad y localizar desvíos.' },
    { k: 'aju', t: 'Ajuste', ang: 198, d: 'Con el diagnóstico se corrige el proceso o se rediseña.',
      mp: 'Mejorar: se enriquece el modelo con tiempos, recursos y costos para encontrar cuellos de botella.' },
  ];
  const TAREAS = {
    '': { texto: 'Ver el ciclo', fases: [] },
    descubrir: { texto: 'Descubrir', fases: ['dis', 'eje'], msg: 'Descubrir: del registro de eventos sale un modelo sin conocimiento previo del proceso (play-in).' },
    verificar: { texto: 'Verificar', fases: ['eje', 'mon'], msg: 'Verificar: el registro y un modelo se contrastan (replay); el resultado es un diagnóstico de conformidad.' },
    mejorar: { texto: 'Mejorar', fases: ['mon', 'aju'], msg: 'Mejorar: el modelo se extiende con tiempos y recursos para sugerir cambios (la base del ajuste).' },
  };

  function montarCiclo(cuerpo) {
    let tarea = '', sel = -1, hover = -1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Tarea de minería de procesos',
      opciones: Object.entries(TAREAS).map(([k, v]) => [k, v.texto]), valor: tarea,
      alCambiar: (v) => { tarea = v; dibujar(); },
    });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'fase del ciclo BPM', forma: 'cuadro' },
      { color: C.s1, texto: 'fase seleccionada', forma: 'cuadro' },
      { color: C.s2, texto: 'fase donde aporta la tarea elegida', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fase para leer qué ocurre y qué aporta la minería de procesos; elija una tarea para ver dónde actúa, o use el reproductor para recorrer el ciclo.');

    function* iniciarGen() {
      for (let vuelta = 0; vuelta < 2; vuelta++) {
        for (let i = 0; i < FASES.length; i++) { sel = i; yield; }
      }
    }
    function iniciar() { sel = -1; return iniciarGen(); }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2, rx = Math.min(W * 0.34, 260), ry = H * 0.33;
      const bw = Math.min(104, W * 0.27), bh = 34;
      const activas = new Set(TAREAS[tarea].fases);
      const punto = (ang) => { const a = ang * Math.PI / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; };
      // Flechas del ciclo, sobre la elipse.
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje; ctx.fillStyle = C.eje;
      for (let i = 0; i < FASES.length; i++) {
        const a0 = FASES[i].ang, a1 = i === FASES.length - 1 ? FASES[0].ang + 360 : FASES[i + 1].ang;
        const d0 = a0 + 22, d1 = a1 - 22;
        ctx.beginPath();
        for (let a = d0; a <= d1; a += 2) { const [x, y] = punto(a); a === d0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        const [x1, y1] = punto(d1), [x0, y0] = punto(d1 - 3), ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4));
        ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
      }
      // Centro: los datos de eventos.
      const cw = Math.min(118, W * 0.3), ch = 44;
      geo = [];
      FASES.forEach((f) => {
        if (!activas.has(f.k)) return;
        const [x, y] = punto(f.ang);
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Registros', cx, cy - 7); ctx.fillText('de eventos', cx, cy + 8);
      FASES.forEach((f, i) => {
        const [x, y] = punto(f.ang);
        const esSel = i === sel, esAct = activas.has(f.k);
        ctx.fillStyle = esSel ? VIZ.alfa(C.s1, 0.18) : esAct ? VIZ.alfa(C.s2, 0.2) : C.superficie;
        ctx.strokeStyle = esSel ? C.s1 : esAct ? C.s2 : C.tinta;
        ctx.lineWidth = esSel || i === hover ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.t, x, y + 0.5);
        geo.push({ x, y, w: bw, h: bh });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const f = FASES[sel];
      registro.textContent = f ? `${f.t}. ${f.d} ${f.mp}` : TAREAS[tarea].msg || 'Seleccione una fase del ciclo BPM o una tarea de minería de procesos.';
      lectura.set([
        ['fase', f ? f.t : '—'],
        ['tarea elegida', TAREAS[tarea].texto],
        ['fases con aporte', activas.size ? FASES.filter((x) => activas.has(x.k)).map((x) => x.t).join(', ') : '—'],
        ['fuente de datos', 'registro de eventos'],
      ]);
    }
    const fase = (x, y) => geo.findIndex((g) => Math.abs(x - g.x) <= g.w / 2 && Math.abs(y - g.y) <= g.h / 2);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = fase(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${FASES[i].t}</b><br>${FASES[i].d}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = fase(x, y);
      rep.detener(); sel = i; dibujar();
    });
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: modelo frente a comportamiento observado ---------- */

  function montarObservado(cuerpo) {
    let proc = 'pedidos', n = 100, ruido = 0.2, semilla = 1, selArista = null;
    let modelo, cod, log, obs, conformes, pos, capas = 10, aristas = [], nodosIds = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Proceso', opciones: [['pedidos', 'Gestión de pedidos'], ['reclamos', 'Atención de reclamos']], valor: proc,
      alCambiar: (v) => { proc = v; selArista = null; calcular(); },
    });
    ctl.rango({ etiqueta: 'Casos observados', min: 20, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Desvíos en la práctica', min: 0, max: 0.5, paso: 0.05, valor: ruido, formato: (v) => Math.round(v * 100) + ' %', alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 70 + capas * 54 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'flecha del modelo y observada', forma: 'linea' },
      { color: C.s8, texto: 'flecha observada fuera del modelo', forma: 'linea' },
      { color: C.tenue, texto: 'flecha del modelo no usada', forma: 'linea' },
      { color: C.s6, texto: 'inicio', forma: 'punto' },
    ]);
    const clave = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(clave);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El modelo permite solo las flechas que aparecen en ejecuciones sin desvíos. Pase el cursor sobre una flecha para ver su frecuencia; haga clic en una flecha roja para ver un caso que la usa. Un caso se cuenta como conforme si todos sus pares consecutivos, su inicio y su fin están permitidos por el modelo (una aproximación: no detecta omisiones dentro de bloques paralelos).');

    const sep = '\u0001';
    function calcular() {
      const arbol = P.procesos[proc].arbol;
      const base = P.simular(arbol, 800, 7, { ruido: 0 });
      modelo = P.dfg(base);
      const orden = [];
      base.slice(0, 60).forEach((c) => P.trazaDe(c).forEach((a) => { if (!orden.includes(a)) orden.push(a); }));
      modelo.acts.forEach((a) => { if (!orden.includes(a)) orden.push(a); });
      cod = Object.fromEntries(orden.map((a, i) => [a, LETRAS[i]]));
      log = P.simular(arbol, n, semilla * 13 + 1, { ruido });
      obs = P.dfg(log);
      conformes = log.filter((c) => {
        const tr = P.trazaDe(c);
        if (!modelo.ini.has(tr[0]) || !modelo.fin.has(tr[tr.length - 1])) return false;
        for (let i = 0; i + 1 < tr.length; i++) if (!modelo.par.has(tr[i] + sep + tr[i + 1])) return false;
        return true;
      }).length;
      // Aristas: unión del modelo y lo observado, con inicio y fin como nodos.
      const mapa = new Map();
      const poner = (de, a, enModelo, nObs) => {
        const k = de + sep + a;
        if (!mapa.has(k)) mapa.set(k, { de, a, enModelo: false, n: 0 });
        const e = mapa.get(k); e.enModelo = e.enModelo || enModelo; e.n += nObs;
      };
      for (const k of modelo.par.keys()) { const [a, b] = k.split(sep); poner(a, b, true, 0); }
      for (const a of modelo.ini.keys()) poner('▶', a, true, 0);
      for (const a of modelo.fin.keys()) poner(a, '■', true, 0);
      for (const e of obs.aristas) {
        const k = e.de + sep + e.a;
        const ya = mapa.get(k);
        poner(e.de, e.a, false, e.n);
        if (!ya) mapa.get(k).enModelo = false;
      }
      for (const [a, v] of obs.ini) poner('▶', a, false, v);
      for (const [a, v] of obs.fin) poner(a, '■', false, v);
      aristas = [...mapa.values()];
      nodosIds = ['▶', ...orden.filter((a) => obs.acts.includes(a) || modelo.acts.includes(a)), '■'];
      // La disposición sale del modelo, sin los pares de sentidos opuestos (actividades paralelas o bucles de dos pasos).
      const delModelo = aristas.filter((e) => e.enModelo), dir = new Set(delModelo.map((e) => e.de + sep + e.a));
      pos = vertical(P.disponer(nodosIds, delModelo.filter((e) => !dir.has(e.a + sep + e.de)).map((e) => [e.de, e.a])));
      capas = new Set(Object.values(pos).map((p) => p.y.toFixed(3))).size;
      clave.replaceChildren(...orden.map((a) => VIZ.ficha(`${cod[a]} = ${a}`)));
      selArista = null;
      lienzo.ajustar(true);
    }

    let geo = null, enlaces = [];
    function dibujar() {
      if (!aristas.length) return;
      const maxN = Math.max(1, ...aristas.map((e) => e.n));
      const nodos = nodosIds.map((id) => (id === '▶' ? { id, tipo: 'inicio', relleno: C.s6, borde: C.s6 }
        : id === '■' ? { id, tipo: 'fin' } : { id, tipo: 'act', etiqueta: cod[id] }));
      const aris = aristas.map((e) => {
        const fuera = !e.enModelo && e.n > 0;
        return {
          de: e.de, a: e.a, ancho: e.n ? 1.5 + 3 * Math.sqrt(e.n / maxN) : 1,
          color: fuera ? C.s8 : e.n ? C.tinta2 : C.tenue, guiones: fuera || e === selArista,
          etiqueta: aristas.length <= 26 && e.n ? e.n : null, colorTexto: fuera ? C.s8 : C.tinta2,
        };
      });
      lienzo.limpiar();
      geo = P.dibujarGrafo(lienzo, nodos, aris, pos, { margenX: 40, margenY: 34 });
      enlaces = geo.lineas.map((l, i) => ({ ...l, arista: aristas[i] }));
      const fuera = aristas.filter((e) => !e.enModelo && e.n > 0);
      const nFuera = fuera.reduce((s, e) => s + e.n, 0);
      registro.textContent = selArista
        ? `Flecha ${cod[selArista.de] || selArista.de} → ${cod[selArista.a] || selArista.a}: ${selArista.n} cruces en el registro y el modelo no la permite. Ejemplo: ${ejemplo(selArista)}.`
        : `${log.length} casos observados; ${log.length - conformes} se desvían del modelo. Hay ${fuera.length} flecha(s) fuera del modelo, usadas ${nFuera} vez/veces.`;
      lectura.set([
        ['casos', String(log.length)],
        ['casos conformes', `${conformes} (${VIZ.fmt(100 * conformes / log.length, 3)} %)`],
        ['flechas fuera del modelo', String(fuera.length)],
        ['flechas del modelo sin uso', String(aristas.filter((e) => e.enModelo && !e.n).length)],
        ['variantes observadas', String(P.variantes(log).length)],
      ]);
    }
    function ejemplo(e) {
      const c = log.find((x) => {
        const tr = ['▶', ...P.trazaDe(x), '■'];
        return tr.some((a, i) => i + 1 < tr.length && a === e.de && tr[i + 1] === e.a);
      });
      return c ? P.trazaDe(c).map((a) => cod[a]).join(' ') + ` (${c.id})` : '—';
    }
    const buscar = (x, y) => {
      if (!geo) return null;
      const nd = P.nodoEn(geo, x, y);
      if (nd) return { nodo: nd };
      let mejor = null, dm = 7;
      for (const l of enlaces) { const d = distSeg(x, y, l.p1, l.p2); if (d < dm) { dm = d; mejor = l.arista; } }
      return mejor ? { arista: mejor } : null;
    };
    const nom = (id) => (id === '▶' ? 'inicio' : id === '■' ? 'fin' : `${cod[id]} (${id})`);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), h = buscar(x, y);
      if (!h) return tip.ocultar();
      if (h.nodo) {
        const id = h.nodo.id, f = obs.frec.get(id);
        return tip.mostrar(x, y, `<b>${nom(id)}</b>` + (f !== undefined ? `<br>${f} ocurrencias en el registro` : ''));
      }
      const e = h.arista;
      tip.mostrar(x, y, `<b>${nom(e.de)} → ${nom(e.a)}</b><br>${e.n} cruces observados<br>${e.enModelo ? 'permitida por el modelo' : e.n ? 'no permitida por el modelo' : 'permitida pero no usada'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), h = buscar(x, y);
      selArista = h && h.arista && !h.arista.enModelo && h.arista.n ? h.arista : null;
      dibujar();
    });
    lienzo.alDibujar = dibujar;
    calcular();
  }

  VIZ.registrarTema('process-mining-overview', {
    intro: String.raw`
      <p>La <strong>minería de procesos</strong> (<em>process mining</em>) une dos mundos: la gestión de procesos de negocio (BPM), que
      dibuja cómo <em>debería</em> trabajar una organización, y la ciencia de datos, que mira lo que <em>realmente</em> ocurre. Su materia prima
      son los rastros que los sistemas de información dejan al ejecutar cada caso: el <a href="tema.html?id=event-logs">registro de eventos</a>.</p>
      <p>Con ese registro hace tres cosas: <strong>descubrir</strong> un modelo sin conocimiento previo, <strong>verificar</strong> si la realidad
      cumple un modelo y <strong>mejorar</strong> el proceso enriqueciéndolo con tiempos, recursos y costos. Una brecha entre el modelo
      dibujado y el comportamiento observado casi siempre existe, y medirla es el primer resultado útil.</p>`,
    visualizaciones: [
      {
        titulo: 'El ciclo BPM y las tres tareas',
        descripcion: 'Recorra el ciclo de vida de un proceso con el reproductor o haga clic en una fase. Elija una tarea (descubrir, verificar, mejorar) y observe en qué fases aporta y cómo todas parten de los registros de eventos.',
        montar: montarCiclo,
      },
      {
        titulo: 'Modelo frente a comportamiento observado',
        descripcion: 'Subir el porcentaje de desvíos hace aparecer flechas rojas: pares de actividades que el modelo no permite. Cambie de proceso y compare qué fracción de casos sigue conforme.',
        montar: montarObservado,
      },
    ],
    teoria: String.raw`
      <h2>Qué es la minería de procesos</h2>
      <p>Un <strong>proceso de negocio</strong> es un conjunto de actividades que, ejecutadas en cierto orden por ciertos recursos, producen un resultado para un cliente
      (atender un pedido, resolver un reclamo). La <strong>gestión de procesos de negocio</strong> (BPM) cubre su ciclo de vida: diseño, implementación,
      ejecución, monitoreo y ajuste. Tradicionalmente el análisis dependía de modelos dibujados a mano, que suelen describir un proceso idealizado.</p>
      <p>La minería de procesos cierra el ciclo con datos. Su entrada es un registro de eventos \(L\), un multiconjunto de trazas sobre un conjunto de actividades \(A\),
      y a veces un modelo \(M\) (una <a href="tema.html?id=petri-nets">red de Petri</a>, un modelo BPMN, un <a href="tema.html?id=process-trees">árbol de procesos</a>).</p>

      <h2>Las tres tareas</h2>
      <table>
        <tr><th>Tarea</th><th>Entrada</th><th>Salida</th><th>Operación</th></tr>
        <tr><td>Descubrimiento</td><td>\(L\)</td><td>modelo \(M\)</td><td><em>play-in</em></td></tr>
        <tr><td>Conformidad</td><td>\(L\) y \(M\)</td><td>diagnóstico de desvíos</td><td><em>replay</em></td></tr>
        <tr><td>Mejora (<em>enhancement</em>)</td><td>\(L\) y \(M\)</td><td>modelo extendido o reparado</td><td>replay con atributos</td></tr>
      </table>
      <p>La operación inversa, <em>play-out</em>, parte de un modelo y genera comportamiento: es lo que hace un simulador (y lo que usan las figuras de este sitio
      para fabricar registros de ejemplo). Si \(\mathcal{T}(M)\) es el conjunto de trazas que admite el modelo, la conformidad compara \(L\) con \(\mathcal{T}(M)\):</p>
      \[ \text{casos conformes} = \frac{|\{\sigma \in L : \sigma \in \mathcal{T}(M)\}|}{|L|}. \]
      <div class="recuadro">La segunda figura usa una versión simplificada: \(\mathcal{T}(M)\) se aproxima por el
      <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a> del modelo (pares permitidos). Es útil para ver la idea, pero no detecta omisiones dentro de bloques paralelos.</div>

      <h2>Perspectivas y pasos siguientes</h2>
      <ul>
        <li><strong>Flujo de control</strong>: el orden de las actividades (<a href="tema.html?id=process-discovery">descubrimiento</a>).</li>
        <li><strong>Conformidad</strong>: dónde y por qué se aparta el comportamiento real del modelo (<a href="tema.html?id=token-based-replay">reproducción de fichas</a>).</li>
        <li><strong>Tiempo</strong>: esperas y duraciones (<a href="tema.html?id=bottleneck-analysis">cuellos de botella</a>).</li>
        <li><strong>Organización</strong>: quién hace qué y con quién trabaja (<a href="tema.html?id=organizational-perspective">perspectiva organizacional</a>).</li>
        <li><strong>Tiempo real</strong>: predicciones sobre casos en curso (<a href="tema.html?id=operational-support">soporte operacional</a>).</li>
      </ul>
      <p>Un proyecto completo sigue una metodología, como el <a href="tema.html?id=l-star-lifecycle">modelo de ciclo de vida L*</a>.</p>`,
  });
})();
