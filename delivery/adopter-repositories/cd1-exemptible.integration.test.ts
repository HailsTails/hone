import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../src/application/ports/git-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import { versionTwoRunOver } from "../../src/application/run/version-two-run.ts";
import { INSTALLED_PORTS } from "../../src/composition/run-tool-command.ts";
import type { ToolPorts } from "../../src/composition/tool-ports.ts";
import type { RecordsDocument } from "../../src/domain/records/hone-records/hone-record.ts";
import { runVerdictOf } from "../../src/domain/report/report-sections.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../src/domain/repository/repo-path-types.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { versionTwoProjectedOf } from "../../src/operations/project/version-two-project-command.ts";
import {
  createDefaultScratchFilesPort,
  type ListedEntry,
  type ScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";
import authorisedFixture from "./cd1-exempted/discipline-exceptions.json" with { type: "json" };

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

const STORED_LINT_CONFIG_NAME = "lint-config.fixture";

const RESTORED_LINT_CONFIG_NAME = "eslint.config.mjs";

const MODULE_FILE = /\.mjs$/;

const RELATIVE_IMPORT = /from "(\.\.?\/[^"]*)"/g;

const SAME_FOLDER_MARK = "./";

const OUTSIDE_THE_ROOT = "..";

const OUTSIDE_THE_ROOT_PREFIX = `${OUTSIDE_THE_ROOT}/`;

type RehomedImports = {
  readonly text: string;
  readonly path: Pick<PathPort, "join" | "relative">;
  readonly fixtureRoot: string;
  readonly from: string;
  readonly to: string;
};

const leavesTheRoot = (request: { readonly path: string }): "leaves" | "stays" =>
  request.path === OUTSIDE_THE_ROOT || request.path.startsWith(OUTSIDE_THE_ROOT_PREFIX)
    ? "leaves"
    : "stays";

const placeOfTarget = (
  request: Omit<RehomedImports, "text"> & { readonly target: string },
): "inside-the-fixture" | "outside-the-fixture" => {
  const inside = request.path.relative({ from: request.fixtureRoot, to: request.target });
  return inside.relation === "within-root" && leavesTheRoot({ path: inside.path }) === "stays"
    ? "inside-the-fixture"
    : "outside-the-fixture";
};

const rehomedSpecifier = (
  request: Omit<RehomedImports, "text"> & { readonly specifier: string },
): string => {
  const target = request.path.join({ segments: [request.from, request.specifier] });
  if (placeOfTarget({ ...request, target }) === "inside-the-fixture") {
    return request.specifier;
  }
  const location = request.path.relative({ from: request.to, to: target });
  if (location.relation === "different-root") {
    return target;
  }
  return location.path.startsWith(".") ? location.path : `${SAME_FOLDER_MARK}${location.path}`;
};

const rehomedImports = (request: RehomedImports): string =>
  request.text.replace(
    RELATIVE_IMPORT,
    (_whole, specifier: string) => `from "${rehomedSpecifier({ ...request, specifier })}"`,
  );

type FixtureDependencies = {
  readonly repositories: ScratchRepositories;
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
};

type EntryRequest = FixtureDependencies & {
  readonly fixtureRoot: AbsolutePath;
  readonly repo: AbsolutePath;
  readonly entry: ListedEntry;
};

const slashed = (request: { readonly path: string }): string => request.path.replaceAll("\\", "/");

const restoredName = (request: { readonly name: string }): string =>
  request.name === STORED_LINT_CONFIG_NAME ? RESTORED_LINT_CONFIG_NAME : request.name;

const restoredLocation = (request: { readonly entry: ListedEntry }): string => {
  const shown = slashed({ path: request.entry.path });
  const folder = shown.slice(0, shown.length - request.entry.name.length);
  return `${folder}${restoredName({ name: request.entry.name })}`;
};

const failed = (request: { readonly what: string; readonly detail: string }): never => {
  throw new Error(`${request.what}: ${request.detail}`);
};

const copiedFolder = (request: EntryRequest): void => {
  const made = request.scratch.makeDirectory({
    path: `${request.repo}/${slashed({ path: request.entry.path })}`,
  });
  if (made.outcome !== "ok") {
    failed({
      what: `a fixture folder could not be made for ${request.entry.path}`,
      detail: made.error.detail,
    });
  }
};

const textOf = (request: EntryRequest): string => {
  const read = request.fileText.read({
    path: `${request.fixtureRoot}/${slashed({ path: request.entry.path })}`,
  });
  return read.outcome === "ok"
    ? read.value
    : failed({
        what: `a fixture file could not be read at ${request.entry.path}`,
        detail: read.error.detail,
      });
};

