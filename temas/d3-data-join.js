(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const S = V.svg;

  // Data join: separa en enter, update y exit según el modo de emparejamiento.
  function unir(existentes, datos, clave) {
    const enter = [], update = [], exit = [];
    if (!clave) {
      const m = Math.min(existentes.length, datos.length);
      for (let i = 0; i < m; i++) update.push([existentes[i], datos[i]]);
      for (let i = m; i < datos.length; i++) enter.push(datos[i]);
      for (let i = m; i < existentes.length; i++) exit.push(existentes[i]);
    } else {
      const porId = new Map(existentes.map((e) => [e.id, e]));
      const nuevos = new Set(datos.map((d) => d.id));
      for (const d of datos) (porId.has(d.id) ? update.push([porId.get(d.id), d]) : enter.push(d));
      for (const e of existentes) if (!nuevos.has(e.id)) exit.push(e);
    }
    return { enter, update, exit };
  }

  /* ---------- Fig. 1: emparejar datos y elementos ---------- */

  const CONJUNTOS = {
    A: 'a b c d', B: 'b c e f g', C: 'c b a', D: 'd e',
  };
  const lista = (t) => t.split(' ').map((id, i) => ({ id, v: 20 + ((id.charCodeAt(0) * 7 + i * 13) % 70) }));

  function montarEmparejar(cuerpo) {
    let existentes = lista(CONJUNTOS.A), nuevo = 'B', clave = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos nuevos', valor: nuevo, opciones: Object.entries(CONJUNTOS).map(([k, t]) => [k, `${k}: ${t}`]), alCambiar: (v) => { nuevo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Emparejar por', valor: 'indice', opciones: [['indice', 'índice (por omisión)'], ['clave', 'clave: d => d.id']], alCambiar: (v) => { clave = v === 'clave'; dibujar(); } });
    ctl.boton('Aplicar el join', () => { existentes = lista(CONJUNTOS[nuevo]); dibujar(); }, { primario: true });
    ctl.boton('Volver a A', () => { existentes = lista(CONJUNTOS.A); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 250 });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'enter: dato sin elemento (se crea)' }, { color: C.s1, texto: 'update: dato con elemento (se actualiza)' }, { color: C.s8, texto: 'exit: elemento sin dato (se elimina)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba están los datos nuevos; abajo, los elementos que ya existen. Con emparejamiento por índice, reordenar los datos cambia de dato a casi todos; por clave, cada elemento sigue a su dato.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const datos = lista(CONJUNTOS[nuevo]), j = unir(existentes, datos, clave);
      const paso = Math.min(70, (W - 40) / Math.max(datos.length, existentes.length, 1)), x0 = 24;
      const yD = 60, yE = 190, w = Math.min(46, paso - 10);
      V.rotulo(ctx, 'datos nuevos (data)', x0, 18, { peso: 600 }); V.rotulo(ctx, 'elementos existentes (DOM)', x0, 150, { peso: 600 });
      const pos = (i) => x0 + i * paso + w / 2;
      const col = (c) => ({ enter: C.s6, update: C.s1, exit: C.s8 })[c];
      const idxD = new Map(datos.map((d, i) => [d, i])), idxE = new Map(existentes.map((e, i) => [e, i]));
      for (const [e, d] of j.update) {
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pos(idxD.get(d)), yD + 20); ctx.lineTo(pos(idxE.get(e)), yE - 20); ctx.stroke();
      }
      datos.forEach((d, i) => {
        const tipo = j.enter.includes(d) ? 'enter' : 'update';
        ctx.fillStyle = VIZ.alfa(col(tipo), 0.15); ctx.strokeStyle = col(tipo); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(pos(i) - w / 2, yD - 20, w, 40, 6); ctx.fill(); ctx.stroke();
        V.rotulo(ctx, d.id, pos(i), yD - 4, { alinear: 'center', peso: 700, tam: 13, color: C.tinta }); V.rotulo(ctx, String(d.v), pos(i), yD + 11, { alinear: 'center', tam: 10 });
      });
      existentes.forEach((e, i) => {
        const tipo = j.exit.includes(e) ? 'exit' : 'update';
        ctx.fillStyle = VIZ.alfa(col(tipo), 0.15); ctx.strokeStyle = col(tipo); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(pos(i) - w / 2, yE - 20, w, 40, 6); ctx.fill(); ctx.stroke();
        V.rotulo(ctx, e.id, pos(i), yE - 4, { alinear: 'center', peso: 700, tam: 13, color: C.tinta }); V.rotulo(ctx, String(e.v), pos(i), yE + 11, { alinear: 'center', tam: 10 });
      });
      j.enter.forEach((d) => { const i = idxD.get(d); ctx.strokeStyle = C.s6; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pos(i), yD + 20); ctx.lineTo(pos(i), yE - 20); ctx.stroke(); ctx.setLineDash([]); });
      registro.textContent = `Con ${clave ? 'clave' : 'índice'}: ${j.enter.length} entran, ${j.update.length} se actualizan y ${j.exit.length} salen.`
        + (!clave && j.update.some(([e, d]) => e.id !== d.id) ? ' Algunos elementos pasan a representar un dato distinto.' : '');
      lectura.set([['enter', String(j.enter.length)], ['update', String(j.update.length)], ['exit', String(j.exit.length)], ['elementos cambiados de dato', String(j.update.filter(([e, d]) => e.id !== d.id).length)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: join sobre un gráfico SVG ---------- */

  function montarGrafico(cuerpo) {
    let sig = 0, semilla = 1;
    let datos = [];
    const nodos = new Map();
    const nuevo = () => { const rnd = VIZ.semilla(semilla++ * 7 + sig); return { id: 'k' + sig++, v: Math.round(15 + rnd() * 80) }; };
    datos = [nuevo(), nuevo(), nuevo(), nuevo()];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Agregar dato', () => { datos.splice(Math.floor(VIZ.semilla(semilla++)() * (datos.length + 1)), 0, nuevo()); render(); }, { primario: true });
    ctl.boton('Quitar un dato', () => { if (datos.length) datos.splice(Math.floor(VIZ.semilla(semilla++ + 3)() * datos.length), 1); render(); });
    ctl.boton('Cambiar valores', () => { const r = VIZ.semilla(semilla++ * 11); datos.forEach((d) => { if (r() < 0.5) d.v = Math.round(15 + r() * 80); }); render(); });
    const svg = V.lienzoSvg(cuerpo, 400, 190);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'enter' }, { color: C.s1, texto: 'update' }, { color: C.s8, texto: 'exit (se quita en 0,7 s)' }]);
    const codigo = el('pre', { class: 'codigo-viz' });
    cuerpo.appendChild(codigo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es un <code>&lt;rect&gt;</code> real asociado a un dato por su clave. Observe cuál color recibe cada una tras cada acción.');
    function render() {
      const claves = new Set(datos.map((d) => d.id));
      const salen = [...nodos].filter(([id]) => !claves.has(id));
      let en = 0, up = 0;
      const paso = 360 / Math.max(datos.length, 1), base = 170;
      datos.forEach((d, i) => {
        let r = nodos.get(d.id), tipo = 'update';
        if (!r) { r = S('rect', { rx: 3 }); nodos.set(d.id, r); svg.append(r); tipo = 'enter'; en++; } else up++;
        r.dataset.v = r.dataset.v || ''; const cambio = r.dataset.v !== String(d.v) + ':' + i; r.dataset.v = String(d.v) + ':' + i;
        r.setAttribute('x', 22 + i * paso + 4); r.setAttribute('width', Math.max(4, paso - 8)); r.setAttribute('y', base - d.v * 1.5); r.setAttribute('height', d.v * 1.5);
        r.setAttribute('fill', tipo === 'enter' ? C.s6 : C.s1); r.setAttribute('opacity', tipo === 'enter' || cambio ? 1 : 0.55);
        const t = r.__t || (r.__t = S('text', { 'text-anchor': 'middle' })); if (!t.parentNode) svg.append(t);
        t.setAttribute('x', 22 + i * paso + paso / 2); t.setAttribute('y', base - d.v * 1.5 - 4); t.textContent = d.v;
      });
      for (const [id, r] of salen) { r.setAttribute('fill', C.s8); if (r.__t) r.__t.remove(); nodos.delete(id); setTimeout(() => r.remove(), 700); }
      if (!svg.querySelector('line')) svg.append(S('line', { x1: 20, y1: base, x2: 390, y2: base, stroke: C.eje }));
      codigo.textContent = `barras = svg.selectAll("rect").data(datos, d => d.id);\nbarras.enter().append("rect");   // ${en} nuevos\nbarras.attr("height", d => d.v); // ${up} existentes\nbarras.exit().remove();          // ${salen.length} sobrantes`;
      lectura.set([['datos', String(datos.length)], ['enter · update · exit', `${en} · ${up} · ${salen.length}`], ['rect en el documento', String(svg.querySelectorAll('rect').length)]]);
    }
    render();
  }

  VIZ.registrarTema('d3-data-join', {
    intro: String.raw`
      <p>La idea central de D3 es el <strong>data join</strong>: en lugar de recorrer los datos y dibujar cada uno, usted <em>declara</em> la correspondencia entre una lista de datos y una lista de elementos, y D3 le entrega tres grupos:
      los datos que aún no tienen elemento (<em>enter</em>), los que ya lo tienen (<em>update</em>) y los elementos que perdieron su dato (<em>exit</em>).</p>
      <p>Así el mismo código dibuja la primera vez y actualiza todas las siguientes.</p>`,
    visualizaciones: [
      { titulo: 'Emparejar datos con elementos', descripcion: 'Elija un conjunto nuevo y compare emparejar por índice o por clave. Pruebe el conjunto C, que solo reordena.', montar: montarEmparejar },
      { titulo: 'Enter, update y exit sobre barras reales', descripcion: 'Agregue, quite y cambie datos; cada barra es un rect SVG que el join crea, actualiza o elimina.', montar: montarGrafico },
    ],
    teoria: String.raw`
      <h2>Patrón clásico</h2>
      <pre><code>const barras = svg.selectAll("rect")
    .data(datos, d =&gt; d.id);        // función de clave

barras.enter().append("rect")        // ENTER: crear
    .merge(barras)                   // ENTER + UPDATE
    .attr("height", d =&gt; y(d.valor));

barras.exit().remove();              // EXIT: eliminar</code></pre>
      <p>En D3 v7 se escribe con <code>selection.join("rect")</code>, que hace las tres cosas.</p>
      <h2>Qué hace el emparejamiento</h2>
      <p>Sea \(E\) el conjunto de elementos existentes y \(D\) el de datos nuevos. Con una función de clave \(k\), el join calcula
      \[ \text{update} = \{ (e, d) : k(e) = k(d) \}, \quad \text{enter} = D \setminus k(E), \quad \text{exit} = E \setminus k(D). \]
      Sin clave el emparejamiento es por posición: \(\text{update}\) son los primeros \(\min(|E|, |D|)\) pares, y el resto entra o sale.</p>
      <div class="recuadro"><strong>Por qué la clave.</strong> Si los datos se reordenan o se les quita uno del medio, el índice reasigna cada elemento a otro dato y la animación mueve todo. La clave mantiene la <em>constancia del objeto</em>: cada marca sigue a su dato.</div>
      <h2>Costo</h2>
      <p>Emparejar por clave cuesta \(\Theta(|E| + |D|)\) con un mapa hash, y el número de operaciones sobre el DOM es \(\Theta(\text{enter} + \text{exit} + \text{cambios})\), no \(\Theta(|D|)\); ver <a href="tema.html?id=dynamic-dom-manipulation">manipulación dinámica del DOM</a>.</p>
      <p>Siguiente: <a href="tema.html?id=d3-scales-axes">escalas y ejes</a> para convertir cada dato en una posición.</p>`,
  });
})();
