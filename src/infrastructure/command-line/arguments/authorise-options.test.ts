import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { AUTHORISE_OPTIONS, authoriseRequestOf } from "./authorise-options.ts";

const FULL_VALUES: readonly (readonly [string, readonly string[]])[] = [
  [AUTHORISE_OPTIONS.answers, ["claimed-type#cast-expressions"]],
  [AUTHORISE_OPTIONS.file, ["src/adapters/stripe-webhook.ts"]],
  [AUTHORISE_OPTIONS.case, ["gives-a-value-its-type"]],
  [AUTHORISE_OPTIONS.owes, ["declared-not-asserted"]],
  [AUTHORISE_OPTIONS.rootCause, ["a root cause"]],
  [AUTHORISE_OPTIONS.rootEvidence, ["a root evidence"]],
  [AUTHORISE_OPTIONS.readback, ["a readback"]],
  [AUTHORISE_OPTIONS.owner, ["capture 01a0b421"]],
  [AUTHORISE_OPTIONS.why, ["why one", "why two", "why three", "why four", "why five"]],
  [
    AUTHORISE_OPTIONS.because,
    ["because one", "because two", "because three", "because four", "because five"],
  ],
  [
    AUTHORISE_OPTIONS.evidence,
    ["evidence one", "evidence two", "evidence three", "evidence four", "evidence five"],
  ],
];

describe("the arguments of hone authorise, read as the record they write", () => {
  it("pairs each --why with the --because and --evidence given in the same position", () => {
    expect(authoriseRequestOf({ values: new Map(FULL_VALUES) })).toEqual({
      outcome: "ok",
      value: {
        answers: "claimed-type#cast-expressions",
        file: repoPathOf("src/adapters/stripe-webhook.ts"),
        case: "gives-a-value-its-type",
        owes: "declared-not-asserted",
        whys: [
          { why: "why one", because: "because one", evidence: "evidence one" },
          { why: "why two", because: "because two", evidence: "evidence two" },
          { why: "why three", because: "because three", evidence: "evidence three" },
          { why: "why four", because: "because four", evidence: "evidence four" },
          { why: "why five", because: "because five", evidence: "evidence five" },
        ],
        rootCause: "a root cause",
        rootEvidence: "a root evidence",
        readback: "a readback",
        owner: "capture 01a0b421",
      },
    });
  });

  it("needs each option, naming the first it lacks", () => {
    expect(authoriseRequestOf({ values: new Map() })).toEqual({
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: "hone authorise needs --answers" },
    });
    expect(
      authoriseRequestOf({ values: new Map([[AUTHORISE_OPTIONS.answers, ["claimed-type"]]]) }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: "hone authorise needs --case" },
    });
  });

  it("takes each single option once", () => {
    expect(
      authoriseRequestOf({
        values: new Map([...FULL_VALUES, [AUTHORISE_OPTIONS.owner, ["a", "b"]]]),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: "hone authorise takes --owner once" },
    });
  });

  it("needs --why, --because and --evidence the same number of times, so each why is whole", () => {
    expect(
      authoriseRequestOf({
        values: new Map([...FULL_VALUES, [AUTHORISE_OPTIONS.evidence, ["only one"]]]),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "arguments-invalid",
        detail:
          "hone authorise needs --why, --because and --evidence the same number of times, one of each for every why",
      },
    });
  });

  it("refuses a --because or --evidence given without its --why, and never supplies the answer a person did not give", () => {
    expect(
      authoriseRequestOf({
        values: new Map([
          ...FULL_VALUES,
          [
            AUTHORISE_OPTIONS.because,
            [
              "because one",
              "because two",
              "because three",
              "because four",
              "because five",
              "because six",
            ],
          ],
        ]),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "arguments-invalid",
        detail:
          "hone authorise needs --why, --because and --evidence the same number of times, one of each for every why",
      },
    });
  });

  it("needs --file to be a path inside the repository", () => {
    expect(
      authoriseRequestOf({
        values: new Map([...FULL_VALUES, [AUTHORISE_OPTIONS.file, ["../outside.ts"]]]),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "arguments-invalid",
        detail:
          'hone authorise takes one file inside the repository, written relative to it, for --file, not "../outside.ts"',
      },
    });
  });
});
