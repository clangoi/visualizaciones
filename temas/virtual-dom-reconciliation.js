(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* Árbol virtual: { tipo, texto, clave, hijos }. diff(ant, sig) marca cada nodo del árbol nuevo con
     estado: igual | texto | nuevo | remontado, y cada nodo eliminado del anterior con estado: quitado. */
  const nodo = (tipo, texto, hijos = [], clave) => ({ tipo, texto, hijos, clave });

  function arbolBase() {
    return nodo('div', 'div', [
      nodo('h1', 'h1: Tienda'),
      nodo('ul', 'ul', [nodo('li', 'li: lápiz'), nodo('li', 'li: regla'), nodo('li', 'li: goma')]),
      nodo('p', 'p: © 2026'),
    ]);
  }
  const copiar = (n) => ({ ...n, hijos: n.hijos.map(copiar) });

  const CAMBIOS = {
    texto: { t: 'Cambiar el texto del título', f: (a) => { a.hijos[0].texto = 'h1: Ofertas'; } },
    agregar: { t: 'Agregar un elemento a la lista', f: (a) => { a.hijos[1].hijos.push(nodo('li', 'li: tijeras')); } },
    quitar: { t: 'Quitar el último elemento', f: (a) => { a.hijos[1].hijos.pop(); } },
    tipo: { t: 'Cambiar <ul> por <ol> (otro tipo)', f: (a) => { a.hijos[1].tipo = 'ol'; a.hijos[1].texto = 'ol'; } },
    nada: { t: 'Sin cambios', f: () => {} },
  };

  function diff(ant, sig, ops) {
    if (!ant) { marcar(sig, 'nuevo'); ops.crear += cuenta(sig); return; }
    if (ant.tipo !== sig.tipo) { ant.estado = 'quitado'; marcar(ant, 'quitado'); marcar(sig, 'remontado'); ops.quitar += cuenta(ant); ops.crear += cuenta(sig); return; }
    sig.estado = ant.texto !== sig.texto ? 'texto' : 'igual';
    if (sig.estado === 'texto') ops.actualizar++;
    const n = Math.max(ant.hijos.length, sig.hijos.length);
    for (let i = 0; i < n; i++) {
      if (i >= sig.hijos.length) { marcar(ant.hijos[i], 'quitado'); ops.quitar += cuenta(ant.hijos[i]); } else diff(ant.hijos[i], sig.hijos[i], ops);
    }
  }
  function marcar(n, e) { n.estado = e; n.hijos.forEach((h) => marcar(h, e)); }
  function cuenta(n) { return 1 + n.hijos.reduce((s, h) => s + cuenta(h), 0); }

  /* ---------- Fig. 1: comparación de dos árboles ---------- */

  const ESTADOS = { igual: [C.eje, 'sin cambios (se reutiliza)'], texto: [C.s2, 'se actualiza'], nuevo: [C.s6, 'se crea'], quitado: [C.s8, 'se elimina'], remontado: [C.s7, 'se vuelve a crear (otro tipo)'] };

  function montarDiff(cuerpo) {
    let cambio = 'texto';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cambio en el estado', valor: cambio, opciones: Object.entries(CAMBIOS).map(([k, c]) => [k, c.t]), alCambiar: (v) => { cambio = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 420 : 250) });
    VIZ.leyenda(cuerpo, Object.values(ESTADOS).map(([c, t]) => ({ color: c, texto: t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'React compara el árbol anterior con el nuevo de arriba abajo; si el <em>tipo</em> de un nodo cambia, descarta ese subárbol entero en vez de compararlo.');
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const ant = arbolBase(), sig = copiar(ant);
      CAMBIOS[cambio].f(sig);
      const ops = { crear: 0, quitar: 0, actualizar: 0 };
      diff(ant, sig, ops);
      const apilar = Wd < 600, ancho = apilar ? Wd : Wd / 2, alto = apilar ? H / 2 : H;
      const pintar = (raiz, x0, y0, t) => {
        ctx.save(); ctx.translate(x0, y0);
        W.texto(ctx, t, 6, 8, { tam: 11, peso: 600, alinear: 'left' });
        W.arbol(ctx, raiz, ancho, alto - 16, (n) => { const e = n.estado ? ESTADOS[n.estado] : ESTADOS.igual; return n.estado && n.estado !== 'igual' ? { relleno: VIZ.alfa(e[0], 0.22), borde: e[0] } : {}; }, { margenY: 24, alturaNodo: 22, tam: 10 });
        ctx.restore();
      };
      pintar(ant, 0, 0, 'árbol anterior'); pintar(sig, apilar ? 0 : ancho, apilar ? alto : 0, 'árbol nuevo');
      const total = ops.crear + ops.quitar + ops.actualizar;
      registro.textContent = cambio === 'nada' ? 'Nada cambió: React no toca el DOM.' : cambio === 'tipo' ? `El tipo pasó de ul a ol: React no compara los hijos, elimina ${ops.quitar} nodos y crea ${ops.crear}.` : `React aplica solo ${total} operación(es) sobre el DOM real en lugar de reconstruir los ${cuenta(sig)} nodos.`;
      lectura.set([['nodos en la página', String(cuenta(sig))], ['creados', String(ops.crear)], ['eliminados', String(ops.quitar)], ['actualizados', String(ops.actualizar)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: listas con y sin key ---------- */

  function montarKeys(cuerpo) {
    const est = { accion: 'insertar', key: 'id' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cambio en la lista', valor: est.accion, opciones: [['insertar', 'insertar un elemento al principio'], ['quitar', 'quitar el primer elemento'], ['invertir', 'invertir el orden']], alCambiar: (v) => { est.accion = v; dibujar(); } });
    ctl.selector({ etiqueta: 'key', valor: est.key, opciones: [['id', 'key = id estable'], ['indice', 'key = índice']], alCambiar: (v) => { est.key = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [{ color: C.eje, texto: 'se reutiliza igual' }, { color: C.s2, texto: 'se actualiza su contenido' }, { color: C.s6, texto: 'se crea' }, { color: C.s8, texto: 'se elimina' }, { color: C.s7, texto: 'se mueve' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con <code>key = índice</code>, insertar al principio hace que todos los elementos «cambien de contenido»; con un id estable, React reconoce cuál es el nuevo y no toca los demás.');

    function lcs(a) { // longitud de la subsecuencia creciente más larga
      const d = a.map(() => 1);
      for (let i = 0; i < a.length; i++) for (let j = 0; j < i; j++) if (a[j] < a[i]) d[i] = Math.max(d[i], d[j] + 1);
      return Math.max(0, ...d);
    }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const ant = [{ id: 1, t: 'A' }, { id: 2, t: 'B' }, { id: 3, t: 'C' }, { id: 4, t: 'D' }];
      const sig = est.accion === 'insertar' ? [{ id: 5, t: 'N' }, ...ant] : est.accion === 'quitar' ? ant.slice(1) : [...ant].reverse();
      const ops = ant.map(() => ({ e: 'igual' })), opsN = sig.map(() => ({ e: 'igual' }));
      let crear = 0, quitar = 0, actualizar = 0, mover = 0;
      if (est.key === 'indice') {
        sig.forEach((s, i) => { if (i >= ant.length) { opsN[i].e = 'nuevo'; crear++; } else if (ant[i].t !== s.t) { opsN[i].e = 'texto'; actualizar++; } });
        ant.forEach((a, i) => { if (i >= sig.length) { ops[i].e = 'quitado'; quitar++; } });
      } else {
        const posAnt = new Map(ant.map((a, i) => [a.id, i]));
        const secuencia = [];
        sig.forEach((s, i) => { if (posAnt.has(s.id)) secuencia.push(posAnt.get(s.id)); else { opsN[i].e = 'nuevo'; crear++; } });
        ant.forEach((a, i) => { if (!sig.some((s) => s.id === a.id)) { ops[i].e = 'quitado'; quitar++; } });
        mover = secuencia.length - lcs(secuencia);
        if (mover) { let k = 0; // marcar como movidos los que no están en la subsecuencia máxima (aproximación: se marcan los últimos)
          sig.forEach((s, i) => { if (posAnt.has(s.id) && k < mover && est.accion === 'invertir' && i < mover) { opsN[i].e = 'mover'; k++; } }); }
      }
      const COL = { igual: C.eje, texto: C.s2, nuevo: C.s6, quitado: C.s8, mover: C.s7 };
      const dibujaLista = (lista, op, x, t, tipoKey) => {
        W.texto(ctx, t, x + 60, 12, { tam: 11, peso: 600 });
        lista.forEach((it, i) => {
          const y = 28 + i * 38, c = COL[op[i].e];
          W.caja(ctx, x, y, 120, 30, `${tipoKey ? `key=${est.key === 'indice' ? i : it.id}  ` : ''}${it.t}`, { borde: c, relleno: op[i].e === 'igual' ? C.superficie : VIZ.alfa(c, 0.2), tam: 11, peso: 600 });
        });
      };
      const x1 = Math.max(8, Wd * 0.12), x2 = Wd - 128 - Math.max(8, Wd * 0.12);
      dibujaLista(ant, ops, x1, 'antes', true); dibujaLista(sig, opsN, x2, 'después', true);
      VIZ.dist.flecha(ctx, x1 + 130, 100, x2 - 10, 100, { color: C.apagado });
      const total = crear + quitar + actualizar + mover;
      registro.textContent = est.key === 'indice' ? `Con key = índice, React empareja por posición: ${actualizar} elemento(s) cambian de texto, se crean ${crear} y se eliminan ${quitar}.` : `Con key = id, React empareja por identidad: ${crear} creado(s), ${quitar} eliminado(s), ${mover} movido(s) y ${actualizar} actualizado(s).`;
      lectura.set([['operaciones en el DOM', String(total)], ['clave usada', est.key === 'indice' ? 'índice (frágil)' : 'id estable'], ['estado interno de cada fila', est.key === 'indice' ? 'se queda en la posición' : 'viaja con su elemento']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('virtual-dom-reconciliation', {
    intro: String.raw`
      <p>Modificar el DOM real es lento comparado con calcular en JavaScript. React mantiene entonces una descripción liviana de la interfaz, el <strong>DOM virtual</strong>:
      cuando el estado cambia, construye un árbol nuevo, lo <strong>compara</strong> con el anterior y aplica al DOM real solo las diferencias mínimas. Ese proceso se llama <strong>reconciliación</strong>.</p>
      <p>Comparar dos árboles de forma óptima es costoso, así que React usa dos heurísticas: nodos de distinto tipo producen árboles distintos, y las <code>key</code> identifican qué elemento de una lista es cuál.</p>`,
    visualizaciones: [
      { titulo: 'Diferencias entre dos árboles', descripcion: 'Elija un cambio y vea qué nodos se reutilizan, actualizan, crean o eliminan. Cambiar el tipo de un nodo reconstruye todo su subárbol.', montar: montarDiff },
      { titulo: 'Listas: key por índice o por id', descripcion: 'Inserte un elemento al principio con ambas estrategias y compare cuántas operaciones necesita el DOM.', montar: montarKeys },
    ],
    teoria: String.raw`
      <h2>Por qué una heurística</h2>
      <p>El algoritmo general de diferencia mínima entre dos árboles ordenados cuesta \(O(n^3)\), inviable para miles de nodos. React lo reduce a \(O(n)\) con dos supuestos:</p>
      <ol>
        <li>Dos elementos de <strong>tipos distintos</strong> (<code>ul</code> frente a <code>ol</code>, o <code>A</code> frente a <code>B</code>) generan subárboles distintos: se descarta el viejo y se monta el nuevo, perdiendo su estado.</li>
        <li>En una lista, la <code>key</code> indica qué hijo es el mismo entre renders.</li>
      </ol>
      <pre><code>reconciliar(viejo, nuevo):
    si tipo(viejo) ≠ tipo(nuevo): desmontar(viejo); montar(nuevo); devolver
    actualizar atributos y texto que cambiaron
    para cada hijo (emparejado por key, o por índice si no hay):
        reconciliar(hijoViejo, hijoNuevo)
    crear los hijos nuevos y eliminar los que sobran</code></pre>
      <h2>Costo de las listas</h2>
      <p>Insertar un elemento al principio de una lista de \(n\): con <code>key = índice</code> cada posición recibe contenido distinto, así que se hacen \(n\) actualizaciones y una creación (\(\Theta(n)\)); con una clave estable solo hay <strong>una inserción</strong> (\(\Theta(1)\) operaciones sobre el DOM). Además, el estado local de cada fila (un campo que el usuario escribió) acompaña a su elemento solo si la clave es estable.</p>
      <div class="recuadro">Use como <code>key</code> un identificador propio de los datos (<code>id</code>), nunca <code>Math.random()</code> (cambia en cada render) y evite el índice en listas que se reordenan. El árbol que se reconcilia es el de <a href="tema.html?id=component-tree-props">componentes y props</a>.</div>`,
  });
})();
