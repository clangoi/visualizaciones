(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  // Hash de juguete de 32 bits (FNV-1a con mezcla final), para mostrar el ataque sin criptografía real.
  function h32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  // Dígito verificador del RUT (módulo 11).
  function dv(n) {
    let s = 0, m = 2;
    for (let x = n; x > 0; x = Math.floor(x / 10)) { s += (x % 10) * m; m = m === 7 ? 2 : m + 1; }
    const r = 11 - (s % 11);
    return r === 11 ? '0' : r === 10 ? 'K' : String(r);
  }
  const rutNum = (r) => parseInt(r.replace(/\./g, '').split('-')[0], 10);
  // Formato con puntos sin toLocaleString, que es lento dentro del ciclo del ataque.
  const rutTexto = (n) => `${String(n).replace(/\B(?=(\d{3})+$)/g, '.')}-${dv(n)}`;
  const normalizar = (r) => { const n = rutNum(r); return Number.isFinite(n) && n > 0 ? rutTexto(n) : r.trim(); };
  const sup = (v) => String(v).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');

  /* ---------- Fig. 1: técnicas por columna ---------- */

  function montarTecnicas(cuerpo) {
    const R0 = B.clinicos();
    const o = { nombre: 'suprimir', rut: 'hash', cp: 'generalizar', edad: 'generalizar', sexo: 'conservar' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'nombre', valor: o.nombre, opciones: [['conservar', 'conservar'], ['suprimir', 'suprimir'], ['iniciales', 'enmascarar (iniciales)']], alCambiar: (v) => { o.nombre = v; dibujar(); } });
    ctl.selector({ etiqueta: 'rut', valor: o.rut, opciones: [['conservar', 'conservar'], ['suprimir', 'suprimir'], ['mascara', 'enmascarar dígitos'], ['hash', 'seudónimo: hash'], ['token', 'seudónimo: token aleatorio']], alCambiar: (v) => { o.rut = v; dibujar(); } });
    ctl.selector({ etiqueta: 'cp', valor: o.cp, opciones: [['conservar', 'conservar'], ['generalizar', 'generalizar a 3 dígitos'], ['suprimir', 'suprimir']], alCambiar: (v) => { o.cp = v; dibujar(); } });
    ctl.selector({ etiqueta: 'edad', valor: o.edad, opciones: [['conservar', 'conservar'], ['generalizar', 'tramos de 10 años'], ['suprimir', 'suprimir']], alCambiar: (v) => { o.edad = v; dibujar(); } });
    ctl.selector({ etiqueta: 'sexo', valor: o.sexo, opciones: [['conservar', 'conservar'], ['suprimir', 'suprimir']], alCambiar: (v) => { o.sexo = v; dibujar(); } });
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s8, 0.18), texto: 'fila única según cp, edad y sexo publicados' },
      { color: VIZ.alfa(C.s4, 0.18), texto: 'columna transformada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Quitar el nombre y el RUT no basta: mire cuántas filas siguen siendo únicas por sus cuasi-identificadores hasta que generalice.');
    const tokens = R0.filas.map((_, i) => `P-${(7919 * (i + 3)) % 9973}`);
    function transformar() {
      const atr = R0.atributos.filter((a) => a !== 'canal' && o[a] !== 'suprimir');
      return B.rel('Publicada', atr, R0.filas.map((f, i) => Object.fromEntries(atr.map((a) => {
        const v = f[a], m = o[a];
        if (a === 'nombre') return [a, m === 'iniciales' ? v.split(' ').map((p) => p[0] + '.').join(' ') : v];
        if (a === 'rut') return [a, m === 'mascara' ? `${v.slice(0, 2)}.***.***-${v.slice(-1)}` : m === 'hash' ? h32(v) : m === 'token' ? tokens[i] : v];
        if (a === 'cp' && m === 'generalizar') return [a, B.generalizar('cp', v, 1)];
        if (a === 'edad' && m === 'generalizar') return [a, B.generalizar('edad', v, 2)];
        return [a, v];
      }))));
    }
    function dibujar() {
      const T = transformar();
      const cis = ['cp', 'edad', 'sexo'].filter((a) => T.atributos.includes(a));
      const cl = cis.length ? B.clases(T, cis) : [{ indices: T.filas.map((_, i) => i) }];
      const unica = new Set(cl.filter((c) => c.indices.length === 1).flatMap((c) => c.indices));
      caja.replaceChildren(B.tabla(T, { fila: (f, i) => (unica.has(i) ? C.s8 : null), celda: (f, a, i) => (!unica.has(i) && o[a] && o[a] !== 'conservar' ? C.s4 : null) }));
      const directo = T.atributos.includes('nombre') && o.nombre === 'conservar' || (T.atributos.includes('rut') && o.rut === 'conservar');
      const reversible = o.rut === 'hash' ? 'El hash del RUT es determinista: quien tenga una lista de RUT puede calcular los hashes y revertirlo (figura 2).'
        : o.rut === 'token' ? 'El token aleatorio solo se revierte con la tabla de correspondencia, que debe guardarse aparte: es una seudonimización.'
          : o.rut === 'mascara' ? 'Enmascarar deja visibles algunos dígitos; con otros datos, el resto se adivina.' : '';
      registro.textContent = (directo ? 'La tabla conserva identificadores explícitos: no está de-identificada. ' : '') +
        `${unica.size} de ${T.filas.length} filas son únicas por sus cuasi-identificadores. ` + reversible;
      lectura.set([
        ['filas únicas', String(unica.size)],
        ['k mínimo', String(Math.min(...cl.map((c) => c.indices.length)))],
        ['columnas publicadas', String(T.atributos.length)],
        ['¿datos personales?', directo || unica.size || o.rut === 'hash' || o.rut === 'token' ? 'sí (seudonimizados o identificables)' : 'riesgo menor'],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: revertir un hash de RUT ---------- */

  function montarFuerzaBruta(cuerpo) {
    let rut = rutTexto(15111222), sal = false, rango = 'decada', resultado = null;
    const SAL = 'k9#Qz!';
    const RANGOS = { decada: [14000000, 16000000, 'nacidos entre 1982 y 1987 (~2 millones)'], todos: [1000000, 26000000, 'todos los RUT de personas (~25 millones)'] };
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'RUT de la víctima', valor: rut, alCambiar: (v) => { rut = v; resultado = null; dibujar(); } });
    ctl.selector({ etiqueta: 'Espacio que prueba el atacante', valor: rango, opciones: Object.entries(RANGOS).map(([k, v]) => [k, v[2]]), alCambiar: (v) => { rango = v; resultado = null; dibujar(); } });
    ctl.casilla({ etiqueta: 'hash con clave secreta (HMAC)', valor: sal, alCambiar: (v) => { sal = v; resultado = null; dibujar(); } });
    ctl.boton('Atacar', () => atacar(), { primario: true });
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.36, altoMin: 220, altoMax: 300 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'tiempo con 10⁹ hashes por segundo (una GPU)', forma: 'linea' },
      { color: C.s1, texto: 'tiempo con 10⁶ hashes por segundo (un núcleo)', forma: 'linea' },
      { color: C.tinta, texto: 'espacio de RUT de personas', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Atacar»: el navegador recorre de verdad los RUT del rango y compara hashes. Luego active la clave secreta.');
    const seudonimo = () => (sal ? h32(SAL + normalizar(rut)) : h32(normalizar(rut)));
    function atacar() {
      const [a, b] = RANGOS[rango], objetivo = seudonimo(), t0 = performance.now();
      let encontrado = null, intentos = 0;
      for (let n = a; n < b; n++) {
        intentos++;
        if (h32(rutTexto(n)) === objetivo) { encontrado = rutTexto(n); break; }
      }
      resultado = { encontrado, intentos, ms: performance.now() - t0 };
      dibujar();
    }
    function dibujar() {
      codigo.textContent = `rut = ${normalizar(rut)}\nseudónimo publicado = ${sal ? 'HMAC(clave, rut)' : 'hash(rut)'} = ${seudonimo()}`;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 3, xmax: 15, ymin: -6, ymax: 9 }, {
        etiquetaX: 'candidatos que hay que probar', etiquetaY: 'tiempo (escala log)', ticksX: [3, 6, 9, 12, 15], formatoX: (v) => `10${sup(v)}`,
        ticksY: [-6, -3, 0, 3, 6, 9], margen: { izq: 66 }, formatoY: (v) => ({ '-6': '1 µs', '-3': '1 ms', 0: '1 s', 3: '17 min', 6: '12 días', 9: '32 años' }[v]),
      });
      plano.ejes();
      for (const [rate, c] of [[9, C.s2], [6, C.s1]]) VIZ.trazar(ctx, plano, [[3, 3 - rate], [15, 15 - rate]], c, 2);
      const x = Math.log10(2.5e7);
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.sx(x), plano.y0); ctx.lineTo(plano.sx(x), plano.y1); ctx.stroke(); ctx.setLineDash([]);
      VIZ.marcador(ctx, plano.sx(x), plano.sy(x - 9), C.tinta, 5);
      VIZ.marcador(ctx, plano.sx(x), plano.sy(x - 6), C.tinta, 5);
      B.texto(ctx, 'RUT: 2,5·10⁷', plano.sx(x) + 6, plano.y1 + 8, { px: 10, color: C.apagado });
      B.texto(ctx, 'con clave de 128 bits: 10³⁸ candidatos →', plano.x1 - 4, plano.sy(-5), { alinear: 'right', px: 10, color: C.apagado });
      registro.textContent = !resultado ? `El atacante conoce el seudónimo ${seudonimo()} y quiere el RUT.`
        : resultado.encontrado ? `Encontrado tras ${VIZ.entero(resultado.intentos)} intentos en ${VIZ.fmt(resultado.ms / 1000, 3)} s: el seudónimo corresponde a ${resultado.encontrado}.`
          : sal ? `Probó ${VIZ.entero(resultado.intentos)} RUT en ${VIZ.fmt(resultado.ms / 1000, 3)} s sin éxito: sin la clave secreta, los hashes no coinciden. Habría que adivinar la clave.`
            : `Probó ${VIZ.entero(resultado.intentos)} RUT sin encontrarlo: la víctima está fuera del rango elegido. Pruebe con todos los RUT.`;
      const [a, b] = RANGOS[rango];
      lectura.set([
        ['candidatos en el rango', VIZ.entero(b - a)],
        ['intentos', resultado ? VIZ.entero(resultado.intentos) : '—'],
        ['tiempo medido', resultado ? `${VIZ.fmt(resultado.ms / 1000, 3)} s` : '—'],
        ['hashes por segundo aquí', resultado ? VIZ.fmt(resultado.intentos / (resultado.ms / 1000), 2) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('de-identificacion', {
    intro: String.raw`
      <p><strong>De-identificar</strong> es quitar o transformar los datos que vinculan un registro con una persona. Es el primer paso antes
      de compartir datos para investigación o análisis, y tiene varias herramientas: suprimir columnas, enmascarar parte de un valor,
      reemplazar identificadores por <strong>seudónimos</strong> y generalizar valores precisos.</p>
      <p>Es importante distinguir. Una tabla <em>seudonimizada</em> sigue conteniendo datos personales: quien tenga la llave (o pueda
      reconstruirla) recupera las identidades. Solo cuando la vinculación es razonablemente imposible se habla de datos
      <a href="tema.html?id=anonimizacion">anonimizados</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Técnicas por columna',
        descripcion: 'Aplique una técnica a cada columna de la tabla clínica. Las filas en rojo siguen siendo únicas por sus cuasi-identificadores, aunque no tengan nombre.',
        montar: montarTecnicas,
      },
      {
        titulo: 'Revertir un hash de RUT',
        descripcion: 'Un hash parece irreversible, pero el espacio de RUT es pequeño: basta calcular el hash de cada candidato. Con una clave secreta (HMAC) el ataque deja de funcionar.',
        montar: montarFuerzaBruta,
      },
    ],
    teoria: String.raw`
      <h2>Técnicas</h2>
      <table>
        <tr><th>Técnica</th><th>Ejemplo</th><th>¿Reversible?</th></tr>
        <tr><td>supresión</td><td>eliminar la columna nombre</td><td>no</td></tr>
        <tr><td>enmascaramiento</td><td>12.***.***-5</td><td>parcialmente</td></tr>
        <tr><td>seudonimización con hash</td><td>\(h(\text{rut})\)</td><td>sí, por fuerza bruta si el espacio es pequeño</td></tr>
        <tr><td>seudonimización con clave</td><td>\(\text{HMAC}_k(\text{rut})\) o token aleatorio</td><td>solo con la clave o la tabla de tokens</td></tr>
        <tr><td>generalización</td><td>edad 28 → 20–29</td><td>no</td></tr>
        <tr><td>perturbación</td><td>edad + ruido</td><td>no, pero distorsiona</td></tr>
      </table>

      <h2>Por qué falla el hash</h2>
      <p>Una función de hash criptográfica es difícil de invertir cuando la entrada es impredecible. Un RUT no lo es: los de personas
      naturales están entre 1 y unos 27 millones, y el dígito verificador se calcula. Con \(|\mathcal X|\) candidatos y \(v\) hashes por
      segundo, el tiempo es \(|\mathcal X| / v\): \(2{,}5\cdot10^7 / 10^9 \approx 0{,}025\) s en una GPU. Lo mismo pasa con teléfonos,
      patentes de autos o correos de una empresa.</p>
      <div class="recuadro">La solución es una <strong>clave secreta</strong>: \(\text{HMAC}_k(x)\) con \(k\) de 128 bits obliga a
      probar \(2^{128} \approx 3\cdot10^{38}\) claves. El seudónimo sigue siendo estable (sirve para unir tablas), pero solo quien custodia
      \(k\) puede reproducirlo. La clave se guarda separada de los datos.</div>

      <h2>Lo que la de-identificación no resuelve</h2>
      <p>Quitar identificadores explícitos no protege de la combinación de cuasi-identificadores: la tabla de la figura 1, sin nombre ni RUT,
      sigue teniendo filas únicas por código postal, edad y sexo, que un atacante puede cruzar con un registro público
      (<a href="tema.html?id=re-identificacion">re-identificación</a>). Para eso existen modelos con garantías: el
      <a href="tema.html?id=k-anonimato">k-anonimato</a> y la <a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a>.</p>`,
  });
})();
