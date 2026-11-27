import type { CheckAddressText } from "../../language-layer/check-address-text.ts";
import { checkAddressOf } from "../../language-layer/check-address.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import type { OwnedName } from "../../rule-set/rule-set-identity.ts";
import type { CheckMeasurement, CheckNativeException } from "../../runner/check-observations.ts";
import { SETTINGS_FILE_NAME } from "../../settings/settings-file.ts";
import type { Debt, RecordsReading } from "../hone-records/hone-record.ts";

type ComparisonScope =
  | "base-unavailable"
  | "base-refused"
  | "settings-changed"
  | "projection-unmeasured"
  | "no-checks"
  | "external-checks";

type PairProblem = "base-count-missing" | "head-record-changed" | "unmeasured" | "suppressed";

export type DebtComparisonIssue =
  | { readonly kind: ComparisonScope }
  | { readonly kind: "coverage-unavailable"; readonly engines: readonly EngineId[] }
  | { readonly kind: "whole-symptom"; readonly file: RepoPath; readonly symptom: string }
  | (CheckMeasurement & { readonly kind: PairProblem })
  | (CheckMeasurement & { readonly kind: "uncovered"; readonly observed: number })
  | (CheckMeasurement & {
      readonly kind: "increased";
      readonly ceiling: number;
      readonly observed: number;
    });

export type DebtComparison = {
  readonly revision: string | undefined;
  readonly issues: readonly DebtComparisonIssue[];
};

type ScopedComparison = {
  readonly kind: "scoped";
  readonly pairs: readonly CheckMeasurement[];
  readonly inapplicable: readonly CheckMeasurement[];
};

type ComparisonCoverage =
  | ScopedComparison
  | { readonly kind: "scope-unavailable"; readonly engines: readonly EngineId[] };

export type DebtComparisonEvidence = Pick<RecordsReading, "base"> & {
  readonly ruleSets: readonly OwnedName["ruleSet"][];
  readonly coverage: ComparisonCoverage;
  readonly measured: readonly CheckMeasurement[];
  readonly exceptions: readonly CheckNativeException[];
  readonly projection: "current" | "unmeasured";
};

type Comparing = DebtComparisonEvidence &
  Pick<RecordsReading, "records"> & {
    readonly touched: TouchedSet;
    readonly findings: readonly CheckMeasurement[];
    readonly debtFindings: readonly CheckMeasurement[];
  };

type CountedPlace = CheckMeasurement & { readonly findings: number | undefined };

const mapPairToKey = ({ check, file }: CheckMeasurement): string => `${check}:${file}`;

const mapDebtToCountedPlace = (debt: Debt): readonly CountedPlace[] =>
  debt.reach.reaches === "one-check"
    ? [
        {
          check: checkAddressOf({ check: debt.reach.check }),
          file: debt.file,
          findings: debt.findings,
        },
      ]
    : [];

const listWholeSymptomDebt = (debt: Debt): readonly DebtComparisonIssue[] =>
  debt.reach.reaches === "whole-symptom"
    ? [{ kind: "whole-symptom", file: debt.file, symptom: debt.symptom.name }]
    : [];

const compareMeasuredCount = (request: {
  readonly pair: CheckMeasurement;
  readonly counted: ReadonlyMap<string, CountedPlace>;
  readonly observed: ReadonlyMap<string, readonly CheckMeasurement[]>;
  readonly measured: ReadonlySet<string>;
  readonly inapplicable: ReadonlySet<string>;
  readonly found: ReadonlySet<string>;
  readonly suppressed: ReadonlySet<string>;
  readonly suppressedChecks: ReadonlySet<CheckAddressText>;
}): readonly DebtComparisonIssue[] => {
  const { pair } = request;
  const address = mapPairToKey(pair);
  const recorded = request.counted.get(address);
  if (request.suppressed.has(address) || request.suppressedChecks.has(pair.check)) {
    return [{ ...pair, kind: "suppressed" }];
  }
  if (request.inapplicable.has(address)) {
    return request.found.has(address) || request.measured.has(address)
      ? [{ ...pair, kind: "unmeasured" }]
      : [];
  }
  if (recorded !== undefined && recorded.findings === undefined) {
    return [{ ...pair, kind: "base-count-missing" }];
  }
  if (!request.measured.has(address)) {
    return [{ ...pair, kind: "unmeasured" }];
  }
  const ceiling = recorded?.findings;
  const observed = request.observed.get(address)?.length ?? 0;
  if (ceiling === undefined)
    return observed === 0 ? [] : [{ ...pair, kind: "uncovered", observed }];
  return observed > ceiling ? [{ ...pair, kind: "increased", ceiling, observed }] : [];
};

