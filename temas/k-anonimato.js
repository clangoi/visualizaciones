(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;
  const J = B.JERARQUIAS;
  const CIS = ['cp', 'edad', 'sexo'];

  // Controles comunes: un nivel de generalización por cuasi-identificador.
  function controlesNiveles(ctl, niveles, alCambiar) {
    for (const a of CIS) {
      ctl.rango({ etiqueta: `Nivel de ${a}`, min: 0, max: J[a].niveles - 1, valor: niveles[a], formato: (v) => J[a].nombres[v], alCambiar: (v) => { niveles[a] = v; alCambiar(); } });
    }
  }
  const coloresClases = (cl) => new Map(cl.map((c, i) => [c.clave, VIZ.series[i % 8]]));

  /* ---------- Fig. 1: generalizar hasta k ---------- */

  function montarK(cuerpo) {
    const R = B.clinicos();
    const niveles = { cp: 1, edad: 1, sexo: 0 };
    let suprimir = false, kObjetivo = 2;
    const ctl = VIZ.controles(cuerpo);
    controlesNiveles(ctl, niveles, () => dibujar());
    ctl.rango({ etiqueta: 'k objetivo', min: 2, max: 6, valor: kObjetivo, alCambiar: (v) => { kObjetivo = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'suprimir clases con menos de k filas', valor: suprimir, alCambiar: (v) => { suprimir = v; dibujar(); } });
    const caja = B.grupoTablas(cuerpo);
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada color es una clase de equivalencia: filas idénticas en cp, edad y sexo. La tabla es k-anónima si la clase más chica tiene k filas o más.');
    function dibujar() {
      const T = B.anonimizar(R, niveles);
      const cl = B.clases(T, CIS);
      const chicas = new Set(cl.filter((c) => c.indices.length < kObjetivo).flatMap((c) => c.indices));
      const col = coloresClases(cl);
      caja.replaceChildren(B.tabla(T, {
        fila: (f, i) => (suprimir && chicas.has(i) ? null : col.get(CIS.map((a) => String(f[a])).join(' · '))),
        tachada: (f, i) => suprimir && chicas.has(i),
        celda: (f, a, i) => (!suprimir && chicas.has(i) && CIS.includes(a) ? C.s8 : null),
      }));
      const vivas = cl.filter((c) => !(suprimir && c.indices.length < kObjetivo));
      const k = vivas.length ? Math.min(...vivas.map((c) => c.indices.length)) : 0;
      ley.set([
        ...cl.slice(0, 6).map((c) => ({ color: VIZ.alfa(col.get(c.clave), 0.18), texto: `${c.clave} (${c.indices.length})` })),
        ...(cl.length > 6 ? [{ color: C.neutro, texto: `… ${cl.length - 6} clases más` }] : []),
        { color: VIZ.alfa(C.s8, 0.18), texto: `cuasi-identificadores de una clase con menos de ${kObjetivo}` },
      ]);
      registro.textContent = k >= kObjetivo
        ? `La tabla es ${k}-anónima${suprimir && chicas.size ? ` tras suprimir ${chicas.size} filas` : ''}: cada persona se confunde con al menos ${k - 1} más.`
        : `No es ${kObjetivo}-anónima: ${chicas.size} filas están en clases de menos de ${kObjetivo}. Generalice más o active la supresión.`;
      lectura.set([
        ['k de la tabla', String(k)],
        ['clases', String(vivas.length)],
        ['filas suprimidas', suprimir ? String(chicas.size) : '0'],
        ['precisión (Prec)', VIZ.fmt(1 - CIS.reduce((s, a) => s + niveles[a] / (J[a].niveles - 1), 0) / 3, 3)],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: ataques de homogeneidad y de conocimiento previo ---------- */

  function montarAtaque(cuerpo) {
    const R = B.clinicos();
    const niveles = { cp: 2, edad: 2, sexo: 0 };
    let victima = 'Elena Vera', previo = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Víctima (el atacante sabe su cp, edad y sexo)', valor: victima, opciones: R.filas.map((f) => [f.nombre, f.nombre]), alCambiar: (v) => { victima = v; dibujar(); } });
    controlesNiveles(ctl, niveles, () => dibujar());
    ctl.casilla({ etiqueta: 'el atacante sabe además que no tiene gripe', valor: previo, alCambiar: (v) => { previo = v; dibujar(); } });
    const caja = B.grupoTablas(cuerpo);
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'clase de equivalencia de la víctima' },
      { color: C.s1, texto: 'probabilidad de cada diagnóstico para el atacante' },
      { color: C.s8, texto: 'diagnóstico revelado (probabilidad 1)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con los niveles iniciales la tabla es 2-anónima, y aun así el diagnóstico de Elena queda revelado: los dos de su clase tienen cáncer.');
    let dist = [];
    function dibujar() {
      const T = B.anonimizar(R, niveles);
      const iv = R.filas.findIndex((f) => f.nombre === victima);
      const claveV = CIS.map((a) => String(T.filas[iv][a])).join(' · ');
      const cl = B.clases(T, CIS);
      const suya = cl.find((c) => c.clave === claveV);
      caja.replaceChildren(B.tabla(T, { fila: (f, i) => (suya.indices.includes(i) ? C.s1 : null), maxFilas: 12 }));
      const cuenta = new Map();
      suya.indices.forEach((i) => { const d = T.filas[i].diagnostico; if (!(previo && d === 'Gripe')) cuenta.set(d, (cuenta.get(d) || 0) + 1); });
      const tot = [...cuenta.values()].reduce((s, v) => s + v, 0);
      dist = [...cuenta].map(([d, n]) => [d, n / tot]).sort((a, b) => b[1] - a[1]);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 100, fh = Math.min(26, 130 / Math.max(1, dist.length));
      dist.forEach(([d, p], i) => {
        const y = 10 + i * fh;
        B.texto(ctx, d, izq - 8, y + fh / 2, { alinear: 'right', px: 11, color: C.tinta });
        ctx.fillStyle = p === 1 ? C.s8 : C.s1;
        ctx.beginPath(); ctx.roundRect(izq, y + 3, (W - izq - 60) * p, fh - 6, [0, 4, 4, 0]); ctx.fill();
        B.texto(ctx, `${Math.round(100 * p)} %`, izq + (W - izq - 60) * p + 6, y + fh / 2, { px: 11 });
      });
      if (!dist.length) B.texto(ctx, 'El conocimiento previo descarta toda la clase.', izq, 20, { px: 11 });
      const k = Math.min(...cl.map((c) => c.indices.length));
      const revela = dist.length === 1;
      registro.textContent = `${victima} cae en la clase (${claveV}) de ${suya.indices.length} filas. ` +
        (revela ? `Todas las filas que el atacante considera posibles tienen ${dist[0][0]}: lo sabe con certeza, aunque no sepa cuál fila es.`
          : `El atacante duda entre ${dist.length} diagnósticos; el más probable es ${dist[0] ? dist[0][0] : '—'} (${dist[0] ? Math.round(100 * dist[0][1]) : 0} %).`);
      lectura.set([
        ['k de la tabla', String(k)],
        ['filas en la clase', String(suya.indices.length)],
        ['diagnósticos posibles', String(dist.length)],
        ['certeza del atacante', dist.length ? `${Math.round(100 * dist[0][1])} %` : '—'],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    dibujar();
  }

  VIZ.registrarTema('k-anonimato', {
    intro: String.raw`
      <p>Una tabla es <strong>k-anónima</strong> si cada fila es idéntica a por lo menos otras \(k - 1\) en sus cuasi-identificadores. Así,
      un atacante que conoce la comuna, la edad y el sexo de alguien encuentra al menos \(k\) filas candidatas y no puede saber cuál es la
      suya. Lo propusieron Samarati y Sweeney en 1998, como respuesta directa al ataque de enlace.</p>
      <p>Se logra generalizando y suprimiendo. Pero k-anonimato protege la <em>identidad</em>, no el <em>atributo sensible</em>: si todas
      las filas de un grupo tienen el mismo diagnóstico, no importa cuál de ellas sea la víctima.</p>`,
    parametros: [
      ['Nivel de cp, Nivel de edad, Nivel de sexo (Fig. 1 y 2)', String.raw`Cuánto se generaliza cada cuasi-identificador. Cp pasa de exacto a 751*, 75** y ****; edad, de exacta a tramo de 5, tramo de 10 y *; sexo, de exacto a *. Un nivel más alto es menos preciso y junta más filas en las mismas clases de equivalencia.`],
      ['k objetivo (Fig. 1)', String.raw`El tamaño mínimo (de 2 a 6) que debe tener cada clase de equivalencia; las clases menores se marcan en rojo.`],
      ['suprimir clases con menos de k filas (Fig. 1)', String.raw`Casilla que tacha las filas de las clases que no llegan a k, en lugar de generalizar más; la lectura se calcula entonces solo con las clases restantes.`],
      ['Víctima (Fig. 2)', String.raw`Selector con los nombres de las personas de la tabla: el atacante conoce el cp, la edad y el sexo de la elegida y observa su clase de equivalencia.`],
      ['el atacante sabe además que no tiene gripe (Fig. 2)', String.raw`Casilla de conocimiento previo: quita «Gripe» de los diagnósticos posibles de la clase de la víctima y recalcula las probabilidades.`],
    ],
    visualizaciones: [
      {
        titulo: 'Generalizar hasta lograr k',
        descripcion: 'Suba los niveles de generalización y observe cómo se juntan las clases de equivalencia. Active la supresión para eliminar las clases que quedan chicas.',
        ayuda: String.raw`<p>La tabla anonimizada (sin nombre ni RUT) muestra las filas con un fondo de color por clase de equivalencia: las filas del mismo color tienen idénticos cp, edad y sexo publicados. Las celdas de cuasi-identificadores de las clases con menos de k filas se escriben en rojo (C.s8) y, con la supresión activa, esas filas se tachan. La lectura da la k de la tabla, el número de clases, las filas suprimidas y la precisión.</p>
          <ul>
          <li><strong>Niveles</strong>: al subirlos las clases se juntan y crecen, baja el riesgo de re-identificar y baja también la precisión (Prec).</li>
          <li><strong>k objetivo</strong>: cambia qué clases se marcan en rojo y si el mensaje dice que la tabla cumple k.</li>
          <li><strong>suprimir clases con menos de k filas</strong>: tacha esas filas y la tabla pasa a cumplir k sin generalizar más, a costa de perder datos.</li>
          </ul>`,
        montar: montarK,
      },
      {
        titulo: 'Ataques de homogeneidad y de conocimiento previo',
        descripcion: 'El atacante sabe en qué clase está la víctima. Si la clase es homogénea en el diagnóstico, lo aprende igual; un poco de conocimiento previo puede eliminar las alternativas que quedaban.',
        ayuda: String.raw`<p>A la izquierda del gráfico están los diagnósticos posibles y cada barra horizontal es la probabilidad que el atacante asigna a ese diagnóstico dentro de la clase de equivalencia de la víctima (porcentaje al final de la barra). La barra es azul (C.s1); si un solo diagnóstico tiene probabilidad 1, es roja (C.s8) y significa diagnóstico revelado. En la tabla, las filas de esa clase se destacan en azul.</p>
          <ul>
          <li><strong>Víctima</strong>: cambia la clase destacada y su distribución de diagnósticos.</li>
          <li><strong>Niveles</strong>: una clase más grande no garantiza protección si todas sus filas tienen el mismo diagnóstico (homogeneidad): la barra sigue en 100 %.</li>
          <li><strong>el atacante sabe además que no tiene gripe</strong>: descarta ese diagnóstico, las probabilidades de los restantes suben y puede quedar uno solo; si se descarta toda la clase, el gráfico lo avisa.</li>
          </ul>`,
        montar: montarAtaque,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(T\) una tabla y \(Q\) su conjunto de cuasi-identificadores. Una <strong>clase de equivalencia</strong> es un conjunto maximal de
      filas con los mismos valores en \(Q\). \(T\) es k-anónima respecto de \(Q\) si</p>
      \[ \forall\, t \in T:\; \big|\{ t' \in T : t'[Q] = t[Q] \}\big| \ge k. \]
      <p>Equivalentemente, \(\min_E |E| \ge k\) sobre las clases \(E\). En SQL: <code>SELECT MIN(n) FROM (SELECT COUNT(*) n FROM T GROUP BY
      cp, edad, sexo)</code>.</p>
      <div class="recuadro">Garantía: ante un atacante que solo conoce los cuasi-identificadores de la víctima, la probabilidad de acertar
      su fila es a lo más \(1/k\). Nada dice sobre los atributos sensibles.</div>

      <h2>Limitaciones</h2>
      <ul>
        <li><strong>Homogeneidad</strong>: en una clase con un solo valor sensible, este se revela con certeza (figura 2).</li>
        <li><strong>Conocimiento previo</strong>: si el atacante puede descartar valores (los hombres no tienen cáncer de útero, la víctima no
        tiene gripe), el grupo efectivo se reduce.</li>
        <li><strong>Publicaciones múltiples</strong>: dos versiones k-anónimas de la misma tabla, generalizadas distinto, se pueden
        intersectar.</li>
        <li><strong>Alta dimensión</strong>: con muchos cuasi-identificadores hay que generalizar casi todo (maldición de la dimensión,
        Aggarwal 2005).</li>
        <li><strong>Elegir \(Q\)</strong> exige adivinar qué sabe el atacante; si se omite un cuasi-identificador, la garantía no vale.</li>
      </ul>
      <p>La homogeneidad motiva la <a href="tema.html?id=l-diversidad">l-diversidad</a>; la dependencia del conocimiento del atacante, la
      <a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a>. La búsqueda de la generalización mínima está en
      <a href="tema.html?id=anonimizacion">anonimización</a>.</p>`,
  });
})();
