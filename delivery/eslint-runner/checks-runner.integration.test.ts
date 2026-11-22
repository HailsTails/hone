import { afterAll, assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../src/domain/repository/repo-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../src/domain/rule-set/edition-of.ts";
import type { RunnerFailure } from "../../src/domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../src/domain/runner/runner-module-types.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import ESLINT_CD_14_PIECE from "../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/piece.json" with { type: "json" };
import type { ChecksRunRequest } from "../../src/infrastructure/engines/eslint/runner/checks-runner/checks-run-types.ts";
import { createChecksRunner } from "../../src/infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../../src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import {
  CHECKS_DECLARATION_PATH,
  CHECKS_PROJECTION_PATH,
  checksProjectionText,
} from "../../src/infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import {
  createEslintPort,
  type EslintPort,
  type EslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  installedEslintBoundary,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import type { EmbeddedRunner } from "../../src/infrastructure/engines/protocol/embedded/embedded-runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../../src/infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultScratchFilesPort,
  type ScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const installedBoundary = await installedEslintBoundary();

if (installedBoundary.outcome === "failed") {
  throw new Error(installedBoundary.error);
}

const DECLARATION_TEXT: string = installedBoundary.value.declarationText;

type ScratchRepositories = {
  readonly repositoryWith: (request: {
    readonly files: Readonly<Record<string, string>>;
  }) => AbsolutePath;
  readonly removeAll: () => void;
};

const scratchRepositoriesUnder = (request: {
  readonly parent: string;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
}): ScratchRepositories => {
  const made: AbsolutePath[] = [];
  return {
    repositoryWith: (repository) => {
      const folder = absolutePathSchema.parse(
        `${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`,
      );
      const directory = request.scratch.makeDirectory({ path: folder });
      if (directory.outcome !== "ok") {
        throw new Error(
          `a scratch folder could not be made at ${folder}: ${directory.error.detail}`,
        );
      }
      made.push(folder);
      Object.entries(repository.files).forEach(([name, text]) => {
        request.fileText.write({ path: `${folder}/${name}`, text });
      });
      return folder;
    },
    removeAll: () => {
      made.forEach((folder) => {
        request.scratch.removeTree({ path: folder });
      });
    },
  };
};

const repositoryWithSubfolder = (request: {
  readonly repositories: ScratchRepositories;
  readonly scratch: Pick<ScratchFilesPort, "makeDirectory">;
  readonly fileText: Pick<FileTextPort, "write">;
  readonly files: Readonly<Record<string, string>>;
  readonly subfolder: string;
  readonly subfolderFiles: Readonly<Record<string, string>>;
}): AbsolutePath => {
  const repo = request.repositories.repositoryWith({ files: request.files });
  const folder = `${repo}/${request.subfolder}`;
  const made = request.scratch.makeDirectory({ path: folder });
  if (made.outcome !== "ok") {
    throw new Error(`a scratch subfolder could not be made at ${folder}: ${made.error.detail}`);
  }
  Object.entries(request.subfolderFiles).forEach(([name, text]) => {
    const written = request.fileText.write({ path: `${folder}/${name}`, text });
    if (written.outcome !== "ok") {
      throw new Error(
        `a scratch file could not be written at ${folder}/${name}: ${written.error.detail}`,
      );
    }
  });
  return repo;
};

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
});

const LINES: Readonly<Record<EslintLine, LineDefinition>> = {
  "eslint-10": {
    eslintVersion: /^10\./,
    modules: DEVELOPMENT_PEERS.modules,
    pieceModules: (request) => request.base,
  },
  "eslint-9": {
    eslintVersion: /^9\./,
    modules: eslint9ToolchainModules,
    pieceModules: eslint9PieceModules,
  },
};

