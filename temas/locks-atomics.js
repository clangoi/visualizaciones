(function () {
  'use strict';
  const { color: C } = VIZ;

  // Programa de cada hilo: pasos como [texto, tipo]. Modo no atómico separa leer y fijar el lock.
  const prog = (atomico) => atomico
    ? [['test_and_set(lock)', 'tas'], ['sección crítica', 'cs'], ['lock ← 0', 'lib']]
    : [['leer lock (¿es 0?)', 'leer'], ['lock ← 1', 'fijar'], ['sección crítica', 'cs'], ['lock ← 0', 'lib']];

  function montar(cuerpo) {
    let atomico = false, lock, h, msg, fallo, pasos;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Usar test-and-set atómico', valor: atomico, alCambiar: (v) => { atomico = v; reiniciar(); } });
    ctl.boton('Avanza A', () => avanzar(0));
    ctl.boton('Avanza B', () => avanzar(1));
    ctl.boton('20 pasos al azar', () => { for (let i = 0; i < 20; i++) avanzar(Math.floor(Math.random() * 2)); }, { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { alto: 210 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'hilo A' }, { color: C.s2, texto: 'hilo B' }, { color: C.s8, texto: 'los dos en la sección crítica', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Sin atomicidad, «leer el lock» y «fijarlo» son dos pasos y otro hilo puede colarse entre ellos. Con test-and-set, leer y fijar ocurren en una sola instrucción indivisible.');
    function reiniciar() { lock = 0; pasos = 0; fallo = 0; h = [{ pc: 0, ok: false }, { pc: 0, ok: false }]; msg = 'lock = 0. Ambos quieren entrar a la sección crítica.'; dibujar(); }
    const dentro = () => h.map((x, i) => (prog(atomico)[x.pc] || [])[1] === 'cs' ? i : -1).filter((i) => i >= 0);
    function avanzar(i) {
      const p = prog(atomico), x = h[i], [txt, tipo] = p[x.pc], n = 'AB'[i];
      pasos++;
      if (tipo === 'tas') { if (lock === 0) { lock = 1; x.pc++; msg = `${n}: test_and_set devolvió 0 y fijó lock = 1; entra.`; } else msg = `${n}: test_and_set devolvió 1; sigue girando (spin).`; }
      else if (tipo === 'leer') { if (lock === 0) { x.pc++; msg = `${n} leyó lock = 0 y se dispone a fijarlo…`; } else msg = `${n} leyó lock = 1; vuelve a intentar.`; }
      else if (tipo === 'fijar') { lock = 1; x.pc++; msg = `${n} fija lock = 1.`; }
      else if (tipo === 'cs') { x.pc++; msg = `${n} sale de la sección crítica.`; }
      else { lock = 0; x.pc = 0; msg = `${n} libera el lock (lock = 0) y vuelve a intentar entrar.`; }
      if (dentro().length === 2) { fallo++; msg += ' ¡Los dos están dentro de la sección crítica!'; }
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, p = prog(atomico), mal = dentro().length === 2;
      lienzo.limpiar();
      const bw = Math.min(210, (W - 40) / 2.3);
      h.forEach((x, i) => {
        const xx = i ? W - bw - 8 : 8, col = mal ? C.s8 : i ? C.s2 : C.s1;
        ctx.strokeStyle = col; ctx.lineWidth = dentro().includes(i) ? 3 : 1.5; ctx.strokeRect(xx, 8, bw, 130);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = i ? C.s2 : C.s1; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Hilo ' + 'AB'[i], xx + 6, 22);
        ctx.font = VIZ.fuente(10);
        p.forEach(([t], j) => { if (x.pc === j) { ctx.fillStyle = VIZ.alfa(col, 0.18); ctx.fillRect(xx + 3, 36 + j * 22, bw - 6, 19); } ctx.fillStyle = x.pc === j ? C.tinta : C.tinta2; ctx.fillText(`${x.pc === j ? '▸' : ' '} ${t}`, xx + 7, 46 + j * 22, bw - 12); });
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 36, 40, 72, 46);
      ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(10); ctx.fillText('lock', W / 2, 52); ctx.font = VIZ.fuente(18, 700); ctx.fillText(String(lock), W / 2, 72);
      ctx.font = VIZ.fuente(11); ctx.fillStyle = mal ? C.s8 : C.tinta2; ctx.textAlign = 'left'; ctx.fillText(`violaciones de exclusión mutua: ${fallo}`, 8, 160);
      registro.textContent = msg;
      lectura.set([['lock', String(lock)], ['pasos dados', String(pasos)], ['violaciones', String(fallo)], ['dentro ahora', dentro().map((i) => 'AB'[i]).join(' y ') || 'nadie']]);
    }
    lienzo.alDibujar = () => h && dibujar();
    reiniciar();
  }

  VIZ.registrarTema('locks-atomics', {
    intro: String.raw`
      <p>Para evitar una <a href="tema.html?id=race-conditions">condición de carrera</a> hay que lograr <strong>exclusión mutua</strong>: un <em>lock</em> (o <em>mutex</em>) que un hilo toma antes de la sección crítica y suelta al salir. Pero un lock es en sí un dato compartido: si «mirar si está libre» y «tomarlo» son dos pasos separados, la carrera reaparece en el propio lock.</p>
      <p>La salida es una instrucción de hardware <strong>atómica</strong> que hace ambas cosas de una vez, como <em>test-and-set</em> o <em>compare-and-swap</em>.</p>`,
    visualizaciones: [
      { titulo: 'Un lock mal hecho y uno atómico', descripcion: 'Sin atomicidad, avance A (leer), B (leer), A (fijar), B (fijar): ambos entran. Luego marque la casilla y repita.', montar },
    ],
    teoria: String.raw`
      <h2>Instrucciones atómicas</h2>
      <pre><code>test_and_set(x):    # indivisible
    viejo ← x;  x ← 1;  devolver viejo

compare_and_swap(x, esperado, nuevo):    # indivisible
    si x = esperado:  x ← nuevo;  devolver verdadero
    devolver falso

lock():    mientras test_and_set(cerrojo) = 1:  girar   # spinlock
unlock():  cerrojo ← 0</code></pre>
      <p>El hardware las garantiza bloqueando el bus o la línea de caché durante la operación. <em>Fetch-and-add</em> y <em>compare-and-swap</em> permiten, además, estructuras <em>sin locks</em> (<em>lock-free</em>).</p>
      <h2>Spinlock frente a mutex con bloqueo</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Spinlock</th><th class="izq">Mutex que duerme</th></tr>
      <tr><td class="izq">espera</td><td class="izq">gira usando CPU</td><td class="izq">se bloquea; el núcleo lo despierta</td></tr>
      <tr><td class="izq">conviene si</td><td class="izq">la sección crítica es muy corta, hay varios núcleos</td><td class="izq">la espera puede ser larga</td></tr>
      <tr><td class="izq">costo</td><td class="izq">desperdicia ciclos</td><td class="izq">dos <a href="tema.html?id=context-switch">cambios de contexto</a></td></tr></table>
      <p>Un spinlock con test-and-set cumple exclusión mutua y progreso, pero no espera acotada: un hilo desafortunado puede perder siempre. Los <em>ticket locks</em> dan orden FIFO.</p>
      <h2>Buenas prácticas</h2>
      <ul><li>Secciones críticas lo más cortas posible (por <a href="tema.html?id=threads-models">Amdahl</a>, cada una es tiempo secuencial).</li><li>Tomar los locks siempre en el mismo orden, para no caer en <a href="tema.html?id=deadlock-banker">interbloqueo</a>.</li><li>Nunca dormir ni hacer E/S con un lock tomado.</li></ul>`,
  });
})();
