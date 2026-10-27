(function () {
  'use strict';
  const { color: C } = VIZ;
  const I = VIZ.img;
  const N = 24;

  // Figuras de entrada dibujadas con trazos gruesos.
  const FIGURAS = [['siete', 'Un siete'], ['cruz', 'Una cruz'], ['anillo', 'Un anillo'], ['escalera', 'Una escalera']];
  function figura(tipo) {
    const im = I.crear(N, N);
    const seg = (x0, y0, x1, y1, g = 1.6) => {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
        const d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
        im.d[y * N + x] = Math.max(im.d[y * N + x], Math.max(0, Math.min(1, g + 0.5 - d)));
      }
    };
    if (tipo === 'siete') { seg(5, 5, 18, 5); seg(18, 5, 9, 20); seg(8, 12, 15, 12); }
    else if (tipo === 'cruz') { seg(5, 5, 18, 18); seg(18, 5, 5, 18); }
    else if (tipo === 'anillo') { for (let k = 0; k < 40; k++) { const a = (k / 40) * 2 * Math.PI, b = ((k + 1) / 40) * 2 * Math.PI; seg(11.5 + 7 * Math.cos(a), 11.5 + 7 * Math.sin(a), 11.5 + 7 * Math.cos(b), 11.5 + 7 * Math.sin(b), 1.2); } }
    else { seg(4, 19, 9, 19); seg(9, 19, 9, 13); seg(9, 13, 14, 13); seg(14, 13, 14, 7); seg(14, 7, 19, 7); }
    return im;
  }
  const NUCLEOS = {
    vertical: { nombre: 'Borde vertical (Sobel x)', K: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] },
    horizontal: { nombre: 'Borde horizontal (Sobel y)', K: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] },
    diagonal: { nombre: 'Diagonal', K: [[2, 1, 0], [1, 0, -1], [0, -1, -2]] },
    suavizado: { nombre: 'Promedio 3×3', K: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]] },
    realce: { nombre: 'Realce (laplaciano)', K: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  };

  /* ---------- Fig. 1: convolución, ReLU y max pooling ---------- */

  function montarCapa(cuerpo) {
    let tipo = 'siete', nucleo = 'vertical', sesgo = 0;
    let im = figura(tipo), conv = null, pos = -1;
    const M = N - 2; // salida válida 22 × 22
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen de entrada', opciones: FIGURAS, valor: tipo, alCambiar: (v) => { tipo = v; im = figura(v); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Filtro (núcleo 3×3)', opciones: Object.entries(NUCLEOS).map(([k, n]) => [k, n.nombre]), valor: nucleo, alCambiar: (v) => { nucleo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Sesgo b', min: -2, max: 2, paso: 0.1, valor: sesgo, formato: (v) => v.toFixed(1), alCambiar: (v) => { sesgo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 5, velMax: 9 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => I.paneles({ ancho: w }, 4, 1).alturaTotal });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'ventana 3×3 y la salida que produce', forma: 'linea' },
      { color: C.s1, texto: 'respuesta positiva', forma: 'cuadro' },
      { color: C.s8, texto: 'respuesta negativa (la ReLU la anula)', forma: 'cuadro' },
      { color: C.s7, texto: 'máximo elegido por el pooling', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Reproducir» o «Un paso» para ver el filtro recorrer la imagen. Con el borde vertical, el lado izquierdo de un trazo da respuesta positiva y el derecho, negativa: la ReLU solo deja pasar uno de los dos.');

    const K = () => NUCLEOS[nucleo].K;
    function iniciar() {
      conv = new Float32Array(M * M).fill(NaN); pos = -1;
      return (function* () {
        for (pos = 0; pos < M * M; pos++) {
          const x = pos % M, y = (pos / M) | 0;
          let s = sesgo;
          for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) s += K()[j][i] * im.d[(y + j) * N + x + i];
          conv[pos] = s;
          yield;
        }
        pos = -1;
      })();
    }
    function dibujar() {
      if (!conv) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const P4 = I.paneles(lienzo, 4, 1), pa = [0, 1, 2, 3].map((k) => P4.pos(k));
      let m = 1e-6;
      for (const v of conv) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
      const s1 = VIZ.rgb(C.s1), s8 = VIZ.rgb(C.s8), neu = VIZ.rgb(C.neutro);
      const colorDe = (v) => (!Number.isFinite(v) ? neu : v >= 0 ? VIZ.enRampa(v / m, [C.superficie, C.s1]) : VIZ.enRampa(-v / m, [C.superficie, C.s8]));
      I.dibujar(ctx, im, pa[0].x, pa[0].y, P4.ancho, P4.alto, { rejilla: true });
      I.rotulo(ctx, `entrada ${N}×${N}`, pa[0].x, pa[0].y);
      const mapa = { w: M, h: M, d: conv };
      I.dibujar(ctx, mapa, pa[1].x, pa[1].y, P4.ancho, P4.alto, { pixel: (i) => colorDe(conv[i]), rejilla: true });
      I.rotulo(ctx, `convolución ${M}×${M}`, pa[1].x, pa[1].y);
      I.dibujar(ctx, mapa, pa[2].x, pa[2].y, P4.ancho, P4.alto, { pixel: (i) => colorDe(Number.isFinite(conv[i]) ? Math.max(0, conv[i]) : NaN), rejilla: true });
      I.rotulo(ctx, 'ReLU: max(0, ·)', pa[2].x, pa[2].y);
      // Max pooling 2×2 con paso 2.
      const Q = M / 2, pool = new Float32Array(Q * Q), arg = new Int32Array(Q * Q).fill(-1);
      for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
        let best = NaN, bi = -1;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const k = (2 * y + j) * M + 2 * x + i, v = Math.max(0, conv[k]);
          if (Number.isFinite(conv[k]) && !(v <= best)) { best = v; bi = k; }
        }
        pool[y * Q + x] = best; arg[y * Q + x] = bi;
      }
      I.dibujar(ctx, { w: Q, h: Q, d: pool }, pa[3].x, pa[3].y, P4.ancho, P4.alto, { pixel: (i) => colorDe(pool[i]), rejilla: true });
      I.rotulo(ctx, `max pooling 2×2 → ${Q}×${Q}`, pa[3].x, pa[3].y);
      // Ventana actual.
      if (pos >= 0 && pos < M * M) {
        const x = pos % M, y = (pos / M) | 0, e = P4.ancho / N, e2 = P4.ancho / M, e3 = P4.ancho / Q;
        ctx.save();
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5;
        ctx.strokeRect(pa[0].x + x * e, pa[0].y + y * e, 3 * e, 3 * e);
        ctx.strokeRect(pa[1].x + x * e2, pa[1].y + y * e2, e2, e2);
        ctx.strokeRect(pa[2].x + x * e2, pa[2].y + y * e2, e2, e2);
        const q = (y >> 1) * Q + (x >> 1);
        ctx.strokeStyle = C.s7;
        ctx.strokeRect(pa[3].x + (x >> 1) * e3, pa[3].y + (y >> 1) * e3, e3, e3);
        if (arg[q] >= 0) ctx.strokeRect(pa[2].x + (arg[q] % M) * e2 + 1.5, pa[2].y + ((arg[q] / M) | 0) * e2 + 1.5, e2 - 3, e2 - 3);
        ctx.restore();
        const terminos = [];
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (K()[j][i]) terminos.push(`${VIZ.fmt(K()[j][i], 2)}·${im.d[(y + j) * N + x + i].toFixed(2)}`);
        registro.textContent = `Posición (${x}, ${y}): ${terminos.join(' + ')} + ${sesgo.toFixed(1)} = ${conv[pos].toFixed(3)}`;
      } else registro.textContent = pos < 0 && Number.isFinite(conv[0]) ? 'Mapa completo: el mismo filtro de 9 pesos se aplicó en las 484 posiciones.' : 'El filtro recorre la imagen de izquierda a derecha y de arriba abajo.';
      const calc = [...conv].filter(Number.isFinite);
      lectura.set([
        ['posiciones calculadas', `${calc.length} de ${M * M}`],
        ['respuesta máx. / mín.', calc.length ? `${Math.max(...calc).toFixed(2)} / ${Math.min(...calc).toFixed(2)}` : '—'],
        ['activas tras la ReLU', calc.length ? `${((100 * calc.filter((v) => v > 0).length) / calc.length).toFixed(0)} %` : '—'],
        ['pesos del filtro', '9 + 1 sesgo'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    // Se muestra el resultado completo; «Reproducir» vuelve a recorrer la imagen desde el principio.
    rep.reiniciar();
    while (rep.paso());
    dibujar();
  }

  /* ---------- Fig. 2: campo receptivo ---------- */

  function montarCampo(cuerpo) {
    let capas = 4, k = 3, pooling = true, dilatacion = false, sel = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capas convolucionales', min: 1, max: 6, valor: capas, alCambiar: (v) => { capas = v; sel = null; lienzo.ajustar(true); } });
    ctl.selector({ etiqueta: 'Tamaño del filtro', opciones: [['3', '3'], ['5', '5']], valor: '3', alCambiar: (v) => { k = +v; sel = null; lienzo.ajustar(true); } });
    ctl.casilla({ etiqueta: 'max pooling 2×2 después de cada 2 capas', valor: pooling, alCambiar: (v) => { pooling = v; sel = null; lienzo.ajustar(true); } });
    ctl.casilla({ etiqueta: 'convolución dilatada (×2 por capa)', valor: dilatacion, alCambiar: (v) => { dilatacion = v; sel = null; lienzo.ajustar(true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 30 + 46 * estructura().filas.length });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'unidad elegida', forma: 'punto' },
      { color: C.s1, texto: 'unidades de las que depende (campo receptivo)', forma: 'punto' },
      { color: C.inactivo, texto: 'otras unidades', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Corte de una dimensión de la red: cada fila es una capa. Haga clic en una unidad de cualquier capa para ver de qué entradas depende. El pooling y la dilatación hacen crecer el campo receptivo mucho más rápido que apilar filtros.');

    // Capas como lista de operaciones { tipo, k, s, d }. La posición de cada unidad se mide en píxeles de entrada.
    function arquitectura() {
      const ops = [];
      for (let l = 0; l < capas; l++) {
        ops.push({ tipo: 'conv', k, s: 1, d: dilatacion ? 2 ** l : 1, nombre: `conv ${l + 1}` });
        if (pooling && l % 2 === 1) ops.push({ tipo: 'pool', k: 2, s: 2, d: 1, nombre: 'pool' });
      }
      return ops;
    }
    function estructura() {
      const ops = arquitectura(), Nin = 40;
      // Para cada capa: salto j (distancia entre unidades en píxeles de entrada) y desplazamiento del primer centro.
      const filas = [{ nombre: 'entrada', n: Nin, j: 1, inicio: 0 }];
      let r = 1;
      const campos = [1];
      for (const op of ops) {
        const prev = filas[filas.length - 1], ext = (op.k - 1) * op.d;
        const n = Math.floor((prev.n - ext - 1) / op.s) + 1;
        if (n < 1) break;
        r += ext * prev.j;
        campos.push(r);
        filas.push({ nombre: op.nombre, n, j: prev.j * op.s, inicio: prev.inicio + (ext * prev.j) / 2, op });
      }
      return { filas, campos, Nin };
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho } = lienzo;
      lienzo.limpiar();
      const { filas, campos, Nin } = estructura();
      const izq = 70, w = ancho - izq - 10, dx = w / Nin, dy = 46, y0 = 30;
      const yFila = (l) => y0 + (filas.length - 1 - l) * dy;
      const xU = (l, u) => izq + (filas[l].inicio + u * filas[l].j + 0.5) * dx;
      if (!sel || sel.l >= filas.length || sel.u >= filas[sel.l].n) sel = { l: filas.length - 1, u: Math.floor((filas[filas.length - 1].n - 1) / 2) };
      // Campo receptivo: conjunto de unidades de cada capa inferior de las que depende la elegida.
      const dep = filas.map(() => new Set());
      dep[sel.l].add(sel.u);
      for (let l = sel.l; l > 0; l--) {
        const op = filas[l].op;
        for (const u of dep[l]) for (let t = 0; t < op.k; t++) dep[l - 1].add(u * op.s + t * op.d);
      }
      ctx.save();
      // Conexiones de la unidad elegida hacia abajo.
      ctx.strokeStyle = VIZ.alfa(C.s1, 0.35);
      ctx.lineWidth = 1;
      for (let l = sel.l; l > 0; l--) {
        const op = filas[l].op;
        for (const u of dep[l]) for (let t = 0; t < op.k; t++) {
          ctx.beginPath(); ctx.moveTo(xU(l, u), yFila(l)); ctx.lineTo(xU(l - 1, u * op.s + t * op.d), yFila(l - 1)); ctx.stroke();
        }
      }
      const rr = Math.max(2, Math.min(6, dx * 0.35));
      filas.forEach((f, l) => {
        ctx.fillStyle = C.tinta2;
        ctx.font = VIZ.fuente(11);
        ctx.textBaseline = 'middle';
        ctx.fillText(f.nombre, 4, yFila(l));
        for (let u = 0; u < f.n; u++) {
          const elegido = l === sel.l && u === sel.u, en = dep[l].has(u);
          ctx.fillStyle = elegido ? C.s2 : en ? C.s1 : C.superficie;
          ctx.strokeStyle = elegido ? C.s2 : en ? C.s1 : C.inactivo;
          ctx.beginPath();
          if (f.op && f.op.tipo === 'pool') ctx.rect(xU(l, u) - rr, yFila(l) - rr, 2 * rr, 2 * rr); else ctx.arc(xU(l, u), yFila(l), rr, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
      });
      ctx.restore();
      geo = { filas, xU, yFila, rr };
      lectura.set([
        ['capas (con pooling)', String(filas.length - 1)],
        ['campo receptivo de la última capa', `${campos[filas.length - 1]} píxeles`],
        ['campo de la unidad elegida', `${dep[0].size} píxeles`],
        ['salto entre unidades vecinas', `${filas[filas.length - 1].j} píxeles`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      geo.filas.forEach((f, l) => {
        if (Math.abs(y - geo.yFila(l)) > 12) return;
        for (let u = 0; u < f.n; u++) if (Math.abs(x - geo.xU(l, u)) <= Math.max(6, geo.rr + 2)) { sel = { l, u }; dibujar(); }
      });
    });
    dibujar();
  }

  VIZ.registrarTema('cnn', {
    intro: String.raw`
      <p>Una <strong>red convolucional</strong> (CNN) es una red neuronal diseñada para imágenes. En vez de conectar cada neurona con
      todos los píxeles, usa <strong>filtros</strong> pequeños que se deslizan por la imagen: el mismo conjunto de pesos detecta un borde
      o una textura en cualquier posición. Eso reduce los parámetros en órdenes de magnitud y hace que la red sea naturalmente
      robusta a traslaciones.</p>
      <p>Una capa típica aplica muchos filtros (convolución), una no linealidad (ReLU) y un submuestreo (<em>max pooling</em>). Apilando
      capas, cada unidad «ve» una zona cada vez mayor de la imagen —su <strong>campo receptivo</strong>— y responde a patrones cada vez
      más complejos: bordes, después texturas, después partes de objetos.</p>`,
    visualizaciones: [
      {
        titulo: 'Convolución, ReLU y max pooling',
        descripcion: 'Un filtro 3×3 recorre la imagen y produce un mapa de características; la ReLU se queda con la parte positiva y el pooling resume cada bloque 2×2 en su máximo.',
        montar: montarCapa,
      },
      {
        titulo: 'El campo receptivo',
        descripcion: 'De qué píxeles de la entrada depende una unidad de cada capa, según el tamaño del filtro, el pooling y la dilatación.',
        montar: montarCampo,
      },
    ],
    teoria: String.raw`
      <h2>Convolución</h2>
      <p>Una capa convolucional con \(C_{\text{in}}\) canales de entrada y \(C_{\text{out}}\) filtros de \(k \times k\) calcula</p>
      \[ y_{c}(i, j) = b_c + \sum_{c'=1}^{C_{\text{in}}} \sum_{u=0}^{k-1}\sum_{v=0}^{k-1} W_{c, c'}(u, v)\; x_{c'}(i\,s + u\,d,\; j\,s + v\,d), \]
      <p>con paso (<em>stride</em>) \(s\) y dilatación \(d\). Estrictamente es una correlación cruzada (el filtro no se invierte), pero como los
      pesos se aprenden, da lo mismo. Sin relleno, una entrada de \(n \times n\) da una salida de
      \(\lfloor (n - d(k-1) - 1)/s \rfloor + 1\) por lado.</p>
      <h2>Parámetros: conexión local y pesos compartidos</h2>
      <p>La capa tiene \(C_{\text{out}}(C_{\text{in}} k^2 + 1)\) parámetros, sin importar el tamaño de la imagen. Una capa totalmente
      conectada de una imagen de \(224 \times 224 \times 3\) a 64 mapas del mismo tamaño necesitaría unos \(4{,}8 \cdot 10^{14}\) pesos; la
      convolución \(3 \times 3\) equivalente usa 1 792.</p>
      <h2>Pooling</h2>
      <p>El <em>max pooling</em> \(2 \times 2\) con paso 2 se queda con el máximo de cada bloque: reduce la resolución a la mitad, da algo de
      tolerancia a pequeños desplazamientos y duplica el salto entre unidades vecinas. En la retropropagación, el gradiente solo pasa
      por la posición que fue el máximo.</p>
      <h2>Campo receptivo</h2>
      <p>Si \(r_l\) es el campo receptivo de la capa \(l\) y \(j_l\) el salto entre unidades vecinas, medidos en píxeles de entrada:</p>
      \[ r_l = r_{l-1} + (k_l - 1)\, d_l\, j_{l-1}, \qquad j_l = j_{l-1}\, s_l, \qquad r_0 = j_0 = 1. \]
      <p>Apilar filtros \(3 \times 3\) sin submuestreo lo hace crecer de a 2 píxeles por capa; el pooling multiplica el salto y con él todo el
      crecimiento posterior, y la dilatación \(d_l = 2^l\) lo hace crecer exponencialmente sin perder resolución. Dos capas \(3 \times 3\) cubren lo
      mismo que una \(5 \times 5\) con menos pesos (\(2 \cdot 9\) frente a 25) y una no linealidad más: es la idea de la red VGG.</p>
      <h2>Arquitectura típica</h2>
      <pre><code>imagen → [conv 3×3 → ReLU → conv 3×3 → ReLU → max pool 2×2] × B
       → capas totalmente conectadas (o promedio global) → softmax</code></pre>
      <p>LeNet (1998) reconocía dígitos con dos bloques; AlexNet (2012) ganó ImageNet con cinco capas convolucionales y GPU; ResNet (2015)
      llegó a 152 capas gracias a las conexiones residuales. Las capas finales se pueden reutilizar como descriptor de la imagen, en
      lugar de una <a href="tema.html?id=bag-of-words">bolsa de palabras visuales</a>; es lo que hace <a href="tema.html?id=deepface">DeepFace</a>
      con los rostros.</p>`,
  });
})();
