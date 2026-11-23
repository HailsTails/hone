import { assert, describe, expect, it, type MockInstance, vi } from "vitest";

import type { EntryKindPort } from "../../src/application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../src/application/ports/git-port.ts";
import type { ModuleExtension } from "../../src/application/ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { ExceptionEntryParser } from "../../src/application/ports/records/exception-entries.ts";
import type { ExceptionRepository } from "../../src/application/ports/records/exception-repository.ts";
import type { SelectionRepository } from "../../src/application/ports/selection/selection-repository.ts";
import type { SelectionRepositoryOf } from "../../src/application/ports/selection/selection-repository.ts";
import { versionTwoRunOver } from "../../src/application/run/version-two-run.ts";
import { createUpgradeBefore } from "../../src/application/upgrade/record-answers/upgrade-before.ts";
import { INSTALLED_PORTS } from "../../src/composition/run-tool-command.ts";
import { runVerdictOf } from "../../src/domain/report/report-sections.ts";
import { verdictOf } from "../../src/domain/report/verdict.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../src/domain/repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { readBoundCatalogue } from "../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { createExceptionRepository } from "../../src/infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { exceptionEntryParser } from "../../src/infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../../src/infrastructure/disciplines-file/consumer-selection.ts";
import {
  readSelectionFile,
  selectionFilePathOf,
} from "../../src/infrastructure/disciplines-file/selection-reader.ts";
import {
  bindEslintChecksModule,
  createChecksRunner,
} from "../../src/infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import {
  ESLINT_PROJECTED_KINDS,
  versionOneProjectionOver,
} from "../../src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { measureVersionOneProjection } from "../../src/infrastructure/engines/protocol/engine-run/engine-run.ts";
import { createWalkerRunner } from "../../src/infrastructure/engines/walker/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { DEFAULT_ASSESSMENT } from "../../src/infrastructure/hone-config-file/assessment.ts";
import {
  createCheckPieceSource,
  createSettingsSources,
} from "../../src/infrastructure/hone-config-file/settings-sources.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";

const SINGLE_FILE_RECORDS = repoPathOf("discipline-exceptions.json");

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
      exists: (query) =>
        query.path.endsWith(SPLIT_FOLDER_NAME) ? "absent" : request.fileText.exists(query),
    },
    directory: {
      list: ({ path: folder }) => ({
        outcome: "failed",
        error: {
          kind: "directory-unreadable",
          path: folder,
          detail: "the single-file fake holds no folders",
        },
      }),
      create: ({ path: folder }) => ({
        outcome: "failed",
        error: {
          kind: "directory-uncreatable",
          path: folder,
          detail: "the single-file fake holds no folders",
        },
      }),
    },
    fileRemoval: {
      remove: ({ path: file }) => ({
        outcome: "failed",
        error: { kind: "unremovable", path: file, detail: "the single-file fake removes nothing" },
      }),
    },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE_RECORDS] }) },
  });

type SingleFileRecords = {
  readonly selectionRepository: SelectionRepository;
  readonly selectionRepositoryOf: SelectionRepositoryOf;
  readonly exceptionRepository: ExceptionRepository;
  readonly exceptionEntryParser: ExceptionEntryParser;
};

