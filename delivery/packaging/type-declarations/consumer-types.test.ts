import { describe, expect, it, vi } from "vitest";

import { createConsumerTypesPort, type LoadParsePort } from "./consumer-types.ts";

describe("createConsumerTypesPort", () => {
  it("gives back the failure when TypeScript cannot be loaded", async () => {
    const load = vi.fn<LoadParsePort>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "typescript could not be loaded" },
    });

    const diagnostics = await createConsumerTypesPort({ load }).read({
      entry: "entry.ts",
      resolution: "bundler",
      form: "typescript",
      texts: [{ path: "entry.ts", text: "export const count = 1;\n" }],
      packages: [],
    });

    expect(diagnostics).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "typescript could not be loaded" },
    });
    expect(load).toHaveBeenCalledExactlyOnceWith();
  });
});
