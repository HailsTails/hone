import { assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { createWalkerRunner } from "../../runner/create-walker-runner.ts";
import type { TypeScriptParsePort } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./class-syntax.ts";

const parsing = loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
const CLASS_ON_LINE_THREE = "const a = 1;\n\n  class Alpha {}\n";
const ADDRESS: CheckAddressText = "authored-class-or-this#class-keyword";

const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  checkSettings: {},
  edition: editionOf("1"),
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

const createFixtureRunner = (parse: TypeScriptParsePort) =>
  createWalkerRunner({
    fileText: sourceOnLineThree,
    modules: loadingThisPiece,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    parse,
    entryKind: { kindOf: () => "absent" },
  });

describe("CD-14 class-syntax audit check over TypeScript's own parse", () => {
  it.each([
    { name: "a nested node_modules folder", fileName: "src/node_modules/lib/a.ts" },
    { name: "a dist folder", fileName: "dist/a.ts" },
    { name: "a root vendor folder", fileName: "vendor/a.ts" },
  ])("flags nothing in $name, a generated folder the audit skips", async ({ name, fileName }) => {
    const loaded = await parsing;
    assert(loaded.outcome === "ok", "TypeScript loads from the development install");

    const conformed = await createFixtureRunner(loaded.value).conform({
      binding: CLAUSE,
      cases: [
        {
          name,
          fileName: repoPathSchema.parse(fileName),
          source: "export class Generated {}\n",
          expectedLines: [],
        },
      ],
    });

    expect(conformed).toEqual({ outcome: "ok", value: [{ caseName: name, flaggedLines: [] }] });
  });

  it("anchors a class on line 3 at its class keyword, as the fake-port runner test does", async () => {
    const loaded = await parsing;
    assert(loaded.outcome === "ok", "TypeScript loads from the development install");
    assert(
      /^6\./.test(loaded.value.syntaxApi.version),
      `the typescript line runs TypeScript ${loaded.value.syntaxApi.version}`,
    );

    const measured = await createFixtureRunner(loaded.value).run({
      repoRoot: absoluteRootOf("/repo"),
      installRoot: absoluteRootOf("/install"),
      files: [repoPathOf("src/alpha.ts")],
      trackedPaths: [repoPathOf("src/alpha.ts")],
      bindings: [CLAUSE],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });

    expect(measured).toEqual({
      outcome: "ok",
      value: {
        projection: "none",
        slices: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        hits: [
          {
            check: ADDRESS,
            file: "src/alpha.ts",
            anchor: { line: 3, column: 2 },
            snippet: "class Alpha {}",
          },
        ],
        nativeExceptions: [],
        measured: [{ check: ADDRESS, file: "src/alpha.ts" }],
        inapplicable: [],
      },
    });
  });
});
