import { checkAddressTextOf } from "../../language-layer/check-address-text.ts";
import type { SymptomAddress } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { RuleSetIdentity } from "../../rule-set/clause-address-types.ts";
import { type OwnedName, ownedNameText } from "../../rule-set/rule-set-identity.ts";
import type { AnsweredFile } from "../../runner/checks-run-report.ts";
import type { HoneRecord, PlacedRecord, RecordReach } from "../hone-records/hone-record.ts";
import type { Holding, ResolvedSite } from "./record-reach.ts";

type ReachKey = `symptom:${string}` | `check:${string}` | `recipe:${string}`;

type Ranked = { readonly placed: PlacedRecord; readonly rank: number };

type Keyed = Ranked & { readonly path: RepoPath; readonly key: ReachKey };

type ByKey = ReadonlyMap<ReachKey, readonly Ranked[]>;

export type RecordsByPlace = {
  readonly ranks: ReadonlyMap<PlacedRecord, number>;
  readonly inFile: ReadonlyMap<RepoPath, ByKey>;
};

const symptomKey = (request: { readonly symptom: SymptomAddress }): ReachKey =>
  `symptom:${ownedNameText(request.symptom)}`;

const addressKey = (request: { readonly address: OwnedName }): ReachKey =>
  `check:${ownedNameText(request.address)}`;

const checkKey = (request: {
  readonly symptom: SymptomAddress;
  readonly check: string;
}): ReachKey =>
  addressKey({
    address: {
      ruleSet: request.symptom.ruleSet,
      name: checkAddressTextOf({ check: { name: request.check, symptom: request.symptom } }),
    },
  });

export type AnsweredByPlace = ReadonlyMap<RepoPath, ReadonlySet<ReachKey>>;

export const answeredByPlaceOf = (request: {
  readonly answered: readonly AnsweredFile[];
}): AnsweredByPlace =>
  new Map(
    [...Map.groupBy(request.answered, ({ file }) => file)].map(([file, answers]) => [
      file,
      new Set(
        answers.map(({ ruleSet, symptom, check }) =>
          check === undefined
            ? symptomKey({ symptom: { ruleSet, name: symptom } })
            : checkKey({ symptom: { ruleSet, name: symptom }, check }),
        ),
      ),
    ]),
  );

export const answeredAt = (request: {
  readonly byPlace: AnsweredByPlace;
  readonly file: RepoPath;
  readonly ruleSet: RuleSetIdentity;
  readonly symptom: string;
  readonly address: string;
}): Holding => {
  const answers = request.byPlace.get(request.file);
  const { ruleSet } = request;
  return answers !== undefined &&
    (answers.has(symptomKey({ symptom: { ruleSet, name: request.symptom } })) ||
      answers.has(addressKey({ address: { ruleSet, name: request.address } })))
    ? "holds"
    : "does-not-hold";
};

const recipeKey = (request: { readonly recipe: OwnedName }): ReachKey =>
  `recipe:${ownedNameText(request.recipe)}`;

const symptomReachKeysOf = (request: {
  readonly symptom: SymptomAddress;
  readonly reach: RecordReach;
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
      return symptomReachKeysOf({ symptom: record.symptom, reach: record.reach });
    case "deviation":
      return [recipeKey({ recipe: record.recipe })];
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
  return {
    ranks: new Map(request.records.map((placed, rank) => [placed, rank])),
    inFile: byPathAndKey({ keyed: inFile }),
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

const siteKeysOf = (request: { readonly site: ResolvedSite }): readonly ReachKey[] => {
  const { symptom, check, recipes } = request.site;
  return [
    symptomKey({ symptom }),
    ...(check.found === "check" ? [checkKey({ symptom, check: check.check.name })] : []),
    ...recipes.map((recipe) => recipeKey({ recipe })),
  ];
};

const rankedAt = (request: {
  readonly byPath: ReadonlyMap<RepoPath, ByKey>;
  readonly path: RepoPath;
  readonly keys: readonly ReachKey[];
}): readonly Ranked[] => {
  const byKey = request.byPath.get(request.path);
  return byKey === undefined ? [] : request.keys.flatMap((key) => byKey.get(key) ?? []);
};

export const recordsReachingSites = (request: {
  readonly byPlace: RecordsByPlace;
  readonly sites: readonly ResolvedSite[];
}): readonly PlacedRecord[] =>
  inRankOrder({
    ranked: new Map(
      request.sites.flatMap((site) => {
        const keys = siteKeysOf({ site });
        return rankedAt({ byPath: request.byPlace.inFile, path: site.file, keys }).map(rankEntry);
      }),
    ),
  });
