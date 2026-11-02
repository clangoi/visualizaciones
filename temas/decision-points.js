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

  /* ---------- Fig. 1: el modelo con sus puntos de decisión ---------- */

  const POS = {
    ini: { x: 0.5, y: 0 }, rec: { x: 0.5, y: 1 / 8 }, eva: { x: 0.5, y: 2 / 8 }, x1: { x: 0.5, y: 3 / 8 },
    aut: { x: 0.17, y: 4 / 8 }, man: { x: 0.5, y: 4 / 8 }, rej1: { x: 0.83, y: 4 / 8 },
    x2: { x: 0.5, y: 5 / 8 }, apr: { x: 0.25, y: 6 / 8 }, rej2: { x: 0.75, y: 6 / 8 }, not: { x: 0.5, y: 7 / 8 }, fin: { x: 0.5, y: 1 },
  };
  const ETQ = { rec: 'Recibir solicitud', eva: 'Evaluar riesgo', aut: 'Aprobar directo', man: 'Revisión manual', rej1: 'Rechazar', apr: 'Aprobar', rej2: 'Rechazar', not: 'Notificar' };

  function montarModelo(cuerpo) {
    let n = 300, semilla = 1, ruido = 0.05, punto = 1, rama = -1, sol = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 100, max: 800, paso: 50, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Desvíos de la regla', min: 0, max: 0.3, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.selector({
      etiqueta: 'Punto de decisión', opciones: [['1', '1 · tras evaluar el riesgo'], ['2', '2 · tras la revisión manual']], valor: '1',
      alCambiar: (v) => { punto = +v; rama = -1; dibujar(); },
    });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'aprobación' }, { color: C.s1, texto: 'revisión manual' }, { color: C.s8, texto: 'rechazo' },
      { color: C.superficie, borde: C.tinta, texto: 'rombo: punto de decisión (XOR)' }, { color: C.s2, texto: 'elegido', forma: 'linea' },
    ]);
    const tabla = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(tabla);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un rombo para elegir el punto de decisión, o en una rama (o en una fila de la tabla) para resaltarla. El grosor de cada flecha es proporcional a los casos que la recorren. La tabla compara los atributos medios de los casos de cada rama.');

    const cnt = () => {
      const c1 = contar(sol, (c) => c.r1, 3), man = sol.filter((c) => c.r1 === 1), c2 = contar(man, (c) => c.r2, 2);
      return { c1, c2, man };
    };
    function calcular() { sol = solicitudes(n, semilla, { ruido }); dibujar(); }

    function dibujar() {
      lienzo.limpiar();
      const { c1, c2 } = cnt();
      const N = sol.length, ancho = (k) => 1.5 + 4 * (k / N);
      const cantidad = { ini: N, rec: N, eva: N, x1: N, aut: c1[0], man: c1[1], rej1: c1[2], x2: c1[1], apr: c2[0], rej2: c2[1], not: N, fin: N };
      const idRama = punto === 1 ? ['aut', 'man', 'rej1'] : ['apr', 'rej2'];
      const colRama = { aut: C.s6, man: C.s1, rej1: C.s8, apr: C.s6, rej2: C.s8 };
      const sel = rama >= 0 ? idRama[rama] : null;
      const est = lienzo.ancho < 520, ETQ_C = { ...ETQ, aut: 'Directo', man: 'Manual', rec: 'Recibir', eva: 'Evaluar' };
      const nodos = Object.keys(POS).map((id) => {
        if (id === 'ini') return { id, tipo: 'inicio', relleno: C.s6, borde: C.s6 };
        if (id === 'fin') return { id, tipo: 'fin', borde: C.tinta };
        if (id === 'x1' || id === 'x2') return { id, tipo: 'rombo', etiqueta: '×', anillo: (id === 'x1') === (punto === 1) ? C.s2 : null };
        const col = colRama[id];
        return { id, tipo: 'act', etiqueta: (est ? ETQ_C : ETQ)[id], relleno: col ? VIZ.alfa(col, 0.18) : C.superficie, borde: col || C.tinta, anillo: id === sel ? C.s2 : null };
      });
      const arista = (de, a, extra = {}) => ({ de, a, ancho: ancho(cantidad[a]), color: C.eje, ...extra });
      const ramaE = (de, a, col, ok) => arista(de, a, { color: ok ? C.s2 : col, ancho: ancho(cantidad[a]) + (ok ? 1.5 : 0), etiqueta: lienzo.ancho < 520 ? `${Math.round(100 * cantidad[a] / cantidad[de])}%` : `${cantidad[a]} · ${Math.round(100 * cantidad[a] / cantidad[de])} %`, colorTexto: C.tinta });
      const aristas = [
        arista('ini', 'rec'), arista('rec', 'eva'), arista('eva', 'x1'),
        ramaE('x1', 'aut', C.s6, punto === 1 && sel === 'aut'), ramaE('x1', 'man', C.s1, punto === 1 && sel === 'man'), ramaE('x1', 'rej1', C.s8, punto === 1 && sel === 'rej1'),
        arista('man', 'x2'),
        ramaE('x2', 'apr', C.s6, punto === 2 && sel === 'apr'), ramaE('x2', 'rej2', C.s8, punto === 2 && sel === 'rej2'),
        arista('aut', 'not'), arista('rej1', 'not'), arista('apr', 'not'), arista('rej2', 'not'), arista('not', 'fin'),
      ];
      geo = P.dibujarGrafo(lienzo, nodos, aristas, POS, { margenX: est ? 26 : 22, margenY: 24, fuente: est ? 9 : 10 });
      geo.cant = cantidad;

      // Tabla de la rama elegida.
      const grupos = punto === 1 ? [0, 1, 2].map((r) => sol.filter((c) => c.r1 === r)) : [0, 1].map((r) => sol.filter((c) => c.r1 === 1 && c.r2 === r));
      const nombres = punto === 1 ? RAMAS1 : RAMAS2, cols = punto === 1 ? COL1 : COL2, tot = grupos.reduce((s, g) => s + g.length, 0);
      const filas = grupos.map((g, r) => VIZ.el('tr', { class: 'clicable' + (r === rama ? ' activa' : ''), onclick: () => { rama = rama === r ? -1 : r; dibujar(); } },
        VIZ.el('td', { class: 'izq' }, VIZ.el('span', { class: 'ficha', style: { borderColor: cols[r] } }, nombres[r])),
        VIZ.el('td', null, String(g.length)), VIZ.el('td', null, pct(g.length / tot, 3)),
        VIZ.el('td', null, VIZ.fmt(media(g.map((c) => c.monto)), 3)), VIZ.el('td', null, VIZ.fmt(media(g.map((c) => c.puntaje)), 3)),
        VIZ.el('td', null, pct(media(g.map((c) => c.nuevo)), 2)), VIZ.el('td', null, pct(media(g.map((c) => c.web)), 2))));
      tabla.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ...['rama', 'casos', '% del punto', 'monto medio', 'puntaje medio', '% nuevos', '% web'].map((t, i) => VIZ.el('th', { class: i ? '' : 'izq' }, t))), ...filas));

      const cn = punto === 1 ? c1 : c2;
      const top = argmax(cn);
      const H = impureza(cn, 'entropia');
      registro.textContent = rama >= 0
        ? `«${nombres[rama]}» recibe ${cn[rama]} de ${tot} casos (${pct(cn[rama] / tot, 3)}); su puntaje medio es ${VIZ.fmt(media(grupos[rama].map((c) => c.puntaje)), 3)} frente a ${VIZ.fmt(media(sol.map((c) => c.puntaje)), 3)} en todos los casos.`
        : `El punto ${punto} reparte ${tot} casos en ${nombres.length} ramas; la más usada es «${nombres[top]}» con ${pct(cn[top] / tot, 3)}. Las ramas no se eligen al azar: compare los atributos medios de la tabla.`;
      lectura.set([
        ['casos', String(N)],
        ['casos que pasan por revisión manual', pct(c1[1] / N, 3)],
        [`entropía del punto ${punto} (bits)`, `${VIZ.fmt(H, 3)} de ${VIZ.fmt(lg2(cn.length), 3)}`],
        ['rama más frecuente', nombres[top]],
      ]);
    }
    lienzo.alDibujar = () => sol.length && dibujar();

    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), nd = geo && P.nodoEn(geo, x, y);
      if (!nd) return;
      if (nd.id === 'x1') { punto = 1; rama = -1; }
      else if (nd.id === 'x2') { punto = 2; rama = -1; }
      else if (['aut', 'man', 'rej1'].includes(nd.id)) { punto = 1; rama = ['aut', 'man', 'rej1'].indexOf(nd.id); }
      else if (['apr', 'rej2'].includes(nd.id)) { punto = 2; rama = ['apr', 'rej2'].indexOf(nd.id); }
      else return;
      selPunto.valor = String(punto);
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), nd = geo && P.nodoEn(geo, x, y);
      if (!nd) return tip.ocultar();
      const k = geo.cant[nd.id], nombre = nd.id === 'x1' ? 'punto de decisión 1' : nd.id === 'x2' ? 'punto de decisión 2' : nd.id === 'ini' ? 'inicio' : nd.id === 'fin' ? 'fin' : ETQ[nd.id];
      tip.mostrar(x, y, `<b>${nombre}</b><br>${k} casos (${Math.round(100 * k / sol.length)} % del total)`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    const selPunto = ctl.caja.querySelector('select') ? { set valor(v) { ctl.caja.querySelector('select').value = v; } } : { set valor(v) {} };
    calcular();
  }

  /* ---------- Fig. 2: atributos disponibles al decidir ---------- */

  const POSTERIORES = [
    { k: 'montoAprob', n: 'monto aprobado', cuando: 'al aprobar', post: true },
    { k: 'nEventos', n: 'eventos del caso', cuando: 'al cerrar el caso', post: true },
    { k: 'dur', n: 'duración del caso', cuando: 'al cerrar el caso', post: true },
  ];

  function montarDisponibles(cuerpo) {
    let n = 400, semilla = 3, punto = 1, fugas = false, ruido = 0.05, filas = [], res = [], hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Punto de decisión', opciones: [['1', '1 · tras evaluar el riesgo'], ['2', '2 · tras la revisión manual']], valor: '1', alCambiar: (v) => { punto = +v; calcular(); } });
    ctl.rango({ etiqueta: 'Desvíos de la regla', min: 0, max: 0.3, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.casilla({ etiqueta: 'Incluir atributos que se conocen después de decidir', valor: fugas, alCambiar: (v) => { fugas = v; calcular(); } });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 54 + res.length * 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'se conoce antes de decidir: usable' },
      { color: C.s8, texto: 'se registra después de decidir: fuga de información' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es la ganancia de información (en bits) del mejor corte «atributo ≤ t» sobre la rama elegida. Active la casilla: los atributos que se escriben después de decidir parecen explicarlo todo, pero no existen cuando el caso aún no ha decidido.');

    function calcular() {
      const sol = solicitudes(n, semilla, { ruido });
      filas = punto === 1 ? sol : sol.filter((c) => c.r1 === 1);
      const yf = punto === 1 ? (c) => c.r1 : (c) => c.r2, K = punto === 1 ? 3 : 2;
      const H = impureza(contar(filas, yf, K), 'entropia');
      const lista = ATR.concat(fugas ? POSTERIORES : []);
      res = lista.map((a) => {
        const m = mejorCorte(filas, yf, K, [a.k], 'entropia', 5);
        return { a, gan: m ? m.gan : 0, t: m ? m.t : null, H };
      }).sort((p, q) => q.gan - p.gan);
      lienzo.ajustar(true);
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (!res.length) return;
      const H = res[0].H, izq = Math.min(128, W * 0.36), der = 56, sup = 8, paso = 30, base = sup + res.length * paso;
      geo = { izq, der, sup, paso, H };
      const sx = (v) => izq + (v / Math.max(H, 1e-9)) * (W - izq - der);
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      for (const v of VIZ.ticks(0, H, 4)) {
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(sx(v)) + 0.5, sup); ctx.lineTo(Math.round(sx(v)) + 0.5, base); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.fillText(VIZ.fmt(v, 2), sx(v), base + 6);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`bits (entropía de la decisión: ${VIZ.fmt(H, 3)})`, W - 4, lienzo.alto - 2);
      res.forEach((r, i) => {
        const y = sup + i * paso, col = r.a.post ? C.s8 : C.s1;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11);
        ctx.fillText(r.a.n, izq - 8, y + paso / 2);
        ctx.fillStyle = i === hover ? VIZ.alfa(col, 0.7) : col;
        const w = Math.max(1, sx(r.gan) - izq);
        ctx.beginPath(); ctx.roundRect(izq, y + 5, w, paso - 10, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left';
        ctx.fillText(VIZ.fmt(r.gan, 2), izq + w + 6, y + paso / 2);
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq + 0.5, sup); ctx.lineTo(izq + 0.5, base); ctx.stroke();
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      const usables = res.filter((r) => !r.a.post), post = res.filter((r) => r.a.post);
      const nombres = punto === 1 ? RAMAS1 : RAMAS2;
      registro.textContent = fugas
        ? `«${post[0].a.n}» logra ${VIZ.fmt(post[0].gan, 2)} bits sobre ${VIZ.fmt(res[0].H, 2)}: lo conoce quien ya sabe la rama (${nombres.join(' / ')}), así que no sirve para explicar por qué se eligió.`
        : `Entre los atributos conocidos antes de decidir, «${usables[0].a.n}» explica más (${VIZ.fmt(usables[0].gan, 2)} bits${usables[0].t !== null ? `, mejor corte en ${VIZ.fmt(usables[0].t, 4)}` : ''}); «${usables[usables.length - 1].a.n}» casi nada.`;
      lectura.set([
        ['casos en el punto', String(filas.length)],
        ['entropía de la decisión (bits)', VIZ.fmt(res[0].H, 3)],
        ['mejor atributo usable', `${usables[0].a.n} · ${VIZ.fmt(usables[0].gan, 2)} bits`],
        ['fracción explicada por él', pct(usables[0].gan / Math.max(res[0].H, 1e-9), 3)],
      ]);
    }
    lienzo.alDibujar = () => res.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = geo ? Math.floor((y - geo.sup) / geo.paso) : -1;
      if (i < 0 || i >= res.length) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      if (i !== hover) { hover = i; dibujar(); }
      const r = res[i];
      tip.mostrar(x, y, `<b>${r.a.n}</b><br>ganancia <b>${VIZ.fmt(r.gan, 3)}</b> bits (${pct(r.gan / Math.max(r.H, 1e-9), 2)})<br>${r.t !== null ? `mejor corte: ≤ ${VIZ.fmt(r.t, 4)}<br>` : ''}se conoce <b>${r.a.cuando}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (res.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('decision-points', {
    intro: String.raw`
      <p>En un proceso, algunos caminos se bifurcan: tras evaluar una solicitud de crédito se aprueba, se rechaza o se manda a revisión manual.
      Cada bifurcación es un <strong>punto de decisión</strong>, y la <em>minería de decisiones</em> (<em>decision mining</em>) pregunta
      por qué cada caso tomó la rama que tomó.</p>
      <p>El primer paso es medir: localizar los puntos de decisión en el modelo, contar cuántos casos eligen cada rama y listar qué datos
      tenía el caso <em>en ese momento</em>. Solo con esos datos, y no con los que aparecen después, puede explicarse la decisión.</p>`,
    visualizaciones: [
      {
        titulo: 'Puntos de decisión de un modelo y sus ramas',
        descripcion: 'Haga clic en un rombo o en una rama para ver cuántos casos la recorren y cómo se diferencian sus atributos. Aumente los desvíos de la regla y observe cómo se difuminan las diferencias entre ramas.',
        montar: montarModelo,
      },
      {
        titulo: 'Atributos disponibles al decidir',
        descripcion: 'Mide qué atributos informan sobre la rama elegida. Active los atributos posteriores a la decisión y compare: los que se registran después aparecen como los mejores, pero son una fuga de información.',
        montar: montarDisponibles,
      },
    ],
    teoria: String.raw`
      <h2>Qué es un punto de decisión</h2>
      <p>Un <strong>punto de decisión</strong> es un lugar del modelo donde un caso puede continuar por más de una alternativa excluyente.
      Según el formalismo se reconoce así:</p>
      <ul>
        <li>en <a href="tema.html?id=bpmn-gateways">BPMN</a>, una compuerta exclusiva (XOR) con varias salidas;</li>
        <li>en una <a href="tema.html?id=petri-nets">red de Petri</a>, una plaza \(p\) con al menos dos transiciones de salida, \(|p^{\bullet}| \ge 2\);</li>
        <li>en un <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>, una actividad con varios sucesores distintos.</li>
      </ul>
      <p>Las divisiones paralelas (AND) no son decisiones: todas las ramas se ejecutan. Un bucle sí contiene una: repetir o salir.</p>
      <h2>Frecuencia de cada rama</h2>
      <p>Si en un punto con \(k\) ramas se observan \(n_j\) casos por la rama \(j\), con \(n = \sum_j n_j\), la frecuencia relativa es
      \(\hat{p}_j = n_j / n\). La incertidumbre de la decisión se resume con la <strong>entropía</strong></p>
      \[ H = -\sum_{j=1}^{k} \hat{p}_j \log_2 \hat{p}_j, \qquad 0 \le H \le \log_2 k. \]
      <p>\(H = 0\) cuando todos eligen la misma rama y \(H = \log_2 k\) cuando se reparten por igual. Explicar la decisión significa encontrar
      atributos que reduzcan esa entropía.</p>
      <h2>De registros de eventos a un problema de clasificación</h2>
      <pre><code>para cada caso σ del registro:
    reproducir σ sobre el modelo
    para cada vez que σ pasa por un punto de decisión d:
        x ← atributos conocidos de σ justo antes de d
        y ← rama que σ tomó
        agregar (x, y) al conjunto de datos de d
entrenar un clasificador por cada punto de decisión</code></pre>
      <p>La reproducción necesita alinear cada traza con el modelo (<a href="tema.html?id=token-based-replay">reproducción de fichas</a>
      o <a href="tema.html?id=alignments">alineamientos</a>); sin ella no se sabe qué rama tomó un caso con comportamiento desviado.</p>
      <h2>Atributos disponibles y fuga de información</h2>
      <p>Los atributos pueden ser del caso (monto, canal) o de un evento (el puntaje que escribe <em>Evaluar riesgo</em>). Un atributo solo es
      válido para explicar una decisión si su valor existe antes de ella. La <strong>ganancia de información</strong> de un corte que divide
      los \(n\) casos en \(L\) y \(R\) es</p>
      \[ G = H(\text{padre}) - \frac{|L|}{n} H(L) - \frac{|R|}{n} H(R). \]
      <table>
        <tr><th>Atributo</th><th>Cuándo se conoce</th><th>¿Sirve en el punto 1?</th></tr>
        <tr><td>monto, canal, cliente nuevo</td><td>al recibir la solicitud</td><td>sí</td></tr>
        <tr><td>puntaje</td><td>al terminar <em>Evaluar riesgo</em></td><td>sí</td></tr>
        <tr><td>monto aprobado, duración del caso</td><td>después de aprobar o al cerrar</td><td>no: es consecuencia de la decisión</td></tr>
      </table>
      <div class="recuadro"><p><strong>Advertencia.</strong> Un atributo posterior a la decisión puede dar \(G \approx H\), una explicación «perfecta» y vacía.
      Es el mismo error que usar el resultado para predecir el resultado.</p></div>
      <h2>Conexiones</h2>
      <p>Las reglas que se aprenden con estos datos se ven en <a href="tema.html?id=decision-rules">reglas de decisión</a>, que usa
      <a href="tema.html?id=decision-trees">árboles de decisión</a>; el peso de cada factor, en <a href="tema.html?id=decision-drivers">factores de decisión</a>;
      y la comparación de grupos de casos, en <a href="tema.html?id=variant-comparison">comparación de variantes</a>.</p>`,
  });
})();
