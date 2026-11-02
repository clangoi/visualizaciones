(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Ayudantes ---------- */

  function leerTrazas(txt) {
    const pares = [];
    for (const tok of String(txt).toLowerCase().split(/[\s,;]+/)) {
      if (!tok) continue;
      const [t, m] = tok.split(':');
      const traza = t.replace(/[^a-j]/g, '');
      if (traza) pares.push([traza, Math.max(1, Math.min(50, parseInt(m, 10) || 1))]);
    }
    return pares;
  }
  const EJ = {
    mixto: ['Elección y paralelo (clásico)', 'abcd:3 acbd:2 aed:2'],
    eleccion: ['Elección seguida de paralelo', 'abdef:2 abedf:2 acdef:2 acedf:2'],
    ciclo: ['Ciclo de longitud 3', 'abcf:3 abcdbcf:2 abcdbcdbcf:1'],
    bucle1: ['Bucle de longitud 1 (a > a)', 'abc:3 abbc:2'],
    bucle2: ['Bucle de longitud 2 (b > c y c > b)', 'abcd:3 abcbcd:2'],
  };
  const opcionesEj = Object.entries(EJ).map(([k, v]) => [k, v[0]]);

  const COLOR_REL = { '→': C.s1, '←': C.s3, '‖': C.s2, '#': null };
  const LEYENDA_REL = [
    { color: C.s1, texto: 'a → b: a precede a b y nunca al revés' },
    { color: C.s3, texto: 'a ← b: b precede a a' },
    { color: C.s2, texto: 'a ‖ b: ambos órdenes aparecen' },
    { color: C.inactivo, texto: 'a # b: nunca son vecinas' },
  ];

  // Tabla de la matriz de huellas; `celda(a, b)` puede devolver {texto, relleno} para sobrescribir una celda.
  function tablaHuella(h, o = {}) {
    const cab = VIZ.el('tr', null, VIZ.el('th', null, ''), ...h.acts.map((b) => VIZ.el('th', { class: o.sel && o.sel[1] === b ? 'clave' : null }, b)));
    const filas = h.acts.map((a) => VIZ.el('tr', null,
      VIZ.el('th', { class: 'izq' + (o.sel && o.sel[0] === a ? ' clave' : '') }, a),
      ...h.acts.map((b) => {
        const r = o.celda ? o.celda(a, b) : { texto: h.rel[a][b], relleno: COLOR_REL[h.rel[a][b]] };
        const esSel = o.sel && o.sel[0] === a && o.sel[1] === b;
        return VIZ.el('td', {
          title: `${a} ${h.rel[a][b]} ${b}`,
          style: { background: r.relleno ? VIZ.alfa(r.relleno, esSel ? 0.55 : 0.22) : (esSel ? VIZ.alfa(C.tinta, 0.18) : null), color: r.tinta || C.tinta, fontWeight: esSel ? '700' : '400' },
          onclick: o.alClic ? () => o.alClic(a, b) : null,
        }, r.texto);
      })));
    return VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, cab), VIZ.el('tbody', null, ...filas));
  }

  // Selector de ejemplo + texto editable que comparten estado.
  function editor(ctl, inicial, alCambiar) {
    let clave = inicial;
    const sel = ctl.selector({ etiqueta: 'Registro de ejemplo', opciones: opcionesEj, valor: clave, alCambiar: (v) => { clave = v; txt.valor = EJ[v][1]; alCambiar(EJ[v][1]); } });
    const txt = ctl.texto({ etiqueta: 'Trazas (traza:veces, actividades a–j)', valor: EJ[clave][1], alCambiar: (v) => alCambiar(v) });
    return { sel, txt };
  }
  function compilar(texto) {
    const log = P.logSimple(leerTrazas(texto));
    const acts = P.actividades(log);
    if (!log.length || acts.length > 10) return null;
    return { log, vars: P.variantes(log), h: P.huella(log) };
  }

  /* ---------- Fig. 1: de las trazas a la matriz ---------- */

  function montarMatriz(cuerpo) {
    let texto = EJ.mixto[1], dato = null, sel = null;
    const ctl = VIZ.controles(cuerpo);
    editor(ctl, 'mixto', (v) => { texto = v; sel = null; dibujar(); });
    ctl.boton('Quitar selección', () => { sel = null; dibujar(); });
    VIZ.leyenda(cuerpo, LEYENDA_REL);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda (fila a, columna b) para ver en qué trazas aparece «ab» (azul) y «ba» (aguamarina). Edite el registro: la matriz se recalcula en el acto.');

    function dibujar() {
      dato = compilar(texto);
      if (!dato) { caja.replaceChildren(); lista.replaceChildren(VIZ.el('div', null, 'Sin registro válido (letras a–j, hasta 10 actividades).')); registro.textContent = 'Escriba al menos una traza.'; lectura.set([['casos', '0']]); return; }
      const { h, vars, log } = dato;
      if (sel && !(h.acts.includes(sel[0]) && h.acts.includes(sel[1]))) sel = null;
      caja.replaceChildren(tablaHuella(h, { sel, alClic: (a, b) => { sel = [a, b]; dibujar(); } }));
      lista.replaceChildren(...vars.map((v) => {
        const partes = [];
        v.traza.forEach((x, i) => {
          const sig = v.traza[i + 1];
          let col = null;
          if (sel && sig !== undefined) { if (x === sel[0] && sig === sel[1]) col = C.s1; else if (x === sel[1] && sig === sel[0]) col = C.s3; }
          partes.push(VIZ.el('span', { style: { color: col, fontWeight: col ? '700' : '400' } }, x));
        });
        return VIZ.el('div', null, ...partes, `  ×${v.n}`);
      }));
      let c = 0, p = 0, e = 0;
      for (const a of h.acts) for (const b of h.acts) if (a < b) { const r = h.rel[a][b]; if (r === '‖') p++; else if (r === '#') e++; else c++; }
      lectura.set([
        ['casos / variantes', `${log.length} / ${vars.length}`],
        ['pares a > b distintos', String(h.d.aristas.length)],
        ['pares causales →', String(c)],
        ['pares paralelos ‖', String(p)],
        ['pares sin relación #', String(e)],
      ]);
      if (sel) {
        const [a, b] = sel, ab = h.d.n(a, b), ba = h.d.n(b, a);
        registro.textContent = a === b
          ? (ab ? `${a} > ${a} ocurre ${ab} vez/veces: se anota ${a} ‖ ${a}, el signo de un bucle de longitud 1 (α no lo sabe tratar).` : `${a} no se repite inmediatamente: ${a} # ${a}.`)
          : `${a} > ${b}: ${ab} vez/veces; ${b} > ${a}: ${ba}. ` + (ab && !ba ? `Solo ${a} antes de ${b}: ${a} → ${b}.` : !ab && ba ? `Solo ${b} antes de ${a}: ${a} ← ${b}.` : ab && ba ? `Ambos órdenes: ${a} ‖ ${b}.` : `Nunca se siguen: ${a} # ${b}.`);
      } else registro.textContent = 'Seleccione una celda para ver su evidencia en el registro.';
    }
    dibujar();
  }

  /* ---------- Fig. 2: construir la matriz paso a paso ---------- */

  function montarPasos(cuerpo) {
    let texto = EJ.mixto[1], dato = null, cuenta = new Map(), cur = null, fase = 0, fila = -1, msg = '';
    const ctl = VIZ.controles(cuerpo);
    editor(ctl, 'mixto', (v) => { texto = v; rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    VIZ.leyenda(cuerpo, [{ color: C.s4, texto: 'par a > b que se está leyendo' }, ...LEYENDA_REL]);
    const traza = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(traza);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Primera pasada: cada par de eventos consecutivos suma a la celda (a, b) tantas veces como casos tenga su variante. Segunda pasada: cada fila se reemplaza por sus relaciones →, ←, ‖ o #.');

    function iniciar() {
      dato = compilar(texto);
      cuenta = new Map(); cur = null; fase = 0; fila = -1;
      msg = dato ? 'Pulse Un paso: se leerán los pares de eventos consecutivos de cada variante.' : 'Escriba al menos una traza válida.';
      if (!dato) return (function* () {})();
      return (function* () {
        const { vars, h } = dato;
        for (const v of vars) {
          for (let i = 0; i + 1 < v.traza.length; i++) {
            cur = { v, i };
            const k = v.traza[i] + v.traza[i + 1];
            cuenta.set(k, (cuenta.get(k) || 0) + v.n);
            msg = `Variante ${v.traza.join('')} (×${v.n}): ${v.traza[i]} > ${v.traza[i + 1]} suma ${v.n}; la celda queda en ${cuenta.get(k)}.`;
            yield;
          }
        }
        cur = null; fase = 1;
        for (let r = 0; r < h.acts.length; r++) {
          fila = r;
          msg = `Fila ${h.acts[r]}: cada celda pasa de «cuántas veces a > b» a la relación entre ${h.acts[r]} y la columna.`;
          yield;
        }
        fase = 2; fila = h.acts.length;
        msg = 'Matriz de huellas completa: lo que sigue (α, mineros) trabaja solo con ella.';
      })();
    }
    function dibujar() {
      if (!dato) { traza.replaceChildren(); caja.replaceChildren(); registro.textContent = msg; lectura.set([['casos', '0']]); return; }
      const { h, vars } = dato;
      traza.replaceChildren(VIZ.el('div', null, cur ? [...cur.v.traza].map((x, i) => VIZ.el('span', { style: { color: i === cur.i || i === cur.i + 1 ? C.s2 : null, fontWeight: i === cur.i || i === cur.i + 1 ? '700' : '400' } }, x)) : (fase ? 'todas las variantes leídas' : 'variante actual: —')));
      caja.replaceChildren(tablaHuella(h, {
        celda: (a, b) => {
          const r = h.acts.indexOf(a);
          if (fase >= 1 && r < fila) return { texto: h.rel[a][b], relleno: COLOR_REL[h.rel[a][b]] };
          const n = cuenta.get(a + b) || 0;
          const activa = cur && cur.v.traza[cur.i] === a && cur.v.traza[cur.i + 1] === b;
          return { texto: n ? String(n) : '·', relleno: activa ? C.s4 : null, tinta: n ? C.tinta : C.apagado };
        },
      }));
      registro.textContent = msg;
      lectura.set([
        ['variantes', String(vars.length)],
        ['pares leídos', String([...cuenta.values()].length ? [...cuenta.keys()].length : 0)],
        ['eventos consecutivos contados', String([...cuenta.values()].reduce((s, v) => s + v, 0))],
        ['fase', fase === 0 ? '1: contar a > b' : fase === 1 ? '2: derivar relaciones' : 'terminado'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 3: patrones de control en la matriz ---------- */

  function tipoGrupo(h, S) {
    if (S.length < 2) return null;
    let sin = 0, par = 0, otro = 0;
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const r = h.rel[S[i]][S[j]];
      if (r === '#') sin++; else if (r === '‖') par++; else otro++;
    }
    return otro ? 'irregular' : par && !sin ? 'AND' : sin && !par ? 'XOR' : 'mixto';
  }
  const COLOR_TIPO = { AND: C.s7, XOR: C.s2, mixto: C.s8, irregular: C.s8 };

  function montarPatrones(cuerpo) {
    let texto = EJ.eleccion[1], dato = null, foco = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    editor(ctl, 'eleccion', (v) => { texto = v; foco = null; calcular(); });
    ctl.boton('Quitar selección', () => { foco = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'a → b (relación causal)', forma: 'linea' },
      { color: C.s2, texto: 'bifurcación o unión XOR (elección)', forma: 'cuadro' },
      { color: C.s7, texto: 'bifurcación o unión AND (paralelo)', forma: 'cuadro' },
      { color: C.s8, texto: 'patrón mixto o irregular', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una actividad con varios sucesores causales es una bifurcación: si los sucesores son # entre sí, es una elección (XOR); si son ‖, es paralelo (AND). Haga clic en una actividad para resaltar sus líneas.');

    function calcular() {
      dato = compilar(texto);
      if (dato) {
        const { h } = dato;
        const suc = {}, pre = {};
        for (const a of h.acts) {
          suc[a] = h.acts.filter((b) => h.rel[a][b] === '→');
          pre[a] = h.acts.filter((b) => h.rel[a][b] === '←');
        }
        const ids = ['ini', ...h.acts, 'fin'];
        const ar = [];
        h.acts.forEach((a) => suc[a].forEach((b) => ar.push([a, b])));
        [...h.d.ini.keys()].forEach((a) => ar.push(['ini', a]));
        [...h.d.fin.keys()].forEach((a) => ar.push([a, 'fin']));
        dato.suc = suc; dato.pre = pre; dato.ar = ar; dato.pos = P.disponer(ids, ar);
      }
      dibujar();
    }
    function dibujar() {
      lienzo.limpiar();
      if (!dato) { lista.replaceChildren(VIZ.el('div', null, 'Sin registro válido.')); registro.textContent = 'Escriba al menos una traza.'; lectura.set([['casos', '0']]); return; }
      const { h, suc, pre, ar, pos } = dato;
      const lineas = [];
      const nodos = [{ id: 'ini', tipo: 'inicio' }, { id: 'fin', tipo: 'fin' }];
      let nXor = 0, nAnd = 0, nOtro = 0;
      for (const a of h.acts) {
        const s = tipoGrupo(h, suc[a]), j = tipoGrupo(h, pre[a]);
        if (s) lineas.push({ a, texto: `${a} → {${suc[a].join(', ')}}: bifurcación ${s}`, det: s === 'AND' ? 'los sucesores son paralelos' : s === 'XOR' ? 'los sucesores son excluyentes' : s === 'mixto' ? 'unos sucesores son paralelos y otros excluyentes' : 'algún sucesor depende de otro' });
        if (j) lineas.push({ a, texto: `{${pre[a].join(', ')}} → ${a}: unión ${j}`, det: j === 'AND' ? 'los predecesores son paralelos' : j === 'XOR' ? 'los predecesores son excluyentes' : j === 'mixto' ? 'predecesores mixtos' : 'algún predecesor depende de otro' });
        for (const t of [s, j]) if (t) { if (t === 'XOR') nXor++; else if (t === 'AND') nAnd++; else nOtro++; }
        const partes = [];
        if (j) partes.push(`entra ${j}`);
        if (s) partes.push(`sale ${s}`);
        nodos.push({ id: a, tipo: 'act', etiqueta: a, insignia: partes.join(', ') || null, colorInsignia: COLOR_TIPO[s || j] || null, anillo: foco === a ? C.s1 : null });
      }
      const aristas = ar.map(([de, a]) => ({ de, a, color: foco && (de === foco || a === foco) ? C.s1 : C.apagado, ancho: foco && (de === foco || a === foco) ? 3 : 1.5 }));
      geo = P.dibujarGrafo(lienzo, nodos, aristas, pos);
      lista.replaceChildren(...(lineas.length ? lineas.map((l) => VIZ.el('div', { class: l.a === foco ? 'activa' : null }, `${l.texto}  (${l.det})`)) : [VIZ.el('div', null, 'No hay bifurcaciones: el modelo es una secuencia.')]));
      const par = [];
      for (const a of h.acts) for (const b of h.acts) if (a < b && h.rel[a][b] === '‖') par.push(a + '‖' + b);
      lectura.set([
        ['actividades', String(h.acts.length)],
        ['relaciones causales', String(ar.length - h.d.ini.size - h.d.fin.size)],
        ['patrones XOR', String(nXor)],
        ['patrones AND', String(nAnd)],
        ['mixtos o irregulares', String(nOtro)],
        ['pares paralelos', par.join(' ') || 'ninguno'],
      ]);
      registro.textContent = foco
        ? `${foco}: antecesores {${pre[foco].join(', ') || '—'}}, sucesores {${suc[foco].join(', ') || '—'}}.`
        : 'Cada bifurcación o unión de la lista se lee directamente de la matriz de huellas, sin mirar las trazas.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), n = P.nodoEn(geo, x, y);
      foco = n && n.id !== 'ini' && n.id !== 'fin' && n.id !== foco ? n.id : null;
      dibujar();
    });
    calcular();
  }

  VIZ.registrarTema('footprint-matrix', {
    intro: String.raw`
      <p>Antes de dibujar un modelo hay que decidir, para cada par de actividades, cómo se relacionan: ¿una precede a la otra, pueden ocurrir en cualquier
      orden, o nunca aparecen juntas? La <strong>matriz de huellas</strong> (<em>footprint matrix</em>) responde con una tabla de símbolos
      calculada solo mirando qué actividad sigue directamente a cuál.</p>
      <p>Es el puente entre el registro y los algoritmos de descubrimiento: el <a href="tema.html?id=alpha-algorithm">algoritmo α</a> no vuelve a mirar las trazas, solo esta
      tabla. Por eso dos registros muy distintos pueden dar el mismo modelo si tienen la misma huella.</p>`,
    visualizaciones: [
      {
        titulo: 'De las trazas a la matriz',
        descripcion: 'Edite las trazas y observe cómo cambia cada celda. Haga clic en una celda para ver en qué trazas aparecen «ab» y «ba»; pruebe el ejemplo del bucle de longitud 1 y mire la diagonal.',
        montar: montarMatriz,
      },
      {
        titulo: 'Construcción paso a paso',
        descripcion: 'Primero se cuentan los pares consecutivos a > b; después cada fila se transforma en relaciones. Reproduzca despacio y compare con la matriz final de la figura anterior.',
        montar: montarPasos,
      },
      {
        titulo: 'Dependencias que se leen en la huella',
        descripcion: 'La matriz se convierte en un grafo causal con las bifurcaciones y uniones marcadas como XOR o AND. Haga clic en una actividad y cambie de registro para ver cómo la huella delata elecciones y paralelos.',
        montar: montarPatrones,
      },
    ],
    teoria: String.raw`
      <h2>Relaciones de orden</h2>
      <p>Sea \(L\) un registro sobre actividades \(A\). Para \(a, b \in A\) se define la <strong>sucesión directa</strong>
      \[ a &gt;_L b \iff \exists\, \sigma = \langle t_1, \dots, t_n \rangle \in L,\ \exists\, i &lt; n :\ t_i = a \ \wedge\ t_{i+1} = b. \]
      A partir de ella se obtienen cuatro relaciones excluyentes entre sí:</p>
      <table>
        <tr><th>Relación</th><th>Definición</th><th>Lectura</th></tr>
        <tr><td>\(a \to_L b\)</td><td>\(a &gt;_L b\) y \(b \not&gt;_L a\)</td><td>causalidad: \(b\) sigue a \(a\) y nunca al revés</td></tr>
        <tr><td>\(a \leftarrow_L b\)</td><td>\(b \to_L a\)</td><td>la misma relación vista desde \(b\)</td></tr>
        <tr><td>\(a \parallel_L b\)</td><td>\(a &gt;_L b\) y \(b &gt;_L a\)</td><td>paralelismo (o, en realidad, ambos órdenes)</td></tr>
        <tr><td>\(a \,\#_L\, b\)</td><td>\(a \not&gt;_L b\) y \(b \not&gt;_L a\)</td><td>exclusión: nunca son vecinas</td></tr>
      </table>
      <p>La <strong>matriz de huellas</strong> es la tabla \(A \times A\) con estas relaciones. Es antisimétrica en el sentido de que \(\to\) y \(\leftarrow\) se
      reflejan, y \(\parallel\) y \(\#\) son simétricas.</p>
      <h2>Ejemplo</h2>
      <p>Para \(L = \{\langle a,b,c,d\rangle, \langle a,c,b,d\rangle, \langle a,e,d\rangle\}\):</p>
      <table>
        <tr><th></th><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th></tr>
        <tr><th>a</th><td>#</td><td>→</td><td>→</td><td>#</td><td>→</td></tr>
        <tr><th>b</th><td>←</td><td>#</td><td>‖</td><td>→</td><td>#</td></tr>
        <tr><th>c</th><td>←</td><td>‖</td><td>#</td><td>→</td><td>#</td></tr>
        <tr><th>d</th><td>#</td><td>←</td><td>←</td><td>#</td><td>←</td></tr>
        <tr><th>e</th><td>←</td><td>#</td><td>#</td><td>→</td><td>#</td></tr>
      </table>
      <p>Se lee que \(a\) se bifurca hacia \(b\), \(c\) y \(e\); que \(b \parallel c\) (hay una variante en cada orden) mientras \(b \,\#\, e\) y \(c \,\#\, e\) (elección);
      y que \(d\) reúne a todos.</p>
      <h2>Cómo se calcula</h2>
      <pre><code>para cada traza σ del registro:
    para i ← 1 hasta |σ| − 1:
        marcar (σ[i], σ[i+1]) en la tabla a &gt; b
para cada par (a, b):
    ab ← a &gt; b;  ba ← b &gt; a
    relación ← '→' si ab y no ba, '←' si ba y no ab,
               '‖' si ab y ba,    '#' si ninguno</code></pre>
      <p>El costo es lineal en el número total de eventos, más \(|A|^2\) para llenar la tabla.</p>
      <h2>Qué dice y qué no dice</h2>
      <ul>
        <li><strong>Patrones</strong>: una bifurcación \(a \to \{b, c\}\) con \(b \,\#\, c\) es una elección; con \(b \parallel c\), un paralelo. Lo mismo vale para las uniones.</li>
        <li><strong>Equivalencia por huella</strong>: registros distintos con la misma huella producen el mismo modelo, aunque tengan frecuencias y variantes diferentes.</li>
        <li><strong>Diagonal</strong>: \(a &gt; a\) (la misma actividad dos veces seguidas) se anota \(a \parallel a\), lo que rompe el algoritmo; véase <a href="tema.html?id=alpha-limitations">las limitaciones de α</a>.</li>
        <li><strong>Frecuencia ignorada</strong>: un solo evento ruidoso basta para convertir \(\to\) en \(\parallel\); se estudia en <a href="tema.html?id=noise-and-incompleteness">ruido e incompletitud</a>.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>La relación \(&gt;_L\) es el <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a> sin frecuencias; la huella lo clasifica. De ella parte el
      <a href="tema.html?id=alpha-algorithm">algoritmo α</a> del <a href="tema.html?id=process-discovery">descubrimiento de procesos</a>. Las trazas y variantes que alimentan la
      tabla se explican en <a href="tema.html?id=traces-and-variants">trazas y variantes</a>.</p>`,
  });
})();