const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & SingleFileRecords => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  selectionRepositoryOf: createSelectionRepository,
  exceptionRepository: singleFileRepositoryOver(request),
  exceptionEntryParser,
});

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

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../..` });

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: INSTALL_ROOT, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);

const defaultParsePort = loadedParsePort.value;

const loadedEslintToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" }),
});
assert(
  loadedEslintToolchain.outcome === "ok",
  "the eslint-10 toolchain loads from the development install",
);
assert(
  /^10\./.test(loadedEslintToolchain.value.eslintVersion),
  `the eslint-10 toolchain runs ESLint ${loadedEslintToolchain.value.eslintVersion}`,
);

const defaultEslintPort = createEslintPort({ toolchain: loadedEslintToolchain.value });

const WALKER_CONSUMER = resolvedPath({ path: `${import.meta.dirname}/consumer-proof/audit` });

const ESLINT_CONSUMER = resolvedPath({ path: `${import.meta.dirname}/consumer-proof/eslint` });

const INSTALLED_SOURCE = String.raw`(?!(?:[^/]*\/)*tests\/)(?!.*\.test\.ts$).*`;

const CD_23_DATA = String.raw`src\/infrastructure\/engines\/[^/]+\/unit-without-a-running-test\/companion-test-file\/(?:piece\.json|companion-test-file\.examples\.json)`;

const CD_14_DATA = String.raw`src\/infrastructure\/engines\/[^/]+\/authored-class-or-this\/(?:class-keyword|static-members-only)\/(?:piece\.json|[^/]+\.examples\.json)`;

const CD_23_CHECK_ITEM = String.raw`rules\/typescript\/symptoms\/unit-without-a-running-test\/companion-test-file\.md`;

const CD_14_CHECK_ITEM = String.raw`rules\/typescript\/symptoms\/authored-class-or-this\/class-keyword\.md`;

const WALKER_INSTALLED = String.raw`(?:(?:src\/(?:domain|application|operations|infrastructure(?!\/engines\/(?:walker|eslint)\/))|src\/infrastructure\/engines\/walker\/runner|src\/infrastructure\/engines\/walker\/unit-without-a-running-test\/companion-test-file)\/${INSTALLED_SOURCE}|${CD_23_DATA}|${CD_23_CHECK_ITEM})`;

const ESLINT_INSTALLED = String.raw`(?:(?:src\/(?:domain|application|operations|infrastructure(?!\/engines\/(?:walker|eslint)\/))|src\/infrastructure\/engines\/eslint\/runner|src\/infrastructure\/engines\/eslint\/authored-class-or-this\/(?:class-keyword|static-members-only))\/${INSTALLED_SOURCE}|${CD_14_DATA}|${CD_14_CHECK_ITEM})`;

const WALKER_INSTALL_LIST = new RegExp(`^${WALKER_INSTALLED}$`);

const ESLINT_PLUGIN_ENTRIES = String.raw`src\/infrastructure\/engines\/eslint\/[^/]+\/[^/]+\/eslint-plugin\.ts`;
const ESLINT_INSTALL_LIST = new RegExp(`^(?:${ESLINT_INSTALLED}|${ESLINT_PLUGIN_ENTRIES})$`);

const INSTALLED_MANIFEST = String.raw`package\.json`;
const NAMED_CATALOGUE = String.raw`(?:rules\/(?:[^/]+\/)*[^/]+\.md|src\/infrastructure\/engines\/(?:walker|eslint)\/[^/]+\/[^/]+\/piece\.json)`;

const WALKER_READABLE = new RegExp(
  String.raw`^(?:${WALKER_INSTALLED}|${NAMED_CATALOGUE}|rules|${INSTALLED_MANIFEST}|delivery\/install-proof\/consumer-proof\/audit\/.*)$`,
);

const ESLINT_READABLE = new RegExp(
  String.raw`^(?:${ESLINT_INSTALLED}|${NAMED_CATALOGUE}|rules|${INSTALLED_MANIFEST}|delivery\/install-proof\/consumer-proof\/eslint\/.*)$`,
);

const NO_HARNESS_SEGMENT =
  /^(?!(?:.*\/)?\.(?:claude|kiro|codex|cursor|aidlc|opencode|github|copilot)(?:\/|$)).*$/;

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
  const namedSettingsPath = path.join({ segments: [WALKER_CONSUMER, "hone.config.json"] });
  const fileText: FileTextPort = {
    read: (entry) =>
      entry.path === namedSettingsPath
        ? {
            outcome: "ok",
            value:
              '{"version":2,"ruleSets":{},"checks":{"unit-without-a-running-test#companion-test-file":"walker"}}',
          }
        : realFileText.read(entry),
    exists: (entry) => (entry.path === namedSettingsPath ? "present" : realFileText.exists(entry)),
    write: vi.fn<FileTextPort["write"]>(),
  };
  const pieceModules: ModuleLoaderPort = { load: createDefaultModuleLoaderPort({}).load };
  const runners: Readonly<Record<string, unknown>> = {
    [resolvedPath({ path: `${INSTALL_ROOT}/src/infrastructure/engines/walker/runner/runner.ts` })]:
      {
        namedChecksRunner: {
          fileScope: "tracked",
          ...createWalkerRunner({
            fileText,
            modules: pieceModules,
            path,
            parse: defaultParsePort,
            entryKind: ABSENT_ENTRY_KIND,
          }),
          projectedKinds: ["inline-disable"],
        },
      },
    [resolvedPath({ path: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/runner.ts` })]:
      {
        ...bindEslintChecksModule({
          projectedKinds: ESLINT_PROJECTED_KINDS,
          runner: Promise.resolve({
            outcome: "ok",
            value: createChecksRunner({
              fileText,
              fileRemoval: createDefaultFileRemovalPort({}),
              modules: pieceModules,
              path,
              eslint: defaultEslintPort,
              moduleExtension: ".ts",
            }),
          }),
        }),
        versionOneProjectionOver,
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
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const upgradeBeforeOver = (request: {
  readonly repo: AbsolutePath;
  readonly tracked: readonly RepoPath[];
  readonly ports: ObservedPorts;
}) => {
  const { fileText, runnerModules: modules } = request.ports;
  const { directory, loadFailureDetail, namedEngine, versionOneProjectionOf } = INSTALLED_PORTS;
  const context = {
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    path,
    fileText,
    directory,
  } satisfies Parameters<typeof createSettingsSources>[0];
  const selection = readSelectionFile({
    fileText,
    path: selectionFilePathOf({ path, repoRoot: request.repo }),
  });
  const catalogue = readBoundCatalogue({ ...context, ruleSetRoot: INSTALL_ROOT, ruleSet: "hone" });
  assert(selection.outcome === "ok");
  assert(catalogue.outcome === "ok" && catalogue.value.held === "catalogue");
  return createUpgradeBefore({
    check: {
      ...withSingleFileRecords({ ...context, git: gitTracking({ tracked: request.tracked }) }),
      modules,
      baseRevision: undefined,
      assessment: DEFAULT_ASSESSMENT,
    },
    engine: namedEngine,
    sources: createSettingsSources(context),
    readPiece: createCheckPieceSource(context),
    selection: selection.value,
    catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: catalogue.value.catalogue }],
    loadFailureDetail,
    measureVersionOne: measureVersionOneProjection,
    projection: versionOneProjectionOf({
      ...context,
      modules,
      fileRemoval: createDefaultFileRemovalPort({}),
    }),
  });
};

