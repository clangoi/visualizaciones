/* Autómatas finitos (VIZ.aut): construcción, simulación, determinización, minimización, producto,
   expresiones regulares (análisis, Thompson), búsqueda de cadenas (prefijos, ingenua, KMP) y dibujo de diagramas.

   Un autómata es { n, nombres, alf, ini: [índices], fin: Set, aristas: [{ de, s, a }], pos? }.
   El símbolo 'ε' (A.E) marca una transición vacía. Un AFD es el caso sin ε y con una arista por (estado, símbolo). */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = {};
  VIZ.aut = A;
  A.E = 'ε';

  const ord = (S) => [...S].sort((x, y) => x - y);
  A.ord = ord;

  /* ---------- Construcción ---------- */

  // trans: [[de, símbolo | [símbolos], a], …]
  A.construir = function ({ n, nombres, alf, ini = [0], fin = [], trans = [], pos = null }) {
    const aristas = [];
    for (const [de, s, a] of trans) for (const x of [].concat(s)) aristas.push({ de, s: x, a });
    return {
      n,
      nombres: nombres || Array.from({ length: n }, (_, i) => 'q' + i),
      alf: alf || [...new Set(aristas.map((e) => e.s).filter((s) => s !== A.E))].sort(),
      ini: [].concat(ini),
      fin: new Set(fin),
      aristas,
      pos,
    };
  };

  // AFD desde una tabla: tabla[i][k] es el destino del estado i con el símbolo alf[k] (−1 = sin transición).
  A.desdeTabla = function ({ nombres, alf, tabla, ini = 0, fin = [], pos = null }) {
    const trans = [];
    tabla.forEach((fila, i) => fila.forEach((j, k) => { if (j >= 0) trans.push([i, alf[k], j]); }));
    return A.construir({ n: tabla.length, nombres, alf, ini: [ini], fin, trans, pos });
  };

  function ady(aut) {
    if (!aut._ady) {
      aut._ady = Array.from({ length: aut.n }, () => []);
      for (const e of aut.aristas) aut._ady[e.de].push(e);
    }
    return aut._ady;
  }
  A.ady = ady;
  A.tieneEps = (aut) => aut.aristas.some((e) => e.s === A.E);
  A.esDet = (aut) => {
    if (aut.ini.length !== 1 || A.tieneEps(aut)) return false;
    const vistos = new Set();
    for (const e of aut.aristas) { const k = e.de + '|' + e.s; if (vistos.has(k)) return false; vistos.add(k); }
    return true;
  };
  A.copiar = (aut) => A.construir({ n: aut.n, nombres: [...aut.nombres], alf: [...aut.alf], ini: [...aut.ini], fin: [...aut.fin], trans: aut.aristas.map((e) => [e.de, e.s, e.a]), pos: aut.pos });

  // Función de transición de un AFD como matriz delta[i][k] (−1 si falta).
  A.delta = function (aut) {
    const d = Array.from({ length: aut.n }, () => Array(aut.alf.length).fill(-1));
    for (const e of aut.aristas) { const k = aut.alf.indexOf(e.s); if (k >= 0) d[e.de][k] = e.a; }
    return d;
  };

  /* ---------- Simulación ---------- */

  A.clausura = function (aut, S) {
    const r = new Set(S), pila = [...S];
    while (pila.length) {
      const q = pila.pop();
      for (const e of ady(aut)[q]) if (e.s === A.E && !r.has(e.a)) { r.add(e.a); pila.push(e.a); }
    }
    return r;
  };
  A.mover = function (aut, S, s) {
    const r = new Set();
    for (const q of S) for (const e of ady(aut)[q]) if (e.s === s) r.add(e.a);
    return r;
  };
  A.paso = (aut, S, s) => A.clausura(aut, A.mover(aut, S, s));
  A.inicial = (aut) => A.clausura(aut, new Set(aut.ini));
  A.hayFinal = (aut, S) => [...S].some((q) => aut.fin.has(q));
  A.simular = function (aut, w) {
    const trazas = [A.inicial(aut)];
    for (const ch of w) trazas.push(A.paso(aut, trazas[trazas.length - 1], ch));
    return { trazas, acepta: A.hayFinal(aut, trazas[trazas.length - 1]) };
  };
  A.acepta = (aut, w) => A.simular(aut, w).acepta;
  A.nombreConj = (aut, S) => (S.size ? '{' + ord(S).map((q) => aut.nombres[q]).join(',') + '}' : '∅');

  // Palabras aceptadas de longitud ≤ max, en orden de longitud y luego alfabético.
  A.palabras = function (aut, max, tope = 300) {
    const res = [];
    let nivel = [['', A.inicial(aut)]];
    for (let l = 0; l <= max && res.length < tope; l++) {
      const sig = [];
      for (const [w, S] of nivel) {
        if (A.hayFinal(aut, S)) { res.push(w); if (res.length >= tope) break; }
        if (l < max) for (const s of aut.alf) { const T = A.paso(aut, S, s); if (T.size) sig.push([w + s, T]); }
      }
      nivel = sig;
      if (nivel.length > 40000) break;
    }
    return res;
  };

  // Cantidad de palabras aceptadas de cada longitud 0..N (programación dinámica sobre el AFD equivalente).
  A.conteo = function (aut, N) {
    const d = A.esDet(aut) ? A.completar(aut) : A.determinizar(aut).dfa;
    const T = A.delta(d);
    let v = Array(d.n).fill(0);
    v[d.ini[0]] = 1;
    const res = [];
    for (let l = 0; l <= N; l++) {
      res.push(v.reduce((s, c, q) => s + (d.fin.has(q) ? c : 0), 0));
      const w = Array(d.n).fill(0);
      v.forEach((c, q) => { if (c) T[q].forEach((j) => { if (j >= 0) w[j] += c; }); });
      v = w;
    }
    return res;
  };

  /* ---------- Operaciones sobre autómatas ---------- */

  // Agrega un estado «trampa» (∅) si el AFD es parcial.
  A.completar = function (d) {
    const T = A.delta(d);
    if (T.every((f) => f.every((j) => j >= 0))) return d;
    const t = d.n, trans = d.aristas.map((e) => [e.de, e.s, e.a]);
    for (let i = 0; i <= d.n; i++) d.alf.forEach((s, k) => { if (i === d.n || T[i][k] < 0) trans.push([i, s, t]); });
    return A.construir({ n: d.n + 1, nombres: [...d.nombres, '∅'], alf: d.alf, ini: d.ini, fin: [...d.fin], trans, pos: null });
  };

  A.alcanzables = function (aut) {
    const vis = new Set(aut.ini), pila = [...aut.ini];
    while (pila.length) { const q = pila.pop(); for (const e of ady(aut)[q]) if (!vis.has(e.a)) { vis.add(e.a); pila.push(e.a); } }
    return vis;
  };
  A.podar = function (aut) {
    const vis = A.alcanzables(aut), ids = ord(vis), m = new Map(ids.map((q, i) => [q, i]));
    return A.construir({
      n: ids.length, nombres: ids.map((q) => aut.nombres[q]), alf: aut.alf, ini: aut.ini.map((q) => m.get(q)),
      fin: ids.filter((q) => aut.fin.has(q)).map((q) => m.get(q)),
      trans: aut.aristas.filter((e) => vis.has(e.de)).map((e) => [m.get(e.de), e.s, m.get(e.a)]),
    });
  };

  // Construcción por subconjuntos. Devuelve el AFD, los subconjuntos y cada paso (de, símbolo, T, a, nuevo).
  A.determinizar = function (aut, { trampa = true } = {}) {
    const alf = aut.alf.filter((s) => s !== A.E);
    const clave = (S) => ord(S).join(',');
    const ini = A.inicial(aut);
    const subs = [ini], idx = new Map([[clave(ini), 0]]), pasos = [], trans = [];
    for (let i = 0; i < subs.length; i++) {
      for (const s of alf) {
        const T = A.paso(aut, subs[i], s);
        if (!trampa && !T.size) { pasos.push({ de: i, s, T, a: -1, nuevo: false }); continue; }
        const k = clave(T);
        let j = idx.get(k), nuevo = false;
        if (j === undefined) { j = subs.length; subs.push(T); idx.set(k, j); nuevo = true; }
        pasos.push({ de: i, s, T, a: j, nuevo });
        trans.push([i, s, j]);
      }
    }
    const dfa = A.construir({
      n: subs.length, nombres: subs.map((S) => A.nombreConj(aut, S)), alf, ini: [0],
      fin: subs.map((S, i) => (A.hayFinal(aut, S) ? i : -1)).filter((i) => i >= 0), trans,
    });
    return { dfa, subs, pasos };
  };

  A.complemento = function (d) {
    const c = A.completar(d);
    return A.construir({ n: c.n, nombres: c.nombres, alf: c.alf, ini: c.ini, fin: c.nombres.map((_, i) => i).filter((i) => !c.fin.has(i)), trans: c.aristas.map((e) => [e.de, e.s, e.a]), pos: c.pos });
  };

  // Producto de dos AFD sobre el mismo alfabeto; op(enA, enB) decide qué pares aceptan.
  A.producto = function (a, b, op) {
    a = A.completar(a); b = A.completar(b);
    const Ta = A.delta(a), Tb = A.delta(b), alf = a.alf;
    const pares = [[a.ini[0], b.ini[0]]], idx = new Map([[pares[0].join(','), 0]]), trans = [];
    for (let i = 0; i < pares.length; i++) {
      const [p, q] = pares[i];
      alf.forEach((s, k) => {
        const par = [Ta[p][k], Tb[q][k]], c = par.join(',');
        if (!idx.has(c)) { idx.set(c, pares.length); pares.push(par); }
        trans.push([i, s, idx.get(c)]);
      });
    }
    return {
      pares,
      dfa: A.construir({
        n: pares.length, nombres: pares.map(([p, q]) => a.nombres[p] + ',' + b.nombres[q]), alf, ini: [0],
        fin: pares.map(([p, q], i) => (op(a.fin.has(p), b.fin.has(q)) ? i : -1)).filter((i) => i >= 0), trans,
      }),
    };
  };

  // Búsqueda en anchura sobre pares de estados (AFD completos o NFA, que se determinizan): la palabra más corta
  // que lleva a un par donde pred(enA, enB) es verdadero, con su camino. null si no existe.
  A.buscarProducto = function (a, b, pred) {
    const alf = [...new Set([...a.alf, ...b.alf])].filter((s) => s !== A.E).sort();
    const norm = (x) => { const y = A.copiar(x); y.alf = alf; return A.esDet(y) ? A.completar(y) : A.determinizar(y).dfa; };
    const da = norm(a), db = norm(b);
    const mk = (d) => { const T = alf.map((s) => { const k = d.alf.indexOf(s); return k; }); const D = A.delta(d); return D.map((f) => T.map((k) => (k < 0 ? -1 : f[k]))); };
    const Ta = mk(da), Tb = mk(db);
    const inicio = [da.ini[0], db.ini[0]];
    const previo = new Map([[inicio.join(','), null]]);
    const cola = [inicio];
    for (let h = 0; h < cola.length; h++) {
      const [p, q] = cola[h];
      if (pred(da.fin.has(p), db.fin.has(q))) {
        const camino = [];
        let c = [p, q].join(',');
        while (previo.get(c)) { const x = previo.get(c); camino.unshift(x.s); c = x.de; }
        return { palabra: camino.join(''), par: [p, q], visitados: cola.length };
      }
      alf.forEach((s, k) => {
        if (Ta[p][k] < 0 || Tb[q][k] < 0) return;
        const par = [Ta[p][k], Tb[q][k]], c = par.join(',');
        if (!previo.has(c)) { previo.set(c, { de: [p, q].join(','), s }); cola.push(par); }
      });
    }
    return { palabra: null, visitados: cola.length };
  };
  // Palabra más corta aceptada (vacuidad) y camino de estados.
  A.vacio = function (aut) {
    const previo = new Map(), ini = A.inicial(aut);
    const clave = (S) => ord(S).join(',');
    previo.set(clave(ini), null);
    const cola = [ini];
    for (let h = 0; h < cola.length; h++) {
      if (A.hayFinal(aut, cola[h])) {
        const w = []; let c = clave(cola[h]);
        while (previo.get(c)) { const x = previo.get(c); w.unshift(x.s); c = x.de; }
        return { vacio: false, palabra: w.join('') };
      }
      for (const s of aut.alf) {
        const T = A.paso(aut, cola[h], s), k = clave(T);
        if (T.size && !previo.has(k)) { previo.set(k, { de: clave(cola[h]), s }); cola.push(T); }
      }
    }
    return { vacio: true, palabra: null };
  };

  /* ---------- Minimización ---------- */

  // Pares distinguibles de un AFD completo. pal[i][j] = palabra más corta que los distingue (null si equivalentes);
  // ronda[i][j] = longitud de esa palabra (ronda del algoritmo de tabla).
  A.distinguir = function (d) {
    const n = d.n, T = A.delta(d);
    const pal = Array.from({ length: n }, () => Array(n).fill(null));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (d.fin.has(i) !== d.fin.has(j)) pal[i][j] = '';
    let cambio = true, ronda = 0;
    while (cambio) {
      cambio = false; ronda++;
      const nuevos = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        if (pal[i][j] !== null) continue;
        for (let k = 0; k < d.alf.length; k++) {
          const w = pal[T[i][k]][T[j][k]];
          if (w !== null) { nuevos.push([i, j, d.alf[k] + w]); break; }
        }
      }
      for (const [i, j, w] of nuevos) { pal[i][j] = pal[j][i] = w; cambio = true; }
    }
    return pal;
  };
  // Particiones sucesivas (Moore): P0 = {F, Q∖F}; cada ronda separa los estados cuyos destinos caen en clases distintas.
  A.particiones = function (d) {
    const T = A.delta(d);
    let cls = d.nombres.map((_, q) => (d.fin.has(q) ? 1 : 0));
    const hist = [cls];
    for (;;) {
      const claves = new Map();
      const nuevo = cls.map((c, q) => {
        const k = c + '|' + T[q].map((j) => cls[j]).join(',');
        if (!claves.has(k)) claves.set(k, claves.size);
        return claves.get(k);
      });
      if (new Set(nuevo).size === new Set(cls).size) break;
      cls = nuevo; hist.push(cls);
    }
    return hist;
  };
  // AFD mínimo: poda los inalcanzables, completa y fusiona los equivalentes.
  A.minimizar = function (d0) {
    const d = A.completar(A.podar(d0));
    const hist = A.particiones(d), cls = hist[hist.length - 1];
    const m = new Map(), orden = [];
    cls.forEach((c, q) => { if (!m.has(c)) { m.set(c, m.size); orden.push([]); } orden[m.get(c)].push(q); });
    const min = A.construir({
      n: orden.length, nombres: orden.map((g) => (g.length === 1 ? d.nombres[g[0]] : '{' + g.map((q) => d.nombres[q]).join(',') + '}')), alf: d.alf,
      ini: [m.get(cls[d.ini[0]])], fin: orden.map((g, i) => (d.fin.has(g[0]) ? i : -1)).filter((i) => i >= 0),
      trans: d.aristas.map((e) => [m.get(cls[e.de]), e.s, m.get(cls[e.a])]).filter((t, i, a) => a.findIndex((u) => u[0] === t[0] && u[1] === t[1]) === i),
    });
    return { min, depurado: d, hist, clase: cls.map((c) => m.get(c)), clases: orden };
  };

  /* ---------- Expresiones regulares ---------- */

  // Sintaxis: | unión, yuxtaposición, * + ? postfijos, ( ), ε, ∅, \ escapa. Devuelve { ast } o { error, pos }.
  A.parsear = function (texto) {
    let p = 0;
    const err = (m) => { throw { error: m, pos: p }; };
    const fin = () => p >= texto.length;
    function uni() {
      let x = cat();
      while (texto[p] === '|') { p++; x = { t: 'uni', a: x, b: cat() }; }
      return x;
    }
    function cat() {
      let x = null;
      while (!fin() && texto[p] !== '|' && texto[p] !== ')') { const y = post(); x = x ? { t: 'cat', a: x, b: y } : y; }
      return x || { t: 'eps' };
    }
    function post() {
      let x = atomo();
      while (!fin() && '*+?'.includes(texto[p])) {
        const o = texto[p++];
        x = o === '*' ? { t: 'est', a: x } : o === '+' ? { t: 'cat', a: x, b: { t: 'est', a: x }, mas: true } : { t: 'uni', a: x, b: { t: 'eps' }, opc: true };
      }
      return x;
    }
    function atomo() {
      const c = texto[p];
      if (c === '(') { p++; const x = uni(); if (texto[p] !== ')') err('falta cerrar el paréntesis'); p++; return x; }
      if (c === '[') {
        p++;
        const set = [];
        while (texto[p] !== ']') {
          if (fin()) err('falta cerrar el corchete');
          let a = texto[p++];
          if (a === '\\') a = texto[p++];
          if (texto[p] === '-' && p + 1 < texto.length && texto[p + 1] !== ']') {
            const b = texto[p + 1];
            p += 2;
            for (let k = a.charCodeAt(0); k <= b.charCodeAt(0); k++) set.push(String.fromCharCode(k));
          } else set.push(a);
        }
        p++;
        if (!set.length) return { t: 'vacio' };
        return set.map((ch) => ({ t: 'sim', c: ch })).reduce((x, y) => ({ t: 'uni', a: x, b: y }));
      }
      if ('*+?'.includes(c)) err('el operador «' + c + '» no tiene a qué aplicarse');
      if (c === '\\') { p++; if (fin()) err('escape incompleto'); return { t: 'sim', c: texto[p++] }; }
      p++;
      if (c === 'ε') return { t: 'eps' };
      if (c === '∅') return { t: 'vacio' };
      return { t: 'sim', c };
    }
    try {
      const ast = uni();
      if (!fin()) err('paréntesis sin pareja');
      return { ast };
    } catch (e) { if (e && e.error) return e; throw e; }
  };
  A.aTexto = function (x, prec = 0) {
    const par = (s, mine) => (mine < prec ? '(' + s + ')' : s);
    switch (x.t) {
      case 'sim': return '*+?|()\\'.includes(x.c) ? '\\' + x.c : x.c;
      case 'eps': return 'ε';
      case 'vacio': return '∅';
      case 'est': return A.aTexto(x.a, 3) + '*';
      case 'cat': return par(A.aTexto(x.a, 2) + A.aTexto(x.b, 2), 2);
      case 'uni': return par(A.aTexto(x.a, 1) + '|' + A.aTexto(x.b, 1), 1);
    }
  };
  // Subexpresiones en posorden (hojas primero), para construir paso a paso.
  A.posorden = function (x, res = []) {
    if (x.a) A.posorden(x.a, res);
    if (x.b) A.posorden(x.b, res);
    res.push(x);
    return res;
  };
  // Construcción de Thompson: un estado inicial, un solo estado final, ε-transiciones.
  A.thompson = function (ast) {
    let n = 0;
    const trans = [], E = A.E, nuevo = () => n++;
    function f(x) {
      switch (x.t) {
        case 'sim': { const i = nuevo(), o = nuevo(); trans.push([i, x.c, o]); return [i, o]; }
        case 'eps': { const i = nuevo(), o = nuevo(); trans.push([i, E, o]); return [i, o]; }
        case 'vacio': { const i = nuevo(), o = nuevo(); return [i, o]; }
        case 'cat': { const a = f(x.a), b = f(x.b); trans.push([a[1], E, b[0]]); return [a[0], b[1]]; }
        case 'uni': { const i = nuevo(), a = f(x.a), b = f(x.b), o = nuevo(); trans.push([i, E, a[0]], [i, E, b[0]], [a[1], E, o], [b[1], E, o]); return [i, o]; }
        case 'est': { const i = nuevo(), a = f(x.a), o = nuevo(); trans.push([i, E, a[0]], [i, E, o], [a[1], E, a[0]], [a[1], E, o]); return [i, o]; }
      }
    }
    const [i, o] = f(ast);
    return A.construir({ n, ini: [i], fin: [o], trans });
  };
  // Quita las ε-transiciones sin cambiar el número de estados (y poda lo inalcanzable).
  A.sinEpsilon = function (aut) {
    const trans = [], fin = [];
    for (let q = 0; q < aut.n; q++) {
      const cl = A.clausura(aut, new Set([q]));
      if (A.hayFinal(aut, cl)) fin.push(q);
      for (const s of aut.alf) if (s !== A.E) for (const t of A.paso(aut, cl, s)) trans.push([q, s, t]);
    }
    return A.podar(A.construir({ n: aut.n, nombres: aut.nombres, alf: aut.alf.filter((s) => s !== A.E), ini: aut.ini, fin, trans }));
  };
  // Alfabeto de una expresión.
  A.alfabetoDe = (ast) => [...new Set(A.posorden(ast).filter((x) => x.t === 'sim').map((x) => x.c))].sort();
  // Expresión → AFN con alfabeto fijado.
  A.deRegex = function (texto, alf) {
    const r = A.parsear(texto);
    if (r.error) return r;
    const n = A.thompson(r.ast);
    if (alf) n.alf = alf;
    return { ast: r.ast, nfa: n };
  };

  /* ---------- Búsqueda de cadenas ---------- */

  // Función de prefijos (π): longitud del borde más largo de p[0..i].
  A.prefijos = function (p) {
    const pi = Array(p.length).fill(0);
    for (let i = 1, k = 0; i < p.length; i++) {
      while (k > 0 && p[i] !== p[k]) k = pi[k - 1];
      if (p[i] === p[k]) k++;
      pi[i] = k;
    }
    return pi;
  };
  // Búsqueda ingenua: eventos { i (inicio de la ventana), j (posición en el patrón), ok, fin? }.
  A.ingenua = function (t, p) {
    const ev = [], occ = [];
    let cmp = 0;
    for (let i = 0; i + p.length <= t.length; i++) {
      let j = 0;
      for (; j < p.length; j++) { cmp++; const ok = t[i + j] === p[j]; ev.push({ i, j, ok, cmp }); if (!ok) break; }
      if (j === p.length) occ.push(i);
    }
    return { ev, occ, cmp };
  };
  // KMP: eventos { i (posición en el texto), j (caracteres ya emparejados), ok, salto? } sin retroceder en el texto.
  A.kmp = function (t, p) {
    const pi = A.prefijos(p), ev = [], occ = [];
    let cmp = 0, j = 0;
    for (let i = 0; i < t.length; i++) {
      for (;;) {
        cmp++;
        const ok = t[i] === p[j];
        ev.push({ i, j, ok, cmp, inicio: i - j });
        if (ok) { j++; break; }
        if (j === 0) break;
        j = pi[j - 1];
      }
      if (j === p.length) { occ.push(i - j + 1); j = pi[j - 1]; }
    }
    return { ev, occ, cmp, pi };
  };

  /* ---------- Dibujo ---------- */

  const flecha = (ctx, x, y, ang, color, tam = 7) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-tam, -tam * 0.45); ctx.lineTo(-tam, tam * 0.45); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  A.flecha = flecha;

  // Posición en píxeles de cada estado: columnas por distancia desde el inicial, o aut.pos (0..1) si existe.
  A.disponer = function (aut, caja, r, rx = r) {
    const izq = rx + 30, der = rx + 10, hayLazo = aut.aristas.some((e) => e.de === e.a);
    const arr = hayLazo ? r * 3 + 6 : r + 10, aba = r + 10;
    const wMax = Math.max(10, caja.w - izq - der), h = Math.max(10, caja.h - arr - aba);
    if (aut.pos) {
      const w = Math.min(wMax, 520), x0 = caja.x + izq + (wMax - w) / 2;
      return aut.pos.map(([u, v]) => [x0 + u * w, caja.y + arr + v * h]);
    }
    const prof = Array(aut.n).fill(-1), cola = [];
    for (const q of aut.ini) { prof[q] = 0; cola.push(q); }
    for (let k = 0; k < cola.length; k++) for (const e of ady(aut)[cola[k]]) if (prof[e.a] < 0) { prof[e.a] = prof[cola[k]] + 1; cola.push(e.a); }
    let mx = Math.max(0, ...prof);
    for (let q = 0; q < aut.n; q++) if (prof[q] < 0) prof[q] = mx + 1;
    mx = Math.max(0, ...prof);
    const w = Math.min(wMax, mx * 175), x0 = caja.x + izq + (wMax - w) / 2;
    const cols = Array.from({ length: mx + 1 }, () => []);
    const orden = [...cola, ...Array.from({ length: aut.n }, (_, q) => q).filter((q) => !cola.includes(q))];
    for (const q of orden) cols[prof[q]].push(q);
    const pos = Array(aut.n);
    cols.forEach((col, c) => col.forEach((q, k) => {
      pos[q] = [x0 + (mx ? (c * w) / mx : w / 2), caja.y + arr + (col.length > 1 ? (k * h) / (col.length - 1) : h / 2)];
    }));
    return pos;
  };

  const bez = (p0, p1, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];

  /* Dibuja el diagrama de transición. op:
       caja {x,y,w,h}, radio, nodo(i) → { relleno, borde, ancho, tinta }, arista(de, a, símbolos) → { color, ancho, guiones, texto },
       etiqueta(arista) → texto de una arista, mostrarIni (true), nombres (true).
     Devuelve { pos, r } para tooltips y clics. */
  A.dibujar = function (lienzo, aut, op = {}) {
    const { ctx } = lienzo;
    const caja = op.caja || { x: 0, y: 0, w: lienzo.ancho, h: lienzo.alto };
    const r = op.radio || (aut.n > 12 ? 12 : 16);
    ctx.font = VIZ.fuente(r > 13 ? 11 : 10, 600);
    const pil = op.pildora != null ? op.pildora : aut.nombres.some((n) => n.length > 4);
    const hw = aut.nombres.map((n) => (pil ? Math.max(r, Math.ceil(ctx.measureText(n).width / 2) + 9) : r));
    const pos = A.disponer(aut, caja, r, Math.max(...hw));
    const rad = (q, ux, uy) => {
      if (!pil) return r;
      const a = Math.abs(ux) < 1e-6 ? Infinity : hw[q] / Math.abs(ux), b = Math.abs(uy) < 1e-6 ? Infinity : r / Math.abs(uy);
      return Math.min(a, b);
    };
    const grupos = new Map();
    for (const e of aut.aristas) {
      const k = e.de + '>' + e.a;
      if (!grupos.has(k)) grupos.set(k, { de: e.de, a: e.a, simbolos: [] });
      const lab = op.etiqueta ? op.etiqueta(e) : e.s;
      const g = grupos.get(k);
      if (!g.simbolos.includes(lab)) g.simbolos.push(lab);
    }
    const choca = (curva, excepto) => {
      for (let t = 0.08; t < 0.93; t += 0.07) {
        const [x, y] = bez(curva[0], curva[1], curva[2], t);
        for (let q = 0; q < aut.n; q++) if (!excepto.includes(q) && Math.hypot((x - pos[q][0]) * (r / hw[q]), y - pos[q][1]) < r + 3) return true;
      }
      return false;
    };
    ctx.save();
    ctx.lineJoin = 'round';
    for (const g of grupos.values()) {
      const est = Object.assign({ color: C.tinta2, ancho: 1.5, guiones: null }, op.arista ? op.arista(g.de, g.a, g.simbolos) : null);
      let texto = est.texto != null ? est.texto : g.simbolos.join(',');
      const maxE = op.maxEtiqueta || 14;
      if (texto.length > maxE) texto = texto.slice(0, maxE - 1) + '…';
      ctx.strokeStyle = est.color; ctx.lineWidth = est.ancho; ctx.setLineDash(est.guiones || []);
      let lx, ly;
      if (g.de === g.a) {
        const [x, y] = pos[g.de];
        const p0 = [x - r * 0.62, y - r * 0.78], p3 = [x + r * 0.62, y - r * 0.78];
        ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(x - r * 1.5, y - r * 2.9, x + r * 1.5, y - r * 2.9, ...p3); ctx.stroke();
        ctx.setLineDash([]);
        flecha(ctx, p3[0], p3[1], Math.atan2(p3[1] - (y - r * 2.9), p3[0] - (x + r * 1.5)), est.color, 6);
        lx = x; ly = y - r * 2.25 - 6;
      } else {
        const P = pos[g.de], Q = pos[g.a];
        const dx = Q[0] - P[0], dy = Q[1] - P[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
        const inversa = grupos.has(g.a + '>' + g.de);
        const cand = inversa ? [24, 42, 62] : [0, 34, -34, 62, -62];
        let c = null, bend = cand[0];
        for (const f of cand) {
          const m = [(P[0] + Q[0]) / 2 + nx * f, (P[1] + Q[1]) / 2 + ny * f];
          const cu = [P, [2 * m[0] - (P[0] + Q[0]) / 2, 2 * m[1] - (P[1] + Q[1]) / 2], Q];
          if (!choca(cu, [g.de, g.a])) { c = cu; bend = f; break; }
        }
        if (!c) { const f = cand[0]; bend = f; c = [P, [(P[0] + Q[0]) / 2 + nx * f * 2, (P[1] + Q[1]) / 2 + ny * f * 2], Q]; }
        const ctrl = c[1];
        const u0 = Math.hypot(ctrl[0] - P[0], ctrl[1] - P[1]) || 1, u1 = Math.hypot(ctrl[0] - Q[0], ctrl[1] - Q[1]) || 1;
        const v0 = [(ctrl[0] - P[0]) / u0, (ctrl[1] - P[1]) / u0], v1 = [(ctrl[0] - Q[0]) / u1, (ctrl[1] - Q[1]) / u1];
        const r0 = rad(g.de, v0[0], v0[1]), r1 = rad(g.a, v1[0], v1[1]) + 1.5;
        const s0 = [P[0] + v0[0] * r0, P[1] + v0[1] * r0];
        const s1 = [Q[0] + v1[0] * r1, Q[1] + v1[1] * r1];
        ctx.beginPath(); ctx.moveTo(...s0); ctx.quadraticCurveTo(ctrl[0], ctrl[1], ...s1); ctx.stroke();
        ctx.setLineDash([]);
        flecha(ctx, s1[0], s1[1], Math.atan2(s1[1] - ctrl[1], s1[0] - ctrl[0]), est.color, 7);
        const m = bez(s0, ctrl, s1, 0.5), sg = Math.sign(bend) || -1;
        // la etiqueta se separa de la línea hacia el lado donde la curva se abomba (o hacia arriba si es recta)
        const off = bend === 0 ? [0, -1] : [nx * sg, ny * sg];
        lx = m[0] + off[0] * 9; ly = m[1] + off[1] * 9;
        if (bend === 0 && Math.abs(dy) > Math.abs(dx)) { lx = m[0] + 10; ly = m[1]; }
      }
      ctx.setLineDash([]);
      ctx.font = VIZ.fuente(11, est.ancho > 2 ? 700 : 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5; ctx.strokeStyle = C.superficie; ctx.strokeText(texto, lx, ly);
      ctx.fillStyle = est.texto != null || est.ancho > 2 ? est.color : C.tinta; ctx.fillText(texto, lx, ly);
    }
    // estados
    for (let q = 0; q < aut.n; q++) {
      const [x, y] = pos[q];
      const est = Object.assign({ relleno: C.superficie, borde: C.tinta, ancho: 1.5, tinta: C.tinta }, op.nodo ? op.nodo(q) : null);
      ctx.fillStyle = est.relleno; ctx.strokeStyle = est.borde; ctx.lineWidth = est.ancho;
      ctx.beginPath();
      if (pil) ctx.roundRect(x - hw[q], y - r, hw[q] * 2, r * 2, r); else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (aut.fin.has(q)) { ctx.lineWidth = 1.5; ctx.beginPath(); if (pil) ctx.roundRect(x - hw[q] + 4, y - r + 4, hw[q] * 2 - 8, r * 2 - 8, r - 4); else ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.stroke(); }
      if (op.nombres !== false) {
        let nom = aut.nombres[q];
        const maxc = Math.floor((hw[q] * 2 - 4) / 6.2);
        if (nom.length > maxc) nom = nom.length > maxc + 3 ? nom.slice(0, Math.max(1, maxc - 1)) + '…' : nom;
        ctx.fillStyle = est.tinta; ctx.font = VIZ.fuente(r > 13 ? 11 : 10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(nom, x, y + 0.5);
      }
    }
    if (op.mostrarIni !== false) {
      for (const q of aut.ini) {
        const [x, y] = pos[q];
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - hw[q] - 24, y); ctx.lineTo(x - hw[q] - 1, y); ctx.stroke();
        flecha(ctx, x - hw[q] - 1, y, 0, C.tinta, 7);
      }
    }
    ctx.restore();
    return { pos, r };
  };
  A.nodoEn = (geo, x, y) => {
    for (let q = 0; q < geo.pos.length; q++) if (Math.hypot(x - geo.pos[q][0], y - geo.pos[q][1]) <= geo.r + 3) return q;
    return -1;
  };

  // Cinta con una palabra: celdas con la leída (relleno gris), la actual (anillo naranja) y la pendiente.
  // op: { x, y, ancho, actual (índice de la celda actual, o −1), celda }
  A.cinta = function (ctx, palabra, op) {
    const chars = [...palabra], n = chars.length;
    const celda = op.celda || Math.max(14, Math.min(28, Math.floor(op.ancho / Math.max(1, n + 1))));
    const total = Math.max(1, n) * celda, x0 = op.x + (op.ancho - total) / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = VIZ.fuente(Math.min(14, celda - 6), 600);
    if (!n) { ctx.fillStyle = C.apagado; ctx.fillText('ε (palabra vacía)', op.x + op.ancho / 2, op.y + celda / 2); }
    chars.forEach((ch, k) => {
      const x = x0 + k * celda, leida = k < op.actual, actual = k === op.actual;
      ctx.fillStyle = leida ? C.neutro : C.superficie; ctx.strokeStyle = actual ? C.s2 : C.rejilla; ctx.lineWidth = actual ? 3 : 1;
      ctx.fillRect(x, op.y, celda, celda); ctx.strokeRect(x + 0.5, op.y + 0.5, celda - 1, celda - 1);
      ctx.fillStyle = leida ? C.tinta2 : C.tinta; ctx.fillText(ch, x + celda / 2, op.y + celda / 2 + 0.5);
    });
    ctx.restore();
    return { x0, celda };
  };

  // Tabla de transición de un AFD/AFN como HTML. marca(i, k) devuelve true para la celda a resaltar.
  A.tablaHTML = function (padre, aut, { marca = () => false, filaActiva = () => false } = {}) {
    const alf = aut.alf.filter((s) => s !== A.E).concat(aut.aristas.some((e) => e.s === A.E) ? [A.E] : []);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const t = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(t);
    padre.appendChild(caja);
    return {
      caja,
      dibujar() {
        const filas = [VIZ.el('tr', null, VIZ.el('th', null, 'δ'), alf.map((s) => VIZ.el('th', null, s)))];
        for (let q = 0; q < aut.n; q++) {
          const marcaIni = aut.ini.includes(q) ? '→ ' : '', marcaFin = aut.fin.has(q) ? '* ' : '';
          filas.push(VIZ.el('tr', { class: filaActiva(q) ? 'activa' : null },
            VIZ.el('td', { class: 'izq' }, marcaIni + marcaFin + aut.nombres[q]),
            alf.map((s, k) => {
              const ds = ady(aut)[q].filter((e) => e.s === s).map((e) => aut.nombres[e.a]);
              return VIZ.el('td', { style: marca(q, k) ? { background: VIZ.alfa(C.s2, 0.25), fontWeight: 700 } : null }, ds.length ? (aut.ini.length > 1 || ds.length > 1 || !A.esDet(aut) ? '{' + ds.join(',') + '}' : ds[0]) : '—');
            })));
        }
        t.replaceChildren(...filas);
      },
    };
  };

  // Estilo estándar de estados según un conjunto de estados activos y un estado «actual».
  A.estiloConjunto = (activos, { color = C.s1, aceptado = false, fin = null } = {}) => (q) => {
    if (!activos.has(q)) return null;
    const c = aceptado || (fin && fin.has(q)) ? C.s6 : color;
    return { relleno: VIZ.alfa(c, 0.28), borde: c, ancho: 3 };
  };
  /* ---------- Figura estándar: ejecutar un autómata sobre una palabra ---------- */

  // op: { ejemplos: [{ nombre, aut, palabra, nota? }], tabla (bool), alto (px del diagrama), nota (html) }
  // Funciona con AFD, AFN y ε-AFN: el estado activo es siempre un conjunto de estados.
  A.figuraEjecucion = function (cuerpo, op) {
    const ejs = op.ejemplos;
    let ej = ejs[0], palabra = ej.palabra || '', pos = 0, trazas = [], ultimo = null, mensaje = '', geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata', opciones: ejs.map((e, i) => [i, e.nombre]), valor: 0, alCambiar: (v) => { ej = ejs[+v]; campo.valor = palabra = ej.palabra || ''; if (tab) { tab.caja.remove(); tab = null; crearTabla(); } rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'Palabra', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, ''); rep.reiniciar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, ''); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 52 + (op.alto || 250) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado(s) actual(es)' },
      { color: C.s2, texto: 'transición recién usada', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'acepta' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'rechaza' },
    ]);
    let tab = null;
    function crearTabla() {
      if (!op.tabla) return;
      tab = A.tablaHTML(cuerpo, ej.aut, { filaActiva: (q) => trazas[pos] && trazas[pos].has(q), marca: (q, k) => !!(ultimo && ultimo.k === k && ultimo.de.has(q)) });
      cuerpo.insertBefore(tab.caja, registro);
    }
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, op.nota || 'Pase el cursor sobre un estado para ver sus transiciones. Cambie la palabra y pulse Enter.');
    crearTabla();

    function iniciar() {
      const aut = ej.aut;
      trazas = [A.inicial(aut)]; pos = 0; ultimo = null;
      const chars = [...palabra];
      mensaje = `Se parte de ${A.nombreConj(aut, trazas[0])}${A.tieneEps(aut) ? ' (ya con la ε-clausura)' : ''}. Cada paso lee un símbolo de la cinta.`;
      return (function* () {
        for (const ch of chars) {
          const prev = trazas[pos], sig = A.paso(aut, prev, ch);
          trazas.push(sig); pos++;
          ultimo = { de: prev, sym: ch, k: aut.alf.indexOf(ch) };
          mensaje = sig.size ? `Lee «${ch}»: ${A.nombreConj(aut, prev)} → ${A.nombreConj(aut, sig)}.` : `Lee «${ch}»: ${A.nombreConj(aut, prev)} no tiene transición con «${ch}»; ningún camino sigue vivo.`;
          yield;
          if (!sig.size) { mensaje += ' La palabra se rechaza.'; return; }
        }
      })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, aut = ej.aut, chars = [...palabra];
      lienzo.limpiar();
      const S = trazas[pos] || new Set(), fin = pos === chars.length || !S.size;
      A.cinta(ctx, palabra, { x: 0, y: 6, ancho: W, actual: pos < chars.length && S.size ? pos : -1 });
      const acepta = A.hayFinal(aut, S), color = fin ? (acepta ? C.s6 : C.s8) : C.s1;
      geo = A.dibujar(lienzo, aut, {
        caja: { x: 0, y: 46, w: W, h: H - 46 },
        nodo: A.estiloConjunto(S, { color: fin && S.size ? (acepta ? C.s6 : C.s8) : C.s1 }),
        arista: (de, a, sims) => {
          if (!ultimo) return null;
          const usada = (ultimo.de.has(de) && sims.includes(ultimo.sym) && S.has(a)) || (sims.includes(A.E) && S.has(de) && S.has(a));
          return usada ? { color: C.s2, ancho: 3 } : null;
        },
      });
      if (fin) mensaje = mensaje.replace(/ ?(Se acepta|Se rechaza|La palabra).*$/, '');
      registro.textContent = mensaje + (fin ? (acepta ? ' Termina en un estado de aceptación: la palabra se acepta.' : (S.size ? ' Termina fuera de los estados de aceptación: la palabra se rechaza.' : '')) : '');
      lectura.set([
        ['símbolos leídos', `${pos} de ${chars.length}`],
        [aut.ini.length > 1 || !A.esDet(aut) ? 'estados activos' : 'estado actual', A.nombreConj(aut, S)],
        ['veredicto', fin ? (acepta ? 'acepta' : 'rechaza') : 'en curso'],
      ]);
      if (tab) tab.dibujar();
      void color;
    }
    lienzo.alDibujar = () => trazas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y), aut = ej.aut;
      if (q < 0) return tip.ocultar();
      const filas = aut.alf.concat(A.tieneEps(aut) ? [A.E] : []).map((s) => {
        const d = [...A.mover(aut, new Set([q]), s)].map((j) => aut.nombres[j]);
        return `${s} → ${d.length ? d.join(', ') : '—'}`;
      });
      tip.mostrar(x, y, `<b>${aut.nombres[q]}</b>${aut.ini.includes(q) ? ' · inicial' : ''}${aut.fin.has(q) ? ' · aceptación' : ''}<br>${filas.join('<br>')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
    return { rep, lienzo };
  };
  /* ---------- Catálogo de AFD de ejemplo ---------- */

  // Cada ejemplo: nombre, descripción, alfabeto, autómata, definición f(w) y qué recuerda cada estado.
  const T = (n, alf, tabla, fin, nombres, pos) => A.desdeTabla({ nombres, alf, tabla, ini: 0, fin, pos });
  const cuenta = (w, c) => [...w].filter((x) => x === c).length;
  A.ejemplos = {
    'par-a': { nombre: 'Número par de a', alf: ['a', 'b'], f: (w) => cuenta(w, 'a') % 2 === 0,
      aut: T(2, ['a', 'b'], [[1, 0], [0, 1]], [0], ['q0', 'q1'], [[0, 0.5], [1, 0.5]]),
      significado: ['cantidad de a par (inicial)', 'cantidad de a impar'] },
    'par-b': { nombre: 'Número par de b', alf: ['a', 'b'], f: (w) => cuenta(w, 'b') % 2 === 0,
      aut: T(2, ['a', 'b'], [[0, 1], [1, 0]], [0], ['q0', 'q1'], [[0, 0.5], [1, 0.5]]),
      significado: ['cantidad de b par (inicial)', 'cantidad de b impar'] },
    'contiene-aba': { nombre: 'Contiene «aba»', alf: ['a', 'b'], f: (w) => w.includes('aba'),
      aut: T(4, ['a', 'b'], [[1, 0], [1, 2], [3, 0], [3, 3]], [3], ['q0', 'q1', 'q2', 'q3']),
      significado: ['nada útil leído', 'terminó en a', 'terminó en ab', 'ya apareció aba (absorbente)'] },
    'no-bb': { nombre: 'Sin dos b seguidas', alf: ['a', 'b'], f: (w) => !w.includes('bb'),
      aut: T(3, ['a', 'b'], [[0, 1], [0, 2], [2, 2]], [0, 1], ['q0', 'q1', 'q2'], [[0, 0.5], [0.5, 0.5], [1, 0.5]]),
      significado: ['último símbolo no es b', 'último símbolo es b', 'ya hubo bb (error)'] },
    'a-antes-b': { nombre: 'a*b* (todas las a antes de las b)', alf: ['a', 'b'], f: (w) => /^a*b*$/.test(w),
      aut: T(3, ['a', 'b'], [[0, 1], [2, 1], [2, 2]], [0, 1], ['q0', 'q1', 'q2'], [[0, 0.5], [0.5, 0.5], [1, 0.5]]),
      significado: ['solo a hasta ahora', 'ya empezaron las b', 'una a después de una b (error)'] },
    'mod3': { nombre: 'Longitud múltiplo de 3', alf: ['a', 'b'], f: (w) => w.length % 3 === 0,
      aut: T(3, ['a', 'b'], [[1, 1], [2, 2], [0, 0]], [0], ['q0', 'q1', 'q2'], [[0, 0.5], [0.5, 0.1], [1, 0.5]]),
      significado: ['longitud ≡ 0 (mod 3)', 'longitud ≡ 1 (mod 3)', 'longitud ≡ 2 (mod 3)'] },
    'termina-01': { nombre: 'Termina en 01', alf: ['0', '1'], f: (w) => w.endsWith('01'),
      aut: T(3, ['0', '1'], [[1, 0], [1, 2], [1, 0]], [2], ['q0', 'q1', 'q2']),
      significado: ['no termina en 0', 'termina en 0', 'termina en 01 (acepta)'] },
    'div3': { nombre: 'Binario divisible por 3', alf: ['0', '1'], f: (w) => [...w].reduce((r, c) => (2 * r + +c) % 3, 0) === 0,
      aut: T(3, ['0', '1'], [[0, 1], [2, 0], [1, 2]], [0], ['r0', 'r1', 'r2'], [[0, 0.5], [1, 0.05], [1, 0.95]]),
      significado: ['valor ≡ 0 (mod 3)', 'valor ≡ 1 (mod 3)', 'valor ≡ 2 (mod 3)'] },
    'par-a-par-b': { nombre: 'Pares de a y pares de b', alf: ['a', 'b'], f: (w) => cuenta(w, 'a') % 2 === 0 && cuenta(w, 'b') % 2 === 0,
      aut: T(4, ['a', 'b'], [[1, 2], [0, 3], [3, 0], [2, 1]], [0], ['pp', 'ip', 'pi', 'ii'], [[0, 0], [1, 0], [0, 1], [1, 1]]),
      significado: ['a par y b par', 'a impar y b par', 'a par y b impar', 'a impar y b impar'] },
  };
  /* ---------- Catálogo de AFN de ejemplo ---------- */

  A.ejemplosAFN = {
    'tercero-final': { nombre: 'Tercer símbolo desde el final es 1', alf: ['0', '1'], f: (w) => w.length >= 3 && w[w.length - 3] === '1',
      aut: A.construir({ n: 4, ini: [0], fin: [3], trans: [[0, ['0', '1'], 0], [0, '1', 1], [1, ['0', '1'], 2], [2, ['0', '1'], 3]], pos: [[0, 0.5], [0.33, 0.5], [0.66, 0.5], [1, 0.5]] }) },
    'aa-o-bb': { nombre: 'Contiene aa o bb', alf: ['a', 'b'], f: (w) => w.includes('aa') || w.includes('bb'),
      aut: A.construir({ n: 4, ini: [0], fin: [3], trans: [[0, ['a', 'b'], 0], [0, 'a', 1], [0, 'b', 2], [1, 'a', 3], [2, 'b', 3], [3, ['a', 'b'], 3]], pos: [[0, 0.5], [0.5, 0.1], [0.5, 0.9], [1, 0.5]] }) },
    'termina-aba': { nombre: 'Termina en aba', alf: ['a', 'b'], f: (w) => w.endsWith('aba'),
      aut: A.construir({ n: 4, ini: [0], fin: [3], trans: [[0, ['a', 'b'], 0], [0, 'a', 1], [1, 'b', 2], [2, 'a', 3]], pos: [[0, 0.5], [0.33, 0.5], [0.66, 0.5], [1, 0.5]] }) },
    'dos-iniciales': { nombre: '(ab)* ∪ (ba)* — dos estados iniciales', alf: ['a', 'b'], f: (w) => /^(ab)*$/.test(w) || /^(ba)*$/.test(w),
      aut: A.construir({ n: 4, ini: [0, 2], fin: [0, 2], trans: [[0, 'a', 1], [1, 'b', 0], [2, 'b', 3], [3, 'a', 2]], pos: [[0, 0.1], [1, 0.1], [0, 0.9], [1, 0.9]] }) },
  };
  /* ---------- Semántica de expresiones regulares ---------- */

  // L(r) restringido a palabras de longitud ≤ N, como Set (semántica denotacional por recursión estructural).
  A.lenguaje = function (x, N) {
    const cat = (P, Q) => { const R = new Set(); for (const u of P) for (const v of Q) if (u.length + v.length <= N) R.add(u + v); return R; };
    switch (x.t) {
      case 'sim': return N >= 1 ? new Set([x.c]) : new Set();
      case 'eps': return new Set(['']);
      case 'vacio': return new Set();
      case 'uni': return new Set([...A.lenguaje(x.a, N), ...A.lenguaje(x.b, N)]);
      case 'cat': return cat(A.lenguaje(x.a, N), A.lenguaje(x.b, N));
      case 'est': {
        const L = A.lenguaje(x.a, N);
        let S = new Set(['']);
        for (;;) { const T = new Set([...S, ...cat(S, L)]); if (T.size === S.size) return S; S = T; }
      }
    }
  };
  A.ordenar = (S) => [...S].sort((u, v) => u.length - v.length || (u < v ? -1 : u > v ? 1 : 0));
  // Árbol para VIZ.web.arbol: { texto, hijos, ast }.
  A.arbolRegex = function (x) {
    const t = { sim: x.c, eps: 'ε', vacio: '∅', cat: '·', uni: '|', est: '*' }[x.t];
    return { texto: t, ast: x, hijos: [x.a, x.b].filter(Boolean).map(A.arbolRegex) };
  };
  /* ---------- Motor con retroceso (para comparar con el autómata) ---------- */

  // Búsqueda con retroceso sobre el AST, coincidencia de la palabra completa. Cuenta cada llamada.
  A.retroceso = function (ast, w, { tope = 1e5, maxTraza = 300 } = {}) {
    let pasos = 0;
    const traza = [], parar = {};
    function m(x, i, k) {
      if (++pasos > tope) throw parar;
      switch (x.t) {
        case 'sim': {
          const ok = i < w.length && w[i] === x.c;
          const e = { i, c: x.c, ok, retro: false };
          if (traza.length < maxTraza) traza.push(e);
          if (!ok) return false;
          const r = k(i + 1);
          if (!r) e.retro = true;
          return r;
        }
        case 'eps': return k(i);
        case 'vacio': return false;
        case 'cat': return m(x.a, i, (j) => m(x.b, j, k));
        case 'uni': return m(x.a, i, k) || m(x.b, i, k);
        case 'est': return m(x.a, i, (j) => j > i && m(x, j, k)) || k(i);
      }
    }
    try { const ok = m(ast, 0, (i) => i === w.length); return { ok, pasos, traza, cortado: false }; } catch (e) { if (e === parar) return { ok: false, pasos, traza, cortado: true }; throw e; }
  };
  // Trabajo de la simulación del AFN: estados activos examinados en cada símbolo.
  A.pasosNFA = function (nfa, w) {
    let S = A.inicial(nfa), c = S.size;
    for (const ch of w) { S = A.paso(nfa, S, ch); c += S.size + 1; }
    return c;
  };
  // Autómata combinado de varias reglas léxicas (reglas: [{ nombre, re }]) con etiqueta de regla por estado del AFD.
  A.combinar = function (reglas) {
    let n = 1;
    const trans = [], fin = [], dueno = new Map(), ini = 0;
    reglas.forEach((r, ri) => {
      const x = A.parsear(r.re);
      if (x.error) throw new Error(`${r.nombre}: ${x.error}`);
      const t = A.thompson(x.ast);
      for (const e of t.aristas) trans.push([e.de + n, e.s, e.a + n]);
      trans.push([ini, A.E, t.ini[0] + n]);
      for (const f of t.fin) { fin.push(f + n); dueno.set(f + n, ri); }
      n += t.n;
    });
    const nfa = A.construir({ n, ini: [ini], fin, trans });
    const det = A.determinizar(nfa, { trampa: false });
    let regla = det.subs.map((S) => { let m = -1; for (const q of S) if (dueno.has(q) && (m < 0 || dueno.get(q) < m)) m = dueno.get(q); return m; });
    // Minimización respetando la regla de cada estado (no se fusionan estados con tokens distintos).
    const d0 = det.dfa, T = A.delta(d0);
    let cls = regla.map((r) => r + 1);
    for (;;) {
      const claves = new Map();
      const nuevo = cls.map((c, q) => { const k = c + '|' + T[q].map((j) => (j < 0 ? -1 : cls[j])).join(','); if (!claves.has(k)) claves.set(k, claves.size); return claves.get(k); });
      if (new Set(nuevo).size === new Set(cls).size) break;
      cls = nuevo;
    }
    const ids = new Map(), orden = [];
    cls.forEach((c, q) => { if (!ids.has(c)) { ids.set(c, ids.size); orden.push(q); } });
    const perm = (i) => i; // el estado 0 del AFD (inicial) queda como clase 0
    const tr2 = [];
    d0.aristas.forEach((e) => { const t = [perm(ids.get(cls[e.de])), e.s, perm(ids.get(cls[e.a]))]; if (!tr2.some((u) => u[0] === t[0] && u[1] === t[1])) tr2.push(t); });
    const reglaMin = Array(orden.length);
    orden.forEach((q, i) => { reglaMin[perm(i)] = regla[q]; });
    det.dfa = A.construir({ n: orden.length, nombres: orden.map((_, i) => 's' + i), alf: d0.alf, ini: [0], fin: reglaMin.map((r, i) => (r >= 0 ? i : -1)).filter((i) => i >= 0), trans: tr2 });
    regla = reglaMin;
    return { dfa: det.dfa, regla, nfa };
  };
  /* ---------- Dibujo de búsqueda de patrones ---------- */

  // Texto y patrón alineados. e: { inicio (posición del patrón), j (símbolos ya emparejados), ok (resultado de la
  // comparación actual, o null), occ: [posiciones de inicio encontradas], saltoDesde? }
  A.dibujarAlineado = function (ctx, W, t, p, e, { pi = null } = {}) {
    const celda = Math.max(13, Math.min(28, Math.floor((W - 76) / Math.max(1, t.length)))), x0 = 66, yT = 26, yP = yT + celda + 16;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'right';
    ctx.fillText('texto', x0 - 8, yT + celda / 2); ctx.fillText('patrón', x0 - 8, yP + celda / 2);
    ctx.textAlign = 'center';
    const enOcc = new Set();
    for (const o of e.occ || []) for (let k = 0; k < p.length; k++) enOcc.add(o + k);
    [...t].forEach((ch, i) => {
      const x = x0 + i * celda, ventana = e.inicio != null && i >= e.inicio && i < e.inicio + e.j;
      ctx.fillStyle = enOcc.has(i) ? VIZ.alfa(C.s6, 0.3) : ventana ? VIZ.alfa(C.s1, 0.2) : C.superficie; ctx.strokeStyle = enOcc.has(i) ? C.s6 : C.rejilla; ctx.lineWidth = 1;
      ctx.fillRect(x, yT, celda, celda); ctx.strokeRect(x + 0.5, yT + 0.5, celda - 1, celda - 1);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(13, celda - 5), 600); ctx.fillText(ch, x + celda / 2, yT + celda / 2 + 0.5);
      if (celda >= 16 && (i % 5 === 0 || t.length <= 20)) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9); ctx.fillText(String(i), x + celda / 2, yT - 9); }
    });
    if (e.inicio != null) {
      [...p].forEach((ch, k) => {
        const x = x0 + (e.inicio + k) * celda, hecho = k < e.j, actual = k === e.j && e.ok !== null && e.ok !== undefined;
        const col = actual ? (e.ok ? C.s6 : C.s8) : hecho ? C.s6 : null;
        ctx.fillStyle = col ? VIZ.alfa(col, 0.3) : C.superficie; ctx.strokeStyle = col || C.rejilla; ctx.lineWidth = actual ? 3 : 1;
        ctx.fillRect(x, yP, celda, celda); ctx.strokeRect(x + 0.5, yP + 0.5, celda - 1, celda - 1);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(13, celda - 5), 600); ctx.fillText(ch, x + celda / 2, yP + celda / 2 + 0.5);
      });
      if (e.i != null) { ctx.strokeStyle = C.s2; ctx.lineWidth = 2; const xc = x0 + e.i * celda + celda / 2; ctx.beginPath(); ctx.moveTo(xc, yT + celda + 1); ctx.lineTo(xc, yT + celda + 14); ctx.stroke(); }
    }
    ctx.restore();
    return { celda, x0, yT, yP, alto: yP + celda + 12 };
  };
})();
