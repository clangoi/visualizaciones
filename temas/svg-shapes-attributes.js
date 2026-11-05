(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const S = V.svg;

  /* ---------- Fig. 1: constructor de formas ---------- */

  function montarFormas(cuerpo) {
    const f = { tipo: 'rect', a: 60, b: 40, relleno: 's1', trazo: 'tinta', grosor: 3, op: 0.8 };
    const COL = { s1: C.s1, s2: C.s2, s3: C.s3, s7: C.s7, none: 'none', tinta: C.tinta };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Elemento', valor: f.tipo, opciones: [['rect', 'rect'], ['circle', 'circle'], ['ellipse', 'ellipse'], ['line', 'line'], ['polygon', 'polygon'], ['text', 'text']], alCambiar: (v) => { f.tipo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño principal (width / r / rx)', min: 10, max: 100, valor: f.a, alCambiar: (v) => { f.a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño secundario (height / ry)', min: 10, max: 80, valor: f.b, alCambiar: (v) => { f.b = v; dibujar(); } });
    ctl.selector({ etiqueta: 'fill', valor: f.relleno, opciones: [['s1', 'azul'], ['s2', 'naranjo'], ['s3', 'aguamarina'], ['s7', 'violeta'], ['none', 'none']], alCambiar: (v) => { f.relleno = v; dibujar(); } });
    ctl.rango({ etiqueta: 'stroke-width', min: 0, max: 10, valor: f.grosor, alCambiar: (v) => { f.grosor = v; dibujar(); } });
    ctl.rango({ etiqueta: 'opacity', min: 0.1, max: 1, paso: 0.05, valor: f.op, alCambiar: (v) => { f.op = v; dibujar(); } });
    const svg = V.lienzoSvg(cuerpo, 400, 200);
    cuerpo.dataset.sinLeyenda = 'una sola figura; sus atributos se muestran en el código';
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    VIZ.nota(cuerpo, 'Cada control corresponde a un atributo SVG y el código inferior se actualiza con ellos. Pruebe stroke-width 0 con fill none: la figura desaparece.');
    function dibujar() {
      svg.replaceChildren();
      for (let k = 0; k <= 400; k += 50) svg.append(S('line', { x1: k, y1: 0, x2: k, y2: 200, stroke: C.rejilla }));
      for (let k = 0; k <= 200; k += 50) svg.append(S('line', { x1: 0, y1: k, x2: 400, y2: k, stroke: C.rejilla }));
      const comun = { fill: COL[f.relleno], stroke: COL.tinta, 'stroke-width': f.grosor, opacity: f.op };
      let nodo, txt;
      const cx = 200, cy = 100, a = f.a, b = f.b;
      if (f.tipo === 'rect') { nodo = S('rect', Object.assign({ x: cx - a, y: cy - b, width: 2 * a, height: 2 * b, rx: 6 }, comun)); txt = `<rect x="${cx - a}" y="${cy - b}" width="${2 * a}" height="${2 * b}" rx="6"`; }
      else if (f.tipo === 'circle') { nodo = S('circle', Object.assign({ cx, cy, r: a / 1.2 }, comun)); txt = `<circle cx="${cx}" cy="${cy}" r="${Math.round(a / 1.2)}"`; }
      else if (f.tipo === 'ellipse') { nodo = S('ellipse', Object.assign({ cx, cy, rx: a, ry: b }, comun)); txt = `<ellipse cx="${cx}" cy="${cy}" rx="${a}" ry="${b}"`; }
      else if (f.tipo === 'line') { nodo = S('line', { x1: cx - a, y1: cy + b, x2: cx + a, y2: cy - b, stroke: COL.tinta, 'stroke-width': Math.max(f.grosor, 1), opacity: f.op }); txt = `<line x1="${cx - a}" y1="${cy + b}" x2="${cx + a}" y2="${cy - b}"`; }
      else if (f.tipo === 'polygon') { const pts = `${cx},${cy - b} ${cx + a},${cy + b} ${cx - a},${cy + b}`; nodo = S('polygon', Object.assign({ points: pts }, comun)); txt = `<polygon points="${pts}"`; }
      else { nodo = S('text', Object.assign({ x: cx, y: cy + b / 3, 'text-anchor': 'middle', style: `font-size:${a}px;font-family:IBM Plex Sans,sans-serif` }, comun)); nodo.textContent = 'Aa'; txt = `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${a}"`; }
      svg.append(nodo);
      const attrs = f.tipo === 'line' ? ` stroke="tinta" stroke-width="${Math.max(f.grosor, 1)}" opacity="${f.op}"/>` : ` fill="${f.relleno === 'none' ? 'none' : COL[f.relleno]}"\n       stroke="tinta" stroke-width="${f.grosor}" opacity="${f.op}"${f.tipo === 'text' ? '>Aa</text>' : '/>'}`;
      codigo.textContent = txt + attrs;
    }
    dibujar();
  }

  /* ---------- Fig. 2: orden de pintado y opacidad ---------- */

  function montarCapas(cuerpo) {
    let orden = [0, 1, 2], sel = 1, op = 0.7, tipoOp = 'fill-opacity';
    const COLS = [C.s1, C.s2, C.s3], POS = [[150, 90], [200, 120], [250, 90]], NOM = ['A (azul)', 'B (naranjo)', 'C (aguamarina)'];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Círculo', valor: String(sel), opciones: NOM.map((n, i) => [String(i), n]), alCambiar: (v) => { sel = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Atributo de transparencia', valor: tipoOp, opciones: [['fill-opacity', 'fill-opacity (solo el relleno)'], ['opacity', 'opacity (todo el elemento)']], alCambiar: (v) => { tipoOp = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Valor', min: 0.1, max: 1, paso: 0.05, valor: op, alCambiar: (v) => { op = v; dibujar(); } });
    ctl.boton('Traer al frente', () => { orden = orden.filter((i) => i !== sel).concat(sel); dibujar(); }, { primario: true });
    ctl.boton('Enviar al fondo', () => { orden = [sel, ...orden.filter((i) => i !== sel)]; dibujar(); });
    const svg = V.lienzoSvg(cuerpo, 400, 200);
    VIZ.leyenda(cuerpo, NOM.map((n, i) => ({ color: COLS[i], texto: n })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'SVG no tiene «z-index»: lo último que aparece en el documento se pinta encima. Elija un círculo y muévalo en el orden; haga clic en uno para seleccionarlo.');
    function dibujar() {
      svg.replaceChildren();
      orden.forEach((i) => {
        const atr = { cx: POS[i][0], cy: POS[i][1], r: 55, fill: COLS[i], stroke: C.tinta, 'stroke-width': i === sel ? 3 : 1, class: 'arrastrable', onclick: () => { sel = i; dibujar(); } };
        atr[i === sel ? tipoOp : 'fill-opacity'] = i === sel ? op : 0.85;
        svg.append(S('circle', atr));
      });
      registro.textContent = `Orden de pintado (de atrás hacia adelante): ${orden.map((i) => 'ABC'[i]).join(' → ')}. ${tipoOp === 'opacity' ? 'opacity atenúa también el borde.' : 'fill-opacity deja el borde intacto.'}`;
    }
    dibujar();
  }

  VIZ.registrarTema('svg-shapes-attributes', {
    intro: String.raw`
      <p>SVG ofrece un puñado de formas básicas —<code>rect</code>, <code>circle</code>, <code>ellipse</code>, <code>line</code>, <code>polygon</code> y <code>text</code>— y cada una se describe con
      <strong>atributos</strong>: posición, tamaño, relleno, borde, transparencia. Un gráfico es una colección de estas formas colocadas según los datos.</p>
      <p>A diferencia de CSS no hay capas con <code>z-index</code>: el <strong>orden en el documento</strong> es el orden de pintado.</p>`,
    visualizaciones: [
      { titulo: 'Formas y sus atributos', descripcion: 'Elija una forma y modifique tamaño, relleno, grosor y opacidad; el código muestra el elemento equivalente.', montar: montarFormas },
      { titulo: 'Capas y transparencia', descripcion: 'Reordene tres círculos superpuestos y compare fill-opacity con opacity.', montar: montarCapas },
    ],
    teoria: String.raw`
      <h2>Formas y atributos geométricos</h2>
      <table>
        <tr><th>Elemento</th><th>Atributos clave</th></tr>
        <tr><td><code>rect</code></td><td>x, y, width, height, rx, ry</td></tr>
        <tr><td><code>circle</code></td><td>cx, cy, r</td></tr>
        <tr><td><code>ellipse</code></td><td>cx, cy, rx, ry</td></tr>
        <tr><td><code>line</code></td><td>x1, y1, x2, y2 (solo tiene <code>stroke</code>)</td></tr>
        <tr><td><code>polygon</code></td><td>points</td></tr>
        <tr><td><code>text</code></td><td>x, y, text-anchor, font-size</td></tr>
      </table>
      <h2>Atributos de presentación</h2>
      <p><code>fill</code> (relleno), <code>stroke</code> (color del borde), <code>stroke-width</code>, <code>stroke-dasharray</code>, <code>opacity</code>, <code>fill-opacity</code> y <code>stroke-opacity</code>.
      El borde se centra sobre el contorno: la mitad queda fuera. Un <code>rect</code> de ancho \(w\) y borde \(s\) ocupa visualmente \(w + s\).</p>
      <h2>Opacidad y mezcla</h2>
      <p>Al superponer dos colores con opacidad \(\alpha\), el color resultante sigue la mezcla alfa:
      \[ c_{\text{res}} = \alpha\,c_{\text{frente}} + (1 - \alpha)\,c_{\text{fondo}}. \]
      Con <code>opacity</code> el elemento completo se compone como una unidad; con <code>fill-opacity</code> solo se atenúa el relleno y el borde se ve completo.</p>
      <h2>Orden de pintado</h2>
      <p>Cada elemento se pinta sobre lo anterior (<em>algoritmo del pintor</em>), así que traer una figura al frente es moverla al final de su contenedor. Es útil para resaltar una marca en un gráfico: se reinserta al final con <code>appendChild</code>.
      Para agrupar y transformar varias formas, ver <a href="tema.html?id=svg-transforms-groups">grupos</a>.</p>`,
  });
})();
