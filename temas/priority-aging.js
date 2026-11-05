(function () {
  'use strict';
  const ALGS = [['np', 'Prioridades sin apropiación', { alg: 'prio' }], ['ap', 'Prioridades con apropiación', { alg: 'prio', apropiativo: true }]];
  VIZ.registrarTema('priority-aging', {
    intro: String.raw`
      <p>En la planificación por <strong>prioridades</strong> cada proceso tiene un número (aquí, menor es más importante) y la CPU va al más prioritario. Sirve para que lo urgente (interfaz, tiempo real) pase delante de lo pesado, pero tiene un riesgo: los procesos de baja prioridad pueden no ejecutarse nunca (<strong>inanición</strong>).</p>
      <p>El remedio clásico es el <strong>envejecimiento</strong> (<em>aging</em>): mientras un proceso espera, su prioridad mejora poco a poco hasta que le toca.</p>`,
    visualizaciones: [
      { titulo: 'Prioridades y envejecimiento', descripcion: 'Ejecute sin envejecimiento y observe al proceso de peor prioridad al final; luego active el envejecimiento (valores bajos) y compare su espera. La tabla muestra las prioridades iniciales.', montar: (c) => VIZ.sor.figuraPlanificacion(c, { algs: ALGS, cargas: ['azar', 'larga', 'juntos'], n0: 6, envejecer: true, env0: 0 }) },
    ],
    teoria: String.raw`
      <h2>Reglas</h2>
      <p>La prioridad puede ser <em>estática</em> (fijada por el usuario o el tipo de proceso) o <em>dinámica</em> (calculada por el sistema). Con apropiación, la llegada de un proceso más prioritario expulsa al que corre; sin ella, espera a que el actual termine su ráfaga.</p>
      <pre><code>cada unidad de tiempo:
    para cada proceso listo que no corre:
        espera[p] ← espera[p] + 1
        si espera[p] mod k = 0:  prioridad[p] ← prioridad[p] − 1   # mejora</code></pre>
      <h2>Inanición e inversión de prioridad</h2>
      <p>Con un flujo continuo de procesos prioritarios, uno de baja prioridad no corre: en 1973 se contaba que al apagar el IBM 7094 del MIT apareció un proceso de baja prioridad esperando desde 1967. Con envejecimiento, un proceso con prioridad inicial \(P\) llega a la máxima tras a lo sumo \(kP\) unidades de espera.</p>
      <p>Otro problema es la <strong>inversión de prioridad</strong>: un proceso de alta prioridad espera un <a href="tema.html?id=locks-atomics">lock</a> que tiene uno de baja, y uno de prioridad media impide que este último corra. Se resuelve con <em>herencia de prioridad</em>: el que tiene el lock hereda temporalmente la prioridad del que espera.</p>
      <p>Las prioridades se combinan con otras ideas en <a href="tema.html?id=mlfq">MLFQ</a>, que ajusta la prioridad según el comportamiento observado.</p>`,
  });
})();
