(function () {
  'use strict';
  const ALGS = [['rr', 'Round Robin', { alg: 'rr' }], ['srtf', 'SRTF (SJF con apropiación)', { alg: 'sjf', apropiativo: true }], ['fcfs', 'FCFS', { alg: 'fcfs' }]];
  VIZ.registrarTema('round-robin-srtf', {
    intro: String.raw`
      <p>Los algoritmos <strong>apropiativos</strong> pueden quitar la CPU a un proceso en ejecución. <strong>Round Robin</strong> da a cada proceso listo un turno de duración fija, el <em>quantum</em>, y lo manda al final de la cola si no terminó: reparte la CPU de forma justa y da buena respuesta.
      <strong>SRTF</strong> (<em>Shortest Remaining Time First</em>) es SJF con apropiación: cuando llega un proceso con menos tiempo restante que el que corre, lo reemplaza.</p>`,
    parametros: [
      ['Algoritmo (Fig. 1)', String.raw`Política simulada: Round Robin (turnos de un quantum), SRTF (quita la CPU a quien tiene más trabajo restante) o FCFS.`],
      ['Carga de trabajo (Fig. 1 y 2)', String.raw`El patrón de llegadas y ráfagas: al azar, un proceso largo primero o todos en t = 0.`],
      ['Procesos (Fig. 1 y 2)', String.raw`Cuántos procesos compiten por la CPU.`],
      ['Quantum (Fig. 1 y 2)', String.raw`Duración del turno de Round Robin. Pequeño: más cambios de contexto y mejor respuesta; grande: se parece a FCFS.`],
      ['Nuevos datos y reproductor (Fig. 1); Nuevos datos (Fig. 2)', String.raw`Generan otra muestra de la carga; el reproductor avanza una unidad de tiempo por paso.`],
      ['Métrica (Fig. 2)', String.raw`Espera media, retorno medio o respuesta media; menor es mejor.`],
    ],
    visualizaciones: [
      { titulo: 'Round Robin y SRTF paso a paso', descripcion: 'Varíe el quantum: con valores grandes Round Robin se parece a FCFS; con valores pequeños aumentan los cambios de contexto pero la respuesta mejora.',
        ayuda: String.raw`<p>Diagrama de Gantt: una fila por proceso, con franja gris desde su llegada y tramos de color cuando usa la CPU. Con Round Robin los tramos se parten en turnos; la tabla de abajo da fin, espera, retorno y respuesta.</p>
          <ul>
          <li><strong>Quantum</strong>: con valores pequeños los tramos son cortos y alternados y la respuesta baja; con grandes el diagrama se parece al de FCFS.</li>
          <li><strong>Algoritmo</strong> SRTF: los procesos con poco trabajo restante interrumpen a los largos.</li>
          </ul>`, montar: (c) => VIZ.sor.figuraPlanificacion(c, { algs: ALGS, cargas: ['azar', 'convoy', 'juntos'], n0: 5, q: true }) },
      { titulo: 'Cómo compiten', descripcion: 'Compare las tres políticas en espera, retorno y respuesta con el mismo conjunto de procesos y el quantum elegido.',
        ayuda: String.raw`<p>Una barra por política con la métrica elegida, calculada con los mismos procesos y el quantum actual.</p>
          <ul>
          <li><strong>Quantum</strong>: solo afecta a la barra de Round Robin; muestra su compromiso entre respuesta y retorno.</li>
          <li><strong>Métrica</strong>: ninguna política gana en las tres; compare en cuál destaca cada una.</li>
          </ul>`, montar: (c) => VIZ.sor.figuraComparacion(c, { algs: ALGS, cargas: ['azar', 'convoy', 'juntos'], n0: 6, q: true }) },
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
