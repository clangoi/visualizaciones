(function () {
  'use strict';
  const { color: C } = VIZ;
  const num = (v) => VIZ.fmt(v);
  const EPS = 1e-9;
  const uds = (n) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

  /* ---------- Redes de las figuras ---------- */

  // Red de 6 nodos (figuras 1 y 3): S, A, B, C, D, T con capacidades aleatorias reproducibles.
  const N6 = [['S', 0.05, 0.5], ['A', 0.3, 0.12], ['B', 0.3, 0.88], ['C', 0.7, 0.12], ['D', 0.7, 0.88], ['T', 0.95, 0.5]];
  const P6 = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5], [1, 4]];
  function red6(semilla) {
    const rnd = VIZ.semilla(semilla * 7919 + 5);
    return P6.map(([de, a]) => ({ de, a, cap: 2 + Math.floor(rnd() * 8) }));
  }
  // Red de 4 nodos (figura 2) donde el camino «obvio» obliga a usar un arco de retroceso.
  const N4 = [['S', 0.07, 0.5], ['A', 0.4, 0.1], ['B', 0.4, 0.9], ['T', 0.93, 0.5]];
  const A4 = [{ de: 0, a: 1, cap: 3 }, { de: 0, a: 2, cap: 2 }, { de: 1, a: 2, cap: 2 }, { de: 1, a: 3, cap: 2 }, { de: 2, a: 3, cap: 3 }];

  // Arcos residuales alcanzables desde u: { v, e, dir (+1 adelante, −1 retroceso), r (capacidad residual) }.
  function residuales(arcos, flujo, u) {
    const out = [];
    arcos.forEach((a, e) => {
      if (a.de === u && a.cap - flujo[e] > EPS) out.push({ v: a.a, e, dir: 1, r: a.cap - flujo[e] });
      if (a.a === u && flujo[e] > EPS) out.push({ v: a.de, e, dir: -1, r: flujo[e] });
    });
    return out;
  }
  // Camino de aumento de s a t por BFS ('bfs') o DFS ('dfs'); devuelve lista de { e, dir, r, de, a } o null.
  function buscarCamino(arcos, flujo, s, t, regla) {
    const prev = new Map([[s, null]]);
    const pend = [s];
    while (pend.length) {
      const u = regla === 'dfs' ? pend.pop() : pend.shift();
      if (u === t) break;
      const vec = residuales(arcos, flujo, u);
      for (const w of regla === 'dfs' ? vec.reverse() : vec) if (!prev.has(w.v)) { prev.set(w.v, { ...w, de: u }); pend.push(w.v); }
    }
    if (!prev.has(t)) return null;
    const ruta = [];
    for (let v = t; v !== s; v = prev.get(v).de) ruta.unshift({ ...prev.get(v), a: v });
    return ruta;
  }
  function alcanzables(arcos, flujo, s) {
    const vis = new Set([s]), pend = [s];
    while (pend.length) { const u = pend.shift(); for (const w of residuales(arcos, flujo, u)) if (!vis.has(w.v)) { vis.add(w.v); pend.push(w.v); } }
    return vis;
  }
  const nombre = (N, i) => N[i][0];
  const textoRuta = (N, ruta) => [nombre(N, ruta[0].de), ...ruta.map((p) => nombre(N, p.a))].join(' → ');
  function grafoDe(N, arcos, etiqueta) {
    return { dirigido: true, nodos: N.map(([l, x, y]) => ({ x, y, etiqueta: l })), aristas: arcos.map((a, e) => ({ u: a.de, v: a.a, w: etiqueta(a, e) })) };
  }

  /* ---------- Fig. 1: caminos de aumento paso a paso ---------- */

  function montarAumento(cuerpo) {
    let semilla = 2, regla = 'bfs', red = red6(semilla), est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Búsqueda del camino', opciones: [['bfs', 'el más corto (Edmonds–Karp)'], ['dfs', 'en profundidad (Ford–Fulkerson)']], valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevas capacidades', () => { semilla++; red = red6(semilla); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'camino de aumento', forma: 'linea' }, { color: C.s2, texto: 'retroceso (discontinuo): cancela flujo', forma: 'linea' },
      { color: C.s1, texto: 'arco con flujo', forma: 'linea' }, { color: C.s8, texto: 'arco del corte mínimo', forma: 'linea' },
      { color: C.s1, texto: 'lado S del corte (al final)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las etiquetas muestran flujo/capacidad. «Un paso» alterna entre elegir el camino y enviar el flujo del cuello de botella. Al terminar no queda camino S→T en la red residual: los nodos alcanzables forman el lado S del corte mínimo.');

    function iniciar() {
      est = { flujo: red.map(() => 0), ruta: null, cuello: 0, valor: 0, aumentos: 0, fase: 'inicio', fin: false, lado: null, msg: `Red con ${red.length} arcos. Flujo inicial 0.` };
      return (function* () {
        for (;;) {
          const ruta = buscarCamino(red, est.flujo, 0, 5, regla);
          if (!ruta) {
            est.fin = true; est.ruta = null; est.fase = 'fin'; est.lado = alcanzables(red, est.flujo, 0);
            const cap = red.reduce((q, a) => q + (est.lado.has(a.de) && !est.lado.has(a.a) ? a.cap : 0), 0);
            est.msg = `No hay camino de aumento: los nodos alcanzables {${[...est.lado].map((i) => nombre(N6, i)).join(', ')}} forman el lado S. Capacidad del corte = ${cap} = flujo ${est.valor}.`;
            yield; return;
          }
          est.ruta = ruta; est.cuello = Math.min(...ruta.map((p) => p.r)); est.fase = 'ruta';
          est.msg = `Camino ${textoRuta(N6, ruta)}: cuello de botella ${est.cuello}${ruta.some((p) => p.dir < 0) ? ' (usa un arco de retroceso: cancela flujo)' : ''}.`;
          yield;
          ruta.forEach((p) => { est.flujo[p.e] += p.dir * est.cuello; });
          est.valor += est.cuello; est.aumentos++; est.fase = 'aumento';
          est.msg = `Se ${est.cuello === 1 ? 'envía' : 'envían'} ${uds(est.cuello)}: flujo total ${est.valor}.`;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!est) return;
      lienzo.limpiar();
      const enRuta = new Map();
      (est.ruta || []).forEach((p) => enRuta.set(p.e, p.dir));
      const lado = est.lado;
      const g = grafoDe(N6, red, (a, e) => `${Math.round(est.flujo[e])}/${a.cap}`);
      VIZ.grafo.dibujar(lienzo, g, {
        pesos: true,
        nodo: (i) => (lado ? (lado.has(i) ? { relleno: C.s1, borde: C.s1, texto: C.sobre } : {}) : i === 0 ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : i === 5 ? { relleno: C.s7, borde: C.s7, texto: C.sobre } : {}),
        arista: (a, e) => {
          if (lado && lado.has(a.u) && !lado.has(a.v)) return { color: C.s8, ancho: 4 };
          if (enRuta.has(e)) return { color: C.s2, ancho: 4.5, guiones: enRuta.get(e) < 0 ? [6, 4] : null };
          return est.flujo[e] > 0 ? { color: C.s1, ancho: 1.5 + (3 * est.flujo[e]) / red[e].cap } : { color: C.eje, ancho: 1.5 };
        },
        colorPeso: (a, e) => (enRuta.has(e) ? C.s2 : est.flujo[e] > 0 ? C.s1 : C.tinta2),
      });
      registro.textContent = est.msg;
      const lib = VIZ.opt.flujoMaximo(N6.length, red, 0, 5);
      const corteCap = lado ? red.reduce((q, a) => q + (lado.has(a.de) && !lado.has(a.a) ? a.cap : 0), 0) : null;
      lectura.set([
        ['flujo actual', String(est.valor)], ['caminos de aumento', String(est.aumentos)],
        ['capacidad del corte', corteCap == null ? '—' : String(corteCap)],
        ['flujo máximo (VIZ.opt)', String(lib.valor)],
        ['estado', est.fin ? (est.valor === lib.valor ? 'óptimo ✓' : 'revisar') : 'en curso'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: red residual y elección manual del camino ---------- */

  function montarResidual(cuerpo) {
    let flujo = A4.map(() => 0), ruta = [0], geo = null, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Enviar flujo por el camino', () => enviar(), { primario: true });
    ctl.boton('Camino más corto', () => { const r = buscarCamino(A4, flujo, 0, 3, 'bfs'); ruta = r ? [0, ...r.map((p) => p.a)] : [0]; dibujar(); });
    ctl.boton('Deshacer nodo', () => { if (ruta.length > 1) ruta.pop(); dibujar(); });
    ctl.boton('Reiniciar', () => { flujo = A4.map(() => 0); ruta = [0]; msg = ''; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arco con capacidad residual', forma: 'linea' }, { color: C.s3, texto: 'retroceso (discontinuo): flujo ya enviado', forma: 'linea' },
      { color: C.s2, texto: 'su camino', forma: 'linea' }, { color: C.s6, texto: 'origen S' }, { color: C.s7, texto: 'destino T' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El lienzo muestra la red residual: cada etiqueta es la capacidad que queda (adelante) o el flujo que puede cancelarse (retroceso). Haga clic en nodos para construir un camino desde S (clic otra vez en el último nodo lo quita) y luego en «Enviar flujo». Al llegar a T se envía el cuello de botella.');

    function residualActual() {
      const aristas = [];
      A4.forEach((a, e) => {
        if (a.cap - flujo[e] > EPS) aristas.push({ u: a.de, v: a.a, w: String(a.cap - flujo[e]), e, dir: 1 });
        if (flujo[e] > EPS) aristas.push({ u: a.a, v: a.de, w: String(flujo[e]), e, dir: -1 });
      });
      return aristas;
    }
    function pasosRuta() {
      const R = residualActual(), pasos = [];
      for (let k = 1; k < ruta.length; k++) { const q = R.find((r) => r.u === ruta[k - 1] && r.v === ruta[k]); if (q) pasos.push(q); }
      return pasos;
    }
    function enviar() {
      if (ruta[ruta.length - 1] !== 3) { msg = 'Primero llegue hasta T con su camino.'; dibujar(); return; }
      const ps = pasosRuta(), f = Math.min(...ps.map((p) => Number(p.w)));
      ps.forEach((p) => { flujo[p.e] += p.dir * f; });
      msg = `Se ${f === 1 ? 'envió' : 'enviaron'} ${uds(f)} por ${ruta.map((i) => nombre(N4, i)).join(' → ')}${ps.some((p) => p.dir < 0) ? ' (con retroceso)' : ''}.`;
      ruta = [0];
      dibujar();
    }
    function dibujar() {
      lienzo.limpiar();
      const R = residualActual(), pasos = pasosRuta();
      const enRuta = new Set(pasos.map((p) => `${p.u}-${p.v}`));
      geo = VIZ.grafo.dibujar(lienzo, { dirigido: true, nodos: N4.map(([l, x, y]) => ({ x, y, etiqueta: l })), aristas: R }, {
        pesos: true,
        nodo: (i) => (i === 0 ? { relleno: C.s6, borde: C.s6, texto: C.sobre, anillo: ruta[ruta.length - 1] === 0 ? C.s2 : null }
          : i === 3 ? { relleno: C.s7, borde: C.s7, texto: C.sobre, anillo: ruta[ruta.length - 1] === 3 ? C.s2 : null }
            : ruta.includes(i) ? { anillo: C.s2 } : {}),
        arista: (a) => (enRuta.has(`${a.u}-${a.v}`) ? { color: C.s2, ancho: 4.5, guiones: a.dir < 0 ? [6, 4] : null } : a.dir < 0 ? { color: C.s3, ancho: 2, guiones: [6, 4] } : { color: C.s1, ancho: 2 }),
        colorPeso: (a) => (enRuta.has(`${a.u}-${a.v}`) ? C.s2 : a.dir < 0 ? C.s3 : C.s1),
      });
      const valor = flujo[0] + flujo[1];
      const lib = VIZ.opt.flujoMaximo(4, A4, 0, 3).valor;
      const hay = !!buscarCamino(A4, flujo, 0, 3, 'bfs');
      const llegado = ruta[ruta.length - 1] === 3;
      registro.textContent = msg || (llegado ? `Camino ${ruta.map((i) => nombre(N4, i)).join(' → ')} listo: cuello de botella ${Math.min(...pasos.map((p) => Number(p.w)))}.` : ruta.length > 1 ? `Camino parcial ${ruta.map((i) => nombre(N4, i)).join(' → ')}: continúe hasta T.` : 'Haga clic en un nodo vecino de S en la red residual.');
      if (!hay && valor === lib) registro.textContent = `No queda camino de aumento: flujo ${valor} = máximo ${lib}. ${msg}`;
      lectura.set([
        ['flujo actual', String(valor)], ['flujo máximo', String(lib)],
        ['retrocesos disponibles', String(R.filter((r) => r.dir < 0).length)],
        ['¿hay camino de aumento?', hay ? 'sí' : 'no'],
      ]);
      msg = '';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i < 0) return;
      const ult = ruta[ruta.length - 1];
      if (i === ult && ruta.length > 1) { ruta.pop(); }
      else if (!ruta.includes(i) && residualActual().some((r) => r.u === ult && r.v === i)) ruta.push(i);
      else msg = `No hay arco residual de ${nombre(N4, ult)} a ${nombre(N4, i)}.`;
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 3: todos los cortes ---------- */

  function montarCortes(cuerpo) {
    let semilla = 2, red = red6(semilla), lado = new Set([0]), verFlujo = true, plano = null, barras = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Mostrar un flujo máximo', valor: verFlujo, alCambiar: (v) => { verFlujo = v; dibujar(); } });
    ctl.boton('Nuevas capacidades', () => { semilla++; red = red6(semilla); lado = new Set([0]); dibujar(); }, { primario: true });
    ctl.boton('Ir al corte mínimo', () => { lado = new Set(todos()[0].lado); dibujar(); });
    ctl.boton('Solo S en su lado', () => { lado = new Set([0]); dibujar(); });
    VIZ.subtitulo(cuerpo, 'Elija el lado S del corte con clics en A, B, C y D');
    const red_ = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    VIZ.subtitulo(cuerpo, 'Capacidad de los 16 cortes posibles');
    const graf = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 290 });
    const tip = VIZ.tooltip(graf);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'lado S del corte (nodos)' }, { color: C.s8, texto: 'arco que cruza de S a T', forma: 'linea' },
      { color: C.inactivo, texto: 'corte cualquiera (barra)' }, { color: C.s2, texto: 'su corte (barra)' }, { color: C.s6, texto: 'corte mínimo (barra)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en A, B, C o D para pasarlo al lado S o al lado T. También puede hacer clic en una barra para tomar ese corte. Solo cuentan los arcos que van de S hacia T; los que vuelven no suman.');
    let geo = null;

    const capacidad = (L) => red.reduce((q, a) => q + (L.has(a.de) && !L.has(a.a) ? a.cap : 0), 0);
    function todos() {
      const lista = [];
      for (let m = 0; m < 16; m++) {
        const L = [0, ...[1, 2, 3, 4].filter((k) => m & (1 << (k - 1)))];
        lista.push({ lado: L, cap: capacidad(new Set(L)) });
      }
      return lista.sort((p, q) => p.cap - q.cap || p.lado.length - q.lado.length);
    }
    const clave = (L) => [...L].sort().join(',');
    function dibujar() {
      const lib = VIZ.opt.flujoMaximo(6, red, 0, 5);
      const cortes = todos(), minimo = cortes[0].cap, mio = capacidad(lado), cl = clave(lado);
      red_.limpiar();
      geo = VIZ.grafo.dibujar(red_, grafoDe(N6, red, (a, e) => (verFlujo ? `${Math.round(lib.flujo[e])}/${a.cap}` : String(a.cap))), {
        pesos: true,
        nodo: (i) => (lado.has(i) ? { relleno: C.s1, borde: C.s1, texto: C.sobre } : {}),
        arista: (a, e) => (lado.has(a.u) && !lado.has(a.v) ? { color: C.s8, ancho: 4 } : verFlujo && lib.flujo[e] > 0 ? { color: C.eje, ancho: 1.5 + (2 * lib.flujo[e]) / red[e].cap } : { color: C.eje, ancho: 1.5 }),
        colorPeso: (a) => (lado.has(a.u) && !lado.has(a.v) ? C.s8 : C.tinta2),
      });
      graf.limpiar();
      plano = VIZ.plano(graf, { xmin: 0, xmax: 16, ymin: 0, ymax: Math.max(...cortes.map((q) => q.cap)) * 1.12 }, { etiquetaX: 'cortes ordenados por capacidad', etiquetaY: 'capacidad', ticksX: [], formatoY: (v) => String(Math.round(v)) });
      plano.ejes();
      const { ctx } = graf, ancho = plano.sx(1) - plano.sx(0);
      barras = cortes.map((q, i) => {
        const mismo = clave(q.lado) === cl;
        ctx.fillStyle = mismo ? C.s2 : q.cap === minimo ? C.s6 : C.inactivo;
        ctx.beginPath();
        ctx.roundRect(plano.sx(i) + 1, plano.sy(q.cap), ancho - 2, plano.y0 - plano.sy(q.cap), [4, 4, 0, 0]);
        ctx.fill();
        return q;
      });
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(lib.valor)); ctx.lineTo(plano.x1, plano.sy(lib.valor)); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`flujo máximo = ${lib.valor}`, plano.x1 - 4, plano.sy(lib.valor) - 3);
      const cuantos = cortes.filter((q) => q.cap === minimo).length;
      registro.textContent = `Su corte {${[...lado].map((i) => nombre(N6, i)).join(', ')}} | {${[0, 1, 2, 3, 4, 5].filter((i) => !lado.has(i)).map((i) => nombre(N6, i)).join(', ')}} tiene capacidad ${mio}` +
        (mio === minimo ? ': es un corte mínimo y su capacidad iguala el flujo máximo.' : ` ≥ flujo máximo ${lib.valor}: sobran ${mio - lib.valor} unidades; ningún corte puede costar menos que el flujo.`);
      lectura.set([
        ['capacidad de su corte', String(mio)], ['flujo máximo', String(lib.valor)], ['corte mínimo', String(minimo)],
        ['cortes mínimos', String(cuantos)], ['min corte = max flujo', minimo === lib.valor ? 'sí ✓' : 'no'],
      ]);
    }
    red_.alDibujar = dibujar;
    graf.alDibujar = dibujar;
    red_.canvas.style.cursor = 'pointer';
    red_.canvas.addEventListener('click', (ev) => {
      const { x, y } = red_.posicion(ev), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i <= 0 || i === 5) return;
      if (lado.has(i)) lado.delete(i); else lado.add(i);
      dibujar();
    });
    graf.canvas.style.cursor = 'pointer';
    const barraEn = (ev) => { const { x, y } = graf.posicion(ev); if (!plano || !plano.dentro(x, y)) return -1; const i = Math.floor(plano.ix(x)); return i >= 0 && i < barras.length ? i : -1; };
    graf.canvas.addEventListener('pointermove', (ev) => {
      const i = barraEn(ev);
      if (i < 0) return tip.ocultar();
      const { x, y } = graf.posicion(ev), q = barras[i];
      tip.mostrar(x, y, `lado S: <b>{${q.lado.map((k) => nombre(N6, k)).join(', ')}}</b><br>capacidad <b>${q.cap}</b>`);
    });
    graf.canvas.addEventListener('pointerleave', () => tip.ocultar());
    graf.canvas.addEventListener('click', (ev) => { const i = barraEn(ev); if (i >= 0) { lado = new Set(barras[i].lado); dibujar(); } });
    dibujar();
  }

  VIZ.registrarTema('max-flow-min-cut', {
    intro: String.raw`
      <p>¿Cuánto se puede enviar de un origen \(S\) a un destino \(T\) si cada arco tiene una capacidad? La respuesta se construye con un método sencillo: buscar un camino por el que todavía quepa flujo,
      enviar lo que permita su arco más estrecho y repetir. Para poder <em>deshacer</em> malas decisiones, el método trabaja sobre la <strong>red residual</strong>, que además de la capacidad sobrante ofrece
      arcos de retroceso con el flujo ya enviado.</p>
      <p>Cuando ya no hay camino, el conjunto de nodos aún alcanzables desde \(S\) define un <strong>corte</strong> cuya capacidad es exactamente el flujo logrado. Ese es el teorema del
      flujo máximo y corte mínimo: el mayor flujo posible es igual a la capacidad del corte más barato, y cada uno certifica al otro.</p>`,
    visualizaciones: [
      {
        titulo: 'Caminos de aumento paso a paso',
        descripcion: 'Reproduzca el algoritmo y observe cómo cada camino naranja aumenta el flujo en su cuello de botella. Cambie a búsqueda en profundidad y compare cuántos aumentos hacen falta; al final, los arcos rojos forman el corte mínimo.',
        montar: montarAumento,
      },
      {
        titulo: 'La red residual y el arco de retroceso',
        descripcion: 'Construya usted los caminos. Envíe primero S → A → B → T (2 unidades) y luego complete: para llegar al máximo, el último camino tiene que cancelar flujo con el arco de retroceso B → A.',
        montar: montarResidual,
      },
      {
        titulo: 'Todos los cortes de una red',
        descripcion: 'Elija qué nodos quedan del lado S y compare la capacidad de su corte con el flujo máximo. Ningún corte baja del flujo, y al menos uno lo iguala: pruebe «Ir al corte mínimo».',
        montar: montarCortes,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Una red con origen \(s\), destino \(t\) y capacidades \(u_{ij} \ge 0\). Un <strong>flujo</strong> \(x\) cumple \(0 \le x_{ij} \le u_{ij}\) y conserva en todo nodo salvo \(s\) y \(t\); su valor es
      \(|x| = \sum_j x_{sj} - \sum_k x_{ks}\). Un <strong>corte</strong> \((S, \bar S)\) con \(s \in S\), \(t \in \bar S\) tiene capacidad
      \(u(S,\bar S) = \sum_{i \in S,\, j \in \bar S} u_{ij}\); solo cuentan los arcos que van de \(S\) hacia \(\bar S\).</p>
      <h2>Red residual</h2>
      <p>Dado un flujo \(x\), la red residual tiene un arco \(i \to j\) con capacidad \(u_{ij} - x_{ij}\) (si es positiva) y un arco de <em>retroceso</em> \(j \to i\) con capacidad \(x_{ij}\) (si es positiva). Un camino \(s \to t\) en ella es un
      <strong>camino de aumento</strong>: enviar por él el <em>cuello de botella</em> \(\delta\) (la menor capacidad residual) mantiene factible el flujo. Un arco de retroceso reduce el flujo del arco original.</p>
      <h2>Algoritmo de Ford–Fulkerson / Edmonds–Karp</h2>
      <pre><code>x ← 0
mientras exista un camino P de s a t en la red residual:
    δ ← mínimo de las capacidades residuales de P
    para cada arco (i, j) de P:
        si es de avance:     x[i][j] ← x[i][j] + δ
        si es de retroceso:  x[j][i] ← x[j][i] − δ
devolver x</code></pre>
      <p>Con búsqueda en anchura (<em>Edmonds–Karp</em>) el camino elegido es el de menos arcos y el número de aumentos es \(O(VE)\), con costo total \(O(VE^2)\), independiente de las capacidades. Con un camino cualquiera y capacidades enteras, el número de aumentos
      puede llegar a \(|x^*|\), y con capacidades irracionales el método puede no terminar.</p>
      <h2>Teorema del flujo máximo y corte mínimo</h2>
      <div class="recuadro"><p>El valor del flujo máximo de \(s\) a \(t\) es igual a la capacidad del corte mínimo:
      \[ \max_x |x| \;=\; \min_{S} u(S, \bar S). \]</p></div>
      <p><strong>Cota fácil (dualidad débil).</strong> Para todo flujo \(x\) y todo corte \((S,\bar S)\), \(|x| = \sum_{S\to\bar S} x_{ij} - \sum_{\bar S\to S} x_{ij} \le \sum_{S \to \bar S} u_{ij} = u(S,\bar S)\): ningún flujo supera a ningún corte.</p>
      <p><strong>Igualdad.</strong> Cuando el algoritmo se detiene, sea \(S\) el conjunto de nodos alcanzables desde \(s\) en la red residual. Como \(t \notin S\), todo arco de \(S\) a \(\bar S\) está saturado (\(x_{ij} = u_{ij}\)) y todo arco de \(\bar S\) a \(S\) está vacío (\(x_{ij} = 0\)); entonces la desigualdad anterior es una igualdad y \(|x| = u(S,\bar S)\). Esto demuestra también que el algoritmo es correcto.</p>
      <h2>Ejemplo resuelto: el arco de retroceso</h2>
      <p>En la red de la segunda figura (\(s\!\to\!a: 3,\ s\!\to\!b: 2,\ a\!\to\!b: 2,\ a\!\to\!t: 2,\ b\!\to\!t: 3\)) el camino \(s\,a\,b\,t\) transporta 2. Quedan \(s\!\to\!b\) con 2, \(b\!\to\!t\) con 1 y \(a\!\to\!t\) con 2; se envían 1 por \(s\,b\,t\) y 1 por \(s\,a\,t\) (total 4). El último camino posible es
      \(s \to b \to a \to t\), que usa el retroceso \(b \to a\) (cancela 1 de las 2 unidades que habían pasado por \(a \to b\)) y lleva el total a 5. El corte \(\{s\}\) tiene capacidad \(3+2 = 5\): es mínimo.</p>
      <h2>Dualidad lineal</h2>
      <p>El flujo máximo es un LP de máximo valor con las restricciones de <a href="tema.html?id=network-flow-model">conservación y capacidad</a>. Su <a href="tema.html?id=dual-construction">dual</a> asigna una variable \(y_{ij} \ge 0\) a cada arco y un potencial \(p_i\):
      \(\min \sum u_{ij}y_{ij}\) con \(y_{ij} \ge p_j - p_i\), \(p_s = 1\), \(p_t = 0\). Las soluciones enteras del dual son los cortes (\(p_i = 1\) si \(i \in S\)), y la unimodularidad de la matriz de incidencia hace que el dual
      tenga óptimo entero: de ahí la igualdad de valores, un caso de <a href="tema.html?id=strong-duality">dualidad fuerte</a>.</p>
      <h2>Aplicaciones y conexiones</h2>
      <ul>
        <li><strong>Emparejamientos</strong> en grafos bipartitos, caminos disjuntos (teorema de Menger) y segmentación de imágenes por cortes.</li>
        <li>Si además cada unidad tiene costo, el problema pasa a ser <a href="tema.html?id=min-cost-flow">flujo de costo mínimo</a>.</li>
        <li>La búsqueda del camino de aumento es una <a href="tema.html?id=bfs-dijkstra">búsqueda en anchura</a> sobre la red residual.</li>
      </ul>`,
  });
})();
