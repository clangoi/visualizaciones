(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const mil = (v) => `${VIZ.fmt(v, 4)} mil`;
  const pct = (v) => (Number.isFinite(v) ? `${VIZ.fmt(v * 100, 3)} %` : 'no existe');
  const anios = (v) => (v == null ? 'no se recupera' : `${VIZ.fmt(v, 3)} años`);

  // Flujos de un caso: inversión en t = 0; en cada año, beneficios (tangibles + intangibles valorados) menos costo de operación.
  // El primer año de beneficios solo se alcanza la fracción `adop`; `d` desplaza los beneficios (retraso) y `f`, `fi` los escalan.
  function detalle(p) {
    const f = p.f ?? 1, fi = p.fi ?? 1, d = p.d ?? 0;
    const tang = [0], intang = [0], opex = [0], neto = [-p.inv * fi];
    for (let t = 1; t <= p.n; t++) {
      const k = t - d, a = k <= 0 ? 0 : k === 1 ? p.adop : 1;
      const tg = p.tang * f * a, it = p.usarIntang ? p.intang * f * a : 0;
      tang.push(tg); intang.push(it); opex.push(p.opex); neto.push(tg + it - p.opex);
    }
    return { tang, intang, opex, neto, inv: p.inv * fi };
  }
  const flujos = (p) => detalle(p).neto;
  const acumulado = (fl, r = 0) => { let s = 0; return fl.map((v, t) => (s += v / (1 + r) ** t)); };

  /* ---------- Fig. 1: costos y beneficios por año ---------- */

  function montarFlujos(cuerpo) {
    const p = { inv: 400, opex: 60, tang: 220, intang: 40, usarIntang: false, n: 5, adop: 0.6 };
    let tasa = 0.1, plano = null, geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    const cambia = (campo, fn = (v) => v) => (v) => { p[campo] = fn(v); dibujar(); };
    ctl.rango({ etiqueta: 'Inversión inicial', min: 100, max: 800, paso: 10, valor: p.inv, formato: (v) => `${v} mil`, alCambiar: cambia('inv') });
    ctl.rango({ etiqueta: 'Beneficio tangible anual', min: 0, max: 400, paso: 5, valor: p.tang, formato: (v) => `${v} mil`, alCambiar: cambia('tang') });
    ctl.rango({ etiqueta: 'Costo de operación anual', min: 0, max: 200, paso: 5, valor: p.opex, formato: (v) => `${v} mil`, alCambiar: cambia('opex') });
    ctl.rango({ etiqueta: 'Intangibles valorados por año', min: 0, max: 120, paso: 5, valor: p.intang, formato: (v) => `${v} mil`, alCambiar: cambia('intang') });
    ctl.rango({ etiqueta: 'Adopción en el primer año', min: 20, max: 100, paso: 5, valor: p.adop * 100, formato: (v) => `${v} %`, alCambiar: cambia('adop', (v) => v / 100) });
    ctl.rango({ etiqueta: 'Horizonte', min: 2, max: 8, valor: p.n, formato: (v) => `${v} años`, alCambiar: cambia('n') });
    ctl.rango({ etiqueta: 'Tasa de descuento', min: 2, max: 25, valor: tasa * 100, formato: (v) => `${v} %`, alCambiar: (v) => { tasa = v / 100; dibujar(); } });
    ctl.casilla({ etiqueta: 'Incluir los intangibles en la evaluación', valor: false, alCambiar: (v) => { p.usarIntang = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'beneficio tangible' }, { color: C.s3, texto: 'intangible valorado' }, { color: C.s2, texto: 'costo (inversión y operación)' },
      { color: C.tinta, texto: 'flujo acumulado', forma: 'linea' }, { color: C.apagado, texto: 'acumulado descontado', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las cifras están en miles de dólares. Mueva los controles y observe dónde la línea acumulada cruza el cero (recuperación). Active los intangibles: no son dinero en caja, pero pueden cambiar la decisión. Pase el cursor sobre un año para ver el detalle.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const d = detalle(p), fl = d.neto, ac = acumulado(fl), acd = acumulado(fl, tasa);
      const arriba = d.tang.map((v, i) => v + d.intang[i]), abajo = d.opex.map((v, i) => v + (i === 0 ? d.inv : 0));
      const ymax = Math.max(10, ...arriba, ...ac, ...acd) * 1.1, ymin = Math.min(-10, ...abajo.map((v) => -v), ...ac, ...acd) * 1.1;
      plano = VIZ.plano(lienzo, { xmin: -0.6, xmax: p.n + 0.6, ymin, ymax }, { etiquetaX: 'año', etiquetaY: 'miles de dólares', ticksX: Array.from({ length: p.n + 1 }, (_, i) => i), formatoX: (v) => String(v), margen: { izq: 52 } });
      plano.ejes();
      const y0 = plano.sy(0), mitad = 0.34, ancho = Math.abs(plano.sx(mitad) - plano.sx(0));
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(plano.x0, y0); ctx.lineTo(plano.x1, y0); ctx.stroke();
      for (let t = 0; t <= p.n; t++) {
        const x = plano.sx(t) - ancho, w = 2 * ancho - 2;
        ctx.globalAlpha = hover === t ? 0.75 : 1;
        if (abajo[t]) { ctx.fillStyle = C.s2; ctx.beginPath(); ctx.roundRect(x, y0, w, plano.sy(-abajo[t]) - y0, [0, 0, 4, 4]); ctx.fill(); }
        let base = 0;
        for (const [v, c] of [[d.tang[t], C.s1], [d.intang[t], C.s3]]) {
          if (v <= 0) continue;
          const ya = plano.sy(base + v), yb = plano.sy(base);
          ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, ya, w, yb - ya, base + v === arriba[t] ? [4, 4, 0, 0] : 0); ctx.fill();
          base += v;
        }
        ctx.globalAlpha = 1;
      }
      VIZ.trazar(ctx, plano, acd.map((v, t) => [t, v]), C.apagado, 2, [4, 4]);
      VIZ.trazar(ctx, plano, ac.map((v, t) => [t, v]), C.tinta, 2.5);
      ac.forEach((v, t) => VIZ.marcador(ctx, plano.sx(t), plano.sy(v), C.tinta, 3.5));
      const rec = S.recuperacion(fl);
      if (rec != null) {
        ctx.strokeStyle = C.s6; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(plano.sx(rec), plano.y1); ctx.lineTo(plano.sx(rec), plano.y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.s6; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('recuperación', plano.sx(rec) + 4, plano.y1 + 2);
      }
      geo = { d, ac, acd, fl };
      const vpn = S.vpn(fl, tasa), tir = S.tir(fl), ben = fl.slice(1).reduce((s, v) => s + v, 0);
      registro.textContent = `VPN = ${fl.map((v, t) => `${VIZ.fmt(v, 4)}/${VIZ.fmt((1 + tasa) ** t, 4)}`).join(' + ')} = ${mil(vpn)}. ${vpn > 0 ? 'Es positivo: el proyecto rinde más que la tasa exigida.' : 'Es negativo: a esta tasa el proyecto no se justifica.'}`;
      lectura.set([
        ['VPN', mil(vpn)],
        ['TIR', pct(tir)],
        ['recuperación', anios(rec)],
        ['retorno simple', pct(S.retorno(d.inv, ben))],
        ['flujo neto total', mil(fl.reduce((s, v) => s + v, 0))],
      ]);
    }
    lienzo.alDibujar = () => plano && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const t = Math.max(0, Math.min(p.n, Math.round(plano.ix(x))));
      if (t !== hover) { hover = t; dibujar(); }
      const { d, ac, acd, fl } = geo;
      tip.mostrar(x, y, `<b>año ${t}</b>`
        + (t === 0 ? VIZ.filaTooltip(C.s2, 'inversión', mil(d.inv)) : VIZ.filaTooltip(C.s1, 'tangibles', mil(d.tang[t])) + (p.usarIntang ? VIZ.filaTooltip(C.s3, 'intangibles', mil(d.intang[t])) : '') + VIZ.filaTooltip(C.s2, 'operación', mil(d.opex[t])))
        + `<br>flujo neto <b>${mil(fl[t])}</b><br>acumulado <b>${mil(ac[t])}</b><br>acumulado descontado <b>${mil(acd[t])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (plano) dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: dos alternativas y la tasa de descuento ---------- */

  const A = { nombre: 'A: plataforma completa', f: [-500, 60, 150, 220, 250, 250], color: C.s1 };
  const B = { nombre: 'B: solución modular', f: [-200, 90, 100, 100, 60, 40], color: C.s2 };
  const DIF = A.f.map((v, i) => v - B.f[i]);

  function montarComparar(cuerpo) {
    let tasa = 0.08, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    const rT = ctl.rango({ etiqueta: 'Tasa de descuento', min: 0, max: 40, paso: 0.5, valor: tasa * 100, formato: (v) => `${v} %`, alCambiar: (v) => { tasa = v / 100; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: A.color, texto: A.nombre, forma: 'linea' }, { color: B.color, texto: B.nombre, forma: 'linea' },
      { color: C.s7, texto: 'tasa de cruce', forma: 'linea' }, { color: C.apagado, texto: 'tasa elegida', forma: 'linea' },
    ]);
    // Flujos de ambos proyectos.
    const tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' },
      VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'miles de dólares'), ...A.f.map((_, t) => VIZ.el('th', null, `año ${t}`))),
      ...[A, B].map((q) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, q.nombre), ...q.f.map((v) => VIZ.el('td', null, VIZ.fmt(v))))));
    cuerpo.appendChild(VIZ.el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para fijar la tasa de descuento. A tasas bajas conviene A (mayor VPN); más allá de la tasa de cruce, B. La TIR, en cambio, siempre prefiere a B: por eso no debe usarse sola para elegir.');

    const cruce = S.tir(DIF), tirA = S.tir(A.f), tirB = S.tir(B.f);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const vmax = S.vpn(A.f, 0) * 1.05, vmin = -150;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 0.4, ymin: vmin, ymax: vmax }, { etiquetaX: 'tasa de descuento', etiquetaY: 'VPN (miles de dólares)', formatoX: (v) => `${Math.round(v * 100)} %`, margen: { izq: 52 } });
      plano.ejes();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(0)); ctx.lineTo(plano.x1, plano.sy(0)); ctx.stroke();
      for (const [q, tir] of [[A, tirA], [B, tirB]]) {
        const pts = []; for (let r = 0; r <= 0.4001; r += 0.005) pts.push([r, S.vpn(q.f, r)]);
        VIZ.trazar(ctx, plano, pts, q.color, 2.5);
        VIZ.marcador(ctx, plano.sx(tir), plano.sy(0), q.color, 5, 1);
      }
      for (const [r, c, dash] of [[cruce, C.s7, null], [tasa, C.apagado, [4, 3]]]) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1.8; if (dash) ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(plano.sx(r), plano.y1); ctx.lineTo(plano.sx(r), plano.y0); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = C.s7; ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'top'; ctx.textAlign = cruce > 0.25 ? 'right' : 'left';
      ctx.fillText('cruce', plano.sx(cruce) + (cruce > 0.25 ? -4 : 4), plano.y1 + 2);
      for (const q of [A, B]) VIZ.marcador(ctx, plano.sx(tasa), plano.sy(S.vpn(q.f, tasa)), q.color, 5);
      const vA = S.vpn(A.f, tasa), vB = S.vpn(B.f, tasa), rA = S.recuperacion(A.f), rB = S.recuperacion(B.f);
      registro.textContent = `Con tasa ${pct(tasa)}: VPN(A) = ${mil(vA)} y VPN(B) = ${mil(vB)}. ${vA === vB ? 'Empatan' : vA > vB ? 'Por VPN conviene A' : 'Por VPN conviene B'}; por TIR (${pct(tirA)} frente a ${pct(tirB)}) conviene B. ${(vA > vB) !== (tirA > tirB) ? 'Los criterios se contradicen: manda el VPN, que mide el valor creado.' : 'Ambos criterios coinciden.'}`;
      lectura.set([
        ['VPN de A', mil(vA)], ['VPN de B', mil(vB)],
        ['TIR A / B', `${pct(tirA)} / ${pct(tirB)}`],
        ['recuperación A / B', `${anios(rA)} / ${anios(rB)}`],
        ['tasa de cruce', pct(cruce)],
      ]);
    }
    lienzo.alDibujar = () => plano && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) return;
      tasa = Math.round(Math.max(0, Math.min(0.4, plano.ix(x))) * 200) / 200; rT.valor = tasa * 100; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const r = plano.ix(x);
      tip.mostrar(x, y, `tasa <b>${pct(r)}</b>` + VIZ.filaTooltip(A.color, 'VPN de A', mil(S.vpn(A.f, r))) + VIZ.filaTooltip(B.color, 'VPN de B', mil(S.vpn(B.f, r))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: escenarios y simulación ---------- */

  function montarEscenarios(cuerpo) {
    const base = { inv: 400, opex: 60, tang: 220, intang: 0, usarIntang: false, n: 5, adop: 0.6 };
    let tasa = 0.1, X = 0.3, Y = 0.35, sob = 0.3, ret = 1, pPes = 0.25, pOpt = 0.2, semilla = 1;
    let esc = [], sim = [], planoH = null, bins = [], hoverB = -1, hoverE = -1, zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Mejora de beneficios (optimista)', min: 0, max: 60, valor: X * 100, formato: (v) => `+${v} %`, alCambiar: (v) => { X = v / 100; calcular(); } });
    ctl.rango({ etiqueta: 'Caída de beneficios (pesimista)', min: 0, max: 60, valor: Y * 100, formato: (v) => `−${v} %`, alCambiar: (v) => { Y = v / 100; calcular(); } });
    ctl.rango({ etiqueta: 'Sobrecosto de la inversión (pesimista)', min: 0, max: 60, valor: sob * 100, formato: (v) => `+${v} %`, alCambiar: (v) => { sob = v / 100; calcular(); } });
    ctl.rango({ etiqueta: 'Retraso de los beneficios (pesimista)', min: 0, max: 2, valor: ret, formato: (v) => `${v} años`, alCambiar: (v) => { ret = v; calcular(); } });
    ctl.rango({ etiqueta: 'Probabilidad del pesimista', min: 5, max: 60, valor: pPes * 100, formato: (v) => `${v} %`, alCambiar: (v) => { pPes = v / 100; calcular(); } });
    ctl.rango({ etiqueta: 'Probabilidad del optimista', min: 5, max: 40, valor: pOpt * 100, formato: (v) => `${v} %`, alCambiar: (v) => { pOpt = v / 100; calcular(); } });
    ctl.rango({ etiqueta: 'Tasa de descuento', min: 2, max: 25, valor: tasa * 100, formato: (v) => `${v} %`, alCambiar: (v) => { tasa = v / 100; calcular(); } });
    ctl.boton('Nueva simulación', () => { semilla++; calcular(); }, { primario: true });

    VIZ.subtitulo(cuerpo, 'Tres escenarios');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 220, altoMax: 300 });
    const tip1 = VIZ.tooltip(l1);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'pesimista' }, { color: C.s1, texto: 'base' }, { color: C.s6, texto: 'optimista' }, { color: C.tinta, texto: 'VPN esperado', forma: 'linea' }]);
    VIZ.subtitulo(cuerpo, 'Simulación de 3 000 proyectos');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 220, altoMax: 300 });
    const tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'VPN negativo (no se justifica)' }, { color: C.s6, texto: 'VPN positivo' }, { color: C.tinta, texto: 'VPN esperado', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cifras en miles de dólares, con la inversión y beneficios del caso base de la primera figura. Suba la probabilidad del escenario pesimista o su retraso y vea cómo cae el VPN esperado y crece la fracción de proyectos con VPN negativo. Pase el cursor por las barras.');

    const tri = (rnd, a, m, b) => { const u = rnd(), c = (m - a) / (b - a); return u < c ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)); };
    function calcular() {
      const pBase = Math.max(0, 1 - pPes - pOpt), tot = pPes + pOpt + pBase;
      esc = [
        { n: 'Pesimista', c: C.s8, p: pPes / tot, v: S.vpn(flujos({ ...base, f: 1 - Y, fi: 1 + sob, d: ret }), tasa), txt: `beneficios −${Math.round(Y * 100)} %, inversión +${Math.round(sob * 100)} %, retraso ${ret} años` },
        { n: 'Base', c: C.s1, p: pBase / tot, v: S.vpn(flujos(base), tasa), txt: 'valores de la primera figura' },
        { n: 'Optimista', c: C.s6, p: pOpt / tot, v: S.vpn(flujos({ ...base, f: 1 + X }), tasa), txt: `beneficios +${Math.round(X * 100)} %` },
      ];
      const rnd = VIZ.semilla(semilla * 977);
      sim = Array.from({ length: 3000 }, () => S.vpn(flujos({ ...base, f: tri(rnd, 1 - Y, 1, 1 + X), fi: tri(rnd, 1, 1 + sob / 3, 1 + sob), d: rnd() < pPes / tot ? ret : 0 }), tasa));
      dibujar();
    }
    const esperado = () => esc.reduce((s, e) => s + e.p * e.v, 0);

    function dibujar() {
      if (!esc.length) return;
      const E = esperado();
      // Escenarios.
      {
        const { ctx, ancho: W } = l1;
        l1.limpiar();
        const vals = esc.map((e) => e.v), ymax = Math.max(50, ...vals, E) * 1.15, ymin = Math.min(-50, ...vals, E) * 1.15;
        const pl = VIZ.plano(l1, { xmin: 0, xmax: 3, ymin, ymax }, { etiquetaY: 'VPN (miles de dólares)', ticksX: [], margen: { izq: 52, inf: 34 } });
        pl.ejes();
        ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke();
        zonas = [];
        esc.forEach((e, i) => {
          const x = pl.sx(i + 0.15), w = pl.sx(i + 0.85) - x, y = pl.sy(Math.max(0, e.v)), h = Math.abs(pl.sy(e.v) - pl.sy(0));
          ctx.globalAlpha = hoverE === i ? 0.75 : 1; ctx.fillStyle = e.c;
          ctx.beginPath(); ctx.roundRect(x, y, w, Math.max(1, h), e.v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = e.v >= 0 ? 'bottom' : 'top';
          ctx.fillText(VIZ.fmt(e.v, 4), x + w / 2, e.v >= 0 ? y - 3 : y + h + 3);
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'top';
          ctx.fillText(`${e.n} (${Math.round(e.p * 100)} %)`, x + w / 2, pl.y0 + 8);
          zonas.push([x, x + w]);
        });
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(E)); ctx.lineTo(pl.x1, pl.sy(E)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(`esperado ${VIZ.fmt(E, 4)}`, pl.x1 - 2, pl.sy(E) - 3);
      }
      // Histograma.
      {
        const { ctx } = l2;
        l2.limpiar();
        const lo = Math.min(...sim), hi = Math.max(...sim), nb = 26, w = (hi - lo) / nb || 1;
        bins = Array.from({ length: nb }, (_, i) => ({ a: lo + i * w, b: lo + (i + 1) * w, n: 0 }));
        for (const v of sim) bins[Math.min(nb - 1, Math.floor((v - lo) / w))].n++;
        const nmax = Math.max(...bins.map((b) => b.n));
        planoH = VIZ.plano(l2, { xmin: lo, xmax: hi, ymin: 0, ymax: nmax * 1.12 }, { etiquetaX: 'VPN (miles de dólares)', etiquetaY: 'proyectos', margen: { izq: 52 }, formatoY: (v) => String(Math.round(v)) });
        planoH.ejes();
        bins.forEach((b, i) => {
          const x = planoH.sx(b.a) + 1, ww = planoH.sx(b.b) - planoH.sx(b.a) - 2, y = planoH.sy(b.n);
          ctx.fillStyle = (b.a + b.b) / 2 < 0 ? C.s8 : C.s6; ctx.globalAlpha = hoverB === i ? 0.7 : 1;
          ctx.beginPath(); ctx.roundRect(x, y, ww, planoH.y0 - y, [4, 4, 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
        });
        const m = sim.reduce((s, v) => s + v, 0) / sim.length;
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
        for (const v of [m]) { ctx.beginPath(); ctx.moveTo(planoH.sx(v), planoH.y1); ctx.lineTo(planoH.sx(v), planoH.y0); ctx.stroke(); }
        ctx.setLineDash([]); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.2;
        if (lo < 0 && hi > 0) { ctx.beginPath(); ctx.moveTo(planoH.sx(0), planoH.y1); ctx.lineTo(planoH.sx(0), planoH.y0); ctx.stroke(); }
      }
      const pNeg = sim.filter((v) => v < 0).length / sim.length, m = sim.reduce((s, v) => s + v, 0) / sim.length;
      const ord = sim.slice().sort((a, b) => a - b);
      registro.textContent = `VPN esperado de los escenarios = ${esc.map((e) => `${Math.round(e.p * 100)} % × ${VIZ.fmt(e.v, 4)}`).join(' + ')} = ${mil(E)}. En la simulación, ${pct(pNeg)} de los proyectos tiene VPN negativo.`;
      lectura.set([
        ['VPN pesimista / base / optimista', esc.map((e) => VIZ.fmt(e.v, 3)).join(' / ')],
        ['VPN esperado', mil(E)],
        ['media simulada', mil(m)],
        ['VPN en el peor 10 %', mil(ord[Math.floor(0.1 * ord.length)])],
        ['probabilidad de VPN < 0', pct(pNeg)],
      ]);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      const i = zonas.findIndex(([a, b]) => x >= a && x <= b);
      if (i !== hoverE) { hoverE = i; dibujar(); }
      if (i < 0) return tip1.ocultar();
      const e = esc[i];
      tip1.mostrar(x, y, `<b>${e.n}</b>: ${e.txt}<br>VPN <b>${mil(e.v)}</b><br>probabilidad <b>${Math.round(e.p * 100)} %</b>`);
    });
    l1.canvas.addEventListener('pointerleave', () => { hoverE = -1; tip1.ocultar(); dibujar(); });
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!planoH || !planoH.dentro(x, y)) { if (hoverB >= 0) { hoverB = -1; dibujar(); } return tip2.ocultar(); }
      const v = planoH.ix(x), i = bins.findIndex((b) => v >= b.a && v < b.b);
      if (i !== hoverB) { hoverB = i; dibujar(); }
      if (i < 0) return tip2.ocultar();
      tip2.mostrar(x, y, `VPN entre <b>${VIZ.fmt(bins[i].a, 3)}</b> y <b>${VIZ.fmt(bins[i].b, 3)}</b><br><b>${bins[i].n}</b> de ${sim.length} proyectos`);
    });
    l2.canvas.addEventListener('pointerleave', () => { hoverB = -1; tip2.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('business-case', {
    intro: String.raw`
      <p>El <strong>caso de negocio</strong> es el documento que justifica un proyecto antes de gastar en él: qué problema o
      oportunidad atiende, cuánto cuesta, qué beneficios traerá, cuándo, y qué puede salir mal. Con él, el comité decide si el proyecto merece
      recursos frente a otras alternativas, incluida la de no hacer nada.</p>
      <p>Los costos son más fáciles de estimar que los beneficios. Por eso conviene separar los beneficios <em>tangibles</em> (ahorros e ingresos que se miden en dinero) de los
      <em>intangibles</em> (satisfacción, reputación, capacidad de aprender) y, sobre todo, probar qué tan sensible es la decisión a los supuestos con escenarios.</p>`,
    visualizaciones: [
      {
        titulo: 'Flujo de costos y beneficios',
        descripcion: 'Mueva la inversión, el beneficio y la tasa, y observe cuándo la línea acumulada cruza el cero. Active los intangibles y baje la adopción del primer año: ¿cambia el signo del VPN?',
        montar: montarFlujos,
      },
      {
        titulo: 'Elegir entre dos proyectos',
        descripcion: 'Haga clic en el gráfico para cambiar la tasa de descuento. A la izquierda de la tasa de cruce gana A por VPN; a la derecha, B. Compruebe que la TIR siempre favorece a B.',
        montar: montarComparar,
      },
      {
        titulo: 'Escenarios y riesgo del caso',
        descripcion: 'Aumente la probabilidad del escenario pesimista o el retraso de los beneficios: el VPN esperado cae y aparecen proyectos con VPN negativo. Pruebe una caída de beneficios del 60 %.',
        montar: montarEscenarios,
      },
    ],
    teoria: String.raw`
      <h2>Contenido de un caso de negocio</h2>
      <table>
        <tr><th>Elemento</th><th>Pregunta</th><th>Ejemplo (portal de autoservicio)</th></tr>
        <tr><td>Problema u oportunidad</td><td>¿Por qué ahora?</td><td>el 60 % de las llamadas son consultas de saldo</td></tr>
        <tr><td>Alternativas</td><td>¿Qué otras opciones hay?</td><td>no hacer nada, ampliar el call center, construir el portal</td></tr>
        <tr><td>Costos</td><td>¿Cuánto cuesta construir y mantener?</td><td>desarrollo, licencias, soporte anual</td></tr>
        <tr><td>Beneficios tangibles</td><td>¿Qué dinero se ahorra o se gana?</td><td>menos horas de atención, menos errores</td></tr>
        <tr><td>Beneficios intangibles</td><td>¿Qué mejora sin precio de mercado?</td><td>satisfacción, imagen</td></tr>
        <tr><td>Riesgos y supuestos</td><td>¿Qué puede cambiar el resultado?</td><td>baja adopción, sobrecostos, retrasos</td></tr>
      </table>
      <h2>Criterios financieros</h2>
      <p>Con una inversión \(F_0\) en el año 0 y flujos netos \(F_t\) (beneficios menos costos de operación) en los años \(t = 1,\dots,n\), a una tasa de descuento \(r\):</p>
      \[ \mathrm{VPN} = \sum_{t=0}^{n} \frac{F_t}{(1+r)^t}, \qquad \sum_{t=0}^{n} \frac{F_t}{(1+\mathrm{TIR})^t} = 0, \qquad \text{retorno simple} = \frac{\sum_{t \ge 1} F_t - I}{I}. \]
      <p>El <em>plazo de recuperación</em> es el año (fraccional) en que el flujo acumulado se vuelve no negativo; ignora todo lo que ocurre después y el valor del dinero en el tiempo.
      Un proyecto se justifica si \(\mathrm{VPN} > 0\), equivalentemente, si \(\mathrm{TIR} > r\).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Inversión de 400, operación de 60 al año, beneficio tangible de 220 (el primer año, 60 % de adopción) y \(r = 10\,\%\).
      Flujos: \(-400,\; 132 - 60 = 72,\; 160,\; 160,\; 160,\; 160\). Entonces
      \(\mathrm{VPN} = -400 + \tfrac{72}{1{,}1} + \tfrac{160}{1{,}1^2} + \tfrac{160}{1{,}1^3} + \tfrac{160}{1{,}1^4} + \tfrac{160}{1{,}1^5} \approx 126{,}5\).
      El flujo acumulado sin descontar pasa a positivo en el año \(3 + 8/160 \approx 3{,}05\).</p></div>
      <h2>Comparar alternativas</h2>
      <p>Cuando se excluyen mutuamente, se elige el mayor VPN a la tasa de la empresa. La TIR puede contradecirlo: la alternativa de mayor TIR no siempre crea más valor, porque la TIR mide
      rentabilidad por dólar invertido y no ignora el tamaño. La <em>tasa de cruce</em> es la TIR de los flujos diferenciales \(F^{A}_t - F^{B}_t\): donde los VPN se igualan.</p>
      <h2>Escenarios y simulación</h2>
      <p>Un único VPN esconde la incertidumbre. Se calcula el VPN en escenarios (optimista, base, pesimista) y se pondera por sus probabilidades:</p>
      \[ \mathbb{E}[\mathrm{VPN}] = \sum_{s} p_s\, \mathrm{VPN}_s. \]
      <p>La simulación va más lejos: sortea muchas veces los beneficios y costos dentro de rangos (aquí, distribuciones triangulares) y muestra la probabilidad de que el VPN sea negativo.
      Un caso con VPN esperado positivo pero alta probabilidad de pérdida puede requerir un piloto o una entrega por etapas.</p>
      <h2>Conexiones</h2>
      <p>El caso de negocio se actualiza en cada puerta del <a href="tema.html?id=project-lifecycle">ciclo de vida</a>; su análisis de inversión se profundiza en
      <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>; los riesgos que alimentan los escenarios se registran en
      <a href="tema.html?id=project-risks-stakeholders">riesgos e interesados</a>; el beneficio esperado se resume en un
      <a href="tema.html?id=pm-canvas">PM Canvas</a> y su cumplimiento se mide después con
      <a href="tema.html?id=project-impact-measurement">medición del impacto del proyecto</a>.</p>`,
  });
})();
