import { assert, describe, expect, it, vi } from "vitest";

import type { AuthoriseRequest } from "../application/ports/authorising.ts";
import type { NamedEngineRun } from "../application/ports/engine/engine-run.ts";
import type { RecordsEditor } from "../application/ports/records/records-editor.ts";
import type { RecordsReader } from "../application/ports/records/records-reader.ts";
import type { RecordsSource } from "../application/ports/records/records-source.ts";
import type { RecordsStoreOf } from "../application/ports/records/records-store.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import type {
  Check,
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../domain/language-layer/symptom-catalogue.ts";
import type { PlacedRecord } from "../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
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
    renamed: vi
      .fn<VersionTwoStages["renamed"]>()
      .mockReturnValue({ measured: "yes", renamed: new Map() }),
    touched: vi.fn<VersionTwoStages["touched"]>(),
  },
  repoRoot: absoluteRootOf("/repo"),
  recordsSourceFor: vi.fn<RecordsSourceFor>(),
  recordsStoreOf: vi.fn<RecordsStoreOf>(),
  recordsReader: { recordsReadingOf: vi.fn() },
  recordsEditor: {
    documentsWithAdded: vi.fn(),
    documentsWithRepointed: vi.fn(),
    placeOfAddition: vi.fn(),
    documentsWithRemoved: vi.fn(),
  },
});

describe("versionTwoRecordDebtOf", () => {
  it("gives the run's load failure and opens no records store", async () => {
    const input = inputFailingCatalogue();

    expect(
      await versionTwoRecordDebtOf({
        ...input,
        leave: [],
        projectCommand: PROJECT_COMMAND,
      }),
    ).toEqual({
      outcome: "failed",
      error: SETTINGS_ABSENT,
    });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

const DEBT_KIND: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
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
  nestedConfigurations: [],
  unprojectedFolders: [],
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
        eslintProjectionKind: "ts",
        conventions: DEFAULT_CONVENTIONS,
        notes: [],
      },
    }),
    records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({
      outcome: "ok",
      value: { records: [], refused: [], notes: [], base: { measured: "yes", held: [] } },
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
    renamed: vi
      .fn<VersionTwoStages["renamed"]>()
      .mockReturnValue({ measured: "yes", renamed: new Map() }),
    touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({
      measured: "yes",
      paths: new Set(),
    }),
  },
});

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  engines: [{ name: "walker" }],
  forms: [],
  findingSpecifics: [],
};

const BASKET = repoPathOf("src/basket.ts");

const MOVED_BASKET = repoPathOf("src/basket/basket.ts");

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const DEBT_ON_BASKET: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "one-check", check: CAST_CHECK },
    file: BASKET,
    holding: { held: "stated" },
  },
};

const CAST_IN_MOVED_BASKET_RUN: NamedEngineRun = {
  mechanism: "walker",
  hits: [
    {
      check: "claimed-type#cast-expressions",
      file: MOVED_BASKET,
      anchor: { line: 3, column: 0 },
      snippet: "as Basket",
    },
  ],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "none",
  slices: [],
  measured: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
};

const HELD_DOCUMENTS = [{ file: DEBT_FILE, document: { version: 2, records: [] } }];

