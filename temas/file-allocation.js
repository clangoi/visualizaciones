(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const NB = 32, ARCH = [['A', 5], ['B', 3], ['C', 6], ['D', 4]];

  function montarAsignacion(cuerpo) {
    let met = 'cont', arch = 0, bloque = 3, sem = 1, lay, ruta, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Método de asignación', opciones: [['cont', 'Contigua'], ['enl', 'Enlazada'], ['idx', 'Indexada']], valor: met, alCambiar: (v) => { met = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Archivo', opciones: ARCH.map(([n, t], i) => [i, `${n} (${t} bloques)`]), valor: arch, alCambiar: (v) => { arch = +v; bloque = Math.min(bloque, ARCH[arch][1] - 1); dibujar(); } });
    ctl.rango({ etiqueta: 'Leer el bloque lógico k', min: 0, max: 5, valor: bloque, alCambiar: (v) => { bloque = Math.min(v, ARCH[arch][1] - 1); dibujar(); } });
    ctl.boton('Otra distribución', () => { sem++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 150 : 110) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ARCH.map(([n], i) => ({ color: VIZ.series[i], texto: 'archivo ' + n })).concat([{ color: C.neutro, borde: C.eje, texto: 'libre' }, { color: C.tinta, texto: 'bloques que hay que leer', forma: 'punto' }, { color: C.apagado, texto: 'bloque de índice', forma: 'punto' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cuatro archivos en un disco de 32 bloques. Elija un archivo y un bloque lógico: los puntos negros marcan los accesos a disco necesarios para llegar a él con cada método.');
    function disposicion() {
      const rnd = VIZ.semilla(sem * 13 + 2), mapa = Array(NB).fill(-1), blq = ARCH.map(() => []);
      if (met === 'cont') { let p = 1; ARCH.forEach(([, t], a) => { p += Math.floor(rnd() * 3); for (let i = 0; i < t; i++) { mapa[p] = a; blq[a].push(p); p++; } }); }
      else {
        const libres = Array.from({ length: NB }, (_, i) => i); for (let i = NB - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [libres[i], libres[j]] = [libres[j], libres[i]]; }
        let q = 0; const idxb = [];
        ARCH.forEach(([, t], a) => { if (met === 'idx') { const b = libres[q++]; idxb[a] = b; mapa[b] = 100 + a; } for (let i = 0; i < t; i++) { const b = libres[q++]; mapa[b] = a; blq[a].push(b); } });
        return { mapa, blq, idxb };
      }
      return { mapa, blq, idxb: [] };
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      lay = disposicion(); const t = ARCH[arch][1], k = Math.min(bloque, t - 1);
      ruta = met === 'cont' ? [lay.blq[arch][k]] : met === 'enl' ? lay.blq[arch].slice(0, k + 1) : [lay.idxb[arch], lay.blq[arch][k]];
      const cols = W < 560 ? 16 : 32, bw = (W - 16) / cols, fila = 44; geo = { cols, bw, fila };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      for (let b = 0; b < NB; b++) {
        const x = 8 + (b % cols) * bw, y = 8 + Math.floor(b / cols) * fila, a = lay.mapa[b];
        ctx.fillStyle = a < 0 ? C.neutro : a >= 100 ? C.apagado : VIZ.series[a % 8]; ctx.fillRect(x + 1, y, bw - 2, 30);
        if (a < 0) { ctx.strokeStyle = C.eje; ctx.strokeRect(x + 1.5, y + 0.5, bw - 3, 29); }
        ctx.fillStyle = a < 0 ? C.apagado : C.sobre; ctx.fillText(a >= 100 ? 'i' : a >= 0 ? 'ABCD'[a] : '', x + bw / 2, y + 15);
        if (ruta.includes(b)) { ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.arc(x + bw / 2, y + 38, 3, 0, 7); ctx.fill(); }
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9); ctx.fillText(String(b), x + bw / 2, y + 28 - 20 + 33); ctx.font = VIZ.fuente(10);
      }
      const txt = { cont: `Contigua: la dirección del bloque ${k} es inicio + ${k}: un solo acceso (bloque ${ruta[0]}).`, enl: `Enlazada: hay que seguir ${k + 1} bloques en cadena (${ruta.join(' → ')}), cada uno apunta al siguiente.`, idx: `Indexada: se lee el bloque de índice (${ruta[0]}) y de ahí el bloque de datos (${ruta[1]}): 2 accesos.` }[met];
      registro.textContent = txt;
      const frag = met === 'cont' ? ARCH.length : 0;
      lectura.set([['accesos al disco', String(ruta.length)], ['acceso directo', met === 'enl' ? 'no (secuencial)' : 'sí'], ['fragmentación', met === 'cont' ? 'externa' : met === 'enl' ? 'ninguna' : 'ninguna'], ['costo de espacio', met === 'cont' ? '0' : met === 'enl' ? '1 puntero por bloque' : '1 bloque de índice por archivo']]);
      void frag;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!lay) return;
      const { x, y } = lienzo.posicion(ev), b = Math.floor((y - 8) / geo.fila) * geo.cols + Math.floor((x - 8) / geo.bw), a = lay.mapa[b];
      if (b >= 0 && b < NB) tip.mostrar(x, y, `bloque <b>${b}</b><br>${a < 0 ? 'libre' : a >= 100 ? 'índice del archivo ' + 'ABCD'[a - 100] : 'archivo ' + 'ABCD'[a]}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarLibre(cuerpo) {
    let usado = Array.from({ length: NB }, (_, i) => [0, 1, 2, 3, 6, 7, 11, 12, 13, 17, 18, 22, 23, 24, 25, 28].includes(i)), n = 3, hallado = -1, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Bloques contiguos que se piden', min: 1, max: 8, valor: n, alCambiar: (v) => { n = v; hallado = -1; dibujar(); } });
    ctl.boton('Buscar con el mapa de bits', () => { buscar(); }, { primario: true });
    ctl.boton('Reiniciar', () => { usado = usado.map(() => false); hallado = -1; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 110 : 70) });
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'ocupado (1)' }, { color: C.neutro, borde: C.eje, texto: 'libre (0)' }, { color: C.s6, texto: 'primer ajuste encontrado' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un bloque para ocuparlo o liberarlo. El mapa de bits tiene un bit por bloque; buscar n bloques libres seguidos es buscar n ceros consecutivos.');
    function buscar() {
      let c = 0; hallado = -1;
      for (let i = 0; i < NB; i++) { c = usado[i] ? 0 : c + 1; if (c === n) { hallado = i - n + 1; break; } }
      registro.textContent = hallado >= 0 ? `Primer ajuste: ${n} bloques libres desde el bloque ${hallado}.` : `No hay ${n} bloques libres consecutivos (aunque pueda haber ${usado.filter((u) => !u).length} libres en total).`;
      dibujar(true);
    }
    function dibujar(conservar) {
      const { ctx, ancho: W } = lienzo, cols = W < 560 ? 16 : 32, bw = (W - 16) / cols, fila = 36; geo = { cols, bw, fila };
      lienzo.limpiar();
      ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      usado.forEach((u, b) => {
        const x = 8 + (b % cols) * bw, y = 4 + Math.floor(b / cols) * fila, ok = hallado >= 0 && b >= hallado && b < hallado + n;
        ctx.fillStyle = ok ? C.s6 : u ? C.tinta : C.neutro; ctx.fillRect(x + 1, y, bw - 2, 28);
        if (!u && !ok) { ctx.strokeStyle = C.eje; ctx.strokeRect(x + 1.5, y + 0.5, bw - 3, 27); }
        ctx.fillStyle = u || ok ? C.sobre : C.apagado; ctx.fillText(u ? '1' : '0', x + bw / 2, y + 14);
      });
      if (!conservar) registro.textContent = 'Pulse «Buscar» o edite el mapa con clics.';
      let mayor = 0, c = 0, huecos = 0; usado.forEach((u) => { if (!u) { c++; mayor = Math.max(mayor, c); } else { if (c) huecos++; c = 0; } }); if (c) huecos++;
      lectura.set([['libres', `${usado.filter((u) => !u).length} de ${NB}`], ['mayor extensión libre', String(mayor)], ['extensiones libres', String(huecos)], ['mapa', usado.map((u) => (u ? 1 : 0)).join('').replace(/(.{8})/g, '$1 ').trim()]]);
    }
    lienzo.alDibujar = () => dibujar(true);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = Math.floor((y - 4) / geo.fila) * geo.cols + Math.floor((x - 8) / geo.bw);
      if (b >= 0 && b < NB) { usado[b] = !usado[b]; hallado = -1; dibujar(); }
    });
    dibujar();
  }

  VIZ.registrarTema('file-allocation', {
    intro: String.raw`
      <p>Un disco es una larga lista de bloques; un <strong>archivo</strong> es una secuencia lógica de bytes que el sistema de archivos reparte en bloques. La pregunta de diseño es <strong>dónde poner los bloques de cada archivo</strong> y <strong>cómo recordarlo</strong>. Hay tres respuestas clásicas: <em>contigua</em>, <em>enlazada</em> e <em>indexada</em>.</p>
      <p>También hay que saber qué bloques están libres: se usa un <strong>mapa de bits</strong> o una lista de bloques libres.</p>`,
    visualizaciones: [
      { titulo: 'Contigua, enlazada e indexada', descripcion: 'Elija un archivo y un bloque lógico y cuente los accesos a disco con cada método. La enlazada exige recorrer la cadena.', montar: montarAsignacion },
      { titulo: 'Administración del espacio libre', descripcion: 'Edite el mapa de bits con clics y busque una extensión de n bloques libres. Fragmente el disco y pida extensiones grandes.', montar: montarLibre },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Contigua</th><th class="izq">Enlazada</th><th class="izq">Indexada</th></tr>
      <tr><td class="izq">acceso al bloque \(k\)</td><td class="izq">1 (directo)</td><td class="izq">\(k+1\) (secuencial)</td><td class="izq">2 (índice + dato)</td></tr>
      <tr><td class="izq">fragmentación</td><td class="izq">externa; difícil crecer</td><td class="izq">ninguna</td><td class="izq">ninguna</td></tr>
      <tr><td class="izq">sobrecosto</td><td class="izq">ninguno</td><td class="izq">puntero en cada bloque; frágil si se pierde uno</td><td class="izq">bloque(s) de índice</td></tr>
      <tr><td class="izq">se usa en</td><td class="izq">CD/DVD, extensiones</td><td class="izq">FAT (la tabla va aparte)</td><td class="izq">Unix (i-nodos), ext4</td></tr></table>
      <p>Si un bloque tiene \(B\) bytes y un puntero \(p\), un bloque de índice apunta a \(B/p\) bloques; para archivos grandes se usan índices de varios niveles. Un i-nodo de Unix combina punteros directos con uno, dos y tres niveles de indirección: los archivos pequeños (la mayoría) se resuelven con un solo acceso extra.</p>
      <p>Ejemplo: con bloques de 4 KB y punteros de 4 bytes, un índice simple direcciona \(1024 \times 4\,\text{KB} = 4\) MB; uno doble, \(1024^2 \times 4\,\text{KB} = 4\) GB.</p>
      <h2>Espacio libre</h2>
      <ul><li><strong>Mapa de bits</strong>: \(N\) bits para \(N\) bloques (con 4 KB, 1 bit por bloque es 0,003 % del disco); buscar extensiones contiguas es fácil.</li><li><strong>Lista enlazada de libres</strong>: sin espacio extra, pero costosa de recorrer.</li></ul>
      <p>La organización física influye en el tiempo de acceso (ver <a href="tema.html?id=disk-scheduling">planificación del disco</a>). Para el espacio contiguo, la analogía con la memoria está en <a href="tema.html?id=memory-allocation">asignación y fragmentación</a>. Los nombres de los archivos se organizan en <a href="tema.html?id=directories-links">directorios</a>.</p>`,
  });
})();
