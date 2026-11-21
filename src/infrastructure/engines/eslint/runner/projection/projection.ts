import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { ProjectionWrite } from "../../../../../domain/runner/runner-result-types.ts";
import type { FileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CoreInstall } from "./core-install.ts";
import type { ProjectionStates } from "./projection-states.ts";

export type PluginImport =
  | { readonly placement: "importable"; readonly specifier: string }
  | { readonly placement: "piece-on-another-root" };

export type CurrentProjection =
  | { readonly presence: "absent" }
  | { readonly presence: "present"; readonly text: string };

export type GeneratedProjectionState = "current" | "out-of-date" | "missing";

const GLOB_SPECIAL_CHARACTERS = /[\\*?[\]{}()!+@]/g;

const PARENT_PREFIX = "../";

export const escapedGlobPath = (request: { readonly path: string }): string =>
  request.path.replace(GLOB_SPECIAL_CHARACTERS, (character) => `\\${character}`);

const relativeImportOf = (request: {
  readonly path: PathPort;
  readonly importingDirectory: AbsolutePath;
  readonly modulePath: string;
}): PluginImport => {
  const location = request.path.relative({ from: request.importingDirectory, to: request.modulePath });
  if (location.relation === "different-root") {
    return { placement: "piece-on-another-root" };
  }
  return {
    placement: "importable",
    specifier: location.path.startsWith(PARENT_PREFIX) ? location.path : `./${location.path}`,
  };
};

const pathInsidePackage = (request: {
  readonly path: PathPort;
  readonly packageRoot: string;
  readonly modulePath: string;
}): string | undefined => {
  const location = request.path.relative({ from: request.packageRoot, to: request.modulePath });
  return location.relation === "within-root" && !location.path.startsWith(PARENT_PREFIX) ? location.path : undefined;
};

const packageImportOf = (request: {
  readonly path: PathPort;
  readonly install: Extract<CoreInstall, { readonly form: "package" }>;
  readonly modulePath: string;
}): PluginImport | undefined => {
  const inside = pathInsidePackage({ path: request.path, packageRoot: request.install.root, modulePath: request.modulePath });
  return inside === undefined ? undefined : { placement: "importable", specifier: `${request.install.name}/${inside}` };
};

export const pluginImportOf = (request: {
  readonly path: PathPort;
  readonly importingDirectory: AbsolutePath;
  readonly install: CoreInstall;
  readonly pieceRoot: string;
  readonly pluginModule: string;
}): PluginImport => {
  const modulePath = request.path.join({ segments: [request.pieceRoot, request.pluginModule] });
  const packaged =
    request.install.form === "package" ? packageImportOf({ path: request.path, install: request.install, modulePath }) : undefined;
  return packaged ?? relativeImportOf({ path: request.path, importingDirectory: request.importingDirectory, modulePath });
};

export const projectionState = (request: {
  readonly current: CurrentProjection;
  readonly generated: string;
}): GeneratedProjectionState => {
  if (request.current.presence === "absent") {
    return "missing";
  }
  return request.current.text === request.generated ? "current" : "out-of-date";
};

type ProjectionFile = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly file: RepoPath;
};

export const currentProjection = (request: ProjectionFile): Result<CurrentProjection, RunnerFailure> => {
  const projectionFile = request.path.join({ segments: [request.repoRoot, request.file] });
  if (request.fileText.exists({ path: projectionFile }) === "absent") {
    return { outcome: "ok", value: { presence: "absent" } };
  }
  const text = request.fileText.read({ path: projectionFile });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", file: request.file, detail: text.error.detail },
    };
  }
  return { outcome: "ok", value: { presence: "present", text: text.value.replaceAll("\r\n", "\n") } };
};

const writtenProjection = (request: ProjectionFile & { readonly text: string }): Result<ProjectionWrite, RunnerFailure> => {
  const written = request.fileText.write({
    path: request.path.join({ segments: [request.repoRoot, request.file] }),
    text: request.text,
  });
  if (written.outcome === "failed") {
    return { outcome: "failed", error: { kind: "tool-failed", detail: written.error.detail } };
  }
  return { outcome: "ok", value: { path: request.file, effect: "written" } };
};

export const writeProjection = (request: ProjectionFile & { readonly text: string }): Result<ProjectionWrite, RunnerFailure> => {
  const current = currentProjection(request);
  if (current.outcome === "failed") {
    return current;
  }
  if (projectionState({ current: current.value, generated: request.text }) === "current") {
    return { outcome: "ok", value: { path: request.file, effect: "unchanged" } };
  }
  return writtenProjection(request);
};

const fileState = (request: ProjectionFile): Result<readonly [RepoPath, CurrentProjection], RunnerFailure> => {
  const current = currentProjection(request);
  return current.outcome === "failed" ? current : { outcome: "ok", value: [request.file, current.value] };
};

export const currentProjectionsOf = (
  request: Omit<ProjectionFile, "file"> & { readonly files: readonly RepoPath[] },
): Result<ProjectionStates, RunnerFailure> => {
  const states = gatheredOutcomes({ outcomes: request.files.map((file) => listedOutcome({ outcome: fileState({ ...request, file }) })) });
  return states.outcome === "failed" ? states : { outcome: "ok", value: new Map(states.value) };
};

export type ProjectionFiles = {
  readonly currentOf: (request: { readonly files: readonly RepoPath[] }) => Result<ProjectionStates, RunnerFailure>;
  readonly writeAt: (request: { readonly file: RepoPath; readonly text: string }) => Result<ProjectionWrite, RunnerFailure>;
  readonly removeAt: (request: { readonly file: RepoPath }) => Result<void, RunnerFailure>;
};

export const projectionFilesOver = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): ProjectionFiles => ({
  currentOf: ({ files }) => currentProjectionsOf({ ...request, files }),
  writeAt: ({ file, text }) => writeProjection({ ...request, file, text }),
  removeAt: ({ file }) => {
    const removed = request.fileRemoval.remove({ path: request.path.join({ segments: [request.repoRoot, file] }) });
    return removed.outcome === "failed"
      ? { outcome: "failed", error: { kind: "tool-failed", detail: removed.error.detail } }
      : { outcome: "ok", value: undefined };
  },
});
