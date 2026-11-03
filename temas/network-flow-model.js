(function () {
  'use strict';
  const { color: C } = VIZ;
  const L = VIZ.grafo.LETRAS;
  const num = (v) => VIZ.fmt(v);

  /* ---------- Red de ejemplo (sin arcos antiparalelos) ---------- */

  // [letra, x, y, oferta neta b]  (b > 0 origen, b < 0 destino, b = 0 transbordo)
  const NODOS = [['A', 0.07, 0.5, 6], ['B', 0.36, 0.1, 0], ['C', 0.36, 0.9, 0], ['D', 0.64, 0.5, 0], ['E', 0.93, 0.12, -3], ['F', 0.93, 0.88, -3]];
  // [de, a, capacidad, costo unitario]
  const ARCOS = [[0, 1, 5, 2], [0, 2, 4, 3], [1, 3, 4, 1], [2, 3, 4, 2], [1, 4, 3, 4], [3, 4, 3, 2], [3, 5, 5, 1], [2, 5, 3, 5]];
  const B = NODOS.map((q) => q[3]);
  const nombreArco = (e) => `${NODOS[ARCOS[e][0]][0]}→${NODOS[ARCOS[e][1]][0]}`;

  // Flujo de costo mínimo con oferta b: agrega un origen y un sumidero ficticios. Devuelve { factible, flujo, costo, motivo }.
  function resolver(b, arcos) {
    const n = b.length, S = n, T = n + 1, todos = arcos.map((a) => ({ de: a.de, a: a.a, cap: a.cap, costo: a.costo }));
    let oferta = 0, demanda = 0;
    b.forEach((v, i) => {
      if (v > 0) { todos.push({ de: S, a: i, cap: v, costo: 0 }); oferta += v; }
      else if (v < 0) { todos.push({ de: i, a: T, cap: -v, costo: 0 }); demanda -= v; }
    });
    if (oferta !== demanda) return { factible: false, motivo: `la oferta total (${oferta}) y la demanda total (${demanda}) no coinciden`, oferta, demanda };
    const r = VIZ.opt.flujoCostoMinimo(n + 2, todos, S, T, oferta);
    if (r.enviado < oferta) return { factible: false, motivo: `la capacidad de los arcos solo permite enviar ${r.enviado} de ${oferta} unidades`, oferta, demanda };
    return { factible: true, flujo: r.flujo.slice(0, arcos.length), costo: r.costo, oferta, demanda };
  }
  const ARCOS_OBJ = ARCOS.map(([de, a, cap, costo]) => ({ de, a, cap, costo }));

  function distSeg(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - a.x - t * dx, py - a.y - t * dy);
  }
  function tabla(caja, cabecera, filas) {
    const t = VIZ.el('table', { class: 'tabla-datos sin-corte' },
      VIZ.el('thead', null, VIZ.el('tr', null, cabecera.map((h, i) => VIZ.el('th', { class: i === 0 ? 'izq' : null }, h)))),
      VIZ.el('tbody', null, filas.map((f) => VIZ.el('tr', null, f.map((c, i) => {
        const o = typeof c === 'object' ? c : { t: c };
        return VIZ.el('td', { class: i === 0 ? 'izq' : null, style: o.c ? { color: o.c, fontWeight: '600' } : null }, o.t);
      })))));
    caja.replaceChildren(t);
  }

  /* ---------- Fig. 1: conservación de flujo ---------- */

  function montarConservacion(cuerpo) {
    const flujo = ARCOS.map(() => 0);
    let sel = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const slider = ctl.rango({ etiqueta: 'Flujo del arco elegido', min: 0, max: ARCOS[0][2] + 2, valor: 0, alCambiar: (v) => { flujo[sel] = v; dibujar(); } });
    ctl.boton('Flujo de costo mínimo', () => {
      const r = resolver(B, ARCOS_OBJ);
      r.flujo.forEach((v, e) => { flujo[e] = Math.round(v); });
      slider.valor = flujo[sel];
      dibujar();
    }, { primario: true });
    ctl.boton('Poner en cero', () => { flujo.fill(0); slider.valor = 0; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'nodo con conservación cumplida' }, { color: C.s8, texto: 'nodo que la viola' },
      { color: C.s1, texto: 'arco con flujo', forma: 'linea' }, { color: C.s8, texto: 'arco sobre su capacidad', forma: 'linea' },
      { color: C.s2, texto: 'arco elegido', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un arco para elegirlo y mueva «Flujo del arco elegido». Pase el cursor por un arco para ver su costo y capacidad. Puede pasarse de la capacidad hasta en 2 unidades para ver la violación.');
    const optimo = resolver(B, ARCOS_OBJ);

    function balance() {
      const sale = NODOS.map(() => 0), entra = NODOS.map(() => 0);
      ARCOS.forEach(([de, a], e) => { sale[de] += flujo[e]; entra[a] += flujo[e]; });
      return NODOS.map((_, i) => ({ sale: sale[i], entra: entra[i], neto: sale[i] - entra[i], ok: sale[i] - entra[i] === B[i] }));
    }
    function dibujar() {
      lienzo.limpiar();
      const bal = balance();
      const g = { dirigido: true, nodos: NODOS.map(([l, x, y]) => ({ x, y, etiqueta: l })), aristas: ARCOS.map(([u, v, cap], e) => ({ u, v, w: `${flujo[e]}/${cap}` })) };
      // Halo del arco elegido (se dibuja antes, con las mismas posiciones que usa VIZ.grafo.dibujar).
      const pp = (i) => ({ x: 26 + NODOS[i][1] * (lienzo.ancho - 52), y: 26 + NODOS[i][2] * (lienzo.alto - 64) });
      const { ctx } = lienzo, p = pp(ARCOS[sel][0]), q = pp(ARCOS[sel][1]);
      ctx.save();
      ctx.strokeStyle = VIZ.alfa(C.s2, 0.35);
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.restore();
      geo = VIZ.grafo.dibujar(lienzo, g, {
        pesos: true,
        nodo: (i) => (bal[i].ok ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : { relleno: C.s8, borde: C.s8, texto: C.sobre }),
        arista: (a, e) => (flujo[e] > ARCOS[e][2] ? { color: C.s8, ancho: 3.5 } : flujo[e] > 0 ? { color: C.s1, ancho: 1.5 + (3 * flujo[e]) / ARCOS[e][2] } : { color: C.eje, ancho: 1.5 }),
        colorPeso: (a, e) => (flujo[e] > ARCOS[e][2] ? C.s8 : flujo[e] > 0 ? C.s1 : C.tinta2),
        debajo: (i) => `b=${B[i] > 0 ? '+' : ''}${B[i]}`.replace('-', '−'),
      });
      tabla(caja, ['nodo', 'oferta b', 'sale', 'entra', 'sale − entra', 'conserva'],
        NODOS.map((q2, i) => [q2[0], String(B[i]).replace('-', '−'), bal[i].sale, bal[i].entra, String(bal[i].neto).replace('-', '−'),
          bal[i].ok ? { t: 'sí', c: C.s6 } : { t: 'no', c: C.s8 }]));
      const malos = bal.map((x, i) => (x.ok ? -1 : i)).filter((i) => i >= 0);
      const sobre = ARCOS.filter((a, e) => flujo[e] > a[2]).length;
      const costo = ARCOS.reduce((s, a, e) => s + a[3] * flujo[e], 0);
      registro.textContent = `Arco ${nombreArco(sel)} elegido: flujo ${flujo[sel]} de capacidad ${ARCOS[sel][2]}, costo unitario ${ARCOS[sel][3]}. ` + (malos.length
        ? `Falla la conservación en ${malos.map((i) => NODOS[i][0]).join(', ')}: en ${NODOS[malos[0]][0]} sale − entra = ${bal[malos[0]].neto} y debería ser ${B[malos[0]]}.`
        : 'La conservación se cumple en todos los nodos' + (sobre ? ', pero hay arcos sobre su capacidad.' : ': es un flujo factible.'));
      lectura.set([
        ['nodos que conservan', `${NODOS.length - malos.length} de ${NODOS.length}`],
        ['arcos sobre capacidad', String(sobre)],
        ['costo de su flujo', num(costo)],
        ['costo mínimo posible', num(optimo.costo)],
        ['factible', !malos.length && !sobre ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const arcoEn = (x, y) => {
      if (!geo) return -1;
      let mejor = -1, dm = 10;
      ARCOS.forEach(([u, v], e) => { const d = distSeg(x, y, geo.pos[u], geo.pos[v]); if (d < dm) { dm = d; mejor = e; } });
      return mejor;
    };
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), e = arcoEn(x, y);
      if (e < 0) return;
      sel = e; slider.max = ARCOS[e][2] + 2; slider.valor = flujo[e]; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), e = arcoEn(x, y);
      if (e < 0) return tip.ocultar();
      tip.mostrar(x, y, `arco <b>${nombreArco(e)}</b><br>flujo <b>${flujo[e]}</b> de capacidad <b>${ARCOS[e][2]}</b><br>costo unitario <b>${ARCOS[e][3]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: matriz de incidencia ---------- */

  function montarIncidencia(cuerpo) {
    const flujo = ARCOS.map(() => 0);
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Flujo de costo mínimo', () => { resolver(B, ARCOS_OBJ).flujo.forEach((v, e) => { flujo[e] = Math.round(v); }); dibujar(); }, { primario: true });
    ctl.boton('Poner en cero', () => { flujo.fill(0); dibujar(); });
    cuerpo.dataset.sinLeyenda = 'solo tabla: cada celda lleva su valor escrito';
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el encabezado de un arco (por ejemplo A→B) para sumar una unidad a su flujo; al pasar de la capacidad vuelve a 0. Con Mayús + clic resta una. Cada fila de la derecha es una fila de N·x.');

    function dibujar() {
      const m = NODOS.length;
      const Nx = NODOS.map((_, i) => ARCOS.reduce((s, [de, a], e) => s + (de === i ? 1 : a === i ? -1 : 0) * flujo[e], 0));
      const cab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'nodo'),
        ARCOS.map((_, e) => VIZ.el('th', {
          class: 'celda-clic', title: `capacidad ${ARCOS[e][2]}`,
          onclick: (ev) => { flujo[e] = ev.shiftKey ? Math.max(0, flujo[e] - 1) : flujo[e] >= ARCOS[e][2] ? 0 : flujo[e] + 1; dibujar(); },
        }, nombreArco(e))),
        VIZ.el('th', null, 'N·x'), VIZ.el('th', null, 'b'), VIZ.el('th', null, ''));
      const filas = NODOS.map((q, i) => VIZ.el('tr', null,
        VIZ.el('td', { class: 'izq' }, q[0]),
        ARCOS.map(([de, a]) => VIZ.el('td', null, de === i ? '+1' : a === i ? '−1' : '·')),
        VIZ.el('td', null, String(Nx[i]).replace('-', '−')),
        VIZ.el('td', null, String(B[i]).replace('-', '−')),
        VIZ.el('td', { style: { color: Nx[i] === B[i] ? C.s6 : C.s8, fontWeight: '600' } }, Nx[i] === B[i] ? '=' : '≠')));
      const fx = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'x (flujo)'),
        ARCOS.map((a, e) => VIZ.el('td', { style: flujo[e] > a[2] ? { color: C.s8, fontWeight: '600' } : null }, String(flujo[e]))), VIZ.el('td'), VIZ.el('td'), VIZ.el('td'));
      const fc = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'capacidad'), ARCOS.map((a) => VIZ.el('td', null, String(a[2]))), VIZ.el('td'), VIZ.el('td'), VIZ.el('td'));
      const fk = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'costo c'), ARCOS.map((a) => VIZ.el('td', null, String(a[3]))), VIZ.el('td'), VIZ.el('td'), VIZ.el('td'));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, cab), VIZ.el('tbody', null, filas, fx, fc, fk)));
      const ok = Nx.every((v, i) => v === B[i]);
      const costo = ARCOS.reduce((s, a, e) => s + a[3] * flujo[e], 0);
      const mal = Nx.map((v, i) => (v === B[i] ? -1 : i)).filter((i) => i >= 0);
      registro.textContent = ok ? 'N·x = b: el flujo conserva en todos los nodos.' : `N·x ≠ b en ${mal.map((i) => NODOS[i][0]).join(', ')}; cada fila de N suma +1 por cada arco que sale del nodo y −1 por cada arco que llega.`;
      lectura.set([
        ['nodos', String(m)], ['arcos', String(ARCOS.length)],
        ['suma de N·x', String(Nx.reduce((s, v) => s + v, 0))],
        ['N·x = b', ok ? 'sí' : 'no'], ['costo cᵀx', num(costo)],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 3: construya su red ---------- */

  function montarEditor(cuerpo) {
    const MAXN = 8;
    let nodos, arcos, sel = -1, geo = null, sol = null;
    const ejemplo = () => {
      nodos = [{ x: 0.08, y: 0.5, b: 5 }, { x: 0.36, y: 0.14, b: 0 }, { x: 0.36, y: 0.86, b: 0 }, { x: 0.66, y: 0.5, b: -2 }, { x: 0.93, y: 0.5, b: -3 }];
      arcos = [{ de: 0, a: 1, cap: 4, costo: 1 }, { de: 0, a: 2, cap: 3, costo: 2 }, { de: 1, a: 2, cap: 2, costo: 1 }, { de: 1, a: 3, cap: 3, costo: 3 }, { de: 2, a: 3, cap: 2, costo: 1 }, { de: 2, a: 4, cap: 4, costo: 2 }, { de: 3, a: 4, cap: 2, costo: 1 }];
      sel = -1;
    };
    ejemplo();
    const ctl = VIZ.controles(cuerpo);
    let capNueva = 4, costoNuevo = 2;
    ctl.rango({ etiqueta: 'Capacidad del arco nuevo', min: 1, max: 9, valor: capNueva, alCambiar: (v) => { capNueva = v; } });
    ctl.rango({ etiqueta: 'Costo del arco nuevo', min: 1, max: 9, valor: costoNuevo, alCambiar: (v) => { costoNuevo = v; } });
    const sb = ctl.rango({ etiqueta: 'Oferta del nodo elegido (+) o demanda (−)', min: -8, max: 8, valor: 0, alCambiar: (v) => { if (sel >= 0) { nodos[sel].b = v; dibujar(); } } });
    ctl.boton('Ejemplo', () => { ejemplo(); sb.valor = 0; dibujar(); }, { primario: true });
    ctl.boton('Quitar nodo elegido', () => {
      if (sel < 0) return;
      nodos.splice(sel, 1);
      arcos = arcos.filter((a) => a.de !== sel && a.a !== sel).map((a) => ({ ...a, de: a.de > sel ? a.de - 1 : a.de, a: a.a > sel ? a.a - 1 : a.a }));
      sel = -1; sb.valor = 0; dibujar();
    });
    ctl.boton('Quitar último arco', () => { arcos.pop(); dibujar(); });
    ctl.boton('Vaciar', () => { nodos = []; arcos = []; sel = -1; sb.valor = 0; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 420 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'origen (oferta)' }, { color: C.s2, texto: 'destino (demanda)' }, { color: C.superficie, borde: C.tinta, texto: 'transbordo' },
      { color: C.s6, texto: 'arco con flujo óptimo', forma: 'linea' }, { color: C.eje, texto: 'arco sin flujo', forma: 'linea' },
      { color: C.s4, texto: 'nodo elegido', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un espacio vacío para crear un nodo (hasta 8). Haga clic en un nodo para elegirlo y luego en otro para unirlos con un arco dirigido (si ya existe, se actualiza). Con el nodo elegido, el control de oferta le asigna oferta o demanda. Los arcos muestran flujo/capacidad.');

    function dibujar() {
      lienzo.limpiar();
      const b = nodos.map((q) => q.b);
      sol = nodos.length ? resolver(b, arcos) : null;
      const g = { dirigido: true, nodos: nodos.map((q, i) => ({ x: q.x, y: q.y, etiqueta: L[i] })), aristas: arcos.map((a, e) => ({ u: a.de, v: a.a, w: sol && sol.factible ? `${Math.round(sol.flujo[e])}/${a.cap}` : `${a.cap}` })) };
      geo = VIZ.grafo.dibujar(lienzo, g, {
        pesos: true,
        nodo: (i) => ({
          relleno: nodos[i].b > 0 ? C.s1 : nodos[i].b < 0 ? C.s2 : C.superficie, borde: nodos[i].b > 0 ? C.s1 : nodos[i].b < 0 ? C.s2 : C.tinta,
          texto: nodos[i].b === 0 ? C.tinta : C.sobre, anillo: i === sel ? C.s4 : null,
        }),
        arista: (a, e) => (sol && sol.factible && sol.flujo[e] > 0.5 ? { color: C.s6, ancho: 1.5 + (3 * sol.flujo[e]) / arcos[e].cap } : { color: C.eje, ancho: 1.5 }),
        colorPeso: (a, e) => (sol && sol.factible && sol.flujo[e] > 0.5 ? C.s6 : C.tinta2),
        debajo: (i) => (nodos[i].b ? `b=${nodos[i].b > 0 ? '+' : ''}${nodos[i].b}`.replace('-', '−') : ''),
      });
      if (!nodos.length) {
        registro.textContent = 'La red está vacía: haga clic en el lienzo para crear nodos.';
        lectura.set([['nodos', '0'], ['arcos', '0']]);
        return;
      }
      registro.textContent = sol.factible
        ? `Hay un flujo factible. El de costo mínimo envía ${sol.oferta} unidades con costo ${num(sol.costo)}; compruebe que en cada nodo sale − entra = b.`
        : `No hay flujo factible: ${sol.motivo}.` + (sol.oferta !== sol.demanda ? ' Agregue un nodo ficticio o ajuste una oferta/demanda hasta que sumen lo mismo.' : ' Pruebe aumentar la capacidad de un arco o agregar uno nuevo.');
      lectura.set([
        ['nodos / arcos', `${nodos.length} / ${arcos.length}`],
        ['oferta total', String(sol.oferta)], ['demanda total', String(sol.demanda)],
        ['factible', sol.factible ? 'sí' : 'no'],
        ['costo mínimo', sol.factible ? num(sol.costo) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i < 0) {
        if (nodos.length >= MAXN) { registro.textContent = `Máximo ${MAXN} nodos.`; return; }
        nodos.push({ x: Math.min(0.97, Math.max(0.03, (x - 26) / (lienzo.ancho - 52))), y: Math.min(0.97, Math.max(0.03, (y - 26) / (lienzo.alto - 64))), b: 0 });
        sel = nodos.length - 1; sb.valor = 0;
      } else if (sel < 0 || sel === i) {
        sel = sel === i ? -1 : i; sb.valor = sel >= 0 ? nodos[sel].b : 0;
      } else {
        const ya = arcos.find((a) => a.de === sel && a.a === i);
        if (ya) { ya.cap = capNueva; ya.costo = costoNuevo; } else arcos.push({ de: sel, a: i, cap: capNueva, costo: costoNuevo });
        sel = i; sb.valor = nodos[i].b;
      }
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('network-flow-model', {
    intro: String.raw`
      <p>Una <strong>red de flujo</strong> es un grafo dirigido por cuyos arcos circula una mercancía: agua por tuberías, paquetes por rutas, corriente por líneas.
      Algunos nodos <em>producen</em> (oferta), otros <em>consumen</em> (demanda) y el resto solo reenvía. La regla que lo gobierna todo es la
      <strong>conservación de flujo</strong>: en un nodo de paso, lo que entra es igual a lo que sale; en uno con oferta o demanda, la diferencia es exactamente esa oferta o demanda.</p>
      <p>Añadiendo capacidades y costos por unidad se obtiene un programa lineal con una estructura especial (la matriz de incidencia nodo-arco), que es la base de los caminos más cortos,
      el flujo máximo, el flujo de costo mínimo y el problema de transporte de esta sección.</p>`,
    visualizaciones: [
      {
        titulo: 'Conservación de flujo nodo por nodo',
        descripcion: 'Elija un arco con un clic y cambie su flujo: cada nodo pasa a verde cuando sale − entra iguala su oferta b, y a rojo si no. Pruebe «Flujo de costo mínimo» y luego suba un arco por encima de su capacidad.',
        montar: montarConservacion,
      },
      {
        titulo: 'La matriz de incidencia',
        descripcion: 'Cada columna de N tiene un +1 en el nodo de origen y un −1 en el de destino de su arco. Sume flujo a los arcos y observe cómo el producto N·x se compara fila a fila con b.',
        montar: montarIncidencia,
      },
      {
        titulo: 'Construya su propia red',
        descripcion: 'Cree nodos y arcos, asigne ofertas y demandas, y vea si existe un flujo factible. Intente que la oferta total no iguale la demanda, o ponga un arco de capacidad 1 en un cuello de botella: la figura explica por qué falla.',
        montar: montarEditor,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una red es un grafo dirigido \(G = (V, E)\) con una <strong>oferta neta</strong> \(b_i\) por nodo (\(b_i > 0\) origen, \(b_i < 0\) destino, \(b_i = 0\) transbordo),
      una <strong>capacidad</strong> \(u_{ij} \ge 0\) y un <strong>costo unitario</strong> \(c_{ij}\) por arco. Un flujo es un vector \(x = (x_{ij})\) que cumple
      </p>
      \[ \sum_{j:(i,j)\in E} x_{ij} \;-\; \sum_{k:(k,i)\in E} x_{ki} \;=\; b_i \quad \forall i \in V, \qquad 0 \le x_{ij} \le u_{ij}. \]
      <p>Sumando todas las ecuaciones, cada \(x_{ij}\) aparece una vez con signo \(+\) y otra con \(-\), de modo que una condición necesaria es \(\sum_i b_i = 0\):
      la oferta total iguala la demanda total. Si no coinciden, se agrega un nodo ficticio que absorbe la diferencia (ver
      <a href="tema.html?id=transportation-problem">el problema de transporte</a>).</p>
      <h2>Matriz de incidencia y formulación LP</h2>
      <p>La <strong>matriz de incidencia nodo-arco</strong> \(N\) tiene una fila por nodo y una columna por arco: la columna del arco \((i,j)\) tiene \(+1\) en la fila \(i\), \(-1\) en la fila \(j\) y ceros en el resto.
      La conservación de flujo es entonces \(N x = b\), y el problema de flujo de costo mínimo es</p>
      \[ \min\; c^{\top}x \quad \text{s.a.} \quad N x = b,\;\; 0 \le x \le u. \]
      <div class="recuadro"><p><strong>Propiedad clave:</strong> \(N\) es <em>totalmente unimodular</em> (todo menor cuadrado vale \(0, \pm 1\)). Si \(b\) y \(u\) son enteros, todo vértice
      del poliedro \(\{x : Nx = b,\ 0 \le x \le u\}\) es entero. Por eso el <a href="tema.html?id=simplex-tableau">Simplex</a> entrega flujos enteros sin necesitar enteros explícitos.</p></div>
      <p>Además \(N\) tiene rango \(|V| - 1\) en una red conexa: una de las ecuaciones es redundante (la suma de todas es \(0 = 0\)), y las bases del Simplex corresponden a <em>árboles generadores</em> de la red.</p>
      <h2>Ejemplo resuelto</h2>
      <p>En la red de la primera figura, el nodo A tiene \(b_A = 6\) y sus dos arcos de salida son \(A\!\to\!B\) y \(A\!\to\!C\). Si \(x_{AB} = 4\) y \(x_{AC} = 2\) entonces \(x_{AB} + x_{AC} - 0 = 6 = b_A\) y A conserva.
      En B (\(b_B = 0\)) debe cumplirse \(x_{BD} + x_{BE} = x_{AB}\), de modo que los 4 que llegan se reparten entre D y E; la capacidad de \(B\!\to\!E\) es 3, así que como máximo 3 siguen hacia E.
      Verificar nodo por nodo es exactamente comprobar \(Nx = b\) fila por fila.</p>
      <h2>Qué puede salir mal</h2>
      <ul>
        <li><strong>Oferta ≠ demanda:</strong> no hay solución a menos que se agregue un nodo ficticio.</li>
        <li><strong>Capacidad insuficiente:</strong> hay oferta y demanda parejas, pero algún corte de la red no deja pasar lo necesario; es exactamente el criterio de <a href="tema.html?id=max-flow-min-cut">flujo máximo y corte mínimo</a>.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>Esta formulación general se especializa en cuatro problemas clásicos: el <a href="tema.html?id=shortest-path-lp">camino más corto</a> (una unidad de origen a destino), el
      <a href="tema.html?id=max-flow-min-cut">flujo máximo</a> (sin costos), el <a href="tema.html?id=min-cost-flow">flujo de costo mínimo</a> y el
      <a href="tema.html?id=transportation-problem">transporte</a> (red bipartita). Algoritmos de grafos relacionados: <a href="tema.html?id=bfs-dijkstra">BFS y Dijkstra</a> y <a href="tema.html?id=bellman-ford">Bellman–Ford</a>.</p>`,
  });
})();
