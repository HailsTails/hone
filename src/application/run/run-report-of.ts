import type { VersionTwoSelection } from "../../domain/settings/selection/selection.ts";
import type { Finding } from "../../domain/finding/governance.ts";
import { type Answering, answerFindings, type RaisedFinding } from "../../domain/records/answering/answering.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import { carriedListingOf } from "../../domain/records/hone-records/record-listings.ts";
import type { PartyReport } from "../../domain/records/answering/record-reach.ts";
import { carriedJudgementOf, recordsUnmeasuredOf } from "../../domain/records/measurement/records-unmeasured.ts";
import { findingSiteOf } from "../../domain/finding/check-site.ts";
import type { AssessmentLeftElsewhere, RunReport } from "../../domain/report/run-report.ts";
import type { SettingsNote } from "../../domain/settings/settings-note.ts";
import { checkAddressOf } from "../../domain/language-layer/check-address.ts";
import { checkOfFinding } from "../../domain/finding/finding-check.ts";
import type { Check, Symptom, SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import { baseJudgementOf, type TouchedSet } from "../../domain/repository/touched-set.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { EngineRun } from "../ports/engine/engine-run.ts";
import { engineProblemsOf, engineUnmeasuredOf, runMeasurementsOf } from "./engines/engine-states.ts";
import { checksOfClauses, editionsOf } from "../../domain/settings/selection/selection-checks.ts";

export type RunReportRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly selection: VersionTwoSelection;
  readonly excluded: readonly RepoPath[];
  readonly notes: readonly SettingsNote[];
  readonly records: RecordsReading;
  readonly touched: TouchedSet;
  readonly runs: readonly EngineRun[];
  readonly tracked: readonly RepoPath[];
  readonly available: readonly Check[];
};

const namingItsCheck = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): Finding => {
  const resolved = checkOfFinding(request);
  return resolved.resolved === "check" ? { ...request.finding, check: checkAddressOf({ check: resolved.check }) } : request.finding;
};

const findingsOf = (request: { readonly catalogue: SymptomCatalogue; readonly runs: readonly EngineRun[] }): readonly Finding[] =>
  request.runs.flatMap((run) => run.hits.map((hit) => namingItsCheck({ catalogue: request.catalogue, finding: { ...hit, mechanism: run.mechanism } })));

const partyOf = (request: { readonly finding: Finding }): PartyReport =>
  request.finding.importSpecifier === undefined ? { reported: "not-reported" } : { reported: "specifier", specifier: request.finding.importSpecifier };

const answeringOf = (request: RunReportRequest): Answering => {
  const raised: readonly RaisedFinding[] = findingsOf(request).map((finding) => ({ finding, party: partyOf({ finding }) }));
  return answerFindings({ catalogue: request.catalogue, records: request.records.records, findings: raised, touched: request.touched, runs: request.runs, measurements: runMeasurementsOf({ runs: request.runs, selected: request.selection.selected, tracked: request.tracked, excluded: request.excluded }) });
};

const symptomsOf = (request: { readonly catalogue: SymptomCatalogue; readonly findings: readonly Finding[] }): readonly Symptom[] => {
  const named = request.findings.flatMap((finding) => {
    const site = findingSiteOf({ catalogue: request.catalogue, finding });
    return site.sited === "check" ? [site.check.symptom] : [];
  });
  return named.filter((symptom, index) => named.findIndex((earlier) => earlier.name === symptom.name) === index);
};

const forfeitureLeftElsewhereOf = (request: RunReportRequest): readonly AssessmentLeftElsewhere[] =>
  baseJudgementOf({ touched: request.touched }) === "left-to-another-run"
    ? [{ concern: "forfeiture", assessedBy: "elsewhere", debts: request.records.records.filter((placed) => placed.record.kind === "debt").length }]
    : [];

const carriedStandingLeftElsewhereOf = (request: RunReportRequest): readonly AssessmentLeftElsewhere[] => {
  const judgement = carriedJudgementOf({ records: request.records.records, base: request.records.base, touched: request.touched });
  return judgement.judgement === "left-elsewhere" ? [{ concern: "carried-standing", assessedBy: "elsewhere", carried: judgement.carried }] : [];
};

const assessmentOf = (request: RunReportRequest): readonly AssessmentLeftElsewhere[] => [
  ...forfeitureLeftElsewhereOf(request),
  ...carriedStandingLeftElsewhereOf(request),
];

export const runReportOf = (request: RunReportRequest): RunReport => {
  const answering = answeringOf(request);
  const { catalogue, selection, records, runs } = request;
  return {
    excluded: request.excluded,
    "not-adopted": checksOfClauses({ catalogue, clauses: selection.notAdopted }),
    "not-run": checksOfClauses({ catalogue, clauses: selection.notRun }),
    editions: editionsOf({ catalogue, readings: selection.editions }),
    findings: answering.findings,
    answered: answering.answered,
    available: request.available,
    stale: answering.stale,
    forfeited: answering.forfeited,
    unrecorded: answering.unrecorded,
    misnamed: runs.flatMap((run) => run.misnamedRuleIds),
    paid: answering.paid,
    refused: records.refused,
    unmeasured: [...recordsUnmeasuredOf({ records: records.records, base: records.base, touched: request.touched }), ...engineUnmeasuredOf({ catalogue, runs, selected: selection.selected, tracked: request.tracked })],
    "projection-problems": engineProblemsOf({ catalogue, runs }),
    assessment: assessmentOf(request),
    "settings-notes": request.notes,
    "record-notes": records.notes,
    carried: carriedListingOf({ records: records.records }),
    symptoms: symptomsOf({ catalogue, findings: answering.findings }),
  };
};
