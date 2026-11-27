import { failureDetailOf } from "../../../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../../../domain/repository/absolute-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { createDefaultDirectoryTreePort } from "../../../../node/file-system/directory-tree-port.ts";
import {
  createDefaultDirectoryPort,
  createDefaultFileTextPort,
} from "../../../../node/file-system/file-system-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import type { SelectedOxlintRule } from "../selected-rule.ts";
import { createMeasurementConfiguration } from "./measurement-configuration.ts";
import { runOxlintProcess, mapDiagnosticsToSites, type OxlintSite } from "./oxlint-diagnostics.ts";
import { createSourcesWithoutDisables } from "./oxlint-directives.ts";

const path = createDefaultPathPort({});
const directories = createDefaultDirectoryPort({});
const tree = createDefaultDirectoryTreePort({});
const text = createDefaultFileTextPort({});
const CONFIGURATION = ".oxlintrc.json";
const CATEGORIES = { correctness: "off" };

export type RunOxlint = (request: {
  readonly cli: string;
  readonly resolveFrom: string;
  readonly rules: readonly SelectedOxlintRule[];
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

const createDirectory = (folder: string): AbsolutePath => {
  if (!isAbsolutePath(folder)) throw new Error(`Expected an absolute path: ${folder}`);
  const created = directories.create({ path: folder });
  if (created.outcome === "failed") throw new Error(created.error.detail);
  return folder;
};

type OxlintRequest = Parameters<RunOxlint>[0];

const conformInWorkspace = (request: OxlintRequest): readonly OxlintSite[] => {
  const folder = createDirectory(
    path.join({ segments: [request.resolveFrom, `.hone-oxlint-${crypto.randomUUID()}`] }),
  );
  try {
    write({ folder, file: CONFIGURATION, contents: JSON.stringify({ categories: CATEGORIES }) });
    return runInWorkspace({ ...request, folder });
  } finally {
    const removed = tree.remove({ path: folder });
    if (removed.outcome === "failed") throw new Error(removed.error.detail);
  }
};

const runInWorkspace = (
  request: OxlintRequest & { readonly folder: AbsolutePath },
): readonly OxlintSite[] => {
  const files = request.sources.map(
    ({ fileName }, index) => `sources/${index}/${fileName.split("/").at(-1)}`,
  );
  const sources = new Map(
    files.map((file, index) => [file, Buffer.from(request.sources[index].source)]),
  );
  const configuration = { folder: request.folder, file: CONFIGURATION };
  const invocation = { cli: request.cli, folder: request.folder, files };
  files.forEach((file) =>
    createDirectory(
      path.directoryOf({
        path: path.join({ segments: [request.folder, file] }),
      }),
    ),
  );
  sources.forEach((source, file) =>
    write({ folder: request.folder, file, contents: source.toString() }),
  );
  const withDisablesRemoved = createSourcesWithoutDisables({ ...invocation, sources });
  withDisablesRemoved.forEach((source, file) =>
    write({ folder: request.folder, file, contents: source.toString() }),
  );
  const measurement = createMeasurementConfiguration(request.rules);
  write({
    ...configuration,
    contents: JSON.stringify(measurement),
  });
  const selected = Object.keys(measurement.rules);
  const diagnostics = runOxlintProcess({ ...invocation, options: [], rules: selected.length });
  return mapDiagnosticsToSites({ ...request, diagnostics, files, rules: selected });
};

export const runOxlint: RunOxlint = async (request) => {
  if (request.sources.length === 0 || request.rules.length === 0)
    return { outcome: "ok", value: [] };
  try {
    return {
      outcome: "ok",
      value: conformInWorkspace(request),
    };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};
