import { afterAll, assert, describe, expect, it } from "vitest";

import type {
  EngineCheck,
  NamedEslintRunRequest,
} from "../../src/application/ports/engine/engine-run.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../src/domain/repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { editionOf } from "../../src/domain/rule-set/edition-of.ts";
import type { CheckHit, CheckMeasurement } from "../../src/domain/runner/check-observations.ts";
import type { AnsweredFile } from "../../src/domain/runner/checks-run-report.ts";
import type { EslintConfigLookup } from "../../src/domain/settings/eslint-config-lookup.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createChecksRunner } from "../../src/infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainModules,
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import type { NamedChecksRunReport } from "../../src/infrastructure/engines/protocol/checks/checks-runner-types.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultScratchFilesPort } from "../install-proof/install-proof-ports.ts";

type EslintLineRow = {
  readonly line: string;
  readonly eslintVersion: string;
  readonly toolchainModules: EslintToolchainModules;
  readonly pieceModules: ModuleLoaderPort;
};

type RootFileRow = {
  readonly name: string;
  readonly folder: string;
  readonly config: string;
  readonly projection: string;
  readonly source: string;
  readonly answered: readonly AnsweredFile[];
  readonly report: NamedChecksRunReport;
};

type SubfolderRow = {
  readonly name: string;
  readonly folder: string;
  readonly rootConfig: string;
  readonly rootProjection: string;
  readonly subConfig: string;
  readonly subProjection: string;
  readonly tracked: readonly RepoPath[];
  readonly answered: readonly AnsweredFile[];
  readonly lookup: EslintConfigLookup;
  readonly report: NamedChecksRunReport;
};

const fileText = createDefaultFileTextPort({});

const fileRemoval = createDefaultFileRemovalPort({});

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

const SCRATCH = `${INSTALL_ROOT}/artefacts/checks-runner-integration`;

const PEER_LOCATION = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
}).location;

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const CHECKS: readonly EngineCheck[] = [
  {
    name: "class-keyword",
    symptom: {
      ruleSet: TOOL_RULE_SET,
      name: "authored-class-or-this",
      title: "Authored class or this",
    },
    engines: [{ name: "walker" }, { name: "eslint" }],
  },
  {
    name: "static-members-only",
    symptom: {
      ruleSet: TOOL_RULE_SET,
      name: "authored-class-or-this",
      title: "Authored class or this",
    },
    engines: [{ name: "eslint" }],
  },
];

