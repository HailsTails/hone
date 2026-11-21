import { z } from "zod";
import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { RunnerClause } from "../../../protocol/runner-module/runner-module-schema.ts";
import type { CaseVerdict } from "../../../protocol/runner-module/runner-result-schema.ts";
import type { SourceCase } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import { type EslintPort, reservedNamespace } from "../toolchain/eslint-instance.ts";
import { type EslintPieceSettings, eslintPieceSettingsSchema, ruleOptionsOf } from "../pieces/eslint-piece-settings-schema.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "../pieces/eslint-plugin-schema.ts";
import { namespaceOwnershipRefusal } from "../pieces/namespace-ownership.ts";

export type Outcome<Value> = Result<Value, RunnerFailure>;

export type ConfiguredClause = {
  readonly clause: RunnerClause;
  readonly settings: EslintPieceSettings;
  readonly ruleId: string;
  readonly modulePath: string;
};

export type LoadedClause<Clause extends ConfiguredClause> = Clause & { readonly plugin: LoadedEslintPlugin };

export type ParsedPlugin = Result<LoadedEslintPlugin, { readonly detail: string }>;

export const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

export const configuredClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
}): Outcome<ConfiguredClause> => {
  const settings = eslintPieceSettingsSchema.safeParse(request.clause.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: z.prettifyError(settings.error) });
  }
  const refusal = namespaceOwnershipRefusal({
    address: request.clause.address,
    pluginNamespace: settings.data.pluginNamespace,
  });
  if (refusal !== undefined) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: refusal });
  }
  if (settings.data.pluginNamespace === reservedNamespace) {
    return pieceInvalid({
      pieceRoot: request.clause.pieceRoot,
      detail: `the plugin namespace ${reservedNamespace} is reserved for ${TOOL_IDENTITY.command}'s own rules`,
    });
  }
  return {
    outcome: "ok",
    value: {
      clause: request.clause,
      settings: settings.data,
      ruleId: `${settings.data.pluginNamespace}/${settings.data.rule}`,
      modulePath: request.path.join({
        segments: [request.clause.pieceRoot, settings.data.pluginModule],
      }),
    },
  };
};

export const parsedPluginOf = (request: { readonly loaded: ModuleLoad }): ParsedPlugin => {
  if (request.loaded.outcome === "failed") {
    return { outcome: "failed", error: { detail: request.loaded.error.detail } };
  }
  const parsed = eslintPluginModuleSchema.safeParse(request.loaded.value);
  if (!parsed.success) {
    return { outcome: "failed", error: { detail: z.prettifyError(parsed.error) } };
  }
  return { outcome: "ok", value: parsed.data.default };
};

export const pluginOf = <Clause extends ConfiguredClause>(request: {
  readonly parsed: ParsedPlugin;
  readonly configured: Clause;
}): Outcome<LoadedClause<Clause>> => {
  const pieceRoot = request.configured.clause.pieceRoot;
  if (request.parsed.outcome === "failed") {
    return pieceInvalid({ pieceRoot, detail: request.parsed.error.detail });
  }
  if (!Object.hasOwn(request.parsed.value.rules, request.configured.settings.rule)) {
    return pieceInvalid({
      pieceRoot,
      detail: `the plugin has no rule named ${request.configured.settings.rule}`,
    });
  }
  return { outcome: "ok", value: { ...request.configured, plugin: request.parsed.value } };
};

export const loadedPieceClauseOf = (request: {
  readonly configured: ConfiguredClause;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<LoadedClause<ConfiguredClause>>> =>
  request.modules.load({ path: request.configured.modulePath }).then((loaded) =>
    pluginOf({ parsed: parsedPluginOf({ loaded }), configured: request.configured }),
  );

const lintedSourceCases = (request: {
  readonly selected: Outcome<LoadedClause<ConfiguredClause>>;
  readonly cwd: AbsolutePath;
  readonly cases: readonly SourceCase[];
  readonly eslint: Pick<EslintPort, "lintSourceCases">;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  if (request.selected.outcome === "failed") {
    return Promise.resolve(request.selected);
  }
  return request.eslint.lintSourceCases({
    cwd: request.cwd,
    plugin: request.selected.value.plugin,
    pluginNamespace: request.selected.value.settings.pluginNamespace,
    rule: request.selected.value.settings.rule,
    options: ruleOptionsOf({ settings: request.selected.value.settings }),
    cases: request.cases,
  });
};

export const conformedCases = (request: {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly path: PathPort;
  readonly eslint: Pick<EslintPort, "lintSourceCases">;
  readonly loadedPlugin: (request: { readonly configured: ConfiguredClause }) => Promise<Outcome<LoadedClause<ConfiguredClause>>>;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const configured = configuredClause({ clause: request.clause, path: request.path });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  const cwd = absolutePathSchema.safeParse(request.clause.pieceRoot);
  if (!cwd.success) {
    return Promise.resolve(pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: z.prettifyError(cwd.error) }));
  }
  return request.loadedPlugin({ configured: configured.value }).then((selected) =>
    lintedSourceCases({ selected, cwd: cwd.data, cases: request.cases, eslint: request.eslint }),
  );
};
