import type { Finding, GovernedRun } from "../../../domain/finding/governance.ts";
import { checkNamedAt, checksOf } from "../../../domain/language-layer/check-address.ts";
import {
  type Check,
  type SymptomCatalogue,
  symptomReadingOf,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { GovernanceResult } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText, sameClauseAddress } from "../../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import { catalogueOf, type RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type {
  AuthorisedLocationRecord,
  CarveOutAnswered,
  FileCarveOutRecord,
  LocationAnswered,
  OracleFailure,
  RecordAnswered,
} from "../../ports/upgrade/record-answer-oracle.ts";

export type RecordAnswersRequest = {
  readonly records: readonly ExceptionRecord[];
  readonly governed: GovernanceResult;
  readonly runs: readonly GovernedRun[];
  readonly catalogues: readonly RuleSetCatalogue[];
};

const attributionFailureOf = (request: { readonly finding: Finding }): OracleFailure => ({
  kind: "finding-not-attributable",
  clause: clauseAddressText({ address: request.finding.clause }),
  file: request.finding.file,
  check: request.finding.check,
});

const measuredChecksOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly clause: ClauseAddress;
  readonly address: string | undefined;
  readonly mechanism: EngineId;
}): readonly Check[] => {
  const named = checkNamedAt(request);
  const checks =
    named.named === "unnamed" ? checksOf(request) : named.named === "check" ? [named.check] : [];
  return checks.filter(({ engines }) => engines.some(({ name }) => name === request.mechanism));
};

const checksOfFinding = (request: {
  readonly finding: Finding;
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly Check[] => {
  const { finding, catalogues } = request;
  const catalogue = catalogueOf({ catalogues, ruleSet: finding.clause.ruleSet });
  if (catalogue === undefined) return [];
  const measured = measuredChecksOf({
    catalogue,
    clause: finding.clause,
    address: finding.check,
    mechanism: finding.mechanism,
  });
  if (finding.check !== undefined) return measured;
  const reading = symptomReadingOf({ catalogue, finding });
  if (reading.reading !== "named") return [];
  const matches = measured.filter(({ symptom }) => symptom.name === reading.symptom.name);
  return matches.length === 1 ? matches : [];
};

const checksOfFindings = (request: {
  readonly findings: readonly Finding[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): Result<readonly Check[], OracleFailure> => {
  const sited = request.findings.map((finding) => ({
    finding,
    checks: checksOfFinding({ finding, catalogues: request.catalogues }),
  }));
  const unsited = sited.find(({ checks }) => checks.length === 0);
  return unsited === undefined
    ? { outcome: "ok", value: sited.flatMap(({ checks }) => checks) }
    : { outcome: "failed", error: attributionFailureOf({ finding: unsited.finding }) };
};

const doublyHeldFailureOf = (request: {
  readonly record: FileCarveOutRecord;
  readonly governed: GovernanceResult;
}): OracleFailure | undefined =>
  request.governed.doublyHeld.some(
    (pair) =>
      pair.file === request.record.file &&
      sameClauseAddress({ left: pair.clause, right: request.record.clause }) === "same",
  )
    ? {
        kind: "record-doubly-held",
        clause: clauseAddressText({ address: request.record.clause }),
        file: request.record.file,
      }
    : undefined;

const findingsExemptedBy = (request: {
  readonly record: ExceptionRecord;
  readonly governed: GovernanceResult;
}): readonly Finding[] =>
  request.governed.exempted
    .filter((exempted) => exempted.by.includes(request.record))
    .map((exempted) => exempted.finding);

const checksOfHeldSuppressions = (request: {
  readonly record: FileCarveOutRecord;
  readonly runs: readonly GovernedRun[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly Check[] => {
  const { record, runs, catalogues } = request;
  const catalogue = catalogueOf({ catalogues, ruleSet: record.clause.ruleSet });
  return catalogue === undefined
    ? []
    : runs
        .filter((run) => run.mechanism === record.mechanism)
        .flatMap((run) =>
          run.nativeExceptions
            .filter(
              (exception) =>
                exception.kind !== "config-override" &&
                exception.kind !== "command-line-option" &&
                run.coverableKinds.includes(exception.kind) &&
                exception.file === record.file &&
                sameClauseAddress({ left: exception.clause, right: record.clause }) === "same",
            )
            .flatMap((exception) =>
              measuredChecksOf({
                catalogue,
                clause: exception.clause,
                address: exception.check,
                mechanism: run.mechanism,
              }),
            ),
        );
};

const carveOutAnsweredOf = (request: {
  readonly record: FileCarveOutRecord;
  readonly governed: GovernanceResult;
  readonly runs: readonly GovernedRun[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): Result<CarveOutAnswered, OracleFailure> => {
  const { record, governed, runs, catalogues } = request;
  const doublyHeld = doublyHeldFailureOf({ record, governed });
  if (doublyHeld !== undefined) {
    return { outcome: "failed", error: doublyHeld };
  }
  const credited = findingsExemptedBy({ record, governed });
  if (credited.length > 0) {
    const checks = checksOfFindings({ findings: credited, catalogues });
    return checks.outcome === "failed"
      ? checks
      : {
          outcome: "ok",
          value: {
            kind: "file-carve-out",
            record,
            answer: { credit: "findings", checks: checks.value },
          },
        };
  }
  return {
    outcome: "ok",
    value: {
      kind: "file-carve-out",
      record,
      answer: governed.stale.includes(record)
        ? { credit: "nothing" }
        : {
            credit: "suppression-only",
            checks: checksOfHeldSuppressions({ record, runs, catalogues }),
          },
    },
  };
};

const locationAnsweredOf = (request: {
  readonly record: AuthorisedLocationRecord;
  readonly governed: GovernanceResult;
  readonly catalogues: readonly RuleSetCatalogue[];
}): Result<LocationAnswered, OracleFailure> => {
  const { record, governed, catalogues } = request;
  const credited = findingsExemptedBy({ record, governed });
  if (credited.length === 0) {
    return {
      outcome: "ok",
      value: { kind: "authorised-location", record, answer: { reach: "whole-clause" } },
    };
  }
  const checks = checksOfFindings({ findings: credited, catalogues });
  return checks.outcome === "failed"
    ? checks
    : {
        outcome: "ok",
        value: {
          kind: "authorised-location",
          record,
          answer: { reach: "answered-checks", checks: checks.value },
        },
      };
};

const answeredOf = (request: {
  readonly record: ExceptionRecord;
  readonly governed: GovernanceResult;
  readonly runs: readonly GovernedRun[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly Result<RecordAnswered, OracleFailure>[] => {
  const { record, governed, runs, catalogues } = request;
  switch (record.kind) {
    case "file-carve-out":
      return [carveOutAnsweredOf({ record, governed, runs, catalogues })];
    case "authorised-location":
      return [locationAnsweredOf({ record, governed, catalogues })];
    case "clause-wide-carve-out":
      return [];
  }
};

export const recordAnswersOf = (
  request: RecordAnswersRequest,
): Result<readonly RecordAnswered[], OracleFailure> => {
  const answered = request.records.flatMap((record) =>
    answeredOf({
      record,
      governed: request.governed,
      runs: request.runs,
      catalogues: request.catalogues,
    }),
  );
  const failed = answered.find((each) => each.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: answered.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
    }
  );
};
