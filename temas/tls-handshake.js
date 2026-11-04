(function () {
  'use strict';
  const { color: C, el } = VIZ;

  function montarSec(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Cliente', 'Servidor'],
      etiquetaCaso: 'Versión',
      casos: [
        { id: '12', nombre: 'TLS 1.2 (2 RTT)', msgs: () => [
          { de: 0, a: 1, texto: 'ClientHello', color: C.s1, nota: 'versiones, suites, aleatorio del cliente', expl: 'El cliente propone versiones y algoritmos (suites) y envía un número aleatorio.' },
          { de: 1, a: 0, texto: 'ServerHello + certificado + KeyExchange', color: C.s2, nota: 'elige suite, aleatorio, clave pública DH', expl: 'El servidor elige la suite, envía su certificado (para autenticarse) y su parte del intercambio de claves.' },
          { de: 0, a: 1, texto: 'ClientKeyExchange + Finished', color: C.s1, nota: 'ambos calculan el secreto', expl: 'El cliente verifica el certificado, envía su parte de DH y ambos derivan las claves de sesión. Finished lo autentica todo con un MAC.' },
          { de: 1, a: 0, texto: 'Finished', color: C.s2, nota: 'comienzan los datos cifrados', expl: 'El servidor confirma. Desde aquí los datos van cifrados y autenticados con las claves de sesión (2 RTT desde el inicio de TLS).' },
          { de: 0, a: 1, texto: 'Datos de la aplicación (cifrados)', color: C.s3, expl: 'El tráfico HTTP ya viaja protegido.' },
        ] },
        { id: '13', nombre: 'TLS 1.3 (1 RTT)', msgs: () => [
          { de: 0, a: 1, texto: 'ClientHello + clave pública DH', color: C.s1, nota: 'ya adivina el grupo DH', expl: 'El cliente envía de una vez su clave pública para Diffie–Hellman, apostando por un grupo habitual.' },
          { de: 1, a: 0, texto: 'ServerHello + clave DH + {certificado, Finished}', color: C.s2, nota: 'ya cifrado desde aquí', expl: 'El servidor responde con su clave DH; desde este mensaje todo lo demás (incluido el certificado) va cifrado.' },
          { de: 0, a: 1, texto: '{Finished} + {Datos de la aplicación}', color: C.s3, nota: 'comienzan los datos', expl: 'El cliente termina y envía ya datos: 1 RTT desde el inicio de TLS.' },
        ] },
      ],
      leyenda: [{ color: C.s1, texto: 'cliente' }, { color: C.s2, texto: 'servidor' }, { color: C.s3, texto: 'datos protegidos' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['viajes de ida y vuelta de TLS', c.id === '12' ? '2' : '1'], ['más el RTT de TCP', '+1']],
    });
  }

  function montarDH(cuerpo) {
    const P = 1019, G = 2;
    let a = 123, b = 456;
    const pm = (base, e) => { let r = 1, x = base % P; while (e > 0) { if (e & 1) r = (r * x) % P; x = (x * x) % P; e >>= 1; } return r; };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Secreto de Ana (a)', min: 2, max: 1000, valor: a, alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Secreto de Beto (b)', min: 2, max: 1000, valor: b, alCambiar: (v) => { b = v; dibujar(); } });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de valores públicos y secretos';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Públicos: p = 1019 y g = 2. Cada uno envía g elevado a su secreto (mod p). Ambos llegan a g^(ab) sin enviarlo nunca. Con números de 12 bits un espía lo rompe probando; con 2048 bits, no.');
    function dibujar() {
      const A = pm(G, a), B = pm(G, b), sA = pm(B, a), sB = pm(A, b);
      let intentos = 0, hallado = -1; for (let x = 1; x < P; x++) { intentos++; if (pm(G, x) === A) { hallado = x; break; } }
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' }, el('tr', null, ['', 'Ana', 'Beto', 'espía (ve el canal)'].map((h) => el('th', null, h))),
        [['secreto', String(a), String(b), '—'], ['envía', `A = g^a mod p = ${A}`, `B = g^b mod p = ${B}`, `ve A = ${A} y B = ${B}`], ['calcula', `B^a mod p = ${sA}`, `A^b mod p = ${sB}`, 'debe resolver el logaritmo discreto']]
          .map(([k, x, y, z]) => el('tr', null, el('td', { class: 'izq' }, k), el('td', null, x), el('td', null, y), el('td', null, z)))));
      registro.textContent = sA === sB ? `Ambos obtienen el secreto compartido ${sA} (= g^(a·b) mod p). El espía, para igualarlo, debe encontrar a partir de A el exponente: probando ${intentos} valores lo halla (a = ${hallado}).` : 'Error de cálculo.';
      lectura.set([['secreto de sesión', String(sA)], ['intentos del espía (fuerza bruta)', String(intentos)], ['con p de 2048 bits', 'inviable']]);
    }
    dibujar();
  }

  VIZ.registrarTema('tls-handshake', {
    intro: String.raw`
      <p><strong>TLS</strong> (sucesor de SSL) protege la comunicación entre dos procesos sobre TCP: es el candado de HTTPS. Antes de enviar datos, cliente y servidor ejecutan un <strong>saludo</strong> (<em>handshake</em>) para tres cosas: acordar algoritmos, <strong>autenticar al servidor</strong> con su certificado y establecer un <strong>secreto compartido</strong> del que derivan las claves simétricas de la sesión.</p>
      <p>El secreto se obtiene con un intercambio de claves tipo Diffie–Hellman, que permite acordar una clave por un canal que un espía observa por completo.</p>`,
    visualizaciones: [
      { titulo: 'El saludo de TLS', descripcion: 'Compare TLS 1.2 y TLS 1.3: cuántos viajes de ida y vuelta pasan antes de que viajen los datos y qué se cifra desde antes.', montar: montarSec },
      { titulo: 'Diffie–Hellman con números pequeños', descripcion: 'Cambie los secretos de Ana y Beto: siempre llegan al mismo valor. Observe cuántas pruebas necesita un espía con un módulo tan pequeño.', montar: montarDH },
    ],
    teoria: String.raw`
      <h2>Diffie–Hellman</h2>
      <p>Con un primo público \(p\) y una base \(g\): Ana elige \(a\) y envía \(A = g^a \bmod p\); Beto elige \(b\) y envía \(B = g^b \bmod p\). Cada uno calcula</p>
      \[ B^a \equiv g^{ab} \equiv A^b \pmod p. \]
      <p>El espía ve \(g\), \(p\), \(A\) y \(B\), pero obtener \(g^{ab}\) exigiría resolver el <em>logaritmo discreto</em>, que no se sabe hacer eficientemente para \(p\) de más de 2 000 bits (o con curvas elípticas, 256 bits). Como los secretos \(a, b\) son efímeros, aunque la clave del servidor se filtre después, las sesiones pasadas siguen protegidas (<em>secreto hacia adelante</em>).</p>
      <h2>Autenticación y clave de sesión</h2>
      <p>DH por sí solo no autentica: un atacante activo podría hacerse pasar por ambos (<em>hombre en el medio</em>). Por eso el servidor firma sus parámetros con la clave asociada a su <strong>certificado</strong>, emitido por una autoridad que el cliente conoce. Del secreto compartido y de los aleatorios de ambos se <em>derivan</em> claves distintas para cifrar y para el MAC de cada sentido, que protegen los registros con <a href="tema.html?id=symmetric-encryption-mac">cifrado autenticado</a>.</p>
      <h2>Costo</h2>
      <p>El tiempo hasta el primer byte útil es \(\mathrm{RTT}_{\text{TCP}} + k\cdot\mathrm{RTT}_{\text{TLS}}\), con \(k=2\) en TLS 1.2 y \(k=1\) en 1.3 (0 al reanudar). Con 100 ms de RTT: 300 ms frente a 200 ms. TLS corre sobre la capa de transporte (<a href="tema.html?id=tcp-connection">TCP</a>); la alternativa en la capa de red es <a href="tema.html?id=ipsec-vpn">IPsec</a>.</p>`,
  });
})();
