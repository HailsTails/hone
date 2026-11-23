import { describe, expect, it } from "vitest";

import { checkBindingSchema, checkHitSchema, checkNativeExceptionSchema } from "./check-wire.ts";

describe("named runner messages", () => {
  it("holds an edition and effective settings on the named binding", () => {
    expect(
      checkBindingSchema.safeParse({
        address: "rebinding#test-body",
        engine: "walker",
        anchor: { kind: "file" },
        pieceRoot: "/install/piece",
        settings: { module: "test-body-logic.ts" },
        checkSettings: { limit: 3 },
        edition: "2",
      }),
    ).toMatchObject({
      success: true,
      data: { address: "rebinding#test-body", edition: "2", checkSettings: { limit: 3 } },
    });
  });

  it("holds a finding by check and file", () => {
    expect(
      checkHitSchema.safeParse({
        check: "rebinding#test-body",
        file: "src/a.test.ts",
        anchor: { line: 1, column: 0 },
        snippet: "let value = 1",
      }),
    ).toMatchObject({
      success: true,
      data: {
        check: "rebinding#test-body",
        file: "src/a.test.ts",
        anchor: { line: 1, column: 0 },
        snippet: "let value = 1",
      },
    });
  });

  it("refuses a legacy clause address on a named finding", () => {
    expect(
      checkHitSchema.safeParse({
        check: "rebinding#test-body",
        file: "src/a.test.ts",
        anchor: { line: 1, column: 0 },
        snippet: "let value = 1",
        clause: { ruleSet: "hone", discipline: "CD-27", clause: "test-body-logic" },
      }),
    ).toMatchObject({ success: false });
  });

  it("holds an inline exception by named check", () => {
    expect(
      checkNativeExceptionSchema.safeParse({
        kind: "inline-disable",
        check: "rebinding#test-body",
        file: "src/a.test.ts",
        line: 1,
        text: "disabled",
        reach: "one-check",
      }),
    ).toMatchObject({ success: true, data: { check: "rebinding#test-body", reach: "one-check" } });
  });
});
