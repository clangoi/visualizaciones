(function () {
  'use strict';
  const { color: C } = VIZ;
  const ALGS = [['fifo', 'FIFO'], ['lru', 'LRU'], ['min', 'MIN (óptimo)'], ['reloj', 'Reloj'], ['azar', 'Aleatorio']];
  const BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];

  function cadena(tipo, sem) { return tipo === 'belady' ? BELADY : tipo === 'ciclo' ? Array.from({ length: 24 }, (_, i) => i % 5) : S().cadenaLocal(sem, 30, 8, 0.7); }
  const S = () => VIZ.sor;

  function montarPasos(cuerpo) {
    let alg = 'fifo', marcos = 3, tipo = 'local', sem = 1, refs, res, k;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', opciones: ALGS, valor: alg, alCambiar: (v) => { alg = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Cadena de referencias', opciones: [['local', 'Con localidad (aleatoria)'], ['belady', 'Cadena de Belady'], ['ciclo', 'Cíclica 0–4']], valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Marcos', min: 1, max: 6, valor: marcos, alCambiar: (v) => { marcos = v; lienzo.ajustar(true); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { sem++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + marcos * 24 + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'falla de página' }, { color: C.s6, texto: 'acierto' }, { color: C.s2, texto: 'página que se expulsa', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada columna es una referencia a una página; debajo, el contenido de los marcos. MIN conoce el futuro y sirve de cota inferior imposible de alcanzar.');
    function iniciar() {
      refs = cadena(tipo, sem); res = S().reemplazo(refs, marcos, alg, sem); k = 0;
      return (function* () { for (let j = 1; j <= refs.length; j++) { k = j; yield; } })();
    }
    let geo;
    function dibujar() {
      if (!res) return;
      const { ctx, ancho: W } = lienzo, n = refs.length, izq = 46, cw = Math.min(30, (W - izq - 8) / n);
      lienzo.limpiar(); geo = { izq, cw };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2; ctx.fillText('ref.', izq - 6, 14);
      for (let m = 0; m < marcos; m++) ctx.fillText('marco ' + m, izq - 6, 42 + m * 24);
      for (let j = 0; j < n; j++) {
        const x = izq + j * cw, p = res.pasos[j];
        ctx.textAlign = 'center'; ctx.fillStyle = j < k ? C.tinta : C.inactivo; ctx.fillText(String(refs[j]), x + cw / 2, 14);
        if (j >= k) continue;
        ctx.fillStyle = p.fallo ? C.s8 : C.s6; ctx.fillRect(x + 1, 26, cw - 2, 4);
        p.marcos.forEach((v, m) => {
          const y = 32 + m * 24, ac = v === refs[j];
          if (ac && p.fallo) { ctx.fillStyle = VIZ.alfa(C.s8, 0.2); ctx.fillRect(x + 1, y, cw - 2, 20); }
          else if (ac) { ctx.fillStyle = VIZ.alfa(C.s6, 0.25); ctx.fillRect(x + 1, y, cw - 2, 20); }
          ctx.fillStyle = v == null ? C.inactivo : C.tinta; ctx.fillText(v == null ? '·' : String(v), x + cw / 2, y + 10);
        });
        if (p.victima != null) { const m = res.pasos[j].marcos.indexOf(refs[j]); ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.strokeRect(x + 1.5, 32 + m * 24 + 0.5, cw - 3, 19); ctx.lineWidth = 1; }
      }
      const fallos = res.pasos.slice(0, k).filter((p) => p.fallo).length, p = res.pasos[k - 1];
      registro.textContent = !k ? 'Pulse «Un paso» o «Reproducir».' : p.fallo ? `Referencia ${p.ref}: falla de página${p.victima != null ? `; se expulsa la ${p.victima}` : ' (marco libre)'}.` : `Referencia ${p.ref}: ya está en memoria.`;
      lectura.set([['referencias', `${k} de ${n}`], ['fallas', String(fallos)], ['tasa de fallas', k ? `${VIZ.fmt((fallos / k) * 100, 3)} %` : '—'], ['MIN con estos marcos', String(S().reemplazo(refs, marcos, 'min').fallos)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !res) return;
      const { x, y } = lienzo.posicion(ev), j = Math.floor((x - geo.izq) / geo.cw);
      if (j >= 0 && j < k) tip.mostrar(x, y, `ref. <b>${refs[j]}</b><br>${res.pasos[j].fallo ? 'falla' : 'acierto'}<br>marcos: ${res.pasos[j].marcos.map((v) => (v == null ? '·' : v)).join(' ')}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  function montarCurva(cuerpo) {
    let tipo = 'belady', sem = 1, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cadena', opciones: [['belady', 'Cadena de Belady (12 refs.)'], ['local', 'Con localidad (400 refs.)'], ['ciclo', 'Cíclica 0–4']], valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { sem++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ALGS.map(([, t], i) => ({ color: VIZ.series[i], texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Fallas según el número de marcos. En la cadena de Belady, FIFO empeora al pasar de 3 a 4 marcos (anomalía de Belady); LRU y MIN nunca lo hacen.');
    let plano, datos;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const refs = tipo === 'local' ? S().cadenaLocal(sem, 400, 16, 0.85) : cadena(tipo, sem), maxM = tipo === 'local' ? 16 : 7;
      datos = ALGS.map(([a]) => Array.from({ length: maxM }, (_, m) => S().reemplazo(refs, m + 1, a, 5).fallos));
      const mx = Math.max(...datos.flat());
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: maxM, ymin: 0, ymax: mx * 1.05 }, { etiquetaX: 'marcos', etiquetaY: 'fallas de página', ticksX: Array.from({ length: maxM }, (_, i) => i + 1).filter((v) => maxM < 9 || v % 2 === 1) });
      plano.ejes();
      datos.forEach((d, i) => { if (ALGS[i][0] !== 'azar') VIZ.trazar(ctx, plano, d.map((v, m) => [m + 1, v]), VIZ.series[i], 2); else VIZ.trazar(ctx, plano, d.map((v, m) => [m + 1, v]), VIZ.series[i], 1.5, [4, 3]); if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(d[hover - 1]), VIZ.series[i], 3.5); });
      const f = datos[0], anom = f.findIndex((v, m) => m && v > f[m - 1]);
      lectura.set([['referencias', String(refs.length)], ['FIFO con más marcos empeora', anom >= 0 ? `sí: ${anom} → ${anom + 1} marcos (${f[anom - 1]} → ${f[anom]} fallas)` : 'no en esta cadena'], ['LRU nunca empeora', datos[1].every((v, m) => !m || v <= datos[1][m - 1]) ? 'cierto' : 'falso']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(datos[0].length, Math.round(plano.ix(x)))); dibujar();
      tip.mostrar(x, y, `<b>${hover}</b> marcos` + ALGS.map(([, t], i) => VIZ.filaTooltip(VIZ.series[i], t, String(datos[i][hover - 1]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('page-replacement', {
    intro: String.raw`
      <p>La memoria virtual permite que los procesos usen más memoria que la física: las páginas que no caben viven en disco y se traen cuando se necesitan. Cuando un acceso encuentra su página ausente ocurre una <strong>falla de página</strong>; si todos los marcos están ocupados, el sistema debe elegir una <strong>página víctima</strong> y expulsarla.</p>
      <p>Cada falla cuesta milisegundos (un acceso a disco) frente a nanosegundos de un acceso normal, así que elegir bien la víctima importa muchísimo.</p>`,
    visualizaciones: [
      { titulo: 'Reemplazo paso a paso', descripcion: 'Elija un algoritmo y una cadena de referencias y siga el contenido de los marcos. Compare con la cadena cíclica, donde LRU y FIFO fallan siempre.', montar: montarPasos },
      { titulo: 'Fallas según el número de marcos', descripcion: 'Compare los cinco algoritmos. Con la cadena de Belady observe cómo FIFO empeora al agregar un marco.', montar: montarCurva },
    ],
    teoria: String.raw`
      <h2>Algoritmos</h2>
      <table class="tabla-datos"><tr><th class="izq">Algoritmo</th><th class="izq">Víctima</th><th class="izq">Comentario</th></tr>
      <tr><td class="izq">MIN (óptimo)</td><td class="izq">la que se usará más tarde en el futuro</td><td class="izq">cota inferior; no realizable</td></tr>
      <tr><td class="izq">FIFO</td><td class="izq">la más antigua en memoria</td><td class="izq">simple; sufre la anomalía de Belady</td></tr>
      <tr><td class="izq">LRU</td><td class="izq">la menos recientemente usada</td><td class="izq">buena aproximación a MIN; costosa de implementar exacta</td></tr>
      <tr><td class="izq">Reloj</td><td class="izq">LRU aproximado con bit de referencia</td><td class="izq">lo usan los sistemas reales</td></tr>
      <tr><td class="izq">Aleatorio</td><td class="izq">cualquiera</td><td class="izq">sorprendentemente aceptable, sin casos patológicos</td></tr></table>
      <h2>Reloj (segunda oportunidad)</h2>
      <pre><code>mientras bit_ref[mano] = 1:
    bit_ref[mano] ← 0;  mano ← (mano + 1) mod N
víctima ← mano;  mano ← (mano + 1) mod N</code></pre>
      <p>El hardware pone el bit de referencia en 1 en cada acceso; la «mano» recorre los marcos como un reloj dándole una segunda oportunidad a las páginas usadas recientemente.</p>
      <h2>Propiedad de pila y anomalía de Belady</h2>
      <p>Un algoritmo es de <em>pila</em> si el conjunto de páginas en memoria con \(m\) marcos siempre está contenido en el de \(m+1\). LRU y MIN lo son, por lo que nunca empeoran al agregar memoria. FIFO no: con la cadena \(1,2,3,4,1,2,5,1,2,3,4,5\) produce 9 fallas con 3 marcos y 10 con 4.</p>
      <h2>Costo de las fallas</h2>
      <p>Con tasa de fallas \(p\), tiempo de memoria \(t_m\) y de servicio de la falla \(t_f\):</p>
      \[ \text{TEA} = (1-p)\,t_m + p\,t_f. \]
      <p>Con \(t_m = 100\) ns y \(t_f = 8\) ms, para que la lentitud no pase de 10 % se necesita \(p &lt; 1{,}25\times 10^{-7}\): una falla cada ocho millones de accesos. Ver cómo se evita su exceso en <a href="tema.html?id=thrashing-locality">thrashing</a>, y cómo se traduce cada acceso en <a href="tema.html?id=paging-address-translation">paginación</a>.</p>`,
  });
})();
