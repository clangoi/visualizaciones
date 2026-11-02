(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos de ejemplo: solicitudes de crédito (generados con semilla) ---------- */

  const ATR = [
    { k: 'monto', corto: 'monto', n: 'monto (miles)', tipo: 'num', cuando: 'al recibir' },
    { k: 'puntaje', corto: 'puntaje', n: 'puntaje', tipo: 'num', cuando: 'al evaluar riesgo' },
    { k: 'nuevo', n: 'cliente nuevo', tipo: 'bin', cuando: 'al recibir' },
    { k: 'web', n: 'canal web', tipo: 'bin', cuando: 'al recibir' },
    { k: 'carga', corto: 'carga', n: 'carga analista', tipo: 'num', cuando: 'al evaluar riesgo' },
    { k: 'ingreso', corto: 'ingreso', n: 'ingreso (miles)', tipo: 'num', cuando: 'al recibir' },
  ];
  const RAMAS1 = ['Aprobar directo', 'Revisión manual', 'Rechazar'];
  const RAMAS2 = ['Aprobar', 'Rechazar'];
  const CORTO1 = ['Directo', 'Manual', 'Rechazo'];
  const COL1 = [C.s6, C.s1, C.s8], COL2 = [C.s6, C.s8];
  const DUR = { 'Recibir solicitud': 5, 'Verificar identidad': 60, 'Pedir documentos': 120, 'Evaluar riesgo': 25, 'Aprobar directo': 3, 'Revisión manual': 90, Aprobar: 15, Rechazar: 8, Notificar: 4 };
  // Regla de negocio verdadera (sin ruido) de cada punto de decisión.
  const verdad1 = (c) => (c.puntaje < 540 ? 2 : c.monto <= 20 && c.puntaje >= 660 ? 0 : 1);
  const verdad2 = (c) => (c.puntaje >= 600 && (!c.nuevo || c.monto <= 30) ? 0 : 1);

  // o: { ruido (prob. de que la decisión real se desvíe de la regla), extras (actividades opcionales), espera (min) }.
  function solicitudes(n, semilla, o = {}) {
    const rnd = VIZ.semilla(semilla), g = () => VIZ.normal(rnd);
    const exp = (m) => -Math.log(1 - rnd()) * m;
    const ruido = o.ruido || 0;
    const desviar = (r, K) => (rnd() < ruido ? (r + 1 + Math.floor(rnd() * (K - 1))) % K : r);
    const sal = [];
    let reloj = 0;
    for (let i = 0; i < n; i++) {
      const c = { id: 'S' + String(i + 1).padStart(3, '0') };
      c.monto = +(2 * Math.pow(30, rnd())).toFixed(1);
      c.puntaje = Math.round(Math.max(300, Math.min(850, 640 + 90 * g())));
      c.nuevo = rnd() < 0.4 ? 1 : 0;
      c.web = rnd() < 0.55 ? 1 : 0;
      c.carga = Math.round(10 + 90 * rnd());
      c.ingreso = +Math.max(5, 15 + 0.1 * (c.puntaje - 300) + 4 * g()).toFixed(1);
      c.r1 = desviar(verdad1(c), 3);
      c.r2 = c.r1 === 1 ? desviar(verdad2(c), 2) : -1;
      const uId = rnd(), uDoc = rnd();
      const acts = ['Recibir solicitud'];
      if (o.extras && uId < (c.nuevo ? 0.6 : 0.05)) acts.push('Verificar identidad');
      if (o.extras && uDoc < (c.web ? 0.45 : 0.1)) acts.push('Pedir documentos');
      acts.push('Evaluar riesgo', RAMAS1[c.r1]);
      if (c.r1 === 1) acts.push(RAMAS2[c.r2]);
      acts.push('Notificar');
      reloj += exp(20);
      let t = reloj;
      c.eventos = acts.map((a) => { const ini = t + exp(o.espera === undefined ? 30 : o.espera); const fin = ini + Math.max(1, DUR[a] * (0.75 + 0.5 * rnd())); t = fin; return { act: a, ini, fin }; });
      c.dur = t - reloj;
      c.nEventos = acts.length;
      c.montoAprob = c.r1 === 0 || (c.r1 === 1 && c.r2 === 0) ? c.monto : 0;
      sal.push(c);
    }
    return sal;
  }

  /* ---------- Árboles de decisión (impureza, ganancia, crecimiento, reglas) ---------- */

  const lg2 = (x) => Math.log(x) / Math.LN2;
  const NOMCRIT = { gini: 'Gini', entropia: 'entropía' };
  function impureza(cnt, crit) {
    const n = cnt.reduce((s, v) => s + v, 0);
    if (!n) return 0;
    if (crit === 'gini') return 1 - cnt.reduce((s, v) => s + (v / n) * (v / n), 0);
    return -cnt.reduce((s, v) => s + (v ? (v / n) * lg2(v / n) : 0), 0);
  }
  const contar = (filas, yf, K) => { const c = Array(K).fill(0); for (const f of filas) c[yf(f)]++; return c; };
  const argmax = (a) => a.indexOf(Math.max(...a));

  // Todos los cortes «atributo ≤ t» de un atributo, con su ganancia: [{ t, gan, nl, nr, izq, der }].
  function barrer(filas, yf, K, k, crit, minHoja = 1) {
    const s = filas.slice().sort((a, b) => a[k] - b[k]);
    const n = s.length, tot = contar(s, yf, K), I0 = impureza(tot, crit);
    const izq = Array(K).fill(0), res = [];
    for (let i = 0; i < n - 1; i++) {
      izq[yf(s[i])]++;
      if (s[i][k] === s[i + 1][k]) continue;
      const nl = i + 1, nr = n - nl;
      if (nl < minHoja || nr < minHoja) continue;
      const der = tot.map((v, j) => v - izq[j]);
      res.push({ t: (s[i][k] + s[i + 1][k]) / 2, gan: I0 - (nl / n) * impureza(izq, crit) - (nr / n) * impureza(der, crit), nl, nr, izq: izq.slice(), der });
    }
    return res;
  }
  function mejorCorte(filas, yf, K, atrs, crit, minHoja) {
    let mejor = null;
    for (const k of atrs) for (const c of barrer(filas, yf, K, k, crit, minHoja)) if (!mejor || c.gan > mejor.gan + 1e-12) mejor = { ...c, k };
    return mejor;
  }
  const nuevoNodo = (filas, prof, yf, K) => { const cnt = contar(filas, yf, K); return { filas, prof, cnt, n: filas.length, clase: argmax(cnt), hijos: null, corte: null }; };
  // cfg: { yf, K, atrs, crit, maxProf, minHoja, minGan }
  function dividir(nd, cfg) {
    if (nd.prof >= cfg.maxProf || nd.n < 2 * cfg.minHoja || impureza(nd.cnt, cfg.crit) < 1e-12) return false;
    const m = mejorCorte(nd.filas, cfg.yf, cfg.K, cfg.atrs, cfg.crit, cfg.minHoja);
    if (!m || m.gan <= (cfg.minGan || 0)) return false;
    nd.corte = m;
    nd.hijos = [nd.filas.filter((c) => c[m.k] <= m.t), nd.filas.filter((c) => c[m.k] > m.t)].map((f) => nuevoNodo(f, nd.prof + 1, cfg.yf, cfg.K));
    return true;
  }
  function crecer(filas, cfg) {
    const raiz = nuevoNodo(filas, 0, cfg.yf, cfg.K), cola = [raiz];
    while (cola.length) { const nd = cola.shift(); if (dividir(nd, cfg)) cola.push(...nd.hijos); }
    return raiz;
  }
  function hoja(raiz, c) { let nd = raiz; while (nd.hijos) nd = c[nd.corte.k] <= nd.corte.t ? nd.hijos[0] : nd.hijos[1]; return nd; }
  const exactitud = (raiz, filas, yf) => (filas.length ? filas.filter((c) => hoja(raiz, c).clase === yf(c)).length / filas.length : NaN);
  function listaHojas(nd, camino = [], sal = []) {
    if (!nd.hijos) sal.push({ nd, camino });
    else { listaHojas(nd.hijos[0], camino.concat([[nd.corte, 0]]), sal); listaHojas(nd.hijos[1], camino.concat([[nd.corte, 1]]), sal); }
    return sal;
  }
  const atr = (k) => ATR.find((a) => a.k === k);
  const fnum = (t) => VIZ.fmt(t, 4);
  // Texto de una condición de un corte; lado 0 = «≤ t» (o «no»), lado 1 = «&gt; t» (o «sí»).
  function textoCorte(corte, lado) {
    const a = atr(corte.k);
    if (a.tipo === 'bin') return `${a.n} = ${lado ? 'sí' : 'no'}`;
    return `${a.n.replace(/ \(.*\)/, '')} ${lado ? '>' : '≤'} ${fnum(corte.t)}`;
  }
  // Regla legible de un camino: junta las condiciones de un mismo atributo en un intervalo.
  function textoRegla(camino) {
    const lim = new Map();
    for (const [corte, lado] of camino) {
      const l = lim.get(corte.k) || { lo: -Infinity, hi: Infinity };
      if (lado) l.lo = Math.max(l.lo, corte.t); else l.hi = Math.min(l.hi, corte.t);
      lim.set(corte.k, l);
    }
    const partes = [];
    for (const [k, l] of lim) {
      const a = atr(k), nom = a.n.replace(/ \(.*\)/, '');
      if (a.tipo === 'bin') partes.push(`${nom} = ${l.lo > -Infinity ? 'sí' : 'no'}`);
      else if (l.lo > -Infinity && l.hi < Infinity) partes.push(`${fnum(l.lo)} < ${nom} ≤ ${fnum(l.hi)}`);
      else if (l.lo > -Infinity) partes.push(`${nom} > ${fnum(l.lo)}`);
      else partes.push(`${nom} ≤ ${fnum(l.hi)}`);
    }
    return partes.length ? partes.join(' y ') : 'siempre';
  }
  const media = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const pct = (v, dig = 3) => (Number.isFinite(v) ? VIZ.fmt(100 * v, dig) + ' %' : '—');
  // Etiqueta corta de un corte para un nodo de árbol; en pantallas estrechas se compacta.
  function etiquetaCorte(corte, estrecho) {
    const a = atr(corte.k);
    if (a.tipo === 'bin') return estrecho ? a.k : a.n;
    return estrecho ? `${a.corto}≤${VIZ.fmt(corte.t, 3)}` : `${a.corto} ≤ ${fnum(corte.t)}`;
  }

  const yRama = (c) => c.r1;
  const NUMERICOS = ATR.filter((a) => a.tipo === 'num');
  const sumar = (a) => a.reduce((s, v) => s + v, 0);
  // Ganancia de un corte a partir de los conteos por clase de cada lado.
  function ganDe(izq, der, crit) {
    const n = sumar(izq) + sumar(der), tot = izq.map((v, j) => v + der[j]);
    return impureza(tot, crit) - (sumar(izq) / n) * impureza(izq, crit) - (sumar(der) / n) * impureza(der, crit);
  }

  /* ---------- Fig. 1: impureza y ganancia de un corte ---------- */

  function montarCorte(cuerpo) {
    let semilla = 2, k = 'puntaje', crit = 'gini', filas = [], cand = [], cur = null, mejor = null, hover = null, plano = null, geoC = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Atributo', opciones: NUMERICOS.map((a) => [a.k, a.n]), valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.selector({ etiqueta: 'Criterio', opciones: [['gini', 'impureza de Gini'], ['entropia', 'entropía']], valor: crit, alCambiar: (v) => { crit = v; calcular(); } });
    const rq = ctl.rango({ etiqueta: 'Posición del corte', min: 2, max: 98, valor: 40, formato: (v) => `percentil ${v}`, alCambiar: () => { elegir(); dibujar(); } });
    ctl.boton('Mejor corte', () => { rq.valor = Math.max(2, Math.min(98, Math.round(100 * mejor.nl / filas.length))); elegir(mejor); dibujar(); }, { primario: true });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 230, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Cómo queda repartida la decisión a cada lado del corte (el ancho es proporcional a los casos)');
    const comp = VIZ.lienzo(cuerpo, { altoFn: () => 124 });
    const tip2 = VIZ.tooltip(comp);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'aprobar directo' }, { color: C.s1, texto: 'revisión manual' }, { color: C.s8, texto: 'rechazar' },
      { color: C.s1, texto: 'ganancia de cada corte posible', forma: 'linea' }, { color: C.s2, texto: 'corte elegido', forma: 'linea' }, { color: C.s6, texto: 'mejor corte', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el corte con el control o haga clic en la curva. La ganancia es la impureza del padre menos la de los hijos ponderada por su tamaño; el mejor corte es el máximo de la curva. Pase el cursor por la curva o por las barras para ver los valores.');

    function calcular() {
      filas = solicitudes(300, semilla, { ruido: 0.05 });
      cand = barrer(filas, yRama, 3, k, crit, 5);
      mejor = cand.reduce((m, c) => (c.gan > m.gan ? c : m), cand[0]);
      elegir(); dibujar();
    }
    // Corte actual: el candidato cuya fracción de casos a la izquierda se acerca más al percentil.
    function elegir(c) {
      if (c) { cur = c; return; }
      const objetivo = rq.valor / 100 * filas.length;
      cur = cand.reduce((m, x) => (Math.abs(x.nl - objetivo) < Math.abs(m.nl - objetivo) ? x : m), cand[0]);
    }
    function dibujar() {
      if (!cur) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const vals = filas.map((c) => c[k]), xmin = Math.min(...vals), xmax = Math.max(...vals), ymax = Math.max(mejor.gan * 1.15, 1e-6);
      plano = VIZ.plano(lienzo, { xmin, xmax, ymin: 0, ymax }, { etiquetaX: atr(k).n, etiquetaY: `ganancia (${NOMCRIT[crit]})`, formatoY: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      VIZ.trazar(lienzo.ctx, plano, cand.map((c) => [c.t, c.gan]), C.s1, 2);
      ctx.save(); ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(plano.sx(cur.t), plano.y0); ctx.lineTo(plano.sx(cur.t), plano.y1); ctx.stroke(); ctx.restore();
      VIZ.marcador(ctx, plano.sx(cur.t), plano.sy(cur.gan), C.s2, 5);
      VIZ.marcador(ctx, plano.sx(mejor.t), plano.sy(mejor.gan), C.s6, 5, 6);
      if (hover) VIZ.marcador(ctx, plano.sx(hover.t), plano.sy(hover.gan), C.tinta, 4);
      dibujarComp();
      const tot = cur.izq.map((v, j) => v + cur.der[j]);
      registro.textContent = cur === mejor || cur.t === mejor.t
        ? `Corte «${atr(k).n} ≤ ${fnum(cur.t)}»: es el mejor posible. Reduce la impureza de ${VIZ.fmt(impureza(tot, crit), 3)} a ${VIZ.fmt(impureza(tot, crit) - cur.gan, 3)} en promedio ponderado.`
        : `Corte «${atr(k).n} ≤ ${fnum(cur.t)}»: ganancia ${VIZ.fmt(cur.gan, 3)}, el ${pct(cur.gan / mejor.gan, 3)} de la del mejor corte (${fnum(mejor.t)}).`;
      lectura.set([
        ['impureza del padre', VIZ.fmt(impureza(tot, crit), 3)],
        [`hijo ≤ (${cur.nl} casos)`, VIZ.fmt(impureza(cur.izq, crit), 3)],
        [`hijo > (${cur.nr} casos)`, VIZ.fmt(impureza(cur.der, crit), 3)],
        ['ganancia del corte', VIZ.fmt(cur.gan, 3)],
        ['mejor ganancia', `${VIZ.fmt(mejor.gan, 3)} en ${fnum(mejor.t)}`],
      ]);
    }
    function dibujarComp() {
      const { ctx, ancho: W } = comp;
      comp.limpiar();
      const izq = Math.min(100, W * 0.3), anchoMax = W - izq - 8, N = filas.length;
      const tot = cur.izq.map((v, j) => v + cur.der[j]);
      const rows = [[`todos (${N})`, tot], [`≤ ${fnum(cur.t)} (${cur.nl})`, cur.izq], [`> ${fnum(cur.t)} (${cur.nr})`, cur.der]];
      geoC = [];
      rows.forEach(([nom, cn], i) => {
        const y = 6 + i * 38;
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(nom, izq - 8, y + 15);
        let x = izq;
        cn.forEach((v, j) => {
          if (!v) return;
          const w = anchoMax * v / N;
          ctx.fillStyle = COL1[j]; ctx.fillRect(x, y, Math.max(1, w - 1), 30);
          if (w > 30) { ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.fillText(String(v), x + w / 2, y + 15); }
          geoC.push({ x, y, w, j, v, nom, tot: sumar(cn) });
          x += w;
        });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
    lienzo.alDibujar = dibujar;
    comp.alDibujar = () => cur && dibujarComp();
    const cercano = (x) => { const t = plano.ix(x); return cand.reduce((m, c) => (Math.abs(c.t - t) < Math.abs(m.t - t) ? c : m), cand[0]); };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = cercano(x);
      dibujar();
      tip.mostrar(x, y, `corte ≤ <b>${fnum(hover.t)}</b><br>izquierda <b>${hover.nl}</b> · derecha <b>${hover.nr}</b>${VIZ.filaTooltip(C.s1, 'ganancia Gini', VIZ.fmt(ganDe(hover.izq, hover.der, 'gini'), 3))}${VIZ.filaTooltip(C.s2, 'ganancia entropía', VIZ.fmt(ganDe(hover.izq, hover.der, 'entropia'), 3))}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) return;
      const c = cercano(x);
      rq.valor = Math.max(2, Math.min(98, Math.round(100 * c.nl / filas.length)));
      elegir(c); dibujar();
    });
    comp.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = comp.posicion(ev), s = geoC.find((g) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + 30);
      if (!s) return tip2.ocultar();
      tip2.mostrar(x, y, `${s.nom}<br>${VIZ.filaTooltip(COL1[s.j], RAMAS1[s.j], `${s.v} (${pct(s.v / s.tot, 3)})`)}`);
    });
    comp.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: el árbol crece paso a paso ---------- */

  function montarCrecer(cuerpo) {
    let crit = 'gini', maxProf = 3, minHoja = 10, semilla = 1, raiz = null, cola = [], actual = null, msg = '', contador = 0, geo = null, todos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Criterio', opciones: [['gini', 'impureza de Gini'], ['entropia', 'entropía']], valor: crit, alCambiar: (v) => { crit = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Profundidad máxima', min: 1, max: 3, valor: maxProf, alCambiar: (v) => { maxProf = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Casos mínimos por hoja', min: 5, max: 40, paso: 5, valor: minHoja, alCambiar: (v) => { minHoja = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos casos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'aprobar directo' }, { color: C.s1, texto: 'revisión manual' }, { color: C.s8, texto: 'rechazar' },
      { color: C.superficie, borde: C.inactivo, texto: 'nodo pendiente (color de su clase mayoritaria)' }, { color: C.superficie, borde: C.tinta, texto: 'nodo ya dividido' }, { color: C.s2, texto: 'nodo en evaluación', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En cada nodo el algoritmo prueba todos los cortes de todos los atributos y elige el de mayor ganancia (primer paso: evaluar; segundo: dividir). Una hoja muestra su clase mayoritaria y cuántos de sus casos la cumplen. Pase el cursor sobre un nodo para ver su composición.');
    const cfg = () => ({ yf: yRama, K: 3, atrs: ATR.map((a) => a.k), crit, maxProf, minHoja, minGan: 1e-9 });

    function iniciar() {
      const c = cfg();
      const filas = solicitudes(300, semilla * 7 + 1, { ruido: 0.05 });
      raiz = nuevoNodo(filas, 0, yRama, 3); raiz.id = 'n0'; raiz.estado = 'pendiente';
      contador = 1; cola = [raiz]; actual = null; todos = [raiz];
      msg = `Un solo nodo con ${filas.length} casos: lo mejor que puede hacer es predecir «${RAMAS1[raiz.clase]}» (${pct(raiz.cnt[raiz.clase] / raiz.n, 3)} de aciertos). Pulse «Un paso».`;
      return (function* () {
        while (cola.length) {
          const nd = cola.shift();
          actual = nd; nd.estado = 'evaluando';
          const puede = nd.prof < c.maxProf && nd.n >= 2 * c.minHoja && impureza(nd.cnt, crit) > 1e-12;
          const m = puede ? mejorCorte(nd.filas, yRama, 3, c.atrs, crit, c.minHoja) : null;
          nd.propuesta = m;
          msg = m && m.gan > c.minGan
            ? `Nodo de ${nd.n} casos con impureza ${VIZ.fmt(impureza(nd.cnt, crit), 3)}. Mejor corte entre ${c.atrs.length} atributos: «${textoCorte(m, 0)}», ganancia ${VIZ.fmt(m.gan, 3)} (hijos de ${m.nl} y ${m.nr} casos).`
            : `Nodo de ${nd.n} casos: no se divide (${nd.prof >= c.maxProf ? 'alcanzó la profundidad máxima' : nd.n < 2 * c.minHoja ? 'quedaría una hoja con menos casos que el mínimo' : impureza(nd.cnt, crit) <= 1e-12 ? 'es puro' : 'ningún corte reduce la impureza'}).`;
          yield;
          nd.propuesta = null;
          if (m && m.gan > c.minGan && dividir(nd, c)) {
            nd.estado = 'dividido';
            nd.hijos.forEach((h) => { h.id = 'n' + contador++; h.estado = 'pendiente'; todos.push(h); });
            cola.push(...nd.hijos);
            msg = `Se divide con «${textoCorte(nd.corte, 0)}»: ${nd.hijos[0].n} casos cumplen la condición y ${nd.hijos[1].n} no. Los dos hijos quedan pendientes.`;
          } else { nd.estado = 'hoja'; msg += ' Queda como hoja.'; }
          actual = null;
          yield;
        }
        msg = `Árbol terminado: ${todos.filter((x) => !x.hijos).length} hojas, exactitud de entrenamiento ${pct(exactitud(raiz, raiz.filas, yRama), 3)}.`;
      })();
    }
    const etiquetaNodo = (nd) => {
      const est = lienzo.ancho < 520;
      if (nd.hijos) return etiquetaCorte(nd.corte, est);
      if (nd.estado === 'hoja') return est ? `${CORTO1[nd.clase]} ${Math.round(100 * nd.cnt[nd.clase] / nd.n)}%` : `${CORTO1[nd.clase]} ${nd.cnt[nd.clase]}/${nd.n}`;
      return est ? `n=${nd.n}` : `n = ${nd.n}`;
    };
    function dibujar() {
      lienzo.limpiar();
      if (!raiz) return;
      const nodos = [], aristas = [];
      (function rec(nd) {
        const col = COL1[nd.clase], ev = nd.estado === 'evaluando';
        nodos.push({
          id: nd.id, tipo: 'act', etiqueta: etiquetaNodo(nd),
          relleno: nd.estado === 'hoja' ? VIZ.alfa(col, 0.22) : nd.estado === 'pendiente' || ev ? VIZ.alfa(col, 0.08) : C.superficie,
          borde: nd.estado === 'hoja' ? col : nd.estado === 'dividido' ? C.tinta : C.inactivo,
          anillo: ev ? C.s2 : null, colorTexto: nd.estado === 'pendiente' ? C.tinta2 : C.tinta,
        });
        if (nd.hijos) {
          const bin = atr(nd.corte.k).tipo === 'bin';
          nd.hijos.forEach((h, i) => { aristas.push({ de: nd.id, a: h.id, etiqueta: (bin ? ['no', 'sí'] : ['sí', 'no'])[i], color: C.apagado }); rec(h); });
        }
      })(raiz);
      const pos = P.disponer(nodos.map((x) => x.id), aristas.map((e) => [e.de, e.a]));
      geo = P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: lienzo.ancho < 520 ? 44 : 60, margenY: 26, fuente: lienzo.ancho < 520 ? 9 : 10 });
      const hs = todos.filter((x) => !x.hijos), N = raiz.n;
      registro.textContent = msg;
      lectura.set([
        ['nodos', String(todos.length)],
        ['hojas actuales', String(hs.length)],
        ['impureza ponderada de las hojas', VIZ.fmt(sumar(hs.map((h) => (h.n / N) * impureza(h.cnt, crit))), 3)],
        ['exactitud de entrenamiento', pct(exactitud(raiz, raiz.filas, yRama), 3)],
      ]);
    }
    lienzo.alDibujar = () => raiz && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), nd = geo && P.nodoEn(geo, x, y);
      if (!nd) return tip.ocultar();
      const t = todos.find((q) => q.id === nd.id);
      tip.mostrar(x, y, `<b>${t.n}</b> casos (profundidad ${t.prof})${t.cnt.map((v, j) => VIZ.filaTooltip(COL1[j], RAMAS1[j], `${v} (${pct(v / t.n, 2)})`)).join('')}impureza ${VIZ.fmt(impureza(t.cnt, crit), 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: reglas legibles y sobreajuste ---------- */

  function montarReglas(cuerpo) {
    let ruido = 0.15, prof = 3, minHoja = 5, semilla = 1, arboles = [], ent = [], pru = [], ref = 0, hover = -1, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Desvíos de la regla', min: 0, max: 0.4, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    const rp = ctl.rango({ etiqueta: 'Profundidad máxima', min: 1, max: 8, valor: prof, alCambiar: (v) => { prof = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Casos mínimos por hoja', min: 1, max: 30, valor: minHoja, alCambiar: (v) => { minHoja = v; calcular(); } });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'exactitud en entrenamiento (400 casos)', forma: 'linea' }, { color: C.s2, texto: 'exactitud en prueba (200 casos nuevos)', forma: 'linea' },
      { color: C.apagado, texto: 'regla verdadera, con los desvíos', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada hoja del árbol elegido es una regla «SI … ENTONCES …». Suba los desvíos de la regla y la profundidad: el árbol memoriza los desvíos (sube en entrenamiento) y falla con casos nuevos. Haga clic en la curva para elegir la profundidad.');

    function calcular() {
      const sol = solicitudes(600, semilla * 13 + 5, { ruido });
      const tr = sol.slice(0, 400), te = sol.slice(400);
      const cfg = (d) => ({ yf: yRama, K: 3, atrs: ATR.map((a) => a.k), crit: 'gini', maxProf: d, minHoja, minGan: 1e-9 });
      arboles = Array.from({ length: 9 }, (_, d) => crecer(tr, cfg(d)));
      ent = arboles.map((a) => exactitud(a, tr, yRama));
      pru = arboles.map((a) => exactitud(a, te, yRama));
      ref = te.filter((c) => verdad1(c) === c.r1).length / te.length;
      dibujar();
    }
    function dibujar() {
      if (!arboles.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const lo = Math.max(0, Math.floor(Math.min(...ent, ...pru, ref) * 20 - 1) / 20);
      plano = VIZ.plano(lienzo, { xmin: -0.3, xmax: 8.3, ymin: lo, ymax: 1.02 }, { etiquetaX: 'profundidad máxima', etiquetaY: 'exactitud', ticksX: [0, 1, 2, 3, 4, 5, 6, 7, 8], formatoX: (v) => String(v), formatoY: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(ref)); ctx.lineTo(plano.x1, plano.sy(ref)); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.strokeStyle = VIZ.alfa(C.s2, 0.5); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(plano.sx(prof), plano.y0); ctx.lineTo(plano.sx(prof), plano.y1); ctx.stroke(); ctx.restore();
      VIZ.trazar(ctx, plano, ent.map((v, d) => [d, v]), C.s1, 2);
      VIZ.trazar(ctx, plano, pru.map((v, d) => [d, v]), C.s2, 2);
      ent.forEach((v, d) => { VIZ.marcador(ctx, plano.sx(d), plano.sy(v), C.s1, d === hover || d === prof ? 5 : 3.5); VIZ.marcador(ctx, plano.sx(d), plano.sy(pru[d]), C.s2, d === hover || d === prof ? 5 : 3.5, 1); });
      // Reglas del árbol elegido.
      const hs = listaHojas(arboles[prof]).sort((a, b) => b.nd.n - a.nd.n);
      lista.replaceChildren(...hs.map(({ nd, camino }) => VIZ.el('div', null,
        VIZ.el('span', { class: 'ficha', style: { borderColor: COL1[nd.clase] } }, CORTO1[nd.clase]),
        ` SI ${textoRegla(camino)}   (${nd.n} casos, ${pct(nd.cnt[nd.clase] / nd.n, 3)} de acierto)`)));
      const mejorD = pru.reduce((m, v, d) => (v > pru[m] + 1e-9 ? d : m), 0);
      registro.textContent = prof > mejorD && ent[prof] - pru[prof] > 0.03
        ? `Con profundidad ${prof} el árbol acierta ${pct(ent[prof], 3)} en entrenamiento pero solo ${pct(pru[prof], 3)} en casos nuevos: aprendió desvíos, no la regla. La mejor profundidad en prueba fue ${mejorD}.`
        : `Con profundidad ${prof} el árbol tiene ${hs.length} reglas y acierta ${pct(pru[prof], 3)} en casos nuevos; el techo es la regla verdadera, ${pct(ref, 3)}, porque el resto son desvíos.`;
      lectura.set([
        ['reglas (hojas)', String(hs.length)],
        ['exactitud en entrenamiento', pct(ent[prof], 3)],
        ['exactitud en prueba', pct(pru[prof], 3)],
        ['regla verdadera', pct(ref, 3)],
        ['mejor profundidad en prueba', String(mejorD)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const prof_ = (x) => Math.max(0, Math.min(8, Math.round(plano.ix(x))));
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = prof_(x); dibujar();
      tip.mostrar(x, y, `profundidad <b>${hover}</b> (${listaHojas(arboles[hover]).length} hojas)${VIZ.filaTooltip(C.s1, 'entrenamiento', pct(ent[hover], 3))}${VIZ.filaTooltip(C.s2, 'prueba', pct(pru[hover], 3))}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) return;
      prof = Math.max(1, prof_(x)); rp.valor = prof; dibujar();
    });
    calcular();
  }

  VIZ.registrarTema('decision-rules', {
    intro: String.raw`
      <p>Una vez identificado un punto de decisión, se puede preguntar si la rama elegida se deduce de los datos del caso. Un
      <strong>árbol de decisión</strong> responde con reglas legibles: divide los casos con preguntas como «¿puntaje ≤ 540?» hasta que
      cada grupo elija casi siempre la misma rama. Cada hoja es una regla de enrutamiento: <em>SI condiciones ENTONCES rama</em>.</p>
      <p>Para elegir cada pregunta se mide cuánto baja la <em>impureza</em> (qué tan mezcladas están las ramas). Entrenar bien es encontrar el
      punto medio entre reglas demasiado simples y reglas que memorizan los desvíos de los datos.</p>`,
    visualizaciones: [
      {
        titulo: 'Impureza y ganancia de un corte',
        descripcion: 'La curva da la ganancia de cada posible corte de un atributo y las barras muestran cómo queda repartida la decisión. Pruebe «Mejor corte» con cada atributo y cambie entre Gini y entropía: las escalas difieren, pero los cortes que más ganan son parecidos.',
        montar: montarCorte,
      },
      {
        titulo: 'El árbol crece paso a paso',
        descripcion: 'Avance con «Un paso»: cada nodo se evalúa y se divide con el corte de mayor ganancia. Reduzca la profundidad o suba los casos mínimos por hoja y observe cómo se detiene antes y qué pasa con la impureza de las hojas.',
        montar: montarCrecer,
      },
      {
        titulo: 'Reglas legibles y sobreajuste',
        descripcion: 'Entrena con 400 casos y prueba con 200 nuevos. Con desvíos del 15 % o más, suba la profundidad: la exactitud en entrenamiento sigue subiendo, la de prueba se queda atrás de la regla verdadera.',
        montar: montarReglas,
      },
    ],
    teoria: String.raw`
      <h2>El problema</h2>
      <p>En un punto de decisión (ver <a href="tema.html?id=decision-points">puntos de decisión</a>) cada caso \(i\) aporta un vector de atributos
      \(\mathbf{x}_i\) y la rama elegida \(y_i \in \{1, \dots, K\}\). Se busca una función \(f(\mathbf{x})\) cuyas condiciones se puedan leer como reglas
      de enrutamiento. Los árboles de decisión lo hacen con particiones sucesivas del espacio de atributos.</p>
      <h2>Impureza</h2>
      <p>Para un nodo donde la fracción de casos de la rama \(j\) es \(p_j\):</p>
      \[ \text{Gini} = 1 - \sum_{j=1}^{K} p_j^2, \qquad H = -\sum_{j=1}^{K} p_j \log_2 p_j. \]
      <p>Ambas valen 0 en un nodo puro y son máximas cuando las ramas se reparten por igual (Gini \(= 1 - 1/K\); \(H = \log_2 K\)).</p>
      <h2>Ganancia de un corte</h2>
      <p>Un corte «atributo \(\le t\)» divide los \(n\) casos del nodo en \(L\) (con \(n_L\) casos) y \(R\) (con \(n_R\)). Su ganancia es</p>
      \[ G(t) = I(\text{nodo}) - \frac{n_L}{n} I(L) - \frac{n_R}{n} I(R), \]
      <p>con \(I\) = Gini o entropía; con entropía es la <em>ganancia de información</em>. Para un atributo numérico solo hace falta probar los puntos medios
      entre valores consecutivos distintos: ordenando una vez, se recorren los \(n - 1\) cortes manteniendo los conteos por clase.</p>
      <h2>Algoritmo</h2>
      <pre><code>crecer(nodo, profundidad):
    si profundidad = máxima, o el nodo es puro, o n &lt; 2 · mínimo por hoja:
        devolver hoja(clase mayoritaria)
    (a*, t*) ← argmax de G sobre todos los atributos y cortes
    si G(a*, t*) ≤ 0: devolver hoja(clase mayoritaria)
    L ← casos con a* ≤ t*;   R ← casos con a* &gt; t*
    devolver nodo(a*, t*, crecer(L, profundidad + 1), crecer(R, profundidad + 1))</code></pre>
      <p>El costo de cada nivel es \(O(m\, n \log n)\) con \(m\) atributos. Es un algoritmo <em>voraz</em>: cada corte se elige por su ganancia
      inmediata y no se revisa después.</p>
      <h2>Reglas y precisión</h2>
      <p>Cada camino de la raíz a una hoja es una regla; las condiciones sobre un mismo atributo se funden en un intervalo
      (\(540 &lt; \text{puntaje} \le 660\)). Su <strong>precisión</strong> es la fracción de los casos de la hoja que eligieron la rama predicha, y la
      <strong>exactitud</strong> del árbol es la fracción de casos bien clasificados:</p>
      \[ \text{exactitud} = \frac{1}{n}\sum_{i} \mathbf{1}\bigl[f(\mathbf{x}_i) = y_i\bigr]. \]
      <h2>Sobreajuste</h2>
      <p>Si se deja crecer el árbol hasta que todas las hojas sean puras, memoriza también los desvíos aleatorios: la exactitud de entrenamiento
      llega a 100 % y la de casos nuevos baja. Se controla con profundidad máxima, mínimo de casos por hoja o poda, y siempre se mide con
      casos que no se usaron para entrenar. Si los datos tienen una fracción \(\varepsilon\) de desvíos que no dependen de los atributos, ninguna
      regla supera una exactitud de \(1 - \varepsilon\) en casos nuevos.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> Un árbol describe correlaciones de los datos observados. Si dos atributos están relacionados
      (ingreso y puntaje) el árbol puede usar cualquiera de los dos; léalo como «lo que predice la rama», no como «lo que causa la rama».
      Véase <a href="tema.html?id=decision-drivers">factores de decisión</a> y <a href="tema.html?id=correlation-causation">correlación y causalidad</a>.</p></div>
      <h2>Conexiones</h2>
      <p>El tema general de clasificación con árboles está en <a href="tema.html?id=decision-trees">árboles de decisión</a>; el equilibrio entre
      reglas simples y complejas, en <a href="tema.html?id=bias-variance">sesgo y varianza</a>. Para comparar dos grupos de casos sin entrenar un modelo,
      vea <a href="tema.html?id=variant-comparison">comparación de variantes</a>.</p>`,
  });
})();
