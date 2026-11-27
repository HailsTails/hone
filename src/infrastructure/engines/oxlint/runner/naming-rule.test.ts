import { describe, expect, it } from "vitest";

import { readNamingRule } from "./naming-rule.ts";

describe("readNamingRule", () => {
  it("loads the published rule from the naming piece layout", async () => {
    const moduleUrl = new URL(
      "../name-off-its-casing/naming-convention/naming-plugin.ts",
      import.meta.url,
    );

    const rule = await readNamingRule({ moduleUrl: moduleUrl.href });

    expect(rule).toMatchObject({ create: expect.any(Function) });
  });
});
