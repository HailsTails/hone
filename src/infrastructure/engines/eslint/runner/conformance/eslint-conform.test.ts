import { describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type { CaseVerdict } from "../../../../../domain/runner/runner-result-types.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import {
  type ConfiguredClause,
  conformedCases,
  configuredClause,
  type LoadedClause,
  loadedPieceClauseOf,
  type Outcome,
  parsedPluginOf,
  pluginOf,
} from "./eslint-conform.ts";
import type { EslintPort } from "../toolchain/eslint-instance.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";

const PIECE_ROOT = "/install/mechanisms/eslint/CD-14";

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const CLASS_CLAUSE: RunnerClause = {
  address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") },
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: PIECE_ROOT,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { pluginNamespace: "hone", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const ACME_CLAUSE: RunnerClause = { ...CLASS_CLAUSE, address: { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("ACME-2"), clause: clauseIdOf("scratch-files") } };

const PLUGIN = { rules: { "no-class-authoring": { meta: { type: "problem" as const }, create: () => ({}) } } };

const CONFIGURED: ConfiguredClause = {
  clause: CLASS_CLAUSE,
  settings: { pluginNamespace: "hone", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
  ruleId: "hone/no-class-authoring",
  modulePath: "/install/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
};

const CLASS_CASE: SourceCase = {
  name: "class",
  fileName: repoPathOf("cases/class.ts"),
  source: "class A {}\n",
  expectedLines: [1],
};

const CLASS_VERDICTS: Result<readonly CaseVerdict[], RunnerFailure> = {
  outcome: "ok",
  value: [{ caseName: "class", flaggedLines: [1] }],
};

const LOADED: Outcome<LoadedClause<ConfiguredClause>> = { outcome: "ok", value: { ...CONFIGURED, plugin: PLUGIN } };

type LoadsPlugin = (request: { readonly configured: ConfiguredClause }) => Promise<Outcome<LoadedClause<ConfiguredClause>>>;

const eslintLinting = (lintSourceCases: EslintPort["lintSourceCases"]): Pick<EslintPort, "lintSourceCases"> => ({ lintSourceCases });

describe("configuredClause", () => {
  it("reads a clause's piece settings into its rule id and the plugin module's path inside the piece root", () => {
    expect(configuredClause({ clause: CLASS_CLAUSE, path: POSIX_PATH })).toEqual({ outcome: "ok", value: CONFIGURED });
  });

  it("is piece-invalid, naming the piece root, for settings outside the schema", () => {
    expect(configuredClause({ clause: { ...CLASS_CLAUSE, settings: { rule: 1 } }, path: POSIX_PATH })).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT },
    });
  });

  it("is piece-invalid for the namespace reserved for the tool's own rules", () => {
    const reserved = { pluginNamespace: "hone-core", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" };
    expect(configuredClause({ clause: { ...CLASS_CLAUSE, settings: reserved }, path: POSIX_PATH })).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "the plugin namespace hone-core is reserved for hone's own rules" },
    });
  });

  it("is piece-invalid for a namespace the clause's rule set does not own", () => {
    const foreign = { pluginNamespace: "other", pluginModule: "scratch/scratch.eslint-plugin.ts", rule: "no-scratch" };
    expect(configuredClause({ clause: { ...ACME_CLAUSE, settings: foreign }, path: POSIX_PATH })).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "the plugin namespace other is not owned by the rule set acme; use acme or acme-<name>" },
    });
  });

  it("refuses a namespace another rule set owns before the reserved namespace", () => {
    const reserved = { pluginNamespace: "hone-core", pluginModule: "scratch/scratch.eslint-plugin.ts", rule: "no-scratch" };
    expect(configuredClause({ clause: { ...ACME_CLAUSE, settings: reserved }, path: POSIX_PATH })).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "the plugin namespace hone-core belongs to Hone; the rule set acme must use acme or acme-<name>" },
    });
  });
});

describe("parsedPluginOf", () => {
  it("gives the plugin a loaded module exports as its default", () => {
    expect(parsedPluginOf({ loaded: { outcome: "ok", value: { default: PLUGIN } } })).toEqual({
      outcome: "ok",
      value: { rules: { "no-class-authoring": { meta: { type: "problem" }, create: expect.any(Function) } } },
    });
  });

  it("gives the loader's detail when the module did not load", () => {
    expect(
      parsedPluginOf({ loaded: { outcome: "failed", error: { kind: "module-unloadable", path: "/p.ts", detail: "Cannot find module" } } }),
    ).toEqual({ outcome: "failed", error: { detail: "Cannot find module" } });
  });

  it("fails for a module that exports no plugin", () => {
    expect(parsedPluginOf({ loaded: { outcome: "ok", value: {} } })).toMatchObject({ outcome: "failed" });
  });
});

