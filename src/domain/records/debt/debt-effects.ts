import { checkAddressOf } from "../../language-layer/check-address.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { debtForfeitureAt } from "./debt-forfeiture.ts";
import { type DebtOrigin, type DebtSite, inSiteOrder, type SitePlace } from "./debt-sites.ts";
import type { Debt, PlacedRecord } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { UnrecordableBecause, UnrecordableSite } from "./unrecordable-site.ts";

export type DebtEffect =
  | { readonly effect: "recorded" }
  | { readonly effect: "already-recorded"; readonly heldIn: RepoPath }
  | { readonly effect: "left"; readonly under: RepoPath }
  | { readonly effect: "touched"; readonly of: DebtOrigin }
  | { readonly effect: "unrecordable"; readonly because: UnrecordableBecause };

export type DebtOutcome = SitePlace & DebtEffect;

export type DebtEffectsRequest = {
  readonly sites: readonly DebtSite[];
  readonly unrecordable: readonly UnrecordableSite[];
  readonly records: readonly PlacedRecord[];
  readonly leave: readonly RepoPath[];
  readonly touched: TouchedSet;
};

type HeldDebt = { readonly place: PlacedRecord["place"]; readonly debt: Debt };

export const debtAddressOf = (request: { readonly debt: Debt }): string =>
  request.debt.reach.reaches === "one-check" ? checkAddressOf({ check: request.debt.reach.check }) : request.debt.symptom.name;

const heldDebtsIn = (request: { readonly records: readonly PlacedRecord[] }): readonly HeldDebt[] =>
  request.records.flatMap((placed) => (placed.record.kind === "debt" ? [{ place: placed.place, debt: placed.record }] : []));

const leavingPath = (request: { readonly file: RepoPath; readonly leave: readonly RepoPath[] }): RepoPath | undefined =>
  request.leave.find((path) => request.file === path || request.file.startsWith(`${path}/`));

const effectOf = (request: { readonly site: DebtSite; readonly held: readonly HeldDebt[]; readonly rest: Omit<DebtEffectsRequest, "sites" | "unrecordable" | "records"> }): DebtEffect => {
  const { site, held, rest } = request;
  const heldHere = held.find((candidate) => candidate.debt.file === site.file && debtAddressOf({ debt: candidate.debt }) === site.address);
  if (heldHere !== undefined) {
    return { effect: "already-recorded", heldIn: heldHere.place.file };
  }
  const under = leavingPath({ file: site.file, leave: rest.leave });
  if (under !== undefined) {
    return { effect: "left", under };
  }
  return debtForfeitureAt({ touched: rest.touched, file: site.file }) === "forfeits" ? { effect: "touched", of: site.origin } : { effect: "recorded" };
};

export const debtOutcomesOf = (request: DebtEffectsRequest): readonly DebtOutcome[] => {
  const held = heldDebtsIn(request);
  const decided = request.sites.map((site): DebtOutcome => ({ address: site.address, file: site.file, ...effectOf({ site, held, rest: request }) }));
  const undecided = request.unrecordable.map((site): DebtOutcome => ({ address: site.address, file: site.file, effect: "unrecordable", because: site.because }));
  return inSiteOrder({ sites: [...decided, ...undecided] });
};
