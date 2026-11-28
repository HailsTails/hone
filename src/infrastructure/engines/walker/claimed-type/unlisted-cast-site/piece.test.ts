import { assert, describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { createWalkerRunner } from "../../runner/create-walker-runner.ts";
import { walkerPieceSettingsSchema } from "../../runner/pieces/walker-check-schema.ts";
import type { TypeScriptParsePort } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./cast-expressions.ts";
import piece from "./piece.json" with { type: "json" };

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
const EXPECTATION = "@ts-expect-" + "error";
const IGNORE = "@ts-" + "ignore";
const NOCHECK = "@ts-" + "nocheck";
const ADDRESS: CheckAddressText = "claimed-type#unlisted-cast-site";
const TEST_FILE = repoPathOf("src/basket.test.ts");
const GENERATED_FILE = repoPathOf("dist/basket.ts");
const SETTINGS = walkerPieceSettingsSchema.parse(piece.settings);

const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-2",
  checkSettings: {},
  edition: editionOf("1"),
  settings: SETTINGS,
};

const SOURCE = `// ${NOCHECK}\nexport const total = (lines: readonly number[]): number => {\n  // ${EXPECTATION} until lines is typed (#42)\n  return lines.sum();\n};\n// ${IGNORE}\nexport const first: string = 1;\n`;

const fileText: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: SOURCE }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
};

const modules: ModuleLoaderPort = {
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { check } }),
};

const castFreeRun = (parse: TypeScriptParsePort) =>
  createWalkerRunner({
    fileText,
    modules,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    parse,
    entryKind: { kindOf: () => "absent" },
  }).run({
    repoRoot: absoluteRootOf("/repo"),
    installRoot: absoluteRootOf("/install"),
    files: [TEST_FILE, GENERATED_FILE],
    trackedPaths: [TEST_FILE, GENERATED_FILE],
    bindings: [CLAUSE],
    answered: [],
    declaredConfigRoots: [],
    declaredConfigLookup: undefined,
    testFiles: { suffixes: ["test", "spec"], folders: [] },
  });

const expectationOn = (request: { readonly line: number; readonly text: string }) => ({
  kind: "inline-disable",
  check: ADDRESS,
  file: TEST_FILE,
  ...request,
  reach: "one-check",
});

describe("CD-2 audit piece.json", () => {
  it("declares every type directive the compiler honours as an escape of cast-expressions", () => {
    expect(SETTINGS).toEqual({
      module: "cast-expressions.ts",
      escapingDirectives: [EXPECTATION, IGNORE, NOCHECK],
    });
  });

  it("reports each directive in a cast-free test file as an inline disable of cast-expressions, tracked reference or not, and none in a generated folder", async () => {
    assert(
      loadedParsePort.outcome === "ok",
      "the typescript line loads from the development install",
    );
    expect(loadedParsePort.value.syntaxApi.version).toMatch(/^6\./);

    const report = await castFreeRun(loadedParsePort.value);

    expect(report).toEqual({
      outcome: "ok",
      value: {
        projection: "none",
        slices: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        hits: [],
        nativeExceptions: [
          expectationOn({ line: 1, text: `// ${NOCHECK}` }),
          expectationOn({ line: 3, text: `// ${EXPECTATION} until lines is typed (#42)` }),
          expectationOn({ line: 6, text: `// ${IGNORE}` }),
        ],
        measured: [{ check: ADDRESS, file: TEST_FILE }],
        inapplicable: [{ check: ADDRESS, file: GENERATED_FILE }],
      },
    });
  });
});
