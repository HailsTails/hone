import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import type { runOxlintProcess } from "./oxlint-diagnostics.ts";
import { createSourcesWithoutDisables } from "./oxlint-directives.ts";

describe("createSourcesWithoutDisables", () => {
  it("blanks a disable marker in a copy while retaining source positions", () => {
    const source = Buffer.from("// oxlint-disable\nconst value = 1;");
    const run = vi.fn<typeof runOxlintProcess>().mockReturnValue([
      {
        filename: "sources/0/value.ts",
        message: "Unused oxlint-disable directive",
        labels: [{ span: { offset: 0, line: 1, length: 17 } }],
      },
    ]);

    const changed = createSourcesWithoutDisables({
      cli: "/oxlint",
      folder: absoluteRootOf("/repo"),
      files: ["sources/0/value.ts"],
      sources: new Map([["sources/0/value.ts", source]]),
      run,
    });

    expect(changed).toEqual(
      new Map([["sources/0/value.ts", Buffer.from("//               \nconst value = 1;")]]),
    );
    expect(source.toString()).toBe("// oxlint-disable\nconst value = 1;");
  });
});
