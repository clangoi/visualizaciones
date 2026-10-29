(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Planificación de CPU ---------- */

  const ALGS = { fcfs: 'FCFS (orden de llegada)', sjf: 'SJF (el más corto primero)', srtf: 'SRTF (expropiativo)', rr: 'Round Robin' };

  function procesosAzar(semilla, n) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, (_, i) => ({ id: i, llegada: i === 0 ? 0 : Math.floor(rnd() * 10), rafaga: 1 + Math.floor(rnd() * 8) }))
      .sort((a, b) => a.llegada - b.llegada).map((p, i) => ({ ...p, id: i }));
  }

  // Devuelve la línea de tiempo: en cada unidad, qué proceso usa la CPU (−1 = ociosa) y la cola de listos.
  function planificar(procs, alg, q) {
    const resta = procs.map((p) => p.rafaga), fin = new Array(procs.length).fill(null);
    const linea = [], colas = [];
    let cola = [], actual = -1, usado = 0, cambios = 0;
    for (let t = 0; t < 200 && fin.some((f) => f == null); t++) {
      procs.forEach((p) => { if (p.llegada === t) cola.push(p.id); });
      if (actual >= 0 && resta[actual] === 0) { fin[actual] = t; actual = -1; }
      if (actual >= 0 && alg === 'rr' && usado >= q && cola.length) { cola.push(actual); actual = -1; }
      if (actual >= 0 && alg === 'srtf') {
        const mejor = cola.reduce((m, i) => (resta[i] < resta[m] ? i : m), actual);
        if (mejor !== actual) { cola.push(actual); cola.splice(cola.indexOf(mejor), 1); actual = mejor; usado = 0; cambios++; }
      }
      if (actual < 0 && cola.length) {
        let k = 0;
        if (alg === 'sjf' || alg === 'srtf') cola.forEach((i, j) => { if (resta[i] < resta[cola[k]]) k = j; });
        actual = cola.splice(k, 1)[0]; usado = 0; cambios++;
      }
      colas.push(cola.slice());
      linea.push(actual);
      if (actual >= 0) { resta[actual]--; usado++; if (resta[actual] === 0) { fin[actual] = t + 1; actual = -1; } }
    }
    const retorno = procs.map((p) => fin[p.id] - p.llegada);
    const espera = procs.map((p, i) => retorno[i] - p.rafaga);
    return { linea, colas, fin, retorno, espera, cambios };
  }

  function montarPlanificacion(cuerpo) {
    const est = { alg: 'fcfs', q: 2, semilla: 4, n: 5 };
    let procs, plan, t = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', valor: est.alg, opciones: Object.entries(ALGS), alCambiar: (v) => { est.alg = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Quantum (Round Robin)', min: 1, max: 6, valor: est.q, alCambiar: (v) => { est.q = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Procesos', min: 3, max: 7, valor: est.n, alCambiar: (v) => { est.n = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos procesos', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => est.n * 30 + 70 });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, []);
    const tira = VIZ.grafo.estructura(cuerpo, 'Cola de listos:');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un proceso: la marca │ es su llegada, el gris es espera y el color, uso de la CPU. Abajo, la CPU en el tiempo.');

    function nuevo() { procs = procesosAzar(est.semilla * 17 + est.n, est.n); lienzo.ajustar(true); rep.reiniciar(); }
    function iniciar() {
      plan = planificar(procs, est.alg, est.q);
      t = 0;
      return (function* () { for (t = 1; t <= plan.linea.length; t++) yield; t = plan.linea.length; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const T = Math.max(plan.linea.length, 20), izq = 34, paso = (W - izq - 10) / T, alto = 22;
      geo = { izq, paso, alto };
      ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle';
      procs.forEach((p, i) => {
        const y = 10 + i * 30, col = VIZ.series[i];
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(`P${i + 1}`, 2, y + alto / 2);
        for (let k = 0; k < t; k++) {
          if (k < p.llegada || (plan.fin[i] != null && k >= plan.fin[i])) continue;
          ctx.fillStyle = plan.linea[k] === i ? col : C.neutro;
          ctx.fillRect(izq + k * paso, y, paso - 1, alto);
        }
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(izq + p.llegada * paso, y - 3); ctx.lineTo(izq + p.llegada * paso, y + alto + 3); ctx.stroke();
      });
      // Línea de la CPU
      const yc = 10 + procs.length * 30 + 8;
      ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText('CPU', 2, yc + 9);
      for (let k = 0; k < t; k++) {
        const a = plan.linea[k];
        ctx.fillStyle = a >= 0 ? VIZ.series[a] : C.superficie;
        ctx.fillRect(izq + k * paso, yc, paso - 1, 18);
        if (a < 0) { ctx.strokeStyle = C.eje; ctx.strokeRect(izq + k * paso + 0.5, yc + 0.5, paso - 2, 17); }
      }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
      for (let k = 0; k <= T; k += 5) ctx.fillText(String(k), izq + k * paso, yc + 30);
      ley.set([...procs.map((p, i) => ({ color: VIZ.series[i], texto: `P${i + 1}: llega ${p.llegada}, ráfaga ${p.rafaga}` })), { color: C.neutro, texto: 'esperando' }]);
      tira.set((t > 0 && t <= plan.colas.length ? plan.colas[t - 1] : []).map((i) => ({ texto: `P${i + 1}`, color: VIZ.series[i], tinta: VIZ.series[i] })), 'vacía');
      const terminado = t >= plan.linea.length;
      const prom = (a) => VIZ.fmt(a.reduce((s, v) => s + v, 0) / a.length, 3);
      const actual = t > 0 ? plan.linea[t - 1] : -1;
      registro.textContent = terminado ? `Fin en t = ${plan.linea.length}. Espera promedio ${prom(plan.espera)}; ${plan.cambios} cambios de contexto.`
        : t === 0 ? 'La CPU está libre; llegan los procesos.' : `t = ${t - 1}: ${actual >= 0 ? `ejecuta P${actual + 1}` : 'CPU ociosa'}.`;
      lectura.set([
        ['tiempo', String(t)],
        ['espera promedio', terminado ? prom(plan.espera) : '—'],
        ['retorno promedio', terminado ? prom(plan.retorno) : '—'],
        ['cambios de contexto', terminado ? String(plan.cambios) : '—'],
      ]);
    }
    lienzo.alDibujar = () => plan && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = Math.floor((y - 10) / 30), k = Math.floor((x - geo.izq) / geo.paso);
      if (i < 0 || i >= procs.length || k < 0) return tip.ocultar();
      const p = procs[i];
      tip.mostrar(x, y, `<b>P${i + 1}</b> llega en ${p.llegada}, ráfaga ${p.rafaga}${plan.fin[i] != null ? `<br>termina en ${plan.fin[i]}<br>espera ${plan.espera[i]}` : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevo();
  }

  /* ---------- Fig. 2: servidor con varios hilos ---------- */

  // Cada pedido: 2 unidades de CPU, 6 de E/S (disco o red) y 2 de CPU. Los hilos atienden pedidos de una cola infinita.
  const FASES = [['cpu', 2], ['es', 6], ['cpu', 2]];
  function simularHilos(k, nucleos, T) {
    const hilos = Array.from({ length: k }, () => ({ fase: 0, resta: FASES[0][1], hechos: 0 }));
    const linea = hilos.map(() => []);
    let completados = 0;
    for (let t = 0; t < T; t++) {
      // Los que necesitan CPU compiten por los núcleos (prioridad rotativa).
      const quieren = hilos.map((h, i) => i).filter((i) => FASES[hilos[i].fase][0] === 'cpu');
      const rot = quieren.map((_, j) => quieren[(j + t) % quieren.length]);
      const corren = new Set(rot.slice(0, nucleos));
      hilos.forEach((h, i) => {
        const tipo = FASES[h.fase][0];
        let marca;
        if (tipo === 'es') marca = 'es';
        else marca = corren.has(i) ? 'cpu' : 'espera';
        linea[i].push(marca);
        if (marca === 'espera') return;
        if (--h.resta === 0) {
          h.fase++;
          if (h.fase === FASES.length) { h.fase = 0; h.hechos++; completados++; }
          h.resta = FASES[h.fase][1];
        }
      });
    }
    const usoCPU = linea.flat().filter((m) => m === 'cpu').length / (T * nucleos);
    return { linea, completados, usoCPU };
  }

  function montarHilos(cuerpo) {
    const est = { k: 1, nucleos: 1 };
    const T = 48;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Hilos', min: 1, max: 6, valor: est.k, alCambiar: (v) => { est.k = v; lienzo.ajustar(true); } });
    ctl.rango({ etiqueta: 'Núcleos de CPU', min: 1, max: 4, valor: est.nucleos, alCambiar: (v) => { est.nucleos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => est.k * 26 + 40 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'usa la CPU' }, { color: C.s3, texto: 'bloqueado en E/S (disco, red)' }, { color: C.s4, texto: 'listo, esperando un núcleo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada pedido necesita 2 unidades de CPU, 6 de E/S y otras 2 de CPU. Con un solo hilo, la CPU queda ociosa mientras se espera la E/S.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const r = simularHilos(est.k, est.nucleos, T);
      const izq = 34, paso = (W - izq - 10) / T;
      const COL = { cpu: C.s1, es: C.s3, espera: C.s4 };
      r.linea.forEach((l, i) => {
        const y = 8 + i * 26;
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`H${i + 1}`, 2, y + 10);
        l.forEach((m, t) => { ctx.fillStyle = COL[m]; ctx.fillRect(izq + t * paso, y, paso - 1, 20); });
      });
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
      const yb = 8 + est.k * 26 + 10;
      for (let t = 0; t <= T; t += 8) ctx.fillText(String(t), izq + t * paso, yb);
      const max = (T / 4) * est.nucleos;
      registro.textContent = `${est.k} hilo${est.k > 1 ? 's' : ''} en ${est.nucleos} núcleo${est.nucleos > 1 ? 's' : ''}: ${r.completados} pedidos en ${T} unidades. ` +
        (r.usoCPU > 0.95 ? 'La CPU está saturada: más hilos solo agregan espera.' : `La CPU se usa el ${Math.round(r.usoCPU * 100)} % del tiempo: más hilos aprovecharían la E/S.`);
      lectura.set([
        ['pedidos completados', String(r.completados)],
        ['uso de CPU', `${Math.round(r.usoCPU * 100)} %`],
        ['máximo posible', `${VIZ.fmt(max, 3)} pedidos`],
        ['hilos que saturan la CPU', String(Math.ceil((10 / 4) * est.nucleos))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('processes-threads', {
    intro: String.raw`
      <p>Un <strong>proceso</strong> es un programa en ejecución con su propio espacio de direcciones; un <strong>hilo</strong> (<em>thread</em>) es una
      secuencia de ejecución dentro de un proceso, que comparte la memoria con los demás hilos del mismo proceso. Cambiar de hilo es mucho más barato que
      cambiar de proceso, y por eso los servidores distribuidos atienden a muchos clientes con muchos hilos (o con eventos asíncronos).</p>
      <p>Cuando hay más hilos listos que núcleos, el <strong>planificador</strong> decide quién usa la CPU. Su política determina la espera promedio, la
      respuesta a los procesos interactivos y la justicia entre ellos. Y cuando los hilos esperan entrada y salida, tener varios permite que la CPU no
      quede ociosa: <strong>concurrencia</strong> aunque no haya <strong>paralelismo</strong> real.</p>`,
    visualizaciones: [
      {
        titulo: 'Planificación de la CPU',
        descripcion: 'Compare FCFS, SJF, SRTF y Round Robin con los mismos procesos. SJF minimiza la espera promedio; Round Robin con quantum pequeño reparte mejor, pero cambia más de contexto.',
        montar: montarPlanificacion,
      },
      {
        titulo: 'Un servidor con varios hilos',
        descripcion: 'Suba los hilos: mientras unos esperan la E/S otros usan la CPU, y el rendimiento crece hasta que la CPU se satura. Con más núcleos, el límite sube.',
        montar: montarHilos,
      },
    ],
    teoria: String.raw`
      <h2>Procesos e hilos</h2>
      <table>
        <tr><th></th><th>Proceso</th><th>Hilo</th></tr>
        <tr><td>Memoria</td><td>Espacio de direcciones propio</td><td>Compartida con su proceso</td></tr>
        <tr><td>Estado propio</td><td>Tabla de páginas, archivos, registros</td><td>Registros, pila, contador de programa</td></tr>
        <tr><td>Cambio de contexto</td><td>Caro (cambia la MMU, se vacía la TLB)</td><td>Barato</td></tr>
        <tr><td>Aislamiento</td><td>Fuerte</td><td>Ninguno: un error corrompe a todos</td></tr>
      </table>
      <p>Compartir memoria abre la puerta a las <strong>condiciones de carrera</strong>: el resultado depende del orden en que se intercalan los hilos (ver la
      <a href="tema.html?id=mutual-exclusion">actualización perdida</a>). Se evitan con exclusión mutua: locks, <a href="tema.html?id=semaphores">semáforos</a> o monitores.</p>

      <h2>Algoritmos de planificación</h2>
      <p>Con tiempo de llegada \(a_i\), ráfaga \(b_i\) y término \(f_i\): retorno \(T_i = f_i - a_i\), espera \(W_i = T_i - b_i\).</p>
      <ul>
        <li><strong>FCFS:</strong> simple y sin inanición, pero un proceso largo retrasa a todos los cortos (efecto convoy).</li>
        <li><strong>SJF / SRTF:</strong> elegir siempre la ráfaga (restante) más corta minimiza la espera promedio. Prueba por intercambio: si un trabajo largo va antes
        que uno corto, intercambiarlos baja la espera del corto en más de lo que sube la del largo. Requiere conocer las ráfagas (se estiman) y puede dejar sin CPU a los largos.</li>
        <li><strong>Round Robin:</strong> turnos de \(q\) unidades. Ningún proceso espera más de \((n-1)q\) entre turnos; si \(q\) es muy grande se vuelve FCFS, y si es muy
        pequeño domina el costo de los cambios de contexto.</li>
      </ul>

      <h2>Hilos y E/S</h2>
      <p>Si un pedido usa la CPU una fracción \(c\) de su tiempo y el resto espera E/S, con \(k\) hilos y \(m\) núcleos el uso de CPU es aproximadamente
      \(\min(1, kc/m)\): la CPU se satura con \(k \approx m/c\) hilos. En la figura \(c = 4/10\), así que bastan unos \(2{,}5\,m\) hilos.</p>

      <h2>Paralelismo y la ley de Amdahl</h2>
      <p>Si una fracción \(s\) del trabajo es secuencial, con \(p\) procesadores la aceleración es</p>
      \[ S(p) = \frac{1}{s + \frac{1-s}{p}} \;\le\; \frac{1}{s}. \]
      <p>Con \(s = 5\,\%\), ni infinitos procesadores dan más de 20 veces. Gustafson responde que con más procesadores se resuelven problemas más grandes, donde
      la parte paralela crece. En sistemas distribuidos la comunicación agrega además un costo que crece con \(p\).</p>`,
  });
})();
