import { findingSiteOf } from "../../domain/finding/check-site.ts";
import type { CheckFinding } from "../../domain/finding/governance.ts";
import { gatheredOutcomes } from "../../domain/gathered-outcomes.ts";
import {
  mapAddressToSymptom,
  type RuleContent,
  type SymptomUnheld,
} from "../../domain/language-layer/rule-content.ts";
import type {
  Check,
  Symptom,
  SymptomAddress,
  SymptomCatalogue,
} from "../../domain/language-layer/symptom-catalogue.ts";
import {
  type Answering,
  answerFindings,
  filterFindingsForDebtComparison,
  type RaisedFinding,
} from "../../domain/records/answering/answering.ts";
import { compareDebt } from "../../domain/records/answering/debt-comparison.ts";
import type { PartyReport } from "../../domain/records/answering/record-reach.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import { carriedListingOf } from "../../domain/records/hone-records/record-listings.ts";
import type { RunMeasurements } from "../../domain/records/measurement/measured-at.ts";
import {
  carriedJudgementOf,
  recordsUnmeasuredOf,
} from "../../domain/records/measurement/records-unmeasured.ts";
import type {
  AssessmentLeftElsewhere,
  RunAssessment,
  RunReport,
} from "../../domain/report/run-report.ts";
import { excludeProjectionOutputs } from "../../domain/repository/projection-outputs.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { baseJudgementOf, type TouchedSet } from "../../domain/repository/touched-set.ts";
import type { Result } from "../../domain/result.ts";
import { sameOwnedName } from "../../domain/rule-set/rule-set-identity.ts";
import type { SettingsNote } from "../../domain/settings/settings-note.ts";
import type { NamedEngineRun } from "../ports/engine/engine-run.ts";
import { typescriptFilesOf } from "./checked-tree-of.ts";
import {
  engineProblemsOf,
  engineUnmeasuredOf,
  runMeasurementsOf,
} from "./engines/engine-states.ts";
import type { NamedSettingsReading } from "./settings/read-settings.ts";

type ReportInputs = {
  readonly catalogue: SymptomCatalogue;
  readonly content: RuleContent;
  readonly excluded: readonly RepoPath[];
  readonly notes: readonly SettingsNote[];
  readonly records: RecordsReading;
  readonly touched: TouchedSet;
  readonly tracked: readonly RepoPath[];
  readonly available: readonly Check[];
};

const partyOf = (request: { readonly finding: CheckFinding }): PartyReport =>
  request.finding.importSpecifier === undefined
    ? { reported: "not-reported" }
    : { reported: "specifier", specifier: request.finding.importSpecifier };

const symptomsOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly content: RuleContent;
  readonly findings: readonly CheckFinding[];
}): Result<readonly Symptom[], SymptomUnheld> => {
  const named = request.findings.flatMap((finding): readonly SymptomAddress[] => {
    const site = findingSiteOf({ catalogue: request.catalogue, finding });
    return site.sited === "check" ? [site.check.symptom] : [];
  });
  return gatheredOutcomes({
    outcomes: named
      .filter(
        (symptom, index) =>
          named.findIndex(
            (earlier) => sameOwnedName({ left: earlier, right: symptom }) === "same",
          ) === index,
      )
      .map((symptom): Result<readonly Symptom[], SymptomUnheld> => {
        const found = mapAddressToSymptom({ content: request.content, symptom });
        return found.outcome === "failed" ? found : { outcome: "ok", value: [found.value] };
      }),
  });
};

const forfeitureLeftElsewhereOf = (request: ReportInputs): readonly AssessmentLeftElsewhere[] =>
  baseJudgementOf({ touched: request.touched }) === "left-to-another-run"
    ? [
        {
          concern: "forfeiture",
          assessedBy: "elsewhere",
          debts: request.records.records.filter((placed) => placed.record.kind === "debt").length,
        },
      ]
    : [];

const carriedStandingLeftElsewhereOf = (
  request: ReportInputs,
): readonly AssessmentLeftElsewhere[] => {
  const judgement = carriedJudgementOf({
    records: request.records.records,
    base: request.records.base,
    touched: request.touched,
  });
  return judgement.judgement === "left-elsewhere"
    ? [{ concern: "carried-standing", assessedBy: "elsewhere", carried: judgement.carried }]
    : [];
};

const nestedProjectionAssessments = (runs: readonly NamedEngineRun[]): readonly RunAssessment[] =>
  runs.flatMap(({ mechanism, projection, measured, nestedConfigurations }) =>
    (projection === "current" || projection === "out-of-date") &&
    measured.length > 0 &&
    nestedConfigurations.length > 0
      ? [
          {
            concern: "nested-projection",
            engine: { name: mechanism },
            folders: nestedConfigurations,
          },
        ]
      : [],
  );

const assessmentOf = (
  request: ReportInputs & { readonly runs: readonly NamedEngineRun[] },
): readonly RunAssessment[] => [
  ...forfeitureLeftElsewhereOf(request),
  ...carriedStandingLeftElsewhereOf(request),
  ...nestedProjectionAssessments(request.runs),
];

type ReportStatus = Pick<RunReport, "not-adopted" | "not-run" | "editions" | "projection-problems">;

