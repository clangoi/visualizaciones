(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  const DOM = { x0: 18, x1: 70, y0: 0, y1: 4000 };
  function originales() {
    const rnd = VIZ.semilla(21);
    const pts = [];
    for (let i = 0; i < 160; i++) {
      if (rnd() < 0.3) pts.push([18 + rnd() * 8, 250 + Math.abs(VIZ.normal(rnd)) * 250]); // estudiantes
      else { const e = 26 + rnd() * 40; pts.push([e, Math.max(300, 600 + (e - 26) * 55 + VIZ.normal(rnd) * 420)]); }
    }
    return pts;
  }
  const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  function corr(P) {
    const mx = media(P.map((p) => p[0])), my = media(P.map((p) => p[1]));
    const sxy = media(P.map((p) => (p[0] - mx) * (p[1] - my))), sx = Math.sqrt(media(P.map((p) => (p[0] - mx) ** 2))), sy = Math.sqrt(media(P.map((p) => (p[1] - my) ** 2)));
    return sxy / (sx * sy);
  }
  // Distancia normalizada por el rango de cada eje.
  const dist = (a, b) => Math.hypot((a[0] - b[0]) / (DOM.x1 - DOM.x0), (a[1] - b[1]) / (DOM.y1 - DOM.y0));

  function generar(metodo, O, eps, rnd) {
    const n = O.length;
    if (metodo === 'marginales') return O.map(() => [O[Math.floor(rnd() * n)][0], O[Math.floor(rnd() * n)][1]]);
    if (metodo === 'gauss') {
      const mx = media(O.map((p) => p[0])), my = media(O.map((p) => p[1]));
      const sxx = media(O.map((p) => (p[0] - mx) ** 2)), syy = media(O.map((p) => (p[1] - my) ** 2)), sxy = media(O.map((p) => (p[0] - mx) * (p[1] - my)));
      // Cholesky de la matriz de covarianza 2×2.
      const l11 = Math.sqrt(sxx), l21 = sxy / l11, l22 = Math.sqrt(Math.max(1e-9, syy - l21 * l21));
      return O.map(() => { const z1 = VIZ.normal(rnd), z2 = VIZ.normal(rnd); return [mx + l11 * z1, my + l21 * z1 + l22 * z2]; });
    }
    if (metodo === 'copia') return O.map((p) => [p[0] + VIZ.normal(rnd) * 0.1, p[1] + VIZ.normal(rnd) * 5]);
    // Histograma 2D con ruido de Laplace (privacidad diferencial): cada persona cae en una celda, sensibilidad 1.
    const G = 10, cx = (DOM.x1 - DOM.x0) / G, cy = (DOM.y1 - DOM.y0) / G;
    const h = new Array(G * G).fill(0);
    O.forEach((p) => { const i = Math.min(G - 1, Math.floor((p[0] - DOM.x0) / cx)), j = Math.min(G - 1, Math.max(0, Math.floor((p[1] - DOM.y0) / cy))); h[j * G + i]++; });
    const ruido = h.map((c) => Math.max(0, c + B.laplace(rnd, 1 / eps)));
    const tot = ruido.reduce((s, v) => s + v, 0) || 1;
    return O.map(() => {
      let u = rnd() * tot, k = 0;
      while (k < ruido.length - 1 && u > ruido[k]) { u -= ruido[k]; k++; }
      return [DOM.x0 + (k % G + rnd()) * cx, DOM.y0 + (Math.floor(k / G) + rnd()) * cy];
    });
  }

  function montarSinteticos(cuerpo) {
    const O = originales();
    let metodo = 'gauss', eps = 1, semilla = 1, S = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Generador', valor: metodo,
      opciones: [['marginales', 'marginales independientes'], ['gauss', 'gaussiana multivariada'], ['dp', 'histograma con privacidad diferencial'], ['copia', 'copia con ruido mínimo (memoriza)']],
      alCambiar: (v) => { metodo = v; dibujar(); },
    });
    ctl.rango({ etiqueta: 'ε del histograma', min: 0.05, max: 5, paso: 0.05, valor: eps, formato: (v) => v.toFixed(2), alCambiar: (v) => { eps = v; if (metodo === 'dp') dibujar(); } });
    ctl.boton('Generar otra vez', () => { semilla++; dibujar(); }, { primario: true });
    const dos = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(dos);
    const ca = el('div'), cb = el('div');
    dos.append(ca, cb);
    VIZ.subtitulo(ca, 'Datos reales');
    VIZ.subtitulo(cb, 'Datos sintéticos');
    const la = VIZ.lienzo(ca, { proporcion: 0.8, altoMin: 220, altoMax: 320 });
    const lb = VIZ.lienzo(cb, { proporcion: 0.8, altoMin: 220, altoMax: 320 });
    const tip = VIZ.tooltip(lb);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'registro real', forma: 'punto' },
      { color: C.s1, texto: 'registro sintético', forma: 'punto' },
      { color: C.s8, texto: 'sintético casi idéntico a un real (riesgo)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Compare las nubes y las métricas. Pase el cursor sobre un punto sintético para ver su distancia al registro real más cercano.');
    const UMBRAL = 0.004;
    let dcr = [];
    function nube(l, P, colorDe) {
      const { ctx } = l;
      l.limpiar();
      const p = VIZ.plano(l, { xmin: DOM.x0, xmax: DOM.x1, ymin: DOM.y0, ymax: DOM.y1 }, { etiquetaX: 'edad', etiquetaY: 'ingreso (miles)', formatoY: (v) => VIZ.entero(v) });
      p.ejes();
      ctx.save(); p.recortar();
      P.forEach((q, i) => VIZ.marcador(ctx, p.sx(q[0]), p.sy(q[1]), colorDe(i), 3));
      ctx.restore();
      return p;
    }
    let pb = null;
    function dibujar() {
      S = generar(metodo, O, eps, VIZ.semilla(semilla * 97 + metodo.length));
      dcr = S.map((s) => Math.min(...O.map((o) => dist(s, o))));
      nube(la, O, () => C.tinta2);
      pb = nube(lb, S, (i) => (dcr[i] < UMBRAL ? C.s8 : C.s1));
      const sorted = [...dcr].sort((a, b) => a - b);
      const riesgo = dcr.filter((d) => d < UMBRAL).length;
      const jovenes = (P) => media(P.filter((p) => p[0] < 26).map((p) => p[1]));
      registro.textContent = {
        marginales: 'Cada columna se muestrea por separado: las distribuciones de edad e ingreso son exactas, pero se pierde la relación entre ellas.',
        gauss: 'Se ajusta una normal bivariada: conserva medias y correlación, pero no el grupo de estudiantes ni la asimetría del ingreso, y genera ingresos negativos.',
        dp: `Histograma de 10 × 10 celdas con ruido Lap(1/ε) y muestreo desde él. Con ε = ${eps.toFixed(2)} el resultado es ε-diferencialmente privado; con ε pequeño la nube se desdibuja.`,
        copia: 'Cada sintético es un real con un ruido ínfimo: la utilidad es perfecta y la privacidad, nula. Así se ve un generador que memorizó sus datos.',
      }[metodo];
      lectura.set([
        ['correlación real / sintética', `${VIZ.fmt(corr(O), 2)} / ${VIZ.fmt(corr(S), 2)}`],
        ['ingreso medio < 26 años', `${VIZ.entero(jovenes(O))} / ${VIZ.entero(jovenes(S) || 0)}`],
        ['DCR mediana', VIZ.fmt(sorted[Math.floor(sorted.length / 2)], 3)],
        ['casi copias', `${riesgo} de ${S.length}`],
      ]);
    }
    la.alDibujar = () => S.length && dibujar();
    lb.alDibujar = () => S.length && dibujar();
    lb.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lb.posicion(ev);
      if (!pb) return;
      const i = S.findIndex((q) => Math.hypot(pb.sx(q[0]) - x, pb.sy(q[1]) - y) < 5);
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `edad ${VIZ.fmt(S[i][0], 3)} · ingreso ${VIZ.entero(S[i][1])}<br>distancia al real más cercano: <b>${VIZ.fmt(dcr[i], 3)}</b>`);
    });
    lb.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('datos-sinteticos', {
    intro: String.raw`
      <p>Los <strong>datos sintéticos</strong> son registros inventados que imitan las propiedades estadísticas de los reales. Se ajusta un
      modelo a la base original y se publican muestras del modelo en vez de las personas. Si el modelo captura lo que importa
      (distribuciones, correlaciones) y no las particularidades de cada individuo, los analistas trabajan casi como con los datos
      reales y nadie en particular queda expuesto.</p>
      <p>Esa condición es la difícil: un modelo muy flexible puede <em>memorizar</em> registros, y entonces el dato «sintético» es una copia.
      Los datos sintéticos no son privados por definición; lo son si el generador se entrena con garantías, como privacidad diferencial.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuatro generadores',
        descripcion: 'Edad e ingreso de 160 personas reales, con un grupo de estudiantes. Compare qué conserva cada generador y cuántos registros sintéticos quedan peligrosamente cerca de uno real.',
        montar: montarSinteticos,
      },
    ],
    teoria: String.raw`
      <h2>Generadores</h2>
      <table>
        <tr><th>Método</th><th>Conserva</th><th>Pierde</th></tr>
        <tr><td>marginales independientes</td><td>cada distribución univariada</td><td>toda relación entre columnas</td></tr>
        <tr><td>gaussiana / cópula</td><td>medias, varianzas, correlaciones lineales</td><td>multimodalidad, colas, relaciones no lineales</td></tr>
        <tr><td>red bayesiana, CART secuencial</td><td>dependencias condicionales elegidas</td><td>lo que no modela</td></tr>
        <tr><td>GAN, VAE, modelos de difusión, LLM</td><td>estructura compleja</td><td>garantías: pueden memorizar</td></tr>
        <tr><td>con privacidad diferencial (PrivBayes, MST, DP-SGD)</td><td>lo que permite el presupuesto ε</td><td>detalle en proporción al ruido</td></tr>
      </table>

      <h2>Medir utilidad</h2>
      <ul>
        <li><strong>Fidelidad</strong>: distancia entre distribuciones (marginales, pares de columnas, correlaciones).</li>
        <li><strong>Utilidad de tarea</strong>: entrenar un modelo con datos sintéticos y evaluarlo con datos reales (<em>train synthetic, test
        real</em>).</li>
      </ul>

      <h2>Medir riesgo</h2>
      <p>La <strong>distancia al registro más cercano</strong> (DCR) de cada sintético \(s\) es \(\min_{r \in D} d(s, r)\). Si muchos sintéticos
      tienen DCR casi cero, el generador copió. Pero una DCR alta no prueba privacidad: un ataque de <strong>inferencia de pertenencia</strong>
      puede detectar si una persona estaba en el entrenamiento comparando la densidad del modelo cerca de ella con la de un modelo de
      referencia.</p>
      <div class="recuadro">La garantía formal viene de entrenar el generador con <a href="tema.html?id=privacidad-diferencial">privacidad
      diferencial</a>: por posprocesamiento, cualquier cantidad de muestras del generador conserva el mismo \(\varepsilon\). El histograma
      con ruido de la figura es el ejemplo más simple: cada persona cambia una celda en 1, el ruido \(\text{Lap}(1/\varepsilon)\) lo oculta, y
      muestrear del histograma ruidoso no gasta más presupuesto.</div>
      <p>Los datos sintéticos complementan, no reemplazan, a la <a href="tema.html?id=anonimizacion">anonimización</a> y a las
      <a href="tema.html?id=tecnicas-privacidad">técnicas de control de revelación</a>.</p>`,
  });
})();
