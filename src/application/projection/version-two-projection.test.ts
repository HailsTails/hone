import { describe, expect, it, vi } from "vitest";

import type {
  RecordKind,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { ProjectedFile } from "../../domain/runner/checks-run-report.ts";
import { DEFAULT_CONVENTIONS } from "../../domain/settings/conventions.ts";
import type { CheckedTree } from "../run/checked-tree-of.ts";
import type { NamedSettingsReading } from "../run/settings/read-settings.ts";
import type { VersionTwoStages } from "../run/version-two-run.ts";
import { versionTwoProjectionOver } from "./version-two-projection.ts";

const FILE_A = repoPathOf("src/a.ts");

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

const SETTINGS: NamedSettingsReading = {
  available: [],
  selection: {
    selected: [],
    notAdopted: [],
    notRun: [],
    excluded: [],
    eslintConfigRoots: [],
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = {
  records: [],
  refused: [],
  notes: [],
  base: { measured: "yes", held: [] },
};

const TREE: CheckedTree = { tracked: [FILE_A], declaredConfigRoots: [] };

const WRITTEN: ProjectedFile = {
  file: repoPathOf("hone.eslint.mjs"),
  text: "export default [];\n",
};

const CATALOGUE_UNREAD: RunLoadFailure = {
  kind: "catalogue-not-read",
  path: "/install/rules/typescript/symptoms.json",
  reason: { reason: "absent" },
};

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi
    .fn<VersionTwoStages["catalogue"]>()
    .mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi
    .fn<VersionTwoStages["settings"]>()
    .mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: TREE }),
  engines: vi.fn<VersionTwoStages["engines"]>(),
  projections: vi
    .fn<VersionTwoStages["projections"]>()
    .mockResolvedValue({ outcome: "ok", value: [WRITTEN] }),
  renamed: vi
    .fn<VersionTwoStages["renamed"]>()
    .mockReturnValue({ measured: "yes", renamed: new Map() }),
  touched: vi.fn<VersionTwoStages["touched"]>(),
  ...request,
});

describe("versionTwoProjectionOver", () => {
  it("gives the files the projection stage wrote, over the catalogue, settings, records and tree that were read", async () => {
    const stages = stagesGiving({});
    expect(await versionTwoProjectionOver({ stages })).toEqual({ outcome: "ok", value: [WRITTEN] });
    expect(vi.mocked(stages.projections).mock.calls).toEqual([
      [
        {
          catalogue: REPORT_CATALOGUE,
          settings: SETTINGS,
          records: RECORDS,
          tree: TREE,
          checks: [],
        },
      ],
    ]);
  });

  it("runs no engine and measures nothing", async () => {
    const stages = stagesGiving({});
    await versionTwoProjectionOver({ stages });
    expect({
      engines: vi.mocked(stages.engines).mock.calls,
      renamed: vi.mocked(stages.renamed).mock.calls,
      touched: vi.mocked(stages.touched).mock.calls,
    }).toEqual({ engines: [], renamed: [], touched: [] });
  });

  it("fails with the catalogue's failure and reads nothing more when the catalogue cannot be read", async () => {
    const stages = stagesGiving({
      catalogue: vi
        .fn<VersionTwoStages["catalogue"]>()
        .mockReturnValue({ outcome: "failed", error: CATALOGUE_UNREAD }),
    });
    expect(await versionTwoProjectionOver({ stages })).toEqual({
      outcome: "failed",
      error: CATALOGUE_UNREAD,
    });
    expect(vi.mocked(stages.settings).mock.calls).toEqual([]);
  });

  it("fails with the settings' failure and projects nothing when the settings cannot be read", async () => {
    const stages = stagesGiving({
      settings: vi
        .fn<VersionTwoStages["settings"]>()
        .mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
    });
    expect(await versionTwoProjectionOver({ stages })).toEqual({
      outcome: "failed",
      error: SETTINGS_ABSENT,
    });
    expect(vi.mocked(stages.projections).mock.calls).toEqual([]);
  });

  it("fails with the records' failure and projects nothing when the records cannot be read", async () => {
    const refused: RunLoadFailure = {
      kind: "records-refused",
      refusals: [{ kind: "not-a-records-file", file: repoPathOf("hone-records/notes.txt") }],
    };
    const stages = stagesGiving({
      records: vi
        .fn<VersionTwoStages["records"]>()
        .mockReturnValue({ outcome: "failed", error: refused }),
    });
    expect(await versionTwoProjectionOver({ stages })).toEqual({
      outcome: "failed",
      error: refused,
    });
    expect(vi.mocked(stages.projections).mock.calls).toEqual([]);
  });

  it("fails with the tree's failure and projects nothing when a declared config root holds no tracked file", async () => {
    const untracked: RunLoadFailure = {
      kind: "config-root-untracked",
      root: repoPathOf("packages/web"),
    };
    const stages = stagesGiving({
      tree: vi
        .fn<VersionTwoStages["tree"]>()
        .mockReturnValue({ outcome: "failed", error: untracked }),
    });
    expect(await versionTwoProjectionOver({ stages })).toEqual({
      outcome: "failed",
      error: untracked,
    });
    expect(vi.mocked(stages.projections).mock.calls).toEqual([]);
  });

  it("fails with the projection stage's failure", async () => {
    const failure: RunLoadFailure = {
      kind: "engine-failed",
      engine: { named: "mechanism", mechanism: "eslint" },
      failure: { kind: "tool-failed", detail: "ESLint could not produce a projection" },
    };
    const stages = stagesGiving({
      projections: vi
        .fn<VersionTwoStages["projections"]>()
        .mockResolvedValue({ outcome: "failed", error: failure }),
    });
    expect(await versionTwoProjectionOver({ stages })).toEqual({
      outcome: "failed",
      error: failure,
    });
  });
});
