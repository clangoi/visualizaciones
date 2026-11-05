(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  // Puntos ficticios agrupados en clústeres sobre el cuadro [0, 100]².
  const rnd0 = VIZ.semilla(23);
  const PTS = Array.from({ length: 500 }, (_, i) => { const c = [[25, 30], [70, 65], [55, 25], [20, 78]][i % 4]; return { i, x: Math.max(0, Math.min(100, c[0] + VIZ.normal(rnd0) * 9)), y: Math.max(0, Math.min(100, c[1] + VIZ.normal(rnd0) * 9)), g: i % 4 }; });

  /* ---------- Fig. 1: foco y contexto ---------- */

  function montarFocoContexto(cuerpo) {
    const v = { k: 1, cx: 50, cy: 50 };
    const ctl = VIZ.controles(cuerpo);
    const rk = ctl.rango({ etiqueta: 'Zoom', min: 1, max: 8, paso: 0.1, valor: 1, formato: (q) => `${VIZ.fmt(q, 2)}×`, alCambiar: (q) => { zoomA(q); } });
    ctl.boton('Restablecer', () => { v.k = 1; v.cx = 50; v.cy = 50; rk.valor = 1; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? 480 : 330) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'puntos' }, { color: C.s2, texto: 'ventana de la vista principal en el panorama', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Use la rueda del ratón o el control para acercar, y arrastre la vista grande para desplazarla. El rectángulo naranja del panorama (abajo o a la derecha) muestra dónde está y puede arrastrarse. Doble clic para volver.');
    let geo = null, arr = null;
    function zoomA(k) { v.k = k; lim(); dibujar(); }
    function lim() { const m = 50 / v.k; v.cx = Math.max(m, Math.min(100 - m, v.cx)); v.cy = Math.max(m, Math.min(100 - m, v.cy)); }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancho = W < 620, mw = ancho ? W : W * 0.7, mh = ancho ? H * 0.68 : H;
      const pw = ancho ? Math.min(160, W * 0.5) : W * 0.3 - 14, ph = pw, px0 = ancho ? 10 : mw + 10, py0 = ancho ? mh + 10 : 12;
      const m = 50 / v.k, sx = V.lin(v.cx - m, v.cx + m, 10, mw - 10), sy = V.lin(v.cy + m, v.cy - m, 10, mh - 10);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, mw, mh); ctx.clip();
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
      for (let t = 0; t <= 100; t += 10) { ctx.beginPath(); ctx.moveTo(sx(t) + 0.5, 0); ctx.lineTo(sx(t) + 0.5, mh); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, sy(t) + 0.5); ctx.lineTo(mw, sy(t) + 0.5); ctx.stroke(); }
      const r = Math.min(6, 2 + v.k * 0.7);
      geo = PTS.map((p) => ({ px: sx(p.x), py: sy(p.y), p }));
      geo.forEach(({ px, py, p }) => { if (px < -5 || px > mw + 5 || py < -5 || py > mh + 5) return; ctx.fillStyle = VIZ.alfa(C.s1, 0.7); ctx.beginPath(); ctx.arc(px, py, r, 0, 6.3); ctx.fill(); });
      ctx.restore();
      ctx.strokeStyle = C.eje; ctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
      // panorama
      const qx = V.lin(0, 100, px0, px0 + pw), qy = V.lin(100, 0, py0, py0 + ph);
      ctx.fillStyle = C.fondo2; ctx.fillRect(px0, py0, pw, ph); ctx.strokeStyle = C.eje; ctx.strokeRect(px0 + 0.5, py0 + 0.5, pw, ph);
      PTS.forEach((p) => { ctx.fillStyle = VIZ.alfa(C.s1, 0.5); ctx.fillRect(qx(p.x), qy(p.y), 1.8, 1.8); });
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.strokeRect(qx(v.cx - m), qy(v.cy + m), qx(v.cx + m) - qx(v.cx - m), qy(v.cy - m) - qy(v.cy + m)); ctx.fillStyle = VIZ.alfa(C.s2, 0.1); ctx.fillRect(qx(v.cx - m), qy(v.cy + m), qx(v.cx + m) - qx(v.cx - m), qy(v.cy - m) - qy(v.cy + m));
      V.rotulo(ctx, 'panorama', px0, py0 + ph + 12, { tam: 10, color: C.apagado });
      geo.mini = { px0, py0, pw, ph, qx, qy }; geo.mw = mw; geo.mh = mh; geo.sx = sx; geo.sy = sy;
      const vis = PTS.filter((p) => p.x >= v.cx - m && p.x <= v.cx + m && p.y >= v.cy - m && p.y <= v.cy + m).length;
      lectura.set([['zoom', `${VIZ.fmt(v.k, 2)}×`], ['centro', `(${VIZ.fmt(v.cx, 3)}; ${VIZ.fmt(v.cy, 3)})`], ['puntos visibles', `${vis} de ${PTS.length}`], ['porción del plano', `${VIZ.fmt(100 / (v.k * v.k), 3)} %`]]);
    }
    const enMini = (x, y) => geo && geo.mini && x >= geo.mini.px0 && x <= geo.mini.px0 + geo.mini.pw && y >= geo.mini.py0 && y <= geo.mini.py0 + geo.mini.ph;
    lienzo.canvas.style.cursor = 'grab';
    lienzo.canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); const f = ev.deltaY < 0 ? 1.15 : 1 / 1.15; v.k = Math.max(1, Math.min(8, v.k * f)); rk.valor = v.k; lim(); dibujar(); }, { passive: false });
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev); arr = enMini(x, y) ? 'mini' : x <= geo.mw && y <= geo.mh ? 'vista' : null; if (arr === 'mini') { v.cx = geo.mini.qx.inv(x); v.cy = geo.mini.qy.inv(y); lim(); dibujar(); } if (arr) { arr = { t: arr, x, y }; lienzo.canvas.setPointerCapture(ev.pointerId); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arr) { if (arr.t === 'mini') { v.cx = geo.mini.qx.inv(x); v.cy = geo.mini.qy.inv(y); } else { const m = 50 / v.k; v.cx -= ((x - arr.x) / (geo.mw - 20)) * 2 * m; v.cy += ((y - arr.y) / (geo.mh - 20)) * 2 * m; arr.x = x; arr.y = y; } lim(); dibujar(); return; }
      const c = geo && V.cercano(geo.filter((q) => q.px >= 0 && q.px <= geo.mw), x, y, 8); if (!c) return tip.ocultar(); tip.mostrar(x, y, `punto <b>${c.p.i}</b> · grupo ${c.p.g + 1}<br>(${VIZ.fmt(c.p.x, 3)}; ${VIZ.fmt(c.p.y, 3)})`);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arr = null; }); lienzo.canvas.addEventListener('pointerleave', () => { arr = null; tip.ocultar(); });
    lienzo.canvas.addEventListener('dblclick', () => { v.k = 1; v.cx = v.cy = 50; rk.valor = 1; dibujar(); });
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: zoom geométrico y zoom semántico ---------- */

  function montarSemantico(cuerpo) {
    let k = 1, modo = 'semantico', cx = 25, cy = 30, arr = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de zoom', valor: modo, opciones: [['geo', 'geométrico: solo se agranda'], ['semantico', 'semántico: cambia la representación']], alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Zoom', min: 1, max: 10, paso: 0.1, valor: k, formato: (q) => `${VIZ.fmt(q, 2)}×`, alCambiar: (q) => { k = q; lim(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'celda con muchos puntos (resumen)' }, { color: C.s2, texto: 'punto individual con su etiqueta' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Con zoom semántico, al alejar los puntos se agrupan en celdas con su conteo y al acercar aparecen individuales y rotulados. El zoom geométrico solo escala el dibujo: con pocos aumentos todo es una mancha, con muchos, hay detalle sin significado nuevo. Arrastre para desplazar.');
    function lim() { const m = 50 / k; cx = Math.max(m, Math.min(100 - m, cx)); cy = Math.max(m, Math.min(100 - m, cy)); }
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const m = 50 / k, sx = V.lin(cx - m, cx + m, 8, W - 8), sy = V.lin(cy + m, cy - m, 8, H - 8);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      geo = [];
      const semantico = modo === 'semantico' && k < 3.5;
      if (semantico) {
        const celda = 100 / Math.max(4, Math.round(8 / Math.sqrt(k))), g = new Map();
        PTS.forEach((p) => { const key = `${Math.floor(p.x / celda)}|${Math.floor(p.y / celda)}`; if (!g.has(key)) g.set(key, { n: 0, x: Math.floor(p.x / celda) * celda, y: Math.floor(p.y / celda) * celda }); g.get(key).n++; });
        const mx = Math.max(...[...g.values()].map((q) => q.n));
        for (const q of g.values()) { const x0 = sx(q.x), x1 = sx(q.x + celda), y0 = sy(q.y + celda), y1 = sy(q.y); ctx.fillStyle = VIZ.css(VIZ.enRampa(0.12 + 0.88 * (q.n / mx))); ctx.fillRect(x0, y0, x1 - x0 - 1, y1 - y0 - 1); if (x1 - x0 > 26) V.rotulo(ctx, String(q.n), (x0 + x1) / 2, (y0 + y1) / 2, { alinear: 'center', tam: 10, peso: 700, color: q.n / mx > 0.5 ? C.sobre : C.tinta }); geo.push({ px: (x0 + x1) / 2, py: (y0 + y1) / 2, txt: `${q.n} puntos en esta celda` }); }
      } else {
        const r = modo === 'geo' ? 2.4 * k : Math.min(6, 2 + k * 0.6);
        PTS.forEach((p) => { const px = sx(p.x), py = sy(p.y); if (px < -8 || px > W + 8 || py < -8 || py > H + 8) return; ctx.fillStyle = VIZ.alfa(modo === 'semantico' ? C.s2 : C.s1, 0.7); ctx.beginPath(); ctx.arc(px, py, r, 0, 6.3); ctx.fill(); geo.push({ px, py, txt: `punto ${p.i} · grupo ${p.g + 1}` }); if (modo === 'semantico' && k > 6.5) V.rotulo(ctx, `#${p.i}`, px + r + 2, py - r, { tam: 9, color: C.tinta2 }); });
      }
      ctx.restore(); ctx.strokeStyle = C.eje; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      registro.textContent = modo === 'geo' ? `Zoom geométrico ${VIZ.fmt(k, 2)}×: el mismo dibujo, más grande.` : semantico ? `Zoom semántico ${VIZ.fmt(k, 2)}×: se muestran celdas agregadas con su conteo.` : `Zoom semántico ${VIZ.fmt(k, 2)}×: se muestran los puntos individuales${k > 6.5 ? ', ahora rotulados' : ''}.`;
    }
    lienzo.canvas.style.cursor = 'grab';
    lienzo.canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); k = Math.max(1, Math.min(10, k * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); lim(); dibujar(); }, { passive: false });
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev); arr = { x, y }; lienzo.canvas.setPointerCapture(ev.pointerId); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (arr) { const m = 50 / k; cx -= ((x - arr.x) / lienzo.ancho) * 2 * m; cy += ((y - arr.y) / lienzo.alto) * 2 * m; arr = { x, y }; lim(); dibujar(); return; } const c = V.cercano(geo, x, y, 10); if (!c) return tip.ocultar(); tip.mostrar(x, y, c.txt); });
    lienzo.canvas.addEventListener('pointerup', () => { arr = null; }); lienzo.canvas.addEventListener('pointerleave', () => { arr = null; tip.ocultar(); });
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('zoom-pan', {
    intro: String.raw`
      <p>Con muchos datos, ninguna imagen cabe entera con suficiente detalle. <strong>Zoom</strong> (acercar) y <strong>pan</strong> (desplazar) permiten recorrer un espacio grande por partes. El riesgo es perderse: por eso se acompañan de un <em>panorama</em> que muestra dónde se está.</p>
      <p>Hay dos clases de zoom. El <em>geométrico</em> solo agranda lo que ya hay; el <em>semántico</em> cambia lo que se muestra según el nivel de acercamiento.</p>`,
    visualizaciones: [
      { titulo: 'Zoom y desplazamiento con panorama', descripcion: 'Acerque con la rueda o el control, desplace arrastrando y mueva el rectángulo del panorama.', montar: montarFocoContexto },
      { titulo: 'Zoom geométrico y semántico', descripcion: 'Alterne entre ambos zooms y compare qué se ve a distintos niveles de acercamiento.', montar: montarSemantico },
    ],
    teoria: String.raw`
      <h2>Transformación de la vista</h2>
      <p>Zoom y pan son una transformación afín entre el espacio de datos y la pantalla. Con centro \((c_x, c_y)\) y factor \(k\), la ventana visible tiene semianchura \(m = M/k\), donde \(M\) es la semianchura del dominio completo, y un dato se proyecta como
      \[ x_p = x_0 + \frac{x - (c_x - m)}{2m}\,(x_1 - x_0). \]
      Pan es cambiar \((c_x, c_y)\); zoom es cambiar \(k\). Hay que acotar el centro para que la ventana no salga del dominio: \(m \le c \le M_{\max} - m\).</p>
      <h2>Foco y contexto</h2>
      <p>Un panorama (<em>overview</em>) con la ventana actual, o una vista de distorsión (<em>lente</em>), conserva el contexto mientras se ve el detalle. Evita la desorientación al navegar.</p>
      <h2>Zoom semántico</h2>
      <p>En el zoom semántico la <em>representación</em> depende del nivel: a bajo zoom se muestran agregados (celdas, conteos); a alto zoom, ítems individuales con etiquetas. Se justifica por el número de marcas: a \(n\) ítems por pantalla, la oclusión crece como \(n/A\), donde \(A\) es el área disponible, y conviene agregar cuando \(n/A\) supera un umbral.</p>
      <div class="recuadro"><strong>Costo.</strong> Los zooms se conciben como una pirámide de niveles de agregación precalculados; cada acercamiento solo consulta la parte visible. Es el principio de los mapas web.</div>
      <p>Complementos: <a href="tema.html?id=brushing-linking">brushing y linking</a> y <a href="tema.html?id=details-on-demand">detalles bajo demanda</a>.</p>`,
  });
})();
