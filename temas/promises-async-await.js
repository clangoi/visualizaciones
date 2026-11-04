(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: cadena de promesas ---------- */

  const COL = { pendiente: C.inactivo, cumplida: C.s6, rechazada: C.s8, omitida: C.eje };

  function montarCadena(cuerpo) {
    const est = { r: ['ok', 'ok', 'ok'], catch: true, finally: true };
    let nodos = [], paso = -1, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ['Paso 1: leer usuario', 'Paso 2: leer pedidos', 'Paso 3: calcular total'].forEach((t, i) => ctl.selector({ etiqueta: t, valor: 'ok', opciones: [['ok', 'se cumple'], ['falla', 'se rechaza (error)']], alCambiar: (v) => { est.r[i] = v; rep.reiniciar(); } }));
    ctl.casillas([{ clave: 'catch', texto: 'agregar .catch()', activo: true }, { clave: 'finally', texto: 'agregar .finally()', activo: true }], (e) => { est.catch = e.catch; est.finally = e.finally; rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 300 : 170) });
    VIZ.leyenda(cuerpo, Object.entries({ pendiente: 'pendiente', cumplida: 'cumplida (fulfilled)', rechazada: 'rechazada (rejected)', omitida: 'omitida' }).map(([k, t]) => ({ color: COL[k], texto: t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada <code>.then</code> devuelve una promesa nueva. Un rechazo «salta» los <code>.then</code> siguientes hasta encontrar un <code>.catch</code>; <code>.finally</code> corre siempre.');

    function etapas() {
      const e = [{ n: 'fetchUsuario()', tipo: 'inicio' }, { n: '.then(pedidos)', tipo: 'then' }, { n: '.then(total)', tipo: 'then' }];
      if (est.catch) e.push({ n: '.catch(error)', tipo: 'catch' });
      if (est.finally) e.push({ n: '.finally(limpiar)', tipo: 'finally' });
      return e;
    }
    function iniciar() {
      nodos = etapas().map((e) => ({ ...e, estado: 'pendiente' })); paso = -1; mensaje = 'La cadena empieza con una promesa pendiente.';
      return (function* () {
        let rechazo = false, err = '';
        for (let i = 0; i < nodos.length; i++) {
          const n = nodos[i]; paso = i;
          if (n.tipo === 'inicio' || n.tipo === 'then') {
            const idx = n.tipo === 'inicio' ? 0 : i;
            if (rechazo) { n.estado = 'omitida'; mensaje = `${n.n}: la promesa anterior fue rechazada; este .then se omite y el rechazo se propaga.`; } else if (est.r[idx] === 'falla') { n.estado = 'rechazada'; rechazo = true; err = `error en el paso ${idx + 1}`; mensaje = `${n.n} lanza un error: la promesa queda rechazada.`; } else { n.estado = 'cumplida'; mensaje = `${n.n} termina bien: la promesa se cumple y pasa su valor al siguiente paso.`; }
          } else if (n.tipo === 'catch') {
            if (rechazo) { n.estado = 'cumplida'; rechazo = false; mensaje = `.catch captura «${err}» y lo maneja: la cadena vuelve a estado cumplido.`; } else { n.estado = 'omitida'; mensaje = '.catch no hace nada: no hubo error.'; }
          } else { n.estado = rechazo ? 'rechazada' : 'cumplida'; mensaje = `.finally se ejecuta siempre (haya error o no) y ${rechazo ? 'deja pasar el rechazo sin captura' : 'deja pasar el valor'}.`; }
          yield;
        }
        paso = nodos.length; const huerfano = nodos[nodos.length - 1].estado === 'rechazada'; mensaje = huerfano ? 'Fin: el rechazo nadie lo capturó → «unhandled promise rejection».' : 'Fin: la cadena terminó sin errores sin capturar.'; yield;
      })();
    }
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = Wd < 600, n = nodos.length, w = vertical ? Wd - 24 : (Wd - 12 - (n - 1) * 24) / n, h = vertical ? Math.min(42, (H - 12) / n - 12) : 56;
      nodos.forEach((q, i) => {
        const x = vertical ? 12 : 6 + i * (w + 24), y = vertical ? 6 + i * (h + 14) : 40;
        const c = COL[q.estado];
        W.caja(ctx, x, y, w, h, `${q.n}\n${q.estado}`, { borde: c, relleno: q.estado === 'pendiente' ? C.superficie : VIZ.alfa(c, 0.2), tam: vertical ? 10 : 11, peso: 600, guiones: q.estado === 'omitida' ? [4, 3] : null, grosor: i === paso ? 3 : 1.5 });
        if (i < n - 1) VIZ.dist.flecha(ctx, vertical ? x + w / 2 : x + w, vertical ? y + h : y + h / 2, vertical ? x + w / 2 : x + w + 22, vertical ? y + h + 12 : y + h / 2, { color: C.tinta2 });
      });
      registro.textContent = mensaje;
      lectura.set([['cumplidas', String(nodos.filter((q) => q.estado === 'cumplida').length)], ['rechazadas', String(nodos.filter((q) => q.estado === 'rechazada').length)], ['omitidas', String(nodos.filter((q) => q.estado === 'omitida').length)]]);
    }
    lienzo.alDibujar = () => nodos.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: secuencial, Promise.all, race y allSettled ---------- */

  function montarCombinadores(cuerpo) {
    const est = { d: [300, 500, 200], falla: false, modo: 'secuencial' };
    const ctl = VIZ.controles(cuerpo);
    est.d.forEach((_, i) => ctl.rango({ etiqueta: `Petición ${i + 1}`, min: 50, max: 1000, paso: 50, valor: est.d[i], formato: (v) => `${v} ms`, alCambiar: (v) => { est.d[i] = v; dibujar(); } }));
    ctl.selector({ etiqueta: 'Estrategia', valor: est.modo, opciones: [['secuencial', 'await una tras otra'], ['all', 'Promise.all'], ['allSettled', 'Promise.allSettled'], ['race', 'Promise.race']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'la petición 2 falla', valor: false, alCambiar: (v) => { est.falla = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 170 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'petición en curso' }, { color: C.s8, texto: 'petición fallida' }, { color: C.s6, texto: 'instante en que se obtiene el resultado' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Peticiones independientes no deben esperarse una tras otra: lanzarlas juntas cuesta el máximo, no la suma. Pruebe a hacer fallar la 2 con cada estrategia.');
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const d = est.d, falla = (i) => est.falla && i === 1;
      let ini, fin, listo, nota;
      if (est.modo === 'secuencial') { let t = 0; ini = d.map((x) => { const s = t; t += x; return s; }); const dur = d.map((x, i) => x); fin = ini.map((s, i) => s + dur[i]); const caida = falla(1) ? fin[1] : null; listo = caida ?? fin[2]; if (caida !== null) { ini[2] = fin[2] = null; } nota = caida !== null ? 'await lanza el error en la petición 2: la 3 nunca se inicia.' : 'La espera se acumula: tiempo = suma de las duraciones.'; } else {
        ini = d.map(() => 0); fin = d.map((x) => x);
        if (est.modo === 'all') { const caida = est.falla ? d[1] : null; listo = caida ?? Math.max(...d); nota = caida !== null ? 'Promise.all se rechaza en cuanto una falla; las demás siguen pero sus resultados se ignoran.' : 'Promise.all espera a la más lenta: tiempo = máximo.'; } else if (est.modo === 'allSettled') { listo = Math.max(...d); nota = 'allSettled espera a todas y entrega el estado de cada una, sin lanzar error.'; } else { listo = Math.min(...d.filter((_, i) => !falla(i)).concat(est.falla && d[1] < Math.min(d[0], d[2]) ? [d[1]] : [])); nota = 'race se resuelve con la primera que termina (cumplida o rechazada).'; }
      }
      const total = Math.max(...fin.filter((x) => x !== null), listo, 1) * 1.02, esc = (ms) => 80 + (ms / total) * (Wd - 90);
      d.forEach((x, i) => {
        const y = 16 + i * 36;
        W.texto(ctx, `petición ${i + 1}`, 6, y + 11, { tam: 10, alinear: 'left' });
        if (ini[i] === null) { W.texto(ctx, 'no se inicia', esc(0) + 4, y + 11, { tam: 10, alinear: 'left', color: C.apagado }); return; }
        ctx.fillStyle = falla(i) ? C.s8 : C.s1; ctx.fillRect(esc(ini[i]), y, Math.max(2, esc(fin[i]) - esc(ini[i])), 22);
      });
      ctx.strokeStyle = C.s6; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(esc(listo), 6); ctx.lineTo(esc(listo), 124); ctx.stroke();
      W.texto(ctx, `${Math.round(listo)} ms`, Math.min(esc(listo) + 4, Wd - 50), 138, { tam: 11, peso: 600, color: C.s6, alinear: 'left' });
      registro.textContent = nota;
      lectura.set([['tiempo hasta el resultado', `${Math.round(listo)} ms`], ['suma de duraciones', `${d.reduce((a, b) => a + b, 0)} ms`], ['máximo', `${Math.max(...d)} ms`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const i = Math.floor((y - 16) / 36); if (i < 0 || i > 2) return tip.ocultar(); tip.mostrar(x, y, `petición <b>${i + 1}</b><br>${est.d[i]} ms${est.falla && i === 1 ? ' · falla' : ''}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('promises-async-await', {
    intro: String.raw`
      <p>Una <strong>promesa</strong> representa un valor que todavía no existe: el resultado futuro de una operación asíncrona, como pedir datos a un servidor.
      Nace <em>pendiente</em> y termina <em>cumplida</em> (con un valor) o <em>rechazada</em> (con un error), y ya no cambia.</p>
      <p>Las promesas se encadenan con <code>.then</code>, <code>.catch</code> y <code>.finally</code>, y <code>async/await</code> es una sintaxis que las hace leerse como código secuencial. Se reemplazan así los anidados «callbacks en pirámide».</p>`,
    visualizaciones: [
      { titulo: 'Cadena de promesas y rechazos', descripcion: 'Haga fallar un paso y avance: vea cómo el rechazo salta los <code>.then</code> hasta el <code>.catch</code>. Quite el <code>.catch</code> y observe el rechazo sin capturar.', montar: montarCadena },
      { titulo: 'await secuencial frente a Promise.all', descripcion: 'Compare esperar las peticiones una tras otra con lanzarlas juntas, y vea qué hace cada estrategia ante una falla.', montar: montarCombinadores },
    ],
    teoria: String.raw`
      <h2>Estados</h2>
      <pre><code>pendiente ──resolve(valor)──▶ cumplida (fulfilled)
    └──────reject(error)───▶ rechazada (rejected)</code></pre>
      <p>Una promesa liquidada es inmutable. <code>.then(f)</code> registra un callback que se ejecuta como <a href="tema.html?id=event-loop">microtarea</a> y devuelve otra promesa, lo que permite encadenar.</p>
      <h2>async / await</h2>
      <pre><code>async function cargar() {
    try {
        const u = await fetch("/api/usuario");     // pausa esta función, no el hilo
        const p = await fetch("/api/pedidos/" + u.id);
        return total(p);
    } catch (e) { /* cualquier rechazo llega aquí */ }
}</code></pre>
      <p>Una función <code>async</code> siempre devuelve una promesa; <code>await</code> la espera sin bloquear el bucle de eventos y convierte un rechazo en una excepción que <code>try/catch</code> captura.</p>
      <h2>Combinadores y costo</h2>
      <table>
        <tr><th>Estrategia</th><th>Tiempo con duraciones \(d_i\)</th><th>Si una falla</th></tr>
        <tr><td><code>await</code> en serie</td><td>\(\sum d_i\)</td><td>se detiene; las siguientes no empiezan</td></tr>
        <tr><td><code>Promise.all</code></td><td>\(\max d_i\)</td><td>se rechaza de inmediato</td></tr>
        <tr><td><code>Promise.allSettled</code></td><td>\(\max d_i\)</td><td>informa cada resultado</td></tr>
        <tr><td><code>Promise.race</code></td><td>\(\min d_i\)</td><td>gana la primera liquidada</td></tr>
      </table>
      <div class="recuadro">Error común: usar <code>await</code> dentro de un bucle para peticiones independientes, que las vuelve secuenciales (\(\sum d_i\) en vez de \(\max d_i\)). Y siempre capture los rechazos: uno sin manejar termina el proceso en Node.js.</div>`,
  });
})();
