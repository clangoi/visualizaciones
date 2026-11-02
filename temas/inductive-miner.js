(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  const LETRA = { 'Registrar pedido': 'a', 'Verificar stock': 'b', 'Reponer stock': 'c', 'Preparar envío': 'd', 'Emitir factura': 'e', 'Cobrar al contado': 'f', 'Enviar recordatorio': 'g', 'Despachar': 'h' };
  const NOMBRE = Object.fromEntries(Object.entries(LETRA).map(([k, v]) => [v, k]));
  // Registro de pedidos con actividades de una letra, listo para el minero: [[traza, veces], …].
  function logPedidos(n, semilla, ruido) {
    const log = P.simular(P.procesos.pedidos.arbol, n, semilla, { ruido, espera: 5 });
    log.forEach((c) => c.eventos.forEach((e) => { e.act = LETRA[e.act] || e.act; }));
    return P.variantes(log).map((v) => [v.traza, v.n]);
  }
  const nombres = (cuerpo, N) => cuerpo.appendChild(VIZ.el('div', { class: 'lista-mono' }, VIZ.el('div', null, Object.entries(N).map(([k, v]) => `${k} = ${v}`).join('  ·  '))));

  /* ---------- Núcleo del Inductive Miner (actividades de una letra) ---------- */

  // Un registro es una lista de [traza (arreglo de letras), veces].
  const alfabeto = (L) => [...new Set(L.flatMap(([t]) => t))].sort();
  function dfgDe(L) {
    const frec = new Map(), par = new Map(), ini = new Map(), fin = new Map();
    const suma = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
    for (const [t, v] of L) {
      if (!t.length) continue;
      t.forEach((a) => suma(frec, a, v));
      suma(ini, t[0], v); suma(fin, t[t.length - 1], v);
      for (let i = 0; i + 1 < t.length; i++) suma(par, t[i] + t[i + 1], v);
    }
    return { acts: [...frec.keys()].sort(), frec, par, ini, fin };
  }
  // Filtro de IMf: quita las aristas, inicios y finales con frecuencia < eta × la mayor de su origen.
  function filtrarDfg(d, eta) {
    const E = new Set(), S = new Set(d.ini.keys()), F = new Set(d.fin.keys());
    const mayor = new Map([...d.fin]);
    for (const [k, v] of d.par) mayor.set(k[0], Math.max(mayor.get(k[0]) || 0, v));
    for (const [k, v] of d.par) if (v >= eta * mayor.get(k[0])) E.add(k);
    if (eta > 0) {
      const mi = Math.max(0, ...d.ini.values()), mf = Math.max(0, ...d.fin.values());
      for (const [a, v] of d.ini) if (v < eta * mi) S.delete(a);
      for (const [a, v] of d.fin) if (v < eta * mf) F.delete(a);
    }
    return { acts: d.acts, E, S, F };
  }
  function componentes(nodos, une) {
    const grupo = new Map(nodos.map((n) => [n, n]));
    const raiz = (n) => { while (grupo.get(n) !== n) n = grupo.get(n); return n; };
    for (const a of nodos) for (const b of nodos) if (a < b && une(a, b)) grupo.set(raiz(a), raiz(b));
    const m = new Map();
    for (const n of nodos) { const r = raiz(n); if (!m.has(r)) m.set(r, []); m.get(r).push(n); }
    return [...m.values()].map((g) => g.sort());
  }
  // Los cuatro intentos de corte, en el orden del algoritmo. Cada uno devuelve { ok, grupos, texto }.
  function intentosDeCorte(g) {
    const { acts, E, S, F } = g, hay = (a, b) => E.has(a + b);
    const res = [];
    // 1. Exclusivo: componentes conexas del grafo sin dirección.
    const cx = componentes(acts, (a, b) => hay(a, b) || hay(b, a));
    res.push({ tipo: 'xor', ok: cx.length > 1, grupos: cx, texto: cx.length > 1 ? `el grafo sin dirección tiene ${cx.length} componentes` : 'el grafo sin dirección es conexo' });
    // 2. Secuencia: componentes fuertemente conexas, fusionando las que no se alcanzan entre sí.
    const alc = new Map(acts.map((a) => [a, new Set(acts.filter((b) => hay(a, b)))]));
    for (const k of acts) for (const i of acts) if (alc.get(i).has(k)) for (const j of alc.get(k)) alc.get(i).add(j);
    const llega = (a, b) => alc.get(a).has(b);
    let sc = componentes(acts, (a, b) => llega(a, b) && llega(b, a));
    const alcG = (G, H) => G.some((a) => H.some((b) => llega(a, b)));
    for (let cambio = true; cambio && sc.length > 1;) {
      cambio = false;
      for (let i = 0; i < sc.length && !cambio; i++) for (let j = i + 1; j < sc.length && !cambio; j++) {
        if (!alcG(sc[i], sc[j]) && !alcG(sc[j], sc[i])) { sc[i] = sc[i].concat(sc[j]).sort(); sc.splice(j, 1); cambio = true; }
      }
    }
    sc = sc.map((gr) => ({ gr, antes: sc.filter((h) => h !== gr && alcG(h, gr)).length })).sort((x, z) => x.antes - z.antes).map((x) => x.gr);
    res.push({ tipo: 'seq', ok: sc.length > 1, grupos: sc, texto: sc.length > 1 ? `${sc.length} grupos totalmente ordenados por alcanzabilidad` : 'los grupos no se pueden ordenar (todo se alcanza mutuamente)' });
    // 3. Paralelo: se unen los pares a, b a los que les falta alguna de las dos aristas.
    const par = componentes(acts, (a, b) => !(hay(a, b) && hay(b, a)));
    const okAnd = par.length > 1 && par.every((gr) => gr.some((a) => S.has(a)) && gr.some((a) => F.has(a)));
    res.push({ tipo: 'and', ok: okAnd, grupos: par, texto: okAnd ? `${par.length} grupos con aristas en ambos sentidos entre todos sus pares` : par.length > 1 ? 'hay grupos, pero alguno no tiene actividad inicial y final' : 'falta alguna arista entre casi todo par' });
    // 4. Bucle: partes que solo se enganchan con finales (entrada) e iniciales (salida).
    const resto = acts.filter((a) => !S.has(a) && !F.has(a));
    const cand = componentes(resto, (a, b) => hay(a, b) || hay(b, a));
    const redo = cand.filter((R) => {
      const ent = [], sal = [];
      for (const c of R) for (const x of acts) {
        if (R.includes(x)) continue;
        if (hay(x, c)) { if (!F.has(x)) return false; ent.push(c); }
        if (hay(c, x)) { if (!S.has(x)) return false; sal.push(c); }
      }
      return ent.length > 0 && sal.length > 0 && ent.every((c) => [...F].every((f) => hay(f, c))) && sal.every((c) => [...S].every((s) => hay(c, s)));
    });
    const rg = redo.flat().sort(), hacer = acts.filter((a) => !rg.includes(a));
    res.push({ tipo: 'loop', ok: redo.length > 0 && hacer.length > 0, grupos: [hacer, rg], texto: redo.length ? `parte «rehacer» {${rg.join(',')}} conectada solo desde finales hacia iniciales` : 'ninguna parte se engancha solo entre finales e iniciales' });
    return res;
  }
  function dividir(L, tipo, grupos, g) {
    const proy = (t, gr) => t.filter((a) => gr.includes(a));
    if (tipo === 'xor') {
      const sub = grupos.map(() => []);
      for (const [t, v] of L) { const k = Math.max(0, grupos.findIndex((gr) => gr.includes(t[0]))); sub[k].push([proy(t, grupos[k]), v]); }
      return sub;
    }
    if (tipo === 'seq' || tipo === 'and') return grupos.map((gr) => L.map(([t, v]) => [proy(t, gr), v]));
    const hacer = [], rehacer = [], [dg] = grupos;
    for (const [t, v] of L) {
      let cur = [], enRedo = false, previo = null;
      const cierra = () => { if (cur.length) (enRedo ? rehacer : hacer).push([cur, v]); cur = []; };
      for (const a of t) {
        const r = !dg.includes(a);
        if (r !== enRedo) { cierra(); enRedo = r; }
        else if (!r && previo !== null && g.F.has(previo) && g.S.has(a)) { cierra(); rehacer.push([[], v]); }
        cur.push(a); previo = a;
      }
      cierra();
    }
    return [hacer, rehacer];
  }
  const OPS = { seq: '→', xor: '×', and: '+', loop: '↺' };
  const nuevoNodo = (L) => ({ op: 'pend', L, h: [], acts: alfabeto(L) });
  const nTrazas = (L) => L.reduce((s, [, v]) => s + v, 0);
  // Construcción recursiva como generador: cada yield es una decisión visible. Modifica `nodo` en su lugar.
  function* construir(nodo, eta) {
    const vac0 = nodo.L.filter(([t]) => !t.length), no = nodo.L.filter(([t]) => t.length);
    // IMf: si las trazas vacías son menos que una fracción η del sublog, se tratan como ruido.
    const descartar = eta > 0 && vac0.length > 0 && nTrazas(vac0) / nTrazas(nodo.L) < eta;
    const vacias = descartar ? [] : vac0;
    if (descartar) nodo.L = no;
    if (!no.length) { nodo.op = 'tau'; nodo.nota = 'Sublog sin eventos: una acción silenciosa τ.'; yield nodo; return; }
    if (vacias.length) {
      nodo.op = 'xor'; nodo.nota = `${nTrazas(vacias)} trazas vacías en el sublog: se separa un camino silencioso τ (la parte es opcional).`;
      nodo.h = [{ op: 'tau', L: [], h: [], acts: [] }, nuevoNodo(no)];
      yield nodo;
      yield* construir(nodo.h[1], eta);
      return;
    }
    const d = dfgDe(no);
    if (d.acts.length === 1) {
      const a = d.acts[0];
      if (no.every(([t]) => t.length === 1)) { nodo.op = 'act'; nodo.a = a; nodo.nota = `Caso base: todas las trazas son [${a}] → hoja ${a}.`; }
      else { nodo.op = 'loop'; nodo.h = [{ op: 'act', a, L: no, h: [], acts: [a] }, { op: 'tau', L: [], h: [], acts: [] }]; nodo.nota = `Una sola actividad ${a} que se repite: bucle ${a} con rehacer τ.`; }
      yield nodo; return;
    }
    const g = filtrarDfg(d, eta), ints = intentosDeCorte(g);
    const hallado = ints.find((x) => x.ok);
    nodo.intentos = ints;
    if (hallado) {
      const sub = dividir(no, hallado.tipo, hallado.grupos, g);
      nodo.op = hallado.tipo;
      nodo.nota = `Corte ${{ seq: 'secuencial', xor: 'exclusivo', and: 'paralelo', loop: 'de bucle' }[hallado.tipo]}: ${hallado.grupos.map((x) => `{${x.join(',')}}`).join(hallado.tipo === 'seq' ? ' → ' : ' | ')} (${hallado.texto}).`;
      nodo.h = sub.map((l) => nuevoNodo(l));
      yield nodo;
      for (const h of nodo.h) yield* construir(h, eta);
      return;
    }
    nodo.op = 'loop'; nodo.flor = true;
    nodo.h = [{ op: 'tau', L: [], h: [], acts: [] }, { op: 'xor', L: no, h: d.acts.map((a) => ({ op: 'act', a, L: [], h: [], acts: [a] })), acts: d.acts }];
    nodo.nota = `Ningún corte posible con las aristas que quedan: modelo flor (bucle de τ con elección entre {${d.acts.join(',')}}), que acepta cualquier secuencia.`;
    yield nodo;
  }
  function inductivo(L, eta = 0) {
    const raiz = nuevoNodo(L), g = construir(raiz, eta);
    while (!g.next().done);
    return raiz;
  }
  const hojasDe = (n) => (n.h.length ? n.h.flatMap(hojasDe) : [n]);
  const tamanoArbol = (n) => 1 + n.h.reduce((s, h) => s + tamanoArbol(h), 0);
  const alfArbol = (n) => (n.op === 'act' ? new Set([n.a]) : n.op === 'pend' ? new Set(n.acts) : new Set(n.h.flatMap((h) => [...alfArbol(h)])));
  function finales(n, t, i) {
    if (n.op === 'act') return t[i] === n.a ? new Set([i + 1]) : new Set();
    if (n.op === 'tau') return new Set([i]);
    if (n.op === 'xor') { const r = new Set(); n.h.forEach((h) => finales(h, t, i).forEach((j) => r.add(j))); return r; }
    if (n.op === 'seq') {
      let cur = new Set([i]);
      for (const h of n.h) { const nx = new Set(); cur.forEach((p) => finales(h, t, p).forEach((q) => nx.add(q))); cur = nx; if (!cur.size) break; }
      return cur;
    }
    if (n.op === 'loop') {
      const res = new Set(finales(n.h[0], t, i));
      let frente = [...res];
      while (frente.length) {
        const sig = [];
        for (const p of frente) finales(n.h[1], t, p).forEach((q) => finales(n.h[0], t, q).forEach((r) => { if (!res.has(r)) { res.add(r); sig.push(r); } }));
        frente = sig;
      }
      return res;
    }
    if (n.op === 'and') {
      const alf = n.h.map(alfArbol), todo = new Set(alf.flatMap((s) => [...s])), r = new Set();
      for (let j = i; j <= t.length; j++) {
        const seg = t.slice(i, j);
        if (seg.every((a) => todo.has(a)) && n.h.every((h, k) => finales(h, seg.filter((a) => alf[k].has(a)), 0).has(seg.filter((a) => alf[k].has(a)).length))) r.add(j);
      }
      return r;
    }
    return new Set();
  }
  const aceptaArbol = (n, t) => finales(n, t, 0).has(t.length);
  function muestrearArbol(n, rnd, tope = 24) {
    if (n.op === 'act') return [n.a];
    if (n.op === 'tau') return [];
    if (n.op === 'seq') return n.h.flatMap((h) => muestrearArbol(h, rnd, tope));
    if (n.op === 'xor') return muestrearArbol(n.h[Math.floor(rnd() * n.h.length)], rnd, tope);
    if (n.op === 'and') {
      const ramas = n.h.map((h) => muestrearArbol(h, rnd, tope)), idx = ramas.map(() => 0), out = [];
      for (let rest = ramas.reduce((s, r) => s + r.length, 0); rest > 0; rest--) {
        const vivos = ramas.map((r, i) => (idx[i] < r.length ? i : -1)).filter((i) => i >= 0), i = vivos[Math.floor(rnd() * vivos.length)];
        out.push(ramas[i][idx[i]++]);
      }
      return out;
    }
    let out = muestrearArbol(n.h[0], rnd, tope);
    while (out.length < tope && rnd() < 0.5) out = out.concat(muestrearArbol(n.h[1], rnd, tope), muestrearArbol(n.h[0], rnd, tope));
    return out;
  }

  /* ---------- Dibujo del árbol de procesos ---------- */

  const COL_OP = { seq: C.tinta2, xor: C.s1, and: C.s3, loop: C.s7 };
  function dibujarArbol(lienzo, raiz, o = {}) {
    const { ctx, ancho: W, alto: H } = lienzo;
    let hoja = 0, maxP = 0;
    (function rec(n, p) {
      n._p = p; maxP = Math.max(maxP, p);
      if (!n.h.length) n._x = hoja++;
      else { n.h.forEach((h) => rec(h, p + 1)); n._x = (n.h[0]._x + n.h[n.h.length - 1]._x) / 2; }
    })(raiz, 0);
    const mx = 22, my = 24, paso = hoja > 1 ? (W - 2 * mx) / (hoja - 1) : 0;
    const geo = [];
    (function medir(n) {
      n._gx = hoja > 1 ? mx + n._x * paso : W / 2;
      n._gy = my + (maxP ? n._p / maxP : 0) * (H - 2 * my);
      geo.push(n); n.h.forEach(medir);
    })(raiz);
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje;
    for (const n of geo) for (const h of n.h) { ctx.beginPath(); ctx.moveTo(n._gx, n._gy + 11); ctx.lineTo(h._gx, h._gy - 11); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of geo) {
      const x = n._gx, y = n._gy, anillo = n === o.actual ? C.s2 : n === o.sel ? C.tinta : null;
      ctx.lineWidth = anillo ? 3 : 1.5;
      ctx.setLineDash(n.op === 'pend' || n.flor ? [4, 3] : []);
      if (OPS[n.op]) {
        ctx.fillStyle = VIZ.alfa(COL_OP[n.op], 0.22); ctx.strokeStyle = anillo || (n.flor ? C.s8 : COL_OP[n.op]);
        ctx.beginPath(); ctx.arc(x, y, 12, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14, 700); ctx.fillText(OPS[n.op], x, y + 0.5);
        n._gw = 24; n._gh = 24;
      } else if (n.op === 'act') {
        ctx.fillStyle = C.superficie; ctx.strokeStyle = anillo || C.tinta;
        ctx.beginPath(); ctx.roundRect(x - 13, y - 12, 26, 24, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.fillText(n.a, x, y + 0.5);
        n._gw = 26; n._gh = 24;
      } else if (n.op === 'tau') {
        ctx.fillStyle = C.tinta; ctx.fillRect(x - 5, y - 11, 10, 22); n._gw = 10; n._gh = 22;
        if (anillo) { ctx.strokeStyle = anillo; ctx.strokeRect(x - 7, y - 13, 14, 26); }
      } else {
        ctx.font = VIZ.fuente(10, 500);
        const maxW = Math.max(26, paso - 3), txt = n.acts.join(''), w = Math.min(maxW, Math.max(26, ctx.measureText(txt).width + 10));
        ctx.fillStyle = C.neutro; ctx.strokeStyle = anillo || C.inactivo;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 24, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.fillText(ctx.measureText(txt).width + 10 <= w ? txt : `${n.acts.length}`, x, y + 0.5);
        n._gw = w; n._gh = 24;
      }
      ctx.setLineDash([]);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    return geo;
  }
  const nodoArbolEn = (geo, x, y) => geo.find((n) => Math.abs(x - n._gx) <= n._gw / 2 + 3 && Math.abs(y - n._gy) <= n._gh / 2 + 3) || null;

  const fn = (L) => nTrazas(L);
  const NOM_CORTE = { xor: 'exclusivo (×)', seq: 'secuencia (→)', and: 'paralelo (+)', loop: 'bucle (↺)' };
  const COL_GRUPO = [C.s1, C.s2, C.s3, C.s4, C.s7];

  /* ---------- Fig. 1: los cuatro cortes sobre el DFG ---------- */

  const PRESETS = [
    ['seq', 'Secuencia con un paso opcional', 'abcd:6, abd:4'],
    ['xor', 'Dos caminos exclusivos', 'abc:6, de:4'],
    ['and', 'Dos ramas en paralelo', 'abcd:3, acbd:3, acdb:3, cabd:3, cadb:3, cdab:3'],
    ['loop', 'Bucle: hacer y rehacer', 'ab:5, abcab:3, abcabcab:2'],
    ['ruido', 'Paralelo con una traza ruidosa', 'abcd:30, acbd:30, adcb:1'],
    ['flor', 'Sin ningún corte (flor)', 'abca:2, bcab:2, cabc:2'],
  ];
  function leerTrazas(txt) {
    const L = [];
    for (const tok of txt.split(/[\s,;]+/)) {
      const m = /^([a-z]+)(?::(\d+))?$/.exec(tok.trim());
      if (m) L.push([[...m[1]], Math.max(1, Math.min(500, m[2] ? +m[2] : 1))]);
    }
    return L;
  }

  function montarCortes(cuerpo) {
    let L = [], eta = 0, sel = null, geoG = null;
    const ctl = VIZ.controles(cuerpo);
    const selector = ctl.selector({ etiqueta: 'Ejemplo', opciones: PRESETS.map(([k, t]) => [k, t]), valor: 'seq', alCambiar: (k) => { campo.valor = PRESETS.find((p) => p[0] === k)[2]; leer(); } });
    const campo = ctl.texto({ etiqueta: 'Trazas (letras:veces)', valor: PRESETS[0][2], alCambiar: () => leer(), alEnter: () => leer() });
    ctl.rango({ etiqueta: 'Filtro de ruido η', min: 0, max: 0.5, paso: 0.05, valor: eta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eta = v; dibujar(); } });
    ctl.boton('Aplicar trazas', () => leer(), { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'grupo 1 del corte', forma: 'punto' }, { color: C.s2, texto: 'grupo 2', forma: 'punto' },
      { color: C.s3, texto: 'grupo 3', forma: 'punto' }, { color: C.s4, texto: 'grupo 4', forma: 'punto' },
      { color: C.eje, texto: 'arista entre grupos', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un ejemplo o escriba sus propias trazas (por ejemplo abcd:3, acbd:2) y pulse «Aplicar trazas». El algoritmo prueba los cortes en el orden exclusivo, secuencia, paralelo y bucle, y usa el primero que funciona. Haga clic en una actividad para ver sus aristas. Con la traza ruidosa, suba η hasta que el corte vuelva a aparecer.');

    function leer() {
      const nuevo = leerTrazas(campo.valor);
      if (!nuevo.length) { registro.textContent = 'Escriba al menos una traza con letras minúsculas, por ejemplo abc:3.'; return; }
      L = nuevo; sel = null; dibujar();
    }
    function dibujar() {
      if (!L.length) return;
      lienzo.limpiar();
      const d = dfgDe(L), g = filtrarDfg(d, eta), ints = intentosDeCorte(g), hallado = ints.find((x) => x.ok);
      const grupoDe = new Map();
      if (hallado) hallado.grupos.forEach((gr, i) => gr.forEach((a) => grupoDe.set(a, i)));
      const nodos = d.acts.map((a) => {
        const i = grupoDe.get(a), col = i === undefined ? null : COL_GRUPO[i % COL_GRUPO.length];
        return { id: a, tipo: 'act', etiqueta: a, relleno: col ? VIZ.alfa(col, 0.25) : C.superficie, borde: col || C.tinta, anillo: a === sel ? C.tinta : null };
      });
      nodos.push({ id: '▶', tipo: 'inicio', relleno: C.s6, borde: C.s6 }, { id: '■', tipo: 'fin', relleno: C.superficie, borde: C.tinta });
      const maxV = Math.max(1, ...d.par.values());
      const aristas = [];
      for (const [k, v] of d.par) {
        const a = k[0], b = k[1], mismo = grupoDe.get(a) === grupoDe.get(b) && hallado;
        const quitada = !g.E.has(k);
        aristas.push({ de: a, a: b, etiqueta: v, ancho: 1.5 + 2.5 * v / maxV, color: quitada ? C.tenue : (mismo ? COL_GRUPO[grupoDe.get(a) % COL_GRUPO.length] : C.eje), guiones: quitada, curva: undefined });
      }
      d.ini.forEach((v, a) => aristas.push({ de: '▶', a, color: g.S.has(a) ? C.eje : C.tenue, guiones: !g.S.has(a) }));
      d.fin.forEach((v, a) => aristas.push({ de: a, a: '■', color: g.F.has(a) ? C.eje : C.tenue, guiones: !g.F.has(a) }));
      const pos = P.disponer(nodos.map((x) => x.id), aristas.map((e) => [e.de, e.a]));
      geoG = P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: 26, margenY: 30 });
      lista.replaceChildren(...ints.map((x) => {
        const primero = hallado === x;
        return VIZ.el('div', { class: primero ? 'activa' : null },
          VIZ.el('span', { style: { color: x.ok ? C.s6 : C.s8 } }, x.ok ? '✓ ' : '✗ '), `${NOM_CORTE[x.tipo]}: ${x.texto}${primero ? '   ← se aplica' : x.ok ? '   (también válido, pero llega antes otro)' : ''}`);
      }));
      registro.textContent = hallado
        ? `Corte ${NOM_CORTE[hallado.tipo]}: ${hallado.grupos.map((x) => `{${x.join(',')}}`).join(hallado.tipo === 'seq' ? ' → ' : hallado.tipo === 'loop' ? ' ↺ ' : ' | ')}. Cada grupo se descubre ahora por separado.`
        : 'Ningún corte es válido con estas aristas: el algoritmo recurre a una «fall-through» (por ejemplo, el modelo flor).';
      lectura.set([
        ['trazas', `${fn(L)} (${L.length} variantes)`],
        ['actividades / aristas', `${d.acts.length} / ${g.E.size}${g.E.size < d.par.size ? ` (de ${d.par.size})` : ''}`],
        ['corte aplicado', hallado ? NOM_CORTE[hallado.tipo] : 'ninguno'],
        ['grupos', hallado ? String(hallado.grupos.length) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), nd = geoG && P.nodoEn(geoG, x, y);
      if (nd && nd.etiqueta) {
        sel = sel === nd.id ? null : nd.id; dibujar();
        if (sel) {
          const d = dfgDe(L);
          registro.textContent = `${sel}: aparece ${d.frec.get(sel)} veces; sigue a ${[...d.par.keys()].filter((k) => k[1] === sel).map((k) => k[0]).join(', ') || '—'} y precede a ${[...d.par.keys()].filter((k) => k[0] === sel).map((k) => k[1]).join(', ') || '—'}.`;
        }
      }
    });
    leer();
  }

  /* ---------- Fig. 2: construcción del árbol paso a paso ---------- */

  function montarArbol(cuerpo) {
    let n = 100, ruido = 0, eta = 0, semilla = 1, raiz = null, ultimo = null, sel = null, geoA = [], pasos = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 40, max: 300, paso: 20, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.2, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Filtro η', min: 0, max: 0.5, paso: 0.05, valor: eta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eta = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevo registro', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.tinta2, 0.22), borde: C.tinta2, texto: '→ secuencia' }, { color: VIZ.alfa(C.s1, 0.22), borde: C.s1, texto: '× exclusivo' },
      { color: VIZ.alfa(C.s3, 0.22), borde: C.s3, texto: '+ paralelo' }, { color: VIZ.alfa(C.s7, 0.22), borde: C.s7, texto: '↺ bucle' },
      { color: C.neutro, borde: C.inactivo, texto: 'sublog pendiente (letras de sus actividades)' }, { color: C.tinta, texto: 'τ acción silenciosa', forma: 'cuadro' },
    ]);
    nombres(cuerpo, NOMBRE);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma un sublog pendiente, prueba los cortes y lo reemplaza por un operador con un sublog más pequeño por hijo. Haga clic en cualquier nodo para ver sus pruebas de corte. Con ruido y η = 0 casi todo se vuelve opcional o aparecen modelos flor; con η ≈ 0,2 vuelve la estructura.');

    function iniciar() {
      raiz = nuevoNodo(logPedidos(n, semilla, ruido)); ultimo = null; sel = null; pasos = 0;
      const g = construir(raiz, eta);
      return (function* () {
        for (let r = g.next(); !r.done; r = g.next()) { ultimo = r.value; pasos++; yield; }
      })();
    }
    function dibujar() {
      if (!raiz) return;
      lienzo.limpiar();
      let vistos = [];
      (function rec(x) { vistos.push(x); x.h.forEach(rec); })(raiz);
      const reciente = pasos ? ultimo : null;
      geoA = dibujarArbol(lienzo, raiz, { actual: reciente, sel });
      const mostrar = sel || reciente;
      lista.replaceChildren(...(mostrar && mostrar.intentos
        ? [VIZ.el('div', { class: 'activa' }, `Sublog {${mostrar.acts.join(',')}}: ${nTrazas(mostrar.L)} trazas`), ...mostrar.intentos.map((x) => VIZ.el('div', null,
          VIZ.el('span', { style: { color: x.ok ? C.s6 : C.s8 } }, x.ok ? '✓ ' : '✗ '), `${NOM_CORTE[x.tipo]}: ${x.texto}`))]
        : [VIZ.el('div', null, mostrar && mostrar.op !== 'pend' ? `Nodo ${mostrar.op === 'act' ? mostrar.a : OPS[mostrar.op] || 'τ'}: no necesitó probar cortes.` : 'Pulse «Un paso»: se mostrarán las cuatro pruebas de corte del sublog actual.')]));
      registro.textContent = reciente ? (reciente.nota || '') : `El registro tiene ${nTrazas(raiz.L)} casos y ${raiz.L.length} variantes: un único sublog pendiente.`;
      const pend = vistos.filter((x) => x.op === 'pend').length;
      lectura.set([
        ['pasos', String(pasos)],
        ['sublogs pendientes', String(pend)],
        ['nodos del árbol', String(vistos.length)],
        ['casos / variantes', `${nTrazas(raiz.L)} / ${raiz.L.length}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const nd = nodoArbolEn(geoA, x, y); sel = nd === sel ? null : nd; dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 3: ruido, filtro η y calidad del árbol ---------- */

  function evaluarArbol(arbol, L, semilla) {
    const total = nTrazas(L), ajustan = L.filter(([t]) => aceptaArbol(arbol, t)).reduce((s, [, v]) => s + v, 0);
    const claves = new Set(L.map(([t]) => t.join(''))), rnd = VIZ.semilla(semilla);
    let ok = 0;
    for (let i = 0; i < 150; i++) if (claves.has(muestrearArbol(arbol, rnd).join(''))) ok++;
    return { fitness: ajustan / total, precision: ok / 150, ajustan, total };
  }

  function montarCalidad(cuerpo) {
    let n = 120, ruido = 0.1, eta = 0, semilla = 1, L = [], arbol = null, curva = [], plano = null, hover = -1, geoA = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.4, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; nuevo(); } });
    const sliderEta = ctl.rango({ etiqueta: 'Filtro η', min: 0, max: 0.5, paso: 0.05, valor: eta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Casos', min: 40, max: 300, paso: 20, valor: n, alCambiar: (v) => { n = v; nuevo(); } });
    ctl.boton('Nuevo registro', () => { semilla++; nuevo(); }, { primario: true });
    VIZ.subtitulo(cuerpo, 'Árbol descubierto con el η elegido');
    const lA = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 340 });
    VIZ.subtitulo(cuerpo, 'Calidad del árbol según η');
    const lC = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 300 });
    const tip = VIZ.tooltip(lC);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.tinta2, 0.22), borde: C.tinta2, texto: 'operador (→ × + ↺)' }, { color: C.s8, texto: 'modelo flor (fall-through)', forma: 'linea' },
      { color: C.s1, texto: 'fitness: casos que el árbol reproduce', forma: 'linea' }, { color: C.s2, texto: 'precisión estimada (150 trazas muestreadas del árbol)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con η = 0 el ruido vuelve opcional casi cada actividad (o produce modelos flor): reproduce todo, pero casi no restringe y la precisión es baja. Suba η: se ignoran las trazas ruidosas, la precisión sube y el fitness baja un poco. Pase el cursor por la curva para ver cada η.');
    const etas = Array.from({ length: 11 }, (_, i) => i * 0.05);

    function nuevo() {
      L = logPedidos(n, semilla, ruido);
      curva = etas.map((e) => ({ e, ...evaluarArbol(inductivo(L, e), L, 5) }));
      dibujar();
    }
    function dibujar() {
      if (!L.length) return;
      arbol = inductivo(L, eta);
      lA.limpiar();
      geoA = dibujarArbol(lA, arbol, {});
      lC.limpiar();
      const { ctx } = lC;
      plano = VIZ.plano(lC, { xmin: 0, xmax: 0.5, ymin: 0, ymax: 1.02 }, { etiquetaX: 'filtro η', etiquetaY: 'valor', formatoX: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      VIZ.trazar(ctx, plano, curva.map((c) => [c.e, c.fitness]), C.s1, 2);
      VIZ.trazar(ctx, plano, curva.map((c) => [c.e, c.precision]), C.s2, 2);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(plano.sx(eta), plano.y0); ctx.lineTo(plano.sx(eta), plano.y1); ctx.stroke(); ctx.restore();
      const actual = curva.find((c) => Math.abs(c.e - eta) < 1e-9);
      if (actual) { VIZ.marcador(ctx, plano.sx(eta), plano.sy(actual.fitness), C.s1, 4.5); VIZ.marcador(ctx, plano.sx(eta), plano.sy(actual.precision), C.s2, 4.5); }
      if (hover >= 0) { const c = curva[hover]; VIZ.marcador(ctx, plano.sx(c.e), plano.sy(c.fitness), C.s1, 4); VIZ.marcador(ctx, plano.sx(c.e), plano.sy(c.precision), C.s2, 4); }
      const q = actual || evaluarArbol(arbol, L, 5);
      const flor = (function f(x) { return x.flor || x.h.some(f); })(arbol);
      registro.textContent = flor
        ? `Con η = ${VIZ.fmt(eta, 2)} alguna parte del registro no admite cortes y se resuelve con un modelo flor: el árbol reproduce ${Math.round(100 * q.fitness)} % de los casos, pero casi cualquier secuencia lo satisface.`
        : `Con η = ${VIZ.fmt(eta, 2)} cada nivel tiene un corte válido: el árbol reproduce ${q.ajustan} de ${q.total} casos y su estructura es la de un proceso con bloques.`;
      lectura.set([
        ['fitness', `${Math.round(100 * q.fitness)} % (${q.ajustan} de ${q.total} casos)`],
        ['precisión estimada', `${Math.round(100 * q.precision)} %`],
        ['nodos del árbol', String(tamanoArbol(arbol))],
        ['modelo flor', flor ? 'sí' : 'no'],
      ]);
    }
    lA.alDibujar = dibujar; lC.alDibujar = dibujar;
    lC.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lC.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const k = Math.max(0, Math.min(10, Math.round(plano.ix(x) / 0.05)));
      if (k !== hover) { hover = k; dibujar(); }
      const c = curva[k];
      tip.mostrar(x, y, `η = <b>${VIZ.fmt(c.e, 2)}</b>${VIZ.filaTooltip(C.s1, 'fitness', Math.round(100 * c.fitness) + ' %')}${VIZ.filaTooltip(C.s2, 'precisión', Math.round(100 * c.precision) + ' %')}`);
    });
    lC.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lC.canvas.addEventListener('click', (ev) => { const { x, y } = lC.posicion(ev); if (plano && plano.dentro(x, y)) { eta = Math.max(0, Math.min(0.5, Math.round(plano.ix(x) / 0.05) * 0.05)); sliderEta.valor = eta; dibujar(); } });
    nuevo();
  }

  VIZ.registrarTema('inductive-miner', {
    intro: String.raw`
      <p>El <strong>Inductive Miner</strong> descubre un modelo <em>de arriba hacia abajo</em>: busca en el
      <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a> una división del conjunto de actividades que corresponda a un operador
      (secuencia, elección exclusiva, paralelismo o bucle), parte el registro según esa división y repite el proceso con cada trozo hasta llegar a actividades sueltas.</p>
      <p>El resultado es un <a href="tema.html?id=process-trees">árbol de procesos</a>, y por construcción todo árbol se traduce a una red de Petri con
      <a href="tema.html?id=soundness">soundness</a>: sin bloqueos ni fichas sobrantes. A cambio, es más sensible al ruido que el
      <a href="tema.html?id=heuristic-miner">Heuristic Miner</a>, y por eso existe la variante con filtro de frecuencias (IMf).</p>`,
    visualizaciones: [
      {
        titulo: 'Los cuatro cortes sobre el DFG',
        descripcion: 'Elija un ejemplo y vea qué corte detecta el algoritmo y por qué los otros fallan. Pruebe «Paralelo con una traza ruidosa»: una sola traza rompe el corte hasta que sube η.',
        montar: montarCortes,
      },
      {
        titulo: 'Construcción recursiva del árbol',
        descripcion: 'Avance paso a paso: cada sublog pendiente se reemplaza por un operador y sublogs más pequeños. Haga clic en un nodo para ver las pruebas de corte de ese sublog.',
        montar: montarArbol,
      },
      {
        titulo: 'Ruido, filtro η y calidad del árbol',
        descripcion: 'Con ruido, η = 0 hace opcional casi todo o produce modelos flor (fitness alto, precisión baja). Suba η o haga clic sobre la curva para ver cómo sube la precisión a costa de algo de fitness.',
        montar: montarCalidad,
      },
    ],
    teoria: String.raw`
      <h2>Idea</h2>
      <p>Un <a href="tema.html?id=process-trees">árbol de procesos</a> es una expresión con operadores \(\rightarrow\) (secuencia), \(\times\) (elección exclusiva), \(\wedge\) (paralelismo) y
      \(\circlearrowleft\) (bucle) cuyas hojas son actividades o la acción silenciosa \(\tau\). El Inductive Miner (Leemans, Fahland y van der Aalst) busca, para el registro \(L\) con
      actividades \(\Sigma\), una partición \(\{\Sigma_1,\dots,\Sigma_k\}\) y un operador \(\oplus\) tal que \(L\) pueda explicarse como \(\oplus(L_1,\dots,L_k)\), con \(L_i\) la proyección
      de \(L\) sobre \(\Sigma_i\). Luego se aplica recursivamente a cada \(L_i\).</p>
      <h2>Los cortes sobre el DFG</h2>
      <p>Sea \(G\) el DFG de \(L\) (aristas \(a \to b\) si \(b\) sigue directamente a \(a\)), \(S\) las actividades iniciales y \(F\) las finales.</p>
      <ul>
        <li><strong>Exclusivo \(\times\):</strong> los componentes conexos de \(G\) sin dirección. Cada traza usa un solo componente.</li>
        <li><strong>Secuencia \(\rightarrow\):</strong> se agrupan las actividades que se alcanzan mutuamente (componentes fuertemente conexas) y se unen los grupos que no se alcanzan entre sí; el resultado debe quedar totalmente ordenado por alcanzabilidad.</li>
        <li><strong>Paralelo \(\wedge\):</strong> se unen los pares \(a, b\) a los que les falta \(a \to b\) o \(b \to a\). Cada componente resultante debe contener actividades iniciales y finales.</li>
        <li><strong>Bucle \(\circlearrowleft\):</strong> se retiran \(S\) y \(F\); las componentes restantes que se conectan hacia el cuerpo solo desde finales y hacia afuera solo hacia iniciales (y con todas las aristas \(F \to\) entrada y salida \(\to S\)) forman la parte «rehacer»; el resto es el cuerpo.</li>
      </ul>
      <h2>Algoritmo</h2>
      <pre><code>IM(L):
    si L = {}:                                devolver τ
    si L contiene trazas vacías:              devolver ×(τ, IM(L sin trazas vacías))
    si hay una sola actividad a:
        si todas las trazas son ⟨a⟩:          devolver a
        si no:                                devolver ↺(a, τ)
    G ← DFG(L)  (IMf: quitar aristas con frecuencia &lt; η · máxima de su origen)
    para op en (×, →, ∧, ↺):
        si existe un corte (Σ1, …, Σk) de G para op:
            devolver op(IM(L|Σ1), …, IM(L|Σk))
    devolver ↺(τ, ×(todas las actividades))   // fall-through: modelo flor</code></pre>
      <h2>Garantías y límites</h2>
      <div class="recuadro"><p><strong>Corrección:</strong> el árbol descubierto reproduce todo el registro (<em>fitness</em> perfecto) y es sound por construcción. Si el registro es completo respecto de la relación de sucesión directa de un árbol «razonable» (sin actividades duplicadas ni \(\tau\) ambiguas),
      el algoritmo lo redescubre salvo equivalencias (<em>rediscoverability</em>).</p></div>
      <ul>
        <li>No hay garantía de <a href="tema.html?id=fitness-precision">precisión</a>: un solo comportamiento inesperado puede dejar sin corte a todo un sublog y convertirlo en una flor, que acepta cualquier secuencia.</li>
        <li>La versión con filtro IMf quita ruido antes de buscar el corte, a costa de dejar fuera trazas poco frecuentes (fitness &lt; 1).</li>
        <li>Costo: cada nivel recorre el DFG; la profundidad está acotada por \(|\Sigma|\), así que el tiempo es polinomial en el tamaño del registro y de \(\Sigma\).</li>
      </ul>
      <h2>Ejemplo</h2>
      <p>Para \(L = \{abcd^6,\ abd^4\}\): el DFG es \(a \to b \to c \to d\) más \(b \to d\). No hay corte exclusivo (es conexo) y sí hay corte de secuencia \(\{a\}\to\{b\}\to\{c\}\to\{d\}\).
      La proyección sobre \(\{c\}\) contiene \(\langle c\rangle\) y \(\langle\rangle\), de modo que aparece \(\times(\tau, c)\): \(\rightarrow(a, b, \times(\tau, c), d)\).</p>
      <h2>Conexiones</h2>
      <ul>
        <li>Compare con el <a href="tema.html?id=alpha-algorithm">algoritmo Alfa</a> (sin garantías con ruido) y el <a href="tema.html?id=split-miner">Split Miner</a> (más preciso y simple, pero sin garantía de soundness en general).</li>
        <li>El árbol se convierte en una <a href="tema.html?id=workflow-nets">red de flujo de trabajo</a> bloque a bloque; vea también <a href="tema.html?id=discovery-comparison">la comparación de mineros</a>.</li>
        <li>La sensibilidad al ruido se estudia en <a href="tema.html?id=noise-and-incompleteness">Noise and Incompleteness</a>.</li>
      </ul>`,
  });
})();
