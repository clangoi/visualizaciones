(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const ZONAS = ['Programa (usuario)', 'Núcleo', 'Hardware'];
  const CASOS = {
    legitimo: {
      nombre: 'Programa pide leer un archivo (read)',
      pasos: [
        [0, 'Modo usuario: el programa llama a read(fd, buf, n) en la biblioteca.'],
        [0, 'La biblioteca coloca el número de la llamada en un registro y ejecuta la instrucción de trampa (syscall).'],
        [1, 'El hardware conmuta a modo núcleo (bit de modo = 0) y salta a la dirección fija del manejador.'],
        [1, 'El núcleo valida el descriptor y que el búfer pertenezca al espacio del programa.'],
        [2, 'El núcleo ordena al controlador del disco leer el bloque.'],
        [1, 'Los datos llegan; el núcleo los copia al búfer del programa.'],
        [0, 'Retorno de la trampa: el hardware vuelve a modo usuario (bit de modo = 1) y read devuelve n.'],
      ],
    },
    ilegal: {
      nombre: 'Programa intenta una instrucción privilegiada',
      pasos: [
        [0, 'Modo usuario: el programa intenta escribir directamente en el puerto del disco (instrucción out).'],
        [2, 'La CPU detecta que la instrucción es privilegiada y el bit de modo es usuario: no la ejecuta.'],
        [1, 'Se produce una excepción de protección: salto al manejador del núcleo en modo núcleo.'],
        [1, 'El núcleo decide: el programa violó la protección y se le envía una señal fatal (SIGSEGV).'],
        [1, 'El planificador elige otro proceso; el programa culpable se termina y se liberan sus recursos.'],
        [0, 'Otro programa continúa en modo usuario; el sistema no se vio afectado.'],
      ],
    },
  };

  function montarFlujo(cuerpo) {
    let caso = 'legitimo', k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Situación', opciones: Object.entries(CASOS).map(([v, c]) => [v, c.nombre]), valor: caso, alCambiar: (v) => { caso = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'programa de usuario (modo usuario)' }, { color: C.s2, texto: 'núcleo (modo núcleo)' }, { color: C.s3, texto: 'hardware' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance con «Un paso». Cambie la situación para ver qué ocurre cuando el programa intenta algo que solo el núcleo puede hacer.');
    function iniciar() {
      k = 0;
      return (function* () { for (let j = 1; j <= CASOS[caso].pasos.length; j++) { k = j; yield; } })();
    }
    function dibujar() {
      const pasos = CASOS[caso].pasos;
      lienzo.limpiar();
      VIZ.sor.flujo(lienzo, ZONAS, pasos.map(([z]) => ({ z })), k);
      const ult = pasos[Math.max(0, k - 1)];
      registro.textContent = k ? `${k}. ${ult[1]}` : 'Pulse «Un paso» para comenzar.';
      const modo = k === 0 ? '—' : ult[0] === 0 ? 'usuario' : 'núcleo';
      lectura.set([['paso', `${k} de ${pasos.length}`], ['modo de la CPU', modo], ['cruces usuario↔núcleo', String(pasos.slice(0, k).filter((p, i, a) => i && (p[0] === 0) !== (a[i - 1][0] === 0)).length)]]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  function montarInstrucciones(cuerpo) {
    const INS = [['add r1, r2', false], ['mov r1, [dir]', false], ['jmp etiqueta', false], ['in / out (puertos de E/S)', true], ['cli (deshabilitar interrupciones)', true], ['cargar la tabla de páginas', true], ['escribir el registro de modo', true], ['syscall (pedir un servicio)', false]];
    let nucleo = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'La CPU está en modo núcleo', valor: nucleo, alCambiar: (v) => { nucleo = v; dibujar(); } });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla con texto en cada fila';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque o desmarque el modo: las instrucciones privilegiadas solo se ejecutan en modo núcleo; en modo usuario provocan una excepción.');
    function dibujar() {
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th', { class: 'izq' }, 'instrucción'), el('th', null, 'tipo'), el('th', { class: 'izq' }, 'resultado')),
        INS.map(([t, priv]) => el('tr', null, el('td', { class: 'izq' }, t), el('td', null, priv ? 'privilegiada' : 'normal'),
          el('td', { class: 'izq', style: { color: priv && !nucleo ? C.s8 : C.s6, fontWeight: 600 } }, priv && !nucleo ? 'excepción: el núcleo toma el control' : 'se ejecuta')))));
      const bloqueadas = INS.filter(([, p]) => p && !nucleo).length;
      lectura.set([['modo', nucleo ? 'núcleo (0)' : 'usuario (1)'], ['se ejecutan', `${INS.length - bloqueadas} de ${INS.length}`], ['provocan excepción', String(bloqueadas)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('kernel-user-mode', {
    intro: String.raw`
      <p>El <strong>núcleo</strong> (<em>kernel</em>) es la parte del sistema operativo que administra el hardware y decide quién usa qué. Para que un programa defectuoso o
      malicioso no pueda apoderarse de la máquina, la CPU funciona en dos <strong>modos</strong>: en <em>modo usuario</em> solo se pueden ejecutar instrucciones comunes, y en
      <em>modo núcleo</em> también las <em>privilegiadas</em> (acceder a dispositivos, cambiar la tabla de páginas, deshabilitar interrupciones).</p>
      <p>Un programa de usuario solo cruza la frontera de forma controlada: pidiendo un servicio mediante una trampa, o cuando el hardware lo interrumpe. Así el núcleo
      mantiene siempre el control del sistema.</p>`,
    visualizaciones: [
      { titulo: 'Cruzar la frontera entre usuario y núcleo', descripcion: 'Siga paso a paso un read legítimo y, luego, una instrucción privilegiada ejecutada desde modo usuario. Observe en qué banda está cada paso y cuántas veces se cruza la frontera.', montar: montarFlujo },
      { titulo: 'Instrucciones privilegiadas', descripcion: 'Alterne el modo de la CPU y compare qué instrucciones se ejecutan y cuáles provocan una excepción.', montar: montarInstrucciones },
    ],
    teoria: String.raw`
      <h2>Modos de ejecución</h2>
      <p>La CPU tiene un bit (o más, en arquitecturas con anillos de protección) que indica el nivel de privilegio actual. Las instrucciones privilegiadas comprueban ese bit antes de
      ejecutarse; si el programa está en modo usuario, la CPU genera una excepción y el núcleo decide qué hacer (normalmente terminar el proceso).</p>
      <table class="tabla-datos"><tr><th class="izq">Protección</th><th class="izq">Mecanismo</th></tr>
      <tr><td class="izq">de la CPU</td><td class="izq">modo dual + temporizador que devuelve el control al núcleo</td></tr>
      <tr><td class="izq">de la memoria</td><td class="izq">registros base/límite o <a href="tema.html?id=paging-address-translation">tablas de páginas</a> que solo el núcleo modifica</td></tr>
      <tr><td class="izq">de la E/S</td><td class="izq">las instrucciones de E/S son privilegiadas; se accede vía <a href="tema.html?id=system-calls">llamadas al sistema</a></td></tr></table>

      <h2>Cómo se entra al núcleo</h2>
      <ul><li><strong>Llamada al sistema</strong> (trampa): voluntaria y síncrona.</li>
      <li><strong>Excepción</strong>: error del programa (división por cero, acceso inválido); síncrona.</li>
      <li><strong>Interrupción</strong>: evento externo (reloj, disco); asíncrona. Ver <a href="tema.html?id=interrupts-exceptions">interrupciones y excepciones</a>.</li></ul>
      <p>En los tres casos el hardware guarda el contador de programa, pone la CPU en modo núcleo y salta a una dirección tomada de una tabla que solo el núcleo puede escribir; el
      programa de usuario <em>nunca</em> elige a qué dirección del núcleo se salta.</p>

      <h2>Costo</h2>
      <p>Cruzar la frontera no es gratis: hay que guardar registros, cambiar de pila y, a veces, vaciar cachés y TLB. Del orden de cientos de nanosegundos, frente a unos pocos para
      una llamada de función común. Por eso se agrupan operaciones (ver <a href="tema.html?id=system-calls">el costo de las llamadas</a>).</p>
      <div class="recuadro"><strong>Idea clave.</strong> La seguridad del sistema no descansa en la buena voluntad de los programas, sino en que solo el hardware, a través del bit de modo,
      decide cuándo se cede el privilegio.</div>`,
  });
})();
