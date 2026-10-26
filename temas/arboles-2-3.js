(function () {
  'use strict';
  const { color: C } = VIZ;

  function crear23() {
    let raiz = null;
    const nuevoCtx = () => ({ mensajes: [], camino: [], cambiados: [], destino: null });

    // Inserta en el subárbol de n; si n se desborda (3 claves) devuelve la división { clave, izq, der }.
    function ins(n, k, ctx) {
      ctx.camino.push(n);
      if (n.claves.includes(k)) { ctx.mensajes.push(`${k} ya está en el árbol.`); ctx.destino = n; return null; }
      if (!n.hijos.length) {
        n.claves.push(k);
        n.claves.sort((a, b) => a - b);
        ctx.destino = n;
        ctx.mensajes.push(`Se agrega ${k} a la hoja, que queda [${n.claves.join(' ')}].`);
      } else {
        const i = n.claves.filter((c) => c < k).length;
        const r = ins(n.hijos[i], k, ctx);
        if (!r) return null;
        n.claves.splice(i, 0, r.clave);
        n.hijos.splice(i, 1, r.izq, r.der);
      }
      if (n.claves.length === 3) {
        const [a, b, c] = n.claves;
        const izq = { claves: [a], hijos: n.hijos.slice(0, 2) };
        const der = { claves: [c], hijos: n.hijos.slice(2) };
        ctx.mensajes.push(`El nodo [${a} ${b} ${c}] tiene tres claves: se divide en [${a}] y [${c}], y la clave del medio ${b} sube al padre.`);
        ctx.cambiados.push(izq, der);
        if (ctx.destino === n) ctx.destino = k === a ? izq : k === c ? der : null;
        return { clave: b, izq, der };
      }
      return null;
    }

    function eliminar(k) {
      const ctx = nuevoCtx();
      const camino = [];
      let n = raiz;
      while (n && !n.claves.includes(k)) {
        ctx.camino.push(n);
        const i = n.claves.filter((c) => c < k).length;
        camino.push([n, i]);
        n = n.hijos[i] || null;
      }
      if (!n) { ctx.mensajes.push(`${k} no está en el árbol.`); return ctx; }
      ctx.camino.push(n);
      let hoja = n;
      if (n.hijos.length) {
        // Nodo interno: se reemplaza por su predecesor (máximo del subárbol izquierdo), que está en una hoja.
        const i = n.claves.indexOf(k);
        camino.push([n, i]);
        let m = n.hijos[i];
        while (m.hijos.length) { ctx.camino.push(m); camino.push([m, m.hijos.length - 1]); m = m.hijos[m.hijos.length - 1]; }
        const pred = m.claves.pop();
        n.claves[i] = pred;
        ctx.mensajes.push(`${k} está en un nodo interno: se reemplaza por su predecesor ${pred}, que se quita de una hoja.`);
        ctx.cambiados.push(n);
        hoja = m;
      } else {
        n.claves.splice(n.claves.indexOf(k), 1);
        ctx.mensajes.push(`Se quita ${k} de la hoja.`);
      }
      // Reparar nodos vacíos subiendo por el camino.
      let x = hoja;
      if (x.claves.length) ctx.mensajes.push('La hoja conserva una clave: no hay más cambios.');
      while (!x.claves.length) {
        if (!camino.length) {
          raiz = x.hijos.length ? x.hijos[0] : null;
          ctx.mensajes.push(raiz ? 'La raíz quedó vacía: su único hijo pasa a ser la raíz y la altura disminuye en 1.' : 'El árbol quedó vacío.');
          break;
        }
        const [p, idx] = camino.pop();
        const izq = idx > 0 ? p.hijos[idx - 1] : null, der = idx < p.hijos.length - 1 ? p.hijos[idx + 1] : null;
        if (izq && izq.claves.length === 2) {
          x.claves.unshift(p.claves[idx - 1]);
          p.claves[idx - 1] = izq.claves.pop();
          if (izq.hijos.length) x.hijos.unshift(izq.hijos.pop());
          ctx.mensajes.push(`Nodo vacío con hermano izquierdo de 2 claves: redistribución (${x.claves[0]} baja del padre y ${p.claves[idx - 1]} sube del hermano).`);
          ctx.cambiados.push(x, izq, p);
          break;
        }
        if (der && der.claves.length === 2) {
          x.claves.push(p.claves[idx]);
          p.claves[idx] = der.claves.shift();
          if (der.hijos.length) x.hijos.push(der.hijos.shift());
          ctx.mensajes.push(`Nodo vacío con hermano derecho de 2 claves: redistribución (${x.claves[0]} baja del padre y ${p.claves[idx]} sube del hermano).`);
          ctx.cambiados.push(x, der, p);
          break;
        }
        if (izq) {
          const baja = p.claves[idx - 1];
          izq.claves.push(baja);
          izq.hijos.push(...x.hijos);
          p.claves.splice(idx - 1, 1);
          p.hijos.splice(idx, 1);
          ctx.mensajes.push(`Hermanos con una sola clave: fusión. ${baja} baja del padre y se une al hermano izquierdo.`);
          ctx.cambiados.push(izq);
        } else {
          const baja = p.claves[idx];
          der.claves.unshift(baja);
          der.hijos.unshift(...x.hijos);
          p.claves.splice(idx, 1);
          p.hijos.splice(idx, 1);
          ctx.mensajes.push(`Hermanos con una sola clave: fusión. ${baja} baja del padre y se une al hermano derecho.`);
          ctx.cambiados.push(der);
        }
        if (!p.claves.length) ctx.mensajes.push('El padre quedó sin claves: el problema se repite un nivel más arriba.');
        x = p;
      }
      return ctx;
    }

    const contar = (n) => (n ? n.claves.length + n.hijos.reduce((s, h) => s + contar(h), 0) : 0);
    const nodos = (n) => (n ? 1 + n.hijos.reduce((s, h) => s + nodos(h), 0) : 0);
    return {
      multiple: true,
      raiz: () => raiz,
      vaciar() { raiz = null; },
      contiene(k) {
        let n = raiz;
        while (n) { if (n.claves.includes(k)) return true; n = n.hijos[n.claves.filter((c) => c < k).length] || null; }
        return false;
      },
      buscar(k) {
        const ctx = nuevoCtx();
        let n = raiz;
        while (n) {
          ctx.camino.push(n);
          if (n.claves.includes(k)) { ctx.destino = n; ctx.mensajes.push(`${k} está en el nodo [${n.claves.join(' ')}].`); return ctx; }
          const i = n.claves.filter((c) => c < k).length;
          ctx.mensajes.push(`En [${n.claves.join(' ')}]: ${k} va al hijo ${['izquierdo', n.claves.length === 2 ? 'del medio' : 'derecho', 'derecho'][i]}.`);
          n = n.hijos[i] || null;
        }
        ctx.mensajes.push(`Se llegó bajo una hoja: ${k} no está.`);
        return ctx;
      },
      insertar(k) {
        const ctx = nuevoCtx();
        if (!raiz) { raiz = { claves: [k], hijos: [] }; ctx.destino = raiz; ctx.mensajes.push(`Árbol vacío: la raíz es [${k}].`); return ctx; }
        const r = ins(raiz, k, ctx);
        if (r) {
          raiz = { claves: [r.clave], hijos: [r.izq, r.der] };
          ctx.cambiados.push(raiz);
          ctx.mensajes.push(`La raíz se dividió: se crea una nueva raiz [${r.clave}] y la altura aumenta en 1 (todas las hojas bajan juntas).`);
        }
        return ctx;
      },
      eliminar,
      info: (n) => `nodo-${n.claves.length + 1} [${n.claves.join(' ')}]<br>${n.hijos.length ? `${n.hijos.length} hijos` : 'hoja'}`,
      lecturas: () => {
        const h = VIZ.arbol.alturaMultiple(raiz), n = contar(raiz);
        return [['claves n', String(n)], ['nodos', String(nodos(raiz))], ['altura', h ? String(h - 1) : '—'],
          ['rango posible', n ? `${Math.ceil(Math.log(n + 1) / Math.log(3)) - 1} … ${Math.floor(Math.log2(n + 1)) - 1}` : '—']];
      },
    };
  }

  VIZ.registrarTema('arboles-2-3', {
    intro: String.raw`
      <p>Un <strong>árbol 2-3</strong> es un árbol de búsqueda en el que cada nodo tiene una clave y dos hijos (nodo-2) o dos claves y
      tres hijos (nodo-3), y en el que <strong>todas las hojas están a la misma profundidad</strong>. Esa última condición lo mantiene
      perfectamente balanceado.</p>
      <p>La clave está en cómo crece: en vez de agregar hojas hacia abajo, las claves se insertan en hojas existentes y, cuando un
      nodo se llena, se <em>divide</em> y empuja una clave hacia arriba. El árbol crece desde la raíz.</p>`,
    visualizaciones: [
      {
        titulo: 'Inserción con divisiones y eliminación con fusiones',
        descripcion: 'Inserte claves y observe cómo los nodos-4 temporales se dividen y suben su clave del medio. Al eliminar, un nodo vacío pide prestada una clave a un hermano (redistribución) o se fusiona con él.',
        montar: (c) => VIZ.arbol.editor(c, crear23(), { inicial: [50, 20, 80, 10, 30, 60, 90, 40, 70], dy: 64 }),
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <ul>
        <li>Un <strong>nodo-2</strong> tiene una clave \(a\) y dos hijos: claves \(&lt; a\) a la izquierda y \(&gt; a\) a la derecha.</li>
        <li>Un <strong>nodo-3</strong> tiene claves \(a &lt; b\) y tres hijos: \(&lt; a\), entre \(a\) y \(b\), y \(&gt; b\).</li>
        <li>Todas las hojas están en el mismo nivel (balance perfecto).</li>
      </ul>

      <h2>Altura</h2>
      <p>Un árbol 2-3 de altura \(h\) (contando aristas) tiene entre \(2^{h+1} - 1\) claves (todos nodos-2) y \(3^{h+1} - 1\) claves
      (todos nodos-3). Por lo tanto, con \(n\) claves:</p>
      \[ \log_3(n+1) - 1 \;\le\; h \;\le\; \log_2(n+1) - 1. \]
      <p>Buscar visita un nodo por nivel y hace a lo más 2 comparaciones en cada uno: \(O(\log n)\).</p>

      <h2>Inserción</h2>
      <ol>
        <li>Buscar la hoja donde debería estar la clave y agregarla ahí.</li>
        <li>Si la hoja queda con tres claves \(a &lt; b &lt; c\) (un <em>nodo-4 temporal</em>), se divide en dos nodos-2 \([a]\) y \([c]\),
        y \(b\) sube al padre.</li>
        <li>Si el padre se llena, se repite. Si se divide la raíz, se crea una raíz nueva con la clave del medio: es la <em>única</em>
        forma en que la altura crece, y lo hace para todas las hojas a la vez.</li>
      </ol>
      <p>Cada división es \(O(1)\) y hay a lo más una por nivel: \(O(\log n)\).</p>

      <h2>Eliminación</h2>
      <p>Si la clave está en un nodo interno, se intercambia con su predecesor (que está en una hoja), así que siempre se elimina de una
      hoja. Si la hoja queda vacía:</p>
      <ul>
        <li><strong>Redistribución:</strong> si un hermano adyacente es nodo-3, la clave separadora del padre baja al nodo vacío y una clave
        del hermano sube a reemplazarla.</li>
        <li><strong>Fusión:</strong> si no, el nodo vacío se une con un hermano nodo-2 y la clave separadora del padre baja. El padre pierde
        una clave y puede quedar vacío, propagando el problema hacia arriba.</li>
        <li>Si la raíz queda vacía, su único hijo pasa a ser la raíz y la altura disminuye.</li>
      </ul>

      <h2>Generalizaciones</h2>
      <p>Los árboles 2-3 son el caso más pequeño de los <strong>árboles B</strong> de orden \(m\) (nodos con entre \(\lceil m/2\rceil\) y \(m\)
      hijos), que se usan en bases de datos y sistemas de archivos porque cada nodo puede ocupar un bloque de disco completo. Los
      <a href="tema.html?id=red-black">árboles rojo-negro</a> son una forma de representar árboles 2-3 (o 2-3-4) como árboles binarios.</p>`,
  });
})();
