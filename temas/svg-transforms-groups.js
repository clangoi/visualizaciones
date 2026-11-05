(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const S = V.svg;

  /* ---------- Fig. 1: el orden de las transformaciones ---------- */

  function montarTransformar(cuerpo) {
    const e = { tx: 120, ty: 40, rot: 30, esc: 1, orden: 'tr' };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'translate x', min: 0, max: 250, valor: e.tx, alCambiar: (v) => { e.tx = v; dibujar(); } });
    ctl.rango({ etiqueta: 'translate y', min: 0, max: 120, valor: e.ty, alCambiar: (v) => { e.ty = v; dibujar(); } });
    ctl.rango({ etiqueta: 'rotate', min: -180, max: 180, valor: e.rot, formato: (v) => `${v}°`, alCambiar: (v) => { e.rot = v; dibujar(); } });
    ctl.rango({ etiqueta: 'scale', min: 0.3, max: 2, paso: 0.1, valor: e.esc, alCambiar: (v) => { e.esc = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Orden', valor: e.orden, opciones: [['tr', 'translate → rotate'], ['rt', 'rotate → translate']], alCambiar: (v) => { e.orden = v; dibujar(); } });
    const svg = V.lienzoSvg(cuerpo, 400, 220);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'figura original', forma: 'linea' }, { color: C.s2, texto: 'figura transformada' }]);
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    VIZ.nota(cuerpo, 'Rote 30° y cambie el orden: se obtienen figuras distintas. Las transformaciones se leen de derecha a izquierda sobre los puntos, pero de izquierda a derecha sobre los ejes.');
    function dibujar() {
      svg.replaceChildren();
      for (let k = 0; k <= 400; k += 50) svg.append(S('line', { x1: k, y1: 0, x2: k, y2: 220, stroke: C.rejilla }));
      for (let k = 0; k <= 220; k += 50) svg.append(S('line', { x1: 0, y1: k, x2: 400, y2: k, stroke: C.rejilla }));
      const base = S('g'); base.append(S('rect', { x: 0, y: 0, width: 70, height: 40, fill: 'none', stroke: C.apagado, 'stroke-dasharray': '3 3' }), S('circle', { cx: 0, cy: 0, r: 4, fill: C.apagado }));
      svg.append(base);
      const t = e.orden === 'tr' ? `translate(${e.tx} ${e.ty}) rotate(${e.rot}) scale(${e.esc})` : `rotate(${e.rot}) translate(${e.tx} ${e.ty}) scale(${e.esc})`;
      const g = S('g', { transform: t });
      g.append(S('rect', { x: 0, y: 0, width: 70, height: 40, fill: VIZ.alfa(C.s2, 0.6), stroke: C.s2, 'stroke-width': 2 }), S('circle', { cx: 0, cy: 0, r: 4, fill: C.s8 }), S('line', { x1: 0, y1: 0, x2: 30, y2: 0, stroke: C.s8, 'stroke-width': 2 }), S('line', { x1: 0, y1: 0, x2: 0, y2: 30, stroke: C.s1, 'stroke-width': 2 }));
      svg.append(g);
      codigo.textContent = `<g transform="${t}">\n  <rect width="70" height="40"/>\n</g>`;
    }
    dibujar();
  }

  /* ---------- Fig. 2: grupos y la convención de márgenes ---------- */

  function montarMargenes(cuerpo) {
    const m = { izq: 40, sup: 20, der: 20, inf: 36 };
    let marco = true;
    const datos = [['A', 42], ['B', 68], ['C', 35], ['D', 80], ['E', 55]];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'margen izquierdo', min: 10, max: 90, valor: m.izq, alCambiar: (v) => { m.izq = v; dibujar(); } });
    ctl.rango({ etiqueta: 'margen superior', min: 5, max: 60, valor: m.sup, alCambiar: (v) => { m.sup = v; dibujar(); } });
    ctl.rango({ etiqueta: 'margen inferior', min: 10, max: 70, valor: m.inf, alCambiar: (v) => { m.inf = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar el marco del grupo', valor: marco, alCambiar: (v) => { marco = v; dibujar(); } });
    const svg = V.lienzoSvg(cuerpo, 400, 220);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'barras dentro del grupo <g>' }, { color: C.s2, texto: 'área interior (ancho × alto)', forma: 'linea' }]);
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todo lo que está dentro del <code>&lt;g&gt;</code> se dibuja con coordenadas locales, como si el origen fuera la esquina del marco. Cambie los márgenes: el código de las barras no cambia.');
    function dibujar() {
      const W = 400 - m.izq - 20, H = 220 - m.sup - m.inf;
      svg.replaceChildren();
      const g = S('g', { transform: `translate(${m.izq},${m.sup})` });
      const paso = W / datos.length;
      if (marco) g.append(S('rect', { x: 0, y: 0, width: W, height: H, fill: VIZ.alfa(C.s2, 0.06), stroke: C.s2, 'stroke-dasharray': '4 3' }));
      datos.forEach(([n, v], i) => {
        const h = (v / 100) * H;
        g.append(S('rect', { x: i * paso + 6, y: H - h, width: paso - 12, height: h, fill: C.s1 }), S('text', { x: i * paso + paso / 2, y: H + 14, 'text-anchor': 'middle' }, n));
      });
      g.append(S('line', { x1: 0, y1: H, x2: W, y2: H, stroke: C.eje }), S('text', { x: -6, y: 4, 'text-anchor': 'end' }, '100'), S('text', { x: -6, y: H, 'text-anchor': 'end' }, '0'));
      svg.append(g);
      codigo.textContent = `<g transform="translate(${m.izq},${m.sup})">   <!-- origen local = esquina del marco -->\n  <rect x="6" y="${Math.round(H - (42 / 100) * H)}" width="${Math.round(paso - 12)}" height="${Math.round((42 / 100) * H)}"/>\n  …\n</g>`;
      lectura.set([['ancho interior', `${Math.round(W)}`], ['alto interior', `${Math.round(H)}`], ['barra A', `y = ${Math.round(H - (42 / 100) * H)}`]]);
    }
    dibujar();
  }

  VIZ.registrarTema('svg-transforms-groups', {
    intro: String.raw`
      <p>Una <strong>transformación</strong> mueve, gira o escala todo un elemento sin tocar sus coordenadas internas. El elemento <code>&lt;g&gt;</code> agrupa varias formas para transformarlas, estilizarlas y manejarlas como una sola.</p>
      <p>Ese par —grupo + <code>translate</code>— es la base de la <em>convención de márgenes</em> con la que se arman casi todos los gráficos: se dibuja en un sistema local y el grupo lo coloca en la página.</p>`,
    visualizaciones: [
      { titulo: 'Traslación, rotación y escala', descripcion: 'Combine las tres transformaciones e invierta el orden: rotar y luego trasladar no es lo mismo que trasladar y luego rotar.', montar: montarTransformar },
      { titulo: 'Grupos y márgenes', descripcion: 'Cambie los márgenes de un gráfico de barras: el grupo se desplaza y las barras conservan sus coordenadas locales.', montar: montarMargenes },
    ],
    teoria: String.raw`
      <h2>Transformaciones como matrices</h2>
      <p>Cada transformación 2D es una matriz de \(3 \times 3\) en coordenadas homogéneas:
      \[ T(t_x,t_y)=\begin{pmatrix}1&0&t_x\\0&1&t_y\\0&0&1\end{pmatrix},\quad
      R(\theta)=\begin{pmatrix}\cos\theta&-\sin\theta&0\\ \sin\theta&\cos\theta&0\\0&0&1\end{pmatrix},\quad
      S(s)=\begin{pmatrix}s&0&0\\0&s&0\\0&0&1\end{pmatrix}. \]
      La lista <code>transform="translate(…) rotate(…)"</code> se multiplica de izquierda a derecha: \(M = T \cdot R\), y se aplica al punto como \(M\,\mathbf{p}\), es decir, primero rota y luego traslada <em>los puntos</em>.
      Como \(TR \neq RT\) en general, el orden importa.</p>
      <h2>Rotar alrededor de un punto</h2>
      <p>Para girar \(\theta\) alrededor de \((c_x, c_y)\): <code>rotate(θ, cx, cy)</code>, equivalente a \(T(c)\,R(\theta)\,T(-c)\).</p>
      <h2>Grupos</h2>
      <p>Los atributos de un <code>&lt;g&gt;</code> (<code>fill</code>, <code>opacity</code>, <code>transform</code>) los heredan sus hijos, y los grupos se anidan: la transformación efectiva de un elemento es el producto de las de todos sus ancestros.</p>
      <h2>Convención de márgenes</h2>
      <p>Con márgenes \(m_{\text{izq}}, m_{\text{sup}}, \dots\) el área interior mide
      \[ w = W - m_{\text{izq}} - m_{\text{der}}, \qquad h = H - m_{\text{sup}} - m_{\text{inf}}, \]
      y todo el gráfico se dibuja con origen en \((0,0)\) dentro de <code>&lt;g transform="translate(m_izq, m_sup)"&gt;</code>. Las <a href="tema.html?id=d3-scales-axes">escalas</a> usan rangos \([0, w]\) y \([h, 0]\).</p>`,
  });
})();
