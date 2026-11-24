import { describe, expect, it } from "vitest";

import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { stringListCheckSettings } from "./piece-check-settings.ts";

describe("stringListCheckSettings", () => {
  it("reads each named string list from the binding's settings, apart from the mechanism settings", () => {
    const binding: CheckBinding = {
      address: "example#import-boundaries",
      ruleSet: "hone",
      engine: "walker",
      anchor: { kind: "file" },
      pieceRoot: "/install/mechanisms/audit/CD-19",
      checkSettings: { allowed: ["x"], denied: [] },
      edition: editionOf("1"),
      settings: { module: "a.ts" },
    };

    const read = stringListCheckSettings({ binding, keys: ["allowed", "denied"] });

    expect(read).toEqual({ outcome: "ok", value: { allowed: ["x"], denied: [] } });
  });

  it("is piece-invalid, naming the binding and the fault, when the binding settings are malformed", () => {
    const binding: CheckBinding = {
      address: "example#import-boundaries",
      ruleSet: "hone",
      engine: "walker",
      anchor: { kind: "file" },
      pieceRoot: "/install/mechanisms/audit/CD-19",
      checkSettings: { allowed: [] },
      edition: editionOf("1"),
      settings: { module: "a.ts" },
    };

    const read = stringListCheckSettings({ binding, keys: ["allowed", "denied"] });

    expect(read).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/CD-19",
        detail:
          "the checkSettings of example#import-boundaries are malformed: ✖ Invalid input: expected array, received undefined\n  → at denied",
      },
    });
  });
});