const BINDINGS: NamedEslintRunRequest["bindings"] = [
  {
    address: "authored-class-or-this#class-keyword",
    ruleSet: TOOL_RULE_SET,
    engine: "eslint",
    anchor: { kind: "keyword", keyword: "class" },
    pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword`,
    settings: {
      pluginNamespace: "hone",
      pluginModule: "eslint-plugin.ts",
      rule: "no-class-authoring",
    },
    checkSettings: {},
    edition: editionOf("1"),
  },
];

const ONE_CLASS = "export class Kept {}\n";

const PROJECTION = `import hone from "../../../src/eslint-plugin.ts";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } }];
`;

const SUB_PROJECTION = `import hone from "../../../../src/eslint-plugin.ts";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } }];
`;

const TEAM_CONFIG = `import hone from "./hone.eslint.mjs";
export default [...hone];
`;

const CONFIG_WITHOUT_THE_CHECKS = `export default [{ files: ["**/*.ts"], rules: {} }];
`;

const CLASS_ON_LINE_1: CheckHit = {
  file: repoPathOf("kept.ts"),
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  check: "authored-class-or-this#class-keyword",
};

const CLASS_ON_LINE_2: CheckHit = {
  file: repoPathOf("kept.ts"),
  anchor: { line: 2, column: 7 },
  snippet: "export class Kept {}",
  check: "authored-class-or-this#class-keyword",
};

const CLASS_IN_SUB: CheckHit = {
  file: repoPathOf("sub/kept.ts"),
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  check: "authored-class-or-this#class-keyword",
};

const MEASURED: CheckMeasurement = {
  check: "authored-class-or-this#class-keyword",
  file: repoPathOf("kept.ts"),
};

const MEASURED_IN_SUB: CheckMeasurement = {
  check: "authored-class-or-this#class-keyword",
  file: repoPathOf("sub/kept.ts"),
};

afterAll(() => {
  scratch.removeTree({ path: SCRATCH });
});

describe.each<EslintLineRow>([
  {
    line: "eslint-10",
    eslintVersion: "10.15.0",
    toolchainModules: defaultEslintToolchainModules,
    pieceModules: createDefaultModuleLoaderPort({}),
  },
  {
    line: "eslint-9",
    eslintVersion: "9.39.5",
    toolchainModules: eslint9ToolchainModules,
    pieceModules: eslint9PieceModules({ base: createDefaultModuleLoaderPort({}) }),
  },
])("the version 2 ESLint runner on real $line", (row) => {
  it("loads the ESLint major its line names from the development install", async () => {
    const toolchain = await loadEslintToolchain({
      peers: { location: PEER_LOCATION, modules: row.toolchainModules },
    });

    assert(toolchain.outcome === "ok", `the ${row.line} toolchain loads`);
    expect(toolchain.value.eslintVersion).toBe(row.eslintVersion);
  });

  it.each<RootFileRow>([
    {
      name: "reports a class in its file, position and snippet, naming its check, through a team config that spreads hone.eslint.mjs",
      folder: "class",
      config: TEAM_CONFIG,
      projection: PROJECTION,
      source: ONE_CLASS,
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_1],
        nativeExceptions: [],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "reports an inline disable that gives a reason after the check's id as a native exception whose text keeps the reason, beside the hit it does not remove",
      folder: "disable-with-reason",
      config: TEAM_CONFIG,
      projection: PROJECTION,
      source:
        "// eslint-disable-next-line hone/authored-class-or-this#class-keyword -- inherited from the billing module\nexport class Kept {}\n",
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_2],
        nativeExceptions: [
          {
            kind: "inline-disable",
            file: repoPathOf("kept.ts"),
            line: 1,
            text: "// eslint-disable-next-line hone/authored-class-or-this#class-keyword -- inherited from the billing module",
            reach: "one-check",
            check: "authored-class-or-this#class-keyword",
          },
        ],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "reports an inline rule configuration written with the check's id as a native exception on that check, beside the hit it does not remove",
      folder: "inline-rule-config",
      config: TEAM_CONFIG,
      projection: PROJECTION,
      source:
        '/* eslint hone/authored-class-or-this#class-keyword: "off" */\nexport class Kept {}\n',
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_2],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            file: repoPathOf("kept.ts"),
            line: 1,
            text: '/* eslint hone/authored-class-or-this#class-keyword: "off" */',
            check: "authored-class-or-this#class-keyword",
          },
        ],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "reports an inline disable written with a version 1 id as misnamed and suppresses nothing",
      folder: "version-1-id",
      config: TEAM_CONFIG,
      projection: PROJECTION,
      source: "// eslint-disable-next-line hone/no-class-authoring\nexport class Kept {}\n",
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_2],
        nativeExceptions: [],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [
          {
            kind: "version-1-id",
            ruleId: "hone/no-class-authoring",
            file: repoPathOf("kept.ts"),
            line: 1,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            replacedBy: ["hone/authored-class-or-this#class-keyword"],
          },
        ],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "does not call a disable misnamed when it names a real check of the catalogue that the repository has not selected",
      folder: "unselected-check",
      config: TEAM_CONFIG,
      projection: PROJECTION,
      source:
        "// eslint-disable-next-line hone/authored-class-or-this#static-members-only\nexport class Kept {}\n",
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_2],
        nativeExceptions: [],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "reports a global ignore over the source as a native exception on the check",
      folder: "global-ignore",
      config: `import hone from "./hone.eslint.mjs";\nexport default [{ ignores: ["kept.ts"] }, ...hone];\n`,
      projection: PROJECTION,
      source: ONE_CLASS,
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_1],
        nativeExceptions: [
          {
            kind: "ignore",
            file: repoPathOf("kept.ts"),
            check: "authored-class-or-this#class-keyword",
          },
        ],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "reports a config override of the check's rule after the projection as a native exception on that check",
      folder: "config-override",
      config: `import hone from "./hone.eslint.mjs";\nexport default [...hone, { rules: { "hone/authored-class-or-this#class-keyword": "off" } }];\n`,
      projection: PROJECTION,
      source: ONE_CLASS,
      answered: [],
      report: {
        hits: [CLASS_ON_LINE_1],
        nativeExceptions: [
          {
            kind: "config-override",
            file: repoPathOf("kept.ts"),
            check: "authored-class-or-this#class-keyword",
          },
        ],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "does not report the projection's own off block over an answered file as an override",
      folder: "answered-root-file",
      config: TEAM_CONFIG,
      projection: `import hone from "../../../src/eslint-plugin.ts";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } },
{ name: "hone/answered/authored-class-or-this#class-keyword", files: ["kept.ts"], rules: { "hone/authored-class-or-this#class-keyword": "off" } }];
`,
      source: ONE_CLASS,
      answered: [
        {
          ruleSet: TOOL_RULE_SET,
          symptom: "authored-class-or-this",
          check: "class-keyword",
          file: repoPathOf("kept.ts"),
        },
      ],
      report: {
        hits: [CLASS_ON_LINE_1],
        nativeExceptions: [],
        measured: [MEASURED],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
  ])("$name", async ({ folder, config, projection, source, answered, report }) => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${row.line}-${folder}`);
    const toolchain = await loadEslintToolchain({
      peers: { location: PEER_LOCATION, modules: row.toolchainModules },
    });
    assert(toolchain.outcome === "ok", `the ${row.line} toolchain loads`);
    const eslint = createEslintPort({ toolchain: toolchain.value });
    expect([
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: repo }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: config }),
      fileText.write({ path: `${repo}/hone.eslint.mjs`, text: projection }),
      fileText.write({
        path: `${repo}/hone.eslint.d.mts`,
        text: eslint.boundary.declarationText,
      }),
      fileText.write({ path: `${repo}/kept.ts`, text: source }),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN]);
    const runner = createChecksRunner({
      fileText,
      fileRemoval,
      modules: row.pieceModules,
      path,
      eslint,
      moduleExtension: ".ts",
    });

    const outcome = await runner.run({
      repoRoot: repo,
      installRoot: INSTALL_ROOT,
      files: [repoPathOf("kept.ts")],
      trackedPaths: [repoPathOf("kept.ts")],
      checks: CHECKS,
      bindings: BINDINGS,
      answered,
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });

    expect(outcome).toEqual({ outcome: "ok", value: report });
  });

  it("loads a TypeScript eslint.config.ts that imports a ts kind projection as ./hone.eslint.js through jiti, reports a class through it, and leaves hone.eslint.ts out by its ignores", async () => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${row.line}-ts-kind`);
    const toolchain = await loadEslintToolchain({
      peers: { location: PEER_LOCATION, modules: row.toolchainModules },
    });
    assert(toolchain.outcome === "ok", `the ${row.line} toolchain loads`);
    const eslint = createEslintPort({ toolchain: toolchain.value });
    const written = [
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: repo }),
      fileText.write({
        path: `${repo}/eslint.config.ts`,
        text: 'import hone from "./hone.eslint.js";\nexport default [...hone];\n',
      }),
      fileText.write({
        path: `${repo}/plugin.mjs`,
        text: 'export default { rules: { "authored-class-or-this#class-keyword": { meta: { schema: [] }, create: () => ({}) } } };\n',
      }),
      fileText.write({
        path: `${repo}/hone.eslint.ts`,
        text: `import hone from "./plugin.mjs";
const projection: {
  name: string;
  files: string[];
  ignores?: string[];
  plugins?: Record<string, object>;
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}[] = [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.ts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } }];
export default projection;
`,
      }),
      fileText.write({ path: `${repo}/kept.ts`, text: ONE_CLASS }),
    ];
    const runner = createChecksRunner({
      fileText,
      fileRemoval,
      modules: row.pieceModules,
      path,
      eslint,
      moduleExtension: ".ts",
    });

    const outcome = await runner.run({
      repoRoot: repo,
      installRoot: INSTALL_ROOT,
      files: [repoPathOf("kept.ts")],
      trackedPaths: [repoPathOf("kept.ts")],
      checks: CHECKS,
      bindings: BINDINGS,
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      projectionKind: "ts",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
    const ownFile = await eslint.createQueryInstance({ repoRoot: repo }).ruleState({
      file: repoPathOf("hone.eslint.ts"),
      ruleId: "hone/authored-class-or-this#class-keyword",
    });

    expect({ written, outcome, ownFile }).toEqual({
      written: [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN],
      outcome: {
        outcome: "ok",
        value: {
          hits: [CLASS_ON_LINE_1],
          nativeExceptions: [],
          measured: [MEASURED],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "out-of-date",
          slices: [],
        },
      },
      ownFile: { outcome: "ok", value: { state: "file-ignored" } },
    });
  });

  it("measures nothing, and lints no untracked file, when it is given no file to check", async () => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${row.line}-declaration-only`);
    const toolchain = await loadEslintToolchain({
      peers: { location: PEER_LOCATION, modules: row.toolchainModules },
    });
    assert(toolchain.outcome === "ok", `the ${row.line} toolchain loads`);
    const eslint = createEslintPort({ toolchain: toolchain.value });
    const written = [
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/dist` }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repo}/hone.eslint.mjs`, text: PROJECTION }),
      fileText.write({
        path: `${repo}/hone.eslint.d.mts`,
        text: eslint.boundary.declarationText,
      }),
      fileText.write({ path: `${repo}/dist/x.d.ts`, text: ONE_CLASS }),
    ];
    const runner = createChecksRunner({
      fileText,
      fileRemoval,
      modules: row.pieceModules,
      path,
      eslint,
      moduleExtension: ".ts",
    });

    const outcome = await runner.run({
      repoRoot: repo,
      installRoot: INSTALL_ROOT,
      files: [],
      trackedPaths: [],
      checks: CHECKS,
      bindings: BINDINGS,
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });

    expect({ written, outcome }).toEqual({
      written: [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN],
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [],
        },
      },
    });
  });

  it.each<SubfolderRow>([
    {
      name: "reads the root config only when the repository declares a repository-root lookup, whatever a subfolder config holds",
      folder: "repository-root-lookup",
      rootConfig: TEAM_CONFIG,
      rootProjection: PROJECTION,
      subConfig: CONFIG_WITHOUT_THE_CHECKS,
      subProjection: SUB_PROJECTION,
      tracked: [repoPathOf("sub/kept.ts")],
      answered: [],
      lookup: "repository-root",
      report: {
        hits: [CLASS_IN_SUB],
        nativeExceptions: [],
        measured: [MEASURED_IN_SUB],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "reports a file as ignored, as version 1 does, when its broken subfolder config sits in a folder the root config ignores",
      folder: "broken-ignored-config",
      rootConfig: `import hone from "./hone.eslint.mjs";\nexport default [...hone, { ignores: ["sub/**"] }];\n`,
      rootProjection: PROJECTION,
      subConfig: "export default [;\n",
      subProjection: SUB_PROJECTION,
      tracked: [repoPathOf("sub/kept.ts")],
      answered: [],
      lookup: "nearest-to-file",
      report: {
        hits: [CLASS_IN_SUB],
        nativeExceptions: [
          {
            kind: "ignore",
            file: repoPathOf("sub/kept.ts"),
            check: "authored-class-or-this#class-keyword",
          },
        ],
        measured: [MEASURED_IN_SUB],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
    {
      name: "matches an answer for a package file in that package's own hone.eslint.mjs, written relative to the package, without reporting its off block as an override",
      folder: "answered-package-file",
      rootConfig: CONFIG_WITHOUT_THE_CHECKS,
      rootProjection: `import hone from "../../../src/eslint-plugin.ts";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } },
{ name: "hone/answered/authored-class-or-this#class-keyword", files: ["sub/kept.ts"], rules: { "hone/authored-class-or-this#class-keyword": "off" } }];
`,
      subConfig: `import hone from "./hone.eslint.mjs";\nexport default [{ files: ["**/*.ts"] }, ...hone];\n`,
      subProjection: `import hone from "../../../../src/eslint-plugin.ts";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } },
{ name: "hone/answered/authored-class-or-this#class-keyword", files: ["kept.ts"], rules: { "hone/authored-class-or-this#class-keyword": "off" } }];
`,
      tracked: [
        repoPathOf("eslint.config.mjs"),
        repoPathOf("sub/eslint.config.mjs"),
        repoPathOf("sub/kept.ts"),
      ],
      answered: [
        {
          ruleSet: TOOL_RULE_SET,
          symptom: "authored-class-or-this",
          check: "class-keyword",
          file: repoPathOf("sub/kept.ts"),
        },
      ],
      lookup: "nearest-to-file",
      report: {
        hits: [CLASS_IN_SUB],
        nativeExceptions: [],
        measured: [MEASURED_IN_SUB],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    },
  ])("$name", async (subfolder) => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${row.line}-${subfolder.folder}`);
    const toolchain = await loadEslintToolchain({
      peers: { location: PEER_LOCATION, modules: row.toolchainModules },
    });
    assert(toolchain.outcome === "ok", `the ${row.line} toolchain loads`);
    const eslint = createEslintPort({ toolchain: toolchain.value });
    const declarationText = eslint.boundary.declarationText;
    expect([
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/sub` }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: subfolder.rootConfig }),
      fileText.write({ path: `${repo}/hone.eslint.mjs`, text: subfolder.rootProjection }),
      fileText.write({ path: `${repo}/hone.eslint.d.mts`, text: declarationText }),
      fileText.write({ path: `${repo}/sub/eslint.config.mjs`, text: subfolder.subConfig }),
      fileText.write({ path: `${repo}/sub/hone.eslint.mjs`, text: subfolder.subProjection }),
      fileText.write({ path: `${repo}/sub/hone.eslint.d.mts`, text: declarationText }),
      fileText.write({ path: `${repo}/sub/kept.ts`, text: ONE_CLASS }),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN]);
    const runner = createChecksRunner({
      fileText,
      fileRemoval,
      modules: row.pieceModules,
      path,
      eslint,
      moduleExtension: ".ts",
    });

    const outcome = await runner.run({
      repoRoot: repo,
      installRoot: INSTALL_ROOT,
      files: [repoPathOf("sub/kept.ts")],
      trackedPaths: subfolder.tracked,
      checks: CHECKS,
      bindings: BINDINGS,
      answered: subfolder.answered,
      declaredConfigRoots: [],
      declaredConfigLookup: subfolder.lookup,
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });

    expect(outcome).toEqual({ outcome: "ok", value: subfolder.report });
  });
});
