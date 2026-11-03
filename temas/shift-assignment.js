(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = 5, D = 7, S = 3;
  const NOMBRE = ['Ana', 'Beto', 'Carla', 'Diego', 'Elena'];
  const DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const TURNO = ['—', 'M', 'T', 'N'], TXT = ['libre', 'mañana 06–14', 'tarde 14–22', 'noche 22–06'];
  const COL = [C.inactivo, C.s1, C.s2, C.s3];

  // Preferencias: costo (1 a 9) de que la persona p haga el turno s el día d.
  function costos(semilla) {
    const rnd = VIZ.semilla(semilla * 83 + 29);
    return Array.from({ length: P }, () => Array.from({ length: D }, () => Array.from({ length: S }, () => 1 + Math.floor(rnd() * 9))));
  }
  // Un día se cubre con una persona distinta por turno (cobertura exacta de 1): 5·4·3 = 60 opciones.
  const OPC = [];
  for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) for (let c = 0; c < P; c++) if (a !== b && b !== c && a !== c) OPC.push([a, b, c]);
  const OPT = OPC.map((o) => Array.from({ length: P }, (_, p) => o.indexOf(p) + 1)); // turno de cada persona (0 = libre)
  // Descanso de 11 h: no se puede pasar a un turno anterior en el reloj al día siguiente (T→M, N→M, N→T).
  const choque = (a, b) => a > 0 && b > 0 && b < a;
  const COMPAT = OPC.map((_, i) => OPC.map((__, j) => OPT[i].every((a, p) => !choque(a, OPT[j][p]))));
  const POT = Array.from({ length: P }, (_, p) => Math.pow(8, p));
  const INCR = OPC.map((o) => o.reduce((s, p) => s + POT[p], 0));

  // Programación dinámica por días: el estado es (turnos acumulados por persona, opción del día anterior).
  function resolver(cost, tope, descanso) {
    const nOp = OPC.length, M = nOp + 1;
    let cur = new Map([[0, { c: 0, pa: -1 }]]);
    const hist = [];
    for (let d = 0; d < D; d++) {
      const co = OPC.map((o) => o.reduce((s, p, k) => s + cost[p][d][k], 0)), nxt = new Map();
      for (const [key, v] of cur) {
        const prev = key % M - 1, cuentas = Math.floor(key / M);
        for (let j = 0; j < nOp; j++) {
          if (descanso && prev >= 0 && !COMPAT[prev][j]) continue;
          let ok = true;
          for (let p = 0; p < P; p++) if (OPT[j][p] && Math.floor(cuentas / POT[p]) % 8 + 1 > tope) { ok = false; break; }
          if (!ok) continue;
          const nk = (cuentas + INCR[j]) * M + j + 1, c = v.c + co[j], e = nxt.get(nk);
          if (!e || c < e.c) nxt.set(nk, { c, pa: key });
        }
      }
      hist.push(nxt); cur = nxt;
    }
    let mejor = null, kb = null;
    for (const [k, v] of cur) if (!mejor || v.c < mejor.c) { mejor = v; kb = k; }
    if (!mejor) return null;
    const plan = []; let k = kb;
    for (let d = D - 1; d >= 0; d--) { plan[d] = k % M - 1; k = hist[d].get(k).pa; }
    const asig = Array.from({ length: P }, (_, p) => plan.map((op) => OPT[op][p]));
    return { costo: mejor.c, asig };
  }
  const vacio = () => Array.from({ length: P }, () => Array(D).fill(0));
  const rotacion = (sentido) => { // sentido +1: M→T→N a lo largo de los días (válida); −1: N→T→M (viola el descanso)
    const a = vacio();
    for (let d = 0; d < D; d++) for (let s = 0; s < S; s++) { const p = (((sentido > 0 ? d - s : d + s) % P) + P) % P; a[p][d] = s + 1; }
    return a;
  };
  function evaluar(asig, cost, tope) {
    let costo = 0, huecos = 0, viol = 0;
    const cob = Array.from({ length: S }, () => Array(D).fill(0)), carga = Array(P).fill(0), mal = vacio();
    for (let p = 0; p < P; p++) for (let d = 0; d < D; d++) {
      const s = asig[p][d];
      if (s) { costo += cost[p][d][s - 1]; cob[s - 1][d]++; carga[p]++; }
      if (d + 1 < D && choque(s, asig[p][d + 1])) { viol++; mal[p][d] = 1; mal[p][d + 1] = 1; }
    }
    cob.forEach((f) => f.forEach((v) => { if (v < 1) huecos++; }));
    const exceso = carga.reduce((s, v) => s + Math.max(0, v - tope), 0);
    return { costo, huecos, viol, cob, carga, mal, exceso };
  }

  /* ---------- Fig. 1: la tabla de turnos ---------- */

  function montarTabla(cuerpo) {
    let semilla = 1, tope = 5, descanso = true, cost = costos(semilla), asig = vacio(), opt = null, mensaje = '', geo = null;
    const recalcular = () => { opt = resolver(cost, tope, descanso); };
    recalcular();

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Turnos máximos por persona', min: 4, max: 7, valor: tope, alCambiar: (v) => { tope = v; recalcular(); mensaje = ''; dibujar(); } });
    ctl.casilla({ etiqueta: 'Exigir descanso (sin T→M, N→M ni N→T)', valor: descanso, alCambiar: (v) => { descanso = v; recalcular(); mensaje = ''; dibujar(); } });
    ctl.boton('Asignar el óptimo', () => {
      if (!opt) { mensaje = `No existe ninguna asignación factible con ${tope} turnos máximos: 5 personas × ${tope} = ${P * tope} < 21 turnos por cubrir.`; return dibujar(); }
      asig = opt.asig.map((f) => f.slice()); mensaje = 'Asignación de costo mínimo calculada por programación dinámica por días.'; dibujar();
    }, { primario: true });
    ctl.boton('Rotación hacia adelante', () => { asig = rotacion(1); mensaje = 'Rotación M → T → N a lo largo de los días: cumple el descanso, pero ignora las preferencias.'; dibujar(); });
    ctl.boton('Rotación ingenua', () => { asig = rotacion(-1); mensaje = 'Rotación N → T → M: cubre todo, pero cada persona pasa a un turno que empieza antes de descansar 11 h.'; dibujar(); });
    ctl.boton('Vaciar', () => { asig = vacio(); mensaje = 'Tabla vacía.'; dibujar(); });
    ctl.boton('Nuevas preferencias', () => { semilla++; cost = costos(semilla); recalcular(); mensaje = ''; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 22 + P * 36 + 14 + S * 26 + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'M mañana 06–14' },
      { color: C.s2, texto: 'T tarde 14–22' },
      { color: C.s3, texto: 'N noche 22–06' },
      { color: C.sobre, borde: C.s8, texto: 'descanso insuficiente' },
      { color: C.s8, texto: 'turno sin cubrir' },
      { color: C.s6, texto: 'turno cubierto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda para recorrer libre → M → T → N. Cada turno de cada día necesita al menos una persona (cobertura mínima 1). El número pequeño de cada celda es el costo de esa preferencia.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ev = evaluar(asig, cost, tope), L = 78, cw = (W - L - 2) / D, ch = 36, top = 22;
      geo = { L, cw, ch, top };
      ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.apagado;
      DIA.forEach((n, d) => ctx.fillText(n, L + (d + 0.5) * cw, 10));
      for (let p = 0; p < P; p++) {
        const y = top + p * ch;
        ctx.textAlign = 'left'; ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = ev.carga[p] > tope ? C.s8 : C.tinta; ctx.fillText(NOMBRE[p], 2, y + ch / 2 - 7);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = ev.carga[p] > tope ? C.s8 : C.tinta2; ctx.fillText(`${ev.carga[p]} / ${tope} turnos`, 2, y + ch / 2 + 8);
        for (let d = 0; d < D; d++) {
          const x = L + d * cw, s = asig[p][d];
          ctx.fillStyle = s ? COL[s] : C.superficie; ctx.strokeStyle = s ? COL[s] : C.rejilla; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 5); ctx.fill(); ctx.stroke();
          if (ev.mal[p][d]) { ctx.strokeStyle = C.s8; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, cw - 3, ch - 3, 6); ctx.stroke(); }
          ctx.textAlign = 'center'; ctx.fillStyle = s ? C.sobre : C.inactivo; ctx.font = VIZ.fuente(13, 600); ctx.fillText(TURNO[s], x + cw / 2, y + ch / 2 - 1);
          if (s) { ctx.font = VIZ.fuente(9); ctx.textAlign = 'right'; ctx.fillStyle = C.sobre; ctx.fillText(String(cost[p][d][s - 1]), x + cw - 6, y + ch - 9); }
        }
      }
      const y0 = top + P * ch + 14;
      for (let s = 0; s < S; s++) {
        const y = y0 + s * 26;
        ctx.textAlign = 'left'; ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'middle'; ctx.fillText(`cobertura ${TURNO[s + 1]}`, 2, y + 11);
        for (let d = 0; d < D; d++) {
          const n = ev.cob[s][d], x = L + d * cw;
          if (n < 1) { ctx.fillStyle = VIZ.alfa(C.s8, 0.14); ctx.fillRect(x + 2, y, cw - 4, 22); }
          ctx.fillStyle = n < 1 ? C.s8 : n === 1 ? C.s6 : C.tinta2; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.fillText(String(n), x + cw / 2, y + 11);
        }
      }
      const cMin = Math.min(...ev.carga), cMax = Math.max(...ev.carga);
      registro.textContent = mensaje || (ev.huecos ? `Faltan ${ev.huecos} turnos por cubrir de 21.` : ev.viol ? `${ev.viol} transiciones sin descanso suficiente.` : 'Asignación factible.');
      const problemas = ev.huecos + (descanso ? ev.viol : 0) + ev.exceso;
      lectura.set([
        ['turnos cubiertos', `${S * D - ev.huecos} / ${S * D}`],
        ['descansos violados', descanso ? String(ev.viol) : `${ev.viol} (regla desactivada)`],
        ['carga mín–máx', `${cMin}–${cMax} turnos`],
        ['costo de preferencias', `${ev.costo}${problemas ? ' (infactible)' : ''}`],
        ['costo óptimo', opt ? String(opt.costo) : 'sin solución factible'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const celda = (e) => {
      const { x, y } = lienzo.posicion(e);
      const d = Math.floor((x - geo.L) / geo.cw), p = Math.floor((y - geo.top) / geo.ch);
      return d >= 0 && d < D && p >= 0 && p < P ? [p, d] : null;
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => {
      const c = celda(e); if (!c) return;
      const [p, d] = c; asig[p][d] = (asig[p][d] + 1) % 4;
      mensaje = `${NOMBRE[p]}, ${DIA[d]}: ${TXT[asig[p][d]]}.`;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const c = celda(e); if (!c) return tip.ocultar();
      const [p, d] = c, { x, y } = lienzo.posicion(e);
      tip.mostrar(x, y, `<b>${NOMBRE[p]}</b>, ${DIA[d]}<br>ahora: <b>${TXT[asig[p][d]]}</b><br>costo M <b>${cost[p][d][0]}</b> · T <b>${cost[p][d][1]}</b> · N <b>${cost[p][d][2]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: factibilidad frente a costo ---------- */

  function montarCosto(cuerpo) {
    let semilla = 1, cost = costos(semilla), sel = 5, pl = null, cache = {}, token = 0, hover = -1;
    const TOPES = [4, 5, 6, 7];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Nuevas preferencias', () => { semilla++; cost = costos(semilla); calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 320, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'con regla de descanso' },
      { color: C.s3, texto: 'sin regla de descanso' },
      { color: C.s8, texto: 'infactible' },
      { color: C.s6, texto: 'turnos de cada persona (tope elegido)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada grupo de barras es un tope de turnos por persona; haga clic en uno para ver la carga de cada persona en su solución óptima. Con tope 4 no alcanzan 5 × 4 = 20 turnos para cubrir los 21.');

    const clave = (t, r) => `${t}-${r ? 1 : 0}`;
    // Resuelve los ocho problemas de uno en uno para no congelar la página.
    function calcular() {
      cache = {}; const mi = ++token, cola = [];
      TOPES.forEach((t) => [true, false].forEach((r) => cola.push([t, r])));
      registro.textContent = 'Resolviendo los 8 problemas por programación dinámica…';
      dibujar();
      (function paso() {
        if (mi !== token) return;
        const it = cola.shift();
        if (!it) return dibujar();
        cache[clave(...it)] = { r: resolver(cost, it[0], it[1]) };
        dibujar(); setTimeout(paso, 0);
      })();
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const vals = Object.values(cache).filter((q) => q.r).map((q) => q.r.costo);
      const ymax = Math.max(40, ...vals) * 1.25, ymin = 0;
      pl = VIZ.plano(lienzo, { xmin: 3.5, xmax: 7.5, ymin, ymax }, { etiquetaX: 'turnos máximos por persona', etiquetaY: 'costo de preferencias', ticksX: TOPES, formatoX: (v) => String(v), margen: { inf: 90 } });
      pl.ejes();
      const w = (pl.sx(5) - pl.sx(4)) * 0.3;
      TOPES.forEach((t) => {
        const xc = pl.sx(t);
        if (t === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(xc - w * 1.25, pl.y1, w * 2.5, pl.y0 - pl.y1); }
        if (t === sel) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(xc - w * 1.25, pl.y1, w * 2.5, pl.y0 - pl.y1); }
        [true, false].forEach((r, k) => {
          const q = cache[clave(t, r)], x0 = xc + (k ? 0 : -w);
          if (!q) return;
          if (!q.r) {
            ctx.strokeStyle = C.s8; ctx.lineWidth = 2.5; ctx.beginPath();
            ctx.moveTo(x0 + w * 0.2, pl.y0 - 18); ctx.lineTo(x0 + w * 0.8, pl.y0 - 4); ctx.moveTo(x0 + w * 0.8, pl.y0 - 18); ctx.lineTo(x0 + w * 0.2, pl.y0 - 4); ctx.stroke();
            return;
          }
          const y = pl.sy(q.r.costo);
          ctx.fillStyle = r ? C.s1 : C.s3; ctx.beginPath(); ctx.roundRect(x0 + 1, y, w - 2, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(q.r.costo), x0 + w / 2, y - 3);
        });
      });
      // Carga por persona del tope elegido (con descanso).
      const q = cache[clave(sel, true)], yb = pl.y0 + 34;
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2;
      const sx = (v) => pl.x0 + (v / 7) * (pl.x1 - pl.x0), fila = 9;
      for (let p = 0; p < P; p++) {
        const y = yb + p * fila;
        if (q && q.r) {
          const n = q.r.asig[p].filter(Boolean).length;
          ctx.fillStyle = C.s6; ctx.fillRect(pl.x0, y, sx(n) - pl.x0, fila - 2);
        }
      }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(sel), yb - 3); ctx.lineTo(sx(sel), yb + P * fila + 1); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(q && q.r ? 'carga' : '', pl.x0 - 6, yb + 22);
      ctx.textAlign = 'center'; ctx.fillText('tope', sx(sel), yb - 9);

      const a = cache[clave(sel, true)], b = cache[clave(sel, false)];
      if (a && b) {
        registro.textContent = a.r ? `Con tope ${sel}: costo ${a.r.costo} cumpliendo el descanso y ${b.r ? b.r.costo : '—'} sin exigirlo.` : `Con tope ${sel} no existe ningún calendario que cubra los 21 turnos.`;
        lectura.set([
          ['tope de turnos', String(sel)],
          ['costo con descanso', a.r ? String(a.r.costo) : 'infactible'],
          ['costo sin descanso', b.r ? String(b.r.costo) : 'infactible'],
          ['costo de exigir el descanso', a.r && b.r ? String(a.r.costo - b.r.costo) : '—'],
          ['carga por persona', a.r ? a.r.asig.map((f) => f.filter(Boolean).length).join(' · ') : '—'],
        ]);
      }
    }
    lienzo.alDibujar = dibujar;

    const grupo = (x, y) => { if (!pl) return -1; const t = Math.round(pl.ix(x)); return TOPES.includes(t) && Math.abs(x - pl.sx(t)) < (pl.sx(5) - pl.sx(4)) * 0.38 && y > pl.y1 && y < pl.y0 ? t : -1; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => { const { x, y } = lienzo.posicion(e), t = grupo(x, y); if (t > 0) { sel = t; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), t = grupo(x, y);
      if (t !== hover) { hover = t; dibujar(); }
      if (t < 0) return tip.ocultar();
      const a = cache[clave(t, true)], b = cache[clave(t, false)];
      tip.mostrar(x, y, `tope <b>${t}</b> turnos<br>${VIZ.filaTooltip(C.s1, 'con descanso', a ? (a.r ? a.r.costo : 'infactible') : '…')}${VIZ.filaTooltip(C.s3, 'sin descanso', b ? (b.r ? b.r.costo : 'infactible') : '…')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('shift-assignment', {
    intro: String.raw`
      <p>Un hospital, una planta o una tienda necesitan que haya gente en cada turno de cada día. Cada persona puede hacer a lo sumo un turno diario, necesita descansar entre jornadas y tiene preferencias; la
      pregunta es <strong>quién hace qué turno</strong>. La decisión básica es una variable binaria por cada persona, día y turno: «¿trabaja o no?».</p>
      <p>Aquí lo interesante es la diferencia entre <em>factible</em> y <em>bueno</em>. Primero hay que cumplir la cobertura y las reglas de descanso; solo entre los calendarios que las cumplen se compara el costo de las preferencias. Y a veces no hay ninguno: con muy pocos turnos por persona, ningún calendario cubre todo.</p>`,
    visualizaciones: [
      {
        titulo: 'Tabla de turnos de la semana',
        descripcion: 'Pinte turnos con clic y vea la cobertura de cada día; luego pulse «Rotación ingenua» y compárela con «Rotación hacia adelante». Baje el tope de turnos hasta 4: el óptimo deja de existir.',
        montar: montarTabla,
      },
      {
        titulo: 'Qué cuestan el descanso y la carga',
        descripcion: 'Compare, para cada tope de turnos por persona, el costo óptimo con y sin la regla de descanso. Un tope de 4 es infactible, y la regla de descanso casi siempre encarece la solución.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Modelo con binarias persona × día × turno</h2>
      <p>Sea \(x_{pds} = 1\) si la persona \(p\) hace el turno \(s \in \{M, T, N\}\) el día \(d\), y \(c_{pds}\) el costo (o penalización de preferencia) de esa asignación. Con cobertura mínima \(r_{ds}\) y tope semanal \(U\):</p>
      \[
      \begin{aligned}
      \min\ & \sum_{p,d,s} c_{pds}\, x_{pds} \\
      \text{s.a. } & \sum_{p} x_{pds} \ge r_{ds} && \forall d, s \quad \text{(cobertura)} \\
      & \sum_{s} x_{pds} \le 1 && \forall p, d \quad \text{(un turno por día)} \\
      & x_{p,T,d} + x_{p,M,d+1} \le 1, \quad x_{p,N,d} + x_{p,M,d+1} \le 1, \quad x_{p,N,d} + x_{p,T,d+1} \le 1 && \text{(descanso de 11 h)} \\
      & \sum_{d,s} x_{pds} \le U && \forall p \quad \text{(carga máxima)} \\
      & x_{pds} \in \{0,1\}.
      \end{aligned}
      \]
      <p>Los turnos duran 8 horas: M 06–14, T 14–22 y N 22–06. Pasar de T a M del día siguiente deja 8 h libres, y de N a M o T, entre 0 y 8 h; en cambio M → cualquiera, T → N y N → N sí respetan las 11 h. Cada desigualdad de descanso es del tipo «a lo más una de dos» y es la forma lineal de decir «no ambas».</p>

      <h2>Factibilidad frente a optimalidad</h2>
      <p>Antes de optimizar hay que saber si existe un calendario válido. Por simple conteo, hacen falta \(\sum r_{ds} = 21\) turnos y cada persona aporta a lo más \(U\), así que se necesita \(P \cdot U \ge 21\): con \(P = 5\) personas, \(U = 4\) da 20 y es imposible, mientras que \(U = 5\) pasa la prueba. La regla de descanso restringe más y puede volver infactible un problema que el conteo aprobó.
      Agregar restricciones nunca baja el costo óptimo: el conjunto factible se achica.</p>

      <h2>Programación dinámica por días</h2>
      <p>Con cobertura exacta de un turno por franja, cada día tiene \(5 \cdot 4 \cdot 3 = 60\) maneras de repartir M, T y N entre personas distintas. La figura avanza día a día con el estado «turnos acumulados por persona + reparto del día anterior», lo que permite aplicar el descanso (depende solo del día anterior) y el tope \(U\) (depende de los acumulados):</p>
      <pre><code>estados ← { (acumulados = 0, anterior = ninguno): costo 0 }
para d ← 1 hasta 7:
    para cada estado (a, r) y cada reparto j del día d:
        si el descanso entre r y j falla: continuar
        si algún acumulado de a + j supera U: continuar
        mejorar el estado (a + j, j) con costo + costo(j, d)
devolver el estado final de menor costo</code></pre>
      <p>El número de estados crece rápido con más personas o más reglas: con \(P\) personas los acumulados forman \((U+1)^P\) combinaciones. Para plantillas reales se usa
      <a href="tema.html?id=milp-branch-and-bound">ramificación y acotamiento</a> o generación de columnas (cada columna es el calendario de una persona).</p>

      <h2>Carga justa</h2>
      <p>El tope \(U\) es la forma más simple de equidad. Un modelo más fino minimiza la carga máxima: se introduce \(z \ge \sum_{d,s} x_{pds}\) para todo \(p\) y se minimiza \(z\) (o \(z\) más el costo con un peso). Como muestra la segunda figura, repartir más parejo cuesta algo en preferencias: es el conflicto típico entre eficiencia y equidad.
      Es un caso de asignación como el de <a href="tema.html?id=transportation-problem">transporte</a>, al que se suman reglas temporales que rompen su estructura de red y obligan a usar variables enteras.</p>`,
  });
})();
