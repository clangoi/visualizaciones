(function () {
  'use strict';
  const { color: C } = VIZ;

  // Cada hilo alterna CPU y E/S bloqueante: [cpu, io, cpu, io, cpu].
  const PLAN = [3, 3, 3, 3, 3];
  function simular(modelo, hilos, nucleos) {
    const est = Array.from({ length: hilos }, () => ({ i: 0, rest: PLAN[0], estado: 'listo' })); // listo | cpu | io | fin
    const filas = Array.from({ length: hilos }, () => []);
    let t = 0;
    while (est.some((h) => h.estado !== 'fin') && t < 400) {
      const bloqueaTodo = modelo === 'm1' && est.some((h) => h.estado === 'io'); // muchos-a-uno: una E/S bloquea al proceso
      let libres = modelo === 'm1' ? 1 : nucleos;
      est.forEach((h) => { if (h.estado === 'cpu') h.estado = 'listo'; });
      const vivos = est.filter((h) => h.estado === 'listo' || h.estado === 'cpu');
      if (!bloqueaTodo) for (const h of vivos) if (libres > 0) { h.estado = 'cpu'; libres--; }
      est.forEach((h, k) => {
        filas[k].push(h.estado === 'fin' ? 0 : h.estado === 'cpu' ? 1 : h.estado === 'io' ? 2 : 3);
        if (h.estado === 'cpu') { h.rest--; if (h.rest === 0) { h.i++; if (h.i >= PLAN.length) h.estado = 'fin'; else { h.rest = PLAN[h.i]; h.estado = h.i % 2 ? 'io' : 'listo'; } } }
        else if (h.estado === 'io') { h.rest--; if (h.rest === 0) { h.i++; h.rest = PLAN[h.i]; h.estado = 'listo'; } }
      });
      // en muchos-a-uno la E/S bloqueante detiene el reloj de todos: se marca como espera
      if (bloqueaTodo) est.forEach((h, k) => { if (h.estado === 'listo') filas[k][filas[k].length - 1] = 3; });
      t++;
    }
    return { filas, total: t };
  }

  function montarModelos(cuerpo) {
    let modelo = 'm1', hilos = 4, nuc = 4;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: [['m1', 'Muchos a uno (hilos de usuario)'], ['11', 'Uno a uno (hilos del núcleo)']], valor: modelo, alCambiar: (v) => { modelo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Hilos', min: 1, max: 8, valor: hilos, alCambiar: (v) => { hilos = v; lienzo.ajustar(true); } });
    ctl.rango({ etiqueta: 'Núcleos', min: 1, max: 8, valor: nuc, alCambiar: (v) => { nuc = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + hilos * 24 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'ejecutando en CPU' }, { color: C.s4, texto: 'bloqueado en E/S' }, { color: C.neutro, borde: C.eje, texto: 'listo, esperando CPU' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada hilo hace 3 ráfagas de CPU de 3 unidades separadas por 2 esperas de E/S de 3 unidades. En el modelo muchos-a-uno, una E/S bloqueante detiene a todos los hilos.');
    let r, geo;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      r = simular(modelo, hilos, nuc);
      const izq = 52, esc = (W - izq - 12) / Math.max(r.total, 1);
      geo = { izq, esc };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      for (let k = 0; k <= r.total; k += r.total > 40 ? 10 : 5) { ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.fillText(String(k), izq + k * esc, 9); }
      r.filas.forEach((f, k) => {
        const y = 22 + k * 24; ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText('hilo ' + (k + 1), izq - 8, y + 10);
        f.forEach((e, t) => {
          if (!e) return;
          ctx.fillStyle = e === 1 ? C.s1 : e === 2 ? C.s4 : C.neutro; ctx.fillRect(izq + t * esc, y, Math.max(1, esc - 0.5), 20);
        });
      });
      const cpu = r.filas.flat().filter((e) => e === 1).length;
      lectura.set([['tiempo total', `${r.total} unidades`], ['trabajo de CPU', String(cpu)], ['CPU ocupada', `${VIZ.fmt((cpu / (r.total * (modelo === 'm1' ? 1 : Math.min(nuc, hilos)))) * 100, 3)} %`], ['aceleración vs. un hilo', `${VIZ.fmt((hilos * 21) / r.total, 3)}×`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), k = Math.floor((y - 22) / 24), t = Math.floor((x - geo.izq) / geo.esc);
      if (!r || !r.filas[k] || t < 0 || t >= r.total) return tip.ocultar();
      tip.mostrar(x, y, `hilo ${k + 1}, t = ${t}<br><b>${['terminado', 'en CPU', 'en E/S', 'listo'][r.filas[k][t]]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarAmdahl(cuerpo) {
    let s = 10, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Fracción secuencial', min: 0, max: 50, valor: s, formato: (v) => v + ' %', alCambiar: (v) => { s = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'aceleración de Amdahl', forma: 'linea' }, { color: C.apagado, texto: 'ideal (lineal)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Aunque la parte paralela se reparta perfectamente, la parte secuencial limita la mejora total.');
    const A = (p) => 1 / (s / 100 + (1 - s / 100) / p);
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 64, ymin: 0, ymax: 64 }, { etiquetaX: 'núcleos p', etiquetaY: 'aceleración' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[1, 1], [64, 64]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, Array.from({ length: 64 }, (_, i) => [i + 1, A(i + 1)]), C.s1, 2);
      if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(A(hover)), C.s1, 4);
      lectura.set([['límite 1/s', s ? VIZ.fmt(100 / s, 3) + '×' : '∞'], ['con 8 núcleos', VIZ.fmt(A(8), 3) + '×'], ['con 64 núcleos', VIZ.fmt(A(64), 3) + '×']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.round(plano.ix(x))); dibujar();
      tip.mostrar(x, y, `p = <b>${hover}</b>${VIZ.filaTooltip(C.s1, 'aceleración', VIZ.fmt(A(hover), 3) + '×')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('threads-models', {
    intro: String.raw`
      <p>Un <strong>hilo</strong> (<em>thread</em>) es un flujo de ejecución dentro de un proceso. Los hilos de un mismo proceso comparten memoria y archivos abiertos, pero cada uno tiene su propia pila y sus registros; por eso crearlos y cambiar entre ellos es mucho más barato que con procesos.</p>
      <p>Dos preguntas importan: <strong>quién</strong> administra los hilos (la biblioteca en espacio de usuario o el núcleo) y <strong>cuánto</strong> se puede ganar con varios núcleos. La respuesta a lo segundo la limita la parte del programa que no se puede paralelizar.</p>`,
    visualizaciones: [
      { titulo: 'Hilos de usuario y del núcleo', descripcion: 'Con el modelo muchos-a-uno, una E/S bloqueante detiene a todos los hilos y los núcleos extra no sirven. Cambie al modelo uno-a-uno y suba los núcleos.', montar: montarModelos },
      { titulo: 'Ley de Amdahl', descripcion: 'Aumente la fracción secuencial y vea cómo la curva se aplana lejos de la recta ideal.', montar: montarAmdahl },
    ],
    teoria: String.raw`
      <h2>Modelos de hilos</h2>
      <table class="tabla-datos"><tr><th class="izq">Modelo</th><th class="izq">Idea</th><th class="izq">Ventajas</th><th class="izq">Problemas</th></tr>
      <tr><td class="izq">muchos a uno</td><td class="izq">muchos hilos de usuario sobre un hilo del núcleo</td><td class="izq">cambio muy rápido, sin llamadas al sistema</td><td class="izq">una E/S bloqueante detiene todo; sin paralelismo</td></tr>
      <tr><td class="izq">uno a uno</td><td class="izq">cada hilo de usuario es un hilo del núcleo</td><td class="izq">paralelismo real, E/S independiente</td><td class="izq">creación más cara</td></tr>
      <tr><td class="izq">muchos a muchos</td><td class="izq">\(m\) hilos de usuario sobre \(n \le m\) del núcleo</td><td class="izq">flexible</td><td class="izq">complejo</td></tr></table>
      <p>Los sistemas modernos (Linux, Windows) usan uno a uno. <strong>Concurrencia</strong> es tener varias tareas en progreso (aunque sea intercaladas en un núcleo); <strong>paralelismo</strong> es ejecutarlas literalmente a la vez en varios núcleos.</p>
      <h2>Qué comparten</h2>
      <p>Comparten: código, datos globales, montículo, archivos. No comparten: pila, registros, contador de programa. Compartir datos es lo que hace necesaria la <a href="tema.html?id=race-conditions">sincronización</a>.</p>
      <h2>Ley de Amdahl</h2>
      <p>Si una fracción \(s\) del trabajo es secuencial, con \(p\) núcleos la aceleración es</p>
      \[ A(p) = \frac{1}{s + \dfrac{1-s}{p}} \;\xrightarrow{p\to\infty}\; \frac{1}{s}. \]
      <p>Con \(s = 10\,\%\), ningún número de núcleos supera \(10\times\). Para aprovechar más núcleos hay que reducir la parte secuencial, incluida la que introducen los <a href="tema.html?id=locks-atomics">locks</a> (secciones críticas largas la aumentan).</p>`,
  });
})();
