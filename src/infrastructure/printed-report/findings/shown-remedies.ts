import type { ClauseRoot } from "../../../domain/settings/selection/selection.ts";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { PathPort } from "../../node/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { clauseAddressText } from "../../discipline-exceptions-folder/clause-address.ts";
import type { PackageLink } from "../../command-line/installation/package-link.ts";
import { shownPathOf } from "../../command-line/installation/shown-path.ts";

type ShownRemedyRequest = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly link: PackageLink;
  readonly clauseRoots: readonly ClauseRoot[];
};

const ruleFolderOf = (request: ShownRemedyRequest & { readonly finding: Finding }): string | undefined => {
  const clause = clauseAddressText({ address: request.finding.clause });
  const root = request.clauseRoots.find((candidate) => clauseAddressText({ address: candidate.clause }) === clause);
  return root === undefined ? undefined : request.path.join({ segments: [root.ruleSetRoot, "rules", root.clause.discipline] });
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
  const page = shownPathOf({ ...request, target: request.path.join({ segments: [ruleFolder, remedy.page] }) });
  return { ...located, remedy: { ...remedy, page } };
};

export const shownRemediesOf = (request: ShownRemedyRequest & { readonly findings: readonly Finding[] }): readonly Finding[] =>
  request.findings.map((finding) => shownRemedyOf({ ...request, finding }));
