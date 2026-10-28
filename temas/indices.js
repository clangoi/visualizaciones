(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Árbol B+ ---------- */

  // Nodo: { hoja, claves, hijos (internos), sig (hojas enlazadas) }.
  function arbolBmas(cap) {
    let raiz = { hoja: true, claves: [], hijos: [], sig: null };
    const t = { cap, get raiz() { return raiz; } };
    t.buscar = function (k) {
      const camino = [];
      let n = raiz;
      while (!n.hoja) { camino.push(n); let i = 0; while (i < n.claves.length && k >= n.claves[i]) i++; n = n.hijos[i]; }
      camino.push(n);
      return { hoja: n, camino, esta: n.claves.includes(k) };
    };
    t.insertar = function (k) {
      const { hoja, camino, esta } = t.buscar(k);
      if (esta) return { camino, divididos: [], mensajes: [`${k} ya está en el índice.`] };
      hoja.claves.push(k); hoja.claves.sort((a, b) => a - b);
      const divididos = [], mensajes = [`${k} se inserta en la hoja [${hoja.claves.join(' ')}].`];
      let n = hoja, nivel = camino.length - 1;
      while (n.claves.length > cap) {
        const m = Math.ceil(n.claves.length / 2);
        let nuevo, sube;
        if (n.hoja) {
          nuevo = { hoja: true, claves: n.claves.slice(m), hijos: [], sig: n.sig };
          n.claves = n.claves.slice(0, m); n.sig = nuevo; sube = nuevo.claves[0];
          mensajes.push(`La hoja se llena y se divide; ${sube} se COPIA hacia arriba (sigue en la hoja).`);
        } else {
          const med = m - (n.claves.length % 2 === 0 ? 0 : 1);
          sube = n.claves[med];
          nuevo = { hoja: false, claves: n.claves.slice(med + 1), hijos: n.hijos.slice(med + 1) };
          n.claves = n.claves.slice(0, med); n.hijos = n.hijos.slice(0, med + 1);
          mensajes.push(`El nodo interno se divide; ${sube} SUBE (no queda abajo).`);
        }
        divididos.push(n, nuevo);
        const padre = camino[nivel - 1];
        if (!padre) {
          raiz = { hoja: false, claves: [sube], hijos: [n, nuevo] };
          divididos.push(raiz);
          mensajes.push('La raíz se dividió: el árbol crece un nivel, por arriba.');
          break;
        }
        const i = padre.hijos.indexOf(n);
        padre.claves.splice(i, 0, sube); padre.hijos.splice(i + 1, 0, nuevo);
        n = padre; nivel--;
      }
      return { camino, divididos, destino: k, mensajes };
    };
    t.rango = function (a, b) {
      const { hoja, camino } = t.buscar(a);
      const hojas = [];
      let n = hoja, encontrados = [];
      while (n) {
        hojas.push(n);
        encontrados = encontrados.concat(n.claves.filter((k) => k >= a && k <= b));
        if (n.claves.length && n.claves[n.claves.length - 1] > b) break;
        n = n.sig;
      }
      return { camino, hojas, encontrados };
    };
    t.altura = () => { let h = 1, n = raiz; while (!n.hoja) { n = n.hijos[0]; h++; } return h; };
    t.niveles = () => { const out = []; let q = [raiz]; while (q.length) { out.push(q); q = q.flatMap((n) => (n.hoja ? [] : n.hijos)); } return out; };
    return t;
  }

  function montarArbol(cuerpo) {
    let cap = 3, arbol = arbolBmas(cap), res = { camino: [], divididos: [], hojas: [] }, mensajes = [], clave = 42;
    const llenar = () => { [10, 20, 30, 40, 50, 60, 70, 80].forEach((k) => arbol.insertar(k)); };
    llenar();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Claves por nodo', valor: String(cap), opciones: [['2', '2'], ['3', '3'], ['4', '4']],
      alCambiar: (v) => { cap = +v; arbol = arbolBmas(cap); llenar(); res = { camino: [], divididos: [], hojas: [] }; mensajes = [`Árbol rehecho con hasta ${cap} claves por nodo.`]; lienzo.ajustar(true); },
    });
    const entrada = ctl.numero({ etiqueta: 'Clave', min: 1, max: 99, valor: clave, alCambiar: (v) => { clave = v; } });
    const leer = () => Math.max(1, Math.min(99, Math.round(entrada.valor) || 1));
    const aplicar = (r) => { res = { hojas: [], divididos: [], ...r }; mensajes = r.mensajes; lienzo.ajustar(true); };
    ctl.boton('Insertar', () => aplicar(arbol.insertar(leer())), { primario: true });
    ctl.boton('Buscar', () => { const k = leer(), r = arbol.buscar(k); aplicar({ camino: r.camino, destino: r.esta ? k : null, mensajes: [r.esta ? `${k} encontrada tras leer ${r.camino.length} páginas (una por nivel).` : `${k} no está: la búsqueda terminó en una hoja tras ${r.camino.length} páginas.`] }); });
    ctl.boton('Rango [clave, clave + 25]', () => {
      const a = leer(), r = arbol.rango(a, a + 25);
      aplicar({ camino: r.camino.slice(0, -1), hojas: r.hojas, mensajes: [`Bajar hasta la hoja de ${a} y seguir los punteros entre hojas: ${r.camino.length - 1} páginas internas + ${r.hojas.length} hojas. Claves: ${r.encontrados.join(', ') || 'ninguna'}.`] });
    });
    ctl.boton('Insertar 10 aleatorias', () => {
      for (let i = 0; i < 10; i++) arbol.insertar(1 + Math.floor(Math.random() * 99));
      aplicar({ camino: [], mensajes: ['Se insertaron 10 claves aleatorias.'] });
    });
    ctl.boton('Vaciar', () => { arbol = arbolBmas(cap); aplicar({ camino: [], mensajes: ['Índice vacío.'] }); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => Math.max(140, arbol.altura() * 72 + 20) });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.s1, texto: 'página leída al bajar', forma: 'punto' },
      { color: C.superficie, borde: C.s7, texto: 'página dividida', forma: 'punto' },
      { color: C.superficie, borde: C.s3, texto: 'hoja recorrida en un rango', forma: 'punto' },
      { color: C.s6, texto: 'clave buscada o insertada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Inserte claves hasta provocar divisiones. Las hojas (abajo) guardan todas las claves y están enlazadas de izquierda a derecha.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const niveles = arbol.niveles();
      const hojas = niveles[niveles.length - 1];
      const kw = W < 560 ? 20 : 26, h = 26, sep = 10;
      const anchoNodo = (n) => Math.max(1, n.claves.length) * kw + 8;
      const total = hojas.reduce((s, n) => s + anchoNodo(n) + sep, -sep);
      const esc = Math.min(1, (W - 16) / total);
      const pos = new Map();
      let x = (W - total * esc) / 2;
      const yDe = (d) => 16 + d * 72;
      hojas.forEach((n) => { const w = anchoNodo(n) * esc; pos.set(n, { x: x + w / 2, w, y: yDe(niveles.length - 1) }); x += w + sep * esc; });
      for (let d = niveles.length - 2; d >= 0; d--) niveles[d].forEach((n) => {
        const a = pos.get(n.hijos[0]), b = pos.get(n.hijos[n.hijos.length - 1]);
        pos.set(n, { x: (a.x + b.x) / 2, w: anchoNodo(n) * esc, y: yDe(d) });
      });
      // Aristas padre → hijo, desde el hueco entre claves.
      niveles.forEach((nv) => nv.forEach((n) => {
        if (n.hoja) return;
        const p = pos.get(n);
        n.hijos.forEach((c, j) => {
          const q = pos.get(c);
          const sx = p.x - p.w / 2 + 4 * esc + (j * (p.w - 8 * esc)) / n.claves.length;
          ctx.strokeStyle = res.camino.includes(c) ? C.s1 : C.eje; ctx.lineWidth = res.camino.includes(c) ? 2 : 1.2;
          ctx.beginPath(); ctx.moveTo(sx, p.y + h); ctx.lineTo(q.x, q.y); ctx.stroke();
        });
      }));
      // Punteros entre hojas.
      hojas.forEach((n) => {
        if (!n.sig) return;
        const p = pos.get(n), q = pos.get(n.sig);
        B.flecha(ctx, p.x + p.w / 2, p.y + h / 2, q.x - q.w / 2, q.y + h / 2, res.hojas.includes(n) && res.hojas.includes(n.sig) ? C.s3 : C.apagado, 1.2, 5);
      });
      for (const [n, p] of pos) {
        const x0 = p.x - p.w / 2;
        const anillo = res.divididos.includes(n) ? C.s7 : res.hojas.includes(n) ? C.s3 : res.camino.includes(n) ? C.s1 : null;
        if (anillo) { ctx.strokeStyle = anillo; ctx.lineWidth = 3; ctx.strokeRect(x0 - 3, p.y - 3, p.w + 6, h + 6); }
        ctx.fillStyle = n.hoja ? C.fondo2 : C.superficie; ctx.fillRect(x0, p.y, p.w, h);
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, p.y + 0.5, p.w - 1, h - 1);
        const cw = (p.w - 8 * esc) / Math.max(1, n.claves.length);
        n.claves.forEach((k, j) => {
          const cx = x0 + 4 * esc + (j + 0.5) * cw;
          if (k === res.destino) { ctx.fillStyle = C.s6; ctx.fillRect(cx - cw / 2 + 1, p.y + 3, cw - 2, h - 6); }
          ctx.fillStyle = k === res.destino ? C.sobre : C.tinta;
          ctx.font = VIZ.fuente(esc < 0.8 ? 10 : 12, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(k), cx, p.y + h / 2 + 0.5);
        });
      }
      registro.textContent = mensajes.length ? mensajes.join('\n') : 'Inserte, busque o recorra un rango de claves.';
      const nClaves = hojas.reduce((s, n) => s + n.claves.length, 0);
      lectura.set([
        ['claves', String(nClaves)],
        ['altura', String(arbol.altura())],
        ['hojas', String(hojas.length)],
        ['ocupación de hojas', nClaves ? `${Math.round((100 * nClaves) / (hojas.length * cap))} %` : '—'],
        ['páginas por búsqueda', String(arbol.altura())],
      ]);
    }
    lienzo.alDibujar = dibujar;
    mensajes = ['Índice B+ con las claves 10, 20, …, 80.'];
    lienzo.ajustar(true);
  }

  /* ---------- Fig. 2: costo de cada organización ---------- */

  const R = 100, F = 100; // registros por página y abanico del índice
  const log = (b, x) => Math.max(1, Math.ceil(Math.log(Math.max(2, x)) / Math.log(b)));
  const ORGS = [
    ['heap', 'archivo heap', (N, s) => [N, N / 2, N, 2]],
    ['ord', 'archivo ordenado', (N, s) => [N, log(2, N), log(2, N) + s * N, log(2, N) + N]],
    ['bagr', 'B+ agrupado', (N, s) => [1.5 * N, log(F, 1.5 * N), log(F, 1.5 * N) + s * 1.5 * N, log(F, 1.5 * N) + 1]],
    ['bnoagr', 'B+ no agrupado', (N, s) => [N, log(F, 0.15 * N) + 1, log(F, 0.15 * N) + s * R * N, log(F, 0.15 * N) + 3]],
    ['hash', 'hash', (N, s) => [1.25 * N, 2, 1.25 * N, 4]],
  ];
  const OPS = ['recorrido completo', 'igualdad sobre la clave', 'rango', 'inserción'];

  function montarCostos(cuerpo) {
    let logN = 4, sel = 0.01, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Páginas del archivo N', min: 2, max: 6, paso: 0.5, valor: logN, formato: (v) => VIZ.entero(10 ** v), alCambiar: (v) => { logN = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Selectividad del rango', min: -4, max: -0.3, paso: 0.1, valor: Math.log10(sel), formato: (v) => `${VIZ.fmt(100 * 10 ** v, 2)} %`, alCambiar: (v) => { sel = 10 ** v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ORGS.map(([, t], i) => ({ color: VIZ.series[i], texto: t })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico, en páginas leídas o escritas. Pase el cursor sobre una barra para ver el valor exacto.');
    let geo = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const N = 10 ** logN;
      const tope = Math.max(...ORGS.flatMap((o) => o[2](N, sel))) * 3;
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: OPS.length, ymin: 1, ymax: tope }, { logY: true, etiquetaY: 'E/S de páginas', ticksX: [], formatoY: (v) => (v < 1e6 ? VIZ.entero(v) : VIZ.fmt(v)) });
      plano.ejes();
      geo = [];
      const grupo = plano.sx(1) - plano.sx(0), bw = Math.max(4, (grupo * 0.8) / ORGS.length - 2);
      OPS.forEach((op, j) => {
        ORGS.forEach(([id, t, f], i) => {
          const v = f(N, sel)[j];
          const x = plano.sx(j) + grupo * 0.1 + i * (bw + 2);
          ctx.fillStyle = hover && hover.i === i && hover.j === j ? VIZ.alfa(VIZ.series[i], 0.7) : VIZ.series[i];
          ctx.beginPath(); ctx.roundRect(x, plano.sy(v), bw, plano.sy(1) - plano.sy(v), [4, 4, 0, 0]); ctx.fill();
          geo.push({ x, w: bw, y: plano.sy(v), i, j, v, t });
        });
        ctx.font = VIZ.fuente(lienzo.ancho < 560 ? 9 : 11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const palabras = op.split(' ');
        if (lienzo.ancho < 560 && palabras.length > 1) { ctx.fillText(palabras[0], plano.sx(j + 0.5), plano.y0 + 6); ctx.fillText(palabras.slice(1).join(' '), plano.sx(j + 0.5), plano.y0 + 17); }
        else ctx.fillText(op, plano.sx(j + 0.5), plano.y0 + 8);
      });
      const mejor = (j) => ORGS.reduce((m, o) => (o[2](N, sel)[j] < m[2](N, sel)[j] ? o : m))[1];
      lectura.set([
        ['registros', VIZ.entero(N * R)],
        ['mejor para igualdad', mejor(1)],
        ['mejor para rango', mejor(2)],
        ['mejor para insertar', mejor(3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y - 4);
      hover = g || null; dibujar();
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.t}</b><br>${OPS[g.j]}: ${VIZ.entero(Math.ceil(g.v))} páginas`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('indices', {
    intro: String.raw`
      <p>Una tabla es un <strong>archivo</strong> de páginas, y la forma en que se organizan sus registros decide qué consultas son
      baratas. En un <em>archivo heap</em> los registros van donde haya espacio: insertar es trivial, pero buscar exige leerlo todo. Un
      <strong>índice</strong> es una estructura auxiliar que lleva de un valor de búsqueda a las páginas que lo contienen.</p>
      <p>El índice más usado es el <strong>árbol B+</strong>: un árbol balanceado de páginas, muy ancho y muy bajo. Con cientos de claves
      por página, tres o cuatro niveles bastan para miles de millones de registros, y las hojas enlazadas permiten recorrer rangos en
      orden.</p>`,
    visualizaciones: [
      {
        titulo: 'Un árbol B+',
        descripcion: 'Inserte claves y observe las divisiones: en las hojas la clave se copia hacia arriba; en los nodos internos, sube. Pruebe un rango y vea cómo se usan los punteros entre hojas.',
        montar: montarArbol,
      },
      {
        titulo: 'Costo de cada organización',
        descripcion: 'Páginas que lee o escribe cada organización de archivo según la operación. Suba la selectividad del rango y vea cómo el índice no agrupado pasa a ser peor que leer todo.',
        montar: montarCostos,
      },
    ],
    teoria: String.raw`
      <h2>Alternativas de entrada</h2>
      <p>Una entrada de índice \(k^*\) para la clave \(k\) puede ser (1) el registro completo, (2) el par \((k, \text{rid})\) con el
      identificador del registro, o (3) \((k, \text{lista de rids})\). Un índice es <strong>agrupado</strong> (<em>clustered</em>) si el
      orden de los registros en el archivo coincide con el orden del índice; solo puede haber uno por tabla.</p>

      <h2>El árbol B+</h2>
      <p>Con orden \(d\), cada nodo salvo la raíz tiene entre \(d\) y \(2d\) claves; los nodos internos solo guían y las hojas guardan todas
      las entradas. Si el abanico (hijos por nodo) es \(F\) y hay \(N\) hojas,</p>
      \[ \text{altura} = \lceil \log_F N \rceil + 1. \]
      <p>Con \(F = 133\) (ocupación típica de 67 % sobre 200), tres niveles bajo la raíz direccionan \(133^4 \approx 3\cdot 10^8\) páginas.
      La raíz y el primer nivel suelen quedar fijos en el buffer, de modo que una búsqueda cuesta 1 o 2 lecturas reales.</p>
      <pre><code>insertar(k):
    hoja ← bajar desde la raíz
    poner k en hoja
    si hoja tiene 2d + 1 claves:
        dividir en dos hojas de d y d + 1; COPIAR la primera clave de la nueva al padre
    mientras un nodo interno tenga 2d + 1 claves:
        dividir en dos de d; SUBIR la clave del medio
    si se dividió la raíz: nueva raíz (el árbol crece por arriba)</code></pre>
      <div class="recuadro">El árbol crece por la raíz, no por las hojas: por eso todas las hojas están siempre a la misma profundidad y
      el árbol está siempre balanceado, sin rotaciones.</div>

      <h2>Comparación de costos</h2>
      <p>Con \(N\) páginas de datos, \(R\) registros por página, abanico \(F\) y selectividad \(s\) (fracción de registros que cumple):</p>
      <table>
        <tr><th>Organización</th><th>Igualdad</th><th>Rango</th><th>Inserción</th></tr>
        <tr><td>heap</td><td>\(N/2\)</td><td>\(N\)</td><td>2</td></tr>
        <tr><td>ordenado</td><td>\(\log_2 N\)</td><td>\(\log_2 N + sN\)</td><td>\(\log_2 N + N\)</td></tr>
        <tr><td>B+ agrupado</td><td>\(\log_F 1{,}5N\)</td><td>\(\log_F 1{,}5N + 1{,}5\,sN\)</td><td>\(\log_F 1{,}5N + 1\)</td></tr>
        <tr><td>B+ no agrupado</td><td>\(\log_F 0{,}15N + 1\)</td><td>\(\log_F 0{,}15N + sRN\)</td><td>\(\log_F 0{,}15N + 3\)</td></tr>
        <tr><td>hash</td><td>2</td><td>\(1{,}25N\)</td><td>4</td></tr>
      </table>
      <p>El término \(sRN\) del índice no agrupado es una lectura aleatoria <em>por registro</em>: con \(R = 100\), basta con que cumpla más
      del 1 % de los registros para que sea peor que recorrer el archivo completo. El hash es imbatible en igualdad pero inútil para rangos.</p>

      <h2>Conexiones</h2>
      <p>Las páginas del árbol pasan por el <a href="tema.html?id=paginas-buffer">buffer</a>; el árbol se usa en la selección
      (<a href="tema.html?id=operadores-lineales">operadores lineales</a>) y en el <em>index nested loop join</em>. Es pariente de los
      <a href="tema.html?id=arboles-2-3">árboles 2-3</a>, que son árboles B de orden 1.</p>`,
  });
})();
