(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const FILAS = V.ventas(1);

  /* ---------- Fig. 1: resaltar y mostrar detalles ---------- */

  function montarResaltar(cuerpo) {
    const rnd = VIZ.semilla(33);
    const NOM = Array.from({ length: 14 }, (_, i) => `Serie ${String.fromCharCode(65 + i)}`);
    const S = NOM.map((_, k) => V.serie(rnd, 12, 30 + rnd() * 40, (rnd() - 0.4) * 2, 6 + rnd() * 8, 3).map((v) => Math.round(v)));
    const e = { modo: 'resaltar', fijo: -1, hover: -1 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ayuda para leer una serie', valor: e.modo, opciones: [['nada', 'ninguna'], ['tooltip', 'solo tooltip'], ['resaltar', 'resaltar la serie bajo el cursor'], ['panel', 'resaltar y fijar con clic, con panel de detalle']], alCambiar: (v) => { e.modo = v; e.fijo = -1; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'catorce series sin leyenda posible: la identificación se hace por resaltado y rótulo directo';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Catorce líneas grises se confunden. Pase el cursor por una: con resaltado la serie sube al frente y las demás se atenúan; con el modo de panel haga clic para fijarla y comparar con el promedio.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 11, ymin: 0, ymax: 100 }, { etiquetaX: 'mes', etiquetaY: 'valor', formatoX: (x) => V.MESES[Math.round(x)] || '' });
      plano.ejes();
      const foco = e.modo === 'panel' && e.fijo >= 0 ? e.fijo : e.modo === 'resaltar' || e.modo === 'panel' ? e.hover : -1;
      S.forEach((s, k) => { if (k === foco) return; VIZ.trazar(ctx, plano, s.map((v, i) => [i, v]), foco >= 0 ? C.tenue : C.inactivo, 1.5); });
      if (foco >= 0) { VIZ.trazar(ctx, plano, S[foco].map((v, i) => [i, v]), C.s2, 3); S[foco].forEach((v, i) => VIZ.marcador(ctx, plano.sx(i), plano.sy(v), C.s2, 3.5)); VIZ.web.texto(ctx, NOM[foco], plano.sx(11) - 4, plano.sy(S[foco][11]) - 12, { alinear: 'right', color: C.s2, peso: 700, tam: 11 }); }
      const prom = V.MESES.map((_, i) => S.reduce((t, s) => t + s[i], 0) / S.length);
      if (e.modo === 'panel' && e.fijo >= 0) VIZ.trazar(ctx, plano, prom.map((v, i) => [i, v]), C.tinta, 1.5, [4, 4]);
      const f = e.fijo >= 0 ? e.fijo : e.hover;
      lectura.set(f >= 0 ? [['serie', NOM[f]], ['último valor', String(S[f][11])], ['cambio en el año', `${S[f][11] - S[f][0] >= 0 ? '+' : '−'}${Math.abs(S[f][11] - S[f][0])}`], ['máximo', `${Math.max(...S[f])} (${V.MESES[S[f].indexOf(Math.max(...S[f]))]})`]] : [['series', String(S.length)], ['seleccionada', '—']]);
    }
    function cerca(x, y) { if (!plano || !plano.dentro(x, y)) return -1; const i = Math.max(0, Math.min(11, Math.round(plano.ix(x)))); let mejor = -1, md = 14; S.forEach((s, k) => { const d = Math.abs(plano.sy(s[i]) - y); if (d < md) { md = d; mejor = k; } }); return mejor; }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const k = cerca(x, y); if (k !== e.hover) { e.hover = k; dibujar(); } if (k < 0 || e.modo === 'nada') return tip.ocultar(); const i = Math.max(0, Math.min(11, Math.round(plano.ix(x)))); tip.mostrar(x, y, `<b>${NOM[k]}</b><br>${V.MESES[i]}: <b>${S[k][i]}</b>`); });
    lienzo.canvas.addEventListener('click', () => { if (e.modo === 'panel') { e.fijo = e.fijo === e.hover ? -1 : e.hover; dibujar(); } });
    lienzo.canvas.addEventListener('pointerleave', () => { e.hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: el mantra: panorama, zoom y filtro, detalles ---------- */

  function montarMantra(cuerpo) {
    const e = { etapa: 0, reg: 'Centro', mes: 5 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Etapa del recorrido', min: 0, max: 2, valor: 0, formato: (v) => ['1 · panorama general', '2 · acercar y filtrar', '3 · detalle bajo demanda'][v], alCambiar: (v) => { e.etapa = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const tabla = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(tabla);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Avance por las tres etapas. En la 2, haga clic en una celda del panorama para elegir región y mes; en la 3 verá las filas de la tabla que originan ese valor.');
    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const M = V.REGIONES.map((r) => V.MESES.map((_, m) => FILAS.filter((f) => f.region === r && f.mes === m).reduce((a, f) => a + f.ventas, 0)));
      const mx = Math.max(...M.flat()), mn = Math.min(...M.flat());
      const izq = 64, sup = 22, cw = (W - izq - 10) / 12, ch = (H - sup - 8) / 4;
      celdas = [];
      V.REGIONES.forEach((r, y) => { V.rotulo(ctx, r, izq - 8, sup + y * ch + ch / 2, { alinear: 'right', tam: 11 }); M[y].forEach((v, x) => { const sel = r === e.reg && x === e.mes, foco = e.etapa === 0 || r === e.reg; ctx.fillStyle = foco ? VIZ.css(VIZ.enRampa((v - mn) / (mx - mn))) : VIZ.alfa(C.inactivo, 0.18); ctx.fillRect(izq + x * cw, sup + y * ch, cw - 1, ch - 1); if (sel && e.etapa >= 1) { ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.strokeRect(izq + x * cw + 1, sup + y * ch + 1, cw - 3, ch - 3); } celdas.push({ x: izq + x * cw, y: sup + y * ch, w: cw, h: ch, r, m: x, v }); }); });
      V.MESES.forEach((m, x) => V.rotulo(ctx, m, izq + x * cw + cw / 2, sup - 10, { alinear: 'center', tam: 10, color: C.apagado }));
      leyenda.set([{ color: VIZ.css(VIZ.enRampa(0.1)), texto: `ventas bajas (${VIZ.fmt(mn, 3)} M$)` }, { color: VIZ.css(VIZ.enRampa(0.95)), texto: `altas (${VIZ.fmt(mx, 3)} M$)` }].concat(e.etapa >= 1 ? [{ color: C.inactivo, texto: 'regiones filtradas (atenuadas)' }] : []));
      const filas = FILAS.filter((f) => f.region === e.reg && f.mes === e.mes);
      tabla.replaceChildren();
      if (e.etapa === 2) tabla.appendChild(el('table', { class: 'tabla-datos sin-corte' }, el('tr', null, ['región', 'mes', 'categoría', 'ventas', 'pedidos', 'costo'].map((t) => el('th', null, t))), filas.map((f) => el('tr', null, el('td', { class: 'izq' }, f.region), el('td', { class: 'izq' }, V.MESES[f.mes]), el('td', { class: 'izq' }, f.cat), el('td', null, VIZ.fmt(f.ventas, 4)), el('td', null, VIZ.entero(f.pedidos)), el('td', null, VIZ.fmt(f.costo, 4))))));
      registro.textContent = e.etapa === 0 ? 'Panorama: 48 celdas resumen 144 filas. Se ven patrones generales, no detalles.' : e.etapa === 1 ? `Filtro: se atenúan las demás regiones y se enfoca ${e.reg}; celda elegida: ${V.MESES[e.mes]}.` : `Detalle: ${V.MESES[e.mes]} en ${e.reg} suma ${VIZ.fmt(filas.reduce((a, f) => a + f.ventas, 0), 4)} M$ en ${filas.length} filas.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.bajo(celdas, x, y); if (c) { e.reg = c.r; e.mes = c.m; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.bajo(celdas, x, y); if (!c) return tip.ocultar(); tip.mostrar(x, y, `${c.r} · ${V.MESES[c.m]}<br>ventas <b>${VIZ.fmt(c.v, 4)}</b> M$`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('details-on-demand', {
    intro: String.raw`
      <p>Mostrar todo a la vez es ilegible; mostrar solo lo agregado deja sin respuesta las preguntas concretas. La solución es mostrar un <strong>panorama</strong> y revelar el <strong>detalle solo cuando se pide</strong>: al pasar el cursor, al hacer clic, al acercarse.</p>
      <p>Tres herramientas la hacen posible: el <em>tooltip</em> con el valor exacto, el <em>resaltado</em> que separa un elemento del resto y el <em>panel de detalle</em> que muestra los datos de origen.</p>`,
    visualizaciones: [
      { titulo: 'Resaltar una serie entre catorce', descripcion: 'Compare sin ayuda, solo tooltip, resaltado y panel con selección fija; observe qué tan fácil es seguir una línea.', montar: montarResaltar },
      { titulo: 'Panorama, acercar y detalle', descripcion: 'Recorra las tres etapas del mantra de Shneiderman sobre la tabla de ventas.', montar: montarMantra },
    ],
    teoria: String.raw`
      <h2>El mantra de la búsqueda visual de información</h2>
      <blockquote>Primero un panorama, luego acercar y filtrar, y detalles bajo demanda.</blockquote>
      <p>(Shneiderman, 1996.) Cada etapa responde a una pregunta: ¿qué hay y cómo se reparte?, ¿qué subconjunto me interesa?, ¿cuáles son exactamente esos datos?</p>
      <h2>Resaltado</h2>
      <p>Resaltar es cambiar un canal visual de uno o pocos elementos (color, grosor, orden de dibujo) mientras se atenúa el resto. Funciona por <em>procesamiento preatencional</em>: el elemento destaca sin búsqueda (ver <a href="tema.html?id=preattentive-processing">preatentivo</a>). Reglas: un solo color de resalte, atenuar sin ocultar, y traer al frente la marca resaltada.</p>
      <h2>Tooltip</h2>
      <p>Un tooltip debe mostrar el valor exacto y su contexto (qué ítem, qué atributo, qué unidad), aparecer sin retardo molesto, no tapar el elemento y seguir al cursor. Para pantallas táctiles, que no tienen «pasar el cursor», se reemplaza por un toque que fija un panel.</p>
      <h2>Costo de interacción</h2>
      <p>Cada interacción tiene un costo para la persona, \(C = C_{\text{descubrir}} + C_{\text{ejecutar}} + C_{\text{esperar}}\), frente al costo de buscar el dato por otro medio. Una interacción vale la pena si su beneficio supera ese costo. Por eso el resaltado al pasar el cursor, que no cuesta ningún clic, es tan eficaz.</p>
      <div class="recuadro"><strong>Ojo.</strong> El detalle no reemplaza al diseño: si hace falta pasar el cursor por todo para entender la figura, el diseño estático falló.</div>
      <p>Las interacciones de selección enlazan vistas en <a href="tema.html?id=brushing-linking">brushing y linking</a>.</p>`,
  });
})();
