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
  RecipeReason,
  RecordKind,
  Rule,
  Standing,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { type CatalogueGuide, symptomNoteLineOf } from "../../printed-report/symptoms/symptom-notes.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import { disciplineIdSchema, mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import type { Result } from "../../../domain/result.ts";

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

const symptomNamesOf = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] =>
  request.catalogue.symptoms.map((symptom) => symptom.name);

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

type PageCase = { readonly title: string; readonly standing: Standing };

type PageReason = { readonly title: string; readonly reason: RecipeReason };

const CASE_ROW = /^\| (.+?) \| .+? \| .* \|$/;

const NOT_A_CASE_TITLE = new Set(["Case", "---"]);

type CaseReading = { readonly standing: Standing; readonly within: "cases" | "outside"; readonly cases: readonly PageCase[] };

const caseReadingAfter = (reading: CaseReading, line: string): CaseReading => {
  if (reading.within === "outside" || line.startsWith("## Outside the cases")) {
    return { ...reading, within: "outside" };
  }
  if (line.startsWith("### Proposed cases")) {
    return { ...reading, standing: "proposed" };
  }
  const title = CASE_ROW.exec(line)?.[1];
  return title === undefined || NOT_A_CASE_TITLE.has(title) ? reading : { ...reading, cases: [...reading.cases, { title, standing: reading.standing }] };
};

const casesOnCasesPage = (request: { readonly text: string }): readonly PageCase[] =>
  request.text.split("\n").reduce<CaseReading>(caseReadingAfter, { standing: "accepted", within: "cases", cases: [] }).cases;

const casesOfCatalogue = (request: { readonly catalogue: Pick<SymptomCatalogue, "cases"> }): readonly PageCase[] =>
  request.catalogue.cases.map((entry) => ({ title: entry.title, standing: entry.standing }));

const INDICATION_LINE = /^- \*\*May indicate:\*\* (.+)$/;

const TEST_QUALIFIER = "In a test: ";

const SITUATION_SEPARATOR = ": ";

const caseSpellingsBefore = (request: { readonly indications: string }): readonly string[] =>
  request.indications
    .split(" → ")
    .slice(0, -1)
    .map((before) => before.split(/\. |; /).at(-1) ?? before)
    .map((spelling) => (spelling.startsWith(TEST_QUALIFIER) ? spelling.slice(TEST_QUALIFIER.length) : spelling))
    .map((spelling) => spelling.split(SITUATION_SEPARATOR)[0] ?? spelling);

const pageSpellingsOf = (request: { readonly cases: readonly PageCase[] }): readonly string[] =>
  request.cases
    .map((entry) => (entry.standing === "proposed" ? `${entry.title} (proposed)` : entry.title))
    .toSorted((left, right) => right.length - left.length);

const unlistedRestOf = (request: { readonly rest: string; readonly spellings: readonly string[] }): string => {
  if (request.rest === "") {
    return "";
  }
  const known = request.spellings.find((spelling) => request.rest === spelling || request.rest.startsWith(`${spelling}, `));
  return known === undefined ? request.rest : unlistedRestOf({ ...request, rest: request.rest.slice(known.length).replace(/^, /, "") });
};

const unlistedCaseNamesOn = (request: { readonly symptomsPage: string; readonly cases: readonly PageCase[] }): readonly string[] => {
  const spellings = pageSpellingsOf(request);
  return request.symptomsPage
    .split("\n")
    .flatMap((line) => {
      const indications = INDICATION_LINE.exec(line)?.[1];
      return indications === undefined ? [] : caseSpellingsBefore({ indications });
    })
    .filter((spelling) => unlistedRestOf({ rest: spelling, spellings }) !== "");
};

const SERVED_LINE = /^- \*\*Cases served:\*\* (.+)\.$/;

const WOULD_SERVE_LINE = /^- \*\*Case it would serve:\*\* \[(.+?)\]/;

const servedSpellingsOn = (request: { readonly line: string }): readonly string[] => {
  const served = SERVED_LINE.exec(request.line)?.[1];
  const wouldServe = WOULD_SERVE_LINE.exec(request.line)?.[1];
  return [...(served === undefined ? [] : served.split("; ")), ...(wouldServe === undefined ? [] : [wouldServe])];
};

