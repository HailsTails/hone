import { describe, expect, it, vi } from "vitest";

import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type {
  CaseVerdict,
  ProjectionWrite,
} from "../../../../../domain/runner/runner-result-types.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { ConfigLookup } from "../config-roots/config-lookup.ts";
import type { PackageScripts } from "../native-exceptions/package-script-scanner.ts";
import type { SuppressionsFile } from "../native-exceptions/suppressions-scanner.ts";
import type { ProjectionStates } from "../projection/projection-states.ts";
import type { CurrentProjection, ProjectionFiles } from "../projection/projection.ts";
import type { RuleState } from "../toolchain/eslint-config-schema.ts";
import type {
  ConfigFileSearch,
  EslintPort,
  GovernanceInstance,
  IgnoredState,
  LintedFile,
  LintedMessage,
  QueryInstance,
} from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import { type EslintRunnerPorts, eslintRunnerOver } from "./create-eslint-runner.ts";
import type { EslintRepository } from "./eslint-repository.ts";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  declarationText: "declare const projection: readonly unknown[];\nexport default projection;\n",
};

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

type EslintFakeParts = {
  readonly query: QueryInstance;
  readonly lintFiles: GovernanceInstance["lintFiles"];
  readonly lintSourceCases: EslintPort["lintSourceCases"];
};

const REPO_ROOT = absoluteRootOf("/repo");
const INSTALL_ROOT = absoluteRootOf("/repo/node_modules/@hailstails/hone");
const PIECE_ROOT = "/repo/node_modules/@hailstails/hone/mechanisms/eslint/CD-14";
const LOOPS_PIECE_ROOT = "/repo/node_modules/@hailstails/hone/mechanisms/eslint/CD-15";
const PLUGIN_MODULE_PATH =
  "/repo/node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";
const LOOPS_MODULE_PATH =
  "/repo/node_modules/@hailstails/hone/mechanisms/eslint/CD-15/loops/loops.eslint-plugin.ts";
const PROJECTION_FILE = repoPathOf("disciplines.eslint.mjs");
const RULE_ID = "hone/no-class-authoring";
const LOOPS_RULE_ID = "loops/no-for-of";

const ESLINT = "eslint" as const;
const CLASS_SYNTAX = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};
const FOR_OF = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("for-of"),
};
const CLASS_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };
const FOR_OF_OBJECT = { ruleSet: "hone", discipline: "CD-15", clause: "for-of" };

const FILE_A = repoPathOf("src/a.ts");
const FACTORY = repoPathOf("src/factory.ts");
const FILES = [FILE_A, FACTORY];

const CLASS_SETTINGS = {
  pluginNamespace: "hone",
  pluginModule: "cd14/cd14.eslint-plugin.ts",
  rule: "no-class-authoring",
};

const CLASS_CLAUSE: RunnerClause = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: PIECE_ROOT,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: CLASS_SETTINGS,
};

const LOOPS_CLAUSE: RunnerClause = {
  address: FOR_OF,
  anchor: { kind: "keyword", keyword: "for" },
  pieceRoot: LOOPS_PIECE_ROOT,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: {
    pluginNamespace: "loops",
    pluginModule: "loops/loops.eslint-plugin.ts",
    rule: "no-for-of",
  },
};

const CLASS_PLUGIN_MODULE = {
  default: { rules: { "no-class-authoring": { meta: { type: "problem" }, create: () => ({}) } } },
};

const LOOPS_PLUGIN_MODULE = {
  default: { rules: { "no-for-of": { meta: { type: "problem" }, create: () => ({}) } } },
};

const PLUGIN_MODULES: Readonly<Record<string, unknown>> = {
  [PLUGIN_MODULE_PATH]: CLASS_PLUGIN_MODULE,
  [LOOPS_MODULE_PATH]: LOOPS_PLUGIN_MODULE,
};

const FACTORY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source:
      "fictional unit fixture mechanisms/eslint/runner/create-eslint-runner.test.ts#FACTORY_LOCATION; not historical authorisation",
  },
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "the wrapping factory for the library",
};

const FACTORY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const GONE_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source:
      "fictional unit fixture mechanisms/eslint/runner/create-eslint-runner.test.ts#GONE_LOCATION; not historical authorisation",
  },
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: repoPathOf("src/gone.ts"),
  reason: "the wrapping factory for the library",
};

const CLAUSE_WIDE: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  reason: "Class syntax carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const ENABLING_PROJECTION = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

const PACKAGED_ENABLING_PROJECTION = `import piece0 from "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

const FACTORY_LOCATION_PROJECTION = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/factory.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const GONE_LOCATION_PROJECTION = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/gone.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const CLAUSE_WIDE_PROJECTION = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/clause-wide-carve-out/CD-14#class-syntax",
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const present = (text: string): CurrentProjection => ({ presence: "present", text });

const ABSENT_PROJECTION: CurrentProjection = { presence: "absent" };

const unreadableProjection = (file: RepoPath): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: { kind: "file-unreadable", file, detail: "EACCES" },
});

const writtenAt = (file: string): Result<ProjectionWrite, RunnerFailure> => ({
  outcome: "ok",
  value: { path: repoPathSchema.parse(file), effect: "written" },
});

const projectionFilesAnswering = (answer: Result<ProjectionStates, RunnerFailure>) => ({
  currentOf: vi.fn<ProjectionFiles["currentOf"]>().mockReturnValue(answer),
  writeAt: vi.fn<ProjectionFiles["writeAt"]>().mockReturnValue(writtenAt(PROJECTION_FILE)),
  removeAt: vi
    .fn<ProjectionFiles["removeAt"]>()
    .mockReturnValue({ outcome: "ok", value: undefined }),
});

const projectionFilesHolding = (states: ProjectionStates) =>
  projectionFilesAnswering({ outcome: "ok", value: states });

const rootHolding = (current: CurrentProjection) =>
  projectionFilesHolding(new Map([[PROJECTION_FILE, current]]));

const LINES_OF_A: Result<readonly string[], RunnerFailure> = {
  outcome: "ok",
  value: ["const a = 1;", "", "  class A {}", ""],
};

const LINES_OF_BOTH_PIECES: Result<readonly string[], RunnerFailure> = {
  outcome: "ok",
  value: ["const a = 1;", "", "  class A {}", "", "  xs.forEach(visit);", ""],
};

const NEAREST_TO_FILE: Result<ConfigLookup, RunnerFailure> = {
  outcome: "ok",
  value: { kind: "nearest-to-file" },
};

const ROOT_CONFIG_LOOKUP: Result<ConfigLookup, RunnerFailure> = {
  outcome: "ok",
  value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
};

const repositoryHolding = (overrides: Partial<EslintRepository>): EslintRepository => ({
  projectionFiles: rootHolding(present(ENABLING_PROJECTION)),
  configLookup: vi.fn<EslintRepository["configLookup"]>().mockReturnValue("nearest-to-file"),
  teamConfigLookup: vi.fn<EslintRepository["teamConfigLookup"]>().mockReturnValue(NEAREST_TO_FILE),
  folderConfiguration: vi
    .fn<EslintRepository["folderConfiguration"]>()
    .mockReturnValue("configured"),
  packageScriptsAt: vi.fn<EslintRepository["packageScriptsAt"]>(),
  suppressionsAt: vi.fn<EslintRepository["suppressionsAt"]>(),
  sourceLines: vi.fn<EslintRepository["sourceLines"]>().mockReturnValue(LINES_OF_A),
  ...overrides,
});

const resolvingFromRoot = (overrides: Partial<EslintRepository>): EslintRepository =>
  repositoryHolding({
    configLookup: vi.fn<EslintRepository["configLookup"]>().mockReturnValue("repository-root"),
    teamConfigLookup: vi
      .fn<EslintRepository["teamConfigLookup"]>()
      .mockReturnValue(ROOT_CONFIG_LOOKUP),
    ...overrides,
  });

const projectionHolding = (request: { readonly text: string }): EslintRepository =>
  repositoryHolding({ projectionFiles: rootHolding(present(request.text)) });

const scriptsAnswering = (scripts: PackageScripts) =>
  vi.fn<EslintRepository["packageScriptsAt"]>().mockReturnValue({ outcome: "ok", value: scripts });

const suppressionsAnswering = (suppressions: SuppressionsFile) =>
  vi
    .fn<EslintRepository["suppressionsAt"]>()
    .mockReturnValue({ outcome: "ok", value: suppressions });

const SOURCE_INSTALL = vi
  .fn<EslintRunnerPorts["coreInstall"]>()
  .mockReturnValue({ outcome: "ok", value: { form: "source" } });

const modulesOver = (modules: Readonly<Record<string, unknown>>): ModuleLoaderPort => ({
  load: ({ path }) => Promise.resolve({ outcome: "ok", value: modules[path] }),
});

const UNLOADABLE_MODULES: ModuleLoaderPort = {
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
    outcome: "failed",
    error: { kind: "module-unloadable", path: PLUGIN_MODULE_PATH, detail: "SyntaxError" },
  }),
};

const queryOver = (request: {
  readonly ignored: Readonly<Record<string, IgnoredState>>;
  readonly states: Readonly<Record<string, RuleState>>;
}): QueryInstance => ({
  ignoredState: ({ file }) => Promise.resolve({ outcome: "ok", value: request.ignored[file] }),
  ruleState: ({ file, ruleId }) =>
    Promise.resolve({ outcome: "ok", value: request.states[`${file} ${ruleId}`] }),
  configFileOf: () => Promise.resolve(CONFIG_UNKNOWN),
});

const failingQuery = (failure: RunnerFailure): QueryInstance => ({
  ignoredState: () => Promise.resolve({ outcome: "failed", error: failure }),
  ruleState: () => Promise.resolve({ outcome: "failed", error: failure }),
  configFileOf: () => Promise.resolve(CONFIG_UNKNOWN),
});

const CONFIG_UNKNOWN: ConfigFileSearch = { kind: "unknown" };

const configFailingQuery = (request: {
  readonly search: ConfigFileSearch;
  readonly detail: string;
}): QueryInstance => ({
  ...failingQuery({ kind: "team-config-unloadable", detail: request.detail }),
  configFileOf: vi.fn<QueryInstance["configFileOf"]>().mockResolvedValue(request.search),
});

const UNEXPECTED_TOKEN = "Unexpected token ';'";

const CHECKED: Readonly<Record<string, IgnoredState>> = {
  "src/a.ts": "checked",
  "src/factory.ts": "checked",
};

const ERROR: RuleState = { state: "configured", severity: 2, options: [] };
const OFF: RuleState = { state: "configured", severity: 0, options: [] };
const ABSENT: RuleState = { state: "rule-absent" };
const IGNORED: RuleState = { state: "file-ignored" };

const IN_EFFECT_QUERY = queryOver({
  ignored: CHECKED,
  states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: ERROR },
});

const linted = (request: {
  readonly messagesInA: readonly LintedMessage[];
}): readonly LintedFile[] => [
  { filePath: "/repo/src/a.ts", messages: request.messagesInA },
  { filePath: "/repo/src/factory.ts", messages: [] },
];

const MEASURED_CLASS_IN_A = [{ clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" }];

const MEASURED_CLASS = [
  { clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" },
  { clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
];

const MEASURED_CLASS_AND_FOR_OF = [
  { clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" },
  { clause: FOR_OF_OBJECT, file: "src/a.ts" },
  { clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
  { clause: FOR_OF_OBJECT, file: "src/factory.ts" },
];

const lintResolving = (outcome: Result<readonly LintedFile[], RunnerFailure>) =>
  vi.fn<GovernanceInstance["lintFiles"]>().mockResolvedValue(outcome);

const CLASS_MESSAGE: LintedMessage = {
  ruleId: RULE_ID,
  line: 3,
  column: 3,
  message: "class authored",
};

const FORTY_BUNDLED = "var a=1;var b=2;var c=3;var d=4;var e=5;";

const LIMIT_LONG_LINE = `${FORTY_BUNDLED}${FORTY_BUNDLED}${FORTY_BUNDLED}${FORTY_BUNDLED}${FORTY_BUNDLED}`;

const CLEAN_LINT = lintResolving({ outcome: "ok", value: linted({ messagesInA: [] }) });

const HIT_IN_A = {
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  anchor: { line: 3, column: 2 },
  snippet: "class A {}",
};

const eslintOver = (overrides: Partial<EslintFakeParts>): EslintPort => {
  const parts: EslintFakeParts = {
    query: IN_EFFECT_QUERY,
    lintFiles: CLEAN_LINT,
    lintSourceCases: vi
      .fn<EslintPort["lintSourceCases"]>()
      .mockResolvedValue({ outcome: "ok", value: [] }),
    ...overrides,
  };
  return {
    boundary: SILENT_BOUNDARY,
    createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(parts.query),
    ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
    ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
    createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>().mockReturnValue({
      lintFiles: parts.lintFiles,
    }),
    lintSourceCases: parts.lintSourceCases,
  };
};

type RunnerParts = {
  readonly repository: EslintRepository;
  readonly coreInstall: EslintRunnerPorts["coreInstall"];
  readonly modules: ModuleLoaderPort;
  readonly path: EslintRunnerPorts["path"];
  readonly eslint: EslintPort;
};

const runnerOver = (overrides: Partial<RunnerParts>) => {
  const parts: RunnerParts = {
    repository: repositoryHolding({}),
    coreInstall: SOURCE_INSTALL,
    modules: modulesOver(PLUGIN_MODULES),
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" }),
    eslint: eslintOver({}),
    ...overrides,
  };
  return eslintRunnerOver({
    repositoryAt: () => parts.repository,
    coreInstall: parts.coreInstall,
    modules: parts.modules,
    path: parts.path,
    eslint: parts.eslint,
  });
};

const runRequest = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly records: readonly ExceptionRecord[];
}) => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  files: FILES,
  trackedPaths: FILES,
  clauses: request.clauses,
  records: request.records,
});

const CLASS_RUN = runRequest({ clauses: [CLASS_CLAUSE], records: [] });

const trackedRun = (request: { readonly tracked: string }) => ({
  ...CLASS_RUN,
  trackedPaths: [repoPathSchema.parse(request.tracked), FILE_A, FACTORY],
});

const TWO_CLAUSE_RUN = runRequest({ clauses: [CLASS_CLAUSE, LOOPS_CLAUSE], records: [] });

const TWO_RULES_IN_EFFECT = queryOver({
  ignored: CHECKED,
  states: {
    [`src/a.ts ${RULE_ID}`]: ERROR,
    [`src/factory.ts ${RULE_ID}`]: ERROR,
    [`src/a.ts ${LOOPS_RULE_ID}`]: ERROR,
    [`src/factory.ts ${LOOPS_RULE_ID}`]: ERROR,
  },
});

const SHARED_FOR_OF_RULE_ID = "hone/no-for-of";

const SHARED_MODULE_FOR_OF_CLAUSE: RunnerClause = {
  address: FOR_OF,
  anchor: { kind: "keyword", keyword: "for" },
  pieceRoot: PIECE_ROOT,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { ...CLASS_SETTINGS, rule: "no-for-of" },
};

const SHARED_PLUGIN_MODULE = {
  default: {
    rules: {
      "no-class-authoring": { meta: { type: "problem" }, create: () => ({}) },
      "no-for-of": { meta: { type: "problem" }, create: () => ({}) },
    },
  },
};

const SHARED_MODULE_RUN = runRequest({
  clauses: [CLASS_CLAUSE, SHARED_MODULE_FOR_OF_CLAUSE],
  records: [],
});

const SHARED_MODULE_PROJECTION = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error", "hone/no-for-of": "error" },
  },
];
`;

