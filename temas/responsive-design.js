(function () {
  'use strict';
  const { color: C } = VIZ;

  const BP_TABLET = 600, BP_ESCRITORIO = 960;

  /* ---------- Fig. 1: la misma página en distintos anchos ---------- */

  function montarPagina(cuerpo) {
    const est = { vw: 390, responsivo: true };
    const ctl = VIZ.controles(cuerpo);
    const rv = ctl.rango({ etiqueta: 'Ancho de la ventana', min: 320, max: 1400, paso: 10, valor: est.vw, formato: (v) => `${v} px`, alCambiar: (v) => { est.vw = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'diseño responsivo (media queries)', valor: true, alCambiar: (v) => { est.responsivo = v; dibujar(); } });
    ctl.boton('Teléfono', () => { est.vw = 390; rv.valor = 390; dibujar(); });
    ctl.boton('Tableta', () => { est.vw = 768; rv.valor = 768; dibujar(); });
    ctl.boton('Escritorio', () => { est.vw = 1280; rv.valor = 1280; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 300 : 280) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cabecera y pie' }, { color: C.s6, texto: 'contenido' }, { color: C.s3, texto: 'menú lateral' }, { color: C.s2, texto: 'tarjetas' }, { color: C.s8, texto: 'se sale de la ventana' }]);
    const codigo = VIZ.el('pre', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Desactive el diseño responsivo: la página fija de 960 px se desborda en pantallas pequeñas y obliga a desplazarse de lado.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vw = est.vw, k = (W - 16) / 1400, anchoPag = est.responsivo ? vw : Math.max(vw, 960), vwPx = vw * k;
      const x0 = 8, y0 = 8, hv = H - 16;
      ctx.fillStyle = C.fondo2; ctx.fillRect(x0, y0, vwPx, hv);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, vwPx, hv);
      const modo = !est.responsivo ? 'fijo' : vw >= BP_ESCRITORIO ? 'escritorio' : vw >= BP_TABLET ? 'tableta' : 'movil';
      const bloque = (x, y, w, h, c, t) => {
        const fuera = x + w > vwPx + 0.5;
        ctx.fillStyle = VIZ.alfa(fuera ? C.s8 : c, 0.3); ctx.strokeStyle = fuera ? C.s8 : c; ctx.lineWidth = 1.5;
        ctx.fillRect(x0 + x, y0 + y, w, h); ctx.strokeRect(x0 + x, y0 + y, w, h);
        if (w > 30) VIZ.web.texto(ctx, t, x0 + x + w / 2, y0 + y + h / 2, { tam: 10, color: C.tinta2 });
      };
      const g = 4, A = anchoPag * k, hh = 28, hf = 22;
      bloque(0, 0, A, hh, C.s1, 'cabecera'); bloque(0, hv - hf, A, hf, C.s1, 'pie');
      const yc = hh + g, hc = hv - hh - hf - 2 * g;
      let cols = 1;
      if (modo === 'movil') {
        bloque(0, yc, A, 22, C.s3, 'menú'); bloque(0, yc + 22 + g, A, hc - 22 - g, C.s6, 'contenido');
      } else {
        const ancho = modo === 'tableta' ? 0.28 : 0.2;
        bloque(0, yc, A * ancho, hc, C.s3, 'menú');
        const cw = A * (1 - ancho) - g;
        cols = modo === 'escritorio' || modo === 'fijo' ? 3 : 2;
        const tw = (cw - g * (cols - 1)) / cols;
        const filas = 2;
        for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) bloque(A * ancho + g + c * (tw + g), yc + f * (hc / filas), tw, hc / filas - g, C.s2, 'tarjeta');
      }
      const desborde = Math.max(0, anchoPag - vw);
      codigo.textContent = modo === 'movil' ? '@media (max-width: 599px)  { .layout { display: block } }' : modo === 'tableta' ? '@media (min-width: 600px)  { .layout { grid-template-columns: 28% 1fr } .tarjetas { columns: 2 } }' : modo === 'escritorio' ? '@media (min-width: 960px)  { .layout { grid-template-columns: 20% 1fr } .tarjetas { columns: 3 } }' : '.layout { width: 960px }   /* sin media queries */';
      registro.textContent = modo === 'fijo' ? (desborde ? `Diseño fijo de 960 px en una ventana de ${vw} px: sobran ${desborde} px y aparece un desplazamiento horizontal.` : 'Con la ventana ancha el diseño fijo cabe, pero deja espacio sin usar.') : `Ancho ${vw} px → esquema «${modo === 'movil' ? 'teléfono: una columna' : modo === 'tableta' ? 'tableta: menú lateral y 2 columnas' : 'escritorio: menú lateral y 3 columnas'}».`;
      lectura.set([['ancho de ventana', `${vw} px`], ['columnas de tarjetas', modo === 'movil' ? '1' : String(cols)], ['desbordamiento horizontal', desborde ? `${desborde} px` : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: tamaños fluidos con clamp() ---------- */

  function montarFluido(cuerpo) {
    const est = { min: 16, max: 32, vwp: 3 };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Mínimo', min: 10, max: 24, valor: est.min, formato: (v) => `${v} px`, alCambiar: (v) => { est.min = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Máximo', min: 24, max: 56, valor: est.max, formato: (v) => `${v} px`, alCambiar: (v) => { est.max = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parte fluida (vw)', min: 0.5, max: 6, paso: 0.1, valor: est.vwp, formato: (v) => `${v} vw`, alCambiar: (v) => { est.vwp = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s8, t: 'tamaño fijo (24 px)', f: () => 24 }, { c: C.s2, t: 'solo vw', f: (w) => (w * est.vwp) / 100 }, { c: C.s1, t: 'clamp(mín, vw, máx)', f: (w) => Math.min(est.max, Math.max(est.min, (w * est.vwp) / 100)) }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un texto fijo se queda chico en pantallas grandes; uno solo en <code>vw</code> se vuelve minúsculo o gigante. <code>clamp()</code> lo deja fluir entre dos límites.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 320, xmax: 1600, ymin: 0, ymax: 70 }, { etiquetaX: 'ancho de ventana (px)', etiquetaY: 'font-size (px)' });
      plano.ejes();
      for (const s of SER) { const pts = []; for (let w = 320; w <= 1600; w += 10) pts.push([w, s.f(w)]); VIZ.trazar(ctx, plano, pts, s.c, s.c === C.s1 ? 3 : 2); }
      const w1 = (est.min * 100) / est.vwp, w2 = (est.max * 100) / est.vwp;
      lectura.set([['se estira desde', `${Math.round(w1)} px`], ['llega al máximo en', `${Math.round(w2)} px`], ['CSS', `clamp(${est.min}px, ${est.vwp}vw, ${est.max}px)`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const w = Math.round(plano.ix(x));
      tip.mostrar(x, y, `ventana = <b>${w} px</b>` + SER.map((s) => VIZ.filaTooltip(s.c, s.t.split(' ')[0], `${VIZ.fmt(s.f(w), 3)} px`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('responsive-design', {
    intro: String.raw`
      <p>Una página se abre en teléfonos de 360 px y en monitores de 2500 px. En vez de hacer una versión por dispositivo, el <strong>diseño responsivo</strong> hace que
      <em>una sola</em> página se reacomode según el espacio disponible.</p>
      <p>Se apoya en tres ideas: medidas relativas (porcentajes, <code>fr</code>, <code>vw</code>), imágenes y tipografía flexibles, y <strong>media queries</strong> que cambian el diseño en ciertos anchos (<em>puntos de quiebre</em>).</p>`,
    visualizaciones: [
      {
        titulo: 'Una página, tres diseños',
        descripcion: 'Arrastre el ancho de la ventana y cruce los puntos de quiebre de 600 y 960 px. Luego desactive el diseño responsivo y mire el desbordamiento.',
        montar: montarPagina,
      },
      {
        titulo: 'Tipografía fluida con clamp()',
        descripcion: 'Compare un tamaño fijo, uno proporcional al ancho y <code>clamp()</code>. Cambie mínimo, máximo y parte fluida.',
        montar: montarFluido,
      },
    ],
    teoria: String.raw`
      <h2>Media queries</h2>
      <pre><code>.layout { display: block; }                 /* primero el teléfono */
@media (min-width: 600px) { .layout { display: grid; grid-template-columns: 28% 1fr; } }
@media (min-width: 960px) { .layout { grid-template-columns: 20% 1fr; } }</code></pre>
      <p>El enfoque <em>mobile first</em> escribe primero el diseño más simple y agrega reglas con <code>min-width</code> para pantallas mayores: el CSS base es corto y se enriquece donde hay espacio. Las consultas pueden mirar además la orientación, la resolución o preferencias del usuario (<code>prefers-color-scheme</code>, <code>prefers-reduced-motion</code>).</p>
      <h2>Medidas relativas</h2>
      <table>
        <tr><th>Unidad</th><th>Relativa a</th></tr>
        <tr><td><code>%</code></td><td>el tamaño del contenedor</td></tr>
        <tr><td><code>rem</code> / <code>em</code></td><td>tamaño de la fuente raíz / del elemento</td></tr>
        <tr><td><code>vw</code> / <code>vh</code></td><td>1 % del ancho / alto de la ventana</td></tr>
        <tr><td><code>fr</code></td><td>fracción del espacio libre de una rejilla</td></tr>
      </table>
      <p>La tipografía fluida se expresa como</p>
      \[ f(w) = \min\bigl(f_{\max},\; \max(f_{\min},\; p\,w/100)\bigr), \]
      <p>que es exactamente <code>clamp(f_min, p vw, f_max)</code>: crece linealmente con el ancho \(w\) entre \(w_1 = 100 f_{\min}/p\) y \(w_2 = 100 f_{\max}/p\), y se mantiene constante fuera de ese intervalo.</p>
      <div class="recuadro">Imprescindible: <code>&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code>; sin ella el teléfono simula una ventana de unos 980 px y las media queries no se activan. Las estructuras que cambian de forma son <a href="tema.html?id=flexbox-grid-layout">Flexbox y Grid</a>.</div>`,
  });
})();
