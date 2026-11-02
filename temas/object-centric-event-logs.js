(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Un registro centrado en objetos pequeño y escrito a mano ---------- */

  // Tipos de objeto en orden fijo: cada uno con su color de serie y su forma.
  const TIPOS = [['pedido', C.s1, 0], ['ítem', C.s2, 1], ['factura', C.s3, 3]];
  const COLOR = Object.fromEntries(TIPOS.map(([t, c]) => [t, c]));
  const FORMA = Object.fromEntries(TIPOS.map(([t, , f]) => [t, f]));
  const OBJETOS = [['o1', 'pedido'], ['o2', 'pedido'], ['o3', 'pedido'], ['i1', 'ítem'], ['i2', 'ítem'], ['i3', 'ítem'], ['i4', 'ítem'], ['i5', 'ítem'], ['i6', 'ítem'], ['v1', 'factura'], ['v2', 'factura']];
  const TIPO_DE = Object.fromEntries(OBJETOS);
  // Evento: [actividad, objetos que toca]. El número de evento es su posición (1 a 16), que coincide con su instante.
  const EVENTOS = [
    ['Crear pedido', ['o1', 'i1', 'i2']], ['Crear pedido', ['o2', 'i3', 'i4', 'i5']], ['Crear pedido', ['o3', 'i6']],
    ['Recoger ítem', ['o1', 'i1']], ['Recoger ítem', ['o1', 'i2']], ['Recoger ítem', ['o2', 'i3']], ['Recoger ítem', ['o2', 'i4']], ['Recoger ítem', ['o2', 'i5']], ['Recoger ítem', ['o3', 'i6']],
    ['Emitir factura', ['o1', 'v1']], ['Enviar paquete', ['o1', 'i1', 'i2']], ['Enviar paquete', ['o2', 'i3', 'i4']], ['Enviar paquete', ['o2', 'o3', 'i5', 'i6']],
    ['Emitir factura', ['o2', 'o3', 'v2']], ['Registrar pago', ['v1']], ['Registrar pago', ['v2']],
  ].map(([act, objs], i) => ({ n: i + 1, act, objs }));
  const ACTS = [...new Set(EVENTOS.map((e) => e.act))];
  const porTipo = (e, t) => e.objs.filter((o) => TIPO_DE[o] === t);
  const cuenta = (e) => TIPOS.map(([t]) => [t, porTipo(e, t).length]).filter(([, k]) => k).map(([t, k]) => `${k} ${t}${k > 1 ? 's' : ''}`).join(', ');
  const trazaObjeto = (o) => EVENTOS.filter((e) => e.objs.includes(o));

  // Aplanado: un caso por cada objeto del tipo elegido; sus eventos van en orden de tiempo.
  function aplanar(tipo) {
    const casos = OBJETOS.filter(([, t]) => t === tipo).map(([o]) => ({ id: o, eventos: trazaObjeto(o).map((e) => ({ act: e.act, ev: e.n })) })).filter((c) => c.eventos.length);
    return casos;
  }

  /* ---------- Fig. 1: un evento, varios objetos ---------- */

  const nombresDeTipo = (t) => (t === 'ítem' ? 'ítems' : t + 's');

  function montarLinea(cuerpo) {
    let visibles = Object.fromEntries(TIPOS.map(([t]) => [t, true])), selEv = 13, selObj = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(TIPOS.map(([t, c]) => ({ clave: t, texto: nombresDeTipo(t), color: c, activo: true })), (e) => { visibles = e; lienzo.ajustar(true); });
    const lanes = () => OBJETOS.filter(([, t]) => visibles[t]);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 52 + Math.max(1, lanes().length) * 24 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, TIPOS.map(([t, c, f]) => ({ color: c, texto: `objeto de tipo ${t}`, forma: f === 0 ? 'punto' : 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada columna es un evento (numerado por su instante) y cada fila un objeto; los puntos de una misma columna son los objetos que ese evento toca. Haga clic en una columna para ver sus objetos, o en el nombre de un objeto (a la izquierda) para ver su vida. Oculte tipos para ver qué ve cada «punto de vista».');

    const L = 40, T = 34, FILA = 24;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ls = lanes(), cw = (lienzo.ancho - L - 8) / EVENTOS.length;
      const fy = (o) => T + ls.findIndex(([id]) => id === o) * FILA + FILA / 2;
      const fx = (n) => L + (n - 0.5) * cw;
      geo = { cw, ls, fy };
      ls.forEach(([o, t], i) => {
        const y = T + i * FILA;
        if (o === selObj) { ctx.fillStyle = VIZ.alfa(COLOR[t], 0.12); ctx.fillRect(0, y, lienzo.ancho, FILA); }
        else if (i % 2) { ctx.fillStyle = C.fondo2; ctx.fillRect(0, y, lienzo.ancho, FILA); }
        ctx.fillStyle = o === selObj ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(11, o === selObj ? 700 : 500); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(o, 8, y + FILA / 2);
      });
      if (selEv) { ctx.fillStyle = C.neutro; ctx.fillRect(fx(selEv) - cw / 2, T - 6, cw, ls.length * FILA + 6); }
      ctx.font = VIZ.fuente(9); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (const e of EVENTOS) { ctx.fillStyle = e.n === selEv ? C.tinta : C.apagado; ctx.fillText(String(e.n), fx(e.n), T - 8); }
      for (const e of EVENTOS) {
        const rows = e.objs.filter((o) => visibles[TIPO_DE[o]]);
        if (!rows.length) continue;
        const ys = rows.map(fy);
        const activo = (!selObj || e.objs.includes(selObj)) && (!selEv || e.n === selEv || selObj);
        ctx.strokeStyle = e.n === selEv ? C.tinta : activo ? C.tinta2 : C.tenue; ctx.lineWidth = e.n === selEv ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(fx(e.n), Math.min(...ys)); ctx.lineTo(fx(e.n), Math.max(...ys)); ctx.stroke();
        for (const o of rows) {
          const t = TIPO_DE[o], dim = selObj && o !== selObj && !e.objs.includes(selObj);
          VIZ.marcador(ctx, fx(e.n), fy(o), dim ? VIZ.alfa(COLOR[t], 0.35) : COLOR[t], o === selObj || e.n === selEv ? 5.5 : 4, FORMA[t]);
        }
      }
      // Resumen.
      const e2o = EVENTOS.reduce((s, e) => s + e.objs.length, 0);
      if (selObj) {
        const tr = trazaObjeto(selObj);
        registro.textContent = `Objeto ${selObj} (${TIPO_DE[selObj]}): participa en ${tr.length} eventos → ${tr.map((e) => `${e.n}·${e.act}`).join(' › ')}. Cada objeto tiene su propia traza; los eventos compartidos las entrelazan.`;
      } else if (selEv) {
        const e = EVENTOS[selEv - 1];
        registro.textContent = `Evento ${e.n}, «${e.act}», toca ${e.objs.length} objetos (${cuenta(e)}): ${e.objs.join(', ')}. Un único evento aparece en las trazas de todos ellos.`;
      } else registro.textContent = 'Haga clic en una columna o en el nombre de un objeto.';
      lectura.set([
        ['eventos', String(EVENTOS.length)], ['objetos', `${OBJETOS.length} en ${TIPOS.length} tipos`], ['vínculos evento–objeto', String(e2o)],
        ['objetos por evento (promedio)', VIZ.fmt(e2o / EVENTOS.length, 3)], ['eventos con 2 o más tipos', String(EVENTOS.filter((e) => new Set(e.objs.map((o) => TIPO_DE[o])).size > 1).length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const colEn = (x) => { const n = Math.floor((x - L) / geo.cw) + 1; return n >= 1 && n <= EVENTOS.length ? n : 0; };
    const filaEn = (y) => { const i = Math.floor((y - T) / FILA); return i >= 0 && i < geo.ls.length ? geo.ls[i][0] : null; };
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (x < L) { const o = filaEn(y); selObj = o && o !== selObj ? o : null; if (selObj) selEv = 0; }
      else { const n = colEn(x); selEv = n && n !== selEv ? n : 0; if (selEv) selObj = null; }
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = x >= L ? colEn(x) : 0;
      if (!n) return tip.ocultar();
      const e = EVENTOS[n - 1];
      tip.mostrar(x, y, `<b>evento ${e.n}</b>: ${e.act}<br>${e.objs.length} objetos: ${e.objs.join(', ')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Dibujo de grafos por capas (vertical en pantallas angostas) ---------- */

  // Devuelve posiciones (transpuestas en pantallas angostas) y la capa de cada nodo, para curvar las aristas que saltan capas.
  function posiciones(nodos, aristas, ancho) {
    const pos = P.disponer(nodos, aristas), v = ancho < 640, p = {}, capa = {};
    const xs = [...new Set(nodos.map((id) => pos[id].x.toFixed(4)))].sort();
    for (const id of nodos) { p[id] = v ? { x: pos[id].y, y: pos[id].x } : pos[id]; capa[id] = xs.indexOf(pos[id].x.toFixed(4)); }
    return { p, capa };
  }
  // En pantallas angostas se usan nombres cortos para que dos nodos quepan en una misma capa.
  const ABREV = { 'Crear pedido': 'Crear', 'Recoger ítem': 'Recoger', 'Emitir factura': 'Facturar', 'Enviar paquete': 'Enviar', 'Registrar pago': 'Pago' };
  const nombre = (a, w) => (w < 640 ? ABREV[a] : a);
  const salto = (capa, de, a, base) => (capa[a] - capa[de] > 1 ? base : undefined);
  const altoGrafo = (w) => (w >= 640 ? 360 : 520);

  /* ---------- Fig. 2: aplanar un registro centrado en objetos ---------- */

  function montarAplanar(cuerpo) {
    let tipo = 'pedido', info = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Objeto que hace de «caso»', opciones: TIPOS.map(([t]) => [t, t]), valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoGrafo });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'actividad con más ocurrencias (×n) que eventos reales: convergencia', forma: 'cuadro' },
      { color: C.tinta, texto: 'frecuencia igual a la real', forma: 'cuadro' },
      { color: C.s2, texto: 'repetición dentro de un caso (divergencia)', forma: 'linea' },
      { color: C.eje, texto: 'sucesión directa (etiqueta: casos)', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada tipo se crea un caso por objeto y se copia en él todo evento que lo toque. Compare las cifras con los 16 eventos originales: unos eventos se duplican, otros desaparecen, y actividades que ocurren una sola vez parecen repetirse. Pase el cursor sobre una actividad para ver sus frecuencias.');

    function dibujar() {
      const casos = aplanar(tipo), log = casos.map((c) => ({ id: c.id, eventos: c.eventos }));
      const d = P.dfg(log), vars = P.variantes(log);
      const real = new Map(ACTS.map((a) => [a, EVENTOS.filter((e) => e.act === a).length]));
      const tocan = EVENTOS.filter((e) => porTipo(e, tipo).length);
      const total = casos.reduce((s, c) => s + c.eventos.length, 0);
      const repetidas = new Set();
      for (const c of casos) { const m = new Map(); c.eventos.forEach((e) => m.set(e.act, (m.get(e.act) || 0) + 1)); for (const [a, k] of m) if (k > 1) repetidas.add(a); }
      const nodos = d.acts.map((a) => ({
        id: a, tipo: 'act', etiqueta: `${nombre(a, lienzo.ancho)} ×${d.frec.get(a)}`, relleno: d.frec.get(a) > real.get(a) ? VIZ.alfa(C.s8, 0.12) : C.superficie,
        borde: d.frec.get(a) > real.get(a) ? C.s8 : C.tinta, colorTexto: d.frec.get(a) > real.get(a) ? C.s8 : C.tinta,
      }));
      lienzo.limpiar();
      const { p: pos, capa } = posiciones(d.acts, d.aristas.filter((e) => e.de !== e.a).map((e) => [e.de, e.a]), lienzo.ancho);
      const aristas = d.aristas.map((e) => ({ de: e.de, a: e.a, etiqueta: e.n, ancho: 1.5 + Math.min(3, e.n * 0.6), color: e.de === e.a ? C.s2 : C.eje, colorTexto: e.de === e.a ? C.s2 : C.tinta2, curva: salto(capa, e.de, e.a, 38) }));
      info = P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 10, margenX: 80, margenY: 50 });
      info.real = real; info.d = d;
      lista.replaceChildren(...vars.map((v) => VIZ.el('div', null, `${String(v.n).padStart(2)} × ${v.clave.split('›').join(' › ')}`)));
      registro.textContent = `Con «${tipo}» como caso hay ${casos.length} casos y ${total} eventos, pero el registro original solo tiene ${tocan.length} eventos que toquen ese tipo: ${total - tocan.length} son copias${EVENTOS.length - tocan.length ? `, y ${EVENTOS.length - tocan.length} eventos no aparecen en absoluto` : ''}.`;
      lectura.set([
        ['casos', String(casos.length)], ['eventos aplanados', String(total)], ['eventos originales que lo tocan', `${tocan.length} de ${EVENTOS.length}`],
        ['copias por convergencia', String(total - tocan.length)], ['eventos que desaparecen', String(EVENTOS.length - tocan.length)],
        ['actividades que parecen repetirse', repetidas.size ? [...repetidas].join(', ') : 'ninguna'], ['variantes', String(vars.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = info && P.nodoEn(info, x, y);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `<b>${n.id}</b><br>en el registro original: <b>${info.real.get(n.id)}</b> eventos<br>en el aplanado: <b>${info.d.frec.get(n.id)}</b> ocurrencias`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: grafo de sucesión por tipo de objeto, evento a evento ---------- */

  const CURVA_SALTO = { pedido: 40, 'ítem': 70, factura: -40 };
  const CURVA = { pedido: 0, 'ítem': 30, factura: -30 };

  function montarGrafo(cuerpo) {
    let k = 0, info = null;
    // Posiciones fijas calculadas con todas las aristas, para que los nodos no salten al avanzar.
    const todas = aristasHasta(EVENTOS.length);
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoGrafo });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...TIPOS.map(([t, c]) => ({ color: c, texto: `arista de objetos «${t}»`, forma: 'linea' })), { color: C.s2, texto: 'actividad del evento actual', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada objeto recorre el modelo con su propio color; una actividad compartida (como «Enviar paquete») junta los caminos de varios tipos. Reproduzca los eventos: las aristas gruesas son las que acaba de añadir el evento actual. Pase el cursor sobre una actividad para ver cuántos eventos la ejecutaron.');

    function aristasHasta(hasta, ultimo) {
      const ult = new Map(), m = new Map(), nuevas = new Set();
      for (const e of EVENTOS.slice(0, hasta)) for (const o of e.objs) {
        if (ult.has(o)) { const key = [TIPO_DE[o], ult.get(o), e.act].join('\u0001'); m.set(key, (m.get(key) || 0) + 1); if (e.n === ultimo) nuevas.add(key); }
        ult.set(o, e.act);
      }
      return [...m.entries()].map(([key, n]) => { const [tipo, de, a] = key.split('\u0001'); return { tipo, de, a, n, nueva: nuevas.has(key) }; });
    }
    function iniciar() {
      k = 0;
      return (function* () { while (k < EVENTOS.length) { k++; yield; } })();
    }
    function dibujar() {
      lienzo.limpiar();
      const ev = k ? EVENTOS[k - 1] : null, as = aristasHasta(k, k);
      const vistas = new Set(EVENTOS.slice(0, k).map((e) => e.act));
      const nodos = ACTS.map((a) => ({
        id: a, tipo: 'act', etiqueta: vistas.has(a) ? `${nombre(a, lienzo.ancho)} ×${EVENTOS.slice(0, k).filter((e) => e.act === a).length}` : nombre(a, lienzo.ancho), relleno: ev && ev.act === a ? VIZ.alfa(C.s2, 0.2) : C.superficie,
        borde: ev && ev.act === a ? C.s2 : vistas.has(a) ? C.tinta : C.tenue, colorTexto: vistas.has(a) ? C.tinta : C.apagado,
      }));
      const { p: pos, capa } = posiciones(ACTS, todas.filter((e) => e.de !== e.a).map((e) => [e.de, e.a]), lienzo.ancho);
      const aristas = as.map((e) => ({ de: e.de, a: e.a, etiqueta: e.n, ancho: e.nueva ? 4.5 : 1.8 + Math.min(2, e.n * 0.4), color: COLOR[e.tipo], curva: salto(capa, e.de, e.a, CURVA_SALTO[e.tipo]) || CURVA[e.tipo], colorTexto: C.tinta2 }));
      info = P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 10, margenX: 80, margenY: 50 });
      info.k = k;
      registro.textContent = ev
        ? `Evento ${ev.n}: «${ev.act}» toca ${ev.objs.join(', ')}. ${as.filter((e) => e.nueva).length ? `Añade o refuerza ${as.filter((e) => e.nueva).map((e) => `${e.de} → ${e.a} (${e.tipo})`).join('; ')}.` : 'Es el primer evento de esos objetos: no hay arista que añadir.'}`
        : 'Pulse «Un paso»: el grafo se construye evento a evento, con una arista por cada objeto que pasa de una actividad a otra.';
      const porT = TIPOS.map(([t]) => `${t}: ${as.filter((e) => e.tipo === t).length}`).join(' · ');
      lectura.set([['eventos procesados', `${k} de ${EVENTOS.length}`], ['aristas distintas (por tipo)', porT || '—'], ['objetos que ya aparecieron', String(new Set(EVENTOS.slice(0, k).flatMap((e) => e.objs)).size)], ['aristas en total', String(as.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = info && P.nodoEn(info, x, y);
      if (!n) return tip.ocultar();
      const es = EVENTOS.slice(0, k).filter((e) => e.act === n.id);
      tip.mostrar(x, y, `<b>${n.id}</b><br>${es.length} eventos hasta ahora<br>objetos: ${[...new Set(es.flatMap((e) => e.objs))].join(', ') || '—'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('object-centric-event-logs', {
    intro: String.raw`
      <p>Un registro de eventos clásico supone que cada evento pertenece a un único caso. En una empresa real no es así: una orden de compra contiene varios artículos, se
      factura junto con otras órdenes y se envía en paquetes que mezclan pedidos. Un evento como «Enviar paquete» toca a la vez varios pedidos y varios artículos. Los
      <strong>registros de eventos centrados en objetos</strong> (OCEL, de <em>object-centric event logs</em>) guardan esa verdad: cada evento se relaciona con <em>todos</em> los objetos que involucra, y cada objeto tiene un tipo.</p>
      <p>Si se insiste en la vista clásica hay que elegir un tipo de objeto como «caso» y <em>aplanar</em> el registro. Ahí aparecen dos distorsiones: la <strong>convergencia</strong>, donde un evento se copia en
      varios casos, y la <strong>divergencia</strong>, donde actividades que ocurren una vez por objeto parecen repetirse dentro de un caso. Las figuras muestran ambas sobre el mismo registro de dieciséis eventos.</p>`,
    visualizaciones: [
      {
        titulo: 'Un evento, varios objetos',
        descripcion: 'Cada columna es un evento y cada fila un objeto. Haga clic en el evento 13 («Enviar paquete»): toca dos pedidos y dos ítems. Haga clic en el objeto o2 para ver su vida, y oculte tipos para ver qué quedaría en una vista clásica.',
        montar: montarLinea,
      },
      {
        titulo: 'Aplanar: convergencia y divergencia',
        descripcion: 'Elija qué objeto hace de caso. Con «pedido», «Recoger ítem» parece un bucle aunque nada se repita; con «ítem», «Enviar paquete» y «Crear pedido» se copian y la factura desaparece; con «factura», la mayoría de los eventos no existe.',
        montar: montarAplanar,
      },
      {
        titulo: 'Grafo con un camino por tipo de objeto',
        descripcion: 'Reproduzca los dieciséis eventos y observe cómo cada tipo de objeto traza su propia ruta por las mismas actividades. Fíjese en «Enviar paquete»: es el punto donde se cruzan los pedidos y los ítems.',
        montar: montarGrafo,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un registro centrado en objetos es una tupla \(L=(E,O,\text{tipo},\text{act},\text{tiempo},\text{E2O})\) con eventos \(E\), objetos \(O\), una función
      \(\text{tipo}:O\to T\), una actividad y un instante por evento, y la relación evento–objeto \(\text{E2O}\subseteq E\times O\) (un evento puede tener muchos objetos y un objeto muchos eventos).
      En formatos como OCEL 2.0 se agregan atributos y relaciones objeto–objeto (O2O), como «el ítem \(i_1\) pertenece al pedido \(o_1\)». La traza de un objeto \(o\) es
      \(\sigma_o=\langle e\in E:(e,o)\in\text{E2O}\rangle\) ordenada por tiempo. En el ejemplo hay \(|E|=16\) eventos, \(|O|=11\) objetos de 3 tipos y 38 vínculos evento–objeto: un evento toca en promedio 2.4 objetos.</p>
      <h2>Aplanar sobre un tipo</h2>
      <p>Para el tipo \(\tau\in T\), el registro aplanado tiene un caso por objeto \(o\) con \(\text{tipo}(o)=\tau\), cuya traza es \(\sigma_o\). El número de eventos resultante es</p>
      \[ |E_\tau^{\text{plano}}|=\sum_{e\in E}\bigl|\{o\in\text{objs}(e):\text{tipo}(o)=\tau\}\bigr|. \]
      <p>Tres fenómenos se leen de esa suma. Un evento con \(m\ge 2\) objetos de tipo \(\tau\) se copia \(m\) veces: es la <strong>convergencia</strong>; sus frecuencias, y todo lo que se mida con
      ellas (costos, tiempos, conteos), quedan infladas. Un evento sin objetos de tipo \(\tau\) <em>desaparece</em> del modelo. Y si un caso \(o\) se relaciona con \(m\) objetos de otro tipo \(\tau'\) cuyos eventos
      se ejecutan por separado, la misma actividad aparece \(m\) veces en su traza, en orden arbitrario: es la <strong>divergencia</strong>. El grafo de sucesión directa muestra bucles y órdenes que el proceso real nunca tuvo.</p>
      <div class="recuadro">Con el ejemplo: aplanado por <em>pedido</em>, «Recoger ítem» se ejecuta 3 veces en o2 y el grafo dibuja un bucle; por <em>ítem</em>, el evento 13 aparece 2 veces (una por ítem) y
      «Emitir factura» no existe; por <em>factura</em>, solo 4 de 16 eventos sobreviven.</div>
      <h2>Alternativa centrada en objetos</h2>
      <pre><code>para cada objeto o:
    σ_o ← eventos de o ordenados por tiempo
para cada tipo τ y cada o de tipo τ:
    para cada par consecutivo (a, b) en σ_o:
        arista[τ, a, b] += 1          # un camino por tipo de objeto
dibujar un grafo con una capa de color por tipo</code></pre>
      <p>Así cada evento cuenta una vez, las actividades compartidas son los puntos donde se cruzan los tipos, y ninguna frecuencia se infla. La figura 3 construye exactamente ese grafo.</p>
      <h2>Conexiones</h2>
      <p>El supuesto de un único caso por evento es el de <a href="tema.html?id=event-logs">Event Logs</a> y <a href="tema.html?id=traces-and-variants">Traces and Process Variants</a>;
      las estructuras que se dibujan aquí son extensiones del <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>. La visualización de modelos con varios tipos, con ejemplos
      de educación y salud, se continúa en <a href="tema.html?id=ocpm-applications">Object-Centric Process Visualization</a>, y los modelos formales equivalentes son redes de Petri con
      arcos variables (<a href="tema.html?id=petri-nets">Petri Nets</a>).</p>`,
  });
})();
