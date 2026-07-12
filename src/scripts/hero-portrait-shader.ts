import { ShaderMount } from "@paper-design/shaders";

const heroPortraitFragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform vec2 u_pointer;
uniform float u_hover;
uniform float u_intro;
uniform float u_theme;

in vec2 v_imageUV;
out vec4 fragColor;

vec2 hash22(vec2 value) {
  vec3 p3 = fract(vec3(value.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

int nearestDarkPaletteIndex(vec3 color) {
  vec3 dark0 = vec3(0.0, 12.0, 56.0) / 255.0;
  vec3 dark1 = vec3(39.0, 34.0, 151.0) / 255.0;
  vec3 dark2 = vec3(78.0, 55.0, 246.0) / 255.0;
  vec3 dark3 = vec3(204.0, 102.0, 255.0) / 255.0;

  float closestDistance = dot(color - dark0, color - dark0);
  int closestIndex = 0;

  float distance1 = dot(color - dark1, color - dark1);
  if (distance1 < closestDistance) {
    closestDistance = distance1;
    closestIndex = 1;
  }

  float distance2 = dot(color - dark2, color - dark2);
  if (distance2 < closestDistance) {
    closestDistance = distance2;
    closestIndex = 2;
  }

  float distance3 = dot(color - dark3, color - dark3);
  if (distance3 < closestDistance) {
    closestIndex = 3;
  }

  return closestIndex;
}

vec3 themedPaletteColor(int index) {
  vec3 sharedBack = vec3(0.0, 12.0, 56.0) / 255.0;
  vec3 light1 = vec3(102.0, 57.0, 156.0) / 255.0;
  vec3 light2 = vec3(204.0, 102.0, 255.0) / 255.0;
  vec3 light3 = vec3(78.0, 55.0, 246.0) / 255.0;
  vec3 dark1 = vec3(39.0, 34.0, 151.0) / 255.0;
  vec3 dark2 = vec3(78.0, 55.0, 246.0) / 255.0;
  vec3 dark3 = vec3(204.0, 102.0, 255.0) / 255.0;

  if (index == 1) return mix(light1, dark1, u_theme);
  if (index == 2) return mix(light2, dark2, u_theme);
  if (index == 3) return mix(light3, dark3, u_theme);
  return sharedBack;
}

vec2 cellDisplacement(vec2 id, vec2 center, vec2 pointer, float cellSize) {
  vec2 delta = center - pointer;
  float pointerDistance = length(delta);
  float radius = 130.0 * u_pixelRatio;
  float influence =
    (1.0 - smoothstep(radius * 0.28, radius, pointerDistance)) * u_hover;

  vec2 randomDirection = normalize(hash22(id) * 2.0 - 1.0 + vec2(0.001));
  vec2 outwardDirection = delta / max(pointerDistance, 0.001);
  vec2 direction = normalize(outwardDirection * 0.72 + randomDirection * 0.38);
  float variation = mix(0.52, 1.0, hash22(id + 17.0).x);
  float distance = min(4.0 * u_pixelRatio, cellSize * 0.72);

  return direction * distance * variation * influence;
}

void main() {
  vec2 fragmentPosition = gl_FragCoord.xy;
  vec2 screenUV = fragmentPosition / u_resolution;
  vec2 pointerPosition = u_pointer * u_resolution;
  float cellSize = max(4.0, 5.0 * u_pixelRatio);
  vec2 baseId = floor(fragmentPosition / cellSize);
  vec2 imageUvDx = dFdx(v_imageUV);
  vec2 imageUvDy = dFdy(v_imageUV);

  bool foundCell = false;
  float bestRank = 1e20;
  vec2 sourceUV = v_imageUV;
  vec2 selectedId = baseId;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = baseId + vec2(float(x), float(y));
      vec2 origin = id * cellSize;

      if (
        id.x < 0.0 || id.y < 0.0 ||
        origin.x >= u_resolution.x || origin.y >= u_resolution.y
      ) {
        continue;
      }

      vec2 center = origin + 0.5 * cellSize;
      vec2 displacement = cellDisplacement(
        id,
        center,
        pointerPosition,
        cellSize
      );
      vec2 localPosition = fragmentPosition - (center + displacement);

      if (max(abs(localPosition.x), abs(localPosition.y)) <= 0.5 * cellSize) {
        float rank = dot(localPosition, localPosition) + hash22(id).x * 0.0001;

        if (rank < bestRank) {
          bestRank = rank;
          sourceUV =
            v_imageUV - displacement.x * imageUvDx - displacement.y * imageUvDy;
          selectedId = id;
          foundCell = true;
        }
      }
    }
  }

  vec3 backdrop = themedPaletteColor(0);
  if (!foundCell) {
    fragColor = vec4(backdrop, 1.0);
    return;
  }

  vec3 sourceColor = texture(u_image, clamp(sourceUV, vec2(0.0), vec2(1.0))).rgb;
  vec3 imageColor = themedPaletteColor(nearestDarkPaletteIndex(sourceColor));
  float revealNoise = hash22(selectedId + vec2(41.0, 73.0)).x;
  float threshold = 0.05 + 0.9 * (revealNoise * 0.78 + screenUV.y * 0.22);
  float visibility = smoothstep(threshold - 0.035, threshold + 0.035, u_intro);

  fragColor = vec4(mix(backdrop, imageColor, visibility), 1.0);
}
`;

const INTRO_DURATION_MS = 880;
const MAX_PIXEL_COUNT = 1_500_000;

const currentThemeValue = () =>
  document.documentElement.dataset.theme === "dark" ? 1 : 0;

const damp = (
  current: number,
  target: number,
  response: number,
  delta: number,
) => current + (target - current) * (1 - Math.exp(-response * delta));

const nearlyEqual = (left: number, right: number) =>
  Math.abs(left - right) < 0.001;

const waitForImage = async (image: HTMLImageElement) => {
  if (image.complete && image.naturalWidth > 0) return;
  await image.decode();
};

export const enhanceHeroPortrait = async (portrait: HTMLElement) => {
  const sourceImage = portrait.querySelector<HTMLImageElement>(
    ".hero-portrait__image--dark",
  );

  if (!sourceImage) return;

  try {
    await waitForImage(sourceImage);
  } catch {
    portrait.dataset.heroShaderState = "fallback";
    return;
  }

  let mount: ShaderMount;
  const existingCanvases = new Set(portrait.querySelectorAll("canvas"));

  try {
    mount = new ShaderMount(
      portrait,
      heroPortraitFragmentShader,
      {
        u_image: sourceImage,
        u_fit: 2,
        u_scale: 1,
        u_rotation: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
        u_pointer: [0.5, 0.5],
        u_hover: 0,
        u_intro: 0,
        u_theme: currentThemeValue(),
      },
      {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
        preserveDrawingBuffer: false,
      },
      0,
      0,
      1,
      MAX_PIXEL_COUNT,
    );
  } catch {
    portrait.querySelectorAll("canvas").forEach((canvas) => {
      if (!existingCanvases.has(canvas)) canvas.remove();
    });
    portrait.dataset.heroShaderState = "fallback";
    return;
  }

  const canvas = mount.canvasElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let disposed = false;
  let animationFrame = 0;
  let introStart = 0;
  let previousFrame = performance.now();
  let introProgress = 0;
  let hoverCurrent = 0;
  let hoverTarget = 0;
  let themeCurrent = currentThemeValue();
  let themeTarget = themeCurrent;
  let pointerCurrent = [0.5, 0.5] as [number, number];
  let pointerTarget = [0.5, 0.5] as [number, number];

  canvas.classList.add("hero-portrait__shader");
  canvas.setAttribute("aria-hidden", "true");

  const renderFrame = (now: number) => {
    if (disposed) return;

    const delta = Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;
    const linearIntro = Math.min(1, (now - introStart) / INTRO_DURATION_MS);
    introProgress = 1 - Math.pow(1 - linearIntro, 3);
    hoverCurrent = damp(hoverCurrent, hoverTarget, 12, delta);
    themeCurrent = damp(themeCurrent, themeTarget, 9, delta);
    pointerCurrent = [
      damp(pointerCurrent[0], pointerTarget[0], 18, delta),
      damp(pointerCurrent[1], pointerTarget[1], 18, delta),
    ];

    mount.setUniforms({
      u_pointer: pointerCurrent,
      u_hover: hoverCurrent,
      u_intro: introProgress,
      u_theme: themeCurrent,
      u_scale: 1 + hoverCurrent * 0.012,
    });

    const pointerSettled =
      nearlyEqual(pointerCurrent[0], pointerTarget[0]) &&
      nearlyEqual(pointerCurrent[1], pointerTarget[1]);
    const shouldContinue =
      linearIntro < 1 ||
      !nearlyEqual(hoverCurrent, hoverTarget) ||
      !nearlyEqual(themeCurrent, themeTarget) ||
      !pointerSettled;

    animationFrame = shouldContinue ? requestAnimationFrame(renderFrame) : 0;
  };

  const startRendering = () => {
    if (disposed || document.hidden || animationFrame !== 0) return;
    previousFrame = performance.now();
    animationFrame = requestAnimationFrame(renderFrame);
  };

  const updatePointer = (event: PointerEvent) => {
    const bounds = portrait.getBoundingClientRect();
    pointerTarget = [
      Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      Math.min(1, Math.max(0, (bounds.bottom - event.clientY) / bounds.height)),
    ];
    hoverTarget = 1;
    startRendering();
  };

  const leavePointer = () => {
    hoverTarget = 0;
    startRendering();
  };

  const updateTheme = () => {
    themeTarget = currentThemeValue();
    startRendering();
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      return;
    }

    startRendering();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    themeObserver.disconnect();
    portrait.removeEventListener("pointerenter", updatePointer);
    portrait.removeEventListener("pointermove", updatePointer);
    portrait.removeEventListener("pointerleave", leavePointer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.removeEventListener("change", handleReducedMotionChange);
    canvas.removeEventListener("webglcontextlost", handleContextLoss);

    try {
      mount.dispose();
    } catch {
      // The static images are already in place if WebGL teardown itself fails.
    }

    portrait.dataset.heroShaderState = "fallback";
  };

  const handleReducedMotionChange = (event: MediaQueryListEvent) => {
    if (event.matches) dispose();
  };

  const handleContextLoss = () => {
    portrait.dataset.heroShaderState = "fallback";
    dispose();
  };

  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  if (finePointer.matches) {
    portrait.addEventListener("pointerenter", updatePointer);
    portrait.addEventListener("pointermove", updatePointer);
    portrait.addEventListener("pointerleave", leavePointer);
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  reducedMotion.addEventListener("change", handleReducedMotionChange);
  canvas.addEventListener("webglcontextlost", handleContextLoss);

  // Give ResizeObserver one frame to size Paper's canvas before revealing it.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  if (disposed) return;

  portrait.dataset.heroShaderState = "ready";
  introStart = performance.now();
  previousFrame = introStart;
  startRendering();

  return dispose;
};
