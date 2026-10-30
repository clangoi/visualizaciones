(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  const NOM = DL.NOMBRES_IMAGEN.map((q) => q[1]);

  /* ---------- Fig. 1: un empujón mínimo cruza la frontera ---------- */

  let R2 = null;
  function red2() {
    if (R2) return R2;
    const pts = ML.datos('lunas', 160, 0.12, 5), r = DL.red([2, 24, 24, 1], { act: 'tanh', semilla: 3 }), o = DL.optimizador('adam', { lr: 0.03 }), rnd = VIZ.semilla(2);
    for (let e = 0; e < 300; e++) { const L = DL.mezclar(DL.pares(pts), rnd); for (let i = 0; i < L.length; i += 16) DL.entrenarPaso(r, L.slice(i, i + 16), o); }
    R2 = { r, pts, test: ML.datos('lunas', 200, 0.12, 77) }; return R2;
  }
  const prob = (r, x, y) => DL.predecir(r, [x, y])[0];
  // Perturbación FGSM de un punto: ε · signo del gradiente de la pérdida respecto de la entrada (por diferencias finitas).
  function fgsm(r, x, y, c, eps) {
    const h = 1e-4, l = (a, b) => { const p = prob(r, a, b); return -(c ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12)); };
    const gx = (l(x + h, y) - l(x - h, y)) / (2 * h), gy = (l(x, y + h) - l(x, y - h)) / (2 * h);
    return [x + eps * Math.sign(gx), y + eps * Math.sign(gy)];
  }

  function montarPlano(cuerpo) {
    let eps = 0.15, sel = null, pl = null;
    const { r, pts, test } = red2();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño máximo de la perturbación ε (por coordenada)', min: 0, max: 0.6, paso: 0.01, valor: eps, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eps = v; dibujar(); } });
    ctl.boton('Elegir otro punto', () => { sel = test[Math.floor(Math.random() * test.length)]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2), { color: C.tinta, texto: 'frontera de la red', forma: 'linea' }, { color: C.s8, texto: 'punto atacado (flecha: perturbación)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un punto de prueba bien clasificado: se le suma ε·signo(∇ de la pérdida), el método FGSM. La perturbación es pequeña, pero está orientada contra el gradiente y puede cruzar la frontera. La lectura muestra la exactitud sobre 200 puntos de prueba con ese ε.');
    sel = test.find((q) => (prob(r, q.x, q.y) > 0.5 ? 1 : 0) === q.c) || test[0];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = ML.plano(lienzo); pl.ejes();
      ctx.save(); pl.recortar(); ML.regiones(ctx, pl, (x, y) => prob(r, x, y), { paso: 7 }); ML.contorno(ctx, pl, (x, y) => prob(r, x, y), 0.5, { color: C.tinta, ancho: 2 }); ctx.restore();
      ML.puntos(ctx, pl, test, { r: 3.5 });
      const adv = fgsm(r, sel.x, sel.y, sel.c, eps), p0 = prob(r, sel.x, sel.y), p1 = prob(r, adv[0], adv[1]);
      ctx.strokeStyle = C.s8; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pl.sx(sel.x), pl.sy(sel.y)); ctx.lineTo(pl.sx(adv[0]), pl.sy(adv[1])); ctx.stroke();
      ctx.strokeStyle = C.s8; ctx.setLineDash([3, 3]); ctx.strokeRect(pl.sx(sel.x - eps), pl.sy(sel.y + eps), pl.sx(sel.x + eps) - pl.sx(sel.x - eps), pl.sy(sel.y - eps) - pl.sy(sel.y + eps)); ctx.setLineDash([]);
      VIZ.marcador(ctx, pl.sx(sel.x), pl.sy(sel.y), C.s8, 6, sel.c); VIZ.marcador(ctx, pl.sx(adv[0]), pl.sy(adv[1]), C.tinta, 5, 6);
      const acc = test.filter((q) => { const a = fgsm(r, q.x, q.y, q.c, eps); return (prob(r, a[0], a[1]) > 0.5 ? 1 : 0) === q.c; }).length / test.length;
      const flip = (p1 > 0.5 ? 1 : 0) !== sel.c;
      registro.textContent = `El punto es de la clase ${sel.c}; la red le da ${VIZ.fmt(100 * (sel.c ? p0 : 1 - p0), 3)} % de la clase correcta. Tras mover cada coordenada ${VIZ.fmt(eps, 2)} como máximo, le da ${VIZ.fmt(100 * (sel.c ? p1 : 1 - p1), 3)} %${flip ? ': ahora se equivoca.' : '.'}`;
      const acc0 = test.filter((q) => (prob(r, q.x, q.y) > 0.5 ? 1 : 0) === q.c).length / test.length;
      lectura.set([['ε', VIZ.fmt(eps, 2)], ['confianza correcta antes', `${VIZ.fmt(100 * (sel.c ? p0 : 1 - p0), 3)} %`], ['después del ataque', `${VIZ.fmt(100 * (sel.c ? p1 : 1 - p1), 3)} %`], ['exactitud limpia', `${VIZ.fmt(100 * acc0, 3)} %`], ['exactitud bajo ataque (ε)', `${VIZ.fmt(100 * acc, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), j = ML.cercano(pl, test, x, y, 14); if (j >= 0) { sel = test[j]; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) return tip.ocultar(); tip.mostrar(x, y, `(${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})<br>P(clase 1) = <b>${VIZ.fmt(prob(r, pl.ix(x), pl.iy(y)), 3)}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el mismo ataque sobre una imagen ---------- */

  let RC = null;
  function cnn() { if (RC) return RC; RC = DL.cnnPequena(1); const r = VIZ.semilla(3); for (let e = 0; e < 50; e++) for (let b = 0; b < 10; b++) RC.paso(Array.from({ length: 12 }, (_, k) => { const c = (b * 12 + k) % 6; return { img: DL.muestraImagen(c, r), c }; }), 0.03); return RC; }
  function ataque(red, img, c, eps) {
    const perd = (I) => -Math.log(red.adelante(I).p[c] + 1e-12), l0 = perd(img);
    const g = img.map((f, i) => f.map((_, j) => { const J = img.map((q) => q.slice()); J[i][j] += 0.02; return (perd(J) - l0) / 0.02; }));
    return { adv: img.map((f, i) => f.map((v, j) => v + eps * Math.sign(g[i][j]))), g };
  }

  function montarImagen(cuerpo) {
    let img = 'cuadro', eps = 0.3, curva = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: DL.NOMBRES_IMAGEN, valor: img, alCambiar: (v) => { img = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Perturbación máxima por píxel ε', min: 0, max: 1, paso: 0.02, valor: eps, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { eps = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 380 : 600) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'más intensidad / perturbación positiva', forma: 'cuadro' }, { color: C.s2, texto: 'perturbación negativa', forma: 'cuadro' }, { color: C.s6, texto: 'exactitud de la red bajo ataque (60 imágenes)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'FGSM sobre la CNN de 364 parámetros: a cada píxel se le suma ±ε según el signo del gradiente de la pérdida (calculado por diferencias finitas). Con ε = 0,3 la imagen sigue siendo reconocible para una persona, pero la red ya puede cambiar de opinión. A la derecha, cómo cae su exactitud al crecer ε.');
    function calcularCurva() { const red = cnn(), r = VIZ.semilla(404), E = Array.from({ length: 60 }, (_, k) => ({ img: DL.muestraImagen(k % 6, r, 0.05), c: k % 6 })), epss = Array.from({ length: 11 }, (_, i) => i * 0.1); curva = epss.map((e) => ({ e, a: E.filter(({ img: I, c }) => { const f = ataque(red, I, c, e).adv, p = red.adelante(f).p; return p.indexOf(Math.max(...p)) === c; }).length / E.length })); }
    function dibujar() {
      const red = cnn(); if (!curva) calcularCurva();
      const I = DL.IMAGENES[img], c = DL.NOMBRES_IMAGEN.findIndex((q) => q[0] === img), { adv, g } = ataque(red, I, c, eps), f0 = red.adelante(I), f1 = red.adelante(adv), k0 = f0.p.indexOf(Math.max(...f0.p)), k1 = f1.p.indexOf(Math.max(...f1.p));
      const { ctx, ancho: W } = lienzo, ancha = W > 700, cs = ancha ? Math.min(18, (W - 60) / 56) : Math.min(22, (W - 30) / 12);
      lienzo.limpiar(); geo = [];
      const pn = (mat, x, y, tit, div) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(tit, x, y - 4); DL.mapa(ctx, mat, x, y, 12 * cs, 12 * cs, div ? { divergente: true, min: -1, max: 1 } : { min: -0.3, max: 1.3, gris: true }); geo.push({ x, y, cs, mat, tit }); };
      const y0 = 26, xs = ancha ? [10, 10 + 13 * cs, 10 + 26 * cs] : [10, 10 + 13 * cs, 10];
      pn(I, xs[0], y0, `original: «${NOM[k0]}» ${VIZ.fmt(100 * f0.p[k0], 3)} %`); pn(adv.map((f, i) => f.map((v, j) => v - I[i][j])), xs[1], y0, `perturbación (±${VIZ.fmt(eps, 2)})`, true);
      pn(adv, xs[2], ancha ? y0 : y0 + 13 * cs + 24, `atacada: «${NOM[k1]}» ${VIZ.fmt(100 * f1.p[k1], 3)} %`);
      const xg = ancha ? 10 + 39 * cs + 20 : 10, yg = ancha ? y0 : y0 + 26 * cs + 60, wg = ancha ? W - xg - 12 : W - 20, hg = ancha ? 12 * cs : 150;
      const pl = VIZ.plano({ ancho: W, alto: yg + hg + 40, ctx }, { xmin: 0, xmax: 1, ymin: 0, ymax: 1.02 }, { etiquetaX: 'ε', etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %`, margen: { izq: xg + 36, der: W - xg - wg, sup: yg, inf: 34 } });
      pl.ejes(); VIZ.trazar(ctx, pl, curva.map((q) => [q.e, q.a]), C.s6, 2.5); VIZ.marcador(ctx, pl.sx(eps), pl.sy((curva.reduce((m, q) => (Math.abs(q.e - eps) < Math.abs(m.e - eps) ? q : m)).a)), C.s2, 5);
      registro.textContent = k1 !== k0 ? `Con ε = ${VIZ.fmt(eps, 2)} la red cambia de «${NOM[k0]}» a «${NOM[k1]}» (confianza ${VIZ.fmt(100 * f1.p[k1], 3)} %), aunque cada píxel cambió a lo más ${VIZ.fmt(eps, 2)}.` : `Con ε = ${VIZ.fmt(eps, 2)} la red sigue diciendo «${NOM[k0]}» (${VIZ.fmt(100 * f1.p[k0], 3)} %, antes ${VIZ.fmt(100 * f0.p[k0], 3)} %).`;
      lectura.set([['ε', VIZ.fmt(eps, 2)], ['predicción original', NOM[k0]], ['predicción atacada', NOM[k1]], ['exactitud bajo ataque con este ε (60 imágenes)', `${VIZ.fmt(100 * curva.reduce((m, q) => (Math.abs(q.e - eps) < Math.abs(m.e - eps) ? q : m)).a, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), q = geo && geo.find((p) => x >= p.x && x < p.x + 12 * p.cs && y >= p.y && y < p.y + 12 * p.cs); if (!q) return tip.ocultar(); const j = Math.floor((x - q.x) / q.cs), i = Math.floor((y - q.y) / q.cs); tip.mostrar(x, y, `${q.tit}<br>(${i + 1}, ${j + 1}): <b>${VIZ.fmt(q.mat[i][j], 3)}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('adversarial-robustness', {
    intro: String.raw`
      <p>Una red que acierta el 99 % de las imágenes de prueba puede equivocarse con total seguridad ante una imagen casi idéntica, modificada de forma imperceptible. Un <strong>ejemplo adversarial</strong> es una entrada con una perturbación pequeña, elegida a propósito para engañar al modelo: la perturbación no es ruido al azar, sino que va en la dirección en que más sube la pérdida.</p>
      <p>Esto importa en la práctica: un letrero de «pare» con unas pegatinas, un archivo de malware con unos bytes extra o un texto con una palabra cambiada pueden saltarse un clasificador. La <strong>robustez</strong> es una propiedad distinta de la exactitud, y mide cuánto aguanta el modelo ante perturbaciones deliberadas y ante cambios naturales de los datos.</p>`,
    visualizaciones: [
      { titulo: 'Un empujón que cruza la frontera', descripcion: 'Elija un punto bien clasificado y suba ε hasta que la red cambie de opinión. Compare la exactitud limpia con la exactitud bajo ataque.', montar: montarPlano },
      { titulo: 'El mismo ataque sobre una imagen', descripcion: 'Suba ε y observe la perturbación, la imagen atacada y cuándo la CNN se equivoca; la curva muestra la exactitud sobre 60 imágenes.', montar: montarImagen },
    ],
    teoria: String.raw`
      <h2>El ataque FGSM</h2>
      <p>Con la pérdida \(\mathcal{L}(x,y)\), el <em>Fast Gradient Sign Method</em> (Goodfellow et al., 2015) construye</p>
      \[ x_{\text{adv}}=x+\varepsilon\,\operatorname{sign}\big(\nabla_x\mathcal{L}(f(x),y)\big),\qquad \lVert x_{\text{adv}}-x\rVert_\infty\le\varepsilon. \]
      <p>Con una aproximación lineal, \(\mathcal{L}(x+\delta)\approx\mathcal{L}(x)+\nabla_x\mathcal{L}^\top\delta\), el \(\delta\) con \(\lVert\delta\rVert_\infty\le\varepsilon\) que más sube la pérdida es \(\varepsilon\operatorname{sign}(\nabla_x\mathcal{L})\), y la subida vale \(\varepsilon\lVert\nabla_x\mathcal{L}\rVert_1\): crece con la dimensión, por eso las imágenes (miles de píxeles) son tan vulnerables. PGD repite este paso varias veces con proyección, y es un ataque mucho más fuerte.</p>
      <h2>Defensas</h2>
      <ul>
        <li><strong>Entrenamiento adversarial:</strong> entrenar con ejemplos atacados, \(\min_\theta\mathbb{E}\max_{\lVert\delta\rVert\le\varepsilon}\mathcal{L}(f_\theta(x+\delta),y)\). Es la defensa más fiable, aunque encarece el entrenamiento y reduce algo la exactitud limpia.</li>
        <li><strong>Certificación:</strong> demostrar matemáticamente que ninguna perturbación de tamaño \(\le\varepsilon\) cambia la predicción (suavizado aleatorio, cotas).</li>
        <li><strong>Detección y preprocesamiento:</strong> muchas propuestas son eludidas por ataques que las conocen («ofuscación del gradiente»).</li>
      </ul>
      <div class="recuadro"><p>No basta con atacar a un modelo conocido: los ejemplos adversariales <em>se transfieren</em> entre modelos parecidos, de modo que un atacante sin acceso al modelo puede entrenar uno sustituto. La robustez ante cambios de distribución no adversariales se estudia en <a href="tema.html?id=deployment-risks">Deployment Risks</a>.</p></div>`,
  });
})();
