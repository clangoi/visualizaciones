(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: anatomía de una URL ---------- */

  const PUERTOS = { http: 80, https: 443, ftp: 21, ws: 80, wss: 443 };
  const EJEMPLOS = [
    'https://www.tienda.ejemplo.com/ofertas/zapatos?color=rojo&talla=40#resenas',
    'http://usuario:clave@intranet.empresa.cl:8080/reportes/2026/ventas.pdf',
    'https://es.wikipedia.org/wiki/Internet',
    'wss://chat.servicio.io/sala/7?token=abc123',
  ];
  const RE = /^([a-z][a-z0-9+.-]*):\/\/(?:([^@/?#]*)@)?([^:/?#]+)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/i;

  function partes(url) {
    const m = RE.exec(url.trim());
    if (!m) return null;
    const [, esquema, usuario, host, puerto, ruta, consulta, fragmento] = m;
    const etiquetas = host.split('.');
    const tld = etiquetas.length > 1 ? etiquetas[etiquetas.length - 1] : '';
    const dominio = etiquetas.length > 1 ? etiquetas.slice(-2).join('.') : host;
    const sub = etiquetas.length > 2 ? etiquetas.slice(0, -2).join('.') : '';
    const trozos = [
      { k: 'esquema', t: esquema.toLowerCase(), pre: '', suf: '://', color: C.s1, desc: 'protocolo con el que se pide el recurso' },
      usuario != null ? { k: 'credenciales', t: usuario, pre: '', suf: '@', color: C.s8, desc: 'usuario y clave en la URL (práctica desaconsejada: queda en historiales y registros)' } : null,
      { k: 'host', t: host, pre: '', suf: '', color: C.s2, desc: sub ? `nombre del servidor: subdominio «${sub}», dominio «${dominio}», dominio de primer nivel «.${tld}»` : `nombre del servidor: dominio «${dominio}»` },
      puerto ? { k: 'puerto', t: puerto, pre: ':', suf: '', color: C.s3, desc: 'puerta del servidor a la que se conecta' } : null,
      { k: 'ruta', t: ruta || '/', pre: '', suf: '', color: C.s6, desc: 'recurso dentro del servidor' },
      consulta ? { k: 'consulta', t: consulta.slice(1), pre: '?', suf: '', color: C.s7, desc: 'parámetros «clave=valor» separados por &' } : null,
      fragmento ? { k: 'fragmento', t: fragmento.slice(1), pre: '#', suf: '', color: C.s4, desc: 'ancla dentro de la página; el navegador no la envía al servidor' } : null,
    ].filter(Boolean);
    return { trozos, puertoEfectivo: puerto || PUERTOS[esquema.toLowerCase()] || '—', predeterminado: !puerto };
  }

  function montarURL(cuerpo) {
    let url = EJEMPLOS[0];
    const ctl = VIZ.controles(cuerpo);
    const texto = ctl.texto({ etiqueta: 'URL', valor: url, alCambiar: (v) => { url = v; dibujar(); }, alEnter: (v) => { url = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', valor: EJEMPLOS[0], opciones: EJEMPLOS.map((e) => [e, e.replace(/^\w+:\/\//, '').slice(0, 34)]), alCambiar: (v) => { url = v; texto.valor = v; dibujar(); } });
    const linea = el('div', { class: 'codigo-bdd' });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(linea, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escriba o pegue cualquier URL con esquema (por ejemplo <code>https://…</code>). Cada color marca una de sus partes.');

    function dibujar() {
      const p = partes(url);
      if (!p) {
        linea.replaceChildren(url || ' ');
        tabla.replaceChildren();
        registro.textContent = 'No es una URL absoluta válida: falta el esquema («https://») o el nombre del servidor.';
        lectura.set([['partes', '0']]);
        return;
      }
      linea.replaceChildren(...p.trozos.flatMap((t) => [
        t.pre ? el('span', null, t.pre) : null,
        el('span', { class: 'dato', style: { background: VIZ.alfa(t.color, 0.28) } }, t.t),
        t.suf ? el('span', null, t.suf) : null,
      ]).filter(Boolean));
      tabla.replaceChildren(
        el('tr', null, el('th', null, 'Parte'), el('th', null, 'Valor'), el('th', null, 'Qué es')),
        ...p.trozos.map((t) => el('tr', null,
          el('td', null, VIZ.ficha(t.k, { color: t.color })), el('td', null, t.t), el('td', null, t.desc))));
      const host = p.trozos.find((t) => t.k === 'host').t;
      const params = (p.trozos.find((t) => t.k === 'consulta') || { t: '' }).t.split('&').filter(Boolean);
      registro.textContent = `El navegador resolverá «${host}» con DNS y se conectará al puerto ${p.puertoEfectivo}${p.predeterminado ? ' (el predeterminado del esquema)' : ''}.`;
      lectura.set([['partes', String(p.trozos.length)], ['puerto efectivo', String(p.puertoEfectivo)], ['parámetros', String(params.length)], ['cifrado', /^(https|wss)$/.test(p.trozos[0].t) ? 'sí (TLS)' : 'no']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: direcciones IPv4 y prefijo CIDR ---------- */

  function montarCIDR(cuerpo) {
    let ip = [192, 168, 10, 77], prefijo = 24, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({
      etiqueta: 'Dirección IPv4', valor: ip.join('.'),
      alCambiar: (v) => { const o = v.split('.').map(Number); if (o.length === 4 && o.every((x) => Number.isInteger(x) && x >= 0 && x < 256)) { ip = o; dibujar(); } else campo.valor = ip.join('.'); },
    });
    const rango = ctl.rango({ etiqueta: 'Prefijo /n', min: 8, max: 30, valor: prefijo, formato: (v) => `/${v}`, alCambiar: (v) => { prefijo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 176 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'bits de red (fijos)' }, { color: C.s2, texto: 'bits de host (varían)' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un bit para mover el límite entre red y host. Con más bits de host caben más equipos en la misma red.');

    const aEntero = (o) => (((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3]) >>> 0;
    const aOctetos = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 6, der = W < 500 ? 78 : 110, w = (W - izq - der) / 8, alto = 30;
      geo = { izq, w, alto };
      for (let o = 0; o < 4; o++) {
        const y = 6 + o * (alto + 6);
        for (let b = 0; b < 8; b++) {
          const idx = o * 8 + b, bit = (ip[o] >> (7 - b)) & 1, red = idx < prefijo;
          ctx.fillStyle = VIZ.alfa(red ? C.s1 : C.s2, 0.22);
          ctx.strokeStyle = red ? C.s1 : C.s2; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(izq + b * w + 1, y, w - 2, alto, 4); ctx.fill(); ctx.stroke();
          VIZ.web.texto(ctx, String(bit), izq + b * w + w / 2, y + alto / 2, { tam: 13, peso: 600 });
        }
        VIZ.web.texto(ctx, String(ip[o]), izq + 8 * w + 10, y + alto / 2, { tam: 14, peso: 600, alinear: 'left' });
      }
      const mascara = prefijo === 0 ? 0 : (0xffffffff << (32 - prefijo)) >>> 0;
      const red = (aEntero(ip) & mascara) >>> 0, difusion = (red | (~mascara >>> 0)) >>> 0;
      const hosts = Math.pow(2, 32 - prefijo) - 2;
      lectura.set([
        ['dirección / prefijo', `${ip.join('.')}/${prefijo}`],
        ['máscara', aOctetos(mascara).join('.')],
        ['dirección de red', aOctetos(red).join('.')],
        ['difusión', aOctetos(difusion).join('.')],
        ['rango de hosts', `${aOctetos(red + 1).join('.')} – ${aOctetos(difusion - 1).join('.')}`],
        ['hosts utilizables', VIZ.entero(hosts)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const b = Math.floor((x - geo.izq) / geo.w), o = Math.floor((y - 6) / (geo.alto + 6));
      if (b < 0 || b > 7 || o < 0 || o > 3) return tip.ocultar();
      const idx = o * 8 + b;
      tip.mostrar(x, y, `bit <b>${idx + 1}</b> de 32<br>vale ${2 ** (7 - b)} en el octeto ${o + 1}<br>${idx < prefijo ? 'identifica la red' : 'identifica el host'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const b = Math.floor((x - geo.izq) / geo.w), o = Math.floor((y - 6) / (geo.alto + 6));
      if (b < 0 || b > 7 || o < 0 || o > 3) return;
      prefijo = Math.min(30, Math.max(8, o * 8 + b + 1));
      rango.valor = prefijo;
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('url-ip-addressing', {
    intro: String.raw`
      <p>Para llegar a un recurso hacen falta dos cosas: <em>qué</em> se quiere y <em>dónde</em> está. Una <strong>URL</strong> responde a ambas con un texto legible
      (<code>https://www.ejemplo.com/ofertas?color=rojo</code>); el <strong>dominio</strong> se traduce a una <strong>dirección IP</strong>, que es lo que realmente entienden los enrutadores.</p>
      <p>Una dirección IPv4 son 32 bits repartidos en cuatro octetos. Una parte identifica la <em>red</em> y el resto al <em>equipo</em>; el prefijo CIDR (<code>/24</code>) dice dónde está la frontera.</p>`,
    visualizaciones: [
      {
        titulo: 'Anatomía de una URL',
        descripcion: 'Edite la URL o elija un ejemplo y observe cómo se separan esquema, servidor, puerto, ruta, parámetros y fragmento. Pruebe quitar el puerto o cambiar el esquema.',
        montar: montarURL,
      },
      {
        titulo: 'Direcciones IPv4 y prefijo CIDR',
        descripcion: 'Cambie el prefijo o haga clic en un bit: la máscara, el rango y la cantidad de equipos posibles se recalculan.',
        montar: montarCIDR,
      },
    ],
    teoria: String.raw`
      <h2>Estructura de una URL</h2>
      <pre><code>esquema://[usuario@]host[:puerto]/ruta[?consulta][#fragmento]</code></pre>
      <ul>
        <li><strong>Esquema</strong>: <code>http</code>, <code>https</code>, <code>ws</code>… define el protocolo y el puerto por omisión (80 y 443).</li>
        <li><strong>Host</strong>: un nombre de dominio o una IP. El nombre se lee de derecha a izquierda: TLD → dominio → subdominios.</li>
        <li><strong>Ruta</strong> y <strong>consulta</strong> viajan al servidor; el <strong>fragmento</strong> se queda en el navegador.</li>
        <li>Los caracteres especiales se codifican con porcentaje: un espacio es <code>%20</code>.</li>
      </ul>
      <h2>Direcciones IP y CIDR</h2>
      <p>Una dirección IPv4 es un entero de 32 bits, escrito como cuatro números de 0 a 255. Con un prefijo de \(n\) bits, la máscara es \(n\) unos seguidos de \(32-n\) ceros y</p>
      \[ \text{red} = \text{IP} \mathbin{\text{AND}} \text{máscara}, \qquad \text{hosts utilizables} = 2^{\,32-n} - 2. \]
      <p>Se restan dos direcciones: la de la red (todos los bits de host en 0) y la de difusión (todos en 1). Por eso una <code>/24</code> admite 254 equipos y una <code>/30</code>, solo 2.</p>
      <table>
        <tr><th>Rango</th><th>Uso</th></tr>
        <tr><td><code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code></td><td>privadas: no se enrutan en Internet</td></tr>
        <tr><td><code>127.0.0.0/8</code></td><td>la propia máquina (<code>localhost</code>)</td></tr>
      </table>
      <div class="recuadro">IPv4 ofrece \(2^{32} \approx 4{,}3\) mil millones de direcciones y se agotaron; IPv6 usa 128 bits (\(2^{128}\)). La traducción de nombres a direcciones la hace <a href="tema.html?id=dns-resolution">DNS</a>.</div>`,
  });
})();
