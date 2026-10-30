(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const VARS = ['largo sépalo', 'ancho sépalo', 'largo pétalo', 'ancho pétalo'];
  const ESPECIES = ['especie A', 'especie B', 'especie C'];
  // Flores sintéticas: tres especies con medias y dispersiones distintas y un factor de tamaño común.
  function flores(semilla, n = 150) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
    const MU = [[5.0, 3.4, 1.5, 0.25], [5.9, 2.8, 4.3, 1.3], [6.6, 3.0, 5.5, 2.0]];
    const SD = [[0.33, 0.36, 0.17, 0.1], [0.5, 0.3, 0.45, 0.2], [0.6, 0.3, 0.52, 0.26]];
    return Array.from({ length: n }, (_, i) => {
      const g = i % 3, t = N();
      return { g, v: MU[g].map((m, j) => +(m + SD[g][j] * (0.65 * t + 0.76 * N())).toFixed(2)) };
    });
  }
  const rango = (D, j) => { const c = D.map((d) => d.v[j]); const a = Math.min(...c), b = Math.max(...c), m = (b - a) * 0.06; return [a - m, b + m]; };

  /* ---------- Fig. 1: matriz de dispersión ---------- */

  function montarMatriz(cuerpo) {
    let semilla = 1, D = [], sel = [2, 0], colorear = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'colorear por especie', valor: colorear, alCambiar: (v) => { colorear = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; D = flores(semilla); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(w, 620) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Diagonal: histograma de cada variable. Bajo la diagonal: dispersión de cada par. Sobre la diagonal: correlación de Pearson (más oscuro = más fuerte). Haga clic en una celda para resumir ese par.');
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(W, H), izq = (W - lado) / 2 + 16, sup = 4, c = (lado - 22) / 4;
      geo = { izq, sup, c };
      const R = VARS.map((_, j) => rango(D, j));
      const col = (d) => (colorear ? VIZ.series[d.g] : C.tinta2);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x0 = izq + j * c, y0 = sup + i * c;
        ctx.strokeStyle = (sel[0] === i && sel[1] === j) || (sel[0] === j && sel[1] === i && i !== j) ? C.s4 : C.rejilla;
        ctx.lineWidth = (sel[0] === i && sel[1] === j) ? 2.5 : 1;
        ctx.strokeRect(x0 + 2, y0 + 2, c - 4, c - 4);
        ctx.lineWidth = 1;
        const sx = (v) => x0 + 6 + ((v - R[j][0]) / (R[j][1] - R[j][0])) * (c - 12);
        const sy = (v) => y0 + c - 6 - ((v - R[i][0]) / (R[i][1] - R[i][0])) * (c - 12);
        if (i === j) {
          const B = 14, ancho = (R[j][1] - R[j][0]) / B;
          const grupos = colorear ? [0, 1, 2] : [-1];
          const cuentas = grupos.map((g) => { const k = new Array(B).fill(0); D.forEach((d) => { if (g < 0 || d.g === g) k[Math.min(B - 1, Math.floor((d.v[j] - R[j][0]) / ancho))]++; }); return k; });
          const mx = Math.max(...cuentas.flat());
          cuentas.forEach((k, gi) => k.forEach((v, b) => {
            if (!v) return;
            const h = (v / mx) * (c - 30);
            ctx.fillStyle = colorear ? VIZ.alfa(VIZ.series[gi], 0.55) : C.s1;
            ctx.fillRect(sx(R[j][0] + b * ancho) + 0.5, y0 + c - 6 - h, Math.max(1, ((c - 12) / B) - 1), h);
          }));
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillText(VARS[j], x0 + 6, y0 + 6);
        } else if (i > j) {
          for (const d of D) {
            ctx.fillStyle = col(d);
            ctx.beginPath(); VIZ.forma(ctx, sx(d.v[j]), sy(d.v[i]), c > 90 ? 2.2 : 1.6, colorear ? d.g : 0); ctx.fill();
          }
        } else {
          const r = M.correlacion(D.map((d) => d.v[i]), D.map((d) => d.v[j]));
          ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.abs(r))); ctx.globalAlpha = 0.35 + 0.65 * Math.abs(r);
          ctx.fillRect(x0 + 3, y0 + 3, c - 6, c - 6); ctx.globalAlpha = 1;
          ctx.fillStyle = Math.abs(r) > 0.55 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(c > 90 ? 14 : 11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(VIZ.fmt(r, 2), x0 + c / 2, y0 + c / 2);
        }
      }
      leyenda.set(colorear ? ESPECIES.map((t, g) => ({ color: VIZ.series[g], texto: t, forma: g ? 'cuadro' : 'punto' })) : [{ color: C.tinta2, texto: 'flor', forma: 'punto' }]);
      const [a, b] = sel[0] === sel[1] ? [sel[0], sel[0]] : sel;
      const xa = D.map((d) => d.v[a]), xb = D.map((d) => d.v[b]);
      const porEspecie = [0, 1, 2].map((g) => M.correlacion(D.filter((d) => d.g === g).map((d) => d.v[a]), D.filter((d) => d.g === g).map((d) => d.v[b])));
      lectura.set(a === b
        ? [['variable', VARS[a]], ['media', VIZ.fmt(M.media(xa), 3)], ['desviación', VIZ.fmt(M.desv(xa), 3)], ['mediana', VIZ.fmt(M.cuantil(xa, 0.5), 3)]]
        : [['par', `${VARS[b]} · ${VARS[a]}`], ['correlación total', VIZ.fmt(M.correlacion(xa, xb), 3)], ['dentro de cada especie', porEspecie.map((r) => VIZ.fmt(r, 2)).join(' · ')]]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const celda = (x, y) => { const j = Math.floor((x - geo.izq) / geo.c), i = Math.floor((y - geo.sup) / geo.c); return i >= 0 && i < 4 && j >= 0 && j < 4 ? [i, j] : null; };
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = geo && celda(x, y); if (q) { sel = q[0] < q[1] ? [q[1], q[0]] : q; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = geo && celda(x, y);
      if (!q) return tip.ocultar();
      const [i, j] = q;
      tip.mostrar(x, y, i === j ? `histograma de <b>${VARS[i]}</b>` : `<b>${VARS[j]}</b> (x) · <b>${VARS[i]}</b> (y)<br>r = <b>${VIZ.fmt(M.correlacion(D.map((d) => d.v[i]), D.map((d) => d.v[j])), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    D = flores(semilla);
    dibujar();
  }

  /* ---------- Fig. 2: coordenadas paralelas con filtros ---------- */

  function montarParalelas(cuerpo) {
    let semilla = 1, D = flores(semilla), filtros = VARS.map(() => null), arrastre = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Limpiar filtros', () => { filtros = VARS.map(() => null); dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; D = flores(semilla); filtros = VARS.map(() => null); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ESPECIES.map((t, g) => ({ color: VIZ.series[g], texto: t, forma: 'linea' })), { color: C.tenue, texto: 'fuera del filtro', forma: 'linea' }, { color: C.s4, texto: 'filtro', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada flor es una poligonal que cruza los cuatro ejes. Arrastre en vertical sobre un eje para filtrar un rango; un clic sin arrastrar borra el filtro de ese eje.');
    let geo = null;
    const pasa = (d) => filtros.every((f, j) => !f || (d.v[j] >= f[0] && d.v[j] <= f[1]));
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 34, der = W - 34, sup = 42, inf = H - 26, R = VARS.map((_, j) => rango(D, j));
      const ax = (j) => izq + (j * (der - izq)) / (VARS.length - 1);
      const sy = (j, v) => inf - ((v - R[j][0]) / (R[j][1] - R[j][0])) * (inf - sup);
      geo = { ax, sy, R, sup, inf, iv: (j, y) => R[j][0] + ((inf - y) / (inf - sup)) * (R[j][1] - R[j][0]) };
      const linea = (d) => { ctx.beginPath(); VARS.forEach((_, j) => (j ? ctx.lineTo(ax(j), sy(j, d.v[j])) : ctx.moveTo(ax(j), sy(j, d.v[j])))); ctx.stroke(); };
      ctx.lineWidth = 1; ctx.strokeStyle = C.tenue;
      D.filter((d) => !pasa(d)).forEach(linea);
      ctx.lineWidth = 1.3;
      D.filter(pasa).forEach((d) => { ctx.strokeStyle = VIZ.alfa(VIZ.series[d.g], 0.7); linea(d); });
      VARS.forEach((nombre, j) => {
        const x = ax(j);
        if (filtros[j]) { ctx.fillStyle = VIZ.alfa(C.s4, 0.35); ctx.fillRect(x - 7, sy(j, filtros[j][1]), 14, sy(j, filtros[j][0]) - sy(j, filtros[j][1])); }
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, sup); ctx.lineTo(x, inf); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = j === 0 ? 'left' : j === VARS.length - 1 ? 'right' : 'center'; ctx.textBaseline = 'bottom';
        nombre.split(' ').forEach((w, k) => ctx.fillText(w, x + (j === 0 ? -20 : j === VARS.length - 1 ? 20 : 0), sup - 20 + k * 13));
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(VIZ.fmt(R[j][1], 2), x - 4, sup + 4); ctx.fillText(VIZ.fmt(R[j][0], 2), x - 4, inf - 4);
      });
      const sel = D.filter(pasa);
      lectura.set([
        ['flores seleccionadas', `${sel.length} de ${D.length}`],
        ...ESPECIES.map((t, g) => [t, String(sel.filter((d) => d.g === g).length)]),
      ]);
    }
    lienzo.alDibujar = dibujar;
    const eje = (x) => { let m = -1, dm = 22; VARS.forEach((_, j) => { const d = Math.abs(geo.ax(j) - x); if (d < dm) { dm = d; m = j; } }); return m; };
    lienzo.canvas.style.cursor = 'ns-resize';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev), j = eje(x);
      if (j < 0) return;
      arrastre = { j, y0: y, movio: false };
      lienzo.canvas.setPointerCapture(ev.pointerId);
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastre) {
        if (Math.abs(y - arrastre.y0) > 3) arrastre.movio = true;
        if (arrastre.movio) {
          const a = geo.iv(arrastre.j, Math.max(geo.sup, Math.min(geo.inf, arrastre.y0))), b = geo.iv(arrastre.j, Math.max(geo.sup, Math.min(geo.inf, y)));
          filtros[arrastre.j] = [Math.min(a, b), Math.max(a, b)];
          dibujar();
        }
        return;
      }
      const j = geo ? eje(x) : -1;
      if (j < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${VARS[j]}</b><br>valor a esta altura <b>${VIZ.fmt(geo.iv(j, y), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerup', () => {
      if (arrastre && !arrastre.movio) { filtros[arrastre.j] = null; dibujar(); }
      arrastre = null;
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('exploratory-data-analysis', {
    intro: String.raw`
      <p>Antes de aplicar cualquier algoritmo conviene <strong>mirar los datos</strong>: cómo se distribuye cada variable, cuáles
      están relacionadas, si hay grupos visibles, valores atípicos o errores. Eso es el <strong>análisis exploratorio</strong>
      (EDA, por sus siglas en inglés), propuesto por John Tukey como contrapeso a la estadística puramente confirmatoria.</p>
      <p>El problema es que la pantalla tiene dos dimensiones y los datos, muchas. Las matrices de dispersión y las coordenadas
      paralelas son dos formas clásicas de ver varias dimensiones a la vez.</p>`,
    visualizaciones: [
      {
        titulo: 'Matriz de dispersión',
        descripcion: 'Todas las vistas de a pares de cuatro variables de flores sintéticas. Compare la correlación total de un par con la que hay dentro de cada especie.',
        montar: montarMatriz,
      },
      {
        titulo: 'Coordenadas paralelas con filtros',
        descripcion: 'Las cuatro variables como ejes verticales. Filtre por largo de pétalo y observe qué especies quedan y qué valores toman en los otros ejes.',
        montar: montarParalelas,
      },
    ],
    teoria: String.raw`
      <h2>Resúmenes de una variable</h2>
      <p>Posición (media \(\bar x\), mediana), dispersión (desviación \(s\), rango intercuartílico \(Q_3 - Q_1\)) y forma (asimetría,
      colas). El <strong>diagrama de caja</strong> marca como posibles atípicos los valores fuera de
      \([Q_1 - 1{,}5\,\mathrm{IQR},\; Q_3 + 1{,}5\,\mathrm{IQR}]\). El histograma depende del ancho de cubeta; la regla de
      Freedman–Diaconis sugiere \(h = 2\,\mathrm{IQR}\, n^{-1/3}\).</p>
      <h2>Relaciones entre pares</h2>
      \[ r_{xy} = \frac{\sum_i (x_i - \bar x)(y_i - \bar y)}{\sqrt{\sum_i (x_i - \bar x)^2}\,\sqrt{\sum_i (y_i - \bar y)^2}} \in [-1, 1] \]
      <p>mide solo asociación <em>lineal</em>. Una correlación total alta puede deberse a que los grupos tienen medias distintas
      aunque dentro de cada grupo la relación sea débil: es la misma trampa que la
      <a href="tema.html?id=correlation-causation">paradoja de Simpson</a>.</p>
      <h2>Ver muchas dimensiones</h2>
      <table>
        <tr><th>Técnica</th><th>Idea</th><th>Límite</th></tr>
        <tr><td>Matriz de dispersión</td><td>las \(\binom d2\) vistas de a pares</td><td>no muestra interacciones de tres o más variables</td></tr>
        <tr><td>Coordenadas paralelas</td><td>un eje por variable; cada dato es una poligonal</td><td>depende del orden de los ejes; se satura con muchos datos</td></tr>
        <tr><td>Mapa de calor</td><td>la matriz de datos con color</td><td>conviene ordenar filas y columnas (p. ej. por <a href="tema.html?id=hierarchical-clustering">clustering jerárquico</a>)</td></tr>
        <tr><td>Proyecciones</td><td><a href="tema.html?id=pca">PCA</a>, <a href="tema.html?id=t-sne">t-SNE</a>, <a href="tema.html?id=umap">UMAP</a></td><td>distorsionan distancias</td></tr>
      </table>
      <p>En coordenadas paralelas, una correlación negativa entre ejes vecinos produce líneas que se cruzan en un punto, y una
      positiva, líneas casi paralelas. Filtrar con el ratón (<em>brushing</em>) permite hacer consultas visuales del tipo
      «flores con pétalo largo: ¿qué ancho de sépalo tienen?».</p>`,
  });
})();