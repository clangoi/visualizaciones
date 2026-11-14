(function () {
  'use strict';
  const ALGS = [['fcfs', 'FCFS', { alg: 'fcfs' }], ['sjf', 'SJF (no apropiativo)', { alg: 'sjf' }]];
  VIZ.registrarTema('fcfs-sjf', {
    intro: String.raw`
      <p>El <strong>planificador de CPU</strong> decide cuál de los procesos listos usa el procesador. La política más simple es <strong>FCFS</strong> (<em>First Come, First Served</em>): atender en el orden de llegada, sin quitar la CPU a nadie.
      Es justa en el orden, pero un proceso largo que llega primero retrasa a todos los cortos: el <strong>efecto convoy</strong>.</p>
      <p><strong>SJF</strong> (<em>Shortest Job First</em>) elige siempre el trabajo más corto de los listos. Minimiza el tiempo de espera medio, pero necesita conocer o estimar la duración y puede dejar a los largos esperando indefinidamente (<em>inanición</em>).</p>`,
    parametros: [
      ['Algoritmo (Fig. 1)', String.raw`Política que decide qué proceso listo usa la CPU: FCFS por orden de llegada o SJF por ráfaga más corta, sin quitar la CPU.`],
      ['Carga de trabajo (Fig. 1 y 2)', String.raw`El patrón de llegadas y ráfagas: al azar, con un proceso largo primero (convoy) o con todos llegando en t = 0. Determina cuánto se nota la diferencia entre políticas.`],
      ['Procesos (Fig. 1 y 2)', String.raw`Cantidad de procesos que compiten por la CPU.`],
      ['Nuevos datos, reproductor (Fig. 1) y Nuevos datos (Fig. 2)', String.raw`Generan otra muestra de la misma carga; el reproductor avanza el diagrama una unidad de tiempo por paso.`],
      ['Métrica (Fig. 2)', String.raw`Qué se compara: espera media, retorno medio o respuesta media. Menor es mejor.`],
    ],
    visualizaciones: [
      { titulo: 'FCFS y SJF en un diagrama de Gantt', descripcion: 'Elija la carga «un proceso largo llega primero» y compare FCFS con SJF: observe cuánto esperan los procesos cortos detrás del largo.',
        ayuda: String.raw`<p>Diagrama de Gantt: cada fila es un proceso con su color; la franja gris va desde su llegada y el tramo coloreado es cuando usa la CPU. Debajo, la tabla con llegada, ráfaga, fin, espera, retorno y respuesta, y al terminar, las medias.</p>
          <ul>
          <li><strong>Algoritmo</strong> FCFS con la carga <strong>Un proceso largo llega primero</strong>: los cortos tienen largas franjas grises detrás del largo (efecto convoy).</li>
          <li><strong>Algoritmo</strong> SJF sobre los mismos datos: los cortos pasan antes y la espera media baja.</li>
          <li><strong>Procesos</strong>: más procesos hacen más larga la cola y más visible la diferencia.</li>
          </ul>`, montar: (c) => VIZ.sor.figuraPlanificacion(c, { algs: ALGS, cargas: ['convoy', 'azar', 'juntos'], n0: 5 }) },
      { titulo: 'Comparación sobre la misma carga', descripcion: 'Cambie la métrica: SJF gana en espera y retorno medios; observe si cambia la respuesta.',
        ayuda: String.raw`<p>Una barra por algoritmo con el valor de la métrica elegida sobre la misma carga; la mejor (menor) va en negrita.</p>
          <ul>
          <li><strong>Métrica</strong>: SJF gana en espera y retorno medios; en respuesta las barras pueden quedar parecidas.</li>
          <li><strong>Carga de trabajo</strong>: con «Todos llegan en t = 0» o convoy la ventaja de SJF cambia de tamaño.</li>
          </ul>`, montar: (c) => VIZ.sor.figuraComparacion(c, { algs: ALGS, cargas: ['convoy', 'azar', 'juntos'], n0: 6 }) },
    ],
    teoria: String.raw`
      <h2>Métricas</h2>
      <p>Para un proceso con llegada \(a_i\), ráfaga \(b_i\), primer uso de CPU \(p_i\) y fin \(f_i\):</p>
      \[ \text{retorno}_i = f_i - a_i, \qquad \text{espera}_i = \text{retorno}_i - b_i, \qquad \text{respuesta}_i = p_i - a_i. \]
      <p>También se miden el <em>caudal</em> (procesos terminados por unidad de tiempo) y la <em>utilización</em> de la CPU.</p>
      <h2>FCFS</h2>
      <pre><code>mientras haya procesos:
    p ← el primero de la cola de listos
    ejecutar p hasta que termine o se bloquee</code></pre>
      <p>Sin apropiación, simple y sin inanición. Su espera media puede ser mala: con ráfagas \(24, 3, 3\) llegando en ese orden, las esperas son \(0, 24, 27\) (media 17); en orden \(3, 3, 24\), \(0, 3, 6\) (media 3).</p>
      <h2>SJF es óptimo</h2>
      <div class="recuadro"><strong>Teorema.</strong> Entre todos los órdenes de ejecución sin apropiación de trabajos que están listos a la vez, SJF minimiza la espera media.</div>
      <p><em>Argumento de intercambio.</em> Si un trabajo largo \(L\) precede a uno corto \(S\), intercambiarlos reduce la espera de \(S\) en \(b_L\) y aumenta la de \(L\) solo en \(b_S &lt; b_L\); la suma baja. Repitiendo, queda el orden creciente.</p>
      <h2>Limitaciones</h2>
      <ul><li>SJF necesita las duraciones; en la práctica se estiman con un promedio exponencial \(\tau_{n+1} = \alpha t_n + (1-\alpha)\tau_n\).</li>
      <li>Puede provocar inanición de los largos. Su versión con apropiación es <a href="tema.html?id=round-robin-srtf">SRTF</a>; para evitar estimar ráfagas se usa <a href="tema.html?id=mlfq">MLFQ</a>.</li></ul>`,
  });
})();
