(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const { act, tau, sec, xor, y, bucle } = P;

  /* ---------- Operadores y utilidades de árboles ---------- */

  const OP = {
    seq: { simbolo: '→', nombre: 'secuencia', color: C.s1 },
    xor: { simbolo: '×', nombre: 'elección exclusiva', color: C.s2 },
    and: { simbolo: '∧', nombre: 'paralelo', color: C.s3 },
    loop: { simbolo: '↺', nombre: 'bucle (hacer, rehacer)', color: C.s7 },
  };
  const ORDEN = ['seq', 'xor', 'and', 'loop'];
  const LETRAS = ['a', 'b', 'c', 'd', 'e', 'f', null];

  const copiar = (n) => JSON.parse(JSON.stringify(n));
  const en = (n, ruta) => ruta.reduce((x, i) => x.h[i], n);
  const hojas = (n) => (n.t === 'act' ? 1 : n.h.reduce((s, h) => s + hojas(h), 0));
  const operadores = (n) => (n.t === 'act' ? 0 : 1 + n.h.reduce((s, h) => s + operadores(h), 0));
  const profundidad = (n) => (n.t === 'act' ? 0 : 1 + Math.max(...n.h.map(profundidad)));
  const conP = (n, p) => (n.t === 'act' ? n : { ...n, p: n.t === 'loop' ? p : n.p, h: n.h.map((h) => conP(h, p)) });
  const texto = (n) => (n.t === 'act' ? (n.a === null ? 'τ' : n.a) : `${OP[n.t].simbolo}(${n.h.map(texto).join(', ')})`);

  // Todas las mezclas de dos palabras (entrelazados que respetan el orden de cada una).
  const memo = new Map();
  function mezclas(a, b) {
    if (!a) return [b];
    if (!b) return [a];
    const k = a + '|' + b;
    if (memo.has(k)) return memo.get(k);
    const r = [...new Set([...mezclas(a.slice(1), b).map((s) => a[0] + s), ...mezclas(a, b.slice(1)).map((s) => b[0] + s)])];
    memo.set(k, r);
    return r;
  }
  // Lenguaje del árbol con a lo sumo k repeticiones por bucle (una palabra por traza; cada actividad es una letra).
  function lenguaje(arbol, k, tope = 3000) {
    let truncado = false;
    const cap = (a) => { const u = [...new Set(a)]; if (u.length > tope) { truncado = true; return u.slice(0, tope); } return u; };
    const rec = (n) => {
      if (n.t === 'act') return [n.a === null ? '' : n.a];
      if (n.t === 'seq') return n.h.map(rec).reduce((A, B) => cap(A.flatMap((a) => B.map((b) => a + b))), ['']);
      if (n.t === 'xor') return cap(n.h.flatMap(rec));
      if (n.t === 'and') return n.h.map(rec).reduce((A, B) => cap(A.flatMap((a) => B.flatMap((b) => mezclas(a, b)))), ['']);
      const D = rec(n.h[0]), R = rec(n.h[1]);
      let cur = D;
      const todo = [...D];
      for (let j = 1; j <= k; j++) { cur = cap(cur.flatMap((c) => R.flatMap((r) => D.map((d) => c + r + d)))); todo.push(...cur); }
      return cap(todo);
    };
    const p = rec(arbol);
    return { palabras: [...new Set(p)].sort((a, b) => a.length - b.length || a.localeCompare(b)), truncado };
  }

  /* ---------- Traducción a red de Petri (workflow net) ---------- */

  function aRed(arbol) {
    const plazas = [{ id: 'i', nombre: 'i' }, { id: 'f', nombre: 'f' }], trans = [], arcos = [];
    let np = 0, nt = 0;
    const pl = () => { const id = 'p' + (++np); plazas.push({ id, nombre: id }); return id; };
    const tr = (nombre, silenciosa) => { const id = 't' + (++nt); trans.push({ id, nombre: silenciosa ? 'τ' : nombre, silenciosa: !!silenciosa }); return id; };
    const ar = (a, b) => arcos.push([a, b]);
    function rec(n, pin, pout) {
      if (n.t === 'act') { const t = tr(n.a, n.a === null); ar(pin, t); ar(t, pout); }
      else if (n.t === 'seq') { let prev = pin; n.h.forEach((h, i) => { const sig = i === n.h.length - 1 ? pout : pl(); rec(h, prev, sig); prev = sig; }); }
      else if (n.t === 'xor') n.h.forEach((h) => rec(h, pin, pout));
      else if (n.t === 'and') {
        const ts = tr('τ', true), tj = tr('τ', true);
        ar(pin, ts);
        n.h.forEach((h) => { const a = pl(), b = pl(); ar(ts, a); rec(h, a, b); ar(b, tj); });
        ar(tj, pout);
      } else {
        const a = pl(), b = pl(), c = pl(), t0 = tr('τ', true), t1 = tr('τ', true), t2 = tr('τ', true);
        ar(pin, t0); ar(t0, a); rec(n.h[0], a, b); ar(b, t1); ar(t1, pout); ar(b, t2); ar(t2, c); rec(n.h[1], c, a);
      }
    }
    rec(arbol, 'i', 'f');
    return { plazas, trans, arcos, ini: 'i', fin: 'f' };
  }

  // Exploración del grafo de marcados para comprobar la solidez de la red (con tope de estados).
  function solidez(r) {
    const clave = (m) => Object.keys(m).filter((p) => m[p] > 0).sort().map((p) => `${p}:${m[p]}`).join(',');
    const ini = P.marcadoInicial(r);
    const est = [ini], idx = new Map([[clave(ini), 0]]), ent = [[]], disparadas = new Set();
    let truncado = false, sobrantes = false, bloqueo = false;
    for (let j = 0; j < est.length; j++) {
      const m = est[j];
      if ((m[r.fin] || 0) > 0 && clave(m) !== `${r.fin}:1`) sobrantes = true;
      const hab = r.trans.filter((t) => P.habilitada(r, m, t.id));
      if (!hab.length && clave(m) !== `${r.fin}:1`) bloqueo = true;
      for (const t of hab) {
        disparadas.add(t.id);
        const n = P.disparar(r, m, t.id), k = clave(n);
        let h = idx.get(k);
        if (h === undefined) { if (est.length >= 6000) { truncado = true; continue; } h = est.length; idx.set(k, h); est.push(n); ent.push([]); }
        ent[h].push(j);
      }
    }
    const fin = idx.get(`${r.fin}:1`), llega = new Set();
    if (fin !== undefined) { const pila = [fin]; llega.add(fin); while (pila.length) { const u = pila.pop(); ent[u].forEach((v) => { if (!llega.has(v)) { llega.add(v); pila.push(v); } }); } }
    const opcion = est.every((_, j) => llega.has(j)), muertas = r.trans.filter((t) => !disparadas.has(t.id)).length;
    return { estados: est.length, truncado, sound: !truncado && opcion && !sobrantes && !muertas && !bloqueo };
  }

  /* ---------- Dibujo del árbol ---------- */

  // Devuelve las regiones de cada nodo para detectar clics.
  function dibujarArbol(lienzo, arbol, sel) {
    const { ctx, ancho: W } = lienzo;
    const L = hojas(arbol), margen = 24, ancho = Math.max(60, W - 2 * margen), paso = 54;
    let k = 0;
    const regiones = [];
    function dispone(n, ruta, prof) {
      const g = { n, ruta, prof, hijos: [] };
      if (n.t === 'act') g.x = margen + ((k++ + 0.5) / L) * ancho;
      else { g.hijos = n.h.map((h, i) => dispone(h, [...ruta, i], prof + 1)); g.x = g.hijos.reduce((s, h) => s + h.x, 0) / g.hijos.length; }
      g.y = 28 + prof * paso;
      return g;
    }
    const raiz = dispone(arbol, [], 0);
    lienzo.limpiar();
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje;
    const aristas = (g) => g.hijos.forEach((h, i) => {
      ctx.beginPath(); ctx.moveTo(g.x, g.y + 13); ctx.lineTo(h.x, h.y - 13); ctx.stroke();
      if (g.n.t === 'loop') {
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9, 500); ctx.textAlign = i ? 'left' : 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(i ? 'rehacer' : 'hacer', (g.x + h.x) / 2 + (i ? 4 : -4), (g.y + h.y) / 2);
      }
      aristas(h);
    });
    aristas(raiz);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nodos = (g) => {
      const n = g.n, esSel = sel && sel.length === g.ruta.length && sel.every((v, i) => v === g.ruta[i]);
      if (n.t === 'act') {
        const t = n.a === null ? 'τ' : n.a;
        const w = n.a === null ? 24 : Math.max(26, ctx.measureText(t).width + 16);
        ctx.fillStyle = n.a === null ? C.tinta : C.superficie; ctx.strokeStyle = esSel ? C.s4 : C.tinta; ctx.lineWidth = esSel ? 3.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(g.x - w / 2, g.y - 13, w, 26, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = n.a === null ? C.sobre : C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.fillText(t, g.x, g.y + 0.5);
        regiones.push({ ruta: g.ruta, x: g.x, y: g.y, rx: w / 2 + 3, ry: 16 });
      } else {
        ctx.fillStyle = VIZ.alfa(OP[n.t].color, 0.22); ctx.strokeStyle = esSel ? C.s4 : OP[n.t].color; ctx.lineWidth = esSel ? 3.5 : 2;
        ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(15, 700); ctx.fillText(OP[n.t].simbolo, g.x, g.y + 1);
        regiones.push({ ruta: g.ruta, x: g.x, y: g.y, rx: 17, ry: 17 });
        g.hijos.forEach(nodos);
      }
    };
    nodos(raiz);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    return regiones;
  }
  const altoArbol = (a) => 28 + profundidad(a) * 54 + 36;
  const buscar = (regiones, x, yy) => regiones.find((r) => Math.abs(x - r.x) <= r.rx && Math.abs(yy - r.y) <= r.ry);

  // Dibujo de la red equivalente.
  const posCache = new WeakMap();
  function dibujarRed(lienzo, r) {
    if (!posCache.has(r)) posCache.set(r, P.posDeRed(r));
    const base = posCache.get(r), g = new Map();
    for (const k in base) { const c = base[k].x.toFixed(4); g.set(c, (g.get(c) || 0) + 1); }
    const capas = g.size, carriles = Math.max(1, ...g.values());
    const vertical = capas * 54 + 60 > lienzo.ancho, pos = {};
    for (const k in base) pos[k] = vertical ? { x: base[k].y, y: base[k].x } : base[k];
    const alto = vertical ? capas * 46 + 50 : Math.max(200, carriles * 54 + 60);
    if (alto !== lienzo.alto) return alto;
    const { nodos, aristas } = P.nodosDeRed(r, P.marcadoInicial(r), { plaza: (p) => ({ borde: p.id === 'i' ? C.s6 : C.tinta, etiqueta: '' }) });
    lienzo.limpiar();
    P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 11, margenX: 36, margenY: 28 });
    return null;
  }

  const leyendaOp = () => ORDEN.map((o) => ({ color: OP[o].color, texto: `${OP[o].simbolo} ${OP[o].nombre}`, forma: 'cuadro' }));

  /* ---------- Fig. 1: los cuatro operadores ---------- */

  const OPERANDOS1 = { a: ['a', () => act('a')], ab: ['a → b', () => sec(act('a'), act('b'))], axb: ['a × b', () => xor([act('a'), act('b')])] };
  const OPERANDOS2 = { c: ['c', () => act('c')], cd: ['c → d', () => sec(act('c'), act('d'))], tau: ['τ (nada)', () => tau()] };

  function montarOperadores(cuerpo) {
    let op = 'seq', o1 = 'ab', o2 = 'c', k = 2, arbol = null, altoA = 160, altoR = 200;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Operador', opciones: ORDEN.map((o) => [o, `${OP[o].simbolo}  ${OP[o].nombre}`]), valor: op, alCambiar: (v) => { op = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Primer operando', opciones: Object.entries(OPERANDOS1).map(([c, v]) => [c, v[0]]), valor: o1, alCambiar: (v) => { o1 = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Segundo operando', opciones: Object.entries(OPERANDOS2).map(([c, v]) => [c, v[0]]), valor: o2, alCambiar: (v) => { o2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Repeticiones máx. (bucle)', min: 0, max: 3, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    VIZ.subtitulo(cuerpo, 'Árbol de procesos');
    const lienA = VIZ.lienzo(cuerpo, { altoFn: () => altoA });
    VIZ.leyenda(cuerpo, leyendaOp());
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    VIZ.subtitulo(cuerpo, 'Red de Petri equivalente (marcado inicial)');
    const lienR = VIZ.lienzo(cuerpo, { altoFn: () => altoR });
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie el operador y los operandos y observe el lenguaje: → concatena, × une, ∧ entrelaza y ↺ repite «hacer» seguido de «rehacer» y otra vez «hacer». La red de abajo es la traducción mecánica del árbol; las cajas negras son transiciones silenciosas τ.');

    function dibujar() {
      const h = [OPERANDOS1[o1][1](), OPERANDOS2[o2][1]()];
      arbol = op === 'seq' ? sec(...h) : op === 'xor' ? xor(h) : op === 'and' ? y(...h) : bucle(h[0], h[1], 0.3);
      const nuevoA = altoArbol(arbol);
      if (nuevoA !== altoA) { altoA = nuevoA; lienA.ajustar(true); return; }
      dibujarArbol(lienA, arbol, null);
      const red = aRed(arbol);
      const need = dibujarRed(lienR, red);
      if (need !== null) { altoR = need; lienR.ajustar(true); return; }
      const L = lenguaje(arbol, k);
      lista.replaceChildren(VIZ.el('div', null, `Lenguaje de ${texto(arbol)}: ${L.palabras.length} traza${L.palabras.length === 1 ? '' : 's'}`),
        ...L.palabras.slice(0, 14).map((w) => VIZ.el('div', null, w ? w.split('').join(' → ') : '⟨ ⟩ (traza vacía)')), ...(L.palabras.length > 14 ? [VIZ.el('div', null, `… y ${L.palabras.length - 14} más`)] : []));
      const s = solidez(red);
      registro.textContent = op === 'loop'
        ? `El bucle ejecuta «${OPERANDOS1[o1][0]}» y, mientras se repita, «${OPERANDOS2[o2][0]}» seguido de «${OPERANDOS1[o1][0]}»: el lenguaje es infinito, aquí se cortó a ${k} repetición(es).`
        : `${OP[op].simbolo} combina «${OPERANDOS1[o1][0]}» y «${OPERANDOS2[o2][0]}»: ${op === 'seq' ? 'primero uno y después el otro' : op === 'xor' ? 'exactamente uno de los dos' : 'ambos, con todos los entrelazados posibles'}.`;
      lectura.set([
        ['trazas', String(L.palabras.length)],
        ['plazas / transiciones', `${red.plazas.length} / ${red.trans.length}`],
        ['marcados de la red', String(s.estados)],
        ['¿sound?', s.sound ? 'sí' : 'no'],
      ]);
    }
    lienA.alDibujar = dibujar; lienR.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: editor ---------- */

  const EJEMPLOS = {
    pedido: { nombre: 'Pedido: a → ×(b, c) → ∧(d, e) → f', crear: () => sec(act('a'), xor([act('b'), act('c')]), y(act('d'), act('e')), act('f')) },
    bucle: { nombre: 'Bucle: a → ↺(b, c) → d', crear: () => sec(act('a'), bucle(act('b'), act('c'), 0.3), act('d')) },
    complejo: { nombre: 'Complejo: a → ∧(×(b, c), d → e) → ↺(f, τ)', crear: () => sec(act('a'), y(xor([act('b'), act('c')]), sec(act('d'), act('e'))), bucle(act('f'), tau(), 0.3)) },
    simple: { nombre: 'Solo una actividad', crear: () => act('a') },
  };

  function montarEditor(cuerpo) {
    let arbol = EJEMPLOS.pedido.crear(), sel = [], k = 2, regiones = [], altoA = 200, altoR = 200, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplo', opciones: Object.entries(EJEMPLOS).map(([c, v]) => [c, v.nombre]), valor: 'pedido', alCambiar: (v) => { arbol = EJEMPLOS[v].crear(); sel = []; mensaje = 'Árbol cargado. Haga clic en un nodo para seleccionarlo.'; dibujar(); } });
    ctl.rango({ etiqueta: 'Repeticiones máx. (bucle)', min: 0, max: 3, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Cambiar operador', () => {
      const n = en(arbol, sel);
      if (n.t === 'act') { mensaje = 'Una hoja no tiene operador: use «Cambiar actividad».'; return dibujar(); }
      const nuevo = ORDEN[(ORDEN.indexOf(n.t) + 1) % ORDEN.length];
      if (nuevo === 'loop') {
        if (n.h.length === 1) n.h.push(tau());
        else if (n.h.length > 2) n.h = [n.h[0], xor(n.h.slice(1))];
        n.p = 0.3;
      }
      n.t = nuevo;
      mensaje = `El nodo ahora es ${OP[nuevo].simbolo} (${OP[nuevo].nombre}).`;
      dibujar();
    }, { primario: true });
    ctl.boton('Cambiar actividad', () => {
      const n = en(arbol, sel);
      if (n.t !== 'act') { mensaje = 'Seleccione una hoja para cambiar su actividad.'; return dibujar(); }
      n.a = LETRAS[(LETRAS.indexOf(n.a) + 1) % LETRAS.length];
      mensaje = n.a === null ? 'La hoja ahora es τ (no hace nada).' : `La hoja ahora es la actividad ${n.a}.`;
      dibujar();
    });
    ctl.boton('Agregar nodo', () => {
      const n = en(arbol, sel);
      const usadas = new Set(JSON.stringify(arbol).match(/"a":"(\w)"/g) || []);
      const letra = LETRAS.slice(0, 6).find((l) => !usadas.has(`"a":"${l}"`)) || 'a';
      if (n.t === 'act') {
        const copia = { ...n };
        Object.keys(n).forEach((q) => delete n[q]);
        Object.assign(n, sec(copia, act(letra)));
        mensaje = `La hoja se reemplazó por una secuencia con la nueva actividad ${letra}.`;
      } else if (n.t === 'loop') { mensaje = 'Un bucle tiene exactamente dos hijos (hacer y rehacer): cambie su operador o agregue dentro de uno de ellos.'; return dibujar(); }
      else { n.h.push(act(letra)); mensaje = `Se agregó la actividad ${letra} como último hijo.`; }
      dibujar();
    });
    ctl.boton('Eliminar nodo', () => {
      if (!sel.length) { mensaje = 'No se puede eliminar la raíz; cambie de ejemplo o edite sus hijos.'; return dibujar(); }
      const ruta = sel.slice(), padre = en(arbol, ruta.slice(0, -1)), i = ruta[ruta.length - 1];
      if (padre.t === 'loop') padre.h[i] = tau();
      else padre.h.splice(i, 1);
      // Un operador sin hijos desaparece; con un solo hijo se reemplaza por él (excepto el bucle).
      const limpiar = (r) => {
        const n = en(arbol, r);
        if (n.t === 'act' || n.t === 'loop') return;
        if (n.h.length === 0) {
          if (!r.length) { Object.keys(n).forEach((q) => delete n[q]); Object.assign(n, act('a')); return; }
          const p = en(arbol, r.slice(0, -1)), j = r[r.length - 1];
          if (p.t === 'loop') p.h[j] = tau(); else p.h.splice(j, 1);
          limpiar(r.slice(0, -1));
        } else if (n.h.length === 1) { const h = n.h[0]; Object.keys(n).forEach((q) => delete n[q]); Object.assign(n, h); }
      };
      limpiar(ruta.slice(0, -1));
      sel = [];
      mensaje = 'Nodo eliminado.';
      dibujar();
    });
    const lienA = VIZ.lienzo(cuerpo, { altoFn: () => altoA });
    VIZ.leyenda(cuerpo, [...leyendaOp(), { color: C.s4, texto: 'nodo seleccionado (anillo)', forma: 'cuadro' }]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    VIZ.subtitulo(cuerpo, 'Red de Petri equivalente');
    const lienR = VIZ.lienzo(cuerpo, { altoFn: () => altoR });
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para seleccionarlo y use los botones para cambiar su operador o actividad, agregar una hoja o eliminarlo. Cualquier árbol que arme es sound: la lectura lo comprueba explorando todos los marcados de la red equivalente.');
    lienA.canvas.style.cursor = 'pointer';
    lienA.canvas.addEventListener('click', (ev) => {
      const { x, y: yy } = lienA.posicion(ev), r = buscar(regiones, x, yy);
      if (r) { sel = r.ruta; const n = en(arbol, sel); mensaje = n.t === 'act' ? `Seleccionada la hoja ${n.a === null ? 'τ' : n.a}.` : `Seleccionado el nodo ${OP[n.t].simbolo} con ${n.h.length} hijos.`; dibujar(); }
    });

    function dibujar() {
      const nuevoA = altoArbol(arbol);
      if (nuevoA !== altoA) { altoA = nuevoA; lienA.ajustar(true); return; }
      regiones = dibujarArbol(lienA, arbol, sel);
      const red = aRed(arbol);
      const need = dibujarRed(lienR, red);
      if (need !== null) { altoR = need; lienR.ajustar(true); return; }
      const L = lenguaje(arbol, k), s = solidez(red);
      lista.replaceChildren(VIZ.el('div', null, `Árbol: ${texto(arbol)}`), VIZ.el('div', null, `Trazas (≤ ${k} repeticiones): ${L.palabras.length}${L.truncado ? ' (lista truncada)' : ''}`),
        ...L.palabras.slice(0, 12).map((w) => VIZ.el('div', null, w ? w.split('').join(' → ') : '⟨ ⟩ (traza vacía)')), ...(L.palabras.length > 12 ? [VIZ.el('div', null, `… y ${L.palabras.length - 12} más`)] : []));
      registro.textContent = mensaje || 'Haga clic en un nodo para seleccionarlo.';
      lectura.set([
        ['operadores / hojas', `${operadores(arbol)} / ${hojas(arbol)}`],
        ['trazas', String(L.palabras.length)],
        ['plazas / transiciones', `${red.plazas.length} / ${red.trans.length}`],
        ['marcados de la red', s.truncado ? '≥ 6000' : String(s.estados)],
        ['¿sound?', s.truncado ? 'no comprobado' : s.sound ? 'sí' : 'no'],
      ]);
    }
    lienA.alDibujar = dibujar; lienR.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 3: de un árbol a un registro ---------- */

  const MODELOS3 = {
    pedido: { nombre: 'a → ×(b, c) → ∧(d, e) → f', crear: () => sec(act('a'), xor([act('b'), act('c')]), y(act('d'), act('e')), act('f')) },
    bucle: { nombre: 'a → ↺(b, c) → d', crear: () => sec(act('a'), bucle(act('b'), act('c'), 0.3), act('d')) },
    complejo: { nombre: 'a → ∧(×(b, c), d → e) → ↺(f, g)', crear: () => sec(act('a'), y(xor([act('b'), act('c')]), sec(act('d'), act('e'))), bucle(act('f'), act('g'), 0.3)) },
  };

  function montarMuestreo(cuerpo) {
    let clave = 'complejo', n = 40, p = 0.3, semilla = 1, datos = null, plano = null, hover = -1;
    const KMAX = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Árbol', opciones: Object.entries(MODELOS3).map(([c, v]) => [c, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 10, max: 400, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Probabilidad de repetir el bucle', min: 0.1, max: 0.7, paso: 0.05, valor: p, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { p = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'traza del lenguaje que aparece en el registro', forma: 'cuadro' },
      { color: C.inactivo, texto: 'traza del lenguaje que nunca apareció (marca vacía)', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Cada barra es una traza del lenguaje del árbol (con a lo sumo ${KMAX} repeticiones por bucle), ordenadas por frecuencia en el registro simulado. Las marcas grises son trazas que el modelo permite y que este registro no contiene: un registro finito nunca agota un lenguaje infinito.`);

    function calcular() {
      const arbol = conP(MODELOS3[clave].crear(), p);
      const L = lenguaje(arbol, KMAX);
      const log = P.simular(arbol, n, semilla * 17 + n, { espera: 5 });
      const frec = new Map();
      log.forEach((c) => { const w = P.trazaDe(c).join(''); frec.set(w, (frec.get(w) || 0) + 1); });
      const dentro = new Set(L.palabras);
      const filas = L.palabras.map((w) => ({ w, f: frec.get(w) || 0 })).sort((a, b) => b.f - a.f || a.w.length - b.w.length || a.w.localeCompare(b.w));
      const fuera = [...frec.entries()].filter(([w]) => !dentro.has(w)).reduce((s, [, f]) => s + f, 0);
      datos = { filas, L, fuera, observadas: filas.filter((f) => f.f > 0).length, n: log.length, variantes: frec.size };
      dibujar();
    }
    function dibujar() {
      if (!datos) return;
      const { ctx } = lienzo, { filas } = datos;
      lienzo.limpiar();
      const ymax = Math.max(1, ...filas.map((f) => f.f)) * 1.12;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: filas.length, ymin: 0, ymax }, { etiquetaX: 'trazas del lenguaje, ordenadas por frecuencia', etiquetaY: 'casos', ticksX: [], formatoY: (v) => String(Math.round(v)) });
      plano.ejes();
      const bw = (plano.x1 - plano.x0) / filas.length;
      filas.forEach((f, i) => {
        const x = plano.sx(i) + Math.min(1, bw * 0.15), w = Math.max(1.5, bw - 2 * Math.min(1, bw * 0.15));
        if (f.f > 0) {
          const yy = plano.sy(f.f);
          ctx.fillStyle = i === hover ? VIZ.alfa(C.s1, 0.7) : C.s1;
          ctx.beginPath(); ctx.roundRect(x, yy, w, plano.y0 - yy, [Math.min(4, w / 2), Math.min(4, w / 2), 0, 0]); ctx.fill();
        } else {
          ctx.fillStyle = i === hover ? C.tinta2 : C.inactivo;
          ctx.fillRect(x, plano.y0 - 3, w, 3);
        }
      });
      const cob = Math.round((100 * datos.observadas) / filas.length);
      lectura.set([
        ['casos / variantes observadas', `${datos.n} / ${datos.variantes}`],
        ['trazas del lenguaje', `${filas.length}${datos.L.truncado ? '+' : ''} (≤ ${KMAX} repeticiones)`],
        ['trazas del lenguaje observadas', `${datos.observadas} de ${filas.length} (${cob} %)`],
        ['casos con más repeticiones', String(datos.fuera)],
      ]);
      registro.textContent = datos.observadas === filas.length
        ? `El registro contiene todas las trazas del lenguaje acotado: ${filas.length} de ${filas.length}.`
        : `Con ${datos.n} casos aparecen ${datos.observadas} de las ${filas.length} trazas del lenguaje; las ${filas.length - datos.observadas} restantes son posibles pero aún no se vieron. Suba el número de casos o la probabilidad de repetir.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !datos || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(datos.filas.length - 1, Math.floor(plano.ix(x))));
      if (i !== hover) { hover = i; dibujar(); }
      const f = datos.filas[i];
      tip.mostrar(x, y, `<b>${f.w.split('').join(' → ')}</b><br>${f.f} caso${f.f === 1 ? '' : 's'} (${VIZ.fmt((100 * f.f) / datos.n, 3)} %)${f.f ? '' : '<br>nunca apareció'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('process-trees', {
    intro: String.raw`
      <p>Un <strong>árbol de procesos</strong> describe un proceso con operadores anidados, como una expresión: las hojas son actividades (o \(\tau\), que no hace nada) y los
      nodos internos combinan a sus hijos con una <em>secuencia</em> \(\rightarrow\), una <em>elección exclusiva</em> \(\times\), un <em>paralelo</em> \(\wedge\) o un
      <em>bucle</em> \(\circlearrowleft\). Como solo se pueden anidar bloques completos, nunca se obtiene un modelo con bloqueos o fichas sobrantes: es <em>sound por construcción</em>.</p>
      <p>Esa propiedad hace de los árboles el modelo preferido de algoritmos como el <a href="tema.html?id=inductive-miner">Inductive Miner</a>: descubren primero un árbol y,
      si hace falta, lo traducen a una red de Petri o a BPMN para mostrarlo.</p>`,
    visualizaciones: [
      {
        titulo: 'Lenguaje de cada operador',
        descripcion: 'Elija un operador y dos operandos: vea el árbol, las trazas que acepta y la red de Petri equivalente. Compare × con ∧ sobre los mismos operandos.',
        montar: montarOperadores,
      },
      {
        titulo: 'Editor de árboles de procesos',
        descripcion: 'Seleccione nodos, cambie operadores y actividades, agregue y elimine. Pruebe convertir un × en ∧ y vea cómo cambia el número de trazas; la red equivalente siempre sale sound.',
        montar: montarEditor,
      },
      {
        titulo: 'De un árbol a un registro',
        descripcion: 'Simule casos de un árbol con bucles y compare con su lenguaje. Suba la probabilidad de repetir y los casos para ver qué trazas posibles faltan en el registro.',
        montar: montarMuestreo,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Dado un conjunto de actividades \(A\), un árbol de procesos es: una hoja \(a \in A\) o \(\tau\), o un nodo \(\oplus(Q_1, \dots, Q_m)\) con
      \(\oplus \in \{\rightarrow, \times, \wedge, \circlearrowleft\}\) y \(Q_i\) árboles; el bucle \(\circlearrowleft(Q_1, Q_2)\) tiene siempre dos hijos
      (<em>hacer</em> y <em>rehacer</em>; algunas variantes agregan un tercero, <em>salir</em>).</p>
      <h2>Lenguaje</h2>
      <p>El lenguaje \(\mathcal{L}(Q) \subseteq A^{*}\) se define por inducción. Con \(\cdot\) la concatenación y \(\sqcup\) el entrelazado (<em>shuffle</em>):</p>
      \[ \mathcal{L}(a) = \{\langle a \rangle\}, \quad \mathcal{L}(\tau) = \{\langle\rangle\}, \quad
         \mathcal{L}(\rightarrow(Q_1, Q_2)) = \mathcal{L}(Q_1) \cdot \mathcal{L}(Q_2), \quad \mathcal{L}(\times(Q_1, Q_2)) = \mathcal{L}(Q_1) \cup \mathcal{L}(Q_2), \]
      \[ \mathcal{L}(\wedge(Q_1, Q_2)) = \mathcal{L}(Q_1) \sqcup \mathcal{L}(Q_2), \quad
         \mathcal{L}(\circlearrowleft(Q_1, Q_2)) = \mathcal{L}(Q_1) \cdot \bigl(\mathcal{L}(Q_2) \cdot \mathcal{L}(Q_1)\bigr)^{*}. \]
      <p>Para \(w_1\) de longitud \(m\) y \(w_2\) de longitud \(n\) sin letras repetidas, \(|w_1 \sqcup w_2| = \binom{m+n}{m}\). Con un bucle el lenguaje es infinito; al
      enumerarlo se corta el número de repeticiones.</p>
      <pre><code>lenguaje(→(Q₁,…,Qₘ)) ← producto de los lenguajes, concatenando
lenguaje(×(Q₁,…,Qₘ)) ← unión
lenguaje(∧(Q₁,…,Qₘ)) ← todos los entrelazados de una palabra de cada hijo
lenguaje(↺(Q₁,Q₂), k) ← L₁ ∪ L₁·L₂·L₁ ∪ … ∪ L₁·(L₂·L₁)ᵏ</code></pre>
      <h2>Sound por construcción</h2>
      <p>Cada operador se traduce a una red de Petri con una plaza de entrada y una de salida, y se combinan por sustitución de bloques: la secuencia encadena las
      plazas, la elección comparte entrada y salida, el paralelo usa una transición silenciosa de apertura y otra de cierre, y el bucle agrega tres \(\tau\).</p>
      <div class="recuadro"><p><strong>Teorema.</strong> La workflow net que se obtiene de un árbol de procesos es <em>sound</em> y está libre de elección con memoria
      mezclada. Se prueba por inducción sobre el árbol: cada bloque, visto como una caja con una ficha de entrada, termina con una ficha de salida y sin fichas
      residuales, y reemplazar una caja con esa propiedad por otra igual la conserva.</p></div>
      <h2>Limitaciones</h2>
      <ul>
        <li>Son bloques bien anidados: no expresan cualquier red (por ejemplo, dependencias cruzadas de una red de Petri general).</li>
        <li>Una actividad solo puede aparecer en una hoja concreta, pero puede repetirse en varias hojas: la <em>duplicación</em> de etiquetas sí se permite.</li>
        <li>El lenguaje con bucles es infinito: todo registro finito es una muestra, como muestra la tercera figura.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>Los operadores se corresponden con las compuertas de <a href="tema.html?id=bpmn-gateways">BPMN</a> (× con XOR, ∧ con AND), y el árbol se lee como una red de
      <a href="tema.html?id=petri-nets">Petri</a> bien estructurada. Descubrir un árbol desde un registro es el trabajo del
      <a href="tema.html?id=inductive-miner">Inductive Miner</a>; comparar la calidad del resultado, el de la <a href="tema.html?id=fitness-precision">fitness y la precisión</a>.</p>`,
  });
})();