const SHARED_MODULE_RULES_IN_EFFECT = queryOver({
  ignored: CHECKED,
  states: {
    [`src/a.ts ${RULE_ID}`]: ERROR,
    [`src/factory.ts ${RULE_ID}`]: ERROR,
    [`src/a.ts ${SHARED_FOR_OF_RULE_ID}`]: ERROR,
    [`src/factory.ts ${SHARED_FOR_OF_RULE_ID}`]: ERROR,
  },
});

const inlineMessageInA = (request: {
  readonly messageId: "inline-disable" | "inline-rule-config";
  readonly text: string;
}) =>
  lintResolving({
    outcome: "ok",
    value: linted({
      messagesInA: [
        {
          ruleId: "hone-core/inline-config",
          messageId: request.messageId,
          line: 2,
          column: 1,
          message: request.text,
        },
      ],
    }),
  });

const NOT_INCLUDED = {
  outcome: "ok",
  value: {
    hits: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [],
    unprojectedFolders: [],
    measured: [],
  },
};

const CLASS_CASE: SourceCase = {
  name: "class",
  fileName: repoPathOf("cases/class.ts"),
  source: "class A {}\n",
  expectedLines: [1],
};

const CLASS_VERDICTS: Result<readonly CaseVerdict[], RunnerFailure> = {
  outcome: "ok",
  value: [{ caseName: "class", flaggedLines: [1] }],
};

describe("eslintRunnerOver", () => {
  it("declares config-override and inline-disable as the kinds its projection carries, since a file record turns the rule off for that file", () => {
    expect(runnerOver({}).projectedKinds).toEqual(["config-override", "inline-disable"]);
  });
});

describe("the governance run, step 1: selected pieces", () => {
  it("loads the plugin module at the piece root joined with its pluginModule", async () => {
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValue({ outcome: "ok", value: CLASS_PLUGIN_MODULE });
    await runnerOver({ modules: { load } }).run(CLASS_RUN);
    expect(load.mock.calls).toEqual([[{ path: PLUGIN_MODULE_PATH }]]);
  });

  it("is piece-invalid when two selected clauses share one rule id, building no ESLint instance", async () => {
    const eslint = eslintOver({});
    const report = await runnerOver({ eslint }).run(
      runRequest({ clauses: [CLASS_CLAUSE, { ...CLASS_CLAUSE, address: FOR_OF }], records: [] }),
    );
    expect({
      report,
      queryInstances: vi.mocked(eslint.createQueryInstance).mock.calls,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
    }).toEqual({
      report: {
        outcome: "failed",
        error: { kind: "piece-invalid", pieceRoot: expect.any(String), detail: expect.any(String) },
      },
      queryInstances: [],
      governanceInstances: [],
    });
  });

  it("is piece-invalid when two pieces map one plugin namespace to different plugin modules", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({
          clauses: [
            CLASS_CLAUSE,
            {
              ...LOOPS_CLAUSE,
              settings: {
                pluginNamespace: "hone",
                pluginModule: "loops/loops.eslint-plugin.ts",
                rule: "no-for-of",
              },
            },
          ],
          records: [],
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "piece-invalid" } });
  });

  it("is piece-invalid naming the piece root when the plugin module cannot be loaded", async () => {
    await expect(runnerOver({ modules: UNLOADABLE_MODULES }).run(CLASS_RUN)).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("is piece-invalid when the plugin module has no default export of rules", async () => {
    await expect(
      runnerOver({ modules: modulesOver({ [PLUGIN_MODULE_PATH]: { rules: {} } }) }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("is piece-invalid when the clause's rule is not a key of the plugin's rules", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({
          clauses: [{ ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, rule: "no-classes" } }],
          records: [],
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("loads and parses a plugin module shared by two selected clauses once, selecting both clauses", async () => {
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValue({ outcome: "ok", value: SHARED_PLUGIN_MODULE });
    const report = await runnerOver({
      repository: projectionHolding({ text: SHARED_MODULE_PROJECTION }),
      modules: { load },
      eslint: eslintOver({
        query: SHARED_MODULE_RULES_IN_EFFECT,
        lintFiles: lintResolving({
          outcome: "ok",
          value: linted({ messagesInA: [CLASS_MESSAGE] }),
        }),
      }),
    }).run(SHARED_MODULE_RUN);
    expect({ loads: load.mock.calls, report }).toEqual({
      loads: [[{ path: PLUGIN_MODULE_PATH }]],
      report: {
        outcome: "ok",
        value: {
          hits: [HIT_IN_A],
          nativeExceptions: [],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS_AND_FOR_OF,
        },
      },
    });
  });

  it("is piece-invalid naming the piece root of the clause whose rule a shared plugin module lacks", async () => {
    await expect(
      runnerOver({ modules: modulesOver({ [PLUGIN_MODULE_PATH]: CLASS_PLUGIN_MODULE }) }).run(
        SHARED_MODULE_RUN,
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: PIECE_ROOT,
        detail: "the plugin has no rule named no-for-of",
      },
    });
  });
});

const FILE_IGNORED_WARNING: LintedMessage = {
  ruleId: null,
  line: 0,
  column: 0,
  message: "File ignored because of a matching ignore pattern.",
};

describe("the governance run, the clauses it measured on each file", () => {
  it("names each selected clause as measured on each file the governance lint returned", async () => {
    await expect(runnerOver({}).run(CLASS_RUN)).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("names no clause measured on a file the governance lint returned with a message from no rule, as ESLint's file-ignored warning is", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [FILE_IGNORED_WARNING] }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: [{ clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" }],
      },
    });
  });

  it("names no clause measured on a file the governance lint did not return", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: [{ filePath: "/repo/src/factory.ts", messages: [] }],
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: [{ clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" }],
      },
    });
  });
});

describe("the governance run, step 2: the projection's presence and bytes", () => {
  it("is missing with no hits and no native exceptions when disciplines.eslint.mjs is absent, building no ESLint instance", async () => {
    const eslint = eslintOver({
      lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }),
    });
    const report = await runnerOver({
      repository: repositoryHolding({ projectionFiles: rootHolding(ABSENT_PROJECTION) }),
      eslint,
    }).run(CLASS_RUN);
    expect({
      report,
      queryInstances: vi.mocked(eslint.createQueryInstance).mock.calls,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
    }).toEqual({
      report: {
        outcome: "ok",
        value: { hits: [], nativeExceptions: [], projection: "missing", slices: [], measured: [] },
      },
      queryInstances: [],
      governanceInstances: [],
    });
  });

  it("is out-of-date for a hand-edited projection and still reports the run's hits", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: `// hand edited\n${ENABLING_PROJECTION}` }),
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [CLASS_MESSAGE] }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [HIT_IN_A],
        nativeExceptions: [],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("is out-of-date when the projection lacks the block of a record the run was given", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "out-of-date" } });
  });

  it("reads the projection at disciplines.eslint.mjs, passing on that it cannot be read", async () => {
    const projectionFiles = projectionFilesAnswering(unreadableProjection(PROJECTION_FILE));
    const report = await runnerOver({ repository: repositoryHolding({ projectionFiles }) }).run(
      CLASS_RUN,
    );
    expect(report).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
    });
    expect(projectionFiles.currentOf).toHaveBeenCalledExactlyOnceWith({ files: [PROJECTION_FILE] });
  });
});

