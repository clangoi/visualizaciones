(function () {
  'use strict';
  const { color: C } = VIZ;
  const MEM = 64;

  function montar(cuerpo) {
    let alg = 'first', sem = 1, bloques, op, msg, fallos, sol, pidSig, rnd, ocupados;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Política', opciones: [['first', 'Primer ajuste'], ['best', 'Mejor ajuste'], ['worst', 'Peor ajuste']], valor: alg, alCambiar: (v) => { alg = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Compactar', () => { compactar(); dibujar(); });
    ctl.boton('Nuevos datos', () => { sem++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 120 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'proceso asignado' }, { color: C.neutro, borde: C.eje, texto: 'hueco libre' }, { color: C.s8, texto: 'solicitud rechazada con memoria libre suficiente', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Memoria de 64 unidades. En cada paso llega un proceso (se asigna según la política) o termina uno al azar. Compare cuánta memoria libre queda inutilizable y pruebe «Compactar».');
    const huecos = () => bloques.filter((b) => !b.p);
    function compactar() { let x = 0; const nuevo = []; for (const b of bloques.filter((q) => q.p)) { nuevo.push({ ...b, ini: x }); x += b.tam; } if (x < MEM) nuevo.push({ ini: x, tam: MEM - x, p: 0 }); bloques = nuevo; msg = 'Compactación: todos los procesos se juntan y los huecos se unen en uno.'; }
    function unir() { const r = []; for (const b of bloques) { const u = r[r.length - 1]; if (u && !u.p && !b.p) u.tam += b.tam; else r.push({ ...b }); } bloques = r; }
    function iniciar() {
      rnd = VIZ.semilla(sem * 41 + 5); bloques = [{ ini: 0, tam: MEM, p: 0 }]; fallos = 0; sol = 0; pidSig = 1; msg = 'Memoria vacía.';
      return (function* () {
        for (let k = 0; k < 60; k++) {
          const vivos = bloques.filter((b) => b.p);
          if (vivos.length > 2 && rnd() < 0.42) { const b = vivos[Math.floor(rnd() * vivos.length)]; msg = `P${b.p} termina y libera ${b.tam} unidades.`; b.p = 0; unir(); }
          else {
            const tam = 3 + Math.floor(rnd() * 12), p = pidSig++; sol++;
            const cand = huecos().filter((h) => h.tam >= tam);
            if (!cand.length) { fallos++; msg = `P${p} pide ${tam}: ningún hueco basta${huecos().reduce((a, h) => a + h.tam, 0) >= tam ? ' aunque la suma de huecos sí (fragmentación externa)' : ''}.`; ultimoFallo = true; }
            else {
              const h = alg === 'first' ? cand[0] : alg === 'best' ? cand.reduce((a, b) => (b.tam < a.tam ? b : a)) : cand.reduce((a, b) => (b.tam > a.tam ? b : a));
              const i = bloques.indexOf(h);
              if (h.tam === tam) h.p = p; else bloques.splice(i, 1, { ini: h.ini, tam, p }, { ini: h.ini + tam, tam: h.tam - tam, p: 0 });
              msg = `P${p} pide ${tam}: se coloca en el hueco que empieza en ${h.ini} (${h.tam}).`; ultimoFallo = false;
            }
          }
          yield;
        }
      })();
    }
    let ultimoFallo = false;
    function dibujar() {
      if (!bloques) return;
      const { ctx, ancho: W } = lienzo, x0 = 8, w = W - 16, y = 20, h = 50;
      lienzo.limpiar();
      for (const b of bloques) {
        const x = x0 + (b.ini / MEM) * w, bw = (b.tam / MEM) * w;
        ctx.fillStyle = b.p ? C.s1 : C.neutro; ctx.fillRect(x, y, bw - 1, h);
        ctx.strokeStyle = b.p ? C.s1 : C.eje; ctx.strokeRect(x + 0.5, y + 0.5, bw - 2, h - 1);
        ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = b.p ? C.sobre : C.tinta2; ctx.fillText(b.p ? `P${b.p}` : String(b.tam), x + bw / 2, y + h / 2, bw - 3);
      }
      if (ultimoFallo) { ctx.fillStyle = C.s8; ctx.beginPath(); ctx.arc(W - 14, 10, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('0', x0, y + h + 14); ctx.textAlign = 'right'; ctx.fillText(String(MEM), x0 + w, y + h + 14);
      const libre = huecos().reduce((a, b2) => a + b2.tam, 0), may = Math.max(0, ...huecos().map((b2) => b2.tam));
      registro.textContent = msg;
      lectura.set([['libre en total', `${libre} de ${MEM}`], ['mayor hueco', String(may)], ['fragmentación externa', libre ? `${VIZ.fmt((1 - may / libre) * 100, 3)} %` : '—'], ['huecos', String(huecos().length)], ['rechazos', `${fallos} de ${sol}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!bloques) return;
      const { x, y } = lienzo.posicion(ev), u = ((x - 8) / (lienzo.ancho - 16)) * MEM, b = bloques.find((q) => u >= q.ini && u < q.ini + q.tam);
      if (b && y > 20 && y < 70) tip.mostrar(x, y, b.p ? `<b>P${b.p}</b><br>inicio ${b.ini}, tamaño ${b.tam}` : `<b>hueco</b><br>inicio ${b.ini}, tamaño ${b.tam}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('memory-allocation', {
    intro: String.raw`
      <p>Si cada proceso ocupa un bloque contiguo de memoria, al llegar y terminar procesos de distintos tamaños van quedando <strong>huecos</strong> entre ellos. Puede haber memoria libre de sobra y aun así no caber un proceso, porque está repartida en trozos pequeños: <strong>fragmentación externa</strong>.</p>
      <p>Las políticas de colocación (primer, mejor y peor ajuste) y la <strong>compactación</strong> intentan limitar el problema; la <a href="tema.html?id=paging-address-translation">paginación</a> lo evita de raíz.</p>`,
    visualizaciones: [
      { titulo: 'Asignar y liberar con huecos', descripcion: 'Ejecute la misma secuencia con cada política y compare la fragmentación externa y los rechazos. Use «Compactar» cuando haya muchos huecos pequeños.', montar },
    ],
    teoria: String.raw`
      <h2>Políticas de colocación</h2>
      <table class="tabla-datos"><tr><th class="izq">Política</th><th class="izq">Elige</th><th class="izq">Efecto</th></tr>
      <tr><td class="izq">primer ajuste</td><td class="izq">el primer hueco suficiente</td><td class="izq">rápido; acumula residuos al comienzo</td></tr>
      <tr><td class="izq">mejor ajuste</td><td class="izq">el hueco suficiente más pequeño</td><td class="izq">deja huecos diminutos inútiles</td></tr>
      <tr><td class="izq">peor ajuste</td><td class="izq">el hueco más grande</td><td class="izq">deja huecos grandes, pero consume los grandes</td></tr></table>
      <p>En simulaciones clásicas, primer y mejor ajuste son parecidos y mejores que el peor.</p>
      <h2>Fragmentación</h2>
      <ul><li><strong>Externa</strong>: huecos libres que no sirven por separado. Regla del 50 %: con primer ajuste, por cada \(N\) bloques asignados se pierden en promedio \(0{,}5N\) por fragmentación, es decir, un tercio de la memoria.</li>
      <li><strong>Interna</strong>: memoria asignada pero no usada dentro de un bloque (aparece cuando se asigna en unidades fijas, como las <a href="tema.html?id=paging-address-translation">páginas</a>).</li></ul>
      <p>Una medida sencilla de la externa es \(F = 1 - \dfrac{\text{mayor hueco}}{\text{memoria libre total}}\). La <strong>compactación</strong> la lleva a 0, pero obliga a copiar memoria y a reubicar los procesos, lo que solo es posible si la traducción usa registros base (ver <a href="tema.html?id=base-limit-segmentation">base y límite</a>).</p>`,
  });
})();
