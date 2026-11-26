import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type {
  ConfigFileSearch,
  EslintPort,
  IgnoredState,
  QueryInstance,
} from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import {
  brokenConfigVerdict,
  cachedGoverningIgnores,
  type GoverningIgnores,
  type GoverningLookup,
  governingConfigIgnores,
} from "./governing-config.ts";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  projectionTypeText: "readonly unknown[]",
};

const REPO_ROOT = absoluteRootOf("/repo");
const PACKAGE_FOLDER = absoluteRootOf("/repo/packages/a");
const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const FIXTURE_FILE = repoPathOf("fixtures/bad/b.ts");
const PACKAGE_FIXTURE_FILE = repoPathOf("packages/a/fixtures/bad/p.ts");

const BROKEN_FIXTURE_CONFIG = "/repo/fixtures/bad/eslint.config.mjs";
const BROKEN_PACKAGE_FIXTURE_CONFIG = "/repo/packages/a/fixtures/bad/eslint.config.mjs";

const ROOT_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/eslint.config.mjs" };
const PACKAGE_CONFIG: ConfigFileSearch = {
  kind: "found",
  path: "/repo/packages/a/eslint.config.mjs",
};

const ROOT_GOVERNING = { configFile: "/repo/eslint.config.mjs", folder: REPO_ROOT };
const PACKAGE_GOVERNING = {
  configFile: "/repo/packages/a/eslint.config.mjs",
  folder: PACKAGE_FOLDER,
};

const FILE_CHECKED: Result<IgnoredState, RunnerFailure> = { outcome: "ok", value: "checked" };
const FILE_IGNORED: Result<IgnoredState, RunnerFailure> = { outcome: "ok", value: "ignored" };
const CONFIG_UNLOADABLE: Result<IgnoredState, RunnerFailure> = {
  outcome: "failed",
  error: { kind: "team-config-unloadable", detail: "Unexpected token ';'" },
};

const teamQuery = (configs: Readonly<Record<string, ConfigFileSearch>>): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>(),
  ruleState: vi.fn<QueryInstance["ruleState"]>(),
  configFileOf: ({ file }) => Promise.resolve(configs[file]),
});

const portOver = (ignoredByConfig: EslintPort["ignoredByConfig"]): EslintPort => ({
  boundary: SILENT_BOUNDARY,
  createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>(),
  createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>(),
  lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
  ignoredByConfig,
  ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
});

const lookupOver = (request: {
  readonly query: QueryInstance;
  readonly governingIgnoreOf: GoverningIgnores;
}): GoverningLookup => ({
  ...request,
  path: PATH,
  repoRoot: REPO_ROOT,
});

const FIXTURE_TEAM = teamQuery({ "fixtures/bad": ROOT_CONFIG });

const PACKAGE_FIXTURE_TEAM = teamQuery({
  "packages/a/fixtures/bad": PACKAGE_CONFIG,
  "packages/a": ROOT_CONFIG,
});

describe("governingConfigIgnores, whether a governing config really ignores a path", () => {
  it("asks about a folder through a probe file in it that the question itself matches, so only a real ignore answers ignored", async () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_IGNORED);
    const answer = await governingConfigIgnores({
      eslint: portOver(ignoredByConfig),
      governing: ROOT_GOVERNING,
      target: { kind: "folder", path: repoPathOf("fixtures/bad") },
    });
    expect({ answer, asked: ignoredByConfig.mock.calls }).toEqual({
      answer: "ignored",
      asked: [
        [
          {
            configFile: "/repo/eslint.config.mjs",
            cwd: "/repo",
            path: "fixtures/bad/hone-folder-probe",
          },
        ],
      ],
    });
  });

  it("asks about a file by its own path", async () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_CHECKED);
    const answer = await governingConfigIgnores({
      eslint: portOver(ignoredByConfig),
      governing: PACKAGE_GOVERNING,
      target: { kind: "file", path: repoPathOf("src/w.ts") },
    });
    expect({ answer, asked: ignoredByConfig.mock.calls }).toEqual({
      answer: "not-ignored",
      asked: [
        [
          {
            configFile: "/repo/packages/a/eslint.config.mjs",
            cwd: "/repo/packages/a",
            path: "src/w.ts",
          },
        ],
      ],
    });
  });

  it("is unanswered when the governing config itself fails to load", async () => {
    await expect(
      governingConfigIgnores({
        eslint: portOver(
          vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(CONFIG_UNLOADABLE),
        ),
        governing: ROOT_GOVERNING,
        target: { kind: "file", path: FIXTURE_FILE },
      }),
    ).resolves.toBe("unanswered");
  });
});

