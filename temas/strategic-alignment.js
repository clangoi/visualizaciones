(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${Math.round(v * 100)} %`;
  const mm = (v) => `$${VIZ.fmt(v, 4)} M`;

  /* ---------- Fig. 1: modelo de alineamiento ---------- */

  // Cuatro dominios (Henderson y Venkatraman) con tres perfiles posibles cada uno.
  const DOM = [
    { k: 'neg', n: 'Estrategia de negocio', op: ['Liderazgo en costos', 'Diferenciación por servicio', 'Innovación de productos'] },
    { k: 'ti', n: 'Estrategia de TI', op: ['TI para eficiencia (centro de costos)', 'TI que habilita productos nuevos', 'TI como plataforma de datos del cliente'] },
    { k: 'org', n: 'Infraestructura organizacional', op: ['Centralizada y estandarizada', 'Divisional por mercado', 'Equipos ágiles autónomos'] },
    { k: 'inf', n: 'Infraestructura de TI', op: ['ERP único y monolítico', 'Plataforma de servicios en la nube', 'Sistemas a medida por área'] },
  ];
  // Compatibilidad 0–1 entre perfiles de dominios vinculados (supuestos didácticos).
  const COMPAT = {
    'neg-ti': [[1, 0.4, 0.5], [0.4, 0.7, 1], [0.3, 1, 0.7]],
    'ti-inf': [[1, 0.6, 0.3], [0.3, 1, 0.5], [0.5, 1, 0.3]],
    'neg-org': [[1, 0.5, 0.3], [0.4, 0.8, 0.7], [0.2, 0.6, 1]],
    'org-inf': [[1, 0.6, 0.2], [0.4, 0.6, 1], [0.2, 1, 0.7]],
  };
  const ENLACES = [
    { id: 'neg-ti', a: 0, b: 1, n: 'Ajuste estratégico' }, { id: 'org-inf', a: 2, b: 3, n: 'Ajuste de infraestructura' },
    { id: 'neg-org', a: 0, b: 2, n: 'Negocio y organización' }, { id: 'ti-inf', a: 1, b: 3, n: 'Integración funcional' },
  ];
  const enlace = (sel, e) => COMPAT[e.id][sel[e.a]][sel[e.b]];
  const global = (sel) => Math.pow(ENLACES.reduce((q, e) => q * enlace(sel, e), 1), 1 / 4);
  const colorAj = (v) => (v >= 0.8 ? C.s6 : v >= 0.5 ? C.s4 : C.s8);

  function montarModelo(cuerpo) {
    let sel = [0, 1, 0, 2], cajas = [], hover = -1;
    const ctl = VIZ.controles(cuerpo);
    const ss = DOM.map((d, i) => ctl.selector({ etiqueta: d.n, opciones: d.op.map((t, j) => [j, t]), valor: sel[i], alCambiar: (v) => { sel[i] = +v; dibujar(); } }));
    ctl.boton('Mejor cambio', () => {
      let m = null;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { if (j === sel[i]) continue; const t = sel.slice(); t[i] = j; const gg = global(t); if (!m || gg > m.g) m = { i, j, g: gg }; }
      if (m && m.g > global(sel)) { sel[m.i] = m.j; sync(); }
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'ajuste alto (≥ 80 %)' }, { color: C.s4, texto: 'ajuste medio' }, { color: C.s8, texto: 'desajuste (< 50 %)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un recuadro para cambiar su perfil (o use los selectores). Cada flecha muestra qué tan compatibles son los dos perfiles que une; el alineamiento global es la media geométrica de las cuatro. «Mejor cambio» prueba todas las modificaciones de un solo dominio.');
    const sync = () => { ss.forEach((s, i) => { s.valor = sel[i]; }); dibujar(); };

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const m = 10, gx = Math.max(60, W * 0.2), gy = Math.max(50, H * 0.2), bw = (W - 2 * m - gx) / 2, bh = (H - 2 * m - gy) / 2;
      cajas = DOM.map((_, i) => ({ x: m + (i % 2) * (bw + gx), y: m + Math.floor(i / 2) * (bh + gy), w: bw, h: bh }));
      ENLACES.forEach((e) => {
        const A = cajas[e.a], B = cajas[e.b], v = enlace(sel, e), horiz = A.y === B.y;
        const x1 = horiz ? A.x + A.w : A.x + A.w / 2, y1 = horiz ? A.y + A.h / 2 : A.y + A.h, x2 = horiz ? B.x : B.x + B.w / 2, y2 = horiz ? B.y + B.h / 2 : B.y;
        ctx.strokeStyle = colorAj(v); ctx.lineWidth = 2 + 6 * v; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        ctx.fillStyle = C.superficie; ctx.fillRect(mx - 22, my - 9, 44, 18);
        ctx.font = VIZ.fuente(11, 700); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pct(v), mx, my + 1);
      });
      cajas.forEach((c, i) => {
        ctx.fillStyle = hover === i ? C.neutro : C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = hover === i ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(W < 520 ? 9 : 10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(DOM[i].n.toUpperCase().replace('INFRAESTRUCTURA', 'INFRAEST.'), c.x + c.w / 2, c.y + 8);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(W < 520 ? 10 : 12, 600);
        envolver(ctx, DOM[i].op[sel[i]], c.w - 14).forEach((l, k, a) => { ctx.textBaseline = 'middle'; ctx.fillText(l, c.x + c.w / 2, c.y + c.h / 2 + 8 + (k - (a.length - 1) / 2) * 15); });
      });
      const gg = global(sel), peor = ENLACES.reduce((q, e) => (enlace(sel, e) < enlace(sel, q) ? e : q), ENLACES[0]);
      registro.textContent = `Alineamiento global = (${ENLACES.map((e) => VIZ.fmt(enlace(sel, e), 2)).join(' × ')})^(1/4) = ${pct(gg)}. El enlace más débil es «${peor.n}» (${pct(enlace(sel, peor))}): ${DOM[peor.a].op[sel[peor.a]].toLowerCase()} frente a ${DOM[peor.b].op[sel[peor.b]].toLowerCase()}.`;
      lectura.set([['alineamiento global', pct(gg)], ...ENLACES.map((e) => [e.n, pct(enlace(sel, e))]), ['enlace más débil', peor.n]]);
    }
    function envolver(ctx, texto, ancho) {
      const pal = texto.split(' '), lin = []; let cur = '';
      pal.forEach((p) => { const t = cur ? `${cur} ${p}` : p; if (ctx.measureText(t).width > ancho && cur) { lin.push(cur); cur = p; } else cur = t; });
      lin.push(cur); return lin;
    }
    const sobre = (x, y) => cajas.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const i = sobre(lienzo.posicion(ev).x, lienzo.posicion(ev).y); if (i >= 0) { sel[i] = (sel[i] + 1) % 3; sync(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = sobre(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${DOM[i].n}</b><br>perfil ${sel[i] + 1} de 3<br>clic para cambiar`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: iniciativas frente a objetivos ---------- */

  const OBJ = ['Crecer ventas', 'Reducir costos', 'Mejorar servicio', 'Reducir riesgo'];
  const INI = [
    { n: 'Portal de autoservicio', c: 120, k: [2, 1, 3, 0] }, { n: 'Automatizar facturación', c: 80, k: [0, 3, 1, 1] },
    { n: 'Renovar la intranet', c: 60, k: [0, 1, 0, 0] }, { n: 'Analítica de ventas', c: 150, k: [3, 1, 2, 0] },
    { n: 'Correo en la nube', c: 70, k: [0, 2, 0, 1] }, { n: 'Respaldo y gestión de riesgos', c: 110, k: [0, 0, 0, 3] },
    { n: 'App móvil de vendedores', c: 90, k: [2, 0, 2, 0] }, { n: 'Pantalla gigante de gerencia', c: 40, k: [0, 0, 0, 0] },
    { n: 'Chatbot de soporte', c: 65, k: [1, 2, 3, 0] },
  ];
  const SIMB = ['·', '◔', '◑', '●'];
  const UMBRAL_AL = 0.35; // por debajo, la iniciativa se considera desalineada

  function montarMatriz(cuerpo) {
    let w = [7, 8, 6, 5], k = INI.map((x) => x.k.slice()), fin = INI.map(() => false), presupuesto = 400, pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    OBJ.forEach((o, j) => ctl.rango({ etiqueta: `Peso: ${o}`, min: 0, max: 10, valor: w[j], alCambiar: (v) => { w[j] = v; dibujar(); } }));
    ctl.rango({ etiqueta: 'Presupuesto', min: 100, max: 785, paso: 5, valor: presupuesto, formato: mm, alCambiar: (v) => { presupuesto = v; dibujar(); } });
    ctl.boton('Financiar por alineamiento', () => llenar((a, b) => puntaje(b) / INI[b].c - puntaje(a) / INI[a].c), { primario: true });
    ctl.boton('Financiar lo más barato', () => llenar((a, b) => INI[a].c - INI[b].c));
    ctl.boton('Vaciar', () => { fin = INI.map(() => false); dibujar(); });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' });
    caja.appendChild(tabla);
    tabla.appendChild(VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'Iniciativa'), VIZ.el('th', null, 'Costo'), ...OBJ.map((o) => VIZ.el('th', null, o)), VIZ.el('th', null, 'Puntaje')));
    const celdas = INI.map((it, i) => {
      const fila = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, it.n), VIZ.el('td', null, String(it.c)));
      const cs = OBJ.map((_, j) => { const td = VIZ.el('td', { title: 'clic para cambiar la contribución (0 a 3)', onclick: () => { k[i][j] = (k[i][j] + 1) % 4; dibujar(); } }, ''); td.style.cursor = 'pointer'; fila.appendChild(td); return td; });
      const tp = VIZ.el('td', null, ''); fila.appendChild(tp); tabla.appendChild(fila);
      return { cs, tp, fila };
    });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'financiada' }, { color: C.inactivo, texto: 'sin financiar' }, { color: C.s8, texto: 'desalineada (puntaje bajo el umbral)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda de la tabla (0 a 3: ·, ◔, ◑, ●) dice cuánto contribuye la iniciativa a un objetivo; haga clic para cambiarla. Los pesos expresan la estrategia. En el gráfico, haga clic en un punto para financiar o quitar una iniciativa; el anillo rojo marca las que casi no tocan los objetivos.');

    const puntaje = (i) => { const s = w.reduce((q, x) => q + x, 0); return s ? k[i].reduce((q, c, j) => q + w[j] * c, 0) / (3 * s) : 0; };
    function llenar(cmp) {
      fin = INI.map(() => false); let gasto = 0;
      INI.map((_, i) => i).sort(cmp).forEach((i) => { if (gasto + INI[i].c <= presupuesto) { fin[i] = true; gasto += INI[i].c; } });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      INI.forEach((_, i) => { celdas[i].cs.forEach((td, j) => { td.textContent = SIMB[k[i][j]]; }); celdas[i].tp.textContent = pct(puntaje(i)); });
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 170, ymin: 0, ymax: 1 }, { etiquetaX: 'costo (millones)', etiquetaY: 'alineamiento con la estrategia', formatoY: pct });
      pl.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(UMBRAL_AL)); ctx.lineTo(pl.x1, pl.sy(UMBRAL_AL)); ctx.stroke(); ctx.restore();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('umbral de alineamiento', pl.x1 - 4, pl.sy(UMBRAL_AL) - 2);
      INI.forEach((it, i) => {
        const x = pl.sx(it.c), y = pl.sy(puntaje(i));
        if (puntaje(i) < UMBRAL_AL) { ctx.beginPath(); ctx.arc(x, y, 12, 0, 2 * Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = C.s8; ctx.stroke(); }
        VIZ.marcador(ctx, x, y, fin[i] ? C.s1 : C.inactivo, i === hover ? 8 : 6);
        celdas[i].fila.classList.toggle('activa', fin[i]);
      });
      const usado = INI.reduce((q, it, i) => q + (fin[i] ? it.c : 0), 0), pond = usado ? INI.reduce((q, it, i) => q + (fin[i] ? it.c * puntaje(i) : 0), 0) / usado : 0;
      const desal = INI.reduce((q, it, i) => q + (fin[i] && puntaje(i) < UMBRAL_AL ? it.c : 0), 0);
      const sobrepasa = usado > presupuesto;
      registro.textContent = usado ? `Se financian ${fin.filter(Boolean).length} iniciativas por ${mm(usado)}${sobrepasa ? ` (excede el presupuesto de ${mm(presupuesto)})` : ''}. Alineamiento ponderado por costo = ${pct(pond)}; gasto desalineado = ${mm(desal)} (${pct(desal / usado)} del gasto).` : 'Aún no hay iniciativas financiadas: use los botones o haga clic en los puntos.';
      lectura.set([['gasto financiado', mm(usado)], ['presupuesto disponible', mm(Math.max(0, presupuesto - usado))], ['alineamiento medio', usado ? pct(pond) : '—'], ['gasto desalineado', mm(desal)], ['iniciativas', `${fin.filter(Boolean).length} de ${INI.length}`]]);
    }
    const buscar = (x, y) => { let m = -1, md = 14 * 14; INI.forEach((it, i) => { const q = (pl.sx(it.c) - x) ** 2 + (pl.sy(puntaje(i)) - y) ** 2; if (q < md) { md = q; m = i; } }); return m; };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), i = buscar(x, y); if (i >= 0) { fin[i] = !fin[i]; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = buscar(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${INI[i].n}</b><br>costo ${mm(INI[i].c)}<br>alineamiento ${pct(puntaje(i))}` + OBJ.map((o, j) => `<div>${o}: ${SIMB[k[i][j]]}</div>`).join('') + VIZ.filaTooltip(fin[i] ? C.s1 : C.inactivo, fin[i] ? 'financiada' : 'sin financiar', null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: costo de desalinearse ---------- */

  const KA = 1.6, KD = 0.5, MANT = 0.1, AÑOS = 8; // retorno bruto por peso alineado y desalineado; mantenimiento de la deuda

  function simular(B, a0, t0, caida, R) {
    const a = []; let deuda = 0, acum = 0; const acc = [0], net = [];
    for (let t = 1; t <= AÑOS; t++) {
      const at = t0 && t >= t0 ? Math.max(0, a0 - caida * Math.max(0, 1 - (t - t0) / R)) : a0;
      const mant = MANT * deuda, bruto = B * (at * KA + (1 - at) * KD), n = bruto - B - mant;
      deuda += B * (1 - at); acum += n; a.push(at); acc.push(acum); net.push(n);
    }
    return { a, acc, net, deuda };
  }

  function montarCosto(cuerpo) {
    let B = 100, a0 = 0.6, t0 = 4, caida = 0.3, R = 3, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto anual de TI', min: 20, max: 200, paso: 10, valor: B, formato: mm, alCambiar: (v) => { B = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parte del gasto alineada con la estrategia', min: 0, max: 1, paso: 0.05, valor: a0, formato: pct, alCambiar: (v) => { a0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Año del cambio estratégico (0 = ninguno)', min: 0, max: 7, valor: t0, formato: (v) => (v ? `año ${v}` : 'ninguno'), alCambiar: (v) => { t0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Caída del alineamiento por el cambio', min: 0, max: 0.5, paso: 0.05, valor: caida, formato: (v) => `−${Math.round(v * 100)} pts`, alCambiar: (v) => { caida = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Años en realinear', min: 1, max: 5, valor: R, formato: (v) => `${v} años`, alCambiar: (v) => { R = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'alineamiento perfecto (100 %)', forma: 'linea' }, { color: C.s1, texto: 'su caso', forma: 'linea' }, { color: C.s3, texto: 'su caso sin cambio estratégico', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Valor neto acumulado = lo que producen las iniciativas menos lo gastado y menos el mantenimiento de la «deuda» de proyectos desalineados. Baje el alineamiento bajo el punto de equilibrio y vea cómo el valor se vuelve negativo; luego active un cambio estratégico y observe cuántos años tarda en recuperarse.');

    function dibujar() {
      const idealS = simular(B, 1, 0, 0, 1), caso = simular(B, a0, t0, caida, R), sinC = simular(B, a0, 0, 0, 1);
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = [...idealS.acc, ...caso.acc, ...sinC.acc], lo = Math.min(0, ...todos), hi = Math.max(1, ...todos);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: AÑOS, ymin: lo * 1.08, ymax: hi * 1.08 }, { etiquetaX: 'año', etiquetaY: 'valor neto acumulado (millones)', formatoY: (v) => VIZ.entero(v), margen: { izq: 60 } });
      pl.ejes();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0) + 0.5); ctx.lineTo(pl.x1, pl.sy(0) + 0.5); ctx.stroke();
      const lin = (s, c, g) => VIZ.trazar(ctx, pl, s.acc.map((v, t) => [t, v]), c, 2, g);
      lin(idealS, C.apagado, [5, 4]);
      if (t0 && caida) lin(sinC, C.s3);
      lin(caso, C.s1);
      if (hover !== null) { [[idealS, C.apagado], [caso, C.s1]].forEach(([s, c]) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(s.acc[hover]), c, 4)); ctx.strokeStyle = C.tenue; ctx.beginPath(); ctx.moveTo(pl.sx(hover) + 0.5, pl.y1); ctx.lineTo(pl.sx(hover) + 0.5, pl.y0); ctx.stroke(); }
      const eq = (1 - KD) / (KA - KD), perdido = idealS.acc[AÑOS] - caso.acc[AÑOS], desper = caso.a.reduce((q, x) => q + B * (1 - x), 0);
      const tnet = caso.acc.findIndex((v, t) => t > 0 && v >= 0);
      registro.textContent = `Cada peso alineado devuelve ${KA} y cada peso desalineado solo ${KD}: el gasto se recupera si el alineamiento supera (1 − ${KD}) / (${KA} − ${KD}) = ${pct(eq)}. Con ${pct(a0)} se acumulan ${mm(caso.acc[AÑOS])} en ${AÑOS} años, ${mm(perdido)} menos que con alineamiento perfecto.`;
      lectura.set([['equilibrio de alineamiento', pct(eq)], ['valor a 8 años (su caso)', mm(caso.acc[AÑOS])], ['valor con 100 %', mm(idealS.acc[AÑOS])], ['valor perdido', mm(perdido)], ['gasto desalineado total', mm(desper)], ['recupera lo invertido', tnet > 0 ? `año ${tnet}` : 'no en 8 años']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(AÑOS, Math.round(pl.ix(x)))); dibujar();
      const idealS = simular(B, 1, 0, 0, 1), caso = simular(B, a0, t0, caida, R);
      tip.mostrar(x, y, `año <b>${hover}</b>` + VIZ.filaTooltip(C.apagado, 'perfecto', mm(idealS.acc[hover])) + VIZ.filaTooltip(C.s1, 'su caso', mm(caso.acc[hover])) + (hover ? `<div>alineamiento ${pct(caso.a[hover - 1])}</div>` : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('strategic-alignment', {
    intro: String.raw`
      <p>El <strong>alineamiento estratégico</strong> mide qué tan bien lo que hace el área de TI (proyectos, sistemas, infraestructura) sirve a los objetivos de la empresa, y a la vez qué tan bien la estrategia del negocio aprovecha lo que la tecnología permite. No basta con tener buenos sistemas: un sistema excelente para una estrategia equivocada es dinero mal gastado.</p>
      <p>Alinear es una relación en dos sentidos entre cuatro dominios: la estrategia de negocio, la estrategia de TI, la infraestructura organizacional y la infraestructura de TI. Cuando alguno se desvía, aparecen proyectos que nadie usa, sistemas redundantes y una «deuda» de mantenimiento que se acumula año tras año.</p>`,
    visualizaciones: [
      {
        titulo: 'Los cuatro dominios y sus ajustes',
        descripcion: 'Cambie el perfil de cada dominio (clic en el recuadro) y vea qué enlaces se debilitan. El punto de partida combina liderazgo en costos con una TI que habilita productos nuevos: el enlace estratégico queda en rojo. Use «Mejor cambio» para ver qué ajuste recupera más alineamiento.',
        montar: montarModelo,
      },
      {
        titulo: 'Iniciativas frente a objetivos',
        descripcion: 'Cambie los pesos de los objetivos y la contribución de cada iniciativa; luego compare financiar «por alineamiento» con financiar «lo más barato». Observe qué pasa con el gasto desalineado y con la pantalla gigante de gerencia.',
        montar: montarMatriz,
      },
      {
        titulo: 'El costo de desalinearse',
        descripcion: 'Mueva la parte alineada del gasto por encima y por debajo del 45 % de equilibrio y observe el valor acumulado a ocho años; luego agregue un cambio estratégico y vea cuánto tarda en recuperarse según los años de realineamiento.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Modelo de alineamiento</h2>
      <p>El modelo de Henderson y Venkatraman distingue cuatro dominios: estrategia de negocio, estrategia de TI, infraestructura y procesos organizacionales, e infraestructura y procesos de TI. El <em>ajuste estratégico</em> une negocio con TI en lo externo (qué hacer) y el <em>ajuste funcional</em> en lo interno (cómo hacerlo). En la primera figura, a cada enlace se le asigna una compatibilidad \(c \in [0, 1]\) según los perfiles elegidos (valores didácticos), y el alineamiento global es su media geométrica:</p>
      \[ A = \Big( \prod_{e=1}^{4} c_e \Big)^{1/4}. \]
      <p>La media geométrica castiga el eslabón más débil: un solo enlace muy bajo arrastra todo el conjunto.</p>
      <h2>Iniciativas y objetivos</h2>
      <p>Con objetivos \(o = 1, \dots, m\) de peso \(w_o\) y una contribución \(k_{io} \in \{0, 1, 2, 3\}\) de la iniciativa \(i\), el puntaje de alineamiento y el alineamiento de una cartera \(F\) son</p>
      \[ a_i = \frac{\sum_o w_o\,k_{io}}{3 \sum_o w_o}, \qquad A_F = \frac{\sum_{i \in F} \text{costo}_i \cdot a_i}{\sum_{i \in F} \text{costo}_i}. \]
      <p>Financiar lo más barato maximiza el número de proyectos, no el alineamiento: la pantalla gigante de gerencia (\(a = 0\)) siempre entra, y el gasto desalineado se acumula.</p>
      <h2>Costo de la desalineación</h2>
      <p>Si cada peso alineado devuelve \(k_A = 1{,}6\) y cada peso desalineado \(k_D = 0{,}5\), con un gasto anual \(B\) y una fracción alineada \(a\), el valor neto de un año es</p>
      \[ N_t = B\,[\,a\,k_A + (1 - a)\,k_D\,] - B - \mu\,D_{t-1}, \qquad D_t = D_{t-1} + B\,(1 - a), \]
      <p>donde \(D\) es la deuda acumulada por gasto desalineado y \(\mu = 10\,\%\) su mantenimiento anual. Sin deuda, el gasto se recupera si \(a\,k_A + (1-a)\,k_D \ge 1\), es decir</p>
      \[ a \ge \frac{1 - k_D}{k_A - k_D} = \frac{0{,}5}{1{,}1} \approx 45{,}5\,\%. \]
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con \(B = 100\) y \(a = 0{,}6\): el primer año produce \(100\,(0{,}6 \times 1{,}6 + 0{,}4 \times 0{,}5) = 116\), neto \(+16\). Se generan \(40\) de deuda, que el año siguiente cuestan \(4\) de mantenimiento: neto \(+12\), y así sucesivamente. Con alineamiento perfecto el neto anual es \(+60\) sin deuda. Si en el año 4 un cambio de estrategia baja el alineamiento 30 puntos, el gasto desalineado salta a 70 % y el valor neto se vuelve negativo hasta que el realineamiento termina.</p></div>
      <h2>Conexiones</h2>
      <p>Alinear exige gobernanza clara (<a href="tema.html?id=culture-governance">cultura y gobernanza</a>), estrategia definida (<a href="tema.html?id=competitive-strategies">estrategias competitivas</a>) y criterios para financiar proyectos (<a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>). Los indicadores que verifican el alineamiento en el tiempo se estudian en <a href="tema.html?id=strategy-aligned-indicators">alineamiento de indicadores con la estrategia</a>.</p>`,
  });
})();
