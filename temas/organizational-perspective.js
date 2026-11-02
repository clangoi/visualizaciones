(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos compartidos: personas, roles y registros ---------- */

  const TODOS = Object.values(P.personas).flat();
  const ROL_DE = {};
  for (const [r, ps] of Object.entries(P.personas)) ps.forEach((p) => { ROL_DE[p] = r; });
  const COLOR_ROL = { ventas: C.s1, bodega: C.s2, finanzas: C.s3, soporte: C.s4, gerencia: C.s5 };
  const NOMBRE_ROL = { ventas: 'ventas', bodega: 'bodega', finanzas: 'finanzas', soporte: 'soporte', gerencia: 'gerencia' };
  const PROCESOS = [['pedidos', 'Gestión de pedidos'], ['reclamos', 'Atención de reclamos']];

  // Registro simulado; con probabilidad `poliv` un evento lo ejecuta cualquier persona (polivalencia).
  function crearLog(proc, n, semilla, poliv) {
    const log = P.simular(P.procesos[proc].arbol, n, semilla);
    const rnd = VIZ.semilla(semilla * 97 + 5);
    for (const c of log) for (const e of c.eventos) if (rnd() < poliv) e.recurso = TODOS[Math.floor(rnd() * TODOS.length)];
    return log;
  }

  // Matriz recurso × actividad con las actividades ordenadas por su posición media en las trazas.
  function asignacion(log) {
    const aparece = new Set(log.flatMap((c) => c.eventos.map((e) => e.recurso)));
    const pers = TODOS.filter((p) => aparece.has(p));
    const pos = new Map();
    for (const c of log) c.eventos.forEach((e, i) => {
      const v = pos.get(e.act) || [0, 0];
      v[0] += i / Math.max(1, c.eventos.length - 1); v[1]++; pos.set(e.act, v);
    });
    const acts = [...pos.keys()].sort((a, b) => pos.get(a)[0] / pos.get(a)[1] - pos.get(b)[0] / pos.get(b)[1]);
    const m = pers.map(() => acts.map(() => 0));
    for (const c of log) for (const e of c.eventos) m[pers.indexOf(e.recurso)][acts.indexOf(e.act)]++;
    const filas = m.map((f) => f.reduce((s, v) => s + v, 0));
    const cols = acts.map((_, j) => m.reduce((s, f) => s + f[j], 0));
    const max = Math.max(...m.flat());
    return { pers, acts, m, filas, cols, max };
  }

  // Especialización de una fila: 1 − H / log2(K); 1 = hace una sola cosa, 0 = reparte parejo.
  function especializacion(fila) {
    const K = fila.length, tot = fila.reduce((s, v) => s + v, 0);
    if (K <= 1 || !tot) return 1;
    let H = 0;
    for (const v of fila) if (v > 0) H -= (v / tot) * Math.log2(v / tot);
    return 1 - H / Math.log2(K);
  }
  const recortar = (t, k = 16) => (t.length > k ? t.slice(0, k - 1) + '…' : t);

  /* ---------- Fig. 1: matriz de asignación ---------- */

  function montarMatriz(cuerpo) {
    let proc = 'pedidos', n = 120, poliv = 0, semilla = 1, modo = 'abs', selFila = -1, selCol = -1, hover = null, D = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 30, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; calcular(); } });
    ctl.selector({ etiqueta: 'Valores', opciones: [['abs', 'Eventos'], ['fila', '% del trabajo de cada persona']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const TOP = 84, IZQ = 66, FILA = 26;
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => TOP + FILA * (D ? D.pers.length : 7) + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...Object.keys(COLOR_ROL).map((r) => ({ color: COLOR_ROL[r], texto: `rol ${NOMBRE_ROL[r]} (cuadro junto al nombre)` })),
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'pocos eventos' },
      { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'muchos eventos' },
      { color: C.neutro, texto: 'nunca la ejecuta', borde: C.rejilla },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila para ver el perfil de una persona, o en el nombre de una actividad (arriba) para ver quién la ejecuta; otro clic la deselecciona.');

    function calcular() {
      D = asignacion(crearLog(proc, n, semilla, poliv));
      selFila = -1; selCol = -1;
      lienzo.ajustar(true);
    }

    function geom() {
      const nA = D.acts.length;
      return { nA, w: (lienzo.ancho - IZQ - 8) / nA };
    }

    function dibujar() {
      if (!D) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const { nA, w } = geom();
      ctx.textBaseline = 'middle';
      D.acts.forEach((a, j) => {
        ctx.save();
        ctx.translate(IZQ + (j + 0.5) * w, TOP - 6);
        ctx.rotate(Math.PI / 4);
        ctx.font = VIZ.fuente(10, j === selCol ? 700 : 500);
        ctx.fillStyle = j === selCol ? C.tinta : C.tinta2;
        ctx.textAlign = 'right';
        ctx.fillText(recortar(a), 0, 0);
        ctx.restore();
      });
      D.pers.forEach((p, i) => {
        const y = TOP + i * FILA;
        ctx.fillStyle = COLOR_ROL[ROL_DE[p]];
        ctx.fillRect(4, y + FILA / 2 - 5, 10, 10);
        ctx.font = VIZ.fuente(11, i === selFila ? 700 : 500);
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(p, 20, y + FILA / 2);
        D.acts.forEach((a, j) => {
          const v = D.m[i][j];
          const t = modo === 'abs' ? v / D.max : v / D.filas[i];
          ctx.fillStyle = v ? VIZ.css(VIZ.enRampa(0.12 + 0.88 * t)) : C.neutro;
          ctx.fillRect(IZQ + j * w + 1, y + 1, w - 2, FILA - 2);
          if (v && w >= 30) {
            ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center';
            ctx.fillStyle = t > 0.55 ? C.sobre : C.tinta;
            ctx.fillText(modo === 'abs' ? String(v) : `${Math.round(t * 100)}%`, IZQ + (j + 0.5) * w, y + FILA / 2);
          }
        });
      });
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.s2;
      if (selFila >= 0) ctx.strokeRect(IZQ, TOP + selFila * FILA, nA * w, FILA);
      if (selCol >= 0) ctx.strokeRect(IZQ + selCol * w, TOP, w, D.pers.length * FILA);
      if (hover) { ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.strokeRect(IZQ + hover.j * w + 1, TOP + hover.i * FILA + 1, w - 2, FILA - 2); }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      const esp = D.m.map(especializacion);
      const unicos = D.cols.map((_, j) => D.m.filter((f) => f[j] > 0).length).filter((k) => k === 1).length;
      lectura.set([
        ['personas', String(D.pers.length)],
        ['actividades', String(nA)],
        ['celdas con trabajo', `${D.m.flat().filter((v) => v > 0).length} de ${D.pers.length * nA}`],
        ['especialización media', VIZ.fmt(esp.reduce((s, v) => s + v, 0) / esp.length, 3)],
        ['actividades con un solo ejecutor', String(unicos)],
      ]);
      if (selFila >= 0) {
        const p = D.pers[selFila], f = D.m[selFila];
        const top = f.map((v, j) => [v, D.acts[j]]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([v, a]) => `${a} (${Math.round(100 * v / D.filas[selFila])} %)`).join(', ');
        registro.textContent = `${p} (rol ${ROL_DE[p]}): ${D.filas[selFila]} eventos en ${f.filter((v) => v > 0).length} actividades; especialización ${VIZ.fmt(esp[selFila], 3)}. Más frecuentes: ${top}.`;
      } else if (selCol >= 0) {
        const quien = D.pers.map((p, i) => [D.m[i][selCol], p]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]).map(([v, p]) => `${p} ${v}`).join(', ');
        registro.textContent = `«${D.acts[selCol]}» (${D.cols[selCol]} eventos) la ejecutan: ${quien}.`;
      } else registro.textContent = 'Cada celda cuenta cuántas veces la persona de la fila ejecutó la actividad de la columna. Compare filas: quienes tienen el mismo rol repiten el mismo patrón.';
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    const celdaEn = (x, y) => {
      const { nA, w } = geom();
      const j = Math.floor((x - IZQ) / w), i = Math.floor((y - TOP) / FILA);
      return j >= 0 && j < nA && i >= 0 && i < D.pers.length ? { i, j } : null;
    };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!D) return;
      const { x, y } = lienzo.posicion(ev);
      const c = celdaEn(x, y);
      if (!c) { if (hover) { hover = null; dibujar(); } return tip.ocultar(); }
      if (!hover || hover.i !== c.i || hover.j !== c.j) { hover = c; dibujar(); }
      const v = D.m[c.i][c.j], p = D.pers[c.i];
      tip.mostrar(x, y, `<b>${p}</b> · ${ROL_DE[p]}<br>${D.acts[c.j]}` +
        VIZ.filaTooltip(C.s1, 'eventos', String(v)) +
        VIZ.filaTooltip(C.s2, 'de su trabajo', D.filas[c.i] ? `${VIZ.fmt(100 * v / D.filas[c.i], 3)} %` : '—') +
        VIZ.filaTooltip(C.s3, 'de la actividad', D.cols[c.j] ? `${VIZ.fmt(100 * v / D.cols[c.j], 3)} %` : '—'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!D) return;
      const { x, y } = lienzo.posicion(ev);
      const { nA, w } = geom();
      const j = Math.floor((x - IZQ) / w), i = Math.floor((y - TOP) / FILA);
      if (y < TOP && j >= 0 && j < nA) { selCol = selCol === j ? -1 : j; selFila = -1; }
      else if (i >= 0 && i < D.pers.length && (x < IZQ || j < nA)) { selFila = selFila === i ? -1 : i; selCol = -1; }
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 2: agrupamiento de perfiles ---------- */

  // Agrupamiento aglomerativo de enlace promedio con distancia coseno entre perfiles.
  function aglomerar(vectores) {
    const n = vectores.length;
    const u = vectores.map((v) => { const s = Math.hypot(...v) || 1; return v.map((x) => x / s); });
    const d0 = u.map((a, i) => u.map((b, j) => (i === j ? 0 : Math.max(0, 1 - a.reduce((s, x, k) => s + x * b[k], 0)))));
    let cl = u.map((_, i) => ({ id: i, miembros: [i] }));
    const merges = [];
    while (cl.length > 1) {
      let mejor = Infinity, A = 0, B = 1;
      for (let a = 0; a < cl.length; a++) for (let b = a + 1; b < cl.length; b++) {
        let s = 0;
        for (const i of cl[a].miembros) for (const j of cl[b].miembros) s += d0[i][j];
        const h = s / (cl[a].miembros.length * cl[b].miembros.length);
        if (h < mejor - 1e-12) { mejor = h; A = a; B = b; }
      }
      const nuevo = { id: n + merges.length, miembros: cl[A].miembros.concat(cl[B].miembros) };
      merges.push({ a: cl[A].id, b: cl[B].id, h: mejor, id: nuevo.id, miembros: nuevo.miembros });
      cl = cl.filter((_, k) => k !== A && k !== B).concat([nuevo]);
    }
    const orden = (id) => (id < n ? [id] : orden(merges[id - n].a).concat(orden(merges[id - n].b)));
    return { merges, orden: n > 1 ? orden(2 * n - 2) : [0], d0 };
  }

  function montarGrupos(cuerpo) {
    let proc = 'reclamos', poliv = 0.15, semilla = 1, k = 3, D = null, T = null, hecho = 0, msg = '', hover = null, nodos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Grupos buscados', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 60 + 28 * (D ? D.pers.length : 5) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso une los dos grupos de perfiles más parecidos (distancia coseno, enlace promedio). El proceso se detiene al llegar al número de grupos buscado. Pase el cursor sobre un nombre o una unión para ver sus detalles.');

    function iniciar() {
      D = asignacion(crearLog(proc, 120, semilla, poliv));
      T = aglomerar(D.m);
      const nP = D.pers.length;
      hecho = 0;
      msg = `${nP} personas, cada una en su propio grupo. Un paso une los dos grupos más parecidos.`;
      lienzo.ajustar(true);
      return (function* () {
        while (nP - hecho > Math.max(1, k)) {
          const mg = T.merges[hecho];
          hecho++;
          const nom = (ms) => '{' + ms.map((i) => D.pers[i]).join(', ') + '}';
          const A = mg.a < nP ? [mg.a] : T.merges[mg.a - nP].miembros, B = mg.b < nP ? [mg.b] : T.merges[mg.b - nP].miembros;
          msg = `Paso ${hecho}: se unen ${nom(A)} y ${nom(B)} a distancia ${VIZ.fmt(mg.h, 3)}.`;
          yield;
        }
        msg += ` Terminado: ${nP - hecho} grupos.`;
      })();
    }

    function raices() {
      const nP = D.pers.length, padre = new Map();
      T.merges.slice(0, hecho).forEach((m) => { padre.set(m.a, m.id); padre.set(m.b, m.id); });
      const raiz = (id) => { while (padre.has(id)) id = padre.get(id); return id; };
      return { raiz, grupos: [...new Set(D.pers.map((_, i) => raiz(i)))], nP };
    }

    function dibujar() {
      if (!D) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const { raiz, grupos, nP } = raices();
      const miembrosDe = (id) => (id < nP ? [id] : T.merges[id - nP].miembros);
      const colorDe = new Map();
      const ordenGrupos = grupos.filter((g) => miembrosDe(g).length > 1).sort((a, b) => Math.min(...miembrosDe(a).map((i) => T.orden.indexOf(i))) - Math.min(...miembrosDe(b).map((i) => T.orden.indexOf(i))));
      ordenGrupos.forEach((g, q) => colorDe.set(g, VIZ.series[q % 8]));
      const IZQ = 76, DER = 18, SUP = 8, INF = 34;
      const rh = (H - SUP - INF) / nP;
      const hmax = Math.max(0.05, ...T.merges.map((m) => m.h)) * 1.05;
      const px = (h) => IZQ + (h / hmax) * (W - IZQ - DER);
      const yHoja = (i) => SUP + (T.orden.indexOf(i) + 0.5) * rh;
      const pos = new Map();
      for (let i = 0; i < nP; i++) pos.set(i, { x: 0, y: yHoja(i) });
      T.merges.slice(0, hecho).forEach((m) => pos.set(m.id, { x: m.h, y: (pos.get(m.a).y + pos.get(m.b).y) / 2 }));
      nodos = [];
      ctx.lineWidth = 2;
      T.merges.slice(0, hecho).forEach((m) => {
        const col = colorDe.get(raiz(m.id)) || C.tinta;
        const A = pos.get(m.a), B = pos.get(m.b), P0 = pos.get(m.id);
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(px(A.x), A.y); ctx.lineTo(px(P0.x), A.y);
        ctx.moveTo(px(B.x), B.y); ctx.lineTo(px(P0.x), B.y);
        ctx.moveTo(px(P0.x), A.y); ctx.lineTo(px(P0.x), B.y);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px(P0.x), P0.y, 3.5, 0, 2 * Math.PI); ctx.fill();
        nodos.push({ x: px(P0.x), y: P0.y, m });
      });
      ctx.textBaseline = 'middle';
      for (let i = 0; i < nP; i++) {
        const y = yHoja(i), p = D.pers[i];
        ctx.fillStyle = COLOR_ROL[ROL_DE[p]];
        ctx.fillRect(4, y - 5, 10, 10);
        ctx.font = VIZ.fuente(11, hover === i ? 700 : 500);
        ctx.fillStyle = colorDe.get(raiz(i)) || C.tinta; ctx.textAlign = 'left';
        ctx.fillText(p, 20, y);
      }
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1;
      const yb = H - INF + 8;
      ctx.beginPath(); ctx.moveTo(IZQ, yb); ctx.lineTo(W - DER, yb); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center';
      [0, 0.5, 1].forEach((f) => {
        const x = IZQ + f * (W - IZQ - DER);
        ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yb + 4); ctx.stroke();
        ctx.fillText(VIZ.fmt(f * hmax, 2), Math.min(W - 14, Math.max(IZQ, x)), yb + 14);
      });
      ctx.fillText('distancia entre perfiles (coseno)', (IZQ + W - DER) / 2, yb + 27);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      leyenda.set([
        ...Object.keys(COLOR_ROL).filter((r) => D.pers.some((p) => ROL_DE[p] === r)).map((r) => ({ color: COLOR_ROL[r], texto: `rol real: ${NOMBRE_ROL[r]}` })),
        ...ordenGrupos.map((g, q) => ({ color: VIZ.series[q % 8], texto: `grupo ${q + 1}: ${miembrosDe(g).map((i) => D.pers[i]).join(', ')}` })),
        ...(grupos.length > ordenGrupos.length ? [{ color: C.tinta, texto: 'persona aún sola' }] : []),
      ]);
      let pura = 0;
      for (const g of grupos) {
        const cuenta = {};
        miembrosDe(g).forEach((i) => { cuenta[ROL_DE[D.pers[i]]] = (cuenta[ROL_DE[D.pers[i]]] || 0) + 1; });
        pura += Math.max(...Object.values(cuenta));
      }
      const roles = new Set(D.pers.map((p) => ROL_DE[p])).size;
      registro.textContent = msg;
      lectura.set([
        ['personas', String(nP)],
        ['grupos actuales', String(grupos.length)],
        ['roles reales', String(roles)],
        ['pureza respecto al rol', `${Math.round(100 * pura / nP)} %`],
        ['distancia de la última unión', hecho ? VIZ.fmt(T.merges[hecho - 1].h, 3) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!D) return;
      const { x, y } = lienzo.posicion(ev);
      const nP = D.pers.length;
      let h = null, html = null;
      const nd = nodos.find((q) => Math.hypot(q.x - x, q.y - y) < 9);
      if (nd) {
        const ms = nd.m.miembros.map((i) => D.pers[i]);
        const roles = [...new Set(ms.map((p) => ROL_DE[p]))];
        html = `<b>unión a distancia ${VIZ.fmt(nd.m.h, 3)}</b><br>${ms.join(', ')}<br>roles: ${roles.join(', ')}`;
      } else if (x < 70 && lienzo.alto > 0) {
        const rh = (lienzo.alto - 8 - 34) / nP;
        const q = Math.floor((y - 8) / rh);
        if (q >= 0 && q < nP) {
          const i = T.orden[q];
          h = i;
          const top = D.m[i].map((v, j) => [v, D.acts[j]]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([v, a]) => `${a}: ${v}`).join('<br>');
          html = `<b>${D.pers[i]}</b> · ${ROL_DE[D.pers[i]]}<br>${top}`;
        }
      }
      if (h !== hover) { hover = h; dibujar(); }
      if (html) tip.mostrar(x, y, html); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (D) dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('organizational-perspective', {
    intro: String.raw`
      <p>Hasta ahora el registro de eventos respondía <em>qué</em> se hace y <em>en qué orden</em>. La <strong>perspectiva organizacional</strong>
      mira otra columna del mismo registro, la del <strong>recurso</strong>: quién ejecutó cada evento. Cruzando personas con actividades se ve
      quién sabe hacer qué, qué roles existen de hecho (aunque no estén escritos en ningún organigrama) y dónde el conocimiento depende de una sola persona.</p>
      <p>La herramienta básica es la <strong>matriz de asignación</strong> recurso × actividad. Sus filas son perfiles de trabajo; si dos personas tienen
      perfiles parecidos, probablemente cumplen el mismo rol y pueden agruparse automáticamente.</p>`,
    visualizaciones: [
      {
        titulo: 'Matriz de asignación recurso × actividad',
        descripcion: 'Cada fila es el perfil de una persona. Con polivalencia 0 se ven bloques por rol; súbala y observe cómo se difuminan, y cambie a «% del trabajo» para comparar personas con distinta carga.',
        montar: montarMatriz,
      },
      {
        titulo: 'Descubrir grupos de trabajo',
        descripcion: 'Agrupamiento jerárquico paso a paso de los perfiles. Con polivalencia baja los grupos coinciden con los roles (pureza 100 %); súbala o pida más grupos que roles y vea qué se rompe.',
        montar: montarGrupos,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un registro de eventos asocia a cada evento una actividad \(a\), un caso \(c\) y un <em>recurso</em> \(r\) (persona, equipo o sistema). La
      <strong>matriz de asignación</strong> es la tabla de frecuencias</p>
      \[ A_{r,a} = \bigl|\{e \in L : \text{recurso}(e) = r,\ \text{actividad}(e) = a\}\bigr|. \]
      <p>Un <strong>rol</strong> es un conjunto de actividades que un grupo de personas ejecuta de forma intercambiable; un <strong>grupo de trabajo</strong>
      es un conjunto de personas con perfiles parecidos. Los roles descubiertos con datos pueden diferir de los formales: es una de las
      razones para hacer este análisis.</p>
      <h2>Especialización</h2>
      <p>Para la persona \(r\) con perfil \(p_a = A_{r,a}/\sum_b A_{r,b}\) sobre \(K\) actividades, la especialización se mide con la entropía de Shannon:</p>
      \[ S_r = 1 - \frac{H_r}{\log_2 K}, \qquad H_r = -\sum_a p_a \log_2 p_a . \]
      <p>\(S_r = 1\) significa que hace una sola actividad; \(S_r = 0\), que reparte su trabajo por igual. Una persona muy especializada es eficiente
      pero también un punto de fallo: si falta, nadie más conoce su tarea.</p>
      <h2>Descubrir grupos: agrupamiento jerárquico</h2>
      <p>Cada persona se representa por su vector de perfil. La distancia entre dos vectores \(u, v\) es la <em>distancia coseno</em></p>
      \[ d(u, v) = 1 - \frac{u \cdot v}{\lVert u \rVert\, \lVert v \rVert}, \]
      <p>que ignora cuánto trabaja cada persona y compara solo <em>qué</em> hace. Con enlace promedio (UPGMA) la distancia entre grupos es el promedio de
      las distancias entre sus miembros.</p>
      <pre><code>grupos ← {{r} : r ∈ personas}
mientras |grupos| &gt; k:
    (G, H) ← par de grupos con menor distancia promedio
    grupos ← grupos − {G, H} + {G ∪ H}
devolver grupos</code></pre>
      <div class="recuadro"><p><strong>Polivalencia.</strong> Si las personas rotan entre tareas, los perfiles se parecen y las distancias entre roles
      se encogen: el dendrograma deja de mostrar saltos claros. Cuando no hay un salto evidente, el número de grupos \(k\) deja de ser objetivo y conviene
      validar con quienes conocen la operación.</p></div>
      <h2>Conexiones</h2>
      <p>El agrupamiento es el mismo de <a href="tema.html?id=hierarchical-clustering">clustering jerárquico</a>. Los datos provienen de los
      <a href="tema.html?id=event-logs">registros de eventos</a>. La siguiente pregunta, no solo quién hace qué sino cómo se pasan el trabajo, se responde con
      <a href="tema.html?id=handover-of-work">el traspaso de trabajo</a> y <a href="tema.html?id=working-together">el trabajo conjunto</a>, y la carga de
      cada persona con <a href="tema.html?id=resource-workload">carga de trabajo y cuellos de botella</a>.</p>`,
  });
})();
