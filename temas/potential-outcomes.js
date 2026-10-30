(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Asigna el tratamiento al azar o según la gravedad (autoselección).
  function asignar(D, mecanismo, rnd) {
    return D.map((d) => {
      const p = mecanismo === 'azar' ? 0.5 : 1 / (1 + Math.exp(-2.2 * d.x2));
      const t = rnd() < p ? 1 : 0;
      return { ...d, t, y: t ? d.y1 : d.y0 };
    });
  }

  /* ---------- Fig. 1: la tabla de resultados potenciales ---------- */

  function montarTabla(cuerpo) {
    let mecanismo = 'seleccion', ver = false, semilla = 1, asig = 1, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Asignación del tratamiento', opciones: [['azar', 'al azar (moneda)'], ['seleccion', 'autoselección: se tratan los más graves']], valor: mecanismo, alCambiar: (v) => { mecanismo = v; asignarDe(); } });
    ctl.casilla({ etiqueta: 'mostrar el resultado contrafactual (lo que nunca se observa)', valor: ver, alCambiar: (v) => { ver = v; dibujar(); } });
    ctl.boton('Nueva asignación', () => { asig++; asignarDe(); }, { primario: true });
    ctl.boton('Nuevos pacientes', () => { semilla++; generar(); });
    const tabla = M.tabla(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    cuerpo.dataset.sinLeyenda = 'solo tabla';
    VIZ.nota(cuerpo, 'Cada paciente tiene dos resultados potenciales: Y(1) si se trata e Y(0) si no; solo se ve el que corresponde al tratamiento recibido. Con autoselección, los tratados son más graves y tendrían valores más altos aun sin tratamiento, así que la diferencia ingenua mezcla el efecto con la gravedad y lo sobreestima.');
    let base = [];
    function generar() { base = M.estudio(14, semilla, { conf: 0 }); asignarDe(); }
    function asignarDe() { D = asignar(base, mecanismo, VIZ.semilla(asig * 31 + semilla)); dibujar(); }
    function dibujar() {
      const f = (v) => VIZ.fmt(v, 2);
      const oculto = { texto: '?', clase: 'vacia' };
      tabla.set([{ texto: 'paciente', clase: 'izq' }, 'gravedad', 'T', 'Y(0)', 'Y(1)', 'Y observado', 'efecto individual'],
        D.map((d, i) => [{ texto: `#${i + 1}`, clase: 'izq' }, f(d.x2), d.t ? 'tratado' : 'control',
          d.t && !ver ? oculto : { texto: f(d.y0), estilo: d.t ? { color: C.s7 } : null },
          !d.t && !ver ? oculto : { texto: f(d.y1), estilo: !d.t ? { color: C.s7 } : null },
          f(d.y), ver ? f(d.y1 - d.y0) : oculto]));
      const V = M.efectosVerdaderos(D);
      lectura.set([
        ['ATE verdadero (promedio de todos)', VIZ.fmt(V.ate, 3)],
        ['ATT verdadero (tratados) · ATC (controles)', `${VIZ.fmt(V.att, 3)} · ${VIZ.fmt(V.atc, 3)}`],
        ['diferencia ingenua de medias', D.some((d) => d.t) && D.some((d) => !d.t) ? VIZ.fmt(V.ingenuo, 3) : '—'],
        ['tratados', `${D.filter((d) => d.t).length} de ${D.length}`],
      ]);
    }
    generar();
  }

  /* ---------- Fig. 2: el estimador ingenuo en muchas repeticiones ---------- */

  function montarRepeticiones(cuerpo) {
    let n = 200, reps = 500, semilla = 1, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Pacientes por estudio', min: 20, max: 1000, paso: 20, valor: n, alCambiar: (v) => { n = v; }, alSoltar: () => calcular() });
    ctl.boton('Repetir 500 estudios', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'asignación al azar' }, { color: C.s2, texto: 'autoselección' }, { color: C.s6, texto: 'ATE verdadero', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada estudio toma n pacientes nuevos, asigna el tratamiento y calcula la diferencia de medias. Con azar, los estudios se reparten alrededor del valor verdadero (insesgado); con autoselección, alrededor de otro valor, por grande que sea n.');
    function calcular() {
      const rnd = VIZ.semilla(semilla * 9);
      const azar = [], sel = [], ates = [];
      for (let r = 0; r < reps; r++) {
        const base = M.estudio(n, semilla * 1000 + r, { conf: 0 });
        ates.push(M.efectosVerdaderos(base).ate);
        azar.push(M.efectosVerdaderos(asignar(base, 'azar', rnd)).ingenuo);
        sel.push(M.efectosVerdaderos(asignar(base, 'seleccion', rnd)).ingenuo);
      }
      res = { azar: azar.filter(Number.isFinite), sel: sel.filter(Number.isFinite), ate: M.media(ates) };
      dibujar();
    }
    let pl = null, cA = [], cS = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = [...res.azar, ...res.sel], lo = Math.min(...todos, res.ate) - 0.2, hi = Math.max(...todos, res.ate) + 0.2, bins = 50;
      const dens = (v) => { const c = new Array(bins).fill(0); v.forEach((x) => { const b = Math.floor(((x - lo) / (hi - lo)) * bins); if (b >= 0 && b < bins) c[b]++; }); return Math.max(...c) / (v.length * ((hi - lo) / bins)); };
      pl = VIZ.plano(lienzo, { xmin: lo, xmax: hi, ymin: 0, ymax: Math.max(dens(res.azar), dens(res.sel)) * 1.1 }, { etiquetaX: 'diferencia de medias estimada', etiquetaY: 'densidad' });
      pl.ejes();
      cA = M.histograma(ctx, pl, res.azar, { min: lo, max: hi, bins, color: C.s1, densidad: true, alfa: 0.7 });
      cS = M.histograma(ctx, pl, res.sel, { min: lo, max: hi, bins, color: C.s2, densidad: true, alfa: 0.7 });
      VIZ.trazar(ctx, pl, [[res.ate, 0], [res.ate, pl.d.ymax]], C.s6, 2, [5, 4]);
      lectura.set([
        ['ATE verdadero', VIZ.fmt(res.ate, 3)],
        ['azar: media · desviación', `${VIZ.fmt(M.media(res.azar), 3)} · ${VIZ.fmt(M.desv(res.azar), 3)}`],
        ['autoselección: media · desviación', `${VIZ.fmt(M.media(res.sel), 3)} · ${VIZ.fmt(M.desv(res.sel), 3)}`],
        ['sesgo por autoselección', VIZ.fmt(M.media(res.sel) - res.ate, 3)],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const b = Math.floor(((pl.ix(x) - pl.d.xmin) / (pl.d.xmax - pl.d.xmin)) * 50);
      if (b < 0 || b >= 50) return tip.ocultar();
      tip.mostrar(x, y, `estimación ≈ <b>${VIZ.fmt(pl.ix(x), 3)}</b>` + VIZ.filaTooltip(C.s1, 'azar', VIZ.fmt(cA[b], 3)) + VIZ.filaTooltip(C.s2, 'autoselección', VIZ.fmt(cS[b], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('potential-outcomes', {
    intro: String.raw`
      <p>El marco de <strong>resultados potenciales</strong> (Neyman, Rubin) define el efecto causal como una comparación entre dos mundos:
      el resultado de cada unidad si recibe el tratamiento, \(Y(1)\), y si no lo recibe, \(Y(0)\). El efecto individual es \(Y(1) - Y(0)\).</p>
      <p>El <strong>problema fundamental de la inferencia causal</strong> es que nunca se observan ambos para la misma unidad. Todo el trabajo
      consiste en estimar promedios de efectos —ATE, ATT, ATC— comparando grupos que, idealmente, solo difieran en el tratamiento.</p>`,
    visualizaciones: [
      {
        titulo: 'La tabla de resultados potenciales',
        descripcion: 'Catorce pacientes con sus dos resultados potenciales. Oculte o muestre el contrafactual y compare la diferencia ingenua con los efectos verdaderos según cómo se asigna el tratamiento.',
        montar: montarTabla,
      },
      {
        titulo: 'El estimador ingenuo en muchas repeticiones',
        descripcion: 'La diferencia de medias repetida en 500 estudios, con asignación al azar y con autoselección.',
        montar: montarRepeticiones,
      },
    ],
    teoria: String.raw`
      <h2>Estimandos</h2>
      <p>Para unidades \(i = 1, \dots, n\) con tratamiento \(T_i \in \{0, 1\}\) y resultados potenciales \(Y_i(0), Y_i(1)\):</p>
      \[ \tau_i = Y_i(1) - Y_i(0), \qquad \mathrm{ATE} = \mathbb E[\tau], \qquad \mathrm{ATT} = \mathbb E[\tau \mid T = 1], \qquad \mathrm{ATC} = \mathbb E[\tau \mid T = 0]. \]
      <p>Se observa \(Y_i = T_i Y_i(1) + (1 - T_i) Y_i(0)\) (supuesto de <strong>consistencia</strong>; junto con que el tratamiento de uno no afecta a
      otros forma el supuesto SUTVA). El ATT responde «¿cuánto ganaron quienes se trataron?»; el ATE, «¿cuánto ganaría la población si todos se trataran?».
      Difieren si el efecto es heterogéneo y los tratados son distintos.</p>
      <h2>Por qué falla la diferencia ingenua</h2>
      \[ \underbrace{\mathbb E[Y \mid T = 1] - \mathbb E[Y \mid T = 0]}_{\text{diferencia observada}}
         = \mathrm{ATT} + \underbrace{\mathbb E[Y(0) \mid T = 1] - \mathbb E[Y(0) \mid T = 0]}_{\text{sesgo de selección}}. \]
      <p>Si los tratados habrían tenido peores resultados aun sin tratamiento (son más graves), el sesgo es negativo.</p>
      <h2>Supuestos de identificación</h2>
      <ul>
        <li><strong>Aleatorización</strong>: \((Y(0), Y(1)) \perp\!\!\!\perp T\). El sesgo de selección es 0 y la diferencia de medias estima el ATE.</li>
        <li><strong>Ignorabilidad condicional</strong> (no confusión): \((Y(0), Y(1)) \perp\!\!\!\perp T \mid X\). Dentro de cada valor de las covariables \(X\), la
        asignación es como al azar. Equivale a que \(X\) cumpla el <a href="tema.html?id=backdoor-frontdoor">criterio back-door</a>.</li>
        <li><strong>Positividad</strong> (solapamiento): \(0 &lt; P(T = 1 \mid X = x) &lt; 1\) para todo \(x\): para cada perfil hay tratados y controles con quienes comparar.</li>
      </ul>
      <p>Bajo ignorabilidad y positividad, \(\mathrm{ATE} = \mathbb E_X\bigl[\mathbb E[Y \mid T = 1, X] - \mathbb E[Y \mid T = 0, X]\bigr]\), y los métodos de
      <a href="tema.html?id=matching">matching</a>, <a href="tema.html?id=propensity-score">propensity score</a> y
      <a href="tema.html?id=outcome-models">modelos de resultado</a> son maneras de estimarlo.</p>`,
  });
})();