import { describe, expect, it, vi } from "vitest";
import type { ProjectionWrite } from "../../../infrastructure/engines/protocol/runner-module/runner-result-schema.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";
import { type VersionOneProjectionSources, versionOneProjectionsOver } from "./version-one-projections-reading.ts";

const path = (text: string) => repoPathSchema.parse(text);

const ROOT_WRITE: ProjectionWrite = { path: path("disciplines.eslint.mjs"), effect: "unchanged" };

const SLICE_WRITE: ProjectionWrite = { path: path("packages/a/disciplines.eslint.mjs"), effect: "unchanged" };

const REMOVED_WRITE: ProjectionWrite = { path: path("gone/disciplines.eslint.mjs"), effect: "removed" };

const FOUND: readonly VersionOneProjection[] = [{ projection: path("disciplines.eslint.mjs"), teamConfigs: [{ file: path("eslint.config.mjs"), text: "config" }] }];

const sourcesOver = (request: { readonly writes: readonly ProjectionWrite[] }): VersionOneProjectionSources => ({
  project: vi.fn<VersionOneProjectionSources["project"]>().mockResolvedValue({ outcome: "ok", value: request.writes }),
  teamConfigsOf: vi.fn<VersionOneProjectionSources["teamConfigsOf"]>().mockReturnValue({ outcome: "ok", value: FOUND }),
});

describe("versionOneProjectionsOver", () => {
  it("takes the projections from the files version 1 left unchanged and removed nothing", async () => {
    const sources = sourcesOver({ writes: [ROOT_WRITE, SLICE_WRITE] });
    expect(await versionOneProjectionsOver(sources)()).toEqual({ removed: [], outcome: { outcome: "ok", value: FOUND } });
    expect(vi.mocked(sources.teamConfigsOf).mock.calls).toEqual([[{ projections: ["disciplines.eslint.mjs", "packages/a/disciplines.eslint.mjs"] }]]);
  });

  it("names a slice version 1 removed, and does not list it as a projection", async () => {
    const sources = sourcesOver({ writes: [ROOT_WRITE, REMOVED_WRITE] });
    expect(await versionOneProjectionsOver(sources)()).toEqual({ removed: ["gone/disciplines.eslint.mjs"], outcome: { outcome: "ok", value: FOUND } });
    expect(vi.mocked(sources.teamConfigsOf).mock.calls).toEqual([[{ projections: ["disciplines.eslint.mjs"] }]]);
  });

  it("refuses naming each file version 1's project rewrote, since the run measured it before that, and still reports what it removed", async () => {
    const sources = sourcesOver({ writes: [{ ...ROOT_WRITE, effect: "written" }, { ...SLICE_WRITE, effect: "written" }, REMOVED_WRITE] });
    expect(await versionOneProjectionsOver(sources)()).toEqual({
      removed: ["gone/disciplines.eslint.mjs"],
      outcome: { outcome: "failed", error: { kind: "project-rewrote", files: ["disciplines.eslint.mjs", "packages/a/disciplines.eslint.mjs"] } },
    });
    expect(sources.teamConfigsOf).not.toHaveBeenCalled();
  });

  it("refuses naming each slice version 1 left in place, and still reports what it removed", async () => {
    const sources = sourcesOver({ writes: [ROOT_WRITE, { path: path("old/disciplines.eslint.mjs"), effect: "left-in-place" }, REMOVED_WRITE] });
    expect(await versionOneProjectionsOver(sources)()).toEqual({
      removed: ["gone/disciplines.eslint.mjs"],
      outcome: { outcome: "failed", error: { kind: "slice-left-in-place", files: ["old/disciplines.eslint.mjs"] } },
    });
    expect(sources.teamConfigsOf).not.toHaveBeenCalled();
  });

  it("refuses with the team config refusal, still reporting what version 1 removed", async () => {
    const sources: VersionOneProjectionSources = {
      project: vi.fn<VersionOneProjectionSources["project"]>().mockResolvedValue({ outcome: "ok", value: [ROOT_WRITE, REMOVED_WRITE] }),
      teamConfigsOf: vi
        .fn<VersionOneProjectionSources["teamConfigsOf"]>()
        .mockReturnValue({ outcome: "failed", error: { kind: "no-file-imports-projection", projection: path("disciplines.eslint.mjs") } }),
    };
    expect(await versionOneProjectionsOver(sources)()).toEqual({
      removed: ["gone/disciplines.eslint.mjs"],
      outcome: { outcome: "failed", error: { kind: "team-config-refused", refusal: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } } },
    });
  });

  it("refuses with the detail when version 1's project fails, removing nothing", async () => {
    const sources: VersionOneProjectionSources = {
      project: vi.fn<VersionOneProjectionSources["project"]>().mockResolvedValue({ outcome: "failed", error: { detail: "disk full" } }),
      teamConfigsOf: vi.fn<VersionOneProjectionSources["teamConfigsOf"]>(),
    };
    expect(await versionOneProjectionsOver(sources)()).toEqual({ removed: [], outcome: { outcome: "failed", error: { kind: "project-failed", detail: "disk full" } } });
  });
});
