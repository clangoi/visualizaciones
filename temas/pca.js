(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const CLS = [C.s1, C.s2, C.s3];

  /* ---------- Fig. 1: la dirección de máxima varianza ---------- */

  function montarDireccion(cuerpo) {
    let rho = 0.7, escala = 1.6, n = 120, semilla = 2, th = 0;
    let pts = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Correlación de los datos', min: -0.95, max: 0.95, paso: 0.05, valor: rho, formato: (v) => v.toFixed(2), alCambiar: (v) => { rho = v; generar(); } });
    ctl.rango({ etiqueta: 'Escala de x₁ / x₂', min: 0.5, max: 3, paso: 0.1, valor: escala, formato: (v) => v.toFixed(1), alCambiar: (v) => { escala = v; generar(); } });
    const rTh = ctl.rango({ etiqueta: 'Dirección θ', min: 0, max: 180, valor: 0, formato: (v) => `${v}°`, alCambiar: (v) => { th = (v * Math.PI) / 180; dibujar(); } });
    ctl.boton('Primera componente', () => {
      const v = P.eigSim(P.cov(pts)).vectores[0];
      let a = Math.atan2(v[1], v[0]); if (a < 0) a += Math.PI;
      th = a; rTh.valor = Math.round((a * 180) / Math.PI); dibujar();
    }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'dato', forma: 'punto' },
      { color: C.s4, texto: 'dirección elegida y proyecciones', forma: 'linea' },
      { color: C.s8, texto: 'error de reconstrucción (distancia a la recta)', forma: 'linea' },
      { color: C.s1, texto: 'componentes principales (largo ∝ √λ)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gire θ: la varianza de la proyección más el error cuadrático medio siempre suman la varianza total, así que maximizar una es minimizar la otra. Ambas se optimizan en la primera componente.');

    function generar() {
      const rnd = VIZ.semilla(semilla);
      pts = Array.from({ length: n }, () => {
        const a = VIZ.normal(rnd), b = VIZ.normal(rnd);
        return [0.45 * escala * a, 0.45 * (rho * a + Math.sqrt(1 - rho * rho) * b)];
      });
      const mu = P.media(pts);
      pts = pts.map((p) => [p[0] - mu[0], p[1] - mu[1]]);
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const r = 2.2;
      const plano = VIZ.plano(lienzo, { xmin: -r * 1.6, xmax: r * 1.6, ymin: -r, ymax: r }, { etiquetaX: 'x₁', etiquetaY: 'x₂', margen: { izq: 40 } });
      plano.ejes();
      const w = [Math.cos(th), Math.sin(th)];
      VIZ.trazar(ctx, plano, [[-6 * w[0], -6 * w[1]], [6 * w[0], 6 * w[1]]], C.s4, 2);
      let varP = 0, err = 0;
      ctx.save();
      plano.recortar();
      for (const p of pts) {
        const z = p[0] * w[0] + p[1] * w[1], q = [z * w[0], z * w[1]];
        varP += z * z; err += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        ctx.strokeStyle = VIZ.alfa(C.s8, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plano.sx(p[0]), plano.sy(p[1])); ctx.lineTo(plano.sx(q[0]), plano.sy(q[1])); ctx.stroke();
      }
      ctx.restore();
      for (const p of pts) VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), C.inactivo, 3.5);
      for (const p of pts) {
        const z = p[0] * w[0] + p[1] * w[1];
        ctx.fillStyle = C.s4;
        ctx.fillRect(plano.sx(z * w[0]) - 1.5, plano.sy(z * w[1]) - 1.5, 3, 3);
      }
      const S = P.cov(pts, [0, 0], true), e = P.eigSim(S);
      e.vectores.forEach((v, k) => {
        const l = 2 * Math.sqrt(Math.max(0, e.valores[k]));
        ctx.save();
        ctx.strokeStyle = C.s1; ctx.lineWidth = k ? 2 : 3;
        ctx.beginPath(); ctx.moveTo(plano.sx(-l * v[0]), plano.sy(-l * v[1])); ctx.lineTo(plano.sx(l * v[0]), plano.sy(l * v[1])); ctx.stroke();
        ctx.fillStyle = C.s1; ctx.font = VIZ.fuente(11, 500);
        ctx.fillText(`PC${k + 1}`, plano.sx(l * v[0]) + 6, plano.sy(l * v[1]) - 4);
        ctx.restore();
      });
      varP /= n; err /= n;
      const tot = e.valores[0] + e.valores[1];
      lectura.set([
        ['varianza proyectada', varP.toFixed(3)],
        ['error cuadrático medio', err.toFixed(3)],
        ['suma', (varP + err).toFixed(3)],
        ['λ₁, λ₂', `${e.valores[0].toFixed(3)}, ${e.valores[1].toFixed(3)}`],
        ['explicada por PC1', `${((100 * e.valores[0]) / tot).toFixed(1)} %`],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    generar();
  }

  /* ---------- Fig. 2: de diez características a dos ---------- */

  function montarProyeccion(cuerpo) {
    let estandarizar = true, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'estandarizar las características (media 0, varianza 1)', valor: estandarizar, alCambiar: (v) => { estandarizar = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); });
    VIZ.subtitulo(cuerpo, 'Varianza explicada por cada componente');
    const lienzoS = VIZ.lienzo(cuerpo, { proporcion: 0.26, altoMin: 170, altoMax: 230 });
    const tipS = VIZ.tooltip(lienzoS);
    VIZ.subtitulo(cuerpo, 'Datos proyectados sobre las dos primeras componentes');
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'varianza de cada componente' },
      { color: C.tinta, texto: 'varianza acumulada', forma: 'linea' },
      { color: C.s1, texto: 'tornillo', forma: 'punto' },
      { color: C.s2, texto: 'tuerca' },
      { color: C.s3, texto: 'arandela' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Sin estandarizar, PCA solo ve las características de mayor varianza numérica (área, perímetro, LBP). Las clases no intervienen en PCA: la proyección conserva la varianza, no necesariamente la separación.');

    let Z = [], y = [], valores = [], vectores = [], usadas = [], nombres = [], planoS = null, plano = null;
    function calcular() {
      const datos = P.caracteristicas(semilla);
      nombres = datos.nombres;
      // La característica constante se excluye: no tiene varianza.
      const S0 = P.cov(datos.X);
      usadas = nombres.map((_, j) => j).filter((j) => S0[j][j] > 1e-10);
      let X = datos.X.map((f) => usadas.map((j) => f[j]));
      const mu = P.media(X), sd = usadas.map((_, k) => Math.sqrt(P.cov(X)[k][k]));
      X = X.map((f) => f.map((v, k) => (v - mu[k]) / (estandarizar ? sd[k] : 1)));
      const e = P.eigSim(P.cov(X));
      valores = e.valores.map((v) => Math.max(0, v)); vectores = e.vectores;
      Z = X.map((f) => [P.punto(f, vectores[0]), P.punto(f, vectores[1])]);
      y = datos.y;
      dibujar();
    }
    function dibujar() {
      const tot = valores.reduce((a, b) => a + b, 0) || 1;
      // Scree.
      {
        const { ctx } = lienzoS;
        lienzoS.limpiar();
        const k = valores.length;
        planoS = VIZ.plano(lienzoS, { xmin: 0.5, xmax: k + 0.5, ymin: 0, ymax: 1 }, { margen: { izq: 44 }, ticksX: valores.map((_, i) => i + 1),
          formatoX: (v) => `PC${v}`, formatoY: (v) => `${Math.round(v * 100)}%` });
        planoS.ejes();
        const bw = planoS.sx(1) - planoS.sx(0);
        let ac = 0;
        const acum = [];
        valores.forEach((v, i) => {
          const f = v / tot;
          ac += f; acum.push([i + 1, ac]);
          ctx.fillStyle = C.s1;
          ctx.beginPath(); ctx.roundRect(planoS.sx(i + 0.5) + 2, planoS.sy(f), bw - 4, planoS.y0 - planoS.sy(f), [4, 4, 0, 0]); ctx.fill();
        });
        VIZ.trazar(ctx, planoS, acum, C.tinta, 2);
        for (const [x, v] of acum) VIZ.marcador(ctx, planoS.sx(x), planoS.sy(v), C.tinta, 3.5);
      }
      // Proyección.
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ext = Math.max(...Z.flat().map(Math.abs)) * 1.08;
      plano = VIZ.plano(lienzo, { xmin: -ext * 1.5, xmax: ext * 1.5, ymin: -ext, ymax: ext }, { etiquetaX: 'PC1', etiquetaY: 'PC2', margen: { izq: 44 } });
      plano.ejes();
      Z.forEach((z, i) => VIZ.marcador(ctx, plano.sx(z[0]), plano.sy(z[1]), CLS[y[i]], 4, y[i]));
      const pesos = (k) => vectores[k].map((v, j) => [Math.abs(v), nombres[usadas[j]]]).sort((a, b) => b[0] - a[0]).slice(0, 2).map((p) => p[1]).join(', ');
      lectura.set([
        ['PC1 + PC2', `${((100 * (valores[0] + valores[1])) / tot).toFixed(1)} %`],
        ['componentes para el 90 %', String(valores.reduce((s, v, i) => (s.ac < 0.9 ? { ac: s.ac + v / tot, n: i + 1 } : s), { ac: 0, n: 0 }).n)],
        ['pesos mayores en PC1', pesos(0)],
        ['pesos mayores en PC2', pesos(1)],
      ]);
    }
    lienzo.alDibujar = () => Z.length && dibujar();
    lienzoS.alDibujar = () => Z.length && dibujar();
    lienzoS.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: yy } = lienzoS.posicion(ev);
      if (!planoS || !planoS.dentro(x, yy)) return tipS.ocultar();
      const i = Math.round(planoS.ix(x)) - 1;
      if (i < 0 || i >= valores.length) return tipS.ocultar();
      const tot = valores.reduce((a, b) => a + b, 0);
      const top = vectores[i].map((v, j) => [v, nombres[usadas[j]]]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 3);
      tipS.mostrar(x, yy, `PC${i + 1}: λ = <b>${valores[i].toFixed(3)}</b> (${((100 * valores[i]) / tot).toFixed(1)} %)<br>` + top.map(([v, t]) => `${t} ${VIZ.fmt(v, 2)}`).join('<br>'));
    });
    lienzoS.canvas.addEventListener('pointerleave', () => tipS.ocultar());
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: yy } = lienzo.posicion(ev);
      let m = -1, dm = 9;
      Z.forEach((z, i) => { const d = Math.hypot(plano.sx(z[0]) - x, plano.sy(z[1]) - yy); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return tip.ocultar();
      tip.mostrar(x, yy, VIZ.filaTooltip(CLS[y[m]], ['tornillo', 'tuerca', 'arandela'][y[m]]) + `PC1 <b>${VIZ.fmt(Z[m][0], 3)}</b><br>PC2 <b>${VIZ.fmt(Z[m][1], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('pca', {
    intro: String.raw`
      <p>El <strong>análisis de componentes principales</strong> (PCA) reemplaza las \(d\) características originales por
      combinaciones lineales de ellas, ordenadas de mayor a menor varianza. Las primeras componentes suelen resumir casi toda la
      variabilidad de los datos, y quedarse con ellas reduce la dimensión perdiendo poco.</p>
      <p>A diferencia de la <a href="tema.html?id=sfs">selección de características</a>, PCA <em>transforma</em>: cada componente
      mezcla todas las características originales. Y a diferencia del <a href="tema.html?id=fisher">discriminante de Fisher</a>,
      no usa las clases: busca la dirección donde los datos varían más, sea o no la que las separa.</p>`,
    visualizaciones: [
      {
        titulo: 'La dirección de máxima varianza',
        descripcion: 'Proyecte los datos sobre una recta que pasa por la media. La mejor recta es a la vez la de mayor varianza proyectada y la de menor error de reconstrucción.',
        montar: montarDireccion,
      },
      {
        titulo: 'De diez características a dos',
        descripcion: 'Las nueve características no constantes de objetos de tres clases, proyectadas sobre sus dos primeras componentes principales.',
        montar: montarProyeccion,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(X \in \mathbb{R}^{n \times d}\) con columnas centradas (media cero) y covarianza \(\Sigma = \frac{1}{n} X^\top X\). La
      primera componente principal es la dirección unitaria \(w\) que maximiza la varianza de la proyección \(z = Xw\):</p>
      \[ w_1 = \arg\max_{\lVert w \rVert = 1} w^\top \Sigma\, w. \]
      <p>Con un multiplicador de Lagrange, \(\Sigma w = \lambda w\): \(w_1\) es el vector propio de \(\Sigma\) con el mayor valor
      propio \(\lambda_1\), y la varianza alcanzada es justamente \(\lambda_1\). Las siguientes componentes son los demás vectores
      propios, ortogonales entre sí y no correlacionadas: \(\Sigma = W \Lambda W^\top\).</p>
      <h2>Mínimo error de reconstrucción</h2>
      <p>Proyectar sobre \(k\) componentes y volver, \(\hat x = W_k W_k^\top x\), deja un error medio</p>
      \[ \frac{1}{n}\sum_i \lVert x_i - \hat x_i \rVert^2 = \sum_{j &gt; k} \lambda_j = \operatorname{tr}(\Sigma) - \sum_{j \le k} \lambda_j. \]
      <p>Como \(\operatorname{tr}(\Sigma)\) es fijo, maximizar la varianza retenida y minimizar el error son el mismo problema. La
      fracción \(\sum_{j\le k}\lambda_j / \sum_j \lambda_j\) es la <em>varianza explicada</em>; se elige \(k\) para llegar a un umbral
      (90&nbsp;% o 95&nbsp;%) o donde la curva de valores propios se quiebra (el «codo»).</p>
      <h2>Algoritmo</h2>
      <pre><code>μ ← media de las filas de X;   X ← X − μ
(opcional) dividir cada columna por su desviación estándar
Σ ← XᵀX / n
(λ, W) ← valores y vectores propios de Σ, en orden decreciente
Z ← X · W[:, 1..k]</code></pre>
      <p>Calcular \(\Sigma\) cuesta \(O(n d^2)\) y descomponerla \(O(d^3)\). Con \(d\) grande (imágenes) se usa la descomposición en
      valores singulares de \(X\) directamente, o métodos iterativos que solo calculan las primeras \(k\) componentes.</p>
      <h2>Escala</h2>
      <p>PCA depende de las unidades: una característica medida en milímetros en vez de metros tiene un millón de veces más
      varianza y domina la primera componente. Por eso casi siempre se <strong>estandariza</strong> antes, lo que equivale a
      hacer PCA sobre la matriz de correlación.</p>
      <h2>PCA y clasificación</h2>
      <div class="recuadro"><p>PCA no garantiza conservar lo que separa las clases. Si la diferencia entre clases está en una
      dirección de poca varianza, las primeras componentes la descartan. Para clasificar, el
      <a href="tema.html?id=fisher">discriminante de Fisher</a> (LDA) busca en cambio las direcciones de mayor separación. En
      reconocimiento de rostros se usan las dos en secuencia: <em>eigenfaces</em> (PCA) para bajar de miles de píxeles a cientos de
      dimensiones y <em>fisherfaces</em> (LDA) sobre ese resultado.</p></div>`,
  });
})();
