(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const G = VIZ.grafo;

  /* Algoritmo de eco (Chang, 1982). Cada mensaje lleva el conjunto de aristas que conoce el subárbol del emisor.
     modo 'sinc': en cada paso se entregan todos los mensajes en vuelo; 'asinc': uno al azar. */
  function simular(g, ini, modo, semilla) {
    const n = g.nodos.length, ady = G.adyacencia(g);
    const rnd = VIZ.semilla(semilla);
    const clave = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const padre = new Array(n).fill(-1), recibidos = new Array(n).fill(0), conoce = Array.from({ length: n }, () => new Set());
    const estado = new Array(n).fill('nuevo');
    for (let v = 0; v < n; v++) for (const { v: w } of ady[v]) conoce[v].add(clave(v, w));
    let vuelo = [], sondas = 0, ecos = 0;
    const pasos = [];
    const enviar = (de, a, tipo) => { vuelo.push({ de, a, tipo, aristas: tipo === 'eco' ? new Set(conoce[de]) : null }); if (tipo === 'sonda') sondas++; else ecos++; };
    estado[ini] = 'activo';
    for (const { v } of ady[ini]) enviar(ini, v, 'sonda');
    pasos.push({ entregados: [], vuelo: vuelo.slice(), padre: padre.slice(), estado: estado.slice(), recibidos: recibidos.slice(), conoceIni: new Set(conoce[ini]), sondas, ecos, nota: `${g.nodos[ini].etiqueta} envía sondas a sus ${ady[ini].length} vecinos.` });
    for (let g2 = 0; g2 < 10 * n * n && vuelo.length; g2++) {
      let lote;
      if (modo === 'sinc') { lote = vuelo; vuelo = []; }
      else { const i = Math.floor(rnd() * vuelo.length); lote = [vuelo[i]]; vuelo.splice(i, 1); }
      const notas = [];
      for (const m of lote) {
        const v = m.a, L = g.nodos[v].etiqueta, De = g.nodos[m.de].etiqueta;
        recibidos[v]++;
        if (m.aristas) for (const e of m.aristas) conoce[v].add(e);
        if (estado[v] === 'nuevo' && m.tipo === 'sonda') {
          estado[v] = 'activo'; padre[v] = m.de;
          for (const { v: w } of ady[v]) if (w !== m.de) enviar(v, w, 'sonda');
          notas.push(`${L} recibe su primera sonda (de ${De}): ${De} es su padre`);
        } else if (m.tipo === 'eco') notas.push(`${L} recibe el eco de ${De}`);
        else notas.push(`${L} ya tenía padre: la sonda de ${De} cuenta como respuesta`);
        if (estado[v] === 'activo' && recibidos[v] === ady[v].length) {
          if (v === ini) { estado[v] = 'listo'; notas.push(`${L} recibió de todos sus vecinos: el algoritmo termina`); }
          else { estado[v] = 'listo'; enviar(v, padre[v], 'eco'); notas.push(`${L} completó a sus ${ady[v].length} vecinos y envía eco a ${g.nodos[padre[v]].etiqueta}`); }
        }
      }
      pasos.push({ entregados: lote, vuelo: vuelo.slice(), padre: padre.slice(), estado: estado.slice(), recibidos: recibidos.slice(), conoceIni: new Set(conoce[ini]), sondas, ecos, nota: notas.join('; ') });
    }
    return { pasos, ady };
  }

  function montar(cuerpo) {
    const est = { modo: 'asinc', semilla: 5, ini: 0, nodos: 11 };
    let g, sim, k = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entrega de mensajes', valor: est.modo, opciones: [['asinc', 'asíncrona: uno al azar por paso'], ['sinc', 'síncrona: todos los del paso']], alCambiar: (v) => { est.modo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Nodos', min: 5, max: 16, valor: est.nodos, alCambiar: (v) => { est.nodos = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nueva red', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 300, altoMax: 420 });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'sonda en vuelo', forma: 'linea' },
      { color: C.s3, texto: 'eco en vuelo (lleva aristas)', forma: 'linea' },
      { color: C.s1, texto: 'arista del árbol (hijo → padre)', forma: 'linea' },
      { color: C.s4, texto: 'activo: esperando respuestas', forma: 'punto' },
      { color: C.s6, texto: 'ya envió su eco', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Topología que conoce el iniciador:');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 170, altoMax: 260 });
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para que inicie él. Bajo cada nodo, cuántos vecinos ya le respondieron (sonda o eco) sobre su grado.');

    function nuevo() { g = G.generar({ n: est.nodos, grado: 2.8, semilla: est.semilla * 7 + est.nodos }); est.ini = Math.min(est.ini, g.nodos.length - 1); rep.reiniciar(); }
    function iniciar() {
      sim = simular(g, est.ini, est.modo, est.semilla * 3 + 1);
      k = 0;
      return (function* () { for (k = 1; k < sim.pasos.length; k++) yield; k = sim.pasos.length - 1; })();
    }

    function dibujar() {
      const ps = sim.pasos[k];
      lienzo.limpiar();
      const arbol = (a) => ps.padre[a.u] === a.v || ps.padre[a.v] === a.u;
      geo = G.dibujar(lienzo, g, {
        arista: (a) => (arbol(a) ? { color: C.s1, ancho: 3.5 } : { color: C.eje }),
        nodo: (i) => ({
          relleno: ps.estado[i] === 'listo' ? C.s6 : ps.estado[i] === 'activo' ? C.s4 : C.superficie,
          texto: ps.estado[i] === 'listo' ? C.sobre : C.tinta, anillo: i === est.ini ? C.s1 : null,
        }),
        debajo: (i) => `${ps.recibidos[i]}/${sim.ady[i].length}`,
        colorDebajo: () => C.tinta2,
      });
      const { ctx } = lienzo;
      for (const m of ps.vuelo) D.mensaje(ctx, geo.pos[m.de], geo.pos[m.a], geo.r, { color: m.tipo === 'sonda' ? C.s2 : C.s3, ancho: 2, curva: 8, guiones: m.tipo === 'sonda' ? [5, 3] : null });
      for (const m of ps.entregados) D.mensaje(ctx, geo.pos[m.de], geo.pos[m.a], geo.r, { color: m.tipo === 'sonda' ? C.s2 : C.s3, ancho: 3.5, curva: 8 });
      // Topología conocida por el iniciador.
      lienzo2.limpiar();
      const conocidas = ps.conoceIni;
      G.dibujar(lienzo2, g, {
        arista: (a) => (conocidas.has(a.u < a.v ? `${a.u}-${a.v}` : `${a.v}-${a.u}`) ? { color: C.tinta, ancho: 1.8 } : { color: C.superficie, ancho: 0.1 }),
        nodo: (i) => {
          const visto = [...conocidas].some((e) => e.split('-').map(Number).includes(i));
          return visto ? { relleno: i === est.ini ? C.s1 : C.superficie, texto: i === est.ini ? C.sobre : C.tinta } : { relleno: C.superficie, borde: C.tenue, texto: C.tenue };
        },
      });
      const E = g.aristas.length;
      registro.textContent = k === sim.pasos.length - 1 && k > 0 ? `${ps.nota}. Cada arista llevó exactamente dos mensajes: ${ps.sondas + ps.ecos} = 2·|E|. El iniciador conoce las ${conocidas.size} aristas de la red.` : `Paso ${k}: ${ps.nota}.`;
      lectura.set([
        ['paso', `${k} de ${sim.pasos.length - 1}`],
        ['sondas', String(ps.sondas)],
        ['ecos', String(ps.ecos)],
        ['2·|E|', String(2 * E)],
        ['aristas conocidas', `${conocidas.size} de ${E}`],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    lienzo2.alDibujar = () => sim && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i >= 0) { est.ini = i; rep.reiniciar(); }
    });
    nuevo();
  }

  VIZ.registrarTema('probe-echo', {
    intro: String.raw`
      <p>Muchas tareas distribuidas empiezan por recorrer la red: difundir un aviso y saber cuándo llegó a todos, contar nodos, calcular un mínimo
      global o descubrir la topología. El <strong>algoritmo de eco</strong> (Chang, 1982), también llamado <em>probe/echo</em>, lo hace en dos
      ondas: las <strong>sondas</strong> se expanden desde el iniciador como una inundación, y los <strong>ecos</strong> regresan hacia él por
      el árbol que las sondas dejaron formado.</p>
      <p>Cuando el iniciador recibe respuesta de todos sus vecinos, sabe que todos los nodos fueron alcanzados, y si los ecos llevan información
      (por ejemplo, las aristas que cada subárbol conoce), la tiene completa.</p>`,
    visualizaciones: [
      {
        titulo: 'Sondas y ecos',
        descripcion: 'Avance paso a paso. Las aristas azules forman el árbol de expansión (cada nodo apunta a quien le envió la primera sonda). Con entrega asíncrona el árbol cambia de forma; el número de mensajes, no.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>iniciador:
    enviar SONDA a todos los vecinos
    al recibir un mensaje de cada vecino: terminar

otro nodo v, al recibir el primer mensaje (una SONDA de u):
    padre ← u
    enviar SONDA a todos los vecinos salvo u
al recibir un mensaje (sonda o eco) de cada vecino:
    enviar ECO al padre (con la información del subárbol)</code></pre>
      <p>Una sonda que llega a un nodo que ya tiene padre no se reenvía: solo cuenta como respuesta de ese vecino.</p>

      <h2>Corrección</h2>
      <ul>
        <li><strong>Árbol:</strong> cada nodo distinto del iniciador elige un único padre, que fue alcanzado antes que él; los punteros a padre forman un árbol
        con raíz en el iniciador (no hay ciclos porque los instantes de alcance decrecen hacia la raíz).</li>
        <li><strong>Terminación:</strong> por inducción desde las hojas del árbol: un nodo envía su eco después de haber recibido el eco de todos sus hijos (que son
        vecinos), y una hoja recibe pronto respuesta de todos sus vecinos, que ya fueron alcanzados.</li>
        <li><strong>Completitud:</strong> el iniciador termina solo después de que todos sus hijos enviaron eco, y cada eco certifica todo su subárbol: en ese momento
        todos los nodos fueron alcanzados.</li>
      </ul>

      <h2>Costo</h2>
      <div class="recuadro"><p>Por cada arista \(\{u, v\}\) viajan exactamente dos mensajes: sonda y eco (si es del árbol) o una sonda en cada sentido
      (si no lo es). En total, \(2|E|\) mensajes.</p></div>
      <p>En tiempo, con entrega síncrona, las sondas tardan la excentricidad del iniciador en llegar a todos y los ecos otro tanto: \(O(D)\), con \(D\) el diámetro.
      Las variantes de inundación con eco calculan sumas (contar nodos: cada eco lleva el tamaño del subárbol), mínimos, o construyen un árbol para
      difusiones posteriores. Es la base de la detección de terminación de Dijkstra–Scholten (ver
      <a href="tema.html?id=termination-detection">detección de terminación</a>) y del algoritmo de elección por ondas.</p>`,
  });
})();
