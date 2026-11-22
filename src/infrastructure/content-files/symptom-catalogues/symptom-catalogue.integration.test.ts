import { createDefaultDirectoryPort } from "../../node/file-system/file-system-port.ts";
import { assert, describe, expect, it, vi } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { TEST_BODY_SECTIONS } from "../../engines/audit/CD-27/test-body-logic.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { readDisciplineFile } from "../rule-sets/rule-set-reader.ts";
import type { DisciplineFile } from "../../../domain/rule-set/rule-set-types.ts";
import { checkAddressOf, checkAt, checksOf } from "../../../domain/language-layer/check-address.ts";
import type {
  Case,
  Check,
  Engine,
  Indication,
  Pointed,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { type CatalogueGuide, symptomNoteLineOf } from "../../printed-report/symptoms/symptom-notes.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { clauseAddressText, TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { disciplineIdSchema } from "../../hone-config-file/identifiers.ts";
import type { Result } from "../../../domain/result.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";

type CatalogueCoverage = {
  readonly uncatalogued: readonly string[];
  readonly unknown: readonly string[];
  readonly unreadable: readonly LoadFailure[];
};

type CheckCoverage = {
  readonly unchecked: readonly string[];
  readonly unmechanical: readonly string[];
  readonly engineMismatches: readonly string[];
};

type CheckAddressRow = { readonly address: string; readonly clause: string };

type DisciplineSource = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
};

const disciplineFileIn = (request: DisciplineSource & { readonly folder: string }): Result<DisciplineFile, LoadFailure> => {
  const discipline = disciplineIdSchema.safeParse(request.folder);
  return discipline.success
    ? readDisciplineFile({ ...request, discipline: discipline.data })
    : { outcome: "failed", error: { kind: "unknown-discipline", address: request.folder } };
};

const definedClausesOf = (request: { readonly discipline: DisciplineFile }): readonly string[] =>
  request.discipline.clauses.map((clause) => `${request.discipline.id}#${clause.id}`);

type MechanicalClause = { readonly clause: string; readonly mechanisms: readonly string[] };

const mechanicalClausesOf = (request: { readonly discipline: DisciplineFile }): readonly MechanicalClause[] =>
  request.discipline.clauses.flatMap((clause) =>
    clause.kind === "mechanical" ? [{ clause: `${request.discipline.id}#${clause.id}`, mechanisms: clause.mechanisms } satisfies MechanicalClause] : [],
  );

const mechanismSetText = (request: { readonly mechanisms: readonly string[] }): string => [...request.mechanisms].sort().join(" ");

const engineFitOf = (request: { readonly check: Check; readonly mechanical: MechanicalClause }): "fits" | "differs" =>
  mechanismSetText({ mechanisms: request.check.engines.map((engine) => engine.mechanism) }) === mechanismSetText(request.mechanical)
    ? "fits"
    : "differs";

const checkCoverageOf = (
  request: DisciplineSource & { readonly catalogue: SymptomCatalogue; readonly disciplines: readonly string[] },
): CheckCoverage => {
  const mechanical = request.disciplines.flatMap((folder) => {
    const reading = disciplineFileIn({ ...request, folder });
    return reading.outcome === "ok" ? mechanicalClausesOf({ discipline: reading.value }) : [];
  });
  const { checks } = request.catalogue;
  const clauseOf = (check: Check): string => clauseAddressText({ address: check.clause });
  return {
    unchecked: mechanical.filter((entry) => !checks.some((check) => clauseOf(check) === entry.clause)).map((entry) => entry.clause),
    unmechanical: checks.filter((check) => !mechanical.some((entry) => entry.clause === clauseOf(check))).map((check) => checkAddressOf({ check })),
    engineMismatches: checks
      .filter((check) => mechanical.some((entry) => entry.clause === clauseOf(check) && engineFitOf({ check, mechanical: entry }) === "differs"))
      .map((check) => checkAddressOf({ check })),
  };
};

const checkAddressTableOf = (request: { readonly catalogue: SymptomCatalogue }): readonly CheckAddressRow[] =>
  request.catalogue.checks.map((check) => ({ address: checkAddressOf({ check }), clause: clauseAddressText({ address: check.clause }) }));

