const HOLD = 5000;
const BURST = 2050;

// [row, left edge, right edge] traced on the original 1672 × 941 photograph.
// Below the hair, the left edge follows the foreground woman's occluding contour.
const rearContour = [
  [0,1054,1212], [10,1043,1217], [20,1015,1229], [30,1007,1241], [40,1001,1250],
  [50,1000,1268], [60,998,1273], [70,993,1283], [80,990,1290], [90,989,1295],
  [100,989,1302], [110,991,1312], [120,994,1310], [130,1000,1311], [140,1007,1311],
  [150,1011,1311], [160,1016,1309], [170,1020,1307], [180,1024,1335], [190,1028,1343],
  [200,1034,1344], [220,1037,1347], [240,1041,1347], [260,1045,1346], [280,1051,1348],
  [295,1057,1364], [310,1061,1393], [325,1066,1414], [340,1070,1437], [355,1074,1452],
  [370,1077,1461], [385,1077,1469], [400,1078,1475], [420,1079,1481], [440,1078,1483],
  [460,1073,1485], [480,1069,1486], [500,1074,1485], [520,1081,1484], [540,1088,1484],
  [550,1100,1486], [560,1122,1486], [570,1223,1484], [580,1314,1482], [590,1338,1481],
  [600,1351,1478], [610,1360,1477], [620,1367,1474], [630,1371,1467], [640,1374,1460],
  [650,1377,1450], [660,1392,1415], [666,1404,1404],
];
const contourHeight = rearContour.at(-1)[0] + 1;

function contourPixels() {
  const pixels = new Uint8Array(contourHeight * 4);
  let segment = 0;
  for (let y = 0; y < contourHeight; y++) {
    if (y > rearContour[segment + 1][0]) segment++;
    const [top, left, right] = rearContour[segment];
    const [bottom, nextLeft, nextRight] = rearContour[segment + 1];
    const ratio = (y - top) / (bottom - top);
    const l = Math.round(left + (nextLeft - left) * ratio);
    const r = Math.round(right + (nextRight - right) * ratio);
    pixels.set([l >> 8, l & 255, r >> 8, r & 255], y * 4);
  }
  return pixels;
}

const vertex = `
 attribute vec2 aPosition;
 varying vec2 vPoint;
 void main() {
   vPoint = vec2(aPosition.x + 1.0, 1.0 - aPosition.y) * 0.5;
   gl_Position = vec4(aPosition, 0.0, 1.0);
 }`;

