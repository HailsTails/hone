import { describe, expect, it } from "vitest";

import { runOxlint } from "../../../../node/process/oxlint-port.ts";

describe("Oxlint naming convention adapter", () => {
  it("executes syntax-only naming selectors without TypeScript parser services", async () => {
    const sites = await runOxlint({
      resolveFrom: import.meta.dirname,
      rules: [],
      pluginRules: [
        {
          namespace: "hone-naming",
          id: "hone-naming/naming-convention",
          module: `${import.meta.dirname}/naming-plugin.ts`,
          options: [{ selector: "variable", format: ["camelCase"] }],
        },
      ],
      sources: [{ fileName: "src/cache.ts", source: "const Cached_Value = 1;" }],
    });

    expect(sites).toEqual({
      outcome: "ok",
      value: [{ rule: "hone-naming/naming-convention", index: 0, line: 1, column: 7 }],
    });
  });
});
