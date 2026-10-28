(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  // Cuasi-identificadores de una población simulada y su número de valores posibles.
  const ATRIBUTOS = [
    { clave: 'sexo', texto: 'sexo', valores: 2 },
    { clave: 'anio', texto: 'año de nacimiento', valores: 70 },
    { clave: 'dia', texto: 'día y mes de nacimiento', valores: 365 },
    { clave: 'comuna', texto: 'comuna (346)', valores: 346 },
  ];

  // Población con distribuciones no uniformes: edades con más jóvenes y comunas de tamaño muy desigual (tipo Zipf).
  function poblacion(n, semilla) {
    const rnd = VIZ.semilla(semilla);
    const pesos = Array.from({ length: 346 }, (_, i) => 1 / (i + 1) ** 0.9);
    const acum = []; pesos.reduce((s, w, i) => (acum[i] = s + w), 0);
    const total = acum[acum.length - 1];
    const comuna = () => { const u = rnd() * total; let lo = 0, hi = acum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (acum[m] < u) lo = m + 1; else hi = m; } return lo; };
    return Array.from({ length: n }, () => ({
      sexo: rnd() < 0.5 ? 0 : 1,
      anio: Math.min(69, Math.floor(Math.abs(VIZ.normal(rnd)) * 25)),
      dia: Math.floor(rnd() * 365),
      comuna: comuna(),
    }));
  }

  function montarUnicidad(cuerpo) {
    let logN = 4, semilla = 1, elegidos = { sexo: true, anio: true, dia: true, comuna: true }, hover = null, pob = null, nPob = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(ATRIBUTOS.map((a) => ({ clave: a.clave, texto: a.texto, activo: elegidos[a.clave] })), (e) => { elegidos = e; dibujar(); });
    ctl.rango({ etiqueta: 'Tamaño de la población', min: 2, max: 5.3, paso: 0.1, valor: logN, formato: (v) => VIZ.entero(10 ** v), alCambiar: (v) => { logN = v; dibujar(); } });
    ctl.boton('Nueva población', () => { semilla++; pob = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'esperado si los valores fueran uniformes', forma: 'linea' },
      { color: C.s2, texto: 'medido en la población simulada', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija qué atributos conoce el atacante y el tamaño de la población. Con fecha de nacimiento completa, sexo y comuna, casi todos quedan únicos.');
    const M = () => ATRIBUTOS.filter((a) => elegidos[a.clave]).reduce((p, a) => p * a.valores, 1);
    const esperado = (n, m) => (m <= 1 ? 0 : Math.pow(1 - 1 / m, n - 1));
    function medir(n) {
      if (!pob || nPob !== n) { pob = poblacion(n, semilla); nPob = n; }
      const claves = ATRIBUTOS.filter((a) => elegidos[a.clave]).map((a) => a.clave);
      if (!claves.length) return { unicos: 0, clases: 1, n };
      const m = new Map();
      for (const p of pob) { const k = claves.map((c) => p[c]).join(','); m.set(k, (m.get(k) || 0) + 1); }
      let unicos = 0; for (const v of m.values()) if (v === 1) unicos++;
      return { unicos, clases: m.size, n };
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const n = Math.round(10 ** logN), m = M();
      plano = VIZ.plano(lienzo, { xmin: 2, xmax: 7, ymin: 0, ymax: 100 }, {
        etiquetaX: 'personas en la población', etiquetaY: '% de personas únicas', ticksX: [2, 3, 4, 5, 6, 7], formatoX: (v) => VIZ.entero(10 ** v),
      });
      plano.ejes();
      const pts = [];
      for (let e = 2; e <= 7.0001; e += 0.02) pts.push([e, 100 * esperado(10 ** e, m)]);
      VIZ.trazar(ctx, plano, pts, C.s1, 2);
      const r = medir(n);
      VIZ.marcador(ctx, plano.sx(logN), plano.sy((100 * r.unicos) / n), C.s2, 6);
      if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(100 * esperado(10 ** hover, m)), C.s1, 4);
      lectura.set([
        ['combinaciones posibles', VIZ.entero(m)],
        ['únicos medidos', `${VIZ.fmt((100 * r.unicos) / n, 3)} %`],
        ['únicos esperados (uniforme)', `${VIZ.fmt(100 * esperado(n, m), 3)} %`],
        ['tamaño medio de grupo', VIZ.fmt(n / r.clases, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = plano.ix(x); dibujar();
      tip.mostrar(x, y, `${VIZ.entero(10 ** hover)} personas<br>únicos esperados: <b>${VIZ.fmt(100 * esperado(10 ** hover, M()), 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('privacidad', {
    intro: String.raw`
      <p>La <strong>privacidad de datos</strong> estudia cómo usar y publicar información sobre personas sin exponerlas. El problema no es
      solo proteger la base de accesos indebidos (eso es <a href="tema.html?id=seguridad">seguridad</a>): también hay que decidir qué se
      puede revelar a quien sí tiene acceso, como un investigador, un socio comercial o el público.</p>
      <p>La intuición ingenua es que basta con quitar nombres y RUT. No basta: unos pocos atributos inocentes en combinación identifican a
      casi todos. Latanya Sweeney mostró en 2000 que el 87 % de la población de Estados Unidos queda única con solo código postal, fecha de
      nacimiento y sexo, y re-identificó así la ficha médica del gobernador de Massachusetts.</p>`,
    visualizaciones: [
      {
        titulo: '¿Cuántos quedan únicos?',
        descripcion: 'Una población simulada con sexo, fecha de nacimiento y comuna. Combine atributos y vea qué fracción de personas es la única con esos valores, es decir, identificable.',
        montar: montarUnicidad,
      },
    ],
    teoria: String.raw`
      <h2>Por qué los atributos se combinan</h2>
      <p>Si una combinación de atributos admite \(M\) valores igualmente probables y hay \(n\) personas, la probabilidad de que una persona
      dada no comparta su combinación con nadie es</p>
      \[ \Pr[\text{única}] = \left(1 - \frac{1}{M}\right)^{n-1} \approx e^{-n/M}. \]
      <p>Con sexo (2), fecha de nacimiento (~25 000 fechas en 70 años) y comuna (346), \(M \approx 1{,}7 \cdot 10^7\). En una región de un
      millón de personas, \(e^{-0{,}06} \approx 94\,\%\) son únicas. En la realidad las distribuciones no son uniformes: en las comunas
      grandes hay más colisiones, y en las pequeñas casi nadie comparte nada.</p>

      <h2>Vocabulario</h2>
      <table>
        <tr><th>Término</th><th>Significado</th><th>Tema</th></tr>
        <tr><td>identificador explícito</td><td>identifica solo (nombre, RUT, correo)</td><td><a href="tema.html?id=tipos-atributos">tipos de atributos</a></td></tr>
        <tr><td>cuasi-identificador</td><td>identifica en combinación (edad, comuna, sexo)</td><td><a href="tema.html?id=tipos-atributos">tipos de atributos</a></td></tr>
        <tr><td>de-identificación</td><td>quitar o transformar identificadores</td><td><a href="tema.html?id=de-identificacion">de-identificación</a></td></tr>
        <tr><td>re-identificación</td><td>recuperar la identidad de un registro de-identificado</td><td><a href="tema.html?id=re-identificacion">re-identificación</a></td></tr>
        <tr><td>anonimización</td><td>de-identificación irreversible con garantías</td><td><a href="tema.html?id=anonimizacion">anonimización</a></td></tr>
      </table>

      <h2>Modelos de amenaza</h2>
      <p>Toda garantía de privacidad se define frente a un atacante: qué sabe de antemano (<em>conocimiento previo</em>), qué puede
      consultar y qué quiere aprender. Se distinguen tres riesgos:</p>
      <ul>
        <li><strong>Revelación de identidad</strong>: saber qué registro corresponde a una persona.</li>
        <li><strong>Revelación de atributo</strong>: saber el diagnóstico de una persona aunque no se sepa cuál es su fila (si todos los de su
        grupo tienen el mismo).</li>
        <li><strong>Revelación de pertenencia</strong>: saber que una persona está en la base (lo que ya puede ser sensible, como en un
        registro de pacientes oncológicos).</li>
      </ul>
      <div class="recuadro">Existe una tensión entre <strong>privacidad y utilidad</strong>: un conjunto de datos que no revela nada sobre
      nadie tampoco sirve para nada. Las técnicas de privacidad buscan un punto razonable de esa curva, y la
      <a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a> lo hace medible.</div>`,
  });
})();
