(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: Rojo → Verde → Refactorizar con FizzBuzz ---------- */

  const TESTS = [
    ['fizzbuzz(1) → "1"', 1, '1'], ['fizzbuzz(3) → "Fizz"', 3, 'Fizz'], ['fizzbuzz(5) → "Buzz"', 5, 'Buzz'], ['fizzbuzz(15) → "FizzBuzz"', 15, 'FizzBuzz'],
  ];
  const PASOS = [
    { fase: 'rojo', nota: 'Primero se escribe una prueba que falle: todavía no existe fizzbuzz.', n: 1, impl: '' },
    { fase: 'verde', nota: 'Se escribe el código MÁS SIMPLE que haga pasar la prueba.', n: 1, impl: 'function fizzbuzz(n) {\n  return String(n);\n}' },
    { fase: 'rojo', nota: 'Nueva prueba: los múltiplos de 3. Falla (devuelve "3").', n: 2, impl: 'function fizzbuzz(n) {\n  return String(n);\n}' },
    { fase: 'verde', nota: 'Se agrega solo lo necesario para esta prueba.', n: 2, impl: 'function fizzbuzz(n) {\n  if (n % 3 === 0) return "Fizz";\n  return String(n);\n}' },
    { fase: 'rojo', nota: 'Nueva prueba: los múltiplos de 5.', n: 3, impl: 'function fizzbuzz(n) {\n  if (n % 3 === 0) return "Fizz";\n  return String(n);\n}' },
    { fase: 'verde', nota: 'Se agrega la segunda regla.', n: 3, impl: 'function fizzbuzz(n) {\n  if (n % 3 === 0) return "Fizz";\n  if (n % 5 === 0) return "Buzz";\n  return String(n);\n}' },
    { fase: 'rojo', nota: 'El caso 15 revela un error: devuelve "Fizz", y debería ser "FizzBuzz". Las pruebas anteriores siguen verdes.', n: 4, impl: 'function fizzbuzz(n) {\n  if (n % 3 === 0) return "Fizz";\n  if (n % 5 === 0) return "Buzz";\n  return String(n);\n}' },
    { fase: 'verde', nota: 'Se corrige el caso combinado.', n: 4, impl: 'function fizzbuzz(n) {\n  if (n % 15 === 0) return "FizzBuzz";\n  if (n % 3 === 0) return "Fizz";\n  if (n % 5 === 0) return "Buzz";\n  return String(n);\n}' },
    { fase: 'refactor', nota: 'Con todas las pruebas en verde se puede mejorar el diseño sin miedo: las pruebas avisan si algo se rompe.', n: 4, impl: 'function fizzbuzz(n) {\n  const s = (n % 3 === 0 ? "Fizz" : "") + (n % 5 === 0 ? "Buzz" : "");\n  return s || String(n);\n}' },
  ];
  const COLOR = { rojo: C.s8, verde: C.s6, refactor: C.s7 };

  function evaluar(impl, n) {
    return TESTS.map(([nombre, entrada, esperado], i) => {
      if (i >= n) return { nombre, estado: 'no escrita' };
      if (!impl) return { nombre, estado: 'falla', obtenido: 'ReferenceError: fizzbuzz no está definida' };
      let r;
      try { r = new Function(`${impl}\nreturn fizzbuzz(${entrada});`)(); } catch (e) { r = String(e); }
      return { nombre, estado: r === esperado ? 'pasa' : 'falla', obtenido: r };
    });
  }

  function montarCiclo(cuerpo) {
    let k = 0;
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const fase = el('div', { class: 'fichas' }), codigo = el('pre', { class: 'codigo-bdd' }), tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(fase, codigo, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso ejecuta de verdad las pruebas contra el código mostrado. Regla: no se escribe código de producción sin una prueba que falle antes.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function iniciar() { k = 0; return (function* () { for (let j = 1; j < PASOS.length; j++) { k = j; yield; } })(); }
    function dibujar() {
      const p = PASOS[k], res = evaluar(p.impl, p.n);
      fase.replaceChildren(el('span', { class: 'fichas-titulo' }, `Paso ${k + 1} de ${PASOS.length}:`), ...['rojo', 'verde', 'refactor'].map((f) => VIZ.ficha(f === 'rojo' ? 'ROJO: la prueba falla' : f === 'verde' ? 'VERDE: pasa' : 'REFACTORIZAR', f === p.fase ? { color: COLOR[f], fondo: VIZ.alfa(COLOR[f], 0.25) } : { color: C.inactivo, tinta: C.apagado })));
      codigo.textContent = p.impl || '// (aún no hay implementación)';
      tabla.replaceChildren(el('tr', null, el('th', null, 'Prueba'), el('th', null, 'Resultado'), el('th', null, 'Obtenido')),
        ...res.map((r) => el('tr', { class: r.estado === 'no escrita' ? 'tachada' : null }, el('td', null, r.nombre), el('td', null, r.estado === 'no escrita' ? 'aún no escrita' : VIZ.ficha(r.estado === 'pasa' ? 'PASA' : 'FALLA', { color: r.estado === 'pasa' ? C.s6 : C.s8 })), el('td', null, r.obtenido === undefined ? '—' : String(r.obtenido)))));
      registro.textContent = p.nota;
      lectura.set([['fase', p.fase], ['pruebas que pasan', `${res.filter((r) => r.estado === 'pasa').length} de ${p.n}`], ['líneas de código', String(p.impl ? p.impl.split('\n').length : 0)]]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: modelo de defectos con TDD y sin él ---------- */

  function montarComparacion(cuerpo) {
    const est = { tam: 40, disciplina: 70 };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño de la funcionalidad', min: 10, max: 100, valor: est.tam, formato: (v) => `${v} unidades`, alCambiar: (v) => { est.tam = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Disciplina del equipo con TDD', min: 20, max: 100, valor: est.disciplina, formato: (v) => `${v} %`, alCambiar: (v) => { est.disciplina = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s2, t: 'pruebas después del código' }, { c: C.s1, t: 'TDD' }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Modelo ilustrativo, no un dato empírico: con TDD se avanza algo más despacio al principio, pero los defectos se detectan al instante y no se acumulan.');
    // Defectos acumulados sin detectar a lo largo del desarrollo.
    const despues = (t) => 0.9 * t - (t > est.tam * 0.8 ? 0.55 * (t - est.tam * 0.8) * 3 : 0);
    const tdd = (t) => 0.9 * t * (1 - est.disciplina / 100 * 0.9) + 0.4 * (t > 0 ? 1 : 0);
    const f = [(t) => Math.max(0, despues(t)), (t) => Math.max(0, tdd(t))];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xmax = est.tam * 1.2;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: Math.max(10, f[0](est.tam * 0.8) * 1.15) }, { etiquetaX: 'avance del desarrollo (unidades)', etiquetaY: 'defectos sin detectar' });
      plano.ejes();
      f.forEach((fn, i) => VIZ.trazar(ctx, plano, Array.from({ length: 121 }, (_, j) => [(xmax * j) / 120, fn((xmax * j) / 120)]), SER[i].c, 2));
      const x = plano.sx(est.tam * 0.8); ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, plano.y0); ctx.lineTo(x, plano.y1); ctx.stroke(); ctx.setLineDash([]);
      VIZ.web.texto(ctx, 'fase de pruebas', x + 4, plano.y1 + 8, { tam: 10, alinear: 'left', color: C.apagado });
      lectura.set([['defectos al empezar a probar (después)', VIZ.fmt(f[0](est.tam * 0.8), 3)], ['defectos acumulados con TDD', VIZ.fmt(f[1](est.tam * 0.8), 3)], ['reducción', `${Math.round((1 - f[1](est.tam * 0.8) / f[0](est.tam * 0.8)) * 100)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const t = plano.ix(x); tip.mostrar(x, y, `avance = <b>${VIZ.fmt(t, 3)}</b>` + SER.map((s, i) => VIZ.filaTooltip(s.c, s.t, VIZ.fmt(f[i](t), 3))).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('tdd-cycle', {
    intro: String.raw`
      <p>En el <strong>desarrollo guiado por pruebas</strong> (<em>Test-Driven Development</em>, TDD) la prueba se escribe <em>antes</em> que el código. Se trabaja en ciclos muy cortos de tres fases:
      <strong>rojo</strong> (escribir una prueba que falla), <strong>verde</strong> (escribir el código más simple que la haga pasar) y <strong>refactorizar</strong> (mejorar el diseño con la red de seguridad de las pruebas).</p>
      <p>El resultado no es solo un conjunto de pruebas: el código queda diseñado para ser probado, con piezas pequeñas y bien definidas.</p>`,
    visualizaciones: [
      { titulo: 'Rojo, verde, refactorizar', descripcion: 'Avance un paso a la vez: cada paso ejecuta las pruebas reales contra el código que se muestra. Observe cuándo una prueba nueva detecta un error.', montar: montarCiclo },
      { titulo: 'Defectos acumulados durante el desarrollo', descripcion: 'Compare pruebas después del código con TDD según el tamaño de la tarea y la disciplina del equipo.', montar: montarComparacion },
    ],
    teoria: String.raw`
      <h2>El ciclo</h2>
      <pre><code>repetir:
    ROJO     escribir UNA prueba que exprese el siguiente comportamiento; verla fallar
    VERDE    escribir el código mínimo que la haga pasar (aunque sea «feo»)
    REFACTOR mejorar nombres y estructura; todas las pruebas deben seguir en verde</code></pre>
      <p>Ver fallar la prueba primero no es un trámite: demuestra que la prueba <em>puede</em> fallar (que no es una prueba vacía) y que el código nuevo es el que la hace pasar.</p>
      <h2>Beneficios y límites</h2>
      <ul>
        <li><strong>Retroalimentación inmediata</strong>: un error se detecta minutos después de escribirse, cuando su causa es obvia.</li>
        <li><strong>Diseño</strong>: lo difícil de probar suele estar mal acoplado; escribir primero la prueba empuja hacia interfaces simples.</li>
        <li><strong>Documentación viva</strong>: cada prueba es un ejemplo ejecutable de uso.</li>
        <li><strong>Límites</strong>: exige disciplina y no sustituye a las pruebas de integración ni a la validación con usuarios.</li>
      </ul>
      <h2>Costo</h2>
      <p>Si un defecto introducido en el instante \(t_0\) se detecta en \(t_1\), su costo crece con el intervalo \(t_1 - t_0\) (hay más código que depende de él). TDD reduce ese intervalo a minutos, mientras que las pruebas al final lo dejan en semanas, por la misma razón que explica el <a href="tema.html?id=software-quality">costo creciente de los defectos</a>.</p>
      <div class="recuadro">Sus pruebas son <a href="tema.html?id=unit-tests-mocks">pruebas unitarias</a>; para saber qué tanto del código recorren, use <a href="tema.html?id=test-coverage">cobertura</a>. Un ciclo así se automatiza en <a href="tema.html?id=devops-ci-cd">integración continua</a>.</div>`,
  });
})();