const loadedEslintToolchain = async (request: {
  readonly line: EslintLine;
}): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({
    peers: { location: DEVELOPMENT_PEERS.location, modules: LINES[request.line].modules },
  });
  assert(
    loaded.outcome === "ok",
    `the ${request.line} toolchain loads from the development install`,
  );
  assert(
    LINES[request.line].eslintVersion.test(loaded.value.eslintVersion),
    `the ${request.line} toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

const eslintPortOn = async (request: { readonly line: EslintLine }): Promise<EslintPort> =>
  createEslintPort({ toolchain: await loadedEslintToolchain(request) });

const pieceModulesOn = (request: {
  readonly line: EslintLine;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => LINES[request.line].pieceModules({ base: request.base });

const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then(
      (toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain }),
    ),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const REPOSITORY_ROOT = absolutePathSchema.parse(
  createDefaultPathPort({}).join({ segments: [import.meta.dirname, "..", ".."] }),
);

const CATALOGUE_HOLDING = readBoundCatalogue({
  directory: createDefaultDirectoryPort({}),
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  ruleSetRoot: REPOSITORY_ROOT,
  installRoot: REPOSITORY_ROOT,
});

assert(CATALOGUE_HOLDING.outcome === "ok", "this repository's catalogue reads");

assert(CATALOGUE_HOLDING.value.held === "catalogue", "this repository holds a catalogue");

const CATALOGUE = CATALOGUE_HOLDING.value.catalogue;

const CLASS_SYNTAX = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};

const CLASS_CHECK = "authored-class-or-this#class-keyword";

const CLASS_RULE = "hone/authored-class-or-this#class-keyword";

const SOURCE_FILE = repoPathOf("kept.ts");

const BINDING_SETTINGS = ESLINT_CD_14_PIECE.settings;

const PIECE_ROOT = `${INSTALL_ROOT}/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword`;

const BINDINGS: ChecksRunRequest["bindings"] = [
  {
    mechanism: "eslint",
    clause: { address: CLASS_SYNTAX, pieceRoot: PIECE_ROOT, settings: BINDING_SETTINGS },
  },
];

const CLASS_PROJECTED = {
  symptom: "authored-class-or-this",
  check: "class-keyword",
  ruleId: CLASS_RULE,
  options: [],
};

const PROJECTION_TEXT = checksProjectionText({
  pluginImport: "../../src/eslint-plugin.ts",
  checks: [CLASS_PROJECTED],
  answered: [],
});

const TEAM_CONFIG = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [...hone];\n`;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({
  parent: `${INSTALL_ROOT}/artefacts`,
  fileText,
  scratch,
});

const repositoryHoldingSub = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly sub: Readonly<Record<string, string>>;
}) =>
  repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { [CHECKS_DECLARATION_PATH]: DECLARATION_TEXT, ...request.files },
    subfolder: "sub",
    subfolderFiles: { [CHECKS_DECLARATION_PATH]: DECLARATION_TEXT, ...request.sub },
  });

afterAll(() => {
  repositories.removeAll();
});

const ROOT_FILE_RUN: {
  readonly answered: ChecksRunRequest["answered"];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly declaredConfigLookup: ChecksRunRequest["declaredConfigLookup"];
  readonly queried: readonly RepoPath[];
  readonly tracked: readonly RepoPath[];
  readonly sub: Readonly<Record<string, string>>;
} = {
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  queried: [SOURCE_FILE],
  tracked: [SOURCE_FILE],
  sub: {},
};

const runnerOn = async (request: { readonly line: EslintLine }) =>
  createChecksRunner({
    fileText,
    fileRemoval: createDefaultFileRemovalPort({}),
    modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
    path: createDefaultPathPort({}),
    eslint: await eslintPortOn({ line: request.line }),
    moduleExtension: ".ts",
  });

const runOver = async (request: {
  readonly line: EslintLine;
  readonly files: Readonly<Record<string, string>>;
  readonly answered: ChecksRunRequest["answered"];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly declaredConfigLookup: ChecksRunRequest["declaredConfigLookup"];
  readonly queried: readonly RepoPath[];
  readonly tracked: readonly RepoPath[];
  readonly sub: Readonly<Record<string, string>>;
}) => {
  const runner = await runnerOn(request);
  return runner.run({
    repoRoot: repositoryHoldingSub(request),
    installRoot: INSTALL_ROOT,
    files: request.queried,
    trackedPaths: request.tracked,
    checks: CATALOGUE.checks,
    bindings: BINDINGS,
    answered: request.answered,
    declaredConfigRoots: request.declaredConfigRoots,
    declaredConfigLookup: request.declaredConfigLookup,
  });
};

