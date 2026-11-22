import type { Finding } from "../../../domain/finding/governance.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { sitesOfFinding } from "../../../domain/records/debt/debt-sites.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { GovernanceResult } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { Result } from "../../../domain/result.ts";
import { clauseAddressText, sameClauseAddress } from "../../../domain/rule-set/clause-address.ts";
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
  readonly catalogues: readonly RuleSetCatalogue[];
};

const attributionFailureOf = (request: { readonly finding: Finding }): OracleFailure => ({
  kind: "finding-not-attributable",
  clause: clauseAddressText({ address: request.finding.clause }),
  file: request.finding.file,
  check: request.finding.check,
});

const checksOfFinding = (request: {
  readonly finding: Finding;
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly Check[] => {
  const { finding, catalogues } = request;
  const catalogue = catalogueOf({ catalogues, ruleSet: finding.clause.ruleSet });
  return catalogue === undefined
    ? []
    : sitesOfFinding({ catalogue, finding }).flatMap((site) =>
        site.check.found === "check" ? [site.check.check] : [],
      );
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

const carveOutAnsweredOf = (request: {
  readonly record: FileCarveOutRecord;
  readonly governed: GovernanceResult;
  readonly catalogues: readonly RuleSetCatalogue[];
}): Result<CarveOutAnswered, OracleFailure> => {
  const { record, governed, catalogues } = request;
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
      answer: { credit: governed.stale.includes(record) ? "nothing" : "suppression-only" },
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
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly Result<RecordAnswered, OracleFailure>[] => {
  const { record, governed, catalogues } = request;
  switch (record.kind) {
    case "file-carve-out":
      return [carveOutAnsweredOf({ record, governed, catalogues })];
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
    answeredOf({ record, governed: request.governed, catalogues: request.catalogues }),
  );
  const failed = answered.find((each) => each.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: answered.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
    }
  );
};