const resolutionOf = (request: { readonly catalogue: SymptomCatalogue; readonly check: Check }): "resolves" | "elsewhere" => {
  const atAddress = checkAt({ catalogue: request.catalogue, address: checkAddressOf({ check: request.check }) });
  return atAddress.found === "check" && atAddress.check === request.check ? "resolves" : "elsewhere";
};

const unresolvedAddressesOf = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] => {
  const { catalogue } = request;
  const fromChecks = catalogue.checks.filter((check) => resolutionOf({ catalogue, check }) === "elsewhere");
  const fromClauses = catalogue.clauses.flatMap(({ clause }) =>
    checksOf({ catalogue, clause }).filter((check) => resolutionOf({ catalogue, check }) === "elsewhere"),
  );
  return [...new Set([...fromChecks, ...fromClauses].map((check) => checkAddressOf({ check })))];
};

const catalogueCoverageOf = (
  request: DisciplineSource & { readonly catalogue: SymptomCatalogue; readonly disciplines: readonly string[] },
): CatalogueCoverage => {
  const readings = request.disciplines.map((folder) => disciplineFileIn({ ...request, folder }));
  const defined = readings.flatMap((reading) => (reading.outcome === "ok" ? definedClausesOf({ discipline: reading.value }) : []));
  const catalogued = request.catalogue.clauses.map(({ clause }) => clauseAddressText({ address: clause }));
  return {
    uncatalogued: defined.filter((address) => !catalogued.includes(address)),
    unknown: catalogued.filter((address) => !defined.includes(address)),
    unreadable: readings.flatMap((reading) => (reading.outcome === "failed" ? [reading.error] : [])),
  };
};

const formSectionsOf = (request: { readonly catalogue: SymptomCatalogue; readonly clause: string }): readonly string[] =>
  request.catalogue.clauses
    .filter(({ clause }) => clauseAddressText({ address: clause }) === request.clause)
    .flatMap(({ sight }) => (sight.kind === "symptom-by-form" ? sight.forms.map((form) => form.section) : []));

const correctUseNotesOf = (request: { readonly guide: CatalogueGuide }): readonly string[] =>
  request.guide.catalogue.symptoms
    .filter((symptom) => symptom.correctUses.length > 0)
    .map((symptom) => symptomNoteLineOf({ ...request.guide, symptom }));

const folderOf = (request: { readonly key: string }): string => request.key.split("/").at(-2) ?? "";

const foldersUnder = (request: { readonly table: Readonly<Record<string, string>>; readonly prefix: string }): readonly string[] =>
  [
    ...new Set(
      Object.keys(request.table)
        .filter((key) => key.startsWith(request.prefix))
        .map((key) => folderOf({ key })),
    ),
  ].sort();

const proposedReasonsOf = (request: { readonly recipes: readonly Recipe[] }): readonly string[] =>
  request.recipes.filter((recipe) => recipe.reason.standing === "proposed").map((recipe) => recipe.name);


type UnowedPointer = { readonly symptom: string; readonly case: string; readonly pointer: string };

const pointedName = (request: { readonly point: Pointed }): string =>
  request.point.kind === "principle" ? request.point.principle.title : request.point.rule.title;

type IndicatingSymptom = Pick<Symptom, "name" | "mayIndicate">;

const unowedOf = (request: { readonly symptom: IndicatingSymptom; readonly indication: Indication }): readonly UnowedPointer[] => {
  const owed = request.indication.case.owes.map((point) => pointedName({ point }));
  return request.indication.points
    .map((point) => pointedName({ point }))
    .filter((pointer) => !owed.includes(pointer))
    .map((pointer) => ({ symptom: request.symptom.name, case: request.indication.case.name, pointer }));
};

const unowedPointersOf = (request: { readonly catalogue: { readonly symptoms: readonly IndicatingSymptom[] } }): readonly UnowedPointer[] =>
  request.catalogue.symptoms.flatMap((symptom) => symptom.mayIndicate.flatMap((indication) => unowedOf({ symptom, indication })));

