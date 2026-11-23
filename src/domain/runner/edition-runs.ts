import type { Edition } from "../rule-set/edition-types.ts";
import type { SourceCase } from "../rule-set/rule-set-types.ts";

export const casesByEdition = (request: {
  readonly defaultEdition: Edition;
  readonly cases: readonly SourceCase[];
}) => {
  const caseEditionOf = (sourceCase: SourceCase): Edition =>
    sourceCase.edition ?? request.defaultEdition;
  const editions = new Set([request.defaultEdition, ...request.cases.map(caseEditionOf)]);
  return [...editions].flatMap((edition) => {
    const cases = request.cases.filter((sourceCase) => caseEditionOf(sourceCase) === edition);
    return cases.length === 0 ? [] : [{ edition, cases }];
  });
};
