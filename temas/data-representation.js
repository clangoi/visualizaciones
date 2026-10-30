(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'y', 'en', 'un', 'una', 'que', 'a', 'al', 'es', 'se', 'por', 'con', 'para', 'su', 'lo']);
  const palabras = (t, quitar) => (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-zñ]+/g) || []).filter((w) => !quitar || !VACIAS.has(w));

  /* ---------- Fig. 1: texto → matriz documento-término ---------- */

  function montarTexto(cuerpo) {
    const docs = ['El perro persigue al gato en el patio', 'El gato duerme en el sofá y el perro también', 'La bolsa sube y el dólar baja en el mercado'];
    let quitar = true, binario = false;
    const ctl = VIZ.controles(cuerpo);
    docs.forEach((d, i) => ctl.texto({ etiqueta: `Documento ${i + 1}`, valor: d, alCambiar: (v) => { docs[i] = v; dibujar(); }, alEnter: (v) => { docs[i] = v; dibujar(); } }));
    ctl.casilla({ etiqueta: 'quitar palabras vacías', valor: quitar, alCambiar: (v) => { quitar = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'presencia (0/1) en vez de conteo', valor: binario, alCambiar: (v) => { binario = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: VIZ.rampa[2], texto: 'aparece poco' }, { color: VIZ.rampa[10], texto: 'aparece mucho' }, { color: C.superficie, texto: 'no aparece', borde: C.rejilla }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Edite los documentos y pulse Enter. Cada fila es un documento convertido en vector; cada columna, una palabra del vocabulario. Pase el cursor sobre una celda.');

    let geo = null, vocab = [], mat = [];
    function dibujar() {
      const listas = docs.map((d) => palabras(d, quitar));
      vocab = [...new Set(listas.flat())].sort();
      mat = listas.map((l) => vocab.map((w) => { const c = l.filter((x) => x === w).length; return binario ? Math.min(1, c) : c; }));
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 46, sup = 70, alto = 40, ancho = Math.max(6, Math.min(38, (W - izq - 8) / Math.max(1, vocab.length)));
      geo = { izq, sup, alto, ancho };
      const mx = Math.max(1, ...mat.flat());
      ctx.font = VIZ.fuente(10);
      vocab.forEach((w, j) => {
        ctx.save(); ctx.translate(izq + j * ancho + ancho / 2 + 3, sup - 6); ctx.rotate(-Math.PI / 3);
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (ancho >= 9) ctx.fillText(w.length > 9 ? w.slice(0, 8) + '…' : w, 0, 0);
        ctx.restore();
      });
      mat.forEach((f, i) => {
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(`d${i + 1}`, izq - 8, sup + i * alto + alto / 2);
        f.forEach((v, j) => {
          ctx.fillStyle = v ? VIZ.css(VIZ.enRampa(0.15 + 0.85 * (v / mx))) : C.superficie;
          ctx.fillRect(izq + j * ancho + 1, sup + i * alto + 1, ancho - 2, alto - 2);
          ctx.strokeStyle = C.rejilla; ctx.strokeRect(izq + j * ancho + 0.5, sup + i * alto + 0.5, ancho - 1, alto - 1);
          if (v && ancho >= 14) { ctx.fillStyle = v / mx > 0.5 ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.fillText(String(v), izq + j * ancho + ancho / 2, sup + i * alto + alto / 2); }
        });
      });
      const cos = (a, b) => { const p = M.suma(a.map((v, j) => v * b[j])); return p / (Math.hypot(...a) * Math.hypot(...b) || 1); };
      lectura.set([
        ['vocabulario (dimensión)', String(vocab.length)],
        ['coseno d1–d2', VIZ.fmt(cos(mat[0], mat[1]), 3)],
        ['coseno d1–d3', VIZ.fmt(cos(mat[0], mat[2]), 3)],
        ['coseno d2–d3', VIZ.fmt(cos(mat[1], mat[2]), 3)],
        ['celdas en cero', M.pct(mat.flat().filter((v) => !v).length / Math.max(1, mat.flat().length), 0)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), j = Math.floor((x - geo.izq) / geo.ancho), i = Math.floor((y - geo.sup) / geo.alto);
      if (i < 0 || i >= 3 || j < 0 || j >= vocab.length) return tip.ocultar();
      tip.mostrar(x, y, `d${i + 1}, «${vocab[j]}»: <b>${mat[i][j]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: una imagen es un vector ---------- */

  const PLANTILLAS = {
    cero: ['..####..', '.##..##.', '##....##', '##....##', '##....##', '##....##', '.##..##.', '..####..'],
    uno: ['...##...', '..###...', '.####...', '...##...', '...##...', '...##...', '...##...', '.######.'],
    siete: ['########', '......##', '.....##.', '....##..', '...##...', '..##....', '..##....', '..##....'],
  };
  const vec = (p) => p.join('').split('').map((c) => (c === '#' ? 1 : 0));

  function montarImagen(cuerpo) {
    let px = vec(PLANTILLAS.uno);
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Cargar «0»', () => { px = vec(PLANTILLAS.cero); dibujar(); });
    ctl.boton('Cargar «1»', () => { px = vec(PLANTILLAS.uno); dibujar(); }, { primario: true });
    ctl.boton('Cargar «7»', () => { px = vec(PLANTILLAS.siete); dibujar(); });
    ctl.boton('Borrar', () => { px = new Array(64).fill(0); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(260, w * 0.5) + 60 });
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'píxel encendido (1)' }, { color: C.superficie, texto: 'píxel apagado (0)', borde: C.rejilla }, { color: C.s2, texto: 'fila 3 de la imagen dentro del vector', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la cuadrícula para encender o apagar píxeles. Las 8 filas de la imagen se ponen una tras otra en un vector de 64 números.');
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(H - 70, W * 0.5), c = lado / 8, x0 = 8, y0 = 6;
      geo = { x0, y0, c };
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        ctx.fillStyle = px[i * 8 + j] ? C.tinta : C.superficie;
        ctx.fillRect(x0 + j * c, y0 + i * c, c, c);
        ctx.strokeStyle = i === 3 ? C.s2 : C.rejilla; ctx.lineWidth = 1;
        ctx.strokeRect(x0 + j * c + 0.5, y0 + i * c + 0.5, c - 1, c - 1);
      }
      // Vector aplanado en dos renglones de 32.
      const vy = y0 + lado + 18, vc = (W - 16) / 32;
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
      ctx.fillText('x = (x₁, …, x₆₄)', 8, vy - 3);
      for (let k = 0; k < 64; k++) {
        const r = Math.floor(k / 32), j = k % 32;
        ctx.fillStyle = px[k] ? C.tinta : C.superficie;
        ctx.fillRect(8 + j * vc, vy + r * 16, vc, 14);
        ctx.strokeStyle = Math.floor(k / 8) === 3 ? C.s2 : C.rejilla;
        ctx.strokeRect(8 + j * vc + 0.5, vy + r * 16 + 0.5, vc - 1, 13);
      }
      // A la derecha: distancias a las plantillas.
      const dx = x0 + lado + 24;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = VIZ.fuente(11);
      const dists = Object.entries(PLANTILLAS).map(([k, p]) => [k, Math.sqrt(M.dist2(px, vec(p)))]);
      const mejor = dists.reduce((a, b) => (b[1] < a[1] ? b : a));
      ctx.fillStyle = C.tinta2; ctx.fillText('distancia euclidiana a:', dx, y0);
      dists.forEach(([k, d], i) => {
        const yy = y0 + 22 + i * 22, w = Math.max(0, W - dx - 90) * (d / 8);
        ctx.fillStyle = k === mejor[0] ? C.s6 : C.inactivo;
        ctx.beginPath(); ctx.roundRect(dx + 46, yy, Math.max(2, w), 14, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.fillText(`«${k === 'cero' ? 0 : k === 'uno' ? 1 : 7}»`, dx, yy + 1);
        ctx.fillText(VIZ.fmt(d, 3), dx + 52 + Math.max(2, w), yy + 1);
      });
      lectura.set([['dimensión', '64'], ['píxeles encendidos', String(M.suma(px))], ['plantilla más cercana', `«${mejor[0] === 'cero' ? 0 : mejor[0] === 'uno' ? 1 : 7}»`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), j = Math.floor((x - geo.x0) / geo.c), i = Math.floor((y - geo.y0) / geo.c);
      if (i < 0 || i > 7 || j < 0 || j > 7) return;
      px[i * 8 + j] ^= 1;
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 3: tipos de características y codificación ---------- */

  const FILAS = [
    ['Ana', 'Santiago', 'S', 12, 800],
    ['Beto', 'Lima', 'XL', 24, 1600],
    ['Caro', 'Quito', 'M', 18, 1000],
    ['Dani', 'Santiago', 'L', 30, 2400],
    ['Eli', 'Bogotá', 'S', 15, 1200],
  ];
  const CIUDADES = ['Bogotá', 'Lima', 'Quito', 'Santiago'], TALLAS = ['S', 'M', 'L', 'XL'];

  function montarTipos(cuerpo) {
    let codNominal = 'onehot', codOrdinal = 'rango', a = 0, b = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ciudad (nominal)', opciones: [['onehot', 'one-hot'], ['entero', 'código entero 0…3']], valor: codNominal, alCambiar: (v) => { codNominal = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Talla (ordinal)', opciones: [['rango', 'rango 0…3'], ['onehot', 'one-hot']], valor: codOrdinal, alCambiar: (v) => { codOrdinal = v; dibujar(); } });
    const selA = ctl.selector({ etiqueta: 'Fila A', opciones: FILAS.map((f, i) => [i, f[0]]), valor: a, alCambiar: (v) => { a = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Fila B', opciones: FILAS.map((f, i) => [i, f[0]]), valor: b, alCambiar: (v) => { b = +v; dibujar(); } });
    VIZ.subtitulo(cuerpo, 'Datos originales');
    const t1 = M.tabla(cuerpo);
    VIZ.subtitulo(cuerpo, 'Vectores codificados (cada columna escalada a [0, 1])');
    const t2 = M.tabla(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    cuerpo.dataset.sinLeyenda = 'solo tablas';
    VIZ.nota(cuerpo, 'Elija dos filas y compare cómo cambia su distancia según la codificación. Con código entero, Bogotá (0) queda «más lejos» de Santiago (3) que de Lima (1): un orden que no existe. Haga clic en una fila para usarla como A.');

    function codificar(f) {
      const v = [];
      if (codNominal === 'onehot') CIUDADES.forEach((c) => v.push(f[1] === c ? 1 : 0)); else v.push(CIUDADES.indexOf(f[1]) / 3);
      if (codOrdinal === 'rango') v.push(TALLAS.indexOf(f[2]) / 3); else TALLAS.forEach((t) => v.push(f[2] === t ? 1 : 0));
      v.push((f[3] - 12) / 18, (f[4] - 800) / 1600);
      return v;
    }
    function nombres() {
      const n = [];
      if (codNominal === 'onehot') CIUDADES.forEach((c) => n.push(`ciudad=${c.slice(0, 3)}`)); else n.push('ciudad');
      if (codOrdinal === 'rango') n.push('talla'); else TALLAS.forEach((t) => n.push(`talla=${t}`));
      return [...n, 'temp.', 'ingreso'];
    }
    function dibujar() {
      t1.set([{ texto: 'nombre', clase: 'izq' }, 'ciudad · nominal', 'talla · ordinal', 'temp. °C · intervalo', 'ingreso · razón'],
        FILAS.map((f) => [{ texto: f[0], clase: 'izq' }, f[1], f[2], f[3], f[4]]),
        { activa: a, alClic: (i) => { a = i; selA.valor = i; dibujar(); } });
      const V = FILAS.map(codificar);
      t2.set([{ texto: 'nombre', clase: 'izq' }, ...nombres()], V.map((v, i) => [{ texto: FILAS[i][0], clase: 'izq' }, ...v.map((x) => VIZ.fmt(x, 2))]), { activa: a });
      const d = Math.sqrt(M.dist2(V[a], V[b]));
      const otras = FILAS.map((_, i) => i).filter((i) => i !== a).map((i) => [i, Math.sqrt(M.dist2(V[a], V[i]))]).sort((x, y) => x[1] - y[1]);
      lectura.set([
        ['dimensión del vector', String(V[0].length)],
        [`distancia ${FILAS[a][0]}–${FILAS[b][0]}`, VIZ.fmt(d, 3)],
        [`vecino más cercano de ${FILAS[a][0]}`, FILAS[otras[0][0]][0]],
        [`razón de ingresos ${FILAS[a][0]}/${FILAS[b][0]}`, VIZ.fmt(FILAS[a][4] / FILAS[b][4], 3)],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('data-representation', {
    intro: String.raw`
      <p>Los algoritmos de minería de datos trabajan con <strong>vectores de características</strong>: cada objeto es una fila
      de una tabla y cada columna, una propiedad medida. Los <strong>datos estructurados</strong> ya vienen así (una planilla,
      una tabla SQL); los <strong>no estructurados</strong> —texto, imágenes, audio— hay que convertirlos primero.</p>
      <p>Esa conversión no es neutra: decide qué se considera parecido. Y no toda columna admite las mismas operaciones; un
      código postal es un número, pero promediarlo no tiene sentido.</p>`,
    visualizaciones: [
      {
        titulo: 'De texto a matriz documento-término',
        descripcion: 'Cada documento se convierte en el vector de cuántas veces aparece cada palabra. Observe que la matriz se llena de ceros y que d1 y d2 se parecen más entre sí que con d3.',
        montar: montarTexto,
      },
      {
        titulo: 'Una imagen es un vector',
        descripcion: 'Dibuje un dígito: los 64 píxeles forman un vector y la distancia euclidiana a cada plantilla decide a cuál se parece.',
        montar: montarImagen,
      },
      {
        titulo: 'Tipos de características y su codificación',
        descripcion: 'Una tabla con una columna de cada tipo. Cambie la codificación de las columnas categóricas y observe cómo cambian las distancias.',
        montar: montarTipos,
      },
    ],
    teoria: String.raw`
      <h2>Estructurados y no estructurados</h2>
      <p>Un conjunto de datos estructurado es una matriz \(X \in \mathbb{R}^{n \times d}\): \(n\) objetos descritos por las mismas
      \(d\) características. Los datos no estructurados no tienen ese esquema fijo y se llevan a él con una <em>representación</em>:</p>
      <ul>
        <li><strong>Texto</strong>: bolsa de palabras (conteos), TF-IDF (conteo × rareza), o vectores densos aprendidos (<em>embeddings</em>).</li>
        <li><strong>Imágenes</strong>: los píxeles en bruto, descriptores como <a href="tema.html?id=lbp">LBP</a> o
        <a href="tema.html?id=sift">SIFT</a>, o activaciones de una <a href="tema.html?id=cnn">red convolucional</a>.</li>
        <li><strong>Grafos y series de tiempo</strong>: estadísticas resumen, ventanas deslizantes o embeddings.</li>
      </ul>
      <p>Las representaciones de texto e imágenes son de <strong>dimensión alta y dispersas</strong> (casi todo es cero), lo que
      favorece medidas como el <a href="tema.html?id=distance-metrics">coseno</a> sobre la distancia euclidiana.</p>
      <h2>Tipos de características</h2>
      <table>
        <tr><th>Tipo</th><th>Ejemplo</th><th>Operaciones con sentido</th><th>Resumen típico</th></tr>
        <tr><td>Nominal</td><td>ciudad, color</td><td>\(=, \neq\)</td><td>moda, frecuencias</td></tr>
        <tr><td>Ordinal</td><td>talla, nivel educativo</td><td>\(=, \neq, &lt;, &gt;\)</td><td>mediana, percentiles</td></tr>
        <tr><td>Intervalo</td><td>temperatura en °C, fecha</td><td>además \(+, -\)</td><td>media, desviación</td></tr>
        <tr><td>Razón</td><td>ingreso, peso, edad</td><td>además \(\times, \div\) (cero absoluto)</td><td>media geométrica, coef. de variación</td></tr>
      </table>
      <p>Decir «30 °C es el doble de 15 °C» no tiene sentido (el cero es arbitrario); «2400 es el doble de 1200» sí.</p>
      <h2>Codificación</h2>
      <p>Para usar distancias, las categorías se codifican como números:</p>
      <ul>
        <li><strong>One-hot</strong>: una columna 0/1 por categoría. Todas las categorías quedan a la misma distancia \(\sqrt 2\)
        entre sí; adecuada para nominales, pero agrega \(k\) dimensiones.</li>
        <li><strong>Código entero o rango</strong>: \(0, 1, \dots, k-1\). Conserva el orden, así que sirve para ordinales; aplicada a una
        nominal inventa un orden y distancias falsas.</li>
      </ul>
      <p>Después de codificar hay que <a href="tema.html?id=feature-scaling">escalar</a>: una columna en miles domina a una en unidades.</p>`,
  });
})();