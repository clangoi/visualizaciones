/* Utilidades compartidas por todas las visualizaciones:
   paleta, lienzos con alta densidad de píxeles, ejes, controles,
   leyendas, lecturas numéricas y tooltips. */
window.VIZ = (function () {
  'use strict';
  const VIZ = {};

  /* ---------- Paleta (validada para fondo claro) ---------- */

  VIZ.color = {
    s1: '#2a78d6', // azul
    s2: '#eb6834', // naranjo
    s3: '#1baf7a', // aguamarina
    s4: '#eda100', // amarillo
    s5: '#e87ba4', // magenta
    s6: '#008300', // verde
    s7: '#6250d6', // violeta
    s8: '#e34948', // rojo
    tinta: '#0b0b0b',
    tinta2: '#52514e',
    apagado: '#898781',
    rejilla: '#e1e0d9',
    eje: '#c3c2b7',
    superficie: '#ffffff',
    neutro: '#f0efec',
  };
  VIZ.series = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((k) => VIZ.color[k]);

  // Rampa secuencial azul (claro → oscuro).
  VIZ.rampa = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
    '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
  // Rampa neutra para fondos de mapas de calor bajo series de color.
  VIZ.rampaGris = ['#ffffff', '#f0efec', '#e1e0d9', '#d2d1c8', '#c3c2b7', '#a9a8a0', '#898781'];

  const cacheRgb = new Map();
  VIZ.rgb = function (hex) {
    if (cacheRgb.has(hex)) return cacheRgb.get(hex);
    const n = parseInt(hex.slice(1), 16);
    const r = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cacheRgb.set(hex, r);
    return r;
  };
  VIZ.alfa = (hex, a) => {
    const [r, g, b] = VIZ.rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  // Interpola una rampa en t ∈ [0,1]; devuelve [r,g,b].
  VIZ.enRampa = function (t, rampa = VIZ.rampa) {
    t = Math.min(1, Math.max(0, t));
    const x = t * (rampa.length - 1);
    const i = Math.min(rampa.length - 2, Math.floor(x));
    const f = x - i;
    const a = VIZ.rgb(rampa[i]);
    const b = VIZ.rgb(rampa[i + 1]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  VIZ.css = (rgb) => `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;

  VIZ.fuente = (px, peso = 400) => `${peso} ${px}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;

  /* ---------- DOM ---------- */

  VIZ.el = function (tag, attrs, ...hijos) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const h of hijos.flat()) if (h != null) e.append(h.nodeType ? h : String(h));
    return e;
  };

  let contadorId = 0;
  const uid = (p = 'c') => `${p}-${++contadorId}`;

  /* ---------- Formato numérico ---------- */

  VIZ.fmt = function (v, dig = 4) {
    if (!Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v > 0 ? '∞' : '−∞';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(1).replace('e+', 'e');
    return String(+v.toPrecision(dig)).replace('-', '−');
  };
  VIZ.entero = (v) => Math.round(v).toLocaleString('es-CL');

  /* ---------- Lienzo ---------- */

  // Crea un canvas nítido que se adapta al ancho de su contenedor.
  // opciones: alto (px) o proporcion (alto/ancho), altoMax.
  VIZ.lienzo = function (padre, opciones = {}) {
    const envoltura = VIZ.el('div', { class: 'lienzo' });
    const canvas = document.createElement('canvas');
    envoltura.appendChild(canvas);
    padre.appendChild(envoltura);
    const ctx = canvas.getContext('2d');
    const l = { canvas, ctx, envoltura, ancho: 0, alto: 0, alDibujar: null };
    let ultimoAncho = -1;

    l.ajustar = function (forzar) {
      const w = envoltura.clientWidth;
      if (!forzar && w === ultimoAncho) return;
      ultimoAncho = w;
      let h = opciones.proporcion ? Math.round(w * opciones.proporcion) : opciones.alto || 360;
      if (opciones.altoMax) h = Math.min(h, opciones.altoMax);
      if (opciones.altoMin) h = Math.max(h, opciones.altoMin);
      if (typeof opciones.altoFn === 'function') h = opciones.altoFn(w);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      l.ancho = w;
      l.alto = h;
      if (l.alDibujar) l.alDibujar();
    };
    l.cambiarAlto = function (h) {
      opciones.alto = h;
      opciones.proporcion = null;
      l.ajustar(true);
    };
    l.limpiar = function (fondo) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (fondo) {
        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    l.posicion = function (ev) {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    l.redibujar = () => l.alDibujar && l.alDibujar();

    new ResizeObserver(() => l.ajustar()).observe(envoltura);
    l.ajustar(true);
    return l;
  };

  /* ---------- Tooltip ---------- */

  VIZ.tooltip = function (lienzo) {
    const t = VIZ.el('div', { class: 'tooltip', role: 'status' });
    lienzo.envoltura.appendChild(t);
    return {
      mostrar(x, y, html) {
        t.innerHTML = html;
        t.style.display = 'block';
        const w = t.offsetWidth;
        const h = t.offsetHeight;
        let px = x + 14;
        let py = y + 14;
        if (px + w > lienzo.ancho) px = x - w - 14;
        if (py + h > lienzo.alto) py = Math.max(0, y - h - 14);
        t.style.left = Math.max(0, px) + 'px';
        t.style.top = py + 'px';
      },
      ocultar() {
        t.style.display = 'none';
      },
    };
  };
  VIZ.filaTooltip = (color, texto, valor) =>
    `<div class="fila"><span class="punto" style="background:${color}"></span>${texto}${valor != null ? ` <b>${valor}</b>` : ''}</div>`;

  /* ---------- Escalas y ejes ---------- */

  VIZ.ticks = function (min, max, n = 5) {
    if (!(max > min)) return [min];
    const bruto = (max - min) / Math.max(1, n);
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const r = bruto / mag;
    const paso = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const res = [];
    for (let v = Math.ceil(min / paso - 1e-9) * paso; v <= max + paso * 1e-9; v += paso) res.push(+v.toFixed(12));
    return res;
  };
  VIZ.ticksLog = function (min, max, n = 6) {
    const a = Math.floor(Math.log10(min));
    const b = Math.ceil(Math.log10(max));
    const paso = Math.max(1, Math.ceil((b - a) / n));
    const res = [];
    for (let e = a; e <= b; e += paso) {
      const v = Math.pow(10, e);
      if (v >= min * 0.999 && v <= max * 1.001) res.push(v);
    }
    return res;
  };

  // Sistema de coordenadas para un gráfico cartesiano dentro de un lienzo.
  // d: {xmin,xmax,ymin,ymax}; o: {margen, logY, etiquetaX, etiquetaY, formatoX, formatoY, ticksX, ticksY}
  VIZ.plano = function (l, d, o = {}) {
    const m = Object.assign({ izq: 54, der: 18, sup: o.etiquetaY ? 26 : 14, inf: o.etiquetaX ? 44 : 30 }, o.margen || {});
    const x0 = m.izq, x1 = l.ancho - m.der, y0 = l.alto - m.inf, y1 = m.sup;
    const ly = !!o.logY;
    const ty = (v) => (ly ? Math.log10(Math.max(v, 1e-300)) : v);
    const tmin = ty(d.ymin), tmax = ty(d.ymax);
    const p = {
      x0, x1, y0, y1, d,
      sx: (v) => x0 + ((v - d.xmin) / (d.xmax - d.xmin)) * (x1 - x0),
      sy: (v) => y0 - ((ty(v) - tmin) / (tmax - tmin)) * (y0 - y1),
      ix: (px) => d.xmin + ((px - x0) / (x1 - x0)) * (d.xmax - d.xmin),
      iy: (py) => {
        const t = tmin + ((y0 - py) / (y0 - y1)) * (tmax - tmin);
        return ly ? Math.pow(10, t) : t;
      },
      dentro: (px, py) => px >= x0 && px <= x1 && py >= y1 && py <= y0,
    };
    p.recortar = function () {
      l.ctx.beginPath();
      l.ctx.rect(x0, y1 - 1, x1 - x0, y0 - y1 + 2);
      l.ctx.clip();
    };
    p.ejes = function () {
      const c = l.ctx;
      c.save();
      c.font = VIZ.fuente(11);
      c.lineWidth = 1;
      const fx = o.formatoX || ((v) => VIZ.fmt(v));
      const fy = o.formatoY || ((v) => VIZ.fmt(v));
      const tx = o.ticksX || VIZ.ticks(d.xmin, d.xmax, Math.max(2, Math.floor((x1 - x0) / 85)));
      const tyv = o.ticksY || (ly ? VIZ.ticksLog(d.ymin, d.ymax, Math.max(2, Math.floor((y0 - y1) / 40)))
        : VIZ.ticks(d.ymin, d.ymax, Math.max(2, Math.floor((y0 - y1) / 48))));
      c.fillStyle = VIZ.color.apagado;
      c.strokeStyle = VIZ.color.rejilla;
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      for (const v of tyv) {
        const y = Math.round(p.sy(v)) + 0.5;
        if (y < y1 - 1 || y > y0 + 1) continue;
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x1, y);
        c.stroke();
        c.fillText(fy(v), x0 - 8, y);
      }
      c.textAlign = 'center';
      c.textBaseline = 'top';
      for (const v of tx) {
        const x = Math.round(p.sx(v)) + 0.5;
        if (x < x0 - 1 || x > x1 + 1) continue;
        c.strokeStyle = VIZ.color.eje;
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x, y0 + 4);
        c.stroke();
        c.fillText(fx(v), x, y0 + 7);
      }
      c.strokeStyle = VIZ.color.eje;
      c.beginPath();
      c.moveTo(x0, y0 + 0.5);
      c.lineTo(x1, y0 + 0.5);
      c.stroke();
      c.fillStyle = VIZ.color.tinta2;
      if (o.etiquetaX) {
        c.textAlign = 'right';
        c.textBaseline = 'bottom';
        c.fillText(o.etiquetaX, x1, l.alto - 2);
      }
      if (o.etiquetaY) {
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(o.etiquetaY, 4, 2);
      }
      c.restore();
    };
    return p;
  };

  // Traza una polilínea a partir de puntos [x,y] en coordenadas de datos.
  VIZ.trazar = function (ctx, p, puntos, color, ancho = 2, guiones) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = ancho;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (guiones) ctx.setLineDash(guiones);
    ctx.beginPath();
    let abierto = false;
    for (const [x, y] of puntos) {
      if (!Number.isFinite(y)) {
        abierto = false;
        continue;
      }
      const px = p.sx(x), py = p.sy(y);
      if (!abierto) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      abierto = true;
    }
    ctx.stroke();
    ctx.restore();
  };

  // Marcador con anillo del color de la superficie.
  VIZ.marcador = function (ctx, x, y, color, r = 4.5, forma = 0) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = VIZ.color.superficie;
    ctx.lineWidth = 2;
    ctx.beginPath();
    VIZ.forma(ctx, x, y, r, forma);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  };
  // Formas para codificación secundaria: 0 círculo, 1 cuadrado, 2 triángulo, 3 rombo, 4 triángulo invertido, 5 cruz, 6 estrella, 7 hexágono.
  VIZ.forma = function (ctx, x, y, r, forma) {
    const poli = (n, rot, rr = r) => {
      for (let i = 0; i < n; i++) {
        const a = rot + (i * 2 * Math.PI) / n;
        const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    switch (forma % 8) {
      case 0: ctx.arc(x, y, r, 0, Math.PI * 2); break;
      case 1: ctx.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76); break;
      case 2: poli(3, -Math.PI / 2, r * 1.2); break;
      case 3: poli(4, 0, r * 1.2); break;
      case 4: poli(3, Math.PI / 2, r * 1.2); break;
      case 5: {
        const a = r * 0.42;
        ctx.moveTo(x - a, y - r); ctx.lineTo(x + a, y - r); ctx.lineTo(x + a, y - a); ctx.lineTo(x + r, y - a);
        ctx.lineTo(x + r, y + a); ctx.lineTo(x + a, y + a); ctx.lineTo(x + a, y + r); ctx.lineTo(x - a, y + r);
        ctx.lineTo(x - a, y + a); ctx.lineTo(x - r, y + a); ctx.lineTo(x - r, y - a); ctx.lineTo(x - a, y - a);
        ctx.closePath();
        break;
      }
      case 6: {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.55 : r * 1.25;
          i ? ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
        }
        ctx.closePath();
        break;
      }
      default: poli(6, 0, r * 1.1);
    }
  };

  /* ---------- Controles ---------- */

  VIZ.controles = function (padre) {
    const caja = VIZ.el('div', { class: 'controles' });
    padre.appendChild(caja);
    let filaAcciones = null;
    const acciones = () => {
      if (!filaAcciones) {
        filaAcciones = VIZ.el('div', { class: 'acciones' });
        caja.appendChild(filaAcciones);
      }
      return filaAcciones;
    };

    return {
      caja,
      rango({ etiqueta, min, max, paso = 1, valor, formato = (v) => v, alCambiar, alSoltar }) {
        const id = uid('r');
        const salida = VIZ.el('output', { for: id }, formato(valor));
        const input = VIZ.el('input', { type: 'range', id, min, max, step: paso, value: valor });
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          salida.textContent = formato(v);
          if (alCambiar) alCambiar(v);
        });
        if (alSoltar) input.addEventListener('change', () => alSoltar(parseFloat(input.value)));
        const campo = VIZ.el('div', { class: 'campo' }, VIZ.el('label', { for: id }, VIZ.el('span', null, etiqueta), salida), input);
        caja.insertBefore(campo, filaAcciones);
        return {
          input,
          get valor() { return parseFloat(input.value); },
          set valor(v) { input.value = v; salida.textContent = formato(parseFloat(input.value)); },
          set max(v) { input.max = v; },
          refrescar() { salida.textContent = formato(parseFloat(input.value)); },
        };
      },
      selector({ etiqueta, opciones, valor, alCambiar }) {
        const id = uid('s');
        const sel = VIZ.el('select', { id }, opciones.map(([v, t]) => VIZ.el('option', { value: v }, t)));
        if (valor != null) sel.value = valor;
        sel.addEventListener('change', () => alCambiar && alCambiar(sel.value));
        const campo = VIZ.el('div', { class: 'campo' }, VIZ.el('label', { for: id }, VIZ.el('span', null, etiqueta)), sel);
        caja.insertBefore(campo, filaAcciones);
        return {
          select: sel,
          get valor() { return sel.value; },
          set valor(v) { sel.value = v; },
        };
      },
      numero({ etiqueta, min, max, paso = 1, valor, alCambiar }) {
        const id = uid('n');
        const input = VIZ.el('input', { type: 'number', id, min, max, step: paso, value: valor });
        input.addEventListener('change', () => alCambiar && alCambiar(parseFloat(input.value)));
        const campo = VIZ.el('div', { class: 'campo' }, VIZ.el('label', { for: id }, VIZ.el('span', null, etiqueta)), input);
        caja.insertBefore(campo, filaAcciones);
        return {
          input,
          get valor() { return parseFloat(input.value); },
          set valor(v) { input.value = v; },
        };
      },
      texto({ etiqueta, valor, alCambiar, alEnter }) {
        const id = uid('t');
        const input = VIZ.el('input', { type: 'text', id, value: valor, spellcheck: 'false', autocomplete: 'off' });
        input.addEventListener('change', () => alCambiar && alCambiar(input.value));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && alEnter) alEnter(input.value); });
        const campo = VIZ.el('div', { class: 'campo' }, VIZ.el('label', { for: id }, VIZ.el('span', null, etiqueta)), input);
        caja.insertBefore(campo, filaAcciones);
        return { input, get valor() { return input.value; }, set valor(v) { input.value = v; } };
      },
      // Grupo de casillas en una fila completa. items: [{clave, texto, color, activo}]
      casillas(items, alCambiar) {
        const grupo = VIZ.el('div', { class: 'grupo-casillas' });
        const estado = {};
        for (const it of items) {
          estado[it.clave] = it.activo !== false;
          const input = VIZ.el('input', { type: 'checkbox' });
          input.checked = estado[it.clave];
          input.addEventListener('change', () => {
            estado[it.clave] = input.checked;
            if (alCambiar) alCambiar(estado);
          });
          grupo.appendChild(VIZ.el('label', { class: 'casilla' }, input,
            it.color ? VIZ.el('span', { class: 'muestra', style: { background: it.color } }) : null, it.texto));
        }
        caja.insertBefore(grupo, filaAcciones);
        return estado;
      },
      casilla({ etiqueta, valor = false, alCambiar }) {
        const input = VIZ.el('input', { type: 'checkbox' });
        input.checked = valor;
        input.addEventListener('change', () => alCambiar && alCambiar(input.checked));
        const lab = VIZ.el('label', { class: 'casilla' }, input, etiqueta);
        caja.insertBefore(VIZ.el('div', { class: 'campo' }, lab), filaAcciones);
        return { input, get valor() { return input.checked; }, set valor(v) { input.checked = v; } };
      },
      boton(texto, alClick, { primario = false } = {}) {
        const b = VIZ.el('button', { type: 'button', class: 'boton' + (primario ? ' primario' : '') }, texto);
        b.addEventListener('click', alClick);
        acciones().appendChild(b);
        return b;
      },
    };
  };

  /* ---------- Leyenda y lecturas ---------- */

  VIZ.leyenda = function (padre, items) {
    const caja = VIZ.el('div', { class: 'leyenda' });
    padre.appendChild(caja);
    const api = {
      caja,
      set(lista) {
        caja.replaceChildren(...lista.map((it) =>
          VIZ.el('span', null,
            VIZ.el('i', {
              class: it.forma || 'cuadro',
              style: it.borde
                ? { background: it.color, border: `1.5px solid ${it.borde}` }
                : { background: it.color },
            }),
            it.texto)));
      },
    };
    if (items) api.set(items);
    return api;
  };

  VIZ.lectura = function (padre) {
    const caja = VIZ.el('dl', { class: 'lectura' });
    padre.appendChild(caja);
    return {
      caja,
      set(pares) {
        caja.replaceChildren(...pares.map(([k, v]) => VIZ.el('div', null, VIZ.el('dt', null, k), VIZ.el('dd', null, v))));
      },
    };
  };

  VIZ.nota = (padre, html) => {
    const p = VIZ.el('p', { class: 'nota-viz', html });
    padre.appendChild(p);
    return p;
  };

  /* ---------- Animación ---------- */

  // Bucle con requestAnimationFrame; fn(dt) devuelve false para detenerse.
  VIZ.bucle = function (fn, alDetener) {
    let id = null;
    let previo = 0;
    const paso = (t) => {
      const dt = previo ? Math.min(100, t - previo) : 16;
      previo = t;
      if (fn(dt) === false) {
        id = null;
        if (alDetener) alDetener();
        return;
      }
      id = requestAnimationFrame(paso);
    };
    return {
      get activo() { return id !== null; },
      iniciar() {
        if (id !== null) return;
        previo = 0;
        id = requestAnimationFrame(paso);
      },
      detener() {
        if (id === null) return;
        cancelAnimationFrame(id);
        id = null;
        if (alDetener) alDetener();
      },
    };
  };

  /* ---------- Aleatoriedad reproducible ---------- */

  VIZ.semilla = function (s = 1) {
    let a = s >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  VIZ.normal = function (rnd = Math.random) {
    let u = 0;
    while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };

  return VIZ;
})();