const FIXTURE_B = repoPathOf("fixtures/bad/b.ts");
const FIXTURE_C = repoPathOf("fixtures/bad/c.ts");

const ROOT_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/eslint.config.mjs" };
const BROKEN_FIXTURE_CONFIG: ConfigFileSearch = {
  kind: "found",
  path: "/repo/fixtures/bad/eslint.config.mjs",
};

const FILE_CHECKED: Result<IgnoredState, RunnerFailure> = { outcome: "ok", value: "checked" };
const FILE_IGNORED: Result<IgnoredState, RunnerFailure> = { outcome: "ok", value: "ignored" };
const CONFIG_UNLOADABLE: Result<IgnoredState, RunnerFailure> = {
  outcome: "failed",
  error: { kind: "team-config-unloadable", detail: UNEXPECTED_TOKEN },
};

const lookupQuery = (request: {
  readonly ignored: Readonly<Record<string, Result<IgnoredState, RunnerFailure>>>;
  readonly configs: Readonly<Record<string, ConfigFileSearch>>;
}): QueryInstance => ({
  ignoredState: ({ file }) => Promise.resolve(request.ignored[file]),
  ruleState: () => Promise.resolve({ outcome: "ok", value: ERROR }),
  configFileOf: ({ file }) => Promise.resolve(request.configs[file]),
});

const eslintAsking = (request: {
  readonly query: QueryInstance;
  readonly ignoredByConfig: EslintPort["ignoredByConfig"];
}): EslintPort => ({
  ...eslintOver({
    query: request.query,
    lintFiles: lintResolving({
      outcome: "ok",
      value: [{ filePath: "/repo/src/a.ts", messages: [] }],
    }),
  }),
  ignoredByConfig: request.ignoredByConfig,
});

const runOver = (request: { readonly files: readonly RepoPath[] }) => ({
  ...CLASS_RUN,
  files: request.files,
  trackedPaths: request.files,
});

const FIXTURE_RUN = runOver({ files: [FILE_A, FIXTURE_B] });

const TEAM_WITH_BROKEN_FIXTURE = lookupQuery({
  ignored: {
    "src/a.ts": FILE_CHECKED,
    "fixtures/bad/b.ts": CONFIG_UNLOADABLE,
    "fixtures/bad/c.ts": CONFIG_UNLOADABLE,
  },
  configs: {
    "fixtures/bad/b.ts": BROKEN_FIXTURE_CONFIG,
    "fixtures/bad/c.ts": BROKEN_FIXTURE_CONFIG,
    "fixtures/bad": ROOT_CONFIG,
  },
});

const ROOT_ASKED = { configFile: "/repo/eslint.config.mjs", cwd: "/repo" };

describe("the governance run, step 3: a broken nested ESLint config in a folder the root config ignores", () => {
  it("reports the file as an ignore native exception, the way the team's ESLint never loads that config", async () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_IGNORED);
    const report = await runnerOver({
      eslint: eslintAsking({ query: TEAM_WITH_BROKEN_FIXTURE, ignoredByConfig }),
    }).run(FIXTURE_RUN);
    expect({ report, asked: ignoredByConfig.mock.calls }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "fixtures/bad/b.ts" },
          ],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS_IN_A,
        },
      },
      asked: [
        [{ ...ROOT_ASKED, path: "fixtures/bad/hone-folder-probe" }],
        [{ ...ROOT_ASKED, path: "fixtures/bad/b.ts" }],
      ],
    });
  });

  it("asks the root config about the broken config's folder once for every file under it", async () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_IGNORED);
    await runnerOver({
      eslint: eslintAsking({ query: TEAM_WITH_BROKEN_FIXTURE, ignoredByConfig }),
    }).run(runOver({ files: [FILE_A, FIXTURE_B, FIXTURE_C] }));
    expect(ignoredByConfig.mock.calls).toEqual([
      [{ ...ROOT_ASKED, path: "fixtures/bad/hone-folder-probe" }],
      [{ ...ROOT_ASKED, path: "fixtures/bad/b.ts" }],
      [{ ...ROOT_ASKED, path: "fixtures/bad/c.ts" }],
    ]);
  });
});

describe("the governance run, step 3: a broken ESLint config the team's ESLint does load", () => {
  it("stays team-config-unloadable, asking for the fix first, when the root config does not ignore the folder", async () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_CHECKED);
    await expect(
      runnerOver({
        eslint: eslintAsking({ query: TEAM_WITH_BROKEN_FIXTURE, ignoredByConfig }),
      }).run(FIXTURE_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "fixtures/bad/eslint.config.mjs, the ESLint config for fixtures/bad/b.ts, failed to load: Unexpected token ';'. Fix that config. Only if fixtures/bad holds nothing Hone should check, add it to exclude in disciplines.json instead.",
      },
    });
  });

  it("asks no governing config when the config that failed to load is the repository root's", async () => {
    const team: QueryInstance = {
      ...lookupQuery({
        ignored: { "src/a.ts": CONFIG_UNLOADABLE, "src/factory.ts": CONFIG_UNLOADABLE },
        configs: {},
      }),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>().mockResolvedValue(ROOT_CONFIG),
    };
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>();
    await runnerOver({ eslint: eslintAsking({ query: team, ignoredByConfig }) }).run(CLASS_RUN);
    expect({
      asked: ignoredByConfig.mock.calls,
      lookups: vi.mocked(team.configFileOf).mock.calls,
    }).toEqual({
      asked: [],
      lookups: [[{ file: "src/a.ts" }], [{ file: "src/factory.ts" }]],
    });
  });
});
describe("the governance run, step 3: the projection in effect", () => {
  it("builds the query instance on the repository root", async () => {
    const eslint = eslintOver({});
    await runnerOver({ eslint }).run(CLASS_RUN);
    expect(vi.mocked(eslint.createQueryInstance).mock.calls).toEqual([[{ repoRoot: "/repo" }]]);
  });

  it("names the file whose ESLint config failed to load when ESLint cannot say which config it was", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: configFailingQuery({ search: CONFIG_UNKNOWN, detail: UNEXPECTED_TOKEN }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "the ESLint config for src/a.ts failed to load: Unexpected token ';'. Fix that config.",
      },
    });
  });

  it("leads with fixing a nested ESLint config that failed to load, and offers exclude only for a folder holding nothing Hone should check", async () => {
    const query = configFailingQuery({
      search: { kind: "found", path: "/repo/fixtures/broken/eslint.config.mjs" },
      detail: UNEXPECTED_TOKEN,
    });
    await expect(runnerOver({ eslint: eslintOver({ query }) }).run(CLASS_RUN)).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "fixtures/broken/eslint.config.mjs, the ESLint config for src/a.ts, failed to load: Unexpected token ';'. Fix that config. Only if fixtures/broken holds nothing Hone should check, add it to exclude in disciplines.json instead.",
      },
    });
    expect(query.configFileOf).toHaveBeenCalledWith({ file: "src/a.ts" });
  });

  it("asks only for a fix when the config that failed to load is the repository root's", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: configFailingQuery({
            search: { kind: "found", path: "/repo/eslint.config.mjs" },
            detail: UNEXPECTED_TOKEN,
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "eslint.config.mjs, the ESLint config for src/a.ts, failed to load: Unexpected token ';'. Fix that config.",
      },
    });
  });

  it("does not repeat the full stop of an ESLint message that ends in one", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: configFailingQuery({
            search: { kind: "found", path: "/repo/eslint.config.mjs" },
            detail: "Config file is not an array.",
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "eslint.config.mjs, the ESLint config for src/a.ts, failed to load: Config file is not an array. Fix that config.",
      },
    });
  });

  it("asks for a config that spreads the projection when no ESLint config applies to the file at all", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: configFailingQuery({
            search: { kind: "none" },
            detail: "Could not find config file.",
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "no eslint.config.* applies to src/a.ts. Create one at the repository root that spreads disciplines.eslint.mjs last, as ADOPTING.md step 4a shows.",
      },
    });
  });
  it("passes plugin-conflict through from the query instance", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: failingQuery({ kind: "plugin-conflict", detail: 'Cannot redefine plugin "hone"' }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "plugin-conflict", detail: 'Cannot redefine plugin "hone"' },
    });
  });

  it("passes runner-invalid-output through for a resolved configuration the query refuses", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: failingQuery({ kind: "runner-invalid-output", detail: "rules: expected array" }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "rules: expected array" },
    });
  });

  it("is not-included with no hits and no native exceptions when the selected rule is absent on every checked file", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ABSENT, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [CLASS_MESSAGE] }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction one with the selected rule at severity 0 everywhere and no records", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: OFF, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("holds direction one when the selected rule is configured on one checked file only", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included when the selected rule is configured only where every file is ignored or the rule absent", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "ignored", "src/factory.ts": "checked" },
            states: { [`src/a.ts ${RULE_ID}`]: IGNORED, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("is not-included when a later team block sets an authorised location's file back to error", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [CLASS_MESSAGE] }),
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction two when the authorised location's file is at severity 0", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included when a file carve-out's file is not at severity 0", async () => {
    await expect(
      runnerOver({}).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_CARVE_OUT] })),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction two for a clause-wide carve-out at severity 0 on every checked file", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: CLAUSE_WIDE_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: OFF, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [CLAUSE_WIDE] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included for a clause-wide carve-out when one checked file is at severity 2", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: CLAUSE_WIDE_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: OFF, [`src/factory.ts ${RULE_ID}`]: ERROR },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [CLAUSE_WIDE] })),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("does not check a record whose file is not among the files under check", async () => {
    await expect(
      runnerOver({ repository: projectionHolding({ text: GONE_LOCATION_PROJECTION }) }).run(
        runRequest({ clauses: [CLASS_CLAUSE], records: [GONE_LOCATION] }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });
});

describe("the governance run, step 4: the governance instance", () => {
  it("builds one governance instance on the repository root with the parsed plugin under its namespace and the selected rule ids", async () => {
    const eslint = eslintOver({});
    await runnerOver({ eslint }).run(CLASS_RUN);
    expect(vi.mocked(eslint.createGovernanceInstance).mock.calls).toEqual([
      [
        {
          repoRoot: "/repo",
          plugins: {
            hone: expect.objectContaining({
              rules: expect.objectContaining({ "no-class-authoring": expect.anything() }),
            }),
          },
          rules: [{ ruleId: RULE_ID, options: [] }],
        },
      ],
    ]);
  });

  it("hands the governance instance each selected rule with the options its piece settings declare", async () => {
    const eslint = eslintOver({});
    await runnerOver({ eslint }).run(
      runRequest({
        clauses: [{ ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, options: [{ max: 2 }] } }],
        records: [],
      }),
    );
    expect(vi.mocked(eslint.createGovernanceInstance).mock.calls).toEqual([
      [expect.objectContaining({ rules: [{ ruleId: RULE_ID, options: [{ max: 2 }] }] })],
    ]);
  });

  it("lints every path in files once", async () => {
    const lintFiles = lintResolving({ outcome: "ok", value: linted({ messagesInA: [] }) });
    await runnerOver({ eslint: eslintOver({ lintFiles }) }).run(CLASS_RUN);
    expect(lintFiles.mock.calls).toEqual([[{ files: ["src/a.ts", "src/factory.ts"] }]]);
  });

  it("passes tool-failed through from the lint", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "failed",
            error: { kind: "tool-failed", detail: "visitor is not a function" },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "visitor is not a function" },
    });
  });
});

