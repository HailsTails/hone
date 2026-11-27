import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import type { runOxlintProcess } from "./oxlint-diagnostics.ts";
import { createDisableInspection } from "./oxlint-directives.ts";

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
    const inspection = createDisableInspection(run);

    const changed = inspection.createSourcesWithoutDisables({
      cli: "/oxlint",
      folder: absoluteRootOf("/repo"),
      files: ["sources/0/value.ts"],
      config: "/config/disable-inspection.json",
      targets: ["sources/0/value.ts"],
      sources: new Map([["sources/0/value.ts", source]]),
    });

    expect(changed).toEqual(
      new Map([["sources/0/value.ts", Buffer.from("//               \nconst value = 1;")]]),
    );
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        config: "/config/disable-inspection.json",
        targets: ["sources/0/value.ts"],
        rules: 0,
      }),
    );
    expect(source.toString()).toBe("// oxlint-disable\nconst value = 1;");
  });
});