const IGNORING_THE_SOURCE = `import hone from "./${CHECKS_PROJECTION_PATH}";
export default [{ ignores: ["kept.ts"] }, ...hone];
`;

const ADOPTED = { "eslint.config.mjs": TEAM_CONFIG, [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT };

const CLASS_HIT = {
  clause: CLASS_SYNTAX,
  file: "kept.ts",
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  check: CLASS_CHECK,
};

const CLASS_HIT_ON_LINE_2 = { ...CLASS_HIT, anchor: { line: 2, column: 7 } };

const MEASURED = [{ clause: CLASS_SYNTAX, file: "kept.ts" }];

const ONE_CLASS = "export class Kept {}\n";

const sourceDisabling = (request: { readonly ruleId: string }): string =>
  `// eslint-disable-next-line ${request.ruleId}\n${ONE_CLASS}`;

const REPORT = {
  hits: [],
  nativeExceptions: [],
  measured: [],
  misnamedRuleIds: [],
  projection: "current",
  slices: [],
};

const V1_CLAUSE: RunnerClause = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: PIECE_ROOT,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: BINDING_SETTINGS,
};

const V1_CONFIG = `import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n`;

const REPOSITORY_ROOT_LOOKUP: ChecksRunRequest["declaredConfigLookup"] = "repository-root";

const SUB_FILE = repoPathOf("sub/kept.ts");

const SUB_CONFIG_WITHOUT_THE_CHECKS = `export default [{ files: ["**/*.ts"], rules: {} }];
`;

const SUB_HIT = { ...CLASS_HIT, file: "sub/kept.ts" };

const SUB_FILES = { "eslint.config.mjs": SUB_CONFIG_WITHOUT_THE_CHECKS, "kept.ts": ONE_CLASS };

const IGNORING_SUB_CONFIG = `import hone from "./${CHECKS_PROJECTION_PATH}";
export default [...hone, { ignores: ["sub/**"] }];
`;

const V1_IGNORING_SUB_CONFIG = `import projection from "./disciplines.eslint.mjs";
export default [...projection, { ignores: ["sub/**"] }];
`;

const BROKEN_SUB_FILES = { "eslint.config.mjs": "export default [;\n", "kept.ts": ONE_CLASS };

const SUPPRESSIONS_PATH = repoPathOf("eslint-suppressions.json");

const PACKAGE_PATH = repoPathOf("package.json");

const SUPPRESSIONS = `{ "kept.ts": { "hone/authored-class-or-this#class-keyword": { "count": 1 } } }\n`;

const SUPPRESS_SCRIPT = `{ "scripts": { "lint:suppress": "eslint --suppress-all ." } }\n`;

const V1_RUN = {
  installRoot: INSTALL_ROOT,
  files: [SOURCE_FILE],
  trackedPaths: [SOURCE_FILE],
  clauses: [V1_CLAUSE],
  declaredConfigRoots: [],
};

