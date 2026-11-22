import { describe, expect, it, vi } from "vitest";
import type { GitPort } from "../../ports/git-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { touchedSetUnder } from "./forfeiture-touched-set.ts";

const REPO_ROOT = absolutePathSchema.parse("/work/shop");

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

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
