import { createProgram, FULLSCREEN_VS, mountCanvasLoop } from "./webgl-utils";

const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_hover;
uniform float u_pulseTime;
uniform vec2 u_pulseOrigin;
uniform float u_theme;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + vec2(11.7, 7.3);
    a *= 0.5;
  }
  return v;
}

float terrain(vec2 p, vec2 ptr, vec2 pulsePos, float pulseAge) {
  float t = u_time * 0.12;
  vec2 q = vec2(fbm(p * 0.85 + vec2(t, -t * 0.6)), fbm(p * 0.85 + vec2(-t * 0.4, t * 0.7) + 4.1));
  float h = fbm(p * 1.15 + q * 0.75);

  // Subtle ridge sharpening
  float ridge = 1.0 - abs(fbm(p * 1.65 - vec2(t * 0.5, 0.0)) * 2.0 - 1.0);
  h = mix(h, ridge * ridge, 0.32);

  // Interactive magnetic elevation lens under cursor
  float d = length(p - ptr);
  float lift = exp(-d * d * 2.8) * 0.42 * u_hover;
  float ring = sin(d * 18.0 - u_time * 4.5) * exp(-d * 3.2) * 0.03 * u_hover;
  h += lift + ring;

  // Seismic contour pulse on click
  if (pulseAge >= 0.0 && pulseAge < 4.0) {
    float pd = length(p - pulsePos);
    float waveFront = pulseAge * 1.35;
    float env = exp(-pow((pd - waveFront) * 5.2, 2.0)) * exp(-pulseAge * 0.75);
    h += sin((pd - waveFront) * 20.0) * env * 0.14 + env * 0.16;
  }

  return h;
}

