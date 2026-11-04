(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* Programa: funciones con listas de instrucciones. log: imprime; timeout: encola una tarea (macrotarea);
     then: encola una microtarea (callback de una promesa ya resuelta). */
  const ESCENARIOS = {
    basico: {
      t: 'Orden básico', fns: {
        main: [{ op: 'log', v: 'A' }, { op: 'timeout', f: 'T' }, { op: 'then', f: 'P' }, { op: 'log', v: 'D' }],
        T: [{ op: 'log', v: 'B (timeout)' }], P: [{ op: 'log', v: 'C (promesa)' }],
      },
    },
    micro: {
      t: 'Microtareas encadenadas', fns: {
        main: [{ op: 'timeout', f: 'T' }, { op: 'then', f: 'P1' }, { op: 'log', v: 'fin de main' }],
        P1: [{ op: 'log', v: 'P1' }, { op: 'then', f: 'P2' }], P2: [{ op: 'log', v: 'P2' }], T: [{ op: 'log', v: 'T' }],
      },
    },
    mixto: {
      t: 'Timeout dentro de promesa', fns: {
        main: [{ op: 'then', f: 'P1' }, { op: 'timeout', f: 'T1' }, { op: 'log', v: 'S' }],
        P1: [{ op: 'log', v: 'P1' }, { op: 'timeout', f: 'T2' }], T1: [{ op: 'log', v: 'T1' }, { op: 'then', f: 'P3' }], T2: [{ op: 'log', v: 'T2' }], P3: [{ op: 'log', v: 'P3' }],
      },
    },
  };

  function simular(fns) {
    const pasos = [], micro = [], macro = [], salida = [];
    const foto = (pila, nota, activo) => pasos.push({ pila: [...pila], micro: [...micro], macro: [...macro], salida: [...salida], nota, activo });
    function ejecutar(nombre) {
      fns[nombre].forEach((ins, i) => {
        const lineaId = `${nombre}:${i}`;
        if (ins.op === 'log') { salida.push(ins.v); foto([nombre], `${nombre}: se imprime «${ins.v}».`, lineaId); }
        if (ins.op === 'timeout') { macro.push(ins.f); foto([nombre], `${nombre}: setTimeout encola ${ins.f} en la cola de tareas (se ejecutará más tarde).`, lineaId); }
        if (ins.op === 'then') { micro.push(ins.f); foto([nombre], `${nombre}: la promesa ya está resuelta; su callback ${ins.f} entra a la cola de microtareas.`, lineaId); }
      });
    }
    foto([], 'Comienza: el programa principal se ejecuta como la primera tarea.', null);
    ejecutar('main');
    foto([], 'La pila quedó vacía: el bucle de eventos vacía primero TODAS las microtareas.', null);
    while (micro.length || macro.length) {
      if (micro.length) { const f = micro.shift(); foto([f], `Microtarea: se saca ${f} de la cola y se ejecuta.`, null); ejecutar(f); foto([], `${f} terminó.`, null); } else {
        const f = macro.shift(); foto([f], `Sin microtareas: el bucle toma UNA tarea, ${f}.`, null); ejecutar(f); foto([], `${f} terminó; antes de la siguiente tarea se revisan las microtareas.`, null);
      }
    }
    foto([], 'Todo terminó: pila y colas vacías.', null);
    return pasos;
  }

  /* ---------- Fig. 1: pila, microtareas y tareas ---------- */

  function montarBucle(cuerpo) {
    let clave = 'basico', pasos = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Programa', valor: clave, opciones: Object.entries(ESCENARIOS).map(([c, e]) => [c, e.t]), alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const prog = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(prog);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 250 : 200) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'pila de llamadas' }, { color: C.s7, texto: 'microtareas (promesas)' }, { color: C.s4, texto: 'tareas (timers, eventos)' }, { color: C.s6, texto: 'consola' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Antes de predecir, avance paso a paso. Regla de oro: pila vacía → <b>todas</b> las microtareas → <b>una</b> tarea → de nuevo microtareas.');
    function iniciar() { pasos = simular(ESCENARIOS[clave].fns); k = 0; return (function* () { for (let j = 1; j < pasos.length; j++) { k = j; yield; } })(); }
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const p = pasos[k];
      prog.replaceChildren(...Object.entries(ESCENARIOS[clave].fns).flatMap(([n, ins]) => [
        el('div', null, `${n === 'main' ? 'programa principal' : `función ${n}`}:`),
        ...ins.map((x, i) => el('div', { class: p.activo === `${n}:${i}` ? 'activa' : null }, `   ${x.op === 'log' ? `console.log("${x.v}")` : x.op === 'timeout' ? `setTimeout(${x.f}, 0)` : `Promise.resolve().then(${x.f})`}`)),
      ]));
      const cols = Wd < 600 ? 2 : 4, cw = (Wd - 8 * (cols + 1)) / cols, ch = Wd < 600 ? (H - 24) / 2 : H - 16;
      const paneles = [['Pila de llamadas', p.pila, C.s1], ['Microtareas', p.micro, C.s7], ['Cola de tareas', p.macro, C.s4], ['Consola', p.salida, C.s6]];
      paneles.forEach(([t, items, col], i) => {
        const x = 8 + (i % cols) * (cw + 8), y = 8 + Math.floor(i / cols) * (ch + 8);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, cw, ch);
        W.texto(ctx, t, x + cw / 2, y + 12, { tam: 10, peso: 600, color: C.tinta2 });
        items.slice(0, 5).forEach((it, j) => W.caja(ctx, x + 6, y + 24 + j * 24, cw - 12, 20, String(it).slice(0, 18), { borde: col, relleno: VIZ.alfa(col, 0.2), tam: 10 }));
      });
      registro.textContent = p.nota;
      lectura.set([['paso', `${k} de ${pasos.length - 1}`], ['microtareas en cola', String(p.micro.length)], ['tareas en cola', String(p.macro.length)], ['salida', p.salida.length ? p.salida.map((s) => s.split(' ')[0]).join(' → ') : '—']]);
    }
    lienzo.alDibujar = () => pasos.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: una tarea larga bloquea todo ---------- */

  function montarBloqueo(cuerpo) {
    const est = { bloque: 800, trozos: false };
    let semilla = 1, tareas = [], clics = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Duración del cálculo pesado', min: 0, max: 2000, paso: 50, valor: est.bloque, formato: (v) => `${v} ms`, alCambiar: (v) => { est.bloque = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'dividirlo en trozos de 50 ms (cediendo el hilo)', valor: false, alCambiar: (v) => { est.trozos = v; dibujar(); } });
    ctl.boton('Otros clics', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 150 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'cálculo pesado en el hilo principal' }, { color: C.s1, texto: 'atención a un clic' }, { color: C.s2, texto: 'espera del clic (latencia)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'JavaScript tiene un solo hilo: mientras corre el cálculo, nadie atiende clics ni timers. Divida el trabajo y la interfaz vuelve a responder.');
    const T = 3000, DUR = 20;
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(semilla * 11);
      clics = Array.from({ length: 6 }, () => Math.round((rnd() * 2800) / 10) * 10).sort((a, b) => a - b);
      // Simulación de un solo hilo: el cálculo empieza en t = 300 y los clics se atienden cuando el hilo cede.
      const trozo = est.trozos ? 50 : est.bloque || 1;
      let t = 0, rest = est.bloque;
      const cola = [...clics], inicio = 300, espera = [];
      tareas = [];
      for (let guarda = 0; guarda < 5000 && (rest > 0 || cola.length); guarda++) {
        const listo = cola.findIndex((c) => c <= t);
        if (listo >= 0) { const c = cola.splice(listo, 1)[0]; tareas.push({ tipo: 'clic', ini: t, fin: t + DUR, llegada: c }); espera.push(t - c); t += DUR; continue; }
        if (rest > 0 && t >= inicio) { const d = Math.min(trozo, rest); tareas.push({ tipo: 'calculo', ini: t, fin: t + d }); t += d; rest -= d; continue; }
        const futuros = [...cola, ...(rest > 0 ? [inicio] : [])].filter((x) => x > t);
        t = futuros.length ? Math.min(...futuros) : t + 10;
      }
      const esc = (ms) => 8 + (ms / (T + 200)) * (Wd - 16);
      for (const q of tareas) {
        ctx.fillStyle = q.tipo === 'calculo' ? C.s8 : C.s1; ctx.fillRect(esc(q.ini), 40, Math.max(2, esc(q.fin) - esc(q.ini)), 30);
        if (q.tipo === 'clic') { ctx.fillStyle = VIZ.alfa(C.s2, 0.6); ctx.fillRect(esc(q.llegada), 80, Math.max(1, esc(q.ini) - esc(q.llegada)), 10); }
      }
      clics.forEach((c) => { ctx.strokeStyle = C.s2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(esc(c), 76); ctx.lineTo(esc(c), 96); ctx.stroke(); });
      W.texto(ctx, 'hilo principal', 8, 28, { tam: 10, alinear: 'left', color: C.tinta2 });
      W.texto(ctx, 'clics del usuario y su espera', 8, 112, { tam: 10, alinear: 'left', color: C.tinta2 });
      [0, 1000, 2000, 3000].forEach((m) => W.texto(ctx, `${m} ms`, Math.min(Wd - 18, Math.max(18, esc(m))), 138, { tam: 10, color: C.apagado }));
      const max = Math.max(0, ...espera), media = espera.reduce((a, b) => a + b, 0) / Math.max(1, espera.length);
      registro.textContent = max > 200 ? `Un clic esperó ${Math.round(max)} ms: la interfaz se siente «congelada» (por encima de ~100 ms se nota).` : 'Todos los clics se atienden casi de inmediato.';
      lectura.set([['espera máxima de un clic', `${Math.round(max)} ms`], ['espera media', `${Math.round(media)} ms`], ['cálculo', est.trozos ? `${Math.ceil(est.bloque / 50)} trozos de 50 ms` : '1 bloque']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), ms = ((x - 8) / (lienzo.ancho - 16)) * (T + 200);
      const q = tareas.find((u) => ms >= u.ini && ms <= u.fin && y > 36 && y < 74);
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, q.tipo === 'calculo' ? `cálculo<br>${Math.round(q.ini)}–${Math.round(q.fin)} ms` : `clic llegó en ${Math.round(q.llegada)} ms<br>atendido en ${Math.round(q.ini)} ms`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('event-loop', {
    intro: String.raw`
      <p>JavaScript ejecuta tu código en <strong>un solo hilo</strong>: solo hace una cosa a la vez. Sin embargo, las páginas piden datos, esperan clics y miden tiempo sin congelarse.
      El truco es el <strong>bucle de eventos</strong> (<em>event loop</em>): una rutina que, cuando la pila de llamadas queda vacía, toma el siguiente trabajo pendiente de unas colas.</p>
      <p>Hay dos colas con prioridad distinta: las <em>microtareas</em> (callbacks de promesas) y las <em>tareas</em> o macrotareas (timers, eventos de entrada). Entender su orden explica resultados que parecen «al revés».</p>`,
    visualizaciones: [
      { titulo: 'Pila, microtareas y tareas', descripcion: 'Avance paso a paso por tres programas y prediga el orden de la consola antes de verlo; fíjese en cuándo se vacían las microtareas.', montar: montarBucle },
      { titulo: 'Un cálculo largo bloquea la interfaz', descripcion: 'Suba la duración del cálculo y mire cuánto esperan los clics; luego divídalo en trozos que ceden el hilo.', montar: montarBloqueo },
    ],
    teoria: String.raw`
      <h2>El algoritmo</h2>
      <pre><code>mientras haya trabajo:
    ejecutar la tarea actual hasta que la pila quede vacía
    mientras la cola de microtareas no esté vacía:
        ejecutar la siguiente microtarea     (pueden agregar más microtareas)
    (el navegador puede pintar la pantalla)
    tomar UNA tarea de la cola de tareas</code></pre>
      <p>Por eso <code>Promise.then</code> corre antes que <code>setTimeout(…, 0)</code>, aunque este último tenga retardo cero: un timer es una tarea; el <code>.then</code>, una microtarea.</p>
      <h2>Componentes del motor</h2>
      <ul>
        <li><strong>Heap</strong>: memoria donde viven los objetos.</li>
        <li><strong>Call stack</strong>: las funciones activas; si una llamada tarda, nada más puede ejecutarse.</li>
        <li><strong>APIs del entorno</strong> (navegador o Node con libuv): temporizadores, red y disco, que trabajan <em>fuera</em> del hilo y devuelven su resultado como una tarea.</li>
      </ul>
      <h2>Latencia por bloqueo</h2>
      <p>Si una tarea tarda \(B\) ms, un evento que llega durante ella espera hasta \(B\) ms antes de ejecutarse. Dividiéndola en trozos de \(b\) ms, la espera máxima baja a \(\approx b + d\) con \(d\) la duración del manejador, a costa de un tiempo total algo mayor. Para cálculos verdaderamente pesados se usan <em>Web Workers</em> o hilos de trabajo en Node.</p>
      <div class="recuadro">Un timer de \(0\) ms no es «inmediato»: significa «cuando la pila esté vacía y se haya vaciado la cola de microtareas». Continúe con <a href="tema.html?id=promises-async-await">promesas y async/await</a> y con <a href="tema.html?id=blocking-nonblocking">E/S bloqueante y no bloqueante</a>.</div>`,
  });
})();
