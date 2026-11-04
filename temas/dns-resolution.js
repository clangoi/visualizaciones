(function () {
  'use strict';
  const { color: C } = VIZ;

  const DOMINIOS = {
    'www.ejemplo.com': { tld: '.com', ns: 'ns1.ejemplo.com', ip: '93.184.216.34' },
    'www.universidad.cl': { tld: '.cl', ns: 'ns.universidad.cl', ip: '200.14.68.10' },
    'api.servicio.io': { tld: '.io', ns: 'ns.servicio.io', ip: '104.18.22.5' },
  };

  /* ---------- Fig. 1: resolución recursiva paso a paso ---------- */

  function montarResolucion(cuerpo) {
    let dominio = 'www.ejemplo.com', cache = 'frio', rtt = 40;
    const lista = () => {
      const d = DOMINIOS[dominio], m = [];
      m.push({ de: 0, a: 0, texto: 'caché del navegador y del sistema: sin respuesta', nota: 'El navegador y el sistema operativo buscan primero en sus cachés; no hay nada vigente.' });
      m.push({ de: 0, a: 1, texto: `¿IP de ${dominio}?`, color: C.s1, nota: 'El navegador pregunta a su resolvedor (el de su proveedor, o uno como 1.1.1.1) y espera la respuesta final.' });
      if (cache === 'respuesta') {
        m.push({ de: 1, a: 1, texto: 'caché del resolvedor: respuesta vigente', color: C.s6, nota: 'El resolvedor ya conoce la respuesta y no vence su TTL: contesta de inmediato.' });
      } else {
        if (cache === 'frio') {
          m.push({ de: 1, a: 2, texto: `¿${dominio}?`, color: C.s4, nota: 'Consulta iterativa al servidor raíz: el resolvedor parte desde la raíz del árbol de nombres.' });
          m.push({ de: 2, a: 1, texto: `pregunte al TLD ${d.tld}`, color: C.s4, nota: `La raíz no conoce el nombre, pero sabe qué servidores atienden «${d.tld}» (registro NS).` });
        }
        m.push({ de: 1, a: 3, texto: `¿${dominio}?`, color: C.s3, nota: `Consulta al servidor del TLD ${d.tld}.` });
        m.push({ de: 3, a: 1, texto: `pregunte a ${d.ns.split('.')[0]}`, color: C.s3, nota: `El TLD delega: el dominio lo administra ${d.ns}.` });
        m.push({ de: 1, a: 4, texto: `¿${dominio}?`, color: C.s2, nota: 'Consulta al servidor autoritativo, que sí guarda la zona del dominio.' });
        m.push({ de: 4, a: 1, texto: `A ${d.ip}`, color: C.s6, nota: 'El servidor autoritativo responde con el registro A (una dirección IPv4) y su TTL.' });
      }
      m.push({ de: 1, a: 0, texto: d.ip, color: C.s6, nota: 'El resolvedor entrega la IP al navegador y la guarda en caché hasta que venza su TTL.' });
      return m;
    };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Navegador' }, { nombre: 'Resolvedor' }, { nombre: 'Raíz' }, { nombre: 'TLD' }, { nombre: 'Dominio' }],
      mensajes: lista,
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Nombre', valor: dominio, opciones: Object.keys(DOMINIOS).map((k) => [k, k]), alCambiar: (v) => { dominio = v; reiniciar(); } });
        ctl.selector({ etiqueta: 'Caché del resolvedor', valor: cache, opciones: [['frio', 'vacía'], ['tld', 'conoce el TLD'], ['respuesta', 'tiene la respuesta']], alCambiar: (v) => { cache = v; reiniciar(); } });
        ctl.rango({ etiqueta: 'Latencia al resolvedor', min: 2, max: 100, valor: rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { rtt = v; reiniciar(); } });
      },
      leyenda: [
        { color: C.s1, texto: 'consulta del cliente' }, { color: C.s4, texto: 'raíz' }, { color: C.s3, texto: 'TLD' },
        { color: C.s2, texto: 'servidor autoritativo' }, { color: C.s6, texto: 'respuesta final' },
      ],
      lectura(hasta, msgs) {
        const consultas = msgs.filter((m) => m.de === 1 && m.a >= 2).length;
        const total = Math.round(rtt + consultas * (rtt * 0.8));
        return [['mensajes', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['consultas del resolvedor', String(consultas)], ['tiempo total', `≈ ${total} ms`]];
      },
      nota: 'Cada consulta del resolvedor a un servidor de la jerarquía cuesta unos 0,8 veces la latencia del cliente al resolvedor (los servidores de nombres están más lejos). Pruebe con la caché «tiene la respuesta».',
    });
  }

  /* ---------- Fig. 2: TTL y tasa de aciertos ---------- */

  function montarTTL(cuerpo) {
    let ttl = 300, hover = null;
    const TASAS = [{ l: 0.01, c: C.s1, t: 'poco visitado (1 cada 100 s)' }, { l: 0.1, c: C.s2, t: 'mediano (1 cada 10 s)' }, { l: 1, c: C.s3, t: 'muy visitado (1 por s)' }];
    const acierto = (l, T) => (l * T) / (1 + l * T);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'TTL del registro', min: 0, max: 4, paso: 0.05, valor: Math.log10(ttl), formato: (v) => `${VIZ.entero(Math.pow(10, v))} s`, alCambiar: (v) => { ttl = Math.pow(10, v); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, TASAS.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El TTL es un compromiso: un TTL largo ahorra consultas, pero tras un cambio de IP los usuarios pueden seguir viendo la dirección antigua hasta ese plazo.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0, ymax: 1 }, {
        etiquetaX: 'TTL (s)', etiquetaY: 'fracción de consultas respondidas desde la caché',
        formatoX: (v) => VIZ.entero(Math.pow(10, v)), formatoY: (v) => `${Math.round(v * 100)} %`, ticksX: [0, 1, 2, 3, 4],
      });
      plano.ejes();
      for (const s of TASAS) {
        const pts = [];
        for (let e = 0; e <= 4.001; e += 0.05) pts.push([e, acierto(s.l, Math.pow(10, e))]);
        VIZ.trazar(ctx, plano, pts, s.c, 2);
      }
      const x = plano.sx(Math.log10(Math.max(1, ttl)));
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, plano.y0); ctx.lineTo(x, plano.y1); ctx.stroke(); ctx.setLineDash([]);
      for (const s of TASAS) VIZ.marcador(ctx, x, plano.sy(acierto(s.l, ttl)), s.c, 4);
      lectura.set([
        ['TTL', `${VIZ.entero(ttl)} s`],
        ...TASAS.map((s) => [`aciertos (λ = ${s.l}/s)`, `${VIZ.fmt(acierto(s.l, ttl) * 100, 3)} %`]),
        ['datos obsoletos hasta', ttl >= 3600 ? `${VIZ.fmt(ttl / 3600, 3)} h` : `${VIZ.entero(ttl)} s`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const T = Math.pow(10, plano.ix(x));
      tip.mostrar(x, y, `TTL = <b>${VIZ.entero(T)} s</b>` + TASAS.map((s) => VIZ.filaTooltip(s.c, `λ = ${s.l}/s`, `${VIZ.fmt(acierto(s.l, T) * 100, 3)} %`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dns-resolution', {
    intro: String.raw`
      <p>Las personas escriben nombres como <code>www.ejemplo.com</code>, pero las redes enrutan paquetes hacia <strong>direcciones IP</strong>.
      El <strong>DNS</strong> (<em>Domain Name System</em>) es la guía telefónica distribuida de Internet que traduce lo primero en lo segundo.</p>
      <p>Ningún servidor conoce todos los nombres: el sistema es una <strong>jerarquía</strong> (raíz → dominios de primer nivel → dominio) y un
      <em>resolvedor</em> recorre esa jerarquía por usted. Para no repetir el recorrido, cada respuesta se guarda en caché durante un tiempo de vida (<em>TTL</em>).</p>`,
    visualizaciones: [
      {
        titulo: 'Resolución de un nombre paso a paso',
        descripcion: 'Avance mensaje por mensaje y compare una caché vacía con una que ya conoce el TLD o la respuesta completa: observe cuántas consultas desaparecen.',
        montar: montarResolucion,
      },
      {
        titulo: 'TTL y aciertos de caché',
        descripcion: 'Mueva el TTL y vea cómo sube la fracción de consultas resueltas en caché, sobre todo para nombres muy visitados.',
        montar: montarTTL,
      },
    ],
    teoria: String.raw`
      <h2>La jerarquía de nombres</h2>
      <p>Un nombre se lee de derecha a izquierda: <code>www.ejemplo.com.</code> es el nodo <code>www</code> dentro de <code>ejemplo</code>, dentro de <code>com</code>, dentro de la raíz (el punto final).
      Cada nivel es una <strong>zona</strong> administrada por servidores <em>autoritativos</em>; los registros más comunes son:</p>
      <table>
        <tr><th>Registro</th><th>Contenido</th></tr>
        <tr><td><code>A</code> / <code>AAAA</code></td><td>dirección IPv4 / IPv6 del nombre</td></tr>
        <tr><td><code>CNAME</code></td><td>alias hacia otro nombre</td></tr>
        <tr><td><code>NS</code></td><td>servidores autoritativos de una zona (la delegación)</td></tr>
        <tr><td><code>MX</code></td><td>servidores de correo del dominio</td></tr>
        <tr><td><code>TXT</code></td><td>texto libre (verificaciones, SPF)</td></tr>
      </table>
      <h2>Resolución iterativa y recursiva</h2>
      <pre><code>resolver(nombre):
    si caché[nombre] vigente: devolver caché[nombre]
    servidor ← raíz (o el NS más profundo conocido en caché)
    mientras servidor no sea autoritativo para nombre:
        respuesta ← preguntar(servidor, nombre)
        servidor ← respuesta.NS          // una delegación más cercana
    ip ← preguntar(servidor, nombre).A
    caché[nombre] ← ip durante TTL
    devolver ip</code></pre>
      <p>El cliente hace una consulta <em>recursiva</em> (pide la respuesta final); el resolvedor hace consultas <em>iterativas</em> (cada servidor responde con la mejor pista que tiene).</p>
      <h2>Caché y TTL</h2>
      <p>Si las consultas a un nombre llegan como un proceso de Poisson de tasa \(\lambda\) y el TTL es \(T\), tras cada fallo la caché responde durante \(T\) segundos. Un ciclo dura en promedio \(T + 1/\lambda\) y contiene un fallo y \(\lambda T\) aciertos, de modo que</p>
      \[ \text{tasa de aciertos} = \frac{\lambda T}{1 + \lambda T}. \]
      <div class="recuadro">Un TTL largo reduce consultas y latencia, pero ante un cambio de IP los clientes pueden usar la dirección vieja hasta \(T\) segundos. Por eso antes de una migración se baja el TTL con anticipación.</div>
      <p>Continúe con <a href="tema.html?id=tcp-handshake">TCP Handshake</a>, el paso que sigue a obtener la IP, y con <a href="tema.html?id=request-lifecycle">Life of a Web Request</a>.</p>`,
  });
})();