const checkOf = (request: Parameters<typeof upgradeBeforeOver>[0]) =>
  upgradeBeforeOver(request).report();

const projectOf = (request: { readonly repo: AbsolutePath; readonly ports: ObservedPorts }) =>
  upgradeBeforeOver({ ...request, tracked: [] }).prepareProjections([]);

const namedCheckOf = (request: {
  readonly tracked: readonly RepoPath[];
  readonly ports: ObservedPorts;
}) =>
  versionTwoRunOver({
    stages: INSTALLED_PORTS.stagesOver({
      ports: {
        ...INSTALLED_PORTS,
        fileText: request.ports.fileText,
        modules: request.ports.runnerModules,
        git: gitTracking({ tracked: request.tracked }),
      },
      locations: {
        repoRoot: WALKER_CONSUMER,
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    }),
    arguments: { reportOutput: undefined, forfeiture: undefined, measuring: "when-debt-held" },
  });

const SIBLINGED_TRACKED: readonly RepoPath[] = [
  repoPathOf("hone.config.json"),
  repoPathOf("src/plain.ts"),
  repoPathOf("src/plain.test.ts"),
];

const UNSIBLINGED_TRACKED: readonly RepoPath[] = [
  repoPathOf("hone.config.json"),
  repoPathOf("src/plain.ts"),
  repoPathOf("src/plain.test.ts"),
  repoPathOf("src/kept.ts"),
];

const ESLINT_CLEAN_TRACKED: readonly RepoPath[] = [
  repoPathOf("disciplines.json"),
  repoPathOf("disciplines.eslint.mjs"),
  repoPathOf("eslint.config.mjs"),
  repoPathOf("src/plain.ts"),
];

const ESLINT_CLASS_TRACKED: readonly RepoPath[] = [
  repoPathOf("disciplines.json"),
  repoPathOf("disciplines.eslint.mjs"),
  repoPathOf("eslint.config.mjs"),
  repoPathOf("src/plain.ts"),
  repoPathOf("src/kept.ts"),
];

const UNSIBLINGED_FINDING = {
  check: "unit-without-a-running-test#companion-test-file",
  file: "src/kept.ts",
  anchor: { line: 1, column: 0 },
  snippet: "missing co-located *.test.ts(x) sibling",
  mechanism: "walker",
};

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
};

