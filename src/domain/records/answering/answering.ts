import { checkOfFinding } from "../../finding/finding-check.ts";
import type {
  AttributedCheckException,
  CheckFinding,
  NamedGovernedRun,
} from "../../finding/governance.ts";
import { gatheredOutcomes, listedOutcome } from "../../gathered-outcomes.ts";
import type { RuleContent, SymptomUnheld } from "../../language-layer/rule-content.ts";
import type { SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import type { Result } from "../../result.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import type { CheckNativeException } from "../../runner/check-observations.ts";
import { debtForfeitureAt } from "../debt/debt-forfeiture.ts";
import type { HoneRecord, PlacedRecord } from "../hone-records/hone-record.ts";
import {
  type MeasurementIndex,
  measurementIndexOf,
  measurementOf,
  type RunMeasurements,
} from "../measurement/measured-at.ts";
import {
  createResolvedSite,
  holdsAt,
  type PartyReport,
  placesReachedBy,
  type Site,
} from "./record-reach.ts";
import {
  placedInRecordOrder,
  type RecordsByPlace,
  recordsByPlaceOf,
  recordsReachingSites,
} from "./records-by-place.ts";

export type RaisedFinding = { readonly finding: CheckFinding; readonly party: PartyReport };

export type AnsweredFinding = {
  readonly finding: CheckFinding;
  readonly by: readonly PlacedRecord[];
};

export type HeldException = {
  readonly exception: Extract<AttributedCheckException, { readonly kind: "inline-disable" }>;
  readonly by: readonly PlacedRecord[];
};

export type PaidDebt = {
  readonly debt: PlacedRecord;
  readonly answeredBy: readonly PlacedRecord[];
};

export type StaleReason = "credited-nothing" | "file-gone" | "file-excluded";

export type StaleRecord = { readonly placed: PlacedRecord; readonly reason: StaleReason };

type DebtStanding = "answers-in-debts-place" | "answers-beside-debt";

type Catalogued = {
  readonly catalogue: SymptomCatalogue;
  readonly content: RuleContent<"recipes">;
};

export type AnsweringRequest = Catalogued & {
  readonly records: readonly PlacedRecord[];
  readonly findings: readonly RaisedFinding[];
  readonly touched: TouchedSet;
  readonly runs: readonly NamedGovernedRun[];
  readonly measurements: RunMeasurements;
};

export type Answering = {
  readonly findings: readonly CheckFinding[];
  readonly answered: readonly AnsweredFinding[];
  readonly held: readonly HeldException[];
  readonly stale: readonly StaleRecord[];
  readonly forfeited: readonly PlacedRecord[];
  readonly paid: readonly PaidDebt[];
  readonly unrecorded: readonly AttributedCheckException[];
};

const NOT_REPORTED: PartyReport = { reported: "not-reported" };

const holdersAt = (
  request: Catalogued & { readonly byPlace: RecordsByPlace; readonly sites: readonly Site[] },
): Result<readonly PlacedRecord[], SymptomUnheld> => {
  const sites = gatheredOutcomes({
    outcomes: request.sites.map((site) =>
      listedOutcome({ outcome: createResolvedSite({ site, content: request.content }) }),
    ),
  });
  if (sites.outcome === "failed") return sites;
  return {
    outcome: "ok",
    value: recordsReachingSites({ byPlace: request.byPlace, sites: sites.value }).filter((placed) =>
      sites.value.some(
        (site) =>
          holdsAt({ record: placed.record, site, catalogue: request.catalogue }) === "holds",
      ),
    ),
  };
};

const debtStandingOf = (request: { readonly record: HoneRecord }): DebtStanding => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "dependency-record":
      return "answers-beside-debt";
    case "deviation":
      return "answers-in-debts-place";
    case "authorised-location":
      return record.holding.held === "carried" && record.holding.standing === "unjudged"
        ? "answers-beside-debt"
        : "answers-in-debts-place";
  }
};

const answersInDebtsPlace = (request: {
  readonly records: readonly PlacedRecord[];
}): readonly PlacedRecord[] =>
  request.records.filter(
    (placed) => debtStandingOf({ record: placed.record }) === "answers-in-debts-place",
  );

const answerersOf = (request: {
  readonly holders: readonly PlacedRecord[];
}): readonly PlacedRecord[] =>
  answersInDebtsPlace({ records: request.holders }).length === 0
    ? request.holders
    : request.holders.filter((placed) => placed.record.kind !== "debt");

