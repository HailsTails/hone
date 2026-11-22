import { describe, expect, it, vi } from "vitest";
import type { Rule, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { PlacedRecord, SymptomReach } from "../../../domain/records/hone-records/hone-record.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { touchedSetOf } from "./touched-set-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const REPO = absoluteRootOf("/repo");

const FILE_A = repoPathOf("src/a.ts");

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: { name: "one-place-decides", title: "One place decides" },
  standing: "accepted",
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: {
        name: "gives-a-value-its-type",
        title: "Gives a value its type",
        standing: "accepted",
        owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
      },
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    {
      situation: "a schema proves the type",
      kind: { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
    },
  ],
};

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
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