describe.each(ESLINT_LINES)(
  "the version 2 ESLint runner on %s, over a repository whose config spreads hone.eslint.mjs",
  (line) => {
    it("reports a class in its file, position and snippet, naming its check", async () => {
      expect(
        await runOver({ ...ROOT_FILE_RUN, line, files: { ...ADOPTED, "kept.ts": ONE_CLASS } }),
      ).toEqual({
        outcome: "ok",
        value: { ...REPORT, hits: [CLASS_HIT], measured: MEASURED },
      });
    });

    it("reports the same file, position and snippet as the version 1 runner does for the same source", async () => {
      const repoRoot = repositories.repositoryWith({
        files: { "eslint.config.mjs": V1_CONFIG, "kept.ts": ONE_CLASS },
      });
      const runner = eslintRunnerOn({ line });
      await runner.project({ ...V1_RUN, repoRoot, records: [] });
      expect(await runner.run({ ...V1_RUN, repoRoot, records: [] })).toMatchObject({
        outcome: "ok",
        value: {
          hits: [
            {
              clause: CLASS_SYNTAX,
              file: "kept.ts",
              anchor: CLASS_HIT.anchor,
              snippet: CLASS_HIT.snippet,
            },
          ],
        },
      });
    });

    it("reports an inline disable written with the check's id as a native exception on that check, beside the hit it does not remove", async () => {
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: { ...ADOPTED, "kept.ts": sourceDisabling({ ruleId: CLASS_RULE }) },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT_ON_LINE_2],
          nativeExceptions: [
            {
              kind: "inline-disable",
              clause: CLASS_SYNTAX,
              file: "kept.ts",
              line: 1,
              text: `// eslint-disable-next-line ${CLASS_RULE}`,
              reach: "one-clause",
              check: CLASS_CHECK,
            },
          ],
          measured: MEASURED,
        },
      });
    });

    it("reports an inline disable written with a version 1 id as misnamed and suppresses nothing", async () => {
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: { ...ADOPTED, "kept.ts": sourceDisabling({ ruleId: "hone/no-class-authoring" }) },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT_ON_LINE_2],
          measured: MEASURED,
          misnamedRuleIds: [
            {
              kind: "version-1-id",
              ruleId: "hone/no-class-authoring",
              file: "kept.ts",
              line: 1,
              text: "// eslint-disable-next-line hone/no-class-authoring",
              replacedBy: ["hone/authored-class-or-this#class-keyword"],
            },
          ],
        },
      });
    });

    it("reports an inline disable that gives a reason after the check's id as a native exception whose text keeps the reason", async () => {
      const comment = `// eslint-disable-next-line ${CLASS_RULE} -- inherited from the billing module`;
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: { ...ADOPTED, "kept.ts": `${comment}\n${ONE_CLASS}` },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT_ON_LINE_2],
          nativeExceptions: [
            {
              kind: "inline-disable",
              clause: CLASS_SYNTAX,
              file: "kept.ts",
              line: 1,
              text: comment,
              reach: "one-clause",
              check: CLASS_CHECK,
            },
          ],
          measured: MEASURED,
        },
      });
    });

    it("reports an inline rule configuration written with the check's id as a native exception on that check", async () => {
      const comment = `/* eslint ${CLASS_RULE}: "off" */`;
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: { ...ADOPTED, "kept.ts": `${comment}\n${ONE_CLASS}` },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT_ON_LINE_2],
          nativeExceptions: [
            {
              kind: "inline-rule-config",
              clause: CLASS_SYNTAX,
              file: "kept.ts",
              line: 1,
              text: comment,
              check: CLASS_CHECK,
            },
          ],
          measured: MEASURED,
        },
      });
    });

    it("reports an inline disable whose id splits the check's address with a slash as misnamed, naming no check, and suppresses nothing", async () => {
      const comment = "// eslint-disable-next-line hone/authored-class-or-this/class-keyword";
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: { ...ADOPTED, "kept.ts": `${comment}\n${ONE_CLASS}` },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT_ON_LINE_2],
          measured: MEASURED,
          misnamedRuleIds: [
            {
              kind: "names-no-check",
              ruleId: "hone/authored-class-or-this/class-keyword",
              file: "kept.ts",
              line: 1,
              text: comment,
            },
          ],
        },
      });
    });

    it("does not call a disable misnamed when it names a real check of the catalogue that the repository has not selected", async () => {
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: {
            ...ADOPTED,
            "kept.ts": sourceDisabling({
              ruleId: "hone/authored-class-or-this#static-members-only",
            }),
          },
        }),
      ).toEqual({
        outcome: "ok",
        value: { ...REPORT, hits: [CLASS_HIT_ON_LINE_2], measured: MEASURED },
      });
    });

    it("reports a global ignore over the source as a native exception on the check", async () => {
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: {
            "eslint.config.mjs": IGNORING_THE_SOURCE,
            [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT,
            "kept.ts": ONE_CLASS,
          },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT],
          nativeExceptions: [
            { kind: "ignore", clause: CLASS_SYNTAX, file: "kept.ts", check: CLASS_CHECK },
          ],
          measured: MEASURED,
        },
      });
    });

    it("reports a config override of the check's rule after the projection as a native exception on that check", async () => {
      const config = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [...hone, { rules: { "${CLASS_RULE}": "off" } }];\n`;
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          files: {
            "eslint.config.mjs": config,
            [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT,
            "kept.ts": ONE_CLASS,
          },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT],
          nativeExceptions: [
            { kind: "config-override", clause: CLASS_SYNTAX, file: "kept.ts", check: CLASS_CHECK },
          ],
          measured: MEASURED,
        },
      });
    });

    it("does not report the projection's own off block over an answered file as an override", async () => {
      const answered = [
        { symptom: "authored-class-or-this", check: "class-keyword", file: SOURCE_FILE },
      ];
      const projection = checksProjectionText({
        pluginImport: "../../src/eslint-plugin.ts",
        checks: [CLASS_PROJECTED],
        answered,
      });
      expect(
        await runOver({
          ...ROOT_FILE_RUN,
          line,
          answered,
          files: {
            "eslint.config.mjs": TEAM_CONFIG,
            [CHECKS_PROJECTION_PATH]: projection,
            "kept.ts": ONE_CLASS,
          },
        }),
      ).toEqual({
        outcome: "ok",
        value: { ...REPORT, hits: [CLASS_HIT], measured: MEASURED },
      });
    });

    it("reads the root config only, as version 1 does, when the repository declares a repository-root lookup, whatever a subfolder config holds", async () => {
      const run = {
        ...ROOT_FILE_RUN,
        line,
        queried: [SUB_FILE],
        tracked: [SUB_FILE],
        declaredConfigLookup: REPOSITORY_ROOT_LOOKUP,
      };
      expect(await runOver({ ...run, files: ADOPTED, sub: SUB_FILES })).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: [{ clause: CLASS_SYNTAX, file: "sub/kept.ts" }],
        },
      });
    });

    it("reports the same hit as version 1 does for the same subfolder source under a declared repository-root lookup", async () => {
      const repoRoot = repositoryHoldingSub({
        files: {
          "eslint.config.mjs": V1_CONFIG,
          "disciplines.json": '{ "eslintConfigLookup": "repository-root" }',
        },
        sub: SUB_FILES,
      });
      const runner = eslintRunnerOn({ line });
      const v1Run = {
        ...V1_RUN,
        repoRoot,
        files: [SUB_FILE],
        trackedPaths: [SUB_FILE],
        records: [],
      };
      await runner.project(v1Run);
      expect(await runner.run(v1Run)).toMatchObject({
        outcome: "ok",
        value: {
          hits: [
            {
              clause: CLASS_SYNTAX,
              file: "sub/kept.ts",
              anchor: SUB_HIT.anchor,
              snippet: SUB_HIT.snippet,
            },
          ],
        },
      });
    });

    it("reports a file as ignored, as version 1 does, when its broken subfolder config sits in a folder the root config ignores", async () => {
      const run = { ...ROOT_FILE_RUN, line, queried: [SUB_FILE], tracked: [SUB_FILE] };
      expect(
        await runOver({
          ...run,
          files: { ...ADOPTED, "eslint.config.mjs": IGNORING_SUB_CONFIG },
          sub: BROKEN_SUB_FILES,
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: [{ clause: CLASS_SYNTAX, file: "sub/kept.ts" }],
          nativeExceptions: [
            { kind: "ignore", clause: CLASS_SYNTAX, file: "sub/kept.ts", check: CLASS_CHECK },
          ],
        },
      });
    });

    it("reports the same ignore as version 1 does for the same broken subfolder config under the same root config", async () => {
      const repoRoot = repositoryHoldingSub({
        files: { "eslint.config.mjs": V1_IGNORING_SUB_CONFIG },
        sub: BROKEN_SUB_FILES,
      });
      const runner = eslintRunnerOn({ line });
      const v1Run = {
        ...V1_RUN,
        repoRoot,
        files: [SUB_FILE],
        trackedPaths: [SUB_FILE],
        records: [],
      };
      await runner.project(v1Run);
      expect(await runner.run(v1Run)).toMatchObject({
        outcome: "ok",
        value: {
          nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "sub/kept.ts" }],
        },
      });
    });

    it("reports an entry in the default eslint-suppressions.json as a suppression-entry on that check, beside the hit it does not remove", async () => {
      const run = { ...ROOT_FILE_RUN, line, tracked: [SOURCE_FILE, SUPPRESSIONS_PATH] };
      expect(
        await runOver({
          ...run,
          files: { ...ADOPTED, "kept.ts": ONE_CLASS, "eslint-suppressions.json": SUPPRESSIONS },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT],
          measured: MEASURED,
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX,
              file: "kept.ts",
              location: "eslint-suppressions.json",
              check: CLASS_CHECK,
            },
          ],
        },
      });
    });

    it("reports a package.json script option that weakens the whole run as a command-line-option on that check", async () => {
      const run = { ...ROOT_FILE_RUN, line, tracked: [SOURCE_FILE, PACKAGE_PATH] };
      expect(
        await runOver({
          ...run,
          files: { ...ADOPTED, "kept.ts": ONE_CLASS, "package.json": SUPPRESS_SCRIPT },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [CLASS_HIT],
          measured: MEASURED,
          nativeExceptions: [
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX,
              location: "package.json",
              script: "lint:suppress",
              option: "--suppress-all",
              cause: { kind: "weakens-run" },
              check: CLASS_CHECK,
            },
          ],
        },
      });
    });
  },
);

const SUB_SLICE = repoPathOf("sub/hone.eslint.mjs");

const SUB_DECLARATION_PATH = repoPathOf(`sub/${CHECKS_DECLARATION_PATH}`);

const ROOT_DECLARATION = { file: CHECKS_DECLARATION_PATH, text: DECLARATION_TEXT };

const SUB_DECLARATION = { file: SUB_DECLARATION_PATH, text: DECLARATION_TEXT };

const SUB_PROJECTION_TEXT = checksProjectionText({
  pluginImport: "../../../src/eslint-plugin.ts",
  checks: [CLASS_PROJECTED],
  answered: [],
});

const PACKAGE_CONFIG = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [{ files: ["**/*.ts"] }, ...hone];\n`;

const PACKAGE_RUN = {
  ...ROOT_FILE_RUN,
  declaredConfigLookup: "nearest-to-file" as const,
  queried: [SUB_FILE],
  tracked: [repoPathOf("eslint.config.mjs"), repoPathOf("sub/eslint.config.mjs"), SUB_FILE],
  files: {
    "eslint.config.mjs": SUB_CONFIG_WITHOUT_THE_CHECKS,
    [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT,
  },
  sub: {
    "eslint.config.mjs": PACKAGE_CONFIG,
    "kept.ts": ONE_CLASS,
    [CHECKS_PROJECTION_PATH]: SUB_PROJECTION_TEXT,
  },
};

describe.each(ESLINT_LINES)(
  "the version 2 ESLint runner on %s, over a repository whose package config spreads its own hone.eslint.mjs",
  (line) => {
    it("projects the root file and the package's file as the texts on disk, and reports the projection current and the class in the package's file", async () => {
      const runner = await runnerOn({ line });
      const repoRoot = repositoryHoldingSub(PACKAGE_RUN);
      const projected = await runner.project({
        repoRoot,
        installRoot: INSTALL_ROOT,
        files: PACKAGE_RUN.queried,
        trackedPaths: PACKAGE_RUN.tracked,
        checks: CATALOGUE.checks,
        bindings: BINDINGS,
        answered: [],
        declaredConfigRoots: [],
        declaredConfigLookup: PACKAGE_RUN.declaredConfigLookup,
      });
      const run = await runner.run({
        repoRoot,
        installRoot: INSTALL_ROOT,
        files: PACKAGE_RUN.queried,
        trackedPaths: PACKAGE_RUN.tracked,
        checks: CATALOGUE.checks,
        bindings: BINDINGS,
        answered: [],
        declaredConfigRoots: [],
        declaredConfigLookup: PACKAGE_RUN.declaredConfigLookup,
      });
      expect({ projected, run }).toEqual({
        projected: {
          outcome: "ok",
          value: [
            { file: CHECKS_PROJECTION_PATH, text: PROJECTION_TEXT },
            { file: SUB_SLICE, text: SUB_PROJECTION_TEXT },
            ROOT_DECLARATION,
            SUB_DECLARATION,
          ],
        },
        run: {
          outcome: "ok",
          value: {
            ...REPORT,
            hits: [SUB_HIT],
            measured: [{ clause: CLASS_SYNTAX, file: "sub/kept.ts" }],
          },
        },
      });
    });

    it("matches an answer for a package file in that package's own file, written relative to the package, without reporting its off block as an override", async () => {
      const answered = [
        { symptom: "authored-class-or-this", check: "class-keyword", file: SUB_FILE },
      ];
      const answeredWithinSub = [
        { symptom: "authored-class-or-this", check: "class-keyword", file: SOURCE_FILE },
      ];
      const rootText = checksProjectionText({
        pluginImport: "../../src/eslint-plugin.ts",
        checks: [CLASS_PROJECTED],
        answered,
      });
      const subText = checksProjectionText({
        pluginImport: "../../../src/eslint-plugin.ts",
        checks: [CLASS_PROJECTED],
        answered: answeredWithinSub,
      });
      const outcome = await runOver({
        ...PACKAGE_RUN,
        line,
        answered,
        files: { ...PACKAGE_RUN.files, [CHECKS_PROJECTION_PATH]: rootText },
        sub: { ...PACKAGE_RUN.sub, [CHECKS_PROJECTION_PATH]: subText },
      });
      expect(outcome).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: [{ clause: CLASS_SYNTAX, file: "sub/kept.ts" }],
        },
      });
    });
  },
);