const answerersByDebt = (request: {
  readonly holdings: readonly (readonly PlacedRecord[])[];
}): ReadonlyMap<PlacedRecord, readonly { readonly answerers: readonly PlacedRecord[] }[]> =>
  Map.groupBy(
    request.holdings.flatMap((holders) => {
      const answerers = answerersOf({ holders });
      return holders
        .filter((placed) => placed.record.kind === "debt")
        .map((debt) => ({ debt, answerers }));
    }),
    ({ debt }) => debt,
  );

const paidDebts = (request: {
  readonly inForce: readonly PlacedRecord[];
  readonly byPlace: RecordsByPlace;
  readonly holdings: readonly (readonly PlacedRecord[])[];
  readonly credited: ReadonlySet<PlacedRecord>;
}): readonly PaidDebt[] => {
  const answering = answerersByDebt(request);
  return request.inForce.flatMap((debt) => {
    if (debt.record.kind !== "debt" || request.credited.has(debt)) {
      return [];
    }
    const answeredBy = placedInRecordOrder({
      byPlace: request.byPlace,
      records: new Set((answering.get(debt) ?? []).flatMap(({ answerers }) => answerers)),
    });
    return answeredBy.length === 0 ? [] : [{ debt, answeredBy }];
  });
};

const forfeitedRecords = (request: {
  readonly records: readonly PlacedRecord[];
  readonly touched: TouchedSet;
}): readonly PlacedRecord[] =>
  request.records.filter(
    (placed) =>
      placed.record.kind === "debt" &&
      debtForfeitureAt({ touched: request.touched, file: placed.record.file }) === "forfeits",
  );

export const findingSitesOf = (request: {
  readonly raised: RaisedFinding;
  readonly catalogue: SymptomCatalogue;
}): readonly Site[] => {
  const { finding, party } = request.raised;
  const resolved = checkOfFinding({ catalogue: request.catalogue, finding });
  return resolved.resolved === "none"
    ? []
    : [
        {
          symptom: resolved.check.symptom,
          check: { found: "check", check: resolved.check },
          file: finding.file,
          party,
        },
      ];
};

const fileOfNative = (request: {
  readonly exception: CheckNativeException;
}): readonly RepoPath[] => {
  switch (request.exception.kind) {
    case "command-line-option":
      return [];
    case "inline-disable":
    case "ignore":
    case "config-override":
    case "suppression-entry":
    case "inline-rule-config":
      return [request.exception.file];
  }
};

export const nativeSitesOf = (request: {
  readonly exception: CheckNativeException;
  readonly run: NamedGovernedRun;
  readonly catalogue: SymptomCatalogue;
}): readonly Site[] => {
  if (!request.run.coverableKinds.includes(request.exception.kind)) {
    return [];
  }
  const resolved = checkOfFinding({
    catalogue: request.catalogue,
    finding: { check: request.exception.check, mechanism: request.run.mechanism },
  });
  if (resolved.resolved === "none") return [];
  const { check } = resolved;
  return fileOfNative(request).map((file) => ({
    symptom: check.symptom,
    check: { found: "check", check },
    file,
    party: NOT_REPORTED,
  }));
};

const attributed = (request: {
  readonly exception: CheckNativeException;
  readonly mechanism: EngineId;
}): AttributedCheckException => ({
  ...request.exception,
  mechanism: request.mechanism,
});

type NativeHolding = {
  readonly exception: AttributedCheckException;
  readonly holders: readonly PlacedRecord[];
};

const nativeHoldings = (
  request: Catalogued & {
    readonly runs: readonly NamedGovernedRun[];
    readonly byPlace: RecordsByPlace;
  },
): Result<readonly NativeHolding[], SymptomUnheld> =>
  gatheredOutcomes({
    outcomes: request.runs.flatMap((run) =>
      run.nativeExceptions.map((exception): Result<readonly NativeHolding[], SymptomUnheld> => {
        const holders = holdersAt({
          byPlace: request.byPlace,
          sites: nativeSitesOf({ exception, run, catalogue: request.catalogue }),
          catalogue: request.catalogue,
          content: request.content,
        });
        if (holders.outcome === "failed") return holders;
        return {
          outcome: "ok",
          value: [
            {
              exception: attributed({ exception, mechanism: run.mechanism }),
              holders: holders.value,
            },
          ],
        };
      }),
    ),
  });

