(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const forma = (s) => `(None, ${s.join(', ')})`;
  const num = (v) => VIZ.entero(v);

  // Inferencia de forma y parámetros de una capa. ent: forma (arreglo) o arreglo de formas para Add / Concatenate.
  function aplicar(c, ent) {
    const fx = Array.isArray(ent[0]) ? ent : null, e = fx ? null : ent;
    switch (c.t) {
      case 'Input': return { forma: c.forma, params: 0 };
      case 'Conv2D': {
        if (e.length !== 3) return { error: `Conv2D espera un tensor (alto, ancho, canales) y recibe ${forma(e)}` };
        const [H, W, K] = e, p = c.pad === 'same' ? [H, W] : [H - c.k + 1, W - c.k + 1];
        if (p[0] < 1 || p[1] < 1) return { error: `el kernel ${c.k}×${c.k} no cabe en una imagen de ${H}×${W} con padding «valid»` };
        return { forma: [...p, c.f], params: (c.k * c.k * K + 1) * c.f };
      }
      case 'MaxPooling2D': {
        if (e.length !== 3) return { error: `MaxPooling2D espera un tensor de 3 ejes y recibe ${forma(e)}` };
        if (e[0] < 2 || e[1] < 2) return { error: 'la imagen ya es demasiado pequeña para otro pooling' };
        return { forma: [Math.floor(e[0] / 2), Math.floor(e[1] / 2), e[2]], params: 0 };
      }
      case 'GlobalAveragePooling2D': return e.length === 3 ? { forma: [e[2]], params: 0 } : { error: 'necesita un tensor de 3 ejes' };
      case 'Flatten': return { forma: [e.reduce((s, v) => s * v, 1)], params: 0 };
      case 'Dense': return { forma: [...e.slice(0, -1), c.n], params: (e[e.length - 1] + 1) * c.n, aviso: e.length > 1 ? 'Dense sobre un tensor de varios ejes se aplica solo al último; normalmente se aplana antes' : null };
      case 'Dropout': return { forma: e, params: 0 };
      case 'BatchNormalization': return { forma: e, params: 4 * e[e.length - 1], fijos: 2 * e[e.length - 1] };
      case 'Add': return fx.every((s) => s.join() === fx[0].join()) ? { forma: fx[0], params: 0 } : { error: `Add exige formas iguales y recibe ${fx.map(forma).join(' y ')}` };
      case 'Concatenate': return fx.every((s) => s.slice(0, -1).join() === fx[0].slice(0, -1).join()) ? { forma: [...fx[0].slice(0, -1), fx.reduce((s, q) => s + q[q.length - 1], 0)], params: 0 } : { error: 'Concatenate exige que coincidan todos los ejes menos el último' };
      default: return { error: 'capa desconocida' };
    }
  }
  const llamada = (c) => ({
    Conv2D: `layers.Conv2D(${c.f}, ${c.k}, padding="${c.pad}"${c.act ? `, activation="${c.act}"` : ''})`, MaxPooling2D: 'layers.MaxPooling2D(2)', GlobalAveragePooling2D: 'layers.GlobalAveragePooling2D()', Flatten: 'layers.Flatten()',
    Dense: `layers.Dense(${c.n}${c.act ? `, activation="${c.act}"` : ''})`, Dropout: `layers.Dropout(${c.p})`, BatchNormalization: 'layers.BatchNormalization()', Add: 'layers.Add()', Concatenate: 'layers.Concatenate()',
  }[c.t]);

  /* ---------- Fig. 1: un modelo Sequential ---------- */

  const BOTONES = [['Conv2D(16)', { t: 'Conv2D', f: 16, k: 3, pad: 'same', act: 'relu' }], ['MaxPooling2D', { t: 'MaxPooling2D' }], ['BatchNormalization', { t: 'BatchNormalization' }], ['Flatten', { t: 'Flatten' }], ['Dense(64)', { t: 'Dense', n: 64, act: 'relu' }], ['Dropout(0,3)', { t: 'Dropout', p: 0.3 }], ['Dense(10, softmax)', { t: 'Dense', n: 10, act: 'softmax' }]];
  const EJEMPLOS = {
    mlp: ['Perceptrón multicapa', [{ t: 'Flatten' }, { t: 'Dense', n: 128, act: 'relu' }, { t: 'Dropout', p: 0.3 }, { t: 'Dense', n: 10, act: 'softmax' }]],
    cnn: ['CNN pequeña', [{ t: 'Conv2D', f: 16, k: 3, pad: 'same', act: 'relu' }, { t: 'MaxPooling2D' }, { t: 'Conv2D', f: 32, k: 3, pad: 'same', act: 'relu' }, { t: 'MaxPooling2D' }, { t: 'Flatten' }, { t: 'Dropout', p: 0.3 }, { t: 'Dense', n: 10, act: 'softmax' }]],
  };

  function montarSecuencial(cuerpo) {
    let entrada = [28, 28, 1], capas = EJEMPLOS.cnn[1].map((c) => ({ ...c })), error = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entrada', opciones: [['28,28,1', 'imagen gris 28×28'], ['32,32,3', 'imagen en color 32×32']], valor: entrada.join(), alCambiar: (v) => { entrada = v.split(',').map(Number); dibujar(); } });
    ctl.selector({ etiqueta: 'Empezar desde', opciones: Object.entries(EJEMPLOS).map(([k, v]) => [k, v[0]]), valor: 'cnn', alCambiar: (v) => { capas = EJEMPLOS[v][1].map((c) => ({ ...c })); error = ''; dibujar(); } });
    BOTONES.forEach(([t, c]) => ctl.boton(`+ ${t}`, () => { capas.push({ ...c }); dibujar(); }));
    ctl.boton('Quitar la última', () => { capas.pop(); dibujar(); });
    ctl.boton('Vaciar', () => { capas = []; dibujar(); });
    const tabla = M.tabla(cuerpo);
    const codigo = VIZ.el('pre', { class: 'caja-desplazable' });
    cuerpo.appendChild(codigo);
    cuerpo.dataset.sinLeyenda = 'tabla y código, sin colores con significado';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Agregue capas con los botones «+»: la tabla (el equivalente de model.summary()) calcula las formas y los parámetros, y marca el primer error de forma, como lo haría Keras al construir el modelo.');
    function dibujar() {
      let f = entrada, tot = 0, fijos = 0, err = null, aviso = null;
      const filas = [[{ texto: 'InputLayer', clase: 'izq' }, forma(f), '0']];
      capas.forEach((c, i) => {
        if (err) { filas.push([{ texto: `${c.t} (no se construye)`, clase: 'izq' }, '—', '—']); return; }
        const r = aplicar(c, f);
        if (r.error) { err = `Capa ${i + 1} (${c.t}): ${r.error}.`; filas.push([{ texto: `${c.t} ✗`, clase: 'izq' }, '—', '—']); return; }
        f = r.forma; tot += r.params; fijos += r.fijos || 0; aviso = aviso || r.aviso;
        filas.push([{ texto: `${c.t}${c.f ? `(${c.f}, ${c.k}×${c.k})` : c.n ? `(${c.n})` : c.p ? `(${c.p})` : ''}`, clase: 'izq' }, forma(f), num(r.params)]);
      });
      tabla.set([{ texto: 'Capa', clase: 'izq' }, 'Forma de salida', 'Parámetros'], [...filas, [{ texto: 'Total', clase: 'izq' }, '', { texto: num(tot), estilo: { fontWeight: 600 } }]]);
      codigo.textContent = `model = keras.Sequential([\n    keras.Input(shape=(${entrada.join(', ')})),\n${capas.map((c) => `    ${llamada(c)},`).join('\n')}\n])\nmodel.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])\nmodel.fit(x_train, y_train, epochs=10, batch_size=32, validation_split=0.1)`;
      registro.textContent = err || aviso || (capas.length ? `El modelo tiene ${capas.length} capas y ${num(tot)} parámetros (${num(tot - fijos)} entrenables y ${num(fijos)} no entrenables de la normalización).` : 'Modelo vacío: agregue capas.');
      lectura.set([['capas', String(capas.length)], ['parámetros', num(tot)], ['memoria de los pesos (float32)', `${VIZ.fmt((tot * 4) / 1024, 3)} KiB`], ['forma de salida', err ? '—' : forma(f)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: la API funcional ---------- */

  const PRESETS = {
    residual: ['Bloque con atajo residual', (f) => [
      { id: 'in', t: 'Input', forma: [32, 32, 3], nombre: 'entrada', e: [] },
      { id: 'x', t: 'Conv2D', f, k: 3, pad: 'same', act: 'relu', e: ['in'] },
      { id: 'y', t: 'Conv2D', f, k: 3, pad: 'same', e: ['x'] },
      { id: 'z', t: 'Add', e: ['x', 'y'] },
      { id: 'g', t: 'GlobalAveragePooling2D', e: ['z'] },
      { id: 'out', t: 'Dense', n: 10, act: 'softmax', e: ['g'] }], 'out'],
    ramas: ['Ramas paralelas (estilo Inception)', (f) => [
      { id: 'in', t: 'Input', forma: [32, 32, 3], nombre: 'entrada', e: [] },
      { id: 'b1', t: 'Conv2D', f, k: 1, pad: 'same', act: 'relu', e: ['in'] },
      { id: 'b3', t: 'Conv2D', f, k: 3, pad: 'same', act: 'relu', e: ['in'] },
      { id: 'b5', t: 'Conv2D', f, k: 5, pad: 'same', act: 'relu', e: ['in'] },
      { id: 'cat', t: 'Concatenate', e: ['b1', 'b3', 'b5'] },
      { id: 'g', t: 'GlobalAveragePooling2D', e: ['cat'] },
      { id: 'out', t: 'Dense', n: 10, act: 'softmax', e: ['g'] }], 'out'],
    dos: ['Dos entradas (imagen y datos)', (f) => [
      { id: 'img', t: 'Input', forma: [28, 28, 1], nombre: 'imagen', e: [] },
      { id: 'meta', t: 'Input', forma: [5], nombre: 'datos', e: [] },
      { id: 'c', t: 'Conv2D', f, k: 3, pad: 'valid', act: 'relu', e: ['img'] },
      { id: 'p', t: 'MaxPooling2D', e: ['c'] },
      { id: 'fl', t: 'Flatten', e: ['p'] },
      { id: 'd1', t: 'Dense', n: 32, act: 'relu', e: ['fl'] },
      { id: 'd2', t: 'Dense', n: 16, act: 'relu', e: ['meta'] },
      { id: 'cat', t: 'Concatenate', e: ['d1', 'd2'] },
      { id: 'out', t: 'Dense', n: 1, act: 'sigmoid', e: ['cat'] }], 'out'],
  };

  function montarFuncional(cuerpo) {
    let clave = 'residual', f = 16, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: Object.entries(PRESETS).map(([k, v]) => [k, v[0]]), valor: clave, alCambiar: (v) => { clave = v; lienzo.ajustar(true); } });
    ctl.rango({ etiqueta: 'Filtros por convolución', min: 4, max: 64, paso: 4, valor: f, alCambiar: (v) => { f = v; dibujar(); } });
    const nivelesDe = () => { const nodos = PRESETS[clave][1](f), niv = new Map(); nodos.forEach((n) => { niv.set(n.id, n.e.length ? 1 + Math.max(...n.e.map((i) => niv.get(i))) : 0); }); const cuenta = {}; niv.forEach((v) => { cuenta[v] = (cuenta[v] || 0) + 1; }); return { niveles: Math.max(...niv.values()) + 1, maxAncho: Math.max(...Object.values(cuenta)) }; };
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const { niveles, maxAncho } = nivelesDe(); return w > 620 ? 90 + 62 * maxAncho : 40 + niveles * 74; } });
    const tip = VIZ.tooltip(lienzo);
    const codigo = VIZ.el('pre', { class: 'caja-desplazable' });
    cuerpo.appendChild(codigo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'entrada', forma: 'cuadro' }, { color: C.s1, texto: 'capa con parámetros', forma: 'cuadro' }, { color: C.s3, texto: 'capa sin parámetros', forma: 'cuadro' }, { color: C.s7, texto: 'une dos o más ramas', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En la API funcional cada capa se llama sobre un tensor y devuelve otro: el modelo es un grafo, no una lista. Eso permite atajos, ramas y varias entradas, que Sequential no puede expresar. Pase el cursor por una caja para ver su forma.');
    function dibujar() {
      const nodos = PRESETS[clave][1](f), mapa = new Map(nodos.map((n) => [n.id, n]));
      let tot = 0, err = null;
      nodos.forEach((n) => { if (err) return; const r = n.t === 'Input' ? { forma: n.forma, params: 0 } : aplicar(n, n.e.length > 1 ? n.e.map((i) => mapa.get(i).forma) : mapa.get(n.e[0]).forma); if (r.error) { err = `${n.t}: ${r.error}`; return; } n.forma = r.forma; n.params = r.params; tot += r.params; });
      nodos.forEach((n) => { n.nivel = n.e.length ? 1 + Math.max(...n.e.map((i) => mapa.get(i).nivel)) : 0; });
      const niveles = Math.max(...nodos.map((n) => n.nivel)) + 1, { ctx, ancho: W, alto: H } = lienzo, ancha = W > 620;
      lienzo.limpiar(); geo = [];
      const cont = Array(niveles).fill(0), tot_n = Array(niveles).fill(0);
      nodos.forEach((n) => { tot_n[n.nivel]++; });
      const bw = ancha ? Math.min(150, W / niveles - 24) : Math.min(120, W / 3), bh = 44;
      nodos.forEach((n) => {
        const k = cont[n.nivel]++, m = tot_n[n.nivel];
        n.x = ancha ? 12 + n.nivel * ((W - 24 - bw) / Math.max(1, niveles - 1)) : (W - bw) / 2 + (k - (m - 1) / 2) * (bw + 12);
        n.y = ancha ? (H - 20) * ((k + 0.5) / m) - bh / 2 + 10 : 12 + n.nivel * ((H - 24 - bh) / Math.max(1, niveles - 1));
      });
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.6; ctx.fillStyle = C.apagado;
      nodos.forEach((n) => n.e.forEach((i) => {
        const a = mapa.get(i), x1 = ancha ? a.x + bw : a.x + bw / 2, y1 = ancha ? a.y + bh / 2 : a.y + bh, x2 = ancha ? n.x : n.x + bw / 2, y2 = ancha ? n.y + bh / 2 : n.y;
        const salto = n.nivel - a.nivel > 1, dz = salto ? -(ancha ? 46 : 0) : 0, dx = salto && !ancha ? 70 : 0;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(ancha ? (x1 + x2) / 2 : x1 + dx, (ancha ? y1 : (y1 + y2) / 2) + dz, ancha ? (x1 + x2) / 2 : x2 + dx, (ancha ? y2 : (y1 + y2) / 2) + dz, x2, y2); ctx.stroke();
        const a1 = Math.atan2(ancha ? 0 : 1, ancha ? 1 : 0); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 7 * Math.cos(a1) + 4 * Math.sin(a1), y2 - 7 * Math.sin(a1) - 4 * Math.cos(a1)); ctx.lineTo(x2 - 7 * Math.cos(a1) - 4 * Math.sin(a1), y2 - 7 * Math.sin(a1) + 4 * Math.cos(a1)); ctx.fill();
      }));
      nodos.forEach((n) => {
        const col = n.t === 'Input' ? C.s6 : n.e.length > 1 ? C.s7 : n.params ? C.s1 : C.s3;
        ctx.fillStyle = VIZ.alfa(col, 0.2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(n.x, n.y, bw, bh, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((n.nombre || n.t).replace('GlobalAveragePooling2D', 'GlobalAvgPool2D'), n.x + bw / 2, n.y + 14);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(n.forma ? forma(n.forma).replace('None, ', '') : '', n.x + bw / 2, n.y + 30);
        geo.push({ n, bw, bh });
      });
      const nom = new Map(nodos.map((n, i) => [n.id, n.t === 'Input' ? n.id : `x${i}`]));
      const lineas = nodos.map((n) => n.t === 'Input' ? `${nom.get(n.id)} = keras.Input(shape=(${n.forma.join(', ')},), name="${n.nombre}")` : `${nom.get(n.id)} = ${llamada(n)}(${n.e.length > 1 ? `[${n.e.map((i) => nom.get(i)).join(', ')}]` : nom.get(n.e[0])})`);
      const ins = nodos.filter((n) => n.t === 'Input').map((n) => n.id);
      codigo.textContent = `${lineas.join('\n')}\nmodel = keras.Model(inputs=${ins.length > 1 ? `[${ins.join(', ')}]` : ins[0]}, outputs=${nom.get(PRESETS[clave][2])})`;
      registro.textContent = err || `El grafo tiene ${nodos.length} nodos, ${nodos.filter((n) => n.e.length > 1).length} de ellos unen ramas, y ${num(tot)} parámetros en total.`;
      lectura.set([['nodos', String(nodos.length)], ['entradas', String(ins.length)], ['parámetros', num(tot)], ['forma de la salida', forma(mapa.get(PRESETS[clave][2]).forma || [])]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.n.x && x <= q.n.x + q.bw && y >= q.n.y && y <= q.n.y + q.bh);
      if (g) tip.mostrar(x, y, `<b>${g.n.nombre || g.n.t}</b><br>salida ${forma(g.n.forma || [])}<br>parámetros ${num(g.n.params || 0)}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('keras-models', {
    intro: String.raw`
      <p><strong>Keras</strong> es la interfaz de alto nivel con la que se define, entrena y evalúa una red en unas pocas líneas. Ofrece dos maneras de definir un modelo. La API <strong>Sequential</strong> apila capas en línea recta: es la más corta y sirve para la mayoría de los casos simples.
      La API <strong>funcional</strong> trata cada capa como una función sobre tensores, y construye un grafo: permite atajos residuales, ramas paralelas y varias entradas o salidas.</p>
      <p>En ambos casos Keras infiere las formas de los tensores y cuenta los parámetros al construir el modelo, lo que ayuda a detectar errores de forma antes de entrenar.</p>`,
    visualizaciones: [
      { titulo: 'Construir un modelo Sequential', descripcion: 'Agregue capas y observe cómo cambian las formas y el número de parámetros. Intente poner Conv2D después de Flatten o demasiados MaxPooling2D.', montar: montarSecuencial },
      { titulo: 'La API funcional', descripcion: 'Elija un modelo con atajo, con ramas o con dos entradas, cambie los filtros y lea el código que lo define.', montar: montarFuncional },
    ],
    teoria: String.raw`
      <h2>Ciclo de trabajo</h2>
      <pre><code>model = keras.Sequential([...])        # o keras.Model(inputs, outputs)
model.compile(optimizer="adam",
              loss="sparse_categorical_crossentropy",
              metrics=["accuracy"])
history = model.fit(x_train, y_train, epochs=10,
                    batch_size=32, validation_split=0.1)
model.evaluate(x_test, y_test)
model.predict(x_nuevos)</code></pre>
      <p>\(\texttt{compile}\) fija el optimizador, la <a href="tema.html?id=loss-functions-mle">función de pérdida</a> y las métricas; \(\texttt{fit}\) ejecuta el bucle de <a href="tema.html?id=sgd-minibatch">mini-lotes</a> y la retropropagación; <code>history</code> guarda las <a href="tema.html?id=learning-curves">curvas de aprendizaje</a>.</p>
      <h2>Cuántos parámetros</h2>
      <table>
        <tr><th>Capa</th><th>Parámetros</th></tr>
        <tr><td>\(\texttt{Dense}(n)\) con entrada \(d\)</td><td>\((d+1)\,n\)</td></tr>
        <tr><td>\(\texttt{Conv2D}(f, k)\) con \(C\) canales de entrada</td><td>\((k^2 C + 1)\,f\)</td></tr>
        <tr><td>\(\texttt{BatchNormalization}\) con \(C\) canales</td><td>\(4C\) (\(2C\) entrenables)</td></tr>
        <tr><td>\(\texttt{MaxPooling2D}\), \(\texttt{Flatten}\), \(\texttt{Dropout}\), \(\texttt{Add}\), \(\texttt{Concatenate}\)</td><td>0</td></tr>
      </table>
      <h2>Sequential o funcional</h2>
      <ul>
        <li><strong>Sequential:</strong> una entrada, una salida, cada capa recibe exactamente la salida de la anterior.</li>
        <li><strong>Funcional:</strong> cualquier grafo acíclico. Imprescindible para <a href="tema.html?id=cnn-architectures">conexiones residuales</a>, ramas Inception, modelos con varias entradas (imagen + metadatos) o varias salidas.</li>
        <li><strong>Subclases de <code>Model</code>:</strong> para lógica completamente personalizada en el método <code>call</code>.</li>
      </ul>
      <div class="recuadro"><p>Un modelo preentrenado se carga con una línea, p. ej. <code>keras.applications.ResNet50(weights="imagenet", include_top=False)</code>, y se le agrega una cabeza propia (<a href="tema.html?id=transfer-learning">Transfer Learning</a>). Con una GPU disponible, Keras la usa automáticamente (<a href="tema.html?id=gpu-training">GPU Training</a>).</p></div>`,
  });
})();
