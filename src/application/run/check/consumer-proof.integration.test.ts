import { assert, describe, expect, it, type MockInstance, vi } from "vitest";
import { runCheck } from "./run-check.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { Result } from "../../../domain/result.ts";
import { checkCommandOutcome } from "../../../infrastructure/command-line/outcomes/check-command-outcome.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { createExceptionRepository } from "../../../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepository } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository, type SelectionRepository } from "../../../infrastructure/disciplines-file/consumer-selection.ts";
import type { EntryKindPort } from "../../../infrastructure/node/file-system/file-system-port.ts";
import type { ModuleExtension } from "../../../infrastructure/node/modules/install-layout.ts";
import type { ExitCode } from "../../../infrastructure/node/process/process-port.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../../infrastructure/engines/audit/runner/toolchain/typescript-toolchain.ts";
import { createEslintPort } from "../../../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../../../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { runProject } from "../../projection/run-project.ts";
import { createDefaultFileRemovalPort } from "../../../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../../infrastructure/git/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../../../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort, type PathPort } from "../../../infrastructure/node/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { DEFAULT_ASSESSMENT } from "../../../infrastructure/hone-config-file/assessment.ts";
import { type RepoPath, repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { createEslintRunner } from "../../../infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import { createWalkerRunner } from "../../../infrastructure/engines/audit/runner/create-walker-runner.ts";

const SINGLE_FILE_RECORDS = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_FOLDER_NAME = "discipline-exceptions";

type DiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

const singleFileRepositoryOver = (request: {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
}): ExceptionRepository =>
  createExceptionRepository({
    ...request,
    fileText: {
      ...request.fileText,
      exists: (query) => (query.path.endsWith(SPLIT_FOLDER_NAME) ? "absent" : request.fileText.exists(query)),
    },
    directory: {
      list: ({ path: folder }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path: folder, detail: "the single-file fake holds no folders" } }),
      create: ({ path: folder }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path: folder, detail: "the single-file fake holds no folders" } }),
    },
    fileRemoval: { remove: ({ path: file }) => ({ outcome: "failed", error: { kind: "unremovable", path: file, detail: "the single-file fake removes nothing" } }) },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE_RECORDS] }) },
  });

const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & { readonly selectionRepository: SelectionRepository; readonly exceptionRepository: ExceptionRepository } => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  exceptionRepository: singleFileRepositoryOver(request),
});

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

const fullReportExitCode = (request: { readonly checked: Result<CheckReport, LoadFailure> }): ExitCode =>
  checkCommandOutcome({
    result:
      request.checked.outcome === "failed"
        ? request.checked
        : { outcome: "ok", value: { report: request.checked.value, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } },
  }).code;

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

