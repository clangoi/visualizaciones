(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: inspección heurística de un gráfico defectuoso ---------- */

  const DEFECTOS = [
    { k: 'ejeCero', t: 'El eje y comienza en cero', h: 'Honestidad: las barras proporcionales al valor' },
    { k: 'orden', t: 'Las barras están ordenadas por valor', h: 'Facilidad de comparación' },
    { k: 'color', t: 'Un solo color, sin arcoíris', h: 'Uso de canales: el color no codifica nada' },
    { k: 'titulo', t: 'Tiene título y unidades', h: 'Contexto: qué se muestra y en qué unidad' },
    { k: 'etiquetas', t: 'Valores rotulados directamente', h: 'Menos esfuerzo: sin ir y volver a un eje' },
    { k: 'tam', t: 'Texto de tamaño legible', h: 'Legibilidad' },
  ];

  function montarHeuristica(cuerpo) {
    const e = Object.fromEntries(DEFECTOS.map((d) => [d.k, false]));
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(DEFECTOS.map((d) => ({ clave: d.k, texto: d.t, activo: false })), (s) => { Object.assign(e, s); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'el gráfico de ejemplo usa un solo color; el arcoíris del caso defectuoso no codifica nada';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El gráfico empieza con seis problemas. Active cada mejora para corregirlo y observe cómo sube la puntuación heurística. Pase el cursor por una barra: ¿qué diferencia real hay entre A y B?');
    const D = [['Café', 71], ['Té', 74], ['Pan', 62], ['Leche', 79], ['Jugo', 68], ['Agua', 76]];
    let rects = [], datos = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      datos = e.orden ? [...D].sort((a, b) => b[1] - a[1]) : D;
      const fs = e.tam ? 12 : 8, sup = e.titulo ? 34 : 12, x0 = 46, y0 = H - 26, y1 = sup + 4;
      if (e.titulo) { V.rotulo(ctx, 'Ventas mensuales por producto (millones de pesos)', 10, 14, { tam: 12, peso: 700, color: C.tinta }); }
      const lo = e.ejeCero ? 0 : 60, hi = 82, sy = V.lin(lo, hi, y0, y1), paso = (W - x0 - 12) / datos.length;
      [0, 20, 40, 60, 80].filter((t) => t >= lo && t <= hi).forEach((t) => { ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x0, sy(t) + 0.5); ctx.lineTo(W - 12, sy(t) + 0.5); ctx.stroke(); V.rotulo(ctx, String(t), x0 - 6, sy(t), { alinear: 'right', tam: fs, color: C.apagado }); });
      if (!e.ejeCero) V.rotulo(ctx, '', 0, 0);
      rects = [];
      datos.forEach(([n, v], i) => {
        const x = x0 + i * paso + 5, y = sy(v), col = e.color ? C.s1 : [C.s8, C.s2, C.s4, C.s3, C.s1, C.s7][i];
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, paso - 10, y0 - y, [3, 3, 0, 0]); ctx.fill();
        V.rotulo(ctx, n, x + (paso - 10) / 2, y0 + 12, { alinear: 'center', tam: fs, color: C.tinta2 });
        if (e.etiquetas) V.rotulo(ctx, String(v), x + (paso - 10) / 2, y - 8, { alinear: 'center', tam: Math.max(fs, 10), peso: 700, color: C.tinta });
        rects.push({ x, y, w: paso - 10, h: y0 - y, i });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, y0 + 0.5); ctx.lineTo(W - 12, y0 + 0.5); ctx.stroke();
      const ok = DEFECTOS.filter((d) => e[d.k]);
      const a = D.find((q) => q[0] === 'Café')[1], b = D.find((q) => q[0] === 'Té')[1], alto = (v) => y0 - sy(v);
      registro.textContent = ok.length === DEFECTOS.length ? 'Sin problemas heurísticos conocidos: el gráfico dice lo que los datos dicen.' : `Pendientes: ${DEFECTOS.filter((d) => !e[d.k]).map((d) => d.h.split(':')[0]).join('; ')}.`;
      lectura.set([['heurísticas satisfechas', `${ok.length} de ${DEFECTOS.length}`], ['Té ÷ Café: real', `${VIZ.fmt(b / a, 3)}×`], ['Té ÷ Café: alturas dibujadas', `${VIZ.fmt(alto(b) / alto(a), 3)}×`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(rects, x, y); if (!h) return tip.ocultar(); tip.mostrar(x, y, `${datos[h.i][0]}: <b>${datos[h.i][1]}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: comparar dos diseños con una muestra de usuarios ---------- */

  const TQ = [[1, 12.71], [2, 4.3], [3, 3.18], [4, 2.78], [5, 2.57], [6, 2.45], [7, 2.36], [8, 2.31], [9, 2.26], [10, 2.23], [15, 2.13], [20, 2.09], [30, 2.04], [60, 2.0], [120, 1.98]];
  const tcrit = (df) => { if (df >= 120) return 1.96; for (let i = 1; i < TQ.length; i++) if (df <= TQ[i][0]) { const [a, ta] = TQ[i - 1], [b, tb] = TQ[i]; return ta + ((tb - ta) * (df - a)) / (b - a); } return 1.96; };

  function montarComparacion(cuerpo) {
    let n = 12, semilla = 1, R = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Personas por diseño', min: 4, max: 80, valor: n, alCambiar: (v) => { n = v; correr(); } });
    ctl.boton('Repetir el estudio', () => { semilla++; correr(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'diseño A (torta)' }, { color: C.s2, texto: 'diseño B (barras)' }, { color: C.tinta, texto: 'media ± IC 95 %', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada persona resuelve la misma tarea con un diseño. Verdad simulada: A tarda 12 s y B, 10 s en promedio (desviación 4 s). Con pocas personas, las muestras a veces no distinguen los diseños; repita el estudio y suba el tamaño.');
    function correr() {
      const rnd = VIZ.semilla(semilla * 977 + n), N = () => VIZ.normal(rnd);
      const A = Array.from({ length: n }, () => Math.max(2, 12 + 4 * N())), B = Array.from({ length: n }, () => Math.max(2, 10 + 4 * N()));
      const st = (x) => { const m = x.reduce((s, v) => s + v, 0) / x.length, sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)); return { m, sd, se: sd / Math.sqrt(x.length), ic: tcrit(x.length - 1) * sd / Math.sqrt(x.length) }; };
      const sa = st(A), sb = st(B), se = Math.hypot(sa.se, sb.se), t = (sa.m - sb.m) / se, df = Math.max(1, Math.round((se ** 4) / ((sa.se ** 4) / (n - 1) + (sb.se ** 4) / (n - 1))));
      R = { A, B, sa, sb, t, df, sig: Math.abs(t) > tcrit(df), d: (sa.m - sb.m) / Math.sqrt((sa.sd ** 2 + sb.sd ** 2) / 2) };
      dibujar();
    }
    let pts = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (!R) return;
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 2, ymin: 0, ymax: 28 }, { etiquetaY: 'tiempo de tarea (s)', formatoX: () => '', ticksX: [] });
      plano.ejes();
      pts = [];
      [[R.A, R.sa, C.s1, 0.5, 'A (torta)'], [R.B, R.sb, C.s2, 1.5, 'B (barras)']].forEach(([x, s, col, cx, nom]) => {
        const rnd = VIZ.semilla(cx * 100 + n);
        x.forEach((v, i) => { const px = plano.sx(cx + (rnd() - 0.5) * 0.7), py = plano.sy(Math.min(27, v)); ctx.fillStyle = VIZ.alfa(col, 0.55); ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 6.3); ctx.fill(); pts.push({ px, py, v, nom }); });
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(plano.sx(cx) - 22, plano.sy(s.m)); ctx.lineTo(plano.sx(cx) + 22, plano.sy(s.m)); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(plano.sx(cx), plano.sy(s.m - s.ic)); ctx.lineTo(plano.sx(cx), plano.sy(s.m + s.ic)); ctx.moveTo(plano.sx(cx) - 8, plano.sy(s.m - s.ic)); ctx.lineTo(plano.sx(cx) + 8, plano.sy(s.m - s.ic)); ctx.moveTo(plano.sx(cx) - 8, plano.sy(s.m + s.ic)); ctx.lineTo(plano.sx(cx) + 8, plano.sy(s.m + s.ic)); ctx.stroke();
        V.rotulo(ctx, nom, plano.sx(cx), plano.y0 + 16, { alinear: 'center', tam: 11, peso: 600, color: col });
      });
      registro.textContent = R.sig ? `Diferencia significativa (|t| = ${VIZ.fmt(Math.abs(R.t), 3)} > ${VIZ.fmt(tcrit(R.df), 3)}): con esta muestra se concluye que B es más rápido.` : `No significativa (|t| = ${VIZ.fmt(Math.abs(R.t), 3)} ≤ ${VIZ.fmt(tcrit(R.df), 3)}): con esta muestra no se puede afirmar una diferencia, aunque la hay.`;
      lectura.set([['media A · B', `${VIZ.fmt(R.sa.m, 3)} s · ${VIZ.fmt(R.sb.m, 3)} s`], ['diferencia de medias', `${VIZ.fmt(R.sa.m - R.sb.m, 3)} s`], ['IC 95 % A · B', `±${VIZ.fmt(R.sa.ic, 3)} · ±${VIZ.fmt(R.sb.ic, 3)} s`], ['tamaño del efecto (d de Cohen)', VIZ.fmt(R.d, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const p = V.cercano(pts, x, y, 8); if (!p) return tip.ocultar(); tip.mostrar(x, y, `${p.nom}: <b>${VIZ.fmt(p.v, 3)} s</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    correr();
  }

  VIZ.registrarTema('usability-evaluation', {
    intro: String.raw`
      <p>Una visualización no está terminada hasta que se comprueba que <strong>funciona para quienes la usan</strong>. Evaluar es medir si las personas logran sus tareas con rapidez, exactitud y comodidad, y detectar dónde se equivocan o se frustran.</p>
      <p>Hay dos grandes caminos: la <em>inspección</em> por expertos con listas de criterios (heurísticas), y el <em>estudio con usuarios</em>, que mide tiempos, errores y opiniones y exige estadística para no sacar conclusiones de la casualidad.</p>`,
    visualizaciones: [
      { titulo: 'Inspección heurística de un gráfico', descripcion: 'Corrija seis problemas de un gráfico de barras y vea cómo cambia la razón de alturas dibujadas frente a la real.', montar: montarHeuristica },
      { titulo: 'Estudio comparativo con usuarios', descripcion: 'Simule un estudio de dos diseños, cambie el tamaño de la muestra y repítalo para ver cuándo la diferencia deja de ser detectable.', montar: montarComparacion },
    ],
    teoria: String.raw`
      <h2>Qué se evalúa</h2>
      <table>
        <tr><th>Dimensión</th><th>Medida</th></tr>
        <tr><td>efectividad</td><td>proporción de tareas correctas, error de lectura</td></tr>
        <tr><td>eficiencia</td><td>tiempo por tarea, número de clics</td></tr>
        <tr><td>satisfacción</td><td>cuestionarios (por ejemplo, SUS), comentarios</td></tr>
        <tr><td>aprendizaje y descubrimiento</td><td>qué se encuentra sin guía, curva de aprendizaje</td></tr>
      </table>
      <p>En términos del <a href="tema.html?id=validation-threats">modelo anidado</a>, un estudio de laboratorio valida el nivel de codificación e interacción; un estudio de campo valida abstracción y dominio.</p>
      <h2>Inspección heurística</h2>
      <p>Expertos revisan el diseño contra criterios generales: honestidad del eje, uso adecuado de canales (<a href="tema.html?id=marks-and-channels">marcas y canales</a>), contexto, legibilidad, retroalimentación de la interacción, consistencia. Es rápida y barata y detecta problemas evidentes, pero no sustituye observar a usuarios.</p>
      <h2>Estudio comparativo</h2>
      <p>Para comparar dos diseños se mide una variable (tiempo) en dos muestras. El intervalo de confianza de 95 % de una media es
      \[ \bar{x} \pm t_{n-1,\,0{,}975}\,\frac{s}{\sqrt{n}}, \]
      y la prueba de Welch usa \(t = \dfrac{\bar{x}_A - \bar{x}_B}{\sqrt{s_A^2/n_A + s_B^2/n_B}}\). Una diferencia es «significativa» si \(|t|\) supera el valor crítico. El <em>tamaño del efecto</em> de Cohen, \(d = (\bar{x}_A - \bar{x}_B)/s_p\), dice cuán grande es, no solo si existe.</p>
      <h2>Poder estadístico</h2>
      <p>Con pocas personas, un efecto real puede no detectarse: la probabilidad de detectarlo (el <em>poder</em>) crece con \(n\) y con \(d\). Concluir «no hay diferencia» con una muestra pequeña es un error frecuente; lo correcto es decir «no se pudo detectar».</p>
      <div class="recuadro"><strong>Buenas prácticas.</strong> Definir las tareas y la métrica antes de empezar, aleatorizar el orden de los diseños, registrar errores además de tiempos y complementar con observación cualitativa (<em>pensar en voz alta</em>).</div>`,
  });
})();
