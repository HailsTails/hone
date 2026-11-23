import type {
  Finding,
  GovernedRun,
  AttributedCheckException,
  CheckFinding,
} from "../../../domain/finding/governance.ts";
import {
  checkNamesOf,
  type CheckAddressText,
} from "../../../domain/language-layer/check-address-text.ts";
import { checkAddressOf, checkAt } from "../../../domain/language-layer/check-address.ts";
import { checksOfClause } from "../../../domain/language-layer/clause-checks.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText, sameClauseAddress } from "../../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { CheckHit, CheckNativeException } from "../../../domain/runner/check-observations.ts";
import type { AnsweredFile } from "../../../domain/runner/checks-run-report.ts";
import type { NativeException } from "../../../domain/runner/runner-result-types.ts";
import { catalogueOf, type RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { SelectedClause } from "../../../domain/settings/selection/selection.ts";
import type { EngineFindings, EnginePassFailure } from "../../ports/upgrade/engine-pass.ts";

type VersionOneNames = ReadonlyMap<EngineId, ReadonlyMap<CheckAddressText, ClauseAddress>>;

type CheckEngineObservations = {
  readonly mechanism: EngineId;
  readonly hits: readonly CheckHit[];
  readonly nativeExceptions: readonly CheckNativeException[];
  readonly coverableKinds: GovernedRun["coverableKinds"];
};

const refused = (detail: string): Result<never, EnginePassFailure> => ({
  outcome: "failed",
  error: { kind: "version-one-run-failed", detail },
});

export const versionOneNamesOf = (request: {
  readonly selected: readonly SelectedClause[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): Result<VersionOneNames, EnginePassFailure> => {
  const names = new Map<EngineId, Map<CheckAddressText, ClauseAddress>>();
  for (const { address, mechanism } of request.selected) {
    const checks = checksOfClause({ catalogues: request.catalogues, clause: address });
    if (checks.length === 0) {
      return refused(`${clauseAddressText({ address })} maps to no check`);
    }
    const engineNames = names.get(mechanism) ?? new Map<CheckAddressText, ClauseAddress>();
    for (const check of checks) {
      const name = checkAddressOf({ check });
      if (engineNames.has(name)) {
        return refused(`${name} maps to more than one selected clause on ${mechanism}`);
      }
      engineNames.set(name, address);
    }
    names.set(mechanism, engineNames);
  }
  return { outcome: "ok", value: names };
};

const clauseFor = (request: {
  readonly names: VersionOneNames;
  readonly mechanism: EngineId;
  readonly check: CheckAddressText;
}): Result<ClauseAddress, EnginePassFailure> => {
  const clause = request.names.get(request.mechanism)?.get(request.check);
  return clause === undefined
    ? refused(
        `${request.mechanism} reported ${request.check} without a selected version one clause`,
      )
    : { outcome: "ok", value: clause };
};

const versionOneFinding = (request: {
  readonly names: VersionOneNames;
  readonly mechanism: EngineId;
  readonly hit: CheckHit;
}): Result<Finding, EnginePassFailure> => {
  const { check, ...observed } = request.hit;
  const clause = clauseFor({ ...request, check });
  return clause.outcome === "failed"
    ? clause
    : {
        outcome: "ok",
        value: { ...observed, clause: clause.value, mechanism: request.mechanism },
      };
};

const versionOneException = (request: {
  readonly names: VersionOneNames;
  readonly mechanism: EngineId;
  readonly native: CheckNativeException;
}): Result<NativeException, EnginePassFailure> => {
  const { check, ...native } = request.native;
  const clause = clauseFor({ ...request, check });
  if (clause.outcome === "failed") return clause;
  return {
    outcome: "ok",
    value:
      native.kind === "inline-disable"
        ? {
            ...native,
            clause: clause.value,
            reach: native.reach === "one-check" ? "one-clause" : "every-selected-clause",
          }
        : { ...native, clause: clause.value },
  };
};

const versionOneRun = (request: {
  readonly names: VersionOneNames;
  readonly run: CheckEngineObservations;
}): Result<
  { readonly findings: readonly Finding[]; readonly run: GovernedRun },
  EnginePassFailure
> => {
  const { names, run } = request;
  const { mechanism, coverableKinds } = run;
  const findings = everyOk({
    entries: run.hits,
    resolve: (hit) => versionOneFinding({ names, mechanism, hit }),
  });
  if (findings.outcome === "failed") return findings;
  const exceptions = everyOk({
    entries: run.nativeExceptions,
    resolve: (native) => versionOneException({ names, mechanism, native }),
  });
  return exceptions.outcome === "failed"
    ? exceptions
    : {
        outcome: "ok",
        value: {
          findings: findings.value,
          run: { mechanism, coverableKinds, nativeExceptions: exceptions.value },
        },
      };
};

export const versionOneObservationsOf = (request: {
  readonly names: VersionOneNames;
  readonly runs: readonly CheckEngineObservations[];
}): Result<EngineFindings, EnginePassFailure> => {
  const readings = everyOk({
    entries: request.runs,
    resolve: (run) => versionOneRun({ names: request.names, run }),
  });
  return readings.outcome === "failed"
    ? readings
    : {
        outcome: "ok",
        value: {
          findings: readings.value.flatMap(({ findings }) => findings),
          runs: readings.value.map(({ run }) => run),
        },
      };
};

export const versionOneAnsweredFilesOf = (request: {
  readonly names: VersionOneNames;
  readonly records: readonly ExceptionRecord[];
}): readonly AnsweredFile[] =>
  request.records.flatMap((record) => {
    if (record.kind === "clause-wide-carve-out") return [];
    const bindings = request.names.get(record.mechanism);
    if (bindings === undefined) return [];
    return [...bindings].flatMap(([address, clause]) => {
      if (sameClauseAddress({ left: record.clause, right: clause }) !== "same") return [];
      const names = checkNamesOf({ text: address });
      return names === undefined
        ? []
        : [
            {
              ruleSet: record.clause.ruleSet,
              symptom: names.symptom,
              check: names.check,
              file: record.file,
            },
          ];
    });
  });

export const versionOneClauseAt = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly observation: CheckFinding | AttributedCheckException;
}): ClauseAddress | undefined => {
  const { observation, catalogues } = request;
  const candidates = catalogues.flatMap(({ catalogue }) => {
    const found = checkAt({ catalogue, address: observation.check });
    return found.found === "check" &&
      found.check.clause !== undefined &&
      found.check.engines.some(({ name }) => name === observation.mechanism)
      ? [found.check.clause]
      : [];
  });
  const [only, ...others] = candidates;
  return others.length === 0 ? only : undefined;
};
