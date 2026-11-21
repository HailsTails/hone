import { describe, expect, it } from "vitest";
import { commandOver, memoryRepositoryOf, recordedProcessWith } from "../../../../tests/command-harness.ts";
import type { SettingsFile } from "../../../infrastructure/hone-config-file/settings-file.ts";
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

describe("plannedProjectionOf", () => {
  it("fails with the load failure itself when the tool's own symptom catalogue cannot be read", async () => {
    const command = commandOver({ process: recordedProcessWith({ arguments: [] }).port, fileText: memoryRepositoryOf({ files: {} }).fileText });
    const projected = await plannedProjectionOf({ command, repoRoot: absolutePathSchema.parse("/repo"), installRoot: absolutePathSchema.parse("/install") })({
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
