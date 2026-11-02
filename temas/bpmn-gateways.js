(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Motor BPMN: fichas sobre las secuencias, con compuertas XOR, AND y OR ---------- */

  const SIMBOLO = { xor: '×', and: '+', or: 'o' };
  const NOMBRE = { xor: 'XOR (exclusiva)', and: 'AND (paralela)', or: 'OR (inclusiva)' };

  // m: { nodos: [{ id, tipo, etiqueta, c, k, par }], aristas: [[de, a, curva?]] }.
  // c es la capa (posición en el flujo) y k el carril (0 a 1). Las ramas de un OR se escriben en el mismo orden
  // en la divergencia y en la convergencia (par: id de la divergencia que le corresponde).
  function preparar(m) {
    const idx = new Map(m.nodos.map((n, i) => [n.id, i]));
    m.idx = idx;
    m.ent = m.nodos.map(() => []);
    m.sal = m.nodos.map(() => []);
    m.aristas.forEach(([a, b], e) => { m.sal[idx.get(a)].push(e); m.ent[idx.get(b)].push(e); });
    m.convergeDe = {};
    m.nodos.forEach((n, i) => { if (n.par) m.convergeDe[n.par] = i; });
    m.inicio = m.nodos.findIndex((n) => n.tipo === 'inicio');
    return m;
  }
  const esDiv = (m, i) => ['xor', 'and', 'or'].includes(m.nodos[i].tipo) && m.sal[i].length > 1;

  function estadoInicial(m) {
    const tok = m.aristas.map(() => 0);
    tok[m.sal[m.inicio][0]] = 1;
    return { tok, orAct: {}, traza: [], terminado: false };
  }
  const copiar = (s) => ({ tok: s.tok.slice(), orAct: { ...s.orAct }, traza: s.traza.slice(), terminado: s.terminado });

  // Todos los pasos posibles. `clic` es el nodo sobre el que se hace clic para darlo.
  function movimientos(m, s) {
    const res = [];
    m.nodos.forEach((n, i) => {
      const ent = m.ent[i], sal = m.sal[i];
      if (n.tipo === 'inicio') return;
      if (n.tipo === 'act' || n.tipo === 'fin') {
        if (s.tok[ent[0]] > 0) res.push({ n: i, clase: n.tipo, clic: i });
      } else if (esDiv(m, i)) {
        if (s.tok[ent[0]] <= 0) return;
        if (n.tipo === 'xor') sal.forEach((e) => res.push({ n: i, clase: 'xor', e, clic: m.idx.get(m.aristas[e][1]) }));
        else if (n.tipo === 'and') res.push({ n: i, clase: 'ands', clic: i });
        else res.push({ n: i, clase: 'ors', clic: i });
      } else if (ent.length > 1) {
        if (n.tipo === 'xor') ent.forEach((e) => { if (s.tok[e] > 0) res.push({ n: i, clase: 'xorj', e, clic: i }); });
        else if (n.tipo === 'and') { if (ent.every((e) => s.tok[e] > 0)) res.push({ n: i, clase: 'andj', clic: i }); }
        else { const ra = s.orAct[n.id]; if (ra && ra.every((r) => s.tok[ent[r]] > 0)) res.push({ n: i, clase: 'orj', clic: i }); }
      }
    });
    return res;
  }

  // Aplica un paso; para 'ors' se pasa el subconjunto de ramas (índices en las salidas).
  function aplicar(m, s, mov, subconjunto) {
    const t = copiar(s), i = mov.n, ent = m.ent[i], sal = m.sal[i], n = m.nodos[i];
    switch (mov.clase) {
      case 'act': t.tok[ent[0]]--; t.tok[sal[0]]++; t.traza.push(n.etiqueta); break;
      case 'fin': t.tok[ent[0]]--; t.terminado = true; break;
      case 'xor': t.tok[ent[0]]--; t.tok[mov.e]++; break;
      case 'xorj': t.tok[mov.e]--; t.tok[sal[0]]++; break;
      case 'ands': t.tok[ent[0]]--; sal.forEach((e) => t.tok[e]++); break;
      case 'andj': ent.forEach((e) => t.tok[e]--); t.tok[sal[0]]++; break;
      case 'ors': {
        t.tok[ent[0]]--;
        subconjunto.forEach((r) => t.tok[sal[r]]++);
        t.orAct[m.nodos[m.convergeDe[n.id]].id] = subconjunto.slice();
        break;
      }
      case 'orj': t.orAct[n.id].forEach((r) => t.tok[ent[r]]--); delete t.orAct[n.id]; t.tok[sal[0]]++; break;
    }
    return t;
  }

  const subconjuntos = (k) => { const r = []; for (let b = 1; b < (1 << k); b++) r.push([...Array(k).keys()].filter((j) => b & (1 << j))); return r; };

  // Trazas completas con a lo sumo `maxAct` actividades. Los pasos sin etiqueta (compuertas de convergencia, AND) se
  // ejecutan enseguida: no cambian la traza y así no se cuentan órdenes equivalentes.
  function enumerar(m, maxAct) {
    const res = new Set();
    let visitas = 0, truncado = false;
    const silencioso = (mv) => ['ands', 'andj', 'xorj', 'orj', 'fin'].includes(mv.clase);
    function rec(s) {
      if (++visitas > 80000) { truncado = true; return; }
      for (let guardia = 0; guardia < 200; guardia++) {
        const mv = movimientos(m, s).find(silencioso);
        if (!mv) break;
        s = aplicar(m, s, mv);
      }
      if (s.terminado) { if (s.tok.every((v) => v === 0)) res.add(s.traza.join('')); return; }
      for (const mv of movimientos(m, s)) {
        if (mv.clase === 'act' && s.traza.length >= maxAct) { truncado = true; continue; }
        if (mv.clase === 'ors') subconjuntos(m.sal[mv.n].length).forEach((sub) => rec(aplicar(m, s, mv, sub)));
        else rec(aplicar(m, s, mv));
      }
    }
    rec(estadoInicial(m));
    return { trazas: [...res].sort((a, b) => a.length - b.length || a.localeCompare(b)), truncado };
  }

  /* ---------- Dibujo ---------- */

  const UMBRAL = 820;
  function posiciones(m, ancho) {
    const maxC = Math.max(...m.nodos.map((n) => n.c));
    const pos = {};
    m.nodos.forEach((n) => {
      const a = maxC ? n.c / maxC : 0.5;
      pos[n.id] = ancho < UMBRAL ? { x: n.k, y: a } : { x: a, y: n.k };
    });
    return { pos, maxC };
  }
  const altoPara = (m, ancho) => (ancho < UMBRAL ? (Math.max(...m.nodos.map((n) => n.c)) + 1) * 50 + 56 : 300);

  // Centro de una secuencia dibujada (para colocar la ficha), igual que lo calcula P.dibujarGrafo.
  function centro(geo, l) {
    const A = geo.nodos.get(l.e.de), B = geo.nodos.get(l.e.a);
    if (l.e.curva || B.x < A.x - 1) {
      const off = (l.e.curva || 26) * (B.x < A.x - 1 ? -1 : 1);
      const dx = B.x - A.x, dy = B.y - A.y, k = Math.hypot(dx, dy) || 1;
      const cx = (A.x + B.x) / 2 - dy / k * off, cy = (A.y + B.y) / 2 + dx / k * off;
      return [(l.p1[0] + 2 * cx + l.p2[0]) / 4, (l.p1[1] + 2 * cy + l.p2[1]) / 4];
    }
    return [(l.p1[0] + l.p2[0]) / 2, (l.p1[1] + l.p2[1]) / 2];
  }

  // Dibuja el modelo con las fichas de `s`; `anillos`: Map(nodo → color del anillo).
  function dibujarModelo(lienzo, m, s, anillos) {
    const { pos } = posiciones(m, lienzo.ancho);
    const nodos = m.nodos.map((n, i) => {
      const o = { id: n.id, anillo: anillos && anillos.get(i) };
      if (n.tipo === 'inicio') return { ...o, tipo: 'inicio', borde: C.s6 };
      if (n.tipo === 'fin') return { ...o, tipo: 'fin' };
      if (n.tipo === 'act') return { ...o, tipo: 'act', etiqueta: n.etiqueta };
      return { ...o, tipo: 'rombo', etiqueta: SIMBOLO[n.tipo] };
    });
    const aristas = m.aristas.map(([de, a, curva], e) => ({ de, a, curva, ancho: s && s.tok[e] > 0 ? 2.5 : 1.5, color: s && s.tok[e] > 0 ? C.tinta : C.eje }));
    lienzo.limpiar();
    const geo = P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 10, margenX: 40, margenY: 30 });
    if (s) {
      const { ctx } = lienzo;
      geo.lineas.forEach((l, e) => {
        if (s.tok[e] <= 0) return;
        const [x, y] = centro(geo, l);
        ctx.fillStyle = C.s2; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI); ctx.stroke(); ctx.fill();
        if (s.tok[e] > 1) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(9, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(s.tok[e]), x, y + 0.5); }
      });
    }
    return geo;
  }

  /* ---------- Modelos de la figura 1 ---------- */

  const N = (id, tipo, c, k, etiqueta, par) => ({ id, tipo, c, k, etiqueta, par });
  const MODELOS = {
    pedido: {
      nombre: 'Pedido: XOR y AND',
      nodos: [N('s', 'inicio', 0, 0.5), N('reg', 'act', 1, 0.5, 'Registrar'), N('x1', 'xor', 2, 0.5), N('tar', 'act', 3, 0.25, 'Tarjeta'), N('tra', 'act', 3, 0.75, 'Transfer.'),
        N('x2', 'xor', 4, 0.5), N('a1', 'and', 5, 0.5), N('emp', 'act', 6, 0.25, 'Empacar'), N('fac', 'act', 6, 0.75, 'Facturar'), N('a2', 'and', 7, 0.5), N('env', 'act', 8, 0.5, 'Enviar'), N('e', 'fin', 9, 0.5)],
      aristas: [['s', 'reg'], ['reg', 'x1'], ['x1', 'tar'], ['x1', 'tra'], ['tar', 'x2'], ['tra', 'x2'], ['x2', 'a1'], ['a1', 'emp'], ['a1', 'fac'], ['emp', 'a2'], ['fac', 'a2'], ['a2', 'env'], ['env', 'e']],
    },
    or: {
      nombre: 'Verificaciones: OR',
      nodos: [N('s', 'inicio', 0, 0.5), N('rec', 'act', 1, 0.5, 'Recibir'), N('o1', 'or', 2, 0.5), N('v1', 'act', 3, 0.1, 'Identidad'), N('v2', 'act', 3, 0.5, 'Ingresos'), N('v3', 'act', 3, 0.9, 'Historial'),
        N('o2', 'or', 4, 0.5, null, 'o1'), N('dec', 'act', 5, 0.5, 'Decidir'), N('e', 'fin', 6, 0.5)],
      aristas: [['s', 'rec'], ['rec', 'o1'], ['o1', 'v1'], ['v1', 'o2'], ['o1', 'v2'], ['v2', 'o2'], ['o1', 'v3'], ['v3', 'o2'], ['o2', 'dec'], ['dec', 'e']],
    },
    ciclo: {
      nombre: 'Redacción: ciclo',
      nodos: [N('s', 'inicio', 0, 0.2), N('red', 'act', 1, 0.2, 'Redactar'), N('xj', 'xor', 2, 0.2), N('rev', 'act', 3, 0.2, 'Revisar'), N('xs', 'xor', 4, 0.2), N('pub', 'act', 5, 0.2, 'Publicar'),
        N('cor', 'act', 5, 0.85, 'Corregir'), N('e', 'fin', 6, 0.2)],
      aristas: [['s', 'red'], ['red', 'xj'], ['xj', 'rev'], ['rev', 'xs'], ['xs', 'pub'], ['xs', 'cor'], ['cor', 'xj', 40], ['pub', 'e']],
    },
  };
  Object.values(MODELOS).forEach(preparar);

  /* ---------- Fig. 1: juego de fichas BPMN ---------- */

  function montarJuego(cuerpo) {
    let clave = 'pedido', m = MODELOS[clave], s = estadoInicial(m), orSel = new Set(), mensaje = '';
    let historial = new Map(), pasos = 0, casos = 0, alto = 300, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: Object.entries(MODELOS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; m = MODELOS[v]; historial = new Map(); casos = 0; reiniciar(); } });
    ctl.boton('Un paso al azar', () => { if (!movimientos(m, s).length) return reiniciar(); pasoAzar(); dibujar(); }, { primario: true });
    ctl.boton('Terminar el caso al azar', () => { if (s.terminado) reiniciar(); for (let k = 0; k < 200 && !s.terminado && movimientos(m, s).length; k++) pasoAzar(); dibujar(); });
    ctl.boton('Nuevo caso', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'ficha (caso en curso)', forma: 'punto' },
      { color: C.s4, texto: 'paso posible: haga clic', forma: 'cuadro' },
      { color: C.s6, texto: 'rama del OR elegida', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo con anillo amarillo para darlo. En una compuerta × elija la rama haciendo clic en la actividad siguiente; en una compuerta o marque las ramas deseadas y luego haga clic en la compuerta. Los rombos: × exclusiva, + paralela, o inclusiva.');

    function reiniciar() { s = estadoInicial(m); orSel = new Set(); pasos = 0; mensaje = 'Una ficha espera en el evento de inicio. Dé el primer paso.'; dibujar(); }
    function pasoAzar() {
      const movs = movimientos(m, s);
      const mv = movs[Math.floor(Math.random() * movs.length)];
      let sub;
      if (mv.clase === 'ors') { const todos = subconjuntos(m.sal[mv.n].length); sub = todos[Math.floor(Math.random() * todos.length)]; }
      dar(mv, sub);
    }
    function dar(mv, sub) {
      const antes = s.traza.length;
      s = aplicar(m, s, mv, sub);
      orSel = new Set();
      pasos++;
      const n = m.nodos[mv.n];
      if (s.traza.length > antes) mensaje = `Se ejecuta «${n.etiqueta}».`;
      else if (mv.clase === 'fin') mensaje = 'El caso llegó al evento de fin.';
      else if (mv.clase === 'xor') mensaje = `La compuerta × deja pasar la ficha solo por «${m.nodos[m.idx.get(m.aristas[mv.e][1])].etiqueta || SIMBOLO[m.nodos[m.idx.get(m.aristas[mv.e][1])].tipo]}».`;
      else if (mv.clase === 'ands') mensaje = 'La compuerta + copia la ficha en todas las ramas: se ejecutan en paralelo.';
      else if (mv.clase === 'andj') mensaje = 'La compuerta + esperó una ficha por rama y emite una sola.';
      else if (mv.clase === 'xorj') mensaje = 'La compuerta × deja pasar la primera ficha que llega.';
      else if (mv.clase === 'ors') mensaje = `La compuerta o activa ${sub.length} de ${m.sal[mv.n].length} ramas.`;
      else if (mv.clase === 'orj') mensaje = 'La compuerta o esperó solo a las ramas que se activaron.';
      if (s.terminado) {
        const k = s.traza.join(' → ');
        historial.set(k, (historial.get(k) || 0) + 1); casos++;
        mensaje += ' Caso terminado: ' + (s.tok.every((v) => v === 0) ? 'sin fichas sobrantes.' : 'quedan fichas sobrantes.');
      }
    }

    function dibujar() {
      const nuevo = altoPara(m, lienzo.ancho);
      if (nuevo !== alto) { alto = nuevo; lienzo.ajustar(true); return; }
      const movs = movimientos(m, s);
      const anillos = new Map();
      movs.forEach((mv) => { anillos.set(mv.clic, C.s4); if (mv.clase === 'xor' || mv.clase === 'ors') anillos.set(mv.n, C.s4); });
      orSel.forEach((i) => anillos.set(m.idx.get(m.aristas[m.sal[movs.find((v) => v.clase === 'ors').n][i]][1]), C.s6));
      geo = dibujarModelo(lienzo, m, s, anillos);
      const filas = [...historial.entries()].sort((a, b) => b[1] - a[1]);
      lista.replaceChildren(...(filas.length ? filas.map(([k, v]) => VIZ.el('div', null, `${v} × ${k}`)) : [VIZ.el('div', null, 'Las trazas de los casos terminados aparecerán aquí.')]));
      registro.textContent = mensaje;
      const posibles = enumerar(m, 8);
      lectura.set([
        ['traza del caso', s.traza.join(' → ') || '—'],
        ['fichas en el diagrama', String(s.tok.reduce((a, b) => a + b, 0))],
        ['pasos dados', String(pasos)],
        ['casos / trazas distintas', `${casos} / ${historial.size}`],
        [posibles.truncado ? 'trazas posibles (≤ 8 act.)' : 'trazas posibles', String(posibles.trazas.length)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo && P.nodoEn(geo, x, y);
      if (!g) return;
      const i = m.idx.get(g.id);
      const movs = movimientos(m, s);
      const o = movs.find((v) => v.clase === 'ors' && v.n === i);
      const div = movs.find((v) => v.clase === 'ors');
      if (div && !o) {
        const r = m.sal[div.n].findIndex((e) => m.idx.get(m.aristas[e][1]) === i);
        if (r >= 0) { orSel.has(r) ? orSel.delete(r) : orSel.add(r); mensaje = `Ramas marcadas en la compuerta o: ${orSel.size}. Haga clic en la compuerta para activarlas.`; dibujar(); return; }
      }
      if (o) {
        if (!orSel.size) { mensaje = 'Marque primero al menos una rama del OR haciendo clic en su primera actividad.'; dibujar(); return; }
        dar(o, [...orSel].sort()); dibujar(); return;
      }
      const mv = movs.find((v) => v.clic === i);
      if (mv) { dar(mv); dibujar(); }
    });
    reiniciar();
  }

  /* ---------- Fig. 2: trazas permitidas ---------- */

  function fragmento(tipo, ramas, ciclo) {
    const letras = ['B', 'C', 'D'].slice(0, ramas);
    const nodos = [N('s', 'inicio', 0, 0.5), N('A', 'act', 1, 0.5, 'A')];
    const aristas = [['s', 'A']];
    let c = 2, previo = 'A';
    if (ciclo) { nodos.push(N('xj', 'xor', c++, 0.5)); aristas.push([previo, 'xj']); previo = 'xj'; }
    nodos.push(N('g1', tipo, c++, 0.5));
    aristas.push([previo, 'g1']);
    const ks = ramas === 2 ? [0.25, 0.75] : [0.1, 0.5, 0.9];
    letras.forEach((l, i) => nodos.push(N(l, 'act', c, ks[i], l)));
    nodos.push(N('g2', tipo, c + 1, 0.5, null, tipo === 'or' ? 'g1' : undefined));
    letras.forEach((l) => { aristas.push(['g1', l]); aristas.push([l, 'g2']); });
    c += 2; previo = 'g2';
    if (ciclo) { nodos.push(N('xs', 'xor', c++, 0.5)); aristas.push([previo, 'xs']); previo = 'xs'; }
    nodos.push(N('E', 'act', c++, 0.5, 'E'), N('e', 'fin', c, 0.5));
    aristas.push([previo, 'E'], ['E', 'e']);
    if (ciclo) aristas.push(['xs', 'xj', 90]);
    return preparar({ nodos, aristas });
  }

  // ¿La traza pertenece al conjunto? Se comprueba ejecutando el propio modelo.
  function montarTrazas(cuerpo) {
    let tipo = 'xor', ramas = 2, ciclo = false, maxAct = 7, entrada = '', alto = 300, res = null, m = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Compuerta', opciones: [['xor', 'XOR (×)'], ['and', 'AND (+)'], ['or', 'OR (o)']], valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ramas', min: 2, max: 3, valor: ramas, alCambiar: (v) => { ramas = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Máx. actividades por traza', min: 4, max: 11, valor: maxAct, alCambiar: (v) => { maxAct = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Repetir el bloque (ciclo)', valor: ciclo, alCambiar: (v) => { ciclo = v; dibujar(); } });
    ctl.texto({ etiqueta: 'Compruebe una traza (p. ej. ACBE)', valor: entrada, alCambiar: (v) => { entrada = v.trim().toUpperCase(); dibujar(); }, alEnter: (v) => { entrada = v.trim().toUpperCase(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    cuerpo.dataset.sinLeyenda = 'diagrama de un solo color; cada actividad lleva su letra';
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie la compuerta y vea cómo cambia el conjunto de trazas: × elige una rama, + las ejecuta todas en cualquier orden, o elige un subconjunto no vacío. Con el ciclo, el límite de actividades acota la lista. Escriba una traza para saber si el modelo la permite.');

    function dibujar() {
      m = fragmento(tipo, ramas, ciclo);
      const nuevo = altoPara(m, lienzo.ancho);
      if (nuevo !== alto) { alto = nuevo; lienzo.ajustar(true); return; }
      res = enumerar(m, maxAct);
      dibujarModelo(lienzo, m, null, null);
      const TOPE = 24;
      lista.replaceChildren(...res.trazas.slice(0, TOPE).map((t) => VIZ.el('div', { class: entrada && t === entrada ? 'activa' : null }, t.split('').join(' → '))),
        ...(res.trazas.length > TOPE ? [VIZ.el('div', null, `… y ${res.trazas.length - TOPE} más`)] : []));
      let veredicto = 'Escriba una traza para comprobarla.';
      if (entrada) {
        if (res.trazas.includes(entrada)) veredicto = `La traza ${entrada} es permitida por el modelo.`;
        else if (ciclo && entrada.length > maxAct) veredicto = `La traza ${entrada} supera el límite de ${maxAct} actividades: súbalo para saber si el modelo la permite.`;
        else veredicto = `La traza ${entrada} NO es permitida por el modelo ${NOMBRE[tipo]}${ciclo ? ' con ciclo' : ''}.`;
      }
      registro.textContent = veredicto;
      lectura.set([
        ['compuerta', NOMBRE[tipo]],
        [ciclo ? `trazas con ≤ ${maxAct} actividades` : 'trazas permitidas', String(res.trazas.length)],
        ['longitud mínima / máxima', res.trazas.length ? `${Math.min(...res.trazas.map((t) => t.length))} / ${Math.max(...res.trazas.map((t) => t.length))}` : '—'],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    dibujar();
  }

  VIZ.registrarTema('bpmn-gateways', {
    intro: String.raw`
      <p><strong>BPMN</strong> (<em>Business Process Model and Notation</em>) es el lenguaje gráfico más usado para dibujar procesos de negocio.
      Un diagrama tiene <em>eventos</em> de inicio y de fin, <em>actividades</em> (rectángulos redondeados) y <em>secuencias</em> (flechas), y lo que le da
      poder expresivo son las <strong>compuertas</strong> (rombos), que deciden cuántas ramas se siguen.</p>
      <p>Una compuerta <strong>XOR</strong> elige exactamente un camino, una <strong>AND</strong> los recorre todos a la vez y una <strong>OR</strong> elige
      un subconjunto no vacío. El comportamiento de un diagrama se entiende moviendo una ficha por él, y el conjunto de ejecuciones posibles es
      justamente lo que la minería de procesos intenta recuperar a partir de un registro de eventos.</p>`,
    visualizaciones: [
      {
        titulo: 'Recorrido de un caso por el diagrama',
        descripcion: 'Mueva fichas por un diagrama BPMN y vea cada compuerta en acción. Pruebe el modelo de verificaciones: la compuerta o de cierre espera solo a las ramas que se activaron.',
        montar: montarJuego,
      },
      {
        titulo: 'Qué trazas permite cada compuerta',
        descripcion: 'Cambie XOR, AND y OR sobre el mismo fragmento y compare la lista de trazas. Active el ciclo y suba el límite de actividades para ver cómo crece el lenguaje.',
        montar: montarTrazas,
      },
    ],
    teoria: String.raw`
      <h2>Elementos de BPMN</h2>
      <ul>
        <li><strong>Eventos</strong>: círculo fino (inicio) y círculo grueso o doble (fin). Marcan dónde nace y dónde termina un caso.</li>
        <li><strong>Actividades</strong>: unidades de trabajo. En un registro de eventos, cada una produce eventos con su nombre.</li>
        <li><strong>Secuencias</strong>: flechas que transportan fichas. El estado de una instancia es la distribución de fichas sobre las secuencias.</li>
        <li><strong>Compuertas</strong> (<em>gateways</em>): rombos que dividen (<em>split</em>, divergencia) o unen (<em>join</em>, convergencia) el flujo.</li>
      </ul>
      <h2>Semántica de las compuertas</h2>
      <table>
        <tr><th>Compuerta</th><th>Divergencia</th><th>Convergencia</th></tr>
        <tr><td>XOR (×)</td><td>envía la ficha por <em>una</em> rama</td><td>deja pasar la primera ficha que llega</td></tr>
        <tr><td>AND (+)</td><td>copia la ficha en <em>todas</em> las ramas</td><td>espera una ficha en <em>cada</em> entrada</td></tr>
        <tr><td>OR (o)</td><td>activa un subconjunto no vacío de ramas</td><td>espera a las ramas que quedaron activas</td></tr>
      </table>
      <p>Con \(k\) ramas, un XOR admite \(k\) elecciones, un AND una sola (con \(k!\) órdenes de ejecución de las ramas de una actividad cada una)
      y un OR \(2^k - 1\) subconjuntos. Un ciclo se escribe con una compuerta XOR de convergencia antes del trabajo y una de divergencia después.</p>
      <div class="recuadro"><p><strong>Errores típicos.</strong> Abrir con XOR y cerrar con AND deja la ficha esperando para siempre (<em>deadlock</em>);
      abrir con AND y cerrar con XOR deja fichas sobrantes y el fin se alcanza más de una vez. Ambos casos se estudian en
      <a href="tema.html?id=soundness">Soundness</a>.</p></div>
      <h2>Trazas permitidas por un modelo</h2>
      <p>Una <em>traza</em> es la sucesión de actividades de un caso. El modelo define un lenguaje \(L \subseteq A^{*}\): las trazas que se obtienen al
      ejecutar el diagrama de la ficha inicial a la ficha en el fin sin fichas sobrantes. Para el fragmento \(A \to G(B, C) \to E\):</p>
      <table>
        <tr><th>Compuerta</th><th>Lenguaje</th></tr>
        <tr><td>XOR</td><td>\(\{ABE,\ ACE\}\)</td></tr>
        <tr><td>AND</td><td>\(\{ABCE,\ ACBE\}\)</td></tr>
        <tr><td>OR</td><td>\(\{ABE,\ ACE,\ ABCE,\ ACBE\}\)</td></tr>
      </table>
      <p>La inclusiva reúne a las otras dos: \(L_{\text{XOR}} \cup L_{\text{AND}} = L_{\text{OR}}\). Con un ciclo el lenguaje es infinito, por eso
      al enumerar se fija una longitud máxima.</p>
      <h2>Conexiones</h2>
      <p>BPMN es la notación para humanos; para analizar un modelo con algoritmos se traduce a una <a href="tema.html?id=petri-nets">red de Petri</a>
      (XOR: una plaza con varias transiciones de salida; AND: una transición con varias plazas de salida) o a un
      <a href="tema.html?id=process-trees">árbol de procesos</a> cuando el diagrama está bien estructurado. Lo que el diagrama permite se
      contrasta con los datos en <a href="tema.html?id=token-based-replay">token-based replay</a>, y el lado empírico (qué ocurrió) está en el
      <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>.</p>`,
  });
})();
