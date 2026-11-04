(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: ejecución de varias peticiones en un hilo ---------- */

  function montarLineaTiempo(cuerpo) {
    const est = { n: 4, modo: 'bloq', io: 100, cpu: 10 };
    let filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Manejo de la E/S', valor: est.modo, opciones: [['bloq', 'bloqueante (readFileSync)'], ['no', 'no bloqueante (async)'], ['hilos', 'un hilo por petición']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Peticiones simultáneas', min: 1, max: 8, valor: est.n, alCambiar: (v) => { est.n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Espera de E/S por petición', min: 20, max: 300, paso: 10, valor: est.io, formato: (v) => `${v} ms`, alCambiar: (v) => { est.io = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 22 + 8 * 24 + 26 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'CPU (trabajo en JavaScript)' }, { color: C.s4, texto: 'espera de E/S (el hilo está ocupado)' }, { color: C.eje, texto: 'espera de E/S (el hilo está libre)' }, { color: C.s8, texto: 'en cola, sin atender' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada petición hace 10 ms de CPU, espera la E/S y hace 10 ms más de CPU. Con E/S bloqueante el hilo se queda parado esperando; con E/S no bloqueante atiende a otra petición mientras tanto.');
    function planificar() {
      const { n, io, cpu } = est, fs = [];
      if (est.modo === 'bloq') { let t = 0; for (let i = 0; i < n; i++) { fs.push({ espera: [0, t], c1: [t, t + cpu], io: [t + cpu, t + cpu + io, true], c2: [t + cpu + io, t + 2 * cpu + io] }); t += 2 * cpu + io; } } else if (est.modo === 'hilos') { for (let i = 0; i < n; i++) fs.push({ espera: [0, 0], c1: [i * 1, i * 1 + cpu], io: [i + cpu, i + cpu + io, false], c2: [i + cpu + io, i + 2 * cpu + io] }); } else {
        // Un solo hilo de CPU: atiende las partes de CPU en orden de llegada; la E/S ocurre fuera del hilo.
        let libre = 0; const tareas = [];
        for (let i = 0; i < n; i++) { const ini = libre; libre += cpu; fs.push({ espera: [0, ini], c1: [ini, ini + cpu], io: [ini + cpu, ini + cpu + io, false], c2: null }); tareas.push({ i, listo: ini + cpu + io }); }
        tareas.sort((a, b) => a.listo - b.listo).forEach((q) => { const ini = Math.max(libre, q.listo); fs[q.i].c2 = [ini, ini + cpu]; libre = ini + cpu; });
      }
      return fs;
    }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      filas = planificar();
      const total = Math.max(...filas.map((f) => f.c2[1])), esc = (ms) => 40 + (ms / total) * (Wd - 50);
      filas.forEach((f, i) => {
        const y = 10 + i * 24;
        W.texto(ctx, `#${i + 1}`, 6, y + 9, { tam: 10, alinear: 'left', color: C.tinta2 });
        if (f.espera[1] > f.espera[0]) { ctx.fillStyle = VIZ.alfa(C.s8, 0.35); ctx.fillRect(esc(f.espera[0]), y, esc(f.espera[1]) - esc(f.espera[0]), 18); }
        for (const [seg, col] of [[f.c1, C.s2], [f.c2, C.s2]]) { ctx.fillStyle = col; ctx.fillRect(esc(seg[0]), y, Math.max(2, esc(seg[1]) - esc(seg[0])), 18); }
        ctx.fillStyle = f.io[2] ? C.s4 : C.eje; ctx.fillRect(esc(f.io[0]), y + 5, esc(f.io[1]) - esc(f.io[0]), 8);
      });
      W.texto(ctx, `${Math.round(total)} ms`, Wd - 6, 22 + 8 * 24 + 8, { tam: 11, peso: 600, alinear: 'right' });
      const resp = filas.map((f) => f.c2[1]), media = resp.reduce((a, b) => a + b, 0) / resp.length;
      registro.textContent = est.modo === 'bloq' ? 'El hilo espera la E/S de cada petición: las demás hacen cola y el tiempo total es la suma.' : est.modo === 'no' ? 'El hilo solo hace la CPU; la E/S ocurre en el sistema operativo y se solapa entre peticiones.' : 'Cada petición tiene su propio hilo: se solapan, pero cada hilo consume memoria y hay cambios de contexto.';
      lectura.set([['tiempo total', `${Math.round(total)} ms`], ['respuesta media', `${Math.round(media)} ms`], ['peticiones por segundo', VIZ.fmt((est.n / total) * 1000, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const i = Math.floor((y - 10) / 24); if (i < 0 || i >= filas.length) return tip.ocultar(); tip.mostrar(x, y, `petición <b>#${i + 1}</b><br>termina en ${Math.round(filas[i].c2[1])} ms`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: capacidad del servidor según la carga ---------- */

  function montarCarga(cuerpo) {
    const est = { hilos: 20, io: 100, cpu: 2 };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Hilos del modelo bloqueante', min: 2, max: 200, valor: est.hilos, alCambiar: (v) => { est.hilos = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Espera de E/S', min: 10, max: 300, paso: 10, valor: est.io, formato: (v) => `${v} ms`, alCambiar: (v) => { est.io = v; dibujar(); } });
    ctl.rango({ etiqueta: 'CPU por petición', min: 0.5, max: 10, paso: 0.5, valor: est.cpu, formato: (v) => `${v} ms`, alCambiar: (v) => { est.cpu = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s2, t: 'bloqueante con hilos' }, { c: C.s1, t: 'un hilo con E/S no bloqueante' }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se modela cada servidor como una cola: los hilos atienden durante CPU + E/S; el bucle de eventos solo ocupa su único hilo durante la CPU.');
    // Tiempo de respuesta (ms) a λ peticiones/s.
    const bloq = (lam) => { const mu = 1000 / (est.io + est.cpu); const r = VIZ.si.cola(lam, mu, est.hilos); return r.estable ? r.W : Infinity; };
    const nob = (lam) => { const mu = 1000 / est.cpu; const r = VIZ.si.cola(lam, mu, 1); return r.estable ? r.W + est.io : Infinity; };
    const cap = [() => est.hilos * 1000 / (est.io + est.cpu), () => 1000 / est.cpu];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xmax = Math.max(cap[0](), cap[1]()) * 1.2, ymax = est.io * 4;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax }, { etiquetaX: 'peticiones por segundo', etiquetaY: 'tiempo de respuesta (ms)' });
      plano.ejes();
      [bloq, nob].forEach((f, i) => { const pts = []; for (let k = 1; k <= 160; k++) { const lam = (xmax * k) / 160; const v = f(lam); pts.push([lam, Number.isFinite(v) && v <= ymax ? v : NaN]); } VIZ.trazar(lienzo.ctx, plano, pts, SER[i].c, 2); });
      cap.forEach((f, i) => { const x = plano.sx(f()); ctx.strokeStyle = SER[i].c; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, plano.y0); ctx.lineTo(x, plano.y1); ctx.stroke(); ctx.setLineDash([]); });
      lectura.set([['capacidad con hilos', `${VIZ.entero(cap[0]())} peticiones/s`], ['capacidad con bucle de eventos', `${VIZ.entero(cap[1]())} peticiones/s`], ['hilos necesarios para igualarlo', VIZ.entero(Math.ceil((cap[1]() * (est.io + est.cpu)) / 1000))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const lam = plano.ix(x), f = (v) => (Number.isFinite(v) ? `${VIZ.fmt(v, 4)} ms` : 'saturado');
      tip.mostrar(x, y, `<b>${VIZ.entero(lam)}</b> peticiones/s` + VIZ.filaTooltip(SER[0].c, 'bloqueante', f(bloq(lam))) + VIZ.filaTooltip(SER[1].c, 'no bloqueante', f(nob(lam))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('blocking-nonblocking', {
    intro: String.raw`
      <p>Leer un archivo o consultar una base de datos es <em>miles de veces más lento</em> que ejecutar una instrucción. Un programa puede manejar esa espera de dos maneras:
      <strong>bloqueando</strong> (el hilo se queda parado hasta recibir la respuesta) o <strong>sin bloquear</strong> (pide la operación, sigue con otro trabajo y es avisado al terminar).</p>
      <p>Node.js se basa en la segunda: un solo hilo atiende a miles de clientes porque casi todo lo que hacen es esperar.</p>`,
    visualizaciones: [
      { titulo: 'Varias peticiones en un hilo', descripcion: 'Compare E/S bloqueante, no bloqueante y un hilo por petición: observe cuándo el hilo está ocupado de verdad y cuándo solo espera.', montar: montarLineaTiempo },
      { titulo: 'Capacidad frente a carga', descripcion: 'Aumente la espera de E/S o la CPU por petición y mire dónde se satura cada modelo; ajuste el número de hilos del modelo clásico.', montar: montarCarga },
    ],
    teoria: String.raw`
      <h2>Dos maneras de esperar</h2>
      <pre><code>// bloqueante: el hilo no hace nada más hasta tener el archivo
const datos = fs.readFileSync("grande.txt");

// no bloqueante: se registra una continuación y el hilo sigue
fs.readFile("grande.txt", (err, datos) =&gt; { … });
const datos2 = await fs.promises.readFile("grande.txt");</code></pre>
      <h2>Capacidad</h2>
      <p>Sea \(c\) el tiempo de CPU por petición y \(e\) el de espera de E/S.</p>
      <ul>
        <li><strong>Modelo con \(k\) hilos bloqueantes</strong>: cada petición ocupa un hilo durante \(c + e\); la capacidad es \(\lambda_{\max} = \dfrac{k}{c + e}\).</li>
        <li><strong>Un hilo con E/S no bloqueante</strong>: el hilo solo se ocupa durante \(c\), así que \(\lambda_{\max} = \dfrac{1}{c}\), independiente de \(e\).</li>
      </ul>
      <p>Con \(c = 2\) ms y \(e = 100\) ms, un solo hilo no bloqueante atiende hasta 500 peticiones/s; un modelo bloqueante necesitaría \(k \approx 51\) hilos para igualarlo, cada uno con su pila de memoria.</p>
      <h2>La otra cara</h2>
      <p>Si el trabajo es <em>CPU</em> (comprimir, cifrar, un bucle largo), el modelo no bloqueante pierde su ventaja: la CPU del único hilo se convierte en el límite y bloquea a todos (ver <a href="tema.html?id=event-loop">el bucle de eventos</a>). Para eso existen los hilos de trabajo y los procesos hijo.</p>
      <div class="recuadro">Dentro de Node, <em>libuv</em> delega la E/S al sistema operativo (o a un pequeño grupo de hilos) y devuelve cada resultado al bucle de eventos como una tarea. Para organizar el código que depende de esos resultados, use <a href="tema.html?id=promises-async-await">promesas y async/await</a>.</div>`,
  });
})();
