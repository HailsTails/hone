import { describe, expect, it } from "vitest";

import { editionOf } from "../rule-set/edition-of.ts";
import { bindCheck } from "./check-binding.ts";

describe("bindCheck", () => {
  it("supplies Hone's own parameter-count options to the selected lint engine", () => {
    const edition = editionOf("1");

    const binding = bindCheck({
      address: "positional-parameters#parameter-count",
      ruleSet: "hone",
      engine: "oxlint",
      anchor: { kind: "file" },
      pieceRoot: "/install/parameter-count",
      settings: { rule: "eslint/max-params" },
      checkSettings: {},
      edition,
    });

    expect(binding).toMatchObject({
      checkOptions: { kind: "parameter-count", maximumSlots: 2, voidReceiver: "count" },
    });
  });
});
