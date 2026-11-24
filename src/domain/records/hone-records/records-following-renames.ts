import { headPathByBasePathOf, type RenamedPaths } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type {
  HeldAtBase,
  HoneRecord,
  PlacedRecord,
  RecordPlace,
  RefusedRecord,
} from "./hone-record.ts";
import type { RecordRepointing } from "./records-edit.ts";

const placeMatch = (request: {
  readonly left: RecordPlace;
  readonly right: RecordPlace;
}): "same" | "different" =>
  request.left.file === request.right.file && request.left.index === request.right.index
    ? "same"
    : "different";

const recordAt = (request: {
  readonly record: HoneRecord;
  readonly file: RepoPath;
}): HoneRecord => {
  const { record, file } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "deviation":
      return { ...record, file };
    case "boundary-record":
    case "dependency-record":
      return record;
  }
};

export const recordsFollowingRenames = (request: {
  readonly records: readonly PlacedRecord[];
  readonly moved: readonly RecordRepointing[];
}): readonly PlacedRecord[] =>
  request.records.map((placed) => {
    const repointing = request.moved.find(
      ({ place }) => placeMatch({ left: place, right: placed.place }) === "same",
    );
    return repointing === undefined
      ? placed
      : { place: placed.place, record: recordAt({ record: placed.record, file: repointing.file }) };
  });

const pathHeldBy = (request: { readonly record: HoneRecord }): RepoPath | undefined => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "deviation":
      return record.file;
    case "boundary-record":
    case "dependency-record":
      return undefined;
  }
};

const standingSinceBase = (request: {
  readonly placed: PlacedRecord;
  readonly file: RepoPath;
  readonly held: readonly HeldAtBase[];
}): "held-as-at-base" | "changed-since-base" =>
  request.held.some(
    ({ place, file }) =>
      file === request.file && placeMatch({ left: place, right: request.placed.place }) === "same",
  )
    ? "held-as-at-base"
    : "changed-since-base";

export const recordsAtMovedPathsOf = (request: {
  readonly records: readonly PlacedRecord[];
  readonly renamed: RenamedPaths;
  readonly held: readonly HeldAtBase[];
}): readonly RecordRepointing[] => {
  const headPathOf = headPathByBasePathOf({ renamed: request.renamed });
  return request.records.flatMap((placed) => {
    const file = pathHeldBy({ record: placed.record });
    const movedTo = file === undefined ? undefined : headPathOf.get(file);
    return file !== undefined &&
      movedTo !== undefined &&
      standingSinceBase({ placed, file, held: request.held }) === "held-as-at-base"
      ? [{ place: placed.place, file: movedTo }]
      : [];
  });
};

export const movedPathRefusalsOf = (request: {
  readonly moved: readonly RecordRepointing[];
}): readonly RefusedRecord[] =>
  request.moved.map(({ place, file }) => ({
    place,
    refusals: [{ kind: "held-at-moved-path", movedTo: file }],
  }));
