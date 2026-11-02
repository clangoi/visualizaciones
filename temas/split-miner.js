(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const A = P.act;

  // Dos procesos de ejemplo con actividades de una letra: uno con concurrencia y otro con un bucle de longitud 2.
  const PROCESOS = {
    sol: {
      nombre: 'Solicitud con ramas paralelas',
      arbol: P.sec(A('Recibir'), P.y(A('Validar'), A('Evaluar')), A('Decidir'), P.xor([A('Aprobar'), A('Rechazar'), A('Escalar')], [0.5, 0.3, 0.2]), A('Notificar')),
      letras: { Recibir: 'a', Validar: 'b', Evaluar: 'c', Decidir: 'd', Aprobar: 'e', Rechazar: 'f', Escalar: 'g', Notificar: 'h' },
    },
    rec: {
      nombre: 'Reclamos con bucle de revisión',
      arbol: P.procesos.reclamos.arbol,
      letras: { 'Recibir reclamo': 'a', Clasificar: 'b', Investigar: 'c', 'Pedir información': 'd', 'Aprobar compensación': 'e', 'Rechazar reclamo': 'f', 'Cerrar caso': 'g' },
    },
  };
  const nombresDe = (k) => Object.fromEntries(Object.entries(PROCESOS[k].letras).map(([nom, l]) => [l, nom]));
  function logDe(k, n, semilla, ruido) {
    const log = P.simular(PROCESOS[k].arbol, n, semilla, { ruido, espera: 5 });
    log.forEach((c) => c.eventos.forEach((e) => { e.act = PROCESOS[k].letras[e.act] || e.act; }));
    return log;
  }
  const nombres = (cuerpo, N) => cuerpo.appendChild(VIZ.el('div', { class: 'lista-mono' }, VIZ.el('div', null, Object.entries(N).map(([k, v]) => `${k} = ${v}`).join('  ·  '))));
  const IN = '▶', OUT = '■';

  /* ---------- Modelo de Split Miner: DFG, concurrencia, bucles y filtro por percentil ---------- */

  function modelo(log, pct, eps) {
    const d = P.dfg(log), acts = d.acts, n = d.n;
    const aba = new Map();
    for (const c of log) {
      const t = P.trazaDe(c);
      for (let i = 0; i + 2 < t.length; i++) if (t[i] === t[i + 2] && t[i] !== t[i + 1]) aba.set(t[i] + t[i + 1], (aba.get(t[i] + t[i + 1]) || 0) + 1);
    }
    const lazos2 = new Set(), conc = new Set(), autos = new Set(acts.filter((a) => n(a, a) > 0));
    for (const a of acts) for (const b of acts) {
      if (a >= b) continue;
      const x = n(a, b), z = n(b, a);
      if (!x || !z) continue;
      if ((aba.get(a + b) || 0) + (aba.get(b + a) || 0) > 0) lazos2.add(a + b);
      else if (Math.abs(x - z) / (x + z) < eps) conc.add(a + b);
    }
    const par = (a, b) => (a < b ? a + b : b + a);
    const aristas = [];
    for (const e of d.aristas) {
      if (e.de === e.a) continue;
      aristas.push({ de: e.de, a: e.a, n: e.n, estado: lazos2.has(par(e.de, e.a)) ? 'bucle' : conc.has(par(e.de, e.a)) ? 'conc' : 'cand' });
    }
    d.ini.forEach((v, a) => aristas.push({ de: IN, a, n: v, estado: 'cand' }));
    d.fin.forEach((v, a) => aristas.push({ de: a, a: OUT, n: v, estado: 'cand' }));
    const cand = aristas.filter((e) => e.estado === 'cand');
    const umbral = cand.length ? P.cuantil(cand.map((e) => e.n), pct) : 0;
    const mejorIn = new Map(), mejorOut = new Map();
    for (const e of cand) {
      if (!mejorIn.has(e.a) || e.n > mejorIn.get(e.a).n) mejorIn.set(e.a, e);
      if (!mejorOut.has(e.de) || e.n > mejorOut.get(e.de).n) mejorOut.set(e.de, e);
    }
    for (const e of cand) {
      if (e.n >= umbral) e.estado = 'perc';
      else if (mejorIn.get(e.a) === e || mejorOut.get(e.de) === e) e.estado = 'mejor';
      else e.estado = 'quitada';
    }
    return { acts, d, aristas, conc, lazos2, autos, umbral, par };
  }
  // Layout estable: el DFG completo de un registro limpio de referencia.
  const REF = {};
  function referencia(k) {
    if (REF[k]) return REF[k];
    const log = logDe(k, 300, 91, 0), d = P.dfg(log);
    const ids = [IN, ...d.acts, OUT], arcos = d.aristas.filter((e) => e.de !== e.a).map((e) => [e.de, e.a]);
    d.ini.forEach((v, a) => arcos.push([IN, a])); d.fin.forEach((v, a) => arcos.push([a, OUT]));
    return (REF[k] = { ids, pos: P.disponer(ids, arcos), acts: d.acts });
  }
  const ESTILO = {
    perc: { color: C.tinta, texto: 'conservada por el percentil' },
    mejor: { color: C.s1, texto: 'conservada: mejor entrante o saliente' },
    quitada: { color: C.s8, texto: 'eliminada por el percentil', guiones: true },
    conc: { color: C.s3, texto: 'concurrencia (se quita del grafo)', guiones: true },
    bucle: { color: C.s7, texto: 'bucle corto (se conserva aparte)' },
  };
  function distSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  const nodosBase = (ids) => ids.map((id) => (id === IN ? { id, tipo: 'inicio', relleno: C.s6, borde: C.s6 } : id === OUT ? { id, tipo: 'fin' } : { id, tipo: 'act', etiqueta: id }));

  /* ---------- Fig. 1: filtro del DFG por percentil ---------- */

  function montarFiltro(cuerpo) {
    let proc = 'sol', pct = 0.5, eps = 0.4, ruido = 0.1, semilla = 1, M = null, lineas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: Object.entries(PROCESOS).map(([k, p]) => [k, p.nombre]), valor: proc, alCambiar: (v) => { proc = v; nuevo(); } });
    ctl.rango({ etiqueta: 'Percentil de frecuencia', min: 0, max: 1, paso: 0.05, valor: pct, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pct = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tolerancia de concurrencia ε', min: 0, max: 1, paso: 0.05, valor: eps, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eps = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.3, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; nuevo(); } });
    ctl.boton('Nuevo registro', () => { semilla++; nuevo(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(ESTILO).map((s) => ({ color: s.color, texto: s.texto, forma: 'linea' })));
    const nom = VIZ.el('div'); cuerpo.appendChild(nom);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Suba el percentil: las aristas poco frecuentes se eliminan (rojo), pero cada actividad conserva su mejor entrante y su mejor saliente (azul) para que el grafo no se parta. Con ε alto, b y c (paralelas) se detectan como concurrentes y sus aristas cruzadas salen del grafo (verde). Pase el cursor sobre una arista para ver su frecuencia.');

    function nuevo() {
      M = null; nom.replaceChildren(); nombres(nom, nombresDe(proc));
      dibujar(true);
    }
    let log = null, clave = '';
    function dibujar(rehacer) {
      const k = `${proc}|${semilla}|${ruido}`;
      if (rehacer || k !== clave || !log) { log = logDe(proc, 150, semilla, ruido); clave = k; }
      M = modelo(log, pct, eps);
      lienzo.limpiar();
      const ref = referencia(proc), maxN = Math.max(1, ...M.aristas.map((e) => e.n));
      const nodos = nodosBase(ref.ids);
      const aristas = [];
      for (const e of M.aristas) {
        const s = ESTILO[e.estado], vive = e.estado === 'perc' || e.estado === 'mejor' || e.estado === 'bucle';
        aristas.push({ de: e.de, a: e.a, etiqueta: vive ? e.n : undefined, ancho: vive ? 1.5 + 2.5 * e.n / maxN : 1.5, color: s.color, guiones: !!s.guiones, info: e });
      }
      M.autos.forEach((a) => aristas.push({ de: a, a, color: C.s7, ancho: 2, info: { de: a, a, n: M.d.n(a, a), estado: 'bucle' } }));
      const geo = P.dibujarGrafo(lienzo, nodos, aristas, ref.pos, { margenX: 26, margenY: 30 });
      lineas = geo.lineas;
      const cuenta = (est) => M.aristas.filter((e) => e.estado === est).length;
      const ok = cuenta('perc') + cuenta('mejor');
      registro.textContent = `El DFG tiene ${M.aristas.length} aristas entre actividades, inicio y fin: ${M.conc.size} par(es) concurrente(s), ${M.lazos2.size} bucle(s) de longitud 2 y ${M.autos.size} de longitud 1. De las ${cuenta('perc') + cuenta('mejor') + cuenta('quitada')} candidatas se conservan ${ok} (umbral de frecuencia ${VIZ.fmt(M.umbral, 3)}).`;
      lectura.set([
        ['aristas del DFG', String(M.aristas.length)],
        ['pares concurrentes', [...M.conc].join(' ') || '—'],
        ['conservadas / eliminadas', `${ok} / ${cuenta('quitada')}`],
        ['umbral de frecuencia', VIZ.fmt(M.umbral, 3)],
      ]);
    }
    lienzo.alDibujar = () => dibujar(false);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = null, dm = 9;
      for (const l of lineas) { if (!l.p1 || !l.e.info || l.p1 === l.p2) continue; const dd = distSeg(x, y, l.p1, l.p2); if (dd < dm) { dm = dd; mejor = l.e.info; } }
      if (!mejor) return tip.ocultar();
      const nm = (id) => (id === IN ? 'inicio' : id === OUT ? 'fin' : id);
      tip.mostrar(x, y, `<b>${nm(mejor.de)}</b> → <b>${nm(mejor.a)}</b><br>frecuencia <b>${mejor.n}</b><br>${ESTILO[mejor.estado].texto}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevo();
  }

  /* ---------- Fig. 2: descubrimiento de compuertas ---------- */

  const COLOR_TIPO = { '×': C.s1, '+': C.s3, '×+': C.s7, o: C.s4 };
  // Tipo de compuerta para un conjunto de vecinos según la relación de concurrencia entre ellos.
  function clasificar(vec, conc, par) {
    const pares = [];
    for (let i = 0; i < vec.length; i++) for (let j = i + 1; j < vec.length; j++) pares.push([vec[i], vec[j], conc.has(par(vec[i], vec[j]))]);
    const cc = pares.filter((p) => p[2]).length;
    if (cc === pares.length) return { tipo: '+', pares };
    if (cc === 0) return { tipo: '×', pares };
    // Grupos de concurrencia: si cada componente es un clique es una elección entre ramas paralelas; si no, un OR.
    const grupo = new Map(vec.map((v) => [v, v]));
    const raiz = (v) => { while (grupo.get(v) !== v) v = grupo.get(v); return v; };
    pares.forEach(([a, b, c]) => { if (c) grupo.set(raiz(a), raiz(b)); });
    const comps = new Map();
    vec.forEach((v) => { const r = raiz(v); comps.set(r, (comps.get(r) || []).concat(v)); });
    const clique = [...comps.values()].every((g) => pares.filter(([a, b]) => g.includes(a) && g.includes(b)).every((p) => p[2]));
    return { tipo: clique ? '×+' : 'o', pares };
  }

  function montarCompuertas(cuerpo) {
    let proc = 'sol', pct = 0.3, ruido = 0, semilla = 1, M = null, decisiones = [], hechas = 0, pos = null, idsF = [], arcosF = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: Object.entries(PROCESOS).map(([k, p]) => [k, p.nombre]), valor: proc, alCambiar: (v) => { proc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Percentil de frecuencia', min: 0, max: 1, paso: 0.05, valor: pct, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pct = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.3, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevo registro', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 420 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: '× XOR: sucesoras exclusivas' }, { color: VIZ.alfa(C.s3, 0.3), borde: C.s3, texto: '+ AND: todas concurrentes' },
      { color: VIZ.alfa(C.s7, 0.3), borde: C.s7, texto: '×+ elige entre grupos paralelos' }, { color: VIZ.alfa(C.s4, 0.3), borde: C.s4, texto: 'o OR (mezcla)' },
      { color: C.s2, texto: 'compuerta que se acaba de decidir', forma: 'punto' }, { color: C.s7, texto: 'bucle corto', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.25), borde: C.s6, texto: 'actividad inicial' }, { color: C.neutro, borde: C.tinta, texto: 'actividad final' },
    ]);
    const nom = VIZ.el('div'); cuerpo.appendChild(nom);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada actividad con varias sucesoras (split) o varias predecesoras (join) se mira la concurrencia entre ellas: todas concurrentes dan AND, ninguna concurrente da XOR, y las mezclas dan una elección entre grupos o un OR. Con ruido alto aparecen compuertas OR espurias; suba el percentil para eliminarlas.');

    function iniciar() {
      nom.replaceChildren(); nombres(nom, nombresDe(proc));
      const log = logDe(proc, 150, semilla, ruido);
      M = modelo(log, pct, 0.4);
      const vivas = M.aristas.filter((e) => (e.estado === 'perc' || e.estado === 'mejor') && e.de !== IN && e.a !== OUT);
      const ids = [...M.acts];
      decisiones = [];
      for (const lado of ['split', 'join']) {
        for (const x of ids) {
          const vec = [...new Set(vivas.filter((e) => (lado === 'split' ? e.de === x : e.a === x)).map((e) => (lado === 'split' ? e.a : e.de)))].filter((v) => v !== IN && v !== OUT).sort();
          const total = vivas.filter((e) => (lado === 'split' ? e.de === x : e.a === x)).length;
          if (total >= 2 && vec.length >= 2) decisiones.push({ lado, x, vec, ...clasificar(vec, M.conc, M.par) });
        }
      }
      // Grafo final con compuertas, para fijar posiciones de una vez.
      const gid = (d) => (d.lado === 'split' ? 'S' : 'J') + d.x;
      const tiene = (lado, x) => decisiones.find((d) => d.lado === lado && d.x === x);
      idsF = [...ids, ...decisiones.map(gid)];
      arcosF = [];
      for (const e of vivas) arcosF.push({ de: tiene('split', e.de) ? 'S' + e.de : e.de, a: tiene('join', e.a) ? 'J' + e.a : e.a });
      decisiones.forEach((d) => (d.lado === 'split' ? arcosF.push({ de: d.x, a: gid(d) }) : arcosF.push({ de: gid(d), a: d.x })));
      pos = P.disponer(idsF, arcosF.map((e) => [e.de, e.a]));
      hechas = 0;
      return (function* () {
        for (let i = 0; i < decisiones.length; i++) { hechas = i + 1; yield; }
      })();
    }
    function dibujar() {
      if (!M) return;
      lienzo.limpiar();
      const vivo = (e) => e.estado === 'perc' || e.estado === 'mejor';
      const vivas = M.aristas.filter((e) => vivo(e) && e.de !== IN && e.a !== OUT);
      const inicios = new Set(M.aristas.filter((e) => vivo(e) && e.de === IN).map((e) => e.a)), fines = new Set(M.aristas.filter((e) => vivo(e) && e.a === OUT).map((e) => e.de));
      const hechasD = decisiones.slice(0, hechas), actual = hechas ? decisiones[hechas - 1] : null;
      const tiene = (lado, x) => hechasD.find((d) => d.lado === lado && d.x === x);
      const gid = (d) => (d.lado === 'split' ? 'S' : 'J') + d.x;
      const nodos = M.acts.map((a) => ({ id: a, tipo: 'act', etiqueta: a, relleno: inicios.has(a) ? VIZ.alfa(C.s6, 0.25) : fines.has(a) ? C.neutro : C.superficie, borde: inicios.has(a) ? C.s6 : C.tinta }));
      hechasD.forEach((d) => nodos.push({ id: gid(d), tipo: 'rombo', etiqueta: d.tipo, relleno: VIZ.alfa(COLOR_TIPO[d.tipo], 0.3), borde: COLOR_TIPO[d.tipo], anillo: d === actual ? C.s2 : null }));
      const aristas = [];
      for (const e of vivas) aristas.push({ de: tiene('split', e.de) ? 'S' + e.de : e.de, a: tiene('join', e.a) ? 'J' + e.a : e.a, ancho: 2, color: C.tinta });
      hechasD.forEach((d) => (d.lado === 'split' ? aristas.push({ de: d.x, a: gid(d), ancho: 2, color: C.tinta }) : aristas.push({ de: gid(d), a: d.x, ancho: 2, color: C.tinta })));
      M.aristas.filter((e) => e.estado === 'bucle').forEach((e) => aristas.push({ de: e.de, a: e.a, ancho: 2, color: C.s7 }));
      M.autos.forEach((a) => aristas.push({ de: a, a, ancho: 2, color: C.s7 }));
      P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: 26, margenY: 30 });
      const f = (d) => (d.lado === 'split' ? 'split' : 'join');
      if (actual) {
        lista.replaceChildren(VIZ.el('div', { class: 'activa' }, `${f(actual)} de ${actual.x}: ${actual.lado === 'split' ? 'sucesoras' : 'predecesoras'} {${actual.vec.join(', ')}}`),
          ...actual.pares.map(([a, b, c]) => VIZ.el('div', null, `${a} – ${b}: `, VIZ.el('span', { style: { color: c ? C.s3 : C.s1 } }, c ? 'concurrentes' : 'exclusivas'))));
        const txt = { '+': 'todas las parejas son concurrentes: AND', '×': 'ninguna pareja es concurrente: XOR', '×+': 'hay grupos concurrentes y los grupos son exclusivos entre sí: elección entre ramas paralelas', o: 'la concurrencia es parcial (no forma grupos completos): OR' }[actual.tipo];
        registro.textContent = `${f(actual)[0].toUpperCase() + f(actual).slice(1)} de ${actual.x}: ${txt}.`;
      } else {
        lista.replaceChildren(VIZ.el('div', null, `Hay ${decisiones.length} compuertas por decidir (splits y joins con varias actividades vecinas).`));
        registro.textContent = 'Pulse «Un paso» para decidir la primera compuerta.';
      }
      const cnt = (t) => hechasD.filter((d) => d.tipo === t).length;
      lectura.set([
        ['compuertas decididas', `${hechas} de ${decisiones.length}`],
        ['XOR / AND', `${cnt('×')} / ${cnt('+')}`],
        ['×+ / OR', `${cnt('×+')} / ${cnt('o')}`],
        ['aristas del grafo', String(vivas.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('split-miner', {
    intro: String.raw`
      <p>El <strong>Split Miner</strong> parte del <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>, lo limpia y recién entonces decide qué
      compuertas hacen falta. Quita las aristas poco frecuentes con un <em>percentil</em> (sin dejar a ninguna actividad aislada), separa el paralelismo de los bucles cortos y,
      para cada actividad con varias vecinas, mira cuáles de ellas son concurrentes para elegir entre XOR, AND o una mezcla.</p>
      <p>El resultado es un modelo <a href="tema.html?id=bpmn-gateways">BPMN</a> pequeño y muy preciso, algo más permisivo que el del
      <a href="tema.html?id=inductive-miner">Inductive Miner</a> (que garantiza bloques) pero mucho menos enredado que un DFG sin filtrar.</p>`,
    visualizaciones: [
      {
        titulo: 'Filtro del DFG por percentil',
        descripcion: 'Suba el percentil y observe qué aristas se eliminan y cuáles sobreviven por ser el mejor entrante o saliente de una actividad; con ε alto las ramas paralelas pasan a concurrencia. Pruebe el proceso con bucle.',
        montar: montarFiltro,
      },
      {
        titulo: 'Descubrir splits y joins',
        descripcion: 'Avance paso a paso: en la solicitud verá un AND tras a, un XOR tras d y sus joins. Con ruido alto aparecen compuertas dudosas que el percentil elimina.',
        montar: montarCompuertas,
      },
    ],
    teoria: String.raw`
      <h2>Idea general</h2>
      <p>Los mineros que construyen el modelo directamente sobre el DFG filtrado tienden a generar modelos simples y precisos, pero con riesgo de errores de estructura.
      El Split Miner (Augusto y otros) opera en cinco pasos: construir el DFG, detectar bucles cortos y concurrencia, filtrar, descubrir compuertas de división y de unión
      y, si se requiere, reparar el modelo hasta obtener un BPMN <em>sound</em> (éste último paso no se muestra aquí).</p>
      <h2>1. Bucles cortos y concurrencia</h2>
      <p>Sea \(|a > b|\) la frecuencia de \(a\) seguida de \(b\). Una arista \(a \to a\) es un bucle de longitud 1. Un par con \(a > b\) y \(b > a\) es un bucle de longitud 2 si aparece
      \(aba\) o \(bab\) en alguna traza; si no, es candidato a <em>concurrente</em> cuando las dos frecuencias son parecidas:</p>
      \[ a \parallel b \iff |a > b| > 0,\; |b > a| > 0,\; \frac{\big|\,|a > b| - |b > a|\,\big|}{|a > b| + |b > a|} < \varepsilon. \]
      <p>Si una dirección domina (por ejemplo \(40\) contra \(2\)), la relación es causal y la arista contraria es ruido. Las aristas de pares concurrentes se quitan del grafo; lo que las une se
      reconstruye después con un AND.</p>
      <h2>2. Filtro por percentil</h2>
      <p>Sea \(\theta\) el cuantil de orden \(\eta\) de las frecuencias de las aristas candidatas (incluyendo las del nodo de inicio y de fin). Se conserva una arista si</p>
      \[ |a > b| \ge \theta \quad\text{o}\quad (a, b) \text{ es la arista entrante o saliente más frecuente de } b \text{ o de } a. \]
      <p>La segunda cláusula evita que una actividad se quede sin entrada o sin salida. Con \(\eta = 0\) se conserva todo; con \(\eta = 1\), solo las aristas más frecuentes y las «mejores» de cada actividad.
      Los bucles cortos detectados se conservan aparte.</p>
      <h2>3. Compuertas de división y de unión</h2>
      <p>Para cada actividad \(x\) con sucesoras \(Y = \{y_1,\dots,y_k\}\), \(k \ge 2\), se mira la relación de concurrencia en \(Y\):</p>
      <ul>
        <li>todas las parejas concurrentes: <strong>AND-split</strong>;</li>
        <li>ninguna concurrente: <strong>XOR-split</strong>;</li>
        <li>mezcla con grupos concurrentes completos: una elección entre grupos (XOR sobre ANDs, marcada ×+ en la figura);</li>
        <li>mezcla irregular: <strong>OR</strong>.</li>
      </ul>
      <p>Los joins se obtienen igual a partir de las predecesoras. Ejemplo: tras \(d\) las sucesoras son \(e, f, g\), que nunca aparecen juntas; ninguna pareja es concurrente, así que es un XOR.</p>
      <pre><code>SplitMiner(L, η, ε):
    G ← DFG(L); detectar bucles de longitud 1 y 2
    C ← pares (a, b) concurrentes con tolerancia ε; quitar sus aristas de G
    θ ← cuantil_η de las frecuencias de las aristas de G
    G' ← aristas con frecuencia ≥ θ ∪ mejores entrantes ∪ mejores salientes
    para cada nodo x de G' con varias sucesoras: insertar compuerta según C
    para cada nodo x de G' con varias predecesoras: insertar compuerta según C
    devolver BPMN (y repararlo si no es sound)</code></pre>
      <h2>Comparación con otros mineros</h2>
      <ul>
        <li>Frente al <a href="tema.html?id=heuristic-miner">Heuristic Miner</a>, filtra por percentil de frecuencia (más fácil de ajustar) y garantiza conectividad.</li>
        <li>Frente al <a href="tema.html?id=inductive-miner">Inductive Miner</a>, produce modelos con mayor precisión y simplicidad, pero sin la garantía automática de ser un árbol de procesos con soundness.</li>
        <li>Para medir esas diferencias vea <a href="tema.html?id=discovery-comparison">la comparación de algoritmos</a> y las métricas de <a href="tema.html?id=fitness-precision">fitness y precisión</a>.</li>
      </ul>`,
  });
})();
