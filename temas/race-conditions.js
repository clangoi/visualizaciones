(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const INS = ['leer contador → r', 'r ← r + 1', 'escribir r → contador'];

  function montarManual(cuerpo) {
    let mem, hilos, msg, hist;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Avanza A', () => avanzar(0));
    ctl.boton('Avanza B', () => avanzar(1));
    ctl.boton('Intercalado al azar', () => { let g = 0; while (!fin() && g++ < 20) { const v = [0, 1].filter((i) => hilos[i].pc < 3); avanzar(v[Math.floor(Math.random() * v.length)]); } }, { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'hilo A' }, { color: C.s2, texto: 'hilo B' }, { color: C.s8, texto: 'actualización perdida', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada hilo ejecuta contador++ (leer, sumar, escribir). Avance uno u otro a mano: si ambos leen antes de que alguien escriba, se pierde un incremento.');
    const fin = () => hilos.every((h) => h.pc >= 3);
    function reiniciar() { mem = 0; hilos = [{ pc: 0, r: null }, { pc: 0, r: null }]; hist = []; msg = 'contador = 0. Cada hilo debe sumar 1; el resultado correcto es 2.'; dibujar(); }
    function avanzar(i) {
      const h = hilos[i];
      if (h.pc >= 3) return;
      const n = 'AB'[i];
      if (h.pc === 0) { h.r = mem; msg = `${n} lee contador = ${mem}.`; }
      else if (h.pc === 1) { h.r++; msg = `${n} calcula r = ${h.r}.`; }
      else { mem = h.r; msg = `${n} escribe ${h.r} en contador.`; }
      h.pc++; hist.push(n); dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const bw = Math.min(190, (W - 40) / 2.4);
      hilos.forEach((h, i) => {
        const x = i ? W - bw - 8 : 8, col = i ? C.s2 : C.s1;
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x, 10, bw, 110);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Hilo ' + 'AB'[i] + `  (r = ${h.r ?? '—'})`, x + 6, 24);
        ctx.font = VIZ.fuente(10);
        INS.forEach((t, j) => { if (h.pc === j) { ctx.fillStyle = VIZ.alfa(col, 0.18); ctx.fillRect(x + 3, 41 + j * 24, bw - 6, 20); } ctx.fillStyle = h.pc > j ? C.apagado : C.tinta; ctx.fillText(`${h.pc === j ? '▸' : h.pc > j ? '✓' : ' '} ${t}`, x + 7, 51 + j * 24, bw - 12); });
      });
      const mal = fin() && mem !== 2;
      ctx.strokeStyle = mal ? C.s8 : C.tinta; ctx.lineWidth = mal ? 3 : 1.5; ctx.strokeRect(W / 2 - 40, 40, 80, 50);
      ctx.fillStyle = mal ? C.s8 : C.tinta; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(10); ctx.fillText('contador', W / 2, 52); ctx.font = VIZ.fuente(18, 700); ctx.fillText(String(mem), W / 2, 74);
      ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText('orden: ' + (hist.join(' ') || '—'), 8, 150);
      registro.textContent = fin() ? `${msg} ${mem === 2 ? 'Resultado correcto: 2.' : 'Resultado incorrecto: 1. Se perdió una actualización.'}` : msg;
      lectura.set([['contador', String(mem)], ['esperado', '2'], ['estado', !fin() ? 'en curso' : mem === 2 ? 'correcto' : 'carrera: se perdió un incremento']]);
    }
    lienzo.alDibujar = () => hilos && dibujar();
    reiniciar();
  }

  function montarDistribucion(cuerpo) {
    let nh = 4, inc = 10, sem = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Hilos', min: 2, max: 8, valor: nh, alCambiar: (v) => { nh = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Incrementos por hilo', min: 1, max: 30, valor: inc, alCambiar: (v) => { inc = v; dibujar(); } });
    ctl.boton('Otras 500 ejecuciones', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'serie única: frecuencia de cada resultado (eje x)';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada ejecución intercala al azar las instrucciones de todos los hilos sin ninguna sincronización. El resultado correcto es hilos × incrementos (barra oscura).');
    let cajas = [];
    function una(rnd) {
      let mem = 0; const h = Array.from({ length: nh }, () => ({ pc: 0, r: 0, k: 0 })); let vivos = nh;
      while (vivos) {
        const i = Math.floor(rnd() * nh), x = h[i];
        if (x.k >= inc) continue;
        if (x.pc === 0) x.r = mem; else if (x.pc === 1) x.r++; else mem = x.r;
        if (++x.pc === 3) { x.pc = 0; if (++x.k >= inc) vivos--; }
      }
      return mem;
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(sem * 977 + nh * 31 + inc), res = Array.from({ length: 500 }, () => una(rnd)), esp = nh * inc;
      const cnt = new Map(); res.forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1));
      const lo = Math.min(...res), hi = esp, nb = Math.min(hi - lo + 1, 40), ancho = (hi - lo + 1) / nb, bins = Array(nb).fill(0);
      res.forEach((v) => { bins[Math.min(nb - 1, Math.floor((v - lo) / ancho))]++; });
      const mx = Math.max(...bins), izq = 40, base = H - 28, bw = (W - izq - 10) / nb;
      cajas = [];
      bins.forEach((b, i) => {
        const h = (b / mx) * (base - 14), ok = lo + (i + 1) * ancho > esp;
        ctx.fillStyle = ok ? C.tinta : C.s1; ctx.beginPath(); ctx.roundRect(izq + i * bw + 1, base - h, bw - 2, h, [4, 4, 0, 0]); ctx.fill();
        cajas.push({ x: izq + i * bw, w: bw, de: Math.ceil(lo + i * ancho), a: Math.floor(lo + (i + 1) * ancho - 1e-9), b });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - 10, base + 0.5); ctx.stroke();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(String(lo), izq, base + 6); ctx.textAlign = 'right'; ctx.fillText(String(hi), W - 10, base + 6);
      ctx.textAlign = 'left'; ctx.fillText('frecuencia', 4, 2);
      lectura.set([['valor correcto', String(esp)], ['ejecuciones correctas', `${cnt.get(esp) || 0} de 500`], ['resultado mínimo', String(lo)], ['incrementos perdidos (media)', VIZ.fmt(esp - res.reduce((a, b) => a + b, 0) / 500, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = cajas.find((b) => x >= b.x && x < b.x + b.w);
      if (c) tip.mostrar(x, y, `resultado ${c.de === c.a ? c.de : c.de + '–' + c.a}<br><b>${c.b}</b> ejecuciones`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('race-conditions', {
    intro: String.raw`
      <p>Cuando dos hilos leen y escriben el mismo dato sin coordinarse, el resultado depende del orden exacto en que el planificador intercala sus instrucciones: es una <strong>condición de carrera</strong>. Lo traicionero es que el programa a veces funciona y a veces no, y los errores desaparecen al depurar.</p>
      <p>El ejemplo mínimo es <code>contador++</code>, que parece una sola operación pero son tres: leer, sumar, escribir. Si dos hilos intercalan esos pasos, un incremento se pierde.</p>`,
    visualizaciones: [
      { titulo: 'Dos hilos, un contador', descripcion: 'Avance A y B a mano. Pruebe «A lee, B lee, A escribe, B escribe» para provocar la pérdida; luego use el intercalado al azar.', montar: montarManual },
      { titulo: 'Qué tan frecuente es el error', descripcion: 'Con más hilos e incrementos casi nunca se obtiene el valor correcto, y el error es impredecible de una ejecución a otra.', montar: montarDistribucion },
    ],
    teoria: String.raw`
      <h2>Sección crítica</h2>
      <p>Una <strong>sección crítica</strong> es el fragmento de código que accede a datos compartidos y que debe ejecutarse sin que otro hilo acceda a esos datos a la vez. Una solución correcta debe cumplir:</p>
      <ol><li><strong>Exclusión mutua</strong>: a lo más un hilo dentro.</li><li><strong>Progreso</strong>: si nadie está dentro y alguien quiere entrar, la decisión no se posterga indefinidamente.</li><li><strong>Espera acotada</strong>: ningún hilo espera para siempre mientras otros entran una y otra vez.</li></ol>
      <h2>Cuántas intercalaciones hay</h2>
      <p>Con dos hilos de 3 instrucciones, hay \(\binom{6}{3} = 20\) intercalaciones posibles. El resultado es 2 solo cuando los accesos no se solapan: de las 20, únicamente 2 (todo A luego todo B, o al revés) son seriales, y en varias más el resultado es 2 por casualidad; en el resto es 1.</p>
      <p>Con \(n\) hilos de \(m\) instrucciones, el número de intercalaciones es el multinomial \(\dfrac{(nm)!}{(m!)^n}\), imposible de probar exhaustivamente: por eso hay que <em>diseñar</em> la exclusión mutua, no depender de pruebas.</p>
      <h2>Soluciones</h2>
      <p>Proteger la sección crítica con un <a href="tema.html?id=locks-atomics">lock o una instrucción atómica</a>, o coordinar con <a href="tema.html?id=semaphores">semáforos</a> y <a href="tema.html?id=bounded-buffer-condvars">variables de condición</a>. En el caso del contador, una operación atómica de incremento (<em>fetch-and-add</em>) basta.</p>`,
  });
})();
