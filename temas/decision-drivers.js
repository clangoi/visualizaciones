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
  const desv = (a) => { const m = media(a); return Math.sqrt(media(a.map((v) => (v - m) * (v - m)))); };
  function pearson(a, b) {
    const ma = media(a), mb = media(b);
    let sab = 0, saa = 0, sbb = 0;
    a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) * (v - ma); sbb += (b[i] - mb) * (b[i] - mb); });
    return sab / Math.sqrt(saa * sbb);
  }
  const TODOS = ATR.map((a) => a.k);

  /* ---------- Fig. 1: ganancia de información frente a importancia por permutación ---------- */

  function montarImportancia(cuerpo) {
    let semilla = 1, punto = 1, prof = 4, reps = 10, ruido = 0.05, sinPuntaje = false, res = [], info = null, hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Punto de decisión', opciones: [['1', '1 · tras evaluar el riesgo'], ['2', '2 · tras la revisión manual']], valor: '1', alCambiar: (v) => { punto = +v; calcular(); } });
    ctl.rango({ etiqueta: 'Profundidad del árbol', min: 1, max: 6, valor: prof, alCambiar: (v) => { prof = v; calcular(); } });
    ctl.rango({ etiqueta: 'Barajados por atributo', min: 1, max: 30, valor: reps, alCambiar: (v) => { reps = v; calcular(); } });
    ctl.rango({ etiqueta: 'Desvíos de la regla', min: 0, max: 0.3, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.casilla({ etiqueta: 'Quitar «puntaje» del modelo', valor: sinPuntaje, alCambiar: (v) => { sinPuntaje = v; calcular(); } });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 24 + ATR.length * 44 + 34 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'ganancia de información (fracción de la entropía que explica el atributo solo)' },
      { color: C.s2, texto: 'importancia por permutación (puntos de exactitud que se pierden al barajarlo)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La ganancia mira cada atributo por separado; la permutación pregunta cuánto depende el modelo entrenado de él (se baraja su columna en los casos de prueba y se mide cuánto cae la exactitud). Pruebe «Quitar puntaje»: el ingreso, que se mueve con el puntaje, pasa a pesar mucho.');

    function calcular() {
      const sol = solicitudes(600, semilla * 17 + 3, { ruido });
      const base = punto === 1 ? sol : sol.filter((c) => c.r1 === 1);
      const yf = punto === 1 ? (c) => c.r1 : (c) => c.r2, K = punto === 1 ? 3 : 2;
      const nt = Math.round(base.length * 0.7), tr = base.slice(0, nt), te = base.slice(nt);
      const usados = TODOS.filter((k) => !(sinPuntaje && k === 'puntaje'));
      const arbol = crecer(tr, { yf, K, atrs: usados, crit: 'entropia', maxProf: prof, minHoja: 5, minGan: 1e-9 });
      const acc = exactitud(arbol, te, yf), H = impureza(contar(tr, yf, K), 'entropia');
      const rnd = VIZ.semilla(semilla * 31 + 7);
      res = ATR.map((a) => {
        const m = mejorCorte(tr, yf, K, [a.k], 'entropia', 5);
        const gan = m ? m.gan / H : 0;
        const dentro = usados.includes(a.k);
        const caidas = [];
        if (dentro) {
          for (let r = 0; r < reps; r++) {
            const v = te.map((c) => c[a.k]);
            for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = v[i]; v[i] = v[j]; v[j] = t; }
            caidas.push(acc - exactitud(arbol, te.map((c, i) => ({ ...c, [a.k]: v[i] })), yf));
          }
        }
        return { a, gan, perm: dentro ? media(caidas) : 0, sd: dentro ? desv(caidas) : 0, dentro };
      }).sort((p, q) => q.perm - p.perm || q.gan - p.gan);
      info = { acc, H, hojas: listaHojas(arbol).length, nTe: te.length, nTr: tr.length };
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = Math.min(112, W * 0.3), der = 44, sup = 10, paso = 44, base = sup + res.length * paso;
      geo = { sup, paso };
      const tope = Math.min(1, Math.max(0.1, ...res.map((r) => Math.max(r.gan, r.perm))) * 1.15);
      const sx = (v) => izq + (Math.max(0, v) / tope) * (W - izq - der);
      ctx.font = VIZ.fuente(10);
      for (const v of VIZ.ticks(0, tope, 4)) {
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(sx(v)) + 0.5, sup); ctx.lineTo(Math.round(sx(v)) + 0.5, base); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${Math.round(v * 100)} %`, sx(v), base + 6);
      }
      res.forEach((r, i) => {
        const y = sup + i * paso;
        if (i === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y + 1, W, paso - 2); }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = r.dentro ? C.tinta : C.apagado;
        ctx.fillText(r.a.n, izq - 8, y + paso / 2 - (r.dentro ? 0 : 6));
        if (!r.dentro) { ctx.fillStyle = C.apagado; ctx.fillText('(fuera del modelo)', izq - 8, y + paso / 2 + 7); }
        [[r.gan, C.s1], [r.perm, C.s2]].forEach(([v, col], j) => {
          const yy = y + 8 + j * 15, w = Math.max(1, sx(v) - izq);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(izq, yy, w, 12, [0, 3, 3, 0]); ctx.fill();
          ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(`${VIZ.fmt(100 * v, 2)}`, izq + w + 5, yy + 6);
        });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq + 0.5, sup); ctx.lineTo(izq + 0.5, base); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('porcentaje', W - 4, lienzo.alto - 2);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      const topP = res[0], topG = res.reduce((m, r) => (r.gan > m.gan ? r : m), res[0]);
      const proxy = res.find((r) => r.gan > 0.08 && r.perm < 0.02 && (r.dentro || sinPuntaje === false) && r !== topP);
      registro.textContent = !topP.perm
        ? 'Ningún atributo del modelo cambia su exactitud al barajarlo: con estas profundidades el árbol casi no usa los datos.'
        : proxy
          ? `«${topP.a.n}» es el que más pesa en el modelo (baja la exactitud ${VIZ.fmt(100 * topP.perm, 2)} puntos al barajarlo). «${proxy.a.n}» explica ${pct(proxy.gan, 2)} de la entropía por sí solo, pero barajarlo casi no afecta al modelo: su información ya la aporta otro atributo correlacionado.`
          : `«${topP.a.n}» es el que más pesa en el modelo: al barajarlo la exactitud baja ${VIZ.fmt(100 * topP.perm, 2)} puntos (${pct(topG.gan, 2)} de ganancia). Los demás aportan poco o nada.${sinPuntaje ? ' El puntaje está fuera del modelo y el ingreso lo reemplaza porque se mueven juntos.' : ''}`;
      lectura.set([
        ['exactitud del árbol en prueba', pct(info.acc, 3)],
        ['entropía de la decisión (bits)', VIZ.fmt(info.H, 3)],
        ['mayor ganancia', `${topG.a.n} · ${pct(topG.gan, 2)}`],
        ['mayor importancia por permutación', `${topP.a.n} · ${VIZ.fmt(100 * topP.perm, 2)} pp`],
        ['hojas del árbol', String(info.hojas)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = geo ? Math.floor((y - geo.sup) / geo.paso) : -1;
      if (i < 0 || i >= res.length) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      if (i !== hover) { hover = i; dibujar(); }
      const r = res[i];
      tip.mostrar(x, y, `<b>${r.a.n}</b>${VIZ.filaTooltip(C.s1, 'ganancia', pct(r.gan, 3))}${r.dentro ? VIZ.filaTooltip(C.s2, 'permutación', `${VIZ.fmt(100 * r.perm, 3)} pp ± ${VIZ.fmt(100 * r.sd, 2)}`) : 'no participa en el modelo'}<br>se conoce ${r.a.cuando}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: predecir la ruta de un caso nuevo ---------- */

  function montarPrediccion(cuerpo) {
    let semilla = 1, modelo = 'todos', arbol = null, exac = 0, rZ = 0, geo = null, hojasVis = [];
    const caso = { monto: 12, puntaje: 700, nuevo: 0, web: 1, carga: 50, ingreso: 55 };
    const ctl = VIZ.controles(cuerpo);
    const rs = {};
    rs.monto = ctl.rango({ etiqueta: 'Monto (miles)', min: 2, max: 60, valor: caso.monto, alCambiar: (v) => { caso.monto = v; dibujar(); } });
    rs.puntaje = ctl.rango({ etiqueta: 'Puntaje', min: 300, max: 850, paso: 10, valor: caso.puntaje, alCambiar: (v) => { caso.puntaje = v; dibujar(); } });
    rs.ingreso = ctl.rango({ etiqueta: 'Ingreso (miles)', min: 5, max: 90, valor: caso.ingreso, alCambiar: (v) => { caso.ingreso = v; dibujar(); } });
    rs.carga = ctl.rango({ etiqueta: 'Carga del analista', min: 10, max: 100, valor: caso.carga, alCambiar: (v) => { caso.carga = v; dibujar(); } });
    const cNuevo = ctl.casilla({ etiqueta: 'Cliente nuevo', valor: !!caso.nuevo, alCambiar: (v) => { caso.nuevo = v ? 1 : 0; dibujar(); } });
    const cWeb = ctl.casilla({ etiqueta: 'Canal web', valor: !!caso.web, alCambiar: (v) => { caso.web = v ? 1 : 0; dibujar(); } });
    ctl.selector({
      etiqueta: 'Atributos del modelo', valor: modelo, alCambiar: (v) => { modelo = v; entrenar(); },
      opciones: [['todos', 'todos'], ['sinPuntaje', 'sin puntaje (queda el ingreso)'], ['irrelevantes', 'solo canal y carga']],
    });
    ctl.boton('Ingreso típico del puntaje', () => { caso.ingreso = Math.round(15 + 0.1 * (caso.puntaje - 300)); rs.ingreso.valor = caso.ingreso; dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; entrenar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'aprobar directo' }, { color: C.s1, texto: 'revisión manual' }, { color: C.s8, texto: 'rechazar' },
      { color: C.s2, texto: 'camino de este caso', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva los controles: el caso baja por el árbol y la hoja alcanzada da la ruta predicha y su probabilidad. Haga clic en una hoja para cargar un caso típico de ella. Con «sin puntaje», suba el ingreso sin tocar el puntaje: el modelo cambia de ruta, la regla real no.');

    function entrenar() {
      const sol = solicitudes(600, semilla * 23 + 1, { ruido: 0.05 });
      const tr = sol.slice(0, 420), te = sol.slice(420);
      const atrs = modelo === 'todos' ? TODOS : modelo === 'sinPuntaje' ? TODOS.filter((k) => k !== 'puntaje') : ['web', 'carga'];
      arbol = crecer(tr, { yf: yRama, K: 3, atrs, crit: 'gini', maxProf: 3, minHoja: 8, minGan: 1e-9 });
      exac = exactitud(arbol, te, yRama);
      rZ = pearson(sol.map((c) => c.puntaje), sol.map((c) => c.ingreso));
      dibujar();
    }
    function camino(nd0, c) {
      const ids = new Set(), aristas = new Set();
      let nd = nd0;
      ids.add(nd.id);
      while (nd.hijos) { const h = c[nd.corte.k] <= nd.corte.t ? nd.hijos[0] : nd.hijos[1]; aristas.add(nd.id + '>' + h.id); ids.add(h.id); nd = h; }
      return { ids, aristas, hoja: nd };
    }
    function dibujar() {
      if (!arbol) return;
      lienzo.limpiar();
      let k = 0;
      const todos = [];
      (function num(nd) { nd.id = 'n' + k++; todos.push(nd); if (nd.hijos) nd.hijos.forEach(num); })(arbol);
      const est = lienzo.ancho < 520, cam = camino(arbol, caso), nodos = [], aristas = [];
      hojasVis = [];
      todos.forEach((nd) => {
        const col = COL1[nd.clase], enCam = cam.ids.has(nd.id);
        const a = nd.hijos ? atr(nd.corte.k) : null;
        nodos.push({
          id: nd.id, tipo: 'act',
          etiqueta: nd.hijos ? etiquetaCorte(nd.corte, est) : `${CORTO1[nd.clase]} ${Math.round(100 * nd.cnt[nd.clase] / nd.n)}%`,
          relleno: nd.hijos ? C.superficie : VIZ.alfa(col, 0.22), borde: nd.hijos ? C.tinta : col, anillo: enCam ? C.s2 : null,
        });
        if (nd.hijos) {
          const bin = a.tipo === 'bin';
          nd.hijos.forEach((h, i) => aristas.push({ de: nd.id, a: h.id, etiqueta: (bin ? ['no', 'sí'] : ['sí', 'no'])[i], color: cam.aristas.has(nd.id + '>' + h.id) ? C.s2 : C.apagado, ancho: cam.aristas.has(nd.id + '>' + h.id) ? 3.5 : 1.5 }));
        }
      });
      const pos = P.disponer(nodos.map((x) => x.id), aristas.map((e) => [e.de, e.a]));
      geo = P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: est ? 44 : 60, margenY: 26, fuente: est ? 9 : 10 });
      hojasVis = todos;
      const h = cam.hoja, pred = h.clase, real = verdad1(caso);
      const conds = listaHojas(arbol).find((x) => x.nd === h).camino;
      registro.textContent = `El caso sigue ${conds.length ? `«${textoRegla(conds)}»` : 'la única hoja'} y llega a «${RAMAS1[pred]}» (${pct(h.cnt[pred] / h.n, 3)} de los ${h.n} casos de esa hoja). `
        + (pred === real ? 'Coincide con la regla de negocio.' : `La regla de negocio dice «${RAMAS1[real]}»: el modelo ${modelo === 'todos' ? 'se equivoca en esta zona' : 'no tiene los atributos que de verdad deciden'}.`);
      lectura.set([
        ['ruta predicha', RAMAS1[pred]],
        ['probabilidades', h.cnt.map((v, j) => `${CORTO1[j]} ${Math.round(100 * v / h.n)} %`).join(' · ')],
        ['ruta según la regla de negocio', RAMAS1[real]],
        ['exactitud del modelo en casos nuevos', pct(exac, 3)],
        ['correlación puntaje–ingreso', VIZ.fmt(rZ, 2)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = geo && P.nodoEn(geo, x, y);
      const nd = n && hojasVis.find((q) => q.id === n.id);
      if (!nd || nd.hijos) return;
      for (const k of ['monto', 'puntaje', 'carga', 'ingreso']) {
        caso[k] = Math.round(media(nd.filas.map((c) => c[k])) / (k === 'puntaje' ? 10 : 1)) * (k === 'puntaje' ? 10 : 1);
        rs[k].valor = caso[k];
      }
      caso.nuevo = media(nd.filas.map((c) => c.nuevo)) >= 0.5 ? 1 : 0; cNuevo.valor = !!caso.nuevo;
      caso.web = media(nd.filas.map((c) => c.web)) >= 0.5 ? 1 : 0; cWeb.valor = !!caso.web;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = geo && P.nodoEn(geo, x, y);
      const nd = n && hojasVis.find((q) => q.id === n.id);
      if (!nd) return tip.ocultar();
      tip.mostrar(x, y, `<b>${nd.n}</b> casos${nd.cnt.map((v, j) => VIZ.filaTooltip(COL1[j], RAMAS1[j], `${v} (${pct(v / nd.n, 2)})`)).join('')}${nd.hijos ? '' : 'clic: cargar un caso típico'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    entrenar();
  }

  VIZ.registrarTema('decision-drivers', {
    intro: String.raw`
      <p>Saber que existe una regla no basta: interesa saber <strong>qué factores pesan más</strong> en una decisión. ¿Importa más el monto del crédito,
      el puntaje del cliente o el canal por el que llegó? La respuesta guía qué datos conviene registrar con cuidado y dónde vale la pena intervenir.</p>
      <p>Hay varias formas de medir la importancia de un atributo, y no siempre coinciden. Además, un factor que «predice» una ruta no es necesariamente
      su causa: un atributo correlacionado con el verdadero motivo parece importante sin serlo.</p>`,
    visualizaciones: [
      {
        titulo: 'Importancia de cada factor',
        descripcion: 'Compara dos medidas de importancia. Con todos los atributos, «puntaje» domina; active «Quitar puntaje» y observe cómo el ingreso, que no decide nada pero se mueve con el puntaje, ocupa su lugar.',
        montar: montarImportancia,
      },
      {
        titulo: 'Predecir la ruta de un caso nuevo',
        descripcion: 'Elija los atributos del modelo y mueva los datos de un caso: el árbol lo lleva a una ruta. Con «sin puntaje», suba el ingreso sin cambiar el puntaje y vea que la predicción cambia pero la regla de negocio no.',
        montar: montarPrediccion,
      },
    ],
    teoria: String.raw`
      <h2>Qué significa «pesar en una decisión»</h2>
      <p>Hay al menos tres preguntas distintas. (1) ¿Cuánta información sobre la rama contiene el atributo? (2) ¿Cuánto depende de él un modelo entrenado?
      (3) ¿Cambiaría la decisión si se modificara el atributo? Las dos primeras se responden con los datos; la tercera es causal.</p>
      <h2>Ganancia de información de un atributo</h2>
      <p>Con la entropía \(H(Y)\) de la rama y el mejor corte \(s\) del atributo \(X\), la ganancia es
      \(G(X) = H(Y) - H(Y \mid X \text{ dividido por } s)\); se normaliza como \(G(X)/H(Y) \in [0, 1]\). Mide cada atributo <em>por separado</em>, de modo que
      dos atributos que informan lo mismo reciben ambos una ganancia alta.</p>
      <h2>Importancia por permutación</h2>
      <pre><code>acc_base ← exactitud(modelo, casos de prueba)
para cada atributo a:
    repetir R veces:
        barajar la columna a entre los casos de prueba
        caída_r ← acc_base − exactitud(modelo, casos barajados)
    importancia(a) ← promedio de las caídas</code></pre>
      \[ I_{\text{perm}}(a) = \text{acc}_{\text{base}} - \frac{1}{R}\sum_{r=1}^{R} \text{acc}\bigl(\text{modelo}, X^{(a,r)}\bigr). \]
      <p>Barajar rompe la relación entre el atributo y la rama sin cambiar su distribución. Si el modelo no lo usa, la exactitud no cambia
      y la importancia es cercana a 0 (puede salir ligeramente negativa por azar). Se mide con casos que no se usaron para entrenar.</p>
      <table>
        <tr><th>Situación</th><th>Ganancia</th><th>Permutación</th></tr>
        <tr><td>Atributo que decide la ruta</td><td>alta</td><td>alta</td></tr>
        <tr><td>Atributo correlacionado con el que decide, ya presente en el modelo</td><td>alta</td><td>baja (el modelo no lo necesita)</td></tr>
        <tr><td>Atributo correlacionado, el que decide se quitó</td><td>alta</td><td>alta (hace de sustituto)</td></tr>
        <tr><td>Atributo sin relación</td><td>cerca de 0</td><td>cerca de 0</td></tr>
      </table>
      <h2>Predecir la ruta de un caso nuevo</h2>
      <p>Un árbol (ver <a href="tema.html?id=decision-rules">reglas de decisión</a>) lleva el caso a una hoja; la proporción de cada rama en esa hoja es la
      probabilidad estimada, \(\hat{P}(\text{rama}\; j \mid \mathbf{x}) = n_{j}^{\text{hoja}} / n^{\text{hoja}}\). Es útil para decidir antes de que el caso llegue al punto
      de decisión, por ejemplo para preparar recursos (véase <a href="tema.html?id=next-activity-prediction">predicción de la siguiente actividad</a>).</p>
      <h2>Correlación y causalidad</h2>
      <p>En los datos del ejemplo el ingreso se genera a partir del puntaje: \(\text{ingreso} = 15 + 0.1\,(\text{puntaje} - 300) + \varepsilon\). La regla de
      negocio solo mira el puntaje, pero el ingreso es un buen <em>sustituto</em> y un modelo sin puntaje lo usa. Aparece el cuadro típico de un confusor:</p>
      <div class="recuadro"><p>puntaje → ingreso &nbsp;&nbsp; y &nbsp;&nbsp; puntaje → ruta. El ingreso y la ruta están asociados, pero <strong>intervenir</strong> sobre el ingreso
      (subirlo sin tocar el puntaje) no cambia la ruta real. La predicción mejora con el sustituto; la explicación, no.</p></div>
      <p>Para afirmar que un factor causa la decisión hay que conocer cómo se decide (la regla de negocio), o recurrir a experimentos o a modelos causales:
      véanse <a href="tema.html?id=correlation-causation">correlación y causalidad</a> y <a href="tema.html?id=causal-structures">estructuras causales</a>.</p>
      <h2>Comportamiento observado</h2>
      <p>En un registro real, los factores explican solo una parte: el resto depende de información que el sistema no capta (juicio del analista, conversación
      con el cliente). Una exactitud baja con muchos atributos sugiere que la decisión es discrecional o que falta algún dato, no que el análisis falló. Para comparar
      grupos de casos, vea <a href="tema.html?id=variant-comparison">comparación de variantes</a>; para el punto de partida, <a href="tema.html?id=decision-points">puntos de decisión</a>.</p>`,
  });
})();
