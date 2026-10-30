(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: el tamaño de salida ---------- */

  function montarTamano(cuerpo) {
    let n = 8, k = 3, s = 1, p = 0, geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño de la entrada n', min: 4, max: 14, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño del kernel k', min: 1, max: 7, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Paso (stride) s', min: 1, max: 4, valor: s, alCambiar: (v) => { s = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Relleno (padding) p', min: 0, max: 3, valor: p, alCambiar: (v) => { p = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(34, (w - 30) / 20) * 10 + 90) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.inactivo, texto: 'píxel de la imagen', forma: 'cuadro' }, { color: C.tenue, texto: 'relleno de ceros', forma: 'cuadro' }, { color: C.s1, texto: 'posiciones del kernel en la fila resaltada', forma: 'linea' }, { color: C.s2, texto: 'posición señalada', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, la entrada con su relleno y las posiciones del kernel a lo largo de la primera fila; abajo, la salida. Pase el cursor sobre una casilla de la salida para ver qué región de la entrada la produce.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, N = n + 2 * p, salida = DL.tamSalida(n, k, s, p), c = Math.min(30, (W - 30) / Math.max(N, 10, salida));
      lienzo.limpiar();
      const x0 = (W - N * c) / 2, y0 = 22;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`Entrada ${n}×${n}${p ? ` + relleno ${p} = ${N}×${N}` : ''}`, 6, 2);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const borde = i < p || j < p || i >= N - p || j >= N - p;
        ctx.fillStyle = borde ? C.tenue : C.inactivo; ctx.fillRect(x0 + j * c + 1, y0 + i * c + 1, c - 2, c - 2);
      }
      const ok = salida >= 1;
      const ventana = (j) => { ctx.strokeRect(x0 + j * s * c, y0, k * c, k * c); };
      if (ok) {
        ctx.lineWidth = 2; ctx.strokeStyle = VIZ.alfa(C.s1, 0.7);
        for (let j = 0; j < salida; j++) ventana(j);
        if (hover >= 0) { ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.strokeRect(x0 + hover * s * c, y0, k * c, k * c); }
      }
      const ys = y0 + N * c + 30, xs = (W - Math.max(salida, 0) * c) / 2;
      ctx.fillStyle = C.tinta2; ctx.fillText(ok ? `Salida ${salida}×${salida}` : 'El kernel no cabe: salida vacía', 6, ys - 18);
      for (let i = 0; i < Math.max(salida, 0); i++) for (let j = 0; j < salida; j++) { ctx.fillStyle = i === 0 && j === hover ? C.s2 : VIZ.alfa(C.s1, 0.35); ctx.fillRect(xs + j * c + 1, ys + i * c + 1, c - 2, c - 2); }
      geo = { x0, y0, c, xs, ys, salida, N };
      const same = DL.tamSalida(n, k, 1, Math.floor(k / 2)) === n;
      registro.textContent = ok ? `⌊(${n} + 2·${p} − ${k}) / ${s}⌋ + 1 = ${salida}. ${s === 1 && p === (k - 1) / 2 ? 'Relleno «same»: la salida conserva el tamaño de la entrada.' : p === 0 && s === 1 ? 'Sin relleno («valid»): la salida se encoge en k − 1.' : s > 1 ? `Con paso ${s}, la salida se reduce aproximadamente ${s} veces por lado.` : ''}` : `Con n + 2p = ${N} < k = ${k} el kernel no cabe ni una vez.`;
      lectura.set([['tamaño de salida', ok ? `${salida} × ${salida}` : '0'], ['valores en la salida', ok ? String(salida * salida) : '0'], ['entrada efectiva (n + 2p)', String(N)], ['multiplicaciones por filtro', ok ? VIZ.entero(salida * salida * k * k) : '0'], ['relleno «same» sería', same ? `p = ${Math.floor(k / 2)}` : `p = ${Math.floor(k / 2)} (k par: no exacto)`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || geo.salida < 1) return;
      const j = Math.floor((x - geo.xs) / geo.c), i = Math.floor((y - geo.ys) / geo.c);
      const nuevo = i === 0 && j >= 0 && j < geo.salida ? j : -1;
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (nuevo >= 0) tip.mostrar(x, y, `salida (1, ${j + 1}) cubre las columnas ${j * s - p + 1} a ${j * s - p + k} de la entrada`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: pooling e invariancia a pequeños desplazamientos ---------- */

  function desplazar(I, d) { return I.map((f, i) => f.map((_, j) => (j - d >= 0 && j - d < f.length ? I[i][j - d] : 0))); }

  function montarPooling(cuerpo) {
    let img = 'anillo', tipo = 'max', tam = 2, d = 1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: DL.NOMBRES_IMAGEN, valor: img, alCambiar: (v) => { img = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Tipo de pooling', opciones: [['max', 'Max pooling'], ['prom', 'Average pooling']], valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ventana (= paso)', opciones: [['2', '2×2'], ['3', '3×3']], valor: String(tam), alCambiar: (v) => { tam = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Desplazar la imagen (píxeles)', min: 0, max: 3, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 300 : 420) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'activación positiva', forma: 'cuadro' }, { color: C.s2, texto: 'cambio entre la versión original y la desplazada', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se aplica un filtro de borde vertical y ReLU, y luego pooling. Compare cuánto cambia el mapa al desplazar la imagen 1–3 píxeles: tras el pooling cambia menos. El pooling reduce el tamaño y vuelve la representación algo insensible a pequeños movimientos.');
    const L2 = (A, B) => Math.sqrt(A.flat().reduce((s, v, i) => s + (v - B.flat()[i]) ** 2, 0));
    function dibujar() {
      const { ctx, ancho: W } = lienzo, I0 = DL.IMAGENES[img], I1 = desplazar(I0, d), K = DL.KERNELS.vertical.k;
      const m0 = DL.relu(DL.convolucion(I0, K)), m1 = DL.relu(DL.convolucion(I1, K));
      const p0 = DL.pool(m0, tam, tam, tipo === 'max' ? 'max' : 'prom'), p1 = DL.pool(m1, tam, tam, tipo === 'max' ? 'max' : 'prom');
      const dif = (A, B) => A.map((f, i) => f.map((v, j) => B[i][j] - v));
      const ancha = W > 640, c = ancha ? Math.min(14, (W - 100) / 36) : Math.min(14, (W - 40) / 20);
      lienzo.limpiar(); geo = [];
      const mx = Math.max(1, ...m0.flat(), ...m1.flat());
      const panel = (mat, x, y, titulo, esDif, escalaMax) => {
        const cc = (10 * c) / mat.length;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(titulo, x, y);
        if (esDif) DL.mapa(ctx, mat, x, y + 14, 10 * c, 10 * c, { divergente: true, min: -escalaMax, max: escalaMax });
        else DL.mapa(ctx, mat, x, y + 14, 10 * c, 10 * c, { min: 0, max: escalaMax });
        geo.push({ x, y: y + 14, cc, mat, titulo });
      };
      const fila = (y, A, B, tA, tB, tD, mxx) => { const sep = 10 * c + 20; panel(A, 10, y, tA, false, mxx); panel(B, 10 + sep, y, tB, false, mxx); panel(dif(A, B).length === A.length ? dif(A, B) : A, 10 + 2 * sep, y, tD, true, mxx); };
      const mxp = Math.max(1, ...p0.flat(), ...p1.flat());
      // Los mapas pooled tienen otro tamaño: se dibujan con el mismo ancho total.
      if (ancha) { fila(8, m0, m1, 'Mapa original (10×10)', 'Mapa con imagen desplazada', 'Diferencia', mx); fila(8 + 10 * c + 44, p0, p1, `Tras ${tipo === 'max' ? 'max' : 'average'} pooling ${tam}×${tam} (${p0.length}×${p0.length})`, 'Desplazada, tras pooling', 'Diferencia', mxp); }
      else { fila(8, m0, m1, 'Original', 'Desplazada', 'Diferencia', mx); fila(8 + 10 * c + 44, p0, p1, 'Pooling original', 'Pooling desplazada', 'Diferencia', mxp); }
      const a = L2(m0, m1), b = L2(p0, p1), na = Math.sqrt(m0.flat().reduce((s, v) => s + v * v, 0)), nb = Math.sqrt(p0.flat().reduce((s, v) => s + v * v, 0));
      registro.textContent = d === 0 ? 'Sin desplazamiento no hay diferencias. Mueva el control «Desplazar».' : `Con ${d} píxel(es) de desplazamiento, el mapa cambia un ${VIZ.fmt(100 * a / na, 3)} % (relativo a su norma); tras el pooling, un ${VIZ.fmt(100 * b / nb, 3)} %.`;
      lectura.set([['tamaño antes del pooling', '10 × 10'], ['tamaño después', `${p0.length} × ${p0.length}`], ['valores que se conservan', `${VIZ.fmt(100 * p0.length ** 2 / 100, 3)} %`], ['cambio relativo antes', `${VIZ.fmt(100 * a / na, 3)} %`], ['cambio relativo después', `${VIZ.fmt(100 * b / nb, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x < q.x + q.cc * q.mat.length && y >= q.y && y < q.y + q.cc * q.mat.length);
      if (!g) return tip.ocultar();
      const j = Math.floor((x - g.x) / g.cc), i = Math.floor((y - g.y) / g.cc);
      tip.mostrar(x, y, `${g.titulo}<br>(${i + 1}, ${j + 1}): <b>${f2(g.mat[i][j])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('stride-padding-pooling', {
    intro: String.raw`
      <p>Tres decisiones controlan cuánto se reduce un mapa de características al atravesar una capa. El <strong>paso</strong> (<em>stride</em>) es cuántos píxeles avanza el kernel entre una posición y la siguiente. El <strong>relleno</strong> (<em>padding</em>) añade un marco de ceros alrededor de la imagen, para que el kernel pueda centrarse en los bordes.
      El <strong>pooling</strong> resume cada ventana en un solo número: el máximo (<em>Max Pooling</em>) o el promedio (<em>Average Pooling</em>).</p>
      <p>Las tres reducen el tamaño de la representación, y con él, el cálculo; y el pooling añade cierta tolerancia a pequeños desplazamientos del objeto.</p>`,
    visualizaciones: [
      { titulo: 'Tamaño de la salida', descripcion: 'Cambie \\(n\\), \\(k\\), \\(s\\) y \\(p\\) y compruebe la fórmula. Busque el relleno que deja la salida del mismo tamaño que la entrada.', montar: montarTamano },
      { titulo: 'Max pooling y average pooling', descripcion: 'Desplace la imagen y compare cuánto cambia el mapa antes y después del pooling. Alterne entre máximo y promedio.', montar: montarPooling },
    ],
    teoria: String.raw`
      <h2>Tamaño de la salida</h2>
      <p>Para una entrada de lado \(n\), kernel \(k\), relleno \(p\) y paso \(s\):</p>
      \[ n_{\text{out}} = \Big\lfloor \frac{n + 2p - k}{s} \Big\rfloor + 1. \]
      <ul>
        <li><strong>«valid»</strong> (\(p=0\)): sin relleno; con \(s=1\), la salida se encoge en \(k-1\).</li>
        <li><strong>«same»</strong> (\(p=(k-1)/2\), \(k\) impar, \(s=1\)): \(n_{\text{out}}=n\). Con \(k=3\), \(p=1\); con \(k=5\), \(p=2\).</li>
        <li>Con \(s=2\) la salida mide aproximadamente la mitad por lado: una alternativa al pooling para reducir tamaño.</li>
      </ul>
      <h2>Pooling</h2>
      <p>Una ventana \(w\times w\) con paso \(w\) (sin solaparse) da</p>
      \[ y_{i,j}^{\max} = \max_{(a,c)\in\text{ventana}} x_{a,c}, \qquad y_{i,j}^{\text{avg}} = \frac{1}{w^2}\sum_{(a,c)\in\text{ventana}} x_{a,c}. \]
      <p>No tiene parámetros que aprender. El <em>max pooling</em> conserva la respuesta más fuerte (¿está el patrón en esta zona?); el <em>average pooling</em> conserva la intensidad media, y su versión global (<em>global average pooling</em>) sustituye a las capas densas finales en muchas redes modernas.</p>
      <h2>Invariancia</h2>
      <p>Si un patrón se mueve dentro de una ventana, el máximo no cambia: el pooling da invariancia local a pequeñas traslaciones. Pero un desplazamiento mayor que la ventana sí cambia la salida: la invariancia total solo se logra al apilar varias capas.</p>
      <div class="recuadro"><p>El campo receptivo de una neurona crece con cada convolución y, de forma multiplicativa, con cada reducción por paso o pooling: así, capas profundas «ven» regiones amplias de la imagen (<a href="tema.html?id=cnn">Convolutional Neural Networks</a>, figura 2).</p></div>
      <p>Las convoluciones se explican en <a href="tema.html?id=convolution-kernels">Convolution Kernels</a>.</p>`,
  });
})();
