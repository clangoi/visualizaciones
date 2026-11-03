(function () {
  'use strict';
  const { color: C } = VIZ;
  const DOM = [
    { n: 'Clientes', antes: 'clientes como masa', ahora: 'clientes como red' },
    { n: 'Competencia', antes: 'industria con rivales claros', ahora: 'ecosistema de aliados y rivales' },
    { n: 'Datos', antes: 'subproducto del negocio', ahora: 'activo estratégico' },
    { n: 'Innovación', antes: 'grandes proyectos planificados', ahora: 'experimentos rápidos' },
    { n: 'Valor', antes: 'propuesta fija', ahora: 'valor que se adapta y se cocrea' },
  ];
  const NIVEL = ['inexistente', 'inicial', 'emergente', 'definido', 'gestionado', 'optimizado'];
  const PERFILES = {
    banco: { t: 'Banco tradicional', v: [2, 2, 2, 1, 1.5] },
    retail: { t: 'Retailer con tienda en línea', v: [4, 3, 4, 3, 3] },
    nativa: { t: 'Empresa nativa digital', v: [4.5, 3.5, 4.5, 4.5, 4] },
    pyme: { t: 'Pyme manufacturera', v: [1, 1.5, 1, 1, 1.5] },
  };
  const geo = (v) => Math.pow(v.reduce((p, x) => p * Math.max(x, 0.01), 1), 1 / v.length);
  const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / 5;

  /* ---------- Fig. 1: radar de madurez ---------- */

  function montarRadar(cuerpo) {
    let v = PERFILES.banco.v.slice(), meta = 4, g = null, arrastre = -1, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Organización de partida', opciones: Object.entries(PERFILES).map(([k, p]) => [k, p.t]), valor: 'banco', alCambiar: (k) => { v = PERFILES[k].v.slice(); dibujar(); } });
    ctl.rango({ etiqueta: 'Nivel meta', min: 1, max: 5, paso: 0.5, valor: meta, alCambiar: (x) => { meta = x; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.85, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nivel actual de la organización', forma: 'cuadro' },
      { color: C.s2, texto: 'nivel meta', forma: 'linea' },
      { color: C.s8, texto: 'dominio más rezagado', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre cada vértice del polígono (o haga clic sobre un eje) para fijar el nivel de 0 a 5 de ese dominio. Elija otra organización de partida para comparar perfiles: lo importante es la forma del polígono, no solo su tamaño.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2 + 4, R = Math.max(50, Math.min(W / 2 - 80, H / 2 - 36));
      g = { cx, cy, R };
      const P = (i, val) => [cx + (val / 5) * R * Math.cos(ang(i)), cy + (val / 5) * R * Math.sin(ang(i))];
      for (let r = 1; r <= 5; r++) {
        ctx.strokeStyle = r === 5 ? C.eje : C.rejilla; ctx.lineWidth = 1; ctx.beginPath();
        DOM.forEach((_, i) => { const [x, y] = P(i, r); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(String(r), cx + 3, cy - (r / 5) * R);
      }
      DOM.forEach((d, i) => {
        const [x, y] = P(i, 5);
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        const c = Math.cos(ang(i)), s = Math.sin(ang(i));
        ctx.font = VIZ.fuente(11, i === hover ? 700 : 500); ctx.fillStyle = C.tinta;
        ctx.textAlign = Math.abs(c) < 0.3 ? 'center' : c > 0 ? 'left' : 'right';
        ctx.textBaseline = s < -0.5 ? 'bottom' : s > 0.5 ? 'top' : 'middle';
        ctx.fillText(d.n, x + c * 10, y + s * 10);
      });
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.beginPath();
      DOM.forEach((_, i) => { const [x, y] = P(i, meta); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.stroke(); ctx.restore();
      ctx.beginPath();
      v.forEach((val, i) => { const [x, y] = P(i, val); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s1, 0.22); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.stroke();
      const peor = v.indexOf(Math.min(...v));
      v.forEach((val, i) => {
        const [x, y] = P(i, val);
        VIZ.marcador(ctx, x, y, i === peor ? C.s8 : C.s1, i === hover || i === arrastre ? 7.5 : 5.5);
      });
      const mejor = v.indexOf(Math.max(...v));
      registro.textContent = `Media aritmética ${VIZ.fmt(media(v), 3)}, media geométrica ${VIZ.fmt(geo(v), 3)}: la diferencia mide el desequilibrio. El dominio más rezagado, «${DOM[peor].n.toLowerCase()}», limita el valor de todo lo demás.`;
      lectura.set([
        ['nivel medio', VIZ.fmt(media(v), 3)],
        ['media geométrica', VIZ.fmt(geo(v), 3)],
        ['más fuerte', `${DOM[mejor].n} (${VIZ.fmt(v[mejor], 2)})`],
        ['más rezagado', `${DOM[peor].n} (${VIZ.fmt(v[peor], 2)})`],
        ['brecha total a la meta', VIZ.fmt(v.reduce((s, x) => s + Math.max(0, meta - x), 0), 3)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    const eje = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const dx = x - g.cx, dy = y - g.cy;
      let mejor = 0, dm = 9;
      DOM.forEach((_, i) => { const d = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang(i)), Math.cos(Math.atan2(dy, dx) - ang(i)))); if (d < dm) { dm = d; mejor = i; } });
      return { i: mejor, val: Math.max(0, Math.min(5, Math.round((Math.hypot(dx, dy) / g.R) * 10) / 2)), x, y, lejos: Math.hypot(dx, dy) > g.R + 70 };
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      if (!g) return;
      const e = eje(ev);
      if (e.lejos) return;
      arrastre = e.i; v[e.i] = e.val; lienzo.canvas.setPointerCapture(ev.pointerId); dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!g) return;
      const e = eje(ev);
      if (arrastre >= 0) { v[arrastre] = e.val; dibujar(); }
      else if (e.i !== hover && !e.lejos) { hover = e.i; dibujar(); }
      const k = arrastre >= 0 ? arrastre : e.i;
      if (e.lejos && arrastre < 0) return tip.ocultar();
      tip.mostrar(e.x, e.y, `<b>${DOM[k].n}</b><br>nivel <b>${VIZ.fmt(v[k], 2)}</b> (${NIVEL[Math.round(v[k])]})<br>meta ${VIZ.fmt(meta, 2)}`);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = -1; dibujar(); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: supuestos que cambian ---------- */

  const mezcla = (a, b, t) => a + (b - a) * t;
  const linea = (ctx, x0, y0, x1, y1, col, a, ancho = 1.5, guion) => {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = ancho; if (guion) ctx.setLineDash(guion);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  };
  const DIBUJOS = [
    // Clientes: de un mensaje que llega a todos a una red que conversa
    (ctx, x, y, w, h, t) => {
      const rnd = VIZ.semilla(11), pts = Array.from({ length: 22 }, () => [x + 14 + rnd() * (w - 28), y + 50 + rnd() * (h - 66)]);
      const cx = x + w / 2, cy = y + 38;
      pts.forEach(([px, py], i) => {
        linea(ctx, cx, cy, px, py, C.apagado, 1 - t, 1);
        pts.map((q, j) => [Math.hypot(q[0] - px, q[1] - py), j]).sort((a, b) => a[0] - b[0]).slice(1, 3).forEach(([, j]) => { if (j > i) linea(ctx, px, py, pts[j][0], pts[j][1], C.s3, t, 1.5); });
      });
      pts.forEach(([px, py]) => VIZ.marcador(ctx, px, py, C.s1, 4.5));
      ctx.fillStyle = C.tinta; ctx.fillRect(cx - 9, cy - 9, 18, 18);
    },
    // Competencia: de un sector cerrado a un ecosistema con aliados y nuevos entrantes
    (ctx, x, y, w, h, t) => {
      const cx = x + w / 2, cy = y + h / 2 + 12, R = Math.min(w, h) * 0.3;
      const f = (i) => [cx + R * Math.cos((2 * Math.PI * i) / 6), cy + R * Math.sin((2 * Math.PI * i) / 6)];
      ctx.save(); ctx.globalAlpha = 1 - t; ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.strokeRect(cx - R - 26, cy - R - 26, 2 * R + 52, 2 * R + 52); ctx.restore();
      for (let i = 0; i < 6; i++) {
        const a = f(i), b = f(i + 1), c = f(i + 2);
        linea(ctx, a[0], a[1], b[0], b[1], C.s8, 1 - t, 2, [4, 3]);
        linea(ctx, a[0], a[1], c[0], c[1], C.s3, t, 2);
      }
      for (let i = 0; i < 6; i++) { const [px, py] = f(i); VIZ.marcador(ctx, px, py, C.s1, 6); }
      [[-0.55, -0.1], [1.45, 0.1], [0.5, 1.25]].forEach(([fx, fy], k) => {
        const px = mezcla(x + w * (fx < 0.5 ? 0.04 : 0.96), cx + (fx - 0.5) * R * 1.0, t), py = mezcla(y + h * (fy < 0.5 ? 0.12 : 0.9), cy + (k === 2 ? R * 1.35 : (k ? -0.5 : 0.5) * R), t);
        VIZ.marcador(ctx, px, py, C.s2, 5.5, 2);
      });
    },
    // Datos: de archivos guardados a datos que se usan en las decisiones
    (ctx, x, y, w, h, t) => {
      const cols = 12, filas = 6, cw = (w - 20) / cols, ch = (h - 50) / filas, usados = Math.round(cols * filas * mezcla(0.08, 0.85, t));
      for (let k = 0; k < cols * filas; k++) {
        const i = k % cols, j = Math.floor(k / cols);
        ctx.fillStyle = k < usados ? C.s1 : C.tenue;
        ctx.beginPath(); ctx.roundRect(x + 10 + i * cw + 1.5, y + 40 + j * ch + 1.5, cw - 3, ch - 3, 3); ctx.fill();
      }
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${Math.round((100 * usados) / (cols * filas))} % de los datos guardados se usa en decisiones`, x + 10, y + 32);
    },
    // Innovación: de un gran proyecto a muchos ciclos cortos de aprendizaje
    (ctx, x, y, w, h, t) => {
      const n = 1 + Math.round(11 * t), base = y + h - 36, ancho = w - 28, bw = ancho / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = C.s1;
        ctx.beginPath(); ctx.roundRect(x + 14 + i * bw + 1.5, base - 26, bw - 3, 26, 3); ctx.fill();
      }
      const pts = Array.from({ length: n + 1 }, (_, i) => [x + 14 + i * bw, base - 40 - (i / n) * (n === 1 ? 0 : 1) * (h - 130) * Math.min(1, Math.sqrt(n / 12))]);
      ctx.strokeStyle = C.s6; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
      pts.forEach(([px, py], i) => { if (n === 1 && i === 0) return; VIZ.marcador(ctx, px, py, C.s6, 3.5); });
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${n} ${n === 1 ? 'entrega única' : 'ciclos de prueba y aprendizaje'}`, x + 14, y + 32);
    },
    // Valor: de una propuesta fija a capas de valor que se suman
    (ctx, x, y, w, h, t) => {
      const capas = [['producto', C.s1, 1], ['servicio', C.s3, 0.7], ['personalización con datos', C.s2, 0.8], ['comunidad y ecosistema', C.s7, 0.9]];
      const bw = Math.min(150, w * 0.4), bx = x + w / 2 - bw / 2, base = y + h - 24, unidad = (h - 66) / 3.4;
      let acc = 0;
      capas.forEach(([n, col, val], k) => {
        const f = k === 0 ? 1 : Math.max(0, Math.min(1, t * 4 - (k - 1))), alto = val * unidad * f;
        if (alto < 0.5) return;
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(bx, base - acc - alto, bw, alto - 1, 3); ctx.fill();
        if (alto > 16) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, bx + bw / 2, base - acc - alto / 2); }
        acc += alto;
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(bx - 20, base + 0.5); ctx.lineTo(bx + bw + 20, base + 0.5); ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`valor para el cliente: ×${VIZ.fmt(acc / unidad, 2)}`, x + 10, y + 32);
    },
  ];
  const LEYENDAS = [
    [{ color: C.s1, texto: 'cliente', forma: 'punto' }, { color: C.apagado, texto: 'mensaje de la empresa a todos (masa)', forma: 'linea' }, { color: C.s3, texto: 'clientes que se conectan entre sí (red)', forma: 'linea' }],
    [{ color: C.s1, texto: 'empresa del sector', forma: 'punto' }, { color: C.s8, texto: 'rivalidad directa', forma: 'linea' }, { color: C.s3, texto: 'alianza', forma: 'linea' }, { color: C.s2, texto: 'nuevo entrante', forma: 'punto' }],
    [{ color: C.s1, texto: 'dato usado en decisiones', forma: 'cuadro' }, { color: C.tenue, texto: 'dato guardado sin uso', forma: 'cuadro' }],
    [{ color: C.s1, texto: 'ciclo de trabajo (entrega o prueba)', forma: 'cuadro' }, { color: C.s6, texto: 'aprendizaje acumulado', forma: 'linea' }],
    [{ color: C.s1, texto: 'producto', forma: 'cuadro' }, { color: C.s3, texto: 'servicio', forma: 'cuadro' }, { color: C.s2, texto: 'personalización', forma: 'cuadro' }, { color: C.s7, texto: 'comunidad', forma: 'cuadro' }],
  ];

  function montarSupuestos(cuerpo) {
    let k = 0, t = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Dominio', opciones: DOM.map((d, i) => [String(i), d.n]), valor: '0', alCambiar: (v) => { k = +v; leyenda.set(LEYENDAS[k]); dibujar(); } });
    const rT = ctl.rango({ etiqueta: 'Avance de la transformación', min: 0, max: 1, paso: 0.05, valor: t, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { t = v; rep.detener(); dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 400 });
    const leyenda = VIZ.leyenda(cuerpo, LEYENDAS[0]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el avance (o reproduzca la transición) en cada dominio y compare el supuesto de la izquierda con el de la derecha. Cambiar de dominio muestra qué supuesto se rompe en cada caso.');
    function iniciar() {
      t = 0; rT.valor = 0;
      return (function* () { for (let i = 1; i <= 20; i++) { t = i / 20; rT.valor = t; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      DIBUJOS[k](ctx, 0, 0, W, H, t);
      ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'top';
      const d = DOM[k];
      ctx.textAlign = 'left'; ctx.fillStyle = VIZ.alfa(C.tinta, 1 - 0.75 * t); ctx.fillText(`Antes: ${d.antes}`, 8, 6);
      ctx.textAlign = 'right'; ctx.fillStyle = VIZ.alfa(C.tinta, 0.25 + 0.75 * t); ctx.fillText(`Ahora: ${d.ahora}`, W - 8, H - 18);
      registro.textContent = t < 0.5 ? `Supuesto tradicional en «${d.n.toLowerCase()}»: ${d.antes}.` : `Supuesto digital en «${d.n.toLowerCase()}»: ${d.ahora}.`;
      lectura.set([['dominio', d.n], ['avance', `${Math.round(t * 100)} %`], ['supuesto vigente', t < 0.5 ? d.antes : d.ahora]]);
    }
    lienzo.alDibujar = () => dibujar();
    dibujar();
  }

  /* ---------- Fig. 3: equilibrio de la inversión ---------- */

  const TRIM = 16;

  function montarEquilibrio(cuerpo) {
    let w = [2, 2, 2, 2, 2], L = [], hist = [], pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    const rs = DOM.map((d, i) => ctl.rango({ etiqueta: `Esfuerzo en ${d.n.toLowerCase()}`, min: 0, max: 10, paso: 1, valor: w[i], alCambiar: (x) => { w[i] = x; rep.reiniciar(); } }));
    const poner = (nw) => { w = nw.slice(); rs.forEach((r, i) => { r.valor = w[i]; }); rep.reiniciar(); };
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Equilibrado', () => poner([2, 2, 2, 2, 2]));
    ctl.boton('Todo en datos', () => poner([0, 0, 10, 0, 0]));
    ctl.boton('Todo en innovación', () => poner([0, 0, 0, 10, 0]));
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, DOM.map((d, i) => ({ color: VIZ.series[i], texto: d.n, forma: 'linea' })).concat([
      { color: C.tinta, texto: 'media geométrica (valor)', forma: 'linea' }, { color: C.apagado, texto: 'media aritmética', forma: 'linea' },
    ]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los dominios parten en niveles bajos de una organización tradicional. Los datos ayudan a los demás (+50 % de avance con datos al máximo), pero el valor se mide con la media geométrica: un dominio rezagado la arrastra. Compare las tres distribuciones.');

    const B = 1.2; // puntos de nivel por trimestre repartidos entre dominios
    function iniciar() {
      L = [1.5, 1.5, 1, 1, 1.5]; hist = [L.slice()];
      return (function* () {
        for (let t = 1; t <= TRIM; t++) {
          const tot = w.reduce((s, x) => s + x, 0) || 1, ld = L[2];
          L = L.map((l, i) => Math.min(5, l + B * (w[i] / tot) * (1 - l / 5) * (i === 2 ? 1 : 1 + 0.5 * (ld / 5))));
          hist.push(L.slice());
          registro.textContent = `Trimestre ${t}: cada dominio avanza en proporción a su esfuerzo, con rendimientos decrecientes; los datos (${VIZ.fmt(ld, 3)}) potencian a los otros cuatro.`;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: TRIM, ymin: 0, ymax: 5 }, { etiquetaX: 'trimestre', etiquetaY: 'nivel de madurez (0–5)' });
      pl.ejes();
      DOM.forEach((_, i) => VIZ.trazar(ctx, pl, hist.map((h, t) => [t, h[i]]), VIZ.series[i], 2));
      VIZ.trazar(ctx, pl, hist.map((h, t) => [t, media(h)]), C.apagado, 2.5, [4, 4]);
      VIZ.trazar(ctx, pl, hist.map((h, t) => [t, geo(h)]), C.tinta, 3.5);
      if (hover >= 0 && hover < hist.length) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke();
        hist[hover].forEach((val, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(val), VIZ.series[i], 3.5));
      }
      const u = hist[hist.length - 1], peor = u.indexOf(Math.min(...u));
      lectura.set([
        ['trimestre', String(hist.length - 1)],
        ['media geométrica', VIZ.fmt(geo(u), 3)],
        ['media aritmética', VIZ.fmt(media(u), 3)],
        ['penalización por desequilibrio', `${VIZ.fmt(100 * (1 - geo(u) / media(u)), 3)} %`],
        ['dominio más rezagado', `${DOM[peor].n} (${VIZ.fmt(u[peor], 2)})`],
      ]);
      if (hist.length === 1) registro.textContent = 'Parte de un perfil tradicional. Pulse «Reproducir» para invertir durante 16 trimestres.';
    }
    lienzo.alDibujar = () => hist.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(TRIM, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      if (hover >= hist.length) return tip.ocultar();
      tip.mostrar(x, y, `trimestre <b>${hover}</b>` + DOM.map((d, i) => VIZ.filaTooltip(VIZ.series[i], d.n, VIZ.fmt(hist[hover][i], 3))).join('') + VIZ.filaTooltip(C.tinta, 'media geométrica', VIZ.fmt(geo(hist[hover]), 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('five-digital-domains', {
    intro: String.raw`
      <p>Según David Rogers, la transformación digital no consiste en comprar tecnología, sino en cambiar cinco <strong>dominios</strong> de la estrategia: <strong>clientes</strong>, <strong>competencia</strong>, <strong>datos</strong>, <strong>innovación</strong> y <strong>valor</strong>. En cada uno hay un supuesto heredado de la era industrial que la tecnología digital deja sin sustento: los clientes ya no son una masa que recibe mensajes, sino una red que conversa; la competencia no es solo el sector, sino un ecosistema; los datos dejan de ser un subproducto para ser un activo; la innovación pasa de grandes proyectos a experimentos rápidos; y el valor deja de ser fijo.</p>
      <p>Las figuras permiten evaluar una organización en un radar de madurez, ver cómo cambia cada supuesto y comprobar por qué el equilibrio entre dominios pesa tanto como el nivel de cada uno.</p>`,
    visualizaciones: [
      {
        titulo: 'Radar de madurez digital',
        descripcion: 'Arrastre los vértices del polígono para evaluar cada dominio de 0 a 5 y compare con la meta. Cambie de organización de partida: una empresa nativa digital y una pyme manufacturera tienen formas muy distintas.',
        montar: montarRadar,
      },
      {
        titulo: 'Los supuestos que cambian',
        descripcion: 'Elija un dominio y mueva el avance de 0 a 100 % para ver cómo se reemplaza el supuesto tradicional por el digital. Observe qué se desvanece (las flechas de difusión masiva, la frontera del sector) y qué aparece (la red, las alianzas).',
        montar: montarSupuestos,
      },
      {
        titulo: 'Invertir en equilibrio',
        descripcion: 'Reparta el esfuerzo entre los cinco dominios y reproduzca 16 trimestres. Compare «Todo en datos» y «Todo en innovación» con el reparto equilibrado: la media geométrica, que mide el valor, premia el equilibrio.',
        montar: montarEquilibrio,
      },
    ],
    teoria: String.raw`
      <h2>Los cinco dominios</h2>
      <table>
        <tr><th>Dominio</th><th>Supuesto tradicional</th><th>Supuesto digital</th><th>Pregunta para la organización</th></tr>
        <tr><td>Clientes</td><td>masa que recibe mensajes</td><td>red que conversa, recomienda y cocrea</td><td>¿Cómo nos hablan los clientes entre sí y con nosotros?</td></tr>
        <tr><td>Competencia</td><td>rivales de la misma industria</td><td>ecosistema: aliados, plataformas, nuevos entrantes</td><td>¿Quién podría quitarnos al cliente sin ser del sector?</td></tr>
        <tr><td>Datos</td><td>subproducto del negocio</td><td>activo estratégico</td><td>¿Qué decisiones cambian por los datos?</td></tr>
        <tr><td>Innovación</td><td>proyectos grandes, planificados</td><td>experimentos rápidos y baratos</td><td>¿Cuántas hipótesis probamos al mes?</td></tr>
        <tr><td>Valor</td><td>propuesta fija, definida por la empresa</td><td>propuesta que se adapta y se cocrea</td><td>¿Qué valor nuevo podemos entregar con lo que sabemos?</td></tr>
      </table>
      <h2>Medir la madurez</h2>
      <p>Cada dominio se evalúa en una escala de 0 a 5 (inexistente, inicial, emergente, definido, gestionado, optimizado). Dos resúmenes cuentan cosas distintas. La <strong>media aritmética</strong> \(\bar{L} = \tfrac{1}{5}\sum_i L_i\) mide el tamaño del esfuerzo; la <strong>media geométrica</strong> \(G = \big(\prod_i L_i\big)^{1/5}\) premia el equilibrio y castiga los rezagos, porque basta un dominio débil para limitar la propuesta de valor. El desequilibrio es \(1 - G/\bar L\).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Perfil A: \((4, 4, 4, 4, 4)\): \(\bar L = G = 4\). Perfil B: \((5, 5, 5, 5, 0{,}5)\): \(\bar L = 4{,}1\) pero \(G = (5^4 \cdot 0{,}5)^{1/5} = 312{,}5^{0{,}2} \approx 3{,}15\), un 23 % por debajo de su propio promedio y menos que el Perfil A. Una empresa con datos y tecnología excelentes pero sin cambio en su propuesta de valor (dominio 0,5) vale menos que una con todo en 4.</p></div>
      <h2>Interacciones</h2>
      <p>Los dominios no son independientes: los datos alimentan la personalización (clientes), la medición de experimentos (innovación) y nuevas fuentes de ingreso (valor). Por eso la figura de inversión da un impulso a los demás dominios proporcional al nivel de datos. La traducción a modelos concretos aparece en <a href="tema.html?id=digital-business-models">modelos de negocio digitales</a> y <a href="tema.html?id=platforms-network-effects">plataformas y efectos de red</a>; la diferencia con automatizar procesos, en <a href="tema.html?id=digitization-vs-transformation">digitización, digitalización y transformación</a>; y los indicadores para seguir el avance, en <a href="tema.html?id=kpi-fundamentals">fundamentos de KPI</a>.</p>`,
  });
})();
