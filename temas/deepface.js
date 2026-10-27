(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const D = 16; // dimensión del vector de identidad simulado

  // Vectores de identidad simulados: cada persona tiene un centro al azar en la esfera y cada foto se desvía de él.
  function simular(personas, fotos, sigma, semilla) {
    const rnd = VIZ.semilla(semilla), norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((t) => t / n); };
    const centros = Array.from({ length: personas }, () => norm(Array.from({ length: D }, () => VIZ.normal(rnd))));
    const emb = [];
    centros.forEach((c, p) => { for (let f = 0; f < fotos; f++) emb.push({ p, v: norm(c.map((t) => t + VIZ.normal(rnd) * sigma)) }); });
    return emb;
  }
  const dist = (a, b) => Math.hypot(...a.map((t, i) => t - b[i]));

  /* ---------- Fig. 1: verificación con un umbral ---------- */

  function montarVerificacion(cuerpo) {
    let sigma = 0.22, tau = 1.2, semilla = 3;
    let emb = [], gen = [], imp = [], proy = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variación entre fotos de una persona', min: 0.05, max: 0.6, paso: 0.01, valor: sigma, formato: (v) => v.toFixed(2), alCambiar: (v) => { sigma = v; calcular(); } });
    const rT = ctl.rango({ etiqueta: 'Umbral de distancia τ', min: 0.1, max: 1.8, paso: 0.01, valor: tau, formato: (v) => v.toFixed(2), alCambiar: (v) => { tau = v; dibujar(); } });
    ctl.boton('Umbral de igual error', () => { tau = eer().tau; rT.valor = tau; dibujar(); }, { primario: true });
    ctl.boton('Otras personas', () => { semilla++; calcular(); });
    VIZ.subtitulo(cuerpo, 'Vectores de 8 personas (proyección PCA a 2D de 16 dimensiones)');
    const lienzoP = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    VIZ.subtitulo(cuerpo, 'Distancias entre pares de fotos');
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.32, altoMin: 200, altoMax: 280 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.series[0], texto: 'arriba: un color y una forma por persona', forma: 'punto' },
      { color: C.s6, texto: 'pares de la misma persona (genuinos)' },
      { color: C.s8, texto: 'pares de personas distintas (impostores)' },
      { color: C.tinta, texto: 'umbral: «misma persona» si d < τ', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Suba la variación entre fotos (peores condiciones de luz o pose, o un modelo peor): las dos distribuciones se solapan y no hay umbral que evite ambos errores. Bajar τ reduce las aceptaciones falsas a costa de más rechazos falsos.');

    function calcular() {
      emb = simular(8, 10, sigma, semilla);
      gen = []; imp = [];
      for (let i = 0; i < emb.length; i++) for (let j = i + 1; j < emb.length; j++) (emb[i].p === emb[j].p ? gen : imp).push(dist(emb[i].v, emb[j].v));
      const X = emb.map((e) => e.v), mu = P.media(X), V = P.eigSim(P.cov(X, mu)).vectores;
      proy = emb.map((e) => { const c = e.v.map((t, i) => t - mu[i]); return { p: e.p, x: P.punto(c, V[0]), y: P.punto(c, V[1]) }; });
      dibujar();
    }
    const tasas = (t) => ({ far: imp.filter((d) => d < t).length / imp.length, frr: gen.filter((d) => d >= t).length / gen.length });
    function eer() {
      let mejor = { tau: 1, dif: Infinity };
      for (let t = 0.05; t <= 2; t += 0.005) { const r = tasas(t), dif = Math.abs(r.far - r.frr); if (dif < mejor.dif) mejor = { tau: t, dif, ...r }; }
      return mejor;
    }
    let plano = null;
    function dibujar() {
      // Proyección.
      {
        const { ctx } = lienzoP;
        lienzoP.limpiar();
        const m = Math.max(...proy.flatMap((q) => [Math.abs(q.x), Math.abs(q.y)])) * 1.1 || 1;
        const pl = VIZ.plano(lienzoP, { xmin: -m * 1.6, xmax: m * 1.6, ymin: -m, ymax: m }, { etiquetaX: 'PC1', etiquetaY: 'PC2', margen: { izq: 40 } });
        pl.ejes();
        for (const q of proy) VIZ.marcador(ctx, pl.sx(q.x), pl.sy(q.y), VIZ.series[q.p % 8], 4.5, q.p);
      }
      const { ctx } = lienzo;
      lienzo.limpiar();
      const B = 50, hi = 2, h = (xs) => { const r = new Array(B).fill(0); for (const d of xs) r[Math.min(B - 1, Math.floor((d / hi) * B))] += 1 / xs.length; return r; };
      const hg = h(gen), hm = h(imp), ymax = Math.max(...hg, ...hm) * 1.1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: hi, ymin: 0, ymax }, { etiquetaX: 'distancia euclidiana entre vectores normalizados', etiquetaY: 'fracción de pares', margen: { izq: 46 },
        formatoY: (v) => `${Math.round(v * 100)}%` });
      plano.ejes();
      const bw = plano.sx(hi / B) - plano.sx(0);
      for (const [hh, col] of [[hm, C.s8], [hg, C.s6]]) hh.forEach((v, b) => {
        if (!v) return;
        ctx.fillStyle = VIZ.alfa(col, 0.6);
        ctx.fillRect(plano.sx((b * hi) / B) + 1, plano.sy(v), bw - 2, plano.y0 - plano.sy(v));
      });
      VIZ.trazar(ctx, plano, [[tau, 0], [tau, ymax]], C.tinta, 2);
      const r = tasas(tau), e = eer();
      lectura.set([
        ['aceptación falsa (FAR)', `${(100 * r.far).toFixed(2)} %`],
        ['rechazo falso (FRR)', `${(100 * r.frr).toFixed(2)} %`],
        ['tasa de igual error (EER)', `${(100 * (e.far + e.frr) / 2).toFixed(2)} %`],
        ['pares genuinos / impostores', `${gen.length} / ${imp.length}`],
      ]);
    }
    lienzo.alDibujar = () => gen.length && dibujar();
    lienzoP.alDibujar = () => gen.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const t = plano.ix(x), r = tasas(t);
      tip.mostrar(x, y, `τ = <b>${t.toFixed(2)}</b><br>FAR <b>${(100 * r.far).toFixed(1)} %</b>, FRR <b>${(100 * r.frr).toFixed(1)} %</b><br>clic para fijar el umbral`);
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      tau = Math.round(plano.ix(x) * 100) / 100; rT.valor = tau; dibujar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: pérdida triplete ---------- */

  function montarTriplete(cuerpo) {
    let alfa = 0.3, eta = 0.05, semilla = 2;
    let pts = [], ultimo = null, perdidas = [], pasos = 0;
    const PERSONAS = 5, FOTOS = 8;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Margen α', min: 0, max: 0.8, paso: 0.05, valor: alfa, formato: (v) => v.toFixed(2), alCambiar: (v) => { alfa = v; } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje', min: 0.01, max: 0.2, paso: 0.01, valor: eta, formato: (v) => v.toFixed(2), alCambiar: (v) => { eta = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Otra inicialización', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 440 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.series[0], texto: 'foto (color y forma = persona)', forma: 'punto' },
      { color: C.s6, texto: 'ancla → positivo (se acercan)', forma: 'linea' },
      { color: C.s8, texto: 'ancla → negativo (se alejan)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma 20 tripletes al azar y mueve sus puntos según el gradiente de la pérdida. Los tripletes que ya cumplen el margen no aportan nada. Con α = 0 los grupos se tocan; con α grande quedan bien separados.');

    function iniciar() {
      const rnd = VIZ.semilla(semilla);
      pts = [];
      for (let p = 0; p < PERSONAS; p++) for (let f = 0; f < FOTOS; f++) { const r = 0.9 * Math.sqrt(rnd()), a = rnd() * 2 * Math.PI; pts.push({ p, x: r * Math.cos(a), y: r * Math.sin(a) }); }
      ultimo = null; perdidas = []; pasos = 0;
      return (function* () {
        for (pasos = 1; pasos <= 200; pasos++) {
          let total = 0, activos = 0;
          for (let t = 0; t < 20; t++) {
            const a = pts[Math.floor(rnd() * pts.length)];
            const mismos = pts.filter((q) => q.p === a.p && q !== a), otros = pts.filter((q) => q.p !== a.p);
            const p = mismos[Math.floor(rnd() * mismos.length)], n = otros[Math.floor(rnd() * otros.length)];
            const dap = (a.x - p.x) ** 2 + (a.y - p.y) ** 2, dan = (a.x - n.x) ** 2 + (a.y - n.y) ** 2;
            const l = dap - dan + alfa;
            if (l > 0) {
              activos++; total += l;
              // ∂L/∂a = 2(n − p), ∂L/∂p = 2(p − a), ∂L/∂n = 2(a − n)
              const ga = [2 * (n.x - p.x), 2 * (n.y - p.y)], gp = [2 * (p.x - a.x), 2 * (p.y - a.y)], gn = [2 * (a.x - n.x), 2 * (a.y - n.y)];
              a.x -= eta * ga[0]; a.y -= eta * ga[1]; p.x -= eta * gp[0]; p.y -= eta * gp[1]; n.x -= eta * gn[0]; n.y -= eta * gn[1];
              for (const q of [a, p, n]) { const r = Math.hypot(q.x, q.y); if (r > 1) { q.x /= r; q.y /= r; } } // se mantienen en el disco unitario
              ultimo = { a, p, n, l };
            }
          }
          perdidas.push({ media: total / 20, activos: activos / 20 });
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: -1.7, xmax: 1.7, ymin: -1.1, ymax: 1.1 }, { margen: { izq: 40 } });
      plano.ejes();
      ctx.save();
      ctx.strokeStyle = C.rejilla; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.ellipse(plano.sx(0), plano.sy(0), plano.sx(1) - plano.sx(0), plano.sy(0) - plano.sy(1), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (ultimo) {
        VIZ.trazar(ctx, plano, [[ultimo.a.x, ultimo.a.y], [ultimo.p.x, ultimo.p.y]], C.s6, 2.5);
        VIZ.trazar(ctx, plano, [[ultimo.a.x, ultimo.a.y], [ultimo.n.x, ultimo.n.y]], C.s8, 2.5, [5, 4]);
      }
      for (const q of pts) VIZ.marcador(ctx, plano.sx(q.x), plano.sy(q.y), VIZ.series[q.p % 8], q === (ultimo && ultimo.a) ? 7 : 4.5, q.p);
      // Separación: distancia mínima entre personas distintas frente a máxima dentro de una persona.
      let intra = 0, inter = Infinity;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (pts[i].p === pts[j].p) intra = Math.max(intra, d); else inter = Math.min(inter, d);
      }
      const u = perdidas[perdidas.length - 1];
      registro.textContent = !u ? 'Puntos ubicados al azar: todavía no hay estructura.'
        : ultimo ? `Paso ${pasos}: último triplete activo con L = max(0, ‖a − p‖² − ‖a − n‖² + α) = ${ultimo.l.toFixed(3)}.` : `Paso ${pasos}: ningún triplete activo.`;
      lectura.set([
        ['paso', String(Math.max(0, Math.min(pasos, 200)))],
        ['pérdida media', u ? u.media.toFixed(4) : '—'],
        ['tripletes activos', u ? `${(100 * u.activos).toFixed(0)} %` : '—'],
        ['máx. dentro / mín. entre personas', `${intra.toFixed(2)} / ${inter.toFixed(2)}`],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('deepface', {
    intro: String.raw`
      <p><strong>DeepFace</strong> (Taigman, Yang, Ranzato y Wolf, Facebook, 2014) fue el primer sistema de reconocimiento facial en
      acercarse al desempeño humano en el conjunto de prueba <em>Labeled Faces in the Wild</em>: 97,35&nbsp;% de exactitud frente a cerca de
      97,5&nbsp;% de una persona. Su idea central se mantiene en todos los sistemas actuales: una <a href="tema.html?id=cnn">red
      convolucional</a> convierte cada rostro en un <strong>vector de identidad</strong>, y dos fotos son de la misma persona si sus
      vectores están cerca.</p>
      <p>Así, verificar es comparar una distancia con un umbral, y reconocer es buscar el vecino más cercano en una base de vectores:
      se puede agregar una persona nueva sin volver a entrenar la red.</p>`,
    visualizaciones: [
      {
        titulo: 'Verificación con un umbral',
        descripcion: 'Vectores de identidad simulados de 8 personas con 10 fotos cada una. Abajo, las distancias de todos los pares de fotos: el umbral decide «misma persona» o «distinta».',
        montar: montarVerificacion,
      },
      {
        titulo: 'La pérdida triplete',
        descripcion: 'Cómo se entrena el espacio de vectores: cada triplete acerca un ancla a otra foto de la misma persona y la aleja de una foto de otra, hasta que la diferencia supera un margen.',
        montar: montarTriplete,
      },
    ],
    teoria: String.raw`
      <h2>El sistema DeepFace</h2>
      <ol>
        <li><strong>Detección y alineamiento.</strong> Se ubican 67 puntos del rostro y, con un modelo 3D genérico, se «frontaliza» la
        cara: la imagen se deforma como si la persona mirara de frente. Así la red no tiene que aprender la variación de pose.</li>
        <li><strong>Red profunda.</strong> Nueve capas: convoluciones y pooling al principio y luego capas <em>localmente conectadas</em>
        (como una convolución, pero con pesos distintos en cada zona, porque en una cara alineada los ojos y la boca siempre están en el
        mismo lugar). Unos 120 millones de parámetros.</li>
        <li><strong>Entrenamiento.</strong> Como clasificador de 4 030 identidades con 4,4 millones de fotos, con softmax. La penúltima
        capa (4 096 valores) se usa como vector de identidad.</li>
        <li><strong>Verificación.</strong> Los vectores se normalizan y se comparan con una distancia ponderada aprendida o una red
        siamesa.</li>
      </ol>
      <h2>Verificación, identificación y errores</h2>
      <p>Con un umbral \(\tau\) sobre la distancia \(d(f(x_1), f(x_2))\):</p>
      \[ \text{FAR}(\tau) = P(d &lt; \tau \mid \text{personas distintas}), \qquad \text{FRR}(\tau) = P(d \ge \tau \mid \text{misma persona}). \]
      <p>Subir \(\tau\) baja el FRR y sube el FAR. Un control de acceso exige FAR muy bajo (\(10^{-4}\) o menos) y acepta más rechazos; la
      <em>tasa de igual error</em> (EER, donde FAR = FRR) resume la curva en un número. Es la misma lógica de la
      <a href="tema.html?id=evaluacion">curva ROC</a>.</p>
      <h2>Pérdida triplete y sucesoras</h2>
      <p>FaceNet (Schroff et al., Google, 2015) entrenó directamente el espacio de vectores, de 128 dimensiones y norma 1, con tripletes
      (ancla \(a\), positivo \(p\) de la misma persona, negativo \(n\) de otra):</p>
      \[ L = \max\!\big(0,\; \lVert f(a) - f(p)\rVert^2 - \lVert f(a) - f(n)\rVert^2 + \alpha\big). \]
      <p>Solo los tripletes que violan el margen aportan gradiente, así que se buscan tripletes «difíciles» dentro de cada lote. Métodos
      posteriores como ArcFace (2019) vuelven al softmax pero con un margen angular, más estable de entrenar. La biblioteca de Python
      <code>deepface</code> reúne varios de estos modelos (VGG-Face, FaceNet, ArcFace y otros) detrás de una misma interfaz de
      verificación y búsqueda.</p>
      <div class="recuadro"><p>El reconocimiento facial identifica personas sin su participación. Su exactitud cambia entre grupos
      demográficos según los datos de entrenamiento, y su uso para vigilancia está restringido en varias legislaciones. Un sistema
      responsable mide FAR y FRR por grupo, no solo en promedio.</p></div>`,
  });
})();
