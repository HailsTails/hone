import { describe, expect, it } from "vitest";

import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createCommandLineArgumentsPort } from "./command-line-adapter.ts";

describe("createCommandLineArgumentsPort read", () => {
  it("reads the target as an absolute path, comparing by default", () => {
    const commandLine = createCommandLineArgumentsPort({
      arguments: ["--repo", "large-repo"],
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const read = commandLine.read();

    expect(read).toEqual({ outcome: "ok", value: { repo: "/work/large-repo", mode: "compare" } });
  });

  it("reads the calibration mode", () => {
    const commandLine = createCommandLineArgumentsPort({
      arguments: ["--calibrate", "--repo", "/work/large-repo"],
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const read = commandLine.read();

    expect(read).toEqual({ outcome: "ok", value: { repo: "/work/large-repo", mode: "calibrate" } });
  });

  it.each([
    { case: "a missing target", commandLine: ["--calibrate"] },
    {
      case: "a per-run allowance",
      commandLine: ["--repo", "/work/large-repo", "--allowance-percent", "10"],
    },
    {
      case: "a per-run baseline",
      commandLine: ["--repo", "/work/large-repo", "--baseline-revision", "v2.0.0"],
    },
    { case: "a positional argument", commandLine: ["/work/large-repo"] },
  ])("refuses $case as usage, with the usage line", ({ commandLine }) => {
    const port = createCommandLineArgumentsPort({
      arguments: commandLine,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const read = port.read();

    expect(read).toEqual({
      outcome: "failed",
      error: {
        kind: "usage-refused",
        detail: expect.any(String),
        usage: "usage: corepack pnpm run speed-baseline --repo <dir> [--calibrate]\n",
      },
    });
  });

  it("refuses a joined repo value the way Hone's own commands do", () => {
    const commandLine = createCommandLineArgumentsPort({
      arguments: ["--repo=/work/large-repo"],
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const read = commandLine.read();

    expect(read).toEqual({
      outcome: "failed",
      error: {
        kind: "usage-refused",
        detail:
          'give --repo and its value as two arguments, as in --repo <dir>, not "--repo=/work/large-repo"',
        usage: "usage: corepack pnpm run speed-baseline --repo <dir> [--calibrate]\n",
      },
    });
  });
});
