const diagramSelector = "[data-mermaid-diagram]";

// Mermaid measures label text itself, so it needs the resolved family list
// rather than a CSS variable.
const siteSansFontFamily = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue("--font-sans")
    .trim() || "system-ui, -apple-system, Segoe UI, sans-serif";
const devImportRetryKey = "danferg-mermaid-import-retried";

const themes = {
  light: {
    background: "#ffffff",
    primaryColor: "#f1eeff",
    primaryTextColor: "#1a1726",
    primaryBorderColor: "#4f39f6",
    lineColor: "#6c6580",
    secondaryColor: "#faf9fc",
    secondaryTextColor: "#1a1726",
    secondaryBorderColor: "#ddd6ff",
    tertiaryColor: "#faf9fc",
    tertiaryTextColor: "#524c63",
    tertiaryBorderColor: "#d8d2e6",
    noteBkgColor: "#faeeff",
    noteTextColor: "#1a1726",
    noteBorderColor: "#cc66ff",
    actorBkg: "#f1eeff",
    actorBorder: "#4f39f6",
    actorTextColor: "#1a1726",
    actorLineColor: "#a39db3",
    signalColor: "#1a1726",
    signalTextColor: "#1a1726",
  },
  dark: {
    background: "#171522",
    primaryColor: "#241f3d",
    primaryTextColor: "#f6f4ff",
    primaryBorderColor: "#a997ff",
    lineColor: "#9890b2",
    secondaryColor: "#1f1c2e",
    secondaryTextColor: "#f6f4ff",
    secondaryBorderColor: "#4f4382",
    tertiaryColor: "#171522",
    tertiaryTextColor: "#c4bdd9",
    tertiaryBorderColor: "#4f4382",
    noteBkgColor: "#291c3d",
    noteTextColor: "#f6f4ff",
    noteBorderColor: "#e49aff",
    actorBkg: "#241f3d",
    actorBorder: "#a997ff",
    actorTextColor: "#f6f4ff",
    actorLineColor: "#6c6580",
    signalColor: "#f6f4ff",
    signalTextColor: "#f6f4ff",
  },
} as const;

const createOutput = (svg: string, theme: keyof typeof themes) => {
  const output = document.createElement("div");
  output.className = `mermaid-diagram__output mermaid-diagram__output--${theme}`;
  output.dataset.mermaidTheme = theme;
  output.innerHTML = svg;

  const renderedSvg = output.querySelector("svg");
  const viewBox = renderedSvg
    ?.getAttribute("viewBox")
    ?.split(/\s+/)
    .map(Number);
  const naturalWidth = viewBox?.[2];

  if (naturalWidth && Number.isFinite(naturalWidth)) {
    output.style.setProperty(
      "--mermaid-natural-width",
      `${Math.ceil(naturalWidth)}px`,
    );
  }

  return output;
};

const isDevChunkImportError = (error: unknown) => {
  if (!import.meta.env.DEV) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Outdated Optimize Dep|Failed to fetch/i.test(
    message,
  );
};

export async function initializeMermaidDiagrams() {
  const figures = Array.from(
    document.querySelectorAll<HTMLElement>(diagramSelector),
  ).filter((figure) => !("mermaidReady" in figure.dataset));

  if (!figures.length) return;

  let mermaid: (typeof import("mermaid"))["default"];

  try {
    ({ default: mermaid } = await import("mermaid"));
  } catch (error) {
    if (
      import.meta.env.DEV &&
      !window.sessionStorage.getItem(devImportRetryKey)
    ) {
      window.sessionStorage.setItem(devImportRetryKey, "true");
      window.location.reload();
      return;
    }

    figures.forEach((figure) => {
      figure.dataset.mermaidError = "";
    });
    console.error("Could not load Mermaid", error);
    return;
  }

  const sources = figures.map((figure) => ({
    figure,
    canvas: figure.querySelector<HTMLElement>("[data-mermaid-canvas]"),
    source:
      figure.querySelector<HTMLElement>("[data-mermaid-source]")?.textContent ||
      "",
  }));
  const rendered = new Map<
    HTMLElement,
    Partial<Record<keyof typeof themes, string>>
  >();

  // Mermaid lays diagrams out in a scratch element, measuring sizes and
  // positions as soon as it sets them. Its own scratch element lets
  // global.css exempt it from the reduced-motion transition rule, which would
  // otherwise delay those changes and give Mermaid stale measurements.
  const renderArea = document.createElement("div");
  renderArea.className = "mermaid-render-area";
  renderArea.setAttribute("aria-hidden", "true");
  document.body.append(renderArea);

  let needsDevReload = false;

  for (const [theme, themeVariables] of Object.entries(themes) as [
    keyof typeof themes,
    (typeof themes)[keyof typeof themes],
  ][]) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      layout: "dagre",
      look: "classic",
      theme: "base",
      fontFamily: siteSansFontFamily(),
      themeVariables,
      flowchart: { htmlLabels: true, useMaxWidth: true, wrappingWidth: 220 },
    });

    for (const [index, entry] of sources.entries()) {
      try {
        const { svg } = await mermaid.render(
          `article-mermaid-${theme}-${index}`,
          entry.source,
          renderArea,
        );
        const variants = rendered.get(entry.figure) || {};
        variants[theme] = svg;
        rendered.set(entry.figure, variants);
      } catch (error) {
        if (
          isDevChunkImportError(error) &&
          !window.sessionStorage.getItem(devImportRetryKey)
        ) {
          needsDevReload = true;
          break;
        }
        entry.figure.dataset.mermaidError = "";
        console.error("Could not render Mermaid diagram", error);
      }
    }

    if (needsDevReload) break;
  }

  renderArea.remove();

  if (needsDevReload) {
    window.sessionStorage.setItem(devImportRetryKey, "true");
    window.location.reload();
    return;
  }

  if (import.meta.env.DEV) {
    window.sessionStorage.removeItem(devImportRetryKey);
  }

  for (const { figure, canvas } of sources) {
    const variants = rendered.get(figure);

    if (!canvas || !variants?.light || !variants.dark) continue;

    canvas.replaceChildren(
      createOutput(variants.light, "light"),
      createOutput(variants.dark, "dark"),
    );
    delete figure.dataset.mermaidError;
    figure.dataset.mermaidReady = "";
  }
}
