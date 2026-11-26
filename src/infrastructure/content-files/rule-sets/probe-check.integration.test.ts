import { assert, describe, expect, it, vi } from "vitest";

import type { NamedEngineRunRequest } from "../../../application/ports/engine/engine-run.ts";
import type { EntryKindPort } from "../../../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../application/ports/host/module-loader-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { selectionFrom } from "../../disciplines-file/consumer-selection.ts";
import { selectionFileOf } from "../../disciplines-file/selection-file.ts";
import { createWalkerRunner } from "../../engines/walker/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../engines/walker/runner/toolchain/typescript-toolchain.ts";
import * as exportTestSibling from "../../engines/walker/unit-without-a-running-test/companion-test-file/export-test-sibling.ts";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import * as noTmpFiles from "./probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts";
import { createRuleSetFiles } from "./rule-set-files.ts";

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const DEFAULT_PARSE_PORT = loadedParsePort.value;

const TEMPORARY_SOURCE = "const scratch = 1;\n";
const UNSIBLINGED_SOURCE = "export const kept = 1;\n";
const PLAIN_SOURCE = "export const plain = 3;\n";
const PLAIN_TEST_SOURCE = 'import { plain } from "./plain.ts";\n';

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({
  path: path.join({ segments: [import.meta.dirname, "..", "..", "..", ".."] }),
});

const RULE_SETS_ROOT = resolvedPath({ path: import.meta.dirname });

const REPO_ROOT = resolvedPath({ path: "/repo" });

const sourceAt = (request: { readonly file: string }): string =>
  path.join({ segments: [REPO_ROOT, request.file] });

const SOURCES: Readonly<Record<string, string>> = {
  [sourceAt({ file: "src/scratch.tmp.ts" })]: TEMPORARY_SOURCE,
  [sourceAt({ file: "src/kept.ts" })]: UNSIBLINGED_SOURCE,
  [sourceAt({ file: "src/plain.ts" })]: PLAIN_SOURCE,
  [sourceAt({ file: "src/plain.test.ts" })]: PLAIN_TEST_SOURCE,
};

const fileText: FileTextPort = {
  read: ({ path: file }) => ({ outcome: "ok", value: SOURCES[file] }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
};

const SELECTION_FILE_PATH = path.join({ segments: [RULE_SETS_ROOT, "disciplines.json"] });

const SELECTION_FILE = selectionFileOf({
  path: SELECTION_FILE_PATH,
  document: {
    version: 1,
    ruleSets: { probe: "probe-rule-set" },
    clauses: { "probe/PD-1#no-tmp-files": "walker", "CD-23#export-test-sibling": "walker" },
  },
});
assert(
  SELECTION_FILE.outcome === "ok",
  "the selection names the probe rule set's PD-1 beside CD-23",
);

const selection = selectionFrom({
  ruleSetFiles: createRuleSetFiles({ fileText: createDefaultFileTextPort({}), path }),
  path,
  repoRoot: RULE_SETS_ROOT,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  file: SELECTION_FILE.value,
  filePath: SELECTION_FILE_PATH,
});
assert(
  selection.outcome === "ok",
  "the probe rule set and CD-23 resolve from the team's rule set files and the install",
);

const [PROBE_BINDING, EXPORT_TEST_SIBLING_BINDING] = selection.value.bindings;
assert.isDefined(PROBE_BINDING, "the selection binds the probe clause");
assert.isDefined(EXPORT_TEST_SIBLING_BINDING, "the selection binds the CD-23 clause");

const PIECE_MODULES: Readonly<Record<string, unknown>> = {
  [path.join({
    segments: [
      INSTALL_ROOT,
      "src",
      "infrastructure",
      "engines",
      "walker",
      "unit-without-a-running-test",
      "companion-test-file",
      "export-test-sibling.ts",
    ],
  })]: exportTestSibling,
  [path.join({
    segments: [RULE_SETS_ROOT, "probe-rule-set", "mechanisms", "audit", "PD-1", "no-tmp-files.ts"],
  })]: noTmpFiles,
};

const pieceModules: ModuleLoaderPort = {
  load: ({ path: modulePath }) =>
    Promise.resolve({ outcome: "ok", value: PIECE_MODULES[modulePath] }),
};

const PROBE_ADDRESS = "temporary-file#no-tmp-files";
const EXPORT_TEST_SIBLING_ADDRESS = "unit-without-a-running-test#companion-test-file";

const TRACKED = [
  repoPathOf("src/scratch.tmp.ts"),
  repoPathOf("src/kept.ts"),
  repoPathOf("src/plain.ts"),
  repoPathOf("src/plain.test.ts"),
  repoPathOf("README.md"),
];

const RUN: NamedEngineRunRequest = {
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  files: TRACKED,
  trackedPaths: TRACKED,
  bindings: [
    {
      address: PROBE_ADDRESS,
      ruleSet: "hone",
      engine: "walker",
      checkSettings: PROBE_BINDING.clause.clauseSettings,
      pieceRoot: PROBE_BINDING.clause.pieceRoot,
      anchor: PROBE_BINDING.clause.anchor,
      edition: PROBE_BINDING.clause.edition,
      settings: PROBE_BINDING.clause.settings,
    },
    {
      address: EXPORT_TEST_SIBLING_ADDRESS,
      ruleSet: "hone",
      engine: "walker",
      checkSettings: EXPORT_TEST_SIBLING_BINDING.clause.clauseSettings,
      pieceRoot: EXPORT_TEST_SIBLING_BINDING.clause.pieceRoot,
      anchor: EXPORT_TEST_SIBLING_BINDING.clause.anchor,
      edition: EXPORT_TEST_SIBLING_BINDING.clause.edition,
      settings: EXPORT_TEST_SIBLING_BINDING.clause.settings,
    },
  ],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const probeRun = () => {
  const parse = { ...DEFAULT_PARSE_PORT };
  const parseCalls = vi.spyOn(parse, "parse");
  const ran = createWalkerRunner({
    fileText,
    modules: pieceModules,
    path,
    parse,
    entryKind: ABSENT_ENTRY_KIND,
  }).run(RUN);
  return { ran, parseCalls };
};

describe("a run selecting the probe rule set's PD-1 beside CD-23 through the audit", () => {
  it("flags the temporary file through the probe and the unit without a test sibling through CD-23 in one run", async () => {
    const ran = await probeRun().ran;
    assert(ran.outcome === "ok", "the run measures the tracked files");
    expect(ran.value.hits).toEqual([
      {
        check: PROBE_ADDRESS,
        file: "src/scratch.tmp.ts",
        anchor: { line: 1, column: 0 },
        snippet: "src/scratch.tmp.ts",
      },
      {
        check: EXPORT_TEST_SIBLING_ADDRESS,
        file: "src/kept.ts",
        anchor: { line: 1, column: 0 },
        snippet: "missing co-located *.test.ts(x) sibling",
      },
    ]);
  });

  it("parses each tracked TypeScript file exactly once", async () => {
    const { ran, parseCalls } = probeRun();
    await ran;
    expect(parseCalls.mock.calls).toEqual([
      [{ fileName: "src/scratch.tmp.ts", source: TEMPORARY_SOURCE }],
      [{ fileName: "src/kept.ts", source: UNSIBLINGED_SOURCE }],
      [{ fileName: "src/plain.ts", source: PLAIN_SOURCE }],
    ]);
  });
});
