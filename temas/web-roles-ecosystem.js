(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: quién trabaja en qué capa ---------- */

  const CAPAS = [
    { n: 'Interfaz y estilos', d: 'HTML, CSS, accesibilidad, diseño responsivo' }, { n: 'Lógica del cliente', d: 'JavaScript/TypeScript, React, estado, llamadas a la API' },
    { n: 'Servidor y API', d: 'Node.js, rutas, autenticación, reglas del negocio' }, { n: 'Datos', d: 'bases de datos, ORM, caché, migraciones' },
    { n: 'Infraestructura y entrega', d: 'servidores, contenedores, nube, integración y despliegue continuos, monitoreo' }, { n: 'Calidad y pruebas', d: 'pruebas automáticas, revisión, seguridad' },
  ];
  const ROLES = {
    front: { t: 'Frontend', capas: [0, 1], c: C.s1, que: 'construye lo que el usuario ve y toca' },
    back: { t: 'Backend', capas: [2, 3], c: C.s2, que: 'construye el servidor, la API y la persistencia' },
    full: { t: 'Full Stack', capas: [0, 1, 2, 3], c: C.s7, que: 'cubre cliente y servidor de una funcionalidad' },
    devops: { t: 'DevOps', capas: [3, 4], c: C.s3, que: 'automatiza el despliegue, la nube y el monitoreo' },
    qa: { t: 'QA', capas: [5, 0, 1, 2], c: C.s6, que: 'diseña y automatiza pruebas, vela por la calidad' },
    arq: { t: 'Arquitectura', capas: [0, 1, 2, 3, 4, 5], c: C.s4, que: 'decide la estructura global y sus compromisos' },
  };

  function montarCapas(cuerpo) {
    const sel = new Set(['front', 'back']);
    let cajas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(Object.entries(ROLES).map(([k, r]) => ({ clave: k, texto: r.t, color: r.c, activo: sel.has(k) })), (e) => { sel.clear(); Object.entries(e).forEach(([k, v]) => { if (v) sel.add(k); }); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 6 * 42 + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(ROLES).map((r) => ({ color: r.c, texto: r.t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija los roles de un equipo y vea qué capas quedan cubiertas (marcas de colores) y cuáles sin responsable (borde rojo). Los límites entre roles varían según la organización.');
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      cajas = [];
      const izq = 8, w = Wd - 16;
      CAPAS.forEach((c, i) => {
        const y = 6 + i * 42, resp = [...sel].filter((k) => ROLES[k].capas.includes(i)), libre = resp.length === 0;
        ctx.fillStyle = libre ? VIZ.alfa(C.s8, 0.08) : C.superficie; ctx.strokeStyle = libre ? C.s8 : C.eje; ctx.lineWidth = libre ? 2 : 1.5;
        ctx.beginPath(); ctx.roundRect(izq, y, w, 36, 4); ctx.fill(); ctx.stroke();
        W.texto(ctx, c.n, izq + 10, y + 18, { tam: Wd < 500 ? 10 : 12, peso: 600, alinear: 'left' });
        resp.forEach((k, j) => { ctx.fillStyle = ROLES[k].c; ctx.beginPath(); ctx.arc(izq + w - 14 - j * 18, y + 18, 7, 0, 7); ctx.fill(); });
        if (libre) W.texto(ctx, 'sin responsable', izq + w - 10, y + 18, { tam: 10, color: C.s8, alinear: 'right' });
        cajas.push({ x: izq, y, w, h: 36, c, resp });
      });
      const libres = CAPAS.filter((_, i) => ![...sel].some((k) => ROLES[k].capas.includes(i)));
      registro.textContent = !sel.size ? 'Elija al menos un rol.' : libres.length ? `Capas sin responsable: ${libres.map((c) => c.n).join(', ')}.` : 'Todas las capas tienen al menos un responsable.';
      lectura.set([['roles', String(sel.size)], ['capas cubiertas', `${CAPAS.length - libres.length} de ${CAPAS.length}`], ['capas con más de un rol', String(cajas.filter((c) => c.resp.length > 1).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = cajas.find((q) => y >= q.y && y <= q.y + q.h); if (!c) return tip.ocultar(); tip.mostrar(x, y, `<b>${c.c.n}</b><br>${c.c.d}<br>${c.resp.length ? c.resp.map((k) => ROLES[k].t).join(', ') : 'sin responsable'}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: evolución del ecosistema web ---------- */

  const HITOS = [
    [1991, 'WWW y HTML', 'Tim Berners-Lee publica la primera página web: HTML, URL y HTTP.', 'base'], [1995, 'JavaScript', 'Brendan Eich crea JavaScript en Netscape: páginas con comportamiento.', 'lenguaje'],
    [1996, 'CSS', 'Se publica CSS1: se separa el contenido del estilo.', 'base'], [1999, 'XMLHttpRequest', 'Primer soporte de peticiones asíncronas en el navegador: nace el estilo «AJAX».', 'lenguaje'],
    [2009, 'Node.js', 'JavaScript sale del navegador y llega al servidor sobre el motor V8.', 'plataforma'], [2010, 'npm', 'El gestor de paquetes de Node.js: millones de bibliotecas reutilizables.', 'plataforma'],
    [2011, 'WebSocket', 'RFC 6455: comunicación bidireccional en tiempo real.', 'protocolo'], [2012, 'TypeScript', 'Microsoft presenta un superconjunto de JavaScript con tipos estáticos.', 'lenguaje'],
    [2013, 'React', 'Componentes y DOM virtual: la interfaz como función del estado.', 'plataforma'], [2015, 'ES2015 y HTTP/2', 'Clases, módulos y funciones flecha en JavaScript; HTTP/2 multiplexa peticiones.', 'lenguaje'],
    [2017, 'WebAssembly', 'Soporte de WebAssembly en los principales navegadores: código compilado en la web.', 'lenguaje'], [2018, 'TLS 1.3', 'Un saludo más corto y más seguro: HTTPS en un solo viaje.', 'protocolo'],
    [2022, 'HTTP/3', 'HTTP sobre QUIC (UDP): menos latencia y mejor recuperación ante pérdidas.', 'protocolo'],
  ];
  const TIPOS = { base: ['fundamentos', C.s4], lenguaje: ['lenguajes', C.s1], plataforma: ['plataformas y herramientas', C.s2], protocolo: ['protocolos', C.s3] };

  function montarEvolucion(cuerpo) {
    let anio = 2013, sel = null, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Año', min: 1991, max: 2024, valor: anio, alCambiar: (v) => { anio = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 250 : 220) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(TIPOS).map(([t, c]) => ({ color: c, texto: t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el año para ver qué tecnologías ya existían, y haga clic en un hito para leer su historia. Los hitos ya alcanzados aparecen rellenos; los posteriores, vacíos.');
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 14, esc = (y) => izq + ((y - 1991) / (2024 - 1991)) * (Wd - 2 * izq), base = H - 60;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(izq, base); ctx.lineTo(Wd - izq, base); ctx.stroke();
      for (let y = 1995; y <= 2020; y += 5) W.texto(ctx, String(y), esc(y), base + 14, { tam: 10, color: C.apagado });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(esc(anio), base - 6); ctx.lineTo(esc(anio), base + 6); ctx.stroke();
      const CORTO = { 'WWW y HTML': 'WWW', 'JavaScript': 'JS', 'CSS': 'CSS', 'XMLHttpRequest': 'XHR', 'Node.js': 'Node', 'npm': 'npm', 'WebSocket': 'WS', 'TypeScript': 'TS', 'React': 'React', 'ES2015 y HTTP/2': 'ES6', 'WebAssembly': 'Wasm', 'TLS 1.3': 'TLS 1.3', 'HTTP/3': 'HTTP/3' };
      pos = HITOS.map(([y, n, d, t], i) => {
        const x = esc(y), alto = 26 + (i % 5) * 22, ya = y <= anio;
        ctx.strokeStyle = ya ? TIPOS[t][1] : C.rejilla; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - alto); ctx.stroke();
        ctx.fillStyle = ya ? TIPOS[t][1] : C.superficie; ctx.strokeStyle = TIPOS[t][1]; ctx.lineWidth = i === sel ? 3.5 : 2;
        ctx.beginPath(); ctx.arc(x, base - alto, i === sel ? 7 : 5.5, 0, 7); ctx.fill(); ctx.stroke();
        W.texto(ctx, CORTO[n] || n, x, base - alto - 12, { tam: Wd < 600 ? 8 : 10, color: ya ? C.tinta : C.apagado, peso: i === sel ? 700 : 400 });
        return { x, y: base - alto, i };
      });
      const hecho = HITOS.filter((h) => h[0] <= anio), ultimo = hecho[hecho.length - 1];
      registro.textContent = sel !== null ? `${HITOS[sel][0]} · ${HITOS[sel][1]}: ${HITOS[sel][2]}` : ultimo ? `En ${anio} ya existían ${hecho.length} de estas tecnologías; la más reciente: ${ultimo[1]} (${ultimo[0]}).` : 'En 1991 todavía no existía la web.';
      lectura.set([['año', String(anio)], ['hitos alcanzados', `${hecho.length} de ${HITOS.length}`], ['década de más novedades', '2009 – 2018']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const cerca = (ev) => { const { x, y } = lienzo.posicion(ev); return pos.find((p) => Math.hypot(p.x - x, p.y - y) < 14); };
    lienzo.canvas.addEventListener('click', (ev) => { const p = cerca(ev); sel = p ? p.i : null; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const p = cerca(ev); if (!p) return tip.ocultar(); const { x, y } = lienzo.posicion(ev); tip.mostrar(x, y, `<b>${HITOS[p.i][0]}</b> · ${HITOS[p.i][1]}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('web-roles-ecosystem', {
    intro: String.raw`
      <p>Una aplicación web real no la hace una sola persona ni una sola tecnología: reúne interfaz, servidor, datos, infraestructura y pruebas. Alrededor de esas capas se organizan los <strong>roles profesionales</strong>
      —frontend, backend, full stack, DevOps, QA, arquitectura— cuyos límites cambian según el equipo.</p>
      <p>Además, el ecosistema evoluciona muy rápido: lenguajes, protocolos y herramientas aparecen, se consolidan y reemplazan a otras. Entender de dónde viene cada pieza ayuda a decidir qué aprender y qué descartar.</p>`,
    visualizaciones: [
      { titulo: 'Roles y capas de una aplicación', descripcion: 'Arme un equipo eligiendo roles y vea qué capas quedan cubiertas y cuáles sin responsable; pase el cursor por una capa para ver qué incluye.', montar: montarCapas },
      { titulo: 'Evolución del ecosistema web', descripcion: 'Mueva el año por la línea de tiempo de 1991 a 2024 y haga clic en los hitos para leer qué aportó cada uno.', montar: montarEvolucion },
    ],
    teoria: String.raw`
      <h2>Roles</h2>
      <table>
        <tr><th>Rol</th><th>Foco</th><th>Herramientas típicas</th></tr>
        <tr><td>Frontend</td><td>interfaz, accesibilidad, rendimiento percibido</td><td>HTML, CSS, JavaScript/TypeScript, React</td></tr>
        <tr><td>Backend</td><td>API, reglas del negocio, datos, seguridad</td><td>Node.js, bases de datos, REST</td></tr>
        <tr><td>Full Stack</td><td>una funcionalidad de punta a punta</td><td>cliente y servidor</td></tr>
        <tr><td>DevOps</td><td>automatizar construir, probar, desplegar y operar</td><td>contenedores, nube, CI/CD, monitoreo</td></tr>
        <tr><td>QA</td><td>prevenir y detectar defectos</td><td>pruebas automáticas, cobertura</td></tr>
        <tr><td>Arquitectura</td><td>estructura global y compromisos de calidad</td><td>diagramas, decisiones documentadas</td></tr>
      </table>
      <h2>Arquitectura de software</h2>
      <p>Arquitecturar es elegir entre alternativas con costos: un monolito es simple de desplegar pero escala todo junto; los servicios separados escalan por partes pero añaden complejidad de red; una SPA ofrece fluidez pero una carga inicial pesada (<a href="tema.html?id=spa-architecture">ver SPA</a>). Ninguna decisión es gratis: se documenta el contexto, las opciones y por qué se eligió, para poder revisarla después.</p>
      <h2>Aprender en un ecosistema que cambia</h2>
      <ul>
        <li>Los <strong>fundamentos</strong> (HTTP, DOM, JavaScript, bases de datos, seguridad) cambian poco y se aplican a cualquier herramienta.</li>
        <li>Los <strong>frameworks</strong> duran años; sus ideas (componentes, estado, middleware) se repiten entre ellos.</li>
        <li>Las herramientas de desarrollo del navegador (pestaña de red, consola, depurador) son el mejor aliado para entender qué hace realmente una página, desde <a href="tema.html?id=request-lifecycle">la primera petición</a>.</li>
      </ul>
      <div class="recuadro">Este recorrido fue de la red a la interfaz, del servidor a los datos, de la seguridad a la calidad: <a href="tema.html?id=devops-ci-cd">DevOps y entrega continua</a> es el lugar donde todas las capas se encuentran. Para repasar los fundamentos, vuelva a <a href="tema.html?id=http-messages">HTTP</a> y al <a href="tema.html?id=dom-tree">DOM</a>.</div>`,
  });
})();
