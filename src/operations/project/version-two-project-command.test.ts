import { describe, expect, it, vi } from "vitest";

import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
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

describe("versionTwoProjectedOf", () => {
  it("gives the stages' load failure and writes nothing", async () => {
    const fileText = { read: vi.fn(), exists: vi.fn(), write: vi.fn() };
    const path = {
      join: vi.fn(),
      joinRepository: vi.fn(),
      relative: vi.fn(),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    expect(
      await versionTwoProjectedOf({
        stages: stagesFailingCatalogue(),
        fileText,
        path,
        repoRoot: absoluteRootOf("/repo"),
      }),
    ).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(fileText.write).not.toHaveBeenCalled();
  });
});