const unservedCaseNamesOn = (request: { readonly rulesPage: string; readonly cases: readonly PageCase[] }): readonly string[] => {
  const titles = request.cases.map((entry) => entry.title);
  return request.rulesPage
    .split("\n")
    .flatMap((line) => servedSpellingsOn({ line }))
    .filter((spelling) => !titles.includes(spelling));
};

const RECIPE_HEADING = /^#{3,4} (.+)$/;

const REASON_LINE = /^- \*\*Chosen because( \(proposed\))?:\*\* (.+)$/;

type ReasonReading = { readonly title: string | undefined; readonly reasons: readonly PageReason[] };

const reasonReadingAfter = (reading: ReasonReading, line: string): ReasonReading => {
  const heading = RECIPE_HEADING.exec(line)?.[1];
  if (heading !== undefined) {
    return { ...reading, title: heading.trim() };
  }
  const reason = REASON_LINE.exec(line);
  const text = reason?.[2];
  if (reading.title === undefined || reason === null || text === undefined) {
    return reading;
  }
  const standing: Standing = reason[1] === undefined ? "accepted" : "proposed";
  return { title: undefined, reasons: [...reading.reasons, { title: reading.title, reason: { text, standing } }] };
};

const recipeReasonsOnPage = (request: { readonly text: string }): readonly PageReason[] =>
  request.text.split("\n").reduce<ReasonReading>(reasonReadingAfter, { title: undefined, reasons: [] }).reasons;

const reasonFitOf = (request: { readonly recipe: Recipe; readonly page: readonly PageReason[] }): "fits" | "differs" => {
  const onPage = request.page.find((entry) => entry.title === request.recipe.title);
  return onPage !== undefined && onPage.reason.text === request.recipe.reason.text && onPage.reason.standing === request.recipe.reason.standing
    ? "fits"
    : "differs";
};

const proposedReasonsOf = (request: { readonly recipes: readonly Recipe[] }): readonly string[] =>
  request.recipes.filter((recipe) => recipe.reason.standing === "proposed").map((recipe) => recipe.name);

const reasonMismatchesOf = (request: { readonly recipes: readonly Recipe[]; readonly page: readonly PageReason[] }): readonly string[] =>
  request.recipes.filter((recipe) => reasonFitOf({ recipe, page: request.page }) === "differs").map((recipe) => recipe.name);

type PageOwes = { readonly title: string; readonly principles: readonly string[]; readonly rules: readonly string[] };

type ProseLink = { readonly sentence: string; readonly cases: readonly string[] };

