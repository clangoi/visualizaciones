(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  let RED = null;
  function cnn() {
    if (RED) return RED;
    RED = DL.cnnPequena(1); const r = VIZ.semilla(3);
    for (let e = 0; e < 50; e++) for (let b = 0; b < 10; b++) RED.paso(Array.from({ length: 12 }, (_, k) => { const c = (b * 12 + k) % 6; return { img: DL.muestraImagen(c, r), c }; }), 0.03);
    return RED;
  }
  const NOM = DL.NOMBRES_IMAGEN.map((q) => q[1]);

  /* ---------- Fig. 1: ¿qué píxeles pesan en la decisión? ---------- */

  function montarSaliencia(cuerpo) {
    let img = 'cuadro', parche = 3, geo = null, R = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: DL.NOMBRES_IMAGEN, valor: img, alCambiar: (v) => { img = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño del parche que se tapa', min: 1, max: 5, valor: parche, formato: (v) => `${v}×${v}`, alCambiar: (v) => { parche = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 330 : 560) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'importante para la clase predicha', forma: 'cuadro' }, { color: C.s2, texto: 'en contra de la clase predicha', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se usa la CNN de 364 parámetros entrenada para reconocer las seis figuras. Oclusión: se tapa un parche y se mide cuánto baja la probabilidad de la clase predicha. Gradiente: cuánto cambia esa probabilidad al cambiar levemente cada píxel. Ambos mapas indican dónde «mira» la red; ninguno prueba por qué decide lo que decide.');
    function dibujar() {
      const red = cnn(), I = DL.IMAGENES[img], f0 = red.adelante(I), k = f0.p.indexOf(Math.max(...f0.p)), p0 = f0.p[k];
      const oc = Array.from({ length: 12 }, () => new Array(12).fill(0)), cnt = Array.from({ length: 12 }, () => new Array(12).fill(0));
      for (let i = 0; i + parche <= 12; i++) for (let j = 0; j + parche <= 12; j++) { const J = I.map((f) => f.slice()); for (let a = 0; a < parche; a++) for (let b = 0; b < parche; b++) J[i + a][j + b] = 0; const d = p0 - red.adelante(J).p[k]; for (let a = 0; a < parche; a++) for (let b = 0; b < parche; b++) { oc[i + a][j + b] += d; cnt[i + a][j + b]++; } }
      const mo = oc.map((f, i) => f.map((v, j) => v / (cnt[i][j] || 1)));
      const gr = I.map((f, i) => f.map((v, j) => { const J = I.map((q) => q.slice()); J[i][j] += 0.1; return (red.adelante(J).p[k] - p0) / 0.1; }));
      const { ctx, ancho: W } = lienzo, ancha = W > 640, c = ancha ? Math.min(22, (W - 60) / 38) : Math.min(24, (W - 30) / 12);
      lienzo.limpiar(); geo = [];
      const panel = (mat, x, y, tit, div, esc) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(tit, x, y - 4); DL.mapa(ctx, mat, x, y, 12 * c, 12 * c, div ? { divergente: true, min: -esc, max: esc } : { min: 0, max: 1, gris: true }); geo.push({ x, y, c, mat, tit }); };
      const e1 = Math.max(0.01, ...mo.flat().map(Math.abs)), e2 = Math.max(0.01, ...gr.flat().map(Math.abs)), y0 = 26;
      const pos = ancha ? [10, 10 + 13 * c, 10 + 26 * c] : [10, 10 + 13 * c, 10];
      panel(I, pos[0], y0, 'imagen', false); panel(mo, pos[1], y0, 'oclusión (caída de probabilidad)', true, e1);
      panel(gr, pos[2], ancha ? y0 : y0 + 13 * c + 20, 'gradiente respecto de cada píxel', true, e2);
      // Probabilidades.
      const bx = ancha ? 10 : 10 + 13 * c, by = ancha ? y0 + 13 * c + 18 : y0 + 13 * c + 20, bw = Math.max(80, W - bx - 150);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('probabilidad de cada clase', bx, by - 2);
      f0.p.forEach((p, q) => { const y = by + q * 17; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(NOM[q], bx + 62, y + 7); ctx.fillStyle = q === k ? C.s6 : C.s1; ctx.fillRect(bx + 68, y, Math.max(2, p * bw), 13); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(`${VIZ.fmt(100 * p, 3)} %`, bx + 72 + p * bw, y + 7); });
      const topOc = mo.flat().indexOf(Math.max(...mo.flat()));
      registro.textContent = `La red dice «${NOM[k]}» con ${VIZ.fmt(100 * p0, 3)} %. Lo que más la afecta al taparlo está en la fila ${Math.floor(topOc / 12) + 1}, columna ${(topOc % 12) + 1}: tapar ahí baja la probabilidad ${VIZ.fmt(100 * Math.max(...mo.flat()), 3)} puntos.`;
      lectura.set([['clase predicha', NOM[k]], ['confianza', `${VIZ.fmt(100 * p0, 3)} %`], ['mayor caída por oclusión', `${VIZ.fmt(100 * Math.max(...mo.flat()), 3)} puntos`], ['píxeles que importan (> 25 % del máximo)', `${mo.flat().filter((v) => v > 0.25 * e1).length} de 144`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x < q.x + 12 * q.c && y >= q.y && y < q.y + 12 * q.c); if (!g) return tip.ocultar(); const j = Math.floor((x - g.x) / g.c), i = Math.floor((y - g.y) / g.c); tip.mostrar(x, y, `${g.tit}<br>(${i + 1}, ${j + 1}): <b>${VIZ.fmt(g.mat[i][j], 3)}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: explicar un modelo sobre datos tabulares ---------- */

  const NOMBRES = ['ingreso', 'deuda', 'antigüedad', 'dato irrelevante'];
  function modeloCredito(semilla) {
    const r = VIZ.semilla(semilla * 7 + 1), X = [], Y = [];
    for (let i = 0; i < 600; i++) { const x = [VIZ.normal(r), VIZ.normal(r), VIZ.normal(r), VIZ.normal(r)], z = 1.6 * x[0] - 1.2 * x[1] + 0.4 * x[2] + 0.3 * VIZ.normal(r); X.push(x); Y.push(z > 0 ? 1 : 0); }
    let w = [0, 0, 0, 0], b = 0; const sg = (z) => 1 / (1 + Math.exp(-z));
    for (let it = 0; it < 400; it++) { const g = [0, 0, 0, 0]; let gb = 0; X.forEach((x, i) => { const e = sg(x.reduce((s, v, k) => s + v * w[k], b)) - Y[i]; x.forEach((v, k) => { g[k] += e * v / X.length; }); gb += e / X.length; }); w = w.map((v, k) => v - 0.8 * g[k]); b -= 0.8 * gb; }
    const p = (x) => sg(x.reduce((s, v, k) => s + v * w[k], b)), acc = (XX, YY) => XX.filter((x, i) => (p(x) > 0.5 ? 1 : 0) === YY[i]).length / XX.length;
    const imp = NOMBRES.map((_, k) => { const a0 = acc(X, Y), rr = VIZ.semilla(5), perm = X.map((x) => x.slice()); const col = perm.map((x) => x[k]); for (let i = col.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [col[i], col[j]] = [col[j], col[i]]; } perm.forEach((x, i) => { x[k] = col[i]; }); return a0 - acc(perm, Y); });
    return { w, b, p, X, Y, imp, acc: acc(X, Y) };
  }

  function montarTabular(cuerpo) {
    let semilla = 1, sel = 0, M = modeloCredito(1), geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Solicitante', min: 1, max: 20, valor: sel + 1, alCambiar: (v) => { sel = v - 1; dibujar(); } });
    ctl.boton('Otros datos', () => { semilla++; M = modeloCredito(semilla); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 320 : 480) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'empuja hacia «aprobar»', forma: 'cuadro' }, { color: C.s8, texto: 'empuja hacia «rechazar»', forma: 'cuadro' }, { color: C.s1, texto: 'importancia global: caída de exactitud al barajar la columna', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una regresión logística sobre cuatro variables estandarizadas (la cuarta es ruido). Izquierda, explicación local: cuánto aporta cada variable de este solicitante a la decisión, w·x. Derecha, explicación global: cuánto se pierde si se baraja una columna. En modelos lineales ambas son exactas; en redes profundas hay que usar aproximaciones (SHAP, LIME, gradientes integrados).');
    function dibujar() {
      const x = M.X[sel], contrib = x.map((v, k) => v * M.w[k]), z = contrib.reduce((s, v) => s + v, M.b), { ctx, ancho: W } = lienzo, ancha = W > 640, bw = ancha ? W * 0.5 - 60 : W - 70;
      lienzo.limpiar(); geo = [];
      const mx = Math.max(...contrib.map(Math.abs), 1), x0 = 100 + bw / 2;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`Solicitante ${sel + 1}: aporte de cada variable al puntaje`, 8, 6);
      contrib.forEach((v, k) => { const y = 34 + k * 40, w = (Math.abs(v) / mx) * (bw / 2 - 6); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(NOMBRES[k], 94, y + 12); ctx.fillStyle = v >= 0 ? C.s6 : C.s8; ctx.fillRect(v >= 0 ? x0 : x0 - w, y, Math.max(2, w), 24); ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = v >= 0 ? 'left' : 'right'; ctx.fillText(`${VIZ.fmt(v, 2)} (valor ${VIZ.fmt(x[k], 2)})`, v >= 0 ? x0 + w + 4 : x0 - w - 4, y + 12); geo.push({ y, h: 24, t: `${NOMBRES[k]}: valor estandarizado ${VIZ.fmt(x[k], 3)}, peso ${VIZ.fmt(M.w[k], 3)}, aporte ${VIZ.fmt(v, 3)}` }); });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, 28); ctx.lineTo(x0, 34 + 4 * 40); ctx.stroke();
      const xi = ancha ? W * 0.5 + 40 : 8, yi = ancha ? 6 : 34 + 4 * 40 + 16, bi = ancha ? W * 0.5 - 150 : W - 150, mi = Math.max(...M.imp, 0.01);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Importancia global (permutación)', xi, yi);
      M.imp.forEach((v, k) => { const y = yi + 28 + k * 30, w = Math.max(2, (Math.max(0, v) / mi) * bi); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(NOMBRES[k], xi + 100, y + 10); ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(xi + 106, y, w, 20, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(`${VIZ.fmt(100 * v, 2)} puntos`, xi + 110 + w, y + 10); });
      const p = 1 / (1 + Math.exp(-z));
      registro.textContent = `Puntaje ${VIZ.fmt(z, 2)} → probabilidad de aprobar ${VIZ.fmt(100 * p, 3)} % (${p > 0.5 ? 'aprobado' : 'rechazado'}). La variable más influyente en este caso: ${NOMBRES[contrib.map(Math.abs).indexOf(Math.max(...contrib.map(Math.abs)))]}.`;
      lectura.set([['decisión', p > 0.5 ? 'aprobar' : 'rechazar'], ['probabilidad de aprobar', `${VIZ.fmt(100 * p, 3)} %`], ['exactitud del modelo', `${VIZ.fmt(100 * M.acc, 3)} %`], ['importancia del dato irrelevante', `${VIZ.fmt(100 * M.imp[3], 2)} puntos`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo && geo.find((q) => y >= q.y && y <= q.y + q.h && x < lienzo.ancho * (lienzo.ancho > 640 ? 0.5 : 1)); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('interpretability', {
    intro: String.raw`
      <p>Una red entrega una respuesta, pero no una razón. Cuando decide sobre un crédito, un diagnóstico o una condena, quien la usa necesita poder entender —y quien resulta afectado, poder discutir— por qué se decidió así. La <strong>interpretabilidad</strong> busca modelos que se entiendan por construcción; la <strong>explicabilidad</strong>, métodos que explican a posteriori modelos complejos.</p>
      <p>Hay dos preguntas distintas: <em>global</em> («¿qué variables usa el modelo en general?») y <em>local</em> («¿por qué decidió esto para este caso?»). Y una advertencia: una explicación bonita no es lo mismo que una explicación fiel.</p>`,
    visualizaciones: [
      { titulo: 'Dónde mira una CNN', descripcion: 'Compare los mapas de oclusión y de gradiente para cada figura. Cambie el tamaño del parche y vea cómo cambia el mapa.', montar: montarSaliencia },
      { titulo: 'Explicar un modelo de crédito', descripcion: 'Elija solicitantes y mire cuánto aporta cada variable a su decisión; compare con la importancia global. El dato irrelevante debe pesar casi nada.', montar: montarTabular },
    ],
    teoria: String.raw`
      <h2>Familias de métodos</h2>
      <table>
        <tr><th>Tipo</th><th>Ejemplos</th><th>Qué entrega</th></tr>
        <tr><td>Modelos interpretables</td><td>regresión lineal / logística, árboles pequeños, reglas</td><td>La propia estructura es la explicación</td></tr>
        <tr><td>Importancia global</td><td>importancia por permutación, importancia de árboles</td><td>Qué variables importan en general</td></tr>
        <tr><td>Atribución local</td><td>gradientes, oclusión, Grad-CAM, LIME, SHAP</td><td>Cuánto contribuye cada entrada a una predicción</td></tr>
        <tr><td>Ejemplos</td><td>vecinos más cercanos, contrafactuales</td><td>«Si el ingreso fuera X, el resultado sería otro»</td></tr>
      </table>
      <h2>Fórmulas</h2>
      <p><strong>Gradiente (saliencia):</strong> \(S_i=\big|\partial f_k(x)/\partial x_i\big|\). <strong>Oclusión:</strong> \(S_R=f_k(x)-f_k(x_{R\leftarrow0})\) para una región \(R\). <strong>Importancia por permutación:</strong> la caída de rendimiento al barajar la columna \(j\) en un conjunto de validación. <strong>Valores de Shapley:</strong></p>
      \[ \phi_j=\sum_{S\subseteq F\setminus\{j\}}\frac{|S|!\,(|F|-|S|-1)!}{|F|!}\big[f(S\cup\{j\})-f(S)\big], \]
      <p>el reparto «justo» de la diferencia \(f(x)-\mathbb{E}f\) entre las variables. En un modelo lineal se reduce a \(w_j\,(x_j-\mathbb{E}x_j)\).</p>
      <div class="recuadro"><p><strong>Cautelas.</strong> Muchos mapas de saliencia se ven razonables incluso con pesos aleatorios (Adebayo et al., 2018); correlación no es causalidad; y una variable «poco importante» puede ser un sustituto de otra sensible (<a href="tema.html?id=algorithmic-fairness">Algorithmic Fairness</a>). Si la decisión es de alto riesgo, es preferible un modelo interpretable por construcción a una explicación aproximada de una caja negra.</p></div>
      <p>Los mapas de activación de las capas internas se ven en <a href="tema.html?id=activation-maps">Activation Maps</a>.</p>`,
  });
})();
