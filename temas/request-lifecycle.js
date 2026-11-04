(function () {
  'use strict';
  const { color: C } = VIZ;

  const ETAPAS = [
    { k: 'dns', t: 'DNS', c: C.s1 }, { k: 'tcp', t: 'TCP', c: C.s3 }, { k: 'tls', t: 'TLS', c: C.s7 },
    { k: 'espera', t: 'espera del servidor', c: C.s4 }, { k: 'descarga', t: 'descarga', c: C.s2 }, { k: 'render', t: 'renderizado', c: C.s6 },
  ];

  /* ---------- Fig. 1: cascada de la primera carga ---------- */

  function montarCascada(cuerpo) {
    const est = { rtt: 60, bw: 20, servidor: 80, kb: 400, tls: '1.3', dnsCache: false, reutiliza: false };
    let hover = -1, filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Latencia (RTT)', min: 5, max: 300, valor: est.rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { est.rtt = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ancho de banda', min: 1, max: 200, valor: est.bw, formato: (v) => `${v} Mb/s`, alCambiar: (v) => { est.bw = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tiempo del servidor', min: 5, max: 500, valor: est.servidor, formato: (v) => `${v} ms`, alCambiar: (v) => { est.servidor = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño de la página', min: 20, max: 3000, paso: 20, valor: est.kb, formato: (v) => `${v} KB`, alCambiar: (v) => { est.kb = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Versión de TLS', valor: est.tls, opciones: [['1.3', 'TLS 1.3 (1 viaje)'], ['1.2', 'TLS 1.2 (2 viajes)'], ['no', 'sin TLS (HTTP)']], alCambiar: (v) => { est.tls = v; dibujar(); } });
    ctl.casillas([{ clave: 'dnsCache', texto: 'DNS en caché', activo: false }, { clave: 'reutiliza', texto: 'conexión ya abierta', activo: false }], (e) => { Object.assign(est, e); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 8 + ETAPAS.length * 34 + 26 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ETAPAS.map((e) => ({ color: e.c, texto: e.t })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Baje el RTT a 5 ms y luego súbalo a 300: casi todas las barras son «viajes de ida y vuelta», no descarga. Pase el cursor sobre una barra.');

    function etapas() {
      const { rtt, bw, servidor, kb } = est;
      const tcp = est.reutiliza ? 0 : rtt, tls = est.reutiliza || est.tls === 'no' ? 0 : est.tls === '1.3' ? rtt : 2 * rtt;
      return [
        ['dns', est.dnsCache || est.reutiliza ? 0 : rtt + 20], ['tcp', tcp], ['tls', tls], ['espera', rtt + servidor],
        ['descarga', (kb * 8) / bw], ['render', 60 + kb / 10],
      ];
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const lista = etapas(), total = lista.reduce((s, [, v]) => s + v, 0);
      const izq = W < 500 ? 70 : 120, der = 54, esc = (v) => (v / total) * (W - izq - der);
      let acc = 0;
      filas = lista.map(([k, v], i) => {
        const e = ETAPAS[i], y = 8 + i * 34, x = izq + esc(acc);
        VIZ.web.texto(ctx, W < 500 ? e.t.split(' ')[0] : e.t, izq - 8, y + 13, { tam: 11, alinear: 'right' });
        if (v > 0) {
          ctx.fillStyle = hover === i || hover < 0 ? e.c : VIZ.alfa(e.c, 0.4);
          ctx.fillRect(x, y, Math.max(2, esc(v)), 26);
        } else VIZ.web.texto(ctx, 'omitido', x + 4, y + 13, { tam: 10, color: C.apagado, alinear: 'left' });
        VIZ.web.texto(ctx, `${Math.round(v)} ms`, x + Math.max(2, esc(v)) + 5, y + 13, { tam: 11, alinear: 'left' });
        acc += v;
        return { y, v, e, ini: acc - v };
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq + 0.5, 4); ctx.lineTo(izq + 0.5, 8 + ETAPAS.length * 34); ctx.stroke();
      VIZ.web.texto(ctx, `contenido visible a los ${Math.round(total)} ms`, W - 4, 8 + ETAPAS.length * 34 + 12, { tam: 12, peso: 600, alinear: 'right' });
      const red = lista.slice(0, 5).reduce((s, [, v]) => s + v, 0), viajes = (lista[0][1] ? 1 : 0) + (lista[1][1] ? 1 : 0) + (lista[2][1] ? (est.tls === '1.3' ? 1 : 2) : 0) + 1;
      registro.textContent = viajes === 1 ? 'Con la conexión reutilizada solo queda un viaje de ida y vuelta (más el servidor).' : `Antes de recibir el primer byte de la página hay ${viajes} viajes de ida y vuelta: ${Math.round(lista.slice(0, 4).reduce((s, [, v]) => s + v, 0))} ms que no dependen del ancho de banda.`;
      lectura.set([['primer byte (TTFB)', `${Math.round(lista.slice(0, 4).reduce((s, [, v]) => s + v, 0))} ms`], ['red total', `${Math.round(red)} ms`], ['total', `${Math.round(total)} ms`], ['viajes de ida y vuelta', String(viajes)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = filas.findIndex((f) => y >= f.y && y <= f.y + 26);
      if (k !== hover) { hover = k; dibujar(); }
      if (k < 0) return tip.ocultar();
      tip.mostrar(x, y, VIZ.filaTooltip(filas[k].e.c, filas[k].e.t, `${Math.round(filas[k].v)} ms`) + `empieza en ${Math.round(filas[k].ini)} ms`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: varios recursos, HTTP/1.1 frente a HTTP/2 ---------- */

  function montarRecursos(cuerpo) {
    const est = { n: 12, modo: 'h2', rtt: 80, bw: 20 };
    let semilla = 1, filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Recursos de la página', min: 4, max: 24, valor: est.n, alCambiar: (v) => { est.n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Latencia (RTT)', min: 10, max: 300, valor: est.rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { est.rtt = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Protocolo', valor: est.modo, opciones: [['h1', 'HTTP/1.1, 1 conexión'], ['h6', 'HTTP/1.1, 6 conexiones'], ['h2', 'HTTP/2, 1 conexión multiplexada']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    ctl.boton('Nuevos tamaños', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 20 + est.n * 14 + 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s3, texto: 'abrir conexión (TCP + TLS)' }, { color: C.s4, texto: 'espera (RTT + servidor)' }, { color: C.s2, texto: 'descarga' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un recurso. Compare con una latencia alta: HTTP/1.1 con una sola conexión se forma en fila; con seis paga seis veces la apertura; HTTP/2 la paga una vez.');

    function planificar() {
      const rnd = VIZ.semilla(semilla * 7 + est.n);
      const tam = Array.from({ length: est.n }, (_, i) => (i === 0 ? 60 : 10 + Math.floor(rnd() * 140))); // KB
      const apertura = est.rtt * 2, servidor = 30;
      const filas = [];
      if (est.modo === 'h2') {
        // el HTML llega primero; el resto se pide en paralelo sobre la misma conexión y comparte el ancho de banda
        const html = tam[0], resto = tam.slice(1);
        const tHtml = apertura + est.rtt + servidor + (html * 8) / est.bw;
        filas.push({ i: 0, ab: [0, apertura], esp: [apertura, apertura + est.rtt + servidor], des: [apertura + est.rtt + servidor, tHtml], tam: html });
        let t = tHtml + est.rtt + servidor;
        resto.forEach((kb, j) => {
          const dur = (kb * 8) / est.bw;
          filas.push({ i: j + 1, ab: null, esp: [tHtml, t], des: [t, t + dur], tam: kb });
          t += dur;
        });
        return { filas, total: t, conexiones: 1, aperturas: 1 };
      }
      const nConn = est.modo === 'h1' ? 1 : 6, libre = Array(nConn).fill(null), bw = est.bw / (est.modo === 'h6' ? Math.min(nConn, est.n) : 1);
      let tHtml = 0;
      tam.forEach((kb, i) => {
        // La conexión que antes se libera toma el recurso (los recursos 1+ esperan a que llegue el HTML).
        let c = 0; for (let k = 1; k < nConn; k++) if ((libre[k] ?? -1) < (libre[c] ?? -1)) c = k;
        const nueva = libre[c] === null, ini = i === 0 ? 0 : Math.max(tHtml, libre[c] ?? 0);
        const t0 = ini, abre = nueva ? apertura : 0;
        const esp0 = t0 + abre, des0 = esp0 + est.rtt + servidor, fin = des0 + (kb * 8) / bw;
        filas.push({ i, ab: nueva ? [t0, esp0] : null, esp: [esp0, des0], des: [des0, fin], tam: kb });
        libre[c] = fin; if (i === 0) tHtml = fin;
      });
      return { filas, total: Math.max(...filas.map((f) => f.des[1])), conexiones: nConn, aperturas: libre.filter((x) => x !== null).length };
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const plan = planificar();
      filas = plan.filas;
      const izq = 30, der = 10, esc = (t) => izq + (t / plan.total) * (W - izq - der);
      plan.filas.forEach((f, k) => {
        const y = 8 + k * 14;
        VIZ.web.texto(ctx, String(f.i), izq - 6, y + 5, { tam: 10, color: C.apagado, alinear: 'right' });
        for (const [seg, col] of [[f.ab, C.s3], [f.esp, C.s4], [f.des, C.s2]]) {
          if (!seg) continue;
          ctx.fillStyle = col; ctx.fillRect(esc(seg[0]), y, Math.max(1.5, esc(seg[1]) - esc(seg[0])), 10);
        }
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq + 0.5, 4); ctx.lineTo(izq + 0.5, 8 + plan.filas.length * 14); ctx.stroke();
      VIZ.web.texto(ctx, `0 ms`, izq, plan.filas.length * 14 + 22, { tam: 10, color: C.apagado, alinear: 'left' });
      VIZ.web.texto(ctx, `${Math.round(plan.total)} ms`, W - der, plan.filas.length * 14 + 22, { tam: 10, color: C.apagado, alinear: 'right' });
      lectura.set([['tiempo hasta el último recurso', `${Math.round(plan.total)} ms`], ['conexiones abiertas', String(plan.aperturas)], ['datos totales', `${VIZ.entero(plan.filas.reduce((s, f) => s + f.tam, 0))} KB`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = Math.floor((y - 8) / 14);
      if (k < 0 || k >= filas.length) return tip.ocultar();
      const f = filas[k];
      tip.mostrar(x, y, `recurso <b>${f.i}</b> · ${f.tam} KB<br>termina en ${Math.round(f.des[1])} ms`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('request-lifecycle', {
    intro: String.raw`
      <p>Cuando escribe una dirección y pulsa Enter, ocurre una cadena de pasos: <strong>resolver el nombre</strong> (DNS), <strong>abrir una conexión</strong> (TCP),
      <strong>negociar el cifrado</strong> (TLS), <strong>pedir la página</strong> (HTTP), <strong>descargarla</strong> y por último <strong>dibujarla</strong>.</p>
      <p>Casi todos los pasos iniciales son viajes de ida y vuelta, así que en una página típica el tiempo no lo dicta la velocidad del enlace sino la <em>distancia</em>.
      Entender esta cascada explica optimizaciones como cachés, CDN, conexiones persistentes y HTTP/2.</p>`,
    visualizaciones: [
      {
        titulo: 'Cascada de la primera carga',
        descripcion: 'Mueva latencia, ancho de banda y tiempo del servidor, y active la caché de DNS o una conexión reutilizada: vea qué etapas desaparecen y cuáles dominan.',
        montar: montarCascada,
      },
      {
        titulo: 'Muchos recursos: HTTP/1.1 frente a HTTP/2',
        descripcion: 'Una página real pide decenas de archivos. Cambie de protocolo con una latencia alta y observe quién paga más aperturas de conexión.',
        montar: montarRecursos,
      },
    ],
    teoria: String.raw`
      <h2>Las etapas</h2>
      <pre><code>1. caché del navegador / del sistema       (0 viajes si hay respuesta vigente)
2. DNS: nombre → IP                          (≈ 1 RTT con caché del resolvedor)
3. TCP: SYN, SYN-ACK, ACK                    (1 RTT)
4. TLS: negociación del cifrado              (1 RTT en TLS 1.3, 2 en TLS 1.2)
5. HTTP: solicitud → primer byte (TTFB)      (1 RTT + tiempo del servidor)
6. descarga del cuerpo                       (tamaño / ancho de banda)
7. análisis de HTML, CSS, JS y pintado       (CPU del cliente)</code></pre>
      <h2>Modelo de costo</h2>
      <p>Con latencia \(r\) (RTT), ancho de banda \(B\), tamaño \(S\) y tiempo del servidor \(s\), la primera carga sobre HTTPS con TLS 1.3 tarda aproximadamente</p>
      \[ T \approx \underbrace{r}_{\text{DNS}} + \underbrace{r}_{\text{TCP}} + \underbrace{r}_{\text{TLS}} + \underbrace{r + s}_{\text{espera}} + \frac{8S}{B} + T_{\text{render}}. \]
      <p>Los cuatro primeros términos no dependen de \(B\): duplicar el ancho de banda no ayuda a una página pequeña, pero reducir \(r\) con un <em>CDN</em> sí.</p>
      <h2>Cómo se acorta</h2>
      <ul>
        <li><strong>Cachés</strong> (DNS, navegador, <code>Cache-Control</code>): eliminan etapas completas.</li>
        <li><strong>Conexiones persistentes</strong> (<code>keep-alive</code>): se paga TCP y TLS una vez, no por archivo.</li>
        <li><strong>HTTP/2</strong>: multiplexa muchas solicitudes en una conexión, sin el límite de seis conexiones por servidor de HTTP/1.1.</li>
        <li><strong>CDN</strong>: acerca el contenido al usuario y reduce \(r\).</li>
      </ul>
      <p>Detalle de cada etapa en <a href="tema.html?id=dns-resolution">DNS</a>, <a href="tema.html?id=tcp-handshake">TCP</a>, <a href="tema.html?id=tls-handshake">TLS</a> y <a href="tema.html?id=http-messages">HTTP</a>.</p>`,
  });
})();
