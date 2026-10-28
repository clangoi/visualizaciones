(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const POR_PAG = 3;
  const pasadas = (N, Bm) => 1 + Math.ceil(Math.log(Math.max(1, Math.ceil(N / Bm))) / Math.log(Bm - 1) - 1e-9);

  /* ---------- Fig. 1: corridas y mezclas ---------- */

  function montarOrden(cuerpo) {
    let N = 9, Bm = 3, semilla = 1, filas = [], marcaUsadas = new Set(), marcaNueva = -1, lecturas = 0, escrituras = 0, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Páginas N', min: 4, max: 14, valor: N, alCambiar: (v) => { N = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Marcos de buffer B', min: 3, max: 6, valor: Bm, alCambiar: (v) => { Bm = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 30 + (pasadas(N, Bm) + 1) * 76 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'datos sin ordenar' },
      { color: C.s1, texto: 'corridas que se leen' },
      { color: C.s2, texto: 'corrida que se escribe' },
      { color: C.tinta, texto: 'corrida terminada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una pasada completa sobre los datos: lee y escribe las N páginas. Suba B y vea cómo baja el número de pasadas.');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 13 + N);
      const datos = Array.from({ length: N * POR_PAG }, () => 1 + Math.floor(rnd() * 99));
      // filas[k] = lista de corridas; cada corrida es una lista de valores.
      filas = [[...Array(N)].map((_, i) => datos.slice(i * POR_PAG, (i + 1) * POR_PAG))];
      marcaUsadas = new Set(); marcaNueva = -1; lecturas = 0; escrituras = 0;
      mensaje = `${N} páginas de ${POR_PAG} registros, ${Bm} marcos de memoria.`;
      lienzo.ajustar(true);
      return (function* () {
        // Pasada 0: ordenar en memoria grupos de B páginas.
        const p0 = [];
        filas.push(p0);
        for (let i = 0; i < N; i += Bm) {
          const trozo = filas[0].slice(i, i + Bm).flat().sort((a, b) => a - b);
          p0.push(trozo);
          const np = Math.ceil(trozo.length / POR_PAG);
          lecturas += np; escrituras += np;
          marcaUsadas = new Set([...Array(Math.min(Bm, N - i))].map((_, j) => `0:${i + j}`)); marcaNueva = p0.length - 1;
          mensaje = `Pasada 0: se leen ${np} páginas, se ordenan en memoria y se escribe una corrida de ${np} páginas.`;
          yield;
        }
        // Mezclas de B − 1 vías.
        let k = 1;
        while (filas[k].length > 1) {
          const sig = [];
          filas.push(sig);
          for (let i = 0; i < filas[k].length; i += Bm - 1) {
            const grupo = filas[k].slice(i, i + Bm - 1);
            const mezcla = grupo.flat().sort((a, b) => a - b);
            sig.push(mezcla);
            const np = Math.ceil(mezcla.length / POR_PAG);
            lecturas += np; escrituras += np;
            marcaUsadas = new Set(grupo.map((_, j) => `${k}:${i + j}`)); marcaNueva = sig.length - 1;
            mensaje = `Pasada ${k}: mezcla de ${grupo.length} ${grupo.length === 1 ? 'corrida (se copia)' : 'corridas'} con ${Bm - 1} marcos de entrada y 1 de salida → corrida de ${np} páginas.`;
            yield;
          }
          k++;
        }
        marcaUsadas = new Set(); marcaNueva = -1;
        mensaje = `Ordenado en ${filas.length - 1} ${filas.length - 1 === 1 ? 'pasada' : 'pasadas'}: ${lecturas + escrituras} E/S = 2N × pasadas.`;
      })();
    }
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      geo = [];
      const huecoCorrida = 10;
      filas.forEach((corridas, f) => {
        const y = 22 + f * 76, ph = 50;
        const nPag = corridas.reduce((s, c) => s + Math.ceil(c.length / POR_PAG), 0);
        const pw = Math.min(64, (W - 20 - (corridas.length - 1) * huecoCorrida) / Math.max(1, nPag));
        B.texto(ctx, f === 0 ? 'entrada' : `pasada ${f - 1}`, 10, y - 10, { px: 10, color: C.apagado });
        let x = 10;
        const ultimaFila = f === filas.length - 1;
        corridas.forEach((c, r) => {
          const usada = marcaUsadas.has(`${f}:${r}`) && f < filas.length - 1;
          const nueva = ultimaFila && r === marcaNueva && f > 0;
          const color = nueva ? C.s2 : usada ? C.s1 : f === 0 ? C.inactivo : C.tinta;
          for (let p = 0; p < Math.ceil(c.length / POR_PAG); p++) {
            const vals = c.slice(p * POR_PAG, (p + 1) * POR_PAG);
            B.pagina(ctx, x, y, pw - 2, ph, vals.map((v) => ({ texto: v, tinta: f === 0 && !usada ? C.tinta2 : C.tinta })), { capacidad: POR_PAG, borde: color, grosor: nueva || usada ? 3 : 1.5 });
            geo.push({ x, y, w: pw - 2, h: ph, html: `${f === 0 ? 'entrada' : `pasada ${f - 1}`}, corrida ${r + 1}<br>${vals.join(', ')}` });
            x += pw;
          }
          x += huecoCorrida;
        });
      });
      registro.textContent = mensaje;
      const P = pasadas(N, Bm);
      lectura.set([
        ['pasadas', `${Math.max(0, filas.length - 1)} de ${P}`],
        ['E/S medidas', String(lecturas + escrituras)],
        ['2N · (1 + ⌈log_{B−1}⌈N/B⌉⌉)', String(2 * N * P)],
        ['corridas iniciales ⌈N/B⌉', String(Math.ceil(N / Bm))],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, g.html);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: número de pasadas ---------- */

  function montarPasadas(cuerpo) {
    let hover = null;
    const BS = [[3, C.s1], [10, C.s2], [100, C.s3], [1000, C.s4]];
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, BS.map(([b, c]) => ({ color: c, texto: `B = ${VIZ.entero(b)}`, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje horizontal logarítmico: de mil a mil millones de páginas. Pase el cursor para leer las pasadas.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 3, xmax: 9, ymin: 0, ymax: 22 }, {
        etiquetaX: 'páginas N', etiquetaY: 'pasadas', ticksX: [3, 4, 5, 6, 7, 8, 9], formatoX: (v) => '10' + '⁰¹²³⁴⁵⁶⁷⁸⁹'[v],
      });
      plano.ejes();
      for (const [b, c] of BS) {
        const pts = [];
        for (let e = 3; e <= 9.0001; e += 0.01) pts.push([e, pasadas(10 ** e, b)]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(pasadas(10 ** hover, b)), c, 4);
      }
      const N = 1e6;
      lectura.set(BS.map(([b]) => [`N = 1 millón, B = ${VIZ.entero(b)}`, `${pasadas(N, b)} pasadas`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = plano.ix(x); dibujar();
      const N = 10 ** hover;
      tip.mostrar(x, y, `N = <b>${VIZ.entero(N)}</b>` + BS.map(([b, c]) => VIZ.filaTooltip(c, `B = ${VIZ.entero(b)}`, `${pasadas(N, b)}`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('external-merge-sort', {
    intro: String.raw`
      <p>Ordenar es parte de ORDER BY, de DISTINCT, de GROUP BY, de la construcción de índices y del <em>sort-merge join</em>. Pero los datos
      no caben en memoria: con \(B\) marcos de buffer, hay que ordenar \(N \gg B\) páginas.</p>
      <p>El <strong>ordenamiento externo por mezcla</strong> lo resuelve en dos etapas. Primero lee trozos de \(B\) páginas, los ordena en
      memoria y los escribe como <em>corridas</em> ordenadas. Después mezcla \(B - 1\) corridas a la vez, usando un marco por corrida de
      entrada y uno para la salida, hasta que queda una sola. Con memoria razonable, dos o tres pasadas ordenan terabytes.</p>`,
    visualizaciones: [
      {
        titulo: 'Corridas y mezclas',
        descripcion: 'Cada fila es una pasada. Con B = 3 las mezclas son de 2 vías y hacen falta varias pasadas; con B = 6, la primera mezcla ya junta 5 corridas.',
        montar: montarOrden,
      },
      {
        titulo: 'Número de pasadas',
        descripcion: 'Pasadas necesarias según el tamaño del archivo y del buffer. Crecen como un logaritmo de base B − 1: con B = 1 000, hasta mil millones de páginas se ordenan en 3 pasadas.',
        montar: montarPasadas,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>pasada 0:
    mientras queden páginas:
        leer B páginas, ordenarlas en memoria, escribir una corrida
pasada i ≥ 1:
    mientras queden corridas:
        tomar B − 1 corridas; un marco de entrada para cada una y uno de salida
        repetir: mover el menor de los primeros elementos al marco de salida
                 (si un marco de entrada se vacía, leer la siguiente página de su corrida;
                  si el de salida se llena, escribirlo)
        escribir la corrida mezclada</code></pre>
      <p>Para elegir el menor entre \(B - 1\) candidatos se usa un montículo: cada elemento cuesta \(O(\log B)\) en CPU.</p>

      <h2>Costo</h2>
      <p>La pasada 0 produce \(\lceil N/B \rceil\) corridas, y cada mezcla divide el número de corridas por \(B - 1\):</p>
      \[ \text{pasadas} = 1 + \left\lceil \log_{B-1} \lceil N/B \rceil \right\rceil, \qquad
         \text{E/S} = 2N \cdot \text{pasadas}. \]
      <p>Cada pasada lee y escribe las \(N\) páginas. Con \(N = 10^6\) y \(B = 100\): \(\lceil 10^6/100\rceil = 10^4\) corridas, \(\lceil\log_{99}
      10^4\rceil = 3\) mezclas, 4 pasadas y \(8 \cdot 10^6\) E/S.</p>
      <div class="recuadro">Si \(B \ge \sqrt{N}\), bastan <strong>dos pasadas</strong>: la pasada 0 genera a lo más \(N/B \le B - 1\)
      corridas, que se mezclan de una vez. Con páginas de 8 KiB y 100 MB de buffer (\(B \approx 12\,800\)), dos pasadas ordenan
      \(B^2 \approx 1{,}6\cdot10^8\) páginas: más de un terabyte.</div>

      <h2>Mejoras</h2>
      <ul>
        <li><strong>Selección por reemplazo</strong> en la pasada 0: con un montículo de \(B\) páginas se generan corridas de largo medio
        \(2B\), y la mitad de corridas ahorra a veces una pasada.</li>
        <li><strong>Doble buffer</strong>: dos marcos por corrida para leer la siguiente página mientras se procesa la actual. Reduce \(B\)
        efectivo, pero oculta la latencia del disco.</li>
        <li><strong>Bloques de E/S</strong>: leer varias páginas por acceso convierte lecturas aleatorias en secuenciales, a costa de un
        abanico de mezcla menor.</li>
        <li><strong>Usar un índice B+ agrupado</strong>: las hojas ya están ordenadas y basta con recorrerlas (\(N\) lecturas). Uno no agrupado,
        en cambio, casi nunca conviene: es una lectura aleatoria por registro.</li>
      </ul>
      <p>Compárelo con el <a href="tema.html?id=merge-sort">merge sort</a> en memoria: la idea es la misma, pero aquí se mezclan muchas
      corridas a la vez porque lo caro es cada pasada sobre el disco, no cada comparación.</p>`,
  });
})();
