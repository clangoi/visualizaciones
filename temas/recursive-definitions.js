(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: árbol de llamadas ---------- */

  const FUN = {
    fact: { nombre: 'Factorial: n! = n · (n − 1)!', max: 6, val: (n) => (n <= 1 ? 1 : n * FUN.fact.val(n - 1)), hijos: (n) => (n <= 1 ? [] : [n - 1]), pre: 'n!' },
    fib: { nombre: 'Fibonacci: F(n) = F(n − 1) + F(n − 2)', max: 6, val: (n) => (n <= 1 ? n : FUN.fib.val(n - 1) + FUN.fib.val(n - 2)), hijos: (n) => (n <= 1 ? [] : [n - 1, n - 2]), pre: 'F' },
    hanoi: { nombre: 'Hanoi: T(n) = 2·T(n − 1) + 1', max: 5, val: (n) => (n === 0 ? 0 : 2 * FUN.hanoi.val(n - 1) + 1), hijos: (n) => (n === 0 ? [] : [n - 1, n - 1]), pre: 'T' },
  };

  function montarLlamadas(cuerpo) {
    let clave = 'fib', n = 5, arbol = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Definición recursiva', opciones: Object.entries(FUN).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; n = Math.min(n, FUN[clave].max); rn.valor = n; construir(); } });
    const rn = ctl.rango({ etiqueta: 'n', min: 1, max: 6, valor: n, alCambiar: (v) => { n = Math.min(v, FUN[clave].max); construir(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (arbol ? D.altoArbol(arbol, 54, D.profGen) : 200) });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta2, texto: 'primera vez que se calcula ese subproblema', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.25), borde: C.s8, texto: 'subproblema repetido', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nodo es una llamada y el número de abajo es su valor. En Fibonacci el árbol repite subproblemas; en el factorial es una cadena. Los casos base son las hojas.');

    function construir() {
      const F = FUN[clave];
      const nodo = (k) => ({ t: F.pre + (clave === 'fact' ? '' : '') + (clave === 'fact' ? `(${k})` : `(${k})`), k, v: F.val(k), hs: F.hijos(k).map(nodo) });
      arbol = nodo(n);
      lienzo.ajustar(true);
    }
    function dibujar() {
      lienzo.limpiar();
      const vistos = new Set();
      const orden = new Map();
      (function r(a) { const rep = vistos.has(a.k); orden.set(a, rep); vistos.add(a.k); a.hs.forEach(r); })(arbol);
      D.arbol(lienzo, arbol, { ...D.GEN, fila: 54, nota: (r) => String(r.n.v), relleno: (r) => (orden.get(r.n) ? VIZ.alfa(C.s8, 0.25) : null), borde: (r) => (orden.get(r.n) ? C.s8 : C.tinta2) });
      let total = 0, distintos = new Set();
      (function c(a) { total++; distintos.add(a.k); a.hs.forEach(c); })(arbol);
      lectura.set([['valor', VIZ.entero(arbol.v)], ['llamadas', String(total)], ['subproblemas distintos', String(distintos.size)], ['profundidad', String(D.profGen(arbol))]]);
    }
    lienzo.alDibujar = () => arbol && dibujar();
    construir();
  }

  /* ---------- Fig. 2: Torres de Hanoi ---------- */

  function movimientos(n, a, b, c, out = []) {
    if (n === 0) return out;
    movimientos(n - 1, a, c, b, out);
    out.push([n, a, c]);
    movimientos(n - 1, b, a, c, out);
    return out;
  }

  function montarHanoi(cuerpo) {
    let n = 3, clavijas = [[], [], []], hechos = 0, lista = [], ultimo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Discos', min: 1, max: 6, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 300 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'disco pequeño', forma: 'cuadro' },
      { color: VIZ.css(VIZ.enRampa(0.9)), texto: 'disco grande', forma: 'cuadro' },
      { color: C.s2, texto: 'disco recién movido', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para mover n discos: mover n − 1 discos a la clavija auxiliar, mover el mayor, y volver a mover los n − 1 encima. Esa definición recursiva da T(n) = 2T(n − 1) + 1.');

    function iniciar() {
      clavijas = [Array.from({ length: n }, (_, i) => n - i), [], []];
      lista = movimientos(n, 0, 1, 2);
      hechos = 0; ultimo = null;
      return (function* () {
        for (const [d, a, b] of lista) {
          clavijas[a].pop(); clavijas[b].push(d); hechos++; ultimo = d;
          registro.textContent = `Movimiento ${hechos}: el disco ${d} pasa de ${'ABC'[a]} a ${'ABC'[b]}.`;
          yield;
        }
        registro.textContent = `Listo: ${hechos} movimientos = 2^${n} − 1.`;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const base = H - 24, dh = Math.min(22, (base - 30) / (n + 1)), anchoMax = W / 3 - 20;
      for (let p = 0; p < 3; p++) {
        const cx = W / 6 + (p * W) / 3;
        ctx.fillStyle = C.eje; ctx.fillRect(cx - 2, base - dh * (n + 1), 4, dh * (n + 1));
        ctx.fillRect(cx - anchoMax / 2, base, anchoMax, 3);
        D.texto2(ctx, 'ABC'[p], cx, base + 14, { color: C.tinta2, px: 11, peso: 600 });
        clavijas[p].forEach((d, i) => {
          const w = 24 + ((anchoMax - 24) * d) / n;
          ctx.fillStyle = d === ultimo && hechos ? C.s2 : VIZ.css(VIZ.enRampa(0.15 + 0.75 * (d / n)));
          ctx.beginPath(); ctx.roundRect(cx - w / 2, base - (i + 1) * dh, w, dh - 2, 4); ctx.fill();
        });
      }
      lectura.set([['movimientos hechos', String(hechos)], ['necesarios 2ⁿ − 1', String(2 ** n - 1)], ['T(n) = 2T(n − 1) + 1', String(2 ** n - 1)]]);
    }
    lienzo.alDibujar = () => lista.length && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('recursive-definitions', {
    intro: String.raw`
      <p>Una <strong>definición recursiva</strong> describe algo en términos de versiones más pequeñas de sí mismo: el factorial de \(n\) usa el factorial de \(n-1\); un número de Fibonacci usa los dos anteriores.
      Funciona porque siempre se llega a casos base que no dependen de nada.</p>
      <p>Definir y demostrar son dos caras de lo mismo: las funciones recursivas se analizan por inducción, y la forma de la definición dicta qué clase de inducción hace falta
      (simple para \(n!\), fuerte para Fibonacci).</p>`,
    visualizaciones: [
      {
        titulo: 'El árbol de llamadas',
        descripcion: 'Cada definición despliega un árbol de subproblemas. Compare cuántas llamadas hay y cuáles se repiten; en Fibonacci el mismo \\(F(k)\\) se calcula muchas veces.',
        montar: montarLlamadas,
      },
      {
        titulo: 'Torres de Hanoi',
        descripcion: 'Resuelva el rompecabezas con la recursión \\(T(n) = 2T(n-1) + 1\\) y cuente los movimientos. Reproduzca con 4 o 5 discos.',
        montar: montarHanoi,
      },
    ],
    teoria: String.raw`
      <h2>Estructura de una definición recursiva</h2>
      <p>Una definición sobre \(\mathbb{N}\) tiene <strong>casos base</strong> y un <strong>caso recursivo</strong> que llama a valores menores:</p>
      \[ n! = \begin{cases} 1 &amp; n = 0 \\ n\cdot(n-1)! &amp; n \ge 1 \end{cases} \qquad F_n = \begin{cases} n &amp; n \le 1 \\ F_{n-1} + F_{n-2} &amp; n \ge 2 \end{cases} \]
      <p>Que la función quede bien definida (una y solo una función satisface las ecuaciones) es consecuencia de la <a href="tema.html?id=well-ordering">terminación</a>: cada llamada baja un natural.</p>
      <h2>Hanoi: definición y demostración</h2>
      <p>El número mínimo de movimientos cumple \(T(0) = 0,\ T(n) = 2T(n-1) + 1\). Por inducción, \(T(n) = 2^n - 1\): base \(T(0) = 0 = 2^0 - 1\); paso
      \(T(k+1) = 2(2^k - 1) + 1 = 2^{k+1} - 1\). Para 64 discos son \(2^{64}-1\) movimientos: una cantidad inabordable.</p>
      <h2>Costo del árbol de llamadas</h2>
      <table>
        <tr><th>Definición</th><th>Llamadas</th><th>Subproblemas distintos</th></tr>
        <tr><td>\(n!\)</td><td>\(n\)</td><td>\(n\)</td></tr>
        <tr><td>\(F_n\)</td><td>\(\Theta(\varphi^n)\)</td><td>\(n+1\)</td></tr>
        <tr><td>\(T(n)\) ingenuo</td><td>\(2^{n+1}-1\)</td><td>\(n+1\)</td></tr>
      </table>
      <p>Cuando hay muchos subproblemas repetidos se guarda cada valor ya calculado (memoización): es el origen de la programación dinámica. Para razonar sobre estructuras más complejas que los naturales,
      véase <a href="tema.html?id=inductive-sets">Inductively Defined Sets</a>.</p>`,
  });
})();
