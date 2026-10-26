(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.arbol;

  function crearABB() {
    let raiz = null;
    const api = {
      raiz: () => raiz,
      vaciar() { raiz = null; },
      contiene(k) { let n = raiz; while (n) { if (k === n.clave) return true; n = k < n.clave ? n.izq : n.der; } return false; },
      buscar(k) {
        const camino = [], mensajes = [];
        let n = raiz;
        while (n) {
          camino.push(n);
          if (k === n.clave) { mensajes.push(`${k} = ${n.clave}: encontrado tras ${camino.length} comparaciones.`); return { camino, mensajes, destino: n }; }
          mensajes.push(`${k} ${k < n.clave ? '<' : '>'} ${n.clave}: ir al hijo ${k < n.clave ? 'izquierdo' : 'derecho'}.`);
          n = k < n.clave ? n.izq : n.der;
        }
        mensajes.push(`Se llegó a un hijo vacío: ${k} no está en el árbol.`);
        return { camino, mensajes };
      },
      insertar(k) {
        const camino = [], mensajes = [];
        const nuevo = { clave: k, izq: null, der: null };
        if (!raiz) { raiz = nuevo; return { mensajes: [`Árbol vacío: ${k} pasa a ser la raíz.`], destino: nuevo }; }
        let n = raiz;
        for (;;) {
          camino.push(n);
          if (k === n.clave) return { camino, mensajes: [...mensajes, `${k} ya está en el árbol.`], destino: n };
          const lado = k < n.clave ? 'izq' : 'der';
          mensajes.push(`${k} ${k < n.clave ? '<' : '>'} ${n.clave}: ir a la ${lado === 'izq' ? 'izquierda' : 'derecha'}.`);
          if (!n[lado]) { n[lado] = nuevo; mensajes.push(`Hijo vacío: se inserta ${k} como hoja.`); return { camino, mensajes, destino: nuevo }; }
          n = n[lado];
        }
      },
      eliminar(k) {
        const camino = [], mensajes = [];
        let padre = null, n = raiz;
        while (n && n.clave !== k) { camino.push(n); padre = n; n = k < n.clave ? n.izq : n.der; }
        if (!n) return { camino, mensajes: [`${k} no está en el árbol.`] };
        const reemplazar = (p, viejo, nuevo) => { if (!p) raiz = nuevo; else if (p.izq === viejo) p.izq = nuevo; else p.der = nuevo; };
        if (!n.izq || !n.der) {
          const hijo = n.izq || n.der;
          reemplazar(padre, n, hijo);
          mensajes.push(hijo
            ? `${k} tiene un solo hijo (${hijo.clave}): el hijo toma su lugar.`
            : `${k} es una hoja: simplemente se elimina.`);
          return { camino, mensajes, cambiados: hijo ? [hijo] : [] };
        }
        // Dos hijos: se reemplaza por el sucesor (mínimo del subárbol derecho).
        let ps = n, s = n.der;
        camino.push(n);
        while (s.izq) { camino.push(s); ps = s; s = s.izq; }
        mensajes.push(`${k} tiene dos hijos: se busca su sucesor, el mínimo del subárbol derecho, que es ${s.clave}.`);
        n.clave = s.clave;
        reemplazar(ps, s, s.der);
        mensajes.push(`Se copia ${s.clave} en el nodo de ${k} y se elimina el sucesor (que no tiene hijo izquierdo).`);
        return { camino, mensajes, cambiados: [n] };
      },
      info: (n) => `clave <b>${n.clave}</b><br>altura del subárbol ${A.altura(n)}<br>tamaño del subárbol ${A.tamano(n)}`,
      lecturas: () => {
        const n = A.tamano(raiz), h = A.altura(raiz);
        return [['nodos n', String(n)], ['altura', h ? String(h - 1) : '—'], ['mínima posible ⌊log₂ n⌋', n ? String(Math.floor(Math.log2(n))) : '—']];
      },
    };
    return api;
  }

  function montarEditor(cuerpo) {
    const impl = crearABB();
    let animacion = null;
    VIZ.arbol.editor(cuerpo, impl, {
      inicial: [50, 30, 70, 20, 40, 60, 80, 35, 45, 65],
      extras(ctl, api) {
        const sel = ctl.selector({ etiqueta: 'Recorrido', opciones: [['inorden', 'Inorden (izq, raíz, der)'], ['preorden', 'Preorden (raíz, izq, der)'], ['postorden', 'Postorden (izq, der, raíz)'], ['niveles', 'Por niveles (BFS)']], valor: 'inorden' });
        ctl.boton('Recorrer', () => {
          clearInterval(animacion);
          const orden = [];
          const f = { inorden: A.inorden, preorden: A.preorden, postorden: A.postorden, niveles: A.porNiveles }[sel.valor];
          f(impl.raiz(), (n) => orden.push(n));
          let i = 0;
          animacion = setInterval(() => {
            if (i > orden.length) return clearInterval(animacion);
            api.aplicar({
              camino: orden.slice(0, i),
              destino: orden[i - 1],
              mensajes: [`Recorrido ${sel.valor}: ${orden.slice(0, i).map((n) => n.clave).join(', ')}${i === orden.length && sel.valor === 'inorden' ? '  ← ¡en orden creciente!' : ''}`],
            });
            i++;
          }, 450);
        });
      },
    });
  }

  /* ---------- Fig. 2: altura según el orden de inserción ---------- */

  function montarAlturas(cuerpo) {
    let hover = null;
    const NS = [];
    for (let n = 10; n <= 1000; n += 10) NS.push(n);
    const rnd = VIZ.semilla(4);
    const altAleatoria = (n) => {
      let suma = 0;
      for (let t = 0; t < 12; t++) {
        const claves = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [claves[i], claves[j]] = [claves[j], claves[i]]; }
        let raiz = null, h = 0;
        for (const k of claves) {
          if (!raiz) { raiz = { k }; continue; }
          let x = raiz, d = 0;
          for (;;) {
            d++;
            const lado = k < x.k ? 'i' : 'd';
            if (!x[lado]) { x[lado] = { k }; break; }
            x = x[lado];
          }
          h = Math.max(h, d);
        }
        suma += h;
      }
      return suma / 12;
    };
    const datos = NS.map((n) => ({ n, aleatoria: altAleatoria(n), minima: Math.floor(Math.log2(n)), teoria: 4.311 * Math.log(n) - 1.953 * Math.log(Math.log(n)) }));
    const SERIES = [['aleatoria', 'Inserción en orden aleatorio (promedio)', C.s1], ['teoria', '4.311 ln n − 1.953 ln ln n', C.s2], ['minima', 'Mínima posible ⌊log₂ n⌋', C.s3]];

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, SERIES.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    VIZ.nota(cuerpo, 'Si las claves se insertan en orden creciente, la altura es n − 1: con n = 1000 la curva estaría 25 veces más arriba que el borde de este gráfico.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1000, ymin: 0, ymax: 40 }, { etiquetaX: 'número de claves n', etiquetaY: 'altura del árbol' });
      plano.ejes();
      for (const [k, , c] of SERIES) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d[k]]), c, 2, k === 'teoria' ? [5, 4] : null);
        if (hover) VIZ.marcador(ctx, plano.sx(hover.n), plano.sy(hover[k]), c, 4);
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = datos.find((d) => d.n === Math.max(10, Math.round(plano.ix(x) / 10) * 10));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover.n}</b>` + SERIES.map(([k, t, c]) => VIZ.filaTooltip(c, t, VIZ.fmt(hover[k], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bst', {
    intro: String.raw`
      <p>Un <strong>árbol binario de búsqueda</strong> (ABB) guarda claves en nodos con a lo más dos hijos, respetando una regla:
      todo lo que está en el subárbol izquierdo de un nodo es menor que su clave, y todo lo del subárbol derecho es mayor.
      Así, buscar una clave es como una búsqueda binaria: en cada nodo se decide ir a la izquierda o a la derecha.</p>
      <p>A diferencia de un arreglo ordenado, el árbol permite insertar y eliminar sin desplazar elementos. Su punto débil es
      que la forma del árbol depende del orden de inserción: puede quedar balanceado o degenerar en una lista.</p>`,
    visualizaciones: [
      {
        titulo: 'Insertar, eliminar, buscar y recorrer',
        descripcion: 'Use «Insertar 1, 2, …, 15» para ver cómo un orden desfavorable produce un árbol degenerado. Al eliminar un nodo con dos hijos, se reemplaza por su sucesor. El recorrido inorden entrega las claves ordenadas.',
        montar: montarEditor,
      },
      {
        titulo: 'Altura según el orden de inserción',
        descripcion: 'Altura promedio de ABB construidos insertando \\(n\\) claves en orden aleatorio, comparada con la mínima posible y con la fórmula asintótica de Devroye.',
        montar: montarAlturas,
      },
    ],
    teoria: String.raw`
      <h2>Propiedad de ABB</h2>
      <p>Para todo nodo \(x\): si \(y\) está en el subárbol izquierdo de \(x\), \(y.\mathit{clave} &lt; x.\mathit{clave}\); si está en el
      derecho, \(y.\mathit{clave} &gt; x.\mathit{clave}\). Una consecuencia directa es que el <strong>recorrido inorden</strong>
      (izquierdo, raíz, derecho) visita las claves en orden creciente, en tiempo \(\Theta(n)\).</p>

      <h2>Operaciones</h2>
      <ul>
        <li><strong>Buscar</strong> \(k\): desde la raíz, ir a la izquierda si \(k &lt; x.\mathit{clave}\), a la derecha si es mayor;
        terminar al encontrarla o al llegar a un hijo vacío.</li>
        <li><strong>Insertar</strong> \(k\): buscarla; el hijo vacío donde termina la búsqueda fallida es exactamente donde debe ir
        la nueva hoja.</li>
        <li><strong>Mínimo / máximo:</strong> bajar siempre a la izquierda / derecha. <strong>Sucesor</strong> de \(x\): el mínimo de su
        subárbol derecho, o si no tiene, el primer ancestro del que \(x\) desciende por la izquierda.</li>
        <li><strong>Eliminar</strong> \(z\): si es hoja, se quita; si tiene un hijo, el hijo ocupa su lugar; si tiene dos, se reemplaza su
        clave por la de su sucesor \(s\) (que no tiene hijo izquierdo) y se elimina \(s\), reduciendo al caso anterior.</li>
      </ul>
      <p>Todas cuestan \(O(h)\), donde \(h\) es la altura del árbol.</p>

      <h2>La altura lo es todo</h2>
      <p>Un árbol binario con \(n\) nodos tiene altura al menos \(\lfloor\log_2 n\rfloor\), porque el nivel \(d\) contiene a lo más \(2^d\)
      nodos. Pero también puede tener altura \(n-1\): basta insertar las claves en orden. En ese caso cada operación cuesta
      \(\Theta(n)\), igual que en una lista enlazada.</p>
      <p><strong>Inserción aleatoria.</strong> Si las \(n\) claves se insertan en un orden uniformemente aleatorio, la profundidad promedio
      de un nodo es</p>
      \[ \mathbb{E}[\text{profundidad}] = 2\left(1 + \frac{1}{n}\right)H_n - 4 \approx 1.39\log_2 n, \]
      <p>el mismo análisis que el número de comparaciones de quicksort: la raíz cumple el papel del primer pivote. La altura esperada
      es \(\approx 4.311\ln n - 1.953 \ln\ln n\) (Devroye, 1986), es decir \(\Theta(\log n)\).</p>
      <p>Como no se puede elegir el orden en que llegan los datos, los <strong>árboles balanceados</strong> —<a href="tema.html?id=avl">AVL</a>,
      <a href="tema.html?id=arboles-2-3">2-3</a>, <a href="tema.html?id=red-black">rojo-negro</a>— reestructuran el árbol en cada
      operación para garantizar \(h = O(\log n)\) en el peor caso.</p>

      <h2>Contar árboles</h2>
      <p>El número de formas distintas de un árbol binario con \(n\) nodos es el número de Catalan</p>
      \[ C_n = \frac{1}{n+1}\binom{2n}{n} \sim \frac{4^n}{n^{3/2}\sqrt{\pi}}, \]
      <p>que satisface \(C_{n} = \sum_{i=0}^{n-1} C_i\,C_{n-1-i}\) (elegir cuántos nodos van al subárbol izquierdo).</p>`,
  });
})();
