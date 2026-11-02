(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const { act, sec, xor, y } = P;

  /* ---------- Fig. 1: el flujo típico de una herramienta ---------- */

  // Proceso de aprobación sencillo (apto para el algoritmo Alfa); con ruido para que filtrar importe.
  const ARBOL = sec(
    act('Registrar', { dur: 5, rol: 'ventas' }),
    y(act('Verificar', { dur: 8, rol: 'bodega' }), act('Evaluar', { dur: 12, rol: 'finanzas' })),
    xor([act('Aprobar', { dur: 6, rol: 'gerencia' }), act('Rechazar', { dur: 4, rol: 'gerencia' })], [0.7, 0.3]),
    act('Notificar', { dur: 3, rol: 'ventas' }),
  );

  const PASOS = [
    { corto: 'Importar', nombre: 'Importar el registro', prom: 'plug-ins de importación de XES y de conversión de CSV a XES', otras: 'pm4py: read_xes; Disco y Celonis: asistente de carga con asignación de columnas' },
    { corto: 'Filtrar', nombre: 'Filtrar variantes poco frecuentes', prom: 'filtros de registro por actividades, por frecuencia o por rendimiento', otras: 'pm4py: filter_variants_by_coverage_percentage; Disco: deslizador de variantes' },
    { corto: 'Descubrir', nombre: 'Descubrir un modelo', prom: 'plug-ins de minería: Alpha Miner, Heuristics Miner, Inductive Miner', otras: 'pm4py: discover_petri_net_alpha; Disco: mapa de procesos' },
    { corto: 'Verificar', nombre: 'Verificar la conformidad', prom: 'plug-ins de reproducción del registro sobre la red de Petri', otras: 'pm4py: fitness_token_based_replay' },
    { corto: 'Desempeño', nombre: 'Analizar el desempeño', prom: 'plug-ins de análisis de rendimiento sobre el modelo', otras: 'Disco y Celonis: tiempos medios sobre el mapa' },
  ];

  function montarPipeline(cuerpo) {
    let semilla = 1, cobertura = 0.8, etapa = -1, sel = null, D = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Cobertura de variantes conservadas', min: 0.3, max: 1, paso: 0.05, valor: cobertura, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { cobertura = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevo registro', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 150 : 90) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'paso en curso' }, { color: VIZ.alfa(C.s6, 0.18), borde: C.s6, texto: 'paso hecho' }, { color: C.superficie, borde: C.inactivo, texto: 'paso pendiente' },
      { color: VIZ.alfa(C.s8, 0.25), borde: C.s8, texto: 'plaza donde faltan fichas al reproducir el registro completo' },
    ]);
    const panel = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(panel);
    const red = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 300 });
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca el flujo: se importan 120 casos con ruido, se filtran las variantes raras, se descubre una red con el algoritmo Alfa y se verifica contra el registro completo. Baje la cobertura para ver cómo cambian el modelo y la conformidad; haga clic en un paso para ver qué plug-in lo realiza.');

    const ac = (v) => P.variantes(v);
    function iniciar() {
      etapa = -1; sel = null; D = {};
      registro.dataset.msg = '';
      return (function* () {
        D.log = P.simular(ARBOL, 120, semilla, { ruido: 0.2, espera: 6 });
        D.vars = ac(D.log);
        etapa = 0; registro.dataset.msg = `Importado: ${D.log.length} casos, ${D.log.reduce((s, c) => s + c.eventos.length, 0)} eventos, ${P.actividades(D.log).length} actividades y ${D.vars.length} variantes.`; yield;
        let acum = 0; const quedan = new Set();
        for (const v of D.vars) { if (acum / D.log.length >= cobertura) break; quedan.add(v.clave); acum += v.n; }
        D.quedan = quedan;
        D.filtrado = D.log.filter((c) => quedan.has(P.trazaDe(c).join('›')));
        etapa = 1; registro.dataset.msg = `Filtrado: se conservan ${quedan.size} de ${D.vars.length} variantes (${D.filtrado.length} de ${D.log.length} casos).`; yield;
        D.alfa = P.alfa(D.filtrado);
        etapa = 2; registro.dataset.msg = `Descubierto: el algoritmo Alfa produce ${D.alfa.red.plazas.length} plazas y ${D.alfa.red.trans.length} transiciones desde el registro filtrado.`; yield;
        const rep1 = (log) => { let p = 0, c = 0, m = 0, r = 0; const falt = {}; for (const cs of log) { const x = P.reproducir(D.alfa.red, P.trazaDe(cs)); p += x.p; c += x.c; m += x.m; r += x.r; x.pasos.forEach((s) => s.faltantes.forEach((q) => { falt[q] = (falt[q] || 0) + 1; })); } return { fit: 0.5 * (1 - m / Math.max(1, c)) + 0.5 * (1 - r / Math.max(1, p)), falt, m, r }; };
        D.fitF = rep1(D.filtrado); D.fitT = rep1(D.log);
        etapa = 3; registro.dataset.msg = `Verificado: fitness ${VIZ.fmt(D.fitF.fit, 3)} en el registro filtrado y ${VIZ.fmt(D.fitT.fit, 3)} en el completo.`; yield;
        etapa = 4; registro.dataset.msg = `Desempeño: ciclo medio de ${P.dur(P.media(D.filtrado.map(P.tiempoCiclo)))} en el registro filtrado.`;
      })();
    }

    let geo = null;
    function posiciones(W) {
      const pos = {};
      PASOS.forEach((_, i) => { pos['p' + i] = W < 560 ? (i < 3 ? { x: i / 2, y: 0.15 } : { x: 0.25 + (i - 3) * 0.5, y: 0.85 }) : { x: i / 4, y: 0.5 }; });
      return pos;
    }
    function dibujar() {
      lienzo.limpiar();
      const nodos = PASOS.map((s, i) => (i === etapa ? { id: 'p' + i, tipo: 'act', etiqueta: s.corto, relleno: C.s1, borde: C.s1, colorTexto: C.sobre }
        : i < etapa ? { id: 'p' + i, tipo: 'act', etiqueta: s.corto, relleno: VIZ.alfa(C.s6, 0.18), borde: C.s6 }
          : { id: 'p' + i, tipo: 'act', etiqueta: s.corto, borde: C.inactivo, colorTexto: C.apagado }));
      const aristas = PASOS.slice(1).map((_, i) => ({ de: 'p' + i, a: 'p' + (i + 1), color: i + 1 <= etapa ? C.s6 : C.eje, ancho: i + 1 <= etapa ? 2.5 : 1.5 }));
      geo = P.dibujarGrafo(lienzo, nodos, aristas, posiciones(lienzo.ancho), { fuente: 10, margenX: 40, margenY: 24 });
      const k = sel !== null ? sel : Math.max(0, etapa), S = PASOS[k];
      const hijos = [VIZ.el('div', null, VIZ.el('b', null, `${k + 1}. ${S.nombre}`)), VIZ.el('div', null, `En ProM: ${S.prom}.`), VIZ.el('div', null, `En otras: ${S.otras}.`)];
      if (etapa >= 0 && k <= etapa) hijos.push(resultado(k));
      panel.replaceChildren(...hijos);
      dibujarRed();
      registro.textContent = registro.dataset.msg || 'Pulse Un paso para importar el registro.';
      lectura.set([
        ['casos importados', D.log ? String(D.log.length) : '—'],
        ['variantes (antes → después del filtro)', D.quedan ? `${D.vars.length} → ${D.quedan.size}` : D.vars ? String(D.vars.length) : '—'],
        ['fitness en el registro filtrado', D.fitF ? VIZ.fmt(D.fitF.fit, 3) : '—'],
        ['fitness en el registro completo', D.fitT ? VIZ.fmt(D.fitT.fit, 3) : '—'],
      ]);
    }
    function resultado(k) {
      const caja = VIZ.el('div', { class: 'caja-desplazable' });
      if (k === 0) {
        const filas = D.log.slice(0, 2).flatMap((c) => c.eventos.map((e) => [c.id, e.act, P.dur(e.ini), e.recurso]));
        caja.append(VIZ.el('table', { class: 'tabla-datos texto sin-corte' }, VIZ.el('thead', null, VIZ.el('tr', null, ...['case:concept:name', 'concept:name', 'time:timestamp', 'org:resource'].map((t) => VIZ.el('th', null, t)))),
          VIZ.el('tbody', null, ...filas.map((f) => VIZ.el('tr', null, ...f.map((t) => VIZ.el('td', null, t)))))));
      } else if (k === 1 || (k >= 3 && D.quedan)) {
        const fichas = D.vars.slice(0, 10).map((v) => (D.quedan && D.quedan.has(v.clave)
          ? VIZ.ficha(`${v.n}× ${v.traza.map((a) => a[0]).join('')}`, { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) })
          : VIZ.ficha(`${v.n}× ${v.traza.map((a) => a[0]).join('')}`, { color: C.tenue, tinta: C.apagado })));
        caja.append(VIZ.el('span', { class: 'fichas' }, ...fichas), VIZ.el('div', null, `Cada letra es la inicial de una actividad. Verde: conservada; gris: filtrada. Se muestran las 10 variantes más frecuentes de ${D.vars.length}.`));
      } else if (k === 2) {
        caja.append(VIZ.el('div', null, `Transiciones: ${D.alfa.red.trans.map((t) => t.nombre).join(', ')}. Plazas internas: ${D.alfa.Y.length}.`));
      }
      if (k === 3) caja.append(VIZ.el('div', null, `Fichas faltantes al reproducir los ${D.log.length} casos: ${D.fitT.m}; fichas sobrantes: ${D.fitT.r}.`));
      if (k === 4) {
        const t = D.filtrado.map(P.tiempoCiclo);
        caja.append(VIZ.el('div', null, `Ciclo: media ${P.dur(P.media(t))}, mediana ${P.dur(P.mediana(t))}, p90 ${P.dur(P.cuantil(t, 0.9))}.`));
      }
      return caja;
    }
    function dibujarRed() {
      red.limpiar();
      const { ctx, ancho: W, alto: H } = red;
      if (!D.alfa) {
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('El modelo aparecerá al descubrirlo (paso 3).', W / 2, H / 2);
        return;
      }
      const falt = etapa >= 3 ? D.fitT.falt : {};
      const { nodos, aristas } = P.nodosDeRed(D.alfa.red, P.marcadoInicial(D.alfa.red), {
        plaza: (p) => (falt[p.id] ? { relleno: VIZ.alfa(C.s8, 0.25), borde: C.s8, insignia: String(falt[p.id]), colorInsignia: C.s8 } : {}),
      });
      P.dibujarGrafo(red, nodos, aristas, P.posDeRed(D.alfa.red), { margenX: 50 });
    }
    lienzo.alDibujar = () => dibujar();
    red.alDibujar = () => dibujarRed();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y: yy } = lienzo.posicion(ev), n = P.nodoEn(geo, x, yy);
      if (!n) return;
      sel = +n.id.slice(1); dibujar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: del CSV al XES ---------- */

  const COLS = ['caso', 'actividad', 'hora', 'recurso', 'region'];
  const FILAS = [
    ['P1', 'Registrar', '08:00', 'Ana', 'Norte'], ['P1', 'Verificar', '08:10', 'Bruno', 'Norte'], ['P2', 'Registrar', '08:05', 'Ana', 'Sur'],
    ['P2', 'Aprobar', '08:50', 'Carla', 'Sur'], ['P1', 'Aprobar', '08:40', 'Carla', 'Norte'], ['P3', 'Registrar', '09:10', 'Ana', 'Norte'],
    ['P1', 'Notificar', '09:00', 'Diego', 'Norte'], ['P3', 'Verificar', '09:20', 'Bruno', 'Norte'], ['P2', 'Notificar', '09:30', 'Diego', 'Sur'],
    ['P3', 'Rechazar', '09:40', 'Carla', 'Norte'], ['P3', 'Notificar', '10:00', 'Diego', 'Norte'], ['P4', 'Registrar', '10:05', 'Ana', 'Sur'],
    ['P4', 'Verificar', '10:15', 'Bruno', 'Sur'], ['P4', 'Aprobar', '10:50', 'Carla', 'Sur'], ['P4', 'Notificar', '11:15', 'Diego', 'Sur'],
  ];
  const mins = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };

  function montarImportar(cuerpo) {
    let mCaso = 'caso', mAct = 'actividad', mTiempo = 'hora';
    const ctl = VIZ.controles(cuerpo);
    const opc = (cols) => cols.map((c) => [c, c]);
    const sCaso = ctl.selector({ etiqueta: 'Identificador de caso', opciones: opc(['caso', 'recurso', 'region']), valor: mCaso, alCambiar: (v) => { mCaso = v; dibujar(); } });
    const sAct = ctl.selector({ etiqueta: 'Actividad', opciones: opc(['actividad', 'recurso', 'region', 'caso']), valor: mAct, alCambiar: (v) => { mAct = v; dibujar(); } });
    const sTim = ctl.selector({ etiqueta: 'Marca de tiempo', opciones: [['hora', 'hora'], ['ninguna', 'ninguna (orden del archivo)']], valor: mTiempo, alCambiar: (v) => { mTiempo = v; dibujar(); } });
    ctl.boton('Mapeo correcto', () => { mCaso = 'caso'; mAct = 'actividad'; mTiempo = 'hora'; sCaso.valor = mCaso; sAct.valor = mAct; sTim.valor = mTiempo; dibujar(); }, { primario: true });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'columna de caso' }, { color: C.s2, texto: 'columna de actividad' }, { color: C.s3, texto: 'columna de tiempo' }]);
    const cajaT = VIZ.el('div', { class: 'caja-desplazable' });
    const cajaX = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.append(cajaT, cajaX);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Es el asistente de importación de CSV de cualquier herramienta. Elija qué columna identifica el caso, cuál es la actividad y si se ordena por tiempo; abajo se genera el XES y se recalculan casos, variantes y orden. Pruebe «recurso» como caso.');

    function dibujar() {
      const ic = COLS.indexOf(mCaso), ia = COLS.indexOf(mAct), it = COLS.indexOf('hora'), ir = COLS.indexOf('recurso');
      const rol = (c) => (c === mCaso ? C.s1 : c === mAct ? C.s2 : c === 'hora' && mTiempo === 'hora' ? C.s3 : null);
      cajaT.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ...COLS.map((c) => VIZ.el('th', { style: { color: rol(c) } }, c)))),
        VIZ.el('tbody', null, ...FILAS.map((f) => VIZ.el('tr', null, ...f.map((v, j) => VIZ.el('td', { style: rol(COLS[j]) ? { color: rol(COLS[j]) } : null }, v)))))));
      if (mCaso === mAct) {
        cajaX.replaceChildren(VIZ.el('div', { class: 'lista-mono' }, 'Una misma columna no puede ser a la vez caso y actividad: cada traza tendría un solo evento repetido.'));
        registro.textContent = 'Mapeo inválido: caso y actividad usan la misma columna.';
        lectura.set([['casos', '—'], ['eventos', String(FILAS.length)], ['variantes', '—']]);
        return;
      }
      const grupos = new Map();
      FILAS.forEach((f, k) => { const g = f[ic]; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push({ f, k }); });
      for (const ev of grupos.values()) if (mTiempo === 'hora') ev.sort((a, b) => mins(a.f[it]) - mins(b.f[it]) || a.k - b.k);
      const trazas = [...grupos.entries()].map(([id, ev]) => ({ id, ev, tr: ev.map((e) => e.f[ia]) }));
      const vars = new Set(trazas.map((t) => t.tr.join('›')));
      const desord = trazas.filter((t) => t.ev.some((e, i) => i && mins(e.f[it]) < mins(t.ev[i - 1].f[it]))).length;
      const t0 = trazas[0];
      const lineas = ['<log xes.version="1.0">', `  <trace>`, `    <string key="concept:name" value="${t0.id}"/>`];
      t0.ev.slice(0, 3).forEach((e) => {
        lineas.push('    <event>', `      <string key="concept:name" value="${e.f[ia]}"/>`, `      <string key="org:resource" value="${e.f[ir]}"/>`);
        if (mTiempo === 'hora') lineas.push(`      <date key="time:timestamp" value="2025-03-10T${e.f[it]}:00"/>`);
        lineas.push('    </event>');
      });
      if (t0.ev.length > 3) lineas.push(`    <!-- … ${t0.ev.length - 3} evento(s) más -->`);
      lineas.push('  </trace>', `  <!-- … ${trazas.length - 1} traza(s) más -->`, '</log>');
      const pre = VIZ.el('pre', { class: 'lista-mono' }); pre.textContent = lineas.join('\n');
      cajaX.replaceChildren(pre);
      const buen = mCaso === 'caso' && mAct === 'actividad' && mTiempo === 'hora';
      registro.textContent = buen ? `Mapeo correcto: ${trazas.length} casos (pedidos), cada uno con su secuencia ordenada por hora.`
        : mCaso !== 'caso' ? `«${mCaso}» como caso mezcla pedidos distintos en una misma traza: hay ${trazas.length} «casos» que no son instancias del proceso.`
          : mAct !== 'actividad' ? `«${mAct}» como actividad no describe pasos del proceso: las variantes pierden sentido.`
            : `Sin marca de tiempo se respeta el orden del archivo: ${desord} caso(s) quedan con eventos en orden distinto del real.`;
      lectura.set([
        ['casos (trazas)', String(trazas.length)],
        ['eventos', String(FILAS.length)],
        ['actividades distintas', String(new Set(FILAS.map((f) => f[ia])).size)],
        ['variantes', String(vars.size)],
        ['casos con orden alterado', mTiempo === 'hora' ? '0' : String(desord)],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('process-mining-tools', {
    intro: String.raw`
      <p>Casi toda herramienta de minería de procesos (<strong>ProM</strong>, Disco, Celonis, pm4py, bupaR…) sigue el mismo flujo: <em>importar</em> el registro,
      <em>filtrarlo</em>, <em>descubrir</em> un modelo, <em>verificar</em> su conformidad y <em>analizar</em> el desempeño. ProM, desarrollada en la Universidad Tecnológica de Eindhoven, lo
      organiza en <em>plug-ins</em> que se encadenan, cada uno con entradas y salidas tipadas.</p>
      <p>Lo que cambia entre herramientas es la interfaz y la escala; las decisiones importantes (qué columna es el caso, cuánto filtrar, qué algoritmo usar) son las mismas
      y es ahí donde se ganan o se pierden los proyectos.</p>`,
    visualizaciones: [
      {
        titulo: 'El flujo de análisis, paso a paso',
        descripcion: 'Avance por los cinco pasos con un registro ruidoso. Baje la cobertura de variantes y compare el fitness del registro filtrado con el del completo.',
        montar: montarPipeline,
      },
      {
        titulo: 'Importar un CSV y generar el XES',
        descripcion: 'Asigne las columnas de caso, actividad y tiempo y vea el XES resultante. Un mapeo equivocado cambia el número de casos y de variantes.',
        montar: montarImportar,
      },
    ],
    teoria: String.raw`
      <h2>El formato XES</h2>
      <p>XES (<em>eXtensible Event Stream</em>, estándar IEEE 1849) representa un registro como un conjunto de <em>trazas</em>, cada una con una lista de <em>eventos</em> y atributos tipados.
      Las extensiones estándar fijan los nombres habituales:</p>
      <table>
        <tr><th>Atributo</th><th>Significado</th></tr>
        <tr><td>concept:name</td><td>nombre del caso o de la actividad</td></tr>
        <tr><td>time:timestamp</td><td>instante del evento</td></tr>
        <tr><td>org:resource</td><td>persona o sistema que ejecutó</td></tr>
        <tr><td>lifecycle:transition</td><td>estado del ciclo de vida (<em>start</em>, <em>complete</em>)</td></tr>
      </table>
      <pre><code>&lt;trace&gt;
  &lt;string key="concept:name" value="P1"/&gt;
  &lt;event&gt;
    &lt;string key="concept:name" value="Registrar"/&gt;
    &lt;date key="time:timestamp" value="2025-03-10T08:00:00"/&gt;
  &lt;/event&gt;
&lt;/trace&gt;</code></pre>
      <p>Un CSV es una tabla plana: se necesita al menos una columna de caso, una de actividad y una de tiempo. Elegir mal el identificador del caso es el error más frecuente y el que
      más distorsiona los resultados (ver <a href="tema.html?id=event-log-quality">extracción y calidad de registros</a>).</p>
      <h2>Flujo de análisis</h2>
      <pre><code>L ← importar(archivo)                    ← XES o CSV con asignación de columnas
L' ← filtrar(L, cobertura de variantes)  ← quitar ruido y casos incompletos
N ← descubrir(L')                         ← Alfa, heurístico o inductivo
f ← fitness(N, L)                         ← reproducción de fichas o alineaciones
informe ← desempeño(N, L')               ← tiempos de espera y servicio</code></pre>
      <p>Si el modelo se descubre con un registro filtrado pero se evalúa contra el completo, el fitness cae por todo lo que se descartó: es normal y debe reportarse junto con la cobertura.</p>
      <h2>Comparación de herramientas</h2>
      <table>
        <tr><th>Herramienta</th><th>Tipo</th><th>Fortaleza</th></tr>
        <tr><td>ProM</td><td>académica, código abierto</td><td>gran variedad de algoritmos como plug-ins</td></tr>
        <tr><td>pm4py</td><td>biblioteca de Python</td><td>automatización y combinación con ciencia de datos</td></tr>
        <tr><td>bupaR</td><td>paquete de R</td><td>análisis exploratorio con el ecosistema de R</td></tr>
        <tr><td>Disco</td><td>comercial</td><td>mapas de procesos rápidos y filtros interactivos</td></tr>
        <tr><td>Celonis</td><td>plataforma comercial</td><td>conexión con sistemas empresariales y escala</td></tr>
      </table>
      <h2>Conexiones</h2>
      <p>Los pasos de descubrimiento y conformidad se estudian en <a href="tema.html?id=alpha-algorithm">el algoritmo Alfa</a> y en
      <a href="tema.html?id=token-based-replay">la reproducción de fichas</a>; la elección de filtros se vincula con el ruido de
      <a href="tema.html?id=noise-and-incompleteness">ruido e incompletitud</a>. Este flujo corresponde a las etapas 1 y 2 del <a href="tema.html?id=l-star-lifecycle">ciclo L*</a>.</p>`,
  });
})();
