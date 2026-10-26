(function () {
  'use strict';
  const { color: C } = VIZ;

  const h = (n) => (n ? n.h : 0);
  const actualizar = (n) => { n.h = 1 + Math.max(h(n.izq), h(n.der)); };
  const balance = (n) => h(n.izq) - h(n.der);
  function rotDer(y) { const x = y.izq; y.izq = x.der; x.der = y; actualizar(y); actualizar(x); return x; }
  function rotIzq(x) { const y = x.der; x.der = y.izq; y.izq = x; actualizar(x); actualizar(y); return y; }

  // Restaura el balance de `n` si es necesario, anotando el caso y la rotación.
  function rebalancear(n, ctx) {
    actualizar(n);
    const b = balance(n);
    if (b > 1) {
      if (balance(n.izq) < 0) {
        ctx.mensajes.push(`${n.clave} quedó con factor +2 y su hijo izquierdo ${n.izq.clave} con −1: caso LR → rotación doble (izquierda en ${n.izq.clave}, derecha en ${n.clave}).`);
        ctx.cambiados.push(n, n.izq, n.izq.der);
        n.izq = rotIzq(n.izq);
      } else {
        ctx.mensajes.push(`${n.clave} quedó con factor +2 (más alto a la izquierda): caso LL → rotación simple a la derecha.`);
        ctx.cambiados.push(n, n.izq);
      }
      ctx.rotaciones++;
      return rotDer(n);
    }
    if (b < -1) {
      if (balance(n.der) > 0) {
        ctx.mensajes.push(`${n.clave} quedó con factor −2 y su hijo derecho ${n.der.clave} con +1: caso RL → rotación doble (derecha en ${n.der.clave}, izquierda en ${n.clave}).`);
        ctx.cambiados.push(n, n.der, n.der.izq);
        n.der = rotDer(n.der);
      } else {
        ctx.mensajes.push(`${n.clave} quedó con factor −2 (más alto a la derecha): caso RR → rotación simple a la izquierda.`);
        ctx.cambiados.push(n, n.der);
      }
      ctx.rotaciones++;
      return rotIzq(n);
    }
    return n;
  }

  function crearAVL() {
    let raiz = null, totalRot = 0;
    const nuevoCtx = () => ({ mensajes: [], camino: [], cambiados: [], destino: null, rotaciones: 0 });
    function ins(n, k, ctx) {
      if (!n) { ctx.destino = { clave: k, izq: null, der: null, h: 1 }; ctx.mensajes.push(`Se inserta ${k} como hoja.`); return ctx.destino; }
      ctx.camino.push(n);
      if (k < n.clave) n.izq = ins(n.izq, k, ctx);
      else if (k > n.clave) n.der = ins(n.der, k, ctx);
      else { ctx.mensajes.push(`${k} ya está en el árbol.`); ctx.destino = n; ctx.omitir = true; return n; }
      return rebalancear(n, ctx);
    }
    function eli(n, k, ctx) {
      if (!n) { ctx.mensajes.push(`${k} no está en el árbol.`); ctx.omitir = true; return null; }
      ctx.camino.push(n);
      if (k < n.clave) n.izq = eli(n.izq, k, ctx);
      else if (k > n.clave) n.der = eli(n.der, k, ctx);
      else {
        if (!n.izq || !n.der) {
          ctx.mensajes.push(`Se elimina ${k}${n.izq || n.der ? ' y su único hijo toma su lugar' : ' (hoja)'}.`);
          return n.izq || n.der;
        }
        let s = n.der;
        while (s.izq) s = s.izq;
        ctx.mensajes.push(`${k} tiene dos hijos: se reemplaza por su sucesor ${s.clave}.`);
        n.clave = s.clave;
        n.der = eli(n.der, s.clave, ctx);
      }
      return rebalancear(n, ctx);
    }
    const terminar = (ctx) => {
      totalRot += ctx.rotaciones;
      if (!ctx.rotaciones && !ctx.omitir) ctx.mensajes.push('Todos los factores de balance quedaron en {−1, 0, +1}: no se requieren rotaciones.');
      return ctx;
    };
    return {
      raiz: () => raiz,
      vaciar() { raiz = null; totalRot = 0; },
      contiene(k) { let n = raiz; while (n) { if (k === n.clave) return true; n = k < n.clave ? n.izq : n.der; } return false; },
      buscar(k) {
        const ctx = nuevoCtx();
        let n = raiz;
        while (n) { ctx.camino.push(n); if (k === n.clave) { ctx.destino = n; break; } n = k < n.clave ? n.izq : n.der; }
        ctx.mensajes.push(ctx.destino ? `${k} encontrado tras ${ctx.camino.length} comparaciones.` : `${k} no está en el árbol (${ctx.camino.length} comparaciones).`);
        return ctx;
      },
      insertar(k) { const ctx = nuevoCtx(); raiz = ins(raiz, k, ctx); return terminar(ctx); },
      eliminar(k) { const ctx = nuevoCtx(); ctx.destino = null; raiz = eli(raiz, k, ctx); return terminar(ctx); },
      nota: (n) => { const b = balance(n); return b > 0 ? `+${b}` : String(b); },
      info: (n) => `clave <b>${n.clave}</b><br>altura ${n.h}<br>factor de balance h(izq) − h(der) = <b>${balance(n)}</b>`,
      lecturas: () => {
        const n = VIZ.arbol.tamano(raiz);
        return [['nodos n', String(n)], ['altura', raiz ? String(raiz.h - 1) : '—'], ['cota 1.44 log₂(n+2)', n ? VIZ.fmt(1.4405 * Math.log2(n + 2) - 1.328, 3) : '—'], ['rotaciones acumuladas', String(totalRot)]];
      },
    };
  }

  /* ---------- Fig. 2: árboles de Fibonacci (los AVL más desbalanceados) ---------- */

  function montarFibonacci(cuerpo) {
    let altura = 5;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Altura h', min: 1, max: 7, valor: altura, alCambiar: (v) => { altura = v; lienzo.ajustar(true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => altura * 52 + 40 });
    const lectura = VIZ.lectura(cuerpo);
    let contador;
    // Árbol de Fibonacci: subárbol izquierdo de altura h−1 y derecho de altura h−2.
    const construir = (hh) => {
      if (hh <= 0) return null;
      const izq = construir(hh - 1);
      const n = { clave: 0, izq, der: null, h: hh };
      n.der = construir(hh - 2);
      return n;
    };
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const raiz = construir(altura);
      contador = 1;
      VIZ.arbol.inorden(raiz, (n) => { n.clave = contador++; });
      VIZ.arbol.dibujarBinario(ctx, raiz, {
        x0: 10, y0: 22, ancho: W - 40, dy: 52,
        estilo: (n) => (balance(n) ? { relleno: VIZ.alfa(C.s2, 0.18) } : {}),
        nota: (n) => { const b = balance(n); return b > 0 ? `+${b}` : String(b); },
      });
      const N = VIZ.arbol.tamano(raiz);
      lectura.set([['altura h', String(altura)], ['nodos N(h)', String(N)], ['F(h+2) − 1', String(N)], ['log₂ N', VIZ.fmt(Math.log2(N), 3)], ['h / log₂(N+2)', VIZ.fmt(altura / Math.log2(N + 2), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    VIZ.nota(cuerpo, 'Los nodos sombreados tienen factor de balance +1: todos los nodos internos están «al límite». Quitar cualquier hoja dejaría de cumplir la condición AVL o reduciría la altura.');
    dibujar();
  }

  VIZ.registrarTema('avl', {
    intro: String.raw`
      <p>Un <strong>árbol AVL</strong> (Adelson-Velski y Landis, 1962) es un árbol binario de búsqueda que se mantiene balanceado:
      en cada nodo, las alturas de los subárboles izquierdo y derecho difieren en a lo más 1. Después de cada inserción o
      eliminación se revisan los nodos del camino y, si alguno quedó desbalanceado, se corrige con <strong>rotaciones</strong>,
      operaciones locales que reorganizan tres nodos sin romper el orden de las claves.</p>`,
    visualizaciones: [
      {
        titulo: 'Inserciones, eliminaciones y rotaciones',
        descripcion: 'El número junto a cada nodo es su factor de balance \\(h(\\text{izq}) - h(\\text{der})\\). Inserte 1, 2, …, 15 en orden: a diferencia de un ABB común, el árbol se mantiene perfectamente balanceado. El registro describe cada rotación.',
        montar: (c) => VIZ.arbol.editor(c, crearAVL(), { inicial: [40, 20, 60, 10, 30, 50, 70, 25] }),
      },
      {
        titulo: 'El peor caso: árboles de Fibonacci',
        descripcion: 'El AVL con menos nodos para una altura dada. Su tamaño crece como los números de Fibonacci, lo que acota la altura de cualquier AVL.',
        montar: montarFibonacci,
      },
    ],
    teoria: String.raw`
      <h2>Condición AVL</h2>
      <p>Para cada nodo \(x\), su <strong>factor de balance</strong> \(b(x) = h(x.\mathit{izq}) - h(x.\mathit{der})\) cumple
      \(b(x) \in \{-1, 0, +1\}\). Cada nodo guarda su altura (o su factor), que se actualiza al volver de la recursión.</p>

      <h2>La altura es logarítmica</h2>
      <p>Sea \(N(h)\) el mínimo número de nodos de un AVL de altura \(h\) (contando niveles). El árbol mínimo tiene un subárbol de altura
      \(h-1\) y otro de altura \(h-2\), ambos mínimos (figura 2):</p>
      \[ N(h) = 1 + N(h-1) + N(h-2), \qquad N(0) = 0,\ N(1) = 1. \]
      <p>Sumando 1 a ambos lados, \(N(h) + 1\) cumple la recurrencia de Fibonacci, de donde \(N(h) = F_{h+2} - 1\). Como
      \(F_k \ge \varphi^{k-2}\) con \(\varphi = (1+\sqrt5)/2\), todo AVL con \(n\) nodos y altura \(h\) cumple \(n \ge \varphi^{h} - 1\), es decir</p>
      \[ h \le \log_\varphi (n+1) \approx 1.4405\,\log_2(n+2) - 0.328. \]
      <p>Un AVL es, en el peor caso, a lo más un 44 % más alto que un árbol perfectamente balanceado.</p>

      <h2>Rotaciones</h2>
      <p>Una rotación simple a la derecha en \(y\) con hijo izquierdo \(x\) convierte \(y(x(A, B), C)\) en \(x(A, y(B, C))\): las claves
      siguen en orden (\(A &lt; x &lt; B &lt; y &lt; C\)), solo cambian tres punteros y la altura del subárbol se reduce en 1 por el lado
      cargado. Si tras insertar el nodo más bajo desbalanceado \(z\) tiene \(b(z) = +2\):</p>
      <table>
        <thead><tr><th>Caso</th><th>Situación</th><th>Solución</th></tr></thead>
        <tbody>
          <tr><td>LL</td><td>la inserción fue en el subárbol izquierdo del hijo izquierdo</td><td>rotación simple a la derecha en \(z\)</td></tr>
          <tr><td>LR</td><td>en el subárbol derecho del hijo izquierdo</td><td>rotación izquierda en el hijo, luego derecha en \(z\)</td></tr>
          <tr><td>RR, RL</td><td>casos simétricos con \(b(z) = -2\)</td><td>simétricas</td></tr>
        </tbody>
      </table>
      <p>En una <strong>inserción</strong>, después de una rotación (simple o doble) el subárbol recupera la altura que tenía antes de
      insertar, así que basta <em>una</em> reestructuración. En una <strong>eliminación</strong>, la rotación puede reducir la altura del
      subárbol y propagar el desbalance hacia arriba: pueden necesitarse \(O(\log n)\) rotaciones.</p>

      <h2>Costos</h2>
      <p>Buscar, insertar y eliminar cuestan \(O(\log n)\) en el peor caso, porque recorren un camino de largo \(O(h)\) y cada rotación
      es \(O(1)\). Comparados con los árboles rojo-negro, los AVL son más estrictamente balanceados (búsquedas algo más rápidas) a
      cambio de más rotaciones al modificar.</p>`,
  });
})();
