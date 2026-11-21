import { describe, expect, it, vi } from "vitest";
import { loadFailureDetail } from "../../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRepository, PlacedEntry } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { foundTreeExceptionsOf } from "./found-tree-exceptions.ts";
import { FOUND_TREE_REVISION } from "./found-tree-reach.ts";

const ENTRY: PlacedEntry["entry"] = { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" };

const PLACED: PlacedEntry = { place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 }, entry: ENTRY };

const repositoryReading = (request: { readonly read: ReturnType<ExceptionRepository["read"]> }): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue(request.read),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
  add: vi.fn<ExceptionRepository["add"]>(),
  remove: vi.fn<ExceptionRepository["remove"]>(),
  moveToSplitLayout: vi.fn<ExceptionRepository["moveToSplitLayout"]>(),
});

describe("foundTreeExceptionsOf, the version 1 entries at the tree the upgrade found", () => {
  it("gives the entries of the working tree as the entries at the base, and never asks git", () => {
    const repository = repositoryReading({ read: { outcome: "ok", value: [PLACED] } });
    expect({ atBase: foundTreeExceptionsOf({ repository }).readAt({ revision: FOUND_TREE_REVISION }), asked: vi.mocked(repository.readAt).mock.calls }).toEqual({
      atBase: { outcome: "ok", value: [ENTRY] },
      asked: [],
    });
  });

  it("fails as a git failure naming the tree when the working tree's entries cannot be read", () => {
    const failure: LoadFailure = { kind: "file-unreadable", path: "discipline-exceptions.json", detail: "EACCES" };
    const repository = repositoryReading({ read: { outcome: "failed", error: failure } });
    expect(foundTreeExceptionsOf({ repository }).readAt({ revision: FOUND_TREE_REVISION })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "read the tree the upgrade found", detail: loadFailureDetail({ failure }) },
    });
  });

  it("reads the working tree's own entries as they are", () => {
    const repository = repositoryReading({ read: { outcome: "ok", value: [PLACED] } });
    expect(foundTreeExceptionsOf({ repository }).read()).toEqual({ outcome: "ok", value: [PLACED] });
  });
});
