import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { ConfigFileSearch, EslintPort, QueryInstance } from "../toolchain/eslint-instance.ts";
import type { NotPlainReason, OptionEffect, ScriptOption } from "./package-script-scanner.ts";
import { scriptOptionJudge } from "./script-option-effect.ts";

const REPO_ROOT = absoluteRootOf("/repo");
const ROOT_PACKAGE = repoPathOf("package.json");
const NESTED_PACKAGE = repoPathOf("packages/a/package.json");
const ROOT_FILE = repoPathOf("src/a.ts");
const NESTED_FILE = repoPathOf("packages/a/src/b.ts");
const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const optionAt = (request: {
  readonly location: typeof ROOT_PACKAGE;
  readonly effect: OptionEffect;
}): ScriptOption => ({
  ...request,
  settlement: { kind: "settled" },
  command: "eslint",
  exceptions: [],
});

const foundAt = (path: string): ConfigFileSearch => ({ kind: "found", path });

const NO_CONFIG: ConfigFileSearch = { kind: "none" };

const queryFinding = (search: ConfigFileSearch): Pick<QueryInstance, "configFileOf"> => ({
  configFileOf: vi.fn<QueryInstance["configFileOf"]>().mockResolvedValue(search),
});

const queryFindingInTurn = (request: {
  readonly first: ConfigFileSearch;
  readonly second: ConfigFileSearch;
}): Pick<QueryInstance, "configFileOf"> => ({
  configFileOf: vi
    .fn<QueryInstance["configFileOf"]>()
    .mockResolvedValueOnce(request.first)
    .mockResolvedValueOnce(request.second),
});

const judgeOver = (request: {
  readonly query?: Pick<QueryInstance, "configFileOf">;
  readonly ignoredByPatterns?: EslintPort["ignoredByPatterns"];
}) =>
  scriptOptionJudge({
    query: request.query ?? queryFinding(NO_CONFIG),
    eslint: {
      ignoredByPatterns: request.ignoredByPatterns ?? vi.fn<EslintPort["ignoredByPatterns"]>(),
    },
    path: PATH,
    repoRoot: REPO_ROOT,
    checked: [ROOT_FILE, NESTED_FILE],
  });