describe("the governance run, step 5: messages", () => {
  it("reports a selected rule's message as a hit on the file's repo path at its line and column minus one", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [CLASS_MESSAGE] }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [HIT_IN_A],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("maps each message back to its clause by rule id across two pieces", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          projectionFiles: rootHolding(present("export default [];\n")),
          sourceLines: vi
            .fn<EslintRepository["sourceLines"]>()
            .mockReturnValue(LINES_OF_BOTH_PIECES),
        }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: {
              [`src/a.ts ${RULE_ID}`]: ERROR,
              [`src/factory.ts ${RULE_ID}`]: ERROR,
              [`src/a.ts ${LOOPS_RULE_ID}`]: ERROR,
              [`src/factory.ts ${LOOPS_RULE_ID}`]: ERROR,
            },
          }),
          lintFiles: lintResolving({
            outcome: "ok",
            value: [
              { filePath: "/repo/src/a.ts", messages: [CLASS_MESSAGE] },
              {
                filePath: "/repo/src/factory.ts",
                messages: [{ ruleId: LOOPS_RULE_ID, line: 5, column: 1, message: "for-of loop" }],
              },
            ],
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE, LOOPS_CLAUSE], records: [] })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [
          HIT_IN_A,
          {
            clause: FOR_OF_OBJECT,
            file: "src/factory.ts",
            anchor: { line: 5, column: 0 },
            snippet: "xs.forEach(visit);",
          },
        ],
        nativeExceptions: [],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_AND_FOR_OF,
      },
    });
  });

  it("reports no hit for a message of a rule no clause selected", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [{ ruleId: "no-console", line: 2, column: 1, message: "console" }],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("is file-unparseable for a file ESLint could not parse", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: null,
                  line: 1,
                  column: 7,
                  message: "Parsing error: '{' expected.",
                  fatal: true,
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "file-unparseable",
        file: "src/a.ts",
        detail: expect.stringContaining("Parsing error"),
      },
    });
  });

  it("cuts each hit's snippet from its own line of the file's source", async () => {
    const sourceLines = vi
      .fn<EslintRepository["sourceLines"]>()
      .mockReturnValue({ outcome: "ok", value: ["first;", "  second;", "    third;", ""] });
    const report = await runnerOver({
      repository: repositoryHolding({ sourceLines }),
      eslint: eslintOver({
        lintFiles: lintResolving({
          outcome: "ok",
          value: linted({
            messagesInA: [
              { ...CLASS_MESSAGE, line: 1 },
              { ...CLASS_MESSAGE, line: 2 },
              { ...CLASS_MESSAGE, line: 3 },
            ],
          }),
        }),
      }),
    }).run(CLASS_RUN);
    expect({ report, read: sourceLines.mock.calls }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [
            { ...HIT_IN_A, anchor: { line: 1, column: 2 }, snippet: "first;" },
            { ...HIT_IN_A, anchor: { line: 2, column: 2 }, snippet: "second;" },
            { ...HIT_IN_A, anchor: { line: 3, column: 2 }, snippet: "third;" },
          ],
          nativeExceptions: [],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS,
        },
      },
      read: [[{ file: "src/a.ts" }]],
    });
  });

  it("starts the snippet of a line longer than the snippet limit at the finding's column, so a bundled line shows the flagged code, marked as cut at its start", async () => {
    const report = await runnerOver({
      repository: repositoryHolding({
        sourceLines: vi
          .fn<EslintRepository["sourceLines"]>()
          .mockReturnValue({ outcome: "ok", value: [`  ${LIMIT_LONG_LINE}class Flagged {}`, ""] }),
      }),
      eslint: eslintOver({
        lintFiles: lintResolving({
          outcome: "ok",
          value: linted({ messagesInA: [{ ...CLASS_MESSAGE, line: 1, column: 203 }] }),
        }),
      }),
    }).run(CLASS_RUN);
    expect(report).toEqual({
      outcome: "ok",
      value: {
        hits: [{ ...HIT_IN_A, anchor: { line: 1, column: 202 }, snippet: "…class Flagged {}" }],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("passes on that a linted source file with a hit cannot be read", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          sourceLines: vi.fn<EslintRepository["sourceLines"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "file-unreadable", file: FILE_A, detail: "EACCES" },
          }),
        }),
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [CLASS_MESSAGE, CLASS_MESSAGE] }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "src/a.ts", detail: "EACCES" },
    });
  });

  it("reports an inline-disable message as an inline-disable native exception for the clause", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "hone-core/inline-config",
                  messageId: "inline-disable",
                  line: 4,
                  column: 1,
                  message: "// eslint-disable-next-line hone/no-class-authoring",
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 4,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            reach: "one-clause",
          },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("reports an inline-rule-config message as an inline-rule-config native exception for the clause", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "hone-core/inline-config",
                  messageId: "inline-rule-config",
                  line: 1,
                  column: 1,
                  message: '/* eslint hone/no-class-authoring: "off" */',
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 1,
            text: '/* eslint hone/no-class-authoring: "off" */',
          },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("is tool-failed naming the file for an inline-config-unreadable message", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "hone-core/inline-config",
                  messageId: "inline-config-unreadable",
                  line: 1,
                  column: 1,
                  message: "inline configuration comments could not be read",
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining("src/a.ts") },
    });
  });
});

describe("conform", () => {
  it("lints the cases in the piece root with the piece's parsed plugin, namespace and rule, and returns their verdicts", async () => {
    const lintSourceCases = vi
      .fn<EslintPort["lintSourceCases"]>()
      .mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({ eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: CLASS_CLAUSE,
      cases: [CLASS_CASE],
    });
    expect({ verdicts, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: CLASS_VERDICTS,
      lints: [
        [
          expect.objectContaining({
            cwd: PIECE_ROOT,
            plugin: expect.objectContaining({
              rules: expect.objectContaining({ "no-class-authoring": expect.anything() }),
            }),
            pluginNamespace: "hone",
            rule: "no-class-authoring",
            cases: [CLASS_CASE],
          }),
        ],
      ],
    });
  });

  it("lints the cases with the options the piece settings declare", async () => {
    const lintSourceCases = vi
      .fn<EslintPort["lintSourceCases"]>()
      .mockResolvedValue(CLASS_VERDICTS);
    await runnerOver({ eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: { ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, options: ["always"] } },
      cases: [CLASS_CASE],
    });
    expect(lintSourceCases.mock.calls).toEqual([
      [expect.objectContaining({ options: ["always"] })],
    ]);
  });

  it("passes runner-invalid-output naming a case through from the case lint", async () => {
    const failure: Result<readonly CaseVerdict[], RunnerFailure> = {
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "case class: Parsing error: '{' expected." },
    };
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(failure),
        }),
      }).conform({ clause: CLASS_CLAUSE, cases: [CLASS_CASE] }),
    ).resolves.toEqual(failure);
  });

  it("is piece-invalid without linting when the plugin module cannot be loaded", async () => {
    const lintSourceCases = vi
      .fn<EslintPort["lintSourceCases"]>()
      .mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({
      modules: UNLOADABLE_MODULES,
      eslint: eslintOver({ lintSourceCases }),
    }).conform({
      clause: CLASS_CLAUSE,
      cases: [CLASS_CASE],
    });
    expect({ verdicts, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: {
        outcome: "failed",
        error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
      },
      lints: [],
    });
  });

  it("is piece-invalid without linting when the clause's rule is not in the plugin", async () => {
    const lintSourceCases = vi
      .fn<EslintPort["lintSourceCases"]>()
      .mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({ eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: { ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, rule: "no-classes" } },
      cases: [CLASS_CASE],
    });
    expect({ verdicts, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: {
        outcome: "failed",
        error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
      },
      lints: [],
    });
  });
});

const projectRequest = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
}) => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  trackedPaths: request.trackedPaths,
  clauses: [CLASS_CLAUSE],
  records: request.records,
});

