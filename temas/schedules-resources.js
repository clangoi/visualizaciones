(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;

  /* Proyecto de ejemplo: implantación de un CRM. Duraciones en semanas; r = personas que exige cada actividad. */
  const BASE = [
    { id: 'A', nombre: 'Levantar requisitos', dur: 3, pre: [], r: 2 },
    { id: 'B', nombre: 'Diseño técnico', dur: 4, pre: ['A'], r: 2 },
    { id: 'C', nombre: 'Configuración', dur: 5, pre: ['B'], r: 3 },
    { id: 'D', nombre: 'Migración de datos', dur: 6, pre: ['B'], r: 2 },
    { id: 'E', nombre: 'Integraciones', dur: 4, pre: ['C'], r: 2 },
    { id: 'F', nombre: 'Reportes', dur: 3, pre: ['C'], r: 2 },
    { id: 'G', nombre: 'Pruebas integrales', dur: 3, pre: ['D', 'E', 'F'], r: 3 },
    { id: 'H', nombre: 'Capacitación', dur: 3, pre: ['B'], r: 2 },
    { id: 'I', nombre: 'Puesta en marcha', dur: 2, pre: ['G', 'H'], r: 3 },
  ];
  const copia = () => BASE.map((a) => ({ ...a, pre: [...a.pre] }));
  const LISTA = BASE.map((a) => `${a.id} ${a.nombre.toLowerCase()}`).join(' · ');
  const opcionesActs = BASE.map((a) => [a.id, `${a.id} · ${a.nombre}`]);
  const camino = (r) => [...r.acts.values()].filter((a) => a.critica).sort((a, b) => a.es - b.es || a.id.localeCompare(b.id)).map((a) => a.id).join(' → ');
  const sem = (v) => `${VIZ.fmt(v, 3)} sem`;

  /* ---------- Fig. 1: red de actividades y ruta crítica ---------- */

  const POS = { A: [0, 1], B: [1, 1], C: [2, 1], D: [2, 0], H: [2, 3], E: [3, 1], F: [3, 1.95], G: [4, 1], I: [5, 1] };

  function montarRed(cuerpo) {
    let acts = copia(), res = S.cpm(acts), sel = 'E', fw = 0, bw = 0, nodos = [];
    const ctl = VIZ.controles(cuerpo);
    const selector = ctl.selector({ etiqueta: 'Actividad', opciones: opcionesActs, valor: sel, alCambiar: (v) => { sel = v; sincronizar(); dibujar(); } });
    const rDur = ctl.rango({ etiqueta: 'Duración de la actividad elegida', min: 1, max: 12, valor: 4, formato: (v) => `${v} sem`, alCambiar: (v) => { acts.find((a) => a.id === sel).dur = v; res = S.cpm(acts); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Restablecer duraciones', () => { acts = copia(); res = S.cpm(acts); sincronizar(); rep.reiniciar(); });
    function sincronizar() { rDur.valor = acts.find((a) => a.id === sel).dur; }
    sincronizar();

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 262 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'actividad que se calcula ahora' }, { color: C.s2, texto: 'ruta crítica (holgura 0)', forma: 'linea' },
      { color: C.eje, texto: 'dependencia', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Pase hacia adelante (inicios y fines más tempranos, arriba de cada caja) y luego hacia atrás (más tardíos, abajo); la holgura es la diferencia. Haga clic en una actividad para elegirla y cambie su duración: la ruta crítica puede cambiar. ${LISTA}.`);

    function iniciar() {
      fw = 0; bw = 0;
      const n = res.orden.length;
      return (function* () {
        for (let i = 0; i < n; i++) { fw = i + 1; yield; }
        for (let i = 0; i < n; i++) { bw = i + 1; yield; }
      })();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const padX = 8, colW = (W - 2 * padX) / 6, nw = Math.min(46, colW - 12), nh = 28, y0 = 44, fila = 56;
      const P = (id) => [padX + (POS[id][0] + 0.5) * colW, y0 + POS[id][1] * fila];
      const n = res.orden.length, fin = bw >= n;
      const actual = bw > 0 ? res.orden[n - bw] : fw > 0 ? res.orden[fw - 1] : null;
      const verAdelante = (id) => res.orden.indexOf(id) < fw, verAtras = (id) => n - 1 - res.orden.indexOf(id) < bw;
      nodos = [];
      // Aristas.
      for (const a of acts) for (const p of a.pre) {
        const [x1, y1] = P(p), [x2, y2] = P(a.id);
        const A = res.acts.get(a.id), Pp = res.acts.get(p);
        const crit = fin && A.critica && Pp.critica && Math.abs(Pp.ef - A.es) < 1e-9;
        ctx.strokeStyle = crit ? C.s2 : C.eje; ctx.lineWidth = crit ? 3.5 : 1.5;
        const ax = x1 + nw / 2, bx = x2 - nw / 2;
        ctx.beginPath(); ctx.moveTo(ax, y1); ctx.lineTo(bx, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, bx - ax);
        ctx.fillStyle = crit ? C.s2 : C.eje;
        ctx.beginPath(); ctx.moveTo(bx, y2); ctx.lineTo(bx - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4)); ctx.lineTo(bx - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
      }
      // Nodos.
      for (const a of acts) {
        const [x, y] = P(a.id), A = res.acts.get(a.id), crit = fin && A.critica, act = a.id === actual;
        ctx.fillStyle = act ? VIZ.alfa(C.s1, 0.28) : C.superficie;
        ctx.strokeStyle = crit ? C.s2 : act ? C.s1 : C.tinta2; ctx.lineWidth = crit ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(x - nw / 2, y - nh / 2, nw, nh, 5); ctx.fill(); ctx.stroke();
        if (a.id === sel) { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.strokeRect(x - nw / 2 - 3, y - nh / 2 - 3, nw + 6, nh + 6); ctx.restore(); }
        ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = VIZ.fuente(12, 700); ctx.fillText(a.id, x, y - 5);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(`${a.dur} sem`, x, y + 7);
        ctx.font = VIZ.fuente(9.5, act ? 700 : 400);
        ctx.fillStyle = act && bw === 0 ? C.s1 : C.tinta2;
        if (verAdelante(a.id)) ctx.fillText(`${A.es}–${A.ef}`, x, y - nh / 2 - 7);
        ctx.fillStyle = act && bw > 0 ? C.s1 : C.tinta2;
        if (verAtras(a.id)) ctx.fillText(`${A.ls}–${A.lf}`, x, y + nh / 2 + 8);
        if (fin) { ctx.fillStyle = crit ? C.s2 : C.apagado; ctx.font = VIZ.fuente(9.5, 600); ctx.textAlign = 'left'; ctx.fillText(`h=${A.holgura}`, x + nw / 2 - 20, y + nh / 2 + 20); }
        nodos.push({ id: a.id, x, y, w: nw, h: nh });
      }
      // Texto del registro.
      if (!fw) registro.textContent = `Hay ${n} actividades. Pulse «Un paso»: primero el pase hacia adelante calcula, para cada actividad, cuándo puede empezar (ES) y terminar (EF).`;
      else if (actual) {
        const A = res.acts.get(actual);
        if (bw === 0) registro.textContent = A.pre.length
          ? `ES(${actual}) = máx(${A.pre.map((p) => `EF(${p}) = ${res.acts.get(p).ef}`).join(', ')}) = ${A.es}; EF = ES + d = ${A.es} + ${A.dur} = ${A.ef}.`
          : `${actual} no tiene predecesoras: ES = 0 y EF = 0 + ${A.dur} = ${A.ef}.`;
        else {
          const suc = acts.filter((b) => b.pre.includes(actual)).map((b) => res.acts.get(b.id));
          registro.textContent = (suc.length
            ? `LF(${actual}) = mín(${suc.map((b) => `LS(${b.id}) = ${b.ls}`).join(', ')}) = ${A.lf}`
            : `${actual} es la última: LF = duración del proyecto = ${A.lf}`) + `; LS = LF − d = ${A.lf} − ${A.dur} = ${A.ls}; holgura = LS − ES = ${A.ls} − ${A.es} = ${A.holgura}${A.critica ? ' (crítica)' : ''}.`;
        }
      }
      lectura.set([
        ['duración del proyecto', sem(res.total)],
        ['ruta crítica', fin || fw ? (fin ? camino(res) : 'se conoce al terminar el pase hacia atrás') : '—'],
        ['actividades críticas', fin ? `${[...res.acts.values()].filter((a) => a.critica).length} de ${n}` : '—'],
        ['holgura total (no críticas)', fin ? sem([...res.acts.values()].reduce((s, a) => s + a.holgura, 0)) : '—'],
      ]);
    }
    lienzo.alDibujar = () => nodos.length && dibujar();
    const nodoEn = (x, y) => nodos.find((q) => Math.abs(q.x - x) < q.w / 2 + 3 && Math.abs(q.y - y) < q.h / 2 + 3);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = nodoEn(x, y);
      if (!q) return;
      sel = q.id; selector.valor = sel; sincronizar(); dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = nodoEn(x, y);
      if (!q) return tip.ocultar();
      const a = acts.find((b) => b.id === q.id), A = res.acts.get(q.id);
      tip.mostrar(x, y, `<b>${a.id} · ${a.nombre}</b><br>duración ${a.dur} sem · ${a.r} personas<br>predecesoras: ${a.pre.join(', ') || 'ninguna'}<br>más temprano ${A.es}–${A.ef}<br>más tardío ${A.ls}–${A.lf}<br>holgura <b>${A.holgura}</b>${A.critica ? ' (crítica)' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: Gantt, holgura y aceleración ---------- */

  function montarGantt(cuerpo) {
    let sel = 'E', ajuste = 0, geo = [], plano = null;
    const COSTO_ACELERAR = 12; // mil por semana acelerada (supuesto del ejemplo)
    const ctl = VIZ.controles(cuerpo);
    const selector = ctl.selector({ etiqueta: 'Actividad', opciones: opcionesActs, valor: sel, alCambiar: (v) => { sel = v; ajuste = 0; rA.valor = 0; dibujar(); } });
    const rA = ctl.rango({ etiqueta: 'Cambio de duración', min: -3, max: 10, valor: 0, formato: (v) => (v === 0 ? 'sin cambio' : v < 0 ? `acelerar ${-v} sem` : `retrasar ${v} sem`), alCambiar: (v) => { ajuste = v; dibujar(); } });
    ctl.boton('Restablecer', () => { ajuste = 0; rA.valor = 0; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 9 * 26 + 56 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'actividad crítica' }, { color: C.s1, texto: 'actividad con holgura' }, { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'holgura disponible' },
      { color: C.apagado, texto: 'fin original', forma: 'linea' }, { color: C.tinta, texto: 'fin nuevo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Elija una actividad (o haga clic en su barra) y acelérela o retrásela. Una actividad con holgura puede atrasarse sin mover el fin; una crítica, no. Acelerar una crítica solo ahorra tiempo hasta que otra ruta se vuelve crítica. ${LISTA}.`);

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const r0 = S.cpm(copia());
      const acts = copia(); const a = acts.find((b) => b.id === sel); a.dur = Math.max(1, a.dur + ajuste);
      const r1 = S.cpm(acts), eff = a.dur - BASE.find((b) => b.id === sel).dur;
      const izq = W >= 520 ? 150 : 24, der = 12, top = 6, alto = 26, xmax = Math.max(r0.total, r1.total) + 1;
      const sx = (t) => izq + (t / xmax) * (W - izq - der);
      plano = { sx, izq, der, xmax };
      geo = [];
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      BASE.forEach((b, i) => {
        const A = r1.acts.get(b.id), y = top + i * alto, col = A.critica ? C.s2 : C.s1;
        ctx.fillStyle = b.id === sel ? C.neutro : 'transparent'; ctx.fillRect(0, y, W, alto);
        ctx.fillStyle = b.id === sel ? C.tinta : C.tinta2; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(11, b.id === sel ? 700 : 500);
        ctx.fillText(W >= 520 ? `${b.id} ${b.nombre}` : b.id, 6, y + alto / 2);
        if (A.holgura > 1e-9) {
          ctx.fillStyle = VIZ.alfa(col, 0.2); ctx.fillRect(sx(A.ef), y + 6, sx(A.lf) - sx(A.ef), alto - 12);
          ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(sx(A.ef) + 0.5, y + 6.5, sx(A.lf) - sx(A.ef) - 1, alto - 13); ctx.setLineDash([]);
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(sx(A.es), y + 4, sx(A.ef) - sx(A.es), alto - 8, 4); ctx.fill();
        if (sx(A.ef) - sx(A.es) > 26) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.fillText(String(A.dur), (sx(A.es) + sx(A.ef)) / 2, y + alto / 2 + 1); }
        geo.push({ y0: y, y1: y + alto, id: b.id, txt: `<b>${b.id} · ${b.nombre}</b><br>semanas ${A.es} a ${A.ef} (duración ${A.dur})<br>${A.holgura > 1e-9 ? `holgura <b>${A.holgura}</b> sem: puede terminar hasta la semana ${A.lf}` : '<b>crítica</b>: cualquier atraso mueve el fin'}<br>${b.r} personas` });
      });
      const yb = top + 9 * alto + 2;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(izq, yb + 0.5); ctx.lineTo(W - der, yb + 0.5); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const t of VIZ.ticks(0, xmax, Math.max(3, Math.floor(W / 60)))) ctx.fillText(String(t), sx(t), yb + 5);
      ctx.textAlign = 'right'; ctx.fillText('semana', W - der, yb + 20);
      ctx.save(); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeStyle = C.apagado;
      ctx.beginPath(); ctx.moveTo(sx(r0.total), top); ctx.lineTo(sx(r0.total), yb); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(r1.total), top); ctx.lineTo(sx(r1.total), yb); ctx.stroke(); ctx.restore();

      const A0 = r0.acts.get(sel), cambio = r1.total - r0.total;
      let frase;
      if (eff === 0) frase = `${sel} dura lo planificado (${A0.dur} sem) y tiene holgura ${A0.holgura}. El proyecto termina en la semana ${r0.total}.`;
      else if (eff < 0) frase = cambio < 0
        ? `Acelerar ${sel} en ${-eff} sem acorta el proyecto en ${-cambio} sem${-cambio < -eff ? ': otra ruta se volvió crítica y limita el ahorro' : ''}.`
        : `Acelerar ${sel} no acorta el proyecto: ${A0.critica ? 'otra ruta crítica en paralelo lo impide' : `${sel} tiene holgura, no está en la ruta crítica`}. Se pagó la aceleración sin beneficio.`;
      else frase = cambio > 0
        ? `Retrasar ${sel} ${eff} sem atrasa el proyecto ${cambio} sem${cambio < eff ? ' (parte del atraso la absorbe la holgura de otra ruta)' : ''}.`
        : `Retrasar ${sel} ${eff} sem no mueve el fin: se consume holgura (de ${A0.holgura} queda ${r1.acts.get(sel).holgura}).`;
      registro.textContent = frase;
      const costo = eff < 0 ? -eff * COSTO_ACELERAR : 0;
      lectura.set([
        ['fin original → nuevo', `${r0.total} → ${r1.total} sem`],
        ['holgura de la actividad', `${A0.holgura} → ${r1.acts.get(sel).holgura} sem`],
        ['ruta crítica', camino(r1)],
        ['costo de acelerar', eff < 0 ? `${costo} mil` : '—'],
        ['costo por semana ganada', eff < 0 ? (cambio < 0 ? `${VIZ.fmt(costo / -cambio, 3)} mil` : 'sin semanas ganadas') : '—'],
      ]);
    }
    lienzo.alDibujar = () => plano && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { y } = lienzo.posicion(ev), g = geo.find((q) => y >= q.y0 && y < q.y1);
      if (!g) return;
      sel = g.id; selector.valor = sel; ajuste = 0; rA.valor = 0; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => y >= q.y0 && y < q.y1);
      if (g) tip.mostrar(x, y, g.txt); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: sobreasignación y nivelación ---------- */

  // Nivelación por semanas: cada semana empieza, por la regla de prioridad, las actividades listas que caben en la capacidad.
  function nivelar(cap, regla) {
    const acts = copia(), base = S.cpm(acts).acts, ini = {};
    const fin = (id) => ini[id] + base.get(id).dur;
    for (let t = 0; Object.keys(ini).length < acts.length && t < 300; t++) {
      const listas = acts.filter((a) => ini[a.id] === undefined && a.pre.every((p) => ini[p] !== undefined && fin(p) <= t));
      listas.sort((x, y) => (regla === 'ls' ? base.get(x.id).ls - base.get(y.id).ls : regla === 'dur' ? y.dur - x.dur : 0));
      let usado = acts.filter((a) => ini[a.id] !== undefined && ini[a.id] <= t && t < fin(a.id)).reduce((s, a) => s + a.r, 0);
      for (const a of listas) if (usado + a.r <= cap) { ini[a.id] = t; usado += a.r; }
    }
    return ini;
  }
  const demanda = (ini, w) => BASE.reduce((s, a) => s + (ini[a.id] !== undefined && ini[a.id] <= w && w < ini[a.id] + a.dur ? a.r : 0), 0);

  function montarNivelacion(cuerpo) {
    let cap = 5, regla = 'ls', t = -1, completo = {}, geo = null;
    const cpm0 = S.cpm(copia());
    const temprano = {}; cpm0.acts.forEach((a, id) => { temprano[id] = a.es; });
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Personas disponibles', min: 3, max: 8, valor: cap, formato: (v) => `${v} personas`, alCambiar: (v) => { cap = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Regla de prioridad', opciones: [['ls', 'menor holgura primero'], ['dur', 'más larga primero'], ['id', 'orden de la lista']], valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 9 * 18 + 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'actividad en su inicio temprano' }, { color: C.s4, texto: 'actividad desplazada' }, { color: C.apagado, texto: 'inicio temprano (sin nivelar)', forma: 'linea' },
      { color: C.s8, texto: 'semana sobreasignada' }, { color: C.tinta, texto: 'capacidad', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Arriba, el cronograma; abajo, las personas que exige cada semana. En rojo, las semanas que superan lo disponible. Con menos personas el proyecto se alarga; con 5 se logra nivelar sin cambiar el fin. Reproduzca para ver cómo cada semana se decide qué empezar. ${LISTA}.`);

    function iniciar() {
      completo = nivelar(cap, regla); t = -1;
      return (function* () { const fin = Math.max(...BASE.map((a) => completo[a.id] + a.dur)); while (t < fin) { t++; yield; } })();
    }
    const finDe = (ini) => Math.max(...BASE.map((a) => ini[a.id] + a.dur));

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const colocadas = {}; for (const a of BASE) if (t >= 0 && completo[a.id] <= t) colocadas[a.id] = completo[a.id];
      const inicio = t < 0 ? temprano : colocadas;
      const total = finDe(completo), xmax = Math.max(total, cpm0.total) + 1;
      const izq = 24, der = 10, sx = (w) => izq + (w / xmax) * (W - izq - der), fila = 18, topG = 4, topH = topG + 9 * fila + 22, altoH = 118;
      const demT = (w) => demanda(temprano, w);
      const dem = (w) => demanda(inicio, w);
      const ymax = Math.max(cap, ...Array.from({ length: Math.ceil(xmax) }, (_, w) => demT(w))) + 1;
      const sy = (v) => topH + altoH - (v / ymax) * altoH;
      geo = { sx, filas: [], cols: [], topH, altoH, xmax, sy };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      BASE.forEach((b, i) => {
        const y = topG + i * fila;
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(b.id, 6, y + fila / 2);
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.strokeRect(sx(temprano[b.id]) + 0.5, y + 3.5, sx(temprano[b.id] + b.dur) - sx(temprano[b.id]) - 1, fila - 7); ctx.setLineDash([]);
        if (inicio[b.id] !== undefined) {
          const desp = inicio[b.id] > temprano[b.id];
          ctx.fillStyle = desp ? C.s4 : C.s1; ctx.beginPath(); ctx.roundRect(sx(inicio[b.id]), y + 3, sx(inicio[b.id] + b.dur) - sx(inicio[b.id]), fila - 6, 3); ctx.fill();
        }
        geo.filas.push({ y0: y, y1: y + fila, txt: `<b>${b.id} · ${b.nombre}</b><br>${b.r} personas · ${b.dur} sem<br>inicio temprano: semana ${temprano[b.id]}<br>${inicio[b.id] !== undefined ? `inicio ${t < 0 ? 'actual' : 'nivelado'}: semana ${inicio[b.id]}${inicio[b.id] > temprano[b.id] ? ` (+${inicio[b.id] - temprano[b.id]})` : ''}` : 'aún sin programar'}` });
      });
      // Histograma de personas.
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const v of VIZ.ticks(0, ymax, 4)) { ctx.beginPath(); ctx.moveTo(izq, sy(v) + 0.5); ctx.lineTo(W - der, sy(v) + 0.5); ctx.stroke(); ctx.fillText(String(v), izq - 4, sy(v)); }
      for (let w = 0; w < Math.ceil(xmax); w++) {
        const d = dem(w), x = sx(w) + 1, ww = sx(w + 1) - sx(w) - 2;
        if (d > 0) { ctx.fillStyle = d > cap ? C.s8 : C.s1; ctx.beginPath(); ctx.roundRect(x, sy(d), ww, sy(0) - sy(d), [3, 3, 0, 0]); ctx.fill(); }
        const dt = demT(w);
        if (dt > 0) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 0.5, sy(dt) + 0.5, ww - 1, sy(0) - sy(dt) - 1); ctx.setLineDash([]); }
        geo.cols.push({ x0: sx(w), x1: sx(w + 1), txt: `<b>semana ${w + 1}</b><br>personas exigidas: <b>${d}</b> de ${cap}${d > cap ? ' (sobreasignada)' : ''}<br>sin nivelar: ${dt}` });
      }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(izq, sy(cap)); ctx.lineTo(W - der, sy(cap)); ctx.stroke();
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(izq, sy(0) + 0.5); ctx.lineTo(W - der, sy(0) + 0.5); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const w of VIZ.ticks(0, xmax, Math.max(3, Math.floor(W / 60)))) ctx.fillText(String(w), sx(w), sy(0) + 4);
      ctx.textAlign = 'right'; ctx.fillText('semana', W - der, sy(0) + 16);
      if (t >= 0) { ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(t), topG); ctx.lineTo(sx(t), sy(0)); ctx.stroke(); }

      const pico0 = Math.max(...Array.from({ length: cpm0.total }, (_, w) => demT(w)));
      const sobre0 = Array.from({ length: cpm0.total }, (_, w) => demT(w)).filter((v) => v > cap).length;
      const hecho = t >= finDe(completo) - 1e-9 && t >= 0;
      const picoN = Math.max(...Array.from({ length: Math.ceil(total) }, (_, w) => demanda(completo, w)));
      const empiezan = t >= 0 ? BASE.filter((a) => completo[a.id] === t) : [];
      registro.textContent = t < 0
        ? `Sin nivelar (inicios tempranos): el pico es ${pico0} personas y ${sobre0} semanas superan las ${cap} disponibles. Pulse «Un paso» para nivelar.`
        : hecho ? `Nivelado: el pico baja a ${picoN} personas (capacidad ${cap}) y el proyecto termina en la semana ${total}${total > cpm0.total ? `, ${total - cpm0.total} más que sin restricción` : ', sin atraso'}.`
          : empiezan.length ? `Semana ${t}: con ${cap} personas empiezan ${empiezan.map((a) => `${a.id} (${a.r} personas)`).join(' y ')}; las demás listas esperan por falta de gente.` : `Semana ${t}: no empieza ninguna actividad nueva (no hay actividades listas que quepan).`;
      lectura.set([
        ['capacidad', `${cap} personas`],
        ['pico sin nivelar', `${pico0} personas`],
        ['semanas sobreasignadas (sin nivelar)', String(sobre0)],
        ['pico nivelado', hecho ? `${picoN} personas` : t < 0 ? '—' : 'en curso'],
        ['fin del proyecto', hecho ? `${total} sem (antes ${cpm0.total})` : `${cpm0.total} sem sin restricción`],
      ]);
    }
    lienzo.alDibujar = () => geo && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const f = geo.filas.find((q) => y >= q.y0 && y < q.y1);
      const c = y >= geo.topH && y <= geo.topH + geo.altoH ? geo.cols.find((q) => x >= q.x0 && x < q.x1) : null;
      if (f) tip.mostrar(x, y, f.txt); else if (c) tip.mostrar(x, y, c.txt); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('schedules-resources', {
    intro: String.raw`
      <p>Un <strong>cronograma</strong> no es una lista de fechas: es una red de actividades con dependencias. De esa red se deduce cuáles actividades no admiten atraso (la <strong>ruta crítica</strong>), cuáles tienen
      <strong>holgura</strong> y cuándo termina el proyecto. Así un gerente sabe dónde vale la pena concentrar su atención y dinero.</p>
      <p>Pero el cronograma calculado supone gente infinita. En la práctica, las mismas personas están pedidas por varias actividades en la misma semana: hay <strong>sobreasignación</strong>. Nivelar los recursos
      desplaza actividades con holgura y, si no alcanza, alarga el proyecto.</p>`,
    visualizaciones: [
      {
        titulo: 'Red de actividades y ruta crítica',
        descripcion: 'Recorra el pase hacia adelante y el pase hacia atrás. Luego haga clic en una actividad no crítica y alárguela: no pasa nada hasta que consuma toda su holgura. Alargue una crítica y el proyecto se alarga igual.',
        montar: montarRed,
      },
      {
        titulo: 'Gantt, holgura y aceleración',
        descripcion: 'Acelere la integración (E) en una semana y luego en dos: ahorra una, pero no dos, porque aparece otra ruta crítica. Retrase la capacitación (H) hasta 9 semanas sin mover el fin.',
        montar: montarGantt,
      },
      {
        titulo: 'Sobreasignación y nivelación',
        descripcion: 'Con 8 personas nadie espera; baje a 5 y observe qué actividades se desplazan sin atrasar el fin; baje a 4 o 3 y vea cómo el proyecto se alarga. Compare las reglas de prioridad.',
        montar: montarNivelacion,
      },
    ],
    teoria: String.raw`
      <h2>Método de la ruta crítica (CPM)</h2>
      <p>Cada actividad \(i\) tiene una duración \(d_i\) y un conjunto de predecesoras \(P(i)\). El pase hacia adelante calcula los tiempos más tempranos:</p>
      \[ \mathrm{ES}_i = \max_{j \in P(i)} \mathrm{EF}_j \;(0 \text{ si no hay predecesoras}), \qquad \mathrm{EF}_i = \mathrm{ES}_i + d_i. \]
      <p>La duración del proyecto es \(T = \max_i \mathrm{EF}_i\). El pase hacia atrás calcula los tiempos más tardíos que no retrasan \(T\), con \(\mathrm{LF}_i = \min_{k:\, i \in P(k)} \mathrm{LS}_k\) (o \(T\) si no tiene sucesoras):</p>
      \[ \mathrm{LS}_i = \mathrm{LF}_i - d_i, \qquad \text{holgura}_i = \mathrm{LS}_i - \mathrm{ES}_i. \]
      <p>Las actividades con holgura cero forman la <em>ruta crítica</em>: es el camino más largo de la red. Es lo opuesto de lo que parece: no es la más «importante», sino la que no tiene margen.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> En el proyecto de la figura, el camino A → B → C → E → G → I suma \(3+4+5+4+3+2 = 21\) semanas: es la ruta crítica. La migración D (6 sem) termina en la semana 13 pero G no empieza hasta la 16, de modo que
      su holgura es 3. Reportes (F) tiene 1 y capacitación (H), 9. Si se acelera E de 4 a 3 semanas, la ruta por F también suma \(3+4+5+3+3+2 = 20\): ahora hay dos rutas críticas y acelerar E otra vez ya no ahorra nada.</p></div>
      <h2>Gantt y holgura</h2>
      <p>El diagrama de Gantt dibuja cada actividad como una barra desde su inicio hasta su fin; la holgura es el tramo en que la barra podría deslizarse. Un atraso menor que la holgura no cambia el fin; uno mayor se traspasa al proyecto
      por la cantidad excedida. <em>Acelerar</em> (<em>crashing</em>) cuesta dinero y solo conviene en actividades críticas, y mientras no aparezcan rutas paralelas igual de largas; el costo por semana ganada sube cuando eso ocurre.</p>
      <h2>Recursos y nivelación</h2>
      <p>Si la actividad \(i\) requiere \(r_i\) personas, la demanda de la semana \(w\) es \(D(w) = \sum_{i \text{ activa en } w} r_i\). Hay sobreasignación cuando \(D(w) > R\) con \(R\) la capacidad. La nivelación programa semana a semana,
      empezando las actividades listas por orden de prioridad mientras quepan:</p>
      <pre><code>t ← 0
mientras queden actividades sin programar:
    listas ← actividades con todas sus predecesoras terminadas en t
    ordenar listas por prioridad (menor holgura primero)
    para cada a en listas:
        si usado(t) + r[a] &lt;= R:  iniciar a en t
    t ← t + 1</code></pre>
      <p>Con la regla de menor holgura, el proyecto de la figura, con 3 personas, termina en 33 semanas; con 4, en 26; con 5 o más, en las 21 semanas originales: nivelar solo
      desplazó actividades con holgura. Es una heurística: encontrar el cronograma óptimo con recursos limitados es un problema difícil (NP-duro), y distintas reglas de prioridad pueden dar duraciones distintas.</p>
      <h2>Conexiones</h2>
      <p>El cronograma resultante es una de las líneas base del <a href="tema.html?id=project-lifecycle">ciclo de vida</a>; su avance se mide con el <a href="tema.html?id=triple-constraint">valor ganado</a> y su compromiso entre tiempo y costo
      aparece en la <a href="tema.html?id=triple-constraint">triple restricción</a>. Los retrasos probables se tratan como riesgos en <a href="tema.html?id=project-risks-stakeholders">riesgos e interesados</a>. Los métodos ágiles reemplazan
      esta planificación detallada por ciclos cortos: ver <a href="tema.html?id=scrum">Scrum</a>. La misma lógica de camino más largo sirve para las <a href="tema.html?id=process-simulation">simulaciones de procesos</a>.</p>`,
  });
})();
