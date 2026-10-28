(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const SIGLAS = ['IIC2413', 'IIC2133', 'MAT1610', 'IIC3633'];
  function datos(semilla) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: 24 }, (_, i) => ({ rol: 101 + Math.floor(rnd() * 40), sigla: SIGLAS[Math.floor(rnd() * 4)], nota: +(2 + rnd() * 5).toFixed(1), i }));
  }
  const POR_PAGINA = 4;

  const OPERADORES = {
    sel: { nombre: 'σ nota ≥ 5.0', sql: 'SELECT * FROM I WHERE nota >= 5.0' },
    dist: { nombre: 'π DISTINCT sigla', sql: 'SELECT DISTINCT sigla FROM I' },
    agg: { nombre: 'γ sigla, AVG(nota)', sql: 'SELECT sigla, AVG(nota), COUNT(*) FROM I GROUP BY sigla' },
  };

  /* ---------- Fig. 1: una pasada sobre el archivo ---------- */

  function montarPasada(cuerpo) {
    let op = 'agg', semilla = 1, filas = [], k = -1, salida = [], hash = new Map(), lecturas = 0, estado = null, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Operador', valor: op, opciones: Object.entries(OPERADORES).map(([c, o]) => [c, o.nombre]), alCambiar: (v) => { op = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const codigo = VIZ.el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 220 : 150) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'página sin leer' },
      { color: C.s1, texto: 'página en el buffer' },
      { color: C.s6, texto: 'tupla que pasa' },
      { color: C.s8, texto: 'tupla descartada' },
      { color: C.tinta, texto: 'ya procesada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const caja = B.grupoTablas(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada página se lee una sola vez. Para DISTINCT y GROUP BY, la tabla hash en memoria guarda una entrada por grupo, no por tupla.');

    function iniciar() {
      filas = datos(semilla); k = -1; salida = []; hash = new Map(); lecturas = 0; estado = null;
      mensaje = `Archivo de ${filas.length} tuplas en ${filas.length / POR_PAGINA} páginas.`;
      return (function* () {
        for (k = 0; k < filas.length; k++) {
          const t = filas[k];
          if (k % POR_PAGINA === 0) lecturas++;
          if (op === 'sel') {
            estado = t.nota >= 5 ? 'pasa' : 'descarta';
            if (estado === 'pasa') salida.push(t);
            mensaje = `${t.sigla}, nota ${t.nota}: ${estado === 'pasa' ? 'cumple, sale de inmediato' : 'no cumple, se descarta'}.`;
          } else if (op === 'dist') {
            const nuevo = !hash.has(t.sigla);
            if (nuevo) { hash.set(t.sigla, 1); salida.push({ sigla: t.sigla }); } else hash.set(t.sigla, hash.get(t.sigla) + 1);
            estado = nuevo ? 'pasa' : 'descarta';
            mensaje = nuevo ? `${t.sigla} no estaba en la tabla hash: es nueva, sale.` : `${t.sigla} ya está en la tabla hash: duplicado, se descarta.`;
          } else {
            const g = hash.get(t.sigla) || { suma: 0, n: 0 };
            g.suma += t.nota; g.n++; hash.set(t.sigla, g); estado = 'pasa';
            mensaje = `Grupo ${t.sigla}: suma ${VIZ.fmt(g.suma, 4)}, cuenta ${g.n}. Nada sale hasta terminar de leer.`;
          }
          yield;
        }
        k = filas.length;
        if (op === 'agg') salida = [...hash].map(([s, g]) => ({ sigla: s, avg: +(g.suma / g.n).toFixed(2), count: g.n }));
        estado = null;
        mensaje = `Fin de la pasada: ${lecturas} páginas leídas, ${salida.length} tuplas de salida.`;
      })();
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      codigo.textContent = OPERADORES[op].sql;
      const np = filas.length / POR_PAGINA, angosto = W < 560;
      const porFila = angosto ? 3 : np, pw = Math.min(110, (W - 20) / porFila - 10), ph = angosto ? 74 : 104;
      const pag = Math.floor(Math.max(0, k) / POR_PAGINA);
      geo = { pw, ph, porFila };
      for (let p = 0; p < np; p++) {
        const x = 10 + (p % porFila) * (pw + 10), y = 22 + Math.floor(p / porFila) * (ph + 20);
        const items = filas.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA).map((t) => {
          const hecho = t.i < k, actual = t.i === k;
          return { texto: `${t.sigla} ${t.nota}`, color: actual ? (estado === 'descarta' ? C.s8 : C.s6) : hecho ? C.tinta : null, relleno: actual, tinta: hecho || actual ? C.tinta : C.inactivo };
        });
        const enBuffer = p === pag && k >= 0 && k < filas.length;
        B.pagina(ctx, x, y, pw, ph, items, { capacidad: POR_PAGINA, borde: enBuffer ? C.s1 : p < pag || k >= filas.length ? C.tinta : C.inactivo, grosor: enBuffer ? 3 : 1.5, etiqueta: `página ${p + 1}`, tintaEtiqueta: enBuffer ? C.s1 : C.apagado });
      }
      registro.textContent = mensaje;
      const tablas = [];
      if (op === 'sel') tablas.push(B.tabla(B.rel('salida', ['rol', 'sigla', 'nota'], salida), { maxFilas: 8, vacio: '(nada aún)' }));
      if (op === 'dist') {
        tablas.push(B.tabla(B.rel('tabla hash', ['sigla', 'vistas'], [...hash].map(([s, n]) => [s, n]))));
        tablas.push(B.tabla(B.rel('salida', ['sigla'], salida), { vacio: '(nada aún)' }));
      }
      if (op === 'agg') {
        tablas.push(B.tabla(B.rel('tabla hash', ['sigla', 'suma', 'cuenta'], [...hash].map(([s, g]) => [s, VIZ.fmt(g.suma, 4), g.n]))));
        tablas.push(B.tabla(B.rel('salida', ['sigla', 'avg', 'count'], k >= filas.length ? salida : []), { vacio: '(sale al final)' }));
      }
      caja.replaceChildren(...tablas);
      lectura.set([
        ['páginas leídas', `${lecturas} de ${np}`],
        ['tuplas procesadas', String(Math.max(0, Math.min(k + 1, filas.length)))],
        ['entradas en memoria', op === 'sel' ? '0' : String(hash.size)],
        ['tuplas de salida', String(op === 'agg' && k < filas.length ? 0 : salida.length)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const col = Math.floor((x - 10) / (geo.pw + 10)), filaP = Math.floor((y - 22) / (geo.ph + 20));
      const p = filaP * geo.porFila + col;
      const dentroY = (y - 22) - filaP * (geo.ph + 20);
      if (col < 0 || col >= geo.porFila || dentroY < 0 || dentroY > geo.ph || p >= filas.length / POR_PAGINA) return tip.ocultar();
      const t = filas[p * POR_PAGINA + Math.floor((dentroY / geo.ph) * POR_PAGINA)];
      if (!t) return tip.ocultar();
      tip.mostrar(x, y, `página <b>${p + 1}</b><br>rol ${t.rol} · ${t.sigla} · nota ${t.nota}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: recorrido o índice según la selectividad ---------- */

  function montarSelectividad(cuerpo) {
    let logN = 4, hover = null;
    const R = 100, F = 100;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Páginas N', min: 2, max: 6, paso: 0.5, valor: logN, formato: (v) => VIZ.entero(10 ** v), alCambiar: (v) => { logN = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'recorrido completo: N', forma: 'linea' },
      { color: C.s2, texto: 'índice agrupado: altura + s·N', forma: 'linea' },
      { color: C.s3, texto: 'índice no agrupado: altura + s·R·N', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje de selectividad logarítmico. Pase el cursor para ver los costos; el punto marca dónde el índice no agrupado deja de convenir.');
    const altura = (N) => Math.max(1, Math.ceil(Math.log(N) / Math.log(F)));
    const SERIES = [
      [(N, s) => N, C.s1, 'recorrido'],
      [(N, s) => altura(N) + Math.ceil(s * N), C.s2, 'agrupado'],
      [(N, s) => altura(N) + Math.ceil(s * R * N), C.s3, 'no agrupado'],
    ];
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const N = 10 ** logN;
      plano = VIZ.plano(lienzo, { xmin: -5, xmax: 0, ymin: 1, ymax: N * R * 2 }, {
        logY: true, etiquetaX: 'selectividad s (fracción de tuplas que cumple)', etiquetaY: 'páginas leídas',
        ticksX: [-5, -4, -3, -2, -1, 0], formatoX: (v) => `${VIZ.fmt(100 * 10 ** v, 2)} %`, formatoY: (v) => (v < 1e6 ? VIZ.entero(v) : VIZ.fmt(v)),
      });
      plano.ejes();
      for (const [f, c] of SERIES) {
        const pts = [];
        for (let e = -5; e <= 0.0001; e += 0.05) pts.push([e, f(N, 10 ** e)]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(f(N, 10 ** hover)), c, 4);
      }
      const corte = Math.log10((N - altura(N)) / (R * N));
      VIZ.marcador(ctx, plano.sx(corte), plano.sy(N), C.tinta, 4);
      B.texto(ctx, `s ≈ ${VIZ.fmt(100 * 10 ** corte, 2)} %`, plano.sx(corte) + 8, plano.sy(N) - 12, { px: 11, color: C.tinta });
      lectura.set([
        ['tuplas', VIZ.entero(N * R)],
        ['altura del índice', String(altura(N))],
        ['corte del no agrupado', `${VIZ.fmt(100 * 10 ** corte, 2)} %`],
        ['igualdad sobre clave (s = 1/T)', `${altura(N) + 1} páginas`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = plano.ix(x); dibujar();
      const N = 10 ** logN, s = 10 ** hover;
      tip.mostrar(x, y, `s = <b>${VIZ.fmt(100 * s, 3)} %</b>` + SERIES.map(([f, c, t]) => VIZ.filaTooltip(c, t, VIZ.entero(f(N, s)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('operadores-lineales', {
    intro: String.raw`
      <p>Los operadores más simples de un plan se resuelven en <strong>una sola pasada</strong> sobre su entrada: la selección mira cada tupla
      y decide si sale; la proyección recorta columnas; la agregación con hash va acumulando sumas y cuentas por grupo. Leen cada página una
      vez, así que cuestan \(N\) lecturas: son <em>lineales</em>.</p>
      <p>Lo interesante es cuándo se puede hacer <em>menos</em> que una pasada. Si hay un índice sobre la columna del predicado, la
      selección puede saltar directo a las tuplas que cumplen, pero solo conviene si son pocas.</p>`,
    visualizaciones: [
      {
        titulo: 'Una pasada sobre el archivo',
        descripcion: 'Selección, DISTINCT y GROUP BY sobre las mismas seis páginas. La selección emite tuplas mientras lee; DISTINCT y AVG necesitan una tabla hash, y AVG solo emite al final.',
        montar: montarPasada,
      },
      {
        titulo: '¿Recorrido o índice?',
        descripcion: 'Costo de una selección según la fracción de tuplas que cumple. El índice no agrupado paga una lectura por tupla y pierde contra el recorrido cuando s supera ~1 %.',
        montar: montarSelectividad,
      },
    ],
    teoria: String.raw`
      <h2>Selección</h2>
      <p>Para \(\sigma_\theta(R)\) con \(R\) de \(N\) páginas, \(T\) tuplas y \(R_p\) tuplas por página:</p>
      <table>
        <tr><th>Método</th><th>Costo en páginas</th><th>Cuándo</th></tr>
        <tr><td>recorrido secuencial</td><td>\(N\)</td><td>siempre posible</td></tr>
        <tr><td>búsqueda binaria (archivo ordenado)</td><td>\(\log_2 N + sN\)</td><td>\(\theta\) sobre la columna de orden</td></tr>
        <tr><td>índice agrupado</td><td>\(h + sN\)</td><td>las tuplas que cumplen están contiguas</td></tr>
        <tr><td>índice no agrupado</td><td>\(h + sT\)</td><td>\(s\) muy pequeña</td></tr>
      </table>
      <p>donde \(h\) es la altura del índice y \(s\) la <strong>selectividad</strong>. El no agrupado iguala al recorrido cuando
      \(sT \approx N\), es decir \(s \approx 1/R_p\). Una mejora clásica es ordenar los rids obtenidos del índice antes de leer: cada página se
      lee una sola vez (<em>bitmap heap scan</em> en PostgreSQL).</p>
      <h3>Predicados compuestos</h3>
      <p>Con \(\theta = \theta_1 \wedge \theta_2\) se usa el índice del término más selectivo y el resto se verifica sobre la marcha, o se
      intersectan los conjuntos de rids de dos índices. Con \(\vee\), un índice solo sirve si cubre todos los términos.</p>

      <h2>Proyección y eliminación de duplicados</h2>
      <p>Proyectar sin DISTINCT es una pasada. Con DISTINCT hay que detectar duplicados: con una <strong>tabla hash</strong> en memoria si
      los valores distintos caben, o <a href="tema.html?id=external-merge-sort">ordenando</a> y eliminando adyacentes si no.</p>

      <h2>Agregación</h2>
      <pre><code>tabla ← diccionario vacío
para cada tupla t de R:
    g ← tabla[t.clave_de_grupo] (crear con suma 0, cuenta 0)
    g.suma ← g.suma + t.valor;  g.cuenta ← g.cuenta + 1
para cada grupo g:  emitir (clave, g.suma / g.cuenta)</code></pre>
      <p>La memoria es proporcional al número de grupos, no de tuplas. Es un operador <em>bloqueante</em> en el sentido del
      <a href="tema.html?id=iterador">modelo de iteradores</a>: nada sale hasta leer la última tupla. MIN, MAX, SUM y COUNT son
      <em>distributivos</em> (se combinan resultados parciales) y AVG es <em>algebraico</em> (basta guardar suma y cuenta); la mediana no
      es ninguna de las dos.</p>`,
  });
})();
