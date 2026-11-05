(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;
  const FILAS = V.ventas(1);

  /* ---------- Fig. 1: mapa de calor región × mes ---------- */

  function montarCalor(cuerpo) {
    const e = { norm: 'ninguna', rampa: 'azul', orden: 'original' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Normalizar', valor: e.norm, opciones: [['ninguna', 'valores absolutos'], ['fila', 'por fila (cada región a su escala)']], alCambiar: (v) => { e.norm = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Rampa de color', valor: e.rampa, opciones: [['azul', 'azul secuencial'], ['gris', 'grises'], ['arco', 'arcoíris (no recomendada)']], alCambiar: (v) => { e.rampa = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Orden de las filas', valor: e.orden, opciones: [['original', 'original'], ['total', 'por total, de mayor a menor']], alCambiar: (v) => { e.orden = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 230, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda es una región en un mes; el color codifica las ventas. Normalizar por fila revela la estacionalidad de cada región; la rampa arcoíris crea bordes que los datos no tienen.');
    const M = V.REGIONES.map((r) => V.MESES.map((_, m) => FILAS.filter((f) => f.region === r && f.mes === m).reduce((a, f) => a + f.ventas, 0)));
    let celdas = [];
    const colorDe = (t) => (e.rampa === 'azul' ? VIZ.css(VIZ.enRampa(t)) : e.rampa === 'gris' ? VIZ.css(VIZ.enRampa(t, VIZ.rampaGris)) : `hsl(${240 - 240 * t}, 85%, 50%)`); // arcoíris: ejemplo negativo, color de dominio
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      let idx = V.REGIONES.map((_, i) => i);
      if (e.orden === 'total') idx.sort((a, b) => M[b].reduce((s, v) => s + v, 0) - M[a].reduce((s, v) => s + v, 0));
      const izq = 64, sup = 26, cw = (W - izq - 10) / 12, ch = (H - sup - 8) / 4;
      const todos = M.flat(), gmn = Math.min(...todos), gmx = Math.max(...todos);
      celdas = [];
      idx.forEach((r, y) => {
        const fila = M[r], mn = Math.min(...fila), mx = Math.max(...fila);
        V.rotulo(ctx, V.REGIONES[r], izq - 8, sup + y * ch + ch / 2, { alinear: 'right', tam: 11 });
        fila.forEach((v, x) => { const t = e.norm === 'fila' ? (v - mn) / (mx - mn) : (v - gmn) / (gmx - gmn); ctx.fillStyle = colorDe(t); ctx.fillRect(izq + x * cw, sup + y * ch, cw - 1, ch - 1); celdas.push({ x: izq + x * cw, y: sup + y * ch, w: cw, h: ch, r, m: x, v, t }); });
      });
      V.MESES.forEach((m, x) => V.rotulo(ctx, m, izq + x * cw + cw / 2, sup - 11, { alinear: 'center', tam: 10, color: C.apagado }));
      leyenda.set([{ color: colorDe(0), texto: e.norm === 'fila' ? 'mínimo de la fila' : `mínimo global (${VIZ.fmt(gmn, 3)})` }, { color: colorDe(0.5), texto: 'intermedio' }, { color: colorDe(1), texto: e.norm === 'fila' ? 'máximo de la fila' : `máximo global (${VIZ.fmt(gmx, 3)})` }]);
      lectura.set([['celdas', '48'], ['mes con mayor total', V.MESES[V.MESES.map((_, m) => M.reduce((s, f) => s + f[m], 0)).reduce((b, v, i, a) => (v > a[b] ? i : b), 0)]], ['normalización', e.norm === 'fila' ? 'por fila' : 'global']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.bajo(celdas, x, y); if (!c) return tip.ocultar(); tip.mostrar(x, y, `${V.REGIONES[c.r]} · ${V.MESES[c.m]}<br>ventas <b>${VIZ.fmt(c.v, 4)}</b> M$`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: matriz de correlación y reordenamiento ---------- */

  function montarCorrelacion(cuerpo) {
    let ordenado = false;
    const NOM = ['Ingreso', 'Educación', 'Salud', 'Vivienda', 'Delitos', 'Desempleo', 'Contaminación', 'Transporte'];
    const r = VIZ.semilla(5), N = () => VIZ.normal(r);
    const n = 80, base = Array.from({ length: n }, () => [N(), N()]);
    const carga = [[0.9, 0.1], [0.8, 0.2], [0.7, 0.3], [0.8, 0.1], [-0.2, 0.9], [-0.3, 0.8], [0.1, -0.85], [0.2, -0.7]];
    const X = NOM.map((_, j) => base.map((b) => carga[j][0] * b[0] + carga[j][1] * b[1] + 0.45 * N()));
    const corr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
    const R = X.map((a) => X.map((b) => corr(a, b)));
    const mezclado = [0, 4, 1, 6, 2, 5, 3, 7];
    function orden() {
      if (!ordenado) return mezclado;
      const ord = [0], rest = new Set([1, 2, 3, 4, 5, 6, 7]);
      while (rest.size) { const u = ord[ord.length - 1]; let mejor = -1, mv = -9; for (const q of rest) if (R[u][q] > mv) { mv = R[u][q]; mejor = q; } ord.push(mejor); rest.delete(mejor); }
      return ord;
    }
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Reordenar por similitud (vecino más correlacionado)', valor: false, alCambiar: (v) => { ordenado = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 430 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'correlación positiva' }, { color: C.s2, texto: 'correlación negativa' }, { color: C.neutro, texto: 'cercana a 0', borde: C.eje }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El mismo conjunto en dos órdenes: mezclado (a la vista no se ve estructura) y reordenado (aparecen bloques). El orden de filas y columnas es una decisión de diseño con tanto peso como el color.');
    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const o = orden(), izq = W < 480 ? 20 : 108, sup = W < 480 ? 20 : 78, lado = Math.min((W - izq - 10) / 8, (H - sup - 8) / 8);
      celdas = [];
      o.forEach((j, y) => {
        if (W >= 480) V.rotulo(ctx, NOM[j], izq - 6, sup + y * lado + lado / 2, { alinear: 'right', tam: 10.5 });
        o.forEach((k, x) => {
          const v = R[j][k], t = Math.abs(v);
          ctx.fillStyle = v >= 0 ? VIZ.alfa(C.s1, 0.08 + 0.92 * t) : VIZ.alfa(C.s2, 0.08 + 0.92 * t); ctx.fillRect(izq + x * lado, sup + y * lado, lado - 1, lado - 1);
          if (lado > 30) V.rotulo(ctx, VIZ.fmt(v, 2), izq + x * lado + lado / 2, sup + y * lado + lado / 2, { alinear: 'center', tam: 10, color: t > 0.55 ? C.sobre : C.tinta2 });
          celdas.push({ x: izq + x * lado, y: sup + y * lado, w: lado, h: lado, j, k, v });
        });
        if (W >= 480) { ctx.save(); ctx.translate(izq + y * lado + lado / 2, sup - 6); ctx.rotate(-Math.PI / 4); V.rotulo(ctx, NOM[j], 0, 0, { tam: 10.5 }); ctx.restore(); }
      });
      let suma = 0, cnt = 0; for (let i = 0; i < 7; i++) { suma += Math.abs(R[o[i]][o[i + 1]]); cnt++; }
      lectura.set([['orden', ordenado ? 'por similitud' : 'mezclado'], ['|r| medio entre vecinas', VIZ.fmt(suma / cnt, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.bajo(celdas, x, y); if (!c) return tip.ocultar(); tip.mostrar(x, y, `${NOM[c.j]} × ${NOM[c.k]}<br>r = <b>${VIZ.fmt(c.v, 3)}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('heatmap-matrix', {
    intro: String.raw`
      <p>Un <strong>mapa de calor</strong> dibuja una matriz de valores como una cuadrícula de celdas coloreadas. Con filas y columnas que son categorías o instantes, el color reemplaza al número y la vista descubre patrones —zonas altas, bandas, bloques— que en una tabla se pierden.</p>
      <p>Dos decisiones dominan el resultado: <strong>cómo se asigna color</strong> y <strong>en qué orden</strong> se colocan filas y columnas.</p>`,
    visualizaciones: [
      { titulo: 'Mapa de calor de ventas', descripcion: 'Compare valores absolutos y normalizados por fila, tres rampas de color y dos órdenes de filas.', montar: montarCalor },
      { titulo: 'Matriz de correlación y reordenamiento', descripcion: 'Active el reordenamiento por similitud para que aparezcan bloques de variables relacionadas.', montar: montarCorrelacion },
    ],
    teoria: String.raw`
      <h2>Estructura</h2>
      <p>Un mapa de calor codifica una tabla \(M\) de \(m \times n\) valores: la fila \(i\) y la columna \(j\) se convierten en posición (una celda) y el valor \(M_{ij}\) en un color. Es un uso de la <a href="tema.html?id=marks-and-channels">marca área con canal de color</a>, el menos preciso de los canales de magnitud; por eso sirve para ver patrones generales, no para leer valores exactos.</p>
      <h2>Rampa de color</h2>
      <p>Para magnitudes use una rampa de <strong>luminancia monótona</strong> (de claro a oscuro). Una rampa arcoíris percibe «bandas» donde los datos cambian poco, y su orden no es evidente; ver <a href="tema.html?id=color-channels-hsl">color</a>. Si hay un punto neutro significativo (cero en una correlación, el promedio), use una rampa <em>divergente</em> con dos tonos y centro claro.</p>
      <h2>Normalización</h2>
      <p>Normalizar por fila resta el nivel de cada fila y deja ver su forma: \(t_{ij} = \dfrac{M_{ij} - \min_j M_{ij}}{\max_j M_{ij} - \min_j M_{ij}}\). Se pierde la comparación entre filas: hay que decirlo.</p>
      <h2>Ordenar es diseñar</h2>
      <p>Una matriz tiene \(m!\,n!\) órdenes posibles y casi todos esconden la estructura. Ordenar por un atributo, o por similitud (<em>seriación</em>, agrupamiento jerárquico), acerca las filas parecidas y forma bloques visibles. Una correlación entre \(X\) y \(Y\) es
      \[ r = \frac{\sum_i (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_i (x_i - \bar{x})^2\,\sum_i (y_i - \bar{y})^2}} \in [-1, 1]. \]
      La misma idea de matriz y orden se usa para redes en <a href="tema.html?id=node-link-vs-matrix">nodos y enlaces frente a matrices</a>.</p>`,
  });
})();
