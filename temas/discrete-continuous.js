(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const FUN = {
    cuad: { n: 'x²', f: (x) => x * x, I: 9 },
    seno: { n: 'sen x + 1', f: (x) => Math.sin(x) + 1, I: 4 - Math.cos(3) },
    raiz: { n: '√x', f: Math.sqrt, I: (2 / 3) * Math.pow(3, 1.5) },
  };

  /* ---------- Fig. 1: muestrear lo continuo ---------- */

  function montarMuestreo(cuerpo) {
    let clave = 'cuad', h = 0.5, hover = -1, plano = null, pts = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: Object.entries(FUN).map(([k, v]) => [k, v.n]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Paso h entre muestras', min: 0.05, max: 1.5, paso: 0.05, valor: h, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { h = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'curva continua f(x)', forma: 'linea' },
      { color: C.s1, texto: 'muestras discretas f(kh)', forma: 'punto' },
      { color: C.s2, texto: 'suma de rectángulos', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reduzca h: la suma discreta se acerca a la integral, pero nunca la alcanza con un número finito de muestras. Pase el cursor sobre un punto para leerlo.');

    function dibujar() {
      const F = FUN[clave], { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...Array.from({ length: 65 }, (_, i) => F.f(i * 0.05))) * 1.15;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 3.1, ymin: 0, ymax }, { etiquetaX: 'x', etiquetaY: 'f(x)' });
      plano.ejes();
      const N = Math.ceil(3 / h - 1e-9);
      let suma = 0;
      pts = [];
      for (let k = 0; k < N; k++) {
        const x = k * h, w = Math.min(h, 3 - x), y = F.f(x);
        suma += y * w;
        pts.push({ x, y });
        const a = plano.sx(x), b = plano.sx(x + w), t = plano.sy(y);
        ctx.fillStyle = VIZ.alfa(C.s2, 0.22);
        ctx.fillRect(a, t, b - a, plano.y0 - t);
        ctx.lineWidth = 1; ctx.strokeStyle = C.s2;
        ctx.strokeRect(a + 0.5, t + 0.5, b - a - 1, plano.y0 - t - 1);
      }
      VIZ.trazar(ctx, plano, Array.from({ length: 125 }, (_, i) => [i * 0.025, F.f(i * 0.025)]), C.apagado, 2);
      pts.forEach((p, i) => VIZ.marcador(ctx, plano.sx(p.x), plano.sy(p.y), C.s1, i === hover ? 6 : 4));
      lectura.set([['muestras', String(N)], ['suma discreta', VIZ.fmt(suma)], ['integral exacta', VIZ.fmt(F.I)], ['error', VIZ.fmt(Math.abs(suma - F.I))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(pts.length - 1, Math.max(0, Math.round(plano.ix(x) / h)));
      dibujar();
      tip.mostrar(x, y, `k = <b>${hover}</b><br>x = <b>${VIZ.fmt(pts[hover].x, 3)}</b><br>f(x) = <b>${VIZ.fmt(pts[hover].y)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: contable frente a denso ---------- */

  function montarDenso(cuerpo) {
    let k = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Rondas de puntos medios', min: 0, max: 6, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'elementos de ℕ', forma: 'punto' },
      { color: C.s1, texto: 'puntos de la recta tras k rondas', forma: 'punto' },
      { color: C.s2, texto: 'puntos entre 3 y 4', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, entre 3 y 4 no cabe nada: 4 es el sucesor inmediato de 3. Abajo, cada ronda inserta un punto medio entre cada par vecino y nunca se agota el espacio.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 24, x1 = W - 24, X = (v) => x0 + (v / 10) * (x1 - x0);
      D.texto2(ctx, 'ℕ: cada elemento tiene un siguiente inmediato', x0, 14, { alinea: 'left', color: C.tinta2 });
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, 50); ctx.lineTo(x1, 50); ctx.stroke();
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath(); ctx.arc(X(i), 50, 5, 0, 7); ctx.fillStyle = i === 3 || i === 4 ? C.s2 : C.tinta; ctx.fill();
        D.texto2(ctx, String(i), X(i), 70, { color: C.tinta2, px: 11 });
      }
      D.texto2(ctx, 'Recta con puntos medios sucesivos', x0, 118, { alinea: 'left', color: C.tinta2 });
      ctx.beginPath(); ctx.moveTo(x0, 154); ctx.lineTo(x1, 154); ctx.stroke();
      const n = 10 * 2 ** k;
      for (let i = 0; i <= n; i++) {
        const v = (i * 10) / n, ent = v > 3 && v < 4;
        ctx.beginPath(); ctx.arc(X(v), 154, ent ? (n > 200 ? 2.4 : 3.6) : n > 200 ? 1.6 : n > 60 ? 2.4 : 3.6, 0, 7);
        ctx.fillStyle = ent ? C.s2 : C.s1; ctx.fill();
      }
      for (const v of [0, 3, 4, 10]) D.texto2(ctx, String(v), X(v), 176, { color: C.tinta2, px: 11 });
      lectura.set([['puntos en [0, 10]', VIZ.entero(n + 1)], ['entre 3 y 4 en ℕ', '0'], ['entre 3 y 4 tras k rondas', VIZ.entero(2 ** k - 1)], ['rondas posibles', 'sin límite']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('discrete-continuous', {
    intro: String.raw`
      <p>Las matemáticas <strong>continuas</strong> estudian magnitudes que varían sin saltos —la posición de un objeto, una temperatura—
      y usan límites, derivadas e integrales. Las <strong>discretas</strong> estudian objetos que se pueden separar y contar uno a uno:
      números enteros, cadenas de bits, grafos, conjuntos finitos.</p>
      <p>Un computador es una máquina discreta: guarda cantidades finitas de bits. Por eso todo lo continuo que calcula es una
      <em>aproximación discreta</em>, y por eso hace falta un lenguaje preciso —conjuntos, inducción, lógica— para razonar sobre lo que sí es exacto.</p>`,
    visualizaciones: [
      {
        titulo: 'Muestrear lo continuo',
        descripcion: 'Una curva se reemplaza por muestras a distancia \\(h\\) y su área por una suma. Reduzca \\(h\\) y observe cómo cambia el error; compare las tres funciones.',
        montar: montarMuestreo,
      },
      {
        titulo: 'Entre dos vecinos',
        descripcion: 'En \\(\\mathbb{N}\\) no hay nada entre 3 y 4. En la recta real siempre se puede insertar un punto medio. Aumente las rondas y cuente.',
        montar: montarDenso,
      },
    ],
    teoria: String.raw`
      <h2>Qué significa «discreto»</h2>
      <p>Un conjunto es <strong>discreto</strong> cuando sus elementos están aislados: cada uno tiene un vecino más cercano a una distancia positiva.
      \(\mathbb{N}\) y \(\mathbb{Z}\) lo son; \(\mathbb{Q}\) y \(\mathbb{R}\) no, porque entre dos números distintos siempre hay otro:
      \[ a &lt; b \;\Longrightarrow\; a &lt; \tfrac{a+b}{2} &lt; b. \]</p>
      <h2>Contable frente a incontable</h2>
      <p>Un conjunto es <em>contable</em> si se puede poner en correspondencia uno a uno con \(\mathbb{N}\), es decir, listar sus elementos como una sucesión.
      \(\mathbb{Z}\) y \(\mathbb{Q}\) son contables (aunque \(\mathbb{Q}\) sea denso); en cambio \(\mathbb{R}\) no lo es: el argumento diagonal de Cantor
      produce, para cualquier lista de reales, un real que no está en ella.</p>
      <h2>Estructuras discretas</h2>
      <table>
        <tr><th>Estructura</th><th>Ejemplo</th><th>Se estudia con</th></tr>
        <tr><td>Conjuntos y funciones</td><td>\(\{1,2,3\}\)</td><td>teoría de conjuntos</td></tr>
        <tr><td>Sucesiones y cadenas</td><td>palabras sobre \(\{0,1\}\)</td><td>inducción, recursión</td></tr>
        <tr><td>Fórmulas</td><td>\(p \land (q \to r)\)</td><td>lógica</td></tr>
        <tr><td>Grafos y árboles</td><td>redes, jerarquías</td><td>combinatoria</td></tr>
      </table>
      <h2>Suma frente a integral</h2>
      <p>La suma de Riemann \(\sum_{k} f(kh)\,h\) es un objeto discreto que converge a \(\int f\) cuando \(h \to 0\). Para cualquier \(h &gt; 0\) fijo sigue habiendo un error;
      el paso al límite es justamente lo que separa lo discreto de lo continuo. En las secciones siguientes se construyen los naturales y la
      <a href="tema.html?id=simple-induction">inducción</a>, la herramienta básica para razonar sobre lo discreto.</p>`,
  });
})();
