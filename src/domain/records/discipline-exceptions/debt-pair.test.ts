import { describe, expect, it } from "vitest";
import { debtPairKey, distinctDebtPairs, entryPairKey } from "./debt-pair.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";

const LOOPS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") };
const CASTS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") };
const BASKET = repoPathOf("src/basket.ts");
const LEGACY = repoPathOf("src/legacy/report.ts");

describe("debtPairKey", () => {
  it("joins the clause text and the file", () => {
    expect(debtPairKey({ clause: LOOPS, file: BASKET })).toBe("CD-15#loops src/basket.ts");
  });
});

describe("entryPairKey", () => {
  it("keys a file carve-out entry as debtPairKey keys its pair", () => {
    expect(entryPairKey({ entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/basket.ts" } })).toBe(
      debtPairKey({ clause: LOOPS, file: BASKET }),
    );
  });

  it("keys an authorised location entry by its clause and file", () => {
    expect(entryPairKey({ entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/basket.ts", reason: "the one loop" } })).toBe(
      "CD-15#loops src/basket.ts",
    );
  });

  it("gives no key to a clause-wide carve-out, which names no file", () => {
    expect(entryPairKey({ entry: { kind: "clause-wide-carve-out", clause: "CD-15#loops", reason: "migrating", whyChain: [] } })).toBeUndefined();
  });

  it("gives no key to an entry whose clause does not parse", () => {
    expect(entryPairKey({ entry: { kind: "file-carve-out", clause: "not a clause", file: "src/basket.ts" } })).toBeUndefined();
  });
});

describe("distinctDebtPairs", () => {
  it("keeps one of each pair, ordered by file and then by clause", () => {
    expect(
      distinctDebtPairs({
        pairs: [
          { clause: LOOPS, file: LEGACY },
          { clause: LOOPS, file: BASKET },
          { clause: CASTS, file: BASKET },
          { clause: LOOPS, file: BASKET },
        ],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET },
      { clause: CASTS, file: BASKET },
      { clause: LOOPS, file: LEGACY },
    ]);
  });
});
