(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: mil personas ---------- */

  function montarPoblacion(cuerpo) {
    let prev = 0.02, sens = 0.9, esp = 0.95, agrupar = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Prevalencia P(E)', min: 0.001, max: 0.5, paso: 0.001, valor: prev, formato: (v) => `${(v * 100).toFixed(1)} %`, alCambiar: (v) => { prev = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Sensibilidad P(+ | E)', min: 0.5, max: 1, paso: 0.01, valor: sens, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sens = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Especificidad P(− | no E)', min: 0.5, max: 1, paso: 0.005, valor: esp, formato: (v) => `${(v * 100).toFixed(1)} %`, alCambiar: (v) => { esp = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'agrupar por resultado', valor: agrupar, alCambiar: (v) => { agrupar = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(w, 760) * 0.5) + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'enfermo y positivo (verdadero positivo)' },
      { color: C.s4, texto: 'enfermo y negativo (falso negativo)' },
      { color: C.s2, texto: 'sano y positivo (falso positivo)' },
      { color: C.tenue, texto: 'sano y negativo' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mil personas a las que se aplica la prueba. Entre todos los positivos (rojo y naranjo), ¿qué fracción está enferma? Con prevalencia baja, los falsos positivos de los muchos sanos superan a los verdaderos positivos de los pocos enfermos.');
    let geo = null, celdas = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const N = 1000, nE = Math.round(N * prev), tp = Math.round(nE * sens), fn = nE - tp, fp = Math.round((N - nE) * (1 - esp)), tn = N - nE - fp;
      const grupos = agrupar ? [['tp', tp], ['fp', fp], ['fn', fn], ['tn', tn]] : [['tp', tp], ['fn', fn], ['fp', fp], ['tn', tn]];
      celdas = grupos.flatMap(([t, k]) => new Array(k).fill(t));
      const cols = 50, lado = Math.min(W, 760) / cols;
      geo = { lado, cols };
      const col = { tp: C.s8, fn: C.s4, fp: C.s2, tn: C.tenue };
      celdas.forEach((t, k) => {
        const i = Math.floor(k / cols), j = k % cols;
        ctx.fillStyle = col[t]; ctx.fillRect(j * lado + 1, i * lado + 1, lado - 2, lado - 2);
      });
      const pos = tp + fp;
      lectura.set([
        ['positivos', `${pos} (${tp} enfermos + ${fp} sanos)`],
        ['P(E | +) = VP / positivos', pos ? M.pct(tp / pos) : '—'],
        ['P(no E | −)', M.pct(tn / (tn + fn))],
        ['razón de verosimilitud LR+ = sens / (1 − esp)', VIZ.fmt(sens / (1 - esp), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const k = Math.floor(y / geo.lado) * geo.cols + Math.floor(x / geo.lado);
      if (k < 0 || k >= celdas.length || x > geo.lado * geo.cols) return tip.ocultar();
      const t = { tp: 'enfermo, prueba positiva', fn: 'enfermo, prueba negativa', fp: 'sano, prueba positiva', tn: 'sano, prueba negativa' }[celdas[k]];
      tip.mostrar(x, y, `persona ${k + 1}: <b>${t}</b><br>de este tipo: <b>${celdas.filter((c) => c === celdas[k]).length}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: actualizar con varias pruebas ---------- */

  function montarSecuencia(cuerpo) {
    let prev = 0.02, sens = 0.9, esp = 0.95, res = ['+'];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Prior P(E)', min: 0.001, max: 0.5, paso: 0.001, valor: prev, formato: (v) => `${(v * 100).toFixed(1)} %`, alCambiar: (v) => { prev = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Sensibilidad', min: 0.5, max: 1, paso: 0.01, valor: sens, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sens = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Especificidad', min: 0.5, max: 0.995, paso: 0.005, valor: esp, formato: (v) => `${(v * 100).toFixed(1)} %`, alCambiar: (v) => { esp = v; dibujar(); } });
    ctl.boton('Prueba positiva', () => { if (res.length < 12) res.push('+'); dibujar(); }, { primario: true });
    ctl.boton('Prueba negativa', () => { if (res.length < 12) res.push('−'); dibujar(); });
    ctl.boton('Borrar pruebas', () => { res = []; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'P(E | pruebas hasta aquí)', forma: 'linea' },
      { color: C.s8, texto: 'tras un positivo', forma: 'punto' },
      { color: C.s6, texto: 'tras un negativo', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada resultado multiplica las chances (odds) por la razón de verosimilitud: LR+ = sens / (1 − esp) si es positivo, LR− = (1 − sens) / esp si es negativo. El posterior de una prueba es el prior de la siguiente (suponiendo pruebas independientes dado el estado).');
    let pl = null, serie = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const lrp = sens / (1 - esp), lrn = (1 - sens) / esp;
      let odds = prev / (1 - prev);
      serie = [{ k: 0, p: prev, r: null }];
      res.forEach((r, k) => { odds *= r === '+' ? lrp : lrn; serie.push({ k: k + 1, p: odds / (1 + odds), r }); });
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(4, res.length), ymin: 0, ymax: 1 }, { etiquetaX: 'pruebas realizadas', etiquetaY: 'P(enfermo)', formatoY: (v) => `${Math.round(v * 100)}%`, ticksX: Array.from({ length: Math.max(4, res.length) + 1 }, (_, i) => i) });
      pl.ejes();
      VIZ.trazar(ctx, pl, serie.map((s) => [s.k, s.p]), C.s1, 2.5);
      serie.forEach((s) => VIZ.marcador(ctx, pl.sx(s.k), pl.sy(s.p), s.r === '+' ? C.s8 : s.r ? C.s6 : C.tinta, 5));
      const ult = serie[serie.length - 1];
      lectura.set([
        ['resultados', res.length ? res.join(' ') : '(ninguno)'],
        ['P(E | resultados)', M.pct(ult.p, 2)],
        ['LR+ · LR−', `${VIZ.fmt(lrp, 3)} · ${VIZ.fmt(lrn, 3)}`],
        ['odds posteriores', VIZ.fmt(ult.p / (1 - ult.p), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const s = serie[Math.max(0, Math.min(serie.length - 1, Math.round(pl.ix(x))))];
      tip.mostrar(x, y, `tras <b>${s.k}</b> pruebas<br>P(E) = <b>${M.pct(s.p, 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('bayes-theorem', {
    intro: String.raw`
      <p>El <strong>teorema de Bayes</strong> dice cómo invertir una probabilidad condicional: conociendo \(P(\text{prueba} \mid \text{enfermedad})\),
      calcular \(P(\text{enfermedad} \mid \text{prueba})\). Es la regla para <strong>actualizar una creencia con evidencia</strong>.</p>
      <p>Su consecuencia más contraintuitiva: una prueba muy precisa puede dar casi siempre falsos positivos si la condición es rara.
      La razón es que la respuesta depende de la <strong>probabilidad a priori</strong> tanto como de la calidad de la prueba.</p>`,
    visualizaciones: [
      {
        titulo: 'Mil personas',
        descripcion: 'Una prueba diagnóstica aplicada a mil personas. Baje la prevalencia y observe cómo cae la probabilidad de estar enfermo dado un positivo.',
        montar: montarPoblacion,
      },
      {
        titulo: 'Actualizar con varias pruebas',
        descripcion: 'El posterior tras cada resultado se usa como prior del siguiente. Pruebe dos positivos seguidos con prevalencia 2 %.',
        montar: montarSecuencia,
      },
    ],
    teoria: String.raw`
      <h2>Enunciado</h2>
      <p>De la regla del producto \(P(A, B) = P(A \mid B)P(B) = P(B \mid A)P(A)\) sale</p>
      \[ P(A \mid B) = \frac{P(B \mid A)\, P(A)}{P(B)}, \qquad P(B) = \sum_{a} P(B \mid a)\, P(a). \]
      <p>\(P(A)\) es el <strong>prior</strong>, \(P(B \mid A)\) la <strong>verosimilitud</strong>, \(P(A \mid B)\) el <strong>posterior</strong> y \(P(B)\)
      la <strong>evidencia</strong> (constante de normalización).</p>
      <h2>Prueba diagnóstica</h2>
      \[ P(E \mid +) = \frac{\text{sens} \cdot \text{prev}}{\text{sens} \cdot \text{prev} + (1 - \text{esp})(1 - \text{prev})}. \]
      <p>Con sensibilidad 90 %, especificidad 95 % y prevalencia 2 %: \(\frac{0{,}018}{0{,}018 + 0{,}049} \approx 27\,\%\). Ignorar la prevalencia
      (pensar que \(P(E \mid +) \approx P(+ \mid E)\)) es la <em>falacia de la tasa base</em>.</p>
      <h2>Forma de chances</h2>
      <p>Con chances \(O(A) = P(A)/P(\neg A)\):</p>
      \[ O(E \mid +) = \underbrace{\frac{P(+ \mid E)}{P(+ \mid \neg E)}}_{\text{LR}^+} \cdot O(E). \]
      <p>Cada evidencia multiplica las chances por su razón de verosimilitud; con evidencias condicionalmente independientes dado \(E\),
      los factores se multiplican, o se suman en escala logarítmica. Es la base del clasificador
      <a href="tema.html?id=naive-bayes">naive Bayes</a> y de la <a href="tema.html?id=bayesian-estimation">inferencia bayesiana</a>.</p>
      <div class="recuadro"><p>Encadenar pruebas así supone que sus errores son independientes dado el estado real. Repetir dos veces la
      misma prueba sobre la misma muestra no cumple ese supuesto, y el posterior calculado sería demasiado confiado.</p></div>`,
  });
})();