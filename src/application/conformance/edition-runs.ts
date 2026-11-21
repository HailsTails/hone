import type { RunnerClause } from "../../domain/runner/runner-module-types.ts";
import type { SourceCase } from "../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import type { Edition } from "../../infrastructure/content-files/edition.ts";

export type EditionRun = { readonly clause: RunnerClause; readonly cases: readonly SourceCase[] };

const caseEditionOf = (request: { readonly sourceCase: SourceCase; readonly clause: RunnerClause }): Edition =>
  request.sourceCase.edition ?? request.clause.edition;

export const editionRunsOf = (request: { readonly clause: RunnerClause; readonly cases: readonly SourceCase[] }): readonly EditionRun[] => {
  const editions = [
    ...new Set([request.clause.edition, ...request.cases.map((sourceCase) => caseEditionOf({ sourceCase, clause: request.clause }))]),
  ];
  return editions
    .map((edition) => ({
      clause: { ...request.clause, edition },
      cases: request.cases.filter((sourceCase) => caseEditionOf({ sourceCase, clause: request.clause }) === edition),
    }))
    .filter((run) => run.cases.length > 0);
};
