(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Fig. 1: búsqueda paso a paso ---------- */

  function montarBusqueda(cuerpo) {
    let n = 24, semilla = 3, arreglo = [], objetivo = 0;
    let lo, hi, mid, historial, estado; // estado: 'buscando' | 'encontrado' | 'ausente'

    function nuevoArreglo() {
      const rnd = VIZ.semilla(semilla * 31 + n);
      arreglo = [];
      let v = Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        v += 1 + Math.floor(rnd() * 5);
        arreglo.push(v);
      }
      sObjetivo.input.max = arreglo[n - 1] + 2;
      objetivo = arreglo[Math.floor(rnd() * n)];
      sObjetivo.valor = objetivo;
    }

    function reiniciar() {
      bucle.detener();
      lo = 0; hi = arreglo.length - 1; mid = -1;
      historial = [];
      estado = 'buscando';
      dibujar();
    }

    function paso() {
      if (estado !== 'buscando') return false;
      if (lo > hi) {
        estado = 'ausente';
        mid = -1;
        historial.push(`lo = ${lo} > hi = ${hi}: el intervalo quedó vacío → ${objetivo} no está en el arreglo`);
        return false;
      }
      mid = lo + ((hi - lo) >> 1);
      const v = arreglo[mid];
      const k = historial.length + 1;
      if (v === objetivo) {
        estado = 'encontrado';
        historial.push(`${k}. mid = ${mid}, a[mid] = ${v} = ${objetivo} → encontrado`);
        return false;
      }
      if (v < objetivo) {
        historial.push(`${k}. mid = ${mid}, a[mid] = ${v} < ${objetivo} → lo = ${mid + 1}`);
        lo = mid + 1;
      } else {
        historial.push(`${k}. mid = ${mid}, a[mid] = ${v} > ${objetivo} → hi = ${mid - 1}`);
        hi = mid - 1;
      }
      return true;
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño n', min: 4, max: 64, valor: n, alCambiar: (v) => { n = v; nuevoArreglo(); reiniciar(); } });
    const sObjetivo = ctl.rango({ etiqueta: 'Valor buscado', min: 0, max: 400, valor: 0,
      alCambiar: (v) => { objetivo = v; reiniciar(); } });
    const bPlay = ctl.boton('Ejecutar', () => {
      if (bucle.activo) return bucle.detener();
      if (estado !== 'buscando') reiniciar();
      bPlay.textContent = 'Pausar';
      espera = 0;
      bucle.iniciar();
    }, { primario: true });
    ctl.boton('Un paso', () => { bucle.detener(); paso(); dibujar(); });
    ctl.boton('Reiniciar', reiniciar);
    ctl.boton('Nuevo arreglo', () => { semilla++; nuevoArreglo(); reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => calcularAlto(w) });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta, texto: 'intervalo [lo, hi]' },
      { color: C.s1, texto: 'mid: elemento consultado' },
      { color: C.s6, texto: 'encontrado' },
      { color: C.neutro, texto: 'descartado' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda para buscar su valor. Mueva el control «valor buscado» a un número que no esté en el arreglo para ver cómo termina una búsqueda fallida.');

    let espera = 0;
    const bucle = VIZ.bucle((dt) => {
      espera -= dt;
      if (espera > 0) return true;
      espera = 650;
      const sigue = paso();
      dibujar();
      return sigue;
    }, () => { bPlay.textContent = 'Ejecutar'; });

    const disposicion = (w) => {
      const celda = Math.max(30, Math.min(52, Math.floor((w - 8) / Math.min(arreglo.length, 16))));
      const porFila = Math.max(1, Math.floor((w - 8) / celda));
      const filas = Math.ceil(arreglo.length / porFila);
      return { celda, porFila, filas, altoFila: celda + 34 };
    };
    function calcularAlto(w) {
      if (!arreglo.length) return 120;
      const d = disposicion(w);
      return d.filas * d.altoFila + 10;
    }

    let geo = null;
    function dibujar() {
      if (lienzo.alto !== calcularAlto(lienzo.ancho)) { lienzo.ajustar(true); return; }
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const d = disposicion(W);
      const ox = Math.max(4, (W - d.porFila * d.celda) / 2);
      geo = { ...d, ox };
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < arreglo.length; i++) {
        const fila = Math.floor(i / d.porFila), col = i % d.porFila;
        const x = ox + col * d.celda, y = fila * d.altoFila + 18;
        const s = d.celda - 4;
        const enRango = i >= lo && i <= hi && estado === 'buscando';
        let fondo = C.neutro, borde = C.neutro, texto = C.inactivo;
        if (enRango || (estado !== 'buscando' && i === mid)) { fondo = C.superficie; borde = C.tinta; texto = C.tinta; }
        if (estado === 'ausente') { fondo = C.neutro; borde = C.eje; texto = C.inactivo; }
        if (i === mid && estado === 'buscando') { fondo = C.s1; borde = C.s1; texto = C.sobre; }
        if (i === mid && estado === 'encontrado') { fondo = C.s6; borde = C.s6; texto = C.sobre; }
        ctx.fillStyle = fondo;
        ctx.fillRect(x + 2, y, s, s);
        ctx.strokeStyle = borde;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 0.5, s - 1, s - 1);
        ctx.fillStyle = texto;
        ctx.font = VIZ.fuente(s > 36 ? 14 : 12, 500);
        ctx.fillText(String(arreglo[i]), x + 2 + s / 2, y + s / 2);
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(10);
        ctx.fillText(String(i), x + 2 + s / 2, y + s + 9);
        // Punteros sobre las celdas.
        const etiquetas = [];
        if (estado === 'buscando') {
          if (i === lo) etiquetas.push('lo');
          if (i === hi) etiquetas.push('hi');
        }
        if (i === mid) etiquetas.push('mid');
        if (etiquetas.length) {
          ctx.fillStyle = i === mid ? (estado === 'encontrado' ? C.s6 : C.s1) : C.tinta;
          ctx.font = VIZ.fuente(10, 500);
          ctx.fillText(etiquetas.join('·'), x + 2 + s / 2, y - 8);
        }
      }

      const comparacionesLineal = (() => {
        const k = arreglo.indexOf(objetivo);
        return k >= 0 ? k + 1 : arreglo.length;
      })();
      lectura.set([
        ['objetivo', String(objetivo)],
        ['lo', estado === 'buscando' ? String(lo) : '—'],
        ['hi', estado === 'buscando' ? String(hi) : '—'],
        ['tamaño intervalo', String(Math.max(0, hi - lo + 1))],
        ['consultas binaria', String(historial.filter((h) => h.includes('mid')).length)],
        ['máximo ⌊log₂ n⌋+1', String(Math.floor(Math.log2(arreglo.length)) + 1)],
        ['consultas lineal', String(comparacionesLineal)],
      ]);
      const pie = estado === 'encontrado' ? '\n✓ encontrado' : '';
      registro.textContent = historial.length ? historial.join('\n') + pie
        : `Buscando ${objetivo} en a[0..${arreglo.length - 1}]. Presione «Un paso» o «Ejecutar».`;
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const col = Math.floor((x - geo.ox) / geo.celda), fila = Math.floor((y - 10) / geo.altoFila);
      if (col < 0 || col >= geo.porFila || fila < 0) return;
      const i = fila * geo.porFila + col;
      if (i >= arreglo.length) return;
      objetivo = arreglo[i];
      sObjetivo.valor = objetivo;
      reiniciar();
    });
    lienzo.canvas.style.cursor = 'pointer';

    nuevoArreglo();
    reiniciar();
  }

  /* ---------- Fig. 2: árbol de decisión implícito ---------- */

  function montarArbol(cuerpo) {
    let n = 15, fallos = true, seleccion = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño n', min: 1, max: 63, valor: n, alCambiar: (v) => { n = v; seleccion = null; dibujar(); } });
    ctl.casilla({ etiqueta: 'mostrar hojas de fallo', valor: fallos, alCambiar: (v) => { fallos = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.rampa[3], texto: 'nodo poco profundo', forma: 'punto' },
      { color: VIZ.rampa[11], texto: 'nodo profundo', forma: 'punto' },
      { color: C.s2, texto: 'camino al nodo elegido', forma: 'linea' },
      { color: C.superficie, borde: C.apagado, texto: 'hoja de fallo (intervalo vacío)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje horizontal es el índice del arreglo; la profundidad de cada nodo es el número de consultas menos uno. Haga clic en un nodo para ver su camino desde la raíz.');

    let nodos = [], externos = [], prof = 0;
    function construir() {
      nodos = new Array(n);
      externos = [];
      prof = 0;
      const rec = (lo, hi, d, padre) => {
        if (lo > hi) { externos.push({ pos: lo - 0.5, d, padre }); return; }
        const m = lo + ((hi - lo) >> 1);
        nodos[m] = { i: m, d, padre };
        prof = Math.max(prof, d);
        rec(lo, m - 1, d + 1, m);
        rec(m + 1, hi, d + 1, m);
      };
      rec(0, n - 1, 0, -1);
    }

    let geo = null;
    function dibujar() {
      construir();
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 24, der = 24, sup = 22, inf = 28;
      const niveles = prof + (fallos ? 2 : 1);
      const dx = (W - izq - der) / n;
      const dy = (H - sup - inf) / Math.max(1, niveles - 1);
      const px = (pos) => izq + (pos + 0.5) * dx;
      const py = (d) => sup + d * dy;
      const r = Math.max(3, Math.min(9, dx * 0.38));
      geo = { px, py, r };

      const camino = new Set();
      if (seleccion != null) for (let k = seleccion; k >= 0; k = nodos[k].padre) camino.add(k);

      // Aristas
      ctx.lineWidth = 1;
      for (const nd of nodos) {
        if (nd.padre < 0) continue;
        const p = nodos[nd.padre];
        const enCamino = camino.has(nd.i) && camino.has(p.i);
        ctx.strokeStyle = enCamino ? C.s2 : C.eje;
        ctx.lineWidth = enCamino ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(px(p.i), py(p.d));
        ctx.lineTo(px(nd.i), py(nd.d));
        ctx.stroke();
      }
      if (fallos) {
        ctx.strokeStyle = C.rejilla;
        ctx.lineWidth = 1;
        for (const ex of externos) {
          const p = nodos[ex.padre];
          ctx.beginPath();
          ctx.moveTo(px(p.i), py(p.d));
          ctx.lineTo(px(ex.pos), py(ex.d));
          ctx.stroke();
        }
        for (const ex of externos) {
          const s = Math.max(4, r * 0.9);
          ctx.fillStyle = C.superficie;
          ctx.strokeStyle = C.apagado;
          ctx.fillRect(px(ex.pos) - s / 2, py(ex.d) - s / 2, s, s);
          ctx.strokeRect(px(ex.pos) - s / 2 + 0.5, py(ex.d) - s / 2 + 0.5, s - 1, s - 1);
        }
      }
      for (const nd of nodos) {
        const t = prof ? nd.d / prof : 0;
        const col = VIZ.css(VIZ.enRampa(0.25 + 0.7 * t));
        VIZ.marcador(ctx, px(nd.i), py(nd.d), camino.has(nd.i) ? C.s2 : col, r);
      }
      // Índices
      ctx.fillStyle = C.apagado;
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const salto = Math.ceil(22 / dx);
      for (let i = 0; i < n; i += salto) ctx.fillText(String(i), px(i), H - inf + 10);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let d = 0; d <= prof; d++) ctx.fillText(`${d + 1}`, 2, py(d));
      ctx.textBaseline = 'top';
      ctx.fillText('consultas', 2, 2);

      const total = nodos.reduce((s, nd) => s + nd.d + 1, 0);
      const totalFallo = externos.reduce((s, ex) => s + ex.d, 0);
      lectura.set([
        ['n', String(n)],
        ['altura (peor caso)', `${prof + 1} = ⌊log₂ ${n}⌋+1`],
        ['promedio éxito', VIZ.fmt(total / n, 3)],
        ['promedio fallo', VIZ.fmt(totalFallo / (n + 1), 3)],
        ['log₂ n', VIZ.fmt(Math.log2(n), 3)],
        ...(seleccion != null ? [['nodo elegido', `índice ${seleccion}: ${nodos[seleccion].d + 1} consultas`]] : []),
      ]);
    }
    lienzo.alDibujar = dibujar;

    const nodoEn = (x, y) => {
      if (!geo) return null;
      let mejor = null, dm = Infinity;
      for (const nd of nodos) {
        const d = Math.hypot(geo.px(nd.i) - x, geo.py(nd.d) - y);
        if (d < dm) { dm = d; mejor = nd; }
      }
      return dm <= Math.max(10, geo.r + 4) ? mejor : null;
    };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const nd = nodoEn(x, y);
      lienzo.canvas.style.cursor = nd ? 'pointer' : 'default';
      if (!nd) return tip.ocultar();
      tip.mostrar(x, y, `índice <b>${nd.i}</b><br>profundidad ${nd.d}<br><b>${nd.d + 1}</b> consultas para encontrarlo`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const nd = nodoEn(x, y);
      seleccion = nd ? nd.i : null;
      dibujar();
    });

    dibujar();
  }

  VIZ.registrarTema('busqueda-binaria', {
    intro: String.raw`
      <p>Si un arreglo está <strong>ordenado</strong>, no es necesario revisarlo elemento por elemento para encontrar un valor.
      Basta mirar el elemento del medio: si es menor que el buscado, toda la mitad izquierda puede descartarse; si es mayor,
      la derecha. Cada consulta reduce el espacio de búsqueda a la mitad, de modo que en un arreglo de un millón de elementos
      bastan unas 20 consultas, en lugar del millón que puede requerir una búsqueda lineal.</p>`,
    visualizaciones: [
      {
        titulo: 'Búsqueda paso a paso',
        descripcion: 'El intervalo \\([\\mathit{lo}, \\mathit{hi}]\\) contiene los únicos candidatos posibles. En cada paso se consulta el punto medio y se descarta la mitad que no puede contener el valor.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Árbol de decisión implícito',
        descripcion: 'Toda ejecución de búsqueda binaria recorre un camino en este árbol. La raíz es el primer elemento consultado y la altura del árbol es el peor número de consultas.',
        montar: montarArbol,
      },
    ],
    teoria: String.raw`
      <h2>El algoritmo y su invariante</h2>
      <pre><code>lo ← 0, hi ← n − 1
mientras lo ≤ hi:
    mid ← lo + ⌊(hi − lo) / 2⌋
    si a[mid] = x: devolver mid
    si a[mid] &lt; x: lo ← mid + 1
    si no:          hi ← mid − 1
devolver «no encontrado»</code></pre>
      <p>La corrección se demuestra con un <strong>invariante de ciclo</strong>: al comienzo de cada iteración,</p>
      \[ x \in a[0..n-1] \;\Longrightarrow\; x \in a[\mathit{lo}..\mathit{hi}]. \]
      <p>Se cumple al inicio de forma trivial. Si \(a[\mathit{mid}] &lt; x\), como el arreglo está ordenado, todo
      \(a[k]\) con \(k \le \mathit{mid}\) es menor que \(x\), por lo que mover \(\mathit{lo}\) a \(\mathit{mid}+1\) lo preserva;
      el caso simétrico es análogo. Como \(\mathit{hi} - \mathit{lo}\) disminuye estrictamente, el ciclo termina; si termina con
      \(\mathit{lo} &gt; \mathit{hi}\), el intervalo es vacío y el invariante implica que \(x\) no está.</p>

      <div class="recuadro"><p><strong>Detalle práctico.</strong> Calcular \(\mathit{mid} = (\mathit{lo}+\mathit{hi})/2\) puede desbordar
      un entero de tamaño fijo cuando los índices son grandes. La forma \(\mathit{lo} + (\mathit{hi}-\mathit{lo})/2\) evita el problema;
      este error estuvo presente durante años en la biblioteca estándar de Java.</p></div>

      <h2>Número de consultas</h2>
      <p>Si \(T(n)\) es el número máximo de consultas para un intervalo de tamaño \(n\), la mitad que sobrevive tiene a lo más
      \(\lfloor n/2 \rfloor\) elementos, así que</p>
      \[ T(n) = T\!\left(\lfloor n/2 \rfloor\right) + 1,\qquad T(0) = 0 \quad\Longrightarrow\quad T(n) = \lfloor \log_2 n \rfloor + 1. \]
      <p>En la figura 2 esto es la altura del árbol. Como un árbol binario de altura \(h\) tiene a lo más \(2^h - 1\) nodos,
      cualquier algoritmo que solo compare elementos necesita \(h \ge \lceil \log_2(n+1) \rceil\) consultas en el peor caso:
      la búsqueda binaria es óptima.</p>

      <h2>Costo promedio</h2>
      <p>Si el valor buscado es cualquiera de los \(n\) elementos con igual probabilidad, el número esperado de consultas es
      la profundidad promedio de los nodos más uno. En un árbol casi completo hay \(2^d\) nodos en el nivel \(d\), luego para
      \(n = 2^h - 1\):</p>
      \[ \mathbb{E}[C] = \frac{1}{n}\sum_{d=0}^{h-1} (d+1)\,2^d = \frac{(h-1)2^h + 1}{2^h - 1} \approx \log_2 n - 1. \]
      <p>Es decir, el caso promedio es apenas una consulta mejor que el peor caso: la mitad de los nodos están en el último nivel.</p>

      <h2>Comparación con la búsqueda lineal</h2>
      <table>
        <thead><tr><th>n</th><th class="num">lineal (peor)</th><th class="num">binaria (peor)</th></tr></thead>
        <tbody>
          <tr><td class="num">100</td><td class="num">100</td><td class="num">7</td></tr>
          <tr><td class="num">10 000</td><td class="num">10 000</td><td class="num">14</td></tr>
          <tr><td class="num">1 000 000</td><td class="num">1 000 000</td><td class="num">20</td></tr>
          <tr><td class="num">10⁹</td><td class="num">10⁹</td><td class="num">30</td></tr>
        </tbody>
      </table>
      <p>El precio es que los datos deben estar ordenados (\(\Theta(n \log n)\) una vez) y permitir acceso aleatorio en
      tiempo constante. La misma idea —descartar la mitad del espacio— sirve para resolver ecuaciones (método de bisección),
      encontrar el primer elemento que cumple una propiedad monótona o depurar con <code>git bisect</code>.</p>`,
  });
})();
