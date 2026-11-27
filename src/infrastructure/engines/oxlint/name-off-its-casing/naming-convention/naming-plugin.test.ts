import { assert, describe, expect, it } from "vitest";

import { runOxlint } from "../../runner/toolchain/oxlint-port.ts";
import { readOxlintToolchain } from "../../runner/toolchain/oxlint-toolchain.ts";

describe("Oxlint naming convention adapter", () => {
  it("executes syntax-only naming selectors without TypeScript parser services", async () => {
    const toolchain = readOxlintToolchain({ folder: import.meta.dirname, peerFolders: [] });
    assert(toolchain.outcome === "ok");
    const sites = await runOxlint({
      cli: toolchain.value,
      resolveFrom: import.meta.dirname,
      rules: [
        {
          kind: "plugin",
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
