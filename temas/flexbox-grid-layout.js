(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: Flexbox ---------- */

  function montarFlex(cuerpo) {
    const est = { dir: 'row', justify: 'flex-start', align: 'stretch', wrap: 'nowrap', gap: 8, n: 5, grow: false };
    let semilla = 1, cajas = [];
    const ctl = VIZ.controles(cuerpo);
    const op = (l) => l.map((v) => [v, v]);
    ctl.selector({ etiqueta: 'flex-direction', valor: est.dir, opciones: op(['row', 'column']), alCambiar: (v) => { est.dir = v; dibujar(); } });
    ctl.selector({ etiqueta: 'justify-content (eje principal)', valor: est.justify, opciones: op(['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']), alCambiar: (v) => { est.justify = v; dibujar(); } });
    ctl.selector({ etiqueta: 'align-items (eje cruzado)', valor: est.align, opciones: op(['stretch', 'flex-start', 'center', 'flex-end']), alCambiar: (v) => { est.align = v; dibujar(); } });
    ctl.selector({ etiqueta: 'flex-wrap', valor: est.wrap, opciones: op(['nowrap', 'wrap']), alCambiar: (v) => { est.wrap = v; dibujar(); } });
    ctl.rango({ etiqueta: 'gap', min: 0, max: 24, valor: est.gap, formato: (v) => `${v} px`, alCambiar: (v) => { est.gap = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Elementos', min: 2, max: 9, valor: est.n, alCambiar: (v) => { est.n = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'flex-grow: 1 en todos', valor: false, alCambiar: (v) => { est.grow = v; dibujar(); } });
    ctl.boton('Nuevos tamaños', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 250 : 230) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'elementos' }, { color: C.s2, texto: 'eje principal (justify)' }, { color: C.s3, texto: 'eje cruzado (align)' }, { color: C.s8, texto: 'desborda el contenedor' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los elementos tienen tamaños distintos. Con <code>nowrap</code> y muchos elementos, observe cómo se aprietan o desbordan; con <code>wrap</code> pasan a una nueva línea.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(semilla * 13 + est.n);
      const tam = Array.from({ length: est.n }, () => ({ a: 36 + Math.floor(rnd() * 50), b: 26 + Math.floor(rnd() * 46) }));
      const fila = est.dir === 'row', gap = est.gap, pad = 6;
      const X = pad + 16, Y = pad + 14, CW = W - X - pad, CH = H - Y - pad - 4;
      const P = fila ? CW : CH, T = fila ? CH : CW; // tamaño principal y cruzado del contenedor
      // Reparto en líneas.
      const lineas = [[]];
      let usado = 0;
      tam.forEach((t, i) => {
        const s = fila ? t.a : t.b;
        if (est.wrap === 'wrap' && lineas[lineas.length - 1].length && usado + gap + s > P) { lineas.push([]); usado = 0; }
        usado += (lineas[lineas.length - 1].length ? gap : 0) + s; lineas[lineas.length - 1].push(i);
      });
      cajas = [];
      const hLinea = est.wrap === 'wrap' ? (T - gap * (lineas.length - 1)) / lineas.length : T;
      let desborda = false;
      lineas.forEach((ids, li) => {
        const suma = ids.reduce((s, i) => s + (fila ? tam[i].a : tam[i].b), 0) + gap * (ids.length - 1);
        const libre = P - suma;
        let tamanos = ids.map((i) => (fila ? tam[i].a : tam[i].b));
        if (est.grow && libre > 0) tamanos = tamanos.map((s) => s + libre / ids.length);
        else if (libre < 0 && est.wrap === 'nowrap') { // flex-shrink: 1
          const f = (P - gap * (ids.length - 1)) / (suma - gap * (ids.length - 1)); tamanos = tamanos.map((s) => s * f);
          if (tamanos.some((s, k) => s < 14)) desborda = true;
        }
        const total = tamanos.reduce((a, b) => a + b, 0) + gap * (ids.length - 1), sobra = Math.max(0, P - total);
        let inicio = 0, sep = gap;
        const n = ids.length;
        switch (est.justify) {
          case 'center': inicio = sobra / 2; break;
          case 'flex-end': inicio = sobra; break;
          case 'space-between': sep = n > 1 ? gap + sobra / (n - 1) : gap; break;
          case 'space-around': inicio = sobra / n / 2; sep = gap + sobra / n; break;
          case 'space-evenly': inicio = sobra / (n + 1); sep = gap + sobra / (n + 1); break;
          default:
        }
        let pos = inicio;
        ids.forEach((i, k) => {
          const cruz0 = fila ? tam[i].b : tam[i].a, cruz = est.align === 'stretch' ? hLinea : Math.min(cruz0, hLinea);
          const off = li * (hLinea + gap) + (est.align === 'center' ? (hLinea - cruz) / 2 : est.align === 'flex-end' ? hLinea - cruz : 0);
          const px = fila ? X + pos : X + off, py = fila ? Y + off : Y + pos, w = fila ? tamanos[k] : cruz, h = fila ? cruz : tamanos[k];
          cajas.push({ i, x: px, y: py, w, h });
          pos += tamanos[k] + sep;
        });
      });
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(X, Y, CW, CH); ctx.setLineDash([]);
      cajas.forEach((b) => {
        const fuera = b.x + b.w > X + CW + 1 || b.y + b.h > Y + CH + 1;
        ctx.fillStyle = VIZ.alfa(fuera ? C.s8 : C.s1, 0.25); ctx.strokeStyle = fuera ? C.s8 : C.s1; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 3); ctx.fill(); ctx.stroke();
        VIZ.web.texto(ctx, String(b.i + 1), b.x + b.w / 2, b.y + b.h / 2, { tam: 12, peso: 600 });
      });
      const principal = { color: C.s2, ancho: 2 }, cruzado = { color: C.s3, ancho: 2 };
      VIZ.dist.flecha(ctx, X, Y - 8, X + (fila ? CW : 44), Y - 8, fila ? principal : cruzado);
      VIZ.dist.flecha(ctx, X - 8, Y, X - 8, Y + (fila ? 44 : CH), fila ? cruzado : principal);
      registro.textContent = `${fila ? 'row' : 'column'}: el eje principal va ${fila ? 'horizontal' : 'vertical'}. justify-content reparte el espacio libre a lo largo de él (${lineas.length} línea(s)); align-items alinea en el eje cruzado.`;
      lectura.set([['líneas', String(lineas.length)], ['espacio libre (principal)', `${Math.round(P - lineas[0].reduce((s, i) => s + (fila ? tam[i].a : tam[i].b), 0) - gap * (lineas[0].length - 1))} px`], ['elementos que no caben', desborda ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = cajas.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); if (!b) return tip.ocultar(); tip.mostrar(x, y, `elemento <b>${b.i + 1}</b><br>${Math.round(b.w)} × ${Math.round(b.h)} px`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: Grid ---------- */

  const PLANTILLAS = {
    '3': { t: 'repeat(3, 1fr)', cols: () => [1, 1, 1] },
    '121': { t: '1fr 2fr 1fr', cols: () => [1, 2, 1] },
    fijo: { t: '120px 1fr', cols: () => ['120', 1] },
    auto: { t: 'repeat(auto-fill, minmax(90px, 1fr))', auto: 90 },
  };

  function montarGrid(cuerpo) {
    const est = { plantilla: '3', gap: 8, n: 8, span: 1 };
    let celdas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'grid-template-columns', valor: est.plantilla, opciones: Object.entries(PLANTILLAS).map(([k, p]) => [k, p.t]), alCambiar: (v) => { est.plantilla = v; dibujar(); } });
    ctl.rango({ etiqueta: 'gap', min: 0, max: 24, valor: est.gap, formato: (v) => `${v} px`, alCambiar: (v) => { est.gap = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Elementos', min: 2, max: 14, valor: est.n, alCambiar: (v) => { est.n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'El elemento 1 ocupa (grid-column: span …)', min: 1, max: 3, valor: est.span, formato: (v) => `${v} col.`, alCambiar: (v) => { est.span = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 260 : 240) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'elemento' }, { color: C.s6, texto: 'elemento que abarca varias columnas' }, { color: C.eje, texto: 'columnas (pistas)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con <code>auto-fill</code> el número de columnas depende del ancho disponible: cambie el tamaño de la ventana y se recalcula.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const P = PLANTILLAS[est.plantilla], gap = est.gap, m = 6, ancho = W - 2 * m;
      let cols;
      if (P.auto) { const k = Math.max(1, Math.floor((ancho + gap) / (P.auto + gap))); cols = Array(k).fill(1); } else cols = P.cols();
      const fijo = cols.reduce((s, c) => s + (typeof c === 'string' ? +c : 0), 0), fr = cols.reduce((s, c) => s + (typeof c === 'number' ? c : 0), 0);
      const libre = ancho - fijo - gap * (cols.length - 1);
      const w = cols.map((c) => (typeof c === 'string' ? +c : (c / fr) * libre));
      const xs = []; w.reduce((x, wi, i) => { xs[i] = x; return x + wi + gap; }, m);
      // Colocación automática por filas.
      const span = Math.min(est.span, cols.length), ocupado = new Set(); celdas = [];
      let fila = 0, col = 0;
      for (let i = 0; i < est.n; i++) {
        const s = i === 0 ? span : 1;
        while (true) {
          if (col + s > cols.length) { fila++; col = 0; }
          let libreK = true; for (let k = 0; k < s; k++) if (ocupado.has(`${fila},${col + k}`)) libreK = false;
          if (libreK) break; col++;
        }
        for (let k = 0; k < s; k++) ocupado.add(`${fila},${col + k}`);
        celdas.push({ i, fila, col, s }); col += s;
      }
      const filas = Math.max(...celdas.map((c) => c.fila)) + 1, alto = Math.min(52, (lienzo.alto - 2 * m - gap * (filas - 1)) / filas);
      ctx.fillStyle = VIZ.alfa(C.eje, 0.25);
      w.forEach((wi, k) => ctx.fillRect(xs[k], 0, wi, lienzo.alto));
      celdas.forEach((c) => {
        c.x = xs[c.col]; c.y = m + c.fila * (alto + gap); c.w = xs[c.col + c.s - 1] + w[c.col + c.s - 1] - xs[c.col]; c.h = alto;
        const ancha = c.s > 1;
        ctx.fillStyle = VIZ.alfa(ancha ? C.s6 : C.s1, 0.3); ctx.strokeStyle = ancha ? C.s6 : C.s1; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 3); ctx.fill(); ctx.stroke();
        VIZ.web.texto(ctx, String(c.i + 1), c.x + c.w / 2, c.y + c.h / 2, { tam: 12, peso: 600 });
      });
      registro.textContent = P.auto ? `auto-fill calcula ${cols.length} columna(s) de al menos ${P.auto} px que caben en ${Math.round(ancho)} px.` : `La plantilla «${P.t}» reparte ${Math.round(libre)} px libres según las fracciones (fr).`;
      lectura.set([['columnas', String(cols.length)], ['filas', String(filas)], ['ancho de las columnas', w.map((x) => Math.round(x)).join(' · ') + ' px']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = celdas.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h); if (!c) return tip.ocultar(); tip.mostrar(x, y, `elemento <b>${c.i + 1}</b><br>fila ${c.fila + 1}, columna ${c.col + 1}${c.s > 1 ? ` (abarca ${c.s})` : ''}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('flexbox-grid-layout', {
    intro: String.raw`
      <p>Durante años se maquetaba con trucos (tablas, <code>float</code>). Hoy hay dos herramientas hechas para ello:
      <strong>Flexbox</strong> reparte elementos a lo largo de <em>una dimensión</em> (una fila o una columna) y
      <strong>Grid</strong> los coloca en una <em>rejilla de dos dimensiones</em>.</p>
      <p>En ambos, el contenedor decide cómo distribuir el espacio sobrante entre sus hijos; usted describe la intención («centrado», «tres columnas iguales») y el navegador calcula las posiciones.</p>`,
    visualizaciones: [
      {
        titulo: 'Flexbox: ejes y reparto',
        descripcion: 'Cambie la dirección y las propiedades de alineación. Active <code>wrap</code> con muchos elementos, o <code>flex-grow</code>, y observe cómo cambia el espacio libre.',
        montar: montarFlex,
      },
      {
        titulo: 'Grid: columnas y fracciones',
        descripcion: 'Pruebe distintas plantillas de columnas y haga que el primer elemento abarque varias; con <code>auto-fill</code> las columnas aparecen según el ancho.',
        montar: montarGrid,
      },
    ],
    teoria: String.raw`
      <h2>Flexbox</h2>
      <p>Un contenedor con <code>display: flex</code> define un <strong>eje principal</strong> (<code>flex-direction</code>) y un <strong>eje cruzado</strong> perpendicular.</p>
      <table>
        <tr><th>Propiedad</th><th>Actúa sobre</th></tr>
        <tr><td><code>justify-content</code></td><td>reparto del espacio libre en el eje principal</td></tr>
        <tr><td><code>align-items</code></td><td>posición de cada elemento en el eje cruzado</td></tr>
        <tr><td><code>flex-wrap</code></td><td>si pasan a otra línea cuando no caben</td></tr>
        <tr><td><code>gap</code></td><td>separación entre elementos</td></tr>
        <tr><td><code>flex: grow shrink basis</code></td><td>cuánto crece, se encoge y tamaño inicial</td></tr>
      </table>
      <p>Si \(S\) es la suma de tamaños y \(P\) el espacio principal, el espacio libre es \(L = P - S\). Con <code>flex-grow</code> \(g_i\), cada elemento recibe \(L \cdot g_i / \sum g_j\); si \(L &lt; 0\), <code>flex-shrink</code> reparte la reducción de forma proporcional.</p>
      <h2>Grid</h2>
      <p>Con <code>display: grid</code> se declaran pistas: <code>grid-template-columns: 1fr 2fr 1fr</code> reparte el espacio libre en 4 partes. Una unidad <code>fr</code> vale</p>
      \[ 1\,\text{fr} = \frac{\text{ancho} - \text{pistas fijas} - \text{gaps}}{\sum \text{fr}}. \]
      <p><code>repeat(auto-fill, minmax(90px, 1fr))</code> crea tantas columnas de al menos 90 px como quepan: \(k = \lfloor (A + g) / (90 + g) \rfloor\).</p>
      <div class="recuadro">¿Cuál usar? Flexbox para componentes lineales (barras, tarjetas en fila, centrar); Grid para la estructura de la página y cuadrículas. Se combinan: una rejilla cuyas celdas son contenedores flex. Para adaptarlos a cada pantalla, vea <a href="tema.html?id=responsive-design">diseño responsivo</a>.</div>`,
  });
})();
