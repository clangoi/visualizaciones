(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.ml;

  /* ---------- Fig. 1: Naive Bayes gaussiano en el plano ---------- */

  // K clases gaussianas con la misma correlación ρ entre x₁ y x₂ dentro de cada clase.
  function generar(K, rho, sep, semilla) {
    const rnd = VIZ.semilla(semilla);
    const pts = [];
    for (let i = 0; i < 180; i++) {
      const c = i % K, a = (c * 2 * Math.PI) / K + 0.4;
      const z1 = VIZ.normal(rnd), z2 = VIZ.normal(rnd);
      const s = 0.28;
      pts.push({ x: sep * Math.cos(a) + s * z1, y: sep * Math.sin(a) + s * (rho * z1 + Math.sqrt(1 - rho * rho) * z2), c });
    }
    return pts.filter((q) => Math.abs(q.x) < 1.12 && Math.abs(q.y) < 1.12);
  }

  // Ajusta media, varianzas (y covarianza, para QDA) y prior de cada clase.
  function ajustar(pts, K) {
    return Array.from({ length: K }, (_, k) => {
      const q = pts.filter((p) => p.c === k), n = q.length;
      const mx = q.reduce((s, p) => s + p.x, 0) / n, my = q.reduce((s, p) => s + p.y, 0) / n;
      const vx = q.reduce((s, p) => s + (p.x - mx) ** 2, 0) / n + 1e-4, vy = q.reduce((s, p) => s + (p.y - my) ** 2, 0) / n + 1e-4;
      const cxy = q.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / n;
      return { prior: n / pts.length, mx, my, vx, vy, cxy };
    });
  }
  const logNB = (m, x, y) => Math.log(m.prior) - 0.5 * (Math.log(2 * Math.PI * m.vx) + (x - m.mx) ** 2 / m.vx + Math.log(2 * Math.PI * m.vy) + (y - m.my) ** 2 / m.vy);
  function logQDA(m, x, y) {
    const det = m.vx * m.vy - m.cxy * m.cxy, dx = x - m.mx, dy = y - m.my;
    return Math.log(m.prior) - 0.5 * (Math.log(4 * Math.PI * Math.PI * det) + (m.vy * dx * dx - 2 * m.cxy * dx * dy + m.vx * dy * dy) / det);
  }
  function posterior(modelo, f, x, y) {
    const l = modelo.map((m) => f(m, x, y)), mx = Math.max(...l);
    const e = l.map((v) => Math.exp(v - mx)), s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  }
  const argmax = (a) => a.reduce((m, v, i) => (v > a[m] ? i : m), 0);

  function montarGaussiano(cuerpo) {
    let K = 3, rho = 0, sep = 0.5, semilla = 1, qda = false, pts = [], modelo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Clases', min: 2, max: 3, valor: K, alCambiar: (v) => { K = v; datos(); } });
    ctl.rango({ etiqueta: 'Correlación ρ dentro de cada clase', min: -0.9, max: 0.9, paso: 0.05, valor: rho, formato: (v) => v.toFixed(2), alCambiar: (v) => { rho = v; datos(); } });
    ctl.rango({ etiqueta: 'Separación entre clases', min: 0.15, max: 0.75, paso: 0.05, valor: sep, formato: (v) => v.toFixed(2), alCambiar: (v) => { sep = v; datos(); } });
    ctl.casilla({ etiqueta: 'Comparar con covarianza completa (QDA)', valor: qda, alCambiar: (v) => { qda = v; datos(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las elipses son las curvas de 1 y 2 desviaciones estándar que Naive Bayes estima para cada clase: siempre alineadas con los ejes. Pase el cursor para ver las probabilidades a posteriori.');

    function datos() {
      pts = generar(K, rho, sep, semilla * 11 + K);
      modelo = ajustar(pts, K);
      leyenda.set([
        ...M.leyendaClases(K),
        { color: C.tinta2, texto: 'elipses de Naive Bayes (1σ y 2σ)', forma: 'linea' },
        ...(qda ? [{ color: C.tinta, texto: 'frontera de QDA', forma: 'linea' }] : []),
      ]);
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = M.plano(lienzo);
      M.regiones(ctx, plano, (x, y) => posterior(modelo, logNB, x, y));
      plano.ejes();
      if (qda) {
        for (let k = 0; k < K; k++) {
          M.contorno(ctx, plano, (x, y) => { const l = modelo.map((m) => logQDA(m, x, y)); return l[k] - Math.max(...l.filter((_, j) => j !== k)); }, 0, { color: C.tinta, ancho: 1.5, guiones: [5, 3] });
        }
      }
      ctx.save();
      plano.recortar();
      modelo.forEach((m, k) => {
        for (const s of [1, 2]) {
          ctx.beginPath();
          ctx.ellipse(plano.sx(m.mx), plano.sy(m.my), Math.abs(plano.sx(m.mx + s * Math.sqrt(m.vx)) - plano.sx(m.mx)), Math.abs(plano.sy(m.my + s * Math.sqrt(m.vy)) - plano.sy(m.my)), 0, 0, Math.PI * 2);
          ctx.strokeStyle = M.CLASES[k];
          ctx.lineWidth = s === 1 ? 2 : 1;
          ctx.stroke();
        }
      });
      ctx.restore();
      M.puntos(ctx, plano, pts, { r: 3.5 });
      const accNB = pts.filter((q) => argmax(posterior(modelo, logNB, q.x, q.y)) === q.c).length / pts.length;
      const accQ = pts.filter((q) => argmax(posterior(modelo, logQDA, q.x, q.y)) === q.c).length / pts.length;
      registro.textContent = Math.abs(rho) < 0.2 ? 'Con ρ ≈ 0 los atributos son de verdad independientes dentro de cada clase: el supuesto «ingenuo» se cumple y Naive Bayes coincide con QDA.'
        : `Con ρ = ${rho.toFixed(2)} las nubes están inclinadas, pero Naive Bayes solo ve sus varianzas por eje. Aun así suele clasificar bien: lo que importa es dónde queda el máximo, no que las probabilidades sean exactas.`;
      lectura.set([
        ['exactitud Naive Bayes', `${Math.round(100 * accNB)} %`],
        ['exactitud QDA', `${Math.round(100 * accQ)} %`],
        ['parámetros NB', String(K * 4 + K - 1)],
        ['parámetros QDA', String(K * 5 + K - 1)],
      ]);
    }
    lienzo.alDibujar = () => modelo.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const p = posterior(modelo, logNB, plano.ix(x), plano.iy(y));
      tip.mostrar(x, y, 'P(clase | x) según Naive Bayes' + p.map((v, k) => VIZ.filaTooltip(M.CLASES[k], `clase ${k}`, VIZ.fmt(v, 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
  }

  /* ---------- Fig. 2: un filtro de spam palabra por palabra ---------- */

  const SPAM = [
    'gana dinero rápido desde casa', 'oferta exclusiva gana un premio gratis', 'haz clic aquí para reclamar tu premio',
    'crédito gratis sin aval llama ahora', 'descuento exclusivo solo hoy compra ahora', 'has ganado un premio en efectivo',
    'dinero fácil y rápido gratis', 'oferta limitada haz clic ahora', 'compra ahora y gana un regalo gratis',
    'tu cuenta ganó un premio reclama hoy', 'promoción gratis solo por hoy', 'gana dinero extra con esta oferta',
  ];
  const NORMAL = [
    'reunión mañana a las diez en la oficina', 'te envío el informe del proyecto', 'nos vemos en la clase de cálculo',
    'puedes revisar el borrador del informe', 'la cena es a las ocho en casa', 'gracias por la ayuda con el proyecto',
    'mañana hay prueba de programación', 'el profesor publicó las notas de la prueba', 'llama a tu mamá cuando puedas',
    'el informe queda para el lunes', 'hoy no hay clase de física', 'te paso los apuntes de la clase',
  ];
  const fichas = (t) => t.toLowerCase().split(/[^a-záéíóúñü]+/).filter(Boolean);

  function montarSpam(cuerpo) {
    let alfa = 1, mensaje = 'gana un premio gratis en la clase de mañana';
    const cuenta = (docs) => { const m = new Map(); let n = 0; for (const d of docs) for (const w of fichas(d)) { m.set(w, (m.get(w) || 0) + 1); n++; } return { m, n }; };
    const cs = cuenta(SPAM), cn = cuenta(NORMAL);
    const vocab = new Set([...cs.m.keys(), ...cn.m.keys()]);
    const logp = (c, w) => Math.log(((c.m.get(w) || 0) + alfa) / (c.n + alfa * vocab.size));

    const ctl = VIZ.controles(cuerpo);
    const tx = ctl.texto({ etiqueta: 'Mensaje', valor: mensaje, alCambiar: (v) => { mensaje = v; actualizar(); }, alEnter: (v) => { mensaje = v; actualizar(); } });
    ctl.rango({ etiqueta: 'Suavizado de Laplace α', min: 0.05, max: 3, paso: 0.05, valor: alfa, formato: (v) => v.toFixed(2), alCambiar: (v) => { alfa = v; dibujar(); } });
    ctl.boton('Ejemplo de spam', () => { mensaje = 'oferta gratis haz clic ahora y gana dinero'; tx.valor = mensaje; actualizar(); });
    ctl.boton('Ejemplo normal', () => { mensaje = 'te envío las notas de la clase mañana'; tx.valor = mensaje; actualizar(); });

    const filas = () => fichas(mensaje).length + 2;
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 34 + filas() * 26 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'evidencia a favor de spam' },
      { color: C.s1, texto: 'evidencia a favor de normal' },
      { color: C.inactivo, texto: 'palabra desconocida (se ignora)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Escriba un mensaje y pulse Enter. El modelo se entrenó con ${SPAM.length} mensajes de spam y ${NORMAL.length} normales; cada barra es log P(palabra | spam) − log P(palabra | normal).`);

    function actualizar() { lienzo.ajustar(true); dibujar(); }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ws = fichas(mensaje);
      const prior = Math.log(SPAM.length / NORMAL.length);
      const items = [['prior: log P(spam)/P(normal)', prior, true], ...ws.map((w) => [w, vocab.has(w) ? logp(cs, w) - logp(cn, w) : 0, vocab.has(w)])];
      const total = items.reduce((s, it) => s + it[1], 0);
      items.push(['total (log de las chances)', total, true]);
      const etiq = Math.min(210, W * 0.38), x0 = etiq + 10, x1 = W - 10, xc = (x0 + x1) / 2;
      const esc = (x1 - x0) / 2 / Math.max(3, ...items.map((it) => Math.abs(it[1])));
      ctx.strokeStyle = C.eje;
      ctx.beginPath(); ctx.moveTo(xc + 0.5, 8); ctx.lineTo(xc + 0.5, 20 + items.length * 26); ctx.stroke();
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.tinta2;
      ctx.textAlign = 'right'; ctx.fillText('← normal', xc - 6, 10);
      ctx.textAlign = 'left'; ctx.fillText('spam →', xc + 6, 10);
      items.forEach(([t, v, conocida], i) => {
        const y = 24 + i * 26, ultimo = i === items.length - 1;
        ctx.font = VIZ.fuente(12, ultimo ? 600 : 400);
        ctx.fillStyle = conocida ? C.tinta : C.inactivo;
        ctx.textAlign = 'right';
        ctx.fillText(t.length > 28 ? t.slice(0, 27) + '…' : t, etiq, y + 8);
        if (conocida) {
          ctx.fillStyle = v > 0 ? C.s2 : C.s1;
          ctx.globalAlpha = ultimo ? 1 : 0.85;
          ctx.fillRect(v > 0 ? xc : xc + v * esc, y, Math.abs(v) * esc, 16);
          ctx.globalAlpha = 1;
          ctx.fillStyle = C.tinta;
          ctx.font = VIZ.fuente(11);
          ctx.textAlign = v > 0 ? 'left' : 'right';
          ctx.fillText(VIZ.fmt(v, 3), v > 0 ? xc + v * esc + 4 : xc + v * esc - 4, y + 8);
        }
      });
      const p = M.sigmoide(total);
      const conocidas = ws.filter((w) => vocab.has(w)).length;
      registro.textContent = `P(spam | mensaje) = σ(${VIZ.fmt(total, 3)}) = ${VIZ.fmt(p, 3)} → ${p > 0.5 ? 'SPAM' : 'normal'}. ` +
        'Naive Bayes suma la evidencia de cada palabra como si fueran independientes.';
      lectura.set([
        ['P(spam | mensaje)', VIZ.fmt(p, 3)],
        ['palabras conocidas', `${conocidas} de ${ws.length}`],
        ['vocabulario', String(vocab.size)],
        ['palabras de spam / normal', `${cs.n} / ${cn.n}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('naive-bayes', {
    intro: String.raw`
      <p>Un clasificador bayesiano elige la clase más probable dados los atributos, usando la regla de Bayes:
      \(P(c \mid x) \propto P(c)\, P(x \mid c)\). El problema es estimar \(P(x \mid c)\): con muchos atributos hay demasiadas
      combinaciones para contarlas.</p>
      <p><strong>Naive Bayes</strong> hace un supuesto «ingenuo»: dentro de cada clase, los atributos son
      <strong>independientes</strong>, así que \(P(x \mid c) = \prod_j P(x_j \mid c)\) y basta estimar una distribución por
      atributo. El supuesto casi nunca es cierto, pero el clasificador resulta rápido, necesita pocos datos y funciona
      sorprendentemente bien, en especial con textos.</p>`,
    visualizaciones: [
      {
        titulo: 'Naive Bayes gaussiano',
        descripcion: 'Cada clase se modela con una gaussiana por atributo. Aumente la correlación ρ: las elipses de Naive Bayes no pueden inclinarse, pero la exactitud casi no cae. Active QDA para ver la frontera con covarianza completa.',
        montar: montarGaussiano,
      },
      {
        titulo: 'Un filtro de spam',
        descripcion: 'Naive Bayes multinomial sobre palabras: la decisión es una suma de evidencias. Escriba una palabra que no esté en el vocabulario o suba α para ver el efecto del suavizado.',
        montar: montarSpam,
      },
    ],
    teoria: String.raw`
      <h2>Regla de decisión</h2>
      <p>Para minimizar la probabilidad de error se elige la clase con mayor probabilidad a posteriori:</p>
      \[ \hat c = \arg\max_c P(c \mid x) = \arg\max_c P(c) \, P(x \mid c), \]
      <p>porque \(P(x)\) no depende de \(c\). Con el supuesto de independencia condicional, y en logaritmos para evitar
      productos de números diminutos:</p>
      \[ \hat c = \arg\max_c \Big[ \log P(c) + \sum_{j=1}^{d} \log P(x_j \mid c) \Big]. \]

      <h2>Variantes según el tipo de atributo</h2>
      <ul>
        <li><strong>Gaussiano</strong> (atributos reales): \(P(x_j \mid c) = \mathcal{N}(x_j; \mu_{cj}, \sigma_{cj}^2)\), con media y
        varianza muestrales por clase y atributo. Equivale a un modelo gaussiano con covarianza <em>diagonal</em>; con covarianza
        completa se obtiene el análisis discriminante cuadrático (QDA).</li>
        <li><strong>Multinomial</strong> (conteos, textos): \(P(w \mid c) = \dfrac{N_{cw} + \alpha}{N_c + \alpha |V|}\), donde
        \(N_{cw}\) es el número de veces que la palabra \(w\) aparece en la clase \(c\), \(N_c\) el total de palabras de la clase y
        \(|V|\) el tamaño del vocabulario.</li>
        <li><strong>Bernoulli</strong> (atributos binarios): presencia o ausencia de cada palabra.</li>
      </ul>

      <h2>Suavizado</h2>
      <p>Sin suavizado (\(\alpha = 0\)), una palabra que nunca apareció en una clase tiene probabilidad cero y anula todo el
      producto, sin importar cuánta evidencia haya en contra. El suavizado de Laplace (\(\alpha = 1\)) suma una cuenta ficticia a
      cada palabra; equivale a un prior de Dirichlet uniforme sobre las probabilidades de palabras.</p>

      <h2>Entrenamiento y costo</h2>
      <p>Entrenar es contar: una pasada por los datos, \(O(n d)\), sin optimización iterativa. Hay \(O(K d)\) parámetros, en vez
      de los \(O(K d^2)\) de una gaussiana completa o los \(O(K\,2^d)\) de una tabla conjunta de atributos binarios. Por eso
      Naive Bayes funciona con pocos datos y muchísimos atributos.</p>

      <h2>Por qué funciona aunque el supuesto sea falso</h2>
      <p>Si los atributos están correlacionados, Naive Bayes cuenta la misma evidencia varias veces y sus probabilidades quedan
      <em>mal calibradas</em> (demasiado cercanas a 0 o 1). Pero para clasificar solo importa cuál clase gana, y el
      \(\arg\max\) suele no cambiar. En el caso binario, el logaritmo de las chances es una suma de términos por atributo: con
      atributos multinomiales o de Bernoulli es un clasificador <em>lineal</em>, de la misma forma que la
      <a href="tema.html?id=logistic-regression">regresión logística</a>, pero con pesos obtenidos contando en vez de optimizando
      (modelo generativo frente a discriminativo).</p>`,
  });
})();
