(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = 64, H = 40;

  function imagenDe(modo, semilla, ruido) {
    if (modo === 'binaria') return VIZ.img.formas(W, H, semilla, { granos: 14 });
    if (modo === 'color') return VIZ.img.escenaColor(W, H, semilla, { ruido: ruido * 0.6, gradiente: 0.2 });
    return VIZ.img.escena('monedas', W, H, semilla, { ruido, iluminacion: 0.6, contraste: 0.4 });
  }
  const canales = (im, i) => (im.c === 3 ? [im.d[3 * i], im.d[3 * i + 1], im.d[3 * i + 2]] : [im.d[i]]);
  const distancia = (a, b) => Math.sqrt(a.reduce((s, v, k) => s + (v - b[k]) ** 2, 0));
  const VECINOS = { 4: [[1, 0], [-1, 0], [0, 1], [0, -1]], 8: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] };

  // Crecimiento por recorrido en anchura. estado: 0 sin ver, 1 región, 2 región en la cola, 3 rechazado.
  function* crecer(im, s, op, est) {
    const { tau, criterio, vecindad } = op, cola = [s];
    const ref = canales(im, s), suma = ref.slice();
    let n = 1, cabeza = 0;
    est.estado[s] = 2;
    est.media = ref.slice();
    while (cabeza < cola.length) {
      const i = cola[cabeza++], x = i % W, y = (i / W) | 0;
      est.actual = i;
      est.estado[i] = 1;
      let aceptados = 0, rechazados = 0;
      for (const [dx, dy] of VECINOS[vecindad]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (est.estado[j] === 1 || est.estado[j] === 2) continue;
        const v = canales(im, j), d = distancia(v, criterio === 'media' ? est.media : ref);
        if (d <= tau) {
          est.estado[j] = 2; cola.push(j); aceptados++;
          n++; v.forEach((c, k) => { suma[k] += c; });
          est.media = suma.map((c) => c / n);
        } else { est.estado[j] = 3; rechazados++; }
      }
      est.n = n;
      est.cola = cola.length - cabeza;
      est.mensaje = `Píxel (${x}, ${y}): ${aceptados} vecino${aceptados === 1 ? '' : 's'} aceptado${aceptados === 1 ? '' : 's'}, ${rechazados} rechazado${rechazados === 1 ? '' : 's'} (distancia > τ).`;
      yield;
    }
    est.actual = -1;
    est.mensaje = `La cola se vació: la región tiene ${n} píxeles.`;
  }

  // Color base de un píxel: binaria en tinta/superficie, grises y color tal cual.
  function base(im, modo, i) {
    if (modo === 'binaria') return im.d[i] > 0.5 ? VIZ.rgb(C.tinta) : VIZ.rgb(C.superficie);
    if (im.c === 3) return [im.d[3 * i] * 255, im.d[3 * i + 1] * 255, im.d[3 * i + 2] * 255];
    return [im.d[i] * 255, im.d[i] * 255, im.d[i] * 255];
  }
  const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* ---------- Fig. 1: crecimiento desde una semilla ---------- */

  function montarSemilla(cuerpo) {
    let modo = 'grises', semilla = 4, ruido = 0.05, tau = 0.12, criterio = 'semilla', vecindad = 4, s0 = null;
    let im = null, est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: [['binaria', 'Binaria'], ['grises', 'Tonos de gris'], ['color', 'Color']], valor: modo,
      alCambiar: (v) => { modo = v; tau = v === 'binaria' ? 0.5 : v === 'color' ? 0.2 : 0.12; rTau.valor = tau; nueva(); } });
    const rTau = ctl.rango({ etiqueta: 'Tolerancia τ', min: 0.01, max: 0.6, paso: 0.01, valor: tau, formato: (v) => v.toFixed(2), alCambiar: (v) => { tau = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Comparar con', opciones: [['semilla', 'el valor de la semilla'], ['media', 'la media de la región']], valor: criterio,
      alCambiar: (v) => { criterio = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Vecindad', opciones: [['4', '4 vecinos'], ['8', '8 vecinos']], valor: '4', alCambiar: (v) => { vecindad = +v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.15, paso: 0.01, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; nueva(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 6, velMax: 10 });
    ctl.boton('Nueva imagen', () => { semilla++; nueva(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(440, Math.round((w * H) / W)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región' },
      { color: C.s4, texto: 'en la cola (frontera)' },
      { color: C.s2, texto: 'píxel que se expande' },
      { color: C.s8, texto: 'vecino rechazado' },
      { color: C.s6, texto: 'semilla', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la imagen para poner la semilla. Con ruido alto, compare «el valor de la semilla» con «la media de la región»: la media depende menos de que la semilla haya caído en un píxel atípico.');

    function nueva() {
      im = imagenDe(modo, semilla, ruido);
      // Semilla inicial: el centro del primer objeto de la escena (o el centro de la imagen).
      const o = im.objetos && im.objetos[0];
      s0 = o ? Math.floor(o.y) * W + Math.floor(o.x) : 7 * W + 8;
      rep.reiniciar();
    }
    function iniciar() {
      est = { estado: new Int8Array(W * H), actual: -1, n: 0, cola: 0, media: [0], mensaje: '' };
      const g = crecer(im, s0, { tau, criterio, vecindad }, est);
      est.mensaje = `Semilla en (${s0 % W}, ${(s0 / W) | 0}). Se compara cada vecino con ${criterio === 'media' ? 'la media de la región' : 'el valor de la semilla'}.`;
      return g;
    }

    let geo = null;
    function dibujar() {
      if (!im || !est) return;
      const { ctx, ancho, alto } = lienzo;
      lienzo.limpiar();
      const esc = Math.min(ancho / W, alto / H), w = esc * W, h = esc * H, x0 = (ancho - w) / 2;
      geo = { x0, esc };
      const cS1 = VIZ.rgb(C.s1), cS4 = VIZ.rgb(C.s4), cS2 = VIZ.rgb(C.s2), cS8 = VIZ.rgb(C.s8);
      VIZ.img.dibujar(ctx, im, x0, 0, w, h, {
        rejilla: true,
        pixel: (i) => {
          const b = base(im, modo, i), e = est.estado[i];
          if (i === est.actual) return cS2;
          if (e === 1) return mezclar(b, cS1, 0.6);
          if (e === 2) return cS4;
          if (e === 3) return mezclar(b, cS8, 0.55);
          return b;
        },
      });
      const sx = x0 + ((s0 % W) + 0.5) * esc, sy = (((s0 / W) | 0) + 0.5) * esc;
      VIZ.marcador(ctx, sx, sy, C.s6, Math.max(4, esc * 0.45));
      registro.textContent = est.mensaje;
      const m = est.media.map((v) => v.toFixed(2)).join(', ');
      lectura.set([
        ['píxeles en la región', String(est.n)],
        ['en la cola', String(est.cola)],
        ['rechazados', String(est.estado.reduce((s, e) => s + (e === 3 ? 1 : 0), 0))],
        ['media de la región', est.media.length > 1 ? `(${m})` : m],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const pixelBajo = (ev) => {
      if (!geo) return -1;
      const { x, y } = lienzo.posicion(ev);
      const i = Math.floor((x - geo.x0) / geo.esc), j = Math.floor(y / geo.esc);
      return i >= 0 && j >= 0 && i < W && j < H ? j * W + i : -1;
    };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => { const i = pixelBajo(ev); if (i >= 0) { s0 = i; rep.reiniciar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = pixelBajo(ev);
      if (i < 0) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      const v = canales(im, i), d = distancia(v, criterio === 'media' ? est.media : canales(im, s0));
      tip.mostrar(x, y, `píxel <b>(${i % W}, ${(i / W) | 0})</b><br>valor <b>${v.map((c) => c.toFixed(2)).join(', ')}</b><br>distancia <b>${d.toFixed(3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nueva();
  }

  /* ---------- Fig. 2: segmentar toda la imagen ---------- */

  function montarCompleta(cuerpo) {
    let modo = 'color', semilla = 4, tau = 0.15, minimo = 8;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: [['grises', 'Tonos de gris'], ['color', 'Color']], valor: modo, alCambiar: (v) => { modo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Tolerancia τ', min: 0.02, max: 0.5, paso: 0.01, valor: tau, formato: (v) => v.toFixed(2), alCambiar: (v) => { tau = v; calcular(); } });
    ctl.rango({ etiqueta: 'Región mínima (px)', min: 1, max: 40, valor: minimo, alCambiar: (v) => { minimo = v; calcular(); } });
    ctl.boton('Nueva imagen', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => VIZ.img.paneles({ ancho: w }, 2, W / H).alturaTotal });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'borde entre regiones' },
      { color: C.inactivo, texto: 'regiones menores que el mínimo' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada región se pinta con su color medio. Con τ pequeño la imagen se fragmenta en muchas regiones (sobresegmentación); con τ grande, regiones distintas se funden (subsegmentación). Pase el cursor para ver la región.');

    let im = null, etiqueta = null, medias = [], tamanos = [], geo = null;
    function calcular() {
      im = imagenDe(modo, semilla, 0.05);
      etiqueta = new Int32Array(W * H).fill(-1);
      medias = []; tamanos = [];
      for (let s = 0; s < W * H; s++) {
        if (etiqueta[s] >= 0) continue;
        const est = { estado: new Int8Array(W * H), media: [] };
        // Los píxeles ya etiquetados cuentan como región ajena: se marcan para que no se recorran.
        for (let i = 0; i < W * H; i++) if (etiqueta[i] >= 0) est.estado[i] = 1;
        const antes = est.estado.slice();
        for (const _ of crecer(im, s, { tau, criterio: 'media', vecindad: 4 }, est));
        const k = medias.length;
        let n = 0;
        for (let i = 0; i < W * H; i++) if (est.estado[i] === 1 && !antes[i]) { etiqueta[i] = k; n++; }
        medias.push(est.media); tamanos.push(n);
      }
      dibujar();
    }
    function dibujar() {
      if (!im) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const P = VIZ.img.paneles(lienzo, 2, W / H), a = P.pos(0), b = P.pos(1);
      geo = { P, b };
      VIZ.img.dibujar(ctx, im, a.x, a.y, P.ancho, P.alto);
      VIZ.img.rotulo(ctx, 'imagen original', a.x, a.y);
      const cBorde = VIZ.rgb(C.tinta), cIn = VIZ.rgb(C.inactivo);
      VIZ.img.dibujar(ctx, im, b.x, b.y, P.ancho, P.alto, {
        pixel: (i) => {
          const k = etiqueta[i], x = i % W, y = (i / W) | 0;
          if ((x + 1 < W && etiqueta[i + 1] !== k) || (y + 1 < H && etiqueta[i + W] !== k)) return cBorde;
          if (tamanos[k] < minimo) return cIn;
          const m = medias[k];
          return m.length === 3 ? m.map((v) => v * 255) : [m[0] * 255, m[0] * 255, m[0] * 255];
        },
      });
      const grandes = tamanos.filter((t) => t >= minimo).length;
      VIZ.img.rotulo(ctx, `${grandes} regiones con al menos ${minimo} px`, b.x, b.y);
      lectura.set([
        ['tolerancia', tau.toFixed(2)],
        ['regiones totales', String(tamanos.length)],
        [`regiones ≥ ${minimo} px`, String(grandes)],
        ['región más grande', `${Math.max(...tamanos)} px`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), { P, b } = geo;
      let ok = false;
      for (const q of [P.pos(0), b]) {
        const i = Math.floor(((x - q.x) / P.ancho) * W), j = Math.floor(((y - q.y) / P.alto) * H);
        if (i >= 0 && j >= 0 && i < W && j < H) {
          const k = etiqueta[j * W + i];
          tip.mostrar(x, y, `región <b>${k + 1}</b><br>tamaño <b>${tamanos[k]} px</b><br>media <b>${medias[k].map((v) => v.toFixed(2)).join(', ')}</b>`);
          ok = true;
        }
      }
      if (!ok) tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('region-growing', {
    intro: String.raw`
      <p>El <strong>crecimiento de regiones</strong> segmenta a partir de una <em>semilla</em>: un píxel que con seguridad
      pertenece al objeto. La región se extiende a los vecinos que se le parecen, y a los vecinos de esos, hasta que
      ningún píxel del borde cumple el criterio.</p>
      <p>A diferencia de un <a href="tema.html?id=otsu">umbral global</a>, el resultado es siempre una región
      <strong>conexa</strong> y el criterio puede ser local: sirve en imágenes binarias, en tonos de gris y en color, con solo cambiar
      la medida de parecido.</p>`,
    visualizaciones: [
      {
        titulo: 'Crecimiento desde una semilla',
        descripcion: 'Cada paso saca un píxel de la cola y examina sus vecinos. Pruebe la misma semilla con tolerancias distintas y con los dos criterios de comparación.',
        montar: montarSemilla,
      },
      {
        titulo: 'Segmentar toda la imagen',
        descripcion: 'Se pone una semilla en el primer píxel sin región, se hace crecer, y se repite hasta cubrir la imagen. Mueva τ para pasar de sobresegmentar a subsegmentar.',
        montar: montarCompleta,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Dada una imagen \(I\), una semilla \(s\) y un predicado de homogeneidad \(P\), la región \(R\) es el mayor conjunto
      conexo que contiene a \(s\) y en el que cada píxel cumple \(P\). Los predicados habituales comparan el valor \(I(p)\)
      de un candidato con una referencia:</p>
      <table>
        <tr><th>Imagen</th><th>Valor \(I(p)\)</th><th>Criterio \(P(p)\)</th></tr>
        <tr><td>binaria</td><td>\(\{0, 1\}\)</td><td>\(I(p) = I(s)\): equivale a la componente conexa de la semilla</td></tr>
        <tr><td>tonos de gris</td><td>\([0, 1]\)</td><td>\(|I(p) - r| \le \tau\)</td></tr>
        <tr><td>color</td><td>\((R, G, B)\)</td><td>\(\lVert I(p) - r \rVert_2 \le \tau\) (o en un espacio como \(L^*a^*b^*\))</td></tr>
      </table>
      <p>La referencia \(r\) puede ser el valor de la semilla, \(r = I(s)\), o la media de la región, \(r = \bar I_R\), que se
      actualiza a medida que crece. La media es más robusta al ruido de la semilla, pero permite que la región «derive»
      lentamente a través de un borde difuso.</p>
      <h2>Algoritmo</h2>
      <pre><code>R ← {s};  cola ← [s];  suma ← I(s);  n ← 1
mientras cola no vacía:
    p ← sacar(cola)
    para cada vecino q de p (4 u 8) con q ∉ R:
        si ‖I(q) − r‖ ≤ τ:
            R ← R ∪ {q};  meter(cola, q)
            suma ← suma + I(q);  n ← n + 1;  r ← suma / n   (si r es la media)
devolver R</code></pre>
      <p>Es un recorrido en anchura (<a href="tema.html?id=bfs-dijkstra">BFS</a>) sobre el grafo de píxeles, donde una arista
      existe solo si el vecino cumple el criterio. Cada píxel entra a la cola a lo sumo una vez, así que el costo es
      \(O(|R|)\) evaluaciones del criterio, como máximo \(O(N)\).</p>
      <h2>Conectividad</h2>
      <p>Con vecindad 4, dos píxeles que solo se tocan por una esquina quedan en regiones distintas; con vecindad 8, una
      línea diagonal de un píxel de grosor basta para conectar dos regiones, y una región puede «escaparse» por ella.</p>
      <h2>Segmentación completa</h2>
      <p>Repetir el crecimiento desde el primer píxel sin etiquetar produce una partición de la imagen. El resultado
      depende del orden de las semillas y de \(\tau\): la variante <em>split and merge</em> divide la imagen en cuadrantes
      no homogéneos y luego fusiona vecinos parecidos, y los métodos de cuenca (<em>watershed</em>) hacen crecer todas las
      semillas a la vez en orden de intensidad. Las regiones pequeñas se eliminan después con
      <a href="tema.html?id=morfologia">limpieza morfológica</a>.</p>`,
  });
})();
