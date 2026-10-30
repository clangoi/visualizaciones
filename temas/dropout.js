(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const TAM = [4, 10, 10, 1];
  const X = [0.9, -0.6, 0.4, 0.7];

  /* ---------- Fig. 1: máscaras aleatorias y el promedio de muchas subredes ---------- */

  function montarMascaras(cuerpo) {
    let p = 0.5, semilla = 1, mascaras = null, apagadas = [], red = null, salidas = [], det = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Probabilidad de apagar p', min: 0, max: 0.9, paso: 0.05, valor: p, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { p = v; calcular(); } });
    ctl.boton('Nueva máscara', () => { semilla++; calcular(); }, { primario: true });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.95, altoMin: 260, altoMax: 360 });
    const l2 = VIZ.lienzo(cols, { proporcion: 0.95, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'neurona apagada en este paso', forma: 'punto' }, { color: C.s1, texto: 'salida de 400 subredes (histograma)', forma: 'cuadro' }, { color: C.s2, texto: 'promedio de las subredes', forma: 'linea' }, { color: C.s6, texto: 'red completa con pesos reescalados (inferencia)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En cada paso de entrenamiento se apaga un subconjunto distinto: se entrena una subred distinta. Al evaluar se usa la red completa; gracias al reescalado 1/(1−p) su salida coincide con el promedio de las subredes.');
    function calcular() {
      red = DL.red(TAM, { act: 'tanh', salida: 'lineal', semilla: 3 });
      const r = VIZ.semilla(semilla * 31 + 7);
      const gen = () => TAM.map((n, l) => (l === 0 || l === TAM.length - 1 ? null : Array.from({ length: n }, () => (r() < p ? 0 : 1 / (1 - p)))));
      mascaras = gen();
      apagadas = []; mascaras.forEach((m, l) => m && m.forEach((v, j) => { if (!v) apagadas.push([l, j]); }));
      salidas = Array.from({ length: 400 }, () => DL.adelante(red, X, gen()).y[0]);
      det = DL.adelante(red, X).y[0];
      dibujar();
    }
    function dibujar() {
      if (!red) return;
      {
        const { ctx, ancho: W, alto: H } = l1;
        l1.limpiar();
        const valores = DL.adelante(red, X, mascaras).a;
        DL.diagramaRed(ctx, 24, 20, W - 48, H - 50, TAM, { red, apagadas, valores, r: 9 });
      }
      {
        const { ctx } = l2;
        l2.limpiar();
        const lo = Math.min(...salidas, det) - 0.3, hi = Math.max(...salidas, det) + 0.3, B = 24;
        const cuenta = new Array(B).fill(0);
        salidas.forEach((v) => { cuenta[Math.min(B - 1, Math.floor(((v - lo) / (hi - lo)) * B))]++; });
        const pl = VIZ.plano(l2, { xmin: lo, xmax: hi, ymin: 0, ymax: Math.max(...cuenta) * 1.1 }, { etiquetaX: 'salida de la red', etiquetaY: 'subredes' });
        pl.ejes();
        const bw = (pl.x1 - pl.x0) / B;
        cuenta.forEach((n, i) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(pl.x0 + i * bw + 1, pl.sy(n), bw - 2, pl.y0 - pl.sy(n), [3, 3, 0, 0]); ctx.fill(); });
        const media = salidas.reduce((s, v) => s + v, 0) / salidas.length;
        ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
        ctx.strokeStyle = C.s2; ctx.beginPath(); ctx.moveTo(pl.sx(media), pl.y0); ctx.lineTo(pl.sx(media), pl.y1); ctx.stroke();
        ctx.strokeStyle = C.s6; ctx.beginPath(); ctx.moveTo(pl.sx(det), pl.y0); ctx.lineTo(pl.sx(det), pl.y1); ctx.stroke();
        ctx.setLineDash([]);
        const sd = Math.sqrt(salidas.reduce((s, v) => s + (v - media) ** 2, 0) / salidas.length);
        registro.textContent = `Se apagaron ${apagadas.length} de ${TAM[1] + TAM[2]} neuronas ocultas. La salida de las subredes varía con desviación ${VIZ.fmt(sd, 3)} alrededor de ${VIZ.fmt(media, 3)}; la red completa da ${VIZ.fmt(det, 3)}.`;
        lectura.set([['neuronas apagadas ahora', `${apagadas.length} de ${TAM[1] + TAM[2]}`], ['promedio de subredes', VIZ.fmt(media, 3)], ['red completa', VIZ.fmt(det, 3)], ['dispersión entre subredes', VIZ.fmt(sd, 3)], ['subredes posibles', `2^${TAM[1] + TAM[2]} = ${VIZ.entero(2 ** (TAM[1] + TAM[2]))}`]]);
        l2.pl = { pl, lo, hi, B, cuenta };
      }
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev), g = l2.pl;
      if (!g || !g.pl.dentro(x, y)) return tip.ocultar();
      const i = Math.min(g.B - 1, Math.max(0, Math.floor(((x - g.pl.x0) / (g.pl.x1 - g.pl.x0)) * g.B)));
      tip.mostrar(x, y, `salida ≈ <b>${VIZ.fmt(g.lo + ((i + 0.5) * (g.hi - g.lo)) / g.B, 2)}</b><br>subredes <b>${g.cuenta[i]}</b>`);
    });
    l2.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: dropout durante el entrenamiento ---------- */

  function montarEntrenamiento(cuerpo) {
    DL.entrenador(cuerpo, {
      controles: ['datos', 'ruido', 'ocultas', 'capas', 'dropout'],
      inicial: { datos: 'lunas', ruido: 0.4, n: 70, ocultas: 24, capas: 2, act: 'relu', opt: 'adam', lr: 0.03, dropout: 0 },
      nota: 'Con dropout 0 la red sobreajusta; con p entre 0,3 y 0,5 la pérdida de validación se mantiene más baja y la de entrenamiento sube un poco. Con p muy alto, subajusta.',
    });
  }

  VIZ.registrarTema('dropout', {
    intro: String.raw`
      <p>El <strong>dropout</strong> apaga al azar una fracción de las neuronas en cada paso de entrenamiento. Ninguna neurona puede apoyarse en que otra «esté ahí» para corregir sus errores, y la red aprende representaciones redundantes y más robustas.</p>
      <p>Otra manera de verlo: cada paso entrena una <em>subred</em> distinta, y la red completa que se usa al evaluar es una especie de promedio (<em>ensemble</em>) de un número astronómico de subredes que comparten pesos.</p>`,
    visualizaciones: [
      { titulo: 'Subredes aleatorias', descripcion: 'Genere máscaras nuevas y compare la salida de cientos de subredes con la red completa. Suba \\(p\\) para aumentar la dispersión.', montar: montarMascaras },
      { titulo: 'Dropout al entrenar', descripcion: 'Entrene una red grande con pocos datos y compare las curvas de validación con \\(p=0\\), \\(p=0{,}4\\) y \\(p=0{,}8\\).', montar: montarEntrenamiento },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Durante el entrenamiento, para cada capa oculta se muestrea una máscara \(m_j\sim\operatorname{Bernoulli}(1-p)\) y</p>
      \[ \tilde a_j = \frac{m_j}{1-p}\,a_j. \]
      <p>El factor \(1/(1-p)\) (<em>dropout invertido</em>) mantiene constante la esperanza, \(\mathbb{E}[\tilde a_j]=a_j\), de modo que en inferencia no hace falta ningún ajuste: simplemente no se usa máscara.</p>
      <h2>Efecto como promedio</h2>
      <p>Una red con \(n\) neuronas apagables define \(2^n\) subredes. La red completa con pesos reescalados aproxima el promedio geométrico de sus predicciones. En una capa lineal la equivalencia es exacta; con no linealidades es una aproximación.</p>
      <h2>Regularización</h2>
      <p>Para un modelo lineal con dropout en las entradas, el entrenamiento equivale a minimizar la pérdida más una penalización adaptativa de tipo L2, \(\tfrac{p}{2(1-p)}\sum_j w_j^2 \,\mathbb{E}[x_j^2]\): castiga más los pesos que dependen de entradas grandes.</p>
      <div class="recuadro"><p>Valores habituales: \(p=0{,}5\) en capas densas grandes y \(0{,}1\)–\(0{,}2\) en capas convolucionales. Si la red subajusta, el dropout empeora las cosas: úselo solo cuando haya brecha de generalización. Combínelo con <a href="tema.html?id=l1-l2-regularization">L2</a> y, si usa <a href="tema.html?id=batch-normalization">Batch Normalization</a>, con cuidado, porque ambos interactúan.</p></div>`,
  });
})();
