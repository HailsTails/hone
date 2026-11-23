import { checkAddressTextOf } from "../../language-layer/check-address-text.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { AuthorisedReach, HoneRecord, PlacedRecord } from "../hone-records/hone-record.ts";
import { reachOf, type Site } from "./record-reach.ts";

type ReachKey = `symptom:${string}` | `check:${string}` | `recipe:${string}`;

type Ranked = { readonly placed: PlacedRecord; readonly rank: number };

type Keyed = Ranked & { readonly path: RepoPath; readonly key: ReachKey };

type ByKey = ReadonlyMap<ReachKey, readonly Ranked[]>;

export type RecordsByPlace = {
  readonly ranks: ReadonlyMap<PlacedRecord, number>;
  readonly inFile: ReadonlyMap<RepoPath, ByKey>;
  readonly inModule: ReadonlyMap<RepoPath, ByKey>;
};

const FOLDER_SEPARATOR = "/";

const symptomKey = (request: { readonly symptom: string }): ReachKey =>
  `symptom:${request.symptom}`;

const checkKey = (request: { readonly symptom: string; readonly check: string }): ReachKey =>
  `check:${checkAddressTextOf({ check: { name: request.check, symptom: { name: request.symptom } } })}`;

const recipeKey = (request: { readonly recipe: string }): ReachKey => `recipe:${request.recipe}`;

const symptomReachKeysOf = (request: {
  readonly symptom: string;
  readonly reach: AuthorisedReach;
}): readonly ReachKey[] => {
  const { symptom, reach } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return [symptomKey({ symptom })];
    case "one-check":
      return [checkKey({ symptom, check: reach.check.name })];
    case "unknown-check":
      return [];
  }
};

const reachKeysOf = (request: { readonly record: HoneRecord }): readonly ReachKey[] => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return symptomReachKeysOf({ symptom: record.symptom.name, reach: record.reach });
    case "deviation":
      return [recipeKey({ recipe: record.recipe.name })];
    case "boundary-record":
      return reachOf({ party: record.outsideParty }).map((symptom) => symptomKey({ symptom }));
    case "dependency-record":
      return [];
  }
};

const keyedOf = (request: {
  readonly placed: PlacedRecord;
  readonly rank: number;
  readonly path: RepoPath;
}): readonly Keyed[] =>
  reachKeysOf({ record: request.placed.record }).map((key) => ({
    placed: request.placed,
    rank: request.rank,
    path: request.path,
    key,
  }));

const byPathAndKey = (request: {
  readonly keyed: readonly Keyed[];
}): ReadonlyMap<RepoPath, ByKey> =>
  new Map(
    [...Map.groupBy(request.keyed, ({ path }) => path)].map(([path, entries]) => [
      path,
      Map.groupBy(entries, ({ key }) => key),
    ]),
  );

export const recordsByPlaceOf = (request: {
  readonly records: readonly PlacedRecord[];
}): RecordsByPlace => {
  const inFile = request.records.flatMap((placed, rank) => {
    const { record } = placed;
    return record.kind === "debt" ||
      record.kind === "authorised-location" ||
      record.kind === "deviation"
      ? keyedOf({ placed, rank, path: record.file })
      : [];
  });
  const inModule = request.records.flatMap((placed, rank) =>
    placed.record.kind === "boundary-record"
      ? keyedOf({ placed, rank, path: placed.record.module })
      : [],
  );
  return {
    ranks: new Map(request.records.map((placed, rank) => [placed, rank])),
    inFile: byPathAndKey({ keyed: inFile }),
    inModule: byPathAndKey({ keyed: inModule }),
  };
};

const rankEntry = (request: Ranked): readonly [PlacedRecord, number] => [
  request.placed,
  request.rank,
];

const inRankOrder = (request: {
  readonly ranked: ReadonlyMap<PlacedRecord, number>;
}): readonly PlacedRecord[] =>
  [...request.ranked].toSorted(([, left], [, right]) => left - right).map(([placed]) => placed);

export const placedInRecordOrder = (request: {
  readonly byPlace: RecordsByPlace;
  readonly records: Iterable<PlacedRecord>;
}): readonly PlacedRecord[] =>
  inRankOrder({
    ranked: new Map(
      [...request.records].flatMap((placed) => {
        const rank = request.byPlace.ranks.get(placed);
        return rank === undefined ? [] : [rankEntry({ placed, rank })];
      }),
    ),
  });

const siteKeysOf = (request: { readonly site: Site }): readonly ReachKey[] => {
  const { symptom, check } = request.site;
  return [
    symptomKey({ symptom: symptom.name }),
    ...(check.found === "check"
      ? [checkKey({ symptom: symptom.name, check: check.check.name })]
      : []),
    ...symptom.recipes.map((recipe) => recipeKey({ recipe: recipe.name })),
  ];
};

const modulesCovering = (request: { readonly file: RepoPath }): readonly string[] => {
  const parts = request.file.split(FOLDER_SEPARATOR);
  return [...parts.keys()].map((end) => parts.slice(0, end + 1).join(FOLDER_SEPARATOR));
};

const rankedAt = (request: {
  readonly byPath: ReadonlyMap<string, ByKey>;
  readonly paths: readonly string[];
  readonly keys: readonly ReachKey[];
}): readonly Ranked[] =>
  request.paths.flatMap((path) => {
    const byKey = request.byPath.get(path);
    return byKey === undefined ? [] : request.keys.flatMap((key) => byKey.get(key) ?? []);
  });

export const recordsReachingSites = (request: {
  readonly byPlace: RecordsByPlace;
  readonly sites: readonly Site[];
}): readonly PlacedRecord[] =>
  inRankOrder({
    ranked: new Map(
      request.sites.flatMap((site) => {
        const keys = siteKeysOf({ site });
        return [
          ...rankedAt({ byPath: request.byPlace.inFile, paths: [site.file], keys }),
          ...rankedAt({
            byPath: request.byPlace.inModule,
            paths: modulesCovering({ file: site.file }),
            keys,
          }),
        ].map(rankEntry);
      }),
    ),
  });