const staleReasonOf = (
  request: Catalogued & { readonly record: HoneRecord; readonly measurements: MeasurementIndex },
): Result<StaleReason | "unjudged", SymptomUnheld> => {
  const reached = placesReachedBy(request);
  if (reached.outcome === "failed") return reached;
  const measurements = reached.value.map((place) =>
    measurementOf({ measurements: request.measurements, reached: place }),
  );
  if (measurements.includes("not-measured")) {
    return { outcome: "ok", value: "unjudged" };
  }
  if (measurements.includes("excluded")) {
    return { outcome: "ok", value: "file-excluded" };
  }
  return { outcome: "ok", value: measurements.includes("gone") ? "file-gone" : "credited-nothing" };
};

const staleRecords = (
  request: Catalogued & {
    readonly inForce: readonly PlacedRecord[];
    readonly credited: ReadonlySet<PlacedRecord>;
    readonly paidDebt: ReadonlySet<PlacedRecord>;
    readonly measurements: MeasurementIndex;
  },
): Result<readonly StaleRecord[], SymptomUnheld> =>
  gatheredOutcomes({
    outcomes: request.inForce
      .filter(
        (placed) =>
          placed.record.kind !== "dependency-record" &&
          !request.credited.has(placed) &&
          !request.paidDebt.has(placed),
      )
      .map((placed): Result<readonly StaleRecord[], SymptomUnheld> => {
        const reason = staleReasonOf({
          record: placed.record,
          catalogue: request.catalogue,
          content: request.content,
          measurements: request.measurements,
        });
        if (reason.outcome === "failed") return reason;
        return {
          outcome: "ok",
          value: reason.value === "unjudged" ? [] : [{ placed, reason: reason.value }],
        };
      }),
  });

type FindingHolding = {
  readonly finding: CheckFinding;
  readonly holders: readonly PlacedRecord[];
};

const findingHoldings = (
  request: Catalogued & {
    readonly findings: readonly RaisedFinding[];
    readonly byPlace: RecordsByPlace;
  },
): Result<readonly FindingHolding[], SymptomUnheld> =>
  gatheredOutcomes({
    outcomes: request.findings.map((raised): Result<readonly FindingHolding[], SymptomUnheld> => {
      const holders = holdersAt({
        byPlace: request.byPlace,
        sites: findingSitesOf({ raised, catalogue: request.catalogue }),
        catalogue: request.catalogue,
        content: request.content,
      });
      if (holders.outcome === "failed") return holders;
      return { outcome: "ok", value: [{ finding: raised.finding, holders: holders.value }] };
    }),
  });

const heldExceptions = (request: {
  readonly natives: readonly NativeHolding[];
}): readonly HeldException[] =>
  request.natives.flatMap((native) =>
    native.exception.kind === "inline-disable" && native.holders.length > 0
      ? [{ exception: native.exception, by: answerersOf({ holders: native.holders }) }]
      : [],
  );

export const answerFindings = (request: AnsweringRequest): Result<Answering, SymptomUnheld> => {
  const { catalogue, content } = request;
  const forfeited = forfeitedRecords(request);
  const forfeit = new Set(forfeited);
  const inForce = request.records.filter((placed) => !forfeit.has(placed));
  const byPlace = recordsByPlaceOf({ records: inForce });
  const held = findingHoldings({ findings: request.findings, byPlace, catalogue, content });
  if (held.outcome === "failed") return held;
  const natives = nativeHoldings({ runs: request.runs, byPlace, catalogue, content });
  if (natives.outcome === "failed") return natives;
  const judged = held.value.map((entry) => ({
    finding: entry.finding,
    by: answerersOf({ holders: entry.holders }),
  }));
  const credited = new Set([
    ...judged.flatMap((entry) => entry.by),
    ...natives.value.flatMap((native) => answerersOf({ holders: native.holders })),
  ]);
  const paid = paidDebts({
    inForce,
    byPlace,
    holdings: [...held.value, ...natives.value].map((holding) => holding.holders),
    credited,
  });
  const stale = staleRecords({
    inForce,
    credited,
    paidDebt: new Set(paid.map((entry) => entry.debt)),
    catalogue,
    content,
    measurements: measurementIndexOf({ measurements: request.measurements }),
  });
  if (stale.outcome === "failed") return stale;
  return {
    outcome: "ok",
    value: {
      findings: judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
      answered: judged.filter((entry) => entry.by.length > 0),
      held: heldExceptions({ natives: natives.value }),
      stale: stale.value,
      forfeited,
      paid,
      unrecorded: natives.value.flatMap((native) =>
        native.holders.length === 0 ? [native.exception] : [],
      ),
    },
  };
};
