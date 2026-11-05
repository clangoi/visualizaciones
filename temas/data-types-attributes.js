(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;

  const TIPOS = [['cat', 'categórico'], ['ord', 'ordinal'], ['cuant', 'cuantitativo']];
  const ATR = [
    { n: 'Comuna', ej: 'Ñuñoa, Maipú, Puente Alto', t: 'cat', por: 'Son nombres: no hay orden ni distancia entre ellos.' },
    { n: 'Nivel educativo', ej: 'básica, media, superior', t: 'ord', por: 'Tiene un orden natural, pero la distancia entre niveles no es medible.' },
    { n: 'Temperatura (°C)', ej: '12,5 · 18,0 · 31,2', t: 'cuant', por: 'Se puede restar (diferencias con sentido); es una escala de intervalo.' },
    { n: 'Talla de ropa', ej: 'S, M, L, XL', t: 'ord', por: 'Ordenadas, aunque no sepamos cuánto más grande es cada una.' },
    { n: 'Código postal', ej: '8320000, 7500000', t: 'cat', por: 'Es un número, pero sumarlos o promediarlos no tiene sentido: es un identificador.' },
    { n: 'Ingreso mensual', ej: '450 000 · 1 200 000', t: 'cuant', por: 'Cantidad con cero real: se pueden hacer razones (el doble, la mitad).' },
    { n: 'Opinión (1 a 5)', ej: '1, 2, 3, 4, 5', t: 'ord', por: 'Numérica solo en apariencia: la distancia entre 1 y 2 no tiene por qué igualar la de 4 a 5.' },
  ];

  /* ---------- Fig. 1: clasifique los atributos ---------- */

  function montarClasificar(cuerpo) {
    const resp = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Revisar', revisar, { primario: true });
    ctl.boton('Borrar respuestas', () => { ATR.forEach((a, i) => { resp[i] = ''; sels[i].value = ''; }); revisar(true); });
    const sels = ATR.map((a, i) => { const s = el('select', null, el('option', { value: '' }, '— elija —'), TIPOS.map(([v, t]) => el('option', { value: v }, t))); s.addEventListener('change', () => { resp[i] = s.value; }); return s; });
    const celdasRes = ATR.map(() => el('td', { class: 'izq' }));
    const tabla = el('table', { class: 'tabla-datos texto' }, el('tr', null, ['Atributo', 'Valores de ejemplo', 'Tipo', 'Resultado'].map((t) => el('th', null, t))),
      ATR.map((a, i) => el('tr', null, el('td', { class: 'izq' }, a.n), el('td', { class: 'izq' }, a.ej), el('td', null, sels[i]), celdasRes[i])));
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    cuerpo.dataset.sinLeyenda = 'tabla de ejercicio sin color con significado';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Clasifique cada atributo y pulse «Revisar». Fíjese en los que parecen numéricos pero no lo son.');
    function revisar(limpio) {
      let ok = 0, hechos = 0;
      ATR.forEach((a, i) => {
        const r = sels[i].value;
        celdasRes[i].textContent = limpio === true || !r ? '' : r === a.t ? `✓ ${a.por}` : `✗ Es ${TIPOS.find((t) => t[0] === a.t)[1]}. ${a.por}`;
        if (r && limpio !== true) { hechos++; if (r === a.t) ok++; }
      });
      registro.textContent = limpio === true ? 'Elija un tipo para cada atributo.' : `${ok} de ${ATR.length} correctos (${hechos} respondidos).`;
    }
    revisar(true);
  }

  /* ---------- Fig. 2: qué operaciones tienen sentido ---------- */

  const ESCALAS = [
    ['nominal', 'Nominal (categórico)', [1, 0, 0, 0], 'sexo, comuna', 'moda, conteo'],
    ['ordinal', 'Ordinal', [1, 1, 0, 0], 'talla, nivel educativo', 'mediana, percentiles'],
    ['intervalo', 'Intervalo', [1, 1, 1, 0], 'temperatura en °C, año calendario', 'media, desviación'],
    ['razon', 'Razón', [1, 1, 1, 1], 'ingreso, longitud, temperatura en K', 'media geométrica, razones'],
  ];

  function montarEscalas(cuerpo) {
    let esc = 'intervalo', t1 = 10, t2 = 20, unidad = 'C';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de escala', valor: esc, opciones: ESCALAS.map((e) => [e[0], e[1]]), alCambiar: (v) => { esc = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Temperatura A', min: -10, max: 40, valor: t1, formato: (v) => `${v} °C`, alCambiar: (v) => { t1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Temperatura B', min: -10, max: 40, valor: t2, formato: (v) => `${v} °C`, alCambiar: (v) => { t2 = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Expresar en', valor: unidad, opciones: [['C', 'grados Celsius'], ['K', 'kelvin']], alCambiar: (v) => { unidad = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 420 : 280) });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'operación con sentido' }, { color: C.s8, texto: 'sin sentido en esa escala' }, { color: C.s1, texto: 'valor A' }, { color: C.s2, texto: 'valor B' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'A la izquierda, las operaciones válidas por tipo de escala. A la derecha, dos temperaturas: ¿es B «el doble» de A? La razón cambia al cambiar de unidad, lo que muestra que la temperatura en °C no es de razón.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancho = W < 560, pw = ancho ? W : W * 0.5;
      const ops = ['igualdad (=, ≠)', 'orden (<, >)', 'diferencia (+, −)', 'razón (×, ÷)'];
      const fila = ESCALAS.find((e) => e[0] === esc);
      V.rotulo(ctx, `Escala ${fila[1]}`, 12, 16, { peso: 700, tam: 12, color: C.tinta });
      ops.forEach((o, i) => { const y = 42 + i * 34, ok = fila[2][i]; ctx.fillStyle = VIZ.alfa(ok ? C.s6 : C.s8, 0.15); ctx.strokeStyle = ok ? C.s6 : C.s8; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(12, y - 12, pw - 24, 28, 4); ctx.fill(); ctx.stroke(); V.rotulo(ctx, `${ok ? '✓' : '✗'} ${o}`, 22, y + 2, { tam: 12, color: C.tinta, peso: 600 }); });
      V.rotulo(ctx, `Ejemplos: ${fila[3]}`, 12, 190, { tam: 11, color: C.tinta2 }); V.rotulo(ctx, `Resumen: ${fila[4]}`, 12, 208, { tam: 11, color: C.tinta2 });
      // panel derecho: las dos temperaturas
      const ox = ancho ? 0 : pw, oy = ancho ? 236 : 0, ww = ancho ? W : W - pw, hh = ancho ? H - 236 : H;
      const A = unidad === 'C' ? t1 : t1 + 273.15, B = unidad === 'C' ? t2 : t2 + 273.15, cero = unidad === 'C' ? 0 : 0;
      const maxv = Math.max(Math.abs(A), Math.abs(B), 1) * 1.15, minv = Math.min(0, A, B);
      const base = oy + hh - 40, top = oy + 28, sy = V.lin(Math.min(0, minv), maxv, base, top);
      V.rotulo(ctx, `Eje en ${unidad === 'C' ? '°C' : 'K'} (cero ${unidad === 'C' ? 'convencional' : 'absoluto'})`, ox + 14, oy + 14, { peso: 700, tam: 11, color: C.tinta });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(ox + 20, sy(cero) + 0.5); ctx.lineTo(ox + ww - 20, sy(cero) + 0.5); ctx.stroke();
      [[A, C.s1, 'A'], [B, C.s2, 'B']].forEach(([v, col, n], i) => { const x = ox + ww * (0.3 + i * 0.4) - 20; ctx.fillStyle = col; const y = sy(v), y0 = sy(cero); ctx.fillRect(x, Math.min(y, y0), 40, Math.abs(y - y0)); V.rotulo(ctx, `${n} = ${VIZ.fmt(v, 5)}`, x + 20, base + 22, { alinear: 'center', tam: 11, color: C.tinta }); });
      const razon = B / A;
      registro.textContent = A === 0 || !isFinite(razon) ? 'La razón no está definida (A = 0).' : `B ÷ A = ${VIZ.fmt(razon, 4)} en ${unidad === 'C' ? '°C' : 'K'}. ${unidad === 'C' ? 'Esa razón cambia si se expresa en kelvin: no tiene significado físico.' : 'En kelvin el cero es absoluto y la razón sí tiene significado.'}`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('data-types-attributes', {
    intro: String.raw`
      <p>Antes de dibujar hay que saber <em>qué clase de dato</em> se tiene. Una tabla está formada por <strong>ítems</strong> (las filas) y <strong>atributos</strong> (las columnas), y cada atributo es de un tipo: <strong>categórico</strong>, <strong>ordinal</strong> o <strong>cuantitativo</strong>.</p>
      <p>El tipo no siempre es el que parece: un código postal es un número pero no se puede promediar. Clasificar bien decide qué canales visuales y qué operaciones son legítimas.</p>`,
    visualizaciones: [
      { titulo: 'Clasifique siete atributos', descripcion: 'Elija el tipo de cada atributo y revise; cada respuesta incluye la razón.', montar: montarClasificar },
      { titulo: 'Qué operaciones tienen sentido', descripcion: 'Recorra las cuatro escalas y compruebe con la temperatura por qué la razón no es válida en °C.', montar: montarEscalas },
    ],
    teoria: String.raw`
      <h2>Tipos de atributo</h2>
      <table>
        <tr><th>Tipo</th><th>Característica</th><th>Ejemplo</th><th>Canales recomendados</th></tr>
        <tr><td>categórico</td><td>sin orden</td><td>comuna, color de ojos</td><td>tono, forma, región espacial</td></tr>
        <tr><td>ordinal</td><td>con orden, sin distancia</td><td>talla, nivel educativo</td><td>posición, luminancia (pocos niveles)</td></tr>
        <tr><td>cuantitativo</td><td>con orden y distancia</td><td>temperatura, ingreso</td><td>posición, longitud, tamaño</td></tr>
      </table>
      <h2>Escalas de medición</h2>
      <p>Stevens las clasificó por las transformaciones que las conservan: nominal (cualquier biyección), ordinal (cualquier función creciente), intervalo (\(x \mapsto ax + b\)) y razón (\(x \mapsto ax\)). En la de intervalo, el cero es convencional: 0 °C no es «ausencia de temperatura». Por eso
      \[ \frac{20\,°\text{C}}{10\,°\text{C}} = 2 \quad\text{pero}\quad \frac{293{,}15\,\text{K}}{283{,}15\,\text{K}} \approx 1{,}035. \]
      Solo se puede dar sentido a la razón si el cero es absoluto.</p>
      <h2>Orden: secuencial, divergente, cíclico</h2>
      <p>Un atributo ordenado puede ser <em>secuencial</em> (de mínimo a máximo), <em>divergente</em> (con un punto medio significativo, como cero) o <em>cíclico</em> (hora del día, mes: el último vuelve al primero). El orden decide la rampa de color o la forma del eje.</p>
      <h2>Ítems y atributos</h2>
      <p>Los ítems son entidades discretas (una comuna, un cliente); los atributos son propiedades que se miden en ellos. Un <em>valor</em> es la intersección de un ítem y un atributo. Ver cómo se organizan según <a href="tema.html?id=dataset-types">tipos de conjuntos de datos</a> y cómo se eligen los canales en <a href="tema.html?id=marks-and-channels">marcas y canales</a>.</p>`,
  });
})();
