import { describe, expect, it } from "vitest";
import type { Finding, GovernedRun } from "../../../infrastructure/command-line/governance.ts";
import type { NativeException } from "../../runner/runner-result-types.ts";
import type { Check, Recipe, RecordKind, Symptom, SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { answerFindings, type RaisedFinding, type StaleReason, type StaleRecord } from "./answering.ts";
import type { AuthorisedLocation, Debt, PlacedRecord, SymptomReach } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { RunMeasurement } from "../measurement/measured-at.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { WhyChain } from "../../../infrastructure/hone-records-folder/why-chain.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const ADAPTER_PER_OUTSIDE_PARTY: Recipe = {
  name: "adapter-per-outside-party",
  title: "Adapter per outside party",
  standing: "accepted",
  reason: { text: "One adapter holds each outside party.", standing: "accepted" },
};

const symptomOf = (request: { readonly name: string; readonly recipes: readonly Recipe[] }): Symptom => ({
  name: request.name,
  title: request.name,
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: request.recipes,
  correctUses: [],
});

const AUTHORED_CLASS = symptomOf({ name: "authored-class-or-this", recipes: [] });

const LOOP_KEYWORD = symptomOf({ name: "loop-keyword", recipes: [] });

const OUTSIDE_IMPORT = symptomOf({ name: "outside-import-past-a-boundary", recipes: [ADAPTER_PER_OUTSIDE_PARTY] });

const NO_CLASS = clauseAddressSchema.parse("CD-14#no-class-syntax");

const NO_THIS = clauseAddressSchema.parse("CD-14#no-this");

const NO_FOR_OF = clauseAddressSchema.parse("CD-15#no-for-of");

const IMPORT_BOUNDARIES = clauseAddressSchema.parse("CD-19#import-boundaries");

const UNCATALOGUED = clauseAddressSchema.parse("CD-99#nowhere");

const checkOf = (request: { readonly name: string; readonly symptom: Symptom; readonly clause: Check["clause"] }): Check => ({
  ...request,
  engines: [{ name: "walker", mechanism: AUDIT }],
  forms: [],
});

const CLASS_SYNTAX = checkOf({ name: "class-syntax", symptom: AUTHORED_CLASS, clause: NO_CLASS });

const THIS_KEYWORD = checkOf({ name: "this-keyword", symptom: AUTHORED_CLASS, clause: NO_THIS });

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [ADAPTER_PER_OUTSIDE_PARTY],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [{ name: "walker", mechanism: AUDIT }],
  symptoms: [AUTHORED_CLASS, LOOP_KEYWORD, OUTSIDE_IMPORT],
  clauses: [
    { clause: NO_CLASS, sight: { kind: "one-symptom", symptom: AUTHORED_CLASS } },
    { clause: NO_THIS, sight: { kind: "one-symptom", symptom: AUTHORED_CLASS } },
    { clause: NO_FOR_OF, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    { clause: IMPORT_BOUNDARIES, sight: { kind: "one-symptom", symptom: OUTSIDE_IMPORT } },
  ],
  checks: [
    CLASS_SYNTAX,
    THIS_KEYWORD,
    checkOf({ name: "for-of", symptom: LOOP_KEYWORD, clause: NO_FOR_OF }),
    checkOf({ name: "import-or-require", symptom: OUTSIDE_IMPORT, clause: IMPORT_BOUNDARIES }),
  ],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const IDS_ADAPTER = repoPathSchema.parse("src/adapters/ids/make-id.ts");

const PACKAGE_JSON = repoPathSchema.parse("package.json");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/authored-class-or-this.json");

const AUTHORISED_FILE = repoPathSchema.parse("hone-records/authorised-locations/authored-class-or-this.json");

const BOUNDARIES_FILE = repoPathSchema.parse("hone-records/boundary-records.json");

const DEVIATIONS_FILE = repoPathSchema.parse("hone-records/deviations/adapter-per-outside-party.json");

const DEPENDENCIES_FILE = repoPathSchema.parse("hone-records/dependency-records.json");

const NO_CLASS_IN_A: Finding = { clause: NO_CLASS, file: FILE_A, anchor: { line: 3, column: 5 }, snippet: "class A {}", mechanism: AUDIT };

const NO_CLASS_IN_B: Finding = { clause: NO_CLASS, file: FILE_B, anchor: { line: 8, column: 1 }, snippet: "class B {}", mechanism: AUDIT };

const NO_THIS_IN_A: Finding = { clause: NO_THIS, file: FILE_A, anchor: { line: 4, column: 7 }, snippet: "this.total", mechanism: AUDIT };

const NO_CLASS_IN_A_BY_ESLINT: Finding = { ...NO_CLASS_IN_A, mechanism: ESLINT };

const FOR_OF_IN_A: Finding ={ clause: NO_FOR_OF, file: FILE_A, anchor: { line: 9, column: 2 }, snippet: "a loop over the orders", mechanism: AUDIT };

const UNCATALOGUED_IN_A: Finding = { clause: UNCATALOGUED, file: FILE_A, anchor: { line: 1, column: 0 }, snippet: "nowhere", mechanism: AUDIT };

const UUID_IMPORT_IN_IDS: Finding = {
  clause: IMPORT_BOUNDARIES,
  file: IDS_ADAPTER,
  anchor: { line: 1, column: 0 },
  snippet: "banned third-party import: uuid — use its recorded wrapping boundary",
  mechanism: AUDIT,
};

const LODASH_IMPORT_IN_A: Finding = {
  clause: IMPORT_BOUNDARIES,
  file: FILE_A,
  anchor: { line: 1, column: 0 },
  snippet: "banned third-party import: lodash — use its recorded wrapping boundary",
  mechanism: AUDIT,
};

const unreported = (finding: Finding): RaisedFinding => ({ finding, party: { reported: "not-reported" } });

const importing = (request: { readonly finding: Finding; readonly specifier: string }): RaisedFinding => ({
  finding: request.finding,
  party: { reported: "specifier", specifier: request.specifier },
});

const CLASS_DEBT_IN_A: Debt = { kind: "debt", symptom: AUTHORED_CLASS, reach: WHOLE_SYMPTOM, file: FILE_A, holding: { held: "stated" } };

const DEBT_ON_CLASS_IN_A: PlacedRecord = { place: { file: DEBT_FILE, index: 0 }, record: CLASS_DEBT_IN_A };

const DEBT_ON_CLASS_IN_B: PlacedRecord = { place: { file: DEBT_FILE, index: 1 }, record: { ...CLASS_DEBT_IN_A, file: FILE_B } };

const DEBT_ON_CLASS_SYNTAX_IN_A: PlacedRecord = { place: { file: DEBT_FILE, index: 2 }, record: { ...CLASS_DEBT_IN_A, reach: { reaches: "one-check", check: CLASS_SYNTAX } } };

const CLASS_LOCATION_IN_A: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: AUTHORED_CLASS,
  reach: WHOLE_SYMPTOM,
  file: FILE_A,
  holding: {
    held: "stated",
    owing: { matches: "not-the-catalogue", note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" } },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const LOCATED_CLASS_IN_A: PlacedRecord = { place: { file: AUTHORISED_FILE, index: 0 }, record: CLASS_LOCATION_IN_A };

const CARRIED_CLASS_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 1 },
  record: {
    ...CLASS_LOCATION_IN_A,
    holding: { held: "carried", entry: { reason: "The parser's class is wrapped here." }, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
  },
};

const ESTABLISHED_CLASS_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 2 },
  record: {
    ...CLASS_LOCATION_IN_A,
    holding: { held: "carried", entry: { reason: "The parser's class is wrapped here." }, lacks: ["case", "owes", "whyChain"], standing: "established" },
  },
};

const LOCATED_CLASS_SYNTAX_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 3 },
  record: { ...CLASS_LOCATION_IN_A, reach: { reaches: "one-check", check: CLASS_SYNTAX } },
};

