(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: tipos de marca ---------- */

  function montarMarcas(cuerpo) {
    const e = { marca: 'punto', datos: 'tiempo' };
    const SERIE = [32, 41, 38, 55, 62, 58, 71, 66];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Marca', valor: e.marca, opciones: [['punto', 'Punto (0D)'], ['linea', 'Línea (1D)'], ['area', 'Área (2D)'], ['barra', 'Barra: línea como longitud']], alCambiar: (v) => { e.marca = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Los ítems son', valor: e.datos, opciones: [['tiempo', 'meses (orden natural)'], ['ciudades', 'ciudades (sin orden)']], alCambiar: (v) => { e.datos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'marca que representa cada ítem' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Con meses, la línea expresa continuidad y tendencia. Con ciudades sin orden, la línea y el área sugieren un camino que no existe: elija barras o puntos.');
    let pts = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const nombres = e.datos === 'tiempo' ? V.MESES.slice(0, 8) : V.CIUDADES.slice(0, 8);
      const x0 = 40, x1 = W - 20, y0 = H - 34, y1 = 16, sx = (i) => x0 + ((i + 0.5) / 8) * (x1 - x0), sy = V.lin(0, 80, y0, y1);
      for (const t of [0, 20, 40, 60, 80]) { ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x0, sy(t) + 0.5); ctx.lineTo(x1, sy(t) + 0.5); ctx.stroke(); V.rotulo(ctx, String(t), x0 - 6, sy(t), { alinear: 'right', tam: 10, color: C.apagado }); }
      nombres.forEach((n, i) => V.rotulo(ctx, W < 480 ? n.slice(0, 3) : V.corto(n, 9), sx(i), y0 + 16, { alinear: 'center', tam: 10, color: C.apagado }));
      pts = SERIE.map((v, i) => ({ px: sx(i), py: sy(v), i }));
      if (e.marca === 'area') { ctx.beginPath(); ctx.moveTo(sx(0), y0); SERIE.forEach((v, i) => ctx.lineTo(sx(i), sy(v))); ctx.lineTo(sx(7), y0); ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s1, 0.3); ctx.fill(); }
      if (e.marca === 'linea' || e.marca === 'area') { ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.beginPath(); SERIE.forEach((v, i) => (i ? ctx.lineTo(sx(i), sy(v)) : ctx.moveTo(sx(i), sy(v)))); ctx.stroke(); }
      if (e.marca === 'barra') SERIE.forEach((v, i) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(sx(i) - 14, sy(v), 28, y0 - sy(v), [4, 4, 0, 0]); ctx.fill(); });
      if (e.marca === 'punto' || e.marca === 'linea') pts.forEach((p) => VIZ.marcador(ctx, p.px, p.py, C.s1, 4.5));
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, y0 + 0.5); ctx.lineTo(x1, y0 + 0.5); ctx.stroke();
      registro.textContent = e.datos === 'ciudades' && (e.marca === 'linea' || e.marca === 'area') ? 'La línea conecta ciudades como si hubiera una secuencia entre ellas: es un uso engañoso de la marca.'
        : { punto: 'Punto: un ítem es una posición; no sugiere relación entre ítems.', linea: 'Línea: conecta ítems consecutivos y expresa cambio y tendencia.', area: 'Área: la región bajo la línea; el relleno agrega «volumen» y exige una base cero.', barra: 'Barra: la longitud desde una base común codifica el valor con precisión.' }[e.marca];
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const p = V.cercano(pts, x, y, 18); if (!p) return tip.ocultar(); tip.mostrar(x, y, `${(e.datos === 'tiempo' ? V.MESES : V.CIUDADES)[p.i]}: <b>${SERIE[p.i]}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: un mismo valor en varios canales ---------- */

  const CANALES = [
    { id: 'pos', n: 'posición (escala común)', tipo: 'magnitud' }, { id: 'lon', n: 'longitud', tipo: 'magnitud' },
    { id: 'ang', n: 'inclinación', tipo: 'magnitud' }, { id: 'area', n: 'área', tipo: 'magnitud' },
    { id: 'lum', n: 'luminancia', tipo: 'magnitud' }, { id: 'tono', n: 'tono de color', tipo: 'identidad' },
    { id: 'forma', n: 'forma', tipo: 'identidad' },
  ];

  function montarCanales(cuerpo) {
    let semilla = 1, vals = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Nuevos valores', () => { semilla++; generar(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'canal de magnitud: el orden se percibe' }, { color: C.s3, texto: 'canal de identidad: distingue categorías, no ordena' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los mismos seis valores (10 a 100) en cada fila. Intente ordenarlos de menor a mayor en cada canal: la posición, la longitud y la inclinación lo permiten sin esfuerzo; tono y forma no.');
    function generar() { const r = VIZ.semilla(semilla * 9); vals = Array.from({ length: 6 }, () => Math.round(10 + r() * 90)); }
    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ancho = W < 520, izq = ancho ? 96 : 190, paso = (W - izq - 16) / 6, filaH = 48;
      celdas = [];
      CANALES.forEach((c, r) => {
        const y = 12 + r * filaH, cy = y + filaH / 2;
        ctx.fillStyle = r % 2 ? C.superficie : C.neutro; ctx.fillRect(0, y - 2, W, filaH);
        V.rotulo(ctx, c.n, 10, cy, { tam: ancho ? 10 : 12, color: c.tipo === 'magnitud' ? C.tinta : C.s3, peso: 600 });
        vals.forEach((v, i) => {
          const cx = izq + paso * (i + 0.5), t = v / 100;
          ctx.fillStyle = C.tinta; ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
          if (c.id === 'pos') { VIZ.marcador(ctx, cx, y + filaH - 8 - t * (filaH - 16), C.tinta, 4.5); }
          else if (c.id === 'lon') ctx.fillRect(cx - 5, y + filaH - 6 - t * (filaH - 12), 10, t * (filaH - 12));
          else if (c.id === 'ang') { const a = -t * Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx - 14 * Math.cos(a) * 0, cy + 10); ctx.lineTo(cx + 18 * Math.cos(a), cy + 10 + 18 * Math.sin(a)); ctx.stroke(); }
          else if (c.id === 'area') { ctx.beginPath(); ctx.arc(cx, cy, Math.sqrt(t) * 17, 0, 6.3); ctx.fill(); }
          else if (c.id === 'lum') { ctx.fillStyle = VIZ.css(VIZ.rgb(C.tinta).map((q) => q + (255 - q) * (1 - t) * 0.92)); ctx.beginPath(); ctx.roundRect(cx - 14, cy - 14, 28, 28, 4); ctx.fill(); }
          else if (c.id === 'tono') { ctx.fillStyle = VIZ.series[i % 8]; ctx.beginPath(); ctx.roundRect(cx - 14, cy - 14, 28, 28, 4); ctx.fill(); }
          else { ctx.fillStyle = C.s3; ctx.beginPath(); VIZ.forma(ctx, cx, cy, 11, i); ctx.fill(); }
          celdas.push({ px: cx, py: cy, r, i });
        });
      });
      lectura.set([['valores', vals.join(' · ')], ['mayor', String(Math.max(...vals))], ['menor', String(Math.min(...vals))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.cercano(celdas, x, y, 20); if (!c) return tip.ocultar(); tip.mostrar(x, y, `${CANALES[c.r].n}<br>valor <b>${vals[c.i]}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar(); dibujar();
  }

  VIZ.registrarTema('marks-and-channels', {
    intro: String.raw`
      <p>Toda visualización se construye con dos piezas. Las <strong>marcas</strong> son los objetos geométricos básicos —puntos, líneas, áreas— y representan los ítems o los vínculos entre ellos. Los <strong>canales</strong> son las propiedades que controlan su apariencia —posición, tamaño, color, forma— y representan los atributos.</p>
      <p>Cambiar de gráfico es, casi siempre, cambiar de marca o de canal. Elegir bien es decidir qué va a ser fácil de ver.</p>`,
    visualizaciones: [
      { titulo: 'Un conjunto, cuatro marcas', descripcion: 'Represente la misma serie con puntos, línea, área y barras, y cambie los ítems entre meses y ciudades para ver cuándo conectar es engañoso.', montar: montarMarcas },
      { titulo: 'Un valor, siete canales', descripcion: 'Compare cómo se percibe un mismo valor en posición, longitud, inclinación, área, luminancia, tono y forma.', montar: montarCanales },
    ],
    teoria: String.raw`
      <h2>Marcas</h2>
      <table>
        <tr><th>Dimensión</th><th>Marca</th><th>Representa</th></tr>
        <tr><td>0D</td><td>punto</td><td>un ítem</td></tr>
        <tr><td>1D</td><td>línea</td><td>un ítem o un vínculo entre ítems</td></tr>
        <tr><td>2D</td><td>área</td><td>un ítem, con región</td></tr>
        <tr><td>3D</td><td>volumen</td><td>raramente recomendable</td></tr>
      </table>
      <h2>Canales</h2>
      <p>Se dividen según el tipo de información que comunican:</p>
      <ul>
        <li><strong>Canales de magnitud</strong> (<em>cuánto</em>): posición en escala común o no alineada, longitud, inclinación, área, profundidad, luminancia, saturación, curvatura, volumen.</li>
        <li><strong>Canales de identidad</strong> (<em>qué</em> o <em>dónde</em>): región espacial, tono de color, movimiento, forma.</li>
      </ul>
      <p>Un atributo cuantitativo ordenado debe ir a un canal de magnitud; uno categórico, a uno de identidad. Mezclarlos produce gráficos que se leen mal: un tono distinto no dice cuál es «mayor».</p>
      <h2>Expresividad y efectividad</h2>
      <p><em>Expresividad</em>: la imagen debe decir <strong>todo</strong> lo que contienen los datos y <strong>nada más</strong>. <em>Efectividad</em>: de los canales expresivos, se prefieren los más precisos. Su orden aproximado, por precisión de lectura, es posición común \(>\) longitud \(>\) inclinación \(>\) área \(>\) luminancia y saturación; ver <a href="tema.html?id=perceptual-accuracy">precisión perceptual</a>.</p>
      <h2>Conexiones</h2>
      <p>Para la elección entre canales de color, <a href="tema.html?id=color-channels-hsl">tono, saturación y luminancia</a>; para su asignación a atributos, <a href="tema.html?id=visual-mapping-pipeline">el mapeo visual</a>.</p>`,
  });
})();
