(function () {
  'use strict';
  const { el, color: C } = VIZ;

  const ESTRATEGIAS = [
    ['encadenamiento', 'Encadenamiento separado'],
    ['lineal', 'Sondeo lineal'],
    ['cuadratico', 'Sondeo cuadrático'],
    ['doble', 'Doble hash'],
  ];
  const PRIMOS = [7, 11, 13, 17, 19, 23, 29, 31];

  const mod = (a, m) => ((a % m) + m) % m;
  const h1 = (k, m) => mod(k, m);
  const h2 = (k, m) => 1 + mod(k, m - 1);
  function sonda(estr, k, i, m) {
    if (estr === 'lineal') return mod(h1(k, m) + i, m);
    if (estr === 'cuadratico') return mod(h1(k, m) + i * i, m);
    return mod(h1(k, m) + i * h2(k, m), m);
  }

  /* Tabla genérica: direccionamiento abierto o encadenamiento.
     Cada operación devuelve { indices visitados, posición final, resultado }. */
  function crearTabla(estr, m) {
    const abierta = estr !== 'encadenamiento';
    const celdas = abierta ? new Array(m).fill(null) : Array.from({ length: m }, () => []);
    let n = 0;
    return {
      estr, m, celdas, abierta,
      get n() { return n; },
      insertar(k) {
        if (!abierta) {
          const b = h1(k, m), lista = celdas[b];
          const pos = lista.findIndex((x) => x.k === k);
          if (pos >= 0) return { cubeta: b, examinados: pos + 1, pos, resultado: 'duplicada' };
          lista.push({ k, sondeos: lista.length + 1 });
          n++;
          return { cubeta: b, examinados: lista.length - 1, pos: lista.length - 1, resultado: 'insertada' };
        }
        const visitados = [];
        for (let i = 0; i < m; i++) {
          const j = sonda(estr, k, i, m);
          visitados.push(j);
          if (celdas[j] === null) {
            celdas[j] = { k, sondeos: i + 1 };
            n++;
            return { visitados, pos: j, resultado: 'insertada' };
          }
          if (celdas[j].k === k) return { visitados, pos: j, resultado: 'duplicada' };
        }
        return { visitados, pos: -1, resultado: 'sin espacio' };
      },
      buscar(k) {
        if (!abierta) {
          const b = h1(k, m), lista = celdas[b];
          const pos = lista.findIndex((x) => x.k === k);
          return pos >= 0
            ? { cubeta: b, examinados: pos + 1, pos, resultado: 'encontrada' }
            : { cubeta: b, examinados: lista.length, pos: -1, resultado: 'no está' };
        }
        const visitados = [];
        for (let i = 0; i < m; i++) {
          const j = sonda(estr, k, i, m);
          visitados.push(j);
          if (celdas[j] === null) return { visitados, pos: -1, resultado: 'no está' };
          if (celdas[j].k === k) return { visitados, pos: j, resultado: 'encontrada' };
        }
        return { visitados, pos: -1, resultado: 'no está' };
      },
    };
  }

  /* ---------- Fig. 1: tabla interactiva ---------- */

  function montarTabla(cuerpo) {
    let m = 13, estr = 'lineal';
    let claves = [];
    let tabla, ultima = null;

    function reconstruir() {
      tabla = crearTabla(estr, m);
      for (const k of claves) tabla.insertar(k);
      claves = claves.filter((k) => tabla.buscar(k).resultado === 'encontrada');
    }

    function operar(tipo, k) {
      if (!Number.isFinite(k)) return;
      k = Math.round(Math.abs(k));
      if (tipo === 'insertar') {
        const r = tabla.insertar(k);
        if (r.resultado === 'insertada') claves.push(k);
        ultima = { tipo, k, ...r };
      } else ultima = { tipo, k, ...tabla.buscar(k) };
      lienzo.ajustar(true);
    }
    function aleatoria() {
      let k;
      do k = Math.floor(Math.random() * 1000); while (claves.includes(k));
      return k;
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Resolución de colisiones', opciones: ESTRATEGIAS, valor: estr,
      alCambiar: (v) => { estr = v; ultima = null; reconstruir(); lienzo.ajustar(true); } });
    ctl.selector({ etiqueta: 'Tamaño m (primo)', opciones: PRIMOS.map((p) => [p, String(p)]), valor: m,
      alCambiar: (v) => { m = +v; ultima = null; reconstruir(); lienzo.ajustar(true); } });
    const entrada = ctl.numero({ etiqueta: 'Clave k', min: 0, max: 9999, valor: 42 });
    entrada.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') operar('insertar', entrada.valor); });
    ctl.boton('Insertar', () => operar('insertar', entrada.valor), { primario: true });
    ctl.boton('Buscar', () => operar('buscar', entrada.valor));
    ctl.boton('Insertar 1 aleatoria', () => { const k = aleatoria(); entrada.valor = k; operar('insertar', k); });
    ctl.boton('Insertar 5 aleatorias', () => { for (let i = 0; i < 5; i++) { const k = aleatoria(); entrada.valor = k; operar('insertar', k); } });
    ctl.boton('Vaciar', () => { claves = []; ultima = null; reconstruir(); lienzo.ajustar(true); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => calcularAlto(w) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.rampa[1], texto: '1 sondeo' },
      { color: VIZ.rampa[6], texto: '3–4 sondeos' },
      { color: VIZ.rampa[12], texto: '7 o más sondeos' },
      { color: C.superficie, borde: C.s2, texto: 'celda visitada en la última operación' },
      { color: C.superficie, borde: C.s6, texto: 'resultado de la operación' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    const mensaje = VIZ.nota(cuerpo, '');

    const disp = (w) => {
      if (estr === 'encadenamiento') {
        const ancho = Math.max(30, Math.min(60, Math.floor((w - 8) / m)));
        const porFila = Math.max(1, Math.floor((w - 8) / ancho));
        const largo = Math.max(4, ...tabla.celdas.map((l) => l.length));
        return { ancho, porFila, filas: Math.ceil(m / porFila), altoBloque: 32 + largo * 30 + 12 };
      }
      const ancho = Math.max(38, Math.min(64, Math.floor((w - 8) / m)));
      const porFila = Math.max(1, Math.floor((w - 8) / ancho));
      return { ancho, porFila, filas: Math.ceil(m / porFila), altoBloque: ancho + 36 };
    };
    function calcularAlto(w) { return tabla ? disp(w).filas * disp(w).altoBloque + 8 : 120; }

    const colorSondeos = (s) => VIZ.css(VIZ.enRampa(Math.min(1, (s - 1) / 6)));
    const textoSobre = (s) => (s >= 4 ? C.sobre : C.tinta);

    let zonas = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const d = disp(W);
      const ox = Math.max(4, (W - d.porFila * d.ancho) / 2);
      zonas = [];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const visit = new Map();
      if (ultima && ultima.visitados) ultima.visitados.forEach((j, k) => { if (!visit.has(j)) visit.set(j, k + 1); });

      for (let j = 0; j < m; j++) {
        const fila = Math.floor(j / d.porFila), colu = j % d.porFila;
        const x = ox + colu * d.ancho + 3, y0 = fila * d.altoBloque + 6;
        const s = d.ancho - 6;
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(10);
        ctx.fillText(String(j), x + s / 2, y0 + 6);
        const y = y0 + 16;

        if (estr !== 'encadenamiento') {
          const c = tabla.celdas[j];
          ctx.fillStyle = c ? colorSondeos(c.sondeos) : C.superficie;
          ctx.fillRect(x, y, s, s);
          ctx.strokeStyle = C.eje;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
          if (c) {
            ctx.fillStyle = textoSobre(c.sondeos);
            ctx.font = VIZ.fuente(s > 46 ? 14 : 12, 500);
            ctx.fillText(String(c.k), x + s / 2, y + s / 2);
          }
          if (visit.has(j)) {
            const final = ultima.pos === j;
            ctx.strokeStyle = final ? C.s6 : C.s2;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
            ctx.fillStyle = final ? C.s6 : C.s2;
            ctx.font = VIZ.fuente(10, 500);
            ctx.fillText(String(visit.get(j)), x + s / 2, y + s + 9);
          }
          zonas.push({ x, y, w: s, h: s, j, c });
        } else {
          const lista = tabla.celdas[j];
          ctx.fillStyle = C.neutro;
          ctx.fillRect(x, y, s, 10);
          const esCubeta = ultima && ultima.cubeta === j;
          if (esCubeta) { ctx.fillStyle = C.s2; ctx.fillRect(x, y, s, 10); }
          lista.forEach((nodo, p) => {
            const ny = y + 18 + p * 30;
            ctx.strokeStyle = C.eje;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + s / 2, ny - 8);
            ctx.lineTo(x + s / 2, ny);
            ctx.stroke();
            ctx.fillStyle = colorSondeos(p + 1);
            ctx.fillRect(x, ny, s, 22);
            ctx.fillStyle = textoSobre(p + 1);
            ctx.font = VIZ.fuente(12, 500);
            ctx.fillText(String(nodo.k), x + s / 2, ny + 11);
            if (esCubeta && (p < ultima.examinados || p === ultima.pos)) {
              ctx.strokeStyle = p === ultima.pos ? C.s6 : C.s2;
              ctx.lineWidth = 3;
              ctx.strokeRect(x + 1.5, ny + 1.5, s - 3, 19);
            }
            zonas.push({ x, y: ny, w: s, h: 22, j, c: { k: nodo.k, sondeos: p + 1 } });
          });
          if (!lista.length) {
            ctx.fillStyle = C.eje;
            ctx.font = VIZ.fuente(11);
            ctx.fillText('∅', x + s / 2, y + 28);
          }
        }
      }

      const n = tabla.n;
      const exitos = claves.map((k) => {
        const r = tabla.buscar(k);
        return estr === 'encadenamiento' ? r.examinados : r.visitados.length;
      });
      const prom = exitos.length ? exitos.reduce((a, b) => a + b, 0) / exitos.length : 0;
      lectura.set([
        ['claves n', String(n)],
        ['cubetas m', String(m)],
        ['factor de carga α', (n / m).toFixed(2)],
        ['promedio búsqueda exitosa', exitos.length ? prom.toFixed(2) : '—'],
        ['última operación', ultima ? `${ultima.tipo} ${ultima.k}` : '—'],
        ['resultado', ultima ? ultima.resultado : '—'],
      ]);
      if (ultima) {
        const k = ultima.k;
        let txt = `h₁(${k}) = ${k} mod ${m} = <b>${h1(k, m)}</b>`;
        if (estr === 'doble') txt += ` · h₂(${k}) = 1 + (${k} mod ${m - 1}) = <b>${h2(k, m)}</b>`;
        if (ultima.visitados) txt += ` · secuencia de sondeo: ${ultima.visitados.join(' → ')}`;
        else txt += ` · elementos examinados en la lista: ${ultima.examinados}`;
        if (ultima.resultado === 'sin espacio') txt += ' · <b>la secuencia de sondeo no encontró una celda libre</b>';
        mensaje.innerHTML = txt;
      } else {
        mensaje.innerHTML = 'Inserte claves para ver cómo se distribuyen. Con sondeo lineal, observe cómo se forman bloques contiguos de celdas ocupadas (agrupamiento primario) que vuelven más caras las inserciones siguientes.';
      }
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const z = zonas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!z) return tip.ocultar();
      tip.mostrar(x, y, z.c
        ? `cubeta <b>${z.j}</b><br>clave <b>${z.c.k}</b> · h₁ = ${h1(z.c.k, m)}<br>${z.c.sondeos} ${estr === 'encadenamiento' ? 'comparaciones para hallarla' : 'sondeos al insertarla'}`
        : `cubeta <b>${z.j}</b><br>vacía`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());

    claves = [42, 55, 68, 16, 29, 3];
    reconstruir();
    lienzo.ajustar(true);
  }

  /* ---------- Fig. 2: costo esperado frente a α ---------- */

  const TEORIA = {
    encadenamiento: { exito: (a) => 1 + a / 2, fallo: (a) => a },
    lineal: { exito: (a) => 0.5 * (1 + 1 / (1 - a)), fallo: (a) => 0.5 * (1 + 1 / ((1 - a) * (1 - a))) },
    doble: { exito: (a) => (a < 1e-6 ? 1 : (1 / a) * Math.log(1 / (1 - a))), fallo: (a) => 1 / (1 - a) },
  };
  const SERIES = [
    ['encadenamiento', 'Encadenamiento', C.s1],
    ['lineal', 'Sondeo lineal', C.s2],
    ['doble', 'Doble hash (≈ hash uniforme)', C.s3],
  ];

  function simular() {
    const m = 2003;
    const res = { encadenamiento: [], lineal: [], doble: [] };
    for (const [estr] of SERIES) {
      const rnd = VIZ.semilla(estr.length * 97);
      const tabla = crearTabla(estr, m);
      const usadas = new Set();
      const claves = [];
      for (let paso = 1; paso <= 18; paso++) {
        const alfa = paso * 0.05;
        while (tabla.n < Math.floor(alfa * m)) {
          const k = Math.floor(rnd() * 1e9);
          if (usadas.has(k)) continue;
          usadas.add(k);
          tabla.insertar(k);
          claves.push(k);
        }
        let exito = 0;
        for (const k of claves) {
          const r = tabla.buscar(k);
          exito += estr === 'encadenamiento' ? r.examinados : r.visitados.length;
        }
        let fallo = 0;
        const pruebas = 3000;
        for (let t = 0; t < pruebas; t++) {
          let k;
          do k = Math.floor(rnd() * 1e9); while (usadas.has(k));
          const r = tabla.buscar(k);
          fallo += estr === 'encadenamiento' ? r.examinados : r.visitados.length;
        }
        res[estr].push({ alfa: tabla.n / m, exito: exito / claves.length, fallo: fallo / pruebas });
      }
    }
    return res;
  }

  function montarCurvas(cuerpo) {
    let caso = 'fallo', ymax = 12, empirico = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de búsqueda', opciones: [['fallo', 'Fallida (clave ausente)'], ['exito', 'Exitosa (clave presente)']], valor: caso,
      alCambiar: (v) => { caso = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Límite del eje vertical', min: 4, max: 50, valor: ymax, alCambiar: (v) => { ymax = v; dibujar(); } });
    const visibles = ctl.casillas(SERIES.map(([k, t, c]) => ({ clave: k, texto: t, color: c })), dibujar);

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...SERIES.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })),
      { color: C.tinta2, texto: 'puntos: simulación con m = 2003', forma: 'punto' },
    ]);
    VIZ.nota(cuerpo, 'Las curvas son las fórmulas teóricas; los puntos, mediciones sobre tablas reales con claves aleatorias. Para encadenamiento se cuentan los nodos examinados; para direccionamiento abierto, las celdas sondeadas.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 0.95, ymin: 0, ymax }, {
        etiquetaX: 'factor de carga α = n / m', etiquetaY: caso === 'fallo' ? 'sondeos esperados (búsqueda fallida)' : 'sondeos esperados (búsqueda exitosa)',
      });
      plano.ejes();
      ctx.save();
      plano.recortar();
      for (const [k, , c] of SERIES) {
        if (!visibles[k]) continue;
        const pts = [];
        for (let i = 0; i <= 190; i++) { const a = (0.95 * i) / 190; pts.push([a, TEORIA[k][caso](a)]); }
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (empirico) for (const p of empirico[k]) VIZ.marcador(ctx, plano.sx(p.alfa), plano.sy(p[caso]), c, 3.5);
      }
      if (hover != null) {
        const x = Math.round(plano.sx(hover)) + 0.5;
        ctx.strokeStyle = C.eje;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, plano.y1); ctx.lineTo(x, plano.y0); ctx.stroke();
      }
      ctx.restore();
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(0.95, plano.ix(x)));
      dibujar();
      const filas = SERIES.filter(([k]) => visibles[k]).map(([k, t, c]) => VIZ.filaTooltip(c, t, VIZ.fmt(TEORIA[k][caso](hover), 3)));
      tip.mostrar(x, y, `α = <b>${hover.toFixed(2)}</b>${filas.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
    setTimeout(() => { empirico = simular(); dibujar(); }, 30);
  }

  VIZ.registrarTema('hash', {
    intro: String.raw`
      <p>Una <strong>tabla hash</strong> implementa un diccionario —insertar, buscar y eliminar claves— en tiempo esperado
      constante. La idea es usar una <em>función hash</em> \(h\) que convierte cada clave en un índice de un arreglo de \(m\)
      cubetas, de modo que para encontrar una clave basta calcular \(h(k)\) e ir directamente a esa posición.</p>
      <p>Como hay muchas más claves posibles que cubetas, inevitablemente dos claves distintas caerán en la misma posición:
      una <strong>colisión</strong>. Las estrategias para resolverlas, y el grado de ocupación de la tabla, determinan cuán
      rápidas son las operaciones en la práctica.</p>`,
    visualizaciones: [
      {
        titulo: 'Inserción y búsqueda',
        descripcion: 'Cada celda muestra la clave guardada; su color indica cuántos sondeos costó insertarla. Las celdas con borde naranjo son las visitadas por la última operación, numeradas en orden.',
        montar: montarTabla,
      },
      {
        titulo: 'Costo esperado según el factor de carga',
        descripcion: 'Número esperado de sondeos de una búsqueda en función de \\(\\alpha = n/m\\). Las tablas con direccionamiento abierto se degradan rápidamente cuando \\(\\alpha \\to 1\\).',
        montar: montarCurvas,
      },
    ],
    teoria: String.raw`
      <h2>Funciones hash</h2>
      <p>Aquí se usa el <strong>método de la división</strong>, \(h(k) = k \bmod m\), con \(m\) primo para que patrones regulares
      en las claves (por ejemplo, todas pares) no se concentren en pocas cubetas. El análisis supone <strong>hash uniforme
      simple</strong>: cada clave cae en cualquiera de las \(m\) cubetas con probabilidad \(1/m\), independientemente de las demás.
      Una familia \(\mathcal{H}\) es <em>universal</em> si \(\Pr_{h \in \mathcal{H}}[h(x) = h(y)] \le 1/m\) para todo \(x \ne y\);
      por ejemplo \(h_{a,b}(k) = ((ak + b) \bmod p) \bmod m\).</p>

      <h2>Encadenamiento</h2>
      <p>Cada cubeta guarda una lista con las claves que caen en ella. Con \(n\) claves, el largo esperado de cada lista es el
      <strong>factor de carga</strong> \(\alpha = n/m\). Una búsqueda fallida recorre una lista completa y una exitosa, en promedio,
      la mitad de las claves insertadas después de la buscada:</p>
      \[ \mathbb{E}[\text{fallida}] = \alpha, \qquad \mathbb{E}[\text{exitosa}] = 1 + \frac{\alpha}{2} - \frac{\alpha}{2n}. \]
      <p>Si \(m\) crece proporcionalmente a \(n\) (\(\alpha = O(1)\)), todas las operaciones son \(O(1)\) en promedio. Con
      encadenamiento \(\alpha\) puede superar 1.</p>

      <h2>Direccionamiento abierto</h2>
      <p>Todas las claves se guardan en el propio arreglo (\(\alpha \le 1\)). Para la clave \(k\) se prueba la <em>secuencia de
      sondeo</em> \(h(k, 0), h(k, 1), \dots\) hasta encontrar la clave o una celda vacía:</p>
      \[
      \begin{aligned}
      \text{lineal:}\quad &amp; h(k,i) = (h_1(k) + i) \bmod m \\
      \text{cuadrático:}\quad &amp; h(k,i) = (h_1(k) + i^2) \bmod m \\
      \text{doble hash:}\quad &amp; h(k,i) = (h_1(k) + i\,h_2(k)) \bmod m, \qquad h_2(k) = 1 + (k \bmod (m-1))
      \end{aligned}
      \]
      <p>Bajo la hipótesis de <strong>hash uniforme</strong> (cada secuencia de sondeo es una permutación aleatoria de las cubetas,
      a lo que el doble hash se aproxima bien), la probabilidad de que los primeros \(i\) sondeos encuentren celdas ocupadas es a lo
      más \(\alpha^i\), y por lo tanto</p>
      \[ \mathbb{E}[\text{fallida}] \le \sum_{i \ge 0} \alpha^i = \frac{1}{1-\alpha}, \qquad
         \mathbb{E}[\text{exitosa}] \le \frac{1}{\alpha}\ln\frac{1}{1-\alpha}. \]
      <p>Con la tabla llena al 90 %, una búsqueda fallida requiere en promedio unos 10 sondeos.</p>

      <h2>Agrupamiento primario</h2>
      <p>El sondeo lineal es más sencillo y aprovecha mejor la caché, pero sufre de <strong>agrupamiento primario</strong>: las celdas
      ocupadas forman bloques contiguos, y una clave que cae en cualquier parte de un bloque lo alarga. Un bloque de largo \(\ell\)
      crece con probabilidad \((\ell + 2)/m\), así que los bloques grandes crecen más rápido. El análisis de Knuth (1963) da</p>
      \[ \mathbb{E}[\text{fallida}] \approx \frac{1}{2}\left(1 + \frac{1}{(1-\alpha)^2}\right), \qquad
         \mathbb{E}[\text{exitosa}] \approx \frac{1}{2}\left(1 + \frac{1}{1-\alpha}\right). \]
      <p>El sondeo cuadrático evita los bloques contiguos pero no el <em>agrupamiento secundario</em> (claves con el mismo
      \(h_1\) siguen la misma secuencia). Además, \(i^2 \bmod m\) solo toma \((m+1)/2\) valores distintos cuando \(m\) es primo:
      con \(\alpha &gt; 1/2\) puede no encontrar una celda libre aunque exista. Pruébelo en la figura 1 llenando una tabla pequeña.</p>

      <h2>Redimensionamiento</h2>
      <p>Las implementaciones reales mantienen \(\alpha\) acotado (por ejemplo \(\alpha \le 0.75\)) duplicando \(m\) y reinsertando
      todas las claves cuando se supera el umbral. Una duplicación cuesta \(\Theta(n)\), pero ocurre tras \(\Theta(n)\) inserciones,
      de modo que el costo <strong>amortizado</strong> por inserción sigue siendo \(O(1)\).</p>`,
  });
})();
