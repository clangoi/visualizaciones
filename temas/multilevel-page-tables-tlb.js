(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarTLB(cuerpo) {
    let tam = 4, loc = 80, tm = 100, tt = 5, sem = 1, trazaN = 60, traza, tlb, i, hits, msg, ult;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Entradas del TLB', min: 1, max: 16, valor: tam, alCambiar: (v) => { tam = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Localidad de los accesos', min: 0, max: 95, valor: loc, formato: (v) => v + ' %', alCambiar: (v) => { loc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tiempo de memoria (ns)', min: 50, max: 200, paso: 10, valor: tm, alCambiar: (v) => { tm = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2.5 });
    ctl.boton('Nuevos datos', () => { sem++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 150 : 120) });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'acierto en el TLB (1 acceso)' }, { color: C.s8, texto: 'fallo: recorrer la tabla (3 accesos)' }, { color: C.s1, texto: 'contenido del TLB (más reciente a la derecha)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las referencias a páginas tienen localidad: con alta localidad casi todas aciertan. El tiempo efectivo usa tabla de dos niveles: un fallo del TLB cuesta dos accesos extra.');
    function iniciar() {
      const rnd = VIZ.semilla(sem * 97 + loc); let p = 5; traza = [];
      for (let k = 0; k < trazaN; k++) { if (rnd() * 100 > loc) p = Math.floor(rnd() * 64); else p = Math.max(0, Math.min(63, p + Math.floor(rnd() * 3) - 1 + (rnd() < 0.5 ? 0 : 0))); traza.push(p); }
      tlb = []; hits = 0; i = 0; msg = 'TLB vacío.'; ult = null;
      return (function* () {
        for (i = 1; i <= trazaN; i++) {
          const p2 = traza[i - 1], k = tlb.indexOf(p2);
          if (k >= 0) { hits++; tlb.splice(k, 1); tlb.push(p2); ult = true; msg = `Página ${p2}: acierto en el TLB; 1 acceso a memoria.`; }
          else { ult = false; if (tlb.length >= tam) tlb.shift(); tlb.push(p2); msg = `Página ${p2}: fallo del TLB; se recorren 2 niveles (3 accesos) y se carga la entrada.`; }
          yield;
        }
      })();
    }
    function dibujar() {
      if (!traza) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const n = trazaN, bw = (W - 16) / n;
      for (let k = 0; k < n; k++) {
        const hecho = k < i; let col = C.inactivo;
        if (hecho) { // recalcular acierto de la posición k
          col = aciertos[k] ? C.s6 : C.s8;
        }
        ctx.fillStyle = col; ctx.fillRect(8 + k * bw, 8, Math.max(1, bw - 1), 20);
      }
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = C.tinta2; ctx.fillText('TLB:', 8, 52);
      tlb.forEach((p, k) => { const x = 46 + k * 38, y = 40; ctx.fillStyle = VIZ.alfa(C.s1, 0.25); ctx.fillRect(x, y, 34, 24); ctx.strokeStyle = C.s1; ctx.strokeRect(x, y, 34, 24); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.fillText(String(p), x + 17, y + 12); });
      registro.textContent = msg;
      const h = i ? hits / i : 0, eat = h * (tm + 5) + (1 - h) * (3 * tm + 5);
      lectura.set([['accesos', `${i} de ${n}`], ['tasa de aciertos', i ? `${VIZ.fmt(h * 100, 3)} %` : '—'], ['tiempo efectivo', i ? `${VIZ.fmt(eat, 4)} ns` : '—'], ['sin TLB (2 niveles)', `${3 * tm} ns`]]);
    }
    let aciertos = [];
    const base = iniciar;
    // Precalcula aciertos para colorear la traza
    function precalc() { const t = []; let c = []; traza.forEach((p) => { const k = c.indexOf(p); if (k >= 0) { c.splice(k, 1); c.push(p); t.push(true); } else { if (c.length >= tam) c.shift(); c.push(p); t.push(false); } }); aciertos = t; }
    const orig = rep.reiniciar;
    rep.reiniciar = function () { orig(); precalc(); dibujar(); };
    lienzo.alDibujar = dibujar;
    void base;
    rep.reiniciar();
  }

  function montarTablas(cuerpo) {
    let mb = 64, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Memoria usada por el proceso (MB, contigua)', min: 1, max: 4096, paso: 1, valor: mb, alCambiar: (v) => { mb = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 150 });
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'una tabla plana' }, { color: C.s1, texto: 'dos niveles' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Espacio virtual de 32 bits, páginas de 4 KB y entradas de 4 bytes. La tabla plana ocupa siempre 4 MB; la de dos niveles solo crea las tablas de segundo nivel que se usan.');
    const plana = () => 4096, dos = (m) => 4 + 4 * Math.ceil(m / 4); // KB: raíz 4 KB + una tabla de 4 KB por cada 4 MB mapeados
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const mx = 4096 + 10, izq = 100, ancho = W - izq - 70;
      [['tabla plana', plana(), C.s8], ['dos niveles', dos(mb), C.s1]].forEach(([t, v, col], k) => {
        const y = 16 + k * 50, w = (v / mx) * ancho;
        ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle'; ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(t, izq - 8, y + 16);
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(izq, y, Math.max(2, w), 32, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(`${VIZ.entero(v)} KB`, izq + w + 6, y + 16);
      });
      lectura.set([['páginas usadas', VIZ.entero(mb * 256)], ['tablas de 2.º nivel', String(Math.ceil(mb / 4))], ['ahorro', `${VIZ.fmt((1 - dos(mb) / plana()) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('multilevel-page-tables-tlb', {
    intro: String.raw`
      <p>La paginación tiene dos problemas prácticos. Primero, <strong>la tabla de páginas es enorme</strong>: un espacio de 32 bits con páginas de 4 KB necesita un millón de entradas por proceso, casi todas vacías. Segundo, <strong>cada acceso se duplica</strong>: hay que leer la tabla antes de leer el dato.</p>
      <p>Las <strong>tablas multinivel</strong> resuelven el primero creando solo las partes de la tabla que se usan. El <strong>TLB</strong>, una pequeña caché de traducciones recientes dentro de la MMU, resuelve el segundo.</p>`,
    visualizaciones: [
      { titulo: 'El TLB y la localidad', descripcion: 'Reproduzca los accesos. Con alta localidad el TLB acierta casi siempre y el tiempo efectivo se acerca a un acceso; con accesos al azar, no.', montar: montarTLB },
      { titulo: 'Tabla plana frente a dos niveles', descripcion: 'Mueva la memoria que usa el proceso y compare el tamaño de las tablas.', montar: montarTablas },
    ],
    teoria: String.raw`
      <h2>Tablas de dos niveles</h2>
      <p>La dirección de 32 bits se divide en \(10 + 10 + 12\) bits: índice en la tabla raíz, índice en la tabla de segundo nivel y desplazamiento.</p>
      <pre><code>traducir(v):
    i1 ← v &gt;&gt; 22;   i2 ← (v &gt;&gt; 12) &amp; 0x3FF;   d ← v &amp; 0xFFF
    t2 ← raíz[i1]            # acceso a memoria 1
    si no presente: falla
    marco ← t2[i2]           # acceso a memoria 2
    devolver marco · 4096 + d   # acceso 3: el dato</code></pre>
      <p>Cada tabla cabe justo en una página de 4 KB. Si el proceso usa \(U\) páginas contiguas, necesita \(1 + \lceil U/1024 \rceil\) tablas en lugar de una de 4 MB. En 64 bits se usan cuatro o cinco niveles.</p>
      <h2>Tiempo efectivo de acceso</h2>
      <p>Con tasa de aciertos \(h\), tiempo del TLB \(t_{TLB}\), tiempo de memoria \(t_m\) y \(L\) niveles:</p>
      \[ \text{TEA} = h\,(t_{TLB} + t_m) + (1-h)\,\bigl(t_{TLB} + (L+1)\,t_m\bigr). \]
      <p>Con \(t_m = 100\) ns, \(t_{TLB} = 5\) ns y dos niveles: \(h = 99\,\%\) da 108 ns; \(h = 80\,\%\) da 165 ns. Por eso importa la localidad (ver <a href="tema.html?id=thrashing-locality">localidad y thrashing</a>).</p>
      <h2>Detalles</h2>
      <ul><li>Al hacer un <a href="tema.html?id=context-switch">cambio de contexto</a> el TLB se vacía, salvo que sus entradas lleven un identificador de proceso (ASID).</li><li>«Alcance del TLB» = entradas × tamaño de página; las <em>páginas grandes</em> (2 MB) lo amplían.</li><li>La traducción base: <a href="tema.html?id=paging-address-translation">paginación</a>.</li></ul>`,
  });
})();
