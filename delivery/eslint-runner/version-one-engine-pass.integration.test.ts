import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../src/application/ports/git-port.ts";
import type { ModuleExtension } from "../../src/application/ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { ShownPathOf } from "../../src/application/ports/installation/shown-path-of.ts";
import type { ExceptionEntryParser } from "../../src/application/ports/records/exception-entries.ts";
import type { ExceptionRepository } from "../../src/application/ports/records/exception-repository.ts";
import type { SelectionRepository } from "../../src/application/ports/selection/selection-repository.ts";
import type { SelectionRepositoryOf } from "../../src/application/ports/selection/selection-repository.ts";
import type { FileCarveOutRecord } from "../../src/application/ports/upgrade/record-answer-oracle.ts";
import { createAnsweringOracle } from "../../src/application/upgrade/record-answers/answering-oracle.ts";
import { createUpgradeBefore } from "../../src/application/upgrade/record-answers/upgrade-before.ts";
import type { Finding } from "../../src/domain/finding/governance.ts";
import type { Check } from "../../src/domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../src/domain/repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../src/domain/settings/check-choices.ts";
import { shownPathOfRepository } from "../../src/infrastructure/command-line/installation/shown-path.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
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
import { createNamedEnginePort } from "../../src/infrastructure/engines/protocol/engine-port.ts";
import { measureVersionOneProjection } from "../../src/infrastructure/engines/protocol/engine-run/engine-run.ts";
import { loadVersionOneProjectionOver } from "../../src/infrastructure/engines/protocol/upgrade/load-version-one-projection.ts";
import { DEFAULT_ASSESSMENT } from "../../src/infrastructure/hone-config-file/assessment.ts";
import {
  createCheckPieceSource,
  createSettingsSources,
} from "../../src/infrastructure/hone-config-file/settings-sources.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { loadFailureDetail } from "../../src/infrastructure/printed-report/load-failures/load-failure-text.ts";
import {
  createDefaultScratchFilesPort,
  type ScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

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

const shippedCheckOf = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly discipline: string;
  readonly name: string;
}): Check => {
  const [only, ...others] = request.catalogues.flatMap(({ catalogue }) =>
    catalogue.checks.filter(
      (check) => check.name === request.name && check.clause?.discipline === request.discipline,
    ),
  );
  if (only === undefined || others.length > 0) {
    throw new Error(
      `the shipped catalogue does not hold exactly one ${request.name} check of ${request.discipline}`,
    );
  }
  return only;
};

const SINGLE_FILE = repoPathOf("discipline-exceptions.json");

const SPLIT_FOLDER_NAME = "discipline-exceptions";

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
      list: ({ path }) => ({
        outcome: "failed",
        error: {
          kind: "directory-unreadable",
          path,
          detail: "the single-file fake holds no folders",
        },
      }),
      create: ({ path }) => ({
        outcome: "failed",
        error: {
          kind: "directory-uncreatable",
          path,
          detail: "the single-file fake holds no folders",
        },
      }),
    },
    fileRemoval: {
      remove: ({ path }) => ({
        outcome: "failed",
        error: { kind: "unremovable", path, detail: "the single-file fake removes nothing" },
      }),
    },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE] }) },
  });

type DiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

type SingleFileRecords = {
  readonly selectionRepository: SelectionRepository;
  readonly selectionRepositoryOf: SelectionRepositoryOf;
  readonly exceptionRepository: ExceptionRepository;
  readonly exceptionEntryParser: ExceptionEntryParser;
  readonly shownPathOf: ShownPathOf;
};

const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & SingleFileRecords => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  selectionRepositoryOf: createSelectionRepository,
  exceptionRepository: singleFileRepositoryOver(request),
  exceptionEntryParser,
  shownPathOf: shownPathOfRepository(request),
});

const SCRATCH = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({
  parent: `${INSTALL_ROOT}/artefacts`,
  fileText,
  scratch: SCRATCH,
});

afterAll(() => {
  repositories.removeAll();
});

const SELECTION =
  '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const EXCEPTIONS =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/kept.ts", "reason": "legacy class" }] }\n';

const TEAM_CONFIG =
  'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const UNPROJECTING_CONFIG = 'export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];\n';

const KEPT_SOURCE = "export class Kept {}\n";

