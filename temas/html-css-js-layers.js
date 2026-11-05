(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const DATOS = [['Café', 42], ['Té', 28], ['Pan', 63], ['Leche', 35]];

  /* ---------- Fig. 1: tres capas sobre los mismos datos ---------- */

  function montarCapas(cuerpo) {
    const est = { html: true, css: false, js: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas([
      { clave: 'html', texto: 'HTML: estructura', activo: true },
      { clave: 'css', texto: 'CSS: presentación', activo: false },
      { clave: 'js', texto: 'JavaScript: datos y comportamiento', activo: false },
    ], (e) => { Object.assign(est, e); dibujar(); });
    const panel = el('div', { class: 'demo-dom' });
    cuerpo.appendChild(panel);
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    cuerpo.dataset.sinLeyenda = 'figura de DOM real: el color azul de las barras es el único estilo y se explica en el texto';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Encienda una capa a la vez. Sin CSS la página es solo texto; sin JavaScript los valores quedan fijos en el HTML.');

    function dibujar() {
      panel.replaceChildren();
      panel.classList.toggle('sin-estilo', !est.css);
      const max = Math.max(...DATOS.map((d) => d[1]));
      DATOS.forEach(([n, v]) => {
        // Con JS el ancho se calcula a partir del dato; sin JS queda un ancho escrito a mano en el HTML.
        const w = est.js ? (v / max) * 100 : 50;
        panel.appendChild(el('div', { class: 'fila' }, el('span', null, n), el('div', { class: 'barra', style: est.css ? { width: w + '%' } : null }, String(v))));
      });
      let t = '<!-- HTML -->\n<div class="fila">\n  <span>Café</span>\n  <div class="barra">42</div>\n</div>';
      if (est.css) t += '\n\n/* CSS */\n.barra { background: blue; height: 16px; }\n.fila  { display: grid; grid-template-columns: 84px 1fr; }';
      if (est.js) t += '\n\n// JavaScript\nconst max = Math.max(...datos);\nbarra.style.width = (valor / max * 100) + "%";';
      codigo.textContent = t;
      registro.textContent = !est.css && !est.js ? 'Solo HTML: el navegador muestra el contenido y su jerarquía, sin forma gráfica.'
        : est.css && !est.js ? 'HTML + CSS: las barras aparecen, pero todas miden lo mismo; el ancho no depende de los datos.'
          : est.css && est.js ? 'Las tres capas: JavaScript calcula cada ancho y el CSS lo dibuja. Es una visualización.'
            : 'HTML + JavaScript sin CSS: los números se calculan, pero no hay barras que verlos.';
      if (est.css && !est.js) panel.querySelectorAll('.barra').forEach((b) => (b.style.width = '50%'));
    }
    dibujar();
  }

  /* ---------- Fig. 2: DOM, SVG y canvas medidos en su navegador ---------- */

  function montarMedicion(cuerpo) {
    let n = 2000, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Elementos gráficos', min: 100, max: 20000, paso: 100, valor: n, formato: (v) => VIZ.entero(v), alCambiar: (v) => { n = v; } });
    ctl.boton('Medir en este navegador', medir, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'div (DOM)' }, { color: C.s2, texto: 'SVG circle' }, { color: C.s3, texto: 'canvas arc' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Medir» con distintos tamaños. Cada elemento DOM o SVG es un nodo con eventos propios; el canvas es solo una imagen.');

    function medir() {
      const rnd = VIZ.semilla(5);
      const host = el('div', { class: 'demo-dom' });
      host.style.height = '1px'; host.style.overflow = 'hidden';
      cuerpo.appendChild(host);
      let t0 = performance.now();
      for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.style.width = Math.round(rnd() * 100) + 'px'; host.appendChild(d); }
      host.getBoundingClientRect();
      const tDom = performance.now() - t0;
      host.replaceChildren();
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      host.appendChild(svg);
      t0 = performance.now();
      for (let i = 0; i < n; i++) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', rnd() * 300); c.setAttribute('cy', rnd() * 100); c.setAttribute('r', 3); svg.appendChild(c); }
      host.getBoundingClientRect();
      const tSvg = performance.now() - t0;
      host.replaceChildren();
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 100;
      const cx = cv.getContext('2d');
      t0 = performance.now();
      for (let i = 0; i < n; i++) { cx.beginPath(); cx.arc(rnd() * 300, rnd() * 100, 3, 0, 6.3); cx.fill(); }
      const tCv = performance.now() - t0;
      host.remove();
      res = { n, tDom, tSvg, tCv };
      dibujar();
    }
    let rects = [];
    function dibujar() {
      lienzo.limpiar();
      if (!res) { V.rotulo(lienzo.ctx, 'Pulse «Medir en este navegador»', lienzo.ancho / 2, lienzo.alto / 2, { alinear: 'center' }); lectura.set([['elementos', VIZ.entero(n)]]); return; }
      const items = [{ nombre: 'DOM', valor: res.tDom }, { nombre: 'SVG', valor: res.tSvg }, { nombre: 'canvas', valor: res.tCv }];
      const g = V.barras(lienzo, items, { horizontal: true, formato: (v) => VIZ.fmt(v, 3) + ' ms', color: (i) => [C.s1, C.s2, C.s3][i], margen: { izq: 60 } });
      rects = g.rects;
      const rap = Math.max(res.tDom, res.tSvg) / Math.max(res.tCv, 0.01);
      registro.textContent = `Crear ${VIZ.entero(res.n)} elementos: DOM ${VIZ.fmt(res.tDom, 3)} ms, SVG ${VIZ.fmt(res.tSvg, 3)} ms, canvas ${VIZ.fmt(res.tCv, 3)} ms.`;
      lectura.set([['elementos', VIZ.entero(res.n)], ['nodos en el documento', `${VIZ.entero(res.n)} (DOM/SVG) frente a 1 (canvas)`], ['DOM o SVG frente a canvas', `${VIZ.fmt(rap, 3)}× más lento`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = res && V.bajo(rects, x, y);
      if (!h) return tip.ocultar();
      tip.mostrar(x, y, `${['DOM', 'SVG', 'canvas'][h.i]}: <b>${VIZ.fmt([res.tDom, res.tSvg, res.tCv][h.i], 3)} ms</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('html-css-js-layers', {
    intro: String.raw`
      <p>Toda visualización web se construye con tres lenguajes que se reparten el trabajo: <strong>HTML</strong> dice <em>qué hay</em>, <strong>CSS</strong> dice
      <em>cómo se ve</em> y <strong>JavaScript</strong> dice <em>qué hace</em> y de dónde salen los datos.</p>
      <p>Entender esa separación permite decidir dónde corregir un problema: si una barra mide mal, el error está en el cálculo (JS); si se ve fea, en el estilo (CSS); si falta, en la estructura (HTML).</p>`,
    visualizaciones: [
      { titulo: 'Tres capas, una visualización', descripcion: 'Active HTML, CSS y JavaScript por separado y vea qué aporta cada capa al gráfico de barras.', montar: montarCapas },
      { titulo: 'DOM, SVG o canvas: costo de dibujar', descripcion: 'Mida en su propio navegador cuánto tarda crear miles de elementos. Aumente la cantidad y compare.', montar: montarMedicion },
    ],
    teoria: String.raw`
      <h2>Responsabilidades</h2>
      <table>
        <tr><th>Capa</th><th>Responsabilidad</th><th>En una visualización</th></tr>
        <tr><td>HTML</td><td>estructura y significado</td><td>contenedores, etiquetas, texto accesible</td></tr>
        <tr><td>CSS</td><td>presentación</td><td>colores, tamaños, rejilla de la página, transiciones</td></tr>
        <tr><td>JavaScript</td><td>datos y comportamiento</td><td>leer datos, calcular escalas, responder a eventos</td></tr>
      </table>
      <h2>Tres formas de dibujar</h2>
      <p>Una marca gráfica puede ser un elemento del <a href="tema.html?id=dom-tree">DOM</a> (<code>&lt;div&gt;</code>), un elemento
      <a href="tema.html?id=svg-shapes-attributes">SVG</a> o píxeles de un <code>&lt;canvas&gt;</code>. Los dos primeros son <em>modo retenido</em>: el navegador conserva cada
      nodo, lo hace accesible y le permite eventos propios; el costo crece con el número de nodos. El canvas es <em>modo inmediato</em>: dibuja y olvida, es rápido con muchas marcas, pero hay que calcular los impactos a mano.</p>
      <div class="recuadro"><strong>Regla práctica.</strong> Hasta unos miles de marcas, SVG ofrece interactividad sencilla y escala sin pérdida; con decenas de miles, conviene canvas.</div>
      <h2>Costo</h2>
      <p>Si crear un nodo cuesta \(c_n\) y pintar una marca en canvas \(c_p\), el tiempo de construir \(n\) marcas es \(T_{\text{DOM}} \approx n\,c_n\) frente a \(T_{\text{canvas}} \approx n\,c_p\), con \(c_n \gg c_p\).
      La figura 2 mide ese cociente en su máquina.</p>`,
  });
})();
