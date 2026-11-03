(function () {
  'use strict';
  const { color: C } = VIZ;
  const NIVEL = { bajo: C.s6, medio: C.s4, alto: C.s2, 'crítico': C.s8 };
  const mil = (v) => `${VIZ.fmt(v, 4)} mil USD`;
  const recortar = (ctx, texto, ancho) => {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  };
  const PROB = ['Rara', 'Poco probable', 'Posible', 'Probable', 'Casi segura'];
  const IMP = ['Insignificante', 'Menor', 'Moderado', 'Mayor', 'Catastrófico'];

  /* ---------- Fig. 1: matriz de riesgo 5×5 ---------- */

  const RIESGOS = [
    { n: 'Phishing a empleados', p: 4, i: 3 },
    { n: 'Ransomware', p: 3, i: 5 },
    { n: 'Fuga de la base de clientes', p: 2, i: 5 },
    { n: 'Falla del servidor principal', p: 3, i: 4 },
    { n: 'Fraude interno', p: 2, i: 3 },
    { n: 'Sistema sin parchear explotado', p: 4, i: 4 },
    { n: 'Pérdida de un portátil', p: 3, i: 2 },
    { n: 'Caída del proveedor en la nube', p: 2, i: 4 },
  ];

  function montarMatriz(cuerpo) {
    const R = RIESGOS.map((r) => ({ ...r }));
    let sel = 1, hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const sRiesgo = ctl.selector({ etiqueta: 'Riesgo seleccionado', opciones: R.map((r, k) => [k, `${k + 1}. ${r.n}`]), valor: sel, alCambiar: (v) => { sel = +v; sincronizar(); dibujar(); } });
    const rP = ctl.rango({ etiqueta: 'Probabilidad', min: 1, max: 5, valor: R[sel].p, formato: (v) => `${v} · ${PROB[v - 1]}`, alCambiar: (v) => { R[sel].p = v; dibujar(); } });
    const rI = ctl.rango({ etiqueta: 'Impacto', min: 1, max: 5, valor: R[sel].i, formato: (v) => `${v} · ${IMP[v - 1]}`, alCambiar: (v) => { R[sel].i = v; dibujar(); } });
    ctl.boton('Restablecer valores', () => { RIESGOS.forEach((r, k) => { R[k].p = r.p; R[k].i = r.i; }); sincronizar(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(400, Math.max(320, w * 0.62))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'bajo (1–3)' }, { color: C.s4, texto: 'medio (4–7)' }, { color: C.s2, texto: 'alto (8–14)' }, { color: C.s8, texto: 'crítico (15–25)' },
      { color: C.tinta, texto: 'riesgo (número) en su celda' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un círculo para seleccionar un riesgo y en una celda vacía para moverlo allí; también puede usar los deslizadores. El número de cada celda es probabilidad × impacto.');

    function sincronizar() { rP.valor = R[sel].p; rI.valor = R[sel].i; }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = W < 500 ? 46 : 100, inf = 34, sup = 8, der = 8;
      const cw = (W - izq - der) / 5, ch = (H - sup - inf) / 5;
      geo = { izq, sup, cw, ch, pos: [] };
      for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) {
        const x = izq + (i - 1) * cw, y = sup + (5 - p) * ch, nv = VIZ.si.riesgo(p, i).nivel;
        ctx.fillStyle = VIZ.alfa(NIVEL[nv], 0.28); ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(p * i), x + cw - 5, y + 4);
      }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let i = 1; i <= 5; i++) ctx.fillText(W < 500 ? String(i) : `${i} ${IMP[i - 1]}`.replace('Insignificante', 'Insignif.'), izq + (i - 0.5) * cw, H - inf + 6);
      ctx.fillText('IMPACTO', izq + 2.5 * cw, H - 14);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let p = 1; p <= 5; p++) ctx.fillText(W < 500 ? String(p) : `${p} ${PROB[p - 1]}`, izq - 6, sup + (5 - p + 0.5) * ch);
      ctx.save(); ctx.translate(10, sup + 2.5 * ch); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('PROBABILIDAD', 0, 0); ctx.restore();
      const celdas = new Map();
      R.forEach((r, k) => { const id = `${r.p},${r.i}`; if (!celdas.has(id)) celdas.set(id, []); celdas.get(id).push(k); });
      geo.pos = [];
      celdas.forEach((lista, id) => {
        const [p, i] = id.split(',').map(Number);
        const cx = izq + (i - 0.5) * cw, cy = sup + (5 - p + 0.5) * ch;
        lista.forEach((k, j) => {
          const n = lista.length, cols = n > 1 ? 2 : 1;
          const dx = n > 1 ? ((j % cols) - 0.5) * 26 : 0, dy = n > 2 ? (Math.floor(j / cols) - 0.5) * 24 : 0;
          const x = cx + dx, y = cy + dy + 4;
          geo.pos[k] = [x, y];
          const nv = VIZ.si.riesgo(p, i).nivel;
          ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
          ctx.fillStyle = C.superficie; ctx.fill();
          ctx.lineWidth = k === sel ? 3.5 : k === hover ? 2.5 : 1.5; ctx.strokeStyle = k === sel ? C.tinta : NIVEL[nv]; ctx.stroke();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(k + 1), x, y + 1);
        });
      });
      const niv = R.map((r) => VIZ.si.riesgo(r.p, r.i));
      const cuenta = (n) => niv.filter((v) => v.nivel === n).length;
      const s = R[sel], v = niv[sel];
      registro.textContent = `Riesgo ${sel + 1} «${s.n}»: probabilidad ${s.p} × impacto ${s.i} = ${v.puntaje} → nivel ${v.nivel}.`;
      lectura.set([
        ['seleccionado', `${v.puntaje} (${v.nivel})`],
        ['críticos', String(cuenta('crítico'))], ['altos', String(cuenta('alto'))], ['medios', String(cuenta('medio'))], ['bajos', String(cuenta('bajo'))],
        ['puntaje total', String(niv.reduce((a, b) => a + b.puntaje, 0))],
      ]);
    }
    const celdaDe = (x, y) => {
      const i = Math.floor((x - geo.izq) / geo.cw) + 1, p = 5 - Math.floor((y - geo.sup) / geo.ch);
      return i >= 1 && i <= 5 && p >= 1 && p <= 5 ? { p, i } : null;
    };
    const riesgoEn = (x, y) => geo.pos.findIndex((q) => q && Math.hypot(q[0] - x, q[1] - y) <= 13);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = riesgoEn(x, y);
      if (k !== hover) { hover = k; dibujar(); }
      const c = celdaDe(x, y);
      if (!c) return tip.ocultar();
      const aqui = R.map((r, j) => (r.p === c.p && r.i === c.i ? j : -1)).filter((j) => j >= 0);
      const v = VIZ.si.riesgo(c.p, c.i);
      tip.mostrar(x, y, `probabilidad <b>${c.p}</b> · impacto <b>${c.i}</b><br>puntaje <b>${v.puntaje}</b> (${v.nivel})` + aqui.map((j) => `<br>${j + 1}. ${R[j].n}`).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = riesgoEn(x, y);
      if (k >= 0) sel = k;
      else { const c = celdaDe(x, y); if (c) { R[sel].p = c.p; R[sel].i = c.i; } }
      sRiesgo.valor = sel; sincronizar(); dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: amenaza × vulnerabilidad × impacto ---------- */

  const ESCENARIOS = {
    phishing: { n: 'Phishing con robo de credenciales', v: 0.08, lam: 24, imp: 40 },
    ransom: { n: 'Ransomware en servidores', v: 0.12, lam: 3, imp: 500 },
    fuga: { n: 'Fuga de la base de clientes', v: 0.05, lam: 6, imp: 900 },
    ddos: { n: 'Ataque de denegación de servicio', v: 0.3, lam: 12, imp: 25 },
  };

  function montarFactores(cuerpo) {
    let esc = 'ransom', geo = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    const sEsc = ctl.selector({ etiqueta: 'Escenario', opciones: Object.entries(ESCENARIOS).map(([k, e]) => [k, e.n]), valor: esc, alCambiar: (v) => { esc = v; const e = ESCENARIOS[v]; rV.valor = e.v; rL.valor = Math.log10(e.lam); rI.valor = e.imp; dibujar(); } });
    const rL = ctl.rango({ etiqueta: 'Amenaza: intentos por año', min: -1, max: 2, paso: 0.05, valor: Math.log10(ESCENARIOS.ransom.lam), formato: (v) => VIZ.fmt(10 ** v, 3), alCambiar: () => dibujar() });
    const rV = ctl.rango({ etiqueta: 'Vulnerabilidad: éxito por intento', min: 0, max: 1, paso: 0.01, valor: ESCENARIOS.ransom.v, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: () => dibujar() });
    const rI = ctl.rango({ etiqueta: 'Impacto por éxito', min: 10, max: 2000, paso: 10, valor: ESCENARIOS.ransom.imp, formato: (v) => mil(v), alCambiar: () => dibujar() });
    const rU = ctl.rango({ etiqueta: 'Pérdida anual tolerable', min: 5, max: 500, paso: 5, valor: 100, formato: (v) => mil(v), alCambiar: () => dibujar() });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'pérdida esperada baja' }, { color: VIZ.css(VIZ.enRampa(0.55)), texto: 'media' }, { color: VIZ.css(VIZ.enRampa(1)), texto: 'alta' },
      { color: C.s2, texto: 'escenario actual' }, { color: C.tinta, texto: 'pérdida igual a la tolerable', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El plano muestra la pérdida anual esperada para el impacto elegido. Haga clic para mover el escenario (vulnerabilidad en x, intentos por año en y); la curva negra separa lo tolerable de lo que no lo es.');

    const ale = (lam, v, imp) => lam * v * imp;
    const tono = (a) => Math.min(1, Math.log10(1 + a) / Math.log10(1 + 200000));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const lam = 10 ** rL.valor, v = rV.valor, imp = rI.valor, umbral = rU.valor;
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0.1, ymax: 100 }, { logY: true, etiquetaX: 'vulnerabilidad (éxito por intento)', etiquetaY: 'intentos por año', formatoX: (t) => `${Math.round(t * 100)} %`, margen: { inf: 46 } });
      geo = pl;
      const nx = 40, ny = 28;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        const v0 = (a + 0.5) / nx, l0 = 10 ** (-1 + (3 * (b + 0.5)) / ny);
        ctx.fillStyle = VIZ.css(VIZ.enRampa(tono(ale(l0, v0, imp))));
        const x0 = pl.sx(a / nx), x1 = pl.sx((a + 1) / nx), y0 = pl.sy(10 ** (-1 + (3 * b) / ny)), y1 = pl.sy(10 ** (-1 + (3 * (b + 1)) / ny));
        ctx.fillRect(x0, y1, x1 - x0 + 0.5, y0 - y1 + 0.5);
      }
      pl.ejes();
      const pts = [];
      for (let k = 0; k <= 60; k++) { const vv = 0.005 + (0.995 * k) / 60, ll = umbral / (vv * imp); if (ll >= 0.1 && ll <= 100) pts.push([vv, ll]); }
      if (pts.length > 1) VIZ.trazar(ctx, pl, pts, C.tinta, 2.5);
      const a = ale(lam, v, imp);
      VIZ.marcador(ctx, pl.sx(v), pl.sy(lam), a > umbral ? C.s8 : C.s2, 7);
      if (hover) VIZ.marcador(ctx, pl.sx(hover.v), pl.sy(hover.l), C.sobre, 4);
      registro.textContent = `Pérdida anual esperada = ${VIZ.fmt(lam, 3)} intentos × ${Math.round(v * 100)} % de éxito × ${mil(imp)} = ${mil(a)}. ${a > umbral ? 'Supera' : 'Está dentro de'} la pérdida tolerable de ${mil(umbral)}.`;
      lectura.set([
        ['éxitos esperados por año', VIZ.fmt(lam * v, 3)],
        ['años entre éxitos', lam * v > 0 ? VIZ.fmt(1 / (lam * v), 3) : '∞'],
        ['pérdida anual esperada', mil(a)],
        ['frente a lo tolerable', `${VIZ.fmt((a / umbral) * 100, 3)} %`],
        ['con vulnerabilidad en 0', mil(0)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const aDatos = (ev) => { const { x, y } = lienzo.posicion(ev); return geo.dentro(x, y) ? { x, y, v: Math.min(1, Math.max(0, geo.ix(x))), l: Math.min(100, Math.max(0.1, geo.iy(y))) } : null; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const d = aDatos(ev);
      if (!d) { hover = null; tip.ocultar(); return dibujar(); }
      hover = d; dibujar();
      tip.mostrar(d.x, d.y, `vulnerabilidad <b>${Math.round(d.v * 100)} %</b><br>intentos/año <b>${VIZ.fmt(d.l, 3)}</b><br>pérdida esperada <b>${mil(ale(d.l, d.v, rI.valor))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const d = aDatos(ev);
      if (!d) return;
      rV.valor = Math.round(d.v * 100) / 100; rL.valor = Math.log10(d.l);
      dibujar();
    });
    sEsc.valor = esc;
    dibujar();
  }

  /* ---------- Fig. 3: priorización de controles ---------- */

  const RIESGOS_P = [
    { n: 'Ransomware', aro: 0.3, sle: 500 },
    { n: 'Fuga de datos de clientes', aro: 0.1, sle: 900 },
    { n: 'Phishing con fraude', aro: 0.8, sle: 60 },
    { n: 'Falla de hardware crítico', aro: 0.4, sle: 120 },
    { n: 'Explotación de sistema sin parchear', aro: 0.25, sle: 300 },
    { n: 'Fraude interno', aro: 0.15, sle: 200 },
  ];
  const CONTROLES_P = [
    { id: 'resp', n: 'Respaldos aislados', costo: 25, red: { 0: 0.7, 3: 0.5 } },
    { id: 'cif', n: 'Cifrado y control de acceso', costo: 40, red: { 1: 0.6, 5: 0.2 } },
    { id: 'cap', n: 'Capacitación y filtro de correo', costo: 30, red: { 2: 0.6, 0: 0.25 } },
    { id: 'par', n: 'Gestión de parches', costo: 35, red: { 4: 0.7, 0: 0.2 } },
    { id: 'hw', n: 'Hardware redundante', costo: 45, red: { 3: 0.8 } },
    { id: 'seg', n: 'Segregación de funciones', costo: 20, red: { 5: 0.6, 1: 0.1 } },
    { id: 'edr', n: 'Monitoreo 24×7 (EDR)', costo: 90, red: { 0: 0.5, 4: 0.4, 2: 0.3, 1: 0.3 } },
  ];

  function montarPriorizar(cuerpo) {
    let presupuesto = 120, tolerable = 40, geo = null, hover = -1;
    const inh = RIESGOS_P.map((r) => r.aro * r.sle);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto anual', min: 0, max: 300, paso: 5, valor: presupuesto, formato: (v) => mil(v), alCambiar: (v) => { presupuesto = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pérdida tolerable por riesgo', min: 5, max: 100, paso: 5, valor: tolerable, formato: (v) => mil(v), alCambiar: (v) => { tolerable = v; dibujar(); } });
    const estado = ctl.casillas(CONTROLES_P.map((c) => ({ clave: c.id, texto: `${c.n} (${c.costo})`, activo: false })), () => dibujar());
    const fijar = (ids) => cuerpo.querySelectorAll('.grupo-casillas input').forEach((inp, k) => {
      const quiere = ids.includes(CONTROLES_P[k].id);
      if (inp.checked !== quiere) { inp.checked = quiere; inp.dispatchEvent(new Event('change')); }
    });
    const subconjuntos = () => {
      const out = [];
      for (let m = 0; m < 1 << CONTROLES_P.length; m++) out.push(CONTROLES_P.filter((_, k) => m & (1 << k)).map((c) => c.id));
      return out;
    };
    const evaluar = (ids) => {
      const res = inh.map((a, r) => a * ids.reduce((p, id) => p * (1 - (CONTROLES_P.find((c) => c.id === id).red[r] || 0)), 1));
      const costo = ids.reduce((s, id) => s + CONTROLES_P.find((c) => c.id === id).costo, 0);
      const red = inh.reduce((s, a) => s + a, 0) - res.reduce((s, a) => s + a, 0);
      return { res, costo, red, neto: red - costo };
    };
    ctl.boton('Mejor combinación dentro del presupuesto', () => {
      let mejor = [], eval0 = evaluar([]);
      for (const s of subconjuntos()) { const e = evaluar(s); if (e.costo <= presupuesto && e.neto > eval0.neto + 1e-9) { mejor = s; eval0 = e; } }
      fijar(mejor); nota2.textContent = `Se revisaron las ${1 << CONTROLES_P.length} combinaciones posibles y se eligió la de mayor beneficio neto.`; dibujar();
    }, { primario: true });
    ctl.boton('Voraz por beneficio / costo', () => {
      const elegido = []; let gastado = 0;
      const orden = CONTROLES_P.map((c) => ({ id: c.id, r: evaluar([c.id]).red / c.costo })).sort((a, b) => b.r - a.r);
      for (const o of orden) { const c = CONTROLES_P.find((x) => x.id === o.id); if (gastado + c.costo <= presupuesto && evaluar([...elegido, o.id]).neto > evaluar(elegido).neto) { elegido.push(o.id); gastado += c.costo; } }
      fijar(elegido); nota2.textContent = 'Se tomaron los controles por orden de reducción por cada unidad de costo mientras alcanzó el presupuesto; puede no ser la mejor combinación.'; dibujar();
    });
    ctl.boton('Quitar todos', () => { fijar([]); nota2.textContent = ''; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + RIESGOS_P.length * 42 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.apagado, texto: 'riesgo inherente (sin controles)' },
      { color: C.s6, texto: 'riesgo residual tolerable' }, { color: C.s8, texto: 'riesgo residual sobre lo tolerable' },
      { color: C.tinta, texto: 'pérdida tolerable', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const nota2 = VIZ.nota(cuerpo, 'Marque controles y vea cuánto baja cada riesgo (los controles se combinan multiplicando lo que dejan pasar). Los botones buscan la combinación de mayor beneficio neto; compare la óptima con la voraz.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ids = CONTROLES_P.filter((c) => estado[c.id]).map((c) => c.id);
      const ev = evaluar(ids);
      const izq = W < 500 ? 118 : 230, der = 12, top = 26, fila = 42;
      const max = Math.max(...inh, tolerable) * 1.08, esc = (W - izq - der) / max;
      geo = { izq, top, fila, esc };
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const t of VIZ.ticks(0, max, Math.max(2, Math.floor((W - izq) / 90)))) {
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(izq + t * esc, top - 4); ctx.lineTo(izq + t * esc, top + RIESGOS_P.length * fila); ctx.stroke();
        ctx.fillText(VIZ.fmt(t), izq + t * esc, 4);
      }
      RIESGOS_P.forEach((r, k) => {
        const y = top + k * fila;
        if (k === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y, W, fila - 2); }
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, r.n, izq - 12), 8, y + fila / 2 - 2);
        ctx.beginPath(); ctx.roundRect(izq, y + 6, inh[k] * esc, 26, [0, 4, 4, 0]);
        ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.stroke();
        if (ev.res[k] > 0.05) {
          ctx.beginPath(); ctx.roundRect(izq, y + 10, ev.res[k] * esc, 18, [0, 4, 4, 0]);
          ctx.fillStyle = ev.res[k] <= tolerable ? C.s6 : C.s8; ctx.fill();
        }
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(izq + tolerable * esc, top - 4); ctx.lineTo(izq + tolerable * esc, top + RIESGOS_P.length * fila); ctx.stroke();
      const pend = ev.res.filter((v) => v > tolerable).length;
      registro.textContent = ids.length
        ? `Con ${ids.length} control(es) se gastan ${mil(ev.costo)} y la pérdida esperada baja de ${mil(inh.reduce((s, a) => s + a, 0))} a ${mil(ev.res.reduce((s, a) => s + a, 0))}. ${ev.costo > presupuesto ? 'Se pasa del presupuesto. ' : ''}${pend ? `${pend} riesgo(s) siguen sobre lo tolerable.` : 'Todos los riesgos quedan en lo tolerable.'}`
        : 'Sin controles, cada riesgo conserva su pérdida anual esperada (ARO × SLE).';
      lectura.set([
        ['costo de los controles', `${mil(ev.costo)} de ${mil(presupuesto)}`],
        ['pérdida residual', mil(ev.res.reduce((s, a) => s + a, 0))],
        ['reducción de riesgo', mil(ev.red)],
        ['beneficio neto', `${ev.neto < 0 ? '−' : ''}${mil(Math.abs(ev.neto))}`],
        ['retorno sobre el costo', ev.costo ? `${VIZ.fmt((ev.neto / ev.costo) * 100, 3)} %` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = Math.floor((y - geo.top) / geo.fila);
      const nuevo = k >= 0 && k < RIESGOS_P.length ? k : -1;
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (nuevo < 0) return tip.ocultar();
      const ids = CONTROLES_P.filter((c) => estado[c.id]).map((c) => c.id), e = evaluar(ids), r = RIESGOS_P[nuevo];
      const quienes = CONTROLES_P.filter((c) => c.red[nuevo]).map((c) => `<br>${estado[c.id] ? '● ' : '○ '}${c.n}: −${Math.round(c.red[nuevo] * 100)} %`).join('');
      tip.mostrar(x, y, `<b>${r.n}</b><br>ARO ${r.aro} × SLE ${mil(r.sle)}<br>inherente <b>${mil(inh[nuevo])}</b><br>residual <b>${mil(e.res[nuevo])}</b>${quienes}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('threats-vulnerabilities-risk', {
    intro: String.raw`
      <p>Una <strong>amenaza</strong> es algo que puede causar daño (un atacante, un incendio, un error humano); una <strong>vulnerabilidad</strong> es la debilidad que
      permite que la amenaza tenga éxito (un servidor sin parches, una contraseña débil); el <strong>riesgo</strong> es la combinación de ambas con el daño que provocarían.
      Sin amenaza o sin vulnerabilidad no hay riesgo, y si el daño es insignificante tampoco importa.</p>
      <p>Las organizaciones no pueden eliminar todos los riesgos, así que los ordenan en una matriz de probabilidad e impacto, estiman cuánto cuesta cada uno al año y
      eligen controles donde cada peso invertido reduce más pérdida esperada.</p>`,
    visualizaciones: [
      {
        titulo: 'Matriz de riesgo 5×5',
        descripcion: 'Mueva los ocho riesgos por la matriz con clic o con los deslizadores y mire cómo cambia su nivel. Pruebe llevar el ransomware a probabilidad 1 y compare cuántos riesgos críticos quedan.',
        montar: montarMatriz,
      },
      {
        titulo: 'Amenaza × vulnerabilidad × impacto',
        descripcion: 'Cambie el escenario y mueva el punto sobre el plano: la pérdida esperada es el producto de los tres factores. Pruebe bajar la vulnerabilidad a 0 % o ponga el punto bajo la curva negra para cumplir el umbral.',
        montar: montarFactores,
      },
      {
        titulo: 'Priorizar controles con un presupuesto',
        descripcion: 'Marque controles y compare el riesgo inherente con el residual. Pruebe presupuestos de 60 y de 150 mil USD y observe si «Mejor combinación» coincide con el método voraz.',
        montar: montarPriorizar,
      },
    ],
    teoria: String.raw`
      <h2>Amenaza, vulnerabilidad y riesgo</h2>
      <table>
        <tr><th>Concepto</th><th>Ejemplo</th><th>Se reduce con…</th></tr>
        <tr><td>Activo</td><td>base de datos de clientes</td><td>—</td></tr>
        <tr><td>Amenaza</td><td>grupo que lanza ransomware</td><td>poco control directo (inteligencia, disuasión)</td></tr>
        <tr><td>Vulnerabilidad</td><td>servidor sin el último parche</td><td>parches, configuración segura, capacitación</td></tr>
        <tr><td>Impacto</td><td>tres días sin facturar</td><td>respaldos, segmentación, seguros</td></tr>
      </table>
      <h2>Modelos cuantitativo y cualitativo</h2>
      <p>La forma cuantitativa más usada es la <em>pérdida anual esperada</em> (ALE): la tasa anual de ocurrencia (ARO) por la pérdida de cada evento (SLE).</p>
      \[ \mathrm{ALE} = \mathrm{ARO} \times \mathrm{SLE}, \qquad \mathrm{ARO} = \lambda\, v, \]
      <p>donde \(\lambda\) son los intentos al año y \(v\) la probabilidad de que cada intento tenga éxito. La forma cualitativa usa la matriz 5×5: puntaje \(= p \times i\) con \(p, i \in \{1, \dots, 5\}\), y los niveles
      <em>bajo</em> (1–3), <em>medio</em> (4–7), <em>alto</em> (8–14) y <em>crítico</em> (15–25).</p>
      <h2>Riesgo inherente y residual</h2>
      <p>El riesgo <strong>inherente</strong> es el que existe sin controles; el <strong>residual</strong>, el que queda después. Si el control \(k\) elimina una fracción \(r_k\) del riesgo y los controles son independientes,</p>
      \[ R_{\text{res}} = R_{\text{inh}} \prod_{k} (1 - r_k), \qquad \text{beneficio neto} = (R_{\text{inh}} - R_{\text{res}}) - \sum_k c_k. \]
      <p>Un control solo vale la pena si la reducción que logra supera su costo anual. Con varios controles que protegen contra el mismo riesgo, el segundo aporta menos que el primero.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> El ransomware tiene \(\mathrm{ARO} = 0{,}3\) y \(\mathrm{SLE} = 500\) mil USD, luego \(\mathrm{ALE} = 150\) mil. Respaldos aislados lo reducen en 70 % y cuestan 25 mil al año:
      residual \(= 150 \times 0{,}3 = 45\) mil, reducción \(105\) mil, beneficio neto \(80\) mil. Agregar un monitoreo de 90 mil que reduce otro 50 % deja \(22{,}5\) mil: reduce \(22{,}5\) mil más a cambio de \(90\) mil, no conviene para este riesgo solo.</p></div>
      <h2>Priorización</h2>
      <p>Elegir el mejor subconjunto de controles bajo un presupuesto es un problema de <em>mochila</em>: con \(n\) controles hay \(2^n\) combinaciones, y la heurística voraz (por reducción por unidad de costo) puede no ser óptima. Con pocos
      controles se revisan todas las combinaciones; con muchos se usa programación dinámica, como en el <a href="tema.html?id=knapsack-problem">problema de la mochila</a>.</p>
      <h2>Conexiones</h2>
      <p>Los riesgos violan la <a href="tema.html?id=cia-triad">tríada CIA</a>; las estrategias para tratarlos (evitar, reducir, transferir, aceptar) se comparan en
      <a href="tema.html?id=continuity-risk-mitigation">continuidad y mitigación</a>; y los ataques que explotan vulnerabilidades humanas se ven en
      <a href="tema.html?id=malware-phishing-social-engineering">malware, phishing e ingeniería social</a>.</p>`,
  });
})();
