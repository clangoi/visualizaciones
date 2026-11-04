(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const ESTADOS = ['Nuevo', 'Listo', 'Ejecución', 'Bloqueado', 'Terminado'];
  const COLOR = [C.inactivo, C.s4, C.s6, C.s2, C.tinta];
  // Transiciones: nombre del botón → [desde, hacia, explicación]
  const EVENTOS = [
    ['Admitir', 0, 1, 'el núcleo crea el PCB y lo pone en la cola de listos'],
    ['Despachar', 1, 2, 'el planificador le asigna la CPU'],
    ['Fin del quantum', 2, 1, 'la interrupción del reloj le quita la CPU'],
    ['Pedir E/S', 2, 3, 'espera un evento (disco, red, semáforo)'],
    ['Termina la E/S', 3, 1, 'el evento ocurrió y vuelve a la cola de listos'],
    ['Terminar', 2, 4, 'llama a exit y libera sus recursos'],
  ];
  const POS = [[0.1, 0.5], [0.35, 0.18], [0.65, 0.18], [0.65, 0.82], [0.9, 0.5]];

  function montarEstados(cuerpo) {
    let proc, sel, msg, pidSig;
    const ctl = VIZ.controles(cuerpo);
    EVENTOS.forEach(([nom, d, h, expl], i) => ctl.boton(nom, () => aplicar(i), { primario: i === 1 }));
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 250 : 270) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ESTADOS.map((e, i) => ({ color: COLOR[i], texto: e.toLowerCase() })));
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un proceso para seleccionarlo (borde grueso) y luego pulse un evento. Solo un proceso puede estar en Ejecución a la vez.');
    function reiniciar() {
      proc = ['A', 'B', 'C', 'D'].map((n, i) => ({ n, pid: 100 + i, est: 0, pc: 0x1000 + 0x40 * i, cpu: 0 }));
      sel = 0; msg = 'Cuatro procesos recién creados. Seleccione uno y pulse «Admitir».'; dibujar();
    }
    function aplicar(i) {
      const [nom, d, h, expl] = EVENTOS[i], p = proc[sel];
      if (p.est !== d) { msg = `«${nom}» no es posible: ${p.n} está ${ESTADOS[p.est].toLowerCase()} y esta transición parte de ${ESTADOS[d].toLowerCase()}.`; return dibujar(); }
      if (h === 2 && proc.some((q) => q.est === 2)) { msg = 'La CPU ya está ocupada: un solo proceso en Ejecución (un núcleo).'; return dibujar(); }
      p.est = h; if (h === 2) p.cpu++; p.pc += 4 * (1 + sel);
      msg = `${p.n}: ${ESTADOS[d]} → ${ESTADOS[h]} (${expl}).`; dibujar();
    }
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const r = Math.min(48, W / 9), pts = POS.map(([x, y]) => [x * (W - 2 * r - 10) + r + 5, y * (H - 2 * r - 20) + r + 10]);
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje; ctx.fillStyle = C.eje;
      for (const [, d, h] of EVENTOS) {
        const [x0, y0] = pts[d], [x1, y1] = pts[h], a = Math.atan2(y1 - y0, x1 - x0);
        const off = (d === 2 && h === 1) || (d === 3 && h === 1) ? 5 : 0, nx = -Math.sin(a) * off, ny = Math.cos(a) * off;
        ctx.beginPath(); ctx.moveTo(x0 + Math.cos(a) * r + nx, y0 + Math.sin(a) * r + ny); ctx.lineTo(x1 - Math.cos(a) * (r + 7) + nx, y1 - Math.sin(a) * (r + 7) + ny); ctx.stroke();
        const ex = x1 - Math.cos(a) * r + nx, ey = y1 - Math.sin(a) * r + ny;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 9 * Math.cos(a - 0.4), ey - 9 * Math.sin(a - 0.4)); ctx.lineTo(ex - 9 * Math.cos(a + 0.4), ey - 9 * Math.sin(a + 0.4)); ctx.fill();
      }
      geo = [];
      ESTADOS.forEach((e, i) => {
        const [x, y] = pts[i];
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = COLOR[i]; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y - r + 13);
        const aqui = proc.filter((p) => p.est === i);
        aqui.forEach((p, j) => {
          const px = x + (j - (aqui.length - 1) / 2) * 24, py = y + 8;
          ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.fillStyle = COLOR[i]; ctx.fill();
          if (proc[sel] === p) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.stroke(); }
          ctx.fillStyle = i === 4 || i === 0 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(11, 700); ctx.fillText(p.n, px, py + 0.5);
          geo.push({ x: px, y: py, p });
        });
      });
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, ['pid', 'nombre', 'estado', 'contador de programa', 'veces en CPU'].map((t, i) => el('th', { class: i === 2 ? 'izq' : '' }, t))),
        proc.map((p, i) => el('tr', null, el('td', null, String(p.pid)), el('td', null, p.n + (i === sel ? ' ◂' : '')), el('td', { class: 'izq' }, ESTADOS[p.est]), el('td', null, '0x' + p.pc.toString(16)), el('td', null, String(p.cpu))))));
      registro.textContent = msg;
    }
    lienzo.alDibujar = () => proc && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.hypot(q.x - x, q.y - y) < 14);
      if (g) { sel = proc.indexOf(g.p); msg = `Seleccionado ${g.p.n} (${ESTADOS[g.p.est].toLowerCase()}).`; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => Math.hypot(q.x - x, q.y - y) < 14);
      if (g) tip.mostrar(x, y, `<b>${g.p.n}</b> · pid ${g.p.pid}<br>${ESTADOS[g.p.est]}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    reiniciar();
  }

  VIZ.registrarTema('process-states-pcb', {
    intro: String.raw`
      <p>Un <strong>programa</strong> es un archivo con instrucciones; un <strong>proceso</strong> es ese programa en ejecución, con su memoria, sus archivos abiertos y su estado en la CPU.
      Un mismo programa puede dar lugar a muchos procesos a la vez.</p>
      <p>El núcleo registra cada proceso en un <strong>bloque de control de proceso</strong> (PCB) y lo hace pasar por unos pocos <strong>estados</strong>: puede estar listo para correr, corriendo
      o bloqueado esperando algo. Casi toda la administración del sistema es mover PCBs de una cola a otra.</p>`,
    visualizaciones: [
      { titulo: 'Diagrama de estados de un proceso', descripcion: 'Seleccione un proceso y aplique eventos. Pruebe una transición imposible (por ejemplo, despachar a uno bloqueado) y ocupar la CPU con dos procesos.', montar: montarEstados },
    ],
    teoria: String.raw`
      <h2>Estados y transiciones</h2>
      <table class="tabla-datos"><tr><th class="izq">Estado</th><th class="izq">Significado</th></tr>
      <tr><td class="izq">Nuevo</td><td class="izq">se está creando</td></tr>
      <tr><td class="izq">Listo</td><td class="izq">puede ejecutarse; espera la CPU en la cola de listos</td></tr>
      <tr><td class="izq">Ejecución</td><td class="izq">tiene la CPU (a lo más uno por núcleo)</td></tr>
      <tr><td class="izq">Bloqueado</td><td class="izq">espera un evento; no compite por la CPU</td></tr>
      <tr><td class="izq">Terminado</td><td class="izq">acabó, pero su PCB persiste hasta que el padre lea su código de salida (zombi)</td></tr></table>
      <p>Las transiciones <em>Ejecución → Listo</em> (quitar la CPU) existen solo en sistemas <strong>apropiativos</strong>; en uno no apropiativo un proceso deja la CPU únicamente al bloquearse o terminar.
      El <a href="tema.html?id=fcfs-sjf">planificador</a> decide quién pasa de Listo a Ejecución.</p>
      <h2>El PCB</h2>
      <pre><code>struct PCB {
    pid, pid_padre, estado, prioridad
    contador_de_programa, registros          # para el cambio de contexto
    tabla_de_páginas, límites de memoria     # espacio de direcciones
    archivos_abiertos[], señales, usuario
    contabilidad: tiempo de CPU, tiempo de pared
}</code></pre>
      <p>Guardar y restaurar estos campos es el <a href="tema.html?id=context-switch">cambio de contexto</a>. Cada proceso tiene su propio espacio de direcciones, de modo que un error en uno no daña a otro:
      el aislamiento lo hace cumplir el hardware de <a href="tema.html?id=paging-address-translation">memoria virtual</a>.</p>
      <h2>Conservación</h2>
      <p>Con \(n\) procesos vivos y \(k\) núcleos, en todo momento \(\#\text{Ejecución} \le k\) y \(\#\text{Listo} + \#\text{Ejecución} + \#\text{Bloqueado} = n\).</p>`,
  });
})();