describe("scriptOptionJudge, an option that always weakens the run", () => {
  it("weakens without asking ESLint anything", async () => {
    const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>();
    await expect(
      judgeOver({ ignoredByPatterns })({
        option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "weakens" } }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
    expect(ignoredByPatterns).not.toHaveBeenCalled();
  });
});

describe("scriptOptionJudge, what is not positively settled", () => {
  it.each<OptionEffect>([
    { kind: "names-config", config: "eslint.config.mjs" },
    { kind: "ignores-pattern", pattern: "legacy/**" },
  ])(
    "weakens $kind when a value or target is not resolved, without asking ESLint anything",
    async (effect) => {
      const query = queryFinding(foundAt("/repo/eslint.config.mjs"));
      const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>();
      await expect(
        judgeOver({ query, ignoredByPatterns })({
          option: {
            ...optionAt({ location: ROOT_PACKAGE, effect }),
            settlement: { kind: "unresolved" },
          },
        }),
      ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
      expect({
        configs: vi.mocked(query.configFileOf).mock.calls,
        ignores: ignoredByPatterns.mock.calls,
      }).toEqual({ configs: [], ignores: [] });
    },
  );

  it.each<{ readonly effect: OptionEffect; readonly reason: NotPlainReason }>([
    {
      effect: { kind: "names-config", config: "eslint.config.mjs" },
      reason: { kind: "after-another-command", invocation: "eslint ." },
    },
    {
      effect: { kind: "ignores-pattern", pattern: "legacy/**" },
      reason: { kind: "wrapped", wrapper: "env" },
    },
  ])(
    "reports $effect.kind as not judged, for the reason eslint is not run plainly, without asking ESLint anything",
    async ({ effect, reason }) => {
      const query = queryFinding(foundAt("/repo/eslint.config.mjs"));
      const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>();
      await expect(
        judgeOver({ query, ignoredByPatterns })({
          option: {
            ...optionAt({ location: ROOT_PACKAGE, effect }),
            settlement: { kind: "not-plain", reason },
          },
        }),
      ).resolves.toEqual({ outcome: "ok", value: { kind: "not-plain", reason } });
      expect({
        configs: vi.mocked(query.configFileOf).mock.calls,
        ignores: ignoredByPatterns.mock.calls,
      }).toEqual({ configs: [], ignores: [] });
    },
  );

  it("weakens an option that always weakens even when eslint is not run plainly", async () => {
    await expect(
      judgeOver({})({
        option: {
          ...optionAt({ location: ROOT_PACKAGE, effect: { kind: "weakens" } }),
          settlement: { kind: "not-plain", reason: { kind: "wrapped", wrapper: "env" } },
        },
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });

  it.each<OptionEffect>([
    { kind: "names-config", config: "eslint.config.mjs" },
    { kind: "ignores-pattern", pattern: "legacy/**" },
  ])("weakens $kind when no checked file is under the script's folder", async (effect) => {
    await expect(
      judgeOver({ query: queryFinding(foundAt("/repo/tools/eslint.config.mjs")) })({
        option: optionAt({ location: repoPathOf("tools/package.json"), effect }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });
});

describe("scriptOptionJudge, a config option", () => {
  it("weakens nothing when it names, from the script's folder, the config the team's ESLint finds for every checked file there", async () => {
    const query = queryFinding(foundAt("/repo/packages/a/eslint.config.mjs"));
    await expect(
      judgeOver({ query })({
        option: optionAt({
          location: NESTED_PACKAGE,
          effect: { kind: "names-config", config: "eslint.config.mjs" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens-nothing" } });
    expect(vi.mocked(query.configFileOf).mock.calls).toEqual([[{ file: NESTED_FILE }]]);
  });

  it("weakens nothing when it names the root config by a path that climbs out of the script's folder", async () => {
    const query = queryFinding(foundAt("/repo/eslint.config.mjs"));
    await expect(
      judgeOver({ query })({
        option: optionAt({
          location: NESTED_PACKAGE,
          effect: { kind: "names-config", config: "../../eslint.config.mjs" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens-nothing" } });
  });

  it("weakens when any checked file in the script's folder is governed by another config", async () => {
    const query = queryFindingInTurn({
      first: foundAt("/repo/eslint.config.mjs"),
      second: foundAt("/repo/packages/a/eslint.config.mjs"),
    });
    await expect(
      judgeOver({ query })({
        option: optionAt({
          location: ROOT_PACKAGE,
          effect: { kind: "names-config", config: "eslint.config.mjs" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });

  it("weakens when it names a config other than the one the team's ESLint finds", async () => {
    const query = queryFinding(foundAt("/repo/eslint.config.mjs"));
    await expect(
      judgeOver({ query })({
        option: optionAt({
          location: ROOT_PACKAGE,
          effect: { kind: "names-config", config: "alt.config.mjs" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });

  it("weakens when no config is found for a checked file", async () => {
    await expect(
      judgeOver({})({
        option: optionAt({
          location: ROOT_PACKAGE,
          effect: { kind: "names-config", config: "eslint.config.mjs" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });

  it("weakens when it names a path outside the repository", async () => {
    await expect(
      judgeOver({})({
        option: optionAt({
          location: ROOT_PACKAGE,
          effect: { kind: "names-config", config: "../shared/eslint.config.mjs" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });
});

describe("scriptOptionJudge, an ignore pattern", () => {
  it("weakens nothing when ESLint, from the script's folder, ignores no checked file there by that pattern", async () => {
    const ignoredByPatterns = vi
      .fn<EslintPort["ignoredByPatterns"]>()
      .mockResolvedValue({ outcome: "ok", value: ["checked"] });
    await expect(
      judgeOver({ ignoredByPatterns })({
        option: optionAt({
          location: NESTED_PACKAGE,
          effect: { kind: "ignores-pattern", pattern: "dist/**" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens-nothing" } });
    expect(ignoredByPatterns.mock.calls).toEqual([
      [{ cwd: "/repo/packages/a", patterns: ["dist/**"], paths: ["src/b.ts"] }],
    ]);
  });

  it("weakens when ESLint ignores a checked file by that pattern", async () => {
    const ignoredByPatterns = vi
      .fn<EslintPort["ignoredByPatterns"]>()
      .mockResolvedValue({ outcome: "ok", value: ["checked", "ignored"] });
    await expect(
      judgeOver({ ignoredByPatterns })({
        option: optionAt({
          location: ROOT_PACKAGE,
          effect: { kind: "ignores-pattern", pattern: "packages/**" },
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: { kind: "weakens" } });
  });

  it("passes ESLint's failure on the pattern through", async () => {
    const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid pattern" },
    });
    await expect(
      judgeOver({ ignoredByPatterns })({
        option: optionAt({
          location: ROOT_PACKAGE,
          effect: { kind: "ignores-pattern", pattern: "[" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid pattern" },
    });
  });
});
