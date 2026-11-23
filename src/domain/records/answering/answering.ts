import { checkOfFinding } from "../../finding/finding-check.ts";
import type {
  AttributedCheckException,
  CheckFinding,
  NamedGovernedRun,
} from "../../finding/governance.ts";
import type { SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
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
import { holdsAt, type PartyReport, placesReachedBy, type Site } from "./record-reach.ts";
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
  readonly exception: AttributedCheckException;
  readonly by: readonly PlacedRecord[];
};

export type PaidDebt = {
  readonly debt: PlacedRecord;
  readonly answeredBy: readonly PlacedRecord[];
};

export type StaleReason = "credited-nothing" | "file-gone" | "file-excluded";

export type StaleRecord = { readonly placed: PlacedRecord; readonly reason: StaleReason };

type DebtStanding = "answers-in-debts-place" | "answers-beside-debt";

export type AnsweringRequest = {
  readonly catalogue: SymptomCatalogue;
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

const holdersAt = (request: {
  readonly byPlace: RecordsByPlace;
  readonly sites: readonly Site[];
  readonly catalogue: SymptomCatalogue;
}): readonly PlacedRecord[] =>
  recordsReachingSites({ byPlace: request.byPlace, sites: request.sites }).filter((placed) =>
    request.sites.some(
      (site) => holdsAt({ record: placed.record, site, catalogue: request.catalogue }) === "holds",
    ),
  );

const debtStandingOf = (request: { readonly record: HoneRecord }): DebtStanding => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "dependency-record":
      return "answers-beside-debt";
    case "deviation":
      return "answers-in-debts-place";
    case "authorised-location":
    case "boundary-record":
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

const nativeHoldings = (request: {
  readonly runs: readonly NamedGovernedRun[];
  readonly byPlace: RecordsByPlace;
  readonly catalogue: SymptomCatalogue;
}): readonly {
  readonly exception: AttributedCheckException;
  readonly holders: readonly PlacedRecord[];
}[] =>
  request.runs.flatMap((run) =>
    run.nativeExceptions.map((exception) => ({
      exception: attributed({ exception, mechanism: run.mechanism }),
      holders: holdersAt({
        byPlace: request.byPlace,
        sites: nativeSitesOf({ exception, run, catalogue: request.catalogue }),
        catalogue: request.catalogue,
      }),
    })),
  );

const staleReasonOf = (request: {
  readonly record: HoneRecord;
  readonly catalogue: SymptomCatalogue;
  readonly measurements: MeasurementIndex;
}): StaleReason | "unjudged" => {
  const measurements = placesReachedBy(request).map((reached) =>
    measurementOf({ measurements: request.measurements, reached }),
  );
  if (measurements.includes("not-measured")) {
    return "unjudged";
  }
  if (measurements.includes("excluded")) {
    return "file-excluded";
  }
  return measurements.includes("gone") ? "file-gone" : "credited-nothing";
};

const staleRecords = (request: {
  readonly inForce: readonly PlacedRecord[];
  readonly credited: ReadonlySet<PlacedRecord>;
  readonly paidDebt: ReadonlySet<PlacedRecord>;
  readonly catalogue: SymptomCatalogue;
  readonly measurements: MeasurementIndex;
}): readonly StaleRecord[] =>
  request.inForce
    .filter(
      (placed) =>
        placed.record.kind !== "dependency-record" &&
        !request.credited.has(placed) &&
        !request.paidDebt.has(placed),
    )
    .flatMap((placed) => {
      const reason = staleReasonOf({
        record: placed.record,
        catalogue: request.catalogue,
        measurements: request.measurements,
      });
      return reason === "unjudged" ? [] : [{ placed, reason }];
    });

export const answerFindings = (request: AnsweringRequest): Answering => {
  const { catalogue } = request;
  const forfeited = forfeitedRecords(request);
  const forfeit = new Set(forfeited);
  const inForce = request.records.filter((placed) => !forfeit.has(placed));
  const byPlace = recordsByPlaceOf({ records: inForce });
  const held = request.findings.map((raised) => ({
    finding: raised.finding,
    holders: holdersAt({
      byPlace,
      sites: findingSitesOf({ raised, catalogue }),
      catalogue,
    }),
  }));
  const judged = held.map((entry) => ({
    finding: entry.finding,
    by: answerersOf({ holders: entry.holders }),
  }));
  const natives = nativeHoldings({ runs: request.runs, byPlace, catalogue });
  const credited = new Set([
    ...judged.flatMap((entry) => entry.by),
    ...natives.flatMap((native) => answerersOf({ holders: native.holders })),
  ]);
  const paid = paidDebts({
    inForce,
    byPlace,
    holdings: [...held.map((entry) => entry.holders), ...natives.map((native) => native.holders)],
    credited,
  });
  return {
    findings: judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
    answered: judged.filter((entry) => entry.by.length > 0),
    held: natives.flatMap((native) =>
      native.holders.length === 0
        ? []
        : [{ exception: native.exception, by: answerersOf({ holders: native.holders }) }],
    ),
    stale: staleRecords({
      inForce,
      credited,
      paidDebt: new Set(paid.map((entry) => entry.debt)),
      catalogue,
      measurements: measurementIndexOf({ measurements: request.measurements }),
    }),
    forfeited,
    paid,
    unrecorded: natives.flatMap((native) =>
      native.holders.length === 0 ? [native.exception] : [],
    ),
  };
};