const LOCATED_THIS_KEYWORD_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 4 },
  record: { ...CLASS_LOCATION_IN_A, reach: { reaches: "one-check", check: THIS_KEYWORD } },
};

const LOCATED_UNKNOWN_CHECK_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 5 },
  record: { ...CLASS_LOCATION_IN_A, reach: { reaches: "unknown-check", check: "class-keyword" } },
};

const DEBT_ON_IMPORTS_IN_IDS: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/outside-import-past-a-boundary.json"), index: 0 },
  record: { kind: "debt", symptom: OUTSIDE_IMPORT, reach: WHOLE_SYMPTOM, file: IDS_ADAPTER, holding: { held: "stated" } },
};

const LOCATED_UUID_IN_IDS: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/outside-import-past-a-boundary.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: OUTSIDE_IMPORT,
    reach: WHOLE_SYMPTOM,
    file: IDS_ADAPTER,
    holding: { held: "carried", entry: { reason: "uuid stays here." }, lacks: ["case", "owes", "whyChain"], standing: "established" },
  },
};

const IDS_BOUNDARY: PlacedRecord = {
  place: { file: BOUNDARIES_FILE, index: 0 },
  record: {
    kind: "boundary-record",
    module: repoPathSchema.parse("src/adapters/ids"),
    outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" },
    holding: { held: "stated", ports: ["IdSource"] },
  },
};

const ADAPTER_DEVIATION_IN_A: PlacedRecord = {
  place: { file: DEVIATIONS_FILE, index: 0 },
  record: {
    kind: "deviation",
    recipe: ADAPTER_PER_OUTSIDE_PARTY,
    file: FILE_A,
    reasonFails: "The import is used once, in a script.",
    evidence: "src/a.ts:1.",
    ruleHolds: "Nothing past the script sees it.",
  },
};

