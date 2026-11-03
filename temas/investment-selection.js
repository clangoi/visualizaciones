(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  const N = 8, LET = 'ABCDEFGH', ANOS = 4;
  // Restricciones lógicas: A y B son alternativas excluyentes (xA + xB ≤ 1); C exige D (xC ≤ xD).
  const EX = [0, 1], CO = [2, 3];

  // Cada proyecto invierte `costo` hoy y devuelve `flujo` cada año durante ANOS años.
  function datos(semilla) {
    const rnd = VIZ.semilla(semilla * 53 + 7);
    const costo = Array.from({ length: N }, () => 10 + 5 * Math.floor(rnd() * 9));
    const flujo = costo.map((c) => Math.round(c * (0.28 + rnd() * 0.24) * 10) / 10);
    return { costo, flujo };
  }
  const anualidad = (r) => (r < 1e-9 ? ANOS : (1 - Math.pow(1 + r, -ANOS)) / r);
  const vpnDe = (d, r) => d.costo.map((c, i) => Math.round((-c + d.flujo[i] * anualidad(r)) * 100) / 100);

  function violaciones(sel, usaEx, usaCo) {
    const v = [];
    if (usaEx && sel[EX[0]] && sel[EX[1]]) v.push(`${LET[EX[0]]} y ${LET[EX[1]]} son excluyentes`);
    if (usaCo && sel[CO[0]] && !sel[CO[1]]) v.push(`${LET[CO[0]]} exige ${LET[CO[1]]}`);
    return v;
  }
  // Fuerza bruta sobre las 2⁸ combinaciones: devuelve lista de { costo, vpn, mask } lógicamente factibles.
  function combinaciones(d, vpn, usaEx, usaCo) {
    const res = [];
    for (let m = 0; m < 1 << N; m++) {
      const sel = Array.from({ length: N }, (_, i) => !!(m >> i & 1));
      if (violaciones(sel, usaEx, usaCo).length) continue;
      let costo = 0, v = 0;
      sel.forEach((q, i) => { if (q) { costo += d.costo[i]; v += vpn[i]; } });
      res.push({ costo, vpn: v, mask: m });
    }
    return res;
  }
  function mejorCon(lista, presu) {
    let b = { vpn: 0, costo: 0, mask: 0 };
    for (const q of lista) if (q.costo <= presu + 1e-9 && q.vpn > b.vpn + 1e-9) b = q;
    return b;
  }
  const maskASel = (m) => Array.from({ length: N }, (_, i) => !!(m >> i & 1));
  // Cota de la relajación lineal (0 ≤ x ≤ 1) con las mismas restricciones.
  function cotaLP(d, vpn, presu, usaEx, usaCo) {
    const A = [d.costo.slice()], b = [presu], sen = ['<='];
    if (usaEx) { const f = Array(N).fill(0); f[EX[0]] = 1; f[EX[1]] = 1; A.push(f); b.push(1); sen.push('<='); }
    if (usaCo) { const f = Array(N).fill(0); f[CO[0]] = 1; f[CO[1]] = -1; A.push(f); b.push(0); sen.push('<='); }
    const r = O.lp(vpn, A, sen, b, { cotas: Array.from({ length: N }, () => [0, 1]) });
    return r.estado === 'optimo' ? Math.max(0, r.z) : 0;
  }
  const listaSel = (m) => LET.split('').filter((_, i) => m >> i & 1).join(' ') || 'ninguno';

  /* ---------- Fig. 1: elegir proyectos ---------- */

  function montarEleccion(cuerpo) {
    let semilla = 1, d = datos(semilla), r = 0.1, presu = 90, usaEx = true, usaCo = true, sel = Array(N).fill(false), mensaje = '', geo = null;
    let vpn = vpnDe(d, r), lista = [], mejor = null, lp = 0;
    const recalcular = () => {
      vpn = vpnDe(d, r); lista = combinaciones(d, vpn, usaEx, usaCo); mejor = mejorCon(lista, presu); lp = cotaLP(d, vpn, presu, usaEx, usaCo);
    };
    recalcular();

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto', min: 20, max: 200, paso: 5, valor: presu, formato: (v) => `${v} M$`, alCambiar: (v) => { presu = v; mensaje = ''; recalcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Tasa de descuento r', min: 0, max: 0.2, paso: 0.01, valor: r, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { r = v; mensaje = ''; recalcular(); dibujar(); } });
    ctl.casilla({ etiqueta: `${LET[EX[0]]} y ${LET[EX[1]]} excluyentes`, valor: usaEx, alCambiar: (v) => { usaEx = v; recalcular(); dibujar(); } });
    ctl.casilla({ etiqueta: `${LET[CO[0]]} exige ${LET[CO[1]]}`, valor: usaCo, alCambiar: (v) => { usaCo = v; recalcular(); dibujar(); } });
    ctl.boton('Aplicar el óptimo', () => { sel = maskASel(mejor.mask); mensaje = `Se aplicó el óptimo: ${listaSel(mejor.mask)}.`; dibujar(); }, { primario: true });
    ctl.boton('Vaciar', () => { sel = Array(N).fill(false); mensaje = 'Sin proyectos elegidos.'; dibujar(); });
    ctl.boton('Nuevos proyectos', () => { semilla++; d = datos(semilla); sel = Array(N).fill(false); mensaje = ''; recalcular(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 275 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'proyecto elegido (alto = VPN)' },
      { color: C.sobre, borde: C.eje, texto: 'proyecto sin elegir' },
      { color: C.s8, texto: 'VPN negativo / restricción violada / exceso de presupuesto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un proyecto para incluirlo o quitarlo. El VPN de cada uno es −costo + flujo anual × factor de anualidad a 4 años; la barra inferior compara la inversión con el presupuesto.');

    const costoSel = () => sel.reduce((s, q, i) => s + (q ? d.costo[i] : 0), 0);
    const vpnSel = () => sel.reduce((s, q, i) => s + (q ? vpn[i] : 0), 0);

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cw = W / N, top = 30, base = 150, alto = 112, vmax = Math.max(1, ...vpn.map(Math.abs));
      geo = { cw, top, base, alto };
      const viol = violaciones(sel, usaEx, usaCo);
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(W, base + 0.5); ctx.stroke();
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'top';
      for (let i = 0; i < N; i++) {
        const x = i * cw + cw * 0.14, w = cw * 0.72, h = (Math.abs(vpn[i]) / vmax) * alto, neg = vpn[i] < 0;
        const y = neg ? base : base - h;
        const malo = viol.length && ((usaEx && sel[i] && EX.includes(i)) || (usaCo && sel[i] && CO.includes(i)));
        ctx.fillStyle = sel[i] ? (neg || malo ? C.s8 : C.s1) : C.superficie;
        ctx.strokeStyle = sel[i] ? (neg || malo ? C.s8 : C.s1) : (neg ? C.s8 : C.eje); ctx.lineWidth = sel[i] ? 1 : 1.5;
        ctx.beginPath(); ctx.roundRect(x, y, w, Math.max(2, h), neg ? [0, 0, 4, 4] : [4, 4, 0, 0]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'center';
        ctx.font = VIZ.fuente(13, 600); ctx.fillText(LET[i], i * cw + cw / 2, base + 30 + (neg ? 0 : 0));
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(`c ${d.costo[i]}`, i * cw + cw / 2, base + 46);
        ctx.fillStyle = vpn[i] < 0 ? C.s8 : C.tinta2;
        ctx.textBaseline = neg ? 'top' : 'bottom'; ctx.fillText(VIZ.fmt(vpn[i], 3), i * cw + cw / 2, neg ? base + h + 3 : y - 3); ctx.textBaseline = 'top';
      }
      // Marcas de las restricciones lógicas.
      ctx.strokeStyle = C.apagado; ctx.fillStyle = C.apagado; ctx.lineWidth = 1.5; ctx.font = VIZ.fuente(10);
      if (usaEx) {
        const a = EX[0] * cw + cw / 2, b = EX[1] * cw + cw / 2, malo = sel[EX[0]] && sel[EX[1]];
        ctx.strokeStyle = malo ? C.s8 : C.apagado; ctx.fillStyle = malo ? C.s8 : C.apagado;
        ctx.beginPath(); ctx.moveTo(a, 20); ctx.lineTo(a, 14); ctx.lineTo(b, 14); ctx.lineTo(b, 20); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`${LET[EX[0]]} + ${LET[EX[1]]} ≤ 1`, (a + b) / 2, 11);
      }
      if (usaCo) {
        const a = CO[0] * cw + cw / 2, b = CO[1] * cw + cw / 2, malo = sel[CO[0]] && !sel[CO[1]];
        ctx.strokeStyle = malo ? C.s8 : C.apagado; ctx.fillStyle = malo ? C.s8 : C.apagado;
        ctx.beginPath(); ctx.moveTo(a, 20); ctx.lineTo(a, 14); ctx.lineTo(b, 14); ctx.lineTo(b, 20); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`${LET[CO[0]]} ≤ ${LET[CO[1]]}`, (a + b) / 2, 11);
      }
      // Barra de presupuesto.
      const yb = 232, hb = 28, usado = costoSel(), escala = Math.max(presu, usado) * 1.02, sx = (q) => (q / escala) * W;
      ctx.fillStyle = C.neutro; ctx.fillRect(0, yb, sx(presu), hb);
      let acum = 0;
      for (let i = 0; i < N; i++) if (sel[i]) {
        const x0 = sx(acum), x1 = sx(acum + d.costo[i]), dentro = Math.max(0, Math.min(acum + d.costo[i], presu) - acum);
        ctx.fillStyle = C.s1; ctx.fillRect(x0, yb, sx(acum + dentro) - x0, hb);
        if (dentro < d.costo[i]) { ctx.fillStyle = C.s8; ctx.fillRect(sx(acum + dentro), yb, x1 - sx(acum + dentro), hb); }
        ctx.strokeStyle = C.sobre; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x1, yb + hb); ctx.stroke();
        if (x1 - x0 > 16) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LET[i], (x0 + x1) / 2, yb + hb / 2); }
        acum += d.costo[i];
      }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(presu), yb - 5); ctx.lineTo(sx(presu), yb + hb + 5); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
      ctx.fillText(`inversión ${VIZ.fmt(usado)} de ${presu} M$`, 0, yb - 6);

      const excede = usado > presu + 1e-9;
      registro.textContent = mensaje || (excede ? `La inversión ${VIZ.fmt(usado)} supera el presupuesto ${presu}: Σ cᵢxᵢ ≤ B no se cumple.`
        : viol.length ? `Restricción violada: ${viol.join('; ')}.` : 'Elija proyectos con un clic.');
      lectura.set([
        ['VPN elegido', `${VIZ.fmt(vpnSel(), 4)} M$${excede || viol.length ? ' (infactible)' : ''}`],
        ['inversión / presupuesto', `${VIZ.fmt(usado)} / ${presu}`],
        ['óptimo entero', `${VIZ.fmt(mejor.vpn, 4)} (${listaSel(mejor.mask).replace(/ /g, '')})`],
        ['cota de la relajación', VIZ.fmt(lp, 4)],
        ['restricciones violadas', String(viol.length + (excede ? 1 : 0))],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const columna = (ev) => { const { x, y } = lienzo.posicion(ev); const i = Math.floor(x / geo.cw); return y < 235 && i >= 0 && i < N ? i : -1; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const i = columna(ev);
      if (i < 0) return;
      sel[i] = !sel[i];
      mensaje = `${sel[i] ? 'Se incluye' : 'Se quita'} el proyecto ${LET[i]} (costo ${d.costo[i]}, VPN ${VIZ.fmt(vpn[i], 3)}).`;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = columna(ev);
      if (i < 0) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      const reglas = [usaEx && EX.includes(i) ? `excluyente con ${LET[EX[0] === i ? EX[1] : EX[0]]}` : '', usaCo && i === CO[0] ? `exige ${LET[CO[1]]}` : '', usaCo && i === CO[1] ? `requerido por ${LET[CO[0]]}` : ''].filter(Boolean);
      tip.mostrar(x, y, `proyecto <b>${LET[i]}</b><br>costo <b>${d.costo[i]}</b> M$<br>flujo anual <b>${d.flujo[i]}</b> × ${ANOS} años<br>VPN a r = ${Math.round(r * 100)} %: <b>${VIZ.fmt(vpn[i], 3)}</b>${reglas.length ? `<br>${reglas.join(', ')}` : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: presupuesto frente a valor ---------- */

  function montarCurva(cuerpo) {
    let semilla = 1, d = datos(semilla), r = 0.1, presu = 90, usaEx = true, usaCo = true, hover = null;
    let vpn, conDep, solo, pts = [], total = 0, pl = null;
    const rBud = { v: null };
    function calcular() {
      vpn = vpnDe(d, r); total = d.costo.reduce((a, b) => a + b, 0);
      conDep = combinaciones(d, vpn, usaEx, usaCo); solo = combinaciones(d, vpn, false, false);
      pts = [];
      const paso = Math.max(1, Math.round(total / 60));
      for (let b = 0; b <= total + paso; b += paso) {
        const B = Math.min(b, total);
        pts.push({ b: B, ent: mejorCon(conDep, B).vpn, sin: mejorCon(solo, B).vpn, lp: cotaLP(d, vpn, B, usaEx, usaCo) });
      }
    }
    calcular();

    const ctl = VIZ.controles(cuerpo);
    rBud.v = ctl.rango({ etiqueta: 'Presupuesto', min: 0, max: total, paso: 1, valor: presu, formato: (v) => `${v} M$`, alCambiar: (v) => { presu = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tasa de descuento r', min: 0, max: 0.2, paso: 0.01, valor: r, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { r = v; calcular(); dibujar(); } });
    ctl.casilla({ etiqueta: `${LET[EX[0]]} y ${LET[EX[1]]} excluyentes`, valor: usaEx, alCambiar: (v) => { usaEx = v; calcular(); dibujar(); } });
    ctl.casilla({ etiqueta: `${LET[CO[0]]} exige ${LET[CO[1]]}`, valor: usaCo, alCambiar: (v) => { usaCo = v; calcular(); dibujar(); } });
    ctl.boton('Nuevos proyectos', () => { semilla++; d = datos(semilla); calcular(); rBud.v.max = total; presu = Math.min(presu, total); rBud.v.valor = presu; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['ent', 'óptimo entero con las dependencias', C.s1], ['sin', 'óptimo entero solo con presupuesto', C.s3], ['lp', 'cota de la relajación lineal (con las dependencias)', C.s2]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico (o mueva el presupuesto) para fijar B. El óptimo entero sube a saltos; la relajación lineal (línea naranja) es una cota que lo acompaña por arriba.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(1, ...pts.map((p) => Math.max(p.ent, p.sin, p.lp))) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: total, ymin: 0, ymax }, { etiquetaX: 'presupuesto B (M$)', etiquetaY: 'VPN total (M$)' });
      pl.ejes();
      // Curvas en escalera: el óptimo entero no decrece y salta al alcanzar un nuevo conjunto.
      const escalera = (k) => { const out = []; pts.forEach((p, i) => { if (i) out.push([p.b, pts[i - 1][k]]); out.push([p.b, p[k]]); }); return out; };
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, escalera('lp'), C.s2, 2);
      VIZ.trazar(ctx, pl, escalera('sin'), C.s3, 2, [6, 4]);
      VIZ.trazar(ctx, pl, escalera('ent'), C.s1, 2.5);
      ctx.restore();
      const act = mejorCon(conDep, presu), actSin = mejorCon(solo, presu), lp = cotaLP(d, vpn, presu, usaEx, usaCo);
      ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pl.sx(presu), pl.y0); ctx.lineTo(pl.sx(presu), pl.y1); ctx.stroke(); ctx.restore();
      VIZ.marcador(ctx, pl.sx(presu), pl.sy(act.vpn), C.s1, 5);
      VIZ.marcador(ctx, pl.sx(presu), pl.sy(lp), C.s2, 4);
      if (hover != null) {
        const p = pts[hover];
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(p.b), pl.y0); ctx.lineTo(pl.sx(p.b), pl.y1); ctx.stroke();
        SER.forEach(([k, , c]) => VIZ.marcador(ctx, pl.sx(p.b), pl.sy(p[k]), c, 3.5));
      }
      registro.textContent = `Con B = ${presu} M$ el mejor conjunto es ${listaSel(act.mask)} (inversión ${VIZ.fmt(act.costo)}).`;
      lectura.set([
        ['presupuesto B', `${presu} M$`],
        ['óptimo con dependencias', `${VIZ.fmt(act.vpn, 4)}  (${listaSel(act.mask).replace(/ /g, '')})`],
        ['óptimo solo con presupuesto', `${VIZ.fmt(actSin.vpn, 4)}  (${listaSel(actSin.mask).replace(/ /g, '')})`],
        ['costo de las dependencias', VIZ.fmt(actSin.vpn - act.vpn, 3)],
        ['brecha de la relajación', VIZ.fmt(lp - act.vpn, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const indice = (x) => { const b = pl.ix(x); let k = 0; pts.forEach((p, i) => { if (Math.abs(p.b - b) < Math.abs(pts[k].b - b)) k = i; }); return k; };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = indice(x); dibujar();
      const p = pts[hover], m = mejorCon(conDep, p.b);
      tip.mostrar(x, y, `B = <b>${VIZ.fmt(p.b)}</b> M$` + SER.map(([k, t, c]) => VIZ.filaTooltip(c, t.replace('óptimo entero ', 'entero ').replace('cota de la relajación lineal (con las dependencias)', 'relajación'), VIZ.fmt(p[k], 4))).join('') + `<div>elige <b>${listaSel(m.mask)}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      presu = Math.round(Math.max(0, Math.min(total, pl.ix(x)))); rBud.v.valor = presu; dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('investment-selection', {
    intro: String.raw`
      <p>Una empresa tiene varios proyectos candidatos y un presupuesto que no alcanza para todos. Cada proyecto se hace completo o no se hace, así que la decisión es
      binaria. Se busca el conjunto que sume el mayor <strong>valor presente neto</strong> (VPN) sin gastar más de lo disponible.</p>
      <p>Es una mochila con complicaciones realistas: algunos proyectos son alternativas entre sí (si se hace uno, el otro sobra) y otros dependen de una obra previa.
      Esas reglas lógicas se escriben como desigualdades lineales sobre las variables binarias, y cambian la respuesta aunque el presupuesto sea el mismo.</p>`,
    visualizaciones: [
      {
        titulo: 'Arme la cartera',
        descripcion: 'Elija proyectos con un clic y vigile el presupuesto y las reglas. Active una restricción lógica y pulse «Aplicar el óptimo»; suba la tasa de descuento r hasta que algún proyecto tenga VPN negativo y deje de convenir.',
        montar: montarEleccion,
      },
      {
        titulo: 'Valor óptimo según el presupuesto',
        descripcion: 'Arrastre el presupuesto o haga clic en la curva: el óptimo entero sube a saltos. Apague las dependencias y mida cuánto cuestan; la cota de la relajación lineal nunca queda por debajo.',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Valor presente neto</h2>
      <p>Un proyecto \(i\) cuesta \(c_i\) hoy y entrega un flujo \(f_i\) al final de cada año durante \(T\) años. Con tasa de descuento \(r\), su VPN es</p>
      \[ \text{VPN}_i = -c_i + \sum_{t=1}^{T} \frac{f_i}{(1+r)^t} = -c_i + f_i\,\frac{1-(1+r)^{-T}}{r}. \]
      <p>Si \(r\) sube, los flujos futuros valen menos y los VPN bajan: un proyecto con \(\text{VPN}_i&lt;0\) nunca conviene, y el conjunto óptimo puede cambiar sin que cambie el presupuesto.</p>

      <h2>Modelo con variables binarias</h2>
      <p>Sea \(x_i = 1\) si se ejecuta el proyecto \(i\). El presupuesto es \(B\):</p>
      \[ \max \sum_i \text{VPN}_i\, x_i \quad \text{s.a.} \quad \sum_i c_i x_i \le B, \qquad x_i \in \{0,1\}. \]
      <p>Las reglas lógicas se traducen a desigualdades lineales:</p>
      <table>
        <tr><th>Regla</th><th>Restricción</th></tr>
        <tr><td>no más de un proyecto entre \(S\) (excluyentes)</td><td>\(\sum_{i\in S} x_i \le 1\)</td></tr>
        <tr><td>exactamente uno entre \(S\)</td><td>\(\sum_{i\in S} x_i = 1\)</td></tr>
        <tr><td>\(i\) exige \(j\) (condicional)</td><td>\(x_i \le x_j\)</td></tr>
        <tr><td>\(i\) y \(j\) van juntos o ninguno</td><td>\(x_i = x_j\)</td></tr>
        <tr><td>al menos \(k\) entre \(S\)</td><td>\(\sum_{i\in S} x_i \ge k\)</td></tr>
      </table>
      <p>En la figura, \(x_A + x_B \le 1\) y \(x_C \le x_D\). Con \(x_C = 1\) y \(x_D = 0\) la segunda da \(1 \le 0\), así que se viola; con \(x_C = 0\) es verdadera para cualquier \(x_D\). Por eso exigir dependencias nunca mejora el óptimo: el conjunto factible se achica.</p>

      <h2>Qué muestra la curva del presupuesto</h2>
      <p>La función \(B \mapsto z^*(B)\) es no decreciente y <em>constante a tramos</em>: solo sube cuando \(B\) alcanza el costo de un conjunto mejor. Es una función escalón porque con variables enteras no se puede gastar «un poco más» para ganar «un poco más».
      La relajación lineal (\(0 \le x_i \le 1\)) da una cota \(z_{LP}(B) \ge z^*(B)\) y es continua y cóncava en \(B\); la distancia entre ambas es la <em>brecha de integralidad</em>. El gráfico calcula \(z^*\) revisando las \(2^8 = 256\) combinaciones, algo posible solo porque \(n\) es pequeño: en general se usa
      <a href="tema.html?id=branch-and-bound">ramificación y acotamiento</a>, que apoya su poda justamente en la cota lineal.</p>

      <h2>Conexiones</h2>
      <p>Sin las dependencias es el <a href="tema.html?id=knapsack-problem">problema de la mochila</a>. Los modelos con muchas reglas lógicas dan <a href="tema.html?id=lp-relaxation">relajaciones</a> más débiles o más fuertes según cómo se formulen
      (ver <a href="tema.html?id=valid-inequalities">desigualdades válidas</a>).</p>`,
  });
})();
