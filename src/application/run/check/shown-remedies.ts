import type { Finding } from "../../../domain/finding/governance.ts";
import { CHECK_ITEMS_SEGMENTS } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { ClauseRoot } from "../../../domain/settings/selection/selection.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";

type ShownRemedyRequest = {
  readonly path: PathPort;
  readonly shownPathOf: ShownPathOf;
  readonly clauseRoots: readonly ClauseRoot[];
};

const remedyFolderSegmentsOf = (root: ClauseRoot): readonly string[] =>
  root.checks.length === 0
    ? [root.ruleSetRoot, "rules", root.clause.discipline]
    : [root.ruleSetRoot, ...CHECK_ITEMS_SEGMENTS];

const remedyFolderOf = (
  request: ShownRemedyRequest & { readonly finding: Finding },
): string | undefined => {
  const clause = clauseAddressText({ address: request.finding.clause });
  const root = request.clauseRoots.find(
    (candidate) => clauseAddressText({ address: candidate.clause }) === clause,
  );
  return root === undefined
    ? undefined
    : request.path.join({ segments: remedyFolderSegmentsOf(root) });
};

const shownRemedyOf = (request: ShownRemedyRequest & { readonly finding: Finding }): Finding => {
  const { remedy, ...located } = request.finding;
  if (remedy === undefined) {
    return request.finding;
  }
  const remedyFolder = remedyFolderOf(request);
  if (remedyFolder === undefined) {
    return located;
  }
  const page = request.shownPathOf({
    target: request.path.join({ segments: [remedyFolder, remedy.page] }),
  });
  return { ...located, remedy: { ...remedy, page } };
};

export const shownRemediesOf = (
  request: ShownRemedyRequest & { readonly findings: readonly Finding[] },
): readonly Finding[] => request.findings.map((finding) => shownRemedyOf({ ...request, finding }));
