import { describe, expect, it, vi } from "vitest";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { PlacedEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import { foundTreeExceptionsOf } from "./found-tree-exceptions.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";

const ENTRY: PlacedEntry["entry"] = { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" };

const PLACED: PlacedEntry = { place: { layout: "single-file", file: repoPathOf("discipline-exceptions.json"), index: 0 }, entry: ENTRY };

const loadFailureDetail: LoadFailureDetail = () => "file-unreadable discipline-exceptions.json EACCES";

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
    expect({ atBase: foundTreeExceptionsOf({ repository, loadFailureDetail }).readAt(), asked: vi.mocked(repository.readAt).mock.calls }).toEqual({
      atBase: { outcome: "ok", value: [ENTRY] },
      asked: [],
    });
  });

  it("fails as a git failure naming the tree when the working tree's entries cannot be read", () => {
    const failure: LoadFailure = { kind: "file-unreadable", path: "discipline-exceptions.json", detail: "EACCES" };
    const repository = repositoryReading({ read: { outcome: "failed", error: failure } });
    expect(foundTreeExceptionsOf({ repository, loadFailureDetail }).readAt()).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "read the tree the upgrade found", detail: "file-unreadable discipline-exceptions.json EACCES" },
    });
  });

  it("reads the working tree's own entries as they are", () => {
    const repository = repositoryReading({ read: { outcome: "ok", value: [PLACED] } });
    expect(foundTreeExceptionsOf({ repository, loadFailureDetail }).read()).toEqual({ outcome: "ok", value: [PLACED] });
  });
});
