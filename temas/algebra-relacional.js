(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: operadores sobre tablas ---------- */

  // Cada operación devuelve { expr, entradas: [{ R, fila }], salida, texto }.
  function operaciones() {
    const { alumnos: A, cursos: Cu, inscripciones: I } = B.universidad();
    const esInf = (f) => f.carrera === 'Informática';
    const diez = B.proyectar(B.seleccionar(Cu, (f) => f.creditos === 10), ['sigla'], 'π sigla(σ creditos=10(Cursos))');
    const rolSigla = B.proyectar(I, ['rol', 'sigla'], 'π rol,sigla(Inscripciones)');
    const enBD = B.proyectar(B.seleccionar(I, (f) => f.sigla === 'IIC2413'), ['rol'], 'π rol(σ sigla=IIC2413)');
    const enPriv = B.proyectar(B.seleccionar(I, (f) => f.sigla === 'IIC3633'), ['rol'], 'π rol(σ sigla=IIC3633)');
    const conInscr = new Set(I.filas.map((f) => f.rol));
    return {
      seleccion: {
        expr: "σ carrera = 'Informática' (Alumnos)",
        entradas: [{ R: A, fila: (f) => (esInf(f) ? C.s6 : null) }],
        salida: B.seleccionar(A, esInf),
        texto: 'La selección filtra filas: conserva las que cumplen el predicado y mantiene todas las columnas.',
      },
      proyeccion: {
        expr: 'π carrera (Alumnos)',
        entradas: [{ R: A, celda: (f, a) => (a === 'carrera' ? C.s1 : null) }],
        salida: B.proyectar(A, ['carrera']),
        texto: 'La proyección conserva columnas y elimina los duplicados: seis alumnos, solo tres carreras.',
      },
      producto: {
        expr: 'Alumnos × Cursos',
        entradas: [{ R: A }, { R: Cu }],
        salida: B.producto(A, Cu),
        texto: 'El producto cartesiano combina cada fila de la izquierda con cada fila de la derecha: 6 · 4 = 24 filas.',
      },
      junta: {
        expr: 'Alumnos ⋈ Inscripciones',
        entradas: [{ R: A, fila: (f) => (conInscr.has(f.rol) ? C.s6 : C.s8) }, { R: I }],
        salida: B.juntar(A, I),
        texto: 'La junta natural iguala el atributo común rol. Elena (105) no tiene inscripciones y desaparece del resultado.',
      },
      union: {
        expr: 'π rol(σ sigla=IIC2413(I)) ∪ π rol(σ sigla=IIC3633(I))',
        entradas: [{ R: enBD }, { R: enPriv }],
        salida: B.union(enBD, enPriv, 'resultado'),
        texto: 'La unión exige esquemas compatibles y elimina duplicados: 103 y 106 aparecen en ambos lados, una sola vez en el resultado.',
      },
      interseccion: {
        expr: 'π rol(σ sigla=IIC2413(I)) ∩ π rol(σ sigla=IIC3633(I))',
        entradas: [{ R: enBD, fila: (f) => (enPriv.filas.some((g) => g.rol === f.rol) ? C.s6 : null) }, { R: enPriv }],
        salida: B.interseccion(enBD, enPriv, 'resultado'),
        texto: 'La intersección se puede escribir con diferencias: R ∩ S = R − (R − S).',
      },
      diferencia: {
        expr: 'π rol(Alumnos) − π rol(Inscripciones)',
        entradas: [{ R: B.proyectar(A, ['rol'], 'π rol(Alumnos)'), fila: (f) => (conInscr.has(f.rol) ? null : C.s6) },
          { R: B.proyectar(I, ['rol'], 'π rol(Inscripciones)') }],
        salida: B.diferencia(B.proyectar(A, ['rol']), B.proyectar(I, ['rol']), 'resultado'),
        texto: 'La diferencia expresa negación: alumnos que no aparecen en ninguna inscripción.',
      },
      division: {
        expr: 'π rol,sigla(I) ÷ π sigla(σ creditos=10(Cursos))',
        entradas: [{ R: rolSigla, fila: (f) => (f.rol === 106 && diez.filas.some((d) => d.sigla === f.sigla) ? C.s6 : null) }, { R: diez }],
        salida: B.division(rolSigla, diez, 'resultado'),
        texto: 'La división responde «para todo»: los alumnos inscritos en todos los cursos de 10 créditos. Solo 106 los tiene los tres.',
      },
      renombre: {
        expr: 'ρ Estudiante(id, alias, programa, año) (Alumnos)',
        entradas: [{ R: A }],
        salida: B.renombrar(A, { rol: 'id', nombre: 'alias', carrera: 'programa', ingreso: 'año' }, 'Estudiante'),
        texto: 'El renombre no cambia las filas: solo da nombres nuevos a la relación y a sus atributos, lo que hace falta para juntar una relación consigo misma.',
      },
    };
  }

  function montarOperadores(cuerpo) {
    const OPS = operaciones();
    let actual = 'seleccion';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Operador', valor: actual,
      opciones: [['seleccion', 'σ selección'], ['proyeccion', 'π proyección'], ['producto', '× producto'], ['junta', '⋈ junta natural'],
        ['union', '∪ unión'], ['interseccion', '∩ intersección'], ['diferencia', '− diferencia'], ['division', '÷ división'], ['renombre', 'ρ renombre']],
      alCambiar: (v) => { actual = v; dibujar(); },
    });
    const expr = VIZ.el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(expr);
    VIZ.subtitulo(cuerpo, 'Entradas');
    const entradas = B.grupoTablas(cuerpo);
    VIZ.subtitulo(cuerpo, 'Resultado');
    const salida = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.18), texto: 'filas que llegan al resultado' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 'filas sin pareja' },
      { color: VIZ.alfa(C.s1, 0.18), texto: 'columnas proyectadas' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un operador en el menú: cada uno muestra sus entradas, la expresión y el resultado.');
    function dibujar() {
      const op = OPS[actual];
      expr.textContent = op.expr;
      entradas.replaceChildren(...op.entradas.map((e) => B.tabla(e.R, { fila: e.fila, celda: e.celda })));
      salida.replaceChildren(B.tabla(op.salida, { titulo: 'resultado', maxFilas: 12 }));
      registro.textContent = op.texto;
      lectura.set([
        ...op.entradas.map((e, i) => [`filas entrada ${i + 1}`, String(e.R.filas.length)]),
        ['filas resultado', String(op.salida.filas.length)],
        ['grado resultado', String(op.salida.atributos.length)],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: árbol de consulta ---------- */

  function planes() {
    const { alumnos: A, cursos: Cu, inscripciones: I } = B.universidad();
    const hoja = (R) => ({ etiqueta: R.nombre, hijos: [], f: () => R });
    const nodo = (etiqueta, hijos, f) => ({ etiqueta, hijos, f });
    const bd = (f) => f.titulo === 'Bases de Datos', alta = (f) => f.nota >= 6;
    return {
      ingenuo: nodo('π nombre', [
        nodo('σ titulo=BD ∧ nota≥6', [
          nodo('⋈ sigla', [
            nodo('⋈ rol', [hoja(A), hoja(I)], (a, b) => B.juntar(a, b)),
            hoja(Cu)], (a, b) => B.juntar(a, b))],
        (a) => B.seleccionar(a, (f) => bd(f) && alta(f)))],
      (a) => B.proyectar(a, ['nombre'])),
      empujado: nodo('π nombre', [
        nodo('⋈ rol', [
          hoja(A),
          nodo('⋈ sigla', [
            nodo('σ nota≥6', [hoja(I)], (a) => B.seleccionar(a, alta)),
            nodo('σ titulo=BD', [hoja(Cu)], (a) => B.seleccionar(a, bd))], (a, b) => B.juntar(a, b))],
        (a, b) => B.juntar(a, b))],
      (a) => B.proyectar(a, ['nombre'])),
    };
  }

  function montarArbol(cuerpo) {
    let plan = 'ingenuo', raiz = null, actual = null, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Plan', valor: plan,
      opciones: [['ingenuo', 'juntar todo y luego filtrar'], ['empujado', 'selecciones empujadas hacia las hojas']],
      alCambiar: (v) => { plan = v; rep.reiniciar(); },
    });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'sin evaluar' },
      { color: C.s2, texto: 'nodo que se evalúa' },
      { color: C.tinta, texto: 'evaluado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const resultado = B.grupoTablas(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un nodo para ver cuántas filas produce. Compare la suma de filas intermedias en ambos planes.');

    function recorrer(n, f) { n.hijos.forEach((h) => recorrer(h, f)); f(n); }
    function iniciar() {
      raiz = planes()[plan];
      recorrer(raiz, (n) => { n.res = null; });
      actual = null;
      mensaje = 'El ejecutor evalúa el árbol de abajo hacia arriba (postorden).';
      return (function* () {
        const orden = [];
        recorrer(raiz, (n) => orden.push(n));
        for (const n of orden) {
          actual = n;
          n.res = n.f(...n.hijos.map((h) => h.res));
          mensaje = n.hijos.length
            ? `${n.etiqueta}: ${n.hijos.map((h) => h.res.filas.length).join(' y ')} filas de entrada → ${n.res.filas.length} de salida.`
            : `Leer ${n.etiqueta}: ${n.res.filas.length} filas.`;
          yield;
        }
        actual = null;
        mensaje = `Resultado: ${raiz.res.filas.map((f) => f.nombre).join(', ')}.`;
      })();
    }

    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      if (!raiz) return;
      // Coordenadas: x por orden de hojas, y por profundidad.
      let hojas = 0, prof = 0;
      (function medir(n, d) { prof = Math.max(prof, d); if (!n.hijos.length) n.ix = hojas++; else { n.hijos.forEach((h) => medir(h, d + 1)); n.ix = n.hijos.reduce((s, h) => s + h.ix, 0) / n.hijos.length; } n.d = d; })(raiz, 0);
      const dx = W / hojas, dy = (H - 50) / Math.max(1, prof);
      const pos = (n) => ({ x: (n.ix + 0.5) * dx, y: 24 + n.d * dy });
      geo = [];
      recorrer(raiz, (n) => {
        const p = pos(n);
        n.hijos.forEach((h) => {
          const q = pos(h);
          ctx.strokeStyle = h.res ? C.tinta2 : C.eje; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 12); ctx.lineTo(q.x, q.y - 12); ctx.stroke();
        });
      });
      let intermedias = 0;
      recorrer(raiz, (n) => {
        const p = pos(n);
        ctx.font = VIZ.fuente(W < 500 ? 10 : 12, 500);
        const w = Math.min(dx * 1.9, ctx.measureText(n.etiqueta).width + 16), h = 24;
        const col = n === actual ? C.s2 : n.res ? C.tinta : C.inactivo;
        B.caja(ctx, p.x - w / 2, p.y - h / 2, w, h, n.etiqueta, { borde: col, tinta: col, ancho: n === actual ? 3 : 1.5, px: W < 500 ? 10 : 12 });
        if (n.res) {
          if (n !== raiz && n.hijos.length) intermedias += n.res.filas.length;
          B.texto(ctx, `${n.res.filas.length} filas`, p.x, p.y + h / 2 + 9, { alinear: 'center', px: 10, color: n === actual ? C.s2 : C.apagado });
        }
        geo.push({ n, x: p.x, y: p.y, w, h });
      });
      registro.textContent = mensaje;
      const mostrar = actual || (rep.terminado ? raiz : null);
      resultado.replaceChildren(...(mostrar && mostrar.res ? [B.tabla(mostrar.res, { titulo: `salida de ${mostrar.etiqueta}`, maxFilas: 8 })] : []));
      lectura.set([
        ['filas intermedias', String(intermedias)],
        ['nodos evaluados', `${geo.filter((g) => g.n.res).length} de ${geo.length}`],
        ['filas finales', raiz.res ? String(raiz.res.filas.length) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.abs(x - q.x) <= q.w / 2 && Math.abs(y - q.y) <= q.h / 2);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.n.etiqueta}</b><br>${g.n.res ? `${g.n.res.filas.length} filas · ${g.n.res.atributos.length} columnas` : 'sin evaluar'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('algebra-relacional', {
    intro: String.raw`
      <p>El <strong>álgebra relacional</strong> es el lenguaje de consultas formal del modelo relacional. Tiene un puñado de operadores que
      toman relaciones y devuelven relaciones, de modo que se pueden anidar: el resultado de una consulta es la entrada de otra.</p>
      <p>Su importancia es práctica. Todo motor traduce SQL a un árbol de operadores del álgebra, y el optimizador lo reescribe en otro
      árbol <em>equivalente</em> que produce el mismo resultado con mucho menos trabajo.</p>`,
    visualizaciones: [
      {
        titulo: 'Los operadores sobre tablas',
        descripcion: 'Cada operador aplicado a Alumnos, Cursos e Inscripciones. Compare el tamaño del producto con el de la junta, y mire cómo la división responde una pregunta de «todos».',
        montar: montarOperadores,
      },
      {
        titulo: 'Evaluar un árbol de consulta',
        descripcion: 'Nombres de alumnos con nota ≥ 6 en Bases de Datos, con dos planes equivalentes. Empujar las selecciones hacia las hojas reduce las filas intermedias.',
        montar: montarArbol,
      },
    ],
    teoria: String.raw`
      <h2>Operadores básicos</h2>
      <table>
        <tr><th>Operador</th><th>Notación</th><th>Resultado</th></tr>
        <tr><td>selección</td><td>\(\sigma_{\theta}(R)\)</td><td>tuplas de \(R\) que cumplen \(\theta\)</td></tr>
        <tr><td>proyección</td><td>\(\pi_{A_1,\dots,A_k}(R)\)</td><td>las columnas indicadas, sin duplicados</td></tr>
        <tr><td>producto</td><td>\(R \times S\)</td><td>todas las combinaciones, \(|R|\cdot|S|\) tuplas</td></tr>
        <tr><td>unión</td><td>\(R \cup S\)</td><td>tuplas de \(R\) o de \(S\) (esquemas compatibles)</td></tr>
        <tr><td>diferencia</td><td>\(R - S\)</td><td>tuplas de \(R\) que no están en \(S\)</td></tr>
        <tr><td>renombre</td><td>\(\rho_{S(B_1,\dots)}(R)\)</td><td>la misma relación con otro nombre</td></tr>
      </table>
      <p>Estos seis son un conjunto completo: el resto se define con ellos.</p>

      <h2>Operadores derivados</h2>
      \[ R \bowtie_{\theta} S = \sigma_{\theta}(R \times S), \qquad R \cap S = R - (R - S), \]
      <p>la <strong>junta natural</strong> \(R \bowtie S\) iguala los atributos con el mismo nombre y deja una sola copia de ellos, y la
      <strong>división</strong>, para \(R(X, Y)\) y \(S(Y)\), es</p>
      \[ R \div S = \pi_X(R) - \pi_X\big( (\pi_X(R) \times S) - R \big): \]
      <p>los \(x\) que no tienen ningún \(y\) de \(S\) «faltante».</p>

      <h2>Equivalencias y optimización</h2>
      <p>Algunas reglas que usa el optimizador:</p>
      \[ \sigma_{\theta_1 \wedge \theta_2}(R) = \sigma_{\theta_1}(\sigma_{\theta_2}(R)), \qquad
         \sigma_{\theta}(R \bowtie S) = \sigma_{\theta}(R) \bowtie S \;\text{ si } \theta \text{ solo usa atributos de } R, \]
      \[ R \bowtie S = S \bowtie R, \qquad (R \bowtie S) \bowtie T = R \bowtie (S \bowtie T). \]
      <p>La segunda permite <strong>empujar las selecciones</strong> hacia las hojas: se filtra antes de juntar, cuando las relaciones todavía
      son chicas. El orden de las juntas, que la asociatividad deja libre, es la decisión más cara de un optimizador: con \(n\) relaciones
      hay del orden de \(n!\) órdenes posibles.</p>
      <div class="recuadro">El álgebra opera sobre <em>conjuntos</em>. SQL opera sobre <em>multiconjuntos</em> (bolsas): no elimina duplicados
      salvo que se pida con <code>DISTINCT</code>, porque eliminarlos exige ordenar o usar hashing.</div>

      <h2>Conexiones</h2>
      <p>Cada operador se implementa con un algoritmo físico: la selección con un recorrido o un índice
      (<a href="tema.html?id=operadores-lineales">operadores lineales</a>) y la junta con
      <a href="tema.html?id=nested-loop-join">nested loop join</a> o <a href="tema.html?id=block-nested-loop-join">su versión por bloques</a>.
      Las consultas se escriben en <a href="tema.html?id=sql">SQL</a>.</p>`,
  });
})();