void main() {
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 uv = (v_uv - 0.5) * aspect;

  // Subtle perspective tilt following cursor
  vec2 tilt = (u_pointer - 0.5) * 0.14 * u_hover;
  vec2 p = (uv + tilt) * 2.3;
  vec2 ptr = ((u_pointer - 0.5) * aspect + tilt) * 2.3;
  vec2 pulsePos = ((u_pulseOrigin - 0.5) * aspect + tilt) * 2.3;
  float pulseAge = u_time - u_pulseTime;

  float h = terrain(p, ptr, pulsePos, pulseAge);

  // Compute surface normal for luminous directional shading
  float eps = 0.014;
  float hx = terrain(p + vec2(eps, 0.0), ptr, pulsePos, pulseAge);
  float hy = terrain(p + vec2(0.0, eps), ptr, pulsePos, pulseAge);
  vec3 normal = normalize(vec3((h - hx) * 6.5, (h - hy) * 6.5, 1.0));
  vec3 lightDir = normalize(vec3(-0.45 + tilt.x * 2.0, 0.65 - tilt.y * 2.0, 0.72));
  float diff = clamp(dot(normal, lightDir), 0.0, 1.0);

  // Crisp anti-aliased topographic contour lines
  float bands = 14.0;
  float scaled = h * bands;
  float frac = abs(fract(scaled - 0.5) - 0.5);
  float fw = max(fwidth(scaled), 0.001);
  float minorLine = 1.0 - smoothstep(0.0, fw * 1.35, frac);

  float majorScaled = h * (bands / 3.0);
  float majorFrac = abs(fract(majorScaled - 0.5) - 0.5);
  float majorFw = max(fwidth(majorScaled), 0.001);
  float majorLine = 1.0 - smoothstep(0.0, majorFw * 1.75, majorFrac);

  // Hypsometric Communiti purple & orchid-pink palette
  // Light theme: airy luminous lavender paper -> vibrant violet -> glowing orchid peaks
  vec3 l0 = vec3(0.955, 0.945, 0.995);
  vec3 l1 = vec3(0.845, 0.805, 0.995);
  vec3 l2 = vec3(0.555, 0.455, 0.990);
  vec3 l3 = vec3(0.310, 0.224, 0.965);
  vec3 l4 = vec3(0.835, 0.440, 1.000);

  // Dark theme: deep aubergine -> rich indigo -> bright Communiti purple -> neon orchid
  vec3 d0 = vec3(0.075, 0.062, 0.145);
  vec3 d1 = vec3(0.145, 0.110, 0.340);
  vec3 d2 = vec3(0.280, 0.200, 0.760);
  vec3 d3 = vec3(0.420, 0.310, 0.980);
  vec3 d4 = vec3(0.860, 0.500, 1.000);

  float t = clamp((h - 0.18) * 1.32, 0.0, 1.0);
  vec3 lightCol = mix(l0, l1, smoothstep(0.0, 0.32, t));
  lightCol = mix(lightCol, l2, smoothstep(0.28, 0.60, t));
  lightCol = mix(lightCol, l3, smoothstep(0.55, 0.82, t));
  lightCol = mix(lightCol, l4, smoothstep(0.78, 1.0, t));

  vec3 darkCol = mix(d0, d1, smoothstep(0.0, 0.30, t));
  darkCol = mix(darkCol, d2, smoothstep(0.25, 0.58, t));
  darkCol = mix(darkCol, d3, smoothstep(0.55, 0.82, t));
  darkCol = mix(darkCol, d4, smoothstep(0.78, 1.0, t));

  vec3 col = mix(lightCol, darkCol, u_theme);

  // Apply gentle hillshade
  col *= mix(0.90, 1.10, diff);

  // Contour line ink
  vec3 minorInk = mix(vec3(0.31, 0.22, 0.96), vec3(0.82, 0.68, 1.0), u_theme);
  vec3 majorInk = mix(vec3(0.11, 0.06, 0.44), vec3(0.98, 0.86, 1.0), u_theme);
  col = mix(col, minorInk, minorLine * mix(0.28, 0.36, u_theme));
  col = mix(col, majorInk, majorLine * mix(0.58, 0.78, u_theme));

  // Subtle architectural map grid + pointer reticle
  vec2 gridUv = fract(v_uv * vec2(10.0, 8.0));
  float gx = 1.0 - smoothstep(0.0, 0.018, min(gridUv.x, 1.0 - gridUv.x));
  float gy = 1.0 - smoothstep(0.0, 0.018, min(gridUv.y, 1.0 - gridUv.y));
  float crossTick = gx * gy;
  col = mix(col, majorInk, crossTick * 0.22);

  // Soft glowing reticle around cursor
  float cursorDist = length(p - ptr);
  float cursorRing = smoothstep(0.015, 0.0, abs(cursorDist - 0.24)) * u_hover;
  float cursorDot = smoothstep(0.032, 0.015, cursorDist) * u_hover;
  vec3 reticleCol = vec3(1.0, 0.86, 1.0);
  col = mix(col, reticleCol, cursorRing * 0.55 + cursorDot * 0.8);

  // Expanding click shockwave shimmer
  if (pulseAge >= 0.0 && pulseAge < 3.0) {
    float pd = length(p - pulsePos);
    float ring = smoothstep(0.045, 0.0, abs(pd - pulseAge * 1.35)) * exp(-pulseAge * 1.1);
    col = mix(col, vec3(1.0, 0.85, 1.0), ring * 0.75);
  }

  fragColor = vec4(col, 1.0);
}
`;

export function mountTopoContour(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
  if (!gl) return () => {};

  const program = createProgram(gl, FULLSCREEN_VS, FRAG);
  const vao = gl.createVertexArray();

  const uRes = gl.getUniformLocation(program, "u_res");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uPointer = gl.getUniformLocation(program, "u_pointer");
  const uHover = gl.getUniformLocation(program, "u_hover");
  const uPulseTime = gl.getUniformLocation(program, "u_pulseTime");
  const uPulseOrigin = gl.getUniformLocation(program, "u_pulseOrigin");
  const uTheme = gl.getUniformLocation(program, "u_theme");

  const disposeLoop = mountCanvasLoop(canvas, undefined, (state) => {
    gl.viewport(0, 0, state.width, state.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uRes, state.width, state.height);
    gl.uniform1f(uTime, state.time);
    gl.uniform2f(uPointer, state.pointer[0], state.pointer[1]);
    gl.uniform1f(uHover, state.hover);
    gl.uniform1f(uPulseTime, state.pulseTime);
    gl.uniform2f(uPulseOrigin, state.pulseOrigin[0], state.pulseOrigin[1]);
    gl.uniform1f(uTheme, state.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });

  return () => {
    disposeLoop();
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}
