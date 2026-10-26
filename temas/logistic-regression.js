(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const M = VIZ.ml;
  const sig = M.sigmoide;

  /* ---------- Fig. 1: entrenamiento por descenso de gradiente en el plano ---------- */

  const ATRIB = {
    lineal: { nombre: 'x₁, x₂', f: (x, y) => [x, y] },
    cuadratico: { nombre: 'x₁, x₂, x₁², x₂², x₁x₂', f: (x, y) => [x, y, x * x, y * y, x * y] },
  };

  function montarPlano(cuerpo) {
    let tipo = 'lunas', atrib = 'lineal', eta = 0.5, lambda = 0, semilla = 1;
    let tr = [], va = [], w = [], b = 0, epoca = 0, historia = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS.filter(([k]) => k !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    ctl.selector({ etiqueta: 'Atributos', opciones: Object.entries(ATRIB).map(([k, a]) => [k, a.nombre]), valor: atrib, alCambiar: (v) => { atrib = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje η', min: 0.05, max: 3, paso: 0.05, valor: eta, formato: (v) => v.toFixed(2), alCambiar: (v) => { eta = v; } });
    ctl.rango({ etiqueta: 'Regularización λ', min: 0, max: 0.2, paso: 0.005, valor: lambda, formato: (v) => v.toFixed(3), alCambiar: (v) => { lambda = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), bb = el('div');
    cols.append(a, bb);
    VIZ.subtitulo(a, 'P(y = 1 | x) y frontera de decisión');
    const l1 = VIZ.lienzo(a, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(l1);
    VIZ.subtitulo(bb, 'Pérdida logarítmica por época');
    const l2 = VIZ.lienzo(bb, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      ...M.leyendaClases(2, ['y = 0', 'y = 1']),
      { color: C.tinta, texto: 'frontera P = 0.5', forma: 'linea' },
      { color: C.s1, texto: 'pérdida de entrenamiento', forma: 'linea' },
      { color: C.s2, texto: 'pérdida de validación', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso son 5 épocas de descenso de gradiente con todos los ejemplos. Los puntos con contorno son de validación. Pase el cursor sobre el plano para ver la probabilidad.');

    function datos() {
      ({ entrenamiento: tr, validacion: va } = M.partir(M.datos(tipo, 200, 0.25, semilla * 5), 0.7, semilla));
      rep.reiniciar();
    }
    const prob = (x, y) => { const f = ATRIB[atrib].f(x, y); let z = b; for (let i = 0; i < f.length; i++) z += w[i] * f[i]; return sig(z); };
    const perdida = (pts) => pts.reduce((s, q) => { const p = Math.min(1 - 1e-12, Math.max(1e-12, prob(q.x, q.y))); return s - (q.c ? Math.log(p) : Math.log(1 - p)); }, 0) / pts.length;
    const exact = (pts) => pts.filter((q) => (prob(q.x, q.y) > 0.5 ? 1 : 0) === q.c).length / pts.length;

    function iniciar() {
      const d = ATRIB[atrib].f(0, 0).length;
      w = new Array(d).fill(0); b = 0; epoca = 0;
      historia = [[0, perdida(tr), perdida(va)]];
      return (function* () {
        for (let paso = 0; paso < 400; paso++) {
          for (let e = 0; e < 5; e++) {
            const gw = new Array(d).fill(0);
            let gb = 0;
            for (const q of tr) {
              const f = ATRIB[atrib].f(q.x, q.y), r = prob(q.x, q.y) - q.c;
              for (let i = 0; i < d; i++) gw[i] += (r * f[i]) / tr.length;
              gb += r / tr.length;
            }
            for (let i = 0; i < d; i++) w[i] -= eta * (gw[i] + lambda * w[i]);
            b -= eta * gb;
            epoca++;
          }
          historia.push([epoca, perdida(tr), perdida(va)]);
          yield;
        }
      })();
    }

    let p1 = null;
    function dibujar() {
      let ctx = l1.ctx;
      l1.limpiar();
      p1 = M.plano(l1);
      M.regiones(ctx, p1, prob);
      p1.ejes();
      if (w.some((v) => v)) M.contorno(ctx, p1, prob, 0.5, { color: C.tinta, ancho: 2 });
      M.puntos(ctx, p1, tr, { r: 3.5 });
      M.puntos(ctx, p1, va, { r: 3.5, hueco: () => true });

      ctx = l2.ctx;
      l2.limpiar();
      const ymax = Math.max(0.8, ...historia.map((h) => Math.max(h[1], h[2]))) * 1.05;
      const p2 = VIZ.plano(l2, { xmin: 0, xmax: Math.max(50, epoca), ymin: 0, ymax }, { etiquetaX: 'época', etiquetaY: 'pérdida', margen: { izq: 40 } });
      p2.ejes();
      VIZ.trazar(ctx, p2, historia.map((h) => [h[0], h[1]]), C.s1, 2);
      VIZ.trazar(ctx, p2, historia.map((h) => [h[0], h[2]]), C.s2, 2);
      const norma = Math.sqrt(w.reduce((s, v) => s + v * v, 0));
      registro.textContent = epoca === 0 ? 'Con w = 0 el modelo predice P = 0.5 en todas partes (pérdida log 2 ≈ 0.693).'
        : `Época ${epoca}: P(y = 1 | x) = σ(${[...w.map((v, i) => [v, `·${ATRIB[atrib].nombre.split(', ')[i]}`]), [b, '']]
          .map(([v, t], i) => `${i ? (v < 0 ? ' − ' : ' + ') : v < 0 ? '−' : ''}${VIZ.fmt(Math.abs(v), 3)}${t}`).join('')}).`;
      lectura.set([
        ['época', String(epoca)],
        ['pérdida entrenamiento', VIZ.fmt(perdida(tr), 3)],
        ['exactitud entrenamiento', `${Math.round(100 * exact(tr))} %`],
        ['exactitud validación', `${Math.round(100 * exact(va))} %`],
        ['‖w‖', VIZ.fmt(norma, 3)],
      ]);
    }
    l1.alDibujar = () => w.length && dibujar();
    l2.alDibujar = () => w.length && dibujar();
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!p1 || !p1.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `x = (${VIZ.fmt(p1.ix(x), 2)}, ${VIZ.fmt(p1.iy(y), 2)})<br>P(y = 1 | x) = <b>${VIZ.fmt(prob(p1.ix(x), p1.iy(y)), 3)}</b>`);
    });
    l1.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  /* ---------- Fig. 2: sigmoide y pérdida logarítmica en una dimensión ---------- */

  function montarSigmoide(cuerpo) {
    let w = 1, b = 0, solape = 1, semilla = 2, pts = [], mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    const rw = ctl.rango({ etiqueta: 'Peso w', min: -2, max: 8, paso: 0.05, valor: w, formato: (v) => v.toFixed(2), alCambiar: (v) => { w = v; mensaje = ''; dibujar(); } });
    const rb = ctl.rango({ etiqueta: 'Sesgo b', min: -10, max: 10, paso: 0.1, valor: b, formato: (v) => v.toFixed(1), alCambiar: (v) => { b = v; mensaje = ''; dibujar(); } });
    ctl.rango({ etiqueta: 'Superposición de las clases', min: 0, max: 2, paso: 0.1, valor: solape, formato: (v) => v.toFixed(1), alCambiar: (v) => { solape = v; datos(); } });
    ctl.boton('Máxima verosimilitud', ajustarMV, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...M.leyendaClases(2, ['y = 0', 'y = 1']),
      { color: C.tinta, texto: 'σ(w x + b)', forma: 'linea' },
      { color: C.s8, texto: 'pérdida −log p de cada ejemplo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El segmento rojo de cada punto mide la probabilidad que el modelo le asigna a la clase equivocada; su pérdida es −log de la probabilidad de la correcta. Pase el cursor sobre un punto para ver su pérdida.');

    function datos() {
      const rnd = VIZ.semilla(semilla * 3);
      pts = Array.from({ length: 30 }, (_, i) => { const c = i % 2; return { x: (c ? 1.6 : -1.6) * (1.2 - solape * 0.4) + VIZ.normal(rnd) * (0.4 + solape * 0.6), c }; })
        .filter((q) => Math.abs(q.x) < 4.8);
      mensaje = '';
      dibujar();
    }
    const L = () => pts.reduce((s, q) => { const p = sig(w * q.x + b); return s - Math.log(Math.max(1e-15, q.c ? p : 1 - p)); }, 0) / pts.length;
    function ajustarMV() {
      // Newton-Raphson sobre la log-verosimilitud.
      let a = 0, c = 0, it = 0;
      for (; it < 60; it++) {
        let ga = 0, gc = 0, haa = 0, hac = 0, hcc = 0;
        for (const q of pts) { const p = sig(a * q.x + c), r = p - q.c, s = p * (1 - p); ga += r * q.x; gc += r; haa += s * q.x * q.x; hac += s * q.x; hcc += s; }
        const det = haa * hcc - hac * hac + 1e-12;
        const da = (hcc * ga - hac * gc) / det, dc = (haa * gc - hac * ga) / det;
        a -= da; c -= dc;
        if (Math.abs(a) > 60) break;
        if (Math.abs(da) + Math.abs(dc) < 1e-9) break;
      }
      const separable = Math.abs(a) > 60;
      w = Math.max(-2, Math.min(8, a)); b = Math.max(-10, Math.min(10, c));
      rw.valor = w; rb.valor = b;
      mensaje = separable ? 'Los datos son separables: la verosimilitud sigue creciendo cuando w → ∞ y el máximo no existe. Se muestra un w grande, cortado al rango del control. La regularización evita este problema.'
        : `Newton-Raphson convergió en ${it + 1} iteraciones: w* = ${VIZ.fmt(a, 4)}, b* = ${VIZ.fmt(c, 4)}.`;
      dibujar();
    }

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: -5, xmax: 5, ymin: -0.08, ymax: 1.08 }, { etiquetaX: 'x', etiquetaY: 'P(y = 1 | x)', ticksY: [0, 0.25, 0.5, 0.75, 1], margen: { izq: 40 } });
      plano.ejes();
      const curva = [];
      for (let i = 0; i <= 200; i++) { const x = -5 + i / 20; curva.push([x, sig(w * x + b)]); }
      ctx.save();
      ctx.strokeStyle = C.s8;
      ctx.lineWidth = 2;
      for (const q of pts) { const p = sig(w * q.x + b); ctx.beginPath(); ctx.moveTo(plano.sx(q.x), plano.sy(q.c)); ctx.lineTo(plano.sx(q.x), plano.sy(p)); ctx.stroke(); }
      ctx.restore();
      if (Math.abs(w) > 1e-9) { const x0 = -b / w; if (x0 > -5 && x0 < 5) VIZ.trazar(ctx, plano, [[x0, -0.08], [x0, 1.08]], C.apagado, 1, [3, 4]); }
      VIZ.trazar(ctx, plano, curva, C.tinta, 2.5);
      M.puntos(ctx, plano, pts.map((q) => ({ x: q.x, y: q.c, c: q.c })));
      const acc = pts.filter((q) => (sig(w * q.x + b) > 0.5 ? 1 : 0) === q.c).length / pts.length;
      const ecm = pts.reduce((s, q) => s + (sig(w * q.x + b) - q.c) ** 2, 0) / pts.length;
      registro.textContent = mensaje || `Frontera en x = −b / w = ${Math.abs(w) > 1e-9 ? VIZ.fmt(-b / w, 3) : '—'}. Pendiente máxima de la sigmoide: w / 4 = ${VIZ.fmt(w / 4, 3)}.`;
      lectura.set([
        ['pérdida logarítmica', VIZ.fmt(L(), 4)],
        ['error cuadrático', VIZ.fmt(ecm, 3)],
        ['exactitud', `${Math.round(100 * acc)} %`],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = plano ? M.cercano(plano, pts.map((q) => ({ x: q.x, y: q.c })), x, y) : -1;
      if (i < 0) return tip.ocultar();
      const q = pts[i], p = sig(w * q.x + b), pc = q.c ? p : 1 - p;
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(q.x, 3)}</b> · y = <b>${q.c}</b><br>P(clase correcta) = <b>${VIZ.fmt(pc, 3)}</b><br>pérdida −log p = <b>${VIZ.fmt(-Math.log(Math.max(1e-15, pc)), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  VIZ.registrarTema('logistic-regression', {
    intro: String.raw`
      <p>A pesar de su nombre, la <strong>regresión logística</strong> es un método de <em>clasificación</em>. Calcula una
      combinación lineal \(z = w^\top x + b\) igual que la <a href="tema.html?id=linear-regression">regresión lineal</a>, pero la
      pasa por la <strong>sigmoide</strong> \(\sigma(z) = 1/(1 + e^{-z})\), que la convierte en una probabilidad entre 0 y 1:
      \(P(y = 1 \mid x) = \sigma(w^\top x + b)\).</p>
      <p>La frontera de decisión \(P = 0.5\) es el hiperplano \(w^\top x + b = 0\): lineal en los atributos. Para fronteras curvas
      basta con agregar atributos no lineales, como cuadrados y productos. Los parámetros se eligen maximizando la verosimilitud,
      lo que equivale a minimizar la <strong>pérdida logarítmica</strong> (entropía cruzada).</p>`,
    visualizaciones: [
      {
        titulo: 'Fronteras aprendidas por descenso de gradiente',
        descripcion: 'Con atributos lineales la frontera es una recta y no puede separar círculos ni XOR; con atributos cuadráticos sí. Pruebe una η grande y λ &gt; 0 para ver su efecto sobre la convergencia y sobre ‖w‖.',
        montar: montarPlano,
      },
      {
        titulo: 'La sigmoide y la pérdida logarítmica',
        descripcion: 'w controla la pendiente y −b/w la posición de la frontera. Pulse «Máxima verosimilitud» con superposición 0: si las clases se separan perfectamente, el óptimo no existe.',
        montar: montarSigmoide,
      },
    ],
    teoria: String.raw`
      <h2>Modelo</h2>
      <p>Para \(y \in \{0, 1\}\):</p>
      \[ P(y = 1 \mid x) = \sigma(w^\top x + b), \qquad \sigma(z) = \frac{1}{1 + e^{-z}}, \qquad \sigma'(z) = \sigma(z)\,(1 - \sigma(z)). \]
      <p>Equivalentemente, el <em>logit</em> \(\log \frac{p}{1-p} = w^\top x + b\) es lineal: cada unidad de \(x_j\) multiplica las
      chances por \(e^{w_j}\).</p>

      <h2>Pérdida logarítmica</h2>
      <p>La verosimilitud de los datos es \(\prod_i p_i^{y_i}(1 - p_i)^{1 - y_i}\) con \(p_i = \sigma(w^\top x_i + b)\). Su logaritmo
      negativo, promediado, es la <strong>entropía cruzada</strong>:</p>
      \[ J(w, b) = -\frac{1}{n} \sum_{i=1}^{n} \Big[ y_i \log p_i + (1 - y_i) \log (1 - p_i) \Big]. \]
      <p>Castiga con fuerza las predicciones seguras y equivocadas (\(-\log p \to \infty\) si \(p \to 0\)). A diferencia del error
      cuadrático aplicado a \(\sigma\), es <strong>convexa</strong> en \((w, b)\), así que no tiene mínimos locales.</p>

      <h2>Gradiente</h2>
      <p>Usando \(\sigma' = \sigma(1-\sigma)\), las derivadas quedan notablemente simples:</p>
      \[ \nabla_w J = \frac{1}{n} \sum_i (p_i - y_i)\, x_i, \qquad \frac{\partial J}{\partial b} = \frac{1}{n} \sum_i (p_i - y_i), \]
      <p>la misma forma que en regresión lineal, con \(p_i\) en lugar de \(\hat y_i\). No hay solución cerrada; se usa
      <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a> o el método de Newton (con hessiana
      \(\frac1n X^\top S X\), \(S = \text{diag}(p_i(1-p_i))\)), que converge en pocas iteraciones.</p>

      <h2>Datos separables y regularización</h2>
      <p>Si existe un hiperplano que separa perfectamente las clases, multiplicar \(w\) por una constante creciente acerca todas
      las \(p_i\) a 0 o 1 y la pérdida tiende a cero sin alcanzarlo: los pesos divergen. La regularización
      \(J + \frac{\lambda}{2}\lVert w \rVert^2\) fija un óptimo finito y reduce el sobreajuste.</p>

      <h2>Varias clases</h2>
      <p>La <strong>regresión softmax</strong> generaliza a \(K\) clases con un vector \(w_k\) por clase:
      \(P(y = k \mid x) = e^{w_k^\top x} / \sum_j e^{w_j^\top x}\). Es exactamente la última capa de una
      <a href="tema.html?id=neural-networks">red neuronal</a> de clasificación: una red es una regresión logística sobre atributos
      que también se aprenden.</p>`,
  });
})();
