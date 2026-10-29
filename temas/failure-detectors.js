(function () {
  'use strict';
  const { color: C } = VIZ;

  /* El proceso vigilado envía un latido cada segundo hasta caer en tCaida. La demora de la red es 50 ms más una cola
     exponencial (media «jitter») y, de vez en cuando, una congestión larga. */
  function latidos(T, tCaida, jitter, semilla) {
    const rnd = VIZ.semilla(semilla);
    const llegadas = [];
    let congestion = 0;
    for (let t = 0; t < Math.min(T, tCaida); t += 1) {
      if (rnd() < 0.02) congestion = 1 + rnd() * 3;
      const d = 0.05 - Math.log(1 - rnd()) * jitter + (congestion > 0 ? congestion : 0);
      congestion = Math.max(0, congestion - 1);
      llegadas.push({ envio: t, llega: t + d });
    }
    return llegadas.sort((a, b) => a.llega - b.llega);
  }

  // Intervalos de sospecha con timeout fijo: se sospecha si pasan más de «to» segundos sin latidos nuevos.
  function sospechas(llegadas, to, T) {
    const iv = [];
    let ultimo = 0;
    for (const l of llegadas) {
      if (l.llega - ultimo > to) iv.push([ultimo + to, l.llega]);
      ultimo = Math.max(ultimo, l.llega);
    }
    if (T - ultimo > to) iv.push([ultimo + to, T]);
    return iv;
  }

  /* ---------- Fig. 1: línea de tiempo ---------- */

  function montarLinea(cuerpo) {
    const est = { to: 1.6, jitter: 0.15, semilla: 4 };
    const T = 60, tCaida = 45;
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Timeout', min: 1.1, max: 6, paso: 0.1, valor: est.to, formato: (v) => `${v.toFixed(1)} s`, alCambiar: (v) => { est.to = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Variabilidad de la red', min: 0.02, max: 0.6, paso: 0.02, valor: est.jitter, formato: (v) => `${Math.round(v * 1000)} ms`, alCambiar: (v) => { est.jitter = v; dibujar(); } });
    ctl.boton('Otra red', () => { est.semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'llegada de un latido (altura = demora)', forma: 'punto' },
      { color: C.s8, texto: 'sospecha falsa (el proceso estaba vivo)' },
      { color: C.s6, texto: 'sospecha correcta (ya cayó)' },
      { color: C.apagado, texto: 'caída real', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El proceso envía un latido por segundo y cae en t = 45 s. El monitor sospecha cuando pasa más que el timeout sin latidos.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ll = latidos(T, tCaida, est.jitter, est.semilla * 7);
      const iv = sospechas(ll, est.to, T);
      const ymax = Math.max(1, ...ll.map((l) => l.llega - l.envio)) * 1.1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: T, ymin: 0, ymax }, { etiquetaX: 'tiempo (s)', etiquetaY: 'demora (s)' });
      plano.ejes();
      for (const [a, b] of iv) {
        const falsa = a < tCaida;
        ctx.fillStyle = VIZ.alfa(falsa ? C.s8 : C.s6, 0.22);
        ctx.fillRect(plano.sx(a), plano.y1, plano.sx(Math.min(b, falsa ? Math.min(b, tCaida) : b)) - plano.sx(a), plano.y0 - plano.y1);
      }
      VIZ.trazar(ctx, plano, [[tCaida, 0], [tCaida, ymax]], C.apagado, 1.5, [3, 4]);
      for (const l of ll) VIZ.marcador(ctx, plano.sx(l.llega), plano.sy(l.llega - l.envio), C.s1, 3);
      const falsas = iv.filter(([a]) => a < tCaida);
      const det = iv.find(([a, b]) => b >= T && a >= tCaida - est.to);
      lectura.set([
        ['sospechas falsas', String(falsas.length)],
        ['tiempo sospechando por error', `${VIZ.fmt(falsas.reduce((s, [a, b]) => s + b - a, 0), 3)} s`],
        ['detección de la caída', det ? `${VIZ.fmt(det[0] - tCaida, 3)} s después` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: el compromiso ---------- */

  function montarCompromiso(cuerpo) {
    let jitter = 0.15, datos = null, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variabilidad de la red', min: 0.02, max: 0.6, paso: 0.02, valor: jitter, formato: (v) => `${Math.round(v * 1000)} ms`, alCambiar: (v) => { jitter = v; medir(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'timeout fijo (etiqueta: segundos)', forma: 'linea' }, { color: C.s2, texto: 'adaptativo: media + k · desviación (etiqueta: k)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '20 ejecuciones de una hora por punto. Cada punto es una configuración del detector. Pase el cursor por un punto.');

    function medir() {
      const T = 3600, tCaida = 3540;
      const runs = Array.from({ length: 20 }, (_, r) => latidos(T, tCaida, jitter, 1000 + r));
      const evalua = (fto) => {
        let falsas = 0, det = 0;
        for (const ll of runs) {
          const iv = sospechasAdapt(ll, fto, T);
          falsas += iv.filter(([a]) => a < tCaida).length;
          const d = iv.find(([a, b]) => b >= T && a >= tCaida - 10);
          det += d ? d[0] - tCaida : 10;
        }
        return { falsas: falsas / runs.length, det: det / runs.length };
      };
      datos = {
        fijo: [1.1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4, 5].map((to) => ({ etq: `${to}`, ...evalua(() => to) })),
        adapt: [1, 2, 3, 4, 6, 8].map((k) => ({ etq: `${k}`, ...evalua((m, sd) => Math.max(1.02, m + k * sd)) })),
      };
      dibujar();
    }
    // Timeout dependiente de la historia: f(media, desviación) de los intervalos entre llegadas.
    function sospechasAdapt(ll, f, T) {
      const iv = [], ventana = [];
      let ultimo = 0, suma = 0, suma2 = 0;
      const plazo = () => {
        const n = ventana.length;
        const m = n ? suma / n : 1;
        const sd = n > 1 ? Math.sqrt(Math.max(0, suma2 / n - m * m)) : 0.1;
        return f(m, sd);
      };
      for (const l of ll) {
        const to = plazo();
        if (l.llega - ultimo > to) iv.push([ultimo + to, l.llega]);
        const x = l.llega - ultimo;
        ventana.push(x); suma += x; suma2 += x * x;
        if (ventana.length > 100) { const y = ventana.shift(); suma -= y; suma2 -= y * y; }
        ultimo = Math.max(ultimo, l.llega);
      }
      const to = plazo();
      if (T - ultimo > to) iv.push([ultimo + to, T]);
      return iv;
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = [...datos.fijo, ...datos.adapt];
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(6, ...todos.map((d) => d.det)) * 1.05, ymin: 0, ymax: Math.max(1, ...todos.map((d) => d.falsas)) * 1.1 },
        { etiquetaX: 'tiempo para detectar una caída (s)', etiquetaY: 'sospechas falsas por hora' });
      plano.ejes();
      for (const [clave, col, forma] of [['fijo', C.s1, 0], ['adapt', C.s2, 1]]) {
        VIZ.trazar(ctx, plano, datos[clave].map((d) => [d.det, d.falsas]), col, 2);
        let previo = null;
        for (const d of datos[clave]) {
          VIZ.marcador(ctx, plano.sx(d.det), plano.sy(d.falsas), col, hover === d ? 6 : 4, forma);
          const px = plano.sx(d.det), py = plano.sy(d.falsas) - 10;
          if (previo && Math.hypot(px - previo[0], py - previo[1]) < 18) continue;
          previo = [px, py];
          ctx.font = VIZ.fuente(10); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(d.etq, px, clave === 'fijo' ? py : py + 24);
        }
      }
      const mejor = (l, lim) => { const c = l.filter((d) => d.det <= lim); return c.length ? VIZ.fmt(Math.min(...c.map((d) => d.falsas)), 3) : '—'; };
      lectura.set([
        ['fijo, detectando en ≤ 2 s', `${mejor(datos.fijo, 2)} falsas/h`],
        ['adaptativo, en ≤ 2 s', `${mejor(datos.adapt, 2)} falsas/h`],
        ['fijo, en ≤ 4 s', `${mejor(datos.fijo, 4)} falsas/h`],
        ['adaptativo, en ≤ 4 s', `${mejor(datos.adapt, 4)} falsas/h`],
      ]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      let mejor = null, dm = 18, tipo = '';
      for (const [k, t] of [['fijo', 'timeout'], ['adapt', 'k']]) for (const d of datos[k]) {
        const dd = Math.hypot(plano.sx(d.det) - x, plano.sy(d.falsas) - y);
        if (dd < dm) { dm = dd; mejor = d; tipo = t; }
      }
      hover = mejor; dibujar();
      if (mejor) tip.mostrar(x, y, `${tipo} = <b>${mejor.etq}</b><br>detección <b>${VIZ.fmt(mejor.det, 3)} s</b><br>falsas por hora <b>${VIZ.fmt(mejor.falsas, 3)}</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
  }

  VIZ.registrarTema('failure-detectors', {
    intro: String.raw`
      <p>En un sistema asíncrono no se puede distinguir un proceso caído de uno lento o de una red congestionada: el silencio no prueba nada. Aun así, casi todos los
      protocolos (elección de líder, consenso, replicación) necesitan una opinión sobre quién está vivo. Un <strong>detector de fallas</strong> es el módulo que la entrega,
      sabiendo que puede equivocarse.</p>
      <p>La técnica básica son los <strong>latidos</strong> (<em>heartbeats</em>): el proceso vigilado envía «estoy vivo» periódicamente y el monitor sospecha si pasa
      demasiado tiempo sin noticias. El tamaño de ese plazo es un compromiso inevitable entre detectar rápido y no acusar a procesos sanos.</p>`,
    visualizaciones: [
      {
        titulo: 'Latidos y sospechas',
        descripcion: 'Baje el timeout: la caída se detecta antes, pero cada demora larga de la red produce una sospecha falsa (rojo). Aumente la variabilidad y observe cuánto hay que subirlo.',
        montar: montarLinea,
      },
      {
        titulo: 'Detectar rápido o equivocarse poco',
        descripcion: 'Cada punto es un detector. Abajo a la izquierda sería ideal y es imposible: cada segundo menos de detección se paga con más sospechas falsas. El timeout adaptativo se calibra solo con la variabilidad observada, pero las congestiones largas engañan a ambos.',
        montar: montarCompromiso,
      },
    ],
    teoria: String.raw`
      <h2>Modelos de falla</h2>
      <table>
        <tr><th>Falla</th><th>Comportamiento</th></tr>
        <tr><td>Caída (<em>crash</em>)</td><td>El proceso se detiene y no hace nada más (fail-stop si los demás lo detectan con certeza)</td></tr>
        <tr><td>Omisión</td><td>Se pierden mensajes enviados o recibidos</td></tr>
        <tr><td>Temporización</td><td>Responde fuera de las cotas de tiempo especificadas</td></tr>
        <tr><td>Respuesta</td><td>Responde con un valor incorrecto</td></tr>
        <tr><td>Bizantina</td><td>Comportamiento arbitrario, incluso malicioso (ver <a href="tema.html?id=byzantine-generals">generales bizantinos</a>)</td></tr>
      </table>

      <h2>Propiedades</h2>
      <p>Chandra y Toueg (1996) describen un detector por dos propiedades:</p>
      <ul>
        <li><strong>Completitud fuerte:</strong> todo proceso caído termina siendo sospechado por todos los correctos.</li>
        <li><strong>Exactitud:</strong> fuerte (nadie es sospechado antes de caer), débil (algún correcto nunca es sospechado), y sus versiones <em>eventuales</em> (◇: valen desde
        algún momento en adelante).</li>
      </ul>
      <p>El detector perfecto \(\mathcal{P}\) exige un sistema síncrono. El eventualmente perfecto \(\Diamond\mathcal{P}\) se implementa con latidos y timeouts que crecen cada
      vez que una sospecha resulta falsa; y el más débil, \(\Diamond\mathcal{W}\), ya basta para resolver consenso con una mayoría de procesos correctos, esquivando la
      imposibilidad de Fischer, Lynch y Paterson para sistemas totalmente asíncronos.</p>

      <h2>Timeouts adaptativos</h2>
      <p>Con latidos cada \(\Delta\) y demoras aleatorias, el próximo latido se espera en \(\mu\) (la media de los intervalos observados). Fijar el plazo en \(\mu + k\sigma\) adapta el
      detector a la red. El detector <strong>φ de acumulación</strong> (Hayashibara et al., 2004, usado en Cassandra y Akka) va más lejos: en vez de un sí o un no, entrega un
      nivel de sospecha</p>
      \[ \varphi(t) = -\log_{10} \Pr[\text{el próximo latido llega después de } t], \]
      <p>y cada aplicación elige su umbral: \(\varphi = 1\) es un 10 % de probabilidad de equivocarse; \(\varphi = 3\), un 0,1 %.</p>`,
  });
})();
