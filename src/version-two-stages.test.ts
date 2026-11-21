import { describe, expect, it, vi } from "vitest";
import { CLAIMED_TYPE, REPORT_CATALOGUE, WHOLE_SYMPTOM } from "../tests/report-catalogue.ts";
import type { DirectoryPort } from "./infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "./infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createPathPort } from "./infrastructure/node/path-port.ts";
import type { RecordsReading } from "./infrastructure/hone-records-folder/hone-record.ts";
import { DEFAULT_CONVENTIONS } from "./infrastructure/hone-config-file/conventions.ts";
import type { SettingsReading } from "./application/run/settings/read-settings.ts";
import { absolutePathSchema } from "./infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "./infrastructure/hone-records-folder/repo-path.ts";
import { createRecordsFolder } from "./infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { type VersionTwoPorts, versionTwoStagesOver } from "./version-two-stages.ts";

const REPO = absolutePathSchema.parse("/repo");

const INSTALL = absolutePathSchema.parse("/install");

const NOTHING_PRESENT: Pick<FileTextPort, "exists" | "read"> = {
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  read: vi.fn<FileTextPort["read"]>(),
};

const gitListing = (request: { readonly tracked: GitPort["trackedPaths"] }): GitPort => ({
  trackedPaths: request.tracked,
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const portsOver = (request: { readonly git: GitPort }): VersionTwoPorts => ({
  fileText: { ...NOTHING_PRESENT, write: vi.fn<FileTextPort["write"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: request.git,
  gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
  directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
  recordsSourceOf: createRecordsFolder,
});

const GIT_LISTING_NOTHING = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [] }) });

const stagesOver = (request: { readonly git: GitPort; readonly baseRevision: string | undefined }) =>
  versionTwoStagesOver({ ports: portsOver(request), locations: { repoRoot: REPO, installRoot: INSTALL, moduleExtension: ".ts", baseRevision: request.baseRevision } });

const SETTINGS: SettingsReading = {
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

describe("versionTwoStagesOver", () => {
  it("fails as a catalogue not read, absent, when the install holds no symptom catalogue", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).catalogue()).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: "/install/rules/typescript/symptoms.json", reason: { reason: "absent" } },
    });
  });

  it("fails as config absent when the repository holds no hone.config.json", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).settings({ catalogue: REPORT_CATALOGUE })).toEqual({
      outcome: "failed",
      error: { kind: "config-absent", repo: "/repo" },
    });
  });

  it("reads no records, and says no base revision was given, when the repository holds no hone-records folder and none was passed", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).records({ catalogue: REPORT_CATALOGUE })).toEqual({
      outcome: "ok",
      value: { records: [], refused: [], notes: [], base: { measured: "no", base: { state: "not-given" } } },
    });
  });

  it("fails as a git failure when git cannot list the tracked files", () => {
    const failing = gitListing({
      tracked: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" } }),
    });
    expect(stagesOver({ git: failing, baseRevision: undefined }).tree({ settings: SETTINGS })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "git ls-files: not a repository" },
    });
  });

  it("touches nothing when no record is debt, without asking git", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    const records: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };
    expect(stagesOver({ git, baseRevision: "origin/main" }).touched({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records })).toEqual({ measured: "yes", paths: new Set() });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([]);
  });

  it("measures the files changed since the base revision when a record is debt", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    vi.mocked(git.changedSince).mockReturnValue({ outcome: "ok", value: [repoPathSchema.parse("src/a.ts")] });
    const records: RecordsReading = {
      records: [
        {
          place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
          record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: repoPathSchema.parse("src/a.ts"), holding: { held: "stated" } },
        },
      ],
      refused: [],
      notes: [],
      base: { measured: "yes" },
    };
    expect(stagesOver({ git, baseRevision: "origin/main" }).touched({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records })).toEqual({
      measured: "yes",
      paths: new Set([repoPathSchema.parse("src/a.ts")]),
    });
  });
});
