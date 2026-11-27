import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { createDefaultDirectoryTreePort } from "../file-system/directory-tree-port.ts";
import {
  createDefaultDirectoryPort,
  createDefaultFileTextPort,
} from "../file-system/file-system-port.ts";
import { createDefaultPathPort } from "../path-port.ts";
import { runOxlintProcess, mapDiagnosticsToSites, type OxlintSite } from "./oxlint-diagnostics.ts";
import { removeDisableDirectives, type DisableDirective } from "./oxlint-directives.ts";
import { readOxlintToolchain } from "./oxlint-toolchain.ts";

export type { OxlintSite } from "./oxlint-diagnostics.ts";
export { OXLINT_RANGE } from "./oxlint-toolchain.ts";

const path = createDefaultPathPort({});
const directories = createDefaultDirectoryPort({});
const tree = createDefaultDirectoryTreePort({});
const text = createDefaultFileTextPort({});
export const OXLINT_RULES = [
  "typescript/no-explicit-any",
  "eslint/max-params",
  "eslint/no-param-reassign",
] as const;

export type OxlintRule = (typeof OXLINT_RULES)[number];

export type OxlintPluginRule = {
  readonly namespace: string;
  readonly peerFolder?: string | undefined;
  readonly id: string;
  readonly module: string;
  readonly options: readonly ReadonlyJsonValue[];
};

export type RunOxlint = (request: {
  readonly resolveFrom: string;
  readonly rules: readonly OxlintRule[];
  readonly nativeOptions?: ReadonlyMap<OxlintRule, readonly ReadonlyJsonValue[]>;
  readonly pluginRules?: readonly OxlintPluginRule[];
  readonly observeDisable?: (
    directive: Omit<DisableDirective, "fileName"> & { readonly index: number },
  ) => void;
  readonly sources: readonly { readonly fileName: string; readonly source: string }[];
}) => Promise<Result<readonly OxlintSite[], RunnerFailure>>;

const write = (request: {
  readonly folder: AbsolutePath;
  readonly file: string;
  readonly contents: string;
}): void => {
  const written = text.write({
    path: path.join({ segments: [request.folder, request.file] }),
    text: request.contents,
  });
  if (written.outcome === "failed") throw new Error(written.error.detail);
};

const createDirectory = (folder: AbsolutePath): void => {
  const created = directories.create({ path: folder });
  if (created.outcome === "failed") throw new Error(created.error.detail);
};

type OxlintRequest = Parameters<RunOxlint>[0];

const runInWorkspace = (
  request: OxlintRequest & {
    readonly cli: string;
    readonly folder: AbsolutePath;
  },
): readonly OxlintSite[] => {
  const files = request.sources.map(
    ({ fileName }, index) => `sources/${index}/${fileName.split("/").at(-1)}`,
  );
  const sources = new Map(
    files.map((file, index) => [file, Buffer.from(request.sources[index].source)]),
  );
  const configuration = { folder: request.folder, file: ".oxlintrc.json" };
  const categories = { correctness: "off" };
  const invocation = { cli: request.cli, folder: request.folder, files };
  files.forEach((file) =>
    createDirectory(
      absolutePathSchema.parse(
        path.directoryOf({
          path: path.join({ segments: [request.folder, file] }),
        }),
      ),
    ),
  );
  write({ ...configuration, contents: JSON.stringify({ categories }) });
  sources.forEach((source, file) =>
    write({ folder: request.folder, file, contents: source.toString() }),
  );
  const changed = removeDisableDirectives({
    ...invocation,
    sources,
    observe: ({ fileName, line, text }) =>
      request.observeDisable?.({ index: files.indexOf(fileName), line, text }),
  });
  if (request.rules.length === 0 && !request.pluginRules?.length) return [];
  if (changed === "changed") {
    sources.forEach((source, file) =>
      write({ folder: request.folder, file, contents: source.toString() }),
    );
  }
  const pluginRules = request.pluginRules ?? [];
  const ruleEntries = [
    ...request.rules.map((rule) => [rule, ["error", ...(request.nativeOptions?.get(rule) ?? [])]]),
    ...pluginRules.map(({ id, options }) => [id, ["error", ...options]]),
  ];
  const rules = Object.fromEntries(ruleEntries);
  const pluginsByNamespace = new Map(
    pluginRules.map(({ namespace, module }) => [namespace, module]),
  );
  const jsPlugins = [...pluginsByNamespace].map(([name, specifier]) => ({ name, specifier }));
  write({ ...configuration, contents: JSON.stringify({ categories, rules, jsPlugins }) });
  const selected = [...request.rules, ...pluginRules.map(({ id }) => id)];
  const diagnostics = runOxlintProcess({ ...invocation, options: [], rules: selected.length });
  return mapDiagnosticsToSites({ ...request, diagnostics, files, rules: selected });
};

const runWithOxlint = (
  request: OxlintRequest & { readonly cli: string },
): Result<readonly OxlintSite[], RunnerFailure> => {
  try {
    const root = absolutePathSchema.parse(request.resolveFrom);
    const folder = absolutePathSchema.parse(
      path.join({ segments: [root, `.hone-oxlint-${crypto.randomUUID()}`] }),
    );
    createDirectory(folder);
    try {
      return { outcome: "ok", value: runInWorkspace({ ...request, folder }) };
    } finally {
      const removed = tree.remove({ path: folder });
      if (removed.outcome === "failed") throw new Error(removed.error.detail);
    }
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};

export const runOxlint: RunOxlint = (request) => {
  if (
    request.sources.length === 0 ||
    (request.rules.length === 0 &&
      !request.pluginRules?.length &&
      request.observeDisable === undefined)
  )
    return Promise.resolve({ outcome: "ok", value: [] });
  const toolchain = readOxlintToolchain({
    folder: request.resolveFrom,
    peerFolders: (request.pluginRules ?? []).flatMap(({ peerFolder }) =>
      peerFolder === undefined ? [] : [peerFolder],
    ),
  });
  return Promise.resolve(
    toolchain.outcome === "failed"
      ? toolchain
      : runWithOxlint({ ...request, cli: toolchain.value }),
  );
};
