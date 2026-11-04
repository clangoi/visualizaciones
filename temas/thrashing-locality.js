(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarLocalidad(cuerpo) {
    let L = 5, marcos = 5, sem = 1, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño de cada localidad (páginas)', min: 2, max: 10, valor: L, alCambiar: (v) => { L = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Marcos asignados al proceso', min: 1, max: 24, valor: marcos, alCambiar: (v) => { marcos = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { sem++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'página referenciada' }, { color: C.s8, texto: 'falla con los marcos elegidos', forma: 'punto' }, { color: C.s2, texto: 'tasa de fallas según marcos (LRU)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, el programa recorre localidades (grupos de páginas que usa durante un tiempo). Abajo, la tasa de fallas cae de golpe cuando los marcos alcanzan el tamaño de la localidad.');
    let traza = [], curva = [], plano;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, n = 240, rnd = VIZ.semilla(sem * 19 + L);
      lienzo.limpiar();
      traza = []; let base = 0;
      for (let t = 0; t < n; t++) { if (t % 60 === 0) base = Math.floor(rnd() * 20) * 1 + (t / 60) * 20; traza.push(base + Math.floor(rnd() * L)); }
      const maxP = Math.max(...traza) + 1, minP = Math.min(...traza);
      const mapa = (p) => p - minP;
      const res = VIZ.sor.reemplazo(traza.map(mapa), marcos, 'lru');
      const h1 = Math.round(H * 0.45), izq = 8, bw = (W - 2 * izq) / n, rango = maxP - minP;
      traza.forEach((p, t) => {
        const y = 8 + (1 - mapa(p) / rango) * (h1 - 16);
        ctx.fillStyle = res.pasos[t].fallo ? C.s8 : C.s1; ctx.fillRect(izq + t * bw, y - 1.5, Math.max(1.5, bw), 3);
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, h1 + 0.5); ctx.lineTo(W - izq, h1 + 0.5); ctx.stroke();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('página', 4, 0);
      // curva fallas vs marcos
      const maxM = 24; curva = Array.from({ length: maxM }, (_, m) => VIZ.sor.reemplazo(traza.map(mapa), m + 1, 'lru').fallos / n);
      const sub = { ancho: W, alto: H - h1 - 4, ctx };
      ctx.save(); ctx.translate(0, h1 + 4);
      plano = VIZ.plano({ ctx, ancho: W, alto: H - h1 - 4 }, { xmin: 1, xmax: maxM, ymin: 0, ymax: 1 }, { etiquetaX: 'marcos', etiquetaY: 'tasa de fallas', formatoY: (v) => `${Math.round(v * 100)} %`, margen: { sup: 16, inf: 34 } });
      plano.ejes(); VIZ.trazar(ctx, plano, curva.map((v, m) => [m + 1, v]), C.s2, 2);
      VIZ.marcador(ctx, plano.sx(marcos), plano.sy(curva[marcos - 1]), C.s2, 5);
      ctx.restore(); void sub;
      lectura.set([['localidad', `${L} páginas`], ['marcos', String(marcos)], ['tasa de fallas', `${VIZ.fmt(curva[marcos - 1] * 100, 3)} %`], ['con marcos ≥ localidad', `${VIZ.fmt(curva[Math.min(maxM, L + 0) - 1] * 100, 3)} %`]]);
      dibujar.h1 = h1;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || y < dibujar.h1 + 4) return tip.ocultar();
      const m = Math.round(plano.ix(x));
      if (m >= 1 && m <= curva.length) tip.mostrar(x, y, `<b>${m}</b> marcos<br>tasa de fallas ${VIZ.fmt(curva[m - 1] * 100, 3)} %`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarMulti(cuerpo) {
    let M = 120, w = 12, R = 400, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Marcos totales', min: 40, max: 400, paso: 10, valor: M, alCambiar: (v) => { M = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Conjunto de trabajo por proceso', min: 4, max: 30, valor: w, alCambiar: (v) => { w = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'utilización de la CPU', forma: 'linea' }, { color: C.apagado, texto: 'n* = marcos / conjunto de trabajo', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Modelo: cada proceso recibe M/n marcos. Si recibe menos que su conjunto de trabajo, sus fallas se disparan, esperan al disco, y la CPU queda ociosa.');
    const util = (n) => { const f = M / n, p = 0.0005 + (f >= w ? 0 : 0.25 * (1 - f / w) ** 1.5), e = 1 / (1 + p * R); return 1 - (1 - e) ** n; };
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 40, ymin: 0, ymax: 1 }, { etiquetaX: 'grado de multiprogramación n', etiquetaY: 'CPU utilizada', formatoY: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      const nstar = M / w;
      if (nstar < 40) VIZ.trazar(ctx, plano, [[nstar, 0], [nstar, 1]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, Array.from({ length: 391 }, (_, i) => [1 + i / 10, util(1 + i / 10)]), C.s1, 2.5);
      if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(util(hover)), C.s1, 4.5);
      const mejor = Array.from({ length: 40 }, (_, i) => i + 1).reduce((a, n) => (util(n) > util(a) ? n : a), 1);
      lectura.set([['n* (límite)', VIZ.fmt(nstar, 3)], ['mejor n', String(mejor)], ['CPU en n óptimo', `${VIZ.fmt(util(mejor) * 100, 3)} %`], ['CPU con n = 40', `${VIZ.fmt(util(40) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.round(plano.ix(x))); dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b><br>${VIZ.fmt(M / hover, 3)} marcos por proceso<br>CPU ${VIZ.fmt(util(hover) * 100, 3)} %`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('thrashing-locality', {
    intro: String.raw`
      <p>Los programas no usan su memoria al azar: durante un tiempo trabajan con un grupo pequeño de páginas (una <strong>localidad</strong>: el bucle actual, las funciones que llama, los datos que recorre) y luego pasan a otro. Esa regularidad es lo que hace que la memoria virtual funcione.</p>
      <p>Si a un proceso se le dan menos marcos que su localidad, falla constantemente. Si el sistema admite demasiados procesos, todos quedan así y la CPU se queda esperando al disco: <strong>thrashing</strong>.</p>`,
    visualizaciones: [
      { titulo: 'Localidad y tasa de fallas', descripcion: 'Aumente los marcos hasta igualar el tamaño de la localidad y observe el «codo» en la tasa de fallas. Cambie el tamaño de la localidad.', montar: montarLocalidad },
      { titulo: 'Thrashing al subir la multiprogramación', descripcion: 'Agregue procesos: la CPU mejora hasta cierto punto y luego se desploma. Mueva los marcos totales para desplazar el límite.', montar: montarMulti },
    ],
    teoria: String.raw`
      <h2>Conjunto de trabajo</h2>
      <p>El <strong>conjunto de trabajo</strong> \(W(t, \Delta)\) es el conjunto de páginas referenciadas en las últimas \(\Delta\) referencias. Su tamaño \(w\) es una estimación de cuántos marcos necesita el proceso ahora. Si \(D = \sum_i w_i\) es la demanda total y \(M\) los marcos disponibles:</p>
      <ul><li>\(D \le M\): todos caben; las fallas son pocas.</li><li>\(D &gt; M\): hay thrashing si se siguen admitiendo procesos.</li></ul>
      <h2>Política</h2>
      <pre><code>al admitir o reasignar:
    si D &gt; M:  suspender (llevar a disco) algún proceso
    si D &lt; M:  se puede activar otro proceso suspendido</code></pre>
      <p>Una alternativa es controlar la <em>frecuencia de fallas</em>: si un proceso falla por encima de un umbral superior, darle más marcos; si por debajo del inferior, quitarle. Si no hay marcos libres, suspender un proceso.</p>
      <h2>La trampa del control ingenuo</h2>
      <p>Un sistema que mide la utilización de la CPU y, si es baja, agrega más procesos, empeora todo cuando la causa es thrashing: más procesos → menos marcos cada uno → más fallas → menos CPU. Por eso el control de admisión debe mirar la memoria, no solo la CPU.</p>
      <p>El comportamiento depende de la carga: ver <a href="tema.html?id=page-replacement">reemplazo de páginas</a> y el <a href="tema.html?id=multilevel-page-tables-tlb">TLB</a>, que explota la misma localidad.</p>`,
  });
})();
