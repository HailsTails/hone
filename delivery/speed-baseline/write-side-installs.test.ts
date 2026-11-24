import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { type WriteSideInstallStage, writeSideInstalls } from "./write-side-installs.ts";

describe("writeSideInstalls", () => {
  it("installs the baseline, then the head, each from its own tarball with the one tree", () => {
    const headInstall = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/hone",
    };
    const tarballs = {
      baseline: absoluteRootOf("/work/b.tgz"),
      head: absoluteRootOf("/work/h.tgz"),
    };
    const baselineInstall = {
      directory: absoluteRootOf("/work/baseline"),
      command: absoluteRootOf("/work/baseline/hone.js"),
      resolvedHone: "/work/baseline/node_modules/hone",
    };
    const writeSideInstall = vi
      .fn<WriteSideInstallStage>()
      .mockReturnValueOnce({
        directories: [baselineInstall.directory],
        install: { outcome: "ok", value: baselineInstall },
      })
      .mockReturnValueOnce({
        directories: [headInstall.directory],
        install: { outcome: "ok", value: headInstall },
      });

    const installs = writeSideInstalls({
      writeSideInstall,
      repo: absoluteRootOf("/work/large-repo"),
      tarballs,
      tree: "4b825dc6",
    });

    expect({ installs, installed: writeSideInstall.mock.calls }).toEqual({
      installs: {
        directories: ["/work/baseline", "/work/head"],
        installs: { outcome: "ok", value: { baseline: baselineInstall, head: headInstall } },
      },
      installed: [
        [{ repo: "/work/large-repo", side: "baseline", tarball: "/work/b.tgz", tree: "4b825dc6" }],
        [{ repo: "/work/large-repo", side: "head", tarball: "/work/h.tgz", tree: "4b825dc6" }],
      ],
    });
  });

  it("installs no head when the baseline cannot be installed, keeping the baseline's worktree to remove", () => {
    const tarballs = {
      baseline: absoluteRootOf("/work/b.tgz"),
      head: absoluteRootOf("/work/h.tgz"),
    };
    const baselineInstall = {
      directory: absoluteRootOf("/work/baseline"),
      command: absoluteRootOf("/work/baseline/hone.js"),
      resolvedHone: "/work/baseline/node_modules/hone",
    };
    const writeSideInstall = vi.fn<WriteSideInstallStage>().mockReturnValue({
      directories: [baselineInstall.directory],
      install: {
        outcome: "failed",
        error: { side: "baseline", failure: { kind: "lockfile-missing" } },
      },
    });

    const installs = writeSideInstalls({
      writeSideInstall,
      repo: absoluteRootOf("/work/large-repo"),
      tarballs,
      tree: "4b825dc6",
    });

    expect({ installs, sides: writeSideInstall.mock.calls.length }).toEqual({
      installs: {
        directories: ["/work/baseline"],
        installs: {
          outcome: "failed",
          error: { side: "baseline", failure: { kind: "lockfile-missing" } },
        },
      },
      sides: 1,
    });
  });
});
