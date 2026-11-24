import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { ProofCarriedOver } from "../../ports/upgrade/proof-outcome.ts";
import { provenWithTeamLayout, type TeamLayoutProofRequest } from "./team-layout-proof.ts";

const REPO = absoluteRootOf("/repo");

const WRITTEN = absoluteRootOf("/repo/acme/rules/principles/acme.md");

const PRINCIPLES_FOLDER = absoluteRootOf("/repo/acme/rules/principles");

const PLAN = {
  files: [{ file: repoPathOf("acme/rules/principles/acme.md"), text: "# acme\n" }],
  removed: [repoPathOf("acme/rules/ACME-1/discipline.json")],
  folders: [repoPathOf("acme/rules/ACME-1")],
};

const CARRIED: ProofCarriedOver = {
  written: [repoPathOf("hone.config.json")],
  replaced: [],
  removed: { files: [], folders: [] },
  records: [],
  findings: 0,
};

const CATALOGUES: readonly RuleSetCatalogue[] = [];

const LAYOUT_CREATED = {
  outcome: "all-applied",
  settled: [
    { effect: { kind: "create-file", path: WRITTEN, text: "# acme\n" }, outcome: "applied" },
  ],
} as const;

describe("provenWithTeamLayout", () => {
  it("writes the team layout, reads the catalogues after writing it, proves over them, and names the layout first among the files written", async () => {
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(LAYOUT_CREATED);
    const undo = vi.fn<ProofEffects["undo"]>();
    const proofOf = vi
      .fn<TeamLayoutProofRequest["proofOf"]>()
      .mockResolvedValue({ outcome: "ok", value: CARRIED });

    expect(
      await provenWithTeamLayout({
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>(),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: {
            kindOf: vi
              .fn<EntryKindPort["kindOf"]>()
              .mockReturnValueOnce("absent")
              .mockReturnValueOnce("directory"),
          },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValueOnce(WRITTEN),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValueOnce(PRINCIPLES_FOLDER),
          },
        },
        effects: { apply, undo },
        repoRoot: REPO,
        plan: PLAN,
        cataloguesAfterWriting: () => ({ outcome: "ok", value: CATALOGUES }),
        proofOf,
      }),
    ).toEqual({
      outcome: "ok",
      value: { ...CARRIED, written: ["acme/rules/principles/acme.md", "hone.config.json"] },
    });
    expect([apply.mock.calls, proofOf.mock.calls]).toEqual([
      [[{ effects: [{ kind: "create-file", path: WRITTEN, text: "# acme\n" }] }]],
      [[CATALOGUES]],
    ]);
    expect(undo).not.toHaveBeenCalled();
  });

  it("undoes what it wrote and refuses with the load failure, naming what it could not restore, when the catalogues cannot be read after writing", async () => {
    const undo = vi
      .fn<ProofEffects["undo"]>()
      .mockReturnValueOnce([{ written: "file-created", path: WRITTEN, detail: "EBUSY" }]);
    const proofOf = vi.fn<TeamLayoutProofRequest["proofOf"]>();

    expect(
      await provenWithTeamLayout({
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>(),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: {
            kindOf: vi
              .fn<EntryKindPort["kindOf"]>()
              .mockReturnValueOnce("absent")
              .mockReturnValueOnce("directory"),
          },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValueOnce(WRITTEN),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValueOnce(PRINCIPLES_FOLDER),
          },
        },
        effects: {
          apply: vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(LAYOUT_CREATED),
          undo,
        },
        repoRoot: REPO,
        plan: PLAN,
        cataloguesAfterWriting: () => ({
          outcome: "failed",
          error: { kind: "rule-set-not-upgraded", path: "/repo/acme" },
        }),
        proofOf,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: {
          kind: "team-layout-unreadable",
          failure: { kind: "rule-set-not-upgraded", path: "/repo/acme" },
          unrestored: [{ written: "file-created", path: WRITTEN, detail: "EBUSY" }],
          removedByVersionOne: [],
        },
      },
    });
    expect([undo.mock.calls, proofOf.mock.calls]).toEqual([
      [[{ writes: [{ kind: "file-created", path: WRITTEN }] }]],
      [],
    ]);
  });

  it("undoes what it wrote and refuses with the proof's refusal when the proof refuses", async () => {
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]);

    expect(
      await provenWithTeamLayout({
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>(),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: {
            kindOf: vi
              .fn<EntryKindPort["kindOf"]>()
              .mockReturnValueOnce("absent")
              .mockReturnValueOnce("directory"),
          },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValueOnce(WRITTEN),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValueOnce(PRINCIPLES_FOLDER),
          },
        },
        effects: {
          apply: vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(LAYOUT_CREATED),
          undo,
        },
        repoRoot: REPO,
        plan: PLAN,
        cataloguesAfterWriting: () => ({ outcome: "ok", value: CATALOGUES }),
        proofOf: vi.fn<TeamLayoutProofRequest["proofOf"]>().mockResolvedValue({
          outcome: "failed",
          error: { kind: "version-one-uncovered", clauses: [], removedByVersionOne: [] },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: { kind: "version-one-uncovered", clauses: [], removedByVersionOne: [] },
      },
    });
    expect(undo.mock.calls).toEqual([[{ writes: [{ kind: "file-created", path: WRITTEN }] }]]);
  });

  it("refuses before writing or proving when a file of the layout already exists", async () => {
    const apply = vi.fn<ProofEffects["apply"]>();
    const proofOf = vi.fn<TeamLayoutProofRequest["proofOf"]>();

    expect(
      await provenWithTeamLayout({
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>(),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file") },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValueOnce(WRITTEN),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>(),
          },
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        repoRoot: REPO,
        plan: PLAN,
        cataloguesAfterWriting: () => ({ outcome: "ok", value: CATALOGUES }),
        proofOf,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: {
          kind: "write-refused",
          refusal: { failure: { kind: "path-already-exists", path: WRITTEN }, unrestored: [] },
          removedByVersionOne: [],
        },
      },
    });
    expect([apply.mock.calls, proofOf.mock.calls]).toEqual([[], []]);
  });
});
