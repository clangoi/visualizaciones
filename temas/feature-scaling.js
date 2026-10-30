(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const ESCALAS = [['ninguna', 'Sin escalar'], ['minmax', 'Min-max a [0, 1]'], ['z', 'Estandarizar (z)'], ['robusta', 'Robusta (mediana, IQR)']];
  // Devuelve la transformación v → v' ajustada a la columna.
  function ajustar(col, tipo) {
    if (tipo === 'minmax') { const a = Math.min(...col), b = Math.max(...col); return (v) => (v - a) / (b - a || 1); }
    if (tipo === 'z') { const m = M.media(col), s = M.desv(col) || 1; return (v) => (v - m) / s; }
    if (tipo === 'robusta') { const m = M.cuantil(col, 0.5), r = M.cuantil(col, 0.75) - M.cuantil(col, 0.25) || 1; return (v) => (v - m) / r; }
    return (v) => v;
  }

  /* ---------- Fig. 1: vecinos según la escala ---------- */

  function montarVecinos(cuerpo) {
    let escala = 'ninguna', k = 5, semilla = 2, q = 0, datos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escalamiento', opciones: ESCALAS, valor: escala, alCambiar: (v) => { escala = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Vecinos k', min: 1, max: 15, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 480 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'segmento A', forma: 'punto' }, { color: C.s2, texto: 'segmento B' },
      { color: C.s4, texto: 'k vecinos del punto elegido', forma: 'linea' }, { color: C.tinta, texto: 'punto elegido', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los ejes usan la misma unidad en horizontal y vertical: es el espacio que «ve» la distancia euclidiana. Haga clic en un punto para elegirlo.');

    function generar() {
      const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
      datos = [];
      for (let i = 0; i < 70; i++) {
        const g = i % 2;
        // El segmento lo decide la edad; el ingreso varía mucho dentro de ambos.
        datos.push({ edad: Math.round((g ? 52 : 30) + N() * 6), ingreso: Math.round(1300 + N() * 550), g });
      }
      q = 0;
      dibujar();
    }
    let plano = null, P = [];
    function dibujar() {
      const fe = ajustar(datos.map((d) => d.edad), escala), fi = ajustar(datos.map((d) => d.ingreso), escala);
      P = datos.map((d) => ({ x: fe(d.edad), y: fi(d.ingreso), g: d.g }));
      const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const mg = { izq: 58, der: 16, sup: 26, inf: 44 };
      const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.55;
      const asp = (W - mg.izq - mg.der) / (H - mg.sup - mg.inf);
      const rx = asp >= 1 ? r * asp : r, ry = asp >= 1 ? r : r / asp;
      plano = VIZ.plano(lienzo, { xmin: cx - rx, xmax: cx + rx, ymin: cy - ry, ymax: cy + ry },
        { etiquetaX: escala === 'ninguna' ? 'edad (años)' : 'edad escalada', etiquetaY: escala === 'ninguna' ? 'ingreso (miles $)' : 'ingreso escalado', margen: mg });
      plano.ejes();
      const d = P.map((p, i) => [i, Math.hypot(p.x - P[q].x, p.y - P[q].y)]).filter(([i]) => i !== q).sort((a, b) => a[1] - b[1]).slice(0, k);
      ctx.save(); plano.recortar();
      for (const [i] of d) VIZ.trazar(ctx, plano, [[P[q].x, P[q].y], [P[i].x, P[i].y]], C.s4, 1.5);
      ctx.restore();
      M.dispersion(ctx, plano, P, { color: (p) => (p.g ? C.s2 : C.s1), forma: (p) => p.g, anillo: (p, i) => (d.some(([j]) => j === i) ? C.s4 : null) });
      VIZ.marcador(ctx, plano.sx(P[q].x), plano.sy(P[q].y), C.tinta, 6, P[q].g);
      const iguales = d.filter(([i]) => P[i].g === P[q].g).length;
      const de = P.map((p) => p.x), di = P.map((p) => p.y);
      lectura.set([
        ['vecinos del mismo segmento', `${iguales} de ${k}`],
        ['desviación de edad', VIZ.fmt(M.desv(de), 3)],
        ['desviación de ingreso', VIZ.fmt(M.desv(di), 3)],
        ['peso del ingreso en d²', M.pct(M.varianza(di) / (M.varianza(di) + M.varianza(de)), 0)],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const cerca = (x, y) => { let m = -1, dm = 12; P.forEach((p, i) => { const dd = Math.hypot(plano.sx(p.x) - x, plano.sy(p.y) - y); if (dd < dm) { dm = dd; m = i; } }); return m; };
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), i = cerca(x, y); if (i >= 0) { q = i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = plano ? cerca(x, y) : -1;
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `edad <b>${datos[i].edad}</b><br>ingreso <b>${VIZ.entero(datos[i].ingreso)}</b><br>segmento <b>${datos[i].g ? 'B' : 'A'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: el efecto de los valores atípicos ---------- */

  function montarAtipicos(cuerpo) {
    let atipicos = 3, semilla = 4, base = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Valores atípicos', min: 0, max: 15, valor: atipicos, alCambiar: (v) => { atipicos = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 3 * 104 + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'datos típicos' }, { color: C.s8, texto: 'valores atípicos' }, { color: C.apagado, texto: 'rango intercuartílico de los típicos', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Agregue valores atípicos: min-max aplasta a los datos típicos contra el cero, la estandarización los aprieta algo menos y la versión robusta casi no cambia. Pase el cursor sobre una fila.');
    function generar() {
      const rnd = VIZ.semilla(semilla);
      base = Array.from({ length: 200 }, () => 50 + VIZ.normal(rnd) * 8);
      dibujar();
    }
    let filas = [];
    function dibujar() {
      const ext = Array.from({ length: atipicos }, (_, i) => 160 + i * 23);
      const col = [...base, ...ext];
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      filas = [];
      // Eje común [−2, 4] para las tres filas: así se ve cuánto espacio queda para los datos típicos.
      const LO = -2, HI = 4;
      ESCALAS.slice(1).forEach(([tipo, nombre], r) => {
        const f = ajustar(col, tipo), v = col.map(f), max = Math.max(...v);
        const y0 = 8 + r * 104, alto = 62, izq = 12, der = W - 40;
        const sx = (x) => izq + ((x - LO) / (HI - LO)) * (der - izq);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(nombre, izq, y0);
        // Histograma de cubetas de ancho 0,05; lo que sale del eje se cuenta a la derecha.
        const B = 120, bw = (der - izq) / B, cuenta = new Array(B).fill(0), cat = new Array(B).fill(0);
        let fuera = 0;
        v.forEach((x, i) => {
          if (x > HI) { fuera++; return; }
          const b = Math.max(0, Math.min(B - 1, Math.floor(((x - LO) / (HI - LO)) * B)));
          cuenta[b]++; if (i >= base.length) cat[b]++;
        });
        const mx = Math.max(...cuenta), by = y0 + 18 + alto;
        cuenta.forEach((c, b) => {
          if (!c) return;
          const h = (c / mx) * alto;
          ctx.fillStyle = cat[b] ? C.s8 : C.s1;
          ctx.beginPath(); ctx.roundRect(izq + b * bw, by - Math.max(2, h), Math.max(1, bw - 0.5), Math.max(2, h), [1, 1, 0, 0]); ctx.fill();
        });
        ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, by + 0.5); ctx.lineTo(der, by + 0.5); ctx.stroke();
        if (fuera) {
          ctx.fillStyle = C.s8; ctx.beginPath(); ctx.moveTo(der + 4, by - 10); ctx.lineTo(der + 12, by - 5); ctx.lineTo(der + 4, by); ctx.fill();
          ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`${fuera}`, der + 14, by);
          ctx.fillStyle = C.apagado; ctx.textBaseline = 'top'; ctx.fillText(`→ ${VIZ.fmt(max, 3)}`, der - 16, by + 9);
        }
        const q1 = f(M.cuantil(base, 0.25)), q3 = f(M.cuantil(base, 0.75));
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(q1), by + 5); ctx.lineTo(Math.max(sx(q3), sx(q1) + 2), by + 5); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'top'; ctx.textAlign = 'center';
        for (let t = LO; t <= HI; t++) if (t < HI || !fuera) ctx.fillText(String(t).replace('-', '−'), sx(t), by + 9);
        filas.push({ y0, y1: y0 + 100, nombre, ancho: q3 - q1, f, max });
      });
      lectura.set(filas.map((fl) => [`IQR de los típicos · ${fl.nombre.split(' ')[0].toLowerCase()}`, VIZ.fmt(fl.ancho, 3)]));
    }
    lienzo.alDibujar = () => base.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), fl = filas.find((f) => y >= f.y0 && y < f.y1);
      if (!fl) return tip.ocultar();
      tip.mostrar(x, y, `${fl.nombre}<br>mediana típica → <b>${VIZ.fmt(fl.f(M.cuantil(base, 0.5)), 3)}</b><br>máximo <b>${VIZ.fmt(fl.max, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('feature-scaling', {
    intro: String.raw`
      <p>Una distancia suma diferencias de todas las características. Si una se mide en años (del orden de decenas) y otra en
      pesos (del orden de miles), la segunda decide sola quién es vecino de quién, aunque no tenga nada que ver con el problema.</p>
      <p>El <strong>escalamiento</strong> pone todas las columnas en rangos comparables antes de medir distancias, entrenar
      un modelo por descenso de gradiente o aplicar <a href="tema.html?id=pca">PCA</a>. Hay varias formas, y difieren sobre todo en
      cómo reaccionan ante valores extremos.</p>`,
    visualizaciones: [
      {
        titulo: 'Vecinos según la escala',
        descripcion: 'El segmento de cada cliente depende de su edad. Sin escalar, el ingreso domina la distancia y los vecinos salen de ambos segmentos; pruebe min-max o z.',
        montar: montarVecinos,
      },
      {
        titulo: 'El efecto de los valores atípicos',
        descripcion: 'La misma columna con tres escalamientos, sobre un eje común. La barra gris es el rango intercuartílico de los datos típicos: mire cuánto se angosta al agregar atípicos.',
        montar: montarAtipicos,
      },
    ],
    teoria: String.raw`
      <h2>Las tres transformaciones</h2>
      <p>Para una columna \(x_1, \dots, x_n\):</p>
      \[ \text{min-max: } x' = \frac{x - \min x}{\max x - \min x}, \qquad
         \text{z: } x' = \frac{x - \bar x}{s}, \qquad
         \text{robusta: } x' = \frac{x - \operatorname{mediana}(x)}{Q_3 - Q_1}. \]
      <p>Todas son afines (\(x' = (x - a)/b\)): no cambian la forma de la distribución, solo su posición y su escala. Lo que
      cambia es qué estadístico define \(a\) y \(b\):</p>
      <table>
        <tr><th>Método</th><th>Resultado</th><th>Sensibilidad a atípicos</th></tr>
        <tr><td>Min-max</td><td>rango exacto \([0, 1]\)</td><td>muy alta: un solo extremo fija \(b\)</td></tr>
        <tr><td>z (estandarizar)</td><td>media 0, desviación 1</td><td>media: \(s\) crece con el cuadrado de las desviaciones</td></tr>
        <tr><td>Robusta</td><td>mediana 0, IQR 1</td><td>baja: punto de quiebre del 25 %</td></tr>
      </table>
      <h2>Por qué importa para las distancias</h2>
      <p>La distancia euclidiana al cuadrado se descompone por columnas, \(d^2(x, y) = \sum_j (x_j - y_j)^2\). Si las diferencias
      son independientes, su valor esperado es \(\sum_j 2\sigma_j^2\): cada columna pesa en proporción a su varianza. Estandarizar
      iguala \(\sigma_j = 1\) y da a todas el mismo peso a priori.</p>
      <div class="recuadro"><p>Los parámetros de escala (mínimo, media, IQR…) se calculan <strong>solo con los datos de
      entrenamiento</strong> y se aplican tal cual a los datos nuevos; calcularlos sobre todo el conjunto filtra información
      de la validación.</p></div>
      <h2>Normalizar filas</h2>
      <p>Otra operación distinta es normalizar cada <em>vector</em> a norma 1, \(x' = x/\lVert x\rVert\). Después de eso, la distancia
      euclidiana y la <a href="tema.html?id=distance-metrics">similitud coseno</a> ordenan igual: \(\lVert x' - y'\rVert^2 = 2 - 2\cos(x, y)\).</p>
      <h2>Cuándo no escalar</h2>
      <p>Los árboles de decisión y los métodos basados en rangos no cambian con transformaciones monótonas de cada columna. Y si
      las columnas ya están en la misma unidad (píxeles, conteos de palabras), escalar puede amplificar ruido de columnas casi constantes.</p>`,
  });
})();