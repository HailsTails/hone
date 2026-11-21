import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../../../tests/causal-why-chain.ts";
import { CLAIMED_TYPE, WHOLE_SYMPTOM, WORLD_VALUES_THROUGH_A_PORT } from "../../../../tests/report-catalogue.ts";
import type { PlacedRecord } from "../../hone-records-folder/hone-record.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { forfeitedLine, paidLine, staleLine } from "./debt-lines.ts";

const PRUNE_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop";

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: WEBHOOK_FILE, holding: { held: "stated" } },
};

const CARRIED_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 1 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: WEBHOOK_FILE, holding: { held: "carried", entry: {}, lacks: [], standing: "established" } },
};

const LOCATION: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "stated", owing: { matches: "not-the-catalogue", note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" } }, whyChain: CAUSAL_WHY_CHAIN },
  },
};

const DEVIATION: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/deviations/world-values-through-a-port.json"), index: 0 },
  record: { kind: "deviation", recipe: WORLD_VALUES_THROUGH_A_PORT, file: WEBHOOK_FILE, reasonFails: "Fails.", evidence: "Evidence.", ruleHolds: "Holds." },
};

describe("paidLine", () => {
  it("names the debt, each record answering in its place, then the command that removes it", () => {
    expect(paidLine({ paid: { debt: DEBT, answeredBy: [LOCATION, DEVIATION] }, pruneCommand: PRUNE_COMMAND })).toBe(
      `claimed-type debt src/adapters/stripe-webhook.ts answered by authorised-location note: the catalogue has no case "parses a webhook", owing "declared-not-asserted" answered by deviation world-values-through-a-port; run ${PRUNE_COMMAND} to remove the paid debt`,
    );
  });
});

describe("staleLine", () => {
  it.each([
    { name: "debt", placed: DEBT, line: `claimed-type debt src/adapters/stripe-webhook.ts; nothing it holds is found: run ${PRUNE_COMMAND} to remove it` },
    { name: "carried debt", placed: CARRIED_DEBT, line: `claimed-type debt src/adapters/stripe-webhook.ts carried; nothing it holds is found: run ${PRUNE_COMMAND} to remove it` },
  ])("ends $name with the command that removes it", ({ placed, line }) => {
    expect(staleLine({ stale: { placed, reason: "credited-nothing" }, pruneCommand: PRUNE_COMMAND })).toBe(line);
  });

  it.each([
    { reason: "file-gone", line: `claimed-type debt src/adapters/stripe-webhook.ts; its file is no longer in the repository: run ${PRUNE_COMMAND} to remove it` },
    { reason: "file-excluded", line: `claimed-type debt src/adapters/stripe-webhook.ts; its file is excluded by the settings, so nothing there was checked: run ${PRUNE_COMMAND} to remove it` },
  ] as const)("says why debt is stale when $reason", ({ reason, line }) => {
    expect(staleLine({ stale: { placed: DEBT, reason }, pruneCommand: PRUNE_COMMAND })).toBe(line);
  });

  it("says why a record that is not debt is stale only when its file is gone or excluded", () => {
    expect(staleLine({ stale: { placed: DEVIATION, reason: "file-excluded" }, pruneCommand: PRUNE_COMMAND })).toBe(
      "world-values-through-a-port deviation src/adapters/stripe-webhook.ts; its file is excluded by the settings, so nothing there was checked",
    );
  });

  it.each([
    { name: "an authorised location", placed: LOCATION, line: 'claimed-type authorised-location src/adapters/stripe-webhook.ts note: the catalogue has no case "parses a webhook", owing "declared-not-asserted"' },
    { name: "a deviation", placed: DEVIATION, line: "world-values-through-a-port deviation src/adapters/stripe-webhook.ts" },
  ])("prints $name by its subject alone, since prune-debt removes only debt", ({ placed, line }) => {
    expect(staleLine({ stale: { placed, reason: "credited-nothing" }, pruneCommand: PRUNE_COMMAND })).toBe(line);
  });
});

describe("forfeitedLine", () => {
  it("ends forfeited debt with what to do: pay what it held in this change, then remove it", () => {
    expect(forfeitedLine({ placed: DEBT, pruneCommand: PRUNE_COMMAND })).toBe(
      `claimed-type debt src/adapters/stripe-webhook.ts; this change touched its file, so it no longer answers: fix what it held, then run ${PRUNE_COMMAND} to remove it`,
    );
  });
});
