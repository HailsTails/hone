import { assert, describe, expect, it, vi } from "vitest";

import {
  createDefaultJsoncParsePort,
  createDefaultJsoncTreePort,
  createJsoncParsePort,
  type JsoncProviderCall,
} from "./jsonc-parse.ts";

describe("createJsoncParsePort", () => {
  it("forwards the exact source once and preserves the provider value with no diagnostics", () => {
    const source = ' { "value": false } \r\n';
    const parsedValue = { marker: "unchanged" };
    const parseProvider = vi
      .fn<JsoncProviderCall>()
      .mockReturnValue({ value: parsedValue, errors: [] });

    const parseOutcome = createJsoncParsePort({ parseProvider }).parse({ source });

    assert(parseOutcome.outcome === "ok");
    expect(parseOutcome.value).toBe(parsedValue);
    expect(parseProvider).toHaveBeenCalledExactlyOnceWith({ source: ' { "value": false } \r\n' });
  });

  it("refuses a recovered provider value when parsing returned diagnostics", () => {
    const parseProvider = vi.fn<JsoncProviderCall>().mockReturnValue({
      value: { recovered: true },
      errors: [{ error: 3, offset: 8, length: 1 }],
    });

    const parseOutcome = createJsoncParsePort({ parseProvider }).parse({
      source: "diagnostic-bearing input",
    });

    expect(parseOutcome).toEqual({
      outcome: "failed",
      error: { detail: "JSONC parse error 3 at offset 8 (length 1)" },
    });
  });

  it("maps only the first diagnostic's code, offset and length to deterministic failure detail", () => {
    const parseProvider = vi.fn<JsoncProviderCall>().mockReturnValue({
      value: undefined,
      errors: [
        { error: 4, offset: 12, length: 2 },
        { error: 7, offset: 20, length: 1 },
      ],
    });

    const parseOutcome = createJsoncParsePort({ parseProvider }).parse({
      source: "multiple-diagnostic input",
    });

    expect(parseOutcome).toEqual({
      outcome: "failed",
      error: { detail: "JSONC parse error 4 at offset 12 (length 2)" },
    });
  });

  it("returns unexpected provider failure as owned detail without escaping the result", () => {
    const parseProvider: JsoncProviderCall = () => assert.fail("provider failed");

    const parseOutcome = createJsoncParsePort({ parseProvider }).parse({
      source: "provider input",
    });

    expect(parseOutcome).toEqual({ outcome: "failed", error: { detail: "provider failed" } });
  });
});

describe("createDefaultJsoncParsePort", () => {
  it("refuses a trailing comma unless told to allow one, as a lock file written with them needs", () => {
    const source = '{ "packages": { "zod": ["zod@4.4.3"], }, }';
    expect({
      refused: createDefaultJsoncParsePort({ trailingCommas: "refused" }).parse({ source }),
      allowed: createDefaultJsoncParsePort({ trailingCommas: "allowed" }).parse({ source }),
    }).toEqual({
      refused: {
        outcome: "failed",
        error: { detail: expect.stringContaining("JSONC parse error") },
      },
      allowed: { outcome: "ok", value: { packages: { zod: ["zod@4.4.3"] } } },
    });
  });
});

describe("createDefaultJsoncTreePort", () => {
  it("keeps the offsets of property names and values in a parsed document", () => {
    expect(
      createDefaultJsoncTreePort({ trailingCommas: "refused" }).parse({
        source: '{"tool": "1.2"}',
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        type: "object",
        children: [
          {
            type: "property",
            children: [
              { type: "string", offset: 1, value: "tool" },
              { type: "string", offset: 9, value: "1.2" },
            ],
          },
        ],
      },
    });
  });

  it("refuses recovered trees with diagnostics", () => {
    expect(
      createDefaultJsoncTreePort({ trailingCommas: "refused" }).parse({
        source: '{"tool": "1.2",}',
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { detail: expect.stringContaining("JSONC parse error") },
    });
  });
});
