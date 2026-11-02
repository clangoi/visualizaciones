(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const { act, sec, xor, y, bucle } = P;

  const dur = (a, d, r, e) => act(a, { dur: d, rol: r, espera: e });
  const veces = (c, a) => c.eventos.filter((e) => e.act === a).length;
  const idx = (c, a) => c.eventos.findIndex((e) => e.act === a);
  const tiene = (c, a) => idx(c, a) >= 0;
  const pc = (k, n) => `${VIZ.fmt((100 * k) / Math.max(1, n), 3)} % (${k} de ${n})`;

  /* ---------- Los tres dominios ---------- */

  const DOMINIOS = {
    industria: {
      nombre: 'compra a pago',
      arbol: sec(dur('Crear requisición', 10, 'ventas'), dur('Aprobar requisición', 15, 'gerencia', 360), dur('Crear orden de compra', 12, 'ventas'),
        y(dur('Recibir mercancía', 30, 'bodega'), dur('Recibir factura', 10, 'finanzas')), dur('Pagar factura', 8, 'finanzas')),
      espera: 90, n: 150, ruido: 0.12, modo: 'frecuencia',
      preguntas: (log, ctx) => [
        ['¿Cuánto tarda una compra de principio a fin?', `mediana ${P.dur(ctx.mediana)}, percentil 90 ${P.dur(ctx.p90)}`],
        ['¿Dónde se acumula la espera?', `antes de «${ctx.espMax[0]}»: ${P.dur(ctx.espMax[1])} de espera media`],
        ['¿Cuántas compras se saltan la aprobación?', pc(log.filter((c) => !tiene(c, 'Aprobar requisición')).length, log.length)],
        ['¿Se paga antes de recibir la mercancía?', pc(log.filter((c) => tiene(c, 'Pagar factura') && tiene(c, 'Recibir mercancía') && idx(c, 'Pagar factura') < idx(c, 'Recibir mercancía')).length, log.length)],
      ],
    },
    educacion: {
      nombre: 'trayectorias de estudiantes',
      arbol: sec(dur('Matricularse', 5, 'ventas'), bucle(dur('Ver lección', 40, 'soporte'), dur('Hacer tarea', 60, 'soporte'), 0.65),
        xor([sec(dur('Rendir examen', 90, 'soporte', 4320), xor([dur('Aprobar curso', 1, 'gerencia'), dur('Reprobar curso', 1, 'gerencia')], [0.7, 0.3])), dur('Abandonar', 1, 'soporte')], [0.8, 0.2])),
      espera: 720, n: 180, ruido: 0.08, modo: 'frecuencia',
      preguntas: (log, ctx) => {
        const rindieron = log.filter((c) => tiene(c, 'Rendir examen')), aban = log.filter((c) => tiene(c, 'Abandonar'));
        const mucha = rindieron.filter((c) => veces(c, 'Hacer tarea') >= 2), poca = rindieron.filter((c) => veces(c, 'Hacer tarea') < 2);
        const ap = (g) => g.filter((c) => tiene(c, 'Aprobar curso')).length;
        const p1 = ap(mucha) / Math.max(1, mucha.length), p2 = ap(poca) / Math.max(1, poca.length), p = (ap(mucha) + ap(poca)) / Math.max(1, mucha.length + poca.length);
        const z = (p1 - p2) / Math.sqrt(Math.max(1e-9, p * (1 - p) * (1 / Math.max(1, mucha.length) + 1 / Math.max(1, poca.length))));
        return [
          ['¿Qué fracción abandona?', pc(aban.length, log.length)],
          ['¿Cuántas tareas hacen quienes rinden el examen y quienes abandonan?', `${VIZ.fmt(P.media(rindieron.map((c) => veces(c, 'Hacer tarea'))), 3)} frente a ${VIZ.fmt(P.media(aban.map((c) => veces(c, 'Hacer tarea'))), 3)} por estudiante`],
          ['¿Aprueban más quienes hacen 2 o más tareas?', `${VIZ.fmt(p1 * 100, 3)} % (n = ${mucha.length}) frente a ${VIZ.fmt(p2 * 100, 3)} % (n = ${poca.length}); z = ${VIZ.fmt(z, 3)}: ${Math.abs(z) < 1.96 ? 'no se distingue del azar' : 'la diferencia es significativa'}`],
          ['¿Cuánto dura un curso completo?', `mediana ${P.dur(ctx.mediana)}, percentil 90 ${P.dur(ctx.p90)}`],
        ];
      },
    },
    salud: {
      nombre: 'ruta clínica en urgencias',
      arbol: sec(dur('Admisión', 6, 'ventas'), dur('Triaje', 8, 'soporte'), y(dur('Análisis de sangre', 25, 'bodega'), dur('Electrocardiograma', 15, 'soporte')),
        dur('Consulta médica', 20, 'gerencia', 75), xor([dur('Alta', 5, 'soporte'), sec(dur('Ingreso a sala', 30, 'soporte'), dur('Alta de sala', 5, 'soporte'))], [0.7, 0.3])),
      espera: 25, n: 150, ruido: 0.1, modo: 'espera',
      preguntas: (log, ctx) => [
        ['¿Qué fracción de pacientes supera 4 h entre admisión y alta?', pc(log.filter((c) => P.tiempoCiclo(c) > 240).length, log.length)],
        ['¿Dónde esperan más los pacientes?', `antes de «${ctx.espMax[0]}»: ${P.dur(ctx.espMax[1])} de espera media`],
        ['¿Cuántos pacientes pasan a sala?', pc(log.filter((c) => tiene(c, 'Ingreso a sala')).length, log.length)],
        ['¿Cuántos casos no cumplen el protocolo (sin electrocardiograma antes de la consulta)?', pc(log.filter((c) => !tiene(c, 'Electrocardiograma') || idx(c, 'Electrocardiograma') > idx(c, 'Consulta médica')).length, log.length)],
      ],
    },
  };
  Object.values(DOMINIOS).forEach((d) => { d.ref = P.dfg(P.simular(d.arbol, 400, 777, { espera: d.espera })); });

  const clave = (a, b) => a + '\u0001' + b;
  function analizar(D, log) {
    const dfg = P.dfg(log), esperas = new Map();
    for (const c of log) c.eventos.forEach((e, i) => { if (i) { if (!esperas.has(e.act)) esperas.set(e.act, []); esperas.get(e.act).push(e.ini - c.eventos[i - 1].fin); } });
    const mediaEsp = new Map([...esperas].map(([a, v]) => [a, P.media(v)]));
    const fuera = (c) => { const t = P.trazaDe(c); return !D.ref.ini.has(t[0]) || !D.ref.fin.has(t[t.length - 1]) || t.some((a, i) => i && !D.ref.par.has(clave(t[i - 1], a))); };
    const t = log.map(P.tiempoCiclo);
    return { dfg, mediaEsp, fuera, mediana: P.mediana(t), p90: P.cuantil(t, 0.9), espMax: [...mediaEsp].sort((a, b) => b[1] - a[1])[0] || ['—', NaN], desviados: log.filter(fuera).length };
  }

  /* ---------- Figura genérica de un dominio ---------- */

  function montarDominio(clavDom) {
    return function (cuerpo) {
      const D = DOMINIOS[clavDom];
      let semilla = 1, ruido = D.ruido, modo = D.modo, log = [], A = null, geo = null, altura = 320;
      const ctl = VIZ.controles(cuerpo);
      ctl.selector({ etiqueta: 'Colorear por', opciones: [['frecuencia', 'frecuencia'], ['espera', 'espera media antes de la actividad'], ['desvio', 'desvíos del protocolo']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
      ctl.rango({ etiqueta: 'Desvíos en los datos', min: 0, max: 0.4, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; generar(); } });
      ctl.boton('Nuevos casos', () => { semilla++; generar(); }, { primario: true });
      const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => altura });
      const tip = VIZ.tooltip(lienzo);
      VIZ.leyenda(cuerpo, [
        { color: VIZ.css(VIZ.enRampa(0.1)), texto: 'poca frecuencia o espera' }, { color: VIZ.css(VIZ.enRampa(0.9)), texto: 'mucha frecuencia o espera' },
        { color: C.s8, texto: 'transición que el protocolo no admite', forma: 'linea' }, { color: C.eje, texto: 'grosor: número de casos', forma: 'linea' },
      ]);
      const cajaP = VIZ.el('div', { class: 'caja-desplazable' });
      cuerpo.appendChild(cajaP);
      const registro = VIZ.registro(cuerpo);
      const lectura = VIZ.lectura(cuerpo);
      VIZ.nota(cuerpo, `Registro simulado de ${D.nombre} (${D.n} casos). Cambie el criterio de color, suba los desvíos y observe qué aristas aparecen en rojo; pase el cursor sobre una actividad para ver sus cifras. La tabla responde preguntas típicas del dominio con cálculos sobre este mismo registro.`);

      function generar() {
        log = P.simular(D.arbol, D.n, semilla * 17 + 3, { espera: D.espera, ruido });
        A = analizar(D, log);
        dibujar();
      }
      function dibujar() {
        if (!A) return;
        lienzo.limpiar();
        const { dfg } = A, N = log.length, angosto = lienzo.ancho < 620;
        const ids = ['inicio', ...dfg.acts, 'fin'];
        const aristasBase = [...[...dfg.ini.keys()].map((a) => ['inicio', a, dfg.ini.get(a)]), ...dfg.aristas.map((e) => [e.de, e.a, e.n]), ...[...dfg.fin.keys()].map((a) => [a, 'fin', dfg.fin.get(a)])];
        let pos = P.disponer(ids, aristasBase.map(([a, b]) => [a, b]));
        const capas = new Set(Object.values(pos).map((p) => Math.round(p.x * 1000))).size;
        if (angosto) { const t = {}; for (const k in pos) t[k] = { x: pos[k].y, y: pos[k].x }; pos = t; }
        const nueva = angosto ? Math.max(260, capas * 58 + 30) : 320;
        if (nueva !== altura) { altura = nueva; return lienzo.ajustar(true); }
        const maxN = Math.max(...aristasBase.map((e) => e[2]));
        const esp = [...A.mediaEsp.values()], maxEsp = Math.max(...esp, 1);
        const nodos = ids.map((id) => {
          if (id === 'inicio' || id === 'fin') return { id, tipo: id };
          const f = dfg.frec.get(id) / N;
          const n = { id, tipo: 'act', etiqueta: id };
          if (modo === 'frecuencia') { n.relleno = VIZ.css(VIZ.enRampa(Math.min(1, f))); if (f > 0.6) n.colorTexto = C.sobre; n.insignia = String(dfg.frec.get(id)); n.colorInsignia = C.tinta2; }
          else if (modo === 'espera' && A.mediaEsp.has(id)) { n.relleno = VIZ.css(VIZ.enRampa(A.mediaEsp.get(id) / maxEsp)); if (A.mediaEsp.get(id) / maxEsp > 0.6) n.colorTexto = C.sobre; n.insignia = P.dur(A.mediaEsp.get(id)); n.colorInsignia = C.tinta2; }
          return n;
        });
        const aristas = aristasBase.map(([a, b, n]) => {
          const raro = !(a === 'inicio' ? D.ref.ini.has(b) : b === 'fin' ? D.ref.fin.has(a) : D.ref.par.has(clave(a, b)));
          const e = { de: a, a: b, ancho: 1.5 + 4 * (n / maxN), color: modo === 'desvio' && raro ? C.s8 : raro && modo !== 'desvio' ? C.apagado : C.eje, guiones: raro };
          if (modo === 'frecuencia' || (modo === 'desvio' && raro)) { e.etiqueta = n; if (raro && modo === 'desvio') e.colorTexto = C.s8; }
          return e;
        });
        geo = P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: angosto ? 10 : 11, margenX: angosto ? 40 : 54, margenY: 30 });
        registro.textContent = `${A.desviados} de ${N} casos (${VIZ.fmt((100 * A.desviados) / N, 3)} %) contienen alguna transición que el protocolo no admite; las aristas discontinuas son esas transiciones.`;
        lectura.set([
          ['casos / eventos', `${N} / ${log.reduce((s, c) => s + c.eventos.length, 0)}`],
          ['variantes', String(P.variantes(log).length)],
          ['ciclo mediano', P.dur(A.mediana)],
          ['espera máxima media', `${P.dur(A.espMax[1])} (${A.espMax[0]})`],
          ['casos con desvíos', `${A.desviados}`],
        ]);
        cajaP.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
          VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', null, 'Pregunta típica'), VIZ.el('th', null, 'Hallazgo en este registro'))),
          VIZ.el('tbody', null, ...D.preguntas(log, A).map(([q, r]) => VIZ.el('tr', null, VIZ.el('td', null, q), VIZ.el('td', null, r))))));
      }
      lienzo.alDibujar = dibujar;
      lienzo.canvas.addEventListener('pointermove', (ev) => {
        if (!geo) return;
        const { x, y: yy } = lienzo.posicion(ev), n = P.nodoEn(geo, x, yy);
        if (!n || n.tipo !== 'act') return tip.ocultar();
        const f = A.dfg.frec.get(n.id);
        tip.mostrar(x, yy, `<b>${n.id}</b><br>${f} ejecuciones en ${log.filter((c) => tiene(c, n.id)).length} casos<br>espera media antes: <b>${A.mediaEsp.has(n.id) ? P.dur(A.mediaEsp.get(n.id)) : '—'}</b>`);
      });
      lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
      generar();
    };
  }

  VIZ.registrarTema('process-mining-applications', {
    intro: String.raw`
      <p>La minería de procesos nació en empresas con sistemas de planificación (ERP), pero hoy se aplica a cualquier actividad que deje registros con tiempo: compras y pagos,
      trayectorias de estudiantes en una plataforma, rutas de pacientes en un hospital. Lo que cambia entre dominios no es la técnica sino <strong>las preguntas</strong> y qué significa un desvío.</p>
      <p>Cada figura trabaja un registro simulado de un dominio, con un protocolo de referencia conocido, para que pueda ver cómo se detectan desvíos, esperas y cifras como el abandono o el
      cumplimiento de un tiempo máximo.</p>`,
    visualizaciones: [
      {
        titulo: 'Industria: compra a pago',
        descripcion: 'Mapa del proceso con frecuencias, esperas y desvíos. Suba los desvíos y vea cómo aparecen compras sin aprobación o pagos antes de recibir.',
        montar: montarDominio('industria'),
      },
      {
        titulo: 'Educación: trayectorias de estudiantes',
        descripcion: 'Rutas por un curso con ciclo de lecciones y tareas. Compare quienes abandonan con quienes rinden el examen y pruebe si hacer tareas se relaciona con aprobar.',
        montar: montarDominio('educacion'),
      },
      {
        titulo: 'Salud: ruta clínica en urgencias',
        descripcion: 'Camino de un paciente desde la admisión hasta el alta. Cambie a «espera media» para ubicar el cuello de botella y a «desvíos» para ver quién se salta el electrocardiograma.',
        montar: montarDominio('salud'),
      },
    ],
    teoria: String.raw`
      <h2>Qué cambia entre dominios</h2>
      <table>
        <tr><th></th><th>Industria</th><th>Educación</th><th>Salud</th></tr>
        <tr><td>Caso</td><td>un pedido de compra</td><td>un estudiante en un curso</td><td>un episodio del paciente</td></tr>
        <tr><td>Fuente</td><td>ERP, CRM, sistema de tickets</td><td>plataforma de aprendizaje, sistema académico</td><td>historia clínica electrónica</td></tr>
        <tr><td>Pregunta típica</td><td>cumplimiento y cuellos de botella</td><td>abandono y rutas de éxito</td><td>tiempos máximos y adherencia a guías</td></tr>
        <tr><td>Desvío</td><td>pago sin aprobación</td><td>examen sin tareas previas</td><td>omisión de un examen del protocolo</td></tr>
        <tr><td>Cautela</td><td>sistemas fragmentados</td><td>privacidad de menores</td><td>datos sensibles, variabilidad clínica legítima</td></tr>
      </table>
      <h2>Cómo se detecta un desvío</h2>
      <p>Con un modelo de referencia, una transición \(a \to b\) observada es un desvío si no está permitida. Aquí el modelo es el
      <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a> de una ejecución sin ruido; la fracción de casos con desvíos es</p>
      \[ \frac{|\{c : \exists\, i,\ (c_i, c_{i+1}) \notin R\}|}{|L|}. \]
      <p>Una medida más fina, con alineaciones, se estudia en <a href="tema.html?id=deviation-analysis">análisis de desviaciones</a>.</p>
      <h2>Comparar proporciones con cuidado</h2>
      <p>La pregunta «¿aprueban más quienes hacen tareas?» compara dos proporciones \(\hat p_1\) y \(\hat p_2\). Con \(\hat p\) la proporción combinada, el estadístico</p>
      \[ z = \frac{\hat p_1 - \hat p_2}{\sqrt{\hat p(1-\hat p)\left(\tfrac{1}{n_1} + \tfrac{1}{n_2}\right)}} \]
      <p>indica si la diferencia supera lo que el azar produce (\(|z| &gt; 1{,}96\) para 95 %). En el registro simulado la aprobación es independiente de las tareas, así que
      cualquier diferencia que vea es ruido muestral: una buena advertencia sobre confundir correlación con causalidad en datos reales.</p>
      <div class="recuadro"><p><strong>Ética y datos.</strong> En educación y salud los registros identifican personas: la minería de procesos exige anonimizar, limitar el
      acceso y evitar usar los hallazgos para evaluar a individuos en vez de mejorar el proceso.</p></div>
      <h2>Conexiones</h2>
      <p>El tiempo de ciclo y los cuellos de botella se detallan en <a href="tema.html?id=cycle-time-throughput">tiempo de ciclo y rendimiento</a> y
      <a href="tema.html?id=bottleneck-analysis">cuellos de botella</a>; las preguntas se formulan con el enfoque de <a href="tema.html?id=project-approaches">proyecto</a> adecuado y las mejoras se evalúan en
      <a href="tema.html?id=improvement-impact">impacto de mejoras</a>.</p>`,
  });
})();
