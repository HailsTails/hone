import { assert, describe, expect, it, vi } from "vitest";
import { createSelectionRepository } from "../../disciplines-file/consumer-selection.ts";
import { createExceptionRepository } from "../../discipline-exceptions-folder/exception-layout.ts";
import type { EntryKindPort } from "../../../application/ports/file-system/entry-kind-port.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../engines/audit/runner/toolchain/typescript-toolchain.ts";
import { runCheck } from "../../../application/run/check/run-check.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../hone-config-file/assessment.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import * as exportTestSibling from "../../engines/audit/CD-23/export-test-sibling.ts";
import cd23Piece from "../../engines/audit/CD-23/piece.json" with { type: "json" };
import { createWalkerRunner } from "../../engines/audit/runner/create-walker-runner.ts";
import cd23Discipline from "../../../../rules/CD-23/discipline.json" with { type: "json" };
import * as noTmpFiles from "./probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts";
import probePiece from "./probe-rule-set/mechanisms/audit/PD-1/piece.json" with { type: "json" };
import probeDiscipline from "./probe-rule-set/rules/PD-1/discipline.json" with { type: "json" };
import { createDefaultEnginePort } from "../../engines/protocol/engine-port.ts";

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../..`, installForm: "source" }) });
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const DEFAULT_PARSE_PORT = loadedParsePort.value;

const TEMPORARY_SOURCE = "const scratch = 1;\n";
const UNSIBLINGED_SOURCE = "export const kept = 1;\n";
const PLAIN_SOURCE = "export const plain = 3;\n";
const PLAIN_TEST_SOURCE = 'import { plain } from "./plain.ts";\n';

type FakeFile = {
  readonly read: ReturnType<FileTextPort["read"]>;
  readonly presence: ReturnType<FileTextPort["exists"]>;
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const FILES: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentFile({
    text: JSON.stringify({
      version: 1,
      ruleSets: { probe: "probe" },
      clauses: { "probe/PD-1#no-tmp-files": "audit", "CD-23#export-test-sibling": "audit" },
    }),
  }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/package.json": ABSENT_FILE,
  "/install/rules/CD-23/discipline.json": presentFile({ text: JSON.stringify(cd23Discipline) }),
  "/install/src/infrastructure/engines/audit/CD-23/piece.json": presentFile({ text: JSON.stringify(cd23Piece) }),
  "/install/src/infrastructure/engines/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/probe/rules/PD-1/discipline.json": presentFile({ text: JSON.stringify(probeDiscipline) }),
  "/repo/probe/mechanisms/audit/PD-1/piece.json": presentFile({ text: JSON.stringify(probePiece) }),
  "/repo/src/scratch.tmp.ts": presentFile({ text: TEMPORARY_SOURCE }),
  "/repo/src/kept.ts": presentFile({ text: UNSIBLINGED_SOURCE }),
  "/repo/src/plain.ts": presentFile({ text: PLAIN_SOURCE }),
  "/repo/src/plain.test.ts": presentFile({ text: PLAIN_TEST_SOURCE }),
  "/repo/README.md": presentFile({ text: "# probe\n" }),
  "/repo/disciplines.assessment.md": presentFile({ text: "# Disciplines assessment\n\n## probe/PD-1#no-tmp-files\n\n- **Cause here:** scratch files\n" }),
  "/repo/probe/rules/PD-1/README.md": ABSENT_FILE,
  "/install/rules/CD-23/README.md": presentFile({ text: "# CD-23\n" }),
};

const fileText: FileTextPort = {
  read: ({ path }) => FILES[path].read,
  exists: ({ path }) => FILES[path].presence,
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

const git: GitPort = {
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({
      outcome: "ok",
      value: [
        repoPathSchema.parse("src/scratch.tmp.ts"),
        repoPathSchema.parse("src/kept.ts"),
        repoPathSchema.parse("src/plain.ts"),
        repoPathSchema.parse("src/plain.test.ts"),
        repoPathSchema.parse("README.md"),
      ],
    }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const PROBE_ADDRESS = { ruleSet: { name: "probe" }, discipline: "PD-1", clause: "no-tmp-files" };
const EXPORT_TEST_SIBLING_ADDRESS = { ruleSet: "hone", discipline: "CD-23", clause: "export-test-sibling" };

const probeCheck = () => {
  const parse = { ...DEFAULT_PARSE_PORT };
  const parseCalls = vi.spyOn(parse, "parse");
  const runnerModule = { runner: createWalkerRunner({ fileText, modules: pieceModules, path, parse, entryKind: ABSENT_ENTRY_KIND }) };
  const records = {
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse("/install"),
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText,
    engine: createDefaultEnginePort({}),
    modules: {
      load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: runnerModule }),
    },
    path,
    git,
  } as const;
  const report = runCheck({
    ...records,
    selectionRepository: createSelectionRepository(records),
    exceptionRepository: createExceptionRepository({
      ...records,
      fileText: {
        ...records.fileText,
        exists: (query) => (query.path.endsWith("discipline-exceptions") ? "absent" : records.fileText.exists(query)),
      },
      directory: {
        list: ({ path: folder }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path: folder, detail: "the single-file fake holds no folders" } }),
        create: ({ path: folder }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path: folder, detail: "the single-file fake holds no folders" } }),
      },
      fileRemoval: { remove: ({ path: file }) => ({ outcome: "failed", error: { kind: "unremovable", path: file, detail: "the single-file fake removes nothing" } }) },
      gitTree: { pathsAt: () => ({ outcome: "ok", value: [repoPathSchema.parse("discipline-exceptions.json")] }) },
    }),
  });
  return { report, parseCalls };
};

describe("a check selecting the probe rule set's PD-1 beside CD-23 through the audit", () => {
  it("flags the temporary file through the probe and the unit without a test sibling through CD-23 in one run", async () => {
    await expect(probeCheck().report).resolves.toEqual({
      outcome: "ok",
      value: {
        excluded: [],
        notAdopted: [],
        notRun: [],
        editions: [],
        findings: [
          {
            clause: PROBE_ADDRESS,
            file: "src/scratch.tmp.ts",
            anchor: { line: 1, column: 0 },
            snippet: "src/scratch.tmp.ts",
            mechanism: "audit",
          },
          {
            clause: EXPORT_TEST_SIBLING_ADDRESS,
            file: "src/kept.ts",
            anchor: { line: 1, column: 0 },
            snippet: "missing co-located *.test.ts(x) sibling",
            mechanism: "audit",
          },
        ],
        exempted: [],
        uncovered: [],
        stale: [],
        forfeited: [],
        unrecorded: [],
        doublyHeld: [],
        invalidRecords: [],
        unmeasured: [],
        projectionProblems: [],
        assessment: [],
        readFirst: [
          {
            kind: "clause",
            clause: PROBE_ADDRESS,
            assessmentSection: "present",
            rulePage: { path: "probe/rules/PD-1/README.md", presence: "absent" },
          },
          {
            kind: "clause",
            clause: EXPORT_TEST_SIBLING_ADDRESS,
            assessmentSection: "not-assessed",
            rulePage: { path: "../install/rules/CD-23/README.md", presence: "present" },
          },
        ],
      },
    });
  });

  it("parses each tracked TypeScript file exactly once", async () => {
    const { report, parseCalls } = probeCheck();
    await report;
    expect(parseCalls.mock.calls).toEqual([
      [{ fileName: "src/scratch.tmp.ts", source: TEMPORARY_SOURCE }],
      [{ fileName: "src/kept.ts", source: UNSIBLINGED_SOURCE }],
      [{ fileName: "src/plain.ts", source: PLAIN_SOURCE }],
    ]);
  });
});
