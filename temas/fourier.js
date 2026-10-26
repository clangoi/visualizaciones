(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Fig. 1: muestreo y espectro ---------- */

  function montarEspectro(cuerpo) {
    let N = 64, ventana = 'rect', ruido = 0, verComponentes = true;
    const comps = [
      { f: 5, A: 1, color: C.s1 },
      { f: 12.5, A: 0.5, color: C.s2 },
      { f: 0, A: 0, color: C.s3 },
    ];

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Muestras N (en 1 s)', opciones: [[32, '32'], [64, '64'], [128, '128'], [256, '256']], valor: N,
      alCambiar: (v) => { N = +v; ajustarMaximos(); dibujarTodo(); } });
    ctl.selector({ etiqueta: 'Ventana', opciones: [['rect', 'Rectangular'], ['hann', 'Hann']], valor: ventana,
      alCambiar: (v) => { ventana = v; dibujarTodo(); } });
    ctl.rango({ etiqueta: 'Ruido (desv. estándar)', min: 0, max: 0.6, paso: 0.02, valor: ruido, formato: (v) => v.toFixed(2),
      alCambiar: (v) => { ruido = v; dibujarTodo(); } });
    ctl.casilla({ etiqueta: 'mostrar componentes', valor: verComponentes, alCambiar: (v) => { verComponentes = v; dibujarTodo(); } });
    const sliders = [];
    comps.forEach((c, i) => {
      sliders.push(ctl.rango({ etiqueta: `Frecuencia ${i + 1} (Hz)`, min: 0, max: N, paso: 0.25, valor: c.f, formato: (v) => v.toFixed(2),
        alCambiar: (v) => { c.f = v; dibujarTodo(); } }));
      ctl.rango({ etiqueta: `Amplitud ${i + 1}`, min: 0, max: 1, paso: 0.05, valor: c.A, formato: (v) => v.toFixed(2),
        alCambiar: (v) => { c.A = v; dibujarTodo(); } });
    });
    function ajustarMaximos() { sliders.forEach((s) => { s.max = N; s.refrescar(); }); }

    const tiempo = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 200, altoMax: 280 });
    const tipT = VIZ.tooltip(tiempo);
    const espectro = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 200, altoMax: 280 });
    const tipE = VIZ.tooltip(espectro);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'señal continua x(t)', forma: 'linea' },
      { color: C.tinta, texto: 'muestras x[n]', forma: 'punto' },
      ...comps.map((c, i) => ({ color: c.color, texto: `componente ${i + 1} · ▼ frecuencia observada`, forma: 'linea' })),
    ]);
    const lectura = VIZ.lectura(cuerpo);

    const ruidoFijo = [];
    const rnd = VIZ.semilla(21);
    for (let i = 0; i < 1024; i++) ruidoFijo.push(VIZ.normal(rnd));

    const senal = (t) => comps.reduce((s, c) => s + c.A * Math.sin(2 * Math.PI * c.f * t), 0);
    const alias = (f) => { const r = ((f % N) + N) % N; return Math.min(r, N - r); };

    function muestras() {
      const x = [];
      for (let n = 0; n < N; n++) x.push(senal(n / N) + ruido * ruidoFijo[n]);
      return x;
    }
    function dft(x) {
      const w = x.map((_, n) => (ventana === 'hann' ? 0.5 * (1 - Math.cos((2 * Math.PI * n) / N)) : 1));
      const suma = w.reduce((a, b) => a + b, 0);
      const res = [];
      for (let k = 0; k <= N / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) {
          const a = (-2 * Math.PI * k * n) / N;
          re += w[n] * x[n] * Math.cos(a);
          im += w[n] * x[n] * Math.sin(a);
        }
        // Amplitud de un solo lado: 2|X_k| / Σw (salvo DC y Nyquist).
        const esc = k === 0 || k === N / 2 ? 1 : 2;
        res.push({ k, amp: (esc * Math.hypot(re, im)) / suma, fase: Math.atan2(im, re) });
      }
      return res;
    }

    let planoT = null, planoE = null, X = [], xs = [];
    function dibujarTiempo() {
      const { ctx } = tiempo;
      tiempo.limpiar();
      const amax = Math.max(0.5, comps.reduce((s, c) => s + c.A, 0) + 2.5 * ruido) * 1.1;
      planoT = VIZ.plano(tiempo, { xmin: 0, xmax: 1, ymin: -amax, ymax: amax }, { etiquetaX: 'tiempo t (s)', etiquetaY: 'x(t)' });
      planoT.ejes();
      ctx.save();
      planoT.recortar();
      const pasos = 1200;
      if (verComponentes) {
        for (const c of comps) {
          if (!c.A) continue;
          const pts = [];
          for (let i = 0; i <= pasos; i++) { const t = i / pasos; pts.push([t, c.A * Math.sin(2 * Math.PI * c.f * t)]); }
          VIZ.trazar(ctx, planoT, pts, VIZ.alfa(c.color, 0.55), 1.2);
        }
      }
      const pts = [];
      for (let i = 0; i <= pasos; i++) { const t = i / pasos; pts.push([t, senal(t)]); }
      VIZ.trazar(ctx, planoT, pts, C.apagado, 1.5);
      const y0 = planoT.sy(0);
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1;
      xs.forEach((v, n) => {
        const x = planoT.sx(n / N);
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, planoT.sy(v)); ctx.stroke();
      });
      xs.forEach((v, n) => VIZ.marcador(ctx, planoT.sx(n / N), planoT.sy(v), C.tinta, N > 128 ? 2.5 : 3.5));
      if (ventana === 'hann') {
        const env = [];
        for (let i = 0; i <= 200; i++) { const t = i / 200; env.push([t, amax * 0.95 * 0.5 * (1 - Math.cos(2 * Math.PI * t))]); }
        VIZ.trazar(ctx, planoT, env, C.eje, 1, [4, 4]);
      }
      ctx.restore();
    }
    function dibujarEspectro() {
      const { ctx } = espectro;
      espectro.limpiar();
      const amax = Math.max(0.3, ...X.map((b) => b.amp)) * 1.15;
      planoE = VIZ.plano(espectro, { xmin: -0.5, xmax: N / 2 + 0.5, ymin: 0, ymax: amax }, {
        etiquetaX: 'frecuencia (Hz) = índice k', etiquetaY: 'amplitud |Xₖ|·2/N',
        ticksX: VIZ.ticks(0, N / 2, 8).filter((v) => Number.isInteger(v)),
      });
      planoE.ejes();
      const bw = Math.max(1, Math.min(10, ((planoE.x1 - planoE.x0) / (N / 2 + 1)) * 0.6));
      for (const b of X) {
        const x = planoE.sx(b.k), y = planoE.sy(b.amp);
        ctx.fillStyle = hoverK === b.k ? C.tinta : C.tinta2;
        ctx.beginPath();
        if (ctx.roundRect && bw > 4) ctx.roundRect(x - bw / 2, y, bw, planoE.y0 - y, [Math.min(4, bw / 2), Math.min(4, bw / 2), 0, 0]);
        else ctx.rect(x - bw / 2, y, bw, planoE.y0 - y);
        ctx.fill();
      }
      // Frecuencias observadas (con aliasing) de cada componente.
      comps.forEach((c) => {
        if (!c.A) return;
        const fa = alias(c.f);
        const x = planoE.sx(fa), y = planoE.y1 + 2;
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 9); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = C.apagado;
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`Nyquist = ${N / 2} Hz`, planoE.x1, planoE.y1 + 14);
    }
    function dibujarTodo() {
      xs = muestras();
      X = dft(xs);
      dibujarTiempo();
      dibujarEspectro();
      const lineas = comps.map((c, i) => {
        if (!c.A) return [`componente ${i + 1}`, 'apagada'];
        const fa = alias(c.f);
        return [`componente ${i + 1}`, Math.abs(fa - c.f) > 1e-9 ? `${c.f} Hz → aparece en ${fa} Hz (alias)` : `${c.f} Hz${Number.isInteger(c.f) ? '' : ' (no entera: fuga)'}`];
      });
      lectura.set([['frecuencia de muestreo', `${N} Hz`], ['resolución Δf', '1 Hz'], ...lineas]);
    }
    tiempo.alDibujar = () => xs.length && dibujarTiempo();
    espectro.alDibujar = () => X.length && dibujarEspectro();

    let hoverK = null;
    espectro.canvas.addEventListener('pointermove', (ev) => {
      if (!planoE) return;
      const { x, y } = espectro.posicion(ev);
      const k = Math.round(planoE.ix(x));
      if (!planoE.dentro(x, y) || k < 0 || k > N / 2) { hoverK = null; tipE.ocultar(); return dibujarEspectro(); }
      hoverK = k;
      dibujarEspectro();
      const b = X[k];
      tipE.mostrar(x, y, `k = <b>${k}</b> (${k} Hz)<br>amplitud <b>${b.amp.toFixed(3)}</b><br>fase ${(b.fase / Math.PI).toFixed(2)}π`);
    });
    espectro.canvas.addEventListener('pointerleave', () => { hoverK = null; tipE.ocultar(); dibujarEspectro(); });
    tiempo.canvas.addEventListener('pointermove', (ev) => {
      if (!planoT) return;
      const { x, y } = tiempo.posicion(ev);
      if (!planoT.dentro(x, y)) return tipT.ocultar();
      const n = Math.max(0, Math.min(N - 1, Math.round(planoT.ix(x) * N)));
      tipT.mostrar(x, y, `n = <b>${n}</b> · t = ${(n / N).toFixed(3)} s<br>x[n] = <b>${xs[n].toFixed(3)}</b>`);
    });
    tiempo.canvas.addEventListener('pointerleave', () => tipT.ocultar());

    dibujarTodo();
  }

  /* ---------- Fig. 2: series de Fourier y epiciclos ---------- */

  const ONDAS = {
    cuadrada: {
      nombre: 'Cuadrada',
      f: (t) => (Math.sin(t) >= 0 ? 1 : -1),
      coef: (K) => Array.from({ length: K }, (_, i) => { const k = 2 * i + 1; return [k, 4 / (Math.PI * k)]; }),
    },
    sierra: {
      nombre: 'Diente de sierra',
      f: (t) => { const u = ((t + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return u / Math.PI; },
      coef: (K) => Array.from({ length: K }, (_, i) => { const k = i + 1; return [k, (2 / (Math.PI * k)) * (k % 2 ? 1 : -1)]; }),
    },
    triangular: {
      nombre: 'Triangular',
      f: (t) => (2 / Math.PI) * Math.asin(Math.sin(t)),
      coef: (K) => Array.from({ length: K }, (_, i) => { const k = 2 * i + 1; return [k, (8 / (Math.PI * Math.PI * k * k)) * (i % 2 ? -1 : 1)]; }),
    },
  };

  function montarSerie(cuerpo) {
    let onda = 'cuadrada', K = 5, velocidad = 0.6, t = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Onda', opciones: Object.entries(ONDAS).map(([k, o]) => [k, o.nombre]), valor: onda,
      alCambiar: (v) => { onda = v; dibujarTodo(); } });
    ctl.rango({ etiqueta: 'Términos no nulos K', min: 1, max: 60, valor: K, alCambiar: (v) => { K = v; dibujarTodo(); } });
    ctl.rango({ etiqueta: 'Velocidad de giro', min: 0.1, max: 2, paso: 0.1, valor: velocidad, formato: (v) => v.toFixed(1),
      alCambiar: (v) => { velocidad = v; } });
    const bPlay = ctl.boton('Pausar', () => {
      if (bucle.activo) { bucle.detener(); bPlay.textContent = 'Reproducir'; } else { bucle.iniciar(); bPlay.textContent = 'Pausar'; }
    }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'onda objetivo f(t)', forma: 'linea' },
      { color: C.s1, texto: 'suma parcial S_K(t)', forma: 'linea' },
      { color: C.s2, texto: 'punta de la cadena de epiciclos', forma: 'punto' },
    ]);
    const coefLienzo = VIZ.lienzo(cuerpo, { alto: 140 });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Izquierda: cada círculo gira con frecuencia k y radio |b_k|; la altura de la punta de la cadena es la suma parcial. Abajo: los coeficientes b_k. Observe que el sobrepaso cerca de los saltos no desaparece al aumentar K (fenómeno de Gibbs).');

    const suma = (cs, tt) => cs.reduce((s, [k, b]) => s + b * Math.sin(k * tt), 0);

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const def = ONDAS[onda], cs = def.coef(K);
      const izqW = Math.min(W * 0.36, H * 1.1);
      const cy = H / 2, escala = (H / 2 - 18) / 1.35;
      const cx = izqW / 2;
      // Epiciclos
      let x = cx, y = cy;
      ctx.lineWidth = 1;
      for (const [k, b] of cs) {
        const r = Math.abs(b) * escala;
        const ang = k * t + (b < 0 ? Math.PI : 0);
        if (r > 0.6) {
          ctx.strokeStyle = VIZ.alfa(C.apagado, 0.45);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        }
        const nx = x + r * Math.cos(ang), ny = y - r * Math.sin(ang);
        ctx.strokeStyle = C.tinta2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        x = nx; y = ny;
      }
      // Gráfico de un período a la derecha
      const p = VIZ.plano(lienzo, { xmin: 0, xmax: 2 * Math.PI, ymin: -1.35, ymax: 1.35 }, {
        margen: { izq: izqW + 40, der: 14, sup: 18, inf: 18 },
        ticksX: [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2 * Math.PI], ticksY: [-1, 0, 1],
        formatoX: (v) => ['0', 'π/2', 'π', '3π/2', '2π'][Math.round(v / (Math.PI / 2))],
      });
      // Alinear la escala vertical del gráfico con la de los epiciclos.
      const sy = (v) => cy - v * escala;
      p.sy = sy;
      p.ejes();
      ctx.save();
      p.recortar();
      const objetivo = [], parcial = [];
      for (let i = 0; i <= 600; i++) {
        const tt = (2 * Math.PI * i) / 600;
        objetivo.push([tt, def.f(tt)]);
        parcial.push([tt, suma(cs, tt)]);
      }
      // Rompe la línea objetivo en las discontinuidades.
      for (let i = 1; i < objetivo.length; i++) if (Math.abs(objetivo[i][1] - objetivo[i - 1][1]) > 1) objetivo.splice(i, 0, [objetivo[i][0], NaN]), i++;
      VIZ.trazar(ctx, p, objetivo, C.apagado, 1.5, [5, 4]);
      VIZ.trazar(ctx, p, parcial, C.s1, 2);
      const tm = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const yv = suma(cs, tm);
      ctx.restore();
      // Línea de conexión entre la punta y el cursor del gráfico.
      ctx.strokeStyle = C.s2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p.sx(tm), sy(yv)); ctx.stroke();
      ctx.setLineDash([]);
      VIZ.marcador(ctx, x, y, C.s2, 4.5);
      VIZ.marcador(ctx, p.sx(tm), sy(yv), C.s2, 4.5);

      // Lecturas: sobrepaso y error cuadrático medio.
      let maximo = -Infinity, ecm = 0;
      for (const [tt, v] of parcial) { maximo = Math.max(maximo, v); ecm += (v - def.f(tt)) ** 2; }
      ecm /= parcial.length;
      lectura.set([
        ['K términos', String(K)],
        ['armónico más alto', String(cs[cs.length - 1][0])],
        ['máximo de S_K', maximo.toFixed(4)],
        ['sobrepaso sobre el salto', onda === 'triangular' ? '— (continua)' : `${(((maximo - 1) / 2) * 100).toFixed(2)} %`],
        ['error cuadrático medio', VIZ.fmt(ecm, 3)],
      ]);
    }
    function dibujarCoef() {
      const { ctx } = coefLienzo;
      coefLienzo.limpiar();
      const cs = ONDAS[onda].coef(K);
      const kmax = cs[cs.length - 1][0];
      const bmax = Math.max(...cs.map(([, b]) => Math.abs(b)));
      const p = VIZ.plano(coefLienzo, { xmin: 0, xmax: Math.max(kmax, 10) + 1, ymin: -bmax * 1.15, ymax: bmax * 1.15 }, {
        etiquetaY: 'coeficiente b_k', margen: { inf: 24 }, ticksY: [-bmax, 0, bmax].map((v) => +v.toFixed(2)),
        formatoX: (v) => String(Math.round(v)),
      });
      p.ejes();
      const y0 = p.sy(0);
      ctx.strokeStyle = C.eje;
      ctx.beginPath(); ctx.moveTo(p.x0, y0 + 0.5); ctx.lineTo(p.x1, y0 + 0.5); ctx.stroke();
      for (const [k, b] of cs) {
        const x = p.sx(k);
        ctx.strokeStyle = C.s1;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, p.sy(b)); ctx.stroke();
        VIZ.marcador(ctx, x, p.sy(b), C.s1, 3.5);
      }
    }
    function dibujarTodo() { dibujar(); dibujarCoef(); }
    lienzo.alDibujar = dibujar;
    coefLienzo.alDibujar = dibujarCoef;

    const bucle = VIZ.bucle((dt) => { t += (dt / 1000) * velocidad * 2; dibujar(); return true; });
    dibujarTodo();
    // La animación solo corre cuando la figura está en pantalla.
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && bPlay.textContent === 'Pausar') bucle.iniciar();
      else if (!e.isIntersecting) bucle.detener();
    }).observe(lienzo.canvas);
  }

  VIZ.registrarTema('fourier', {
    intro: String.raw`
      <p>La idea de Fourier es que casi cualquier señal puede escribirse como una suma de sinusoides de distintas frecuencias.
      Pasar de la señal en el tiempo a sus <strong>componentes de frecuencia</strong> revela estructura que a simple vista no se
      ve: las notas de un acorde, el zumbido de 50 Hz de la red eléctrica o las texturas de una imagen.</p>
      <p>En un computador la señal no es continua: se registra en <strong>muestras</strong> tomadas a intervalos regulares. La
      <em>transformada discreta de Fourier</em> (DFT) es la versión que opera sobre esas muestras, y su comportamiento tiene
      consecuencias sorprendentes, como frecuencias que se disfrazan de otras (aliasing).</p>`,
    visualizaciones: [
      {
        titulo: 'Muestreo y espectro discreto',
        descripcion: 'Arriba, la señal compuesta por hasta tres sinusoides y sus N muestras. Abajo, la magnitud de su DFT. Lleve una frecuencia por encima de N/2 para ver el aliasing, o use frecuencias no enteras para ver la fuga espectral.',
        montar: montarEspectro,
      },
      {
        titulo: 'Series de Fourier y el fenómeno de Gibbs',
        descripcion: 'Una onda periódica reconstruida con sus primeros K términos de Fourier, representados como una cadena de círculos giratorios.',
        montar: montarSerie,
      },
    ],
    teoria: String.raw`
      <h2>Serie de Fourier</h2>
      <p>Una función \(f\) de período \(2\pi\) y cuadrado integrable puede escribirse como</p>
      \[ f(t) = \frac{a_0}{2} + \sum_{k=1}^{\infty} \big(a_k \cos kt + b_k \sin kt\big), \qquad
         a_k = \frac{1}{\pi}\int_{-\pi}^{\pi} f(t)\cos kt\,dt, \quad b_k = \frac{1}{\pi}\int_{-\pi}^{\pi} f(t)\sin kt\,dt. \]
      <p>Los coeficientes se obtienen proyectando \(f\) sobre una base <strong>ortogonal</strong>: \(\int_{-\pi}^{\pi}\sin jt\,\sin kt\,dt = \pi\,\delta_{jk}\).
      La suma parcial \(S_K\) es la mejor aproximación de \(f\) en norma \(L^2\) con esas frecuencias, y la identidad de Parseval
      relaciona energía en el tiempo y en frecuencia. Para las ondas de la figura 2:</p>
      \[
      \begin{aligned}
      \text{cuadrada:}\quad &amp; \frac{4}{\pi}\sum_{k\ \text{impar}} \frac{\sin kt}{k}, \qquad
      \text{sierra:}\quad \frac{2}{\pi}\sum_{k \ge 1} (-1)^{k+1}\frac{\sin kt}{k}, \\
      \text{triangular:}\quad &amp; \frac{8}{\pi^2}\sum_{k\ \text{impar}} (-1)^{(k-1)/2}\,\frac{\sin kt}{k^2}.
      \end{aligned}
      \]
      <p>La velocidad con que decaen los coeficientes refleja la suavidad: \(O(1/k)\) para funciones con saltos y \(O(1/k^2)\) para
      funciones continuas con quiebres. Por eso la triangular se aproxima mucho mejor con pocos términos.</p>

      <h2>Fenómeno de Gibbs</h2>
      <p>Cerca de un salto, \(S_K\) siempre sobrepasa el valor de la función en aproximadamente un 9 % del tamaño del salto,
      sin importar cuán grande sea \(K\): el sobrepaso se angosta pero no disminuye. Para la onda cuadrada (salto de \(-1\) a \(1\)),</p>
      \[ \lim_{K\to\infty} \max_t S_K(t) = \frac{2}{\pi}\int_0^{\pi}\frac{\sin u}{u}\,du \approx 1.17898, \]
      <p>es decir, un sobrepaso de \(\approx 0.0895\) veces el salto. La convergencia es en \(L^2\) y puntual fuera de los saltos, pero
      no uniforme.</p>

      <h2>Transformada discreta de Fourier</h2>
      <p>Para \(N\) muestras \(x_0, \dots, x_{N-1}\), la DFT y su inversa son</p>
      \[ X_k = \sum_{n=0}^{N-1} x_n\, e^{-2\pi i\, kn/N}, \qquad x_n = \frac{1}{N}\sum_{k=0}^{N-1} X_k\, e^{2\pi i\, kn/N}. \]
      <p>\(X_k\) mide la correlación de la señal con una sinusoide de \(k\) ciclos en la ventana. Si las muestras se toman a frecuencia
      \(f_s\) durante \(N/f_s\) segundos, el índice \(k\) corresponde a \(k f_s/N\) Hz; aquí \(f_s = N\) Hz y la ventana dura 1 s, así que
      \(k\) es directamente la frecuencia en Hz. Para señales reales, \(X_{N-k} = \overline{X_k}\), por lo que basta mostrar \(0 \le k \le N/2\).</p>

      <h2>Teorema de muestreo y aliasing</h2>
      <p>Las sinusoides de frecuencias \(f\) y \(f + m f_s\) (\(m \in \mathbb{Z}\)) producen <em>exactamente las mismas muestras</em>, porque
      \(e^{2\pi i (f + m f_s) n / f_s} = e^{2\pi i f n/f_s}\). Una componente de frecuencia \(f\) aparece entonces en</p>
      \[ f_{\text{alias}} = \big|\, f - f_s \cdot \operatorname{round}(f/f_s) \,\big| \in [0, f_s/2]. \]
      <p>El <strong>teorema de Nyquist–Shannon</strong> afirma que una señal sin componentes por encima de \(f_{\max}\) queda determinada
      por sus muestras si \(f_s &gt; 2 f_{\max}\). La mitad de la frecuencia de muestreo, \(f_s/2\), es la <strong>frecuencia de Nyquist</strong>.
      Por eso el audio digital se muestrea a 44.1 kHz: el oído llega a unos 20 kHz. Antes de muestrear se aplica un filtro
      <em>antialiasing</em>.</p>

      <h2>Fuga espectral y ventanas</h2>
      <p>La DFT trata implícitamente la ventana como un período de una señal periódica. Si la frecuencia no completa un número entero
      de ciclos, el empalme es discontinuo y la energía se reparte entre muchos índices: <strong>fuga espectral</strong>. Multiplicar por
      una ventana que se anula suavemente en los extremos, como la de Hann</p>
      \[ w_n = \tfrac{1}{2}\left(1 - \cos\frac{2\pi n}{N}\right), \]
      <p>reduce mucho los lóbulos laterales (de \(-13\) dB a \(-31\) dB) a cambio de un lóbulo principal el doble de ancho.</p>

      <h2>La transformada rápida (FFT)</h2>
      <p>Calcular la DFT directamente cuesta \(\Theta(N^2)\). El algoritmo de Cooley–Tukey separa índices pares e impares,
      \(X_k = E_k + e^{-2\pi i k/N} O_k\), donde \(E\) y \(O\) son DFT de tamaño \(N/2\). Así</p>
      \[ T(N) = 2\,T(N/2) + \Theta(N) = \Theta(N \log N), \]
      <p>la misma recurrencia que merge sort. Para \(N = 10^6\) la diferencia es de unas 50 000 veces, y es lo que hizo práctico el
      procesamiento digital de señales.</p>`,
  });
})();
