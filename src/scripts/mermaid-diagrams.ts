const diagramSelector = "[data-mermaid-diagram]";

const themes = {
  light: {
    background: "#f8f7fc",
    primaryColor: "#ede9ff",
    primaryTextColor: "#181d27",
    primaryBorderColor: "#4f39f6",
    lineColor: "#717680",
    secondaryColor: "#fdfcff",
    secondaryTextColor: "#181d27",
    secondaryBorderColor: "#dbd5ff",
    tertiaryColor: "#f8f7fc",
    tertiaryTextColor: "#414651",
    tertiaryBorderColor: "#aaa7bb",
    noteBkgColor: "#fdfcff",
    noteTextColor: "#181d27",
    noteBorderColor: "#4f39f6",
  },
  dark: {
    background: "#11101a",
    primaryColor: "#25203d",
    primaryTextColor: "#f5f2ff",
    primaryBorderColor: "#a997ff",
    lineColor: "#aaa4b9",
    secondaryColor: "#191725",
    secondaryTextColor: "#f5f2ff",
    secondaryBorderColor: "#554a7e",
    tertiaryColor: "#11101a",
    tertiaryTextColor: "#d1ccdf",
    tertiaryBorderColor: "#aaa4bd",
    noteBkgColor: "#191725",
    noteTextColor: "#f5f2ff",
    noteBorderColor: "#a997ff",
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

export async function initializeMermaidDiagrams() {
  const figures = Array.from(
    document.querySelectorAll<HTMLElement>(diagramSelector),
  );

  if (!figures.length) return;

  let mermaid: (typeof import("mermaid"))["default"];

  try {
    ({ default: mermaid } = await import("mermaid"));
  } catch (error) {
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

  for (const [theme, themeVariables] of Object.entries(themes) as [
    keyof typeof themes,
    (typeof themes)[keyof typeof themes],
  ][]) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily:
        '"Geist Mono Variable", "SFMono-Regular", Consolas, monospace',
      themeVariables,
      flowchart: { htmlLabels: true, useMaxWidth: true },
    });

    for (const [index, entry] of sources.entries()) {
      try {
        const { svg } = await mermaid.render(
          `article-mermaid-${theme}-${index}`,
          entry.source,
        );
        const variants = rendered.get(entry.figure) || {};
        variants[theme] = svg;
        rendered.set(entry.figure, variants);
      } catch (error) {
        entry.figure.dataset.mermaidError = "";
        console.error("Could not render Mermaid diagram", error);
      }
    }
  }

  for (const { figure, canvas } of sources) {
    const variants = rendered.get(figure);

    if (!canvas || !variants?.light || !variants.dark) continue;

    canvas.replaceChildren(
      createOutput(variants.light, "light"),
      createOutput(variants.dark, "dark"),
    );
    figure.dataset.mermaidReady = "";
  }
}
