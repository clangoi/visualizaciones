(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: el modelo de cebolla ---------- */

  function montarCebolla(cuerpo) {
    const est = { token: true, falla: false, errores: true };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Cliente' }, { nombre: 'errores' }, { nombre: 'logger' }, { nombre: 'auth' }, { nombre: 'handler' }],
      mensajes: () => {
        const m = [{ de: 0, a: est.errores ? 1 : 2, texto: 'petición', color: C.s1, nota: 'La petición entra por el primer middleware.' }];
        let cur = est.errores ? 1 : 2;
        const bajar = (a, t, nota) => { m.push({ de: cur, a, texto: t, color: C.s2, nota }); cur = a; };
        if (est.errores) bajar(2, 'await next()', 'errores llama a next(): pasa el control al siguiente middleware (y espera).');
        else cur = 2;
        m.push({ de: 2, a: 2, texto: 't0 = Date.now()', color: C.s2, nota: 'logger anota la hora de inicio antes de llamar a next().' });
        bajar(3, 'await next()', 'logger entrega el control a auth.');
        if (!est.token) {
          m.push({ de: 3, a: 2, texto: '401 (sin next)', color: C.s8, nota: 'auth NO llama a next(): corta el pipeline y responde 401. El handler nunca se ejecuta.' });
          cur = 2;
        } else {
          bajar(4, 'await next()', 'auth verifica el token y llama a next(): el flujo llega al handler.');
          if (est.falla) {
            m.push({ de: 4, a: 3, texto: 'throw Error', color: C.s8, guiones: [4, 3], nota: 'El handler lanza una excepción: sube por la cadena de promesas, igual que subiría una respuesta.' });
            m.push({ de: 3, a: 2, texto: 'excepción', color: C.s8, guiones: [4, 3], nota: 'auth no la captura; sigue subiendo.' });
            cur = 2;
          } else {
            m.push({ de: 4, a: 3, texto: 'ctx.body = datos', color: C.s6, nota: 'El handler construye la respuesta y retorna: el control vuelve hacia afuera.' });
            m.push({ de: 3, a: 2, texto: 'retorna', color: C.s6, nota: 'auth no tiene nada que hacer al volver.' });
            cur = 2;
          }
        }
        m.push({ de: 2, a: 2, texto: 'log: Δt = 42 ms', color: C.s2, nota: 'Al volver, logger calcula el tiempo total: por eso puede medir lo que ocurrió «dentro».' });
        if (est.errores) {
          if (est.falla && est.token) { m.push({ de: 2, a: 1, texto: 'excepción', color: C.s8, guiones: [4, 3], nota: 'La excepción llega a errores, que sí tiene try/catch.' }); m.push({ de: 1, a: 1, texto: 'ctx.status = 500', color: C.s8, nota: 'errores convierte la excepción en una respuesta 500 ordenada.' }); } else m.push({ de: 2, a: 1, texto: 'retorna', color: C.s6, nota: 'La respuesta vuelve al primer middleware.' });
          m.push({ de: 1, a: 0, texto: est.falla && est.token ? '500' : est.token ? '200' : '401', color: est.falla && est.token ? C.s8 : est.token ? C.s6 : C.s8, nota: 'La respuesta sale hacia el cliente.' });
        } else m.push({ de: 2, a: 0, texto: est.falla && est.token ? 'conexión caída' : est.token ? '200' : '401', color: est.falla && est.token ? C.s8 : est.token ? C.s6 : C.s8, nota: est.falla && est.token ? 'Sin middleware de errores, la excepción no se captura: la petición falla sin una respuesta ordenada.' : 'La respuesta sale hacia el cliente.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.casillas([{ clave: 'token', texto: 'la petición trae un token válido', activo: true }, { clave: 'falla', texto: 'el handler lanza un error', activo: false }, { clave: 'errores', texto: 'hay un middleware de errores', activo: true }], (e) => { Object.assign(est, e); reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'petición' }, { color: C.s2, texto: 'next() / trabajo del middleware' }, { color: C.s6, texto: 'respuesta' }, { color: C.s8, texto: 'rechazo o error' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['llegó al handler', est.token ? 'sí' : 'no (auth cortó)'], ['resultado', est.token ? (est.falla ? (est.errores ? '500' : 'sin respuesta') : '200') : '401']],
      nota: 'Cada <code>await next()</code> baja a la capa siguiente; al volver, el código escrito <em>después</em> de <code>next()</code> se ejecuta en orden inverso. Es la «cebolla» de Koa.',
    });
  }

  /* ---------- Fig. 2: tiempos anidados ---------- */

  function montarTiempos(cuerpo) {
    const est = { logger: 2, auth: 8, parser: 5, handler: 30 };
    const CAPAS = [{ k: 'logger', c: C.s1 }, { k: 'auth', c: C.s3 }, { k: 'parser', c: C.s7 }, { k: 'handler', c: C.s2 }];
    let barras = [];
    const ctl = VIZ.controles(cuerpo);
    CAPAS.forEach(({ k }) => ctl.rango({ etiqueta: `Trabajo propio de ${k}`, min: 0, max: 60, valor: est[k], formato: (v) => `${v} ms`, alCambiar: (v) => { est[k] = v; dibujar(); } }));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CAPAS.map((c) => ({ color: c.c, texto: c.k })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La barra de cada middleware abarca todo lo que ocurre «dentro» de su <code>await next()</code>; el tiempo que mide el logger incluye a todos los demás.');
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const total = CAPAS.reduce((s, c) => s + est[c.k], 0) || 1, esc = (ms) => 8 + (ms / total) * (Wd - 16);
      barras = [];
      let ini = 0;
      CAPAS.forEach((c, i) => {
        const dentro = CAPAS.slice(i).reduce((s, q) => s + est[q.k], 0), y = 10 + i * 40;
        const mitad = est[c.k] / 2; // el trabajo propio se reparte antes y después de next()
        ctx.fillStyle = VIZ.alfa(c.c, 0.2); ctx.fillRect(esc(ini), y, esc(ini + dentro) - esc(ini), 30);
        ctx.fillStyle = c.c; ctx.fillRect(esc(ini), y, Math.max(0, esc(ini + mitad) - esc(ini)), 30); ctx.fillRect(esc(ini + dentro - mitad), y, Math.max(0, esc(ini + dentro) - esc(ini + dentro + 0 - mitad)), 30);
        W.texto(ctx, `${c.k}: ${Math.round(dentro)} ms en total`, esc(ini) + 6, y + 15, { tam: 11, peso: 600, alinear: 'left', color: C.tinta });
        barras.push({ c, dentro, y, x: esc(ini), w: esc(ini + dentro) - esc(ini) });
        ini += mitad;
      });
      registro.textContent = `El logger mide ${total} ms, pero solo ${est.logger} ms son suyos: el resto lo consumen los middlewares que envuelve.`;
      lectura.set([['tiempo medido por el logger', `${total} ms`], ['trabajo propio del logger', `${est.logger} ms`], ['parte debida al handler', `${Math.round((est.handler / total) * 100)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = barras.find((q) => y >= q.y && y <= q.y + 30 && x >= q.x && x <= q.x + q.w); if (!b) return tip.ocultar(); tip.mostrar(x, y, `<b>${b.c.k}</b><br>${Math.round(b.dentro)} ms incluyendo a los internos<br>${est[b.c.k]} ms propios`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('middleware-pipeline', {
    intro: String.raw`
      <p>Antes de que una petición llegue al código que responde, suele pasar por una cadena de pasos reutilizables: registrar la petición, comprobar la sesión, interpretar el cuerpo JSON, manejar los errores.
      Cada paso es un <strong>middleware</strong>: una función que recibe el contexto de la petición y una función <code>next</code> para ceder el control al siguiente.</p>
      <p>En <strong>Koa</strong> los middlewares forman una <em>cebolla</em>: la petición «baja» capa por capa hasta el handler y la respuesta «sube» por las mismas capas en orden inverso, de modo que cada middleware tiene código antes y después de <code>await next()</code>.</p>`,
    visualizaciones: [
      { titulo: 'La cebolla de middlewares', descripcion: 'Active y desactive el token, el error del handler y el middleware de errores: observe quién corta el flujo y por dónde sube la excepción.', montar: montarCebolla },
      { titulo: 'Tiempos anidados', descripcion: 'Cambie el trabajo propio de cada middleware y mire por qué el tiempo del logger incluye a todos los demás.', montar: montarTiempos },
    ],
    teoria: String.raw`
      <h2>Un middleware de Koa</h2>
      <pre><code>app.use(async (ctx, next) =&gt; {
    const t0 = Date.now();       // antes: va hacia adentro
    await next();                // cede el control a los siguientes
    const ms = Date.now() - t0;  // después: vuelve hacia afuera
    console.log(ctx.method, ctx.url, ms + " ms");
});</code></pre>
      <p>Si un middleware <em>no</em> llama a <code>next()</code>, la cadena se corta (útil para rechazar con 401). Si lo llama, debe usar <code>await</code>, de lo contrario el código posterior se ejecutaría antes de tiempo.</p>
      <h2>Composición</h2>
      <p>Con middlewares \(m_1, \dots, m_k\) y \(h\) el handler, el pipeline es la composición</p>
      \[ m_1 \circ m_2 \circ \dots \circ m_k \circ h, \]
      <p>en la que cada \(m_i\) envuelve a los siguientes. El orden importa: un logger colocado <em>después</em> de la autenticación no verá las peticiones rechazadas por ella, y un manejador de errores debe estar lo más afuera posible para capturar excepciones de todas las capas.</p>
      <h2>El contexto</h2>
      <p>El objeto <code>ctx</code> resume la petición y la respuesta (<code>ctx.method</code>, <code>ctx.query</code>, <code>ctx.request.body</code>, <code>ctx.status</code>, <code>ctx.body</code>) y sirve para pasar datos entre middlewares (<code>ctx.state.usuario</code>).</p>
      <div class="recuadro">Este patrón no es exclusivo de Koa: Express usa <code>(req, res, next)</code> en una cadena lineal. Al final de la cadena están el <a href="tema.html?id=routing-params">enrutador</a> y los controladores de la <a href="tema.html?id=mvc-architecture">arquitectura MVC</a>.</div>`,
  });
})();
