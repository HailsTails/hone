import { describe, expect, it, vi } from "vitest";

import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../../domain/settings/conventions.ts";
import { versionTwoCheckOf } from "./version-two-check-command.ts";

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

describe("versionTwoCheckOf", () => {
  it("gives the stages' load failure and runs no engine", async () => {
    const stages = stagesFailingCatalogue();

    expect(
      await versionTwoCheckOf({
        stages,
        arguments: { forfeiture: undefined, reportOutput: undefined },
      }),
    ).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(stages.engines).not.toHaveBeenCalled();
  });
});

const createEmptyLedgerStages = (request: {
  readonly touched: VersionTwoStages["touched"];
}): VersionTwoStages => ({
  ...stagesFailingCatalogue(),
  catalogue: () => ({
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
  }),
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
      runSettings: { reportOutput: "full", assessment: { forfeiture: "elsewhere" } },
      eslintConfigLookup: { lookup: "detected" },
      eslintProjectionKind: "mjs",
      conventions: DEFAULT_CONVENTIONS,
      notes: [],
    },
  }),
  records: () => ({
    outcome: "ok",
    value: {
      records: [],
      refused: [],
      notes: [],
      base: { measured: "yes", held: [], placements: [] },
    },
  }),
  tree: () => ({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
  engines: async () => ({ outcome: "ok", value: [] }),
  touched: request.touched,
});

it("measures change for an explicitly requested comparison even when no debt is held", async () => {
  const touched = vi
    .fn<VersionTwoStages["touched"]>()
    .mockReturnValue({ measured: "yes", paths: new Set() });
  const stages = createEmptyLedgerStages({ touched });

  await versionTwoCheckOf({
    stages,
    arguments: { forfeiture: "no-new-findings", reportOutput: undefined },
  });

  expect(touched).toHaveBeenCalledWith(
    expect.objectContaining({
      assessment: { forfeiture: "no-new-findings" },
      measuring: "when-debt-held",
    }),
  );
});
