(function () {
  'use strict';
  const { color: C } = VIZ;
  const ALGS = [['fcfs', 'FCFS'], ['sstf', 'SSTF'], ['scan', 'SCAN (ascensor)'], ['cscan', 'C-SCAN']];
  const MAXC = 199;

  function pedidos(sem, n) { const r = VIZ.semilla(sem * 23 + n); return Array.from({ length: n }, () => Math.floor(r() * (MAXC + 1))); }

  function montarRuta(cuerpo) {
    let alg = 'fcfs', n = 8, sem = 1, cab = 53, hover = null, res, ped;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', opciones: ALGS, valor: alg, alCambiar: (v) => { alg = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Solicitudes', min: 3, max: 20, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Cabezal inicial (cilindro)', min: 0, max: MAXC, valor: cab, alCambiar: (v) => { cab = v; dibujar(); } });
    ctl.boton('Nuevas solicitudes', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'recorrido del cabezal', forma: 'linea' }, { color: C.s2, texto: 'solicitud atendida', forma: 'punto' }, { color: C.apagado, texto: 'cabezal inicial', forma: 'punto' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje horizontal: cilindro (0 a 199). El tiempo avanza hacia abajo. SCAN va hacia los cilindros altos y vuelve; C-SCAN salta de vuelta al principio y sigue en el mismo sentido.');
    let pts = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      ped = pedidos(sem, n); res = VIZ.sor.disco(ped, cab, alg, true, MAXC);
      const izq = 14, der = 14, sup = 26, paso = (H - sup - 14) / Math.max(1, res.ruta.length - 1), sx = (c) => izq + (c / MAXC) * (W - izq - der);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      for (let c = 0; c <= MAXC; c += 50) { ctx.fillText(String(c), sx(c), 10); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(sx(c), 18); ctx.lineTo(sx(c), H - 8); ctx.stroke(); }
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.beginPath();
      pts = res.ruta.map((c, i) => [sx(c), sup + i * paso, c]);
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      pts.forEach(([x, y, c], i) => {
        const atendida = i > 0 && ped.includes(c) && res.atend.includes(c);
        ctx.beginPath(); ctx.arc(x, y, i === 0 ? 5 : 4, 0, 7); ctx.fillStyle = i === 0 ? C.apagado : atendida ? C.s2 : C.superficie; ctx.fill(); ctx.strokeStyle = i === 0 ? C.apagado : C.s1; ctx.lineWidth = 1.5; ctx.stroke();
      });
      const todos = ALGS.map(([a]) => VIZ.sor.disco(ped, cab, a, true, MAXC).mov), mejor = Math.min(...todos);
      lectura.set([['movimiento total', `${res.mov} cilindros`], ['promedio por solicitud', VIZ.fmt(res.mov / n, 3)], ['mejor de los cuatro', `${mejor} cilindros`], ['solicitudes', ped.join(', ')]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 9);
      if (q >= 0) tip.mostrar(x, y, `paso <b>${q}</b><br>cilindro <b>${pts[q][2]}</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarCurva(cuerpo) {
    let hover = null, sem = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Otro muestreo', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ALGS.map(([, t], i) => ({ color: VIZ.series[i], texto: t, forma: 'linea' })));
    VIZ.nota(cuerpo, 'Movimiento medio por solicitud (200 colas aleatorias por punto). Con colas largas SCAN y C-SCAN aprovechan la cercanía; FCFS paga siempre unos 66 cilindros.');
    let datos, plano;
    function dibujar() {
      const { ctx } = lienzo; lienzo.limpiar();
      const ns = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64];
      datos = ALGS.map(([a]) => ns.map((n) => { let s = 0; for (let t = 0; t < 200; t++) { const p = pedidos(sem * 1000 + t, n); s += VIZ.sor.disco(p, 100, a, true, MAXC).mov / n; } return s / 200; }));
      plano = VIZ.plano(lienzo, { xmin: 2, xmax: 64, ymin: 0, ymax: Math.max(...datos.flat()) * 1.05 }, { etiquetaX: 'solicitudes en cola', etiquetaY: 'cilindros por solicitud' });
      plano.ejes();
      datos.forEach((d, i) => VIZ.trazar(ctx, plano, d.map((v, j) => [ns[j], v]), VIZ.series[i], 2));
      dibujar.ns = ns;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const v = plano.ix(x), j = dibujar.ns.reduce((a, n, q) => (Math.abs(n - v) < Math.abs(dibujar.ns[a] - v) ? q : a), 0);
      tip.mostrar(x, y, `<b>${dibujar.ns[j]}</b> solicitudes` + ALGS.map(([, t], i) => VIZ.filaTooltip(VIZ.series[i], t, VIZ.fmt(datos[i][j], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('disk-scheduling', {
    intro: String.raw`
      <p>En un disco magnético lo más caro es <strong>mover el brazo</strong> hasta el cilindro correcto (<em>seek</em>, milisegundos), más que leer los datos. Si hay varias solicitudes pendientes, el orden en que se atienden cambia cuánto se mueve el brazo en total.</p>
      <p>Cuatro políticas clásicas: <strong>FCFS</strong> (en orden de llegada), <strong>SSTF</strong> (la más cercana primero), <strong>SCAN</strong> (barrer en un sentido y volver, como un ascensor) y <strong>C-SCAN</strong> (barrer solo en un sentido).</p>`,
    visualizaciones: [
      { titulo: 'Recorrido del cabezal', descripcion: 'Compare el movimiento total de cada algoritmo con las mismas solicitudes. Mueva el cabezal inicial y la cantidad de solicitudes.', montar: montarRuta },
      { titulo: 'Qué algoritmo gana según la carga', descripcion: 'Promedie muchas colas aleatorias: cuanto más larga la cola, más ayuda ordenar las solicitudes.', montar: montarCurva },
    ],
    teoria: String.raw`
      <h2>Costo de un acceso</h2>
      \[ T_{\text{acceso}} = T_{\text{seek}} + T_{\text{rotación}} + T_{\text{transferencia}}, \qquad T_{\text{rotación}} \approx \tfrac12 \cdot \frac{60}{\text{RPM}}. \]
      <p>A 7200 RPM la media es 4,2 ms de rotación más un seek de 4–10 ms, mientras que transferir un sector de 4 KB toma microsegundos. Por eso conviene reducir los seeks.</p>
      <h2>Algoritmos</h2>
      <table class="tabla-datos"><tr><th class="izq">Algoritmo</th><th class="izq">Idea</th><th class="izq">Inconveniente</th></tr>
      <tr><td class="izq">FCFS</td><td class="izq">orden de llegada</td><td class="izq">mucho movimiento con colas largas</td></tr>
      <tr><td class="izq">SSTF</td><td class="izq">la más cercana al cabezal</td><td class="izq">inanición de las solicitudes lejanas (como SJF)</td></tr>
      <tr><td class="izq">SCAN</td><td class="izq">barrer hasta el extremo y volver</td><td class="izq">los cilindros del medio se atienden con más frecuencia</td></tr>
      <tr><td class="izq">C-SCAN</td><td class="izq">barrer en un sentido y saltar al inicio</td><td class="izq">tiempo de espera más uniforme</td></tr></table>
      <p>Con \(N\) cilindros y solicitudes uniformes, la distancia esperada entre dos cilindros al azar es \(N/3\): por eso FCFS se mueve unos 66 cilindros por solicitud en un disco de 200. En SSTF la analogía con <a href="tema.html?id=fcfs-sjf">SJF</a> (la más corta primero) explica tanto su buen rendimiento como su inanición.</p>
      <p>Los SSD no tienen brazo, por lo que sus planificadores solo ordenan para agrupar solicitudes; la idea de agrupar (ver <a href="tema.html?id=io-buffering">búferes</a>) se mantiene. Los <a href="tema.html?id=file-allocation">métodos de asignación de archivos</a> influyen en cuán secuenciales son las lecturas.</p>`,
  });
})();
