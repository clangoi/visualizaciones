(function () {
  'use strict';
  const ALGS = [['rr', 'Round Robin', { alg: 'rr' }], ['srtf', 'SRTF (SJF con apropiación)', { alg: 'sjf', apropiativo: true }], ['fcfs', 'FCFS', { alg: 'fcfs' }]];
  VIZ.registrarTema('round-robin-srtf', {
    intro: String.raw`
      <p>Los algoritmos <strong>apropiativos</strong> pueden quitar la CPU a un proceso en ejecución. <strong>Round Robin</strong> da a cada proceso listo un turno de duración fija, el <em>quantum</em>, y lo manda al final de la cola si no terminó: reparte la CPU de forma justa y da buena respuesta.
      <strong>SRTF</strong> (<em>Shortest Remaining Time First</em>) es SJF con apropiación: cuando llega un proceso con menos tiempo restante que el que corre, lo reemplaza.</p>`,
    visualizaciones: [
      { titulo: 'Round Robin y SRTF paso a paso', descripcion: 'Varíe el quantum: con valores grandes Round Robin se parece a FCFS; con valores pequeños aumentan los cambios de contexto pero la respuesta mejora.', montar: (c) => VIZ.sor.figuraPlanificacion(c, { algs: ALGS, cargas: ['azar', 'convoy', 'juntos'], n0: 5, q: true }) },
      { titulo: 'Cómo compiten', descripcion: 'Compare las tres políticas en espera, retorno y respuesta con el mismo conjunto de procesos y el quantum elegido.', montar: (c) => VIZ.sor.figuraComparacion(c, { algs: ALGS, cargas: ['azar', 'convoy', 'juntos'], n0: 6, q: true }) },
    ],
    teoria: String.raw`
      <h2>Round Robin</h2>
      <pre><code>cola ← listos en orden de llegada
mientras cola no vacía:
    p ← sacar el primero
    ejecutar p durante min(quantum, restante[p])
    si restante[p] &gt; 0:  poner p al final de la cola</code></pre>
      <p>Con \(n\) procesos listos y quantum \(q\), ningún proceso espera más de \((n-1)q\) unidades antes de su siguiente turno, y la <strong>respuesta</strong> está acotada por ese valor. La elección de \(q\) es un compromiso:</p>
      <ul><li>\(q \to \infty\): se reduce a FCFS (efecto convoy).</li><li>\(q \to 0\): reparto ideal, pero la eficiencia \(q/(q+c)\) cae por el <a href="tema.html?id=context-switch">costo \(c\) del cambio de contexto</a>.</li></ul>
      <p>Regla práctica: elegir \(q\) mayor que la mayoría de las ráfagas cortas interactivas (el 80 % de las ráfagas debería terminar dentro de un quantum).</p>
      <h2>SRTF</h2>
      <p>Cada vez que llega un proceso se compara su ráfaga con el <em>tiempo restante</em> del que corre. Es <strong>óptimo</strong> en espera media entre todos los algoritmos, con apropiación o sin ella, pero requiere conocer las ráfagas, causa muchos cambios de contexto y puede hacer esperar indefinidamente a los trabajos largos.</p>
      <table class="tabla-datos"><tr><th class="izq"></th><th>RR</th><th>SRTF</th></tr>
      <tr><td class="izq">respuesta</td><td>buena</td><td>mala para largos</td></tr><tr><td class="izq">espera media</td><td>media</td><td>mínima</td></tr><tr><td class="izq">inanición</td><td>no</td><td>sí</td></tr><tr><td class="izq">conoce ráfagas</td><td>no</td><td>sí</td></tr></table>`,
  });
})();
