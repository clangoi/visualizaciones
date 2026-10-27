(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const CLS = [C.s1, C.s2, C.s3];

  /* ---------- Fig. 1: el algoritmo clean paso a paso ---------- */

  function montarClean(cuerpo) {
    let umbral = 0.9, semilla = 1;
    let datos = P.caracteristicas(semilla), R = P.correlacion(datos.X), varianzas = [];
    let quitadas = new Set(), par = null, fase = '', mensaje = '';
    const d = datos.nombres.length;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de correlación |ρ|', min: 0.5, max: 0.995, paso: 0.005, valor: umbral, formato: (v) => v.toFixed(3), alCambiar: (v) => { umbral = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; datos = P.caracteristicas(semilla); R = P.correlacion(datos.X); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 80 + d * Math.floor((Math.min(w, 520) * 0.86 - 80) / d) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.9, [C.superficie, ...VIZ.rampa])), texto: '|ρ| alto' },
      { color: VIZ.css(VIZ.enRampa(0.1, [C.superficie, ...VIZ.rampa])), texto: '|ρ| bajo' },
      { color: C.s2, texto: 'par o característica que se examina' },
      { color: C.s8, texto: 'característica descartada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor por la matriz para ver cada correlación. Con umbral 0,9 se descarta LBP₂ por parecerse a LBP₁, aunque la figura siguiente muestra que la pareja sí aportaba.');

    function iniciar() {
      quitadas = new Set(); par = null;
      varianzas = P.cov(datos.X).map((f, i) => f[i]);
      mensaje = 'Primero se descartan las características constantes; luego, de cada par muy correlacionado, la segunda.';
      return (function* () {
        fase = 'constantes';
        for (let i = 0; i < d; i++) {
          par = [i, i];
          if (varianzas[i] < 1e-8) { quitadas.add(i); mensaje = `«${datos.nombres[i]}» tiene varianza ${VIZ.fmt(varianzas[i])}: es constante y se descarta.`; }
          else mensaje = `«${datos.nombres[i]}» tiene varianza ${VIZ.fmt(varianzas[i], 3)}: se mantiene.`;
          yield;
        }
        fase = 'correlacion';
        for (let i = 0; i < d; i++) for (let j = i + 1; j < d; j++) {
          if (quitadas.has(i) || quitadas.has(j)) continue;
          par = [i, j];
          const r = R[i][j];
          if (Math.abs(r) > umbral) { quitadas.add(j); mensaje = `|ρ(${datos.nombres[i]}, ${datos.nombres[j]})| = ${Math.abs(r).toFixed(3)} > ${umbral}: se descarta «${datos.nombres[j]}».`; yield; }
          else if (Math.abs(r) > 0.3) { mensaje = `|ρ(${datos.nombres[i]}, ${datos.nombres[j]})| = ${Math.abs(r).toFixed(3)}: bajo el umbral, ambas siguen.`; yield; }
        }
        par = null; fase = 'fin';
        mensaje = `Terminado: quedan ${d - quitadas.size} de ${d} características.`;
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(ancho, 520) * 0.86, celda = Math.floor((lado - 80) / d), x0 = 82, y0 = 70;
      geo = { x0, y0, celda };
      P.matriz(ctx, x0, y0, celda, R, {
        t: (i, j) => Math.abs(R[i][j]),
        texto: (i, j) => (i === j ? '' : Math.abs(R[i][j]).toFixed(2).replace(/^0/, '')),
        filas: datos.nombres, columnas: datos.nombres,
        resaltar: (i, j) => (par && ((i === par[0] && j === par[1]) || (i === par[1] && j === par[0])) ? C.s2 : null),
      });
      // Tachado de filas y columnas descartadas.
      ctx.save();
      ctx.strokeStyle = VIZ.alfa(C.s8, 0.8);
      ctx.lineWidth = 2;
      for (const k of quitadas) {
        ctx.beginPath();
        ctx.moveTo(x0 - 74, y0 + k * celda + celda / 2); ctx.lineTo(x0 + d * celda, y0 + k * celda + celda / 2);
        ctx.moveTo(x0 + k * celda + celda / 2, y0); ctx.lineTo(x0 + k * celda + celda / 2, y0 + d * celda);
        ctx.stroke();
      }
      ctx.restore();
      registro.textContent = mensaje;
      const quedan = [...Array(d).keys()].filter((k) => !quitadas.has(k));
      lectura.set([
        ['quedan', `${quedan.length} de ${d}`],
        ['descartadas', [...quitadas].map((k) => datos.nombres[k]).join(', ') || '—'],
        ['J de Fisher con todas', P.fisher(datos.X, datos.y).toFixed(3)],
        ['J con las que quedan', P.fisher(datos.X, datos.y, quedan).toFixed(3)],
      ]);
    }
    lienzo.alDibujar = () => varianzas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), { x0, y0, celda } = geo;
      const j = Math.floor((x - x0) / celda), i = Math.floor((y - y0) / celda);
      if (i < 0 || j < 0 || i >= d || j >= d) return tip.ocultar();
      tip.mostrar(x, y, `${datos.nombres[i]} × ${datos.nombres[j]}<br>ρ <b>${VIZ.fmt(R[i][j], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: correlación no es lo mismo que redundancia ---------- */

  function montarPares(cuerpo) {
    const PARES = [['0,1', 'área y perímetro'], ['6,7', 'LBP₁ y LBP₂'], ['4,5', 'intensidad y contraste'], ['2,8', 'redondez y ruido']];
    let par = [0, 1];
    const datos = P.caracteristicas(1);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Pareja de características', opciones: PARES, valor: '0,1', alCambiar: (v) => { par = v.split(',').map(Number); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, datos.clases.map((t, c) => ({ color: CLS[c], texto: t, forma: c ? 'cuadro' : 'punto' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Área y perímetro están correlacionadas y la segunda no agrega nada. LBP₁ y LBP₂ también lo están, pero su diferencia separa a las tuercas: juntas valen mucho más que cada una por separado.');

    let plano = null, pts = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const [a, b] = par;
      pts = datos.X.map((f, i) => ({ x: f[a], y: f[b], c: datos.y[i] }));
      const ext = (k) => { const v = datos.X.map((f) => f[k]); const m = Math.min(...v), M = Math.max(...v), r = M - m || 1; return [m - 0.05 * r, M + 0.05 * r]; };
      const [xmin, xmax] = ext(a), [ymin, ymax] = ext(b);
      plano = VIZ.plano(lienzo, { xmin, xmax, ymin, ymax }, { etiquetaX: datos.nombres[a], etiquetaY: datos.nombres[b], margen: { izq: 44 } });
      plano.ejes();
      for (const q of pts) VIZ.marcador(ctx, plano.sx(q.x), plano.sy(q.y), CLS[q.c], 4, q.c);
      const R = P.correlacion(datos.X);
      lectura.set([
        ['correlación', VIZ.fmt(R[a][b], 3)],
        [`J(${datos.nombres[a]})`, P.fisher(datos.X, datos.y, [a]).toFixed(3)],
        [`J(${datos.nombres[b]})`, P.fisher(datos.X, datos.y, [b]).toFixed(3)],
        ['J de la pareja', P.fisher(datos.X, datos.y, [a, b]).toFixed(3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      pts.forEach((q, i) => { const dd = Math.hypot(plano.sx(q.x) - x, plano.sy(q.y) - y); if (dd < dm) { dm = dd; m = i; } });
      if (m < 0) return tip.ocultar();
      const q = pts[m];
      tip.mostrar(x, y, VIZ.filaTooltip(CLS[q.c], datos.clases[q.c]) + `${datos.nombres[par[0]]} <b>${VIZ.fmt(q.x, 3)}</b><br>${datos.nombres[par[1]]} <b>${VIZ.fmt(q.y, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('clean', {
    intro: String.raw`
      <p>Antes de buscar el mejor subconjunto de características conviene una <strong>limpieza</strong> barata: sacar las que no
      pueden aportar nada. Una característica <em>constante</em> no distingue ningún objeto de otro, y si dos características están
      casi perfectamente <em>correlacionadas</em>, la segunda repite la información de la primera.</p>
      <p>El algoritmo <strong>clean</strong> (así se llama en la caja de herramientas Balu de reconocimiento de patrones) hace
      exactamente eso, sin mirar las clases. Es rápido y reduce el trabajo de los métodos de selección que vienen después,
      pero un umbral de correlación demasiado bajo puede descartar información útil.</p>`,
    visualizaciones: [
      {
        titulo: 'El algoritmo clean paso a paso',
        descripcion: 'La matriz de correlación absoluta de diez características de objetos segmentados. Baje el umbral y observe cuántas características caen.',
        montar: montarClean,
      },
      {
        titulo: 'Correlación no es redundancia',
        descripcion: 'Dos parejas igual de correlacionadas pueden comportarse distinto: J de Fisher de cada característica sola y de la pareja.',
        montar: montarPares,
      },
    ],
    teoria: String.raw`
      <h2>Datos</h2>
      <p>Las características forman una matriz \(X \in \mathbb{R}^{n \times d}\): una fila por objeto y una columna por característica.
      Para la columna \(j\) se calculan su varianza \(s_j^2\) y, para cada par, el coeficiente de correlación de Pearson</p>
      \[ \rho_{ij} = \frac{\operatorname{cov}(x_i, x_j)}{s_i\, s_j} \in [-1, 1]. \]
      <h2>Algoritmo</h2>
      <pre><code>S ← {1, …, d}
para j en S:
    si s_j² &lt; ε:  S ← S − {j}                        (constante)
para i en S en orden:
    para j en S con j &gt; i:
        si |ρ_ij| &gt; umbral:  S ← S − {j}             (redundante con i)
devolver S</code></pre>
      <p>Cuesta \(O(n d^2)\) calcular la matriz de correlación y \(O(d^2)\) recorrerla: es lineal en el número de muestras, mientras
      que una <a href="tema.html?id=exhaustive-search">búsqueda exhaustiva</a> es exponencial en \(d\).</p>
      <h2>Qué conserva y qué pierde</h2>
      <ul>
        <li>Si \(|\rho_{ij}| = 1\), \(x_j = a x_i + b\) y la segunda característica es inútil para cualquier clasificador lineal.</li>
        <li>Con \(|\rho_{ij}|\) alto pero menor que 1, la diferencia \(x_i - x_j\) puede llevar justo la información que separa las
        clases. Es el caso de LBP₁ y LBP₂ en la figura: ambas contienen la misma componente de ruido \(u\), y la resta la cancela.</li>
        <li>Clean no usa las etiquetas: no sabe qué característica es más útil y descarta la que aparece después en el orden.
        Una variante elige, de cada par correlacionado, la de mayor <a href="tema.html?id=fisher">criterio de Fisher</a>.</li>
      </ul>
      <div class="recuadro"><p>Por eso se usan umbrales altos (Balu usa 0,99 por defecto): clean solo debe quitar lo
      claramente inútil y dejar las decisiones finas a <a href="tema.html?id=sfs">SFS</a>, <a href="tema.html?id=branch-and-bound">branch
      and bound</a> o una transformación como <a href="tema.html?id=pca">PCA</a>.</p></div>
      <h2>Normalización</h2>
      <p>La correlación no depende de las unidades, pero muchos clasificadores sí. Después de limpiar, cada columna se suele
      normalizar a media 0 y varianza 1, con la media y la desviación calculadas <em>solo en entrenamiento</em>.</p>`,
  });
})();