const ZOD_DEPENDENCY: PlacedRecord = {
  place: { file: DEPENDENCIES_FILE, index: 0 },
  record: { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "Each adapter would repeat its checks." },
};

const NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const FILE_A_TOUCHED: TouchedSet = { measured: "yes", paths: new Set([FILE_A]) };

const UNMEASURED: TouchedSet = { measured: "no", base: { state: "not-given" } };

const ELSEWHERE: TouchedSet = { measured: "elsewhere" };

const DISABLE_IN_A: NativeException = { kind: "inline-disable", clause: NO_CLASS, file: FILE_A, line: 4, text: "// eslint-disable-next-line", reach: "one-clause" };

const SCRIPT_RULE_OFF: NativeException = {
  kind: "command-line-option",
  clause: NO_CLASS,
  location: PACKAGE_JSON,
  script: "lint",
  option: "--rule no-class:off",
  cause: { kind: "weakens-run" },
};

const inlineRun = (request: { readonly nativeExceptions: readonly NativeException[] }): GovernedRun => ({
  mechanism: AUDIT,
  nativeExceptions: request.nativeExceptions,
  coverableKinds: ["inline-disable", "command-line-option"],
});

const staleFor = (request: { readonly placed: PlacedRecord; readonly reason: StaleReason }): StaleRecord => request;

const creditedNothing = (placed: PlacedRecord): StaleRecord => staleFor({ placed, reason: "credited-nothing" });

const NOTHING_ANSWERED = { findings: [], answered: [], stale: [], forfeited: [], paid: [], unrecorded: [] };

describe("answerFindings with no records", () => {
  it("keeps every finding and lists nothing else", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [], findings: [unreported(NO_CLASS_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [NO_CLASS_IN_A],
    });
  });
});

describe("answerFindings, answer", () => {
  it.each([{ placed: DEBT_ON_CLASS_IN_A }, { placed: LOCATED_CLASS_IN_A }, { placed: CARRIED_CLASS_IN_A }])(
    "answers a finding whose symptom and file the $placed.record.kind at $placed.place.file names, and leaves it out of findings",
    ({ placed }) => {
      expect(answerFindings({ catalogue: CATALOGUE, records: [placed], findings: [unreported(NO_CLASS_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
        ...NOTHING_ANSWERED,
        answered: [{ finding: NO_CLASS_IN_A, by: [placed] }],
      });
    },
  );

  it("answers by a deviation from a recipe of the finding's symptom at its file", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [ADAPTER_DEVIATION_IN_A],
        findings: [importing({ finding: { ...UUID_IMPORT_IN_IDS, file: FILE_A }, specifier: "uuid" })],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: { ...UUID_IMPORT_IN_IDS, file: FILE_A }, by: [ADAPTER_DEVIATION_IN_A] }] });
  });

  it("does not answer a finding raised by a banned import by a deviation, and lists the deviation as stale", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [ADAPTER_DEVIATION_IN_A],
        findings: [importing({ finding: LODASH_IMPORT_IN_A, specifier: "lodash/fp" })],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [LODASH_IMPORT_IN_A], stale: [creditedNothing(ADAPTER_DEVIATION_IN_A)] });
  });

  it("does not answer an import finding whose outside party is not reported by a deviation, since it may be a named ban", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [ADAPTER_DEVIATION_IN_A], findings: [unreported(LODASH_IMPORT_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [LODASH_IMPORT_IN_A], stale: [creditedNothing(ADAPTER_DEVIATION_IN_A)] });
  });

  it("answers by a boundary record over an import of its outside party in a file inside its module", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [IDS_BOUNDARY],
        findings: [importing({ finding: UUID_IMPORT_IN_IDS, specifier: "uuid/v4" })],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: UUID_IMPORT_IN_IDS, by: [IDS_BOUNDARY] }] });
  });

  it("does not answer by a boundary record an import of another outside party in its module, and lists it stale", () => {
    const lodashInIds: Finding = { ...UUID_IMPORT_IN_IDS, snippet: "banned third-party import: lodash — use its recorded wrapping boundary" };
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [IDS_BOUNDARY], findings: [importing({ finding: lodashInIds, specifier: "lodash" })], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [lodashInIds], stale: [creditedNothing(IDS_BOUNDARY)] });
  });

  it("credits every record that holds the finding, in the records' order", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [LOCATED_UUID_IN_IDS, IDS_BOUNDARY],
        findings: [importing({ finding: UUID_IMPORT_IN_IDS, specifier: "uuid" })],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: UUID_IMPORT_IN_IDS, by: [LOCATED_UUID_IN_IDS, IDS_BOUNDARY] }] });
  });

  it("does not answer a finding in a file the record does not name", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [unreported(NO_CLASS_IN_B)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [NO_CLASS_IN_B],
      stale: [creditedNothing(DEBT_ON_CLASS_IN_A)],
    });
  });

  it("does not answer a finding of a symptom the record does not name", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [unreported(FOR_OF_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [FOR_OF_IN_A],
      stale: [creditedNothing(DEBT_ON_CLASS_IN_A)],
    });
  });

  it("does not answer a finding whose check the catalogue names no symptom for", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [unreported(UNCATALOGUED_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [UNCATALOGUED_IN_A], stale: [creditedNothing(DEBT_ON_CLASS_IN_A)] });
  });
});

