(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: las cuatro capas de una caja ---------- */

  function montarCaja(cuerpo) {
    const est = { margin: 20, border: 6, padding: 16, ancho: 160, alto: 70, sizing: 'content-box' };
    let capas = [];
    const ctl = VIZ.controles(cuerpo);
    for (const [k, t, max] of [['margin', 'margin', 40], ['border', 'border', 16], ['padding', 'padding', 40], ['ancho', 'width', 260]]) {
      ctl.rango({ etiqueta: t, min: 0, max, valor: est[k], formato: (v) => `${v} px`, alCambiar: (v) => { est[k] = v; dibujar(); } });
    }
    ctl.selector({ etiqueta: 'box-sizing', valor: est.sizing, opciones: [['content-box', 'content-box (por omisión)'], ['border-box', 'border-box']], alCambiar: (v) => { est.sizing = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 250 });
    const tip = VIZ.tooltip(lienzo);
    const NOMBRES = [{ k: 'margin', c: C.s2, t: 'margin (fuera, transparente)' }, { k: 'border', c: C.tinta2, t: 'border' }, { k: 'padding', c: C.s6, t: 'padding' }, { k: 'content', c: C.s1, t: 'contenido' }];
    VIZ.leyenda(cuerpo, NOMBRES.map((n) => ({ color: n.c, texto: n.t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con <code>width: 160px</code>, ¿cuánto ocupa realmente la caja? Alterne <code>content-box</code> y <code>border-box</code> y vea cómo cambia el contenido.');

    function medidas() {
      const { margin: m, border: b, padding: p, ancho: w } = est;
      const contenido = est.sizing === 'content-box' ? w : Math.max(0, w - 2 * (b + p));
      const alto = est.sizing === 'content-box' ? est.alto : Math.max(20, est.alto);
      return { contenido, alto, caja: contenido + 2 * (p + b), total: contenido + 2 * (p + b + m), p, b, m };
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const { contenido, alto, caja, total, p, b, m } = medidas();
      const k = Math.min(1, (W - 40) / total), cx = W / 2, cy = H / 2;
      const rect = (_, extra) => ({ x: cx - (contenido / 2 + extra) * k, y: cy - (alto / 2 + extra) * k, w: (contenido + 2 * extra) * k, h: (alto + 2 * extra) * k });
      capas = [{ k: 'margin', c: C.s2, e: p + b + m, v: m }, { k: 'border', c: C.tinta2, e: p + b, v: b }, { k: 'padding', c: C.s6, e: p, v: p }, { k: 'content', c: C.s1, e: 0, v: contenido }];
      capas.forEach((l) => {
        l.r = rect(0, l.e);
        const r = l.r;
        ctx.fillStyle = C.superficie; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = l.k === 'border' ? C.tinta2 : VIZ.alfa(l.c, l.k === 'content' ? 0.35 : 0.2);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        if (l.k === 'margin') { ctx.strokeStyle = C.s2; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]); }
      });
      const c = capas.find((x) => x.k === 'content').r;
      VIZ.web.texto(ctx, `${contenido} × ${alto}`, c.x + c.w / 2, c.y + c.h / 2, { tam: 12, peso: 600 });
      if (m * k > 12) VIZ.web.texto(ctx, String(m), cx, capas[0].r.y + (m * k) / 2, { tam: 10, color: C.s2, peso: 600 });
      if (p * k > 12) VIZ.web.texto(ctx, String(p), cx, capas[2].r.y + (p * k) / 2, { tam: 10, color: C.tinta2, peso: 600 });
      if (b * k > 9) VIZ.web.texto(ctx, String(b), cx, capas[1].r.y + (b * k) / 2, { tam: 9, color: C.sobre, peso: 600 });
      registro.textContent = est.sizing === 'content-box'
        ? `content-box: width fija solo el contenido (${contenido} px); padding y borde se suman por fuera: la caja mide ${caja} px.`
        : `border-box: width incluye padding y borde; el contenido se reduce a ${contenido} px y la caja mide exactamente ${caja} px.`;
      lectura.set([['contenido', `${contenido} px`], ['caja (borde externo)', `${caja} px`], ['espacio ocupado con margin', `${total} px`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const l = [...capas].reverse().find((q) => x >= q.r.x && x <= q.r.x + q.r.w && y >= q.r.y && y <= q.r.y + q.r.h);
      if (!l) return tip.ocultar();
      tip.mostrar(x, y, VIZ.filaTooltip(l.c, l.k, `${l.v} px`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: colapso de márgenes ---------- */

  function montarColapso(cuerpo) {
    const est = { m1: 30, m2: 20, modo: 'bloque' };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'margin-bottom de A', min: 0, max: 60, valor: est.m1, formato: (v) => `${v} px`, alCambiar: (v) => { est.m1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'margin-top de B', min: 0, max: 60, valor: est.m2, formato: (v) => `${v} px`, alCambiar: (v) => { est.m2 = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Contenedor', valor: est.modo, opciones: [['bloque', 'flujo normal (bloque)'], ['flex', 'flex o grid']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cajas A y B' }, { color: C.s2, texto: 'margen de A' }, { color: C.s4, texto: 'margen de B' }, { color: C.s6, texto: 'distancia resultante' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En el flujo normal, dos márgenes verticales que se tocan <b>se fusionan</b> en el mayor; dentro de un contenedor flex o grid se suman.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const gap = est.modo === 'bloque' ? Math.max(est.m1, est.m2) : est.m1 + est.m2;
      const h = 44, x = 24, w = Math.min(W - 160, 260), y1 = 14, y2 = y1 + h + gap;
      for (const [y, t] of [[y1, 'A'], [y2, 'B']]) {
        ctx.fillStyle = VIZ.alfa(C.s1, 0.25); ctx.strokeStyle = C.s1; ctx.lineWidth = 2;
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
        VIZ.web.texto(ctx, `caja ${t}`, x + w / 2, y + h / 2, { tam: 12, peso: 600 });
      }
      ctx.fillStyle = VIZ.alfa(C.s2, 0.3); ctx.fillRect(x, y1 + h, w, est.m1);
      ctx.fillStyle = VIZ.alfa(C.s4, 0.4); ctx.fillRect(x, y2 - est.m2, w, est.m2);
      const xf = x + w + 26;
      ctx.strokeStyle = C.s6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xf, y1 + h); ctx.lineTo(xf, y2); ctx.moveTo(xf - 5, y1 + h); ctx.lineTo(xf + 5, y1 + h); ctx.moveTo(xf - 5, y2); ctx.lineTo(xf + 5, y2); ctx.stroke();
      VIZ.web.texto(ctx, `${gap} px`, xf + 10, (y1 + h + y2) / 2, { tam: 13, peso: 600, alinear: 'left' });
      VIZ.web.texto(ctx, `A: ${est.m1}`, x + 6, y1 + h + 8, { tam: 10, color: C.tinta2, alinear: 'left' });
      VIZ.web.texto(ctx, `B: ${est.m2}`, x + 6, y2 - 8, { tam: 10, color: C.tinta2, alinear: 'left' });
      registro.textContent = est.modo === 'bloque' ? `Los márgenes ${est.m1} y ${est.m2} se superponen: queda el mayor, ${gap} px (no ${est.m1 + est.m2}).` : `En flex/grid no hay colapso: ${est.m1} + ${est.m2} = ${gap} px.`;
      lectura.set([['si se sumaran', `${est.m1 + est.m2} px`], ['distancia real', `${gap} px`], ['ahorro por colapso', `${est.m1 + est.m2 - gap} px`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('box-model', {
    intro: String.raw`
      <p>Para CSS, todo elemento es una <strong>caja rectangular</strong> hecha de cuatro capas concéntricas: el <em>contenido</em>, el <em>padding</em> (aire interior),
      el <em>borde</em> y el <em>margin</em> (aire exterior). Casi todo el trabajo de maquetación consiste en decidir tamaños y espacios de esas cajas.</p>
      <p>Un detalle que sorprende a casi todos: ¿el <code>width</code> mide solo el contenido o la caja entera? Depende de <code>box-sizing</code>.</p>`,
    visualizaciones: [
      {
        titulo: 'Las capas de la caja',
        descripcion: 'Cambie margin, borde, padding y ancho. Alterne <code>box-sizing</code> y observe qué mide realmente el <code>width</code>.',
        montar: montarCaja,
      },
      {
        titulo: 'Colapso de márgenes',
        descripcion: 'Dos cajas apiladas con márgenes distintos: compare el flujo normal con un contenedor flex y mire la distancia entre ellas.',
        montar: montarColapso,
      },
    ],
    teoria: String.raw`
      <h2>Tamaño total</h2>
      <p>Con <code>content-box</code>, el ancho que ocupa un elemento en la línea es</p>
      \[ W_{\text{total}} = w + 2\,(\text{padding} + \text{border} + \text{margin}). \]
      <p>Con <code>border-box</code>, <code>width</code> ya incluye padding y borde, por lo que \(w = W_{\text{caja}}\) y el contenido queda \(w - 2(\text{padding}+\text{border})\). Es la opción más predecible, y muchos proyectos la activan para todo con <code>*, *::before, *::after { box-sizing: border-box }</code>.</p>
      <h2>Valores abreviados</h2>
      <pre><code>margin: 10px 20px 30px 40px;   /* arriba derecha abajo izquierda */
margin: 10px 20px;             /* vertical horizontal */
margin: 0 auto;                /* centra un bloque con ancho fijo */</code></pre>
      <h2>Colapso de márgenes</h2>
      <p>Entre bloques adyacentes en el flujo normal, los márgenes verticales se fusionan: la distancia es \(\max(m_1, m_2)\) si ambos son positivos, no \(m_1 + m_2\). No colapsan en contenedores <em>flex</em> o <em>grid</em>, ni si hay borde o padding entre ellos. Los márgenes horizontales nunca colapsan.</p>
      <div class="recuadro">El padding tiene el fondo del elemento; el margin es transparente. Para separar elementos hermanos hoy se prefiere <code>gap</code> en <a href="tema.html?id=flexbox-grid-layout">Flexbox y Grid</a>, que evita estas sorpresas.</div>`,
  });
})();