type PathCallsOutside = {
  readonly called: "at least once" | "never";
  readonly outside: readonly string[];
};

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../../../..` });

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: INSTALL_ROOT, installForm: "source" }) });
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);

const defaultParsePort = loadedParsePort.value;

const loadedEslintToolchain = await loadEslintToolchain({ peers: defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" }) });
assert(loadedEslintToolchain.outcome === "ok", "the eslint-10 toolchain loads from the development install");
assert(/^10\./.test(loadedEslintToolchain.value.eslintVersion), `the eslint-10 toolchain runs ESLint ${loadedEslintToolchain.value.eslintVersion}`);

const defaultEslintPort = createEslintPort({ toolchain: loadedEslintToolchain.value });

const WALKER_CONSUMER =resolvedPath({ path: `${import.meta.dirname}/../../../../delivery/install-proof/consumer-proof/audit` });

const ESLINT_CONSUMER = resolvedPath({ path: `${import.meta.dirname}/../../../../delivery/install-proof/consumer-proof/eslint` });

const INSTALLED_SOURCE = String.raw`(?!(?:[^/]*\/)*tests\/)(?!.*\.test\.ts$).*`;

const WALKER_INSTALLED = String.raw`(?:src\/(?:domain|application|operations|infrastructure(?!\/engines\/(?:audit|eslint)\/))|rules\/CD-23|src\/infrastructure\/engines\/audit\/runner|src\/infrastructure\/engines\/audit\/CD-23)\/${INSTALLED_SOURCE}`;

const ESLINT_INSTALLED = String.raw`(?:src\/(?:domain|application|operations|infrastructure(?!\/engines\/(?:audit|eslint)\/))|rules\/CD-14|src\/infrastructure\/engines\/eslint\/runner|src\/infrastructure\/engines\/eslint\/CD-14)\/${INSTALLED_SOURCE}`;

const WALKER_INSTALL_LIST = new RegExp(`^${WALKER_INSTALLED}$`);

const ESLINT_INSTALL_LIST = new RegExp(`^${ESLINT_INSTALLED}$`);

const INSTALLED_MANIFEST = String.raw`package\.json`;

const WALKER_READABLE = new RegExp(String.raw`^(?:${WALKER_INSTALLED}|${INSTALLED_MANIFEST}|delivery\/install-proof\/consumer-proof\/audit\/.*)$`);

const ESLINT_READABLE = new RegExp(String.raw`^(?:${ESLINT_INSTALLED}|${INSTALLED_MANIFEST}|delivery\/install-proof\/consumer-proof\/eslint\/.*)$`);

const NO_HARNESS_SEGMENT = /^(?!(?:.*\/)?\.(?:claude|kiro|codex|cursor|aidlc|opencode|github|copilot)(?:\/|$)).*$/;

const installCallsOutside = (request: {
  readonly calls: readonly (readonly [{ readonly path: string }])[];
  readonly paths: RegExp;
}): PathCallsOutside => ({
  called: request.calls.length === 0 ? "never" : "at least once",
  outside: request.calls
    .map(([call]) => call.path)
    .filter((observed) => {
      const location = path.relative({ from: INSTALL_ROOT, to: observed });
      return !(location.relation === "within-root" && request.paths.test(location.path));
    }),
});

const EVERY_CALL_WITHIN: PathCallsOutside = { called: "at least once", outside: [] };

type ObservedPorts = {
  readonly fileText: FileTextPort;
  readonly runnerModules: ModuleLoaderPort;
  readonly reads: MockInstance<FileTextPort["read"]>;
  readonly probes: MockInstance<FileTextPort["exists"]>;
  readonly pieceLoads: MockInstance<ModuleLoaderPort["load"]>;
  readonly runnerLoads: MockInstance<ModuleLoaderPort["load"]>;
};

const observedPorts = (): ObservedPorts => {
  const realFileText = createDefaultFileTextPort({});
  const fileText: FileTextPort = {
    read: realFileText.read,
    exists: realFileText.exists,
    write: vi.fn<FileTextPort["write"]>(),
  };
  const pieceModules: ModuleLoaderPort = { load: createDefaultModuleLoaderPort({}).load };
  const runners: Readonly<Record<string, unknown>> = {
    [resolvedPath({ path: `${INSTALL_ROOT}/src/infrastructure/engines/audit/runner/runner.ts` })]: {
      runner: createWalkerRunner({ fileText, modules: pieceModules, path, parse: defaultParsePort, entryKind: ABSENT_ENTRY_KIND }),
    },
    [resolvedPath({ path: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/runner.ts` })]: {
      runner: createEslintRunner({ fileText, fileRemoval: createDefaultFileRemovalPort({}), modules: pieceModules, path, eslint: defaultEslintPort, moduleExtension: ".ts" }),
    },
  };
  const runnerModules: ModuleLoaderPort = {
    load: ({ path: runnerPath }) => Promise.resolve({ outcome: "ok", value: runners[runnerPath] }),
  };
  return {
    fileText,
    runnerModules,
    reads: vi.spyOn(fileText, "read"),
    probes: vi.spyOn(fileText, "exists"),
    pieceLoads: vi.spyOn(pieceModules, "load"),
    runnerLoads: vi.spyOn(runnerModules, "load"),
  };
};

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const checkOf = (request: {
  readonly repo: AbsolutePath;
  readonly tracked: readonly RepoPath[];
  readonly ports: ObservedPorts;
}) =>
  runCheck(withSingleFileRecords({
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText: request.ports.fileText,
    modules: request.ports.runnerModules,
    path,
    git: gitTracking({ tracked: request.tracked }),
  }));

const projectOf = (request: { readonly repo: AbsolutePath; readonly ports: ObservedPorts }) =>
  runProject(withSingleFileRecords({
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    fileText: request.ports.fileText,
    modules: request.ports.runnerModules,
    path,
    git: gitTracking({ tracked: [] }),
  }));

const SIBLINGED_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("src/plain.ts"),
  repoPathSchema.parse("src/plain.test.ts"),
];

const UNSIBLINGED_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("src/plain.ts"),
  repoPathSchema.parse("src/plain.test.ts"),
  repoPathSchema.parse("src/kept.ts"),
];

const ESLINT_CLEAN_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("disciplines.eslint.mjs"),
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("src/plain.ts"),
];

const ESLINT_CLASS_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("disciplines.eslint.mjs"),
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("src/plain.ts"),
  repoPathSchema.parse("src/kept.ts"),
];

