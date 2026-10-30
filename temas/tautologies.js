(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const EJ = [
    ['p ∨ ¬p', 'tercero excluido'], ['p ∧ ¬p', 'no contradicción'], ['p → (q → p)', 'afirmación del consecuente'], ['((p → q) → p) → p', 'ley de Peirce'],
    ['(p → q) ∨ (q → p)', 'siempre una implica la otra'], ['¬(p ∧ q) ↔ (¬p ∨ ¬q)', 'De Morgan'], ['p ∧ q', 'contingente'], ['(p → q) → (q → p)', 'conversa: no es tautología'],
  ];

  /* ---------- Fig. 1: clasificador ---------- */

  function montarClasificador(cuerpo) {
    let ast = D.leer(EJ[0][0]), geo = null, res = [], vars = [];
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: EJ[0][0], alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: EJ.map(([f, n]) => [f, `${f}   (${n})`]), valor: EJ[0][0], alCambiar: (v) => { campo.valor = v; ast = D.leer(v); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 120 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'la fórmula vale V en esa valuación', forma: 'cuadro' }, { color: C.neutro, borde: C.eje, texto: 'vale F', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda es una valuación; el color dice qué vale la fórmula ahí. Todas verdes: tautología. Ninguna: contradicción. Mezcla: contingencia. Pase el cursor por una celda.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      vars = D.vars(ast);
      if (vars.length > 5) { registro.textContent = 'Use a lo más 5 variables.'; return; }
      res = D.resultados(ast, vars);
      const n = res.length, x0 = 10, w = W - 2 * x0;
      D.texto2(ctx, `${n} valuaciones (de «todo V» a «todo F»)`, x0, 14, { alinea: 'left', color: C.tinta2, px: 11 });
      const cw = D.tira(ctx, x0, 28, w, n, (i) => ({ fondo: res[i] ? C.s6 : C.neutro, texto: res[i] ? 'V' : 'F', tinta: res[i] ? C.sobre : C.apagado }), 40);
      geo = { x0, cw };
      const cls = D.clase(res);
      registro.textContent = `«${D.texto(ast)}» es una ${cls}${cls === 'tautología' ? ': verdadera bajo toda valuación.' : cls === 'contradicción' ? ': falsa bajo toda valuación.' : ': verdadera bajo algunas valuaciones y falsa bajo otras.'}`;
      lectura.set([['clasificación', cls], ['variables', vars.join(', ') || '—'], ['verdaderas', `${res.filter(Boolean).length} de ${n}`], ['¿satisfacible?', res.some(Boolean) ? 'sí' : 'no'], ['¿válida?', res.every(Boolean) ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = Math.floor((x - geo.x0) / geo.cw);
      if (i < 0 || i >= res.length || y < 28 || y > 68) return tip.ocultar();
      tip.mostrar(x, y, `${D.valTexto(D.valuaciones(vars)[i], vars)}<br>fórmula = <b>${res[i] ? 'V' : 'F'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: qué tan raras son las tautologías ---------- */

  function montarRarezas(cuerpo) {
    let nv = 3, semilla = 1, datos = [], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variables disponibles', min: 1, max: 4, valor: nv, alCambiar: (v) => { nv = v; muestrear(); } });
    ctl.boton('Nuevo muestreo', () => { semilla++; muestrear(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tautología', forma: 'cuadro' }, { color: C.s3, texto: 'contingencia', forma: 'cuadro' }, { color: C.s2, texto: 'contradicción', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada profundidad se generan 300 fórmulas al azar. Las tautologías son una fracción pequeña salvo con pocas variables, y las fórmulas más profundas casi siempre son contingentes.');

    function muestrear() {
      const vars = ['p', 'q', 'r', 's'].slice(0, nv);
      datos = [];
      for (let d = 1; d <= 5; d++) {
        const rnd = VIZ.semilla(semilla * 101 + d * 7 + nv), cuenta = { 'tautología': 0, contingencia: 0, 'contradicción': 0 };
        for (let i = 0; i < 300; i++) cuenta[D.clase(D.resultados(D.aleatoria(rnd, vars, d, ['and', 'or', 'imp', 'iff', 'not']), vars))]++;
        datos.push({ d, ...cuenta });
      }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0.4, xmax: 5.6, ymin: 0, ymax: 1 }, { etiquetaX: 'profundidad máxima', etiquetaY: 'fracción de las 300 fórmulas', ticksX: [1, 2, 3, 4, 5], ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => `${Math.round(v * 100)} %`, formatoX: (v) => String(v) });
      plano.ejes();
      for (const o of datos) {
        let acum = 0;
        for (const [k, c] of [['tautología', C.s1], ['contingencia', C.s3], ['contradicción', C.s2]]) {
          const f = o[k] / 300, x0 = plano.sx(o.d - 0.32), x1 = plano.sx(o.d + 0.32);
          ctx.fillStyle = c; ctx.fillRect(x0, plano.sy(acum + f), x1 - x0, plano.sy(acum) - plano.sy(acum + f));
          acum += f;
        }
      }
      const t = datos.reduce((s, o) => s + o['tautología'], 0), z = datos.reduce((s, o) => s + o['contradicción'], 0);
      lectura.set([['variables', String(nv)], ['tautologías (de 1500)', String(t)], ['contradicciones (de 1500)', String(z)], ['contingencias (de 1500)', String(1500 - t - z)]]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const d = Math.round(plano.ix(x)), o = datos[d - 1];
      if (!o) return tip.ocultar();
      tip.mostrar(x, y, `profundidad <b>${d}</b>` + VIZ.filaTooltip(C.s1, 'tautología', `${o['tautología']}`) + VIZ.filaTooltip(C.s3, 'contingencia', `${o.contingencia}`) + VIZ.filaTooltip(C.s2, 'contradicción', `${o['contradicción']}`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    muestrear();
  }

  VIZ.registrarTema('tautologies', {
    intro: String.raw`
      <p>Según su tabla de verdad, una fórmula puede ser de tres tipos. Una <strong>tautología</strong> es verdadera bajo toda valuación: es una verdad lógica, como «llueve o no llueve».
      Una <strong>contradicción</strong> es falsa bajo toda valuación. Y una <strong>contingencia</strong> es verdadera en algunas y falsa en otras: su valor depende de los hechos.</p>
      <p>Las tautologías son las leyes de la lógica: no dicen nada del mundo, pero son lo que se puede usar sin riesgo en cualquier razonamiento.</p>`,
    visualizaciones: [
      {
        titulo: 'Clasifique una fórmula',
        descripcion: 'Elija un ejemplo o escriba una fórmula y mire su columna de resultados. Pruebe la conversa de una implicación: no es una tautología.',
        montar: montarClasificador,
      },
      {
        titulo: 'Qué tan raras son las tautologías',
        descripcion: 'En fórmulas aleatorias, casi todo es contingencia. Aumente las variables y las profundidades y vea desaparecer las tautologías.',
        montar: montarRarezas,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <table>
        <tr><th>Tipo</th><th>Condición</th><th>Ejemplo</th></tr>
        <tr><td>Tautología (válida)</td><td>\(v(\varphi) = 1\) para toda \(v\)</td><td>\(p \lor \neg p\)</td></tr>
        <tr><td>Contradicción (insatisfacible)</td><td>\(v(\varphi) = 0\) para toda \(v\)</td><td>\(p \land \neg p\)</td></tr>
        <tr><td>Contingencia</td><td>ni lo uno ni lo otro</td><td>\(p \land q\)</td></tr>
      </table>
      <p>\(\varphi\) es una tautología si y solo si \(\neg\varphi\) es una contradicción. Una fórmula <em>satisfacible</em> es la que tiene al menos una valuación que la hace verdadera (contingencias y tautologías); ver <a href="tema.html?id=satisfiability">Satisfiability</a>.</p>
      <h2>Algunas tautologías famosas</h2>
      <ul>
        <li>Tercero excluido: \(p \lor \neg p\).</li>
        <li>Contrapositiva: \((p \to q) \leftrightarrow (\neg q \to \neg p)\).</li>
        <li>Silogismo hipotético: \(((p \to q) \land (q \to r)) \to (p \to r)\).</li>
        <li>Ley de Peirce: \(((p \to q) \to p) \to p\).</li>
      </ul>
      <h2>Decidir por tabla frente a decidir por refutación</h2>
      <p>Decidir si una fórmula es tautología es el problema coNP-completo clásico: se conoce el algoritmo de la tabla (tiempo \(2^n\)) y no se conoce uno polinómico. Comparar tautologías con consecuencia lógica da el paso siguiente:
      \(A \models B\) si y solo si \(A \to B\) es tautología (ver <a href="tema.html?id=logical-consequence">Logical Consequence</a>).</p>`,
  });
})();