describe("answerFindings, forfeit", () => {
  it("forfeits debt whose file was touched, and it answers nothing", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [unreported(NO_CLASS_IN_A)], touched: FILE_A_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [NO_CLASS_IN_A],
      forfeited: [DEBT_ON_CLASS_IN_A],
    });
  });

  it("does not forfeit an authorised location whose file was touched", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [LOCATED_CLASS_IN_A], findings: [unreported(NO_CLASS_IN_A)], touched: FILE_A_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }],
    });
  });

  it.each([{ touched: UNMEASURED }, { touched: ELSEWHERE }])(
    "forfeits nothing when the touched set is measured $touched.measured, so the debt still answers",
    ({ touched }) => {
      expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [unreported(NO_CLASS_IN_A)], touched, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
        ...NOTHING_ANSWERED,
        answered: [{ finding: NO_CLASS_IN_A, by: [DEBT_ON_CLASS_IN_A] }],
      });
    },
  );
});

describe("answerFindings, a record naming one check", () => {
  it("answers by an authorised location naming one check only that check's findings, and the debt on the whole symptom answers the rest", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_SYNTAX_IN_A],
        findings: [unreported(NO_CLASS_IN_A), unreported(NO_THIS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [
        { finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_SYNTAX_IN_A] },
        { finding: NO_THIS_IN_A, by: [DEBT_ON_CLASS_IN_A] },
      ],
    });
  });

  it("does not answer by a record naming one check a finding of its symptom that no check of the catalogue raised", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [LOCATED_CLASS_SYNTAX_IN_A, DEBT_ON_CLASS_IN_A],
        findings: [unreported(NO_CLASS_IN_A_BY_ESLINT)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: NO_CLASS_IN_A_BY_ESLINT, by: [DEBT_ON_CLASS_IN_A] }], stale: [creditedNothing(LOCATED_CLASS_SYNTAX_IN_A)] });
  });

  it("answers by both an authorised location on the whole symptom and one on a check of it, at one file, and lists neither stale", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [LOCATED_CLASS_IN_A, LOCATED_CLASS_SYNTAX_IN_A],
        findings: [unreported(NO_CLASS_IN_A), unreported(NO_THIS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [
        { finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A, LOCATED_CLASS_SYNTAX_IN_A] },
        { finding: NO_THIS_IN_A, by: [LOCATED_CLASS_IN_A] },
      ],
    });
  });

  it("lists an inline disable of a check that an authorised location on another check of its symptom does not name", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [LOCATED_THIS_KEYWORD_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(LOCATED_THIS_KEYWORD_IN_A)], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });
});