const inputAnsweringAcrossARename = (): VersionTwoRecordInput => {
  const input = inputWithOutOfDateProjection();
  return {
    ...input,
    stages: {
      ...input.stages,
      catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({
        outcome: "ok",
        value: { ...CATALOGUE, symptoms: [CLAIMED_TYPE], checks: [CAST_CHECK] },
      }),
      records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({
        outcome: "ok",
        value: {
          records: [DEBT_ON_BASKET],
          refused: [],
          notes: [],
          base: { measured: "yes", held: [DEBT_ON_BASKET.record] },
        },
      }),
      engines: vi
        .fn<VersionTwoStages["engines"]>()
        .mockResolvedValue({ outcome: "ok", value: [CAST_IN_MOVED_BASKET_RUN] }),
      renamed: vi.fn<VersionTwoStages["renamed"]>().mockReturnValue({
        measured: "yes",
        renamed: new Map([[MOVED_BASKET, { basePath: BASKET, content: "unchanged" }]]),
      }),
    },
    recordsSourceFor: vi.fn<RecordsSourceFor>().mockReturnValue({
      read: vi.fn().mockReturnValue({ outcome: "ok", value: HELD_DOCUMENTS }),
      readAt: vi.fn(),
    }),
    recordsStoreOf: vi
      .fn<RecordsStoreOf>()
      .mockReturnValue({ apply: vi.fn().mockReturnValue({ outcome: "ok", value: undefined }) }),
    recordsReader: {
      recordsReadingOf: vi.fn<RecordsReader["recordsReadingOf"]>().mockReturnValue({
        outcome: "ok",
        value: {
          records: [DEBT_ON_BASKET],
          refused: [],
          notes: [],
          base: { measured: "yes", held: [DEBT_ON_BASKET.record] },
        },
      }),
    },
    recordsEditor: {
      ...input.recordsEditor,
      documentsWithRepointed: vi
        .fn<RecordsEditor["documentsWithRepointed"]>()
        .mockReturnValue({ outcome: "ok", value: HELD_DOCUMENTS }),
      documentsWithAdded: vi.fn().mockReturnValue({ outcome: "ok", value: [] }),
    },
  };
};

describe("versionTwoRecordDebtOf, debt the run answers across a rename", () => {
  it("repoints the debt held at the file's path in the base to the path git sees it renamed to, recording nothing", async () => {
    const input = inputAnsweringAcrossARename();
    const recorded = await versionTwoRecordDebtOf({
      ...input,
      leave: [],
      projectCommand: PROJECT_COMMAND,
    });
    expect({
      recorded,
      repointed: vi.mocked(input.recordsEditor.documentsWithRepointed).mock.calls,
    }).toEqual({
      recorded: {
        outcome: "ok",
        value: { outcomes: [], moved: [{ place: DEBT_ON_BASKET.place, file: MOVED_BASKET }] },
      },
      repointed: [
        [
          {
            documents: HELD_DOCUMENTS,
            repointings: [{ place: DEBT_ON_BASKET.place, file: MOVED_BASKET }],
          },
        ],
      ],
    });
  });
});

describe("versionTwoRecordDebtOf, an out-of-date projection", () => {
  it("refuses with projection-stale naming the project command and opens no records store", async () => {
    const input = inputWithOutOfDateProjection();

    expect(
      await versionTwoRecordDebtOf({
        ...input,
        leave: [],
        projectCommand: PROJECT_COMMAND,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "projection-stale",
        problem: {
          scope: "slice",
          engine: { name: "eslint" },
          slice: repoPathOf("hone.eslint.ts"),
          state: "out-of-date",
        },
        projectCommand: PROJECT_COMMAND,
      },
    });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtOf", () => {
  it("gives the run's load failure and opens no records store", async () => {
    const input = inputFailingCatalogue();

    expect(
      await versionTwoPruneDebtOf({
        ...input,
        forfeiture: undefined,
        projectCommand: PROJECT_COMMAND,
      }),
    ).toEqual({
      outcome: "failed",
      error: SETTINGS_ABSENT,
    });
    expect(input.recordsStoreOf).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtOf, an out-of-date projection", () => {
  it("names the out-of-date TypeScript projection and writes no records", async () => {
    const input = inputWithOutOfDateProjection();

    const pruned = await versionTwoPruneDebtOf({
      ...input,
      forfeiture: undefined,
      projectCommand: PROJECT_COMMAND,
    });

    expect({
      pruned,
      storesOpened: vi.mocked(input.recordsStoreOf).mock.calls,
      sourcesOpened: vi.mocked(input.recordsSourceFor).mock.calls,
    }).toEqual({
      pruned: {
        outcome: "failed",
        error: {
          kind: "projection-stale",
          problem: {
            scope: "slice",
            engine: { name: "eslint" },
            state: "out-of-date",
            slice: "hone.eslint.ts",
          },
          projectCommand: PROJECT_COMMAND,
        },
      },
      storesOpened: [],
      sourcesOpened: [],
    });
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
