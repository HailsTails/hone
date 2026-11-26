import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { findLeftOverProjectionFiles } from "./projection-removals.ts";

describe("findLeftOverProjectionFiles", () => {
  it("probes only outputs of the other kind at the selected roots", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValue("present");
    const join = vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/repo/hone.eslint.mjs")
      .mockReturnValueOnce("/repo/hone.eslint.d.mts")
      .mockReturnValueOnce("/repo/web/hone.eslint.mjs")
      .mockReturnValueOnce("/repo/web/hone.eslint.d.mts");

    const files = findLeftOverProjectionFiles({
      repoRoot: absoluteRootOf("/repo"),
      projectionKind: "ts",
      fileText: { exists },
      path: { join },
      slices: {
        root: { directory: undefined, file: repoPathOf("hone.eslint.ts") },
        packages: [{ directory: repoPathOf("web"), file: repoPathOf("web/hone.eslint.ts") }],
      },
    });

    expect({ files, probed: exists.mock.calls }).toEqual({
      files: [
        "hone.eslint.mjs",
        "hone.eslint.d.mts",
        "web/hone.eslint.mjs",
        "web/hone.eslint.d.mts",
      ],
      probed: [
        [{ path: "/repo/hone.eslint.mjs" }],
        [{ path: "/repo/hone.eslint.d.mts" }],
        [{ path: "/repo/web/hone.eslint.mjs" }],
        [{ path: "/repo/web/hone.eslint.d.mts" }],
      ],
    });
  });
});