describe("answerFindings, paid debt", () => {
  it("lists debt as paid where an authorised location also holds its symptom and file, with the authorised location answering in its place", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [LOCATED_CLASS_IN_A, DEBT_ON_CLASS_IN_A],
        findings: [unreported(NO_CLASS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }],
      paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [LOCATED_CLASS_IN_A] }],
    });
  });

  it("does not pay debt on a file where nothing is found, and lists it stale beside the authorised location", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      stale: [creditedNothing(DEBT_ON_CLASS_IN_A), creditedNothing(LOCATED_CLASS_IN_A)],
    });
  });

  it("does not pay debt whose file holds findings only of another symptom, and lists it stale", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A], findings: [unreported(FOR_OF_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [FOR_OF_IN_A], stale: [creditedNothing(DEBT_ON_CLASS_IN_A), creditedNothing(LOCATED_CLASS_IN_A)] });
  });

  it("does not pay debt by an authorised location naming a check its symptom does not have, which answers nothing", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_UNKNOWN_CHECK_IN_A],
        findings: [unreported(NO_CLASS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: NO_CLASS_IN_A, by: [DEBT_ON_CLASS_IN_A] }], stale: [creditedNothing(LOCATED_UNKNOWN_CHECK_IN_A)] });
  });

  it("names every record that answers in paid debt's place, in the records' order", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A, ESTABLISHED_CLASS_IN_A],
        findings: [unreported(NO_CLASS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A, ESTABLISHED_CLASS_IN_A] }],
      paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [LOCATED_CLASS_IN_A, ESTABLISHED_CLASS_IN_A] }],
    });
  });

  it("does not pay debt that a carried authorised location unjudged at the base also holds, and both answer", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [CARRIED_CLASS_IN_A, DEBT_ON_CLASS_IN_A],
        findings: [unreported(NO_CLASS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: NO_CLASS_IN_A, by: [CARRIED_CLASS_IN_A, DEBT_ON_CLASS_IN_A] }] });
  });

  it("pays debt that a carried authorised location established at the base also holds", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [ESTABLISHED_CLASS_IN_A, DEBT_ON_CLASS_IN_A],
        findings: [unreported(NO_CLASS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [ESTABLISHED_CLASS_IN_A] }],
      paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [ESTABLISHED_CLASS_IN_A] }],
    });
  });

  it("pays debt on one check that an authorised location on the whole symptom also holds", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_SYNTAX_IN_A, LOCATED_CLASS_IN_A], findings: [unreported(NO_CLASS_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }],
      paid: [{ debt: DEBT_ON_CLASS_SYNTAX_IN_A, answeredBy: [LOCATED_CLASS_IN_A] }],
    });
  });

  it("pays debt on the whole symptom when every finding it held was answered by an authorised location on one check, which holds only part of its reach", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_SYNTAX_IN_A], findings: [unreported(NO_CLASS_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_SYNTAX_IN_A] }],
      paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [LOCATED_CLASS_SYNTAX_IN_A] }],
    });
  });

  it("pays debt on imports when every import it held was of the outside party a boundary record holds", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_IMPORTS_IN_IDS, IDS_BOUNDARY],
        findings: [importing({ finding: UUID_IMPORT_IN_IDS, specifier: "uuid" })],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: UUID_IMPORT_IN_IDS, by: [IDS_BOUNDARY] }],
      paid: [{ debt: DEBT_ON_IMPORTS_IN_IDS, answeredBy: [IDS_BOUNDARY] }],
    });
  });

  it("names every record that answered in paid debt's place across the findings it held, in the records' order", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_THIS_KEYWORD_IN_A, LOCATED_CLASS_SYNTAX_IN_A],
        findings: [unreported(NO_CLASS_IN_A), unreported(NO_THIS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [
        { finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_SYNTAX_IN_A] },
        { finding: NO_THIS_IN_A, by: [LOCATED_THIS_KEYWORD_IN_A] },
      ],
      paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [LOCATED_THIS_KEYWORD_IN_A, LOCATED_CLASS_SYNTAX_IN_A] }],
    });
  });

  it("does not name a record that answered no finding the debt held among those that paid it", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_SYNTAX_IN_A, LOCATED_CLASS_IN_A],
        findings: [unreported(NO_THIS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_THIS_IN_A, by: [LOCATED_CLASS_IN_A] }],
      stale: [creditedNothing(LOCATED_CLASS_SYNTAX_IN_A)],
      paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [LOCATED_CLASS_IN_A] }],
    });
  });

  it("answers by the boundary record its own outside party's imports and by the debt every other import", () => {
    const lodashInIds: Finding = { ...UUID_IMPORT_IN_IDS, anchor: { line: 2, column: 0 }, snippet: "banned third-party import: lodash — use its recorded wrapping boundary" };
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_IMPORTS_IN_IDS, IDS_BOUNDARY],
        findings: [importing({ finding: UUID_IMPORT_IN_IDS, specifier: "uuid" }), importing({ finding: lodashInIds, specifier: "lodash" }), unreported(lodashInIds)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [
        { finding: UUID_IMPORT_IN_IDS, by: [IDS_BOUNDARY] },
        { finding: lodashInIds, by: [DEBT_ON_IMPORTS_IN_IDS] },
        { finding: lodashInIds, by: [DEBT_ON_IMPORTS_IN_IDS] },
      ],
    });
  });

  it("does not pay debt that was forfeited, and the authorised location answers", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A],
        findings: [unreported(NO_CLASS_IN_A)],
        touched: FILE_A_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }], forfeited: [DEBT_ON_CLASS_IN_A] });
  });
});

describe("answerFindings, stale", () => {
  it("lists a record in force that answers no finding", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [LOCATED_CLASS_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      stale: [creditedNothing(LOCATED_CLASS_IN_A)],
    });
  });

  it("does not list a forfeited record as stale", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [], touched: FILE_A_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      forfeited: [DEBT_ON_CLASS_IN_A],
    });
  });

  it("does not list a dependency record as stale, since no check asks for one yet", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [ZOD_DEPENDENCY], findings: [], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual(NOTHING_ANSWERED);
  });

  it("keeps stale records in the records' order", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_B, LOCATED_UUID_IN_IDS], findings: [], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      stale: [creditedNothing(DEBT_ON_CLASS_IN_B), creditedNothing(LOCATED_UUID_IN_IDS)],
    });
  });
});

