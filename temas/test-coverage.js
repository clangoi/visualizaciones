(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: cobertura de líneas y de ramas ---------- */

  const LINEAS = [
    'function clasificar(nota, asistencia, justificado) {',
    '  if (nota < 0 || nota > 7) {',
    '    return "inválida";',
    '  }',
    '  if (asistencia < 75) {',
    '    if (justificado) {',
    '      return "pendiente";',
    '    }',
    '    return "reprobado por asistencia";',
    '  }',
    '  if (nota >= 4) {',
    '    return "aprobado";',
    '  }',
    '  return "reprobado";',
    '}',
  ];
  // Líneas ejecutables y ramas (id → líneas de la condición).
  const EJECUTABLES = [1, 2, 4, 5, 6, 8, 10, 11, 13];
  const RAMAS = [{ id: 'a', linea: 1, t: 'nota fuera de rango' }, { id: 'b', linea: 4, t: 'asistencia < 75' }, { id: 'c', linea: 5, t: 'justificado' }, { id: 'd', linea: 10, t: 'nota ≥ 4' }];
  const TESTS = [
    { n: 'nota 9 → inválida', a: [9, 90, false] }, { n: 'nota 5, asistencia 90 → aprobado', a: [5, 90, false] }, { n: 'nota 6, asistencia 50, justificado → pendiente', a: [6, 50, true] },
    { n: 'nota 6, asistencia 50 → reprobado por asistencia', a: [6, 50, false] }, { n: 'nota 2, asistencia 90 → reprobado', a: [2, 90, false] },
  ];

  // Ejecuta clasificar registrando líneas y resultados de cada condición.
  function ejecutar(nota, asist, just, lineas, ramas) {
    const L = (i) => lineas.add(i), B = (id, v) => { (ramas[id] = ramas[id] || new Set()).add(v); return v; };
    L(0); L(1);
    if (B('a', nota < 0 || nota > 7)) { L(2); return 'inválida'; }
    L(4);
    if (B('b', asist < 75)) { L(5); if (B('c', just)) { L(6); return 'pendiente'; } L(8); return 'reprobado por asistencia'; }
    L(10);
    if (B('d', nota >= 4)) { L(11); return 'aprobado'; }
    L(13); return 'reprobado';
  }

  function montarCobertura(cuerpo) {
    const activos = TESTS.map(() => false); activos[1] = true;
    let sinAserciones = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(TESTS.map((t, i) => ({ clave: String(i), texto: t.n, activo: activos[i] })), (e) => { TESTS.forEach((_, i) => { activos[i] = e[String(i)]; }); dibujar(); });
    ctl.casilla({ etiqueta: 'las pruebas ejecutan el código pero no tienen expect()', valor: false, alCambiar: (v) => { sinAserciones = v; dibujar(); } });
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Verde: línea ejecutada por alguna prueba; rojo: nunca ejecutada. Las ramas cuentan cada resultado posible de un <code>if</code> (verdadero y falso).');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const lineas = new Set(), ramas = {};
      TESTS.forEach((t, i) => { if (activos[i]) ejecutar(...t.a, lineas, ramas); });
      lista.replaceChildren(...LINEAS.map((txt, i) => {
        const ejec = EJECUTABLES.includes(i), cub = lineas.has(i);
        return el('div', { style: ejec ? { background: VIZ.alfa(cub ? C.s6 : C.s8, 0.18) } : null }, `${String(i + 1).padStart(2)} ${txt}`);
      }));
      const cubL = EJECUTABLES.filter((i) => lineas.has(i)).length, cubR = RAMAS.reduce((s, r) => s + ((ramas[r.id] || new Set()).size), 0);
      const pL = cubL / EJECUTABLES.length, pR = cubR / (RAMAS.length * 2);
      const faltan = RAMAS.flatMap((r) => [true, false].filter((v) => !(ramas[r.id] || new Set()).has(v)).map((v) => `«${r.t}» = ${v ? 'verdadero' : 'falso'}`));
      registro.textContent = sinAserciones ? `Cobertura ${Math.round(pL * 100)} %, pero sin aserciones ninguna prueba puede fallar: el código no está verificado, solo ejecutado.` : faltan.length ? `Ramas sin cubrir: ${faltan.slice(0, 3).join('; ')}${faltan.length > 3 ? '…' : ''}.` : 'Todas las líneas y ramas están cubiertas por alguna prueba.';
      lectura.set([['cobertura de líneas', `${Math.round(pL * 100)} %`], ['cobertura de ramas', `${Math.round(pR * 100)} %`], ['pruebas activas', String(activos.filter(Boolean).length)], ['defectos que detectarían', sinAserciones ? 'ninguno' : activos.some(Boolean) ? 'según sus aserciones' : '—']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: rendimientos decrecientes ---------- */

  function montarRetorno(cuerpo) {
    const est = { objetivo: 80, calidad: 'fuerte' };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Cobertura buscada', min: 0, max: 100, valor: est.objetivo, formato: (v) => `${v} %`, alCambiar: (v) => { est.objetivo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Calidad de las aserciones', valor: est.calidad, opciones: [['fuerte', 'fuertes (verifican resultados)'], ['debil', 'débiles (solo que no explote)']], alCambiar: (v) => { est.calidad = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s1, t: 'defectos detectados (%)', f: (x) => 100 * (1 - Math.exp(-(est.calidad === 'fuerte' ? 0.045 : 0.018) * x)) / (1 - Math.exp(-(est.calidad === 'fuerte' ? 4.5 : 1.8))) }, { c: C.s8, t: 'costo de escribir y mantener las pruebas (%)', f: (x) => 100 * Math.pow(x / 100, 2.2) }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Es un <em>modelo</em> ilustrativo: lo fácil de cubrir se prueba primero; el último tramo cuesta mucho y aporta poco. Con aserciones débiles la curva sube mucho más lento.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 105 }, { etiquetaX: 'cobertura de líneas (%)', etiquetaY: '% del máximo' });
      plano.ejes();
      SER.forEach((s) => VIZ.trazar(ctx, plano, Array.from({ length: 101 }, (_, x) => [x, s.f(x)]), s.c, 2));
      const x = plano.sx(est.objetivo); ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, plano.y0); ctx.lineTo(x, plano.y1); ctx.stroke(); ctx.setLineDash([]);
      SER.forEach((s) => VIZ.marcador(ctx, x, plano.sy(s.f(est.objetivo)), s.c, 4));
      const marg = (SER[0].f(Math.min(100, est.objetivo + 5)) - SER[0].f(est.objetivo)) / Math.max(0.1, SER[1].f(Math.min(100, est.objetivo + 5)) - SER[1].f(est.objetivo));
      lectura.set([['cobertura', `${est.objetivo} %`], ['defectos detectados', `${VIZ.fmt(SER[0].f(est.objetivo), 3)} %`], ['costo', `${VIZ.fmt(SER[1].f(est.objetivo), 3)} %`], ['beneficio del próximo 5 %', `${VIZ.fmt(marg, 2)} por cada unidad de costo`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const c = Math.round(plano.ix(x)); tip.mostrar(x, y, `cobertura = <b>${c} %</b>` + SER.map((s) => VIZ.filaTooltip(s.c, s.t.split(' (')[0], `${VIZ.fmt(s.f(c), 3)} %`)).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('test-coverage', {
    intro: String.raw`
      <p>La <strong>cobertura</strong> (<em>coverage</em>) mide qué parte del código ejecutan las pruebas: líneas, ramas de cada <code>if</code>, funciones. Una herramienta instrumenta el programa y marca en rojo lo que ninguna prueba toca.</p>
      <p>Sirve para <em>encontrar lo que no se está probando</em>. Pero no mide si las pruebas son buenas: se puede ejecutar todo el código sin comprobar nada.</p>`,
    visualizaciones: [
      { titulo: 'Qué líneas y ramas cubren las pruebas', descripcion: 'Active pruebas una a una y observe qué líneas se pintan de verde y qué ramas quedan sin cubrir. Luego quite las aserciones y vea que la cifra no cambia.', montar: montarCobertura },
      { titulo: 'Rendimientos decrecientes', descripcion: 'Suba el objetivo de cobertura y compare el beneficio (defectos detectados) con el costo; pruebe aserciones débiles.', montar: montarRetorno },
    ],
    teoria: String.raw`
      <h2>Métricas</h2>
      <table>
        <tr><th>Métrica</th><th>Cuenta</th></tr>
        <tr><td>Líneas</td><td>líneas ejecutadas / líneas ejecutables</td></tr>
        <tr><td>Ramas</td><td>resultados de condiciones recorridos / total (2 por cada <code>if</code>)</td></tr>
        <tr><td>Funciones</td><td>funciones llamadas / funciones definidas</td></tr>
      </table>
      \[ \text{cobertura de ramas} = \frac{\#\{\text{ramas recorridas}\}}{2 \times \#\{\text{condiciones}\}} . \]
      <p>La cobertura de ramas es más exigente que la de líneas: un <code>if</code> sin <code>else</code> puede tener todas sus líneas ejecutadas y aun así faltar el caso «falso».</p>
      <h2>Lo que la cobertura no dice</h2>
      <ul>
        <li>Ejecutar no es verificar: una prueba sin <code>expect</code> da cobertura pero no detecta nada.</li>
        <li>No mide casos que el código <em>debería</em> tener y no tiene (un requisito olvidado).</li>
        <li>Una meta del 100 % invita a pruebas triviales; muchas organizaciones fijan umbrales (70–85 %) y miran sobre todo las <em>líneas nuevas</em>.</li>
      </ul>
      <div class="recuadro">Úsela como mapa, no como meta: pregúntese qué comportamientos importantes no tienen una prueba que fallaría si se rompieran. Complementa a las <a href="tema.html?id=unit-tests-mocks">pruebas unitarias</a> y se reporta en cada ejecución de <a href="tema.html?id=devops-ci-cd">integración continua</a>.</div>`,
  });
})();
