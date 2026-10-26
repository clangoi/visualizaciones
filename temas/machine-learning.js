(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const M = VIZ.ml;

  /* ---------- Fig. 1: matriz de atributos y espacio de atributos ---------- */

  const ATRIBUTOS = ['largo del pétalo', 'ancho del pétalo', 'largo del sépalo'];
  const ESPECIES = ['setosa', 'versicolor', 'virginica'];
  // Medias y desviaciones (cm) por especie, al estilo del conjunto Iris.
  const MEDIAS = [[1.5, 0.25, 5.0], [4.3, 1.3, 5.9], [5.5, 2.0, 6.6]];
  const DESV = [[0.18, 0.1, 0.35], [0.45, 0.2, 0.5], [0.55, 0.27, 0.6]];

  function flores(n, semilla) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, (_, i) => {
      const c = i % 3;
      return { x: MEDIAS[c].map((m, k) => +Math.max(0.1, m + VIZ.normal(rnd) * DESV[c][k]).toFixed(1)), c };
    });
  }

  function montarMatriz(cuerpo) {
    let fx = 0, fy = 1, semilla = 1, filas = flores(24, 1), hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Eje horizontal', opciones: ATRIBUTOS.map((a, k) => [k, a]), valor: fx, alCambiar: (v) => { fx = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Eje vertical', opciones: ATRIBUTOS.map((a, k) => [k, a]), valor: fy, alCambiar: (v) => { fy = +v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; filas = flores(24, semilla); tabla(); dibujar(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const izq = el('div'), der = el('div');
    cols.append(izq, der);
    VIZ.subtitulo(izq, 'Matriz de atributos X y vector objetivo y');
    const caja = el('div', { class: 'caja-desplazable caja-alta' });
    izq.appendChild(caja);
    VIZ.subtitulo(der, 'Espacio de atributos');
    const lienzo = VIZ.lienzo(der, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ESPECIES.map((e, k) => ({ color: M.CLASES[k], texto: `y = ${k}: ${e}`, forma: k ? 'cuadro' : 'punto' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre una fila de la tabla o sobre un punto del gráfico: cada fila de X es un punto del espacio de atributos.');

    let trs = [];
    function tabla() {
      const t = el('table', { class: 'tabla-datos' },
        el('thead', null, el('tr', null, el('th', { class: 'izq' }, 'i'), ...ATRIBUTOS.map((a, k) => el('th', null, `x${'₁₂₃'[k]}`)), el('th', null, 'y'))));
      const tb = el('tbody');
      trs = filas.map((f, i) => {
        const tr = el('tr', null, el('td', { class: 'izq' }, String(i + 1)), ...f.x.map((v) => el('td', null, v.toFixed(1))),
          el('td', null, el('b', { style: { color: M.CLASES[f.c] } }, String(f.c))));
        tr.addEventListener('pointerenter', () => { hover = i; dibujar(); });
        tr.addEventListener('pointerleave', () => { hover = -1; dibujar(); });
        tb.appendChild(tr);
        return tr;
      });
      t.appendChild(tb);
      caja.replaceChildren(t);
    }

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xs = filas.map((f) => f.x[fx]), ys = filas.map((f) => f.x[fy]);
      const pad = (a) => [Math.max(0, Math.min(...a) - 0.4), Math.max(...a) + 0.4];
      const [x0, x1] = pad(xs), [y0, y1] = pad(ys);
      plano = VIZ.plano(lienzo, { xmin: x0, xmax: x1, ymin: y0, ymax: y1 }, { etiquetaX: `x${'₁₂₃'[fx]} ${ATRIBUTOS[fx]} (cm)`, etiquetaY: `x${'₁₂₃'[fy]} ${ATRIBUTOS[fy]} (cm)`, margen: { izq: 40 } });
      plano.ejes();
      const pts = filas.map((f) => ({ x: f.x[fx], y: f.x[fy], c: f.c }));
      M.puntos(ctx, plano, pts, { anillo: (q) => (pts.indexOf(q) === hover ? C.tinta : null) });
      trs.forEach((tr, i) => tr.classList.toggle('activa', i === hover));
      lectura.set([
        ['forma de X', `${filas.length} × ${ATRIBUTOS.length}`],
        ['forma de y', String(filas.length)],
        ['dimensión del espacio', `ℝ${'³'}`],
        ['ejes mostrados', `x${'₁₂₃'[fx]}, x${'₁₂₃'[fy]}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = M.cercano(plano, filas.map((f) => ({ x: f.x[fx], y: f.x[fy] })), x, y);
      if (i !== hover) { hover = i; dibujar(); if (i >= 0) trs[i].scrollIntoView({ block: 'nearest' }); }
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `fila <b>${i + 1}</b><br>${filas[i].x.map((v, k) => `x${'₁₂₃'[k]} = ${v.toFixed(1)}`).join(' · ')}<br>y = <b>${filas[i].c}</b> (${ESPECIES[filas[i].c]})`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    tabla();
    dibujar();
  }

  /* ---------- Fig. 2: fit, transform y predict ---------- */

  // Estudiantes: horas de estudio (0–10) y puntaje de ingreso (200–1000); y = aprueba.
  function estudiantes(n, semilla) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, () => {
      const h = rnd() * 10, s = 200 + rnd() * 800;
      const z = 0.55 * (h / 10) + 0.45 * ((s - 200) / 800) + VIZ.normal(rnd) * 0.07;
      return { x: h, y: s, c: z > 0.5 ? 1 : 0 };
    });
  }

  function montarTubo(cuerpo) {
    let estandarizar = false, k = 5, semilla = 2, nuevo = null;
    let { entrenamiento: tr, validacion: va } = M.partir(estudiantes(160, 2), 0.7, 2);
    let mu = [0, 0], sd = [1, 1];

    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Estandarizar (transform) antes de k-NN', valor: estandarizar, alCambiar: (v) => { estandarizar = v; ajustar(); } });
    ctl.rango({ etiqueta: 'Vecinos k', min: 1, max: 15, paso: 2, valor: k, alCambiar: (v) => { k = v; ajustar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; ({ entrenamiento: tr, validacion: va } = M.partir(estudiantes(160, semilla), 0.7, semilla)); nuevo = null; ajustar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: M.CLASES[0], texto: 'y = 0: reprueba', forma: 'punto' },
      { color: M.CLASES[1], texto: 'y = 1: aprueba', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta2, texto: 'validación (contorno)', forma: 'punto' },
      { color: C.s2, texto: 'k vecinos del punto nuevo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para crear un estudiante nuevo y ver qué predice el modelo. Sin estandarizar, la distancia la domina el puntaje (cientos de unidades) y las horas casi no cuentan.');

    // fit: aprende μ y σ (solo con entrenamiento) y memoriza los puntos transformados.
    const transformar = (p) => (estandarizar ? [(p.x - mu[0]) / sd[0], (p.y - mu[1]) / sd[1]] : [p.x, p.y]);
    let memoria = [];
    function ajustar() {
      const m = (f) => tr.reduce((a, p) => a + f(p), 0) / tr.length;
      mu = [m((p) => p.x), m((p) => p.y)];
      sd = [Math.sqrt(m((p) => (p.x - mu[0]) ** 2)), Math.sqrt(m((p) => (p.y - mu[1]) ** 2))];
      memoria = tr.map((p) => ({ v: transformar(p), c: p.c, p }));
      dibujar();
    }
    function vecinos(p) {
      const v = transformar(p);
      return memoria.map((q) => ({ q, d: (q.v[0] - v[0]) ** 2 + (q.v[1] - v[1]) ** 2 })).sort((a, b) => a.d - b.d).slice(0, k);
    }
    const predecir = (p) => { const vs = vecinos(p); return vs.filter((x) => x.q.c === 1).length / vs.length; };

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 10, ymin: 200, ymax: 1000 }, { etiquetaX: 'x₁ horas de estudio', etiquetaY: 'x₂ puntaje de ingreso', margen: { izq: 48 } });
      M.regiones(ctx, plano, (x, y) => predecir({ x, y }), { paso: 8 });
      plano.ejes();
      M.puntos(ctx, plano, tr, { r: 3.5 });
      M.puntos(ctx, plano, va, { r: 3.5, hueco: () => true });
      if (nuevo) {
        ctx.save();
        ctx.strokeStyle = C.s2;
        ctx.lineWidth = 1.5;
        for (const { q } of vecinos(nuevo)) { ctx.beginPath(); ctx.moveTo(plano.sx(nuevo.x), plano.sy(nuevo.y)); ctx.lineTo(plano.sx(q.p.x), plano.sy(q.p.y)); ctx.stroke(); }
        ctx.restore();
        VIZ.marcador(ctx, plano.sx(nuevo.x), plano.sy(nuevo.y), C.tinta, 6, 6);
      }
      const acc = (pts) => pts.filter((p) => (predecir(p) > 0.5 ? 1 : 0) === p.c).length / pts.length;
      const pr = nuevo ? predecir(nuevo) : null;
      registro.textContent = `fit: μ = (${VIZ.fmt(mu[0], 3)} h, ${VIZ.fmt(mu[1], 3)} pts), σ = (${VIZ.fmt(sd[0], 3)}, ${VIZ.fmt(sd[1], 3)}) con los ${tr.length} ejemplos de entrenamiento.\n` +
        (estandarizar ? 'transform: x′ = (x − μ) / σ; ambos atributos quedan en la misma escala.\n' : 'transform: ninguna; las distancias se miden en las unidades originales.\n') +
        (nuevo ? `predict(${VIZ.fmt(nuevo.x, 2)} h, ${Math.round(nuevo.y)} pts) = ${pr > 0.5 ? 1 : 0} (${Math.round(pr * k)} de ${k} vecinos aprueban).` : 'predict: haga clic para consultar un punto nuevo.');
      lectura.set([
        ['exactitud entrenamiento', `${Math.round(100 * acc(tr))} %`],
        ['exactitud validación', `${Math.round(100 * acc(va))} %`],
        ['ejemplos memorizados', String(tr.length)],
      ]);
    }
    lienzo.alDibujar = () => memoria.length && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      nuevo = { x: plano.ix(x), y: plano.iy(y) };
      dibujar();
    });
    ajustar();
  }

  VIZ.registrarTema('machine-learning', {
    intro: String.raw`
      <p>El <strong>aprendizaje automático</strong> construye programas a partir de ejemplos en vez de reglas escritas a mano. Es
      <strong>aprendizaje inductivo</strong>: de un número finito de casos observados se generaliza una regla que debe funcionar
      también en casos nuevos. Ninguna cantidad de ejemplos garantiza por sí sola que la regla sea correcta; por eso todo método
      trae supuestos (su <em>sesgo inductivo</em>) y por eso se mide su desempeño en datos que no vio.</p>
      <p>Los datos se organizan en una <strong>matriz de atributos</strong> \(X\) —una fila por ejemplo, una columna por atributo—
      y, cuando se quiere predecir algo, un <strong>vector objetivo</strong> \(y\). Cada fila de \(X\) es un punto del
      <strong>espacio de atributos</strong>, y aprender es encontrar una función sobre ese espacio. Las bibliotecas resumen el
      proceso en tres verbos: <code>fit</code> (aprender de los datos), <code>transform</code> (cambiar su representación) y
      <code>predict</code> (aplicar lo aprendido a datos nuevos).</p>`,
    visualizaciones: [
      {
        titulo: 'De la tabla al espacio de atributos',
        descripcion: 'Elija qué dos atributos usar como ejes. Con los del pétalo las tres especies se separan casi solas; con el largo del sépalo se mezclan: la representación importa tanto como el algoritmo.',
        montar: montarMatriz,
      },
      {
        titulo: 'fit, transform y predict',
        descripcion: 'Un clasificador de k vecinos más cercanos con un paso de estandarización. Active y desactive la estandarización: la frontera pasa de franjas horizontales a una diagonal, y la exactitud de validación sube.',
        montar: montarTubo,
      },
    ],
    teoria: String.raw`
      <h2>Qué es aprender</h2>
      <p>Según la definición clásica de Mitchell (1997), un programa <em>aprende</em> de la experiencia \(E\) con respecto a una
      tarea \(T\) y una medida de desempeño \(P\) si su desempeño en \(T\), medido por \(P\), mejora con \(E\). Por ejemplo:
      \(T\) = clasificar correos, \(P\) = porcentaje de aciertos, \(E\) = correos ya etiquetados.</p>

      <h2>Aprendizaje inductivo</h2>
      <p>Se supone que existe una función desconocida \(f : \mathcal{X} \to \mathcal{Y}\) y se observan ejemplos
      \((x_i, y_i)\) con \(y_i \approx f(x_i)\). El aprendiz elige una <em>hipótesis</em> \(h\) de un <em>espacio de hipótesis</em>
      \(\mathcal{H}\) (rectas, árboles, redes…) que se ajuste a los ejemplos y, sobre todo, que <strong>generalice</strong>. Como
      infinitas funciones coinciden con cualquier conjunto finito de ejemplos, la elección depende del sesgo inductivo: preferir
      hipótesis simples (navaja de Occam), suaves, lineales, etc.</p>

      <h2>Representación de los datos</h2>
      <p>Con \(n\) ejemplos y \(d\) atributos:</p>
      \[ X = \begin{pmatrix} x_{11} &amp; \cdots &amp; x_{1d} \\ \vdots &amp; \ddots &amp; \vdots \\ x_{n1} &amp; \cdots &amp; x_{nd} \end{pmatrix} \in \mathbb{R}^{n \times d},
         \qquad y = \begin{pmatrix} y_1 \\ \vdots \\ y_n \end{pmatrix}. \]
      <ul>
        <li>El <strong>espacio de atributos</strong> es \(\mathbb{R}^d\); cada fila \(x_i^\top\) es un punto de él.</li>
        <li>El <strong>vector objetivo</strong> \(y\) contiene números reales (regresión) o etiquetas de clase (clasificación).</li>
        <li>Atributos categóricos se codifican (por ejemplo, <em>one-hot</em>); textos e imágenes se convierten en vectores.</li>
      </ul>

      <h2>La interfaz de un estimador</h2>
      <table>
        <thead><tr><th>Método</th><th>Qué hace</th><th>Ejemplo</th></tr></thead>
        <tbody>
          <tr><td><code>fit(X, y)</code></td><td>estima los parámetros a partir de los datos de entrenamiento</td><td>media y desviación; pesos de una regresión</td></tr>
          <tr><td><code>transform(X)</code></td><td>devuelve una nueva representación de \(X\) con los parámetros aprendidos</td><td>estandarizar, PCA</td></tr>
          <tr><td><code>predict(X)</code></td><td>aplica el modelo ajustado a ejemplos nuevos</td><td>clase o valor estimado</td></tr>
        </tbody>
      </table>
      <div class="recuadro"><strong>Fuga de datos.</strong> Toda transformación se ajusta (<code>fit</code>) solo con el conjunto de
      entrenamiento y luego se aplica (<code>transform</code>) igual a validación y prueba. Calcular \(\mu\) y \(\sigma\) con todos los
      datos filtra información de los ejemplos de evaluación y hace que el error medido sea optimista.</div>
      <p>La estandarización \(x'_j = (x_j - \mu_j)/\sigma_j\) importa en todo método basado en distancias o en gradientes: sin ella,
      el atributo con números más grandes domina, como se ve en la Fig. 2.</p>

      <h2>Tipos de aprendizaje</h2>
      <ul>
        <li><a href="tema.html?id=supervised-learning"><strong>Supervisado</strong></a>: se conocen \(X\) e \(y\); se aprende a
        predecir \(y\). Regresión (<a href="tema.html?id=linear-regression">lineal</a>) y clasificación
        (<a href="tema.html?id=logistic-regression">logística</a>, <a href="tema.html?id=naive-bayes">Naive Bayes</a>,
        <a href="tema.html?id=decision-trees">árboles</a>, <a href="tema.html?id=svm">SVM</a>,
        <a href="tema.html?id=neural-networks">redes neuronales</a>).</li>
        <li><a href="tema.html?id=unsupervised-learning"><strong>No supervisado</strong></a>: solo \(X\); se busca estructura
        (grupos, direcciones principales, densidad).</li>
        <li><a href="tema.html?id=reinforcement-learning"><strong>Por refuerzo</strong></a>: no hay ejemplos etiquetados sino un
        agente que actúa y recibe recompensas; aprende una política.</li>
      </ul>`,
  });
})();
