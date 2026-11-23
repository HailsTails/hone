import { assert, describe, expect, it, vi } from "vitest";

import type { AuthoriseRequest } from "../application/ports/authorising.ts";
import type { NamedEngineRun } from "../application/ports/engine/engine-run.ts";
import type { RecordsStoreOf } from "../application/ports/records/records-store.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import type {
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../domain/language-layer/symptom-catalogue.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { ruleSetNameOf } from "../domain/rule-set/rule-set-name-of.ts";
import { DEFAULT_CONVENTIONS } from "../domain/settings/conventions.ts";
import {
  type RecordsSourceFor,
  type VersionTwoRecordInput,
  versionTwoAuthoriseOf,
  versionTwoPruneDebtOf,
  versionTwoRecordDebtOf,
} from "./version-two-record-commands.ts";

const AUTHORISING: AuthoriseRequest = {
  answers: { ruleSet: "hone", name: "CD#CD-1#any-cast" },
  file: repoPathOf("src/a.ts"),
  case: "a cast at a boundary",
  owes: "the boundary type",
  whys: [],
  rootCause: "the boundary is untyped",
  rootEvidence: "src/a.ts",
  readback: "the cast stays",
  owner: "platform",
};

const PROJECT_COMMAND = "node /tool/hone.js project --repo /repo";

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const inputFailingCatalogue = (): VersionTwoRecordInput => ({
  stages: {
    catalogue: vi
      .fn<VersionTwoStages["catalogue"]>()
      .mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
    settings: vi.fn<VersionTwoStages["settings"]>(),
    records: vi.fn<VersionTwoStages["records"]>(),
    tree: vi.fn<VersionTwoStages["tree"]>(),
    engines: vi.fn<VersionTwoStages["engines"]>(),
    projections: vi.fn<VersionTwoStages["projections"]>(),
    touched: vi.fn<VersionTwoStages["touched"]>(),
  },
  repoRoot: absoluteRootOf("/repo"),
  recordsSourceFor: vi.fn<RecordsSourceFor>(),
  recordsStoreOf: vi.fn<RecordsStoreOf>(),
  recordsReader: { recordsReadingOf: vi.fn() },
  recordsEditor: {
    documentsWithAdded: vi.fn(),
    placeOfAddition: vi.fn(),
    documentsWithRemoved: vi.fn(),
  },
});

describe("versionTwoRecordDebtOf", () => {
  it("gives the run's load failure and opens no records store", async () => {
    const input = inputFailingCatalogue();

    expect(
      await versionTwoRecordDebtOf({ ...input, leave: [], projectCommand: PROJECT_COMMAND }),
    ).toEqual({
      outcome: "failed",
      error: SETTINGS_ABSENT,
    });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT_KIND, AUTHORISED_LOCATION_KIND],
  engines: [{ name: "eslint" }],
  symptoms: [],
  clauses: [],
  namedBans: [],
  checks: [],
};

const OUT_OF_DATE_ESLINT_RUN: NamedEngineRun = {
  mechanism: "eslint",
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "out-of-date",
  slices: [],
  measured: [],
  misnamedRuleIds: [],
};

const inputWithOutOfDateProjection = (): VersionTwoRecordInput => ({
  ...inputFailingCatalogue(),
  stages: {
    catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({
      outcome: "ok",
      value: CATALOGUE,
    }),
    settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({
      outcome: "ok",
      value: {
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
      },
    }),
    records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({
      outcome: "ok",
      value: { records: [], refused: [], notes: [], base: { measured: "yes" } },
    }),
    tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({
      outcome: "ok",
      value: { tracked: [], declaredConfigRoots: [] },
    }),
    engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
      outcome: "ok",
      value: [OUT_OF_DATE_ESLINT_RUN],
    }),
    projections: vi.fn<VersionTwoStages["projections"]>(),
    touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({
      measured: "yes",
      paths: new Set(),
    }),
  },
});

describe("versionTwoRecordDebtOf, an out-of-date projection", () => {
  it("refuses with projection-stale naming the project command and opens no records store", async () => {
    const input = inputWithOutOfDateProjection();

    expect(
      await versionTwoRecordDebtOf({ ...input, leave: [], projectCommand: PROJECT_COMMAND }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "projection-stale",
        problem: { scope: "projection", engine: { name: "eslint" }, state: "out-of-date" },
        projectCommand: PROJECT_COMMAND,
      },
    });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtOf", () => {
  it("gives the run's load failure and opens no records store", async () => {
    const input = inputFailingCatalogue();

    expect(await versionTwoPruneDebtOf({ ...input, forfeiture: undefined })).toEqual({
      outcome: "failed",
      error: SETTINGS_ABSENT,
    });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

describe("versionTwoAuthoriseOf", () => {
  it("gives the catalogue's load failure and reads no records", () => {
    const input = inputFailingCatalogue();

    expect(
      versionTwoAuthoriseOf({
        ...input,
        authorising: AUTHORISING,
      }),
    ).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(input.recordsSourceFor).not.toHaveBeenCalled();
  });

  it("reads the records against the catalogue with the team's symptoms, without reading the run's records", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamSymptom: Symptom = {
      ruleSet: acme,
      name: "team-cast",
      title: "Team cast",
      seen: "A cast.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };
    const base = inputWithOutOfDateProjection();
    const settings = base.stages.settings({ catalogue: CATALOGUE });
    assert(settings.outcome === "ok");
    const recordsSourceFor = vi.fn<RecordsSourceFor>().mockReturnValue({
      read: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "not-a-records-file", file: repoPathOf("hone-records/x") },
      }),
      readAt: vi.fn(),
    });
    versionTwoAuthoriseOf({
      ...base,
      stages: {
        ...base.stages,
        settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({
          outcome: "ok",
          value: {
            ...settings.value,
            externalCatalogues: [
              { ruleSet: acme, catalogue: { ...CATALOGUE, symptoms: [teamSymptom] } },
            ],
          },
        }),
      },
      recordsSourceFor,
      authorising: { ...AUTHORISING, answers: { ruleSet: acme, name: "team-cast" } },
    });
    expect(recordsSourceFor).toHaveBeenCalledExactlyOnceWith({
      catalogue: { ...CATALOGUE, symptoms: [teamSymptom] },
    });
    expect(base.stages.records).not.toHaveBeenCalled();
  });
});
