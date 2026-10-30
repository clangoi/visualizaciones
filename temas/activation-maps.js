(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');
  const NOM = DL.NOMBRES_IMAGEN.map(([, t]) => t);

  /* ---------- Fig. 1: una CNN pequeña aprende y se le miran las activaciones ---------- */

  function montarRed(cuerpo) {
    let img = 'cuadro', entrada = DL.IMAGENES.cuadro.map((f) => f.slice()), red = null, ep = 0, perdida = NaN, exac = NaN, semilla = 1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen de entrada', opciones: [...DL.NOMBRES_IMAGEN, ['blanco', 'en blanco (dibuje)']], valor: img, alCambiar: (v) => { img = v; entrada = v === 'blanco' ? DL.IMAGENES.cruz.map((f) => f.map(() => 0)) : DL.IMAGENES[v].map((f) => f.slice()); dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    ctl.boton('Pesos nuevos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const ci = Math.min(15, (w - 30) / 12), c1 = Math.min(22, (w - 110) / 24); return Math.round(20 + 12 * ci + (w > 560 ? 0 : 154) + 18 + 36 + 5 * c1 + 30 + 3 * Math.min(34, c1 * 1.8) + 6); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'activación o peso positivo', forma: 'cuadro' }, { color: C.s2, texto: 'peso negativo', forma: 'cuadro' }, { color: C.s6, texto: 'clase predicha', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La red (364 parámetros) se entrena con las seis figuras desplazadas y con ruido. Pulse Reproducir y mire cómo los filtros de la capa 1 se vuelven detectores de bordes. Después haga clic en los píxeles de la imagen para borrar o dibujar, y vea qué activa cada capa.');
    function iniciar() {
      red = DL.cnnPequena(semilla); ep = 0; perdida = NaN; exac = NaN;
      const r = VIZ.semilla(semilla * 31 + 3);
      return (function* () {
        while (ep < 80) {
          let L = 0;
          for (let b = 0; b < 10; b++) { const lote = Array.from({ length: 12 }, (_, k) => { const c = (b * 12 + k) % 6; return { img: DL.muestraImagen(c, r), c }; }); L += red.paso(lote); }
          ep++; perdida = L / 10;
          let ok = 0; const rv = VIZ.semilla(900 + ep);
          for (let c = 0; c < 6; c++) for (let t = 0; t < 10; t++) { const p = red.adelante(DL.muestraImagen(c, rv)).p; if (p.indexOf(Math.max(...p)) === c) ok++; }
          exac = ok / 60;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx, ancho: W } = lienzo, f = red.adelante(entrada), ci = Math.min(15, (W - 30) / 12), c1 = Math.min(22, (W - 110) / 24), ancha = W > 560;
      lienzo.limpiar(); geo = { celdas: [] };
      const rotulo = (t, x, y) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, x, y); };
      // Fila A: entrada y probabilidades.
      let y = 4;
      rotulo('Entrada 12×12', 8, y);
      DL.mapa(ctx, entrada, 8, y + 16, 12 * ci, 12 * ci, { min: 0, max: 1, gris: true });
      geo.entrada = { x: 8, y: y + 16, ci };
      const xb = ancha ? 8 + 12 * ci + 40 : 8, yb = ancha ? y + 16 : y + 16 + 12 * ci + 22, bw = Math.min(300, W - xb - 20);
      rotulo('Probabilidad de cada clase', xb, yb - 16);
      const mejor = f.p.indexOf(Math.max(...f.p));
      f.p.forEach((p, k) => {
        const yy = yb + k * 22;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(NOM[k], xb + 62, yy + 8);
        ctx.fillStyle = k === mejor ? C.s6 : C.s1; ctx.beginPath(); ctx.roundRect(xb + 68, yy, Math.max(2, p * (bw - 110)), 16, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(100 * p, 3) + ' %', xb + 72 + Math.max(2, p * (bw - 110)), yy + 8);
        geo.celdas.push({ x: xb, y: yy, w: bw, h: 16, t: `${NOM[k]}: <b>${VIZ.fmt(100 * p, 3)} %</b>` });
      });
      y = Math.max(ancha ? y + 16 + 12 * ci : yb + 6 * 22, y) + 18;
      // Fila B: filtros y mapas de la capa 1.
      rotulo(`Capa 1: ${red.c1} filtros 3×3 y sus mapas 5×5`, 8, y);
      const yB = y + 18;
      for (let q = 0; q < red.c1; q++) {
        const w = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => red.P.w1[q * 9 + i * 3 + j]));
        const x = 8 + q * (3 * c1 + 12);
        DL.mapa(ctx, w, x, yB, 3 * c1, 3 * c1, { divergente: true });
        geo.celdas.push({ x, y: yB, w: 3 * c1, h: 3 * c1, t: `filtro ${q + 1}: pesos del kernel` });
      }
      const x0 = 8 + red.c1 * (3 * c1 + 12) + 20;
      for (let q = 0; q < red.c1; q++) {
        const m = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => f.p1[(q * 5 + i) * 5 + j])), x = x0 + q * (5 * c1 + 12);
        DL.mapa(ctx, m, x, yB, 5 * c1, 5 * c1, { min: 0, max: Math.max(0.5, ...f.p1) });
        geo.celdas.push({ x, y: yB, w: 5 * c1, h: 5 * c1, t: `mapa ${q + 1} de la capa 1 (máx. ${f2(Math.max(...m.flat()))})` });
      }
      y = yB + 5 * c1 + 18;
      // Fila C: capa 2.
      const c2 = Math.min(34, c1 * 1.8);
      rotulo(`Capa 2: ${red.c2} mapas 3×3`, 8, y);
      for (let q = 0; q < red.c2; q++) {
        const m = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => f.a2[(q * 3 + i) * 3 + j])), x = 8 + q * (3 * c2 + 14);
        DL.mapa(ctx, m, x, y + 18, 3 * c2, 3 * c2, { min: 0, max: Math.max(0.5, ...f.a2) });
        geo.celdas.push({ x, y: y + 18, w: 3 * c2, h: 3 * c2, t: `mapa ${q + 1} de la capa 2 (máx. ${f2(Math.max(...m.flat()))})` });
      }
      registro.textContent = ep ? `Época ${ep}: pérdida ${VIZ.fmt(perdida, 3)}, exactitud en figuras nuevas ${VIZ.fmt(100 * exac, 3)} %. Con esta entrada, la red dice «${NOM[mejor]}» (${VIZ.fmt(100 * f.p[mejor], 3)} %).` : 'Red sin entrenar: los filtros son aleatorios y las probabilidades, casi parejas.';
      lectura.set([['época', String(ep)], ['predicción', NOM[mejor]], ['confianza', `${VIZ.fmt(100 * f.p[mejor], 3)} %`], ['parámetros', String(red.nParametros)], ['exactitud (figuras nuevas)', ep ? `${VIZ.fmt(100 * exac, 3)} %` : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.entrada) return;
      const { x: gx, y: gy, ci } = geo.entrada, j = Math.floor((x - gx) / ci), i = Math.floor((y - gy) / ci);
      if (i >= 0 && i < 12 && j >= 0 && j < 12) { entrada[i][j] = entrada[i][j] > 0.5 ? 0 : 1; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo && geo.celdas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (g) tip.mostrar(x, y, g.t); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: un filtro aprendido frente a una imagen: de la respuesta a la decisión ---------- */

  function montarFiltro(cuerpo) {
    let red = null, sel = 0, geo = [], img = 'diagonal';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: DL.NOMBRES_IMAGEN, valor: img, alCambiar: (v) => { img = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Filtro de la capa 1', min: 1, max: 3, valor: 1, alCambiar: (v) => { sel = v - 1; dibujar(); } });
    ctl.boton('Entrenar la red', () => { entrenar(); dibujar(); }, { primario: true });
    ctl.boton('Olvidar (pesos al azar)', () => { red = DL.cnnPequena(7); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 300 : 420) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'respuesta positiva', forma: 'cuadro' }, { color: C.s2, texto: 'peso negativo del filtro', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Compare el mapa de un filtro entrenado con el de uno aleatorio, sobre las seis imágenes. Un filtro aprendido responde a una orientación o a un tipo de borde concreto; uno aleatorio responde a casi todo con poco criterio.');
    function entrenar() {
      red = DL.cnnPequena(7);
      const r = VIZ.semilla(5);
      for (let e = 0; e < 60; e++) for (let b = 0; b < 10; b++) red.paso(Array.from({ length: 12 }, (_, k) => { const c = (b * 12 + k) % 6; return { img: DL.muestraImagen(c, r), c }; }));
    }
    function dibujar() {
      if (!red) { red = DL.cnnPequena(7); }
      const { ctx, ancho: W } = lienzo, ancha = W > 640, c = ancha ? Math.min(14, (W - 100) / 30) : Math.min(14, (W - 40) / 16);
      lienzo.limpiar(); geo = [];
      const w = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => red.P.w1[sel * 9 + i * 3 + j]));
      const I = DL.IMAGENES[img], m = DL.relu(DL.convolucion(I, w));
      const rot = (t, x, y) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, x, y); };
      rot('Imagen', 10, 6); DL.mapa(ctx, I, 10, 22, 12 * c, 12 * c, { min: 0, max: 1, gris: true });
      const x1 = 10 + 12 * c + 24;
      rot(`Filtro ${sel + 1} (peso)`, x1, 6); DL.mapa(ctx, w, x1, 22, 3 * c * 1.5, 3 * c * 1.5, { divergente: true, valores: f2 });
      const x2 = ancha ? x1 + 3 * c * 1.5 + 24 : 10, y2 = ancha ? 22 : 22 + 12 * c + 28;
      rot('Mapa (ReLU)', x2, y2 - 16); DL.mapa(ctx, m, x2, y2, 10 * c, 10 * c, { min: 0, max: Math.max(0.5, ...m.flat()) });
      geo.push({ x: x2, y: y2, c, m });
      const total = m.flat().reduce((s, v) => s + v, 0);
      registro.textContent = `Respuesta total del filtro ${sel + 1} sobre «${DL.NOMBRES_IMAGEN.find((q) => q[0] === img)[1]}»: ${f2(total)}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo[0];
      if (!g) return;
      const j = Math.floor((x - g.x) / g.c), i = Math.floor((y - g.y) / g.c);
      if (i >= 0 && i < 10 && j >= 0 && j < 10) tip.mostrar(x, y, `(${i + 1}, ${j + 1}): <b>${f2(g.m[i][j])}</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    entrenar();
    dibujar();
  }

  VIZ.registrarTema('activation-maps', {
    intro: String.raw`
      <p>Una red convolucional no tiene un solo paso donde «reconoce» un objeto: lo va construyendo por etapas. Las primeras capas detectan bordes y orientaciones; las siguientes combinan esas respuestas en esquinas y curvas; las últimas, en partes y objetos completos.
      Es una <strong>jerarquía de características</strong>, y se puede mirar directamente: basta dibujar los <em>mapas de activación</em> de cada capa para una imagen dada.</p>
      <p>La red de esta página es real y minúscula (364 parámetros): se entrena aquí mismo, en su navegador, para distinguir seis figuras. Así se ve qué aprenden los filtros y qué responde cada capa.</p>`,
    visualizaciones: [
      { titulo: 'Entrenar una CNN y mirar por dentro', descripcion: 'Pulse Reproducir y mire los filtros. Después elija una figura o dibuje la suya haciendo clic y observe los mapas de cada capa y las probabilidades.', montar: montarRed },
      { titulo: 'Filtro entrenado frente a filtro aleatorio', descripcion: 'Compare el mapa de un filtro tras entrenar con uno antes de entrenar. Cambie de imagen y de filtro.', montar: montarFiltro },
    ],
    teoria: String.raw`
      <h2>Qué se ve en cada capa</h2>
      <p>En redes grandes entrenadas con imágenes naturales (Zeiler y Fergus; Olah et al.), la jerarquía es muy regular:</p>
      <table>
        <tr><th>Profundidad</th><th>Detecta</th><th>Campo receptivo</th></tr>
        <tr><td>Capas 1–2</td><td>bordes, orientaciones, colores, manchas</td><td>pequeño (3–10 píxeles)</td></tr>
        <tr><td>Capas intermedias</td><td>texturas, esquinas, patrones repetidos</td><td>mediano</td></tr>
        <tr><td>Capas profundas</td><td>partes de objetos (ojos, ruedas), objetos</td><td>gran parte de la imagen</td></tr>
      </table>
      <h2>Cómo se calculan</h2>
      <p>La capa \(\ell\) transforma el volumen de la anterior \(A^{(\ell-1)}\) (\(C_{\ell-1}\) mapas) en \(C_\ell\) mapas:</p>
      \[ A^{(\ell)}_{c} = \operatorname{pool}\Big(\operatorname{ReLU}\Big(\textstyle\sum_{c'} K^{(\ell)}_{c,c'} * A^{(\ell-1)}_{c'} + b_c\Big)\Big). \]
      <p>Cada mapa \(A^{(\ell)}_c\) es una de las «imágenes» que se dibujan en la figura. Tras la última capa convolucional, los mapas se aplanan y una capa densa con <em>softmax</em> produce las probabilidades de clase.</p>
      <h2>Formas de visualizar</h2>
      <ul>
        <li><strong>Mapas de activación</strong> (como aquí): qué responde cada filtro ante una imagen concreta.</li>
        <li><strong>Visualización de filtros</strong>: en la primera capa, los pesos son directamente interpretables.</li>
        <li><strong>Maximización de activación</strong>: buscar la imagen que más enciende una neurona.</li>
        <li><strong>Mapas de saliencia, Grad-CAM</strong>: qué píxeles pesaron en una decisión (ver <a href="tema.html?id=interpretability">Interpretability</a>).</li>
      </ul>
      <div class="recuadro"><p>Estas visualizaciones son una ayuda, no una prueba de que la red «piense» como una persona. Un filtro que se activa con bordes verticales no explica por qué clasificó una imagen como la clasificó.</p></div>
      <p>Véase también <a href="tema.html?id=convolution-kernels">Convolution Kernels</a>, <a href="tema.html?id=stride-padding-pooling">Stride, Padding &amp; Pooling</a> y <a href="tema.html?id=cnn">Convolutional Neural Networks</a>.</p>`,
  });
})();
