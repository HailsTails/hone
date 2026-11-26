import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { SettingsFile } from "../../../domain/settings/settings-file.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { BoundCatalogueOf } from "../../ports/symptom-catalogue-repository.ts";
import type { VersionOneCommandRequest } from "../../ports/version-one-command-request.ts";
import { plannedProjectionOf } from "./planned-projection.ts";

const SETTINGS: SettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: {
    conventions: {
      generated: [],
      layers: [],
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    },
    declared: [],
  },
};

const PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/install/rules"),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn(),
  fromFileUrl: vi.fn(),
};

const EMPTY_REPOSITORY_COMMAND: VersionOneCommandRequest = {
  process: {
    arguments: [],
    writeOut: () => undefined,
    writeError: () => undefined,
    exitWith: () => undefined,
  },
  path: PATH,
  fileText: {
    exists: () => "absent",
    read: ({ path }) => ({
      outcome: "failed",
      error: { kind: "unreadable", path, detail: "absent" },
    }),
    write: () => ({ outcome: "ok", value: undefined }),
  },
  modules: { load: vi.fn() },
  git: {
    trackedPaths: vi.fn(),
    changedSince: vi.fn(),
    contentInBase: vi.fn(),
    textInBase: vi.fn(),
    renamedSince: vi.fn(),
  },
  exceptionRepositoryOf: vi.fn(),
  exceptionEntryParser: {
    parseExceptionEntries: vi.fn(),
    importedEntriesIn: vi.fn(),
    importSourcesOf: vi.fn(),
  },
  selectionRepositoryOf: vi.fn(),
  shownPathOfRepository: vi.fn(),
  moduleUrl: "file:///install/src/hone.ts",
};

const NO_CATALOGUE: BoundCatalogueOf = () => ({ outcome: "ok", value: { held: "none" } });

const CATALOGUE_NAMING_AN_UNHELD_SYMPTOM: BoundCatalogueOf = () => ({
  outcome: "ok",
  value: {
    held: "catalogue",
    catalogue: {
      principles: [],
      rules: [],
      cases: [],
      recipes: [],
      recordKinds: [],
      engines: [{ name: "walker" }],
      symptoms: [],
      clauses: [],
      checks: [
        {
          name: "loops",
          symptom: { ruleSet: "hone", name: "loop-keyword" },
          page: "loop-keyword/loops.md",
          engines: [{ name: "walker" }],
          forms: [],
          findingSpecifics: [],
        },
      ],
      namedBans: [],
    },
  },
});

describe("plannedProjectionOf", () => {
  it("fails with the load failure itself when the tool's own symptom catalogue cannot be read", async () => {
    const command = EMPTY_REPOSITORY_COMMAND;
    const plan = plannedProjectionOf({
      command,
      repoRoot: absoluteRootOf("/repo"),
      installRoot: absoluteRootOf("/install"),
      directory: { list: vi.fn(), create: vi.fn() },
      recordsReader: { recordsReadingOf: vi.fn() },
      boundCatalogueOf: NO_CATALOGUE,
      settingsFormat: {
        fileOf: vi.fn(),
        documentOf: vi.fn(),
        textOf: vi.fn(),
      },
      settingsSourcesOf: vi.fn(),
      checkPieceSourceOf: vi.fn(),
      namedEngine: { load: vi.fn(), run: vi.fn(), project: vi.fn(), outputPaths: vi.fn() },
    });

    const projected = await plan({ settings: SETTINGS, documents: [] });

    expect(projected).toEqual({
      outcome: "failed",
      error: {
        kind: "projection-failed",
        failure: {
          kind: "catalogue-not-read",
          path: "/install/rules",
          reason: { reason: "absent" },
        },
      },
    });
    expect(PATH.join).toHaveBeenCalledWith({ segments: ["/install", "rules"] });
  });

  it("fails naming the symptom a check names and no catalogue holds, and projects nothing", async () => {
    const project = vi.fn();
    const plan = plannedProjectionOf({
      command: EMPTY_REPOSITORY_COMMAND,
      repoRoot: absoluteRootOf("/repo"),
      installRoot: absoluteRootOf("/install"),
      directory: { list: vi.fn(), create: vi.fn() },
      recordsReader: { recordsReadingOf: vi.fn() },
      boundCatalogueOf: CATALOGUE_NAMING_AN_UNHELD_SYMPTOM,
      settingsFormat: {
        fileOf: vi.fn(),
        documentOf: vi.fn(),
        textOf: vi.fn(),
      },
      settingsSourcesOf: vi.fn().mockReturnValue({
        settingsFile: vi.fn(),
        ruleSetRoot: vi.fn(),
        catalogue: vi.fn(),
      }),
      checkPieceSourceOf: vi.fn(),
      namedEngine: { load: vi.fn(), run: vi.fn(), project, outputPaths: vi.fn() },
    });

    const projected = await plan({ settings: SETTINGS, documents: [] });

    expect({ projected, project: project.mock.calls }).toEqual({
      projected: {
        outcome: "failed",
        error: {
          kind: "projection-failed",
          failure: {
            kind: "symptom-unheld",
            symptom: { ruleSet: "hone", name: "loop-keyword" },
          },
        },
      },
      project: [],
    });
  });
});
