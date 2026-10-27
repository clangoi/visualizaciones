(function () {
  'use strict';
  const { color: C } = VIZ;
  const I = VIZ.img;
  const W = 60, H = 40;

  const OPERACIONES = [
    ['dilatar', 'Dilatación A ⊕ B'],
    ['erosionar', 'Erosión A ⊖ B'],
    ['abrir', 'Apertura (A ⊖ B) ⊕ B'],
    ['cerrar', 'Cierre (A ⊕ B) ⊖ B'],
    ['perimetro', 'Perímetro A − (A ⊖ cruz)'],
    ['rellenar', 'Relleno de agujeros'],
    ['limpiar', 'Limpieza de objetos pequeños'],
    ['esqueleto', 'Esqueletización'],
    ['union', 'Unión A ∪ S'],
  ];

  // Segunda figura para la unión: un disco y una barra horizontal.
  function segunda() {
    const s = I.crear(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (Math.hypot(x - 44, y - 25) < 7.5 || (y >= 33 && y <= 35 && x >= 6 && x <= 54)) s.d[y * W + x] = 1;
    }
    return s;
  }

  /* ---------- Fig. 1: operaciones sobre una imagen que se puede dibujar ---------- */

  function montarOperaciones(cuerpo) {
    let op = 'dilatar', tipoEE = 'cuadrado', radio = 1, minimo = 6, semilla = 2;
    let A = I.formas(W, H, semilla, { granos: 14 }), S = segunda(), R = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Operación', opciones: OPERACIONES, valor: op, alCambiar: (v) => { op = v; calcular(); } });
    ctl.selector({ etiqueta: 'Elemento estructurante B', opciones: [['cuadrado', 'Cuadrado'], ['cruz', 'Cruz'], ['disco', 'Disco'], ['horizontal', 'Segmento horizontal']], valor: tipoEE,
      alCambiar: (v) => { tipoEE = v; calcular(); } });
    ctl.rango({ etiqueta: 'Radio de B', min: 1, max: 3, valor: radio, formato: (v) => `${v} (${2 * v + 1}×${2 * v + 1})`, alCambiar: (v) => { radio = v; calcular(); } });
    ctl.rango({ etiqueta: 'Área mínima (limpieza)', min: 2, max: 30, valor: minimo, formato: (v) => `${v} px`, alCambiar: (v) => { minimo = v; calcular(); } });
    ctl.boton('Aplicar al original', () => { A = R; calcular(); }, { primario: true });
    ctl.boton('Imagen nueva', () => { semilla++; A = I.formas(W, H, semilla, { granos: 14 }); calcular(); });
    ctl.boton('Borrar todo', () => { A = I.crear(W, H); calcular(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => I.paneles({ ancho: w }, 2, W / H).alturaTotal });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'objeto' },
      { color: C.s1, texto: 'agregado por la operación' },
      { color: C.s8, texto: 'eliminado por la operación' },
      { color: C.s3, texto: 'segunda figura S (unión)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dibuje sobre la imagen original: haga clic y arrastre para pintar o borrar píxeles. «Aplicar al original» encadena operaciones: pruebe una erosión seguida de una dilatación y compárela con la apertura.');

    function aplicar() {
      const ee = I.elemento(tipoEE, radio);
      switch (op) {
        case 'dilatar': return I.dilatar(A, ee);
        case 'erosionar': return I.erosionar(A, ee);
        case 'abrir': return I.abrir(A, ee);
        case 'cerrar': return I.cerrar(A, ee);
        case 'perimetro': return I.perimetro(A);
        case 'rellenar': return I.rellenar(A);
        case 'limpiar': return I.limpiar(A, minimo);
        case 'esqueleto': return I.esqueleto(A);
        default: return I.union(A, S);
      }
    }
    function calcular() { R = aplicar(); dibujar(); }

    let geo = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const P = I.paneles(lienzo, 2, W / H), a = P.pos(0), b = P.pos(1);
      geo = { P, a };
      const tinta = VIZ.rgb(C.tinta), sup = VIZ.rgb(C.superficie), s1 = VIZ.rgb(C.s1), s3 = VIZ.rgb(C.s3);
      const borrado = VIZ.enRampa(0.35, [C.superficie, C.s8]);
      I.dibujar(ctx, A, a.x, a.y, P.ancho, P.alto, {
        rejilla: true,
        pixel: (i) => (A.d[i] ? tinta : op === 'union' && S.d[i] ? s3 : sup),
      });
      I.rotulo(ctx, 'original A (editable)', a.x, a.y);
      I.dibujar(ctx, R, b.x, b.y, P.ancho, P.alto, {
        rejilla: true,
        pixel: (i) => (R.d[i] && !A.d[i] ? s1 : !R.d[i] && A.d[i] ? borrado : R.d[i] ? tinta : sup),
      });
      I.rotulo(ctx, OPERACIONES.find((o) => o[0] === op)[1], b.x, b.y);
      let mas = 0, menos = 0;
      for (let i = 0; i < W * H; i++) { if (R.d[i] && !A.d[i]) mas++; if (!R.d[i] && A.d[i]) menos++; }
      lectura.set([
        ['píxeles de A', String(I.contar(A))],
        ['píxeles del resultado', String(I.contar(R))],
        ['agregados', String(mas)],
        ['eliminados', String(menos)],
        ['objetos (vecindad 8)', `${I.etiquetar(A).n} → ${I.etiquetar(R).n}`],
      ]);
    }
    lienzo.alDibujar = () => R && dibujar();

    const pixelBajo = (ev) => {
      if (!geo) return -1;
      const { x, y } = lienzo.posicion(ev), { P, a } = geo;
      const i = Math.floor(((x - a.x) / P.ancho) * W), j = Math.floor(((y - a.y) / P.alto) * H);
      return i >= 0 && j >= 0 && i < W && j < H ? j * W + i : -1;
    };
    let pintando = null;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const i = pixelBajo(ev);
      if (i < 0) return;
      pintando = A.d[i] ? 0 : 1;
      A = I.copia(A);
      A.d[i] = pintando;
      lienzo.canvas.setPointerCapture(ev.pointerId);
      calcular();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = pixelBajo(ev);
      if (pintando != null && i >= 0 && A.d[i] !== pintando) { A.d[i] = pintando; calcular(); }
      if (i < 0) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      tip.mostrar(x, y, `píxel <b>(${i % W}, ${(i / W) | 0})</b><br>A <b>${A.d[i]}</b> → resultado <b>${R.d[i]}</b>`);
    });
    const soltar = () => { pintando = null; };
    lienzo.canvas.addEventListener('pointerup', soltar);
    lienzo.canvas.addEventListener('pointercancel', soltar);
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: dilatación y erosión como unión e intersección de traslaciones ---------- */

  function montarTraslaciones(cuerpo) {
    const w = 22, h = 14;
    let modo = 'dilatar', tipoEE = 'cruz';
    const A = I.crear(w, h);
    // Una L con un entrante de un píxel y un punto suelto.
    for (let y = 3; y <= 10; y++) for (let x = 4; x <= 7; x++) A.d[y * w + x] = 1;
    for (let y = 8; y <= 10; y++) for (let x = 8; x <= 15; x++) A.d[y * w + x] = 1;
    A.d[9 * w + 11] = 0;
    A.d[4 * w + 16] = 1;
    let acum = null, actual = null, b = null, k = -1, ee = [], mensaje = '';

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Operación', opciones: [['dilatar', 'Dilatación: unión de A + b'], ['erosionar', 'Erosión: intersección de A − b']], valor: modo,
      alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Elemento estructurante B', opciones: [['cruz', 'Cruz (5 píxeles)'], ['cuadrado', 'Cuadrado 3×3'], ['horizontal', 'Segmento 1×3']], valor: tipoEE,
      alCambiar: (v) => { tipoEE = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (W2) => Math.round(Math.min(W2 * 0.75, 420) * (h / w)) + 4 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'A original (contorno)', forma: 'linea' },
      { color: C.s2, texto: 'traslación del paso actual' },
      { color: C.s1, texto: 'resultado acumulado' },
      { color: C.s7, texto: 'b ∈ B del paso actual' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El recuadro de la derecha es el elemento estructurante con su origen al centro. Con el segmento 1×3, la erosión recorta un píxel en cada extremo de los tramos horizontales y borra el punto suelto, pero deja intacto el resto.');

    const desplazar = (src, dx, dy) => {
      const out = I.crear(w, h);
      // Lo que cae fuera de la imagen cuenta como fondo.
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = x - dx, Y = y - dy;
        out.d[y * w + x] = X >= 0 && Y >= 0 && X < w && Y < h ? src.d[Y * w + X] : 0;
      }
      return out;
    };
    function iniciar() {
      ee = I.elemento(tipoEE, 1);
      acum = I.crear(w, h, modo === 'dilatar' ? 0 : 1);
      actual = null; b = null; k = -1;
      mensaje = modo === 'dilatar'
        ? 'A ⊕ B = ⋃ (A + b) para b ∈ B. Se parte del conjunto vacío.'
        : 'A ⊖ B = ⋂ (A − b) para b ∈ B. Se parte de la imagen completa.';
      return (function* () {
        for (k = 0; k < ee.length; k++) {
          b = ee[k];
          const s = modo === 'dilatar' ? 1 : -1;
          actual = desplazar(A, s * b[0], s * b[1]);
          const antes = I.contar(acum);
          acum = modo === 'dilatar' ? I.union(acum, actual) : I.interseccion(acum, actual);
          const dif = Math.abs(I.contar(acum) - antes);
          mensaje = `${modo === 'dilatar' ? 'A + b' : 'A − b'} con b = (${b[0]}, ${b[1]}): ${modo === 'dilatar' ? 'agrega' : 'quita'} ${dif} píxel${dif === 1 ? '' : 'es'}.`;
          yield;
        }
        actual = null; b = null;
        mensaje = `Terminado: ${ee.length} traslaciones. El resultado tiene ${I.contar(acum)} píxeles (A tiene ${I.contar(A)}).`;
      })();
    }
    function dibujar() {
      if (!acum) return;
      const { ctx, ancho } = lienzo;
      lienzo.limpiar();
      const anchoImg = Math.min(ancho * 0.75, 420), esc = anchoImg / w;
      const sup = VIZ.rgb(C.superficie), s1 = VIZ.enRampa(0.55, [C.superficie, C.s1]);
      I.dibujar(ctx, acum, 0, 2, anchoImg, esc * h, { rejilla: true, pixel: (i) => (acum.d[i] ? s1 : sup) });
      if (actual) {
        ctx.save();
        ctx.fillStyle = VIZ.alfa(C.s2, 0.75);
        for (let i = 0; i < w * h; i++) if (actual.d[i]) ctx.fillRect((i % w) * esc + esc * 0.3, 2 + ((i / w) | 0) * esc + esc * 0.3, esc * 0.4, esc * 0.4);
        ctx.restore();
      }
      // Contorno de A original.
      ctx.save();
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!A.d[y * w + x]) continue;
        const X = x * esc, Y = 2 + y * esc;
        if (!(y > 0 && A.d[(y - 1) * w + x])) { ctx.moveTo(X, Y); ctx.lineTo(X + esc, Y); }
        if (!(y < h - 1 && A.d[(y + 1) * w + x])) { ctx.moveTo(X, Y + esc); ctx.lineTo(X + esc, Y + esc); }
        if (!(x > 0 && A.d[y * w + x - 1])) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + esc); }
        if (!(x < w - 1 && A.d[y * w + x + 1])) { ctx.moveTo(X + esc, Y); ctx.lineTo(X + esc, Y + esc); }
      }
      ctx.stroke();
      ctx.restore();
      // Elemento estructurante a la derecha.
      const e = Math.min(26, (ancho - anchoImg - 24) / 3), x0 = anchoImg + 24, y0 = 24;
      ctx.save();
      ctx.font = VIZ.fuente(11);
      ctx.fillStyle = C.tinta2;
      ctx.textBaseline = 'bottom';
      ctx.fillText('B', x0, y0 - 6);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const dentro = ee.some(([a, c]) => a === dx && c === dy), esActual = b && b[0] === dx && b[1] === dy;
        ctx.fillStyle = esActual ? C.s7 : dentro ? C.tinta : C.superficie;
        ctx.fillRect(x0 + (dx + 1) * e, y0 + (dy + 1) * e, e - 2, e - 2);
        ctx.strokeStyle = C.eje;
        ctx.strokeRect(x0 + (dx + 1) * e + 0.5, y0 + (dy + 1) * e + 0.5, e - 3, e - 3);
      }
      ctx.strokeStyle = C.s2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x0 + 1.5 * e - 1, y0 + 1.5 * e - 1, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      registro.textContent = mensaje;
      lectura.set([
        ['traslación', `${Math.max(0, Math.min(k + 1, ee.length))} de ${ee.length}`],
        ['píxeles de A', String(I.contar(A))],
        ['píxeles del resultado', String(I.contar(acum))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('morfologia', {
    intro: String.raw`
      <p>La <strong>morfología matemática</strong> trata una imagen binaria como un conjunto de píxeles y la modifica con un
      <em>elemento estructurante</em> \(B\): una forma pequeña que se pasea por la imagen. Si \(B\) cabe dentro del objeto,
      el píxel sobrevive a la <strong>erosión</strong>; si \(B\) toca el objeto, el píxel se agrega en la
      <strong>dilatación</strong>.</p>
      <p>Combinando estas dos operaciones se limpia el resultado de una segmentación: se borran granos de ruido, se cierran
      grietas, se rellenan agujeros, se extrae el contorno para medir el perímetro y se reduce una forma a su
      <strong>esqueleto</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Operaciones sobre una imagen binaria',
        descripcion: 'A la izquierda la imagen original, a la derecha el resultado con los cambios en color. Pruebe la apertura con radio 1: borra los granos sueltos sin cambiar las formas grandes.',
        montar: montarOperaciones,
      },
      {
        titulo: 'Dilatación como unión de traslaciones',
        descripcion: 'La dilatación junta copias de A desplazadas por cada píxel de B; la erosión se queda con lo común a todas las copias desplazadas en sentido contrario.',
        montar: montarTraslaciones,
      },
    ],
    teoria: String.raw`
      <h2>Dilatación y erosión</h2>
      <p>Sea \(A \subset \mathbb{Z}^2\) el conjunto de píxeles del objeto y \(B\) el elemento estructurante, con su origen en
      el centro. Con \(A_b = \{a + b : a \in A\}\) la traslación de \(A\) por \(b\):</p>
      \[ A \oplus B = \bigcup_{b \in B} A_b = \{ z : (\hat B)_z \cap A \neq \emptyset \}, \qquad
         A \ominus B = \bigcap_{b \in B} A_{-b} = \{ z : B_z \subseteq A \}, \]
      <p>donde \(\hat B = \{-b : b \in B\}\) es la reflexión de \(B\). La dilatación crece el objeto y la erosión lo adelgaza.
      Son <em>duales</em>: erosionar el objeto equivale a dilatar el fondo, \((A \ominus B)^c = A^c \oplus \hat B\).</p>
      <h2>Apertura y cierre</h2>
      \[ A \circ B = (A \ominus B) \oplus B, \qquad A \bullet B = (A \oplus B) \ominus B. \]
      <ul>
        <li>La <strong>apertura</strong> es la unión de todas las copias de \(B\) que caben en \(A\): borra lo que es más
        delgado que \(B\) (granos, puentes finos) y conserva lo demás.</li>
        <li>El <strong>cierre</strong> rellena lo que es más angosto que \(B\) en el fondo: grietas, picaduras, separaciones pequeñas.</li>
        <li>Ambas son <em>idempotentes</em>: \((A \circ B) \circ B = A \circ B\). Repetirlas no cambia nada.</li>
      </ul>
      <h2>Operaciones derivadas</h2>
      <table>
        <tr><th>Operación</th><th>Definición</th><th>Uso</th></tr>
        <tr><td>Perímetro</td><td>\(A - (A \ominus B_{\text{cruz}})\)</td><td>contorno de un píxel de ancho; su tamaño estima el perímetro</td></tr>
        <tr><td>Relleno</td><td>\(A \cup (\text{fondo no alcanzable desde el borde})\)</td><td>cerrar agujeros de los objetos</td></tr>
        <tr><td>Limpieza</td><td>quitar las componentes conexas de área \(&lt; a_{\min}\)</td><td>eliminar ruido de la segmentación</td></tr>
        <tr><td>Unión</td><td>\(A \cup S\)</td><td>combinar dos segmentaciones</td></tr>
        <tr><td>Esqueleto</td><td>adelgazamiento iterativo que preserva la conexión</td><td>describir la forma con líneas de un píxel</td></tr>
      </table>
      <p>El relleno se calcula con un recorrido desde los píxeles de fondo del borde de la imagen
      (ver <a href="tema.html?id=region-growing">crecimiento de regiones</a>): lo que no se alcanza es un agujero.</p>
      <h2>Esqueletización de Zhang y Suen</h2>
      <p>Para cada píxel de objeto \(p_1\) con vecinos \(p_2, \dots, p_9\) en el sentido de las agujas del reloj desde arriba,
      sea \(N\) el número de vecinos de objeto y \(T\) el número de transiciones \(0 \to 1\) en la secuencia
      \(p_2, p_3, \dots, p_9, p_2\). En dos subiteraciones alternadas se borran los píxeles con</p>
      \[ 2 \le N \le 6, \qquad T = 1, \qquad p_2 p_4 p_6 = 0 \text{ y } p_4 p_6 p_8 = 0 \ \ (\text{o } p_2 p_4 p_8 = 0 \text{ y } p_2 p_6 p_8 = 0), \]
      <p>hasta que nada cambia. \(T = 1\) garantiza que borrar el píxel no corta la forma, y \(N \ge 2\) que no se acortan
      los extremos.</p>
      <h2>Costo</h2>
      <p>Dilatar o erosionar cuesta \(O(N\,|B|)\) para \(N\) píxeles. Un elemento cuadrado es separable (un segmento
      horizontal y uno vertical), lo que baja el costo a \(O(N\,\sqrt{|B|})\). Estas operaciones se generalizan a imágenes en
      grises reemplazando unión e intersección por máximo y mínimo.</p>`,
  });
})();
