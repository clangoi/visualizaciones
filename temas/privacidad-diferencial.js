(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: mecanismo de Laplace ---------- */

  function montarLaplace(cuerpo) {
    let eps = 0.5, delta = 1, semilla = 1, muestras = [], hover = null;
    const VERDAD = 42;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'ε (presupuesto de privacidad)', min: 0.05, max: 3, paso: 0.05, valor: eps, formato: (v) => v.toFixed(2), alCambiar: (v) => { eps = v; muestras = []; dibujar(); } });
    ctl.selector({ etiqueta: 'Consulta', valor: '1', opciones: [['1', 'conteo (Δ = 1)'], ['5', 'suma con tope 5 (Δ = 5)']], alCambiar: (v) => { delta = +v; muestras = []; dibujar(); } });
    ctl.boton('Publicar 200 respuestas', () => {
      const rnd = VIZ.semilla(semilla++);
      muestras = Array.from({ length: 200 }, () => VERDAD + B.laplace(rnd, delta / eps));
      dibujar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'respuesta si la base es D (valor real 42)', forma: 'linea' },
      { color: C.s2, texto: 'base vecina D′ (la misma, sin una persona)', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.3), texto: 'respuestas publicadas desde D' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las dos curvas son casi iguales: viendo una respuesta, el atacante no puede saber si la persona estaba. Pase el cursor y lea la razón entre ambas, que nunca supera e^ε.');
    const dens = (x, mu, b) => Math.exp(-Math.abs(x - mu) / b) / (2 * b);
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const b = delta / eps, mu2 = VERDAD - delta;
      const ancho = Math.min(60, Math.max(6, 6 * b));
      const xmin = VERDAD - ancho, xmax = VERDAD + ancho;
      const ymax = dens(VERDAD, VERDAD, b) * 1.25;
      plano = VIZ.plano(lienzo, { xmin, xmax, ymin: 0, ymax }, { etiquetaX: 'respuesta publicada', etiquetaY: 'densidad', formatoY: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      if (muestras.length) {
        const nb = 40, w = (xmax - xmin) / nb, h = new Array(nb).fill(0);
        muestras.forEach((m) => { const i = Math.floor((m - xmin) / w); if (i >= 0 && i < nb) h[i]++; });
        ctx.fillStyle = VIZ.alfa(C.s1, 0.3);
        h.forEach((c, i) => { const v = c / (muestras.length * w); ctx.fillRect(plano.sx(xmin + i * w) + 1, plano.sy(v), plano.sx(xmin + w) - plano.sx(xmin) - 2, plano.y0 - plano.sy(v)); });
      }
      for (const [mu, c] of [[VERDAD, C.s1], [mu2, C.s2]]) {
        const pts = [];
        for (let i = 0; i <= 400; i++) { const x = xmin + ((xmax - xmin) * i) / 400; pts.push([x, dens(x, mu, b)]); }
        VIZ.trazar(ctx, plano, pts, c, 2);
      }
      if (hover != null) {
        ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.sx(hover), plano.y0); ctx.lineTo(plano.sx(hover), plano.y1); ctx.stroke(); ctx.setLineDash([]);
        VIZ.marcador(ctx, plano.sx(hover), plano.sy(dens(hover, VERDAD, b)), C.s1, 4);
        VIZ.marcador(ctx, plano.sx(hover), plano.sy(dens(hover, mu2, b)), C.s2, 4);
      }
      const err = muestras.length ? muestras.reduce((s, m) => s + Math.abs(m - VERDAD), 0) / muestras.length : null;
      lectura.set([
        ['escala b = Δ/ε', VIZ.fmt(b, 3)],
        ['razón máxima e^ε', VIZ.fmt(Math.exp(eps), 3)],
        ['error medio esperado', VIZ.fmt(b, 3)],
        ['error medio medido', err == null ? '—' : VIZ.fmt(err, 3)],
        ['P(|ruido| > 5)', `${VIZ.fmt(100 * Math.exp(-5 / b), 3)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = plano.ix(x); dibujar();
      const b = delta / eps, f1 = dens(hover, VERDAD, b), f2 = dens(hover, VERDAD - delta, b);
      tip.mostrar(x, y, `respuesta ${VIZ.fmt(hover, 3)}` + VIZ.filaTooltip(C.s1, 'densidad con D', VIZ.fmt(f1, 3)) + VIZ.filaTooltip(C.s2, 'con D′', VIZ.fmt(f2, 3)) + `razón ${VIZ.fmt(Math.max(f1 / f2, f2 / f1), 3)} ≤ e^ε = ${VIZ.fmt(Math.exp(eps), 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: respuesta aleatorizada ---------- */

  function montarRespuesta(cuerpo) {
    let n = 500, p = 0.3, q = 0.5, semilla = 1, corridas = [], ultima = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Encuestados n', min: 50, max: 5000, paso: 50, valor: n, formato: VIZ.entero, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Proporción real que copió', min: 0, max: 1, paso: 0.05, valor: p, formato: (v) => `${Math.round(100 * v)} %`, alCambiar: (v) => { p = v; corridas = []; ultima = null; dibujar(); } });
    ctl.rango({ etiqueta: 'Prob. de responder la verdad', min: 0.1, max: 0.95, paso: 0.05, valor: q, formato: (v) => `${Math.round(100 * v)} %`, alCambiar: (v) => { q = v; corridas = []; ultima = null; dibujar(); } });
    ctl.boton('Encuestar', () => encuestar(1), { primario: true });
    ctl.boton('Encuestar 20 veces', () => encuestar(20));
    ctl.boton('Borrar', () => { corridas = []; ultima = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'estimación de una encuesta', forma: 'punto' },
      { color: C.s2, texto: 'proporción real', forma: 'linea' },
      { color: C.apagado, texto: '± 2 desviaciones teóricas', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada encuestado lanza una moneda: con probabilidad q dice la verdad y si no, responde al azar. Ningún «sí» individual prueba nada, pero el promedio se puede corregir.');
    function encuestar(veces) {
      for (let v = 0; v < veces; v++) {
        const rnd = VIZ.semilla(semilla++ * 7919);
        let si = 0;
        for (let i = 0; i < n; i++) {
          const verdad = rnd() < p;
          const r = rnd() < q ? verdad : rnd() < 0.5;
          if (r) si++;
        }
        const y = si / n, est = (y - (1 - q) / 2) / q;
        ultima = { n, si, est };
        corridas.push({ n, est });
      }
      dibujar();
    }
    const sd = (m) => { const y = q * p + (1 - q) / 2; return Math.sqrt((y * (1 - y)) / m) / q; };
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 5000, ymin: -0.3, ymax: 1.3 }, { etiquetaX: 'encuestados n', etiquetaY: 'proporción estimada', formatoY: (v) => `${Math.round(100 * v)} %` });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, p], [5000, p]], C.s2, 2);
      for (const sgn of [1, -1]) {
        const pts = [];
        for (let m = 50; m <= 5000; m += 25) pts.push([m, p + sgn * 2 * sd(m)]);
        VIZ.trazar(ctx, plano, pts, C.apagado, 1.5, [3, 4]);
      }
      corridas.forEach((c) => VIZ.marcador(ctx, plano.sx(c.n), plano.sy(Math.max(-0.3, Math.min(1.3, c.est))), C.s1, 3.5));
      ctx.strokeStyle = C.tinta2; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(plano.sx(n), plano.y0); ctx.lineTo(plano.sx(n), plano.y1); ctx.stroke(); ctx.setLineDash([]);
      const eps = Math.log((q + (1 - q) / 2) / ((1 - q) / 2));
      registro.textContent = ultima
        ? `${VIZ.entero(ultima.si)} de ${VIZ.entero(ultima.n)} dijeron «sí» (${VIZ.fmt((100 * ultima.si) / ultima.n, 3)} %). Corrigiendo: p̂ = (ȳ − ${VIZ.fmt((1 - q) / 2, 2)}) / ${VIZ.fmt(q, 2)} = ${VIZ.fmt(100 * ultima.est, 3)} %.`
        : 'Pulse «Encuestar» para simular una encuesta con la pregunta «¿copió en la prueba?».';
      lectura.set([
        ['ε del mecanismo', VIZ.fmt(eps, 3)],
        ['P(sí | copió) / P(sí | no)', VIZ.fmt(Math.exp(eps), 3)],
        ['desviación teórica con este n', `${VIZ.fmt(100 * sd(n), 3)} pts`],
        ['encuestas simuladas', String(corridas.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; return tip.ocultar(); }
      hover = Math.max(50, Math.round(plano.ix(x) / 50) * 50);
      tip.mostrar(x, y, `n = <b>${VIZ.entero(hover)}</b><br>desviación de p̂: ${VIZ.fmt(100 * sd(hover), 3)} puntos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); });
    dibujar();
  }

  VIZ.registrarTema('privacidad-diferencial', {
    intro: String.raw`
      <p>La <strong>privacidad diferencial</strong> (Dwork, McSherry, Nissim y Smith, 2006) cambia la pregunta. En vez de transformar los datos
      hasta que «parezcan» anónimos, exige algo del <em>algoritmo</em> que los procesa: su resultado debe ser casi igual de probable con
      o sin cualquier persona en la base. Así, nada de lo que se publique puede depender demasiado de alguien en particular.</p>
      <p>Se logra agregando <strong>ruido aleatorio</strong> calibrado. La garantía no depende de qué sabe el atacante ni de qué otras
      fuentes existan, y se puede componer: cada consulta gasta parte de un <em>presupuesto</em> \(\varepsilon\). La usan el censo de
      EE. UU. de 2020, Apple, Google y Microsoft.</p>`,
    visualizaciones: [
      {
        titulo: 'El mecanismo de Laplace',
        descripcion: 'La distribución de la respuesta publicada para dos bases que difieren en una persona. Baje ε y vea cómo se superponen (más privacidad) a costa de un error mayor.',
        montar: montarLaplace,
      },
      {
        titulo: 'Respuesta aleatorizada',
        descripcion: 'Una encuesta sobre algo vergonzoso donde cada persona miente con cierta probabilidad. Las estimaciones agregadas siguen siendo útiles y el error baja como 1/√n.',
        montar: montarRespuesta,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Dos bases \(D\) y \(D'\) son <strong>vecinas</strong> si difieren en una persona. Un mecanismo aleatorio \(\mathcal M\) es
      \(\varepsilon\)-diferencialmente privado si para todo par de vecinas y todo conjunto de resultados \(S\),</p>
      \[ \Pr[\mathcal M(D) \in S] \;\le\; e^{\varepsilon}\, \Pr[\mathcal M(D') \in S]. \]
      <div class="recuadro">Interpretación: cualquier conclusión que un atacante saque del resultado la habría sacado, casi con la misma
      probabilidad, si la persona no hubiera participado. Para \(\varepsilon\) pequeño, \(e^\varepsilon \approx 1 + \varepsilon\). La
      versión \((\varepsilon, \delta)\) permite además una probabilidad \(\delta\) muy pequeña de violar la cota.</div>

      <h2>Mecanismo de Laplace</h2>
      <p>La <strong>sensibilidad</strong> de una consulta numérica \(f\) es cuánto puede cambiar por una persona:
      \(\Delta f = \max_{D \sim D'} |f(D) - f(D')|\). Un COUNT tiene \(\Delta = 1\); una suma de valores acotados en \([0, M]\) tiene
      \(\Delta = M\). El mecanismo publica</p>
      \[ \mathcal M(D) = f(D) + \text{Lap}\!\left(\frac{\Delta f}{\varepsilon}\right), \qquad
         \text{Lap}(b):\; p(x) = \frac{1}{2b} e^{-|x|/b}. \]
      <p>La razón entre las densidades centradas en \(f(D)\) y \(f(D')\) es \(e^{(|x - f(D')| - |x - f(D)|)/b} \le e^{\Delta f / b} = e^\varepsilon\).
      El error esperado es \(b = \Delta f/\varepsilon\): no depende del tamaño de la base, así que en bases grandes es relativamente
      pequeño.</p>

      <h2>Respuesta aleatorizada</h2>
      <p>Warner (1965): con probabilidad \(q\) se responde la verdad y si no, al azar. Si \(p\) es la proporción real, la de «sí» es
      \(y = qp + (1 - q)/2\), de donde \(\hat p = (\bar y - (1-q)/2)/q\). Cada respuesta individual es
      \(\varepsilon\)-privada con</p>
      \[ \varepsilon = \ln \frac{q + (1-q)/2}{(1-q)/2}; \qquad q = \tfrac12 \Rightarrow \varepsilon = \ln 3. \]
      <p>Es privacidad diferencial <em>local</em>: el ruido se agrega antes de que el dato llegue al servidor, de modo que ni siquiera quien
      recolecta conoce las respuestas verdaderas.</p>

      <h2>Composición y presupuesto</h2>
      <p>Si se responden \(k\) consultas con \(\varepsilon_1, \dots, \varepsilon_k\), el conjunto es \((\sum_i \varepsilon_i)\)-privado
      (composición secuencial); sobre partes disjuntas de los datos basta el máximo (composición paralela). Y el
      <strong>posprocesamiento</strong> no gasta presupuesto: cualquier cálculo sobre un resultado privado sigue siendo privado. Esto es lo
      que evita los ataques de diferenciación y reconstrucción (<a href="tema.html?id=re-identificacion">re-identificación</a>) contra las estadísticas exactas.</p>`,
  });
})();
