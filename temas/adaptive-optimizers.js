(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  const OPTS = [
    ['sgd', 'SGD', C.s1, 0.04, { }],
    ['momentum', 'Momentum', C.s2, 0.012, { mom: 0.9 }],
    ['adagrad', 'AdaGrad', C.s3, 0.6, { }],
    ['rmsprop', 'RMSProp', C.s7, 0.08, { rho: 0.9 }],
    ['adam', 'Adam', C.s6, 0.12, { }],
  ];

  /* ---------- Fig. 1: carrera de optimizadores sobre una superficie ---------- */

  function montarCarrera(cuerpo) {
    let sup = 'valle', escala = 1, activos = { sgd: true, momentum: true, adagrad: true, rmsprop: true, adam: true }, corr = [], pl = null, t = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Superficie', opciones: Object.entries(DL.SUP).map(([k, v]) => [k, v.nombre]), valor: sup, alCambiar: (v) => { sup = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Escala de la tasa (× la de cada método)', min: 0.25, max: 3, paso: 0.05, valor: escala, formato: (v) => `× ${VIZ.fmt(v, 2)}`, alCambiar: (v) => { escala = v; rep.reiniciar(); } });
    ctl.casillas(OPTS.map(([k, n, c]) => ({ clave: k, texto: n, color: c, activo: true })), (e) => { activos = e; dibujar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 430 });
    const tip = VIZ.tooltip(lienzo);
    const fondo = DL.cache(lienzo);
    VIZ.leyenda(cuerpo, [...OPTS.map(([, n, c]) => ({ color: c, texto: n, forma: 'linea' })), { color: C.tinta, texto: 'mínimo', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todos parten del mismo punto. SGD y Momentum necesitan una tasa pequeña porque el gradiente es muy distinto según la dirección; AdaGrad, RMSProp y Adam normalizan cada coordenada y avanzan parejo. En «Punto de silla» observe quién se detiene en la silla y quién sigue.');
    function iniciar() {
      const S = DL.SUP[sup];
      corr = OPTS.map(([k, , , lr, extra]) => ({ k, th: S.ini.slice(), ruta: [S.ini.slice()], op: DL.optimizador(k, Object.assign({ lr: lr * escala }, extra)) }));
      t = 0;
      return (function* () {
        while (t < 300) {
          for (const c of corr) { const g = S.g(...c.th); c.th = c.op.paso(c.th, g); c.th = c.th.map((v) => Math.max(-20, Math.min(20, v))); c.ruta.push(c.th.slice()); }
          t++;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!corr.length) return;
      const S = DL.SUP[sup], { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, S.dom, { etiquetaX: 'θ₁', etiquetaY: 'θ₂' });
      pl.ejes();
      fondo(sup, (c) => S.niveles.forEach((v) => ML.contorno(c, pl, S.f, v, { color: C.tenue, ancho: 1.3, paso: 6 })));
      ctx.save(); pl.recortar();
      OPTS.forEach(([k, , col]) => { if (!activos[k]) return; const c = corr.find((q) => q.k === k); VIZ.trazar(ctx, pl, c.ruta, col, 2); });
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(S.opt[0]), pl.sy(S.opt[1]), C.tinta, 6, 5);
      OPTS.forEach(([k, , col]) => { if (!activos[k]) return; const c = corr.find((q) => q.k === k); VIZ.marcador(ctx, pl.sx(c.th[0]), pl.sy(c.th[1]), col, 5); });
      const fs = corr.map((c) => [c.k, S.f(...c.th)]);
      const mejor = fs.filter(([k]) => activos[k]).sort((a, b) => a[1] - b[1])[0];
      registro.textContent = t ? `Paso ${t}: va mejor ${mejor ? OPTS.find((o) => o[0] === mejor[0])[1] : '—'} con pérdida ${mejor ? VIZ.fmt(mejor[1], 3) : '—'}.` : 'Todos los optimizadores parten del mismo punto.';
      lectura.set(OPTS.filter(([k]) => activos[k]).map(([k, n]) => [n, VIZ.fmt(fs.find((q) => q[0] === k)[1], 3)]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `(${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})<br>pérdida <b>${VIZ.fmt(DL.SUP[sup].f(pl.ix(x), pl.iy(y)), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: los mismos optimizadores entrenando una red ---------- */

  function montarRed(cuerpo) {
    DL.entrenador(cuerpo, {
      controles: ['datos', 'opt', 'lr', 'lote'],
      inicial: { datos: 'lunas', ocultas: 10, capas: 2, act: 'tanh', opt: 'sgd', lr: 0.05, lote: 16, ruido: 0.2, n: 150 },
      nota: 'Pruebe SGD con η = 0,05 y luego Adam con la misma tasa; después suba la tasa de Adam a 0,5. Los métodos adaptativos son menos sensibles a la escala de los gradientes, pero no están libres de elegir bien η.',
    });
  }

  VIZ.registrarTema('adaptive-optimizers', {
    intro: String.raw`
      <p>En un valle estrecho, un solo \(\eta\) para todos los parámetros es un mal compromiso: la dirección empinada pide pasos pequeños y la plana, grandes. Los <strong>optimizadores adaptativos</strong> resuelven esto dándole a cada parámetro su propio tamaño de paso, calculado a partir
      de la historia de sus gradientes.</p>
      <p><em>AdaGrad</em> divide por la raíz de la suma de gradientes al cuadrado; <em>RMSProp</em> la reemplaza por un promedio móvil, para que el paso no se encoja para siempre; <em>Adam</em> combina ese promedio con momentum y corrige su sesgo inicial.</p>`,
    visualizaciones: [
      { titulo: 'Cinco optimizadores, una superficie', descripcion: 'Compare las trayectorias. Cambie la escala de la tasa y la superficie, y active o desactive métodos con las casillas.', montar: montarCarrera },
      { titulo: 'Los mismos métodos entrenando una red', descripcion: 'Entrene la misma red con distintos optimizadores y tasas y compare las curvas de pérdida.', montar: montarRed },
    ],
    teoria: String.raw`
      <h2>Las reglas de actualización</h2>
      <p>Sea \(g_t=\nabla\mathcal{L}(\theta_t)\), con operaciones coordenada a coordenada y un \(\varepsilon\approx10^{-8}\) para evitar divisiones por cero.</p>
      <table>
        <tr><th>Método</th><th>Actualización</th></tr>
        <tr><td>SGD</td><td>\(\theta \leftarrow \theta - \eta\, g\)</td></tr>
        <tr><td>Momentum</td><td>\(v\leftarrow\beta v-\eta g,\quad \theta\leftarrow\theta+v\)</td></tr>
        <tr><td>AdaGrad</td><td>\(G\leftarrow G+g^2,\quad \theta\leftarrow\theta-\dfrac{\eta}{\sqrt{G}+\varepsilon}\,g\)</td></tr>
        <tr><td>RMSProp</td><td>\(G\leftarrow\rho G+(1-\rho)g^2,\quad \theta\leftarrow\theta-\dfrac{\eta}{\sqrt{G}+\varepsilon}\,g\)</td></tr>
        <tr><td>Adam</td><td>\(m\leftarrow\beta_1m+(1-\beta_1)g,\quad v\leftarrow\beta_2v+(1-\beta_2)g^2,\quad \theta\leftarrow\theta-\eta\dfrac{\hat m}{\sqrt{\hat v}+\varepsilon}\)</td></tr>
      </table>
      <p>donde en Adam \(\hat m = m/(1-\beta_1^t)\) y \(\hat v = v/(1-\beta_2^t)\) corrigen que \(m\) y \(v\) arrancan en cero. Valores usuales: \(\beta_1=0{,}9\), \(\beta_2=0{,}999\), \(\eta=10^{-3}\).</p>
      <h2>Qué hace cada pieza</h2>
      <ul>
        <li><strong>AdaGrad</strong>: los parámetros con gradientes grandes reciben pasos pequeños, y los poco actualizados, pasos grandes (útil con datos dispersos). Como \(G\) solo crece, el paso se encoge hasta casi detenerse.</li>
        <li><strong>RMSProp</strong>: olvida el pasado lejano, de modo que la tasa efectiva no decae a cero.</li>
        <li><strong>Adam</strong>: añade la inercia de un promedio de gradientes. Es la opción por defecto en muchos problemas.</li>
      </ul>
      <div class="recuadro"><p>Adam normaliza cada coordenada: un paso mide aproximadamente \(\eta\) sin importar la escala del gradiente. Eso lo hace robusto, pero a veces generaliza peor que SGD con momentum bien afinado. Combinaciones con decaimiento de pesos (AdamW) son frecuentes.</p></div>
      <p>Antes de elegir optimizador conviene entender la <a href="tema.html?id=learning-rate-momentum">tasa de aprendizaje y el momentum</a> y el ruido de los <a href="tema.html?id=sgd-minibatch">mini-lotes</a>. La geometría de la pérdida se explora en <a href="tema.html?id=loss-landscapes">Loss Surfaces</a>.</p>`,
  });
})();
