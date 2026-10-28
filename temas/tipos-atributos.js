(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  const TIPOS = {
    IdE: { nombre: 'IdE · identificador explícito', color: C.s8 },
    CId: { nombre: 'CId · cuasi-identificador', color: C.s4 },
    AS: { nombre: 'AS · atributo sensible', color: C.s7 },
    AnS: { nombre: 'AnS · atributo no sensible', color: C.s3 },
  };
  const EXTRA = { correo: 'IdE', profesion: 'CId' };
  const CORRECTO = { ...VIZ.bdd.TIPOS_CLINICOS, ...EXTRA };
  const POR_QUE = {
    nombre: 'identifica por sí solo a la persona.',
    rut: 'es único por persona en Chile: identifica directamente.',
    correo: 'suele identificar por sí solo y además es contactable.',
    cp: 'no identifica solo, pero combinado con edad y sexo reduce el grupo a muy pocas personas y aparece en registros públicos.',
    edad: 'es pública o fácil de averiguar y, combinada, identifica.',
    sexo: 'tiene solo dos valores, pero divide a la mitad cada grupo.',
    profesion: 'es conocida por vecinos y colegas; las profesiones raras identifican.',
    diagnostico: 'es lo que se quiere proteger: un dato de salud, sensible según la ley.',
    canal: 'no identifica ni es dañino revelarlo.',
  };

  function datos() {
    const R = VIZ.bdd.clinicos();
    const correos = ['ana.r', 'bdiaz', 'carla.s', 'dmunoz', 'evera', 'flagos', 'gpaz', 'hpino', 'itoro', 'jleiva', 'kfuentes', 'laraya'];
    const prof = ['profesora', 'estudiante', 'enfermera', 'estudiante', 'abogada', 'ingeniero', 'médica', 'chofer', 'periodista', 'ingeniero', 'estudiante', 'bombero'];
    R.atributos = ['nombre', 'rut', 'correo', 'cp', 'edad', 'sexo', 'profesion', 'diagnostico', 'canal'];
    R.filas.forEach((f, i) => { f.correo = `${correos[i]}@mail.cl`; f.profesion = prof[i]; });
    return R;
  }

  function montarClasificar(cuerpo) {
    const R = datos();
    const eleccion = Object.fromEntries(R.atributos.map((a) => [a, 'AnS']));
    let revisado = false, tratado = false;
    const ctl = VIZ.controles(cuerpo);
    R.atributos.forEach((a) => ctl.selector({
      etiqueta: a, valor: eleccion[a], opciones: Object.keys(TIPOS).map((t) => [t, t]),
      alCambiar: (v) => { eleccion[a] = v; revisado = false; tratado = false; dibujar(); },
    }));
    ctl.boton('Revisar', () => { revisado = true; dibujar(); }, { primario: true });
    ctl.boton('Aplicar tratamiento', () => { tratado = !tratado; dibujar(); });
    ctl.boton('Mostrar respuesta', () => {
      R.atributos.forEach((a, i) => { eleccion[a] = CORRECTO[a]; ctl.caja.querySelectorAll('select')[i].value = CORRECTO[a]; });
      revisado = true; dibujar();
    });
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, Object.values(TIPOS).map((t) => ({ color: VIZ.alfa(t.color, 0.18), texto: t.nombre })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un tipo para cada columna y pulse «Revisar». «Aplicar tratamiento» muestra qué se publicaría según su clasificación.');

    function tratar() {
      const atr = R.atributos.filter((a) => eleccion[a] !== 'IdE');
      const nv = { cp: 2, edad: 2, sexo: 0 };
      return VIZ.bdd.rel('Publicable', atr, R.filas.map((f) => Object.fromEntries(atr.map((a) => [a,
        eleccion[a] !== 'CId' ? f[a] : a === 'profesion' ? (['estudiante', 'ingeniero'].includes(f[a]) ? f[a] : 'otra') : VIZ.bdd.generalizar(a, f[a], nv[a] ?? 0)]))));
    }
    function dibujar() {
      const T = tratado ? tratar() : R;
      caja.replaceChildren(B.tabla(T, { celda: (f, a) => TIPOS[eleccion[a]].color, maxFilas: 12 }));
      const malos = R.atributos.filter((a) => eleccion[a] !== CORRECTO[a]);
      if (revisado) {
        registro.textContent = malos.length
          ? `${R.atributos.length - malos.length} de ${R.atributos.length} correctas. Revise: ${malos.map((a) => `${a} es ${CORRECTO[a]} porque ${POR_QUE[a]}`).join(' ')}`
          : `Todas correctas. ${R.atributos.map((a) => `${a} (${CORRECTO[a]}): ${POR_QUE[a]}`).slice(0, 3).join(' ')} …`;
      } else if (tratado) {
        registro.textContent = 'Tratamiento: se eliminan los IdE, se generalizan los CId (código postal a 3 dígitos, edad en tramos de 10, profesiones raras a «otra») y se conservan AS y AnS.';
      } else registro.textContent = 'Clasifique las nueve columnas.';
      const cis = R.atributos.filter((a) => eleccion[a] === 'CId');
      const Tt = tratar();
      const unicos = cis.length ? VIZ.bdd.clases(Tt, cis.filter((a) => Tt.atributos.includes(a))).filter((c) => c.indices.length === 1).length : 0;
      lectura.set([
        ['correctas', `${R.atributos.length - malos.length} de ${R.atributos.length}`],
        ...Object.keys(TIPOS).map((t) => [t, String(R.atributos.filter((a) => eleccion[a] === t).length)]),
        ['únicos tras tratar', String(unicos)],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('tipos-atributos', {
    intro: String.raw`
      <p>Antes de publicar o compartir una tabla con datos personales hay que clasificar sus columnas, porque cada clase pide un tratamiento
      distinto. La clasificación estándar tiene cuatro tipos: <strong>identificadores explícitos</strong> (IdE), <strong>cuasi-identificadores</strong>
      (CId), <strong>atributos sensibles</strong> (AS) y <strong>atributos no sensibles</strong> (AnS).</p>
      <p>La clasificación depende del contexto, no solo del nombre de la columna: la profesión es inocua en una encuesta nacional, pero
      «astronauta» identifica a una persona. Por eso se razona pensando en qué sabe un posible atacante.</p>`,
    visualizaciones: [
      {
        titulo: 'Clasificar las columnas',
        descripcion: 'Una tabla clínica de doce pacientes. Asigne un tipo a cada columna, revise su clasificación y aplique el tratamiento correspondiente.',
        montar: montarClasificar,
      },
    ],
    teoria: String.raw`
      <h2>Los cuatro tipos</h2>
      <table>
        <tr><th>Tipo</th><th>Definición</th><th>Ejemplos</th><th>Tratamiento</th></tr>
        <tr><td><strong>IdE</strong></td><td>identifica a la persona por sí solo</td><td>nombre, RUT, correo, teléfono, número de ficha</td><td>eliminar o seudonimizar</td></tr>
        <tr><td><strong>CId</strong></td><td>no identifica solo, pero sí combinado con otros y con fuentes externas</td><td>edad, fecha de nacimiento, sexo, comuna, código postal, profesión</td><td>generalizar, suprimir, perturbar</td></tr>
        <tr><td><strong>AS</strong></td><td>su revelación puede dañar a la persona</td><td>diagnóstico, salario, orientación sexual, antecedentes penales</td><td>proteger su asociación con la identidad (l-diversidad)</td></tr>
        <tr><td><strong>AnS</strong></td><td>ni identifica ni es dañino</td><td>canal de atención, preferencia de idioma</td><td>publicar tal cual</td></tr>
      </table>

      <h2>Cómo decidir</h2>
      <pre><code>para cada columna A:
    si A identifica a una persona por sí sola:          IdE
    si no, si A podría estar en otra fuente pública
           o ser conocida por alguien cercano:           CId
    si no, si revelar A asociado a una persona la daña: AS
    si no:                                               AnS</code></pre>
      <div class="recuadro">Un mismo atributo puede ser a la vez cuasi-identificador y sensible: el diagnóstico de una enfermedad rara
      identifica (porque pocas personas la tienen) y además es dañino. En la duda, se trata con la regla más estricta.</div>

      <h2>Relación con la ley</h2>
      <p>La <a href="tema.html?id=ley-21719">Ley 21.719</a> llama <em>datos personales</em> a la información sobre una persona identificada
      o identificable, lo que incluye los cuasi-identificadores, y <em>datos sensibles</em> a una lista que coincide con los AS (salud,
      origen étnico, vida sexual, datos biométricos, entre otros), con exigencias reforzadas.</p>
      <p>El tratamiento concreto de cada tipo se ve en <a href="tema.html?id=de-identificacion">de-identificación</a>,
      <a href="tema.html?id=k-anonimato">k-anonimato</a> (CId) y <a href="tema.html?id=l-diversidad">l-diversidad</a> (AS).</p>`,
  });
})();
