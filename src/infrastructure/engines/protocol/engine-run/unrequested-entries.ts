import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../../../domain/rule-set/clause-address.ts";

export type FiledClause = { readonly clause: ClauseAddress; readonly file: RepoPath };

export type RequestHeld = {
  readonly files: ReadonlySet<RepoPath>;
  readonly clauses: ReadonlySet<string>;
};

export const requestHeldOf = (request: {
  readonly files: readonly RepoPath[];
  readonly clauses: readonly ClauseAddress[];
}): RequestHeld => ({
  files: new Set(request.files),
  clauses: new Set(request.clauses.map((address) => clauseAddressText({ address }))),
});

const clauseHeld = (request: {
  readonly held: RequestHeld;
  readonly clause: ClauseAddress;
}): "held" | "not-held" =>
  request.held.clauses.has(clauseAddressText({ address: request.clause })) ? "held" : "not-held";

export const unrequestedDetailOf = (request: {
  readonly noun: string;
  readonly entries: readonly FiledClause[];
  readonly held: RequestHeld;
}): readonly string[] => {
  const entry = request.entries.find(
    (candidate) =>
      !request.held.files.has(candidate.file) ||
      clauseHeld({ held: request.held, clause: candidate.clause }) === "not-held",
  );
  return entry === undefined
    ? []
    : [
        `${request.noun} names ${clauseAddressText({ address: entry.clause })} in ${entry.file}, which the request did not hold`,
      ];
};

export const unrequestedClauseDetailOf = (request: {
  readonly noun: string;
  readonly entries: readonly Pick<FiledClause, "clause">[];
  readonly held: RequestHeld;
}): readonly string[] => {
  const entry = request.entries.find(
    (candidate) => clauseHeld({ held: request.held, clause: candidate.clause }) === "not-held",
  );
  return entry === undefined
    ? []
    : [
        `${request.noun} names ${clauseAddressText({ address: entry.clause })}, which the request did not hold`,
      ];
};
