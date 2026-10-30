(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const NOM = DL.CLASES_OBJ.map(([n]) => n);
  const leyendaObj = DL.CLASES_OBJ.map(([n, c]) => ({ color: c, texto: n, forma: 'cuadro' }));

  // Predicciones simuladas: la caja real más un error pequeño y una confianza.
  function predecir(objs, semilla, ruido = 0.012) {
    const r = VIZ.semilla(semilla * 7 + 1);
    return objs.map((o) => ({ clase: o.clase, conf: 0.72 + 0.26 * r(), x: o.x + (r() - 0.5) * 2 * ruido * 2, y: o.y + (r() - 0.5) * 2 * ruido * 2, w: o.w * (1 + (r() - 0.5) * 0.1), h: o.h * (1 + (r() - 0.5) * 0.1) }));
  }

  /* ---------- Fig. 1: tres tareas, tres salidas ---------- */

  function montarTareas(cuerpo) {
    let modo = 'det', n = 3, semilla = 1, objs = [], pred = [], geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tarea', opciones: [['cls', 'Clasificación de la imagen'], ['loc', 'Clasificación + localización (1 objeto)'], ['det', 'Detección (varios objetos)']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Objetos en la escena', min: 1, max: 5, valor: n, alCambiar: (v) => { n = v; generar(); } });
    ctl.boton('Nueva escena', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...leyendaObj, { color: C.tinta, texto: 'caja predicha', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'A la izquierda, la escena con la salida de cada tarea; a la derecha, el contenido exacto de esa salida. Las cajas son predicciones simuladas (la real con un error pequeño), para mostrar el formato de los resultados.');
    function generar() { objs = DL.escena(semilla, n); pred = predecir(objs, semilla); hover = -1; dibujar(); }
    function dibujar() {
      if (!objs.length) return;
      const { ctx, ancho: W, alto: H } = lienzo, ancha = W > 560;
      lienzo.limpiar();
      const S = ancha ? Math.min(H - 8, W * 0.5) : Math.min(W - 8, H * 0.55), X = 4, Y = 4;
      DL.dibujarEscena(ctx, X, Y, S, S, objs);
      const grande = pred.reduce((m, p, i) => (p.w * p.h > pred[m].w * pred[m].h ? i : m), 0);
      const mostrar = modo === 'det' ? pred.map((p, i) => i) : modo === 'loc' ? [grande] : [];
      mostrar.forEach((i) => DL.caja(ctx, X, Y, S, S, pred[i], C.tinta, { ancho: 2.5, etiqueta: `${NOM[pred[i].clase]} ${VIZ.fmt(pred[i].conf, 2)}` }));
      geo = { X, Y, S };
      // Panel de salida.
      const tx = ancha ? S + 24 : 8, ty = ancha ? 14 : S + 24, f = VIZ.fuente(12);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('Salida del modelo', tx, ty);
      ctx.font = f; ctx.fillStyle = C.tinta;
      const lineas = [];
      if (modo === 'cls') {
        const prom = NOM.map((_, k) => objs.filter((o) => o.clase === k).length);
        const tot = prom.reduce((s, v) => s + v, 0), p = prom.map((v) => (v + 0.1) / (tot + 0.3));
        lineas.push('P(clase | imagen) =', ...p.map((v, k) => `  ${NOM[k].padEnd(6)} ${VIZ.fmt(v, 2)}`), '→ un solo vector de 3 números', 'No dice dónde está nada.');
      } else if (modo === 'loc') {
        const p = pred[grande];
        lineas.push(`clase: ${NOM[p.clase]}`, `x = ${VIZ.fmt(p.x, 2)}, y = ${VIZ.fmt(p.y, 2)}`, `ancho = ${VIZ.fmt(p.w, 2)}, alto = ${VIZ.fmt(p.h, 2)}`, '→ una clase y 4 números', objs.length > 1 ? `Ignora los otros ${objs.length - 1} objeto(s).` : '');
      } else {
        lineas.push(`${pred.length} detección(es):`, ...pred.map((p, i) => `${i + 1}. ${NOM[p.clase].padEnd(6)} ${VIZ.fmt(p.conf, 2)} [${VIZ.fmt(p.x, 2)}, ${VIZ.fmt(p.y, 2)}, ${VIZ.fmt(p.w, 2)}, ${VIZ.fmt(p.h, 2)}]`), '→ lista de tamaño variable');
      }
      lineas.forEach((l, i) => ctx.fillText(l, tx, ty + 20 + i * 18));
      registro.textContent = modo === 'cls' ? 'Clasificar responde «¿qué hay?» para toda la imagen.' : modo === 'loc' ? 'Localizar añade «¿dónde?», pero para un solo objeto.' : 'Detectar responde «¿qué hay y dónde?» para cada objeto, cuántos sean.';
      lectura.set([['objetos reales', String(objs.length)], ['números en la salida', modo === 'cls' ? '3' : modo === 'loc' ? '3 + 4' : `${pred.length} × (3 + 4 + 1)`], ['tamaño de salida', modo === 'det' ? 'variable' : 'fijo'], ['cajas dibujadas', String(mostrar.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = objs.findIndex((o) => x >= geo.X + o.x * geo.S && x <= geo.X + (o.x + o.w) * geo.S && y >= geo.Y + o.y * geo.S && y <= geo.Y + (o.y + o.h) * geo.S);
      if (i >= 0) tip.mostrar(x, y, `${NOM[objs[i].clase]}<br>caja real [${VIZ.fmt(objs[i].x, 2)}, ${VIZ.fmt(objs[i].y, 2)}, ${VIZ.fmt(objs[i].w, 2)}, ${VIZ.fmt(objs[i].h, 2)}]`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: backbone, rejilla y cabeza de detección ---------- */

  function montarCabeza(cuerpo) {
    let S = 5, semilla = 2, objs = [], sel = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Rejilla S × S del mapa de características', min: 3, max: 8, valor: S, alCambiar: (v) => { S = v; sel = null; dibujar(); } });
    ctl.boton('Nueva escena', () => { semilla++; objs = DL.escena(semilla, 3); sel = null; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    objs = DL.escena(semilla, 3);
    VIZ.leyenda(cuerpo, [...leyendaObj, { color: C.s6, texto: 'celda responsable de un objeto (contiene su centro)', forma: 'cuadro' }, { color: C.s2, texto: 'celda elegida', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El backbone convierte la imagen en una rejilla de características; la cabeza predice en cada celda si hay un objeto, su caja y su clase. Haga clic en una celda para ver su vector de salida.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, T = Math.min(H - 8, W * 0.46), X = 4, Y = 4;
      lienzo.limpiar();
      DL.dibujarEscena(ctx, X, Y, T, T, objs);
      const resp = new Map();
      objs.forEach((o) => { const ci = Math.min(S - 1, Math.floor((o.x + o.w / 2) * S)), cj = Math.min(S - 1, Math.floor((o.y + o.h / 2) * S)); resp.set(`${ci},${cj}`, o); });
      ctx.lineWidth = 1; ctx.strokeStyle = VIZ.alfa(C.tinta, 0.35);
      for (let k = 1; k < S; k++) { ctx.beginPath(); ctx.moveTo(X + (k * T) / S, Y); ctx.lineTo(X + (k * T) / S, Y + T); ctx.moveTo(X, Y + (k * T) / S); ctx.lineTo(X + T, Y + (k * T) / S); ctx.stroke(); }
      resp.forEach((o, k) => { const [i, j] = k.split(',').map(Number); ctx.fillStyle = VIZ.alfa(C.s6, 0.28); ctx.fillRect(X + (i * T) / S, Y + (j * T) / S, T / S, T / S); });
      if (sel) { ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.strokeRect(X + (sel[0] * T) / S, Y + (sel[1] * T) / S, T / S, T / S); }
      geo = { X, Y, T };
      // Esquema backbone → rejilla → cabeza, y vector de la celda elegida.
      const bx = X + T + 24, ancho = W - bx - 8;
      if (ancho > 150) {
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Imagen → backbone → rejilla → cabeza', bx, 8);
        const bl = (y, t, c) => { ctx.fillStyle = VIZ.alfa(c, 0.2); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, y, ancho, 30, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle'; ctx.fillText(t, bx + 8, y + 15); };
        bl(30, 'Backbone (convoluciones; p. ej. ResNet)', C.s1); bl(72, `Mapa de características ${S}×${S}×C`, C.s3); bl(114, `Cabeza: por celda 5 + ${NOM.length} números`, C.s2);
        const o = sel ? resp.get(`${sel[0]},${sel[1]}`) : null;
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta; ctx.textBaseline = 'top';
        const L = sel ? (o ? [`Celda (${sel[0] + 1}, ${sel[1] + 1}): objeto presente`, `objectness = 0.97`, `centro dentro de la celda = (${VIZ.fmt(((o.x + o.w / 2) * S) % 1, 2)}, ${VIZ.fmt(((o.y + o.h / 2) * S) % 1, 2)})`, `ancho, alto = (${VIZ.fmt(o.w, 2)}, ${VIZ.fmt(o.h, 2)})`, `clase: ${NOM[o.clase]}`] : [`Celda (${sel[0] + 1}, ${sel[1] + 1}): sin objeto`, 'objectness ≈ 0.02', 'las demás salidas se ignoran']) : ['Haga clic en una celda', 'para ver su vector de salida.'];
        L.forEach((l, i) => ctx.fillText(l, bx, 160 + i * 16));
      }
      registro.textContent = `Con una rejilla ${S}×${S} el modelo hace ${S * S} predicciones de una sola pasada; ${resp.size} celda(s) son responsables de un objeto${objs.length > resp.size ? ' (dos objetos cayeron en la misma celda: solo uno puede detectarse)' : ''}.`;
      lectura.set([['celdas', String(S * S)], ['números por celda', String(5 + NOM.length)], ['números de salida', VIZ.entero(S * S * (5 + NOM.length))], ['celdas con objeto', `${resp.size} de ${S * S}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = Math.floor(((x - geo.X) / geo.T) * S), j = Math.floor(((y - geo.Y) / geo.T) * S);
      if (i >= 0 && i < S && j >= 0 && j < S) { sel = [i, j]; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = Math.floor(((x - geo.X) / geo.T) * S), j = Math.floor(((y - geo.Y) / geo.T) * S);
      if (i >= 0 && i < S && j >= 0 && j < S) tip.mostrar(x, y, `celda (${i + 1}, ${j + 1})`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('object-detection', {
    intro: String.raw`
      <p>Clasificar una imagen responde <em>¿qué hay?</em>. <strong>Localizar</strong> añade <em>¿dónde?</em>, con una <strong>caja delimitadora</strong> (<em>bounding box</em>), pero para un solo objeto. <strong>Detectar</strong> responde ambas preguntas para <em>todos</em> los objetos, y no se sabe de antemano cuántos son.</p>
      <p>Los detectores modernos comparten un esqueleto: un <strong>backbone</strong> convolucional extrae características, y una <strong>cabeza de detección</strong> (<em>detection head</em>) convierte esas características en cajas y clases. La cabeza puede predecir sobre una rejilla (YOLO, SSD) o sobre propuestas de regiones (la familia R-CNN).</p>`,
    visualizaciones: [
      { titulo: 'Clasificar, localizar y detectar', descripcion: 'Alterne las tres tareas sobre la misma escena y mire cuántos números tiene cada salida. Aumente los objetos y vea quién deja de funcionar.', montar: montarTareas },
      { titulo: 'Backbone, rejilla y cabeza', descripcion: 'Cambie el tamaño de la rejilla y haga clic en una celda: la celda que contiene el centro de un objeto es la responsable de predecirlo.', montar: montarCabeza },
    ],
    teoria: String.raw`
      <h2>Qué predice una detección</h2>
      <p>Cada detección es una tupla</p>
      \[ (\,\hat c,\; s,\; \hat b\,), \qquad \hat b=(x,y,w,h)\ \text{o}\ (x_1,y_1,x_2,y_2), \]
      <p>con la clase \(\hat c\), una confianza \(s\) y la caja \(\hat b\). Se entrena con una pérdida compuesta:</p>
      \[ \mathcal{L} = \lambda_{\text{caja}}\,\mathcal{L}_{\text{loc}}(\hat b, b) + \lambda_{\text{obj}}\,\mathcal{L}_{\text{conf}} + \lambda_{\text{cls}}\,\mathcal{L}_{\text{cls}}, \]
      <p>con \(\mathcal{L}_{\text{loc}}\) una regresión (L1, L2 o una pérdida basada en IoU) y las otras dos, entropías cruzadas.</p>
      <h2>Dos familias</h2>
      <table>
        <tr><th></th><th>Dos etapas (R-CNN, Fast/Faster R-CNN)</th><th>Una etapa (YOLO, SSD, RetinaNet)</th></tr>
        <tr><td>Idea</td><td>Primero proponer regiones, luego clasificarlas y afinar su caja</td><td>Predecir cajas y clases directamente sobre una rejilla o ancla</td></tr>
        <tr><td>Precisión</td><td>Suele ser mayor</td><td>Algo menor, pero ha mejorado mucho</td></tr>
        <tr><td>Velocidad</td><td>Más lenta</td><td>Tiempo real</td></tr>
      </table>
      <h2>Salida en rejilla</h2>
      <p>Con una rejilla \(S\times S\), \(B\) cajas por celda y \(K\) clases, la salida tiene \(S\cdot S\cdot(5B+K)\) números. La celda que contiene el centro de un objeto es la responsable; por eso dos objetos de centros cercanos pueden perderse.</p>
      <div class="recuadro"><p>Un detector genera muchas cajas duplicadas por objeto: se limpian con la <a href="tema.html?id=iou-nms">supresión de no máximos</a>. Su calidad se mide con <a href="tema.html?id=iou-nms">IoU</a> y precisión promedio (mAP). Para entrenar con pocos datos se parte de un backbone preentrenado (<a href="tema.html?id=transfer-learning">Transfer Learning</a>).</p></div>`,
  });
})();
