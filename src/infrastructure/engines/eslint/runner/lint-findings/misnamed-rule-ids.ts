import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import { commentValueOf } from "./checks-comment-value.ts";
import type { NonEmptyRuleIds } from "../../../protocol/checks/checks-runner-types.ts";
import type { MisnamedRuleId, VersionOneRuleId } from "../checks-runner/checks-run-types.ts";
import type { LintedMessage } from "../toolchain/eslint-instance.ts";
import { MISNAMED_DISABLE_RULE_ID, namedRuleIdsOf, OWN_RULE_ID_PREFIX } from "./misnamed-disable-rule.ts";

type Misnaming = { readonly kind: "names-no-check" } | { readonly kind: "version-1-id"; readonly replacedBy: NonEmptyRuleIds } | "named-right";

const NAMES_NO_CHECK: Misnaming = { kind: "names-no-check" };

const misnamingOf = (request: {
  readonly ruleId: string;
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
}): Misnaming => {
  if (!request.ruleId.startsWith(OWN_RULE_ID_PREFIX) || request.checkRuleIds.includes(request.ruleId)) {
    return "named-right";
  }
  const [first, ...rest] = request.versionOneRuleIds.find((candidate) => candidate.ruleId === request.ruleId)?.replacedBy ?? [];
  return first === undefined ? NAMES_NO_CHECK : { kind: "version-1-id", replacedBy: [first, ...rest] };
};

export const misnamedRuleIdsIn = (request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
}): readonly MisnamedRuleId[] =>
  request.messages
    .filter((message) => message.ruleId === MISNAMED_DISABLE_RULE_ID)
    .flatMap((message) =>
      namedRuleIdsOf({ value: commentValueOf({ text: message.message }) }).flatMap((ruleId) => {
        const misnaming = misnamingOf({ ruleId, checkRuleIds: request.checkRuleIds, versionOneRuleIds: request.versionOneRuleIds });
        return misnaming === "named-right" ? [] : [{ ...misnaming, ruleId, file: request.file, line: message.line, text: message.message }];
      }),
    );
