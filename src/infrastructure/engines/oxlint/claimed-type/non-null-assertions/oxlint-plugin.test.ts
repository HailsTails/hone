import { assert, expect, it } from "vitest";

import { runOxlint } from "../../runner/toolchain/oxlint-port.ts";
import { readOxlintToolchain } from "../../runner/toolchain/oxlint-toolchain.ts";

it("passes the authored selector and message through Oxlint's JavaScript rule", async () => {
  const toolchain = readOxlintToolchain({ folder: import.meta.dirname, peerFolders: [] });
  assert(toolchain.outcome === "ok");
  const id = "hone-null/no-restricted-syntax";

  const sites = await runOxlint({
    cli: toolchain.value,
    resolveFrom: import.meta.dirname,
    rules: [
      {
        kind: "plugin",
        namespace: "hone-null",
        id,
        module: `${import.meta.dirname}/oxlint-plugin.ts`,
        options: [{ selector: "[definite=true]", message: "Initialise the field." }],
      },
    ],
    sources: [{ fileName: "account.ts", source: "class Account {\n  balance!: number;\n}" }],
  });

  expect(sites).toEqual({
    outcome: "ok",
    value: [{ rule: id, index: 0, line: 2, column: 3 }],
  });
});
