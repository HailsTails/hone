import type { Case, Indication, Pointed, Recipe, RecipeReason, Standing, Symptom, SymptomCatalogue } from "../src/domain/language-layer/symptom-catalogue.ts";

export type PageCase = { readonly title: string; readonly standing: Standing };

export type PageReason = { readonly title: string; readonly reason: RecipeReason };

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

export const casesOnCasesPage = (request: { readonly text: string }): readonly PageCase[] =>
  request.text.split("\n").reduce<CaseReading>(caseReadingAfter, { standing: "accepted", within: "cases", cases: [] }).cases;

export const casesOfCatalogue = (request: { readonly catalogue: Pick<SymptomCatalogue, "cases"> }): readonly PageCase[] =>
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

export const unlistedCaseNamesOn = (request: { readonly symptomsPage: string; readonly cases: readonly PageCase[] }): readonly string[] => {
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

export const unservedCaseNamesOn = (request: { readonly rulesPage: string; readonly cases: readonly PageCase[] }): readonly string[] => {
  const titles = request.cases.map((entry) => entry.title);
  return request.rulesPage
    .split("\n")
    .flatMap((line) => servedSpellingsOn({ line }))
    .filter((spelling) => !titles.includes(spelling));
};

const RECIPE_HEADING =/^#{3,4} (.+)$/;

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

export const recipeReasonsOnPage = (request: { readonly text: string }): readonly PageReason[] =>
  request.text.split("\n").reduce<ReasonReading>(reasonReadingAfter, { title: undefined, reasons: [] }).reasons;

const reasonFitOf = (request: { readonly recipe: Recipe; readonly page: readonly PageReason[] }): "fits" | "differs" => {
  const onPage = request.page.find((entry) => entry.title === request.recipe.title);
  return onPage !== undefined && onPage.reason.text === request.recipe.reason.text && onPage.reason.standing === request.recipe.reason.standing
    ? "fits"
    : "differs";
};

export const proposedReasonsOf = (request: { readonly recipes: readonly Recipe[] }): readonly string[] =>
  request.recipes.filter((recipe) => recipe.reason.standing === "proposed").map((recipe) => recipe.name);

export const reasonMismatchesOf = (request: { readonly recipes: readonly Recipe[]; readonly page: readonly PageReason[] }): readonly string[] =>
  request.recipes.filter((recipe) => reasonFitOf({ recipe, page: request.page }) === "differs").map((recipe) => recipe.name);

export type PageOwes = { readonly title: string; readonly principles: readonly string[]; readonly rules: readonly string[] };

export type ProseLink = { readonly sentence: string; readonly cases: readonly string[] };

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

export const owesOnPages = (request: { readonly casesPage: string; readonly rulesPage: string; readonly links: readonly ProseLink[] }): readonly PageOwes[] => {
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

export const unlinkedCaseSentencesOn = (request: { readonly pages: readonly string[]; readonly links: readonly ProseLink[] }): readonly string[] => {
  const titles = ruleTitlesOn(request);
  return request.pages
    .flatMap((page) => page.split("\n").filter((line) => lineKindOf({ line }) === "prose"))
    .flatMap((paragraph) => sentencesOf({ paragraph }))
    .filter((sentence) => sentence.includes(CASE_SENTENCE) && titles.some((title) => sentence.includes(title)))
    .filter((sentence) => !request.links.some((link) => link.sentence === sentence));
};

export const missingLinkSentencesOn = (request: { readonly pages: readonly string[]; readonly links: readonly ProseLink[] }): readonly string[] =>
  request.links.filter((link) => !request.pages.some((page) => page.includes(link.sentence))).map((link) => link.sentence);

export const owesOfCatalogue = (request: { readonly catalogue: Pick<SymptomCatalogue, "cases"> }): readonly PageOwes[] =>
  request.catalogue.cases.map((entry) => ({
    title: entry.title,
    principles: entry.owes.flatMap((point) => (point.kind === "principle" ? [point.principle.name] : [])),
    rules: entry.owes.flatMap((point) => (point.kind === "rule" ? [point.rule.title] : [])),
  }));

export type UnowedPointer = { readonly symptom: string; readonly case: string; readonly pointer: string };

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

export const unowedPointersOf = (request: { readonly catalogue: { readonly symptoms: readonly IndicatingSymptom[] } }): readonly UnowedPointer[] =>
  request.catalogue.symptoms.flatMap((symptom) => symptom.mayIndicate.flatMap((indication) => unowedOf({ symptom, indication })));

const PARENTHETICAL = /\s*\([^)]*\)/g;

const caseNameOfTitle = (request: { readonly title: string }): string =>
  request.title
    .replace(PARENTHETICAL, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const caseNamesOffTheirTitles = (request: { readonly cases: readonly Pick<Case, "name" | "title">[] }): readonly string[] =>
  request.cases.filter((entry) => entry.name !== caseNameOfTitle({ title: entry.title })).map((entry) => entry.name);
