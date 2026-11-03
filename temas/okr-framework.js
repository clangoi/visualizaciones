(function () {
  'use strict';
  const { color: C } = VIZ;

  const acotar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const puntaje = (ini, meta, act) => acotar((act - ini) / (meta - ini));
  // Banda de color según el puntaje de un resultado clave: 0–0,3 rojo, 0,3–0,7 amarillo, desde 0,7 verde.
  const banda = (s) => (s >= 0.7 ? C.s6 : s >= 0.3 ? C.s4 : C.s8);
  const nombreBanda = (s) => (s >= 0.7 ? 'verde: meta de éxito cumplida' : s >= 0.3 ? 'amarillo: avance parcial' : 'rojo: sin tracción');
  const f2 = (v) => VIZ.fmt(v, 2).replace('.', ',');
  const recortar = (ctx, texto, max) => {
    if (ctx.measureText(texto).width <= max) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: de la métrica al puntaje 0–1 ---------- */

  const ESCENARIOS = [
    { id: 'ingreso', n: 'Ingreso recurrente mensual', u: 'M$', ini: 80, meta: 120, act: 98 },
    { id: 'nps', n: 'NPS de clientes', u: 'pts', ini: 32, meta: 50, act: 41 },
    { id: 'tiempo', n: 'Tiempo de primera respuesta', u: 'h', ini: 24, meta: 8, act: 14 },
    { id: 'fuga', n: 'Fuga mensual de clientes', u: '%', ini: 4.5, meta: 2.5, act: 3.9 },
  ];

  function montarResultado(cuerpo) {
    let esc = ESCENARIOS[0], act = esc.act, meta = esc.meta, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Resultado clave', opciones: ESCENARIOS.map((e) => [e.id, `${e.n} (${e.u})`]), valor: esc.id, alCambiar: (v) => { esc = ESCENARIOS.find((e) => e.id === v); act = esc.act; meta = esc.meta; ajustar(); dibujar(); } });
    const rMeta = ctl.rango({ etiqueta: 'Meta del trimestre', min: 0, max: 1, paso: 0.01, valor: 0, formato: (v) => VIZ.fmt(v, 4), alCambiar: (v) => { meta = v; dibujar(); } });
    const rAct = ctl.rango({ etiqueta: 'Valor actual', min: 0, max: 1, paso: 0.01, valor: 0, formato: (v) => VIZ.fmt(v, 4), alCambiar: (v) => { act = v; dibujar(); } });
    ctl.boton('Restablecer', () => { act = esc.act; meta = esc.meta; ajustar(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'puntaje menor que 0,3' }, { color: C.s4, texto: '0,3 a 0,7' }, { color: C.s6, texto: '0,7 o más (éxito)' },
      { color: C.tinta, texto: 'valor actual', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre la línea superior para mover el valor actual, o use los controles. Escoja «Tiempo de primera respuesta»: la meta es menor que el valor inicial y la fórmula sigue funcionando.');

    function ajustar() {
      const d = Math.abs(esc.meta - esc.ini), lo = Math.min(esc.ini, esc.meta) - d, hi = Math.max(esc.ini, esc.meta) + d, paso = +(d / 100).toPrecision(1);
      for (const r of [rMeta, rAct]) { r.input.min = Math.max(0, lo); r.input.max = hi; r.input.step = paso; }
      rMeta.valor = meta; rAct.valor = act;
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 18, x1 = W - 18, yl = 60;
      const lo = Math.min(esc.ini, meta, act), hi = Math.max(esc.ini, meta, act);
      const mg = (hi - lo || 1) * 0.12, vmin = lo - mg, vmax = hi + mg;
      const sx = (v) => x0 + ((v - vmin) / (vmax - vmin)) * (x1 - x0);
      geo = { x0, x1, vmin, vmax, sx, yl };
      const s = meta === esc.ini ? 0 : puntaje(esc.ini, meta, act), bruto = meta === esc.ini ? 0 : (act - esc.ini) / (meta - esc.ini);
      // Escala de valores
      ctx.strokeStyle = C.eje; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, yl); ctx.lineTo(x1, yl); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = banda(s);
      ctx.beginPath(); ctx.moveTo(sx(esc.ini), yl); ctx.lineTo(sx(acotar(act, Math.min(esc.ini, meta), Math.max(esc.ini, meta))), yl); ctx.stroke();
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'top';
      const marca = (v, t, c, alto) => {
        ctx.strokeStyle = c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx(v), yl - alto); ctx.lineTo(sx(v), yl + alto); ctx.stroke();
        ctx.fillStyle = c; ctx.textAlign = 'center';
        ctx.fillText(t, Math.min(W - 40, Math.max(40, sx(v))), yl + alto + 3);
      };
      marca(esc.ini, `inicio ${VIZ.fmt(esc.ini, 4)}`, C.tinta2, 8);
      marca(meta, `meta ${VIZ.fmt(meta, 4)}`, C.tinta, 8);
      VIZ.marcador(ctx, sx(act), yl, C.tinta, 6);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`actual ${VIZ.fmt(act, 4)}`, Math.min(W - 44, Math.max(44, sx(act))), yl - 12);
      // Barra de puntaje 0–1
      const yb = 150, hb = 22, bx0 = x0, bx1 = x1;
      const px = (v) => bx0 + v * (bx1 - bx0);
      [[0, 0.3, C.s8], [0.3, 0.7, C.s4], [0.7, 1, C.s6]].forEach(([a, b, c]) => { ctx.fillStyle = VIZ.alfa(c, 0.22); ctx.fillRect(px(a), yb, px(b) - px(a), hb); });
      ctx.fillStyle = banda(s); ctx.beginPath(); ctx.roundRect(px(0), yb, Math.max(1, px(s) - px(0)), hb, [0, 4, 4, 0]); ctx.fill();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(px(0.7), yb - 6); ctx.lineTo(px(0.7), yb + hb + 6); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText('0', bx0, yb + hb + 6); ctx.textAlign = 'right'; ctx.fillText('1', bx1, yb + hb + 6);
      ctx.textAlign = 'center'; ctx.fillStyle = C.tinta; ctx.fillText('0,7', px(0.7), yb + hb + 6);
      ctx.font = VIZ.fuente(13, 600); ctx.textBaseline = 'bottom'; ctx.textAlign = s > 0.5 ? 'right' : 'left'; ctx.fillStyle = C.tinta;
      ctx.fillText(`puntaje ${f2(s)}`, s > 0.5 ? px(s) - 6 : px(s) + 6, yb - 6);
      registro.textContent = `Puntaje = (actual − inicio) / (meta − inicio) = (${VIZ.fmt(act, 4)} − ${VIZ.fmt(esc.ini, 4)}) / (${VIZ.fmt(meta, 4)} − ${VIZ.fmt(esc.ini, 4)}) = ${f2(bruto)}${bruto !== s ? `, acotado a ${f2(s)}` : ''}. Zona ${nombreBanda(s)}.`;
      lectura.set([
        ['avance bruto', f2(bruto)], ['puntaje (0 a 1)', f2(s)],
        ['falta para 0,7', `${VIZ.fmt(Math.max(0, 0.7 - s) * (meta - esc.ini), 3)} ${esc.u}`],
        ['sentido de la meta', meta >= esc.ini ? 'subir' : 'bajar'],
      ]);
    }
    let arrastrando = false;
    const desdeX = (x) => {
      const v = geo.vmin + ((x - geo.x0) / (geo.x1 - geo.x0)) * (geo.vmax - geo.vmin);
      act = acotar(+v.toPrecision(4), +rAct.input.min, +rAct.input.max); rAct.valor = act; dibujar();
    };
    lienzo.alDibujar = () => geo && dibujar();
    lienzo.canvas.style.cursor = 'ew-resize';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev); if (y < 100 && geo) { arrastrando = true; lienzo.canvas.setPointerCapture(ev.pointerId); desdeX(x); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastrando) return desdeX(x);
      if (!geo || y >= 100) return tip.ocultar();
      const v = geo.vmin + ((x - geo.x0) / (geo.x1 - geo.x0)) * (geo.vmax - geo.vmin);
      const s = meta === esc.ini ? 0 : puntaje(esc.ini, meta, v);
      tip.mostrar(x, y, `valor <b>${VIZ.fmt(v, 4)} ${esc.u}</b><br>puntaje si fuera el actual <b>${f2(s)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastrando = false; });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    ajustar(); dibujar();
  }

  /* ---------- Fig. 2: un objetivo con varios resultados clave ---------- */

  const KRS = [
    { n: 'NPS de 32 a 50', s: 0.6, w: 3 },
    { n: 'Primera respuesta de 24 h a 8 h', s: 0.4, w: 2 },
    { n: 'Resolución al primer contacto de 60 % a 80 %', s: 0.9, w: 3 },
    { n: 'Publicar 20 artículos de autoservicio', s: 1, w: 1 },
  ];

  function montarObjetivo(cuerpo) {
    let kr = KRS.map((k) => ({ ...k })), hover = -1, geo = null, arrastre = -1;
    const ctl = VIZ.controles(cuerpo);
    kr.forEach((k, i) => ctl.rango({ etiqueta: `Peso del resultado clave ${i + 1}`, min: 0, max: 5, valor: k.w, formato: (v) => String(v), alCambiar: (v) => { k.w = v; dibujar(); } }));
    ctl.boton('Restablecer', () => { kr.forEach((k, i) => { k.s = KRS[i].s; }); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 4 * 54 + 56 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'menor que 0,3' }, { color: C.s4, texto: '0,3 a 0,7' }, { color: C.s6, texto: '0,7 o más' },
      { color: C.tinta, texto: 'puntaje del objetivo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre sobre una barra para fijar el puntaje de ese resultado clave. Ponga peso 0 a uno para sacarlo del cálculo; suba el peso del más atrasado y vea cuánto cuesta al objetivo.');

    const total = () => kr.reduce((s, k) => s + k.w, 0);
    const ponderado = () => (total() ? kr.reduce((s, k) => s + k.w * k.s, 0) / total() : 0);
    const simple = () => kr.reduce((s, k) => s + k.s, 0) / kr.length;

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 8, x1 = W - 8, top = 34, alto = 54, wt = total();
      const px = (v) => x0 + v * (x1 - x0);
      geo = { x0, x1, top, alto };
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText('Objetivo: la mejor mesa de ayuda de la universidad', x0, 4);
      kr.forEach((k, i) => {
        const y = top + i * alto;
        if (i === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y - 4, W, alto - 2); }
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = k.w ? C.tinta : C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(recortar(ctx, `KR${i + 1}  ${k.n}`, W - 120), x0, y);
        ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2;
        ctx.fillText(`peso ${k.w}${wt ? ` (${Math.round((k.w / wt) * 100)} %)` : ''}`, x1, y);
        const yb = y + 18;
        ctx.fillStyle = VIZ.alfa(C.eje, 0.35); ctx.beginPath(); ctx.roundRect(px(0), yb, px(1) - px(0), 18, 4); ctx.fill();
        ctx.fillStyle = k.w ? banda(k.s) : C.inactivo; ctx.beginPath(); ctx.roundRect(px(0), yb, Math.max(2, px(k.s) - px(0)), 18, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = k.w ? C.tinta : C.apagado; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle';
        ctx.textAlign = k.s > 0.85 ? 'right' : 'left';
        ctx.fillText(f2(k.s), k.s > 0.85 ? px(k.s) - 6 : px(k.s) + 6, yb + 10);
      });
      // Línea de éxito 0,7 y puntaje del objetivo
      const yFin = top + kr.length * alto - 8;
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px(0.7), top - 6); ctx.lineTo(px(0.7), yFin); ctx.stroke(); ctx.restore();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('0,7', px(0.7), top - 7);
      const o = ponderado();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px(o), top - 6); ctx.lineTo(px(o), yFin); ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = o > 0.5 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`objetivo ${f2(o)}`, px(o) + (o > 0.5 ? -5 : 5), top - 7);
      const peor = kr.reduce((a, k, i) => (k.w && k.s < kr[a].s ? i : a), kr.findIndex((k) => k.w) < 0 ? 0 : kr.findIndex((k) => k.w));
      registro.textContent = wt
        ? `Puntaje del objetivo = Σ pesoᵢ · puntajeᵢ / Σ pesoᵢ = ${kr.map((k) => `${k.w}·${f2(k.s)}`).join(' + ')} / ${wt} = ${f2(o)}: ${nombreBanda(o)}.`
        : 'Todos los pesos son 0: el objetivo no tiene cómo medirse.';
      lectura.set([
        ['puntaje ponderado', f2(o)], ['promedio simple', f2(simple())],
        ['diferencia', f2(o - simple())],
        ['resultado clave más atrasado', wt ? `KR${peor + 1} (${f2(kr[peor].s)})` : '—'],
        ['resultados clave en verde', `${kr.filter((k) => k.w && k.s >= 0.7).length} de ${kr.filter((k) => k.w).length}`],
      ]);
    }
    const filaDe = (y) => { const i = Math.floor((y - geo.top + 4) / geo.alto); return i >= 0 && i < kr.length ? i : -1; };
    const fijar = (i, x) => { kr[i].s = Math.round(acotar((x - geo.x0) / (geo.x1 - geo.x0)) * 20) / 20; dibujar(); };
    lienzo.alDibujar = () => geo && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev); const i = filaDe(y); if (i >= 0) { arrastre = i; lienzo.canvas.setPointerCapture(ev.pointerId); fijar(i, x); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastre >= 0) { fijar(arrastre, x); return; }
      const i = filaDe(y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const k = kr[i], wt = total();
      tip.mostrar(x, y, `<b>KR${i + 1}</b> ${k.n}<br>puntaje <b>${f2(k.s)}</b><br>aporta <b>${wt ? f2((k.w * k.s) / wt) : '0'}</b> al objetivo`);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = -1; });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: cascada de OKR durante el trimestre ---------- */

  const AREAS = [
    { a: 'Ventas', o: 'Duplicar cuentas nuevas', krs: ['Cuentas nuevas', 'Renovaciones'], kr: 'Ingresos recurrentes', w: 0.4, ritmo: 0.95 },
    { a: 'Producto', o: 'Lanzar la versión 2', krs: ['Funciones entregadas', 'Defectos graves'], kr: 'Lanzar la versión 2', w: 0.3, ritmo: 0.8 },
    { a: 'Soporte', o: 'Clientes que se quedan', krs: ['Resolución 1.er contacto', 'NPS'], kr: 'Retención de clientes', w: 0.3, ritmo: 1.1 },
  ];
  const SEMANAS = 13;

  function montarCascada(cuerpo) {
    let semilla = 1, sem = 1, areas = AREAS.map((a) => ({ ...a })), ruido = [], cajas = [], hover = -1, sel = 0;
    const ctl = VIZ.controles(cuerpo);
    areas.forEach((a) => ctl.rango({ etiqueta: `Ritmo de ${a.a}`, min: 0.3, max: 1.4, paso: 0.05, valor: a.ritmo, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { a.ritmo = v; dibujar(); } }));
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 400 : 340) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'puntaje menor que 0,3' }, { color: C.s4, texto: '0,3 a 0,7' }, { color: C.s6, texto: '0,7 o más' }, { color: C.neutro, borde: C.eje, texto: 'objetivo (O) o resultado clave (KR)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Reproducir» para avanzar semana a semana el trimestre de 13 semanas, o ajuste el ritmo de un área. Haga clic en un cuadro para ver cómo se calcula su puntaje.');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 97 + 5), nor = () => VIZ.normal(rnd);
      ruido = areas.map(() => [nor(), nor()]);
      sem = 1;
      return (function* () { for (sem = 2; sem <= SEMANAS; sem++) yield; sem = SEMANAS; })();
    }
    // Puntaje de un resultado clave de área en la semana actual: ritmo × avance lineal esperado × variación.
    const hoja = (ai, k) => acotar(areas[ai].ritmo * (sem / SEMANAS) * (1 + 0.12 * ruido[ai][k]));
    const areaO = (ai) => (hoja(ai, 0) + hoja(ai, 1)) / 2;
    const empresa = () => areas.reduce((s, a, i) => s + a.w * areaO(i), 0);

    function caja(ctx, r, titulo, s, ancho, activa) {
      ctx.fillStyle = VIZ.alfa(banda(s), 0.2); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
      ctx.lineWidth = activa ? 3 : 1.5; ctx.strokeStyle = activa ? C.s1 : banda(s); ctx.stroke();
      ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(recortar(ctx, titulo, r.w - 8), r.x + r.w / 2, r.y + r.h / 2 - 7);
      ctx.font = VIZ.fuente(12, 600);
      ctx.fillText(f2(s), r.x + r.w / 2, r.y + r.h / 2 + 8);
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      cajas = [];
      const m = 6, gap = 8, cw = (W - 2 * m - 2 * gap) / 3, h = 44;
      const ys = [6, 82, 158, 238];
      const E = empresa();
      const col = (i) => m + i * (cw + gap);
      const empresaR = { x: W / 2 - Math.min(180, W / 2 - m), y: ys[0], w: Math.min(360, W - 2 * m), h, tipo: 'E', i: 0 };
      // Líneas de unión
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      const lin = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, (y1 + y2) / 2); ctx.lineTo(x2, (y1 + y2) / 2); ctx.lineTo(x2, y2); ctx.stroke(); };
      areas.forEach((a, i) => {
        lin(empresaR.x + empresaR.w / 2, ys[0] + h, col(i) + cw / 2, ys[1]);
        ctx.beginPath(); ctx.moveTo(col(i) + cw / 2, ys[1] + h); ctx.lineTo(col(i) + cw / 2, ys[2]); ctx.stroke();
        lin(col(i) + cw / 2, ys[2] + h, col(i) + cw / 4, ys[3]);
        lin(col(i) + cw / 2, ys[2] + h, col(i) + (3 * cw) / 4, ys[3]);
      });
      cajas.push(empresaR); caja(ctx, empresaR, 'O de la empresa: crecer con clientes fieles', E, 0, false);
      areas.forEach((a, i) => {
        const rk = { x: col(i), y: ys[1], w: cw, h, tipo: 'K', i };
        const ro = { x: col(i), y: ys[2], w: cw, h, tipo: 'A', i };
        cajas.push(rk, ro);
        caja(ctx, rk, `KR ${a.kr}`, areaO(i), 0, false);
        caja(ctx, ro, `O ${a.a}: ${a.o}`, areaO(i), 0, false);
        [0, 1].forEach((k) => {
          const rh = { x: col(i) + k * (cw / 2) + 1, y: ys[3], w: cw / 2 - 2, h: h + 6, tipo: 'H', i, k };
          cajas.push(rh);
          caja(ctx, rh, a.krs[k], hoja(i, k), 0, false);
        });
      });
      cajas.forEach((r, ix) => {
        if (ix === sel) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 7); ctx.stroke(); }
        if (ix === hover && ix !== sel) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 7); ctx.stroke(); }
      });
      const esperado = sem / SEMANAS;
      const r = cajas[sel];
      if (r.tipo === 'E') registro.textContent = `Semana ${sem} de ${SEMANAS}. Puntaje de la empresa = ${areas.map((a, i) => `${a.w}·${f2(areaO(i))}`).join(' + ')} = ${f2(E)}: cada KR de la empresa es el objetivo de un área.`;
      else if (r.tipo === 'K') registro.textContent = `KR «${areas[r.i].kr}» (peso ${areas[r.i].w}): su puntaje es el del objetivo del área ${areas[r.i].a}, ${f2(areaO(r.i))}. Así se alinean los niveles.`;
      else if (r.tipo === 'A') registro.textContent = `Objetivo de ${areas[r.i].a}: promedio de sus dos resultados clave = (${f2(hoja(r.i, 0))} + ${f2(hoja(r.i, 1))}) / 2 = ${f2(areaO(r.i))}.`;
      else registro.textContent = `«${areas[r.i].krs[r.k]}» (${areas[r.i].a}): ritmo ${Math.round(areas[r.i].ritmo * 100)} % × avance esperado ${f2(esperado)} × variación semanal = ${f2(hoja(r.i, r.k))}.`;
      lectura.set([
        ['semana', `${sem} de ${SEMANAS}`], ['avance lineal esperado', f2(esperado)],
        ['puntaje de la empresa', f2(E)],
        ['áreas bajo el ritmo', areas.filter((_, i) => areaO(i) < 0.9 * esperado).map((a) => a.a).join(', ') || 'ninguna'],
        ['proyección al cierre', f2(acotar(E / esperado))],
      ]);
    }
    const buscar = (x, y) => cajas.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    lienzo.alDibujar = () => cajas.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = buscar(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const r = cajas[i], a = areas[r.i];
      const txt = r.tipo === 'E' ? `<b>Empresa</b><br>puntaje <b>${f2(empresa())}</b>` : r.tipo === 'H' ? `<b>${a.krs[r.k]}</b> (${a.a})<br>puntaje <b>${f2(hoja(r.i, r.k))}</b>` : `<b>${r.tipo === 'K' ? 'KR ' + a.kr : 'O ' + a.o}</b><br>puntaje <b>${f2(areaO(r.i))}</b>`;
      tip.mostrar(x, y, txt);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const i = buscar(x, y); if (i >= 0) { sel = i; dibujar(); } });
    rep.reiniciar();
  }

  VIZ.registrarTema('okr-framework', {
    intro: String.raw`
      <p>Los <strong>OKR</strong> (<em>Objectives and Key Results</em>) separan dos preguntas: <em>¿adónde queremos llegar?</em>, un objetivo cualitativo e inspirador, y
      <em>¿cómo sabremos que llegamos?</em>, de dos a cinco resultados clave medibles. Cada resultado clave parte de un valor inicial, tiene una meta al final del periodo
      (normalmente un trimestre) y se califica de 0 a 1.</p>
      <p>A diferencia de un KPI, que vigila de forma permanente algo que debe mantenerse sano, un OKR busca un cambio y es deliberadamente ambicioso: se espera cumplir alrededor de 0,7.
      Los OKR se escriben en cascada, de modo que los resultados clave de la empresa son los objetivos de las áreas.</p>`,
    visualizaciones: [
      {
        titulo: 'Del valor medido al puntaje 0 a 1',
        descripcion: 'Arrastre el valor actual a lo largo de la escala y vea cómo cambia el puntaje y su color. Cambie a «Tiempo de primera respuesta», donde la meta es bajar, y mueva la meta para ver qué la hace inalcanzable.',
        montar: montarResultado,
      },
      {
        titulo: 'Un objetivo con varios resultados clave',
        descripcion: 'Fije el puntaje de cada resultado clave arrastrando su barra y cambie los pesos. Compare el puntaje ponderado con el promedio simple: suba el peso de un resultado clave atrasado.',
        montar: montarObjetivo,
      },
      {
        titulo: 'Cascada de OKR durante el trimestre',
        descripcion: 'Reproduzca las 13 semanas y cambie el ritmo de un área: su objetivo, el resultado clave de la empresa que alimenta y el puntaje global se recalculan en cascada. Baje el ritmo de Producto y observe quién arrastra a la empresa.',
        montar: montarCascada,
      },
    ],
    teoria: String.raw`
      <h2>Estructura de un OKR</h2>
      <p>Un <strong>objetivo</strong> es cualitativo, con plazo y motivador («Ser la mejor mesa de ayuda de la universidad»). Un <strong>resultado clave</strong> (KR) es un número con inicio,
      meta y fecha; mide un efecto, no una tarea. «Publicar 20 artículos» es una actividad que solo sirve si se enlaza con un resultado como «reducir las consultas repetidas en un 30 %».</p>
      <h2>Puntaje de un resultado clave</h2>
      <p>Con valor inicial \(v_0\), meta \(v_m\) y valor actual \(v\), el puntaje se acota al intervalo \([0,1]\):</p>
      \[ s = \min\!\left(1,\ \max\!\left(0,\ \frac{v - v_0}{v_m - v_0}\right)\right). \]
      <p>La fórmula sirve también cuando la meta es bajar: si el tiempo de respuesta va de 24 h a 8 h y hoy está en 14 h, \(s = (14-24)/(8-24) = 0{,}625\). Una escala usual:
      0 a 0,3 en rojo, 0,3 a 0,7 en amarillo y 0,7 o más en verde.</p>
      <h2>Puntaje de un objetivo</h2>
      <p>El avance del objetivo es el promedio de sus resultados clave, simple o ponderado por importancia \(w_i\):</p>
      \[ S = \frac{\sum_i w_i\, s_i}{\sum_i w_i}. \]
      <p>Ejemplo: con pesos 3, 2, 3 y 1 y puntajes 0,6; 0,4; 0,9 y 1, \(S = (1{,}8 + 0{,}8 + 2{,}7 + 1)/9 = 0{,}70\), mientras el promedio simple es 0,725. El resultado clave atrasado
      (0,4) pesa poco; subirle el peso a 5 baja \(S\) a 0,63.</p>
      <h2>Por qué 0,7</h2>
      <p>Los OKR se plantean como metas de estiramiento: si se cumplen siempre al 100 %, la meta era demasiado fácil. Un puntaje medio cercano a 0,7 indica ambición realista.
      Las metas de compromiso (que sí o sí se deben cumplir) se tratan aparte, como KPI.</p>
      <h2>Alineamiento en cascada</h2>
      <p>El puntaje de un resultado clave de la empresa se toma del objetivo del área que lo impulsa. Así, un retraso en Producto se ve en la cima. El avance esperado al día \(d\) de un trimestre
      de \(D\) días es \(d/D\) si el ritmo es lineal; un área con puntaje bastante menor que ese valor va retrasada.</p>
      <table>
        <tr><th></th><th>OKR</th><th>KPI</th></tr>
        <tr><td>Propósito</td><td>lograr un cambio</td><td>vigilar una operación</td></tr>
        <tr><td>Meta</td><td>ambiciosa (se espera ≈ 0,7)</td><td>realista (se espera 100 %)</td></tr>
        <tr><td>Horizonte</td><td>trimestre o año, se renueva</td><td>permanente</td></tr>
        <tr><td>Calificación</td><td>puntaje 0 a 1</td><td>valor frente a meta y umbrales</td></tr>
      </table>
      <h2>Conexiones</h2>
      <p>Un resultado clave suele apoyarse en un <a href="tema.html?id=kpi-fundamentals">KPI</a>; la forma de elegir qué medir sigue la
      <a href="tema.html?id=strategy-aligned-indicators">alineación con la estrategia</a>, y los umbrales de color se discuten en <a href="tema.html?id=targets-thresholds">metas y umbrales</a>.
      El seguimiento semanal se muestra en un <a href="tema.html?id=control-dashboards">tablero de control</a>.</p>`,
  });
})();
