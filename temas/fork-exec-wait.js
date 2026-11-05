(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarArbol(cuerpo) {
    let n = 3, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Llamadas consecutivas a fork()', min: 0, max: 4, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + 2 ** 4 * 17 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'proceso original', forma: 'linea' }, { color: C.s1, texto: 'hijo creado por la llamada k', forma: 'linea' }, { color: C.s2, texto: 'fork() que creó al hijo', forma: 'punto' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Código: fork(); fork(); … (n veces). Cada llamada la ejecutan todos los procesos vivos, por eso el número de procesos se duplica. Pase el cursor sobre una línea.');
    let filas = [];
    function construir() {
      let lista = [{ nace: 0, etiq: 'P', padre: null }];
      for (let k = 1; k <= n; k++) {
        const nueva = [];
        for (const p of lista) { nueva.push(p); nueva.push({ nace: k, etiq: p.etiq + '.' + k, padre: p }); }
        lista = nueva;
      }
      return lista;
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      filas = construir();
      const izq = 50, der = 14, dx = (W - izq - der) / (n + 1), dy = 17;
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      for (let k = 0; k <= n; k++) { ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.fillText(k ? `fork ${k}` : 'inicio', izq + k * dx, 10); }
      const y = (p) => 30 + filas.indexOf(p) * dy;
      for (const p of filas) {
        ctx.strokeStyle = p.nace ? C.s1 : C.tinta; ctx.lineWidth = hover === p ? 4 : 2.5;
        ctx.beginPath(); ctx.moveTo(izq + p.nace * dx, y(p)); ctx.lineTo(izq + (n + 0.7) * dx, y(p)); ctx.stroke();
        if (p.padre) {
          ctx.strokeStyle = C.s2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(izq + p.nace * dx, y(p.padre)); ctx.lineTo(izq + p.nace * dx, y(p)); ctx.stroke();
          ctx.fillStyle = C.s2; ctx.beginPath(); ctx.arc(izq + p.nace * dx, y(p.padre), 3.5, 0, 7); ctx.fill();
        }
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(p.etiq.length > 7 ? '…' + p.etiq.slice(-6) : p.etiq, izq - 6, y(p));
      }
      lectura.set([['procesos al final', String(2 ** n)], ['hijos creados', String(2 ** n - 1)], ['forks ejecutados en total', String(2 ** n - 1)], ['fórmula', `2^${n} = ${2 ** n}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = Math.round((y - 30) / 17);
      hover = filas[i] || null; dibujar();
      if (hover) tip.mostrar(x, y, `proceso <b>${hover.etiq}</b><br>${hover.padre ? 'hijo de ' + hover.padre.etiq : 'proceso original'}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  function montarShell(cuerpo) {
    let k = 0, modo = 'espera';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'El shell ejecuta', opciones: [['espera', 'ls (primer plano: wait)'], ['fondo', 'ls & (segundo plano: sin wait)']], valor: modo, alCambiar: (v) => { modo = v; lienzo.ajustar(true); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => VIZ.sor.altoSecuencia(msgs()) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'shell (padre)' }, { color: C.s2, texto: 'hijo' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Este patrón (fork, exec en el hijo, wait en el padre) es el que usa cualquier shell para lanzar un programa.');
    function msgs() { return [
      { de: 0, a: 2, texto: 'fork()', color: C.s1, nota: 'crea el PCB del hijo' },
      { de: 2, a: 0, texto: 'devuelve pid_hijo', color: C.s1 },
      { de: 2, a: 1, texto: 'devuelve 0', color: C.s2, punteado: true, nota: 'el hijo es copia del padre' },
      { de: 1, a: 2, texto: 'execve("ls")', color: C.s2, nota: 'reemplaza su imagen' },
      ...(modo === 'espera' ? [{ de: 0, a: 2, texto: 'wait()', color: C.s1, nota: 'el padre se bloquea' }] : [{ de: 0, a: 0, texto: 'sigue sin esperar', color: C.s1 }]),
      { de: 1, a: 2, texto: 'exit(0)', color: C.s2, nota: modo === 'espera' ? 'el hijo termina' : 'termina; queda zombi hasta que se lea' },
      ...(modo === 'espera' ? [{ de: 2, a: 0, texto: 'wait devuelve (pid, 0)', color: C.s1, nota: 'el padre despierta' }] : []),
    ]; }
    const TXT = [
      'El shell llama a fork(): el núcleo duplica el proceso (PCB y espacio de direcciones, con copia perezosa).',
      'En el padre fork() devuelve el pid del hijo.',
      'En el hijo, fork() devuelve 0: así cada uno sabe quién es.',
      'El hijo llama a execve("ls"): se reemplaza su memoria por el programa ls; el pid se conserva.',
      modo === 'espera' ? 'El padre llama a wait(): se bloquea hasta que el hijo termine.' : 'Con «&» el padre no espera: vuelve al prompt de inmediato.',
      modo === 'espera' ? 'El hijo termina con exit(0).' : 'El hijo termina con exit(0); sin wait, queda como proceso zombi hasta que el padre recoja su código.',
      'wait devuelve el pid y el estado de salida: el núcleo libera por completo el PCB del hijo.',
    ];
    function iniciar() { k = 0; return (function* () { for (let j = 1; j <= msgs().length; j++) { k = j; yield; } })(); }
    function dibujar() {
      const m = msgs();
      lienzo.limpiar();
      VIZ.sor.secuencia(lienzo, ['Shell (padre)', 'Hijo', 'Núcleo'], m, k);
      registro.textContent = k ? TXT[k - 1] : 'Pulse «Un paso» para comenzar.';
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('fork-exec-wait', {
    intro: String.raw`
      <p>En Unix, los procesos nacen de otros procesos. <code>fork()</code> crea un <strong>hijo</strong> que es una copia casi exacta del <strong>padre</strong>; <code>exec()</code> reemplaza el programa del proceso por otro;
      <code>wait()</code> hace que el padre espere a que el hijo termine y recoja su resultado. La combinación de las tres es la forma de lanzar cualquier programa.</p>
      <p>Así se forma una <strong>jerarquía de procesos</strong>: un árbol cuya raíz (init o systemd) es el primero que arranca el sistema.</p>`,
    visualizaciones: [
      { titulo: 'Árbol de procesos creado por fork', descripcion: 'Aumente el número de fork() consecutivos y cuente los procesos. Pase el cursor por una línea para ver de quién desciende.', montar: montarArbol },
      { titulo: 'Cómo un shell lanza un programa', descripcion: 'Recorra la secuencia fork, exec, wait. Cambie a segundo plano para ver qué ocurre cuando el padre no espera.', montar: montarShell },
    ],
    teoria: String.raw`
      <h2>Las tres llamadas</h2>
      <pre><code>pid ← fork()
si pid = 0:                 # hijo
    execve("/bin/ls", args)  # no vuelve si tiene éxito
    exit(1)                  # solo si exec falló
si no:                      # padre
    wait(&amp;estado)            # bloquea hasta que termine el hijo</code></pre>
      <p><code>fork</code> devuelve dos veces: 0 en el hijo y el pid del hijo en el padre. El hijo hereda archivos abiertos (por eso funcionan las redirecciones y las <a href="tema.html?id=ipc-mechanisms">tuberías</a>
      del shell: se preparan entre fork y exec), pero su memoria es independiente (copia al escribir).</p>
      <h2>Terminación</h2>
      <ul><li><strong>Zombi</strong>: hijo terminado cuyo padre aún no ha hecho <code>wait</code>; solo ocupa su entrada de PCB.</li>
      <li><strong>Huérfano</strong>: hijo cuyo padre terminó antes; el proceso raíz lo adopta y recoge su estado.</li></ul>
      <h2>Cuántos procesos hay</h2>
      <p>Si \(n\) llamadas a <code>fork()</code> se ejecutan una tras otra sin condiciones, cada proceso vivo ejecuta cada llamada, por lo que el número de procesos se duplica:</p>
      \[ N_k = 2 N_{k-1}, \quad N_0 = 1 \;\Rightarrow\; N_n = 2^n, \]
      <p>y se han creado \(2^n - 1\) hijos. Un <em>fork bomb</em> usa este crecimiento exponencial para agotar la tabla de procesos; el sistema se protege con límites por usuario.</p>
      <p>Cada proceso pasa por los estados de <a href="tema.html?id=process-states-pcb">la figura de estados</a>; que el hijo comience con un PCB copiado explica por qué crear procesos es más caro que crear hilos
      (<a href="tema.html?id=threads-models">hilos</a>).</p>`,
  });
})();
