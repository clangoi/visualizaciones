(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: reconstruir frente a actualizar ---------- */

  function montarActualizar(cuerpo) {
    let semilla = 1, modo = 'reconstruir', datos = [], sig = 0, opsTotal = 0, ultimo = 0, entradas = [];
    const rnd0 = () => VIZ.semilla(semilla * 13 + sig++)();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', valor: modo, opciones: [['reconstruir', 'Reconstruir todo (innerHTML)'], ['actualizar', 'Actualizar solo lo que cambió']], alCambiar: (v) => { modo = v; opsTotal = 0; ultimo = 0; entradas = []; render(true); } });
    ctl.boton('Agregar barra', () => { datos.push({ id: sig++, nombre: V.PRODUCTOS[datos.length % 8], valor: Math.round(10 + rnd0() * 80) }); render(); }, { primario: true });
    ctl.boton('Quitar la primera', () => { datos.shift(); render(); });
    ctl.boton('Cambiar un valor', () => { if (!datos.length) return; const d = datos[Math.floor(rnd0() * datos.length)]; d.valor = Math.round(10 + rnd0() * 80); render(); });
    ctl.boton('Ordenar', () => { datos.sort((a, b) => a.valor - b.valor); render(); });
    const panel = el('div', { class: 'demo-dom' });
    cuerpo.appendChild(panel);
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    cuerpo.dataset.sinLeyenda = 'el contorno naranja marca los nodos que el navegador tuvo que crear o modificar';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Agregue y cambie barras con cada estrategia. El contorno naranja indica qué nodos tocó el código; «reconstruir» toca todos aunque solo uno haya cambiado.');
    const nodos = new Map();
    datos = [0, 1, 2].map((i) => ({ id: sig++, nombre: V.PRODUCTOS[i], valor: 30 + i * 20 }));

    function render(limpiar) {
      let ops = 0; const log = [];
      if (limpiar) { panel.replaceChildren(); nodos.clear(); }
      const max = Math.max(1, ...datos.map((d) => d.valor));
      if (modo === 'reconstruir') {
        panel.replaceChildren();
        datos.forEach((d) => { panel.appendChild(el('div', { class: 'fila nuevo' }, el('span', null, d.nombre), el('div', { class: 'barra', style: { width: (d.valor / max) * 100 + '%' } }, String(d.valor)))); ops += 3; });
        log.push('contenedor.innerHTML = "";', ...datos.map((d) => `crear fila «${d.nombre}»`));
      } else {
        const vivos = new Set(datos.map((d) => d.id));
        for (const [id, f] of nodos) if (!vivos.has(id)) { f.remove(); nodos.delete(id); ops++; log.push(`fila.remove()  // id ${id}`); }
        datos.forEach((d) => {
          let f = nodos.get(d.id), nuevo = false;
          if (!f) { f = el('div', { class: 'fila' }, el('span', null, d.nombre), el('div', { class: 'barra' }, '')); nodos.set(d.id, f); nuevo = true; ops += 3; log.push(`ENTER: crear fila «${d.nombre}»`); }
          const b = f.querySelector('.barra'), w = (d.valor / max) * 100 + '%';
          if (nuevo || b.style.width !== w || b.textContent !== String(d.valor)) { b.style.width = w; b.textContent = String(d.valor); if (!nuevo) { ops++; log.push(`UPDATE: «${d.nombre}» → ${d.valor}`); } f.classList.add('nuevo'); } else f.classList.remove('nuevo');
          panel.appendChild(f);
        });
        panel.querySelectorAll('.fila').forEach((f) => { if (!f.classList.contains('nuevo')) return; setTimeout(() => f.classList.remove('nuevo'), 900); });
      }
      opsTotal += ops; ultimo = ops;
      codigo.textContent = log.length ? log.join('\n') : '(sin cambios en el DOM)';
      lectura.set([['barras', String(datos.length)], ['operaciones en este cambio', String(ultimo)], ['operaciones acumuladas', String(opsTotal)]]);
    }
    render(true);
  }

  /* ---------- Fig. 2: del evento al nuevo dibujo ---------- */

  function montarEventos(cuerpo) {
    const nombres = V.PRODUCTOS.slice(0, 6), valores = [40, 65, 30, 80, 55, 25];
    const est = { sel: -1, hover: -1 }, log = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Borrar registro', () => { log.length = 0; pintarLog(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'barra' }, { color: C.s4, texto: 'bajo el cursor (pointermove)' }, { color: C.s2, texto: 'seleccionada (click)' }]);
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    VIZ.nota(cuerpo, 'Mueva el cursor y haga clic en las barras: cada evento actualiza el estado y provoca un nuevo dibujo. Doble clic (o clic sobre la seleccionada) la deselecciona.');
    let rects = [];
    function pintarLog() { lista.replaceChildren(...(log.length ? log.slice(-5).map((t) => el('div', null, t)) : [el('div', null, 'sin eventos todavía')])); }
    function dibujar() {
      lienzo.limpiar();
      const g = V.barras(lienzo, nombres.map((n, i) => ({ nombre: n, valor: valores[i] })), { max: 100, color: (i) => (i === est.sel ? C.s2 : i === est.hover ? C.s4 : C.s1) });
      rects = g.rects;
    }
    function reg(t) { log.push(t); pintarLog(); }
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = V.bajo(rects, x, y), i = h ? h.i : -1;
      if (i !== est.hover) { est.hover = i; dibujar(); if (i >= 0) reg(`pointermove → estado.hover = ${i} (${nombres[i]}) → redibujar`); }
      if (!h) return tip.ocultar();
      tip.mostrar(x, y, `${nombres[i]}: <b>${valores[i]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); est.hover = -1; dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = V.bajo(rects, x, y);
      if (!h) return;
      est.sel = est.sel === h.i ? -1 : h.i;
      reg(`click → estado.sel = ${est.sel} → redibujar`); dibujar();
    });
    lienzo.alDibujar = dibujar;
    dibujar(); pintarLog();
  }

  VIZ.registrarTema('dynamic-dom-manipulation', {
    intro: String.raw`
      <p>Una visualización web no es una imagen fija: reacciona. Para eso JavaScript <strong>crea, modifica y elimina elementos</strong> del documento a medida que cambian los datos o actúa la persona.</p>
      <p>La pregunta de diseño es cuánto tocar. Reconstruir todo es simple pero caro; actualizar solo la diferencia exige llevar la cuenta de qué elementos existen. Esa idea es la base de librerías como D3 y React.</p>`,
    visualizaciones: [
      { titulo: 'Reconstruir o actualizar solo la diferencia', descripcion: 'Agregue, quite, cambie y ordene barras con cada estrategia y compare el número de operaciones sobre el DOM.', montar: montarActualizar },
      { titulo: 'Del evento al nuevo dibujo', descripcion: 'Pase el cursor y haga clic en las barras; el registro muestra la cadena evento → estado → dibujo.', montar: montarEventos },
    ],
    teoria: String.raw`
      <h2>Operaciones básicas</h2>
      <pre><code>const fila = document.createElement('div');   // crear
fila.textContent = 'Café';                    // modificar contenido
fila.style.width = '42%';                     // modificar estilo
contenedor.appendChild(fila);                 // insertar
fila.remove();                                // eliminar</code></pre>
      <h2>Estado y vista</h2>
      <p>Un patrón estable separa el <em>estado</em> (los datos y la selección) de la <em>vista</em> (los elementos). Un evento cambia el estado y una función \(\text{render}(\text{estado})\) hace que la vista coincida con él:
      \[ \text{evento} \to \text{manejador} \to \text{estado}' \to \text{render}(\text{estado}'). \]</p>
      <h2>Costo de actualizar</h2>
      <p>Si hay \(n\) elementos y cambian \(k\), reconstruir cuesta \(\Theta(n)\) operaciones de DOM y actualizar la diferencia \(\Theta(k)\) más el costo de calcular qué cambió. Para \(k \ll n\) la diferencia es grande; es lo que automatiza el
      <a href="tema.html?id=d3-data-join">data join</a> de D3 y la <a href="tema.html?id=virtual-dom-reconciliation">reconciliación de React</a>.</p>
      <h2>Eventos</h2>
      <p>El navegador entrega eventos (<code>click</code>, <code>pointermove</code>…) al elemento bajo el cursor y los hace <em>subir</em> por el árbol; ver <a href="tema.html?id=dom-events">eventos del DOM</a>.
      En canvas no hay elementos que reciban eventos, de modo que el código calcula qué marca está bajo el cursor.</p>`,
  });
})();
