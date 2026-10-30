(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: un kernel recorre la imagen ---------- */

  function montarRecorrido(cuerpo) {
    let img = 'cuadro', ker = 'vertical', k = DL.KERNELS.vertical.k.map((f) => f.slice()), salida = [], pos = [-1, -1], msg = '', geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: DL.NOMBRES_IMAGEN, valor: img, alCambiar: (v) => { img = v; rep.reiniciar(); } });
    const selK = ctl.selector({ etiqueta: 'Kernel', opciones: [...Object.entries(DL.KERNELS).map(([c, v]) => [c, v.nombre]), ['propio', 'propio (edítelo)']], valor: ker, alCambiar: (v) => { ker = v; if (DL.KERNELS[v]) k = DL.KERNELS[v].k.map((f) => f.slice()); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 8 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(26, (w - 60) / 28) * 12 + 44) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo del kernel / de la salida', forma: 'cuadro' }, { color: C.s2, texto: 'ventana actual', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El kernel (centro) se desliza sobre la imagen; en cada posición se multiplica casilla a casilla y se suma: ese número es un píxel del mapa de características (derecha). Haga clic en una casilla del kernel para cambiar su valor.');
    function iniciar() {
      const I = DL.IMAGENES[img], H = I.length - 2;
      salida = Array.from({ length: H }, () => new Array(H).fill(null));
      pos = [-1, -1]; msg = 'Pulse «Un paso» o Reproducir para deslizar el kernel.';
      return (function* () {
        for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) {
          pos = [i, j];
          let s = 0; const t = [];
          for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const v = I[i + a][j + c] * k[a][c]; s += v; if (I[i + a][j + c] !== 0 && k[a][c] !== 0) t.push(`${I[i + a][j + c]}·${f2(k[a][c])}`); }
          salida[i][j] = s;
          msg = `Posición (${i + 1}, ${j + 1}): ${t.length ? t.join(' + ') : '0'} = ${f2(s)}.`;
          yield;
        }
        pos = [-1, -1];
      })();
    }
    function dibujar() {
      if (!salida.length) return;
      const { ctx, ancho: W } = lienzo, c = Math.min(26, (W - 60) / 28), I = DL.IMAGENES[img], y0 = 28;
      lienzo.limpiar();
      const xi = 8, xk = xi + 12 * c + 22, xo = xk + 6 * c + 22;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText('Imagen 12×12', xi, 4); ctx.fillText('Kernel 3×3', xk, 4); ctx.fillText('Mapa 10×10', xo, 4);
      DL.mapa(ctx, I, xi, y0, 12 * c, 12 * c, { min: 0, max: 1, gris: true });
      DL.mapa(ctx, k, xk, y0 + 3 * c, 6 * c, 6 * c, { divergente: true, max: 2, min: -2, valores: (v) => f2(v) });
      const vals = salida.map((f) => f.map((v) => (v == null ? 0 : v)));
      const mx = Math.max(1, ...vals.flat().map(Math.abs));
      DL.mapa(ctx, vals, xo, y0, 10 * c, 10 * c, { divergente: true, min: -mx, max: mx });
      ctx.fillStyle = VIZ.alfa(C.superficie, 0.85);
      salida.forEach((f, i) => f.forEach((v, j) => { if (v == null) ctx.fillRect(xo + j * c + 1, y0 + i * c + 1, c - 2, c - 2); }));
      if (pos[0] >= 0) {
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5;
        ctx.strokeRect(xi + pos[1] * c, y0 + pos[0] * c, 3 * c, 3 * c);
        ctx.strokeRect(xo + pos[1] * c, y0 + pos[0] * c, c, c);
      }
      geo = { xk, y0: y0 + 3 * c, c2: 2 * c, xo, xi, y0m: y0, c };
      registro.textContent = msg;
      const hecho = salida.flat().filter((v) => v != null).length;
      lectura.set([['posiciones calculadas', `${hecho} de 100`], ['suma del kernel', f2(k.flat().reduce((s, v) => s + v, 0))], ['parámetros del filtro', '9 (+1 sesgo)'], ['conexiones sin compartir pesos', VIZ.entero(100 * 9)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const j = Math.floor((x - geo.xk) / geo.c2), i = Math.floor((y - geo.y0) / geo.c2);
      if (i < 0 || i > 2 || j < 0 || j > 2) return;
      const ciclo = [-2, -1, 0, 1, 2];
      k[i][j] = ciclo[(ciclo.indexOf(Math.round(k[i][j])) + 1 + 5) % 5] ?? 1;
      ker = 'propio'; selK.valor = 'propio'; rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return tip.ocultar();
      const j = Math.floor((x - geo.xo) / geo.c), i = Math.floor((y - geo.y0m) / geo.c);
      if (i >= 0 && i < 10 && j >= 0 && j < 10 && salida[i] && salida[i][j] != null) tip.mostrar(x, y, `salida (${i + 1}, ${j + 1}) = <b>${f2(salida[i][j])}</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: un banco de filtros ---------- */

  function montarBanco(cuerpo) {
    let img = 'cruz', relu = true, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: DL.NOMBRES_IMAGEN, valor: img, alCambiar: (v) => { img = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Aplicar ReLU a cada mapa', valor: relu, alCambiar: (v) => { relu = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 230 : 380) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'respuesta positiva', forma: 'cuadro' }, { color: C.s2, texto: 'respuesta negativa (se anula con ReLU)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cada filtro responde a un patrón distinto: el borde vertical se enciende en los trazos verticales y calla en los horizontales. Una capa convolucional aplica muchos filtros a la vez y apila sus mapas.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, I = DL.IMAGENES[img], nombres = Object.keys(DL.KERNELS), cols = W > 640 ? 6 : 3, c = Math.min(11, (W - 20 - (cols - 1) * 10) / (cols * 10));
      lienzo.limpiar();
      geo = [];
      nombres.forEach((n, q) => {
        const col = q % cols, fila = Math.floor(q / cols), x = 10 + col * (10 * c + 10), y = 10 + fila * (10 * c + 40);
        let m = DL.convolucion(I, DL.KERNELS[n].k);
        if (relu) m = DL.relu(m);
        const mx = Math.max(0.5, ...m.flat().map(Math.abs));
        DL.mapa(ctx, m, x, y + 14, 10 * c, 10 * c, { divergente: true, min: -mx, max: mx });
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(DL.KERNELS[n].nombre, x, y);
        geo.push({ x, y: y + 14, c, m, n });
      });
      registro.textContent = `Seis filtros sobre la misma imagen producen seis mapas de 10×10; con ReLU solo quedan las respuestas positivas.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x < q.x + 10 * q.c && y >= q.y && y < q.y + 10 * q.c);
      if (!g) return tip.ocultar();
      const j = Math.floor((x - g.x) / g.c), i = Math.floor((y - g.y) / g.c);
      tip.mostrar(x, y, `${DL.KERNELS[g.n].nombre}<br>posición (${i + 1}, ${j + 1}): <b>${f2(g.m[i][j])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('convolution-kernels', {
    intro: String.raw`
      <p>En una imagen, un píxel importa por el vecindario que lo rodea. La <strong>convolución</strong> aprovecha esto: un pequeño <em>kernel</em> (o <em>filtro</em>) de pesos se desliza por toda la imagen y, en cada posición, calcula una suma ponderada de los píxeles que cubre.
      El resultado es un <strong>mapa de características</strong> (<em>feature map</em>) que indica dónde aparece el patrón que el kernel detecta: un borde, una esquina, una textura.</p>
      <p>Dos ideas hacen eficientes a las redes convolucionales: el mismo kernel se reutiliza en todas las posiciones (<em>pesos compartidos</em>) y cada neurona solo mira un vecindario pequeño (<em>conexión local</em>). Y los pesos de los kernels no se diseñan: se aprenden.</p>`,
    visualizaciones: [
      { titulo: 'Un kernel recorre la imagen', descripcion: 'Avance con «Un paso» y siga la suma ponderada. Pruebe «borde vertical» sobre el cuadrado y edite el kernel haciendo clic en sus casillas.', montar: montarRecorrido },
      { titulo: 'Un banco de filtros', descripcion: 'Seis filtros sobre la misma imagen. Cambie de imagen y compruebe qué filtro responde a qué orientación.', montar: montarBanco },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Para una imagen \(X\) y un kernel \(K\) de tamaño \(k\times k\), la salida (que las bibliotecas llaman «convolución», aunque es una <em>correlación cruzada</em>) es</p>
      \[ Y_{i,j} = b + \sum_{a=0}^{k-1}\sum_{c=0}^{k-1} K_{a,c}\; X_{i+a,\,j+c}. \]
      <p>Con una imagen de entrada con \(C_{\text{in}}\) canales (por ejemplo RGB) el kernel es un bloque \(k\times k\times C_{\text{in}}\), y una capa con \(C_{\text{out}}\) filtros produce \(C_{\text{out}}\) mapas.</p>
      <h2>Cuántos parámetros</h2>
      \[ P = C_{\text{out}}\,(k^2\,C_{\text{in}} + 1). \]
      <p>Una capa con 64 filtros de \(3\times3\) sobre una imagen RGB tiene solo \(64\,(27+1)=1\,792\) parámetros, sin importar el tamaño de la imagen. Una capa densa que conectara una imagen de \(224\times224\times3\) con 64 neuronas necesitaría más de 9 millones.</p>
      <h2>Propiedades</h2>
      <ul>
        <li><strong>Equivarianza a traslaciones:</strong> si el patrón se desplaza, su respuesta en el mapa se desplaza igual.</li>
        <li><strong>Jerarquía:</strong> los primeros kernels aprenden bordes y colores; los siguientes combinan esas respuestas en esquinas, texturas y partes de objetos (<a href="tema.html?id=activation-maps">Activation Maps</a>).</li>
      </ul>
      <div class="recuadro"><p>Los kernels de la figura (Sobel, desenfoque, nitidez) son clásicos del procesamiento de imágenes, diseñados a mano. En una CNN, los pesos de cada kernel son parámetros que se entrenan por <a href="tema.html?id=backpropagation">retropropagación</a>. Véase también <a href="tema.html?id=cnn">Convolutional Neural Networks</a>.</p></div>`,
  });
})();
