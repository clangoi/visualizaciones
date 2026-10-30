(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Regresión lineal ŷ = w·x + b con N ejemplos; la pérdida es el MSE.
  const N = 120;
  function datos(semilla) {
    const r = VIZ.semilla(semilla * 19 + 3);
    return Array.from({ length: N }, () => { const x = r() * 4 - 2; return { x, y: 1.5 * x + 0.5 + 0.8 * VIZ.normal(r) }; });
  }
  const mse = (D, w, b) => M.media(D.map((d) => 0.5 * (w * d.x + b - d.y) ** 2));
  const grad = (L, w, b) => { let gw = 0, gb = 0; for (const d of L) { const e = w * d.x + b - d.y; gw += e * d.x; gb += e; } return [gw / L.length, gb / L.length]; };
  const TAMS = [[1, 'SGD puro (1)'], [8, 'mini-lote de 8'], [32, 'mini-lote de 32'], [N, 'todo el conjunto (lote completo)']];

  /* ---------- Fig. 1: trayectorias sobre la superficie del MSE ---------- */

  function montarTrayectoria(cuerpo) {
    let lote = 8, lr = 0.05, semilla = 1, D = [], ruta = [], pasos = 0, ep = 0, w = -1.5, b = 2, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tamaño del lote', opciones: TAMS.map(([v, t]) => [String(v), t]), valor: String(lote), alCambiar: (v) => { lote = +v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje', min: 0.01, max: 0.3, paso: 0.01, valor: lr, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { lr = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 8 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    const fondo = VIZ.dl.cache(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'curvas de nivel del MSE sobre todo el conjunto', forma: 'linea' }, { color: C.s1, texto: 'trayectoria de los parámetros (w, b)', forma: 'linea' }, { color: C.s6, texto: 'mínimo (mínimos cuadrados)', forma: 'punto' }, { color: C.s2, texto: 'posición actual', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso usa un gradiente calculado con solo una parte de los datos: ruidoso pero barato. Con un lote pequeño el camino tiembla alrededor de la trayectoria exacta; con el conjunto completo es suave pero cada paso cuesta N ejemplos.');
    let opt = [0, 0];
    function iniciar() {
      D = datos(semilla);
      const Sx = M.suma(D.map((d) => d.x)), Sy = M.suma(D.map((d) => d.y)), Sxx = M.suma(D.map((d) => d.x * d.x)), Sxy = M.suma(D.map((d) => d.x * d.y));
      const wo = (N * Sxy - Sx * Sy) / (N * Sxx - Sx * Sx);
      opt = [wo, (Sy - wo * Sx) / N];
      w = -1.5; b = 2; pasos = 0; ep = 0; ruta = [[w, b]];
      const r = VIZ.semilla(semilla * 7);
      return (function* () {
        while (pasos < 4000) {
          const idx = M.barajar(Array.from({ length: N }, (_, i) => i), r);
          for (let i = 0; i < N; i += lote) {
            const [gw, gb] = grad(idx.slice(i, i + lote).map((j) => D[j]), w, b);
            w -= lr * gw; b -= lr * gb; pasos++; ruta.push([w, b]);
            if (lote >= 8 || i + lote >= N || pasos % 4 === 0) yield;
          }
          ep++;
        }
      })();
    }
    function dibujar() {
      if (!D.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -2.5, xmax: 3, ymin: -0.5, ymax: 3 }, { etiquetaX: 'pendiente w', etiquetaY: 'sesgo b' });
      pl.ejes();
      fondo(`${semilla}`, (c) => { const lo = mse(D, ...opt); for (let k = 1; k <= 8; k++) VIZ.ml.contorno(c, pl, (x, y) => mse(D, x, y), lo + 0.12 * k * k, { color: C.tenue, ancho: 1.2, paso: 8 }); });
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, ruta, C.s1, 1.6);
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(opt[0]), pl.sy(opt[1]), C.s6, 6);
      VIZ.marcador(ctx, pl.sx(w), pl.sy(b), C.s2, 5);
      registro.textContent = pasos ? `Paso ${pasos} (época ${ep}): w = ${VIZ.fmt(w, 3)}, b = ${VIZ.fmt(b, 3)}; MSE = ${VIZ.fmt(mse(D, w, b), 3)}.` : 'Punto de partida (w, b) = (−1,5; 2). Pulse Reproducir.';
      lectura.set([['pasos', VIZ.entero(pasos)], ['ejemplos procesados', VIZ.entero(pasos * Math.min(lote, N))], ['MSE actual', VIZ.fmt(mse(D, w, b), 3)], ['MSE mínimo', VIZ.fmt(mse(D, ...opt), 3)], ['distancia al mínimo', VIZ.fmt(Math.hypot(w - opt[0], b - opt[1]), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !D.length) return tip.ocultar();
      tip.mostrar(x, y, `w = ${VIZ.fmt(pl.ix(x), 2)}, b = ${VIZ.fmt(pl.iy(y), 2)}<br>MSE = <b>${VIZ.fmt(mse(D, pl.ix(x), pl.iy(y)), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: pérdida frente a pasos y frente a trabajo ---------- */

  function montarComparacion(cuerpo) {
    let eje = 'ejemplos', lr = 0.05, semilla = 1, cur = [], hover = null, pl = null;
    const COL = [C.s2, C.s1, C.s6, C.s7];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Eje horizontal', opciones: [['ejemplos', 'ejemplos procesados (trabajo)'], ['pasos', 'pasos de actualización']], valor: eje, alCambiar: (v) => { eje = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje', min: 0.01, max: 0.3, paso: 0.01, valor: lr, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { lr = v; calcular(); } });
    ctl.boton('Otros datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, TAMS.map(([, t], i) => ({ color: COL[i], texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Por cada ejemplo procesado, el SGD puro avanza más que el lote completo; por cada paso, el lote completo es más fiable. Los mini-lotes equilibran ambos y, además, aprovechan el paralelismo de las GPU.');
    function calcular() {
      const D = datos(semilla);
      cur = TAMS.map(([B]) => {
        let w = -1.5, b = 2, vistos = 0, pasos = 0;
        const r = VIZ.semilla(semilla * 5 + B), pts = [{ vistos: 0, pasos: 0, L: mse(D, w, b) }];
        while (vistos < 2400) {
          const L = B >= N ? D : Array.from({ length: B }, () => D[Math.floor(r() * N)]);
          const [gw, gb] = grad(L, w, b); w -= lr * gw; b -= lr * gb; vistos += B; pasos++;
          if (pasos % Math.max(1, Math.round(8 / B)) === 0 || B >= 8) pts.push({ vistos, pasos, L: mse(D, w, b) });
        }
        return pts;
      });
      dibujar();
    }
    function dibujar() {
      if (!cur.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xmax = eje === 'ejemplos' ? 2400 : 300;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0.2, ymax: 4 }, { logY: true, etiquetaX: eje === 'ejemplos' ? 'ejemplos procesados' : 'pasos de actualización', etiquetaY: 'MSE (escala log)', formatoY: (v) => VIZ.fmt(v, 2) });
      pl.ejes();
      ctx.save(); pl.recortar();
      cur.forEach((pts, i) => VIZ.trazar(ctx, pl, pts.map((q) => [eje === 'ejemplos' ? q.vistos : q.pasos, Math.max(q.L, 0.2)]), COL[i], 2));
      ctx.restore();
      lectura.set(cur.map((pts, i) => [TAMS[i][1], `MSE final ${VIZ.fmt(pts[pts.length - 1].L, 3)} · ${VIZ.entero(pts[pts.length - 1].pasos)} pasos`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !cur.length) return tip.ocultar();
      const v = pl.ix(x);
      const fila = cur.map((pts) => pts.reduce((a, q) => (Math.abs((eje === 'ejemplos' ? q.vistos : q.pasos) - v) < Math.abs((eje === 'ejemplos' ? a.vistos : a.pasos) - v) ? q : a)));
      tip.mostrar(x, y, `${eje === 'ejemplos' ? 'ejemplos' : 'pasos'} ≈ <b>${VIZ.entero(v)}</b>` + fila.map((q, i) => VIZ.filaTooltip(COL[i], TAMS[i][1].split(' (')[0], VIZ.fmt(q.L, 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('sgd-minibatch', {
    intro: String.raw`
      <p>El <strong>descenso de gradiente</strong> baja por la superficie de la pérdida en la dirección contraria al gradiente. Pero calcular el gradiente exacto exige recorrer <em>todos</em> los ejemplos en cada paso, algo impracticable con millones de datos.</p>
      <p>La alternativa es estimarlo con una muestra pequeña: un solo ejemplo (<em>Stochastic Gradient Descent</em>) o un grupo, un <strong>mini-lote</strong> (<em>Mini-Batch Gradient Descent</em>). La estimación es ruidosa, pero en promedio apunta al gradiente verdadero, y permite dar muchísimos más pasos por el mismo trabajo.</p>`,
    visualizaciones: [
      { titulo: 'Trayectorias sobre la superficie del MSE', descripcion: 'Compare el camino con lote 1, 8, 32 y completo. Observe el temblor del SGD puro y que ningún camino pasa exactamente por la misma ruta.', montar: montarTrayectoria },
      { titulo: 'Lotes pequeños y grandes: pasos frente a trabajo', descripcion: 'Alterne el eje horizontal. Con el mismo trabajo, ¿quién baja más rápido? Con el mismo número de pasos, ¿quién?', montar: montarComparacion },
    ],
    teoria: String.raw`
      <h2>Las tres variantes</h2>
      <p>Con la pérdida \(\mathcal{L}(\theta) = \frac1n\sum_{i=1}^n \ell_i(\theta)\), una actualización es</p>
      \[ \theta \leftarrow \theta - \eta\, g_B, \qquad g_B = \frac{1}{|B|}\sum_{i\in B}\nabla\ell_i(\theta). \]
      <table>
        <tr><th>Variante</th><th>\(|B|\)</th><th>Costo por paso</th><th>Ruido del gradiente</th></tr>
        <tr><td>Lote completo</td><td>\(n\)</td><td>\(O(n)\)</td><td>ninguno</td></tr>
        <tr><td>Mini-lote</td><td>\(32\ldots 512\)</td><td>\(O(|B|)\)</td><td>varianza \(\propto 1/|B|\)</td></tr>
        <tr><td>SGD puro</td><td>\(1\)</td><td>\(O(1)\)</td><td>máximo</td></tr>
      </table>
      <h2>Un estimador insesgado</h2>
      <p>Si \(B\) se toma al azar, \(\mathbb{E}[g_B] = \nabla\mathcal{L}(\theta)\) y \(\operatorname{Var}(g_B) = \sigma^2/|B|\), con \(\sigma^2\) la varianza del gradiente por ejemplo. Duplicar el lote reduce la desviación solo en \(1/\sqrt2\), de modo que lotes enormes rinden cada vez menos.</p>
      <h2>Épocas y pseudocódigo</h2>
      <pre><code>para cada época:
    barajar los datos
    para cada mini-lote B:
        g ← promedio de ∇ℓᵢ(θ) para i en B
        θ ← θ − η·g</code></pre>
      <p>Una <em>época</em> es una pasada completa por los datos. Con el SGD, el ruido hace que \(\theta\) no converja exactamente: oscila en una vecindad del mínimo cuyo tamaño crece con \(\eta\). Por eso se reduce la tasa de aprendizaje a lo largo del entrenamiento (ver <a href="tema.html?id=learning-rate-momentum">Learning Rate &amp; Momentum</a>).</p>
      <div class="recuadro"><p>El ruido del SGD también ayuda: puede sacar a los parámetros de mínimos pobres y suele favorecer soluciones que generalizan mejor. Los fundamentos del método están en <a href="tema.html?id=descenso-gradiente">Gradient Descent</a>.</p></div>`,
  });
})();