describe("installCallsOutside over written-out calls, so the path confinement can fail", () => {
  it("reports at least one call and lists the observed paths outside the install path list or carrying a harness segment", () => {
    expect({
      installList: installCallsOutside({
        calls: [
          [{ path: `${INSTALL_ROOT}/src/domain/a.ts` }],
          [{ path: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/b.ts` }],
        ],
        paths: WALKER_INSTALL_LIST,
      }),
      harness: installCallsOutside({
        calls: [
          [{ path: `${INSTALL_ROOT}/src/domain/a.ts` }],
          [{ path: `${INSTALL_ROOT}/.claude/c.ts` }],
        ],
        paths: NO_HARNESS_SEGMENT,
      }),
    }).toEqual({
      installList: {
        called: "at least once",
        outside: [`${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/b.ts`],
      },
      harness: { called: "at least once", outside: [`${INSTALL_ROOT}/.claude/c.ts`] },
    });
  });

  it("reports never when no call was made", () => {
    expect(installCallsOutside({ calls: [], paths: WALKER_INSTALL_LIST })).toEqual({
      called: "never",
      outside: [],
    });
  });
});

describe("a consumer with no harness directory selecting the named companion-test check", () => {
  it("passes when every tracked unit has its test sibling", async () => {
    const checked = await namedCheckOf({ tracked: SIBLINGED_TRACKED, ports: observedPorts() });
    assert(checked.outcome === "ok");
    expect(checked.value.report.findings).toEqual([]);
    expect(runVerdictOf({ report: checked.value.report })).toBe("pass");
  });

  it("fails when a tracked unit has no test sibling and reports its named check", async () => {
    const checked = await namedCheckOf({ tracked: UNSIBLINGED_TRACKED, ports: observedPorts() });
    assert(checked.outcome === "ok");
    expect(checked.value.report.findings).toEqual([UNSIBLINGED_FINDING]);
    expect(runVerdictOf({ report: checked.value.report })).toBe("fail");
  });

  it("reads, probes and loads only paths in the walker's install path list or the consumer repo", async () => {
    const ports = observedPorts();
    await namedCheckOf({ tracked: UNSIBLINGED_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: WALKER_READABLE })).toEqual(
      EVERY_CALL_WITHIN,
    );
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: WALKER_READABLE })).toEqual(
      EVERY_CALL_WITHIN,
    );
    expect(
      installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: WALKER_INSTALL_LIST }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: WALKER_INSTALL_LIST }),
    ).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment", async () => {
    const ports = observedPorts();
    await namedCheckOf({ tracked: UNSIBLINGED_TRACKED, ports });
    expect(
      installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
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

  it("passes when its tracked files hold no class", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLEAN_TRACKED, ports });
    expect(checked).toEqual({ outcome: "ok", value: CLEAN_REPORT });
    assert(checked.outcome === "ok");
    expect(verdictOf({ report: checked.value })).toBe("pass");
  });

  it("fails when a tracked file holds a class and reports it as an ESLint finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(checked).toEqual({
      outcome: "ok",
      value: {
        ...CLEAN_REPORT,
        findings: [CLASS_FINDING],
      },
    });
    assert(checked.outcome === "ok");
    expect(verdictOf({ report: checked.value })).toBe("fail");
  });

  it("reads, probes and loads only paths in the ESLint install path list or the consumer repo, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: ESLINT_READABLE })).toEqual(
      EVERY_CALL_WITHIN,
    );
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: ESLINT_READABLE })).toEqual(
      EVERY_CALL_WITHIN,
    );
    expect(
      installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: ESLINT_INSTALL_LIST }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: ESLINT_INSTALL_LIST }),
    ).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(
      installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
    expect(
      installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT }),
    ).toEqual(EVERY_CALL_WITHIN);
  });
});