// Landmarks are measured in the original photograph, before the responsive crop.
const fragment = `
 precision highp float;
 varying vec2 vPoint;
 uniform sampler2D uPhoto;
 uniform sampler2D uRearContour;
 uniform vec4 uCrop;
 uniform vec2 uBlink;
 uniform vec4 uMotion;
 uniform float uRearSlide;
 const vec2 plate = vec2(1672.0, 941.0);

 float weight(vec2 p, vec2 center, vec2 radius) {
   vec2 d = (p - center) / radius;
   return 1.0 - smoothstep(0.08, 1.0, dot(d, d));
 }

 // Use nearby skin inside the lens to cover the eye opening as the lid lowers.
 // The feather follows the eye corners and doesn't stretch the glass or lashes.
 vec4 lid(vec2 p, vec2 center, float width, float slope, vec2 opening, float blink) {
   float x = (p.x - center.x) / width;
   if (blink <= 0.0 || abs(x) >= 1.0) return vec4(0.0);
   float almond = pow(1.0 - x * x, 0.64);
   float baseline = center.y + slope * (p.x - center.x);
   float y = p.y - baseline;
   float upper = -opening.x * almond;
   float lower = opening.y * almond;
   float edge = mix(upper - 1.0, lower + 1.2, blink);
   if (y < upper - 2.0 || y > edge + 1.4) return vec4(0.0);
   float coverage = smoothstep(upper - 2.0, upper + 2.7, y)
     * (1.0 - smoothstep(edge - 0.8, edge + 1.4, y))
     * smoothstep(0.0, 0.15, 1.0 - abs(x)) * smoothstep(0.02, 0.18, blink);
   vec2 skinPoint = vec2(p.x, baseline + lower + 9.0 + 0.4 * (y - upper));
   vec3 skin = texture2D(uPhoto, skinPoint / plate).rgb;
   float shading = mix(0.78, 1.0, smoothstep(upper, upper + 9.0, y));
   float lash = 1.0 - 0.38 * (1.0 - smoothstep(0.0, 1.8, abs(y - edge + 0.6)));
   return vec4(skin * shading * lash * coverage, coverage);
 }

 vec4 over(vec4 top, vec4 bottom) { return top + bottom * (1.0 - top.a); }

 vec4 rearLayer(vec2 p) {
   float shift = 20.0 * uRearSlide;
   if (shift < 0.05 || p.x < 985.0 || p.x > 1490.0 || p.y >= 666.0) return vec4(0.0);
   vec4 edges = texture2D(uRearContour, vec2(0.5, (p.y + 0.5) / ${contourHeight}.0));
   float left = dot(edges.rg, vec2(65280.0, 255.0));
   float right = dot(edges.ba, vec2(65280.0, 255.0));
   float inset = min(p.x - left, right - p.x);
   if (inset <= 5.0) return vec4(0.0);

   // Ease the displacement to zero inside the contour. This keeps the original
   // background and the naturally soft photographic edge pixel-aligned.
   float influence = smoothstep(5.0, 52.0, inset);
   vec2 rear = p + vec2(shift * influence, 0.0);
   vec2 grip = influence * uMotion.w * vec2(4.0, 2.5) * weight(rear, vec2(1350.0, 485.0), vec2(139.0, 143.0));
   vec2 source = rear + grip;
   float alpha = smoothstep(0.03, 0.65, length(source - p));
   vec4 man = vec4(texture2D(uPhoto, source / plate).rgb * alpha, alpha);
   man = over(lid(rear, vec2(1076.0, 252.0), 29.0, 0.04, vec2(7.0, 6.0), uBlink.y * 0.62), man);
   man = over(lid(rear, vec2(1207.0, 251.0), 35.0, 0.055, vec2(8.5, 7.0), uBlink.y), man);
   return man * smoothstep(5.0, 12.0, inset);
 }

 void main() {
   vec2 p = (uCrop.xy + vPoint * uCrop.zw) * plate;
   vec2 q = p;
   q += uMotion.x * (
     vec2(-4.1, 1.6) * weight(p, vec2(572.0, 145.0), vec2(142.0, 128.0)) +
     vec2(-3.3, 0.9) * weight(p, vec2(936.0, 77.0), vec2(104.0, 97.0)) +
     vec2(3.7, -1.2) * weight(p, vec2(1003.0, 553.0), vec2(57.0, 91.0)));
   q += uMotion.y * vec2(-0.9, 3.5) * weight(p, vec2(1170.0, 716.0), vec2(241.0, 159.0));
   q += uMotion.z * vec2(-4.6, 2.8) * weight(p, vec2(660.0, 774.0), vec2(220.0, 208.0));
   float opacity = smoothstep(0.035, 0.62, length(q - p));
   vec3 color = texture2D(uPhoto, q / plate).rgb;
   vec4 frame = vec4(color * opacity, opacity);
   frame = over(lid(p, vec2(705.0, 404.5), 47.0, -0.045, vec2(14.5, 10.5), uBlink.x), frame);
   frame = over(lid(p, vec2(878.0, 387.0), 49.0, -0.32, vec2(14.4, 12.0), uBlink.x), frame);
   gl_FragColor = over(frame, rearLayer(p));
 }`;

function renderer(image) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-motion-layer';
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {alpha: true, antialias: false, powerPreference: 'low-power'});
  if (!gl) return null;

  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      return null;
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const contour = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, contour);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, contourHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, contourPixels());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, 'uRearContour'), 1);
  gl.activeTexture(gl.TEXTURE0);
  const crop = gl.getUniformLocation(program, 'uCrop');
  const blink = gl.getUniformLocation(program, 'uBlink');
  const motion = gl.getUniformLocation(program, 'uMotion');
  const rearSlide = gl.getUniformLocation(program, 'uRearSlide');
  let source = '';

  function fit() {
    const w = image.clientWidth, h = image.clientHeight;
    const iw = image.naturalWidth, ih = image.naturalHeight;
    if (!w || !h || !iw || !ih) return false;
    if (source !== image.currentSrc) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      source = image.currentSrc;
    }
    const scale = Math.max(w / iw, h / ih);
    const [x, y] = getComputedStyle(image).objectPosition.split(' ');
    const offset = (space, part) => part?.endsWith('%') ? space * parseFloat(part) / 100 : parseFloat(part) || 0;
    const fw = iw * scale, fh = ih * scale;
    gl.uniform4f(crop, -offset(w - fw, x) / fw, -offset(h - fh, y) / fh, w / fw, h / fh);
    // Cap the backing surface to roughly one megapixel, even on high-density screens.
    const density = Math.min(devicePixelRatio, 1.5, Math.sqrt(1_000_000 / (w * h)));
    const width = Math.round(w * density), height = Math.round(h * density);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
    return true;
  }

  image.after(canvas);
  return {
    canvas, fit,
    draw(eyes, values, slide) {
      gl.uniform2fv(blink, eyes);
      gl.uniform4fv(motion, values);
      gl.uniform1f(rearSlide, slide);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      canvas.hidden = false;
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteTexture(contour);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      canvas.remove();
    },
  };
}