const SHORT_NAME = /([A-Z][A-Za-z ]*?) \(\[[^\]]+\]\(principles\.md#([a-z-]+)\)\)/g;

const OWES_ROW = /^\| (.+?) \| (.+?) \| .* \|$/;

const OUTSIDE_THE_CASES = "## Outside the cases";

const RULE_HEADING = /^### (.+)$/;

const CASE_SENTENCE = " a case";

const shortNamesOn = (request: { readonly casesPage: string }): ReadonlyMap<string, string> =>
  new Map([...request.casesPage.matchAll(SHORT_NAME)].flatMap((match) => (match[1] === undefined || match[2] === undefined ? [] : [[match[1], match[2]] as const])));

const ruleTitlesOn = (request: { readonly pages: readonly string[] }): readonly string[] =>
  request.pages.flatMap((page) => page.split("\n").flatMap((line) => RULE_HEADING.exec(line)?.slice(1, 2) ?? []));

type Serving = { readonly rule: string; readonly case: string };

type ServingReading = { readonly rule: string | undefined; readonly servings: readonly Serving[] };

const servingReadingAfter = (reading: ServingReading, line: string): ServingReading => {
  const heading = RULE_HEADING.exec(line)?.[1];
  if (heading !== undefined) {
    return { ...reading, rule: heading };
  }
  const rule = reading.rule;
  return rule === undefined ? reading : { ...reading, servings: [...reading.servings, ...servedSpellingsOn({ line }).map((served) => ({ rule, case: served }))] };
};

const servingsOnRulesPage = (request: { readonly rulesPage: string }): readonly Serving[] =>
  request.rulesPage.split("\n").reduce<ServingReading>(servingReadingAfter, { rule: undefined, servings: [] }).servings;

const linkedServings = (request: { readonly pages: readonly string[]; readonly links: readonly ProseLink[] }): readonly Serving[] => {
  const titles = ruleTitlesOn(request);
  return request.links
    .filter((link) => request.pages.some((page) => page.includes(link.sentence)))
    .flatMap((link) => titles.filter((title) => link.sentence.includes(title)).flatMap((rule) => link.cases.map((served) => ({ rule, case: served }))));
};

const owedRows = (request: { readonly casesPage: string }): readonly (readonly [string, string])[] =>
  (request.casesPage.split(OUTSIDE_THE_CASES)[0] ?? "").split("\n").flatMap((line) => {
    const row = OWES_ROW.exec(line);
    const title = row?.[1];
    const owes = row?.[2];
    return title === undefined || owes === undefined || NOT_A_CASE_TITLE.has(title) ? [] : [[title, owes] as const];
  });

const owesOnPages = (request: { readonly casesPage: string; readonly rulesPage: string; readonly links: readonly ProseLink[] }): readonly PageOwes[] => {
  const shortNames = shortNamesOn(request);
  const pages = [request.rulesPage, request.casesPage];
  const servings = [...servingsOnRulesPage(request), ...linkedServings({ pages, links: request.links })];
  const titles = ruleTitlesOn({ pages: [request.rulesPage] });
  return owedRows(request).map(([title, owes]) => ({
    title,
    principles: owes.split(/; |, /).map((short) => shortNames.get(short) ?? `unknown short name ${short}`),
    rules: titles.filter((rule) => servings.some((serving) => serving.rule === rule && serving.case === title)),
  }));
};

const lineKindOf = (request: { readonly line: string }): "prose" | "other" => (/^[A-Za-z"]/.test(request.line) ? "prose" : "other");

const SENTENCE_BREAK = /(?<=\.) (?!That is a case\.)/;

const sentencesOf = (request: { readonly paragraph: string }): readonly string[] => request.paragraph.split(SENTENCE_BREAK);

const unlinkedCaseSentencesOn = (request: { readonly pages: readonly string[]; readonly links: readonly ProseLink[] }): readonly string[] => {
  const titles = ruleTitlesOn(request);
  return request.pages
    .flatMap((page) => page.split("\n").filter((line) => lineKindOf({ line }) === "prose"))
    .flatMap((paragraph) => sentencesOf({ paragraph }))
    .filter((sentence) => sentence.includes(CASE_SENTENCE) && titles.some((title) => sentence.includes(title)))
    .filter((sentence) => !request.links.some((link) => link.sentence === sentence));
};

const missingLinkSentencesOn = (request: { readonly pages: readonly string[]; readonly links: readonly ProseLink[] }): readonly string[] =>
  request.links.filter((link) => !request.pages.some((page) => page.includes(link.sentence))).map((link) => link.sentence);

const owesOfCatalogue = (request: { readonly catalogue: Pick<SymptomCatalogue, "cases"> }): readonly PageOwes[] =>
  request.catalogue.cases.map((entry) => ({
    title: entry.title,
    principles: entry.owes.flatMap((point) => (point.kind === "principle" ? [point.principle.name] : [])),
    rules: entry.owes.flatMap((point) => (point.kind === "rule" ? [point.rule.title] : [])),
  }));

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

describe("the catalogue guards over written-out pages and catalogues, so each can fail", () => {
  const INSTALL_ROOT = absolutePathSchema.parse("/install");

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

  const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

  const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

  const MUTATION_CLAUSE = clauseAddressSchema.parse("CD-44#parameter-mutation");

  const REASSIGNMENT_CLAUSE = clauseAddressSchema.parse("CD-44#parameter-reassignment");

  const INTENT_CLAUSE = clauseAddressSchema.parse("CD-44#parameter-intent");

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

  const PAGE_CASES: readonly PageCase[] = [
    { title: "Makes a new value from what it has", standing: "accepted" },
    { title: "Causes an effect (writes, logs, sends, exits)", standing: "accepted" },
    { title: "Ships code for others", standing: "proposed" },
  ];

  const OWES_RULES_PAGE =
    "# Rules\n\n## One place decides\n\n### Doer or orchestrator\n\n- **What must hold:** An orchestrator only calls.\n- **Cases served:** Makes a new value from what it has.\n\nBuilding every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it.\n";

  const ONE_PLACE: Principle = { name: "one-place-decides", title: "One place decides" };

  const DOER: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE, standing: "accepted" };

  const STUB_WITH_VIFN: Recipe = {
    name: "stub-with-vifn",
    title: "Stub with vi.fn",
    standing: "accepted",
    reason: { text: '"Stubs return written-out values."', standing: "accepted" },
  };

  const COMPOSITION_ROOT: Recipe = {
    name: "composition-root",
    title: "Composition root",
    standing: "accepted",
    reason: { text: '"One place builds."', standing: "proposed" },
  };

  it("names each clause a discipline defines that the catalogue lacks, and each catalogued clause no discipline defines", () => {
    expect(
      catalogueCoverageOf({
        catalogue: {
          ...NOTHING_CATALOGUED,
          clauses: [
            { clause: MUTATION_CLAUSE, sight: { kind: "one-symptom", symptom: WRITE_INTO_A_PARAMETER } },
            { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), sight: { kind: "one-symptom", symptom: REBINDING } },
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

  it("names each spelling before an arrow on the symptoms page that is not a case on the cases page", () => {
    expect(
      unlistedCaseNamesOn({
        symptomsPage:
          "- **May indicate:** Makes a new value, Causes an effect (writes, logs, sends, exits) → Ports declared inside. Causes an effect → Written-out answers; Makes a new value from what it has (proposed) → One place decides.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual(["Makes a new value, Causes an effect (writes, logs, sends, exits)", "Causes an effect", "Makes a new value from what it has (proposed)"]);
  });

  it("names each served case on the rules page spelled otherwise than the cases page spells it", () => {
    expect(
      unservedCaseNamesOn({
        rulesPage: "- **Cases served:** Makes a new value; Causes an effect (writes, logs, sends, exits).\n- **Case it would serve:** [Ships code](cases.md#proposed-cases) (proposed).\n",
        cases: PAGE_CASES,
      }),
    ).toEqual(["Makes a new value", "Ships code"]);
  });

  it("names a short name the cases page does not define as unknown", () => {
    expect(
      owesOnPages({
        casesPage: "| Case | Owes | What to do |\n|---|---|---|\n| Makes a new value from what it has | Tests | It returns. |\n",
        rulesPage: "",
        links: [],
      }),
    ).toEqual([{ title: "Makes a new value from what it has", principles: ["unknown short name Tests"], rules: [] }]);
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

  it("names a sentence that makes a case of rules that no prose link lists, and a prose link whose sentence no page holds", () => {
    expect({
      unlinked: unlinkedCaseSentencesOn({ pages: [OWES_RULES_PAGE], links: [] }),
      missing: missingLinkSentencesOn({ pages: [OWES_RULES_PAGE], links: [{ sentence: "Guard first gives it.", cases: ["Builds the real implementations"] }] }),
    }).toEqual({
      unlinked: ["Building every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it."],
      missing: ["Guard first gives it."],
    });
  });

  it("names a recipe whose reason is presented as settled where the page proposes it, one whose words differ, and one the page has no reason for", () => {
    expect(
      reasonMismatchesOf({
        recipes: [
          { ...COMPOSITION_ROOT, reason: { text: '"One place builds."', standing: "accepted" } },
          { ...STUB_WITH_VIFN, reason: { text: '"Stubs are simple."', standing: "accepted" } },
          { ...STUB_WITH_VIFN, name: "guard-clauses", title: "Guard clauses" },
        ],
        page: [
          { title: "Stub with vi.fn", reason: { text: '"Stubs return written-out values."', standing: "accepted" } },
          { title: "Composition root", reason: { text: '"One place builds."', standing: "proposed" } },
        ],
      }),
    ).toEqual(["composition-root", "stub-with-vifn", "guard-clauses"]);
  });
});

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
