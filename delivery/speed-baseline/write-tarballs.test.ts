import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { BaselineCheckoutPort } from "./baseline-checkout-port.ts";
import type { HoneDependenciesPort } from "./hone-dependencies-port.ts";
import type { HonePackagePort } from "./hone-package-port.ts";
import { writeTarballs } from "./write-tarballs.ts";

describe("writeTarballs", () => {
  it("checks out and packs the baseline revision, then packs the head", () => {
    const checkoutsWrite = vi
      .fn<BaselineCheckoutPort["write"]>()
      .mockReturnValue({ outcome: "ok", value: null });
    const packages = vi
      .fn<HonePackagePort["write"]>()
      .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/work/baseline/b.tgz") })
      .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/work/hone/h.tgz") });

    const tarballs = writeTarballs({
      ports: {
        checkouts: {
          read: vi
            .fn<BaselineCheckoutPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/baseline") }),
          write: checkoutsWrite,
          remove: vi.fn<BaselineCheckoutPort["remove"]>(),
        },
        dependencies: {
          write: vi
            .fn<HoneDependenciesPort["write"]>()
            .mockReturnValue({ outcome: "ok", value: null }),
        },
        packages: { write: packages },
      },
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
      mode: "compare",
    });

    expect({
      tarballs,
      checkedOut: checkoutsWrite.mock.calls,
      packed: packages.mock.calls,
    }).toEqual({
      tarballs: {
        checkouts: ["/work/baseline"],
        tarballs: {
          outcome: "ok",
          value: { baseline: "/work/baseline/b.tgz", head: "/work/hone/h.tgz" },
        },
      },
      checkedOut: [[{ revision: "v2.0.0-pre.4", directory: "/work/baseline" }]],
      packed: [[{ honeRoot: "/work/baseline" }], [{ honeRoot: "/work/hone" }]],
    });
  });

  it("gives the baseline's tarball to both sides, and packs nothing else, when calibrating", () => {
    const packages = vi
      .fn<HonePackagePort["write"]>()
      .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/baseline/b.tgz") });

    const tarballs = writeTarballs({
      ports: {
        checkouts: {
          read: vi
            .fn<BaselineCheckoutPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/baseline") }),
          write: vi
            .fn<BaselineCheckoutPort["write"]>()
            .mockReturnValue({ outcome: "ok", value: null }),
          remove: vi.fn<BaselineCheckoutPort["remove"]>(),
        },
        dependencies: {
          write: vi
            .fn<HoneDependenciesPort["write"]>()
            .mockReturnValue({ outcome: "ok", value: null }),
        },
        packages: { write: packages },
      },
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
      mode: "calibrate",
    });

    expect({ tarballs, packed: packages.mock.calls }).toEqual({
      tarballs: {
        checkouts: ["/work/baseline"],
        tarballs: {
          outcome: "ok",
          value: { baseline: "/work/baseline/b.tgz", head: "/work/baseline/b.tgz" },
        },
      },
      packed: [[{ honeRoot: "/work/baseline" }]],
    });
  });

  it("keeps the checkout to remove, and packs nothing, when the baseline cannot be checked out", () => {
    const packages = vi.fn<HonePackagePort["write"]>();

    const tarballs = writeTarballs({
      ports: {
        checkouts: {
          read: vi
            .fn<BaselineCheckoutPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/baseline") }),
          write: vi.fn<BaselineCheckoutPort["write"]>().mockReturnValue({
            outcome: "failed",
            error: {
              kind: "baseline-unchecked-out",
              command: { kind: "exited", status: 128, output: "fatal" },
            },
          }),
          remove: vi.fn<BaselineCheckoutPort["remove"]>(),
        },
        dependencies: { write: vi.fn<HoneDependenciesPort["write"]>() },
        packages: { write: packages },
      },
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
      mode: "compare",
    });

    expect({ tarballs, packed: packages.mock.calls }).toEqual({
      tarballs: {
        checkouts: ["/work/baseline"],
        tarballs: {
          outcome: "failed",
          error: {
            side: "baseline",
            failure: {
              kind: "baseline-unchecked-out",
              command: { kind: "exited", status: 128, output: "fatal" },
            },
          },
        },
      },
      packed: [],
    });
  });
});
