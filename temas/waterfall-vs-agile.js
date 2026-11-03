(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Modelo común. Un proyecto de 16 funcionalidades, cada una con esfuerzo e (puntos) y valor v.
     Todo el ciclo de vida de una funcionalidad (requisitos, diseño, construcción, pruebas) cuesta e puntos;
     el equipo produce Q puntos por semana. Algunas funcionalidades cambian de requisito en un momento del plan. */
  const Q = 2;
  const N = 16;
  const FASES = [['Requisitos', 0.15], ['Diseño', 0.15], ['Construcción', 0.40], ['Pruebas', 0.20], ['Despliegue', 0.10]];
  // Esfuerzo extra de incorporar un cambio, como fracción del esfuerzo de la funcionalidad, según la fase en que llega (pendiente 1).
  const BASE = [0.05, 0.1, 0.3, 0.6, 1];
  const AJUSTE_ANTES = 0.2; // ágil: cambio de algo aún no construido (solo se re-estima)
  const AJUSTE_DESPUES = 0.5; // ágil: cambio de algo ya entregado (retrabajo)

  function proyecto(semilla, c) {
    const rnd = VIZ.semilla(semilla);
    const f = Array.from({ length: N }, (_, j) => ({ j, e: 2 + Math.floor(rnd() * 7), v: 5 + Math.floor(rnd() * 46), u: rnd(), tp: rnd() * 0.97 }));
    f.forEach((x) => { x.cambia = x.u < c; });
    const E = f.reduce((s, x) => s + x.e, 0), V = f.reduce((s, x) => s + x.v, 0);
    return { f, E, V, Tw0: E / Q };
  }

  // Cascada: fases secuenciales; cada cambio alarga la fase en que llega.
  function cascada(p, k) {
    const extra = FASES.map(() => 0), cam = [];
    p.f.forEach((x) => {
      if (!x.cambia) return;
      let acc = 0, i = 0;
      while (i < 4 && x.tp >= acc + FASES[i][1]) { acc += FASES[i][1]; i++; }
      extra[i] += x.e * BASE[i] * k;
      cam.push({ j: x.j, fase: i, fr: (x.tp - acc) / FASES[i][1] });
    });
    let t = 0;
    const fases = FASES.map(([n, fr], i) => {
      const d = p.Tw0 * fr + extra[i] / Q, o = { n, ini: t, fin: t + d, extra: extra[i] };
      t += d;
      return o;
    });
    cam.forEach((c) => { c.t = fases[c.fase].ini + c.fr * (fases[c.fase].fin - fases[c.fase].ini); });
    return { fases, fin: t, extra: extra.reduce((s, v) => s + v, 0), cam, pasos: [[t, p.V]] };
  }

  // Ágil: iteraciones de L semanas; se construye primero lo de mayor valor por punto de esfuerzo.
  function agil(p, L, sobrecarga, todoONada) {
    const cap = Q * L * (1 - sobrecarga);
    const cam = p.f.filter((x) => x.cambia).map((x) => ({ j: x.j, t: x.tp * p.Tw0 })).sort((a, b) => a.t - b.t);
    let cola = p.f.map((x) => ({ j: x.j, rest: x.e, v: x.v })).sort((a, b) => b.v / b.rest - a.v / a.rest);
    const entregas = [], iters = [];
    let ci = 0, extra = 0;
    for (let it = 0; it < 120; it++) {
      const t0 = it * L;
      while (ci < cam.length && cam[ci].t <= t0) {
        const c = cam[ci++], e = p.f[c.j].e, q = cola.find((x) => x.j === c.j && !x.re);
        if (q) { q.rest += AJUSTE_ANTES * e; extra += AJUSTE_ANTES * e; } else { cola.push({ j: c.j, rest: AJUSTE_DESPUES * e, v: 0, re: true }); extra += AJUSTE_DESPUES * e; }
      }
      let libre = cap;
      const listos = [];
      for (const x of cola) {
        if (libre <= 1e-9) break;
        const w = Math.min(libre, x.rest);
        x.rest -= w; libre -= w;
        if (x.rest <= 1e-9) listos.push(x);
      }
      cola = cola.filter((x) => !listos.includes(x));
      listos.forEach((x) => entregas.push({ j: x.j, t: t0 + L, v: x.v, re: !!x.re }));
      iters.push({ ini: t0, fin: t0 + L, usado: cap - libre, n: listos.length });
      if (!cola.length && ci >= cam.length) break;
    }
    const fin = Math.max(...entregas.map((x) => x.t));
    let acc = 0;
    const pasos = todoONada ? [[fin, p.V]] : entregas.filter((x) => x.v > 0).sort((a, b) => a.t - b.t).map((x) => { acc += x.v; return [x.t, acc]; });
    return { iters: iters.filter((i) => i.usado > 1e-9), fin, extra, cam, entregas, pasos };
  }

  const valorEn = (pasos, t) => { let v = 0; for (const [ti, vi] of pasos) if (ti <= t + 1e-9) v = vi; return v; };
  // Valor acumulado ("valor·semana") hasta el horizonte H: área bajo la curva de valor entregado.
  function areaValor(pasos, H) {
    let a = 0, prev = 0, v = 0;
    for (const [t, vi] of pasos) { if (t >= H) break; a += v * (t - prev); prev = t; v = vi; }
    return a + v * Math.max(0, H - prev);
  }
  const sem = (v) => `${VIZ.fmt(v, 3)} sem`;

  /* ---------- Fig. 1: dos calendarios ---------- */

  function montarCalendarios(cuerpo) {
    let semilla = 3, c = 0.3, L = 3, ovh = 0.1, todo = false, semana = 0, p, cw, ag, Tmax;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Requisitos que cambian', min: 0, max: 0.8, paso: 0.05, valor: c, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { c = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Longitud de la iteración', min: 1, max: 6, valor: L, formato: (v) => `${v} sem`, alCambiar: (v) => { L = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Solo sirve completo (todo o nada)', valor: todo, alCambiar: (v) => { todo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevo proyecto', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'Cascada: fases y valor entregado' },
      { color: C.s2, texto: 'Ágil: iteraciones y valor entregado' },
      { color: C.s8, texto: 'cambio de requisito', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Reproducir» para avanzar semana a semana, o haga clic en el gráfico para saltar a una semana. Pase el cursor para ver el valor entregado por cada enfoque.');

    function preparar() {
      p = proyecto(semilla, c);
      cw = cascada(p, 2);
      ag = agil(p, L, ovh, todo);
      Tmax = Math.ceil(Math.max(cw.fin, ag.fin) + 1);
    }
    function* pasosSemanas() { while (semana < Tmax) { semana++; yield; } }
    function iniciar() {
      preparar(); semana = 0;
      return pasosSemanas();
    }
    // Eje de tiempo y geometría compartidos con el tooltip.
    let g = null;
    function dibujar() {
      if (!p) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const x0 = 62, x1 = W - 12, sx = (t) => x0 + (t / Tmax) * (x1 - x0);
      const yC = 12, hL = 24, yA = 46, yV0 = 96, yV1 = H - 30;
      const ymax = p.V * 1.08, sy = (v) => yV1 - (v / ymax) * (yV1 - yV0);
      g = { x0, x1, Tmax, sx };
      ctx.font = VIZ.fuente(10);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = C.tinta2; ctx.fillText('Cascada', 4, yC + hL / 2); ctx.fillText('Ágil', 4, yA + hL / 2); ctx.fillText('Valor', 4, yV0 + 6);
      // Fases de la cascada
      cw.fases.forEach((f) => {
        const xa = sx(f.ini), xb = sx(f.fin), w = xb - xa;
        ctx.fillStyle = C.superficie; ctx.fillRect(xa, yC, w, hL);
        ctx.fillStyle = VIZ.alfa(C.s1, 0.14); ctx.fillRect(xa, yC, w, hL);
        const pr = Math.max(0, Math.min(1, (semana - f.ini) / (f.fin - f.ini)));
        ctx.fillStyle = VIZ.alfa(C.s1, 0.85); ctx.fillRect(xa, yC, w * pr, hL);
        ctx.strokeStyle = C.s1; ctx.lineWidth = 1; ctx.strokeRect(xa + 0.5, yC + 0.5, w - 1, hL - 1);
        const nombre = ctx.measureText(f.n).width + 6 < w ? f.n : ctx.measureText(f.n.slice(0, 3)).width + 4 < w ? f.n.slice(0, 3) : '';
        ctx.fillStyle = pr > 0.5 ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.fillText(nombre, xa + w / 2, yC + hL / 2); ctx.textAlign = 'left';
      });
      // Iteraciones del ágil
      ag.iters.forEach((it) => {
        const xa = sx(it.ini), xb = sx(it.fin), w = xb - xa;
        ctx.fillStyle = VIZ.alfa(C.s2, 0.14); ctx.fillRect(xa + 1, yA, w - 2, hL);
        const pr = Math.max(0, Math.min(1, (semana - it.ini) / (it.fin - it.ini)));
        ctx.fillStyle = VIZ.alfa(C.s2, 0.85); ctx.fillRect(xa + 1, yA, (w - 2) * pr, hL);
        ctx.strokeStyle = C.s2; ctx.lineWidth = 1; ctx.strokeRect(xa + 1.5, yA + 0.5, w - 3, hL - 1);
        if (w > 16 && it.n) { ctx.fillStyle = pr >= 1 ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.fillText(String(it.n), xa + w / 2, yA + hL / 2); ctx.textAlign = 'left'; }
      });
      // Cambios de requisito (mismo proyecto en ambos calendarios)
      cw.cam.forEach((m) => { if (m.t <= semana) VIZ.marcador(ctx, sx(m.t), yC - 2, C.s8, 3.5, 3); });
      ag.cam.forEach((m) => { if (m.t <= semana) VIZ.marcador(ctx, sx(m.t), yA - 2, C.s8, 3.5, 3); });
      // Gráfico de valor
      ctx.strokeStyle = C.rejilla; ctx.fillStyle = C.apagado; ctx.lineWidth = 1; ctx.textAlign = 'right';
      VIZ.ticks(0, ymax, 3).forEach((v) => { const y = Math.round(sy(v)) + 0.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillText(VIZ.entero(v), x0 - 6, y); });
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      VIZ.ticks(0, Tmax, Math.max(2, Math.floor((x1 - x0) / 60))).forEach((t) => { ctx.fillText(String(t), sx(t), yV1 + 6); });
      ctx.textAlign = 'right'; ctx.fillText('semana', x1, H - 12);
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, yV1 + 0.5); ctx.lineTo(x1, yV1 + 0.5); ctx.stroke();
      const trazo = (pasos, color, hasta, ancho, alfa) => {
        ctx.strokeStyle = alfa ? VIZ.alfa(color, alfa) : color; ctx.lineWidth = ancho; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(sx(0), sy(0));
        let v = 0;
        for (const [t, vi] of pasos) { if (t > hasta) break; ctx.lineTo(sx(t), sy(v)); ctx.lineTo(sx(t), sy(vi)); v = vi; }
        ctx.lineTo(sx(hasta), sy(v)); ctx.stroke();
      };
      trazo(cw.pasos, C.s1, Tmax, 2, 0.3); trazo(ag.pasos, C.s2, Tmax, 2, 0.3);
      trazo(cw.pasos, C.s1, semana, 2.5); trazo(ag.pasos, C.s2, semana, 2.5);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(sx(semana), yC - 6); ctx.lineTo(sx(semana), yV1); ctx.stroke(); ctx.setLineDash([]);
      const vc = valorEn(cw.pasos, semana), va = valorEn(ag.pasos, semana);
      const H1 = 2 * p.Tw0;
      const nCam = p.f.filter((x) => x.cambia).length;
      registro.textContent = semana === 0
        ? `Proyecto de ${N} funcionalidades (${p.E} puntos, valor total ${VIZ.entero(p.V)}); ${nCam} cambian de requisito. Plan de cascada: ${sem(p.Tw0)}.`
        : `Semana ${semana}: la cascada va en «${(cw.fases.find((f) => semana <= f.fin) || cw.fases[4]).n}» y ha entregado ${VIZ.entero(vc)}; el ágil lleva ${ag.iters.filter((i) => i.fin <= semana).reduce((s, i) => s + i.n, 0)} entregas y ${VIZ.entero(va)} de valor.`;
      lectura.set([
        ['fin de la cascada', `${sem(cw.fin)} (plan ${sem(p.Tw0)})`],
        ['fin del ágil', sem(ag.fin)],
        ['valor primera entrega', ag.entregas.some((x) => x.v > 0) && !todo ? `ágil: semana ${Math.min(...ag.entregas.filter((x) => x.v > 0).map((x) => x.t))}` : `ágil: semana ${VIZ.fmt(ag.fin, 3)}`],
        ['esfuerzo por cambios', `cascada ${VIZ.fmt(cw.extra, 3)} pts · ágil ${VIZ.fmt(ag.extra, 3)} pts`],
        [`valor·semana hasta la semana ${Math.round(H1)}`, `cascada ${VIZ.entero(areaValor(cw.pasos, H1))} · ágil ${VIZ.entero(areaValor(ag.pasos, H1))}`],
      ]);
    }
    lienzo.alDibujar = () => p && dibujar();
    const semanaDe = (x) => Math.max(0, Math.min(Tmax, Math.round(((x - g.x0) / (g.x1 - g.x0)) * Tmax)));
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!g) return;
      const { x } = lienzo.posicion(ev);
      rep.detener();
      semana = semanaDe(x);
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!g) return;
      const { x, y } = lienzo.posicion(ev);
      if (x < g.x0 || x > g.x1) return tip.ocultar();
      const t = semanaDe(x);
      tip.mostrar(x, y, `semana <b>${t}</b>` + VIZ.filaTooltip(C.s1, 'Cascada', VIZ.entero(valorEn(cw.pasos, t))) + VIZ.filaTooltip(C.s2, 'Ágil', VIZ.entero(valorEn(ag.pasos, t))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: costo de cambiar un requisito ---------- */

  function montarCostoCambio(cuerpo) {
    let semilla = 3, k = 2, c = 0.3, t = 20, p, cw, ag0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Pendiente del costo de cambio (cascada)', min: 0.5, max: 4, paso: 0.5, valor: k, formato: (v) => `×${v}`, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Requisitos que cambian', min: 0.1, max: 0.8, paso: 0.05, valor: c, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { c = v; calcular(); } });
    ctl.boton('Nuevo proyecto', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'Cascada: depende de la fase', forma: 'linea' },
      { color: C.s2, texto: 'Ágil: depende de cuánto ya se entregó', forma: 'linea' },
      { color: C.tinta, texto: 'momento elegido', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic (o arrastre) sobre el gráfico para elegir en qué semana se descubre que los requisitos cambiaron; las líneas verticales finas separan las fases de la cascada.');

    // Esfuerzo medio de una funcionalidad y costo de incorporar su cambio en la semana s.
    const costoCascada = (s) => { const i = fase(s); return (p.E / N) * BASE[i] * k; };
    const fase = (s) => { let acc = 0; for (let i = 0; i < 5; i++) { acc += FASES[i][1] * p.Tw0; if (s < acc) return i; } return 4; };
    function fraccionEntregada(s) {
      let hecho = 0;
      ag0.entregas.forEach((x) => { if (x.t <= s) hecho += p.f[x.j].e; });
      return hecho / p.E;
    }
    const costoAgil = (s) => (p.E / N) * (AJUSTE_ANTES * (1 - fraccionEntregada(s)) + AJUSTE_DESPUES * fraccionEntregada(s));
    function calcular() {
      p = proyecto(semilla, 0);
      ag0 = agil(p, 3, 0.1, false);
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(costoCascada(p.Tw0 * 0.99), costoAgil(p.Tw0)) * 1.15 || 1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: p.Tw0, ymin: 0, ymax }, { etiquetaX: 'semana en que se detecta el cambio', etiquetaY: 'esfuerzo para incorporarlo (puntos)', formatoY: (v) => VIZ.fmt(v, 2) });
      pl.ejes();
      let acc = 0;
      FASES.forEach(([n, fr], i) => {
        const a = acc * p.Tw0, b = (acc + fr) * p.Tw0;
        acc += fr;
        ctx.fillStyle = i % 2 ? VIZ.alfa(C.eje, 0.18) : 'transparent';
        ctx.fillRect(pl.sx(a), pl.y1, pl.sx(b) - pl.sx(a), pl.y0 - pl.y1);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const w = pl.sx(b) - pl.sx(a);
        ctx.fillText(ctx.measureText(n).width + 4 < w ? n : n.slice(0, 3), (pl.sx(a) + pl.sx(b)) / 2, pl.y1 + 3);
      });
      const pts = [];
      for (let s = 0; s <= p.Tw0; s += p.Tw0 / 160) pts.push([s, s >= p.Tw0 ? NaN : costoCascada(s)]);
      VIZ.trazar(ctx, pl, pts, C.s1, 2.5);
      VIZ.trazar(ctx, pl, Array.from({ length: 161 }, (_, i) => [i * p.Tw0 / 160, costoAgil(i * p.Tw0 / 160)]), C.s2, 2.5);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(t), pl.y1); ctx.lineTo(pl.sx(t), pl.y0); ctx.stroke();
      VIZ.marcador(ctx, pl.sx(t), pl.sy(costoCascada(t)), C.s1, 4.5);
      VIZ.marcador(ctx, pl.sx(t), pl.sy(costoAgil(t)), C.s2, 4.5);
      const nCam = Math.round(c * N), cw1 = costoCascada(t), ca1 = costoAgil(t);
      registro.textContent = `Semana ${VIZ.fmt(t, 3)}: la cascada está en «${FASES[fase(t)][0]}» y el ágil lleva ${Math.round(fraccionEntregada(t) * 100)} % del esfuerzo entregado. Un cambio cuesta ${VIZ.fmt(cw1, 3)} puntos en cascada y ${VIZ.fmt(ca1, 3)} en ágil.`;
      lectura.set([
        ['costo por cambio · cascada', `${VIZ.fmt(cw1, 3)} pts`],
        ['costo por cambio · ágil', `${VIZ.fmt(ca1, 3)} pts`],
        ['razón cascada / ágil', ca1 > 0 ? `×${VIZ.fmt(cw1 / ca1, 3)}` : '—'],
        [`${nCam} cambios descubiertos esa semana`, `cascada ${VIZ.fmt(nCam * cw1, 3)} · ágil ${VIZ.fmt(nCam * ca1, 3)} pts`],
        ['semanas de retraso equivalentes', `cascada ${VIZ.fmt(nCam * cw1 / Q, 3)} · ágil ${VIZ.fmt(nCam * ca1 / Q, 3)}`],
      ]);
    }
    lienzo.alDibujar = () => p && dibujar();
    let arrastrando = false;
    const fijar = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      if (pl.dentro(x, y) || arrastrando) { t = Math.max(0, Math.min(p.Tw0 * 0.999, pl.ix(Math.max(pl.x0, Math.min(pl.x1, x))))); dibujar(); }
      if (pl.dentro(x, y)) {
        const s = Math.max(0, Math.min(p.Tw0 * 0.999, pl.ix(x)));
        tip.mostrar(x, y, `semana <b>${VIZ.fmt(s, 3)}</b>` + VIZ.filaTooltip(C.s1, `Cascada (${FASES[fase(s)][0]})`, VIZ.fmt(costoCascada(s), 3) + ' pts') + VIZ.filaTooltip(C.s2, 'Ágil', VIZ.fmt(costoAgil(s), 3) + ' pts'));
      } else tip.ocultar();
    };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arrastrando = true; lienzo.canvas.setPointerCapture(ev.pointerId); fijar(ev); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { if (arrastrando) fijar(ev); else { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) return tip.ocultar(); fijar({ clientX: ev.clientX, clientY: ev.clientY }); } });
    lienzo.canvas.addEventListener('pointerup', () => { arrastrando = false; });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 3: ¿cuál entrega más valor? ---------- */

  function montarBarrido(cuerpo) {
    let k = 2, L = 3, ovh = 0.1, todo = false, horiz = 2, cSel = 0.3, curva = [], pl = null;
    const REP = 24;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Sobrecarga del ágil', min: 0, max: 0.4, paso: 0.05, valor: ovh, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ovh = v; calcular(); } });
    ctl.rango({ etiqueta: 'Pendiente del costo de cambio (cascada)', min: 0.5, max: 4, paso: 0.5, valor: k, formato: (v) => `×${v}`, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Iteración', min: 1, max: 6, valor: L, formato: (v) => `${v} sem`, alCambiar: (v) => { L = v; calcular(); } });
    ctl.casilla({ etiqueta: 'Solo sirve completo (todo o nada)', valor: todo, alCambiar: (v) => { todo = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'Cascada', forma: 'linea' },
      { color: C.s2, texto: 'Ágil', forma: 'linea' },
      { color: C.tinta, texto: 'cambio elegido', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Cada punto promedia ${REP} proyectos simulados distintos. Haga clic en el gráfico para elegir el nivel de cambio y vea qué enfoque acumula más valor·semana hasta ${horiz} veces el plazo planificado.`);

    function calcular() {
      curva = [];
      for (let ci = 0; ci <= 16; ci++) {
        const c = ci * 0.05;
        let sw = 0, sa = 0;
        for (let s = 1; s <= REP; s++) {
          const p = proyecto(100 + s, c), H = horiz * p.Tw0;
          sw += areaValor(cascada(p, k).pasos, H); sa += areaValor(agil(p, L, ovh, todo).pasos, H);
        }
        curva.push({ c, w: sw / REP, a: sa / REP });
      }
      dibujar();
    }
    function cruce() {
      for (let i = 1; i < curva.length; i++) {
        const d0 = curva[i - 1].w - curva[i - 1].a, d1 = curva[i].w - curva[i].a;
        if (d0 > 0 && d1 <= 0) return curva[i - 1].c + (0.05 * d0) / (d0 - d1);
      }
      return curva[0].w <= curva[0].a ? 0 : null;
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...curva.map((q) => Math.max(q.w, q.a))) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 0.8, ymin: 0, ymax }, { etiquetaX: 'requisitos que cambian', etiquetaY: 'valor·semana acumulado', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      const x = cruce();
      if (x != null && x > 0) {
        ctx.fillStyle = VIZ.alfa(C.s2, 0.09); ctx.fillRect(pl.sx(x), pl.y1, pl.x1 - pl.sx(x), pl.y0 - pl.y1);
        ctx.fillStyle = VIZ.alfa(C.s1, 0.09); ctx.fillRect(pl.x0, pl.y1, pl.sx(x) - pl.x0, pl.y0 - pl.y1);
      } else if (x === 0) { ctx.fillStyle = VIZ.alfa(C.s2, 0.09); ctx.fillRect(pl.x0, pl.y1, pl.x1 - pl.x0, pl.y0 - pl.y1); } else { ctx.fillStyle = VIZ.alfa(C.s1, 0.09); ctx.fillRect(pl.x0, pl.y1, pl.x1 - pl.x0, pl.y0 - pl.y1); }
      VIZ.trazar(ctx, pl, curva.map((q) => [q.c, q.w]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, curva.map((q) => [q.c, q.a]), C.s2, 2.5);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.sx(cSel), pl.y1); ctx.lineTo(pl.sx(cSel), pl.y0); ctx.stroke();
      const q = interp(cSel);
      VIZ.marcador(ctx, pl.sx(cSel), pl.sy(q.w), C.s1); VIZ.marcador(ctx, pl.sx(cSel), pl.sy(q.a), C.s2);
      if (x != null && x > 0) {
        ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(pl.sx(x), pl.y1); ctx.lineTo(pl.sx(x), pl.y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'top'; ctx.textAlign = x > 0.5 ? 'right' : 'left';
        ctx.fillText(`cruce ≈ ${Math.round(x * 100)} %`, pl.sx(x) + (x > 0.5 ? -5 : 5), pl.y1 + 3);
      }
      const mejor = q.w >= q.a ? 'la cascada' : 'el ágil';
      registro.textContent = `Con ${Math.round(cSel * 100)} % de requisitos cambiantes, ${mejor} acumula más valor (${VIZ.entero(Math.max(q.w, q.a))} contra ${VIZ.entero(Math.min(q.w, q.a))}).`
        + (x != null && x > 0 ? ` A partir de ≈ ${Math.round(x * 100)} % el ágil supera a la cascada.` : x === 0 ? ' En todo el rango gana el ágil.' : ' En todo el rango gana la cascada.');
      lectura.set([
        ['cambio elegido', `${Math.round(cSel * 100)} %`],
        ['valor·semana cascada', VIZ.entero(q.w)],
        ['valor·semana ágil', VIZ.entero(q.a)],
        ['diferencia ágil − cascada', VIZ.entero(q.a - q.w)],
        ['punto de cruce', x == null ? 'ninguno' : x === 0 ? 'bajo 0 %' : `≈ ${Math.round(x * 100)} %`],
      ]);
    }
    function interp(c) {
      const i = Math.min(curva.length - 2, Math.floor(c / 0.05 + 1e-9)), f = (c - curva[i].c) / 0.05;
      return { w: curva[i].w + f * (curva[i + 1].w - curva[i].w), a: curva[i].a + f * (curva[i + 1].a - curva[i].a) };
    }
    lienzo.alDibujar = () => curva.length && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      cSel = Math.round(pl.ix(x) / 0.05) * 0.05; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const c = Math.max(0, Math.min(0.8, pl.ix(x))), q = interp(c);
      tip.mostrar(x, y, `cambios <b>${Math.round(c * 100)} %</b>` + VIZ.filaTooltip(C.s1, 'Cascada', VIZ.entero(q.w)) + VIZ.filaTooltip(C.s2, 'Ágil', VIZ.entero(q.a)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('waterfall-vs-agile', {
    intro: String.raw`
      <p>En el modelo en <strong>cascada</strong> (<em>waterfall</em>) un proyecto de software avanza por fases que no se solapan: requisitos, diseño, construcción, pruebas y despliegue.
      Todo el valor llega al final, y por eso exige conocer bien lo que se necesita desde el primer día. Los métodos <strong>ágiles</strong> trocean el trabajo en iteraciones cortas:
      cada una produce un incremento utilizable, de modo que el negocio recibe valor pronto y puede corregir el rumbo.</p>
      <p>Ninguno es «mejor» en general. Cuando los requisitos son estables, el sistema solo sirve completo y el equipo conoce el problema, la cascada es eficiente. Cuando las necesidades se descubren
      sobre la marcha, cada cambio que llega tarde a una cascada es caro, mientras que en un proceso iterativo su costo es casi constante. Las figuras simulan el mismo proyecto con ambos enfoques.</p>`,
    visualizaciones: [
      {
        titulo: 'Dos calendarios para el mismo proyecto',
        descripcion: 'Reproduzca el proyecto semana a semana: la cascada entrega todo al final y el ágil va entregando; los rombos rojos son cambios de requisito. Suba el porcentaje de cambios y vea cómo se alarga la cascada; marque «todo o nada» y vea cuándo el ágil deja de ganar.',
        montar: montarCalendarios,
      },
      {
        titulo: 'Costo de cambiar un requisito',
        descripcion: 'Arrastre sobre el gráfico para elegir la semana en que se descubre un cambio: en la cascada el costo escala con la fase; en el ágil casi no depende del momento. Aumente la pendiente para ver cómo se separan las curvas.',
        montar: montarCostoCambio,
      },
      {
        titulo: '¿Cuál entrega más valor?',
        descripcion: 'Cada punto promedia muchos proyectos con el mismo nivel de cambio. Busque el cruce de las curvas y vea cómo se desplaza al subir la sobrecarga del ágil, la pendiente del costo de cambio o al marcar «todo o nada».',
        montar: montarBarrido,
      },
    ],
    teoria: String.raw`
      <h2>Los dos enfoques</h2>
      <table>
        <tr><th></th><th>Cascada</th><th>Ágil</th></tr>
        <tr><td>Estructura</td><td>fases secuenciales con revisión al final de cada una</td><td>iteraciones cortas (1 a 4 semanas) que repiten análisis, construcción y pruebas</td></tr>
        <tr><td>Requisitos</td><td>se fijan al comienzo; los cambios pasan por control formal</td><td>se priorizan en cada iteración; el cambio es esperado</td></tr>
        <tr><td>Entrega de valor</td><td>una sola, al final</td><td>incremental, desde la primera iteración</td></tr>
        <tr><td>Riesgo principal</td><td>descubrir tarde que se construyó lo equivocado</td><td>deriva del alcance y sobrecarga de coordinación</td></tr>
        <tr><td>Encaja cuando</td><td>requisitos estables, contrato cerrado, regulación, sistema «todo o nada»</td><td>necesidades inciertas, usuarios disponibles, mercado cambiante</td></tr>
      </table>
      <h2>Modelo de las figuras</h2>
      <p>Cada funcionalidad \(i\) tiene esfuerzo total \(e_i\) y valor \(v_i\); el equipo produce \(Q\) puntos por semana. Sin cambios, la cascada dura \(T_0 = \tfrac{1}{Q}\sum_i e_i\).
      Un cambio que llega en la fase \(f\) agrega esfuerzo \(e_i\,\beta_f\,k\), con \(\beta = (0{,}05;\,0{,}1;\,0{,}3;\,0{,}6;\,1)\) para requisitos, diseño, construcción, pruebas y despliegue y \(k\) la pendiente elegida: es la
      <em>curva del costo de cambio</em> creciente que describió Boehm. En el ágil, cambiar algo aún no construido solo cuesta \(0{,}2\,e_i\) (re-estimar) y rehacer algo ya entregado, \(0{,}5\,e_i\).</p>
      <p>El ágil entrega primero lo de mayor \(v_i/e_i\) y gasta una fracción \(s\) de su capacidad en coordinación. Para comparar se usa el valor acumulado en el uso del sistema hasta un horizonte \(H\):</p>
      \[ \text{valor·semana}(H) = \int_0^{H} V(t)\,dt = \sum_i v_i\,\bigl(H - t_i\bigr)^{+}, \]
      <p>donde \(t_i\) es la semana en que se entrega \(i\) y \((x)^{+}=\max(x,0)\). En una cascada todas las entregas ocurren en el mismo \(t = T_0 + \Delta\), con \(\Delta\) el retraso por cambios.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Suponga 10 funcionalidades de 4 puntos cada una (\(E=40\)) y \(Q=2\): \(T_0 = 20\) semanas. Con 5 cambios descubiertos en la fase de pruebas y \(k=2\), cada uno cuesta \(4\cdot 0{,}6\cdot 2 = 4{,}8\) puntos:
      24 puntos, es decir 12 semanas de retraso, y la cascada termina en la semana 32. Con iteraciones de 2 semanas y 10 % de sobrecarga, el ágil produce \(2\cdot 2\cdot 0{,}9 = 3{,}6\) puntos por iteración y absorbe los mismos 5 cambios con, como máximo,
      \(5\cdot 0{,}5\cdot 4 = 10\) puntos: \(50/3{,}6 \approx 14\) iteraciones, cerca de la semana 28. Pero entrega valor desde la semana 4, mientras la cascada no entrega nada hasta la 32. Si el sistema solo sirve completo,
      en cambio, la diferencia de plazo (32 contra 28) es todo lo que cuenta y el ágil gana por poco; sin cambios, la cascada (semana 20) vencería al ágil (semana 24).</p>
      <div class="recuadro"><p><strong>Lectura práctica.</strong> El punto de cruce depende de tres cosas que se pueden estimar en un proyecto real: qué fracción de los requisitos cambiará, cuánto sube el costo de un
      cambio tardío y si el sistema entrega valor parcial. Si el sistema solo sirve completo y nada cambia, la sobrecarga del ágil es un costo sin beneficio.</p></div>
      <h2>Conexiones</h2>
      <p>La práctica ágil más difundida se estudia en <a href="tema.html?id=scrum">Scrum</a>; la entrega frecuente se apoya en <a href="tema.html?id=devops-ci-cd">DevOps y entrega continua</a>.
      El impacto de cada enfoque en el plazo se relaciona con <a href="tema.html?id=triple-constraint">alcance, tiempo, costo y calidad</a> y con la
      <a href="tema.html?id=project-lifecycle">planificación del ciclo de vida</a>; los cambios que llegan tarde se originan en la <a href="tema.html?id=requirements-management">gestión de requerimientos</a>.</p>`,
  });
})();
