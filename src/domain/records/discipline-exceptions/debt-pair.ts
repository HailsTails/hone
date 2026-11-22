import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressOf, clauseAddressText } from "../../rule-set/clause-address.ts";
import type { StructuralExceptionEntry } from "./exception-entry.ts";

export type DebtPair = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
};

const pairKeyOf = (request: { readonly clauseText: string; readonly file: string }): string =>
  `${request.clauseText} ${request.file}`;

export const debtPairKey = (request: DebtPair): string =>
  pairKeyOf({ clauseText: clauseAddressText({ address: request.clause }), file: request.file });

export const entryPairKey = (request: {
  readonly entry: StructuralExceptionEntry;
}): string | undefined => {
  if (request.entry.kind === "clause-wide-carve-out") {
    return undefined;
  }
  const clause = clauseAddressOf({ text: request.entry.clause });
  return clause === "not-a-clause-address"
    ? undefined
    : pairKeyOf({ clauseText: clauseAddressText({ address: clause }), file: request.entry.file });
};

const textOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const pairOrder = (request: { readonly left: DebtPair; readonly right: DebtPair }): number =>
  request.left.file === request.right.file
    ? textOrder({
        left: clauseAddressText({ address: request.left.clause }),
        right: clauseAddressText({ address: request.right.clause }),
      })
    : textOrder({ left: request.left.file, right: request.right.file });

export const distinctDebtPairs = (request: {
  readonly pairs: readonly DebtPair[];
}): readonly DebtPair[] =>
  [
    ...new Map(
      request.pairs.map((pair) => [debtPairKey(pair), { clause: pair.clause, file: pair.file }]),
    ).values(),
  ].toSorted((left, right) => pairOrder({ left, right }));
