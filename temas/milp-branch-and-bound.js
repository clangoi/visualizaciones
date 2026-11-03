(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* Problemas 2-D de ejemplo: max c·x  s.a.  a1 x + a2 y ≤ b,  x, y ≥ 0 enteros. */
  const PROBLEMAS = {
    clasico: { nombre: 'Dos recursos (clásico)', c: [5, 8], filas: [[1, 1, 6], [5, 9, 45]], dom: [0, 7, 0, 7] },
    esquina: { nombre: 'Esquina fraccionaria', c: [4, 3], filas: [[2, 1, 10.5], [1, 2, 9], [3, 4, 17]], dom: [0, 6.5, 0, 6] },
    oblicuo: { nombre: 'Restricciones oblicuas', c: [3, 2], filas: [[2, 2, 9], [4, 1, 15]], dom: [0, 4.5, 0, 5] },
    alargado: { nombre: 'Región alargada', c: [7, 9], filas: [[-1, 3, 6], [7, 1, 35]], dom: [0, 6, 0, 6] },
  };
  const datosLP = (P) => ({ A: P.filas.map((f) => [f[0], f[1]]), b: P.filas.map((f) => f[2]), sen: P.filas.map(() => '<=') });
  const esEntera = (x) => x && x.every((v) => Math.abs(v - Math.round(v)) < 1e-6);
  const fx = (x, d = 3) => (x ? `(${x.map((v) => VIZ.fmt(Math.round(v * 1e6) / 1e6, d)).join(', ')})` : '—');

  /* Región factible de un nodo: restricciones originales más las cotas de variable del nodo. */
  function regionNodo(P, cotas) {
    const r = P.filas.map(([a1, a2, b]) => ({ a: [a1, a2], b }));
    r.push({ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 });
    (cotas || []).forEach(([lo, hi], j) => {
      const u = j === 0 ? [1, 0] : [0, 1];
      if (hi !== undefined && hi !== Infinity) r.push({ a: u, b: hi });
      if (lo > 0) r.push({ a: u.map((v) => -v), b: -lo });
    });
    return O.poligono(r, { xmin: -1, xmax: 60, ymin: -1, ymax: 60 });
  }

  /* Estado visual de un nodo del árbol. */
  function estadoDe(nd, inc) {
    if (nd.estado !== 'optimo') return 'infactible';
    if (nd.hijos.length) return 'ramificado';
    if (esEntera(nd.x)) return inc && nd.z < inc.z - 1e-9 ? 'cota' : 'entero';
    if (inc && nd.z <= inc.z + 1e-7) return 'cota';
    return 'abierto';
  }
  const ROTULO = { abierto: 'abierto', ramificado: 'ramificado', entero: 'solución entera', infactible: 'infactible', cota: 'podado por cota' };
  const LEYENDA_ARBOL = [
    { color: C.s4, texto: 'abierto (en cola)', forma: 'punto' },
    { color: C.superficie, borde: C.tinta, texto: 'ramificado', forma: 'punto' },
    { color: C.s6, texto: 'entero (incumbente)', forma: 'punto' },
    { color: C.s8, texto: 'infactible', forma: 'punto' },
    { color: C.inactivo, texto: 'podado por cota', forma: 'punto' },
  ];

  /* Posiciones del árbol: las hojas se reparten de izquierda a derecha, los padres quedan centrados. */
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
  const altoArbol = (prof) => 70 + prof * 64;

  /* Dibuja el árbol; devuelve la geometría de cada nodo para el cursor. */
  function dibujarArbol(lienzo, nodos, inc, sel, actual) {
    const { ctx, ancho: W } = lienzo;
    lienzo.limpiar();
    if (!nodos.length) return [];
    const L = disponer(nodos);
    const izq = 22, der = W - 22, sepY = 64, top = 24;
    const sep = L.hojas > 1 ? (der - izq) / (L.hojas - 1) : 0;
    const r = Math.max(5, Math.min(17, (L.hojas > 1 ? (der - izq) / L.hojas : 40) / 2 - 1));
    const X = (id) => (L.hojas > 1 ? izq + L.pos[id].u * sep : (izq + der) / 2);
    const Y = (id) => top + L.pos[id].nivel * sepY;
    const geo = [];
    ctx.lineWidth = 1.5;
    for (const nd of nodos) for (const h of nd.hijos) {
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(X(nd.id), Y(nd.id)); ctx.lineTo(X(h), Y(h)); ctx.stroke();
      if (sep >= 40 || L.hojas <= 6) {
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'middle';
        ctx.textAlign = X(h) < X(nd.id) ? 'right' : 'left';
        ctx.fillText(nodos[h].rama, (X(nd.id) + X(h)) / 2 + (X(h) < X(nd.id) ? -4 : 4), (Y(nd.id) + Y(h)) / 2);
      }
    }
    for (const nd of nodos) {
      const x = X(nd.id), y = Y(nd.id), est = estadoDe(nd, inc);
      const relleno = { abierto: C.s4, ramificado: C.superficie, entero: C.s6, infactible: C.s8, cota: C.inactivo }[est];
      if (nd.id === sel || nd.id === actual) {
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
      if (r >= 7) {
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(nd.estado === 'optimo' ? VIZ.fmt(nd.z, 4) : 'inf.', x, y + r + 4);
      }
      geo.push({ id: nd.id, x, y, r });
    }
    return geo;
  }
  const nodoBajo = (geo, x, y) => geo.find((g) => Math.hypot(g.x - x, g.y - y) <= g.r + 4);
  const textoNodo = (nd, inc) => `nodo <b>${nd.id}</b>${nd.rama ? ` (${nd.rama})` : ' (raíz)'}<br>` + (nd.estado === 'optimo'
    ? `x* = ${fx(nd.x)}<br>z = <b>${VIZ.fmt(nd.z)}</b><br>${ROTULO[estadoDe(nd, inc)]}`
    : 'relajación infactible');

  /* Plano 2-D de un nodo: región del nodo, zonas ya descartadas y óptimos. */
  function dibujarPlano(lienzo, P, nodos, nd, inc, sel) {
    const { ctx } = lienzo;
    lienzo.limpiar();
    const plano = VIZ.plano(lienzo, { xmin: P.dom[0], xmax: P.dom[1], ymin: P.dom[2], ymax: P.dom[3] }, { etiquetaX: 'x', etiquetaY: 'y' });
    plano.ejes();
    const trazo = (poli) => { ctx.beginPath(); poli.forEach((p, i) => (i ? ctx.lineTo(plano.sx(p[0]), plano.sy(p[1])) : ctx.moveTo(plano.sx(p[0]), plano.sy(p[1])))); ctx.closePath(); };
    const raiz = regionNodo(P, null);
    // Franjas descartadas por cada ramificación (no contienen puntos enteros).
    for (const q of nodos) if (q.hijos.length && q.ramaVar !== undefined) {
      const j = q.ramaVar, v = q.x[j], u = j === 0 ? [1, 0] : [0, 1];
      const reg = P.filas.map(([a1, a2, b]) => ({ a: [a1, a2], b }));
      reg.push({ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }, { a: u, b: Math.ceil(v) }, { a: u.map((t) => -t), b: -Math.floor(v) });
      q.cotas.forEach(([lo, hi], k) => { const w = k === 0 ? [1, 0] : [0, 1]; if (hi !== Infinity) reg.push({ a: w, b: hi }); if (lo > 0) reg.push({ a: w.map((t) => -t), b: -lo }); });
      const franja = O.poligono(reg, { xmin: -1, xmax: 60, ymin: -1, ymax: 60 });
      if (franja.length > 2) { trazo(franja); ctx.fillStyle = VIZ.alfa(C.tinta, 0.1); ctx.fill(); }
    }
    trazo(raiz); ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    const reg = nd ? regionNodo(P, nd.cotas) : raiz;
    if (reg.length > 2) { trazo(reg); ctx.fillStyle = VIZ.alfa(C.s1, 0.18); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke(); }
    // Puntos enteros del problema original.
    const dentro = (p) => P.filas.every(([a1, a2, b]) => a1 * p[0] + a2 * p[1] <= b + 1e-9);
    for (let i = 0; i <= P.dom[1]; i++) for (let j = 0; j <= P.dom[3]; j++) {
      const ok = dentro([i, j]);
      ctx.fillStyle = ok ? C.tinta2 : C.tenue; ctx.beginPath(); ctx.arc(plano.sx(i), plano.sy(j), ok ? 3.5 : 1.8, 0, 7); ctx.fill();
    }
    if (nd && nd.estado === 'optimo') {
      const k = [...P.c];
      ctx.save(); ctx.beginPath(); ctx.rect(plano.x0, plano.y1, plano.x1 - plano.x0, plano.y0 - plano.y1); ctx.clip();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = C.s2; ctx.lineWidth = 1.5; ctx.beginPath();
      const z = nd.z, a = Math.abs(k[1]) > Math.abs(k[0]);
      const p0 = a ? [P.dom[0], (z - k[0] * P.dom[0]) / k[1]] : [(z - k[1] * P.dom[2]) / k[0], P.dom[2]];
      const p1 = a ? [P.dom[1], (z - k[0] * P.dom[1]) / k[1]] : [(z - k[1] * P.dom[3]) / k[0], P.dom[3]];
      ctx.moveTo(plano.sx(p0[0]), plano.sy(p0[1])); ctx.lineTo(plano.sx(p1[0]), plano.sy(p1[1])); ctx.stroke(); ctx.restore();
    }
    if (inc) VIZ.marcador(ctx, plano.sx(inc.x[0]), plano.sy(inc.x[1]), C.s6, 6.5, 0);
    if (nd && nd.estado === 'optimo') VIZ.marcador(ctx, plano.sx(nd.x[0]), plano.sy(nd.x[1]), C.s2, 6, 3);
    void sel;
    return plano;
  }
  const LEYENDA_PLANO = [
    { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'región del nodo' },
    { color: VIZ.alfa(C.tinta, 0.18), texto: 'franja descartada' },
    { color: C.s2, texto: 'óptimo LP del nodo', forma: 'punto' },
    { color: C.s6, texto: 'incumbente', forma: 'punto' },
    { color: C.s2, texto: 'curva de nivel del óptimo LP', forma: 'linea' },
  ];

  /* Cota superior global: mejor relajación entre los nodos aún abiertos (o el incumbente si no queda ninguno). */
  function cotaGlobal(nodos, inc) {
    let m = -Infinity;
    for (const nd of nodos) if (nd.estado === 'optimo' && !nd.hijos.length && !nd.poda) m = Math.max(m, nd.z);
    if (inc) m = Math.max(m, inc.z);
    return m;
  }
  const brecha = (cota, inc) => (inc && Number.isFinite(cota) ? (cota - inc.z) / Math.abs(inc.z || 1) : null);
  const pct = (g) => (g == null ? '—' : `${VIZ.fmt(100 * g, 3)} %`);

  /* ---------- Fig. 1: ramifique usted ---------- */

  function montarManual(cuerpo) {
    let clave = 'clasico', regla = 'fraccion', nodos = [], inc = null, sel = 0, geoArbol = [], altoActual = altoArbol(0), planoGeo = null;
    const P = () => PROBLEMAS[clave];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; reiniciar(); } });
    ctl.selector({ etiqueta: 'Variable de ramificación', opciones: [['fraccion', 'la más fraccionaria'], ['x', 'x primero'], ['y', 'y primero']], valor: regla, alCambiar: (v) => { regla = v; } });
    ctl.boton('Ramificar nodo elegido', () => ramificar(sel), { primario: true });
    ctl.boton('Ramificar el mejor abierto', () => {
      const ab = abiertos();
      if (!ab.length) { registro.textContent = 'No quedan nodos abiertos: el árbol está resuelto.'; return; }
      sel = ab.reduce((a, q) => (q.z > a.z ? q : a)).id;
      ramificar(sel);
    });
    ctl.boton('Reiniciar', () => reiniciar());

    VIZ.subtitulo(cuerpo, 'Región factible del nodo elegido');
    const lPlano = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 260, altoMax: 420 });
    const tipP = VIZ.tooltip(lPlano);
    VIZ.subtitulo(cuerpo, 'Árbol de ramificación');
    const lArbol = VIZ.lienzo(cuerpo, { altoFn: () => altoActual });
    const tipA = VIZ.tooltip(lArbol);
    VIZ.leyenda(cuerpo, [...LEYENDA_ARBOL, ...LEYENDA_PLANO]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo del árbol para ver su región y su solución. «Ramificar nodo elegido» parte el nodo en dos subproblemas \\(x_j \\le \\lfloor v \\rfloor\\) y \\(x_j \\ge \\lceil v \\rceil\\), y resuelve ambas relajaciones.');

    function crear(padre, cotas, rama) {
      const { A, b, sen } = datosLP(P());
      const r = O.lp(P().c, A, sen, b, { cotas });
      const nd = { id: nodos.length, padre, cotas, rama, estado: r.estado, x: r.x, z: r.z, hijos: [], poda: null };
      nodos.push(nd);
      if (nd.estado === 'optimo' && esEntera(nd.x) && (!inc || nd.z > inc.z + 1e-9)) inc = { x: nd.x.map((v) => Math.round(v)), z: nd.z, nodo: nd.id };
      return nd;
    }
    function abiertos() { return nodos.filter((q) => estadoDe(q, inc) === 'abierto'); }
    function reiniciar() {
      nodos = []; inc = null; sel = 0;
      crear(-1, [[0, Infinity], [0, Infinity]], '');
      const r = nodos[0];
      registro.textContent = `Raíz: la relajación lineal da x = ${fx(r.x)} con z = ${VIZ.fmt(r.z)}. Es una cota superior para todo el problema.`;
      dibujar();
    }
    function ramificar(id) {
      const nd = nodos[id];
      const est = estadoDe(nd, inc);
      if (est !== 'abierto') {
        registro.textContent = est === 'ramificado' ? `El nodo ${id} ya fue ramificado.` : est === 'entero' ? `El nodo ${id} ya es una solución entera: no hay nada que ramificar.` : est === 'infactible' ? `El nodo ${id} es infactible: su región está vacía.` : `El nodo ${id} se poda por cota: su relajación (${VIZ.fmt(nd.z)}) no supera al incumbente (${VIZ.fmt(inc.z)}).`;
        return dibujar();
      }
      const frac = nd.x.map((v) => Math.abs(v - Math.round(v)));
      let j = frac.indexOf(Math.max(...frac));
      if (regla === 'x' && frac[0] > 1e-6) j = 0;
      else if (regla === 'y' && frac[1] > 1e-6) j = 1;
      const v = nd.x[j], nom = j === 0 ? 'x' : 'y';
      const abajo = nd.cotas.map((q) => q.slice()), arriba = nd.cotas.map((q) => q.slice());
      abajo[j][1] = Math.floor(v); arriba[j][0] = Math.ceil(v);
      const h1 = crear(nd.id, abajo, `${nom} ≤ ${Math.floor(v)}`), h2 = crear(nd.id, arriba, `${nom} ≥ ${Math.ceil(v)}`);
      nd.hijos = [h1.id, h2.id]; nd.ramaVar = j;
      const abre = [h1, h2].filter((q) => estadoDe(q, inc) === 'abierto');
      sel = abre.length ? abre.reduce((a, q) => (q.z > a.z ? q : a)).id : h1.id;
      registro.textContent = `Nodo ${nd.id}: ${nom} = ${VIZ.fmt(v)} es fraccionaria, así que se crean ${h1.rama} (nodo ${h1.id}, ${h1.estado === 'optimo' ? 'z = ' + VIZ.fmt(h1.z) : 'infactible'}) y ${h2.rama} (nodo ${h2.id}, ${h2.estado === 'optimo' ? 'z = ' + VIZ.fmt(h2.z) : 'infactible'}).`;
      dibujar();
    }
    function dibujar() {
      if (!nodos.length) return;
      const necesario = altoArbol(disponer(nodos).prof);
      if (necesario !== altoActual) { altoActual = necesario; lArbol.ajustar(true); }
      geoArbol = dibujarArbol(lArbol, nodos, inc, sel, null);
      planoGeo = dibujarPlano(lPlano, P(), nodos, nodos[sel], inc, sel);
      const cota = cotaGlobal(nodos, inc), ab = abiertos();
      lectura.set([
        ['nodos creados', String(nodos.length)],
        ['nodos abiertos', String(ab.length)],
        ['cota superior global', Number.isFinite(cota) ? VIZ.fmt(cota) : '—'],
        ['incumbente', inc ? `${VIZ.fmt(inc.z)} en ${fx(inc.x, 3)}` : 'ninguno'],
        ['brecha', pct(brecha(cota, inc))],
      ]);
    }
    lArbol.alDibujar = dibujar;
    lPlano.alDibujar = dibujar;
    lArbol.canvas.style.cursor = 'pointer';
    lArbol.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lArbol.posicion(ev), g = nodoBajo(geoArbol, x, y);
      if (!g) return tipA.ocultar();
      tipA.mostrar(x, y, textoNodo(nodos[g.id], inc));
    });
    lArbol.canvas.addEventListener('pointerleave', () => tipA.ocultar());
    lArbol.canvas.addEventListener('click', (ev) => {
      const { x, y } = lArbol.posicion(ev), g = nodoBajo(geoArbol, x, y);
      if (!g) return;
      sel = g.id;
      const nd = nodos[sel];
      registro.textContent = nd.estado === 'optimo' ? `Nodo ${nd.id}${nd.rama ? ' (' + nd.rama + ')' : ''}: x = ${fx(nd.x)}, z = ${VIZ.fmt(nd.z)}; ${ROTULO[estadoDe(nd, inc)]}.` : `Nodo ${nd.id} (${nd.rama}): sin puntos factibles.`;
      dibujar();
    });
    lPlano.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lPlano.posicion(ev);
      if (!planoGeo || !planoGeo.dentro(x, y)) return tipP.ocultar();
      const p = [Math.round(planoGeo.ix(x)), Math.round(planoGeo.iy(y))];
      const ok = p[0] >= 0 && p[1] >= 0 && P().filas.every(([a1, a2, b]) => a1 * p[0] + a2 * p[1] <= b + 1e-9);
      tipP.mostrar(x, y, `punto entero <b>(${p[0]}, ${p[1]})</b><br>${ok ? 'factible, z = <b>' + VIZ.fmt(P().c[0] * p[0] + P().c[1] * p[1]) + '</b>' : 'infactible'}`);
    });
    lPlano.canvas.addEventListener('pointerleave', () => tipP.ocultar());
    reiniciar();
  }

  /* ---------- Fig. 2: B&B automático sobre el plano ---------- */

  function montarAutomatico(cuerpo) {
    let clave = 'clasico', seleccion = 'mejor', ramificacion = 'fraccion', estado = null, altoActual = altoArbol(0), geoArbol = [], planoGeo = null;
    const P = () => PROBLEMAS[clave];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Siguiente nodo', opciones: [['mejor', 'mejor cota'], ['profundidad', 'profundidad']], valor: seleccion, alCambiar: (v) => { seleccion = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Variable', opciones: [['fraccion', 'más fraccionaria'], ['primera', 'primera fraccionaria']], valor: ramificacion, alCambiar: (v) => { ramificacion = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    VIZ.subtitulo(cuerpo, 'Región del nodo en proceso');
    const lPlano = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 260, altoMax: 420 });
    const tipP = VIZ.tooltip(lPlano);
    VIZ.subtitulo(cuerpo, 'Árbol de ramificación');
    const lArbol = VIZ.lienzo(cuerpo, { altoFn: () => altoActual });
    const tipA = VIZ.tooltip(lArbol);
    VIZ.leyenda(cuerpo, [...LEYENDA_ARBOL, { color: C.s1, texto: 'nodo en proceso (anillo)', forma: 'punto' }, ...LEYENDA_PLANO]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para avanzar de a un nodo. Con «mejor cota» el algoritmo siempre toma el nodo abierto de mayor relajación; con «profundidad» baja por una rama hasta encontrar un incumbente.');

    const nodosVacio = [];
    function iniciar() {
      const { A, b, sen } = datosLP(P());
      const g = O.ramificar(P().c, A, sen, b, { seleccion, ramificacion, maxNodos: 60 });
      estado = null;
      return (function* () { for (const s of g) { estado = s; yield; } })();
    }
    function mensaje() {
      if (!estado) return 'Pulse «Un paso»: primero se resuelve la relajación lineal de la raíz.';
      const nd = estado.actual;
      switch (estado.accion) {
        case 'raiz': return `Raíz: la relajación da x = ${fx(nd.x)} con z = ${VIZ.fmt(nd.z)}, la primera cota superior.`;
        case 'ramifica': return `Nodo ${nd.id}: x = ${fx(nd.x)} no es entero. Se ramifica en ${nd.ramaVar === 0 ? 'x' : 'y'} = ${VIZ.fmt(nd.x[nd.ramaVar])} y nacen los nodos ${nd.hijos[0]} y ${nd.hijos[1]}.`;
        case 'incumbente': return `Nodo ${nd.id} es entero: x = ${fx(nd.x)}, z = ${VIZ.fmt(nd.z)}. Queda como incumbente y ninguna rama debajo de él hace falta.`;
        case 'poda-infactible': return `Nodo ${nd.id} (${nd.rama}): la relajación es infactible, se poda.`;
        case 'poda-cota': return `Nodo ${nd.id} (${nd.rama}): su cota ${VIZ.fmt(nd.z)} no supera al incumbente ${VIZ.fmt(estado.incumbente.z)}; ninguna solución de su rama puede mejorarlo.`;
        default: return `Fin: el incumbente ${estado.incumbente ? fx(estado.incumbente.x, 3) + ' con z = ' + VIZ.fmt(estado.incumbente.z) : 'no existe'} es óptimo porque no quedan nodos abiertos.`;
      }
    }
    function dibujar() {
      const nodos = estado ? estado.nodos : nodosVacio;
      const inc = estado ? estado.incumbente : null;
      if (nodos.length) {
        const necesario = altoArbol(disponer(nodos).prof);
        if (necesario !== altoActual) { altoActual = necesario; lArbol.ajustar(true); }
      }
      const act = estado && estado.actual ? estado.actual : null;
      geoArbol = nodos.length ? dibujarArbol(lArbol, nodos, inc, null, act ? act.id : null) : (lArbol.limpiar(), []);
      planoGeo = dibujarPlano(lPlano, P(), nodos, act, inc, null);
      registro.textContent = mensaje();
      const cota = nodos.length ? cotaGlobal(nodos, inc) : NaN;
      const cuenta = (t) => nodos.filter((q) => q.poda === t).length;
      lectura.set([
        ['nodos creados', String(nodos.length)],
        ['cota superior', Number.isFinite(cota) ? VIZ.fmt(cota) : '—'],
        ['incumbente', inc ? VIZ.fmt(inc.z) : 'ninguno'],
        ['brecha', pct(brecha(cota, inc))],
        ['podas (inf. / cota / entero)', `${cuenta('infactibilidad')} / ${cuenta('cota')} / ${cuenta('entera')}`],
      ]);
    }
    lArbol.alDibujar = dibujar;
    lPlano.alDibujar = dibujar;
    lArbol.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lArbol.posicion(ev), g = nodoBajo(geoArbol, x, y);
      if (!g || !estado) return tipA.ocultar();
      tipA.mostrar(x, y, textoNodo(estado.nodos[g.id], estado.incumbente));
    });
    lArbol.canvas.addEventListener('pointerleave', () => tipA.ocultar());
    lPlano.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lPlano.posicion(ev);
      if (!planoGeo || !planoGeo.dentro(x, y)) return tipP.ocultar();
      const p = [Math.round(planoGeo.ix(x)), Math.round(planoGeo.iy(y))];
      const ok = p[0] >= 0 && p[1] >= 0 && P().filas.every(([a1, a2, b]) => a1 * p[0] + a2 * p[1] <= b + 1e-9);
      tipP.mostrar(x, y, `punto entero <b>(${p[0]}, ${p[1]})</b><br>${ok ? 'factible, z = <b>' + VIZ.fmt(P().c[0] * p[0] + P().c[1] * p[1]) + '</b>' : 'infactible'}`);
    });
    lPlano.canvas.addEventListener('pointerleave', () => tipP.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: un problema de seis variables ---------- */

  // Mochila con dos recursos (peso y volumen): max v·x, W x ≤ cap, 0 ≤ x ≤ 1 entero.
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
  // Primera semilla (desde la dada) cuyo árbol de mejor cota tiene un tamaño razonable de dibujar.
  function buscarInstancia(desde) {
    for (let s = desde; s < desde + 60; s++) {
      const I = instancia(s), { A, b, sen } = sistema(I);
      let fin; for (fin of O.ramificar(I.v, A, sen, b, { maxNodos: 80 }));
      if (fin.nodos.length >= 9 && fin.nodos.length <= 31) return { I, semilla: s };
    }
    return { I: instancia(desde), semilla: desde };
  }

  function montarSeisVariables(cuerpo) {
    let semilla = 1, I = null, seleccion = 'mejor', estado = null, altoActual = altoArbol(0), geoArbol = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Siguiente nodo', opciones: [['mejor', 'mejor cota'], ['profundidad', 'profundidad']], valor: seleccion, alCambiar: (v) => { seleccion = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { const b = buscarInstancia(semilla + 1); semilla = b.semilla; I = b.I; rep.reiniciar(); });
    const bi = buscarInstancia(semilla); semilla = bi.semilla; I = bi.I;

    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lArbol = VIZ.lienzo(cuerpo, { altoFn: () => altoActual });
    const tipA = VIZ.tooltip(lArbol);
    VIZ.leyenda(cuerpo, [...LEYENDA_ARBOL, { color: C.s1, texto: 'nodo en proceso (anillo)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const cajaNodos = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(cajaNodos);
    VIZ.nota(cuerpo, 'Con seis variables ya no se puede dibujar la región, pero el árbol funciona igual: cada nodo es un LP con cotas \\(0\\le x_j\\le 1\\) modificadas. La tabla resume cada relajación; pase el cursor por un nodo del árbol para leer su rama.');

    function tablaDatos() {
      const filas = [['objeto', ...I.v.map((_, i) => String(i + 1))], ['valor', ...I.v.map(String)], ['peso (≤ ' + I.cap[0] + ')', ...I.W[0].map(String)], ['volumen (≤ ' + I.cap[1] + ')', ...I.W[1].map(String)]];
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        ...filas.map((f, r) => VIZ.el('tr', null, ...f.map((t, k) => VIZ.el(r === 0 || k === 0 ? 'th' : 'td', k === 0 ? { class: 'izq' } : null, t))))));
    }
    function iniciar() {
      tablaDatos();
      const { A, b, sen } = sistema(I);
      const g = O.ramificar(I.v, A, sen, b, { seleccion, maxNodos: 80 });
      estado = null;
      return (function* () { for (const s of g) { estado = s; yield; } })();
    }
    const enteros = (x) => x.map((v) => VIZ.fmt(Math.round(v * 1000) / 1000, 3)).join(' ');
    function dibujar() {
      const nodos = estado ? estado.nodos : [];
      const inc = estado ? estado.incumbente : null;
      if (nodos.length) {
        const necesario = altoArbol(disponer(nodos).prof);
        if (necesario !== altoActual) { altoActual = necesario; lArbol.ajustar(true); }
      }
      const act = estado && estado.actual ? estado.actual : null;
      geoArbol = nodos.length ? dibujarArbol(lArbol, nodos, inc, null, act ? act.id : null) : (lArbol.limpiar(), []);
      const cota = nodos.length ? cotaGlobal(nodos, inc) : NaN;
      if (!estado) registro.textContent = 'Pulse «Un paso»: se resuelve la relajación de la raíz (todas las variables en [0, 1]).';
      else if (!act) registro.textContent = `Fin: óptimo ${inc ? VIZ.fmt(inc.z) : '—'} con x = ${inc ? '(' + inc.x.join(', ') + ')' : '—'}, tras ${nodos.length} nodos.`;
      else registro.textContent = ({
        raiz: `Raíz: relajación z = ${VIZ.fmt(act.z)}, con un objeto fraccionario.`,
        ramifica: `Nodo ${act.id}: x${act.ramaVar + 1} = ${VIZ.fmt(act.x[act.ramaVar])} es fraccionaria; se prueban x${act.ramaVar + 1} = 0 y x${act.ramaVar + 1} = 1.`,
        incumbente: `Nodo ${act.id}: relajación entera, z = ${VIZ.fmt(act.z)}. Es el nuevo incumbente.`,
        'poda-infactible': `Nodo ${act.id} (${act.rama}): infactible, se poda.`,
        'poda-cota': `Nodo ${act.id} (${act.rama}): cota ${VIZ.fmt(act.z)} ≤ incumbente ${VIZ.fmt(inc ? inc.z : NaN)}, se poda.`,
      })[estado.accion];
      lectura.set([
        ['nodos creados', String(nodos.length)],
        ['cota superior', Number.isFinite(cota) ? VIZ.fmt(cota) : '—'],
        ['incumbente', inc ? VIZ.fmt(inc.z) : 'ninguno'],
        ['brecha', pct(brecha(cota, inc))],
      ]);
      const cabecera = ['nodo', 'rama', 'x relajada', 'z', 'estado'];
      cajaNodos.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ...cabecera.map((t) => VIZ.el('th', null, t))),
        ...nodos.map((q) => {
          const e = estadoDe(q, inc);
          return VIZ.el('tr', { class: act && act.id === q.id ? 'activa' : null },
            VIZ.el('td', { class: 'izq' }, String(q.id)), VIZ.el('td', { class: 'izq' }, q.rama || 'raíz'),
            VIZ.el('td', null, q.estado === 'optimo' ? enteros(q.x) : '—'), VIZ.el('td', null, q.estado === 'optimo' ? VIZ.fmt(q.z) : '—'),
            VIZ.el('td', { class: 'izq' }, ROTULO[e]));
        })));
    }
    lArbol.alDibujar = dibujar;
    lArbol.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lArbol.posicion(ev), g = nodoBajo(geoArbol, x, y);
      if (!g || !estado) return tipA.ocultar();
      const q = estado.nodos[g.id];
      tipA.mostrar(x, y, `nodo <b>${q.id}</b>${q.rama ? ` (${q.rama})` : ' (raíz)'}<br>` + (q.estado === 'optimo' ? `x* = (${enteros(q.x)})<br>z = <b>${VIZ.fmt(q.z)}</b><br>${ROTULO[estadoDe(q, estado.incumbente)]}` : 'relajación infactible'));
    });
    lArbol.canvas.addEventListener('pointerleave', () => tipA.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('milp-branch-and-bound', {
    intro: String.raw`
      <p>La relajación lineal da una cota, pero casi nunca una solución entera. <strong>Ramificación y acotamiento</strong> (<em>branch and bound</em>) cierra esa distancia
      dividiendo el problema: si en el óptimo relajado una variable entera vale \(2{,}25\), toda solución entera cumple \(x \le 2\) o bien \(x \ge 3\). Cada
      opción es un subproblema con su propia relajación, y el proceso se repite formando un árbol.</p>
      <p>Mientras se desciende se guardan dos números: la mejor solución entera hallada (el <em>incumbente</em>, una cota inferior en maximización) y la mayor
      relajación entre los nodos abiertos (la cota superior). Cuando se cruzan, el incumbente es óptimo. Esta página usa la versión para programación lineal entera mixta;
      el tema <a href="tema.html?id=branch-and-bound">Branch and Bound</a> presenta la idea general sobre otros problemas.</p>`,
    visualizaciones: [
      {
        titulo: 'Ramifique usted el árbol',
        descripcion: 'Haga clic en un nodo para ver su región y pulse «Ramificar nodo elegido»: las franjas grises muestran el trozo fraccionario que se descarta sin perder ningún punto entero. Pruebe «Ramificar el mejor abierto» hasta que no queden nodos amarillos.',
        montar: montarManual,
      },
      {
        titulo: 'Ramificación y acotamiento paso a paso',
        descripcion: 'Cambie la regla de selección de nodo y reproduzca el algoritmo en el mismo problema. Con «profundidad» se encuentra un incumbente pronto; con «mejor cota» se crean menos nodos en general. Observe qué nodos se podan por cota.',
        montar: montarAutomatico,
      },
      {
        titulo: 'Seis variables: relajaciones nodo a nodo',
        descripcion: 'Una mochila con dos recursos (peso y volumen) y seis objetos. Avance paso a paso y lea en la tabla la solución relajada de cada nodo: siempre hay a lo sumo unas pocas variables fraccionarias. Pulse «Nuevos datos» para otra instancia.',
        montar: montarSeisVariables,
      },
    ],
    teoria: String.raw`
      <h2>El algoritmo</h2>
      <p>Para \(\max\, c^\top x\) con \(Ax \le b\), \(x \ge 0\), \(x_j \in \mathbb{Z}\) para \(j \in J\), cada nodo \(k\) del árbol es el problema original más cotas \(\ell \le x \le u\)
      sobre las variables enteras. Se mantienen un incumbente \(\underline{z}\) (valor de la mejor solución entera conocida, \(-\infty\) al inicio) y la lista de nodos abiertos.</p>
      <pre><code>incumbente ← ninguno;  \(\underline{z}\) ← −∞
abiertos ← { raíz }
mientras abiertos ≠ ∅:
    k ← elegir(abiertos);  resolver la relajación LP del nodo k
    si es infactible:            podar k            (por infactibilidad)
    si no, sea z_k su valor y x* su solución:
        si z_k ≤ \(\underline{z}\):         podar k            (por cota)
        si no, si x*_j es entero para todo j en J:
                                 \(\underline{z}\) ← z_k;  incumbente ← x*   (por optimalidad)
        si no: elegir j con x*_j fraccionario
                 hijo izquierdo:  cota  x_j ≤ ⌊x*_j⌋
                 hijo derecho:    cota  x_j ≥ ⌈x*_j⌉
                 agregar ambos a abiertos
devolver incumbente</code></pre>
      <h2>Por qué es correcto</h2>
      <p>Los dos hijos de un nodo cubren todas las soluciones enteras de su región, porque ningún entero cae en \(\lfloor v\rfloor &lt; x_j &lt; \lceil v\rceil\).
      Por eso ramificar no pierde óptimos. Y la relajación de un nodo es una cota superior de todo lo que hay debajo: si ya no supera al incumbente, nada debajo puede mejorarlo. El
      algoritmo termina porque, con variables enteras acotadas, el número de combinaciones de cotas es finito.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con \(\max\, 5x + 8y\), \(x + y \le 6\), \(5x + 9y \le 45\) (el mismo del tema <a href="tema.html?id=lp-relaxation">relajación lineal</a>), la raíz da \((2{,}25;\,3{,}75)\) con \(z = 41{,}25\).
      Se ramifica en \(x\): el hijo \(x \le 2\) tiene óptimo \((2;\,3{,}89)\) con \(z = 41{,}11\) y el hijo \(x \ge 3\) tiene \((3;\,3)\), entero, con \(z = 39\). Dentro de \(x \le 2\) se ramifica en \(y\):
      \(y \le 3\) da \((2,3)\) con 34 y \(y \ge 4\) da \((1{,}8;\,4)\) con 41. Ramificando este último, \(x \ge 2\) es infactible y \(x \le 1\) da \((1;\,4{,}44)\) con \(40{,}56\), que se parte en
      \(y \le 4\) (el punto \((1,4)\) vale 37) e \(y \ge 5\) (el punto \((0,5)\) vale 40, entero). El incumbente final es \(z^* = 40\); los nodos con cota 39, 37 y 34 se podan porque no lo superan.</p>
      <h2>Cotas y brecha</h2>
      <p>En cualquier momento, \(\underline{z} \le z^* \le \overline{z}\), donde \(\overline{z}\) es el mayor valor de relajación entre los nodos abiertos. Su diferencia relativa es la
      <a href="tema.html?id=node-pruning-gap">brecha de optimalidad</a>; el algoritmo puede detenerse en cuanto sea menor que una tolerancia.</p>
      <h2>Decisiones de diseño</h2>
      <ul>
        <li><strong>Qué nodo elegir:</strong> mejor cota (cierra la cota superior) o profundidad (halla incumbentes pronto y usa poca memoria).</li>
        <li><strong>Qué variable ramificar:</strong> la más fraccionaria, la de mayor impacto estimado, etc.</li>
      </ul>
      <p>Ambas se comparan en <a href="tema.html?id=milp-solving-strategies">estrategias de resolución de MILP</a>. Si los nodos se refuerzan con
      <a href="tema.html?id=cutting-planes">planos cortantes</a>, el método se llama <em>branch and cut</em>.</p>
      <h2>Costo</h2>
      <p>En el peor caso el árbol tiene \(2^{|J|}\) hojas, así que el problema es NP-difícil; en la práctica la poda por cota lo reduce enormemente cuando la relajación es ajustada
      (véase <a href="tema.html?id=valid-inequalities">formulaciones fuertes</a>). Para el caso 0/1 puro con una sola restricción, el
      <a href="tema.html?id=knapsack-problem">problema de la mochila</a> tiene además una solución por programación dinámica.</p>`,
  });
})();
