(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* Protocolos de exclusión mutua para dos procesos. Cada instrucción: { txt, ejec(s, i, j) → nuevo estado o null si está bloqueada }.
     Estado: { pc: [a, b], f: [f0, f1], turno }. La sección crítica es la instrucción marcada con cs. */
  const cp = (s) => ({ pc: s.pc.slice(), f: s.f.slice(), turno: s.turno });
  const sig = (s, i, k) => { const t = cp(s); t.pc[i] = k; return t; };
  const PROTOCOLOS = {
    nada: {
      nombre: 'Sin protocolo',
      codigo: [
        { txt: 'sección no crítica', ejec: (s, i) => sig(s, i, 1) },
        { txt: 'sección crítica', cs: true, ejec: (s, i) => sig(s, i, 0) },
      ],
    },
    verificar: {
      nombre: 'Verificar y después levantar la bandera',
      codigo: [
        { txt: 'sección no crítica', ejec: (s, i) => sig(s, i, 1) },
        { txt: 'esperar ¬flag[j]', ejec: (s, i, j) => (s.f[j] ? null : sig(s, i, 2)) },
        { txt: 'flag[i] ← 1', ejec: (s, i) => { const t = sig(s, i, 3); t.f[i] = 1; return t; } },
        { txt: 'sección crítica', cs: true, ejec: (s, i) => sig(s, i, 4) },
        { txt: 'flag[i] ← 0', ejec: (s, i) => { const t = sig(s, i, 0); t.f[i] = 0; return t; } },
      ],
    },
    levantar: {
      nombre: 'Levantar la bandera y después verificar',
      codigo: [
        { txt: 'sección no crítica', ejec: (s, i) => sig(s, i, 1) },
        { txt: 'flag[i] ← 1', ejec: (s, i) => { const t = sig(s, i, 2); t.f[i] = 1; return t; } },
        { txt: 'esperar ¬flag[j]', ejec: (s, i, j) => (s.f[j] ? null : sig(s, i, 3)) },
        { txt: 'sección crítica', cs: true, ejec: (s, i) => sig(s, i, 4) },
        { txt: 'flag[i] ← 0', ejec: (s, i) => { const t = sig(s, i, 0); t.f[i] = 0; return t; } },
      ],
    },
    peterson: {
      nombre: 'Peterson',
      codigo: [
        { txt: 'sección no crítica', ejec: (s, i) => sig(s, i, 1) },
        { txt: 'flag[i] ← 1', ejec: (s, i) => { const t = sig(s, i, 2); t.f[i] = 1; return t; } },
        { txt: 'turno ← j', ejec: (s, i, j) => { const t = sig(s, i, 3); t.turno = j; return t; } },
        { txt: 'esperar ¬flag[j] ∨ turno = i', ejec: (s, i, j) => (s.f[j] && s.turno !== i ? null : sig(s, i, 4)) },
        { txt: 'sección crítica', cs: true, ejec: (s, i) => sig(s, i, 5) },
        { txt: 'flag[i] ← 0', ejec: (s, i) => { const t = sig(s, i, 0); t.f[i] = 0; return t; } },
      ],
    },
  };

  const clave = (s) => `${s.pc[0]},${s.pc[1]},${s.f[0]}${s.f[1]},${s.turno}`;

  // Explora todos los estados alcanzables (BFS) intercalando los pasos de ambos procesos.
  function explorar(prot) {
    const cod = prot.codigo;
    const ini = { pc: [0, 0], f: [0, 0], turno: 0 };
    const estados = [ini], idx = new Map([[clave(ini), 0]]), aristas = [], prof = [0], padre = [-1];
    for (let h = 0; h < estados.length; h++) {
      const s = estados[h];
      for (let i = 0; i < 2; i++) {
        const t = cod[s.pc[i]].ejec(s, i, 1 - i);
        if (!t) continue;
        const k = clave(t);
        if (!idx.has(k)) { idx.set(k, estados.length); estados.push(t); prof.push(prof[h] + 1); padre.push(h); }
        aristas.push([h, idx.get(k), i]);
      }
    }
    const malo = estados.map((s) => cod[s.pc[0]].cs && cod[s.pc[1]].cs);
    const salidas = estados.map((_, h) => aristas.filter(([a]) => a === h).length);
    const atascado = salidas.map((x) => x === 0);
    return { estados, aristas, prof, padre, malo, atascado };
  }

  function montar(cuerpo) {
    const est = { prot: 'verificar', sel: -1 };
    let r, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Protocolo', valor: est.prot, opciones: Object.entries(PROTOCOLOS).map(([k, p]) => [k, p.nombre]), alCambiar: (v) => { est.prot = v; est.sel = -1; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 360 : 340) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'estado inicial', forma: 'punto' }, { color: C.s8, texto: 'viola la seguridad: ambos en la sección crítica', forma: 'punto' },
      { color: C.s4, texto: 'sin salida: interbloqueo', forma: 'punto' }, { color: C.s2, texto: 'camino al problema (contraejemplo)', forma: 'linea' },
    ]);
    const codigo = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(codigo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un estado (contadores de programa y variables) y cada flecha, un paso de uno de los procesos; las columnas son la distancia al inicio. Haga clic en un estado para ver el camino que lleva a él.');

    function calcular() { r = explorar(PROTOCOLOS[est.prot]); dibujar(); }
    const camino = (h) => { const c = []; while (h >= 0) { c.unshift(h); h = r.padre[h]; } return c; };

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cod = PROTOCOLOS[est.prot].codigo;
      const maxP = Math.max(...r.prof);
      const porCapa = {};
      r.estados.forEach((_, h) => { (porCapa[r.prof[h]] = porCapa[r.prof[h]] || []).push(h); });
      geo = r.estados.map((_, h) => {
        const capa = porCapa[r.prof[h]], k = capa.indexOf(h);
        return { x: 24 + (r.prof[h] / Math.max(1, maxP)) * (W - 48), y: 20 + ((k + 0.5) / capa.length) * (H - 40) };
      });
      const objetivo = est.sel >= 0 ? est.sel : r.malo.indexOf(true) >= 0 ? r.malo.indexOf(true) : r.atascado.indexOf(true);
      const cam = objetivo >= 0 ? camino(objetivo) : [];
      const enCam = new Set(cam.slice(1).map((h, i) => `${cam[i]}-${h}`));
      for (const [a, b] of r.aristas) {
        const p = geo[a], q = geo[b], usa = enCam.has(`${a}-${b}`);
        ctx.strokeStyle = usa ? C.s2 : C.tenue; ctx.lineWidth = usa ? 2.5 : 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      r.estados.forEach((s, h) => {
        const col = r.malo[h] ? C.s8 : r.atascado[h] ? C.s4 : h === 0 ? C.s1 : C.tinta2;
        VIZ.marcador(ctx, geo[h].x, geo[h].y, col, r.malo[h] || r.atascado[h] || h === 0 ? 6 : 3.5);
        if (h === est.sel) { ctx.beginPath(); ctx.arc(geo[h].x, geo[h].y, 9, 0, Math.PI * 2); ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
      });
      // Código y el estado final del camino.
      const fin = objetivo >= 0 ? r.estados[objetivo] : null;
      codigo.replaceChildren(...cod.map((ins, k) => el('div', { class: fin && fin.pc.includes(k) ? 'activa' : null },
        `${String(k).padStart(2)}  ${ins.txt.padEnd(30)} ${fin ? [0, 1].filter((i) => fin.pc[i] === k).map((i) => `← P${i}`).join(' ') : ''}`)));
      const nMalo = r.malo.filter(Boolean).length, nAt = r.atascado.filter(Boolean).length;
      const pasos = cam.slice(1).map((h, i) => r.aristas.find(([a, b]) => a === cam[i] && b === h)[2]);
      registro.textContent = est.sel >= 0 ? `Estado ${clave(r.estados[est.sel])} (pc0, pc1, banderas, turno), alcanzable en ${cam.length - 1} pasos: ${pasos.map((i) => `P${i}`).join(' ') || 'es el inicial'}.`
        : nMalo ? `Seguridad violada: la intercalación ${pasos.map((i) => `P${i}`).join(' ')} lleva a ambos procesos a la sección crítica.`
          : nAt ? `Seguro, pero hay interbloqueo: con ${pasos.map((i) => `P${i}`).join(' ')} ambos levantan su bandera y cada uno espera para siempre al otro.`
            : 'Ningún estado alcanzable viola la exclusión mutua ni deja a los procesos sin poder avanzar.';
      lectura.set([
        ['estados alcanzables', String(r.estados.length)],
        ['transiciones', String(r.aristas.length)],
        ['violan la seguridad', String(nMalo)],
        ['sin salida (interbloqueo)', String(nAt)],
        ['contraejemplo más corto', objetivo >= 0 && est.sel < 0 ? `${cam.length - 1} pasos` : '—'],
      ]);
    }
    lienzo.alDibujar = () => r && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = VIZ.dist.cercano(geo, x, y, 12);
      est.sel = h === est.sel ? -1 : h;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = VIZ.dist.cercano(geo, x, y, 10);
      if (h < 0) return tip.ocultar();
      const s = r.estados[h], cod = PROTOCOLOS[est.prot].codigo;
      tip.mostrar(x, y, `P0: <b>${cod[s.pc[0]].txt}</b><br>P1: <b>${cod[s.pc[1]].txt}</b><br>flag = [${s.f.join(', ')}]${est.prot === 'peterson' ? `, turno = ${s.turno}` : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('safety-liveness', {
    intro: String.raw`
      <p>Para afirmar que un algoritmo distribuido es correcto hay que decir qué significa «correcto». Lamport (1977) propuso separar las propiedades en dos clases.
      Una propiedad de <strong>seguridad</strong> (<em>safety</em>) dice que <em>nunca pasa nada malo</em>: dos procesos nunca están a la vez en la sección crítica, dos réplicas nunca
      deciden valores distintos. Una de <strong>vivacidad</strong> (<em>liveness</em>) dice que <em>algo bueno termina pasando</em>: todo pedido es atendido, el algoritmo termina.</p>
      <p>La diferencia importa porque se demuestran distinto: la seguridad con <strong>invariantes</strong> (una propiedad de cada estado alcanzable), la vivacidad con argumentos de
      progreso. Y para sistemas pequeños se pueden verificar las dos explorando <em>todos</em> los estados posibles, que es lo que hacen los verificadores de modelos como TLA+ o SPIN.</p>`,
    visualizaciones: [
      {
        titulo: 'Explorar todos los estados',
        descripcion: 'Elija un protocolo de exclusión mutua para dos procesos y observe su grafo de estados completo. Los dos intentos ingenuos fallan de formas distintas: uno viola la seguridad (rojo) y el otro, la vivacidad (amarillo). Peterson no tiene ninguno de los dos.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Seguridad y vivacidad</h2>
      <p>Formalmente, una propiedad es un conjunto de ejecuciones infinitas. Es de <strong>seguridad</strong> si toda ejecución que la viola tiene un prefijo finito tras el cual ya no hay remedio:
      el contraejemplo es finito (un camino hasta un estado malo, como el camino naranjo de la figura). Es de <strong>vivacidad</strong> si todo prefijo finito puede extenderse para cumplirla: ningún
      prefijo la refuta, y el contraejemplo es infinito (un ciclo en el que nunca pasa lo bueno). Alpern y Schneider (1985) probaron que toda propiedad es la intersección de una de seguridad y una
      de vivacidad.</p>
      <table>
        <tr><th>Algoritmo</th><th>Seguridad</th><th>Vivacidad</th></tr>
        <tr><td><a href="tema.html?id=mutual-exclusion">Exclusión mutua</a></td><td>A lo más uno en la sección crítica</td><td>Todo pedido termina atendido</td></tr>
        <tr><td><a href="tema.html?id=paxos">Consenso</a></td><td>Acuerdo y validez</td><td>Terminación</td></tr>
        <tr><td><a href="tema.html?id=termination-detection">Detección de terminación</a></td><td>No declarar antes de tiempo</td><td>Declarar si terminó</td></tr>
        <tr><td><a href="tema.html?id=chandy-lamport">Instantánea</a></td><td>El estado registrado es consistente</td><td>El registro termina</td></tr>
      </table>

      <h2>Invariantes</h2>
      <p>Para probar seguridad se busca un <strong>invariante inductivo</strong> \(I\): vale en el estado inicial, se conserva en cada transición y implica la propiedad. Para Peterson:</p>
      \[ \text{en\_cs}_i \Rightarrow \text{flag}_i \land \big(\neg\text{flag}_j \lor \text{turno} = i \lor \text{pc}_j = \text{«turno} \leftarrow i\text{»}\big). \]
      <p>Si ambos estuvieran en la sección crítica, los dos últimos en escribir <code>turno</code> se contradicen. La exploración exhaustiva de la figura es la versión mecánica: verifica la
      propiedad en todos los estados alcanzables, que es exactamente lo que el invariante resume.</p>

      <h2>Equidad</h2>
      <p>La vivacidad casi nunca vale sin supuestos sobre el planificador. La <strong>equidad débil</strong> pide que un proceso que puede avanzar continuamente termine avanzando; la <strong>fuerte</strong>,
      que avance si puede hacerlo infinitas veces. Peterson garantiza que nadie espera para siempre bajo equidad débil (espera acotada: a lo más una entrada del otro). Sin equidad, un planificador
      adversario puede no ejecutar nunca a un proceso, y ningún algoritmo lo salva.</p>

      <h2>El costo de explorar</h2>
      <p>El número de estados crece exponencialmente con los procesos y las variables (<em>explosión de estados</em>): \(k\) procesos con \(p\) posiciones cada uno ya dan \(p^k\) combinaciones.
      Los verificadores usan reducción por orden parcial, simetría y representaciones simbólicas; aun así, para algoritmos con muchos procesos se combinan pruebas manuales con invariantes y
      verificación de instancias pequeñas, donde suelen aparecer los errores.</p>`,
  });
})();
