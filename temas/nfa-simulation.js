(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  // «El n-ésimo símbolo desde el final es 1»: AFN con n + 1 estados, AFD con 2ⁿ.
  function enesimo(n) {
    const trans = [[0, ['0', '1'], 0], [0, '1', 1]];
    for (let i = 1; i < n; i++) trans.push([i, ['0', '1'], i + 1]);
    return A.construir({ n: n + 1, ini: [0], fin: [n], trans });
  }

  /* ---------- Fig. 1: tres estrategias de simulación ---------- */

  function costos(nfa, texto) {
    const grado = (S) => { let c = 0; for (const q of S) c += A.ady(nfa)[q].length; return c; };
    // 1. Simular el AFN con conjuntos de estados
    let S = A.inicial(nfa), acum = 0;
    const simulacion = [], act = [];
    for (const ch of texto) { acum += grado(S) + S.size; act.push(S.size); S = A.paso(nfa, S, ch); simulacion.push(acum); }
    // 2. Determinizar todo antes de empezar
    const det = A.determinizar(nfa);
    let build = 0;
    for (const T of det.subs) build += grado(T) * nfa.alf.length;
    const completo = texto.split('').map((_, i) => build + i + 1);
    // 3. Determinizar bajo demanda con caché
    const cache = new Map();
    let T = A.inicial(nfa), acumL = 0, fallos = 0;
    const perezoso = [];
    for (const ch of texto) {
      const clave = A.ord(T).join(',') + '|' + ch;
      if (cache.has(clave)) { acumL += 1; T = cache.get(clave); } else { acumL += grado(T) + T.size + 1; fallos++; const sig = A.paso(nfa, T, ch); cache.set(clave, sig); T = sig; }
      perezoso.push(acumL);
    }
    return { simulacion, completo, perezoso, build, fallos, estadosDFA: det.subs.length, estadosVistos: new Set([...cache.keys()].map((k) => k.split('|')[0])).size, activoMedio: act.reduce((s, x) => s + x, 0) / Math.max(1, act.length) };
  }

  function montarCostos(cuerpo) {
    let n = 8, T = 600, semilla = 1, res = null, plano = null, hover = null, texto = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'n (estados del AFN = n + 1)', min: 3, max: 12, valor: n, alCambiar: (v) => { n = v; calcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud del texto', min: 50, max: 3000, paso: 50, valor: T, alCambiar: (v) => { T = v; calcular(); dibujar(); } });
    ctl.boton('Nuevo texto', () => { semilla++; calcular(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'simular el AFN con conjuntos', forma: 'linea' },
      { color: C.s2, texto: 'construir todo el AFD primero', forma: 'linea' },
      { color: C.s3, texto: 'AFD perezoso (con caché)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Unidades: aristas examinadas o consultas a tabla. El AFD completo paga todo al inicio; el perezoso solo paga por los subconjuntos que el texto visita,; el AFN paga por símbolo una cantidad proporcional a sus estados activos.');
    function calcular() {
      const rnd = VIZ.semilla(semilla * 13 + n);
      texto = Array.from({ length: T }, () => (rnd() < 0.5 ? '0' : '1')).join('');
      res = costos(enesimo(n), texto);
    }
    function dibujar() {
      const { ctx } = lienzo, N = texto.length;
      lienzo.limpiar();
      const mx = Math.max(res.simulacion[N - 1], res.completo[N - 1], res.perezoso[N - 1]);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: N, ymin: 0, ymax: mx * 1.05 }, { etiquetaX: 'símbolos leídos', etiquetaY: 'costo acumulado' });
      plano.ejes();
      const muestra = (arr) => { const p = [[0, arr === res.completo ? res.build : 0]]; const paso = Math.max(1, Math.floor(N / 200)); for (let i = paso - 1; i < N; i += paso) p.push([i + 1, arr[i]]); return p; };
      VIZ.trazar(ctx, plano, muestra(res.simulacion), C.s1, 2);
      VIZ.trazar(ctx, plano, muestra(res.completo), C.s2, 2);
      VIZ.trazar(ctx, plano, muestra(res.perezoso), C.s3, 2);
      const cruce = res.completo.findIndex((c, i) => c < res.simulacion[i]);
      registro.textContent = cruce >= 0 ? `El AFD completo supera al AFN a partir del símbolo ${cruce + 1}: antes de eso, construirlo no compensa.` : 'Con este texto el AFD completo nunca compensa su costo de construcción.';
      lectura.set([['estados del AFN', String(n + 1)], ['estados del AFD completo', VIZ.entero(res.estadosDFA)], ['subconjuntos que el texto visita', VIZ.entero(res.estadosVistos)], ['estados activos (promedio)', VIZ.fmt(res.activoMedio, 3)], ['cálculos del perezoso (fallos de caché)', VIZ.entero(res.fallos)], ['costo final AFN / completo / perezoso', `${VIZ.entero(res.simulacion[N - 1])} / ${VIZ.entero(res.completo[N - 1])} / ${VIZ.entero(res.perezoso[N - 1])}`]]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { tip.ocultar(); return; }
      const i = Math.max(1, Math.min(texto.length, Math.round(plano.ix(x))));
      tip.mostrar(x, y, `símbolo <b>${i}</b>` + VIZ.filaTooltip(C.s1, 'AFN', VIZ.entero(res.simulacion[i - 1])) + VIZ.filaTooltip(C.s2, 'AFD completo', VIZ.entero(res.completo[i - 1])) + VIZ.filaTooltip(C.s3, 'perezoso', VIZ.entero(res.perezoso[i - 1])));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    void hover;
    calcular();
    dibujar();
  }

  /* ---------- Fig. 2: simulación en paralelo con bits (Shift-And) ---------- */

  function montarBits(cuerpo) {
    let patron = 'abab', texto = 'ababbabababaab', col = 0, ocurr = [], D = [], B = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Patrón (hasta 10)', valor: patron, alCambiar: (v) => { patron = v.replace(/\s/g, '').slice(0, 10); rep.reiniciar(); }, alEnter: (v) => { patron = v.replace(/\s/g, '').slice(0, 10); rep.reiniciar(); } });
    ctl.texto({ etiqueta: 'Texto (hasta 30)', valor: texto, alCambiar: (v) => { texto = v.replace(/\s/g, '').slice(0, 30); rep.reiniciar(); }, alEnter: (v) => { texto = v.replace(/\s/g, '').slice(0, 30); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 60 + Math.max(2, patron.length) * 26 + 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.4), borde: C.s1, texto: 'estado activo: el prefijo del patrón de ese largo termina aquí' },
      { color: VIZ.alfa(C.s6, 0.4), borde: C.s6, texto: 'patrón completo: ocurrencia' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un estado del AFN del patrón (prefijo emparejado de largo i). La columna nueva se calcula con una sola operación de palabra: D ← ((D ≪ 1) | 1) & B[c]. Pase el cursor sobre una celda.');

    function iniciar() {
      const m = patron.length;
      B = {}; [...patron].forEach((c, i) => { B[c] = (B[c] || 0) | (1 << i); });
      D = []; ocurr = []; col = 0;
      let d = 0;
      return (function* () {
        for (let j = 0; j < texto.length; j++) {
          d = (((d << 1) | 1) & (B[texto[j]] || 0)) >>> 0;
          D.push(d); col = j + 1;
          if (m && d & (1 << (m - 1))) ocurr.push(j - m + 1);
          yield;
        }
      })();
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo, m = patron.length, T = texto.length;
      lienzo.limpiar();
      const celda = Math.max(14, Math.min(26, Math.floor((W - 90) / Math.max(1, T)))), x0 = 70, y0 = 34;
      geo = { x0, y0, celda };
      ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [...texto].forEach((c, j) => { ctx.fillStyle = j < col ? C.tinta : C.inactivo; ctx.fillText(c, x0 + j * celda + celda / 2, y0 - 14); });
      for (let i = 0; i < m; i++) {
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(`${patron.slice(0, i + 1)}`, x0 - 6, y0 + i * 26 + 13); ctx.textAlign = 'center';
        for (let j = 0; j < T; j++) {
          const on = j < col && (D[j] >> i) & 1, fin = on && i === m - 1;
          ctx.fillStyle = on ? VIZ.alfa(fin ? C.s6 : C.s1, 0.4) : C.neutro; ctx.strokeStyle = on ? (fin ? C.s6 : C.s1) : C.rejilla; ctx.lineWidth = on ? 1.5 : 1;
          ctx.fillRect(x0 + j * celda, y0 + i * 26, celda - 1, 24); ctx.strokeRect(x0 + j * celda + 0.5, y0 + i * 26 + 0.5, celda - 2, 23);
        }
      }
      const bits = (v) => Array.from({ length: m }, (_, i) => ((v >> i) & 1 ? '1' : '0')).join('');
      const ultima = col ? D[col - 1] : 0;
      registro.textContent = col ? `Tras leer «${texto[col - 1]}»: D = ${bits(ultima)} (bit i = prefijo de largo i+1 emparejado). ${m && ultima & (1 << (m - 1)) ? `¡Ocurrencia terminando en la posición ${col - 1}!` : ''}` : 'Pulse «Un paso» para leer el primer símbolo del texto.';
      lectura.set([['patrón', patron || '—'], ['posiciones leídas', `${col} de ${T}`], ['ocurrencias (posición de inicio)', ocurr.length ? ocurr.join(', ') : 'ninguna'], ['operaciones de palabra', String(col) + ' (una por símbolo)'], ['estados del AFN', String(m + 1)]]);
    }
    lienzo.alDibujar = () => D && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const j = Math.floor((x - geo.x0) / geo.celda), i = Math.floor((y - geo.y0) / 26);
      if (j < 0 || j >= texto.length || i < 0 || i >= patron.length || j >= col) return tip.ocultar();
      const on = (D[j] >> i) & 1;
      tip.mostrar(x, y, `texto[${j}] = <b>${texto[j]}</b><br>prefijo «${patron.slice(0, i + 1)}» ${on ? '<b>termina aquí</b>' : 'no termina aquí'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('nfa-simulation', {
    intro: String.raw`
      <p>Para usar un AFN en serio —en un buscador, en un motor de expresiones— no se «adivina»: se <strong>simula</strong>. Hay tres caminos. Seguir el conjunto de estados activos a cada símbolo (barato en memoria, costo proporcional al tamaño del conjunto por símbolo); determinizar todo antes (costo inicial exponencial en el peor caso, pero luego una consulta por símbolo); o determinizar <em>bajo demanda</em>, guardando en una caché los subconjuntos que el texto realmente visita.</p>
      <p>Además, si los estados caben en una palabra de máquina, el conjunto activo es un vector de bits y un paso se calcula con unas pocas instrucciones.</p>`,
    visualizaciones: [
      {
        titulo: 'Costo de tres estrategias',
        descripcion: 'Aumente n y la longitud del texto: el AFD completo paga un costo inicial enorme, el AFN paga siempre, y el perezoso solo por lo que visita.',
        montar: montarCostos,
      },
      {
        titulo: 'El AFN en paralelo con bits (Shift-And)',
        descripcion: 'Cada fila es un estado del AFN del patrón y cada columna una posición del texto. Una sola operación de palabra actualiza todas las filas a la vez.',
        montar: montarBits,
      },
    ],
    teoria: String.raw`
      <h2>Simulación con conjuntos</h2>
      <pre><code>S ← ε-clausura(I)
para cada símbolo a del texto:
    S ← ε-clausura( ⋃ δ(q, a) para q ∈ S )
aceptar si S ∩ F ≠ ∅</code></pre>
      <p>Cada paso cuesta \(O(|Q| + |\delta|)\) en el peor caso, así que el total es \(O(|w|\,(|Q| + |\delta|))\), sin memoria extra. No depende de \(2^{|Q|}\): el conjunto activo nunca supera \(|Q|\).</p>
      <h2>Tres estrategias</h2>
      <table>
        <tr><th>Estrategia</th><th>Preparación</th><th>Por símbolo</th><th>Memoria</th></tr>
        <tr><td>Simular el AFN</td><td>ninguna</td><td>\(O(|Q| + |\delta|)\)</td><td>\(O(|Q|)\)</td></tr>
        <tr><td>AFD completo</td><td>hasta \(O(2^{|Q|}|\Sigma|)\)</td><td>\(O(1)\)</td><td>hasta \(O(2^{|Q|})\)</td></tr>
        <tr><td>AFD perezoso</td><td>ninguna</td><td>\(O(1)\) si el subconjunto está en caché; si no, como el AFN</td><td>solo lo visitado (con límite de caché)</td></tr>
      </table>
      <p>La estrategia perezosa es la que usan los motores de expresiones regulares «de autómata» (RE2, el motor de Go, <code>grep</code>): hay textos adversariales que visitan muchos subconjuntos, y entonces vaciar la caché y seguir con la simulación del AFN garantiza un tiempo lineal.</p>
      <h2>Paralelismo de bits (Shift-And)</h2>
      <p>Para un patrón \(p = p_1\cdots p_m\), el AFN tiene estados \(0, 1, \dots, m\) y una transición \(i-1 \to i\) con \(p_i\); el estado 0 se queda en sí mismo con cualquier símbolo. Con un bit por estado y una máscara \(B[c]\) con un 1 en cada posición \(i\) donde \(p_i = c\):</p>
      \[ D \leftarrow \bigl((D \ll 1) \mid 1\bigr) \,\&\, B[c], \]
      <p>y hay una ocurrencia cuando el bit \(m\) de \(D\) vale 1. Costo \(O(|w|\lceil m/W\rceil)\) con palabras de \(W\) bits. Es la alternativa «de bits» al algoritmo de <a href="tema.html?id=kmp-search">Knuth-Morris-Pratt</a>, que en cambio usa la función de prefijos para saltar.</p>
      <div class="recuadro"><p>Un AFN de \(n\) estados puede forzar \(2^n\) subconjuntos distintos (<a href="tema.html?id=subset-blowup">State Explosion in Determinization</a>); simular o determinizar de forma perezosa evita pagar ese costo salvo cuando el texto lo exige.</p></div>`,
  });
})();
