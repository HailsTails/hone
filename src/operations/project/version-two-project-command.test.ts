import { assert, describe, expect, it, vi } from "vitest";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { isAbsolutePath } from "../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { versionTwoProjectedOf } from "./version-two-project-command.ts";

const absolute = (text: string): AbsolutePath => {
  assert(isAbsolutePath(text), `${text} is absolute`);
  return text;
};

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const stagesFailingCatalogue = (): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
  settings: vi.fn<VersionTwoStages["settings"]>(),
  records: vi.fn<VersionTwoStages["records"]>(),
  tree: vi.fn<VersionTwoStages["tree"]>(),
  engines: vi.fn<VersionTwoStages["engines"]>(),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  touched: vi.fn<VersionTwoStages["touched"]>(),
});

describe("versionTwoProjectedOf", () => {
  it("gives the stages' load failure and writes nothing", async () => {
    const fileText = { read: vi.fn(), exists: vi.fn(), write: vi.fn() };
    const path = { join: vi.fn(), joinRepository: vi.fn(), relative: vi.fn(), directoryOf: vi.fn(), repositoryDirectoryOf: vi.fn(), resolve: vi.fn(), fromFileUrl: vi.fn() };

    expect(await versionTwoProjectedOf({ stages: stagesFailingCatalogue(), fileText, path, repoRoot: absolute("/repo") })).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(fileText.write).not.toHaveBeenCalled();
  });
});
