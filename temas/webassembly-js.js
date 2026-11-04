(function () {
  'use strict';
  const { color: C, el } = VIZ;

  // Módulo WebAssembly escrito a mano: calc(n) = Σ_{i<n} (i XOR (i >> 3)) con aritmética de 32 bits.
  const BYTES = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 6, 1, 0x60, 1, 0x7f, 1, 0x7f, 3, 2, 1, 0, 7, 8, 1, 4, 0x63, 0x61, 0x6c, 0x63, 0, 0,
    0x0a, 0x26, 1, 0x24, 1, 2, 0x7f, 3, 0x40, 0x20, 2, 0x20, 1, 0x20, 1, 0x41, 3, 0x76, 0x73, 0x6a, 0x21, 2, 0x20, 1, 0x41, 1, 0x6a, 0x21, 1, 0x20, 1, 0x20, 0, 0x49, 0x0d, 0, 0x0b, 0x20, 2, 0x0b]);
  function calcJs(n) { let s = 0; for (let i = 0; i < n; i = (i + 1) | 0) s = (s + (i ^ (i >>> 3))) | 0; return s; }

  /* ---------- Fig. 1: medir de verdad ---------- */

  function montarMedicion(cuerpo) {
    let n = 20, wasm = null, historial = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Iteraciones del bucle', min: 1, max: 100, valor: n, formato: (v) => `${v} millones`, alCambiar: (v) => { n = v; } });
    ctl.boton('Medir JavaScript y WebAssembly', () => medir(), { primario: true });
    ctl.boton('Borrar mediciones', () => { historial = []; mostrar(); });
    const modulo = el('pre', { class: 'codigo-bdd' }), tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(modulo, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La medición es real, en su navegador. El resultado cambia con el motor, la máquina y el calentamiento del compilador JIT: repita varias veces antes de sacar conclusiones.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    modulo.textContent = `// JavaScript\nfunction calc(n) { let s = 0; for (let i = 0; i < n; i++) s = (s + (i ^ (i >>> 3))) | 0; return s; }\n\n// WebAssembly (texto equivalente del módulo binario de ${BYTES.length} bytes)\n(func (export "calc") (param $n i32) (result i32) (local $i i32) (local $s i32)\n  (loop $L\n    (local.set $s (i32.add (local.get $s) (i32.xor (local.get $i) (i32.shr_u (local.get $i) (i32.const 3)))))\n    (local.set $i (i32.add (local.get $i) (i32.const 1)))\n    (br_if $L (i32.lt_u (local.get $i) (local.get $n))))\n  (local.get $s))`;
    function medir() {
      try { if (!wasm) wasm = new WebAssembly.Instance(new WebAssembly.Module(BYTES)).exports.calc; } catch (e) { registro.textContent = 'Este navegador no puede instanciar WebAssembly.'; return; }
      const N = n * 1e6;
      let t = performance.now(); const rj = calcJs(N); const tj = performance.now() - t;
      t = performance.now(); const rw = wasm(N); const tw = performance.now() - t;
      historial.unshift({ N, tj, tw, ok: rj === rw }); historial = historial.slice(0, 6); mostrar();
    }
    function mostrar() {
      tabla.replaceChildren(el('tr', null, ...['Iteraciones', 'JavaScript', 'WebAssembly', 'Mismo resultado'].map((h) => el('th', null, h))),
        ...(historial.length ? historial.map((h) => el('tr', null, el('td', null, VIZ.entero(h.N)), el('td', null, `${VIZ.fmt(h.tj, 4)} ms`), el('td', null, `${VIZ.fmt(h.tw, 4)} ms`), el('td', null, VIZ.ficha(h.ok ? 'sí' : 'NO', { color: h.ok ? C.s6 : C.s8 })))) : [el('tr', null, el('td', { class: 'vacia' }, 'pulse «Medir»'), el('td', null, ''), el('td', null, ''), el('td', null, ''))]));
      const u = historial[0];
      registro.textContent = u ? `Con ${VIZ.entero(u.N)} iteraciones: JavaScript ${VIZ.fmt(u.tj, 4)} ms y WebAssembly ${VIZ.fmt(u.tw, 4)} ms.` : 'Aún no hay mediciones.';
      lectura.set([['mediciones', String(historial.length)], ['razón JS / Wasm', u ? `${VIZ.fmt(u.tj / Math.max(u.tw, 0.01), 3)} ×` : '—'], ['tamaño del módulo', `${BYTES.length} bytes`]]);
    }
    mostrar();
  }

  /* ---------- Fig. 2: el costo de cruzar la frontera JS ↔ Wasm ---------- */

  function montarFrontera(cuerpo) {
    const est = { total: 100000, llamada: 100, trabajo: 20 };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Elementos que hay que procesar', min: 1000, max: 1e6, paso: 1000, valor: est.total, formato: (v) => VIZ.entero(v), alCambiar: (v) => { est.total = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de cada cruce JS ↔ Wasm', min: 10, max: 1000, paso: 10, valor: est.llamada, formato: (v) => `${v} ns`, alCambiar: (v) => { est.llamada = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Trabajo por elemento dentro de Wasm', min: 1, max: 200, valor: est.trabajo, formato: (v) => `${v} ns`, alCambiar: (v) => { est.trabajo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tiempo total según el tamaño del lote', forma: 'linea' }, { color: C.s2, texto: 'trabajo útil (mínimo posible)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Llamar a Wasm elemento por elemento paga el cruce miles de veces; entregar un bloque de memoria y procesarlo adentro lo paga una vez por lote.');
    const tiempo = (k) => (est.total * est.trabajo + Math.ceil(est.total / k) * est.llamada) / 1e6; // ms
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 5, ymin: 0, ymax: tiempo(1) * 1.05 }, { etiquetaX: 'tamaño del lote k (elementos por llamada)', etiquetaY: 'tiempo total (ms)', formatoX: (v) => VIZ.entero(Math.pow(10, v)), ticksX: [0, 1, 2, 3, 4, 5] });
      plano.ejes();
      VIZ.trazar(ctx, plano, Array.from({ length: 101 }, (_, i) => [(5 * i) / 100, tiempo(Math.pow(10, (5 * i) / 100))]), C.s1, 2);
      VIZ.trazar(ctx, plano, [[0, (est.total * est.trabajo) / 1e6], [5, (est.total * est.trabajo) / 1e6]], C.s2, 2, [4, 4]);
      lectura.set([['un cruce por elemento (k = 1)', `${VIZ.fmt(tiempo(1), 4)} ms`], ['un solo lote (k = todo)', `${VIZ.fmt(tiempo(est.total), 4)} ms`], ['sobrecosto evitado', `${VIZ.fmt((1 - tiempo(est.total) / tiempo(1)) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const k = Math.pow(10, plano.ix(x)); tip.mostrar(x, y, `lote = <b>${VIZ.entero(k)}</b><br>${VIZ.fmt(tiempo(k), 4)} ms`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('webassembly-js', {
    intro: String.raw`
      <p><strong>WebAssembly</strong> (Wasm) es un formato binario compacto que los navegadores ejecutan a velocidad cercana a la nativa. No se escribe a mano: se obtiene <em>compilando</em> código de otros lenguajes (Rust, C, C++, Go)
      y se carga desde JavaScript como un módulo.</p>
      <p>No reemplaza a JavaScript: lo complementa. JavaScript sigue manejando la página y el DOM; Wasm se usa para el trabajo pesado de cálculo (edición de imágenes y vídeo, criptografía, juegos, simulaciones) y para reutilizar bibliotecas ya escritas en otros lenguajes.</p>`,
    visualizaciones: [
      { titulo: 'Medición real: JavaScript frente a WebAssembly', descripcion: 'Un módulo Wasm de 70 bytes, escrito a mano, y su equivalente en JavaScript ejecutan el mismo bucle en su navegador. Mida varias veces con distintos tamaños.', montar: montarMedicion },
      { titulo: 'El costo de cruzar la frontera', descripcion: 'Cambie el tamaño del lote con que se llama a Wasm: llamar elemento por elemento puede anular toda la ventaja.', montar: montarFrontera },
    ],
    teoria: String.raw`
      <h2>Cómo funciona</h2>
      <pre><code>código fuente (Rust, C…) ──compilar──▶ módulo .wasm (binario)
                                          │ descargar
navegador: validar ─▶ compilar a código de máquina ─▶ ejecutar en un entorno aislado
JavaScript: const { calc } = (await WebAssembly.instantiate(bytes)).instance.exports;</code></pre>
      <ul>
        <li><strong>Tipado y predecible</strong>: el código ya llega con tipos numéricos explícitos (<code>i32</code>, <code>f64</code>…), por lo que no necesita la «adivinanza» y el recalentamiento de un motor JavaScript.</li>
        <li><strong>Aislado</strong>: se ejecuta en un entorno restringido (<em>sandbox</em>) con memoria lineal propia; solo accede al exterior mediante las funciones que JavaScript le importa.</li>
        <li><strong>Portable</strong>: el mismo binario corre en cualquier navegador (y fuera de ellos).</li>
      </ul>
      <h2>Cuándo conviene</h2>
      <table>
        <tr><th>Sí</th><th>No suele convenir</th></tr>
        <tr><td>cálculo numérico intensivo, procesamiento de imagen/audio, compresión, física, criptografía</td><td>manipular el DOM, lógica de interfaz, tareas dominadas por la red</td></tr>
      </table>
      <h2>Costo de la frontera</h2>
      <p>Cada llamada entre JavaScript y Wasm cuesta \(c\) y cada elemento procesado, \(w\). Procesar \(n\) elementos en lotes de \(k\) toma</p>
      \[ T(k) = n\,w + \left\lceil \tfrac{n}{k} \right\rceil c . \]
      <p>Con \(k = 1\) el término de llamadas domina; con un solo lote vale \(nw + c\). Por eso se copian los datos a la memoria de Wasm una vez y se procesan allí. En bucles simples y calientes, un JavaScript bien optimizado por el JIT puede acercarse al rendimiento de Wasm; su ventaja crece con la complejidad y la necesidad de rendimiento estable.</p>
      <div class="recuadro">Un módulo Wasm es una forma de «ejecución de código compilado en el navegador». Si necesita comunicación en tiempo real con un servidor, mire <a href="tema.html?id=websockets-http">WebSockets</a>; para tipos en JavaScript, <a href="tema.html?id=typescript-static-typing">TypeScript</a>.</div>`,
  });
})();
