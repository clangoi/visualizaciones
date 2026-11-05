(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarRanuras(cuerpo) {
    let N = 8, p = 12, sem = 1, res, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Nodos N', min: 2, max: 30, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Probabilidad de transmitir por ranura', min: 1, max: 60, valor: p, formato: (v) => v + ' %', alCambiar: (v) => { p = v; dibujar(); } });
    ctl.boton('Nueva simulación', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 120 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'ranura exitosa (1 nodo)' }, { color: C.s8, texto: 'colisión (2 o más)' }, { color: C.neutro, borde: C.eje, texto: 'vacía' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'ALOHA ranurado: en cada ranura cada nodo transmite con probabilidad p. Éxito solo si transmite exactamente uno. La eficiencia máxima teórica (N grande) es 1/e ≈ 37 %, con p = 1/N.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, S = 200, rnd = VIZ.semilla(sem * 31 + N * 3 + p);
      lienzo.limpiar();
      res = Array.from({ length: S }, () => { let k = 0; for (let i = 0; i < N; i++) if (rnd() < p / 100) k++; return k; });
      const filas = 4, por = Math.ceil(S / filas), bw = (W - 16) / por; geo = { bw, por };
      res.forEach((k, i) => { const x = 8 + (i % por) * bw, y = 10 + Math.floor(i / por) * 26; ctx.fillStyle = k === 1 ? C.s6 : k > 1 ? C.s8 : C.neutro; ctx.fillRect(x, y, Math.max(1, bw - 1), 22); });
      const ok = res.filter((k) => k === 1).length, col = res.filter((k) => k > 1).length, vac = S - ok - col, G = (N * p) / 100;
      lectura.set([['éxitos', `${ok} (${VIZ.fmt((ok / S) * 100, 3)} %)`], ['colisiones', `${col} (${VIZ.fmt((col / S) * 100, 3)} %)`], ['vacías', `${vac} (${VIZ.fmt((vac / S) * 100, 3)} %)`], ['teoría N·p·(1−p)^(N−1)', `${VIZ.fmt(N * (p / 100) * (1 - p / 100) ** (N - 1) * 100, 3)} %`], ['carga ofrecida G = N·p', VIZ.fmt(G, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!res) return;
      const { x, y } = lienzo.posicion(ev), i = Math.floor((y - 10) / 26) * geo.por + Math.floor((x - 8) / geo.bw);
      if (i >= 0 && i < res.length) tip.mostrar(x, y, `ranura <b>${i + 1}</b><br>${res[i]} nodo(s) transmitieron<br>${res[i] === 1 ? 'éxito' : res[i] > 1 ? 'colisión' : 'vacía'}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarCurvas(cuerpo) {
    let hover = null;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'ALOHA ranurado: G·e^(−G)', forma: 'linea' }, { color: C.s2, texto: 'ALOHA puro: G·e^(−2G)', forma: 'linea' }]);
    VIZ.nota(cuerpo, 'Eficiencia (fracción de tiempo útil) según la carga ofrecida G (intentos por ranura). Con demasiada carga, la eficiencia cae porque casi todo son colisiones.');
    const f = [(G) => G * Math.exp(-G), (G) => G * Math.exp(-2 * G)];
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0, ymax: 0.4 }, { etiquetaX: 'carga ofrecida G', etiquetaY: 'eficiencia', formatoY: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      [C.s1, C.s2].forEach((col, i) => { VIZ.trazar(ctx, plano, Array.from({ length: 201 }, (_, k) => [k / 50, f[i](k / 50)]), col, 2.5); if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(f[i](hover)), col, 4); });
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.s1; ctx.textAlign = 'left'; ctx.fillText('máximo 1/e ≈ 36,8 % en G = 1', plano.sx(1.1), plano.sy(0.372)); ctx.fillStyle = C.s2; ctx.fillText('máximo 1/(2e) ≈ 18,4 % en G = 0,5', plano.sx(0.6), plano.sy(0.2));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, plano.ix(x)); dibujar();
      tip.mostrar(x, y, `G = <b>${VIZ.fmt(hover, 3)}</b>` + VIZ.filaTooltip(C.s1, 'ranurado', VIZ.fmt(f[0](hover) * 100, 3) + ' %') + VIZ.filaTooltip(C.s2, 'puro', VIZ.fmt(f[1](hover) * 100, 3) + ' %'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('multiple-access-protocols', {
    intro: String.raw`
      <p>En un enlace <strong>de difusión</strong> (cable compartido, Wi-Fi) todos los nodos escuchan el mismo medio. Si dos transmiten a la vez, sus señales se mezclan y ambas se pierden: una <strong>colisión</strong>. Los <strong>protocolos de acceso múltiple</strong> (MAC) fijan las reglas para repartirse el canal.</p>
      <p>Hay tres familias: <em>por reparto</em> del canal (TDMA, FDMA), <em>por turnos</em> (paso de testigo) y <em>de acceso aleatorio</em> (ALOHA, CSMA/CD de Ethernet clásico, CSMA/CA de Wi-Fi), donde se transmite cuando se quiere y se resuelven las colisiones después.</p>`,
    visualizaciones: [
      { titulo: 'ALOHA ranurado', descripcion: 'Varíe nodos y probabilidad de transmitir: busque la combinación (p ≈ 1/N) que maximiza las ranuras exitosas. Más allá, domina la colisión.', montar: montarRanuras },
      { titulo: 'Eficiencia frente a carga', descripcion: 'Recorra las curvas del ALOHA puro y del ranurado con el cursor y ubique sus máximos.', montar: montarCurvas },
    ],
    teoria: String.raw`
      <h2>ALOHA ranurado</h2>
      <p>Con \(N\) nodos y probabilidad \(p\) de transmitir en cada ranura, la probabilidad de éxito es que transmita exactamente uno:</p>
      \[ S(p) = N p (1-p)^{N-1}, \qquad \max_p S = S(1/N) \xrightarrow{N\to\infty} \frac1e \approx 0{,}37. \]
      <p>En el ALOHA <em>puro</em> (sin ranuras) un intento colisiona con los que empiezan en una ventana de dos tiempos de trama, y la eficiencia máxima es \(1/(2e) \approx 0{,}18\).</p>
      <h2>CSMA y CSMA/CD</h2>
      <p>CSMA (<em>carrier sense</em>): «escuchar antes de hablar». Aun así hay colisiones por el retardo de propagación. Con <strong>CSMA/CD</strong> (<em>collision detection</em>, Ethernet clásico) el nodo escucha mientras transmite; si detecta colisión, aborta y espera un tiempo aleatorio con <em>retroceso exponencial binario</em>:</p>
      <pre><code>tras la k-ésima colisión consecutiva:
    elegir K al azar en {0, 1, …, 2^k − 1}
    esperar K × 512 tiempos de bit;  volver a escuchar</code></pre>
      <p>El rango de espera se duplica en cada colisión: se adapta a la cantidad de nodos en disputa sin conocerla. La eficiencia de CSMA/CD es \(\approx 1/(1 + 5\,t_{\text{prop}}/t_{\text{trans}})\), cercana a 1 si la propagación es corta frente a la transmisión.</p>
      <p>En Wi-Fi no se puede detectar la colisión mientras se transmite, así que se usa CSMA/CA (evitarla, con confirmaciones). Los switches modernos de <a href="tema.html?id=ethernet-switching">Ethernet</a> dan a cada host su propio enlace y eliminan el problema.</p>`,
  });
})();
