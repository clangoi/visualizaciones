(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.ml;
  const fmtC = (v) => VIZ.fmt(Math.pow(10, v), 3);

  // Frontera f = 0, márgenes f = ±1 y vectores de soporte.
  function dibujarSVM(ctx, plano, modelo, pts) {
    M.contorno(ctx, plano, modelo.f, 1, { color: C.tinta2, ancho: 1.2, guiones: [5, 4] });
    M.contorno(ctx, plano, modelo.f, -1, { color: C.tinta2, ancho: 1.2, guiones: [5, 4] });
    M.contorno(ctx, plano, modelo.f, 0, { color: C.tinta, ancho: 2.5 });
    const acot = new Set(modelo.acotados), sv = new Set(modelo.sv);
    M.puntos(ctx, plano, pts, { anillo: (q) => { const i = pts.indexOf(q); return acot.has(i) ? C.s8 : sv.has(i) ? C.tinta : null; } });
  }
  const LEYENDA_SVM = [
    ...M.leyendaClases(2, ['y = −1', 'y = +1']),
    { color: C.tinta, texto: 'frontera f(x) = 0', forma: 'linea' },
    { color: C.tinta2, texto: 'márgenes f(x) = ±1', forma: 'linea' },
    { color: C.superficie, borde: C.tinta, texto: 'vector de soporte en el margen', forma: 'punto' },
    { color: C.superficie, borde: C.s8, texto: 'vector de soporte con α = C (viola el margen)', forma: 'punto' },
  ];

  /* ---------- Fig. 1: margen máximo ---------- */

  function montarMargen(cuerpo) {
    let tipo = 'manchas', logC = 1, clase = 1, semilla = 2, pts = [], modelo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: [['manchas', 'Dos manchas'], ['lineal', 'Separable linealmente']], valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    ctl.rango({ etiqueta: 'Penalización C', min: -2, max: 3, paso: 0.1, valor: logC, formato: fmtC, alCambiar: (v) => { logC = v; entrenar(); } });
    ctl.selector({ etiqueta: 'Clase al hacer clic', opciones: [['0', 'y = −1 (azul)'], ['1', 'y = +1 (naranjo)']], valor: '1', alCambiar: (v) => { clase = +v; } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, LEYENDA_SVM);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para agregar un punto de la clase elegida, o sobre un punto para quitarlo. Mover o quitar un punto que no es vector de soporte no cambia la frontera.');

    function datos() { pts = M.datos(tipo, 40, tipo === 'manchas' ? 0.15 : 0.1, semilla * 5); entrenar(); }
    function entrenar() { modelo = pts.some((q) => q.c) && pts.some((q) => !q.c) ? M.svm(pts, { C: Math.pow(10, logC) }) : null; dibujar(); }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = M.plano(lienzo);
      if (modelo) M.regiones(ctx, plano, (x, y) => M.sigmoide(1.5 * modelo.f(x, y)), { intensidad: 0.25 });
      plano.ejes();
      if (modelo) dibujarSVM(ctx, plano, modelo, pts); else M.puntos(ctx, plano, pts);
      if (!modelo) { registro.textContent = 'Hacen falta puntos de las dos clases.'; lectura.set([]); return; }
      const nw = Math.hypot(...modelo.w), libres = modelo.sv.length - modelo.acotados.length;
      const acc = pts.filter((q) => (modelo.f(q.x, q.y) > 0 ? 1 : 0) === q.c).length / pts.length;
      registro.textContent = `f(x) = ${VIZ.fmt(modelo.w[0], 3)}·x₁ ${modelo.w[1] < 0 ? '−' : '+'} ${VIZ.fmt(Math.abs(modelo.w[1]), 3)}·x₂ ${modelo.b < 0 ? '−' : '+'} ${VIZ.fmt(Math.abs(modelo.b), 3)}. ` +
        `Solo ${modelo.sv.length} de los ${pts.length} puntos (los vectores de soporte) determinan w.`;
      lectura.set([
        ['ancho del margen 2/‖w‖', VIZ.fmt(2 / nw, 3)],
        ['vectores de soporte', String(modelo.sv.length)],
        ['justo en el margen', String(libres)],
        ['violan el margen', String(modelo.acotados.length)],
        ['exactitud', `${Math.round(100 * acc)} %`],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      const i = M.cercano(plano, pts, x, y, 8);
      if (i >= 0) pts.splice(i, 1); else pts.push({ x: plano.ix(x), y: plano.iy(y), c: clase });
      entrenar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !modelo || !plano.dentro(x, y)) return tip.ocultar();
      const i = M.cercano(plano, pts, x, y, 8);
      if (i < 0) return tip.mostrar(x, y, `f(x) = <b>${VIZ.fmt(modelo.f(plano.ix(x), plano.iy(y)), 3)}</b>`);
      tip.mostrar(x, y, `y = <b>${pts[i].c ? '+1' : '−1'}</b> · α = <b>${VIZ.fmt(modelo.alfa[i], 3)}</b><br>y·f(x) = <b>${VIZ.fmt((pts[i].c ? 1 : -1) * modelo.f(pts[i].x, pts[i].y), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  /* ---------- Fig. 2: SVM multiclase y exemplar-SVM ---------- */

  function montarMulticlase(cuerpo) {
    let estrategia = 'ovr', logC = 0, positiva = 0, semilla = 1, pts = [], modelos = [], elegido = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', opciones: [['ovr', 'Uno contra el resto'], ['ovo', 'Uno contra uno'], ['exemplar', 'Exemplar-SVM']], valor: estrategia,
      alCambiar: (v) => { estrategia = v; entrenar(); } });
    ctl.rango({ etiqueta: 'Penalización C', min: -2, max: 2, paso: 0.1, valor: logC, formato: fmtC, alCambiar: (v) => { logC = v; entrenar(); } });
    ctl.selector({ etiqueta: 'Clase de los exemplars', opciones: [0, 1, 2].map((k) => [String(k), `clase ${k}`]), valor: '0', alCambiar: (v) => { positiva = +v; entrenar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con exemplar-SVM, haga clic en un punto de la clase elegida para ver la frontera de su clasificador propio. Pase el cursor para ver los puntajes de cada clasificador.');

    function datos() { pts = M.datos('tres', 150, 0.3, semilla * 13); entrenar(); }
    const C0 = () => Math.pow(10, logC);
    function entrenar() {
      elegido = -1;
      if (estrategia === 'ovr') modelos = [0, 1, 2].map((k) => ({ k, m: M.svm(pts, { C: C0(), etiqueta: (q) => (q.c === k ? 1 : -1) }) }));
      else if (estrategia === 'ovo') modelos = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => ({ a, b, m: M.svm(pts.filter((q) => q.c === a || q.c === b), { C: C0(), etiqueta: (q) => (q.c === a ? 1 : -1) }) }));
      else {
        const neg = pts.filter((q) => q.c !== positiva);
        // Un SVM lineal por cada ejemplo positivo contra todos los negativos, con C asimétrico.
        modelos = pts.filter((q) => q.c === positiva).map((e) => ({ e, m: M.svm([e, ...neg], { C: 0.1 * C0(), Cpos: 10 * C0(), etiqueta: (q) => (q === e ? 1 : -1) }) }));
      }
      leyenda.set(estrategia === 'exemplar'
        ? [...M.leyendaClases(3), { color: VIZ.alfa(M.CLASES[positiva], 0.4), texto: 'algún exemplar detecta (máx sₑ > 0)' }, { color: C.tinta, texto: 'frontera del exemplar elegido', forma: 'linea' }]
        : [...M.leyendaClases(3), { color: C.tinta2, texto: estrategia === 'ovr' ? 'fronteras fₖ(x) = 0 de cada clasificador' : 'fronteras de cada par de clases', forma: 'linea' }]);
      dibujar();
    }
    // Probabilidades «suaves» para colorear las regiones.
    function puntajes(x, y) {
      if (estrategia === 'ovr') { const f = modelos.map((o) => o.m.f(x, y)); const e = f.map((v) => Math.exp(3 * v)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); }
      if (estrategia === 'ovo') {
        const v = [0, 0, 0];
        for (const o of modelos) { const f = o.m.f(x, y); v[f > 0 ? o.a : o.b] += 1 + 0.01 * Math.min(1, Math.abs(f)); }
        const s = v.reduce((a, b) => a + b, 0); return v.map((z) => z / s);
      }
      const s = maxExemplar(x, y);
      const p = M.sigmoide(3 * s);
      return [0, 1, 2].map((k) => (k === positiva ? p : (1 - p) / 2));
    }
    const maxExemplar = (x, y) => modelos.reduce((m, o) => Math.max(m, o.m.w[0] * x + o.m.w[1] * y + o.m.b), -Infinity);
    const predice = (q) => { const p = puntajes(q.x, q.y); return estrategia === 'exemplar' ? (maxExemplar(q.x, q.y) > 0) === (q.c === positiva) : p.indexOf(Math.max(...p)) === q.c; };

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = M.plano(lienzo);
      M.regiones(ctx, plano, puntajes, { intensidad: 0.3 });
      plano.ejes();
      ctx.save();
      plano.recortar();
      if (estrategia === 'ovr') modelos.forEach((o) => M.contorno(ctx, plano, o.m.f, 0, { color: M.CLASES[o.k], ancho: 1.5, guiones: [5, 4] }));
      else if (estrategia === 'ovo') modelos.forEach((o) => M.contorno(ctx, plano, o.m.f, 0, { color: C.tinta2, ancho: 1.2, guiones: [5, 4] }));
      else if (elegido >= 0) M.contorno(ctx, plano, modelos[elegido].m.f, 0, { color: C.tinta, ancho: 2.5 });
      ctx.restore();
      const e = elegido >= 0 ? modelos[elegido].e : null;
      M.puntos(ctx, plano, pts, { r: 3.5, anillo: (q) => (q === e ? C.tinta : null) });
      const acc = pts.filter(predice).length / pts.length;
      registro.textContent = {
        ovr: 'Tres SVM binarios, uno por clase contra todas las demás; gana el de mayor puntaje fₖ(x). Fuera de las fronteras de todos, decide quién está «menos lejos».',
        ovo: 'Tres SVM, uno por cada par de clases, entrenados solo con los puntos de ese par; cada uno vota y gana la clase con más votos.',
        exemplar: elegido >= 0 ? `Exemplar ${elegido + 1}: su SVM separa ese único punto de todos los de otras clases. Su frontera rodea una región pequeña alrededor de él.`
          : `${modelos.length} SVM lineales, uno por cada ejemplo de la clase ${positiva} contra todos los ejemplos de las otras clases. Un punto nuevo es de la clase si algún exemplar lo reconoce.`,
      }[estrategia];
      lectura.set([
        ['clasificadores entrenados', String(modelos.length)],
        [estrategia === 'exemplar' ? `exactitud (clase ${positiva} o no)` : 'exactitud de entrenamiento', `${Math.round(100 * acc)} %`],
        ['vectores de soporte (total)', String(modelos.reduce((s, o) => s + o.m.sv.length, 0))],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      if (estrategia !== 'exemplar') return;
      const { x, y } = lienzo.posicion(ev);
      const i = M.cercano(plano, modelos.map((o) => o.e), x, y, 10);
      elegido = i === elegido ? -1 : i;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      lienzo.canvas.style.cursor = estrategia === 'exemplar' ? 'pointer' : 'default';
      const px = plano.ix(x), py = plano.iy(y);
      let html;
      if (estrategia === 'ovr') html = modelos.map((o) => VIZ.filaTooltip(M.CLASES[o.k], `f${'₀₁₂'[o.k]}(x)`, VIZ.fmt(o.m.f(px, py), 3))).join('');
      else if (estrategia === 'ovo') html = modelos.map((o) => { const f = o.m.f(px, py); return `${o.a} contra ${o.b}: vota <b>${f > 0 ? o.a : o.b}</b>`; }).join('<br>');
      else html = `máximo puntaje de los exemplars: <b>${VIZ.fmt(maxExemplar(px, py), 3)}</b>`;
      tip.mostrar(x, y, html);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  /* ---------- Fig. 3: kernels ---------- */

  function montarKernel(cuerpo) {
    let tipo = 'circulos', kernel = 'rbf', logG = 0.3, grado = 2, logC = 1, semilla = 1, tr = [], va = [], modelo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS.filter(([k]) => k !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    ctl.selector({ etiqueta: 'Kernel', opciones: [['lineal', 'Lineal ⟨x, z⟩'], ['poli', 'Polinomial (⟨x, z⟩ + 1)ᵈ'], ['rbf', 'Gaussiano (RBF)']], valor: kernel, alCambiar: (v) => { kernel = v; entrenar(); } });
    ctl.rango({ etiqueta: 'γ (RBF)', min: -1, max: 2, paso: 0.1, valor: logG, formato: fmtC, alCambiar: (v) => { logG = v; entrenar(); } });
    ctl.rango({ etiqueta: 'Grado d (polinomial)', min: 2, max: 6, valor: grado, alCambiar: (v) => { grado = v; entrenar(); } });
    ctl.rango({ etiqueta: 'Penalización C', min: -1, max: 3, paso: 0.1, valor: logC, formato: fmtC, alCambiar: (v) => { logC = v; entrenar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, LEYENDA_SVM);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se muestran los datos de entrenamiento; la exactitud de validación se mide con otros puntos de la misma distribución. Pase el cursor para ver f(x).');

    function datos() { ({ entrenamiento: tr, validacion: va } = M.partir(M.datos(tipo, 180, 0.25, semilla * 17), 0.6, semilla)); entrenar(); }
    function entrenar() { modelo = M.svm(tr, { kernel, C: Math.pow(10, logC), gamma: Math.pow(10, logG), grado }); dibujar(); }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = M.plano(lienzo);
      M.regiones(ctx, plano, (x, y) => M.sigmoide(1.5 * modelo.f(x, y)), { intensidad: 0.25 });
      plano.ejes();
      ctx.save(); plano.recortar(); dibujarSVM(ctx, plano, modelo, tr); ctx.restore();
      const acc = (pts) => pts.filter((q) => (modelo.f(q.x, q.y) > 0 ? 1 : 0) === q.c).length / pts.length;
      registro.textContent = {
        lineal: 'Kernel lineal: la frontera es una recta en el plano original.',
        poli: `Kernel polinomial de grado ${grado}: equivale a una frontera lineal en el espacio de todos los monomios de grado ≤ ${grado}, sin construirlo.`,
        rbf: `Kernel gaussiano con γ = ${fmtC(logG)}: cada vector de soporte aporta una «colina» de radio ≈ 1/√γ = ${VIZ.fmt(1 / Math.sqrt(Math.pow(10, logG)), 3)}. Un γ grande sobreajusta.`,
      }[kernel];
      lectura.set([
        ['vectores de soporte', `${modelo.sv.length} de ${tr.length}`],
        ['exactitud entrenamiento', `${Math.round(100 * acc(tr))} %`],
        ['exactitud validación', `${Math.round(100 * acc(va))} %`],
      ]);
    }
    lienzo.alDibujar = () => modelo && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `f(x) = <b>${VIZ.fmt(modelo.f(plano.ix(x), plano.iy(y)), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  VIZ.registrarTema('svm', {
    intro: String.raw`
      <p>Cuando dos clases se pueden separar con una recta, hay infinitas rectas que lo hacen. Una <strong>máquina de vectores de
      soporte</strong> (SVM) elige la que deja el mayor <strong>margen</strong>: la franja vacía más ancha entre las clases. Esa
      recta depende solo de los puntos que tocan la franja, los <strong>vectores de soporte</strong>; el resto de los datos podría
      no existir.</p>
      <p>Con una penalización \(C\) se permiten puntos dentro del margen o mal clasificados (margen blando). Para fronteras curvas,
      el <strong>truco del kernel</strong> reemplaza los productos punto por una función de similitud y obtiene un separador lineal
      en un espacio de atributos de dimensión muy alta —incluso infinita— sin calcularlo nunca. Varias SVM binarias se combinan
      para tener varias clases, y en el extremo, una SVM por cada ejemplo (<strong>exemplar-SVM</strong>).</p>`,
    visualizaciones: [
      {
        titulo: 'Margen máximo y vectores de soporte',
        descripcion: 'Baje C: el margen se ensancha y más puntos quedan dentro de él (anillos rojos). Súbalo: el margen se angosta para clasificar todo bien. Agregue puntos cerca de la frontera y lejos de ella.',
        montar: montarMargen,
      },
      {
        titulo: 'Varias clases y exemplar-SVM',
        descripcion: 'Compare las tres formas de usar SVM binarias con tres clases. En exemplar-SVM cada ejemplo positivo tiene su propio clasificador, que reconoce solo lo que se le parece.',
        montar: montarMulticlase,
      },
      {
        titulo: 'Kernels',
        descripcion: 'Con kernel lineal no se pueden separar círculos concéntricos; con el polinomial de grado 2 o el gaussiano sí. Suba γ hasta que la frontera rodee cada punto: sobreajuste.',
        montar: montarKernel,
      },
    ],
    teoria: String.raw`
      <h2>Margen máximo</h2>
      <p>Con etiquetas \(y_i \in \{-1, +1\}\) y un hiperplano \(f(x) = w^\top x + b\), la distancia de \(x_i\) al hiperplano es
      \(y_i f(x_i)/\lVert w \rVert\). Escalando \(w\) para que los puntos más cercanos cumplan \(y_i f(x_i) = 1\), el margen vale
      \(2/\lVert w \rVert\) y maximizarlo equivale a</p>
      \[ \min_{w, b} \ \tfrac{1}{2}\lVert w \rVert^2 \quad \text{sujeto a} \quad y_i (w^\top x_i + b) \ge 1 \ \ \forall i. \]

      <h2>Margen blando</h2>
      <p>Si los datos no son separables se agregan holguras \(\xi_i \ge 0\):</p>
      \[ \min_{w, b, \xi} \ \tfrac{1}{2}\lVert w \rVert^2 + C \sum_i \xi_i \quad \text{sujeto a} \quad y_i (w^\top x_i + b) \ge 1 - \xi_i. \]
      <p>Equivale a minimizar la pérdida <em>bisagra</em> \(\sum_i \max(0, 1 - y_i f(x_i))\) con regularización \(\lVert w\rVert^2\).
      \(C\) grande castiga los errores (poco sesgo, más varianza); \(C\) pequeño prefiere un margen ancho.</p>

      <h2>Problema dual y vectores de soporte</h2>
      <p>Con multiplicadores de Lagrange \(\alpha_i\), el problema equivale a</p>
      \[ \max_{\alpha} \ \sum_i \alpha_i - \tfrac{1}{2} \sum_{i,j} \alpha_i \alpha_j y_i y_j \, x_i^\top x_j
         \quad \text{sujeto a} \quad 0 \le \alpha_i \le C, \ \ \sum_i \alpha_i y_i = 0, \]
      <p>y \(w = \sum_i \alpha_i y_i x_i\). Por las condiciones de complementariedad (KKT): \(\alpha_i = 0\) si el punto está fuera
      del margen; \(0 &lt; \alpha_i &lt; C\) si está justo sobre él; \(\alpha_i = C\) si lo viola. Solo los puntos con
      \(\alpha_i &gt; 0\) —los vectores de soporte— aparecen en \(f\). Aquí el dual se resuelve con SMO (Platt, 1998), que optimiza
      dos \(\alpha\) a la vez eligiendo el par que más viola las condiciones KKT.</p>

      <h2>El truco del kernel</h2>
      <p>Los datos aparecen en el dual solo a través de productos punto. Si se reemplaza \(x_i^\top x_j\) por
      \(K(x_i, x_j) = \phi(x_i)^\top \phi(x_j)\), la SVM es lineal en el espacio de \(\phi\) sin calcular \(\phi\):</p>
      \[ f(x) = \sum_{i} \alpha_i y_i \, K(x_i, x) + b. \]
      <table>
        <thead><tr><th>Kernel</th><th>\(K(x, z)\)</th><th>Espacio implícito</th></tr></thead>
        <tbody>
          <tr><td>Lineal</td><td>\(x^\top z\)</td><td>el original</td></tr>
          <tr><td>Polinomial</td><td>\((x^\top z + 1)^d\)</td><td>todos los monomios de grado \(\le d\)</td></tr>
          <tr><td>Gaussiano (RBF)</td><td>\(\exp(-\gamma \lVert x - z \rVert^2)\)</td><td>de dimensión infinita</td></tr>
        </tbody>
      </table>
      <p>Una función es un kernel válido si toda matriz \(K_{ij} = K(x_i, x_j)\) es simétrica y semidefinida positiva (teorema de
      Mercer).</p>

      <h2>Varias clases</h2>
      <ul>
        <li><strong>Uno contra el resto:</strong> \(K\) clasificadores, el \(k\)-ésimo separa la clase \(k\) de todas las demás; se
        predice \(\arg\max_k f_k(x)\). Sus puntajes no están calibrados entre sí.</li>
        <li><strong>Uno contra uno:</strong> \(K(K-1)/2\) clasificadores, cada uno con los datos de dos clases; se vota. Más
        clasificadores, pero cada uno más pequeño.</li>
        <li><strong>SVM multiclase directa</strong> (Crammer y Singer): un único problema con un \(w_k\) por clase y la restricción
        \(w_{y_i}^\top x_i \ge w_k^\top x_i + 1\) para todo \(k \ne y_i\).</li>
      </ul>

      <h2>Exemplar-SVM</h2>
      <p>Malisiewicz, Gupta y Efros (2011) propusieron entrenar una SVM lineal por <em>cada ejemplo positivo</em> contra todos los
      negativos, con penalizaciones asimétricas (\(C_+ \gg C_-\)) porque hay un solo positivo:</p>
      \[ \min_{w, b} \ \tfrac12 \lVert w \rVert^2 + C_+ \, \max(0, 1 - f(x_E)) + C_- \sum_{x \in \mathcal{N}} \max(0, 1 + f(x)). \]
      <p>Cada exemplar aprende qué lo distingue del mundo negativo, sin promediar con otros positivos distintos (por ejemplo,
      autos de frente y de perfil). Un objeto se detecta si algún exemplar lo reconoce, y además se sabe <em>cuál</em>: eso permite
      transferir información del ejemplo de entrenamiento (su segmentación, su pose) al detectado.</p>`,
  });
})();
