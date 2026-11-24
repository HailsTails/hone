import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import type { ExecutionPort } from "../../src/infrastructure/node/process/execution-port.ts";
import type { EnvironmentVariablePort } from "./environment-variable-port.ts";
import {
  createHoneDependenciesPort,
  createHonePackagePort,
  createPnpmTargetInstallPort,
} from "./pnpm-adapter.ts";

describe("createHoneDependenciesPort write", () => {
  it("installs Hone's dependencies from its frozen lockfile with the pnpm running this script", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const read = vi.fn<EnvironmentVariablePort["read"]>().mockReturnValue("/tools/pnpm.cjs");
    const dependencies = createHoneDependenciesPort({ node: { run }, environment: { read } });

    const written = dependencies.write({
      honeRoot: absoluteRootOf("/work/hone/.claude/worktrees/baseline-31098fa5"),
    });

    expect({ written, named: read.mock.calls, node: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: null },
      named: [[{ name: "npm_execpath" }]],
      node: [
        [
          {
            arguments: ["/tools/pnpm.cjs", "install", "--frozen-lockfile"],
            cwd: "/work/hone/.claude/worktrees/baseline-31098fa5",
          },
        ],
      ],
    });
  });

  it("runs nothing when no pnpm is named", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>();
    const read = vi.fn<EnvironmentVariablePort["read"]>().mockReturnValue(undefined);
    const dependencies = createHoneDependenciesPort({ node: { run }, environment: { read } });

    const written = dependencies.write({ honeRoot: absoluteRootOf("/work/hone") });

    expect({ written, runs: run.mock.calls }).toEqual({
      written: {
        outcome: "failed",
        error: {
          kind: "hone-dependencies-uninstalled",
          command: {
            kind: "unlaunched",
            detail: "npm_execpath names no pnpm: run this through corepack pnpm run",
          },
        },
      },
      runs: [],
    });
  });
});

describe("createHonePackagePort write", () => {
  it("packs Hone and reads back the tarball it wrote", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: {
        status: 0,
        stdout: "> pack-package\npack package: wrote /work/hone/hone-2.0.0.tgz\n",
        stderr: "",
      },
    });
    const read = vi.fn<EnvironmentVariablePort["read"]>().mockReturnValue("/tools/pnpm.cjs");
    const packages = createHonePackagePort({
      node: { run },
      environment: { read },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const written = packages.write({ honeRoot: absoluteRootOf("/work/hone") });

    expect({ written, node: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: "/work/hone/hone-2.0.0.tgz" },
      node: [[{ arguments: ["/tools/pnpm.cjs", "run", "pack-package"], cwd: "/work/hone" }]],
    });
  });

  it("carries the script's output when it names no tarball", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: { status: 0, stdout: "nothing packed\n", stderr: "" },
    });
    const read = vi.fn<EnvironmentVariablePort["read"]>().mockReturnValue("/tools/pnpm.cjs");
    const packages = createHonePackagePort({
      node: { run },
      environment: { read },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const written = packages.write({ honeRoot: absoluteRootOf("/work/hone") });

    expect(written).toEqual({
      outcome: "failed",
      error: { kind: "tarball-unnamed", output: "nothing packed\n" },
    });
  });

  it("carries pnpm's status and output when the script fails", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: { status: 1, stdout: "", stderr: "ERR_PNPM_NO_SCRIPT\n" },
    });
    const read = vi.fn<EnvironmentVariablePort["read"]>().mockReturnValue("/tools/pnpm.cjs");
    const packages = createHonePackagePort({
      node: { run },
      environment: { read },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const written = packages.write({ honeRoot: absoluteRootOf("/work/hone") });

    expect(written).toEqual({
      outcome: "failed",
      error: {
        kind: "hone-unpacked",
        command: { kind: "exited", status: 1, output: "ERR_PNPM_NO_SCRIPT\n" },
      },
    });
  });
});

describe("createPnpmTargetInstallPort write", () => {
  it("installs the frozen lockfile, then adds the tarball as a development dependency, preferring the local store", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const read = vi.fn<EnvironmentVariablePort["read"]>().mockReturnValue("/tools/pnpm.cjs");
    const installers = createPnpmTargetInstallPort({ node: { run }, environment: { read } });

    const written = installers.write({
      directory: absoluteRootOf("/work/copy"),
      tarball: absoluteRootOf("/work/hone/hone-2.0.0.tgz"),
    });

    expect({ written, node: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: null },
      node: [
        [
          {
            arguments: ["/tools/pnpm.cjs", "install", "--frozen-lockfile", "--prefer-offline"],
            cwd: "/work/copy",
          },
        ],
        [
          {
            arguments: [
              "/tools/pnpm.cjs",
              "add",
              "--save-dev",
              "--prefer-offline",
              "/work/hone/hone-2.0.0.tgz",
            ],
            cwd: "/work/copy",
          },
        ],
      ],
    });
  });
});
