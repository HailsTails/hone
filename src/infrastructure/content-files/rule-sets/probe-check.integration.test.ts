import { assert, describe, expect, it, vi } from "vitest";
import type { RunRequest } from "../../../application/ports/engine/runner-module.ts";
import type { EntryKindPort } from "../../../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../application/ports/host/module-loader-port.ts";
import type { RunnerClause } from "../../../domain/runner/runner-module-types.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../engines/audit/runner/toolchain/typescript-toolchain.ts";
import { createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { FIRST_EDITION } from "../edition.ts";
import * as exportTestSibling from "../../engines/audit/CD-23/export-test-sibling.ts";
import { createWalkerRunner } from "../../engines/audit/runner/create-walker-runner.ts";
import * as noTmpFiles from "./probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts";

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../..`, installForm: "source" }) });
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const DEFAULT_PARSE_PORT = loadedParsePort.value;

const TEMPORARY_SOURCE = "const scratch = 1;\n";
const UNSIBLINGED_SOURCE = "export const kept = 1;\n";
const PLAIN_SOURCE = "export const plain = 3;\n";
const PLAIN_TEST_SOURCE = 'import { plain } from "./plain.ts";\n';

const SOURCES: Readonly<Record<string, string>> = {
  "/repo/src/scratch.tmp.ts": TEMPORARY_SOURCE,
  "/repo/src/kept.ts": UNSIBLINGED_SOURCE,
  "/repo/src/plain.ts": PLAIN_SOURCE,
  "/repo/src/plain.test.ts": PLAIN_TEST_SOURCE,
};

const fileText: FileTextPort = {
  read: ({ path }) => ({ outcome: "ok", value: SOURCES[path] }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
};

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const PIECE_MODULES: Readonly<Record<string, unknown>> = {
  "/install/src/infrastructure/engines/audit/CD-23/export-test-sibling.ts": exportTestSibling,
  "/repo/probe/mechanisms/audit/PD-1/no-tmp-files.ts": noTmpFiles,
};

const pieceModules: ModuleLoaderPort = {
  load: ({ path: modulePath }) =>
    Promise.resolve({ outcome: "ok", value: PIECE_MODULES[modulePath] }),
};

const PROBE_ADDRESS = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const EXPORT_TEST_SIBLING_ADDRESS = clauseAddressSchema.parse("CD-23#export-test-sibling");

const PROBE_CLAUSE: RunnerClause = {
  address: PROBE_ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/repo/probe/mechanisms/audit/PD-1",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "no-tmp-files.ts" },
};

const EXPORT_TEST_SIBLING_CLAUSE: RunnerClause = {
  address: EXPORT_TEST_SIBLING_ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/src/infrastructure/engines/audit/CD-23",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "export-test-sibling.ts" },
};

const TRACKED = [
  repoPathSchema.parse("src/scratch.tmp.ts"),
  repoPathSchema.parse("src/kept.ts"),
  repoPathSchema.parse("src/plain.ts"),
  repoPathSchema.parse("src/plain.test.ts"),
  repoPathSchema.parse("README.md"),
];

const RUN: RunRequest = {
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: absolutePathSchema.parse("/install"),
  files: TRACKED,
  trackedPaths: TRACKED,
  clauses: [PROBE_CLAUSE, EXPORT_TEST_SIBLING_CLAUSE],
};

const probeRun = () => {
  const parse = { ...DEFAULT_PARSE_PORT };
  const parseCalls = vi.spyOn(parse, "parse");
  const ran = createWalkerRunner({ fileText, modules: pieceModules, path, parse, entryKind: ABSENT_ENTRY_KIND }).run(RUN);
  return { ran, parseCalls };
};

describe("a run selecting the probe rule set's PD-1 beside CD-23 through the audit", () => {
  it("flags the temporary file through the probe and the unit without a test sibling through CD-23 in one run", async () => {
    const ran = await probeRun().ran;
    assert(ran.outcome === "ok", "the run measures the tracked files");
    expect(ran.value.hits).toEqual([
      {
        clause: PROBE_ADDRESS,
        file: "src/scratch.tmp.ts",
        anchor: { line: 1, column: 0 },
        snippet: "src/scratch.tmp.ts",
      },
      {
        clause: EXPORT_TEST_SIBLING_ADDRESS,
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
