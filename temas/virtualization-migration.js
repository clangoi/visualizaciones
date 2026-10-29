(function () {
  'use strict';
  const { color: C } = VIZ;
  const LADO = 16, M = LADO * LADO; // 256 páginas

  /* Precopia (Clark et al., 2005): ronda 1 copia todo; cada ronda siguiente copia lo que se ensució durante la anterior.
     Las escrituras caen sobre un conjunto «caliente» de páginas. Cuando quedan pocas sucias (o se agotan las rondas), se detiene la VM y se copia el resto. */
  function simular(B, d, caliente, umbral, maxRondas, semilla) {
    const rnd = VIZ.semilla(semilla);
    const calientes = [];
    while (calientes.length < caliente) { const p = Math.floor(rnd() * M); if (!calientes.includes(p)) calientes.push(p); }
    const rondas = [];
    let enviar = Array.from({ length: M }, (_, i) => i), t = 0, total = 0;
    for (let r = 1; r <= maxRondas; r++) {
      const dur = enviar.length / B;
      const sucias = new Set();
      const escrituras = Math.round(d * dur);
      for (let k = 0; k < escrituras; k++) sucias.add(calientes[Math.floor(rnd() * calientes.length)]);
      rondas.push({ r, envia: enviar.slice(), sucias: [...sucias], t0: t, dur, parada: false });
      t += dur; total += enviar.length;
      enviar = [...sucias];
      if (enviar.length <= umbral) break;
    }
    const downtime = enviar.length / B;
    rondas.push({ r: rondas.length + 1, envia: enviar.slice(), sucias: [], t0: t, dur: downtime, parada: true });
    total += enviar.length; t += downtime;
    return { rondas, total, tiempo: t, downtime, calientes };
  }

  function montar(cuerpo) {
    const est = { B: 64, d: 24, caliente: 40, umbral: 8, semilla: 2 };
    let sim, k = 0, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ancho de banda (páginas/s)', min: 16, max: 128, paso: 8, valor: est.B, alCambiar: (v) => { est.B = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Escrituras de la VM (por s)', min: 0, max: 160, paso: 4, valor: est.d, alCambiar: (v) => { est.d = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Páginas que se escriben (conjunto caliente)', min: 4, max: 160, paso: 4, valor: est.caliente, alCambiar: (v) => { est.caliente = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Detener con ≤ páginas sucias', min: 0, max: 64, paso: 2, valor: est.umbral, alCambiar: (v) => { est.umbral = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 420 : 260) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'aún no copiada' }, { color: C.s1, texto: 'se copia en esta ronda' },
      { color: C.s6, texto: 'copia al día en el destino' }, { color: C.s2, texto: 'ensuciada durante la ronda' },
      { color: C.s8, texto: 'copiada con la VM detenida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La VM tiene 256 páginas. A la derecha, páginas enviadas en cada ronda. Pase el cursor por una barra.');

    function iniciar() {
      sim = simular(est.B, est.d, est.caliente, est.umbral, 30, est.semilla);
      k = 0;
      return (function* () { for (k = 1; k <= sim.rondas.length; k++) yield; k = sim.rondas.length; })();
    }

    let geoBarras = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const lado = angosto ? Math.min(W - 20, 240) : Math.min(H - 20, 240);
      const cel = lado / LADO, ox = angosto ? (W - lado) / 2 : 10, oy = 10;
      // Estado de cada página al terminar la ronda k.
      const estado = new Array(M).fill('nueva');
      for (let j = 0; j < Math.min(k, sim.rondas.length); j++) {
        const ro = sim.rondas[j];
        for (const p of ro.envia) estado[p] = ro.parada ? 'parada' : 'ok';
        for (const p of ro.sucias) estado[p] = 'sucia';
      }
      const actual = k > 0 ? sim.rondas[k - 1] : null;
      const enviaAhora = new Set(actual ? actual.envia : []);
      const COL = { nueva: C.inactivo, ok: C.s6, sucia: C.s2, parada: C.s8 };
      for (let p = 0; p < M; p++) {
        const x = ox + (p % LADO) * cel, y = oy + Math.floor(p / LADO) * cel;
        ctx.fillStyle = COL[estado[p]];
        ctx.fillRect(x + 0.5, y + 0.5, cel - 1, cel - 1);
        if (enviaAhora.has(p) && estado[p] !== 'sucia' && !actual.parada) { ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, cel - 2, cel - 2); }
      }
      // Barras por ronda.
      const bx0 = angosto ? 40 : ox + lado + 60, by0 = angosto ? oy + lado + 20 : oy, bw = W - bx0 - 12, bh = angosto ? H - by0 - 30 : H - 40;
      const n = sim.rondas.length, ancho = Math.min(36, bw / n - 3);
      geoBarras = { bx0, by0, bh, ancho, n };
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx0, by0 + bh + 0.5); ctx.lineTo(bx0 + bw, by0 + bh + 0.5); ctx.stroke();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('256', bx0 - 6, by0); ctx.fillText('0', bx0 - 6, by0 + bh);
      sim.rondas.forEach((ro, j) => {
        const h = (ro.envia.length / M) * bh, x = bx0 + 4 + j * (ancho + 3);
        ctx.fillStyle = j < k ? (ro.parada ? C.s8 : C.s1) : C.tenue;
        if (hover >= 0 && hover !== j) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.5);
        ctx.beginPath(); ctx.roundRect(x, by0 + bh - h, ancho, h, [3, 3, 0, 0]); ctx.fill();
        if (ancho > 14) { ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.fillText(ro.parada ? 'stop' : String(ro.r), x + ancho / 2, by0 + bh + 10); }
      });
      const stop = M / est.B;
      if (!actual) registro.textContent = 'La VM sigue corriendo en el origen mientras se copia su memoria al destino.';
      else if (actual.parada) registro.textContent = `Se detiene la VM y se copian las ${actual.envia.length} páginas que quedaban sucias: ${VIZ.fmt(sim.downtime * 1000, 3)} ms sin servicio, frente a ${VIZ.fmt(stop * 1000, 3)} ms si se detuviera desde el principio.`;
      else registro.textContent = `Ronda ${actual.r}: se copian ${actual.envia.length} páginas en ${VIZ.fmt(actual.dur, 3)} s; mientras tanto la VM ensucia ${actual.sucias.length}.` +
        (est.d >= est.B ? ' La VM escribe más rápido de lo que la red copia: las rondas no convergen.' : '');
      lectura.set([
        ['ronda', `${Math.min(k, n)} de ${n}`],
        ['páginas enviadas', String(sim.rondas.slice(0, k).reduce((s, r) => s + r.envia.length, 0))],
        ['tiempo total', `${VIZ.fmt(sim.tiempo, 3)} s`],
        ['detención (precopia)', `${VIZ.fmt(sim.downtime * 1000, 3)} ms`],
        ['detención (detener y copiar)', `${VIZ.fmt(stop * 1000, 4)} ms`],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geoBarras) return;
      const { x, y } = lienzo.posicion(ev);
      const j = Math.floor((x - geoBarras.bx0 - 4) / (geoBarras.ancho + 3));
      if (j < 0 || j >= geoBarras.n || y < geoBarras.by0 || y > geoBarras.by0 + geoBarras.bh + 12) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      hover = j; dibujar();
      const ro = sim.rondas[j];
      tip.mostrar(x, y, `${ro.parada ? '<b>detener y copiar</b>' : `ronda <b>${ro.r}</b>`}<br>páginas <b>${ro.envia.length}</b><br>duración <b>${VIZ.fmt(ro.dur, 3)} s</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (sim) dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('virtualization-migration', {
    intro: String.raw`
      <p>Una <strong>máquina virtual</strong> (VM) es un computador completo simulado por software: un <em>hipervisor</em> reparte la CPU, la memoria y los
      dispositivos de una máquina física entre varias VMs aisladas. En la nube, la virtualización permite consolidar servidores, aislar clientes y, sobre
      todo, <strong>mover</strong> cargas de trabajo entre máquinas físicas.</p>
      <p><strong>Migrar</strong> un proceso o una VM sirve para equilibrar la carga, liberar una máquina para mantención o acercar el cómputo a los datos.
      La dificultad es la memoria: copiar varios gigabytes toma segundos, y la VM no puede estar detenida tanto tiempo. La <strong>migración en vivo</strong>
      copia la memoria mientras la VM sigue corriendo y solo la detiene un instante al final.</p>`,
    visualizaciones: [
      {
        titulo: 'Migración en vivo por precopia',
        descripcion: 'Avance ronda a ronda: cada ronda copia lo que se ensució en la anterior, y la cantidad decrece si la red es más rápida que las escrituras. Suba las escrituras por encima del ancho de banda: la precopia deja de converger.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Virtualización</h2>
      <table>
        <tr><th>Tipo</th><th>Descripción</th><th>Ejemplos</th></tr>
        <tr><td>Hipervisor tipo 1</td><td>Corre directamente sobre el hardware</td><td>Xen, KVM, VMware ESXi</td></tr>
        <tr><td>Hipervisor tipo 2</td><td>Corre como aplicación sobre un sistema operativo</td><td>VirtualBox, VMware Workstation</td></tr>
        <tr><td>Paravirtualización</td><td>El sistema invitado sabe que está virtualizado y llama al hipervisor</td><td>Xen PV, drivers virtio</td></tr>
        <tr><td>Contenedores</td><td>Comparten el núcleo; aíslan procesos con espacios de nombres</td><td>Docker, LXC</td></tr>
      </table>

      <h2>Migración de procesos</h2>
      <p>Un proceso en ejecución tiene tres partes: <strong>código</strong>, <strong>recursos</strong> (archivos, conexiones) y <strong>estado de ejecución</strong>
      (pila, registros). La <em>movilidad débil</em> mueve solo el código y los datos de inicio (applets, código móvil); la <em>movilidad fuerte</em> mueve también el
      estado de ejecución, y el proceso continúa donde estaba. Las referencias a recursos se resuelven moviéndolos, copiándolos o dejando referencias remotas.
      Migrar una VM completa evita el problema de los recursos locales: todo el sistema operativo viaja con ella.</p>

      <h2>Precopia</h2>
      <p>Con memoria de \(M\) páginas, ancho de banda \(B\) y tasa de escritura \(d\) (páginas distintas ensuciadas por segundo, suponiendo que no se repiten), la ronda
      \(i\) copia \(V_i\) páginas en \(V_i / B\) segundos, durante los cuales se ensucian \(V_{i+1} = d\,V_i / B\):</p>
      \[ V_i = M \rho^{\,i-1}, \qquad \rho = \frac{d}{B}, \qquad \text{total} \approx \frac{M}{1-\rho}. \]
      <p>Si \(\rho &lt; 1\) la serie converge y el tiempo detenido se reduce a \(V_n/B\); si \(\rho \ge 1\) no converge y hay que forzar la parada. En la práctica las escrituras
      se concentran en un <em>conjunto caliente</em> de páginas que se reescriben una y otra vez: después de unas rondas solo queda ese conjunto, que se copia con la VM
      detenida (decenas o cientos de milisegundos en Xen).</p>

      <h2>Alternativas</h2>
      <ul>
        <li><strong>Detener y copiar:</strong> tiempo detenido \(M/B\), pero cada página se copia una sola vez.</li>
        <li><strong>Poscopia:</strong> se mueve primero el estado de CPU y la VM sigue en el destino; las páginas que faltan se traen bajo demanda (fallas de página por la red).
        Cada página viaja una vez, pero la VM corre lenta al principio y depende del origen hasta terminar.</li>
      </ul>
      <p>La migración es una herramienta de <a href="tema.html?id=scalability-load-balancing">balanceo de carga</a> y de tolerancia a fallas planificadas.</p>`,
  });
})();
