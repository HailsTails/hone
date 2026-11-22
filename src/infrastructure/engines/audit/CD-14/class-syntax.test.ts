import { assert, describe, expect, it } from "vitest";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { createWalkerRunner } from "../runner/create-walker-runner.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../runner/toolchain/typescript-toolchain.ts";
import { check } from "./class-syntax.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../..`, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const defaultParsePort = loadedParsePort.value;

const CLASS_ON_LINE_THREE = "const a = 1;\n\n  class Alpha {}\n";
const ADDRESS = clauseAddressSchema.parse("CD-14#class-syntax");

const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "class-syntax.ts" },
};

const sourceOnLineThree: FileTextPort = {
  read: () => ({ outcome: "ok", value: CLASS_ON_LINE_THREE }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const loadingThisPiece: ModuleLoaderPort = {
  load: () => Promise.resolve({ outcome: "ok", value: { check } }),
};

const walkerRunner = createWalkerRunner({
  fileText: sourceOnLineThree,
  modules: loadingThisPiece,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
  parse: defaultParsePort,
  entryKind: { kindOf: () => "absent" },
});

describe("CD-14 class-syntax audit check over TypeScript's own parse", () => {
  it.each([
    { name: "a nested node_modules folder", fileName: "src/node_modules/lib/a.ts" },
    { name: "a dist folder", fileName: "dist/a.ts" },
    { name: "a root vendor folder", fileName: "vendor/a.ts" },
  ])("flags nothing in $name, a generated folder the audit skips", async ({ name, fileName }) => {
    expect(
      await walkerRunner.conform({
        clause: CLAUSE,
        cases: [{ name, fileName: repoPathSchema.parse(fileName), source: "export class Generated {}\n", expectedLines: [] }],
      }),
    ).toEqual({ outcome: "ok", value: [{ caseName: name, flaggedLines: [] }] });
  });

  it("anchors a class on line 3 at its class keyword, as the fake-port runner test does", async () => {
    expect(
      await walkerRunner.run({
        repoRoot: absolutePathSchema.parse("/repo"),
        installRoot: absolutePathSchema.parse("/install"),
        files: [repoPathSchema.parse("src/alpha.ts")],
        trackedPaths: [repoPathSchema.parse("src/alpha.ts")],
        clauses: [CLAUSE],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [
          {
            clause: ADDRESS,
            file: "src/alpha.ts",
            anchor: { line: 3, column: 2 },
            snippet: "class Alpha {}",
          },
        ],
        nativeExceptions: [],
        measured: [{ clause: ADDRESS, file: "src/alpha.ts" }],
      },
    });
  });
});
