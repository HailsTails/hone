import { findingSiteOf } from "../../domain/finding/check-site.ts";
import type { CheckFinding } from "../../domain/finding/governance.ts";
import type {
  Check,
  Symptom,
  SymptomCatalogue,
} from "../../domain/language-layer/symptom-catalogue.ts";
import {
  type Answering,
  answerFindings,
  type RaisedFinding,
} from "../../domain/records/answering/answering.ts";
import type { PartyReport } from "../../domain/records/answering/record-reach.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import { carriedListingOf } from "../../domain/records/hone-records/record-listings.ts";
import {
  carriedJudgementOf,
  recordsUnmeasuredOf,
} from "../../domain/records/measurement/records-unmeasured.ts";
import type { AssessmentLeftElsewhere, RunReport } from "../../domain/report/run-report.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { baseJudgementOf, type TouchedSet } from "../../domain/repository/touched-set.ts";
import { sameOwnedName } from "../../domain/rule-set/rule-set-identity.ts";
import type { SettingsNote } from "../../domain/settings/settings-note.ts";
import type { NamedEngineRun } from "../ports/engine/engine-run.ts";
import {
  engineProblemsOf,
  engineUnmeasuredOf,
  runMeasurementsOf,
} from "./engines/engine-states.ts";
import type { NamedSettingsReading } from "./settings/read-settings.ts";

type ReportInputs = {
  readonly catalogue: SymptomCatalogue;
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
  readonly findings: readonly CheckFinding[];
}): readonly Symptom[] => {
  const named = request.findings.flatMap((finding) => {
    const site = findingSiteOf({ catalogue: request.catalogue, finding });
    return site.sited === "check" ? [site.check.symptom] : [];
  });
  return named.filter(
    (symptom, index) =>
      named.findIndex((earlier) => sameOwnedName({ left: earlier, right: symptom }) === "same") ===
      index,
  );
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

const assessmentOf = (request: ReportInputs): readonly AssessmentLeftElsewhere[] => [
  ...forfeitureLeftElsewhereOf(request),
  ...carriedStandingLeftElsewhereOf(request),
];

type ReportStatus = Pick<RunReport, "not-adopted" | "not-run" | "editions" | "projection-problems">;

const reportAfterAnswering = (
  request: ReportInputs & {
    readonly answering: Answering;
    readonly status: ReportStatus;
    readonly runs: readonly NamedEngineRun[];
    readonly selected: Parameters<typeof engineUnmeasuredOf>[0]["selected"];
  },
): RunReport => {
  const { answering, catalogue, records, runs } = request;
  return {
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
      }),
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
    symptoms: symptomsOf({ catalogue, findings: answering.findings }),
  };
};

export type RunReportRequest = ReportInputs & {
  readonly selection: NamedSettingsReading["selection"];
  readonly runs: readonly NamedEngineRun[];
};

export const namedRunReportOf = (request: RunReportRequest): RunReport => {
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
  });
  return reportAfterAnswering({ ...request, selected, answering, status });
};
