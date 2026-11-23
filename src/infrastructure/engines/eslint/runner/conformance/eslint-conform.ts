import { z } from "zod";

import type {
  ModuleLoad,
  ModuleLoaderPort,
} from "../../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type { CaseVerdict } from "../../../../../domain/runner/runner-result-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import {
  type EslintPieceSettings,
  eslintPieceSettingsSchema,
  ruleOptionsOf,
} from "../pieces/eslint-piece-settings-schema.ts";
import {
  eslintPluginModuleSchema,
  type LoadedEslintPlugin,
} from "../pieces/eslint-plugin-schema.ts";
import { namespaceOwnershipRefusal } from "../pieces/namespace-ownership.ts";
import { type EslintPort, reservedNamespace } from "../toolchain/eslint-instance.ts";

export type Outcome<Value> = Result<Value, RunnerFailure>;

export type ConfiguredClause = {
  readonly clause: RunnerClause;
  readonly settings: EslintPieceSettings;
  readonly ruleId: string;
  readonly modulePath: string;
};

export type LoadedClause<Clause extends ConfiguredClause> = Clause & {
  readonly plugin: LoadedEslintPlugin;
};

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
    return pieceInvalid({
      pieceRoot: request.clause.pieceRoot,
      detail: z.prettifyError(settings.error),
    });
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

const lintedSourceCases = (request: {
  readonly selected: Outcome<{
    readonly plugin: LoadedEslintPlugin;
    readonly settings: EslintPieceSettings;
  }>;
  readonly cwd: AbsolutePath;
  readonly cases: readonly SourceCase[];
  readonly edition: CheckBinding["edition"];
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
    options: ruleOptionsOf({ settings: request.selected.value.settings, edition: request.edition }),
    cases: request.cases,
  });
};

export const conformedCases = (request: {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly path: PathPort;
  readonly eslint: Pick<EslintPort, "lintSourceCases">;
  readonly loadedPlugin: (request: {
    readonly configured: ConfiguredClause;
  }) => Promise<Outcome<LoadedClause<ConfiguredClause>>>;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const configured = configuredClause({ clause: request.clause, path: request.path });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  const cwd = absolutePathSchema.safeParse(request.clause.pieceRoot);
  if (!cwd.success) {
    return Promise.resolve(
      pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: z.prettifyError(cwd.error) }),
    );
  }
  return request.loadedPlugin({ configured: configured.value }).then((selected) =>
    lintedSourceCases({
      selected,
      cwd: cwd.data,
      edition: request.clause.edition,
      cases: request.cases,
      eslint: request.eslint,
    }),
  );
};

export const conformedNamedCases = async (request: {
  readonly binding: CheckBinding;
  readonly cases: readonly SourceCase[];
  readonly path: PathPort;
  readonly eslint: Pick<EslintPort, "lintSourceCases">;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const { binding } = request;
  const settings = eslintPieceSettingsSchema.safeParse(binding.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: binding.pieceRoot, detail: z.prettifyError(settings.error) });
  }
  const cwd = absolutePathSchema.safeParse(binding.pieceRoot);
  if (!cwd.success) {
    return pieceInvalid({ pieceRoot: binding.pieceRoot, detail: z.prettifyError(cwd.error) });
  }
  const source = request.path.join({ segments: [binding.pieceRoot, settings.data.pluginModule] });
  const parsed = parsedPluginOf({ loaded: await request.modules.load({ path: source }) });
  if (parsed.outcome === "failed") {
    return pieceInvalid({ pieceRoot: binding.pieceRoot, detail: parsed.error.detail });
  }
  if (!Object.hasOwn(parsed.value.rules, settings.data.rule)) {
    return pieceInvalid({
      pieceRoot: binding.pieceRoot,
      detail: `the plugin has no rule named ${settings.data.rule}`,
    });
  }
  return lintedSourceCases({
    selected: { outcome: "ok", value: { plugin: parsed.value, settings: settings.data } },
    cwd: cwd.data,
    edition: binding.edition,
    cases: request.cases,
    eslint: request.eslint,
  });
};
