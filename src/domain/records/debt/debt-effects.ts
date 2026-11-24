import { checkAddressOf } from "../../language-layer/check-address.ts";
import { basePathOf, type RenamedPaths } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import { ownedNameText } from "../../rule-set/rule-set-identity.ts";
import type { Debt, PlacedRecord, RecordPlace } from "../hone-records/hone-record.ts";
import { debtForfeitureAt } from "./debt-forfeiture.ts";
import {
  type DebtOrigin,
  type DebtSite,
  inSiteOrder,
  type OwnedSitePlace,
  type SitePlace,
  siteAddressText,
  type UnprojectedDebtSite,
} from "./debt-sites.ts";
import type { UnrecordableBecause, UnrecordableSite } from "./unrecordable-site.ts";

export type DebtEffect =
  | { readonly effect: "recorded" }
  | { readonly effect: "already-recorded"; readonly heldIn: RepoPath }
  | { readonly effect: "repointed"; readonly held: RecordPlace; readonly was: RepoPath }
  | { readonly effect: "left"; readonly under: RepoPath }
  | { readonly effect: "touched"; readonly of: DebtOrigin }
  | ({ readonly effect: "nested-configuration" } & UnprojectedDebtSite)
  | { readonly effect: "unrecordable"; readonly because: UnrecordableBecause };

export type DecidedDebtEffect = Exclude<DebtEffect, { readonly effect: "unrecordable" }>;

export type DebtOutcome =
  | (OwnedSitePlace & DecidedDebtEffect)
  | (SitePlace & Extract<DebtEffect, { readonly effect: "unrecordable" }>);

export type DebtEffectsRequest = {
  readonly sites: readonly DebtSite[];
  readonly unrecordable: readonly UnrecordableSite[];
  readonly records: readonly PlacedRecord[];
  readonly leave: readonly RepoPath[];
  readonly touched: TouchedSet;
  readonly renamed: RenamedPaths;
};

type HeldDebt = { readonly place: PlacedRecord["place"]; readonly debt: Debt };

type HeldByFile = ReadonlyMap<RepoPath, ReadonlyMap<string, HeldDebt>>;

export const debtAddressOf = (request: { readonly debt: Debt }): string =>
  ownedNameText({
    ruleSet: request.debt.symptom.ruleSet,
    name:
      request.debt.reach.reaches === "one-check"
        ? checkAddressOf({ check: request.debt.reach.check })
        : request.debt.symptom.name,
  });

const heldDebtsIn = (request: { readonly records: readonly PlacedRecord[] }): readonly HeldDebt[] =>
  request.records.flatMap((placed) =>
    placed.record.kind === "debt" ? [{ place: placed.place, debt: placed.record }] : [],
  );

const firstByAddress = (request: {
  readonly held: readonly HeldDebt[];
}): ReadonlyMap<string, HeldDebt> =>
  new Map(
    request.held
      .toReversed()
      .map((candidate) => [debtAddressOf({ debt: candidate.debt }), candidate]),
  );

const heldByFileOf = (request: { readonly held: readonly HeldDebt[] }): HeldByFile =>
  new Map(
    [...Map.groupBy(request.held, (candidate) => candidate.debt.file)].map(([file, held]) => [
      file,
      firstByAddress({ held }),
    ]),
  );

const leavingPath = (request: {
  readonly file: RepoPath;
  readonly leave: readonly RepoPath[];
}): RepoPath | undefined =>
  request.leave.find((path) => request.file === path || request.file.startsWith(`${path}/`));

const effectOf = (request: {
  readonly site: DebtSite;
  readonly held: HeldByFile;
  readonly rest: Omit<DebtEffectsRequest, "sites" | "unrecordable" | "records">;
}): DecidedDebtEffect => {
  const { site, held, rest } = request;
  const heldHere = held.get(site.file)?.get(siteAddressText({ site }));
  if (heldHere !== undefined) {
    return { effect: "already-recorded", heldIn: heldHere.place.file };
  }
  const was = basePathOf({ file: site.file, basePathOfRenamed: rest.renamed });
  const heldBeforeRename =
    was === site.file ? undefined : held.get(was)?.get(siteAddressText({ site }));
  if (heldBeforeRename !== undefined) {
    return { effect: "repointed", held: heldBeforeRename.place, was };
  }
  const under = leavingPath({ file: site.file, leave: rest.leave });
  if (under !== undefined) {
    return { effect: "left", under };
  }
  if (site.unprojected !== undefined) {
    return { effect: "nested-configuration", ...site.unprojected };
  }
  if (debtForfeitureAt({ touched: rest.touched, file: site.file }) === "forfeits") {
    return { effect: "touched", of: site.origin };
  }
  return { effect: "recorded" };
};

export const debtOutcomesOf = (request: DebtEffectsRequest): readonly DebtOutcome[] => {
  const held = heldByFileOf({ held: heldDebtsIn(request) });
  const decided = request.sites.map((site): DebtOutcome => ({
    ruleSet: site.ruleSet,
    address: site.address,
    file: site.file,
    ...effectOf({ site, held, rest: request }),
  }));
  const undecided = request.unrecordable.map((site): DebtOutcome => ({
    address: site.address,
    file: site.file,
    effect: "unrecordable",
    because: site.because,
  }));
  return inSiteOrder({ sites: [...decided, ...undecided] });
};
