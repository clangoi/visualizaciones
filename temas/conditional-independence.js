(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: comparar la conjunta con el producto de marginales ---------- */

  function montarProducto(cuerpo) {
    let dep = 0.5, n = 400, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dependencia real', min: 0, max: 1, paso: 0.05, valor: dep, formato: (v) => v.toFixed(2), alCambiar: (v) => { dep = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Muestra n', min: 20, max: 5000, paso: 20, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.boton('Nueva muestra', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.05) : Math.min(320, Math.round(w * 0.32))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.9)), texto: 'probabilidad alta' },
      { color: C.s2, texto: 'P̂(x, y) mayor que P̂(x)P̂(y)' },
      { color: C.s1, texto: 'P̂(x, y) menor que P̂(x)P̂(y)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos variables con 4 valores cada una, muestreadas n veces. Primero, la conjunta estimada; luego, lo que sería si fueran independientes; al final, la diferencia. Con dependencia 0, la diferencia es puro ruido de muestreo y se achica al subir n.');
    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const K = 4, rnd = VIZ.semilla(semilla * 7 + n);
      const cuenta = Array.from({ length: K }, () => new Array(K).fill(0));
      for (let t = 0; t < n; t++) {
        const x = Math.floor(rnd() * K), y = rnd() < dep ? (x + (rnd() < 0.7 ? 0 : 1)) % K : Math.floor(rnd() * K);
        cuenta[x][y]++;
      }
      const P = cuenta.map((f) => f.map((v) => v / n)), px = P.map((f) => M.suma(f)), py = [0, 1, 2, 3].map((j) => M.suma(P.map((f) => f[j])));
      const Q = px.map((a) => py.map((b) => a * b));
      const vertical = W < 620, paneles = 3, w = vertical ? W : W / paneles, h = vertical ? H / 3 : H;
      const lado = Math.min(w - 40, h - 28) / K;
      celdas = [];
      [['P̂(x, y)', P], ['P̂(x) · P̂(y)', Q], ['diferencia', P.map((f, i) => f.map((v, j) => v - Q[i][j]))]].forEach(([titulo, T], p) => {
        const x0 = (vertical ? 0 : p * w) + (w - K * lado) / 2, y0 = (vertical ? p * h : 0) + 22;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(titulo, x0 + (K * lado) / 2, y0 - 4);
        for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
          const v = T[i][j];
          ctx.fillStyle = p < 2 ? VIZ.css(VIZ.enRampa(v / 0.2)) : VIZ.alfa(v > 0 ? C.s2 : C.s1, Math.min(1, Math.abs(v) / 0.08));
          ctx.fillRect(x0 + j * lado + 1, y0 + i * lado + 1, lado - 2, lado - 2);
          celdas.push({ x0: x0 + j * lado, y0: y0 + i * lado, lado, i, j, p: P[i][j], q: Q[i][j] });
        }
      });
      const MI = M.suma(P.flatMap((f, i) => f.map((v, j) => (v > 0 ? v * Math.log2(v / Q[i][j]) : 0))));
      const chi2 = 2 * n * Math.log(2) * MI;
      lectura.set([
        ['información mutua estimada', `${VIZ.fmt(MI, 3)} bits`],
        ['estadístico G = 2n·I (ln)', VIZ.fmt(chi2, 3)],
        ['valor crítico χ²₉ al 5 %', '16.9'],
        ['¿se rechaza la independencia?', chi2 > 16.92 ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celdas.find((q) => x >= q.x0 && x < q.x0 + q.lado && y >= q.y0 && y < q.y0 + q.lado);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `x = ${c.i + 1}, y = ${c.j + 1}<br>P̂(x, y) = <b>${VIZ.fmt(c.p, 3)}</b><br>P̂(x)P̂(y) = <b>${VIZ.fmt(c.q, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: condicionar puede borrar o crear dependencia ---------- */

  function montarCondicionar(cuerpo) {
    let estructura = 'comun', condicionar = false, semilla = 1, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cómo se generan X, Y, Z', opciones: [['comun', 'Z causa común: X ← Z → Y'], ['efecto', 'Z efecto común: X → Z ← Y']], valor: estructura, alCambiar: (v) => { estructura = v; generar(); } });
    ctl.casilla({ etiqueta: 'condicionar en Z (mirar dentro de cada estrato)', valor: condicionar, alCambiar: (v) => { condicionar = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...['Z bajo', 'Z medio', 'Z alto'].map((t, g) => ({ color: VIZ.series[g], texto: t, forma: g ? 'cuadro' : 'punto' })),
      { color: C.tinta, texto: 'recta de regresión de todos', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con causa común, X e Y están correlacionadas pero dentro de cada estrato de Z la correlación desaparece: X ⫫ Y | Z. Con efecto común ocurre lo contrario: X e Y son independientes, pero dentro de un estrato de Z aparece una correlación negativa.');
    function generar() {
      const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
      D = Array.from({ length: 450 }, () => {
        let x, y, z;
        if (estructura === 'comun') { z = N(); x = 0.9 * z + 0.45 * N(); y = 0.9 * z + 0.45 * N(); }
        else { x = N(); y = N(); z = x + y + 0.4 * N(); }
        return { x, y, z };
      });
      const zs = D.map((d) => d.z), c1 = M.cuantil(zs, 1 / 3), c2 = M.cuantil(zs, 2 / 3);
      D.forEach((d) => { d.g = d.z < c1 ? 0 : d.z < c2 ? 1 : 2; });
      dibujar();
    }
    let pl = null;
    const recta = (pts) => { const mx = M.media(pts.map((p) => p.x)), my = M.media(pts.map((p) => p.y)); const b = M.suma(pts.map((p) => (p.x - mx) * (p.y - my))) / M.suma(pts.map((p) => (p.x - mx) ** 2)); return [mx, my, b]; };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const a = Math.max(1, lienzo.ancho / lienzo.alto * 0.95);
      pl = VIZ.plano(lienzo, { xmin: -3.2 * a, xmax: 3.2 * a, ymin: -3.2, ymax: 3.2 }, { etiquetaX: 'X', etiquetaY: 'Y', margen: { izq: 40 } });
      pl.ejes();
      M.dispersion(ctx, pl, D, { color: (d) => (condicionar ? VIZ.series[d.g] : C.tinta2), forma: (d) => (condicionar ? d.g : 0), r: 2.8 });
      ctx.save(); pl.recortar();
      const [mx, my, b] = recta(D);
      VIZ.trazar(ctx, pl, [[mx - 6, my - 6 * b], [mx + 6, my + 6 * b]], C.tinta, 2, condicionar ? [5, 4] : null);
      if (condicionar) [0, 1, 2].forEach((g) => { const [gx, gy, gb] = recta(D.filter((d) => d.g === g)); VIZ.trazar(ctx, pl, [[gx - 2.5, gy - 2.5 * gb], [gx + 2.5, gy + 2.5 * gb]], VIZ.series[g], 2.5); });
      ctx.restore();
      const r = (pts) => M.correlacion(pts.map((p) => p.x), pts.map((p) => p.y));
      lectura.set([
        ['correlación de X e Y (todos)', VIZ.fmt(r(D), 2)],
        ['dentro de Z bajo · medio · alto', [0, 1, 2].map((g) => VIZ.fmt(r(D.filter((d) => d.g === g)), 2)).join(' · ')],
        ['¿X ⫫ Y?', estructura === 'comun' ? 'no' : 'sí'],
        ['¿X ⫫ Y | Z?', estructura === 'comun' ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 8;
      if (pl) D.forEach((d, i) => { const q = Math.hypot(pl.sx(d.x) - x, pl.sy(d.y) - y); if (q < dm) { dm = q; m = i; } });
      if (m < 0) return tip.ocultar();
      tip.mostrar(x, y, `X = <b>${VIZ.fmt(D[m].x, 2)}</b>, Y = <b>${VIZ.fmt(D[m].y, 2)}</b><br>Z = <b>${VIZ.fmt(D[m].z, 2)}</b> (${['bajo', 'medio', 'alto'][D[m].g]})`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('conditional-independence', {
    intro: String.raw`
      <p>Dos variables son <strong>independientes</strong> si conocer una no cambia la distribución de la otra. Son
      <strong>condicionalmente independientes dado Z</strong> si, una vez que se conoce \(Z\), conocer una ya no aporta nada sobre la otra.</p>
      <p>Las dos nociones no se implican mutuamente: condicionar puede hacer desaparecer una dependencia (cuando \(Z\) es causa común)
      o hacerla aparecer donde no había (cuando \(Z\) es efecto común). Esa asimetría es la base de las
      <a href="tema.html?id=bayesian-networks">redes bayesianas</a> y del razonamiento <a href="tema.html?id=causal-structures">causal</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Conjunta frente a producto de marginales',
        descripcion: 'Independencia significa que la tabla conjunta es el producto de sus marginales. Mire la diferencia con dependencia 0 y n chico: los datos nunca son exactamente independientes.',
        montar: montarProducto,
      },
      {
        titulo: 'Condicionar puede borrar o crear dependencia',
        descripcion: 'X e Y generadas con Z como causa común o como efecto común. Active «condicionar en Z» y compare las correlaciones.',
        montar: montarCondicionar,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      \[ X \perp\!\!\!\perp Y \iff P(X, Y) = P(X)\,P(Y), \qquad
         X \perp\!\!\!\perp Y \mid Z \iff P(X, Y \mid Z) = P(X \mid Z)\,P(Y \mid Z) \]
      <p>para todos los valores (con \(P(Z) &gt; 0\)). Equivalentemente, \(P(X \mid Y, Z) = P(X \mid Z)\): dado \(Z\), \(Y\) no informa sobre \(X\).</p>
      <h2>Tres patrones</h2>
      <table>
        <tr><th>Estructura</th><th>\(X \perp\!\!\!\perp Y\)</th><th>\(X \perp\!\!\!\perp Y \mid Z\)</th></tr>
        <tr><td>Causa común \(X \leftarrow Z \to Y\)</td><td>no</td><td>sí</td></tr>
        <tr><td>Cadena \(X \to Z \to Y\)</td><td>no</td><td>sí</td></tr>
        <tr><td>Efecto común \(X \to Z \leftarrow Y\)</td><td>sí</td><td>no</td></tr>
      </table>
      <p>El último caso es el <strong>sesgo de selección</strong> o efecto de «explicar» (<em>explaining away</em>): si \(Z\) = «admitido» depende de
      talento \(X\) y de esfuerzo \(Y\), entre los admitidos quien tiene poco talento tuvo que esforzarse mucho, y aparece una correlación negativa.</p>
      <h2>Por qué importa</h2>
      <ul>
        <li>Permite <strong>factorizar</strong> distribuciones conjuntas: si \(X \perp\!\!\!\perp Y \mid Z\), entonces \(P(X, Y, Z) = P(Z)P(X \mid Z)P(Y \mid Z)\),
        con muchos menos parámetros. Naive Bayes supone que todas las características son independientes dada la clase.</li>
        <li>Las independencias condicionales que se observan en los datos restringen qué <a href="tema.html?id=d-separation">grafos causales</a> son posibles.</li>
      </ul>
      <h2>Probarla con datos</h2>
      <p>Para variables discretas se usa la prueba \(\chi^2\) o el estadístico \(G = 2n\,\hat I(X; Y)\) (con logaritmo natural), que bajo independencia sigue
      aproximadamente una \(\chi^2\) con \((|X| - 1)(|Y| - 1)\) grados de libertad. Para la condicional, se suma sobre los estratos de \(Z\). Para variables
      gaussianas, \(X \perp\!\!\!\perp Y \mid Z\) equivale a correlación parcial cero. Con pocos datos por estrato, estas pruebas pierden potencia.</p>`,
  });
})();