(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: costo acumulado de navegar ---------- */

  function montarCosto(cuerpo) {
    const est = { bundle: 600, pagina: 80, datos: 15, rtt: 80, bw: 20 };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Código JavaScript de la SPA', min: 100, max: 2000, paso: 50, valor: est.bundle, formato: (v) => `${v} KB`, alCambiar: (v) => { est.bundle = v; dibujar(); } });
    ctl.rango({ etiqueta: 'HTML completo de cada página', min: 20, max: 300, paso: 10, valor: est.pagina, formato: (v) => `${v} KB`, alCambiar: (v) => { est.pagina = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Datos JSON de cada vista', min: 2, max: 100, valor: est.datos, formato: (v) => `${v} KB`, alCambiar: (v) => { est.datos = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Latencia', min: 10, max: 300, valor: est.rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { est.rtt = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s2, t: 'sitio multipágina (MPA)' }, { c: C.s1, t: 'aplicación de una página (SPA)' }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La SPA paga una carga inicial grande y luego solo pide datos; el sitio multipágina recibe un documento entero en cada clic. ¿Dónde se cruzan?');
    const t = (kb) => (kb * 8) / est.bw; // ms
    const mpa = (n) => n * (est.rtt + t(est.pagina));
    const spa = (n) => est.rtt + t(est.pagina) + est.rtt + t(est.bundle) + Math.max(0, n - 1) * (est.rtt + t(est.datos)) + 0;
    function cruce() { for (let n = 1; n <= 60; n++) if (spa(n) <= mpa(n)) return n; return null; }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(mpa(20), spa(20)) * 1.05;
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 20, ymin: 0, ymax }, { etiquetaX: 'páginas visitadas', etiquetaY: 'tiempo acumulado de espera (s)', formatoY: (v) => VIZ.fmt(v / 1000, 3) });
      plano.ejes();
      VIZ.trazar(ctx, plano, Array.from({ length: 20 }, (_, i) => [i + 1, mpa(i + 1)]), C.s2, 2);
      VIZ.trazar(ctx, plano, Array.from({ length: 20 }, (_, i) => [i + 1, spa(i + 1)]), C.s1, 2);
      const x = cruce();
      if (x && x <= 20) { VIZ.marcador(ctx, plano.sx(x), plano.sy(spa(x)), C.tinta, 5); VIZ.web.texto(ctx, `la SPA gana desde la página ${x}`, plano.sx(x) + 8, plano.sy(spa(x)) - 14, { tam: 11, peso: 600, alinear: 'left' }); }
      lectura.set([['primera página', `MPA ${Math.round(mpa(1))} ms · SPA ${Math.round(spa(1))} ms`], ['cada página siguiente', `MPA ${Math.round(est.rtt + t(est.pagina))} ms · SPA ${Math.round(est.rtt + t(est.datos))} ms`], ['punto de cruce', x ? `página ${x}` : 'más de 60']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const n = Math.max(1, Math.round(plano.ix(x)));
      tip.mostrar(x, y, `páginas = <b>${n}</b>` + SER.map((s, i) => VIZ.filaTooltip(s.c, i ? 'SPA' : 'MPA', `${VIZ.fmt((i ? spa(n) : mpa(n)) / 1000, 3)} s`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: enrutamiento en el cliente ---------- */

  const RUTAS = { '/': { vista: 'Inicio', api: null }, '/productos': { vista: 'Lista de productos', api: 'GET /api/productos' }, '/productos/7': { vista: 'Detalle del producto 7', api: 'GET /api/productos/7' }, '/carrito': { vista: 'Carrito', api: 'GET /api/carrito' } };

  function montarRouter(cuerpo) {
    let spa = true, pila = ['/'], pos = 0, red = [{ t: 'GET /index.html + bundle.js', k: 'doc' }], recargas = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de aplicación', valor: 'spa', opciones: [['spa', 'SPA (enrutador en el cliente)'], ['mpa', 'multipágina (el servidor responde HTML)']], alCambiar: (v) => { spa = v === 'spa'; reiniciar(); } });
    for (const r of Object.keys(RUTAS)) ctl.boton(r, () => ir(r));
    ctl.boton('← Atrás', () => { if (pos > 0) { pos--; cargar(pila[pos], true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 220 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'documento HTML completo (la página se recarga)' }, { color: C.s1, texto: 'solo datos JSON (la página sigue viva)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse las rutas como si fueran enlaces. En la SPA el cambio de vista no recarga el documento: el enrutador cambia la URL con <code>history.pushState</code> y React pinta otra vista.');
    function reiniciar() { pila = ['/']; pos = 0; recargas = 1; red = [{ t: spa ? 'GET /index.html + bundle.js' : 'GET / (HTML completo)', k: spa ? 'doc' : 'doc' }]; dibujar(); }
    function ir(ruta) { pila = pila.slice(0, pos + 1); pila.push(ruta); pos++; cargar(ruta, false); }
    function cargar(ruta, atras) {
      const r = RUTAS[ruta];
      if (spa) { if (r.api) red.push({ t: r.api, k: 'json' }); } else { recargas++; red.push({ t: `GET ${ruta} (HTML completo)`, k: 'doc' }); }
      if (atras && spa) red.push({ t: `popstate → vista «${r.vista}» (sin red)`, k: 'json' });
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const ruta = pila[pos], r = RUTAS[ruta];
      W.caja(ctx, 6, 6, Wd - 12, 26, `https://tienda.ejemplo.com${ruta === '/' ? '' : ruta}`, { borde: C.tinta, tam: 11, peso: 600 });
      W.caja(ctx, 6, 40, Wd * 0.45, 100, `${r.vista}\n${spa ? '(componente <' + r.vista.split(' ')[0] + ' />)' : '(documento nuevo)'}`, { borde: C.s6, relleno: VIZ.alfa(C.s6, 0.15), tam: 11 });
      red.slice(-5).forEach((q, i) => W.caja(ctx, Wd * 0.45 + 18, 44 + i * 26, Wd * 0.55 - 24, 22, q.t, { borde: q.k === 'doc' ? C.s2 : C.s1, relleno: VIZ.alfa(q.k === 'doc' ? C.s2 : C.s1, 0.18), tam: 10 }));
      W.texto(ctx, `historial: ${pila.map((p, i) => (i === pos ? `[${p}]` : p)).join(' → ')}`.slice(0, Math.floor(Wd / 6.6)), 6, 160, { tam: 10, alinear: 'left', color: C.tinta2 });
      registro.textContent = spa ? 'La SPA ya tiene el código: solo pide los datos de la nueva vista y conserva el estado de la página.' : 'Cada enlace pide al servidor un documento completo y el navegador descarta la página anterior.';
      lectura.set([['recargas de documento', String(recargas)], ['peticiones de red', String(red.length)], ['modelo', spa ? 'SPA' : 'multipágina']]);
    }
    lienzo.alDibujar = dibujar;
    reiniciar();
  }

  VIZ.registrarTema('spa-architecture', {
    intro: String.raw`
      <p>En un sitio tradicional, cada clic pide al servidor un documento HTML completo y el navegador reemplaza la página. Una <strong>Single Page Application</strong> carga <em>una vez</em> el HTML
      y un paquete de JavaScript; después, cambia lo que se ve en pantalla sin recargar, pidiendo al servidor solo datos (normalmente JSON).</p>
      <p>Esto permite interfaces fluidas y con estado persistente, pero tiene un costo: una primera carga más pesada y la necesidad de gestionar en el cliente la navegación, el historial y el estado.</p>`,
    visualizaciones: [
      { titulo: 'Costo acumulado de navegar', descripcion: 'Aumente el tamaño del JavaScript o la latencia y encuentre cuántas páginas hay que visitar para que la SPA compense su carga inicial.', montar: montarCosto },
      { titulo: 'Enrutamiento en el cliente', descripcion: 'Navegue por las rutas y alterne entre SPA y multipágina: compare las peticiones y las recargas del documento.', montar: montarRouter },
    ],
    teoria: String.raw`
      <h2>Modelo de costo</h2>
      <p>Sea \(T_p\) el tiempo de descargar una página HTML completa, \(T_j\) el de la SPA (solo datos), \(T_b\) el del paquete de JavaScript y \(r\) la latencia. Tras \(n\) navegaciones:</p>
      \[ \text{MPA}(n) = n\,(r + T_p), \qquad \text{SPA}(n) = (r + T_p) + (r + T_b) + (n-1)(r + T_j). \]
      <p>La SPA es más rápida cuando \(n > 1 + \dfrac{r + T_b}{T_p - T_j}\): a mayor paquete, más navegaciones se necesitan para compensar.</p>
      <h2>Piezas de una SPA</h2>
      <ul>
        <li><strong>Enrutador del cliente</strong>: asocia URL ↔ vista usando la API <code>history</code>; el botón «Atrás» dispara <code>popstate</code>.</li>
        <li><strong>Estado de la aplicación</strong> en memoria (componentes, contexto, almacenes).</li>
        <li><strong>API de datos</strong> (<a href="tema.html?id=rest-api-crud">REST</a> o similar) que entrega JSON.</li>
      </ul>
      <h2>Compromisos</h2>
      <table>
        <tr><th>Ventaja</th><th>Costo</th></tr>
        <tr><td>navegación instantánea, transiciones, estado persistente</td><td>carga inicial pesada; pantalla en blanco hasta ejecutar el JS</td></tr>
        <tr><td>el servidor solo expone datos</td><td>posicionamiento en buscadores y accesibilidad requieren cuidado</td></tr>
      </table>
      <div class="recuadro">Para atenuar la carga inicial se usan <em>code splitting</em> (cargar el código de cada ruta cuando se visita) y <em>renderizado en el servidor</em> (enviar el primer HTML ya armado y luego «hidratarlo»). Los componentes que se intercambian al navegar son los de <a href="tema.html?id=component-tree-props">React</a>.</div>`,
  });
})();