const UNSIBLINGED_FINDING = {
  clause: { ruleSet: "hone", discipline: "CD-23", clause: "export-test-sibling" },
  file: "src/kept.ts",
  anchor: { line: 1, column: 0 },
  snippet: "missing co-located *.test.ts(x) sibling",
  mechanism: "audit",
};

const readingOf = (request: { readonly clause: { readonly discipline: string } }) => ({
  kind: "clause",
  clause: request.clause,
  assessmentSection: "unread",
  rulePage: { path: `../../../../rules/${request.clause.discipline}/README.md`, presence: "present" },
});

const ASSESSMENT_NOT_WRITTEN = { kind: "assessment-file", state: "not-written", guide: "../../../../ADOPTING.md" };

const CLASS_FINDING = {
  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
  file: "src/kept.ts",
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  mechanism: "eslint",
};

const CLEAN_REPORT = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
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
  readFirst: [],
};

describe("installCallsOutside over written-out calls, so the path confinement can fail", () => {
  it("reports at least one call and lists the observed paths outside the install path list or carrying a harness segment", () => {
    expect({
      installList: installCallsOutside({
        calls: [[{ path: `${INSTALL_ROOT}/src/domain/a.ts` }], [{ path: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/b.ts` }]],
        paths: WALKER_INSTALL_LIST,
      }),
      harness: installCallsOutside({ calls: [[{ path: `${INSTALL_ROOT}/src/domain/a.ts` }], [{ path: `${INSTALL_ROOT}/.claude/c.ts` }]], paths: NO_HARNESS_SEGMENT }),
    }).toEqual({
      installList: { called: "at least once", outside: [`${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/b.ts`] },
      harness: { called: "at least once", outside: [`${INSTALL_ROOT}/.claude/c.ts`] },
    });
  });

  it("reports never when no call was made", () => {
    expect(installCallsOutside({ calls: [], paths: WALKER_INSTALL_LIST })).toEqual({ called: "never", outside: [] });
  });
});

describe("a consumer with no harness directory selecting CD-23 through the audit, run against the install", () => {
  it("passes when every tracked unit has its test sibling, exiting 0", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: WALKER_CONSUMER, tracked: SIBLINGED_TRACKED, ports });
    expect(checked).toEqual({ outcome: "ok", value: CLEAN_REPORT });
    expect(fullReportExitCode({ checked })).toBe(0);
  });

  it("fails when a tracked unit has no test sibling, exiting 1 with the unit as an audit finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: WALKER_CONSUMER, tracked: UNSIBLINGED_TRACKED, ports });
    expect(checked).toEqual({
      outcome: "ok",
      value: { ...CLEAN_REPORT, findings: [UNSIBLINGED_FINDING], readFirst: [ASSESSMENT_NOT_WRITTEN, readingOf({ clause: UNSIBLINGED_FINDING.clause })] },
    });
    expect(fullReportExitCode({ checked })).toBe(1);
  });

  it("reads, probes and loads only paths in the audit mechanism's install path list or the consumer repo", async () => {
    const ports = observedPorts();
    await checkOf({ repo: WALKER_CONSUMER, tracked: UNSIBLINGED_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: WALKER_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: WALKER_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: WALKER_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: WALKER_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment", async () => {
    const ports = observedPorts();
    await checkOf({ repo: WALKER_CONSUMER, tracked: UNSIBLINGED_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
  });
});

describe("a consumer with no harness directory selecting CD-14 through ESLint, run against the install", () => {
  it("projects the checked-in projection unchanged and writes nothing", async () => {
    const ports = observedPorts();
    await expect(projectOf({ repo: ESLINT_CONSUMER, ports })).resolves.toEqual({
      outcome: "ok",
      value: [{ path: "disciplines.eslint.mjs", effect: "unchanged" }],
    });
    expect(ports.fileText.write).not.toHaveBeenCalled();
  });

  it("passes when its tracked files hold no class, exiting 0", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLEAN_TRACKED, ports });
    expect(checked).toEqual({ outcome: "ok", value: CLEAN_REPORT });
    expect(fullReportExitCode({ checked })).toBe(0);
  });

  it("fails when a tracked file holds a class, exiting 1 with the class as an ESLint finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(checked).toEqual({
      outcome: "ok",
      value: { ...CLEAN_REPORT, findings: [CLASS_FINDING], readFirst: [ASSESSMENT_NOT_WRITTEN, readingOf({ clause: CLASS_FINDING.clause })] },
    });
    expect(fullReportExitCode({ checked })).toBe(1);
  });

  it("reads, probes and loads only paths in the ESLint install path list or the consumer repo, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: ESLINT_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: ESLINT_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: ESLINT_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: ESLINT_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
  });
});
