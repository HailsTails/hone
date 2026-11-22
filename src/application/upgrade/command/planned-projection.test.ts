import { describe, expect, it, vi } from "vitest";
import type { VersionOneCommandRequest } from "../../ports/version-one-command-request.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { SymptomCatalogueOf } from "../../ports/symptom-catalogue-repository.ts";
import type { SettingsFile } from "../../../domain/settings/settings-file.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
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
  conventions: { conventions: { generated: [], layers: [] }, declared: [] },
};

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

const PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/install/rules/typescript/symptoms.json"),
  joinRepository: notUsed,
  relative: notUsed,
  directoryOf: notUsed,
  repositoryDirectoryOf: notUsed,
  resolve: notUsed,
  fromFileUrl: notUsed,
};

const EMPTY_REPOSITORY_COMMAND: VersionOneCommandRequest = {
  process: { arguments: [], writeOut: () => undefined, writeError: () => undefined, exitWith: () => undefined },
  path: PATH,
  fileText: {
    exists: () => "absent",
    read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } }),
    write: () => ({ outcome: "ok", value: undefined }),
  },
  engine: {
    load: notUsed,
    run: { checks: notUsed, withRecords: notUsed },
    project: { checks: notUsed, withRecords: notUsed },
    conform: notUsed,
  },
  modules: { load: notUsed },
  git: { trackedPaths: notUsed, changedSince: notUsed, contentInBase: notUsed, textInBase: notUsed, renamedSince: notUsed },
  exceptionRepositoryOf: notUsed,
  exceptionEntryParser: { parseExceptionEntries: notUsed, importedEntriesIn: notUsed, importSourcesOf: notUsed },
  selectionRepositoryOf: notUsed,
  shownPathOfRepository: notUsed,
  moduleUrl: "file:///install/src/hone.ts",
};

const NO_CATALOGUE: SymptomCatalogueOf = () => ({ read: () => ({ outcome: "ok", value: { held: "none" } }) });

describe("plannedProjectionOf", () => {
  it("fails with the load failure itself when the tool's own symptom catalogue cannot be read", async () => {
    const command = EMPTY_REPOSITORY_COMMAND;
    const projected = await plannedProjectionOf({
      command,
      repoRoot: absolutePathSchema.parse("/repo"),
      installRoot: absolutePathSchema.parse("/install"),
      recordsReader: { recordsReadingOf: notUsed },
      symptomCatalogueOf: NO_CATALOGUE,
      settingsFormat: { fileOf: notUsed, documentOf: notUsed, textOf: notUsed },
      settingsSourcesOf: notUsed,
    })({
      settings: SETTINGS,
      documents: [],
    });
    expect(projected).toEqual({ outcome: "failed", error: {
        kind: "projection-failed",
        failure: { kind: "catalogue-not-read", path: "/install/rules/typescript/symptoms.json", reason: { reason: "absent" } },
      },
    });
    expect(PATH.join).toHaveBeenCalledWith({ segments: ["/install", "rules", "typescript", "symptoms.json"] });
  });
});