const clamp = n => Math.max(0, Math.min(n, 1));
const ease = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const pulse = (t, start, duration) => Math.sin(Math.PI * clamp((t - start) / duration)) ** 2;
const blinkAt = (t, start) => ease((t - start) / 75) * (1 - ease((t - start - 103) / 110));

/** The photograph is always present. Only brief, visible moments need the GPU. */
export function mountHeroMotion(image) {
  if (!('IntersectionObserver' in window) || !('ResizeObserver' in window) || !('WebGLRenderingContext' in window)) return () => {};
  const hero = image.parentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const options = {signal: events.signal};
  let visible = false, frozen = false, disposed = false;
  let remaining = HOLD, deadline = 0, timer = 0, frame = 0, running = false;
  let painter, dirty = true, sequence = 0;

  function stop() {
    if (timer) {
      remaining = Math.max(0, deadline - performance.now());
      clearTimeout(timer);
      timer = 0;
    }
    if (running) remaining = 4800;
    running = false;
    cancelAnimationFrame(frame);
    if (painter) painter.canvas.hidden = true;
  }

  const eligible = () => !disposed && visible && !frozen && !reduced.matches && !document.hidden
    && image.isConnected && image.complete && image.naturalWidth > 0 && !hero.closest('[inert]');

  function sync() {
    if (!eligible()) { stop(); return; }
    if (!timer && !running) {
      deadline = performance.now() + remaining;
      timer = setTimeout(start, remaining);
    }
  }

  function start() {
    timer = 0;
    if (!eligible()) { remaining = 800; return; }
    try {
      if (!painter) {
        painter = renderer(image);
        if (!painter) { dispose(); return; }
        painter.canvas.addEventListener('webglcontextlost', dispose, options);
      }
      dirty = !painter.fit();
    } catch { dispose(); return; }
    running = true;
    const began = performance.now();
    const rear = sequence++ % 2 === 1;
    let last = -Infinity;
    function tick(now) {
      if (!eligible()) { stop(); return; }
      const t = now - began;
      if (t >= BURST) {
        stop();
        remaining = 4600 + Math.random() * 3600;
        sync();
        return;
      }
      if (now - last >= 31) {
        last = now;
        try {
          if (dirty) dirty = !painter.fit();
          if (!dirty) painter.draw(
            [rear ? 0 : blinkAt(t, 610), rear ? blinkAt(t, 850) : 0],
            [rear ? 0 : pulse(t, 80, 1800), rear ? 0 : pulse(t, 240, 1720),
             rear ? 0 : pulse(t, 440, 1370), rear ? pulse(t, 230, 1530) : 0],
            rear ? pulse(t, 110, 1790) : 0,
          );
        } catch { dispose(); return; }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  const viewport = new IntersectionObserver(([entry]) => {
    visible = entry.intersectionRatio >= 0.15;
    sync();
  }, {threshold: [0, 0.15]});
  const size = new ResizeObserver(() => { dirty = true; });
  const menu = new MutationObserver(sync);
  viewport.observe(hero);
  size.observe(image);
  menu.observe(hero.closest('main') || hero, {attributes: true, attributeFilter: ['inert']});
  image.addEventListener('load', () => { dirty = true; sync(); }, options);
  document.addEventListener('visibilitychange', sync, options);
  reduced.addEventListener('change', sync, options);
  window.addEventListener('pagehide', () => { frozen = true; stop(); }, options);
  window.addEventListener('pageshow', () => { frozen = false; sync(); }, options);
  sync();

  function dispose() {
    disposed = true;
    stop();
    events.abort();
    viewport.disconnect();
    size.disconnect();
    menu.disconnect();
    painter?.dispose();
  }
  return dispose;
}
