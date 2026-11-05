(function () {
  'use strict';
  const { color: C, el } = VIZ;

  function montarParidad(cuerpo) {
    const F = 5, K = 5;
    let datos, orig, modo = '2d';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Código', opciones: [['1d', 'Un bit de paridad por fila'], ['2d', 'Paridad bidimensional']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.boton('Datos nuevos', () => { nuevo(); }, { primario: true });
    ctl.boton('Restaurar', () => { datos = orig.map((f) => f.slice()); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 240 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'bit de dato' }, { color: C.s3, texto: 'bit de paridad' }, { color: C.s8, texto: 'bit alterado / fila o columna con paridad incorrecta', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un bit para invertirlo, como si el ruido lo hubiera alterado. Con paridad 2D un error simple se ubica en la intersección de la fila y la columna que fallan y se corrige.');
    let geo;
    function nuevo() { const r = VIZ.semilla(Math.floor(Math.random() * 1e6) + 1); orig = Array.from({ length: F }, () => Array.from({ length: K }, () => (r() < 0.5 ? 1 : 0))); datos = orig.map((f) => f.slice()); dibujar(); }
    const par = (a) => a.reduce((x, y) => x + y, 0) % 2;
    function dibujar() {
      const { ctx, ancho: W } = lienzo, cw = Math.min(40, (W - 30) / (K + 1)), x0 = (W - cw * (K + 1)) / 2, y0 = 14; geo = { cw, x0, y0 };
      lienzo.limpiar();
      const filaMal = datos.map((f, i) => par(f) !== par(orig[i])), colMal = Array.from({ length: K }, (_, j) => par(datos.map((f) => f[j])) !== par(orig.map((f) => f[j])));
      ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= F; i++) for (let j = 0; j <= K; j++) {
        if (modo === '1d' && i === F) continue;
        const x = x0 + j * cw, y = y0 + i * 34;
        let v, col = C.s1;
        if (i < F && j < K) { v = datos[i][j]; if (datos[i][j] !== orig[i][j]) col = C.s8; }
        else if (i < F) { v = par(orig[i]); col = filaMal[i] ? C.s8 : C.s3; }
        else if (j < K) { v = par(orig.map((f) => f[j])); col = colMal[j] ? C.s8 : C.s3; }
        else { v = par(orig.map((f) => par(f))); col = C.s3; }
        ctx.fillStyle = col; ctx.fillRect(x + 2, y, cw - 4, 30); ctx.fillStyle = C.sobre; ctx.fillText(String(v), x + cw / 2, y + 15);
      }
      const nerr = datos.flat().filter((v, k) => v !== orig.flat()[k]).length, fm = filaMal.filter(Boolean).length, cm = colMal.filter(Boolean).length;
      let msg = 'Sin errores: todas las paridades coinciden.';
      if (nerr) {
        if (modo === '1d') msg = fm ? `Se detecta un error en ${fm} fila(s), pero no se sabe en qué columna: solo se puede pedir retransmisión.` : 'Hay errores pero las paridades coinciden: error no detectado (número par de bits alterados en cada fila).';
        else if (fm === 1 && cm === 1) msg = `Un solo error: está en la fila ${filaMal.indexOf(true) + 1}, columna ${colMal.indexOf(true) + 1}. Se corrige invirtiendo ese bit.`;
        else if (fm + cm) msg = `Se detecta el error (fallan ${fm} fila(s) y ${cm} columna(s)), pero con varios errores no se puede corregir con certeza.`;
        else msg = 'Error no detectado: cuatro bits en un rectángulo mantienen todas las paridades.';
      }
      registro.textContent = msg;
      lectura.set([['bits alterados', String(nerr)], ['filas incorrectas', String(fm)], ['columnas incorrectas', modo === '1d' ? '—' : String(cm)], ['sobrecosto', modo === '1d' ? `${F} bits de ${F * K}` : `${F + K + 1} bits de ${F * K}`]]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), j = Math.floor((x - geo.x0) / geo.cw), i = Math.floor((y - geo.y0) / 34);
      if (i >= 0 && i < F && j >= 0 && j < K) { datos[i][j] ^= 1; dibujar(); }
    });
    nuevo();
  }

  function montarCRC(cuerpo) {
    let datos = '1101011011', gen = '10011', flips = '';
    const GENS = [['10011', 'x⁴ + x + 1 (r = 4)'], ['1101', 'x³ + x² + 1 (r = 3)'], ['100000111', 'CRC-8 (x⁸ + x² + x + 1)']];
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Datos (bits)', valor: datos, alCambiar: (v) => { datos = v.replace(/[^01]/g, '').slice(0, 24); dibujar(); } });
    ctl.selector({ etiqueta: 'Generador G', opciones: GENS.map(([v, t]) => [v, t]), valor: gen, alCambiar: (v) => { gen = v; dibujar(); } });
    ctl.texto({ etiqueta: 'Posiciones a invertir (ej. 2,7)', valor: flips, alCambiar: (v) => { flips = v; dibujar(); } });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'texto de bits con etiquetas';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El emisor agrega el resto R de dividir D·2ʳ entre G (módulo 2). El receptor divide la trama completa entre G: si el resto no es 0, hubo error. Invierta bits para probar (posiciones desde 1, separadas por comas).');
    function dibujar() {
      if (!datos) { registro.textContent = 'Escriba algunos bits de datos.'; return; }
      const R = VIZ.sor.crc(datos, gen), trama = datos + R;
      const pos = flips.split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= trama.length);
      const rx = trama.split('').map((b, i) => (pos.includes(i + 1) ? (b === '1' ? '0' : '1') : b)).join('');
      const resto = VIZ.sor.crc(rx.slice(0, datos.length), gen) !== rx.slice(datos.length) || false;
      // El resto de dividir toda la trama: equivale a que el CRC recalculado de los datos recibidos difiera del CRC recibido.
      const det = VIZ.sor.crc(rx.slice(0, datos.length), gen) !== rx.slice(datos.length);
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        [['datos D', datos], ['generador G', gen], ['r = grado de G', String(gen.length - 1)], ['CRC = resto de D·2ʳ / G', R], ['trama enviada (D + CRC)', trama], ['trama recibida', rx]].map(([k, v]) => el('tr', null, el('td', { class: 'izq' }, k), el('td', { style: { fontWeight: k.startsWith('trama r') && pos.length ? 600 : 400 } }, v)))));
      registro.textContent = !pos.length ? 'Sin errores: el receptor recalcula el CRC y coincide.' : det ? `El receptor detecta el error: el CRC recalculado no coincide con el recibido (${pos.length} bit(s) invertidos).` : `¡Error no detectado! Los ${pos.length} bit(s) invertidos forman un múltiplo de G, y el CRC no lo ve.`;
      void resto;
      lectura.set([['longitud de la trama', `${trama.length} bits`], ['bits alterados', String(pos.length)], ['veredicto', !pos.length ? 'sin error' : det ? 'detectado' : 'no detectado'], ['garantía', `ráfagas de hasta ${gen.length - 1} bits`]]);
    }
    dibujar();
  }

  VIZ.registrarTema('error-detection-crc', {
    intro: String.raw`
      <p>Un ruido eléctrico puede cambiar bits de una trama durante su paso por el enlace. La capa de enlace agrega <strong>bits de redundancia</strong> que permiten al receptor <em>detectar</em> (y a veces <em>corregir</em>) el daño. A más redundancia, mayor protección, pero también mayor sobrecosto.</p>
      <p>Tres técnicas de complejidad creciente: la <strong>paridad</strong> (un bit), la <strong>suma de verificación</strong> (Internet) y el <strong>CRC</strong> (<em>cyclic redundancy check</em>), que es el que usa Ethernet.</p>`,
    visualizaciones: [
      { titulo: 'Paridad simple y bidimensional', descripcion: 'Invierta un bit: con paridad 2D se ubica y corrige. Invierta dos en la misma fila (con 1D no se detecta) o cuatro en un rectángulo.', montar: montarParidad },
      { titulo: 'CRC: división módulo 2', descripcion: 'Calcule el CRC de unos datos, invierta bits de la trama e intente engañar al código. Pruebe ráfagas más largas que el grado del generador.', montar: montarCRC },
    ],
    teoria: String.raw`
      <h2>Paridad</h2>
      <p>Un bit de paridad par hace que el número de unos sea par; detecta cualquier número <em>impar</em> de errores, pero no los pares. La paridad bidimensional agrega un bit por fila y por columna: detecta todos los errores de 1, 2 y 3 bits y corrige los de 1 bit.</p>
      <h2>Suma de verificación de Internet</h2>
      <p>Se suman las palabras de 16 bits en complemento a uno y se envía el complemento de la suma. Es barata de calcular en software (por eso la usan IP, TCP y UDP), pero más débil que un CRC.</p>
      <h2>CRC</h2>
      <p>Se ven los bits como los coeficientes de un polinomio en \(\mathbb{Z}_2[x]\). Con un generador \(G(x)\) de grado \(r\), el emisor calcula</p>
      \[ R(x) = \bigl(D(x)\cdot x^{r}\bigr) \bmod G(x), \qquad T(x) = D(x)\,x^r + R(x), \]
      <p>de modo que \(T(x)\) es divisible por \(G(x)\). El receptor divide \(T'(x)\) entre \(G(x)\): resto nulo ⇒ se acepta. Un error \(E(x)\) pasa inadvertido solo si \(G(x)\) divide a \(E(x)\). Por eso un CRC de \(r\) bits detecta:</p>
      <ul><li>todos los errores de un bit (si \(G\) tiene al menos dos términos);</li><li>todas las <em>ráfagas</em> de longitud \(\le r\);</li><li>la fracción \(1 - 2^{-r}\) de las ráfagas más largas.</li></ul>
      <p>La división módulo 2 es solo XOR y desplazamientos, fácil de hacer en hardware. La detección es el paso previo a la corrección: si el código solo detecta, la capa de enlace descarta la trama y los protocolos de <a href="tema.html?id=reliable-transfer">transferencia fiable</a> piden retransmitirla. Ver el <a href="tema.html?id=ethernet-switching">formato de la trama Ethernet</a>, que termina con un CRC de 32 bits.</p>`,
  });
})();
