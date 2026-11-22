import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { OutsideRoot, RemovalFailure, Removed } from "../../ports/upgrade/proof-outcome.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

export type VersionOneRemovalPorts = {
  readonly fileRemoval: FileRemovalPort;
  readonly directory: DirectoryPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly path: PathPort;
};

export type RecordsRoot = { readonly kind: "repository" | "folder"; readonly path: AbsolutePath };

export type VersionOneRemoval = {
  readonly recordsFiles: readonly AbsolutePath[];
  readonly recordsFolders: readonly AbsolutePath[];
  readonly recordsRoot: RecordsRoot;
  readonly projections: readonly AbsolutePath[];
  readonly settings: AbsolutePath;
};

const PATH_SEPARATOR = /[\\/]/;

const segmentsBelowRoot = (request: { readonly ports: VersionOneRemovalPorts; readonly root: AbsolutePath; readonly file: AbsolutePath }): readonly string[] | undefined => {
  const location = request.ports.path.relative({ from: request.root, to: request.file });
  if (location.relation !== "within-root") {
    return undefined;
  }
  const segments = location.path.split(PATH_SEPARATOR).filter((segment) => segment !== "");
  return segments.length > 0 && segments.every((segment) => segment !== "..") ? segments : undefined;
};

export const recordsOutsideRoot = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): OutsideRoot | undefined => {
  const { recordsRoot } = request.removal;
  const outside = request.removal.recordsFiles.find((file) => segmentsBelowRoot({ ports: request.ports, root: recordsRoot.path, file }) === undefined);
  return outside === undefined ? undefined : { kind: "records-file-outside-root", path: outside, root: recordsRoot.path };
};

const absolutePathsOf = (request: { readonly texts: readonly string[] }): readonly AbsolutePath[] =>
  request.texts.filter(isAbsolutePath).map((text) => absoluteRootOf(text));

const foldersOfFile = (request: { readonly ports: VersionOneRemovalPorts; readonly root: RecordsRoot; readonly file: AbsolutePath }): readonly AbsolutePath[] => {
  const segments = segmentsBelowRoot({ ports: request.ports, root: request.root.path, file: request.file }) ?? [];
  const folderSegments = segments.slice(0, -1);
  return absolutePathsOf({
    texts: [...(request.root.kind === "folder" ? [request.root.path] : []), ...folderSegments.map((_, depth) => request.ports.path.join({ segments: [request.root.path, ...folderSegments.slice(0, depth + 1)] }))],
  });
};

const foldersToTryOf = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): readonly AbsolutePath[] =>
  [
    ...new Set([
      ...request.removal.recordsFolders,
      ...request.removal.recordsFiles.flatMap((file) => foldersOfFile({ ports: request.ports, root: request.removal.recordsRoot, file })),
    ]),
  ].toSorted((left, right) => right.length - left.length);

const removedFile = (request: { readonly ports: VersionOneRemovalPorts; readonly path: AbsolutePath; readonly removed: Removed }): Result<Removed, RemovalFailure> => {
  const fileRemoval = request.ports.fileRemoval.remove({ path: request.path });
  return fileRemoval.outcome === "ok"
    ? { outcome: "ok", value: { ...request.removed, files: [...request.removed.files, request.path] } }
    : { outcome: "failed", error: { kind: "unremovable", path: request.path, detail: fileRemoval.error.detail, removed: request.removed } };
};

const removedFolderIfEmpty = (request: { readonly ports: VersionOneRemovalPorts; readonly path: AbsolutePath; readonly removed: Removed }): Result<Removed, RemovalFailure> => {
  const listing = request.ports.directory.list({ path: request.path });
  if (listing.outcome === "failed") {
    return { outcome: "failed", error: { kind: "unremovable", path: request.path, detail: listing.error.detail, removed: request.removed } };
  }
  if (listing.value.length > 0) {
    return { outcome: "ok", value: request.removed };
  }
  const folderRemoval = request.ports.directoryRemoval.removeEmpty({ path: request.path });
  return folderRemoval.outcome === "ok"
    ? { outcome: "ok", value: { ...request.removed, folders: [...request.removed.folders, request.path] } }
    : { outcome: "failed", error: { kind: "unremovable", path: request.path, detail: folderRemoval.error.detail, removed: request.removed } };
};

type RemovalStep = { readonly kind: "file" | "folder-if-empty"; readonly path: AbsolutePath };

const fileStepsOf = (request: { readonly paths: readonly AbsolutePath[] }): readonly RemovalStep[] => request.paths.map((path): RemovalStep => ({ kind: "file", path }));

const stepsOf = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): readonly RemovalStep[] => [
  ...fileStepsOf({ paths: request.removal.recordsFiles }),
  ...foldersToTryOf(request).map((path): RemovalStep => ({ kind: "folder-if-empty", path })),
  ...fileStepsOf({ paths: request.removal.projections }),
  ...fileStepsOf({ paths: [request.removal.settings] }),
];

const attemptedStep = (request: { readonly ports: VersionOneRemovalPorts; readonly step: RemovalStep; readonly removed: Removed }): Result<Removed, RemovalFailure> => {
  const { ports, step, removed } = request;
  try {
    return step.kind === "file" ? removedFile({ ports, path: step.path, removed }) : removedFolderIfEmpty({ ports, path: step.path, removed });
  } catch (thrown: unknown) {
    return { outcome: "failed", error: { kind: "unremovable", path: step.path, detail: failureDetailOf({ thrown }), removed } };
  }
};

const removedFrom = (request: {
  readonly ports: VersionOneRemovalPorts;
  readonly steps: readonly RemovalStep[];
  readonly removed: Removed;
}): Result<Removed, RemovalFailure> => {
  const [step, ...rest] = request.steps;
  if (step === undefined) {
    return { outcome: "ok", value: request.removed };
  }
  const stepOutcome = attemptedStep({ ports: request.ports, step, removed: request.removed });
  return stepOutcome.outcome === "failed" ? stepOutcome : removedFrom({ ports: request.ports, steps: rest, removed: stepOutcome.value });
};

export const filesStillPresentOf = (request: { readonly removal: VersionOneRemoval; readonly failure: RemovalFailure }): readonly AbsolutePath[] => {
  const { removal, failure } = request;
  const removedFiles = failure.kind === "unremovable" ? failure.removed.files : [];
  const files = [...removal.recordsFiles, ...removal.projections, removal.settings].filter((file) => !removedFiles.includes(file));
  return failure.kind === "unremovable" && !files.includes(failure.path) ? [...files, failure.path] : files;
};

export const removedVersionOneFiles = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): Result<Removed, RemovalFailure> => {
  const outside = recordsOutsideRoot(request);
  return outside === undefined ? removedFrom({ ports: request.ports, steps: stepsOf(request), removed: { files: [], folders: [] } }) : { outcome: "failed", error: outside };
};
