import { describe, expect, it, vi } from "vitest";

import type { PackageManifestPort } from "../../src/application/ports/host/package-manifest-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { ClockPort } from "./clock-port.ts";
import { prepareSample } from "./prepare-sample.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";
import type { TargetTreePort } from "./target-tree-port.ts";
import type { TemporaryFolderPort } from "./temporary-folder-port.ts";

describe("prepareSample", () => {
  it("makes a fresh sample worktree under the side's install, writes the tree, and times the set-up", () => {
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/.pnpm/hone/package.json",
    };
    const copiesRead = vi
      .fn<TargetCopyPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head/samples/2") });
    const treesWrite = vi
      .fn<TargetTreePort["write"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    const prepared = prepareSample({
      ports: {
        copies: {
          read: copiesRead,
          write: vi.fn<TargetCopyPort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
          remove: vi.fn<TargetCopyPort["remove"]>(),
        },
        trees: { read: vi.fn<TargetTreePort["read"]>(), write: treesWrite },
        resolutions: {
          locateManifestFrom: vi
            .fn<PackageManifestPort["locateManifestFrom"]>()
            .mockReturnValue({ outcome: "ok", value: install.resolvedHone }),
        },
        temporaryFolders: {
          write: vi
            .fn<TemporaryFolderPort["write"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head/samples/2/.tmp") }),
        },
        clock: {
          read: vi.fn<ClockPort["read"]>().mockReturnValueOnce(0).mockReturnValueOnce(2_000),
        },
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 2,
      install,
      tree: "4b825dc6",
    });

    expect({ prepared, placed: copiesRead.mock.calls, written: treesWrite.mock.calls }).toEqual({
      prepared: {
        kind: "prepared",
        copy: "/work/head/samples/2",
        temporaryFolder: "/work/head/samples/2/.tmp",
        setUpMilliseconds: 2_000,
      },
      placed: [
        [{ repo: "/work/large-repo", place: { kind: "sample", side: "head", sampleIndex: 2 } }],
      ],
      written: [[{ copy: "/work/head/samples/2", tree: "4b825dc6" }]],
    });
  });

  it("refuses the sample when its Hone resolves to a different file from its side's install", () => {
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/.pnpm/hone/package.json",
    };
    const resolutionsRead = vi
      .fn<PackageManifestPort["locateManifestFrom"]>()
      .mockReturnValue({ outcome: "ok", value: "/work/large-repo/node_modules/hone/package.json" });

    const prepared = prepareSample({
      ports: {
        copies: {
          read: vi
            .fn<TargetCopyPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head/samples/0") }),
          write: vi.fn<TargetCopyPort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
          remove: vi.fn<TargetCopyPort["remove"]>(),
        },
        trees: {
          read: vi.fn<TargetTreePort["read"]>(),
          write: vi.fn<TargetTreePort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
        },
        resolutions: { locateManifestFrom: resolutionsRead },
        temporaryFolders: { write: vi.fn<TemporaryFolderPort["write"]>() },
        clock: { read: vi.fn<ClockPort["read"]>().mockReturnValue(0) },
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 0,
      install,
      tree: "4b825dc6",
    });

    expect({ prepared, resolvedFrom: resolutionsRead.mock.calls }).toEqual({
      prepared: {
        kind: "unprepared",
        copy: "/work/head/samples/0",
        refusal: {
          side: "head",
          failure: {
            kind: "hone-outside-install",
            resolved: "/work/large-repo/node_modules/hone/package.json",
            installResolved: "/work/head/node_modules/.pnpm/hone/package.json",
            install: "/work/head",
          },
        },
      },
      resolvedFrom: [[{ packageName: "@hailstails/hone", folder: "/work/head/samples/0" }]],
    });
  });

  it("refuses with no worktree to remove when the sample cannot be placed", () => {
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/.pnpm/hone/package.json",
    };
    const copiesWrite = vi.fn<TargetCopyPort["write"]>();

    const prepared = prepareSample({
      ports: {
        copies: {
          read: vi.fn<TargetCopyPort["read"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "target-copy-unresolved", path: "samples/0" },
          }),
          write: copiesWrite,
          remove: vi.fn<TargetCopyPort["remove"]>(),
        },
        trees: { read: vi.fn<TargetTreePort["read"]>(), write: vi.fn<TargetTreePort["write"]>() },
        resolutions: { locateManifestFrom: vi.fn<PackageManifestPort["locateManifestFrom"]>() },
        temporaryFolders: { write: vi.fn<TemporaryFolderPort["write"]>() },
        clock: { read: vi.fn<ClockPort["read"]>() },
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 0,
      install,
      tree: "4b825dc6",
    });

    expect({ prepared, copied: copiesWrite.mock.calls }).toEqual({
      prepared: {
        kind: "unplaced",
        refusal: { side: "head", failure: { kind: "target-copy-unresolved", path: "samples/0" } },
      },
      copied: [],
    });
  });
});
