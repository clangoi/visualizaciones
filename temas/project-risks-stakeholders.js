(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const pct = (v) => `${Math.round(v * 100)} %`;

  /* ---------- Fig. 1: registro de riesgos, matriz y reserva ---------- */

  const RIESGOS = [
    { n: 'Rotación de un analista clave', p: 20, d: 15, c: 30 },
    { n: 'Cambios de alcance durante la ejecución', p: 60, d: 10, c: 40 },
    { n: 'Retraso en las licencias del proveedor', p: 30, d: 8, c: 10 },
    { n: 'Mala calidad de los datos a migrar', p: 50, d: 12, c: 25 },
    { n: 'Resistencia al cambio de los usuarios', p: 40, d: 20, c: 50 },
    { n: 'Falla de integración con el sistema heredado', p: 35, d: 18, c: 60 },
    { n: 'Incidente de seguridad en las pruebas', p: 10, d: 25, c: 80 },
    { n: 'Subestimación de la fase de pruebas', p: 45, d: 7, c: 15 },
  ].map((r) => ({ ...r, mit: false }));
  const BASE_DIAS = 90, COSTO_MIT = 5;
  const NIVEL_COLOR = { bajo: C.s6, medio: C.s4, alto: C.s2, crítico: C.s8 };
  const PROB_REP = [5, 20, 40, 60, 85], DIAS_REP = [1, 4, 8, 15, 25];
  const nivelProb = (p) => (p <= 10 ? 1 : p <= 30 ? 2 : p <= 50 ? 3 : p <= 70 ? 4 : 5);
  const nivelImp = (d) => (d <= 2 ? 1 : d <= 5 ? 2 : d <= 10 ? 3 : d <= 20 ? 4 : 5);
  const pEf = (r) => (r.mit ? r.p / 2 : r.p);
  const evDias = (r) => (pEf(r) / 100) * r.d;
  const evCosto = (r) => (pEf(r) / 100) * r.c;

  function montarRiesgos(cuerpo) {
    const rs = RIESGOS.map((r) => ({ ...r }));
    let sel = 1, semilla = 1, pctl = 80, sim = [], hover = -1, geo = null, plH = null, bins = [];
    const ctl = VIZ.controles(cuerpo);
    const selector = ctl.selector({ etiqueta: 'Riesgo', opciones: rs.map((r, i) => [i, `${i + 1} · ${r.n}`]), valor: sel, alCambiar: (v) => { sel = +v; sincronizar(); actualizar(); } });
    const rP = ctl.rango({ etiqueta: 'Probabilidad', min: 5, max: 95, paso: 5, valor: rs[sel].p, formato: (v) => `${v} %`, alCambiar: (v) => { rs[sel].p = v; actualizar(); } });
    const rD = ctl.rango({ etiqueta: 'Impacto si ocurre', min: 1, max: 30, valor: rs[sel].d, formato: (v) => `${v} días`, alCambiar: (v) => { rs[sel].d = v; actualizar(); } });
    const cMit = ctl.casilla({ etiqueta: `Mitigar (costo ${COSTO_MIT} mil; reduce a la mitad la probabilidad)`, valor: false, alCambiar: (v) => { rs[sel].mit = v; actualizar(); } });
    ctl.rango({ etiqueta: 'Nivel de confianza de la reserva', min: 50, max: 95, paso: 5, valor: pctl, formato: (v) => `percentil ${v}`, alCambiar: (v) => { pctl = v; dibujarHist(); resumen(); } });
    ctl.boton('Nueva simulación', () => { semilla++; actualizar(); }, { primario: true });
    ctl.boton('Restablecer', () => { rs.forEach((r, i) => Object.assign(r, RIESGOS[i])); sincronizar(); actualizar(); });
    function sincronizar() { rP.valor = rs[sel].p; rD.valor = rs[sel].d; cMit.valor = rs[sel].mit; selector.valor = sel; }

    VIZ.subtitulo(cuerpo, 'Matriz de probabilidad × impacto');
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'riesgo bajo' }, { color: C.s4, texto: 'medio' }, { color: C.s2, texto: 'alto' }, { color: C.s8, texto: 'crítico' }, { color: C.tinta, texto: 'riesgo mitigado (anillo)', forma: 'punto' }]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.subtitulo(cuerpo, `Duración del proyecto con riesgos (plan: ${BASE_DIAS} días)`);
    const lH = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 220, altoMax: 300 });
    const tipH = VIZ.tooltip(lH);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'proyectos simulados' }, { color: C.apagado, texto: 'plan sin riesgos', forma: 'linea' }, { color: C.s7, texto: 'reserva por valor esperado', forma: 'linea' }, { color: C.s2, texto: 'reserva por percentil', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un círculo (o en una fila de la tabla) para elegir un riesgo, y en una celda de la matriz para ubicarlo ahí. Mitigue el más caro y vea cuánto baja el valor esperado frente al costo de mitigar. La simulación supone que cada riesgo, si ocurre, cae sobre la ruta crítica.');

    const tri = (rnd, a, m, b) => { const u = rnd(), c = (m - a) / (b - a); return u < c ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)); };
    function simular() {
      const rnd = VIZ.semilla(semilla * 7919);
      sim = Array.from({ length: 4000 }, () => BASE_DIAS + rs.reduce((s, r) => s + (rnd() * 100 < pEf(r) ? tri(rnd, 0.5 * r.d, r.d, 1.5 * r.d) : 0), 0));
      sim.sort((a, b) => a - b);
    }
    const cuantil = (q) => sim[Math.min(sim.length - 1, Math.floor(q * sim.length))];

    function tabla() {
      const filas = rs.map((r, i) => {
        const nv = S.riesgo(nivelProb(pEf(r)), nivelImp(r.d));
        return VIZ.el('tr', { class: 'clicable' + (i === sel ? ' activa' : ''), onclick: () => { sel = i; sincronizar(); actualizar(); } },
          VIZ.el('td', { class: 'izq' }, `${i + 1} ${r.n}`), VIZ.el('td', null, `${VIZ.fmt(pEf(r), 3)} %`), VIZ.el('td', null, String(r.d)),
          VIZ.el('td', { style: { color: NIVEL_COLOR[nv.nivel] } }, `${nv.puntaje} ${nv.nivel}`), VIZ.el('td', null, VIZ.fmt(evDias(r), 3)), VIZ.el('td', null, VIZ.fmt(evCosto(r), 3)));
      });
      const tot = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'Total (valor esperado)'), VIZ.el('th'), VIZ.el('th'), VIZ.el('th'),
        VIZ.el('th', null, VIZ.fmt(rs.reduce((s, r) => s + evDias(r), 0), 4)), VIZ.el('th', null, VIZ.fmt(rs.reduce((s, r) => s + evCosto(r), 0), 4)));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ...['Riesgo', 'prob.', 'días', 'puntaje y nivel', 'VE días', 'VE mil'].map((h, k) => VIZ.el('th', k ? null : { class: 'izq' }, h))), ...filas, tot));
    }

    function dibujarMatriz() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const x0 = 56, y0 = 18, x1 = W - 8, y1 = H - 40, cw = (x1 - x0) / 5, ch = (y1 - y0) / 5;
      geo = { x0, y0, cw, ch, pts: [] };
      for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) {
        const nv = S.riesgo(p, i), x = x0 + (i - 1) * cw, y = y1 - p * ch;
        ctx.fillStyle = VIZ.alfa(NIVEL_COLOR[nv.nivel], 0.22); ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.strokeRect(x, y, cw, ch);
        ctx.fillStyle = VIZ.alfa(C.tinta, 0.35); ctx.font = VIZ.fuente(9); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(String(nv.puntaje), x + cw - 4, y + 3);
      }
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ['≤10 %', '≤30 %', '≤50 %', '≤70 %', '>70 %'].forEach((t, k) => ctx.fillText(t, x0 - 6, y1 - (k + 0.5) * ch));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ['≤2 d', '≤5 d', '≤10 d', '≤20 d', '>20 d'].forEach((t, k) => ctx.fillText(t, x0 + (k + 0.5) * cw, y1 + 5));
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText('impacto en el cronograma →', x1, y1 + 22);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('probabilidad ↑', 2, 2);
      const celdas = new Map();
      rs.forEach((r, k) => {
        const key = `${nivelProb(pEf(r))}-${nivelImp(r.d)}`;
        if (!celdas.has(key)) celdas.set(key, []);
        celdas.get(key).push(k);
      });
      celdas.forEach((lista, key) => {
        const [p, i] = key.split('-').map(Number);
        lista.forEach((k, j) => {
          const cols = Math.max(1, Math.floor((cw - 4) / 24)), cx = x0 + (i - 1) * cw + 14 + (j % cols) * 24, cy = y1 - p * ch + 22 + Math.floor(j / cols) * 24;
          const r = rs[k], nv = S.riesgo(p, i);
          ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fillStyle = NIVEL_COLOR[nv.nivel]; ctx.fill();
          ctx.strokeStyle = r.mit ? C.tinta : C.superficie; ctx.lineWidth = r.mit ? 3 : 2; ctx.stroke();
          if (k === sel) { ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(k + 1), cx, cy + 1);
          geo.pts.push({ k, cx, cy });
        });
      });
    }

    function dibujarHist() {
      const { ctx } = lH;
      lH.limpiar();
      const lo = Math.floor(BASE_DIAS - 2), hi = Math.ceil(sim[sim.length - 1] + 1), nb = Math.min(32, hi - lo), w = (hi - lo) / nb;
      bins = Array.from({ length: nb }, (_, i) => ({ a: lo + i * w, b: lo + (i + 1) * w, n: 0 }));
      for (const v of sim) bins[Math.min(nb - 1, Math.floor((v - lo) / w))].n++;
      const nmax = Math.max(...bins.map((b) => b.n));
      plH = VIZ.plano(lH, { xmin: lo, xmax: hi, ymin: 0, ymax: nmax * 1.12 }, { etiquetaX: 'duración del proyecto (días)', etiquetaY: 'proyectos simulados', margen: { izq: 52 }, formatoY: (v) => String(Math.round(v)) });
      plH.ejes();
      bins.forEach((b, i) => {
        const x = plH.sx(b.a) + 1, ww = plH.sx(b.b) - plH.sx(b.a) - 2, y = plH.sy(b.n);
        ctx.globalAlpha = hover === i ? 0.7 : 1; ctx.fillStyle = C.s1;
        ctx.beginPath(); ctx.roundRect(x, y, ww, plH.y0 - y, [4, 4, 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
      });
      const ve = BASE_DIAS + rs.reduce((s, r) => s + evDias(r), 0), pc = cuantil(pctl / 100);
      [[BASE_DIAS, C.apagado, 'plan', [4, 3]], [ve, C.s7, 'VE', null], [pc, C.s2, `P${pctl}`, null]].forEach(([v, c, t, dash], k) => {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2; if (dash) ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(plH.sx(v), plH.y1); ctx.lineTo(plH.sx(v), plH.y0); ctx.stroke(); ctx.restore();
        ctx.fillStyle = c; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, plH.sx(v) + 4, plH.y1 + 2 + k * 12);
      });
    }

    function resumen() {
      const ve = rs.reduce((s, r) => s + evDias(r), 0), vc = rs.reduce((s, r) => s + evCosto(r), 0), pc = cuantil(pctl / 100) - BASE_DIAS;
      const cubre = sim.filter((v) => v <= BASE_DIAS + ve).length / sim.length;
      const r = rs[sel], nv = S.riesgo(nivelProb(pEf(r)), nivelImp(r.d)), ahorro = (r.p / 2 / 100) * r.c;
      registro.textContent = `Riesgo ${sel + 1} («${r.n}»): ${VIZ.fmt(pEf(r), 3)} % × ${r.d} días = ${VIZ.fmt(evDias(r), 3)} días esperados; nivel ${nv.nivel}. ${r.mit ? 'Mitigado.' : `Mitigarlo ahorraría ${VIZ.fmt(ahorro, 3)} mil esperados y cuesta ${COSTO_MIT} mil${ahorro > COSTO_MIT ? ': conviene.' : ': no conviene.'}`} La reserva por valor esperado (${VIZ.fmt(ve, 3)} días) solo cubre el ${pct(cubre)} de los casos.`;
      lectura.set([
        ['reserva por valor esperado', `${VIZ.fmt(ve, 3)} días · ${VIZ.fmt(vc, 4)} mil`],
        ['reserva por percentil', `${VIZ.fmt(pc, 3)} días (P${pctl})`],
        ['probabilidad de cumplir con la reserva por VE', pct(cubre)],
        ['riesgos críticos o altos', String(rs.filter((x) => ['crítico', 'alto'].includes(S.riesgo(nivelProb(pEf(x)), nivelImp(x.d)).nivel)).length)],
        ['mitigaciones aplicadas', `${rs.filter((x) => x.mit).length} (${rs.filter((x) => x.mit).length * COSTO_MIT} mil)`],
      ]);
    }
    function actualizar() { simular(); tabla(); dibujarMatriz(); dibujarHist(); resumen(); }
    lienzo.alDibujar = () => geo && dibujarMatriz();
    lH.alDibujar = () => plH && sim.length && dibujarHist();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.pts.find((q) => Math.hypot(q.cx - x, q.cy - y) < 14);
      if (g) { sel = g.k; sincronizar(); return actualizar(); }
      const i = Math.floor((x - geo.x0) / geo.cw), p = 4 - Math.floor((y - geo.y0) / geo.ch);
      if (i < 0 || i > 4 || p < 0 || p > 4) return;
      rs[sel].mit = false; rs[sel].p = PROB_REP[p]; rs[sel].d = DIAS_REP[i]; sincronizar(); actualizar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo && geo.pts.find((q) => Math.hypot(q.cx - x, q.cy - y) < 14);
      if (!g) return tip.ocultar();
      const r = rs[g.k];
      tip.mostrar(x, y, `<b>${g.k + 1} · ${r.n}</b><br>probabilidad ${VIZ.fmt(pEf(r), 3)} %${r.mit ? ' (mitigado)' : ''}<br>impacto ${r.d} días · ${r.c} mil<br>VE: ${VIZ.fmt(evDias(r), 3)} días, ${VIZ.fmt(evCosto(r), 3)} mil`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lH.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lH.posicion(ev);
      if (!plH || !plH.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujarHist(); } return tipH.ocultar(); }
      const v = plH.ix(x), i = bins.findIndex((b) => v >= b.a && v < b.b);
      if (i !== hover) { hover = i; dibujarHist(); }
      if (i >= 0) tipH.mostrar(x, y, `entre <b>${VIZ.fmt(bins[i].a, 3)}</b> y <b>${VIZ.fmt(bins[i].b, 3)}</b> días<br><b>${bins[i].n}</b> de ${sim.length} proyectos`);
    });
    lH.canvas.addEventListener('pointerleave', () => { hover = -1; tipH.ocultar(); if (sim.length) dibujarHist(); });
    actualizar();
  }

  /* ---------- Fig. 2: matriz poder / interés ---------- */

  const INTERESADOS = [
    { n: 'Gerente general (patrocinador)', poder: 92, interes: 78 },
    { n: 'Director de finanzas', poder: 80, interes: 35 },
    { n: 'Director de TI', poder: 70, interes: 90 },
    { n: 'Jefe comercial', poder: 58, interes: 88 },
    { n: 'Equipo de ventas (usuarios)', poder: 22, interes: 92 },
    { n: 'Atención al cliente', poder: 30, interes: 65 },
    { n: 'Proveedor del CRM', poder: 48, interes: 72 },
    { n: 'Auditoría interna', poder: 68, interes: 22 },
    { n: 'Ente regulador de datos', poder: 85, interes: 15 },
    { n: 'Clientes', poder: 18, interes: 40 },
  ];
  const ESTRATEGIAS = {
    cerca: { nombre: 'Gestionar de cerca', color: C.s2, horas: 4, plan: 'reunión semanal y decisiones conjuntas' },
    satisfecho: { nombre: 'Mantener satisfecho', color: C.s4, horas: 1, plan: 'resumen ejecutivo quincenal' },
    informado: { nombre: 'Mantener informado', color: C.s1, horas: 1.5, plan: 'boletín semanal y demostraciones' },
    monitorear: { nombre: 'Monitorear', color: C.s3, horas: 0.25, plan: 'aviso mensual' },
  };

  function montarInteresados(cuerpo) {
    const lista = INTERESADOS.map((s) => ({ ...s }));
    let umbral = 50, arrastre = -1, geo = null, pl = null;
    const clase = (s) => (s.poder >= umbral ? (s.interes >= umbral ? 'cerca' : 'satisfecho') : s.interes >= umbral ? 'informado' : 'monitorear');
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de «alto»', min: 30, max: 70, paso: 5, valor: umbral, formato: (v) => `${v} / 100`, alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.boton('Restablecer posiciones', () => { lista.forEach((s, i) => Object.assign(s, INTERESADOS[i])); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.85, altoMin: 320, altoMax: 420 });
    lienzo.canvas.style.touchAction = 'none';
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(ESTRATEGIAS).map((e) => ({ color: e.color, texto: e.nombre })));
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre un círculo para reubicar a un interesado: su estrategia de comunicación y la carga de trabajo del gerente de proyecto se recalculan. Mueva el umbral para ver cuántos pasan a «gestionar de cerca». Los números se explican en la tabla.');

    function tabla() {
      const filas = lista.map((s, i) => {
        const e = ESTRATEGIAS[clase(s)];
        return VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, `${i + 1} ${s.n}`), VIZ.el('td', { style: { color: e.color, fontWeight: 600 } }, e.nombre), VIZ.el('td', { class: 'izq' }, e.plan), VIZ.el('td', null, VIZ.fmt(e.horas, 3)));
      });
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('tr', null, ...['Interesado', 'Estrategia', 'Comunicación', 'h/sem'].map((h, k) => VIZ.el('th', k && k < 3 ? { class: 'izq' } : k ? null : { class: 'izq' }, h))), ...filas));
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 100 }, { etiquetaX: 'interés →', etiquetaY: 'poder ↑', margen: { izq: 40, der: 12, sup: 22, inf: 44 }, ticksX: [0, 25, 50, 75, 100], ticksY: [0, 25, 50, 75, 100] });
      // Cuadrantes.
      const ux = pl.sx(umbral), uy = pl.sy(umbral);
      [['monitorear', pl.x0, uy, ux - pl.x0, pl.y0 - uy], ['informado', ux, uy, pl.x1 - ux, pl.y0 - uy], ['satisfecho', pl.x0, pl.y1, ux - pl.x0, uy - pl.y1], ['cerca', ux, pl.y1, pl.x1 - ux, uy - pl.y1]]
        .forEach(([k, x, y, w, h]) => { ctx.fillStyle = VIZ.alfa(ESTRATEGIAS[k].color, 0.1); ctx.fillRect(x, y, w, h); ctx.fillStyle = ESTRATEGIAS[k].color; ctx.font = VIZ.fuente(10, 700); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(ESTRATEGIAS[k].nombre.toUpperCase(), x + 6, y + 5); });
      pl.ejes();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ux, pl.y1); ctx.lineTo(ux, pl.y0); ctx.moveTo(pl.x0, uy); ctx.lineTo(pl.x1, uy); ctx.stroke(); ctx.setLineDash([]);
      geo = [];
      lista.forEach((s, i) => {
        const x = pl.sx(s.interes), y = pl.sy(s.poder), e = ESTRATEGIAS[clase(s)];
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fillStyle = e.color; ctx.fill();
        ctx.strokeStyle = i === arrastre ? C.tinta : C.superficie; ctx.lineWidth = i === arrastre ? 3 : 2; ctx.stroke();
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 1);
        geo.push({ i, x, y });
      });
      tabla();
      const cuenta = Object.fromEntries(Object.keys(ESTRATEGIAS).map((k) => [k, lista.filter((s) => clase(s) === k).length]));
      const horas = lista.reduce((t, s) => t + ESTRATEGIAS[clase(s)].horas, 0), todos = lista.length * ESTRATEGIAS.cerca.horas;
      registro.textContent = arrastre >= 0
        ? `${lista[arrastre].n}: poder ${Math.round(lista[arrastre].poder)}, interés ${Math.round(lista[arrastre].interes)} → ${ESTRATEGIAS[clase(lista[arrastre])].nombre.toLowerCase()} (${ESTRATEGIAS[clase(lista[arrastre])].plan}).`
        : `Con umbral ${umbral}: ${cuenta.cerca} interesados exigen gestión cercana, ${cuenta.satisfecho} mantener satisfechos, ${cuenta.informado} informados y ${cuenta.monitorear} se monitorean. Tratar a todos «de cerca» costaría ${VIZ.fmt(todos, 3)} h/sem en vez de ${VIZ.fmt(horas, 3)}.`;
      lectura.set([
        ['gestionar de cerca', String(cuenta.cerca)], ['mantener satisfecho', String(cuenta.satisfecho)], ['mantener informado', String(cuenta.informado)], ['monitorear', String(cuenta.monitorear)],
        ['comunicación del gerente', `${VIZ.fmt(horas, 3)} h/sem`], ['ahorro frente a tratar a todos igual', `${Math.round((1 - horas / todos) * 100)} %`],
      ]);
      void H; void W;
    }
    lienzo.alDibujar = () => pl && dibujar();
    const cerca = (x, y) => geo && geo.find((q) => Math.hypot(q.x - x, q.y - y) < 15);
    lienzo.canvas.style.cursor = 'grab';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = cerca(x, y);
      if (!g) return;
      arrastre = g.i; lienzo.canvas.setPointerCapture(ev.pointerId); lienzo.canvas.style.cursor = 'grabbing'; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastre >= 0) {
        const s = lista[arrastre];
        s.interes = Math.max(0, Math.min(100, pl.ix(x))); s.poder = Math.max(0, Math.min(100, pl.iy(y)));
        tip.ocultar(); return dibujar();
      }
      const g = cerca(x, y);
      if (!g) return tip.ocultar();
      const s = lista[g.i];
      tip.mostrar(x, y, `<b>${g.i + 1} · ${s.n}</b><br>poder ${Math.round(s.poder)} · interés ${Math.round(s.interes)}<br>${ESTRATEGIAS[clase(s)].nombre}`);
    });
    const soltar = () => { if (arrastre < 0) return; arrastre = -1; lienzo.canvas.style.cursor = 'grab'; dibujar(); };
    lienzo.canvas.addEventListener('pointerup', soltar);
    lienzo.canvas.addEventListener('pointercancel', soltar);
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('project-risks-stakeholders', {
    intro: String.raw`
      <p>Un <strong>riesgo de proyecto</strong> es un evento incierto que, si ocurre, afecta el alcance, el plazo, el costo o la calidad. Se registra con su probabilidad y su impacto, se prioriza (el producto de ambos) y
      se decide qué hacer: evitarlo, mitigarlo, transferirlo o aceptarlo. La suma de los valores esperados da una <strong>reserva</strong> para contingencias, que conviene contrastar con una simulación.</p>
      <p>Los <strong>interesados</strong> (<em>stakeholders</em>) son las personas y organizaciones que afectan o son afectadas por el proyecto. No todos requieren la misma atención: la matriz de <strong>poder e interés</strong> sugiere cuánto y cómo comunicarse con cada uno, para que el tiempo del gerente
      se concentre donde importa.</p>`,
    visualizaciones: [
      {
        titulo: 'Registro de riesgos y reserva',
        descripcion: 'Elija un riesgo y cambie su probabilidad o impacto (o haga clic en una celda de la matriz). Mitigue el más costoso y compare el ahorro esperado con el costo de mitigar. Compare la reserva por valor esperado con la del percentil 80.',
        montar: montarRiesgos,
      },
      {
        titulo: 'Matriz de poder e interés',
        descripcion: 'Arrastre a los interesados entre los cuadrantes y observe cómo cambia la estrategia de comunicación y las horas semanales. Pruebe pasar al regulador a «alto interés» y mover el umbral a 30.',
        montar: montarInteresados,
      },
    ],
    teoria: String.raw`
      <h2>Registro y priorización de riesgos</h2>
      <p>Para cada riesgo \(i\) se estima la probabilidad \(p_i\) y el impacto \(I_i\) (días, dinero). El puntaje de la matriz de 5 × 5 es el producto de los niveles (1 a 5) de ambos, y se clasifica en bajo, medio, alto o crítico. El <em>valor esperado</em> de un riesgo y la reserva total son</p>
      \[ \mathrm{VE}_i = p_i\, I_i, \qquad \text{reserva} = \sum_i p_i\, I_i. \]
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con los ocho riesgos de la figura (20 %·15 d + 60 %·10 d + 30 %·8 d + 50 %·12 d + 40 %·20 d + 35 %·18 d + 10 %·25 d + 45 %·7 d) la reserva por valor esperado es \(3 + 6 + 2{,}4 + 6 + 8 + 6{,}3 + 2{,}5 + 3{,}15 \approx 37{,}4\) días
      (y 101 mil en costo). Pero cubrir el valor esperado equivale a cubrir solo cerca de la mitad de los casos: la reserva que cubre el 80 % de los casos (la figura la calcula) es mayor. La reserva por valor esperado es el promedio, no una garantía.</p></div>
      <p>Mitigar un riesgo vale la pena si el valor esperado que elimina supera lo que cuesta la mitigación: \(\Delta \mathrm{VE} = (p_i - p_i')\, I_i > c_{\text{mitigación}}\).</p>
      <h2>Simulación de la duración</h2>
      <p>Sortear cada riesgo (ocurre con probabilidad \(p_i\); su impacto sigue una distribución triangular entre \(0{,}5I_i\) y \(1{,}5I_i\)) miles de veces da la distribución de la duración total. Se lee el percentil que se esté dispuesto a respaldar:
      el percentil 80 de la duración menos el plan es la reserva con 80 % de confianza. Este análisis supone que los atrasos se suman en la ruta crítica; con redes de actividades más ricas, conviene combinar riesgos y la red de <a href="tema.html?id=schedules-resources">cronogramas y recursos</a>.</p>
      <h2>Interesados</h2>
      <table>
        <tr><th>Cuadrante</th><th>Poder</th><th>Interés</th><th>Estrategia</th></tr>
        <tr><td>Gestionar de cerca</td><td>alto</td><td>alto</td><td>involucrar en decisiones; comunicación frecuente y bidireccional</td></tr>
        <tr><td>Mantener satisfecho</td><td>alto</td><td>bajo</td><td>informar lo esencial y evitar sorpresas</td></tr>
        <tr><td>Mantener informado</td><td>bajo</td><td>alto</td><td>boletines, demostraciones, canal de consultas</td></tr>
        <tr><td>Monitorear</td><td>bajo</td><td>bajo</td><td>esfuerzo mínimo; revisar si cambian de cuadrante</td></tr>
      </table>
      <p>Las posiciones cambian durante el proyecto: un regulador de bajo interés pasa a «alto» cuando ocurre un incidente. Los interesados que se resisten al cambio son, además, un riesgo: ver
      <a href="tema.html?id=change-management">gestión del cambio</a>.</p>
      <h2>Conexiones</h2>
      <p>Los riesgos que alteran las cuatro variables se estudian en <a href="tema.html?id=triple-constraint">alcance, tiempo, costo y calidad</a>; alimentan los escenarios del <a href="tema.html?id=business-case">caso de negocio</a> y el bloque de riesgos del
      <a href="tema.html?id=pm-canvas">PM Canvas</a>. La matriz de riesgo es la misma que se usa en seguridad: <a href="tema.html?id=threats-vulnerabilities-risk">amenazas, vulnerabilidades y riesgo</a>.</p>`,
  });
})();
