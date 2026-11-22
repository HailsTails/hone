import { describe, expect, it, vi } from "vitest";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { RunSettingsOf, SelectionRepositoryOf } from "../../application/ports/selection/selection-repository.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { checkOf } from "./run-check-command.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const INSTALL_ROOT = absoluteRootOf("/install");

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

const ARGUMENTS = { repo: "/repo", baseRevision: undefined, reportOutput: undefined, forfeiture: undefined };

describe("checkOf", () => {
  it("gives the run settings' load failure and reads no selection", async () => {
    const selectionRepositoryOf = vi.fn<SelectionRepositoryOf>();
    const runSettingsOf = vi.fn<RunSettingsOf>().mockReturnValue({ outcome: "failed", error: SELECTION_ABSENT });

    expect(
      await checkOf({ ...portsWith({ selectionRepositoryOf }), repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, arguments: ARGUMENTS, runSettingsOf }),
    ).toEqual({ outcome: "failed", error: SELECTION_ABSENT });
    expect(runSettingsOf).toHaveBeenCalledExactlyOnceWith({ repoRoot: REPO_ROOT });
    expect(selectionRepositoryOf).not.toHaveBeenCalled();
  });

  it("reads the selection at the located roots and gives its load failure", async () => {
    const ports = portsWith({ selectionRepositoryOf: vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => ({ outcome: "failed", error: SELECTION_ABSENT }) }) });
    const runSettingsOf = vi.fn<RunSettingsOf>().mockReturnValue({ outcome: "ok", value: { reportOutput: "full", assessment: { forfeiture: "this-run" } } });

    expect(await checkOf({ ...ports, repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, arguments: ARGUMENTS, runSettingsOf })).toEqual({
      outcome: "failed",
      error: SELECTION_ABSENT,
    });
    expect(ports.selectionRepositoryOf).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      fileText: ports.fileText,
      path: ports.path,
    });
  });
});
