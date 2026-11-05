(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: tabla frente a gráfico ---------- */

  function montarTablaGrafico(cuerpo) {
    let semilla = 1, datos = [];
    const est = { rep: 'barras', pregunta: 'max', ver: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Representación', valor: est.rep, opciones: [['tabla', 'Tabla de números'], ['barras', 'Barras'], ['orden', 'Barras ordenadas']], alCambiar: (v) => { est.rep = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Pregunta', valor: est.pregunta, opciones: [['max', '¿Cuál ciudad tiene el mayor valor?'], ['min', '¿Cuál tiene el menor?'], ['sobre', '¿Cuántas superan el promedio?']], alCambiar: (v) => { est.pregunta = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar la respuesta', valor: est.ver, alCambiar: (v) => { est.ver = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'respuesta a la pregunta' }, { color: C.s1, texto: 'otras ciudades' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con la tabla, responda sin marcar la respuesta; luego cambie a barras y compare cuánto cuesta cada pregunta. Pase el cursor por una barra para ver su valor.');

    function generar() {
      const rnd = VIZ.semilla(semilla * 17);
      datos = V.CIUDADES.map((nombre) => ({ nombre, valor: Math.round(20 + rnd() * 80) }));
    }
    function respuesta(lista) {
      const prom = lista.reduce((s, d) => s + d.valor, 0) / lista.length;
      if (est.pregunta === 'max') { const m = Math.max(...lista.map((d) => d.valor)); return { set: new Set(lista.filter((d) => d.valor === m).map((d) => d.nombre)), texto: `mayor: ${[...lista].find((d) => d.valor === m).nombre} (${m})`, prom }; }
      if (est.pregunta === 'min') { const m = Math.min(...lista.map((d) => d.valor)); return { set: new Set(lista.filter((d) => d.valor === m).map((d) => d.nombre)), texto: `menor: ${[...lista].find((d) => d.valor === m).nombre} (${m})`, prom }; }
      const s = lista.filter((d) => d.valor > prom);
      return { set: new Set(s.map((d) => d.nombre)), texto: `${s.length} de ${lista.length} superan el promedio (${VIZ.fmt(prom, 3)})`, prom };
    }
    let rects = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lista = est.rep === 'orden' ? [...datos].sort((a, b) => b.valor - a.valor) : datos;
      const r = respuesta(lista);
      rects = [];
      if (est.rep === 'tabla') {
        const cols = W < 520 ? 1 : 2, por = Math.ceil(lista.length / cols), ancho = (W - 20) / cols;
        lista.forEach((d, i) => {
          const c = Math.floor(i / por), f = i % por, x = 10 + c * ancho, y = 14 + f * (cols === 1 ? 22 : 40);
          const hit = est.ver && r.set.has(d.nombre);
          ctx.fillStyle = hit ? VIZ.alfa(C.s6, 0.18) : i % 2 ? C.neutro : C.superficie;
          ctx.fillRect(x, y - 12, ancho - 12, cols === 1 ? 22 : 36);
          V.rotulo(ctx, d.nombre, x + 6, y + (cols === 1 ? 0 : 6), { tam: 12, color: C.tinta2 });
          V.rotulo(ctx, String(d.valor), x + ancho - 20, y + (cols === 1 ? 0 : 6), { tam: 13, peso: 600, color: hit ? C.s6 : C.tinta, alinear: 'right' });
        });
      } else {
        const g = V.barras(lienzo, lista.map((d) => ({ nombre: d.nombre, valor: d.valor })), { horizontal: true, max: 105, color: (i, d) => (est.ver && r.set.has(d.nombre) ? C.s6 : C.s1) });
        rects = g.rects;
        if (est.pregunta === 'sobre') {
          const x = g.escala(r.prom);
          ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x + 0.5, 6); ctx.lineTo(x + 0.5, H - 18); ctx.stroke(); ctx.setLineDash([]);
          V.rotulo(ctx, 'promedio', x + 4, 8, { tam: 10, color: C.apagado });
        }
      }
      lectura.set([
        ['representación', est.rep === 'tabla' ? 'tabla' : est.rep === 'orden' ? 'barras ordenadas' : 'barras'],
        ['para responder', est.rep === 'tabla' ? `leer y comparar ${lista.length} números` : est.rep === 'orden' ? 'mirar un extremo' : 'comparar longitudes de un vistazo'],
        ['respuesta', est.ver ? r.texto : 'oculta'],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = V.bajo(rects, x, y);
      if (!h) return tip.ocultar();
      const lista = est.rep === 'orden' ? [...datos].sort((a, b) => b.valor - a.valor) : datos;
      tip.mostrar(x, y, `${lista[h.i].nombre}<br>valor <b>${lista[h.i].valor}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar(); dibujar();
  }

  /* ---------- Fig. 2: cuarteto de Anscombe ---------- */

  const X123 = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
  const CONJ = [
    { x: X123, y: [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68] },
    { x: X123, y: [9.14, 8.14, 8.74, 8.77, 9.26, 8.10, 6.13, 3.10, 9.13, 7.26, 4.74] },
    { x: X123, y: [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73] },
    { x: [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8], y: [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.5, 5.56, 7.91, 6.89] },
  ];
  function estadisticas(d) {
    const n = d.x.length, mx = d.x.reduce((a, b) => a + b) / n, my = d.y.reduce((a, b) => a + b) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (d.x[i] - mx) ** 2; syy += (d.y[i] - my) ** 2; sxy += (d.x[i] - mx) * (d.y[i] - my); }
    const b = sxy / sxx;
    return { mx, my, vx: sxx / (n - 1), vy: syy / (n - 1), r: sxy / Math.sqrt(sxx * syy), a: my - b * mx, b };
  }

  function montarAnscombe(cuerpo) {
    let puntos = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Mostrar los puntos', valor: puntos, alCambiar: (v) => { puntos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 520 : 340) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'observaciones (x, y)', forma: 'punto' }, { color: C.s2, texto: 'recta de regresión', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Primero lea solo las estadísticas: son iguales en los cuatro conjuntos. Luego active los puntos y pase el cursor sobre ellos.');
    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cols = W < 560 ? 1 : 2, filas = 4 / cols, cw = W / cols, ch = H / filas;
      celdas = [];
      CONJ.forEach((d, k) => {
        const ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch, s = estadisticas(d);
        const sx = V.lin(2, 20, ox + 34, ox + cw - 14), sy = V.lin(2, 14, oy + ch - 26, oy + 18);
        ctx.strokeStyle = C.rejilla; ctx.strokeRect(ox + 34.5, oy + 18.5, cw - 48, ch - 44);
        V.rotulo(ctx, ['I', 'II', 'III', 'IV'][k], ox + 38, oy + 9, { tam: 11, peso: 600, color: C.tinta });
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (const t of [4, 8, 12]) ctx.fillText(String(t), ox + 29, sy(t));
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const t of [5, 10, 15]) ctx.fillText(String(t), sx(t), oy + ch - 22);
        if (puntos) {
          VIZ.trazar(ctx, { x0: 0 }, [[sx(3), sy(s.a + s.b * 3)], [sx(19), sy(s.a + s.b * 19)]].map(([x, y]) => [x, y]), C.s2, 2);
          d.x.forEach((x, i) => { VIZ.marcador(ctx, sx(x), sy(d.y[i]), C.s1, 4); celdas.push({ px: sx(x), py: sy(d.y[i]), k, i }); });
        } else {
          V.rotulo(ctx, 'media x = ' + VIZ.fmt(s.mx, 3) + ' · media y = ' + VIZ.fmt(s.my, 3), ox + cw / 2, oy + ch / 2 - 14, { alinear: 'center', tam: 11 });
          V.rotulo(ctx, 'r = ' + VIZ.fmt(s.r, 3) + ' · y = ' + VIZ.fmt(s.a, 3) + ' + ' + VIZ.fmt(s.b, 3) + 'x', ox + cw / 2, oy + ch / 2 + 6, { alinear: 'center', tam: 11 });
        }
      });
      const s = CONJ.map(estadisticas);
      lectura.set([['media de y', s.map((e) => VIZ.fmt(e.my, 3)).join(' · ')], ['correlación r', s.map((e) => VIZ.fmt(e.r, 3)).join(' · ')], ['pendiente', s.map((e) => VIZ.fmt(e.b, 3)).join(' · ')]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = puntos && V.cercano(celdas, x, y, 10);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `conjunto ${['I', 'II', 'III', 'IV'][c.k]}<br>x = <b>${CONJ[c.k].x[c.i]}</b>, y = <b>${CONJ[c.k].y[c.i]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('information-visualization', {
    intro: String.raw`
      <p>La <strong>visualización de información</strong> convierte datos abstractos —cifras, categorías, relaciones— en una imagen que una persona puede
      <em>mirar</em> para pensar mejor. Su apuesta es que el sistema visual humano procesa en paralelo lo que la lectura de números hace en serie.</p>
      <p>No se trata de decorar una tabla: se trata de elegir qué se dibuja y cómo, para que la pregunta que usted tiene se responda con el menor esfuerzo posible.</p>`,
    visualizaciones: [
      {
        titulo: 'La misma pregunta en tabla y en gráfico',
        descripcion: 'Responda cada pregunta con la tabla y luego con las barras. Pruebe las barras ordenadas: ¿qué preguntas se vuelven triviales?',
        montar: montarTablaGrafico,
      },
      {
        titulo: 'El cuarteto de Anscombe',
        descripcion: 'Cuatro conjuntos con las mismas estadísticas resumen. Active los puntos y compare lo que las cifras ocultaban.',
        montar: montarAnscombe,
      },
    ],
    teoria: String.raw`
      <h2>Qué es y para qué sirve</h2>
      <p>Una visualización es una <em>representación gráfica de datos</em> que amplía la cognición: reemplaza cálculo mental por percepción. Sirve cuando hay una
      tarea humana que apoyar (explorar, comparar, comunicar) y los datos son demasiado grandes o complejos para leerse en tabla. Si un cálculo automático resuelve la pregunta,
      no hace falta una imagen.</p>
      <h2>Datos, marcas y canales</h2>
      <p>Cada ítem del conjunto de datos se dibuja como una <strong>marca</strong> (punto, línea, área) y cada atributo se asigna a un <strong>canal</strong> visual
      (posición, longitud, color…). Ver <a href="tema.html?id=marks-and-channels">marcas y canales</a>.</p>
      <h2>Resumen numérico frente a imagen</h2>
      <p>El cuarteto de Anscombe (1973) lo muestra con \(n = 11\) puntos por conjunto: todos tienen \(\bar{x} = 9\), \(\bar{y} \approx 7{,}50\),
      varianza de \(x\) igual a 11, \(r \approx 0{,}816\) y la recta \(y \approx 3 + 0{,}5x\). Sin embargo uno es una nube lineal con ruido, otro una parábola, otro tiene un valor atípico y el último depende de un solo punto.</p>
      <div class="recuadro"><strong>Lección.</strong> Las estadísticas resumen descartan estructura. Dibujar los datos es parte del análisis, no un adorno posterior.</div>
      <h2>Costo de leer</h2>
      <p>Responder «¿cuál es el mayor?» en una tabla exige revisar \(n\) números: \(\Theta(n)\) lecturas. En un gráfico de barras la longitud se compara de un vistazo, y con barras
      ordenadas la respuesta está en un extremo. El diseño reduce el costo de la tarea, no el tamaño de los datos.</p>
      <h2>Conexiones</h2>
      <p>El marco para diseñar con método es el <a href="tema.html?id=munzner-nested-model">modelo anidado</a>; la base perceptual está en
      <a href="tema.html?id=perceptual-accuracy">precisión perceptual</a>.</p>`,
  });
})();
