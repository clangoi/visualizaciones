(function () {
  'use strict';
  const { color: C } = VIZ;
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  const dinero = (v) => (v < 0 ? '−' : '') + '$' + VIZ.entero(Math.abs(v));

  /* ---------- Fig. 1: entrenar un clasificador de abandono ---------- */

  const XMAX = 12, YMAX = 6; // meses sin comprar, reclamos en el trimestre

  function montarEntrenar(cuerpo) {
    let semilla = 1, n = 120, ruido = 0.3, lr = 2, clase = 1, pts = [], w = [0, 0, 0], epoca = 0, perdida = NaN, cam = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Clientes', min: 30, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; pts = null; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido en los datos', min: 0, max: 1, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; pts = null; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje', min: 0.2, max: 8, paso: 0.2, valor: lr, alCambiar: (v) => { lr = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Clase al hacer clic', opciones: [['1', 'abandona'], ['0', 'permanece']], valor: '1', alCambiar: (v) => { clase = +v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos clientes', () => { semilla++; pts = null; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'abandonó (cuadrado)', forma: 'cuadro' },
      { color: C.s1, texto: 'permaneció (círculo)', forma: 'punto' },
      { color: C.tinta, texto: 'frontera del modelo (p = 0,5)', forma: 'linea' },
      { color: C.tinta, texto: 'anillo: cliente mal clasificado', forma: 'punto' },
      { color: C.apagado, texto: 'fondo más oscuro = mayor probabilidad estimada de abandono', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para agregar un cliente con la clase elegida; el modelo se reentrena desde cero. Pase el cursor sobre un cliente o sobre el fondo para ver la probabilidad estimada.');

    const prob = (x, y) => sig(w[0] + w[1] * (x / XMAX) + w[2] * (y / YMAX));
    function generar() {
      const rnd = VIZ.semilla(semilla * 101 + 7);
      const k = 2 - 1.6 * ruido;
      pts = Array.from({ length: n }, () => {
        const x = rnd() * XMAX, y = rnd() * YMAX;
        const z = (-4 + 3.5 * (x / XMAX) + 3.5 * (y / YMAX)) * k;
        return { x, y, c: rnd() < sig(z) ? 1 : 0 };
      });
    }
    const metricas = () => {
      let ll = 0, ok = 0;
      for (const p of pts) {
        const q = Math.min(1 - 1e-9, Math.max(1e-9, prob(p.x, p.y)));
        ll -= p.c ? Math.log(q) : Math.log(1 - q);
        if ((q >= 0.5 ? 1 : 0) === p.c) ok++;
      }
      return { perdida: ll / pts.length, exactitud: ok / pts.length };
    };
    function iniciar() {
      if (!pts) generar();
      w = [0, 0, 0]; epoca = 0;
      return (function* () {
        for (let k = 0; k < 80; k++) {
          for (let e = 0; e < 5; e++) {
            const g = [0, 0, 0];
            for (const p of pts) {
              const d = prob(p.x, p.y) - p.c;
              g[0] += d; g[1] += d * (p.x / XMAX); g[2] += d * (p.y / YMAX);
            }
            for (let j = 0; j < 3; j++) w[j] -= (lr * g[j]) / pts.length;
            epoca++;
          }
          yield;
        }
      })();
    }
    function dibujar() {
      if (!pts) generar();
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: XMAX, ymin: 0, ymax: YMAX }, { etiquetaX: 'meses sin comprar', etiquetaY: 'reclamos en el trimestre' });
      cam = pl;
      const nx = 36, ny = 18;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = ((i + 0.5) / nx) * XMAX, y = ((j + 0.5) / ny) * YMAX;
        ctx.fillStyle = VIZ.css(VIZ.enRampa(prob(x, y) * 0.9, VIZ.rampaGris));
        ctx.fillRect(pl.sx(i * XMAX / nx), pl.sy((j + 1) * YMAX / ny), pl.sx(XMAX / nx) - pl.sx(0) + 0.6, pl.sy(0) - pl.sy(YMAX / ny) + 0.6);
      }
      pl.ejes();
      ctx.save();
      pl.recortar();
      // frontera: w0 + w1·x/XMAX + w2·y/YMAX = 0
      const pasos = [];
      if (Math.abs(w[2]) > 1e-9) for (const x of [0, XMAX]) pasos.push([x, ((-w[0] - w[1] * (x / XMAX)) / w[2]) * YMAX]);
      else if (Math.abs(w[1]) > 1e-9) { const x = (-w[0] / w[1]) * XMAX; pasos.push([x, 0], [x, YMAX]); }
      if (pasos.length === 2) VIZ.trazar(ctx, pl, pasos, C.tinta, 2.5);
      ctx.restore();
      for (const p of pts) {
        const mal = (prob(p.x, p.y) >= 0.5 ? 1 : 0) !== p.c;
        if (mal) {
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.sx(p.x), pl.sy(p.y), 8, 0, Math.PI * 2); ctx.stroke();
        }
        VIZ.marcador(ctx, pl.sx(p.x), pl.sy(p.y), p.c ? C.s8 : C.s1, 4.2, p.c ? 1 : 0);
      }
      const m = metricas();
      perdida = m.perdida;
      registro.textContent = epoca === 0
        ? `Sin entrenar: todos los pesos valen 0 y el modelo da p = 0,5 a todos los clientes. ${pts.length} clientes, ${pts.filter((p) => p.c).length} abandonaron.`
        : `Época ${epoca}: cada paso de descenso del gradiente corrige los pesos según el error medio; la frontera gira hasta separar a quienes llevan muchos meses sin comprar y reclaman más.`;
      lectura.set([
        ['época', String(epoca)],
        ['pérdida (log)', VIZ.fmt(m.perdida, 3)],
        ['exactitud', pct(m.exactitud)],
        ['clientes en riesgo (p ≥ 0,5)', String(pts.filter((p) => prob(p.x, p.y) >= 0.5).length)],
        ['pesos w₀, w₁, w₂', w.map((v) => VIZ.fmt(v, 3)).join(' · ')],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!cam) return;
      const { x, y } = lienzo.posicion(ev);
      if (!cam.dentro(x, y)) return tip.ocultar();
      let mejor = null, dm = 11;
      for (const p of pts) { const d = Math.hypot(cam.sx(p.x) - x, cam.sy(p.y) - y); if (d < dm) { dm = d; mejor = p; } }
      if (mejor) tip.mostrar(x, y, `<b>${mejor.c ? 'abandonó' : 'permaneció'}</b><br>${VIZ.fmt(mejor.x, 3)} meses sin comprar<br>${VIZ.fmt(mejor.y, 2)} reclamos<br>p estimada <b>${pct(prob(mejor.x, mejor.y))}</b>`);
      else tip.mostrar(x, y, `${VIZ.fmt(cam.ix(x), 3)} meses · ${VIZ.fmt(cam.iy(y), 2)} reclamos<br>p de abandono <b>${pct(prob(cam.ix(x), cam.iy(y)))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!cam) return;
      const { x, y } = lienzo.posicion(ev);
      if (!cam.dentro(x, y)) return;
      pts.push({ x: cam.ix(x), y: cam.iy(y), c: clase });
      rep.reiniciar();
    });
    generar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: de la predicción a la decisión ---------- */

  function montarDecision(cuerpo) {
    const N = 400, PRIOR = 0.25;
    let semilla = 1, umbral = 0.3, d = 1.6, V = 400, c = 30, e = 0.5, datos = [], curva = [], opt = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    const rUmbral = ctl.rango({ etiqueta: 'Umbral para contactar', min: 0, max: 1, paso: 0.01, valor: umbral, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Calidad del modelo (separación)', min: 0, max: 3.5, paso: 0.1, valor: d, alCambiar: (v) => { d = v; generar(); } });
    ctl.rango({ etiqueta: 'Valor de un cliente retenido', min: 100, max: 1000, paso: 25, valor: V, formato: dinero, alCambiar: (v) => { V = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de la oferta por cliente', min: 5, max: 100, paso: 5, valor: c, formato: dinero, alCambiar: (v) => { c = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Éxito de la oferta', min: 0.1, max: 1, paso: 0.05, valor: e, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { e = v; dibujar(); } });
    ctl.boton('Nuevos clientes', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'beneficio neto según el umbral', forma: 'linea' },
      { color: C.tinta, texto: 'umbral elegido', forma: 'linea' },
      { color: C.s6, texto: 'umbral óptimo', forma: 'punto' },
      { color: C.apagado, texto: 'beneficio 0: no contactar a nadie', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la curva para fijar el umbral. Con un modelo pobre (separación baja) el mejor umbral casi no gana a «no contactar»; con costos de oferta altos, el óptimo sube. Cada cliente simulado tiene una puntuación calibrada: el modelo acierta en promedio.');

    function generar() {
      const rnd = VIZ.semilla(semilla * 977 + 3), nor = () => VIZ.normal(rnd);
      const lp = Math.log(PRIOR / (1 - PRIOR));
      datos = Array.from({ length: N }, () => {
        const y = rnd() < PRIOR ? 1 : 0;
        const z = (y ? d / 2 : -d / 2) + nor();
        return { y, s: sig(lp + d * z) };
      });
      dibujar();
    }
    const matriz = (t) => {
      let vp = 0, fp = 0, fn = 0, vn = 0;
      for (const x of datos) { const cont = x.s >= t; if (cont) { if (x.y) vp++; else fp++; } else if (x.y) fn++; else vn++; }
      return { vp, fp, fn, vn, beneficio: vp * (e * V - c) - fp * c };
    };
    function dibujar() {
      curva = [];
      for (let k = 0; k <= 100; k++) curva.push([k / 100, matriz(k / 100).beneficio]);
      opt = curva.reduce((a, b) => (b[1] > a[1] ? b : a));
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ys = curva.map((p) => p[1]);
      const ymin = Math.min(0, ...ys) * 1.1, ymax = Math.max(1, ...ys) * 1.15;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin, ymax }, { etiquetaX: 'umbral', etiquetaY: 'beneficio neto', formatoY: dinero });
      pl.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke(); ctx.restore();
      VIZ.trazar(ctx, pl, curva, C.s1, 2.5);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pl.sx(umbral), pl.y1); ctx.lineTo(pl.sx(umbral), pl.y0); ctx.stroke();
      VIZ.marcador(ctx, pl.sx(opt[0]), pl.sy(opt[1]), C.s6, 6);
      const m = matriz(umbral);
      VIZ.marcador(ctx, pl.sx(umbral), pl.sy(m.beneficio), C.tinta, 4.5);
      // matriz de confusión con costos
      const g = e * V - c;
      const fila = (tit, a, b) => `<tr><th class="izq">${tit}</th>${a}${b}</tr>`;
      const cel = (n, rot, usd) => `<td>${n} clientes<br>${rot}<br><b>${usd}</b></td>`;
      caja.innerHTML = `<table class="tabla-datos"><tr><th></th><th>Modelo: contactar</th><th>Modelo: no contactar</th></tr>`
        + fila('Real: abandonaría', cel(m.vp, 'verdadero positivo', dinero(m.vp * g)), cel(m.fn, 'falso negativo (oportunidad perdida)', '−' + dinero(m.fn * e * V)))
        + fila('Real: se quedaría', cel(m.fp, 'falso positivo (oferta desperdiciada)', dinero(-m.fp * c)), cel(m.vn, 'verdadero negativo', dinero(0)))
        + '</table>';
      const prec = m.vp + m.fp ? m.vp / (m.vp + m.fp) : NaN, rec = m.vp + m.fn ? m.vp / (m.vp + m.fn) : NaN;
      registro.textContent = `Se contacta a ${m.vp + m.fp} clientes (puntuación ≥ ${VIZ.fmt(umbral, 2)}): ${m.vp} × (${e * 100} % × ${dinero(V)} − ${dinero(c)}) − ${m.fp} × ${dinero(c)} = ${dinero(m.beneficio)}.`;
      lectura.set([
        ['beneficio neto', dinero(m.beneficio)],
        ['mejor umbral', `${VIZ.fmt(opt[0], 2)} → ${dinero(opt[1])}`],
        ['umbral teórico c / (e·V)', VIZ.fmt(Math.min(1, c / (e * V)), 2)],
        ['precisión', Number.isNaN(prec) ? '—' : pct(prec)],
        ['exhaustividad', Number.isNaN(rec) ? '—' : pct(rec)],
        ['contactar a todos', dinero(curva[0][1])],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    const alUmbral = (ev) => {
      if (!pl) return null;
      const { x, y } = lienzo.posicion(ev);
      return pl.dentro(x, y) ? { x, y, t: Math.min(1, Math.max(0, Math.round(pl.ix(x) * 100) / 100)) } : null;
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const p = alUmbral(ev);
      if (!p) return tip.ocultar();
      const m = matriz(p.t);
      tip.mostrar(p.x, p.y, `umbral <b>${VIZ.fmt(p.t, 2)}</b>` + VIZ.filaTooltip(C.s1, 'beneficio', dinero(m.beneficio)) + `contactados <b>${m.vp + m.fp}</b><br>aciertos <b>${m.vp}</b> · desperdicios <b>${m.fp}</b>`);
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const p = alUmbral(ev);
      if (p) { umbral = p.t; rUmbral.valor = umbral; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('ai-ml-business', {
    intro: String.raw`
      <p>La <strong>inteligencia artificial</strong> es el conjunto de técnicas que hacen que un sistema realice tareas que antes exigían criterio humano. En las organizaciones, casi siempre significa <strong>aprendizaje automático</strong> (<em>machine learning</em>): en vez de programar reglas a mano, se entrena un modelo con datos históricos (qué clientes se fueron, qué facturas resultaron fraudulentas) para que prediga casos nuevos. Su combustible es el análisis masivo de datos que la empresa ya genera.</p>
      <p>Pero una predicción no es todavía una decisión. Un modelo que dice «este cliente tiene 40 % de probabilidad de irse» solo crea valor si alguien actúa, y actuar cuesta. Lo que se decide en la práctica es un <strong>umbral</strong>, y se elige comparando el costo de cada tipo de error con el beneficio de cada acierto.</p>`,
    visualizaciones: [
      {
        titulo: 'Entrenar un clasificador de abandono de clientes',
        descripcion: 'Pulse «Reproducir» y observe cómo la frontera del modelo gira hasta separar a los clientes que abandonan. Suba el ruido para ver que ningún modelo llega al 100 % de exactitud, y agregue clientes con clic para comprobar que la frontera se mueve.',
        montar: montarEntrenar,
      },
      {
        titulo: 'De la predicción a la decisión',
        descripcion: 'Mueva el umbral y observe cómo cambia el beneficio y la matriz de confusión con costos. Pruebe encarecer la oferta y baje la calidad del modelo: el umbral óptimo y el beneficio posible cambian aunque el modelo sea el mismo.',
        montar: montarDecision,
      },
    ],
    teoria: String.raw`
      <h2>Del dato al modelo</h2>
      <p>Un <strong>clasificador</strong> aprende una función que asigna a cada cliente con atributos \(x\) una probabilidad de pertenecer a la clase «abandona». El caso más simple es la regresión logística:</p>
      \[ \hat{p}(x) = \sigma(w_0 + w_1 x_1 + w_2 x_2), \qquad \sigma(z) = \frac{1}{1 + e^{-z}} . \]
      <p>Los pesos \(w\) se eligen minimizando la pérdida logarítmica \( L = -\frac{1}{n}\sum_i \big[y_i \ln \hat p_i + (1-y_i)\ln(1-\hat p_i)\big] \) por descenso del gradiente, como en la primera figura. El mismo esquema (datos históricos, modelo, predicción) sirve para fraude, demanda, riesgo de crédito o mantenimiento; ver <a href="tema.html?id=logistic-regression">regresión logística</a> y <a href="tema.html?id=machine-learning">aprendizaje automático</a>.</p>
      <h2>Matriz de confusión con costos</h2>
      <p>Al fijar un umbral \(t\) y contactar a quien tenga \(\hat p \ge t\), cada cliente cae en una de cuatro casillas. Si una oferta cuesta \(c\), tiene probabilidad de éxito \(e\) y un cliente retenido vale \(V\), el beneficio neto es</p>
      \[ B(t) = \mathrm{VP}\,(eV - c) - \mathrm{FP}\,c . \]
      <p>Los falsos negativos no restan dinero real, pero son una oportunidad perdida de \(eV\) por cliente. Para un modelo calibrado, conviene contactar a un cliente cuando su probabilidad cumple \(\hat p \cdot eV > c\), es decir, el umbral teórico es</p>
      \[ t^{*} = \frac{c}{e\,V} . \]
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con \(V = 400\), \(e = 0{,}5\) y \(c = 30\): \(t^{*} = 30/200 = 0{,}15\). Un cliente con 20 % de riesgo vale la pena (esperado \(0{,}2 \cdot 200 - 30 = +10\)); uno con 10 % no (\(0{,}1 \cdot 200 - 30 = -10\)). Si la oferta sube a \(c = 100\), el umbral sube a \(0{,}5\) y se contacta a muchos menos clientes.</p></div>
      <h2>Qué se pregunta la organización</h2>
      <ul>
        <li><strong>Exactitud no es valor:</strong> con 25 % de abandono, un modelo que dice «nadie se va» acierta el 75 % y no sirve para nada. Ver <a href="tema.html?id=imbalanced-metrics">métricas con clases desbalanceadas</a>.</li>
        <li><strong>Los errores no cuestan lo mismo:</strong> el umbral se calcula con dinero, no con 0,5.</li>
        <li><strong>Los datos cambian:</strong> un modelo se reentrena y se monitorea; conecte con <a href="tema.html?id=ai-adoption-risks">riesgos de adoptar IA</a> y <a href="tema.html?id=algorithmic-fairness">equidad algorítmica</a>.</li>
      </ul>`,
  });
})();
