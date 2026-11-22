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
uniform float u_theme;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float map(vec3 p) {
  float t = u_time;
  float pulseAge = max(0.0, t - u_pulseTime);
  float split = pulseAge < 2.2 ? sin(pulseAge * 4.5) * exp(-pulseAge * 1.7) * 0.42 : 0.0;

  // Gently orbiting sculptural core
  vec3 q = p;
  q.xz *= rot(t * 0.35 + (u_pointer.x - 0.5) * 0.65 * u_hover);
  q.yz *= rot(t * 0.24 - (u_pointer.y - 0.5) * 0.55 * u_hover);

  // Twisted torus ring
  vec3 tq = q;
  tq.xy *= rot(tq.z * 0.55);
  float torus = sdTorus(tq, vec2(0.88 + split * 0.35, 0.25));

  // Orbiting metaballs
  vec3 b1 = vec3(sin(t * 0.9) * (0.72 + split), cos(t * 0.7) * 0.52, cos(t * 0.85) * 0.48);
  vec3 b2 = vec3(cos(t * 0.8 + 2.1) * (0.68 + split), sin(t * 1.05) * 0.58, sin(t * 0.75) * 0.52);
  vec3 b3 = vec3(sin(t * 0.65 + 4.2) * 0.45, cos(t * 0.95 + 1.1) * (0.65 + split), -cos(t * 0.7) * 0.45);

  float d = smin(torus, length(p - b1) - 0.34, 0.42);
  d = smin(d, length(p - b2) - 0.30, 0.40);
  d = smin(d, length(p - b3) - 0.26, 0.38);

  // Interactive cursor metaball that pulls and merges smoothly with the sculpture
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 ptrWorld = (u_pointer - 0.5) * aspect * 2.55;
  vec3 cursorBall = vec3(ptrWorld.x, ptrWorld.y, 0.35);
  float cursorSphere = length(p - cursorBall) - (0.36 * u_hover);
  if (u_hover > 0.02) {
    d = smin(d, cursorSphere, 0.48 * u_hover + 0.05);
  }

  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0025, -0.0025);
  return normalize(
    e.xyy * map(p + e.xyy) +
    e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) +
    e.xxx * map(p + e.xxx)
  );
}

// 4x4 Bayer ordered dither matrix
float bayer4(vec2 pos) {
  ivec2 p = ivec2(mod(pos, 4.0));
  int idx = p.x + p.y * 4;
  float m[16] = float[16](
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  );
  return (m[idx] + 0.5) / 16.0;
}

vec3 palette(int idx, float theme) {
  // Bright luminous Communiti purple & pink palette for light mode
  vec3 l0 = vec3(0.968, 0.958, 1.000); // crisp lilac-white backdrop
  vec3 l1 = vec3(0.865, 0.790, 1.000); // soft pastel lavender
  vec3 l2 = vec3(0.590, 0.440, 1.000); // bright Communiti violet
  vec3 l3 = vec3(0.310, 0.224, 0.965); // vivid Communiti purple
  vec3 l4 = vec3(0.840, 0.440, 1.000); // luminous orchid pink

  // Rich obsidian-indigo & glowing purple/pink for dark mode
  vec3 d0 = vec3(0.070, 0.058, 0.138);
  vec3 d1 = vec3(0.180, 0.125, 0.480);
  vec3 d2 = vec3(0.350, 0.250, 0.965);
  vec3 d3 = vec3(0.680, 0.430, 1.000);
  vec3 d4 = vec3(0.975, 0.845, 1.000);

  if (idx == 0) return mix(l0, d0, theme);
  if (idx == 1) return mix(l1, d1, theme);
  if (idx == 2) return mix(l2, d2, theme);
  if (idx == 3) return mix(l3, d3, theme);
  return mix(l4, d4, theme);
}

void main() {
  // Crisp pixel cell size (3px CSS-ish) so the Bayer dither reads cleanly like print
  float cell = max(2.0, round(min(u_res.x, u_res.y) / 155.0));
  vec2 cellCoord = floor(gl_FragCoord.xy / cell);
  vec2 sampleUv = (cellCoord + 0.5) * cell / u_res;

  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 uv = (sampleUv - 0.5) * aspect * 2.15;

  vec3 ro = vec3(0.0, 0.0, 3.3);
  vec3 rd = normalize(vec3(uv, -1.65));

  float dist = 0.0;
  float hit = 0.0;
  vec3 pos = ro;

  for (int i = 0; i < 64; i++) {
    pos = ro + rd * dist;
    float d = map(pos);
    if (d < 0.0025) {
      hit = 1.0;
      break;
    }
    dist += d;
    if (dist > 6.5) break;
  }

  float lum = 0.0;
  if (hit > 0.5) {
    vec3 n = calcNormal(pos);
    vec3 l1 = normalize(vec3(0.65, 0.85, 0.9));
    vec3 l2 = normalize(vec3(-0.8, -0.4, 0.6));
    float diff1 = max(dot(n, l1), 0.0);
    float diff2 = max(dot(n, l2), 0.0) * 0.45;
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
    float spec = pow(max(dot(reflect(-l1, n), -rd), 0.0), 20.0);

    // Light mode maps darker core -> vibrant purple & pink highlights; dark mode maps bright rim
    float shade = clamp(0.18 + diff1 * 0.55 + diff2 + fresnel * 0.42 + spec * 0.45, 0.0, 1.0);
    lum = mix(0.24 + shade * 0.76, 0.22 + shade * 0.78, u_theme);
  } else {
    // Gentle halo glow behind the sculpture
    float radial = exp(-dot(uv, uv) * 0.65);
    lum = radial * 0.24;
  }

  // Ordered Bayer dither quantization across 5 palette stops
  float threshold = bayer4(cellCoord);
  float scaled = lum * 4.0;
  int baseIdx = int(floor(scaled));
  int idx = clamp(baseIdx + (fract(scaled) > threshold ? 1 : 0), 0, 4);

  fragColor = vec4(palette(idx, u_theme), 1.0);
}
`;

export function mountDitherSculpture(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return () => {};

  const program = createProgram(gl, FULLSCREEN_VS, FRAG);
  const vao = gl.createVertexArray();

  const uRes = gl.getUniformLocation(program, "u_res");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uPointer = gl.getUniformLocation(program, "u_pointer");
  const uHover = gl.getUniformLocation(program, "u_hover");
  const uPulseTime = gl.getUniformLocation(program, "u_pulseTime");
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
    gl.uniform1f(uTheme, state.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });

  return () => {
    disposeLoop();
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}
