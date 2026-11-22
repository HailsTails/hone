import { assert, describe, expect, it, vi } from "vitest";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { SelectionRepositoryOf } from "../../application/ports/selection/selection-repository.ts";
import type { GitTreePort } from "../../application/ports/git-port.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { isAbsolutePath } from "../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { adoptionDebt } from "./run-record-debt-command.ts";

const absolute = (text: string): AbsolutePath => {
  assert(isAbsolutePath(text), `${text} is absolute`);
  return text;
};

const REPO_ROOT = absolute("/repo");

const INSTALL_ROOT = absolute("/install");

const SELECTION_ABSENT: LoadFailure = { kind: "selection-absent", repo: "/repo" };

const portsWith = (request: { readonly selectionRepositoryOf: SelectionRepositoryOf }): VersionOneCommandPorts => ({
  path: { join: vi.fn(), joinRepository: vi.fn(), relative: vi.fn(), directoryOf: vi.fn(), repositoryDirectoryOf: vi.fn(), resolve: vi.fn(), fromFileUrl: vi.fn() },
  fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() },
  modules: { load: vi.fn() },
  engine: { load: vi.fn(), run: { checks: vi.fn(), withRecords: vi.fn() }, project: { checks: vi.fn(), withRecords: vi.fn() }, conform: vi.fn() },
  git: { trackedPaths: vi.fn(), changedSince: vi.fn(), contentInBase: vi.fn(), textInBase: vi.fn(), renamedSince: vi.fn() },
  exceptionRepositoryOf: vi.fn(),
  exceptionEntryParser: { parseExceptionEntries: vi.fn(), importedEntriesIn: vi.fn(), importSourcesOf: vi.fn() },
  selectionRepositoryOf: request.selectionRepositoryOf,
  shownPathOfRepository: vi.fn(),
  moduleUrl: "file:///install/src/hone.ts",
});

const exceptionRepositoryReading = (request: { readonly read: ExceptionRepository["read"] }): ExceptionRepository => ({
  read: vi.fn(request.read),
  readAt: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  moveToSplitLayout: vi.fn(),
});

const ARGUMENTS = { repo: "/repo", baseRevision: "origin/main", leave: [] };

describe("adoptionDebt", () => {
  it("gives the selection's load failure, read at the located roots, and reads no records", async () => {
    const ports = portsWith({ selectionRepositoryOf: vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => ({ outcome: "failed", error: SELECTION_ABSENT }) }) });
    const exceptionRepository = exceptionRepositoryReading({ read: () => ({ outcome: "ok", value: [] }) });

    expect(
      await adoptionDebt({ ...ports, repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() }, arguments: ARGUMENTS, exceptionRepository }),
    ).toEqual({ outcome: "failed", error: SELECTION_ABSENT });
    expect(ports.selectionRepositoryOf).toHaveBeenCalledExactlyOnceWith({ repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText: ports.fileText, path: ports.path });
    expect(exceptionRepository.read).not.toHaveBeenCalled();
  });
});
