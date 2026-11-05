(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const DATOS = {
    catcuant: 'Una categoría y un número (ventas por región)',
    cuantcuant: 'Dos números (ingreso y esperanza de vida)',
    tiempo: 'Un número a lo largo del tiempo',
    dist: 'Un solo número con muchas observaciones',
    matriz: 'Dos categorías y un número (región × mes)',
    red: 'Ítems y relaciones entre ellos',
    espacial: 'Un valor por región geográfica',
  };
  const TAREAS = { comparar: 'Comparar valores', relacion: 'Ver la relación entre variables', tendencia: 'Ver una tendencia', distribucion: 'Ver la distribución', patron: 'Descubrir patrones generales', conexiones: 'Seguir conexiones', ubicar: 'Ver dónde ocurre' };

  // Recomendación por (datos, tarea); si no existe, se usa la entrada por omisión de los datos.
  const REC = {
    catcuant: { def: ['barras', 'Gráfico de barras ordenadas', 'La longitud sobre una base común es el canal más preciso para comparar categorías.', 'Puntos de Cleveland (si hay muchas categorías)', 'torta de muchas porciones, 3D, áreas'] },
    cuantcuant: { def: ['dispersion', 'Gráfico de dispersión', 'Dos posiciones permiten ver correlación, grupos y atípicos.', 'Hexágonos o mapa de calor 2D si hay miles de puntos', 'barras de dos ejes o líneas que unen puntos sin orden'] },
    tiempo: { def: ['linea', 'Gráfico de líneas', 'La línea expresa continuidad y pendiente; el eje horizontal es el tiempo.', 'Área (si la base cero importa), barras si hay pocos períodos', 'líneas para categorías sin orden; ejes y truncados'], comparar: ['barras', 'Barras por período', 'Para comparar pocos valores puntuales, la longitud es más precisa.', 'Línea con marcadores', 'áreas apiladas para comparar series entre sí'] },
    dist: { def: ['histograma', 'Histograma', 'Muestra forma, centro y dispersión con intervalos iguales.', 'Densidad o diagrama de caja con los datos', 'torta o barras con categorías inventadas'] },
    matriz: { def: ['calor', 'Mapa de calor', 'Con muchas combinaciones el color permite ver patrones por filas y columnas.', 'Barras agrupadas (pocas categorías), líneas por categoría (si una dimensión es tiempo)', 'barras apiladas de muchas capas'], comparar: ['barras', 'Barras agrupadas', 'Para comparar pocas combinaciones con precisión.', 'Mapa de calor', 'torta por categoría'] },
    red: { def: ['nodos', 'Nodos y enlaces', 'Es la codificación más intuitiva para seguir conexiones en redes pequeñas.', 'Matriz de adyacencia (si es densa o muy grande)', 'diagramas con cientos de enlaces sin filtrar'], patron: ['matriz', 'Matriz de adyacencia ordenada', 'Resiste la densidad y deja ver comunidades si el orden es bueno.', 'Layout por fuerzas', 'círculos con cientos de nodos'] },
    espacial: { def: ['coro', 'Mapa coroplético (con tasas)', 'La posición geográfica es la que el lector espera; el color da el valor normalizado.', 'Símbolos proporcionales para valores absolutos', 'pintar conteos, áreas grandes que dominan'], comparar: ['barras', 'Barras ordenadas de las regiones', 'Para comparar con precisión, la longitud supera al color o al área.', 'Mapa enlazado a las barras', 'mapa solo con color'] },
  };
  const rec = (d, t) => REC[d][t] || REC[d].def;

  function dibujarPrevia(ctx, tipo, x, y, w, h) {
    const r = VIZ.semilla(5), base = y + h - 24, alto = h - 40;
    ctx.save();
    ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    const ejes = () => { ctx.beginPath(); ctx.moveTo(x + 24, y + 12); ctx.lineTo(x + 24, base); ctx.lineTo(x + w - 14, base); ctx.stroke(); };
    if (tipo === 'barras') { ejes(); const v = [80, 62, 50, 41, 28, 18]; v.forEach((q, i) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x + 32 + i * ((w - 56) / 6), base - (q / 100) * alto, (w - 56) / 6 - 6, (q / 100) * alto, [4, 4, 0, 0]); ctx.fill(); }); }
    else if (tipo === 'linea') { ejes(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 14; i++) { const px = x + 30 + i * ((w - 50) / 13), py = base - (0.3 + 0.35 * Math.sin(i / 2.2) + 0.03 * i) * alto; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    else if (tipo === 'dispersion') { ejes(); for (let i = 0; i < 40; i++) { const t = r(), px = x + 30 + t * (w - 50), py = base - (0.15 + 0.6 * t + 0.15 * (r() - 0.5) * 2) * alto; ctx.fillStyle = VIZ.alfa(C.s1, 0.8); ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 6.3); ctx.fill(); } }
    else if (tipo === 'histograma') { ejes(); const v = [6, 14, 30, 48, 62, 50, 30, 14, 6]; v.forEach((q, i) => { ctx.fillStyle = C.s1; ctx.fillRect(x + 30 + i * ((w - 50) / 9), base - (q / 70) * alto, (w - 50) / 9 - 1, (q / 70) * alto); }); }
    else if (tipo === 'calor') { for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) { ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.max(0, Math.min(1, 0.5 + 0.4 * Math.sin(j / 2 + i) * Math.cos(i / 2))))); ctx.fillRect(x + 10 + j * ((w - 20) / 10), y + 10 + i * ((h - 20) / 6), (w - 20) / 10 - 1, (h - 20) / 6 - 1); } }
    else if (tipo === 'nodos') { const P = Array.from({ length: 9 }, (_, i) => [x + w / 2 + Math.cos((i / 9) * 6.283) * w * 0.32, y + h / 2 + Math.sin((i / 9) * 6.283) * h * 0.34]); ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; [[0, 2], [0, 5], [1, 4], [2, 6], [3, 7], [4, 8], [5, 8], [1, 6]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...P[a]); ctx.lineTo(...P[b]); ctx.stroke(); }); P.forEach((p) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 6.3); ctx.fill(); }); }
    else if (tipo === 'matriz') { const n = 9; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (Math.floor(i / 3) === Math.floor(j / 3) || r() < 0.06) { ctx.fillStyle = C.s1; ctx.fillRect(x + 14 + j * ((w - 28) / n), y + 10 + i * ((h - 20) / n), (w - 28) / n - 1, (h - 20) / n - 1); } } }
    else if (tipo === 'coro') { [[0, 0, 0.35, 0.5, 4], [0.35, 0, 0.35, 0.3, 2], [0.7, 0, 0.3, 0.55, 5], [0.35, 0.3, 0.35, 0.7, 1], [0, 0.5, 0.35, 0.5, 3], [0.7, 0.55, 0.3, 0.45, 2]].forEach(([a, b, c, d, k]) => { ctx.fillStyle = VIZ.css(VIZ.enRampa(k / 6)); ctx.fillRect(x + 10 + a * (w - 20), y + 10 + b * (h - 20), c * (w - 20) - 2, d * (h - 20) - 2); }); }
    ctx.restore();
  }

  function montarGuia(cuerpo) {
    const e = { d: 'catcuant', t: 'comparar' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estructura de los datos', valor: e.d, opciones: Object.entries(DATOS), alCambiar: (v) => { e.d = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Tarea principal', valor: e.t, opciones: Object.entries(TAREAS), alCambiar: (v) => { e.t = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 430 : 215) });
    cuerpo.dataset.sinLeyenda = 'vista previa esquemática con datos ficticios';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie la estructura y la tarea. Cuando la combinación no tiene una recomendación particular se muestra la recomendada por omisión para esos datos. La vista previa es esquemática.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const [tipo, nombre, porque, alt, evitar] = rec(e.d, e.t), ancho = W < 560;
      const pw = ancho ? W - 4 : W * 0.46, ph = 200;
      dibujarPrevia(ctx, tipo, 2, 2, pw, ph);
      const x = ancho ? 10 : pw + 20, y0 = ancho ? ph + 24 : 16, ancho2 = ancho ? W - 20 : W - x - 10;
      const parrafo = (t, y, col, tam, peso) => { const pal = t.split(' '); let l = '', yy = y; for (const p of pal) { if ((l + p).length * (tam * 0.6) > ancho2) { V.rotulo(ctx, l, x, yy, { color: col, tam, peso }); l = ''; yy += tam + 5; } l += p + ' '; } V.rotulo(ctx, l, x, yy, { color: col, tam, peso }); return yy + tam + 12; };
      let y = parrafo('RECOMENDADO', y0, C.apagado, 10, 600);
      y = parrafo(nombre, y, C.tinta, 15, 700);
      y = parrafo(porque, y, C.tinta2, 11.5, 400);
      y = parrafo('ALTERNATIVAS', y, C.apagado, 10, 600); y = parrafo(alt, y, C.tinta2, 11.5, 400);
      y = parrafo('EVITAR', y, C.s8, 10, 600); parrafo(evitar, y, C.tinta2, 11.5, 400);
      lectura.set([['datos', DATOS[e.d].split(' (')[0]], ['tarea', TAREAS[e.t]], ['recomendación', nombre]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('chart-selection', {
    intro: String.raw`
      <p>No existe «el mejor gráfico»: existe el más adecuado para una <strong>estructura de datos</strong> y una <strong>tarea</strong>. Las preguntas que ordenan la decisión son tres: ¿qué tipo de datos tengo?, ¿qué quiere hacer la persona con ellos?, ¿qué canal visual es el más preciso para eso?</p>
      <p>Esta guía junta lo visto en el resto del bloque: marcas y canales, percepción, tipos de datos y tareas.</p>`,
    visualizaciones: [
      { titulo: 'Guía de selección', descripcion: 'Elija la estructura de los datos y la tarea, y compare la recomendación con sus alternativas y con lo que conviene evitar.', montar: montarGuia },
    ],
    teoria: String.raw`
      <h2>Procedimiento</h2>
      <ol>
        <li>Identifique la <strong>estructura</strong>: tabla (¿cuántas variables y de qué tipo?), red, espacial.</li>
        <li>Identifique la <strong>tarea</strong>: comparar, ver relación, tendencia, distribución, patrón, conexión, ubicación.</li>
        <li>Asigne el <strong>canal más preciso</strong> al atributo principal: posición sobre una base común antes que longitud, ángulo, área o color.</li>
        <li>Revise las <strong>trampas</strong>: bases truncadas, áreas que dominan, rampas arcoíris, oclusión.</li>
      </ol>
      <h2>Resumen</h2>
      <table>
        <tr><th>Datos</th><th>Codificación habitual</th><th>Ver</th></tr>
        <tr><td>categoría + número</td><td>barras ordenadas</td><td><a href="tema.html?id=marks-and-channels">marcas y canales</a></td></tr>
        <tr><td>dos números</td><td>dispersión</td><td><a href="tema.html?id=visual-mapping-pipeline">mapeo visual</a></td></tr>
        <tr><td>número en el tiempo</td><td>líneas</td><td><a href="tema.html?id=d3-shape-generators">generadores de línea</a></td></tr>
        <tr><td>distribución</td><td>histograma, densidad</td><td><a href="tema.html?id=histogram-bins">histogramas</a></td></tr>
        <tr><td>categoría × categoría</td><td>mapa de calor</td><td><a href="tema.html?id=heatmap-matrix">mapas de calor</a></td></tr>
        <tr><td>red</td><td>nodos y enlaces, matriz</td><td><a href="tema.html?id=node-link-vs-matrix">nodos y enlaces frente a matrices</a></td></tr>
        <tr><td>espacial</td><td>coroplético, símbolos</td><td><a href="tema.html?id=choropleth-symbol-maps">mapas</a></td></tr>
      </table>
      <div class="recuadro"><strong>Regla de oro.</strong> Si la tarea es comparar cantidades, use posición o longitud con una base común. Si hay que elegir entre dos gráficos igualmente apropiados, el que exija menos explicación suele ser mejor.</div>
      <p>Un mismo conjunto puede requerir varias vistas coordinadas: <a href="tema.html?id=brushing-linking">brushing y linking</a>.</p>`,
  });
})();