describe("pluginOf", () => {
  it("joins the configured clause with its plugin when the plugin has the clause's rule", () => {
    expect(pluginOf({ parsed: { outcome: "ok", value: PLUGIN }, configured: CONFIGURED })).toEqual(LOADED);
  });

  it("is piece-invalid when the plugin has no rule of the clause's name", () => {
    expect(pluginOf({ parsed: { outcome: "ok", value: { rules: {} } }, configured: CONFIGURED })).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "the plugin has no rule named no-class-authoring" },
    });
  });

  it("is piece-invalid with the load's detail when the plugin did not parse", () => {
    expect(pluginOf({ parsed: { outcome: "failed", error: { detail: "Cannot find module" } }, configured: CONFIGURED })).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "Cannot find module" },
    });
  });
});

describe("loadedPieceClauseOf", () => {
  const loading = (loaded: Awaited<ReturnType<ModuleLoaderPort["load"]>>) => ({ load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(loaded) });

  it("loads the configured clause's plugin module from its path and joins the plugin to the clause", async () => {
    const modules = loading({ outcome: "ok", value: { default: PLUGIN } });
    await expect(loadedPieceClauseOf({ configured: CONFIGURED, modules })).resolves.toEqual({
      outcome: "ok",
      value: { ...CONFIGURED, plugin: { rules: { "no-class-authoring": { meta: { type: "problem" }, create: expect.any(Function) } } } },
    });
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: "/install/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts" });
  });

  it("is piece-invalid with the loader's detail when the module does not load", async () => {
    const modules = loading({ outcome: "failed", error: { kind: "module-unloadable", path: "/p.ts", detail: "Cannot find module" } });
    await expect(loadedPieceClauseOf({ configured: CONFIGURED, modules })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "Cannot find module" },
    });
  });
});

describe("conformedCases", () => {
  it("lints the cases in the piece root with the plugin the caller loaded, and returns their verdicts", async () => {
    const lintSourceCases = vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(CLASS_VERDICTS);
    const loadedPlugin = vi.fn<LoadsPlugin>().mockResolvedValue(LOADED);
    await expect(
      conformedCases({ clause: CLASS_CLAUSE, cases: [CLASS_CASE], path: POSIX_PATH, eslint: eslintLinting(lintSourceCases), loadedPlugin }),
    ).resolves.toEqual(CLASS_VERDICTS);
    expect({ loads: loadedPlugin.mock.calls, lints: lintSourceCases.mock.calls }).toEqual({
      loads: [[{ configured: CONFIGURED }]],
      lints: [[{ cwd: PIECE_ROOT, plugin: PLUGIN, pluginNamespace: "hone", rule: "no-class-authoring", options: [], cases: [CLASS_CASE] }]],
    });
  });

  it("gives the caller's plugin failure without linting", async () => {
    const failure: Outcome<LoadedClause<ConfiguredClause>> = {
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "Cannot find module" },
    };
    const lintSourceCases = vi.fn<EslintPort["lintSourceCases"]>();
    await expect(
      conformedCases({
        clause: CLASS_CLAUSE,
        cases: [CLASS_CASE],
        path: POSIX_PATH,
        eslint: eslintLinting(lintSourceCases),
        loadedPlugin: vi.fn<LoadsPlugin>().mockResolvedValue(failure),
      }),
    ).resolves.toEqual(failure);
    expect(lintSourceCases).not.toHaveBeenCalled();
  });

  it("is piece-invalid, loading nothing, for settings outside the schema", async () => {
    const loadedPlugin = vi.fn<LoadsPlugin>();
    await expect(
      conformedCases({
        clause: { ...CLASS_CLAUSE, settings: {} },
        cases: [CLASS_CASE],
        path: POSIX_PATH,
        eslint: eslintLinting(vi.fn<EslintPort["lintSourceCases"]>()),
        loadedPlugin,
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "piece-invalid" } });
    expect(loadedPlugin).not.toHaveBeenCalled();
  });

  it("is piece-invalid when the piece root is not an absolute path", async () => {
    await expect(
      conformedCases({
        clause: { ...CLASS_CLAUSE, pieceRoot: "relative/CD-14" },
        cases: [CLASS_CASE],
        path: POSIX_PATH,
        eslint: eslintLinting(vi.fn<EslintPort["lintSourceCases"]>()),
        loadedPlugin: vi.fn<LoadsPlugin>().mockResolvedValue(LOADED),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: "relative/CD-14" } });
  });
});
