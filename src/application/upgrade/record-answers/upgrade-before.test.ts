import { describe, expect, it, vi } from "vitest";

import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";
import { createUpgradeBefore } from "./upgrade-before.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};
const ABSENT: LoadFailure = { kind: "selection-absent", repo: REPO };

const inputsWith = (
  read: SelectionRepository["read"],
): Parameters<typeof createUpgradeBefore>[0] => ({
  selection: SELECTION,
  catalogues: [],
  check: {
    repoRoot: REPO,
    installRoot: INSTALL,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: SELECTION.assessment,
    fileText: { exists: vi.fn(), read: vi.fn() },
    modules: { load: vi.fn() },
    path: {
      join: vi.fn(),
      joinRepository: vi.fn(),
      relative: vi.fn(),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    },
    git: {
      trackedPaths: vi.fn(),
      changedSince: vi.fn(),
      contentInBase: vi.fn(),
      textInBase: vi.fn(),
      renamedSince: vi.fn(),
    },
    exceptionRepository: { read: vi.fn(), readAt: vi.fn() },
    exceptionEntryParser: {
      parseExceptionEntries: vi.fn(),
      importedEntriesIn: vi.fn(),
      importSourcesOf: vi.fn(),
    },
    selectionRepository: { read },
  },
  engine: { load: vi.fn(), run: vi.fn(), project: vi.fn() },
  measureVersionOne: vi.fn(),
  sources: { settingsFile: vi.fn(), ruleSetRoot: vi.fn(), catalogue: vi.fn() },
  readPiece: vi.fn(),
  projection: { inspect: vi.fn(), prepare: vi.fn() },
  loadFailureDetail: () => "selection is absent",
});

describe("createUpgradeBefore", () => {
  it("reads the version one selection once, at first use, and shares the refusal across its calls", async () => {
    const read = vi
      .fn<SelectionRepository["read"]>()
      .mockReturnValue({ outcome: "failed", error: ABSENT });
    const input = inputsWith(read);
    const before = createUpgradeBefore(input);
    expect(read).not.toHaveBeenCalled();

    await expect(before.report()).resolves.toEqual({ outcome: "failed", error: ABSENT });
    await expect(before.enginePass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-run-failed", detail: "selection is absent" },
    });
    await expect(before.prepareProjections([])).resolves.toEqual({
      outcome: "failed",
      error: ABSENT,
    });

    expect(read).toHaveBeenCalledExactlyOnceWith({});
    expect(input.check.git.trackedPaths).not.toHaveBeenCalled();
    expect(input.projection.inspect).not.toHaveBeenCalled();
  });
});
