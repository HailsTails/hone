import { describe, expect, it, vi } from "vitest";
import type { Check, Engine, RecordKind, Rule, Symptom, SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import type { Hit } from "../../infrastructure/engines/protocol/runner-module/runner-result-schema.ts";
import type { RecordsReading } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../../infrastructure/hone-config-file/conventions.ts";
import type { SettingsReading } from "./settings/read-settings.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { EngineRun } from "../../infrastructure/engines/protocol/engine-run/engine-run.ts";
import { type VersionTwoRequest, type VersionTwoStages, versionTwoRunOver } from "./version-two-run.ts";

const FILE_A = repoPathSchema.parse("src/a.ts");

const ESLINT = mechanismIdSchema.parse("eslint");

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: { name: "one-place-decides", title: "One place decides" },
  standing: "accepted",
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: {
        name: "gives-a-value-its-type",
        title: "Gives a value its type",
        standing: "accepted",
        owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
      },
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION }],
};

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [{ name: "one-place-decides", title: "One place decides" }],
  rules: [DECLARED_NOT_ASSERTED],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [ESLINT_ENGINE],
  symptoms: [CLAIMED_TYPE],
  clauses: [{ clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } }],
  checks: [CAST_CHECK],
  namedBans: [],
};

const SETTINGS: SettingsReading = {
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [repoPathSchema.parse("dist")],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const HIT: Hit = { clause: CAST_EXPRESSIONS, file: FILE_A, anchor: { line: 4, column: 9 }, snippet: "body as Event", check: "claimed-type#cast-expressions" };

const RUN: EngineRun = {
  mechanism: ESLINT,
  hits: [HIT],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
};

const CATALOGUE_UNREAD: RunLoadFailure = { kind: "catalogue-not-read", path: "/install/rules/typescript/symptoms.json", reason: { reason: "absent" } };

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [FILE_A], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [RUN] }),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

const NO_ARGUMENTS: VersionTwoRequest = { forfeiture: undefined, reportOutput: undefined, measuring: "when-debt-held" };

describe("versionTwoRunOver", () => {
  it("reports the findings the engines raised, with the catalogue and the output the settings name", async () => {
    const run = await versionTwoRunOver({ stages: stagesGiving({}), arguments: NO_ARGUMENTS });
    expect(run).toMatchObject({
      outcome: "ok",
      value: { catalogue: REPORT_CATALOGUE, output: "actionable", report: { excluded: ["dist"], findings: [{ ...HIT, mechanism: ESLINT }], symptoms: [CLAIMED_TYPE] } },
    });
  });

  it("takes the report output and the forfeiture assessment the command line gave over the settings", async () => {
    const touched = vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "elsewhere" });
    const run = await versionTwoRunOver({ stages: stagesGiving({ touched }), arguments: { forfeiture: "elsewhere", reportOutput: "counts", measuring: "when-debt-held" } });
    expect(run).toMatchObject({ outcome: "ok", value: { output: "counts" } });
    expect(touched.mock.calls).toEqual([[{ assessment: { forfeiture: "elsewhere" }, measuring: "when-debt-held", records: RECORDS }]]);
  });

  it("hands back the touched set it measured once, and the measuring it was asked for reaches the stage", async () => {
    const measured = { measured: "yes", paths: new Set([FILE_A]) } as const;
    const touched = vi.fn<VersionTwoStages["touched"]>().mockReturnValue(measured);
    const run = await versionTwoRunOver({ stages: stagesGiving({ touched }), arguments: { ...NO_ARGUMENTS, measuring: "always" } });
    expect(run).toMatchObject({ outcome: "ok", value: { touched: measured } });
    expect(touched.mock.calls).toEqual([[{ assessment: { forfeiture: "this-run" }, measuring: "always", records: RECORDS }]]);
  });

  it("asks the settings and the records with the catalogue, and the engines with everything read", async () => {
    const stages = stagesGiving({});
    await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS });
    expect({
      settings: vi.mocked(stages.settings).mock.calls,
      records: vi.mocked(stages.records).mock.calls,
      engines: vi.mocked(stages.engines).mock.calls,
    }).toEqual({
      settings: [[{ catalogue: REPORT_CATALOGUE }]],
      records: [[{ catalogue: REPORT_CATALOGUE }]],
      engines: [[{ catalogue: REPORT_CATALOGUE, settings: SETTINGS, records: RECORDS, tree: { tracked: [FILE_A], declaredConfigRoots: [] } }]],
    });
  });

  it("fails with the catalogue's failure and reads nothing more when the catalogue cannot be read", async () => {
    const stages = stagesGiving({ catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "failed", error: CATALOGUE_UNREAD }) });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({ outcome: "failed", error: CATALOGUE_UNREAD });
    expect(vi.mocked(stages.settings).mock.calls).toEqual([]);
  });

  it("fails with the settings' failure and runs no engine when the settings cannot be read", async () => {
    const stages = stagesGiving({ settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }) });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({ outcome: "failed", error: SETTINGS_ABSENT });
    expect(vi.mocked(stages.engines).mock.calls).toEqual([]);
  });

  it("fails with the records' failure when the records cannot be read", async () => {
    const refused: RunLoadFailure = { kind: "records-refused", refusals: [{ kind: "not-a-records-file", file: repoPathSchema.parse("hone-records/notes.txt") }] };
    const stages = stagesGiving({ records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "failed", error: refused }) });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({ outcome: "failed", error: refused });
  });

  it("fails with the tree's failure and runs no engine when a declared config root holds no tracked file", async () => {
    const untracked: RunLoadFailure = { kind: "config-root-untracked", root: repoPathSchema.parse("packages/web") };
    const stages = stagesGiving({ tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "failed", error: untracked }) });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({ outcome: "failed", error: untracked });
    expect(vi.mocked(stages.engines).mock.calls).toEqual([]);
  });

  it("fails with the engines' failure", async () => {
    const notReady: RunLoadFailure = { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } };
    const stages = stagesGiving({ engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "failed", error: notReady }) });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({ outcome: "failed", error: notReady });
  });
});
