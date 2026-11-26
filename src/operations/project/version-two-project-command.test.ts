import { describe, expect, it, vi } from "vitest";

import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { DEFAULT_CONVENTIONS } from "../../domain/settings/conventions.ts";
import { versionTwoProjectedOf } from "./version-two-project-command.ts";

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const stagesFailingCatalogue = (): VersionTwoStages => ({
  catalogue: vi
    .fn<VersionTwoStages["catalogue"]>()
    .mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
  settings: vi.fn<VersionTwoStages["settings"]>(),
  records: vi.fn<VersionTwoStages["records"]>(),
  tree: vi.fn<VersionTwoStages["tree"]>(),
  engines: vi.fn<VersionTwoStages["engines"]>(),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  renamed: vi
    .fn<VersionTwoStages["renamed"]>()
    .mockReturnValue({ measured: "yes", renamed: new Map() }),
  touched: vi.fn<VersionTwoStages["touched"]>(),
});

const emptyCatalogue: VersionTwoStages["catalogue"] = () => ({
  outcome: "ok",
  value: {
    principles: [],
    rules: [],
    cases: [],
    recipes: [],
    recordKinds: [],
    engines: [],
    symptoms: [],
    clauses: [],
    checks: [],
    namedBans: [],
  },
});

const loadProjectionStages = (catalogue: VersionTwoStages["catalogue"]): VersionTwoStages => ({
  ...stagesFailingCatalogue(),
  catalogue,
  settings: () => ({
    outcome: "ok",
    value: {
      available: [],
      selection: {
        selected: [],
        notAdopted: [],
        notRun: [],
        excluded: [],
        eslintConfigRoots: [],
      },
      runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
      eslintConfigLookup: { lookup: "detected" },
      eslintProjectionKind: "mjs",
      conventions: DEFAULT_CONVENTIONS,
      notes: [],
    },
  }),
  records: () => ({
    outcome: "ok",
    value: { records: [], refused: [], notes: [], base: { measured: "yes", held: [] } },
  }),
  tree: () => ({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
  projections: vi.fn<VersionTwoStages["projections"]>().mockResolvedValue({
    outcome: "ok",
    value: [{ kind: "remove", file: repoPathOf("hone.eslint.ts") }],
  }),
});

describe("versionTwoProjectedOf", () => {
  it("passes a projected removal to the file removal port", async () => {
    const remove = vi
      .fn<FileRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: undefined });
    const projected = await versionTwoProjectedOf({
      stages: loadProjectionStages(emptyCatalogue),
      fileRemoval: { remove },
      fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() },
      path: { join: vi.fn().mockReturnValue("/repo/hone.eslint.ts") },
      repoRoot: absoluteRootOf("/repo"),
    });

    expect({ projected, removed: remove.mock.calls }).toEqual({
      projected: { outcome: "ok", value: [{ path: "hone.eslint.ts", effect: "removed" }] },
      removed: [[{ path: "/repo/hone.eslint.ts" }]],
    });
  });
  it("gives the stages' load failure and writes nothing", async () => {
    const fileText = { read: vi.fn(), exists: vi.fn(), write: vi.fn() };
    const path = { join: vi.fn() };

    expect(
      await versionTwoProjectedOf({
        stages: loadProjectionStages(stagesFailingCatalogue().catalogue),
        fileRemoval: { remove: vi.fn() },
        fileText,
        path,
        repoRoot: absoluteRootOf("/repo"),
      }),
    ).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(fileText.write).not.toHaveBeenCalled();
  });
});
