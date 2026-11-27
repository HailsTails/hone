import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { touchedSetUnder } from "./forfeiture-touched-set.ts";

const REPO_ROOT = absoluteRootOf("/work/shop");

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const MOVED_BASKET = repoPathOf("src/basket/basket.ts");

const BASKET = repoPathOf("src/basket.ts");

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
        git: { changedSince },
        renamed: { measured: "yes", renamed: new Map() },
      }),
    ).toEqual({ measured: "yes", paths: new Set([ORDER_FILE]) });
    expect(changedSince).toHaveBeenCalledWith({ repoRoot: REPO_ROOT, baseRevision: "origin/main" });
  });

  it("measures nothing when another run assesses forfeiture", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>();
    expect(
      touchedSetUnder({
        forfeiture: "elsewhere",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: { changedSince },
        renamed: { measured: "yes", renamed: new Map() },
      }),
    ).toEqual({ measured: "elsewhere" });
    expect(changedSince).not.toHaveBeenCalled();
  });

  it("leaves out a file only moved since the base, keeping one moved and edited", () => {
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: {
          changedSince: vi
            .fn<GitPort["changedSince"]>()
            .mockReturnValue({ outcome: "ok", value: [MOVED_BASKET, ORDER_FILE] }),
        },
        renamed: {
          measured: "yes",
          renamed: new Map([
            [MOVED_BASKET, { basePath: BASKET, content: "unchanged" }],
            [ORDER_FILE, { basePath: repoPathOf("src/charge-order.ts"), content: "edited" }],
          ]),
        },
      }),
    ).toEqual({ measured: "yes", paths: new Set([ORDER_FILE]) });
  });

  it("is unmeasured, carrying git's message, when the renames since the base are unmeasured", () => {
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: "origin/main",
        git: {
          changedSince: vi
            .fn<GitPort["changedSince"]>()
            .mockReturnValue({ outcome: "ok", value: [ORDER_FILE] }),
        },
        renamed: {
          measured: "no",
          base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" },
        },
      }),
    ).toEqual({
      measured: "no",
      base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" },
    });
  });

  it("is unmeasured with no base revision given, whatever the renames", () => {
    expect(
      touchedSetUnder({
        forfeiture: "this-run",
        repoRoot: REPO_ROOT,
        baseRevision: undefined,
        git: { changedSince: vi.fn<GitPort["changedSince"]>() },
        renamed: { measured: "no", base: { state: "not-given" } },
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
  });
});

it("keeps the verified landing after dropping an unchanged move", () => {
  const touched = touchedSetUnder({
    forfeiture: "no-new-findings",
    repoRoot: REPO_ROOT,
    baseRevision: "pinned",
    baseScope: "pinned-ancestor",
    git: {
      changedSince: vi
        .fn<GitPort["changedSince"]>()
        .mockReturnValue({ outcome: "ok", value: [MOVED_BASKET, ORDER_FILE] }),
    },
    renamed: {
      measured: "yes",
      renamed: new Map([[MOVED_BASKET, { basePath: BASKET, content: "unchanged" }]]),
    },
  });

  expect(touched).toEqual({
    measured: "yes",
    paths: new Set([ORDER_FILE]),
    landingRevision: "pinned",
  });
});
