(function () {
  'use strict';
  const { color: C, el } = VIZ;

  function montarTraduccion(cuerpo) {
    // Espacio virtual de 16 bits (64 KB) y memoria física de 32 KB.
    let psel = 12, dir = 0x2A7C, sem = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tamaño de página', opciones: [[10, '1 KB'], [11, '2 KB'], [12, '4 KB'], [13, '8 KB']], valor: psel, alCambiar: (v) => { psel = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Dirección virtual', min: 0, max: 65535, paso: 1, valor: dir, formato: (v) => '0x' + (+v).toString(16).toUpperCase().padStart(4, '0'), alCambiar: (v) => { dir = v; dibujar(); } });
    ctl.boton('Otra tabla de páginas', () => { sem++; dibujar(); });
    const bits = el('div', { class: 'fichas' });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.append(bits, caja);
    cuerpo.dataset.sinLeyenda = 'tabla con la fila usada resaltada con texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los bits altos de la dirección virtual son el número de página; los bajos, el desplazamiento dentro de ella. La tabla da el marco físico (o marca la página como no presente).');
    function tabla(np, nm) {
      const rnd = VIZ.semilla(sem * 53 + psel), marcos = Array.from({ length: nm }, (_, i) => i);
      for (let i = nm - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [marcos[i], marcos[j]] = [marcos[j], marcos[i]]; }
      return Array.from({ length: np }, (_, i) => (i < nm && rnd() < 0.85 ? marcos[i] : -1));
    }
    function dibujar() {
      const tam = 2 ** psel, np = 65536 / tam, nm = 32768 / tam, T = tabla(np, nm);
      const pag = Math.floor(dir / tam), off = dir % tam, marco = T[pag];
      const bin = dir.toString(2).padStart(16, '0'), pb = 16 - psel;
      bits.replaceChildren(el('span', { class: 'ficha' }, 'dirección virtual'), VIZ.ficha(bin.slice(0, pb) + ' ', { color: C.s1, tinta: C.s1 }), VIZ.ficha(bin.slice(pb), { color: C.s2, tinta: C.s2 }),
        el('span', { class: 'ficha' }, `página ${pag} · desplazamiento ${off}`));
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['página', 'presente', 'marco'].map((h) => el('th', null, h))),
        T.map((m, i) => el('tr', null, ...[String(i), m >= 0 ? 'sí' : 'no', m >= 0 ? String(m) : '—'].map((v) => el('td', { style: i === pag ? { fontWeight: 600, color: marco >= 0 ? C.s1 : C.s8 } : {} }, (i === pag ? '▸ ' : '') + v))))));
      const fis = marco * tam + off;
      registro.textContent = marco >= 0 ? `Página ${pag} → marco ${marco}. Física = ${marco} · ${tam} + ${off} = ${fis} (0x${fis.toString(16).toUpperCase()}).` : `Página ${pag} no está presente: falla de página; el núcleo debe traerla del disco (ver reemplazo de páginas).`;
      lectura.set([['páginas virtuales', String(np)], ['marcos físicos', String(nm)], ['bits: página · desplazamiento', `${pb} · ${psel}`], ['entradas de la tabla', String(np)]]);
    }
    dibujar();
  }

  function montarTamano(cuerpo) {
    let s = 1024, e = 8, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño medio de un proceso (KB)', min: 64, max: 8192, paso: 64, valor: s, alCambiar: (v) => { s = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Bytes por entrada de tabla', min: 2, max: 16, paso: 2, valor: e, alCambiar: (v) => { e = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tabla de páginas: s·e/p', forma: 'linea' }, { color: C.s2, texto: 'fragmentación interna: p/2', forma: 'linea' }, { color: C.tinta, texto: 'total', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Páginas grandes: tablas pequeñas pero más memoria desperdiciada en la última página. Páginas pequeñas: lo contrario. El mínimo está en p = √(2·s·e).');
    const tabla = (p) => (s * 1024 * e) / (p * 1024) / 1024, frag = (p) => p / 2; // en KB, p en KB
    const tot = (p) => ((s * e) / (p * 1024)) * 1 + p / 2; // KB: tabla = (s KB / p KB) * e bytes / 1024
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tb = (p) => (s / p) * e / 1024, fr = (p) => p / 2, to = (p) => tb(p) + fr(p), pts = (f) => Array.from({ length: 120 }, (_, i) => { const p = 0.25 * 1.07 ** i; return [p, f(p)]; }).filter(([p]) => p <= 64);
      const mx = Math.max(...pts(to).map((q) => q[1]));
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 64, ymin: 0, ymax: Math.min(mx, 60) }, { etiquetaX: 'tamaño de página p (KB)', etiquetaY: 'KB por proceso' });
      plano.ejes(); ctx.save(); plano.recortar();
      VIZ.trazar(ctx, plano, pts(tb), C.s1, 2); VIZ.trazar(ctx, plano, pts(fr), C.s2, 2); VIZ.trazar(ctx, plano, pts(to), C.tinta, 2.5);
      ctx.restore();
      const opt = Math.sqrt((2 * s * e) / 1024);
      if (opt < 64) VIZ.marcador(ctx, plano.sx(opt), plano.sy(to(opt)), C.tinta, 5);
      lectura.set([['p óptimo', `${VIZ.fmt(opt, 3)} KB`], ['costo mínimo', `${VIZ.fmt(to(opt), 3)} KB`], ['con 4 KB', `${VIZ.fmt(to(4), 3)} KB`]]);
      dibujar.tb = tb; dibujar.fr = fr;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const p = Math.max(0.25, plano.ix(x));
      tip.mostrar(x, y, `p = <b>${VIZ.fmt(p, 3)}</b> KB` + VIZ.filaTooltip(C.s1, 'tabla', VIZ.fmt(dibujar.tb(p), 3) + ' KB') + VIZ.filaTooltip(C.s2, 'frag. interna', VIZ.fmt(dibujar.fr(p), 3) + ' KB'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('paging-address-translation', {
    intro: String.raw`
      <p>La <strong>paginación</strong> divide el espacio de direcciones virtual en bloques de tamaño fijo, las <em>páginas</em>, y la memoria física en <em>marcos</em> del mismo tamaño. Cualquier página puede ir en cualquier marco, de modo que ya no hay fragmentación externa ni hace falta que el proceso sea contiguo en memoria.</p>
      <p>Una <strong>tabla de páginas</strong> por proceso indica en qué marco está cada página. La MMU consulta la tabla en cada acceso: el número de página se reemplaza por el de marco y el desplazamiento se conserva.</p>`,
    visualizaciones: [
      { titulo: 'Traducir una dirección virtual', descripcion: 'Mueva la dirección y observe cómo se separan número de página y desplazamiento. Si cae en una página «no presente» ocurre una falla de página. Cambie el tamaño de página.', montar: montarTraduccion },
      { titulo: 'El tamaño de página óptimo', descripcion: 'La tabla pesa menos con páginas grandes; el desperdicio de la última página crece con ellas. Busque el mínimo del total.', montar: montarTamano },
    ],
    teoria: String.raw`
      <h2>Traducción</h2>
      <p>Con páginas de \(2^k\) bytes, una dirección virtual \(v\) se divide en</p>
      \[ \text{página} = \left\lfloor \frac{v}{2^k} \right\rfloor, \qquad \text{desplazamiento} = v \bmod 2^k, \qquad \text{física} = \text{marco}[\text{página}] \cdot 2^k + \text{desplazamiento}. \]
      <p>Cada entrada de la tabla incluye además bits de <em>presente</em>, <em>modificada</em>, <em>referenciada</em> y permisos (lectura, escritura, ejecución). Si la página no está presente se produce una <a href="tema.html?id=interrupts-exceptions">falla de página</a> y el núcleo la trae del disco; los algoritmos que eligen qué sacar están en <a href="tema.html?id=page-replacement">reemplazo de páginas</a>.</p>
      <h2>Costo de la paginación</h2>
      <ul><li><strong>Fragmentación interna</strong>: la última página de cada proceso queda en promedio medio llena, \(p/2\) bytes.</li>
      <li><strong>Tabla</strong>: un espacio de \(s\) bytes necesita \(s/p\) entradas de \(e\) bytes.</li>
      <li><strong>Un acceso extra</strong> a memoria por cada traducción, que el <a href="tema.html?id=multilevel-page-tables-tlb">TLB</a> evita casi siempre.</li></ul>
      \[ C(p) = \frac{s\,e}{p} + \frac{p}{2} \;\Rightarrow\; C'(p) = -\frac{s\,e}{p^2} + \frac{1}{2} = 0 \;\Rightarrow\; p^\* = \sqrt{2\,s\,e}. \]
      <p>Con \(s = 1\) MB y \(e = 8\) bytes, \(p^\* \approx 4\) KB, que es el tamaño habitual.</p>`,
  });
})();