describe("project", () => {
  it("writes the projection generated from the clauses and records to disciplines.eslint.mjs at the repository root", async () => {
    const projectionFiles = rootHolding(ABSENT_PROJECTION);
    const write = await runnerOver({ repository: repositoryHolding({ projectionFiles }) }).project(
      projectRequest({ trackedPaths: [], records: [FACTORY_LOCATION] }),
    );
    expect({ write, fileWrites: projectionFiles.writeAt.mock.calls }).toEqual({
      write: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      fileWrites: [[{ file: PROJECTION_FILE, text: FACTORY_LOCATION_PROJECTION }]],
    });
  });

  it("imports a shipped piece of a packaged core install by the package name the core install gives", async () => {
    const projectionFiles = rootHolding(ABSENT_PROJECTION);
    const coreInstall = vi.fn<EslintRunnerPorts["coreInstall"]>().mockReturnValue({
      outcome: "ok",
      value: { form: "package", root: INSTALL_ROOT, name: "@hailstails/hone" },
    });
    await runnerOver({ repository: repositoryHolding({ projectionFiles }), coreInstall }).project(
      projectRequest({ trackedPaths: [], records: [] }),
    );
    expect({
      asked: coreInstall.mock.calls,
      fileWrites: projectionFiles.writeAt.mock.calls,
    }).toEqual({
      asked: [[{ installRoot: INSTALL_ROOT }]],
      fileWrites: [[{ file: PROJECTION_FILE, text: PACKAGED_ENABLING_PROJECTION }]],
    });
  });

  it("passes on that the core install cannot be named, writing nothing", async () => {
    const projectionFiles = rootHolding(ABSENT_PROJECTION);
    const failure: Result<never, RunnerFailure> = {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail:
          "the core install's /repo/node_modules/@hailstails/hone/package.json names no package",
      },
    };
    const write = await runnerOver({
      repository: repositoryHolding({ projectionFiles }),
      coreInstall: vi.fn<EslintRunnerPorts["coreInstall"]>().mockReturnValue(failure),
    }).project(projectRequest({ trackedPaths: [], records: [] }));
    expect({ write, fileWrites: projectionFiles.writeAt.mock.calls }).toEqual({
      write: failure,
      fileWrites: [],
    });
  });
});

describe("native exceptions: ignores and configuration overrides over files", () => {
  it("reports an ignored file as one ignore per selected clause", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "checked", "src/factory.ts": "ignored" },
            states: {
              [`src/a.ts ${RULE_ID}`]: ERROR,
              [`src/factory.ts ${RULE_ID}`]: IGNORED,
              [`src/a.ts ${LOOPS_RULE_ID}`]: ERROR,
              [`src/factory.ts ${LOOPS_RULE_ID}`]: IGNORED,
            },
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
          { kind: "ignore", clause: FOR_OF_OBJECT, file: "src/factory.ts" },
        ],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_AND_FOR_OF,
      },
    });
  });

  it("reports a checked file where the selected rule is absent as a config-override", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("reports a checked file where the selected rule is a warning as a config-override", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: {
              [`src/a.ts ${RULE_ID}`]: ERROR,
              [`src/factory.ts ${RULE_ID}`]: { state: "configured", severity: 1, options: [] },
            },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("reports no config-override on a file a record projects off, since that off is the projection's own", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("reports a config-override on a file no record holds, beside a file a record projects off", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: {
              [`src/a.ts ${RULE_ID}`]: { state: "configured", severity: 1, options: [] },
              [`src/factory.ts ${RULE_ID}`]: OFF,
            },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });
});

describe("native exceptions: suppression files over tracked paths", () => {
  it("reports an entry for a selected rule in the root eslint-suppressions.json", async () => {
    const suppressionsAt = suppressionsAnswering({
      "src/a.ts": { "hone/no-class-authoring": { count: 1 } },
    });
    const report = await runnerOver({ repository: repositoryHolding({ suppressionsAt }) }).run(
      trackedRun({ tracked: "eslint-suppressions.json" }),
    );
    expect({ report, read: suppressionsAt.mock.calls }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX_OBJECT,
              file: "src/a.ts",
              location: "eslint-suppressions.json",
            },
          ],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS,
        },
      },
      read: [[{ location: "eslint-suppressions.json" }]],
    });
  });

  it("resolves a nested eslint-suppressions.json's keys against its own directory", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          suppressionsAt: suppressionsAnswering({
            "src/x.ts": { "hone/no-class-authoring": { count: 2 } },
          }),
        }),
      }).run(trackedRun({ tracked: "packages/a/eslint-suppressions.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX_OBJECT,
            file: "packages/a/src/x.ts",
            location: "packages/a/eslint-suppressions.json",
          },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("passes on a suppressions file that cannot be read as suppressions", async () => {
    const failure: Result<never, RunnerFailure> = {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: "eslint-suppressions.json: Unexpected end of JSON input",
      },
    };
    await expect(
      runnerOver({
        repository: repositoryHolding({
          suppressionsAt: vi.fn<EslintRepository["suppressionsAt"]>().mockReturnValue(failure),
        }),
      }).run(trackedRun({ tracked: "eslint-suppressions.json" })),
    ).resolves.toEqual(failure);
  });
});

describe("native exceptions: package.json scripts over tracked paths", () => {
  it("reports a dormant --rule in a lint script as a command-line-option at the declaring package.json", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          packageScriptsAt: scriptsAnswering({
            lint: "eslint --rule 'hone/no-class-authoring: off' src",
          }),
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX_OBJECT,
            location: "package.json",
            script: "lint",
            option: "--rule hone/no-class-authoring: off",
            cause: { kind: "weakens-run" },
          },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("reads a script's --suppressions-location file and reports its entries at that location", async () => {
    const packageScriptsAt = scriptsAnswering({
      lint: "eslint --suppressions-location ci/lint-suppressions.json src",
    });
    const suppressionsAt = suppressionsAnswering({
      "src/a.ts": { "hone/no-class-authoring": { count: 1 } },
    });
    const report = await runnerOver({
      repository: repositoryHolding({ packageScriptsAt, suppressionsAt }),
    }).run(trackedRun({ tracked: "package.json" }));
    expect({
      report,
      scripts: packageScriptsAt.mock.calls,
      suppressions: suppressionsAt.mock.calls,
    }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX_OBJECT,
              file: "src/a.ts",
              location: "ci/lint-suppressions.json",
            },
          ],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS,
        },
      },
      scripts: [[{ packagePath: "package.json" }]],
      suppressions: [[{ location: "ci/lint-suppressions.json" }]],
    });
  });

  it("resolves a nested package.json's suppressions location and its keys against that package's directory", async () => {
    const suppressionsAt = suppressionsAnswering({
      "src/x.ts": { "hone/no-class-authoring": { count: 1 } },
    });
    const report = await runnerOver({
      repository: repositoryHolding({
        packageScriptsAt: scriptsAnswering({
          lint: "eslint --suppressions-location=ci/s.json src",
        }),
        suppressionsAt,
      }),
    }).run(trackedRun({ tracked: "packages/a/package.json" }));
    expect({ report, suppressions: suppressionsAt.mock.calls }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX_OBJECT,
              file: "packages/a/src/x.ts",
              location: "packages/a/ci/s.json",
            },
          ],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS,
        },
      },
      suppressions: [[{ location: "packages/a/ci/s.json" }]],
    });
  });

  it("reports a script naming eslint whose quotes do not pair as an unreadable command-line-option, and passes over one that names no eslint", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          packageScriptsAt: scriptsAnswering({ say: "echo don't stop", lint: "eslint 'src" }),
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX_OBJECT,
            location: "package.json",
            script: "lint",
            option: "eslint 'src",
            cause: { kind: "unreadable", command: "eslint" },
          },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });

  it("passes on that a tracked package.json cannot be read", async () => {
    const failure: Result<never, RunnerFailure> = {
      outcome: "failed",
      error: { kind: "file-unreadable", file: repoPathOf("package.json"), detail: "EACCES" },
    };
    await expect(
      runnerOver({
        repository: repositoryHolding({
          packageScriptsAt: vi.fn<EslintRepository["packageScriptsAt"]>().mockReturnValue(failure),
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual(failure);
  });

  it("reads no tracked path whose name only ends in package.json", async () => {
    const packageScriptsAt = vi.fn<EslintRepository["packageScriptsAt"]>();
    const report = await runnerOver({ repository: repositoryHolding({ packageScriptsAt }) }).run(
      trackedRun({ tracked: "docs/my-package.json" }),
    );
    expect({ report, read: packageScriptsAt.mock.calls }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: MEASURED_CLASS,
        },
      },
      read: [],
    });
  });
});

const ESLINT_IGNORING_NOTHING: EslintPort = {
  ...eslintOver({}),
  ignoredByPatterns: vi
    .fn<EslintPort["ignoredByPatterns"]>()
    .mockResolvedValue({ outcome: "ok", value: ["checked", "checked"] }),
};

describe("native exceptions: lint-script options whose effect the script's own folder does not settle", () => {
  it.each([
    {
      location: "package.json",
      script: "cd src && eslint --ignore-pattern 'legacy/**' .",
      option: "--ignore-pattern legacy/**",
    },
    {
      location: "package.json",
      script: 'eslint --ignore-pattern "$LEGACY" .',
      option: "--ignore-pattern $LEGACY",
    },
    {
      location: "tools/package.json",
      script: "cd .. && eslint --ignore-pattern 'src/legacy/**' .",
      option: "--ignore-pattern src/legacy/**",
    },
    {
      location: "tools/package.json",
      script: "eslint -c weak.config.mjs ..",
      option: "-c weak.config.mjs",
    },
    {
      location: "package.json",
      script: "(cd src && eslint --ignore-pattern 'legacy/**' .)",
      option: "--ignore-pattern legacy/**",
    },
    {
      location: "package.json",
      script: "env --chdir=src eslint --ignore-pattern 'legacy/**' .",
      option: "--ignore-pattern legacy/**",
    },
  ])(
    "reports $option in $location's script $script as weakening the run",
    async ({ location, script, option }) => {
      await expect(
        runnerOver({
          eslint: ESLINT_IGNORING_NOTHING,
          repository: repositoryHolding({ packageScriptsAt: scriptsAnswering({ lint: script }) }),
        }).run(trackedRun({ tracked: location })),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          nativeExceptions: [
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX_OBJECT,
              location,
              script: "lint",
              option,
            },
          ],
        },
      });
    },
  );
});

