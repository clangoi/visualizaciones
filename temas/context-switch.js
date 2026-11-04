(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarCambio(cuerpo) {
    // CPU en el centro; PCB de A a la izquierda y de B a la derecha.
    const A = { nombre: 'A', pc: 0x4010, sp: 0x7f20, r1: 12, color: C.s1 }, B = { nombre: 'B', pc: 0x5200, sp: 0x7e90, r1: 99, color: C.s2 };
    const PASOS = [
      'A ejecuta en la CPU: sus registros están en la CPU.',
      'Interrupción del reloj: el hardware guarda PC y pasa a modo núcleo.',
      'El núcleo guarda los registros restantes de A en el PCB de A y marca A como Listo.',
      'El planificador elige a B (el siguiente en la cola de listos).',
      'El núcleo carga los registros de B desde el PCB de B y cambia el espacio de direcciones.',
      'Retorno de la interrupción: B continúa donde se quedó; ahora B está en Ejecución.',
    ];
    let k = 0, cpu, pcbA, pcbB;
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 270 : 200) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'proceso A' }, { color: C.s2, texto: 'proceso B' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance con «Un paso»: el contenido de los registros viaja de la CPU al PCB de A y del PCB de B a la CPU.');
    function iniciar() {
      k = 0; cpu = { ...A }; pcbA = null; pcbB = { ...B };
      return (function* () {
        k = 1; yield;
        k = 2; yield;
        k = 3; pcbA = { ...cpu }; yield;
        k = 4; yield;
        k = 5; cpu = { ...pcbB }; yield;
        k = 6; yield;
      })();
    }
    const hex = (v) => '0x' + v.toString(16);
    function caja(ctx, x, y, w, h, titulo, reg, col, activo) {
      ctx.strokeStyle = col; ctx.lineWidth = activo ? 3 : 1.5; ctx.strokeRect(x, y, w, h);
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(titulo, x + 8, y + 14);
      ctx.font = VIZ.fuente(11); ctx.fillStyle = reg ? C.tinta : C.apagado;
      (reg ? [`PC ${hex(reg.pc)}`, `SP ${hex(reg.sp)}`, `R1 ${reg.r1}`] : ['—', '(vacío)']).forEach((t, i) => ctx.fillText(t, x + 8, y + 36 + i * 17));
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ang = W < 560, bw = ang ? (W - 24) / 3 : Math.min(150, (W - 60) / 3), gap = (W - 3 * bw) / 4, y = 14, h = ang ? 96 : 100;
      const xs = [gap, 2 * gap + bw, 3 * gap + 2 * bw];
      caja(ctx, xs[0], y, bw, h, 'PCB de A', pcbA, A.color, false);
      caja(ctx, xs[1], y, bw, h, 'CPU' + (k >= 1 && k <= 4 ? ' · A' : k >= 5 ? ' · B' : ''), cpu, cpu ? cpu.color : C.tinta, true);
      caja(ctx, xs[2], y, bw, h, 'PCB de B', k >= 5 ? null : pcbB, B.color, false);
      ctx.font = VIZ.fuente(11); ctx.textAlign = 'center';
      ctx.fillStyle = k >= 3 ? A.color : C.inactivo; ctx.fillText('◀ guardar', (xs[0] + bw + xs[1]) / 2, y + h / 2);
      ctx.fillStyle = k >= 5 ? B.color : C.inactivo; ctx.fillText('cargar ◀', (xs[1] + bw + xs[2]) / 2, y + h / 2);
      // Estados
      const est = (n) => (k === 0 ? (n === 'A' ? 'Ejecución' : 'Listo') : n === 'A' ? (k < 3 ? 'Ejecución' : 'Listo') : (k < 5 ? 'Listo' : 'Ejecución'));
      ctx.font = VIZ.fuente(12, 600);
      [['A', xs[0], A.color], ['B', xs[2], B.color]].forEach(([n, x, col]) => { ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(`${n}: ${est(n)}`, x + bw / 2, y + h + 22); });
      registro.textContent = PASOS[Math.max(0, k - 1)];
      lectura.set([['paso', `${k} de ${PASOS.length}`], ['en la CPU', k >= 5 ? 'B' : 'A'], ['trabajo útil durante el cambio', '0']]);
    }
    lienzo.alDibujar = () => cpu && dibujar();
    rep.reiniciar();
  }

  function montarSobrecosto(cuerpo) {
    let c = 10, frio = 20, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Costo del cambio c (µs)', min: 1, max: 50, valor: c, alCambiar: (v) => { c = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Penalización de caché fría (µs)', min: 0, max: 100, valor: frio, alCambiar: (v) => { frio = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'solo el cambio: q / (q + c)', forma: 'linea' }, { color: C.s2, texto: 'con caché fría: q / (q + c + f)', forma: 'linea' }]);
    VIZ.nota(cuerpo, 'Quantums muy cortos hacen al sistema ágil pero desperdician CPU en cambiar; muy largos mejoran la eficiencia pero empeoran la respuesta.');
    const e1 = (q) => q / (q + c), e2 = (q) => q / (q + c + frio);
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1000, ymin: 0, ymax: 1 }, { etiquetaX: 'quantum q (µs)', etiquetaY: 'fracción de CPU útil', formatoY: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      const pts = (f) => Array.from({ length: 101 }, (_, i) => [Math.max(1, i * 10), f(Math.max(1, i * 10))]);
      VIZ.trazar(ctx, plano, pts(e1), C.s1, 2); VIZ.trazar(ctx, plano, pts(e2), C.s2, 2);
      if (hover) { VIZ.marcador(ctx, plano.sx(hover), plano.sy(e1(hover)), C.s1, 4); VIZ.marcador(ctx, plano.sx(hover), plano.sy(e2(hover)), C.s2, 4); }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.round(plano.ix(x))); dibujar();
      tip.mostrar(x, y, `q = <b>${hover}</b> µs` + VIZ.filaTooltip(C.s1, 'solo el cambio', VIZ.fmt(e1(hover) * 100, 3) + ' %') + VIZ.filaTooltip(C.s2, 'con caché fría', VIZ.fmt(e2(hover) * 100, 3) + ' %'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('context-switch', {
    intro: String.raw`
      <p>Un <strong>cambio de contexto</strong> es el acto de quitarle la CPU a un proceso y dársela a otro. Para que el primero pueda retomarse después exactamente donde estaba,
      el núcleo guarda su estado (contador de programa, puntero de pila, registros) en su <em>bloque de control de proceso</em> (PCB) y carga el del siguiente.</p>
      <p>Es trabajo puro de administración: mientras dura, ningún programa avanza. Por eso importa cuánto cuesta y cada cuánto se hace.</p>`,
    visualizaciones: [
      { titulo: 'Guardar uno, cargar otro', descripcion: 'Avance paso a paso y observe cómo los registros de A se copian a su PCB y los de B pasan a la CPU.', montar: montarCambio },
      { titulo: 'Costo frente al quantum', descripcion: 'Mueva el costo del cambio y la penalización por caché fría y vea cómo el quantum corto reduce la fracción de CPU útil.', montar: montarSobrecosto },
    ],
    teoria: String.raw`
      <h2>Qué se guarda</h2>
      <ul><li>Registros de uso general, contador de programa, puntero de pila y palabra de estado.</li>
      <li>Puntero a la tabla de páginas (otro espacio de direcciones); al cambiarlo suele vaciarse el <a href="tema.html?id=multilevel-page-tables-tlb">TLB</a>.</li>
      <li>Información de contabilidad y estado del planificador (ver <a href="tema.html?id=process-states-pcb">estados y PCB</a>).</li></ul>
      <pre><code>cambiar(A, B):
    guardar registros de la CPU en PCB[A]
    estado[A] ← Listo                # o Bloqueado
    estado[B] ← Ejecución
    cargar registros de PCB[B] en la CPU
    # la instrucción siguiente ya pertenece a B</code></pre>
      <h2>Costo</h2>
      <p>Directo: guardar y cargar estado, unas pocas microsegundos. Indirecto, y mayor: los datos de B no están en la caché ni en el TLB, de modo que sus primeros accesos son lentos.
      Si cada proceso corre un quantum \(q\) y el cambio completo cuesta \(c\), la fracción útil de la CPU es</p>
      \[ \eta = \frac{q}{q + c}. \]
      <p>Con \(q = 10\) ms y \(c = 10\) µs, \(\eta \approx 99{,}9\) %; con \(q = 50\) µs, solo 83 %. Los hilos de un mismo proceso comparten espacio de direcciones y su cambio es más barato (ver
      <a href="tema.html?id=threads-models">modelos de hilos</a>). La elección del quantum se estudia en <a href="tema.html?id=round-robin-srtf">Round Robin</a>.</p>`,
  });
})();
