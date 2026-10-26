/* PLANTILLA DE TEMA — copie este archivo a temas/<id>.js y agregue el tema a js/catalogo.js.
   Ver GUIA_DE_ESTILO.md. El ejemplo (búsqueda lineal) muestra todas las piezas de una figura
   en el orden acordado: controles → lienzo → leyenda → registro → lectura → nota. */
(function () {
  'use strict';
  const { color: C } = VIZ; // Colores: siempre desde la paleta, nunca hexadecimales.

  /* ---------- Fig. 1: algoritmo paso a paso ---------- */

  function montarPasoAPaso(cuerpo) {
    // Estado de la figura.
    let n = 20, semilla = 1, a = [], i = -1, objetivo = 0, encontrado = -1, mensaje = '';

    // 1. Controles: rangos y selectores primero; luego el reproductor y los botones.
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño n', min: 5, max: 40, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    // 2. Lienzo: se adapta al ancho; use proporcion (alto/ancho) o altoFn(ancho).
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.35, altoMin: 200, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);

    // 3. Leyenda: todo color con significado aparece aquí (o hay etiquetas directas).
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'sin revisar' },
      { color: C.s1, texto: 'elemento que se compara' },
      { color: C.tinta, texto: 'ya revisado' },
      { color: C.s6, texto: 'encontrado' },
    ]);

    // 4. Registro: narra el paso actual. 5. Lectura: números clave. 6. Nota: cómo interactuar.
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre una barra para ver su valor.');

    // El algoritmo como generador: cada `yield` es un paso visible.
    function iniciar() {
      const rnd = VIZ.semilla(semilla * 31 + n);
      a = Array.from({ length: n }, () => 1 + Math.floor(rnd() * 99));
      objetivo = a[Math.floor(rnd() * n)];
      i = -1; encontrado = -1;
      mensaje = `Buscar ${objetivo} revisando los elementos de izquierda a derecha.`;
      return (function* () {
        for (i = 0; i < n; i++) {
          if (a[i] === objetivo) { encontrado = i; mensaje = `a[${i}] = ${objetivo}: encontrado.`; yield; return; }
          mensaje = `a[${i}] = ${a[i]} ≠ ${objetivo}: seguir.`;
          yield;
        }
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 8, inf = 18, paso = (W - 2 * izq) / n, base = H - inf;
      geo = { izq, paso };
      a.forEach((v, k) => {
        const h = (v / 100) * (base - 10);
        ctx.fillStyle = k === encontrado ? C.s6 : k === i ? C.s1 : k < i ? C.tinta : C.inactivo;
        ctx.beginPath();
        ctx.roundRect(izq + k * paso + 1, base - h, paso - 2, h, [4, 4, 0, 0]); // extremo de datos redondeado
        ctx.fill();
      });
      ctx.strokeStyle = C.eje;
      ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - izq, base + 0.5); ctx.stroke();
      registro.textContent = mensaje;
      lectura.set([
        ['objetivo', String(objetivo)],
        ['comparaciones', String(Math.max(0, Math.min(i + 1, n)))],
        ['peor caso', String(n)],
      ]);
    }
    lienzo.alDibujar = () => a.length && dibujar();

    // Tooltip al pasar el cursor: obligatorio en gráficos de datos.
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const k = Math.floor((x - geo.izq) / geo.paso);
      if (k < 0 || k >= n) return tip.ocultar();
      tip.mostrar(x, y, `posición <b>${k}</b><br>valor <b>${a[k]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());

    rep.reiniciar();
  }

  /* ---------- Fig. 2: gráfico de datos con ejes ---------- */

  function montarCosto(cuerpo) {
    let hover = null;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'peor caso: n', forma: 'linea' },
      { color: C.s2, texto: 'caso promedio: (n + 1) / 2', forma: 'linea' },
    ]);
    const SERIES = [[(n) => n, C.s1, 'peor'], [(n) => (n + 1) / 2, C.s2, 'promedio']];
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 105 }, { etiquetaX: 'n', etiquetaY: 'comparaciones' });
      plano.ejes();
      for (const [f, c] of SERIES) {
        const pts = [];
        for (let n = 1; n <= 100; n++) pts.push([n, f(n)]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(f(hover)), c, 4);
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.round(plano.ix(x)));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + SERIES.map(([f, c, t]) => VIZ.filaTooltip(c, t, VIZ.fmt(f(hover)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  // El id debe coincidir con el nombre del archivo y con el catálogo.
  VIZ.registrarTema('plantilla', {
    // Intuición: uno o dos párrafos, sin fórmulas pesadas.
    intro: String.raw`
      <p>La <strong>búsqueda lineal</strong> revisa los elementos uno por uno hasta encontrar el buscado. Es el método más simple y el
      único posible cuando los datos no tienen orden.</p>`,
    visualizaciones: [
      {
        titulo: 'Búsqueda lineal paso a paso',
        descripcion: 'Qué mirar y qué probar, en una o dos frases. Las fórmulas en descripciones llevan doble barra: \\(O(n)\\).',
        montar: montarPasoAPaso,
      },
      {
        titulo: 'Costo según n',
        descripcion: 'Comparaciones en el peor caso y en promedio.',
        montar: montarCosto,
      },
    ],
    // Teoría: secciones <h2>; pseudocódigo en <pre><code>; < y > como &lt; y &gt;.
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>para i ← 0 hasta n − 1:
    si a[i] = x: devolver i
devolver «no está»</code></pre>
      <h2>Análisis</h2>
      <p>Si \(x\) está en una posición uniformemente aleatoria, el número esperado de comparaciones es</p>
      \[ \mathbb{E}[C] = \frac{1}{n}\sum_{i=1}^{n} i = \frac{n+1}{2}, \]
      <p>y en el peor caso, \(n\). Ambos son \(\Theta(n)\). Con datos ordenados, la
      <a href="tema.html?id=busqueda-binaria">búsqueda binaria</a> baja a \(\Theta(\log n)\).</p>`,
  });
})();
