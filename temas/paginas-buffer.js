(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: página con ranuras ---------- */

  const TAM = 128, CABECERA = 8, RANURA = 4; // unidades de la página

  function montarPagina(cuerpo) {
    let tam = 14, pagina, siguiente, mensaje, elegido = null, rnd = VIZ.semilla(5);
    function reiniciar() {
      // ranuras: [{ off, len }] (null = ranura libre); los registros crecen desde el final.
      pagina = { ranuras: [], finLibre: TAM };
      siguiente = 0; elegido = null;
      [18, 10, 22, 12, 16].forEach((l) => insertar(l));
      mensaje = 'Página con 5 registros. El directorio de ranuras crece desde la cabecera; los registros, desde el final.';
    }
    const libreContigua = () => pagina.finLibre - (CABECERA + pagina.ranuras.length * RANURA);
    const libreTotal = () => TAM - CABECERA - pagina.ranuras.length * RANURA - pagina.ranuras.reduce((s, r) => s + (r ? r.len : 0), 0);
    function insertar(len) {
      const libre = pagina.ranuras.indexOf(null);
      const extra = libre >= 0 ? 0 : RANURA;
      if (libreContigua() < len + extra) {
        if (libreTotal() >= len + extra) return 'fragmentada';
        return 'llena';
      }
      pagina.finLibre -= len;
      const r = { off: pagina.finLibre, len, id: siguiente++ };
      if (libre >= 0) pagina.ranuras[libre] = r; else pagina.ranuras.push(r);
      return libre >= 0 ? libre : pagina.ranuras.length - 1;
    }
    function compactar() {
      let fin = TAM;
      pagina.ranuras.filter(Boolean).sort((a, b) => b.off - a.off).forEach((r) => { fin -= r.len; r.off = fin; });
      pagina.finLibre = fin;
    }
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del registro', min: 4, max: 30, valor: tam, alCambiar: (v) => { tam = v; } });
    ctl.boton('Insertar', () => {
      const r = insertar(tam);
      mensaje = r === 'llena' ? `No cabe: quedan ${libreTotal()} unidades libres en total.`
        : r === 'fragmentada' ? `No hay ${tam} unidades contiguas, aunque en total quedan ${libreTotal()}: la página está fragmentada. Compacte.`
          : `Registro insertado en la ranura ${r}: su rid es (página 7, ranura ${r}).`;
      elegido = typeof r === 'number' ? r : null;
      dibujar();
    }, { primario: true });
    ctl.boton('Borrar un registro al azar', () => {
      const vivos = pagina.ranuras.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
      if (!vivos.length) { mensaje = 'La página está vacía.'; return dibujar(); }
      const i = vivos[Math.floor(rnd() * vivos.length)];
      pagina.ranuras[i] = null; elegido = null;
      mensaje = `Borrado el registro de la ranura ${i}. La ranura queda libre, pero los demás rids no cambian; queda un hueco entre registros.`;
      dibujar();
    });
    ctl.boton('Compactar', () => {
      compactar();
      mensaje = 'Compactación: los registros se mueven al final de la página y el espacio libre queda contiguo. Solo cambian los desplazamientos del directorio, no los rids.';
      dibujar();
    });
    ctl.boton('Reiniciar', () => { reiniciar(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 170 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'cabecera' },
      { color: C.s4, texto: 'directorio de ranuras' },
      { color: C.s1, texto: 'registro' },
      { color: C.s2, texto: 'registro recién insertado' },
      { color: C.neutro, borde: C.eje, texto: 'espacio libre' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Borre varios registros y luego intente insertar uno grande: falla por fragmentación hasta que compacte. Pase el cursor sobre la página.');

    let geo = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 10, w = W - 20, u = w / TAM, y0 = 60, h = 60;
      const X = (v) => x0 + v * u;
      geo = [];
      ctx.fillStyle = C.neutro; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = C.apagado; ctx.fillRect(X(0), y0, CABECERA * u, h);
      geo.push({ a: 0, b: CABECERA, html: `<b>cabecera</b><br>nº de ranuras: ${pagina.ranuras.length}<br>inicio del espacio libre: ${pagina.finLibre}` });
      pagina.ranuras.forEach((r, i) => {
        const a = CABECERA + i * RANURA;
        ctx.fillStyle = r ? C.s4 : VIZ.alfa(C.s4, 0.3);
        ctx.fillRect(X(a) + 1, y0, RANURA * u - 2, h);
        B.texto(ctx, String(i), X(a + RANURA / 2), y0 + h / 2, { alinear: 'center', px: 10, color: C.tinta });
        geo.push({ a, b: a + RANURA, html: `<b>ranura ${i}</b><br>${r ? `desplazamiento ${r.off}, largo ${r.len}` : 'libre'}` });
      });
      pagina.ranuras.forEach((r, i) => {
        if (!r) return;
        ctx.fillStyle = i === elegido ? C.s2 : C.s1;
        ctx.fillRect(X(r.off) + 1, y0, r.len * u - 2, h);
        B.texto(ctx, `r${r.id}`, X(r.off + r.len / 2), y0 + h / 2, { alinear: 'center', px: 10, color: C.sobre });
        geo.push({ a: r.off, b: r.off + r.len, html: `<b>registro r${r.id}</b><br>rid = (7, ${i})<br>${r.len} unidades desde ${r.off}` });
        // Puntero de la ranura al registro.
        const sx = X(CABECERA + i * RANURA + RANURA / 2), ex = X(r.off + r.len / 2);
        ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, y0); ctx.bezierCurveTo(sx, y0 - 30 - i * 4, ex, y0 - 30 - i * 4, ex, y0 - 2); ctx.stroke();
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      // Marcas de libre contiguo.
      const a = CABECERA + pagina.ranuras.length * RANURA;
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(X(a), y0 + h + 6); ctx.lineTo(X(a), y0 + h + 20); ctx.moveTo(X(pagina.finLibre), y0 + h + 6); ctx.lineTo(X(pagina.finLibre), y0 + h + 20); ctx.stroke();
      ctx.setLineDash([]);
      if (pagina.finLibre - a > 0) B.texto(ctx, `libre contiguo: ${pagina.finLibre - a}`, (X(a) + X(pagina.finLibre)) / 2, y0 + h + 14, { alinear: 'center', px: 10, color: C.apagado });
      B.texto(ctx, '0', x0, y0 + h + 34, { px: 10, color: C.apagado });
      B.texto(ctx, String(TAM), x0 + w, y0 + h + 34, { alinear: 'right', px: 10, color: C.apagado });
      registro.textContent = mensaje;
      const vivos = pagina.ranuras.filter(Boolean).length;
      lectura.set([
        ['registros', String(vivos)],
        ['ranuras', String(pagina.ranuras.length)],
        ['libre total', String(libreTotal())],
        ['libre contiguo', String(libreContigua())],
        ['fragmentación', libreTotal() ? `${Math.round(100 * (1 - libreContigua() / libreTotal()))} %` : '—'],
      ]);
      geo.forEach((g) => { g.x1 = X(g.a); g.x2 = X(g.b); g.y1 = y0; g.y2 = y0 + h; });
    }
    lienzo.alDibujar = () => pagina && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = [...geo].reverse().find((q) => x >= q.x1 && x <= q.x2 && y >= q.y1 && y <= q.y2);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, g.html);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    reiniciar();
    dibujar();
  }

  /* ---------- Fig. 2: políticas de reemplazo del buffer ---------- */

  const SECUENCIAS = {
    localidad: { nombre: 'con localidad', f: () => [1, 2, 3, 1, 4, 1, 2, 5, 1, 2, 3, 6, 1, 2, 4, 1, 5, 2, 1, 3] },
    escaneo: { nombre: 'recorrido repetido de 5 páginas', f: () => [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5] },
    mezcla: { nombre: 'índice caliente + recorrido', f: () => [1, 10, 1, 11, 1, 12, 1, 13, 1, 14, 1, 15, 1, 16, 1, 17] },
  };
  const POLITICAS = ['LRU', 'Clock', 'MRU', 'FIFO'];

  // Simula una política y devuelve los estados después de cada pedido.
  function simular(pol, marcos, seq) {
    const m = [], ultimo = new Map(), llegada = new Map(), ref = new Map();
    let mano = 0;
    const estados = [];
    seq.forEach((p, t) => {
      let acierto = m.includes(p), victima = null;
      if (!acierto) {
        if (m.length < marcos) m.push(p);
        else {
          let i;
          if (pol === 'LRU') i = m.reduce((b, q, k) => (ultimo.get(q) < ultimo.get(m[b]) ? k : b), 0);
          else if (pol === 'MRU') i = m.reduce((b, q, k) => (ultimo.get(q) > ultimo.get(m[b]) ? k : b), 0);
          else if (pol === 'FIFO') i = m.reduce((b, q, k) => (llegada.get(q) < llegada.get(m[b]) ? k : b), 0);
          else {
            while (ref.get(m[mano])) { ref.set(m[mano], false); mano = (mano + 1) % marcos; }
            i = mano; mano = (mano + 1) % marcos;
          }
          victima = m[i]; m[i] = p;
        }
        llegada.set(p, t);
      }
      ultimo.set(p, t); ref.set(p, true);
      estados.push({ marcos: [...m], acierto, victima, mano, ref: new Map(ref), p });
    });
    return estados;
  }

  function montarBuffer(cuerpo) {
    let marcos = 4, seq = 'escaneo', pol = 'LRU', t = -1, estados = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Pedidos', valor: seq, opciones: Object.entries(SECUENCIAS).map(([k, v]) => [k, v.nombre]), alCambiar: (v) => { seq = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Política', valor: pol, opciones: POLITICAS.map((p) => [p, p]), alCambiar: (v) => { pol = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Marcos de buffer', min: 2, max: 6, valor: marcos, alCambiar: (v) => { marcos = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 170 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'acierto (la página ya estaba)' },
      { color: C.s8, texto: 'fallo (se lee del disco)' },
      { color: C.s2, texto: 'marco recién cargado' },
      { color: C.s4, texto: 'bit de referencia (Clock)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con el recorrido repetido de 5 páginas y 4 marcos, LRU falla en cada pedido (inundación secuencial) y MRU acierta casi siempre.');

    function iniciar() {
      t = -1;
      estados = simular(pol, marcos, SECUENCIAS[seq].f());
      return (function* () { for (t = 0; t < estados.length; t++) yield; t = estados.length - 1; })();
    }
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const s = SECUENCIAS[seq].f();
      const cw = Math.min(34, (W - 20) / s.length);
      geo = [];
      B.texto(ctx, 'pedidos', 10, 10, { px: 10, color: C.apagado });
      s.forEach((p, i) => {
        const x = 10 + i * cw, y = 20;
        const e = estados[i];
        const hecho = i <= t;
        const col = !hecho ? C.inactivo : e.acierto ? C.s6 : C.s8;
        ctx.fillStyle = hecho ? col : C.superficie;
        ctx.fillRect(x + 1, y, cw - 2, 24);
        ctx.strokeStyle = col; ctx.lineWidth = i === t ? 2.5 : 1; ctx.strokeRect(x + 1.5, y + 0.5, cw - 3, 23);
        B.texto(ctx, String(p), x + cw / 2, y + 12, { alinear: 'center', px: cw < 22 ? 10 : 12, color: hecho ? C.sobre : C.tinta2, peso: 500 });
        geo.push({ x, y, w: cw, h: 24, html: `pedido ${i + 1}: página <b>${p}</b><br>${e.acierto ? 'acierto' : `fallo${e.victima != null ? `, sale la ${e.victima}` : ''}`}` });
      });
      const e = t >= 0 ? estados[t] : { marcos: [], ref: new Map(), mano: 0 };
      const mw = Math.min(70, (W - 20) / marcos - 8), y = 80;
      B.texto(ctx, 'marcos del buffer', 10, y - 10, { px: 10, color: C.apagado });
      for (let i = 0; i < marcos; i++) {
        const x = 10 + i * (mw + 8);
        const p = e.marcos[i];
        const nuevo = t >= 0 && !e.acierto && p === e.p;
        B.caja(ctx, x, y, mw, 40, p == null ? '—' : String(p), { relleno: nuevo ? C.s2 : C.superficie, tinta: nuevo ? C.sobre : p == null ? C.inactivo : C.tinta, px: 14 });
        if (pol === 'Clock' && p != null) {
          if (e.ref.get(p)) { ctx.fillStyle = C.s4; ctx.beginPath(); ctx.arc(x + mw - 8, y + 8, 4, 0, Math.PI * 2); ctx.fill(); }
          if (i === e.mano) B.flecha(ctx, x + mw / 2, y + 66, x + mw / 2, y + 44, C.tinta2, 1.5, 6);
        }
      }
      if (pol === 'Clock') B.texto(ctx, 'manecilla', 10, y + 74, { px: 10, color: C.apagado });
      const hechos = estados.slice(0, t + 1);
      const ac = hechos.filter((x) => x.acierto).length;
      registro.textContent = t < 0 ? 'Pulse «Un paso» para atender el primer pedido.'
        : e.acierto ? `Página ${e.p}: acierto, ya está en un marco.`
          : `Página ${e.p}: fallo. ${e.victima != null ? `${pol} elige como víctima la página ${e.victima}.` : 'Había un marco libre.'}`;
      const tasa = (pl) => { const r = simular(pl, marcos, s); return `${Math.round((100 * r.filter((x) => x.acierto).length) / r.length)} %`; };
      lectura.set([
        ['aciertos', `${ac} de ${hechos.length}`],
        ...POLITICAS.map((pl) => [`tasa ${pl}`, tasa(pl)]),
      ]);
    }
    lienzo.alDibujar = () => estados.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, g.html);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('paginas-buffer', {
    intro: String.raw`
      <p>El disco se lee y escribe de a <strong>páginas</strong> de tamaño fijo (típicamente 8 KiB). Dentro de una página, los registros se
      organizan para que se puedan insertar, borrar y mover sin cambiar su identificador, que otros (los índices) usan para encontrarlos.</p>
      <p>En memoria, el <strong>gestor de buffer</strong> mantiene un arreglo de marcos donde caben algunas páginas. Cuando se pide una
      página que no está, hay que elegir cuál sacar: esa <strong>política de reemplazo</strong> decide cuántas veces se va al disco.</p>`,
    visualizaciones: [
      {
        titulo: 'Una página con ranuras',
        descripcion: 'Inserte y borre registros de largo variable. El directorio de ranuras permite mover registros dentro de la página (compactar) sin cambiar su rid.',
        montar: montarPagina,
      },
      {
        titulo: 'Reemplazo en el buffer',
        descripcion: 'Atienda una secuencia de pedidos con LRU, Clock, MRU o FIFO. Compare las tasas de acierto: ninguna política es la mejor para todos los patrones.',
        montar: montarBuffer,
      },
    ],
    teoria: String.raw`
      <h2>Registros y páginas</h2>
      <p>Un <strong>rid</strong> (identificador de registro) es el par (número de página, número de ranura). Con registros de largo
      variable, la página usa un <strong>directorio de ranuras</strong>: cada ranura guarda el desplazamiento y el largo de un registro.
      El directorio crece desde el inicio y los registros desde el final, de modo que el espacio libre queda en el medio.</p>
      <div class="recuadro">Mover un registro dentro de la página solo cambia su ranura, no su rid. Por eso se puede compactar sin
      actualizar los índices. Si el registro crece y no cabe, se deja en la ranura un puntero a otra página (<em>forwarding</em>).</div>
      <p>Las páginas de una tabla se enlazan en un archivo heap con una lista de páginas con espacio libre, o con un directorio de páginas
      que registra cuánto espacio libre tiene cada una.</p>

      <h2>El gestor de buffer</h2>
      <pre><code>pedir(p):
    si p está en un marco: pin_count[p] ← pin_count[p] + 1; devolver el marco
    elegir un marco víctima v con pin_count = 0 (según la política)
    si v está sucio: escribir v al disco
    leer p en el marco; pin_count[p] ← 1
liberar(p, modificada):
    pin_count[p] ← pin_count[p] − 1;  si modificada: sucio[p] ← verdadero</code></pre>
      <p>Una página fijada (<em>pinned</em>) no puede ser víctima. Las páginas sucias se escriben antes de reemplazarlas, respetando la regla
      WAL de la <a href="tema.html?id=recuperacion">recuperación</a>.</p>

      <h2>Políticas</h2>
      <table>
        <tr><th>Política</th><th>Víctima</th><th>Bueno para</th></tr>
        <tr><td>LRU</td><td>la usada hace más tiempo</td><td>localidad temporal</td></tr>
        <tr><td>Clock</td><td>aproximación de LRU con un bit de referencia y una manecilla</td><td>lo mismo, con costo \(O(1)\)</td></tr>
        <tr><td>MRU</td><td>la usada más recientemente</td><td>recorridos repetidos</td></tr>
        <tr><td>FIFO</td><td>la que llegó primero</td><td>simplicidad</td></tr>
      </table>
      <p>La <strong>inundación secuencial</strong>: si se recorre repetidamente un archivo de \(B + 1\) páginas con \(B\) marcos, LRU saca
      justo la página que se va a necesitar a continuación y falla en el 100 % de los pedidos. Como el motor conoce el plan, puede elegir la
      política por consulta: MRU o un anillo pequeño para recorridos, LRU para las páginas de índices. PostgreSQL usa Clock con un contador
      de uso y anillos de buffer para recorridos grandes.</p>
      <p>Conexiones: los costos de <a href="tema.html?id=block-nested-loop-join">block nested loop join</a> y de
      <a href="tema.html?id=external-merge-sort">external merge sort</a> dependen del número de marcos \(B\).</p>`,
  });
})();
