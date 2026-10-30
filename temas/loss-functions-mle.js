(function () {
  'use strict';
  const { color: C } = VIZ;

  const sig = (z) => 1 / (1 + Math.exp(-z));
  const ZS = Array.from({ length: 241 }, (_, i) => -8 + i * (16 / 240));

  /* ---------- Fig. 1: error cuadrático frente a entropía cruzada ---------- */

  function montarPerdidas(cuerpo) {
    let y = 1, hover = null, pl = [null, null];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Etiqueta verdadera y', opciones: [['1', 'y = 1'], ['0', 'y = 0']], valor: '1', alCambiar: (v) => { y = +v; dibujar(); } });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 240, altoMax: 340 });
    const l2 = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 240, altoMax: 340 });
    const tip1 = VIZ.tooltip(l1), tip2 = VIZ.tooltip(l2);
    const SER = [['Entropía cruzada', C.s1], ['Error cuadrático (MSE)', C.s2]];
    VIZ.leyenda(cuerpo, SER.map(([t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje horizontal es la salida sin comprimir z (el logit); la predicción es p = σ(z). Con y = 1, una red segura de lo contrario (z muy negativo) debería recibir un gradiente grande: la entropía cruzada lo da; el MSE casi no.');
    const perd = (z) => { const p = sig(z), q = y ? p : 1 - p; return [-Math.log(Math.max(q, 1e-12)), (p - y) ** 2 / 2]; };
    // Derivadas respecto de z: CE → p − y; MSE → (p − y) p (1 − p).
    const grad = (z) => { const p = sig(z); return [p - y, (p - y) * p * (1 - p)]; };
    function panel(l, derivada, i) {
      const { ctx } = l;
      l.limpiar();
      const p = VIZ.plano(l, { xmin: -8, xmax: 8, ymin: derivada ? -1.1 : 0, ymax: derivada ? 1.1 : 6 }, { etiquetaX: 'logit z', etiquetaY: derivada ? '∂pérdida/∂z' : 'pérdida' });
      p.ejes(); pl[i] = p;
      ctx.save(); p.recortar();
      SER.forEach(([, c], k) => VIZ.trazar(ctx, p, ZS.map((z) => [z, (derivada ? grad(z) : perd(z))[k]]), c, 2));
      if (hover != null) SER.forEach(([, c], k) => VIZ.marcador(ctx, p.sx(hover), p.sy((derivada ? grad(hover) : perd(hover))[k]), c, 4));
      ctx.restore();
    }
    function dibujar() {
      panel(l1, false, 0); panel(l2, true, 1);
      const z = hover ?? (y ? -4 : 4), g = grad(z), L = perd(z);
      registro.textContent = `Con z = ${VIZ.fmt(z, 2)} la red predice p = ${VIZ.fmt(sig(z), 3)} y la etiqueta es ${y}: ${Math.abs(sig(z) - y) > 0.5 ? 'se equivoca' : 'acierta'}. Gradiente de la entropía cruzada ${VIZ.fmt(g[0], 3)}; del MSE, ${VIZ.fmt(g[1], 3)}.`;
      lectura.set([['p = σ(z)', VIZ.fmt(sig(z), 3)], ['entropía cruzada', VIZ.fmt(L[0], 3)], ['MSE', VIZ.fmt(L[1], 3)], ['|∂CE/∂z|', VIZ.fmt(Math.abs(g[0]), 3)], ['|∂MSE/∂z|', VIZ.fmt(Math.abs(g[1]), 3)]]);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    [[l1, tip1, 0], [l2, tip2, 1]].forEach(([l, t, i]) => {
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y: py } = l.posicion(ev);
        if (!pl[i] || !pl[i].dentro(x, py)) { hover = null; t.ocultar(); return dibujar(); }
        hover = pl[i].ix(x); dibujar();
        const v = i ? grad(hover) : perd(hover);
        t.mostrar(x, py, `z = <b>${VIZ.fmt(hover, 2)}</b>` + SER.map(([n, c], k) => VIZ.filaTooltip(c, n, VIZ.fmt(v[k], 3))).join(''));
      });
      l.canvas.addEventListener('pointerleave', () => { hover = null; t.ocultar(); dibujar(); });
    });
    dibujar();
  }

  /* ---------- Fig. 2: máxima verosimilitud de una moneda ---------- */

  function montarMLE(cuerpo) {
    let n = 20, theta = 0.7, semilla = 1, k = 0, hover = null, pl = [null, null];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Lanzamientos n', min: 1, max: 200, valor: n, alCambiar: (v) => { n = v; generar(); } });
    ctl.rango({ etiqueta: 'Probabilidad real de cara θ', min: 0.05, max: 0.95, paso: 0.05, valor: theta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { theta = v; generar(); } });
    ctl.boton('Lanzar de nuevo', () => { semilla++; generar(); }, { primario: true });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 240, altoMax: 340 });
    const l2 = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 240, altoMax: 340 });
    const tip1 = VIZ.tooltip(l1), tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'verosimilitud L(θ) / su máximo', forma: 'linea' }, { color: C.s2, texto: 'pérdida: −(1/n)·log L(θ) (entropía cruzada)', forma: 'linea' }, { color: C.s6, texto: 'estimador de máxima verosimilitud', forma: 'punto' }, { color: C.apagado, texto: 'θ real', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El máximo de la verosimilitud (izquierda) y el mínimo de la entropía cruzada (derecha) ocurren en el mismo θ: la proporción de caras observada. Con más lanzamientos la curva se estrecha.');
    function generar() { const r = VIZ.semilla(semilla * 71 + n); k = 0; for (let i = 0; i < n; i++) if (r() < theta) k++; dibujar(); }
    const logL = (t) => k * Math.log(Math.max(t, 1e-9)) + (n - k) * Math.log(Math.max(1 - t, 1e-9));
    const TS = Array.from({ length: 199 }, (_, i) => 0.005 + i * 0.005);
    function dibujar() {
      const mle = k / n, lmax = logL(Math.min(Math.max(mle, 1e-9), 1 - 1e-9));
      [[l1, 0], [l2, 1]].forEach(([l, i]) => {
        const { ctx } = l;
        l.limpiar();
        const nll = (t) => -logL(t) / n;
        const p = VIZ.plano(l, i ? { xmin: 0, xmax: 1, ymin: 0, ymax: 3 } : { xmin: 0, xmax: 1, ymin: 0, ymax: 1.05 }, { etiquetaX: 'θ candidato', etiquetaY: i ? 'pérdida' : 'verosimilitud relativa' });
        p.ejes(); pl[i] = p;
        ctx.save(); p.recortar();
        VIZ.trazar(ctx, p, TS.map((t) => [t, i ? nll(t) : Math.exp(logL(t) - lmax)]), i ? C.s2 : C.s1, 2.5);
        VIZ.trazar(ctx, p, [[theta, 0], [theta, i ? 3 : 1.05]], C.apagado, 1.5, [4, 4]);
        ctx.restore();
        VIZ.marcador(ctx, p.sx(mle), p.sy(i ? nll(Math.max(mle, 0.005)) : 1), C.s6, 6);
        if (hover != null) VIZ.marcador(ctx, p.sx(hover), p.sy(i ? nll(hover) : Math.exp(logL(hover) - lmax)), i ? C.s2 : C.s1, 4);
      });
      registro.textContent = `${k} caras en ${n} lanzamientos: el estimador de máxima verosimilitud es θ̂ = ${k}/${n} = ${VIZ.fmt(mle, 3)} (el θ real es ${VIZ.fmt(theta, 2)}).`;
      lectura.set([['caras observadas', `${k} de ${n}`], ['θ̂ (MLE)', VIZ.fmt(mle, 3)], ['error |θ̂ − θ|', VIZ.fmt(Math.abs(mle - theta), 3)], ['pérdida mínima', VIZ.fmt(-lmax / n, 3)], ['error estándar √(θ̂(1−θ̂)/n)', VIZ.fmt(Math.sqrt((mle * (1 - mle)) / n), 3)]]);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    [[l1, tip1, 0], [l2, tip2, 1]].forEach(([l, t, i]) => {
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = l.posicion(ev);
        if (!pl[i] || !pl[i].dentro(x, y)) { hover = null; t.ocultar(); return dibujar(); }
        hover = Math.min(0.995, Math.max(0.005, pl[i].ix(x))); dibujar();
        t.mostrar(x, y, `θ = <b>${VIZ.fmt(hover, 3)}</b><br>log L = <b>${VIZ.fmt(logL(hover), 3)}</b><br>pérdida = <b>${VIZ.fmt(-logL(hover) / n, 3)}</b>`);
      });
      l.canvas.addEventListener('pointerleave', () => { hover = null; t.ocultar(); dibujar(); });
    });
    generar();
  }

  VIZ.registrarTema('loss-functions-mle', {
    intro: String.raw`
      <p>Entrenar una red es minimizar un número: la <strong>función de pérdida</strong>, que mide qué tan mal predice la red sobre los ejemplos. Para regresión se usa el <em>error cuadrático medio</em> (MSE); para clasificación, la <em>entropía cruzada</em>.</p>
      <p>No son elecciones arbitrarias. Ambas salen de un mismo principio, la <strong>máxima verosimilitud</strong>: escoger los parámetros que hacen más probables los datos observados. Con ruido gaussiano la verosimilitud conduce al MSE; con etiquetas categóricas, a la entropía cruzada.</p>`,
    visualizaciones: [
      { titulo: 'Entropía cruzada frente a error cuadrático', descripcion: 'Con \\(y=1\\), recorra los logits negativos (la red se equivoca con seguridad): compare cuánto gradiente da cada pérdida para corregirse.', montar: montarPerdidas },
      { titulo: 'La verosimilitud de una moneda', descripcion: 'Lance la moneda y vea dónde está el máximo de la verosimilitud y el mínimo de la entropía cruzada. Suba \\(n\\) para ver cómo se estrecha.', montar: montarMLE },
    ],
    teoria: String.raw`
      <h2>Pérdidas habituales</h2>
      <table>
        <tr><th>Tarea</th><th>Salida</th><th>Pérdida por ejemplo</th></tr>
        <tr><td>Regresión</td><td>\(\hat y\in\mathbb{R}\)</td><td>\(\tfrac12(\hat y - y)^2\)</td></tr>
        <tr><td>Clasificación binaria</td><td>\(p=\sigma(z)\)</td><td>\(-\,y\log p - (1-y)\log(1-p)\)</td></tr>
        <tr><td>Multiclase</td><td>\(p = \operatorname{softmax}(z)\)</td><td>\(-\sum_c y_c \log p_c\)</td></tr>
      </table>
      <h2>De la máxima verosimilitud a la pérdida</h2>
      <p>Si los ejemplos son independientes, la verosimilitud de los parámetros \(\theta\) es \(L(\theta) = \prod_i p_\theta(y_i\mid x_i)\). Maximizar \(L\) equivale a minimizar la <em>log-verosimilitud negativa</em> promedio:</p>
      \[ \hat\theta_{\text{MLE}} = \arg\max_\theta \prod_{i=1}^{n} p_\theta(y_i\mid x_i) = \arg\min_\theta\; -\frac1n\sum_{i=1}^n \log p_\theta(y_i\mid x_i). \]
      <ul>
        <li>Si \(y\mid x \sim \mathcal{N}(f_\theta(x),\sigma^2)\): \(-\log p = \frac{(y-f_\theta(x))^2}{2\sigma^2} + \text{const}\), es decir, <strong>MSE</strong>.</li>
        <li>Si \(y\mid x\sim\operatorname{Bernoulli}(p_\theta(x))\): \(-\log p = -y\log p_\theta - (1-y)\log(1-p_\theta)\), es decir, <strong>entropía cruzada</strong>.</li>
      </ul>
      <p>Para la moneda, \(\log L(\theta) = k\log\theta + (n-k)\log(1-\theta)\); derivando e igualando a cero se obtiene \(\hat\theta = k/n\).</p>
      <h2>Por qué la entropía cruzada con sigmoide o softmax</h2>
      <p>Para la sigmoide, \(\partial\,\text{CE}/\partial z = p - y\), mientras que para el MSE, \(\partial\,\text{MSE}/\partial z = (p-y)\,p(1-p)\). El factor \(p(1-p)\) se anula cuando la neurona está saturada, precisamente cuando más se equivoca: el aprendizaje se frena.
      La entropía cruzada cancela ese factor y mantiene el gradiente proporcional al error.</p>
      <div class="recuadro"><p>La entropía cruzada \(H(y,p)\) mide cuántos bits extra se gastan al codificar los datos con \(p\) en lugar de la distribución verdadera; minimizarla equivale a minimizar la divergencia de Kullback–Leibler entre ambas.
      Véase también <a href="tema.html?id=maximum-likelihood">Maximum Likelihood Estimation</a> y <a href="tema.html?id=logistic-regression">Logistic Regression</a>.</p></div>`,
  });
})();
