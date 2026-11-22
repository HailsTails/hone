import { assert, describe, expect, it, vi } from "vitest";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { SelectionRepositoryOf } from "../../application/ports/selection/selection-repository.ts";
import type { GitPort, GitTreePort } from "../../application/ports/git-port.ts";
import type { SelectionReading } from "../../domain/settings/selection/selection.ts";
import type { ShownPathOf, ShownPathOfRepository } from "../../application/ports/installation/shown-path-of.ts";
import type { EnginePort } from "../../application/ports/engine/engine-port.ts";
import type { LoadedRunner } from "../../application/ports/engine/runner-module.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { FIRST_EDITION } from "../../infrastructure/content-files/edition.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { isAbsolutePath } from "../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
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

const NOTHING_SELECTED: SelectionReading = {
  selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [],
  clauseRoots: [],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
};

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const AUDIT = mechanismIdSchema.parse("audit");

const BASKET = repoPathSchema.parse("src/basket.ts");

const MOVED_BASKET = repoPathSchema.parse("src/checkout/basket.ts");

const LOOPS_SELECTED: SelectionReading = {
  ...NOTHING_SELECTED,
  selection: { ...NOTHING_SELECTED.selection, selected: [{ address: LOOPS, mechanism: AUDIT, exceptions: "allowed" }] },
  bindings: [
    {
      mechanism: AUDIT,
      clause: { address: LOOPS, anchor: { kind: "keyword", keyword: "for" }, pieceRoot: "/install/src/infrastructure/engines/audit/CD-15", settings: {}, clauseSettings: {}, edition: FIRST_EDITION },
    },
  ],
};

const AUDIT_RUNNER: LoadedRunner = { exceptionPath: "standalone", run: vi.fn<LoadedRunner["run"]>(), conform: vi.fn<LoadedRunner["conform"]>() };

const engineFindingLoopsIn = (request: { readonly file: RepoPath }): EnginePort => ({
  load: vi.fn<EnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: { mechanism: AUDIT, runner: AUDIT_RUNNER, checksRunner: undefined } }),
  run: {
    checks: vi.fn<EnginePort["run"]["checks"]>(),
    withRecords: vi.fn<EnginePort["run"]["withRecords"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        mechanism: AUDIT,
        hits: [{ clause: LOOPS, file: request.file, anchor: { line: 3, column: 0 }, snippet: "total += item.price;" }],
        nativeExceptions: [],
        coverableKinds: [],
        projection: "none",
        slices: [],
        unprojectedFolders: [],
        measured: [],
      },
    }),
  },
  project: { checks: vi.fn<EnginePort["project"]["checks"]>(), withRecords: vi.fn<EnginePort["project"]["withRecords"]>() },
  conform: vi.fn<EnginePort["conform"]>(),
});

const MOVED_BASKET_ON_DISK: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/src/checkout/basket.ts", detail: "EACCES" } }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
};

const SHOWN_AS_GIVEN: ShownPathOf = ({ target }) => target;

const MOVED_BASKET_GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [MOVED_BASKET] }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [MOVED_BASKET] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>().mockReturnValue({ outcome: "ok", value: new Map([[MOVED_BASKET, BASKET]]) }),
};

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

  it("gives git's failure to list the files renamed since the --base-revision, asked at the located root, and records nothing", async () => {
    const ports = portsWith({ selectionRepositoryOf: vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => ({ outcome: "ok", value: NOTHING_SELECTED }) }) });
    const renamedSince = vi.fn<GitPort["renamedSince"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "git-failed", command: "git diff --name-status -M", detail: "fatal: bad revision 'origin/main'" },
    });
    const exceptionRepository = exceptionRepositoryReading({ read: () => ({ outcome: "ok", value: [] }) });

    expect(
      await adoptionDebt({
        ...ports,
        git: { ...ports.git, renamedSince },
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }) },
        arguments: ARGUMENTS,
        exceptionRepository,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "git-failed", detail: "git diff --name-status -M: fatal: bad revision 'origin/main'" } });
    expect(renamedSince).toHaveBeenCalledExactlyOnceWith({ repoRoot: REPO_ROOT, baseRevision: "origin/main" });
    expect(exceptionRepository.add).not.toHaveBeenCalled();
  });

  it("gives git's failure to list the paths at the --base-revision, and does not ask for its renames", async () => {
    const ports = portsWith({ selectionRepositoryOf: vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => ({ outcome: "ok", value: NOTHING_SELECTED }) }) });
    const renamedSince = vi.fn<GitPort["renamedSince"]>();
    const pathsAt = vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "git-failed", command: "git ls-tree", detail: "fatal: Not a valid object name origin/main" },
    });

    expect(
      await adoptionDebt({
        ...ports,
        git: { ...ports.git, renamedSince },
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        gitTree: { pathsAt },
        arguments: ARGUMENTS,
        exceptionRepository: exceptionRepositoryReading({ read: () => ({ outcome: "ok", value: [] }) }),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "git-failed", detail: "git ls-tree: fatal: Not a valid object name origin/main" } });
    expect(renamedSince).not.toHaveBeenCalled();
  });

  it("records the debt of a file git saw renamed from a path the base revision holds, at its new path", async () => {
    const ports = portsWith({ selectionRepositoryOf: vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => ({ outcome: "ok", value: LOOPS_SELECTED }) }) });
    const exceptionRepository: ExceptionRepository = {
      ...exceptionRepositoryReading({ read: () => ({ outcome: "ok", value: [] }) }),
      add: vi.fn<ExceptionRepository["add"]>().mockReturnValue({ outcome: "ok", value: undefined }),
    };

    expect(
      await adoptionDebt({
        ...ports,
        path: { ...ports.path, join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/src/checkout/basket.ts") },
        fileText: MOVED_BASKET_ON_DISK,
        engine: engineFindingLoopsIn({ file: MOVED_BASKET }),
        git: MOVED_BASKET_GIT,
        exceptionEntryParser: { parseExceptionEntries: () => ({ records: [], invalid: [] }), importedEntriesIn: () => "absent", importSourcesOf: () => [] },
        shownPathOfRepository: vi.fn<ShownPathOfRepository>().mockReturnValue(SHOWN_AS_GIVEN),
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [BASKET] }) },
        arguments: ARGUMENTS,
        exceptionRepository,
      }),
    ).toEqual({ outcome: "ok", value: [{ clause: LOOPS, file: MOVED_BASKET, effect: "recorded" }] });
    expect(exceptionRepository.add).toHaveBeenCalledExactlyOnceWith({ entries: [{ kind: "file-carve-out", clause: "CD-15#loops", file: MOVED_BASKET }] });
  });
});