describe("answerFindings, natives held", () => {
  it("does not list an inline disable that debt on its check's symptom at its file holds, and the debt is not stale", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual(NOTHING_ANSWERED);
  });

  it("does not list an inline disable that the record answering in paid debt's place holds, and that record is not stale", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, paid: [{ debt: DEBT_ON_CLASS_IN_A, answeredBy: [LOCATED_CLASS_IN_A] }] });
  });

  it("lists, attributed to its engine, an inline disable no record holds", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })], measurements: { runs: [], tracked: [], excluded: [] } })).toEqual({
      ...NOTHING_ANSWERED,
      unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }],
    });
  });

  it("lists an inline disable whose record names another file", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_B], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(DEBT_ON_CLASS_IN_B)], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("lists a native exception of a kind its run does not make coverable, and the record matching it is stale", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [{ mechanism: AUDIT, nativeExceptions: [DISABLE_IN_A], coverableKinds: [] }],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(DEBT_ON_CLASS_IN_A)], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("lists an inline disable that only forfeited debt matches, since forfeited debt no longer holds it", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [], touched: FILE_A_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, forfeited: [DEBT_ON_CLASS_IN_A], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("lists an inline disable on an import check in a boundary record's module, since a suppression does not report its outside party", () => {
    const disableInIds: NativeException = { kind: "inline-disable", clause: IMPORT_BOUNDARIES, file: IDS_ADAPTER, line: 1, text: "// eslint-disable-next-line", reach: "one-clause" };
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [IDS_BOUNDARY], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [disableInIds] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(IDS_BOUNDARY)], unrecorded: [{ ...disableInIds, mechanism: AUDIT }] });
  });

  it("lists an inline disable on an import check at a deviation's file, since the import it hides may be a named ban", () => {
    const disableInA: NativeException = { kind: "inline-disable", clause: IMPORT_BOUNDARIES, file: FILE_A, line: 1, text: "// eslint-disable-next-line", reach: "one-clause" };
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [ADAPTER_DEVIATION_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [disableInA] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(ADAPTER_DEVIATION_IN_A)], unrecorded: [{ ...disableInA, mechanism: AUDIT }] });
  });

  it("lists a command-line option even where its run makes the kind coverable, since no record names a file it sits in", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [SCRIPT_RULE_OFF] })], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, unrecorded: [{ ...SCRIPT_RULE_OFF, mechanism: AUDIT }] });
  });

  it("lists an inline disable from an engine that runs no check of its clause, though a record on that check's symptom names its file", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [{ mechanism: ESLINT, nativeExceptions: [DISABLE_IN_A], coverableKinds: ["inline-disable"] }],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(DEBT_ON_CLASS_IN_A)], unrecorded: [{ ...DISABLE_IN_A, mechanism: ESLINT }] });
  });

  it("keeps unrecorded native exceptions in the runs' order, then each run's own order", () => {
    const disableInB: NativeException = { ...DISABLE_IN_A, file: FILE_B };
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [
          { mechanism: ESLINT, nativeExceptions: [disableInB], coverableKinds: [] },
          inlineRun({ nativeExceptions: [DISABLE_IN_A, SCRIPT_RULE_OFF] }),
        ],
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      unrecorded: [
        { ...disableInB, mechanism: ESLINT },
        { ...DISABLE_IN_A, mechanism: AUDIT },
        { ...SCRIPT_RULE_OFF, mechanism: AUDIT },
      ],
    });
  });
});

const CLASS_HERITAGE = checkOf({ name: "class-heritage", symptom: AUTHORED_CLASS, clause: NO_CLASS });

const TWO_CHECKS_ON_NO_CLASS: SymptomCatalogue = { ...CATALOGUE, checks: [...CATALOGUE.checks, CLASS_HERITAGE] };

const LOCATED_CLASS_HERITAGE_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 6 },
  record: { ...CLASS_LOCATION_IN_A, reach: { reaches: "one-check", check: CLASS_HERITAGE } },
};

const HERITAGE_FINDING_IN_A: Finding = { ...NO_CLASS_IN_A, check: "authored-class-or-this#class-heritage" };

const MISNAMED_FINDING_IN_A: Finding = { ...NO_CLASS_IN_A, check: "authored-class-or-this#class-keyword" };

const HERITAGE_DISABLE_IN_A: NativeException = { ...DISABLE_IN_A, check: "authored-class-or-this#class-heritage" };

