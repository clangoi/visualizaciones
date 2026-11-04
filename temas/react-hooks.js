(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: useState y la cola de actualizaciones ---------- */

  function montarEstado(cuerpo) {
    let modo = 'valor', cuenta = 0, cola = [], fase = 0, historial = [0], clics = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Al hacer clic, el manejador ejecuta', valor: modo, opciones: [['valor', 'setCuenta(cuenta + 1) × 3'], ['funcion', 'setCuenta(c => c + 1) × 3']], alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    cuerpo.appendChild(el('pre', { class: 'codigo-bdd', id: 'cod-hook' }, ''));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 200 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'actualización encolada' }, { color: C.s1, texto: 'render actual (valor capturado)' }, { color: C.s6, texto: 'estado nuevo' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dentro de un render, <code>cuenta</code> es una constante: vale lo mismo en las tres llamadas. Por eso tres «+1» calculados con ella se encolan como el mismo valor.');
    const codigo = () => cuerpo.querySelector('#cod-hook');
    function iniciar() {
      cuenta = 0; cola = []; fase = 0; historial = [0]; clics = 0;
      return (function* () {
        fase = 1; yield;
        for (let k = 1; k <= 3; k++) { cola.push(modo === 'valor' ? { t: `→ ${cuenta + 1}` } : { t: 'c => c + 1' }); fase = 1 + k; yield; }
        fase = 5; let v = cuenta; for (const q of cola) v = modo === 'valor' ? cuenta + 1 : v + 1; yield;
        cuenta = v; historial.push(v); fase = 6; yield;
      })();
    }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      codigo().textContent = modo === 'valor' ? 'function manejador() {\n  setCuenta(cuenta + 1);\n  setCuenta(cuenta + 1);\n  setCuenta(cuenta + 1);\n}' : 'function manejador() {\n  setCuenta(c => c + 1);\n  setCuenta(c => c + 1);\n  setCuenta(c => c + 1);\n}';
      W.caja(ctx, 8, 8, Math.min(150, Wd / 3), 50, 'render #1\ncuenta = 0', { borde: C.s1, relleno: VIZ.alfa(C.s1, 0.15), tam: 12, peso: 600 });
      W.texto(ctx, 'cola de actualizaciones:', 8, 80, { tam: 11, alinear: 'left', peso: 600 });
      cola.forEach((q, i) => W.caja(ctx, 8 + i * Math.min(118, Wd / 3.2), 92, Math.min(110, Wd / 3.4), 30, q.t, { borde: C.s2, relleno: VIZ.alfa(C.s2, 0.2), tam: 11 }));
      if (fase >= 6) W.caja(ctx, 8, 146, Math.min(240, Wd - 16), 40, `render #2: cuenta = ${cuenta}`, { borde: C.s6, relleno: VIZ.alfa(C.s6, 0.2), tam: 12, peso: 700 });
      registro.textContent = ['Pulse «Un paso»: el usuario hace clic en el botón.', 'Se ejecuta el manejador con el render actual (cuenta = 0).', `Primera llamada: se encola ${cola[0] ? cola[0].t : ''}. No se re-renderiza todavía.`, 'Segunda llamada: se encola otra actualización (React agrupa los cambios).', 'Tercera llamada: la cola tiene tres actualizaciones.', 'Terminado el manejador, React procesa la cola en orden.', modo === 'valor' ? 'Las tres fijaban el mismo valor (1): el resultado es 1, no 3.' : 'Cada función recibió el resultado de la anterior: 0 → 1 → 2 → 3.'][fase];
      lectura.set([['valor en el render #1', '0'], ['actualizaciones en cola', String(cola.length)], ['resultado', fase >= 6 ? String(cuenta) : '—']]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: useEffect y su arreglo de dependencias ---------- */

  const DEPS = { vacio: [[], '[]  (solo al montar)'], a: [['a'], '[a]'], ab: [['a', 'b'], '[a, b]'], ninguno: [null, 'sin arreglo (cada render)'] };

  function montarEfecto(cuerpo) {
    let deps = 'a', a = 0, b = 0, renders = 1, efectos = 0, limpiezas = 0, bitacora = [];
    let prev = { a: null, b: null, montado: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Dependencias del efecto', valor: deps, opciones: Object.entries(DEPS).map(([k, d]) => [k, d[1]]), alCambiar: (v) => { deps = v; reiniciar(); } });
    ctl.boton('Incrementar a', () => { a++; render('a cambió'); }, { primario: true });
    ctl.boton('Incrementar b', () => { b++; render('b cambió'); });
    ctl.boton('Reiniciar', () => reiniciar());
    cuerpo.appendChild(el('pre', { class: 'codigo-bdd', id: 'cod-efecto' }, ''));
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El efecto se ejecuta <em>después</em> de pintar, y solo si alguna dependencia cambió. Antes de volver a correr, React ejecuta la limpieza del efecto anterior.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';

    function render(motivo) {
      renders++;
      const lista_ = DEPS[deps][0];
      const corre = !prev.montado || lista_ === null || lista_.some((d) => (d === 'a' ? a !== prev.a : b !== prev.b));
      bitacora.unshift({ t: `render #${renders}  (a=${a}, b=${b}) — ${motivo}`, k: 'render' });
      if (corre) {
        if (prev.montado) { limpiezas++; bitacora.unshift({ t: '   ↳ limpieza del efecto anterior', k: 'limpieza' }); }
        efectos++; bitacora.unshift({ t: `   ↳ efecto ejecutado (document.title = "a=${a}")`, k: 'efecto' });
      } else bitacora.unshift({ t: '   ↳ efecto omitido: las dependencias no cambiaron', k: 'omitido' });
      prev = { a, b, montado: true };
      mostrar();
    }
    function reiniciar() { a = 0; b = 0; renders = 0; efectos = 0; limpiezas = 0; bitacora = []; prev = { a: null, b: null, montado: false }; render('montaje'); }
    function mostrar() {
      cuerpo.querySelector('#cod-efecto').textContent = `useEffect(() => {\n  document.title = "a=" + a;\n  return () => { /* limpieza */ };\n}${deps === 'ninguno' ? '' : `, ${DEPS[deps][1].split(' ')[0]}`});`;
      lista.replaceChildren(...bitacora.slice(0, 12).map((e, i) => el('div', { class: i === 0 ? 'activa' : null }, e.t)));
      registro.textContent = bitacora[0] ? bitacora[0].t.replace(/^\s*↳\s*/, '') : '';
      lectura.set([['renders', String(renders)], ['efectos ejecutados', String(efectos)], ['limpiezas', String(limpiezas)]]);
    }
    reiniciar();
  }

  VIZ.registrarTema('react-hooks', {
    intro: String.raw`
      <p>Un componente de función se ejecuta de arriba abajo cada vez que se renderiza y no recuerda nada entre ejecuciones. Los <strong>Hooks</strong> le dan memoria y efectos:
      <code>useState</code> guarda un valor entre renders, y <code>useEffect</code> ejecuta código <em>después</em> de pintar, como pedir datos o suscribirse a algo.</p>
      <p>Para usarlos bien hay que recordar dos ideas: cada render es una «foto» con sus propios valores, y los cambios de estado se encolan y se procesan juntos.</p>`,
    visualizaciones: [
      { titulo: 'useState y la cola de actualizaciones', descripcion: 'Compare tres llamadas con un valor calculado y tres con una función: avance paso a paso hasta el nuevo render.', montar: montarEstado },
      { titulo: 'useEffect y sus dependencias', descripcion: 'Cambie las dependencias y pulse los botones: observe cuándo corre el efecto, cuándo se limpia y cuándo se omite.', montar: montarEfecto },
    ],
    teoria: String.raw`
      <h2>useState</h2>
      <pre><code>const [valor, setValor] = useState(inicial);</code></pre>
      <p>Llamar a <code>setValor</code> no cambia <code>valor</code> en el render actual: pide un render nuevo con el valor actualizado. Con una función, <code>setValor(v =&gt; v + 1)</code>, React la aplica sobre el resultado más reciente, de modo que \(k\) llamadas suman \(k\); con \(k\) llamadas a <code>setValor(valor + 1)</code> el resultado es \(\texttt{valor} + 1\).</p>
      <h2>useEffect</h2>
      <pre><code>useEffect(() =&gt; {
    // efecto: se ejecuta tras el render
    return () =&gt; { /* limpieza antes del siguiente efecto o al desmontar */ };
}, [dependencias]);</code></pre>
      <table>
        <tr><th>Dependencias</th><th>Cuándo corre el efecto</th></tr>
        <tr><td><code>[]</code></td><td>una vez, al montar (y limpieza al desmontar)</td></tr>
        <tr><td><code>[a]</code></td><td>al montar y cada vez que <code>a</code> cambia</td></tr>
        <tr><td>(sin arreglo)</td><td>después de cada render</td></tr>
      </table>
      <p>Las dependencias se comparan con <code>Object.is</code>. Si el efecto usa una variable que no está en el arreglo, verá un valor <em>viejo</em> (una <a href="tema.html?id=scope-closures">clausura</a> sobre un render anterior).</p>
      <h2>Reglas de los Hooks</h2>
      <ul>
        <li>Se llaman siempre en el mismo orden, en el nivel superior del componente (no dentro de <code>if</code> ni bucles).</li>
        <li>Solo en componentes de función o en otros Hooks propios (<code>useAlgo</code>).</li>
      </ul>
      <div class="recuadro">Un efecto sirve para sincronizar con algo <em>externo</em> (red, temporizadores, el DOM). Si solo calcula un valor a partir del estado, calcúlelo durante el render. Las peticiones de red típicas se vinculan con <a href="tema.html?id=promises-async-await">promesas y async/await</a>.</div>`,
  });
})();
