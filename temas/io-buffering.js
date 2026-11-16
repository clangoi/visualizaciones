(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarBufer(cuerpo) {
    let k = 2, R = 4, P = 3, n = 8, var_ = false, sem = 1, datos, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Búferes (1 = sin solapamiento)', min: 1, max: 4, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tiempo de leer un bloque (dispositivo)', min: 1, max: 10, valor: R, alCambiar: (v) => { R = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tiempo de procesar un bloque (CPU)', min: 1, max: 10, valor: P, alCambiar: (v) => { P = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Tiempos de lectura variables', valor: var_, alCambiar: (v) => { var_ = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { sem++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 130 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'dispositivo leyendo bloque i' }, { color: C.s2, texto: 'CPU procesando bloque i' }, { color: C.s4, texto: 'espera por búfer o por dato', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con un solo búfer, el dispositivo no puede llenar el siguiente bloque hasta que la CPU termine con el actual. Con dos o más, ambos trabajan a la vez y el búfer absorbe las variaciones.');
    function simular() {
      const rnd = VIZ.semilla(sem * 7 + 1), Ri = Array.from({ length: n }, () => (var_ ? Math.max(1, Math.round(R * (0.3 + 1.7 * rnd()))) : R));
      const de = [], df = [], ce = [], cf = []; let espD = 0;
      for (let i = 0; i < n; i++) {
        const libre = i - k >= 0 ? cf[i - k] : 0, prev = i ? df[i - 1] : 0;
        de[i] = Math.max(prev, libre); df[i] = de[i] + Ri[i];
        ce[i] = Math.max(df[i], i ? cf[i - 1] : 0); cf[i] = ce[i] + P;
        espD += de[i] - prev;
      }
      return { de, df, ce, cf, total: cf[n - 1], espD };
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      datos = simular();
      const izq = 74, esc = (W - izq - 10) / datos.total; geo = { izq, esc };
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2;
      ctx.fillText('dispositivo', izq - 8, 38); ctx.fillText('CPU', izq - 8, 84);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = C.s1; ctx.fillRect(izq + datos.de[i] * esc, 24, (datos.df[i] - datos.de[i]) * esc - 1, 28);
        ctx.fillStyle = C.s2; ctx.fillRect(izq + datos.ce[i] * esc, 70, (datos.cf[i] - datos.ce[i]) * esc - 1, 28);
        ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(10);
        if ((datos.df[i] - datos.de[i]) * esc > 14) ctx.fillText(String(i + 1), izq + ((datos.de[i] + datos.df[i]) / 2) * esc, 38);
        if ((datos.cf[i] - datos.ce[i]) * esc > 14) ctx.fillText(String(i + 1), izq + ((datos.ce[i] + datos.cf[i]) / 2) * esc, 84);
        if (i && datos.ce[i] > datos.cf[i - 1]) { ctx.fillStyle = C.s4; ctx.fillRect(izq + datos.cf[i - 1] * esc, 100, (datos.ce[i] - datos.cf[i - 1]) * esc - 1, 6); }
        if (i && datos.de[i] > datos.df[i - 1]) { ctx.fillStyle = C.s4; ctx.fillRect(izq + datos.df[i - 1] * esc, 54, (datos.de[i] - datos.df[i - 1]) * esc - 1, 6); }
      }
      const suma = datos.df.reduce((a, v, i) => a + v - datos.de[i], 0), serie = suma + n * P;
      lectura.set([['tiempo total', String(datos.total)], ['sin solapar (serie)', String(serie)], ['aceleración', `${VIZ.fmt(serie / datos.total, 3)}×`], ['dispositivo esperando por búfer', String(datos.espD)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!datos) return;
      const { x } = lienzo.posicion(ev), t = (x - geo.izq) / geo.esc, i = datos.df.findIndex((f, j) => t >= datos.de[j] && t < f), j = datos.cf.findIndex((f, q) => t >= datos.ce[q] && t < f);
      const { y } = lienzo.posicion(ev);
      if (y < 60 && i >= 0) tip.mostrar(x, y, `bloque <b>${i + 1}</b><br>dispositivo ${datos.de[i]} → ${datos.df[i]}`); else if (y >= 60 && j >= 0) tip.mostrar(x, y, `bloque <b>${j + 1}</b><br>CPU ${datos.ce[j]} → ${datos.cf[j]}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarTransferencia(cuerpo) {
    let kb = 64, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Datos a transferir (KB)', min: 1, max: 1024, valor: kb, alCambiar: (v) => { kb = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 160 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'CPU ocupada en la transferencia' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Modelo: el dispositivo entrega 100 MB/s; la CPU copia a 1 GB/s; una interrupción cuesta 5 µs y cada una transfiere 4 KB; con DMA, preparar la transferencia cuesta 10 µs y hay una interrupción final.');
    const dev = (kb * 1024) / 100e6 * 1e6, copia = (kb * 1024) / 1e9 * 1e6; // µs
    const M = () => { const d = (kb * 1024) / 100e6 * 1e6, c = (kb * 1024) / 1e9 * 1e6; return [['Espera activa (polling)', d + c, d], ['Interrupciones', Math.ceil(kb / 4) * 5 + c, d], ['DMA', 10 + 5, d]]; };
    let filas = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      filas = M(); const mx = Math.max(...filas.map((f) => f[2]), 1), izq = 150, ancho = W - izq - 80;
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle';
      filas.forEach(([t, cpu, total], i) => {
        const y = 12 + i * 46;
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(t, izq - 8, y + 16);
        ctx.fillStyle = C.neutro; ctx.fillRect(izq, y, ancho, 32);
        ctx.fillStyle = C.s8; ctx.beginPath(); ctx.roundRect(izq, y, Math.max(2, Math.min(1, cpu / total) * ancho), 32, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(`${VIZ.fmt((Math.min(1, cpu / total)) * 100, 3)} %`, izq + ancho + 6, y + 16);
      });
      void mx; void dev; void copia;
      lectura.set([['duración de la transferencia', `${VIZ.fmt(filas[0][2], 4)} µs`], ['CPU con DMA', `${VIZ.fmt(filas[2][1], 3)} µs`], ['CPU libre con DMA', `${VIZ.fmt((1 - filas[2][1] / filas[2][2]) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = Math.floor((y - 12) / 46);
      if (filas[i] && y > 12) tip.mostrar(x, y, `<b>${filas[i][0]}</b><br>CPU ${VIZ.fmt(filas[i][1], 4)} µs de ${VIZ.fmt(filas[i][2], 4)} µs`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('io-buffering', {
    intro: String.raw`
      <p>Los dispositivos de entrada/salida (discos, redes, teclados) son lentos y de ritmo irregular comparados con la CPU. El sistema operativo los oculta tras <strong>controladores</strong> (<em>drivers</em>) y usa <strong>búferes</strong>: zonas de memoria donde los datos esperan mientras el otro lado se pone al día.</p>
      <p>Con un solo búfer, productor y consumidor se turnan; con <strong>doble búfer</strong> uno llena mientras el otro vacía, y ambos trabajan a la vez. Además, la CPU puede dejar que el dispositivo copie datos solo, por <strong>DMA</strong>.</p>`,
    parametros: [
      ['Búferes (1 = sin solapamiento) (Fig. 1)', String.raw`Número de búferes, de 1 a 4. Con uno, el dispositivo no puede leer el bloque siguiente hasta que la CPU termina el actual; con 2 o más, lectura y procesamiento se solapan.`],
      ['Tiempo de leer un bloque (dispositivo) (Fig. 1)', String.raw`Unidades de tiempo (1 a 10) que tarda el dispositivo en leer cada bloque; la figura simula 8 bloques.`],
      ['Tiempo de procesar un bloque (CPU) (Fig. 1)', String.raw`Unidades de tiempo (1 a 10) que tarda la CPU en procesar cada bloque. Con solapamiento, el tiempo total lo fija sobre todo el más lento de los dos.`],
      ['Tiempos de lectura variables (Fig. 1)', String.raw`Casilla: cada lectura dura entre 30 % y 200 % aproximado del tiempo de leer (al menos 1), con valores aleatorios fijos para una semilla. Un búfer mayor absorbe las lecturas lentas.`],
      ['Nuevos datos (Fig. 1)', String.raw`Botón que cambia la semilla y genera otra secuencia de tiempos de lectura; solo se nota con «Tiempos de lectura variables» activa.`],
      ['Datos a transferir (KB) (Fig. 2)', String.raw`Volumen de la transferencia, de 1 a 1 024 KB. Cambia el tiempo de CPU ocupado de cada método respecto de la duración de la transferencia.`],
    ],
    visualizaciones: [
      { titulo: 'Uno, dos o más búferes', descripcion: 'Con un búfer los tiempos se suman; con dos se solapan y el total baja al del lado más lento. Active tiempos variables para ver cómo un búfer mayor absorbe las rachas.',
        ayuda: String.raw`<p>Eje horizontal, el tiempo (8 bloques). La fila superior es el dispositivo (azul, leyendo cada bloque numerado) y la inferior la CPU (naranja, procesándolo). Las tiras amarillas delgadas son esperas: bajo la fila del dispositivo, espera por un búfer libre; bajo la de la CPU, espera por un dato aún no leído. Pasar el cursor sobre un bloque muestra su inicio y fin.</p>
          <ul>
          <li><strong>Búferes</strong>: con 1 los tramos azul y naranja se alternan sin cruzarse; con 2 o más se solapan y el tiempo total baja.</li>
          <li><strong>Tiempo de leer</strong> y <strong>Tiempo de procesar</strong>: el más largo domina el tiempo total y el otro lado acumula esperas.</li>
          <li><strong>Tiempos de lectura variables</strong>: las lecturas son irregulares y más búferes reducen las esperas del dispositivo.</li>
          <li><strong>Lecturas</strong>: tiempo total, tiempo sin solapar (serie), aceleración y espera del dispositivo por búfer.</li>
          </ul>`, montar: montarBufer },
      { titulo: 'Quién copia los datos', descripcion: 'Compare qué fracción de la transferencia mantiene ocupada a la CPU con espera activa, con interrupciones y con DMA.',
        ayuda: String.raw`<p>Cada fila es un método: espera activa (polling), interrupciones y DMA. La barra gris es la duración de la transferencia y la parte roja, la fracción de ese tiempo en que la CPU está ocupada; a la derecha figura el porcentaje (tope 100 %). Pasar el cursor sobre una fila da el tiempo de CPU y la duración en µs.</p>
          <ul>
          <li><strong>Datos a transferir</strong>: con espera activa la CPU está ocupada todo el tiempo; con interrupciones paga 5 µs por cada 4 KB; con DMA solo 10 µs de preparación más 5 µs de la interrupción final, así que su fracción es la menor y baja al crecer los datos.</li>
          <li><strong>Lecturas</strong>: duración de la transferencia, CPU con DMA y porcentaje de CPU libre con DMA.</li>
          </ul>`, montar: montarTransferencia },
    ],
    teoria: String.raw`
      <h2>Tres formas de hacer E/S</h2>
      <table class="tabla-datos"><tr><th class="izq">Método</th><th class="izq">CPU</th></tr>
      <tr><td class="izq">espera activa (<em>polling</em>)</td><td class="izq">consulta el registro de estado una y otra vez; ocupada todo el tiempo</td></tr>
      <tr><td class="izq">por interrupciones</td><td class="izq">libre mientras espera; una <a href="tema.html?id=interrupts-exceptions">interrupción</a> por dato o bloque</td></tr>
      <tr><td class="izq">DMA</td><td class="izq">el controlador copia directo a memoria; una sola interrupción al final</td></tr></table>
      <h2>Búferes</h2>
      <p>Si leer un bloque toma \(R\) y procesarlo \(P\), con \(n\) bloques:</p>
      \[ T_{\text{1 búfer}} \approx n\,(R+P), \qquad T_{\text{2 búferes}} \approx R + (n-1)\max(R,P) + P. \]
      <p>El solapamiento oculta el menor de los dos tiempos. Más de dos búferes no mejoran el promedio, pero absorben ráfagas (el <a href="tema.html?id=bounded-buffer-condvars">productor–consumidor</a> con un buffer mayor). Otros usos del búfer: adaptar tamaños distintos de transferencia, y la <em>caché de bloques</em> del sistema de archivos.</p>
      <p>Cada interacción con el dispositivo pasa por una <a href="tema.html?id=system-calls">llamada al sistema</a>; leer en bloques grandes reduce su costo. El tiempo de cada bloque en un disco lo gobierna el <a href="tema.html?id=disk-scheduling">movimiento del brazo</a>.</p>`,
  });
})();