const SUB_DIRECTORY = repoPathOf("sub");

const ROOT_CONFIG_IMPORTING_THE_SUB_SLICE = `import hone from "./${CHECKS_PROJECTION_PATH}";
import sub from "./${SUB_SLICE}";
export default [...hone, ...sub];
`;

const SUB_MEASURED = [{ clause: CLASS_SYNTAX, file: "sub/kept.ts" }];

const ANSWERED_IN_SUB = [
  { symptom: "authored-class-or-this", check: "class-keyword", file: SUB_FILE },
];

const ROOT_TEXT_ANSWERING_SUB = checksProjectionText({
  pluginImport: "../../src/eslint-plugin.ts",
  checks: [CLASS_PROJECTED],
  answered: ANSWERED_IN_SUB,
});

const SUB_TEXT_ANSWERING_ITS_FILE = checksProjectionText({
  pluginImport: "../../../src/eslint-plugin.ts",
  checks: [CLASS_PROJECTED],
  answered: [{ symptom: "authored-class-or-this", check: "class-keyword", file: SOURCE_FILE }],
});

const DECLARED_RUN = {
  ...PACKAGE_RUN,
  declaredConfigRoots: [SUB_DIRECTORY],
  answered: ANSWERED_IN_SUB,
  files: { ...PACKAGE_RUN.files, [CHECKS_PROJECTION_PATH]: ROOT_TEXT_ANSWERING_SUB },
  sub: {
    "eslint.config.mjs": PACKAGE_CONFIG,
    "kept.ts": ONE_CLASS,
    [CHECKS_PROJECTION_PATH]: SUB_TEXT_ANSWERING_ITS_FILE,
  },
};

