(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  /* ---------- Fig. 1: cuántas ventanas hay que mirar ---------- */

  const LADO = 224;
  function ventanas(escalas, razones, paso) {
    const lista = [];
    for (let k = 0; k < escalas; k++) for (const r of razones) {
      const w = Math.round(48 * 1.5 ** k * Math.sqrt(r)), h = Math.round((48 * 1.5 ** k) / Math.sqrt(r));
      if (w > LADO || h > LADO) continue;
      for (let y = 0; y + h <= LADO; y += paso) for (let x = 0; x + w <= LADO; x += paso) lista.push({ x, y, w, h, k, r });
    }
    return lista;
  }

  function montarVentanas(cuerpo) {
    let escalas = 3, nr = 1, paso = 32, ver = 0, objs = DL.escena(4, 3), geo = null;
    const RAZONES = [[1], [1, 2], [1, 2, 0.5]];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Escalas de ventana', min: 1, max: 5, valor: escalas, alCambiar: (v) => { escalas = v; ver = Math.min(ver, v - 1); dibujar(); } });
    ctl.rango({ etiqueta: 'Proporciones (1, 2, 0,5)', min: 1, max: 3, valor: nr, alCambiar: (v) => { nr = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Paso (píxeles)', min: 4, max: 64, paso: 4, valor: paso, alCambiar: (v) => { paso = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Escala que se dibuja', min: 1, max: 5, valor: 1, alCambiar: (v) => { ver = Math.min(v - 1, escalas - 1); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'ventanas de la escala elegida (cada una es una pasada por la red)', forma: 'linea' }, { color: C.s6, texto: 'ventana con IoU ≥ 0,5 con un objeto', forma: 'linea' }, { color: C.s2, texto: 'propuestas de un método selectivo / anclas de una RPN', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Imagen de ${LADO}×${LADO} píxeles. Barrer todas las posiciones, tamaños y proporciones exige un número enorme de clasificaciones. Los métodos de propuestas de regiones reducen ese número a unos pocos miles, concentrados donde puede haber objetos.`);
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, S = Math.min(H - 8, W * 0.5), X = 4, Y = 4;
      lienzo.limpiar();
      DL.dibujarEscena(ctx, X, Y, S, S, objs);
      const todas = ventanas(escalas, RAZONES[nr - 1], paso), vis = todas.filter((v) => v.k === ver);
      const buenas = new Set();
      const norm = (v) => ({ x: v.x / LADO, y: v.y / LADO, w: v.w / LADO, h: v.h / LADO });
      vis.forEach((v, i) => { if (objs.some((o) => DL.iou(norm(v), o) >= 0.5)) buenas.add(i); });
      vis.forEach((v, i) => { if (!buenas.has(i)) DL.caja(ctx, X, Y, S, S, norm(v), VIZ.alfa(C.s1, vis.length > 300 ? 0.1 : 0.35), { ancho: 1 }); });
      vis.forEach((v, i) => { if (buenas.has(i)) DL.caja(ctx, X, Y, S, S, norm(v), C.s6, { ancho: 2.5 }); });
      geo = { X, Y, S };
      // Comparación de cuántas evaluaciones hacen distintos métodos.
      const filas = [['ventana deslizante (este ajuste)', todas.length, C.s1], ['ventana deslizante fina (paso 8, 5 escalas, 3 proporciones)', ventanas(5, [1, 2, 0.5], 8).length, C.s1], ['Selective Search (R-CNN)', 2000, C.s2], ['anclas de una RPN (Faster R-CNN, 14×14×9)', 14 * 14 * 9, C.s2]];
      const bx = X + S + 24, bw = W - bx - 12;
      if (bw > 120) {
        const mx = Math.log10(Math.max(...filas.map((f) => f[1])) * 1.3);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Regiones a evaluar (escala log)', bx, 8);
        filas.forEach(([t, n, c], i) => {
          const y = 34 + i * 62, w = Math.max(2, (Math.log10(n) / mx) * bw);
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.fillText(t, bx, y);
          ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(bx, y + 16, w, 18, [0, 4, 4, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.fillText(VIZ.entero(n), bx + Math.min(w + 6, bw - 50), y + 19);
        });
      }
      const tot = todas.length;
      registro.textContent = `${VIZ.entero(tot)} ventanas en total (${vis.length} en la escala dibujada, de ${vis[0] ? vis[0].w : '—'}×${vis[0] ? vis[0].h : '—'} píxeles). Con una CNN que cueste 0,02 s por ventana, serían ${VIZ.fmt(tot * 0.02 / 60, 3)} minutos por imagen.`;
      lectura.set([['ventanas en total', VIZ.entero(tot)], ['en la escala dibujada', VIZ.entero(vis.length)], ['con IoU ≥ 0,5 (escala dibujada)', String(buenas.size)], ['objetos en la escena', String(objs.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || x < geo.X || x > geo.X + geo.S || y < geo.Y || y > geo.Y + geo.S) return tip.ocultar();
      const n = ventanas(escalas, RAZONES[nr - 1], paso).filter((v) => v.k === ver && x >= geo.X + (v.x / LADO) * geo.S && x <= geo.X + ((v.x + v.w) / LADO) * geo.S && y >= geo.Y + (v.y / LADO) * geo.S && y <= geo.Y + ((v.y + v.h) / LADO) * geo.S).length;
      tip.mostrar(x, y, `<b>${n}</b> ventanas de esta escala cubren este punto`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: agrupar regiones (en el espíritu de Selective Search) ---------- */

  const G = 14;
  function montarAgrupacion(cuerpo) {
    let semilla = 1, objs = [], cel = [], lab = [], reg = new Map(), props = [], msg = '', geo = null, paso = 0;
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 8 });
    ctl.boton('Nueva escena', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'frontera entre regiones', forma: 'linea' }, { color: C.s1, texto: 'propuesta (caja de una región)', forma: 'linea' }, { color: C.s6, texto: 'propuesta con IoU ≥ 0,5 con un objeto', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se parte de celdas muy pequeñas y se fusiona siempre el par vecino más parecido (por color y tamaño). Cada región, en cada nivel de la jerarquía, aporta una caja candidata: así aparecen cajas de objetos sin haber probado ninguna ventana al azar.');
    function iniciar() {
      objs = DL.escena(semilla + 9, 3);
      const r = VIZ.semilla(semilla * 5 + 1);
      cel = Array.from({ length: G * G }, (_, k) => {
        const cx = ((k % G) + 0.5) / G, cy = (Math.floor(k / G) + 0.5) / G, o = objs.find((q) => cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h);
        const base = o ? VIZ.rgb(DL.CLASES_OBJ[o.clase][1]) : [205, 203, 196];
        return base.map((v) => v + (r() - 0.5) * 36);
      });
      lab = cel.map((_, k) => k); reg = new Map(); props = []; paso = 0;
      cel.forEach((c, k) => { const x = k % G, y = Math.floor(k / G); reg.set(k, { n: 1, c: c.slice(), x0: x, x1: x, y0: y, y1: y }); });
      msg = `${G * G} regiones iniciales, una por celda.`;
      const caja = (g) => ({ x: g.x0 / G, y: g.y0 / G, w: (g.x1 - g.x0 + 1) / G, h: (g.y1 - g.y0 + 1) / G });
      return (function* () {
        while (reg.size > 1) {
          let mejor = null;
          for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
            if (x + dx >= G || y + dy >= G) continue;
            const a = lab[y * G + x], b = lab[(y + dy) * G + x + dx];
            if (a === b) continue;
            const A = reg.get(a), B = reg.get(b), d = Math.hypot(A.c[0] - B.c[0], A.c[1] - B.c[1], A.c[2] - B.c[2]) + (60 * (A.n + B.n)) / (G * G);
            if (!mejor || d < mejor.d) mejor = { a, b, d };
          }
          const A = reg.get(mejor.a), B = reg.get(mejor.b), n = A.n + B.n;
          const nuevo = { n, c: A.c.map((v, i) => (v * A.n + B.c[i] * B.n) / n), x0: Math.min(A.x0, B.x0), x1: Math.max(A.x1, B.x1), y0: Math.min(A.y0, B.y0), y1: Math.max(A.y1, B.y1) };
          reg.delete(mejor.b); reg.set(mejor.a, nuevo);
          lab = lab.map((l) => (l === mejor.b ? mejor.a : l));
          paso++;
          if (n >= 3) props.push({ ...caja(nuevo), n });
          msg = `Fusión ${paso}: dos regiones de ${A.n} y ${B.n} celdas pasan a ser una de ${n}. Quedan ${reg.size}.`;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!cel.length) return;
      const { ctx, ancho: W, alto: H } = lienzo, S = Math.min(H - 8, W - 8), X = (W - S) / 2, Y = 4, c = S / G;
      lienzo.limpiar();
      cel.forEach((col, k) => { ctx.fillStyle = `rgb(${col.map((v) => Math.max(0, Math.min(255, v | 0))).join(',')})`; ctx.fillRect(X + (k % G) * c, Y + Math.floor(k / G) * c, c + 0.5, c + 0.5); });
      ctx.strokeStyle = VIZ.alfa(C.tinta, 0.45); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        if (x + 1 < G && lab[y * G + x] !== lab[y * G + x + 1]) { ctx.moveTo(X + (x + 1) * c, Y + y * c); ctx.lineTo(X + (x + 1) * c, Y + (y + 1) * c); }
        if (y + 1 < G && lab[y * G + x] !== lab[(y + 1) * G + x]) { ctx.moveTo(X + x * c, Y + (y + 1) * c); ctx.lineTo(X + (x + 1) * c, Y + (y + 1) * c); }
      }
      ctx.stroke();
      const buenas = props.map((p) => objs.some((o) => DL.iou(p, o) >= 0.5));
      props.forEach((p, i) => { if (!buenas[i]) DL.caja(ctx, X, Y, S, S, p, VIZ.alfa(C.s1, 0.28), { ancho: 1 }); });
      props.forEach((p, i) => { if (buenas[i]) DL.caja(ctx, X, Y, S, S, p, C.s6, { ancho: 2.5 }); });
      geo = { X, Y, S };
      const mejores = objs.map((o) => Math.max(0, ...props.map((p) => DL.iou(p, o))));
      registro.textContent = msg;
      lectura.set([['regiones actuales', String(reg.size)], ['propuestas acumuladas', String(props.length)], ['objetos cubiertos (IoU ≥ 0,5)', `${mejores.filter((v) => v >= 0.5).length} de ${objs.length}`], ['mejor IoU por objeto', mejores.map((v) => VIZ.fmt(v, 2)).join(' · ')]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = Math.floor(((x - geo.X) / geo.S) * G), j = Math.floor(((y - geo.Y) / geo.S) * G);
      if (i < 0 || j < 0 || i >= G || j >= G) return tip.ocultar();
      const g = reg.get(lab[j * G + i]);
      tip.mostrar(x, y, `celda (${i + 1}, ${j + 1})<br>región de <b>${g.n}</b> celdas`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('region-proposals', {
    intro: String.raw`
      <p>La forma más simple de detectar objetos es probar una ventana en todas las posiciones, tamaños y proporciones posibles y clasificar cada una. Es correcta, pero astronómicamente cara: una imagen pequeña genera cientos de miles de ventanas, cada una con una pasada por la red.</p>
      <p>Las <strong>propuestas de regiones</strong> (<em>region proposals</em>) resuelven esto con un primer filtro barato que sugiere unos pocos miles de cajas «con pinta de objeto». <em>Selective Search</em> las obtiene agrupando regiones parecidas; la <em>Region Proposal Network</em> de Faster R-CNN las aprende con la misma red.</p>`,
    visualizaciones: [
      { titulo: 'Cuántas ventanas hay', descripcion: 'Aumente escalas y proporciones y reduzca el paso: el conteo se dispara. Compare con las propuestas de los métodos de dos etapas.', montar: montarVentanas },
      { titulo: 'Agrupar regiones para proponer cajas', descripcion: 'Reproduzca las fusiones y vea aparecer, en verde, cajas que cubren a los objetos sin haber probado ventanas al azar.', montar: montarAgrupacion },
    ],
    teoria: String.raw`
      <h2>Ventanas deslizantes</h2>
      <p>Con una imagen de \(n\times n\), ventanas \(w\times h\) y paso \(s\), el número de posiciones por tamaño es \(\big(\lfloor\frac{n-w}{s}\rfloor+1\big)\big(\lfloor\frac{n-h}{s}\rfloor+1\big)\), y hay que repetirlo para cada escala y proporción. Con paso 8, cinco escalas y tres proporciones, una imagen de \(224\times224\) ya supera las 5 000 ventanas.</p>
      <h2>La familia R-CNN</h2>
      <table>
        <tr><th>Método</th><th>Propuestas</th><th>Costo de la red</th></tr>
        <tr><td>R-CNN (2014)</td><td>Selective Search, ≈ 2 000</td><td>Una CNN completa por propuesta</td></tr>
        <tr><td>Fast R-CNN (2015)</td><td>Selective Search</td><td>Una sola CNN por imagen; <em>RoI pooling</em> recorta las características de cada propuesta</td></tr>
        <tr><td>Faster R-CNN (2015)</td><td>Red de propuestas (RPN) con anclas</td><td>Propuestas y clasificación comparten el backbone</td></tr>
      </table>
      <h2>Anclas</h2>
      <p>La RPN desliza una ventana sobre el mapa de características y, en cada posición, evalúa \(k\) <em>anclas</em> (cajas de referencia de varias escalas y proporciones). Para cada una predice la probabilidad de que contenga un objeto y un ajuste \((t_x,t_y,t_w,t_h)\):</p>
      \[ x = x_a + t_x w_a,\quad y = y_a + t_y h_a,\quad w = w_a e^{t_w},\quad h = h_a e^{t_h}. \]
      <p>Con un mapa de \(14\times14\) y \(k=9\) hay 1 764 anclas, frente a decenas de miles de ventanas.</p>
      <div class="recuadro"><p>Selective Search no usa aprendizaje: agrupa jerárquicamente segmentos por similitud de color, textura, tamaño y forma, y toma la caja de cada región de la jerarquía. La figura usa solo color y tamaño, como ilustración. Las propuestas se filtran luego con <a href="tema.html?id=iou-nms">NMS</a>.</p></div>
      <p>Véase <a href="tema.html?id=object-detection">Object Detection</a> para el esqueleto backbone–cabeza.</p>`,
  });
})();