const compareMeasuredDebt = (
  request: Comparing & {
    readonly base: Extract<Comparing["base"], { readonly measured: "yes" }>;
    readonly coverage: ScopedComparison;
  },
): readonly DebtComparisonIssue[] => {
  const baseDebts = request.base.placements.flatMap(({ record }) =>
    record.kind === "debt" ? [record] : [],
  );
  const currentDebts = request.records.flatMap(({ record }) =>
    record.kind === "debt" ? [record] : [],
  );
  const basePlaces = baseDebts.flatMap(mapDebtToCountedPlace);
  const counted = new Map(basePlaces.map((pair) => [mapPairToKey(pair), pair]));
  if (counted.size !== basePlaces.length) return [{ kind: "base-refused" }];
  const exceptionPlaces = request.exceptions.flatMap((exception) =>
    "file" in exception ? [exception] : [],
  );
  const compared = new Map(
    [...basePlaces, ...request.findings, ...request.coverage.pairs, ...exceptionPlaces].map(
      ({ check, file }) => {
        const pair = { check, file };
        return [mapPairToKey(pair), pair];
      },
    ),
  );
  const measured = new Set(request.measured.map(mapPairToKey));
  const inapplicable = new Set(request.coverage.inapplicable.map(mapPairToKey));
  const found = new Set(request.findings.map(mapPairToKey));
  const observed = Map.groupBy(request.debtFindings, mapPairToKey);
  const suppressed = new Set(exceptionPlaces.map(mapPairToKey));
  const suppressedChecks = new Set(
    request.exceptions.flatMap((exception) => ("file" in exception ? [] : [exception.check])),
  );
  return [
    ...baseDebts.flatMap(listWholeSymptomDebt),
    ...currentDebts.flatMap(listWholeSymptomDebt),
    ...currentDebts
      .flatMap(mapDebtToCountedPlace)
      .flatMap(({ check, file, findings }): readonly DebtComparisonIssue[] => {
        const base = counted.get(mapPairToKey({ check, file }));
        return base !== undefined && base.findings === findings
          ? []
          : [{ check, file, kind: "head-record-changed" }];
      }),
    ...[...compared.values()].flatMap((pair) =>
      compareMeasuredCount({
        pair,
        counted,
        observed,
        measured,
        inapplicable,
        found,
        suppressed,
        suppressedChecks,
      }),
    ),
  ];
};

export const compareDebt = (request: Comparing): DebtComparison => {
  const { base, touched } = request;
  if (touched.measured !== "pinned-ancestor") {
    const revision =
      touched.measured === "no" && touched.base.state === "git-failed"
        ? touched.base.revision
        : undefined;
    return { revision, issues: [{ kind: "base-unavailable" }] };
  }
  const revision = touched.landingRevision;
  if (base.measured === "no") return { revision, issues: [{ kind: "base-unavailable" }] };
  const issues: DebtComparisonIssue[] = [];
  if (touched.paths.has(repoPathOf(SETTINGS_FILE_NAME))) issues.push({ kind: "settings-changed" });
  if (request.projection === "unmeasured") issues.push({ kind: "projection-unmeasured" });
  if (request.ruleSets.length === 0) issues.push({ kind: "no-checks" });
  if (request.ruleSets.some((ruleSet) => typeof ruleSet === "object"))
    issues.push({ kind: "external-checks" });
  if (base.measured === "partial") {
    return { revision, issues: [{ kind: "base-refused" }, ...issues] };
  }
  const { coverage } = request;
  if (coverage.kind === "scope-unavailable") {
    return {
      revision,
      issues: [...issues, { kind: "coverage-unavailable", engines: coverage.engines }],
    };
  }
  return {
    revision,
    issues: issues.length === 0 ? compareMeasuredDebt({ ...request, base, coverage }) : issues,
  };
};
