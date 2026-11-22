import { createProgram, FULLSCREEN_VS, type InteractionState } from "./webgl-utils";

const PARTICLE_COUNT = 2800;

export interface SignalFlowOptions {
  /** Element that receives pointer events (defaults to the canvas itself). */
  interactionTarget?: HTMLElement;
  /** Enables seamless edge fading and right-weighted hero composition. */
  seamless?: boolean;
}

const PARTICLE_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos;
layout(location = 1) in float a_coherence;
layout(location = 2) in float a_hue;
layout(location = 3) in float a_size;

uniform float u_dpr;
out float v_coherence;
out float v_hue;

void main() {
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = a_size * u_dpr;
  v_coherence = a_coherence;
  v_hue = a_hue;
}
`;

const PARTICLE_FS = `#version 300 es
precision highp float;

in float v_coherence;
in float v_hue;
uniform float u_theme;
out vec4 fragColor;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float alpha = smoothstep(0.25, 0.02, r);

  // Communiti purple -> vivid violet -> luminous orchid pink as signal locks in
  vec3 purple = vec3(0.310, 0.224, 0.965);
  vec3 violet = vec3(0.560, 0.360, 1.000);
  vec3 pink = vec3(0.840, 0.420, 1.000);
  vec3 bright = mix(vec3(0.95, 0.56, 1.0), vec3(1.0, 0.90, 1.0), u_theme);

  vec3 baseCol = mix(purple, violet, v_hue);
  vec3 col = mix(baseCol, pink, v_coherence * 0.85);
  col = mix(col, bright, smoothstep(0.65, 1.0, v_coherence));

  fragColor = vec4(col, alpha * mix(0.56, 0.92, v_coherence));
}
`;

const FADE_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_prev;
uniform vec3 u_bg;
uniform float u_decay;
out vec4 fragColor;

void main() {
  vec4 prev = texture(u_prev, v_uv);
  vec3 faded = mix(u_bg, prev.rgb, u_decay);
  fragColor = vec4(faded, 1.0);
}
`;

const BLIT_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_pointer;
uniform float u_hover;
uniform float u_pulseAge;
uniform vec2 u_pulseOrigin;
uniform float u_theme;
uniform vec3 u_bg;
uniform float u_seamless;
out vec4 fragColor;

