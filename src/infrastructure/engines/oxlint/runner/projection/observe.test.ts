import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { runConfiguredOxlint } from "../toolchain/configured-oxlint.ts";
import { observeProjection } from "./observe.ts";

describe("observeProjection", () => {
  it("refuses a stale package projection even when the package has no checked files", () => {
    const file = repoPathOf("packages/app/hone.oxlint.json");
    const configured = vi.fn<typeof runConfiguredOxlint>();

    const observation = observeProjection({
      scope: {
        folder: "packages/app",
        file,
        config: repoPathOf("packages/app/.oxlintrc.json"),
        files: [],
        generated: { kind: "write", file, text: "{}\n" },
      },
      repoRoot: absoluteRootOf("/repo"),
      rules: [],
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{}" }),
      },
      resolveCli: vi.fn(),
      disableConfiguration: "/install/disable-inspection.json",
      governanceLoader: "file:///install/governance-config.process.js",
      configured,
    });

    expect(observation).toMatchObject({ outcome: "ok", value: { state: "out-of-date", file } });
    expect(configured).not.toHaveBeenCalled();
  });
});
