import { describe, expect, it } from "vitest";

import type { Recipe, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  PlacedRecord,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { WhyChain } from "../../../domain/records/why-chain.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { forfeitedLine, paidLine, staleLine } from "./debt-lines.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: {
        name: "gives-a-value-its-type",
        title: "Gives a value its type",
        standing: "accepted",
        owes: [
          {
            kind: "rule",
            rule: {
              name: "declared-not-asserted",
              title: "Declared, not asserted",
              principle: { name: "one-place-decides", title: "One place decides" },
              standing: "accepted",
            },
          },
        ],
      },
      situation: "or needs it narrower",
      points: [
        {
          kind: "rule",
          rule: {
            name: "declared-not-asserted",
            title: "Declared, not asserted",
            principle: { name: "one-place-decides", title: "One place decides" },
            standing: "accepted",
          },
        },
      ],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    {
      situation: "a schema proves the type",
      kind: {
        name: "authorised-location",
        title: "Authorised location",
        phrase: "an authorised location",
        todaysFormat: "authorised-location",
      },
    },
  ],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  ruleSet: "hone",
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const PRUNE_COMMAND =
  "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop";

const WEBHOOK_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "stated" },
  },
};

const CARRIED_DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 1 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "carried", entry: {}, lacks: [], standing: "established" },
  },
};

const LOCATION: PlacedRecord = {
  place: { file: repoPathOf("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: {
      held: "stated",
      owing: {
        matches: "not-the-catalogue",
        note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" },
      },
      whyChain: CAUSAL_WHY_CHAIN,
    },
  },
};

const DEVIATION: PlacedRecord = {
  place: { file: repoPathOf("hone-records/deviations/world-values-through-a-port.json"), index: 0 },
  record: {
    kind: "deviation",
    recipe: WORLD_VALUES_THROUGH_A_PORT,
    file: WEBHOOK_FILE,
    reasonFails: "Fails.",
    evidence: "Evidence.",
    ruleHolds: "Holds.",
  },
};

describe("paidLine", () => {
  it("names the debt, each record answering in its place, then the command that removes it", () => {
    expect(
      paidLine({
        paid: { debt: DEBT, answeredBy: [LOCATION, DEVIATION] },
        pruneCommand: PRUNE_COMMAND,
      }),
    ).toBe(
      `claimed-type debt src/adapters/stripe-webhook.ts answered by authorised-location note: the catalogue has no case "parses a webhook", owing "declared-not-asserted" answered by deviation world-values-through-a-port; run ${PRUNE_COMMAND} to remove the paid debt`,
    );
  });
});

describe("staleLine", () => {
  it.each([
    {
      name: "debt",
      placed: DEBT,
      line: `claimed-type debt src/adapters/stripe-webhook.ts; nothing it holds is found: run ${PRUNE_COMMAND} to remove it`,
    },
    {
      name: "carried debt",
      placed: CARRIED_DEBT,
      line: `claimed-type debt src/adapters/stripe-webhook.ts carried; nothing it holds is found: run ${PRUNE_COMMAND} to remove it`,
    },
  ])("ends $name with the command that removes it", ({ placed, line }) => {
    expect(
      staleLine({ stale: { placed, reason: "credited-nothing" }, pruneCommand: PRUNE_COMMAND }),
    ).toBe(line);
  });

  it.each([
    {
      reason: "file-gone",
      line: `claimed-type debt src/adapters/stripe-webhook.ts; its file is no longer in the repository: run ${PRUNE_COMMAND} to remove it`,
    },
    {
      reason: "file-excluded",
      line: `claimed-type debt src/adapters/stripe-webhook.ts; its file is excluded by the settings, so nothing there was checked: run ${PRUNE_COMMAND} to remove it`,
    },
  ] as const)("says why debt is stale when $reason", ({ reason, line }) => {
    expect(staleLine({ stale: { placed: DEBT, reason }, pruneCommand: PRUNE_COMMAND })).toBe(line);
  });

  it("says why a record that is not debt is stale only when its file is gone or excluded", () => {
    expect(
      staleLine({
        stale: { placed: DEVIATION, reason: "file-excluded" },
        pruneCommand: PRUNE_COMMAND,
      }),
    ).toBe(
      "world-values-through-a-port deviation src/adapters/stripe-webhook.ts; its file is excluded by the settings, so nothing there was checked",
    );
  });

  it.each([
    {
      name: "an authorised location",
      placed: LOCATION,
      line: 'claimed-type authorised-location src/adapters/stripe-webhook.ts note: the catalogue has no case "parses a webhook", owing "declared-not-asserted"',
    },
    {
      name: "a deviation",
      placed: DEVIATION,
      line: "world-values-through-a-port deviation src/adapters/stripe-webhook.ts",
    },
  ])(
    "prints $name by its subject alone, since prune-debt removes only debt",
    ({ placed, line }) => {
      expect(
        staleLine({ stale: { placed, reason: "credited-nothing" }, pruneCommand: PRUNE_COMMAND }),
      ).toBe(line);
    },
  );
});

describe("forfeitedLine", () => {
  it("ends forfeited debt with what to do: pay what it held in this change, then remove it", () => {
    expect(forfeitedLine({ placed: DEBT, pruneCommand: PRUNE_COMMAND })).toBe(
      `claimed-type debt src/adapters/stripe-webhook.ts; this change touched its file, so it no longer answers: fix what it held, then run ${PRUNE_COMMAND} to remove it`,
    );
  });
});
