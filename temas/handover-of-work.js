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

  // Traspaso: p → q si p ejecuta un evento y q uno posterior a distancia ≤ dmax en el mismo caso,
  // con peso beta^(distancia − 1). Con dmax = 1 son los traspasos directos (conteos enteros).
  function traspasos(log, pers, dmax, beta) {
    const idx = new Map(pers.map((p, i) => [p, i]));
    const W = pers.map(() => pers.map(() => 0));
    for (const c of log) {
      const r = c.eventos.map((e) => idx.get(e.recurso));
      for (let i = 0; i < r.length; i++) for (let d = 1; d <= dmax && i + d < r.length; d++) W[r[i]][r[i + d]] += Math.pow(beta, d - 1);
    }
    return W;
  }

  function posCircular(ids) {
    const pos = {};
    ids.forEach((id, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length; pos[id] = { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) }; });
    return pos;
  }
  const fmtW = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : VIZ.fmt(v, 3));

  /* ---------- Fig. 1: red de traspasos ---------- */

  function montarRed(cuerpo) {
    let proc = 'pedidos', n = 150, poliv = 0.1, semilla = 1, dmax = 1, umbral = 0.1, sinBucles = true, sel = null, hover = null;
    let pers = [], W = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; sel = null; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 30, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; calcular(); } });
    ctl.rango({ etiqueta: 'Distancia máxima (causalidad indirecta)', min: 1, max: 3, valor: dmax, formato: (v) => (v === 1 ? '1 (directa)' : String(v)), alCambiar: (v) => { dmax = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Peso mínimo', min: 0, max: 0.8, paso: 0.02, valor: umbral, formato: (v) => `${Math.round(v * 100)} % del máximo`, alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Ocultar traspasos a sí mismo', valor: sinBucles, alCambiar: (v) => { sinBucles = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.85, altoMin: 300, altoMax: 480 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una persona para resaltar a quién entrega trabajo (naranja) y de quién lo recibe (aguamarina); otro clic la suelta. El grosor de cada flecha es su peso; la etiqueta, el valor.');

    function calcular() {
      const log = crearLog(proc, n, semilla, poliv);
      pers = personasDe(log);
      WD = { log };
      dibujar();
    }
    let WD = null;

    function dibujar() {
      if (!WD) return;
      W = traspasos(WD.log, pers, dmax, 0.5);
      const N = pers.length;
      let max = 0, total = 0, cruzado = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i === j && sinBucles) continue;
        max = Math.max(max, W[i][j]); total += W[i][j];
        if (ROL_DE[pers[i]] !== ROL_DE[pers[j]]) cruzado += W[i][j];
      }
      const aristas = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i === j && sinBucles) continue;
        if (W[i][j] > 0 && W[i][j] >= umbral * max) aristas.push({ i, j, w: W[i][j] });
      }
      const selI = sel === null ? -1 : pers.indexOf(sel);
      const arcos = aristas.map((a) => {
        const sale = selI >= 0 && a.i === selI, entra = selI >= 0 && a.j === selI;
        const color = selI < 0 ? C.s1 : sale ? C.s2 : entra ? C.s3 : C.tenue;
        return { de: pers[a.i], a: pers[a.j], etiqueta: selI < 0 && aristas.length > 16 ? '' : (selI < 0 || sale || entra ? fmtW(a.w) : ''), ancho: 1.5 + 5 * a.w / max, color, colorTexto: C.tinta };
      });
      const salidas = pers.map((_, i) => W[i].reduce((s, v, j) => s + (i === j && sinBucles ? 0 : v), 0));
      const entradas = pers.map((_, j) => W.reduce((s, f, i) => s + (i === j && sinBucles ? 0 : f[j]), 0));
      const nodos = pers.map((p, i) => ({ id: p, tipo: 'act', etiqueta: p, relleno: VIZ.alfa(COLOR_ROL[ROL_DE[p]], i === selI ? 0.55 : 0.25), borde: COLOR_ROL[ROL_DE[p]], anillo: i === selI ? C.tinta : hover === p ? C.tinta2 : null }));
      lienzo.limpiar();
      geo = P.dibujarGrafo(lienzo, nodos, arcos, posCircular(pers));
      leyenda.set([
        ...Object.keys(COLOR_ROL).filter((r) => pers.some((p) => ROL_DE[p] === r)).map((r) => ({ color: COLOR_ROL[r], texto: `rol ${r}` })),
        selI < 0 ? { color: C.s1, texto: 'traspaso (grosor = peso)', forma: 'linea' } : { color: C.s2, texto: 'entrega trabajo a…', forma: 'linea' },
        ...(selI >= 0 ? [{ color: C.s3, texto: 'recibe trabajo de…', forma: 'linea' }, { color: C.tenue, texto: 'otros traspasos', forma: 'linea' }] : []),
      ]);
      const cima = aristas.slice().sort((a, b) => b.w - a.w)[0];
      lectura.set([
        ['personas', String(N)],
        ['flechas visibles', `${aristas.length} de ${W.flat().filter((v, k) => v > 0 && !(sinBucles && Math.floor(k / N) === k % N)).length}`],
        ['traspasos totales', fmtW(total)],
        ['entre roles distintos', total ? `${Math.round(100 * cruzado / total)} %` : '—'],
        ['arista más fuerte', cima ? `${pers[cima.i]} → ${pers[cima.j]} (${fmtW(cima.w)})` : '—'],
      ]);
      if (selI >= 0) {
        const mejor = (v) => { const k = v.reduce((b, x, i) => (x > v[b] ? i : b), 0); return v[k] > 0 ? `${pers[k]} (${fmtW(v[k])})` : 'nadie'; };
        registro.textContent = `${sel}: entrega ${fmtW(salidas[selI])} y recibe ${fmtW(entradas[selI])}. Entrega sobre todo a ${mejor(W[selI].map((v, j) => (j === selI && sinBucles ? 0 : v)))}; recibe sobre todo de ${mejor(W.map((f, i) => (i === selI && sinBucles ? 0 : f[selI])))}.`;
      } else registro.textContent = dmax === 1
        ? 'Flecha p → q: en algún caso p ejecutó una actividad y q la siguiente. El peso es cuántas veces ocurrió.'
        : `Causalidad indirecta: también cuenta q hasta ${dmax} eventos después de p, con peso 0,5 por cada salto adicional; los pesos dejan de ser enteros.`;
      lienzo.datos = { salidas, entradas };
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    const nodoEn = (ev) => { const { x, y } = lienzo.posicion(ev); return { x, y, n: geo ? P.nodoEn(geo, x, y) : null }; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, n: nd } = nodoEn(ev);
      const h = nd ? nd.id : null;
      if (h !== hover) { hover = h; dibujar(); }
      if (!nd) return tip.ocultar();
      const i = pers.indexOf(nd.id), d = lienzo.datos;
      tip.mostrar(x, y, `<b>${nd.id}</b> · ${ROL_DE[nd.id]}` + VIZ.filaTooltip(C.s2, 'entrega', fmtW(d.salidas[i])) + VIZ.filaTooltip(C.s3, 'recibe', fmtW(d.entradas[i])));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { n: nd } = nodoEn(ev);
      sel = nd && nd.id !== sel ? nd.id : null;
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 2: construir la matriz caso a caso ---------- */

  function montarMatriz(cuerpo) {
    let proc = 'reclamos', casos = 4, semilla = 1, log = [], pers = [], M = [], ci = -1, ev = 0, ultima = null, hechos = 0, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Casos a recorrer', min: 1, max: 12, valor: casos, alCambiar: (v) => { casos = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const trazaCaja = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(trazaCaja);
    const tablaCaja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(tablaCaja);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'traspaso que se acaba de contar' },
      { color: C.s1, texto: 'traspasos acumulados (más oscuro = más)' },
      { color: C.neutro, texto: 'todavía ninguno', borde: C.rejilla },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las filas entregan, las columnas reciben. Use «Un paso» para ver cómo cada par de eventos consecutivos suma 1 a una celda; en la diagonal están los casos en que la misma persona sigue con el trabajo.');

    function iniciar() {
      log = crearLog(proc, 12, semilla, 0.1).slice(0, casos);
      pers = personasDe(log);
      M = pers.map(() => pers.map(() => 0));
      ci = 0; ev = 0; ultima = null; hechos = 0;
      msg = 'Cada caso se recorre de izquierda a derecha: el ejecutor de un evento entrega el trabajo al del siguiente.';
      return (function* () {
        for (ci = 0; ci < log.length; ci++) {
          const E = log[ci].eventos;
          for (ev = 1; ev < E.length; ev++) {
            const i = pers.indexOf(E[ev - 1].recurso), j = pers.indexOf(E[ev].recurso);
            M[i][j]++; hechos++; ultima = [i, j];
            msg = `${log[ci].id}: ${E[ev - 1].recurso} (${E[ev - 1].act}) → ${E[ev].recurso} (${E[ev].act}). La celda ${E[ev - 1].recurso} → ${E[ev].recurso} sube a ${M[i][j]}.`;
            yield;
          }
        }
        ci = log.length - 1; ev = -1; ultima = null;
        msg = `Terminado: ${hechos} traspasos en ${log.length} casos.`;
      })();
    }

    function dibujar() {
      if (!pers.length) return;
      const max = Math.max(1, ...M.flat());
      const c = log[Math.min(ci, log.length - 1)];
      trazaCaja.replaceChildren(...c.eventos.map((e, k) => VIZ.el('div', { class: ev > 0 && (k === ev || k === ev - 1) ? 'activa' : '' }, `${c.id} · ${k + 1}. ${e.recurso} — ${e.act}`)));
      const filaCab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'de \\ a'), ...pers.map((p) => VIZ.el('th', null, p)));
      const filas = pers.map((p, i) => VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, p), ...pers.map((q, j) => {
        const v = M[i][j], act = ultima && ultima[0] === i && ultima[1] === j;
        return VIZ.el('td', { style: { background: act ? VIZ.alfa(C.s2, 0.45) : v ? VIZ.alfa(C.s1, 0.12 + 0.5 * v / max) : '' } }, v ? String(v) : '·');
      })));
      tablaCaja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, filaCab), VIZ.el('tbody', null, ...filas)));
      registro.textContent = msg;
      const fila = M.map((f) => f.reduce((s, v) => s + v, 0)), col = pers.map((_, j) => M.reduce((s, f) => s + f[j], 0));
      const kMax = (v) => v.reduce((b, x, i) => (x > v[b] ? i : b), 0);
      lectura.set([
        ['casos recorridos', `${Math.min(log.length, ev < 0 ? log.length : ci)} de ${log.length}`],
        ['traspasos contados', String(hechos)],
        ['de una persona a sí misma', `${M.reduce((s, f, i) => s + f[i], 0)} (${hechos ? Math.round(100 * M.reduce((s, f, i) => s + f[i], 0) / hechos) : 0} %)`],
        ['quien más entrega', hechos ? `${pers[kMax(fila)]} (${fila[kMax(fila)]})` : '—'],
        ['quien más recibe', hechos ? `${pers[kMax(col)]} (${col[kMax(col)]})` : '—'],
      ]);
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('handover-of-work', {
    intro: String.raw`
      <p>El <strong>traspaso de trabajo</strong> (<em>handover of work</em>) es la técnica más usada de <em>minería de redes sociales</em>: se dibuja una
      flecha de la persona \(p\) a la persona \(q\) cuando, en un mismo caso, \(p\) ejecuta una actividad y \(q\) ejecuta la siguiente. El resultado es una
      red que muestra cómo circula el trabajo entre personas, no entre actividades.</p>
      <p>Con ella se detectan quienes reciben todo el trabajo, quienes solo lo reenvían, y traspasos entre áreas que el organigrama no prevé. Dos decisiones
      cambian la imagen: qué tan lejos se busca la sucesión (causalidad directa o indirecta) y qué peso mínimo se exige para mostrar una flecha.</p>`,
    visualizaciones: [
      {
        titulo: 'Red de traspasos entre personas',
        descripcion: 'Suba el peso mínimo para quedarse con los traspasos principales; aumente la distancia máxima y observe aparecer flechas indirectas. Haga clic en una persona para ver a quién entrega y de quién recibe.',
        montar: montarRed,
      },
      {
        titulo: 'La matriz de traspasos, caso a caso',
        descripcion: 'Recorra casos reales evento por evento: cada par consecutivo suma uno a la celda (quien entrega, quien recibe). Compare los procesos y vea en qué filas se concentra el trabajo.',
        montar: montarMatriz,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(L\) un registro de eventos y, para cada caso \(c\), \(\sigma_c = \langle e_1, \dots, e_m \rangle\) su traza con el recurso \(\rho(e_i)\) de cada evento.
      Con causalidad directa, el <strong>peso del traspaso</strong> de \(p\) a \(q\) es</p>
      \[ H(p, q) = \sum_{c \in L} \bigl|\{\, i : \rho(e_i) = p,\ \rho(e_{i+1}) = q \,\}\bigr| . \]
      <p>La red social \(G = (R, E, H)\) tiene un nodo por recurso y una arista dirigida \(p \to q\) con peso \(H(p,q)\) cuando \(H(p,q) \ge \tau\) para un umbral \(\tau\).
      Una arista \(p \to p\) significa que la misma persona continúa; suele ocultarse porque no revela colaboración.</p>
      <h2>Causalidad indirecta</h2>
      <p>Con distancia máxima \(d\) y factor de caída \(\beta \in (0,1]\) (aquí \(\beta = 0{,}5\)), se cuenta también a quien actúa \(k \le d\) eventos después:</p>
      \[ H_d(p, q) = \sum_{c \in L}\ \sum_{i}\ \sum_{k=1}^{d} \beta^{\,k-1}\,[\rho(e_i) = p,\ \rho(e_{i+k}) = q]. \]
      <p>Esto tolera actividades intermedias hechas por otros (por ejemplo, un paso automático) y suaviza el efecto de la concurrencia, a costa de enlaces menos literales.</p>
      <h2>Algoritmo</h2>
      <pre><code>para cada caso c:
    para i ← 1 hasta |c| − 1:
        para k ← 1 hasta min(d, |c| − i):
            H[ρ(e_i), ρ(e_{i+k})] ← H[ρ(e_i), ρ(e_{i+k})] + β^(k−1)
devolver {(p, q, H[p,q]) : H[p,q] ≥ τ}</code></pre>
      <h2>Interpretación y cuidados</h2>
      <ul>
        <li>La suma por filas \(\sum_q H(p,q)\) es lo que \(p\) entrega; por columnas, lo que recibe.</li>
        <li>La concurrencia (rama AND) hace que el orden observado entre dos actividades paralelas sea arbitrario: aparecen flechas entre personas que en realidad trabajan en paralelo.</li>
        <li>Si dos personas con el mismo rol son intercambiables, el traspaso entre roles se reparte entre ellas; considere agruparlas con la
        <a href="tema.html?id=organizational-perspective">perspectiva organizacional</a>.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>El traspaso es el análogo, entre personas, del <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a> entre actividades. Sobre esta red se calcula
      la <a href="tema.html?id=social-network-centrality">centralidad</a>; la otra mirada social, quiénes participan en los mismos casos, es
      <a href="tema.html?id=working-together">trabajo conjunto y subcontratación</a>.</p>`,
  });
})();
