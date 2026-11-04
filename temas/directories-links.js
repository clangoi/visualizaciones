(function () {
  'use strict';
  const { color: C, el } = VIZ;

  function montarRuta(cuerpo) {
    let ruta = '/home/ana/notas.txt', cache = false, pasos, k;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ruta', opciones: [['/home/ana/notas.txt', '/home/ana/notas.txt'], ['/usr/lib/python3/os.py', '/usr/lib/python3/os.py'], ['/etc/hosts', '/etc/hosts']], valor: ruta, alCambiar: (v) => { ruta = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Caché de directorios (ya leído /)', valor: cache, alCambiar: (v) => { cache = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de pasos, sin colores con significado';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Resolver una ruta es recorrerla componente a componente: cada directorio es un archivo especial que hay que leer para encontrar el i-nodo del siguiente.');
    function iniciar() {
      const partes = ruta.split('/').filter(Boolean); let ino = 2, n = 0;
      pasos = [];
      if (!cache) pasos.push(['/', `leer i-nodo de / (i-nodo 2) y su bloque de directorio`, 2]);
      else pasos.push(['/', 'i-nodo y bloque de / ya están en caché: 0 lecturas', 0]);
      partes.forEach((p, i) => {
        ino = 10 + ((p.length * 7 + i * 13) % 60);
        const ult = i === partes.length - 1;
        pasos.push([p, `buscar «${p}» en el directorio anterior → i-nodo ${ino}${ult ? ' (archivo)' : ''}; leer ese i-nodo${ult ? '' : ' y su bloque de directorio'}`, ult ? 1 : 2]);
      });
      pasos.push(['datos', `con el i-nodo del archivo ya se pueden leer sus bloques de datos (ver asignación indexada)`, 1]);
      k = 0;
      return (function* () { for (let j = 1; j <= pasos.length; j++) { k = j; yield; } })();
    }
    function dibujar() {
      if (!pasos) return;
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['#', 'componente', 'qué ocurre', 'lecturas'].map((h, i) => el('th', { class: i === 2 ? 'izq' : '' }, h))),
        pasos.slice(0, k).map(([p, t, l], i) => el('tr', null, el('td', null, String(i + 1)), el('td', null, p), el('td', { class: 'izq' }, t), el('td', null, String(l))))));
      const total = pasos.slice(0, k).reduce((a, p) => a + p[2], 0);
      registro.textContent = k ? `Paso ${k}: ${pasos[k - 1][1]}.` : 'Pulse «Un paso» para resolver la ruta.';
      lectura.set([['componentes', String(ruta.split('/').filter(Boolean).length)], ['lecturas de disco hasta ahora', String(total)], ['con todo en caché', '0']]);
    }
    rep.reiniciar();
  }

  function montarEnlaces(cuerpo) {
    let ents, inodos, msg, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('ln notas.txt duro.txt', () => { if (!ents.some((e) => e.n === 'duro.txt')) { ents.push({ n: 'duro.txt', t: 'duro', ino: 7 }); inodos[7].links++; msg = 'Enlace duro: nueva entrada de directorio al mismo i-nodo 7. Cuenta de enlaces = ' + inodos[7].links + '.'; } dibujar(); });
    ctl.boton('ln -s notas.txt blando.txt', () => { if (!ents.some((e) => e.n === 'blando.txt')) { ents.push({ n: 'blando.txt', t: 'blando', dest: 'notas.txt' }); msg = 'Enlace simbólico: un archivo nuevo cuyo contenido es la ruta «notas.txt».'; } dibujar(); });
    ctl.boton('rm notas.txt', () => { const i = ents.findIndex((e) => e.n === 'notas.txt'); if (i >= 0) { ents.splice(i, 1); inodos[7].links--; msg = inodos[7].links > 0 ? `rm quita el nombre; el i-nodo 7 sigue vivo (${inodos[7].links} enlace/s).` : 'rm quita el último nombre: el i-nodo 7 y sus datos se liberan.'; } dibujar(); });
    ctl.boton('cat duro.txt', () => leer('duro.txt'));
    ctl.boton('cat blando.txt', () => leer('blando.txt'));
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'entrada que apunta a un i-nodo', forma: 'linea' }, { color: C.s2, texto: 'enlace simbólico: apunta a un nombre', forma: 'linea' }, { color: C.s8, texto: 'enlace roto', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cree enlaces, borre «notas.txt» y lea cada enlace: el enlace duro sobrevive porque comparte el i-nodo; el simbólico queda roto.');
    function reiniciar() { ents = [{ n: 'notas.txt', t: 'arch', ino: 7 }]; inodos = { 7: { links: 1 } }; msg = 'Directorio con una entrada, notas.txt → i-nodo 7 (1 enlace).'; dibujar(); }
    function resolver(e, prof = 0) { if (e.t === 'blando') { const d = ents.find((x) => x.n === e.dest); return d && prof < 8 ? resolver(d, prof + 1) : null; } return inodos[e.ino] && inodos[e.ino].links > 0 ? e.ino : null; }
    function leer(nombre) { const e = ents.find((x) => x.n === nombre); if (!e) msg = `${nombre} no existe: créelo primero.`; else { const r = resolver(e); msg = r ? `cat ${nombre}: abre el i-nodo ${r} y muestra los datos.` : `cat ${nombre}: No such file or directory (enlace roto).`; } dibujar(); }
    function dibujar() {
      if (!ents) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const bw = Math.min(130, W * 0.32), xi = W - bw - 14, y0 = 14, h = 30, sep = 40;
      geo = [];
      ents.forEach((e, i) => {
        const y = y0 + i * sep, r = resolver(e), roto = !r;
        ctx.strokeStyle = e.t === 'blando' ? C.s2 : C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(14, y, bw, h);
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(e.n, 20, y + h / 2, bw - 10);
        geo.push(y);
      });
      if (inodos[7].links > 0) {
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(xi, y0, bw, 70); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(11, 600); ctx.fillText('i-nodo 7', xi + bw / 2, y0 + 16); ctx.font = VIZ.fuente(10); ctx.fillText(`enlaces: ${inodos[7].links}`, xi + bw / 2, y0 + 36); ctx.fillText('bloques de datos', xi + bw / 2, y0 + 54);
      } else { ctx.setLineDash([4, 4]); ctx.strokeStyle = C.apagado; ctx.strokeRect(xi, y0, bw, 70); ctx.setLineDash([]); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(10); ctx.fillText('i-nodo 7 liberado', xi + bw / 2, y0 + 35); }
      ents.forEach((e, i) => {
        const y = y0 + i * sep + h / 2, roto = !resolver(e);
        if (e.t === 'blando') {
          const j = ents.findIndex((x) => x.n === e.dest), col = roto ? C.s8 : C.s2;
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath();
          if (j >= 0) { const yd = y0 + j * sep + h / 2; ctx.moveTo(14 + bw, y); ctx.bezierCurveTo(14 + bw + 40, y, 14 + bw + 40, yd, 14 + bw, yd); } else { ctx.moveTo(14 + bw, y); ctx.lineTo(14 + bw + 28, y); }
          ctx.stroke(); ctx.setLineDash([]);
          if (j < 0) { ctx.font = VIZ.fuente(14, 700); ctx.textAlign = 'left'; ctx.fillText('×', 14 + bw + 32, y); ctx.font = VIZ.fuente(10); ctx.fillText(`«${e.dest}» no existe`, 14 + bw + 46, y); }
        } else if (inodos[e.ino] && inodos[e.ino].links > 0) {
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14 + bw, y); ctx.lineTo(xi, y0 + 20 + (i % 3) * 14); ctx.stroke();
        }
      });
      registro.textContent = msg;
      lectura.set([['entradas en el directorio', String(ents.length)], ['enlaces al i-nodo 7', String(inodos[7].links)], ['datos', inodos[7].links > 0 ? 'existen' : 'liberados']]);
    }
    lienzo.alDibujar = dibujar;
    reiniciar();
  }

  VIZ.registrarTema('directories-links', {
    intro: String.raw`
      <p>Un <strong>directorio</strong> es, por dentro, un archivo especial: una tabla de pares <em>nombre → i-nodo</em>. El <strong>i-nodo</strong> guarda todo lo demás (tamaño, permisos, dónde están los bloques de datos); el nombre no es parte del archivo, solo una forma de llegar a él.</p>
      <p>Eso explica los dos tipos de enlace: el <strong>enlace duro</strong> es otro nombre para el mismo i-nodo; el <strong>simbólico</strong> es un archivo pequeño que guarda una ruta.</p>`,
    visualizaciones: [
      { titulo: 'Resolver una ruta', descripcion: 'Siga la resolución de una ruta absoluta componente a componente y cuente las lecturas de disco. Active la caché de directorios.', montar: montarRuta },
      { titulo: 'Enlaces duros y simbólicos', descripcion: 'Cree los dos enlaces y borre el archivo original. Luego lea cada uno: uno sigue funcionando y el otro está roto.', montar: montarEnlaces },
    ],
    teoria: String.raw`
      <h2>Resolución de rutas</h2>
      <pre><code>resolver(ruta):
    ino ← i-nodo de la raíz            # fijo, por ejemplo el 2
    para cada componente c de la ruta:
        leer el i-nodo ino;  comprobar que es un directorio y que hay permiso
        leer los bloques del directorio;  buscar c
        ino ← i-nodo asociado a c
    devolver ino</code></pre>
      <p>Una ruta de \(d\) componentes cuesta del orden de \(2d\) lecturas de disco si no hay caché; por eso el sistema mantiene una caché de nombres (<em>dentry cache</em>) y los programas usan descriptores de archivo: después de <code>open</code>, <code>read</code> ya no repite la búsqueda.</p>
      <h2>Enlaces</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Duro</th><th class="izq">Simbólico</th></tr>
      <tr><td class="izq">qué es</td><td class="izq">otro nombre del mismo i-nodo</td><td class="izq">archivo con una ruta</td></tr>
      <tr><td class="izq">al borrar el original</td><td class="izq">sigue funcionando</td><td class="izq">queda roto</td></tr>
      <tr><td class="izq">cruza sistemas de archivos</td><td class="izq">no (los i-nodos son locales)</td><td class="izq">sí</td></tr>
      <tr><td class="izq">directorios</td><td class="izq">no (evita ciclos)</td><td class="izq">sí</td></tr></table>
      <p>El i-nodo guarda una <em>cuenta de enlaces</em>; el archivo se libera cuando llega a 0 y ningún proceso lo tiene abierto. Los bloques de datos que el i-nodo describe se organizan con la asignación <a href="tema.html?id=file-allocation">indexada</a>, y el acceso depende de las <a href="tema.html?id=system-calls">llamadas al sistema</a> <code>open</code>, <code>read</code> y <code>link</code>.</p>`,
  });
})();