const resolvedRunner = path.resolve({
  path: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/runner.ts`,
});
assert(resolvedRunner.outcome === "ok", "the ESLint runner path resolves");

const ESLINT_RUNNER = resolvedRunner.value;

type CheckPorts = {
  readonly modules: ModuleLoaderPort;
  readonly ports: {
    readonly repoRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly moduleExtension: ".ts";
    readonly fileText: typeof fileText;
    readonly path: typeof path;
    readonly git: GitPort;
  };
};

const checkPortsOver = (request: {
  readonly repoRoot: AbsolutePath;
  readonly tracked: readonly RepoPath[];
}): CheckPorts => {
  const pieceModules: ModuleLoaderPort = { load: createDefaultModuleLoaderPort({}).load };
  const runners: Readonly<Record<string, unknown>> = {
    [ESLINT_RUNNER]: {
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
  const modules: ModuleLoaderPort = {
    load: ({ path: loaded }) => Promise.resolve({ outcome: "ok", value: runners[loaded] }),
  };
  return {
    modules,
    ports: {
      repoRoot: request.repoRoot,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts" as const,
      fileText,
      path,
      git: trackedIn({ files: request.tracked }),
    },
  };
};

const repositoryOf = (request: {
  readonly files: Readonly<Record<string, string>>;
}): AbsolutePath =>
  repositoryWithSubfolder({
    repositories,
    scratch: SCRATCH,
    fileText,
    files: request.files,
    subfolder: "src",
    subfolderFiles: { "kept.ts": KEPT_SOURCE },
  });

const carvedRepository = async (): Promise<AbsolutePath> => {
  const repoRoot = repositoryOf({
    files: {
      "disciplines.json": SELECTION,
      "discipline-exceptions.json": EXCEPTIONS,
      "eslint.config.mjs": TEAM_CONFIG,
    },
  });
  const projected = await upgradeBeforeOver({ repoRoot, tracked: [] }).prepareProjections([
    CARVE_OUT,
  ]);
  assert(
    projected.outcome === "ok",
    "the carved repository's projection is written by hone project",
  );
  return repoRoot;
};

const unprojectedRepository = (): AbsolutePath =>
  repositoryOf({
    files: {
      "disciplines.json": SELECTION,
      "discipline-exceptions.json": EXCEPTIONS,
      "eslint.config.mjs": UNPROJECTING_CONFIG,
    },
  });

const KEPT = repoPathOf("src/kept.ts");

const CARVE_OUT: FileCarveOutRecord = {
  kind: "file-carve-out",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-14"),
    clause: clauseIdOf("class-syntax"),
  },
  mechanism: "eslint",
  file: KEPT,
  reason: "legacy class",
};

const CLASS_FINDING: Finding = {
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-14"),
    clause: clauseIdOf("class-syntax"),
  },
  file: KEPT,
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  mechanism: "eslint",
};

const catalogues = () => {
  const holding = readBoundCatalogue({
    ruleSet: "hone",
    directory: createDefaultDirectoryPort({}),
    fileText,
    path,
    ruleSetRoot: INSTALL_ROOT,
    installRoot: INSTALL_ROOT,
  });
  assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
  assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");
  return [{ ruleSet: TOOL_RULE_SET, catalogue: holding.value.catalogue }];
};

const classKeywordCheck = (): Check =>
  shippedCheckOf({ catalogues: catalogues(), discipline: "CD-14", name: "class-keyword" });

const trackedIn = (request: { readonly files: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: request.files }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const upgradeBeforeOver = (request: {
  readonly repoRoot: AbsolutePath;
  readonly tracked: readonly RepoPath[];
}) => {
  const { modules, ports } = checkPortsOver(request);
  const selection = readSelectionFile({
    fileText,
    path: selectionFilePathOf({ path, repoRoot: request.repoRoot }),
  });
  assert(selection.outcome === "ok");
  return createUpgradeBefore({
    check: {
      ...withSingleFileRecords({ ...ports, modules }),
      modules,
      baseRevision: undefined,
      assessment: DEFAULT_ASSESSMENT,
      selectionRepository: createSelectionRepository(ports),
    },
    engine: createNamedEnginePort({}),
    sources: createSettingsSources({ ...ports, directory: createDefaultDirectoryPort({}) }),
    readPiece: createCheckPieceSource(ports),
    selection: selection.value,
    catalogues: catalogues(),
    loadFailureDetail,
    measureVersionOne: measureVersionOneProjection,
    projection: loadVersionOneProjectionOver({
      ...ports,
      modules,
      fileRemoval: createDefaultFileRemovalPort({}),
    }),
  });
};

const CARVED_TRACKED: readonly RepoPath[] = [
  repoPathOf("disciplines.json"),
  repoPathOf("disciplines.eslint.mjs"),
  repoPathOf("eslint.config.mjs"),
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("src/kept.ts"),
];

const UNPROJECTED_TRACKED: readonly RepoPath[] = [
  repoPathOf("disciplines.json"),
  repoPathOf("eslint.config.mjs"),
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("src/kept.ts"),
];

describe("the version 1 engine pass over a real ESLint run of a repository that carves out src/kept.ts", () => {
  it("returns the class finding raw, though the projection it ran under carries the carve-out as a config override", async () => {
    const pass = upgradeBeforeOver({
      repoRoot: await carvedRepository(),
      tracked: CARVED_TRACKED,
    }).enginePass;
    const withCarveOut = await pass.findingsFor({ records: [CARVE_OUT] });
    assert(withCarveOut.outcome === "ok", "the pass runs");
    expect(withCarveOut.value.findings).toEqual([CLASS_FINDING]);
  });

  it("refuses the same projection when given no records, since the records are what its override was projected from", async () => {
    const pass = upgradeBeforeOver({
      repoRoot: await carvedRepository(),
      tracked: CARVED_TRACKED,
    }).enginePass;
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "projection-not-current",
        file: "disciplines.eslint.mjs",
        state: "out-of-date",
      },
    });
  });

  it("lets the oracle credit the carve-out with the findings it holds", async () => {
    const oracle = createAnsweringOracle({
      enginePass: upgradeBeforeOver({ repoRoot: await carvedRepository(), tracked: CARVED_TRACKED })
        .enginePass,
      catalogues: catalogues(),
    });
    const answered = await oracle.answer({ records: [CARVE_OUT] });
    expect(answered).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "findings", checks: [classKeywordCheck()] },
        },
      ],
    });
  });
});

describe("the version 1 engine pass over a real ESLint run of a repository whose config does not include the projection", () => {
  it("fails the pass, since the run was not made", async () => {
    const pass = upgradeBeforeOver({
      repoRoot: unprojectedRepository(),
      tracked: UNPROJECTED_TRACKED,
    }).enginePass;
    await expect(pass.findingsFor({ records: [CARVE_OUT] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.eslint.mjs", state: "missing" },
    });
  });
});
