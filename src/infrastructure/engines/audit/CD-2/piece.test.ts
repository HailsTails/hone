import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { createWalkerRunner } from "../runner/create-walker-runner.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../runner/toolchain/typescript-toolchain.ts";
import { walkerPieceSettingsSchema } from "../runner/pieces/walker-check-schema.ts";
import { check } from "./cast-expressions.ts";
import piece from "./piece.json" with { type: "json" };
import { FIRST_EDITION } from "../../../content-files/edition.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../..`, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const defaultParsePort = loadedParsePort.value;

const EXPECTATION = "@ts-expect-" + "error";
const IGNORE = "@ts-" + "ignore";
const NOCHECK = "@ts-" + "nocheck";
const ADDRESS = clauseAddressSchema.parse("CD-2#cast-expressions");
const TEST_FILE = repoPathSchema.parse("src/basket.test.ts");
const GENERATED_FILE = repoPathSchema.parse("dist/basket.ts");
const SETTINGS = walkerPieceSettingsSchema.parse(piece.clauses[0].settings);

const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-2",
  clauseSettings: {},
  edition: FIRST_EDITION,
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

const castFreeRun = () =>
  createWalkerRunner({
    fileText,
    modules,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    parse: defaultParsePort,
    entryKind: { kindOf: () => "absent" },
  }).run({
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse("/install"),
    files: [TEST_FILE, GENERATED_FILE],
    trackedPaths: [TEST_FILE, GENERATED_FILE],
    clauses: [CLAUSE],
  });

const expectationOn = (request: { readonly line: number; readonly text: string }) => ({
  kind: "inline-disable",
  clause: ADDRESS,
  file: TEST_FILE,
  ...request,
  reach: "one-clause",
});

describe("CD-2 audit piece.json", () => {
  it("declares every type directive the compiler honours as an escape of cast-expressions", () => {
    expect(SETTINGS).toEqual({ module: "cast-expressions.ts", escapingDirectives: [EXPECTATION, IGNORE, NOCHECK] });
  });

  it("reports each directive in a cast-free test file as an inline disable of cast-expressions, tracked reference or not, and none in a generated folder", async () => {
    expect(await castFreeRun()).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          expectationOn({ line: 1, text: `// ${NOCHECK}` }),
          expectationOn({ line: 3, text: `// ${EXPECTATION} until lines is typed (#42)` }),
          expectationOn({ line: 6, text: `// ${IGNORE}` }),
        ],
        measured: [{ clause: ADDRESS, file: TEST_FILE }],
      },
    });
  });
});
