import { describe, expect, it } from "vitest";

import type { CheckFinding } from "../../finding/governance.ts";
import type { Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import type { PlacedRecord } from "../hone-records/hone-record.ts";
import { renamedDebtFindingsOf } from "./renamed-debt-findings.ts";

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const MOVED_BASKET = repoPathOf("src/basket/basket.ts");

const TOTAL = repoPathOf("src/total.ts");

const CAST_IN_MOVED_BASKET: CheckFinding = {
  check: "claimed-type#cast-expressions",
  mechanism: "walker",
  file: MOVED_BASKET,
  anchor: { line: 3, column: 0 },
  snippet: "as Basket",
};

const SECOND_CAST_IN_MOVED_BASKET: CheckFinding = {
  check: "claimed-type#cast-expressions",
  mechanism: "walker",
  file: MOVED_BASKET,
  anchor: { line: 9, column: 0 },
  snippet: "as Item",
};

const CAST_IN_TOTAL: CheckFinding = {
  check: "claimed-type#cast-expressions",
  mechanism: "walker",
  file: TOTAL,
  anchor: { line: 7, column: 0 },
  snippet: "as Total",
};

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: MOVED_BASKET,
    holding: { held: "stated" },
  },
};

const AUTHORISED: PlacedRecord = {
  place: { file: repoPathOf("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: MOVED_BASKET,
    holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
  },
};

describe("renamedDebtFindingsOf", () => {
  it("gives each finding debt answers on a file git saw renamed, leaving those on other files and those other records answer", () => {
    expect(
      renamedDebtFindingsOf({
        answered: [
          { finding: CAST_IN_MOVED_BASKET, by: [DEBT] },
          { finding: CAST_IN_TOTAL, by: [DEBT] },
          { finding: SECOND_CAST_IN_MOVED_BASKET, by: [AUTHORISED] },
        ],
        renamed: new Map([
          [MOVED_BASKET, { basePath: repoPathOf("src/basket.ts"), content: "edited" }],
        ]),
      }),
    ).toEqual([CAST_IN_MOVED_BASKET]);
  });
});