describe("answerFindings, a finding or exception that names its check", () => {
  it("answers a finding by the record naming that check and not by the record naming the other check of its clause", () => {
    expect(
      answerFindings({
        catalogue: TWO_CHECKS_ON_NO_CLASS,
        records: [LOCATED_CLASS_SYNTAX_IN_A, LOCATED_CLASS_HERITAGE_IN_A],
        findings: [unreported(HERITAGE_FINDING_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [], measurements: { runs: [], tracked: [], excluded: [] },
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: HERITAGE_FINDING_IN_A, by: [LOCATED_CLASS_HERITAGE_IN_A] }], stale: [creditedNothing(LOCATED_CLASS_SYNTAX_IN_A)] });
  });

  it("does not answer a finding naming a check its clause does not have, even by a record on the whole symptom", () => {
    expect(
      answerFindings({ catalogue: TWO_CHECKS_ON_NO_CLASS, records: [LOCATED_CLASS_IN_A], findings: [unreported(MISNAMED_FINDING_IN_A)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [MISNAMED_FINDING_IN_A], stale: [creditedNothing(LOCATED_CLASS_IN_A)] });
  });

  it("does not answer a finding naming a check that its mechanism's engine does not run, by a record naming that check", () => {
    const heritageByEslint = { ...HERITAGE_FINDING_IN_A, mechanism: ESLINT };
    expect(
      answerFindings({ catalogue: TWO_CHECKS_ON_NO_CLASS, records: [LOCATED_CLASS_HERITAGE_IN_A], findings: [unreported(heritageByEslint)], touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [heritageByEslint], stale: [creditedNothing(LOCATED_CLASS_HERITAGE_IN_A)] });
  });

  it("covers an inline disable naming a check by the record naming that check", () => {
    expect(
      answerFindings({
        catalogue: TWO_CHECKS_ON_NO_CLASS,
        records: [LOCATED_CLASS_HERITAGE_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [inlineRun({ nativeExceptions: [HERITAGE_DISABLE_IN_A] })],
      }),
    ).toEqual(NOTHING_ANSWERED);
  });

  it("lists an inline disable naming a check when only a record naming the other check of its clause exists", () => {
    expect(
      answerFindings({
        catalogue: TWO_CHECKS_ON_NO_CLASS,
        records: [LOCATED_CLASS_SYNTAX_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [inlineRun({ nativeExceptions: [HERITAGE_DISABLE_IN_A] })],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [creditedNothing(LOCATED_CLASS_SYNTAX_IN_A)], unrecorded: [{ ...HERITAGE_DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("covers an inline disable naming no check by a record naming either check of its clause", () => {
    expect(
      answerFindings({
        catalogue: TWO_CHECKS_ON_NO_CLASS,
        records: [LOCATED_CLASS_SYNTAX_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        measurements: { runs: [], tracked: [], excluded: [] },
        runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })],
      }),
    ).toEqual(NOTHING_ANSWERED);
  });
});

const CLASS_IN_TYPES = clauseAddressSchema.parse("CD-14#no-class-in-types");

const IMPORT_IN_TYPES = clauseAddressSchema.parse("CD-19#no-import-in-types");

const ESLINT_ENGINE = { name: "eslint", mechanism: ESLINT };

const MIXED_ENGINES: SymptomCatalogue = {
  ...CATALOGUE,
  engines: [...CATALOGUE.engines, ESLINT_ENGINE],
  checks: [
    ...CATALOGUE.checks,
    { name: "class-in-types", symptom: AUTHORED_CLASS, clause: CLASS_IN_TYPES, engines: [ESLINT_ENGINE], forms: [] },
    { name: "import-in-types", symptom: OUTSIDE_IMPORT, clause: IMPORT_IN_TYPES, engines: [ESLINT_ENGINE], forms: [] },
  ],
};

const TRACKED: readonly RepoPath[] = [FILE_A, FILE_B, IDS_ADAPTER];

const staleAmong = (request: {
  readonly record: PlacedRecord;
  readonly measurements: readonly RunMeasurement[];
  readonly tracked: readonly RepoPath[];
  readonly excluded: readonly RepoPath[];
}): readonly StaleRecord[] =>
  answerFindings({
    catalogue: MIXED_ENGINES,
    records: [request.record],
    findings: [],
    touched: NOTHING_TOUCHED,
    runs: [],
    measurements: { runs: request.measurements, tracked: request.tracked, excluded: request.excluded },
  }).stale;

const walkerMeasured = (request: { readonly file: RepoPath }): RunMeasurement => ({
  mechanism: AUDIT,
  selected: [NO_CLASS, NO_THIS, IMPORT_BOUNDARIES],
  measured: [
    { clause: NO_CLASS, file: request.file },
    { clause: NO_THIS, file: request.file },
    { clause: IMPORT_BOUNDARIES, file: request.file },
  ],
});

const ESLINT_SELECTED_MEASURING_NOTHING: RunMeasurement = { mechanism: ESLINT, selected: [CLASS_IN_TYPES, IMPORT_IN_TYPES], measured: [] };

describe("answerFindings, what the runs measured", () => {
  it("lists a record as stale once every check it reaches was measured at its file and credited nothing", () => {
    const eslintMeasured: RunMeasurement = {
      mechanism: ESLINT,
      selected: [CLASS_IN_TYPES],
      measured: [{ clause: CLASS_IN_TYPES, file: FILE_A }],
    };
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: DEBT_ON_CLASS_IN_A, measurements: [walkerMeasured({ file: FILE_A }), eslintMeasured] })).toEqual([creditedNothing(DEBT_ON_CLASS_IN_A)]);
  });

  it("does not list a record as stale when one check it reaches was measured and another, selected, was not", () => {
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: DEBT_ON_CLASS_IN_A, measurements: [walkerMeasured({ file: FILE_A }), ESLINT_SELECTED_MEASURING_NOTHING] })).toEqual([]);
  });

  it("lists a record that reaches only a measured check as stale while an engine of another check measured nothing", () => {
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: DEBT_ON_CLASS_SYNTAX_IN_A, measurements: [walkerMeasured({ file: FILE_A }), ESLINT_SELECTED_MEASURING_NOTHING] })).toEqual([creditedNothing(DEBT_ON_CLASS_SYNTAX_IN_A)]);
  });

  it("does not list a record as stale when the engine of a check it reaches measured only other files", () => {
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: DEBT_ON_CLASS_SYNTAX_IN_A, measurements: [walkerMeasured({ file: FILE_B })] })).toEqual([]);
  });

  it("lists a record as stale when no run selected a check it reaches", () => {
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: DEBT_ON_CLASS_IN_A, measurements: [] })).toEqual([creditedNothing(DEBT_ON_CLASS_IN_A)]);
  });

  it("lists a record as stale when its file is no longer in the tree, whatever the engines measured, since no run can measure a file that is gone", () => {
    expect(staleAmong({ tracked: [FILE_B], excluded: [], record: DEBT_ON_CLASS_IN_A, measurements: [walkerMeasured({ file: FILE_B }), ESLINT_SELECTED_MEASURING_NOTHING] })).toEqual([staleFor({ placed: DEBT_ON_CLASS_IN_A, reason: "file-gone" })]);
  });

  it("lists a record as stale when its file is excluded by the settings, which take it out of what is checked, though it is still in the repository", () => {
    expect(
      staleAmong({ tracked: [FILE_B], excluded: [FILE_A], record: DEBT_ON_CLASS_IN_A, measurements: [walkerMeasured({ file: FILE_B }), ESLINT_SELECTED_MEASURING_NOTHING] }),
    ).toEqual([staleFor({ placed: DEBT_ON_CLASS_IN_A, reason: "file-excluded" })]);
  });

  it("lists a record as stale when a folder the settings exclude holds its file", () => {
    expect(
      staleAmong({ tracked: [FILE_B], excluded: [repoPathSchema.parse("src")], record: DEBT_ON_CLASS_IN_A, measurements: [walkerMeasured({ file: FILE_B }), ESLINT_SELECTED_MEASURING_NOTHING] }),
    ).toEqual([staleFor({ placed: DEBT_ON_CLASS_IN_A, reason: "file-excluded" })]);
  });

  it("does not list a record as stale when its file is in the tree and a check it reaches was not measured there", () => {
    expect(staleAmong({ tracked: [FILE_A], excluded: [], record: DEBT_ON_CLASS_IN_A, measurements: [walkerMeasured({ file: FILE_A }), ESLINT_SELECTED_MEASURING_NOTHING] })).toEqual([]);
  });

  it("does not list a boundary record as stale when an engine of a check it reaches measured nothing in its module", () => {
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: IDS_BOUNDARY, measurements: [walkerMeasured({ file: FILE_A }), ESLINT_SELECTED_MEASURING_NOTHING] })).toEqual([]);
  });

  it("lists a boundary record as stale once its module's files were measured by every engine of a check it reaches", () => {
    const eslintMeasured: RunMeasurement = { mechanism: ESLINT, selected: [IMPORT_IN_TYPES], measured: [{ clause: IMPORT_IN_TYPES, file: IDS_ADAPTER }] };
    const walkerInModule: RunMeasurement = { mechanism: AUDIT, selected: [IMPORT_BOUNDARIES], measured: [{ clause: IMPORT_BOUNDARIES, file: IDS_ADAPTER }] };
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: IDS_BOUNDARY, measurements: [walkerInModule, eslintMeasured] })).toEqual([creditedNothing(IDS_BOUNDARY)]);
  });

  it("does not list a deviation on an imported-party symptom as stale when an engine of a check it reaches measured nothing", () => {
    expect(staleAmong({ tracked: TRACKED, excluded: [], record: ADAPTER_DEVIATION_IN_A, measurements: [walkerMeasured({ file: FILE_A }), ESLINT_SELECTED_MEASURING_NOTHING] })).toEqual([]);
  });
});
