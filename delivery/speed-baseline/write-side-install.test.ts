import { describe, expect, it, vi } from "vitest";

import type { PackageManifestPort } from "../../src/application/ports/host/package-manifest-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { InstalledCommandPort } from "./installed-command-port.ts";
import type { LockfilesPort } from "./lockfiles-port.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";
import type { TargetInstallPort } from "./target-install-port.ts";
import type { TargetTreePort } from "./target-tree-port.ts";
import { writeSideInstall } from "./write-side-install.ts";

describe("writeSideInstall", () => {
  it("installs the side's tarball into its install worktree carrying the changes tree", () => {
    const copiesWrite = vi
      .fn<TargetCopyPort["write"]>()
      .mockReturnValue({ outcome: "ok", value: null });
    const treesWrite = vi
      .fn<TargetTreePort["write"]>()
      .mockReturnValue({ outcome: "ok", value: null });
    const pnpm = vi
      .fn<TargetInstallPort["write"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    writeSideInstall({
      ports: {
        copies: {
          read: vi
            .fn<TargetCopyPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head") }),
          write: copiesWrite,
          remove: vi.fn<TargetCopyPort["remove"]>(),
        },
        trees: { read: vi.fn<TargetTreePort["read"]>(), write: treesWrite },
        lockfiles: {
          read: vi
            .fn<LockfilesPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: ["pnpm-lock.yaml"] }),
        },
        installers: { pnpm: { write: pnpm }, bun: { write: vi.fn<TargetInstallPort["write"]>() } },
        installedCommands: {
          read: vi
            .fn<InstalledCommandPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head/hone.js") }),
        },
        resolutions: {
          locateManifestFrom: vi
            .fn<PackageManifestPort["locateManifestFrom"]>()
            .mockReturnValue({ outcome: "ok", value: "/work/head/node_modules/hone" }),
        },
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      tarball: absoluteRootOf("/work/h.tgz"),
      tree: "4b825dc6",
    });

    expect({
      copied: copiesWrite.mock.calls,
      trees: treesWrite.mock.calls,
      installed: pnpm.mock.calls,
    }).toEqual({
      copied: [[{ repo: "/work/large-repo", directory: "/work/head" }]],
      trees: [[{ copy: "/work/head", tree: "4b825dc6" }]],
      installed: [[{ directory: "/work/head", tarball: "/work/h.tgz" }]],
    });
  });

  it("gives the install worktree, its installed command and the Hone it resolves to", () => {
    const resolutionsRead = vi
      .fn<PackageManifestPort["locateManifestFrom"]>()
      .mockReturnValue({ outcome: "ok", value: "/work/head/node_modules/.pnpm/hone/package.json" });

    const install = writeSideInstall({
      ports: {
        copies: {
          read: vi
            .fn<TargetCopyPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head") }),
          write: vi.fn<TargetCopyPort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
          remove: vi.fn<TargetCopyPort["remove"]>(),
        },
        trees: {
          read: vi.fn<TargetTreePort["read"]>(),
          write: vi.fn<TargetTreePort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
        },
        lockfiles: {
          read: vi
            .fn<LockfilesPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: ["bun.lock"] }),
        },
        installers: {
          pnpm: { write: vi.fn<TargetInstallPort["write"]>() },
          bun: {
            write: vi
              .fn<TargetInstallPort["write"]>()
              .mockReturnValue({ outcome: "ok", value: null }),
          },
        },
        installedCommands: {
          read: vi
            .fn<InstalledCommandPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/head/hone.js") }),
        },
        resolutions: { locateManifestFrom: resolutionsRead },
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      tarball: absoluteRootOf("/work/h.tgz"),
      tree: "4b825dc6",
    });

    expect({ install, resolvedFrom: resolutionsRead.mock.calls }).toEqual({
      install: {
        directories: ["/work/head"],
        install: {
          outcome: "ok",
          value: {
            directory: "/work/head",
            command: "/work/head/hone.js",
            resolvedHone: "/work/head/node_modules/.pnpm/hone/package.json",
          },
        },
      },
      resolvedFrom: [[{ packageName: "@hailstails/hone", folder: "/work/head" }]],
    });
  });

  it("refuses for the side, keeping its worktree to remove, when its lockfile is unsupported", () => {
    const install = writeSideInstall({
      ports: {
        copies: {
          read: vi
            .fn<TargetCopyPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/baseline") }),
          write: vi.fn<TargetCopyPort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
          remove: vi.fn<TargetCopyPort["remove"]>(),
        },
        trees: {
          read: vi.fn<TargetTreePort["read"]>(),
          write: vi.fn<TargetTreePort["write"]>().mockReturnValue({ outcome: "ok", value: null }),
        },
        lockfiles: {
          read: vi
            .fn<LockfilesPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: ["package-lock.json"] }),
        },
        installers: {
          pnpm: { write: vi.fn<TargetInstallPort["write"]>() },
          bun: { write: vi.fn<TargetInstallPort["write"]>() },
        },
        installedCommands: { read: vi.fn<InstalledCommandPort["read"]>() },
        resolutions: { locateManifestFrom: vi.fn<PackageManifestPort["locateManifestFrom"]>() },
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "baseline",
      tarball: absoluteRootOf("/work/b.tgz"),
      tree: "4b825dc6",
    });

    expect(install).toEqual({
      directories: ["/work/baseline"],
      install: {
        outcome: "failed",
        error: {
          side: "baseline",
          failure: { kind: "lockfile-unsupported", lockfile: "package-lock.json" },
        },
      },
    });
  });
});
