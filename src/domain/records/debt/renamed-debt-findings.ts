import type { CheckFinding } from "../../finding/governance.ts";
import type { RenamedPaths } from "../../repository/renamed-path.ts";
import type { AnsweredFinding } from "../answering/answering.ts";

export const renamedDebtFindingsOf = (request: {
  readonly answered: readonly AnsweredFinding[];
  readonly renamed: RenamedPaths;
}): readonly CheckFinding[] =>
  request.answered.flatMap(({ finding, by }) =>
    request.renamed.has(finding.file) && by.some((placed) => placed.record.kind === "debt")
      ? [finding]
      : [],
  );
