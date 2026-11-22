import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "./typescript-toolchain.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const port = loadedParsePort.value;
const TWO_STATEMENTS = "const a = 1;\nconst b = 2;\n";

describe("the parse port loaded from the development install's typescript", () => {
  it("parses the given source under the given file name", () => {
    expect(port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS })).toMatchObject({
      fileName: "src/a.ts",
      text: TWO_STATEMENTS,
    });
  });

  it("lists a tree's direct children in source order", () => {
    expect(
      port.children({ node: port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS }) }),
    ).toMatchObject([
      { kind: port.syntaxApi.SyntaxKind.VariableStatement, pos: 0 },
      { kind: port.syntaxApi.SyntaxKind.VariableStatement, pos: 12 },
      { kind: port.syntaxApi.SyntaxKind.EndOfFileToken },
    ]);
  });

  it("points a top-level node's parent at its tree", () => {
    const tree = port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS });

    expect(port.children({ node: tree })[0].parent).toBe(tree);
  });
});
