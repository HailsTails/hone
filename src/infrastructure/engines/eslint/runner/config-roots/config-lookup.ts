import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import { parsedJson } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import {
  eslintVersionFileSchema,
  packageJsonSchema,
} from "../native-exceptions/eslint-file-schemas.ts";
import {
  eslintInvocationsOf,
  scriptCommandsOf,
} from "../native-exceptions/package-script-scanner.ts";

export type ConfigLookup =
  | { readonly kind: "nearest-to-file" }
  | { readonly kind: "repository-root"; readonly configFile: string };

type EslintMajor = number | "unknown";

const ROOT_LOOKUP_MAJOR = 9;

const ESLINT_PACKAGE_JSON = ["node_modules", "eslint", "package.json"];

const PACKAGE_JSON_NAME = "package.json";

const FLAG_OPTION = "--flag";

const FLAG_OPTION_JOINED = `${FLAG_OPTION}=`;

const NEAREST_LOOKUP_FLAGS: ReadonlySet<string> = new Set([
  "v10_config_lookup_from_file",
  "unstable_config_lookup_from_file",
]);

export const CONFIG_FILE_NAMES: readonly string[] = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

const NEAREST: ConfigLookup = { kind: "nearest-to-file" };

type LookupRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

const installedEslintMajor = (
  request: Pick<LookupRequest, "fileText" | "path" | "repoRoot">,
): EslintMajor => {
  const text = request.fileText.read({
    path: request.path.join({ segments: [request.repoRoot, ...ESLINT_PACKAGE_JSON] }),
  });
  if (text.outcome === "failed") {
    return "unknown";
  }
  const json = parsedJson({ text: text.value });
  const parsed = json.outcome === "ok" ? eslintVersionFileSchema.safeParse(json.value) : undefined;
  const major = parsed?.success ? Number.parseInt(parsed.data.version, 10) : Number.NaN;
  return Number.isNaN(major) ? "unknown" : major;
};

const flagsNamedBy = (request: { readonly options: readonly string[] }): readonly string[] =>
  request.options.flatMap((option, index) => {
    if (option.startsWith(FLAG_OPTION_JOINED)) {
      return [option.slice(FLAG_OPTION_JOINED.length)];
    }
    const next = request.options[index + 1];
    return option === FLAG_OPTION && next !== undefined ? [next] : [];
  });

const scriptsOf = (
  request: LookupRequest & { readonly packagePath: RepoPath },
): readonly string[] => {
  const text = request.fileText.read({
    path: request.path.join({ segments: [request.repoRoot, request.packagePath] }),
  });
  const json = text.outcome === "ok" ? parsedJson({ text: text.value }) : undefined;
  const parsed = json?.outcome === "ok" ? packageJsonSchema.safeParse(json.value) : undefined;
  return parsed?.success ? Object.values(parsed.data.scripts ?? {}) : [];
};

const lintScriptsSelectNearest = (request: LookupRequest): "selects-nearest" | "selects-root" =>
  request.trackedPaths
    .filter((path) => path.split("/").at(-1) === PACKAGE_JSON_NAME)
    .flatMap((packagePath) => scriptsOf({ ...request, packagePath }))
    .flatMap((script) => {
      const commands = scriptCommandsOf({ script });
      return commands.outcome === "ok" ? eslintInvocationsOf({ commands: commands.value }) : [];
    })
    .flatMap((invocation) => flagsNamedBy({ options: invocation.options }))
    .some((flag) => NEAREST_LOOKUP_FLAGS.has(flag))
    ? "selects-nearest"
    : "selects-root";

const rootConfigFile = (
  request: Pick<LookupRequest, "fileText" | "path" | "repoRoot">,
): string | undefined =>
  CONFIG_FILE_NAMES.map((name) => request.path.join({ segments: [request.repoRoot, name] })).find(
    (candidate) => request.fileText.exists({ path: candidate }) === "present",
  );

export type FolderConfiguration = "configured" | "unconfigured";

export const folderConfigurationOf = (
  request: Pick<LookupRequest, "fileText" | "path" | "repoRoot"> & { readonly folder: RepoPath },
): FolderConfiguration =>
  CONFIG_FILE_NAMES.some(
    (name) =>
      request.fileText.exists({
        path: request.path.join({ segments: [request.repoRoot, request.folder, name] }),
      }) === "present",
  )
    ? "configured"
    : "unconfigured";

const detectedLookup = (request: LookupRequest): EslintConfigLookup =>
  installedEslintMajor(request) !== ROOT_LOOKUP_MAJOR ||
  lintScriptsSelectNearest(request) === "selects-nearest"
    ? "nearest-to-file"
    : "repository-root";

export const configLookupDeclaring = (
  request: LookupRequest & { readonly declared: EslintConfigLookup | undefined },
): EslintConfigLookup => request.declared ?? detectedLookup(request);

export const teamConfigLookupFor = (
  request: LookupRequest & { readonly lookup: EslintConfigLookup; readonly settingsFile: string },
): Result<ConfigLookup, RunnerFailure> => {
  if (request.lookup === "nearest-to-file") {
    return { outcome: "ok", value: NEAREST };
  }
  const configFile = rootConfigFile(request);
  return configFile === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "team-config-unloadable",
          detail: `the repository root has no eslint.config.* for a root-only config lookup; add one there, or set eslintConfigLookup to nearest-to-file in ${request.settingsFile} if ESLint runs from each package`,
        },
      }
    : { outcome: "ok", value: { kind: "repository-root", configFile } };
};
