export interface InteractionState {
  pointer: [number, number];
  pointerTarget: [number, number];
  velocity: [number, number];
  hover: number;
  hoverTarget: number;
  pulseTime: number;
  pulseOrigin: [number, number];
  clickCount: number;
  theme: number;
  themeTarget: number;
  time: number;
  width: number;
  height: number;
  dpr: number;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Could not create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "Shader compile error";
      gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create WebGL program");

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "Program link error";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

export const FULLSCREEN_VS = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);
out vec2 v_uv;
void main() {
  vec2 p = POS[gl_VertexID];
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export function mountCanvasLoop(
  canvas: HTMLCanvasElement,
  onClick?: (x: number, y: number, state: InteractionState) => void,
  onFrame?: (state: InteractionState, dt: number) => void,
  onResize?: (width: number, height: number, dpr: number) => void,
): () => void {
  const readTheme = () =>
    document.documentElement.dataset.theme === "dark" ? 1 : 0;

  const state: InteractionState = {
    pointer: [0.5, 0.5],
    pointerTarget: [0.5, 0.5],
    velocity: [0, 0],
    hover: 0,
    hoverTarget: 0,
    pulseTime: -10,
    pulseOrigin: [0.5, 0.5],
    clickCount: 0,
    theme: readTheme(),
    themeTarget: readTheme(),
    time: 0,
    width: 1,
    height: 1,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  let disposed = false;
  let rafId = 0;
  let lastNow = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    state.width = width;
    state.height = height;
    state.dpr = dpr;
    onResize?.(width, height, dpr);
  };

  const damp = (curr: number, target: number, rate: number, dt: number) =>
    curr + (target - curr) * (1 - Math.exp(-rate * dt));

  const pointerCoords = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(
      1,
      Math.max(0, (rect.bottom - event.clientY) / rect.height),
    );
    return [x, y];
  };

  const handleMove = (event: PointerEvent) => {
    const [nx, ny] = pointerCoords(event);
    state.velocity[0] = (nx - state.pointerTarget[0]) * 60;
    state.velocity[1] = (ny - state.pointerTarget[1]) * 60;
    state.pointerTarget = [nx, ny];
    state.hoverTarget = 1;
  };

  const handleLeave = () => {
    state.hoverTarget = 0;
  };

  const handleDown = (event: PointerEvent) => {
    const [nx, ny] = pointerCoords(event);
    state.pointerTarget = [nx, ny];
    state.hoverTarget = 1;
    state.pulseTime = state.time;
    state.pulseOrigin = [nx, ny];
    state.clickCount += 1;
    onClick?.(nx, ny, state);
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
    { threshold: 0.05 },
  );
  intersectionObserver.observe(canvas);

  const themeObserver = new MutationObserver(() => {
    state.themeTarget = readTheme();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  canvas.addEventListener("pointerenter", handleMove);
  canvas.addEventListener("pointermove", handleMove);
  canvas.addEventListener("pointerleave", handleLeave);
  canvas.addEventListener("pointerdown", handleDown);

  const tick = (now: number) => {
    if (disposed) return;
    if (!visible || document.hidden) {
      rafId = 0;
      return;
    }

    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;

    state.time += reducedMotion.matches ? dt * 0.12 : dt;
    state.pointer[0] = damp(state.pointer[0], state.pointerTarget[0], 11, dt);
    state.pointer[1] = damp(state.pointer[1], state.pointerTarget[1], 11, dt);
    state.velocity[0] = damp(state.velocity[0], 0, 8, dt);
    state.velocity[1] = damp(state.velocity[1], 0, 8, dt);
    state.hover = damp(state.hover, state.hoverTarget, 7, dt);
    state.theme = damp(state.theme, state.themeTarget, 8, dt);

    onFrame?.(state, dt);
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
    canvas.removeEventListener("pointerenter", handleMove);
    canvas.removeEventListener("pointermove", handleMove);
    canvas.removeEventListener("pointerleave", handleLeave);
    canvas.removeEventListener("pointerdown", handleDown);
  };
}
