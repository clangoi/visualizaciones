(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const S = VIZ.si;

  /* ---------- Modelo: solicitudes de crédito en cuatro etapas ---------- */

  const NOMBRES = ['Recepción', 'Evaluación', 'Aprobación', 'Desembolso'];
  const MEDIAS = [6, 20, 8, 5]; // minutos de servicio por solicitud y por recurso
  const BASE = [1, 2, 1, 1]; // recursos por etapa
  const muDe = (medias, s) => 60 / medias[s]; // solicitudes por hora que atiende un recurso
  const capacidad = (serv, medias) => Math.min(...serv.map((c, s) => c * muDe(medias, s)));
  const rhoDe = (lam, serv, medias) => serv.map((c, s) => lam / (c * muDe(medias, s)));

  // Tiempo de ciclo teórico (minutos) con colas M/M/c en serie.
  function cicloTeorico(lam, serv, medias) {
    const et = serv.map((c, s) => S.cola(lam, muDe(medias, s), c));
    const W = et.reduce((a, r) => a + r.W * 60, 0);
    return { et, W: Number.isFinite(W) ? W : Infinity };
  }
  const min = (v) => (Number.isFinite(v) ? P.dur(v) : 'sin límite');

  // Simulación de eventos discretos de colas FIFO en serie (llegadas de Poisson, servicios exponenciales).
  function simular(lam, serv, n, semilla, medias) {
    const rnd = VIZ.semilla(semilla), exp = (m) => -Math.log(1 - rnd()) * m;
    const libre = serv.map((c) => new Array(c).fill(0));
    let t = 0;
    const casos = [];
    for (let i = 0; i < n; i++) {
      t += exp(60 / lam);
      let llega = t;
      const et = [];
      for (let s = 0; s < serv.length; s++) {
        const f = libre[s];
        let j = 0;
        for (let q = 1; q < f.length; q++) if (f[q] < f[j]) j = q;
        const ini = Math.max(llega, f[j]), fin = ini + exp(medias[s]);
        f[j] = fin; et.push({ llega, ini, fin }); llega = fin;
      }
      casos.push({ id: 'S' + String(i + 1).padStart(3, '0'), t0: t, et, fin: llega });
    }
    return casos;
  }

  /* ---------- Fig. 1: simulación evento por evento ---------- */

  function montarSimulacion(cuerpo) {
    let lam = 5, semilla = 1;
    const serv = BASE.slice();
    const N = 100;
    let eventos = [], q = [], ocupados = [], acum = [], reloj = 0, hechos = 0, ciclos = [], mensaje = '', ant = 0;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Llegadas por hora', min: 1, max: 10, paso: 0.5, valor: lam, formato: (v) => `${v} / h`, alCambiar: (v) => { lam = v; rep.reiniciar(); } });
    NOMBRES.forEach((n, s) => ctl.rango({ etiqueta: `Recursos en ${n}`, min: 1, max: 4, valor: serv[s], alCambiar: (v) => { serv[s] = v; rep.reiniciar(); } }));
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 9 });
    ctl.boton('Nueva simulación', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 4 * 58 + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'recurso ocupado', forma: 'punto' }, { color: C.superficie, borde: C.tinta, texto: 'recurso libre', forma: 'punto' },
      { color: C.s4, texto: 'solicitud en cola' }, { color: C.s8, texto: 'cuello de botella (mayor utilización teórica)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso es un evento: llega una solicitud, un recurso empieza a atenderla o termina. Suba las llegadas o quite un recurso a la etapa marcada en rojo y vea crecer la cola; luego agregue uno y mire cómo se vacía. Pase el cursor sobre una etapa.');

    function iniciar() {
      const casos = simular(lam, serv, N, semilla * 101 + 7, MEDIAS);
      eventos = [];
      casos.forEach((c) => c.et.forEach((e, s) => {
        eventos.push({ t: e.llega, k: 0, s, c }); eventos.push({ t: e.ini, k: 2, s, c }); eventos.push({ t: e.fin, k: 1, s, c });
      }));
      eventos.sort((a, b) => a.t - b.t || a.k - b.k);
      q = NOMBRES.map(() => 0); ocupados = NOMBRES.map(() => 0); acum = NOMBRES.map(() => 0);
      reloj = 0; ant = 0; hechos = 0; ciclos = [];
      mensaje = 'Pulse «Reproducir» o «Un paso»: se procesará el primer evento.';
      return (function* () {
        for (const ev of eventos) {
          NOMBRES.forEach((_, s) => { acum[s] += ocupados[s] * (ev.t - ant); });
          ant = ev.t; reloj = ev.t;
          const et = NOMBRES[ev.s];
          if (ev.k === 0) { q[ev.s]++; mensaje = `${P.dur(ev.t)}: la solicitud ${ev.c.id} llega a ${et} (en cola: ${q[ev.s]}).`; }
          else if (ev.k === 2) { q[ev.s]--; ocupados[ev.s]++; mensaje = `${P.dur(ev.t)}: un recurso de ${et} empieza a atender la solicitud ${ev.c.id}, que esperó ${P.dur(ev.t - ev.c.et[ev.s].llega)}.`; }
          else { ocupados[ev.s]--; mensaje = `${P.dur(ev.t)}: ${et} termina la solicitud ${ev.c.id}.`; if (ev.s === NOMBRES.length - 1) { hechos++; ciclos.push(ev.t - ev.c.t0); mensaje += ` La solicitud sale del proceso tras ${P.dur(ev.t - ev.c.t0)}.`; } }
          yield;
        }
        mensaje = 'La simulación terminó: todas las solicitudes fueron atendidas.';
      })();
    }

    const rhoTeo = () => rhoDe(lam, serv, MEDIAS);
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const rt = rhoTeo(), cuello = rt.indexOf(Math.max(...rt));
      const cap = Math.max(4, Math.floor((W - 112 - 56) / 13));
      NOMBRES.forEach((n, s) => {
        const y0 = 4 + s * 58;
        ctx.fillStyle = s % 2 ? C.superficie : C.fondo2; ctx.fillRect(0, y0, W, 58);
        if (s === cuello) { ctx.fillStyle = C.s8; ctx.fillRect(0, y0, 4, 58); }
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${n} · ${serv[s]} rec. · ${MEDIAS[s]} min`, 10, y0 + 6);
        const obs = reloj > 0 ? acum[s] / (serv[s] * reloj) : 0;
        ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500);
        ctx.fillText(`ρ ${Math.round(obs * 100)} % (teórica ${Math.round(rt[s] * 100)} %)`, W - 8, y0 + 7);
        for (let j = 0; j < serv[s]; j++) {
          ctx.beginPath(); ctx.arc(20 + j * 20, y0 + 38, 8, 0, 2 * Math.PI);
          ctx.fillStyle = j < ocupados[s] ? C.s2 : C.superficie; ctx.fill();
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.stroke();
        }
        const x0 = 20 + 4 * 20 + 12;
        const nq = q[s], mostrar = Math.min(nq, cap);
        for (let j = 0; j < mostrar; j++) {
          ctx.fillStyle = C.s4; ctx.fillRect(x0 + j * 13, y0 + 32, 10, 12);
        }
        if (nq > cap) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`+${nq - cap}`, x0 + cap * 13 + 2, y0 + 38); }
        ctx.textBaseline = 'alphabetic';
      });
      registro.textContent = mensaje;
      const colas = q.slice(), mayor = colas.indexOf(Math.max(...colas));
      lectura.set([
        ['reloj de la simulación', P.dur(reloj)],
        ['solicitudes terminadas', `${hechos} de ${N}`],
        ['cola más larga ahora', Math.max(...colas) ? `${Math.max(...colas)} en ${NOMBRES[mayor]}` : 'ninguna'],
        ['tiempo de ciclo medio simulado', ciclos.length ? P.dur(P.media(ciclos)) : '—'],
        ['tiempo de ciclo teórico (M/M/c)', min(cicloTeorico(lam, serv, MEDIAS).W)],
        ['cuello de botella teórico', `${NOMBRES[cuello]} (ρ = ${VIZ.fmt(rt[cuello] * 100, 3)} %)`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const s = Math.floor((y - 4) / 58);
      if (s < 0 || s >= NOMBRES.length) return tip.ocultar();
      const r = S.cola(lam, muDe(MEDIAS, s), serv[s]);
      tip.mostrar(x, y, `<b>${NOMBRES[s]}</b><br>${serv[s]} recursos, ${MEDIAS[s]} min por solicitud<br>capacidad: <b>${VIZ.fmt(serv[s] * muDe(MEDIAS, s))} / h</b><br>cola ahora: <b>${q[s]}</b>, en atención: <b>${ocupados[s]}</b><br>espera media teórica: <b>${r.estable ? P.dur(r.Wq * 60) : 'crece sin límite'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: utilización y escenario «qué pasa si» ---------- */

  function montarCuello(cuerpo) {
    let lam = 5, etapa = '1', mensaje = 'Escenario base: 1, 2, 1 y 1 recursos. Agregue un recurso donde falte capacidad.', hover = -1, pl = null;
    const serv = BASE.slice();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Llegadas por hora', min: 1, max: 12, paso: 0.5, valor: lam, formato: (v) => `${v} / h`, alCambiar: (v) => { lam = v; mensaje = `Llegan ${v} solicitudes por hora.`; dibujar(); } });
    const sel = ctl.selector({ etiqueta: 'Etapa que se modifica', opciones: NOMBRES.map((n, i) => [String(i), n]), valor: etapa, alCambiar: (v) => { etapa = v; } });
    ctl.boton('Agregar un recurso', () => cambiar(+sel.valor, 1), { primario: true });
    ctl.boton('Quitar un recurso', () => cambiar(+sel.valor, -1));
    ctl.boton('Restablecer', () => { BASE.forEach((c, s) => { serv[s] = c; }); mensaje = 'Escenario base restablecido.'; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'ρ menor que 70 %' }, { color: C.s4, texto: 'ρ entre 70 % y 90 %' }, { color: C.s8, texto: 'ρ mayor que 90 % (cuello de botella)' },
      { color: C.tenue, texto: 'escenario base', borde: C.eje }, { color: C.tinta, texto: 'capacidad (ρ = 100 %)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una barra (o use los botones) para agregar un recurso a esa etapa. Observe que mejorar una etapa que no es el cuello apenas cambia el tiempo de ciclo, y que el cuello se desplaza a otra etapa.');

    function cambiar(s, d) {
      const antes = capacidad(serv, MEDIAS), cuelloAntes = NOMBRES[rhoDe(lam, serv, MEDIAS).indexOf(Math.max(...rhoDe(lam, serv, MEDIAS)))];
      serv[s] = Math.max(1, Math.min(5, serv[s] + d));
      const rt = rhoDe(lam, serv, MEDIAS), cuello = NOMBRES[rt.indexOf(Math.max(...rt))], despues = capacidad(serv, MEDIAS);
      mensaje = `${d > 0 ? 'Se agrega' : 'Se quita'} un recurso en ${NOMBRES[s]} (ahora ${serv[s]}). Capacidad del proceso: ${VIZ.fmt(antes)} → ${VIZ.fmt(despues)} casos/h. Cuello de botella: ${cuelloAntes} → ${cuello}.`;
      dibujar();
    }
    const colorRho = (r) => (r >= 0.9 ? C.s8 : r >= 0.7 ? C.s4 : C.s6);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const rb = rhoDe(lam, BASE, MEDIAS), rn = rhoDe(lam, serv, MEDIAS);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0, ymax: 1.3 }, { etiquetaY: 'utilización ρ', ticksX: [], ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => `${Math.round(v * 100)} %`, margen: { inf: 34 } });
      pl.ejes();
      ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(1)); ctx.lineTo(pl.x1, pl.sy(1)); ctx.stroke(); ctx.restore();
      NOMBRES.forEach((n, s) => {
        const xc = pl.sx(s + 0.5), bw = (pl.sx(1) - pl.sx(0)) * 0.3;
        [[rb[s], xc - bw - 1, true], [rn[s], xc + 1, false]].forEach(([r, x, base]) => {
          const alto = Math.min(r, 1.3), y = pl.sy(alto);
          ctx.fillStyle = base ? C.tenue : colorRho(r);
          if (!base && s === hover) ctx.fillStyle = VIZ.alfa(colorRho(r), 0.75);
          ctx.beginPath(); ctx.roundRect(x, y, bw, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
          if (base) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.stroke(); }
          ctx.fillStyle = base ? C.apagado : C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(r >= 1.3 ? '>130 %' : `${Math.round(r * 100)} %`, x + bw / 2, y - 2);
        });
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'top';
        ctx.fillText(n, xc, pl.y0 + 6); ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.apagado; ctx.fillText(`${serv[s]} recurso${serv[s] > 1 ? 's' : ''}`, xc, pl.y0 + 19);
      });
      const cb = cicloTeorico(lam, BASE, MEDIAS), cn = cicloTeorico(lam, serv, MEDIAS);
      const capB = capacidad(BASE, MEDIAS), capN = capacidad(serv, MEDIAS), cuello = rn.indexOf(Math.max(...rn));
      registro.textContent = mensaje;
      lectura.set([
        ['cuello de botella', `${NOMBRES[cuello]} (ρ = ${VIZ.fmt(rn[cuello] * 100, 3)} %)`],
        ['capacidad del proceso', `${VIZ.fmt(capB)} → ${VIZ.fmt(capN)} casos/h`],
        ['casos atendidos por hora', `${VIZ.fmt(Math.min(lam, capB))} → ${VIZ.fmt(Math.min(lam, capN))}`],
        ['tiempo de ciclo', `${min(cb.W)} → ${min(cn.W)}`],
        ['casos en proceso (ley de Little)', `${Number.isFinite(cb.W) ? VIZ.fmt((lam * cb.W) / 60, 3) : '∞'} → ${Number.isFinite(cn.W) ? VIZ.fmt((lam * cn.W) / 60, 3) : '∞'}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const etapaEn = (x, y) => { if (!pl || !pl.dentro(x, y)) return -1; return Math.floor(pl.ix(x)); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const s = etapaEn(x, y);
      if (s !== hover) { hover = s; dibujar(); }
      if (s < 0 || s > 3) return tip.ocultar();
      const rb = S.cola(lam, muDe(MEDIAS, s), BASE[s]), rn = S.cola(lam, muDe(MEDIAS, s), serv[s]);
      tip.mostrar(x, y, `<b>${NOMBRES[s]}</b><br>capacidad: <b>${VIZ.fmt(serv[s] * muDe(MEDIAS, s))} / h</b> (base ${VIZ.fmt(BASE[s] * muDe(MEDIAS, s))})<br>espera media: <b>${rn.estable ? P.dur(rn.Wq * 60) : 'sin límite'}</b> (base ${rb.estable ? P.dur(rb.Wq * 60) : 'sin límite'})<br>probabilidad de esperar: <b>${VIZ.fmt(rn.Pespera * 100, 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const s = etapaEn(x, y);
      if (s >= 0 && s <= 3) { sel.valor = String(s); cambiar(s, 1); }
    });
    dibujar();
  }

  /* ---------- Fig. 3: tiempo de ciclo frente a la tasa de llegada ---------- */

  const CAMBIOS = {
    eva: { n: 'Un evaluador más', serv: [1, 3, 1, 1], medias: MEDIAS },
    evapr: { n: 'Un evaluador y un aprobador más', serv: [1, 3, 2, 1], medias: MEDIAS },
    rapido: { n: 'Evaluación 25 % más rápida', serv: BASE, medias: [6, 15, 8, 5] },
    digital: { n: 'Digitalizar recepción y evaluación', serv: BASE, medias: [3, 10, 8, 5] },
    rec: { n: 'Un recurso más en Recepción', serv: [2, 2, 1, 1], medias: MEDIAS },
  };

  function montarCiclo(cuerpo) {
    let clave = 'eva', lam = 5, hoverL = null, mostrarSim = true, sim = null, pl = null;
    const YMAX = 240;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cambio al proceso', opciones: Object.entries(CAMBIOS).map(([k, v]) => [k, v.n]), valor: clave, alCambiar: (v) => { clave = v; sim = null; dibujar(); } });
    ctl.rango({ etiqueta: 'Llegadas por hora (cursor)', min: 1, max: 11.5, paso: 0.5, valor: lam, formato: (v) => `${v} / h`, alCambiar: (v) => { lam = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar puntos simulados', valor: mostrarSim, alCambiar: (v) => { mostrarSim = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'proceso actual (teoría)', forma: 'linea' }, { color: C.s2, texto: 'con el cambio (teoría)', forma: 'linea' },
      { color: C.s1, texto: 'simulado, actual', forma: 'punto' }, { color: C.s2, texto: 'simulado, con el cambio', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el cursor sobre el gráfico o el deslizador de llegadas: el tiempo de ciclo es casi plano con poca carga y se dispara cerca de la capacidad (línea punteada). Los puntos son simulaciones de 800 solicitudes. Cambie la mejora y mire cuánto se desplaza la curva.');

    function simulados() {
      if (sim) return sim;
      const ca = CAMBIOS[clave];
      const medio = (serv, medias, l, sem) => { const c = simular(l, serv, 800, sem, medias).slice(150); return P.media(c.map((x) => x.fin - x.t0)); };
      sim = { a: [], b: [] };
      for (let l = 1; l <= 11; l++) {
        if (l < capacidad(BASE, MEDIAS) * 0.97) sim.a.push([l, medio(BASE, MEDIAS, l, 40 + l)]);
        if (l < capacidad(ca.serv, ca.medias) * 0.97) sim.b.push([l, medio(ca.serv, ca.medias, l, 90 + l)]);
      }
      return sim;
    }
    const W0 = (l) => cicloTeorico(l, BASE, MEDIAS).W, W1 = (l) => { const c = CAMBIOS[clave]; return cicloTeorico(l, c.serv, c.medias).W; };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ca = CAMBIOS[clave], cap0 = capacidad(BASE, MEDIAS), cap1 = capacidad(ca.serv, ca.medias);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 12, ymin: 0, ymax: YMAX }, { etiquetaX: 'llegadas por hora', etiquetaY: 'tiempo de ciclo (min)' });
      pl.ejes();
      ctx.save(); pl.recortar();
      const curva = (f) => { const pts = []; for (let l = 0.25; l <= 12; l += 0.05) { const w = f(l); pts.push([l, Number.isFinite(w) ? w : NaN]); } return pts; };
      VIZ.trazar(ctx, pl, curva(W0), C.s1, 2.5);
      VIZ.trazar(ctx, pl, curva(W1), C.s2, 2.5);
      ctx.restore();
      [[cap0, C.s1], [cap1, C.s2]].forEach(([cap, col], i) => {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.sx(cap), pl.y1); ctx.lineTo(pl.sx(cap), pl.y0); ctx.stroke(); ctx.restore();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        if (cap < 12) ctx.fillText(`capacidad ${VIZ.fmt(cap)}`, pl.sx(cap) - 4, pl.y1 + 2 + i * 12);
      });
      if (mostrarSim) {
        const s = simulados();
        s.a.forEach(([l, w]) => { if (w <= YMAX) VIZ.marcador(ctx, pl.sx(l), pl.sy(w), C.s1, 4); });
        s.b.forEach(([l, w]) => { if (w <= YMAX) VIZ.marcador(ctx, pl.sx(l), pl.sy(w), C.s2, 4, 1); });
      }
      const lc = hoverL !== null ? hoverL : lam;
      ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(pl.sx(lc), pl.y1); ctx.lineTo(pl.sx(lc), pl.y0); ctx.stroke(); ctx.restore();
      [[W0(lc), C.s1], [W1(lc), C.s2]].forEach(([w, col]) => { if (Number.isFinite(w) && w <= YMAX) VIZ.marcador(ctx, pl.sx(lc), pl.sy(w), col, 4.5); });
      const a = W0(lam), b = W1(lam), r0 = Math.max(...rhoDe(lam, BASE, MEDIAS)), r1 = Math.max(...rhoDe(lam, ca.serv, ca.medias));
      registro.textContent = `Con ${lam} llegadas/h: ${Number.isFinite(a) ? 'el proceso actual tarda ' + P.dur(a) : 'el proceso actual no alcanza a atender la demanda (su capacidad es ' + VIZ.fmt(cap0) + ' / h) y la cola crece sin límite'}; ${ca.n.toLowerCase()}: ${Number.isFinite(b) ? P.dur(b) : 'tampoco alcanza (capacidad ' + VIZ.fmt(cap1) + ' / h)'}.`;
      lectura.set([
        ['capacidad (actual → con el cambio)', `${VIZ.fmt(cap0)} → ${VIZ.fmt(cap1)} casos/h`],
        ['tiempo de ciclo con la carga elegida', `${min(a)} → ${min(b)}`],
        ['utilización máxima', `${VIZ.fmt(r0 * 100, 3)} % → ${VIZ.fmt(r1 * 100, 3)} %`],
        ['casos en proceso (λ · W)', `${Number.isFinite(a) ? VIZ.fmt((lam * a) / 60, 3) : '∞'} → ${Number.isFinite(b) ? VIZ.fmt((lam * b) / 60, 3) : '∞'}`],
        ['trabajo puro por caso', P.dur(MEDIAS.reduce((x, y) => x + y, 0))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hoverL = null; tip.ocultar(); return dibujar(); }
      hoverL = Math.max(0.25, Math.round(pl.ix(x) * 4) / 4);
      dibujar();
      const f = (w) => (Number.isFinite(w) ? P.dur(w) : 'sin límite');
      tip.mostrar(x, y, `llegadas: <b>${VIZ.fmt(hoverL)} / h</b>` + VIZ.filaTooltip(C.s1, 'actual', f(W0(hoverL))) + VIZ.filaTooltip(C.s2, 'con el cambio', f(W1(hoverL))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hoverL = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('process-simulation', {
    intro: String.raw`
      <p>Antes de cambiar un proceso conviene probar el cambio en un modelo. La <strong>simulación de procesos</strong> reproduce, evento por evento, cómo llegan los casos,
      esperan en cola por un recurso limitado (un evaluador, una caja, un servidor) y avanzan; así se miden tiempos de espera, utilización y tiempos de ciclo sin arriesgar la operación real.</p>
      <p>Lo primero que revela es el <strong>cuello de botella</strong>: la etapa cuya capacidad se agota antes que las demás y que fija el ritmo de todo el proceso. Agregar recursos en cualquier otro lugar es gastar dinero sin acortar el tiempo de ciclo.</p>`,
    visualizaciones: [
      {
        titulo: 'Simulación evento por evento',
        descripcion: 'Reproduzca llegadas y atenciones de 100 solicitudes de crédito. Suba las llegadas hasta que la etapa roja acumule cola y luego agréguele un recurso: la cola se vacía.',
        montar: montarSimulacion,
      },
      {
        titulo: 'Utilización y escenario «qué pasa si»',
        descripcion: 'Compare la utilización de cada etapa con el escenario base. Agregue un recurso en una etapa que no es el cuello y compruebe que el tiempo de ciclo casi no cambia; después hágalo en la roja.',
        montar: montarCuello,
      },
      {
        titulo: 'Tiempo de ciclo según la carga',
        descripcion: 'La curva sube lentamente y luego se dispara al acercarse a la capacidad. Elija un cambio y vea cuánto desplaza la capacidad; los puntos simulados siguen la teoría.',
        montar: montarCiclo,
      },
    ],
    teoria: String.raw`
      <h2>Simulación de eventos discretos</h2>
      <p>El estado del sistema (cuántos casos esperan, cuántos recursos están ocupados) solo cambia en instantes discretos: una <em>llegada</em>, un <em>inicio</em> de atención o un <em>término</em>. El simulador mantiene una lista ordenada de eventos y la
      recorre; entre eventos no ocurre nada. Si los tiempos entre llegadas y de servicio son aleatorios, se usa una semilla (\(\texttt{VIZ.semilla}\)) para que el experimento sea reproducible.</p>
      <p>Para colas con disciplina FIFO y \(c\) recursos, la hora de inicio de cada caso se calcula sin lista de eventos: \(\text{inicio} = \max(\text{llegada},\ \text{primer recurso libre})\).</p>
      <h2>Utilización y capacidad</h2>
      <p>Con tasa de llegadas \(\lambda\), \(c\) recursos y tasa de servicio \(\mu\) por recurso (inverso del tiempo medio de atención):</p>
      \[ \rho = \frac{\lambda}{c\,\mu}, \qquad \text{capacidad} = c\,\mu, \qquad \text{capacidad del proceso} = \min_s\; c_s \mu_s. \]
      <p>El proceso solo es estable si \(\rho < 1\) en todas las etapas. La etapa con mayor \(\rho\) (menor capacidad) es el cuello de botella.</p>
      <h2>Tiempo de espera: la cola M/M/c</h2>
      <p>Con llegadas de Poisson y servicios exponenciales, la probabilidad de esperar (fórmula de Erlang C), con \(a = \lambda/\mu\), es</p>
      \[ P_w = \frac{\dfrac{a^c}{c!}\dfrac{1}{1-\rho}}{\displaystyle\sum_{k=0}^{c-1}\frac{a^k}{k!} + \frac{a^c}{c!}\dfrac{1}{1-\rho}}, \qquad W_q = \frac{P_w}{c\mu - \lambda}, \qquad W = W_q + \frac{1}{\mu}, \qquad L = \lambda W \ (\text{ley de Little}). \]
      <h3>Ejemplo resuelto</h3>
      <p>Con \(\lambda = 5\) solicitudes por hora, tiempos de 6, 20, 8 y 5 min (\(\mu = 10,\ 3,\ 7{,}5,\ 12\) por hora) y recursos \(1, 2, 1, 1\): las utilizaciones son 50 %, 83 %, 67 % y 42 %. Evaluación es el cuello. Su \(P_w \approx 0{,}76\), \(W_q = 0{,}76 / (6 - 5) \approx 0{,}76\) h \(\approx 45{,}5\) min, y \(W \approx 65{,}5\) min.
      Sumando las cuatro etapas (12 + 65,5 + 24 + 8,6 min), el tiempo de ciclo es de unos 110 min, aunque el trabajo puro son solo 39 min. Con un evaluador más, \(\rho_{\text{Evaluación}} = 56\ \%\), la espera baja a 4,5 min y el ciclo cae a unos 69 min; sumar además un aprobador lo lleva a unos 54 min.</p>
      <div class="recuadro"><p><strong>No lineal.</strong> Con \(\rho\) cercano a 1 el tiempo de espera se dispara: pasar de 80 % a 90 % de utilización más que duplica la cola. Por eso un recurso «ocupado al 95 %» no es eficiente, es un riesgo.</p></div>
      <h2>Limitaciones</h2>
      <p>Un simulador es tan bueno como sus supuestos: tiempos de servicio y llegadas se estiman de un registro de eventos real, y se debe validar que el modelo reproduce el tiempo de ciclo observado antes de usarlo para predecir. Las excepciones, el retrabajo y los turnos cambian los resultados.</p>
      <h2>Conexiones</h2>
      <p>La espera y el servicio se miden en datos reales en <a href="tema.html?id=waiting-and-service-time">tiempos de espera y de servicio</a>, el rendimiento en <a href="tema.html?id=cycle-time-throughput">tiempo de ciclo y throughput</a> y la identificación del cuello en
      <a href="tema.html?id=bottleneck-analysis">análisis de cuellos de botella</a>. Los traspasos que agregan espera se ven en <a href="tema.html?id=bpmn-pools-lanes">piscinas y carriles</a>; el modelo sirve de base para
      <a href="tema.html?id=continuous-improvement">mejora continua y reingeniería</a> y para decidir inversiones en <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>.</p>`,
  });
})();
