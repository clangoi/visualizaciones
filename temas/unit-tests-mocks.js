(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: ejecutar casos de prueba contra distintas versiones ---------- */

  // Regla: 10 % si el pedido es de $100 o más; 20 % para clientes «vip»; el descuento nunca supera $50. Resultado con dos decimales.
  const VERSIONES = {
    ok: { t: 'versión correcta', f: (p, t) => { let d = p >= 100 ? 0.1 : 0; if (t === 'vip') d = 0.2; return Math.round(Math.min(p * d, 50) * 100) / 100; }, cod: 'let d = precio >= 100 ? 0.1 : 0;\nif (tipo === "vip") d = 0.2;\nreturn redondear(Math.min(precio * d, 50));' },
    bug1: { t: 'bug: usa > en vez de >=', f: (p, t) => { let d = p > 100 ? 0.1 : 0; if (t === 'vip') d = 0.2; return Math.round(Math.min(p * d, 50) * 100) / 100; }, cod: 'let d = precio > 100 ? 0.1 : 0;      // ← debería ser >=\nif (tipo === "vip") d = 0.2;\nreturn redondear(Math.min(precio * d, 50));' },
    bug2: { t: 'bug: olvida el tope de $50', f: (p, t) => { let d = p >= 100 ? 0.1 : 0; if (t === 'vip') d = 0.2; return Math.round(p * d * 100) / 100; }, cod: 'let d = precio >= 100 ? 0.1 : 0;\nif (tipo === "vip") d = 0.2;\nreturn redondear(precio * d);          // ← falta Math.min(…, 50)' },
    bug3: { t: 'bug: el vip se suma al 10 %', f: (p, t) => { let d = p >= 100 ? 0.1 : 0; if (t === 'vip') d += 0.2; return Math.round(Math.min(p * d, 50) * 100) / 100; }, cod: 'let d = precio >= 100 ? 0.1 : 0;\nif (tipo === "vip") d += 0.2;          // ← debería asignar 0.2\nreturn redondear(Math.min(precio * d, 50));' },
  };
  const CASOS_BASE = [
    { n: 'sin descuento bajo $100', p: 80, t: 'normal', e: 0 }, { n: 'justo en $100 (límite)', p: 100, t: 'normal', e: 10 }, { n: 'vip con $200', p: 200, t: 'vip', e: 40 },
    { n: 'tope de $50', p: 1000, t: 'normal', e: 50 }, { n: 'vip con $150 (no se acumulan)', p: 150, t: 'vip', e: 30 },
  ];

  function montarEjecutor(cuerpo) {
    let version = 'ok', casos = CASOS_BASE.map((c) => ({ ...c })), resultados = null, nuevo = { p: 120, e: 12 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Código bajo prueba', valor: version, opciones: Object.entries(VERSIONES).map(([k, v]) => [k, v.t]), alCambiar: (v) => { version = v; resultados = null; dibujar(); } });
    ctl.numero({ etiqueta: 'Nuevo caso: precio', min: 0, max: 2000, valor: nuevo.p, alCambiar: (v) => { nuevo.p = v; } });
    ctl.numero({ etiqueta: 'descuento esperado', min: 0, max: 400, valor: nuevo.e, alCambiar: (v) => { nuevo.e = v; } });
    ctl.boton('Agregar caso (cliente normal)', () => { casos.push({ n: `precio $${nuevo.p}`, p: nuevo.p, t: 'normal', e: nuevo.e }); resultados = null; dibujar(); });
    ctl.boton('Ejecutar pruebas', () => { resultados = casos.map((c) => VERSIONES[version].f(c.p, c.t)); dibujar(); }, { primario: true });
    ctl.boton('Restablecer casos', () => { casos = CASOS_BASE.map((c) => ({ ...c })); resultados = null; dibujar(); });
    const codigo = el('pre', { class: 'codigo-bdd' }), tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(codigo, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada caso es: entrada → <code>expect(descuento(precio, tipo)).toBe(esperado)</code>. Ejecute con distintas versiones: los casos de borde (justo en $100, el tope) son los que delatan los bugs.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      codigo.textContent = `function descuento(precio, tipo) {\n${VERSIONES[version].cod.split('\n').map((l) => '  ' + l).join('\n')}\n}`;
      tabla.replaceChildren(el('tr', null, ...['Caso', 'Entrada', 'Esperado (expect)', 'Obtenido', 'Resultado'].map((h) => el('th', null, h))),
        ...casos.map((c, i) => {
          const r = resultados ? resultados[i] : null, ok = r === c.e;
          return el('tr', { class: resultados && !ok ? 'tachada' : null }, el('td', null, c.n), el('td', null, `(${c.p}, "${c.t}")`), el('td', null, String(c.e)), el('td', null, r === null ? '—' : String(r)), el('td', null, resultados ? VIZ.ficha(ok ? 'PASA' : 'FALLA', { color: ok ? C.s6 : C.s8 }) : '—'));
        }));
      const fallan = resultados ? casos.filter((c, i) => resultados[i] !== c.e).length : 0;
      registro.textContent = !resultados ? 'Pulse «Ejecutar pruebas».' : fallan ? `${fallan} prueba(s) fallan: la comparación entre lo esperado y lo obtenido muestra dónde está el defecto.` : 'Todas las pruebas pasan. Eso solo demuestra que el código funciona para estos casos, no para todos.';
      lectura.set([['casos', String(casos.length)], ['pasan', resultados ? String(casos.length - fallan) : '—'], ['fallan', resultados ? String(fallan) : '—']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: dependencia real frente a mock ---------- */

  function montarMock(cuerpo) {
    const est = { modo: 'real', fallo: 15, corridas: 24 };
    let semilla = 1, puntos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'La función obtenerClima llama a una API…', valor: est.modo, opciones: [['real', 'real (por red)'], ['mock', 'sustituida por un mock'], ['mockerr', 'mock que simula un error']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Fallas de la API real', min: 0, max: 40, valor: est.fallo, formato: (v) => `${v} %`, alCambiar: (v) => { est.fallo = v; dibujar(); } });
    ctl.boton('Repetir las corridas', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 160 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'la prueba pasa' }, { color: C.s8, texto: 'la prueba falla' }, { color: C.s2, texto: 'falla por culpa de la red, no del código' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La altura de cada barra es el tiempo de esa corrida. Con la API real hay lentitud y fallas aleatorias; el mock hace la prueba rápida, repetible y permite forzar casos difíciles.');
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(semilla * 17);
      puntos = Array.from({ length: est.corridas }, () => {
        if (est.modo === 'real') { const cae = rnd() < est.fallo / 100; return { ms: 150 + rnd() * 900, ok: !cae, red: cae }; }
        return { ms: 1 + rnd() * 2, ok: est.modo === 'mock', red: false, esperado: est.modo === 'mockerr' };
      });
      const max = 1100, w = (Wd - 16) / est.corridas;
      puntos.forEach((p, i) => {
        const h = Math.max(3, (p.ms / max) * (H - 30));
        ctx.fillStyle = p.red ? C.s2 : p.ok || p.esperado ? C.s6 : C.s8;
        ctx.beginPath(); ctx.roundRect(8 + i * w + 1, H - 18 - h, w - 2, h, [3, 3, 0, 0]); ctx.fill();
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(8, H - 17.5); ctx.lineTo(Wd - 8, H - 17.5); ctx.stroke();
      W.texto(ctx, `corridas de la prueba (tiempo en ms, escala hasta ${max})`, 8, H - 6, { tam: 10, alinear: 'left', color: C.apagado });
      const total = puntos.reduce((s, p) => s + p.ms, 0), falsas = puntos.filter((p) => p.red).length;
      registro.textContent = est.modo === 'real' ? `Con la API real: ${falsas} de ${est.corridas} fallas son culpa de la red y no del código; la suite tarda ${VIZ.fmt(total / 1000, 3)} s.` : est.modo === 'mock' ? 'El mock devuelve siempre el mismo clima de inmediato: la prueba es rápida y determinista.' : 'Un mock puede forzar el error de la API a voluntad y así verificar que el código lo maneja bien (algo difícil con la API real).';
      lectura.set([['tiempo total', total > 1500 ? `${VIZ.fmt(total / 1000, 3)} s` : `${Math.round(total)} ms`], ['fallas espurias', String(falsas)], ['¿se prueba el camino de error?', est.modo === 'mockerr' ? 'sí' : 'solo por azar'], ['determinista', est.modo === 'real' ? 'no' : 'sí']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const i = Math.floor((x - 8) / ((lienzo.ancho - 16) / est.corridas)); if (i < 0 || i >= puntos.length) return tip.ocultar(); tip.mostrar(x, y, `corrida <b>${i + 1}</b><br>${Math.round(puntos[i].ms)} ms<br>${puntos[i].red ? 'falla de red' : puntos[i].ok || puntos[i].esperado ? 'pasa' : 'falla'}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('unit-tests-mocks', {
    intro: String.raw`
      <p>Una <strong>prueba unitaria</strong> ejecuta una pequeña pieza de código con una entrada conocida y comprueba, con una <em>aserción</em> (<em>assertion</em>), que el resultado es el esperado.
      Escribirlas obliga a pensar en los casos límite y deja una red de seguridad: si algo se rompe en el futuro, una prueba falla y señala dónde.</p>
      <p>Cuando la pieza depende de algo externo (una API, la base de datos, el reloj), se sustituye por un <strong>doble de prueba</strong> (<em>mock</em>) para que la prueba sea rápida, repetible y no falle por razones ajenas.</p>`,
    visualizaciones: [
      { titulo: 'Casos de prueba y aserciones', descripcion: 'Ejecute la misma batería contra la versión correcta y tres versiones con un bug distinto; agregue su propio caso.', montar: montarEjecutor },
      { titulo: 'Dependencia real frente a mock', descripcion: 'Compare corridas con una API real (lenta y con fallas) y con un mock, incluido uno que simula un error.', montar: montarMock },
    ],
    teoria: String.raw`
      <h2>Anatomía de una prueba</h2>
      <pre><code>test("el descuento del vip no se acumula", () =&gt; {
    // Arrange: preparar los datos
    const precio = 150, tipo = "vip";
    // Act: ejecutar lo que se prueba
    const resultado = descuento(precio, tipo);
    // Assert: comprobar
    expect(resultado).toBe(30);
});</code></pre>
      <p>Una buena prueba es <em>rápida</em>, <em>independiente</em> de las demás, <em>repetible</em> (mismo resultado siempre) y <em>autoverificable</em>: pasa o falla sin interpretación humana.</p>
      <h2>Qué casos elegir</h2>
      <ul>
        <li><strong>Particiones de equivalencia</strong>: un caso por clase de entrada (menor y mayor a 100 dólares).</li>
        <li><strong>Valores límite</strong>: justo en la frontera (99, 100, 101): allí viven los errores de <code>&gt;</code> frente a <code>&gt;=</code>.</li>
        <li><strong>Casos de error</strong>: entradas inválidas, vacías, nulas.</li>
      </ul>
      <h2>Dobles de prueba</h2>
      <table>
        <tr><th>Doble</th><th>Para qué</th></tr>
        <tr><td><em>stub</em></td><td>devuelve respuestas fijas</td></tr>
        <tr><td><em>mock</em></td><td>además verifica cómo fue llamado (<code>toHaveBeenCalledWith</code>)</td></tr>
        <tr><td><em>spy</em></td><td>envuelve la función real y registra las llamadas</td></tr>
      </table>
      <p>Si una prueba sin mock falla con probabilidad \(q\) por causas externas, una suite de \(n\) pruebas de ese tipo falla espuriamente con probabilidad \(1-(1-q)^n\): con \(q = 1\,\%\) y \(n = 100\), cerca del \(63\,\%\).</p>
      <div class="recuadro">Un mock demasiado detallado acopla la prueba a la implementación (si cambia el cómo, se rompe aunque el qué siga igual). Sustituya solo las <em>fronteras</em> (red, disco, reloj). Para ver el mapa completo de pruebas, <a href="tema.html?id=test-pyramid">pirámide de pruebas</a>.</div>`,
  });
})();