describe.each(ESLINT_LINES)(
  "the version 2 ESLint runner on %s, over a repository that declares a config root whose config spreads its own hone.eslint.mjs",
  (line) => {
    it("reports the class in the declared folder, with its answer matched in that folder's own file, and no slice problem", async () => {
      expect(await runOver({ ...DECLARED_RUN, line })).toEqual({
        outcome: "ok",
        value: { ...REPORT, hits: [SUB_HIT], measured: SUB_MEASURED },
      });
    });

    it("names the declared folder's file out of date, and still reports the class, when that file differs from what project writes", async () => {
      const sub = {
        ...DECLARED_RUN.sub,
        [CHECKS_PROJECTION_PATH]: `${SUB_TEXT_ANSWERING_ITS_FILE}\n`,
      };
      expect(await runOver({ ...DECLARED_RUN, line, sub })).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: SUB_MEASURED,
          slices: [{ slice: SUB_SLICE, state: "out-of-date" }],
        },
      });
    });

    it("names the declared folder's file missing, and lints nothing, when that file is not written", async () => {
      const sub = { "eslint.config.mjs": PACKAGE_CONFIG, "kept.ts": ONE_CLASS };
      expect(await runOver({ ...DECLARED_RUN, line, sub })).toEqual({
        outcome: "ok",
        value: { ...REPORT, slices: [{ slice: SUB_SLICE, state: "missing" }] },
      });
    });

    it("names the declared folder's declaration out of date, and still reports the class, when it differs from what project writes", async () => {
      const sub = { ...DECLARED_RUN.sub, [CHECKS_DECLARATION_PATH]: "export {};\n" };
      expect(await runOver({ ...DECLARED_RUN, line, sub })).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: SUB_MEASURED,
          slices: [{ slice: SUB_DECLARATION_PATH, state: "out-of-date" }],
        },
      });
    });

    it("gives the declared folder's file beside the root file, each holding the answers that belong to it", async () => {
      const runner = await runnerOn({ line });
      const projected = await runner.project({
        repoRoot: repositoryHoldingSub(DECLARED_RUN),
        installRoot: INSTALL_ROOT,
        files: DECLARED_RUN.queried,
        trackedPaths: DECLARED_RUN.tracked,
        checks: CATALOGUE.checks,
        bindings: BINDINGS,
        answered: ANSWERED_IN_SUB,
        declaredConfigRoots: DECLARED_RUN.declaredConfigRoots,
        declaredConfigLookup: DECLARED_RUN.declaredConfigLookup,
      });
      expect(projected).toEqual({
        outcome: "ok",
        value: [
          { file: CHECKS_PROJECTION_PATH, text: ROOT_TEXT_ANSWERING_SUB },
          { file: SUB_SLICE, text: SUB_TEXT_ANSWERING_ITS_FILE },
          ROOT_DECLARATION,
          SUB_DECLARATION,
        ],
      });
    });
  },
);

