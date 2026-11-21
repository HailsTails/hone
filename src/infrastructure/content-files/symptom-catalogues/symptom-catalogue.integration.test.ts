import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { TEST_BODY_SECTIONS } from "../../engines/audit/CD-27/test-body-logic.ts";
import { repositoryRootOf } from "../../../../tests/allowed-forms-proof.ts";
import {
  caseNamesOffTheirTitles,
  casesOfCatalogue,
  casesOnCasesPage,
  missingLinkSentencesOn,
  owesOfCatalogue,
  owesOnPages,
  type ProseLink,
  proposedReasonsOf,
  reasonMismatchesOf,
  recipeReasonsOnPage,
  unlinkedCaseSentencesOn,
  unlistedCaseNamesOn,
  unservedCaseNamesOn,
  unowedPointersOf,
} from "../../../../tests/catalogue-pages.ts";
import { foldersUnder } from "../../../../tests/conformance-rows.ts";
import {
  catalogueCoverageOf,
  checkAddressTableOf,
  checkCoverageOf,
  correctUseNotesOf,
  formSectionsOf,
  symptomNamesOf,
  unresolvedAddressesOf,
} from "../../../../tests/symptom-catalogue-coverage.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const REPO_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: `${import.meta.dirname}/../../..` }));

const disciplineTexts = import.meta.glob(["./rules/*/discipline.json"], { base: "../../../../", query: "?raw", import: "default", eager: true });

const DISCIPLINES = foldersUnder({ table: disciplineTexts, prefix: "./rules/" });

const FILE_TEXT = createDefaultFileTextPort({});

const PATH = createDefaultPathPort({});

const SYMPTOMS_ON_THE_STEP_5_PAGE = [
  "date-used-directly",
  "ambient-randomness",
  "process-global-used-in-place",
  "outside-import-past-a-boundary",
  "outside-type-in-a-signature",
  "library-class-built-in-place",
  "text-past-its-reader",
  "schema-past-its-adapter",
  "claimed-type",
  "untyped-value",
  "own-type-guard",
  "type-derived-from-code",
  "strictness-weakened",
  "default-on-a-closed-union",
  "boolean-in-a-signature",
  "absence-standing-for-a-state",
  "default-for-a-required-value",
  "throw-between-our-units",
  "thrown-non-error",
  "failure-shaped-as-success",
  "catch-all-failure-kind",
  "loop-keyword",
  "write-into-a-parameter",
  "rebinding",
  "authored-class-or-this",
  "module-level-state",
  "long-function",
  "tangled-function",
  "work-inside-a-condition",
  "orchestrator-that-computes",
  "doer-calling-our-own-unit",
  "positional-parameters",
  "tuple-as-data",
  "wide-input",
  "wide-port",
  "inner-layer-imports-outer",
  "port-outside-the-domain",
  "adapter-built-outside-the-root",
  "port-named-for-a-mechanism",
  "double-with-a-body",
  "module-or-global-patched",
  "branch-in-a-test",
  "computed-value-in-a-test",
  "throw-or-catch-in-a-test",
  "unasserted-call",
  "answer-set-in-a-hook",
  "test-switched-off",
  "unit-without-a-running-test",
  "machine-touched-in-a-unit-test",
  "inherited-environment-in-a-subprocess",
  "behaviour-tested-away-from-its-owner",
  "integration-heavy-suite",
  "coverage-gate",
  "large-input-for-a-few-fields",
  "test-of-the-type-checker",
  "shorthand-name",
  "name-off-its-casing",
  "drawer-path",
  "types-only-file",
  "prose-in-code",
  "untracked-escape",
  "many-spellings-of-one-concept",
  "outside-dependency-vocabulary-for-basic-logic",
  "duplicate-decision",
  "change-spread-across-modules",
  "floating-version",
  "no-lock-file",
  "dependency-without-a-record",
  "tool-fetched-at-run-time",
  "edit-inside-vendored-code",
  "bundled-dependency",
];

const NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE = [
  "date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#date-used-directly",
  "ambient-randomness: Ambient randomness. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers. The breach usually sits in the unit that should be passed the value, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the adapter for random values or new ids (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#ambient-randomness",
  "process-global-used-in-place: Process global used in place. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; causes an effect (writes, logs, sends, exits) → Ports declared inside; builds the real implementations → Ports declared inside. The breach usually sits at a missing port, or at an adapter not built at the entry point. Recipes: World values through a port; Adapter per outside party; Composition root. Correct use: a boundary record on the adapter that wraps the process (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#process-global-used-in-place",
  "outside-import-past-a-boundary: Outside import past a boundary. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, Ports declared inside; takes an outside dependency → Outside dependencies stay at boundaries. The breach usually sits at a missing adapter and port. Recipes: Adapter per outside party; Port in the domain. Correct use: a boundary record on the adapter for that outside party (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-import-past-a-boundary",
  "outside-type-in-a-signature: Outside type in a signature. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, No leak across a boundary. The breach usually sits in the adapter that hands the outside type inward. Recipe: Adapter per outside party. Correct use: a boundary record on the adapter, or beyond it with a Conformist statement for an outside model adopted as ours (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-type-in-a-signature",
  "library-class-built-in-place: Library class built in place. May indicate: takes an outside dependency → Outside dependencies stay at boundaries; keeps state or settings across calls → No hidden effects. The breach usually sits at a missing adapter. Recipes: Adapter per outside party; Closure factory. Correct use: a boundary record on that dependency's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#library-class-built-in-place",
  "text-past-its-reader: Text past its reader. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; sends data out of the program → No leak across a boundary; uses a system or service outside the program → External behaviour sits at a boundary; states what the unit gives back, for one case or several → Straight-through tests. The breach usually sits in a port that takes or gives text where it should carry objects. Recipes: Adapter per outside party; Map out at the adapter; Zod at the producer's adapter; Whole written-out expectation. Correct use: a boundary record on the adapter for whoever produced or receives the text (today: authorised-location). A use at one test site: an authorised location for this symptom alone (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#text-past-its-reader",
  "schema-past-its-adapter: Schema past its adapter. May indicate: reads data from outside (request, file, environment, stored row, response) → No leak across a boundary; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the adapter, which hands the wire type inward instead of mapping it. Recipe: Zod at the producer's adapter. An outside model adopted as ours: a boundary record with a Conformist statement (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#schema-past-its-adapter",
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#claimed-type",
  "type-derived-from-code: Type derived from code. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; names something → One word everywhere. The breach usually sits in the producer, which has no named type. Recipe: Named, exported type. Correct use: an authorised location in the adapter for an outside dependency that gives no named type (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#type-derived-from-code",
  "throw-between-our-units: Throw between our units. May indicate: an operation can fail → Failures are values; sends data out of the program → No leak across a boundary. The breach usually sits in the unit, or at a missing mapping in the adapter. Recipes: Result union; Failure mapping at the adapter. Correct use: an authorised location at an adapter whose caller's contract is exceptions (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#throw-between-our-units",
  "loop-keyword: Loop keyword. May indicate: makes a new value from what it has → No hidden effects; causes an effect (writes, logs, sends, exits) → Ports declared inside; coordinates other units → Doer or orchestrator. The breach usually sits in the unit. Recipe: Functional iteration. Draining a stream: an authorised location in its source's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#loop-keyword",
  "double-with-a-body: Double with a body. May indicate: uses what a collaborator gives back → Written-out answers; does one job: the port the stub stands in for → Handed what it uses; does one job: the collaborator the stub stands in for → Doer or orchestrator. The breach usually sits in a port too wide, or in a collaborator holding two decisions. Recipe: Stub with vi.fn. A fake, where a stub cannot do the test: a deviation from Stub with vi.fn (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#double-with-a-body",
  "shorthand-name: Shorthand name. May indicate: names something → One word everywhere. The breach usually sits in the name. Recipe: Whole words. A name an outside contract fixes: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#shorthand-name",
  "name-off-its-casing: Name off its casing. May indicate: names something → One word everywhere. The breach usually sits in the name. An outside contract's names, such as `PATH` or ESLint listener keys: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#name-off-its-casing",
  "dependency-without-a-record: Dependency without a record. May indicate: takes an outside dependency → Outside dependencies justified. The breach usually sits in the missing record. Recipe: Dependency record. Correct use: a dependency record naming the native way weighed and why it fell short (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#dependency-without-a-record",
  "edit-inside-vendored-code: Edit inside vendored code. May indicate: takes an outside dependency → Upstream stays untouched. The breach usually sits in the change. Recipe: Extension outside the vendored code. Drift, an edit impossible to apply as an extension: an authorised location stating when to drop it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#edit-inside-vendored-code",
];

const CASES_PAGE = FILE_TEXT.read({ path: PATH.join({ segments: [REPO_ROOT, "rules", "cases.md"] }) });

const SYMPTOMS_PAGE = FILE_TEXT.read({ path: PATH.join({ segments: [REPO_ROOT, "rules", "typescript", "symptoms.md"] }) });

const RULES_PAGE = FILE_TEXT.read({ path: PATH.join({ segments: [REPO_ROOT, "rules", "rules.md"] }) });

const RECIPES_PAGE = FILE_TEXT.read({ path: PATH.join({ segments: [REPO_ROOT, "rules", "typescript", "recipes.md"] }) });

