import type { LoadFailure } from "../src/infrastructure/command-line/load-failure.ts";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../src/infrastructure/node/path-port.ts";
import { IMPORTED_PARTY_SYMPTOMS, RUNTIME_REACH } from "../src/domain/records/answering/record-reach.ts";
import { type DisciplineFile, readDisciplineFile } from "../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { checkAddressOf, checkAt, checksOf } from "../src/domain/language-layer/check-address.ts";
import type { Check, SymptomCatalogue } from "../src/domain/language-layer/symptom-catalogue.ts";
import { type CatalogueGuide, symptomNoteLineOf } from "../src/infrastructure/printed-report/symptoms/symptom-notes.ts";
import type { AbsolutePath } from "../src/infrastructure/content-files/absolute-path.ts";
import { clauseAddressText } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import type { Result } from "../src/domain/result.ts";

export type CatalogueCoverage = {
  readonly uncatalogued: readonly string[];
  readonly unknown: readonly string[];
  readonly unreadable: readonly LoadFailure[];
};

export type CheckCoverage = {
  readonly unchecked: readonly string[];
  readonly unmechanical: readonly string[];
  readonly engineMismatches: readonly string[];
};

export type CheckAddressRow = { readonly address: string; readonly clause: string };

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

export const checkCoverageOf = (
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

export const checkAddressTableOf = (request: { readonly catalogue: SymptomCatalogue }): readonly CheckAddressRow[] =>
  request.catalogue.checks.map((check) => ({ address: checkAddressOf({ check }), clause: clauseAddressText({ address: check.clause }) }));

const resolutionOf = (request: { readonly catalogue: SymptomCatalogue; readonly check: Check }): "resolves" | "elsewhere" => {
  const atAddress = checkAt({ catalogue: request.catalogue, address: checkAddressOf({ check: request.check }) });
  return atAddress.found === "check" && atAddress.check === request.check ? "resolves" : "elsewhere";
};

export const unresolvedAddressesOf = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] => {
  const { catalogue } = request;
  const fromChecks = catalogue.checks.filter((check) => resolutionOf({ catalogue, check }) === "elsewhere");
  const fromClauses = catalogue.clauses.flatMap(({ clause }) =>
    checksOf({ catalogue, clause }).filter((check) => resolutionOf({ catalogue, check }) === "elsewhere"),
  );
  return [...new Set([...fromChecks, ...fromClauses].map((check) => checkAddressOf({ check })))];
};

export const catalogueCoverageOf = (
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

export const formSectionsOf = (request: { readonly catalogue: SymptomCatalogue; readonly clause: string }): readonly string[] =>
  request.catalogue.clauses
    .filter(({ clause }) => clauseAddressText({ address: clause }) === request.clause)
    .flatMap(({ sight }) => (sight.kind === "symptom-by-form" ? sight.forms.map((form) => form.section) : []));

export const symptomNamesOf = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] =>
  request.catalogue.symptoms.map((symptom) => symptom.name);

const NAMED_BY_RECORD_REACH: readonly string[] = [...IMPORTED_PARTY_SYMPTOMS, ...Object.values(RUNTIME_REACH).flat()];

export const symptomsNamedByRecordReachButNotCatalogued = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] => {
  const catalogued = symptomNamesOf(request);
  return NAMED_BY_RECORD_REACH.filter((name) => !catalogued.includes(name));
};

export const correctUseNotesOf = (request: { readonly guide: CatalogueGuide }): readonly string[] =>
  request.guide.catalogue.symptoms
    .filter((symptom) => symptom.correctUses.length > 0)
    .map((symptom) => symptomNoteLineOf({ ...request.guide, symptom }));
