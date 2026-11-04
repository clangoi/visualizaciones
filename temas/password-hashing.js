(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* SHA-256 síncrono (FIPS 180-4) para poder mostrar los resultados al instante. */
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(texto) {
    const bytes = [...new TextEncoder().encode(texto)], largo = bytes.length * 8;
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0, (largo >>> 24) & 255, (largo >>> 16) & 255, (largo >>> 8) & 255, largo & 255);
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < bytes.length; i += 64) {
      const w = new Array(64);
      for (let t = 0; t < 16; t++) w[t] = (bytes[i + 4 * t] << 24) | (bytes[i + 4 * t + 1] << 16) | (bytes[i + 4 * t + 2] << 8) | bytes[i + 4 * t + 3];
      for (let t = 16; t < 64; t++) { const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10); w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0; }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[t] + w[t]) | 0, S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [a, b, c, d, e, f, g, hh].map((x, k) => (h[k] + x) | 0);
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const bits = (hex) => [...hex].flatMap((c) => parseInt(c, 16).toString(2).padStart(4, '0').split('').map(Number));

  /* ---------- Fig. 1: efecto avalancha y sal ---------- */

  function montarAvalancha(cuerpo) {
    let a = 'contraseña1', b = 'contraseña2', sal = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Contraseña A', valor: a, alCambiar: (v) => { a = v; dibujar(); }, alEnter: (v) => { a = v; dibujar(); } });
    ctl.texto({ etiqueta: 'Contraseña B', valor: b, alCambiar: (v) => { b = v; dibujar(); }, alEnter: (v) => { b = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'agregar una sal aleatoria distinta a cada usuario', valor: false, alCambiar: (v) => { sal = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 128 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'bit igual en ambos hashes' }, { color: C.s2, texto: 'bit distinto' }]);
    const hashes = el('pre', { class: 'codigo-bdd' });
    cuerpo.appendChild(hashes);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un cambio mínimo en la entrada (un solo carácter) cambia cerca de la mitad de los 256 bits: es el <em>efecto avalancha</em>. Escriba la misma contraseña en A y B, con y sin sal, y compare.');
    let geo = null, hb = [];
    function dibujar() {
      const sa = sal ? 'sal-de-ana' : '', sb = sal ? 'sal-de-beto' : '';
      const h1 = sha256(sa + a), h2 = sha256(sb + b), b1 = bits(h1), b2 = bits(h2);
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = Wd < 600, cols = 32, filas = 8, cw = Math.min(14, (vertical ? Wd - 8 : (Wd - 8)) / cols), ch = Math.min(14, (H - 20 - (vertical ? 20 : 0)) / (vertical ? filas * 2 : filas));
      geo = { cw, ch, cols };
      hb = [];
      b1.forEach((x, i) => { const d = x !== b2[i], col = i % cols, fil = Math.floor(i / cols); ctx.fillStyle = d ? C.s2 : VIZ.alfa(C.s1, 0.35); ctx.fillRect(4 + col * cw, 6 + fil * ch, cw - 1.5, ch - 1.5); hb.push({ i, d, x, y: b2[i] }); });
      const dif = b1.reduce((s, x, i) => s + (x !== b2[i] ? 1 : 0), 0);
      hashes.textContent = `SHA-256(${sal ? '«sal-de-ana» + ' : ''}"${a}")\n= ${h1}\nSHA-256(${sal ? '«sal-de-beto» + ' : ''}"${b}")\n= ${h2}`;
      registro.textContent = a === b && !sal ? 'Misma contraseña y sin sal: hashes idénticos. Quien robe la base de datos ve de inmediato qué usuarios comparten contraseña.' : a === b && sal ? 'Misma contraseña pero con distinta sal: los hashes son completamente distintos; no se puede saber que coinciden.' : `Las entradas se diferencian en poco, pero ${dif} de 256 bits cambian (≈ ${Math.round(dif / 2.56)} %, cerca de lo esperado, 50 %).`;
      lectura.set([['bits distintos', `${dif} de 256`], ['proporción', `${VIZ.fmt((dif / 256) * 100, 3)} %`], ['hashes iguales', h1 === h2 ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!geo) return; const c = Math.floor((x - 4) / geo.cw), f = Math.floor((y - 6) / geo.ch), i = f * geo.cols + c; if (c < 0 || c >= geo.cols || f < 0 || f > 7 || !hb[i]) return tip.ocultar(); tip.mostrar(x, y, `bit <b>${i + 1}</b><br>A = ${hb[i].x}, B = ${hb[i].y}${hb[i].d ? '<br>distinto' : ''}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: cuánto tarda un ataque de fuerza bruta ---------- */

  const ALGOS = [{ t: 'SHA-256 sin más (rápido)', c: C.s8, ps: 1e10 }, { t: 'PBKDF2, 600 000 iteraciones', c: C.s2, ps: 2e4 }, { t: 'bcrypt / Argon2 (lento y con memoria)', c: C.s1, ps: 2e3 }];
  const ALFABETOS = { num: ['solo dígitos', 10], min: ['minúsculas', 26], alfa: ['letras y dígitos', 62], todo: ['todos los símbolos', 94] };

  function montarFuerzaBruta(cuerpo) {
    let alfa = 'alfa';
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Caracteres permitidos', valor: alfa, opciones: Object.entries(ALFABETOS).map(([k, v]) => [k, `${v[0]} (${v[1]})`]), alCambiar: (v) => { alfa = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ALGOS.map((a) => ({ color: a.c, texto: `${a.t} · ${a.ps.toExponential(0).replace('e+', '×10^')} intentos/s`, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tiempo medio para adivinar la contraseña (la mitad del espacio de búsqueda), con una tarjeta gráfica atacando un hash robado. Escala logarítmica.');
    const seg = (a, L) => (Math.pow(ALFABETOS[alfa][1], L) / 2) / a.ps;
    const legible = (s) => (s < 1 ? '< 1 s' : s < 60 ? `${VIZ.fmt(s, 3)} s` : s < 3600 ? `${VIZ.fmt(s / 60, 3)} min` : s < 86400 ? `${VIZ.fmt(s / 3600, 3)} h` : s < 3.15e7 ? `${VIZ.fmt(s / 86400, 3)} días` : s < 3.15e9 ? `${VIZ.fmt(s / 3.15e7, 3)} años` : `${s.toExponential(1)} s`);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 4, xmax: 16, ymin: 1e-3, ymax: 1e24 }, { logY: true, etiquetaX: 'largo de la contraseña', etiquetaY: 'segundos', formatoY: (v) => (v >= 1e9 ? `10^${Math.round(Math.log10(v))}` : v >= 1 ? VIZ.entero(v) : String(v)), ticksY: [1e-3, 1, 1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24] });
      plano.ejes();
      [[3.15e7, '1 año'], [3.15e9, '100 años']].forEach(([v, t]) => { const y = plano.sy(v); ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.x0, y); ctx.lineTo(plano.x1, y); ctx.stroke(); ctx.setLineDash([]); W.texto(ctx, t, plano.x1 - 4, y - 6, { tam: 10, alinear: 'right', color: C.apagado }); });
      ALGOS.forEach((a) => VIZ.trazar(ctx, plano, Array.from({ length: 13 }, (_, i) => [4 + i, seg(a, 4 + i)]), a.c, 2));
      lectura.set([['8 caracteres, SHA-256 simple', legible(seg(ALGOS[0], 8))], ['8 caracteres, PBKDF2', legible(seg(ALGOS[1], 8))], ['8 caracteres, bcrypt/Argon2', legible(seg(ALGOS[2], 8))], ['12 caracteres, bcrypt/Argon2', legible(seg(ALGOS[2], 12))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const L = Math.max(4, Math.min(16, Math.round(plano.ix(x)))); tip.mostrar(x, y, `largo = <b>${L}</b>` + ALGOS.map((a) => VIZ.filaTooltip(a.c, a.t.split(' ')[0], legible(seg(a, L)))).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('password-hashing', {
    intro: String.raw`
      <p>Un sitio nunca debe guardar contraseñas: si se filtra su base de datos, quedarían expuestas todas las cuentas (y las de otros sitios donde se reutilizan). En su lugar guarda un <strong>hash</strong>:
      el resultado de una función unidireccional, fácil de calcular y prácticamente imposible de invertir.</p>
      <p>Pero un hash común es demasiado <em>rápido</em>: un atacante puede probar miles de millones de candidatas por segundo. Por eso se añade una <strong>sal</strong> aleatoria por usuario y se usan funciones deliberadamente <strong>lentas</strong> (bcrypt, scrypt, Argon2).</p>`,
    visualizaciones: [
      { titulo: 'Efecto avalancha y sal', descripcion: 'Compare los hashes SHA-256 de dos contraseñas casi iguales y active la sal: observe cuántos de los 256 bits cambian y por qué dos usuarios con la misma clave dejan de ser iguales.', montar: montarAvalancha },
      { titulo: 'Fuerza bruta: rápido frente a lento', descripcion: 'Cambie los caracteres permitidos y compare cuánto resiste cada algoritmo según el largo de la contraseña.', montar: montarFuerzaBruta },
    ],
    teoria: String.raw`
      <h2>Propiedades de un hash criptográfico</h2>
      <ul>
        <li><strong>Determinista</strong>: la misma entrada da siempre el mismo hash.</li>
        <li><strong>Unidireccional</strong>: dado \(h\), es inviable hallar \(x\) con \(H(x) = h\).</li>
        <li><strong>Avalancha</strong>: cambiar un bit de la entrada cambia cada bit de la salida con probabilidad \(\approx 1/2\).</li>
        <li><strong>Resistente a colisiones</strong>: es inviable hallar \(x \ne y\) con \(H(x)=H(y)\).</li>
      </ul>
      <h2>Almacenamiento seguro</h2>
      <pre><code>registro(usuario, clave):
    sal ← bytes aleatorios (≥ 16)
    hash ← FuncionLenta(clave, sal, costo)       // bcrypt, scrypt, Argon2id
    guardar (usuario, sal, costo, hash)
login(usuario, clave):
    recalcular FuncionLenta(clave, sal, costo) y comparar en tiempo constante</code></pre>
      <p>La <strong>sal</strong> hace inútiles las tablas precalculadas (<em>rainbow tables</em>) y obliga a atacar cada usuario por separado. El <strong>costo</strong> multiplica el tiempo de cada intento: con \(\alpha\) caracteres posibles y largo \(L\), un ataque tarda en promedio</p>
      \[ T \approx \frac{\alpha^{L}}{2\,v}, \]
      <p>con \(v\) intentos por segundo. Subir el largo en un carácter multiplica \(T\) por \(\alpha\); usar una función \(1000\) veces más lenta divide \(v\) por \(1000\).</p>
      <div class="recuadro">Nunca invente su propio esquema ni use MD5/SHA-1 «a secas» para contraseñas. Un hash <em>no es cifrado</em>: no se puede «descifrar». Para el canal usado al enviar la clave, vea <a href="tema.html?id=tls-handshake">HTTPS/TLS</a>; para controlar el acceso, <a href="tema.html?id=authentication-access-control">autenticación y control de acceso</a>.</div>`,
  });
})();
