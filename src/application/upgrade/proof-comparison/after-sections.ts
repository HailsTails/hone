import type { CheckFinding } from "../../../domain/finding/governance.ts";
import {
  checkAddressOf,
  qualifiedCheckAddressOf,
} from "../../../domain/language-layer/check-address.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import { runVerdictOf } from "../../../domain/report/report-sections.ts";
import type { RunAssessment, RunReport } from "../../../domain/report/run-report.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { versionOneClauseAt } from "../record-answers/version-one-observations.ts";
import { answeredKeyOf, findingKeyOf, nativeReadingKeyOf } from "./before-sections.ts";
import { joinedKey, type SectionKeys, uniqueKeys } from "./section-keys.ts";

const unknownCheckKeyOf = (request: { readonly finding: CheckFinding }): string =>
  joinedKey({ parts: ["unknown-check", request.finding.check] });

const clauseTextOfFinding = (request: {
  readonly finding: CheckFinding;
  readonly catalogues: readonly RuleSetCatalogue[];
}): string => {
  const { finding, catalogues } = request;
  const mapped = versionOneClauseAt({ catalogues, observation: finding });
  return mapped === undefined
    ? unknownCheckKeyOf({ finding })
    : clauseAddressText({ address: mapped });
};

const clauseTextOfCheck = (request: {
  readonly check: Check;
  readonly clauses: ReadonlyMap<string, ClauseAddress>;
}): string => {
  const mapped = request.check.clause ?? request.clauses.get(qualifiedCheckAddressOf(request));
  return mapped === undefined ? checkAddressOf(request) : clauseAddressText({ address: mapped });
};

const recordFileKeyOf = (request: { readonly placed: PlacedRecord }): string =>
  "file" in request.placed.record ? request.placed.record.file : request.placed.record.kind;

const assessmentKeyOf = (request: { readonly note: RunAssessment }): string => {
  const { note } = request;
  switch (note.concern) {
    case "forfeiture":
    case "carried-standing":
      return joinedKey({ parts: [note.concern, note.assessedBy] });
    case "nested-projection":
      return joinedKey({ parts: [note.concern, note.engine.name, ...note.folders] });
  }
};

export const afterSectionsOf = (request: {
  readonly report: RunReport;
  readonly catalogues: readonly RuleSetCatalogue[];
}): SectionKeys => {
  const { report, catalogues } = request;
  const clauses = new Map<string, ClauseAddress>();
  for (const { catalogue } of catalogues) {
    for (const check of catalogue.checks) {
      if (check.clause !== undefined) clauses.set(qualifiedCheckAddressOf({ check }), check.clause);
    }
  }
  return {
    excluded: report.excluded,
    findings: report.findings.map((finding) =>
      findingKeyOf({ finding, clauseText: clauseTextOfFinding({ finding, catalogues }) }),
    ),
    answered: report.answered.map(({ finding, by }) =>
      answeredKeyOf({
        findingKey: findingKeyOf({
          finding,
          clauseText: clauseTextOfFinding({ finding, catalogues }),
        }),
        kinds: by.map((placed) => placed.record.kind),
      }),
    ),
    unrecorded: report.unrecorded.map((exception) => {
      const mapped = versionOneClauseAt({ catalogues, observation: exception });
      return nativeReadingKeyOf({
        exception,
        clauseText: mapped === undefined ? exception.check : clauseAddressText({ address: mapped }),
      });
    }),
    misnamed: report.misnamed.map(({ kind, ruleId, file, line }) =>
      joinedKey({ parts: [kind, ruleId, file, line] }),
    ),
    paid: report.paid.map(({ debt }) => joinedKey({ parts: [debt.place.file, debt.place.index] })),
    stale: report.stale.map(({ placed }) => recordFileKeyOf({ placed })),
    forfeited: report.forfeited.map((placed) => recordFileKeyOf({ placed })),
    "doubly-held": [],
    "invalid-records": report.refused.map(({ place }) =>
      joinedKey({ parts: [place.file, place.index] }),
    ),
    "not-adopted": uniqueKeys({
      keys: report["not-adopted"].map((check) => clauseTextOfCheck({ check, clauses })),
    }),
    "not-run": uniqueKeys({
      keys: report["not-run"].map((check) => clauseTextOfCheck({ check, clauses })),
    }),
    editions: uniqueKeys({
      keys: report.editions.map(({ check, engine, edition, latest }) =>
        joinedKey({ parts: [clauseTextOfCheck({ check, clauses }), engine.name, edition, latest] }),
      ),
    }),
    unmeasured: report.unmeasured.map((unmeasured) =>
      unmeasured.kind === "engine-not-run"
        ? joinedKey({ parts: [unmeasured.engine.name, "not-run", unmeasured.projection] })
        : unmeasured.kind,
    ),
    "projection-problems": report["projection-problems"].map((problem) =>
      joinedKey({
        parts: [
          problem.scope,
          problem.engine.name,
          problem.state,
          problem.scope === "slice" ? problem.slice : "",
        ],
      }),
    ),
    assessment: report.assessment.map((note) => assessmentKeyOf({ note })),
    verdict: [runVerdictOf({ report })],
  };
};
