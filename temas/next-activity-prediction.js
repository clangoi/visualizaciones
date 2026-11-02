(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const PROCESOS = { pedidos: 'pedidos (con actividades en paralelo)', reclamos: 'reclamos (con un bucle de investigación)' };
  const FIN = 'FIN';
  const pct = (v) => `${Math.round(v * 1000) / 10} %`;

  const secuencia = (c) => [...c.eventos.map((e) => e.act), FIN];

  /* ---------- Modelo n-grama con retroceso ---------- */

  // Cuenta, para cada contexto de largo 1 … orden, qué actividad vino a continuación.
  function entrenar(casos, orden) {
    const m = new Map();
    for (const c of casos) {
      const s = secuencia(c);
      for (let k = 1; k < s.length; k++) for (let o = 1; o <= Math.min(orden, k); o++) {
        const clave = o + '|' + s.slice(k - o, k).join('›');
        if (!m.has(clave)) m.set(clave, new Map());
        const d = m.get(clave);
        d.set(s[k], (d.get(s[k]) || 0) + 1);
      }
    }
    return { m, orden };
  }
  // Distribución de la próxima actividad dado un prefijo; se usa el contexto más largo visto (retroceso).
  function predecir(modelo, prefijo) {
    for (let o = Math.min(modelo.orden, prefijo.length); o >= 1; o--) {
      const clave = o + '|' + prefijo.slice(prefijo.length - o).join('›'), d = modelo.m.get(clave);
      if (d) {
        const total = [...d.values()].reduce((s, v) => s + v, 0);
        const lista = [...d.entries()].map(([a, n]) => ({ a, n, p: n / total })).sort((x, z) => z.n - x.n || x.a.localeCompare(z.a));
        return { lista, total, o, contexto: prefijo.slice(prefijo.length - o) };
      }
    }
    return { lista: [], total: 0, o: 0, contexto: [] };
  }

  const cache = new Map();
  function datos(proceso) {
    if (!cache.has(proceso)) {
      const arbol = P.procesos[proceso].arbol;
      cache.set(proceso, { train: P.simular(arbol, 3000, 31, {}), test: P.simular(arbol, 300, 32, {}) });
    }
    return cache.get(proceso);
  }

  /* ---------- Fig. 1: la distribución sobre la próxima actividad ---------- */

  function montarDistribucion(cuerpo) {
    let proceso = 'pedidos', orden = 1, k = 2, indice = 0, modelo = null, seq = [], filas = [], nFilas = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: Object.entries(PROCESOS), valor: proceso, alCambiar: (v) => { proceso = v; entrenarYElegir(); } });
    ctl.rango({ etiqueta: 'Orden n del modelo', min: 1, max: 3, valor: orden, alCambiar: (v) => { orden = v; entrenarYElegir(true); } });
    const rK = ctl.rango({ etiqueta: 'Largo del prefijo k', min: 1, max: 6, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Otro caso', () => { indice++; elegir(); }, { primario: true });
    const prefijoVista = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(prefijoVista);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 24 + nFilas * 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'probabilidad estimada de que sea la próxima actividad', forma: 'cuadro' },
      { color: C.s6, texto: 'la actividad que ocurrió realmente', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El modelo mira solo las últimas n actividades del prefijo y reparte probabilidad según lo que pasó después en 3000 casos históricos; si ese contexto nunca se vio, retrocede a uno más corto. «FIN» significa que el caso termina. Pase el cursor sobre una barra para ver los conteos.');

    function entrenarYElegir(mantener) {
      modelo = entrenar(datos(proceso).train, orden);
      if (!mantener) elegir(); else dibujar();
    }
    function elegir() {
      const t = datos(proceso).test;
      seq = secuencia(t[(indice * 37 + 3) % t.length]);
      rK.max = seq.length - 1;
      k = Math.min(Math.max(1, k), seq.length - 1);
      rK.valor = k;
      dibujar();
    }
    function dibujar() {
      if (!modelo || !seq.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pref = seq.slice(0, k), real = seq[k];
      const pr = predecir(modelo, pref);
      const lista = pr.lista.slice(0, 6);
      if (!lista.some((q) => q.a === real)) lista.push({ a: real, n: 0, p: 0, nuncaVisto: true });
      if (lista.length !== nFilas) { nFilas = lista.length; lienzo.ajustar(true); return; }
      prefijoVista.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'prefijo:'),
        ...pref.map((a, i) => VIZ.ficha(a, i >= pref.length - pr.o ? { color: C.s1, fondo: VIZ.alfa(C.s1, 0.12) } : { color: C.tenue, tinta: C.apagado })));
      const filaH = 30, x0 = Math.min(150, lienzo.ancho * 0.4), x1 = lienzo.ancho - 52;
      ctx.font = VIZ.fuente(11);
      filas = [];
      lista.forEach((q, i) => {
        const y = 14 + i * filaH, w = Math.max(0, (x1 - x0) * q.p), esReal = q.a === real;
        ctx.fillStyle = esReal ? C.tinta : C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        const etiqueta = q.a.length > 19 ? q.a.slice(0, 18) + '…' : q.a;
        ctx.font = VIZ.fuente(11, esReal ? 700 : 400);
        ctx.fillText(etiqueta, x0 - 8, y + 10);
        ctx.fillStyle = esReal ? C.s6 : C.s1;
        if (w > 0) { ctx.beginPath(); ctx.roundRect(x0, y, w, 20, [0, 4, 4, 0]); ctx.fill(); }
        ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0 + 0.5, y - 3); ctx.lineTo(x0 + 0.5, y + 23); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(11, 600);
        ctx.fillText(q.nuncaVisto ? '0 %' : pct(q.p), x0 + w + 6, y + 10);
        filas.push({ y, q });
      });
      const rango = pr.lista.findIndex((q) => q.a === real);
      registro.textContent = pr.o
        ? `Contexto usado (orden ${pr.o}${pr.o < Math.min(orden, k) ? ', tras retroceder' : ''}): «${pr.contexto.join(' › ')}», visto ${pr.total} veces. El modelo apuesta por «${pr.lista[0].a}» con ${pct(pr.lista[0].p)}; ocurrió «${real}»${rango === 0 ? ': acierto.' : rango > 0 && rango < 3 ? ': no es la primera, pero está entre las tres más probables.' : rango < 0 ? ': algo que nunca había pasado tras ese contexto.' : '.'}`
        : 'Contexto nunca visto en el entrenamiento.';
      lectura.set([
        ['contexto usado', pr.o ? `orden ${pr.o}` : '—'], ['observaciones del contexto', String(pr.total)],
        ['predicción top-1', pr.lista.length ? pr.lista[0].a : '—'], ['ocurrió', real],
        ['posición de lo ocurrido', rango >= 0 ? `${rango + 1}.ª` : 'fuera del modelo'],
        ['top-1 / top-3', `${rango === 0 ? 'acierta' : 'falla'} / ${rango >= 0 && rango < 3 ? 'acierta' : 'falla'}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), f = filas.find((r) => y >= r.y - 3 && y <= r.y + 23);
      if (!f) return tip.ocultar();
      tip.mostrar(x, y, `<b>${f.q.a}</b><br>${f.q.n} de ${predecir(modelo, seq.slice(0, k)).total} veces<br>probabilidad <b>${pct(f.q.p)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    entrenarYElegir();
  }

  /* ---------- Fig. 2: precisión según el largo del prefijo ---------- */

  const techos = new Map();
  const ORDENES = [[1, C.s1], [2, C.s2], [3, C.s3]];
  const KMAX = 8;

  function montarPrecision(cuerpo) {
    let proceso = 'pedidos', topK = 1, nEnt = 200, curvas = {}, techo = [], plano = null, global = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: Object.entries(PROCESOS), valor: proceso, alCambiar: (v) => { proceso = v; calcular(); } });
    ctl.selector({ etiqueta: 'Acierto', opciones: [['1', 'top-1: la primera opción'], ['3', 'top-3: entre las tres primeras']], valor: String(topK), alCambiar: (v) => { topK = +v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos de entrenamiento', min: 10, max: 1000, paso: 10, valor: nEnt, alCambiar: (v) => { nEnt = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...ORDENES.map(([o, c]) => ({ color: c, texto: `n = ${o}`, forma: 'linea' })),
      { color: C.apagado, texto: 'referencia: historia completa, 3000 casos', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se evalúa con 300 casos de prueba: para cada prefijo, ¿la actividad real figura entre las k primeras del modelo? La línea punteada es un predictor de historia completa entrenado con 3000 casos: si incluso ella queda lejos de 100 %, la causa es la aleatoriedad del proceso (decisiones y paralelismo), no el modelo.');

    function evaluar(modelo, test) {
      const acc = Array.from({ length: KMAX }, () => ({ ok: 0, n: 0 }));
      let ok = 0, n = 0;
      for (const c of test) {
        const s = secuencia(c);
        for (let k = 1; k < s.length; k++) {
          const top = predecir(modelo, s.slice(0, k)).lista.slice(0, topK).map((q) => q.a), hit = top.includes(s[k]) ? 1 : 0;
          ok += hit; n++;
          if (k <= KMAX) { acc[k - 1].ok += hit; acc[k - 1].n++; }
        }
      }
      return { por: acc.map((a, i) => ({ k: i + 1, p: a.n ? a.ok / a.n : NaN, n: a.n })), total: ok / n };
    }
    function calcular() {
      const { train, test } = datos(proceso);
      curvas = {}; global = {};
      for (const [o] of ORDENES) { const r = evaluar(entrenar(train.slice(0, nEnt), o), test); curvas[o] = r.por; global[o] = r.total; }
      const clave = proceso + topK;
      if (!techos.has(clave)) techos.set(clave, evaluar(entrenar(train, 8), test));
      const t = techos.get(clave);
      techo = t.por; global.techo = t.total;
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0.7, xmax: KMAX + 0.3, ymin: 0, ymax: 1.05 }, { etiquetaX: 'largo del prefijo k', etiquetaY: `precisión top-${topK}`, ticksX: [1, 2, 3, 4, 5, 6, 7, 8], ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      VIZ.trazar(ctx, plano, techo.map((q) => [q.k, q.p]), C.apagado, 1.5, [4, 4]);
      for (const [o, c] of ORDENES) {
        VIZ.trazar(ctx, plano, curvas[o].map((q) => [q.k, q.p]), c, 2);
        curvas[o].forEach((q) => Number.isFinite(q.p) && VIZ.marcador(ctx, plano.sx(q.k), plano.sy(q.p), c, 3.5, o - 1));
      }
      registro.textContent = `Precisión top-${topK} global con ${nEnt} casos: n = 1 → ${pct(global[1])}, n = 2 → ${pct(global[2])}, n = 3 → ${pct(global[3])}; la referencia con 3000 casos es ${pct(global.techo)}.`;
      lectura.set([
        ...ORDENES.map(([o]) => [`n = ${o}`, pct(global[o])]), ['referencia (3000 casos)', pct(global.techo)],
        ['prefijos de prueba', String(curvas[1].reduce((s, q) => s + q.n, 0))],
      ]);
    }
    lienzo.alDibujar = () => curvas[1] && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const k = Math.min(KMAX, Math.max(1, Math.round(plano.ix(x))));
      tip.mostrar(x, y, `prefijo <b>k = ${k}</b> · ${curvas[1][k - 1].n} casos`
        + ORDENES.map(([o, c]) => VIZ.filaTooltip(c, `n = ${o}`, pct(curvas[o][k - 1].p))).join('') + VIZ.filaTooltip(C.apagado, 'referencia', pct(techo[k - 1].p)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('next-activity-prediction', {
    intro: String.raw`
      <p>Si un caso lleva las actividades «Registrar pedido» y «Verificar stock», ¿qué hará después? Responderlo permite preparar recursos, mostrar al operador la acción más
      probable o avisar al cliente. La <strong>predicción de la próxima actividad</strong> aprende del historial qué suele seguir a cada prefijo.</p>
      <p>El modelo más simple es una cadena de Markov de orden \(n\): la probabilidad de la próxima actividad depende solo de las últimas \(n\) actividades. No hace falta conocer el modelo del
      proceso; basta contar. Su límite es doble: un contexto corto confunde situaciones distintas, y uno largo se ve pocas veces. Además, cuando hay actividades en paralelo o decisiones
      aleatorias, ni el mejor predictor puede acertar siempre.</p>`,
    visualizaciones: [
      {
        titulo: 'Probabilidades de la próxima actividad',
        descripcion: 'Elija un caso y avance el prefijo: el modelo reparte probabilidad sobre lo que viene. En pedidos, lleve k justo después de «Preparar envío» (use «Otro caso» hasta que aparezca) y compare n = 1 con n = 2: con n = 2 el modelo sabe si la factura ya se emitió y la duda desaparece.',
        montar: montarDistribucion,
      },
      {
        titulo: 'Precisión según el largo del prefijo',
        descripcion: 'Compare los órdenes 1, 2 y 3 con la línea de referencia. Pase de top-1 a top-3 para ver cuánto cubre el paralelismo, y reduzca los casos de entrenamiento: los órdenes altos sufren primero porque ven pocos contextos.',
        montar: montarPrecision,
      },
    ],
    teoria: String.raw`
      <h2>Modelo n-grama sobre prefijos</h2>
      <p>Sea \(\sigma=\langle a_1,\dots,a_m\rangle\) una traza y \(a_{m+1}=\text{FIN}\) el símbolo de término. Se estima</p>
      \[ \hat P(a_{k+1}=b \mid a_1\dots a_k) \;=\; \frac{N(a_{k-n+1}\dots a_k\,b)}{N(a_{k-n+1}\dots a_k\,\cdot)}, \]
      <p>donde \(N(\cdot)\) cuenta apariciones en el historial. Para \(n=1\) es la <em>cadena de Markov</em> de primer orden, equivalente a las frecuencias relativas de salida en el
      <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>. Se predice \(\hat b=\arg\max_b \hat P(b\mid\text{contexto})\) y, para recomendar, se muestran las \(k\) mejores.</p>
      <h2>Retroceso</h2>
      <p>Un contexto de orden \(n\) puede no haberse visto nunca; entonces se retrocede al orden \(n-1\), y así hasta 1. Es la versión más simple del <em>backoff</em>. Otras alternativas
      suavizan las probabilidades (por ejemplo, sumar un conteo a todo) o reemplazan el conteo por un modelo secuencial de aprendizaje profundo.</p>
      <pre><code>entrenar(casos, n):
    para cada caso y cada k de 1 a largo:
        para o de 1 a min(n, k):
            conteo[ últimas o actividades ][ siguiente ] += 1
predecir(prefijo):
    para o de min(n, k) hasta 1:
        si existe conteo[ últimas o actividades ]: devolver sus probabilidades
    devolver «sin información»</code></pre>
      <h2>Precisión top-k y su límite</h2>
      <p>La precisión top-\(k\) es la fracción de prefijos cuya próxima actividad real está entre las \(k\) más probables:
      \(\text{acc}_k=\frac1N\sum_i \mathbf 1[b_i\in \text{top}_k(\sigma_i)]\). Su valor máximo no es 1. Con un <em>XOR</em> de probabilidades \(p\) y \(1-p\), el mejor predictor
      de un solo intento acierta con probabilidad \(\max(p,1-p)\). Con dos actividades en <em>paralelo</em>, antes de que ocurra ninguna de las dos el orden es una moneda al aire: el máximo top-1 ahí es \(1/2\)
      aunque el modelo sea perfecto, y top-2 lo resuelve. Por eso la figura 2 añade una referencia, medida con un predictor de historia completa y mucho entrenamiento: sirve para distinguir lo que falla por falta de datos de lo que es irreducible.</p>
      <div class="recuadro">Un contexto más largo no siempre mejora: reduce el sesgo (distingue más situaciones) pero aumenta la varianza (menos observaciones por contexto). Con pocos casos,
      el orden 1 supera al 3; con muchos, ocurre lo contrario. Es el mismo compromiso que en <a href="tema.html?id=generalization-simplicity">Generalization and Simplicity</a>.</div>
      <h2>Conexiones</h2>
      <p>Predecir la próxima actividad es una de las funciones de <a href="tema.html?id=operational-support">Operational Support</a>. Con el mismo esquema de prefijos se predice el
      <a href="tema.html?id=remaining-time-prediction">tiempo restante</a>, y los puntos de decisión donde el modelo duda son los candidatos naturales para
      <a href="tema.html?id=decision-points">Decision Points</a>.</p>`,
  });
})();
