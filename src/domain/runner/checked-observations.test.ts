import { describe, expect, it } from "vitest";

import { repoPathOf } from "../repository/repo-path-of.ts";
import { editionOf } from "../rule-set/edition-of.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import type { CheckBinding } from "./check-binding.ts";
import type { CheckHit, CheckMeasurement, CheckNativeException } from "./check-observations.ts";
import { checkedObservations } from "./checked-observations.ts";

const FILE = repoPathOf("src/sample.ts");
const BINDING: CheckBinding = {
  address: "rebinding#test-body",
  ruleSet: "hone",
  anchor: { kind: "file" },
  checkSettings: {},
  engine: "walker",
  settings: {},
  edition: editionOf("1"),
  pieceRoot: "/install/test-body",
};
const REQUESTED = { files: [FILE], bindings: [BINDING] };

describe("checkedObservations", () => {
  it("keeps the selected rule-set owner of a hit and an inline exception", () => {
    const ruleSet = { name: ruleSetNameOf("acme") };
    const requested = { files: [FILE], bindings: [{ ...BINDING, ruleSet }] };
    const hit: CheckHit = {
      check: BINDING.address,
      file: FILE,
      anchor: { line: 1, column: 0 },
      snippet: "let sample = 1",
    };
    const inline: CheckNativeException = {
      kind: "inline-disable",
      check: BINDING.address,
      file: FILE,
      line: 2,
      text: "// eslint-disable-next-line acme/rule",
      reach: "one-check",
    };
    const report = {
      hits: [hit],
      measured: [{ check: BINDING.address, file: FILE }],
      nativeExceptions: [inline],
      inapplicable: [],
    };

    const observed = checkedObservations({ requested, report });

    expect(observed).toEqual({
      outcome: "ok",
      value: { ...report, hits: [{ ...hit, ruleSet }], nativeExceptions: [{ ...inline, ruleSet }] },
    });
  });

  it("refuses a measurement on an unrequested file", () => {
    const measured: CheckMeasurement[] = [{ check: BINDING.address, file: repoPathOf("other.ts") }];

    expect(
      checkedObservations({
        requested: REQUESTED,
        report: { hits: [], measured, nativeExceptions: [], inapplicable: [] },
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
        report: { hits: [], measured: [], nativeExceptions, inapplicable: [] },
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

it("refuses an applicability claim outside the requested files", () => {
  const report = {
    hits: [],
    nativeExceptions: [],
    measured: [],
    inapplicable: [{ check: BINDING.address, file: repoPathOf("outside.ts") }],
  };

  const checked = checkedObservations({ requested: REQUESTED, report });

  expect(checked).toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
});
