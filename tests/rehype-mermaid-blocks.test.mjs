import assert from "node:assert/strict";
import test from "node:test";

import { rehypeMermaidBlocks } from "../rehype-mermaid-blocks.mjs";

const mermaidTree = (value) => ({
  type: "root",
  children: [
    {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "code",
          properties: { className: ["language-mermaid"] },
          children: [{ type: "text", value }],
        },
      ],
    },
  ],
});

const file = {
  fail(message) {
    throw new Error(message);
  },
};

test("turns an accessible Mermaid fence into an article figure", () => {
  const tree = mermaidTree(`flowchart LR
  accTitle: Plant monitoring flow
  accDescr: A probe reports to a local base station.
  Probe --> Base`);

  rehypeMermaidBlocks()(tree, file);

  const figure = tree.children[0];
  assert.equal(figure.tagName, "figure");
  assert.deepEqual(figure.properties.className, ["mermaid-diagram"]);
  assert.equal(figure.children[0].tagName, "div");
  assert.equal(figure.children[0].children[0].tagName, "pre");
  assert.equal(
    figure.children[1].children.map((child) => child.value || "").join(""),
    "Plant monitoring flow",
  );
});

test("fails a Mermaid fence without accessible metadata", () => {
  const tree = mermaidTree("flowchart LR\n  Probe --> Base");

  assert.throws(
    () => rehypeMermaidBlocks()(tree, file),
    /require both accTitle and accDescr/,
  );
});
