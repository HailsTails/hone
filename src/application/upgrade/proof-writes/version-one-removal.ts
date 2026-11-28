import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type {
  EffectsApplied,
  ProofEffect,
  ProofEffects,
  SettledEffect,
} from "../../ports/upgrade/proof-effect.ts";
import type { OutsideRoot, RemovalFailure, Removed } from "../../ports/upgrade/proof-outcome.ts";

export type RemovalPath = Pick<PathPort, "relative" | "join">;

export type RecordsRoot = { readonly kind: "repository" | "folder"; readonly path: AbsolutePath };

export type VersionOneRemoval = {
  readonly recordsFiles: readonly AbsolutePath[];
  readonly recordsFolders: readonly AbsolutePath[];
  readonly recordsRoot: RecordsRoot;
  readonly projections: readonly AbsolutePath[];
  readonly declarations: readonly AbsolutePath[];
  readonly settings: AbsolutePath;
  readonly ruleSetFiles: readonly AbsolutePath[];
  readonly ruleSetFolders: readonly AbsolutePath[];
};

const PROJECTION_MODULE_SUFFIX = ".mjs";

const PROJECTION_DECLARATION_SUFFIX = ".d.mts";

const declarationBesideOf = (request: {
  readonly projection: AbsolutePath;
}): AbsolutePath | undefined => {
  const { projection } = request;
  if (!projection.endsWith(PROJECTION_MODULE_SUFFIX)) {
    return undefined;
  }
  const declaration = `${projection.slice(0, -PROJECTION_MODULE_SUFFIX.length)}${PROJECTION_DECLARATION_SUFFIX}`;
  return isAbsolutePath(declaration) ? declaration : undefined;
};

export const projectionDeclarationsOf = (request: {
  readonly projections: readonly AbsolutePath[];
  readonly fileText: Pick<FileTextPort, "exists">;
}): readonly AbsolutePath[] =>
  request.projections.flatMap((projection) => {
    const declaration = declarationBesideOf({ projection });
    return declaration !== undefined && request.fileText.exists({ path: declaration }) === "present"
      ? [declaration]
      : [];
  });

const PATH_SEPARATOR = /[\\/]/;

const segmentsBelowRoot = (request: {
  readonly path: RemovalPath;
  readonly root: AbsolutePath;
  readonly file: AbsolutePath;
}): readonly string[] | undefined => {
  const location = request.path.relative({ from: request.root, to: request.file });
  if (location.relation !== "within-root") {
    return undefined;
  }
  const segments = location.path.split(PATH_SEPARATOR).filter((segment) => segment !== "");
  return segments.length > 0 && segments.every((segment) => segment !== "..")
    ? segments
    : undefined;
};

export const recordsOutsideRoot = (request: {
  readonly path: RemovalPath;
  readonly removal: VersionOneRemoval;
}): OutsideRoot | undefined => {
  const { recordsRoot } = request.removal;
  const outside = request.removal.recordsFiles.find(
    (file) => segmentsBelowRoot({ path: request.path, root: recordsRoot.path, file }) === undefined,
  );
  return outside === undefined
    ? undefined
    : { kind: "records-file-outside-root", path: outside, root: recordsRoot.path };
};

const absolutePathsOf = (request: { readonly texts: readonly string[] }): readonly AbsolutePath[] =>
  request.texts.filter(isAbsolutePath);

const foldersOfFile = (request: {
  readonly path: RemovalPath;
  readonly root: RecordsRoot;
  readonly file: AbsolutePath;
}): readonly AbsolutePath[] => {
  const segments =
    segmentsBelowRoot({ path: request.path, root: request.root.path, file: request.file }) ?? [];
  const folderSegments = segments.slice(0, -1);
  return absolutePathsOf({
    texts: [
      ...(request.root.kind === "folder" ? [request.root.path] : []),
      ...folderSegments.map((_, depth) =>
        request.path.join({
          segments: [request.root.path, ...folderSegments.slice(0, depth + 1)],
        }),
      ),
    ],
  });
};

const foldersToTryOf = (request: {
  readonly path: RemovalPath;
  readonly removal: VersionOneRemoval;
}): readonly AbsolutePath[] =>
  [
    ...new Set([
      ...request.removal.recordsFolders,
      ...request.removal.recordsFiles.flatMap((file) =>
        foldersOfFile({ path: request.path, root: request.removal.recordsRoot, file }),
      ),
    ]),
  ].toSorted((left, right) => right.length - left.length);

const createFileRemovals = (request: {
  readonly paths: readonly AbsolutePath[];
}): readonly ProofEffect[] =>
  request.paths.map((path): ProofEffect => ({ kind: "remove-file", path }));

const createFolderRemovals = (request: {
  readonly paths: readonly AbsolutePath[];
}): readonly ProofEffect[] =>
  request.paths.map((path): ProofEffect => ({ kind: "remove-directory-if-empty", path }));

export const removalEffectsOf = (request: {
  readonly path: RemovalPath;
  readonly removal: VersionOneRemoval;
}): readonly ProofEffect[] => [
  ...createFileRemovals({ paths: request.removal.recordsFiles }),
  ...createFolderRemovals({ paths: foldersToTryOf(request) }),
  ...createFileRemovals({ paths: request.removal.projections }),
  ...createFileRemovals({ paths: request.removal.declarations }),
  ...createFileRemovals({ paths: [request.removal.settings] }),
  ...createFileRemovals({ paths: request.removal.ruleSetFiles }),
  ...createFolderRemovals({ paths: request.removal.ruleSetFolders }),
];

const removedOf = (request: { readonly settled: readonly SettledEffect[] }): Removed => ({
  files: request.settled.flatMap(({ effect, outcome }) =>
    effect.kind === "remove-file" && outcome === "applied" ? [effect.path] : [],
  ),
  folders: request.settled.flatMap(({ effect, outcome }) =>
    effect.kind === "remove-directory-if-empty" && outcome === "applied" ? [effect.path] : [],
  ),
});

export const removalOutcomeOf = (request: {
  readonly applied: EffectsApplied;
}): Result<Removed, RemovalFailure> => {
  const { applied } = request;
  const removed = removedOf(applied);
  return applied.outcome === "all-applied"
    ? { outcome: "ok", value: removed }
    : {
        outcome: "failed",
        error: {
          kind: "unremovable",
          path: applied.stopped.effect.path,
          detail: applied.stopped.detail,
          removed,
        },
      };
};

export const filesStillPresentOf = (request: {
  readonly removal: VersionOneRemoval;
  readonly failure: RemovalFailure;
}): readonly AbsolutePath[] => {
  const { removal, failure } = request;
  const removedFiles = failure.kind === "unremovable" ? failure.removed.files : [];
  const files = [
    ...removal.recordsFiles,
    ...removal.projections,
    ...removal.declarations,
    removal.settings,
    ...removal.ruleSetFiles,
  ].filter((file) => !removedFiles.includes(file));
  return failure.kind === "unremovable" && !files.includes(failure.path)
    ? [...files, failure.path]
    : files;
};

export const removedVersionOneFiles = (request: {
  readonly path: RemovalPath;
  readonly effects: Pick<ProofEffects, "apply">;
  readonly removal: VersionOneRemoval;
}): Result<Removed, RemovalFailure> => {
  const outside = recordsOutsideRoot(request);
  return outside === undefined
    ? removalOutcomeOf({ applied: request.effects.apply({ effects: removalEffectsOf(request) }) })
    : { outcome: "failed", error: outside };
};
