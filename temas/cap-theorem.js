(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const NOMBRES = ['A', 'B', 'C', 'D', 'E'];
  const IZQ = [0, 1, 2], DER = [3, 4];

  function montar(cuerpo) {
    const est = { modo: 'cp' };
    let s;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ante una partición, el sistema elige', valor: est.modo, opciones: [['cp', 'CP: consistencia (mayoría)'], ['ap', 'AP: disponibilidad (cada lado sigue)']], alCambiar: (v) => { est.modo = v; reiniciar(); } });
    ctl.boton('Cortar / reparar la red', () => cortar(), { primario: true });
    ctl.boton('Cliente 1 escribe', () => escribir(0));
    ctl.boton('Cliente 2 escribe', () => escribir(1));
    ctl.boton('Cliente 1 lee', () => leer(0));
    ctl.boton('Cliente 2 lee', () => leer(1));
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 300 : 260) });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'operación aceptada', forma: 'linea' }, { color: C.s8, texto: 'rechazada / partición', forma: 'linea' },
      { color: C.s4, texto: 'réplica con un valor que otra no tiene', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cinco réplicas: A, B y C a la izquierda; D y E a la derecha. El cliente 1 habla con el lado izquierdo y el cliente 2 con el derecho. Cada escritura lleva una marca de tiempo.');

    function reiniciar() {
      s = { cortada: false, val: new Array(5).fill({ v: 0, t: 0 }), t: 0, intentos: 0, respondidas: 0, viejas: 0, perdidas: 0, ult: null, log: 'Red conectada: toda escritura llega a las cinco réplicas.' };
      dibujar();
    }
    const lado = (c) => (c === 0 ? IZQ : DER);
    const alcanzables = (c) => (s.cortada ? lado(c) : [0, 1, 2, 3, 4]);
    const ultimo = () => s.val.reduce((m, x) => (x.t > m.t ? x : m), { v: 0, t: 0 });

    function cortar() {
      if (!s.cortada) { s.cortada = true; s.ult = null; s.log = 'La red se parte: {A, B, C} y {D, E} ya no pueden comunicarse.'; }
      else {
        s.cortada = false;
        const valores = new Set(s.val.map((x) => x.t));
        const gana = ultimo();
        if (valores.size > 1 && est.modo === 'ap') {
          const distintos = [...new Set(s.val.filter((x) => x.t !== gana.t).map((x) => x.t))].length;
          s.perdidas += distintos;
          s.log = `La red se repara. Las réplicas tienen valores distintos y se reconcilian con «última escritura gana»: queda ${gana.v} y se pierde${distintos > 1 ? 'n' : ''} ${distintos} escritura${distintos > 1 ? 's' : ''} aceptada${distintos > 1 ? 's' : ''}.`;
        } else s.log = 'La red se repara; las réplicas atrasadas se ponen al día.';
        s.val = s.val.map(() => gana);
        s.ult = null;
      }
      dibujar();
    }
    function escribir(c) {
      s.intentos++;
      const r = alcanzables(c);
      if (est.modo === 'cp' && r.length < 3) { s.ult = { c, ok: false, op: 'W' }; s.log = `El cliente ${c + 1} quiere escribir, pero solo alcanza ${r.length} de 5 réplicas: sin mayoría, el sistema CP rechaza la escritura (deja de estar disponible de ese lado).`; return dibujar(); }
      s.t++;
      const v = 10 * s.t + (c + 1);
      r.forEach((i) => { s.val[i] = { v, t: s.t }; });
      s.respondidas++;
      s.ult = { c, ok: true, op: 'W', r };
      s.log = `El cliente ${c + 1} escribe ${v} en ${r.map((i) => NOMBRES[i]).join(', ')}.${s.cortada && est.modo === 'ap' ? ' El otro lado no se entera.' : ''}`;
      dibujar();
    }
    function leer(c) {
      s.intentos++;
      const r = alcanzables(c);
      if (est.modo === 'cp' && r.length < 3) { s.ult = { c, ok: false, op: 'R' }; s.log = `El cliente ${c + 1} quiere leer, pero sin mayoría el sistema CP no puede asegurar que el valor sea el último: rechaza.`; return dibujar(); }
      const x = r.map((i) => s.val[i]).reduce((m, y) => (y.t > m.t ? y : m));
      const vieja = x.t < ultimo().t;
      if (vieja) s.viejas++;
      s.respondidas++;
      s.ult = { c, ok: true, op: 'R', r };
      s.log = `El cliente ${c + 1} lee ${x.v}.${vieja ? ` ¡Pero ya se había escrito ${ultimo().v} del otro lado! Lectura inconsistente.` : ''}`;
      dibujar();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const pos = [
        { x: W * 0.14, y: H * 0.3 }, { x: W * 0.3, y: H * 0.18 }, { x: W * 0.3, y: H * 0.52 },
        { x: W * 0.7, y: H * 0.25 }, { x: W * 0.86, y: H * 0.45 },
      ];
      const cli = [{ x: W * 0.16, y: H * 0.82 }, { x: W * 0.84, y: H * 0.82 }];
      const recientes = new Set(s.val.map((x) => x.t));
      // Enlaces
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
        const cruza = IZQ.includes(i) !== IZQ.includes(j);
        ctx.strokeStyle = cruza && s.cortada ? VIZ.alfa(C.s8, 0.25) : C.rejilla; ctx.lineWidth = 1;
        ctx.setLineDash(cruza && s.cortada ? [3, 4] : []);
        ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (s.cortada) {
        ctx.strokeStyle = C.s8; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(W * 0.5, 8); ctx.lineTo(W * 0.5, H - 8); ctx.stroke(); ctx.setLineDash([]);
        D.etiqueta(ctx, 'partición', W * 0.5, 16, { color: C.s8, borde: C.s8, tam: 10 });
      }
      if (s.ult) {
        const c = s.ult.c;
        if (s.ult.ok) for (const i of s.ult.r) D.mensaje(ctx, cli[c], pos[i], 20, { color: C.s6, ancho: 1.8 });
        else D.mensaje(ctx, cli[c], pos[lado(c)[0]], 20, { color: C.s8, ancho: 2.2, guiones: [4, 3], texto: 'rechazada' });
      }
      const ult = ultimo();
      pos.forEach((p, i) => {
        const distinto = recientes.size > 1 && s.val[i].t !== ult.t;
        D.nodo(ctx, p.x, p.y, NOMBRES[i], { r: 20, relleno: recientes.size > 1 ? (distinto ? VIZ.alfa(C.s4, 0.6) : VIZ.alfa(C.s4, 0.2)) : C.superficie });
        D.etiqueta(ctx, `x = ${s.val[i].v}`, p.x, p.y + 32, { color: C.tinta, tam: angosto ? 10 : 11 });
      });
      cli.forEach((p, c) => {
        ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 13, 76, 26, 4); ctx.fill(); ctx.stroke();
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`cliente ${c + 1}`, p.x, p.y);
      });
      registro.textContent = s.log;
      lectura.set([
        ['red', s.cortada ? 'partida' : 'conectada'],
        ['operaciones respondidas', `${s.respondidas} de ${s.intentos}`],
        ['lecturas inconsistentes', String(s.viejas)],
        ['escrituras perdidas al reconciliar', String(s.perdidas)],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    reiniciar();
  }

  VIZ.registrarTema('cap-theorem', {
    intro: String.raw`
      <p>Una <strong>partición de red</strong> separa a las réplicas en grupos que no pueden comunicarse: un cable cortado, un switch caído, un centro de datos aislado. No es una
      hipótesis exótica: en sistemas grandes ocurre. Mientras dura, un sistema replicado debe elegir qué hacer con las operaciones que llegan a cada lado.</p>
      <p>El <strong>teorema CAP</strong> (Brewer, 2000; Gilbert y Lynch, 2002) dice que, durante una partición, no se puede tener a la vez <strong>consistencia</strong> (linealizable:
      toda lectura ve la última escritura) y <strong>disponibilidad</strong> (toda réplica viva responde). Hay que renunciar a una: rechazar operaciones en el lado minoritario
      (CP) o aceptarlas en ambos lados y reconciliar después (AP).</p>`,
    visualizaciones: [
      {
        titulo: 'Partir la red',
        descripcion: 'Corte la red y haga que ambos clientes escriban y lean. En modo CP el lado derecho, sin mayoría, rechaza todo. En modo AP ambos lados responden, las réplicas divergen y al reparar se pierde una escritura.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>El teorema</h2>
      <div class="recuadro"><p>En una red asíncrona que puede perder mensajes entre dos grupos de nodos, ningún registro replicado puede garantizar a la vez lecturas y escrituras
      <strong>linealizables</strong> y que <strong>toda réplica viva responda</strong> a todo pedido.</p></div>
      <p><strong>Idea de la prueba.</strong> Partamos las réplicas en \(G_1\) y \(G_2\) sin mensajes entre ellos. Un cliente escribe \(x = 1\) en \(G_1\); por disponibilidad, \(G_1\) responde. Luego
      otro cliente lee en \(G_2\); por disponibilidad, \(G_2\) responde, pero no recibió nada de \(G_1\), así que su respuesta es la misma que si la escritura no hubiera existido: devuelve el
      valor viejo, y la historia no es linealizable.</p>

      <h2>Las dos elecciones</h2>
      <table>
        <tr><th></th><th>CP</th><th>AP</th></tr>
        <tr><td>Durante la partición</td><td>El lado sin mayoría rechaza o se bloquea</td><td>Ambos lados aceptan</td></tr>
        <tr><td>Consistencia</td><td>Linealizable (quórums de mayoría)</td><td>Eventual: hay lecturas viejas</td></tr>
        <tr><td>Al reparar</td><td>Nada que reconciliar</td><td>Resolver conflictos (última escritura gana, versiones, CRDT)</td></tr>
        <tr><td>Ejemplos</td><td>ZooKeeper, etcd, Spanner, HBase</td><td>Dynamo, Cassandra, Riak, DNS</td></tr>
      </table>
      <p>CP se apoya en quórums de mayoría (<a href="tema.html?id=quorum-replication">quórums</a>, <a href="tema.html?id=raft">Raft</a>): de los dos lados, a lo más uno tiene mayoría.
      AP se apoya en la <a href="tema.html?id=eventual-consistency">consistencia eventual</a> y, para no frustrar a los usuarios, en las
      <a href="tema.html?id=client-centric-consistency">garantías de sesión</a> o la <a href="tema.html?id=causal-consistency">consistencia causal</a>, que sí son compatibles con la disponibilidad.</p>

      <h2>PACELC</h2>
      <p>CAP solo habla de lo que pasa durante una partición. Abadi (2012) completa: si hay Partición, elegir entre Disponibilidad y Consistencia; si no (<em>Else</em>), entre Latencia y
      Consistencia. Aun con la red sana, la consistencia fuerte cuesta al menos un viaje a una mayoría por operación; por eso muchos sistemas relajan la consistencia incluso sin fallas.</p>`,
  });
})();
