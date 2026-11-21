import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../../../tests/causal-why-chain.ts";
import { CLAIMED_TYPE, DATE_USED_DIRECTLY, GIVES_A_VALUE_ITS_TYPE, OWED_DECLARED_NOT_ASSERTED, WHOLE_SYMPTOM } from "../../../../tests/report-catalogue.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { PlacedRecord } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import { prunableDebtOf } from "./prunable-debt.ts";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const DATE_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/date-used-directly.json"), index: 0 },
  record: { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

const CLAIMED_TYPE_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

const AUTHORISED_LOCATION_PLACED: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: ORDER_FILE,
    holding: { held: "stated", owing: { matches: "the-catalogue", case: GIVES_A_VALUE_ITS_TYPE, owes: OWED_DECLARED_NOT_ASSERTED }, whyChain: CAUSAL_WHY_CHAIN },
  },
};

const DEPENDENCY_PLACED: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/dependency-records.json"), index: 0 },
  record: { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "it repeats at each adapter" },
};

describe("the records prune-debt removes: those the version 2 report says to run it for", () => {
  it("removes paid debt, stale debt and forfeited debt, and says which each was", () => {
    expect(
      prunableDebtOf({
        report: { paid: [{ debt: DATE_DEBT, answeredBy: [AUTHORISED_LOCATION_PLACED] }], stale: [{ placed: CLAIMED_TYPE_DEBT, reason: "credited-nothing" }], forfeited: [] },
      }),
    ).toEqual([
      { place: CLAIMED_TYPE_DEBT.place, debt: CLAIMED_TYPE_DEBT.record, reason: "credited-nothing" },
      { place: DATE_DEBT.place, debt: DATE_DEBT.record, reason: "paid" },
    ]);
  });

  it("removes forfeited debt", () => {
    expect(prunableDebtOf({ report: { paid: [], stale: [], forfeited: [DATE_DEBT] } })).toEqual([{ place: DATE_DEBT.place, debt: DATE_DEBT.record, reason: "forfeited" }]);
  });

  it("leaves every record that is not debt, since its line does not say to run prune-debt", () => {
    expect(prunableDebtOf({ report: { paid: [], stale: [{ placed: AUTHORISED_LOCATION_PLACED, reason: "credited-nothing" }, { placed: DEPENDENCY_PLACED, reason: "credited-nothing" }], forfeited: [AUTHORISED_LOCATION_PLACED] } })).toEqual([]);
  });

  it("removes nothing when the report lists nothing", () => {
    expect(prunableDebtOf({ report: { paid: [], stale: [], forfeited: [] } })).toEqual([]);
  });
});
