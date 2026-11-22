import { describe, expect, it, vi } from "vitest";

import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
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
