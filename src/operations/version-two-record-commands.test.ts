import { describe, expect, it, vi } from "vitest";
import type { AuthoriseRequest } from "../application/ports/authorising.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import type { RecordsStoreOf } from "../application/ports/records/records-store.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { type RecordsSourceFor, type VersionTwoRecordInput, versionTwoAuthoriseOf, versionTwoPruneDebtOf, versionTwoRecordDebtOf } from "./version-two-record-commands.ts";

const AUTHORISING: AuthoriseRequest = {
  answers: "CD#CD-1#any-cast",
  file: repoPathOf("src/a.ts"),
  case: "a cast at a boundary",
  owes: "the boundary type",
  whys: [],
  rootCause: "the boundary is untyped",
  rootEvidence: "src/a.ts",
  readback: "the cast stays",
  owner: "platform",
};

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const inputFailingCatalogue = (): VersionTwoRecordInput => ({
  stages: {
    catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
    settings: vi.fn<VersionTwoStages["settings"]>(),
    records: vi.fn<VersionTwoStages["records"]>(),
    tree: vi.fn<VersionTwoStages["tree"]>(),
    engines: vi.fn<VersionTwoStages["engines"]>(),
    projections: vi.fn<VersionTwoStages["projections"]>(),
    touched: vi.fn<VersionTwoStages["touched"]>(),
  },
  repoRoot: absoluteRootOf("/repo"),
  recordsSourceFor: vi.fn<RecordsSourceFor>(),
  recordsStoreOf: vi.fn<RecordsStoreOf>(),
  recordsReader: { recordsReadingOf: vi.fn() },
  recordsEditor: { documentsWithAdded: vi.fn(), placeOfAddition: vi.fn(), documentsWithRemoved: vi.fn() },
});

describe("versionTwoRecordDebtOf", () => {
  it("gives the run's load failure and opens no records store", async () => {
    const input = inputFailingCatalogue();

    expect(await versionTwoRecordDebtOf({ ...input, leave: [] })).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtOf", () => {
  it("gives the run's load failure and opens no records store", async () => {
    const input = inputFailingCatalogue();

    expect(await versionTwoPruneDebtOf({ ...input, forfeiture: undefined })).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

describe("versionTwoAuthoriseOf", () => {
  it("gives the catalogue's load failure and reads no records", () => {
    const input = inputFailingCatalogue();

    expect(
      versionTwoAuthoriseOf({
        ...input,
        authorising: AUTHORISING,
      }),
    ).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(input.recordsSourceFor).not.toHaveBeenCalled();
  });
});
