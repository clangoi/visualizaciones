(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos compartidos ---------- */

  const TODOS = Object.values(P.personas).flat();
  const ROL_DE = {};
  for (const [r, ps] of Object.entries(P.personas)) ps.forEach((p) => { ROL_DE[p] = r; });
  const COLOR_ROL = { ventas: C.s1, bodega: C.s2, finanzas: C.s3, soporte: C.s4, gerencia: C.s5 };
  const PROCESOS = [['pedidos', 'Gestión de pedidos'], ['reclamos', 'Atención de reclamos']];

  function crearLog(proc, n, semilla, poliv) {
    const log = P.simular(P.procesos[proc].arbol, n, semilla);
    const rnd = VIZ.semilla(semilla * 97 + 5);
    for (const c of log) for (const e of c.eventos) if (rnd() < poliv) e.recurso = TODOS[Math.floor(rnd() * TODOS.length)];
    return log;
  }
  const personasDe = (log) => { const s = new Set(log.flatMap((c) => c.eventos.map((e) => e.recurso))); return TODOS.filter((p) => s.has(p)); };
  function posCircular(ids) {
    const pos = {};
    ids.forEach((id, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length; pos[id] = { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) }; });
    return pos;
  }

  /* ---------- Fig. 1: trabajo conjunto ---------- */

  function montarConjunto(cuerpo) {
    let proc = 'reclamos', n = 150, poliv = 0, semilla = 1, metrica = 'casos', sel = null, hover = null;
    let pers = [], conj = [], D = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 30, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; calcular(); } });
    ctl.selector({ etiqueta: 'Medida', opciones: [['casos', 'Casos compartidos'], ['jaccard', 'Jaccard: compartidos / unión']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const TOP = 54, IZQ = 66;
    const celda = () => Math.max(26, Math.min(44, (lienzo.ancho - IZQ - 8) / Math.max(1, pers.length)));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => TOP + Math.max(26, Math.min(44, (w - IZQ - 8) / Math.max(1, pers.length))) * Math.max(1, pers.length) + 10 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...Object.keys(COLOR_ROL).map((r) => ({ color: COLOR_ROL[r], texto: `rol ${r} (cuadro junto al nombre)` })),
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'participan juntos en pocos casos' },
      { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'participan juntos en muchos casos' },
      { color: C.neutro, texto: 'nunca coinciden', borde: C.rejilla },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda para ver cuántos casos comparten esas dos personas y ejemplos. La diagonal es el número de casos de cada persona. Con «Jaccard» se corrige el efecto de quienes participan en casi todo.');

    function calcular() {
      const log = crearLog(proc, n, semilla, poliv);
      pers = personasDe(log);
      const sets = pers.map(() => new Set());
      log.forEach((c, k) => c.eventos.forEach((e) => sets[pers.indexOf(e.recurso)].add(k)));
      conj = pers.map((_, i) => pers.map((__, j) => { let s = 0; for (const k of sets[i]) if (sets[j].has(k)) s++; return s; }));
      D = { log, sets };
      sel = null;
      lienzo.ajustar(true);
    }

    const valor = (i, j) => {
      if (metrica === 'casos') return conj[i][j];
      const u = conj[i][i] + conj[j][j] - conj[i][j];
      return u ? conj[i][j] / u : 0;
    };
    const txt = (v) => (metrica === 'casos' ? String(v) : VIZ.fmt(v, 2));

    function dibujar() {
      if (!D) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const N = pers.length, w = celda();
      let max = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) max = Math.max(max, valor(i, j));
      if (metrica === 'casos') for (let i = 0; i < N; i++) max = Math.max(max, conj[i][i]);
      max = max || 1;
      ctx.textBaseline = 'middle';
      pers.forEach((p, k) => {
        ctx.save();
        ctx.translate(IZQ + (k + 0.5) * w, TOP - 6);
        ctx.rotate(-Math.PI / 4);
        ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left';
        ctx.fillText(p, 0, 0);
        ctx.restore();
        ctx.fillStyle = COLOR_ROL[ROL_DE[p]];
        ctx.fillRect(4, TOP + k * w + w / 2 - 5, 10, 10);
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(p, 20, TOP + k * w + w / 2);
      });
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const diag = i === j;
        const v = diag ? conj[i][i] : valor(i, j);
        const t = diag ? (metrica === 'casos' ? v / max : 1) : v / max;
        ctx.fillStyle = diag && metrica !== 'casos' ? C.fondo2 : v ? VIZ.css(VIZ.enRampa(0.12 + 0.88 * t)) : C.neutro;
        ctx.fillRect(IZQ + j * w + 1, TOP + i * w + 1, w - 2, w - 2);
        if (w >= 30 && (v || diag)) {
          ctx.font = VIZ.fuente(10, diag ? 700 : 500); ctx.textAlign = 'center';
          ctx.fillStyle = !(diag && metrica !== 'casos') && t > 0.55 ? C.sobre : C.tinta;
          ctx.fillText(diag ? String(conj[i][i]) : txt(v), IZQ + (j + 0.5) * w, TOP + (i + 0.5) * w);
        }
      }
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.s2;
      if (sel) { ctx.strokeRect(IZQ + sel.j * w + 1, TOP + sel.i * w + 1, w - 2, w - 2); ctx.strokeRect(IZQ + sel.i * w + 1, TOP + sel.j * w + 1, w - 2, w - 2); }
      if (hover) { ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.strokeRect(IZQ + hover.j * w + 1, TOP + hover.i * w + 1, w - 2, w - 2); }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      let mejor = null, suma = 0, pares = 0, cero = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        pares++; suma += conj[i][j]; if (!conj[i][j]) cero++;
        if (!mejor || valor(i, j) > mejor[0]) mejor = [valor(i, j), i, j];
      }
      lectura.set([
        ['personas', String(N)],
        ['casos', String(D.log.length)],
        ['pares que nunca coinciden', `${cero} de ${pares}`],
        ['personas por caso (media)', VIZ.fmt(D.sets.reduce((s, x) => s + x.size, 0) / D.log.length, 3)],
        ['pareja más unida', mejor ? `${pers[mejor[1]]} y ${pers[mejor[2]]} (${txt(mejor[0])})` : '—'],
      ]);
      if (sel) {
        const a = pers[sel.i], b = pers[sel.j];
        if (sel.i === sel.j) registro.textContent = `${a} participó en ${conj[sel.i][sel.i]} de ${D.log.length} casos.`;
        else {
          const ej = [...D.sets[sel.i]].filter((k) => D.sets[sel.j].has(k)).slice(0, 5).map((k) => D.log[k].id).join(', ');
          registro.textContent = `${a} y ${b} coinciden en ${conj[sel.i][sel.j]} casos (${Math.round(100 * conj[sel.i][sel.j] / Math.max(1, conj[sel.i][sel.i]))} % de los de ${a}, ${Math.round(100 * conj[sel.i][sel.j] / Math.max(1, conj[sel.j][sel.j]))} % de los de ${b}). ${ej ? 'Por ejemplo: ' + ej + '.' : 'Nunca trabajan en el mismo caso.'}`;
        }
      } else registro.textContent = 'Cada celda cuenta los casos en que las dos personas ejecutan al menos una actividad. La matriz es simétrica.';
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    const celdaEn = (ev) => {
      const { x, y } = lienzo.posicion(ev), w = celda();
      const j = Math.floor((x - IZQ) / w), i = Math.floor((y - TOP) / w);
      return { x, y, c: j >= 0 && j < pers.length && i >= 0 && i < pers.length ? { i, j } : null };
    };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!D) return;
      const { x, y, c } = celdaEn(ev);
      if (!c) { if (hover) { hover = null; dibujar(); } return tip.ocultar(); }
      if (!hover || hover.i !== c.i || hover.j !== c.j) { hover = c; dibujar(); }
      const a = pers[c.i], b = pers[c.j];
      tip.mostrar(x, y, c.i === c.j ? `<b>${a}</b> · ${ROL_DE[a]}${VIZ.filaTooltip(C.s1, 'casos en que participa', String(conj[c.i][c.i]))}`
        : `<b>${a}</b> y <b>${b}</b>` + VIZ.filaTooltip(C.s1, 'casos compartidos', String(conj[c.i][c.j])) + VIZ.filaTooltip(C.s2, 'Jaccard', VIZ.fmt(conj[c.i][c.j] / (conj[c.i][c.i] + conj[c.j][c.j] - conj[c.i][c.j] || 1), 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { c } = celdaEn(ev);
      sel = c && !(sel && sel.i === c.i && sel.j === c.j) ? c : null;
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 2: subcontratación ---------- */

  function montarSubcontratacion(cuerpo) {
    let proc = 'reclamos', casos = 12, poliv = 0.1, distinto = false, semilla = 1;
    let log = [], pers = [], S = [], ci = 0, pos = 0, hechos = 0, ventanas = 0, ultimo = null, msg = '', hover = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Casos', min: 4, max: 60, paso: 2, valor: casos, alCambiar: (v) => { casos = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Solo si «b» es de otro rol', valor: distinto, alCambiar: (v) => { distinto = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const trazaCaja = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(trazaCaja);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'subcontratación recién detectada', forma: 'linea' },
      { color: C.s1, texto: 'subcontrataciones acumuladas (grosor = veces)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La ventana de tres eventos se desliza por cada caso: si el primero y el tercero los ejecuta la misma persona y el del medio otra, la flecha p → q suma uno. Pase el cursor sobre una persona para ver cuánto subcontrata y cuánto le subcontratan.');

    function iniciar() {
      log = crearLog(proc, casos, semilla, poliv);
      pers = personasDe(log);
      S = pers.map(() => pers.map(() => 0));
      ci = 0; pos = 0; hechos = 0; ventanas = 0; ultimo = null;
      msg = 'La ventana de tres eventos aún no empezó. Pulse «Un paso».';
      return (function* () {
        for (ci = 0; ci < log.length; ci++) {
          const E = log[ci].eventos;
          for (pos = 0; pos + 2 < E.length; pos++) {
            ventanas++;
            const a = E[pos].recurso, b = E[pos + 1].recurso, c = E[pos + 2].recurso;
            const ok = a === c && a !== b && (!distinto || ROL_DE[a] !== ROL_DE[b]);
            ultimo = null;
            if (ok) {
              S[pers.indexOf(a)][pers.indexOf(b)]++; hechos++; ultimo = [a, b];
              msg = `${log[ci].id}: ${a}, ${b}, ${a} → ${a} subcontrata a ${b} («${E[pos + 1].act}»).`;
            } else if (a === c && a === b) msg = `${log[ci].id}: ${a} hace los tres eventos seguidos; no hay subcontratación.`;
            else if (a === c && distinto && ROL_DE[a] === ROL_DE[b]) msg = `${log[ci].id}: ${a}, ${b}, ${a}, pero ${b} tiene el mismo rol (${ROL_DE[a]}); se descarta.`;
            else msg = `${log[ci].id}: ${a}, ${b}, ${c}: los extremos no coinciden; no se cuenta.`;
            yield;
          }
        }
        ci = log.length - 1; pos = -1; ultimo = null;
        msg = `Terminado: ${hechos} subcontrataciones en ${ventanas} ventanas de tres eventos.`;
      })();
    }

    function dibujar() {
      if (!pers.length) return;
      const c = log[Math.min(ci, log.length - 1)];
      trazaCaja.replaceChildren(...c.eventos.map((e, k) => VIZ.el('div', { class: pos >= 0 && k >= pos && k <= pos + 2 ? 'activa' : '' }, `${c.id} · ${k + 1}. ${e.recurso} — ${e.act}`)));
      const max = Math.max(1, ...S.flat());
      const arcos = [];
      S.forEach((f, i) => f.forEach((v, j) => {
        if (!v) return;
        const nuevo = ultimo && ultimo[0] === pers[i] && ultimo[1] === pers[j];
        arcos.push({ de: pers[i], a: pers[j], etiqueta: String(v), ancho: 1.5 + 5 * v / max, color: nuevo ? C.s2 : C.s1, colorTexto: C.tinta });
      }));
      const nodos = pers.map((p) => ({ id: p, tipo: 'act', etiqueta: p, relleno: VIZ.alfa(COLOR_ROL[ROL_DE[p]], 0.25), borde: COLOR_ROL[ROL_DE[p]], anillo: hover === p ? C.tinta : (ultimo && (ultimo[0] === p || ultimo[1] === p) ? C.s2 : null) }));
      lienzo.limpiar();
      geo = P.dibujarGrafo(lienzo, nodos, arcos, posCircular(pers));
      leyenda.set([
        { color: C.s2, texto: 'subcontratación recién detectada', forma: 'linea' },
        { color: C.s1, texto: 'subcontrataciones acumuladas (grosor = veces)', forma: 'linea' },
        ...Object.keys(COLOR_ROL).filter((r) => pers.some((p) => ROL_DE[p] === r)).map((r) => ({ color: COLOR_ROL[r], texto: `rol ${r}` })),
      ]);
      registro.textContent = msg;
      const fila = S.map((f) => f.reduce((s, v) => s + v, 0));
      const k = fila.reduce((b, x, i) => (x > fila[b] ? i : b), 0);
      let par = null;
      S.forEach((f, i) => f.forEach((v, j) => { if (v && (!par || v > par[0])) par = [v, i, j]; }));
      lectura.set([
        ['ventanas revisadas', String(ventanas)],
        ['subcontrataciones', String(hechos)],
        ['personas que subcontratan', String(fila.filter((v) => v > 0).length)],
        ['quien más subcontrata', hechos ? `${pers[k]} (${fila[k]})` : '—'],
        ['relación más frecuente', par ? `${pers[par[1]]} → ${pers[par[2]]} (${par[0]})` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const nd = P.nodoEn(geo, x, y);
      const h = nd ? nd.id : null;
      if (h !== hover) { hover = h; dibujar(); }
      if (!nd) return tip.ocultar();
      const i = pers.indexOf(nd.id);
      tip.mostrar(x, y, `<b>${nd.id}</b> · ${ROL_DE[nd.id]}` + VIZ.filaTooltip(C.s2, 'subcontrata', String(S[i].reduce((s, v) => s + v, 0))) + VIZ.filaTooltip(C.s3, 'le subcontratan', String(S.reduce((s, f) => s + f[i], 0))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (pers.length) dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('working-together', {
    intro: String.raw`
      <p>El traspaso de trabajo sigue el orden de los eventos. Otras dos relaciones sociales miran el caso entero o un patrón corto dentro de él.
      <strong>Trabajo conjunto</strong> (<em>working together</em>) conecta a dos personas si participan en los mismos casos, sin importar el orden: mide
      colaboración. <strong>Subcontratación</strong> (<em>subcontracting</em>) busca el patrón \(a, b, a\): la persona \(a\) pasa un trabajo a \(b\) y retoma el caso después.</p>
      <p>La primera revela equipos y personas que nunca coinciden; la segunda, relaciones de dependencia, como un analista que consulta siempre a un mismo especialista.</p>`,
    visualizaciones: [
      {
        titulo: 'Quién trabaja con quién',
        descripcion: 'Matriz de casos compartidos. En reclamos casi nadie coincide con Jaime (solo aparece al aprobar); cambie a Jaccard para ver qué parejas son realmente cercanas, y haga clic en una celda para ver ejemplos.',
        montar: montarConjunto,
      },
      {
        titulo: 'Detectar subcontrataciones a, b, a',
        descripcion: 'Una ventana de tres eventos recorre los casos. Pruebe «Solo si b es de otro rol» para quedarse con las subcontrataciones entre áreas, y suba la polivalencia para ver más relaciones cruzadas.',
        montar: montarSubcontratacion,
      },
    ],
    teoria: String.raw`
      <h2>Trabajo conjunto</h2>
      <p>Sea \(R(c)\) el conjunto de recursos que participan en el caso \(c\). La relación de trabajo conjunto entre \(p\) y \(q\) cuenta los casos que comparten:</p>
      \[ T(p, q) = \bigl|\{\, c \in L : p \in R(c) \wedge q \in R(c) \,\}\bigr| , \qquad T(p,p) = |\{c : p \in R(c)\}|. \]
      <p>Es simétrica, por lo que su grafo no tiene dirección. Para comparar pares con distinta participación se normaliza con el índice de Jaccard</p>
      \[ J(p, q) = \frac{T(p,q)}{T(p,p) + T(q,q) - T(p,q)} \in [0, 1]. \]
      <p>Si una persona participa en casi todos los casos, \(T\) la conecta con todos aunque no haya una relación especial; \(J\) lo corrige.</p>
      <h2>Subcontratación</h2>
      <p>Para cada caso con recursos \(\rho_1, \dots, \rho_m\), la persona \(p\) <strong>subcontrata</strong> a \(q\) cuando aparece el patrón \(\rho_i = \rho_{i+2} = p\) y \(\rho_{i+1} = q \ne p\):</p>
      \[ S(p, q) = \sum_{c \in L} \bigl|\{\, i : \rho_i = p,\ \rho_{i+1} = q,\ \rho_{i+2} = p,\ p \ne q \,\}\bigr| . \]
      <pre><code>para cada caso c:
    para i ← 1 hasta |c| − 2:
        si ρ(e_i) = ρ(e_{i+2}) y ρ(e_i) ≠ ρ(e_{i+1}):
            S[ρ(e_i), ρ(e_{i+1})] ← S[ρ(e_i), ρ(e_{i+1})] + 1</code></pre>
      <p>La relación es dirigida: \(S(p,q)\) y \(S(q,p)\) significan cosas distintas. Se puede generalizar a distancias mayores (\(a, \ast, b\)) con un factor de caída, igual que la
      causalidad indirecta del <a href="tema.html?id=handover-of-work">traspaso de trabajo</a>.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> En un proceso muy corto o con pocas personas por rol, \(a, b, a\) aparece por puro azar (la misma persona
      tiene probabilidad \(1/k\) de quedar en dos eventos de un rol de \(k\) personas). Compare con lo esperado antes de concluir que existe una relación de dependencia.</p></div>
      <h2>Conexiones</h2>
      <p>Las tres relaciones (traspaso, trabajo conjunto y subcontratación) se calculan sobre la misma tabla recurso × caso × posición que usa la
      <a href="tema.html?id=organizational-perspective">perspectiva organizacional</a>. Sobre cualquiera de estas redes se pueden medir las personas clave con la
      <a href="tema.html?id=social-network-centrality">centralidad</a>.</p>`,
  });
})();
