import { createDefaultDirectoryPort } from "../../node/file-system/file-system-port.ts";
import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { readBoundCatalogue } from "./bound-catalogue.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { TEST_BODY_SECTIONS } from "../../engines/audit/CD-27/test-body-logic.ts";
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
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";

type CheckAddressRow = { readonly address: string; readonly clause: string };

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

const formSectionsOf = (request: { readonly catalogue: SymptomCatalogue; readonly clause: string }): readonly string[] =>
  request.catalogue.clauses
    .filter(({ clause }) => clauseAddressText({ address: clause }) === request.clause)
    .flatMap(({ sight }) => (sight.kind === "symptom-by-form" ? sight.forms.map((form) => form.section) : []));

const correctUseNotesOf = (request: { readonly guide: CatalogueGuide }): readonly string[] =>
  request.guide.catalogue.symptoms
    .filter((symptom) => symptom.correctUses.length > 0)
    .map((symptom) => symptomNoteLineOf({ ...request.guide, symptom }));

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

const FILE_TEXT = createDefaultFileTextPort({});

const PATH = createDefaultPathPort({});

const NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE = [
  "ambient-randomness: Ambient randomness. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers. The breach usually sits in the unit that should be passed the value, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the adapter for random values or new ids (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#ambient-randomness",
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. A class an outside library requires, such as an adapter extending its base class: an authorised location in that adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#authored-class-or-this",
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#claimed-type",
  "date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#date-used-directly",
  "dependency-without-a-record: Dependency without a record. May indicate: takes an outside dependency → Outside dependencies justified. The breach usually sits in the missing record. Recipe: Dependency record. Correct use: a dependency record naming the native way weighed and why it fell short (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#dependency-without-a-record",
  "double-with-a-body: Double with a body. May indicate: uses what a collaborator gives back → Written-out answers; does one job: the port the stub stands in for → Handed what it uses; does one job: the collaborator the stub stands in for → Doer or orchestrator. The breach usually sits in a port too wide, or in a collaborator holding two decisions. Recipe: Stub with vi.fn. A fake, where a stub cannot do the test: a deviation from Stub with vi.fn (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#double-with-a-body",
  "edit-inside-vendored-code: Edit inside vendored code. May indicate: takes an outside dependency → Upstream stays untouched. The breach usually sits in the change. Recipe: Extension outside the vendored code. Drift, an edit impossible to apply as an extension: an authorised location stating when to drop it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#edit-inside-vendored-code",
  "library-class-built-in-place: Library class built in place. May indicate: takes an outside dependency → Outside dependencies stay at boundaries; keeps state or settings across calls → No hidden effects. The breach usually sits at a missing adapter. Recipes: Adapter per outside party; Closure factory. Correct use: a boundary record on that dependency's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#library-class-built-in-place",
  "long-function: Long function. May indicate: coordinates other units → Doer or orchestrator; does one job → Doer or orchestrator; gives a value its type (declares it, or needs it narrower) → Handed what it uses; checks conditions before its work → Guard first; puts code in a file or folder → One reason per module; names something → One word everywhere. The breach usually sits in the unit: several jobs, an input wider than its use, nested questions, or a responsibility not isolated and named. Recipes: Composed orchestrator; Guard clauses; One argument object. A function whose shape an outside contract fixes: an authorised location in the file that holds it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#long-function",
  "loop-keyword: Loop keyword. May indicate: makes a new value from what it has → No hidden effects; causes an effect (writes, logs, sends, exits) → Ports declared inside; coordinates other units → Doer or orchestrator. The breach usually sits in the unit. Recipe: Functional iteration. Draining a stream: an authorised location in its source's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#loop-keyword",
  "name-off-its-casing: Name off its casing. May indicate: names something → One word everywhere. The breach usually sits in the name. An outside contract's names, such as `PATH` or ESLint listener keys: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#name-off-its-casing",
  "outside-import-past-a-boundary: Outside import past a boundary. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, Ports declared inside; takes an outside dependency → Outside dependencies stay at boundaries. The breach usually sits at a missing adapter and port. Recipes: Adapter per outside party; Port in the domain. Correct use: a boundary record on the adapter for that outside party (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-import-past-a-boundary",
  "outside-type-in-a-signature: Outside type in a signature. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, No leak across a boundary. The breach usually sits in the adapter that hands the outside type inward. Recipe: Adapter per outside party. Correct use: a boundary record on the adapter, or beyond it with a Conformist statement for an outside model adopted as ours (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-type-in-a-signature",
  "positional-parameters: Positional parameters. May indicate: names something → One word everywhere; does one job → Handed what it uses. The breach usually sits in the signature. Recipe: One argument object. A callback whose signature an outside library fixes: an authorised location in the file that implements it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#positional-parameters",
  "process-global-used-in-place: Process global used in place. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; causes an effect (writes, logs, sends, exits) → Ports declared inside; builds the real implementations → Ports declared inside. The breach usually sits at a missing port, or at an adapter not built at the entry point. Recipes: World values through a port; Adapter per outside party; Composition root. Correct use: a boundary record on the adapter that wraps the process (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#process-global-used-in-place",
  "schema-past-its-adapter: Schema past its adapter. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the adapter, which hands the wire type inward instead of mapping it. Recipe: Zod at the producer's adapter. An outside model adopted as ours: a boundary record with a Conformist statement (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#schema-past-its-adapter",
  "shorthand-name: Shorthand name. May indicate: names something → One word everywhere. The breach usually sits in the name. Recipe: Whole words. A name an outside contract fixes: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#shorthand-name",
  "tangled-function: Tangled function. May indicate: coordinates other units → Doer or orchestrator; does one job → Doer or orchestrator; gives a value its type (declares it, or needs it narrower) → Handed what it uses; checks conditions before its work → Guard first; puts code in a file or folder → One reason per module; names something → One word everywhere. The breach usually sits in the unit: several jobs, an input wider than its use, nested questions, or a responsibility not isolated and named. Recipes: Composed orchestrator; Guard clauses; One argument object. A function whose shape an outside contract fixes: an authorised location in the file that holds it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#tangled-function",
  "text-past-its-reader: Text past its reader. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; sends data out of the program → No leak across a boundary; uses a system or service outside the program → External behaviour sits at a boundary; states what the unit gives back, for one case or several → Straight-through tests. The breach usually sits in a port that takes or gives text where it should carry objects. Recipes: Adapter per outside party; Map out at the adapter; Zod at the producer's adapter; Whole written-out expectation. Correct use: a boundary record on the adapter for whoever produced or receives the text (today: authorised-location). A use at one test site: an authorised location for this symptom alone (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#text-past-its-reader",
  "throw-between-our-units: Throw between our units. May indicate: an operation can fail → Failures are values; sends data out of the program → No leak across a boundary. The breach usually sits in the unit, or at a missing mapping in the adapter. Recipes: Result union; Failure mapping at the adapter. Correct use: an authorised location at an adapter whose caller's contract is exceptions (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#throw-between-our-units",
  "type-derived-from-code: Type derived from code. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; names something → One word everywhere. The breach usually sits in the producer, which has no named type. Recipe: Named, exported type. Correct use: an authorised location in the adapter for an outside dependency that gives no named type (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#type-derived-from-code",
  "work-inside-a-condition: Work inside a condition. May indicate: checks conditions before its work → Guard first; does one job → Doer or orchestrator. The breach usually sits in the unit's questions. Recipe: Guard clauses. An else kept for an outside reason: an authorised location in the file that keeps it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#work-inside-a-condition",
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

  const MUTATION_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-mutation") };

  const REASSIGNMENT_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-reassignment") };

  const INTENT_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-intent") };

  const PARAMETER_CLAUSES: SymptomCatalogue["clauses"] = [
    { clause: MUTATION_CLAUSE, sight: { kind: "one-symptom", symptom: WRITE_INTO_A_PARAMETER } },
    { clause: REASSIGNMENT_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
    { clause: INTENT_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ];

  const MUTATION_CHECK: Check = { name: "parameter-mutation", symptom: WRITE_INTO_A_PARAMETER, clause: MUTATION_CLAUSE, engines: [WALKER], forms: [] };

  const ONE_PLACE: Principle = { name: "one-place-decides", title: "One place decides" };

  const DOER: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE, standing: "accepted" };

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

const reading = readBoundCatalogue({ directory: createDefaultDirectoryPort({}), fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT, installRoot: REPO_ROOT });

describe("rules/typescript/symptoms.json, read from this repository through the catalogue's reader", () => {
  it("reads into the typed catalogue", () => {
    expect(reading).toMatchObject({ outcome: "ok", value: { held: "catalogue" } });
  });

  it("reads CD-27#test-body-logic by form, one symptom for each section its findings name, in the walker's order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(formSectionsOf({ catalogue: reading.value.catalogue, clause: "CD-27#test-body-logic" })).toEqual(TEST_BODY_SECTIONS);
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
