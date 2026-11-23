import { assert, describe, expect, it } from "vitest";

import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import {
  numberedReferenceKind,
  trackedChecksOf,
  trackingAnywhere,
  trackingAtStart,
  trackingReference,
} from "./tracker-patterns.ts";

const BINDING: CheckBinding = {
  address: "untracked-escape#directive-pointers",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/repo/pieces/directive-pointers",
  settings: { module: "comments-directives.ts" },
  checkSettings: { trackerPatterns: ["^\\(OPS-\\d+\\)$"] },
  edition: editionOf("1"),
};

describe("tracker patterns", () => {
  it("requires one whole parenthesised reference containing a digit", () => {
    expect(numberedReferenceKind("(OPS-18)")).toBe("numbered");
    expect(numberedReferenceKind("(OPS-18)(more)")).toBe("other");
    expect(numberedReferenceKind("(words)")).toBe("other");
  });

  it("accepts each position of a reference matching the configured tracker", () => {
    const result = trackedChecksOf({ bindings: [BINDING] });
    assert(result.outcome === "ok");
    const [tracked] = result.value;
    assert(tracked !== undefined);
    expect(trackingAnywhere({ text: "directive (OPS-18)", tracked })).toBe("tracked");
    expect(trackingAtStart({ text: "(OPS-18) follow-up detail", tracked })).toBe("tracked");
    expect(trackingReference({ reference: "(OPS-18)", tracked })).toBe("tracked");
    expect(trackingReference({ reference: "(OTHER-18)", tracked })).toBe("untracked");
  });

  it("requires a number when extracting a directive reference even under a broad pattern", () => {
    const result = trackedChecksOf({
      bindings: [{ ...BINDING, checkSettings: { trackerPatterns: [".*"] } }],
    });
    assert(result.outcome === "ok");
    const [tracked] = result.value;
    assert(tracked !== undefined);
    expect(trackingAtStart({ text: "(legacy)", tracked })).toBe("untracked");
    expect(trackingAtStart({ text: "(https://example.test/issues)", tracked })).toBe("untracked");
  });

  it("reports an invalid adopter pattern as a piece failure", () => {
    expect(
      trackedChecksOf({ bindings: [{ ...BINDING, checkSettings: { trackerPatterns: ["("] } }] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: "/repo/pieces/directive-pointers" },
    });
  });
});
