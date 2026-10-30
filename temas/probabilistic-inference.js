(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const R = M.RED_ALARMA;
  const ID = R.nodos.map((n) => n.id);

  /* Factores sobre variables binarias: { vars: [índices], t: Float64Array(2^k) } con el bit j de la posición = valor de vars[j]. */
  function factorDeCPT(i, ev) {
    const nd = R.nodos[i], todas = [...nd.padres, i];
    const vars = todas.filter((v) => ev[v] == null), t = new Float64Array(1 << vars.length);
    for (let m = 0; m < t.length; m++) {
      const val = (v) => (ev[v] != null ? ev[v] : (m >> vars.indexOf(v)) & 1);
      const p = nd.cpt[nd.padres.map(val).join(',')];
      t[m] = val(i) ? p : 1 - p;
    }
    return { vars, t, nombre: `P(${nd.id}${nd.padres.length ? ' | ' + nd.padres.map((p) => ID[p]).join(',') : ''})` };
  }
  function multiplicar(fs) {
    const vars = [...new Set(fs.flatMap((f) => f.vars))].sort((a, b) => a - b), t = new Float64Array(1 << vars.length);
    for (let m = 0; m < t.length; m++) {
      let p = 1;
      for (const f of fs) { let k = 0; f.vars.forEach((v, j) => { k |= ((m >> vars.indexOf(v)) & 1) << j; }); p *= f.t[k]; }
      t[m] = p;
    }
    return { vars, t };
  }
  function sumar(f, v) {
    const j = f.vars.indexOf(v), vars = f.vars.filter((x) => x !== v), t = new Float64Array(1 << vars.length);
    for (let m = 0; m < f.t.length; m++) { let k = 0, b = 0; f.vars.forEach((x, q) => { if (q !== j) { k |= ((m >> q) & 1) << b; b++; } }); t[k] += f.t[m]; }
    return { vars, t };
  }
  const nombreF = (vars, k) => `f${k}(${vars.map((v) => ID[v]).join(',') || '∅'})`;

  /* ---------- Fig. 1: eliminación de variables ---------- */

  function montarEliminacion(cuerpo) {
    let consulta = 0, evJ = true, evM = true, orden = 'EA', est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Consulta', opciones: [[0, 'P(Robo | evidencia)'], [1, 'P(Terremoto | evidencia)']], valor: consulta, alCambiar: (v) => { consulta = +v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Orden de eliminación', opciones: [['EA', 'primero la otra causa, luego A'], ['AE', 'primero A, luego la otra causa']], valor: orden, alCambiar: (v) => { orden = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'evidencia: Juan llama', valor: evJ, alCambiar: (v) => { evJ = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'evidencia: María llama', valor: evM, alCambiar: (v) => { evM = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'factor creado en este paso' }, { color: C.s1, texto: 'factores que se multiplican' }, { color: C.inactivo, texto: 'factores que esperan' }]);
    const caja = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(caja);
    VIZ.subtitulo(cuerpo, 'Tabla del factor actual');
    const tabla = M.tabla(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma todos los factores que mencionan la variable a eliminar, los multiplica y suma esa variable. El orden no cambia el resultado, pero sí el tamaño de los factores intermedios.');
    function iniciar() {
      const ev = {};
      if (evJ) ev[3] = 1; if (evM) ev[4] = 1;
      const otra = consulta === 0 ? 1 : 0;
      const ocultas = (orden === 'EA' ? [otra, 2] : [2, otra]).concat([3, 4].filter((v) => ev[v] == null));
      est = { factores: R.nodos.map((_, i) => ({ ...factorDeCPT(i, ev), k: null })), usados: [], nuevo: null, msg: '', resultado: null, mayor: 0, k: 0 };
      est.factores.forEach((f) => { f.etiqueta = f.nombre; });
      return (function* () {
        est.msg = `Factores iniciales: las ${R.nodos.length} CPT, con la evidencia ya fijada (las variables observadas desaparecen).`;
        yield;
        for (const v of ocultas) {
          const usar = est.factores.filter((f) => f.vars.includes(v));
          est.usados = usar; est.nuevo = null;
          est.msg = `Eliminar ${ID[v]}: multiplicar ${usar.map((f) => f.etiqueta).join(' · ')}.`;
          yield;
          const prod = multiplicar(usar), s = sumar(prod, v);
          est.k++; s.etiqueta = nombreF(s.vars, est.k);
          est.mayor = Math.max(est.mayor, prod.vars.length);
          est.factores = est.factores.filter((f) => !usar.includes(f)).concat([s]);
          est.usados = []; est.nuevo = s;
          est.msg = `Σ sobre ${ID[v]}: el producto tenía ${prod.vars.length} variables (${prod.t.length} entradas); queda ${s.etiqueta}.`;
          yield;
        }
        const f = multiplicar(est.factores), z = f.t[0] + f.t[1];
        est.resultado = { vars: f.vars, t: Float64Array.from(f.t, (x) => x / z), etiqueta: `P(${ID[consulta]} | evidencia)` };
        est.nuevo = est.resultado; est.usados = est.factores;
        est.msg = `Multiplicar los factores restantes y normalizar: la suma era ${VIZ.fmt(z, 4)} = P(evidencia).`;
        yield;
      })();
    }
    function dibujar() {
      caja.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'Factores:'), ...est.factores.map((f) =>
        VIZ.ficha(`${f.etiqueta} · ${f.t.length}`, f === est.nuevo ? { color: C.s2, fondo: VIZ.alfa(C.s2, 0.12) } : est.usados.includes(f) ? { color: C.s1, fondo: VIZ.alfa(C.s1, 0.12) } : { color: C.inactivo })));
      const f = est.nuevo || est.factores[est.factores.length - 1];
      tabla.set([...f.vars.map((v) => ID[v]), f.etiqueta || 'valor'], Array.from(f.t, (v, m) => [...f.vars.map((_, j) => ((m >> j) & 1 ? 'sí' : 'no')), VIZ.fmt(v, 4)]).reverse());
      registro.textContent = est.msg || 'Pulse Un paso.';
      const exacto = M.posteriores(R, Object.fromEntries([[3, evJ ? 1 : null], [4, evM ? 1 : null]].filter(([, v]) => v != null))).marg[consulta];
      lectura.set([
        ['resultado P(sí)', est.resultado ? VIZ.fmt(est.resultado.t[1], 4) : '—'],
        ['por enumeración (control)', VIZ.fmt(exacto, 4)],
        ['mayor factor intermedio', est.mayor ? `${est.mayor} variables` : '—'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: inferencia por muestreo ---------- */

  function montarMuestreo(cuerpo) {
    let evid = 'JM', semilla = 1, filas = [], exacto = 0, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Evidencia', opciones: [['JM', 'Juan y María llaman (rara)'], ['J', 'solo Juan llama'], ['A', 'sonó la alarma']], valor: evid, alCambiar: (v) => { evid = v; calcular(); } });
    ctl.boton('Otra corrida', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'muestreo por rechazo', forma: 'linea' },
      { color: C.s2, texto: 'ponderación por verosimilitud', forma: 'linea' },
      { color: C.s6, texto: 'valor exacto', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Estimaciones de P(Robo | evidencia) según el número de muestras (escala logarítmica). El rechazo genera de la red completa y descarta lo que no coincide con la evidencia: si la evidencia es rara, casi todo se descarta. La ponderación fija la evidencia y pesa cada muestra por su verosimilitud.');
    function calcular() {
      const ev = { JM: { 3: 1, 4: 1 }, J: { 3: 1 }, A: { 2: 1 } }[evid];
      exacto = M.posteriores(R, ev).marg[0];
      const rnd = VIZ.semilla(semilla);
      let acept = 0, robosR = 0, wTot = 0, wRobo = 0;
      filas = [];
      const marcas = new Set(Array.from({ length: 41 }, (_, i) => Math.round(10 ** (1 + i / 10))));
      for (let s = 1; s <= 100000; s++) {
        // Rechazo: muestreo ancestral completo.
        const x = [];
        R.nodos.forEach((nd, i) => { x[i] = rnd() < nd.cpt[nd.padres.map((p) => x[p]).join(',')] ? 1 : 0; });
        if (Object.entries(ev).every(([i, v]) => x[i] === v)) { acept++; robosR += x[0]; }
        // Ponderación por verosimilitud.
        const y = []; let w = 1;
        R.nodos.forEach((nd, i) => { const p = nd.cpt[nd.padres.map((q) => y[q]).join(',')]; if (ev[i] != null) { y[i] = ev[i]; w *= ev[i] ? p : 1 - p; } else y[i] = rnd() < p ? 1 : 0; });
        wTot += w; wRobo += w * y[0];
        if (marcas.has(s)) filas.push({ s, rech: acept ? robosR / acept : NaN, pond: wTot ? wRobo / wTot : NaN, acept });
      }
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.min(1, Math.max(exacto * 2.5, 0.05));
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 5, ymin: 0, ymax }, { etiquetaX: 'muestras (10^x)', etiquetaY: 'P̂(robo | evidencia)', formatoX: (v) => VIZ.entero(10 ** v), formatoY: (v) => `${VIZ.fmt(v * 100, 3)}%` });
      pl.ejes();
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, [[1, exacto], [5, exacto]], C.s6, 2, [5, 4]);
      VIZ.trazar(ctx, pl, filas.map((f) => [Math.log10(f.s), f.rech]), C.s1, 2);
      VIZ.trazar(ctx, pl, filas.map((f) => [Math.log10(f.s), f.pond]), C.s2, 2);
      ctx.restore();
      if (hover) { VIZ.marcador(ctx, pl.sx(Math.log10(hover.s)), pl.sy(Math.min(ymax, hover.pond)), C.s2, 4); if (Number.isFinite(hover.rech)) VIZ.marcador(ctx, pl.sx(Math.log10(hover.s)), pl.sy(Math.min(ymax, hover.rech)), C.s1, 4); }
      const u = filas[filas.length - 1];
      lectura.set([
        ['exacto', VIZ.fmt(exacto, 4)],
        ['rechazo con 100.000 muestras', Number.isFinite(u.rech) ? VIZ.fmt(u.rech, 4) : '—'],
        ['muestras aceptadas', `${VIZ.entero(u.acept)} (${M.pct(u.acept / 1e5, 2)})`],
        ['ponderación con 100.000 muestras', VIZ.fmt(u.pond, 4)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const lx = pl.ix(x);
      hover = filas.reduce((a, b) => (Math.abs(Math.log10(b.s) - lx) < Math.abs(Math.log10(a.s) - lx) ? b : a));
      dibujar();
      tip.mostrar(x, y, `<b>${VIZ.entero(hover.s)}</b> muestras` + VIZ.filaTooltip(C.s1, `rechazo (${hover.acept} aceptadas)`, Number.isFinite(hover.rech) ? VIZ.fmt(hover.rech, 4) : '—') + VIZ.filaTooltip(C.s2, 'ponderación', VIZ.fmt(hover.pond, 4)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('probabilistic-inference', {
    intro: String.raw`
      <p>Hacer <strong>inferencia</strong> en una <a href="tema.html?id=bayesian-networks">red bayesiana</a> es calcular la distribución de
      algunas variables dada la evidencia observada en otras. En principio basta <strong>marginalizar</strong>: sumar la conjunta sobre todas
      las variables que no interesan. Pero esa suma tiene \(2^n\) términos.</p>
      <p>La <strong>eliminación de variables</strong> reordena la suma para aprovechar la factorización de la red, y cuando ni eso alcanza,
      los métodos de <strong>muestreo</strong> estiman las probabilidades simulando la red.</p>`,
    visualizaciones: [
      {
        titulo: 'Eliminación de variables',
        descripcion: 'El cálculo exacto de P(Robo | Juan y María llaman) como una secuencia de productos y sumas de tablas. Cambie el orden y compare el tamaño del mayor factor.',
        montar: montarEliminacion,
      },
      {
        titulo: 'Inferencia por muestreo',
        descripcion: 'Dos estimadores por simulación convergiendo al valor exacto. Compare con evidencia rara y con evidencia común.',
        montar: montarMuestreo,
      },
    ],
    teoria: String.raw`
      <h2>Marginalizar con estructura</h2>
      <p>Para la consulta \(P(B \mid j, m)\) en la red de la alarma:</p>
      \[ P(B \mid j, m) \propto \sum_{e} \sum_{a} P(B)\,P(e)\,P(a \mid B, e)\,P(j \mid a)\,P(m \mid a)
         = P(B) \sum_{e} P(e) \underbrace{\sum_{a} P(a \mid B, e)\,P(j \mid a)\,P(m \mid a)}_{f_1(B, e)}. \]
      <p>Sacar de cada suma los factores que no dependen de la variable sumada evita repetir cálculos: es la propiedad distributiva
      \(\sum_x a\,g(x) = a \sum_x g(x)\).</p>
      <h2>Eliminación de variables</h2>
      <pre><code>factores ← CPT con la evidencia fijada
para cada variable oculta Z en el orden elegido:
    F ← factores que mencionan Z
    g ← Σ_z  Π_{f ∈ F} f            ← nuevo factor sin Z
    factores ← (factores \ F) ∪ {g}
devolver normalizar(Π factores)</code></pre>
      <p>El costo es exponencial en el tamaño del mayor factor intermedio, que depende del orden. Encontrar el orden óptimo es NP-difícil, pero
      en grafos sin ciclos no dirigidos (poliárboles) existe un orden lineal, y la <em>propagación de creencias</em> (paso de mensajes) calcula
      todas las marginales a la vez. En redes con ciclos se usa el árbol de uniones (<em>junction tree</em>).</p>
      <h2>Muestreo</h2>
      <ul>
        <li><strong>Rechazo</strong>: generar \(x \sim P\) en orden topológico y quedarse con las muestras compatibles con la evidencia. Insesgado,
        pero la fracción aceptada es \(P(\text{evidencia})\): con evidencia rara se desperdicia casi todo.</li>
        <li><strong>Ponderación por verosimilitud</strong>: fijar las variables observadas y pesar cada muestra por
        \(w = \prod_{i \in \text{evidencia}} P(e_i \mid \operatorname{Pa}_i)\). Usa todas las muestras, aunque los pesos pueden ser muy desiguales
        si la evidencia está «abajo» en la red.</li>
        <li><strong>MCMC (Gibbs)</strong>: recorrer los estados remuestreando cada variable dada su manto de Markov.</li>
      </ul>
      <p>El error de estos estimadores decrece como \(1/\sqrt{N_{\text{efectivo}}}\).</p>`,
  });
})();