const UNCONFIGURED_RUN = {
  ...ROOT_FILE_RUN,
  declaredConfigRoots: [SUB_DIRECTORY],
  queried: [SUB_FILE],
  tracked: [repoPathOf("eslint.config.mjs"), SUB_FILE],
  sub: { "kept.ts": ONE_CLASS, [CHECKS_PROJECTION_PATH]: SUB_PROJECTION_TEXT },
};

describe.each(ESLINT_LINES)(
  "the version 2 ESLint runner on %s, over a repository that declares a config root holding no eslint.config.*",
  (line) => {
    it("names the declared folder's file unconfigured, though it is written and current, under a repository-root lookup", async () => {
      const run = {
        ...UNCONFIGURED_RUN,
        line,
        declaredConfigLookup: REPOSITORY_ROOT_LOOKUP,
        files: {
          "eslint.config.mjs": ROOT_CONFIG_IMPORTING_THE_SUB_SLICE,
          [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT,
        },
      };
      expect(await runOver(run)).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: SUB_MEASURED,
          slices: [{ slice: SUB_SLICE, state: "unconfigured" }],
        },
      });
    });

    it("names the declared folder's file unconfigured, though it is written and current, when each file looks up its nearest config", async () => {
      const run = {
        ...UNCONFIGURED_RUN,
        line,
        declaredConfigLookup: "nearest-to-file" as const,
        files: ADOPTED,
      };
      expect(await runOver(run)).toEqual({
        outcome: "ok",
        value: {
          ...REPORT,
          hits: [SUB_HIT],
          measured: SUB_MEASURED,
          slices: [{ slice: SUB_SLICE, state: "unconfigured" }],
        },
      });
    });
  },
);
