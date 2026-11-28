import { headPathByBasePathOf, type RenamedPaths } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { HoneRecord, PlacedRecord, RecordPlace, RefusedRecord } from "./hone-record.ts";
import { sameRecordIdentity } from "./record-identity.ts";
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
    case "dependency-record":
      return undefined;
  }
};

const heldIn = (request: {
  readonly record: HoneRecord;
  readonly records: readonly HoneRecord[];
}): "held" | "not-held" =>
  request.records.some(
    (candidate) => sameRecordIdentity({ left: request.record, right: candidate }) === "same",
  )
    ? "held"
    : "not-held";

const followedToHead = (request: {
  readonly record: HoneRecord;
  readonly headPathOf: ReadonlyMap<RepoPath, RepoPath>;
}): HoneRecord => {
  const file = pathHeldBy({ record: request.record });
  const movedTo = file === undefined ? undefined : request.headPathOf.get(file);
  return movedTo === undefined
    ? request.record
    : recordAt({ record: request.record, file: movedTo });
};

export const recordsAtMovedPathsOf = (request: {
  readonly records: readonly PlacedRecord[];
  readonly renamed: RenamedPaths;
  readonly held: readonly HoneRecord[];
}): readonly RecordRepointing[] => {
  const headPathOf = headPathByBasePathOf({ renamed: request.renamed });
  const expectedAtHead = request.held.map((record) => followedToHead({ record, headPathOf }));
  return request.records.flatMap(({ place, record }) => {
    const file = pathHeldBy({ record });
    const movedTo = file === undefined ? undefined : headPathOf.get(file);
    return movedTo !== undefined &&
      heldIn({ record, records: request.held }) === "held" &&
      heldIn({ record, records: expectedAtHead }) === "not-held"
      ? [{ place, file: movedTo }]
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
