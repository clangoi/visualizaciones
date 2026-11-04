(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  const modPow = (b, e, m) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
  const PARES = { '23-5': [23, 5], '47-5': [47, 5], '101-2': [101, 2], '211-2': [211, 2] };

  /* ---------- Fig. 1: acuerdo de clave por un canal público ---------- */

  function montarAcuerdo(cuerpo) {
    const est = { par: '23-5', a: 6, b: 15, mitm: false, m: 9 };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Ana' }, { nombre: 'Atacante' }, { nombre: 'Beto' }],
      mensajes: () => {
        const [p, g] = PARES[est.par], a = est.a % (p - 1) || 1, b = est.b % (p - 1) || 1, A = modPow(g, a, p), B = modPow(g, b, p);
        const m = [{ de: 0, a: 2, texto: `públicos: p = ${p}, g = ${g}`, color: C.s1, nota: 'Ana y Beto acuerdan, a la vista de todos, un primo p y una base g. No son secretos.' },
          { de: 0, a: 0, texto: `secreto a = ${a} → A = g^a = ${A}`, color: C.s2, nota: `Ana elige un secreto a que nunca envía y calcula A = ${g}^${a} mod ${p} = ${A}.` },
          { de: 2, a: 2, texto: `secreto b = ${b} → B = g^b = ${B}`, color: C.s3, nota: `Beto hace lo mismo con su secreto b: B = ${g}^${b} mod ${p} = ${B}.` }];
        if (!est.mitm) {
          const s = modPow(B, a, p);
          m.push({ de: 0, a: 2, texto: `envía A = ${A}`, color: C.s2, nota: 'Ana envía A por el canal público. El atacante puede verlo, pero no obtiene a.' });
          m.push({ de: 2, a: 0, texto: `envía B = ${B}`, color: C.s3, nota: 'Beto envía B por el canal público.' });
          m.push({ de: 0, a: 0, texto: `s = B^a mod p = ${s}`, color: C.s6, nota: `Ana calcula B^a mod p = ${B}^${a} mod ${p} = ${s}.` });
          m.push({ de: 2, a: 2, texto: `s = A^b mod p = ${modPow(A, b, p)}`, color: C.s6, nota: `Beto calcula A^b mod p = ${A}^${b} mod ${p} = ${modPow(A, b, p)}: el mismo valor, porque (g^a)^b = (g^b)^a.` });
          m.push({ de: 1, a: 1, texto: `ve p, g, A, B pero no s`, color: C.s8, nota: `El atacante conoce ${p}, ${g}, ${A} y ${B}. Para obtener s necesita a o b: debe resolver un logaritmo discreto (con p pequeño es fácil; con p enorme, inviable).` });
        } else {
          const M = modPow(g, est.m % (p - 1) || 1, p), sA = modPow(M, a, p), sB = modPow(M, b, p);
          m.push({ de: 0, a: 1, texto: `envía A = ${A}`, color: C.s2, nota: 'Ana envía A… pero esta vez el atacante está EN el canal y puede interceptarlo.' });
          m.push({ de: 1, a: 2, texto: `envía M = ${M} (suyo)`, color: C.s8, nota: `El atacante reemplaza A por su propio valor M = g^m = ${M} y se lo manda a Beto.` });
          m.push({ de: 2, a: 1, texto: `envía B = ${B}`, color: C.s3, nota: 'Beto responde con B…' });
          m.push({ de: 1, a: 0, texto: `envía M = ${M} (suyo)`, color: C.s8, nota: 'El atacante también reemplaza B por M ante Ana.' });
          m.push({ de: 0, a: 0, texto: `s con Atacante = ${sA}`, color: C.s8, nota: `Ana cree compartir un secreto con Beto, pero comparte ${sA} con el atacante.` });
          m.push({ de: 2, a: 2, texto: `s con Atacante = ${sB}`, color: C.s8, nota: `Beto comparte ${sB} con el atacante. El atacante descifra, lee y vuelve a cifrar todo lo que pasa entre ellos.` });
          m.push({ de: 1, a: 1, texto: 'ataque de hombre en el medio', color: C.s8, nota: 'Diffie-Hellman por sí solo no autentica: por eso se acompaña de certificados o firmas que prueban quién es el otro extremo.' });
        }
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Primo p y base g', valor: est.par, opciones: Object.keys(PARES).map((k) => [k, `p = ${PARES[k][0]}, g = ${PARES[k][1]}`]), alCambiar: (v) => { est.par = v; reiniciar(); } });
        ctl.rango({ etiqueta: 'Secreto de Ana (a)', min: 2, max: 40, valor: est.a, alCambiar: (v) => { est.a = v; reiniciar(); } });
        ctl.rango({ etiqueta: 'Secreto de Beto (b)', min: 2, max: 40, valor: est.b, alCambiar: (v) => { est.b = v; reiniciar(); } });
        ctl.casilla({ etiqueta: 'el atacante puede modificar los mensajes (hombre en el medio)', valor: false, alCambiar: (v) => { est.mitm = v; reiniciar(); } });
      },
      leyenda: [{ color: C.s1, texto: 'parámetros públicos' }, { color: C.s2, texto: 'Ana' }, { color: C.s3, texto: 'Beto' }, { color: C.s6, texto: 'secreto compartido' }, { color: C.s8, texto: 'atacante' }],
      lectura(hasta, msgs) { const [p, g] = PARES[est.par]; return [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['p y g', `${p}, ${g}`], ['secreto compartido', est.mitm ? 'dos distintos (con el atacante)' : String(modPow(modPow(g, est.b % (p - 1) || 1, p), est.a % (p - 1) || 1, p))]]; },
      nota: 'Nunca viajan los secretos a ni b; solo \\(g^a\\) y \\(g^b\\). Cambie los secretos: el valor compartido siempre coincide en ambos lados.',
    });
  }

  /* ---------- Fig. 2: por qué el logaritmo discreto es difícil ---------- */

  function montarDificultad(cuerpo) {
    let bits = 2048, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño de p', min: 16, max: 4096, paso: 16, valor: bits, formato: (v) => `${v} bits`, alCambiar: (v) => { bits = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    const OPS = 1e12; // operaciones por segundo de un gran clúster
    const lg = (x) => Math.log10(x);
    // log10 del tiempo en segundos.
    const fuerza = (b) => b * lg(2) - lg(OPS);
    const mejor = (b) => { const ln = b * Math.LN2; return ((1.923 * Math.cbrt(ln) * Math.pow(Math.log(ln), 2 / 3)) / Math.LN10) - lg(OPS); };
    const SER = [{ c: C.s8, t: 'fuerza bruta (2^n pasos)', f: fuerza }, { c: C.s1, t: 'mejor algoritmo conocido (sub-exponencial)', f: mejor }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical: exponente de 10 en segundos (10^k). El ataque es viable solo si el tiempo es razonable; la edad del universo es ~10^17 s. Con 2048 bits, incluso un clúster de 10^12 operaciones por segundo tardaría mucho más que la edad del universo (según este modelo simplificado).');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 16, xmax: 4096, ymin: -10, ymax: 120 }, { etiquetaX: 'tamaño de p (bits)', etiquetaY: 'tiempo del ataque (exponente de 10, en segundos)', formatoY: (v) => `10^${Math.round(v)}` });
      plano.ejes();
      [[17.1, 'edad del universo'], [7.5, '1 año']].forEach(([v, t]) => { const y = plano.sy(v); ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.x0, y); ctx.lineTo(plano.x1, y); ctx.stroke(); ctx.setLineDash([]); W.texto(ctx, t, plano.x1 - 4, y - 6, { tam: 10, alinear: 'right', color: C.apagado }); });
      SER.forEach((s) => { VIZ.trazar(ctx, plano, Array.from({ length: 128 }, (_, i) => { const b = 16 + (i * (4096 - 16)) / 127; return [b, s.f(b)]; }), s.c, 2); VIZ.marcador(ctx, plano.sx(bits), plano.sy(s.f(bits)), s.c, 4); });
      const f = (v) => (v < 0 ? 'menos de 1 s' : v < 7.5 ? `10^${VIZ.fmt(v, 3)} s` : `10^${VIZ.fmt(v - 7.5, 3)} años`);
      lectura.set([['tamaño de p', `${bits} bits`], ['fuerza bruta', f(fuerza(bits))], ['mejor método conocido', f(mejor(bits))], ['seguro hoy', mejor(bits) > 17 ? 'sí' : bits < 512 ? 'no' : 'dudoso']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const b = Math.round(plano.ix(x)); tip.mostrar(x, y, `p = <b>${b} bits</b>` + SER.map((s) => VIZ.filaTooltip(s.c, s.t.split(' (')[0], `10^${VIZ.fmt(s.f(b), 3)} s`)).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('key-exchange-dh', {
    intro: String.raw`
      <p>Dos personas que nunca se han visto quieren hablar en secreto, pero solo disponen de un canal donde todos escuchan. ¿Cómo acordar una clave compartida sin enviarla? <strong>Diffie-Hellman</strong> lo logra con
      una idea elegante: cada uno mezcla un secreto propio con un número público, intercambian los resultados, y cada uno vuelve a mezclar su secreto con lo recibido. Ambos llegan al <em>mismo</em> valor, que quien escuchó no puede calcular.</p>
      <p>Es el corazón del acuerdo de claves de HTTPS, y la base del cifrado de las comunicaciones modernas.</p>`,
    visualizaciones: [
      { titulo: 'Acuerdo de clave paso a paso', descripcion: 'Elija números pequeños y recorra el intercambio: ambos obtienen el mismo secreto. Luego active al atacante activo y vea qué sale mal.', montar: montarAcuerdo },
      { titulo: 'Por qué resistir al espía', descripcion: 'Aumente el tamaño del primo p y compare el tiempo de la fuerza bruta con el del mejor método conocido.', montar: montarDificultad },
    ],
    teoria: String.raw`
      <h2>El protocolo</h2>
      <pre><code>público: primo p, base g
Ana:  elige a (secreto)    A ← gᵃ mod p    envía A
Beto: elige b (secreto)    B ← gᵇ mod p    envía B
Ana:  s ← Bᵃ mod p
Beto: s ← Aᵇ mod p</code></pre>
      \[ B^{a} \bmod p = (g^{b})^{a} \bmod p = g^{ab} \bmod p = (g^{a})^{b} \bmod p = A^{b} \bmod p. \]
      <p>El espía conoce \(p, g, A, B\). Obtener \(s = g^{ab}\) exige calcular \(a\) a partir de \(g^a \bmod p\): el <strong>problema del logaritmo discreto</strong>. Calcular \(g^a \bmod p\) es fácil (exponenciación rápida, \(O(\log a)\) multiplicaciones), pero invertirlo no tiene algoritmo eficiente conocido para \(p\) grande: un primo de 2048 bits.</p>
      <h2>Limitaciones</h2>
      <ul>
        <li><strong>No autentica</strong>: un atacante que modifica los mensajes (<em>hombre en el medio</em>) acuerda una clave con cada lado. Se resuelve firmando los valores con un <a href="tema.html?id=digital-certificates">certificado</a>.</li>
        <li><strong>Secreto hacia adelante</strong>: si cada sesión usa secretos nuevos y efímeros (<em>ECDHE</em>), robar una clave a largo plazo no permite descifrar sesiones pasadas.</li>
        <li>Las versiones modernas usan curvas elípticas, con claves mucho más cortas para la misma seguridad.</li>
      </ul>
      <div class="recuadro">El secreto compartido \(s\) no se usa directamente: se deriva una clave simétrica con la que se cifra el resto de la comunicación (<a href="tema.html?id=symmetric-asymmetric-crypto">cifrado simétrico y asimétrico</a>). Ver cómo se integra en <a href="tema.html?id=tls-handshake">el saludo de TLS</a>.</div>`,
  });
})();
