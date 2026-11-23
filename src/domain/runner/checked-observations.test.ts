import { describe, expect, it } from "vitest";

import { repoPathOf } from "../repository/repo-path-of.ts";
import { editionOf } from "../rule-set/edition-of.ts";
import type { CheckBinding } from "./check-binding.ts";
import type { CheckHit, CheckMeasurement, CheckNativeException } from "./check-observations.ts";
import { checkedObservations } from "./checked-observations.ts";

const FILE = repoPathOf("src/sample.ts");
const BINDING: CheckBinding = {
  address: "rebinding#test-body",
  anchor: { kind: "file" },
  checkSettings: {},
  engine: "walker",
  settings: {},
  edition: editionOf("1"),
  pieceRoot: "/install/test-body",
};
const REQUESTED = { files: [FILE], bindings: [BINDING] };

describe("checkedObservations", () => {
  it("accepts a hit and its measurement for the selected check and file", () => {
    const hit: CheckHit = {
      check: BINDING.address,
      file: FILE,
      anchor: { line: 1, column: 0 },
      snippet: "let sample = 1",
    };
    const report = {
      hits: [hit],
      measured: [{ check: BINDING.address, file: FILE }],
      nativeExceptions: [],
    };

    expect(checkedObservations({ requested: REQUESTED, report })).toEqual({
      outcome: "ok",
      value: report,
    });
  });

  it("refuses a measurement on an unrequested file", () => {
    const measured: CheckMeasurement[] = [{ check: BINDING.address, file: repoPathOf("other.ts") }];

    expect(
      checkedObservations({
        requested: REQUESTED,
        report: { hits: [], measured, nativeExceptions: [] },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail:
          "a measured pair names rebinding#test-body in other.ts, which the request did not hold",
      },
    });
  });

  it("refuses an exception on another check from the same implementation", () => {
    const nativeExceptions: CheckNativeException[] = [
      { kind: "ignore", check: "branch-in-a-test#test-body", file: FILE },
    ];

    expect(
      checkedObservations({
        requested: REQUESTED,
        report: { hits: [], measured: [], nativeExceptions },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail:
          "a native exception names branch-in-a-test#test-body, which the request did not hold",
      },
    });
  });
});
