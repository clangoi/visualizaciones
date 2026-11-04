(function () {
  'use strict';
  const { color: C } = VIZ;

  // Dibuja la memoria física (0..MEM) con bloques [{ base, tam, nombre, color }] y marca una dirección física.
  function memoria(lienzo, bloques, MEM, marca, falla) {
    const { ctx, ancho: W } = lienzo, x0 = 14, w = W - 28, y = 34, h = 44;
    lienzo.limpiar();
    ctx.fillStyle = C.neutro; ctx.fillRect(x0, y, w, h); ctx.strokeStyle = C.eje; ctx.strokeRect(x0, y, w, h);
    ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
    for (const b of bloques) {
      ctx.fillStyle = VIZ.alfa(b.color, 0.45); ctx.fillRect(x0 + (b.base / MEM) * w, y, (b.tam / MEM) * w, h);
      ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.strokeRect(x0 + (b.base / MEM) * w, y, (b.tam / MEM) * w, h); ctx.lineWidth = 1;
      ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.fillText(b.nombre, x0 + ((b.base + b.tam / 2) / MEM) * w, y + h / 2, (b.tam / MEM) * w - 4);
      ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText(String(b.base), x0 + (b.base / MEM) * w + 2, y - 10);
    }
    ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.fillText(String(MEM), x0 + w, y - 10);
    if (marca != null) {
      const xm = x0 + Math.min(1, marca / MEM) * w;
      ctx.strokeStyle = falla ? C.s8 : C.s2; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xm, y + h + 24); ctx.lineTo(xm, y + h + 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xm, y + h + 2); ctx.lineTo(xm - 5, y + h + 11); ctx.lineTo(xm + 5, y + h + 11); ctx.fill(); ctx.lineWidth = 1;
      ctx.font = VIZ.fuente(11, 600); ctx.textAlign = xm > W - 70 ? 'right' : 'left'; ctx.fillText(falla ? 'trampa: acceso inválido' : `física ${marca}`, xm + (xm > W - 70 ? 4 : -4), y + h + 36);
    }
  }

  function montarBaseLimite(cuerpo) {
    const MEM = 1024, base = 300, lim = 200;
    let dir = 120;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dirección lógica generada', min: 0, max: 300, valor: dir, alCambiar: (v) => { dir = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 130 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'memoria del proceso (base = 300, límite = 200)' }, { color: C.s2, texto: 'dirección física calculada', forma: 'punto' }, { color: C.s8, texto: 'acceso fuera del límite', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con un registro base y un registro límite, el hardware comprueba cada acceso: si dir ≥ límite, trampa al núcleo; si no, física = base + dir.');
    function dibujar() {
      const falla = dir >= lim;
      memoria(lienzo, [{ base: 0, tam: base, nombre: 'otros', color: C.inactivo }, { base, tam: lim, nombre: 'proceso', color: C.s1 }, { base: base + lim, tam: MEM - base - lim, nombre: 'otros', color: C.inactivo }], MEM, falla ? base + dir : base + dir, falla);
      registro.textContent = falla ? `Dirección ${dir} ≥ límite ${lim}: el hardware genera una excepción y el núcleo termina el proceso.` : `${dir} < ${lim}: física = ${base} + ${dir} = ${base + dir}.`;
      lectura.set([['lógica', String(dir)], ['¿dir < límite?', falla ? 'no' : 'sí'], ['física', falla ? '—' : String(base + dir)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  function montarSegmentos(cuerpo) {
    const MEM = 1024, S = [{ n: 'código', base: 60, lim: 140, c: C.s1 }, { n: 'datos', base: 330, lim: 100, c: C.s3 }, { n: 'montículo', base: 480, lim: 260, c: C.s4 }, { n: 'pila', base: 800, lim: 180, c: C.s7 }];
    let seg = 0, off = 50;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Segmento', opciones: S.map((s, i) => [i, `${i} · ${s.n}`]), valor: seg, alCambiar: (v) => { seg = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Desplazamiento', min: 0, max: 300, valor: off, alCambiar: (v) => { off = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 130 });
    VIZ.leyenda(cuerpo, S.map((s) => ({ color: s.c, texto: s.n })).concat([{ color: C.s2, texto: 'dirección física', forma: 'punto' }, { color: C.s8, texto: 'fuera del segmento', forma: 'punto' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La dirección lógica es el par (segmento, desplazamiento). La tabla de segmentos da base y límite de cada uno; cada segmento puede estar en cualquier lugar y tener su propio tamaño.');
    function dibujar() {
      const s = S[seg], falla = off >= s.lim;
      memoria(lienzo, S.map((x) => ({ base: x.base, tam: x.lim, nombre: x.n, color: x.c })), MEM, s.base + off, falla);
      registro.textContent = falla ? `(${seg}, ${off}): desplazamiento ≥ límite ${s.lim} del segmento «${s.n}»: trampa.` : `(${seg}, ${off}): ${off} < ${s.lim}, física = ${s.base} + ${off} = ${s.base + off}.`;
      lectura.set([['segmento', `${seg} (${s.n})`], ['base · límite', `${s.base} · ${s.lim}`], ['física', falla ? '—' : String(s.base + off)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('base-limit-segmentation', {
    intro: String.raw`
      <p>Cada proceso cree tener la memoria para él solo, con direcciones que empiezan en 0: su <strong>espacio de direcciones</strong>. Esas son direcciones <em>lógicas</em> (o virtuales); la <em>MMU</em>, un circuito entre la CPU y la memoria, las traduce a direcciones <em>físicas</em> en cada acceso y a la vez comprueba que no se salgan de lo permitido.</p>
      <p>El esquema más simple usa un par de registros: <strong>base</strong> y <strong>límite</strong>. La <strong>segmentación</strong> lo generaliza: un par por cada parte lógica del programa (código, datos, montículo, pila).</p>`,
    visualizaciones: [
      { titulo: 'Registros base y límite', descripcion: 'Mueva la dirección lógica: dentro del límite se traduce sumando la base; al pasarse, el hardware detiene el acceso.', montar: montarBaseLimite },
      { titulo: 'Tabla de segmentos', descripcion: 'Elija un segmento y un desplazamiento. Pruebe uno mayor que el límite del segmento.', montar: montarSegmentos },
    ],
    teoria: String.raw`
      <h2>Traducción y protección</h2>
      <pre><code>traducir(dir):
    si dir ≥ límite:  excepción (violación de protección)
    devolver base + dir</code></pre>
      <p>Solo el núcleo (en <a href="tema.html?id=kernel-user-mode">modo núcleo</a>) puede cargar estos registros. Esto da <strong>aislamiento</strong>, <strong>protección</strong> y <strong>reubicación</strong>: el mismo programa puede cargarse en cualquier lugar de la memoria cambiando solo la base.</p>
      <h2>Segmentación</h2>
      <p>La dirección es \((s, d)\); la tabla da \((\text{base}_s, \text{límite}_s)\):</p>
      \[ \text{física}(s, d) = \begin{cases} \text{base}_s + d & \text{si } d &lt; \text{límite}_s,\\ \text{trampa} & \text{en otro caso.} \end{cases} \]
      <p>Ventajas: cada segmento puede crecer por separado, tener permisos propios (código de solo lectura) y compartirse entre procesos. Inconveniente: los segmentos tienen tamaño variable, lo que produce <strong>fragmentación externa</strong> (ver <a href="tema.html?id=memory-allocation">asignación contigua</a>). <a href="tema.html?id=paging-address-translation">La paginación</a> la elimina usando bloques de tamaño fijo.</p>`,
  });
})();
