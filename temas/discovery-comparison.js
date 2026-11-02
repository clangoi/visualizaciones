(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Proceso de solicitudes: recibir, dos revisiones en paralelo, decidir, tres resoluciones exclusivas y notificar.
  const A = P.act;
  const ARBOL = P.sec(A('Recibir'), P.y(A('Validar'), A('Evaluar')), A('Decidir'), P.xor([A('Aprobar'), A('Rechazar'), A('Escalar')], [0.5, 0.3, 0.2]), A('Notificar'));
  const LETRA = { Recibir: 'a', Validar: 'b', Evaluar: 'c', Decidir: 'd', Aprobar: 'e', Rechazar: 'f', Escalar: 'g', Notificar: 'h' };
  const NOMBRE = Object.fromEntries(Object.entries(LETRA).map(([k, v]) => [v, k]));
  function logPedidos(n, semilla, ruido) {
    const log = P.simular(ARBOL, n, semilla, { ruido, espera: 5 });
    log.forEach((c) => c.eventos.forEach((e) => { e.act = LETRA[e.act] || e.act; }));
    return log;
  }
  const nombres = (cuerpo, N) => cuerpo.appendChild(VIZ.el('div', { class: 'lista-mono' }, VIZ.el('div', null, Object.entries(N).map(([k, v]) => `${k} = ${v}`).join('  ·  '))));
  const pc = (v) => `${Math.round(100 * v)} %`;

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


  /* ---------- Cuatro modelos sobre el mismo registro ---------- */

  const NOM_ALG = { alfa: 'Alfa', heur: 'Heurístico', im0: 'Inductivo', imf: 'Inductivo IMf', flor: 'Flor' };
  const COL_ALG = { alfa: C.s1, heur: C.s2, im0: C.s3, imf: C.s4, flor: C.s5 };
  const FORMA_ALG = { alfa: 0, heur: 1, im0: 2, imf: 3, flor: 5 };

  function modeloAlfa(log) {
    const t0 = performance.now(), a = P.alfa(log), red = a.red, ms = performance.now() - t0;
    return {
      ms, V: red.plazas.length + red.trans.length, E: red.arcos.length,
      ajusta: (t) => { const r = P.reproducir(red, t); return r.m === 0 && r.r === 0; },
      muestra: (rnd) => {
        let m = P.marcadoInicial(red); const tr = [];
        for (let i = 0; i < 25; i++) {
          if ((m[red.fin] || 0) > 0) return tr;
          const hab = red.trans.filter((t) => P.habilitada(red, m, t.id));
          if (!hab.length) return null;
          const t = hab[Math.floor(rnd() * hab.length)];
          tr.push(t.nombre); m = P.disparar(red, m, t.id);
        }
        return null;
      },
    };
  }
  // «Heurístico»: grafo de dependencias (a ⇒ b ≥ τ) más los pares paralelos, que pueden ir en cualquier orden pero una sola vez por traza.
  // No tiene enlaces de C-Net: por eso admite caminos que se saltan una rama paralela, y su precisión es menor.
  function modeloHeur(log, tau) {
    const t0 = performance.now(), d = P.dfg(log), N = log.length, nu = Math.max(2, Math.round(0.02 * N));
    const dep = new Set(), par = new Set(), sig = new Map(d.acts.map((a) => [a, []])), sigPar = new Map(d.acts.map((a) => [a, []]));
    const medida = (a, b) => (d.n(a, b) - d.n(b, a)) / (d.n(a, b) + d.n(b, a) + 1);
    for (const a of d.acts) for (const b of d.acts) {
      if (a === b) continue;
      if (d.n(a, b) >= nu && medida(a, b) >= tau) { dep.add(a + b); sig.get(a).push(b); }
      else if (a < b && d.n(a, b) >= nu && d.n(b, a) >= nu && medida(a, b) < tau && medida(b, a) < tau) { par.add(a + b); sigPar.get(a).push(b); sigPar.get(b).push(a); }
    }
    const lim = Math.max(1, 0.05 * N), ini = d.acts.filter((a) => (d.ini.get(a) || 0) >= lim), fin = new Set(d.acts.filter((a) => (d.fin.get(a) || 0) >= lim));
    const ms = performance.now() - t0, adj = (a, b) => dep.has(a + b) || par.has(a < b ? a + b : b + a);
    return {
      ms, V: d.acts.length + 2, E: dep.size + par.size + ini.length + fin.size,
      ajusta: (t) => ini.includes(t[0]) && fin.has(t[t.length - 1]) && t.every((a, i) => i === 0 || adj(t[i - 1], a)),
      muestra: (rnd) => {
        if (!ini.length) return null;
        let a = ini[Math.floor(rnd() * ini.length)]; const tr = [a], visto = new Set([a]);
        for (let i = 0; i < 25; i++) {
          const op = sig.get(a).map((b) => [b, false]).concat(sigPar.get(a).filter((b) => !visto.has(b)).map((b) => [b, true]));
          const opciones = op.concat(fin.has(a) ? [[null, false]] : []);
          if (!opciones.length) return null;
          const [b] = opciones[Math.floor(rnd() * opciones.length)];
          if (b === null) return tr;
          tr.push(b); visto.add(b); a = b;
        }
        return null;
      },
    };
  }
  function modeloArbol(arbol, ms) {
    return { ms, V: tamanoArbol(arbol), E: tamanoArbol(arbol) - 1, ajusta: (t) => aceptaArbol(arbol, t), muestra: (rnd) => muestrearArbol(arbol, rnd), arbol };
  }
  function modeloInductivo(L, eta) { const t0 = performance.now(), arbol = inductivo(L, eta); return modeloArbol(arbol, performance.now() - t0); }
  function modeloFlor(acts) {
    const hojas = acts.map((a) => ({ op: 'act', a, h: [], acts: [a] }));
    return modeloArbol({ op: 'loop', acts, h: [{ op: 'tau', h: [], acts: [] }, { op: 'xor', acts, h: hojas }] }, 0);
  }
  // Puntúa un modelo: fitness exacto por casos, precisión estimada con 300 trazas muestreadas del modelo.
  function puntuar(m, variantes, N) {
    const claves = new Set(variantes.map((v) => v.k)), rnd = VIZ.semilla(11);
    const fitCasos = variantes.filter((v) => m.ajusta(v.t)).reduce((s, v) => s + v.n, 0);
    let buenas = 0; const malas = new Map();
    for (let i = 0; i < 300; i++) {
      const t = m.muestra(rnd);
      if (t && claves.has(t.join(''))) buenas++; else malas.set(t ? t.join('') : '(sin final)', 1);
    }
    const fit = fitCasos / N, prec = buenas / 300, simp = 1 / (1 + Math.max(0, m.E - m.V) / m.V);
    return { fit, prec, F: fit + prec ? 2 * fit * prec / (fit + prec) : 0, simp, V: m.V, E: m.E, ms: m.ms, noFit: variantes.filter((v) => !m.ajusta(v.t)), malas: [...malas.keys()].slice(0, 4) };
  }
  function evaluarTodos(log, tau, eta, claves = ['alfa', 'heur', 'imf', 'flor']) {
    const variantes = P.variantes(log).map((v) => ({ t: v.traza, n: v.n, k: v.traza.join('') }));
    const L = variantes.map((v) => [v.t, v.n]), acts = P.actividades(log);
    const crea = { alfa: () => modeloAlfa(log), heur: () => modeloHeur(log, tau), im0: () => modeloInductivo(L, 0), imf: () => modeloInductivo(L, eta), flor: () => modeloFlor(acts) };
    const res = {};
    for (const k of claves) res[k] = puntuar(crea[k](), variantes, log.length);
    return { res, variantes };
  }

  /* ---------- Fig. 1: tabla y barras comparativas ---------- */

  function montarComparacion(cuerpo) {
    let n = 150, ruido = 0.1, tau = 0.8, eta = 0.2, semilla = 1, E = null, sel = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 60, max: 300, paso: 30, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.3, paso: 0.02, valor: ruido, formato: (v) => pc(v), alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Umbral heurístico τ', min: 0.3, max: 0.98, paso: 0.02, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; calcular(); } });
    ctl.rango({ etiqueta: 'Filtro inductivo η', min: 0, max: 0.5, paso: 0.05, valor: eta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eta = v; calcular(); } });
    ctl.boton('Nuevo registro', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'fitness: casos que el modelo reproduce' }, { color: C.s2, texto: 'precisión (estimada por muestreo)' }, { color: C.s3, texto: 'simplicidad (1 = sin arcos de más)' },
    ]);
    nombres(cuerpo, NOMBRE);
    const caja = VIZ.el('div', { class: 'caja-desplazable' }), tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todas las métricas se calculan sobre el mismo registro. Haga clic en un grupo de barras (o en una fila de la tabla) para ver qué variantes del registro no reproduce ese modelo y qué trazas inventa. Con ruido alto, Alfa pierde fitness y el inductivo sin filtro tiende a la flor; suba η o τ.');
    const claves = ['alfa', 'heur', 'imf', 'flor'];
    const nombreDe = (k) => (k === 'imf' ? `Inductivo (η = ${VIZ.fmt(eta, 2)})` : NOM_ALG[k]);

    function calcular() {
      const log = logPedidos(n, semilla, ruido);
      E = evaluarTodos(log, tau, eta, claves);
      E.N = log.length;
      dibujar();
    }
    function dibujar() {
      if (!E) return;
      lienzo.limpiar();
      const { ctx, ancho: W, alto: H } = lienzo, izq = 34, der = 8, sup = 14, inf = 30, base = H - inf, alto = base - sup;
      const gw = (W - izq - der) / claves.length;
      geo = { izq, gw, base, sup };
      ctx.font = VIZ.fuente(10, 400); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      [0, 0.5, 1].forEach((v) => {
        const y = base - v * alto;
        ctx.strokeStyle = v === 0 ? C.eje : C.rejilla; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(izq, y + 0.5); ctx.lineTo(W - der, y + 0.5); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.fillText(VIZ.fmt(v, 2), izq - 5, y);
      });
      claves.forEach((k, i) => {
        const r = E.res[k], x0 = izq + i * gw, bw = Math.min(34, (gw * 0.86) / 3 - 2);
        if (sel === k) { ctx.fillStyle = C.neutro; ctx.fillRect(x0 + 2, sup - 6, gw - 4, base - sup + 6); }
        [[r.fit, C.s1], [r.prec, C.s2], [r.simp, C.s3]].forEach(([v, col], j) => {
          const x = x0 + gw / 2 + (j - 1.5) * (bw + 2) + 1, h = Math.max(1, v * alto);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, base - h, bw, h, [4, 4, 0, 0]); ctx.fill();
          if (bw >= 22) { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(Math.round(v * 100)), x + bw / 2, base - h - 2); }
        });
        ctx.fillStyle = sel === k ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(11, sel === k ? 700 : 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(k === 'imf' ? 'Inductivo' : NOM_ALG[k], x0 + gw / 2, base + 8);
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const filas = claves.map((k) => {
        const r = E.res[k];
        const tr = VIZ.el('tr', { class: [sel === k ? 'activa' : '', 'clicable'].join(' ').trim() },
          VIZ.el('td', { class: 'izq' }, nombreDe(k)), VIZ.el('td', null, pc(r.fit)), VIZ.el('td', null, pc(r.prec)), VIZ.el('td', null, VIZ.fmt(r.F, 2)),
          VIZ.el('td', null, VIZ.fmt(r.simp, 2)), VIZ.el('td', null, `${r.V} + ${r.E}`), VIZ.el('td', null, VIZ.fmt(r.ms, 2)));
        tr.addEventListener('click', () => { sel = sel === k ? null : k; dibujar(); });
        return tr;
      });
      tabla.replaceChildren(VIZ.el('thead', null, VIZ.el('tr', null, ['algoritmo', 'fitness', 'precisión', 'F', 'simplicidad', 'nodos + arcos', 'ms'].map((t, i) => VIZ.el('th', { class: i === 0 ? 'izq' : null }, t)))), VIZ.el('tbody', null, filas));
      if (sel) {
        const r = E.res[sel], tot = E.N;
        lista.replaceChildren(VIZ.el('div', { class: 'activa' }, `${nombreDe(sel)}: ${r.noFit.length} variante(s) del registro no se reproducen (${pc(r.noFit.reduce((s, v) => s + v.n, 0) / tot)} de los casos)`),
          ...r.noFit.slice(0, 4).map((v) => VIZ.el('div', null, `${v.t.join('')}  ×${v.n}`)),
          VIZ.el('div', null, r.malas.length ? `trazas del modelo que no están en el registro: ${r.malas.join(', ')}` : 'todas las trazas muestreadas del modelo están en el registro'));
      } else lista.replaceChildren(VIZ.el('div', null, 'Haga clic en un modelo para ver sus desajustes con el registro.'));
      const mejor = claves.reduce((a, b) => (E.res[b].F > E.res[a].F ? b : a));
      registro.textContent = `En este registro (${E.N} casos, ${E.variantes.length} variantes) el mejor equilibrio fitness–precisión lo logra ${nombreDe(mejor)} con F = ${VIZ.fmt(E.res[mejor].F, 2)}.`;
      lectura.set([
        ['casos / variantes', `${E.N} / ${E.variantes.length}`],
        ['mejor F-score', `${nombreDe(mejor)} (${VIZ.fmt(E.res[mejor].F, 2)})`],
        ['mayor fitness', nombreDe(claves.reduce((a, b) => (E.res[b].fit > E.res[a].fit ? b : a)))],
        ['menor tamaño', nombreDe(claves.reduce((a, b) => (E.res[b].V + E.res[b].E < E.res[a].V + E.res[a].E ? b : a)))],
      ]);
    }
    const grupoEn = (x, y) => (geo && x >= geo.izq && y >= geo.sup - 6 ? claves[Math.floor((x - geo.izq) / geo.gw)] : undefined);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), k = grupoEn(x, y); if (k) { sel = sel === k ? null : k; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), k = grupoEn(x, y);
      if (!k || !E) return tip.ocultar();
      const r = E.res[k];
      tip.mostrar(x, y, `<b>${nombreDe(k)}</b>${VIZ.filaTooltip(C.s1, 'fitness', pc(r.fit))}${VIZ.filaTooltip(C.s2, 'precisión', pc(r.prec))}${VIZ.filaTooltip(C.s3, 'simplicidad', VIZ.fmt(r.simp, 2))}F = <b>${VIZ.fmt(r.F, 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: efecto del ruido ---------- */

  function montarRuido(cuerpo) {
    let n = 150, tau = 0.8, eta = 0.2, semilla = 1, metrica = 'F', curvas = null, plano = null, hover = -1;
    const niveles = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
    const claves = ['alfa', 'heur', 'im0', 'imf', 'flor'];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Métrica', opciones: [['F', 'F-score (fitness y precisión)'], ['fit', 'Fitness'], ['prec', 'Precisión'], ['simp', 'Simplicidad']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Casos', min: 60, max: 240, paso: 30, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Umbral heurístico τ', min: 0.3, max: 0.98, paso: 0.02, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; calcular(); } });
    ctl.rango({ etiqueta: 'Filtro IMf η', min: 0.05, max: 0.5, paso: 0.05, valor: eta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eta = v; calcular(); } });
    ctl.boton('Nuevo registro', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, claves.map((k) => ({ color: COL_ALG[k], texto: k === 'imf' ? 'Inductivo con filtro (IMf)' : k === 'im0' ? 'Inductivo básico (η = 0)' : k === 'flor' ? 'Flor (referencia)' : NOM_ALG[k], forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un registro nuevo con ese nivel de ruido (la semilla fija la secuencia de casos). Compare cuánto cae el F-score de Alfa frente al heurístico y al inductivo con filtro; pase el cursor para ver los valores y cambie la métrica para separar fitness y precisión.');
    const NOM_M = { F: 'F-score', fit: 'fitness', prec: 'precisión', simp: 'simplicidad' };

    function calcular() {
      curvas = niveles.map((r) => evaluarTodos(logPedidos(n, semilla, r), tau, eta, claves).res);
      dibujar();
    }
    function dibujar() {
      if (!curvas) return;
      lienzo.limpiar();
      const { ctx } = lienzo;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 0.3, ymin: 0, ymax: 1.03 }, { etiquetaX: 'ruido (probabilidad de alterar una traza)', etiquetaY: NOM_M[metrica], formatoX: (v) => pc(v) });
      plano.ejes();
      claves.forEach((k) => {
        VIZ.trazar(ctx, plano, niveles.map((r, i) => [r, curvas[i][k][metrica]]), COL_ALG[k], 2);
        niveles.forEach((r, i) => VIZ.marcador(ctx, plano.sx(r), plano.sy(curvas[i][k][metrica]), COL_ALG[k], i === hover ? 5.5 : 4, FORMA_ALG[k]));
      });
      if (hover >= 0) { ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(plano.sx(niveles[hover]), plano.y0); ctx.lineTo(plano.sx(niveles[hover]), plano.y1); ctx.stroke(); ctx.restore(); }
      const f = (k, i) => curvas[i][k][metrica];
      const caida = (k) => f(k, 0) - f(k, niveles.length - 1);
      const mayor = claves.reduce((a, b) => (caida(b) > caida(a) ? b : a));
      registro.textContent = `${NOM_M[metrica][0].toUpperCase() + NOM_M[metrica].slice(1)} con 0 % y con 30 % de ruido: ${claves.map((k) => `${NOM_ALG[k]} ${VIZ.fmt(f(k, 0), 2)} → ${VIZ.fmt(f(k, niveles.length - 1), 2)}`).join(' · ')}.`;
      lectura.set([
        ['casos por punto', String(n)],
        ['mayor caída 0 → 30 %', `${NOM_ALG[mayor]} (${VIZ.fmt(caida(mayor), 2)})`],
        ['mejor con 30 % de ruido', NOM_ALG[claves.reduce((a, b) => (f(b, niveles.length - 1) > f(a, niveles.length - 1) ? b : a))]],
        ['métrica', NOM_M[metrica]],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(niveles.length - 1, Math.round(plano.ix(x) / 0.05)));
      if (i !== hover) { hover = i; dibujar(); }
      tip.mostrar(x, y, `ruido <b>${pc(niveles[i])}</b>` + claves.map((k) => VIZ.filaTooltip(COL_ALG[k], NOM_ALG[k], VIZ.fmt(curvas[i][k][metrica], 2))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('discovery-comparison', {
    intro: String.raw`
      <p>No existe un algoritmo de descubrimiento que sea el mejor siempre. El <a href="tema.html?id=alpha-algorithm">Alfa</a> es exacto con registros limpios y completos, el
      <a href="tema.html?id=heuristic-miner">Heuristic Miner</a> tolera ruido a costa de modelos sin garantías, el <a href="tema.html?id=inductive-miner">Inductive Miner</a> asegura
      modelos correctos pero puede volverse muy permisivo y el <a href="tema.html?id=split-miner">Split Miner</a> busca precisión y simplicidad.</p>
      <p>Aquí se ejecutan varios mineros sobre el <em>mismo</em> registro y se miden las mismas dimensiones: fitness (¿reproduce lo observado?), precisión (¿evita comportamiento no observado?),
      simplicidad (¿cuántos elementos tiene?) y tiempo. Variar el ruido muestra por qué la elección depende de los datos.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuatro modelos sobre el mismo registro',
        descripcion: 'Compare fitness, precisión y simplicidad de Alfa, un grafo heurístico, el inductivo con filtro y el modelo flor. Haga clic en un grupo para ver qué variantes no reproduce; pruebe subir el ruido y luego η.',
        montar: montarComparacion,
      },
      {
        titulo: 'Efecto del ruido en cada algoritmo',
        descripcion: 'Curvas de calidad según el nivel de ruido. Alfa cae primero; el inductivo básico mantiene fitness pero pierde precisión, y el filtro IMf o el umbral heurístico recuperan el equilibrio.',
        montar: montarRuido,
      },
    ],
    teoria: String.raw`
      <h2>Cómo se mide aquí</h2>
      <p>Las métricas son versiones simplificadas de las dimensiones de calidad de la <a href="tema.html?id=fitness-precision">conformidad</a>, calculadas de la misma forma para todos los modelos
      para que sean comparables. Sea \(L\) el registro, con \(N\) casos y un conjunto \(V_L\) de variantes.</p>
      <ul>
        <li><strong>Fitness:</strong> fracción de casos que el modelo reproduce exactamente,
        \[ \mathrm{fit} = \frac{|\{\sigma \in L : \sigma \in \mathcal{L}(M)\}|}{N}. \]
        Para una red de Petri se usa la reproducción de fichas sin fichas faltantes ni sobrantes; para un árbol, la pertenencia a su lenguaje; para el grafo heurístico, que cada par de actividades consecutivas esté permitido.</li>
        <li><strong>Precisión:</strong> se muestrean 300 trazas al azar del modelo (decisiones uniformes, bucles con probabilidad 1/2, límite de longitud) y se cuenta qué fracción aparece en el registro,
        \[ \mathrm{prec} \approx \frac{|\{\text{muestras} \in V_L\}|}{300}. \]
        Un modelo flor casi siempre produce secuencias nunca vistas: precisión cercana a 0.</li>
        <li><strong>F-score:</strong> la media armónica \(F = 2\,\mathrm{fit}\,\mathrm{prec}/(\mathrm{fit} + \mathrm{prec})\), que penaliza descuidar una de las dos.</li>
        <li><strong>Simplicidad:</strong> con \(V\) nodos y \(E\) arcos, \(1/(1 + \max(0, E - V)/V)\): vale 1 para estructuras sin ciclos ni compuertas de más, como un árbol, y baja a medida que sobran arcos.</li>
      </ul>
      <div class="recuadro"><p><strong>Advertencia:</strong> el muestreo uniforme es un estimador, no la precisión de referencia (basada en alineamientos); ordena bien los modelos pero sus valores absolutos dependen de cómo se muestrea.
      Vea <a href="tema.html?id=generalization-simplicity">generalización y simplicidad</a> para otras definiciones.</p></div>
      <h2>Características de los algoritmos</h2>
      <table>
        <thead><tr><th>Algoritmo</th><th>Ruido</th><th>Concurrencia</th><th>Bucles</th><th>Garantías</th></tr></thead>
        <tbody>
          <tr><td>Alfa</td><td>muy sensible</td><td>sí</td><td>cortos mal</td><td>solo con registros completos y sin ruido</td></tr>
          <tr><td>Heuristic Miner</td><td>tolera (umbrales)</td><td>sí (AND/XOR)</td><td>cortos</td><td>ninguna sobre soundness</td></tr>
          <tr><td>Inductive Miner (IMf)</td><td>tolera con filtro</td><td>sí</td><td>sí</td><td>soundness; fitness 1 sin filtro</td></tr>
          <tr><td>Split Miner</td><td>tolera (percentil)</td><td>sí</td><td>cortos</td><td>soundness tras reparar</td></tr>
        </tbody>
      </table>
      <h2>Lectura de los resultados</h2>
      <ul>
        <li>Con ruido 0 %, Alfa y el inductivo reproducen el proceso con fitness y precisión altos; el heurístico puede quedar algo corto de fitness porque descarta ramas raras.</li>
        <li>Al subir el ruido, Alfa descubre relaciones espurias en cada traza alterada y su fitness cae rápido (vea <a href="tema.html?id=alpha-limitations">sus limitaciones</a>).</li>
        <li>El inductivo sin filtro conserva fitness 1, pero cada comportamiento atípico puede dejar un sublog sin corte y convertirlo en flor: la precisión se hunde. El filtro η devuelve el equilibrio.</li>
        <li>El modelo flor es la referencia inferior: fitness 1, simplicidad máxima y precisión casi nula. Un modelo útil debe superar a la flor en precisión.</li>
      </ul>
      <h2>Elegir un algoritmo</h2>
      <p>Si el registro es pequeño y limpio, la estructura de bloques del inductivo es clara; con ruido o muchas variantes, conviene un minero con filtro (heurístico, IMf, <a href="tema.html?id=split-miner">Split Miner</a>) y revisar el modelo con
      <a href="tema.html?id=token-based-replay">reproducción de fichas</a> o <a href="tema.html?id=alignments">alineamientos</a>. Para el contexto general vea <a href="tema.html?id=process-discovery">Process Discovery</a> y
      <a href="tema.html?id=noise-and-incompleteness">Noise and Incompleteness</a>.</p>`,
  });
})();
