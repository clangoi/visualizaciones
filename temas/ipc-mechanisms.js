(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarTuberia(cuerpo) {
    const CAP = 16;
    let buf, nesc = 4, nlee = 3, escr, lect, msg, prox;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Bytes por escritura', min: 1, max: 16, valor: nesc, alCambiar: (v) => { nesc = v; } });
    ctl.rango({ etiqueta: 'Bytes por lectura', min: 1, max: 16, valor: nlee, alCambiar: (v) => { nlee = v; } });
    ctl.boton('Escribir (productor)', () => escribir(), { primario: true });
    ctl.boton('Leer (consumidor)', () => leer());
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'byte escrito, sin leer' }, { color: C.rejilla, texto: 'espacio libre' }, { color: C.s4, texto: 'proceso bloqueado', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La tubería es un búfer circular de 16 bytes. Escriba hasta llenarla: el productor se bloquea. Lea hasta vaciarla: el consumidor se bloquea.');
    function reiniciar() { buf = []; escr = false; lect = false; msg = 'Tubería vacía (pipe en Unix: cat archivo | grep palabra).'; prox = 0; dibujar(); }
    function escribir() {
      const libre = CAP - buf.length;
      if (!libre) { escr = true; msg = 'write() bloquea al productor: la tubería está llena hasta que alguien lea.'; return dibujar(); }
      const k = Math.min(libre, nesc);
      for (let i = 0; i < k; i++) buf.push(prox++ % 26);
      escr = k < nesc; lect = false;
      msg = k < nesc ? `write(${nesc}) escribe solo ${k} bytes y el productor queda bloqueado esperando espacio para el resto.` : `write(${nesc}): ${k} bytes entran en la tubería.`; dibujar();
    }
    function leer() {
      if (!buf.length) { lect = true; msg = 'read() bloquea al consumidor: la tubería está vacía hasta que alguien escriba.'; return dibujar(); }
      const k = Math.min(buf.length, nlee); buf.splice(0, k); lect = false; escr = false;
      msg = `read(${nlee}) devuelve ${k} bytes (el orden es FIFO).`; dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 70, w = W - 140, cw = w / CAP, y = 56;
      for (let i = 0; i < CAP; i++) {
        ctx.fillStyle = i < buf.length ? C.s1 : C.rejilla; ctx.fillRect(x0 + i * cw + 1, y, cw - 2, 34);
        if (i < buf.length) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String.fromCharCode(97 + buf[i]), x0 + i * cw + cw / 2, y + 17); }
      }
      ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [['productor', 10, escr], ['consumidor', W - 62, lect]].forEach(([t, x, b]) => {
        ctx.strokeStyle = b ? C.s4 : C.tinta; ctx.lineWidth = b ? 3 : 1.5; ctx.strokeRect(x - 8 + 0, y - 4, 60, 42);
        ctx.fillStyle = C.tinta; ctx.fillText(t, x + 22, y + 17, 56);
      });
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.fillText('extremo de lectura ◂', x0 + w - 62, y - 14); ctx.fillText('▸ extremo de escritura', x0 + 70, y - 14);
      registro.textContent = msg;
      lectura.set([['ocupado', `${buf.length} de ${CAP} bytes`], ['libre', String(CAP - buf.length)], ['estado', escr ? 'productor bloqueado' : lect ? 'consumidor bloqueado' : 'ambos activos']]);
    }
    lienzo.alDibujar = () => buf && dibujar();
    reiniciar();
  }

  function montarCosto(cuerpo) {
    let hover = null, sync = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Sincronizaciones por transferencia', min: 1, max: 10, valor: sync, alCambiar: (v) => { sync = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'paso de mensajes (2 llamadas + 2 copias)', forma: 'linea' }, { color: C.s2, texto: 'memoria compartida (sincronizar, 0 copias)', forma: 'linea' }]);
    VIZ.nota(cuerpo, 'Modelo: llamada al sistema 1 µs, copia 0,25 µs por KB. Los mensajes grandes cuestan sobre todo en copias; la memoria compartida paga solo la sincronización.');
    const msg = (kb) => 2 * 1 + 2 * 0.25 * kb, shm = () => sync * 1; // µs
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 64, ymin: 0, ymax: 34 }, { etiquetaX: 'tamaño del mensaje (KB)', etiquetaY: 'tiempo (µs)' });
      plano.ejes();
      VIZ.trazar(lienzo.ctx, plano, [[0, msg(0)], [64, msg(64)]], C.s1, 2);
      VIZ.trazar(lienzo.ctx, plano, [[0, shm()], [64, shm()]], C.s2, 2);
      if (hover != null) { VIZ.marcador(ctx, plano.sx(hover), plano.sy(msg(hover)), C.s1, 4); VIZ.marcador(ctx, plano.sx(hover), plano.sy(shm()), C.s2, 4); }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.round(plano.ix(x) * 2) / 2; dibujar();
      tip.mostrar(x, y, `<b>${hover}</b> KB` + VIZ.filaTooltip(C.s1, 'mensajes', VIZ.fmt(msg(hover), 3) + ' µs') + VIZ.filaTooltip(C.s2, 'memoria compartida', VIZ.fmt(shm(), 3) + ' µs'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('ipc-mechanisms', {
    intro: String.raw`
      <p>Los procesos están aislados a propósito, pero muchas veces deben cooperar. La <strong>comunicación entre procesos</strong> (IPC) ofrece al menos dos caminos: <strong>pasar mensajes</strong>
      (el núcleo copia los datos de un proceso a otro, como en tuberías y colas) o <strong>compartir memoria</strong> (ambos ven la misma región y ellos se coordinan).</p>
      <p>Las dos exigen sincronización: sin ella, el consumidor leería antes de que el productor escriba, o ambos pisarían los mismos datos.</p>`,
    visualizaciones: [
      { titulo: 'Una tubería (pipe) con búfer acotado', descripcion: 'Escriba y lea con distintos tamaños. Llene la tubería para bloquear al productor y vacíela para bloquear al consumidor.', montar: montarTuberia },
      { titulo: 'Mensajes frente a memoria compartida', descripcion: 'Compare el costo por transferencia según el tamaño. Observe a partir de qué tamaño conviene compartir memoria.', montar: montarCosto },
    ],
    teoria: String.raw`
      <h2>Mecanismos</h2>
      <table class="tabla-datos"><tr><th class="izq">Mecanismo</th><th class="izq">Idea</th><th class="izq">Sincronización</th></tr>
      <tr><td class="izq">Tubería</td><td class="izq">flujo de bytes FIFO entre procesos emparentados (<code>a | b</code>)</td><td class="izq">implícita: write/read bloquean</td></tr>
      <tr><td class="izq">Cola de mensajes</td><td class="izq">mensajes delimitados, con tipo</td><td class="izq">implícita</td></tr>
      <tr><td class="izq">Memoria compartida</td><td class="izq">región mapeada en ambos espacios de direcciones</td><td class="izq">explícita: <a href="tema.html?id=semaphores">semáforos</a> o locks</td></tr>
      <tr><td class="izq">Socket</td><td class="izq">como la tubería, pero también entre máquinas (ver <a href="tema.html?id=sockets-client-server">sockets</a>)</td><td class="izq">implícita</td></tr>
      <tr><td class="izq">Señales</td><td class="izq">aviso asíncrono sin datos</td><td class="izq">—</td></tr></table>
      <h2>Costos</h2>
      <p>Enviar un mensaje de \(s\) KB involucra una llamada para enviar y otra para recibir (\(2c\)) y dos copias (usuario→núcleo, núcleo→usuario):</p>
      \[ T_{\text{msg}}(s) = 2c + 2\,b\,s, \qquad T_{\text{shm}} = m\,c, \]
      <p>donde \(b\) es el costo de copiar un KB y \(m\) el número de sincronizaciones. La memoria compartida gana cuando \(2bs > (m-2)c\), pero deja al programador la tarea de evitar
      <a href="tema.html?id=race-conditions">condiciones de carrera</a>.</p>
      <h2>Tuberías y bloqueo</h2>
      <p>Una tubería es un <a href="tema.html?id=bounded-buffer-condvars">buffer acotado</a>: <code>write</code> bloquea si está llena y <code>read</code> si está vacía. Si se cierra el extremo de escritura, <code>read</code> devuelve 0 (fin de archivo).
      Sin ese cierre, un lector esperaría para siempre.</p>`,
  });
})();
