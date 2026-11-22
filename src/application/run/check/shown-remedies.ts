import type { ClauseRoot } from "../../../domain/settings/selection/selection.ts";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";

type ShownRemedyRequest = {
  readonly path: PathPort;
  readonly shownPathOf: ShownPathOf;
  readonly clauseRoots: readonly ClauseRoot[];
};

const ruleFolderOf = (request: ShownRemedyRequest & { readonly finding: Finding }): string | undefined => {
  const clause = clauseAddressText({ address: request.finding.clause });
  const root = request.clauseRoots.find((candidate) => clauseAddressText({ address: candidate.clause }) === clause);
  return root === undefined || !("discipline" in root.clause) ? undefined : request.path.join({ segments: [root.ruleSetRoot, "rules", root.clause.discipline] });
};

const shownRemedyOf = (request: ShownRemedyRequest & { readonly finding: Finding }): Finding => {
  const { remedy, ...located } = request.finding;
  if (remedy === undefined) {
    return request.finding;
  }
  const ruleFolder = ruleFolderOf(request);
  if (ruleFolder === undefined) {
    return located;
  }
  const page = request.shownPathOf({ target: request.path.join({ segments: [ruleFolder, remedy.page] }) });
  return { ...located, remedy: { ...remedy, page } };
};

export const shownRemediesOf = (request: ShownRemedyRequest & { readonly findings: readonly Finding[] }): readonly Finding[] =>
  request.findings.map((finding) => shownRemedyOf({ ...request, finding }));
