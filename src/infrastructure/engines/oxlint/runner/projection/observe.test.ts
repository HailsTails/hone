import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { runConfiguredOxlint } from "../../../../node/process/configured-oxlint.ts";
import type { RunOxlint } from "../../../../node/process/oxlint-port.ts";
import { observeProjection } from "./observe.ts";

describe("observeProjection", () => {
  it("refuses a stale package projection before running the adopter's configuration", async () => {
    const file = repoPathOf("packages/app/hone.oxlint.json");
    const configured = vi.fn<typeof runConfiguredOxlint>();

    const observation = await observeProjection({
      scope: {
        folder: "packages/app",
        file,
        config: repoPathOf("packages/app/.oxlintrc.json"),
        files: [repoPathOf("packages/app/index.ts")],
        generated: { kind: "write", file, text: "{}\n" },
      },
      repoRoot: absoluteRootOf("/repo"),
      answered: [],
      rules: [],
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{}" }),
      },
      lint: vi.fn<RunOxlint>(),
      configured,
    });

    expect(observation).toMatchObject({ outcome: "ok", value: { state: "out-of-date", file } });
    expect(configured).not.toHaveBeenCalled();
  });
});