const RECIPES_WITH_A_PROPOSED_REASON = [
  "failure-asserted-as-a-value",
  "integration-test-owns-its-scratch",
  "composition-root",
  "failure-mapping-at-the-adapter",
  "named-exported-type",
  "bounded-context-generic",
  "shared-strict-base-config",
];

const OUTSIDE_ADDRESSES = [
  { address: "claimed-type#cast-to-any", clause: "CD-1#any-cast" },
  { address: "untyped-value#explicit-any", clause: "CD-1#explicit-any" },
  { address: "untyped-value#implicit-any-let", clause: "CD-1#implicit-any-let" },
  { address: "claimed-type#unlisted-cast-site", clause: "CD-2#cast-expressions" },
  { address: "claimed-type#non-null-assertions", clause: "CD-2#non-null-assertions" },
  { address: "strictness-weakened#strict", clause: "CD-3#strict" },
  { address: "strictness-weakened#no-unchecked-indexed-access", clause: "CD-3#no-unchecked-indexed-access" },
  { address: "strictness-weakened#exact-optional-property-types", clause: "CD-3#exact-optional-property-types" },
  { address: "strictness-weakened#no-implicit-override", clause: "CD-3#no-implicit-override" },
  { address: "strictness-weakened#no-fallthrough-cases-in-switch", clause: "CD-3#no-fallthrough-cases-in-switch" },
  { address: "strictness-weakened#no-property-access-from-index-signature", clause: "CD-3#no-property-access-from-index-signature" },
  { address: "strictness-weakened#use-unknown-in-catch-variables", clause: "CD-3#use-unknown-in-catch-variables" },
  { address: "untracked-escape#directive-pointers", clause: "CD-5#comments-directives" },
  { address: "shorthand-name#identifier-names", clause: "CD-6#identifier-names" },
  { address: "name-off-its-casing#naming-convention", clause: "CD-6#naming-convention" },
  { address: "drawer-path#drawer-names", clause: "CD-7#categorical-paths" },
  { address: "name-off-its-casing#filename-case", clause: "CD-7#filename-case" },
  { address: "type-derived-from-code#factory-return-types", clause: "CD-7a#factory-return-types" },
  { address: "default-on-a-closed-union#default-arm", clause: "CD-8#switch-defaults" },
  { address: "throw-or-catch-in-a-test#throw-statement", clause: "CD-10#throws-in-tests" },
  { address: "thrown-non-error#throw-only-error", clause: "CD-10#throw-only-error" },
  { address: "authored-class-or-this#class-keyword", clause: "CD-14#class-syntax" },
  { address: "authored-class-or-this#static-members-only", clause: "CD-14#static-only-class" },
  { address: "loop-keyword#loop-statement", clause: "CD-15#loops" },
  { address: "date-used-directly#clock-sources", clause: "CD-17#clock-sources" },
  { address: "outside-import-past-a-boundary#import-or-require", clause: "CD-19#import-boundaries" },
  { address: "unit-without-a-running-test#companion-test-file", clause: "CD-23#export-test-sibling" },
  { address: "double-with-a-body#stub-implementation", clause: "CD-25#dependency-isolation" },
  { address: "module-or-global-patched#module-mock-call", clause: "CD-26#module-mocking" },
  { address: "branch-in-a-test#test-body", clause: "CD-27#test-body-logic" },
  { address: "throw-or-catch-in-a-test#try-block", clause: "CD-27#test-body-logic" },
  { address: "rebinding#test-body", clause: "CD-27#test-body-logic" },
  { address: "computed-value-in-a-test#test-body", clause: "CD-27#test-body-logic" },
  { address: "text-past-its-reader#test-body", clause: "CD-27#test-body-logic" },
  { address: "double-with-a-body#logic-in-a-passed-function", clause: "CD-27#test-body-logic" },
  { address: "test-switched-off#focused-tests", clause: "CD-27#focused-tests" },
  { address: "test-switched-off#skipped-tests", clause: "CD-27#skipped-tests" },
  { address: "positional-parameters#parameter-count", clause: "CD-40#parameter-count" },
  { address: "tangled-function#cognitive-complexity", clause: "CD-41#cognitive-complexity" },
  { address: "long-function#function-length", clause: "CD-41#function-length" },
  { address: "work-inside-a-condition#else-after-an-exit", clause: "CD-42#useless-else" },
  { address: "boolean-in-a-signature#boolean-annotation", clause: "CD-43#boolean-signatures" },
  { address: "write-into-a-parameter#parameter-mutation", clause: "CD-44#parameter-mutation" },
  { address: "rebinding#parameter-reassignment", clause: "CD-44#parameter-reassignment" },
  { address: "inherited-environment-in-a-subprocess#git-spawn-environment", clause: "CD-47#hermetic-git-spawns" },
];

