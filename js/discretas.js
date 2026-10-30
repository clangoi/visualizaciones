/* Matemáticas discretas (VIZ.disc): analizador y evaluador de fórmulas proposicionales y de predicados,
   tablas de verdad, reescritura con leyes, formas normales (CNF/DNF), DPLL, resolución y dibujo de
   árboles sintácticos. Los temas de lógica y de inducción comparten estas piezas. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = {};
  VIZ.disc = D;

  /* ---------- Análisis sintáctico ---------- */

  // Símbolos aceptados (también en ASCII); los más largos primero.
  const FICHAS = [
    ['<->', 'iff'], ['<=>', 'iff'], ['↔', 'iff'], ['->', 'imp'], ['=>', 'imp'], ['→', 'imp'],
    ['/\\', 'and'], ['∧', 'and'], ['&', 'and'], ['^', 'and'], ['\\/', 'or'], ['∨', 'or'], ['|', 'or'],
    ['¬', 'not'], ['!', 'not'], ['~', 'not'], ['⊕', 'xor'], ['↑', 'nand'], ['↓', 'nor'],
    ['⊤', 'T'], ['⊥', 'F'], ['0', 'F'], ['1', 'T'], ['∀', 'all'], ['∃', 'ex'], ['≠', 'neq'],
    ['(', '('], [')', ')'], [',', ','], ['=', '='], ['.', '.'],
  ].sort((a, b) => b[0].length - a[0].length);

  function lex(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      const w = /^[A-Za-z][A-Za-z0-9'′]*/.exec(s.slice(i));
      if (w) {
        const p = w[0];
        let tipo;
        if (p === 'forall' || p === 'all') tipo = 'all';
        else if (p === 'exists' || p === 'ex') tipo = 'ex';
        else if (/^[a-z][0-9'′]*$/.test(p)) tipo = 'id';
        else if (/^[A-Z]/.test(p)) tipo = 'Pred';
        else throw { msg: `«${p}» no es un nombre válido (variables y constantes: una letra minúscula; predicados: mayúscula)`, pos: i };
        out.push({ tipo, t: p, pos: i });
        i += p.length;
        continue;
      }
      const f = FICHAS.find(([x]) => s.startsWith(x, i));
      if (!f) throw { msg: `el símbolo «${s[i]}» no se reconoce`, pos: i };
      out.push({ tipo: f[1], t: f[0], pos: i });
      i += f[0].length;
    }
    out.push({ tipo: 'fin', t: '', pos: s.length });
    return out;
  }

  // Precedencia: ¬ y cuantificadores > ∧ > ∨ > → (asocia a la derecha) > ↔.
  function parse(s) {
    const T = lex(s);
    let k = 0;
    const mira = () => T[k];
    const fallo = (msg, tok = T[k]) => { throw { msg, pos: tok.pos }; };
    function iff() {
      let l = imp();
      while (mira().tipo === 'iff') { k++; l = { k: 'iff', a: l, b: imp() }; }
      return l;
    }
    function imp() {
      const l = or();
      if (mira().tipo === 'imp') { k++; return { k: 'imp', a: l, b: imp() }; }
      return l;
    }
    function or() {
      let l = and();
      while (['or', 'xor', 'nor'].includes(mira().tipo)) { const o = T[k++].tipo; l = { k: o, a: l, b: and() }; }
      return l;
    }
    function and() {
      let l = un();
      while (['and', 'nand'].includes(mira().tipo)) { const o = T[k++].tipo; l = { k: o, a: l, b: un() }; }
      return l;
    }
    function un() {
      const t = mira();
      if (t.tipo === 'not') { k++; return { k: 'not', a: un() }; }
      if (t.tipo === 'all' || t.tipo === 'ex') {
        k++;
        const v = mira();
        if (v.tipo !== 'id') fallo('después de un cuantificador va una variable (por ejemplo ∀x)');
        k++;
        if (mira().tipo === '.') { k++; return { k: t.tipo, v: v.t, a: iff() }; }
        return { k: t.tipo, v: v.t, a: un() };
      }
      return prim();
    }
    function termino() {
      const t = mira();
      if (t.tipo !== 'id') fallo('se esperaba un término (variable o constante)');
      k++;
      return t.t;
    }
    function prim() {
      const t = mira();
      if (t.tipo === '(') {
        k++;
        const a = iff();
        if (mira().tipo !== ')') fallo('falta cerrar el paréntesis');
        k++;
        return a;
      }
      if (t.tipo === 'T' || t.tipo === 'F') { k++; return { k: 'const', v: t.tipo === 'T' }; }
      if (t.tipo === 'Pred') {
        k++;
        if (mira().tipo !== '(') return { k: 'var', n: t.t };
        k++;
        const args = [termino()];
        while (mira().tipo === ',') { k++; args.push(termino()); }
        if (mira().tipo !== ')') fallo(`falta cerrar el paréntesis de ${t.t}`);
        k++;
        return { k: 'pred', n: t.t, args };
      }
      if (t.tipo === 'id') {
        k++;
        if (mira().tipo === '=' || mira().tipo === 'neq') {
          const neq = mira().tipo === 'neq';
          k++;
          const e = { k: 'eq', x: t.t, y: termino() };
          return neq ? { k: 'not', a: e } : e;
        }
        return { k: 'var', n: t.t };
      }
      return fallo(t.tipo === 'fin' ? 'la fórmula está incompleta' : `no se esperaba «${t.t}» en este lugar`);
    }
    if (T[0].tipo === 'fin') fallo('escriba una fórmula');
    const a = iff();
    if (mira().tipo !== 'fin') fallo(`sobra «${mira().t}»`);
    return a;
  }

  // Devuelve {ast} o {error, pos}.
  D.analizar = function (texto) {
    try { return { ast: parse(texto) }; } catch (e) {
      if (e && e.msg) return { error: e.msg, pos: e.pos };
      throw e;
    }
  };
  D.mensaje = (texto, r) => `Error en la posición ${r.pos + 1} («${texto.slice(0, r.pos)}▮${texto.slice(r.pos)}»): ${r.error}.`;
  D.leer = (texto) => { const r = D.analizar(texto); if (r.error) throw new Error(D.mensaje(texto, r)); return r.ast; };

  /* ---------- Estructura de las fórmulas ---------- */

  const SIM = { and: '∧', or: '∨', imp: '→', iff: '↔', xor: '⊕', nand: '↑', nor: '↓' };
  const PREC = { iff: 1, imp: 2, or: 3, xor: 3, nor: 3, and: 4, nand: 4, not: 5, all: 5, ex: 5 };
  D.SIM = SIM;
  D.esBin = (a) => !!SIM[a.k];
  D.hijos = (a) => (a.k === 'not' || a.k === 'all' || a.k === 'ex' ? [a.a] : SIM[a.k] ? [a.a, a.b] : []);
  D.clonar = (a) => JSON.parse(JSON.stringify(a));
  D.tam = (a) => 1 + D.hijos(a).reduce((s, h) => s + D.tam(h), 0);
  D.prof = (a) => { const h = D.hijos(a); return h.length ? 1 + Math.max(...h.map(D.prof)) : 0; };
  D.hojas = (a) => { const h = D.hijos(a); return h.length ? h.reduce((s, x) => s + D.hojas(x), 0) : 1; };
  D.vars = (a) => {
    const s = new Set();
    (function r(n) { if (n.k === 'var') s.add(n.n); D.hijos(n).forEach(r); })(a);
    return [...s].sort();
  };
  D.mapa = (a, f) => {
    const h = (n) => (n.k === 'not' || n.k === 'all' || n.k === 'ex' ? { ...n, a: D.mapa(n.a, f) } : SIM[n.k] ? { ...n, a: D.mapa(n.a, f), b: D.mapa(n.b, f) } : n);
    return f(h(a));
  };

  // Texto con paréntesis mínimos, en forma de fichas que recuerdan cómo se ligó cada variable.
  D.tokens = function (ast) {
    const out = [];
    const env = new Map();
    const amb = [];
    let nq = 0;
    const push = (t, tipo, extra) => out.push(Object.assign({ t, tipo, amb: amb.slice() }, extra));
    const termino = (t) => { const q = env.get(t); push(t, q ? 'lig' : 'libre', q ? { q } : null); };
    (function em(a, padre, lado) {
      const bin = !!SIM[a.k];
      let par = false;
      if (bin && padre) {
        const pp = PREC[padre.k], p = PREC[a.k];
        par = p < pp || (p === pp && !(a.k === padre.k && (padre.k === 'imp' ? lado === 'b' : ['and', 'or', 'iff'].includes(padre.k))));
      }
      if (par) push('(', 'par');
      switch (a.k) {
        case 'var': push(a.n, 'var'); break;
        case 'const': push(a.v ? '⊤' : '⊥', 'const'); break;
        case 'pred':
          push(a.n, 'pred'); push('(', 'par');
          a.args.forEach((t, i) => { if (i) push(',', 'sep'); termino(t); });
          push(')', 'par');
          break;
        case 'eq': termino(a.x); push(' = ', 'op'); termino(a.y); break;
        case 'not': push('¬', 'op'); em(a.a, a); break;
        case 'all': case 'ex': {
          const id = ++nq;
          amb.push(id);
          push(a.k === 'all' ? '∀' : '∃', 'cuant', { q: id });
          const previo = env.get(a.v);
          env.set(a.v, id);
          push(a.v, 'lig', { q: id, ligadura: true });
          push(' ', 'sep');
          em(a.a, a);
          amb.pop();
          if (previo) env.set(a.v, previo); else env.delete(a.v);
          break;
        }
        default:
          em(a.a, a, 'a');
          push(` ${SIM[a.k]} `, 'op');
          em(a.b, a, 'b');
      }
      if (par) push(')', 'par');
    })(ast, null);
    return out;
  };
  D.texto = (a) => D.tokens(a).map((t) => t.t).join('');
  // Todos los paréntesis explícitos (para mostrar cómo se lee una fórmula).
  D.textoTotal = function tt(a, raiz = true) {
    switch (a.k) {
      case 'not': return '¬' + tt(a.a, false);
      case 'all': case 'ex': return `${a.k === 'all' ? '∀' : '∃'}${a.v} ${tt(a.a, false)}`;
      default:
        if (SIM[a.k]) { const s = `${tt(a.a, false)} ${SIM[a.k]} ${tt(a.b, false)}`; return raiz ? s : `(${s})`; }
        return D.texto(a);
    }
  };
  D.etiqueta = (a) => {
    switch (a.k) {
      case 'var': return a.n;
      case 'const': return a.v ? '⊤' : '⊥';
      case 'not': return '¬';
      case 'all': return '∀' + a.v;
      case 'ex': return '∃' + a.v;
      case 'pred': return a.n + '(' + a.args.join(',') + ')';
      case 'eq': return a.x + '=' + a.y;
      default: return SIM[a.k];
    }
  };
  // Subfórmulas distintas, de las más pequeñas a la fórmula completa.
  D.subformulas = (a) => {
    const vistos = new Map();
    (function r(n) { D.hijos(n).forEach(r); const t = D.texto(n); if (!vistos.has(t)) vistos.set(t, n); })(a);
    return [...vistos].map(([txt, nodo]) => ({ txt, a: nodo }));
  };

  /* ---------- Semántica proposicional ---------- */

  D.evalua = function ev(a, v) {
    switch (a.k) {
      case 'var': return !!v[a.n];
      case 'const': return a.v;
      case 'not': return !ev(a.a, v);
      case 'and': return ev(a.a, v) && ev(a.b, v);
      case 'or': return ev(a.a, v) || ev(a.b, v);
      case 'imp': return !ev(a.a, v) || ev(a.b, v);
      case 'iff': return ev(a.a, v) === ev(a.b, v);
      case 'xor': return ev(a.a, v) !== ev(a.b, v);
      case 'nand': return !(ev(a.a, v) && ev(a.b, v));
      case 'nor': return !(ev(a.a, v) || ev(a.b, v));
      default: return false;
    }
  };
  // Valuaciones en el orden habitual: de «todo V» a «todo F».
  D.valuaciones = (vars) => {
    const n = vars.length;
    return Array.from({ length: 1 << n }, (_, i) => {
      const v = {};
      vars.forEach((x, j) => { v[x] = !((i >> (n - 1 - j)) & 1); });
      return v;
    });
  };
  D.resultados = (a, vars = D.vars(a)) => D.valuaciones(vars).map((v) => D.evalua(a, v));
  D.clase = (res) => (res.every(Boolean) ? 'tautología' : res.some(Boolean) ? 'contingencia' : 'contradicción');
  D.equivalentes = (a, b) => {
    const vars = [...new Set([...D.vars(a), ...D.vars(b)])].sort();
    return D.valuaciones(vars).every((v) => D.evalua(a, v) === D.evalua(b, v));
  };
  D.valTexto = (v, vars) => vars.map((x) => `${x}=${v[x] ? 'V' : 'F'}`).join(', ');

  /* ---------- Leyes de equivalencia ---------- */

  const NO = (a) => ({ k: 'not', a });
  const BI = (k, a, b) => ({ k, a, b });
  D.LEYES = [
    { id: 'dn', nombre: 'Doble negación', f: (a) => (a.k === 'not' && a.a.k === 'not' ? a.a.a : null) },
    { id: 'dmY', nombre: 'De Morgan: ¬(A ∧ B)', f: (a) => (a.k === 'not' && a.a.k === 'and' ? BI('or', NO(a.a.a), NO(a.a.b)) : null) },
    { id: 'dmO', nombre: 'De Morgan: ¬(A ∨ B)', f: (a) => (a.k === 'not' && a.a.k === 'or' ? BI('and', NO(a.a.a), NO(a.a.b)) : null) },
    { id: 'impO', nombre: 'A → B ≡ ¬A ∨ B', f: (a) => (a.k === 'imp' ? BI('or', NO(a.a), a.b) : null) },
    { id: 'contra', nombre: 'Contrapositiva', f: (a) => (a.k === 'imp' ? BI('imp', NO(a.b), NO(a.a)) : null) },
    { id: 'negImp', nombre: '¬(A → B) ≡ A ∧ ¬B', f: (a) => (a.k === 'not' && a.a.k === 'imp' ? BI('and', a.a.a, NO(a.a.b)) : null) },
    { id: 'bicond', nombre: 'A ↔ B ≡ (A → B) ∧ (B → A)', f: (a) => (a.k === 'iff' ? BI('and', BI('imp', a.a, a.b), BI('imp', a.b, a.a)) : null) },
    { id: 'distY', nombre: 'Distribuir ∧ sobre ∨', f: (a) => (a.k !== 'and' ? null : a.b.k === 'or' ? BI('or', BI('and', a.a, a.b.a), BI('and', a.a, a.b.b)) : a.a.k === 'or' ? BI('or', BI('and', a.a.a, a.b), BI('and', a.a.b, a.b)) : null) },
    { id: 'distO', nombre: 'Distribuir ∨ sobre ∧', f: (a) => (a.k !== 'or' ? null : a.b.k === 'and' ? BI('and', BI('or', a.a, a.b.a), BI('or', a.a, a.b.b)) : a.a.k === 'and' ? BI('and', BI('or', a.a.a, a.b), BI('or', a.a.b, a.b)) : null) },
    { id: 'qAll', nombre: '¬∀x A ≡ ∃x ¬A', f: (a) => (a.k === 'not' && a.a.k === 'all' ? { k: 'ex', v: a.a.v, a: NO(a.a.a) } : null) },
    { id: 'qEx', nombre: '¬∃x A ≡ ∀x ¬A', f: (a) => (a.k === 'not' && a.a.k === 'ex' ? { k: 'all', v: a.a.v, a: NO(a.a.a) } : null) },
  ];
  // Aplica la ley en la primera subfórmula donde sirva (de arriba hacia abajo, de izquierda a derecha).
  D.aplicarLey = function (ast, ley) {
    let hecho = false;
    const r = (a) => {
      if (hecho) return a;
      const n = ley.f(a);
      if (n) { hecho = true; return n; }
      if (a.k === 'not' || a.k === 'all' || a.k === 'ex') return { ...a, a: r(a.a) };
      if (SIM[a.k]) { const x = r(a.a); const y = r(a.b); return { ...a, a: x, b: y }; }
      return a;
    };
    const res = r(ast);
    return hecho ? res : null;
  };

  /* ---------- Formas normales y cláusulas ---------- */

  // Forma normal negativa: negaciones solo sobre átomos; elimina →, ↔, ⊕, ↑, ↓.
  D.nnf = function nnf(a, neg = false) {
    const N = (x, n = neg) => nnf(x, n);
    switch (a.k) {
      case 'var': case 'pred': case 'eq': return neg ? NO(a) : a;
      case 'const': return { k: 'const', v: neg ? !a.v : a.v };
      case 'not': return N(a.a, !neg);
      case 'and': return neg ? BI('or', N(a.a), N(a.b)) : BI('and', N(a.a), N(a.b));
      case 'or': return neg ? BI('and', N(a.a), N(a.b)) : BI('or', N(a.a), N(a.b));
      case 'nand': return N(BI('and', a.a, a.b), !neg);
      case 'nor': return N(BI('or', a.a, a.b), !neg);
      case 'imp': return neg ? BI('and', N(a.a, false), N(a.b)) : BI('or', N(a.a, true), N(a.b, false));
      case 'iff': return neg ? BI('or', BI('and', N(a.a, false), N(a.b)), BI('and', N(a.a, true), N(a.b, false)))
        : BI('and', BI('or', N(a.a, true), N(a.b, false)), BI('or', N(a.a, false), N(a.b, true)));
      case 'xor': return N(BI('iff', a.a, a.b), !neg);
      case 'all': return { k: neg ? 'ex' : 'all', v: a.v, a: N(a.a) };
      default: return { k: neg ? 'all' : 'ex', v: a.v, a: N(a.a) };
    }
  };
  D.distribuir = function dist(a, tipo = 'cnf') {
    const Y = tipo === 'cnf' ? 'and' : 'or', O = tipo === 'cnf' ? 'or' : 'and';
    if (a.k === Y) return BI(Y, dist(a.a, tipo), dist(a.b, tipo));
    if (a.k !== O) return a;
    const x = dist(a.a, tipo), y = dist(a.b, tipo);
    const junta = (p, q) => {
      if (p.k === Y) return BI(Y, junta(p.a, q), junta(p.b, q));
      if (q.k === Y) return BI(Y, junta(p, q.a), junta(p, q.b));
      return BI(O, p, q);
    };
    return junta(x, y);
  };
  // Pasos didácticos hacia CNF o DNF: cada uno es {nombre, ast}.
  D.pasosNormal = function (ast, tipo = 'cnf') {
    const pasos = [{ nombre: 'Fórmula original', ast }];
    const sinDer = D.mapa(ast, (n) => {
      if (n.k === 'iff') return BI('and', BI('imp', n.a, n.b), BI('imp', n.b, n.a));
      if (n.k === 'xor') return BI('and', BI('or', n.a, n.b), NO(BI('and', n.a, n.b)));
      if (n.k === 'nand') return NO(BI('and', n.a, n.b));
      if (n.k === 'nor') return NO(BI('or', n.a, n.b));
      return n;
    });
    pasos.push({ nombre: 'Eliminar ↔, ⊕, ↑ y ↓', ast: sinDer });
    const sinImp = D.mapa(sinDer, (n) => (n.k === 'imp' ? BI('or', NO(n.a), n.b) : n));
    pasos.push({ nombre: 'Eliminar →', ast: sinImp });
    const n = D.nnf(sinImp);
    pasos.push({ nombre: 'Llevar las negaciones hasta los átomos (De Morgan)', ast: n });
    if (D.tam(n) < 120) pasos.push({ nombre: tipo === 'cnf' ? 'Distribuir ∨ sobre ∧' : 'Distribuir ∧ sobre ∨', ast: D.distribuir(n, tipo) });
    return pasos;
  };

  // Literales: 'p' y '¬p'.
  D.neg = (l) => (l[0] === '¬' ? l.slice(1) : '¬' + l);
  D.varDe = (l) => (l[0] === '¬' ? l.slice(1) : l);
  D.positivo = (l) => l[0] !== '¬';
  const cmpLit = (a, b) => D.varDe(a).localeCompare(D.varDe(b)) || a.length - b.length;
  D.literal = (a) => (a.k === 'not' ? '¬' + D.texto(a.a) : D.texto(a));

  // Grupos de literales de la CNF (cláusulas) o de la DNF (términos), sin repeticiones ni absorbidos.
  D.forma = function (ast, tipo = 'cnf') {
    const Y = tipo === 'cnf' ? 'and' : 'or', O = tipo === 'cnf' ? 'or' : 'and';
    const limpia = (gs) => {
      const vistos = new Set();
      let out = [];
      for (const g0 of gs) {
        const g = [...new Set(g0)].sort(cmpLit);
        if (g.some((l) => g.includes(D.neg(l)))) continue; // cláusula trivial o término imposible
        const k = g.join('|');
        if (!vistos.has(k)) { vistos.add(k); out.push(g); }
      }
      out = out.filter((g) => !out.some((h) => h !== g && h.length < g.length && h.every((l) => g.includes(l))));
      return out.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    };
    const r = (a) => {
      if (a.k === Y) return limpia([...r(a.a), ...r(a.b)]);
      if (a.k === O) {
        const x = r(a.a), y = r(a.b), out = [];
        for (const p of x) for (const q of y) out.push([...p, ...q]);
        return limpia(out);
      }
      if (a.k === 'const') return a.v === (tipo === 'cnf') ? [] : [[]];
      return [[D.literal(a)]];
    };
    return r(D.nnf(ast));
  };
  D.clausulas = (ast) => D.forma(ast, 'cnf');
  D.clTxt = (c) => (c.length ? '{' + c.join(', ') + '}' : '□');
  D.astDeForma = function (gs, tipo = 'cnf') {
    const Y = tipo === 'cnf' ? 'and' : 'or', O = tipo === 'cnf' ? 'or' : 'and';
    const lit = (l) => (l[0] === '¬' ? NO({ k: 'var', n: l.slice(1) }) : { k: 'var', n: l });
    const junta = (op, xs, vacio) => (xs.length ? xs.reduce((s, x) => BI(op, s, x)) : { k: 'const', v: vacio });
    return junta(Y, gs.map((g) => junta(O, g.map(lit), tipo !== 'cnf')), tipo === 'cnf');
  };

  /* ---------- DPLL ---------- */

  // Aplica una asignación parcial; null si alguna cláusula queda vacía.
  function reducir(cl, asig) {
    const out = [];
    for (const c of cl) {
      let sat = false;
      const resto = [];
      for (const l of c) {
        const v = D.varDe(l);
        if (v in asig) { if (asig[v] === D.positivo(l)) { sat = true; break; } } else resto.push(l);
      }
      if (sat) continue;
      if (!resto.length) return null;
      out.push(resto);
    }
    return out;
  }
  D.reducir = reducir;
  // Árbol de búsqueda de DPLL con propagación de cláusulas unitarias; se detiene en el primer modelo.
  D.dpllArbol = function (cls, tope = 600) {
    let n = 0;
    function expandir(cl0, asig, etiqueta) {
      const nodo = { etiqueta, unit: [], hijos: [], asig: null, estado: 'abierto', sat: false };
      n++;
      const a = { ...asig };
      let cl = reducir(cl0, a);
      while (cl) {
        const u = cl.find((c) => c.length === 1);
        if (!u) break;
        a[D.varDe(u[0])] = D.positivo(u[0]);
        nodo.unit.push(u[0]);
        cl = reducir(cl, a);
      }
      nodo.asig = a;
      if (!cl) { nodo.estado = 'conflicto'; return nodo; }
      if (!cl.length) { nodo.estado = 'sat'; nodo.sat = true; return nodo; }
      const corta = cl.reduce((m, c) => (c.length < m.length ? c : m));
      const l = corta[0];
      nodo.decide = l;
      for (const lit of [l, D.neg(l)]) {
        if (n > tope) break;
        const h = expandir(cl, { ...a, [D.varDe(lit)]: D.positivo(lit) }, lit);
        nodo.hijos.push(h);
        if (h.sat) { nodo.sat = true; break; }
      }
      return nodo;
    }
    const raiz = expandir(cls, {}, '');
    return { raiz, nodos: n, sat: raiz.sat };
  };
  D.satisfacible = (cls) => D.dpllArbol(cls, 1e9).sat;
  D.sat3 = function (rnd, n, m) {
    const cl = [];
    for (let i = 0; i < m; i++) {
      const vs = new Set();
      while (vs.size < 3) vs.add(1 + Math.floor(rnd() * n));
      cl.push([...vs].map((v) => (rnd() < 0.5 ? '' : '¬') + 'x' + v).sort(cmpLit));
    }
    return cl;
  };

  /* ---------- Resolución ---------- */

  D.resolventes = function (c1, c2) {
    const out = [];
    for (const l of c1) {
      const m = D.neg(l);
      if (!c2.includes(m)) continue;
      const res = [...new Set([...c1.filter((x) => x !== l), ...c2.filter((x) => x !== m)])].sort(cmpLit);
      out.push({ lit: l, res, trivial: res.some((x) => res.includes(D.neg(x))) });
    }
    return out;
  };
  // Saturación por resolución. estrategia: 'ancho', 'unitaria', 'soporte' (conjunto de apoyo) o 'entrada'.
  D.resolucion = function (iniciales, { estrategia = 'ancho', soporte = [] } = {}) {
    const claves = new Map();
    const cl = [];
    const pend = [];
    let cabeza = 0;
    const api = { cl, vacia: -1, generadas: 0, pares: 0, sinMas: false };
    function agregar(c, padres, lit) {
      const k = c.join('|');
      if (claves.has(k)) return -1;
      claves.set(k, cl.length);
      const j = cl.length;
      const nuevo = { c, padres, lit, entrada: !padres, sop: padres ? true : soporte.includes(j) };
      for (let i = 0; i < j; i++) {
        if (estrategia === 'soporte' && !(cl[i].sop || nuevo.sop)) continue;
        if (estrategia === 'entrada' && !(cl[i].entrada || nuevo.entrada)) continue;
        const rs = D.resolventes(cl[i].c, c);
        if (rs.length) pend.push({ i, j, rs, puntaje: estrategia === 'unitaria' ? Math.min(cl[i].c.length, c.length) * 1e6 + j * 1e3 + i : 0 });
      }
      cl.push(nuevo);
      return j;
    }
    iniciales.forEach((c) => agregar([...c].sort(cmpLit), null, null));
    api.paso = function () {
      if (api.vacia >= 0) return null;
      let k = cabeza;
      if (estrategia === 'unitaria') for (let q = cabeza + 1; q < pend.length; q++) if (pend[q].puntaje < pend[k].puntaje) k = q;
      if (k >= pend.length) { api.sinMas = true; return null; }
      const mejor = pend[k];
      pend[k] = pend[cabeza];
      pend[cabeza++] = mejor;
      api.pares++;
      const nuevos = [];
      for (const r of mejor.rs) {
        api.generadas++;
        if (r.trivial) continue;
        const q = agregar(r.res, [mejor.i, mejor.j], r.lit);
        if (q >= 0) { nuevos.push(q); if (!r.res.length) api.vacia = q; }
      }
      return { i: mejor.i, j: mejor.j, nuevos };
    };
    api.listo = () => api.vacia >= 0 || api.sinMas;
    // Cláusulas necesarias para llegar a la vacía, en orden.
    api.derivacion = function (fin = api.vacia) {
      const usados = new Set();
      (function r(k) { if (usados.has(k)) return; usados.add(k); if (cl[k].padres) cl[k].padres.forEach(r); })(fin);
      return [...usados].sort((a, b) => a - b);
    };
    return api;
  };

  /* ---------- Lógica de predicados ---------- */

  // Un modelo: dominio {0,…,n−1} y relaciones rel[nombre] = {ar, d: arreglo plano de booleanos}.
  D.relacion = (n, ar, f) => {
    const d = [];
    for (let i = 0; i < n ** ar; i++) {
      const args = [];
      for (let k = ar - 1, r = i; k >= 0; k--, r = Math.floor(r / n)) args[k] = r % n;
      d.push(!!f(...args));
    }
    return { ar, d };
  };
  D.evaluaP = function ev(a, m, asig = {}, hook) {
    const val = (t) => (t in asig ? asig[t] : m.cons && t in m.cons ? m.cons[t] : 0);
    let r;
    switch (a.k) {
      case 'var': r = !!(m.prop && m.prop[a.n]); break;
      case 'const': r = a.v; break;
      case 'pred': {
        const R = m.rel[a.n];
        r = !!(R && R.d[a.args.reduce((s, t) => s * m.n + val(t), 0)]);
        break;
      }
      case 'eq': r = val(a.x) === val(a.y); break;
      case 'not': r = !ev(a.a, m, asig, hook); break;
      case 'and': r = ev(a.a, m, asig, hook) && ev(a.b, m, asig, hook); break;
      case 'or': r = ev(a.a, m, asig, hook) || ev(a.b, m, asig, hook); break;
      case 'imp': r = !ev(a.a, m, asig, hook) || ev(a.b, m, asig, hook); break;
      case 'iff': r = ev(a.a, m, asig, hook) === ev(a.b, m, asig, hook); break;
      case 'all': case 'ex': {
        let todos = true, alguno = false;
        for (let i = 0; i < m.n; i++) {
          const x = ev(a.a, m, { ...asig, [a.v]: i }, hook);
          todos = todos && x;
          alguno = alguno || x;
        }
        r = a.k === 'all' ? todos : alguno;
        break;
      }
      default: r = false;
    }
    if (hook) hook(a, asig, r);
    return r;
  };
  D.libres = function (ast) {
    const out = new Set();
    (function r(a, lig) {
      if (a.k === 'pred') a.args.forEach((t) => { if (!lig.has(t)) out.add(t); });
      else if (a.k === 'eq') [a.x, a.y].forEach((t) => { if (!lig.has(t)) out.add(t); });
      else if (a.k === 'all' || a.k === 'ex') r(a.a, new Set([...lig, a.v]));
      else D.hijos(a).forEach((h) => r(h, lig));
    })(ast, new Set());
    return [...out].sort();
  };
  // Sustituye las apariciones libres de v por el término t; avisa si t quedaría capturado.
  D.sustituir = function (ast, v, t) {
    let captura = false;
    const r = (a, lig) => {
      const s = (x) => (x === v && !lig.has(v) ? t : x);
      if (a.k === 'pred') { if (a.args.some((x) => x === v && !lig.has(v)) && lig.has(t)) captura = true; return { ...a, args: a.args.map(s) }; }
      if (a.k === 'eq') { if ((a.x === v || a.y === v) && !lig.has(v) && lig.has(t)) captura = true; return { ...a, x: s(a.x), y: s(a.y) }; }
      if (a.k === 'all' || a.k === 'ex') return a.v === v ? a : { ...a, a: r(a.a, new Set([...lig, a.v])) };
      if (a.k === 'not') return { ...a, a: r(a.a, lig) };
      if (SIM[a.k]) return { ...a, a: r(a.a, lig), b: r(a.b, lig) };
      return a;
    };
    const res = r(ast, new Set());
    return { ast: res, captura };
  };

  /* ---------- Generación aleatoria ---------- */

  D.aleatoria = function (rnd, vars, prof, ops = ['and', 'or', 'imp', 'iff', 'not']) {
    const r = (p) => {
      if (p <= 0 || (p < 3 && rnd() < 0.25)) return { k: 'var', n: vars[Math.floor(rnd() * vars.length)] };
      const o = ops[Math.floor(rnd() * ops.length)];
      return o === 'not' ? NO(r(p - 1)) : BI(o, r(p - 1), r(p - 1));
    };
    return r(prof);
  };

  /* ---------- Interfaz: campos, símbolos y tabla de verdad ---------- */

  D.simbolos = function (padre, input, lista = ['¬', '∧', '∨', '→', '↔', '(', ')']) {
    const fila = VIZ.el('div', { class: 'simbolos' });
    for (const s of lista) {
      fila.appendChild(VIZ.el('button', {
        type: 'button', class: 'boton simbolo', title: `Insertar ${s}`,
        onclick: () => {
          const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
          input.value = input.value.slice(0, a) + s + input.value.slice(b);
          input.focus();
          input.setSelectionRange(a + s.length, a + s.length);
          input.dispatchEvent(new Event('input'));
        },
      }, s));
    }
    padre.appendChild(fila);
    return fila;
  };
  // Campo de fórmula con análisis en vivo. alCambiar recibe {ast} o {error, pos}.
  D.campoFormula = function (cuerpo, ctl, { etiqueta = 'Fórmula', valor, simbolos, alCambiar }) {
    const campo = ctl.texto({ etiqueta, valor });
    campo.input.parentNode.classList.add('campo-formula');
    campo.input.addEventListener('input', () => alCambiar(D.analizar(campo.input.value)));
    if (simbolos !== false) D.simbolos(cuerpo, campo.input, simbolos);
    return campo;
  };

  D.tabla = function (padre) {
    const caja = VIZ.el('div', { class: 'caja-desplazable caja-alta' });
    padre.appendChild(caja);
    return {
      caja,
      // cols: [{t, f(valuación, i) → booleano, fuerte}]
      poner({ vars, cols, vals = D.valuaciones(vars), activa = -1, alClick, clase }) {
        const t = VIZ.el('table', { class: 'tabla-datos tabla-verdad sin-corte' });
        t.appendChild(VIZ.el('thead', null, VIZ.el('tr', null,
          vars.map((v) => VIZ.el('th', null, v)),
          cols.map((c, j) => VIZ.el('th', { class: j === 0 ? 'sep' : null }, c.t)))));
        const tb = VIZ.el('tbody');
        vals.forEach((val, i) => {
          const cls = [i === activa ? 'activa' : '', clase ? clase(val, i) : '', alClick ? 'clicable' : ''].filter(Boolean).join(' ');
          const tr = VIZ.el('tr', { class: cls || null });
          vars.forEach((v) => tr.appendChild(VIZ.el('td', { class: val[v] ? 'v' : 'f' }, val[v] ? 'V' : 'F')));
          cols.forEach((c, j) => {
            const r = !!c.f(val, i);
            tr.appendChild(VIZ.el('td', { class: [r ? 'v' : 'f', j === 0 ? 'sep' : '', c.fuerte ? 'fuerte' : ''].filter(Boolean).join(' ') }, r ? 'V' : 'F'));
          });
          if (alClick) tr.addEventListener('click', () => alClick(i, val));
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        caja.replaceChildren(t);
      },
    };
  };

  /* ---------- Dibujo ---------- */

  // Árbol sintáctico. op: {fila, relleno(rec), borde(rec), anillo(rec), nota(rec), arista(rec)}. Devuelve los nodos con su posición.
  D.altoArbol = (ast, fila = 56, prof = D.prof) => 62 + prof(ast) * fila;
  // Para árboles que no son fórmulas, op.hijos(n) y op.etiqueta(n) (ver D.GEN); op.x0 y op.ancho acotan el espacio.
  D.GEN = { hijos: (n) => n.hs || [], etiqueta: (n) => n.t };
  D.arbol = function (l, ast, op = {}) {
    const { ctx } = l;
    const W = op.ancho || l.ancho, x0 = op.x0 || 0;
    const hijosDe = op.hijos || D.hijos, etiquetaDe = op.etiqueta || D.etiqueta;
    const fila = op.fila || 56;
    const recs = [];
    let hoja = 0;
    (function pon(a, nivel, padre) {
      const rec = { n: a, nivel, padre, hijos: [], x: 0 };
      recs.push(rec);
      if (padre) padre.hijos.push(rec);
      for (const h of hijosDe(a)) pon(h, nivel + 1, rec);
      rec.x = rec.hijos.length ? (rec.hijos[0].x + rec.hijos[rec.hijos.length - 1].x) / 2 : hoja++;
    })(ast, 0, null);
    ctx.font = VIZ.fuente(13, 500);
    const m = Math.max(28, ...recs.map((r) => ctx.measureText(etiquetaDe(r.n)).width / 2 + 12));
    for (const r of recs) {
      r.px = x0 + (hoja > 1 ? m + (r.x * (W - 2 * m)) / (hoja - 1) : W / 2);
      r.py = 26 + r.nivel * fila;
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (const r of recs) {
      if (!r.padre) continue;
      const e = op.arista ? op.arista(r) : null;
      ctx.strokeStyle = (e && e.color) || C.eje;
      ctx.lineWidth = (e && e.ancho) || 1.5;
      ctx.beginPath(); ctx.moveTo(r.padre.px, r.padre.py); ctx.lineTo(r.px, r.py); ctx.stroke();
    }
    ctx.font = VIZ.fuente(13, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of recs) {
      const txt = etiquetaDe(r.n);
      r.w = Math.max(28, ctx.measureText(txt).width + 14);
      r.h = 26;
      const anillo = op.anillo ? op.anillo(r) : null;
      ctx.beginPath();
      ctx.roundRect(r.px - r.w / 2, r.py - 13, r.w, 26, 13);
      ctx.fillStyle = (op.relleno && op.relleno(r)) || C.superficie;
      ctx.fill();
      ctx.lineWidth = anillo ? 3 : 1.5;
      ctx.strokeStyle = anillo || (op.borde && op.borde(r)) || C.tinta2;
      ctx.stroke();
      ctx.fillStyle = (op.texto && op.texto(r)) || C.tinta;
      ctx.fillText(txt, r.px, r.py + 0.5);
      const nota = op.nota ? op.nota(r) : null;
      if (nota != null) {
        ctx.font = VIZ.fuente(10.5, 600);
        ctx.fillStyle = C.tinta2;
        ctx.fillText(nota, r.px, r.py + 25);
        ctx.font = VIZ.fuente(13, 500);
      }
    }
    ctx.restore();
    return recs;
  };
  D.nodoEn = (recs, x, y) => recs.find((r) => Math.abs(x - r.px) <= r.w / 2 && Math.abs(y - r.py) <= r.h / 2) || null;

  // Caja con texto centrado; devuelve su rectángulo.
  D.caja = function (ctx, x, y, w, h, texto, { relleno = C.superficie, borde = C.tinta2, ancho = 1.5, tinta = C.tinta, fuente = VIZ.fuente(12, 500), radio = 4, guiones } = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radio);
    ctx.fillStyle = relleno; ctx.fill();
    ctx.lineWidth = ancho; ctx.strokeStyle = borde;
    if (guiones) ctx.setLineDash(guiones);
    ctx.stroke();
    ctx.setLineDash([]);
    if (texto != null) {
      ctx.fillStyle = tinta; ctx.font = fuente; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(texto, x + w / 2, y + h / 2 + 0.5);
    }
    ctx.restore();
    return { x, y, w, h };
  };
  D.flecha = function (ctx, x1, y1, x2, y2, color = C.tinta2, ancho = 1.5, guiones) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho;
    if (guiones) ctx.setLineDash(guiones);
    const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * h * 0.6, y2 - Math.sin(a) * h * 0.6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - 0.4), y2 - h * Math.sin(a - 0.4));
    ctx.lineTo(x2 - h * Math.cos(a + 0.4), y2 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  D.texto2 = function (ctx, txt, x, y, { color = C.tinta, px = 12, peso = 400, alinea = 'center', base = 'middle' } = {}) {
    ctx.save();
    ctx.font = VIZ.fuente(px, peso); ctx.fillStyle = color; ctx.textAlign = alinea; ctx.textBaseline = base;
    ctx.fillText(txt, x, y);
    ctx.restore();
  };

  /* ---------- Enumeración y dibujo de modelos finitos ---------- */

  // Predicados que usa la fórmula con su aridad: [{n, ar}].
  D.predicados = function (...asts) {
    const m = new Map();
    for (const ast of asts) (function r(a) { if (a.k === 'pred') m.set(a.n, a.args.length); D.hijos(a).forEach(r); })(ast);
    return [...m].map(([n, ar]) => ({ n, ar })).sort((a, b) => a.n.localeCompare(b.n));
  };
  // Itera sobre todas las interpretaciones con dominio de n elementos; f(modelo) devuelve true para parar.
  D.recorrer = function (preds, n, f) {
    const bits = preds.reduce((s, p) => s + n ** p.ar, 0);
    for (let k = 0; k < 2 ** bits; k++) {
      let off = 0;
      const rel = {};
      for (const p of preds) { const t = n ** p.ar; rel[p.n] = { ar: p.ar, d: Array.from({ length: t }, (_, i) => !!((k >> (off + i)) & 1)) }; off += t; }
      if (f({ n, rel }, k)) return true;
    }
    return false;
  };
  const NOMBRES = 'abcdefgh';
  D.nombreElem = (i) => NOMBRES[i] || String(i);
  // Dibuja un modelo: una fila de puntos por predicado unario y una matriz por cada relación binaria.
  D.dibujarModelo = function (l, m, op = {}) {
    const { ctx } = l;
    const un = Object.entries(m.rel).filter(([, r]) => r.ar === 1), bi = Object.entries(m.rel).filter(([, r]) => r.ar === 2);
    const n = m.n, paso = Math.min(34, Math.max(20, (l.ancho - 70 - (bi.length ? bi.length * (n * 22 + 30) : 0)) / n));
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = VIZ.fuente(11, 500);
    for (let i = 0; i < n; i++) { ctx.fillStyle = C.tinta2; ctx.fillText(D.nombreElem(i), 56 + i * paso + paso / 2, 16); }
    un.forEach(([nom, r], k) => {
      const y = 44 + k * 30;
      ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2; ctx.fillText(nom, 40, y);
      ctx.textAlign = 'center';
      for (let i = 0; i < n; i++) {
        const cx = 56 + i * paso + paso / 2;
        ctx.beginPath(); ctx.arc(cx, y, 9, 0, 7);
        ctx.fillStyle = r.d[i] ? C.s1 : C.superficie; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = r.d[i] ? C.s1 : C.eje; ctx.stroke();
        if (op.marca && op.marca(nom, i)) { ctx.beginPath(); ctx.arc(cx, y, 13, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = op.marca(nom, i); ctx.stroke(); }
      }
    });
    let x0 = 56 + n * paso + 30;
    bi.forEach(([nom, r]) => {
      const cw = 22, y0 = 34;
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(11, 500);
      ctx.fillText(nom, x0 + (n * cw) / 2, 14);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = r.d[i * n + j];
        ctx.fillStyle = v ? C.s1 : C.neutro; ctx.fillRect(x0 + j * cw + 1, y0 + i * cw + 1, cw - 2, cw - 2);
        if (op.marcaR && op.marcaR(nom, i, j)) { ctx.lineWidth = 2.5; ctx.strokeStyle = op.marcaR(nom, i, j); ctx.strokeRect(x0 + j * cw + 1.5, y0 + i * cw + 1.5, cw - 3, cw - 3); }
      }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado;
      for (let i = 0; i < n; i++) { ctx.textAlign = 'right'; ctx.fillText(D.nombreElem(i), x0 - 4, y0 + i * cw + cw / 2); ctx.textAlign = 'center'; ctx.fillText(D.nombreElem(i), x0 + i * cw + cw / 2, y0 - 8); }
      x0 += n * cw + 34;
    });
    ctx.restore();
  };
  D.altoModelo = (m) => {
    const un = Object.values(m.rel).filter((r) => r.ar === 1).length, bi = Object.values(m.rel).some((r) => r.ar === 2);
    return Math.max(34 + un * 30 + 6, bi ? 44 + m.n * 22 + 8 : 0);
  };

  // Árbol de búsqueda de DPLL (de D.dpllArbol) dibujado con el árbol genérico.
  D.arbolDpll = function (l, raiz, op = {}) {
    const hijos = (n) => n.hijos;
    const etiqueta = (n) => (n.etiqueta ? n.etiqueta + (n.unit.length ? ' | ' + n.unit.join(' ') : '') : n.unit.length ? n.unit.join(' ') : 'inicio');
    return D.arbol(l, raiz, {
      hijos, etiqueta, fila: 52,
      relleno: (r) => (r.n.estado === 'sat' ? VIZ.alfa(C.s6, 0.25) : r.n.estado === 'conflicto' ? VIZ.alfa(C.s8, 0.2) : null),
      borde: (r) => (r.n.estado === 'sat' ? C.s6 : r.n.estado === 'conflicto' ? C.s8 : C.tinta2),
      ...op,
    });
  };
  D.profGen = (n, h = D.GEN.hijos) => { const hs = h(n); return hs.length ? 1 + Math.max(...hs.map((x) => D.profGen(x, h))) : 0; };

  // Tira de celdas: f(i) → {fondo, texto, borde, tinta}. Devuelve el ancho de cada celda.
  D.tira = function (ctx, x, y, ancho, n, f, h = 26) {
    const cw = ancho / n;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = VIZ.fuente(cw < 22 ? 9.5 : 11, 500);
    for (let i = 0; i < n; i++) {
      const c = f(i) || {};
      ctx.fillStyle = c.fondo || C.neutro;
      ctx.fillRect(x + i * cw + 1, y, cw - 2, h);
      if (c.borde) { ctx.lineWidth = 2; ctx.strokeStyle = c.borde; ctx.strokeRect(x + i * cw + 2, y + 1, cw - 4, h - 2); }
      if (c.texto != null && cw >= 13) { ctx.fillStyle = c.tinta || C.tinta; ctx.fillText(c.texto, x + i * cw + cw / 2, y + h / 2 + 0.5); }
    }
    ctx.restore();
    return cw;
  };

  // Derivación por la izquierda. expandir(nodo) → trozos (cadenas terminales u otros nodos pendientes).
  // Devuelve los pasos: {forma, nodo} (nodo es el que se expandió en ese paso; null en el inicial).
  D.derivar = function (raiz, expandir) {
    let forma = [raiz];
    const pasos = [{ forma: [...forma], nodo: null }];
    for (let i = forma.findIndex((x) => typeof x !== 'string'); i >= 0; i = forma.findIndex((x) => typeof x !== 'string')) {
      const n = forma[i];
      forma = [...forma.slice(0, i), ...expandir(n), ...forma.slice(i + 1)];
      pasos.push({ forma: [...forma], nodo: n });
    }
    return pasos;
  };
  D.formaTxt = (forma, simbolo = 'E') => forma.map((x) => (typeof x === 'string' ? x : simbolo)).join('');

  /* ---------- Argumentos: premisas y conclusión ---------- */

  // Revisa todas las valuaciones: una fila es contraejemplo si hace verdaderas las premisas y falsa la conclusión.
  D.verificar = function (premisas, conclusion) {
    const vars = [...new Set([...premisas, conclusion].flatMap(D.vars))].sort();
    const vals = D.valuaciones(vars);
    const filas = vals.map((v) => {
      const ps = premisas.map((p) => D.evalua(p, v)), c = D.evalua(conclusion, v);
      return { v, ps, c, modelo: ps.every(Boolean), contra: ps.every(Boolean) && !c };
    });
    return { vars, vals, filas, valido: !filas.some((f) => f.contra), contra: filas.find((f) => f.contra) || null, nModelos: filas.filter((f) => f.modelo).length };
  };
  // Muestra la tabla de un argumento: verde = premisas verdaderas y conclusión verdadera; rojo = contraejemplo.
  D.tablaArgumento = function (tabla, premisas, conclusion, r = D.verificar(premisas, conclusion)) {
    tabla.poner({
      vars: r.vars, vals: r.vals,
      cols: [...premisas.map((p, i) => ({ t: D.texto(p), f: (v, k) => r.filas[k].ps[i] })), { t: '⊨ ' + D.texto(conclusion), f: (v, k) => r.filas[k].c, fuerte: true }],
      clase: (v, k) => (r.filas[k].contra ? 'contraejemplo' : r.filas[k].modelo ? 'modelo' : ''),
    });
    return r;
  };
})();
