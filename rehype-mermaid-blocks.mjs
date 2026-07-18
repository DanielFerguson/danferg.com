const MERMAID_CLASS = "language-mermaid";

const getClassNames = (node) => {
  const className = node?.properties?.className;

  if (Array.isArray(className)) return className.map(String);
  if (typeof className === "string") return className.split(/\s+/);

  return [];
};

const getText = (node) => {
  if (node?.type === "text") return node.value;
  if (!Array.isArray(node?.children)) return "";

  return node.children.map(getText).join("");
};

const cleanLabel = (value) => {
  const label = value.trim();
  const quote = label[0];

  if ((quote === '"' || quote === "'") && label.at(-1) === quote) {
    return label.slice(1, -1);
  }

  return label;
};

const getAccessibilityMetadata = (source) => {
  const title = source.match(/^\s*accTitle\s*:\s*(.+?)\s*$/m)?.[1];
  const inlineDescription = source.match(
    /^\s*accDescr\s*:\s*([^\s{].*?)\s*$/m,
  )?.[1];
  const blockDescription = source.match(
    /^\s*accDescr\s*\{\s*\n?([\s\S]*?)\n?\s*\}/m,
  )?.[1];

  return {
    title: title ? cleanLabel(title) : undefined,
    description: inlineDescription || blockDescription?.trim(),
  };
};

const createDiagram = (source, title) => ({
  type: "element",
  tagName: "figure",
  properties: {
    className: ["mermaid-diagram"],
    dataMermaidDiagram: "",
  },
  children: [
    {
      type: "element",
      tagName: "div",
      properties: {
        className: ["mermaid-diagram__canvas"],
        dataMermaidCanvas: "",
      },
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {
            className: ["mermaid-diagram__source"],
            dataMermaidSource: "",
            ariaLabel: `Mermaid source fallback for ${title}`,
          },
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: [MERMAID_CLASS] },
              children: [{ type: "text", value: source }],
            },
          ],
        },
      ],
    },
    {
      type: "element",
      tagName: "figcaption",
      properties: { className: ["mermaid-diagram__caption"] },
      children: [
        {
          type: "element",
          tagName: "span",
          properties: {},
          children: [{ type: "text", value: "DIAGRAM //" }],
        },
        { type: "text", value: title },
      ],
    },
  ],
});

const transformChildren = (parent, file) => {
  if (!Array.isArray(parent?.children)) return;

  for (let index = 0; index < parent.children.length; index += 1) {
    const node = parent.children[index];
    const code =
      node?.type === "element" && node.tagName === "pre"
        ? node.children?.find(
            (child) =>
              child?.type === "element" &&
              child.tagName === "code" &&
              getClassNames(child).includes(MERMAID_CLASS),
          )
        : undefined;

    if (!code) {
      transformChildren(node, file);
      continue;
    }

    const source = getText(code).trim();
    const { title, description } = getAccessibilityMetadata(source);

    if (!title || !description) {
      file.fail(
        "Mermaid diagrams require both accTitle and accDescr so the generated SVG is accessible.",
        node.position,
      );
    }

    parent.children[index] = createDiagram(source, title);
  }
};

/**
 * Convert portable ```mermaid fences into progressively enhanced figures.
 * Rendering happens in the browser only on article pages that contain a figure.
 */
export function rehypeMermaidBlocks() {
  return (tree, file) => transformChildren(tree, file);
}
