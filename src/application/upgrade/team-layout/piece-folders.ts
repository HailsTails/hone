import type { CheckNames } from "../../../domain/language-layer/check-address-text.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { isRepoPath } from "../../../domain/repository/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseId } from "../../../domain/rule-set/identifier-types.ts";
import type { PlanRefusal } from "../../ports/upgrade/plan-refusal.ts";
import type {
  ImportsRewrittenOf,
  PieceFolderFile,
  VersionOnePiece,
} from "../../ports/upgrade/version-one-team-layout.ts";
import type { PlannedRepoFile } from "../proof/planned-repo-file.ts";

export type PieceMember = {
  readonly clause: ClauseId;
  readonly check: CheckNames;
  readonly piece: VersionOnePiece;
};

type Destination = { readonly from: RepoPath; readonly to: RepoPath; readonly text: string };

const PATH_SEPARATOR = "/";

const ENGINES_FOLDER = "engines";

const TEST_INFIX = ".test";

const testOf = (module: string): string => {
  const extension = module.lastIndexOf(".");
  return extension === -1
    ? `${module}${TEST_INFIX}`
    : `${module.slice(0, extension)}${TEST_INFIX}${module.slice(extension)}`;
};

const checkFolderOf = (request: {
  readonly rootSegments: readonly string[];
  readonly member: PieceMember;
}): readonly string[] => [
  ...request.rootSegments,
  ENGINES_FOLDER,
  request.member.piece.mechanism,
  request.member.check.symptom,
  request.member.check.check,
];

const ownerOf = (request: {
  readonly members: readonly PieceMember[];
  readonly file: PieceFolderFile;
}): PieceMember | undefined =>
  request.members.find(
    ({ piece }) => request.file.file === piece.module || request.file.file === testOf(piece.module),
  );

const placedPathOf = (segments: readonly string[]): Result<RepoPath, PlanRefusal> => {
  const path = segments.join(PATH_SEPARATOR);
  return isRepoPath(path)
    ? { outcome: "ok", value: path }
    : { outcome: "failed", error: { kind: "rule-set-path-unplaceable", path } };
};

const destinationOf = (request: {
  readonly rootSegments: readonly string[];
  readonly members: readonly PieceMember[];
  readonly first: PieceMember;
  readonly folder: RepoPath;
  readonly file: PieceFolderFile;
}): Result<Destination, PlanRefusal> => {
  const member = ownerOf(request) ?? request.first;
  const from = placedPathOf([request.folder, request.file.file]);
  if (from.outcome === "failed") return from;
  const to = placedPathOf([
    ...checkFolderOf({ rootSegments: request.rootSegments, member }),
    request.file.file,
  ]);
  return to.outcome === "failed"
    ? to
    : { outcome: "ok", value: { from: from.value, to: to.value, text: request.file.text } };
};

const rewrittenOf = (request: {
  readonly folder: RepoPath;
  readonly destination: Destination;
  readonly moved: ReadonlyMap<RepoPath, RepoPath>;
  readonly importsRewrittenOf: ImportsRewrittenOf;
}): Result<PlannedRepoFile, PlanRefusal> => {
  const { destination } = request;
  const rewritten = request.importsRewrittenOf({
    text: destination.text,
    file: destination.from,
    movedTo: destination.to,
    folder: request.folder,
    moved: request.moved,
  });
  return rewritten.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "piece-folder-unsplittable",
          folder: request.folder,
          file: destination.from,
        },
      }
    : { outcome: "ok", value: { file: destination.to, text: rewritten.value } };
};

const firstFailureOf = <Value>(
  results: readonly Result<Value, PlanRefusal>[],
): Result<readonly Value[], PlanRefusal> => {
  const refused = results.find((each) => each.outcome === "failed");
  return refused?.outcome === "failed"
    ? refused
    : {
        outcome: "ok",
        value: results.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
      };
};

const byClauseName = (left: PieceMember, right: PieceMember): number =>
  left.clause.localeCompare(right.clause);

const folderFilesOf = (request: {
  readonly rootSegments: readonly string[];
  readonly folder: RepoPath;
  readonly members: readonly PieceMember[];
  readonly importsRewrittenOf: ImportsRewrittenOf;
}): Result<readonly PlannedRepoFile[], PlanRefusal> => {
  const members = request.members.toSorted(byClauseName);
  const [first] = members;
  if (first === undefined) return { outcome: "ok", value: [] };
  const destinations = firstFailureOf(
    first.piece.files.map((file) => destinationOf({ ...request, members, first, file })),
  );
  if (destinations.outcome === "failed") return destinations;
  if (members.length === 1) {
    return {
      outcome: "ok",
      value: destinations.value.map(({ to, text }) => ({ file: to, text })),
    };
  }
  const moved = new Map(destinations.value.map(({ from, to }) => [from, to]));
  return firstFailureOf(
    destinations.value.map((destination) => rewrittenOf({ ...request, destination, moved })),
  );
};

export const pieceFolderFilesOf = (request: {
  readonly rootSegments: readonly string[];
  readonly members: readonly PieceMember[];
  readonly importsRewrittenOf: ImportsRewrittenOf;
}): Result<readonly PlannedRepoFile[], PlanRefusal> => {
  const folders = Map.groupBy(request.members, ({ piece }) => piece.folder);
  const planned = firstFailureOf(
    [...folders].map(([folder, members]) => folderFilesOf({ ...request, folder, members })),
  );
  return planned.outcome === "failed" ? planned : { outcome: "ok", value: planned.value.flat() };
};
