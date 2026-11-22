import { describe, expect, it, vi } from "vitest";

import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import { versionOneEntriesOf } from "./version-one-entries.ts";

const repositoryReading = (request: {
  readonly read: ReturnType<ExceptionRepository["readAt"]>;
}): Pick<ExceptionRepository, "readAt"> => ({
  readAt: vi.fn<ExceptionRepository["readAt"]>().mockReturnValue(request.read),
});

describe("versionOneEntriesOf", () => {
  it("gives the entries the version 1 repository reads at a revision, as JSON values", () => {
    expect(
      versionOneEntriesOf({
        repository: repositoryReading({
          read: {
            outcome: "ok",
            value: [
              {
                kind: "file-carve-out",
                clause: "CD-15#loops",
                file: "src/a.ts",
                reason: "legacy loop",
              },
              {
                kind: "authorised-location",
                clause: "CD-2#cast",
                file: "src/b.ts",
                reason: "kept",
                provenance: { kind: "inherited-debt", source: "old" },
              },
            ],
          },
        }),
      }).atBase({ revision: "origin/main" }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
        {
          kind: "authorised-location",
          clause: "CD-2#cast",
          file: "src/b.ts",
          reason: "kept",
          provenance: { kind: "inherited-debt", source: "old" },
        },
      ],
    });
  });

  it("asks the repository for the revision it was given", () => {
    const repository = repositoryReading({ read: { outcome: "ok", value: [] } });
    versionOneEntriesOf({ repository }).atBase({ revision: "origin/main" });
    expect(repository.readAt).toHaveBeenCalledWith({ revision: "origin/main" });
  });

  it("gives no entry that is not a JSON value", () => {
    expect(
      versionOneEntriesOf({
        repository: repositoryReading({
          read: {
            outcome: "ok",
            value: [
              {
                kind: "clause-wide-carve-out",
                clause: "CD-15#loops",
                reason: "generated",
                whyChain: () => "not json",
              },
            ],
          },
        }),
      }).atBase({ revision: "origin/main" }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("passes on the git failure that stopped the repository reading the revision", () => {
    expect(
      versionOneEntriesOf({
        repository: repositoryReading({
          read: {
            outcome: "failed",
            error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" },
          },
        }),
      }).atBase({ revision: "origin/main" }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" },
    });
  });
});
