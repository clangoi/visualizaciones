(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* Mochila 0/1 con dos recursos (peso y volumen): max v·x, W x ≤ cap, x ∈ {0,1}ⁿ. */
  function instancia(semilla, n = 7) {
    const r = VIZ.semilla(semilla * 7 + 3);
    const W = [[], []], v = [];
    for (let i = 0; i < n; i++) { const a = 3 + Math.floor(r() * 13), b = 3 + Math.floor(r() * 13); W[0].push(a); W[1].push(b); v.push(Math.round((a + b) / 2) + 2 + Math.floor(r() * 9)); }
    return { W, v, cap: W.map((f) => Math.floor(f.reduce((s, q) => s + q, 0) * 0.4)), n };
  }
  function sistema(I, extra = []) {
    return { A: [...I.W, ...I.v.map((_, i) => I.v.map((__, j) => (i === j ? 1 : 0))), ...extra.map((e) => e.a)], b: [...I.cap, ...I.v.map(() => 1), ...extra.map((e) => e.b)], sen: [...I.W.map(() => '<='), ...I.v.map(() => '<='), ...extra.map(() => '<=')] };
  }
  function cortesCobertura(I, rondas = 4) {
    const extra = [];
    for (let r = 0; r < rondas; r++) {
      const S = sistema(I, extra), sol = O.lp(I.v, S.A, S.sen, S.b);
      let nuevo = false;
      I.W.forEach((w, k) => {
        const orden = I.v.map((_, i) => i).sort((a, b) => (1 - sol.x[a]) - (1 - sol.x[b]) || w[b] - w[a]);
        let C = [], peso = 0;
        for (const i of orden) { C.push(i); peso += w[i]; if (peso > I.cap[k]) break; }
        if (peso <= I.cap[k]) return;
        for (const i of C.slice().reverse()) { if (peso - w[i] > I.cap[k]) { peso -= w[i]; C = C.filter((q) => q !== i); } }
        const lado = C.reduce((s, i) => s + sol.x[i], 0);
        if (lado > C.length - 1 + 1e-6 && !extra.some((e) => e.C.join() === C.slice().sort().join())) {
          const a = Array(I.n).fill(0); C.forEach((i) => { a[i] = 1; });
          extra.push({ a, b: C.length - 1, C: C.slice().sort((x, y) => x - y) }); nuevo = true;
        }
      });
      if (!nuevo) break;
    }
    return extra;
  }
  function heuristica(I) {
    const ord = I.v.map((_, i) => i).sort((a, b) => I.v[b] / (I.W[0][b] / I.cap[0] + I.W[1][b] / I.cap[1]) - I.v[a] / (I.W[0][a] / I.cap[0] + I.W[1][a] / I.cap[1]));
    const uso = [0, 0], x = Array(I.n).fill(0); let z = 0;
    for (const i of ord) if (uso[0] + I.W[0][i] <= I.cap[0] && uso[1] + I.W[1][i] <= I.cap[1]) { uso[0] += I.W[0][i]; uso[1] += I.W[1][i]; x[i] = 1; z += I.v[i]; }
    return { x, z };
  }
  function* ramificar(I, { seleccion = 'mejor', variable = 'fraccion', cortes = false, heur = false, maxNodos = 200 } = {}) {
    const extra = cortes ? cortesCobertura(I) : [];
    const { A, b, sen } = sistema(I, extra);
    const nodos = [];
    let inc = null;
    if (heur) { const h = heuristica(I); inc = { x: h.x, z: h.z, nodo: -1, inicial: true }; }
    const crear = (padre, cotas, rama) => {
      const r = O.lp(I.v, A, sen, b, { cotas });
      const nd = { id: nodos.length, padre, cotas, rama, estado: r.estado, x: r.x, z: r.z, hijos: [], poda: null };
      nodos.push(nd); return nd;
    };
    const raiz = crear(-1, I.v.map(() => [0, Infinity]), '');
    let abiertos = [raiz], primero = heur ? 0 : -1;
    yield { nodos, actual: raiz, incumbente: inc, accion: 'raiz', cortes: extra, primero };
    while (abiertos.length) {
      if (nodos.length >= maxNodos) { yield { nodos, actual: null, incumbente: inc, accion: 'fin', truncado: true, cortes: extra, primero }; return; }
      const nd = seleccion === 'mejor' ? abiertos.reduce((a, q) => ((q.z ?? -Infinity) > (a.z ?? -Infinity) ? q : a))
        : seleccion === 'anchura' ? abiertos[0] : abiertos[abiertos.length - 1];
      abiertos = abiertos.filter((q) => q !== nd);
      if (nd.estado !== 'optimo') { nd.poda = 'infactibilidad'; yield { nodos, actual: nd, incumbente: inc, accion: 'poda-infactible', cortes: extra, primero }; continue; }
      if (inc && nd.z <= inc.z + 1e-7) { nd.poda = 'cota'; yield { nodos, actual: nd, incumbente: inc, accion: 'poda-cota', cortes: extra, primero }; continue; }
      const frac = nd.x.map((q) => Math.abs(q - Math.round(q)));
      let j = -1;
      if (variable === 'primera') j = frac.findIndex((f) => f > 1e-6);
      else if (variable === 'valor') { let mv = -1; frac.forEach((f, k) => { if (f > 1e-6 && I.v[k] > mv) { mv = I.v[k]; j = k; } }); }
      else { let mx = 1e-6; frac.forEach((f, k) => { if (f > mx) { mx = f; j = k; } }); }
      if (j < 0) {
        nd.poda = 'entera';
        const mejora = !inc || nd.z > inc.z + 1e-9;
        if (mejora) { inc = { x: nd.x.map((q) => Math.round(q)), z: nd.z, nodo: nd.id }; primero = nodos.length; }
        yield { nodos, actual: nd, incumbente: inc, accion: mejora ? 'incumbente' : 'entera-sin-mejora', cortes: extra, primero }; continue;
      }
      const v = nd.x[j];
      const abajo = nd.cotas.map((q) => q.slice()), arriba = nd.cotas.map((q) => q.slice());
      abajo[j][1] = Math.floor(v); arriba[j][0] = Math.ceil(v);
      const h1 = crear(nd.id, abajo, `x${j + 1} ≤ ${Math.floor(v)}`), h2 = crear(nd.id, arriba, `x${j + 1} ≥ ${Math.ceil(v)}`);
      nd.hijos = [h1.id, h2.id]; nd.ramaVar = j;
      abiertos.push(h1, h2);
      yield { nodos, actual: nd, incumbente: inc, accion: 'ramifica', cortes: extra, primero };
    }
    yield { nodos, actual: null, incumbente: inc, accion: 'fin', truncado: false, cortes: extra, primero };
  }

  const esEntera = (x) => x && x.every((v) => Math.abs(v - Math.round(v)) < 1e-6);
  const fx = (x) => (x ? x.map((v) => VIZ.fmt(Math.round(v * 1000) / 1000, 3)).join(' ') : '—');
  const SEL = [['profundidad', 'profundidad'], ['mejor', 'mejor cota'], ['anchura', 'anchura (FIFO)']];
  const VAR = [['fraccion', 'más fraccionaria'], ['primera', 'primera fraccionaria'], ['valor', 'mayor valor']];
  const nombreSel = Object.fromEntries(SEL), nombreVar = Object.fromEntries(VAR);
  const textoCorte = (e) => `${e.C.map((i) => 'x' + (i + 1)).join(' + ')} ≤ ${e.b}`;
  function recorrer(I, op) { let fin; for (fin of ramificar(I, op)); return fin; }
  const hallado = (fin) => (fin.primero < 0 ? fin.nodos.length : fin.primero);
  function buscarInstancia(desde) {
    for (let s = desde; s < desde + 80; s++) {
      const I = instancia(s), fin = recorrer(I, { seleccion: 'mejor' });
      if (fin.nodos.length >= 15 && fin.nodos.length <= 45) return { I, semilla: s };
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
  const ROTULO = { abierto: 'abierto', ramificado: 'ramificado', entero: 'solución entera', infactible: 'infactible', cota: 'podado por cota' };
  const LEYENDA_ARBOL = [
    { color: C.s4, texto: 'abierto (en cola)', forma: 'punto' },
    { color: C.superficie, borde: C.tinta, texto: 'ramificado', forma: 'punto' },
    { color: C.s6, texto: 'entero', forma: 'punto' },
    { color: C.s8, texto: 'infactible', forma: 'punto' },
    { color: C.inactivo, texto: 'podado por cota', forma: 'punto' },
    { color: C.s1, texto: 'nodo en proceso (anillo)', forma: 'punto' },
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
  const altoArbol = (prof) => 70 + prof * 50;
  function dibujarArbol(lienzo, nodos, actual) {
    const { ctx, ancho: W } = lienzo;
    lienzo.limpiar();
    if (!nodos.length) return [];
    const L = disponer(nodos);
    const izq = 14, der = W - 14, sepY = 50, top = 20;
    const sep = L.hojas > 1 ? (der - izq) / (L.hojas - 1) : 0;
    const r = Math.max(4, Math.min(15, (L.hojas > 1 ? (der - izq) / L.hojas : 40) / 2 - 1));
    const X = (id) => (L.hojas > 1 ? izq + L.pos[id].u * sep : (izq + der) / 2);
    const Y = (id) => top + L.pos[id].nivel * sepY;
    const geo = [];
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje;
    for (const nd of nodos) for (const h of nd.hijos) { ctx.beginPath(); ctx.moveTo(X(nd.id), Y(nd.id)); ctx.lineTo(X(h), Y(h)); ctx.stroke(); }
    for (const nd of nodos) {
      const x = X(nd.id), y = Y(nd.id), est = estadoNodo(nd);
      const relleno = { abierto: C.s4, ramificado: C.superficie, entero: C.s6, infactible: C.s8, cota: C.inactivo }[est];
      if (nd.id === actual) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 7); ctx.stroke(); }
      ctx.fillStyle = relleno; ctx.strokeStyle = est === 'ramificado' ? C.tinta : C.superficie; ctx.lineWidth = est === 'ramificado' ? 1.5 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      if (r >= 9) {
        ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = est === 'ramificado' || est === 'abierto' ? C.tinta : C.sobre;
        ctx.fillText(String(nd.id), x, y + 0.5);
      }
      geo.push({ id: nd.id, x, y, r });
    }
    return geo;
  }
  const nodoBajo = (geo, x, y) => geo.find((g) => Math.hypot(g.x - x, g.y - y) <= g.r + 4);

  /* ---------- Fig. 1: una ejecución, paso a paso ---------- */

  function montarEjecucion(cuerpo) {
    let semilla = 1, I = null, seleccion = 'profundidad', variable = 'fraccion', cortes = false, heur = false, estado = null, geo = [], altoActual = altoArbol(0), zRaizSin = 0;
    const b0 = buscarInstancia(semilla); semilla = b0.semilla; I = b0.I;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Selección de nodo', opciones: SEL, valor: seleccion, alCambiar: (v) => { seleccion = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Variable de ramificación', opciones: VAR, valor: variable, alCambiar: (v) => { variable = v; rep.reiniciar(); } });
    ctl.casillas([{ clave: 'c', texto: 'cortes de cobertura en la raíz', activo: false }, { clave: 'h', texto: 'incumbente inicial por heurística', activo: false }], (e) => { cortes = e.c; heur = e.h; rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { const b = buscarInstancia(semilla + 1); semilla = b.semilla; I = b.I; rep.reiniciar(); });

    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => altoActual });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, LEYENDA_ARBOL);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie una opción a la vez y pulse «Hasta el final»: el contador de nodos creados es la medida de esfuerzo. «Profundidad» baja por una rama y halla un incumbente pronto; «mejor cota» cierra la cota superior; los cortes y la heurística achican el árbol sin cambiar el óptimo.');

    function tablaDatos() {
      const filas = [['objeto', ...I.v.map((_, i) => String(i + 1))], ['valor', ...I.v.map(String)], ['peso (≤ ' + I.cap[0] + ')', ...I.W[0].map(String)], ['volumen (≤ ' + I.cap[1] + ')', ...I.W[1].map(String)]];
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        ...filas.map((f, r) => VIZ.el('tr', null, ...f.map((t, k) => VIZ.el(r === 0 || k === 0 ? 'th' : 'td', k === 0 ? { class: 'izq' } : null, t))))));
    }
    function iniciar() {
      tablaDatos();
      const S = sistema(I);
      zRaizSin = O.lp(I.v, S.A, S.sen, S.b).z;
      estado = null;
      const g = ramificar(I, { seleccion, variable, cortes, heur, maxNodos: 120 });
      return (function* () { for (const s of g) { estado = s; yield; } })();
    }
    function dibujar() {
      const nodos = estado ? estado.nodos : [];
      const inc = estado ? estado.incumbente : null;
      if (nodos.length) {
        const nec = altoArbol(disponer(nodos).prof);
        if (nec !== altoActual) { altoActual = nec; lienzo.ajustar(true); }
      }
      const act = estado && estado.actual ? estado.actual : null;
      geo = nodos.length ? dibujarArbol(lienzo, nodos, act ? act.id : null) : (lienzo.limpiar(), []);
      const extra = estado ? estado.cortes : [];
      const txtCortes = extra.length ? ` Cortes de cobertura en la raíz: ${extra.map(textoCorte).join('; ')}; la cota de la raíz baja de ${VIZ.fmt(zRaizSin)} a ${VIZ.fmt(nodos[0].z)}.` : '';
      const txtHeur = heur && inc && inc.inicial ? ` Incumbente inicial por heurística (voraz): ${VIZ.fmt(inc.z)}.` : '';
      if (!estado) registro.textContent = 'Pulse «Un paso» o «Hasta el final».';
      else if (!act) registro.textContent = `Fin con ${nodos.length} nodos${estado.truncado ? ' (límite alcanzado)' : ''}: óptimo ${inc ? VIZ.fmt(inc.z) : '—'}, hallado tras ${hallado(estado)} nodos creados.${txtCortes}${txtHeur}`;
      else registro.textContent = ({
        raiz: `Raíz: relajación z = ${VIZ.fmt(act.z)}.`,
        ramifica: `Nodo ${act.id}: se ramifica ${nombreVar[variable]} → x${act.ramaVar + 1}, relajación ${VIZ.fmt(act.z)}.`,
        incumbente: `Nodo ${act.id}: entero, z = ${VIZ.fmt(act.z)}: nuevo incumbente.`,
        'entera-sin-mejora': `Nodo ${act.id}: entero pero no mejora el incumbente.`,
        'poda-infactible': `Nodo ${act.id}: infactible.`,
        'poda-cota': `Nodo ${act.id}: cota ${VIZ.fmt(act.z)} no supera al incumbente; se poda.`,
      })[estado.accion] + (estado.accion === 'raiz' ? txtCortes + txtHeur : '');
      lectura.set([
        ['nodos creados', String(nodos.length)],
        ['incumbente', inc ? VIZ.fmt(inc.z) + (inc.inicial ? ' (heurística)' : '') : 'ninguno'],
        ['cota de la raíz', nodos.length ? VIZ.fmt(nodos[0].z) : '—'],
        ['cortes en la raíz', String(extra.length)],
        ['abiertos', String(nodos.filter((q) => estadoNodo(q) === 'abierto').length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = nodoBajo(geo, x, y);
      if (!g || !estado) return tip.ocultar();
      const q = estado.nodos[g.id];
      tip.mostrar(x, y, `nodo <b>${q.id}</b>${q.rama ? ` (${q.rama})` : ' (raíz)'}<br>` + (q.estado === 'optimo' ? `x* = (${fx(q.x)})<br>z = <b>${VIZ.fmt(q.z)}</b><br>${ROTULO[estadoNodo(q)]}` : 'relajación infactible'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: comparación entre estrategias ---------- */

  const COMBOS = [];
  for (const s of SEL) for (const v of VAR) COMBOS.push({ seleccion: s[0], variable: v[0] });
  const COLOR_SEL = { profundidad: C.s1, mejor: C.s2, anchura: C.s3 };

  function montarComparacion(cuerpo) {
    let bloque = 0, metrica = 'total', cortes = false, heur = false, res = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Medida', opciones: [['total', 'nodos hasta terminar'], ['hallado', 'nodos hasta el mejor incumbente']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.casillas([{ clave: 'c', texto: 'cortes de cobertura', activo: false }, { clave: 'h', texto: 'heurística inicial', activo: false }], (e) => { cortes = e.c; heur = e.h; calcular(); });
    ctl.boton('Nuevas instancias', () => { bloque++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 38 + COMBOS.length * 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'selección por profundidad' },
      { color: C.s2, texto: 'selección por mejor cota' },
      { color: C.s3, texto: 'selección en anchura' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es el promedio sobre 10 instancias de mochila con dos recursos y 7 objetos; todas las estrategias obtienen el mismo óptimo. Pase el cursor para ver el mínimo y el máximo. Active los cortes o la heurística y observe cuánto bajan todas las barras.');

    function calcular() {
      res = COMBOS.map((c) => ({ ...c, total: [], hallado: [] }));
      for (let s = 1; s <= 10; s++) {
        const I = instancia(bloque * 10 + s);
        let opt = null;
        res.forEach((r) => {
          const fin = recorrer(I, { seleccion: r.seleccion, variable: r.variable, cortes, heur, maxNodos: 200 });
          r.total.push(fin.nodos.length); r.hallado.push(hallado(fin));
          if (opt == null) opt = fin.incumbente.z;
        });
      }
      dibujar();
    }
    const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    function dibujar() {
      if (!res.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = Math.min(190, W * 0.5), der = W - 56, top = 8, alto = 30;
      const mx = Math.max(...res.map((r) => media(r[metrica]))) * 1.05 || 1;
      geo = [];
      ctx.textBaseline = 'middle';
      res.forEach((r, k) => {
        const y = top + k * alto, m = media(r[metrica]), w = (m / mx) * (der - izq);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left';
        ctx.fillText(`${{ profundidad: 'prof.', mejor: 'mejor', anchura: 'anch.' }[r.seleccion]} · ${{ fraccion: 'fraccionaria', primera: 'primera', valor: 'mayor valor' }[r.variable]}`, 4, y + alto / 2);
        ctx.fillStyle = COLOR_SEL[r.seleccion];
        ctx.beginPath(); ctx.roundRect(izq, y + 4, Math.max(2, w), alto - 8, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.fillText(VIZ.fmt(m, 3), izq + Math.max(2, w) + 6, y + alto / 2);
        geo.push({ y0: y, y1: y + alto, r });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq + 0.5, top); ctx.lineTo(izq + 0.5, top + res.length * alto); ctx.stroke();
      const ms = res.map((r) => media(r[metrica])), imin = ms.indexOf(Math.min(...ms)), imax = ms.indexOf(Math.max(...ms));
      const nom = (r) => `${nombreSel[r.seleccion]} + ${nombreVar[r.variable]}`;
      lectura.set([
        ['mejor estrategia', `${nom(res[imin])} (${VIZ.fmt(ms[imin], 3)})`],
        ['peor estrategia', `${nom(res[imax])} (${VIZ.fmt(ms[imax], 3)})`],
        ['razón peor / mejor', `${VIZ.fmt(ms[imax] / (ms[imin] || 1), 3)} ×`],
        ['promedio general', VIZ.fmt(media(ms), 3)],
      ]);
      registro.textContent = metrica === 'total'
        ? `En promedio ${nom(res[imin])} necesita ${VIZ.fmt(ms[imin], 3)} nodos y ${nom(res[imax])} necesita ${VIZ.fmt(ms[imax], 3)}${cortes || heur ? ' (con ' + [cortes ? 'cortes' : '', heur ? 'heurística' : ''].filter(Boolean).join(' y ') + ')' : ''}.`
        : 'Esta medida cuenta los nodos creados hasta el último incumbente que mejora la solución; después el árbol solo debe probar que no hay nada mejor, y esa parte suele ser la mayor.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => y >= q.y0 && y < q.y1);
      if (!g) return tip.ocultar();
      const v = g.r[metrica];
      tip.mostrar(x, y, `<b>${nombreSel[g.r.seleccion]}</b> + ${nombreVar[g.r.variable]}<br>promedio ${VIZ.fmt(media(v), 3)}<br>mínimo ${Math.min(...v)}, máximo ${Math.max(...v)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('milp-solving-strategies', {
    intro: String.raw`
      <p>La ramificación y acotamiento deja varias decisiones abiertas: <strong>qué nodo</strong> abierto procesar a continuación, <strong>qué variable</strong> fraccionaria ramificar, si conviene buscar una solución entera con una <strong>heurística</strong> antes de empezar y si vale la pena agregar <strong>cortes</strong>.
      Todas las combinaciones son correctas (llegan al mismo óptimo), pero el tamaño del árbol puede cambiar varias veces según la elección.</p>
      <p>Los resolvedores comerciales combinan estas piezas: preprocesamiento, cortes en la raíz, heurísticas de buceo y redondeo, y reglas de ramificación aprendidas de las decisiones anteriores. Aquí se compara lo esencial sobre un problema pequeño que cualquiera puede seguir paso a paso.</p>`,
    visualizaciones: [
      {
        titulo: 'Una ejecución con sus opciones',
        descripcion: 'Elija la selección de nodo y la variable de ramificación y reproduzca el árbol. Active los cortes de cobertura o la heurística inicial y compare el contador de nodos al llegar al final con la misma instancia.',
        montar: montarEjecucion,
      },
      {
        titulo: 'Comparar estrategias en 10 instancias',
        descripcion: 'Nueve combinaciones de selección y variable sobre 10 mochilas de dos recursos: la barra es el promedio de nodos. Cambie la medida a «hasta el mejor incumbente» y active cortes o heurística para ver cuánto baja cada barra.',
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>Selección de nodo</h2>
      <table>
        <tr><th>Regla</th><th>Idea</th><th>Efecto</th></tr>
        <tr><td>Profundidad (DFS)</td><td>procesar el último nodo creado</td><td>halla incumbentes pronto y usa poca memoria, pero puede explorar zonas inútiles</td></tr>
        <tr><td>Mejor cota (best-first)</td><td>procesar el nodo abierto de mayor relajación</td><td>nunca procesa un nodo cuya cota sea menor que el óptimo: minimiza nodos si el incumbente fuera conocido, pero guarda muchos nodos abiertos</td></tr>
        <tr><td>Anchura (FIFO)</td><td>procesar en orden de creación</td><td>poco usada: ni cota ni incumbente tempranos</td></tr>
      </table>
      <p>En la práctica se mezclan: buceo en profundidad hasta hallar un incumbente y luego mejor cota con saltos periódicos.</p>
      <h2>Selección de variable</h2>
      <p>Entre las variables fraccionarias \(x_j\) se ramifica sobre una elegida por una regla: la <em>más fraccionaria</em> (la que más se aleja de un entero), la <em>primera</em> por índice, la de <em>mayor coeficiente</em> o, la más potente en resolvedores, la de mayor mejora estimada
      de la cota (<em>strong branching</em> y <em>pseudocostos</em>). Una buena elección hace caer rápido la cota en ambos hijos.</p>
      <h2>Heurísticas</h2>
      <p>Una solución entera factible conocida desde el inicio permite podar por cota antes. Basta una heurística barata, como el algoritmo voraz de la figura (ordenar los objetos por valor sobre peso normalizado y agregarlos mientras quepan), o el <em>redondeo</em> y <em>buceo</em> sobre la relajación. Si la heurística ya halla el óptimo, el árbol solo debe
      probar que nada es mejor.</p>
      <h2>Cortes y branch and cut</h2>
      <p>En la raíz se agregan desigualdades válidas que el óptimo relajado viola. Para una restricción de mochila \(\sum_j w_j x_j \le W\), un conjunto \(C\) cuyo peso excede \(W\) (una <em>cobertura</em>) genera el corte</p>
      \[ \sum_{j \in C} x_j \le |C| - 1, \]
      <p>válido porque no se pueden tomar todos los objetos de \(C\). Si \(C\) es mínima y el punto relajado lo viola, el corte baja la cota de la raíz y reduce el árbol. El esquema general se llama <em>branch and cut</em>; véase <a href="tema.html?id=cutting-planes">planos cortantes</a>
      y <a href="tema.html?id=valid-inequalities">desigualdades válidas</a>.</p>
      <h2>Qué se observa</h2>
      <ul>
        <li>No hay una regla ganadora universal: el promedio depende de la estructura. Con mejor cota el árbol suele ser menor, mientras que «profundidad» halla antes un primer incumbente (aunque no necesariamente el óptimo).</li>
        <li>Cortes y heurística ayudan casi siempre y se acumulan: la cota de la raíz baja y el incumbente inicial sube, lo que estrecha la <a href="tema.html?id=node-pruning-gap">brecha de optimalidad</a> desde el comienzo.</li>
        <li>La poda por cota, y por tanto cualquier estrategia, depende de qué tan ajustada sea la relajación; véase <a href="tema.html?id=lp-relaxation">relajación lineal</a>.</li>
      </ul>
      <p>El esquema básico del árbol está en <a href="tema.html?id=milp-branch-and-bound">Branch and Bound para MILP</a>.</p>`,
  });
})();
