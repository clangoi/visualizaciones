(function () {
  'use strict';
  const { color: C } = VIZ;

  // Recta de mínimos cuadrados para puntos {x, y}.
  function mco(pts) {
    const n = pts.length;
    if (n < 2) return { w: 0, b: n ? pts[0].y : 0 };
    const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    const w = sxx ? sxy / sxx : 0;
    return { w, b: my - w * mx };
  }
  const ecm = (pts, w, b) => pts.reduce((s, p) => s + (w * p.x + b - p.y) ** 2, 0) / Math.max(1, pts.length);
  function nube(n, semilla) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, () => { const x = 0.5 + rnd() * 9; return { x, y: 1.5 + 0.7 * x + VIZ.normal(rnd) * 1.1 }; });
  }

  /* ---------- Fig. 1: mínimos cuadrados con residuos ---------- */

  function montarResiduos(cuerpo) {
    let semilla = 1, pts = nube(12, 1), w = 0.3, b = 4, cuadrados = true;
    const ctl = VIZ.controles(cuerpo);
    const rw = ctl.rango({ etiqueta: 'Pendiente w', min: -1, max: 2.5, paso: 0.01, valor: w, formato: (v) => v.toFixed(2), alCambiar: (v) => { w = v; dibujar(); } });
    const rb = ctl.rango({ etiqueta: 'Intercepto b', min: -4, max: 10, paso: 0.05, valor: b, formato: (v) => v.toFixed(2), alCambiar: (v) => { b = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar los cuadrados de los residuos', valor: cuadrados, alCambiar: (v) => { cuadrados = v; dibujar(); } });
    ctl.boton('Ajustar por mínimos cuadrados', () => { const r = mco(pts); w = r.w; b = r.b; rw.valor = w; rb.valor = b; dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; pts = nube(12, semilla); dibujar(); });
    ctl.boton('Vaciar', () => { pts = []; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'su recta ŷ = w x + b', forma: 'linea' },
      { color: C.apagado, texto: 'recta de mínimos cuadrados', forma: 'linea' },
      { color: C.s2, texto: 'residuo y − ŷ', forma: 'linea' },
      { color: VIZ.alfa(C.s2, 0.2), texto: 'residuo al cuadrado' },
      { color: C.tinta, texto: 'datos', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un lugar vacío para agregar un punto, o sobre un punto para quitarlo. Mueva w y b para que el área total de los cuadrados sea la menor posible.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 10, ymin: 0, ymax: 10 }, { etiquetaX: 'x', etiquetaY: 'y', margen: { izq: 40 } });
      plano.ejes();
      const opt = mco(pts);
      ctx.save();
      plano.recortar();
      if (cuadrados) for (const p of pts) {
        const yh = w * p.x + b, h = plano.sy(yh) - plano.sy(p.y), s = Math.abs(h);
        ctx.fillStyle = VIZ.alfa(C.s2, 0.15);
        ctx.fillRect(plano.sx(p.x), Math.min(plano.sy(p.y), plano.sy(yh)), (p.y > yh ? -1 : 1) * s, s);
      }
      VIZ.trazar(ctx, plano, [[0, opt.b], [10, opt.w * 10 + opt.b]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, [[0, b], [10, w * 10 + b]], C.s1, 2.5);
      ctx.strokeStyle = C.s2;
      ctx.lineWidth = 1.5;
      for (const p of pts) { ctx.beginPath(); ctx.moveTo(plano.sx(p.x), plano.sy(p.y)); ctx.lineTo(plano.sx(p.x), plano.sy(w * p.x + b)); ctx.stroke(); }
      ctx.restore();
      for (const p of pts) VIZ.marcador(ctx, plano.sx(p.x), plano.sy(p.y), C.tinta, 4);
      const e = ecm(pts, w, b), eo = ecm(pts, opt.w, opt.b);
      const my = pts.reduce((s, p) => s + p.y, 0) / Math.max(1, pts.length);
      const vt = pts.reduce((s, p) => s + (p.y - my) ** 2, 0) / Math.max(1, pts.length);
      registro.textContent = pts.length < 2 ? 'Agregue al menos dos puntos.' : e - eo < 1e-6 * (1 + eo) ? 'Su recta es la de mínimos cuadrados: ninguna otra tiene menor suma de cuadrados.'
        : `Su error cuadrático medio es ${VIZ.fmt(e, 3)}; el mínimo posible es ${VIZ.fmt(eo, 3)} (${VIZ.fmt(e / Math.max(eo, 1e-9), 3)} veces menor).`;
      lectura.set([
        ['ECM de su recta', VIZ.fmt(e, 3)],
        ['ECM mínimo', VIZ.fmt(eo, 3)],
        ['w*', VIZ.fmt(opt.w, 3)],
        ['b*', VIZ.fmt(opt.b, 3)],
        ['R² de su recta', vt ? VIZ.fmt(1 - e / vt, 3) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const cercano = (x, y) => pts.findIndex((p) => Math.hypot(plano.sx(p.x) - x, plano.sy(p.y) - y) < 8);
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      const i = cercano(x, y);
      if (i >= 0) pts.splice(i, 1); else pts.push({ x: plano.ix(x), y: plano.iy(y) });
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = plano ? cercano(x, y) : -1;
      if (i < 0) return tip.ocultar();
      const p = pts[i], r = p.y - (w * p.x + b);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(p.x, 3)}</b> · y = <b>${VIZ.fmt(p.y, 3)}</b><br>residuo <b>${VIZ.fmt(r, 3)}</b> · cuadrado <b>${VIZ.fmt(r * r, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: la superficie de pérdida y el descenso de gradiente ---------- */

  function montarSuperficie(cuerpo) {
    const pts = nube(30, 7);
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    let eta = 0.02, centrar = false, inicio = [-0.6, -2.5], w = 0, b = 0, camino = [], iter = 0;
    const DOM = { xmin: -1, xmax: 2.5, ymin: -4, ymax: 10 };
    const datos = () => (centrar ? pts.map((p) => ({ x: p.x - mx, y: p.y })) : pts);

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tasa de aprendizaje η', min: 0.002, max: 0.06, paso: 0.002, valor: eta, formato: (v) => v.toFixed(3), alCambiar: (v) => { eta = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Centrar x (usar x − x̄)', valor: centrar, alCambiar: (v) => { centrar = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.rampa[1], texto: 'ECM bajo' },
      { color: VIZ.rampa[11], texto: 'ECM alto' },
      { color: C.s6, texto: 'mínimo (ecuaciones normales)', forma: 'punto' },
      { color: C.s2, texto: 'trayectoria del gradiente', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto del plano es una recta posible (w, b), coloreada por su error. Haga clic para elegir el punto de partida. Pase el cursor para ver el error de cada recta.');

    function iniciar() {
      [w, b] = inicio;
      camino = [[w, b]];
      iter = 0;
      const d = datos();
      return (function* () {
        for (iter = 1; iter <= 500; iter++) {
          let gw = 0, gb = 0;
          for (const p of d) { const r = w * p.x + b - p.y; gw += (2 * r * p.x) / d.length; gb += (2 * r) / d.length; }
          w -= eta * gw; b -= eta * gb;
          camino.push([w, b]);
          if (!Number.isFinite(w) || Math.abs(w) > 1e6) return;
          yield;
          if (Math.hypot(gw, gb) < 1e-4) return;
        }
      })();
    }

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'pendiente w', etiquetaY: 'intercepto b', margen: { izq: 40 } });
      const d = datos(), opt = mco(d);
      const emin = ecm(d, opt.w, opt.b);
      const paso = 6;
      for (let px = plano.x0; px < plano.x1; px += paso) for (let py = plano.y1; py < plano.y0; py += paso) {
        const e = ecm(d, plano.ix(px + paso / 2), plano.iy(py + paso / 2));
        ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.log10(e / emin) / 3));
        ctx.fillRect(px, py, Math.min(paso, plano.x1 - px), Math.min(paso, plano.y0 - py));
      }
      plano.ejes();
      ctx.save();
      plano.recortar();
      VIZ.trazar(ctx, { sx: plano.sx, sy: plano.sy }, camino, C.s2, 2);
      for (const [cw, cb] of camino.slice(-60)) VIZ.marcador(ctx, plano.sx(cw), plano.sy(cb), C.s2, 2.5);
      ctx.restore();
      VIZ.marcador(ctx, plano.sx(opt.w), plano.sy(opt.b), C.s6, 6, 6);
      if (camino.length) VIZ.marcador(ctx, plano.sx(camino[camino.length - 1][0]), plano.sy(camino[camino.length - 1][1]), C.tinta, 4.5);
      const e = ecm(d, w, b), diverge = !Number.isFinite(e) || e > 1e8;
      registro.textContent = diverge ? `Con η = ${eta.toFixed(3)} el descenso diverge: el paso es demasiado grande para la curvatura en la dirección de w.`
        : `Iteración ${iter}: w = ${VIZ.fmt(w, 4)}, b = ${VIZ.fmt(b, 4)}. ` + (centrar ? 'Con x centrado, las curvas de nivel son casi circulares y el gradiente apunta al mínimo.' : 'Sin centrar, el valle es largo y angosto: el gradiente zigzaguea y avanza lento a lo largo de b.');
      lectura.set([
        ['iteración', String(iter)],
        ['ECM actual', diverge ? '∞' : VIZ.fmt(e, 4)],
        ['ECM mínimo', VIZ.fmt(emin, 4)],
        ['w*, b*', `${VIZ.fmt(opt.w, 3)}, ${VIZ.fmt(opt.b, 3)}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      inicio = [plano.ix(x), plano.iy(y)];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const cw = plano.ix(x), cb = plano.iy(y);
      tip.mostrar(x, y, `w = <b>${VIZ.fmt(cw, 3)}</b> · b = <b>${VIZ.fmt(cb, 3)}</b><br>ECM <b>${VIZ.fmt(ecm(datos(), cw, cb), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('linear-regression', {
    intro: String.raw`
      <p>La <strong>regresión lineal</strong> predice un número como combinación lineal de los atributos:
      \(\hat y = w_1 x_1 + \dots + w_d x_d + b\). Es el modelo supervisado más simple y la base de muchos otros: la regresión
      logística, las redes neuronales y los métodos de kernel la extienden.</p>
      <p>Los parámetros se eligen para minimizar la suma de los cuadrados de los <strong>residuos</strong> —las diferencias entre lo
      observado y lo predicho—. Ese problema tiene solución exacta (las <em>ecuaciones normales</em>) y también se puede resolver de
      a poco con <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a>, que es lo que se usa cuando los datos son
      enormes.</p>`,
    visualizaciones: [
      {
        titulo: 'Mínimos cuadrados',
        descripcion: 'Ajuste la recta a mano minimizando el área de los cuadrados y compare con la solución exacta. Agregue un punto muy alejado: un solo valor atípico tuerce la recta, porque el error crece con el cuadrado.',
        montar: montarResiduos,
      },
      {
        titulo: 'La superficie de pérdida',
        descripcion: 'El error de una recta depende de (w, b) como un paraboloide. Ejecute el descenso de gradiente sin centrar x y luego centrándolo: el mismo η converge muchísimo más rápido.',
        montar: montarSuperficie,
      },
    ],
    teoria: String.raw`
      <h2>Modelo y pérdida</h2>
      <p>Agregando una columna de unos a la <a href="tema.html?id=machine-learning">matriz de atributos</a> para absorber el
      intercepto, el modelo es \(\hat y = X\theta\) con \(X \in \mathbb{R}^{n \times (d+1)}\), y se minimiza el error cuadrático
      medio</p>
      \[ J(\theta) = \frac{1}{n} \lVert X\theta - y \rVert^2 = \frac{1}{n} \sum_{i=1}^{n} \big(x_i^\top \theta - y_i\big)^2. \]

      <h2>Ecuaciones normales</h2>
      <p>\(J\) es convexa y su gradiente es \(\nabla J(\theta) = \tfrac{2}{n} X^\top (X\theta - y)\). Igualándolo a cero:</p>
      \[ X^\top X \, \theta^* = X^\top y \quad\Longrightarrow\quad \theta^* = (X^\top X)^{-1} X^\top y \]
      <p>si \(X^\top X\) es invertible (columnas linealmente independientes). Con un solo atributo:</p>
      \[ w^* = \frac{\sum_i (x_i - \bar x)(y_i - \bar y)}{\sum_i (x_i - \bar x)^2}, \qquad b^* = \bar y - w^* \bar x, \]
      <p>así que la recta pasa siempre por \((\bar x, \bar y)\). <strong>Geometría:</strong> \(X\theta^*\) es la proyección
      ortogonal de \(y\) sobre el espacio generado por las columnas de \(X\); el vector de residuos es perpendicular a ese espacio.
      Resolver el sistema cuesta \(O(n d^2 + d^3)\).</p>

      <h2>Descenso de gradiente</h2>
      <pre><code>θ ← θ₀
repetir:
    θ ← θ − η · (2/n) Xᵀ(Xθ − y)</code></pre>
      <p>La matriz hessiana es \(H = \tfrac{2}{n} X^\top X\); el método converge si \(\eta &lt; 2/\lambda_{\max}(H)\), y su
      rapidez depende del <em>número de condición</em> \(\lambda_{\max}/\lambda_{\min}\). Atributos con medias lejanas de cero o
      escalas distintas hacen el valle alargado (condición alta); centrar y escalar los atributos lo redondea, como se ve en la
      Fig. 2. Ver <a href="tema.html?id=descenso-gradiente">Gradient Descent</a>.</p>

      <h2>Calidad del ajuste</h2>
      <p>El <strong>coeficiente de determinación</strong> compara con el modelo que siempre predice \(\bar y\):</p>
      \[ R^2 = 1 - \frac{\sum_i (y_i - \hat y_i)^2}{\sum_i (y_i - \bar y)^2}. \]
      <p>\(R^2 = 1\) es un ajuste perfecto; \(R^2 = 0\), no mejor que la media; puede ser negativo para una recta arbitraria.</p>

      <h2>Interpretación probabilística y extensiones</h2>
      <p>Si \(y = x^\top \theta + \varepsilon\) con \(\varepsilon \sim \mathcal{N}(0, \sigma^2)\), maximizar la verosimilitud es
      exactamente minimizar la suma de cuadrados. Variantes:</p>
      <ul>
        <li><strong>Funciones base:</strong> el modelo es lineal en \(\theta\), no en \(x\); con \(\phi(x) = (1, x, x^2, \dots)\) se obtiene
        la regresión polinomial de <a href="tema.html?id=supervised-learning">Supervised Learning</a>.</li>
        <li><strong>Ridge</strong> (\(+\lambda\lVert\theta\rVert^2\)): \(\theta^* = (X^\top X + \lambda I)^{-1} X^\top y\), siempre invertible y
        con menos varianza.</li>
        <li><strong>Lasso</strong> (\(+\lambda\lVert\theta\rVert_1\)): lleva coeficientes exactamente a cero y selecciona atributos.</li>
      </ul>`,
  });
})();
