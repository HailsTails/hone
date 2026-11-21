import type { AttributedNativeException, Finding, GovernedRun } from "../../finding/governance.ts";
import type { NativeException } from "../../runner/runner-result-types.ts";
import { checkNamedAt, checksOf } from "../../language-layer/check-address.ts";
import { checkOfFinding } from "../../finding/finding-check.ts";
import type { Check, SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import type { MechanismId } from "../../rule-set/identifier-types.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { debtForfeitureAt } from "../debt/debt-forfeiture.ts";
import type { HoneRecord, PlacedRecord } from "../hone-records/hone-record.ts";
import { measurementOf, type RunMeasurements } from "../measurement/measured-at.ts";
import { holdsAt, type PartyReport, placesReachedBy, type Site } from "./record-reach.ts";

export type RaisedFinding = { readonly finding: Finding; readonly party: PartyReport };

export type AnsweredFinding = { readonly finding: Finding; readonly by: readonly PlacedRecord[] };

export type PaidDebt = { readonly debt: PlacedRecord; readonly answeredBy: readonly PlacedRecord[] };

export type StaleReason = "credited-nothing" | "file-gone" | "file-excluded";

export type StaleRecord = { readonly placed: PlacedRecord; readonly reason: StaleReason };

type DebtStanding = "answers-in-debts-place" | "answers-beside-debt";

export type AnsweringRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly records: readonly PlacedRecord[];
  readonly findings: readonly RaisedFinding[];
  readonly touched: TouchedSet;
  readonly runs: readonly GovernedRun[];
  readonly measurements: RunMeasurements;
};

export type Answering = {
  readonly findings: readonly Finding[];
  readonly answered: readonly AnsweredFinding[];
  readonly stale: readonly StaleRecord[];
  readonly forfeited: readonly PlacedRecord[];
  readonly paid: readonly PaidDebt[];
  readonly unrecorded: readonly AttributedNativeException[];
};

const NOT_REPORTED: PartyReport = { reported: "not-reported" };

const holdersAt = (request: { readonly records: readonly PlacedRecord[]; readonly sites: readonly Site[]; readonly catalogue: SymptomCatalogue }): readonly PlacedRecord[] =>
  request.records.filter((placed) => request.sites.some((site) => holdsAt({ record: placed.record, site, catalogue: request.catalogue }) === "holds"));

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
      return record.holding.held === "carried" && record.holding.standing === "unjudged" ? "answers-beside-debt" : "answers-in-debts-place";
  }
};

const answersInDebtsPlace = (request: { readonly records: readonly PlacedRecord[] }): readonly PlacedRecord[] =>
  request.records.filter((placed) => debtStandingOf({ record: placed.record }) === "answers-in-debts-place");

const answerersOf = (request: { readonly holders: readonly PlacedRecord[] }): readonly PlacedRecord[] =>
  answersInDebtsPlace({ records: request.holders }).length === 0 ? request.holders : request.holders.filter((placed) => placed.record.kind !== "debt");

const answeredInPlaceOf = (request: {
  readonly debt: PlacedRecord;
  readonly inForce: readonly PlacedRecord[];
  readonly holdings: readonly (readonly PlacedRecord[])[];
}): readonly PlacedRecord[] => {
  const answering = new Set(request.holdings.filter((holders) => holders.includes(request.debt)).flatMap((holders) => answerersOf({ holders })));
  return request.inForce.filter((placed) => answering.has(placed));
};

const paidDebts = (request: {
  readonly inForce: readonly PlacedRecord[];
  readonly holdings: readonly (readonly PlacedRecord[])[];
  readonly credited: ReadonlySet<PlacedRecord>;
}): readonly PaidDebt[] =>
  request.inForce.flatMap((debt) => {
    if (debt.record.kind !== "debt" || request.credited.has(debt)) {
      return [];
    }
    const answeredBy = answeredInPlaceOf({ ...request, debt });
    return answeredBy.length === 0 ? [] : [{ debt, answeredBy }];
  });

const forfeitedRecords = (request: { readonly records: readonly PlacedRecord[]; readonly touched: TouchedSet }): readonly PlacedRecord[] =>
  request.records.filter((placed) => placed.record.kind === "debt" && debtForfeitureAt({ touched: request.touched, file: placed.record.file }) === "forfeits");