describe("cachedGoverningIgnores", () => {
  it("asks each governing config about each path once and reuses the answer", async () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(FILE_IGNORED);
    const governingIgnoreOf = cachedGoverningIgnores({ eslint: portOver(ignoredByConfig) });
    const folder = { kind: "folder", path: repoPathOf("fixtures/bad") } as const;
    await governingIgnoreOf({ governing: ROOT_GOVERNING, target: folder });
    await governingIgnoreOf({ governing: PACKAGE_GOVERNING, target: folder });
    await governingIgnoreOf({ governing: ROOT_GOVERNING, target: folder });
    expect(ignoredByConfig.mock.calls).toEqual([
      [
        {
          configFile: "/repo/eslint.config.mjs",
          cwd: "/repo",
          path: "fixtures/bad/hone-folder-probe",
        },
      ],
      [
        {
          configFile: "/repo/packages/a/eslint.config.mjs",
          cwd: "/repo/packages/a",
          path: "fixtures/bad/hone-folder-probe",
        },
      ],
    ]);
  });

  it("asks nothing until a question comes", () => {
    const ignoredByConfig = vi.fn<EslintPort["ignoredByConfig"]>();
    cachedGoverningIgnores({ eslint: portOver(ignoredByConfig) });
    expect(ignoredByConfig.mock.calls).toEqual([]);
  });
});

describe("brokenConfigVerdict for a broken config whose folder the root config governs", () => {
  it("is ignored-by-governing-config when the root config ignores both the broken config's folder and the file", async () => {
    const governingIgnoreOf = vi.fn<GoverningIgnores>().mockResolvedValue("ignored");
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: FIXTURE_TEAM, governingIgnoreOf }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "ignored-by-governing-config",
      asked: [
        [{ governing: ROOT_GOVERNING, target: { kind: "folder", path: "fixtures/bad" } }],
        [{ governing: ROOT_GOVERNING, target: { kind: "file", path: "fixtures/bad/b.ts" } }],
      ],
    });
  });

  it("is not-ignored, asking nothing about the file, when the root config does not ignore the folder", async () => {
    const governingIgnoreOf = vi.fn<GoverningIgnores>().mockResolvedValue("not-ignored");
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: FIXTURE_TEAM, governingIgnoreOf }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "not-ignored",
      asked: [[{ governing: ROOT_GOVERNING, target: { kind: "folder", path: "fixtures/bad" } }]],
    });
  });

  it("is not-ignored when the root config ignores the folder's probe but not the file itself", async () => {
    const governingIgnoreOf = vi
      .fn<GoverningIgnores>()
      .mockResolvedValueOnce("ignored")
      .mockResolvedValueOnce("not-ignored");
    await expect(
      brokenConfigVerdict({
        lookup: lookupOver({ query: FIXTURE_TEAM, governingIgnoreOf }),
        brokenConfig: BROKEN_FIXTURE_CONFIG,
        file: FIXTURE_FILE,
      }),
    ).resolves.toBe("not-ignored");
  });
});

