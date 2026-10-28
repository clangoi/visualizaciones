(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const J = B.JERARQUIAS;
  const MAX = { cp: J.cp.niveles - 1, edad: J.edad.niveles - 1, sexo: J.sexo.niveles - 1 };
  const NODOS = [];
  for (let c = 0; c <= MAX.cp; c++) for (let e = 0; e <= MAX.edad; e++) for (let s = 0; s <= MAX.sexo; s++) NODOS.push({ cp: c, edad: e, sexo: s, h: c + e + s });
  const clave = (n) => `${n.cp}${n.edad}${n.sexo}`;
  const CIS = ['cp', 'edad', 'sexo'];

  function evaluar(R, n, k, maxSup) {
    const T = B.anonimizar(R, n);
    const cl = B.clases(T, CIS);
    const chicas = cl.filter((c) => c.indices.length < k);
    const sup = chicas.reduce((s, c) => s + c.indices.length, 0);
    const suprimidas = new Set(chicas.flatMap((c) => c.indices));
    const prec = 1 - CIS.reduce((s, a) => s + n[a] / MAX[a], 0) / CIS.length;
    const dm = cl.filter((c) => c.indices.length >= k).reduce((s, c) => s + c.indices.length ** 2, 0) + sup * R.filas.length;
    return { ok: sup <= maxSup, sup, suprimidas, T, cl, prec, dm };
  }

  function montarReticulo(cuerpo) {
    const R = B.clinicos();
    let k = 3, maxSup = 0, elegido = NODOS[0], evaluados = new Map(), actual = null, minimos = new Set(), mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'k', min: 2, max: 6, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Filas que se pueden suprimir', min: 0, max: 3, valor: maxSup, alCambiar: (v) => { maxSup = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 380 : 340) });
    lienzo.canvas.style.cursor = 'pointer';
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'sin evaluar' },
      { color: C.s6, texto: 'cumple k-anonimato' },
      { color: C.s8, texto: 'no cumple' },
      { color: C.superficie, borde: C.s2, texto: 'mínimo: cumple y ningún nodo de abajo cumple', forma: 'punto' },
      { color: C.superficie, borde: C.s1, texto: 'nodo elegido (tabla de abajo)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const caja = B.grupoTablas(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nodo ⟨cp, edad, sexo⟩ es un nivel de generalización por atributo; subir una arista generaliza un atributo un nivel. Haga clic en un nodo para ver su tabla.');

    function iniciar() {
      evaluados = new Map(); actual = null; minimos = new Set();
      mensaje = `Buscar las generalizaciones mínimas que dan k = ${k}, de abajo hacia arriba por altura.`;
      return (function* () {
        const orden = [...NODOS].sort((a, b) => a.h - b.h);
        for (const n of orden) {
          actual = n;
          // Si un nodo de abajo ya cumple, este también cumple (monotonía): no hace falta evaluar.
          const debajo = NODOS.filter((m) => m.h === n.h - 1 && CIS.every((a) => m[a] <= n[a]));
          const heredado = debajo.some((m) => evaluados.get(clave(m)) === true);
          const ok = heredado || evaluar(R, n, k, maxSup).ok;
          evaluados.set(clave(n), ok);
          if (ok && !heredado) minimos.add(clave(n));
          mensaje = `⟨${n.cp},${n.edad},${n.sexo}⟩ altura ${n.h}: ${heredado ? 'cumple por monotonía (un nodo de abajo ya cumple)' : ok ? `cumple k = ${k}: es mínimo` : `no cumple: hay clases con menos de ${k} filas`}.`;
          yield;
        }
        actual = null;
        mensaje = `Mínimos: ${[...minimos].map((m) => `⟨${m.split('').join(',')}⟩`).join(' ')}. Entre ellos se elige el de menor pérdida de información.`;
      })();
    }
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const alturas = 1 + MAX.cp + MAX.edad + MAX.sexo;
      const dy = (H - 40) / (alturas - 1);
      const porH = Array.from({ length: alturas }, (_, h) => NODOS.filter((n) => n.h === h));
      const bw = Math.min(64, W / 7 - 8), bh = 24;
      geo = [];
      const pos = new Map();
      porH.forEach((ns, h) => ns.forEach((n, i) => pos.set(clave(n), { x: ((i + 0.5) * W) / ns.length, y: H - 20 - h * dy })));
      for (const n of NODOS) for (const a of CIS) {
        if (n[a] >= MAX[a]) continue;
        const m = NODOS.find((q) => CIS.every((b) => q[b] === n[b] + (b === a ? 1 : 0)));
        const p = pos.get(clave(n)), q = pos.get(clave(m));
        ctx.strokeStyle = C.tenue; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - bh / 2); ctx.lineTo(q.x, q.y + bh / 2); ctx.stroke();
      }
      for (const n of NODOS) {
        const p = pos.get(clave(n)), ev = evaluados.get(clave(n));
        const col = ev === true ? C.s6 : ev === false ? C.s8 : C.inactivo;
        const anillo = n === elegido ? C.s1 : n === actual ? C.tinta : minimos.has(clave(n)) ? C.s2 : null;
        if (anillo) { ctx.strokeStyle = anillo; ctx.lineWidth = 3; ctx.strokeRect(p.x - bw / 2 - 3, p.y - bh / 2 - 3, bw + 6, bh + 6); }
        B.caja(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, `${n.cp},${n.edad},${n.sexo}`, { relleno: col, borde: col, tinta: C.sobre, px: 11 });
        geo.push({ n, x: p.x, y: p.y, w: bw, h: bh });
      }
      B.texto(ctx, 'más generalizado ↑', 8, 10, { px: 10, color: C.apagado });
      registro.textContent = mensaje;
      const r = evaluar(R, elegido, k, maxSup);
      const colores = new Map(r.cl.filter((c) => c.indices.length >= k).map((c, i) => [c.clave, VIZ.series[i % 8]]));
      caja.replaceChildren(B.tabla(r.T, {
        titulo: `nodo ⟨${elegido.cp},${elegido.edad},${elegido.sexo}⟩: cp ${J.cp.nombres[elegido.cp]}, edad ${J.edad.nombres[elegido.edad]}, sexo ${J.sexo.nombres[elegido.sexo]}`,
        tachada: (f, i) => r.suprimidas.has(i),
        fila: (f, i) => (r.suprimidas.has(i) ? null : colores.get(CIS.map((a) => String(f[a])).join(' · '))),
      }));
      lectura.set([
        ['k logrado', (() => { const vivas = r.cl.filter((c) => !c.indices.some((i) => r.suprimidas.has(i))); return vivas.length ? String(Math.min(...vivas.map((c) => c.indices.length))) : '— (todo suprimido)'; })()],
        ['filas suprimidas', `${r.sup}${r.sup > maxSup ? ` (máx ${maxSup})` : ''}`],
        ['precisión (Prec)', VIZ.fmt(r.prec, 3)],
        ['discernibilidad', VIZ.entero(r.dm)],
        ['mínimos', String(minimos.size)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.abs(x - q.x) <= q.w / 2 && Math.abs(y - q.y) <= q.h / 2);
      if (g) { elegido = g.n; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.abs(x - q.x) <= q.w / 2 && Math.abs(y - q.y) <= q.h / 2);
      if (!g) return tip.ocultar();
      const r = evaluar(R, g.n, k, maxSup);
      tip.mostrar(x, y, `⟨${g.n.cp},${g.n.edad},${g.n.sexo}⟩<br>cp ${J.cp.nombres[g.n.cp]} · edad ${J.edad.nombres[g.n.edad]} · sexo ${J.sexo.nombres[g.n.sexo]}<br>${r.ok ? 'cumple' : 'no cumple'} k = ${k} · suprime ${r.sup}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('anonimizacion', {
    intro: String.raw`
      <p><strong>Anonimizar</strong> es transformar los datos de modo que ya no se puedan asociar a una persona por medios razonables, de
      forma irreversible. A diferencia de la seudonimización, no queda ninguna llave: los datos anonimizados dejan de ser datos personales
      ante la ley.</p>
      <p>Las dos herramientas clásicas son la <strong>generalización</strong> (reemplazar un valor por uno menos preciso: 28 → 20–29) y la
      <strong>supresión</strong> (borrar las filas atípicas que obligarían a generalizar demasiado). Elegir cuánto generalizar cada atributo
      es un problema de búsqueda: hay muchas combinaciones y se quiere la que pierde menos información y aun así cumple la garantía.</p>`,
    visualizaciones: [
      {
        titulo: 'El retículo de generalizaciones',
        descripcion: 'Todas las combinaciones de niveles para código postal, edad y sexo. Ejecute la búsqueda de abajo hacia arriba y observe que, por monotonía, todo lo que está sobre un nodo que cumple también cumple.',
        montar: montarReticulo,
      },
    ],
    teoria: String.raw`
      <h2>Jerarquías de generalización</h2>
      <p>Cada cuasi-identificador tiene una jerarquía de dominios \(D_0 \to D_1 \to \cdots \to D_m\), del valor original a «*»:</p>
      <table>
        <tr><th>Atributo</th><th>Nivel 0</th><th>Nivel 1</th><th>Nivel 2</th><th>Nivel 3</th></tr>
        <tr><td>código postal</td><td>7513</td><td>751*</td><td>75**</td><td>****</td></tr>
        <tr><td>edad</td><td>23</td><td>20–24</td><td>20–29</td><td>*</td></tr>
        <tr><td>sexo</td><td>M</td><td>*</td><td></td><td></td></tr>
      </table>
      <p>Una generalización completa es un vector de niveles \(\langle c, e, s\rangle\). Ordenados componente a componente, forman un
      <strong>retículo</strong> con \(4 \cdot 4 \cdot 2 = 32\) nodos.</p>

      <h2>Monotonía y búsqueda</h2>
      <div class="recuadro"><strong>Propiedad.</strong> Si la tabla generalizada según \(\mathbf v\) es k-anónima y \(\mathbf w \ge
      \mathbf v\) componente a componente, la tabla según \(\mathbf w\) también lo es: generalizar más solo puede juntar clases, nunca
      separarlas.</div>
      <p>Por eso basta buscar los nodos <strong>mínimos</strong>. Samarati (2001) hace búsqueda binaria sobre la altura; Incognito (LeFevre y
      colegas, 2005) recorre de abajo hacia arriba y poda con la monotonía, también sobre subconjuntos de atributos. Encontrar la
      k-anonimización óptima es NP-difícil en general (Meyerson y Williams, 2004), pero el retículo suele ser pequeño.</p>

      <h2>Pérdida de información</h2>
      <p>Entre los mínimos se elige con una métrica de utilidad:</p>
      \[ \text{Prec} = 1 - \frac{1}{|Q|} \sum_{a \in Q} \frac{\text{nivel}(a)}{\text{altura}(a)}, \qquad
         \text{DM} = \sum_{E:\, |E| \ge k} |E|^2 + |\text{suprimidas}| \cdot |T|. \]
      <p>La discernibilidad (DM) castiga las clases grandes, que hacen indistinguibles muchas filas, y las supresiones. Permitir suprimir
      unas pocas filas atípicas suele bajar mucho la generalización necesaria.</p>
      <p>La garantía que se busca aquí es el <a href="tema.html?id=k-anonimato">k-anonimato</a>; reforzarla para el atributo sensible lleva
      a la <a href="tema.html?id=l-diversidad">l-diversidad</a>. Algoritmos como Mondrian generalizan cada región por separado
      (recodificación local) en vez de usar el mismo nivel para toda la tabla.</p>`,
  });
})();
