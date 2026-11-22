import { describe, expect, it } from "vitest";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import type { SettingsFile } from "../domain/settings/settings-file.ts";
import { absolutePathSchema } from "../infrastructure/content-files/absolute-path.ts";
import { plannedProjectionOf } from "../application/upgrade/command/planned-projection.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { SETTINGS_FILE_FORMAT } from "../infrastructure/hone-config-file/settings-file.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { createSymptomCatalogueRepository } from "../infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";

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

const EMPTY_REPOSITORY_COMMAND: VersionOneCommandRequest = {
  process: { arguments: [], writeOut: () => undefined, writeError: () => undefined, exitWith: () => undefined },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: () => "absent",
    read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } }),
    write: () => ({ outcome: "ok", value: undefined }),
  },
  engine: createDefaultEnginePort({}),
  modules: { load: notUsed },
  git: { trackedPaths: notUsed, changedSince: notUsed, contentInBase: notUsed, textInBase: notUsed, renamedSince: notUsed },
  exceptionRepositoryOf: notUsed,
  exceptionEntryParser: { parseExceptionEntries: notUsed, importedEntriesIn: notUsed, importSourcesOf: notUsed },
  selectionRepositoryOf: notUsed,
  shownPathOfRepository: notUsed,
  moduleUrl: "file:///install/src/hone.ts",
};

describe("plannedProjectionOf", () => {
  it("fails with the load failure itself when the tool's own symptom catalogue cannot be read", async () => {
    const command = EMPTY_REPOSITORY_COMMAND;
    const projected = await plannedProjectionOf({
      command,
      repoRoot: absolutePathSchema.parse("/repo"),
      installRoot: absolutePathSchema.parse("/install"),
      recordsReader,
      symptomCatalogueOf: createSymptomCatalogueRepository,
      settingsFormat: SETTINGS_FILE_FORMAT,
      settingsSourcesOf: createSettingsSources,
    })({
      settings: SETTINGS,
      documents: [],
    });
    expect(projected).toEqual({ outcome: "failed", error: {
        kind: "projection-failed",
        failure: { kind: "catalogue-not-read", path: "/install/rules/typescript/symptoms.json", reason: { reason: "absent" } },
      },
    });
  });
});
