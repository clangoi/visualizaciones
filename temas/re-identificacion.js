(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: ataque de enlace ---------- */

  // Registro público (por ejemplo, un padrón): incluye a los pacientes y a otras personas.
  const OTROS = [
    ['Marta Ríos', '7510', 27, 'F'], ['Nicolás Vidal', '7511', 29, 'M'], ['Olga Reyes', '7520', 46, 'F'], ['Pablo Silva', '7522', 48, 'M'],
    ['Rocío Navarro', '8320', 33, 'F'], ['Sergio Castro', '8321', 38, 'M'], ['Teresa Bravo', '7512', 22, 'F'], ['Ulises Mora', '8322', 31, 'M'],
  ];

  function montarEnlace(cuerpo) {
    const P = B.clinicos();
    let nivelEdad = 0, nivelCp = 0, k = -1, enlaces = [], mensaje = '';
    const padron = B.rel('Padrón público', ['nombre', 'cp', 'edad', 'sexo'],
      [...P.filas.map((f) => [f.nombre, f.cp, f.edad, f.sexo]), ...OTROS].sort((a, b) => a[0].localeCompare(b[0])));
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Edad publicada', valor: '0', opciones: [['0', 'exacta'], ['1', 'tramos de 5'], ['2', 'tramos de 10']], alCambiar: (v) => { nivelEdad = +v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Código postal publicado', valor: '0', opciones: [['0', 'exacto'], ['1', '3 dígitos'], ['2', '2 dígitos']], alCambiar: (v) => { nivelCp = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'registro que se intenta enlazar' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 're-identificado (una sola coincidencia)' },
      { color: VIZ.alfa(C.s4, 0.18), texto: 'candidatos en el padrón' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con edad y código postal exactos casi todos los pacientes quedan re-identificados. Generalice y vea cómo crece el número de candidatos.');

    const publicada = () => B.rel('Tabla clínica publicada', ['cp', 'edad', 'sexo', 'diagnostico'],
      P.filas.map((f) => ({ cp: B.generalizar('cp', f.cp, nivelCp), edad: B.generalizar('edad', f.edad, nivelEdad), sexo: f.sexo, diagnostico: f.diagnostico })));
    const coincide = (pub, per) => B.generalizar('cp', per.cp, nivelCp) === pub.cp && B.generalizar('edad', per.edad, nivelEdad) === pub.edad && per.sexo === pub.sexo;
    let candidatos = [];
    function iniciar() {
      k = -1; enlaces = []; candidatos = [];
      mensaje = 'El atacante tiene la tabla clínica publicada (sin nombres) y un padrón con nombre, código postal, edad y sexo.';
      return (function* () {
        const T = publicada();
        for (k = 0; k < T.filas.length; k++) {
          const pub = T.filas[k];
          candidatos = padron.filas.map((per, i) => (coincide(pub, per) ? i : -1)).filter((i) => i >= 0);
          const unico = candidatos.length === 1;
          enlaces.push({ k, n: candidatos.length, nombre: unico ? padron.filas[candidatos[0]].nombre : null });
          mensaje = `(${pub.cp}, ${pub.edad}, ${pub.sexo}) → ${candidatos.length} ${candidatos.length === 1 ? 'persona' : 'personas'} en el padrón.` +
            (unico ? ` Re-identificado: ${padron.filas[candidatos[0]].nombre} tiene ${pub.diagnostico}.` : ` El atacante sabe que es una de ellas: probabilidad 1/${candidatos.length}.`);
          yield;
        }
        k = -1; candidatos = [];
        const r = enlaces.filter((e) => e.nombre).length;
        mensaje = `${r} de ${T.filas.length} pacientes re-identificados sin conocer ningún nombre de la tabla clínica.`;
      })();
    }
    function dibujar() {
      const T = publicada();
      const reid = new Map(enlaces.filter((e) => e.nombre).map((e) => [e.k, e.nombre]));
      const cand = new Set(candidatos);
      caja.replaceChildren(
        B.tabla(T, { fila: (f, i) => (i === k ? C.s1 : reid.has(i) ? C.s8 : null) }),
        B.tabla(padron, { fila: (f, i) => (cand.has(i) ? (candidatos.length === 1 ? C.s8 : C.s4) : null) }));
      registro.textContent = mensaje;
      const media = enlaces.length ? enlaces.reduce((s, e) => s + e.n, 0) / enlaces.length : 0;
      lectura.set([
        ['revisados', `${enlaces.length} de ${T.filas.length}`],
        ['re-identificados', String(reid.size)],
        ['candidatos promedio', enlaces.length ? VIZ.fmt(media, 3) : '—'],
        ['riesgo medio 1/candidatos', enlaces.length ? `${Math.round((100 * enlaces.reduce((s, e) => s + 1 / e.n, 0)) / enlaces.length)} %` : '—'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: unicidad de trayectorias ---------- */

  function montarTrayectorias(cuerpo) {
    let p = 4, usuarios = 500, resolucion = 'fina', semilla = 2, cache = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Usuarios', min: 100, max: 2000, paso: 100, valor: usuarios, alSoltar: (v) => { usuarios = v; cache = null; dibujar(); } });
    ctl.selector({ etiqueta: 'Resolución', valor: resolucion, opciones: [['fina', 'antena y hora'], ['gruesa', 'zona (÷4) y bloque de 4 h']], alCambiar: (v) => { resolucion = v; cache = null; dibujar(); } });
    ctl.rango({ etiqueta: 'Puntos que conoce el atacante', min: 1, max: 6, valor: p, alCambiar: (v) => { p = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; cache = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: '% de usuarios únicos con ese número de puntos' },
      { color: C.s2, texto: 'número elegido' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada usuario visita algunas antenas a distintas horas, con preferencia por su casa y su trabajo. Pase el cursor sobre una barra.');

    function simular() {
      const rnd = VIZ.semilla(semilla * 101 + usuarios);
      const A = 60, H = 24;
      const trazas = Array.from({ length: usuarios }, () => {
        const casa = Math.floor(rnd() * A), trabajo = Math.floor(rnd() * A), pts = new Set();
        for (let i = 0; i < 25; i++) {
          const h = Math.floor(rnd() * H);
          const a = rnd() < 0.7 ? (h >= 9 && h < 18 ? trabajo : casa) : Math.floor(rnd() * A);
          pts.add(resolucion === 'fina' ? `${a}@${h}` : `${Math.floor(a / 4)}@${Math.floor(h / 4)}`);
        }
        return [...pts];
      });
      // Para cada p, fracción de usuarios cuya muestra de p puntos solo la cumple él.
      const conj = trazas.map((t) => new Set(t));
      const res = [];
      for (let q = 1; q <= 6; q++) {
        let unicos = 0, muestras = 0;
        trazas.forEach((t, u) => {
          if (t.length < q) return;
          muestras++;
          const copia = [...t]; for (let i = copia.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [copia[i], copia[j]] = [copia[j], copia[i]]; }
          const m = copia.slice(0, q);
          let otros = 0;
          for (let v = 0; v < conj.length && otros === 0; v++) if (v !== u && m.every((x) => conj[v].has(x))) otros++;
          if (!otros) unicos++;
        });
        res.push(muestras ? unicos / muestras : 0);
      }
      return res;
    }
    let geo = [];
    function dibujar() {
      if (!cache) cache = simular();
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0.5, xmax: 6.5, ymin: 0, ymax: 100 }, { etiquetaX: 'puntos (lugar, hora) conocidos', etiquetaY: '% únicos', ticksX: [1, 2, 3, 4, 5, 6] });
      plano.ejes();
      geo = [];
      cache.forEach((v, i) => {
        const x = plano.sx(i + 1), w = (plano.sx(1.4) - plano.sx(0.6));
        ctx.fillStyle = i + 1 === p ? C.s2 : C.s1;
        ctx.beginPath(); ctx.roundRect(x - w / 2, plano.sy(100 * v), w, plano.sy(0) - plano.sy(100 * v), [4, 4, 0, 0]); ctx.fill();
        B.texto(ctx, `${Math.round(100 * v)} %`, x, plano.sy(100 * v) - 9, { alinear: 'center', px: 11, color: C.tinta });
        geo.push({ x0: x - w / 2, x1: x + w / 2, i, v });
      });
      lectura.set([
        ['usuarios', VIZ.entero(usuarios)],
        [`únicos con ${p} puntos`, `${Math.round(100 * cache[p - 1])} %`],
        ['con 1 punto', `${Math.round(100 * cache[0])} %`],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x0 && x <= q.x1);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `${g.i + 1} ${g.i ? 'puntos' : 'punto'}: <b>${VIZ.fmt(100 * g.v, 3)} %</b> de usuarios únicos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('re-identificacion', {
    intro: String.raw`
      <p><strong>Re-identificar</strong> es recuperar a quién corresponde un registro que se publicó sin identificadores. No hace falta
      romper ninguna protección: basta con <strong>enlazar</strong> los cuasi-identificadores que quedaron (comuna, edad, sexo) con otra
      fuente que los tenga junto al nombre, como un padrón, una red social o una filtración anterior.</p>
      <p>Los casos célebres son todos así: la ficha médica del gobernador Weld (Sweeney, 1997), los usuarios de AOL identificados por sus
      búsquedas (2006) y los de Netflix por las fechas de sus calificaciones, cruzadas con IMDb (Narayanan y Shmatikov, 2008).</p>`,
    visualizaciones: [
      {
        titulo: 'Ataque de enlace',
        descripcion: 'Cruce la tabla clínica publicada con un padrón público por código postal, edad y sexo. Cada registro con una sola coincidencia queda re-identificado, junto con su diagnóstico.',
        montar: montarEnlace,
      },
      {
        titulo: 'Unicidad de trayectorias',
        descripcion: 'Datos de ubicación de teléfonos sin nombres. ¿Cuántos puntos (lugar, hora) bastan para que solo un usuario los cumpla? Baje la resolución y vea que no ayuda tanto como parece.',
        montar: montarTrayectorias,
      },
    ],
    teoria: String.raw`
      <h2>El ataque de enlace</h2>
      <p>Sea \(T\) la tabla publicada con cuasi-identificadores \(Q\) y atributo sensible \(S\), y \(E\) una tabla externa con identidad y
      \(Q\). El atacante calcula</p>
      \[ T \bowtie_{Q} E, \]
      <p>una <a href="tema.html?id=algebra-relacional">junta</a> por los cuasi-identificadores. Cada fila de \(T\) que se junta con una
      sola fila de \(E\) queda re-identificada. Si se junta con \(m\) filas, el riesgo de esa persona es \(1/m\).</p>
      <div class="recuadro">El atacante no necesita que la persona esté sola en la tabla publicada: necesita que esté sola <em>en la tabla
      externa</em> con esos valores. Por eso el riesgo depende de fuentes que quien publica no controla, y por eso el
      <a href="tema.html?id=k-anonimato">k-anonimato</a> exige grupos de tamaño \(k\) en la propia tabla publicada, como cota conservadora.</div>

      <h2>Datos de alta dimensión</h2>
      <p>Con trayectorias, compras o calificaciones, cada persona tiene cientos de atributos. De Montjoye y colegas (2013) mostraron, con
      datos de 1,5 millones de teléfonos, que <strong>4 puntos espacio-temporales</strong> bastan para identificar al 95 % de las
      personas, y que bajar la resolución reduce la unicidad muy lentamente. En 2015 obtuvieron un resultado parecido con 4 compras con
      tarjeta. Generalizar no funciona aquí: para lograr grupos grandes habría que destruir casi toda la información.</p>

      <h2>Otros ataques</h2>
      <ul>
        <li><strong>Pertenencia</strong>: saber si una persona está en la base, por ejemplo comparando estadísticas publicadas con y sin
        ella.</li>
        <li><strong>Diferenciación</strong>: restar dos consultas agregadas que solo difieren en una persona
        (<a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a>).</li>
        <li><strong>Reconstrucción</strong>: muchas estadísticas exactas sobre la misma base permiten reconstruirla casi completa (Dinur y
        Nissim, 2003). La Oficina del Censo de EE. UU. lo verificó sobre su propio censo de 2010 y adoptó la
        <a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a> para 2020.</li>
      </ul>`,
  });
})();
