import { describe, expect, it } from "vitest";
import { parsedJson } from "./parsed-json.ts";

describe("parsedJson", () => {
  it("reads JSON text", () => {
    expect(parsedJson({ text: '{"version":"1.0.0"}' })).toEqual({ outcome: "ok", value: { version: "1.0.0" } });
  });

  it("fails with the parser's message for text that is not JSON", () => {
    expect(parsedJson({ text: "{" })).toMatchObject({ outcome: "failed", error: expect.any(String) });
  });
});
