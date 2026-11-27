import { describe, expect, it, vi } from "vitest";

import type { NamedEngineRun } from "../../application/ports/engine/engine-run.ts";
import type { RecordsEditor } from "../../application/ports/records/records-editor.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import type { NamedSettingsReading } from "../../application/run/settings/read-settings.ts";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type {
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { PlacedRecord } from "../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { DEFAULT_CONVENTIONS } from "../../domain/settings/conventions.ts";
import { createSmoothingCommands, type FoundTreeReach } from "./smoothing-commands.ts";

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
  eslintProjectionKind: "mjs",
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CURRENT_ESLINT_RUN: NamedEngineRun = {
  mechanism: "eslint",
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  candidateFiles: [],
  comparedOutputs: [],
  inapplicable: [],
  slices: [],
  measured: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
};

const PROJECT_COMMAND = "hone project --repo /repo";

const stagesHolding = (request: {
  readonly records: readonly PlacedRecord[];
  readonly run: NamedEngineRun;
}): VersionTwoStages => ({
  catalogue: vi
    .fn<VersionTwoStages["catalogue"]>()
    .mockReturnValue({ outcome: "ok", value: CATALOGUE }),
  settings: vi
    .fn<VersionTwoStages["settings"]>()
    .mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({
    outcome: "ok",
    value: {
      records: request.records,
      refused: [],
      notes: [],
      base: { measured: "yes", placements: [] },
    },
  }),
  tree: vi
    .fn<VersionTwoStages["tree"]>()
    .mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
  engines: vi
    .fn<VersionTwoStages["engines"]>()
    .mockResolvedValue({ outcome: "ok", value: [request.run] }),
  projections: vi.fn<VersionTwoStages["projections"]>().mockResolvedValue({
    outcome: "ok",
    value: [{ kind: "write", file: repoPathOf("hone.eslint.mjs"), text: "the projection" }],
  }),
  renamed: vi
    .fn<VersionTwoStages["renamed"]>()
    .mockReturnValue({ measured: "yes", renamed: new Map() }),
  touched: vi
    .fn<VersionTwoStages["touched"]>()
    .mockReturnValue({ measured: "yes", paths: new Set() }),
});

