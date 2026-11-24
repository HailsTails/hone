import { headPathByBasePathOf, type RenamedPaths } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { HoneRecord, PlacedRecord } from "./hone-record.ts";

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
