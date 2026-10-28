(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const POR_PAG = 2;
  // R(a): alumnos; S(a): inscripciones. La junta es R.a = S.a.
  const R0 = [101, 104, 102, 106, 103, 105];
  const S0 = [104, 101, 106, 103, 106, 101, 102, 106];
  const paginas = (v) => Array.from({ length: Math.ceil(v.length / POR_PAG) }, (_, i) => v.slice(i * POR_PAG, (i + 1) * POR_PAG));

  function montarNLJ(cuerpo) {
    let modo = 'tupla', invertir = false;
    let ext, int, ie = -1, ii = -1, pagExt = -1, pagInt = -1, lecturas = 0, pares = [], comparaciones = 0, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Variante', valor: modo, opciones: [['tupla', 'tupla a tupla'], ['pagina', 'página a página']], alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'usar S como relación externa', valor: invertir, alCambiar: (v) => { invertir = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 260 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'tuplas que se comparan' },
      { color: C.s6, texto: 'coinciden: par de salida', forma: 'linea' },
      { color: C.s2, texto: 'página leída en este paso' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const caja = B.grupoTablas(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cuente las lecturas de la relación interna: se repiten por cada tupla (o página) de la externa. Cambie cuál es la externa.');

    let leida = null;
    function leer(rel, p) { lecturas++; leida = `${rel}${p}`; }
    function iniciar() {
      ext = invertir ? S0 : R0; int = invertir ? R0 : S0;
      ie = -1; ii = -1; pagExt = -1; pagInt = -1; lecturas = 0; pares = []; comparaciones = 0; leida = null;
      const nE = invertir ? 'S' : 'R', nI = invertir ? 'R' : 'S';
      mensaje = `Externa ${nE}: ${paginas(ext).length} páginas; interna ${nI}: ${paginas(int).length} páginas. Hay un marco para cada una.`;
      return (function* () {
        const PE = paginas(ext), PI = paginas(int);
        for (let pe = 0; pe < PE.length; pe++) {
          leer(nE, pe); pagExt = pe;
          const grupos = modo === 'tupla' ? PE[pe].map((_, j) => [j]) : [PE[pe].map((_, j) => j)];
          for (const g of grupos) {
            for (let pi = 0; pi < PI.length; pi++) {
              leer(nI, pi); pagInt = pi;
              for (const j of g) for (let k = 0; k < PI[pi].length; k++) {
                ie = pe * POR_PAG + j; ii = pi * POR_PAG + k; comparaciones++;
                const ok = ext[ie] === int[ii];
                if (ok) pares.push([ie, ii]);
                mensaje = `${nE}[${ie}] = ${ext[ie]} vs ${nI}[${ii}] = ${int[ii]}: ${ok ? 'coinciden, se emite el par' : 'no coinciden'}.${leida ? ` Se leyó la página ${leida}.` : ''}`;
                yield;
                leida = null;
              }
            }
          }
        }
        ie = -1; ii = -1;
        mensaje = `Fin: ${pares.length} pares, ${lecturas} lecturas de páginas, ${comparaciones} comparaciones.`;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const nE = invertir ? 'S' : 'R', nI = invertir ? 'R' : 'S';
      const PE = paginas(ext), PI = paginas(int);
      const pw = Math.min(90, W * 0.22), ph = 44, gap = 12;
      const xE = 16, xI = W - 16 - pw;
      const yE = (p) => 30 + p * (ph + gap) * (PI.length > PE.length ? (PI.length / PE.length) * 0.75 : 1);
      const yI = (p) => 30 + p * (ph + gap) * (PE.length > PI.length ? (PE.length / PI.length) * 0.75 : 1);
      const ty = (y, k) => y + ((k + 0.5) * ph) / POR_PAG;
      B.texto(ctx, `externa ${nE}`, xE, 12, { color: C.apagado, px: 10 });
      B.texto(ctx, `interna ${nI}`, xI + pw, 12, { alinear: 'right', color: C.apagado, px: 10 });
      // Pares encontrados.
      for (const [a, b] of pares) {
        ctx.strokeStyle = VIZ.alfa(C.s6, 0.7); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xE + pw, ty(yE(Math.floor(a / POR_PAG)), a % POR_PAG)); ctx.lineTo(xI, ty(yI(Math.floor(b / POR_PAG)), b % POR_PAG)); ctx.stroke();
      }
      if (ie >= 0) {
        ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xE + pw, ty(yE(Math.floor(ie / POR_PAG)), ie % POR_PAG)); ctx.lineTo(xI, ty(yI(Math.floor(ii / POR_PAG)), ii % POR_PAG)); ctx.stroke();
        ctx.setLineDash([]);
      }
      const dib = (P, x, yF, idx, pagAct, nom) => P.forEach((pg, p) => {
        const items = pg.map((v, k) => ({ texto: `${v}`, color: p * POR_PAG + k === idx ? C.s1 : null, relleno: p * POR_PAG + k === idx }));
        const recien = leida === `${nom}${p}`;
        B.pagina(ctx, x, yF(p), pw, ph, items, { capacidad: POR_PAG, borde: recien ? C.s2 : p === pagAct ? C.tinta : C.inactivo, grosor: recien ? 3 : 1.5 });
      });
      dib(PE, xE, yE, ie, pagExt, nE);
      dib(PI, xI, yI, ii, pagInt, nI);
      registro.textContent = mensaje;
      caja.replaceChildren(B.tabla(B.rel('salida', ['a', `${nE}[i]`, `${nI}[j]`], pares.map(([a, b]) => [ext[a], a, b])), { maxFilas: 10, vacio: '(sin pares aún)' }));
      const M = PE.length, N = PI.length, pR = POR_PAG;
      const formula = modo === 'tupla' ? M + pR * M * N : M + M * N;
      lectura.set([
        ['lecturas medidas', String(lecturas)],
        [modo === 'tupla' ? 'M + p·M·N' : 'M + M·N', `${formula}`],
        ['comparaciones', `${comparaciones} de ${ext.length * int.length}`],
        ['pares de salida', String(pares.length)],
      ]);
    }
    lienzo.alDibujar = () => ext && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('nested-loop-join', {
    intro: String.raw`
      <p>La forma más directa de calcular \(R \bowtie S\) es comparar cada tupla de \(R\) con cada tupla de \(S\): dos ciclos anidados. Es
      el único algoritmo que sirve para <em>cualquier</em> condición de junta (desigualdades, funciones, predicados arbitrarios), y por
      eso todo motor lo tiene.</p>
      <p>El problema es el disco. Si \(S\) no cabe en memoria, hay que volver a leerla completa por cada tupla de \(R\). La elección de cuál
      relación va afuera y si se itera por tuplas o por páginas cambia el costo en órdenes de magnitud.</p>`,
    visualizaciones: [
      {
        titulo: 'Nested loop join paso a paso',
        descripcion: 'R tiene 3 páginas y S tiene 4, con 2 tuplas por página y un solo marco para cada relación. Compare las lecturas de la variante tupla a tupla con la de página a página.',
        montar: montarNLJ,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmos</h2>
      <pre><code>tupla a tupla:
    para cada tupla r de R:
        para cada tupla s de S:
            si θ(r, s): emitir (r, s)

página a página:
    para cada página P_R de R:
        para cada página P_S de S:
            para cada r en P_R, s en P_S:
                si θ(r, s): emitir (r, s)</code></pre>

      <h2>Costo</h2>
      <p>Sea \(M\) el número de páginas de \(R\), \(N\) el de \(S\) y \(p_R\) las tuplas de \(R\) por página. Sin contar la escritura del
      resultado:</p>
      \[ \text{tupla a tupla: } M + p_R \cdot M \cdot N, \qquad \text{página a página: } M + M \cdot N. \]
      <p>Con \(M = 1\,000\), \(N = 500\) y \(p_R = 100\): la versión por tuplas lee \(5 \cdot 10^7\) páginas (unas 140 horas a 10 ms cada
      una); la versión por páginas, \(501\,000\) (una hora y media). La relación externa debe ser la <strong>más chica</strong>: el término
      dominante es \(M \cdot N\) en ambos casos, pero el término lineal \(M\) favorece que afuera vaya la pequeña.</p>
      <div class="recuadro">El número de comparaciones es siempre \(|R| \cdot |S|\); lo que cambia entre variantes es cuántas veces se lee
      cada página del disco. En bases de datos, el costo dominante son las E/S, no las comparaciones.</div>

      <h2>Index nested loop join</h2>
      <p>Si \(S\) tiene un índice sobre el atributo de junta, el ciclo interno se reemplaza por una búsqueda:</p>
      \[ M + p_R \cdot M \cdot (\text{costo de buscar en el índice} + \text{costo de leer las coincidencias}). \]
      <p>Con un hash (~1,2 lecturas) o un B+ de altura 2–4, es mucho mejor que recorrer \(S\) cuando \(R\) es pequeña.</p>

      <h2>Conexiones</h2>
      <p>Con más memoria, el siguiente paso es <a href="tema.html?id=block-nested-loop-join">block nested loop join</a>. Para juntas de
      igualdad hay alternativas sin ciclo cuadrático: <em>sort-merge join</em> (ordenar ambas con
      <a href="tema.html?id=external-merge-sort">ordenamiento externo</a> y mezclar) y <em>hash join</em>, que cuesta
      \(3(M + N)\).</p>`,
  });
})();