describe("createSmoothingCommands", () => {
  it("projects over the found tree of the files written, giving the projected files to write and remove", async () => {
    const stages = stagesHolding({ records: [], run: CURRENT_ESLINT_RUN });
    vi.mocked(stages.projections).mockResolvedValue({
      outcome: "ok",
      value: [
        { kind: "write", file: repoPathOf("hone.eslint.mjs"), text: "the projection" },
        { kind: "remove", file: repoPathOf("hone.eslint.ts") },
      ],
    });
    const reach = vi
      .fn<(request: { readonly written: readonly string[] }) => FoundTreeReach>()
      .mockReturnValue({ stages, recordsSourceFor: vi.fn() });
    const written = { written: [repoPathOf("hone.config.json")] };
    const commands = createSmoothingCommands({
      reach,
      repoRoot: absoluteRootOf("/repo"),
      recordsReader: { recordsReadingOf: vi.fn() },
      recordsEditor: {
        documentsWithAdded: vi.fn<RecordsEditor["documentsWithAdded"]>(),
        placeOfAddition: vi.fn<RecordsEditor["placeOfAddition"]>(),
        documentsWithRepointed: vi.fn<RecordsEditor["documentsWithRepointed"]>(),
        documentsWithRemoved: vi.fn<RecordsEditor["documentsWithRemoved"]>(),
      },
      projectCommand: PROJECT_COMMAND,
    });

    const projected = await commands.project(written);

    expect({ projected, reachedFor: reach.mock.calls }).toEqual({
      projected: {
        outcome: "ok",
        value: {
          write: [{ file: repoPathOf("hone.eslint.mjs"), text: "the projection" }],
          remove: [repoPathOf("hone.eslint.ts")],
        },
      },
      reachedFor: [[written]],
    });
  });

  it("removes each carried record in a written file that answers nothing, giving the edited records file to write", async () => {
    const recordsFile = repoPathOf("hone-records/authorised-locations/loop-keyword.json");
    const carried: PlacedRecord = {
      place: { file: recordsFile, index: 0 },
      record: {
        kind: "authorised-location",
        symptom: LOOP_KEYWORD,
        reach: { reaches: "one-check", check: { symptom: LOOP_KEYWORD, name: "loops" } },
        file: repoPathOf("src/a.ts"),
        holding: {
          held: "carried",
          entry: {},
          lacks: ["case"],
          standing: "unjudged",
          binding: { binds: "check-and-file" },
        },
      },
    };
    const documents = [{ file: recordsFile, document: { version: 2, records: [{}] } }];
    const read = vi
      .fn<RecordsSource["read"]>()
      .mockReturnValue({ outcome: "ok", value: documents });
    const documentsWithRemoved = vi.fn<RecordsEditor["documentsWithRemoved"]>().mockReturnValue({
      outcome: "ok",
      value: { write: [{ file: recordsFile, document: { version: 2, records: [] } }], remove: [] },
    });
    const commands = createSmoothingCommands({
      reach: () => ({
        stages: stagesHolding({ records: [carried], run: CURRENT_ESLINT_RUN }),
        recordsSourceFor: () => ({ read, readAt: vi.fn<RecordsSource["readAt"]>() }),
      }),
      repoRoot: absoluteRootOf("/repo"),
      recordsReader: { recordsReadingOf: vi.fn() },
      recordsEditor: {
        documentsWithAdded: vi.fn<RecordsEditor["documentsWithAdded"]>(),
        placeOfAddition: vi.fn<RecordsEditor["placeOfAddition"]>(),
        documentsWithRepointed: vi.fn<RecordsEditor["documentsWithRepointed"]>(),
        documentsWithRemoved,
      },
      projectCommand: PROJECT_COMMAND,
    });

    const removed = await commands.removeCarried({ written: [recordsFile] });

    expect({ removed, removedPlaces: documentsWithRemoved.mock.calls }).toEqual({
      removed: {
        outcome: "ok",
        value: {
          changes: {
            write: [{ file: recordsFile, text: '{\n  "version": 2,\n  "records": []\n}\n' }],
            remove: [],
          },
          done: [carried],
        },
      },
      removedPlaces: [[{ documents, places: [carried.place] }]],
    });
  });

  it("refuses to judge carried records when the run leaves something unmeasured, reading no records", async () => {
    const read = vi.fn<RecordsSource["read"]>();
    const commands = createSmoothingCommands({
      reach: () => ({
        stages: stagesHolding({
          records: [],
          run: {
            ...CURRENT_ESLINT_RUN,
            projection: "missing",
            projectionFile: repoPathOf("hone.eslint.mjs"),
          },
        }),
        recordsSourceFor: () => ({ read, readAt: vi.fn<RecordsSource["readAt"]>() }),
      }),
      repoRoot: absoluteRootOf("/repo"),
      recordsReader: { recordsReadingOf: vi.fn() },
      recordsEditor: {
        documentsWithAdded: vi.fn<RecordsEditor["documentsWithAdded"]>(),
        placeOfAddition: vi.fn<RecordsEditor["placeOfAddition"]>(),
        documentsWithRepointed: vi.fn<RecordsEditor["documentsWithRepointed"]>(),
        documentsWithRemoved: vi.fn<RecordsEditor["documentsWithRemoved"]>(),
      },
      projectCommand: PROJECT_COMMAND,
    });

    const removed = await commands.removeCarried({ written: [] });

    expect({ removed, read: read.mock.calls }).toEqual({
      removed: {
        outcome: "failed",
        error: {
          kind: "run-unmeasured",
          unmeasured: [
            {
              kind: "engine-not-run",
              engine: { name: "eslint" },
              projection: "missing",
              file: repoPathOf("hone.eslint.mjs"),
            },
          ],
        },
      },
      read: [],
    });
  });

  it("gives the records edit prune-debt makes as files to write, without writing them", async () => {
    const recordsFile = repoPathOf("hone-records/debt/loop-keyword.json");
    const debt: PlacedRecord = {
      place: { file: recordsFile, index: 0 },
      record: {
        kind: "debt",
        symptom: LOOP_KEYWORD,
        reach: { reaches: "whole-symptom" },
        file: repoPathOf("src/a.ts"),
        holding: { held: "stated" },
      },
    };
    const documents = [{ file: recordsFile, document: { version: 2, records: [{}] } }];
    const commands = createSmoothingCommands({
      reach: () => ({
        stages: stagesHolding({ records: [debt], run: CURRENT_ESLINT_RUN }),
        recordsSourceFor: () => ({
          read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: documents }),
          readAt: vi.fn<RecordsSource["readAt"]>(),
        }),
      }),
      repoRoot: absoluteRootOf("/repo"),
      recordsReader: { recordsReadingOf: vi.fn() },
      recordsEditor: {
        documentsWithAdded: vi.fn<RecordsEditor["documentsWithAdded"]>(),
        placeOfAddition: vi.fn<RecordsEditor["placeOfAddition"]>(),
        documentsWithRepointed: vi.fn<RecordsEditor["documentsWithRepointed"]>(),
        documentsWithRemoved: vi
          .fn<RecordsEditor["documentsWithRemoved"]>()
          .mockReturnValue({ outcome: "ok", value: { write: [], remove: [recordsFile] } }),
      },
      projectCommand: PROJECT_COMMAND,
    });

    const pruned = await commands.pruneDebt({ written: [recordsFile] });

    expect(pruned).toEqual({
      outcome: "ok",
      value: {
        changes: { write: [], remove: [recordsFile] },
        done: [{ place: debt.place, debt: debt.record, reason: "credited-nothing" }],
      },
    });
  });

  it("refuses to record debt over a stale projection, naming the project command", async () => {
    const commands = createSmoothingCommands({
      reach: () => ({
        stages: stagesHolding({
          records: [],
          run: {
            ...CURRENT_ESLINT_RUN,
            projection: "out-of-date",
            projectionFile: repoPathOf("hone.eslint.mjs"),
          },
        }),
        recordsSourceFor: vi.fn(),
      }),
      repoRoot: absoluteRootOf("/repo"),
      recordsReader: { recordsReadingOf: vi.fn() },
      recordsEditor: {
        documentsWithAdded: vi.fn<RecordsEditor["documentsWithAdded"]>(),
        placeOfAddition: vi.fn<RecordsEditor["placeOfAddition"]>(),
        documentsWithRepointed: vi.fn<RecordsEditor["documentsWithRepointed"]>(),
        documentsWithRemoved: vi.fn<RecordsEditor["documentsWithRemoved"]>(),
      },
      projectCommand: PROJECT_COMMAND,
    });

    const recorded = await commands.recordDebt({ written: [] });

    expect(recorded).toEqual({
      outcome: "failed",
      error: {
        kind: "run-failed",
        failure: {
          kind: "projection-stale",
          problem: {
            scope: "projection",
            engine: { name: "eslint" },
            state: "out-of-date",
            file: repoPathOf("hone.eslint.mjs"),
          },
          projectCommand: PROJECT_COMMAND,
        },
      },
    });
  });
});
