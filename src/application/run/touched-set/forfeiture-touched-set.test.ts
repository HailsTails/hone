import { describe, expect, it, vi } from "vitest";
import type { GitPort } from "../../ports/git-port.ts";
import { touchedSetUnder } from "./forfeiture-touched-set.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const REPO_ROOT = absoluteRootOf("/work/shop");

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

describe("the change a run measures to assess forfeiture, by the forfeiture setting", () => {
  it("measures the files changed since the base when the run assesses forfeiture", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [ORDER_FILE] });
    expect(touchedSetUnder({ forfeiture: "this-run", repoRoot: REPO_ROOT, baseRevision: "origin/main", git: { changedSince } })).toEqual({
      measured: "yes",
      paths: new Set([ORDER_FILE]),
    });
    expect(changedSince).toHaveBeenCalledWith({ repoRoot: REPO_ROOT, baseRevision: "origin/main" });
  });

  it("measures nothing when another run assesses forfeiture", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>();
    expect(touchedSetUnder({ forfeiture: "elsewhere", repoRoot: REPO_ROOT, baseRevision: "origin/main", git: { changedSince } })).toEqual({ measured: "elsewhere" });
    expect(changedSince).not.toHaveBeenCalled();
  });
});
