(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  const ESTRATEGIAS = {
    local: { t: 'Sesión en la memoria de cada servidor', c: C.s8 },
    pegajosa: { t: 'Sesión local con balanceo «pegajoso»', c: C.s4 },
    compartido: { t: 'Sesión en un almacén compartido', c: C.s2 },
    jwt: { t: 'Token firmado (JWT), sin estado', c: C.s1 },
  };

  /* ---------- Fig. 1: varios servidores detrás de un balanceador ---------- */

  function montarEscala(cuerpo) {
    let modo = 'local', semilla = 7, ok = 0, fallos = 0, ultimo = null, cuenta = [0, 0, 0], consultas = 0;
    const SERVIDOR_LOGIN = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', valor: modo, opciones: Object.entries(ESTRATEGIAS).map(([k, e]) => [k, e.t]), alCambiar: (v) => { modo = v; reiniciar(); } });
    ctl.boton('Enviar una petición', () => enviar(1), { primario: true });
    ctl.boton('Enviar 20', () => enviar(20));
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'petición aceptada' }, { color: C.s8, texto: 'rechazada: el servidor no conoce la sesión' }, { color: C.s3, texto: 'consulta al almacén compartido' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El usuario inició sesión en el servidor A. El balanceador reparte las peticiones siguientes entre A, B y C. ¿Quién reconoce al usuario?');
    let rnd = VIZ.semilla(semilla);
    function reiniciar() { rnd = VIZ.semilla(semilla++); ok = 0; fallos = 0; ultimo = null; cuenta = [0, 0, 0]; consultas = 0; dibujar(); }
    function enviar(n) {
      for (let i = 0; i < n; i++) {
        const s = modo === 'pegajosa' ? SERVIDOR_LOGIN : Math.floor(rnd() * 3);
        const acepta = modo === 'local' ? s === SERVIDOR_LOGIN : true;
        if (modo === 'compartido') consultas++;
        cuenta[s]++; if (acepta) ok++; else fallos++; ultimo = { s, acepta };
      }
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const nombres = ['A (login)', 'B', 'C'], w = Math.min(120, (Wd - 60) / 3), gap = (Wd - 3 * w) / 4;
      W.caja(ctx, Wd / 2 - 50, 8, 100, 28, 'balanceador', { borde: C.tinta, tam: 11, peso: 600 });
      nombres.forEach((n, i) => {
        const x = gap + i * (w + gap), y = 100, hit = ultimo && ultimo.s === i, c = hit ? (ultimo.acepta ? C.s6 : C.s8) : C.eje;
        VIZ.dist.flecha(ctx, Wd / 2, 36, x + w / 2, y, { color: hit ? c : C.eje, ancho: hit ? 3 : 1.5 });
        W.caja(ctx, x, y, w, 60, `${n}\n${modo === 'jwt' ? 'sin sesiones' : modo === 'compartido' ? 'sin sesiones locales' : i === 0 ? 'sesión de Ana ✔' : 'no conoce a Ana'}\n${cuenta[i]} peticiones`, { borde: c, relleno: hit ? VIZ.alfa(c, 0.2) : C.superficie, tam: 10, peso: 500, grosor: hit ? 3 : 1.5 });
        if (modo === 'compartido') VIZ.dist.flecha(ctx, x + w / 2, y + 60, Wd / 2, 196, { color: C.s3, ancho: 1.2, guiones: [3, 3] });
      });
      if (modo === 'compartido') W.caja(ctx, Wd / 2 - 60, 196, 120, 28, 'almacén de sesiones', { borde: C.s3, relleno: VIZ.alfa(C.s3, 0.2), tam: 10, peso: 600 });
      registro.textContent = !ultimo ? 'Envíe peticiones y observe qué servidor las recibe.' : ultimo.acepta ? 'El servidor pudo identificar al usuario' + (modo === 'jwt' ? ' verificando la firma del token: no necesitó ningún estado.' : modo === 'compartido' ? ' consultando el almacén común.' : '.') : 'Este servidor no tiene la sesión en su memoria: el usuario parece «desconectado» y debe iniciar sesión de nuevo.';
      lectura.set([['aceptadas', String(ok)], ['rechazadas', String(fallos)], ['consultas al almacén', modo === 'compartido' ? String(consultas) : '0'], ['servidores que atendieron', cuenta.map((x) => x).join(' / ')]]);
    }
    lienzo.alDibujar = dibujar;
    reiniciar();
  }

  /* ---------- Fig. 2: elegir según lo que importa ---------- */

  const CRITERIOS = [
    { k: 'revocar', t: 'revocar al instante', peso: 3, p: { sesion: 5, jwt: 1 } },
    { k: 'escala', t: 'escalar sin estado compartido', peso: 3, p: { sesion: 2, jwt: 5 } },
    { k: 'simple', t: 'simplicidad de implementación', peso: 2, p: { sesion: 4, jwt: 3 } },
    { k: 'peso', t: 'peso de cada petición', peso: 2, p: { sesion: 5, jwt: 2 } },
    { k: 'multi', t: 'varios servicios o dominios', peso: 2, p: { sesion: 2, jwt: 5 } },
  ];

  function montarDecision(cuerpo) {
    let barras = [];
    const ctl = VIZ.controles(cuerpo);
    CRITERIOS.forEach((c) => ctl.rango({ etiqueta: `Importancia: ${c.t}`, min: 0, max: 5, valor: c.peso, alCambiar: (v) => { c.peso = v; dibujar(); } }));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 130 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'sesión en el servidor' }, { color: C.s1, texto: 'token firmado (JWT)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'No hay una opción «mejor»: depende de qué se valora. Cambie las importancias y vea cómo se inclina la balanza. Puntajes del 1 al 5 (a mayor, mejor).');
    function total(k) { return CRITERIOS.reduce((s, c) => s + c.peso * c.p[k], 0); }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const t = [total('sesion'), total('jwt')], max = CRITERIOS.reduce((s, c) => s + c.peso * 5, 0) || 1, izq = 120;
      barras = [['Sesión', t[0], C.s2, 'sesion'], ['JWT', t[1], C.s1, 'jwt']].map(([n, v, c, k], i) => {
        const y = 14 + i * 50, w = ((Wd - izq - 70) * v) / max;
        W.texto(ctx, n, izq - 10, y + 16, { tam: 12, peso: 600, alinear: 'right' });
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(izq, y, Math.max(2, w), 32, [0, 4, 4, 0]); ctx.fill();
        W.texto(ctx, `${v}`, izq + w + 8, y + 16, { tam: 12, peso: 600, alinear: 'left' });
        return { y, k, n };
      });
      const gana = t[0] === t[1] ? 'empate' : t[0] > t[1] ? 'sesión en el servidor' : 'token firmado (JWT)';
      registro.textContent = t[0] === t[1] ? 'Con estas importancias las dos opciones quedan empatadas.' : `Con estas importancias conviene más: ${gana}.`;
      lectura.set([['puntaje sesión', String(t[0])], ['puntaje JWT', String(t[1])], ['máximo posible', String(max)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = barras.find((q) => y >= q.y && y <= q.y + 32); if (!b) return tip.ocultar(); tip.mostrar(x, y, `<b>${b.n}</b>` + CRITERIOS.map((c) => `<div class="fila">${c.t}: ${c.p[b.k]} × ${c.peso}</div>`).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('session-vs-token', {
    intro: String.raw`
      <p>Hay dos grandes maneras de recordar quién es un usuario entre peticiones. En la <strong>sesión</strong> el estado vive en el <em>servidor</em> y el cliente guarda solo un identificador.
      En el <strong>token</strong> (por ejemplo un JWT) el estado viaja <em>con el cliente</em>, firmado para que no pueda alterarse.</p>
      <p>Cada modelo resuelve bien un problema y empeora otro: revocar un acceso, repartir la carga entre muchos servidores, el tamaño de las peticiones o la exposición a ciertos ataques.</p>`,
    parametros: [
      ['Estrategia (Fig. 1)', String.raw`Selector con cuatro opciones: «Sesión en la memoria de cada servidor», «Sesión local con balanceo pegajoso», «Sesión en un almacén compartido» y «Token firmado (JWT), sin estado». Cambia dónde está la información de la sesión y a qué servidor llega cada petición; al cambiarlo, los contadores se reinician.`],
      ['Enviar una petición (Fig. 1)', String.raw`Envía una petición a través del balanceador y la dibuja sobre el servidor que la recibe.`],
      ['Enviar 20 (Fig. 1)', String.raw`Envía veinte peticiones seguidas; la figura muestra la última y los contadores acumulan todas.`],
      ['Reiniciar (Fig. 1)', String.raw`Pone en cero los contadores y cambia la secuencia aleatoria de servidores.`],
      ['Importancia (cinco controles) (Fig. 2)', String.raw`Hay un deslizador de 0 a 5 por criterio: «revocar al instante», «escalar sin estado compartido», «simplicidad de implementación», «peso de cada petición» y «varios servicios o dominios». Indica cuánto pesa cada criterio en el puntaje.`],
    ],
    visualizaciones: [
      { titulo: 'Varios servidores y una sesión', descripcion: 'Envíe peticiones a través de un balanceador con cada estrategia: vea cuándo un servidor «no reconoce» al usuario y cuántas consultas extra implica cada solución.',
        ayuda: String.raw`<p>Un balanceador arriba y debajo tres servidores: A (donde el usuario inició sesión), B y C, cada uno con su contador de peticiones. El servidor que recibió la última petición se resalta en verde si la aceptó y en rojo si la rechazó porque no conoce la sesión. Con almacén compartido, flechas punteadas aguamarina unen cada servidor con el «almacén de sesiones».</p>
          <ul>
          <li><strong>Sesión en la memoria de cada servidor</strong>: el balanceador elige al azar entre A, B y C, y solo A acepta; B y C rechazan.</li>
          <li><strong>Balanceo pegajoso</strong>: todas las peticiones van a A, que las acepta; la sesión sigue ligada a ese servidor.</li>
          <li><strong>Almacén compartido</strong>: reparto al azar; todos aceptan, pero cada petición suma una consulta al almacén.</li>
          <li><strong>Token firmado (JWT)</strong>: reparto al azar; todos aceptan sin guardar sesiones, verificando la firma.</li>
          <li><strong>Lecturas</strong>: aceptadas, rechazadas, consultas al almacén y peticiones atendidas por A / B / C.</li>
          </ul>`, montar: montarEscala },
      { titulo: 'Qué conviene según sus prioridades', descripcion: 'Ajuste la importancia de cada criterio y compare el puntaje de ambas opciones; pase el cursor sobre una barra para ver el desglose.',
        ayuda: String.raw`<p>Dos barras horizontales, «Sesión» (naranja, sesión en el servidor) y «JWT» (azul, token firmado). La longitud de cada una es su puntaje, la suma de importancia por puntaje de cada criterio (de 1 a 5), y el número se escribe al final. Pasar el cursor sobre una barra desglosa los productos criterio por criterio.</p>
          <ul>
          <li><strong>Importancia</strong>: «revocar al instante», «simplicidad» y «peso de cada petición» favorecen a la sesión; «escalar sin estado compartido» y «varios servicios o dominios» favorecen al token.</li>
          <li><strong>Lecturas</strong>: puntaje de cada opción y máximo posible; el texto bajo la figura dice cuál conviene o si hay empate.</li>
          </ul>`, montar: montarDecision },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>Sesión en servidor</th><th>Token firmado</th></tr>
        <tr><td>Dónde está el estado</td><td>servidor (memoria, Redis, base de datos)</td><td>dentro del token, en el cliente</td></tr>
        <tr><td>Cada petición</td><td>una búsqueda por id: \(O(1)\) consulta</td><td>verificar una firma: cálculo local</td></tr>
        <tr><td>Revocación</td><td>inmediata: borrar la sesión</td><td>difícil hasta que expire</td></tr>
        <tr><td>Escalado horizontal</td><td>exige almacén común o balanceo pegajoso</td><td>cualquier servidor con el secreto</td></tr>
        <tr><td>Tamaño</td><td>pequeño (solo un id)</td><td>mayor (claims + firma)</td></tr>
        <tr><td>Vector típico</td><td>CSRF (cookie automática)</td><td>XSS (si está en <code>localStorage</code>)</td></tr>
      </table>
      <h2>Escalado</h2>
      <p>Con \(k\) servidores y balanceo aleatorio, una sesión guardada solo en uno de ellos es reconocida con probabilidad \(1/k\) en cada petición. Las soluciones son <em>balanceo pegajoso</em> (siempre al mismo servidor, pero se pierde la sesión si cae), <em>almacén compartido</em> (una consulta extra de ~1 ms por petición) o un <em>token</em> que cualquier servidor puede validar con la misma clave.</p>
      <h2>Cómo elegir</h2>
      <ul>
        <li>Una aplicación web tradicional con un solo dominio y necesidad de cerrar sesión «ya»: <strong>sesión + cookie</strong> <code>HttpOnly</code>.</li>
        <li>Varios servicios o clientes (móvil, otras aplicaciones) y escala masiva: <strong>tokens</strong> de vida corta más refresco revocable.</li>
        <li>Los enfoques se combinan: muchos sistemas usan un JWT dentro de una cookie <code>HttpOnly</code>.</li>
      </ul>
      <div class="recuadro">Ambas técnicas dependen de proteger el canal (<a href="tema.html?id=tls-handshake">HTTPS</a>) y de guardar el secreto con cuidado. Detalles en <a href="tema.html?id=cookies-sessions">cookies y sesiones</a> y <a href="tema.html?id=jwt-tokens">JSON Web Tokens</a>.</div>`,
  });
})();
