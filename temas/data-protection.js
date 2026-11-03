(function () {
  'use strict';
  const { color: C } = VIZ;
  const recortar = (ctx, texto, ancho) => {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: cifrado César y Vigenère, frecuencias y hash ---------- */

  // Frecuencia típica de cada letra en español (en %), sin la ñ.
  const REF = [12.5, 1.4, 4.7, 5.9, 13.7, 0.7, 1.0, 0.7, 6.3, 0.4, 0.0, 5.0, 3.1, 6.7, 8.7, 2.5, 1.2, 6.9, 7.9, 4.6, 3.9, 0.9, 0.0, 0.2, 1.1, 0.5];
  const MENSAJE = 'La seguridad de la información protege los datos de la organización: se cifran los datos más sensibles y se guarda una huella de cada archivo para detectar cualquier alteración.';
  const limpiar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const A = 65;

  function cifrar(texto, metodo, clave) {
    const t = limpiar(texto);
    const ks = metodo === 'cesar' ? 'A' : limpiar(clave).replace(/[^A-Z]/g, '') || 'A';
    let j = 0;
    return [...t].map((ch) => {
      const c = ch.charCodeAt(0);
      if (c < A || c > A + 25) return ch;
      const k = metodo === 'cesar' ? clave : ks.charCodeAt(j++ % ks.length) - A;
      return String.fromCharCode(A + ((c - A + k) % 26));
    }).join('');
  }
  function descifrarCesar(texto, k) {
    return [...texto].map((ch) => { const c = ch.charCodeAt(0); return c >= A && c <= A + 25 ? String.fromCharCode(A + ((c - A - k + 26) % 26)) : ch; }).join('');
  }
  function frecuencias(texto) {
    const cuenta = new Array(26).fill(0);
    let n = 0;
    for (const ch of limpiar(texto)) { const c = ch.charCodeAt(0); if (c >= A && c <= A + 25) { cuenta[c - A]++; n++; } }
    return { cuenta, n, f: cuenta.map((v) => (n ? (v / n) * 100 : 0)) };
  }
  const indiceCoincidencia = (fr) => (fr.n > 1 ? fr.cuenta.reduce((s, v) => s + v * (v - 1), 0) / (fr.n * (fr.n - 1)) : 0);
  // Hash didáctico FNV-1a de 32 bits (no apto para contraseñas ni firmas reales).
  function fnv(texto) {
    let h = 2166136261;
    for (const b of new TextEncoder().encode(texto)) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  const hex = (h) => h.toString(16).padStart(8, '0');
  const bitsDistintos = (a, b) => { let x = (a ^ b) >>> 0, n = 0; while (x) { n += x & 1; x >>>= 1; } return n; };

  function montarCifrado(cuerpo) {
    let metodo = 'cesar', desp = 3, claveV = 'CLAVE', mensaje = MENSAJE, pl = null, hover = -1, extra = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Método', opciones: [['cesar', 'César (desplazamiento fijo)'], ['vig', 'Vigenère (clave con varias letras)']], valor: metodo, alCambiar: (v) => { metodo = v; extra = ''; dibujar(); } });
    ctl.rango({ etiqueta: 'Desplazamiento de César', min: 1, max: 25, valor: desp, alCambiar: (v) => { desp = v; extra = ''; dibujar(); } });
    ctl.texto({ etiqueta: 'Clave de Vigenère', valor: claveV, alCambiar: (v) => { claveV = v; extra = ''; dibujar(); }, alEnter: (v) => { claveV = v; extra = ''; dibujar(); } });
    ctl.texto({ etiqueta: 'Mensaje', valor: mensaje, alCambiar: (v) => { mensaje = v; extra = ''; dibujar(); }, alEnter: (v) => { mensaje = v; extra = ''; dibujar(); } });
    ctl.boton('Atacar por frecuencias', () => {
      const cif = cifrar(mensaje, metodo, metodo === 'cesar' ? desp : claveV), fc = frecuencias(cif);
      let mejor = 0, mejorP = -1;
      for (let k = 0; k < 26; k++) { const p = REF.reduce((s, r, i) => s + r * fc.f[(i + k) % 26], 0); if (p > mejorP) { mejorP = p; mejor = k; } }
      const intento = descifrarCesar(cif, mejor);
      const ok = limpiar(mensaje) === intento;
      extra = `Ataque: se prueban las 26 claves de César y se elige la que más se parece al español (desplazamiento ${mejor}). Resultado: «${intento.slice(0, 60)}${intento.length > 60 ? '…' : ''}» → ${ok ? 'el mensaje se rompió.' : 'no es legible: este método no es un simple desplazamiento.'}`;
      dibujar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'frecuencia de letras del mensaje' }, { color: C.s2, texto: 'frecuencia en el texto cifrado' }, { color: C.tinta, texto: 'frecuencia típica del español', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escriba su propio mensaje o cambie la clave. Con César las barras anaranjadas son las azules corridas: por eso el ataque por frecuencias lo rompe. Con Vigenère se aplanan. Pase el cursor sobre una letra para ver ambos valores.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const cif = cifrar(mensaje, metodo, metodo === 'cesar' ? desp : claveV);
      const fp = frecuencias(mensaje), fc = frecuencias(cif);
      const max = Math.max(16, ...fp.f, ...fc.f) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 26, ymin: 0, ymax: max }, { etiquetaY: 'frecuencia (%)', ticksX: [], formatoY: (v) => String(Math.round(v)), margen: { izq: 40, inf: 26 } });
      pl.ejes();
      const w = (pl.sx(1) - pl.sx(0)), bw = Math.max(2, (w - 3) / 2);
      for (let i = 0; i < 26; i++) {
        const x = pl.sx(i);
        [[fp.f[i], C.s1, 0], [fc.f[i], C.s2, 1]].forEach(([v, col, k]) => {
          const y = pl.sy(v);
          ctx.fillStyle = i === hover ? VIZ.alfa(col, 0.7) : col;
          ctx.beginPath(); ctx.roundRect(x + 1 + k * bw, y, bw - 0.5, pl.y0 - y, [2, 2, 0, 0]); ctx.fill();
        });
        const yr = pl.sy(REF[i]);
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 1, yr); ctx.lineTo(x + w - 1, yr); ctx.stroke();
        ctx.fillStyle = i === hover ? C.tinta : C.apagado; ctx.font = VIZ.fuente(10, i === hover ? 600 : 400); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String.fromCharCode(A + i), x + w / 2, pl.y0 + 7);
      }
      const mut = mensaje.length ? String.fromCharCode(mensaje.charCodeAt(0) + 1) + mensaje.slice(1) : 'a';
      const h1 = fnv(mensaje), h2 = fnv(mut);
      registro.textContent = (extra ? extra + '\n' : '') + `Cifrado: ${cif.slice(0, 160)}${cif.length > 160 ? '…' : ''}`;
      lectura.set([
        ['índice de coincidencia del mensaje', VIZ.fmt(indiceCoincidencia(fp), 3)],
        ['índice de coincidencia del cifrado', VIZ.fmt(indiceCoincidencia(fc), 3)],
        ['hash del mensaje (FNV-1a, 32 bits)', hex(h1)],
        ['hash con la primera letra cambiada', hex(h2)],
        ['bits distintos entre ambos hashes', `${bitsDistintos(h1, h2)} de 32`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(25, Math.max(0, Math.floor(pl.ix(x))));
      dibujar();
      const fp = frecuencias(mensaje), fc = frecuencias(cifrar(mensaje, metodo, metodo === 'cesar' ? desp : claveV));
      const L = String.fromCharCode(A + hover);
      tip.mostrar(x, y, `letra <b>${L}</b>` + VIZ.filaTooltip(C.s1, 'mensaje', VIZ.fmt(fp.f[hover], 3) + ' %') + VIZ.filaTooltip(C.s2, 'cifrado', VIZ.fmt(fc.f[hover], 3) + ' %') + VIZ.filaTooltip(C.tinta, 'español típico', VIZ.fmt(REF[hover], 3) + ' %'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: clasificación y exposición ante una filtración ---------- */

  const CLASES = [
    { id: 'pub', n: 'Pública', col: C.s3, usd: 0 },
    { id: 'int', n: 'Interna', col: C.s1, usd: 0.5 },
    { id: 'con', n: 'Confidencial', col: C.s4, usd: 5 },
    { id: 'res', n: 'Restringida', col: C.s8, usd: 60 },
  ];
  const ACTIVOS = [
    { n: 'Catálogo de productos', c: 0, reg: 5000 },
    { n: 'Manuales y boletín interno', c: 1, reg: 800 },
    { n: 'Contratos y correos con terceros', c: 2, reg: 12000 },
    { n: 'Datos de contacto de clientes', c: 2, reg: 80000 },
    { n: 'Nómina e identificadores', c: 3, reg: 1200 },
    { n: 'Tarjetas de pago', c: 3, reg: 25000 },
    { n: 'Fichas médicas de empleados', c: 3, reg: 600 },
  ];
  const usd = (v) => (v >= 1e6 ? `${VIZ.fmt(v / 1e6, 3)} M USD` : v >= 1e3 ? `${VIZ.fmt(v / 1e3, 3)} mil USD` : `${VIZ.fmt(v, 3)} USD`);

  function montarExposicion(cuerpo) {
    let escenario = 'disco', pLlave = 0.1, conserva = 1, hover = -1, geo = null;
    const quitado = ACTIVOS.map(() => false);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cómo ocurre la filtración', opciones: [['disco', 'Copia de discos o respaldos robados'], ['admin', 'Cuenta de administrador comprometida']], valor: escenario, alCambiar: (v) => { escenario = v; dibujar(); } });
    const cif = ctl.casillas(CLASES.slice(1).map((c, k) => ({ clave: c.id, texto: ['Cifrar datos internos', 'Cifrar datos confidenciales', 'Cifrar datos restringidos'][k], activo: false })), () => dibujar());
    ctl.rango({ etiqueta: 'Probabilidad de que la llave también se filtre', min: 0, max: 1, paso: 0.05, valor: pLlave, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pLlave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Minimización: datos que se conservan', min: 0.1, max: 1, paso: 0.05, valor: conserva, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { conserva = v; dibujar(); } });
    ctl.boton('Cifrar todo y minimizar', () => {
      cuerpo.querySelectorAll('.grupo-casillas input').forEach((i) => { if (!i.checked) { i.checked = true; i.dispatchEvent(new Event('change')); } });
    });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 34 + ACTIVOS.length * 44 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CLASES.map((c) => ({ color: c.col, texto: `${c.n} (${c.usd} USD por registro)` })).concat([{ color: C.superficie, borde: C.apagado, texto: 'exposición sin controles' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los costos por registro son supuestos del modelo, no estadísticas. Marque qué clases se cifran y mueva la minimización; haga clic en una barra para dejar de recolectar ese conjunto de datos. Con la cuenta de administrador, el cifrado en reposo no ayuda.');

    const factorCif = (a) => (cif[CLASES[a.c].id] ? (escenario === 'admin' ? 1 : pLlave) : 1);
    const exposicion = (a, k) => (quitado[k] ? 0 : a.reg * conserva * CLASES[a.c].usd * factorCif(a));
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = W < 500 ? 120 : 220, der = 8, top = 24, fila = 44;
      const base = ACTIVOS.map((a) => a.reg * CLASES[a.c].usd);
      const max = Math.max(...base) * 1.05, esc = (W - izq - der - 70) / max;
      geo = { top, fila };
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('exposición si se filtra (USD)', izq, 4);
      ACTIVOS.forEach((a, k) => {
        const y = top + k * fila;
        if (k === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y, W, fila - 2); }
        ctx.font = VIZ.fuente(11); ctx.fillStyle = quitado[k] ? C.apagado : C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, a.n, izq - 12), 8, y + fila / 2 - 8);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado;
        ctx.fillText(recortar(ctx, `${CLASES[a.c].n} · ${VIZ.entero(a.reg)} reg.`, izq - 12), 8, y + fila / 2 + 8);
        ctx.beginPath(); ctx.roundRect(izq, y + 7, Math.max(1, base[k] * esc), 26, [0, 4, 4, 0]);
        ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.stroke();
        const e = exposicion(a, k);
        if (e > 0) { ctx.beginPath(); ctx.roundRect(izq, y + 11, Math.max(1, e * esc), 18, [0, 4, 4, 0]); ctx.fillStyle = CLASES[a.c].col; ctx.fill(); }
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(quitado[k] ? 'no se recolecta' : usd(e), izq + Math.max(base[k], e) * esc + 6, y + 20);
      });
      const total = ACTIVOS.reduce((s, a, k) => s + exposicion(a, k), 0), sin = base.reduce((s, v) => s + v, 0);
      const legibles = ACTIVOS.reduce((s, a, k) => s + (quitado[k] || CLASES[a.c].usd === 0 ? 0 : a.reg * conserva * factorCif(a)), 0);
      const mayor = ACTIVOS.reduce((m, a, k) => (exposicion(a, k) > exposicion(ACTIVOS[m], m) ? k : m), 0);
      registro.textContent = `Exposición = Σ registros × fracción conservada × costo por registro × probabilidad de que el cifrado falle. ${escenario === 'admin' ? 'Con una cuenta de administrador la llave está disponible: el cifrado en reposo no reduce nada.' : `Sin llave, los datos cifrados solo se ven si la llave también se filtra (${Math.round(pLlave * 100)} %).`}`;
      lectura.set([
        ['exposición total', usd(total)], ['sin controles', usd(sin)], ['reducción', `${VIZ.fmt((1 - total / sin) * 100, 3)} %`],
        ['registros sensibles legibles', VIZ.entero(legibles)], ['conjunto que más pesa', total ? ACTIVOS[mayor].n : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const fila = (y) => { const k = Math.floor((y - geo.top) / geo.fila); return k >= 0 && k < ACTIVOS.length ? k : -1; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = fila(y);
      if (k !== hover) { hover = k; dibujar(); }
      if (k < 0) return tip.ocultar();
      const a = ACTIVOS[k];
      tip.mostrar(x, y, `<b>${a.n}</b><br>${CLASES[a.c].n}: ${VIZ.entero(a.reg)} registros<br>sin controles ${usd(a.reg * CLASES[a.c].usd)}<br>ahora <b>${usd(exposicion(a, k))}</b><br>${cif[CLASES[a.c].id] ? 'cifrado en reposo' : 'sin cifrar'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const k = fila(lienzo.posicion(ev).y); if (k >= 0) { quitado[k] = !quitado[k]; dibujar(); } });
    dibujar();
  }

  VIZ.registrarTema('data-protection', {
    intro: String.raw`
      <p>Proteger datos no es proteger todo por igual: es decidir <strong>cuánto protege cada clase de información</strong> según el daño que causaría su filtración. Un catálogo de productos es público; la ficha médica de un empleado,
      no. A partir de esa <em>clasificación</em> se eligen controles: cifrar los datos guardados y los que viajan por la red, limitar quién accede y, sobre todo, <strong>no guardar lo que no hace falta</strong> (minimización).</p>
      <p>El cifrado transforma un mensaje legible en uno ilegible con una clave; una función <em>hash</em> produce una huella que cambia por completo si el archivo cambia, útil para comprobar integridad. Ambas ideas se pueden explorar con cifrados antiguos
      que ya no son seguros pero muestran bien por qué un cifrado debe esconder las frecuencias del lenguaje.</p>`,
    visualizaciones: [
      {
        titulo: 'Cifrado, frecuencias y hash',
        descripcion: 'Cifre con César y pulse «Atacar por frecuencias»: lo rompe. Cambie a Vigenère con clave de varias letras y repita: las barras se aplanan y el ataque falla. Mire también cómo un solo carácter cambia buena parte de los bits del hash.',
        montar: montarCifrado,
      },
      {
        titulo: 'Clasificación y exposición ante una filtración',
        descripcion: 'Cifre solo las clases confidencial y restringida, y compare la exposición. Cambie a «cuenta de administrador comprometida» y observe que el cifrado deja de ayudar; luego deje de recolectar un conjunto con clic.',
        montar: montarExposicion,
      },
    ],
    teoria: String.raw`
      <h2>Clasificación de la información</h2>
      <table>
        <tr><th>Clase</th><th>Ejemplo</th><th>Controles mínimos</th></tr>
        <tr><td>Pública</td><td>catálogo de productos</td><td>integridad (que nadie lo altere)</td></tr>
        <tr><td>Interna</td><td>manuales, boletín</td><td>acceso solo del personal</td></tr>
        <tr><td>Confidencial</td><td>contratos, datos de clientes</td><td>cifrado, registro de accesos, mínimo privilegio</td></tr>
        <tr><td>Restringida</td><td>tarjetas, nómina, salud</td><td>cifrado, MFA, retención corta, auditoría</td></tr>
      </table>
      <p>Cifrado <strong>en reposo</strong> protege discos, bases de datos y respaldos; cifrado <strong>en tránsito</strong> (TLS) protege el tráfico por la red. Ninguno protege de alguien que ya tiene una sesión legítima: por eso se combinan con control de acceso.</p>
      <h2>Cifrado clásico</h2>
      <p>El cifrado de César desplaza cada letra \(k\) posiciones; el de Vigenère usa una clave \(K = k_0 k_1 \dots k_{m-1}\) que se repite:</p>
      \[ C_i = (P_i + k) \bmod 26, \qquad C_i = (P_i + k_{i \bmod m}) \bmod 26. \]
      <p>César tiene solo 25 claves y conserva el patrón del idioma: la \(E\) más frecuente del texto cifrado delata el desplazamiento. El <em>índice de coincidencia</em> mide cuán «desigual» es la distribución de letras:</p>
      \[ \mathrm{IC} = \sum_{i=A}^{Z} \frac{n_i (n_i - 1)}{N (N-1)}. \]
      <p>Para español vale cerca de \(0{,}07\); para letras al azar, \(1/26 \approx 0{,}038\). César no lo modifica; Vigenère lo acerca a \(0{,}038\) cuanto más larga es la clave. Aun así se rompe estimando el largo de la clave, así que ninguno de los dos se usa hoy:
      los cifrados reales (AES) están diseñados para que el texto cifrado no revele estructura alguna.</p>
      <h2>Hash e integridad</h2>
      <p>Una función hash \(h\) convierte cualquier mensaje en una huella de tamaño fijo; un buen hash tiene <em>efecto avalancha</em>: al cambiar un bit de entrada cambian en promedio la mitad de los bits de salida (\(16\) de \(32\) en un hash ideal; la figura muestra cuántos cambian en FNV-1a al alterar la primera letra).
      Sirve para verificar que un archivo no fue alterado, pero no oculta su contenido. La función de la figura (FNV-1a) es solo didáctica; para claves o firmas se usan SHA-256 o algoritmos con sal y costo ajustable.</p>
      <h2>Exposición ante una filtración</h2>
      <p>Una medida simple es la pérdida esperada de un conjunto de datos:</p>
      \[ E = N \cdot q \cdot c \cdot \pi, \]
      <p>con \(N\) registros, \(q\) la fracción conservada tras minimizar, \(c\) el costo por registro de su clase y \(\pi\) la probabilidad de que el cifrado no los proteja (\(\pi = 1\) sin cifrar o si el atacante tiene acceso a la llave).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Tarjetas de pago: \(N = 25\,000\), \(c = 60\) USD, sin controles \(E = 1{,}5\) M USD. Cifradas, con probabilidad de filtración de llave \(\pi = 0{,}1\): \(E = 150\) mil USD. Si además se conserva el \(40\,\%\) de los datos
      (se borra lo que ya no se necesita): \(E = 60\) mil USD. Con una cuenta de administrador comprometida, \(\pi = 1\) y el cifrado no reduce nada: vuelven a \(600\) mil USD por la minimización sola.</p></div>
      <h2>Conexiones</h2>
      <p>Estos controles refuerzan la confidencialidad y la integridad de la <a href="tema.html?id=cia-triad">tríada CIA</a>. El control de acceso que complementa al cifrado está en
      <a href="tema.html?id=authentication-access-control">autenticación y control de acceso</a>; los fundamentos de hashing como estructura de datos, en <a href="tema.html?id=hash">tablas hash</a>.</p>`,
  });
})();
