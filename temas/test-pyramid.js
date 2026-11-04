(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  const NIVELES = [
    { k: 'e2e', t: 'End-to-end', c: C.s7, seg: 20, falsa: 0.03, que: 'recorre la aplicación completa como un usuario' },
    { k: 'int', t: 'Integración', c: C.s3, seg: 0.5, falsa: 0.008, que: 'varios módulos juntos (API + base de datos)' },
    { k: 'uni', t: 'Unitarias', c: C.s1, seg: 0.01, falsa: 0.0003, que: 'una función o clase aislada' },
  ];
  const FORMAS = { piramide: { t: 'pirámide', v: [20, 100, 600] }, helado: { t: 'cono de helado (invertida)', v: [300, 100, 40] }, trofeo: { t: 'trofeo', v: [30, 300, 120] } };

  /* ---------- Fig. 1: la mezcla de pruebas ---------- */

  function montarMezcla(cuerpo) {
    const n = { e2e: 20, int: 100, uni: 600 };
    let barras = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Forma predefinida', valor: 'piramide', opciones: Object.entries(FORMAS).map(([k, f]) => [k, f.t]), alCambiar: (v) => { FORMAS[v].v.forEach((x, i) => { n[NIVELES[i].k] = x; sl[i].valor = x; }); dibujar(); } });
    const sl = NIVELES.map((nv) => ctl.rango({ etiqueta: `Pruebas ${nv.t.toLowerCase()}`, min: 0, max: 800, paso: 10, valor: n[nv.k], alCambiar: (v) => { n[nv.k] = v; dibujar(); } }));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, NIVELES.map((nv) => ({ color: nv.c, texto: nv.t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nivel es más lento y más frágil que el de abajo. Pruebe el «cono de helado» (muchas pruebas end-to-end) y compare el tiempo y los falsos positivos con la pirámide.');
    const tiempo = () => NIVELES.reduce((s, nv) => s + n[nv.k] * nv.seg, 0);
    const probFalla = () => 1 - NIVELES.reduce((s, nv) => s * Math.pow(1 - nv.falsa, n[nv.k]), 1);
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const max = Math.max(1, ...NIVELES.map((nv) => n[nv.k])), cx = Wd * 0.34, ancho = Wd * 0.62;
      barras = [];
      NIVELES.forEach((nv, i) => {
        const w = Math.max(6, (n[nv.k] / max) * ancho), y = 10 + i * 62, h = 54;
        ctx.fillStyle = VIZ.alfa(nv.c, 0.85); ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, 4); ctx.fill();
        W.texto(ctx, `${nv.t}: ${n[nv.k]}`, cx, y + h / 2, { tam: 11, peso: 600, color: C.sobre });
        W.texto(ctx, `${nv.seg} s c/u`, Wd - 8, y + h / 2 - 8, { tam: 10, alinear: 'right', color: C.tinta2 });
        W.texto(ctx, `${nv.falsa * 100} % frágil`, Wd - 8, y + h / 2 + 8, { tam: 10, alinear: 'right', color: C.tinta2 });
        barras.push({ y, h, nv });
      });
      const t = tiempo(), p = probFalla();
      registro.textContent = t > 600 ? `La suite tarda ${VIZ.fmt(t / 60, 3)} min: nadie la ejecutará antes de cada cambio.` : `La suite completa tarda ${VIZ.fmt(t, 3)} s: se puede ejecutar en cada commit.`;
      lectura.set([['tiempo de la suite', t >= 120 ? `${VIZ.fmt(t / 60, 3)} min` : `${VIZ.fmt(t, 3)} s`], ['probabilidad de un fallo espurio', `${VIZ.fmt(p * 100, 3)} %`], ['pruebas en total', String(n.e2e + n.int + n.uni)], ['tiempo en end-to-end', `${t ? Math.round((n.e2e * 20 / t) * 100) : 0} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = barras.find((q) => y >= q.y && y <= q.y + q.h); if (!b) return tip.ocultar(); tip.mostrar(x, y, `<b>${b.nv.t}</b><br>${b.nv.que}<br>${n[b.nv.k]} pruebas · ${VIZ.fmt(n[b.nv.k] * b.nv.seg, 3)} s`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: qué prueba atrapa qué defecto ---------- */

  const DEFECTOS = [
    ['una fórmula de descuento calcula mal', [0.95, 0.4, 0.5]], ['la consulta SQL devuelve filas de más', [0.15, 0.9, 0.7]], ['un botón no hace nada en Safari', [0, 0.05, 0.8]],
    ['el flujo de compra se rompe tras un cambio de la API', [0.05, 0.7, 0.9]], ['un caso límite (lista vacía) falla', [0.9, 0.5, 0.3]], ['dos módulos interpretan distinto una fecha', [0.1, 0.85, 0.6]],
  ];

  function montarDeteccion(cuerpo) {
    const peso = { uni: 60, int: 30, e2e: 10 };
    let celdas = [];
    const ctl = VIZ.controles(cuerpo);
    NIVELES.slice().reverse().forEach((nv) => ctl.rango({ etiqueta: `Esfuerzo en ${nv.t.toLowerCase()}`, min: 0, max: 100, paso: 5, valor: peso[nv.k], formato: (v) => `${v} %`, alCambiar: (v) => { peso[nv.k] = v; dibujar(); } }));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 38 + DEFECTOS.length * 34 + 10 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'probabilidad de que cada tipo de prueba lo detecte (más oscuro = más probable)' }, { color: C.s6, texto: 'detección con su mezcla de esfuerzo' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ningún tipo de prueba lo detecta todo. Reparta el esfuerzo y vea cuántos de los seis defectos típicos quedan cubiertos.');
    const orden = ['uni', 'int', 'e2e'];
    const prob = (d) => { const tot = orden.reduce((s, k) => s + peso[k], 0) || 1; return 1 - orden.reduce((p, k, j) => p * (1 - d[1][j] * Math.min(1, (peso[k] / tot) * 2.2)), 1); };
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const izq = Wd < 600 ? 120 : 280, w = (Wd - izq - 90) / 4;
      celdas = [];
      ['Unitarias', 'Integración', 'End-to-end', 'Su mezcla'].forEach((t, j) => W.texto(ctx, t, izq + j * w + w / 2, 14, { tam: 10, peso: 600, color: C.tinta2 }));
      DEFECTOS.forEach((d, i) => {
        const y = 30 + i * 34;
        W.texto(ctx, Wd < 600 ? d[0].slice(0, 20) + '…' : d[0], 6, y + 14, { tam: Wd < 600 ? 9 : 11, alinear: 'left' });
        [...d[1], prob(d)].forEach((v, j) => {
          const x = izq + j * w, mezcla = j === 3;
          ctx.fillStyle = mezcla ? VIZ.alfa(C.s6, 0.15 + v * 0.8) : VIZ.alfa(C.s1, 0.12 + v * 0.8);
          ctx.fillRect(x + 2, y, w - 4, 28);
          W.texto(ctx, `${Math.round(v * 100)} %`, x + w / 2, y + 14, { tam: 11, peso: mezcla ? 700 : 500, color: v > 0.6 ? C.sobre : C.tinta });
          celdas.push({ x, y, w, h: 28, v, i, j });
        });
      });
      const prom = DEFECTOS.reduce((s, d) => s + prob(d), 0) / DEFECTOS.length, debil = DEFECTOS.map((d) => [d[0], prob(d)]).sort((a, b) => a[1] - b[1])[0];
      registro.textContent = `Con esta mezcla se detectaría en promedio el ${Math.round(prom * 100)} % de estos defectos. El más expuesto: «${debil[0]}» (${Math.round(debil[1] * 100)} %).`;
      lectura.set([['detección promedio', `${Math.round(prom * 100)} %`], ['defecto más expuesto', `${Math.round(debil[1] * 100)} %`], ['defectos con más de 80 %', String(DEFECTOS.filter((d) => prob(d) > 0.8).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = celdas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (!c) return tip.ocultar(); tip.mostrar(x, y, `<b>${DEFECTOS[c.i][0]}</b><br>${['unitarias', 'integración', 'end-to-end', 'su mezcla'][c.j]}: ${Math.round(c.v * 100)} %`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('test-pyramid', {
    intro: String.raw`
      <p>Las pruebas automáticas no son todas iguales. Una <strong>prueba unitaria</strong> ejecuta una función aislada en milisegundos; una <strong>prueba de integración</strong> comprueba que varias piezas colaboran
      (por ejemplo la API con la base de datos); una prueba <strong>end-to-end</strong> maneja la aplicación completa en un navegador como lo haría una persona.</p>
      <p>Cuanto más arriba, más realista pero también más lenta, cara y frágil. La <strong>pirámide de pruebas</strong> aconseja muchas pruebas unitarias, algunas de integración y pocas end-to-end.</p>`,
    visualizaciones: [
      { titulo: 'La mezcla de pruebas', descripcion: 'Cambie la cantidad de cada tipo o elija una forma predefinida y compare el tiempo de la suite y la probabilidad de fallos espurios.', montar: montarMezcla },
      { titulo: 'Qué prueba atrapa qué defecto', descripcion: 'Reparta el esfuerzo entre los tres niveles y mire cuántos defectos típicos quedan cubiertos; ninguna capa sola basta.', montar: montarDeteccion },
    ],
    teoria: String.raw`
      <h2>Los tres niveles</h2>
      <table>
        <tr><th>Nivel</th><th>Qué prueba</th><th>Velocidad</th><th>Fragilidad</th></tr>
        <tr><td>Unitaria</td><td>una unidad con dependencias aisladas (<em>mocks</em>)</td><td>ms</td><td>baja</td></tr>
        <tr><td>Integración</td><td>módulos reales juntos, base de datos de prueba</td><td>segundos</td><td>media</td></tr>
        <tr><td>End-to-end</td><td>flujo completo desde la interfaz</td><td>decenas de segundos</td><td>alta</td></tr>
      </table>
      <h2>Costo de la suite</h2>
      <p>Con \(n_i\) pruebas de duración \(t_i\) y probabilidad \(q_i\) de fallar sin que haya un defecto (<em>flaky</em>), la suite dura y falla espuriamente</p>
      \[ T = \sum_i n_i t_i, \qquad P(\text{falsa alarma}) = 1 - \prod_i (1 - q_i)^{n_i}. \]
      <p>Con 600 unitarias, 100 de integración y 20 end-to-end la suite tarda unos 66 s; con 300 end-to-end, más de 1,7 horas y casi seguro tendrá una falla espuria. Una suite lenta o poco confiable se deja de ejecutar o de creer.</p>
      <h2>Criterios prácticos</h2>
      <ul>
        <li>Pruebe la lógica de negocio con unitarias; las fronteras (base de datos, API) con integración.</li>
        <li>Reserve end-to-end para los pocos flujos críticos (iniciar sesión, pagar).</li>
        <li>Ejecute las rápidas en cada cambio y las lentas en integración continua.</li>
      </ul>
      <div class="recuadro">El mapa de cada técnica: <a href="tema.html?id=unit-tests-mocks">unitarias y mocks</a>, <a href="tema.html?id=test-coverage">cobertura</a>, <a href="tema.html?id=tdd-cycle">TDD</a>. Para correr automáticamente la suite en cada cambio, vea <a href="tema.html?id=devops-ci-cd">integración continua</a>.</div>`,
  });
})();