describe("native exceptions: why a lint-script option is reported", () => {
  it.each([
    {
      script: "tsc && TIMING=1 eslint -c eslint.config.mjs .",
      option: "-c eslint.config.mjs",
      cause: {
        kind: "after-another-command",
        command: "eslint",
        invocation: "TIMING=1 eslint -c eslint.config.mjs .",
      },
    },
    {
      script: "env --chdir=src eslint --ignore-pattern 'legacy/**' .",
      option: "--ignore-pattern legacy/**",
      cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
    },
    {
      script: "tsc && eslint --rule 'hone/no-class-authoring: off' .",
      option: "--rule hone/no-class-authoring: off",
      cause: { kind: "weakens-run" },
    },
    {
      script: 'eslint --ignore-pattern "$LEGACY" .',
      option: "--ignore-pattern $LEGACY",
      cause: { kind: "weakens-run" },
    },
  ])(
    "reports $option in $script with the cause the report names",
    async ({ script, option, cause }) => {
      await expect(
        runnerOver({
          eslint: ESLINT_IGNORING_NOTHING,
          repository: repositoryHolding({ packageScriptsAt: scriptsAnswering({ lint: script }) }),
        }).run(trackedRun({ tracked: "package.json" })),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          nativeExceptions: [
            {
              kind: "command-line-option",
              location: "package.json",
              script: "lint",
              option,
              cause,
            },
          ],
        },
      });
    },
  );
});

describe("native exceptions: lint-script options a plain invocation settles", () => {
  it.each([
    "eslint --ignore-pattern dist --cache .",
    "pnpm exec eslint --ignore-pattern dist --cache .",
    "npx eslint --ignore-pattern dist --cache .",
    "cross-env NODE_OPTIONS=--max-old-space-size=4096 eslint --ignore-pattern dist --cache .",
  ])("reports nothing for %s when the pattern ignores no checked file", async (script) => {
    await expect(
      runnerOver({
        eslint: ESLINT_IGNORING_NOTHING,
        repository: repositoryHolding({ packageScriptsAt: scriptsAnswering({ lint: script }) }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toMatchObject({ outcome: "ok", value: { nativeExceptions: [] } });
  });
});

describe("native exceptions: inline directives with several selected clauses", () => {
  it("reports a disable naming one selected rule for that rule's clause only", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-disable",
            text: "// eslint-disable-next-line hone/no-class-authoring",
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            reach: "one-clause",
          },
        ],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_AND_FOR_OF,
      },
    });
  });

  it("reports a disable naming both selected rules once for each clause", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-disable",
            text: "/* eslint-disable hone/no-class-authoring, loops/no-for-of */",
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable hone/no-class-authoring, loops/no-for-of */",
            reach: "one-clause",
          },
          {
            kind: "inline-disable",
            clause: FOR_OF_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable hone/no-class-authoring, loops/no-for-of */",
            reach: "one-clause",
          },
        ],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_AND_FOR_OF,
      },
    });
  });

  it("reports a disable naming no rule once for every selected clause", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-disable",
            text: "/* eslint-disable */",
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable */",
            reach: "every-selected-clause",
          },
          {
            kind: "inline-disable",
            clause: FOR_OF_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable */",
            reach: "every-selected-clause",
          },
        ],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_AND_FOR_OF,
      },
    });
  });

  it("reports a rule configuration naming one selected rule for that rule's clause only", async () => {
    await expect(
      runnerOver({
        repository: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-rule-config",
            text: '/* eslint loops/no-for-of: "off" */',
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            clause: FOR_OF_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: '/* eslint loops/no-for-of: "off" */',
          },
        ],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_AND_FOR_OF,
      },
    });
  });
});

describe("the governance run, settled message handling", () => {
  it("orders native exceptions as ignores, overrides, inline directives, suppression entries, then script options", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          packageScriptsAt: scriptsAnswering({
            lint: "eslint --rule 'hone/no-class-authoring: off' src",
          }),
          suppressionsAt: suppressionsAnswering({
            "src/a.ts": { "hone/no-class-authoring": { count: 1 } },
          }),
        }),
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "checked", "src/factory.ts": "ignored" },
            states: {
              [`src/a.ts ${RULE_ID}`]: { state: "configured", severity: 1, options: [] },
              [`src/factory.ts ${RULE_ID}`]: IGNORED,
            },
          }),
          lintFiles: inlineMessageInA({
            messageId: "inline-disable",
            text: "/* eslint-disable */",
          }),
        }),
      }).run({
        ...CLASS_RUN,
        trackedPaths: [
          repoPathOf("package.json"),
          repoPathOf("eslint-suppressions.json"),
          FILE_A,
          FACTORY,
        ],
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
          { kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable */",
            reach: "every-selected-clause",
          },
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            location: "eslint-suppressions.json",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX_OBJECT,
            location: "package.json",
            script: "lint",
            option: "--rule hone/no-class-authoring: off",
            cause: { kind: "weakens-run" },
          },
        ],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS,
      },
    });
  });
});

describe("the governance run with nothing to lint", () => {
  it("skips the governance lint when no TypeScript file is under check, still scanning tracked paths", async () => {
    const lintFiles = lintResolving({
      outcome: "failed",
      error: { kind: "tool-failed", detail: 'No files matching the pattern "." were found.' },
    });
    const eslint = eslintOver({ lintFiles });
    const report = await runnerOver({
      repository: repositoryHolding({
        packageScriptsAt: scriptsAnswering({
          lint: "eslint --rule 'hone/no-class-authoring: off' src",
        }),
      }),
      eslint,
    }).run({ ...CLASS_RUN, files: [], trackedPaths: [repoPathOf("package.json")] });
    expect({
      report,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
      lints: lintFiles.mock.calls,
    }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX_OBJECT,
              location: "package.json",
              script: "lint",
              option: "--rule hone/no-class-authoring: off",
              cause: { kind: "weakens-run" },
            },
          ],
          projection: "current",
          slices: [],
          unprojectedFolders: [],
          measured: [],
        },
      },
      governanceInstances: [],
      lints: [],
    });
  });
});

const WINDOWS_REPO_ROOT = absoluteRootOf("C:\\repo");
const WINDOWS_INSTALL_ROOT = absoluteRootOf("C:\\repo\\node_modules\\@hailstails\\hone");
const WINDOWS_PIECE_ROOT = "C:\\repo\\node_modules\\@hailstails\\hone\\mechanisms\\eslint\\CD-14";
const WINDOWS_PLUGIN_MODULE_PATH =
  "C:\\repo\\node_modules\\@hailstails\\hone\\mechanisms\\eslint\\CD-14\\cd14\\cd14.eslint-plugin.ts";
const OTHER_DRIVE_PIECE_ROOT = "D:\\dc\\mechanisms\\eslint\\CD-14";

const WINDOWS_PATH = createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" });

const PROJECTION_HOLDING_SOURCE_A = projectionHolding({ text: "const a = 1;\n\n  class A {}\n" });

const windowsRun = (request: { readonly pieceRoot: string }) => ({
  repoRoot: WINDOWS_REPO_ROOT,
  installRoot: WINDOWS_INSTALL_ROOT,
  declaredConfigRoots: [],
  files: FILES,
  trackedPaths: [],
  clauses: [{ ...CLASS_CLAUSE, pieceRoot: request.pieceRoot }],
  records: [],
});

describe("the governance run on Windows paths", () => {
  it("is piece-invalid without loading for a piece on another drive from the repository, naming its piece root", async () => {
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValue({ outcome: "ok", value: CLASS_PLUGIN_MODULE });
    const report = await runnerOver({
      path: WINDOWS_PATH,
      repository: PROJECTION_HOLDING_SOURCE_A,
      modules: { load },
    }).run(windowsRun({ pieceRoot: OTHER_DRIVE_PIECE_ROOT }));
    expect({ report, loads: load.mock.calls }).toEqual({
      report: {
        outcome: "failed",
        error: {
          kind: "piece-invalid",
          pieceRoot: OTHER_DRIVE_PIECE_ROOT,
          detail: expect.stringContaining("different root"),
        },
      },
      loads: [],
    });
  });

  it("reports a hit in a linted file within the repository at its POSIX repository path", async () => {
    await expect(
      runnerOver({
        path: WINDOWS_PATH,
        repository: PROJECTION_HOLDING_SOURCE_A,
        modules: modulesOver({ [WINDOWS_PLUGIN_MODULE_PATH]: CLASS_PLUGIN_MODULE }),
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: [{ filePath: "C:\\repo\\src\\a.ts", messages: [CLASS_MESSAGE] }],
          }),
        }),
      }).run(windowsRun({ pieceRoot: WINDOWS_PIECE_ROOT })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [HIT_IN_A],
        nativeExceptions: [],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: MEASURED_CLASS_IN_A,
      },
    });
  });

  it("reads the repository at its Windows root, asking for the projection and a tracked suppressions file by their repository paths", async () => {
    const suppressionsAt = suppressionsAnswering({});
    const repository = repositoryHolding({ suppressionsAt });
    const repositoryAt = vi.fn<EslintRunnerPorts["repositoryAt"]>().mockReturnValue(repository);
    await eslintRunnerOver({
      repositoryAt,
      coreInstall: SOURCE_INSTALL,
      path: WINDOWS_PATH,
      modules: modulesOver({ [WINDOWS_PLUGIN_MODULE_PATH]: CLASS_PLUGIN_MODULE }),
      eslint: eslintOver({ lintFiles: lintResolving({ outcome: "ok", value: [] }) }),
    }).run({
      ...windowsRun({ pieceRoot: WINDOWS_PIECE_ROOT }),
      trackedPaths: [repoPathOf("src/eslint-suppressions.json")],
    });
    expect({
      repositories: repositoryAt.mock.calls,
      projections: vi.mocked(repository.projectionFiles.currentOf).mock.calls,
      suppressions: suppressionsAt.mock.calls,
    }).toEqual({
      repositories: [[{ repoRoot: WINDOWS_REPO_ROOT }]],
      projections: [[{ files: [PROJECTION_FILE] }]],
      suppressions: [[{ location: "src/eslint-suppressions.json" }]],
    });
  });
});

