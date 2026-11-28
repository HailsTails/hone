import { mapToolCatalogueToEngineChecks } from "./application/run/engines/tool-engine-checks.ts";
import type { AbsolutePath } from "./domain/repository/absolute-path-types.ts";
import type { Result } from "./domain/result.ts";
import { TOOL_IDENTITY } from "./domain/rule-set/tool-identity.ts";
import { installRootOfApiEntry } from "./infrastructure/command-line/installation/install-root.ts";
import { createBoundCatalogueOf } from "./infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import type { ChecksPlugin } from "./infrastructure/engines/eslint/runner/hone-plugin/checks-plugin.ts";
import { createPluginAt } from "./infrastructure/engines/eslint/runner/hone-plugin/plugin-build.ts";
import { createDefaultDirectoryPort } from "./infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { runLoadFailureLine } from "./infrastructure/printed-report/load-failures/load-failure-lines.ts";
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
}): Promise<Result<ChecksPlugin, string>> => {
  const checks = mapToolCatalogueToEngineChecks({
    fileText,
    path,
    installRoot: request.installRoot,
    boundCatalogueOf: createBoundCatalogueOf({ directory: createDefaultDirectoryPort({}) }),
  });
  return checks.outcome === "failed"
    ? {
        outcome: "failed",
        error: runLoadFailureLine({ failure: checks.error, upgradeCommand: undefined }),
      }
    : createPluginAt({
        checks: checks.value,
        installRoot: request.installRoot,
        fileText,
        path,
        modules: createDefaultModuleLoaderPort({}),
      });
};

const installRoot = installRootOfApiEntry({ path, moduleUrl: import.meta.url });

const built: Result<ChecksPlugin, string> =
  installRoot.outcome === "failed"
    ? { outcome: "failed", error: loadFailureText({ failure: installRoot.error }) }
    : await pluginAt({ installRoot: installRoot.value });

if (built.outcome === "failed") {
  throw new Error(`${TOOL_IDENTITY.packageName}/eslint-plugin cannot be built: ${built.error}`);
}

const plugin: HonePlugin = built.value;

export default plugin;
