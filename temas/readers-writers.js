(function () {
  'use strict';
  const { color: C } = VIZ;
  const POL = { lectores: 'Prioridad a lectores', escritores: 'Prioridad a escritores', justo: 'Justa (orden de llegada)' };

  function carga(tipo, sem) {
    if (tipo === 'continuo') return [{ nombre: 'L1', w: 0, llegada: 0, rafaga: 4 }, { nombre: 'E1', w: 1, llegada: 1, rafaga: 2 }, { nombre: 'L2', w: 0, llegada: 2, rafaga: 4 }, { nombre: 'L3', w: 0, llegada: 4, rafaga: 4 }, { nombre: 'L4', w: 0, llegada: 6, rafaga: 4 }, { nombre: 'L5', w: 0, llegada: 8, rafaga: 4 }, { nombre: 'E2', w: 1, llegada: 9, rafaga: 2 }];
    const rnd = VIZ.semilla(sem * 17 + 3), L = [];
    for (let i = 0; i < 8; i++) L.push({ w: rnd() < 0.3 ? 1 : 0, llegada: Math.floor(rnd() * 10), rafaga: 2 + Math.floor(rnd() * 4) });
    L.sort((a, b) => a.llegada - b.llegada);
    let l = 0, e = 0;
    return L.map((x) => ({ ...x, nombre: x.w ? 'E' + ++e : 'L' + ++l }));
  }

  function simular(P, pol) {
    const n = P.length, ini = Array(n).fill(null), fin = Array(n).fill(null);
    let t = 0, cola = [], act = [];
    while (fin.some((x) => x === null) && t < 300) {
      act = act.filter((i) => { if (fin[i] === t) return false; return true; });
      P.forEach((p, i) => { if (p.llegada === t) cola.push(i); });
      const hayE = () => act.some((i) => P[i].w), nAct = () => act.length;
      const entrar = (i) => { cola.splice(cola.indexOf(i), 1); act.push(i); ini[i] = t; fin[i] = t + P[i].rafaga; };
      let seguir = true;
      while (seguir) {
        seguir = false;
        const lect = cola.filter((i) => !P[i].w), escr = cola.filter((i) => P[i].w);
        if (pol === 'justo') {
          const h = cola[0];
          if (h !== undefined && (P[h].w ? nAct() === 0 : !hayE())) { entrar(h); seguir = true; }
        } else if (pol === 'lectores') {
          if (!hayE() && lect.length) { entrar(lect[0]); seguir = true; } else if (nAct() === 0 && !lect.length && escr.length) { entrar(escr[0]); seguir = true; }
        } else if (nAct() === 0 && escr.length) { entrar(escr[0]); seguir = true; }
        else if (!hayE() && !escr.length && lect.length) { entrar(lect[0]); seguir = true; }
      }
      t++;
    }
    return { ini, fin, total: Math.max(...fin.map((x) => x ?? 0)) };
  }

  function montar(cuerpo) {
    let pol = 'lectores', tipo = 'continuo', sem = 1, P, r, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Política', opciones: Object.entries(POL), valor: pol, alCambiar: (v) => { pol = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Carga', opciones: [['continuo', 'Lectores continuos con dos escritores'], ['azar', 'Llegadas al azar']], valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 38 + (tipo === 'continuo' ? 7 : 8) * 26 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'lector (acceso compartido)' }, { color: C.s2, texto: 'escritor (acceso exclusivo)' }, { color: C.neutro, borde: C.eje, texto: 'espera' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los lectores pueden solaparse entre sí; un escritor necesita el recurso para él solo. Con prioridad a lectores y lectores continuos, el escritor no entra hasta el final.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      P = carga(tipo, sem); r = simular(P, pol);
      const res = { total: r.total, segs: P.map((p, i) => ({ p: i, ini: r.ini[i], fin: r.fin[i] })), por: P.map((p, i) => ({ fin: r.fin[i] })) };
      geo = VIZ.sor.gantt(lienzo, P, res, r.total, { fila: 26, colores: (i) => (P[i].w ? C.s2 : C.s1) });
      const esp = (w) => { const v = P.map((p, i) => [p, r.ini[i] - p.llegada]).filter(([p]) => !!p.w === w).map(([, e]) => e); return v.length ? v : [0]; };
      const prom = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      lectura.set([['espera media de lectores', VIZ.fmt(prom(esp(false)), 3)], ['espera media de escritores', VIZ.fmt(prom(esp(true)), 3)], ['espera máxima de un escritor', String(Math.max(...esp(true)))], ['tiempo total', String(r.total)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !P) return;
      const { x, y } = lienzo.posicion(ev), i = Math.floor((y - geo.sup) / geo.fila);
      if (P[i]) tip.mostrar(x, y, `<b>${P[i].nombre}</b> (${P[i].w ? 'escritor' : 'lector'})<br>llegó en ${P[i].llegada}<br>accede de ${r.ini[i]} a ${r.fin[i]}<br>espera ${r.ini[i] - P[i].llegada}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('readers-writers', {
    intro: String.raw`
      <p>Muchas estructuras (una base de datos, una caché, una tabla de configuración) se leen mucho más de lo que se escriben. Dejar que <strong>varios lectores</strong> accedan a la vez es seguro porque no modifican nada; en cambio un <strong>escritor</strong> necesita acceso exclusivo. Es el problema de <strong>lectores y escritores</strong>.</p>
      <p>La dificultad no es la exclusión, sino la política: si siempre se favorece a los lectores, los escritores pueden esperar para siempre; si se favorece a los escritores, pueden hacerlo los lectores.</p>`,
    visualizaciones: [
      { titulo: 'Tres políticas de acceso', descripcion: 'Con lectores continuos, compare la espera de los escritores en cada política. Cambie a la carga al azar para ver un caso menos extremo.', montar },
    ],
    teoria: String.raw`
      <h2>Solución con semáforos (prioridad a lectores)</h2>
      <pre><code>lectores ← 0;  mutex ← 1;  escritura ← 1

lector:                             escritor:
    P(mutex)                            P(escritura)
    lectores ← lectores + 1             escribir
    si lectores = 1:  P(escritura)      V(escritura)
    V(mutex)
    leer
    P(mutex)
    lectores ← lectores − 1
    si lectores = 0:  V(escritura)
    V(mutex)</code></pre>
      <p>El primer lector cierra la puerta a los escritores y el último la abre. Mientras llegue un lector antes de que se vaya el último, los escritores no pasan: <strong>inanición del escritor</strong>.</p>
      <h2>Políticas</h2>
      <table class="tabla-datos"><tr><th class="izq">Política</th><th class="izq">Ventaja</th><th class="izq">Riesgo</th></tr>
      <tr><td class="izq">prioridad a lectores</td><td class="izq">máxima concurrencia</td><td class="izq">inanición de escritores</td></tr>
      <tr><td class="izq">prioridad a escritores</td><td class="izq">datos frescos</td><td class="izq">inanición de lectores</td></tr>
      <tr><td class="izq">justa (FIFO)</td><td class="izq">sin inanición</td><td class="izq">menos solapamiento de lectores</td></tr></table>
      <p>Los sistemas reales ofrecen <em>locks de lectura/escritura</em> (<code>pthread_rwlock</code>) con alguna de estas políticas, o evitan el problema leyendo versiones inmutables. Ver también el <a href="tema.html?id=bounded-buffer-condvars">productor–consumidor</a> y los <a href="tema.html?id=dining-philosophers">filósofos comensales</a>.</p>
      <h2>Ganancia posible</h2>
      <p>Si una fracción \(f\) de los accesos son lecturas y hay \(p\) núcleos, un lock exclusivo serializa todo (aceleración 1), mientras que uno de lectura/escritura puede acercarse a \(\dfrac{1}{(1-f) + f/p}\), igual que en la <a href="tema.html?id=threads-models">ley de Amdahl</a>.</p>`,
  });
})();