const reportAfterAnswering = (
  request: ReportInputs & {
    readonly answering: Answering;
    readonly status: ReportStatus;
    readonly compareDebt?: RunReportRequest["compareDebt"];
    readonly runs: readonly NamedEngineRun[];
    readonly selected: Parameters<typeof engineUnmeasuredOf>[0]["selected"];
  },
): Result<RunReport, SymptomUnheld> => {
  const { answering, catalogue, content, records, runs } = request;
  const symptoms = symptomsOf({ catalogue, content, findings: answering.findings });
  if (symptoms.outcome === "failed") {
    return symptoms;
  }
  const report: RunReport = {
    ...request.status,
    excluded: request.excluded,
    findings: answering.findings,
    answered: answering.answered,
    held: answering.held,
    available: request.available,
    stale: answering.stale,
    forfeited: answering.forfeited,
    unrecorded: answering.unrecorded,
    misnamed: runs.flatMap((run) => run.misnamedRuleIds),
    paid: answering.paid,
    refused: records.refused,
    unmeasured: [
      ...recordsUnmeasuredOf({
        records: records.records,
        base: records.base,
        touched: request.touched,
      }).filter(
        ({ kind }) => request.compareDebt === undefined || kind !== "forfeiture-unmeasured",
      ),
      ...engineUnmeasuredOf({
        catalogue,
        runs,
        selected: request.selected,
        tracked: request.tracked,
      }),
    ],
    assessment: assessmentOf(request),
    "settings-notes": request.notes,
    "record-notes": records.notes,
    carried: carriedListingOf({ records: records.records }),
    symptoms: symptoms.value,
  };
  return { outcome: "ok", value: report };
};

export type RunReportRequest = ReportInputs & {
  readonly selection: NamedSettingsReading["selection"];
  readonly compareDebt?: Pick<
    Parameters<typeof compareDebt>[0],
    "revision" | "checks" | "settings"
  >;
  readonly runs: readonly NamedEngineRun[];
};

const mapSelectionToComparisonScope = (
  request: RunReportRequest & {
    readonly selected: Parameters<typeof engineUnmeasuredOf>[0]["selected"];
  },
) => {
  const outputs = new Set(request.runs.flatMap(({ comparedOutputs }) => comparedOutputs ?? []));
  const typescript = typescriptFilesOf({ tracked: request.tracked });
  const candidates = new Map(
    request.runs.map(({ mechanism, candidateFiles }) => [
      mechanism,
      excludeProjectionOutputs({ files: candidateFiles ?? typescript, outputs }),
    ]),
  );
  const fallback = excludeProjectionOutputs({ files: typescript, outputs });
  return request.selected.flatMap(({ address: check, engine }) =>
    (candidates.get(engine) ?? fallback).map((file) => ({ check, file })),
  );
};

const compareReportedDebt = (
  request: RunReportRequest & {
    readonly compareDebt: NonNullable<RunReportRequest["compareDebt"]>;
    readonly report: RunReport;
    readonly answering: Answering;
    readonly selected: Parameters<typeof engineUnmeasuredOf>[0]["selected"];
    readonly findings: readonly RaisedFinding[];
    readonly measurements: RunMeasurements;
  },
): Result<RunReport, SymptomUnheld> => {
  const { records, selected, findings, answering, runs, measurements, report } = request;
  const debtFindings = filterFindingsForDebtComparison({
    ...request,
    findings,
    answered: answering.answered,
    landing: records.base.measured === "yes" ? (records.base.placements ?? []) : [],
  });
  if (debtFindings.outcome === "failed") return debtFindings;
  const debtComparison = compareDebt({
    ...request.compareDebt,
    ...records,
    touched: request.touched,
    selected: selected.map(({ address }) => address),
    scope: mapSelectionToComparisonScope({ ...request, selected }),
    findings: findings.map(({ finding }) => finding),
    debtFindings: debtFindings.value,
    inapplicable: runs.flatMap(({ inapplicable }) => inapplicable ?? []),
    measured: measurements.runs.flatMap(({ measured, selected: addresses }) => {
      const chosen = new Set(addresses);
      return measured.filter(({ check }) => chosen.has(check));
    }),
    exceptions: runs.flatMap(({ nativeExceptions }) => nativeExceptions),
    projection:
      report["projection-problems"].length === 0 && report.unmeasured.length === 0
        ? "current"
        : "unmeasured",
  });
  return { outcome: "ok", value: { ...report, debtComparison } };
};

export const namedRunReportOf = (request: RunReportRequest): Result<RunReport, SymptomUnheld> => {
  const { catalogue, records, runs, selection } = request;
  const selected = selection.selected.map(({ binding }) => binding);
  const status = {
    "not-adopted": selection.notAdopted.map(({ check }) => check),
    "not-run": selection.notRun.map(({ check }) => check),
    editions: selection.selected
      .filter(({ editions }) => editions.declared.length > 1)
      .map(({ check, binding, editions }) => ({
        check,
        engine: { name: binding.engine },
        edition: binding.edition,
        latest: editions.latest,
      })),
    "projection-problems": engineProblemsOf({ catalogue, runs }),
  };
  const findings = runs.flatMap(({ hits, mechanism }) =>
    hits.map((hit): RaisedFinding => {
      const finding = { ...hit, mechanism };
      return { finding, party: partyOf({ finding }) };
    }),
  );
  const measurements = runMeasurementsOf({ ...request, selected });
  const answering = answerFindings({
    ...request,
    records: records.records,
    findings,
    measurements,
    ...(request.compareDebt === undefined ? {} : { retainTouchedDebt: true }),
  });
  if (answering.outcome === "failed") return answering;
  const report = reportAfterAnswering({ ...request, selected, answering: answering.value, status });
  if (report.outcome === "failed" || request.compareDebt === undefined) return report;
  return compareReportedDebt({
    ...request,
    compareDebt: request.compareDebt,
    report: report.value,
    answering: answering.value,
    selected,
    findings,
    measurements,
  });
};
