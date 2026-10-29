(function () {
  'use strict';
  const { color: C } = VIZ;

  const POLITICAS = [
    { clave: 'azar', nombre: 'Al azar', color: C.s1 },
    { clave: 'turnos', nombre: 'Por turnos', color: C.s2 },
    { clave: 'dos', nombre: 'Dos al azar, el menos cargado', color: C.s3 },
    { clave: 'jsq', nombre: 'El menos cargado de todos', color: C.s4 },
  ];

  /* Simulación por eventos: llegadas de Poisson con tasa ρ·k, servicios exponenciales de media 1, k servidores con cola FIFO.
     Devuelve el tiempo de respuesta medio, su percentil 99 y fotos de las colas. */
  function simular(k, rho, pol, T, rnd, fotos = 0) {
    const exp = (tasa) => -Math.log(1 - rnd()) / tasa;
    const colas = Array.from({ length: k }, () => []), fin = new Array(k).fill(Infinity);
    let t = 0, prox = exp(rho * k), turno = 0;
    const resp = [], marcos = [];
    let sigFoto = 0;
    const paso = fotos ? T / fotos : Infinity;
    while (t < T) {
      let s = -1, tf = Infinity;
      for (let i = 0; i < k; i++) if (fin[i] < tf) { tf = fin[i]; s = i; }
      const tn = Math.min(prox, tf);
      while (sigFoto <= tn && sigFoto < T && fotos) { marcos.push({ t: sigFoto, colas: colas.map((c) => c.length) }); sigFoto += paso; }
      t = tn;
      if (prox <= tf) {
        let i;
        if (pol === 'azar') i = Math.floor(rnd() * k);
        else if (pol === 'turnos') i = turno++ % k;
        else if (pol === 'dos') { const a = Math.floor(rnd() * k), b = Math.floor(rnd() * k); i = colas[a].length <= colas[b].length ? a : b; }
        else { i = 0; for (let j = 1; j < k; j++) if (colas[j].length < colas[i].length) i = j; }
        colas[i].push(t);
        if (colas[i].length === 1) fin[i] = t + exp(1);
        prox = t + exp(rho * k);
      } else {
        const llegada = colas[s].shift();
        if (t > T * 0.1) resp.push(t - llegada);
        fin[s] = colas[s].length ? t + exp(1) : Infinity;
      }
    }
    resp.sort((a, b) => a - b);
    return { media: resp.reduce((a, b) => a + b, 0) / Math.max(1, resp.length), p99: resp[Math.floor(resp.length * 0.99)] || 0, marcos };
  }

  /* ---------- Fig. 1: las colas en vivo ---------- */

  function montarColas(cuerpo) {
    const est = { k: 8, rho: 0.85, semilla: 1 };
    let sims, f = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Servidores', min: 2, max: 12, valor: est.k, alCambiar: (v) => { est.k = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Utilización ρ', min: 0.3, max: 0.98, paso: 0.01, valor: est.rho, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { est.rho = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Otra simulación', () => { est.semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 420 : 240) });
    VIZ.leyenda(cuerpo, POLITICAS.map((p) => ({ color: p.color, texto: p.nombre })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La misma secuencia de pedidos se reparte con cada política entre los servidores; cada barra es la cola de un servidor. El tiempo de servicio medio es 1.');

    function iniciar() {
      sims = POLITICAS.map((p) => simular(est.k, est.rho, p.clave, 400, VIZ.semilla(est.semilla * 7 + 1), 200));
      f = 0;
      return (function* () { for (f = 0; f < 200; f++) yield; f = 199; })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const cols = angosto ? 2 : 4, filas = angosto ? 2 : 1;
      const pw = W / cols, ph = H / filas;
      const maxQ = Math.max(6, ...sims.flatMap((s) => s.marcos[f] ? s.marcos[f].colas : [0]));
      POLITICAS.forEach((p, j) => {
        const ox = (j % cols) * pw, oy = Math.floor(j / cols) * ph;
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = p.color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(p.nombre.split(',')[0], ox + 8, oy + 4);
        const m = sims[j].marcos[f];
        const base = oy + ph - 20, alto = ph - 46, bw = (pw - 24) / est.k;
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox + 8, base + 0.5); ctx.lineTo(ox + pw - 12, base + 0.5); ctx.stroke();
        if (!m) return;
        m.colas.forEach((q, i) => {
          const h = (q / maxQ) * alto;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.roundRect(ox + 10 + i * bw, base - h, Math.max(2, bw - 3), h, [3, 3, 0, 0]); ctx.fill();
        });
        const total = m.colas.reduce((a, b) => a + b, 0);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'alphabetic';
        ctx.fillText(`en el sistema: ${total}`, ox + 8, base + 14);
      });
      lectura.set(POLITICAS.map((p, j) => [p.nombre.split(',')[0], `resp. media ${VIZ.fmt(sims[j].media, 3)} · p99 ${VIZ.fmt(sims[j].p99, 3)}`]));
    }
    lienzo.alDibujar = () => sims && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: respuesta según la utilización ---------- */

  function montarCurva(cuerpo) {
    let k = 10, datos = null, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Servidores', min: 2, max: 20, valor: k, alCambiar: (v) => { k = v; medir(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...POLITICAS.map((p) => ({ color: p.color, texto: p.nombre, forma: 'linea' })), { color: C.apagado, texto: '1/(1 − ρ): un servidor M/M/1', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tiempo de respuesta medio (en múltiplos del tiempo de servicio) medido en simulación. Pase el cursor por el gráfico.');

    const RHOS = [0.3, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95];
    function medir() {
      datos = RHOS.map((rho, i) => {
        const fila = { rho };
        POLITICAS.forEach((p, j) => { fila[p.clave] = simular(k, rho, p.clave, 1500, VIZ.semilla(100 + i * 10 + j)).media; });
        return fila;
      });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0.3, xmax: 0.95, ymin: 0, ymax: 21 }, { etiquetaX: 'utilización ρ', etiquetaY: 'tiempo de respuesta medio', formatoX: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      const ref = []; for (let r = 0.3; r <= 0.951; r += 0.01) ref.push([r, 1 / (1 - r)]);
      VIZ.trazar(ctx, plano, ref, C.apagado, 1.5, [3, 4]);
      for (const p of POLITICAS) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.rho, Math.min(d[p.clave], 21)]), p.color, 2);
        if (hover) VIZ.marcador(ctx, plano.sx(hover.rho), plano.sy(Math.min(hover[p.clave], 21)), p.color, 4.5);
      }
      const u = datos[datos.length - 2];
      lectura.set(POLITICAS.map((p) => [`${p.nombre.split(',')[0]} (ρ = 90 %)`, VIZ.fmt(u[p.clave], 3)]));
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const r = plano.ix(x);
      hover = datos.reduce((m, d) => (Math.abs(d.rho - r) < Math.abs(m.rho - r) ? d : m));
      dibujar();
      tip.mostrar(x, y, `ρ = <b>${Math.round(hover.rho * 100)} %</b>` + POLITICAS.map((p) => VIZ.filaTooltip(p.color, p.nombre, VIZ.fmt(hover[p.clave], 3))).join('') + VIZ.filaTooltip(C.apagado, 'M/M/1', VIZ.fmt(1 / (1 - hover.rho), 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
  }

  VIZ.registrarTema('scalability-load-balancing', {
    intro: String.raw`
      <p>Un sistema es <strong>escalable</strong> si puede crecer (más usuarios, más datos, más distancia) agregando recursos sin que el rendimiento se degrade de forma desproporcionada.
      Escalar <em>verticalmente</em> es comprar una máquina más grande; escalar <em>horizontalmente</em>, agregar máquinas. Lo segundo no tiene techo, pero exige repartir el trabajo:
      un <strong>balanceador de carga</strong> decide a qué servidor va cada pedido.</p>
      <p>La política de reparto importa más de lo que parece. Repartir al azar deja colas largas en unos servidores mientras otros están ociosos; mirar la carga de todos cuesta
      información; y una idea sorprendente, <strong>el poder de dos opciones</strong>, logra casi lo mismo mirando solo dos servidores al azar.</p>`,
    visualizaciones: [
      {
        titulo: 'Las colas en vivo',
        descripcion: 'Reproduzca con utilización alta (85–95 %): al azar aparecen colas largas en servidores puntuales; con «dos al azar» las colas quedan parejas. Compare los tiempos de respuesta medio y percentil 99.',
        montar: montarColas,
      },
      {
        titulo: 'Respuesta según la utilización',
        descripcion: 'Todas las políticas explotan al acercarse al 100 %, pero a ritmos muy distintos. Repartir al azar equivale a k servidores independientes con cola propia, la curva gris.',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Utilización y tiempo de respuesta</h2>
      <p>Un servidor que recibe pedidos a tasa \(\lambda\) y atiende a tasa \(\mu\) tiene utilización \(\rho = \lambda/\mu\). Si las llegadas son de Poisson y los servicios exponenciales (cola
      M/M/1), el tiempo de respuesta medio es</p>
      \[ T = \frac{1/\mu}{1 - \rho}, \]
      <p>que se duplica al pasar del 50 al 75 % y se multiplica por 10 al 90 %. Por eso los sistemas se dimensionan con holgura, y por eso pequeñas mejoras del reparto valen mucho cerca de la
      saturación. Con la ley de Little, \(L = \lambda T\): el número de pedidos en el sistema crece igual.</p>

      <h2>Políticas de reparto</h2>
      <table>
        <tr><th>Política</th><th>Información</th><th>Comportamiento</th></tr>
        <tr><td>Al azar</td><td>Ninguna</td><td>\(k\) colas M/M/1 independientes: \(T = 1/(1-\rho)\)</td></tr>
        <tr><td>Por turnos</td><td>Un contador</td><td>Llegadas más regulares a cada servidor; mejora algo</td></tr>
        <tr><td>Dos al azar</td><td>Carga de 2 servidores</td><td>Casi tan buena como la óptima</td></tr>
        <tr><td>Menos cargado (JSQ)</td><td>Carga de todos</td><td>Óptima en este modelo, pero requiere información global y fresca</td></tr>
      </table>
      <div class="recuadro"><p><strong>El poder de dos opciones</strong> (Azar, Broder, Karlin, Upfal; Mitzenmacher, 1996). Al repartir \(n\) bolas en \(n\) urnas al azar, la urna más llena
      tiene \(\Theta(\log n / \log\log n)\) bolas; eligiendo la menos llena entre dos al azar, solo \(\log_2 \log n + O(1)\): una mejora exponencial con una sola consulta extra. En colas, la
      fracción de servidores con al menos \(i\) pedidos cae como \(\rho^{2^i - 1}\) en vez de \(\rho^i\).</p></div>
      <p>«El menos cargado de todos» tiene un problema en sistemas distribuidos: con varios balanceadores e información atrasada, todos envían al mismo servidor que parecía libre
      (<em>herding</em>). Las opciones al azar son robustas a eso.</p>

      <h2>Dimensiones de la escalabilidad</h2>
      <ul>
        <li><strong>Tamaño:</strong> evitar cuellos centralizados (un servidor, una base de datos, un algoritmo que necesita información global).</li>
        <li><strong>Geografía:</strong> la latencia no baja agregando máquinas; se oculta con asincronía, réplicas cercanas y cachés.</li>
        <li><strong>Administración:</strong> varias organizaciones con políticas distintas.</li>
      </ul>
      <p>Las técnicas generales son particionar (datos por <a href="tema.html?id=consistent-hashing">hashing consistente</a>), replicar (con su costo de
      <a href="tema.html?id=quorum-replication">consistencia</a>) y balancear la carga, incluso <a href="tema.html?id=virtualization-migration">migrando</a> máquinas virtuales.</p>`,
  });
})();
