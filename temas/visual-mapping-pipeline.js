(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;
  const { caja, texto } = VIZ.web;

  // Países de ejemplo (valores ilustrativos, no oficiales).
  const PAISES = [
    { n: 'Chile', cont: 'América', pob: 19, ing: 16, vida: 80 }, { n: 'Perú', cont: 'América', pob: 34, ing: 8, vida: 77 },
    { n: 'Brasil', cont: 'América', pob: 215, ing: 9, vida: 76 }, { n: 'Canadá', cont: 'América', pob: 39, ing: 52, vida: 82 },
    { n: 'Francia', cont: 'Europa', pob: 68, ing: 44, vida: 83 }, { n: 'Polonia', cont: 'Europa', pob: 38, ing: 19, vida: 77 },
    { n: 'Alemania', cont: 'Europa', pob: 84, ing: 51, vida: 81 }, { n: 'Egipto', cont: 'África', pob: 110, ing: 4, vida: 72 },
    { n: 'Kenia', cont: 'África', pob: 54, ing: 2, vida: 67 }, { n: 'Nigeria', cont: 'África', pob: 220, ing: 2, vida: 53 },
    { n: 'India', cont: 'Asia', pob: 1400, ing: 2.4, vida: 70 }, { n: 'Japón', cont: 'Asia', pob: 125, ing: 34, vida: 85 },
    { n: 'Corea', cont: 'Asia', pob: 52, ing: 33, vida: 83 }, { n: 'Indonesia', cont: 'Asia', pob: 275, ing: 4.8, vida: 68 },
  ];
  const CONTS = ['América', 'Europa', 'África', 'Asia'];
  const COLCONT = [C.s1, C.s2, C.s3, C.s7];

  /* ---------- Fig. 1: las etapas del proceso ---------- */

  function montarEtapas(cuerpo) {
    let etapa = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Etapa', min: 0, max: 3, valor: 0, formato: (v) => ['1 · datos crudos', '2 · datos preparados', '3 · mapeo visual', '4 · vista final'][v], alCambiar: (v) => { etapa = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Avance por las etapas con el control. Cada una transforma la anterior; un error temprano se arrastra hasta la imagen.');
    const MSG = [
      'Datos crudos: texto tal como llegan, con unidades mezcladas y sin ordenar.',
      'Preparación: se limpian, se convierten a números y se ordenan por el atributo de interés.',
      'Mapeo: cada atributo recibe un canal (población → longitud, continente → color).',
      'Vista: se agregan ejes, rótulos y leyenda para que la imagen se pueda leer.',
    ];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const nombres = ['Datos crudos', 'Preparación', 'Mapeo visual', 'Vista'];
      const bw = (W - 20 - 3 * 14) / 4;
      nombres.forEach((t, i) => {
        const x = 10 + i * (bw + 14);
        caja(ctx, x, 6, bw, 28, W < 520 ? String(i + 1) : t, { borde: i === etapa ? C.s1 : C.eje, relleno: i === etapa ? VIZ.alfa(C.s1, 0.12) : C.superficie, peso: i === etapa ? 700 : 500, grosor: i === etapa ? 2.5 : 1.5 });
        if (i < 3) { ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(x + bw + 2, 20); ctx.lineTo(x + bw + 12, 20); ctx.stroke(); }
      });
      const top = 50, h = H - top - 8, lista = etapa === 0 ? PAISES : [...PAISES].sort((a, b) => b.pob - a.pob);
      ctx.fillStyle = C.fondo2; ctx.fillRect(10, top, W - 20, h);
      if (etapa === 0) {
        lista.slice(0, 12).forEach((d, i) => texto(ctx, `"${d.n}", "${d.cont}", "${d.pob} M", "US$${d.ing}k"`, 20, top + 14 + i * 21, { alinear: 'left', tam: 11, color: i % 2 ? C.tinta2 : C.tinta }));
      } else if (etapa === 1) {
        texto(ctx, 'país', 24, top + 12, { alinear: 'left', tam: 10, color: C.apagado }); texto(ctx, 'continente', W * 0.36, top + 12, { alinear: 'left', tam: 10, color: C.apagado });
        texto(ctx, 'población (M)', W - 20, top + 12, { alinear: 'right', tam: 10, color: C.apagado });
        lista.slice(0, 12).forEach((d, i) => {
          const y = top + 32 + i * 19;
          texto(ctx, d.n, 24, y, { alinear: 'left', tam: 11 }); texto(ctx, d.cont, W * 0.36, y, { alinear: 'left', tam: 11, color: C.tinta2 });
          texto(ctx, String(d.pob), W - 20, y, { alinear: 'right', tam: 11, peso: 600 });
        });
      } else {
        const color = (i, d) => COLCONT[CONTS.indexOf(lista[i].cont)];
        V.barras(lienzo, lista.map((d) => ({ nombre: d.n, valor: d.pob })), { horizontal: true, margen: { sup: top + (etapa === 3 ? 22 : 4), izq: 70, inf: 12 }, etiquetaValor: etapa === 3, color, max: 1500 });
        if (etapa === 3) texto(ctx, 'Población por país (millones de habitantes)', 76, top + 12, { alinear: 'left', tam: 11, peso: 600 });
      }
      leyenda.set(etapa === 3 ? CONTS.map((t, k) => ({ color: COLCONT[k], texto: t })) : []);
      registro.textContent = MSG[etapa];
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: asignar atributos a canales ---------- */

  function montarMapeo(cuerpo) {
    const atr = [['ing', 'ingreso per cápita'], ['vida', 'esperanza de vida'], ['pob', 'población'], ['cont', 'continente']];
    const est = { x: 'ing', y: 'vida', tam: 'pob', col: 'cont' };
    const ctl = VIZ.controles(cuerpo);
    const op = (extra) => [...atr.map(([k, t]) => [k, t]), ...(extra ? [['nada', '(ninguno)']] : [])];
    ctl.selector({ etiqueta: 'Posición x', valor: est.x, opciones: op(false), alCambiar: (v) => { est.x = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Posición y', valor: est.y, opciones: op(false), alCambiar: (v) => { est.y = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Tamaño', valor: est.tam, opciones: op(true), alCambiar: (v) => { est.tam = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Color', valor: est.col, opciones: op(true), alCambiar: (v) => { est.col = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cambie qué atributo va a cada canal. Pase el cursor por un círculo para ver el país. Observe qué mapeos hacen visible una relación y cuáles la esconden.');
    let pts = [];
    const num = (d, k) => (k === 'nada' || k === 'cont' ? null : d[k]);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const num2 = (k) => PAISES.map((d) => (k === 'cont' ? CONTS.indexOf(d.cont) : d[k]));
      const ex = num2(est.x), ey = num2(est.y);
      const mx = (a) => [Math.min(...a), Math.max(...a)];
      const [x0, x1] = mx(ex), [y0, y1] = mx(ey);
      const plano = VIZ.plano(lienzo, { xmin: x0 - (x1 - x0) * 0.08 - 0.5 * (est.x === 'cont'), xmax: x1 + (x1 - x0) * 0.08 + 0.5 * (est.x === 'cont'), ymin: y0 - (y1 - y0) * 0.1, ymax: y1 + (y1 - y0) * 0.1 }, { etiquetaX: atr.find((a) => a[0] === est.x)[1], etiquetaY: atr.find((a) => a[0] === est.y)[1] });
      plano.ejes();
      const tams = est.tam === 'nada' ? null : num2(est.tam);
      const [t0, t1] = tams ? mx(tams) : [0, 1];
      const rg = est.col === 'nada' || est.col === 'cont' ? [0, 1] : mx(PAISES.map((q) => q[est.col]));
      pts = [];
      PAISES.forEach((d, i) => {
        const area = tams ? 25 + 175 * ((tams[i] - t0) / (t1 - t0 || 1)) : 60;
        const r = Math.sqrt(area / Math.PI) * 1.6;
        const c = est.col === 'nada' ? C.tinta2 : est.col === 'cont' ? COLCONT[CONTS.indexOf(d.cont)] : VIZ.css(VIZ.enRampa(((d[est.col] - rg[0]) / (rg[1] - rg[0] || 1))));
        const x = plano.sx(ex[i]), y = plano.sy(ey[i]);
        ctx.fillStyle = c; ctx.globalAlpha = 0.78; ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        pts.push({ px: x, py: y, i, r });
      });
      leyenda.set(est.col === 'cont' ? CONTS.map((t, k) => ({ color: COLCONT[k], texto: t }))
        : est.col === 'nada' ? [{ color: C.tinta2, texto: 'todos los países' }]
          : [{ color: VIZ.css(VIZ.enRampa(0.1)), texto: 'menor ' + atr.find((a) => a[0] === est.col)[1] }, { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'mayor' }]);
      const usados = [est.x, est.y, est.tam, est.col].filter((k) => k !== 'nada');
      const rep = usados.length - new Set(usados).size;
      registro.textContent = rep > 0 ? 'Hay un atributo asignado a más de un canal: es codificación redundante (útil para reforzar, pero gasta un canal).'
        : (est.x === 'cont' || est.y === 'cont') ? 'Un atributo categórico sobre un eje cartesiano separa grupos, pero el orden entre ellos es arbitrario.'
          : (est.col !== 'nada' && est.col !== 'cont') ? 'Un atributo cuantitativo en color se distingue mal; la posición y el tamaño lo muestran mejor.' : 'Cada atributo tiene su propio canal: la relación entre ingreso y vida se ve como nube ascendente.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = V.cercano(pts, x, y, 14);
      if (!p) return tip.ocultar();
      const d = PAISES[p.i];
      tip.mostrar(x, y, `<b>${d.n}</b> (${d.cont})<br>ingreso ${d.ing}k US$ · vida ${d.vida} años<br>población ${d.pob} M`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('visual-mapping-pipeline', {
    intro: String.raw`
      <p>Una visualización no aparece de golpe: es una <strong>cadena de transformaciones</strong>. Los datos crudos se limpian y organizan, después se
      <em>asignan</em> a propiedades visuales, y al final se agregan ejes y rótulos para que la persona pueda leer la imagen.</p>
      <p>El paso decisivo es el <strong>mapeo visual</strong>: decidir qué atributo va a la posición, al tamaño, al color. La misma tabla produce imágenes muy distintas según ese reparto.</p>`,
    visualizaciones: [
      { titulo: 'De los datos crudos a la vista', descripcion: 'Recorra las cuatro etapas y observe qué cambia en cada una.', montar: montarEtapas },
      { titulo: 'Reparto de atributos en canales', descripcion: 'Asigne ingreso, vida, población y continente a posición, tamaño y color. Pruebe repetir un atributo o poner uno cuantitativo en color.', montar: montarMapeo },
    ],
    teoria: String.raw`
      <h2>Proceso de referencia</h2>
      <pre><code>datos crudos → transformación (limpiar, filtrar, derivar)
            → mapeo visual (atributo → canal)
            → renderizado (marcas, ejes, leyendas)
            → vista interactiva</code></pre>
      <h2>El mapeo como función</h2>
      <p>Si el conjunto tiene ítems \(d_i\) con atributos \(a_1, \dots, a_k\), el mapeo es una función
      \[ M: (a_1, \dots, a_k) \longmapsto (\text{posición}, \text{tamaño}, \text{color}, \dots) \]
      que, idealmente, es <em>inyectiva</em> por atributo (valores distintos se ven distintos) y respeta el tipo: orden en lo ordenado, ausencia de orden en lo categórico.</p>
      <h2>Reglas prácticas</h2>
      <table>
        <tr><th>Tipo de atributo</th><th>Canales adecuados</th></tr>
        <tr><td>cuantitativo</td><td>posición, longitud, tamaño</td></tr>
        <tr><td>ordinal</td><td>posición, luminancia o saturación ordenada</td></tr>
        <tr><td>categórico</td><td>tono de color, forma, región espacial</td></tr>
      </table>
      <p>Los canales se comparan en <a href="tema.html?id=marks-and-channels">marcas y canales</a> y en <a href="tema.html?id=perceptual-accuracy">precisión perceptual</a>.
      Qué tipo tiene cada atributo se decide en la <a href="tema.html?id=data-types-attributes">abstracción de datos</a>.</p>`,
  });
})();
