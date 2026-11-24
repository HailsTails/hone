import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { renamedSinceBaseOf } from "./renamed-since-base.ts";

describe("renamedSinceBaseOf", () => {
  it("gives the renames git saw since the base revision", () => {
    const renamedSince = vi.fn<GitPort["renamedSince"]>().mockReturnValue({
      outcome: "ok",
      value: new Map([
        [
          repoPathOf("src/cart.ts"),
          { basePath: repoPathOf("src/basket.ts"), content: "unchanged" },
        ],
      ]),
    });
    expect(
      renamedSinceBaseOf({
        repoRoot: absoluteRootOf("/repo"),
        baseRevision: "origin/main",
        git: { renamedSince },
      }),
    ).toEqual({
      measured: "yes",
      renamed: new Map([
        [
          repoPathOf("src/cart.ts"),
          { basePath: repoPathOf("src/basket.ts"), content: "unchanged" },
        ],
      ]),
    });
    expect(renamedSince).toHaveBeenCalledExactlyOnceWith({
      repoRoot: absoluteRootOf("/repo"),
      baseRevision: "origin/main",
    });
  });

  it("leaves the base unmeasured, carrying git's message, when git cannot list the renames", () => {
    expect(
      renamedSinceBaseOf({
        repoRoot: absoluteRootOf("/repo"),
        baseRevision: "origin/main",
        git: {
          renamedSince: vi.fn<GitPort["renamedSince"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "git-failed", command: "git diff", detail: "fatal: bad revision" },
          }),
        },
      }),
    ).toEqual({
      measured: "no",
      base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" },
    });
  });

  it("asks git nothing and leaves the base unmeasured when no base revision is given", () => {
    const renamedSince = vi.fn<GitPort["renamedSince"]>();
    expect(
      renamedSinceBaseOf({
        repoRoot: absoluteRootOf("/repo"),
        baseRevision: undefined,
        git: { renamedSince },
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
    expect(renamedSince).not.toHaveBeenCalled();
  });
});
