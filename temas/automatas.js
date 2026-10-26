(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Fig. 1: autómatas elementales ---------- */

  const CLASES = {
    0: 'I (uniforme)', 8: 'I (uniforme)', 32: 'I (uniforme)', 128: 'I (uniforme)', 160: 'I (uniforme)',
    4: 'II (periódica)', 108: 'II (periódica)', 184: 'II (periódica)', 1: 'II (periódica)', 50: 'II (periódica)', 94: 'II (periódica)',
    30: 'III (caótica)', 45: 'III (caótica)', 90: 'III (caótica)', 150: 'III (caótica)', 18: 'III (caótica)', 22: 'III (caótica)', 126: 'III (caótica)', 105: 'III (caótica)',
    110: 'IV (compleja)', 54: 'IV (compleja)', 137: 'IV (compleja)', 124: 'IV (compleja)', 193: 'IV (compleja)',
  };

  function montarElemental(cuerpo) {
    let regla = 30, ancho = 161, inicial = 'una', densidad = 0.5, colorear = true, semilla = 1;

    const ctl = VIZ.controles(cuerpo);
    const sRegla = ctl.rango({ etiqueta: 'Regla', min: 0, max: 255, valor: regla, alCambiar: (v) => { regla = v; dibujarTodo(); } });
    ctl.rango({ etiqueta: 'Ancho (celdas)', min: 41, max: 401, paso: 10, valor: ancho, alCambiar: (v) => { ancho = v | 1; lienzo.ajustar(true); } });
    ctl.selector({ etiqueta: 'Condición inicial', opciones: [['una', 'Una celda al centro'], ['aleatoria', 'Aleatoria']], valor: inicial,
      alCambiar: (v) => { inicial = v; dibujarTodo(); } });
    ctl.rango({ etiqueta: 'Densidad inicial', min: 0.05, max: 0.95, paso: 0.05, valor: densidad, formato: (v) => v.toFixed(2),
      alCambiar: (v) => { densidad = v; if (inicial === 'aleatoria') dibujarTodo(); } });
    ctl.casilla({ etiqueta: 'colorear según el vecindario', valor: colorear, alCambiar: (v) => { colorear = v; dibujarTodo(); } });
    for (const r of [30, 90, 110, 184, 54, 150, 73, 45]) ctl.boton(`Regla ${r}`, () => { regla = r; sRegla.valor = r; dibujarTodo(); });
    ctl.boton('Otra condición aleatoria', () => { semilla++; inicial = 'aleatoria'; dibujarTodo(); });

    // Tira con los 8 vecindarios: clic para alternar la salida.
    cuerpo.dataset.sinLeyenda = 'la tira de vecindarios funciona como leyenda';
    const tira = VIZ.lienzo(cuerpo, { alto: 74 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round((w / ancho) * Math.ceil(ancho / 2)) });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la celda inferior de cada vecindario para cambiar la regla. Con el coloreado activo, cada celda viva toma el color del vecindario que la produjo, de modo que la tira superior funciona como leyenda.');

    let geoTira = null;
    function dibujarTira() {
      const { ctx, ancho: W } = tira;
      tira.limpiar();
      const bloque = Math.min(78, (W - 8) / 8);
      const c = Math.min(16, (bloque - 12) / 3);
      const ox = (W - bloque * 8) / 2;
      geoTira = { ox, bloque, c };
      for (let k = 7; k >= 0; k--) {
        const pos = 7 - k;
        const bx = ox + pos * bloque + (bloque - 3 * c) / 2;
        for (let b = 0; b < 3; b++) {
          const viva = (k >> (2 - b)) & 1;
          ctx.fillStyle = viva ? C.tinta : C.superficie;
          ctx.fillRect(bx + b * c, 6, c, c);
          ctx.strokeStyle = C.eje;
          ctx.strokeRect(bx + b * c + 0.5, 6.5, c - 1, c - 1);
        }
        const sale = (regla >> k) & 1;
        ctx.fillStyle = sale ? (colorear ? VIZ.series[k] : C.tinta) : C.superficie;
        ctx.fillRect(bx + c, 10 + c, c, c);
        ctx.strokeStyle = sale ? C.tinta : C.eje;
        ctx.strokeRect(bx + c + 0.5, 10.5 + c, c - 1, c - 1);
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${sale}·2^${k}`, bx + 1.5 * c, 16 + 2 * c);
      }
    }
    tira.alDibujar = dibujarTira;
    tira.canvas.addEventListener('click', (ev) => {
      if (!geoTira) return;
      const { x } = tira.posicion(ev);
      const pos = Math.floor((x - geoTira.ox) / geoTira.bloque);
      if (pos < 0 || pos > 7) return;
      regla ^= 1 << (7 - pos);
      sRegla.valor = regla;
      dibujarTodo();
    });
    tira.canvas.style.cursor = 'pointer';

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar(C.superficie);
      const gens = Math.ceil(ancho / 2);
      const off = document.createElement('canvas');
      off.width = ancho;
      off.height = gens;
      const octx = off.getContext('2d');
      const img = octx.createImageData(ancho, gens);
      let fila = new Uint8Array(ancho);
      if (inicial === 'una') fila[ancho >> 1] = 1;
      else { const rnd = VIZ.semilla(semilla * 977); for (let i = 0; i < ancho; i++) fila[i] = rnd() < densidad ? 1 : 0; }
      let origen = new Int8Array(ancho).fill(-1);
      const rgb = VIZ.series.map((c) => VIZ.rgb(c));
      let vivasFinal = 0;
      for (let g = 0; g < gens; g++) {
        for (let i = 0; i < ancho; i++) {
          const o = 4 * (g * ancho + i);
          if (fila[i]) {
            const col = colorear && origen[i] >= 0 ? rgb[origen[i]] : [11, 11, 11];
            img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2];
          } else { img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; }
          img.data[o + 3] = 255;
        }
        if (g === gens - 1) vivasFinal = fila.reduce((a, b) => a + b, 0);
        const nueva = new Uint8Array(ancho);
        const nuevoOrigen = new Int8Array(ancho).fill(-1);
        for (let i = 0; i < ancho; i++) {
          const k = (fila[(i - 1 + ancho) % ancho] << 2) | (fila[i] << 1) | fila[(i + 1) % ancho];
          nueva[i] = (regla >> k) & 1;
          if (nueva[i]) nuevoOrigen[i] = k;
        }
        fila = nueva;
        origen = nuevoOrigen;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H);
      ctx.strokeStyle = C.tinta;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      lectura.set([
        ['regla', String(regla)],
        ['en binario', regla.toString(2).padStart(8, '0')],
        ['clase de Wolfram', CLASES[regla] || 'no catalogada aquí'],
        ['generaciones', String(gens)],
        ['densidad final', (vivasFinal / ancho).toFixed(3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    function dibujarTodo() { dibujarTira(); dibujar(); }
    dibujarTodo();
  }

  /* ---------- Fig. 2: Juego de la vida ---------- */

  const PATRONES = {
    planeador: ['.O.', '..O', 'OOO'],
    nave: ['.O..O', 'O....', 'O...O', 'OOOO.'],
    pulsar: ['..OOO...OOO..', '.............', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO..', '.............',
      '..OOO...OOO..', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '.............', '..OOO...OOO..'],
    canon: [
      '........................O...........',
      '......................O.O...........',
      '............OO......OO............OO',
      '...........O...O....OO............OO',
      'OO........O.....O...OO..............',
      'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........',
      '...........O...O....................',
      '............OO......................',
    ],
    rpentomino: ['.OO', 'OO.', '.O.'],
    bellota: ['.O.....', '...O...', 'OO..OOO'],
  };
  const REGLAS = {
    conway: { nombre: 'Conway B3/S23', B: [3], S: [2, 3] },
    highlife: { nombre: 'HighLife B36/S23', B: [3, 6], S: [2, 3] },
    seeds: { nombre: 'Seeds B2/S', B: [2], S: [] },
    diaNoche: { nombre: 'Día y noche B3678/S34678', B: [3, 6, 7, 8], S: [3, 4, 6, 7, 8] },
    laberinto: { nombre: 'Laberinto B3/S12345', B: [3], S: [1, 2, 3, 4, 5] },
  };

  function montarVida(cuerpo) {
    const COLS = 90, FILAS = 54, N = COLS * FILAS;
    let celdas = new Uint8Array(N), edad = new Uint16Array(N);
    let gen = 0, velocidad = 15, regla = 'conway', toroidal = true;
    let historia = [];

    function poblacion() { let p = 0; for (let i = 0; i < N; i++) p += celdas[i]; return p; }
    function colocar(nombre) {
      celdas.fill(0); edad.fill(0); gen = 0; historia = [];
      if (nombre === 'aleatorio') {
        for (let i = 0; i < N; i++) celdas[i] = Math.random() < 0.28 ? 1 : 0;
      } else {
        const p = PATRONES[nombre];
        const f0 = Math.floor((FILAS - p.length) / 2), c0 = nombre === 'canon' ? 4 : Math.floor((COLS - p[0].length) / 2);
        p.forEach((fila, f) => [...fila].forEach((ch, c) => { if (ch === 'O') celdas[(f0 + f) * COLS + c0 + c] = 1; }));
      }
      for (let i = 0; i < N; i++) edad[i] = celdas[i] ? 1 : 0;
      historia.push(poblacion());
    }
    function avanzar() {
      const { B, S } = REGLAS[regla];
      const nb = new Uint8Array(9), ns = new Uint8Array(9);
      B.forEach((k) => (nb[k] = 1));
      S.forEach((k) => (ns[k] = 1));
      const nueva = new Uint8Array(N);
      for (let f = 0; f < FILAS; f++) {
        for (let c = 0; c < COLS; c++) {
          let v = 0;
          for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!df && !dc) continue;
              let ff = f + df, cc = c + dc;
              if (toroidal) { ff = (ff + FILAS) % FILAS; cc = (cc + COLS) % COLS; }
              else if (ff < 0 || ff >= FILAS || cc < 0 || cc >= COLS) continue;
              v += celdas[ff * COLS + cc];
            }
          }
          const i = f * COLS + c;
          nueva[i] = celdas[i] ? ns[v] : nb[v];
          edad[i] = nueva[i] ? (celdas[i] ? Math.min(edad[i] + 1, 65535) : 1) : 0;
        }
      }
      celdas = nueva;
      gen++;
      historia.push(poblacion());
      if (historia.length > 400) historia.shift();
    }

    const ctl = VIZ.controles(cuerpo);
    const sPatron = ctl.selector({ etiqueta: 'Patrón', opciones: [['aleatorio', 'Aleatorio'], ['planeador', 'Planeador'], ['nave', 'Nave ligera (LWSS)'],
      ['pulsar', 'Púlsar (oscilador)'], ['canon', 'Cañón de planeadores de Gosper'], ['rpentomino', 'R-pentominó'], ['bellota', 'Bellota (acorn)']], valor: 'aleatorio',
      alCambiar: (v) => { colocar(v); dibujarTodo(); } });
    ctl.selector({ etiqueta: 'Reglas', opciones: Object.entries(REGLAS).map(([k, r]) => [k, r.nombre]), valor: regla, alCambiar: (v) => { regla = v; } });
    ctl.selector({ etiqueta: 'Bordes', opciones: [['toro', 'Toroidales (envuelven)'], ['muertos', 'Fijos (fuera = muertas)']], valor: 'toro',
      alCambiar: (v) => { toroidal = v === 'toro'; } });
    ctl.rango({ etiqueta: 'Generaciones por segundo', min: 1, max: 60, valor: velocidad, alCambiar: (v) => { velocidad = v; } });
    const bPlay = ctl.boton('Reproducir', () => (bucle.activo ? bucle.detener() : (bPlay.textContent = 'Pausar', bucle.iniciar())), { primario: true });
    ctl.boton('Una generación', () => { bucle.detener(); avanzar(); dibujarTodo(); });
    ctl.boton('Reiniciar patrón', () => { colocar(sPatron.valor); dibujarTodo(); });
    ctl.boton('Limpiar', () => { celdas.fill(0); edad.fill(0); gen = 0; historia = [0]; dibujarTodo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round((w / COLS) * FILAS) });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'recién nacida' },
      { color: VIZ.rampa[5], texto: 'viva, joven' },
      { color: VIZ.rampa[12], texto: 'viva, estable por muchas generaciones' },
    ]);
    const poblacionLienzo = VIZ.lienzo(cuerpo, { alto: 110 });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre sobre la cuadrícula para dibujar o borrar celdas, incluso mientras corre la simulación.');

    let acumulado = 0;
    const bucle = VIZ.bucle((dt) => {
      acumulado += dt;
      const intervalo = 1000 / velocidad;
      if (acumulado < intervalo) return true;
      acumulado = Math.min(acumulado - intervalo, intervalo);
      avanzar();
      dibujarTodo();
      return true;
    }, () => { bPlay.textContent = 'Reproducir'; });

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar(C.superficie);
      const cs = W / COLS;
      const naranjo = C.s2;
      for (let i = 0; i < N; i++) {
        if (!celdas[i]) continue;
        const f = Math.floor(i / COLS), c = i % COLS;
        ctx.fillStyle = edad[i] <= 1 ? naranjo : VIZ.css(VIZ.enRampa(0.4 + 0.6 * Math.min(1, Math.log2(edad[i]) / 6)));
        ctx.fillRect(c * cs + 0.5, f * cs + 0.5, Math.max(1, cs - 1), Math.max(1, cs - 1));
      }
      if (cs >= 6) {
        ctx.strokeStyle = VIZ.alfa(C.tinta, 0.05);
        ctx.beginPath();
        for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, H); }
        for (let f = 0; f <= FILAS; f++) { ctx.moveTo(0, f * cs); ctx.lineTo(W, f * cs); }
        ctx.stroke();
      }
      ctx.strokeStyle = C.tinta;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    }
    function dibujarPoblacion() {
      const { ctx } = poblacionLienzo;
      poblacionLienzo.limpiar();
      const ymax = Math.max(10, ...historia) * 1.1;
      const x0 = Math.max(0, gen - historia.length + 1);
      const p = VIZ.plano(poblacionLienzo, { xmin: x0, xmax: Math.max(x0 + 50, gen), ymin: 0, ymax }, {
        etiquetaY: 'población', margen: { inf: 24, sup: 18 }, formatoX: (v) => VIZ.entero(v),
      });
      p.ejes();
      VIZ.trazar(ctx, p, historia.map((v, i) => [x0 + i, v]), C.s1, 1.5);
    }
    function dibujarTodo() {
      dibujar();
      dibujarPoblacion();
      lectura.set([
        ['generación', VIZ.entero(gen)],
        ['población', VIZ.entero(historia[historia.length - 1] ?? poblacion())],
        ['densidad', (poblacion() / N).toFixed(3)],
        ['reglas', REGLAS[regla].nombre.split(' ').pop()],
      ]);
    }
    lienzo.alDibujar = dibujar;
    poblacionLienzo.alDibujar = dibujarPoblacion;

    let pintando = null;
    const celdaEn = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const cs = lienzo.ancho / COLS;
      const c = Math.floor(x / cs), f = Math.floor(y / cs);
      return c >= 0 && c < COLS && f >= 0 && f < FILAS ? f * COLS + c : -1;
    };
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const i = celdaEn(ev);
      if (i < 0) return;
      lienzo.canvas.setPointerCapture(ev.pointerId);
      pintando = celdas[i] ? 0 : 1;
      celdas[i] = pintando;
      edad[i] = pintando;
      historia[historia.length - 1] = poblacion();
      dibujarTodo();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (pintando == null) return;
      const i = celdaEn(ev);
      if (i < 0 || celdas[i] === pintando) return;
      celdas[i] = pintando;
      edad[i] = pintando;
      historia[historia.length - 1] = poblacion();
      dibujarTodo();
    });
    const soltar = () => { pintando = null; };
    lienzo.canvas.addEventListener('pointerup', soltar);
    lienzo.canvas.addEventListener('pointercancel', soltar);
    lienzo.canvas.style.cursor = 'crosshair';

    colocar('aleatorio');
    dibujarTodo();
  }

  VIZ.registrarTema('automatas', {
    intro: String.raw`
      <p>Un <strong>autómata celular</strong> es una fila (o cuadrícula) de celdas, cada una en un estado finito —aquí, viva o
      muerta—, que evolucionan en pasos discretos. En cada paso todas las celdas se actualizan a la vez aplicando la misma regla
      <em>local</em>: el nuevo estado depende solo del estado de la celda y de sus vecinas.</p>
      <p>Son uno de los ejemplos más claros de cómo reglas extremadamente simples pueden producir comportamiento complejo:
      patrones fractales, aparente aleatoriedad, estructuras que se desplazan e incluso computación universal.</p>`,
    visualizaciones: [
      {
        titulo: 'Autómatas celulares elementales',
        descripcion: 'Cada fila es una generación; el tiempo avanza hacia abajo. La regla especifica la salida para cada uno de los 8 vecindarios posibles de tres celdas. Pruebe la regla 30 (caótica), la 90 (triángulo de Sierpiński) y la 110 (Turing-completa).',
        montar: montarElemental,
      },
      {
        titulo: 'El Juego de la vida',
        descripcion: 'Una cuadrícula bidimensional donde cada celda mira a sus ocho vecinas. El color indica cuánto tiempo lleva viva cada celda; el gráfico inferior muestra la población.',
        montar: montarVida,
      },
    ],
    teoria: String.raw`
      <h2>Definición formal</h2>
      <p>Un autómata celular unidimensional binario con radio 1 es una función de transición local
      \(\varphi : \{0,1\}^3 \to \{0,1\}\). La configuración en el tiempo \(t\) es \(x^{(t)} \in \{0,1\}^{\mathbb{Z}_n}\) (con bordes periódicos)
      y evoluciona según</p>
      \[ x_i^{(t+1)} = \varphi\big(x_{i-1}^{(t)},\, x_i^{(t)},\, x_{i+1}^{(t)}\big). \]
      <p>Hay \(2^3 = 8\) vecindarios posibles y para cada uno se elige una salida, así que existen \(2^8 = 256\) reglas. La
      <strong>numeración de Wolfram</strong> lee las salidas como un número binario, ordenando los vecindarios de 111 a 000:</p>
      \[ R = \sum_{k=0}^{7} \varphi(k)\, 2^k, \qquad k = 4a + 2b + c \text{ para el vecindario } (a,b,c). \]
      <p>Por ejemplo, la regla 30 es \(00011110_2\): \(\varphi(a,b,c) = a \oplus (b \lor c)\).</p>

      <h2>Reglas lineales y el triángulo de Sierpiński</h2>
      <p>La regla 90 es \(\varphi(a,b,c) = a \oplus c\), lineal sobre \(\mathbb{F}_2\). Partiendo de una celda, por inducción el estado en
      la posición \(i\) (medida desde el centro) en la generación \(t\) es</p>
      \[ x_i^{(t)} = \binom{t}{(t+i)/2} \bmod 2, \]
      <p>es decir, el triángulo de Pascal módulo 2. Por el teorema de Lucas, \(\binom{t}{k}\) es impar exactamente cuando los bits de
      \(k\) son un subconjunto de los de \(t\), lo que produce el fractal de Sierpiński, de dimensión \(\log_2 3 \approx 1.585\).</p>

      <h2>Clases de Wolfram</h2>
      <p>Wolfram (1984) clasificó empíricamente el comportamiento a partir de condiciones aleatorias en cuatro clases:</p>
      <ol>
        <li><strong>Uniforme:</strong> casi toda condición inicial lleva a un estado homogéneo (regla 0, 32).</li>
        <li><strong>Periódica:</strong> estructuras estables o periódicas localizadas (regla 4, 108, 184).</li>
        <li><strong>Caótica:</strong> patrones aperiódicos y sensibles a las condiciones iniciales (regla 30, 90, 45).
        La columna central de la regla 30 se usó como generador de números pseudoaleatorios en <em>Mathematica</em>.</li>
        <li><strong>Compleja:</strong> estructuras localizadas que se desplazan e interactúan (regla 110, 54).</li>
      </ol>
      <p>Matthew Cook demostró (2004) que la <strong>regla 110 es Turing-completa</strong>: con una condición inicial adecuada puede
      simular cualquier computación. Las colisiones entre sus «planeadores» actúan como compuertas lógicas.</p>

      <h2>El Juego de la vida</h2>
      <p>Propuesto por John Conway en 1970, usa una cuadrícula bidimensional y la vecindad de Moore (las 8 celdas adyacentes).
      Si \(v\) es el número de vecinas vivas:</p>
      \[ x^{(t+1)} = \begin{cases} 1 &amp; \text{si } x^{(t)} = 0 \text{ y } v = 3 \quad \text{(nacimiento)} \\ 1 &amp; \text{si } x^{(t)} = 1 \text{ y } v \in \{2, 3\} \quad \text{(supervivencia)} \\ 0 &amp; \text{en otro caso.} \end{cases} \]
      <p>Esta regla se abrevia <strong>B3/S23</strong>; la figura permite probar otras de la misma familia («Life-like»). Algunos
      hechos notables:</p>
      <ul>
        <li>El <em>planeador</em> se traslada una celda en diagonal cada 4 generaciones: velocidad \(c/4\), donde \(c\) (una celda por
        generación) es la máxima velocidad posible de propagación de información.</li>
        <li>El <em>cañón de Gosper</em> (1970) emite un planeador cada 30 generaciones, por lo que la población crece sin cota:
        respondió la pregunta de Conway sobre si existían patrones de crecimiento infinito.</li>
        <li>El <em>R-pentominó</em>, con solo 5 celdas, tarda 1103 generaciones en estabilizarse (sin bordes).</li>
        <li>El Juego de la vida es Turing-completo: con flujos de planeadores pueden construirse compuertas lógicas, memoria e
        incluso una implementación de sí mismo. En consecuencia, predecir si un patrón llegará a extinguirse es indecidible.</li>
      </ul>`,
  });
})();
