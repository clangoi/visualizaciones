(function () {
  'use strict';
  const { color: C } = VIZ;
  const media = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const desv = (a) => { const m = media(a); return Math.sqrt(media(a.map((v) => (v - m) * (v - m)))); };
  const DIAS = 10;
  // Mismo modelo que VIZ.si.sprints (velocidad v con ruido normal y alcance nuevo por sprint), con el generador normal bien invocado.
  function sprints(semilla, puntos, v, { ruido = 0.2, alcance = 0, max = 30 } = {}) {
    const rnd = VIZ.semilla(semilla);
    const h = [{ sprint: 0, restante: puntos, hecho: 0 }];
    let rest = puntos;
    for (let s = 1; s <= max && rest > 0.01; s++) {
      const hecho = Math.max(0, v * (1 + ruido * VIZ.normal(rnd)));
      rest = Math.max(0, rest - hecho + alcance * (0.5 + rnd()));
      h.push({ sprint: s, restante: rest, hecho });
    }
    return h;
  }

  /* ---------- Fig. 1: un sprint completo ---------- */

  function montarSprint(cuerpo) {
    let semilla = 1, cap = 24, imp = 0.15, items = [], dia = 0, fase = 'preparado', compromiso = 0, restos = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capacidad comprometida', min: 10, max: 40, valor: cap, formato: (v) => `${v} pts`, alCambiar: (v) => { cap = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Trabajo imprevisto', min: 0, max: 0.5, paso: 0.05, valor: imp, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { imp = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevo backlog', () => { semilla++; nuevo(); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 12 * 25 + 40 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'en el product backlog' }, { color: C.s1, texto: 'comprometido en el sprint backlog' },
      { color: C.s4, texto: 'en curso' }, { color: C.s6, texto: 'hecho (incremento)' },
    ]);
    VIZ.subtitulo(cuerpo, 'Burn-down del sprint (puntos que faltan)');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.35, altoMin: 170, altoMax: 240 });
    const tip2 = VIZ.tooltip(lienzo2);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una tarjeta del product backlog, antes de empezar, para subirla al primer lugar (el Product Owner ordena). Durante el sprint ya no se puede: Scrum protege el sprint en curso.');

    function nuevo() {
      const rnd = VIZ.semilla(semilla * 13);
      items = Array.from({ length: 12 }, (_, i) => ({ id: `H${i + 1}`, pts: [1, 2, 3, 5, 8][Math.floor(rnd() * 5)], acc: 0, est: 'pb' }));
    }
    function iniciar() {
      items.forEach((it) => { it.acc = 0; it.est = 'pb'; });
      dia = 0; fase = 'preparado'; compromiso = 0; restos = [];
      return (function* () {
        fase = 'planning';
        let tot = 0;
        for (const it of items) { if (tot + it.pts > cap) break; it.est = 'sb'; tot += it.pts; }
        compromiso = tot; restos = [tot];
        yield;
        const comp = items.filter((it) => it.est === 'sb');
        for (dia = 1; dia <= DIAS; dia++) {
          fase = 'daily';
          const rnd = VIZ.semilla(semilla * 101 + dia);
          let w = ((cap * (1 - imp)) / DIAS) * (0.7 + 0.6 * rnd());
          for (const it of comp) {
            if (it.acc >= it.pts) continue;
            const t = Math.min(w, it.pts - it.acc);
            it.acc += t; w -= t;
            if (w <= 1e-9) break;
          }
          comp.forEach((it) => { if (it.acc >= it.pts - 1e-9) it.est = 'hecho'; });
          restos.push(comp.reduce((s, it) => s + (it.pts - it.acc), 0));
          yield;
        }
        fase = 'review'; yield;
        fase = 'retro'; yield;
      })();
    }
    const hechos = () => items.filter((it) => it.est === 'hecho').reduce((s, it) => s + it.pts, 0);

    function dibujar() {
      if (!items.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cw = W / 3, ah = 21;
      const enPb = items.filter((it) => it.est === 'pb'), enSb = items.filter((it) => it.est === 'sb'), enHecho = items.filter((it) => it.est === 'hecho');
      const cols = [['Product backlog', enPb], ['Sprint backlog', enSb], ['Incremento', enHecho]];
      geo = [];
      ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle';
      cols.forEach(([titulo, lista], c) => {
        const x = c * cw + 6;
        ctx.fillStyle = C.fondo2; ctx.fillRect(c * cw + 2, 0, cw - 4, lienzo.alto);
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(10, 600);
        ctx.fillText(titulo.toUpperCase(), x, 12);
        lista.forEach((it, k) => {
          const y = 26 + k * 25, w = cw - 12, pr = Math.min(1, it.acc / it.pts);
          const col = it.est === 'hecho' ? C.s6 : it.est === 'sb' ? (pr > 0 ? C.s4 : C.s1) : C.inactivo;
          ctx.fillStyle = C.superficie; ctx.fillRect(x, y, w, ah);
          ctx.fillStyle = it.est === 'hecho' ? C.s6 : VIZ.alfa(col, 0.18); ctx.fillRect(x, y, w, ah);
          if (it.est === 'sb' && pr > 0) { ctx.fillStyle = VIZ.alfa(C.s4, 0.8); ctx.fillRect(x, y, w * pr, ah); }
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, ah - 1.5);
          ctx.fillStyle = it.est === 'hecho' ? C.sobre : C.tinta; ctx.font = VIZ.fuente(11, 500);
          ctx.fillText(`${it.id} · ${it.pts} pt`, x + 6, y + ah / 2 + 0.5);
          geo.push({ x, y, w, h: ah, it, col: c });
        });
      });
      // Burn-down
      const c2 = lienzo2.ctx;
      lienzo2.limpiar();
      const pl = VIZ.plano(lienzo2, { xmin: 0, xmax: DIAS, ymin: 0, ymax: Math.max(5, compromiso || cap) * 1.1 }, { etiquetaX: 'día del sprint', etiquetaY: 'puntos', formatoX: (v) => String(Math.round(v)), ticksX: Array.from({ length: DIAS + 1 }, (_, i) => i) });
      pl.ejes();
      if (compromiso) {
        VIZ.trazar(c2, pl, [[0, compromiso], [DIAS, 0]], C.apagado, 1.5, [3, 4]);
        VIZ.trazar(c2, pl, restos.map((r, i) => [i, r]), C.s1, 2.5);
        restos.forEach((r, i) => VIZ.marcador(c2, pl.sx(i), pl.sy(r), C.s1, 3.5));
      }
      burn = pl;
      const hp = hechos();
      const textos = {
        preparado: `Product backlog de ${items.length} historias ordenadas por prioridad. Pulse «Un paso» para abrir el sprint planning.`,
        planning: `Sprint planning: el Product Owner presenta lo más prioritario y el equipo se compromete con ${compromiso} pts (capacidad ${cap}); la siguiente historia ya no cabe.`,
        daily: `Día ${dia}: en el daily el equipo revisa el avance; quedan ${VIZ.fmt(restos[restos.length - 1], 3)} pts de los ${compromiso} comprometidos (${hp} pts hechos).`,
        review: `Sprint review: el equipo muestra un incremento de ${hp} pts a los interesados; ${compromiso - hp > 0 ? `${compromiso - hp} pts no se terminaron y vuelven al backlog` : 'se cumplió todo el compromiso'}.`,
        retro: `Retrospectiva: el Scrum Master facilita; velocidad del sprint = ${hp} pts. Esta cifra alimenta la planificación del próximo sprint.`,
      };
      registro.textContent = textos[fase];
      lectura.set([
        ['evento', { preparado: '—', planning: 'planning', daily: `daily, día ${dia} de ${DIAS}`, review: 'review', retro: 'retrospectiva' }[fase]],
        ['comprometido', `${compromiso} pts`],
        ['hecho (velocidad)', `${hp} pts`],
        ['cumplimiento', compromiso ? `${Math.round((100 * hp) / compromiso)} %` : '—'],
        ['capacidad diaria real', `${VIZ.fmt((cap * (1 - imp)) / DIAS, 3)} pts/día`],
      ]);
    }
    let burn = null;
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'default';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo && geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      lienzo.canvas.style.cursor = g && g.col === 0 && fase === 'preparado' ? 'pointer' : 'default';
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.it.id}</b><br>${g.it.pts} puntos<br>avance ${VIZ.fmt((100 * Math.min(g.it.acc, g.it.pts)) / g.it.pts, 3)} %`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo && geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!g || g.col !== 0) return;
      if (fase !== 'preparado') { registro.textContent = 'El sprint está en curso: el Product Owner no puede cambiar su contenido. Reordene el backlog y reinicie.'; return; }
      items.splice(items.indexOf(g.it), 1); items.unshift(g.it);
      dibujar();
    });
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (!burn || !restos.length || !burn.dentro(x, y)) return tip2.ocultar();
      const d = Math.max(0, Math.min(restos.length - 1, Math.round(burn.ix(x))));
      tip2.mostrar(x, y, `día <b>${d}</b>` + VIZ.filaTooltip(C.s1, 'quedan', `${VIZ.fmt(restos[d], 3)} pts`) + VIZ.filaTooltip(C.apagado, 'ideal', `${VIZ.fmt(compromiso * (1 - d / DIAS), 3)} pts`));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    nuevo();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: burn-down del proyecto y pronóstico ---------- */

  function montarBurndown(cuerpo) {
    let semilla = 4, puntos = 160, v = 20, alc = 3, ruido = 0.25, h = [], k = 0, pl = null, aniadido = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del backlog', min: 60, max: 400, paso: 10, valor: puntos, formato: (x) => `${x} pts`, alCambiar: (x) => { puntos = x; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Velocidad media', min: 8, max: 50, valor: v, formato: (x) => `${x} pts/sprint`, alCambiar: (x) => { v = x; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Alcance nuevo por sprint', min: 0, max: 15, valor: alc, formato: (x) => `${x} pts`, alCambiar: (x) => { alc = x; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Variabilidad de la velocidad', min: 0, max: 0.6, paso: 0.05, valor: ruido, formato: (x) => `${Math.round(x * 100)} %`, alCambiar: (x) => { ruido = x; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Otro equipo', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'puntos que faltan (real)', forma: 'linea' }, { color: C.s2, texto: 'pronóstico con la velocidad neta observada', forma: 'linea' },
      { color: C.apagado, texto: 'línea ideal a velocidad media', forma: 'linea' }, { color: C.s4, texto: 'rango del pronóstico (± 1 desv.)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso es un sprint terminado: el pronóstico se recalcula con lo observado. Suba el alcance nuevo hasta igualar la velocidad y el proyecto no termina nunca; con mucha variabilidad el rango del pronóstico se ensancha.');

    function iniciar() {
      h = sprints(semilla, puntos, v, { ruido, alcance: alc, max: 60 });
      aniadido = h.map((s, i) => (i ? Math.max(0, s.restante - (h[i - 1].restante - s.hecho)) : 0));
      k = 0;
      return (function* () { for (k = 1; k < h.length; k++) yield; k = h.length - 1; })();
    }
    // Pronóstico tras `n` sprints: sprints restantes = restante / reducción neta media.
    function pronostico() {
      const n = Math.max(1, k);
      if (k < 1) return null;
      const netos = [];
      for (let i = 1; i <= n; i++) netos.push(h[i - 1].restante - h[i].restante);
      const m = media(netos), sd = desv(netos), rest = h[n].restante;
      if (rest <= 0.01) return { fin: n, lo: n, hi: n, m, sd };
      const f = (r) => (r > 0.05 ? n + rest / r : Infinity);
      return { fin: f(m), lo: f(m + sd), hi: f(Math.max(0.05, m - sd)), m, sd };
    }
    function dibujar() {
      if (!h.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pr = pronostico();
      const xmax = Math.max(8, h.length - 1, pr && Number.isFinite(pr.hi) ? Math.ceil(Math.min(pr.hi, 60)) : 0) + 1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: puntos * 1.1 }, { etiquetaX: 'sprint', etiquetaY: 'puntos que faltan', formatoX: (x) => String(Math.round(x)) });
      pl.ejes();
      const ideal = v - alc > 0 ? puntos / (v - alc) : Infinity;
      VIZ.trazar(ctx, pl, [[0, puntos], [Math.min(ideal, xmax), puntos * Math.max(0, 1 - Math.min(ideal, xmax) / ideal)]], C.apagado, 1.5, [3, 4]);
      if (pr && pr.fin > k) {
        const rest = h[k].restante, x1 = Number.isFinite(pr.fin) ? pr.fin : xmax;
        if (Number.isFinite(pr.hi) || Number.isFinite(pr.lo)) {
          const a = Math.min(pr.lo, xmax), b = Math.min(pr.hi, xmax);
          ctx.fillStyle = VIZ.alfa(C.s4, 0.35); ctx.fillRect(pl.sx(a), pl.y0 - 8, Math.max(2, pl.sx(b) - pl.sx(a)), 8);
        }
        VIZ.trazar(ctx, pl, [[k, rest], [Math.min(x1, xmax), !Number.isFinite(pr.fin) ? rest : x1 <= xmax ? 0 : rest * (1 - (xmax - k) / (x1 - k))]], C.s2, 2.5, [6, 4]);
      }
      VIZ.trazar(ctx, pl, h.slice(0, k + 1).map((s) => [s.sprint, s.restante]), C.s1, 2.5);
      h.slice(0, k + 1).forEach((s) => VIZ.marcador(ctx, pl.sx(s.sprint), pl.sy(s.restante), C.s1, 3.5));
      const terminado = h[k].restante <= 0.01;
      const txtFin = !pr ? '—' : !Number.isFinite(pr.fin) ? 'nunca (el alcance crece más que lo que se termina)' : `sprint ${Math.ceil(pr.fin - 1e-9)}`;
      registro.textContent = k === 0
        ? `Backlog inicial de ${puntos} pts, velocidad media esperada ${v} pts/sprint. Con ${alc} pts de alcance nuevo por sprint la reducción neta esperada es ${v - alc} pts.`
        : terminado ? `Sprint ${k}: el backlog quedó en cero. El proyecto duró ${k} sprints; la estimación inicial era ${Number.isFinite(ideal) ? Math.ceil(ideal) : '∞'}.`
          : `Sprint ${k}: se hicieron ${VIZ.fmt(h[k].hecho, 3)} pts y entraron ${VIZ.fmt(aniadido[k], 2)} pts nuevos; quedan ${VIZ.fmt(h[k].restante, 3)}. Pronóstico de término: ${txtFin}.`;
      lectura.set([
        ['sprint actual', String(k)],
        ['restante', `${VIZ.fmt(h[k].restante, 3)} pts`],
        ['velocidad observada', k ? `${VIZ.fmt(media(h.slice(1, k + 1).map((s) => s.hecho)), 3)} pts/sprint` : '—'],
        ['reducción neta media', pr ? `${VIZ.fmt(pr.m, 3)} pts/sprint` : '—'],
        ['término pronosticado', terminado ? `sprint ${k} (real)` : txtFin],
        ['rango (± 1 desv.)', pr && !terminado && Number.isFinite(pr.hi) ? `sprint ${Math.ceil(pr.lo - 1e-9)} a ${Math.ceil(pr.hi - 1e-9)}` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !h.length || !pl.dentro(x, y)) return tip.ocultar();
      const s = Math.round(pl.ix(x));
      if (s < 0 || s > k) return tip.ocultar();
      tip.mostrar(x, y, `sprint <b>${s}</b>` + VIZ.filaTooltip(C.s1, 'faltan', `${VIZ.fmt(h[s].restante, 3)} pts`) + (s ? `<div class="fila">hecho <b>${VIZ.fmt(h[s].hecho, 3)}</b> · nuevo <b>${VIZ.fmt(aniadido[s], 2)}</b></div>` : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: ¿para cuándo? ---------- */

  function montarCuando() {
    return function (cuerpo) {
      let puntos = 160, v = 20, alc = 3, ruido = 0.3, plazo = 10, res = [], pl = null, hist = [];
      const R = 400;
      const ctl = VIZ.controles(cuerpo);
      ctl.rango({ etiqueta: 'Tamaño del backlog', min: 60, max: 400, paso: 10, valor: puntos, formato: (x) => `${x} pts`, alCambiar: (x) => { puntos = x; calcular(); } });
      ctl.rango({ etiqueta: 'Velocidad media', min: 8, max: 50, valor: v, formato: (x) => `${x} pts`, alCambiar: (x) => { v = x; calcular(); } });
      ctl.rango({ etiqueta: 'Alcance nuevo por sprint', min: 0, max: 12, valor: alc, formato: (x) => `${x} pts`, alCambiar: (x) => { alc = x; calcular(); } });
      ctl.rango({ etiqueta: 'Variabilidad de la velocidad', min: 0, max: 0.6, paso: 0.05, valor: ruido, formato: (x) => `${Math.round(x * 100)} %`, alCambiar: (x) => { ruido = x; calcular(); } });
      const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
      const tip = VIZ.tooltip(lienzo);
      VIZ.leyenda(cuerpo, [
        { color: C.s1, texto: 'proyectos que terminan dentro del plazo' }, { color: C.inactivo, texto: 'proyectos que terminan después' },
        { color: C.tinta, texto: 'plazo elegido', forma: 'linea' }, { color: C.s2, texto: 'percentil 85', forma: 'linea' },
      ]);
      const registro = VIZ.registro(cuerpo);
      const lectura = VIZ.lectura(cuerpo);
      VIZ.nota(cuerpo, `Cada barra cuenta, de ${R} proyectos simulados con estos parámetros, cuántos terminan justo en ese sprint. Haga clic en una barra para fijar el plazo y leer la probabilidad de cumplirlo.`);

      function calcular() {
        res = [];
        for (let s = 1; s <= R; s++) {
          const h = sprints(5000 + s, puntos, v, { ruido, alcance: alc, max: 80 });
          res.push(h[h.length - 1].restante <= 0.01 ? h.length - 1 : Infinity);
        }
        const fin = res.filter(Number.isFinite);
        const mx = fin.length ? Math.max(...fin) : 1;
        hist = Array.from({ length: mx + 1 }, () => 0);
        fin.forEach((x) => { hist[x]++; });
        plazo = Math.min(Math.max(1, plazo), hist.length - 1);
        dibujar();
      }
      const cuantil = (q) => { const o = [...res].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(q * o.length))]; };
      const prob = (p) => res.filter((x) => x <= p).length / R;
      function dibujar() {
        const { ctx } = lienzo;
        lienzo.limpiar();
        const lo = Math.max(1, hist.findIndex((c) => c > 0) - 1), hi = hist.length;
        const ymax = Math.max(1, ...hist) * 1.15;
        pl = VIZ.plano(lienzo, { xmin: lo - 0.5, xmax: hi + 0.5, ymin: 0, ymax }, { etiquetaX: 'sprint en que termina', etiquetaY: 'proyectos', formatoX: (x) => String(Math.round(x)), ticksX: VIZ.ticks(lo, hi, 8).map(Math.round), formatoY: (x) => String(Math.round(x)) });
        pl.ejes();
        for (let s = lo; s < hi; s++) {
          if (!hist[s]) continue;
          const x = pl.sx(s - 0.5) + 1, w = pl.sx(s + 0.5) - pl.sx(s - 0.5) - 2, y = pl.sy(hist[s]);
          ctx.fillStyle = s <= plazo ? C.s1 : C.inactivo;
          ctx.beginPath(); ctx.roundRect(x, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
        }
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(plazo + 0.5), pl.y1); ctx.lineTo(pl.sx(plazo + 0.5), pl.y0); ctx.stroke();
        const p85 = cuantil(0.85);
        if (Number.isFinite(p85) && p85 < hi) {
          ctx.setLineDash([3, 4]); ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(p85 + 0.5), pl.y1); ctx.lineTo(pl.sx(p85 + 0.5), pl.y0); ctx.stroke(); ctx.setLineDash([]);
        }
        const pr = prob(plazo), nunca = res.filter((x) => !Number.isFinite(x)).length;
        registro.textContent = `Con un plazo de ${plazo} sprints, ${Math.round(pr * R)} de ${R} proyectos terminan a tiempo: probabilidad ${VIZ.fmt(pr * 100, 3)} %. Comprometer la fecha de la mediana (${cuantil(0.5)}) equivale a aceptar una probabilidad de fracaso de ~50 %.`;
        lectura.set([
          ['sprints sin variación', v > alc ? String(Math.ceil(puntos / (v - alc) - 1e-9)) : '∞'],
          ['mediana (p50)', String(cuantil(0.5))],
          ['percentil 85', String(p85)],
          [`P(terminar ≤ ${plazo})`, `${VIZ.fmt(pr * 100, 3)} %`],
          ['no terminan en 80 sprints', `${nunca} de ${R}`],
        ]);
      }
      lienzo.alDibujar = () => hist.length && dibujar();
      lienzo.canvas.style.cursor = 'pointer';
      lienzo.canvas.addEventListener('click', (ev) => {
        const { x, y } = lienzo.posicion(ev);
        if (!pl || !pl.dentro(x, y)) return;
        plazo = Math.max(1, Math.round(pl.ix(x))); dibujar();
      });
      lienzo.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = lienzo.posicion(ev);
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const s = Math.round(pl.ix(x));
        if (s < 1 || s >= hist.length) return tip.ocultar();
        tip.mostrar(x, y, `sprint <b>${s}</b><br>${hist[s]} proyectos terminan aquí<br>probabilidad acumulada <b>${VIZ.fmt(prob(s) * 100, 3)} %</b>`);
      });
      lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
      calcular();
    };
  }

  VIZ.registrarTema('scrum', {
    intro: String.raw`
      <p><strong>Scrum</strong> es un marco de trabajo ágil para desarrollar productos complejos en ciclos cortos de tiempo fijo llamados <em>sprints</em>, de una a cuatro semanas. Define tres roles: el <em>Product Owner</em>,
      que decide qué construir y en qué orden; el <em>Scrum Master</em>, que ayuda al equipo a seguir el marco y quita obstáculos; y el equipo de desarrollo, que se organiza solo para entregar. Al final de cada sprint debe existir un incremento utilizable.</p>
      <p>Lo que hace gestionable a Scrum es que mide: el <em>burn-down</em> muestra cuánto trabajo falta y la <em>velocidad</em> (puntos terminados por sprint) permite pronosticar fechas con datos, no con deseos.
      Las figuras recorren un sprint, siguen un proyecto completo y muestran por qué una fecha es en realidad una distribución de probabilidad.</p>`,
    visualizaciones: [
      {
        titulo: 'Un sprint paso a paso',
        descripcion: 'Avance por el planning, diez dailies, la review y la retrospectiva. Antes de empezar, haga clic en una historia para subirla de prioridad; luego suba el trabajo imprevisto y vea cómo cae lo que el equipo logra terminar.',
        montar: montarSprint,
      },
      {
        titulo: 'Burn-down y pronóstico de término',
        descripcion: 'Reproduzca los sprints de un proyecto y vea cómo el pronóstico se actualiza. Pruebe subir el alcance nuevo por sprint hasta acercarlo a la velocidad: la fecha se aleja y, si lo alcanza, desaparece.',
        montar: montarBurndown,
      },
      {
        titulo: '¿Para cuándo estará listo?',
        descripcion: 'Cientos de proyectos simulados muestran la distribución del sprint final. Haga clic en una barra para fijar un plazo y lea su probabilidad; aumente la variabilidad y observe cómo el percentil 85 se aleja de la mediana.',
        montar: montarCuando(),
      },
    ],
    teoria: String.raw`
      <h2>Roles, eventos y artefactos</h2>
      <table>
        <tr><th>Elemento</th><th>Qué es</th><th>Quién / cuándo</th></tr>
        <tr><td>Product Owner</td><td>responsable del valor del producto y del orden del backlog</td><td>una persona</td></tr>
        <tr><td>Scrum Master</td><td>facilita el marco y elimina impedimentos</td><td>una persona</td></tr>
        <tr><td>Equipo de desarrollo</td><td>construye el incremento; se autoorganiza</td><td>3 a 9 personas</td></tr>
        <tr><td>Sprint</td><td>ciclo de duración fija que contiene a los demás eventos</td><td>1 a 4 semanas</td></tr>
        <tr><td>Sprint planning</td><td>se elige qué entra (sprint backlog) y cómo se hará</td><td>inicio del sprint</td></tr>
        <tr><td>Daily</td><td>sincronización de 15 minutos</td><td>cada día</td></tr>
        <tr><td>Sprint review</td><td>se inspecciona el incremento con los interesados</td><td>fin del sprint</td></tr>
        <tr><td>Retrospectiva</td><td>el equipo mejora su forma de trabajar</td><td>tras la review</td></tr>
        <tr><td>Artefactos</td><td>product backlog, sprint backlog e incremento</td><td>con «definición de terminado»</td></tr>
      </table>
      <h2>Velocidad, burn-down y pronóstico</h2>
      <p>Si el equipo termina \(h_1,\dots,h_n\) puntos en los \(n\) primeros sprints y se agregan \(a_i\) puntos de alcance nuevo, el trabajo que falta es</p>
      \[ R_n = P - \sum_{i=1}^{n} h_i + \sum_{i=1}^{n} a_i, \qquad \bar{v} = \frac{1}{n}\sum_{i=1}^{n} h_i. \]
      <p>Con reducción neta media \(\bar{r} = \bar{v} - \bar{a}\), el número de sprints que faltan es \(\lceil R_n / \bar{r} \rceil\) si \(\bar{r} > 0\); si \(\bar{a} \ge \bar{v}\), el backlog no se agota nunca.
      Como las velocidades varían, la estimación puntual es solo el centro: con desviación \(\sigma_r\) de la reducción neta, un rango razonable va de \(R_n/(\bar{r}+\sigma_r)\) a \(R_n/(\bar{r}-\sigma_r)\).</p>
      <h2>Ejemplo resuelto</h2>
      <p>Un backlog de \(P = 120\) puntos, velocidad media \(\bar{v} = 20\) y \(\bar{a} = 4\) puntos nuevos por sprint tiene reducción neta \(16\) y necesita \(120/16 = 7{,}5\), es decir 8 sprints (16 semanas con sprints de dos semanas).
      Sin cambios de alcance serían \(120/20 = 6\) sprints: el alcance nuevo agregó dos sprints. Si la velocidad tiene desviación \(\sigma = 4\) y \(\bar{a}\) es fijo, el rango es \(120/20 = 6\) a \(120/12 = 10\) sprints.</p>
      <div class="recuadro"><p><strong>Comprometa percentiles, no promedios.</strong> Si el término depende de la suma de muchas velocidades aleatorias, la mediana se cumple la mitad de las veces. Una fecha con 85 % de confianza suele ser varios sprints
      posterior a la del promedio, y la diferencia crece con la variabilidad del equipo. Además la velocidad es una herramienta de planificación del propio equipo, no una métrica para compararlo con otros.</p></div>
      <h2>Conexiones</h2>
      <p>Scrum es la práctica ágil más usada; compárela con la cascada en <a href="tema.html?id=waterfall-vs-agile">Waterfall vs Agile</a>. El orden del backlog sale de la
      <a href="tema.html?id=requirements-management">gestión de requerimientos</a>, la entrega al final de cada sprint se automatiza con <a href="tema.html?id=devops-ci-cd">integración y entrega continua</a>,
      y el equilibrio entre alcance, tiempo y costo se discute en <a href="tema.html?id=triple-constraint">alcance, tiempo, costo y calidad</a>.</p>`,
  });
})();