describe("plugin namespace ownership", () => {
  const teamRun = (request: { readonly pluginNamespace: string }) =>
    runRequest({
      clauses: [
        {
          ...CLASS_CLAUSE,
          address: {
            ruleSet: { name: ruleSetNameOf("acme") },
            discipline: disciplineIdOf("CD-14"),
            clause: clauseIdOf("class-syntax"),
          },
          settings: { ...CLASS_SETTINGS, pluginNamespace: request.pluginNamespace },
        },
      ],
      records: [],
    });

  const refusedRun = (request: { readonly ruleSet: string; readonly pluginNamespace: string }) =>
    runnerOver({}).run(
      runRequest({
        clauses: [
          {
            ...CLASS_CLAUSE,
            address: clauseAddressSchema.parse(`${request.ruleSet}/CD-14#class-syntax`),
            settings: { ...CLASS_SETTINGS, pluginNamespace: request.pluginNamespace },
          },
        ],
        records: [],
      }),
    );

  it.each(["hone", "hone-x", "hone-core", "hone-acme"])(
    "refuses the namespace %s for a team piece as belonging to the tool",
    async (pluginNamespace) => {
      await expect(refusedRun({ ruleSet: "acme", pluginNamespace })).resolves.toEqual({
        outcome: "failed",
        error: {
          kind: "piece-invalid",
          pieceRoot: PIECE_ROOT,
          detail: `the plugin namespace ${pluginNamespace} belongs to Hone; the rule set acme must use acme or acme-<name>`,
        },
      });
    },
  );

  it.each(["loops", "acmeish", "acm", "honeycomb"])(
    "refuses the namespace %s for a team piece as not owned by its rule set",
    async (pluginNamespace) => {
      await expect(refusedRun({ ruleSet: "acme", pluginNamespace })).resolves.toEqual({
        outcome: "failed",
        error: {
          kind: "piece-invalid",
          pieceRoot: PIECE_ROOT,
          detail: `the plugin namespace ${pluginNamespace} is not owned by the rule set acme; use acme or acme-<name>`,
        },
      });
    },
  );

  it.each(["honeycomb", "honeycomb-x"])(
    "accepts the namespace %s for the team rule set honeycomb",
    async (pluginNamespace) => {
      await expect(refusedRun({ ruleSet: "honeycomb", pluginNamespace })).resolves.toMatchObject({
        outcome: "ok",
      });
    },
  );

  it("keeps the plain reserved message for hone-core on Hone's own rule set", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({
          clauses: [
            { ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, pluginNamespace: "hone-core" } },
          ],
          records: [],
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        detail: "the plugin namespace hone-core is reserved for hone's own rules",
      },
    });
  });

  it.each(["", "acme-", "Acme", "acme--x", "-acme"])(
    "rejects the malformed namespace %j",
    async (pluginNamespace) => {
      await expect(refusedRun({ ruleSet: "acme", pluginNamespace })).resolves.toMatchObject({
        outcome: "failed",
        error: { kind: "piece-invalid" },
      });
    },
  );

  it.each(["acme", "acme-x", "acme-cd14"])(
    "accepts the namespace %s for a team piece",
    async (pluginNamespace) => {
      await expect(runnerOver({}).run(teamRun({ pluginNamespace }))).resolves.toMatchObject({
        outcome: "ok",
      });
    },
  );

  it("still accepts Hone's own namespaces for the shared rule set", async () => {
    await expect(runnerOver({}).run(CLASS_RUN)).resolves.toMatchObject({ outcome: "ok" });
  });
});

const PACKAGE_A_CONFIG = repoPathOf("packages/a/eslint.config.mjs");
const PACKAGE_A_SLICE_FILE = repoPathOf("packages/a/disciplines.eslint.mjs");
const PACKAGE_FILE_A = repoPathOf("packages/a/src/a.ts");
const PACKAGE_FACTORY = repoPathOf("packages/a/src/factory.ts");

const PACKAGE_FACTORY_LOCATION: ExceptionRecord = { ...FACTORY_LOCATION, file: PACKAGE_FACTORY };

const ROOT_PROJECTION_WITH_PACKAGE_LOCATION = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "packages/a/src/factory.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const PACKAGE_A_SLICE = `import piece0 from "../../node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/factory.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const PACKAGE_RUN = {
  ...runRequest({ clauses: [CLASS_CLAUSE], records: [PACKAGE_FACTORY_LOCATION] }),
  files: [PACKAGE_FILE_A, PACKAGE_FACTORY],
  trackedPaths: [PACKAGE_FILE_A, PACKAGE_FACTORY, PACKAGE_A_CONFIG],
};

const PACKAGE_LOCATION_LOST = queryOver({
  ignored: { "packages/a/src/a.ts": "checked", "packages/a/src/factory.ts": "checked" },
  states: {
    [`packages/a/src/a.ts ${RULE_ID}`]: ERROR,
    [`packages/a/src/factory.ts ${RULE_ID}`]: ERROR,
  },
});

const packageRepository = (request: { readonly slice: CurrentProjection }): EslintRepository =>
  repositoryHolding({
    projectionFiles: projectionFilesHolding(
      new Map([
        [PROJECTION_FILE, present(ROOT_PROJECTION_WITH_PACKAGE_LOCATION)],
        [PACKAGE_A_SLICE_FILE, request.slice],
      ]),
    ),
  });

describe("package projection slices, their bytes", () => {
  it("treats a folder with a tracked eslint.config as a config root, naming its missing slice beside a current root projection and the run's hits", async () => {
    const projectionFiles = projectionFilesHolding(
      new Map([
        [PROJECTION_FILE, present(ENABLING_PROJECTION)],
        [PACKAGE_A_SLICE_FILE, ABSENT_PROJECTION],
      ]),
    );
    const report = await runnerOver({
      repository: repositoryHolding({ projectionFiles }),
      eslint: eslintOver({
        lintFiles: lintResolving({
          outcome: "ok",
          value: linted({ messagesInA: [CLASS_MESSAGE] }),
        }),
      }),
    }).run({ ...CLASS_RUN, trackedPaths: [...FILES, PACKAGE_A_CONFIG] });
    expect(projectionFiles.currentOf).toHaveBeenCalledWith({ files: [PACKAGE_A_SLICE_FILE] });
    expect({ report }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [HIT_IN_A],
          nativeExceptions: [],
          projection: "current",
          slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "missing" }],
          unprojectedFolders: [],
          measured: MEASURED_CLASS,
        },
      },
    });
  });

  it("names a package slice that is out of date for the records under its folder", async () => {
    await expect(
      runnerOver({
        repository: packageRepository({ slice: present(ENABLING_PROJECTION) }),
        eslint: eslintOver({
          query: queryOver({
            ignored: { "packages/a/src/a.ts": "checked", "packages/a/src/factory.ts": "checked" },
            states: {
              [`packages/a/src/a.ts ${RULE_ID}`]: ERROR,
              [`packages/a/src/factory.ts ${RULE_ID}`]: OFF,
            },
          }),
        }),
      }).run(PACKAGE_RUN),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        projection: "current",
        slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "out-of-date" }],
      },
    });
  });
});

describe("package projection slices, applied by the team's config", () => {
  it("names the package slice as not applied when ESLint resolves per file and the package's carve-outs are not in effect", async () => {
    await expect(
      runnerOver({
        repository: packageRepository({ slice: present(PACKAGE_A_SLICE) }),
        eslint: eslintOver({ query: PACKAGE_LOCATION_LOST }),
      }).run(PACKAGE_RUN),
    ).resolves.toEqual({
      ...NOT_INCLUDED,
      value: {
        ...NOT_INCLUDED.value,
        slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" }],
      },
    });
  });

  it("names no slice as not applied when ESLint resolves every file from the repository root config", async () => {
    await expect(
      runnerOver({
        repository: resolvingFromRoot({
          projectionFiles: rootHolding(present(ROOT_PROJECTION_WITH_PACKAGE_LOCATION)),
        }),
        eslint: eslintOver({ query: PACKAGE_LOCATION_LOST }),
      }).run(PACKAGE_RUN),
    ).resolves.toEqual(NOT_INCLUDED);
  });
});

const PACKAGE_B_CONFIG = repoPathOf("packages/b/eslint.config.mjs");
const PACKAGE_B_FACTORY = repoPathOf("packages/b/src/factory.ts");

const ROOT_PROJECTION_WITH_TWO_PACKAGE_LOCATIONS = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "packages/a/src/factory.ts",
      "packages/b/src/factory.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const TWO_PACKAGE_RUN = {
  ...runRequest({
    clauses: [CLASS_CLAUSE],
    records: [PACKAGE_FACTORY_LOCATION, { ...FACTORY_LOCATION, file: PACKAGE_B_FACTORY }],
  }),
  files: [PACKAGE_FACTORY, PACKAGE_B_FACTORY],
  trackedPaths: [PACKAGE_FACTORY, PACKAGE_B_FACTORY, PACKAGE_A_CONFIG, PACKAGE_B_CONFIG],
};

describe("package projection slices, not applied in one package of several", () => {
  it("names only the package whose carve-out is lost, leaving a sibling whose carve-out holds", async () => {
    await expect(
      runnerOver({
        repository: repositoryHolding({
          projectionFiles: projectionFilesHolding(
            new Map([
              [PROJECTION_FILE, present(ROOT_PROJECTION_WITH_TWO_PACKAGE_LOCATIONS)],
              [PACKAGE_A_SLICE_FILE, present(PACKAGE_A_SLICE)],
              [repoPathOf("packages/b/disciplines.eslint.mjs"), present(PACKAGE_A_SLICE)],
            ]),
          ),
        }),
        eslint: eslintOver({
          query: queryOver({
            ignored: {
              "packages/a/src/factory.ts": "checked",
              "packages/b/src/factory.ts": "checked",
            },
            states: {
              [`packages/a/src/factory.ts ${RULE_ID}`]: ERROR,
              [`packages/b/src/factory.ts ${RULE_ID}`]: OFF,
            },
          }),
        }),
      }).run(TWO_PACKAGE_RUN),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" }] },
    });
  });
});

describe("package projection slices, projected", () => {
  it("projects the root projection and each package's slice, the package's records relative to its folder", async () => {
    const projectionFiles = {
      ...projectionFilesHolding(
        new Map([
          [PROJECTION_FILE, ABSENT_PROJECTION],
          [PACKAGE_A_SLICE_FILE, ABSENT_PROJECTION],
        ]),
      ),
      writeAt: vi
        .fn<ProjectionFiles["writeAt"]>()
        .mockReturnValueOnce(writtenAt(PROJECTION_FILE))
        .mockReturnValueOnce(writtenAt(PACKAGE_A_SLICE_FILE)),
    };
    const write = await runnerOver({ repository: repositoryHolding({ projectionFiles }) }).project(
      projectRequest({ trackedPaths: [PACKAGE_A_CONFIG], records: [PACKAGE_FACTORY_LOCATION] }),
    );
    expect({ write, fileWrites: projectionFiles.writeAt.mock.calls }).toEqual({
      write: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/a/disciplines.eslint.mjs", effect: "written" },
        ],
      },
      fileWrites: [
        [{ file: PROJECTION_FILE, text: ROOT_PROJECTION_WITH_PACKAGE_LOCATION }],
        [{ file: PACKAGE_A_SLICE_FILE, text: PACKAGE_A_SLICE }],
      ],
    });
  });
});

