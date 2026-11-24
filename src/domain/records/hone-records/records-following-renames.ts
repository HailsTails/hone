import { headPathByBasePathOf, type RenamedPaths } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { HoneRecord, PlacedRecord, RefusedRecord } from "./hone-record.ts";
import type { RecordRepointing } from "./records-edit.ts";

const recordAt = (request: {
  readonly record: HoneRecord;
  readonly headPathOf: ReadonlyMap<RepoPath, RepoPath>;
}): HoneRecord => {
  const { record, headPathOf } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "deviation":
      return { ...record, file: headPathOf.get(record.file) ?? record.file };
    case "boundary-record":
    case "dependency-record":
      return record;
  }
};

export const recordsFollowingRenames = (request: {
  readonly records: readonly PlacedRecord[];
  readonly renamed: RenamedPaths;
}): readonly PlacedRecord[] => {
  const headPathOf = headPathByBasePathOf({ renamed: request.renamed });
  return request.records.map((placed) => ({
    place: placed.place,
    record: recordAt({ record: placed.record, headPathOf }),
  }));
};

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

export const recordsAtMovedPathsOf = (request: {
  readonly records: readonly PlacedRecord[];
  readonly renamed: RenamedPaths;
}): readonly RecordRepointing[] => {
  const headPathOf = headPathByBasePathOf({ renamed: request.renamed });
  return request.records.flatMap(({ place, record }) => {
    const held = pathHeldBy({ record });
    const movedTo = held === undefined ? undefined : headPathOf.get(held);
    return movedTo === undefined ? [] : [{ place, file: movedTo }];
  });
};

export const movedPathRefusalsOf = (request: {
  readonly moved: readonly RecordRepointing[];
}): readonly RefusedRecord[] =>
  request.moved.map(({ place, file }) => ({
    place,
    refusals: [{ kind: "held-at-moved-path", movedTo: file }],
  }));
