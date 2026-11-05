(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const NIV = [
    { n: 'Dominio', color: C.s1, amenaza: 'Resolver el problema equivocado.', inm: ['Entrevistar y observar a las personas usuarias', 'Contrastar con la literatura del dominio'], aba: ['Medir la adopción de la herramienta', 'Estudio de campo con casos reales'] },
    { n: 'Abstracción', color: C.s3, amenaza: 'Abstraer datos o tareas que no sirven.', inm: ['(no hay método inmediato confiable)'], aba: ['Estudio de campo: ¿se usa para las tareas previstas?', 'Observar si los resultados ayudan al dominio'] },
    { n: 'Idioma visual', color: C.s7, amenaza: 'Codificación o interacción poco efectivas.', inm: ['Justificar con principios perceptuales', 'Inspección heurística'], aba: ['Experimento controlado de laboratorio', 'Análisis cualitativo de la imagen resultante'] },
    { n: 'Algoritmo', color: C.s2, amenaza: 'Algoritmo demasiado lento o que usa mucha memoria.', inm: ['Análisis de complejidad', 'Medir tiempo y memoria'], aba: ['Comparar la imagen con un algoritmo de referencia'] },
  ];
  const CASOS = [
    ['Se construyó un panel para analistas que solo necesitaban comparar dos cifras al día.', 0],
    ['Los datos se agregaron por semana, pero la pregunta exige detectar picos diarios.', 1],
    ['Un gráfico de torta con 20 porciones dificulta comparar las categorías.', 2],
    ['El diseño es excelente, pero el cálculo del diseño de nodos tarda tres minutos con 100 000 nodos.', 3],
    ['Se usó tono de color para una variable ordenada continua y no se ve el orden.', 2],
    ['La herramienta funciona bien, pero nadie la adoptó porque no resolvía el problema real.', 0],
    ['La tarea «detectar anomalías» se redujo a «ordenar» y se perdió el contexto que se necesitaba.', 1],
    ['La interacción con zoom exige 15 clics para llegar a un detalle frecuente.', 2],
  ];

  /* ---------- Fig. 1: cascada de errores ---------- */

  function montarCascada(cuerpo) {
    let roto = -1, modo = 'inm';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Error introducido en el nivel', valor: '-1', opciones: [['-1', '(ninguno)'], ...NIV.map((n, i) => [String(i), `${i + 1}. ${n.n}`])], alCambiar: (v) => { roto = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Validación', valor: modo, opciones: [['inm', 'inmediata (al terminar el nivel)'], ['aba', 'posterior (con el producto terminado)']], alCambiar: (v) => { modo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 420 : 280) });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'nivel válido' }, { color: C.s8, texto: 'error introducido' }, { color: C.s4, texto: 'invalidado por un nivel superior' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Introduzca un error en un nivel: los niveles inferiores quedan invalidados aunque estén bien hechos. A la derecha, los métodos que detectan la amenaza de cada nivel.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ancho = W < 560, bw = ancho ? W - 24 : 190, bh = 50, gap = 14;
      NIV.forEach((n, i) => {
        const x = 12, y = 8 + i * (bh + gap);
        const estado = roto === -1 || i < roto ? 'ok' : i === roto ? 'mal' : 'inv';
        const col = estado === 'ok' ? C.s6 : estado === 'mal' ? C.s8 : C.s4;
        ctx.fillStyle = VIZ.alfa(col, 0.15); ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 6); ctx.fill(); ctx.stroke();
        V.rotulo(ctx, `${i + 1}. ${n.n}`, x + 10, y + 18, { peso: 700, tam: 12, color: C.tinta });
        V.rotulo(ctx, estado === 'ok' ? 'válido' : estado === 'mal' ? 'error aquí' : 'invalidado desde arriba', x + 10, y + 36, { tam: 10, color: C.tinta2 });
        if (!ancho) {
          const x2 = x + bw + 20, w2 = W - x2 - 12;
          V.rotulo(ctx, 'Amenaza: ' + V.corto(n.amenaza, Math.floor(w2 / 6.4)), x2, y + 12, { tam: 11, color: C.tinta, peso: 600 });
          (modo === 'inm' ? n.inm : n.aba).slice(0, 2).forEach((m, k) => V.rotulo(ctx, '· ' + V.corto(m, Math.floor(w2 / 6.4)), x2, y + 29 + k * 15, { tam: 10.5, color: C.tinta2 }));
        }
        if (i < 3) { ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + bw / 2, y + bh); ctx.lineTo(x + bw / 2, y + bh + gap); ctx.stroke(); }
      });
      registro.textContent = roto === -1 ? 'Sin errores: cada nivel se apoya en uno válido.' : `El error en «${NIV[roto].n}» invalida ${3 - roto} nivel(es) inferior(es): no se arregla puliendo el diseño o el código, sino volviendo al nivel ${roto + 1}.`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: ¿en qué nivel está la amenaza? ---------- */

  function montarQuiz(cuerpo) {
    let k = 0, ok = 0, resp = 0, hecho = false;
    const ctl = VIZ.controles(cuerpo);
    NIV.forEach((n, i) => ctl.boton(`${i + 1}. ${n.n}`, () => responder(i)));
    ctl.boton('Siguiente escenario', () => { k = (k + 1) % CASOS.length; hecho = false; dibujar(); }, { primario: true });
    ctl.boton('Reiniciar puntaje', () => { ok = 0; resp = 0; k = 0; hecho = false; dibujar(); });
    const enun = VIZ.el('div', { class: 'registro grande' });
    cuerpo.appendChild(enun);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura textual sin color con significado';
    VIZ.nota(cuerpo, 'Lea el escenario y elija el nivel del modelo donde está la amenaza principal. Es útil argumentar por qué no es el de arriba ni el de abajo.');
    function responder(i) {
      if (hecho) return;
      hecho = true; resp++;
      const c = CASOS[k][1];
      if (i === c) ok++;
      registro.textContent = i === c ? `Correcto: es una amenaza del nivel ${c + 1} (${NIV[c].n}): ${NIV[c].amenaza}` : `No: la amenaza es del nivel ${c + 1} (${NIV[c].n}): ${NIV[c].amenaza}`;
      dibujar();
    }
    function dibujar() {
      enun.textContent = `Escenario ${k + 1} de ${CASOS.length}\n${CASOS[k][0]}`;
      if (!hecho) registro.textContent = 'Elija un nivel.';
      lectura.set([['aciertos', `${ok} de ${resp}`], ['escenario', `${k + 1} / ${CASOS.length}`]]);
    }
    dibujar();
  }

  VIZ.registrarTema('validation-threats', {
    intro: String.raw`
      <p>Cada nivel del <a href="tema.html?id=munzner-nested-model">modelo anidado</a> puede fallar de una manera distinta, y cada falla se descubre con un tipo distinto de evidencia. Una <strong>amenaza de validez</strong> es una razón concreta para dudar de que el diseño de un nivel sea correcto.</p>
      <p>Validar es, entonces, elegir el método que corresponde al nivel: preguntarle a un usuario no sirve para medir la complejidad de un algoritmo, y medir tiempos no dice si el problema era el correcto.</p>`,
    visualizaciones: [
      { titulo: 'Amenazas, métodos y propagación de errores', descripcion: 'Introduzca un error en un nivel y vea cuáles quedan invalidados; alterne entre validación inmediata y posterior.', montar: montarCascada },
      { titulo: '¿En qué nivel está la amenaza?', descripcion: 'Clasifique ocho escenarios y compruebe su criterio con la explicación de cada uno.', montar: montarQuiz },
    ],
    teoria: String.raw`
      <h2>Amenaza y validación por nivel</h2>
      <table>
        <tr><th>Nivel</th><th>Amenaza</th><th>Validación inmediata</th><th>Validación posterior</th></tr>
        <tr><td>Dominio</td><td>problema equivocado</td><td>entrevistas, observación</td><td>adopción, estudio de campo</td></tr>
        <tr><td>Abstracción</td><td>datos o tareas equivocados</td><td>—</td><td>estudio de campo del uso</td></tr>
        <tr><td>Idioma visual</td><td>codificación o interacción inefectiva</td><td>justificación con principios, heurísticas</td><td>experimento de laboratorio, análisis de la imagen</td></tr>
        <tr><td>Algoritmo</td><td>demasiado lento o con mucha memoria</td><td>análisis de complejidad</td><td>comparar la imagen con una referencia</td></tr>
      </table>
      <h2>Inmediata o posterior</h2>
      <p>La validación <em>inmediata</em> se hace con lo producido en ese nivel, antes de construir los siguientes: es barata y detecta errores a tiempo. La <em>posterior</em> usa el sistema terminado: es costosa, pero comprueba la cadena completa.</p>
      <h2>Propagación</h2>
      <p>Si \(p_k\) es la probabilidad de que el nivel \(k\) sea correcto, y los niveles se evalúan en serie, la probabilidad de que el producto final sirva es, a lo más,
      \[ P \le \prod_{k=1}^{4} p_k \le \min_k p_k. \]
      Por eso invertir en pulir el algoritmo cuando el problema del dominio es dudoso rinde poco.</p>
      <div class="recuadro"><strong>Ejemplo.</strong> Un excelente mapa de calor (nivel 3) con un algoritmo muy rápido (nivel 4) no sirve si la abstracción (nivel 2) descartó el atributo temporal que la persona necesitaba.</div>
      <p>La evaluación empírica de la efectividad se retoma en <a href="tema.html?id=usability-evaluation">evaluación de usabilidad</a>.</p>`,
  });
})();
