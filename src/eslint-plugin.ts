import { SYMPTOM_CATALOGUE_SEGMENTS } from "./domain/language-layer/symptom-catalogue-location.ts";
import type { AbsolutePath } from "./domain/repository/absolute-path-types.ts";
import type { Result } from "./domain/result.ts";
import { TOOL_RULE_SET } from "./domain/rule-set/clause-address.ts";
import { TOOL_IDENTITY } from "./domain/rule-set/tool-identity.ts";
import { installRootOfApiEntry } from "./infrastructure/command-line/installation/install-root.ts";
import { readBoundCatalogue } from "./infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import {
  honePluginAt,
  honePluginFailureText,
} from "./infrastructure/engines/eslint/runner/hone-plugin/hone-plugin.ts";
import { installedEslintBoundary } from "./infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { createDefaultDirectoryPort } from "./infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { loadFailureText } from "./infrastructure/printed-report/load-failures/load-failure-text.ts";

export type HoneNodeVisit = { visit(...nodes: unknown[]): void }["visit"];

export type HoneRuleVisitor = Readonly<Record<string, HoneNodeVisit | undefined>>;

export type HoneRule = { create(context: never): HoneRuleVisitor };

export type HonePlugin = {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: Readonly<Record<string, HoneRule>>;
};

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const pluginAt = async (request: {
  readonly installRoot: AbsolutePath;
}): Promise<Result<HonePlugin, string>> => {
  const catalogue = readBoundCatalogue({
    fileText,
    directory: createDefaultDirectoryPort({}),
    path,
    ruleSetRoot: request.installRoot,
    ruleSet: TOOL_RULE_SET,
    installRoot: request.installRoot,
  });
  if (catalogue.outcome === "failed") {
    return { outcome: "failed", error: loadFailureText({ failure: catalogue.error }) };
  }
  if (catalogue.value.held === "none") {
    return {
      outcome: "failed",
      error: `this install holds no ${SYMPTOM_CATALOGUE_SEGMENTS.join("/")} under ${request.installRoot}`,
    };
  }
  const boundary = await installedEslintBoundary();
  if (boundary.outcome === "failed") {
    return boundary;
  }
  const plugin = await honePluginAt({
    checks: catalogue.value.catalogue.checks,
    installRoot: request.installRoot,
    fileText,
    path,
    modules: createDefaultModuleLoaderPort({}),
    boundary: boundary.value,
  });
  return plugin.outcome === "failed"
    ? { outcome: "failed", error: honePluginFailureText({ failure: plugin.error }) }
    : plugin;
};

const installRoot = installRootOfApiEntry({ path, moduleUrl: import.meta.url });

const built: Result<HonePlugin, string> =
  installRoot.outcome === "failed"
    ? { outcome: "failed", error: loadFailureText({ failure: installRoot.error }) }
    : await pluginAt({ installRoot: installRoot.value });

if (built.outcome === "failed") {
  throw new Error(`${TOOL_IDENTITY.packageName}/eslint-plugin cannot be built: ${built.error}`);
}

const plugin: HonePlugin = built.value;

export default plugin;
