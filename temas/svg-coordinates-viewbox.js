(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const S = V.svg;

  // Escena de 100 × 100 unidades de usuario: rejilla, marco y tres figuras.
  function escena(g) {
    for (let k = 0; k <= 100; k += 10) {
      g.append(S('line', { x1: k, y1: 0, x2: k, y2: 100, stroke: C.rejilla, 'stroke-width': 0.4 }), S('line', { x1: 0, y1: k, x2: 100, y2: k, stroke: C.rejilla, 'stroke-width': 0.4 }));
      if (k % 20 === 0 && k > 0) g.append(S('text', { x: k + 1, y: 4, style: 'font-size:3.5px' }, k), S('text', { x: 1, y: k - 1, style: 'font-size:3.5px' }, k));
    }
    g.append(S('rect', { x: 0, y: 0, width: 100, height: 100, fill: 'none', stroke: C.eje, 'stroke-width': 0.8 }),
      S('rect', { x: 12, y: 14, width: 30, height: 20, fill: VIZ.alfa(C.s1, 0.7) }),
      S('circle', { cx: 68, cy: 32, r: 14, fill: VIZ.alfa(C.s2, 0.7) }),
      S('path', { d: 'M20 80 L50 58 L80 84 Z', fill: VIZ.alfa(C.s3, 0.7) }));
  }

  /* ---------- Fig. 1: viewBox y preserveAspectRatio ---------- */

  function montarViewBox(cuerpo) {
    const vb = { x: 0, y: 0, w: 100, h: 100 };
    let par = 'xMidYMid meet';
    const ctl = VIZ.controles(cuerpo);
    for (const [k, t, min, max] of [['x', 'min-x', -50, 100], ['y', 'min-y', -50, 100], ['w', 'width', 20, 200], ['h', 'height', 20, 200]]) {
      ctl.rango({ etiqueta: t, min, max, valor: vb[k], alCambiar: (v) => { vb[k] = v; dibujar(); } });
    }
    ctl.selector({ etiqueta: 'preserveAspectRatio', valor: par, opciones: [['xMidYMid meet', 'meet (cabe entera)'], ['xMidYMid slice', 'slice (llena y recorta)'], ['none', 'none (deforma)']], alCambiar: (v) => { par = v; dibujar(); } });
    ctl.boton('Restablecer', () => { Object.assign(vb, { x: 0, y: 0, w: 100, h: 100 }); par = 'xMidYMid meet'; dibujar(); });
    const svg = V.lienzoSvg(cuerpo, 400, 220, { 'aria-label': 'Ventana que muestra una porción del plano de usuario' });
    cuerpo.dataset.sinLeyenda = 'las figuras se rotulan por sus coordenadas en la rejilla';
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El marco gris es el plano completo (0–100). El viewBox decide qué parte se ve: reduzca width y height para acercar, mueva min-x y min-y para desplazar.');
    const interior = S('svg', { x: 0, y: 0, width: 400, height: 220 });
    const g = S('g');
    escena(g);
    svg.append(S('rect', { width: 400, height: 220, fill: C.fondo2 }), interior);
    interior.append(g);
    function dibujar() {
      interior.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      interior.setAttribute('preserveAspectRatio', par);
      codigo.textContent = `<svg width="400" height="220"\n     viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"\n     preserveAspectRatio="${par}">`;
      const k = par === 'none' ? [400 / vb.w, 220 / vb.h] : par.includes('slice') ? [Math.max(400 / vb.w, 220 / vb.h), Math.max(400 / vb.w, 220 / vb.h)] : [Math.min(400 / vb.w, 220 / vb.h), Math.min(400 / vb.w, 220 / vb.h)];
      lectura.set([['unidades visibles', `${vb.w} × ${vb.h}`], ['escala x · y', `${VIZ.fmt(k[0], 3)} · ${VIZ.fmt(k[1], 3)} px por unidad`], ['aspecto', k[0] === k[1] ? 'se conserva' : 'deformado']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: el eje y apunta hacia abajo ---------- */

  function montarEjeY(cuerpo) {
    let invertir = false;
    const datos = [30, 55, 80, 45, 65];
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Corregir el eje y (y = alto − valor)', valor: invertir, alCambiar: (v) => { invertir = v; dibujar(); } });
    const svg = V.lienzoSvg(cuerpo, 400, 200);
    cuerpo.dataset.sinLeyenda = 'rótulos directos en la figura';
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el cursor sobre el dibujo para ver sus coordenadas de usuario. Sin corregir, la barra de valor 80 «cuelga» desde y = 20 hacia abajo.');
    const base = 170;
    function dibujar() {
      svg.replaceChildren(S('line', { x1: 30, y1: base, x2: 390, y2: base, stroke: C.eje }), S('text', { x: 4, y: 12 }, 'y = 0 arriba'), S('text', { x: 4, y: base + 12 }, 'y = 170'));
      datos.forEach((v, i) => {
        const h = v * 1.4, x = 50 + i * 68;
        const y = invertir ? base - h : 10;
        svg.append(S('rect', { x, y, width: 44, height: h, fill: invertir ? C.s1 : C.s8, 'fill-opacity': 0.85 }), S('text', { x: x + 22, y: Math.max(10, y - 3), 'text-anchor': 'middle', style: 'fill:' + C.tinta }, v));
      });
      codigo.textContent = invertir ? '<rect x="50" y="' + (base - 80 * 1.4) + '" width="44" height="' + 80 * 1.4 + '"/>   <!-- y = base − altura -->'
        : '<rect x="50" y="10" width="44" height="' + 80 * 1.4 + '"/>   <!-- y fijo: la barra cuelga -->';
    }
    svg.addEventListener('pointermove', (ev) => { const p = V.puntoSvg(svg, ev); lectura.set([['x de usuario', VIZ.fmt(p.x, 4)], ['y de usuario', VIZ.fmt(p.y, 4)], ['valor en y', VIZ.fmt(base - p.y, 3)]]); });
    lectura.set([['x de usuario', '—'], ['y de usuario', '—'], ['valor en y', '—']]);
    dibujar();
  }

  VIZ.registrarTema('svg-coordinates-viewbox', {
    intro: String.raw`
      <p><strong>SVG</strong> (<em>Scalable Vector Graphics</em>) dibuja con coordenadas matemáticas, no con píxeles: un círculo es «centro y radio», y por eso se ve nítido a cualquier tamaño.</p>
      <p>Dos ideas lo gobiernan: el <strong>sistema de coordenadas</strong> (el origen está arriba a la izquierda y la <em>y</em> crece hacia abajo) y el <strong>viewBox</strong>, la ventana que dice qué porción del plano se muestra y con qué escala.</p>`,
    visualizaciones: [
      { titulo: 'viewBox: la ventana sobre el plano', descripcion: 'Cambie el rectángulo del viewBox para acercar o desplazar la escena, y pruebe los tres modos de preserveAspectRatio con un viewBox de otra proporción.', montar: montarViewBox },
      { titulo: 'El eje y apunta hacia abajo', descripcion: 'Dibuje las barras sin corregir y luego con y = alto − valor; pase el cursor para leer coordenadas.', montar: montarEjeY },
    ],
    teoria: String.raw`
      <h2>Tres sistemas de coordenadas</h2>
      <p>El elemento <code>&lt;svg width="400" height="220" viewBox="0 0 100 100"&gt;</code> tiene un tamaño en pantalla (400 × 220 px) y un <em>sistema de usuario</em> (100 × 100 unidades). El navegador
      calcula la transformación entre ambos:
      \[ s_x = \frac{W_{\text{pantalla}}}{w_{\text{viewBox}}}, \qquad s_y = \frac{H_{\text{pantalla}}}{h_{\text{viewBox}}}, \qquad
      \begin{pmatrix}x_p\\y_p\end{pmatrix} = \begin{pmatrix}s_x (x - x_0)\\ s_y (y - y_0)\end{pmatrix}. \]</p>
      <h2>preserveAspectRatio</h2>
      <p>Si \(s_x \neq s_y\) hay que elegir: <code>meet</code> usa \(\min(s_x, s_y)\) (todo el viewBox cabe y sobran bordes), <code>slice</code> usa \(\max(s_x, s_y)\) (se llena el área y se recorta) y <code>none</code> deforma la figura.</p>
      <h2>Eje y invertido</h2>
      <p>Como \(y\) crece hacia abajo, una barra de valor \(v\) con la base en \(y_b\) se dibuja con <code>y = y_b − escala(v)</code> y <code>height = escala(v)</code>. Es el origen del error más común al hacer gráficos de barras.
      Las <a href="tema.html?id=d3-scales-axes">escalas de D3</a> resuelven esto con un rango invertido \([y_b, y_{\text{sup}}]\).</p>
      <h2>Por qué importa</h2>
      <p>Con viewBox el mismo dibujo escala con la pantalla sin cambiar el código, a diferencia de un <a href="tema.html?id=html-css-js-layers">canvas</a> que hay que redibujar al cambiar de tamaño.
      Ver también <a href="tema.html?id=svg-transforms-groups">transformaciones y grupos</a>.</p>`,
  });
})();