const PROSE_LINKS: readonly ProseLink[] = [
  {
    sentence: "Building every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it.",
    cases: ["Builds the real implementations"],
  },
  {
    sentence: "The clock, random values, new ids and outside ordering are a case: the principle plus Ports declared inside give it.",
    cases: ["Needs the current time, a random value, a new id or an outside ordering"],
  },
  {
    sentence:
      "The principle, now covering data and failures, plus One reason per module, gives one adapter per outside party that maps both ways, so Reads data from outside (request, file, environment, stored row, response) and Sends data out of the program are each a case that owes One reason per module.",
    cases: ["Reads data from outside (request, file, environment, stored row, response)", "Sends data out of the program"],
  },
  {
    sentence: "A case under [Outside dependencies justified](rules.md#outside-dependencies-justified).",
    cases: ["An adopter is not handed our risk"],
  },
];

const reading = createSymptomCatalogueRepository({ fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT }).read({});

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

  it("holds each case on rules/cases.md by the page's name and standing, in the page's order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    assert(CASES_PAGE.outcome === "ok");

    expect(casesOfCatalogue({ catalogue: reading.value.catalogue })).toEqual(casesOnCasesPage({ text: CASES_PAGE.value }));
  });

  it("names every case by one rule: its title without its parenthetical, hyphenated", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(caseNamesOffTheirTitles({ cases: reading.value.catalogue.cases })).toEqual([]);
  });

  it("names on rules/typescript/symptoms.md only cases on rules/cases.md, spelled as that page spells them", () => {
    assert(CASES_PAGE.outcome === "ok");
    assert(SYMPTOMS_PAGE.outcome === "ok");

    expect(unlistedCaseNamesOn({ symptomsPage: SYMPTOMS_PAGE.value, cases: casesOnCasesPage({ text: CASES_PAGE.value }) })).toEqual([]);
  });

  it("names in rules/rules.md's cases served only cases on rules/cases.md, spelled as that page spells them", () => {
    assert(CASES_PAGE.outcome === "ok");
    assert(RULES_PAGE.outcome === "ok");

    expect(unservedCaseNamesOn({ rulesPage: RULES_PAGE.value, cases: casesOnCasesPage({ text: CASES_PAGE.value }) })).toEqual([]);
  });

  it("holds what each case owes as the pages give it: the principles of its Owes column, then the rules that serve it or that the pages' prose says give it", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    assert(CASES_PAGE.outcome === "ok");
    assert(RULES_PAGE.outcome === "ok");

    expect(owesOfCatalogue({ catalogue: reading.value.catalogue })).toEqual(
      owesOnPages({ casesPage: CASES_PAGE.value, rulesPage: RULES_PAGE.value, links: PROSE_LINKS }),
    );
  });

  it("points every indication only at what its case owes", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(unowedPointersOf({ catalogue: reading.value.catalogue })).toEqual([]);
  });

  it("lists every sentence on rules/rules.md that makes a case of rules, and finds each listed sentence on its page", () => {
    assert(CASES_PAGE.outcome === "ok");
    assert(RULES_PAGE.outcome === "ok");

    expect({
      unlinked: unlinkedCaseSentencesOn({ pages: [RULES_PAGE.value], links: PROSE_LINKS }),
      missing: missingLinkSentencesOn({ pages: [RULES_PAGE.value, CASES_PAGE.value], links: PROSE_LINKS }),
    }).toEqual({ unlinked: [], missing: [] });
  });

  it("carries each recipe's reason in rules/typescript/recipes.md's words, proposed where the page proposes it", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    assert(RECIPES_PAGE.outcome === "ok");

    expect(reasonMismatchesOf({ recipes: reading.value.catalogue.recipes, page: recipeReasonsOnPage({ text: RECIPES_PAGE.value }) })).toEqual([]);
    expect(proposedReasonsOf({ recipes: reading.value.catalogue.recipes })).toEqual(RECIPES_WITH_A_PROPOSED_REASON);
  });

  it("holds every symptom on the Step 5 page, in its order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(symptomNamesOf({ catalogue: reading.value.catalogue })).toEqual(SYMPTOMS_ON_THE_STEP_5_PAGE);
  });

  it("renders each symptom that has a correct use as a note that reads as sentences, in catalogue order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(correctUseNotesOf({ guide: { guide: "catalogue", catalogue: reading.value.catalogue, page: "rules/typescript/symptoms.md" } })).toEqual(
      NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE,
    );
  });
});
