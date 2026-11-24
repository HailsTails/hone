import { describe, expect, it, vi } from "vitest";

import type { GitPort } from "../../application/ports/git-port.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { versionOneEntriesOf } from "./version-one-entries.ts";

const repositoryReading = (request: {
  readonly read: ReturnType<ExceptionRepository["readAt"]>;
}): Pick<ExceptionRepository, "readAt"> => ({
  readAt: vi.fn<ExceptionRepository["readAt"]>().mockReturnValue(request.read),
});

describe("versionOneEntriesOf", () => {
  it("gives the entries the version 1 repository reads at a revision, with each as the JSON value it carries", () => {
    const repoRoot = absoluteRootOf("/repo");
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
        git: { textInBase: vi.fn<GitPort["textInBase"]>() },
        repoRoot,
      }).atBase({ revision: "origin/main" }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          entry: {
            kind: "file-carve-out",
            clause: "CD-15#loops",
            file: "src/a.ts",
            reason: "legacy loop",
          },
          carried: {
            kind: "file-carve-out",
            clause: "CD-15#loops",
            file: "src/a.ts",
            reason: "legacy loop",
          },
        },
        {
          entry: {
            kind: "authorised-location",
            clause: "CD-2#cast",
            file: "src/b.ts",
            reason: "kept",
            provenance: { kind: "inherited-debt", source: "old" },
          },
          carried: {
            kind: "authorised-location",
            clause: "CD-2#cast",
            file: "src/b.ts",
            reason: "kept",
            provenance: { kind: "inherited-debt", source: "old" },
          },
        },
      ],
    });
  });

  it("asks the repository for the revision it was given", () => {
    const repoRoot = absoluteRootOf("/repo");
    const repository = repositoryReading({ read: { outcome: "ok", value: [] } });
    versionOneEntriesOf({
      repository,
      git: { textInBase: vi.fn<GitPort["textInBase"]>() },
      repoRoot,
    }).atBase({
      revision: "origin/main",
    });
    expect(repository.readAt).toHaveBeenCalledWith({ revision: "origin/main" });
  });

  it("gives no entry that is not a JSON value", () => {
    const repoRoot = absoluteRootOf("/repo");
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
        git: { textInBase: vi.fn<GitPort["textInBase"]>() },
        repoRoot,
      }).atBase({ revision: "origin/main" }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("passes on the git failure that stopped the repository reading the revision", () => {
    const repoRoot = absoluteRootOf("/repo");
    expect(
      versionOneEntriesOf({
        repository: repositoryReading({
          read: {
            outcome: "failed",
            error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" },
          },
        }),
        git: { textInBase: vi.fn<GitPort["textInBase"]>() },
        repoRoot,
      }).atBase({ revision: "origin/main" }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" },
    });
  });
});

describe("versionOneEntriesOf reading the selection at the base", () => {
  it("reads the selection the base's disciplines.json holds", () => {
    const repoRoot = absoluteRootOf("/repo");
    const git: Pick<GitPort, "textInBase"> = {
      textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue({
        outcome: "ok",
        value: {
          presence: "present-in-base",
          text: '{ "version": 1, "ruleSets": {}, "clauses": { "CD-19#import-boundaries": "walker" }, "clauseSettings": { "CD-19#import-boundaries": { "confinedPackages": ["uuid"] } } }',
        },
      }),
    };
    const entries = versionOneEntriesOf({
      repository: { readAt: vi.fn<ExceptionRepository["readAt"]>() },
      git,
      repoRoot,
    });

    const selection = entries.selectionAtBase({ revision: "origin/main" });

    expect({ selection, asked: vi.mocked(git.textInBase).mock.calls }).toEqual({
      selection: {
        outcome: "ok",
        value: {
          presence: "present-in-base",
          selection: {
            version: 1,
            ruleSets: [],
            clauses: [
              [
                { ruleSet: "hone", discipline: "CD-19", clause: "import-boundaries" },
                { state: "run", mechanism: "walker" },
              ],
            ],
            exclude: [],
            eslintConfigRoots: [],
            fileExceptionWhyChains: "required",
            reportOutput: "full",
            assessment: { forfeiture: "this-run" },
            clauseSettings: [
              [
                { ruleSet: "hone", discipline: "CD-19", clause: "import-boundaries" },
                { confinedPackages: ["uuid"] },
              ],
            ],
            checkEditions: "pinned",
          },
        },
      },
      asked: [[{ repoRoot, baseRevision: "origin/main", file: "disciplines.json" }]],
    });
  });

  it("reads no selection when the base holds no disciplines.json", () => {
    const repoRoot = absoluteRootOf("/repo");
    const entries = versionOneEntriesOf({
      repository: { readAt: vi.fn<ExceptionRepository["readAt"]>() },
      git: {
        textInBase: vi
          .fn<GitPort["textInBase"]>()
          .mockReturnValue({ outcome: "ok", value: { presence: "absent-from-base" } }),
      },
      repoRoot,
    });

    const selection = entries.selectionAtBase({ revision: "origin/main" });

    expect(selection).toEqual({ outcome: "ok", value: { presence: "absent-from-base" } });
  });

  it("reads the base's disciplines.json that is not JSON as unreadable, never failing", () => {
    const repoRoot = absoluteRootOf("/repo");
    const git: Pick<GitPort, "textInBase"> = {
      textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue({
        outcome: "ok",
        value: { presence: "present-in-base", text: "{" },
      }),
    };
    const entries = versionOneEntriesOf({
      repository: { readAt: vi.fn<ExceptionRepository["readAt"]>() },
      git,
      repoRoot,
    });

    const selection = entries.selectionAtBase({ revision: "origin/main" });

    expect(selection).toEqual({ outcome: "ok", value: { presence: "unreadable-in-base" } });
  });

  it("reads the base's disciplines.json that is no version 1 selection as unreadable, never failing", () => {
    const repoRoot = absoluteRootOf("/repo");
    const git: Pick<GitPort, "textInBase"> = {
      textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue({
        outcome: "ok",
        value: { presence: "present-in-base", text: '{ "version": 2 }' },
      }),
    };
    const entries = versionOneEntriesOf({
      repository: { readAt: vi.fn<ExceptionRepository["readAt"]>() },
      git,
      repoRoot,
    });

    const selection = entries.selectionAtBase({ revision: "origin/main" });

    expect(selection).toEqual({ outcome: "ok", value: { presence: "unreadable-in-base" } });
  });

  it("passes on the git failure that stopped it reading the base's disciplines.json", () => {
    const repoRoot = absoluteRootOf("/repo");
    const git: Pick<GitPort, "textInBase"> = {
      textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "git-failed", command: "git show", detail: "unknown revision" },
      }),
    };
    const entries = versionOneEntriesOf({
      repository: { readAt: vi.fn<ExceptionRepository["readAt"]>() },
      git,
      repoRoot,
    });

    const selection = entries.selectionAtBase({ revision: "origin/main" });

    expect(selection).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git show", detail: "unknown revision" },
    });
  });
});
