import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import { installedEslintBoundary } from "../toolchain/eslint-toolchain.ts";
import type { PluginCheck } from "./check-rule-id.ts";
import type { ChecksPlugin } from "./checks-plugin.ts";
import { honePluginAt, honePluginFailureText } from "./hone-plugin.ts";

export const createPluginAt = async (request: {
  readonly checks: readonly PluginCheck[];
  readonly installRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
}): Promise<Result<ChecksPlugin, string>> => {
  const boundary = await installedEslintBoundary();
  if (boundary.outcome === "failed") {
    return boundary;
  }
  const plugin = await honePluginAt({ ...request, boundary: boundary.value });
  return plugin.outcome === "failed"
    ? { outcome: "failed", error: honePluginFailureText({ failure: plugin.error }) }
    : plugin;
};
