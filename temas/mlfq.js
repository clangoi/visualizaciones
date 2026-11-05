(function () {
  'use strict';
  const ALGS = [['mlfq', 'MLFQ (3 niveles)', { alg: 'mlfq', niveles: 3 }], ['rr', 'Round Robin', { alg: 'rr' }], ['sjf', 'SRTF', { alg: 'sjf', apropiativo: true }], ['fcfs', 'FCFS', { alg: 'fcfs' }]];
  VIZ.registrarTema('mlfq', {
    intro: String.raw`
      <p>Las políticas anteriores piden algo imposible: conocer cuánto va a durar cada trabajo. La <strong>cola multinivel con retroalimentación</strong> (MLFQ) lo aprende observando. Todo proceso nuevo entra al nivel más prioritario, que tiene el quantum más corto; si agota su quantum se le baja de nivel, y si se bloquea antes (interactivo) se queda.</p>
      <p>Resultado: los trabajos cortos e interactivos terminan en los niveles altos y los largos se hunden hacia los niveles bajos, con quantum mayor, sin que nadie declare sus ráfagas.</p>`,
    visualizaciones: [
      { titulo: 'MLFQ en acción', descripcion: 'Con 3 niveles y quantum q, 2q y 4q, observe cómo el proceso largo recibe tramos cada vez más largos mientras los cortos terminan rápido. El quantum del control es el del nivel superior.', montar: (c) => VIZ.sor.figuraPlanificacion(c, { algs: [ALGS[0]], cargas: ['convoy', 'azar', 'larga'], n0: 5, q: true, q0: 1 }) },
      { titulo: 'MLFQ frente a las demás políticas', descripcion: 'Compare las cuatro políticas con la misma carga. Pruebe «un proceso largo llega primero».', montar: (c) => VIZ.sor.figuraComparacion(c, { algs: ALGS, cargas: ['convoy', 'azar', 'larga'], n0: 6, q: true, q0: 1 }) },
    ],
    teoria: String.raw`
      <h2>Reglas</h2>
      <ol><li>Si \(\text{prio}(A) &gt; \text{prio}(B)\), corre \(A\).</li><li>Si hay igualdad, <a href="tema.html?id=round-robin-srtf">Round Robin</a> en ese nivel.</li>
      <li>Todo proceso nuevo entra en el nivel más alto.</li><li>Si usa todo su quantum en un nivel, baja un nivel.</li><li>Cada cierto tiempo \(S\), todos suben al nivel más alto (<em>refuerzo</em>).</li></ol>
      <p>El quantum crece con el nivel: \(q_\ell = q_0\,2^{\ell}\). Un trabajo de \(b\) unidades cae como máximo a \(\lceil \log_2(b/q_0 + 1) \rceil\) niveles.</p>
      <h2>Por qué funciona</h2>
      <p>Aproxima SJF sin conocer ráfagas: un proceso que termina rápido nunca llega a bajar. El refuerzo periódico evita la inanición (regla 5) y también permite que un proceso que pasa de usar mucha CPU a ser interactivo recupere su prioridad.</p>
      <h2>Vulnerabilidad</h2>
      <p>Un proceso malicioso puede soltar la CPU justo antes de agotar el quantum (con una E/S ficticia) y quedarse siempre arriba. La contramedida es contabilizar el <em>tiempo total</em> usado en el nivel, no cada ráfaga. Esta idea se usa en las versiones de Unix BSD, Solaris y Windows.</p>
      <h2>Parámetros</h2>
      <p>Número de colas, quantum de cada una, política de descenso y período \(S\) del refuerzo: no hay valores óptimos universales; se ajustan a la carga. Las demás políticas se comparan en <a href="tema.html?id=fcfs-sjf">FCFS y SJF</a>.</p>`,
  });
})();
