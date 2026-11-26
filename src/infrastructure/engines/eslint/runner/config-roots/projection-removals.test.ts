import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { findLeftOverProjectionFiles } from "./projection-removals.ts";

describe("findLeftOverProjectionFiles", () => {
  it("returns only existing outputs of the other kind at the selected roots", () => {
    const exists = vi.fn<FileTextPort["exists"]>(({ path }) =>
      path === "/repo/hone.eslint.mjs" || path === "/repo/web/hone.eslint.d.mts"
        ? "present"
        : "absent",
    );
    const join: PathPort["join"] = ({ segments }) => segments.join("/");

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
      files: ["hone.eslint.mjs", "web/hone.eslint.d.mts"],
      probed: [
        [{ path: "/repo/hone.eslint.mjs" }],
        [{ path: "/repo/hone.eslint.d.mts" }],
        [{ path: "/repo/web/hone.eslint.mjs" }],
        [{ path: "/repo/web/hone.eslint.d.mts" }],
      ],
    });
  });
});