describe("brokenConfigVerdict for a broken config below an intermediate config", () => {
  it("asks the intermediate config with paths relative to its own folder and stops when it ignores both", async () => {
    const governingIgnoreOf = vi.fn<GoverningIgnores>().mockResolvedValue("ignored");
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingIgnoreOf }),
      brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
      file: PACKAGE_FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "ignored-by-governing-config",
      asked: [
        [{ governing: PACKAGE_GOVERNING, target: { kind: "folder", path: "fixtures/bad" } }],
        [{ governing: PACKAGE_GOVERNING, target: { kind: "file", path: "fixtures/bad/p.ts" } }],
      ],
    });
  });

  it("asks the root config about the intermediate config's folder when the intermediate config does not ignore the broken one's", async () => {
    const governingIgnoreOf = vi
      .fn<GoverningIgnores>()
      .mockResolvedValueOnce("not-ignored")
      .mockResolvedValueOnce("ignored")
      .mockResolvedValueOnce("ignored");
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingIgnoreOf }),
      brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
      file: PACKAGE_FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "ignored-by-governing-config",
      asked: [
        [{ governing: PACKAGE_GOVERNING, target: { kind: "folder", path: "fixtures/bad" } }],
        [{ governing: ROOT_GOVERNING, target: { kind: "folder", path: "packages/a" } }],
        [
          {
            governing: ROOT_GOVERNING,
            target: { kind: "file", path: "packages/a/fixtures/bad/p.ts" },
          },
        ],
      ],
    });
  });
});

describe("brokenConfigVerdict for a broken config below an intermediate config that itself fails to load", () => {
  it("reads past the intermediate config to the config governing its folder", async () => {
    const governingIgnoreOf = vi
      .fn<GoverningIgnores>()
      .mockResolvedValueOnce("unanswered")
      .mockResolvedValueOnce("ignored")
      .mockResolvedValueOnce("ignored");
    await expect(
      brokenConfigVerdict({
        lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingIgnoreOf }),
        brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
        file: PACKAGE_FIXTURE_FILE,
      }),
    ).resolves.toBe("ignored-by-governing-config");
  });

  it("is not-ignored when neither the intermediate nor the root config ignores the folder", async () => {
    const governingIgnoreOf = vi
      .fn<GoverningIgnores>()
      .mockResolvedValueOnce("unanswered")
      .mockResolvedValueOnce("not-ignored");
    await expect(
      brokenConfigVerdict({
        lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingIgnoreOf }),
        brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
        file: PACKAGE_FIXTURE_FILE,
      }),
    ).resolves.toBe("not-ignored");
  });
});

describe("brokenConfigVerdict where no config governs above the broken one", () => {
  it("asks nothing when the broken config is the repository root's", async () => {
    const query = { ...teamQuery({}), configFileOf: vi.fn<QueryInstance["configFileOf"]>() };
    const governingIgnoreOf = vi.fn<GoverningIgnores>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query, governingIgnoreOf }),
      brokenConfig: "/repo/eslint.config.mjs",
      file: repoPathOf("src/a.ts"),
    });
    expect({
      verdict,
      lookups: query.configFileOf.mock.calls,
      asked: governingIgnoreOf.mock.calls,
    }).toEqual({
      verdict: "not-ignored",
      lookups: [],
      asked: [],
    });
  });

  it("never asks a config above the repository root", async () => {
    const governingIgnoreOf = vi.fn<GoverningIgnores>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({
        query: teamQuery({ "fixtures/bad": { kind: "found", path: "/eslint.config.mjs" } }),
        governingIgnoreOf,
      }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "not-ignored",
      asked: [],
    });
  });

  it("never asks the broken config itself, as a lookup on one fixed config returns", async () => {
    const governingIgnoreOf = vi.fn<GoverningIgnores>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({
        query: teamQuery({ "fixtures/bad": { kind: "found", path: BROKEN_FIXTURE_CONFIG } }),
        governingIgnoreOf,
      }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "not-ignored",
      asked: [],
    });
  });

  it("is not-ignored when no config governs the broken config's folder", async () => {
    const governingIgnoreOf = vi.fn<GoverningIgnores>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({
        query: teamQuery({ "fixtures/bad": { kind: "none" } }),
        governingIgnoreOf,
      }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, asked: governingIgnoreOf.mock.calls }).toEqual({
      verdict: "not-ignored",
      asked: [],
    });
  });
});