const PARENTHETICAL = /\s*\([^)]*\)/g;

const caseNameOfTitle = (request: { readonly title: string }): string =>
  request.title
    .replace(PARENTHETICAL, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const caseNamesOffTheirTitles = (request: { readonly cases: readonly Pick<Case, "name" | "title">[] }): readonly string[] =>
  request.cases.filter((entry) => entry.name !== caseNameOfTitle({ title: entry.title })).map((entry) => entry.name);

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const REPO_ROOT = absolutePathSchema.parse(createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/../../..`, ".."] }));

const disciplineTexts = import.meta.glob(["./rules/*/discipline.json"], { base: "../../../../", query: "?raw", import: "default", eager: true });

const DISCIPLINES = foldersUnder({ table: disciplineTexts, prefix: "./rules/" });

const FILE_TEXT = createDefaultFileTextPort({});

const PATH = createDefaultPathPort({});

const NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE = [
  "ambient-randomness: Ambient randomness. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers. The breach usually sits in the unit that should be passed the value, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the adapter for random values or new ids (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#ambient-randomness",
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#claimed-type",
  "date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#date-used-directly",
  "dependency-without-a-record: Dependency without a record. May indicate: takes an outside dependency → Outside dependencies justified. The breach usually sits in the missing record. Recipe: Dependency record. Correct use: a dependency record naming the native way weighed and why it fell short (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#dependency-without-a-record",
  "double-with-a-body: Double with a body. May indicate: uses what a collaborator gives back → Written-out answers; does one job: the port the stub stands in for → Handed what it uses; does one job: the collaborator the stub stands in for → Doer or orchestrator. The breach usually sits in a port too wide, or in a collaborator holding two decisions. Recipe: Stub with vi.fn. A fake, where a stub cannot do the test: a deviation from Stub with vi.fn (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#double-with-a-body",
  "edit-inside-vendored-code: Edit inside vendored code. May indicate: takes an outside dependency → Upstream stays untouched. The breach usually sits in the change. Recipe: Extension outside the vendored code. Drift, an edit impossible to apply as an extension: an authorised location stating when to drop it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#edit-inside-vendored-code",
  "library-class-built-in-place: Library class built in place. May indicate: takes an outside dependency → Outside dependencies stay at boundaries; keeps state or settings across calls → No hidden effects. The breach usually sits at a missing adapter. Recipes: Adapter per outside party; Closure factory. Correct use: a boundary record on that dependency's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#library-class-built-in-place",
  "loop-keyword: Loop keyword. May indicate: makes a new value from what it has → No hidden effects; causes an effect (writes, logs, sends, exits) → Ports declared inside; coordinates other units → Doer or orchestrator. The breach usually sits in the unit. Recipe: Functional iteration. Draining a stream: an authorised location in its source's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#loop-keyword",
  "name-off-its-casing: Name off its casing. May indicate: names something → One word everywhere. The breach usually sits in the name. An outside contract's names, such as `PATH` or ESLint listener keys: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#name-off-its-casing",
  "outside-import-past-a-boundary: Outside import past a boundary. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, Ports declared inside; takes an outside dependency → Outside dependencies stay at boundaries. The breach usually sits at a missing adapter and port. Recipes: Adapter per outside party; Port in the domain. Correct use: a boundary record on the adapter for that outside party (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-import-past-a-boundary",
  "outside-type-in-a-signature: Outside type in a signature. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, No leak across a boundary. The breach usually sits in the adapter that hands the outside type inward. Recipe: Adapter per outside party. Correct use: a boundary record on the adapter, or beyond it with a Conformist statement for an outside model adopted as ours (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-type-in-a-signature",
  "process-global-used-in-place: Process global used in place. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; causes an effect (writes, logs, sends, exits) → Ports declared inside; builds the real implementations → Ports declared inside. The breach usually sits at a missing port, or at an adapter not built at the entry point. Recipes: World values through a port; Adapter per outside party; Composition root. Correct use: a boundary record on the adapter that wraps the process (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#process-global-used-in-place",
  "schema-past-its-adapter: Schema past its adapter. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the adapter, which hands the wire type inward instead of mapping it. Recipe: Zod at the producer's adapter. An outside model adopted as ours: a boundary record with a Conformist statement (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#schema-past-its-adapter",
  "shorthand-name: Shorthand name. May indicate: names something → One word everywhere. The breach usually sits in the name. Recipe: Whole words. A name an outside contract fixes: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#shorthand-name",
  "text-past-its-reader: Text past its reader. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; sends data out of the program → No leak across a boundary; uses a system or service outside the program → External behaviour sits at a boundary; states what the unit gives back, for one case or several → Straight-through tests. The breach usually sits in a port that takes or gives text where it should carry objects. Recipes: Adapter per outside party; Map out at the adapter; Zod at the producer's adapter; Whole written-out expectation. Correct use: a boundary record on the adapter for whoever produced or receives the text (today: authorised-location). A use at one test site: an authorised location for this symptom alone (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#text-past-its-reader",
  "throw-between-our-units: Throw between our units. May indicate: an operation can fail → Failures are values; sends data out of the program → No leak across a boundary. The breach usually sits in the unit, or at a missing mapping in the adapter. Recipes: Result union; Failure mapping at the adapter. Correct use: an authorised location at an adapter whose caller's contract is exceptions (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#throw-between-our-units",
  "type-derived-from-code: Type derived from code. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; names something → One word everywhere. The breach usually sits in the producer, which has no named type. Recipe: Named, exported type. Correct use: an authorised location in the adapter for an outside dependency that gives no named type (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#type-derived-from-code",
];

const RECIPES_WITH_A_PROPOSED_REASON = [
  "bounded-context-generic",
  "composition-root",
  "failure-asserted-as-a-value",
  "failure-mapping-at-the-adapter",
  "integration-test-owns-its-scratch",
  "named-exported-type",
  "shared-strict-base-config",
];

const OUTSIDE_ADDRESSES = [
  { address: "authored-class-or-this#class-keyword", clause: "CD-14#class-syntax" },
  { address: "authored-class-or-this#static-members-only", clause: "CD-14#static-only-class" },
  { address: "boolean-in-a-signature#boolean-annotation", clause: "CD-43#boolean-signatures" },
  { address: "branch-in-a-test#test-body", clause: "CD-27#test-body-logic" },
  { address: "claimed-type#cast-to-any", clause: "CD-1#any-cast" },
  { address: "claimed-type#non-null-assertions", clause: "CD-2#non-null-assertions" },
  { address: "claimed-type#unlisted-cast-site", clause: "CD-2#cast-expressions" },
  { address: "computed-value-in-a-test#test-body", clause: "CD-27#test-body-logic" },
  { address: "date-used-directly#clock-sources", clause: "CD-17#clock-sources" },
  { address: "default-on-a-closed-union#default-arm", clause: "CD-8#switch-defaults" },
  { address: "double-with-a-body#logic-in-a-passed-function", clause: "CD-27#test-body-logic" },
  { address: "double-with-a-body#stub-implementation", clause: "CD-25#dependency-isolation" },
  { address: "drawer-path#drawer-names", clause: "CD-7#categorical-paths" },
  { address: "inherited-environment-in-a-subprocess#git-spawn-environment", clause: "CD-47#hermetic-git-spawns" },
  { address: "long-function#function-length", clause: "CD-41#function-length" },
  { address: "loop-keyword#loop-statement", clause: "CD-15#loops" },
  { address: "module-or-global-patched#module-mock-call", clause: "CD-26#module-mocking" },
  { address: "name-off-its-casing#filename-case", clause: "CD-7#filename-case" },
  { address: "name-off-its-casing#naming-convention", clause: "CD-6#naming-convention" },
  { address: "outside-import-past-a-boundary#import-or-require", clause: "CD-19#import-boundaries" },
  { address: "positional-parameters#parameter-count", clause: "CD-40#parameter-count" },
  { address: "rebinding#parameter-reassignment", clause: "CD-44#parameter-reassignment" },
  { address: "rebinding#test-body", clause: "CD-27#test-body-logic" },
  { address: "shorthand-name#identifier-names", clause: "CD-6#identifier-names" },
  { address: "strictness-weakened#exact-optional-property-types", clause: "CD-3#exact-optional-property-types" },
  { address: "strictness-weakened#no-fallthrough-cases-in-switch", clause: "CD-3#no-fallthrough-cases-in-switch" },
  { address: "strictness-weakened#no-implicit-override", clause: "CD-3#no-implicit-override" },
  { address: "strictness-weakened#no-property-access-from-index-signature", clause: "CD-3#no-property-access-from-index-signature" },
  { address: "strictness-weakened#no-unchecked-indexed-access", clause: "CD-3#no-unchecked-indexed-access" },
  { address: "strictness-weakened#strict", clause: "CD-3#strict" },
  { address: "strictness-weakened#use-unknown-in-catch-variables", clause: "CD-3#use-unknown-in-catch-variables" },
  { address: "tangled-function#cognitive-complexity", clause: "CD-41#cognitive-complexity" },
  { address: "test-switched-off#focused-tests", clause: "CD-27#focused-tests" },
  { address: "test-switched-off#skipped-tests", clause: "CD-27#skipped-tests" },
  { address: "text-past-its-reader#test-body", clause: "CD-27#test-body-logic" },
  { address: "throw-or-catch-in-a-test#throw-statement", clause: "CD-10#throws-in-tests" },
  { address: "throw-or-catch-in-a-test#try-block", clause: "CD-27#test-body-logic" },
  { address: "thrown-non-error#throw-only-error", clause: "CD-10#throw-only-error" },
  { address: "type-derived-from-code#factory-return-types", clause: "CD-7a#factory-return-types" },
  { address: "unit-without-a-running-test#companion-test-file", clause: "CD-23#export-test-sibling" },
  { address: "untracked-escape#directive-pointers", clause: "CD-5#comments-directives" },
  { address: "untyped-value#explicit-any", clause: "CD-1#explicit-any" },
  { address: "untyped-value#implicit-any-let", clause: "CD-1#implicit-any-let" },
  { address: "work-inside-a-condition#else-after-an-exit", clause: "CD-42#useless-else" },
  { address: "write-into-a-parameter#parameter-mutation", clause: "CD-44#parameter-mutation" },
];

describe("the catalogue guards over written-out pages and catalogues, so each can fail", () => {
  const INSTALL_ROOT = absoluteRootOf("/install");

  const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

  const AUTHORISED_LOCATION: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

  const NOTHING_CATALOGUED: SymptomCatalogue = {
    principles: [],
    rules: [],
    cases: [],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [],
    clauses: [],
    checks: [],
    namedBans: [],
  };

  const WRITE_INTO_A_PARAMETER: Symptom = {
    name: "write-into-a-parameter",
    title: "write-into-a-parameter",
    seen: "write-into-a-parameter",
    mayIndicate: [],
    breachUsuallySits: "in the unit",
    recipes: [],
    correctUses: [],
  };

  const REBINDING: Symptom = { name: "rebinding", title: "rebinding", seen: "rebinding", mayIndicate: [], breachUsuallySits: "in the unit", recipes: [], correctUses: [] };

  const WALKER: Engine = { name: "walker", mechanism: "audit" };

  const ESLINT: Engine = { name: "eslint", mechanism: "eslint" };

  const MUTATION_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-mutation") };

  const REASSIGNMENT_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-reassignment") };

  const INTENT_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-intent") };

  const PARAMETER_CLAUSES: SymptomCatalogue["clauses"] = [
    { clause: MUTATION_CLAUSE, sight: { kind: "one-symptom", symptom: WRITE_INTO_A_PARAMETER } },
    { clause: REASSIGNMENT_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
    { clause: INTENT_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ];

  const MUTATION_CHECK: Check = { name: "parameter-mutation", symptom: WRITE_INTO_A_PARAMETER, clause: MUTATION_CLAUSE, engines: [WALKER], forms: [] };

  const CD44_JUDGEMENT_FILE: FileTextPort = {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value:
        '{\n  "version": 1,\n  "id": "CD-44",\n  "clauses": [\n    { "kind": "judgement", "id": "parameter-mutation", "summary": "Write into no parameter.", "enforcedBy": "review" },\n    { "kind": "judgement", "id": "parameter-reassignment", "summary": "Rebind no parameter.", "enforcedBy": "review" }\n  ]\n}',
    }),
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
    write: vi.fn<FileTextPort["write"]>(),
  };

  const CD44_MECHANICAL_FILE: FileTextPort = {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value:
        '{\n  "version": 1,\n  "id": "CD-44",\n  "clauses": [\n    {\n      "kind": "mechanical",\n      "id": "parameter-mutation",\n      "summary": "Write into no parameter.",\n      "mechanisms": ["audit"],\n      "anchor": { "kind": "file" },\n      "cases": { "flag": [{ "name": "push", "fileName": "push.ts", "source": "export const append = (list: number[]): void => {\\n  list.push(1);\\n};\\n", "expectedLines": [2] }], "allow": [{ "name": "copy", "fileName": "copy.ts", "source": "export const append = (list: readonly number[]): readonly number[] => [...list, 1];\\n", "expectedLines": [] }] }\n    },\n    {\n      "kind": "mechanical",\n      "id": "parameter-reassignment",\n      "summary": "Rebind no parameter.",\n      "mechanisms": ["eslint"],\n      "anchor": { "kind": "keyword", "keyword": "=" },\n      "cases": { "flag": [{ "name": "assign", "fileName": "bump.ts", "source": "export const bump = (count: number): number => {\\n  count = 2;\\n  return count;\\n};\\n", "expectedLines": [2] }], "allow": [{ "name": "new value", "fileName": "next.ts", "source": "export const next = (count: number): number => count + 1;\\n", "expectedLines": [] }] }\n    },\n    { "kind": "judgement", "id": "parameter-intent", "summary": "Say what a parameter is for.", "enforcedBy": "review" }\n  ]\n}',
    }),
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
    write: vi.fn<FileTextPort["write"]>(),
  };

  const ONE_PLACE: Principle = { name: "one-place-decides", title: "One place decides" };

  const DOER: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE, standing: "accepted" };

  it("names each clause a discipline defines that the catalogue lacks, and each catalogued clause no discipline defines", () => {
    expect(
      catalogueCoverageOf({
        catalogue: {
          ...NOTHING_CATALOGUED,
          clauses: [
            { clause: MUTATION_CLAUSE, sight: { kind: "one-symptom", symptom: WRITE_INTO_A_PARAMETER } },
            { clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") }, sight: { kind: "one-symptom", symptom: REBINDING } },
          ],
        },
        fileText: CD44_JUDGEMENT_FILE,
        path: PATH,
        ruleSetRoot: INSTALL_ROOT,
        disciplines: ["CD-44"],
      }),
    ).toEqual({ uncatalogued: ["CD-44#parameter-reassignment"], unknown: ["CD-27#test-body-logic"], unreadable: [] });
  });

  it("names a mechanical clause with no check, a check on a judgement clause, and a check run by engines other than its clause's mechanisms", () => {
    expect(
      checkCoverageOf({
        catalogue: {
          ...NOTHING_CATALOGUED,
          engines: [WALKER, ESLINT],
          symptoms: [WRITE_INTO_A_PARAMETER, REBINDING],
          clauses: PARAMETER_CLAUSES,
          checks: [
            { ...MUTATION_CHECK, engines: [WALKER, ESLINT] },
            { name: "parameter-intent", symptom: REBINDING, clause: INTENT_CLAUSE, engines: [WALKER], forms: [] },
          ],
        },
        fileText: CD44_MECHANICAL_FILE,
        path: PATH,
        ruleSetRoot: INSTALL_ROOT,
        disciplines: ["CD-44"],
      }),
    ).toEqual({
      unchecked: ["CD-44#parameter-reassignment"],
      unmechanical: ["rebinding#parameter-intent"],
      engineMismatches: ["write-into-a-parameter#parameter-mutation"],
    });
  });

  it("names an address that resolves to an earlier check holding the same address", () => {
    expect(
      unresolvedAddressesOf({
        catalogue: { ...NOTHING_CATALOGUED, clauses: PARAMETER_CLAUSES, checks: [MUTATION_CHECK, { ...MUTATION_CHECK, clause: REASSIGNMENT_CLAUSE }] },
      }),
    ).toEqual(["write-into-a-parameter#parameter-mutation"]);
  });

  it("names a case name cut shorter than its title, and one that keeps its title's parenthetical", () => {
    expect(
      caseNamesOffTheirTitles({
        cases: [
          { name: "causes", title: "Causes an effect (writes, logs, sends, exits)" },
          { name: "gives-a-value-its-type-declares-it", title: "Gives a value its type (declares it, or needs it narrower)" },
        ],
      }),
    ).toEqual(["causes", "gives-a-value-its-type-declares-it"]);
  });

  it("names a pointer of an indication whose case does not owe it", () => {
    expect(
      unowedPointersOf({
        catalogue: {
          symptoms: [
            {
              name: "wide-port",
              mayIndicate: [
                {
                  case: { name: "builds-the-real-implementations", title: "Builds the real implementations", standing: "accepted", owes: [{ kind: "principle", principle: ONE_PLACE }] },
                  points: [
                    { kind: "principle", principle: ONE_PLACE },
                    { kind: "rule", rule: DOER },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([{ symptom: "wide-port", case: "builds-the-real-implementations", pointer: "Doer or orchestrator" }]);
  });
});

const reading = createSymptomCatalogueRepository({ directory: createDefaultDirectoryPort({}), fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT }).read({});

describe("rules/typescript/symptoms.json, read from this repository through the catalogue's reader", () => {
  it("reads into the typed catalogue", () => {
    expect(reading).toMatchObject({ outcome: "ok", value: { held: "catalogue" } });
  });

  it("lists each clause of every rules/*/discipline.json exactly once, and no other clause", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(DISCIPLINES).toHaveLength(40);
    expect(
      catalogueCoverageOf({ catalogue: reading.value.catalogue, fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT, disciplines: DISCIPLINES }),
    ).toEqual({
      uncatalogued: [],
      unknown: [],
      unreadable: [],
    });
    expect(reading.value.catalogue.clauses).toHaveLength(60);
  });

  it("reads CD-27#test-body-logic by form, one symptom for each section its findings name, in the walker's order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(formSectionsOf({ catalogue: reading.value.catalogue, clause: "CD-27#test-body-logic" })).toEqual(TEST_BODY_SECTIONS);
  });

  it("gives each mechanical clause of every rules/*/discipline.json its checks, run by the engines of its mechanisms, and no check to a judgement clause", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(
      checkCoverageOf({ catalogue: reading.value.catalogue, fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT, disciplines: DISCIPLINES }),
    ).toEqual({ unchecked: [], unmechanical: [], engineMismatches: [] });
  });

  it("holds one outside address for each check, beside the clause it answers today", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(checkAddressTableOf({ catalogue: reading.value.catalogue })).toEqual(OUTSIDE_ADDRESSES);
  });

  it("resolves every outside address to its one check, and every clause to the addresses of its checks", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(unresolvedAddressesOf({ catalogue: reading.value.catalogue })).toEqual([]);
  });

  it("names every case by one rule: its title without its parenthetical, hyphenated", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(caseNamesOffTheirTitles({ cases: reading.value.catalogue.cases })).toEqual([]);
  });

  it("points every indication only at what its case owes", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(unowedPointersOf({ catalogue: reading.value.catalogue })).toEqual([]);
  });

  it("holds the recipes whose reason is proposed, in catalogue order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(proposedReasonsOf({ recipes: reading.value.catalogue.recipes })).toEqual(RECIPES_WITH_A_PROPOSED_REASON);
  });

  it("renders each symptom that has a correct use as a note that reads as sentences, in catalogue order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(correctUseNotesOf({ guide: { guide: "catalogue", catalogue: reading.value.catalogue, page: "rules/typescript/symptoms.md" } })).toEqual(
      NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE,
    );
  });
});
