import { checkAddressTextOf } from "../../language-layer/check-address-text.ts";
import type { Symptom } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { RuleSetIdentity } from "../../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { type OwnedName, ownedNameText } from "../../rule-set/rule-set-identity.ts";
import type { AnsweredFile } from "../../runner/checks-run-report.ts";
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

type OwnedSymptom = Pick<Symptom, "ruleSet" | "name">;

const symptomKey = (request: { readonly symptom: OwnedSymptom }): ReachKey =>
  `symptom:${ownedNameText(request.symptom)}`;

const addressKey = (request: { readonly address: OwnedName }): ReachKey =>
  `check:${ownedNameText(request.address)}`;

const checkKey = (request: { readonly symptom: OwnedSymptom; readonly check: string }): ReachKey =>
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
}): boolean => {
  const answers = request.byPlace.get(request.file);
  const { ruleSet } = request;
  return (
    answers !== undefined &&
    (answers.has(symptomKey({ symptom: { ruleSet, name: request.symptom } })) ||
      answers.has(addressKey({ address: { ruleSet, name: request.address } })))
  );
};

const recipeKey = (request: { readonly recipe: OwnedName }): ReachKey =>
  `recipe:${ownedNameText(request.recipe)}`;

const symptomReachKeysOf = (request: {
  readonly symptom: OwnedSymptom;
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
      return symptomReachKeysOf({ symptom: record.symptom, reach: record.reach });
    case "deviation":
      return [recipeKey({ recipe: record.recipe })];
    case "boundary-record":
      return reachOf({ party: record.outsideParty }).map((name) =>
        symptomKey({ symptom: { ruleSet: TOOL_RULE_SET, name } }),
      );
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
    symptomKey({ symptom }),
    ...(check.found === "check" ? [checkKey({ symptom, check: check.check.name })] : []),
    ...symptom.recipes.map((recipe) => recipeKey({ recipe })),
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
