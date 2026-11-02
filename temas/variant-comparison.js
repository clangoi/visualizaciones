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

  /* ---------- Grupos, estadística y datos de esta página ---------- */

  const ACTS = ['Recibir solicitud', 'Verificar identidad', 'Pedir documentos', 'Evaluar riesgo', 'Aprobar directo', 'Revisión manual', 'Aprobar', 'Rechazar', 'Notificar'];
  const LETRA = (a) => String.fromCharCode(65 + ACTS.indexOf(a));
  const GRUPOS = {
    nuevo: { nom: ['clientes nuevos', 'clientes recurrentes'], f: (c) => (c.nuevo ? 0 : 1), texto: 'cliente nuevo o recurrente' },
    web: { nom: ['canal web', 'sucursal'], f: (c) => (c.web ? 0 : 1), texto: 'canal web o sucursal' },
    monto: { nom: ['monto alto (> 20)', 'monto bajo (≤ 20)'], f: (c) => (c.monto > 20 ? 0 : 1), texto: 'monto alto o bajo' },
    resultado: { nom: ['rechazadas', 'aprobadas'], f: (c) => (c.r1 === 2 || (c.r1 === 1 && c.r2 === 1) ? 0 : 1), texto: 'rechazada o aprobada' },
    azar: { nom: ['grupo al azar A', 'grupo al azar B'], f: (c) => c.azar, texto: 'dos grupos formados al azar' },
  };
  const OPC_GRUPO = Object.entries(GRUPOS).map(([k, g]) => [k, g.texto]);
  function casosComparados(n, semilla) {
    const sol = solicitudes(n, semilla, { extras: true, ruido: 0.05 }), rnd = VIZ.semilla(semilla * 101 + 7);
    sol.forEach((c) => { c.azar = rnd() < 0.5 ? 0 : 1; });
    return sol;
  }
  const dividirGrupos = (sol, g) => [sol.filter((c) => GRUPOS[g].f(c) === 0), sol.filter((c) => GRUPOS[g].f(c) === 1)];
  function erf(x) {
    const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
  }
  const pDos = (z) => 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));
  // Prueba z de dos proporciones: a de nA frente a b de nB.
  function pruebaProp(a, nA, b, nB) {
    const p = (a + b) / (nA + nB), se = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));
    if (!se) return { z: 0, p: 1 };
    const z = (a / nA - b / nB) / se;
    return { z, p: pDos(z) };
  }
  const varianza = (v) => { const m = media(v); return v.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, v.length - 1); };
  const fmtP = (p) => (p < 0.0001 ? '< 0.0001' : VIZ.fmt(p, 2));

  /* ---------- Fig. 1: actividades y variantes de dos grupos ---------- */

  function montarActividades(cuerpo) {
    let n = 400, semilla = 1, g = 'nuevo', bonf = false, sol = [], filas = [], hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Comparar', opciones: OPC_GRUPO, valor: g, alCambiar: (v) => { g = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 100, max: 1000, paso: 50, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.casilla({ etiqueta: 'Corrección de Bonferroni', valor: bonf, alCambiar: (v) => { bonf = v; calcular(); } });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 20 + ACTS.length * 36 + 32 });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, []);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada par de barras es el porcentaje de casos de cada grupo que ejecutan la actividad. Una fila resaltada es una diferencia significativa (prueba z de dos proporciones). Las letras A–I nombran las actividades en la tabla de variantes. Pase el cursor sobre una fila para ver la prueba.');

    function calcular() {
      sol = casosComparados(n, semilla);
      const [A, B] = dividirGrupos(sol, g);
      const alfa = bonf ? 0.05 / ACTS.length : 0.05;
      filas = ACTS.map((a) => {
        const ca = A.filter((c) => c.eventos.some((e) => e.act === a)).length, cb = B.filter((c) => c.eventos.some((e) => e.act === a)).length;
        const t = pruebaProp(ca, A.length, cb, B.length);
        return { a, ca, cb, pa: ca / A.length, pb: cb / B.length, ...t, sig: t.p < alfa };
      });
      ley.set([
        { color: C.s1, texto: GRUPOS[g].nom[0] }, { color: C.s2, texto: GRUPOS[g].nom[1] },
        { color: VIZ.alfa(C.s4, 0.35), texto: `diferencia significativa (p < ${bonf ? '0.0056' : '0.05'})` },
      ]);
      dibujar();
      tabla(A, B);
    }
    function tabla(A, B) {
      const vs = P.variantes(sol).slice(0, 6);
      const cel = (v, arr, N) => `${arr} (${Math.round(100 * arr / N)} %)`;
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'variante más frecuente'), VIZ.el('th', null, GRUPOS[g].nom[0]), VIZ.el('th', null, GRUPOS[g].nom[1]), VIZ.el('th', null, 'diferencia')),
        ...vs.map((v) => {
          const a = v.casos.filter((c) => GRUPOS[g].f(c) === 0).length, b = v.n - a;
          const d = 100 * (a / A.length - b / B.length);
          return VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, v.traza.map(LETRA).join('')), VIZ.el('td', null, cel(v, a, A.length)), VIZ.el('td', null, cel(v, b, B.length)),
            VIZ.el('td', null, `${d >= 0 ? '+' : '−'}${VIZ.fmt(Math.abs(d), 2)} pp`));
        })));
    }
    function dibujar() {
      if (!filas.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = Math.min(150, W * 0.42), der = 44, sup = 10, paso = 36, base = sup + ACTS.length * paso;
      geo = { sup, paso };
      const sx = (v) => izq + v * (W - izq - der);
      ctx.font = VIZ.fuente(10);
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(sx(v)) + 0.5, sup); ctx.lineTo(Math.round(sx(v)) + 0.5, base); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${v * 100} %`, sx(v), base + 6);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('% de casos que ejecutan la actividad', W - 4, lienzo.alto - 2);
      filas.forEach((f, i) => {
        const y = sup + i * paso;
        if (f.sig) { ctx.fillStyle = VIZ.alfa(C.s4, i === hover ? 0.45 : 0.3); ctx.fillRect(0, y + 1, W, paso - 2); }
        else if (i === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y + 1, W, paso - 2); }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.tinta;
        ctx.fillText(`${LETRA(f.a)} · ${f.a}`, izq - 8, y + paso / 2);
        [[f.pa, C.s1], [f.pb, C.s2]].forEach(([p, col], j) => {
          const yy = y + 6 + j * 12, w = Math.max(1, sx(p) - izq);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(izq, yy, w, 10, [0, 3, 3, 0]); ctx.fill();
          ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(`${Math.round(p * 100)}`, izq + w + 5, yy + 5);
        });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq + 0.5, sup); ctx.lineTo(izq + 0.5, base); ctx.stroke();
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      const [A, B] = dividirGrupos(sol, g), sigs = filas.filter((f) => f.sig), dif = (f) => Math.abs(f.pa - f.pb);
      const mayor = filas.reduce((m, f) => (dif(f) > dif(m) ? f : m), filas[0]);
      registro.textContent = sigs.length
        ? `${sigs.length} de ${ACTS.length} actividades difieren de forma significativa entre ${GRUPOS[g].nom[0]} y ${GRUPOS[g].nom[1]}; la mayor es «${mayor.a}» con ${VIZ.fmt(100 * dif(mayor), 3)} puntos porcentuales (p ${fmtP(mayor.p).startsWith('<') ? fmtP(mayor.p) : '= ' + fmtP(mayor.p)}).`
        : `Ninguna de las ${ACTS.length} actividades difiere de forma significativa. Si repite la prueba con muchos grupos al azar, cerca del 5 % de las comparaciones saldrán «significativas» sin que haya nada: por eso existe la corrección de Bonferroni.`;
      lectura.set([
        ['casos por grupo', `${A.length} y ${B.length}`],
        ['actividades con diferencia significativa', `${sigs.length} de ${ACTS.length}`],
        ['mayor diferencia', `${LETRA(mayor.a)} · ${VIZ.fmt(100 * dif(mayor), 3)} pp`],
        ['duración media del caso', `${P.dur(media(A.map((c) => c.dur)))} y ${P.dur(media(B.map((c) => c.dur)))}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = geo ? Math.floor((y - geo.sup) / geo.paso) : -1;
      if (i < 0 || i >= filas.length) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      if (i !== hover) { hover = i; dibujar(); }
      const f = filas[i], [A, B] = dividirGrupos(sol, g);
      tip.mostrar(x, y, `<b>${f.a}</b>${VIZ.filaTooltip(C.s1, GRUPOS[g].nom[0], `${f.ca}/${A.length}`)}${VIZ.filaTooltip(C.s2, GRUPOS[g].nom[1], `${f.cb}/${B.length}`)}z = <b>${VIZ.fmt(f.z, 3)}</b> · p = <b>${fmtP(f.p)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: prueba de permutación sobre un atributo ---------- */

  const MEDIDAS = {
    monto: { n: 'monto (miles)', f: (c) => c.monto },
    puntaje: { n: 'puntaje', f: (c) => c.puntaje },
    ingreso: { n: 'ingreso (miles)', f: (c) => c.ingreso },
    carga: { n: 'carga del analista (%)', f: (c) => c.carga },
    dur: { n: 'duración del caso (h)', f: (c) => c.dur / 60 },
    nEv: { n: 'eventos del caso', f: (c) => c.nEventos },
  };
  function hist(vals, lo, hi, nb) {
    const h = Array(nb).fill(0);
    for (const v of vals) h[Math.max(0, Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb)))]++;
    return h;
  }

  function montarPermutacion(cuerpo) {
    let n = 400, semilla = 1, g = 'web', m = 'dur', vA = [], vB = [], pool = [], obs = 0, difs = [], rnd = null, B = 0, hov1 = -1, hov2 = -1, pl1 = null, pl2 = null, NB = 18, lo = 0, hi = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Comparar', opciones: OPC_GRUPO, valor: g, alCambiar: (v) => { g = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Atributo', opciones: Object.entries(MEDIDAS).map(([k, x]) => [k, x.n]), valor: m, alCambiar: (v) => { m = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos casos', () => { semilla++; rep.reiniciar(); });
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 190, altoMax: 260 });
    const tip1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Diferencias de medias al repartir los casos entre los grupos al azar (cada paso agrega 25 repartos)');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 190, altoMax: 260 });
    const tip2 = VIZ.tooltip(l2);
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, la distribución del atributo en cada grupo (porcentaje dentro del grupo). Abajo, el experimento: se barajan las etiquetas de grupo y se recalcula la diferencia de medias; el valor p es la fracción de reparticiones al azar al menos tan extremas como la diferencia real.');

    function iniciar() {
      const sol = casosComparados(n, semilla), f = MEDIDAS[m].f;
      const [A, Bg] = dividirGrupos(sol, g);
      vA = A.map(f); vB = Bg.map(f);
      pool = vA.concat(vB);
      obs = media(vA) - media(vB);
      difs = []; B = 0; rnd = VIZ.semilla(semilla * 97 + 13);
      lo = Math.min(...pool); hi = Math.max(...pool) + 1e-9;
      ley.set([
        { color: C.s1, texto: GRUPOS[g].nom[0] }, { color: C.s2, texto: GRUPOS[g].nom[1] },
        { color: C.inactivo, texto: 'reparto al azar' }, { color: C.s3, texto: 'reparto al azar tan extremo como el real' }, { color: C.tinta, texto: 'diferencia real', forma: 'linea' },
      ]);
      return (function* () {
        const x = pool.slice(), nA = vA.length;
        for (let paso = 0; paso < 80; paso++) {
          for (let r = 0; r < 25; r++) {
            for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; }
            let sa = 0, sb = 0;
            for (let i = 0; i < nA; i++) sa += x[i];
            for (let i = nA; i < x.length; i++) sb += x[i];
            difs.push(sa / nA - sb / (x.length - nA));
          }
          B = difs.length;
          yield;
        }
      })();
    }
    const tamBin = () => (hi - lo) / NB;
    function dibujar() {
      if (!vA.length) return;
      const { ctx } = l1;
      l1.limpiar();
      const hA = hist(vA, lo, hi, NB).map((v) => v / vA.length), hB = hist(vB, lo, hi, NB).map((v) => v / vB.length);
      pl1 = VIZ.plano(l1, { xmin: lo, xmax: hi, ymin: 0, ymax: Math.max(...hA, ...hB) * 1.15 }, { etiquetaX: MEDIDAS[m].n, etiquetaY: '% del grupo', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl1.ejes();
      const w = pl1.sx(lo + tamBin()) - pl1.sx(lo);
      hA.forEach((v, i) => {
        for (const [h, col, j] of [[hA, C.s1, 0], [hB, C.s2, 1]]) {
          ctx.fillStyle = VIZ.alfa(col, i === hov1 ? 0.95 : 0.7);
          ctx.fillRect(pl1.sx(lo + i * tamBin()) + 1 + j * (w - 2) / 2, pl1.sy(h[i]), (w - 2) / 2, pl1.y0 - pl1.sy(h[i]));
        }
      });
      ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      [[media(vA), C.s1], [media(vB), C.s2]].forEach(([v, col]) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(pl1.sx(v), pl1.y0); ctx.lineTo(pl1.sx(v), pl1.y1); ctx.stroke(); });
      ctx.restore();

      // Distribución de las diferencias al azar.
      const { ctx: c2 } = l2;
      l2.limpiar();
      const lim = Math.max(Math.abs(obs) * 1.35, ...difs.map(Math.abs), 1e-6);
      const hD = hist(difs, -lim, lim, 25), ymax = Math.max(4, ...hD) * 1.15;
      pl2 = VIZ.plano(l2, { xmin: -lim, xmax: lim, ymin: 0, ymax }, { etiquetaX: 'diferencia de medias', etiquetaY: 'repartos', formatoY: (v) => String(Math.round(v)) });
      pl2.ejes();
      hD.forEach((v, i) => {
        if (!v) return;
        const x0 = -lim + (i * 2 * lim) / 25, x1 = x0 + (2 * lim) / 25, centro = (x0 + x1) / 2;
        c2.fillStyle = Math.abs(centro) >= Math.abs(obs) ? C.s3 : C.inactivo;
        if (i === hov2) c2.globalAlpha = 0.7;
        c2.fillRect(pl2.sx(x0) + 1, pl2.sy(v), pl2.sx(x1) - pl2.sx(x0) - 2, pl2.y0 - pl2.sy(v));
        c2.globalAlpha = 1;
      });
      c2.save(); c2.strokeStyle = C.tinta; c2.lineWidth = 2;
      c2.beginPath(); c2.moveTo(pl2.sx(obs), pl2.y0); c2.lineTo(pl2.sx(obs), pl2.y1); c2.stroke();
      c2.setLineDash([4, 3]); c2.beginPath(); c2.moveTo(pl2.sx(-obs), pl2.y0); c2.lineTo(pl2.sx(-obs), pl2.y1); c2.stroke(); c2.restore();

      const ext = difs.filter((d) => Math.abs(d) >= Math.abs(obs) - 1e-12).length;
      const p = B ? (ext + 1) / (B + 1) : NaN;
      const z = obs / Math.sqrt(varianza(vA) / vA.length + varianza(vB) / vB.length), pW = pDos(z);
      const sp = Math.sqrt(((vA.length - 1) * varianza(vA) + (vB.length - 1) * varianza(vB)) / (vA.length + vB.length - 2));
      registro.textContent = !B
        ? `Diferencia real de medias: ${VIZ.fmt(obs, 3)} (${GRUPOS[g].nom[0]} menos ${GRUPOS[g].nom[1]}). Pulse «Un paso» para barajar las etiquetas 25 veces.`
        : p < 0.05
          ? `Tras ${B} repartos al azar solo ${ext} dieron una diferencia tan grande como ${VIZ.fmt(Math.abs(obs), 3)}: p ≈ ${fmtP(p)}. Es improbable que la diferencia sea casualidad.`
          : `Tras ${B} repartos al azar, ${ext} dieron una diferencia al menos tan grande como ${VIZ.fmt(Math.abs(obs), 3)}: p ≈ ${fmtP(p)}. La diferencia observada es compatible con el azar.`;
      lectura.set([
        [`media ${GRUPOS[g].nom[0]}`, VIZ.fmt(media(vA), 4)],
        [`media ${GRUPOS[g].nom[1]}`, VIZ.fmt(media(vB), 4)],
        ['repartos al azar', String(B)],
        ['p por permutación', B ? fmtP(p) : '—'],
        ['p aproximado (Welch)', fmtP(pW)],
        ['tamaño del efecto (d de Cohen)', VIZ.fmt(obs / sp, 2)],
      ]);
    }
    l1.alDibujar = () => vA.length && dibujar();
    l2.alDibujar = () => vA.length && dibujar();
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!pl1 || !pl1.dentro(x, y)) { hov1 = -1; tip1.ocultar(); return dibujar(); }
      const i = Math.max(0, Math.min(NB - 1, Math.floor((pl1.ix(x) - lo) / tamBin())));
      hov1 = i; dibujar();
      const a = hist(vA, lo, hi, NB)[i], b = hist(vB, lo, hi, NB)[i];
      tip1.mostrar(x, y, `${VIZ.fmt(lo + i * tamBin(), 3)} a ${VIZ.fmt(lo + (i + 1) * tamBin(), 3)}${VIZ.filaTooltip(C.s1, GRUPOS[g].nom[0], `${a} (${pct(a / vA.length, 2)})`)}${VIZ.filaTooltip(C.s2, GRUPOS[g].nom[1], `${b} (${pct(b / vB.length, 2)})`)}`);
    });
    l1.canvas.addEventListener('pointerleave', () => { hov1 = -1; tip1.ocultar(); dibujar(); });
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!pl2 || !pl2.dentro(x, y) || !difs.length) { hov2 = -1; tip2.ocultar(); return dibujar(); }
      const lim = pl2.d.xmax, i = Math.max(0, Math.min(24, Math.floor(((pl2.ix(x) + lim) / (2 * lim)) * 25)));
      hov2 = i; dibujar();
      const c = hist(difs, -lim, lim, 25)[i];
      tip2.mostrar(x, y, `${VIZ.fmt(-lim + (i * 2 * lim) / 25, 3)} a ${VIZ.fmt(-lim + ((i + 1) * 2 * lim) / 25, 3)}<br><b>${c}</b> de ${B} repartos`);
    });
    l2.canvas.addEventListener('pointerleave', () => { hov2 = -1; tip2.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('variant-comparison', {
    intro: String.raw`
      <p>Cuando un proceso tiene dos tipos de casos (clientes nuevos y recurrentes, pedidos por la web y en sucursal) es natural preguntar si se
      <em>comportan</em> distinto. La <strong>comparación de variantes</strong> divide el registro en dos subregistros y busca qué actividades,
      caminos y atributos difieren de verdad entre ellos.</p>
      <p>La palabra clave es «de verdad»: con pocos casos, dos grupos siempre se ven distintos por azar. Por eso cada diferencia se acompaña de una prueba
      estadística sencilla que mide cuán sorprendente sería si los grupos fueran iguales.</p>`,
    visualizaciones: [
      {
        titulo: 'Actividades y variantes de dos grupos',
        descripcion: 'Compare clientes nuevos con recurrentes: «Verificar identidad» (B) destaca. Luego cambie a «dos grupos formados al azar»: no debería haber diferencias y, si alguna sale resaltada, es un falso positivo. Pulse «Nuevos casos» varias veces y active la corrección de Bonferroni.',
        montar: montarActividades,
      },
      {
        titulo: 'Diferencia de un atributo y prueba de permutación',
        descripcion: 'Compare un atributo entre dos grupos y pulse «Hasta el final» para barajar las etiquetas 2000 veces. Pruebe la duración del caso entre canal web y sucursal (se piden más documentos) y luego el puntaje, que no depende del canal. Observe dónde cae la línea de la diferencia real dentro de las diferencias al azar.',
        montar: montarPermutacion,
      },
    ],
    teoria: String.raw`
      <h2>Subregistros</h2>
      <p>Dado un registro de eventos \(L\), un criterio sobre los atributos del caso (o sobre su traza) lo parte en subregistros \(L_A\) y \(L_B\), de
      \(n_A\) y \(n_B\) casos. Se pueden comparar tres niveles:</p>
      <ul>
        <li><strong>comportamiento</strong>: qué actividades aparecen y con qué frecuencia, qué <a href="tema.html?id=traces-and-variants">variantes</a> son más comunes en cada grupo;</li>
        <li><strong>atributos</strong>: distribuciones de monto, puntaje u otros datos de los casos;</li>
        <li><strong>desempeño</strong>: duración del caso, esperas y costos.</li>
      </ul>
      <h2>Diferencia de frecuencias de una actividad</h2>
      <p>Si \(x_A\) de \(n_A\) casos del grupo A ejecutan la actividad y \(x_B\) de \(n_B\) los de B, con proporciones \(\hat{p}_A = x_A/n_A\) y
      \(\hat{p}_B = x_B/n_B\), la hipótesis nula «ambos grupos la ejecutan con la misma probabilidad» se prueba con</p>
      \[ z = \frac{\hat{p}_A - \hat{p}_B}{\sqrt{\hat{p}\,(1-\hat{p})\left(\tfrac{1}{n_A} + \tfrac{1}{n_B}\right)}}, \qquad \hat{p} = \frac{x_A + x_B}{n_A + n_B}. \]
      <p>Bajo la hipótesis nula \(z\) es aproximadamente normal estándar; el valor \(p = 2\,(1 - \Phi(|z|))\) es la probabilidad de ver una diferencia tan grande
      <em>si no hubiera ninguna</em>. No es la probabilidad de que la hipótesis sea cierta.</p>
      <h2>Muchas comparaciones a la vez</h2>
      <p>Al probar \(m\) actividades con nivel \(\alpha = 0.05\), incluso si todo fuera igual se espera \(0.05\,m\) falsos positivos. La corrección de
      Bonferroni exige \(p &lt; \alpha / m\) en cada prueba; garantiza que la probabilidad de algún falso positivo no pase de \(\alpha\), a costa de perder
      potencia.</p>
      <h2>Prueba de permutación de un atributo numérico</h2>
      <p>Para comparar las medias \(\bar{x}_A - \bar{x}_B\) sin suponer una distribución:</p>
      <pre><code>d_obs ← media(A) − media(B)
repetir B veces:
    barajar las etiquetas de grupo entre los n_A + n_B casos
    d* ← media(grupo A barajado) − media(grupo B barajado)
p ← (1 + #{ |d*| ≥ |d_obs| }) / (B + 1)</code></pre>
      <p>Si los grupos fueran intercambiables, barajar no cambiaría nada y \(d_{\text{obs}}\) sería una más entre las \(d^{*}\). El «+1» evita un valor \(p\) igual a cero.
      Es el mismo razonamiento de la <a href="tema.html?id=permutation-test">prueba de permutación</a> general. La alternativa clásica es la prueba de Welch:
      \(t = (\bar{x}_A - \bar{x}_B)/\sqrt{s_A^2/n_A + s_B^2/n_B}\).</p>
      <h2>Significativo no es importante</h2>
      <p>Con muchos casos cualquier diferencia diminuta resulta significativa. Conviene dar también el <strong>tamaño del efecto</strong>, por ejemplo la
      \(d\) de Cohen \(= (\bar{x}_A - \bar{x}_B)/s_p\), con \(s_p\) la desviación típica combinada.</p>
      <div class="recuadro"><p>Una diferencia entre subregistros describe, no explica. Que los clientes nuevos tarden más puede deberse a que se les
      pide verificar su identidad, o a que son más complejos; separar causas exige otras herramientas (véase
      <a href="tema.html?id=decision-drivers">factores de decisión</a>).</p></div>
      <h2>Conexiones</h2>
      <p>Las diferencias de comportamiento se localizan mejor si se conoce el modelo (<a href="tema.html?id=decision-points">puntos de decisión</a>); las reglas que
      separan a los grupos se aprenden en <a href="tema.html?id=decision-rules">reglas de decisión</a>.</p>`,
  });
})();