export const findingSitesOf = (request: { readonly raised: RaisedFinding; readonly catalogue: SymptomCatalogue }): readonly Site[] => {
  const { finding, party } = request.raised;
  const resolved = checkOfFinding({ catalogue: request.catalogue, finding });
  switch (resolved.resolved) {
    case "check":
      return [{ symptom: resolved.check.symptom, check: { found: "check", check: resolved.check }, file: finding.file, party }];
    case "symptom-only":
      return [{ symptom: resolved.symptom, check: { found: "none" }, file: finding.file, party }];
    case "none":
      return [];
  }
};

const fileOfNative = (request: { readonly exception: NativeException }): readonly RepoPath[] => {
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

const checksReachedBy = (request: { readonly exception: NativeException; readonly catalogue: SymptomCatalogue }): readonly Check[] => {
  const { exception, catalogue } = request;
  const named = checkNamedAt({ catalogue, clause: exception.clause, address: exception.check });
  switch (named.named) {
    case "unnamed":
      return checksOf({ catalogue, clause: exception.clause });
    case "check":
      return [named.check];
    case "not-of-the-clause":
      return [];
  }
};

export const nativeSitesOf = (request: {
  readonly exception: NativeException;
  readonly run: GovernedRun;
  readonly catalogue: SymptomCatalogue;
}): readonly Site[] => {
  if (!request.run.coverableKinds.includes(request.exception.kind)) {
    return [];
  }
  const checks = checksReachedBy(request).filter((check) => check.engines.some((engine) => engine.mechanism === request.run.mechanism));
  return fileOfNative(request).flatMap((file) => checks.map((check) => ({ symptom: check.symptom, check: { found: "check", check }, file, party: NOT_REPORTED })));
};

const attributed = (request: { readonly exception: NativeException; readonly mechanism: MechanismId }): AttributedNativeException => ({
  ...request.exception,
  mechanism: request.mechanism,
});

const nativeHoldings = (request: {
  readonly runs: readonly GovernedRun[];
  readonly inForce: readonly PlacedRecord[];
  readonly catalogue: SymptomCatalogue;
}): readonly { readonly exception: AttributedNativeException; readonly holders: readonly PlacedRecord[] }[] =>
  request.runs.flatMap((run) =>
    run.nativeExceptions.map((exception) => ({
      exception: attributed({ exception, mechanism: run.mechanism }),
      holders: holdersAt({ records: request.inForce, sites: nativeSitesOf({ exception, run, catalogue: request.catalogue }), catalogue: request.catalogue }),
    })),
  );

const staleReasonOf = (request: { readonly record: HoneRecord; readonly catalogue: SymptomCatalogue; readonly measurements: RunMeasurements }): StaleReason | "unjudged" => {
  const measurements = placesReachedBy(request).map((reached) => measurementOf({ measurements: request.measurements, reached }));
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
  readonly measurements: RunMeasurements;
}): readonly StaleRecord[] =>
  request.inForce
    .filter((placed) => placed.record.kind !== "dependency-record" && !request.credited.has(placed) && !request.paidDebt.has(placed))
    .flatMap((placed) => {
      const reason = staleReasonOf({ record: placed.record, catalogue: request.catalogue, measurements: request.measurements });
      return reason === "unjudged" ? [] : [{ placed, reason }];
    });

export const answerFindings = (request: AnsweringRequest): Answering => {
  const { catalogue } = request;
  const forfeited = forfeitedRecords(request);
  const inForce = request.records.filter((placed) => !forfeited.includes(placed));
  const held = request.findings.map((raised) => ({ finding: raised.finding, holders: holdersAt({ records: inForce, sites: findingSitesOf({ raised, catalogue }), catalogue }) }));
  const judged = held.map((entry) => ({ finding: entry.finding, by: answerersOf({ holders: entry.holders }) }));
  const natives = nativeHoldings({ runs: request.runs, inForce, catalogue });
  const credited = new Set([...judged.flatMap((entry) => entry.by), ...natives.flatMap((native) => answerersOf({ holders: native.holders }))]);
  const paid = paidDebts({ inForce, holdings: [...held.map((entry) => entry.holders), ...natives.map((native) => native.holders)], credited });
  return {
    findings: judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
    answered: judged.filter((entry) => entry.by.length > 0),
    stale: staleRecords({ inForce, credited, paidDebt: new Set(paid.map((entry) => entry.debt)), catalogue, measurements: request.measurements }),
    forfeited,
    paid,
    unrecorded: natives.flatMap((native) => (native.holders.length === 0 ? [native.exception] : [])),
  };
};
