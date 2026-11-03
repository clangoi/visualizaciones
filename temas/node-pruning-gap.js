(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* Mochila con dos recursos (peso y volumen): max v·x, W x ≤ cap, x ∈ {0,1}ⁿ. */
  function instancia(semilla, n = 6) {
    const r = VIZ.semilla(semilla * 7 + 3);
    const W = [[], []], v = [];
    for (let i = 0; i < n; i++) {
      const a = 3 + Math.floor(r() * 13), b = 3 + Math.floor(r() * 13);
      W[0].push(a); W[1].push(b); v.push(Math.round((a + b) / 2) + 2 + Math.floor(r() * 9));
    }
    return { W, v, cap: W.map((f) => Math.floor(f.reduce((s, q) => s + q, 0) * 0.4)), n };
  }
  const sistema = (I) => ({
    A: [...I.W, ...I.v.map((_, i) => I.v.map((__, j) => (i === j ? 1 : 0)))],
    b: [...I.cap, ...I.v.map(() => 1)],
    sen: [...I.W.map(() => '<='), ...I.v.map(() => '<=')],
  });
  const esEntera = (x) => x && x.every((v) => Math.abs(v - Math.round(v)) < 1e-6);
  const fx = (x) => (x ? x.map((v) => VIZ.fmt(Math.round(v * 1000) / 1000, 3)).join(' ') : '—');

  /* Ramificación y acotamiento (maximizar) como generador. Opciones: seleccion ('mejor' | 'profundidad'),
     podar (poda por cota activa), incInicial (valor de un incumbente conocido de antemano), maxNodos. */
  function* ramificar(I, { seleccion = 'mejor', podar = true, incInicial = null, maxNodos = 150 } = {}) {
    const { A, b, sen } = sistema(I);
    const nodos = [];
    let inc = incInicial != null && incInicial > 0 ? { x: null, z: incInicial, inicial: true } : null;
    const crear = (padre, cotas, rama) => {
      const r = O.lp(I.v, A, sen, b, { cotas });
      const nd = { id: nodos.length, padre, cotas, rama, estado: r.estado, x: r.x, z: r.z, hijos: [], poda: null };
      nodos.push(nd);
      return nd;
    };
    const raiz = crear(-1, I.v.map(() => [0, Infinity]), '');
    let abiertos = [raiz];
    yield { nodos, actual: raiz, incumbente: inc, accion: 'raiz', truncado: false };
    while (abiertos.length) {
      if (nodos.length >= maxNodos) { yield { nodos, actual: null, incumbente: inc, accion: 'fin', truncado: true }; return; }
      const nd = seleccion === 'mejor'
        ? abiertos.reduce((a, q) => ((q.z ?? -Infinity) > (a.z ?? -Infinity) ? q : a))
        : abiertos[abiertos.length - 1];
      abiertos = abiertos.filter((q) => q !== nd);
      if (nd.estado !== 'optimo') { nd.poda = 'infactibilidad'; yield { nodos, actual: nd, incumbente: inc, accion: 'poda-infactible' }; continue; }
      if (podar && inc && nd.z <= inc.z + 1e-7) { nd.poda = 'cota'; yield { nodos, actual: nd, incumbente: inc, accion: 'poda-cota' }; continue; }
      const frac = nd.x.map((v) => Math.abs(v - Math.round(v)));
      let j = -1, mx = 1e-6;
      frac.forEach((f, k) => { if (f > mx) { mx = f; j = k; } });
      if (j < 0) {
        nd.poda = 'entera';
        const mejora = !inc || nd.z > inc.z + 1e-9;
        if (mejora) inc = { x: nd.x.map((v) => Math.round(v)), z: nd.z, nodo: nd.id };
        yield { nodos, actual: nd, incumbente: inc, accion: mejora ? 'incumbente' : 'entera-sin-mejora' };
        continue;
      }
      const v = nd.x[j];
      const abajo = nd.cotas.map((q) => q.slice()), arriba = nd.cotas.map((q) => q.slice());
      abajo[j][1] = Math.floor(v); arriba[j][0] = Math.ceil(v);
      const h1 = crear(nd.id, abajo, `x${j + 1} ≤ ${Math.floor(v)}`), h2 = crear(nd.id, arriba, `x${j + 1} ≥ ${Math.ceil(v)}`);
      nd.hijos = [h1.id, h2.id]; nd.ramaVar = j;
      abiertos.push(h1, h2);
      yield { nodos, actual: nd, incumbente: inc, accion: 'ramifica' };
    }
    yield { nodos, actual: null, incumbente: inc, accion: 'fin', truncado: false };
  }
  // Cota superior: mayor relajación entre los nodos abiertos, o el incumbente si ya no quedan.
  function cotaGlobal(nodos, inc) {
    let m = -Infinity;
    for (const nd of nodos) if (nd.estado === 'optimo' && !nd.hijos.length && !nd.poda) m = Math.max(m, nd.z);
    if (inc) m = Math.max(m, inc.z);
    return m;
  }
  const brecha = (cota, inc) => (inc && Number.isFinite(cota) ? Math.max(0, (cota - inc.z) / Math.abs(inc.z || 1)) : null);
  const pct = (g) => (g == null ? '—' : `${VIZ.fmt(100 * g, 3)} %`);
  function recorrer(I, op) { let fin; for (fin of ramificar(I, op)); return fin; }
  // Primera instancia (desde la semilla dada) con un árbol de tamaño apto para dibujar.
  function buscarInstancia(desde) {
    for (let s = desde; s < desde + 80; s++) {
      const I = instancia(s), fin = recorrer(I, {});
      if (fin.nodos.length >= 13 && fin.nodos.length <= 37) return { I, semilla: s };
    }
    return { I: instancia(desde), semilla: desde };
  }

  /* ---------- Árbol ---------- */

  function estadoNodo(nd) {
    if (nd.estado !== 'optimo') return 'infactible';
    if (nd.poda === 'cota') return 'cota';
    if (nd.poda === 'entera') return 'entero';
    if (nd.hijos.length) return 'ramificado';
    return 'abierto';
  }
  const ROTULO = { abierto: 'abierto', ramificado: 'ramificado', entero: 'poda por optimalidad (solución entera)', infactible: 'poda por infactibilidad', cota: 'poda por cota' };
  const LEYENDA_ARBOL = [
    { color: C.s4, texto: 'abierto (en cola)', forma: 'punto' },
    { color: C.superficie, borde: C.tinta, texto: 'ramificado', forma: 'punto' },
    { color: C.s6, texto: 'poda por optimalidad (entero)', forma: 'punto' },
    { color: C.s8, texto: 'poda por infactibilidad', forma: 'punto' },
    { color: C.inactivo, texto: 'poda por cota', forma: 'punto' },
  ];
  function disponer(nodos) {
    const pos = {};
    let k = 0, prof = 0;
    (function rec(id, nivel) {
      const nd = nodos[id];
      prof = Math.max(prof, nivel);
      if (!nd.hijos.length) { pos[id] = { u: k++, nivel }; return; }
      nd.hijos.forEach((h) => rec(h, nivel + 1));
      pos[id] = { u: (pos[nd.hijos[0]].u + pos[nd.hijos[nd.hijos.length - 1]].u) / 2, nivel };
    })(0, 0);
    return { pos, hojas: k, prof };
  }
  const altoArbol = (prof) => 70 + prof * 54;
  function dibujarArbol(lienzo, nodos, actual, elegido) {
    const { ctx, ancho: W } = lienzo;
    lienzo.limpiar();
    if (!nodos.length) return [];
    const L = disponer(nodos);
    const izq = 16, der = W - 16, sepY = 54, top = 22;
    const sep = L.hojas > 1 ? (der - izq) / (L.hojas - 1) : 0;
    const r = Math.max(4, Math.min(16, (L.hojas > 1 ? (der - izq) / L.hojas : 40) / 2 - 1));
    const X = (id) => (L.hojas > 1 ? izq + L.pos[id].u * sep : (izq + der) / 2);
    const Y = (id) => top + L.pos[id].nivel * sepY;
    const geo = [];
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje;
    for (const nd of nodos) for (const h of nd.hijos) { ctx.beginPath(); ctx.moveTo(X(nd.id), Y(nd.id)); ctx.lineTo(X(h), Y(h)); ctx.stroke(); }
    for (const nd of nodos) {
      const x = X(nd.id), y = Y(nd.id), est = estadoNodo(nd);
      const relleno = { abierto: C.s4, ramificado: C.superficie, entero: C.s6, infactible: C.s8, cota: C.inactivo }[est];
      if (nd.id === actual || nd.id === elegido) {
        ctx.strokeStyle = nd.id === actual ? C.s1 : C.s7; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 7); ctx.stroke();
      }
      ctx.fillStyle = relleno; ctx.strokeStyle = est === 'ramificado' ? C.tinta : C.superficie; ctx.lineWidth = est === 'ramificado' ? 1.5 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      if (r >= 9) {
        ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = est === 'ramificado' || est === 'abierto' ? C.tinta : C.sobre;
        ctx.fillText(String(nd.id), x, y + 0.5);
      }
      if (r >= 8) {
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(nd.estado === 'optimo' ? VIZ.fmt(nd.z, 4) : 'inf.', x, y + r + 3);
      }
      geo.push({ id: nd.id, x, y, r });
    }
    return geo;
  }
  const nodoBajo = (geo, x, y) => geo.find((g) => Math.hypot(g.x - x, g.y - y) <= g.r + 4);
  const textoNodo = (nd, inc) => `nodo <b>${nd.id}</b>${nd.rama ? ` (${nd.rama})` : ' (raíz)'}<br>` + (nd.estado === 'optimo'
    ? `relajación z = <b>${VIZ.fmt(nd.z)}</b><br>x* = (${fx(nd.x)})<br>${ROTULO[estadoNodo(nd)]}${nd.poda === 'cota' && inc ? `<br>cota ≤ incumbente ${VIZ.fmt(inc.z)}` : ''}`
    : 'relajación infactible<br>' + ROTULO.infactible);
  function explicar(nd, inc) {
    const e = estadoNodo(nd);
    const cab = `Nodo ${nd.id}${nd.rama ? ' (' + nd.rama + ')' : ''}: `;
    if (e === 'infactible') return cab + 'las cotas de esta rama no dejan ningún punto factible; se poda por infactibilidad.';
    if (e === 'entero') return cab + `la relajación ya es entera (z = ${VIZ.fmt(nd.z)}); se poda por optimalidad: no hay nada mejor que buscar debajo.`;
    if (e === 'cota') return cab + `su cota ${VIZ.fmt(nd.z)} no supera al incumbente ${inc ? VIZ.fmt(inc.z) : '—'}; se poda por cota.`;
    if (e === 'ramificado') return cab + `relajación z = ${VIZ.fmt(nd.z)} con variables fraccionarias; se ramificó.`;
    return cab + `abierto, relajación z = ${VIZ.fmt(nd.z)}; aún no se procesa.`;
  }

  /* ---------- Fig. 1: qué se poda y por qué ---------- */

  function montarPodas(cuerpo) {
    let semilla = 1, I = null, seleccion = 'mejor', podar = true, inicial = 0, optimo = 0, estado = null, geo = [], elegido = null, altoActual = altoArbol(0);
    const b0 = buscarInstancia(semilla); semilla = b0.semilla; I = b0.I;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Siguiente nodo', opciones: [['mejor', 'mejor cota'], ['profundidad', 'profundidad']], valor: seleccion, alCambiar: (v) => { seleccion = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Podar por cota', valor: podar, alCambiar: (v) => { podar = v; rep.reiniciar(); } });
    const rInicial = ctl.rango({ etiqueta: 'Incumbente inicial', min: 0, max: 60, valor: 0, formato: (v) => (v ? String(v) : 'ninguno'), alCambiar: (v) => { inicial = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { const b = buscarInstancia(semilla + 1); semilla = b.semilla; I = b.I; inicial = 0; rep.reiniciar(); });

    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => altoActual });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...LEYENDA_ARBOL, { color: C.s1, texto: 'nodo en proceso (anillo)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en cualquier nodo para leer por qué se podó. Desmarque «Podar por cota» para ver el árbol que se exploraría sin acotar (se detiene en 63 nodos), o suba el incumbente inicial para podar más desde el principio.');

    function tablaDatos() {
      const filas = [['objeto', ...I.v.map((_, i) => String(i + 1))], ['valor', ...I.v.map(String)], ['peso (≤ ' + I.cap[0] + ')', ...I.W[0].map(String)], ['volumen (≤ ' + I.cap[1] + ')', ...I.W[1].map(String)]];
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        ...filas.map((f, r) => VIZ.el('tr', null, ...f.map((t, k) => VIZ.el(r === 0 || k === 0 ? 'th' : 'td', k === 0 ? { class: 'izq' } : null, t))))));
    }
    function iniciar() {
      tablaDatos();
      optimo = Math.round(recorrer(I, {}).incumbente.z);
      rInicial.input.max = optimo; if (inicial > optimo) inicial = optimo; rInicial.valor = inicial;
      elegido = null; estado = null;
      const g = ramificar(I, { seleccion, podar, incInicial: inicial, maxNodos: podar ? 150 : 63 });
      return (function* () { for (const s of g) { estado = s; yield; } })();
    }
    const cuenta = (nodos, t) => nodos.filter((q) => q.poda === t).length;
    function dibujar() {
      const nodos = estado ? estado.nodos : [];
      const inc = estado ? estado.incumbente : null;
      if (nodos.length) {
        const nec = altoArbol(disponer(nodos).prof);
        if (nec !== altoActual) { altoActual = nec; lienzo.ajustar(true); }
      }
      const act = estado && estado.actual ? estado.actual : null;
      geo = nodos.length ? dibujarArbol(lienzo, nodos, act ? act.id : null, elegido) : (lienzo.limpiar(), []);
      if (!estado) registro.textContent = 'Pulse «Un paso» o «Hasta el final». Cada nodo termina podado o ramificado.';
      else if (elegido != null) registro.textContent = explicar(nodos[elegido], inc);
      else if (!act) registro.textContent = estado.truncado ? 'Se alcanzó el límite de 63 nodos sin terminar: sin la poda por cota el árbol crece demasiado.' : `Fin: no quedan nodos abiertos. ${inc && !inc.inicial ? `Óptimo ${VIZ.fmt(inc.z)} con x = (${inc.x.join(', ')}).` : 'Ninguna solución supera al incumbente inicial: este ya era el valor óptimo o mejor.'}`;
      else registro.textContent = explicar(act, inc);
      const completo = 2 ** (I.n + 1) - 1;
      lectura.set([
        ['nodos creados', `${nodos.length} de ${completo} posibles`],
        ['podas: optimalidad', String(cuenta(nodos, 'entera'))],
        ['podas: infactibilidad', String(cuenta(nodos, 'infactibilidad'))],
        ['podas: cota', String(cuenta(nodos, 'cota'))],
        ['incumbente', inc ? VIZ.fmt(inc.z) + (inc.inicial ? ' (dado)' : '') : 'ninguno'],
        ['óptimo real', String(optimo)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = nodoBajo(geo, x, y);
      if (!g || !estado) return tip.ocultar();
      tip.mostrar(x, y, textoNodo(estado.nodos[g.id], estado.incumbente));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = nodoBajo(geo, x, y);
      elegido = g && estado ? g.id : null;
      dibujar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cota, incumbente y brecha en el tiempo ---------- */

  function montarBrecha(cuerpo) {
    let semilla = 1, I = null, seleccion = 'profundidad', tolerancia = 2, historia = [], paso = 0, plano = null, hover = null;
    const b0 = buscarInstancia(semilla); semilla = b0.semilla; I = b0.I;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Siguiente nodo', opciones: [['mejor', 'mejor cota'], ['profundidad', 'profundidad']], valor: seleccion, alCambiar: (v) => { seleccion = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tolerancia de brecha', min: 0, max: 20, paso: 0.5, valor: tolerancia, formato: (v) => `${v} %`, alCambiar: (v) => { tolerancia = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { const b = buscarInstancia(semilla + 1); semilla = b.semilla; I = b.I; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'cota superior (mejor relajación abierta)', forma: 'linea' },
      { color: C.s6, texto: 'incumbente (mejor solución entera)', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.15), texto: 'brecha' },
      { color: C.tinta2, texto: 'primer paso con brecha ≤ tolerancia', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso procesa un nodo. La brecha es \\((\\text{cota} - \\text{incumbente}) / |\\text{incumbente}|\\). Mueva la tolerancia: si le basta una solución a ese porcentaje del óptimo, puede detenerse en la línea vertical y ahorrar los pasos restantes. Pase el cursor para leer cada paso.');

    function iniciar() {
      const g = ramificar(I, { seleccion, maxNodos: 150 });
      historia = [];
      for (const s of g) {
        const cota = cotaGlobal(s.nodos, s.incumbente);
        historia.push({ cota, inc: s.incumbente ? s.incumbente.z : null, gap: brecha(cota, s.incumbente), accion: s.accion, nodos: s.nodos.length });
      }
      paso = 0; hover = null;
      return (function* () { for (let k = 1; k < historia.length; k++) { paso = k; yield; } })();
    }
    const primeroTol = () => historia.findIndex((h) => h.gap != null && h.gap * 100 <= tolerancia + 1e-9);

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      if (!historia.length) return;
      const N = historia.length - 1;
      const valores = historia.flatMap((h) => [h.cota, h.inc]).filter((v) => v != null && Number.isFinite(v));
      const ymax = Math.ceil(Math.max(...valores) + 1), ymin = Math.max(0, Math.floor(Math.min(...valores) - 2));
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(N, 1), ymin, ymax }, { etiquetaX: 'paso (nodo procesado)', etiquetaY: 'valor del objetivo', ticksX: VIZ.ticks(0, Math.max(N, 1), 6).filter(Number.isInteger) });
      plano.ejes();
      const tol = primeroTol();
      if (tol >= 0 && tol < N) { ctx.fillStyle = VIZ.alfa(C.tinta, 0.05); ctx.fillRect(plano.sx(tol), plano.y1, plano.x1 - plano.sx(tol), plano.y0 - plano.y1); }
      // Serie en escalones: cota (azul) e incumbente (verde); lo futuro, tenue.
      const escalon = (clave, hasta) => { const pts = []; historia.slice(0, hasta + 1).forEach((h, k) => { if (h[clave] == null) return; if (pts.length) pts.push([k, pts[pts.length - 1][1]]); pts.push([k, h[clave]]); }); return pts; };
      const relleno = () => {
        const a = escalon('cota', paso), b = escalon('inc', paso);
        if (!b.length) return;
        ctx.beginPath();
        a.filter((p) => p[0] >= b[0][0]).forEach((p, i) => (i ? ctx.lineTo(plano.sx(p[0]), plano.sy(p[1])) : ctx.moveTo(plano.sx(p[0]), plano.sy(p[1]))));
        [...b].reverse().forEach((p) => ctx.lineTo(plano.sx(p[0]), plano.sy(p[1])));
        ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s1, 0.15); ctx.fill();
      };
      relleno();
      VIZ.trazar(ctx, plano, escalon('cota', N), C.tenue, 2);
      VIZ.trazar(ctx, plano, escalon('inc', N), C.tenue, 2);
      VIZ.trazar(ctx, plano, escalon('cota', paso), C.s1, 2);
      VIZ.trazar(ctx, plano, escalon('inc', paso), C.s6, 2);
      if (tol >= 0) {
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(plano.sx(tol), plano.y1); ctx.lineTo(plano.sx(tol), plano.y0); ctx.stroke(); ctx.restore();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = tol > N * 0.6 ? 'right' : 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`brecha ≤ ${tolerancia} %`, plano.sx(tol) + (tol > N * 0.6 ? -4 : 4), plano.y1 + 3);
      }
      const h = historia[paso];
      if (h.inc != null) VIZ.marcador(ctx, plano.sx(paso), plano.sy(h.inc), C.s6, 4.5);
      VIZ.marcador(ctx, plano.sx(paso), plano.sy(h.cota), C.s1, 4.5);
      if (hover != null) { ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plano.sx(hover), plano.y1); ctx.lineTo(plano.sx(hover), plano.y0); ctx.stroke(); ctx.restore(); }
      const final = historia[N];
      registro.textContent = paso === 0 ? `Raíz: la cota superior es ${VIZ.fmt(h.cota)} y aún no hay incumbente.`
        : paso < N ? `Paso ${paso}: cota ${VIZ.fmt(h.cota)}, incumbente ${h.inc != null ? VIZ.fmt(h.inc) : 'ninguno'}, brecha ${pct(h.gap)}.`
          : `Terminado en el paso ${N}: cota = incumbente = ${VIZ.fmt(final.inc)}, brecha 0 %.`;
      lectura.set([
        ['paso', `${paso} de ${N}`],
        ['cota superior', VIZ.fmt(h.cota)],
        ['incumbente', h.inc != null ? VIZ.fmt(h.inc) : 'ninguno'],
        ['brecha', pct(h.gap)],
        [`parada con ${tolerancia} %`, tol < 0 ? '—' : `paso ${tol} (ahorra ${N - tol} de ${N})`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y) || !historia.length) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(historia.length - 1, Math.round(plano.ix(x))));
      dibujar();
      const h = historia[hover];
      tip.mostrar(x, y, `paso <b>${hover}</b> (${h.nodos} nodos creados)` + VIZ.filaTooltip(C.s1, 'cota', VIZ.fmt(h.cota)) + VIZ.filaTooltip(C.s6, 'incumbente', h.inc != null ? VIZ.fmt(h.inc) : 'ninguno') + `<div class="fila">brecha <b>${pct(h.gap)}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('node-pruning-gap', {
    intro: String.raw`
      <p>Un árbol de ramificación nunca se recorre completo: casi todo su tamaño se evita <strong>podando</strong>. Un nodo se deja de explorar por tres motivos: porque su relajación
      es <em>infactible</em>, porque ya es <em>entera</em> (no hay nada que ramificar y queda como candidato a incumbente), o porque su <em>cota</em> no supera a la mejor solución entera conocida.
      La tercera es la más potente, y la que decide si un problema de cien variables se resuelve en segundos o nunca.</p>
      <p>Mientras el algoritmo corre, la cota superior baja y el incumbente sube hasta encontrarse. La distancia relativa entre ambos es la <strong>brecha de optimalidad</strong>:
      es lo que reportan los resolvedores y permite detenerse cuando la solución es «suficientemente buena» sin esperar a la prueba completa.</p>`,
    visualizaciones: [
      {
        titulo: 'Qué se poda y por qué',
        descripcion: 'Reproduzca el árbol de una mochila con dos recursos y haga clic en cualquier nodo para leer la razón de su poda. Desmarque «Podar por cota» para ver cuánto crece el árbol sin acotar, y suba el incumbente inicial: cuanto mejor sea desde el principio, menos nodos se crean.',
        montar: montarPodas,
      },
      {
        titulo: 'La brecha se cierra',
        descripcion: 'Siga cómo la cota superior (azul) baja y el incumbente (verde) sube. Cambie «mejor cota» por «profundidad» para comparar cuál halla antes una buena solución, y mueva la tolerancia para ver en qué paso podría detenerse con una garantía de \\(x\\,\\%\\).',
        montar: montarBrecha,
      },
    ],
    teoria: String.raw`
      <h2>Los tres tipos de poda</h2>
      <p>Sea \(\underline{z}\) el valor del incumbente (\(-\infty\) si no hay) y \(z_k\) la relajación del nodo \(k\) en un problema de maximización.</p>
      <table>
        <tr><th>Poda</th><th>Condición</th><th>Por qué es segura</th></tr>
        <tr><td>Por infactibilidad</td><td>la relajación LP del nodo no tiene solución</td><td>si ni siquiera la relajación es factible, no hay soluciones enteras en la región</td></tr>
        <tr><td>Por optimalidad</td><td>la solución \(x^*_k\) de la relajación es entera</td><td>es lo mejor de su región; se actualiza \(\underline{z} \leftarrow \max(\underline{z}, z_k)\)</td></tr>
        <tr><td>Por cota</td><td>\(z_k \le \underline{z}\)</td><td>toda solución entera de la región vale a lo sumo \(z_k\), que no mejora al incumbente</td></tr>
      </table>
      <p>En cada nodo no podado se ramifica sobre una variable fraccionaria (véase <a href="tema.html?id=milp-branch-and-bound">Branch and Bound para MILP</a>). Si el objetivo solo toma valores enteros, la poda por cota puede
      endurecerse: basta \(\lfloor z_k \rfloor \le \underline{z}\).</p>
      <h2>Cota y brecha de optimalidad</h2>
      <p>En cualquier instante, el valor óptimo \(z^*\) cumple \(\underline{z} \le z^* \le \overline{z}\), donde \(\overline{z}\) es la mayor relajación entre los nodos abiertos (o \(\underline{z}\) si no queda ninguno). La <strong>brecha</strong> es</p>
      \[ \text{gap} = \frac{\overline{z} - \underline{z}}{|\underline{z}|}. \]
      <p>Es una garantía: el incumbente está a lo más a ese porcentaje del óptimo. Termina en 0 cuando se agotan los nodos abiertos. Los resolvedores permiten fijar una tolerancia (por ejemplo, 1 %, o 0,01 %) y detenerse al alcanzarla.</p>
      <h2>Por qué la cota importa</h2>
      <p>Sin poda por cota, el algoritmo enumeraría hasta \(2^{n+1}-1\) nodos con \(n\) variables binarias. Con ella, el ahorro depende de dos cosas: lo ajustada que es la relajación
      (véase <a href="tema.html?id=valid-inequalities">formulaciones fuertes</a>) y qué tan pronto aparece un buen incumbente, que se favorece con búsqueda en profundidad o con heurísticas
      (véase <a href="tema.html?id=milp-solving-strategies">estrategias de resolución</a>).</p>
      <h2>Ejemplo</h2>
      <p>Si el incumbente vale 40 y un nodo tiene relajación 39,2 (o 40), se poda: aunque su región tuviera una solución entera, no pasaría de 39,2. Un nodo con 40,56 se ramifica porque aún podría contener un entero de 40,5 (si el objetivo no es entero) o de 40 en adelante.
      La figura de arriba lo muestra con una mochila de seis objetos y dos recursos; su relajación está explicada en <a href="tema.html?id=lp-relaxation">relajación lineal</a>.</p>
      <h2>Conexiones</h2>
      <ul>
        <li>La mochila de una sola restricción también se resuelve exactamente por programación dinámica: <a href="tema.html?id=knapsack-problem">el problema de la mochila</a>.</li>
        <li>Los <a href="tema.html?id=cutting-planes">planos cortantes</a> reducen la brecha en la raíz antes de ramificar.</li>
        <li>El mismo esquema de poda por cota aparece en <a href="tema.html?id=branch-and-bound">Branch and Bound</a> para búsquedas generales.</li>
      </ul>`,
  });
})();
