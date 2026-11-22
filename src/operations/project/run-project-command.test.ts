import { describe, expect, it, vi } from "vitest";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { SelectionRepositoryOf } from "../../application/ports/selection/selection-repository.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { projectionsIn } from "./run-project-command.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const INSTALL_ROOT = absoluteRootOf("/install");

const SELECTION_ABSENT: LoadFailure = { kind: "selection-absent", repo: "/repo" };

const PORTS: VersionOneCommandPorts = {
  path: { join: vi.fn(), joinRepository: vi.fn(), relative: vi.fn(), directoryOf: vi.fn(), repositoryDirectoryOf: vi.fn(), resolve: vi.fn(), fromFileUrl: vi.fn() },
  fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() },
  modules: { load: vi.fn() },
  engine: { load: vi.fn(), run: { checks: vi.fn(), withRecords: vi.fn() }, project: { checks: vi.fn(), withRecords: vi.fn() }, conform: vi.fn() },
  git: { trackedPaths: vi.fn(), changedSince: vi.fn(), contentInBase: vi.fn(), textInBase: vi.fn(), renamedSince: vi.fn() },
  exceptionRepositoryOf: vi.fn(),
  exceptionEntryParser: { parseExceptionEntries: vi.fn(), importedEntriesIn: vi.fn(), importSourcesOf: vi.fn() },
  selectionRepositoryOf: vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => ({ outcome: "failed", error: SELECTION_ABSENT }) }),
  shownPathOfRepository: vi.fn(),
  moduleUrl: "file:///install/src/hone.ts",
};

describe("projectionsIn", () => {
  it("reads the selection at the located roots and gives its load failure", async () => {
    expect(await projectionsIn({ ...PORTS, repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT })).toEqual({ outcome: "failed", error: SELECTION_ABSENT });
    expect(PORTS.selectionRepositoryOf).toHaveBeenCalledWith(expect.objectContaining({ repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts" }));
    expect(PORTS.exceptionRepositoryOf).toHaveBeenCalledExactlyOnceWith({ repoRoot: REPO_ROOT });
  });
});
