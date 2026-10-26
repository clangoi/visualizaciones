(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const M = VIZ.ml;
  const ATR = ['x₁', 'x₂'];
  const val = (p, f) => (f ? p.y : p.x);

  /* ---------- CART: árbol de clasificación con cortes paralelos a los ejes ---------- */

  const IMPUREZA = {
    gini: (pr) => 1 - pr.reduce((s, p) => s + p * p, 0),
    entropia: (pr) => -pr.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0),
  };

  // op: { K, maxProf, minHoja, criterio, rnd (para elegir un atributo al azar en cada corte, como en random forest) }
  function crecer(pts, op, d = 0) {
    const n = pts.length, cuenta = new Array(op.K).fill(0);
    for (const p of pts) cuenta[p.c]++;
    const prob = cuenta.map((c) => c / Math.max(1, n));
    const imp = IMPUREZA[op.criterio](prob);
    const nodo = { n, cuenta, prob, clase: prob.indexOf(Math.max(...prob)), d, imp, hijos: [] };
    if (d >= op.maxProf || n < 2 * op.minHoja || imp < 1e-12) return nodo;
    let mejor = null;
    const atributos = op.rnd ? [op.rnd() < 0.5 ? 0 : 1] : [0, 1];
    for (const f of atributos) {
      const s = pts.slice().sort((a, b) => val(a, f) - val(b, f));
      const izq = new Array(op.K).fill(0);
      for (let i = 0; i < n - 1; i++) {
        izq[s[i].c]++;
        const ni = i + 1;
        if (ni < op.minHoja || n - ni < op.minHoja || val(s[i], f) === val(s[i + 1], f)) continue;
        const pi = izq.map((c) => c / ni), pd = cuenta.map((c, k) => (c - izq[k]) / (n - ni));
        const im = (ni * IMPUREZA[op.criterio](pi) + (n - ni) * IMPUREZA[op.criterio](pd)) / n;
        if (!mejor || im < mejor.im) mejor = { im, f, t: (val(s[i], f) + val(s[i + 1], f)) / 2 };
      }
    }
    if (!mejor || mejor.im >= imp - 1e-12) return nodo;
    nodo.f = mejor.f;
    nodo.t = mejor.t;
    nodo.ganancia = imp - mejor.im;
    nodo.hijos = [crecer(pts.filter((p) => val(p, mejor.f) <= mejor.t), op, d + 1), crecer(pts.filter((p) => val(p, mejor.f) > mejor.t), op, d + 1)];
    return nodo;
  }
  function hoja(nodo, x, y) {
    while (nodo.hijos.length) nodo = (nodo.f ? y : x) <= nodo.t ? nodo.hijos[0] : nodo.hijos[1];
    return nodo;
  }
  const hojas = (n) => (n.hijos.length ? hojas(n.hijos[0]) + hojas(n.hijos[1]) : 1);
  const profundidad = (n) => (n.hijos.length ? 1 + Math.max(profundidad(n.hijos[0]), profundidad(n.hijos[1])) : 0);
  const exactitud = (pts, pred) => pts.filter((q) => { const p = pred(q.x, q.y); return p.indexOf(Math.max(...p)) === q.c; }).length / Math.max(1, pts.length);

  // Dibuja las líneas de corte dentro de los límites de cada nodo.
  function cortes(ctx, plano, nodo, lim, ancho = 1.5) {
    if (!nodo.hijos.length) return;
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = ancho;
    ctx.beginPath();
    if (nodo.f === 0) { ctx.moveTo(plano.sx(nodo.t), plano.sy(lim[2])); ctx.lineTo(plano.sx(nodo.t), plano.sy(lim[3])); }
    else { ctx.moveTo(plano.sx(lim[0]), plano.sy(nodo.t)); ctx.lineTo(plano.sx(lim[1]), plano.sy(nodo.t)); }
    ctx.stroke();
    const [a, b] = nodo.hijos;
    if (nodo.f === 0) { cortes(ctx, plano, a, [lim[0], nodo.t, lim[2], lim[3]], ancho); cortes(ctx, plano, b, [nodo.t, lim[1], lim[2], lim[3]], ancho); }
    else { cortes(ctx, plano, a, [lim[0], lim[1], lim[2], nodo.t], ancho); cortes(ctx, plano, b, [lim[0], lim[1], nodo.t, lim[3]], ancho); }
  }
  const LIM = [M.DOMINIO.xmin, M.DOMINIO.xmax, M.DOMINIO.ymin, M.DOMINIO.ymax];
  const nClases = (tipo) => (tipo === 'tres' ? 3 : 2);

  /* ---------- Fig. 1: un árbol de decisión ---------- */

  const MAX_DIBUJO = 5;
  // Copia del árbol hasta MAX_DIBUJO niveles para dibujarlo.
  const recortar = (n) => ({ ...n, original: n, cortado: n.d >= MAX_DIBUJO && n.hijos.length > 0, hijos: n.d >= MAX_DIBUJO ? [] : n.hijos.map(recortar) });

  function montarArbol(cuerpo) {
    let tipo = 'lunas', maxProf = 3, minHoja = 2, criterio = 'gini', semilla = 1, tr = [], va = [], raiz = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS, valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    ctl.rango({ etiqueta: 'Profundidad máxima', min: 1, max: 10, valor: maxProf, alCambiar: (v) => { maxProf = v; entrenar(); } });
    ctl.rango({ etiqueta: 'Mínimo de ejemplos por hoja', min: 1, max: 25, valor: minHoja, alCambiar: (v) => { minHoja = v; entrenar(); } });
    ctl.selector({ etiqueta: 'Criterio de impureza', opciones: [['gini', 'Gini'], ['entropia', 'Entropía']], valor: criterio, alCambiar: (v) => { criterio = v; entrenar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, 'Partición del espacio de atributos');
    const l1 = VIZ.lienzo(a, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(l1);
    VIZ.subtitulo(b, `Árbol (hasta ${MAX_DIBUJO} niveles)`);
    const l2 = VIZ.lienzo(b, { altoFn: () => 40 + Math.min(MAX_DIBUJO, raiz ? profundidad(raiz) : 1) * 64 + 20 });
    const tip2 = VIZ.tooltip(l2);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nodo interno pregunta por un atributo y un umbral; la rama izquierda es «sí» y la derecha «no». Cada hoja predice la clase mayoritaria de sus ejemplos (el número dentro de la hoja). Pase el cursor sobre el plano o el árbol para ver los detalles.');

    function datos() {
      ({ entrenamiento: tr, validacion: va } = M.partir(M.datos(tipo, 220, 0.3, semilla * 3), 0.7, semilla));
      leyenda.set([...M.leyendaClases(nClases(tipo)), { color: C.tinta, texto: 'cortes del árbol', forma: 'linea' }, { color: C.superficie, borde: C.tinta2, texto: 'validación (contorno)', forma: 'punto' }]);
      entrenar();
    }
    function entrenar() {
      raiz = crecer(tr, { K: nClases(tipo), maxProf, minHoja, criterio });
      l2.ajustar(true);
      dibujar();
    }
    let p1 = null, g2 = null;
    function dibujar() {
      if (!raiz) return;
      let ctx = l1.ctx;
      l1.limpiar();
      p1 = M.plano(l1);
      M.regiones(ctx, p1, (x, y) => hoja(raiz, x, y).prob);
      p1.ejes();
      ctx.save(); p1.recortar(); cortes(ctx, p1, raiz, LIM); ctx.restore();
      M.puntos(ctx, p1, tr, { r: 3.5 });
      M.puntos(ctx, p1, va, { r: 3.5, hueco: () => true });

      ctx = l2.ctx;
      l2.limpiar();
      g2 = VIZ.busqueda.dibujarArbol(ctx, recortar(raiz), {
        x0: 6, y0: 26, ancho: l2.ancho - 12, dy: 64,
        forma: (n) => (n.hijos.length || n.cortado ? 'circulo' : 'cuadro'),
        estilo: (n) => (n.hijos.length || n.cortado ? { relleno: C.superficie, guiones: n.cortado ? [3, 2] : null } : { relleno: VIZ.alfa(M.CLASES[n.clase], 0.2 + 0.6 * Math.max(...n.prob)), borde: M.CLASES[n.clase] }),
        etiqueta: (n) => (n.cortado ? '…' : n.hijos.length ? '' : String(n.n)),
        debajo: (n) => (n.hijos.length ? `${ATR[n.f]}≤${VIZ.fmt(n.t, 2)}` : ''),
      });
      const prof = profundidad(raiz);
      registro.textContent = prof === 0 ? 'El árbol es una sola hoja: no hay corte que reduzca la impureza.'
        : `La raíz corta en ${ATR[raiz.f]} ≤ ${VIZ.fmt(raiz.t, 3)}, que reduce la impureza ${criterio === 'gini' ? 'de Gini' : '(entropía)'} de ${VIZ.fmt(raiz.imp, 3)} a ${VIZ.fmt(raiz.imp - raiz.ganancia, 3)}.`;
      lectura.set([
        ['profundidad', String(prof)],
        ['hojas', String(hojas(raiz))],
        ['exactitud entrenamiento', `${Math.round(100 * exactitud(tr, (x, y) => hoja(raiz, x, y).prob))} %`],
        ['exactitud validación', `${Math.round(100 * exactitud(va, (x, y) => hoja(raiz, x, y).prob))} %`],
      ]);
    }
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    const describir = (n) => `${n.n} ejemplos · impureza ${VIZ.fmt(n.imp, 3)}<br>por clase: ${n.cuenta.join(' / ')}`;
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!p1 || !p1.dentro(x, y)) return tip.ocultar();
      const h = hoja(raiz, p1.ix(x), p1.iy(y));
      tip.mostrar(x, y, `hoja a profundidad ${h.d}: predice <b>clase ${h.clase}</b><br>${describir(h)}`);
    });
    l1.canvas.addEventListener('pointerleave', () => tip.ocultar());
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      const n = VIZ.busqueda.nodoArbolEn(g2, x, y);
      if (!n) return tip2.ocultar();
      tip2.mostrar(x, y, (n.hijos.length ? `${ATR[n.f]} ≤ ${VIZ.fmt(n.t, 3)}<br>` : n.cortado ? 'subárbol no dibujado<br>' : `hoja: clase <b>${n.clase}</b><br>`) + describir(n));
    });
    l2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    datos();
  }

  /* ---------- Fig. 2: random forest ---------- */

  function montarBosque(cuerpo) {
    let tipo = 'lunas', nArb = 25, maxProf = 8, semilla = 1, solo = false, tr = [], va = [], bosque = [], curva = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS, valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    ctl.rango({ etiqueta: 'Árboles', min: 1, max: 60, valor: nArb, alCambiar: (v) => { nArb = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Profundidad máxima', min: 1, max: 12, valor: maxProf, alCambiar: (v) => { maxProf = v; entrenar(); } });
    ctl.casilla({ etiqueta: 'Mostrar solo el primer árbol', valor: solo, alCambiar: (v) => { solo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, 'Voto promedio del bosque');
    const l1 = VIZ.lienzo(a, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    VIZ.subtitulo(b, 'Exactitud de validación según el número de árboles');
    const l2 = VIZ.lienzo(b, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(l2);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada árbol se entrena con una muestra con reemplazo (bootstrap) de los datos y, en cada corte, con un atributo elegido al azar. Pase el cursor sobre la curva para ver la exactitud con cada número de árboles.');

    function datos() {
      ({ entrenamiento: tr, validacion: va } = M.partir(M.datos(tipo, 240, 0.35, semilla * 7), 0.6, semilla));
      leyenda.set([...M.leyendaClases(nClases(tipo)), { color: C.superficie, borde: C.tinta2, texto: 'validación (contorno)', forma: 'punto' },
        { color: C.s1, texto: 'bosque', forma: 'linea' }, { color: C.apagado, texto: 'un solo árbol', forma: 'linea' }]);
      entrenar();
    }
    function entrenar() {
      const rnd = VIZ.semilla(semilla * 31 + maxProf);
      bosque = Array.from({ length: 60 }, () => {
        const muestra = Array.from({ length: tr.length }, () => tr[Math.floor(rnd() * tr.length)]);
        return crecer(muestra, { K: nClases(tipo), maxProf, minHoja: 1, criterio: 'gini', rnd });
      });
      // Exactitud de validación con los primeros m árboles, incrementalmente.
      const suma = va.map(() => new Array(nClases(tipo)).fill(0));
      curva = bosque.map((t) => {
        va.forEach((q, i) => hoja(t, q.x, q.y).prob.forEach((p, k) => { suma[i][k] += p; }));
        return va.filter((q, i) => suma[i].indexOf(Math.max(...suma[i])) === q.c).length / va.length;
      });
      dibujar();
    }
    const predecir = (x, y) => {
      const arboles = solo ? bosque.slice(0, 1) : bosque.slice(0, nArb);
      const s = new Array(nClases(tipo)).fill(0);
      for (const t of arboles) hoja(t, x, y).prob.forEach((p, k) => { s[k] += p / arboles.length; });
      return s;
    };
    let p2 = null, hover = null;
    function dibujar() {
      if (!bosque.length) return;
      let ctx = l1.ctx;
      l1.limpiar();
      const p1 = M.plano(l1);
      M.regiones(ctx, p1, predecir, { paso: 5 });
      p1.ejes();
      if (solo) { ctx.save(); p1.recortar(); cortes(ctx, p1, bosque[0], LIM, 1); ctx.restore(); }
      M.puntos(ctx, p1, tr, { r: 3 });
      M.puntos(ctx, p1, va, { r: 3, hueco: () => true });

      ctx = l2.ctx;
      l2.limpiar();
      const ymin = Math.max(0, Math.floor(Math.min(...curva) * 10) / 10 - 0.05);
      p2 = VIZ.plano(l2, { xmin: 1, xmax: 60, ymin, ymax: 1 }, { etiquetaX: 'árboles', etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %`, margen: { izq: 46 } });
      p2.ejes();
      VIZ.trazar(ctx, p2, [[1, curva[0]], [60, curva[0]]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, p2, curva.map((c, i) => [i + 1, c]), C.s1, 2);
      const m = hover ?? nArb;
      VIZ.marcador(ctx, p2.sx(m), p2.sy(curva[m - 1]), C.s1, 5);
      lectura.set([
        ['árboles usados', String(solo ? 1 : nArb)],
        ['exactitud de un árbol', `${Math.round(100 * curva[0])} %`],
        [`exactitud con ${nArb}`, `${Math.round(100 * curva[nArb - 1])} %`],
        ['exactitud entrenamiento', `${Math.round(100 * exactitud(tr, predecir))} %`],
      ]);
    }
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!p2 || !p2.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(60, Math.round(p2.ix(x))));
      dibujar();
      tip.mostrar(x, y, `<b>${hover}</b> árboles<br>exactitud de validación <b>${Math.round(100 * curva[hover - 1])} %</b>`);
    });
    l2.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    datos();
  }

  /* ---------- Fig. 3: AdaBoost con tocones ---------- */

  function tocon(pts, w) {
    let mejor = { err: Infinity };
    for (const f of [0, 1]) {
      const s = pts.map((p, i) => [val(p, f), p.c ? 1 : -1, w[i]]).sort((a, b) => a[0] - b[0]);
      // pol = +1: predice +1 si x > t.
      let errPos = s.reduce((e, [, y, wi]) => e + (y < 0 ? wi : 0), 0); // umbral bajo todos: todo +1
      const probar = (t, e) => {
        if (e < mejor.err) mejor = { err: e, f, t, pol: 1 };
        if (1 - e < mejor.err) mejor = { err: 1 - e, f, t, pol: -1 };
      };
      probar(s[0][0] - 1e-3, errPos);
      for (let i = 0; i < s.length; i++) {
        errPos += s[i][1] > 0 ? s[i][2] : -s[i][2];
        if (i + 1 < s.length && s[i][0] === s[i + 1][0]) continue;
        probar(i + 1 < s.length ? (s[i][0] + s[i + 1][0]) / 2 : s[i][0] + 1e-3, errPos);
      }
    }
    return mejor;
  }
  const aplicar = (h, x, y) => h.pol * ((h.f ? y : x) > h.t ? 1 : -1);

  function montarBoosting(cuerpo) {
    let tipo = 'circulos', semilla = 1, tr = [], va = [], w = [], debiles = [], hist = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS.filter(([k]) => k !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, 'Ensamble y pesos de los ejemplos');
    const l1 = VIZ.lienzo(a, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    VIZ.subtitulo(b, 'Error según el número de rondas');
    const l2 = VIZ.lienzo(b, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      ...M.leyendaClases(2, ['y = −1', 'y = +1']),
      { color: C.s2, texto: 'tocón de esta ronda', forma: 'linea' },
      { color: C.s1, texto: 'error de entrenamiento', forma: 'linea' },
      { color: C.s3, texto: 'error de validación', forma: 'linea' },
      { color: C.apagado, texto: 'cota ∏ 2√(ε(1 − ε))', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El tamaño de cada punto es proporcional a su peso: los ejemplos mal clasificados ganan peso y el siguiente tocón se concentra en ellos.');

    function datos() {
      ({ entrenamiento: tr, validacion: va } = M.partir(M.datos(tipo, 200, 0.25, semilla * 9), 0.6, semilla));
      rep.reiniciar();
    }
    const F = (x, y) => debiles.reduce((s, h) => s + h.alfa * aplicar(h, x, y), 0);
    const error = (pts) => pts.filter((q) => (F(q.x, q.y) > 0 ? 1 : 0) !== q.c).length / pts.length;
    function iniciar() {
      w = tr.map(() => 1 / tr.length);
      debiles = [];
      hist = [];
      return (function* () {
        let cota = 1;
        for (let t = 0; t < 100; t++) {
          const h = tocon(tr, w);
          const eps = Math.max(1e-10, Math.min(1 - 1e-10, h.err));
          h.alfa = 0.5 * Math.log((1 - eps) / eps);
          h.eps = eps;
          debiles.push(h);
          let z = 0;
          tr.forEach((q, i) => { w[i] *= Math.exp(-h.alfa * (q.c ? 1 : -1) * aplicar(h, q.x, q.y)); z += w[i]; });
          w = w.map((v) => v / z);
          cota *= 2 * Math.sqrt(eps * (1 - eps));
          hist.push([t + 1, error(tr), error(va), cota]);
          yield;
        }
      })();
    }
    function dibujar() {
      let ctx = l1.ctx;
      l1.limpiar();
      const p1 = M.plano(l1);
      if (debiles.length) M.regiones(ctx, p1, (x, y) => M.sigmoide(2 * F(x, y)));
      p1.ejes();
      const h = debiles[debiles.length - 1];
      if (h) {
        ctx.save();
        p1.recortar();
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
        ctx.beginPath();
        if (h.f === 0) { ctx.moveTo(p1.sx(h.t), p1.y1); ctx.lineTo(p1.sx(h.t), p1.y0); } else { ctx.moveTo(p1.x0, p1.sy(h.t)); ctx.lineTo(p1.x1, p1.sy(h.t)); }
        ctx.stroke();
        ctx.restore();
      }
      const n = tr.length;
      tr.forEach((q, i) => VIZ.marcador(ctx, p1.sx(q.x), p1.sy(q.y), M.CLASES[q.c], Math.max(1.5, Math.min(14, 3.5 * Math.sqrt((w[i] || 1 / n) * n))), q.c));

      ctx = l2.ctx;
      l2.limpiar();
      const p2 = VIZ.plano(l2, { xmin: 0, xmax: Math.max(20, hist.length), ymin: 0, ymax: 0.6 }, { etiquetaX: 'rondas', etiquetaY: 'error', margen: { izq: 40 } });
      p2.ejes();
      ctx.save(); p2.recortar();
      VIZ.trazar(ctx, p2, hist.map((r) => [r[0], r[3]]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, p2, hist.map((r) => [r[0], r[1]]), C.s1, 2);
      VIZ.trazar(ctx, p2, hist.map((r) => [r[0], r[2]]), C.s3, 2);
      ctx.restore();
      registro.textContent = h ? `Ronda ${debiles.length}: el mejor tocón corta ${ATR[h.f]} en ${VIZ.fmt(h.t, 3)} con error ponderado ε = ${VIZ.fmt(h.eps, 3)}, así que vota con peso α = ½ ln((1 − ε)/ε) = ${VIZ.fmt(h.alfa, 3)}.`
        : 'Todos los ejemplos parten con el mismo peso 1/n. Cada ronda agrega un clasificador débil: un corte en un solo atributo.';
      const u = hist[hist.length - 1];
      lectura.set([
        ['ronda', String(debiles.length)],
        ['error ponderado de la ronda', h ? VIZ.fmt(h.eps, 3) : '—'],
        ['peso del voto', h ? VIZ.fmt(h.alfa, 3) : '—'],
        ['error entrenamiento', u ? `${Math.round(100 * u[1])} %` : '—'],
        ['error validación', u ? `${Math.round(100 * u[2])} %` : '—'],
      ]);
    }
    l1.alDibujar = () => tr.length && dibujar();
    l2.alDibujar = () => tr.length && dibujar();
    datos();
  }

  VIZ.registrarTema('decision-trees', {
    intro: String.raw`
      <p>Un <strong>árbol de decisión</strong> clasifica haciendo preguntas sucesivas del tipo «¿\(x_2 \le 0.3\)?». Cada pregunta
      divide los datos en dos y cada hoja asigna una clase, de modo que el espacio de atributos queda partido en rectángulos. Es
      fácil de interpretar, no necesita escalar los atributos y captura interacciones, pero un árbol profundo memoriza los datos:
      tiene muy poco sesgo y mucha <a href="tema.html?id=supervised-learning">varianza</a>.</p>
      <p>Los <strong>ensambles</strong> combinan muchos árboles. <strong>Random forest</strong> promedia árboles profundos entrenados
      con versiones perturbadas de los datos para reducir la varianza; <strong>boosting</strong> suma árboles muy simples entrenados
      en secuencia, cada uno corrigiendo los errores de los anteriores, para reducir el sesgo.</p>`,
    visualizaciones: [
      {
        titulo: 'Un árbol de decisión',
        descripcion: 'Suba la profundidad máxima: el árbol agrega cortes hasta aislar cada punto y el error de validación vuelve a subir. Aumentar el mínimo de ejemplos por hoja es otra forma de podarlo.',
        montar: montarArbol,
      },
      {
        titulo: 'Random forest',
        descripcion: 'Un árbol profundo tiene fronteras dentadas y llenas de islas; el promedio de muchos las suaviza. Compare la frontera con un solo árbol y con 60, y observe cómo la exactitud se estabiliza.',
        montar: montarBosque,
      },
      {
        titulo: 'Boosting (AdaBoost)',
        descripcion: 'Cada ronda agrega un corte en un solo atributo, ponderado según su error. Con círculos concéntricos, ningún corte sirve por sí solo, pero su suma dibuja una frontera cerrada.',
        montar: montarBoosting,
      },
    ],
    teoria: String.raw`
      <h2>Árboles de decisión (CART)</h2>
      <p>El árbol se construye de arriba abajo de forma codiciosa: en cada nodo se prueban todos los atributos \(j\) y umbrales
      \(t\) y se elige el corte que más reduce la <strong>impureza</strong> ponderada de los hijos. Para un nodo con proporciones
      de clase \(p_1, \dots, p_K\):</p>
      \[ \text{Gini} = 1 - \sum_{k} p_k^2, \qquad H = -\sum_{k} p_k \log_2 p_k, \]
      <p>ambas cero en un nodo puro y máximas con clases mezcladas por igual. La ganancia de un corte que manda \(n_L\) ejemplos a la
      izquierda y \(n_R\) a la derecha es \(I(\text{padre}) - \frac{n_L}{n} I(L) - \frac{n_R}{n} I(R)\).</p>
      <pre><code>CRECER(datos, profundidad):
    si el nodo es puro o se alcanzó un límite: devolver hoja(clase mayoritaria)
    (j, t) ← corte de máxima ganancia
    devolver nodo(j, t, CRECER(datos con x_j ≤ t), CRECER(datos con x_j &gt; t))</code></pre>
      <p>Probar todos los umbrales cuesta \(O(d\, n \log n)\) por nivel ordenando cada atributo. Encontrar el árbol <em>óptimo</em>
      es NP-difícil, por eso se usa este método codicioso. Para regresión se usa la varianza como impureza y cada hoja predice el
      promedio.</p>

      <h2>Bagging y random forest</h2>
      <p>Si \(B\) modelos tienen varianza \(\sigma^2\) y correlación \(\rho\) entre ellos, su promedio tiene varianza</p>
      \[ \rho\,\sigma^2 + \frac{1 - \rho}{B}\,\sigma^2. \]
      <p><strong>Bagging</strong> entrena cada árbol con una muestra <em>bootstrap</em> (con reemplazo) de los datos, lo que reduce
      el segundo término. <strong>Random forest</strong> (Breiman, 2001) además elige al azar un subconjunto de atributos en cada
      corte (típicamente \(\sqrt{d}\)), lo que reduce la correlación \(\rho\). Como cada bootstrap deja fuera cerca de un 37 % de los
      ejemplos (\((1 - 1/n)^n \to e^{-1}\)), el error sobre ellos (<em>out-of-bag</em>) estima el de generalización sin validación
      aparte.</p>

      <h2>Boosting</h2>
      <p>AdaBoost (Freund y Schapire, 1997) mantiene pesos \(w_i\) sobre los ejemplos, con \(y_i \in \{-1, +1\}\):</p>
      <pre><code>w_i ← 1/n
para t ← 1 hasta T:
    h_t ← clasificador débil de menor error ponderado ε_t
    α_t ← ½ ln((1 − ε_t) / ε_t)
    w_i ← w_i · exp(−α_t y_i h_t(x_i)),  y normalizar
F(x) = Σ_t α_t h_t(x);   predecir signo(F(x))</code></pre>
      <div class="recuadro"><strong>Cota del error de entrenamiento.</strong> Si cada clasificador débil es mejor que el azar,
      \(\varepsilon_t = \tfrac12 - \gamma_t\), entonces
      \[ \text{error}_{\text{ent}} \le \prod_{t} 2\sqrt{\varepsilon_t (1 - \varepsilon_t)} \le \exp\Big(-2 \sum_t \gamma_t^2\Big), \]
      que tiende a cero exponencialmente rápido.</div>
      <p>AdaBoost minimiza en forma codiciosa la pérdida exponencial \(\sum_i e^{-y_i F(x_i)}\). <strong>Gradient boosting</strong>
      (Friedman, 2001) generaliza la idea a cualquier pérdida derivable: cada árbol nuevo se ajusta al gradiente negativo de la
      pérdida, es decir, a los residuos del ensamble actual. Sus implementaciones (XGBoost, LightGBM) son el estado del arte en
      datos tabulares.</p>

      <table>
        <thead><tr><th></th><th>Random forest</th><th>Boosting</th></tr></thead>
        <tbody>
          <tr><td>Árboles</td><td>profundos, independientes</td><td>poco profundos, en secuencia</td></tr>
          <tr><td>Reduce sobre todo</td><td>varianza</td><td>sesgo</td></tr>
          <tr><td>Paralelizable</td><td>sí</td><td>no (cada árbol depende del anterior)</td></tr>
          <tr><td>Riesgo de sobreajuste al agregar árboles</td><td>no aumenta</td><td>sí, se controla con la tasa de aprendizaje y el número de rondas</td></tr>
        </tbody>
      </table>`,
  });
})();
