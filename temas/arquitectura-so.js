(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  // Latencias aproximadas (orden de magnitud) en nanosegundos.
  const NIVELES = [
    ['registro de la CPU', 0.3, 'volátil'],
    ['caché L1', 1, 'volátil'],
    ['caché L2', 4, 'volátil'],
    ['caché L3', 15, 'volátil'],
    ['memoria RAM', 100, 'volátil'],
    ['SSD NVMe (lectura al azar)', 20e3, 'persistente'],
    ['red en el mismo centro de datos', 500e3, 'red'],
    ['disco duro (búsqueda + giro)', 8e6, 'persistente'],
    ['red entre continentes', 150e6, 'red'],
  ];
  function humano(ns) {
    const s = ns; // 1 ns → 1 s
    if (s < 60) return `${VIZ.fmt(s, 2)} s`;
    if (s < 3600) return `${VIZ.fmt(s / 60, 2)} min`;
    if (s < 86400) return `${VIZ.fmt(s / 3600, 2)} h`;
    if (s < 86400 * 365) return `${VIZ.fmt(s / 86400, 2)} días`;
    return `${VIZ.fmt(s / (86400 * 365), 2)} años`;
  }
  function real(ns) {
    if (ns < 1e3) return `${VIZ.fmt(ns, 2)} ns`;
    if (ns < 1e6) return `${VIZ.fmt(ns / 1e3, 2)} µs`;
    if (ns < 1e9) return `${VIZ.fmt(ns / 1e6, 2)} ms`;
    return `${VIZ.fmt(ns / 1e9, 2)} s`;
  }

  /* ---------- Fig. 1: jerarquía de memoria ---------- */

  function montarJerarquia(cuerpo) {
    let escala = false, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'escala humana: 1 ns = 1 segundo', valor: escala, alCambiar: (v) => { escala = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 420 : 340) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'memoria volátil' },
      { color: C.s2, texto: 'almacenamiento persistente' },
      { color: C.s3, texto: 'red' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje es logarítmico: cada marca es 10 veces la anterior. Pase el cursor sobre una barra.');
    const colorDe = { 'volátil': C.s1, persistente: C.s2, red: C.s3 };
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 560;
      const izq = angosto ? 10 : 230, sup = 10, inf = 30, der = angosto ? 12 : 110;
      const n = NIVELES.length, fila = (H - sup - inf) / n;
      const lx = (v) => izq + ((Math.log10(v) + 1) / 10) * (W - izq - der); // de 0.1 ns a 1e9 ns
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let e = -1; e <= 9; e++) {
        const x = Math.round(lx(10 ** e)) + 0.5;
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, sup); ctx.lineTo(x, H - inf); ctx.stroke();
        if (!angosto || e % 2 === 1) ctx.fillText(escala ? humano(10 ** e).replace(/\.0+ /, ' ') : real(10 ** e), x, H - inf + 6);
      }
      geo = { sup, fila };
      NIVELES.forEach(([t, ns, tipo], i) => {
        const y = sup + i * fila;
        const alto = angosto ? fila * 0.38 : fila * 0.62;
        const yb = angosto ? y + fila * 0.5 : y + (fila - alto) / 2;
        ctx.fillStyle = i === hover ? VIZ.alfa(colorDe[tipo], 0.75) : colorDe[tipo];
        ctx.beginPath(); ctx.roundRect(izq, yb, Math.max(2, lx(ns) - izq), alto, [0, 4, 4, 0]); ctx.fill();
        if (angosto) B.texto(ctx, t, izq, y + fila * 0.27, { px: 11, color: C.tinta });
        else B.texto(ctx, t, izq - 10, y + fila / 2, { alinear: 'right', px: 11, color: C.tinta });
        const etq = escala ? humano(ns) : real(ns);
        ctx.font = VIZ.fuente(11);
        const dentro = lx(ns) + 8 + ctx.measureText(etq).width > W;
        if (dentro) B.texto(ctx, etq, lx(ns) - 6, yb + alto / 2, { alinear: 'right', px: 11, color: C.sobre });
        else B.texto(ctx, etq, lx(ns) + 6, yb + alto / 2, { px: 11, color: C.tinta2 });
      });
      lectura.set([
        ['RAM / L1', `${VIZ.entero(100)}×`],
        ['SSD / RAM', `${VIZ.entero(200)}×`],
        ['disco / RAM', `${VIZ.entero(8e6 / 100)}×`],
        ['un acceso a disco a escala humana', humano(8e6)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = Math.floor((y - geo.sup) / geo.fila);
      if (i < 0 || i >= NIVELES.length) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = i; dibujar();
      const [t, ns] = NIVELES[i];
      tip.mostrar(x, y, `<b>${t}</b><br>${real(ns)}<br>a escala humana: ${humano(ns)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: lectura secuencial frente a aleatoria ---------- */

  function montarDisco(cuerpo) {
    let busqueda = 8, rpm = 7200, mbps = 160, hover = null;
    const KIB = 8; // tamaño de página
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Búsqueda media', min: 2, max: 14, valor: busqueda, formato: (v) => `${v} ms`, alCambiar: (v) => { busqueda = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Velocidad de giro', valor: String(rpm), opciones: [['5400', '5 400 rpm'], ['7200', '7 200 rpm'], ['15000', '15 000 rpm']], alCambiar: (v) => { rpm = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Transferencia', min: 80, max: 300, paso: 10, valor: mbps, formato: (v) => `${v} MB/s`, alCambiar: (v) => { mbps = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'disco duro, páginas al azar', forma: 'linea' },
      { color: C.s1, texto: 'disco duro, páginas contiguas', forma: 'linea' },
      { color: C.s3, texto: 'SSD, páginas al azar', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ambos ejes son logarítmicos. Pase el cursor para comparar los tiempos para un número de páginas.');
    const giro = () => 0.5 * (60000 / rpm); // ms de latencia rotacional media
    const transf = () => (KIB / 1024) / mbps * 1000; // ms por página
    const SERIES = [
      [(n) => n * (busqueda + giro() + transf()), C.s2, 'al azar'],
      [(n) => busqueda + giro() + n * transf(), C.s1, 'secuencial'],
      [(n) => n * 0.06, C.s3, 'SSD'],
    ];
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0.01, ymax: 2e5 }, {
        logY: true, etiquetaX: 'páginas leídas (8 KiB)', etiquetaY: 'tiempo (ms)',
        ticksX: [0, 1, 2, 3, 4], formatoX: (v) => VIZ.entero(10 ** v), formatoY: (v) => VIZ.entero(v) === '0' ? VIZ.fmt(v) : VIZ.entero(v),
      });
      plano.ejes();
      for (const [f, c] of SERIES) {
        const pts = [];
        for (let e = 0; e <= 4.0001; e += 0.05) pts.push([e, f(10 ** e)]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(f(10 ** hover)), c, 4);
      }
      const n = 1000;
      lectura.set([
        ['1 000 al azar', `${VIZ.fmt(SERIES[0][0](n) / 1000, 3)} s`],
        ['1 000 contiguas', `${VIZ.fmt(SERIES[1][0](n), 3)} ms`],
        ['razón', `${VIZ.entero(SERIES[0][0](n) / SERIES[1][0](n))}×`],
        ['latencia rotacional media', `${VIZ.fmt(giro(), 3)} ms`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(4, plano.ix(x)));
      dibujar();
      const n = Math.round(10 ** hover);
      tip.mostrar(x, y, `${VIZ.entero(n)} páginas` + SERIES.map(([f, c, t]) => VIZ.filaTooltip(c, t, `${VIZ.fmt(f(n), 3)} ms`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('arquitectura-so', {
    intro: String.raw`
      <p>Casi todas las decisiones de diseño de un motor de base de datos se explican por un hecho de hardware: la memoria rápida es
      pequeña, cara y volátil, y la memoria grande y persistente es lenta. Entre un registro de la CPU y un disco duro hay ocho órdenes de
      magnitud.</p>
      <p>Por eso los datos viven en disco divididos en <strong>páginas</strong> de tamaño fijo, se traen a memoria de a una página completa
      y los algoritmos se diseñan para minimizar cuántas páginas se leen, no cuántas instrucciones se ejecutan. El sistema operativo ayuda,
      pero a veces estorba: los motores serios administran su propia memoria.</p>`,
    visualizaciones: [
      {
        titulo: 'La jerarquía de memoria',
        descripcion: 'Latencias típicas de cada nivel, en escala logarítmica. Active la escala humana: si leer la caché L1 tomara un segundo, un acceso al disco duro tomaría más de tres meses.',
        montar: montarJerarquia,
      },
      {
        titulo: 'Leer en secuencia o al azar',
        descripcion: 'En un disco duro cada acceso aleatorio paga búsqueda y giro. Compare leer 1 000 páginas contiguas con 1 000 páginas dispersas, y cambie los parámetros del disco.',
        montar: montarDisco,
      },
    ],
    teoria: String.raw`
      <h2>El disco duro</h2>
      <p>El tiempo de leer un bloque es</p>
      \[ t = t_{\text{búsqueda}} + t_{\text{rotación}} + t_{\text{transferencia}}, \qquad
         t_{\text{rotación}} \approx \tfrac12 \cdot \frac{60\,000}{\text{rpm}} \text{ ms}. \]
      <p>Con 8 ms de búsqueda y 7 200 rpm, cada acceso aleatorio cuesta ~12 ms, mientras que transferir 8 KiB a 160 MB/s cuesta 0,05 ms.
      Leer páginas <strong>contiguas</strong> paga la búsqueda una sola vez: por eso los motores asignan las páginas de una tabla en
      <em>extents</em> consecutivos y prefieren recorridos secuenciales.</p>
      <p>Los SSD no tienen partes móviles: la lectura aleatoria baja a decenas de microsegundos y la diferencia con la secuencial se reduce
      mucho, aunque no desaparece. Escriben en bloques grandes que deben borrarse antes de reescribirse, lo que favorece la escritura
      secuencial (bitácoras, árboles LSM).</p>

      <h2>El modelo de costo de E/S</h2>
      <div class="recuadro">Como un acceso a disco cuesta lo que millones de instrucciones, el costo de un algoritmo de bases de datos se
      mide en <strong>páginas transferidas</strong> entre disco y memoria. Se llama \(N\) o \(M\) al número de páginas de una relación y
      \(B\) al número de páginas que caben en el buffer.</div>

      <h2>Lo que aporta (y estorba) el sistema operativo</h2>
      <table>
        <tr><th>Mecanismo del SO</th><th>Problema para la base</th><th>Qué hace el motor</th></tr>
        <tr><td>caché de páginas del SO</td><td>doble copia en memoria; política de reemplazo genérica</td><td><code>O_DIRECT</code> y buffer propio</td></tr>
        <tr><td>escrituras diferidas</td><td>un <code>write</code> no garantiza que el dato esté en disco</td><td><code>fsync</code> al confirmar</td></tr>
        <tr><td>memoria virtual y <code>mmap</code></td><td>el SO decide cuándo escribir páginas sucias, rompiendo WAL</td><td>evitar <code>mmap</code> para datos modificables</td></tr>
        <tr><td>hilos y procesos</td><td>cambios de contexto caros</td><td>pool de hilos, planificación propia</td></tr>
        <tr><td>lectura anticipada</td><td>adivina mal los patrones de acceso</td><td>prefetching guiado por el plan</td></tr>
      </table>

      <h2>Localidad en memoria</h2>
      <p>El mismo argumento vale un nivel más arriba: la RAM se lee en líneas de caché de 64 bytes. Un formato <em>columnar</em> (todos los
      valores de una columna juntos) aprovecha mejor la caché y la compresión que uno por filas cuando una consulta analítica lee pocas
      columnas de muchas filas.</p>
      <p>Siga con <a href="tema.html?id=paginas-buffer">páginas y buffer</a>, donde se ve cómo el motor administra esa memoria.</p>`,
  });
})();
