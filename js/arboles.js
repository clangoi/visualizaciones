/* Árboles: dibujo de árboles binarios y de nodos con varias claves (2-3),
   y un editor genérico (insertar, eliminar, buscar) que usan los temas de árboles. */
(function () {
  'use strict';
  const { el, color: C } = VIZ;

  const altura = (n) => (n ? 1 + Math.max(altura(n.izq), altura(n.der)) : 0);
  const tamano = (n) => (n ? 1 + tamano(n.izq) + tamano(n.der) : 0);
  function inorden(n, f) { if (!n) return; inorden(n.izq, f); f(n); inorden(n.der, f); }
  function preorden(n, f) { if (!n) return; f(n); preorden(n.izq, f); preorden(n.der, f); }
  function postorden(n, f) { if (!n) return; postorden(n.izq, f); postorden(n.der, f); f(n); }
  function porNiveles(n, f) {
    const q = n ? [n] : [];
    for (let i = 0; i < q.length; i++) { f(q[i]); if (q[i].izq) q.push(q[i].izq); if (q[i].der) q.push(q[i].der); }
  }

  /* Árbol binario: x según el orden inorden, y según la profundidad.
     o: { x0, y0, ancho, dy, radio, estilo(n), arista(padre, hijo), etiqueta(n), nota(n), resaltes } */
  function dibujarBinario(ctx, raiz, o) {
    const nodos = [];
    let k = 0;
    (function rec(n, d) {
      if (!n) return;
      rec(n.izq, d + 1);
      nodos.push({ n, i: k++, d });
      rec(n.der, d + 1);
    })(raiz, 0);
    const total = Math.max(1, nodos.length);
    const pos = new Map();
    for (const q of nodos) pos.set(q.n, { x: o.x0 + ((q.i + 0.5) / total) * o.ancho, y: o.y0 + q.d * o.dy });
    const r = o.radio || Math.max(9, Math.min(16, (o.ancho / total) * 0.42));
    // Aristas
    for (const { n } of nodos) {
      const p = pos.get(n);
      for (const h of [n.izq, n.der]) {
        if (!h) continue;
        const q = pos.get(h);
        const est = (o.arista && o.arista(n, h)) || {};
        ctx.strokeStyle = est.color || C.eje;
        ctx.lineWidth = est.ancho || 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }
    // Nodos
    const res = o.resaltes || {};
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { n } of nodos) {
      const { x, y } = pos.get(n);
      const est = (o.estilo && o.estilo(n)) || {};
      const anillo = res.destino === n ? C.s6 : res.cambiados && res.cambiados.has(n) ? C.s7 : res.camino && res.camino.has(n) ? C.s1 : null;
      if (anillo) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = anillo;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = est.relleno || C.superficie;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = est.borde || C.tinta;
      ctx.stroke();
      ctx.fillStyle = est.texto || C.tinta;
      ctx.font = VIZ.fuente(r >= 13 ? 12 : 10, 500);
      ctx.fillText(o.etiqueta ? o.etiqueta(n) : String(n.clave), x, y + 0.5);
      const nota = o.nota && o.nota(n);
      if (nota) {
        ctx.fillStyle = est.colorNota || C.tinta2;
        ctx.font = VIZ.fuente(9);
        ctx.fillText(nota, x + r + 9, y - r + 2);
      }
    }
    return { pos, radio: r, nodos: nodos.map((q) => q.n) };
  }

  /* Árbol con nodos de varias claves: { claves: [], hijos: [] }.
     Las hojas se reparten de izquierda a derecha y cada padre se centra sobre sus hijos. */
  function dibujarMultiple(ctx, raiz, o) {
    const ancho = (n) => n.claves.length * 26 + 10;
    const items = [];
    let cursor = 0;
    const sep = 12;
    (function rec(n, d) {
      if (!n.hijos.length) {
        const w = ancho(n);
        items.push({ n, d, x: cursor + w / 2, w });
        cursor += w + sep;
        return items[items.length - 1];
      }
      const hs = n.hijos.map((h) => rec(h, d + 1));
      const it = { n, d, x: (hs[0].x + hs[hs.length - 1].x) / 2, w: ancho(n), hs };
      items.push(it);
      return it;
    })(raiz, 0);
    const totalW = Math.max(1, cursor - sep);
    const escala = Math.min(1, o.ancho / totalW);
    const ox = o.x0 + (o.ancho - totalW * escala) / 2;
    const X = (x) => ox + x * escala;
    const h = 26;
    const res = o.resaltes || {};
    ctx.lineWidth = 1.2;
    for (const it of items) {
      if (!it.hs) continue;
      it.hs.forEach((c, j) => {
        const w = it.w * Math.max(escala, 0.7);
        const sx = X(it.x) - w / 2 + ((j + 0.5) * w) / it.hs.length;
        ctx.strokeStyle = C.eje;
        ctx.beginPath();
        ctx.moveTo(sx, o.y0 + it.d * o.dy + h / 2);
        ctx.lineTo(X(c.x), o.y0 + c.d * o.dy - h / 2);
        ctx.stroke();
      });
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pos = new Map();
    for (const it of items) {
      const w = it.w * Math.max(escala, 0.7);
      const x = X(it.x) - w / 2, y = o.y0 + it.d * o.dy - h / 2;
      pos.set(it.n, { x: X(it.x), y: o.y0 + it.d * o.dy, w, h });
      const anillo = res.destino === it.n ? C.s6 : res.cambiados && res.cambiados.has(it.n) ? C.s7 : res.camino && res.camino.has(it.n) ? C.s1 : null;
      if (anillo) {
        ctx.strokeStyle = anillo;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
      }
      ctx.fillStyle = it.n.claves.length > 2 ? VIZ.alfa(C.s8, 0.15) : C.superficie;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      const kw = w / it.n.claves.length;
      it.n.claves.forEach((k, j) => {
        if (j) {
          ctx.strokeStyle = C.eje;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + j * kw + 0.5, y + 3); ctx.lineTo(x + j * kw + 0.5, y + h - 3); ctx.stroke();
        }
        ctx.fillStyle = (o.colorClave && o.colorClave(it.n, j)) || C.tinta;
        ctx.font = VIZ.fuente(escala < 0.8 ? 10 : 12, 500);
        ctx.fillText(String(k), x + (j + 0.5) * kw, y + h / 2 + 0.5);
      });
    }
    return { pos };
  }
  const alturaMultiple = (n) => (n ? 1 + (n.hijos.length ? alturaMultiple(n.hijos[0]) : 0) : 0);

  /* ---------- Editor genérico ----------
     impl: { raiz(), vaciar(), contiene(k), insertar(k), eliminar?(k), buscar(k),
             estilo?(n), arista?(p,h), nota?(n), info?(n), lecturas(), multiple? }
     Cada operación devuelve { mensajes: [], camino: [], cambiados: [], destino }. */
  function editor(cuerpo, impl, cfg = {}) {
    let resaltes = {}, mensajes = [];
    const ctl = VIZ.controles(cuerpo);
    const entrada = ctl.numero({ etiqueta: 'Clave', min: 1, max: 99, valor: 50 });
    const clave = () => Math.max(1, Math.min(99, Math.round(entrada.valor) || 1));
    function aplicar(r) {
      resaltes = {
        camino: new Set(r.camino || []),
        cambiados: new Set(r.cambiados || []),
        destino: r.destino || null,
      };
      mensajes = r.mensajes || [];
      lienzo.ajustar(true);
      if (cfg.alCambiar) cfg.alCambiar();
    }
    const aleatoria = () => {
      for (let t = 0; t < 500; t++) { const k = 1 + Math.floor(Math.random() * 99); if (!impl.contiene(k)) return k; }
      return null;
    };
    entrada.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') aplicar(impl.insertar(clave())); });
    ctl.boton('Insertar', () => aplicar(impl.insertar(clave())), { primario: true });
    if (impl.eliminar) ctl.boton('Eliminar', () => aplicar(impl.eliminar(clave())));
    ctl.boton('Buscar', () => aplicar(impl.buscar(clave())));
    ctl.boton('Insertar aleatoria', () => { const k = aleatoria(); if (k != null) { entrada.valor = k; aplicar(impl.insertar(k)); } });
    ctl.boton('Insertar 10 aleatorias', () => {
      let r = null;
      for (let i = 0; i < 10; i++) { const k = aleatoria(); if (k != null) r = impl.insertar(k); }
      if (r) aplicar({ mensajes: ['Se insertaron 10 claves aleatorias.'] });
    });
    ctl.boton('Insertar 1, 2, …, 15', () => {
      impl.vaciar();
      for (let k = 1; k <= 15; k++) impl.insertar(k);
      aplicar({ mensajes: ['Se insertaron las claves 1 a 15 en orden creciente.'] });
    });
    ctl.boton('Vaciar', () => { impl.vaciar(); aplicar({ mensajes: ['Árbol vacío.'] }); });

    const api = {
      aplicar,
      get resaltes() { return resaltes; },
      redibujar: () => lienzo.ajustar(true),
      mensaje(txt) { mensajes = [txt]; registro.textContent = txt; },
    };
    if (cfg.extras) cfg.extras(ctl, api);

    const dy = cfg.dy || 58;
    const altoArbol = () => {
      const h = impl.multiple ? alturaMultiple(impl.raiz()) : altura(impl.raiz());
      return Math.max(150, h * dy + 30);
    };
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoArbol });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...(cfg.leyenda || []),
      { color: C.superficie, borde: C.s1, texto: 'camino recorrido', forma: 'punto' },
      { color: C.superficie, borde: C.s7, texto: 'nodos reestructurados', forma: 'punto' },
      { color: C.superficie, borde: C.s6, texto: 'nodo resultado', forma: 'punto' },
    ]);
    const registro = el('div', { class: 'mono', style: { fontSize: '12.5px', margin: '12px 0 0', padding: '10px 12px', background: '#f6f6f4', border: '1px solid #e1e0d9', minHeight: '2.6em', whiteSpace: 'pre-wrap', lineHeight: '1.6' } });
    cuerpo.appendChild(registro);
    const lectura = VIZ.lectura(cuerpo);

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const raiz = impl.raiz();
      if (!raiz) {
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(12);
        ctx.textAlign = 'center';
        ctx.fillText('Árbol vacío', W / 2, 60);
        geo = null;
      } else if (impl.multiple) {
        geo = dibujarMultiple(ctx, raiz, { x0: 10, y0: 26, ancho: W - 20, dy, resaltes });
      } else {
        geo = dibujarBinario(ctx, raiz, {
          x0: 10, y0: 26, ancho: W - 40, dy, resaltes,
          estilo: impl.estilo, arista: impl.arista, nota: impl.nota,
        });
      }
      registro.textContent = mensajes.length ? mensajes.map((m, i) => (mensajes.length > 1 ? `${i + 1}. ${m}` : m)).join('\n') : 'Inserte, elimine o busque claves (1 a 99).';
      lectura.set(impl.lecturas());
      if (cfg.alDibujar) cfg.alDibujar();
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !impl.info) return;
      const { x, y } = lienzo.posicion(ev);
      let mejor = null;
      for (const [n, p] of geo.pos) {
        const dentro = impl.multiple ? Math.abs(x - p.x) <= p.w / 2 && Math.abs(y - p.y) <= p.h / 2 : Math.hypot(x - p.x, y - p.y) <= geo.radio + 3;
        if (dentro) mejor = n;
      }
      if (!mejor) return tip.ocultar();
      tip.mostrar(x, y, impl.info(mejor));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    if (cfg.inicial) cfg.inicial.forEach((k) => impl.insertar(k));
    aplicar({ mensajes: [] });
    return api;
  }

  VIZ.arbol = { altura, tamano, inorden, preorden, postorden, porNiveles, dibujarBinario, dibujarMultiple, alturaMultiple, editor };
})();