void main() {
  vec3 texCol = texture(u_tex, v_uv).rgb;
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;
  vec2 ptr = (u_pointer - 0.5) * aspect;

  vec3 col = texCol;

  // Delicate architectural clarity ring around pointer
  float d = length(p - ptr);
  float ring = smoothstep(0.004, 0.0, abs(d - 0.21)) * u_hover;
  vec3 ringCol = mix(vec3(0.42, 0.31, 0.98), vec3(0.90, 0.65, 1.0), u_theme);
  col = mix(col, ringCol, ring * 0.42);

  // Harmonic click shockwave
  if (u_pulseAge >= 0.0 && u_pulseAge < 1.6) {
    vec2 orig = (u_pulseOrigin - 0.5) * aspect;
    float pd = length(p - orig);
    float wave = smoothstep(0.011, 0.0, abs(pd - u_pulseAge * 0.68)) * exp(-u_pulseAge * 2.2);
    col = mix(col, vec3(0.88, 0.50, 1.0), wave * 0.72);
  }

  // Seamless fade into exact page background around all edges (and gently behind left hero copy on wide viewports)
  if (u_seamless > 0.5) {
    float edgeX = smoothstep(0.0, 0.14, v_uv.x) * smoothstep(1.0, 0.86, v_uv.x);
    float edgeY = smoothstep(0.0, 0.18, v_uv.y) * smoothstep(1.0, 0.82, v_uv.y);
    float mask = edgeX * edgeY;

    // On wide desktop hero layouts, keep left text zone ultra-clean while letting right side shine.
    // On narrow portrait layouts, keep upper text zone calm and let streamlines bloom below.
    float wide = smoothstep(1.15, 1.65, aspect.x);
    float desktopClear = mix(0.06, 1.0, smoothstep(0.38, 0.58, v_uv.x));
    float mobileClear = mix(0.10, 1.0, smoothstep(0.32, 0.14, v_uv.y));
    mask *= mix(mobileClear, desktopClear, wide);

    col = mix(u_bg, col, mask);
  }

  fragColor = vec4(col, 1.0);
}
`;

function pseudoNoise(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 3.1 + t * 0.62) * Math.cos(y * 2.9 - t * 0.48) +
    0.5 * Math.sin((x + y) * 5.2 - t * 0.85) +
    0.35 * Math.cos((x - y) * 6.8 + t * 0.68)
  );
}

function bgForTheme(theme: number): [number, number, number] {
  // Exact match to --paper: light #ffffff, dark #111018
  const r = theme * (17 / 255) + (1 - theme) * 1.0;
  const g = theme * (16 / 255) + (1 - theme) * 1.0;
  const b = theme * (24 / 255) + (1 - theme) * 1.0;
  return [r, g, b];
}

export function mountSignalFlow(
  canvas: HTMLCanvasElement,
  options: SignalFlowOptions = {},
): () => void {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return () => {};

  const seamless = Boolean(options.seamless);
  const target = options.interactionTarget ?? canvas;

  const particleProg = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
  const fadeProg = createProgram(gl, FULLSCREEN_VS, FADE_FS);
  const blitProg = createProgram(gl, FULLSCREEN_VS, BLIT_FS);

  const quadVao = gl.createVertexArray();
  const particleVao = gl.createVertexArray();
  const vbo = gl.createBuffer();

  const px = new Float32Array(PARTICLE_COUNT);
  const py = new Float32Array(PARTICLE_COUNT);
  const vx = new Float32Array(PARTICLE_COUNT);
  const vy = new Float32Array(PARTICLE_COUNT);
  const hue = new Float32Array(PARTICLE_COUNT);
  const size = new Float32Array(PARTICLE_COUNT);
  const life = new Float32Array(PARTICLE_COUNT);
  const gpuData = new Float32Array(PARTICLE_COUNT * 5);

  const respawn = (i: number, wideHero: boolean) => {
    if (seamless && wideHero && Math.random() < 0.72) {
      // Richer particle presence on the open right half of the hero
      px[i] = 0.36 + Math.random() * 0.62;
    } else {
      px[i] = 0.04 + Math.random() * 0.92;
    }
    py[i] = 0.06 + Math.random() * 0.88;
    vx[i] = 0;
    vy[i] = 0;
    hue[i] = Math.random();
    size[i] = 1.5 + Math.random() * 2.2;
    life[i] = 2.0 + Math.random() * 3.8;
  };

  for (let i = 0; i < PARTICLE_COUNT; i++) respawn(i, true);

  gl.bindVertexArray(particleVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, gpuData.byteLength, gl.DYNAMIC_DRAW);
  const stride = 5 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16);

  const textures: [WebGLTexture, WebGLTexture] = [
    gl.createTexture()!,
    gl.createTexture()!,
  ];
  const fbos: [WebGLFramebuffer, WebGLFramebuffer] = [
    gl.createFramebuffer()!,
    gl.createFramebuffer()!,
  ];

  const setupTargets = (w: number, h: number, theme: number) => {
    const [bgR, bgG, bgB] = bgForTheme(theme);
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[i]);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        textures[i],
        0,
      );
      gl.viewport(0, 0, w, h);
      gl.clearColor(bgR, bgG, bgB, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const readTheme = () =>
    document.documentElement.dataset.theme === "dark" ? 1 : 0;

  const state: InteractionState = {
    pointer: [0.74, 0.52],
    pointerTarget: [0.74, 0.52],
    velocity: [0, 0],
    hover: 0,
    hoverTarget: 0,
    pulseTime: -10,
    pulseOrigin: [0.74, 0.52],
    clickCount: 0,
    theme: readTheme(),
    themeTarget: readTheme(),
    time: 0,
    width: 1,
    height: 1,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };

  let ping = 0;
  let pulseKick = 0;
  let pulseX = 0.74;
  let pulseY = 0.52;
  let lastTheme = state.theme;
  let visible = true;
  let disposed = false;
  let rafId = 0;
  let lastNow = performance.now();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      state.width = width;
      state.height = height;
      state.dpr = dpr;
      setupTargets(width, height, lastTheme);
    }
  };

  const pointerCoords = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(
      1,
      Math.max(0, (rect.bottom - event.clientY) / rect.height),
    );
    return [x, y];
  };

  const onMove = (event: PointerEvent) => {
    const [nx, ny] = pointerCoords(event);
    state.pointerTarget = [nx, ny];
    state.hoverTarget = 1;
  };

  const onLeave = () => {
    state.hoverTarget = 0;
  };

  const onDown = (event: PointerEvent) => {
    const el = event.target as HTMLElement | null;
    if (el?.closest("a, button")) return;
    const [nx, ny] = pointerCoords(event);
    state.pointerTarget = [nx, ny];
    state.hoverTarget = 1;
    state.pulseTime = state.time;
    state.pulseOrigin = [nx, ny];
    pulseKick = 1.0;
    pulseX = nx;
    pulseY = ny;
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !rafId && !disposed) {
        lastNow = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    },
    { threshold: 0.02 },
  );
  intersectionObserver.observe(canvas);

  const themeObserver = new MutationObserver(() => {
    state.themeTarget = readTheme();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  target.addEventListener("pointerenter", onMove);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerleave", onLeave);
  target.addEventListener("pointerdown", onDown);

  const uDpr = gl.getUniformLocation(particleProg, "u_dpr");
  const uPTheme = gl.getUniformLocation(particleProg, "u_theme");
  const uFadePrev = gl.getUniformLocation(fadeProg, "u_prev");
  const uFadeBg = gl.getUniformLocation(fadeProg, "u_bg");
  const uFadeDecay = gl.getUniformLocation(fadeProg, "u_decay");
  const uBlitTex = gl.getUniformLocation(blitProg, "u_tex");
  const uBlitRes = gl.getUniformLocation(blitProg, "u_res");
  const uBlitPtr = gl.getUniformLocation(blitProg, "u_pointer");
  const uBlitHover = gl.getUniformLocation(blitProg, "u_hover");
  const uBlitPulseAge = gl.getUniformLocation(blitProg, "u_pulseAge");
  const uBlitPulseOrigin = gl.getUniformLocation(blitProg, "u_pulseOrigin");
  const uBlitTheme = gl.getUniformLocation(blitProg, "u_theme");
  const uBlitBg = gl.getUniformLocation(blitProg, "u_bg");
  const uBlitSeamless = gl.getUniformLocation(blitProg, "u_seamless");

  const damp = (curr: number, dst: number, rate: number, dt: number) =>
    curr + (dst - curr) * (1 - Math.exp(-rate * dt));

  const tick = (now: number) => {
    if (disposed) return;
    if (!visible || document.hidden) {
      rafId = 0;
      return;
    }

    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    const stepDt = reducedMotion.matches ? dt * 0.14 : dt;
    state.time += stepDt;

    state.pointer[0] = damp(state.pointer[0], state.pointerTarget[0], 10, dt);
    state.pointer[1] = damp(state.pointer[1], state.pointerTarget[1], 10, dt);
    state.hover = damp(state.hover, state.hoverTarget, 6, dt);
    state.theme = damp(state.theme, state.themeTarget, 10, dt);

    const w = state.width;
    const h = state.height;
    const aspect = w / h;
    const wideHero = aspect > 1.35;

    if (Math.abs(state.themeTarget - lastTheme) > 0.5) {
      lastTheme = state.themeTarget;
      setupTargets(w, h, lastTheme);
    }

    pulseKick *= Math.exp(-3.8 * dt);
    const t = state.time;

    // Gentle autonomous focal eddy on the right side when idle; hands off smoothly to cursor on hover
    const idleX = wideHero ? 0.74 + Math.sin(t * 0.32) * 0.06 : 0.5 + Math.sin(t * 0.32) * 0.12;
    const idleY = 0.52 + Math.cos(t * 0.27) * 0.09;
    const focusX = idleX * (1 - state.hover) + state.pointer[0] * state.hover;
    const focusY = idleY * (1 - state.hover) + state.pointer[1] * state.hover;
    const focusStrength = 0.45 + state.hover * 0.55;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      life[i] -= stepDt;
      if (
        life[i] <= 0 ||
        px[i] < 0.0 ||
        px[i] > 1.0 ||
        py[i] < 0.0 ||
        py[i] > 1.0
      ) {
        respawn(i, wideHero);
      }

      const x = px[i];
      const y = py[i];

      const angle = pseudoNoise(x * 1.45, y * 1.45, t) * Math.PI * 1.85;
      let fx = (Math.cos(angle) * 0.15) / Math.max(1, aspect * 0.65);
      let fy = Math.sin(angle) * 0.15;

      const dx = (x - focusX) * aspect;
      const dy = y - focusY;
      const dist = Math.hypot(dx, dy) + 0.0001;
      const focusRadius = 0.42;
      const influence = Math.max(0, 1 - dist / focusRadius) * focusStrength;
      const coherence = influence * influence;

      if (coherence > 0.001) {
        const targetR = 0.21;
        const radialErr = targetR - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const tx = -ny;
        const ty = nx;
        const orbitX = (tx * 0.40 + nx * radialErr * 1.75) / aspect;
        const orbitY = ty * 0.40 + ny * radialErr * 1.75;
        fx = fx * (1 - coherence) + orbitX * coherence;
        fy = fy * (1 - coherence) + orbitY * coherence;
      }

      if (pulseKick > 0.02) {
        const pdx = (x - pulseX) * aspect;
        const pdy = y - pulseY;
        const pdist = Math.hypot(pdx, pdy) + 0.001;
        if (pdist < 0.6) {
          const kick = (1 - pdist / 0.6) * pulseKick * 1.25;
          fx += (pdx / pdist / aspect) * kick;
          fy += (pdy / pdist) * kick;
        }
      }

      vx[i] += (fx - vx[i]) * Math.min(1, stepDt * 6.5);
      vy[i] += (fy - vy[i]) * Math.min(1, stepDt * 6.5);
      px[i] += vx[i] * stepDt;
      py[i] += vy[i] * stepDt;

      const base = i * 5;
      gpuData[base] = px[i];
      gpuData[base + 1] = py[i];
      gpuData[base + 2] = Math.min(1, coherence * 1.2 + pulseKick * 0.35);
      gpuData[base + 3] = hue[i];
      gpuData[base + 4] = size[i] * (1 + coherence * 0.4);
    }

    const next = 1 - ping;
    const [bgR, bgG, bgB] = bgForTheme(state.theme);

    // 1. Fade previous frame cleanly toward exact page background
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[next]);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(fadeProg);
    gl.bindVertexArray(quadVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[ping]);
    gl.uniform1i(uFadePrev, 0);
    gl.uniform3f(uFadeBg, bgR, bgG, bgB);
    gl.uniform1f(uFadeDecay, 0.935);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Draw glowing purple & pink particles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(particleProg);
    gl.bindVertexArray(particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpuData);
    gl.uniform1f(uDpr, state.dpr);
    gl.uniform1f(uPTheme, state.theme);
    gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

    // 3. Blit onto screen with seamless edge feathering
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(blitProg);
    gl.bindVertexArray(quadVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[next]);
    gl.uniform1i(uBlitTex, 0);
    gl.uniform2f(uBlitRes, w, h);
    gl.uniform2f(uBlitPtr, state.pointer[0], state.pointer[1]);
    gl.uniform1f(uBlitHover, state.hover);
    gl.uniform1f(uBlitPulseAge, state.time - state.pulseTime);
    gl.uniform2f(uBlitPulseOrigin, state.pulseOrigin[0], state.pulseOrigin[1]);
    gl.uniform1f(uBlitTheme, state.theme);
    gl.uniform3f(uBlitBg, bgR, bgG, bgB);
    gl.uniform1f(uBlitSeamless, seamless ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    ping = next;
    rafId = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    if (!document.hidden && visible && !rafId && !disposed) {
      lastNow = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  rafId = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    themeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    target.removeEventListener("pointerenter", onMove);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerleave", onLeave);
    target.removeEventListener("pointerdown", onDown);
    gl.deleteBuffer(vbo);
    gl.deleteVertexArray(particleVao);
    gl.deleteVertexArray(quadVao);
    textures.forEach((tex) => gl.deleteTexture(tex));
    fbos.forEach((fbo) => gl.deleteFramebuffer(fbo));
    gl.deleteProgram(particleProg);
    gl.deleteProgram(fadeProg);
    gl.deleteProgram(blitProg);
  };
}
