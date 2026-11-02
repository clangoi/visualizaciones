(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Modelos, fitness y precisión (ayudantes de este tema) ---------- */

  const ACTS = 'abcdefgh';
  // Proceso de referencia: a, luego b, c y d en paralelo, luego e, f o g, y por último h (6 × 3 = 18 variantes).
  const MUNDO = P.sec(P.act('a'), P.y(P.act('b'), P.act('c'), P.act('d')), P.xor([P.act('e'), P.act('f'), P.act('g')]), P.act('h'));
  const VARIANTES_MUNDO = [];
  ['bcd', 'bdc', 'cbd', 'cdb', 'dbc', 'dcb'].forEach((p) => ['e', 'f', 'g'].forEach((x) => VARIANTES_MUNDO.push(['a' + p + x + 'h', 1])));

  // Variantes de un registro como [{ s: 'abcdf', n }].
  const variantesDe = (log) => P.variantes(log).map((v) => ({ s: v.traza.join(''), n: v.n }));

  // Costo mínimo de alinear la traza `a` con la palabra `b` (movimientos de registro y de modelo de costo 1).
  function distancia(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, a[i - 1] === b[j - 1] ? prev[j - 1] : Infinity);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Un modelo expone: ini (estado), paso(estado, a) → estado | null, habil(estado) → { acts, fin }, lenguaje (palabras o null si es infinito y lo permite todo).
  function modeloTrazas(palabras) {
    const pref = new Set(), comp = new Set(palabras);
    palabras.forEach((w) => { for (let i = 0; i <= w.length; i++) pref.add(w.slice(0, i)); });
    return {
      ini: '', lenguaje: [...comp],
      paso: (s, a) => (pref.has(s + a) ? s + a : null),
      habil: (s) => ({ acts: [...ACTS].filter((a) => pref.has(s + a)), fin: comp.has(s) }),
    };
  }
  function lenguajeRed(red, tope = 11, cap = 300) {
    const out = [];
    const final = (m) => (m[red.fin] || 0) === 1 && Object.keys(m).every((k) => k === red.fin || !m[k]);
    (function dfs(m, w) {
      if (out.length >= cap) return;
      if (final(m)) out.push(w);
      if (w.length >= tope) return;
      for (const t of red.trans) if (P.habilitada(red, m, t.id)) dfs(P.disparar(red, m, t.id), w + t.nombre);
    })(P.marcadoInicial(red), '');
    return [...new Set(out)];
  }
  function modeloRed(red) {
    const final = (m) => (m[red.fin] || 0) === 1 && Object.keys(m).every((k) => k === red.fin || !m[k]);
    return {
      red, ini: P.marcadoInicial(red), lenguaje: lenguajeRed(red),
      paso: (m, a) => { const t = red.trans.find((x) => x.nombre === a); return t && P.habilitada(red, m, t.id) ? P.disparar(red, m, t.id) : null; },
      habil: (m) => ({ acts: [...new Set(red.trans.filter((t) => P.habilitada(red, m, t.id)).map((t) => t.nombre))], fin: final(m) }),
    };
  }
  // «Flower model»: cualquier secuencia de actividades, en cualquier orden y cantidad.
  const modeloFlor = () => ({ ini: '', lenguaje: null, paso: (s) => s, habil: () => ({ acts: [...ACTS], fin: true }) });
  const modeloExacto = () => modeloRed(P.alfa(P.logSimple(VARIANTES_MUNDO)).red);

  // Fitness por alineamientos: 1 − costo total / costo del peor alineamiento posible.
  function fitnessDe(modelo, vars) {
    if (!modelo.lenguaje) return 1;
    const palabras = modelo.lenguaje, minLen = palabras.length ? Math.min(...palabras.map((w) => w.length)) : 0;
    let costo = 0, peor = 0;
    for (const v of vars) {
      const c = palabras.length ? Math.min(...palabras.map((w) => (w === v.s ? 0 : distancia(v.s, w)))) : v.s.length;
      costo += c * v.n; peor += (v.s.length + minLen) * v.n;
    }
    return peor ? 1 - costo / peor : 1;
  }

  // Precisión por «aristas que escapan» (ETC): en cada prefijo del registro se compara lo que el modelo habilita con lo que el registro hizo.
  // Devuelve { precision, prefijos: Map(prefijo → { n, obs, ok, E, esc }) }.
  function precisionDe(modelo, vars) {
    const mapa = new Map();
    for (const v of vars) {
      let estado = modelo.ini, ok = true;
      for (let i = 0; i <= v.s.length; i++) {
        const k = v.s.slice(0, i);
        let e = mapa.get(k);
        if (!e) { e = { n: 0, obs: new Set(), ok, E: null, esc: [] }; mapa.set(k, e); if (ok) { const h = modelo.habil(estado); e.E = [...h.acts, ...(h.fin ? ['■'] : [])]; } }
        e.n += v.n;
        const sig = i < v.s.length ? v.s[i] : '■';
        e.obs.add(sig);
        if (i < v.s.length && ok) { const st = modelo.paso(estado, v.s[i]); if (st === null) ok = false; else estado = st; }
      }
    }
    let esc = 0, hab = 0;
    for (const e of mapa.values()) {
      if (!e.ok) continue;
      e.esc = e.E.filter((x) => !e.obs.has(x));
      esc += e.n * e.esc.length; hab += e.n * e.E.length;
    }
    return { precision: hab ? 1 - esc / hab : 1, prefijos: mapa, esc, hab };
  }

  const NA = ACTS.length;
  const NOM = ['Modelo de trazas', 'Red Alfa', 'Flower model'];
  const CORTO = ['Trazas', 'Alfa', 'Flower'];
  const PRUEBA = variantesDe(P.simular(MUNDO, 300, 12345)); // «futuro» limpio y grande: solo para medir

  // Modelos construidos a partir de un registro de entrenamiento (lista de casos).
  function construir(casos) {
    const vs = variantesDe(casos);
    return [modeloTrazas(vs.map((v) => v.s)), modeloRed(P.alfa(casos).red), modeloFlor()];
  }
  // Tamaño estructural de cada modelo como red de Petri: plazas + transiciones + arcos.
  function tamano(modelos) {
    const tr = modelos[0].lenguaje, red = modelos[1].red;
    const sumaK = tr.reduce((s, w) => s + w.length, 0);
    return [
      { pl: 2 + sumaK - tr.length, tr: sumaK, ar: 2 * sumaK },
      { pl: red.plazas.length, tr: red.trans.length, ar: red.arcos.length },
      { pl: 3, tr: NA + 2, ar: 4 + 2 * NA },
    ].map((t) => ({ ...t, N: t.pl + t.tr + t.ar }));
  }
  const NREF = 4 * NA + 1; // una secuencia pura de las NA actividades: NA + 1 plazas, NA transiciones, 2·NA arcos
  const simplicidad = (t) => Math.min(1, NREF / t.N);

  /* ---------- Fig. 1: curva de aprendizaje ---------- */

  // Modelo de trazas que solo incluye las variantes con al menos `minF` casos (siempre queda la más frecuente).
  function modeloFiltrado(casos, minF) {
    const vs = variantesDe(casos), fil = vs.filter((v) => v.n >= minF);
    return modeloTrazas((fil.length ? fil : vs.slice(0, 1)).map((v) => v.s));
  }
  // Validación cruzada de 5 pliegues: el caso i va al pliegue i mod 5.
  function validacion(casos, minF) {
    let g = 0;
    for (let f = 0; f < 5; f++) {
      const m = modeloFiltrado(casos.filter((_, i) => i % 5 !== f), minF);
      g += fitnessDe(m, variantesDe(casos.filter((_, i) => i % 5 === f))) / 5;
    }
    return g;
  }

  const NS = [5, 6, 8, 12, 16, 24, 36, 54, 80];
  function montarCurva(cuerpo) {
    let ruido = 0.1, minF = 1, base = 1, sel = 6, hover = -1, curva = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.3, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos mínimos por variante', min: 1, max: 5, valor: minF, alCambiar: (v) => { minF = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { base++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'registro de entrenamiento', forma: 'linea' },
      { color: C.s1, texto: '300 casos nuevos (prueba real)', forma: 'linea' },
      { color: C.s2, texto: 'validación cruzada (solo con el registro)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El modelo es el de trazas: permite exactamente las variantes del registro que tengan al menos los casos indicados. Cada punto promedia 8 registros del tamaño n. Pase el cursor para comparar y haga clic para fijar un n y leer la brecha. La validación cruzada (naranja) debería parecerse a la prueba real (azul) sin necesitar casos nuevos. Subir los casos mínimos por variante simplifica el modelo, pero también deja fuera casos legítimos.');

    function calcular() {
      curva = NS.map((n) => {
        const R = 8, acc = [0, 0, 0, 0];
        for (let s = 1; s <= R; s++) {
          const casos = P.simular(MUNDO, n, base * 1000 + s * 17 + n, { ruido });
          const m = modeloFiltrado(casos, minF);
          acc[0] += fitnessDe(m, variantesDe(casos)) / R;
          acc[1] += fitnessDe(m, PRUEBA) / R;
          acc[2] += validacion(casos, minF) / R;
          acc[3] += (2 + 4 * m.lenguaje.reduce((t, w) => t + w.length, 0) - m.lenguaje.length) / R;
        }
        return acc;
      });
      dibujar();
    }
    function dibujar() {
      if (!curva) return;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: NS.length - 1, ymin: 0.5, ymax: 1.02 }, {
        etiquetaX: 'casos de entrenamiento n', etiquetaY: 'fitness medio',
        ticksX: NS.map((_, i) => i), formatoX: (v) => NS[v], ticksY: [0.5, 0.6, 0.7, 0.8, 0.9, 1], formatoY: (v) => VIZ.fmt(v, 2),
      });
      plano.ejes();
      const { ctx } = lienzo;
      const serie = (k) => curva.map((r, i) => [i, r[k]]);
      VIZ.trazar(ctx, plano, serie(0), C.apagado, 2, [5, 4]);
      VIZ.trazar(ctx, plano, serie(2), C.s2, 2.5);
      VIZ.trazar(ctx, plano, serie(1), C.s1, 2.5);
      const marca = (i) => { [[0, C.apagado], [1, C.s1], [2, C.s2]].forEach(([k, c]) => VIZ.marcador(ctx, plano.sx(i), plano.sy(Math.max(0.5, curva[i][k])), c, 4)); };
      if (sel >= 0) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(plano.sx(sel), plano.y0); ctx.lineTo(plano.sx(sel), plano.y1); ctx.stroke(); ctx.setLineDash([]);
        marca(sel);
      }
      if (hover >= 0 && hover !== sel) marca(hover);
      const r = curva[sel];
      lectura.set([
        ['n elegido', String(NS[sel])], ['entrenamiento', VIZ.fmt(r[0], 3)], ['prueba real', VIZ.fmt(r[1], 3)],
        ['validación cruzada', VIZ.fmt(r[2], 3)], ['brecha (entren. − prueba)', VIZ.fmt(r[0] - r[1], 3)], ['tamaño del modelo', VIZ.entero(r[3])],
      ]);
      registro.textContent = `Con n = ${NS[sel]} casos el modelo ajusta ${VIZ.fmt(r[0], 3)} al registro que vio pero ${VIZ.fmt(r[1], 3)} a casos nuevos: brecha de ${VIZ.fmt(r[0] - r[1], 3)}. La validación cruzada estima ${VIZ.fmt(r[2], 3)} sin usar casos nuevos.`;
    }
    lienzo.alDibujar = dibujar;
    const idx = (x) => (plano && plano.dentro(x, plano.y1 + 1) ? Math.max(0, Math.min(NS.length - 1, Math.round(plano.ix(x)))) : -1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = idx(x);
      hover = i; dibujar();
      if (i < 0) return tip.ocultar();
      const r = curva[i];
      tip.mostrar(x, y, `n = <b>${NS[i]}</b>${VIZ.filaTooltip(C.apagado, 'entrenamiento', VIZ.fmt(r[0], 3))}${VIZ.filaTooltip(C.s1, 'prueba real', VIZ.fmt(r[1], 3))}${VIZ.filaTooltip(C.s2, 'validación cruzada', VIZ.fmt(r[2], 3))}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const i = idx(lienzo.posicion(ev).x); if (i >= 0) { sel = i; dibujar(); } });
    calcular();
  }

  /* ---------- Fig. 2: las cuatro dimensiones ---------- */

  function montarCuatro(cuerpo) {
    let nCasos = 30, ruido = 0, semilla = 2, sel = -1, res = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos en el registro', min: 10, max: 150, paso: 5, valor: nCasos, alCambiar: (v) => { nCasos = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.2, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const DIM = [['fitness', C.s1], ['precisión', C.s2], ['generalización', C.s3], ['simplicidad', C.s4]];
    VIZ.leyenda(cuerpo, DIM.map(([t, c]) => ({ color: c, texto: t, forma: 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Fitness y precisión se miden sobre el registro; la generalización es el fitness medio sobre casos retenidos en una validación cruzada de 5 pliegues (se entrena con 4/5 y se prueba con el 1/5 restante); la simplicidad compara el tamaño de la red con el de una secuencia pura. Pase el cursor o haga clic en un modelo para ver su tamaño.');

    function calcular() {
      const casos = P.simular(MUNDO, nCasos, semilla, { ruido });
      const vs = variantesDe(casos), ms = construir(casos), tam = tamano(ms);
      // Validación cruzada de 5 pliegues: el caso i va al pliegue i mod 5.
      const gen = [0, 0, 0];
      for (let f = 0; f < 5; f++) {
        const ent = casos.filter((_, i) => i % 5 !== f), prueba = variantesDe(casos.filter((_, i) => i % 5 === f));
        const mf = construir(ent);
        mf.forEach((m, i) => { gen[i] += fitnessDe(m, prueba) / 5; });
      }
      res = ms.map((m, i) => ({ f: fitnessDe(m, vs), p: precisionDe(m, vs).precision, g: gen[i], s: simplicidad(tam[i]), t: tam[i] }));
      res.nVar = vs.length;
      dibujar();
    }
    function dibujar() {
      if (!res) return;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 3, ymin: 0, ymax: 1.1 }, { ticksX: [], ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => VIZ.fmt(v, 2), margen: { inf: 30 } });
      plano.ejes();
      const { ctx } = lienzo;
      geo = [];
      const paso = plano.sx(1) - plano.sx(0), bw = Math.min(34, paso * 0.2);
      res.forEach((r, i) => {
        const gx = plano.sx(i + 0.5), vals = [r.f, r.p, r.g, r.s];
        vals.forEach((v, k) => {
          const x = gx + (k - 2) * bw, top = plano.sy(v);
          ctx.fillStyle = DIM[k][1]; ctx.beginPath(); ctx.roundRect(x + 1, top, bw - 2, plano.y0 - top, [4, 4, 0, 0]); ctx.fill();
          if (bw >= 26) { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(VIZ.fmt(v, 2), x + bw / 2, top - 3); }
        });
        if (i === sel) { ctx.strokeStyle = C.s7; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(gx - 2 * bw - 3, plano.y1, 4 * bw + 6, plano.y0 - plano.y1 + 2, 6); ctx.stroke(); }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(CORTO[i], gx, plano.y0 + 8);
        geo.push({ x0: gx - 2 * bw - 3, x1: gx + 2 * bw + 3, i });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const k = sel >= 0 ? sel : 1, r = res[k];
      lectura.set([
        ['modelo', NOM[k]], ['plazas / transiciones / arcos', `${r.t.pl} / ${r.t.tr} / ${r.t.ar}`], ['tamaño total', String(r.t.N)],
        ['tamaño de una secuencia', String(NREF)], ['variantes en el registro', String(res.nVar)],
      ]);
      registro.textContent = `${NOM[k]}: simplicidad = ${NREF} / ${r.t.N} = ${VIZ.fmt(r.s, 3)} (se trunca a 1). ${k === 0 ? 'Cada variante añade su propia cadena de transiciones: el modelo crece con el registro.' : k === 1 ? 'La estructura de elecciones y paralelismos es compartida por todas las variantes.' : 'Una sola plaza central con una transición por actividad: pequeñísimo, pero sin información de orden.'}`;
    }
    lienzo.alDibujar = dibujar;
    const sobre = (x) => geo.findIndex((g) => x >= g.x0 && x <= g.x1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = sobre(x);
      if (i < 0) return tip.ocultar();
      const r = res[i];
      tip.mostrar(x, y, `<b>${NOM[i]}</b>${[r.f, r.p, r.g, r.s].map((v, k) => VIZ.filaTooltip(DIM[k][1], DIM[k][0], VIZ.fmt(v, 3))).join('')}tamaño <b>${r.t.N}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const i = sobre(lienzo.posicion(ev).x); sel = i === sel ? -1 : i; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('generalization-simplicity', {
    intro: String.raw`
      <p>Un modelo que reproduce a la perfección el registro del que salió puede estar solo <em>memorizándolo</em>. La <strong>generalización</strong> pregunta por lo que no se ve:
      ¿reproducirá también las trazas nuevas del mismo proceso? Un registro casi nunca contiene todas las variantes posibles, así que un buen modelo debe aceptar algunas que no vio.</p>
      <p>La <strong>simplicidad</strong> es la cuarta dimensión: entre dos modelos que explican igual de bien los datos, conviene el más pequeño y fácil de leer (la navaja de Occam).
      Junto con el fitness y la precisión forman las cuatro dimensiones de calidad de un modelo de procesos.</p>`,
    visualizaciones: [
      {
        titulo: 'Entrenamiento frente a prueba',
        descripcion: 'Con todas las variantes, el modelo de trazas ajusta 1 al registro que vio pero menos a casos nuevos: la brecha es mayor con pocos casos y se cierra al crecer n. La curva naranja estima esa prueba sin casos nuevos. Suba «Casos mínimos por variante» y vea cómo el modelo se simplifica a costa de generalizar peor.',
        montar: montarCurva,
      },
      {
        titulo: 'Las cuatro dimensiones juntas',
        descripcion: 'Fitness, precisión, generalización (validación cruzada) y simplicidad de tres modelos sobre un mismo registro. Ninguno gana en todo: el de trazas ajusta y es preciso pero es enorme; el flower model es simple y no tiene brecha, pero poco preciso.',
        montar: montarCuatro,
      },
    ],
    teoria: String.raw`
      <h2>Generalización</h2>
      <p>Sea \(L\) el registro observado y \(\mathcal{P}\) el proceso real que lo generó. Un modelo \(M\) <strong>generaliza</strong> bien si reproduce las trazas de \(\mathcal{P}\) que no están en \(L\).
      Como \(\mathcal{P}\) es desconocido, se estima con datos retenidos: en la <strong>validación cruzada</strong> de \(k\) pliegues se divide \(L\) en \(k\) partes; para cada una se descubre un modelo con las otras \(k-1\)
      y se mide su fitness sobre la parte retenida:</p>
      \[ \text{generalización}(L) = \frac1k \sum_{i=1}^{k} \text{fitness}\big(L_i,\; \text{descubrir}(L \setminus L_i)\big). \]
      <pre><code>para i ← 1 hasta k:
    entrenamiento ← todos los casos salvo los del pliegue i
    M ← descubrir(entrenamiento)
    g[i] ← fitness(casos del pliegue i, M)
devolver promedio de g</code></pre>
      <p>La diferencia entre el fitness en el entrenamiento y en la prueba es la <em>brecha de generalización</em>: la señal clásica de sobreajuste. Un registro pequeño con trazas distintas (variantes únicas) produce modelos de trazas con brecha grande.
      Otras medidas estiman, sin dividir, cuántas veces los eventos del modelo aparecen en pocos casos.</p>
      <h2>Simplicidad</h2>
      <p>No hay una única definición. En este tema se usa una medida de tamaño: el número de plazas, transiciones y arcos de la red de Petri,
      \(N = |P| + |T| + |F|\), comparado con el de una secuencia pura de las \(m\) actividades (\(N_{\min} = 4m + 1\)):</p>
      \[ \text{simplicidad}(M) = \min\!\left(1,\; \frac{N_{\min}}{N}\right). \]
      <p>Otras alternativas miden el grado medio de arcos o el número de nodos duplicados. Todas penalizan lo mismo: modelos que repiten estructura (como el de trazas, que crece con el número de variantes) o con enredos de arcos.</p>
      <h2>Las cuatro dimensiones</h2>
      <table>
        <tr><th>Dimensión</th><th>Pregunta</th><th>Falla típica</th></tr>
        <tr><td>Fitness</td><td>¿reproduce el registro?</td><td>modelo demasiado restrictivo</td></tr>
        <tr><td>Precisión</td><td>¿evita permitir de más?</td><td>flower model</td></tr>
        <tr><td>Generalización</td><td>¿acepta casos nuevos legítimos?</td><td>modelo de trazas (sobreajuste)</td></tr>
        <tr><td>Simplicidad</td><td>¿es el más pequeño que explica los datos?</td><td>modelos con estructura repetida</td></tr>
      </table>
      <p>Descubrir un modelo es buscar un compromiso entre las cuatro; en la práctica se priorizan según el objetivo del análisis (auditoría exige fitness; documentación, simplicidad).
      Los dos primeros se desarrollan en <a href="tema.html?id=fitness-precision">fitness y precisión</a>; el <a href="tema.html?id=inductive-miner">Inductive Miner</a> garantiza fitness perfecto, y el
      <a href="tema.html?id=heuristic-miner">Heuristic Miner</a> cambia fitness por simplicidad filtrando el ruido. El <a href="tema.html?id=alpha-algorithm">algoritmo Alfa</a> de las figuras solo funciona bien con registros completos y limpios (vea <a href="tema.html?id=noise-and-incompleteness">ruido e incompletitud</a>).
      Para comparar algoritmos, vea <a href="tema.html?id=discovery-comparison">comparación de algoritmos</a>.</p>`,
  });
})();
