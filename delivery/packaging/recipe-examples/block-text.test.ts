import { describe, expect, it } from "vitest";

import { createBlockName, createBlockText, createTestText } from "./block-text.ts";

describe("createBlockText", () => {
  it("puts the vitest import above the block", () => {
    const text = createBlockText({ source: "expect(1).toBe(1);\n" });

    expect(text).toBe('import { assert, expect, it, vi } from "vitest";\nexpect(1).toBe(1);\n');
  });
});

describe("createTestText", () => {
  it("puts the block inside a test, below the vitest import", () => {
    const text = createTestText({ source: "expect(1).toBe(1);" });

    expect(text).toBe(
      'import { assert, expect, it, vi } from "vitest";\nit("example", () => {\nexpect(1).toBe(1);\n});',
    );
  });
});

describe("createBlockName", () => {
  it("names a block by its recipe, its example and its place there", () => {
    const name = createBlockName({
      block: { recipe: "assert-to-narrow", anchor: "a-short-circuit", position: 2, source: "" },
    });

    expect(name).toBe("assert-to-narrow#a-short-circuit 2");
  });
});
