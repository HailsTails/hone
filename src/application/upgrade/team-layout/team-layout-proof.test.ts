import { describe, expect, it, type Mock, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../../ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofCarriedOver } from "../../ports/upgrade/proof-outcome.ts";
import type { ProofWritePorts } from "../proof-writes/proof-writes.ts";
import { provenWithTeamLayout, type TeamLayoutProofRequest } from "./team-layout-proof.ts";

const REPO = absoluteRootOf("/repo");

const WRITTEN = "/repo/acme/rules/principles/acme.md";

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

const ok = { outcome: "ok", value: undefined } as const;

type MockedPorts = ProofWritePorts & {
  readonly fileCreation: { readonly createNew: Mock<FileCreationPort["createNew"]> };
  readonly fileRemoval: { readonly remove: Mock<FileRemovalPort["remove"]> };
  readonly entryKind: { readonly kindOf: Mock<EntryKindPort["kindOf"]> };
};

const portsOver = (): MockedPorts => ({
  fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() },
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>().mockReturnValue(ok) },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
  directory: { list: vi.fn(), create: vi.fn() },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
  entryKind: {
    kindOf: vi
      .fn<EntryKindPort["kindOf"]>()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("directory"),
  },
  path: {
    join: vi.fn<PathPort["join"]>().mockReturnValue(WRITTEN),
    joinRepository: vi.fn(),
    relative: vi.fn(),
    directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValue("/repo/acme/rules/principles"),
    repositoryDirectoryOf: vi.fn(),
    resolve: vi.fn(),
    fromFileUrl: vi.fn(),
  },
});

const requestOver = (request: {
  readonly ports: MockedPorts;
  readonly cataloguesAfterWriting: TeamLayoutProofRequest["cataloguesAfterWriting"];
  readonly proofOf: TeamLayoutProofRequest["proofOf"];
}): TeamLayoutProofRequest => ({ ...request, repoRoot: REPO, plan: PLAN });

describe("provenWithTeamLayout", () => {
  it("writes the team layout, reads the catalogues after writing it, proves over them, and names the layout first among the files written", async () => {
    const ports = portsOver();
    const proofOf = vi.fn<TeamLayoutProofRequest["proofOf"]>().mockResolvedValue({
      outcome: "ok",
      value: CARRIED,
    });
    expect(
      await provenWithTeamLayout(
        requestOver({
          ports,
          cataloguesAfterWriting: () => ({ outcome: "ok", value: CATALOGUES }),
          proofOf,
        }),
      ),
    ).toEqual({
      outcome: "ok",
      value: { ...CARRIED, written: ["acme/rules/principles/acme.md", "hone.config.json"] },
    });
    expect({
      created: ports.fileCreation.createNew.mock.calls,
      proved: proofOf.mock.calls,
    }).toEqual({
      created: [[{ path: WRITTEN, text: "# acme\n" }]],
      proved: [[CATALOGUES]],
    });
  });

  it("removes what it wrote and refuses with the load failure when the catalogues cannot be read after writing", async () => {
    const ports = portsOver();
    const proofOf = vi.fn<TeamLayoutProofRequest["proofOf"]>();
    expect(
      await provenWithTeamLayout(
        requestOver({
          ports,
          cataloguesAfterWriting: () => ({
            outcome: "failed",
            error: { kind: "rule-set-not-upgraded", path: "/repo/acme" },
          }),
          proofOf,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: {
          kind: "team-layout-unreadable",
          failure: { kind: "rule-set-not-upgraded", path: "/repo/acme" },
          unrestored: [],
          removedByVersionOne: [],
        },
      },
    });
    expect({ removed: ports.fileRemoval.remove.mock.calls, proved: proofOf.mock.calls }).toEqual({
      removed: [[{ path: WRITTEN }]],
      proved: [],
    });
  });

  it("removes what it wrote and refuses with the proof's refusal when the proof refuses", async () => {
    const ports = portsOver();
    expect(
      await provenWithTeamLayout(
        requestOver({
          ports,
          cataloguesAfterWriting: () => ({ outcome: "ok", value: CATALOGUES }),
          proofOf: vi.fn<TeamLayoutProofRequest["proofOf"]>().mockResolvedValue({
            outcome: "failed",
            error: {
              kind: "version-one-uncovered",
              clauses: [],
              removedByVersionOne: [],
            },
          }),
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: { kind: "version-one-uncovered", clauses: [], removedByVersionOne: [] },
      },
    });
    expect(ports.fileRemoval.remove.mock.calls).toEqual([[{ path: WRITTEN }]]);
  });

  it("names each file it could not remove when the catalogues cannot be read after writing", async () => {
    const ports = portsOver();
    ports.fileRemoval.remove.mockReturnValue({
      outcome: "failed",
      error: { kind: "unremovable", path: WRITTEN, detail: "EBUSY" },
    });
    expect(
      await provenWithTeamLayout(
        requestOver({
          ports,
          cataloguesAfterWriting: () => ({
            outcome: "failed",
            error: { kind: "rule-set-not-upgraded", path: "/repo/acme" },
          }),
          proofOf: vi.fn<TeamLayoutProofRequest["proofOf"]>(),
        }),
      ),
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
  });

  it("refuses before proving when a file of the layout already exists", async () => {
    const ports = portsOver();
    ports.entryKind.kindOf.mockReset().mockReturnValue("file");
    const proofOf = vi.fn<TeamLayoutProofRequest["proofOf"]>();
    expect(
      await provenWithTeamLayout(
        requestOver({
          ports,
          cataloguesAfterWriting: () => ({ outcome: "ok", value: CATALOGUES }),
          proofOf,
        }),
      ),
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
    expect(proofOf).not.toHaveBeenCalled();
  });
});
