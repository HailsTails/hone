import { describe, expect, it } from "vitest";

import { readTypescriptEslintRule } from "./typescript-eslint-rule.ts";

describe("readTypescriptEslintRule", () => {
  it("loads the naming rule from the installed typescript-eslint plugin", async () => {
    const rule = await readTypescriptEslintRule({ name: "naming-convention" });

    expect(rule).toMatchObject({ create: expect.any(Function) });
  });
});
