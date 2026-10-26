(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Árbol rojo-negro inclinado a la izquierda (LLRB, Sedgewick 2008):
     cada nodo rojo es una clave que, junto con su padre, forma un nodo-3 de un árbol 2-3. */
  const ROJO = true, NEGRO = false;
  const esRojo = (n) => !!n && n.color === ROJO;

  function crearRN() {
    let raiz = null;
    let ctx = null;
    const nota = (m) => ctx && ctx.mensajes.push(m);
    function rotIzq(h) {
      const x = h.der;
      h.der = x.izq; x.izq = h;
      x.color = h.color; h.color = ROJO;
      nota(`Enlace rojo a la derecha bajo ${h.clave}: rotación a la izquierda (${x.clave} sube).`);
      ctx && ctx.cambiados.push(h, x);
      return x;
    }
    function rotDer(h) {
      const x = h.izq;
      h.izq = x.der; x.der = h;
      x.color = h.color; h.color = ROJO;
      nota(`Dos enlaces rojos seguidos a la izquierda en ${h.clave}: rotación a la derecha (${x.clave} sube).`);
      ctx && ctx.cambiados.push(h, x);
      return x;
    }
    function invertir(h) {
      h.color = !h.color; h.izq.color = !h.izq.color; h.der.color = !h.der.color;
      nota(h.color === ROJO
        ? `${h.clave} tiene dos hijos rojos (nodo-4 temporal): se invierten los colores y ${h.clave} sube como enlace rojo (división del nodo-4).`
        : `Inversión de colores en ${h.clave} para preparar la eliminación.`);
      ctx && ctx.cambiados.push(h);
    }
    function balancear(h) {
      if (esRojo(h.der) && !esRojo(h.izq)) h = rotIzq(h);
      if (esRojo(h.izq) && esRojo(h.izq.izq)) h = rotDer(h);
      if (esRojo(h.izq) && esRojo(h.der)) invertir(h);
      return h;
    }
    function ins(h, k) {
      if (!h) { ctx.destino = { clave: k, izq: null, der: null, color: ROJO }; nota(`Se inserta ${k} como hoja roja.`); return ctx.destino; }
      ctx.camino.push(h);
      if (k < h.clave) h.izq = ins(h.izq, k);
      else if (k > h.clave) h.der = ins(h.der, k);
      else { nota(`${k} ya está en el árbol.`); ctx.destino = h; return h; }
      return balancear(h);
    }
    function moverRojoIzq(h) {
      invertir(h);
      if (esRojo(h.der.izq)) { h.der = rotDer(h.der); h = rotIzq(h); invertir(h); }
      return h;
    }
    function moverRojoDer(h) {
      invertir(h);
      if (esRojo(h.izq.izq)) { h = rotDer(h); invertir(h); }
      return h;
    }
    const minimo = (h) => (h.izq ? minimo(h.izq) : h);
    function eliminarMin(h) {
      if (!h.izq) return null;
      if (!esRojo(h.izq) && !esRojo(h.izq.izq)) h = moverRojoIzq(h);
      h.izq = eliminarMin(h.izq);
      return balancear(h);
    }
    function eli(h, k) {
      ctx.camino.push(h);
      if (k < h.clave) {
        if (!esRojo(h.izq) && !esRojo(h.izq.izq)) h = moverRojoIzq(h);
        h.izq = eli(h.izq, k);
      } else {
        if (esRojo(h.izq)) h = rotDer(h);
        if (k === h.clave && !h.der) { nota(`Se elimina ${k}.`); return null; }
        if (!esRojo(h.der) && !esRojo(h.der.izq)) h = moverRojoDer(h);
        if (k === h.clave) {
          const s = minimo(h.der);
          nota(`${k} se reemplaza por su sucesor ${s.clave}, que se elimina del subárbol derecho.`);
          h.clave = s.clave;
          h.der = eliminarMin(h.der);
        } else h.der = eli(h.der, k);
      }
      return balancear(h);
    }
    const contiene = (k) => { let n = raiz; while (n) { if (k === n.clave) return true; n = k < n.clave ? n.izq : n.der; } return false; };
    const alturaNegra = () => { let b = 0; for (let n = raiz; n; n = n.izq) if (!esRojo(n)) b++; return b; };
    return {
      raiz: () => raiz,
      vaciar() { raiz = null; },
      contiene,
      buscar(k) {
        ctx = { mensajes: [], camino: [], cambiados: [], destino: null };
        let n = raiz;
        while (n) { ctx.camino.push(n); if (k === n.clave) { ctx.destino = n; break; } n = k < n.clave ? n.izq : n.der; }
        nota(ctx.destino ? `${k} encontrado tras ${ctx.camino.length} comparaciones (la búsqueda ignora los colores).` : `${k} no está en el árbol.`);
        const r = ctx; ctx = null; return r;
      },
      insertar(k) {
        ctx = { mensajes: [], camino: [], cambiados: [], destino: null };
        raiz = ins(raiz, k);
        if (raiz.color === ROJO) { raiz.color = NEGRO; nota('La raíz se pinta negra.'); }
        const r = ctx; ctx = null; return r;
      },
      eliminar(k) {
        ctx = { mensajes: [], camino: [], cambiados: [], destino: null };
        if (!contiene(k)) { nota(`${k} no está en el árbol.`); const r = ctx; ctx = null; return r; }
        if (!esRojo(raiz.izq) && !esRojo(raiz.der)) raiz.color = ROJO;
        raiz = eli(raiz, k);
        if (raiz) raiz.color = NEGRO;
        const r = ctx; ctx = null; return r;
      },
      estilo: (n) => (esRojo(n) ? { relleno: C.s8, borde: C.s8, texto: '#fff' } : { relleno: C.tinta, borde: C.tinta, texto: '#fff' }),
      arista: (p, hijo) => (esRojo(hijo) ? { color: C.s8, ancho: 4 } : { color: C.eje, ancho: 1.2 }),
      info: (n) => `clave <b>${n.clave}</b><br>${esRojo(n) ? 'rojo: forma un nodo-3 con su padre' : 'negro'}`,
      lecturas: () => {
        const n = VIZ.arbol.tamano(raiz), h = VIZ.arbol.altura(raiz);
        return [['nodos n', String(n)], ['altura', h ? String(h - 1) : '—'], ['altura negra', raiz ? String(alturaNegra()) : '—'], ['cota 2 log₂(n+1)', n ? VIZ.fmt(2 * Math.log2(n + 1), 3) : '—']];
      },
      // Árbol 2-3 equivalente: cada hijo rojo se une con su padre.
      a23(h = raiz) {
        if (!h) return null;
        if (esRojo(h.izq)) {
          return { claves: [h.izq.clave, h.clave], hijos: [h.izq.izq, h.izq.der, h.der].filter(Boolean).map((x) => this.a23(x)), rojo: 0 };
        }
        return { claves: [h.clave], hijos: [h.izq, h.der].filter(Boolean).map((x) => this.a23(x)) };
      },
    };
  }

  function montar(cuerpo) {
    const impl = crearRN();
    let lienzo23 = null;
    VIZ.arbol.editor(cuerpo, impl, {
      inicial: [50, 20, 80, 10, 30, 60, 90, 40, 70, 25],
      leyenda: [{ color: C.tinta, texto: 'nodo negro', forma: 'punto' }, { color: C.s8, texto: 'nodo rojo (enlace rojo grueso)', forma: 'punto' }],
      alDibujar: () => lienzo23 && lienzo23.ajustar(true),
    });
    const titulo = VIZ.el('p', { class: 'nota-viz', style: { marginTop: '22px', fontWeight: 600, color: '#0b0b0b' } }, 'Árbol 2-3 equivalente');
    cuerpo.appendChild(titulo);
    lienzo23 = VIZ.lienzo(cuerpo, { altoFn: () => Math.max(110, VIZ.arbol.alturaMultiple(impl.a23()) * 60 + 20) });
    lienzo23.alDibujar = () => {
      const { ctx, ancho: W } = lienzo23;
      lienzo23.limpiar();
      const r = impl.a23();
      if (!r) return;
      VIZ.arbol.dibujarMultiple(ctx, r, {
        x0: 10, y0: 24, ancho: W - 20, dy: 60,
        colorClave: (n, j) => (n.claves.length === 2 && j === 0 ? C.s8 : C.tinta),
      });
    };
    VIZ.nota(cuerpo, 'En el árbol 2-3, la clave roja de cada nodo-3 corresponde al nodo rojo del árbol de arriba. Todas sus hojas están a la misma profundidad, que es la altura negra.');
    lienzo23.ajustar(true);
  }

  VIZ.registrarTema('red-black', {
    intro: String.raw`
      <p>Un <strong>árbol rojo-negro</strong> es un árbol binario de búsqueda en el que cada nodo lleva un bit de color, rojo o negro, y
      unas reglas sobre los colores garantizan que ningún camino desde la raíz a una hoja sea más del doble de largo que otro.
      Es la estructura detrás de <code>std::map</code> en C++, <code>TreeMap</code> en Java y el planificador de procesos de Linux.</p>
      <p>La forma más clara de entenderlos es como una <strong>codificación binaria de un <a href="tema.html?id=arboles-2-3">árbol 2-3</a></strong>:
      un nodo rojo es una clave que «pertenece» al mismo nodo que su padre. Esta página usa la variante <em>inclinada a la izquierda</em>
      (LLRB) de Sedgewick, en la que esa correspondencia es exacta.</p>`,
    visualizaciones: [
      {
        titulo: 'Árbol rojo-negro y su árbol 2-3',
        descripcion: 'Arriba, el árbol rojo-negro; abajo, el árbol 2-3 que representa. Inserte claves y siga en el registro las rotaciones e inversiones de color: cada una corresponde a una operación del árbol 2-3.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Propiedades</h2>
      <ol>
        <li>Cada nodo es rojo o negro, y la raíz es negra.</li>
        <li>Un nodo rojo no tiene hijos rojos (no hay dos rojos seguidos).</li>
        <li>Todo camino desde un nodo hasta un hijo vacío pasa por el mismo número de nodos negros: la <strong>altura negra</strong>.</li>
      </ol>
      <p>En la variante LLRB se exige además que los enlaces rojos vayan siempre hacia la izquierda.</p>

      <h2>Altura</h2>
      <p>Sea \(\mathrm{bh}\) la altura negra de la raíz. Por la propiedad 3, el árbol contiene un árbol completo de nodos negros de altura
      \(\mathrm{bh}\), así que \(n \ge 2^{\mathrm{bh}} - 1\). Por la propiedad 2, a lo más la mitad de los nodos de cualquier camino son
      rojos, de modo que \(h \le 2\,\mathrm{bh}\). Juntando ambas:</p>
      \[ h \;\le\; 2\log_2(n+1). \]

      <h2>Correspondencia con árboles 2-3</h2>
      <table>
        <thead><tr><th>Árbol 2-3</th><th>Árbol rojo-negro (LLRB)</th></tr></thead>
        <tbody>
          <tr><td>nodo-2 \([b]\)</td><td>nodo negro \(b\)</td></tr>
          <tr><td>nodo-3 \([a\ b]\)</td><td>nodo negro \(b\) con hijo izquierdo rojo \(a\)</td></tr>
          <tr><td>todas las hojas a la misma profundidad</td><td>misma altura negra en todos los caminos</td></tr>
          <tr><td>nodo-4 temporal \([a\ b\ c]\)</td><td>\(b\) con dos hijos rojos</td></tr>
          <tr><td>dividir un nodo-4 y subir \(b\)</td><td>invertir colores: \(b\) rojo, \(a\) y \(c\) negros</td></tr>
        </tbody>
      </table>

      <h2>Inserción</h2>
      <p>Se inserta como en un ABB, siempre con un nodo <strong>rojo</strong> (agregar una clave a un nodo del árbol 2-3 no cambia la altura
      negra). Al volver de la recursión, en cada nodo \(h\) se aplican tres reglas locales, en este orden:</p>
      <ol>
        <li>Si el hijo derecho es rojo y el izquierdo no: <strong>rotación a la izquierda</strong> (corrige la inclinación).</li>
        <li>Si el hijo izquierdo y el nieto izquierdo son rojos: <strong>rotación a la derecha</strong> (forma un nodo-4 balanceado).</li>
        <li>Si ambos hijos son rojos: <strong>inversión de colores</strong> (divide el nodo-4 y empuja la clave del medio hacia arriba).</li>
      </ol>
      <p>Al final la raíz se pinta negra; si era roja, la altura negra crece en 1, igual que cuando se divide la raíz de un árbol 2-3.
      Cada regla es \(O(1)\), así que insertar cuesta \(O(\log n)\).</p>

      <h2>Eliminación</h2>
      <p>Eliminar un nodo negro rompería la propiedad 3. La estrategia de LLRB es bajar por el árbol asegurando que el nodo actual o
      su hijo sea rojo (con <em>moveRedLeft</em> y <em>moveRedRight</em>, que toman prestado o fusionan como en el árbol 2-3), de modo que
      al llegar a la hoja se pueda quitar un nodo rojo sin alterar la altura negra; al volver se rebalancea con las mismas tres reglas.</p>

      <h2>Rojo-negro clásico</h2>
      <p>La versión de Guibas y Sedgewick (1978) presentada en CLRS permite enlaces rojos a ambos lados y corresponde a árboles 2-3-4.
      La inserción se corrige con a lo más 2 rotaciones y la eliminación con a lo más 3, más inversiones de color que pueden subir
      \(O(\log n)\) niveles. Frente a los AVL, los rojo-negro toleran árboles algo más altos a cambio de menos rotaciones al modificar.</p>`,
  });
})();