const PACKAGE_WEB = repoPathOf("packages/web");

const PACKAGE_WEB_SLICE_FILE = repoPathOf("packages/web/disciplines.eslint.mjs");

describe("package projection slices, which roots they cover", () => {
  it("requires no slice for a folder with a tracked config when ESLint resolves every file from the root config", async () => {
    await expect(
      runnerOver({ repository: resolvingFromRoot({}) }).run({
        ...CLASS_RUN,
        trackedPaths: [...FILES, PACKAGE_A_CONFIG],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { projection: "current", slices: [], unprojectedFolders: [] },
    });
  });

  it("still requires the slice of a root disciplines.json declares when ESLint resolves every file from the root config", async () => {
    await expect(
      runnerOver({
        repository: resolvingFromRoot({
          projectionFiles: projectionFilesHolding(
            new Map([
              [PROJECTION_FILE, present(ENABLING_PROJECTION)],
              [PACKAGE_WEB_SLICE_FILE, ABSENT_PROJECTION],
            ]),
          ),
        }),
      }).run({ ...CLASS_RUN, declaredConfigRoots: [PACKAGE_WEB] }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [{ slice: "packages/web/disciplines.eslint.mjs", state: "missing" }] },
    });
  });

  it("names a declared root with no eslint.config on disk as unconfigured, since nothing there loads its slice", async () => {
    const folderConfiguration = vi
      .fn<EslintRepository["folderConfiguration"]>()
      .mockReturnValue("unconfigured");
    const report = await runnerOver({
      repository: repositoryHolding({
        projectionFiles: projectionFilesHolding(
          new Map([
            [PROJECTION_FILE, present(ENABLING_PROJECTION)],
            [PACKAGE_WEB_SLICE_FILE, ABSENT_PROJECTION],
          ]),
        ),
        folderConfiguration,
      }),
    }).run({ ...CLASS_RUN, declaredConfigRoots: [PACKAGE_WEB] });
    expect(folderConfiguration.mock.calls).toEqual([[{ folder: PACKAGE_WEB }]]);
    expect(report).toMatchObject({
      outcome: "ok",
      value: {
        slices: [
          { slice: "packages/web/disciplines.eslint.mjs", state: "missing" },
          { slice: "packages/web/disciplines.eslint.mjs", state: "unconfigured" },
        ],
      },
    });
  });

  it("projects only the root slice for a folder with a tracked config when ESLint resolves every file from the root config", async () => {
    const projectionFiles = rootHolding(ABSENT_PROJECTION);
    await runnerOver({ repository: resolvingFromRoot({ projectionFiles }) }).project(
      projectRequest({ trackedPaths: [PACKAGE_A_CONFIG], records: [] }),
    );
    expect(projectionFiles.writeAt.mock.calls).toEqual([
      [{ file: PROJECTION_FILE, text: ENABLING_PROJECTION }],
    ]);
  });
});

const packageQueryUnderIgnoringRoot = (request: {
  readonly factory: RuleState;
}): QueryInstance => ({
  ...queryOver({
    ignored: { "packages/a/src/a.ts": "checked", "packages/a/src/factory.ts": "checked" },
    states: {
      [`packages/a/src/a.ts ${RULE_ID}`]: ERROR,
      [`packages/a/src/factory.ts ${RULE_ID}`]: request.factory,
    },
  }),
  configFileOf: () => Promise.resolve(ROOT_CONFIG),
});

const rootIgnoringEslint = (request: { readonly factory: RuleState }): EslintPort =>
  eslintAsking({
    query: packageQueryUnderIgnoringRoot(request),
    ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_IGNORED),
  });

const projectedUnderIgnoringRoot = async (request: {
  readonly rootProjection: CurrentProjection;
}) => {
  const projectionFiles = projectionFilesHolding(
    new Map([
      [PROJECTION_FILE, request.rootProjection],
      [PACKAGE_A_SLICE_FILE, present(ENABLING_PROJECTION)],
    ]),
  );
  const eslint = rootIgnoringEslint({ factory: OFF });
  const write = await runnerOver({
    repository: repositoryHolding({ projectionFiles }),
    eslint,
  }).project(
    projectRequest({ trackedPaths: [PACKAGE_A_CONFIG], records: [PACKAGE_FACTORY_LOCATION] }),
  );
  return {
    write,
    fileWrites: projectionFiles.writeAt.mock.calls,
    asked: vi.mocked(eslint.ignoredByConfig).mock.calls,
  };
};

describe("package projection slices, under a folder the repository root config ignores", () => {
  it("still names the missing slice, since linting from that folder loads its config without the root's ignores", async () => {
    await expect(
      runnerOver({
        repository: packageRepository({ slice: ABSENT_PROJECTION }),
        eslint: rootIgnoringEslint({ factory: OFF }),
      }).run(PACKAGE_RUN),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "missing" }] },
    });
  });

  it("still names the slice out of date after an exception is added there", async () => {
    await expect(
      runnerOver({
        repository: packageRepository({ slice: present(ENABLING_PROJECTION) }),
        eslint: rootIgnoringEslint({ factory: OFF }),
      }).run(PACKAGE_RUN),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "out-of-date" }] },
    });
  });

  it("names the slice not applied when the package's own config, the one its lint loads, does not carry its carve-out", async () => {
    await expect(
      runnerOver({
        repository: packageRepository({ slice: present(PACKAGE_A_SLICE) }),
        eslint: rootIgnoringEslint({ factory: ERROR }),
      }).run(PACKAGE_RUN),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" }] },
    });
  });
});

describe("package projection slices, projected under a folder the repository root config ignores", () => {
  it("hands the package slice there its own text, beside the root projection, asking no config about any folder", async () => {
    await expect(
      projectedUnderIgnoringRoot({
        rootProjection: present(ROOT_PROJECTION_WITH_PACKAGE_LOCATION),
      }),
    ).resolves.toEqual({
      write: expect.anything(),
      fileWrites: [
        [{ file: PROJECTION_FILE, text: ROOT_PROJECTION_WITH_PACKAGE_LOCATION }],
        [{ file: PACKAGE_A_SLICE_FILE, text: PACKAGE_A_SLICE }],
      ],
      asked: [],
    });
  });

  it("hands the same texts whether or not the root projection exists yet", async () => {
    const first = await projectedUnderIgnoringRoot({ rootProjection: ABSENT_PROJECTION });
    const second = await projectedUnderIgnoringRoot({
      rootProjection: present(ROOT_PROJECTION_WITH_PACKAGE_LOCATION),
    });
    const written = {
      write: expect.anything(),
      fileWrites: [
        [{ file: PROJECTION_FILE, text: ROOT_PROJECTION_WITH_PACKAGE_LOCATION }],
        [{ file: PACKAGE_A_SLICE_FILE, text: PACKAGE_A_SLICE }],
      ],
      asked: [],
    };
    expect({ first, second }).toEqual({ first: written, second: written });
  });
});

const NESTED_SELECTION = repoPathOf("packages/b/disciplines.json");
const NESTED_CONFIG = repoPathOf("packages/b/eslint.config.mjs");
const NESTED_FILE = repoPathOf("packages/b/src/old.ts");

const NESTED_RUN = {
  ...runRequest({ clauses: [CLASS_CLAUSE], records: [{ ...FACTORY_LOCATION, file: NESTED_FILE }] }),
  files: [...FILES, NESTED_FILE],
  trackedPaths: [...FILES, NESTED_FILE, NESTED_SELECTION, NESTED_CONFIG],
};

const NESTED_SKIPPED = {
  slice: "packages/b/disciplines.eslint.mjs",
  state: "nested-configuration",
};

const NESTED_FOLDER = { folder: "packages/b", selectionFolder: "packages/b" };

const nestedQuery = (request: { readonly old: RuleState }) =>
  queryOver({
    ignored: { ...CHECKED, "packages/b/src/old.ts": "checked" },
    states: {
      [`src/a.ts ${RULE_ID}`]: ERROR,
      [`src/factory.ts ${RULE_ID}`]: ERROR,
      [`packages/b/src/old.ts ${RULE_ID}`]: request.old,
    },
  });

describe("package projection slices, a folder holding its own disciplines.json", () => {
  it("names the folder beside a not-included projection when its own config loses the carve-out this repository records there", async () => {
    await expect(
      runnerOver({ eslint: eslintOver({ query: nestedQuery({ old: ERROR }) }) }).run(NESTED_RUN),
    ).resolves.toEqual({
      ...NOT_INCLUDED,
      value: {
        ...NOT_INCLUDED.value,
        slices: [NESTED_SKIPPED],
        unprojectedFolders: [NESTED_FOLDER],
      },
    });
  });

  it("names no slice when the projection is in effect there, yet still names the folder as one whose files load its own config", async () => {
    await expect(
      runnerOver({ eslint: eslintOver({ query: nestedQuery({ old: OFF }) }) }).run(NESTED_RUN),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [], unprojectedFolders: [NESTED_FOLDER] },
    });
  });

  it("names nothing for a folder with no file under check", async () => {
    await expect(runnerOver({}).run({ ...NESTED_RUN, files: FILES })).resolves.toMatchObject({
      outcome: "ok",
      value: { slices: [], unprojectedFolders: [] },
    });
  });

  it("names nothing when ESLint resolves every file from the repository root config, which never loads the folder's own config", async () => {
    await expect(
      runnerOver({
        repository: resolvingFromRoot({}),
        eslint: eslintOver({ query: nestedQuery({ old: ERROR }) }),
      }).run(NESTED_RUN),
    ).resolves.toEqual(NOT_INCLUDED);
  });
});

describe("package projection slices, a run that cannot finish", () => {
  it("writes and removes nothing when one slice cannot be read", async () => {
    const projectionFiles = projectionFilesAnswering(unreadableProjection(PACKAGE_A_SLICE_FILE));
    const write = await runnerOver({ repository: repositoryHolding({ projectionFiles }) }).project(
      projectRequest({
        trackedPaths: [PACKAGE_A_CONFIG, repoPathOf("packages/old/disciplines.eslint.mjs")],
        records: [],
      }),
    );
    expect({
      write,
      writes: projectionFiles.writeAt.mock.calls,
      removals: projectionFiles.removeAt.mock.calls,
    }).toEqual({
      write: {
        outcome: "failed",
        error: {
          kind: "file-unreadable",
          file: "packages/a/disciplines.eslint.mjs",
          detail: "EACCES",
        },
      },
      writes: [],
      removals: [],
    });
  });
});
