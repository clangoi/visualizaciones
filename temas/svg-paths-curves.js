(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const S = V.svg;

  /* ---------- Fig. 1: curvas con puntos de control ---------- */

  function montarCurvas(cuerpo) {
    const P0 = { lineal: [[40, 150], [120, 40], [220, 160], [340, 60]], cuad: [[50, 160], [200, 20], [350, 160]], cubica: [[40, 160], [120, 20], [280, 20], [360, 160]] };
    let modo = 'cubica', t = 0.5;
    const pts = JSON.parse(JSON.stringify(P0));
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Comando', valor: modo, opciones: [['lineal', 'L: segmentos'], ['cuad', 'Q: Bézier cuadrática'], ['cubica', 'C: Bézier cúbica']], alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parámetro t (De Casteljau)', min: 0, max: 1, paso: 0.01, valor: t, alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Restablecer puntos', () => { for (const k in P0) pts[k] = P0[k].map((p) => [...p]); dibujar(); });
    const svg = V.lienzoSvg(cuerpo, 400, 200);
    cuerpo.dataset.sinLeyenda = 'cada elemento se explica en la nota y el código';
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    VIZ.nota(cuerpo, 'Arrastre los círculos para mover los puntos. Los azules son extremos de la curva; los naranjos son puntos de control: la curva se acerca a ellos sin tocarlos.');
    let arrastre = -1;
    const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    function dibujar() {
      const p = pts[modo];
      svg.replaceChildren();
      let d;
      if (modo === 'lineal') d = `M${p.map((q) => q.map(Math.round).join(' ')).join(' L')}`;
      else if (modo === 'cuad') d = `M${p[0].map(Math.round).join(' ')} Q${p[1].map(Math.round).join(' ')} ${p[2].map(Math.round).join(' ')}`;
      else d = `M${p[0].map(Math.round).join(' ')} C${p[1].map(Math.round).join(' ')} ${p[2].map(Math.round).join(' ')} ${p[3].map(Math.round).join(' ')}`;
      if (modo !== 'lineal') svg.append(S('polyline', { points: p.map((q) => q.join(',')).join(' '), fill: 'none', stroke: C.apagado, 'stroke-dasharray': '4 4' }));
      svg.append(S('path', { d, fill: 'none', stroke: C.tinta, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
      if (modo !== 'lineal') {
        let nivel = p;
        const col = [C.s3, C.s7];
        let k = 0;
        while (nivel.length > 1) {
          const sig = nivel.slice(1).map((q, i) => lerp(nivel[i], q, t));
          if (sig.length > 1) { svg.append(S('polyline', { points: sig.map((q) => q.join(',')).join(' '), fill: 'none', stroke: col[k % 2], 'stroke-width': 1.5 })); sig.forEach((q) => svg.append(S('circle', { cx: q[0], cy: q[1], r: 3, fill: col[k % 2] }))); }
          else svg.append(S('circle', { cx: sig[0][0], cy: sig[0][1], r: 6, fill: C.s8, stroke: C.superficie, 'stroke-width': 2 }));
          nivel = sig; k++;
        }
      }
      p.forEach((q, i) => {
        const extremo = modo === 'lineal' || i === 0 || i === p.length - 1;
        svg.append(S('circle', { cx: q[0], cy: q[1], r: 8, fill: extremo ? C.s1 : C.s2, stroke: C.superficie, 'stroke-width': 2, class: 'arrastrable', onpointerdown: (ev) => { arrastre = i; ev.target.setPointerCapture(ev.pointerId); } }));
      });
      codigo.textContent = `<path d="${d}"\n      fill="none" stroke="tinta" stroke-width="3"/>`;
    }
    svg.addEventListener('pointermove', (ev) => {
      if (arrastre < 0) return;
      const q = V.puntoSvg(svg, ev);
      pts[modo][arrastre] = [Math.max(8, Math.min(392, q.x)), Math.max(8, Math.min(192, q.y))];
      dibujar();
    });
    svg.addEventListener('pointerup', () => { arrastre = -1; });
    dibujar();
  }

  /* ---------- Fig. 2: los cuatro arcos elípticos ---------- */

  function montarArcos(cuerpo) {
    const est = { rx: 80, ry: 80, rot: 0, grande: 0, barrido: 1 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'rx', min: 45, max: 140, valor: est.rx, alCambiar: (v) => { est.rx = v; dibujar(); } });
    ctl.rango({ etiqueta: 'ry', min: 30, max: 140, valor: est.ry, alCambiar: (v) => { est.ry = v; dibujar(); } });
    ctl.rango({ etiqueta: 'x-axis-rotation', min: 0, max: 90, valor: 0, formato: (v) => `${v}°`, alCambiar: (v) => { est.rot = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'large-arc-flag', valor: false, alCambiar: (v) => { est.grande = v ? 1 : 0; dibujar(); } });
    ctl.casilla({ etiqueta: 'sweep-flag', valor: true, alCambiar: (v) => { est.barrido = v ? 1 : 0; dibujar(); } });
    const svg = V.lienzoSvg(cuerpo, 400, 220);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'arco elegido', forma: 'linea' }, { color: C.eje, texto: 'las otras tres soluciones', forma: 'linea' }, { color: C.s1, texto: 'extremos' }]);
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    VIZ.nota(cuerpo, 'Dos puntos y dos radios admiten cuatro arcos distintos; los dos flags eligen uno. Si los radios son muy pequeños, SVG los agranda hasta que el arco quepa.');
    const A = [150, 120], B = [250, 120];
    function dibujar() {
      svg.replaceChildren();
      for (let g = 0; g <= 1; g++) for (let s = 0; s <= 1; s++) {
        if (g === est.grande && s === est.barrido) continue;
        svg.append(S('path', { d: `M${A} A${est.rx} ${est.ry} ${est.rot} ${g} ${s} ${B}`, fill: 'none', stroke: C.eje, 'stroke-width': 2 }));
      }
      const d = `M${A} A${est.rx} ${est.ry} ${est.rot} ${est.grande} ${est.barrido} ${B}`;
      svg.append(S('path', { d, fill: 'none', stroke: C.s2, 'stroke-width': 4 }), S('circle', { cx: A[0], cy: A[1], r: 6, fill: C.s1 }), S('circle', { cx: B[0], cy: B[1], r: 6, fill: C.s1 }));
      codigo.textContent = `<path d="${d}" fill="none" stroke="naranja"/>\n         rx ry rot large sweep`;
    }
    dibujar();
  }

  VIZ.registrarTema('svg-paths-curves', {
    intro: String.raw`
      <p>El elemento <code>&lt;path&gt;</code> dibuja cualquier forma con una pequeña «instrucción de lápiz» en su atributo <code>d</code>: <em>mover</em> a un punto, <em>trazar</em> una línea, una curva o un arco. Los gráficos de líneas, áreas y mapas son, por dentro, un <code>path</code> largo.</p>
      <p>Las curvas de <strong>Bézier</strong> se controlan con puntos que el trazo no toca pero que lo atraen: moverlos es esculpir la curva.</p>`,
    visualizaciones: [
      { titulo: 'Curvas de Bézier con puntos de control', descripcion: 'Arrastre los puntos y recorra el parámetro t para ver cómo se construye el punto de la curva por interpolaciones sucesivas.', montar: montarCurvas },
      { titulo: 'Arcos elípticos y sus flags', descripcion: 'Combine los dos flags y los radios para recorrer las cuatro soluciones posibles entre dos puntos.', montar: montarArcos },
    ],
    teoria: String.raw`
      <h2>Comandos de path</h2>
      <table>
        <tr><th>Comando</th><th>Significado</th></tr>
        <tr><td><code>M x y</code></td><td>mover el lápiz sin dibujar</td></tr>
        <tr><td><code>L x y</code></td><td>línea recta hasta (x, y)</td></tr>
        <tr><td><code>Q cx cy x y</code></td><td>Bézier cuadrática con un punto de control</td></tr>
        <tr><td><code>C c1x c1y c2x c2y x y</code></td><td>Bézier cúbica con dos puntos de control</td></tr>
        <tr><td><code>A rx ry rot large sweep x y</code></td><td>arco elíptico</td></tr>
        <tr><td><code>Z</code></td><td>cerrar la figura</td></tr>
      </table>
      <p>La letra en mayúscula usa coordenadas absolutas; en minúscula, relativas al punto actual.</p>
      <h2>Curva de Bézier</h2>
      <p>Una Bézier cúbica con puntos \(P_0, P_1, P_2, P_3\) es
      \[ B(t) = (1-t)^3 P_0 + 3(1-t)^2 t\,P_1 + 3(1-t)t^2 P_2 + t^3 P_3, \qquad t \in [0, 1]. \]
      El algoritmo de <em>De Casteljau</em> la calcula interpolando linealmente entre puntos consecutivos: \(P_i^{(k)} = (1-t)P_i^{(k-1)} + t\,P_{i+1}^{(k-1)}\). Es lo que muestra la figura 1.</p>
      <p>La curva pasa por \(P_0\) y \(P_3\) y es tangente a los segmentos \(P_0P_1\) y \(P_2P_3\) en los extremos.</p>
      <h2>Arcos</h2>
      <p>Dos puntos y dos radios determinan dos elipses, y cada una da dos arcos (corto y largo): cuatro soluciones. <code>large-arc-flag</code> elige el arco mayor o menor de 180° y <code>sweep-flag</code> el sentido de giro.</p>
      <h2>En visualización</h2>
      <p>Los generadores de línea y de área de <a href="tema.html?id=d3-shape-generators">D3</a> producen la cadena <code>d</code> a partir de datos; las curvas suavizadas (<em>spline</em>, <em>monotone</em>) son Béziers encadenadas.</p>`,
  });
})();
