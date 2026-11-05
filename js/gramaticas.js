/* Gramáticas libres de contexto (VIZ.gram): lectura de texto, derivaciones, árboles, ambigüedad,
   variables productivas / alcanzables, forma normal de Chomsky, CYK y dibujo de árboles de derivación.

   Una gramática es { ini, reglas: [{ izq, der: [símbolos] }] }; der = [] es la producción vacía (ε).
   Variable: letra mayúscula seguida de dígitos o ′ (S, A1, S′). Todo otro carácter es terminal. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = {};
  VIZ.gram = G;

  const esVar = (s) => /^[A-Z][0-9′']*$/.test(s);
  G.esVar = esVar;

  /* ---------- Texto ↔ gramática ---------- */

  function simbolos(texto) {
    const res = [];
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (/\s/.test(c)) continue;
      if (c === 'ε') continue;
      if (/[A-Z]/.test(c)) { let s = c; while (i + 1 < texto.length && /[0-9′']/.test(texto[i + 1])) s += texto[++i]; res.push(s); } else res.push(c);
    }
    return res;
  }
  // «S → aSb | ε», una línea por variable (se aceptan -> y →).
  G.parsear = function (texto) {
    const reglas = [];
    const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lineas.length) return { error: 'La gramática está vacía.' };
    for (const l of lineas) {
      const m = l.match(/^([A-Z][0-9′']*)\s*(?:->|→)\s*(.*)$/);
      if (!m) return { error: `No se entiende la línea «${l}»: use  A → α | β.` };
      for (const alt of m[2].split('|')) reglas.push({ izq: m[1], der: simbolos(alt) });
    }
    return { g: G.limpiarRepetidas({ ini: reglas[0].izq, reglas }) };
  };
  G.limpiarRepetidas = (g) => ({ ...g, reglas: g.reglas.filter((r, i, a) => a.findIndex((u) => u.izq === r.izq && u.der.join(' ') === r.der.join(' ')) === i) });
  G.reglaTexto = (r) => `${r.izq} → ${r.der.length ? r.der.join(' ') : 'ε'}`;
  G.derTexto = (der) => (der.length ? der.join('') : 'ε');
  G.variables = (g) => [...new Set([g.ini, ...g.reglas.map((r) => r.izq), ...g.reglas.flatMap((r) => r.der.filter(esVar))])];
  G.terminales = (g) => [...new Set(g.reglas.flatMap((r) => r.der.filter((s) => !esVar(s))))].sort();
  // Texto agrupado por variable: «S → aSb | ε».
  G.aTexto = function (g) {
    const orden = G.variables(g), lineas = [];
    for (const v of orden) {
      const rs = g.reglas.filter((r) => r.izq === v);
      if (rs.length) lineas.push(`${v} → ${rs.map((r) => G.derTexto(r.der)).join(' | ')}`);
    }
    return lineas.join('\n');
  };
  G.clave = (r) => r.izq + '→' + r.der.join(' ');

  /* ---------- Árboles de derivación ---------- */

  // Todos los árboles de derivación de una palabra (hasta `tope`), con memoria por (variable, i, j).
  // Árbol: { s, r (índice de la regla), h: [hijos] }; un terminal es { s }, y ε es { s: 'ε' } hijo de una regla vacía.
  G.arboles = function (g, palabra, tope = 40) {
    const w = [...palabra], memo = new Map(), enCurso = new Set();
    function parse(v, i, j) {
      const k = v + '|' + i + '|' + j;
      if (memo.has(k)) return memo.get(k);
      if (enCurso.has(k)) return [];
      enCurso.add(k);
      const res = [];
      g.reglas.forEach((r, ri) => {
        if (r.izq !== v) return;
        for (const hs of seq(r.der, 0, i, j)) {
          res.push({ s: v, r: ri, h: r.der.length ? hs : [{ s: 'ε' }] });
          if (res.length >= tope) return;
        }
      });
      enCurso.delete(k);
      memo.set(k, res);
      return res;
    }
    function* seq(der, p, i, j) {
      if (p === der.length) { if (i === j) yield []; return; }
      const s = der[p];
      if (!esVar(s)) { if (i < j && w[i] === s) for (const rest of seq(der, p + 1, i + 1, j)) yield [{ s }, ...rest]; return; }
      for (let m = i; m <= j; m++) {
        for (const t of parse(s, i, m)) for (const rest of seq(der, p + 1, m, j)) yield [t, ...rest];
      }
    }
    return parse(g.ini, 0, w.length).slice(0, tope);
  };
  const hoja = (n) => !n.h;
  G.fruto = (n) => (hoja(n) ? (n.s === 'ε' ? '' : n.s) : n.h.map(G.fruto).join(''));
  G.tamano = (n) => 1 + (n.h ? n.h.reduce((s, x) => s + G.tamano(x), 0) : 0);
  G.altura = (n) => (n.h ? 1 + Math.max(0, ...n.h.map(G.altura)) : 0);
  G.arbolTexto = (n) => (n.h ? `${n.s}(${n.h.map(G.arbolTexto).join(' ')})` : n.s);

  // Derivación a partir de un árbol: lista de formas sentenciales { forma: [símbolos], nodo (el que se expandió), regla }.
  // modo 'izq' expande siempre la variable más a la izquierda; 'der', la más a la derecha.
  G.derivacion = function (g, arbol, modo = 'izq') {
    let forma = [arbol];
    const pasos = [{ forma: forma.map((n) => n.s), nodos: forma, nodo: null, regla: -1 }];
    for (;;) {
      const idx = modo === 'izq' ? forma.findIndex((n) => esVar(n.s)) : forma.length - 1 - [...forma].reverse().findIndex((n) => esVar(n.s));
      if (idx < 0 || idx >= forma.length || !esVar(forma[idx].s)) break;
      const n = forma[idx];
      const hijos = n.h.filter((x) => x.s !== 'ε');
      forma = [...forma.slice(0, idx), ...hijos, ...forma.slice(idx + 1)];
      pasos.push({ forma: forma.map((x) => x.s), nodos: forma, nodo: n, regla: n.r });
    }
    return pasos;
  };

  // Árbol aleatorio (una derivación al azar) con tope de profundidad; devuelve null si no termina.
  G.aleatorio = function (g, rnd, prof = 8) {
    const prod = G.productivas(g).final;
    function gen(v, d) {
      const opciones = g.reglas.map((r, i) => [r, i]).filter(([r]) => r.izq === v && r.der.every((s) => !esVar(s) || prod.has(s)));
      if (!opciones.length) return null;
      // al agotar la profundidad se prefieren las reglas más cortas
      const elegidas = d <= 0 ? opciones.slice().sort((a, b) => a[0].der.filter(esVar).length - b[0].der.filter(esVar).length).slice(0, 1) : opciones;
      const [r, i] = elegidas[Math.floor(rnd() * elegidas.length)];
      const h = r.der.map((s) => (esVar(s) ? gen(s, d - 1) : { s }));
      if (h.some((x) => !x)) return null;
      return { s: v, r: i, h: r.der.length ? h : [{ s: 'ε' }] };
    }
    return gen(g.ini, prof);
  };

  /* ---------- Variables útiles ---------- */

  // Productivas: derivan alguna cadena de terminales. Devuelve cada ronda y el conjunto final.
  G.productivas = function (g) {
    const P = new Set(), rondas = [];
    for (;;) {
      const nuevas = new Set();
      for (const r of g.reglas) if (!P.has(r.izq) && r.der.every((s) => !esVar(s) || P.has(s))) nuevas.add(r.izq);
      if (!nuevas.size) break;
      nuevas.forEach((v) => P.add(v));
      rondas.push([...nuevas]);
    }
    return { rondas, final: P };
  };
  // Alcanzables desde el símbolo inicial (por las reglas dadas).
  G.alcanzables = function (g, reglas = g.reglas) {
    const R = new Set([g.ini]), rondas = [[g.ini]];
    for (;;) {
      const nuevas = new Set();
      for (const r of reglas) if (R.has(r.izq)) for (const s of r.der) if (esVar(s) && !R.has(s)) nuevas.add(s);
      if (!nuevas.size) break;
      nuevas.forEach((v) => R.add(v));
      rondas.push([...nuevas]);
    }
    return { rondas, final: R };
  };
  // Elimina variables improductivas y luego inalcanzables (en ese orden, que es el correcto).
  G.depurar = function (g) {
    const P = G.productivas(g).final;
    const r1 = g.reglas.filter((r) => P.has(r.izq) && r.der.every((s) => !esVar(s) || P.has(s)));
    const g1 = { ini: g.ini, reglas: r1 };
    const R = G.alcanzables(g1).final;
    return { g1, g2: { ini: g.ini, reglas: r1.filter((r) => R.has(r.izq)) } };
  };
  G.anulables = function (g) {
    const N = new Set();
    for (let cambio = true; cambio;) {
      cambio = false;
      for (const r of g.reglas) if (!N.has(r.izq) && r.der.every((s) => esVar(s) && N.has(s))) { N.add(r.izq); cambio = true; }
    }
    return N;
  };

  /* ---------- Forma normal de Chomsky ---------- */

  const sinRepetidas = (reglas) => reglas.filter((r, i, a) => a.findIndex((u) => G.clave(u) === G.clave(r)) === i);
  function fresca(usadas, base) {
    for (let k = 1; ; k++) { const n = base + k; if (!usadas.has(n)) { usadas.add(n); return n; } }
  }

  // Pasos de la transformación: cada uno con { id, titulo, texto, g, nuevas (claves de reglas nuevas) }.
  G.aCNF = function (g0) {
    const pasos = [];
    const usadas = new Set(G.variables(g0));
    const agregar = (id, titulo, texto, g, previo) => {
      const antes = new Set(previo.reglas.map(G.clave));
      pasos.push({ id, titulo, texto, g, nuevas: new Set(g.reglas.map(G.clave).filter((k) => !antes.has(k))) });
    };
    let g = G.limpiarRepetidas(g0);
    pasos.push({ id: 'ORIG', titulo: 'Gramática original', texto: 'Punto de partida.', g, nuevas: new Set() });

    // START: el símbolo inicial no debe aparecer a la derecha
    if (g.reglas.some((r) => r.der.includes(g.ini))) {
      const S0 = fresca(usadas, 'S');
      const h = { ini: S0, reglas: [{ izq: S0, der: [g.ini] }, ...g.reglas] };
      agregar('START', 'START: nuevo símbolo inicial', `${g.ini} aparece a la derecha de alguna regla; se agrega ${S0} → ${g.ini} para que el inicial nunca se use dentro de una derivación.`, h, g);
      g = h;
    } else pasos.push({ id: 'START', titulo: 'START: nuevo símbolo inicial', texto: `${g.ini} no aparece a la derecha de ninguna regla: no hace falta un nuevo inicial.`, g, nuevas: new Set() });

    // DEL: eliminar producciones ε
    const N = G.anulables(g);
    let reglas = [];
    for (const r of g.reglas) {
      let variantes = [[]];
      for (const s of r.der) {
        const sig = [];
        for (const v of variantes) { sig.push([...v, s]); if (esVar(s) && N.has(s)) sig.push(v); }
        variantes = sig;
      }
      for (const v of variantes) if (v.length) reglas.push({ izq: r.izq, der: v });
    }
    if (N.has(g.ini)) reglas.push({ izq: g.ini, der: [] });
    let h = { ini: g.ini, reglas: sinRepetidas(reglas) };
    agregar('DEL', 'DEL: eliminar producciones ε', N.size ? `Variables anulables: ${[...N].join(', ')}. Cada regla se reescribe con y sin cada anulable, y se borran las reglas A → ε${N.has(g.ini) ? ' (salvo la del inicial, porque ε pertenece al lenguaje)' : ''}.` : 'No hay variables anulables: no hay nada que eliminar.', h, g);
    g = h;

    // UNIT: eliminar producciones unitarias A → B
    const unit = (r) => r.der.length === 1 && esVar(r.der[0]);
    const vars = G.variables(g), cierre = new Map(vars.map((v) => [v, new Set([v])]));
    for (let cambio = true; cambio;) {
      cambio = false;
      for (const r of g.reglas) if (unit(r)) for (const [, S] of cierre) if (S.has(r.izq) && !S.has(r.der[0])) { S.add(r.der[0]); cambio = true; }
    }
    reglas = [];
    for (const [A, S] of cierre) for (const B of S) for (const r of g.reglas) if (r.izq === B && !unit(r)) reglas.push({ izq: A, der: r.der });
    const hayUnit = g.reglas.some(unit);
    h = { ini: g.ini, reglas: sinRepetidas(reglas) };
    agregar('UNIT', 'UNIT: eliminar producciones unitarias', hayUnit ? 'Cada regla A → B se reemplaza por A → α para toda regla no unitaria B → α alcanzable desde A por reglas unitarias.' : 'No hay producciones unitarias A → B: no hay nada que eliminar.', h, g);
    g = h;

    // LIMPIAR: variables inútiles
    const d = G.depurar(g);
    agregar('LIMPIAR', 'Quitar variables inútiles', 'Se descartan las variables que no producen palabras o que no se alcanzan desde el inicial; así la forma normal no arrastra reglas muertas.', d.g2, g);
    g = d.g2;

    // TERM: terminales dentro de reglas largas
    const envoltorios = new Map();
    reglas = [];
    const nuevasT = [];
    for (const r of g.reglas) {
      if (r.der.length < 2) { reglas.push(r); continue; }
      reglas.push({ izq: r.izq, der: r.der.map((s) => {
        if (esVar(s)) return s;
        if (!envoltorios.has(s)) { const v = fresca(usadas, 'X'); envoltorios.set(s, v); nuevasT.push({ izq: v, der: [s] }); }
        return envoltorios.get(s);
      }) });
    }
    h = { ini: g.ini, reglas: sinRepetidas([...reglas, ...nuevasT]) };
    agregar('TERM', 'TERM: aislar los terminales', envoltorios.size ? `En las reglas de largo ≥ 2 cada terminal se sustituye por una variable nueva: ${[...envoltorios].map(([a, v]) => `${v} → ${a}`).join(', ')}.` : 'Ninguna regla larga contiene terminales: no hay nada que aislar.', h, g);
    g = h;

    // BIN: reglas de más de dos símbolos
    reglas = [];
    let hubo = false;
    for (const r of g.reglas) {
      if (r.der.length <= 2) { reglas.push(r); continue; }
      hubo = true;
      let izq = r.izq, resto = r.der;
      while (resto.length > 2) {
        const v = fresca(usadas, 'Y');
        reglas.push({ izq, der: [resto[0], v] });
        izq = v; resto = resto.slice(1);
      }
      reglas.push({ izq, der: resto });
    }
    h = { ini: g.ini, reglas: sinRepetidas(reglas) };
    agregar('BIN', 'BIN: partir las reglas largas', hubo ? 'Una regla A → B₁B₂…Bₖ con k > 2 se reemplaza por una cadena de reglas binarias con variables nuevas.' : 'Ninguna regla tiene más de dos símbolos.', h, g);
    return pasos;
  };
  G.esCNF = (g) => g.reglas.every((r) => (r.der.length === 2 && r.der.every(esVar) && r.der[0] !== g.ini && r.der[1] !== g.ini) || (r.der.length === 1 && !esVar(r.der[0])) || (r.der.length === 0 && r.izq === g.ini));

  // CYK sobre una gramática en CNF. tabla[i][l] = conjunto de variables que generan w[i .. i+l−1] (l ≥ 1).
  G.cyk = function (g, palabra) {
    const w = [...palabra], n = w.length;
    const tabla = Array.from({ length: n }, () => Array(n + 1).fill(null).map(() => new Set()));
    for (let i = 0; i < n; i++) for (const r of g.reglas) if (r.der.length === 1 && r.der[0] === w[i]) tabla[i][1].add(r.izq);
    for (let l = 2; l <= n; l++) for (let i = 0; i + l <= n; i++) for (let k = 1; k < l; k++) {
      for (const r of g.reglas) if (r.der.length === 2 && tabla[i][k].has(r.der[0]) && tabla[i + k][l - k].has(r.der[1])) tabla[i][l].add(r.izq);
    }
    const acepta = n === 0 ? g.reglas.some((r) => r.izq === g.ini && !r.der.length) : tabla[0][n].has(g.ini);
    return { tabla, acepta, w };
  };

  /* ---------- Dibujo de árboles ---------- */

  // Calcula posiciones: hojas equiespaciadas, nodos internos centrados sobre sus hijos. Devuelve la lista de nodos con { x, y, prof }.
  function disponer(raiz, caja) {
    const hojas = [];
    (function rec(n, d) { n._d = d; if (!n.h) hojas.push(n); else n.h.forEach((x) => rec(x, d + 1)); })(raiz, 0);
    const alt = Math.max(1, ...hojas.map((h) => h._d));
    const w = caja.w - 30, dy = Math.min(46, (caja.h - 30) / Math.max(1, alt));
    hojas.forEach((h, k) => { h._x = caja.x + 15 + (hojas.length > 1 ? (k * w) / (hojas.length - 1) : w / 2); });
    (function rec(n) { if (n.h) { n.h.forEach(rec); n._x = (n.h[0]._x + n.h[n.h.length - 1]._x) / 2; } n._y = caja.y + 18 + n._d * dy; })(raiz);
    return hojas.length;
  }
  G.nodos = function (raiz, res = []) { res.push(raiz); if (raiz.h) raiz.h.forEach((x) => G.nodos(x, res)); return res; };

  /* Dibuja un árbol de derivación. op: caja, visible(n) → bool (nodos aún no creados no se dibujan),
     estilo(n) → { borde, relleno, tinta, ancho }. */
  G.dibujarArbol = function (lienzo, raiz, op = {}) {
    const { ctx } = lienzo;
    const caja = op.caja || { x: 0, y: 0, w: lienzo.ancho, h: lienzo.alto };
    disponer(raiz, caja);
    const vis = op.visible || (() => true);
    const estilo = (n) => Object.assign({ borde: C.tinta, relleno: C.superficie, tinta: C.tinta, ancho: 1.5 }, op.estilo ? op.estilo(n) : null);
    ctx.save();
    for (const n of G.nodos(raiz)) {
      if (!vis(n) || !n.h) continue;
      for (const c of n.h) {
        if (!vis(c)) continue;
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(n._x, n._y + 12); ctx.lineTo(c._x, c._y - (c.h ? 12 : 9)); ctx.stroke();
      }
    }
    for (const n of G.nodos(raiz)) {
      if (!vis(n)) continue;
      const e = estilo(n);
      ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (n.h) {
        ctx.fillStyle = e.relleno; ctx.strokeStyle = e.borde; ctx.lineWidth = e.ancho;
        ctx.beginPath(); ctx.arc(n._x, n._y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.tinta; ctx.fillText(n.s, n._x, n._y + 0.5, 22);
      } else {
        ctx.fillStyle = e.relleno === C.superficie ? C.neutro : e.relleno; ctx.strokeStyle = e.borde === C.tinta ? C.rejilla : e.borde; ctx.lineWidth = e.ancho > 1.5 ? e.ancho : 1;
        ctx.beginPath(); ctx.roundRect(n._x - 9, n._y - 9, 18, 18, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.tinta; ctx.fillText(n.s, n._x, n._y + 0.5);
      }
    }
    ctx.restore();
  };
  G.nodoEn = function (raiz, x, y, vis = () => true) {
    for (const n of G.nodos(raiz)) if (vis(n) && Math.hypot(x - n._x, y - n._y) < 13) return n;
    return null;
  };
  G.altoArbol = (raiz, dy = 46) => 36 + (Math.max(1, G.altura(raiz)) + 0.3) * dy;
  // Número de árboles de derivación de una palabra (sin construirlos), con memoria. Devuelve un número (tope 1e15).
  G.contarArboles = function (g, palabra) {
    const w = [...palabra], memo = new Map(), memoSeq = new Map(), enCurso = new Set();
    function cuenta(v, i, j) {
      const k = v + '|' + i + '|' + j;
      if (memo.has(k)) return memo.get(k);
      if (enCurso.has(k)) return 0;
      enCurso.add(k);
      let c = 0;
      g.reglas.forEach((r, ri) => { if (r.izq === v) c += seq(ri, 0, i, j); });
      enCurso.delete(k);
      c = Math.min(c, 1e15);
      memo.set(k, c);
      return c;
    }
    function seq(ri, p, i, j) {
      const der = g.reglas[ri].der, k = ri + '|' + p + '|' + i + '|' + j;
      if (memoSeq.has(k)) return memoSeq.get(k);
      let c = 0;
      if (p === der.length) c = i === j ? 1 : 0;
      else if (!esVar(der[p])) c = i < j && w[i] === der[p] ? seq(ri, p + 1, i + 1, j) : 0;
      else for (let m = i; m <= j; m++) { const a = cuenta(der[p], i, m); if (a) c += a * seq(ri, p + 1, m, j); }
      c = Math.min(c, 1e15);
      memoSeq.set(k, c);
      return c;
    }
    return cuenta(g.ini, 0, w.length);
  };
  // Palabras de longitud ≤ max que genera la gramática (derivaciones por la izquierda, con tope de trabajo).
  G.palabras = function (g, max, tope = 60) {
    const res = new Set(), vistos = new Set();
    let cola = [[g.ini]], trabajo = 0;
    while (cola.length && trabajo < 40000 && res.size < tope) {
      const forma = cola.shift(); trabajo++;
      const i = forma.findIndex(esVar);
      if (i < 0) { res.add(forma.join('')); continue; }
      if (forma.filter((s) => !esVar(s)).length > max) continue;
      for (const r of g.reglas) if (r.izq === forma[i]) {
        const nueva = [...forma.slice(0, i), ...r.der, ...forma.slice(i + 1)], k = nueva.join(' ');
        if (nueva.length > max + 6 || vistos.has(k)) continue;
        vistos.add(k); cola.push(nueva);
      }
    }
    return [...res].filter((w) => w.length <= max).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  };
  // Valor aritmético de un árbol de expresiones con a = 2 (para mostrar que dos árboles significan cosas distintas).
  G.evaluar = function (n, val = 2) {
    if (!n.h) return n.s === 'a' ? val : NaN;
    const h = n.h;
    if (h.length === 1) return G.evaluar(h[0], val);
    if (h.length === 3 && h[0].s === '(') return G.evaluar(h[1], val);
    if (h.length === 3) { const x = G.evaluar(h[0], val), y = G.evaluar(h[2], val); return h[1].s === '+' ? x + y : h[1].s === '*' ? x * y : NaN; }
    return NaN;
  };
})();
