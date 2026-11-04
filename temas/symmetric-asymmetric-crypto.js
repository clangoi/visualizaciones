(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: cifrado simétrico (XOR con una clave compartida) ---------- */

  const hex = (n) => n.toString(16).padStart(2, '0');

  function montarSimetrico(cuerpo) {
    let mensaje = 'HOLA MUNDO', clave = 'sol', claveB = 'sol';
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Mensaje', valor: mensaje, alCambiar: (v) => { mensaje = v || ' '; dibujar(); }, alEnter: (v) => { mensaje = v || ' '; dibujar(); } });
    ctl.texto({ etiqueta: 'Clave de quien cifra (Ana)', valor: clave, alCambiar: (v) => { clave = v || 'k'; dibujar(); } });
    ctl.texto({ etiqueta: 'Clave de quien descifra (Beto)', valor: claveB, alCambiar: (v) => { claveB = v || 'k'; dibujar(); } });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada carácter se combina (XOR) con un carácter de la clave, repetida. Con la <b>misma</b> clave se recupera el mensaje; con otra, sale ruido. (Es un cifrado de juguete: ilustra la idea, no es seguro.)');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const m = [...mensaje.slice(0, 12)], cod = m.map((c, i) => c.charCodeAt(0) ^ clave.charCodeAt(i % clave.length)), dec = cod.map((x, i) => x ^ claveB.charCodeAt(i % claveB.length));
      const mismo = clave === claveB;
      tabla.replaceChildren(el('tr', null, ...['', ...m].map((c) => el('th', null, c || ''))),
        el('tr', null, el('td', { class: 'izq' }, 'texto (código)'), ...m.map((c) => el('td', null, hex(c.charCodeAt(0))))),
        el('tr', null, el('td', { class: 'izq' }, 'clave'), ...m.map((_, i) => el('td', null, hex(clave.charCodeAt(i % clave.length))))),
        el('tr', null, el('td', { class: 'izq' }, 'cifrado (XOR)'), ...cod.map((x) => el('td', null, VIZ.ficha(hex(x), { color: C.s2 })))),
        el('tr', null, el('td', { class: 'izq' }, 'descifrado con la clave de Beto'), ...dec.map((x, i) => el('td', null, VIZ.ficha(mismo ? String.fromCharCode(x) : (x >= 32 && x < 127 ? String.fromCharCode(x) : '·'), { color: mismo ? C.s6 : C.s8 })))));
      registro.textContent = mismo ? 'Misma clave: Beto recupera exactamente el mensaje. Esa clave debe haberse compartido antes por un canal seguro: ese es el problema del cifrado simétrico.' : 'Claves distintas: el resultado es ilegible. Quien no tiene la clave no puede leer el mensaje.';
      lectura.set([['tipo', 'simétrico (una clave)'], ['claves distintas', mismo ? 'no' : 'sí'], ['mensaje recuperado', mismo ? 'sí' : 'no']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: RSA con números pequeños ---------- */

  const PRIMOS = [17, 19, 23, 29, 31, 37, 41, 43];
  const mcd = (a, b) => (b === 0 ? a : mcd(b, a % b));
  const modPow = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; };
  function inverso(e, f) { let [a, b, x0, x1] = [f, e, 0, 1]; while (b > 0) { const q = Math.floor(a / b); [a, b] = [b, a - q * b]; [x0, x1] = [x1, x0 - q * x1]; } return ((x0 % f) + f) % f; }

  function montarRsa(cuerpo) {
    const est = { p: 23, q: 29, e: 5, msg: 'HOLA', firmar: false, equivocada: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Primo p', valor: String(est.p), opciones: PRIMOS.map((x) => [String(x), String(x)]), alCambiar: (v) => { est.p = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Primo q', valor: String(est.q), opciones: PRIMOS.map((x) => [String(x), String(x)]), alCambiar: (v) => { est.q = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Exponente público e', valor: String(est.e), opciones: [3, 5, 7, 11, 13].map((x) => [String(x), String(x)]), alCambiar: (v) => { est.e = +v; dibujar(); } });
    ctl.texto({ etiqueta: 'Mensaje (≤ 8 caracteres)', valor: est.msg, alCambiar: (v) => { est.msg = (v || 'A').slice(0, 8); dibujar(); }, alEnter: (v) => { est.msg = (v || 'A').slice(0, 8); dibujar(); } });
    ctl.casillas([{ clave: 'firmar', texto: 'firmar (cifrar con la clave privada)', activo: false }, { clave: 'equivocada', texto: 'descifrar con una clave equivocada', activo: false }], (e) => { est.firmar = e.firmar; est.equivocada = e.equivocada; dibujar(); });
    const claves = el('div', { class: 'fichas' }), tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(claves, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se cifra con una clave y se descifra con <em>la otra</em>. La clave pública se puede publicar; la privada, jamás. Con primos de tres dígitos esto se rompe en segundos; en la práctica se usan primos de más de 300 dígitos.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const { p, q } = est, n = p * q, phi = (p - 1) * (q - 1);
      let e = est.e; if (mcd(e, phi) !== 1) { e = [3, 5, 7, 11, 13, 17, 19, 23].find((x) => mcd(x, phi) === 1); }
      const d = inverso(e, phi), N = BigInt(n);
      const [kc, kd] = est.firmar ? [d, e] : [e, d], malaClave = est.equivocada ? (kd === d ? d + 2 : e + 2) : kd;
      const m = [...est.msg];
      claves.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Claves:'), VIZ.ficha(`pública (e, n) = (${e}, ${n})`, { color: C.s1 }), VIZ.ficha(`privada (d, n) = (${d}, ${n})`, { color: C.s2 }), VIZ.ficha(`φ(n) = ${phi}`, { color: C.inactivo }));
      const filas = m.map((c) => { const x = c.charCodeAt(0), ct = modPow(BigInt(x), BigInt(kc), N), de = modPow(ct, BigInt(malaClave), N); return { c, x, ct, de: Number(de) }; });
      tabla.replaceChildren(el('tr', null, ...['car.', 'código m', est.firmar ? 'firma m^d mod n' : 'cifrado m^e mod n', 'descifrado'].map((h) => el('th', null, h))),
        ...filas.map((f) => el('tr', null, el('td', null, f.c), el('td', null, String(f.x)), el('td', null, VIZ.ficha(String(f.ct), { color: C.s2 })), el('td', null, VIZ.ficha(f.de === f.x ? `${f.de} → «${f.c}»` : `${f.de} ✕`, { color: f.de === f.x ? C.s6 : C.s8 })))));
      const todos = filas.every((f) => f.de === f.x);
      registro.textContent = n < 256 ? 'n debe ser mayor que 255 para representar cada carácter.' : est.firmar ? (todos ? 'Firma verificada: solo quien tiene la clave privada pudo producir estos valores; cualquiera los comprueba con la pública.' : 'Verificación fallida: la clave usada no corresponde con la firma.') : (todos ? 'Cualquiera puede cifrar con la clave pública, pero solo la clave privada recupera el mensaje.' : 'Con una clave equivocada no se recupera el mensaje.');
      lectura.set([['n = p·q', String(n)], ['φ(n) = (p−1)(q−1)', String(phi)], ['e · d mod φ(n)', String((e * d) % phi)], ['mensaje recuperado', todos ? 'sí' : 'no']]);
    }
    dibujar();
  }

  /* ---------- Fig. 3: cuántas claves hacen falta ---------- */

  function montarClaves(cuerpo) {
    let nmax = 100, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Personas que se comunican', min: 5, max: 200, paso: 5, valor: nmax, alCambiar: (v) => { nmax = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s8, t: 'simétrico: una clave por cada pareja', f: (n) => (n * (n - 1)) / 2 }, { c: C.s1, t: 'asimétrico: un par de claves por persona', f: (n) => 2 * n }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Es la razón de ser del cifrado asimétrico: no hace falta acordar en secreto una clave con cada interlocutor. En la práctica se combinan (cifrado híbrido).');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 2, xmax: 200, ymin: 0, ymax: SER[0].f(200) * 1.03 }, { etiquetaX: 'personas (n)', etiquetaY: 'claves necesarias' });
      plano.ejes();
      SER.forEach((s) => { VIZ.trazar(ctx, plano, Array.from({ length: 100 }, (_, i) => [2 + (i * 198) / 99, s.f(2 + (i * 198) / 99)]), s.c, 2); VIZ.marcador(ctx, plano.sx(nmax), plano.sy(s.f(nmax)), s.c, 4); });
      lectura.set([['n', String(nmax)], ['claves simétricas', VIZ.entero(SER[0].f(nmax))], ['claves asimétricas', VIZ.entero(SER[1].f(nmax))], ['razón', `${VIZ.fmt(SER[0].f(nmax) / SER[1].f(nmax), 3)} ×`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const n = Math.max(2, Math.round(plano.ix(x))); tip.mostrar(x, y, `n = <b>${n}</b>` + SER.map((s) => VIZ.filaTooltip(s.c, s.t.split(':')[0], VIZ.entero(s.f(n)))).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('symmetric-asymmetric-crypto', {
    intro: String.raw`
      <p>Cifrar es transformar un mensaje para que solo quien tenga cierto secreto pueda leerlo. Hay dos familias. En el <strong>cifrado simétrico</strong> la <em>misma</em> clave cifra y descifra: es rápido,
      pero obliga a compartir esa clave en secreto de antemano.</p>
      <p>En el <strong>cifrado asimétrico</strong> cada persona tiene un <em>par</em> de claves: una pública (para que cualquiera le cifre mensajes) y una privada (para leerlos y para firmar). Resuelve el reparto de claves, a costa de ser mucho más lento.</p>`,
    visualizaciones: [
      { titulo: 'Cifrado simétrico: una clave compartida', descripcion: 'Cifre un mensaje y descífrelo con la misma clave y con otra distinta; vea cómo cambia el resultado.', montar: montarSimetrico },
      { titulo: 'RSA con números pequeños', descripcion: 'Elija primos y vea cómo se obtienen las claves; cifre con la pública, firme con la privada y pruebe una clave equivocada.', montar: montarRsa },
      { titulo: 'Cuántas claves hacen falta', descripcion: 'Compare el número de claves de ambos modelos al crecer el número de personas que se comunican.', montar: montarClaves },
    ],
    teoria: String.raw`
      <h2>Simétrico</h2>
      <p>\(C = E_k(M)\) y \(M = D_k(C)\). Algoritmos modernos: AES (con claves de 128 o 256 bits), ChaCha20. Cifran gigabytes por segundo. Su debilidad es logística: para \(n\) personas que se comunican de a pares se necesitan \(\binom{n}{2} = n(n-1)/2\) claves secretas.</p>
      <h2>Asimétrico (RSA)</h2>
      <pre><code>elegir primos p, q          n = p·q          φ(n) = (p − 1)(q − 1)
elegir e con mcd(e, φ(n)) = 1        d = e⁻¹ mod φ(n)
clave pública  = (e, n)           clave privada = (d, n)
cifrar:   c = mᵉ mod n            descifrar: m = cᵈ mod n</code></pre>
      <p>Funciona porque \(m^{ed} \equiv m \pmod n\) (teorema de Euler, pues \(ed \equiv 1 \pmod{\varphi(n)}\)). La seguridad descansa en que factorizar \(n\) en \(p\) y \(q\) es difícil cuando son grandes (2048 bits o más). Para <strong>firmar</strong>, se invierten los papeles: se «cifra» con la privada y cualquiera verifica con la pública. Con \(n\) personas bastan \(2n\) claves.</p>
      <h2>Cifrado híbrido</h2>
      <p>El asimétrico es unas mil veces más lento, así que se usa solo para <em>acordar</em> o proteger una clave simétrica de sesión, y los datos se cifran con AES. Es exactamente lo que ocurre en <a href="tema.html?id=tls-handshake">TLS</a>, y el acuerdo de claves sin enviarlas se ve en <a href="tema.html?id=key-exchange-dh">Diffie-Hellman</a>.</p>
      <div class="recuadro">Nunca implemente su propia criptografía: use bibliotecas probadas (<code>crypto</code> de Node, <code>SubtleCrypto</code> del navegador). Los ejemplos de esta página usan números diminutos y son solo didácticos. Para guardar contraseñas no se cifra: se usa un <a href="tema.html?id=password-hashing">hash lento</a>.</div>`,
  });
})();
