import { assert, describe, expect, it } from "vitest";

import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { throwStatementCheck } from "./throw-statement-check.ts";
import { textsDisk } from "./walker-disk.ts";

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const { syntaxApi } = loadedParse.value;

const BINDING: CheckBinding = {
  address: "throw-or-catch-in-a-test#throw-statement",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/repo/pieces/throw-statement",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "throws-in-tests.ts" },
};

describe("throwStatementCheck", () => {
  it.each<{ readonly scope: "test" | "production"; readonly path: string }>([
    { scope: "test", path: "src/orders.ts" },
    { scope: "production", path: "src/orders.test.ts" },
    { scope: "production", path: "src/orders.spec.mts" },
    { scope: "production", path: "src/orders.d.tsx" },
  ])("skips $path when checking $scope scope", ({ scope, path }) => {
    const file = repoPathSchema.parse(path);
    const piece = throwStatementCheck(scope);
    const prepared = piece.prepare({
      bindings: [BINDING],
      repository: {
        files: [file],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    expect(
      prepared.value.prepareFile({
        file,
        readText: () => ({ outcome: "ok", value: "throw new Error('missing');" }),
      }),
    ).toEqual({
      outcome: "ok",
      value: { kind: "skipped" },
    });
  });

  it.each<{ readonly scope: "test" | "production"; readonly path: string }>([
    { scope: "test", path: "src/orders.test.ts" },
    { scope: "production", path: "src/orders.mts" },
    { scope: "production", path: "src/orders.ts" },
  ])(
    "observes a throw at its keyword with a bounded snippet in $scope scope",
    ({ scope, path }) => {
      const file = repoPathSchema.parse(path);
      const source =
        'throw new Error(\r\n  "1234567890123456789012345678901234567890123456789012345678901234567890",\r\n);';
      const piece = throwStatementCheck(scope);
      const prepared = piece.prepare({
        bindings: [BINDING],
        repository: {
          files: [file],
          exists: () => "present",
          disk: textsDisk({ root: "/repo", texts: {} }),
        },
        syntaxApi,
      });
      assert(prepared.outcome === "ok");
      const selected = prepared.value.prepareFile({
        file,
        readText: () => ({ outcome: "ok", value: source }),
      });
      assert(selected.outcome === "ok" && selected.value.kind === "syntax");
      const tree = syntaxApi.createSourceFile(file, source, syntaxApi.ScriptTarget.Latest, true);
      const [node] = tree.statements;
      assert(node !== undefined);
      const observations = selected.value.begin({
        sourceFile: tree,
        anchorAt: () => ({ line: 1, column: 0 }),
      });
      observations.enter?.({ node });
      expect(observations.finish()).toEqual([
        {
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet:
            'throw new Error( "12345678901234567890123456789012345678901234567890123456789012…',
        },
      ]);
    },
  );
});
