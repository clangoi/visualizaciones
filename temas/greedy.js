(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Fig. 1: selección de actividades ---------- */

  const CRITERIOS = [
    ['fin', 'Termina antes (óptimo)'],
    ['inicio', 'Empieza antes'],
    ['duracion', 'Más corta'],
    ['conflictos', 'Menos conflictos'],
  ];

  function montarActividades(cuerpo) {
    let n = 12, criterio = 'fin', semilla = 4, acts = [], orden = [], estado = [], actual = -1, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Actividades', min: 5, max: 20, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Criterio codicioso', opciones: CRITERIOS, valor: criterio, alCambiar: (v) => { criterio = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevas actividades', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => n * 22 + 46 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'elegida' },
      { color: '#d9d8d2', texto: 'descartada (se superpone con una elegida)' },
      { color: C.superficie, borde: C.s2, texto: 'la que se examina' },
    ]);
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);

    const solapan = (a, b) => a.ini < b.fin && b.ini < a.fin;
    function optimo() {
      let k = 0, fin = -Infinity;
      for (const a of acts.slice().sort((p, q) => p.fin - q.fin)) if (a.ini >= fin) { k++; fin = a.fin; }
      return k;
    }
    function iniciar() {
      const rnd = VIZ.semilla(semilla * 101 + n);
      acts = Array.from({ length: n }, (_, i) => {
        const dur = criterio === 'duracion' && i === 0 ? 2 : 1 + Math.floor(rnd() * 6);
        const ini = Math.floor(rnd() * (24 - dur));
        return { id: i, ini, fin: ini + dur };
      });
      acts.forEach((a) => { a.conf = acts.filter((b) => b !== a && solapan(a, b)).length; });
      const clave = { fin: (a) => [a.fin, a.ini], inicio: (a) => [a.ini, a.fin], duracion: (a) => [a.fin - a.ini, a.ini], conflictos: (a) => [a.conf, a.fin] }[criterio];
      orden = acts.slice().sort((p, q) => { const x = clave(p), y = clave(q); return x[0] - y[0] || x[1] - y[1]; });
      estado = new Array(n).fill(null);
      actual = -1;
      mensaje = `Las actividades se listan de arriba hacia abajo en el orden del criterio «${CRITERIOS.find((c) => c[0] === criterio)[1]}».`;
      return (function* () {
        const elegidas = [];
        for (let k = 0; k < orden.length; k++) {
          const a = orden[k];
          actual = k;
          const choca = elegidas.find((b) => solapan(a, b));
          if (choca) {
            estado[k] = 'no';
            mensaje = `[${a.ini}, ${a.fin}) se superpone con [${choca.ini}, ${choca.fin}), que ya fue elegida: se descarta.`;
          } else {
            estado[k] = 'si';
            elegidas.push(a);
            mensaje = `[${a.ini}, ${a.fin}) es compatible con todas las elegidas: se elige sin reconsiderar nunca esta decisión.`;
          }
          yield;
        }
        actual = -1;
        const opt = optimo();
        mensaje = `Se eligieron ${elegidas.length} actividades; el óptimo es ${opt}. ${elegidas.length === opt ? 'Este criterio logró el óptimo en este caso.' : 'Este criterio NO es óptimo: hay un contraejemplo a la vista.'}`;
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 30, der = 14, sx = (t) => izq + (t / 24) * (W - izq - der);
      ctx.font = VIZ.fuente(10);
      ctx.fillStyle = C.apagado;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let t = 0; t <= 24; t += 2) {
        ctx.strokeStyle = C.rejilla;
        ctx.beginPath(); ctx.moveTo(sx(t) + 0.5, 18); ctx.lineTo(sx(t) + 0.5, 30 + n * 22); ctx.stroke();
        ctx.fillText(String(t), sx(t), 2);
      }
      geo = { sx, filas: [] };
      orden.forEach((a, k) => {
        const y = 26 + k * 22;
        const st = estado[k];
        ctx.fillStyle = st === 'si' ? C.s1 : st === 'no' ? '#e9e8e3' : C.superficie;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(sx(a.ini) + 1, y, sx(a.fin) - sx(a.ini) - 2, 15, 3); else ctx.rect(sx(a.ini) + 1, y, sx(a.fin) - sx(a.ini) - 2, 15);
        ctx.fill();
        ctx.lineWidth = k === actual ? 3 : 1;
        ctx.strokeStyle = k === actual ? C.s2 : st === 'si' ? C.s1 : st === 'no' ? '#c3c2b7' : C.tinta;
        ctx.stroke();
        ctx.fillStyle = C.apagado;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), izq - 8, y + 8);
        if (st === 'si') {
          ctx.strokeStyle = VIZ.alfa(C.s1, 0.25);
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          for (const t of [a.ini, a.fin]) { ctx.beginPath(); ctx.moveTo(sx(t), 20); ctx.lineTo(sx(t), 30 + n * 22); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        geo.filas.push({ y, a });
      });
      registro.textContent = mensaje;
      lectura.set([
        ['elegidas', String(estado.filter((x) => x === 'si').length)],
        ['descartadas', String(estado.filter((x) => x === 'no').length)],
        ['óptimo', String(optimo())],
      ]);
    }
    lienzo.alDibujar = () => acts.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const f = geo.filas.find((q) => y >= q.y && y <= q.y + 15 && x >= geo.sx(q.a.ini) && x <= geo.sx(q.a.fin));
      if (!f) return tip.ocultar();
      tip.mostrar(x, y, `[${f.a.ini}, ${f.a.fin})<br>duración ${f.a.fin - f.a.ini}<br>${f.a.conf} conflictos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: dar vuelto ---------- */

  const SISTEMAS = [
    ['1,5,10,50,100,500', 'Pesos chilenos: 1, 5, 10, 50, 100, 500'],
    ['1,5,10,25', 'Centavos de dólar: 1, 5, 10, 25'],
    ['1,10,25', '1, 10, 25'],
    ['1,3,4', '1, 3, 4'],
    ['1,7,10', '1, 7, 10'],
  ];

  function montarVuelto(cuerpo) {
    let sistema = '1,10,25', monto = 30, hover = null;
    let monedas, optimo, codicioso;
    const calcular = () => {
      monedas = sistema.split(',').map(Number).sort((a, b) => a - b);
      const M = 200;
      optimo = new Array(M + 1).fill(Infinity);
      const ultima = new Array(M + 1).fill(0);
      optimo[0] = 0;
      for (let v = 1; v <= M; v++) for (const c of monedas) if (c <= v && optimo[v - c] + 1 < optimo[v]) { optimo[v] = optimo[v - c] + 1; ultima[v] = c; }
      const reconstruir = (v) => { const r = []; while (v > 0) { r.push(ultima[v]); v -= ultima[v]; } return r.sort((a, b) => b - a); };
      const voraz = (v) => { const r = []; for (const c of monedas.slice().reverse()) while (v >= c) { r.push(c); v -= c; } return r; };
      codicioso = { voraz, reconstruir };
    };
    calcular();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Sistema de monedas', opciones: SISTEMAS, valor: sistema, alCambiar: (v) => { sistema = v; calcular(); dibujar(); } });
    const sMonto = ctl.rango({ etiqueta: 'Monto', min: 1, max: 100, valor: monto, alCambiar: (v) => { monto = v; dibujar(); } });
    const fichas = el('div', { style: { margin: '6px 0 14px', fontFamily: 'var(--mono)', fontSize: '13px', lineHeight: '2.1' } });
    cuerpo.appendChild(fichas);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 230, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'monedas con el algoritmo codicioso', forma: 'linea' },
      { color: C.s1, texto: 'mínimo posible (programación dinámica)', forma: 'linea' },
      { color: C.s8, texto: 'montos donde el codicioso falla', forma: 'punto' },
    ]);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para elegir el monto.');

    let plano = null;
    function dibujar() {
      const v = codicioso.voraz(monto), o = codicioso.reconstruir(monto);
      const ficha = (c, color) => `<span style="display:inline-block;min-width:28px;text-align:center;border:1.5px solid ${color};border-radius:14px;padding:0 7px;margin-right:4px">${c}</span>`;
      fichas.innerHTML = `<div><b>Codicioso</b> (${v.length}): ${v.map((c) => ficha(c, C.s2)).join('')}</div>` +
        `<div><b>Óptimo</b> (${o.length}): ${o.map((c) => ficha(c, C.s1)).join('')}</div>` +
        `<div style="color:${v.length === o.length ? '#52514e' : C.s8}">${v.length === o.length ? 'El algoritmo codicioso es óptimo para este monto.' : `El codicioso usa ${v.length - o.length} moneda(s) de más.`}</div>`;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const datos = [];
      let fallas = 0;
      for (let m = 1; m <= 100; m++) { const g = codicioso.voraz(m).length; datos.push({ m, g, o: optimo[m] }); if (g > optimo[m]) fallas++; }
      const ymax = Math.max(...datos.map((d) => d.g)) + 1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax }, { etiquetaX: 'monto', etiquetaY: `número de monedas · el codicioso falla en ${fallas} de 100 montos` });
      plano.ejes();
      const x = Math.round(plano.sx(monto)) + 0.5;
      ctx.strokeStyle = C.tinta;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, plano.y1); ctx.lineTo(x, plano.y0); ctx.stroke();
      ctx.setLineDash([]);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.m, d.g]), C.s2, 2);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.m, d.o]), C.s1, 2);
      for (const d of datos) if (d.g > d.o) VIZ.marcador(ctx, plano.sx(d.m), plano.sy(d.g), C.s8, 3.5);
      if (hover) { VIZ.marcador(ctx, plano.sx(hover.m), plano.sy(hover.g), C.s2, 5); VIZ.marcador(ctx, plano.sx(hover.m), plano.sy(hover.o), C.s1, 5); }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const m = Math.max(1, Math.min(100, Math.round(plano.ix(x))));
      hover = { m, g: codicioso.voraz(m).length, o: optimo[m] };
      dibujar();
      tip.mostrar(x, y, `monto <b>${m}</b>` + VIZ.filaTooltip(C.s2, 'codicioso', hover.g) + VIZ.filaTooltip(C.s1, 'óptimo', hover.o));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      monto = Math.max(1, Math.min(100, Math.round(plano.ix(x))));
      sMonto.valor = monto;
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 3: códigos de Huffman ---------- */

  function montarHuffman(cuerpo) {
    let texto = 'abracadabra alacazam', bosque = [], fusion = null, mensaje = '';
    const prof = (n) => (n ? 1 + Math.max(prof(n.izq), prof(n.der)) : 0);
    const hojas = (n) => (!n ? 0 : !n.izq ? 1 : hojas(n.izq) + hojas(n.der));
    const simbolo = (c) => (c === ' ' ? '␣' : c);
    function calcularAlto() { return Math.max(140, Math.max(1, ...bosque.map(prof)) * 46 + 44); }

    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Texto a codificar', valor: texto, alCambiar: (v) => { texto = v || 'a'; rep.reiniciar(); }, alEnter: (v) => { texto = v || 'a'; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => calcularAlto() });
    const registro = VIZ.nota(cuerpo, '');
    const tabla = el('div', { style: { overflowX: 'auto', marginTop: '10px' } });
    cuerpo.appendChild(tabla);
    const lectura = VIZ.lectura(cuerpo);

    function iniciar() {
      const frec = new Map();
      for (const c of texto) frec.set(c, (frec.get(c) || 0) + 1);
      let orden = 0;
      bosque = [...frec].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([c, f]) => ({ c, f, izq: null, der: null, o: orden++ }));
      fusion = null;
      mensaje = `${bosque.length} símbolos distintos. Cada uno empieza como un árbol de un solo nodo con su frecuencia.`;
      return (function* () {
        while (bosque.length > 1) {
          bosque.sort((a, b) => a.f - b.f || a.o - b.o);
          const [a, b] = bosque.splice(0, 2);
          const n = { c: null, f: a.f + b.f, izq: a, der: b, o: orden++ };
          bosque.push(n);
          fusion = n;
          mensaje = `Se fusionan los dos árboles de menor frecuencia (${a.f} y ${b.f}) en uno de frecuencia ${n.f}.`;
          yield;
        }
        fusion = null;
        mensaje = 'Queda un solo árbol: el código de cada símbolo es el camino desde la raíz (izquierda = 0, derecha = 1).';
      })();
    }

    function dibujar() {
      if (lienzo.alto !== calcularAlto()) return lienzo.ajustar(true);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const lista = bosque.slice().sort((a, b) => a.f - b.f || a.o - b.o);
      const total = lista.reduce((s, t) => s + hojas(t), 0);
      let x = 6;
      for (const t of lista) {
        const ancho = ((W - 12) * hojas(t)) / total;
        const geo = VIZ.arbol.dibujarBinario(ctx, t, {
          x0: x, y0: 22, ancho: ancho - 4, dy: 46, radio: Math.min(14, Math.max(9, ancho / hojas(t) / 2.6)),
          etiqueta: (n) => (n.c != null ? simbolo(n.c) : String(n.f)),
          nota: (n) => (n.c != null ? String(n.f) : ''),
          estilo: (n) => (n.c != null ? { relleno: C.superficie } : { relleno: n === fusion ? C.s2 : C.neutro, borde: n === fusion ? C.s2 : C.tinta, texto: n === fusion ? '#fff' : C.tinta }),
        });
        // Etiquetas 0/1 en las aristas.
        ctx.font = VIZ.fuente(10, 600);
        ctx.fillStyle = C.s1;
        for (const [n, p] of geo.pos) {
          for (const [h, b] of [[n.izq, '0'], [n.der, '1']]) {
            if (!h) continue;
            const q = geo.pos.get(h);
            ctx.fillText(b, (p.x + q.x) / 2 + (b === '0' ? -7 : 7), (p.y + q.y) / 2);
          }
        }
        x += ancho;
      }
      registro.textContent = mensaje;
      // Tabla de códigos cuando el árbol está completo.
      if (bosque.length === 1) {
        const codigos = [];
        (function rec(n, pref) {
          if (!n) return;
          if (n.c != null) { codigos.push({ c: n.c, f: n.f, cod: pref || '0' }); return; }
          rec(n.izq, pref + '0'); rec(n.der, pref + '1');
        })(bosque[0], '');
        codigos.sort((a, b) => b.f - a.f || a.c.localeCompare(b.c));
        const fijo = Math.max(1, Math.ceil(Math.log2(codigos.length)));
        const bits = codigos.reduce((s, x) => s + x.f * x.cod.length, 0);
        const N = texto.length;
        const H = -codigos.reduce((s, x) => s + (x.f / N) * Math.log2(x.f / N), 0);
        const td = (t, b) => el('td', { style: { padding: '3px 12px 3px 0', borderBottom: '1px solid #e1e0d9', fontFamily: 'var(--mono)', fontSize: '12.5px', fontWeight: b ? '600' : '400' } }, t);
        tabla.replaceChildren(el('table', { style: { borderCollapse: 'collapse' } },
          el('tr', null, td('símbolo', 1), td('frecuencia', 1), td('código', 1), td('bits', 1)),
          ...codigos.map((x) => el('tr', null, td(simbolo(x.c)), td(String(x.f)), td(x.cod), td(String(x.f * x.cod.length))))));
        lectura.set([
          ['bits con Huffman', String(bits)], [`bits con largo fijo (${fijo} por símbolo)`, String(fijo * N)],
          ['bits por símbolo', (bits / N).toFixed(3)], ['entropía H', H.toFixed(3)],
        ]);
      } else {
        tabla.replaceChildren();
        lectura.set([['árboles en el bosque', String(bosque.length)], ['símbolos en el texto', String(texto.length)]]);
      }
    }
    lienzo.alDibujar = () => bosque.length && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('greedy', {
    intro: String.raw`
      <p>Un <strong>algoritmo codicioso</strong> (<em>greedy</em>) construye una solución tomando, en cada paso, la decisión que parece mejor
      en ese momento, sin reconsiderarla nunca. Es la estrategia más simple posible y, cuando funciona, produce algoritmos muy
      eficientes. El problema es que muchas veces <em>no</em> funciona: lo localmente mejor no siempre conduce a lo globalmente óptimo.</p>
      <p>Por eso, lo importante de un algoritmo codicioso no es el algoritmo, sino la <strong>demostración</strong> de que es correcto, o
      el contraejemplo que muestra que no lo es.</p>`,
    visualizaciones: [
      {
        titulo: 'Selección de actividades',
        descripcion: 'Elegir el máximo número de actividades que no se superpongan. Pruebe distintos criterios: solo «termina antes» es óptimo siempre; los demás fallan con algunas entradas.',
        montar: montarActividades,
      },
      {
        titulo: 'Dar vuelto con la menor cantidad de monedas',
        descripcion: 'El algoritmo codicioso entrega siempre la moneda más grande posible. Es óptimo para algunos sistemas de monedas (llamados <em>canónicos</em>) y falla para otros: con monedas 1, 10 y 25, el vuelto de 30 se da con 25+1+1+1+1+1 en vez de 10+10+10.',
        montar: montarVuelto,
      },
      {
        titulo: 'Códigos de Huffman',
        descripcion: 'Para comprimir un texto se asignan códigos binarios más cortos a los símbolos más frecuentes. Huffman construye el código óptimo fusionando siempre los dos árboles de menor frecuencia.',
        montar: montarHuffman,
      },
    ],
    teoria: String.raw`
      <h2>Ingredientes de un algoritmo codicioso correcto</h2>
      <ul>
        <li><strong>Propiedad de elección codiciosa:</strong> existe una solución óptima que contiene la primera elección codiciosa.</li>
        <li><strong>Subestructura óptima:</strong> tras hacer esa elección, lo que queda es un subproblema del mismo tipo, y una solución
        óptima de él, junto con la elección, es óptima para el problema original.</li>
      </ul>
      <p>La técnica de demostración habitual es el <strong>argumento de intercambio</strong>: tomar una solución óptima cualquiera y
      modificarla, sin empeorarla, hasta que coincida con la codiciosa.</p>

      <h2>Selección de actividades</h2>
      <p>Dadas actividades \([s_i, f_i)\), elegir el mayor número de ellas sin superposición. <strong>Elección:</strong> la que termina primero.</p>
      <p><strong>Demostración.</strong> Sea \(a_1\) la actividad con menor \(f_1\) y \(O\) una solución óptima cuya primera actividad (por tiempo de
      término) es \(a_k\). Como \(f_1 \le f_k\), reemplazar \(a_k\) por \(a_1\) en \(O\) no crea superposiciones y mantiene el tamaño: hay un óptimo
      que contiene a \(a_1\). Lo que queda es el mismo problema restringido a actividades que empiezan después de \(f_1\). Ordenar
      cuesta \(O(n \log n)\) y la selección es \(O(n)\).</p>
      <p>Los otros criterios fallan: «más corta» falla si una actividad corta se superpone con dos largas compatibles entre sí;
      «empieza antes», si la primera actividad dura todo el día.</p>

      <h2>Dar vuelto</h2>
      <p>Para un sistema \(1 = c_1 &lt; c_2 &lt; \dots &lt; c_k\), el algoritmo codicioso toma \(\lfloor M / c_k \rfloor\) monedas de \(c_k\) y sigue con el
      resto. Es óptimo para los sistemas reales de monedas, pero no en general: con \(\{1, 3, 4\}\) y \(M = 6\) da \(4+1+1\), mientras que \(3+3\)
      usa una moneda menos. El problema general se resuelve con <a href="tema.html?id=dynamic-programming">programación dinámica</a>:</p>
      \[ \mathrm{opt}(M) = 1 + \min_{c_i \le M} \mathrm{opt}(M - c_i), \qquad \mathrm{opt}(0) = 0. \]
      <p>Kozen y Zaks (1994) mostraron que si el codicioso falla para algún monto, falla para alguno menor que \(c_{k-1} + c_k\).</p>

      <h2>Códigos de Huffman</h2>
      <p>Un código <em>libre de prefijos</em> (ninguna palabra es prefijo de otra) se decodifica sin ambigüedad y corresponde a un árbol binario
      con los símbolos en las hojas. El costo de codificar un texto es \(B(T) = \sum_{c} f(c)\,d_T(c)\), donde \(d_T(c)\) es la profundidad de \(c\).</p>
      <p><strong>Lema de elección codiciosa.</strong> Si \(x, y\) son los dos símbolos menos frecuentes, existe un árbol óptimo en que \(x\) e \(y\) son
      hojas hermanas a máxima profundidad (intercambiarlos con las hojas más profundas no aumenta \(B\)). Fusionarlos en un símbolo de
      frecuencia \(f(x) + f(y)\) deja un problema del mismo tipo, con \(B(T) = B(T') + f(x) + f(y)\). Con un montículo, el algoritmo cuesta
      \(O(k \log k)\) para \(k\) símbolos.</p>
      <p>Por el teorema de codificación de Shannon, ningún código libre de prefijos puede usar menos de \(H = -\sum p_c \log_2 p_c\) bits por
      símbolo en promedio, y Huffman usa menos de \(H + 1\).</p>

      <h2>Otros algoritmos codiciosos</h2>
      <p><a href="tema.html?id=kruskal">Kruskal</a> y <a href="tema.html?id=prim">Prim</a> (árboles de expansión mínima) y
      <a href="tema.html?id=bfs-dijkstra">Dijkstra</a> (caminos más cortos) son codiciosos. La teoría de <em>matroides</em> caracteriza
      exactamente los problemas de selección de subconjuntos en los que el codicioso es siempre óptimo.</p>`,
  });
})();
