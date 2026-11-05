(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  // Componentes de un informe: tipo, importancia 1–5 y espacio (columnas × filas de una rejilla de 12 columnas).
  const COMP = [
    { n: 'Filtros', t: 'control', imp: 2, w: 12, h: 1 },
    { n: 'Ventas', t: 'KPI', imp: 5, w: 3, h: 2 }, { n: 'Margen', t: 'KPI', imp: 4, w: 3, h: 2 },
    { n: 'Pedidos', t: 'KPI', imp: 3, w: 3, h: 2 }, { n: 'Ticket', t: 'KPI', imp: 3, w: 3, h: 2 },
    { n: 'Tendencia mensual', t: 'tendencia', imp: 5, w: 8, h: 4 }, { n: 'Por región', t: 'comparación', imp: 4, w: 4, h: 4 },
    { n: 'Tabla de detalle', t: 'detalle', imp: 2, w: 12, h: 3 },
  ];

  function montarRejilla(cuerpo) {
    let ordenado = true, sel = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Organización', valor: 'jerarquia', opciones: [['jerarquia', 'Por jerarquía: lo importante arriba y grande'], ['mezclada', 'Sin jerarquía: orden de creación']], alCambiar: (v) => { ordenado = v === 'jerarquia'; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    const TIPOS = { control: C.apagado, KPI: C.s1, tendencia: C.s2, comparación: C.s3, detalle: C.s7 };
    VIZ.leyenda(cuerpo, Object.entries(TIPOS).map(([k, c]) => ({ color: c, texto: k })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El número en cada tarjeta es el orden de lectura (de izquierda a derecha y de arriba abajo). Compare dónde caen los componentes más importantes en ambas organizaciones. Haga clic en una tarjeta para destacarla.');
    let cajas = [];
    function colocar() {
      const orden = ordenado ? COMP.map((c, i) => i) : [7, 3, 6, 1, 4, 0, 2, 5];
      let x = 0, y = 0, filaH = 0;
      const out = new Array(COMP.length);
      for (const i of orden) {
        const c = COMP[i];
        if (x + c.w > 12) { x = 0; y += filaH; filaH = 0; }
        out[i] = { x, y, w: c.w, h: c.h, i }; x += c.w; filaH = Math.max(filaH, c.h);
      }
      return { out, filas: y + filaH, orden };
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const { out, filas, orden } = colocar();
      const cw = (W - 12) / 12, ch = (H - 12) / filas;
      cajas = [];
      out.forEach((b, i) => {
        const c = COMP[i], x = 6 + b.x * cw, y = 6 + b.y * ch, w = b.w * cw - 6, h = b.h * ch - 6;
        ctx.fillStyle = VIZ.alfa(TIPOS[c.t], sel === i ? 0.35 : 0.14); ctx.strokeStyle = TIPOS[c.t]; ctx.lineWidth = sel === i ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
        V.rotulo(ctx, c.n, x + 8, y + 14, { peso: 600, color: C.tinta, tam: 11 });
        V.rotulo(ctx, '★'.repeat(c.imp), x + 8, y + h - 10, { tam: 9, color: C.apagado });
        const ord = orden.indexOf(i) + 1;
        ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.arc(x + w - 12, y + 12, 9, 0, 6.3); ctx.fill();
        V.rotulo(ctx, String(ord), x + w - 12, y + 12, { alinear: 'center', color: C.sobre, peso: 700, tam: 10 });
        cajas.push({ x, y, w, h, i });
      });
      const imp = (b) => COMP[b.i].imp;
      const tres = [...out].sort((a, b) => imp(b) - imp(a)).slice(0, 3);
      const primeros = orden.slice(0, 3);
      const lecturaTop = orden.indexOf(tres[0].i) + 1;
      lectura.set([['filas de la rejilla', String(filas)], ['posición de lectura del componente más importante', String(lecturaTop)], ['entre los 3 primeros hay del top-3', String(primeros.filter((i) => tres.some((q) => q.i === i)).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = V.bajo(cajas, x, y); lienzo.canvas.style.cursor = b ? 'pointer' : 'default'; if (!b) return tip.ocultar(); const c = COMP[b.i]; tip.mostrar(x, y, `<b>${c.n}</b> (${c.t})<br>importancia ${c.imp} de 5<br>${c.w} × ${c.h} celdas`); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const b = V.bajo(cajas, x, y); sel = b && sel !== b.i ? b.i : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dashboard-layout-design', {
    intro: String.raw`
      <p>Un buen dashboard se lee en pocos segundos: primero los <strong>indicadores clave</strong>, luego la <strong>tendencia</strong>, después las <strong>comparaciones</strong> y, al final, el <strong>detalle</strong>. El diseño decide el orden en que se mira.</p>
      <p>Los controles van juntos y a la vista, los números importantes son grandes y están donde la mirada empieza —arriba a la izquierda—, y todo lo demás se subordina a ellos.</p>`,
    visualizaciones: [
      { titulo: 'Jerarquía en una rejilla de 12 columnas', descripcion: 'Alterne entre una organización jerárquica y una sin criterio, y observe dónde queda cada componente en el orden de lectura.', montar: montarRejilla },
    ],
    teoria: String.raw`
      <h2>Principios</h2>
      <ul>
        <li><strong>Un propósito por informe</strong>: monitorear, analizar o comunicar; no los tres.</li>
        <li><strong>Jerarquía</strong>: el tamaño y la posición expresan la importancia; el orden de lectura típico en occidente va de izquierda a derecha y de arriba abajo.</li>
        <li><strong>Agrupar lo relacionado</strong>: lo que se compara va cerca y alineado (ver <a href="tema.html?id=gestalt-grouping">principios de Gestalt</a>).</li>
        <li><strong>Consistencia</strong>: el mismo color significa lo mismo en todos los gráficos; los controles actúan donde la persona espera.</li>
        <li><strong>Densidad moderada</strong>: más componentes no es más información; cada uno debe responder una pregunta.</li>
      </ul>
      <h2>Rejilla</h2>
      <p>Una rejilla de 12 columnas permite anchos de 3, 4, 6, 8 y 12 columnas, que se combinan sin huecos. Un componente de \(w\) columnas y \(h\) filas ocupa la fracción \(\dfrac{w\,h}{12\,F}\) de una rejilla con \(F\) filas; el tamaño debe crecer con la importancia.</p>
      <h2>Tipos de componente</h2>
      <table>
        <tr><th>Tipo</th><th>Pregunta que responde</th><th>Representación habitual</th></tr>
        <tr><td>indicador (KPI)</td><td>¿cuánto?</td><td>número grande y variación</td></tr>
        <tr><td>tendencia</td><td>¿cómo evoluciona?</td><td>línea o área en el tiempo</td></tr>
        <tr><td>comparación</td><td>¿cuál es mayor?</td><td>barras ordenadas</td></tr>
        <tr><td>detalle</td><td>¿cuáles son los datos?</td><td>tabla, con filtros</td></tr>
      </table>
      <p>Ver cómo elegir cada representación en <a href="tema.html?id=chart-selection">selección de gráficos</a> y el uso de filtros en <a href="tema.html?id=dashboard-filters-controls">filtros y comparaciones</a>.</p>`,
  });
})();
