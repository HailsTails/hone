import { describe, expect, it, vi } from "vitest";
import { CLAIMED_TYPE, WHOLE_SYMPTOM } from "../../../../tests/report-catalogue.ts";
import type { GitPort } from "../../../infrastructure/git/git-port.ts";
import type { PlacedRecord } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { touchedSetOf } from "./touched-set-of.ts";

const REPO = absolutePathSchema.parse("/repo");

const FILE_A = repoPathSchema.parse("src/a.ts");

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: FILE_A, holding: { held: "stated" } },
};

const gitChanging = (request: { readonly files: readonly RepoPath[] }): Pick<GitPort, "changedSince"> => ({
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: request.files }),
});

describe("touchedSetOf", () => {
  it("leaves the touched set to another run when forfeiture is assessed elsewhere, without asking git", () => {
    const git = gitChanging({ files: [FILE_A] });
    expect(touchedSetOf({ assessment: { forfeiture: "elsewhere" }, measuring: "when-debt-held", records: [DEBT], repoRoot: REPO, baseRevision: "origin/main", git })).toEqual({ measured: "elsewhere" });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([]);
  });

  it("measures the files changed since the base revision when records hold debt", () => {
    expect(
      touchedSetOf({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records: [DEBT], repoRoot: REPO, baseRevision: "origin/main", git: gitChanging({ files: [FILE_A] }) }),
    ).toEqual({ measured: "yes", paths: new Set([FILE_A]) });
  });

  it("says no base revision was given when records hold debt and none was passed", () => {
    expect(touchedSetOf({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records: [DEBT], repoRoot: REPO, baseRevision: undefined, git: gitChanging({ files: [] }) })).toEqual({
      measured: "no",
      base: { state: "not-given" },
    });
  });

  it("touches nothing, without asking git, when no record is debt", () => {
    const git = gitChanging({ files: [FILE_A] });
    expect(touchedSetOf({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records: [], repoRoot: REPO, baseRevision: "origin/main", git })).toEqual({ measured: "yes", paths: new Set() });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([]);
  });

  it("measures the changed files even when no record is debt, for a command that records debt", () => {
    expect(
      touchedSetOf({ assessment: { forfeiture: "this-run" }, measuring: "always", records: [], repoRoot: REPO, baseRevision: "origin/main", git: gitChanging({ files: [FILE_A] }) }),
    ).toEqual({ measured: "yes", paths: new Set([FILE_A]) });
  });

  it("still leaves the touched set to another run, without asking git, for a command that records debt", () => {
    const git = gitChanging({ files: [FILE_A] });
    expect(touchedSetOf({ assessment: { forfeiture: "elsewhere" }, measuring: "always", records: [], repoRoot: REPO, baseRevision: "origin/main", git })).toEqual({ measured: "elsewhere" });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([]);
  });
});
