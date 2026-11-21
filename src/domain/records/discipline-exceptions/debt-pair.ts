import { type ClauseAddress, clauseAddressSchema, clauseAddressText } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { StructuralExceptionEntry } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";

export type DebtPair = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
};

const pairKeyOf = (request: { readonly clauseText: string; readonly file: string }): string => `${request.clauseText} ${request.file}`;

export const debtPairKey = (request: DebtPair): string =>
  pairKeyOf({ clauseText: clauseAddressText({ address: request.clause }), file: request.file });

export const entryPairKey = (request: { readonly entry: StructuralExceptionEntry }): string | undefined => {
  if (request.entry.kind === "clause-wide-carve-out") {
    return undefined;
  }
  const clause = clauseAddressSchema.safeParse(request.entry.clause);
  return clause.success ? pairKeyOf({ clauseText: clauseAddressText({ address: clause.data }), file: request.entry.file }) : undefined;
};

const textOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const pairOrder = (request: { readonly left: DebtPair; readonly right: DebtPair }): number =>
  request.left.file === request.right.file
    ? textOrder({ left: clauseAddressText({ address: request.left.clause }), right: clauseAddressText({ address: request.right.clause }) })
    : textOrder({ left: request.left.file, right: request.right.file });

export const distinctDebtPairs = (request: { readonly pairs: readonly DebtPair[] }): readonly DebtPair[] =>
  [...new Map(request.pairs.map((pair) => [debtPairKey(pair), { clause: pair.clause, file: pair.file }])).values()].toSorted(
    (left, right) => pairOrder({ left, right }),
  );