const restoredText = (request: EntryRequest): string => {
  const text = textOf(request);
  if (!MODULE_FILE.test(restoredName({ name: request.entry.name }))) {
    return text;
  }
  const folder = request.path.directoryOf({ path: slashed({ path: request.entry.path }) });
  return rehomedImports({
    text,
    path: request.path,
    fixtureRoot: request.fixtureRoot,
    from: request.path.join({ segments: [request.fixtureRoot, folder] }),
    to: request.path.join({ segments: [request.repo, folder] }),
  });
};

const copiedFile = (request: EntryRequest): void => {
  const target = `${request.repo}/${restoredLocation({ entry: request.entry })}`;
  const written = request.fileText.write({ path: target, text: restoredText(request) });
  if (written.outcome !== "ok") {
    failed({
      what: `a fixture file could not be written at ${target}`,
      detail: written.error.detail,
    });
  }
};

const copiedEntry = (request: EntryRequest): void => {
  if (request.entry.entryKind === "folder") {
    copiedFolder(request);
    return;
  }
  copiedFile(request);
};

const restoredFixture = (
  request: FixtureDependencies & { readonly fixtureRoot: AbsolutePath },
): AbsolutePath => {
  const listed = request.scratch.listTree({ path: request.fixtureRoot });
  if (listed.outcome !== "ok") {
    return failed({
      what: `the fixture at ${request.fixtureRoot} could not be listed`,
      detail: listed.error.detail,
    });
  }
  const repo = request.repositories.repositoryWith({ files: {} });
  const folders = listed.value.filter(({ entryKind }) => entryKind === "folder");
  const files = listed.value.filter(({ entryKind }) => entryKind === "file");
  [...folders, ...files].forEach((entry) => {
    copiedEntry({ ...request, repo, entry });
  });
  const resolved = request.path.resolve({ path: repo });
  return resolved.outcome === "ok"
    ? resolved.value
    : failed({
        what: `the restored repository at ${repo} has no absolute path`,
        detail: resolved.error.path,
      });
};

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../..` });

type FixtureRun = {
  readonly repoRoot: AbsolutePath;
  readonly git: GitPort;
  readonly config: string;
  readonly records: readonly RecordsDocument[];
  readonly baseRevision: string | undefined;
};

const fixtureStages = (request: FixtureRun) => {
  const base = INSTALLED_PORTS;
  const configPath = path.join({ segments: [request.repoRoot, "hone.config.json"] });
  const ports: ToolPorts = {
    ...base,
    git: request.git,
    fileText: {
      ...base.fileText,
      exists: (entry) => (entry.path === configPath ? "present" : base.fileText.exists(entry)),
      read: (entry) =>
        entry.path === configPath
          ? { outcome: "ok", value: request.config }
          : base.fileText.read(entry),
    },
    recordsSourceOf: () => ({
      read: () => ({ outcome: "ok", value: request.records }),
      readAt: () => ({ outcome: "ok", value: request.records }),
    }),
  };
  return base.stagesOver({
    ports,
    locations: {
      repoRoot: request.repoRoot,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      baseRevision: request.baseRevision,
    },
  });
};

const argumentsOf: Parameters<typeof versionTwoRunOver>[0]["arguments"] = {
  forfeiture: undefined,
  reportOutput: undefined,
  measuring: "when-debt-held",
};

const RECORD_ROOT = "hone-records";
const AUTH_FILE = repoPathOf(`${RECORD_ROOT}/authorised-locations/claimed-type.json`);

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [repoPathOf("hone.config.json"), repoPathOf("src/fresh.ts"), repoPathOf("src/parse.ts")],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

describe("the named any-cast check with an authorised location carried from version one", () => {
  it("answers the cast in the authorised adapter and reports a cast elsewhere", async () => {
    const stages = fixtureStages({
      repoRoot: resolvedPath({ path: `${import.meta.dirname}/cd1-exempted` }),
      git,
      config:
        '{"version":2,"ruleSets":{},"checks":{"claimed-type#cast-to-any":"walker"},"forfeiture":"elsewhere"}',
      records: [
        {
          file: AUTH_FILE,
          document: {
            version: 2,
            records: [
              {
                answers: "claimed-type#cast-to-any",
                file: "src/parse.ts",
                carried: authorisedFixture.exceptions[0],
              },
            ],
          },
        },
      ],
      baseRevision: undefined,
    });
    const checked = await versionTwoRunOver({ stages, arguments: argumentsOf });
    expect(checked).toMatchObject({
      outcome: "ok",
      value: {
        report: {
          refused: [],
          findings: [{ check: "claimed-type#cast-to-any", file: "src/fresh.ts" }],
          answered: [
            {
              finding: { file: "src/parse.ts" },
              by: [{ record: { kind: "authorised-location" } }],
            },
          ],
        },
      },
    });
  });
});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({
  parent: resolvedPath({ path: `${import.meta.dirname}/../../artefacts` }),
  fileText: createDefaultFileTextPort({}),
  scratch,
});

afterAll(() => {
  repositories.removeAll();
});

const CASCADE_REPO = restoredFixture({
  repositories,
  scratch,
  fileText: createDefaultFileTextPort({}),
  path,
  fixtureRoot: resolvedPath({ path: `${import.meta.dirname}/cd1-cascade` }),
});

const LEGACY_FILE = repoPathOf("src/legacy.ts");
const CASCADE_SETTINGS =
  '{"version":2,"ruleSets":{},"checks":{"claimed-type#cast-to-any":"walker","untyped-value#explicit-any":"eslint","untyped-value#implicit-any-let":"eslint","loop-keyword#loop-statement":"walker"}}';
const CASCADE_DEBT: readonly RecordsDocument[] = [
  {
    file: repoPathOf("hone-records/debt/claimed-type.json"),
    document: { version: 2, records: [{ answers: "claimed-type#cast-to-any", file: LEGACY_FILE }] },
  },
  {
    file: repoPathOf("hone-records/debt/loop-keyword.json"),
    document: {
      version: 2,
      records: [{ answers: "loop-keyword#loop-statement", file: LEGACY_FILE }],
    },
  },
  {
    file: repoPathOf("hone-records/debt/untyped-value.json"),
    document: {
      version: 2,
      records: [{ answers: "untyped-value#explicit-any", file: LEGACY_FILE }],
    },
  },
];

const cascadeCheck = async (request: { readonly changed: readonly RepoPath[] }) => {
  const cascadeGit: GitPort = {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
      outcome: "ok",
      value: [repoPathOf("hone.config.json"), LEGACY_FILE],
    }),
    changedSince: vi
      .fn<GitPort["changedSince"]>()
      .mockReturnValue({ outcome: "ok", value: request.changed }),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  };
  const stages = fixtureStages({
    repoRoot: CASCADE_REPO,
    git: cascadeGit,
    config: CASCADE_SETTINGS,
    records: CASCADE_DEBT,
    baseRevision: "origin/main",
  });
  const fileText = createDefaultFileTextPort({});
  const configured = fileText.write({
    path: path.join({ segments: [CASCADE_REPO, "eslint.config.mjs"] }),
    text: 'import projection from "./hone.eslint.mjs";\nexport default [...projection];\n',
  });
  assert(configured.outcome === "ok");
  const projected = await versionTwoProjectedOf({ stages, fileText, path, repoRoot: CASCADE_REPO });
  assert(projected.outcome === "ok");
  return versionTwoRunOver({ stages, arguments: argumentsOf });
};

describe("named debt on a file holding type claims, untyped values and a loop", () => {
  it("answers all three findings until the file is touched", async () => {
    const checked = await cascadeCheck({ changed: [] });
    assert(checked.outcome === "ok");
    expect(checked.value.report).toMatchObject({
      findings: [],
      refused: [],
      forfeited: [],
      answered: expect.arrayContaining([
        expect.objectContaining({
          finding: expect.objectContaining({
            check: "claimed-type#cast-to-any",
            file: LEGACY_FILE,
          }),
        }),
        expect.objectContaining({
          finding: expect.objectContaining({
            check: "untyped-value#explicit-any",
            file: LEGACY_FILE,
          }),
        }),
        expect.objectContaining({
          finding: expect.objectContaining({
            check: "loop-keyword#loop-statement",
            file: LEGACY_FILE,
          }),
        }),
      ]),
    });
    expect(runVerdictOf({ report: checked.value.report })).toBe("pass");
  });

  it("forfeits all three debts when the file is touched", async () => {
    const checked = await cascadeCheck({ changed: [LEGACY_FILE] });
    assert(checked.outcome === "ok");
    expect(checked.value.report.forfeited).toHaveLength(3);
    expect(runVerdictOf({ report: checked.value.report })).toBe("fail");
  });
});
