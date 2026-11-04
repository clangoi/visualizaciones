(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarFlujo(cuerpo) {
    let k = 0, modo = 'if';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Consumidor espera con', opciones: [['if', 'si buffer vacío: wait  (incorrecto)'], ['while', 'mientras buffer vacío: wait  (correcto)']], valor: modo, alCambiar: (v) => { modo = v; lienzo.ajustar(true); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => VIZ.sor.altoSecuencia(msgs()) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'consumidor 1' }, { color: C.s2, texto: 'productor' }, { color: C.s3, texto: 'consumidor 2' }, { color: C.s8, texto: 'error', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Semántica de Mesa: signal solo despierta al hilo, que debe volver a competir por el lock; entre tanto otro hilo puede haber consumido el dato.');
    function msgs() {
      const m = [
        { de: 0, a: 0, texto: 'lock; buffer vacío → wait', color: C.s1, nota: 'suelta el lock y duerme' },
        { de: 1, a: 1, texto: 'lock; put(x); signal', color: C.s2, nota: 'despierta a C1 (pasa a listo)' },
        { de: 1, a: 1, texto: 'unlock', color: C.s2 },
        { de: 2, a: 2, texto: 'lock; get() → x; unlock', color: C.s3, nota: 'se cuela antes que C1' },
        { de: 0, a: 0, texto: 'despierta y retoma el lock', color: C.s1 },
      ];
      if (modo === 'if') m.push({ de: 0, a: 0, texto: 'get() con buffer vacío', color: C.s8, nota: 'ERROR: lee un dato inexistente' });
      else { m.push({ de: 0, a: 0, texto: 'while: buffer vacío → wait otra vez', color: C.s1, nota: 'reevalúa la condición' }); m.push({ de: 1, a: 1, texto: 'siguiente put(y); signal', color: C.s2 }); m.push({ de: 0, a: 0, texto: 'despierta; get() → y', color: C.s1, nota: 'ahora sí hay un dato' }); }
      return m;
    }
    const TXT = ['El consumidor 1 toma el lock, ve el buffer vacío y llama a wait: suelta el lock y se duerme.', 'El productor inserta un ítem y hace signal: C1 queda listo, pero aún no corre.', 'El productor suelta el lock.', 'El consumidor 2 toma el lock antes que C1 y se lleva el ítem.', 'C1 despierta y vuelve a tomar el lock.', modo === 'if' ? 'Con «if», C1 no revisa de nuevo y ejecuta get() con el buffer vacío: error.' : 'Con «while», C1 vuelve a comprobar, ve el buffer vacío y espera otra vez.', 'El productor inserta otro ítem y hace signal.', 'C1 despierta, comprueba y consume correctamente.'];
    function iniciar() { k = 0; return (function* () { for (let j = 1; j <= msgs().length; j++) { k = j; yield; } })(); }
    function dibujar() {
      lienzo.limpiar();
      VIZ.sor.secuencia(lienzo, ['Consumidor 1', 'Productor', 'Consumidor 2'], msgs(), k);
      registro.textContent = k ? TXT[k - 1] : 'Pulse «Un paso» para comenzar.';
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  function montarOcupacion(cuerpo) {
    let N = 6, tp = 3, tc = 4, sem = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capacidad del buffer N', min: 1, max: 20, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tiempo medio de producir', min: 1, max: 10, valor: tp, alCambiar: (v) => { tp = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tiempo medio de consumir', min: 1, max: 10, valor: tc, alCambiar: (v) => { tc = v; dibujar(); } });
    ctl.boton('Nueva simulación', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'ítems en el buffer', forma: 'linea' }, { color: C.s4, texto: 'productor bloqueado (lleno)', forma: 'cuadro' }, { color: C.s2, texto: 'consumidor bloqueado (vacío)', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un productor y un consumidor con tiempos aleatorios. Un buffer mayor absorbe las rachas; si un lado es más lento, el otro pasa bloqueado.');
    let occ = [], plano;
    function dibujar() {
      const { ctx } = lienzo, T = 200;
      lienzo.limpiar();
      const rnd = VIZ.semilla(sem * 131 + N * 7 + tp * 3 + tc), ex = (m) => -m * Math.log(1 - rnd());
      let n = 0, tP = ex(tp), tC = ex(tc), bp = 0, bc = 0, prod = 0, cons = 0, t = 0;
      occ = []; const bl = [];
      for (let u = 0; u < T; u++) {
        t = u;
        let b1 = 0, b2 = 0;
        while (tP <= u) { if (n < N) { n++; prod++; tP += ex(tp); } else { b1 = 1; break; } }
        while (tC <= u) { if (n > 0) { n--; cons++; tC += ex(tc); } else { b2 = 1; break; } }
        if (b1) tP = u + 1; if (b2) tC = u + 1;
        bp += b1; bc += b2; occ.push(n); bl.push([b1, b2]);
      }
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: T, ymin: 0, ymax: N + 1 }, { etiquetaX: 'tiempo', etiquetaY: 'ítems', ticksY: VIZ.ticks(0, N, 5) });
      plano.ejes();
      bl.forEach(([b1, b2], u) => { if (b1) { ctx.fillStyle = VIZ.alfa(C.s4, 0.5); ctx.fillRect(plano.sx(u), plano.y1, plano.sx(u + 1) - plano.sx(u), plano.y0 - plano.y1); } if (b2) { ctx.fillStyle = VIZ.alfa(C.s2, 0.35); ctx.fillRect(plano.sx(u), plano.y1, plano.sx(u + 1) - plano.sx(u), plano.y0 - plano.y1); } });
      VIZ.trazar(ctx, plano, occ.map((v, u) => [u, v]), C.s1, 2);
      lectura.set([['producidos', String(prod)], ['consumidos', String(cons)], ['productor bloqueado', `${VIZ.fmt((bp / T) * 100, 3)} %`], ['consumidor bloqueado', `${VIZ.fmt((bc / T) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = Math.max(0, Math.min(occ.length - 1, Math.round(plano.ix(x))));
      tip.mostrar(x, y, `t = <b>${u}</b><br>ítems en el buffer: <b>${occ[u]}</b> de ${N}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('bounded-buffer-condvars', {
    intro: String.raw`
      <p>El problema del <strong>productor–consumidor</strong> aparece en todas partes: un hilo genera datos (peticiones, mensajes) y otro los procesa, conectados por un buffer de tamaño limitado. Hay que garantizar que el productor espere cuando el buffer está lleno, que el consumidor espere cuando está vacío, y que nadie dañe el buffer al usarlo a la vez.</p>
      <p>Con <a href="tema.html?id=semaphores">semáforos</a> se resuelve con tres contadores; con un <em>mutex</em> y <strong>variables de condición</strong> se escribe de forma más natural: «espero hasta que haya datos» y «aviso que ya hay datos».</p>`,
    visualizaciones: [
      { titulo: 'Por qué la espera va en un while', descripcion: 'Compare las dos versiones del consumidor: con «if» un hilo puede encontrar el buffer vacío tras despertar; con «while» vuelve a comprobar.', montar: montarFlujo },
      { titulo: 'Ocupación del buffer', descripcion: 'Varíe la capacidad y los tiempos de producir y consumir. Observe cuándo se bloquea cada lado y cómo un buffer mayor suaviza las rachas.', montar: montarOcupacion },
    ],
    teoria: String.raw`
      <h2>Variables de condición</h2>
      <p>Una variable de condición se usa siempre junto con un mutex. <code>wait(cv, m)</code> suelta el mutex y duerme de forma atómica; al despertar vuelve a tomarlo. <code>signal(cv)</code> despierta a un hilo; <code>broadcast</code> a todos.</p>
      <pre><code>productor:                          consumidor:
    lock(m)                             lock(m)
    mientras cuenta = N:                mientras cuenta = 0:
        wait(no_lleno, m)                   wait(no_vacío, m)
    poner(x);  cuenta ← cuenta + 1      x ← sacar();  cuenta ← cuenta − 1
    signal(no_vacío)                    signal(no_lleno)
    unlock(m)                           unlock(m)</code></pre>
      <h2>Mesa frente a Hoare</h2>
      <p>En la semántica de <strong>Mesa</strong> (la de Pthreads, Java, Go) <code>signal</code> solo es una pista: el hilo despertado corre después y la condición puede haber cambiado, por lo que debe reevaluarse con <strong>while</strong>. Con la de Hoare el despertado corre de inmediato y bastaría un <code>if</code>, pero casi nadie la implementa. Además existen <em>despertares espurios</em>.</p>
      <h2>Rendimiento</h2>
      <p>Si el tiempo medio de producir es \(P\) y de consumir \(C\), en régimen el caudal es \(\min(1/P,\,1/C)\): lo gobierna el lado más lento. El buffer no aumenta el caudal medio; solo absorbe las variaciones. Con tasas iguales, la ocupación se comporta como un paseo aleatorio acotado y un buffer de \(N\) ítems tolera rachas de ese orden. En una tubería de Unix este buffer es el <a href="tema.html?id=ipc-mechanisms">pipe</a>.</p>`,
  });
})();
