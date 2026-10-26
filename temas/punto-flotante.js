(function () {
  'use strict';
  const { el, color: C } = VIZ;

  const FORMATOS = {
    16: { nombre: 'media (16 bits)', E: 5, P: 10 },
    32: { nombre: 'simple (32 bits)', E: 8, P: 23 },
    64: { nombre: 'doble (64 bits)', E: 11, P: 52 },
  };
  for (const [w, f] of Object.entries(FORMATOS)) {
    f.W = +w;
    f.sesgo = (1 << (f.E - 1)) - 1;
    f.emax = (1 << f.E) - 1;
  }

  /* ---------- Codificación ---------- */

  const redondearPar = (v) => {
    const f = Math.floor(v), d = v - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  };

  // Número de JS (doble) → patrón de bits (BigInt) del formato con redondeo al par más cercano.
  function codificar(x, F) {
    const buf = new DataView(new ArrayBuffer(8));
    if (F.W === 64) { buf.setFloat64(0, x); return buf.getBigUint64(0); }
    if (F.W === 32) { buf.setFloat32(0, x); return BigInt(buf.getUint32(0)); }
    // Media precisión: manual.
    const s = x < 0 || Object.is(x, -0) ? 1 : 0;
    const a = Math.abs(x);
    let e = 0, m = 0;
    if (Number.isNaN(x)) { e = F.emax; m = 1 << (F.P - 1); }
    else if (a === Infinity) e = F.emax;
    else if (a === 0) { /* cero */ }
    else {
      let ex = Math.floor(Math.log2(a));
      if (Math.pow(2, ex) > a) ex--;
      if (Math.pow(2, ex + 1) <= a) ex++;
      if (ex < 1 - F.sesgo) {
        m = redondearPar(a / Math.pow(2, 1 - F.sesgo - F.P));
        if (m >= 1 << F.P) { e = 1; m -= 1 << F.P; }
      } else {
        m = redondearPar((a / Math.pow(2, ex) - 1) * (1 << F.P));
        e = ex + F.sesgo;
        if (m >= 1 << F.P) { m = 0; e++; }
        if (e >= F.emax) { e = F.emax; m = 0; }
      }
    }
    return (BigInt(s) << 15n) | (BigInt(e) << BigInt(F.P)) | BigInt(m);
  }

  function decodificar(patron, F) {
    const P = BigInt(F.P);
    const s = Number(patron >> BigInt(F.W - 1)) & 1;
    const e = Number((patron >> P) & BigInt(F.emax));
    const f = patron & ((1n << P) - 1n);
    let clase, valor, M = 0n, X = 0; // valor exacto = (−1)^s · M · 2^X
    if (e === F.emax) {
      clase = f === 0n ? 'infinito' : 'NaN';
      valor = f === 0n ? (s ? -Infinity : Infinity) : NaN;
    } else if (e === 0) {
      clase = f === 0n ? 'cero' : 'subnormal';
      M = f;
      X = 1 - F.sesgo - F.P;
      valor = (s ? -1 : 1) * Number(f) * Math.pow(2, X);
    } else {
      clase = 'normal';
      M = (1n << P) | f;
      X = e - F.sesgo - F.P;
      valor = (s ? -1 : 1) * Number(M) * Math.pow(2, X);
    }
    return { s, e, f, clase, valor, M, X };
  }

  /* ---------- Aritmética decimal exacta con BigInt ---------- */

  const pot10 = (k) => 10n ** BigInt(k);
  // Representación decimal exacta de M·2^X.
  function decimalExacto(M, X) {
    if (M === 0n) return '0';
    if (X >= 0) return (M << BigInt(X)).toString();
    const k = -X;
    const digitos = (M * 5n ** BigInt(k)).toString().padStart(k + 1, '0');
    const ent = digitos.slice(0, digitos.length - k), frac = digitos.slice(digitos.length - k).replace(/0+$/, '');
    return frac ? `${ent}.${frac}` : ent;
  }
  function recortarDecimal(s, max = 60) {
    const inicio = s.search(/[1-9]/);
    if (inicio < 0) return s;
    const digSig = s.slice(inicio).replace('.', '').length;
    if (digSig <= max) return s;
    let cont = 0, i = inicio;
    for (; i < s.length && cont < max; i++) if (s[i] !== '.') cont++;
    return `${s.slice(0, i)}… (${digSig} dígitos significativos)`;
  }
  // Entrada decimal → fracción N/D exacta (o null si no es un decimal simple).
  function fraccionDecimal(texto) {
    const t = texto.trim().replace(',', '.').replace(/\s/g, '');
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(t);
    if (!m || (!m[2] && !m[3])) return null;
    const signo = m[1] === '-' ? -1n : 1n;
    const frac = m[3] || '';
    let N = BigInt((m[2] || '0') + frac) * signo;
    let exp = (m[4] ? parseInt(m[4], 10) : 0) - frac.length;
    if (Math.abs(exp) > 2000) return null;
    let D = 1n;
    if (exp >= 0) N *= pot10(exp); else D = pot10(-exp);
    return { N, D };
  }
  // Formato científico aproximado de una fracción positiva N/D.
  function cientifico(N, D, dig = 4) {
    if (N === 0n) return '0';
    if (N < 0n) N = -N;
    const calc = (k) => (k >= 0 ? N / (D * pot10(k)) : (N * pot10(-k)) / D);
    let k = N.toString().length - D.toString().length - dig;
    let q = calc(k);
    while (q >= pot10(dig)) q = calc(++k);
    while (q < pot10(dig - 1)) q = calc(--k);
    const t = q.toString();
    return `${t[0]}.${t.slice(1)} × 10^${k + dig - 1}`.replace('^-', '^−');
  }

  /* ---------- Fig. 1: editor de bits ---------- */

  function montarEditor(cuerpo) {
    let w = 32, patron = 0n, entradaTexto = '0.1';
    const F = () => FORMATOS[w];

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Formato', opciones: Object.entries(FORMATOS).map(([k, f]) => [k, f.nombre]), valor: w,
      alCambiar: (v) => { w = +v; desdeTexto(entradaTexto); } });
    const entrada = ctl.texto({ etiqueta: 'Número decimal', valor: entradaTexto, alCambiar: (v) => desdeTexto(v), alEnter: (v) => desdeTexto(v) });
    const presets = [
      ['0.1', '0.1'], ['1/3', String(1 / 3)], ['π', String(Math.PI)], ['1', '1'], ['−2.5', '-2.5'],
      ['máximo finito', 'max'], ['mínimo normal', 'minnorm'], ['mínimo subnormal', 'minsub'], ['∞', 'Infinity'], ['NaN', 'NaN'],
    ];
    for (const [t, v] of presets) ctl.boton(t, () => desdeTexto(v));
    ctl.boton('− 1 ULP', () => moverUlp(-1));
    ctl.boton('+ 1 ULP', () => moverUlp(1));

    const filaBits = el('div', { class: 'fila-bits' });
    const etiquetasGrupo = el('div', { class: 'grupos-bits' });
    cuerpo.append(filaBits, etiquetasGrupo);
    VIZ.nota(cuerpo, 'Haga clic en cualquier bit para invertirlo.');
    const desglose = el('div', { class: 'desglose' });
    cuerpo.appendChild(desglose);
    const lectura = VIZ.lectura(cuerpo);

    const COLORES = { s: C.s8, e: C.s1, m: C.s3 };

    function desdeTexto(t) {
      entradaTexto = t;
      const f = F();
      let x;
      const maxFinito = (2 - Math.pow(2, -f.P)) * Math.pow(2, f.sesgo);
      if (t === 'max') { x = maxFinito; entradaTexto = String(x); }
      else if (t === 'minnorm') { x = Math.pow(2, 1 - f.sesgo); entradaTexto = String(x); }
      else if (t === 'minsub') { x = Math.pow(2, 1 - f.sesgo - f.P); entradaTexto = String(x); }
      else {
        const lim = t.trim().toLowerCase();
        if (['inf', 'infinity', '∞', '+inf'].includes(lim)) x = Infinity;
        else if (['-inf', '-infinity', '-∞'].includes(lim)) x = -Infinity;
        else if (lim === 'nan') x = NaN;
        else x = Number(t.trim().replace(',', '.'));
      }
      entrada.valor = entradaTexto;
      patron = codificar(x, f);
      actualizar();
    }
    function moverUlp(d) {
      const f = F();
      const { s, clase } = decodificar(patron, f);
      if (clase === 'NaN') return;
      const mag = patron & ((1n << BigInt(f.W - 1)) - 1n);
      const signo = BigInt(s) << BigInt(f.W - 1);
      // Recorre la recta real: en negativos, aumentar el valor reduce la magnitud.
      let nuevaMag = mag, nuevoSigno = signo;
      const sube = (d > 0) === (s === 0);
      if (sube) nuevaMag = mag + 1n;
      else if (mag === 0n) { nuevoSigno = signo ? 0n : BigInt(1) << BigInt(f.W - 1); nuevaMag = 1n; }
      else nuevaMag = mag - 1n;
      const infinito = BigInt(f.emax) << BigInt(f.P);
      if (nuevaMag > infinito) return;
      patron = nuevoSigno | nuevaMag;
      entradaTexto = null;
      actualizar();
    }

    function actualizar() {
      const f = F();
      const d = decodificar(patron, f);
      filaBits.replaceChildren();
      const disponible = (filaBits.clientWidth || 800) - 20 - 3 * f.W;
      const tam = Math.max(16, Math.min(30, Math.floor(disponible / f.W)));
      for (let i = f.W - 1; i >= 0; i--) {
        const bit = Number((patron >> BigInt(i)) & 1n);
        const grupo = i === f.W - 1 ? 's' : i >= f.P ? 'e' : 'm';
        const col = COLORES[grupo];
        const b = el('button', {
          type: 'button', title: `bit ${i}`, 'aria-label': `bit ${i}: ${bit}`,
          style: {
            width: tam + 'px', height: tam + 6 + 'px', border: `1.5px solid ${col}`, background: bit ? col : C.superficie,
            color: bit ? C.sobre : col, fontSize: `${tam > 20 ? 13 : 11}px`,
            marginRight: i === f.W - 1 || i === f.P ? '8px' : '0',
          },
        }, String(bit));
        b.addEventListener('click', () => { patron ^= 1n << BigInt(i); entradaTexto = null; actualizar(); });
        filaBits.appendChild(b);
      }
      const muestra = (c) => `<span class="muestra-color" style="background:${c}"></span>`;
      etiquetasGrupo.innerHTML = `<span>${muestra(C.s8)}signo · 1 bit</span><span>${muestra(C.s1)}exponente · ${f.E} bits (sesgo ${f.sesgo})</span><span>${muestra(C.s3)}fracción · ${f.P} bits</span>`;

      const bitsE = d.e.toString(2).padStart(f.E, '0');
      const bitsF = d.f.toString(2).padStart(f.P, '0');
      const fracStr = f.P > 30 ? bitsF.replace(/0+$/, '') || '0' : bitsF;
      const lineas = [];
      lineas.push(`<span style="color:${C.s8}">signo</span>      s = ${d.s}  →  (−1)^${d.s} = ${d.s ? '−1' : '+1'}`);
      if (d.clase === 'normal') {
        lineas.push(`<span style="color:${C.s1}">exponente</span>  e = ${bitsE}₂ = ${d.e}  →  e − ${f.sesgo} = <b>${d.e - f.sesgo}</b>`);
        lineas.push(`<span style="color:${C.s3}">mantisa</span>    1.${fracStr}₂ = ${decimalExacto(d.M, -f.P)}`);
        lineas.push(`<b>valor</b>      (−1)^${d.s} × 2^${d.e - f.sesgo} × ${recortarDecimal(decimalExacto(d.M, -f.P), 24)}`);
      } else if (d.clase === 'subnormal' || d.clase === 'cero') {
        lineas.push(`<span style="color:${C.s1}">exponente</span>  e = ${bitsE}₂ = 0  →  ${d.clase}: exponente fijo 1 − ${f.sesgo} = <b>${1 - f.sesgo}</b>, sin 1 implícito`);
        lineas.push(`<span style="color:${C.s3}">mantisa</span>    0.${fracStr}₂ = ${decimalExacto(d.f, -f.P)}`);
        lineas.push(`<b>valor</b>      (−1)^${d.s} × 2^${1 - f.sesgo} × ${recortarDecimal(decimalExacto(d.f, -f.P), 24)}`);
      } else {
        lineas.push(`<span style="color:${C.s1}">exponente</span>  e = ${bitsE}₂ (todos unos)  →  valor especial`);
        lineas.push(`<span style="color:${C.s3}">fracción</span>   ${d.f === 0n ? '= 0  →  infinito' : '≠ 0  →  NaN (no es un número)'}`);
      }
      const exacto = d.clase === 'normal' || d.clase === 'subnormal' || d.clase === 'cero'
        ? (d.s ? '−' : '') + decimalExacto(d.M, d.X) : String(d.valor);
      lineas.push(`<b>almacenado</b> ${recortarDecimal(exacto, 70)}`);
      desglose.innerHTML = lineas.join('<br>');

      // Error respecto de la entrada decimal, calculado con fracciones exactas.
      let errAbs = '—', errRel = '—';
      if (entradaTexto != null && Number.isFinite(d.valor)) {
        const q = fraccionDecimal(entradaTexto);
        if (q) {
          let An, Ad;
          if (d.X >= 0) { An = d.M << BigInt(d.X); Ad = 1n; } else { An = d.M; Ad = 1n << BigInt(-d.X); }
          if (d.s) An = -An;
          const num = An * q.D - q.N * Ad;
          const den = Ad * q.D;
          const absNum = num < 0n ? -num : num;
          errAbs = absNum === 0n ? '0 (exacto)' : cientifico(absNum, den);
          if (q.N !== 0n) errRel = absNum === 0n ? '0' : cientifico(absNum * q.D, den * (q.N < 0n ? -q.N : q.N));
        }
      }
      let ulp = '—';
      if (d.clase === 'normal') ulp = `2^${d.e - f.sesgo - f.P}`;
      else if (d.clase === 'subnormal' || d.clase === 'cero') ulp = `2^${1 - f.sesgo - f.P}`;
      const hex = patron.toString(16).toUpperCase().padStart(f.W / 4, '0');
      lectura.set([
        ['clase', d.clase],
        ['hexadecimal', '0x' + hex],
        ['valor (doble de JS)', String(d.valor)],
        ['error absoluto', errAbs],
        ['error relativo', errRel],
        ['u = 2^−(p+1)', `2^−${f.P + 1} ≈ ${VIZ.fmt(Math.pow(2, -(f.P + 1)), 3)}`],
        ['ULP aquí', ulp],
      ]);
    }

    let anchoBits = 0;
    new ResizeObserver(() => { if (filaBits.clientWidth !== anchoBits) { anchoBits = filaBits.clientWidth; actualizar(); } }).observe(filaBits);
    desdeTexto(entradaTexto);
  }

  /* ---------- Fig. 2: recta de números representables (minifloat) ---------- */

  function montarRecta(cuerpo) {
    let E = 3, P = 2, zoom = 0;
    const sesgo = () => (1 << (E - 1)) - 1;
    const exponenteMax = () => (1 << E) - 2 - sesgo();
    function limiteSuperior(v) {
      const emin = 1 - sesgo(), emax = exponenteMax() + 1;
      return Math.round(emin + ((emax - emin) * v) / 10);
    }
    function ajustarZoom() { sZoom.refrescar(); }

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Bits de exponente', min: 2, max: 5, valor: E, alCambiar: (v) => { E = v; ajustarZoom(); dibujarTodo(); } });
    ctl.rango({ etiqueta: 'Bits de fracción', min: 1, max: 5, valor: P, alCambiar: (v) => { P = v; dibujarTodo(); } });
    const sZoom = ctl.rango({ etiqueta: 'Mostrar hasta', min: 0, max: 10, valor: 10,
      formato: (v) => `2^${limiteSuperior(v)}`, alCambiar: (v) => { zoom = v; dibujarTodo(); } });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'subnormales' },
      { color: C.s1, texto: 'normales (marcas altas y bajas alternan por binada)' },
    ]);
    const lienzo2 = VIZ.lienzo(cuerpo, { alto: 220 });
    const tip2 = VIZ.tooltip(lienzo2);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba: todos los valores positivos finitos de un formato diminuto. Abajo: el espaciado relativo entre valores consecutivos, que oscila entre 2^−p y 2^−(p−1) para los normales (escala logarítmica).');

    function valores() {
      const s = sesgo(), res = [];
      for (let e = 0; e <= (1 << E) - 2; e++) {
        for (let f = 0; f < 1 << P; f++) {
          const v = e === 0 ? f * Math.pow(2, 1 - s - P) : (1 + f / (1 << P)) * Math.pow(2, e - s);
          res.push({ v, e, f, sub: e === 0 });
        }
      }
      return res;
    }

    let puntos = [], geo1 = null;
    function dibujarRecta() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vals = valores();
      const xmax = Math.pow(2, limiteSuperior(zoom));
      const izq = 16, der = 16, y = 78;
      const sx = (v) => izq + (v / xmax) * (W - izq - der);
      geo1 = { sx };
      ctx.strokeStyle = C.eje;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(izq, y + 0.5); ctx.lineTo(W - der, y + 0.5); ctx.stroke();
      // Límites de binada 2^k
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      let ultimoX = sx(0);
      for (let k = 1 - sesgo(); k <= exponenteMax() + 1; k++) {
        const v = Math.pow(2, k);
        if (v > xmax * 1.0001) break;
        const x = sx(v);
        ctx.strokeStyle = C.rejilla;
        ctx.beginPath(); ctx.moveTo(x + 0.5, 20); ctx.lineTo(x + 0.5, y + 30); ctx.stroke();
        if (x - ultimoX > 34) {
          ctx.fillStyle = C.apagado;
          ctx.fillText(`2^${k}`, x, y + 34);
          ultimoX = x;
        }
      }
      ctx.fillStyle = C.apagado;
      ctx.fillText('0', sx(0), y + 34);
      puntos = [];
      for (const p of vals) {
        if (p.v > xmax * 1.0001) continue;
        const x = sx(p.v);
        const alto = p.sub ? 22 : p.e % 2 ? 36 : 24;
        ctx.strokeStyle = p.sub ? C.s2 : C.s1;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - alto); ctx.stroke();
        puntos.push({ x, p });
      }
      const maxV = vals[vals.length - 1].v;
      ctx.fillStyle = C.tinta2;
      ctx.textAlign = 'left';
      ctx.fillText(`${vals.length - 1} valores positivos finitos · máximo ${VIZ.fmt(maxV)}`, izq, 2);
    }

    let geo2 = null;
    function dibujarEspaciado() {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const vals = valores();
      const s = sesgo();
      const minSub = Math.pow(2, 1 - s - P);
      const xmax = vals[vals.length - 1].v;
      const pts = [];
      for (let i = 1; i < vals.length - 1; i++) pts.push([vals[i].v, (vals[i + 1].v - vals[i].v) / vals[i].v, vals[i]]);
      const ymin = Math.min(...pts.map((p) => p[1])) / 1.6, ymax = 1.6;
      // Eje x logarítmico: se transforma manualmente.
      const lx = (v) => Math.log2(v);
      const p = VIZ.plano(lienzo2, { xmin: lx(minSub), xmax: lx(xmax), ymin: Math.max(ymin, 1e-4), ymax }, {
        logY: true, etiquetaX: 'x (escala log₂)', etiquetaY: 'espaciado relativo (x⁺ − x) / x',
        formatoX: (v) => `2^${Math.round(v)}`, ticksX: VIZ.ticks(lx(minSub), lx(xmax), 8).filter((v) => Number.isInteger(v)),
        formatoY: (v) => VIZ.fmt(v, 2),
      });
      geo2 = { p, pts };
      p.ejes();
      const ctx2 = ctx;
      ctx2.save();
      p.recortar();
      // Bandas teóricas de los normales.
      for (const [v, et] of [[Math.pow(2, -P), '2^−p'], [Math.pow(2, -P + 1), '2^−(p−1)']]) {
        const yy = p.sy(v);
        ctx2.strokeStyle = C.apagado;
        ctx2.setLineDash([3, 4]);
        ctx2.beginPath(); ctx2.moveTo(p.x0, yy); ctx2.lineTo(p.x1, yy); ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.fillStyle = C.apagado;
        ctx2.font = VIZ.fuente(10);
        ctx2.textAlign = 'right';
        ctx2.textBaseline = 'bottom';
        ctx2.fillText(et, p.x1 - 4, yy - 2);
      }
      ctx2.lineWidth = 2;
      ctx2.strokeStyle = C.s1;
      ctx2.beginPath();
      pts.forEach(([v, r], i) => { const x = p.sx(lx(v)), y = p.sy(r); i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y); });
      ctx2.stroke();
      for (const [v, r, q] of pts) if (q.sub) VIZ.marcador(ctx2, p.sx(lx(v)), p.sy(r), C.s2, 3);
      ctx2.restore();

      lectura.set([
        ['formato', `1 + ${E} + ${P} = ${1 + E + P} bits`],
        ['sesgo', String(s)],
        ['ε máquina = 2^−p', VIZ.fmt(Math.pow(2, -P))],
        ['mínimo subnormal', VIZ.fmt(minSub)],
        ['mínimo normal', VIZ.fmt(Math.pow(2, 1 - s))],
        ['máximo finito', VIZ.fmt(xmax)],
      ]);
    }

    function dibujarTodo() { dibujarRecta(); dibujarEspaciado(); }
    lienzo.alDibujar = dibujarRecta;
    lienzo2.alDibujar = dibujarEspaciado;

    const bitsDe = (p) => `${p.e.toString(2).padStart(E, '0')} ${p.f.toString(2).padStart(P, '0')}`;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = null, dm = 8;
      for (const q of puntos) { const d = Math.abs(q.x - x); if (d < dm) { dm = d; mejor = q; } }
      if (!mejor) return tip.ocultar();
      tip.mostrar(x, y, `valor <b>${VIZ.fmt(mejor.p.v, 6)}</b><br>bits 0 ${bitsDe(mejor.p)}<br>${mejor.p.sub ? 'subnormal' : 'normal, exponente ' + (mejor.p.e - sesgo())}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      if (!geo2) return;
      const { x, y } = lienzo2.posicion(ev);
      let mejor = null, dm = 10;
      for (const q of geo2.pts) { const d = Math.abs(geo2.p.sx(Math.log2(q[0])) - x); if (d < dm) { dm = d; mejor = q; } }
      if (!mejor) return tip2.ocultar();
      tip2.mostrar(x, y, `x = <b>${VIZ.fmt(mejor[0], 6)}</b><br>siguiente − x = ${VIZ.fmt(mejor[0] * mejor[1], 4)}<br>relativo <b>${VIZ.fmt(mejor[1], 3)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());

    zoom = 10;
    dibujarTodo();
  }

  VIZ.registrarTema('punto-flotante', {
    intro: String.raw`
      <p>Un computador dispone de una cantidad finita de bits, pero los números reales son infinitos (e incluso entre 0 y 1 hay
      una cantidad no numerable). El estándar <strong>IEEE 754</strong> resuelve el problema con una versión binaria de la notación
      científica: se guarda un signo, un exponente y unos pocos dígitos significativos. El resultado es que se representan
      exactamente solo algunos números —distribuidos de forma muy desigual— y todos los demás se <em>redondean</em> al más cercano.</p>
      <p>Por eso <code>0.1 + 0.2 == 0.3</code> es falso en casi todos los lenguajes: ni 0.1, ni 0.2, ni 0.3 tienen representación
      binaria finita.</p>`,
    visualizaciones: [
      {
        titulo: 'Anatomía de un número en punto flotante',
        descripcion: 'Escriba un número decimal y observe cómo se codifica, cuál es el valor exacto que realmente se almacena y cuánto error introduce el redondeo.',
        montar: montarEditor,
      },
      {
        titulo: 'Densidad de los números representables',
        descripcion: 'Un formato diminuto (minifloat) permite ver todos sus valores a la vez. Los valores están igualmente espaciados dentro de cada binada \\([2^k, 2^{k+1})\\), y el espaciado se duplica al pasar a la siguiente.',
        montar: montarRecta,
      },
    ],
    teoria: String.raw`
      <h2>Codificación</h2>
      <p>Un formato binario IEEE 754 se define por \(E\) bits de exponente y \(p\) bits de fracción. Dados el signo \(s\), el exponente
      almacenado \(e\) (entero sin signo) y la fracción \(f = (f_1 f_2 \dots f_p)_2\), con sesgo \(b = 2^{E-1} - 1\):</p>
      \[
      x = \begin{cases}
      (-1)^s \times 2^{\,e-b} \times (1.f_1 f_2\dots f_p)_2 &amp; 0 &lt; e &lt; 2^E - 1 \quad \text{(normal)} \\
      (-1)^s \times 2^{\,1-b} \times (0.f_1 f_2\dots f_p)_2 &amp; e = 0 \quad \text{(subnormal o cero)} \\
      (-1)^s \times \infty &amp; e = 2^E - 1,\ f = 0 \\
      \text{NaN} &amp; e = 2^E - 1,\ f \ne 0
      \end{cases}
      \]
      <p>El 1 inicial de los normales no se guarda (<em>bit implícito</em>), lo que da \(p + 1\) bits de precisión efectiva.</p>
      <table>
        <thead><tr><th>Formato</th><th class="num">E</th><th class="num">p</th><th class="num">sesgo</th><th>ε = 2^−p</th><th>máximo</th></tr></thead>
        <tbody>
          <tr><td>media (binary16)</td><td class="num">5</td><td class="num">10</td><td class="num">15</td><td>\(\approx 9.8\times10^{-4}\)</td><td>65 504</td></tr>
          <tr><td>simple (binary32)</td><td class="num">8</td><td class="num">23</td><td class="num">127</td><td>\(\approx 1.19\times10^{-7}\)</td><td>\(\approx 3.4\times10^{38}\)</td></tr>
          <tr><td>doble (binary64)</td><td class="num">11</td><td class="num">52</td><td class="num">1023</td><td>\(\approx 2.22\times10^{-16}\)</td><td>\(\approx 1.8\times10^{308}\)</td></tr>
        </tbody>
      </table>

      <h2>Espaciado y ULP</h2>
      <p>Dentro de la binada \([2^k, 2^{k+1})\) hay exactamente \(2^p\) valores, separados por la <strong>unidad en el último lugar</strong>:</p>
      \[ \operatorname{ulp}(x) = 2^{\,k - p}. \]
      <p>El espaciado absoluto se duplica en cada binada, pero el <em>relativo</em> \(\operatorname{ulp}(x)/x\) queda entre \(2^{-p}\)
      y \(2^{-p+1}\): el punto flotante ofrece precisión relativa aproximadamente constante en un rango enorme de magnitudes. El
      <strong>épsilon de máquina</strong> \(\varepsilon = 2^{-p}\) es la distancia de 1 al siguiente número representable.</p>

      <h2>Error de redondeo</h2>
      <p>Con redondeo al más cercano (empates al par), el valor almacenado \(\operatorname{fl}(x)\) de cualquier real \(x\) dentro del
      rango normal cumple</p>
      \[ \operatorname{fl}(x) = x(1 + \delta), \qquad |\delta| \le u = \frac{\varepsilon}{2} = 2^{-(p+1)}. \]
      <p>El estándar exige además que las operaciones básicas se redondeen correctamente: \(\operatorname{fl}(a \circ b) = (a \circ b)(1+\delta)\)
      con \(|\delta| \le u\) para \(\circ \in \{+, -, \times, \div\}\) y \(\sqrt{\ }\). Este <em>modelo estándar</em> es la base del análisis
      de errores numéricos.</p>

      <h2>Por qué 0.1 no es exacto</h2>
      <p>Un número racional tiene expansión binaria finita si y solo si su denominador reducido es una potencia de 2. Como
      \(0.1 = 1/(2 \cdot 5)\), su expansión es periódica:</p>
      \[ 0.1 = (0.0\overline{0011})_2. \]
      <p>En doble precisión se guarda \(0.1000000000000000055511151231257827\ldots\); la suma de los valores almacenados de 0.1 y 0.2
      se redondea a \(0.30000000000000004\), que no es el mismo número que el almacenado para 0.3.</p>

      <h2>Cancelación catastrófica</h2>
      <p>Al restar dos números muy cercanos, los dígitos iniciales se cancelan y el error relativo de los datos se amplifica:</p>
      \[ \frac{|\operatorname{fl}(a) - \operatorname{fl}(b) - (a - b)|}{|a - b|} \lesssim u\,\frac{|a| + |b|}{|a - b|}. \]
      <p>Por ejemplo, \(1 - \cos x\) para \(x\) pequeño pierde casi toda su precisión; la forma equivalente \(2\sin^2(x/2)\) no.
      Reescribir fórmulas para evitar restas de cantidades parecidas es una técnica central del cálculo numérico.</p>

      <h2>Subnormales</h2>
      <p>Sin subnormales habría un hueco entre 0 y el menor normal \(2^{1-b}\) mucho mayor que el espaciado justo por encima de él.
      Los subnormales lo rellenan con espaciado uniforme \(2^{1-b-p}\) (<em>desbordamiento gradual</em>) y garantizan que
      \(x - y = 0 \iff x = y\). A cambio, pierden precisión relativa: la figura 2 muestra cómo su espaciado relativo crece hasta 1.</p>`,
  });
})();
