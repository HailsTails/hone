import { describe, expect, it } from "vitest";

import { mapPageToExamples, type PageExample } from "./page-examples.ts";

type PageRow = {
  readonly name: string;
  readonly text: string;
  readonly expected: readonly PageExample[];
};

describe("mapPageToExamples", () => {
  it.each<PageRow>([
    {
      name: "an example holding its before block and each after block",
      text: "# Assert to narrow\n\n## Examples\n\n### A short-circuit\n```ts\na && b;\n```\nAssert it:\n\n```ts\nassert(a);\n```\n\n```ts\nassert.isDefined(a);\n```\n",
      expected: [
        {
          anchor: "a-short-circuit",
          before: "a && b;\n",
          after: ["assert(a);\n", "assert.isDefined(a);\n"],
        },
      ],
    },
    {
      name: "an example with no code block",
      text: "## Examples\n\n### Merging objects\nWrite the object out.\n",
      expected: [{ anchor: "merging-objects", before: undefined, after: [] }],
    },
    {
      name: "examples in page order up to the next part, with Windows line ends",
      text: "## Examples\r\n\r\n### A ternary\r\n```ts\r\na ? b : c;\r\n```\r\n\r\n### A switch\r\n```ts\r\nswitch (a) {}\r\n```\r\n\r\n## Notes\r\n\r\n### Not an example\r\n",
      expected: [
        { anchor: "a-ternary", before: "a ? b : c;\n", after: [] },
        { anchor: "a-switch", before: "switch (a) {}\n", after: [] },
      ],
    },
    { name: "a page with no examples", text: "# Result union\n", expected: [] },
  ])("reads $name", ({ text, expected }) => {
    const examples = mapPageToExamples({ text });

    expect(examples).toEqual(expected);
  });
});
