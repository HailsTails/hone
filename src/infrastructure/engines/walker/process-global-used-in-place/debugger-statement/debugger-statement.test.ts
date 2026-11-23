import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./debugger-statement.ts";

const SOURCE_FILE = repoPathSchema.parse("src/orders.ts");
const BINDING: CheckBinding = {
  address: "process-global-used-in-place#debugger-statement",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/process-global-used-in-place/debugger-statement",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "debugger-statement.ts" },
};

const loaded = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loaded.outcome === "ok");
const parse = loaded.value;

const findingsIn = (request: {
  readonly file: RepoPath;
  readonly source: string;
}): readonly CheckHit[] => {
  const prepared = check.prepare({
    bindings: [BINDING],
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath:
          "/install/walker/process-global-used-in-place/debugger-statement/debugger-statement.ts",
        bindings: [BINDING],
        check: prepared.value,
      },
    ],
    parse,
    escapes: [],
  });
  assert(observed.outcome === "ok");
  return observed.value.hits;
};

describe("the debugger statement check", () => {
  it("anchors each debugger statement at its keyword", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "debugger;\nfunction run() {\n  debugger;\n}",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "debugger",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 2 },
        snippet: "debugger",
      },
    ]);
  });

  it("passes property names and quoted text that do not pause execution", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: 'const settings = { debugger: false };\nconst label = "debugger";',
      }),
    ).toEqual([]);
  });

  it("scans module and test sources and skips generated and declaration files", () => {
    expect(
      findingsIn({ file: repoPathSchema.parse("src/orders.test.mts"), source: "debugger;" }),
    ).toHaveLength(1);
    expect(
      findingsIn({ file: repoPathSchema.parse("dist/orders.ts"), source: "debugger;" }),
    ).toEqual([]);
    expect(
      findingsIn({ file: repoPathSchema.parse("src/orders.d.cts"), source: "debugger;" }),
    ).toEqual([]);
  });
});
