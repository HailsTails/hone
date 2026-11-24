import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { touchedSetUnder } from "./forfeiture-touched-set.ts";

const REPO_ROOT = absoluteRootOf("/work/shop");

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const MOVED_BASKET = repoPathOf("src/basket/basket.ts");

const BASKET = repoPathOf("src/basket.ts");

const NOTHING_RENAMED = vi
  .fn<GitPort["renamedSince"]>()
  .mockReturnValue({ outcome: "ok", value: new Map() });

describe("the change a run measures to assess forfeiture, by the forfeiture setting", () => {
  it("measures the files changed since the base when the run assesses forfeiture", () => {
    const changedSince = vi
      .fn<GitPort["changedSince"]>()
      .mockReturnValue({ outcome: "ok", value: [ORDER_FILE] });
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: { changedSince, renamedSince: NOTHING_RENAMED },
      }),
    ).toEqual({
      measured: "yes",
      paths: new Set([ORDER_FILE]),
    });
    expect(changedSince).toHaveBeenCalledWith({ repoRoot: REPO_ROOT, baseRevision: "origin/main" });
  });

  it("measures nothing when another run assesses forfeiture", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>();
    const renamedSince = vi.fn<GitPort["renamedSince"]>();
    expect(
      touchedSetUnder({
        forfeiture: "elsewhere",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: { changedSince, renamedSince },
      }),
    ).toEqual({ measured: "elsewhere" });
    expect({
      changed: changedSince.mock.calls,
      renamed: renamedSince.mock.calls,
    }).toEqual({ changed: [], renamed: [] });
  });

  it("leaves out a file only moved since the base, keeping one moved and edited", () => {
    const renamedSince = vi.fn<GitPort["renamedSince"]>().mockReturnValue({
      outcome: "ok",
      value: new Map([
        [MOVED_BASKET, { basePath: BASKET, content: "unchanged" }],
        [ORDER_FILE, { basePath: repoPathOf("src/charge-order.ts"), content: "edited" }],
      ]),
    });
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: {
          changedSince: vi
            .fn<GitPort["changedSince"]>()
            .mockReturnValue({ outcome: "ok", value: [MOVED_BASKET, ORDER_FILE] }),
          renamedSince,
        },
      }),
    ).toEqual({ measured: "yes", paths: new Set([ORDER_FILE]) });
    expect(renamedSince).toHaveBeenCalledWith({
      repoRoot: REPO_ROOT,
      baseRevision: "origin/main",
    });
  });

  it("is unmeasured, carrying git's message, when git cannot list the renames", () => {
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: {
          changedSince: vi
            .fn<GitPort["changedSince"]>()
            .mockReturnValue({ outcome: "ok", value: [ORDER_FILE] }),
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

  it("does not ask git for renames when no base revision is given", () => {
    const renamedSince = vi.fn<GitPort["renamedSince"]>();
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: undefined,
        git: { changedSince: vi.fn<GitPort["changedSince"]>(), renamedSince },
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
    expect(renamedSince).not.toHaveBeenCalled();
  });
});
